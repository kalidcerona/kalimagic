import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Loads USOTSUKI (zz7/detector.js) and its real imports as separate ES modules: no concatenation, no
// shared scope. A module that uses an identifier it does not import throws ReferenceError here, as it
// does in the browser. The classic scripts (first-run-guide.js) is evaluated as a script.
// Drives boot, first-run guide, install prompt, wake lock on visibility, the two-finger settings swipe,
// settings saves, vibration, sound, the detector hold flow and the wood-drum (heartbeat) theme through
// the listeners the app registers on a stub DOM.
// usotsuki-resolve-hooks.mjs is not needed: it only carries a `?tag` query to feature modules so one
// process can boot several fresh apps. This file imports the app once with no query.
// USOTSUKI_ROOT selects another root, for example distribution-snapshots/usotsuki.
const root = process.env.USOTSUKI_ROOT ? pathToFileURL(`${process.env.USOTSUKI_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz7/', import.meta.url);

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
afterEach(async () => {
  await settle(5);
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
});

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function listenerHost(target) {
  target.listeners = {};
  target.addEventListener = (type, fn, options) => {
    const entry = options && options.once ? (event) => { target.removeEventListener(type, entry); return fn(event); } : fn;
    (target.listeners[type] ||= []).push(entry);
  };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item !== fn); };
}
// emit() awaits async listeners so a throw or rejection fails the step that caused it.
async function emit(target, type, event = {}) {
  const fns = [...(target.listeners[type] || [])];
  assert.ok(fns.length > 0, `a listener is registered for ${type}`);
  await Promise.all(fns.map((fn) => fn(event)));
}

let document;
class FakeElement {
  constructor(tag = 'div', id = '') {
    this.tag = tag; this.id = id; this.attrs = new Map(); this.classes = new Set(); this.style = { setProperty() {} };
    this.dataset = {}; this.children = []; this.parentElement = null; this.hidden = false; this.value = '';
    this.checked = false; this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.rect = null;
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
  appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (selector.startsWith('#') && node.id === selector.slice(1)) return node;
    return null;
  }
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  }
  setPointerCapture() {}
}

function stubBrowser() {
  const store = new Map();
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  const nodes = new Map();
  // One element per #id (so '#a, .b' and '#a' are the same node), one per other selector.
  const node = (selector) => {
    const id = selector.match(/^#([\w-]+)/)?.[1] || '';
    const key = id ? `#${id}` : selector;
    if (!nodes.has(key)) nodes.set(key, new FakeElement('div', id));
    return nodes.get(key);
  };
  const screen = node('#performance-screen');
  screen.dataset.displayTheme = 'green';
  const button = node('#detector-button');
  button.rect = { left: 100, top: 500, width: 200, height: 200 };
  screen.append(button);
  node('#settings-screen').hidden = true;
  for (const id of ['#install-panel', '#install-action', '#install-instructions', '#vibration-capability']) node(id).hidden = true;
  node('#truth-attempt').value = '4';
  node('#sound-enabled').checked = true;
  node('#vibration-level').value = 'medium';
  node('#display-theme').value = 'green';
  node('#scan-duration').value = '3';
  node('#vibration-settings');

  const body = new FakeElement('body');
  body.dataset.magicApp = 'usotsuki';
  document = {
    activeElement: null, visibilityState: 'visible', hidden: false, readyState: 'interactive', title: '거짓말 탐지기',
    body, head: new FakeElement('head'), documentElement: new FakeElement('html'),
    querySelector: node,
    getElementById: () => null,
    createElement: (tag) => new FakeElement(tag),
  };
  listenerHost(document);

  class AudioContextStub {
    constructor() {
      this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {};
      this.oscillators = []; this.closed = false; AudioContextStub.instances.push(this);
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {} }; }
    createGain() {
      const param = { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} };
      return { gain: param, connect() {}, disconnect() {} };
    }
    createOscillator() {
      const osc = { frequencies: [], started: false, connect() {}, disconnect() {}, stop() {}, start() { osc.started = true; } };
      osc.frequency = { setValueAtTime: (value) => osc.frequencies.push(value), linearRampToValueAtTime() {} };
      this.oscillators.push(osc);
      return osc;
    }
  }
  AudioContextStub.instances = [];

  const wake = { requests: [] };
  const vibrations = [];
  const navigator = {
    userAgent: 'node-test', maxTouchPoints: 0, registered: [], userActivation: { hasBeenActive: false },
    vibrate: (pattern) => { vibrations.push(pattern); return true; },
    wakeLock: {
      request: async (type) => {
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { lock.handlers.push(fn); };
        lock.release = async () => { lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        wake.requests.push(lock);
        return lock;
      },
    },
    serviceWorker: { register: async (url) => { navigator.registered.push(url); } },
  };

  const frames = new Map();
  let frameId = 0;
  const window = {
    document, localStorage, AudioContext: AudioContextStub, matchMedia: () => ({ matches: false }),
    location: { hostname: 'example.test', search: '', pathname: '/zz7/index.html' },
    setTimeout, clearTimeout,
    requestAnimationFrame: (fn) => { frameId += 1; frames.set(frameId, fn); return frameId; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
  };
  listenerHost(window);
  const runFrames = (time) => { const due = [...frames.values()]; frames.clear(); due.forEach((fn) => fn(time)); };

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', window.location);
  define('localStorage', localStorage);
  define('matchMedia', window.matchMedia);
  define('Element', FakeElement);
  return { store, localStorage, node, screen, button, wake, vibrations, navigator, window, frames, runFrames, AudioContextStub };
}

const env = stubBrowser();
const pointer = (id, x, y, extra = {}) => ({
  pointerId: id, pointerType: 'touch', clientX: x, clientY: y, target: env.screen, cancelable: true, preventDefault() {}, ...extra,
});
const touch = (target, type, event) => emit(target, type, event);
async function twoFingerDownSwipe(dy) {
  const starts = [[21, 50, 100], [22, 350, 100]];
  for (const [id, x, y] of starts) await touch(env.screen, 'pointerdown', pointer(id, x, y));
  for (const [id, x, y] of starts) await touch(env.screen, 'pointermove', pointer(id, x, y + dy));
  for (const [id, x, y] of starts) await touch(env.screen, 'pointerup', pointer(id, x, y + dy));
}
async function holdButton(ms, id) {
  await touch(env.screen, 'pointerdown', pointer(id, 200, 600, { target: env.button }));
  if (ms) await settle(ms);
  await touch(env.screen, 'pointerup', pointer(id, 200, 600, { target: env.button }));
}

const node = env.node;
const stored = (key) => env.localStorage.getItem(key);
const state = (key) => JSON.parse(stored(key));
const TRUTH_ERROR = '진실 회차는 1부터 20 사이의 서로 다른 정수를 쉼표로 구분해 입력하세요. 예: 2,4';
let keys;

test('boot: guide script, install-prompt and detector.js load as separate modules and reach the ready stage', async () => {
  const storage = await import(new URL('storage.js', root));
  keys = { ...storage, THEME: readFileSync(fileURLToPath(new URL('controller-display-theme.js', root)), 'utf8').match(/DISPLAY_THEME_KEY = "([^"]+)"/)[1] };
  // Script order in index.html: deferred classic first-run-guide.js, then the module entries.
  runInThisContext(readFileSync(fileURLToPath(new URL('first-run-guide.js', root)), 'utf8'), { filename: 'first-run-guide.js' });
  await import(new URL('install-prompt.js', root));
  await import(new URL('detector.js', root));
  await settle();

  assert.equal(node('#settings-screen').hidden, true);
  assert.equal(node('#performance-screen').hidden, false);
  assert.equal(node('#detector-button').disabled, false);
  assert.equal(node('#test-indicator').textContent, '한 번 터치해 준비', 'no user activation yet, so the screen asks for one touch');
  assert.equal(env.screen.classList.contains('is-preparing'), true);
  assert.equal(node('#attempt-progress').textContent, '완료한 시도 0회. 공연을 시작하면 0이 됩니다.');
  assert.equal(node('.signal-mode').textContent, '대기');
  assert.equal(node('#detector-button').getAttribute('aria-label'), '검사를 시작하려면 3초간 누르기');
  assert.equal(node('#signal-time-end').textContent, '3s');
  assert.equal(node('#vibration-capability').getAttribute('data-vibration-capability'), 'available');
  assert.equal(node('#vibration-settings').hidden, false);
  assert.equal(node('#vibration-level').disabled, false);
  assert.equal(stored(keys.STATE_KEY), null, 'loading does not write the saved state');
  assert.deepEqual(env.navigator.registered, ['./sw.js']);
  assert.equal(env.wake.requests.length, 1, 'the ready performance screen requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
});

test('first-run guide: shown once, blocks stage touches, remembers dismissal, then the haptic prompt clears', async () => {
  const overlay = document.body.children.find((child) => child.className === 'first-run-guide');
  assert.ok(overlay, 'guide overlay is in the body');
  assert.equal(overlay.getAttribute('role'), 'dialog');
  const card = overlay.children[0];
  assert.equal(card.children[1].textContent, '설정 여는 방법');
  assert.equal(card.children[2].textContent, '손가락 두 개를 대고\n아래로 쓸어내리세요.\n설정 화면이 열립니다.');
  const dismiss = card.children[3];
  assert.equal(dismiss.textContent, '알겠어요');
  assert.equal(document.activeElement, dismiss);
  assert.equal(stored('first-settings-guide:v1:usotsuki:/zz7'), null);

  let stopped = 0;
  await emit(overlay, 'pointerdown', { stopPropagation() { stopped += 1; } });
  assert.equal(stopped, 1, 'touches on the guide do not reach the app');

  await emit(dismiss, 'click');
  assert.equal(document.body.children.includes(overlay), false, 'guide is removed');
  assert.equal(stored('first-settings-guide:v1:usotsuki:/zz7'), '1');

  // The dismissing click also reaches the document: the browser now has user activation.
  env.navigator.userActivation.hasBeenActive = true;
  await emit(document, 'click', { isTrusted: true });
  assert.equal(env.screen.classList.contains('is-preparing'), false);
  assert.equal(node('#test-indicator').textContent, '검사 대기 중');
  assert.equal(node('.signal-mode').textContent, '대기');
});

test('install prompt: instructions first, then the native prompt result, then appinstalled', async () => {
  const action = node('#install-action');
  const instructions = node('#install-instructions');
  assert.equal(node('#install-panel').hidden, false);
  assert.equal(instructions.hidden, false);
  assert.equal(action.hidden, true);
  assert.equal(instructions.textContent, '브라우저 메뉴에서 ‘홈 화면에 추가’ 또는 ‘설치’를 선택하세요.');

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
  assert.equal(instructions.textContent, '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.');
  assert.equal(action.hidden, true);

  await emit(env.window, 'beforeinstallprompt', native('dismissed'));
  await emit(action, 'click');
  assert.equal(prompted, 2);
  assert.equal(instructions.textContent, '브라우저 메뉴에서 ‘홈 화면에 추가’ 또는 ‘설치’를 선택하세요.', 'a dismissed prompt falls back to instructions');

  await emit(env.window, 'appinstalled');
  assert.equal(instructions.textContent, '설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.');
});

test('wake lock is released when the page is hidden and requested again when visible', async () => {
  document.hidden = true;
  document.visibilityState = 'hidden';
  await emit(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests[0].released, true, 'hidden page releases the lock');
  assert.equal(env.wake.requests.length, 1);
  assert.ok(env.vibrations.includes(0), 'hiding cancels vibration');
  document.hidden = false;
  document.visibilityState = 'visible';
  await emit(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2, 'visible page requests a new lock');
  assert.equal(env.wake.requests[1].released, false);
});

test('two-finger downward swipe outside the button gives ready feedback and opens settings', async () => {
  env.vibrations.length = 0;
  await touch(env.screen, 'pointerdown', pointer(21, 50, 100));
  assert.equal(node('#test-indicator').textContent, '준비완료', 'a touch off the button shows ready feedback');
  assert.deepEqual(env.vibrations, [18], 'ready feedback is one short pulse at the medium level');
  await touch(env.screen, 'pointerup', pointer(21, 50, 100));

  await twoFingerDownSwipe(50);
  assert.equal(node('#settings-screen').hidden, true, 'a short swipe does not open settings');
  await twoFingerDownSwipe(140);
  assert.equal(node('#settings-screen').hidden, false);
  assert.equal(node('#performance-screen').hidden, true);
  assert.equal(node('#detector-button').disabled, true);
  assert.equal(node('#truth-attempt').value, '4');
  assert.equal(env.wake.requests.at(-1).released, true, 'settings does not hold the screen awake');
});

test('settings changes are saved: truth attempts, sound, vibration, scan time, theme and reset', async () => {
  const truth = node('#truth-attempt');
  const status = node('#settings-status');
  truth.value = '0';
  await emit(truth, 'change');
  assert.equal(status.textContent, TRUTH_ERROR);
  assert.equal(truth.value, '4', 'an invalid value reverts');
  assert.equal(stored(keys.STATE_KEY), null);
  truth.value = '1,3';
  await emit(truth, 'change');
  assert.equal(status.textContent, '');
  assert.deepEqual(state(keys.STATE_KEY).settings.truthAttempts, [1, 3]);

  const sound = node('#sound-enabled');
  sound.checked = false;
  await emit(sound, 'change');
  assert.equal(stored(keys.SOUND_KEY), '0');
  sound.checked = true;
  await emit(sound, 'change');
  assert.equal(stored(keys.SOUND_KEY), '1');

  const vibration = node('#vibration-level');
  vibration.value = 'max';
  await emit(vibration, 'change');
  assert.equal(stored(keys.VIBRATION_KEY), 'max');

  const scan = node('#scan-duration');
  scan.value = '0.5';
  await emit(scan, 'change');
  assert.equal(stored(keys.SCAN_DURATION_KEY), '0.5');
  assert.equal(node('#scan-duration-help').textContent, '버튼을 0.5초 누르면 판정합니다. 0.5–10초, 0.5초 단위입니다.');
  assert.equal(node('#signal-time-end').textContent, '0.5s');
  assert.equal(node('#signal-time-mid').textContent, '0.25s');
  assert.equal(node('#detector-button').getAttribute('aria-label'), '검사를 시작하려면 0.5초간 누르기');

  const theme = node('#display-theme');
  await emit(theme, 'change', { target: Object.assign(theme, { value: 'wine' }) });
  assert.equal(stored(keys.THEME), 'wine');
  assert.equal(env.screen.dataset.displayTheme, 'wine');

  await emit(node('#reset-attempts'), 'click');
  assert.equal(status.textContent, '시도 횟수를 초기화했습니다.');
  assert.equal(state(keys.STATE_KEY).attemptCount, 0);
});

test('start returns to the performance screen with a new schedule and the wake lock', async () => {
  const before = env.wake.requests.length;
  await emit(node('#start-performance'), 'click');
  await settle();
  assert.equal(node('#settings-screen').hidden, true);
  assert.equal(node('#performance-screen').hidden, false);
  assert.equal(node('#detector-button').disabled, false);
  assert.equal(node('#test-indicator').textContent, '검사 대기 중');
  assert.deepEqual(state(keys.STATE_KEY), { ...state(keys.STATE_KEY), attemptCount: 0, settings: { truthAttempts: [1, 3] } });
  assert.equal(node('#attempt-progress').textContent, '완료한 시도 0회. 공연을 시작하면 0이 됩니다.');
  assert.equal(env.wake.requests.length, before + 1);
  assert.equal(env.wake.requests.at(-1).released, false);
});

test('detector: a full hold counts a TRUE attempt with sound, vibration and saved count; an early release cancels', async () => {
  env.vibrations.length = 0;
  await touch(env.screen, 'pointerdown', pointer(31, 200, 600, { target: env.button }));
  const ctx = env.AudioContextStub.instances.at(-1);
  assert.equal(ctx.closed, false, 'the gesture created a live audio context');
  assert.equal(node('#test-indicator').textContent, '검사 중');
  assert.equal(node('.signal-mode').textContent, '측정 중');
  assert.equal(env.button.getAttribute('aria-busy'), 'true');
  assert.equal(env.screen.classList.contains('is-testing'), true);
  assert.equal(document.body.classList.contains('is-testing'), true);
  assert.deepEqual(env.vibrations, [500], 'max level vibrates for the whole scan');
  assert.ok(ctx.oscillators.some((osc) => osc.started && osc.frequencies[0] === 148), 'scan tone starts');
  await settle(700);
  assert.equal(node('#verdict').textContent, '진실', 'attempt 1 is a configured truth attempt');
  assert.equal(node('#test-indicator').textContent, '');
  assert.equal(env.screen.classList.contains('is-true'), true);
  assert.equal(node('.signal-mode').textContent, '완료');
  assert.equal(node('#attempt-progress').textContent, '완료한 시도 1회. 공연을 시작하면 0이 됩니다.');
  assert.equal(state(keys.STATE_KEY).attemptCount, 1);
  assert.ok(env.vibrations.includes(0), 'finishing cancels vibration');
  assert.deepEqual(ctx.oscillators.filter((osc) => [784, 659.25, 1046.5].includes(osc.frequencies[0])).map((osc) => osc.frequencies[0]), [784, 659.25, 1046.5]);
  await touch(env.screen, 'pointerup', pointer(31, 200, 600, { target: env.button }));
  assert.equal(state(keys.STATE_KEY).attemptCount, 1, 'release after the verdict does not count twice');

  await holdButton(0, 32);
  assert.equal(node('#test-indicator').textContent, '취소됨');
  assert.equal(node('#verdict').textContent, '');
  assert.equal(env.screen.classList.contains('is-cancelled'), true);
  assert.equal(state(keys.STATE_KEY).attemptCount, 1, 'an early release is not an attempt');
});

test('detector: the next full hold is a LIE with the lie tones', async () => {
  const ctx = env.AudioContextStub.instances.at(-1);
  assert.equal(ctx.closed, false);
  await holdButton(700, 33);
  assert.equal(node('#verdict').textContent, '거짓');
  assert.equal(env.screen.classList.contains('is-lie'), true);
  assert.equal(state(keys.STATE_KEY).attemptCount, 2);
  assert.deepEqual(ctx.oscillators.filter((osc) => [196, 277].includes(osc.frequencies[0])).map((osc) => osc.frequencies[0]), [196, 277]);
  assert.equal(node('#attempt-progress').textContent, '완료한 시도 2회. 공연을 시작하면 0이 됩니다.');
});

test('wood-drum theme: the heartbeat trace runs while held and the verdict feeds onto the paper', async () => {
  const theme = node('#display-theme');
  await emit(theme, 'change', { target: Object.assign(theme, { value: 'recorder' }) });
  assert.equal(stored(keys.THEME), 'recorder');
  assert.equal(env.screen.dataset.displayTheme, 'recorder');

  await touch(env.screen, 'pointerdown', pointer(41, 200, 600, { target: env.button }));
  assert.match(env.screen.dataset.woodSeed, /^\d+$/, 'a heartbeat was built from a seed');
  const trace = node('.wood-trace');
  const first = trace.getAttribute('d');
  assert.ok(first, 'trace path drawn at the start');
  env.runFrames(performance.now() + 100);
  assert.notEqual(trace.getAttribute('d'), first, 'the pen moves on the next frame');
  assert.ok(Number(env.screen.dataset.woodDistance) > 0);
  assert.equal(env.screen.classList.contains('is-live'), true);
  await settle(700);

  assert.equal(node('#verdict').textContent, '진실', 'attempt 3 is a configured truth attempt');
  assert.equal(state(keys.STATE_KEY).attemptCount, 3);
  const strip = node('.wood-paper-strip');
  assert.equal(strip.classList.contains('is-feeding'), true);
  assert.equal((strip.innerHTML.match(/<svg/g) || []).length, 2, 'old and new paper lines are both on the strip');
  env.runFrames(performance.now() + 500);
  assert.equal(strip.classList.contains('is-feeding'), false);
  assert.equal((strip.innerHTML.match(/<svg/g) || []).length, 1);
  assert.match(strip.innerHTML, />진실</);
  await touch(env.screen, 'pointerup', pointer(41, 200, 600, { target: env.button }));
  assert.equal(env.screen.classList.contains('is-live'), false);
});

after(() => { console.error = originalConsoleError; });
