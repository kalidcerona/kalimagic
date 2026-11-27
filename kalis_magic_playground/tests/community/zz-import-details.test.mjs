import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { applyImport, pendingCandidates, previewImport, readImportDetails } from '../../zz-import/apply.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
function fixture() {
  const values = new Map([['magic-choice-dist.settings-gesture-guide.v1', 'before'], [
    'magic-choice.settings-gesture-guide.v1',
    'after',
  ]]);
  const state = new Map();
  const store = {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => value === null ? values.delete(key) : values.set(key, value),
    stateGet: async (key) => structuredClone(state.get(key)),
    statePut: async (key, value) => state.set(key, structuredClone(value)),
    readMedia: async () => undefined,
    writeMedia: async () => {},
  };
  const entries = [{
    sourceKey: 'magic-choice.settings-gesture-guide.v1',
    targetKey: 'magic-choice-dist.settings-gesture-guide.v1',
    value: 'after',
  }, { sourceKey: 'magic-choice.performance-log.v1', archive: true, value: '[{"at":1},{"at":2}]' }];
  const candidate = {
    contentHash: 'b'.repeat(64),
    entries,
    media: [],
    snapshot: {
      schemaVersion: 1,
      appId: 'zz4',
      rawEntries: Object.fromEntries(entries.map((e) => [e.sourceKey, e.value])),
      mediaRefs: [],
    },
  };
  return { values, state, store, candidate };
}
test('preview exposes both exact public and ZZ values for comparison', async () => {
  const { store, candidate } = fixture();
  const preview = await previewImport('choice', candidate, { store });
  assert.equal(new Map(preview.existingEntries).get('magic-choice-dist.settings-gesture-guide.v1'), 'before');
  assert.equal(new Map(preview.existingEntries).get('magic-choice-dist.v1.store'), null);
  assert.deepEqual(preview.incomingEntries, [['magic-choice-dist.settings-gesture-guide.v1', 'after']]);
});
test('retained file-import detail survives removed raw sources and is read-only', async () => {
  const { store, candidate, values, state } = fixture();
  const preview = await previewImport('choice', candidate, { store });
  await applyImport('choice', candidate, { store, expectedRevision: preview.revision });
  values.delete('magic-choice.settings-gesture-guide.v1');
  const before = structuredClone([...state]);
  const detail = await readImportDetails('choice', { store });
  assert.equal(
    new Map(detail.profiles.public.entries).get('magic-choice-dist.settings-gesture-guide.v1'),
    'before',
  );
  assert.equal(
    new Map(detail.profiles.zz.entries).get('magic-choice-dist.settings-gesture-guide.v1'),
    'after',
  );
  assert.deepEqual(detail.archiveCounts, { settings: 1, records: 2 });
  assert.deepEqual(detail.snapshot, candidate.snapshot);
  assert.equal(detail.imagesIncluded, false);
  assert.equal((await previewImport('choice', candidate, { store })).alreadyImported, true);
  assert.deepEqual([...state], before);
  detail.archive.length = 0;
  assert.equal((await readImportDetails('choice', { store })).archive.length, 1);
});
test('retained export omits binary images and can address an older imported version', async () => {
  const { store, state } = fixture();
  const contentHash = 'a'.repeat(64);
  const saved = {
    contentHash,
    active: 'zz',
    archive: [],
    public: { entries: [], media: [] },
    zz: {
      entries: [['key', 'value']],
      media: [{
        targetDb: 'photos',
        targetStore: 'images',
        ref: { key: 'photo', sha256: 'c'.repeat(64) },
        value: new Blob(['private bytes'], { type: 'image/png' }),
      }],
    },
  };
  state.set('profiles:choice', { ...saved, contentHash: 'b'.repeat(64) });
  state.set('profiles:choice:' + contentHash, saved);
  const detail = await readImportDetails('choice', { store, contentHash });
  assert.equal(detail.contentHash, contentHash);
  assert.equal(detail.profiles.zz.counts.photos, 1);
  assert.equal(detail.profiles.zz.mediaRefs[0].key, 'photo');
  assert.equal('value' in detail.profiles.zz.mediaRefs[0], false);
  assert.equal(JSON.stringify(detail).includes('private bytes'), false);
  assert.equal(await readImportDetails('alter', { store }), null);
});

test('offers check the destination and hash against receipts and the completed journal', async () => {
  const { store, state } = fixture();
  const target = 'kairos';
  state.set('receipt:kairos:first', { target, contentHash: 'first' });
  state.set('journal:kairos', { status: 'complete', receipt: { target, contentHash: 'second' } });
  store.readBackupReceipt = async (route, hash) =>
    route === target && hash === 'third' ? { target, contentHash: hash } : undefined;
  const candidates = ['first', 'second', 'third', 'new'].map((contentHash) => ({ contentHash }));
  assert.deepEqual(await pendingCandidates(target, candidates, { store }), [candidates[3]]);
  assert.deepEqual(await pendingCandidates('kairos-classic', candidates, { store }), candidates);
});
