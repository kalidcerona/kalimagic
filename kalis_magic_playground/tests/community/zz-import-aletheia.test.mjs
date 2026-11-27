import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { applyImport, previewImport } from '../../zz-import/apply.mjs';
import { contentHash, normalizeCandidate, sha256 } from '../../zz-import/data.mjs';
import { emptyPhotoSets } from '../../distribution-snapshots/aletheia/logic-photo-sets.js';
import { imageBlob } from '../fixtures/zz-domain-samples.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const target = 'aletheia';
const metaKey = 'aletheia.distribution.meta.v1';
const legacyKey = 'aletheia.distribution.custom12.v1';
const currentKey = 'aletheia.distribution.photoSets.v2';
const legacySlots = Array(12).fill(null);
legacySlots[4] = 'img_legacy';
const currentSets = emptyPhotoSets();
currentSets[2][11] = 'img_current';
const preset = (id, imageId) => ({
  id,
  name: id,
  mode: 'free',
  brushSize: 46,
  hiddenPercent: null,
  imageId,
  imageMime: 'image/png',
  updatedAt: 1,
});
const rawLegacy = JSON.stringify({ version: 1, imageIds: legacySlots });
const rawCurrent = JSON.stringify({ version: 2, sets: currentSets });
const rawMeta = JSON.stringify({
  version: 1,
  selectedId: 'p_selected',
  presets: [preset('p_selected', 'img_selected'), preset('p_other', 'img_other')],
});

async function candidateFor(rawEntries, blobs) {
  const mediaRefs = await Promise.all(
    Object.entries(blobs).map(async ([key, blob]) => ({
      db: 'aletheia',
      store: 'images',
      key,
      type: blob.type,
      size: blob.size,
      sha256: await sha256(blob),
      valueShape: 'record',
      recordMeta: { savedAt: 1 },
    })),
  );
  const snapshot = {
    schemaVersion: 1,
    appId: 'zz5',
    buildId: 'fixture',
    snapshotId: 'zz5:test',
    sourceOrigin: 'https://example.test',
    sourcePath: '/zz5/',
    createdAt: '2026-11-27T00:00:00Z',
    rawEntries,
    mediaRefs,
    counts: { rawEntries: Object.keys(rawEntries).length, mediaRefs: mediaRefs.length },
  };
  snapshot.contentHash = await contentHash(snapshot);
  return normalizeCandidate(snapshot, target, (ref) => blobs[ref.key], 'raw');
}

function fixture() {
  const values = new Map([['aletheia.distribution.cellGuide.v1', 'before']]);
  const state = new Map(), media = new Map(), writes = [];
  const store = {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      writes.push(key);
      if (value === null) values.delete(key);
      else values.set(key, value);
    },
    stateGet: async (key) => structuredClone(state.get(key)),
    statePut: async (key, value) => state.set(key, structuredClone(value)),
    readMedia: async (item) => media.get(item.ref.key),
    writeMedia: async (item) => {
      writes.push(item.ref.key);
      media.set(item.ref.key, item.value);
    },
  };
  return { store, values, state, media, writes };
}

test('ALETHEIA missing legacy slot and selected preset photos block all destination writes', async () => {
  const { store, state, writes } = fixture();
  const candidate = await candidateFor(
    { 'aletheia.custom12.v1': rawLegacy, 'aletheia.meta.v1': rawMeta },
    {},
  );
  const preview = await previewImport(target, candidate, { store });
  assert.deepEqual(preview.invalid.map(({ key }) => key), [legacyKey, metaKey]);
  assert.equal(preview.counts.incoming.slots, 12);
  assert.equal(preview.counts.incoming.photos, 0);
  await assert.rejects(
    applyImport(target, candidate, { store, expectedRevision: preview.revision }),
    /복구용/,
  );
  assert.deepEqual(writes, []);
  assert.deepEqual([...state.keys()], [`recovery:${target}:${candidate.contentHash}`]);
});

test('ALETHEIA rejects empty current slot photos and missing unselected preset photos', async () => {
  const { store, state, writes } = fixture();
  const candidate = await candidateFor({ 'aletheia.photoSets.v2': rawCurrent, 'aletheia.meta.v1': rawMeta }, {
    img_current: new Blob([], { type: 'image/png' }),
    img_selected: imageBlob(),
  });
  const preview = await previewImport(target, candidate, { store });
  assert.deepEqual(preview.invalid.map(({ key }) => key), [currentKey, metaKey]);
  await assert.rejects(
    applyImport(target, candidate, { store, expectedRevision: preview.revision }),
    /복구용/,
  );
  assert.deepEqual(writes, []);
  assert.deepEqual([...state.keys()], [`recovery:${target}:${candidate.contentHash}`]);
});

for (const current of [false, true]) {
  test(`ALETHEIA restores complete ${current ? 'current' : 'legacy'} slots and preset photos`, async () => {
    const { store, values, media, state } = fixture();
    const raw = { 'aletheia.custom12.v1': rawLegacy, 'aletheia.meta.v1': rawMeta };
    // Real upgrades retain the superseded legacy key even after its images have been removed.
    if (current) raw['aletheia.photoSets.v2'] = rawCurrent;
    const photos = {
      [current ? 'img_current' : 'img_legacy']: imageBlob(),
      img_selected: imageBlob(),
      img_other: imageBlob(),
    };
    const candidate = await candidateFor(raw, photos);
    const preview = await previewImport(target, candidate, { store });
    assert.deepEqual(preview.invalid, []);
    assert.equal(preview.counts.incoming.slots, current ? 36 : 12);
    assert.equal(preview.counts.incoming.photos, 3);
    const receipt = await applyImport(target, candidate, { store, expectedRevision: preview.revision });
    assert.equal(receipt.verified, true);
    assert.deepEqual(state.get(`receipt:${target}:${candidate.contentHash}`), receipt);
    assert.equal(values.get(legacyKey), rawLegacy);
    assert.equal(values.get(metaKey), rawMeta);
    assert.equal(values.get(currentKey), current ? rawCurrent : undefined);
    assert.deepEqual([...media.keys()], Object.keys(photos));
    for (const [key, blob] of Object.entries(photos)) {
      assert.equal(await sha256(media.get(key).blob), await sha256(blob));
      assert.equal(media.get(key).savedAt, 1);
    }
  });
}
