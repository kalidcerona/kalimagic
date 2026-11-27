import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  contentHash,
  discoverSources,
  mapKey,
  normalizeCandidate,
  readImportFile,
  TARGETS,
  validateSnapshot,
} from './data.mjs';
import { readZip } from './data-zip.mjs';
globalThis.crypto ??= webcrypto;
const origin = 'https://kalimagic.netlify.app';
async function fixture(target, rawEntries, mediaRefs = []) {
  const appId = TARGETS[target].appId;
  const s = {
    schemaVersion: 1,
    appId,
    sourceOrigin: origin,
    sourcePath: `/${appId}/`,
    buildId: 'contract-v1',
    snapshotId: 'fixture',
    createdAt: '2026-11-27T00:00:00.000Z',
    rawEntries,
    mediaRefs,
    counts: { rawEntries: Object.keys(rawEntries).length, mediaRefs: mediaRefs.length },
  };
  s.contentHash = await contentHash(s);
  return s;
}
test('15 destinations map all source IDs without ZZ9', () => {
  assert.equal(Object.keys(TARGETS).length, 15);
  assert.equal(new Set(Object.values(TARGETS).map((x) => x.appId)).size, 14);
  assert.equal(mapKey('kairos', 'stopwatch_preset_cs'), 'friend-kairos_preset_cs');
  assert.equal(mapKey('kairos-classic', 'stopwatch2_text_at'), 'friend-kairos-classic-legacy_text_at');
  assert.equal(mapKey('release', 'authorization'), undefined);
  assert.equal(
    mapKey('arosaegida', 'first-settings-guide:v1:arosaegida:/zz13'),
    'first-settings-guide:v1:arosaegida:/tools/arosaegida',
  );
});
test('A hash contract and exact empty/malformed strings survive', async () => {
  const s = await fixture('memdeck', { 'magic-memdeck-v1': '{broken', 'magic-memdeck-v1-preserved-raw': '' });
  const candidate = await normalizeCandidate(s, 'memdeck', () => null);
  assert.equal(candidate.rawEntries['magic-memdeck-v1'], '{broken');
  assert.equal(candidate.rawEntries['magic-memdeck-v1-preserved-raw'], '');
  assert.equal(candidate.contentHash, await contentHash(s));
  const file = new Blob([JSON.stringify(s)]);
  assert.equal((await readImportFile(file, 'memdeck')).contentHash, s.contentHash);
});
test('reject unknown version/app/path/key and changed content', async () => {
  const s = await fixture('alter', { 'alter-settings': '{}' });
  for (
    const mutation of [{ schemaVersion: 2 }, { appId: 'zz9' }, { sourcePath: '/admin/' }, {
      rawEntries: { token: 'secret' },
    }]
  ) assert.throws(() => validateSnapshot({ ...s, ...mutation }, 'alter'));
  await assert.rejects(
    normalizeCandidate({ ...s, rawEntries: { 'alter-settings': 'changed' } }, 'alter', () => null),
  );
});
test('four photo mappings retain Blob and wrapped metadata, missing data rejected', async () => {
  for (const target of ['release', 'choice', 'aletheia', 'tobira']) {
    const { sha256 } = await import('./data.mjs');
    const blob = new Blob(['image'], { type: 'image/png' });
    const m = TARGETS[target].media[0];
    const ref = {
      db: m.db,
      store: m.store,
      key: ({ release: 'lock', choice: 'current', aletheia: 'img_fixture', tobira: 'wallpaper' })[target],
      type: blob.type,
      size: blob.size,
      sha256: await sha256(blob),
      recordMeta: target === 'aletheia' ? { savedAt: 13 } : {},
      valueShape: target === 'aletheia' ? 'record' : 'blob',
    };
    const s = await fixture(target, {}, [ref]);
    const c = await normalizeCandidate(s, target, () => blob);
    assert.equal(c.media[0].targetDb, m.targetDb);
    assert.equal(c.media[0].value instanceof Blob, target !== 'aletheia');
    if (target === 'aletheia') assert.equal(c.media[0].value.savedAt, 13);
    await assert.rejects(normalizeCandidate(s, target, () => null));
  }
});
test('shared-only data does not imply private ownership; read failure is reported', async () => {
  const makeStorage = (entries) => ({
    length: Object.keys(entries).length,
    key: (i) => Object.keys(entries)[i],
    getItem: (k) => entries[k],
  });
  const idb = { databases: async () => [] };
  assert.equal(
    (await discoverSources('hitsuzen', {
      storage: makeStorage({ 'magic-calc-skin': 'dark' }),
      indexedDB: idb,
      origin,
    })).candidates.length,
    0,
  );
  assert.equal(
    (await discoverSources('alter', {
      storage: makeStorage({ 'alter-settings': '{}' }),
      indexedDB: idb,
      origin,
    })).candidates.length,
    1,
  );
  const result = await discoverSources('alter', {
    storage: {
      get length() {
        throw Error('denied');
      },
    },
    indexedDB: idb,
    origin,
  });
  assert.equal(result.candidates.length, 0);
  assert.match(result.warnings[0], /denied/);
});
test('truncated ZIP rejected before any storage writes', async () => {
  await assert.rejects(readZip(new Uint8Array([80, 75, 3, 4]).buffer));
});
test('shared-link selects latest valid A snapshot, retains superseded raw and destination mapping', async () => {
  const { arbitrateSharedLink } = await import('./data.mjs');
  const key = 'magic-performance-link:v1:release-hitsuzen:personal';
  const link = (days, updatedAt) => JSON.stringify({ version: 1, days, updatedAt });
  const own = await fixture('release', { [key]: link(3, 10) }),
    peer = await fixture('hitsuzen', { [key]: link(5, 20) }),
    bad = await fixture('hitsuzen', { [key]: link(-2, 30) });
  const candidate = await normalizeCandidate(own, 'release', () => null);
  const selected = await arbitrateSharedLink(candidate, [peer, bad]);
  assert.equal(JSON.parse(selected.rawEntries[key]).days, 5);
  assert.equal(selected.entries.filter((e) => e.targetKey).length, 1);
  assert.equal(selected.entries.find((e) => e.archive).value, link(3, 10));
  assert.equal(selected.snapshot.contentHash, await contentHash(selected.snapshot));
  assert.equal((await arbitrateSharedLink(selected, [own, peer])).contentHash, selected.contentHash);
  const corrupt = await normalizeCandidate(
    await fixture('hitsuzen', { [key]: 'broken' }),
    'hitsuzen',
    () => null,
  );
  assert.equal((await arbitrateSharedLink(corrupt, [])).entries[0].archive, true);
});
test('counts, photo representation, and unsupported JSON media files fail closed', async () => {
  const s = await fixture('alter', { 'alter-settings': '{}' });
  assert.throws(() => validateSnapshot({ ...s, counts: { rawEntries: 2, mediaRefs: 0 } }, 'alter'));
  const bad = await fixture('release', {}, [{
    db: 'unlock-images-personal',
    store: 'images',
    key: 'lock',
    type: 'image/png',
    size: 1,
    sha256: '0'.repeat(64),
    recordMeta: {},
    valueShape: 'executable',
  }]);
  assert.throws(() => validateSnapshot(bad, 'release'));
  bad.mediaRefs[0].valueShape = 'blob';
  bad.contentHash = await contentHash(bad);
  await assert.rejects(readImportFile(new Blob([JSON.stringify(bad)]), 'release'));
});
test('media keys and record shapes match native formats, including legacy wallpaper/metadata', async () => {
  const { validMediaRef } = await import('./data.mjs');
  for (
    const [target, keys] of [
      ['release', ['lock', 'unlock', 'home2']],
      ['choice', ['current', 'w_old-id_1']],
      ['aletheia', ['img_old-id_1']],
      ['tobira', ['coin:preset-default', 'wallpaper', 'wallpaper:original']],
    ]
  ) {
    for (const key of keys) {
      const ref = { key, recordMeta: {}, valueShape: target === 'aletheia' ? 'record' : 'blob' };
      assert.equal(validMediaRef(target, ref), true, `${target}/${key}`);
      assert.equal(
        validMediaRef(target, { ...ref, valueShape: ref.valueShape === 'blob' ? 'record' : 'blob' }),
        false,
      );
      assert.equal(validMediaRef(target, { ...ref, recordMeta: { foreign: 'row' } }), false);
      assert.equal(validMediaRef(target, { ...ref, key: 'foreign-row' }), false);
    }
  }
  assert.equal(
    validMediaRef('aletheia', { key: 'img_legacy', recordMeta: { savedAt: 0 }, valueShape: 'record' }),
    true,
  );
  assert.equal(
    validMediaRef('aletheia', { key: 'img_legacy', recordMeta: { savedAt: '0' }, valueShape: 'record' }),
    false,
  );
  assert.equal(
    validMediaRef('choice', { key: 'w_' + 'x'.repeat(41), recordMeta: {}, valueShape: 'blob' }),
    false,
  );
});
test('duplicate media IDs reject but repeated asset hashes with distinct native IDs are valid', async () => {
  const { sha256 } = await import('./data.mjs');
  const blob = new Blob(['image'], { type: 'image/png' });
  const ref = {
    db: 'unlock-images-personal',
    store: 'images',
    key: 'lock',
    type: blob.type,
    size: blob.size,
    sha256: await sha256(blob),
    recordMeta: {},
    valueShape: 'blob',
  };
  const duplicate = await fixture('release', {}, [ref, ref]);
  assert.throws(() => validateSnapshot(duplicate, 'release'));
  const shared = await fixture('release', {}, [ref, { ...ref, key: 'unlock' }]);
  assert.equal((await normalizeCandidate(shared, 'release', () => blob)).media.length, 2);
});
test('oversized external file is rejected before reading bytes', async () => {
  let read = false;
  await assert.rejects(readImportFile({
    size: 256 * 1024 * 1024 + 1,
    arrayBuffer() {
      read = true;
      throw Error('unexpected read');
    },
  }, 'alter'));
  assert.equal(read, false);
});
test('raw fallback hashes ignore browser key insertion order', async () => {
  const idb = { databases: async () => [] },
    values = { 'alter-settings': '{}', 'alter-settings-gesture-guide-v1': '1' };
  const storage = (keys) => ({ length: keys.length, key: (i) => keys[i], getItem: (key) => values[key] });
  const left = await discoverSources('alter', {
    storage: storage(Object.keys(values)),
    indexedDB: idb,
    origin,
  });
  const right = await discoverSources('alter', {
    storage: storage(Object.keys(values).reverse()),
    indexedDB: idb,
    origin,
  });
  assert.equal(left.candidates[0].contentHash, right.candidates[0].contentHash);
});
test('RELEASE maps enabled appearance editor; alternate source path versions stay archived', async () => {
  const slash = `magic-appearance:v1:unlock:${origin}/zz2/`,
    bare = `magic-appearance:v1:unlock:${origin}/zz2`;
  const s = await fixture('release', { [bare]: '{"version":1}', [slash]: '{"version":2}' });
  const candidate = await normalizeCandidate(s, 'release', () => null);
  assert.equal(mapKey('release', slash, { origin }), `magic-appearance:v1:unlock:${origin}/tools/unlock/`);
  assert.equal(candidate.entries.find((entry) => entry.sourceKey === slash).archive, false);
  assert.equal(candidate.entries.find((entry) => entry.sourceKey === bare).archive, true);
  assert.equal(mapKey('choice', `magic-appearance:v1:choice:${origin}/zz4/`, { origin }), null);
});
test('appearance mapping agrees with public RELEASE native storageKey across routes', async () => {
  const { readFile } = await import('node:fs/promises'), { runInNewContext } = await import('node:vm');
  const context = {};
  runInNewContext(
    await readFile(new URL('../distribution-snapshots/unlock/settings-ui.js', import.meta.url), 'utf8'),
    context,
  );
  const previous = globalThis.location;
  try {
    for (const pathname of ['/tools/release', '/tools/release/', '/tools/release/index.html']) {
      globalThis.location = { origin: 'https://destination.example', pathname };
      assert.equal(context.MagicSettingsUI.customizationAllowed(pathname, undefined), true);
      assert.equal(
        mapKey('release', `magic-appearance:v1:unlock:${origin}/zz2/`, { origin }),
        context.MagicSettingsUI.storageKey('unlock', globalThis.location),
      );
    }
  } finally {
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  }
});
function storedZipFixture(entries) {
  const locals = [], central = [];
  let offset = 0;
  const header = (size, fields) => {
    const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
    for (const [at, width, value] of fields) view[width === 2 ? 'setUint16' : 'setUint32'](at, value, true);
    return bytes;
  };
  for (const [path, text] of entries) {
    const name = new TextEncoder().encode(path), data = new TextEncoder().encode(text);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = ~crc >>> 0;
    const local = header(30, [[0, 4, 0x04034b50], [4, 2, 20], [14, 4, crc], [18, 4, data.length], [
        22,
        4,
        data.length,
      ], [26, 2, name.length]]),
      dir = header(46, [
        [0, 4, 0x02014b50],
        [4, 2, 20],
        [6, 2, 20],
        [16, 4, crc],
        [20, 4, data.length],
        [24, 4, data.length],
        [28, 2, name.length],
        [42, 4, offset],
      ]);
    locals.push(local, name, data);
    central.push(dir, name);
    offset += local.length + name.length + data.length;
  }
  const size = central.reduce((sum, part) => sum + part.length, 0),
    end = header(22, [[0, 4, 0x06054b50], [8, 2, entries.length], [10, 2, entries.length], [12, 4, size], [
      16,
      4,
      offset,
    ]]);
  return new Blob([...locals, ...central, end]).arrayBuffer();
}
test('ZIP rejects duplicate assets, traversal and corrupt CRC while accepting the exact stored contract', async () => {
  const valid = await storedZipFixture([['manifest.json', '{}']]);
  assert.equal((await readZip(valid)).size, 1);
  await assert.rejects(readZip(await storedZipFixture([['manifest.json', '{}'], ['manifest.json', '{}']])));
  await assert.rejects(readZip(await storedZipFixture([['../manifest.json', '{}']])));
  const corrupt = valid.slice(0);
  new Uint8Array(corrupt)[43] ^= 1;
  await assert.rejects(readZip(corrupt));
});
test('A RELEASE fallback applies one settings value and archives malformed or superseded personal data', async () => {
  for (
    const [personal, fallback, expected] of [
      ['{"fontSize":2}', '{"fontSize":1}', 'unlock-settings-personal-v2'],
      ['{bad', '{"fontSize":1}', 'unlock-settings-v1'],
      ['null', '{}', 'unlock-settings-v1'],
      ['false', '{}', 'unlock-settings-v1'],
    ]
  ) {
    const raw = { 'unlock-settings-personal-v2': personal, 'unlock-settings-v1': fallback };
    const candidate = await normalizeCandidate(await fixture('release', raw), 'release', () => null);
    const active = candidate.entries.filter((entry) => !entry.archive);
    assert.equal(active.length, 1);
    assert.equal(active[0].sourceKey, expected);
    assert.equal(active[0].targetKey, 'unlock-settings-v1');
    assert.equal(candidate.entries.filter((entry) => entry.archive).length, 1);
    assert.deepEqual(candidate.rawEntries, raw);
  }
  const onlyFallback = await normalizeCandidate(
    await fixture('release', { 'unlock-settings-v1': '{}' }),
    'release',
    () => null,
  );
  assert.equal(onlyFallback.entries[0].archive, false);
  const empty = await normalizeCandidate(
    await fixture('release', { 'unlock-settings-personal-v2': '{bad', 'unlock-settings-v1': '{bad' }),
    'release',
    () => null,
  );
  assert.equal(empty.entries.filter((entry) => !entry.archive).length, 0);
  const storage = { length: 1, key: () => 'unlock-settings-v1', getItem: () => '{}' };
  assert.equal(
    (await discoverSources('release', { storage, indexedDB: { databases: async () => [] }, origin }))
      .candidates.length,
    0,
  );
});
test('A TYCHE immutable prelaunch state stays archived and latest v2 remains active', async () => {
  const raw = { 'zz11-spinner-state-v2-prelaunch': '{"turn":1}', 'zz11-spinner-state-v2': '{"turn":2}' };
  const candidate = await normalizeCandidate(await fixture('tyche', raw), 'tyche', () => null);
  assert.equal(candidate.entries.find((entry) => entry.sourceKey.endsWith('prelaunch')).archive, true);
  assert.equal(
    candidate.entries.find((entry) => entry.sourceKey === 'zz11-spinner-state-v2').value,
    '{"turn":2}',
  );
  assert.equal(candidate.entries.filter((entry) => !entry.archive).length, 1);
});
