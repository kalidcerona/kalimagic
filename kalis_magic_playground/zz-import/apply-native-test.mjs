import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { activateProfile, applyImport, previewImport } from './apply.mjs';
import { validateProfile } from './apply-validate.mjs';
import { countValues, mergeValue } from './apply-merge.mjs';
import { freshState } from '../distribution-snapshots/memdeck/core.mjs';
import { emptyState } from '../distribution-snapshots/choice/logic-storage.js';
import { defaultSettings, defaultStats } from '../distribution-snapshots/pimax/core-storage.mjs';
import * as Uramichi from '../distribution-snapshots/uramichi/core.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const fixtures = [
  ['choice', 'magic-choice-dist.v1.store', emptyState()],
  ['memdeck', 'friend-memdeck-v1', freshState()],
  ['pimax', 'pimax.distribution.settings', defaultSettings()],
  ['pimax', 'pimax.distribution.stats', defaultStats()],
  ['aletheia', 'aletheia.distribution.meta.v1', { version: 1, presets: [], selectedId: null }],
  ['aletheia', 'aletheia.distribution.photoSets.v2', {
    version: 2,
    sets: Array.from({ length: 3 }, () => Array(12).fill(null)),
  }],
  ['uramichi', 'friend-uramichi.web.presets', {
    app: 'URAMICHI',
    version: 1,
    categories: [{
      id: 'cat',
      name: 'test',
      inputKind: 'NONE',
      entries: [{ id: 'item', label: 'hello', url: 'https://example.com', code: '' }],
    }],
  }],
  ['asrai', 'friend-asrai.prototype.v2', {
    names: ['하나'],
    clickCount: 2,
    targetClick: 4,
    phone: '010',
    region: '서울',
    note: '메모',
  }],
  ['release', 'unlock-settings-v1', { timeDelay: 3 }],
  ['kairos', 'friend-kairos_named_presets_v1', [{
    kind: 'text',
    value: 'hello',
    name: 'test',
    forceAfter: 2,
  }]],
  ['tyche', 'friend-spinner-state-v2', {
    forceSpin: 4,
    spins: 1,
    targetAngle: 120,
    previousAngle: null,
    rotation: 0,
  }],
  ['hitsuzen', 'magic-calc-date-delay', 20],
];
for (const [target, key, value] of fixtures) {
  test(`native ${target} ${key} accepted and corrupt JSON rejected`, async () => {
    const raw = typeof value === 'number' ? String(value) : JSON.stringify(value);
    assert.deepEqual(await validateProfile(target, { entries: [[key, raw]], media: [] }), []);
    assert.equal((await validateProfile(target, { entries: [[key, '{bad']], media: [] })).length, 1);
  });
}
test('URAMICHI same category ID retains both with distinct IDs and counts', () => {
  const a = {
    categories: [{
      id: 'c',
      name: 'old',
      inputKind: 'NONE',
      entries: [{ id: 'e', label: 'old', url: 'https://a.example', code: '' }],
    }],
  };
  const b = {
    categories: [{
      id: 'c',
      name: 'new',
      inputKind: 'NONE',
      entries: [{ id: 'e', label: 'new', url: 'https://b.example', code: '' }],
    }],
  };
  const raw = mergeValue('friend-uramichi.web.presets', JSON.stringify(a), JSON.stringify(b), 'abcd');
  const merged = JSON.parse(raw);
  assert.equal(merged.categories.length, 2);
  assert.notEqual(merged.categories[0].id, merged.categories[1].id);
  const counts = countValues([['friend-uramichi.web.presets', raw]]);
  assert.equal(counts.groups, 2);
  assert.equal(counts.items, 2);
});
const uramichiKey = (name) => `friend-uramichi.web.${name}`;
function uramichiProfile({ categories, armed, recents }) {
  return new Map([
    [uramichiKey('presets'), Uramichi.encodeCategories(categories)],
    [uramichiKey('armed'), armed ? Uramichi.encodeArmed(armed) : null],
    [uramichiKey('recent'), Uramichi.encodeRecents(recents)],
  ]);
}
async function importUramichi(publicProfile, zzProfile) {
  const local = new Map(publicProfile), state = new Map();
  const store = {
    get: (key) => local.get(key) ?? null,
    set: (key, value) => local.set(key, value),
    stateGet: async (key) => structuredClone(state.get(key)),
    statePut: async (key, value) => state.set(key, structuredClone(value)),
  };
  const candidate = {
    contentHash: 'abcdabcd'.repeat(8),
    entries: [...zzProfile].filter(([, value]) => value !== null).map(([targetKey, value]) => ({
      targetKey,
      value,
    })),
    media: [],
  };
  const preview = await previewImport('uramichi', candidate, { store });
  assert.deepEqual(preview.invalid, []);
  assert.equal(
    (await applyImport('uramichi', candidate, { store, expectedRevision: preview.revision })).verified,
    true,
  );
  return store;
}
test('URAMICHI merged armed sequence and recents resolve their original URLs', async () => {
  const publicCategory = Uramichi.category('same-cat', 'public', 'SEQUENCE', [
    Uramichi.entry('same-entry', 'public', 'https://example.com/public', ''),
  ]);
  const zzCategory = Uramichi.category('same-cat', 'zz', 'SEQUENCE', [
    Uramichi.entry('same-entry', 'zz', 'https://example.com/zz', ''),
  ]);
  const reserved = Uramichi.category('zz_abcdabcd_1', 'reserved', 'SEQUENCE', [
    Uramichi.entry('same-entry', 'reserved', 'https://example.com/reserved', ''),
  ]);
  const publicProfile = uramichiProfile({
    categories: [publicCategory],
    recents: [Uramichi.recentOfSequence(publicCategory)],
  });
  const zzProfile = uramichiProfile({
    categories: [zzCategory, reserved],
    armed: Uramichi.armSequence(zzCategory),
    recents: [Uramichi.recentOfSequence(zzCategory), Uramichi.recentOfSequence(reserved)],
  });
  const store = await importUramichi(publicProfile, zzProfile);
  const armed = () => Uramichi.decodeArmed(store.get(uramichiKey('armed')));
  const categories = () => Uramichi.decodeCategories(store.get(uramichiKey('presets')));
  const merged = categories();
  assert.equal(merged.length, 3);
  assert.equal(new Set(merged.map(({ id }) => id)).size, 3);
  assert.equal(merged[2].id, reserved.id);
  assert.deepEqual(merged[1].entries, zzCategory.entries);
  assert.equal(armed().categoryId, merged[1].id);
  assert.equal(Uramichi.target(armed(), merged), 'https://example.com/zz');
  const recents = Uramichi.decodeRecents(store.get(uramichiKey('recent')));
  assert.deepEqual(
    recents.map((recent) => Uramichi.target(Uramichi.armFromRecent(recent, merged, 'ONCE'), merged)),
    [
      'https://example.com/public',
      'https://example.com/zz',
      'https://example.com/reserved',
    ],
  );
  for (const [profile, original] of [['public', publicProfile], ['zz', zzProfile]]) {
    await activateProfile('uramichi', profile, { store });
    for (const [key, raw] of original) assert.equal(store.get(key), raw);
  }
  await activateProfile('uramichi', 'merged', { store });
  assert.equal(Uramichi.target(armed(), categories()), 'https://example.com/zz');

  publicProfile.set(uramichiKey('armed'), Uramichi.encodeArmed(Uramichi.armSequence(publicCategory)));
  const armedPublic = await importUramichi(publicProfile, zzProfile);
  assert.equal(armedPublic.get(uramichiKey('armed')), publicProfile.get(uramichiKey('armed')));
});
test('URAMICHI dedup remaps entry references within their category', async () => {
  const url = 'https://example.com/shared';
  const category = (id, name, entryId) =>
    Uramichi.category(id, name, 'NONE', [Uramichi.entry(entryId, 'entry', url, '')]);
  const existing = category('public-cat', 'shared', 'public-entry');
  const alias = category('zz-cat', 'shared', 'zz-entry');
  const separate = category('other-cat', 'separate', 'zz-entry');
  const recent = (category) => Uramichi.recent(category.id, category.entries[0].id, 'entry', url, 'NONE');
  const publicProfile = uramichiProfile({ categories: [existing], recents: [recent(existing)] });
  const zzProfile = uramichiProfile({
    categories: [alias, separate],
    armed: Uramichi.armed(alias.id, alias.entries[0].id, 'entry', url, 'ONCE'),
    recents: [recent(alias), recent(separate)],
  });
  const store = await importUramichi(publicProfile, zzProfile);
  const categories = Uramichi.decodeCategories(store.get(uramichiKey('presets')));
  assert.deepEqual(categories, [existing, separate]);
  const armed = Uramichi.decodeArmed(store.get(uramichiKey('armed')));
  assert.equal(armed.categoryId, existing.id);
  assert.equal(armed.entryId, existing.entries[0].id);
  assert.equal(Uramichi.target(armed, categories), url);
  assert.deepEqual(Uramichi.decodeRecents(store.get(uramichiKey('recent'))), [
    recent(existing),
    recent(separate),
  ]);
});
test('domain counts preserve backup dedup and archive order', () => {
  const choice = JSON.stringify({
    presets: [{ id: 'x', items: ['a', 'b'] }],
    sets: [{ id: 's' }],
    dummyNotes: [{ id: 'd' }],
  });
  const counts = countValues([['magic-choice-dist.v1.store', choice], [
    'magic-choice-dist.v1.store.backup',
    choice,
  ], ['magic-choice.performance-log.v1', '[{"at":1},{"at":2}]']]);
  assert.equal(counts.lists, 1);
  assert.equal(counts.items, 2);
  assert.equal(counts.groups, 1);
  assert.equal(counts.records, 3);
});
