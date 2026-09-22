import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPresetSlot } from '../../zz6/logic.js';

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
