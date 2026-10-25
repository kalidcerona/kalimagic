import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Loads zz6/app.js and its real imports as separate ES modules (no concatenation, no shared scope).
// A module that uses an identifier it does not import throws ReferenceError here, as it does in the browser.
// Drives boot, gesture guide, wake lock, install prompt, the performance and crack flow, the two-finger
// settings swipe and settings saves through the listeners the app registers on the stub DOM.
// TOBIRA_ROOT lets a mutation check point the same test at a scratch copy.
const root = process.env.TOBIRA_ROOT ? pathToFileURL(`${process.env.TOBIRA_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz6/', import.meta.url);
// The friend snapshot uses its own storage prefix and a Shift+Esc exit.
const P = readFileSync(new URL('logic.js', root), 'utf8').includes("'friend-tobira.v1'") ? 'friend-tobira.' : 'tobira.';

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
afterEach(() => { assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error'); });

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// Event registry shared by elements, document and window. emit() awaits async listeners so a rejection fails the step.
function listenerHost(target) {
  target.listeners = {};
  target.addEventListener = (type, fn) => { (target.listeners[type] ||= []).push(fn); };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item !== fn); };
}
async function emit(target, type, event = {}) {
  const fns = [...(target.listeners[type] || [])];
  assert.ok(fns.length > 0, `a listener is registered for ${type}`);
  await Promise.all(fns.map((fn) => fn(event)));
}

let document;
class FakeElement {
  constructor(tag = 'div', id = '') {
    this.tag = tag; this.id = id; this.attrs = new Map(); this.classes = new Set(); this.style = {}; this.dataset = {};
    this.children = []; this.parentElement = null; this.hidden = false; this.value = ''; this.checked = false;
    this.disabled = false; this.textContent = ''; this.rect = null; this.offsetWidth = 0;
    listenerHost(this);
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
    };
  }
  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null; }
  removeAttribute(key) { this.attrs.delete(key); }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
    const attr = selector.match(/^\[([\w-]+)="([^"]*)"\]$/);
    if (attr) return (attr[1].startsWith('data-') ? this.dataset[attr[1].slice(5)] : this.getAttribute(attr[1])) === attr[2];
    return false;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  setPointerCapture() {}
  hasPointerCapture() { return false; }
  releasePointerCapture() {}
}

function stubBrowser() {
  const local = new Map();
  const session = new Map();
  const store = (map) => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  });
  const byId = new Map();
  const loose = new Map();
  const element = (id, tag) => { if (!byId.has(id)) byId.set(id, new FakeElement(tag, id)); return byId.get(id); };

  const stage = element('stage');
  stage.classes.add('stage');
  stage.rect = { left: 0, top: 0, width: 400, height: 800 };
  const coin = element('coin');
  coin.classes.add('coin');
  stage.append(coin);
  const edgeGroup = element('edge-group');
  const edgeButtons = Object.fromEntries(['top', 'left', 'right', 'bottom'].map((edge) => {
    const button = new FakeElement('button');
    button.classes.add('edge');
    button.dataset.edge = edge;
    edgeGroup.append(button);
    return [edge, button];
  }));

  document = {
    activeElement: null, visibilityState: 'visible', title: '',
    body: new FakeElement('body'),
    documentElement: new FakeElement('html'),
    getElementById: (id) => element(id),
    querySelector(selector) {
      if (/^#[\w-]+$/.test(selector)) return element(selector.slice(1));
      if (!loose.has(selector)) loose.set(selector, new FakeElement());
      return loose.get(selector);
    },
    createElement: (tag) => new FakeElement(tag),
  };
  listenerHost(document);

  class AudioContextStub {
    constructor() { this.state = 'suspended'; AudioContextStub.instances.push(this); this.resumed = 0; }
    resume() { this.resumed += 1; return Promise.resolve(); }
  }
  AudioContextStub.instances = [];

  const wake = { requests: [] };
  const navigator = {
    userAgent: 'node-test', maxTouchPoints: 0, registered: [],
    wakeLock: {
      request: async (type) => {
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { lock.handlers.push(fn); };
        lock.release = async () => { lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        wake.requests.push(lock);
        return lock;
      },
    },
    serviceWorker: { register: async (url, options) => { navigator.registered.push({ url, options }); } },
  };

  const frames = new Map();
  let frameId = 0;
  const window = {
    innerWidth: 400, innerHeight: 800, AudioContext: AudioContextStub,
    DeviceMotionEvent: class {}, DeviceOrientationEvent: class {},
    setTimeout, clearTimeout,
    requestAnimationFrame: (fn) => { frameId += 1; frames.set(frameId, fn); return frameId; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
  };
  listenerHost(window);

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', { hostname: 'example.test', search: '' });
  const localStore = store(local);
  define('localStorage', localStore);
  define('sessionStorage', store(session));
  define('matchMedia', () => ({ matches: false }));
  define('Element', FakeElement);
  define('HTMLElement', FakeElement);
  return { local: localStore, session, stage, coin, edgeGroup, edgeButtons, wake, navigator, window, el: (id) => element(id), AudioContextStub };
}

const env = stubBrowser();
const stored = (key) => JSON.parse(env.local.getItem(key));
const pointer = (id, x, y, extra = {}) => ({
  pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, screenX: x, screenY: y,
  target: env.stage, cancelable: true, isTrusted: false, timeStamp: 0, preventDefault() {}, ...extra,
});
async function twoFingerSwipe(dy) {
  const starts = [[11, 100, 300], [12, 300, 300]];
  for (const [id, x, y] of starts) await emit(env.window, 'pointerdown', pointer(id, x, y));
  for (const [id, x, y] of starts) await emit(env.window, 'pointermove', pointer(id, x, y + dy));
  for (const [id, x, y] of starts) await emit(env.window, 'pointerup', pointer(id, x, y + dy, { type: 'pointerup' }));
}

let logic;
test('boot imports the real zz6 modules and reaches the ready performance stage', async () => {
  logic = await import(new URL('logic.js', root));
  await import(new URL('app.js', root));
  await settle();
  assert.equal(document.body.dataset.mode, 'performance');
  assert.equal(document.title, '동전');
  assert.equal(env.el('settings').getAttribute('inert'), '');
  assert.equal(env.el('settings').inert, true, 'settings is inert while performing');
  assert.equal(env.el('recovery').hidden, true, 'no recovery banner on a clean start');
  assert.equal(env.coin.classList.contains('is-gone'), true, 'ready stage has no object yet');
  assert.equal(env.coin.style.visibility, 'hidden');
  assert.match(env.el('coin-art').src, /coin-kennedy\.webp$/, 'default object image is shown');
  assert.equal(env.el('preset-list').children.length, 1);
  assert.match(env.el('preset-list').children[0].children[0].textContent, /^1\. /);
  assert.equal(env.local.getItem(`${P}v1`), null, 'ready start does not write the saved mode');
  assert.deepEqual(env.navigator.registered, [{ url: './sw.js', options: { scope: './' } }]);
  assert.equal(typeof window.MagicTobiraAppearance.read, 'function');
  assert.equal(window.MagicTobiraAppearance.read().coinSize, logic.defaultState().presets[0].coinSize);
});

test('wake lock is requested on boot, released when hidden and requested again when visible', async () => {
  assert.equal(env.wake.requests.length, 1);
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
  document.visibilityState = 'hidden';
  await emit(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests[0].released, true, 'hidden page releases the lock');
  assert.equal(env.wake.requests.length, 1);
  document.visibilityState = 'visible';
  await emit(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2, 'visible page requests a new lock');
  assert.equal(env.wake.requests[1].released, false);
});

test('install prompt shows instructions, then the accepted native prompt message', async () => {
  await import(new URL('install-prompt.js', root));
  const panel = document.querySelector('#install-panel, .install-panel');
  const action = document.querySelector('#install-action, [data-install-action]');
  const instructions = document.querySelector('#install-instructions, [data-install-instructions]');
  assert.equal(panel.hidden, false);
  assert.equal(instructions.hidden, false);
  assert.equal(action.hidden, true);
  assert.match(instructions.textContent, /^브라우저 메뉴에서/);

  let prompted = 0;
  let prevented = 0;
  const native = (outcome) => ({
    preventDefault() { prevented += 1; },
    prompt: async () => { prompted += 1; },
    userChoice: Promise.resolve({ outcome }),
  });
  await emit(env.window, 'beforeinstallprompt', native('accepted'));
  assert.equal(prevented, 1);
  assert.equal(action.hidden, false, 'install button appears');
  assert.equal(instructions.hidden, true);
  await emit(action, 'click');
  assert.equal(prompted, 1);
  assert.match(instructions.textContent, /^설치 요청을 보냈습니다\./);
  assert.equal(action.hidden, true);

  await emit(env.window, 'beforeinstallprompt', native('dismissed'));
  await emit(action, 'click');
  assert.equal(prompted, 2);
  assert.match(instructions.textContent, /^브라우저 메뉴에서/, 'a dismissed prompt falls back to instructions');
});

test('gesture guide blocks the stage until dismissed, then remembers the dismissal', async () => {
  const guide = env.el('settings-gesture-guide');
  const dismiss = env.el('settings-gesture-dismiss');
  assert.equal(guide.hidden, false, 'guide is shown on the first ready stage');
  assert.equal(document.activeElement, dismiss, 'focus moves to the dismiss button');
  assert.equal(env.local.getItem(`${P}settings-gesture-guide.v1`), null);

  await emit(env.window, 'pointerdown', pointer(1, 200, 300));
  await emit(env.window, 'pointermove', pointer(1, 200, 340));
  await emit(env.window, 'pointerup', pointer(1, 200, 340, { type: 'pointerup' }));
  assert.equal(env.coin.classList.contains('is-gone'), true, 'stage gestures are ignored while the guide is open');

  let stopped = 0;
  await emit(guide, 'touchstart', { stopPropagation() { stopped += 1; } });
  assert.equal(stopped, 1, 'touches on the guide do not reach the stage');
  await emit(dismiss, 'click');
  assert.equal(guide.hidden, true);
  assert.equal(env.local.getItem(`${P}settings-gesture-guide.v1`), 'done');
  assert.equal(env.AudioContextStub.instances.length, 1, 'dismissal unlocks audio');
  assert.ok(env.AudioContextStub.instances[0].resumed >= 1);
});

test('performance: a trusted tap enables motion, a swipe reveals the object, a snap cracks the screen, a two-finger swipe up resets', async () => {
  await emit(env.window, 'pointerdown', pointer(1, 200, 300, { isTrusted: true }));
  await settle();
  assert.equal(env.el('motion-note').textContent, '선택한 움직임 연출을 사용할 수 있습니다.');
  assert.equal(env.window.listeners.devicemotion.length, 1);
  await emit(env.window, 'pointermove', pointer(1, 200, 340));
  await emit(env.window, 'pointerup', pointer(1, 200, 340, { type: 'pointerup' }));

  const preset = logic.defaultState().presets[0];
  const { radius } = logic.coinMetrics(preset, { width: 400, height: 800 });
  assert.equal(env.coin.classList.contains('is-gone'), false, 'object is revealed');
  assert.equal(env.coin.style.visibility, '');
  assert.equal(env.coin.style.opacity, '1.0000');
  assert.equal(env.coin.style.transform,
    `translate3d(${(200 - radius).toFixed(3)}px, ${(340 - radius).toFixed(3)}px, 0) rotate(0.000deg) scale(1.0000)`);

  await emit(env.window, 'devicemotion', { acceleration: { x: 30, y: 0, z: 0 }, timeStamp: 1 });
  assert.equal(env.stage.classList.contains('is-breaking'), true, 'crack effect is shown');
  assert.equal(env.stage.classList.contains('is-breaking-play'), true);
  assert.equal(env.el('breakthrough').style.left, '50.0000%');
  assert.equal(env.el('breakthrough').style.top, '42.5000%');
  assert.equal(env.coin.classList.contains('is-gone'), true, 'object disappears with the crack');
  assert.equal(env.session.get(`${P}session-gone`), '1');
  assert.equal(env.session.get(`${P}session-crack`), '1');
  assert.equal(env.session.get(`${P}session-crack-at`), '0.500000,0.425000');

  await twoFingerSwipe(-140);
  assert.equal(env.stage.classList.contains('is-breaking'), false, 'two-finger swipe up clears the crack');
  assert.equal(env.el('breakthrough').style.left, '');
  assert.equal(env.session.has(`${P}session-crack`), false);
  assert.equal(env.session.has(`${P}session-gone`), false);
  assert.equal(env.coin.classList.contains('is-gone'), true, 'object is back to the empty ready stage');
  assert.equal(document.body.dataset.mode, 'performance');
});

test('two-finger downward swipe opens settings and releases the wake lock', async () => {
  await twoFingerSwipe(140);
  assert.equal(document.body.dataset.mode, 'settings');
  assert.equal(document.title, 'TOBIRA');
  assert.equal(env.el('settings').getAttribute('inert'), null);
  assert.equal(env.el('settings').inert, false);
  assert.equal(stored(`${P}v1`).mode, 'settings', 'entering settings saves the mode');
  assert.equal(env.el('selected-preset-name').textContent, stored(`${P}v1`).presets[0].name);
  assert.equal(env.wake.requests.at(-1).released, true, 'settings does not hold the screen awake');
});

test('settings changes are saved through the state store', async () => {
  const size = env.el('coin-size');
  size.value = '0.5';
  await emit(size, 'input');
  assert.equal(stored(`${P}v1`).presets[0].coinSize, 0.5);
  assert.equal(env.el('coin-size-value').textContent, '50%');

  await emit(env.edgeGroup, 'click', { target: env.edgeButtons.top });
  assert.equal(stored(`${P}v1`).presets[0].exitEdge, 'top');
  assert.equal(env.edgeButtons.top.getAttribute('aria-checked'), 'true');
  let prevented = 0;
  await emit(env.edgeGroup, 'keydown', { key: 'ArrowRight', preventDefault() { prevented += 1; } });
  assert.equal(prevented, 1);
  assert.equal(stored(`${P}v1`).presets[0].exitEdge, 'left', 'arrow key moves to the next edge');
  assert.equal(document.activeElement, env.edgeButtons.left);

  const name = env.el('preset-name');
  name.value = '첫째';
  await emit(name, 'input');
  assert.equal(stored(`${P}v1`).presets[0].name, '첫째');
  assert.equal(env.el('preset-list').children[0].children[0].textContent, '1. 첫째');

  await emit(env.el('add-preset'), 'click');
  assert.equal(stored(`${P}v1`).presets.length, 2);
  assert.equal(stored(`${P}v1`).selectedId, stored(`${P}v1`).presets[1].id);
  assert.equal(env.el('preset-list').children.length, 2);
  const first = env.el('preset-list').children[0].children[0];
  await emit(first, 'click');
  assert.equal(stored(`${P}v1`).selectedId, stored(`${P}v1`).presets[0].id);
  assert.equal(env.el('preset-list').children[0].children[0].getAttribute('aria-pressed'), 'true');
  await emit(env.el('preset-list').children[1].children[0], 'click');
  await emit(env.el('delete-preset'), 'click');
  assert.equal(env.el('form-note').textContent, '한 번 더 누르면 이 프리셋을 삭제합니다.');
  await emit(env.el('delete-preset'), 'click');
  assert.equal(stored(`${P}v1`).presets.length, 1);
  assert.equal(stored(`${P}v1`).presets[0].name, '첫째');

  const wobble = env.el('motion-wobble');
  wobble.checked = true;
  await emit(wobble, 'change');
  assert.equal(stored(`${P}motion-effects.v1`).wobble, true);
  const exit = env.el('motion-exit');
  exit.checked = true;
  await emit(exit, 'change');
  assert.equal(stored(`${P}motion-effects.v1`).exit, true);
  assert.equal(stored(`${P}motion-effects.v1`).tilt, true, 'wall exit also turns tilt on');
  assert.equal(env.el('motion-enabled').checked, true);

  const volume = env.el('motion-wall-volume');
  volume.value = '40';
  await emit(volume, 'input');
  assert.equal(env.el('motion-wall-volume-value').textContent, '40%');
  await emit(volume, 'change');
  assert.equal(stored(`${P}motion-effects.v1`).wallVolume, 40);
});

test('start button returns to the performance stage, saves the mode and requests the wake lock', async () => {
  const before = env.wake.requests.length;
  const start = env.el('start-show');
  await emit(start, 'click');
  await settle();
  assert.equal(start.disabled, false);
  assert.equal(document.body.dataset.mode, 'performance');
  assert.equal(stored(`${P}v1`).mode, 'performance');
  assert.equal(env.wake.requests.length, before + 1);
  assert.equal(env.wake.requests.at(-1).released, false);
  assert.equal(env.el('settings').getAttribute('inert'), '');
  assert.equal(env.el('settings-gesture-guide').hidden, true, 'dismissed guide stays hidden');
  console.error = originalConsoleError;
});
