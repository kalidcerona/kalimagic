import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const appFile = path.resolve(import.meta.dirname, '../../zz6/app.js');

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

function element(id) {
  const listeners = new Map();
  return {
    id,
    hidden: id === 'settings-gesture-guide',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    open: false,
    src: '',
    className: '',
    inert: false,
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    append() {},
    appendChild(child) { return child; },
    replaceChildren() {},
    focus() {},
    blur() {},
    contains() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() { return { width: 390, height: 844, top: 0, left: 0, right: 390, bottom: 844 }; },
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() { return false; },
  };
}

async function boot({ storage = memoryStorage(), permission = 'granted' } = {}) {
  // Motion tests begin after the separately verified first-run guide is acknowledged.
  storage.setItem('tobira.settings-gesture-guide.v1', 'done');
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  const listeners = [];
  let frames = 0;
  let permits = 0;
  let hooks = null;
  const sandbox = {
    console,
    URL, URLSearchParams, TextEncoder, TextDecoder, queueMicrotask,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Object, Array, String, Number, Boolean, Symbol, Date, RegExp,
    Error, TypeError, RangeError, Promise, Map, Set, WeakMap, WeakSet, Proxy, Reflect,
    parseInt, parseFloat, isNaN, isFinite, decodeURIComponent, encodeURIComponent,
    Intl, structuredClone,
    HTMLElement: class HTMLElement {},
    Element: class Element {},
    performance: { now: () => 0 },
    requestAnimationFrame() { frames += 1; return frames; },
    cancelAnimationFrame() {},
    localStorage: storage,
    sessionStorage: memoryStorage(),
    navigator: {},
    isSecureContext: true,
    innerWidth: 390,
    innerHeight: 844,
    document: {
      title: '',
      readyState: 'complete',
      activeElement: null,
      documentElement: element('documentElement'),
      body: element('body'),
      getElementById: (id) => el(id),
      querySelector: (selector) => {
        const match = String(selector).match(/#([A-Za-z0-9_-]+)/);
        return el(match ? match[1] : selector);
      },
      querySelectorAll: () => [],
      createElement: (tag) => el(`${tag}-${elements.size}`),
      addEventListener() {},
    },
    DeviceOrientationEvent: { requestPermission() { permits += 1; return Promise.resolve(permission); } },
    DeviceMotionEvent: { requestPermission() { permits += 1; return Promise.resolve(permission); } },
    addEventListener(type, fn) { listeners.push({ type, fn }); },
    removeEventListener() {},
    __TOBIRA_TEST_HOOKS__(api) { hooks = api; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const imports = {
    ...await import(pathToFileURL(path.join(path.dirname(appFile), 'logic.js')).href),
    ...await import(pathToFileURL(path.join(path.dirname(appFile), 'sensor-motion.js')).href),
  };
  Object.assign(sandbox, imports);
  const source = fs.readFileSync(appFile, 'utf8')
    .replace(/^import \{[\s\S]*?\} from '\.\/logic\.js';\n/, '')
    .replace(/^import \{[^\n]*\} from '\.\/sensor-motion\.js';\n/, '');
  vm.runInContext(`${source}\n__TOBIRA_TEST_HOOKS__({motionEnabled: () => motionEnabled, phase: () => phase, objectLive: () => objectLive, effects: () => motionEffects});`, vm.createContext(sandbox), { filename: appFile });
  function fire(type, event) {
    for (const item of listeners) if (item.type === type) item.fn(event);
  }
  return {
    hooks,
    fire,
    listeners,
    permits: () => permits,
    frames: () => frames,
  };
}

function tap(runtime, event) {
  runtime.fire('pointerdown', event);
  runtime.fire('pointerup', event);
}

test('cold start does not ask for motion until the first trusted performance tap', async () => {
  const runtime = await boot();
  assert.equal(runtime.hooks.motionEnabled(), false);
  assert.equal(runtime.permits(), 0);
  assert.equal(runtime.hooks.phase(), 'awaiting');
  const before = runtime.frames();
  tap(runtime, { isTrusted: false, pointerId: 1, pointerType: 'touch', button: 0, clientX: 120, clientY: 240, cancelable: true, target: {}, preventDefault() {}, timeStamp: 5 });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runtime.permits(), 0);
  assert.equal(runtime.hooks.objectLive(), true);
  const trusted = { isTrusted: true, pointerId: 2, pointerType: 'touch', button: 0, clientX: 140, clientY: 260, cancelable: true, target: {}, preventDefault() {}, timeStamp: 20 };
  runtime.fire('pointerdown', trusted);
  assert.equal(runtime.permits(), 2);
  runtime.fire('pointerup', trusted);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runtime.hooks.motionEnabled(), true);
  assert.ok(runtime.frames() > before);
  assert.ok(runtime.listeners.some((item) => item.type === 'deviceorientation'));
  const again = runtime.permits();
  tap(runtime, { ...trusted, pointerId: 3 });
  await Promise.resolve();
  assert.equal(runtime.permits(), again);
});

test('a denied or disabled sensor leaves the coin draggable and does not ask twice', async () => {
  const denied = await boot({ permission: 'denied' });
  const event = { isTrusted: true, pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 200, cancelable: true, target: {}, preventDefault() {}, timeStamp: 1 };
  tap(denied, event);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(denied.hooks.motionEnabled(), false);
  assert.equal(denied.hooks.objectLive(), true);
  const asked = denied.permits();
  tap(denied, { ...event, pointerId: 4, clientX: 110, clientY: 210 });
  await Promise.resolve();
  assert.equal(denied.permits(), asked);

  const off = await boot({
    storage: memoryStorage({
      'tobira.motion-effects.v1': JSON.stringify({ tilt: false, exit: false, breakthrough: false, wobble: false, edges: [] }),
    }),
  });
  tap(off, event);
  await Promise.resolve();
  assert.equal(off.permits(), 0);
  assert.equal(off.hooks.objectLive(), true);
  assert.equal(off.hooks.effects().tilt, false);
});
