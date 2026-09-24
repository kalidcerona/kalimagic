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

test('personal unlock always enables emergency time machine while shared unlock keeps its choice', () => {
  assert.equal(logic.normalizeSettings({ performance: 'pin' }, true).performance, 'time-machine');
  assert.equal(logic.normalizeSettings({ performance: 'pin' }, false).performance, 'pin');
});

test('iPhone PIN prompt stays concise while Galaxy keeps its native wording', () => {
  assert.equal(logic.lockScreenCopy('ios').prompt, '암호 입력');
  assert.equal(logic.lockScreenCopy('galaxy').prompt, 'PIN을 입력하세요');
});

test('reveal attempt setting is clamped to an available positive slot', () => {
  assert.equal(logic.normalizeSettings({ revealAttempt: 4 }).revealAttempt, 4);
  assert.equal(logic.normalizeSettings({ revealAttempt: 0 }).revealAttempt, 1);
  assert.equal(logic.normalizeSettings({ revealAttempt: 999 }).revealAttempt, 99);
});

test('personal home stays on the second screenshot when its reveal card opens', () => {
  assert.equal(typeof logic.homeSwipeTarget, 'function');
  assert.deepEqual(logic.homeSwipeTarget('home1', -180, 0, true), { page: 'home2', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', -180, 0, true), { page: 'home2', revealVisible: true, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', 180, 0, true, true), { page: 'home2', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', 180, 0, true), { page: 'home1', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home1', -180, 0, false), { page: 'home1', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home1', 0, -180, true), { page: 'home1', revealVisible: false, peek: true });
  assert.deepEqual(logic.homeSwipeTarget('home2', 0, -180, true, true), { page: 'home2', revealVisible: false, peek: true });
  assert.deepEqual(logic.homeSwipeTarget('home1', -20, 0, true), { page: 'home1', revealVisible: false, peek: false });
});

test('personal home requires both uploaded home screenshots before starting', () => {
  assert.equal(logic.personalHomeReady(new Set(['lock', 'unlock'])), false);
  assert.equal(logic.personalHomeReady(new Set(['lock', 'unlock', 'home2'])), true);
});
