import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPresetSlot, loadNamedPresets, saveNamedPresets, normalizeNamedPreset, resolveSequenceStop } from '../../zz1/logic.js';

test('applying a text preset disables trick 3 left active by another preset', () => {
  const result = applyPresetSlot({ kind: 'text', value: 'KALI' }, {
    trick3Enabled: true,
    sequence: [6, 28],
  });
  assert.equal(result.trickState, 'text');
  assert.equal(result.trick3Enabled, false);
  assert.equal(result.customText, 'KALI');
});

test('applying a sequence preset activates trick 3 and its saved sequence', () => {
  const result = applyPresetSlot({ kind: 'seq', value: '06,28' }, {
    trick3Enabled: false,
    customText: 'KALI',
  });
  assert.equal(result.trickState, 'seq');
  assert.equal(result.trick3Enabled, true);
  assert.deepEqual(result.sequence, [6, 28]);
  assert.equal(result.sequenceStopCount, 0);
});

test('existing three preset slots migrate to named presets without losing values', () => {
  const data = new Map([['stopwatch_seq_slots', JSON.stringify([
    { kind: 'seq', value: '05,07' }, { kind: 'text', value: 'KALI' }, { kind: 'text', value: '' },
  ])]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const presets = loadNamedPresets(storage);
  assert.equal(presets.length, 3);
  assert.deepEqual(presets[0], { name: '프리셋 1', kind: 'seq', value: '05,07', forceAfter: 2 });
  assert.equal(presets[1].value, 'KALI');
  saveNamedPresets(storage, presets);
  assert.deepEqual(loadNamedPresets(storage), presets);
});

test('named sequence preset normalizes force count and keeps ordered values', () => {
  assert.deepEqual(normalizeNamedPreset({ name: ' 생일 ', kind: 'seq', value: '5, 07', forceAfter: 3 }, 0), {
    name: '생일', kind: 'seq', value: '05,07', forceAfter: 3,
  });
});

test('sequence force starts after its saved number of stops', () => {
  const values = [5, 7];
  assert.equal(resolveSequenceStop({ stopCount: 2, sequence: values, elapsed: 12340, forceAfter: 3 }).cs, 1234);
  assert.equal(resolveSequenceStop({ stopCount: 3, sequence: values, elapsed: 12340, forceAfter: 3 }).cs, 1205);
});
