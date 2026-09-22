import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridMinutes, timeMachineOffset, isSettingsSwipe } from '../../zz5/time-machine.js';

test('time machine grid selects a stored minute and ignores outside touches', () => {
  const values = [9,8,7,6,5,4,3,2,1];
  assert.equal(gridMinutes(0, 0, 300, 600, values), 9);
  assert.equal(gridMinutes(299, 599, 300, 600, values), 1);
  assert.equal(gridMinutes(300, 1, 300, 600, values), null);
});

test('time machine gradually rejoins the live clock after a delay', () => {
  assert.equal(timeMachineOffset(7, null, 0, 2, 4), 420000);
  assert.equal(timeMachineOffset(7, 1000, 3000, 2, 4), 420000);
  assert.equal(timeMachineOffset(7, 1000, 5000, 2, 4), 210000);
  assert.equal(timeMachineOffset(7, 1000, 7000, 2, 4), 0);
});

test('settings gesture requires two matching downward swipes', () => {
  const start = [{id:1,x:20,y:50},{id:2,x:200,y:50}];
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:130},{id:2,x:203,y:140}]),true);
  assert.equal(isSettingsSwipe(start,[{id:1,x:22,y:130},{id:2,x:203,y:55}]),false);
});
