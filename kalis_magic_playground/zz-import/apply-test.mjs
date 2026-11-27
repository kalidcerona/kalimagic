import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { activateProfile, applyImport, previewImport, recoverImport } from './apply.mjs';
import { mergeCollections } from './apply-merge.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
function fixture() {
  const values = new Map([['friend-alter-settings', '{"rank":"A","suit":"spade","brightness":100}']]),
    state = new Map(),
    media = new Map();
  let failed = false;
  const store = {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      if (store.fail && !failed) {
        failed = true;
        throw new Error('quota');
      }
      if (value === null) values.delete(key);
      else values.set(key, value);
    },
    stateGet: async (key) => structuredClone(state.get(key)),
    statePut: async (key, value) => {
      state.set(key, structuredClone(value));
    },
    readMedia: async (item) => media.get(item.ref.key),
    writeMedia: async (item) => {
      media.set(item.ref.key, item.value);
    },
  };
  const candidate = {
    contentHash: 'a'.repeat(64),
    entries: [{
      sourceKey: 'alter-settings',
      targetKey: 'friend-alter-settings',
      value: '{"rank":"K","suit":"heart","brightness":110}',
    }],
    media: [],
  };
  return { store, candidate, values, state };
}
test('default keeps public, retains ZZ profile, repeat creates no duplicate', async () => {
  const { store, candidate, values } = fixture();
  const preview = await previewImport('alter', candidate, { store });
  const result = await applyImport('alter', candidate, { store, expectedRevision: preview.revision });
  assert.equal(result.verified, true);
  assert.equal(values.get('friend-alter-settings'), '{"rank":"A","suit":"spade","brightness":100}');
  assert.equal((await applyImport('alter', candidate, { store })).duplicate, true);
  await activateProfile('alter', 'zz', { store });
  assert.equal(values.get('friend-alter-settings'), '{"rank":"K","suit":"heart","brightness":110}');
  await activateProfile('alter', 'public', { store });
  assert.equal(values.get('friend-alter-settings'), '{"rank":"A","suit":"spade","brightness":100}');
});
test('stale preview blocks all destination writes', async () => {
  const { store, candidate, values, state } = fixture();
  const preview = await previewImport('alter', candidate, { store });
  values.set('friend-alter-settings', 'changed');
  await assert.rejects(
    applyImport('alter', candidate, { store, expectedRevision: preview.revision }),
    /변경/,
  );
  assert.equal(state.size, 0);
  assert.equal(values.get('friend-alter-settings'), 'changed');
});
test('partial write failure rolls back exact public bytes and no receipt', async () => {
  const { store, candidate, values, state } = fixture();
  const preview = await previewImport('alter', candidate, { store });
  store.fail = true;
  await assert.rejects(
    applyImport('alter', candidate, { store, expectedRevision: preview.revision, activate: 'zz' }),
    /quota/,
  );
  assert.equal(values.get('friend-alter-settings'), '{"rank":"A","suit":"spade","brightness":100}');
  assert.equal(state.has('receipt:alter:' + candidate.contentHash), false);
});
test('interrupted journal is rolled back before reuse', async () => {
  const { store, values, state } = fixture();
  state.set('journal:alter', {
    target: 'alter',
    status: 'prepared',
    before: { entries: [['friend-alter-settings', 'original']], media: [] },
  });
  values.set('friend-alter-settings', 'partial');
  assert.equal((await recoverImport('alter', { store })).recovered, true);
  assert.equal(values.get('friend-alter-settings'), 'original');
});
test('collections keep collisions and remap internal references; fixed slots stay unchanged', () => {
  const old = { presets: [{ id: 'x', name: 'old' }], sets: [], slots: ['old'] };
  const incoming = {
    presets: [{ id: 'x', name: 'new' }],
    sets: [{ id: 'set', presetIds: ['x'] }],
    slots: ['new'],
  };
  const merged = mergeCollections(old, incoming, 'abc').value;
  assert.equal(merged.presets.length, 2);
  assert.notEqual(merged.presets[1].id, 'x');
  assert.equal(merged.sets[0].presetIds[0], merged.presets[1].id);
  assert.deepEqual(merged.slots, ['old']);
  assert.equal(incoming.presets[0].id, 'x');
});
test('photo collision keeps public bytes and ZZ bytes in separate profiles', async () => {
  const { store, candidate } = fixture();
  const item = {
    targetDb: 'unlock-images',
    targetStore: 'images',
    ref: { key: 'lock' },
    value: new Blob(['incoming']),
  };
  await store.writeMedia({ ...item, value: new Blob(['public']) });
  candidate.media = [item];
  const preview = await previewImport('alter', candidate, { store });
  await applyImport('alter', candidate, { store, expectedRevision: preview.revision });
  assert.equal(await (await store.readMedia(item)).text(), 'public');
  await activateProfile('alter', 'zz', { store });
  assert.equal(await (await store.readMedia(item)).text(), 'incoming');
  await activateProfile('alter', 'public', { store });
  assert.equal(await (await store.readMedia(item)).text(), 'public');
});
test('receipt commit interruption remains idempotent', async () => {
  const { store, candidate, values } = fixture();
  const preview = await previewImport('alter', candidate, { store });
  const put = store.statePut;
  let once = true;
  store.statePut = async (key, value) => {
    if (key.startsWith('receipt:') && once) {
      once = false;
      throw new Error('interrupted receipt');
    }
    return put(key, value);
  };
  assert.equal(
    (await applyImport('alter', candidate, { store, expectedRevision: preview.revision, activate: 'zz' }))
      .verified,
    true,
  );
  assert.equal(values.get('friend-alter-settings'), '{"rank":"K","suit":"heart","brightness":110}');
  assert.equal((await applyImport('alter', candidate, { store })).duplicate, true);
});
test('malformed active data is retained for recovery without receipt or destination writes', async () => {
  const { store, candidate, values, state } = fixture();
  candidate.entries[0].value = '{broken';
  const preview = await previewImport('alter', candidate, { store });
  assert.equal(preview.invalid.length, 1);
  await assert.rejects(
    applyImport('alter', candidate, { store, expectedRevision: preview.revision, activate: 'zz' }),
    /복구용/,
  );
  assert.equal(values.get('friend-alter-settings'), '{"rank":"A","suit":"spade","brightness":100}');
  assert.ok(state.has('recovery:alter:' + candidate.contentHash));
  assert.equal(state.has('receipt:alter:' + candidate.contentHash), false);
});
test('native CHOICE reader rejects syntactically valid invalid lists', async () => {
  const { store, candidate } = fixture();
  candidate.entries = [{
    sourceKey: 'magic-choice.v1.store',
    targetKey: 'magic-choice-dist.v1.store',
    value: '{"version":1,"presets":[{"id":"bad"}]}',
  }];
  const preview = await previewImport('choice', candidate, { store });
  assert.equal(preview.invalid.length, 1);
  await assert.rejects(
    applyImport('choice', candidate, { store, expectedRevision: preview.revision }),
    /복구용/,
  );
});
test('profile re-switch preserves edits made while ZZ profile is active', async () => {
  const { store, candidate, values } = fixture();
  const preview = await previewImport('alter', candidate, { store });
  await applyImport('alter', candidate, { store, expectedRevision: preview.revision });
  await activateProfile('alter', 'zz', { store });
  const edited = '{"rank":"Q","suit":"club","brightness":90}';
  values.set('friend-alter-settings', edited);
  await activateProfile('alter', 'public', { store });
  await activateProfile('alter', 'zz', { store });
  assert.equal(values.get('friend-alter-settings'), edited);
});
test('legacy KAIROS values promote only when modern source is absent', async () => {
  const { store, candidate, values } = fixture();
  candidate.entries = [{ targetKey: 'friend-kairos-legacy_preset_cs', value: '23' }];
  let preview = await previewImport('kairos', candidate, { store });
  await applyImport('kairos', candidate, { store, expectedRevision: preview.revision, activate: 'zz' });
  assert.equal(values.get('friend-kairos_preset_cs'), '23');
  candidate.contentHash = 'b'.repeat(64);
  candidate.entries.push({ targetKey: 'friend-kairos_preset_cs', value: '45' });
  preview = await previewImport('kairos', candidate, { store });
  await applyImport('kairos', candidate, { store, expectedRevision: preview.revision, activate: 'zz' });
  assert.equal(values.get('friend-kairos_preset_cs'), '45');
});
