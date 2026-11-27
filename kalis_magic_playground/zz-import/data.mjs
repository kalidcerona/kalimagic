// Version-one reader: no source storage is mutated or removed.
export const TARGETS = Object.create(null);
function register(target, appId, pairs, media = [], appearance) {
  TARGETS[target] = { appId, keys: Object.fromEntries(pairs), media, appearance };
}
const pairs = (from, to, suffixes) => suffixes.split(',').map((s) => [from + s, to === null ? null : to + s]);
const media = (db, store, targetDb) => [{ db, store, targetDb, targetStore: store }];
for (const target of ['kairos', 'kairos-classic']) {
  register(
    target,
    'zz1',
    [
      ...pairs(
        'stopwatch_',
        `friend-${target}_`,
        'preset_cs,preset_at,custom_text,text_at,ui_mode,seq,seq_slots,trick3,portrait_digit_guide_v1,named_presets_v1,uni_install_nudge_done',
      ),
      ...pairs('stopwatch2_', `friend-${target}-legacy_`, 'preset_cs,preset_at,custom_text,text_at'),
      ['stopwatch-settings-entry-tutorial-v1', `friend-${target}-settings-entry-tutorial-v1`],
      ['stopwatch_storage_migrated_v2', null],
    ],
    [],
    'stopwatch',
  );
}
register(
  'release',
  'zz2',
  [
    ['unlock-settings-personal-v2', 'unlock-settings-v1'],
    ['unlock-settings-v1', 'unlock-settings-v1'],
    ['unlock-settings-entry-tutorial-v1', 'friend-unlock-settings-entry-tutorial-v1'],
    ['unlock-install-personal-v1', 'unlock-install-shared-v1'],
    ...pairs('release.', 'release.', 'rewindGridGuide.v1,rewindCharging.v1,rewindDnd.v1'),
  ],
  media('unlock-images-personal', 'images', 'unlock-images'),
  'unlock',
);
register(
  'hitsuzen',
  'zz3',
  [...pairs('magic-calc-', 'magic-calc-', 'date-delay,hour-cycle,skin'), [
    'installNudgeDone',
    'installNudgeDone',
  ], ['calculator-settings-entry-tutorial-v1:/zz3', 'calculator-settings-entry-tutorial-v1:/tools/hitsuzen']],
  [],
  'calculator',
);
register(
  'choice',
  'zz4',
  [...pairs('magic-choice.v1.', 'magic-choice-dist.v1.', 'store,store.backup,user-icons,input-guide'), [
    'magic-choice.settings-gesture-guide.v1',
    'magic-choice-dist.settings-gesture-guide.v1',
  ], ['magic-choice.performance-log.v1', null]],
  media('magic-choice.v1.media', 'wallpaper', 'magic-choice-dist.v1.media'),
  'choice',
);
register(
  'aletheia',
  'zz5',
  pairs(
    'aletheia.',
    'aletheia.distribution.',
    'meta.v1,custom12.v1,photoSets.v2,cellGuide.v1,coverage.v1,settings-gesture-guide.v1',
  ),
  media('aletheia', 'images', 'aletheia-distribution'),
  'aletheia',
);
register(
  'tobira',
  'zz6',
  [...pairs(
    'tobira.',
    'friend-tobira.',
    'v1,v1.notice,v1.recovery,objectKind.v1,coinChoices.v1,wallpaperCrop.v1,motion-effects.v1,settings-gesture-guide.v1',
  )],
  media('tobira.localImages.v1', 'images', 'friend-tobira.localImages.v1'),
  'tobira',
);
register(
  'usotsuki',
  'zz7',
  [
    ...pairs('usotsuki.detector.', 'usotsuki.distribution.detector.', 'v1,sound.v1,theme.v1'),
    ...pairs('usotsuki.detector.', 'usotsuki.detector.', 'scan-duration.v1,vibration.v1'),
    ['usotsuki.performance-log.v1', null],
  ],
  [],
  'usotsuki',
);
register(
  'asrai',
  'zz8',
  pairs('asrai.prototype.', 'friend-asrai.prototype.', 'v2,settings-guide.v1'),
  [],
  'asrai',
);
register(
  'alter',
  'zz10',
  [['alter-settings', 'friend-alter-settings'], [
    'alter-settings-gesture-guide-v1',
    'friend-alter-settings-gesture-guide-v1',
  ]],
  [],
  'alter',
);
register(
  'tyche',
  'zz11',
  [
    ['zz11-spinner-state-v2-prelaunch', null],
    ...pairs('zz11-spinner-state-', 'friend-spinner-state-', 'v2,v1'),
    ...pairs('zz11-', 'friend-spinner-', 'table-theme-v1,screen-design-v1,guide-seen-v2'),
  ],
  [],
  'spinner',
);
register('memdeck', 'zz12', pairs('magic-memdeck-v1', 'friend-memdeck-v1', ',-preserved-raw'));
register(
  'arosaegida',
  'zz13',
  pairs('magic-qr-session-v1', 'magic-qr-session-v1-arosaegida', ',-preserved-raw'),
);
register('pimax', 'zz14', [...pairs('pimax-practice-', 'pimax.distribution.', 'settings,stats,session'), [
  'pimax-practice-install-dismissed',
  null,
]]);
register(
  'uramichi',
  'zz15',
  pairs(
    'uramichi.web.',
    'friend-uramichi.web.',
    'presets,armed,armMode,recent,settings,intro,install.dismissed,install.seen',
  ),
);
for (const target of ['release', 'hitsuzen']) {
  TARGETS[target].keys['magic-performance-link:v1:release-hitsuzen:personal'] =
    'magic-performance-link:v1:release-hitsuzen:shared';
}
for (
  const [target, prefix] of [['release', 'unlock'], ['choice', 'choice'], ['aletheia', 'aletheia'], [
    'tobira',
    'tobira',
  ]]
) TARGETS[target].keys[`${prefix}.photo-save-failed.v1`] = null;
const aliases = {
  release: 'unlock',
  hitsuzen: 'calc',
  kairos: 'stopwatch-uni',
  'kairos-classic': 'stopwatch',
  tyche: 'spinner',
};
export function mapKey(target, key, { origin = globalThis.location?.origin || '' } = {}) {
  const config = TARGETS[target];
  if (!config) throw new Error('지원하지 않는 앱입니다.');
  if (Object.hasOwn(config.keys, key)) return config.keys[key];
  const paths = [`/${config.appId}`, `/${config.appId}/`, `/${config.appId}/index.html`];
  if (
    config.appearance &&
    paths.some((path) => key === `magic-appearance:v1:${config.appearance}:${origin}${path}`)
  ) {
    // RELEASE retains its editor; every other public app disables this editor.
    const destinationOrigin = globalThis.location?.origin || origin;
    const destinationPath = /^\/tools\/release(?:\/|$)/.test(globalThis.location?.pathname || '')
      ? globalThis.location.pathname.replace(/^\/tools\/release(?=\/|$)/, '/tools/unlock')
      : '/tools/unlock/';
    return target === 'release' ? `magic-appearance:v1:unlock:${destinationOrigin}${destinationPath}` : null;
  }
  if (['usotsuki', 'memdeck', 'arosaegida'].includes(target)) {
    const app = target;
    if (paths.some((path) => key === `first-settings-guide:v1:${app}:${path}`)) {
      return `${target === 'memdeck' ? 'friend-memdeck-' : ''}first-settings-guide:v1:${app}:/tools/${
        aliases[target] || target
      }`;
    }
  }
  return undefined;
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) =>
      JSON.stringify(k) + ':' + canonical(value[k])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}
export async function sha256(value) {
  const bytes = value instanceof Blob
    ? await value.arrayBuffer()
    : typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value;
  return Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function contentHash(snapshot) {
  return sha256(JSON.stringify([snapshot.appId, snapshot.rawEntries, snapshot.mediaRefs]));
}
export function entriesObject(raw) {
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((e) => Array.isArray(e) ? e : [e.key, e.value]));
  if (!raw || typeof raw !== 'object') throw new Error('백업 원문 형식이 올바르지 않습니다.');
  return raw;
}
// These are the native readers' IDs, including their supported legacy entries.
export function validMediaRef(target, ref) {
  if (
    !ref || typeof ref.key !== 'string' || !ref.recordMeta || typeof ref.recordMeta !== 'object' ||
    Array.isArray(ref.recordMeta)
  ) return false;
  const formats = {
    release: /^(?:lock|unlock|home2)$/,
    choice: /^(?:current|w_[A-Za-z0-9_-]{1,40})$/,
    aletheia: /^img_[A-Za-z0-9_-]{1,44}$/,
    tobira: /^(?:wallpaper(?::original)?|coin:[A-Za-z0-9_-]{1,80})$/,
  };
  if (!formats[target]?.test(ref.key)) return false;
  if (target === 'aletheia') {
    return ref.valueShape === 'record' && Object.keys(ref.recordMeta).every((key) => key === 'savedAt') &&
      (!Object.hasOwn(ref.recordMeta, 'savedAt') ||
        (Number.isFinite(ref.recordMeta.savedAt) && ref.recordMeta.savedAt >= 0));
  }
  return ref.valueShape === 'blob' && Object.keys(ref.recordMeta).length === 0;
}
export function validateSnapshot(snapshot, target) {
  const config = TARGETS[target];
  if (!config || snapshot?.schemaVersion !== 1 || snapshot.appId !== config.appId) {
    throw new Error('지원하지 않는 백업 버전 또는 앱입니다.');
  }
  if (
    typeof snapshot.snapshotId !== 'string' || !snapshot.snapshotId || typeof snapshot.buildId !== 'string' ||
    typeof snapshot.createdAt !== 'string' || !Number.isFinite(Date.parse(snapshot.createdAt))
  ) throw new Error('백업 식별 정보가 올바르지 않습니다.');
  if (
    !/^https?:\/\/[^/]+$/.test(snapshot.sourceOrigin) ||
    ![`/${config.appId}`, `/${config.appId}/`, `/${config.appId}/index.html`].includes(snapshot.sourcePath)
  ) throw new Error('백업 출처 경로가 올바르지 않습니다.');
  if (!Array.isArray(snapshot.mediaRefs) || !/^[a-f0-9]{64}$/.test(snapshot.contentHash || '')) {
    throw new Error('백업 검증 정보가 없습니다.');
  }
  try {
    if (new URL(snapshot.sourceOrigin).origin !== snapshot.sourceOrigin) throw new Error();
  } catch {
    throw new Error('백업 출처가 올바르지 않습니다.');
  }
  const raw = entriesObject(snapshot.rawEntries);
  if (Array.isArray(snapshot.rawEntries) && Object.keys(raw).length !== snapshot.rawEntries.length) {
    throw new Error('중복된 백업 저장 키입니다.');
  }
  if (
    !snapshot.counts || snapshot.counts.rawEntries !== Object.keys(raw).length ||
    snapshot.counts.mediaRefs !== snapshot.mediaRefs.length
  ) throw new Error('백업 항목 수가 일치하지 않습니다.');
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || mapKey(target, key, { origin: snapshot.sourceOrigin }) === undefined) {
      throw new Error('백업에 허용되지 않은 저장 키가 있습니다.');
    }
  }
  const seen = new Set();
  if (Object.keys(raw).length > 512 || Object.values(raw).some((value) => value.length > 32 * 1024 * 1024)) {
    throw new Error('백업 원문이 너무 큽니다.');
  }
  for (const ref of snapshot.mediaRefs) {
    if (
      !validMediaRef(target, ref) || !['blob', 'record'].includes(ref.valueShape) ||
      typeof ref.type !== 'string' || !ref.recordMeta || typeof ref.recordMeta !== 'object' ||
      Array.isArray(ref.recordMeta) || !config.media.some((m) => m.db === ref.db && m.store === ref.store) ||
      typeof ref.key !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256) ||
      !Number.isSafeInteger(ref.size) || ref.size < 0 || ref.size > 100 * 1024 * 1024 ||
      seen.has(`${ref.db}/${ref.store}/${ref.key}`)
    ) throw new Error('사진 참조가 올바르지 않습니다.');
    seen.add(`${ref.db}/${ref.store}/${ref.key}`);
  }
  return snapshot;
}
export const requestResult = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('저장소 읽기 실패'));
  });
export async function openExistingDatabase(name, factory = globalThis.indexedDB) {
  if (!factory) throw new Error('이 브라우저에서 저장소를 읽을 수 없습니다.');
  if (factory.databases && !(await factory.databases()).some((db) => db.name === name)) return null;
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    let absent = false;
    request.onupgradeneeded = () => {
      absent = true;
      request.transaction.abort();
    };
    request.onerror = () => absent ? resolve(null) : reject(request.error);
    request.onblocked = () => reject(new Error('다른 탭이 저장소를 사용 중입니다.'));
    request.onsuccess = () => resolve(request.result);
  });
}
async function records(db, store) {
  if (!db.objectStoreNames.contains(store)) throw new Error(`백업 저장소가 없습니다: ${store}`);
  const source = db.transaction(store, 'readonly').objectStore(store);
  const [keys, values] = await Promise.all([
    requestResult(source.getAllKeys()),
    requestResult(source.getAll()),
  ]);
  return keys.map((key, i) => ({ key, value: values[i] }));
}
export async function normalizeCandidate(snapshot, target, resolveMedia, source = 'snapshot') {
  validateSnapshot(snapshot, target);
  if (await contentHash(snapshot) !== snapshot.contentHash) {
    throw new Error('백업 내용 해시가 일치하지 않습니다.');
  }
  const loaded = [];
  for (const ref of snapshot.mediaRefs) {
    const stored = await resolveMedia(ref);
    const blob = stored instanceof Blob ? stored : stored?.blob;
    if (!(blob instanceof Blob) || blob.size !== ref.size || await sha256(blob) !== ref.sha256) {
      throw new Error('사진이 없거나 손상되었습니다.');
    }
    const mapping = TARGETS[target].media.find((m) => m.db === ref.db && m.store === ref.store);
    const value = ref.valueShape === 'record' ? { ...ref.recordMeta, blob } : blob;
    loaded.push({ ref, value, targetDb: mapping.targetDb, targetStore: mapping.targetStore });
  }
  const rawEntries = entriesObject(snapshot.rawEntries);
  const releaseSettings = target === 'release' ? releaseSettingsSource(rawEntries) : undefined;
  const appearanceKeys = Object.keys(rawEntries).filter((key) =>
    key.startsWith('magic-appearance:') && mapKey(target, key, { origin: snapshot.sourceOrigin })
  );
  const preferredAppearance =
    appearanceKeys.find((key) => key.endsWith(snapshot.sourceOrigin + snapshot.sourcePath)) ||
    appearanceKeys.find((key) => key.endsWith(`/${snapshot.appId}/`)) || appearanceKeys.sort()[0];
  return {
    snapshot,
    snapshotId: snapshot.snapshotId,
    rawEntries,
    mediaRefs: snapshot.mediaRefs,
    media: loaded,
    contentHash: snapshot.contentHash,
    source,
    warnings: [],
    entries: Object.entries(rawEntries).map(([sourceKey, value]) => ({
      sourceKey,
      targetKey: mapKey(target, sourceKey, { origin: snapshot.sourceOrigin }),
      value,
      archive: mapKey(target, sourceKey, { origin: snapshot.sourceOrigin }) === null ||
        (target === 'release' && ['unlock-settings-personal-v2', 'unlock-settings-v1'].includes(sourceKey) &&
          sourceKey !== releaseSettings) ||
        (appearanceKeys.includes(sourceKey) && sourceKey !== preferredAppearance),
    })),
  };
}
export async function discoverSources(
  target,
  {
    storage = globalThis.localStorage,
    indexedDB = globalThis.indexedDB,
    origin = globalThis.location?.origin || '',
  } = {},
) {
  const config = TARGETS[target];
  if (!config) throw new Error('지원하지 않는 앱입니다.');
  const candidates = [], warnings = [], sharedSnapshots = [];
  let backup;
  try {
    backup = await openExistingDatabase('zz-migration-v1', indexedDB);
    if (backup) {
      if (['release', 'hitsuzen'].includes(target)) {
        const peerTarget = target === 'release' ? 'hitsuzen' : 'release';
        const peerHead = await requestResult(
          backup.transaction('heads', 'readonly').objectStore('heads').get(TARGETS[peerTarget].appId),
        );
        if (peerHead) {
          try {
            const peer = await requestResult(
              backup.transaction('snapshots', 'readonly').objectStore('snapshots').get(
                typeof peerHead === 'string' ? peerHead : peerHead.snapshotId,
              ),
            );
            validateSnapshot(peer, peerTarget);
            if (await contentHash(peer) !== peer.contentHash) throw new Error('연동 백업 해시 불일치');
            sharedSnapshots.push(peer);
          } catch (error) {
            warnings.push(`연동 백업 읽기 실패: ${error.message}`);
          }
        }
      }
      const head = await requestResult(
        backup.transaction('heads', 'readonly').objectStore('heads').get(config.appId),
      );
      if (head) {
        const id = typeof head === 'string' ? head : head.snapshotId;
        const snapshot = await requestResult(
          backup.transaction('snapshots', 'readonly').objectStore('snapshots').get(id),
        );
        candidates.push(
          await normalizeCandidate(
            snapshot,
            target,
            async (ref) =>
              requestResult(backup.transaction('media', 'readonly').objectStore('media').get(ref.sha256)),
          ),
        );
      }
    }
  } catch (error) {
    warnings.push(`백업 읽기 실패: ${error.message}`);
  } finally {
    backup?.close();
  }
  try {
    const rawEntries = Object.create(null), sourceKeys = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (mapKey(target, key, { origin }) !== undefined) sourceKeys.push(key);
    }
    for (const key of sourceKeys.sort()) rawEntries[key] = storage.getItem(key);
    const mediaRefs = [], blobs = new Map();
    for (const mapping of config.media) {
      const db = await openExistingDatabase(mapping.db, indexedDB);
      if (!db) continue;
      try {
        for (const { key, value } of await records(db, mapping.store)) {
          const blob = value instanceof Blob ? value : value?.blob;
          if (!(blob instanceof Blob)) throw new Error('사진 원문이 손상되었습니다.');
          const hash = await sha256(blob);
          const meta = value instanceof Blob
            ? null
            : Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'blob'));
          mediaRefs.push({
            db: mapping.db,
            store: mapping.store,
            key,
            type: blob.type,
            size: blob.size,
            sha256: hash,
            recordMeta: meta || {},
            valueShape: value instanceof Blob ? 'blob' : 'record',
          });
          blobs.set(hash, blob);
        }
      } finally {
        db.close();
      }
    }
    mediaRefs.sort((left, right) => {
      const a = JSON.stringify([left.db, left.store, left.key]),
        b = JSON.stringify([right.db, right.store, right.key]);
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const unique = Object.keys(rawEntries).some((k) => mapKey(target, k, { origin }) !== k);
    if (unique || mediaRefs.length || (candidates.length && Object.keys(rawEntries).length)) {
      const snapshot = {
        schemaVersion: 1,
        appId: config.appId,
        sourceOrigin: origin,
        sourcePath: `/${config.appId}/`,
        buildId: 'raw-fallback',
        snapshotId: 'raw',
        createdAt: new Date().toISOString(),
        rawEntries,
        mediaRefs,
        counts: { rawEntries: Object.keys(rawEntries).length, mediaRefs: mediaRefs.length },
      };
      snapshot.contentHash = await contentHash(snapshot);
      snapshot.snapshotId = `raw:${snapshot.contentHash}`;
      if (
        !candidates.some((c) =>
          canonical([c.rawEntries, c.mediaRefs]) === canonical([snapshot.rawEntries, snapshot.mediaRefs])
        )
      ) candidates.push(await normalizeCandidate(snapshot, target, (ref) => blobs.get(ref.sha256), 'raw'));
    }
  } catch (error) {
    warnings.push(`원본 읽기 실패: ${error.message}`);
  }
  if (['release', 'hitsuzen'].includes(target)) {
    const versions = [...sharedSnapshots, ...candidates.map((candidate) => candidate.snapshot)];
    for (let i = 0; i < candidates.length; i++) {
      candidates[i] = await arbitrateSharedLink(candidates[i], versions);
    }
  }
  return { candidates, warnings };
}
export async function readImportFile(file, target) {
  if (file.size > 256 * 1024 * 1024) throw new Error('백업 파일이 너무 큽니다.');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let snapshot, blobs = new Map();
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const { readZip } = await import('./data-zip.mjs');
    const files = await readZip(buffer);
    const manifest = files.get('manifest.json');
    if (!manifest) throw new Error('manifest.json이 없습니다.');
    snapshot = JSON.parse(new TextDecoder().decode(manifest));
    for (const [path, data] of files) {
      if (path !== 'manifest.json') blobs.set(path.slice(6), new Blob([data]));
    }
  } else snapshot = JSON.parse(new TextDecoder().decode(buffer));
  validateSnapshot(snapshot, target);
  const expectedMedia = new Set(snapshot.mediaRefs.map((ref) => ref.sha256));
  if (blobs.size !== expectedMedia.size || [...blobs.keys()].some((hash) => !expectedMedia.has(hash))) {
    throw new Error('백업 파일의 사진 목록이 일치하지 않습니다.');
  }
  const candidate = await normalizeCandidate(snapshot, target, (ref) => {
    const blob = blobs.get(ref.sha256);
    return blob ? new Blob([blob], { type: ref.type }) : undefined;
  }, 'file');
  return arbitrateSharedLink(candidate);
}

const sharedLinkKey = 'magic-performance-link:v1:release-hitsuzen:personal';
export function validSharedLink(raw) {
  try {
    const value = JSON.parse(raw);
    return value?.version === 1 && Number.isInteger(value.days) && value.days >= 0 && value.days <= 100000 &&
        Number.isFinite(value.updatedAt) && value.updatedAt >= 0
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function arbitrateSharedLink(candidate, snapshots = []) {
  if (!['zz2', 'zz3'].includes(candidate.snapshot.appId)) return candidate;
  const options = [candidate.snapshot, ...snapshots].map((snapshot) => ({
    snapshot,
    raw: entriesObject(snapshot.rawEntries)[sharedLinkKey],
  })).map((option) => ({ ...option, value: validSharedLink(option.raw) })).filter((option) => option.value);
  // Stable ties keep this candidate's original value; only a strictly newer valid timestamp wins.
  options.sort((a, b) => b.value.updatedAt - a.value.updatedAt);
  const selected = options[0], old = candidate.rawEntries[sharedLinkKey];
  if (!selected) {
    if (old === undefined) return candidate;
    return {
      ...candidate,
      entries: candidate.entries.map((entry) =>
        entry.sourceKey === sharedLinkKey ? { ...entry, targetKey: null, archive: true } : entry
      ),
      warnings: [...candidate.warnings, '손상된 RELEASE·HITSUZEN 연동값은 보관만 합니다.'],
    };
  }
  if (selected.raw === old) return candidate;
  const rawEntries = { ...candidate.rawEntries, [sharedLinkKey]: selected.raw };
  const snapshot = {
    ...candidate.snapshot,
    rawEntries,
    counts: { ...candidate.snapshot.counts, rawEntries: Object.keys(rawEntries).length },
    importedFrom: [candidate.snapshot.contentHash, selected.snapshot.contentHash],
  };
  snapshot.contentHash = await contentHash(snapshot);
  snapshot.snapshotId = `${snapshot.appId}:${snapshot.contentHash}`;
  const entries = candidate.entries.filter((entry) => entry.sourceKey !== sharedLinkKey);
  if (old !== undefined) {
    entries.push({ sourceKey: sharedLinkKey, targetKey: null, value: old, archive: true });
  }
  entries.push({
    sourceKey: sharedLinkKey,
    targetKey: 'magic-performance-link:v1:release-hitsuzen:shared',
    value: selected.raw,
    archive: false,
  });
  return {
    ...candidate,
    snapshot,
    snapshotId: snapshot.snapshotId,
    contentHash: snapshot.contentHash,
    rawEntries,
    entries,
    warnings: [...candidate.warnings, 'RELEASE·HITSUZEN 연동값은 유효한 최신 updatedAt 백업을 사용합니다.'],
  };
}

// Match A's readEntries and RELEASE session.js: only a falsey/invalid parsed
// personal value allows the older public-key fallback. Keep every raw string.
export function releaseSettingsSource(entries) {
  let personal, legacy;
  try {
    personal = JSON.parse(entries['unlock-settings-personal-v2']);
  } catch {}
  if (personal) return 'unlock-settings-personal-v2';
  try {
    legacy = JSON.parse(entries['unlock-settings-v1']);
  } catch {}
  return legacy && typeof legacy === 'object' ? 'unlock-settings-v1' : undefined;
}
