const encode = new TextEncoder();
const backupName = 'zz-migration-v1';

function result(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function completed(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

async function hash(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function openSource(name) {
  const request = indexedDB.open(name);
  let missing = false;
  request.onupgradeneeded = event => {
    missing = event.oldVersion === 0;
    request.transaction.abort();
  };
  try {
    return await result(request);
  } catch (error) {
    if (missing && error.name === 'AbortError') return null;
    throw error;
  }
}

async function openBackup() {
  const request = indexedDB.open(backupName, 1);
  request.onupgradeneeded = () => {
    for (const store of ['snapshots', 'media', 'heads', 'receipts']) request.result.createObjectStore(store);
  };
  return result(request);
}

async function requiredPhotos(appId, entries) {
  if (appId !== 'zz5') return new Set();
  // The builder places the worker one level below ALETHEIA's offline app modules.
  const [{ parsePhotoSets }, { parseMeta }] = await Promise.all([
    import('../logic-photo-sets.js'), import('../logic-presets.js'),
  ]);
  const slots = parsePhotoSets(entries['aletheia.photoSets.v2'], entries['aletheia.custom12.v1']);
  const meta = parseMeta(entries['aletheia.meta.v1']);
  const ids = slots.ok ? slots.sets.flat().filter(Boolean) : [];
  if (meta.ok) ids.push(...meta.meta.presets.map(preset => preset.imageId));
  return new Set(ids);
}

function missingPhoto() {
  return new DOMException('연결된 사진 원본이 누락되었거나 비어 있습니다.', 'MissingPhotoError');
}

function verifyPhotoRefs(ids, refs) {
  const complete = new Set(refs.filter(ref => ref.valueShape === 'record' && ref.size > 0).map(ref => ref.key));
  for (const id of ids) if (!complete.has(id)) throw missingPhoto();
}

async function readMedia(spec, required, visit) {
  const refs = [];
  if (!spec) return refs;
  const db = await openSource(spec.db);
  if (!db) return refs;
  const source = () => db.transaction(spec.store).objectStore(spec.store);
  try {
    if (!db.objectStoreNames.contains(spec.store) && required.size) throw missingPhoto();
    for (const key of await result(source().getAllKeys())) {
      const record = await result(source().get(key));
      const wrapped = !(record instanceof Blob);
      const blob = wrapped ? record?.blob : record;
      if (required.has(key) && (!wrapped || !(blob instanceof Blob) || blob.size === 0)) throw missingPhoto();
      if (!(blob instanceof Blob)) throw new Error('사진 원본을 읽을 수 없습니다.');
      const meta = wrapped ? Object.fromEntries(Object.entries(record).filter(([k]) => k !== 'blob')) : {};
      const sha256 = await hash(await blob.arrayBuffer());
      refs.push({ ...spec, key, type: blob.type, size: blob.size, sha256, recordMeta: meta, valueShape: wrapped ? 'record' : 'blob' });
      await visit?.(sha256, blob);
    }
  } finally {
    db.close();
  }
  return refs;
}

async function saveMedia(db, key, blob, verified) {
  if (verified.has(key)) return;
  const store = () => db.transaction('media').objectStore('media');
  const existing = await result(store().get(key));
  if (existing instanceof Blob && existing.size === blob.size && await hash(await existing.arrayBuffer()) === key) {
    verified.add(key);
    return;
  }
  const tx = db.transaction('media', 'readwrite');
  tx.objectStore('media').put(blob, key);
  await completed(tx);
  const stored = await result(store().get(key));
  if (!(stored instanceof Blob) || await hash(await stored.arrayBuffer()) !== key) throw new Error('사진 검증에 실패했습니다.');
  verified.add(key);
}

async function run({config, rawEntries, sourceOrigin, sourcePath, exporting}) {
  const db = exporting ? null : await openBackup();
  try {
    const files = new Map();
    const verified = new Set();
    const required = await requiredPhotos(config.appId, rawEntries);
    const refs = await readMedia(config.media, required, async (key, blob) => {
      if (db) await saveMedia(db, key, blob, verified);
      else files.set('media/' + key, blob);
    });
    if (JSON.stringify(refs) !== JSON.stringify(await readMedia(config.media, required))) throw new Error('source-changed');
    verifyPhotoRefs(required, refs);
    const contentHash = await hash(encode.encode(JSON.stringify([config.appId, rawEntries, refs])));
    const snapshotId = config.appId + ':' + contentHash;
    let manifest = {schemaVersion: 1, appId: config.appId, sourceOrigin, sourcePath, buildId: config.buildId,
      snapshotId, createdAt: new Date().toISOString(), rawEntries, mediaRefs: refs,
      counts: {rawEntries: Object.keys(rawEntries).length, mediaRefs: refs.length}, contentHash};
    if (manifest.counts.rawEntries + refs.length === 0) {
      if (!exporting) return {empty:true};
      const saved = await openBackup();
      try {
        const head = await result(saved.transaction('heads').objectStore('heads').get(config.appId));
        if (!head) return {empty:true};
        manifest = await result(saved.transaction('snapshots').objectStore('snapshots').get(head));
        verifyPhotoRefs(await requiredPhotos(config.appId, manifest.rawEntries), manifest.mediaRefs);
        for (const ref of manifest.mediaRefs) {
          const blob = await result(saved.transaction('media').objectStore('media').get(ref.sha256));
          if (!(blob instanceof Blob) || await hash(await blob.arrayBuffer()) !== ref.sha256) throw new Error('사진 검증에 실패했습니다.');
          files.set('media/' + ref.sha256, blob);
        }
      } finally { saved.close(); }
    }
    const approved = new Promise(resolve => { self.onmessage = event => resolve(event.data.confirm === true); });
    self.postMessage({verify:true});
    if (!await approved) throw new Error('source-changed');
    if (exporting) {
      const json = new Blob([JSON.stringify(manifest)], {type:'application/json'});
      files.set('manifest.json', json);
      return {file: config.media ? await (await import('./zip.mjs')).zip(files) : json};
    }
    const tx = db.transaction(['snapshots','heads'], 'readwrite');
    const snapshots = tx.objectStore('snapshots');
    const exists = snapshots.getKey(snapshotId);
    exists.onsuccess = () => {
      if (exists.result === undefined) snapshots.put(manifest, snapshotId);
      tx.objectStore('heads').put(snapshotId, config.appId);
    };
    await completed(tx);
    return {saved:true};
  } finally { db?.close(); }
}

self.onmessage = async event => {
  try { self.postMessage(await run(event.data)); }
  catch (error) { self.postMessage({error:error.message, name:error.name}); }
};
