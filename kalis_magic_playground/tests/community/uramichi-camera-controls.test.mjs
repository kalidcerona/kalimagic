import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { initialControls, controlState, timerLabel, createCameraRecovery } from '../../zz15/camera-controls.mjs';

function clock() {
  let time = 10000, id = 0, restarts = 0;
  const tasks = new Map();
  const recovery = createCameraRecovery({ now: () => time, wanted: () => true,
    restart: () => { restarts++; }, schedule: (fn, ms) => { tasks.set(++id, { fn, at: time + ms }); return id; }, cancel: (key) => tasks.delete(key) });
  return { recovery, tasks, get restarts() { return restarts; }, advance(ms) {
    time += ms;
    for (const [key, task] of [...tasks]) if (task.at <= time) { tasks.delete(key); task.fn(); }
  } };
}
test('second end within two seconds schedules exactly one restart at the boundary', () => {
  const c = clock(); c.recovery.ended(); c.advance(0);
  assert.equal(c.restarts, 1);
  c.advance(100); c.recovery.ended(); c.recovery.ended();
  assert.equal(c.tasks.size, 1);
  c.advance(1899); assert.equal(c.restarts, 1);
  c.advance(1); assert.equal(c.restarts, 2); assert.equal(c.tasks.size, 0);
});
test('repeated ends back off and stop after five retries; visibility reset permits recovery', () => {
  const c = clock();
  for (const delay of [0, 2000, 4000, 8000, 16000]) { c.recovery.ended(); c.advance(delay); }
  assert.equal(c.restarts, 5);
  for (let i = 0; i < 30; i++) c.recovery.ended();
  assert.equal(c.tasks.size, 0);
  c.recovery.reset(); c.recovery.ended(); c.advance(0); assert.equal(c.restarts, 6);
  c.recovery.ended(); c.recovery.cancel(); c.advance(10000); assert.equal(c.restarts, 6);
});
test('healthy camera resets the recovery burst budget', () => {
  const c = clock(); c.recovery.ended(); c.advance(0); c.advance(30000);
  c.recovery.ended(); c.advance(0); assert.equal(c.restarts, 2);
});
test('mode changes, gallery and backgrounding stop the simulated recording', () => {
  let s = controlState(initialControls(), { type: 'mode', mode: 'video' });
  s = controlState(s, { type: 'shutter', now: 100 });
  assert.equal(s.recording, true); assert.equal(timerLabel(s.started, 65100), '01:05');
  assert.equal(controlState(s, { type: 'shutter', now: 200 }).recording, false);
  for (const action of [{ type: 'mode', mode: 'portrait' }, { type: 'open' }, { type: 'stop' }]) assert.equal(controlState(s, action).recording, false);
  assert.equal(controlState(initialControls(), { type: 'shutter', now: 0 }).recording, false);
});
test('album is capped at twenty and stepping wraps safely including an empty gallery', () => {
  let s = initialControls();
  assert.equal(controlState(s, { type: 'step', delta: 1 }).index, -1);
  assert.equal(controlState(s, { type: 'open' }).gallery, true);
  for (let i = 0; i < 25; i++) s = controlState(s, { type: 'capture', url: `blob:${i}` });
  assert.equal(s.album.length, 20); assert.equal(s.album[0], 'blob:5'); assert.equal(s.index, 19);
  s = controlState(s, { type: 'step', delta: 1 }); assert.equal(s.index, 0);
  s = controlState(s, { type: 'step', delta: -1 }); assert.equal(s.index, 19);
});
test('preset write reports failure without replacing the saved in-memory categories', () => {
  const src = readFileSync(new URL('../../zz15/presets.mjs', import.meta.url), 'utf8');
  const write = src.slice(src.indexOf('function write('), src.indexOf('function readSettings'));
  const save = src.slice(src.indexOf('  saveCategories(list)'), src.indexOf('  toast(message)'));
  let fail = true;
  const context = vm.createContext({ localStorage: { setItem() { if (fail) throw new Error('quota'); } },
    KEY: { presets: 'p', recent: 'r' }, C: { encodeCategories: JSON.stringify, pruneRecents: () => [], encodeRecents: JSON.stringify }, picker: { render() {} } });
  vm.runInContext(`${write}\nglobalThis.store = { cats: ['old'], recents: [], ${save} };`, context);
  assert.equal(context.store.saveCategories(['new']), false);
  assert.equal(context.store.cats[0], 'old');
  fail = false; assert.equal(context.store.saveCategories(['new']), true);
  assert.equal(context.store.cats[0], 'new');
});

test('failed recovery does not bypass backoff through the stale-start microtask', async () => {
  const src = readFileSync(new URL('../../zz15/camera.mjs', import.meta.url), 'utf8');
  const body = src.slice(0, src.indexOf("$('gateBtn').addEventListener")).replace(/^import .*;\n/gm, '');
  const microtasks = [], timers = [], elements = new Map();
  const context = vm.createContext({ createCameraRecovery, DEBUG: false, KEY: { intro: 'intro' }, read: () => '1',
    document: { visibilityState: 'visible' },
    navigator: { mediaDevices: { async getUserMedia() { throw new Error('busy'); } } },
    $(id) { if (!elements.has(id)) elements.set(id, { hidden: true, srcObject: null }); return elements.get(id); },
    queueMicrotask: (fn) => microtasks.push(fn), hideChip() {},
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
  });
  // Inject fake timers into the recovery factory as well as the camera module.
  context.createCameraRecovery = (options) => createCameraRecovery({ ...options,
    schedule: context.setTimeout, cancel: context.clearTimeout });
  vm.runInContext(`${body}\nsilentStart = true; globalThis.start = startCamera;`, context);
  await context.start();
  assert.equal(microtasks.length, 0);
  assert.equal(timers.length, 1);
  assert.equal(elements.get('gate').hidden, true);
});

test('camera switches both directions and honors a single-camera device actual facing', async () => {
  const src = readFileSync(new URL('../../zz15/camera.mjs', import.meta.url), 'utf8');
  const body = src.slice(0, src.indexOf("$('gateBtn').addEventListener")).replace(/^import .*;\n/gm, '');
  const requested = [], stopped = [], mirrored = [], elements = new Map();
  let oneCamera = false;
  const context = vm.createContext({ createCameraRecovery, DEBUG: false, KEY: { intro: 'intro' }, read: () => '1',
    document: { visibilityState: 'visible' },
    navigator: { mediaDevices: { async getUserMedia(options) {
      const facing = options.video.facingMode.ideal; requested.push(facing);
      const track = { stop() { stopped.push(facing); }, getSettings: () => ({ facingMode: oneCamera ? 'environment' : facing }), addEventListener() {} };
      return { getTracks: () => [track], getVideoTracks: () => [track] };
    } } },
    $(id) { if (!elements.has(id)) elements.set(id, { hidden: true, srcObject: null, play: async () => {}, classList: { toggle(name, on) { if (id === 'video') mirrored.push(on); } } }); return elements.get(id); },
    queueMicrotask, hideChip() {}, setTimeout, clearTimeout,
  });
  vm.runInContext(`${body}\nrunDetection = () => {}; globalThis.api = { startCamera, switchCamera, stopCamera };`, context);
  await context.api.startCamera(); await context.api.switchCamera(); await context.api.switchCamera();
  assert.deepEqual(requested, ['environment', 'user', 'environment']);
  assert.deepEqual(mirrored, [false, true, false]);
  assert.equal(stopped.length, 2);
  oneCamera = true; await context.api.switchCamera();
  assert.equal(mirrored.at(-1), false);
  assert.equal(elements.get('gate').hidden, true);
  context.api.stopCamera();
});

test('editor save notice follows the persistence result', () => {
  const src = readFileSync(new URL('../../zz15/picker.mjs', import.meta.url), 'utf8');
  const handler = src.match(/onclick: (\(\) => \{ const saved = store\.saveCategories[\s\S]*?render\(\); \})/)[1];
  for (const saved of [false, true]) {
    const messages = [];
    const context = vm.createContext({ draft: [], clone: (value) => value, render() {},
      store: { saveCategories: () => saved, toast: (message) => messages.push(message) } });
    vm.runInContext(`(${handler})()`, context);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].startsWith(saved ? '저장했습니다' : '저장하지 못했습니다'), true);
  }
});
