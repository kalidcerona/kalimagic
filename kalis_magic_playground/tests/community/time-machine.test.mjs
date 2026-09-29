import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hiddenDigit, appendMinuteDigit, registerEmergencyTap, timeMachineOffset, timeMachineClock, REWIND_STEP_MS, isSettingsSwipe } from '../../zz2/time-machine.js';

test('hidden keypad includes zero and ignores unused bottom corners', () => {
  assert.equal(hiddenDigit(10, 10, 300, 800), 1);
  assert.equal(hiddenDigit(150, 700, 300, 800), 0);
  assert.equal(hiddenDigit(10, 700, 300, 800), null);
  assert.equal(hiddenDigit(290, 700, 300, 800), null);
  assert.equal(hiddenDigit(300, 10, 300, 800), null);
});

test('two hidden digits select 03 and 15 minutes without leading-zero loss', () => {
  assert.deepEqual(appendMinuteDigit([], 0), { digits: [0], minutes: null });
  assert.deepEqual(appendMinuteDigit([0], 3), { digits: [0, 3], minutes: 3 });
  assert.deepEqual(appendMinuteDigit([1], 5), { digits: [1, 5], minutes: 15 });
});

test('emergency entry requires two taps within the window', () => {
  assert.deepEqual(registerEmergencyTap(null, 1000), { lastTap: 1000, enter: false });
  assert.deepEqual(registerEmergencyTap(1000, 1400), { lastTap: null, enter: true });
  assert.deepEqual(registerEmergencyTap(1000, 1600), { lastTap: 1600, enter: false });
});

test('rewind decrements one minute every 800ms after the delay and holds the last frame', () => {
  assert.equal(REWIND_STEP_MS, 800);
  assert.equal(timeMachineOffset(7, null, 0, 2, 4), 420000);
  for (const [elapsed, remaining] of [[0, 7], [799, 7], [800, 6], [1599, 6], [1600, 5], [5599, 1], [5600, 0]]) {
    assert.equal(timeMachineOffset(7, 1000, 3000 + elapsed, 2, 4), remaining * 60000);
  }
  const wall = Date.UTC(2026, 8, 29, 23, 59, 59, 500);
  const clock = elapsed => timeMachineClock(7, 1000, 3000 + elapsed, 2, wall + 2000 + elapsed, wall);
  assert.equal(clock(799) - clock(800), 60000);
  assert.equal(clock(5599) - clock(5600), 60000);
  assert.equal(clock(6399), wall + 2000);
  assert.equal(clock(6400), wall + 8400);
});

test('settings gesture requires two matching downward swipes', () => {
  const start = [{id:1,x:20,y:50},{id:2,x:200,y:50}];
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:130},{id:2,x:203,y:140}]),false);
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:150},{id:2,x:203,y:160}]),true);
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:150},{id:2,x:203,y:55}]),false);
});
