import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const routes = ['zz7', 'distribution-snapshots/usotsuki'];

async function logicOf(route) {
  return import(new URL(`../../${route}/logic.js`, import.meta.url));
}

for (const route of routes) {
  for (const drift of [60, 90]) {
    test(`${route}: ${drift}px drift uses the 76px hold range`, async () => {
      const { HOLD_MOVE_TOLERANCE_PX, beginHold, createDefaultState, createHold, releaseHold, updateHold } = await logicOf(route);
      assert.equal(HOLD_MOVE_TOLERANCE_PX, 76);
      const begun = beginHold(createHold(), 0, 0, 0);
      const moved = updateHold(begun.hold, drift, 0);
      assert.equal(moved.cancelled, drift === 90);
      const result = releaseHold(createDefaultState(), moved.hold, 3000, drift, 0);
      assert.equal(result.counted, drift === 60);
      assert.equal(result.state.attemptCount, drift === 60 ? 1 : 0);
    });
  }

  test(`${route}: recorder theme 30px outside the pad does not cancel, 90px drift does`, async () => {
    const { HOLD_MOVE_TOLERANCE_PX, beginHold, createDefaultState, createHold, releaseHold, updateHold } = await logicOf(route);
    const source = await readFile(new URL(`../../${route}/controller-gestures.js`, import.meta.url), 'utf8');
    const rect = { left: 120, top: 560, width: 148, height: 148 };
    const sandbox = {
      HOLD_MOVE_TOLERANCE_PX, updateHold,
      performanceScreen: { hidden: false, dataset: { displayTheme: 'recorder' }, setPointerCapture() {} },
      detectorButton: { getBoundingClientRect: () => rect },
      pointOnButton: (x, y) => x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height,
      settingsVisible: () => false, unlockFromGesture() {}, needsHapticPreparation: () => false,
      refreshHapticPreparation() {}, showReadyFeedback() {}, stopVibration() {},
      pointers: new Map(), hold: createHold(), settled: false,
      activePointerId: null, holdPointerId: null, readyPointerId: null, primerPointerId: null,
      gestureConsumed: false, readyFeedbackShown: true, performance: { now: () => 1000 },
      startHold(event) {
        sandbox.hold = beginHold(createHold(), 0, event.clientX, event.clientY).hold;
        sandbox.activePointerId = sandbox.holdPointerId = event.pointerId;
        sandbox.live = true;
      },
      applyRelease() { sandbox.settled = true; sandbox.live = false; },
      cancelUnsettledHold() { sandbox.applyRelease(); },
      setLiveContact(value) { sandbox.live = value; },
    };
    for (const key of ['Hold', 'ActivePointerId', 'HoldPointerId', 'ReadyPointerId', 'PrimerPointerId', 'GestureConsumed', 'ReadyFeedbackShown']) {
      sandbox['set' + key] = value => { sandbox[key[0].toLowerCase() + key.slice(1)] = value; };
    }
    vm.createContext(sandbox);
    vm.runInContext(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export[\s\S]*?;\n/gm, ''), sandbox);
    const event = x => ({ pointerId: 1, clientX: x, clientY: 634 });
    sandbox.onPointerDown(event(rect.left + rect.width + 30));
    assert.equal(sandbox.hold.phase, 'idle', 'a hold cannot start 30px outside the pad');
    sandbox.pointers.clear();
    const origin = 238;
    sandbox.onPointerDown(event(origin));
    sandbox.onPointerMove(event(origin + 60));
    assert.equal(origin + 60, rect.left + rect.width + 30);
    assert.equal(sandbox.live, true, '30px outside the pad stays inside the 76px hold range');
    let result = releaseHold(createDefaultState(), sandbox.hold, 3000, origin + 60, 634);
    assert.equal(result.counted, true);
    assert.equal(result.state.attemptCount, 1);
    sandbox.settled = false;
    sandbox.live = false;
    sandbox.pointers.clear();
    sandbox.activePointerId = null;
    sandbox.holdPointerId = null;
    sandbox.hold = createHold();
    sandbox.onPointerDown(event(origin));
    sandbox.onPointerMove(event(origin + 90));
    assert.equal(sandbox.live, false, '90px drift cancels the recorder hold');
    result = releaseHold(createDefaultState(), sandbox.hold, 3000, origin + 90, 634);
    assert.equal(result.counted, false);
    assert.equal(result.state.attemptCount, 0);
  });
}
