import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { domainSamples } from './zz-domain-samples.mjs';
import { mapKey, sha256, TARGETS } from '../../zz-import/data.mjs';
import { activateProfile, applyImport, previewImport } from '../../zz-import/apply.mjs';
import { validateProfile } from '../../zz-import/apply-validate.mjs';
import * as QR from '../../distribution-snapshots/qr/core.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
for (const name of ['qrcodegen.js', 'jsQR.js']) {
  vm.runInThisContext(
    fs.readFileSync(new URL('../../distribution-snapshots/qr/vendor/' + name, import.meta.url), 'utf8'),
    { filename: name },
  );
}
const samples = domainSamples();
const mediaKey = (item) => JSON.stringify([item.targetDb, item.targetStore, item.ref.key]);
async function bytes(value) {
  const blob = value instanceof Blob ? value : value?.blob;
  return blob ? sha256(blob) : JSON.stringify(value);
}
function memoryStore() {
  const local = new Map(), media = new Map(), state = new Map();
  return {
    local,
    media,
    state,
    get: (key) => local.get(key) ?? null,
    set: (key, value) => value === null ? local.delete(key) : local.set(key, value),
    stateGet: async (key) => structuredClone(state.get(key)),
    statePut: async (key, value) => state.set(key, structuredClone(value)),
    readMedia: async (item) => media.get(mediaKey(item))?.value,
    writeMedia: async (item) =>
      item.value === undefined
        ? media.delete(mediaKey(item))
        : media.set(mediaKey(item), structuredClone(item)),
    readAllMedia: async (config) =>
      [...media.values()].filter((item) =>
        item.targetDb === config.targetDb && item.targetStore === config.targetStore
      ),
  };
}
async function candidateFor(sample) {
  return {
    contentHash: await sha256(JSON.stringify([sample.target, sample.sourceEntries])),
    entries: Object.entries(sample.sourceEntries).map(([sourceKey, value]) => ({
      sourceKey,
      targetKey: mapKey(sample.target, sourceKey),
      value,
      archive: mapKey(sample.target, sourceKey) === null,
    })),
    media: await Promise.all(sample.media.map(async (item) => {
      const spec = TARGETS[sample.target].media.find((spec) => spec.db === item.db);
      return {
        ref: { db: item.db, store: item.store, key: item.key, sha256: await bytes(item.value) },
        value: item.value,
        targetDb: spec.targetDb,
        targetStore: spec.targetStore,
      };
    })),
  };
}
for (const sample of [...samples, { ...samples[0], target: 'kairos-classic' }]) {
  test(`held-out ${sample.appId} ${sample.target}: native readers + ZZ/public profile byte round-trip`, async () => {
    const candidate = await candidateFor(sample), store = memoryStore();
    for (const [sourceKey, value] of Object.entries(sample.publicEntries)) {
      const key = mapKey(sample.target, sourceKey);
      if (key) store.local.set(key, value);
    }
    // Public image records deliberately differ in metadata when the app stores records.
    for (const item of candidate.media) {
      await store.writeMedia({
        ...item,
        value: item.value instanceof Blob
          ? new Blob([item.value, new Uint8Array([0, 1, 2])], { type: item.value.type })
          : {
            ...item.value,
            blob: new Blob([item.value.blob, new Uint8Array([0, 1, 2])], { type: item.value.blob.type }),
            savedAt: 1795600000999,
          },
      });
    }
    const originalLocal = new Map(store.local),
      originalMedia = new Map(
        await Promise.all([...store.media].map(async ([key, item]) => [key, await bytes(item.value)])),
      );
    let urlExecutions = 0;
    const previousOpen = globalThis.open;
    globalThis.open = () => {
      urlExecutions++;
      throw new Error('unexpected URL execution');
    };
    try {
      const preview = await previewImport(sample.target, candidate, { store });
      assert.deepEqual(preview.invalid, []);
      await applyImport(sample.target, candidate, { store, expectedRevision: preview.revision });
      if (sample.target === 'choice') {
        const combined = JSON.parse(store.get('magic-choice-dist.v1.store'));
        assert.equal(combined.presets.length, 2);
        assert.equal(combined.sets.length, 2);
        assert.equal(combined.dummyNotes.length, 2);
        assert.notEqual(combined.presets[0].id, combined.presets[1].id);
        assert.equal(combined.sets[1].presetIds[0], combined.presets[1].id);
        assert.equal(combined.sets[1].dummyIds[0], combined.dummyNotes[1].id);
      }
      await activateProfile(sample.target, 'zz', { store });
      for (const entry of candidate.entries) {
        if (entry.targetKey) assert.equal(store.get(entry.targetKey), entry.value);
      }
      const profile = { entries: [...store.local], media: [...store.media.values()] };
      assert.deepEqual(await validateProfile(sample.target, profile), []);
      for (const item of candidate.media) {
        assert.equal(await bytes(await store.readMedia(item)), await bytes(item.value));
      }
      if (sample.target === 'arosaegida') {
        const qr = QR.restore(store.get('magic-qr-session-v1-arosaegida'));
        assert.equal(QR.decode(qr.current), 'https://example.org/decoy');
        assert.equal(qr.frozen, true);
        assert.equal(qr.counter, 1);
        qr.frozen = false;
        assert.equal(QR.next(qr, () => 0.25), true);
        assert.equal(QR.decode(qr.current), 'https://example.com/heldout');
        assert.equal(qr.counter, 2);
      }
      if (sample.target === 'kairos') {
        assert.equal(store.get('friend-kairos_preset_cs'), '47');
        assert.equal(store.get('friend-kairos_custom_text'), '구형 단독');
      }
      if (sample.target === 'choice') {
        const data = JSON.parse(store.get('magic-choice-dist.v1.store'));
        assert.equal(data.sets[0].presetIds[0], data.presets[0].id);
        assert.equal(JSON.parse(store.get('magic-choice-dist.v1.user-icons'))[0].page, 2);
      }
      if (sample.target === 'tobira') {
        assert.equal(store.get('friend-tobira.wallpaperCrop.v1'), '12');
        assert.ok(await store.readMedia(candidate.media[0]));
      }
      if (sample.target === 'aletheia') {
        const sets = JSON.parse(store.get('aletheia.distribution.photoSets.v2')).sets;
        assert.deepEqual(sets.map((set) => set.length), [12, 12, 12]);
        assert.equal(sets[2][11], 'img_end');
      }
      if (sample.target === 'pimax') {
        assert.equal(JSON.parse(store.get('pimax.distribution.session')).accumulatedMs, 2345);
      }
      await activateProfile(sample.target, 'public', { store });
      for (const [key, value] of originalLocal) assert.equal(store.get(key), value);
      for (const [key, hash] of originalMedia) {
        assert.equal(await bytes(store.media.get(key)?.value), hash);
        const value = store.media.get(key)?.value;
        if (!(value instanceof Blob)) assert.equal(value.savedAt, 1795600000999);
      }
      assert.equal(urlExecutions, 0);
      assert.equal((await applyImport(sample.target, candidate, { store })).duplicate, true);
    } finally {
      globalThis.open = previousOpen;
    }
  });
}
test('held-out fixture census', () => {
  assert.equal(samples.length, 14);
  assert.equal(new Set(samples.map((s) => s.appId)).size, 14);
  assert.equal(samples.filter((s) => s.media.length).length, 4);
});
