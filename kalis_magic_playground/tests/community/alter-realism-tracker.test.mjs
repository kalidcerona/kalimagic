import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';
const source = process.env.ALTER_SOURCE || fileURLToPath(new URL('../../zz10/', import.meta.url));
const { createObservationTracker, trackObservation, overlayCorners } = await import(pathToFileURL(`${source}/performance.js`));
const card = (x) => ({ corners: [{x,y:72},{x:x+73,y:72},{x:x+73,y:179},{x,y:179}] });
const step = (tracker, x, t) => trackObservation(tracker, x === null ? null : card(x), t, 256, 256);
function outward(times = [100, 180, 260]) {
  let tracker = createObservationTracker();
  for (let i = 0; i < times.length; i++) tracker = step(tracker, [27,16,5][i], times[i]).tracker;
  return tracker;
}
test('raw full exit retains exact absence and geometry hold contracts', () => {
  const tracker = outward();
  assert.equal(tracker.exitArmed, true);
  assert.equal(step(tracker, null, 609).observation.fullFrameExit, false);
  assert.equal(step(tracker, null, 610).observation.fullFrameExit, true);
  assert.deepEqual(overlayCorners(tracker, null, 510), card(5).corners);
  assert.equal(overlayCorners(tracker, null, 511), null);
});
test('stationary edge and central concealment never count as full exit', () => {
  for (const x of [5, 83]) {
    let tracker = createObservationTracker();
    for (let t = 100; t <= 500; t += 80) tracker = step(tracker, x, t).tracker;
    assert.equal(step(tracker, null, 950).observation.fullFrameExit, false);
  }
});
test('backward detections do not accumulate outward continuity', () => {
  const tracker = outward([360,280,200]);
  assert.equal(tracker.exitArmed, false);
  assert.equal(step(tracker, null, 700).observation.fullFrameExit, false);
});
test('duplicate timestamps do not create stable reentry or outward steps', () => {
  let tracker = step(createObservationTracker(), 27, 500).tracker;
  const repeated = step(tracker, 16, 500);
  assert.equal(repeated.observation.stableCorners, false);
  tracker = step(repeated.tracker, 5, 500).tracker;
  assert.equal(tracker.exitArmed, false);
});
test('a backwards absence invalidates the armed exit for later frames', () => {
  const interrupted = step(outward(), null, 240);
  assert.equal(interrupted.observation.fullFrameExit, false);
  assert.equal(step(interrupted.tracker, null, 610).observation.fullFrameExit, false);
});
test('large camera observation gap cannot create an exit', () => {
  assert.equal(step(outward(), null, 2200).observation.fullFrameExit, false);
});
test('returning raw motion disarms exit before subsequent concealment', () => {
  const tracker = step(outward(), 12, 340).tracker;
  assert.equal(step(tracker, null, 690).observation.fullFrameExit, false);
});
