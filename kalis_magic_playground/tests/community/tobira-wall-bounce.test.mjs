import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTiltBody, outwardTravel } from '../../zz6/sensor-motion.js';

test('Tobira bounces at the selected wall before leaving on its second hit', () => {
  const stage = { width: 300, height: 600 };
  const floor = advanceTiltBody(
    { x: 150, y: 578, vx: 0, vy: 300, collisions: 0 },
    { x: 0, y: 1 }, stage, 20, 50, ['right'],
  );
  assert.equal(floor.body.collisions, 1);

  let step = advanceTiltBody(
    { ...floor.body, x: 278, y: 300, vx: 300, vy: 0 },
    { x: 1, y: 0 }, stage, 20, 50, ['right'],
  );
  assert.equal(step.exit, null);
  assert.ok(step.body.vx < 0);
  for (let i = 0; i < 40 && !step.exit; i += 1) {
    step = advanceTiltBody(step.body, { x: 1, y: 0 }, stage, 20, 16, ['right']);
  }
  assert.equal(step.exit, 'right');
  assert.ok(step.exitSpeed > 0);
  assert.ok(outwardTravel(step.exitSpeed, 100, 550) > outwardTravel(0, 100, 550));
});
