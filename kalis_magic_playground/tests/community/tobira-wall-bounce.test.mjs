import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTiltBody, isBreakthroughSnap, outwardTravel, shakeImpulse } from '../../zz6/sensor-motion.js';

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

test('Tobira ignores a moderate shake and keeps a deliberate snap', () => {
  const moderate = shakeImpulse({ acceleration: { x: 15, y: 0, z: 0 } });
  const strong = shakeImpulse({ acceleration: { x: 19, y: 0, z: 0 } });
  assert.equal(isBreakthroughSnap(moderate, 1000), false);
  assert.equal(isBreakthroughSnap(strong, 1000), true);
});
