import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Loads zz2/install-prompt.js and zz2/app.js with their real imports as separate ES modules (no concatenation, no
// shared scope). A module that uses an identifier it does not import throws ReferenceError here, as in the browser.
// The DOM is built by parsing the real index.html; an id or selector missing from the HTML stays missing (null).
// Flows are driven through the listeners the app registers: boot, install prompt, wake lock on visibility, PIN entry
// with failure feedback, two-finger taps, the two-finger downward swipe into settings, the settings form (image upload,
// crop, appearance, submit and start), galaxy confirm and fingerprint unlock, home swipes, the reveal card, the peek,
// the rewind flow (emergency double tap, fullscreen, hidden keypad, lock screen, unlock drag), saved settings, the
// session and the hitsuzen birth-days link.
// Not reachable with these stubs: settings-ui.js and performance-link.js internals beyond the write path (classic
// scripts, not ES modules), the real IndexedDB, real canvas pixels, the service worker file itself (sw.js), and
// fullscreen by a dedicated module (index.html loads none; the fullscreen helpers live in pin.js and are driven by the
// emergency double tap).
// RELEASE_ROOT points the same test at a scratch copy or at distribution-snapshots/unlock.
const root = process.env.RELEASE_ROOT ? pathToFileURL(`${process.env.RELEASE_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz2/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const friend = process.env.RELEASE_PATHNAME ? /^\/tools\/(?:unlock|release)\//.test(process.env.RELEASE_PATHNAME) : /distribution-snapshots/.test(root.href);
const pathname = process.env.RELEASE_PATHNAME || (friend ? '/tools/unlock/' : '/zz2/');
const SETTINGS_KEY = friend ? 'unlock-settings-v1' : 'unlock-settings-personal-v2';
const TUTORIAL_KEY = friend ? 'friend-unlock-settings-entry-tutorial-v1' : 'unlock-settings-entry-tutorial-v1';
const INSTALL_KEY = friend ? 'unlock-install-shared-v1' : 'unlock-install-personal-v1';
const LINK_KEY = `magic-performance-link:v1:release-hitsuzen:${/^\/tools(?:\/|$)/.test(pathname) ? 'shared' : 'personal'}`;
const HITSUZEN_URL = friend ? '/tools/hitsuzen/' : '/zz3/';

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

// ----- selector matching (the subset the app uses) -----
const PIECE = /^(?:([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:(=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\])/;
function parseCompound(source) {
  const tests = [];
  let rest = source;
  while (rest) {
    const m = rest.match(PIECE);
    if (!m) throw new Error(`stub: unsupported selector part "${source}"`);
    if (m[1]) tests.push({ tag: m[1].toLowerCase() });
    else if (m[2]) tests.push({ id: m[2] });
    else if (m[3]) tests.push({ cls: m[3] });
    else tests.push({ attr: m[4], op: m[5] || '', val: m[6] ?? m[7] ?? m[8] ?? '' });
    rest = rest.slice(m[0].length);
  }
  return tests;
}
function parseSelector(selector) {
  return selector.split(',').map((part) => {
    const chain = [];
    let comb = ' ';
    for (const token of part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/)) {
      if (token === '>') { comb = '>'; continue; }
      chain.push({ tests: parseCompound(token), comb });
      comb = ' ';
    }
    return chain;
  });
}
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function attrValue(el, name) {
  if (name.startsWith('data-')) { const v = el.dataset[camel(name.slice(5))]; return v === undefined ? null : String(v); }
  if (name === 'id') return el.id || null;
  if (name === 'hidden') return el.hidden ? '' : null;
  return el.attrs.has(name) ? el.attrs.get(name) : null;
}
function matchCompound(el, tests) {
  return tests.every((t) => {
    if (t.tag) return t.tag === '*' || el.tag === t.tag;
    if (t.id) return el.id === t.id;
    if (t.cls) return el.classes.has(t.cls);
    const v = attrValue(el, t.attr);
    if (v === null) return false;
    return t.op === '' || v === t.val;
  });
}
function matchChain(el, chain, i) {
  if (!matchCompound(el, chain[i].tests)) return false;
  if (i === 0) return true;
  if (chain[i].comb === '>') return Boolean(el.parentElement) && matchChain(el.parentElement, chain, i - 1);
  for (let p = el.parentElement; p; p = p.parentElement) if (matchChain(p, chain, i - 1)) return true;
  return false;
}
const matchesSelector = (el, selector) => parseSelector(selector).some((chain) => matchChain(el, chain, chain.length - 1));

// ----- events: capture, target, bubble over element -> document -> window -----
function listen(target) {
  target.listeners = new Map();
  target.addEventListener = (type, fn, opts) => {
    const capture = opts === true || opts?.capture === true;
    if (!target.listeners.has(type)) target.listeners.set(type, []);
    target.listeners.get(type).push({ fn, capture, once: opts?.once === true });
  };
  target.removeEventListener = (type, fn) => {
    target.listeners.set(type, (target.listeners.get(type) || []).filter((l) => l.fn !== fn));
  };
}
let document;
let window;
const pathOf = (node) => {
  if (node === window) return [window];
  const path = [];
  for (let n = node; n; n = n.parentElement) path.push(n);
  if (node !== document) path.push(document);
  path.push(window);
  return path;
};
function runEvent(target, event) {
  event.target = target;
  const results = [];
  const path = pathOf(target);
  const call = (node, phase) => {
    event.currentTarget = node;
    for (const l of [...(node.listeners?.get(event.type) || [])]) {
      if (phase === 'capture' && !l.capture) continue;
      if (phase === 'bubble' && l.capture) continue;
      if (l.once) node.removeEventListener(event.type, l.fn);
      results.push(l.fn.call(node, event));
      if (event.immediate) return;
    }
  };
  for (let i = path.length - 1; i > 0 && !event.stopped; i -= 1) call(path[i], 'capture');
  if (!event.stopped) call(path[0], 'target');
  if (event.bubbles !== false) for (let i = 1; i < path.length && !event.stopped; i += 1) call(path[i], 'bubble');
  return results;
}
function makeEvent(type, init) {
  return {
    type, bubbles: true, cancelable: true, defaultPrevented: false, isTrusted: false, timeStamp: 0,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = true; this.immediate = true; },
    ...init,
  };
}
// Awaits async listeners so a rejection fails the step; a registered listener is mandatory.
async function dispatch(target, type, init = {}) {
  const event = makeEvent(type, init);
  const results = runEvent(target, event);
  assert.ok(results.length > 0, `a listener is registered for ${type} on ${target.id || target.tag || 'target'}`);
  await Promise.all(results);
  return event;
}
const click = (el) => dispatch(el, 'click');

// ----- elements -----
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.id = '';
    this.attrs = new Map(); this.classes = new Set(); this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = '';
    this.rect = null; this.clientWidth = 0; this.clientHeight = 0; this.offsetWidth = 0; this.scrollTop = 0;
    this.style = { setProperty(k, v) { this[k] = String(v); } };
    listen(this);
    this.classList = {
      add: (...n) => n.forEach((x) => this.classes.add(x)), remove: (...n) => n.forEach((x) => this.classes.delete(x)),
      contains: (n) => this.classes.has(n),
      toggle: (n, force) => { const on = force === undefined ? !this.classes.has(n) : Boolean(force); if (on) this.classes.add(n); else this.classes.delete(n); return on; },
    };
  }
  get className() { return [...this.classes].join(' '); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children.forEach((c) => { c.parentElement = null; }); this.children = []; }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = v;
    if (k === 'hidden') this.hidden = true;
    if (k.startsWith('data-')) this.dataset[camel(k.slice(5))] = String(v);
  }
  getAttribute(k) { return attrValue(this, k); }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((c) => c !== node);
      node.parentElement = this; this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children.forEach((c) => { c.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  closest(selector) { for (let n = this; n; n = n.parentElement) if (matchesSelector(n, selector)) return n; return null; }
  querySelectorAll(selector) {
    const chains = parseSelector(selector);
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (chains.some((chain) => matchChain(child, chain, chain.length - 1))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  getContext() { return { drawImage() {} }; }
  toBlob(done) { done(new Blob(['cropped'], { type: 'image/png' })); }
  animate() { return { cancel() {} }; }
  getAnimations() { return []; }
  setPointerCapture() {}
  hasPointerCapture() { return false; }
  releasePointerCapture() {}
}

// ----- parse the real index.html into the stub DOM -----
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
const SKIP_CONTENT = new Set(['script', 'style', 'noscript']);
function parseHtml(source) {
  const top = new FakeElement('#root');
  const stack = [top];
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
  const attr = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = token.exec(source))) {
    if (m[1]) {
      const name = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === name) { stack.length = i; break; }
      }
      continue;
    }
    if (m[2]) {
      const el = new FakeElement(m[2]);
      for (const [, k, a, b, c] of m[3].matchAll(attr)) {
        const v = a ?? b ?? c ?? '';
        el.setAttribute(k, v);
        if (k === 'checked') el.checked = true;
        if (k === 'disabled') el.disabled = true;
        if (k === 'value') el.value = v;
        if (k === 'content') el.content = v;
      }
      stack[stack.length - 1].append(el);
      if (SKIP_CONTENT.has(el.tag)) {
        token.lastIndex = source.toLowerCase().indexOf(`</${el.tag}>`, token.lastIndex) + el.tag.length + 3;
        continue;
      }
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] && stack.length > 1) stack[stack.length - 1]._text += m[5];
  }
  for (const select of top.querySelectorAll('select')) {
    const first = select.children.find((c) => c.tag === 'option');
    if (first && !select.attrs.has('value')) select.value = first.attrs.get('value') ?? first._text;
  }
  return top;
}

// ----- browser stubs -----
function stubBrowser() {
  const top = parseHtml(html);
  const htmlEl = top.children.find((c) => c.tag === 'html');
  htmlEl.parentElement = null;
  const body = htmlEl.children.find((c) => c.tag === 'body');
  const ids = new Map();
  for (const el of top.querySelectorAll('[id]')) ids.set(el.id, el);

  const localMap = new Map();
  const localStorage = {
    getItem: (key) => (localMap.has(key) ? localMap.get(key) : null),
    setItem: (key, value) => { localMap.set(key, String(value)); },
    removeItem: (key) => { localMap.delete(key); },
  };
  const fullscreen = { requests: [], exits: 0 };
  document = {
    title: '', activeElement: null, visibilityState: 'visible', documentElement: htmlEl, body, fullscreenElement: null,
    getElementById: (id) => ids.get(id) || null,
    querySelector: (selector) => top.querySelector(selector),
    querySelectorAll: (selector) => top.querySelectorAll(selector),
    createElement: (tag) => new FakeElement(tag),
    exitFullscreen: async () => { fullscreen.exits += 1; document.fullscreenElement = null; },
  };
  htmlEl.requestFullscreen = async (options) => { fullscreen.requests.push(options); document.fullscreenElement = htmlEl; };
  listen(document);

  const wake = { requests: [] };
  const vibrations = [];
  const assigned = [];
  const navigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    registered: [],
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
    serviceWorker: {
      controller: {},
      addEventListener() {},
      register: async (url) => { navigator.registered.push(url); return { installing: null, addEventListener() {} }; },
    },
  };

  // Minimal IndexedDB: one object store, callbacks fire on a later task like the real API.
  const idbData = new Map();
  const db = {
    createObjectStore() {},
    transaction() {
      const tx = {};
      const objectStore = {
        get(key) { const r = {}; setTimeout(() => { r.result = idbData.get(key); r.onsuccess?.(); }, 0); return r; },
        put(blob, key) { idbData.set(key, blob); setTimeout(() => tx.oncomplete?.(), 0); },
      };
      tx.objectStore = () => objectStore;
      return tx;
    },
  };
  const indexedDB = {
    opened: [],
    open(name) {
      indexedDB.opened.push(name);
      const request = { result: db };
      setTimeout(() => { request.onupgradeneeded?.(); request.onsuccess?.(); }, 0);
      return request;
    },
  };

  window = { innerWidth: 400, innerHeight: 800 };
  listen(window);
  const frames = new Map();
  let frameId = 0;
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', { pathname, assign: (url) => { assigned.push(url); } });
  define('localStorage', localStorage);
  define('matchMedia', (query) => ({ matches: /prefers-reduced-motion/.test(query) }));
  define('MutationObserver', class { observe() {} disconnect() {} });
  define('indexedDB', indexedDB);
  define('requestAnimationFrame', (fn) => { frameId += 1; frames.set(frameId, fn); return frameId; });
  define('cancelAnimationFrame', (id) => { frames.delete(id); });
  define('Image', class {
    constructor() { this.naturalWidth = 100; this.naturalHeight = 400; }
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
    get src() { return this._src; }
  });
  const flushFrames = () => { const run = [...frames.entries()]; frames.clear(); run.forEach(([, fn]) => fn()); return run.length; };
  const app = ids.get('app');
  if (app) { app.clientWidth = 400; app.clientHeight = 800; }
  return { localStorage, localMap, wake, vibrations, assigned, fullscreen, idbData, indexedDB, navigator, flushFrames, frames };
}

const env = stubBrowser();
const el = (id) => {
  const node = document.getElementById(id);
  assert.ok(node, `index.html defines #${id}`);
  return node;
};
const stored = (key) => JSON.parse(env.localStorage.getItem(key));
const keyButton = (digit) => {
  const key = el('keypad').children.find((child) => String(child.dataset.digit) === String(digit));
  assert.ok(key, `keypad has digit ${digit}`);
  return key;
};
const actionKey = (action) => {
  const key = el('keypad').children.find((child) => child.dataset.action === action);
  assert.ok(key, `keypad has action ${action}`);
  return key;
};
const typeDigits = async (digits) => { for (const digit of digits) await click(keyButton(digit)); };
const filled = () => el('dots').children.filter((dot) => dot.classes.has('filled')).length;
const cursor = (id, x, y, extra = {}) => ({ identifier: id, clientX: x, clientY: y, ...extra });
const pair = (dy = 0) => [cursor(1, 100, 300 + dy), cursor(2, 300, 300 + dy)];
async function twoFingerTap() {
  const points = pair();
  await dispatch(document, 'touchstart', { touches: points, changedTouches: points });
  await dispatch(document, 'touchend', { touches: [], changedTouches: points });
}
async function twoFingerSwipeDown(dy = 140) {
  const start = pair();
  const end = pair(dy);
  await dispatch(document, 'touchstart', { touches: start, changedTouches: start });
  await dispatch(document, 'touchmove', { touches: end, changedTouches: end });
  await dispatch(document, 'touchend', { touches: [], changedTouches: end });
}
async function swipe(fromX, fromY, toX, toY) {
  const start = [cursor(5, fromX, fromY)];
  const end = [cursor(5, toX, toY)];
  await dispatch(document, 'touchstart', { touches: start, changedTouches: start });
  await dispatch(document, 'touchmove', { touches: end, changedTouches: end });
  await dispatch(document, 'touchend', { touches: [], changedTouches: end });
}
const pointerEvent = (id, x, y) => ({ pointerId: id, isPrimary: true, clientX: x, clientY: y });
async function tapAt(target, x, y, id = 3) {
  await dispatch(target, 'pointerdown', pointerEvent(id, x, y));
  await dispatch(target, 'pointerup', pointerEvent(id, x, y));
}
const choose = async (id, value, type = 'input') => { el(id).value = value; await dispatch(el(id), type); };
const toggle = async (id, checked, type = 'change') => { el(id).checked = checked; await dispatch(el(id), type); };

let sessionModule;
let logic;
const live = () => sessionModule.session;

test('boot imports the real zz2 modules in index.html order and shows the PIN screen', async () => {
  const scripts = [...html.matchAll(/<script type="module" src="\.\/([\w-]+\.js)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts, ['install-prompt.js', 'app.js'], 'index.html loads install-prompt.js, then app.js as modules');
  const classic = [...html.matchAll(/<script src="\.\/([\w-]+\.js)" defer>/g)].map((match) => match[1]);
  assert.deepEqual(classic, ['performance-link.js', 'settings-ui.js']);
  await import(new URL('performance-link.js', root));
  assert.equal(typeof window.MagicPerformanceLink.write, 'function');
  logic = await import(new URL('logic.js', root));
  await import(new URL('install-prompt.js', root));
  await import(new URL('app.js', root));
  sessionModule = await import(new URL('session.js', root));
  await settle(20);

  const session = live();
  assert.equal(session.screen, 'input');
  assert.equal(el('input-screen').hidden, false);
  for (const id of ['unlocked-screen', 'peek-screen', 'time-black', 'time-lock', 'settings-screen']) assert.equal(el(id).hidden, true, `${id} hidden at boot`);
  assert.equal(el('dots').children.length, 6);
  assert.equal(el('keypad').children.length, 12, 'ten digits plus backspace and confirm');
  assert.equal(el('prompt').textContent, '암호 입력');
  assert.equal(el('emergency').querySelector('span').textContent, '긴급 상황');
  assert.equal(el('delete').textContent, '취소');
  assert.equal(el('performance-heading').textContent, '리와인드');
  assert.equal(el('performance-field').hidden, true);
  assert.equal(session.STORAGE.settingsKey, SETTINGS_KEY);
  assert.deepEqual(env.navigator.registered, ['./sw.js']);
  assert.match(el('offline-status').textContent, /^오프라인 준비 완료/);
  assert.deepEqual(env.indexedDB.opened, [session.STORAGE.imageDb]);
  assert.match(el('storage-status').textContent, /^기본 배경으로 바로 공연할 수 있습니다/);
  assert.equal(el('lock-info').textContent, '기본 배경 사용 · 사진을 등록하면 이 기기에 저장됩니다.');
  assert.equal(el('birth-days-link').checked, true);
  assert.equal(env.wake.requests.length, 1, 'boot requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);

  assert.equal(el('settings-entry-tutorial').hidden, false, 'settings tutorial shows on first run');
  await click(el('settings-entry-tutorial-dismiss'));
  assert.equal(el('settings-entry-tutorial').hidden, true);
  assert.equal(env.localStorage.getItem(TUTORIAL_KEY), '1', 'dismissal is remembered');
});

test('wake lock is released when hidden and requested again when visible', async () => {
  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests[0].released, true);
  assert.equal(env.wake.requests.length, 1);
  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2);
  assert.equal(env.wake.requests[1].released, false);
});

test('install prompt: instructions, the native prompt, appinstalled and the remembered dismissal', async () => {
  const offer = el('install-offer');
  const action = el('install-action');
  const instructions = el('install-instructions');
  assert.equal(offer.hidden, false, 'a phone browser is offered the install card');
  assert.equal(instructions.hidden, true);
  await click(action);
  assert.equal(instructions.hidden, false);
  assert.equal(instructions.textContent, 'Safari 공유(□↑) → 홈 화면에 추가를 선택하세요.');

  let prompted = 0;
  let prevented = 0;
  const native = (outcome) => ({
    preventDefault() { prevented += 1; },
    prompt: async () => { prompted += 1; },
    userChoice: Promise.resolve({ outcome }),
  });
  await dispatch(window, 'beforeinstallprompt', native('accepted'));
  assert.equal(prevented, 1);
  assert.equal(action.textContent, '설치');
  await click(action);
  assert.equal(prompted, 1);
  assert.match(instructions.textContent, /^설치 요청을 보냈습니다\./);
  assert.equal(action.textContent, '설치 방법');

  await dispatch(window, 'beforeinstallprompt', native('dismissed'));
  await click(action);
  assert.equal(prompted, 2);
  assert.equal(instructions.textContent, 'Safari 공유(□↑) → 홈 화면에 추가를 선택하세요.', 'a dismissed prompt falls back to instructions');

  await dispatch(window, 'appinstalled');
  assert.match(instructions.textContent, /^설치 요청을 받았습니다\./);
  await click(el('install-later'));
  assert.equal(offer.hidden, true);
  assert.equal(env.localStorage.getItem(INSTALL_KEY), '1', 'dismissal is stored under the app-specific key');
});

test('PIN entry: dots, delete, failure feedback with vibration, ignored input while shaking, 4/6 digit toggle', async () => {
  await typeDigits([1, 2, 3]);
  assert.equal(filled(), 3);
  assert.equal(el('dots').getAttribute('aria-label'), '6자리 중 3자리 입력');
  assert.equal(el('delete').textContent, '삭제');
  await click(el('delete'));
  assert.equal(filled(), 2);
  assert.deepEqual(live().state.current, [1, 2]);
  await typeDigits([3, 4, 5, 6]);
  assert.deepEqual(live().state.attempts, [[1, 2, 3, 4, 5, 6]]);
  assert.equal(el('dots').classes.has('shake'), true, 'a wrong PIN shakes the dots');
  assert.equal(filled(), 6);
  assert.deepEqual(env.vibrations.at(-1), [35, 30, 35]);
  await click(keyButton(7));
  assert.deepEqual(live().state.current, [], 'input is ignored during feedback');
  await click(el('delete'));
  await settle(450);
  assert.equal(el('dots').classes.has('shake'), false);
  assert.equal(filled(), 0);

  await click(el('prompt'));
  assert.equal(el('dots').children.length, 4);
  assert.equal(el('prompt').getAttribute('aria-label'), '암호 입력, 6자리로 전환');
  await click(el('prompt'));
  assert.equal(el('dots').children.length, 6);
});

test('two-finger taps: one tap does nothing, two taps clear the record after the window', async () => {
  assert.equal(live().state.attempts.length, 1);
  await twoFingerTap();
  await twoFingerTap();
  assert.equal(live().state.attempts.length, 1, 'the double tap is still pending');
  await settle(1300);
  assert.equal(live().state.attempts.length, 0, 'the settled double tap resets the record');
  assert.equal(live().screen, 'input');
  assert.equal(el('input-screen').hidden, false);
});

test('two-finger downward swipe opens settings, releases the wake lock and fills the form from saved settings', async () => {
  const before = env.wake.requests.length;
  await twoFingerSwipeDown(140);
  await settle();
  assert.equal(live().screen, 'settings');
  assert.equal(el('settings-screen').hidden, false);
  assert.equal(el('input-screen').hidden, true);
  assert.equal(el('settings-entry-tutorial').hidden, true);
  assert.equal(env.wake.requests.length, before);
  assert.equal(env.wake.requests.at(-1).released, true, 'settings does not hold the screen awake');
  assert.equal(el('style').value, 'ios');
  assert.equal(String(el('digits').value), '6');
  assert.equal(el('unlock-mode').value, 'timer');
  assert.equal(el('delay').value, 8);
  assert.equal(el('time-options').hidden, false);
  assert.equal(env.localStorage.getItem(SETTINGS_KEY), null, 'nothing is saved before Start');
});

test('settings form: options, image upload and crop, invalid field opens its group, submit and start', async () => {
  await toggle('rewind-grid-guide', true);
  assert.equal(env.localStorage.getItem('release.rewindGridGuide.v1'), '1');
  await toggle('rewind-charging', true);
  assert.equal(env.localStorage.getItem('release.rewindCharging.v1'), '1');
  assert.equal(el('oneui-charge').hidden, true, 'no battery information, no charging row');
  await toggle('rewind-dnd', true);
  assert.equal(env.localStorage.getItem('release.rewindDnd.v1'), '1');
  assert.equal(el('oneui-dnd').hidden, false);

  const group = el('delay').closest('details');
  assert.ok(group, 'the delay field sits in a details group');
  group.open = false;
  await dispatch(el('delay'), 'invalid', { bubbles: false });
  assert.equal(group.open, true, 'an invalid field opens its group');

  await choose('style', 'galaxy');
  assert.equal(el('input-screen').classes.has('galaxy'), true, 'the form previews the keypad style');
  await choose('digits', '4');
  await choose('unlock-mode', 'attempt');
  assert.equal(el('delay-field').hidden, true);
  assert.equal(el('attempt-field').hidden, false);
  assert.equal(el('unlock-attempt').disabled, false);
  assert.equal(el('delay').disabled, true);
  await choose('unlock-attempt', '2');
  await choose('reveal-attempt', '1');
  await choose('time-delay', '1.5');

  const picture = new Blob(['lock-picture'], { type: 'image/png' });
  el('lock-file').files = [picture];
  await dispatch(el('lock-file'), 'change');
  assert.equal(env.idbData.get('lock'), picture, 'the upload is stored in the image database');
  assert.equal(el('lock-info').textContent, '등록됨 · 100 × 400');
  assert.equal(el('lock-file').parentElement.querySelector('.file-picker-label').textContent, '다시 선택');
  assert.equal(el('lock-image').hidden, false);
  assert.match(el('lock-image').src, /^blob:/);
  assert.equal(el('time-wallpaper').hidden, false);
  assert.equal(el('storage-status').textContent, '이미지를 이 기기의 IndexedDB에 저장했습니다.');
  assert.equal(el('start').disabled, false);
  assert.equal(el('lock-file').value, '');
  const firstUrl = el('lock-image').src;

  el('crop').value = '30';
  await dispatch(el('crop'), 'change');
  assert.equal(el('lock-preview').closest('.preview').dataset.naturalHeight, 400);
  assert.notEqual(el('lock-image').src, firstUrl, 'a new crop makes a new cropped image');

  const wakes = env.wake.requests.length;
  await dispatch(el('settings-form'), 'submit');
  await settle();
  assert.doesNotMatch(el('storage-status').textContent, /이미지 처리 실패/);
  assert.equal(el('start').disabled, false);
  assert.equal(live().screen, 'input', 'Start leaves settings');
  assert.equal(el('settings-screen').hidden, true);
  assert.equal(el('input-screen').hidden, false);
  assert.deepEqual(
    Object.fromEntries(Object.entries(stored(SETTINGS_KEY)).filter(([key]) => ['style', 'digits', 'unlockMode', 'unlockAttempt', 'revealAttempt', 'cropTop', 'timeDelay', 'performance'].includes(key))),
    { performance: 'time-machine', timeDelay: 1.5, style: 'galaxy', digits: 4, unlockMode: 'attempt', unlockAttempt: 2, revealAttempt: 1, cropTop: 30 },
  );
  assert.deepEqual(live().settings, stored(SETTINGS_KEY));
  assert.equal(live().state.digits, 4);
  assert.equal(el('dots').children.length, 4);
  assert.equal(el('prompt').textContent, 'PIN을 입력하세요');
  assert.equal(el('emergency').querySelector('span').textContent, '긴급전화');
  assert.equal(document.documentElement.style['--status-color'], '#000000');
  assert.equal(document.querySelector('meta[name="theme-color"]').content, '#000000');
  assert.equal(document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content, 'default');
  const lockPreview = el('lock-preview').closest('.preview');
  assert.equal(lockPreview.querySelector('.crop-handle').getAttribute('aria-valuenow'), '30');
  assert.equal(lockPreview.querySelector('.crop-overlay').style.height, '7.5%');
  assert.equal(el('lock-image').style.objectPosition, '50% 50%');
  assert.equal(env.wake.requests.length, wakes + 1, 'Start takes the wake lock again');
  assert.equal(env.wake.requests.at(-1).released, false);
});

test('galaxy unlock by the confirm key: failure, backspace, success, attempt list, home swipes, reveal card, peek, two-tap reset', async () => {
  await typeDigits([1, 2, 3, 4]);
  assert.equal(filled(), 4);
  assert.equal(live().state.attempts.length, 0, 'galaxy does not submit by itself');
  await click(actionKey('confirm'));
  assert.deepEqual(live().state.attempts, [[1, 2, 3, 4]]);
  assert.deepEqual(env.vibrations.at(-1), [35, 30, 35]);
  assert.equal(el('dots').classes.has('shake'), true);
  await settle(450);
  await click(keyButton(5));
  await click(actionKey('backspace'));
  assert.deepEqual(live().state.current, []);

  await typeDigits([0, 6, 1, 5]);
  await click(actionKey('confirm'));
  await settle(30);
  assert.equal(live().screen, 'unlocked');
  assert.equal(live().state.unlocked, true);
  assert.deepEqual(env.vibrations.at(-1), [20]);
  assert.equal(el('input-screen').hidden, true);
  assert.equal(el('unlocked-screen').hidden, false);
  assert.equal(el('peek-screen').hidden, false);
  assert.deepEqual(el('attempt-list').children.map((row) => row.children[0].textContent), ['0615', '1234']);
  env.flushFrames();
  assert.equal(el('home-track').style.transition, '');

  await swipe(300, 300, 180, 300);
  assert.equal(el('home-track').style.transform, 'translate3d(-100%, 0, 0)', 'a left swipe moves to the second home page');
  await swipe(300, 300, 270, 300);
  assert.equal(el('reveal-card').classes.has('visible'), true, 'a left swipe on page two shows the reveal card');
  assert.equal(el('reveal-card').getAttribute('aria-hidden'), 'false');
  assert.equal(el('reveal-label').textContent, '1번째 입력 PIN');
  assert.equal(el('reveal-number').textContent, '1234');
  assert.equal(el('reveal-days').hidden, true, 'a 4 digit PIN has no birthday');
  await settle(650);
  assert.equal(el('reveal-card').classes.has('visible'), false, 'the card hides after the minimum display time');
  assert.equal(el('reveal-card').getAttribute('aria-hidden'), 'true');
  await swipe(100, 300, 220, 300);
  assert.equal(el('home-track').style.transform, 'translate3d(0%, 0, 0)', 'a right swipe returns to page one');

  const start = [cursor(5, 200, 500)];
  const mid = [cursor(5, 200, 300)];
  await dispatch(document, 'touchstart', { touches: start, changedTouches: start });
  await dispatch(document, 'touchmove', { touches: mid, changedTouches: mid });
  assert.equal(el('unlocked-screen').style.transform, 'translateY(-200px)', 'an upward swipe peeks at the attempts');
  await dispatch(document, 'touchend', { touches: [], changedTouches: mid });
  assert.equal(el('unlocked-screen').style.transform, 'translateY(0px)');

  await twoFingerTap();
  await twoFingerTap();
  assert.equal(live().screen, 'input', 'two taps on the unlocked screen reset at once');
  assert.deepEqual(live().state.attempts, []);
  assert.equal(live().state.unlocked, false);
  assert.equal(el('input-screen').hidden, false);
  assert.equal(el('unlocked-screen').hidden, true);
});

test('fingerprint hold unlocks on galaxy, an early release only pulses', async () => {
  const sensor = el('fingerprint');
  await dispatch(sensor, 'pointerdown', { pointerId: 4 });
  assert.equal(sensor.classes.has('holding'), true);
  await dispatch(sensor, 'pointerup', { pointerId: 4 });
  assert.equal(sensor.classes.has('holding'), false);
  assert.equal(sensor.classes.has('pulse'), true);
  assert.equal(live().state.attempts.length, 0);

  await dispatch(sensor, 'pointerdown', { pointerId: 4 });
  await settle(700);
  await settle(30);
  assert.equal(live().screen, 'unlocked');
  assert.equal(live().state.unlocked, true);
  await twoFingerTap();
  await twoFingerTap();
  assert.equal(live().screen, 'input');
});

test('rewind: emergency double tap goes fullscreen, hidden keypad sets minutes, lock screen double tap, unlock drag, reset exits fullscreen', async () => {
  await settle(850);
  await click(el('emergency'));
  assert.equal(live().screen, 'input', 'one tap is not enough');
  await click(el('emergency'));
  assert.equal(live().screen, 'time-black');
  assert.deepEqual(env.fullscreen.requests, [{ navigationUI: 'hide' }]);
  assert.equal(document.fullscreenElement, document.documentElement);
  assert.equal(document.querySelector('meta[name="theme-color"]').content, '#000000');
  assert.equal(el('time-black').hidden, false);
  assert.equal(el('input-screen').hidden, true);
  assert.equal(el('rewind-digit-guide').hidden, false, 'the digit guide flashes on entry');
  assert.deepEqual(live().timeDigits, []);
  el('time-black').rect = { left: 0, top: 0, width: 400, height: 800 };
  el('time-lock').rect = { left: 0, top: 0, width: 400, height: 800 };

  await tapAt(el('time-black'), 50, 700);
  assert.deepEqual(live().timeDigits, [], 'the corner next to zero is not a digit');
  assert.equal(live().performanceTouched, true);
  await tapAt(el('time-black'), 200, 700);
  assert.deepEqual(live().timeDigits, [0]);
  await settle(900);
  assert.equal(el('rewind-digit-guide').classes.has('is-fading'), true);
  await settle(450);
  assert.equal(el('rewind-digit-guide').hidden, true, 'the guide disappears');
  env.flushFrames();
  await tapAt(el('time-black'), 350, 100);
  assert.equal(live().screen, 'time-lock');
  assert.equal(live().timeMinutes, 3);
  assert.equal(el('time-lock').hidden, false);
  assert.equal(el('time-black').hidden, true);
  assert.equal(el('time-lock').classes.has('galaxy'), true);
  const shown = new Date(el('time-clock').dateTime).getTime();
  assert.ok(Math.abs(shown - (Date.now() + 180000)) < 5000, 'the lock screen shows the time three minutes ahead');
  assert.match(el('time-clock').getAttribute('aria-label'), /^\d\d시 \d\d분$/);
  assert.match(el('time-hour').textContent, /^\d\d$/);
  assert.match(el('time-minute').textContent, /^\d\d$/);
  assert.ok(el('time-date').textContent.length > 0);
  assert.equal(env.flushFrames(), 1, 'the clock keeps one animation frame going');

  assert.equal(live().timeTriggeredAt, null);
  await tapAt(el('time-lock'), 200, 400, 6);
  await tapAt(el('time-lock'), 200, 400, 6);
  assert.equal(typeof live().timeTriggeredAt, 'number', 'two quick taps start the rewind');
  assert.equal(typeof live().timeTriggeredWallAt, 'number');

  await dispatch(el('time-lock'), 'pointerdown', pointerEvent(9, 200, 700));
  await dispatch(el('time-lock'), 'pointermove', pointerEvent(9, 200, 300));
  assert.equal(el('time-lock').style.transform, 'translate3d(0,-400px,0)');
  assert.equal(el('unlocked-screen').hidden, false, 'the home screen shows under the dragged lock');
  await dispatch(el('time-lock'), 'pointerup', pointerEvent(9, 200, 300));
  assert.equal(live().screen, 'unlocked');
  assert.equal(live().state.unlocked, true);
  await settle(30);
  assert.equal(el('time-lock').hidden, true);
  assert.equal(el('unlocked-screen').hidden, false);
  assert.equal(el('peek-screen').hidden, false);

  await twoFingerTap();
  await twoFingerTap();
  assert.equal(live().screen, 'input');
  assert.equal(env.fullscreen.exits, 1, 'leaving the rewind exits fullscreen');
  assert.equal(document.fullscreenElement, null);
  assert.deepEqual(live().timeDigits, []);
  assert.equal(live().timeTriggeredAt, null);
});

test('settings again: saved values, birth-days link, hitsuzen link, then a birthday PIN reveals days and publishes them', async () => {
  await twoFingerSwipeDown(140);
  await settle();
  assert.equal(live().screen, 'settings');
  assert.equal(el('style').value, 'galaxy');
  assert.equal(String(el('digits').value), '4');
  assert.equal(el('unlock-mode').value, 'attempt');
  assert.equal(el('unlock-attempt').value, 2);
  assert.equal(el('time-delay').value, 1.5);
  assert.equal(el('crop').value, 30);
  assert.equal(el('rewind-grid-guide').checked, true);
  assert.equal(el('delay-field').hidden, true);

  await toggle('birth-days-link', false);
  assert.equal(el('hitsuzen-link').disabled, true);
  assert.equal(stored(SETTINGS_KEY).birthDaysLink, false);
  assert.equal(el('hitsuzen-link-status').textContent, '자동 전달을 껐으며, 저장된 연동 일수도 지웠습니다.');
  await click(el('hitsuzen-link'));
  assert.deepEqual(env.assigned, [], 'a disabled link does not navigate');
  await toggle('birth-days-link', true);
  assert.equal(el('hitsuzen-link').disabled, false);
  assert.equal(stored(SETTINGS_KEY).birthDaysLink, true);
  assert.match(el('hitsuzen-link-status').textContent, /^생일을 입력하면 일수가 자동 전달됩니다/);

  await choose('style', 'ios');
  await choose('digits', '6');
  await choose('unlock-attempt', '1');
  await dispatch(el('settings-form'), 'submit');
  await settle();
  assert.equal(live().screen, 'input');
  assert.doesNotMatch(el('storage-status').textContent, /이미지 처리 실패/);
  assert.equal(stored(SETTINGS_KEY).style, 'ios');
  assert.equal(stored(SETTINGS_KEY).unlockAttempt, 1);
  assert.equal(el('dots').children.length, 6);
  assert.equal(el('prompt').textContent, '암호 입력');

  await typeDigits([9, 0, 0, 1, 0, 1]);
  await settle(30);
  assert.equal(live().screen, 'unlocked');
  assert.deepEqual(env.vibrations.at(-1), [20]);
  const now = new Date();
  const days = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(1990, 0, 1)) / 86400000);
  assert.equal(el('attempt-list').children[0].children[0].textContent, `900101 · ${days.toLocaleString('ko-KR')}일 · 염소자리 · 뱀띠`);
  assert.equal(el('birthday-summary').hidden, false);
  assert.equal(el('birthday-summary').textContent, `1번째 900101 · ${days.toLocaleString('ko-KR')}일 · 염소자리 · 뱀띠`);
  assert.equal(stored(LINK_KEY).days, days, 'the birthday days are published for hitsuzen');
  assert.equal(stored(LINK_KEY).version, 1);

  await swipe(300, 300, 180, 300);
  await swipe(300, 300, 270, 300);
  assert.equal(el('reveal-number').textContent, '900101');
  assert.equal(el('reveal-days').hidden, false);
  assert.equal(el('reveal-days').textContent, `태어난 지 ${days.toLocaleString('ko-KR')}일`);
  assert.equal(el('reveal-zodiac').textContent, '염소자리');
  assert.equal(el('reveal-animal').textContent, '뱀띠');
  await settle(650);
  assert.equal(el('reveal-card').classes.has('visible'), false);

  await twoFingerSwipeDown(140);
  await settle();
  assert.equal(live().screen, 'settings', 'the downward swipe also works from the unlocked screen');
  await click(el('hitsuzen-link'));
  assert.deepEqual(env.assigned, [HITSUZEN_URL]);
  assert.equal(env.wake.requests.at(-1).released, true);
  console.error = originalConsoleError;
});
