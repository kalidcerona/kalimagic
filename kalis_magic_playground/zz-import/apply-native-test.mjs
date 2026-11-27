import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { validateProfile } from './apply-validate.mjs';
import { countValues, mergeValue } from './apply-merge.mjs';
import { freshState } from '../distribution-snapshots/memdeck/core.mjs';
import { emptyState } from '../distribution-snapshots/choice/logic-storage.js';
import { defaultSettings, defaultStats } from '../distribution-snapshots/pimax/core-storage.mjs';
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
