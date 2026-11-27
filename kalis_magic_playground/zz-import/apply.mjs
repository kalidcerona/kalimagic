import { validateProfile } from './apply-validate.mjs';
import { TARGETS } from './data.mjs';
import { browserStore } from './apply-store.mjs';
export function countValues(entries, media = []) {
  const hasCurrentPhotoSets = entries.some(([key, raw]) =>
    key === 'aletheia.distribution.photoSets.v2' && raw !== null
  );
  const counts = {
    settings: entries.filter(([, raw]) => raw !== null).length,
    lists: 0,
    groups: 0,
    records: 0,
    photos: media.filter((item) => item.value !== undefined).length,
    items: 0,
    slots: 0,
  };
  for (const [key, raw] of entries) {
    if (raw === null || key.endsWith('.store.backup') || key.endsWith('-preserved-raw')) continue;
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object') continue;
      if (key === 'friend-uramichi.web.presets') {
        const categories = Array.isArray(value) ? value : value.categories || [];
        counts.groups += categories.length;
        counts.items += categories.reduce((n, c) => n + (c.entries?.length || 0), 0);
        continue;
      }
      if (Array.isArray(value)) {
        if (/_named_presets_v1$|_seq_slots$/.test(key)) counts.slots += value.length;
        else if (/recent|performance-log/.test(key)) counts.records += value.length;
        continue;
      }
      counts.lists += Array.isArray(value.presets) ? value.presets.length : 0;
      counts.items += Array.isArray(value.presets)
        ? value.presets.reduce((n, p) => n + (p.items?.length || 0), 0)
        : 0;
      counts.groups += Array.isArray(value.sets) ? value.sets.length : 0;
      if (key.endsWith('photoSets.v2')) {
        counts.slots += value.sets?.reduce((n, set) => n + set.length, 0) || 0;
      }
      if (
        key === 'aletheia.distribution.custom12.v1' && !hasCurrentPhotoSets && Array.isArray(value.imageIds)
      ) {
        counts.slots += value.imageIds.length;
      }
      if (Array.isArray(value.names)) counts.items += value.names.length;
      counts.records += ['history', 'records', 'dummyNotes', 'recent'].reduce(
        (n, field) => n + (Array.isArray(value[field]) ? value[field].length : 0),
        0,
      );
      if (key === 'friend-memdeck-v1') {
        counts.groups += Object.keys(value.stacks || {}).length;
        counts.items += Object.values(value.stacks || {}).reduce((n, stack) => n + stack.length, 0);
        counts.records += Object.values(value.progress || {}).reduce(
          (n, progress) => n + (progress.history?.length || 0) + (progress.rankHistory?.length || 0),
          0,
        );
      }
    } catch { /* Exact malformed strings remain in the durable recovery record. */ }
  }
  return counts;
}

async function digest(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((n) =>
    n.toString(16).padStart(2, '0')
  ).join('');
}
async function mediaDigest(value) {
  const blob = value instanceof Blob ? value : value?.blob;
  if (!blob) return value === undefined ? null : digest(value);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((n) =>
    n.toString(16).padStart(2, '0')
  ).join('');
  return digest([
    hash,
    blob.type,
    value instanceof Blob
      ? null
      : Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'blob')),
  ]);
}
function environment(options) {
  return options.store || browserStore;
}
function mappedEntries(candidate) {
  if (!candidate?.contentHash || !Array.isArray(candidate.entries)) {
    throw new Error('검증된 이전 데이터가 필요합니다.');
  }
  const entries = candidate.entries.filter((entry) => entry.targetKey && !entry.archive).map(
    (entry) => [entry.targetKey, entry.value],
  );
  const values = new Map(entries);
  for (const [key, value] of entries) {
    if (!/^friend-kairos(?:-classic)?-legacy_/.test(key)) continue;
    const modern = key.replace('-legacy_', '_');
    if (!values.has(modern) || values.get(modern) === '') values.set(modern, value);
  }
  return [...values];
}
async function capture(candidate, store, target) {
  const keys = new Set([
    ...Object.values(TARGETS[target]?.keys || {}).filter(Boolean),
    ...mappedEntries(candidate).map(([key]) => key),
  ]);
  const entries = [...keys].map((key) => [key, store.get(key)]);
  const media = [];
  for (const item of candidate.media || []) media.push({ ...item, value: await store.readMedia(item) });
  if (store.readAllMedia) {
    for (const config of TARGETS[target]?.media || []) {
      for (const item of await store.readAllMedia(config)) {
        if (!media.some((old) => mediaKey(old) === mediaKey(item))) media.push(item);
      }
    }
  }
  return { entries, media };
}
function mediaKey(item) {
  return JSON.stringify([item.targetDb, item.targetStore, item.ref.key]);
}
async function revision(profile) {
  return digest({
    entries: profile.entries,
    media: await Promise.all(
      profile.media.map(
        async (item) => [item.targetDb, item.targetStore, item.ref.key, await mediaDigest(item.value)],
      ),
    ),
  });
}
async function serialized(target, options, task) {
  if (options.store) return task();
  if (!globalThis.navigator?.locks) {
    throw new Error('안전한 가져오기를 지원하는 최신 브라우저에서 다시 시도해 주세요.');
  }
  return navigator.locks.request(`zz-import:${target}`, { mode: 'exclusive' }, task);
}
async function completedReceipt(target, hash, store) {
  const receipt = await store.stateGet(`receipt:${target}:${hash}`);
  if (receipt) return receipt;
  const journal = await store.stateGet(`journal:${target}`);
  if (journal?.status === 'complete' && journal.receipt?.contentHash === hash) return journal.receipt;
  return store.readBackupReceipt?.(target, hash);
}

export async function pendingCandidates(target, candidates, options = {}) {
  const store = environment(options);
  const pending = [];
  for (const candidate of candidates) {
    if (!await completedReceipt(target, candidate.contentHash, store)) pending.push(candidate);
  }
  return pending;
}

export async function previewImport(target, candidate, options = {}) {
  const store = environment(options),
    current = await capture(candidate, store, target),
    incoming = mappedEntries(candidate);
  const conflicts = incoming.filter(([key, value]) => store.get(key) !== null && store.get(key) !== value)
    .map(([key]) => key);
  const mediaConflicts = [];
  for (let i = 0; i < (candidate.media || []).length; i++) {
    if (
      current.media[i].value !== undefined &&
      await mediaDigest(current.media[i].value) !== await mediaDigest(candidate.media[i].value)
    ) mediaConflicts.push(candidate.media[i].ref.key);
  }
  const alreadyImported = !!await completedReceipt(target, candidate.contentHash, store);
  const invalid = await validateProfile(target, { entries: incoming, media: candidate.media || [] }, options);
  return {
    existingEntries: current.entries,
    incomingEntries: incoming,
    invalid,
    alreadyImported,
    target,
    revision: await revision(current),
    conflicts,
    mediaConflicts,
    counts: {
      existing: countValues(current.entries.filter(([, value]) => value !== null), current.media),
      incoming: countValues(incoming, candidate.media),
      archive: candidate.entries.filter((entry) => entry.archive || !entry.targetKey).length,
      archiveSettings: candidate.entries.filter((entry) => entry.archive || !entry.targetKey).length,
      archiveRecords: countValues(
        candidate.entries.filter((entry) => entry.archive || !entry.targetKey).map(
          (entry) => [entry.sourceKey || '', entry.value],
        ),
      ).records,
    },
    profiles: ['public', 'zz'],
    completed: alreadyImported,
  };
}
async function writeProfile(profile, store, journal) {
  for (let i = 0; i < profile.media.length; i++) {
    await store.writeMedia(profile.media[i]);
    if (journal) {
      journal.step = `media:${i}`;
      await store.statePut(`journal:${journal.target}`, journal);
    }
  }
  for (let i = 0; i < profile.entries.length; i++) {
    const [key, value] = profile.entries[i];
    store.set(key, value);
    if (journal) {
      journal.step = `entry:${i}`;
      await store.statePut(`journal:${journal.target}`, journal);
    }
  }
}
async function verifyProfile(profile, store) {
  for (const [key, value] of profile.entries) {
    if (store.get(key) !== value) throw new Error(`설정 검증 실패: ${key}`);
  }
  for (const item of profile.media) {
    if (await mediaDigest(await store.readMedia(item)) !== await mediaDigest(item.value)) {
      throw new Error('사진 검증에 실패했습니다.');
    }
  }
}
async function recover(target, store) {
  const journal = await store.stateGet(`journal:${target}`);
  if (journal?.status === 'complete' && journal.receipt) {
    await store.statePut(`receipt:${target}:${journal.receipt.contentHash}`, journal.receipt);
  }
  if (!journal || journal.status === 'complete' || journal.status === 'rolled-back') {
    return { recovered: false };
  }
  // Always roll back an interrupted transaction before the app can read mixed state.
  await writeProfile(journal.before, store);
  await verifyProfile(journal.before, store);
  if (Object.hasOwn(journal, 'previousResume')) {
    await store.statePut(`resume:${target}`, journal.previousResume);
  }
  if (journal.previousProfiles !== undefined) {
    await store.statePut(`profiles:${target}`, journal.previousProfiles);
  }
  await store.statePut(`journal:${target}`, { ...journal, status: 'rolled-back' });
  return { recovered: true };
}
export async function recoverImport(target, options = {}) {
  const store = environment(options);
  const journal = await store.stateGet(`journal:${target}`);
  if (!journal || ['complete', 'rolled-back'].includes(journal.status)) return { recovered: false };
  await options.beforeRecover?.();
  return serialized(target, options, () => recover(target, store));
}
export async function applyImport(target, candidate, options = {}) {
  const store = environment(options);
  return serialized(target, options, async () => {
    await recover(target, store);
    const receiptKey = `receipt:${target}:${candidate.contentHash}`;
    const receipt = await completedReceipt(target, candidate.contentHash, store);
    if (receipt) return { ...receipt, duplicate: true };
    const invalid = await validateProfile(target, {
      entries: mappedEntries(candidate),
      media: candidate.media || [],
    }, options);
    if (invalid.length) {
      await store.statePut(`recovery:${target}:${candidate.contentHash}`, { candidate, invalid });
      throw new Error(
        `손상된 데이터는 복구용으로 보관했습니다. 가져오지 않았습니다: ${
          invalid.map((item) => item.key).join(', ')
        }`,
      );
    }
    const before = await capture(candidate, store, target);
    if (!options.expectedRevision || options.expectedRevision !== await revision(before)) {
      throw new Error('공개 데이터가 변경되었습니다. 미리보기를 다시 열어 주세요.');
    }
    const sourceEntries = new Map(mappedEntries(candidate));
    const incoming = {
      entries: before.entries.map(([key]) => [key, sourceEntries.has(key) ? sourceEntries.get(key) : null]),
      media: before.media.map((old) =>
        (candidate.media || []).find((item) => mediaKey(item) === mediaKey(old)) ||
        { ...old, value: undefined }
      ),
    };
    const { mergeUramichiEntries, mergeValue } = await import('./apply-merge.mjs');
    const merged = {
      entries: target === 'uramichi'
        ? mergeUramichiEntries(before.entries, incoming.entries, candidate.contentHash)
        : incoming.entries.map((
          [key, value],
        ) => [
          key,
          value === null ? store.get(key) : mergeValue(key, store.get(key), value, candidate.contentHash),
        ]),
      media: incoming.media.map((item, i) => before.media[i].value === undefined ? item : before.media[i]),
    };
    if (target === 'choice') {
      const photoMap = new Map();
      for (let i = 0; i < incoming.media.length; i++) {
        const item = incoming.media[i], old = before.media[i];
        if (
          item.value === undefined || old.value === undefined ||
          await mediaDigest(item.value) === await mediaDigest(old.value)
        ) continue;
        const original = String(item.ref.key);
        if (!original.startsWith('w_')) continue; // 'current' is a single-background profile value.
        const key = `w_zz_${candidate.contentHash.slice(0, 12)}_${i}`;
        photoMap.set(original, key);
        photoMap.set(original.slice(2), key.slice(2));
        const copy = { ...item, ref: { ...item.ref, key } };
        merged.media.push(copy);
        before.media.push({ ...copy, value: await store.readMedia(copy) });
        incoming.media.push({ ...copy, value: undefined });
      }
      if (photoMap.size) {
        const rewrite = (value, field = '') =>
          typeof value === 'string'
            ? (/wallpaper|image|photo/i.test(field) ? (photoMap.get(value) ?? value) : value)
            : Array.isArray(value)
            ? value.map((child) => rewrite(child, field))
            : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child, key)]))
            : value;
        merged.entries = incoming.entries.map(([key, value]) => {
          let mapped = value;
          try {
            mapped = JSON.stringify(rewrite(JSON.parse(value)));
          } catch { /* Retain exact non-JSON strings. */ }
          return [
            key,
            value === null ? store.get(key) : mergeValue(key, store.get(key), mapped, candidate.contentHash),
          ];
        });
      }
    }
    const after = options.activate === 'zz' ? incoming : merged;
    const previousProfiles = await store.stateGet(`profiles:${target}`);
    if (previousProfiles) {
      await store.statePut(`profiles:${target}:${previousProfiles.contentHash}`, previousProfiles);
    }
    const journal = {
      target,
      contentHash: candidate.contentHash,
      status: 'prepared',
      step: 'prepared',
      before,
      after,
      previousProfiles: previousProfiles || null,
      previousResume: target === 'tyche' ? await store.stateGet(`resume:${target}`) || null : null,
    };
    // A successful journal commit is mandatory before any destination writes.
    await store.statePut(`journal:${target}`, journal);
    await store.statePut(`profiles:${target}`, {
      public: before,
      zz: incoming,
      merged,
      active: options.activate === 'zz' ? 'zz' : 'merged',
      contentHash: candidate.contentHash,
      archive: candidate.entries.filter((entry) => entry.archive || !entry.targetKey),
      snapshot: candidate.snapshot,
    });
    try {
      await writeProfile(after, store, journal);
      await verifyProfile(after, store);
      const nativeErrors = await validateProfile(target, {
        ...after,
        entries: after.entries.map(([key]) => [key, store.get(key)]),
      }, options);
      if (nativeErrors.length) throw new Error('앱 읽기 검증에 실패했습니다.');
      if (options.verify) await options.verify(after);
      const result = {
        target,
        contentHash: candidate.contentHash,
        completedAt: new Date().toISOString(),
        counts: countValues(after.entries.filter(([, value]) => value !== null), after.media),
        verified: true,
      };
      if (target === 'tyche') {
        await store.statePut(`resume:${target}`, {
          token: crypto.randomUUID(),
          contentHash: candidate.contentHash,
        });
      }
      // Receipt and completed marker share a single record boundary: receipt is only
      // consulted after recovery, so a crash here cannot skip restoration.
      await store.statePut(`journal:${target}`, { ...journal, status: 'complete', receipt: result });
      try {
        await store.statePut(receiptKey, result);
      } catch { /* The completed journal already holds the durable receipt. */ }
      return result;
    } catch (error) {
      try {
        await recover(target, store);
      } catch (cause) {
        throw new Error('복구를 마치지 못했습니다. 앱을 다시 열어 주세요.', { cause });
      }
      throw error;
    }
  });
}
export async function listProfiles(target, options = {}) {
  const saved = await environment(options).stateGet(`profiles:${target}`);
  if (!saved) return [];
  return [{ id: 'public', label: '기존 공개본' }, { id: 'zz', label: '이전 ZZ본' }, {
    id: 'merged',
    label: '둘 다 보관한 공개본',
  }].map((item) => ({ ...item, active: saved.active === item.id, contentHash: saved.contentHash }));
}
// Read-only inspection/export. Blobs stay in durable storage and are not JSON encoded.
export async function readImportDetails(target, options = {}) {
  const store = environment(options);
  let saved = await store.stateGet(`profiles:${target}`);
  if (options.contentHash && saved?.contentHash !== options.contentHash) {
    saved = await store.stateGet(`profiles:${target}:${options.contentHash}`);
  }
  if (!saved) return null;
  const archive = saved.archive || [];
  const profiles = {};
  for (const id of ['public', 'zz', 'merged']) {
    if (saved[id]) {
      profiles[id] = {
        entries: saved[id].entries,
        counts: countValues(saved[id].entries.filter(([, value]) => value !== null), saved[id].media),
        mediaRefs: (saved[id].media || []).filter((item) => item.value !== undefined).map((item) => ({
          db: item.targetDb,
          store: item.targetStore,
          key: item.ref.key,
          source: item.ref,
        })),
      };
    }
  }
  return structuredClone({
    schemaVersion: 1,
    target,
    contentHash: saved.contentHash,
    active: saved.active,
    imagesIncluded: false,
    snapshot: saved.snapshot,
    profiles,
    archive,
    archiveCounts: {
      settings: archive.length,
      records: countValues(archive.map((entry) => [entry.sourceKey || '', entry.value])).records,
    },
  });
}
export async function activateProfile(target, id, options = {}) {
  if (!['public', 'zz', 'merged'].includes(id)) throw new Error('알 수 없는 프로필입니다.');
  const store = environment(options);
  return serialized(target, options, async () => {
    await recover(target, store);
    const saved = await store.stateGet(`profiles:${target}`);
    if (!saved?.[id]) throw new Error('저장된 프로필이 없습니다.');
    if (saved.active === id) return { active: id };
    const desired = structuredClone(saved[id]);
    if ((await validateProfile(target, desired, options)).length) {
      throw new Error('손상된 프로필은 복구용으로만 보관하며 활성화할 수 없습니다.');
    }
    const before = { entries: desired.entries.map(([key]) => [key, store.get(key)]), media: [] };
    for (const item of desired.media) before.media.push({ ...item, value: await store.readMedia(item) });
    if (store.readAllMedia) {
      for (const config of TARGETS[target]?.media || []) {
        for (const item of await store.readAllMedia(config)) {
          if (
            !before.media.some((old) => mediaKey(old) === mediaKey(item))
          ) {
            before.media.push(item);
            desired.media.push({ ...item, value: undefined });
          }
        }
      }
    }
    await store.statePut(`profile-edit:${target}:${saved.active}:${await revision(before)}`, before);
    const journal = {
      target,
      before,
      after: desired,
      status: 'prepared',
      step: 'prepared',
      previousProfiles: saved,
      previousResume: target === 'tyche' ? await store.stateGet(`resume:${target}`) || null : null,
    };
    await store.statePut(`journal:${target}`, journal);
    try {
      await writeProfile(desired, store, journal);
      await verifyProfile(desired, store);
      if (
        (await validateProfile(target, {
          ...desired,
          entries: desired.entries.map(([key]) => [key, store.get(key)]),
        }, options)).length
      ) throw new Error('앱 읽기 검증에 실패했습니다.');
      if (options.verify) await options.verify(desired);
      // Save edits to the departing profile before switching, without losing the
      // immutable original kept in profile-edit history above.
      await store.statePut(`profiles:${target}`, { ...saved, [saved.active]: before, active: id });
      if (target === 'tyche') {
        await store.statePut(`resume:${target}`, {
          token: crypto.randomUUID(),
          contentHash: saved.contentHash,
        });
      }
      await store.statePut(`journal:${target}`, { ...journal, status: 'complete' });
    } catch (error) {
      await recover(target, store);
      throw error;
    }
    return { active: id };
  });
}

export async function readResume(target, options = {}) {
  return environment(options).stateGet(`resume:${target}`);
}
export async function acknowledgeResume(target, token, options = {}) {
  const store = environment(options);
  return serialized(target, options, async () => {
    const current = await store.stateGet(`resume:${target}`);
    if (current?.token === token) await store.statePut(`resume:${target}`, null);
  });
}
