import test from 'node:test';
import assert from 'node:assert/strict';
import * as logic from '../../zz5/logic.js';

test('personal reveal selects configured attempt and formats valid birthday separately', () => {
  const attempts = [[1, 2, 3, 4, 5, 6], [0, 8, 0, 2, 2, 9], [9, 9, 9, 9, 9, 9]];
  assert.equal(typeof logic.selectedAttemptReveal, 'function');
  assert.deepEqual(logic.selectedAttemptReveal(attempts, 2, new Date(2026, 8, 24)), {
    pin: '080229', days: 6782,
  });
});

test('personal reveal stays empty until the configured attempt exists', () => {
  assert.equal(typeof logic.selectedAttemptReveal, 'function');
  assert.equal(logic.selectedAttemptReveal([[1, 2, 3, 4]], 2, new Date(2026, 8, 24)), null);
});

test('personal and shared unlock use different persistent storage identities', () => {
  assert.equal(typeof logic.storageIdentityForPath, 'function');
  assert.notDeepEqual(logic.storageIdentityForPath('/zz5/'), logic.storageIdentityForPath('/tools/unlock/'));
  assert.equal(logic.storageIdentityForPath('/zz5/').personal, true);
  assert.equal(logic.storageIdentityForPath('/tools/unlock/').personal, false);
});

test('reveal attempt setting is clamped to an available positive slot', () => {
  assert.equal(logic.normalizeSettings({ revealAttempt: 4 }).revealAttempt, 4);
  assert.equal(logic.normalizeSettings({ revealAttempt: 0 }).revealAttempt, 1);
  assert.equal(logic.normalizeSettings({ revealAttempt: 999 }).revealAttempt, 99);
});

test('home carousel advances through second screenshot to selected reveal', () => {
  assert.equal(typeof logic.homeSwipeTarget, 'function');
  assert.equal(logic.homeSwipeTarget('home1', -180, 0, true), 'home2');
  assert.equal(logic.homeSwipeTarget('home2', -180, 0, true), 'reveal');
  assert.equal(logic.homeSwipeTarget('reveal', 180, 0, true), 'home2');
  assert.equal(logic.homeSwipeTarget('home2', 180, 0, true), 'home1');
  assert.equal(logic.homeSwipeTarget('home1', -180, 0, false), 'home1');
  assert.equal(logic.homeSwipeTarget('home1', 0, -180, true), 'peek');
  assert.equal(logic.homeSwipeTarget('home1', -20, 0, true), 'home1');
});
