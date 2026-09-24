import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hiddenDigit, appendMinuteDigit, registerEmergencyTap, timeMachineOffset, isSettingsSwipe } from '../../zz5/time-machine.js';

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

test('time machine gradually rejoins the live clock after a delay', () => {
  assert.equal(timeMachineOffset(7, null, 0, 2, 4), 420000);
  assert.equal(timeMachineOffset(7, 1000, 3000, 2, 4), 420000);
  assert.equal(timeMachineOffset(7, 1000, 5000, 2, 4), 210000);
  assert.equal(timeMachineOffset(7, 1000, 7000, 2, 4), 0);
});

test('settings gesture requires two matching downward swipes', () => {
  const start = [{id:1,x:20,y:50},{id:2,x:200,y:50}];
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:130},{id:2,x:203,y:140}]),false);
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:150},{id:2,x:203,y:160}]),true);
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:150},{id:2,x:203,y:55}]),false);
});
