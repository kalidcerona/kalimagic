import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginPerformance,
  chooseNumber,
  createPreset,
  emptyState,
  revealList,
  toPublic,
} from '../../zz4/logic.js';
import { parseTruthAttempts, verdictForAttempt } from '../../zz7/logic.js';

test('Choice inserts a separate force item at the chosen number without removing ordinary items', () => {
  const preset = createPreset({
    name: '영상 목록',
    itemsText: '첫째\n둘째\n셋째',
    forceItem: '포스',
    appearance: 'memo',
  }, { id: 'video-list', now: 1 }).preset;
  const state = { ...emptyState(), presets: [preset] };
  const started = beginPerformance(state, { mode: 'single', presetId: preset.id });
  assert.equal(started.ok, true);
  const chosen = chooseNumber(started.session, 0, 2);
  assert.equal(chosen.ok, true);
  const revealed = revealList(chosen.session, 0);
  assert.equal(revealed.ok, true);
  assert.deepEqual(toPublic(revealed.session).lists[0].items, ['첫째', '포스', '둘째', '셋째']);
});

test('Choice still performs with a legacy one-item saved list', () => {
  const preset = createPreset({
    name: '기존 목록', items: ['포스'], targetIndex: 0, appearance: 'memo',
  }, { id: 'legacy-one', now: 1 }).preset;
  const started = beginPerformance({ ...emptyState(), presets: [preset] }, { mode: 'single', presetId: preset.id });
  assert.equal(started.ok, true);
  const chosen = chooseNumber(started.session, 0, 1);
  assert.equal(chosen.ok, true);
  const revealed = revealList(chosen.session, 0);
  assert.equal(revealed.ok, true);
  assert.deepEqual(toPublic(revealed.session).lists[0].items, ['포스']);
});

test('USOTSUKI accepts comma-separated TRUE rounds and rejects duplicates', () => {
  const parsed = parseTruthAttempts('2,4');
  assert.deepEqual(parsed, { ok: true, value: [2, 4] });
  assert.deepEqual([1, 2, 3, 4].map((round) => verdictForAttempt(round, parsed.value)),
    ['LIE', 'TRUE', 'LIE', 'TRUE']);
  assert.equal(parseTruthAttempts('2,2').ok, false);
});
