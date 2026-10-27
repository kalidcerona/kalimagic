import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { pathToFileURL } from 'node:url';

// Loads TYCHE (zz11) the way its index.html does: settings-ui.js (classic, defer) is evaluated as a script, then
// app.js is loaded with dynamic import() as a real ES module together with its real import logic.js. A module
// that uses an identifier it does not import throws ReferenceError here, as it does in the browser.
// The script list, order, kind and defer flag are read from index.html. The DOM is parsed from the real index.html;
// a missing id is null, nothing is created on demand. fullscreen.js is not referenced by index.html, so it is not loaded.
// Drives boot, the guide, target selection, spins (queue, forced stop, outcome rules), the two-finger downward
// touch swipe, settings controls, wake lock on visibilitychange (the stub browser releases the lock on hide),
// the install flows of app.js and settings-ui.js, the settings-ui appearance page (personal build only: the friend
// snapshot path disables customization) and a relaunch from the saved storage.
// TYCHE_ROOT selects another root, for example distribution-snapshots/spinner.
// Not reachable with these stubs: the live preview inside the appearance page (needs shadow DOM and getComputedStyle),
// ResizeObserver/MutationObserver relayout, the localhost-only local-preview hook, real animation timing.
const FRIEND = Boolean(process.env.TYCHE_ROOT);
const root = FRIEND ? pathToFileURL(`${process.env.TYCHE_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz11/', import.meta.url);
const PREFIX = FRIEND ? 'friend-spinner' : 'zz11';
const OTHER_PREFIX = FRIEND ? 'zz11' : 'friend-spinner';
const KEYS = FRIEND
  ? { state: 'friend-spinner-state-v2', theme: 'friend-spinner-table-theme-v1', design: 'friend-spinner-screen-design-v1', guide: 'friend-spinner-guide-seen-v2' }
  : { state: 'zz11-spinner-state-v2', theme: 'zz11-table-theme-v1', design: 'zz11-screen-design-v1', guide: 'zz11-guide-seen-v2' };
const pathname = FRIEND ? '/distribution-snapshots/spinner/' : '/zz11/';
const APPEARANCE_KEY = `magic-appearance:v1:spinner:https://example.test${pathname}`;

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
after(() => { console.error = originalConsoleError; });
afterEach(async () => {
  await settle(5);
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
});

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function listenerHost(target) {
  target.listeners = {};
  target.addEventListener = (type, fn, options) => {
    (target.listeners[type] ||= []).push({ fn, capture: options === true || !!(options && options.capture), once: !!(options && options.once) });
  };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item.fn !== fn); };
  // Synchronous, non-bubbling dispatch used by the page's own dispatchEvent calls.
  target.dispatchEvent = (event) => {
    for (const entry of [...(target.listeners[event.type] || [])]) {
      try { entry.fn.call(target, event); } catch (error) { errors.push(`uncaught dispatchEvent listener error on ${event.type}: ${error?.stack || error}`); }
    }
    return true;
  };
}

let document;
let window;
// ----- selector matching (the subset the app and settings-ui.js use) -----
const PIECE = /^(?:([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\])/;
function parseCompound(source) {
  const tests = [];
  let rest = source;
  while (rest) {
    const m = rest.match(PIECE);
    if (!m) throw new Error(`stub: unsupported selector part "${source}"`);
    if (m[1]) tests.push({ tag: m[1].toLowerCase() });
    else if (m[2]) tests.push({ id: m[2] });
    else if (m[3]) tests.push({ cls: m[3] });
    else if (m[4]) tests.push({ attr: m[4], op: m[5] || '', val: m[6] ?? m[7] ?? m[8] ?? '' });
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
    if (t.op === '') return true;
    if (t.op === '=') return v === t.val;
    throw new Error(`stub: unsupported attribute operator ${t.op}`);
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

// Inline style: scale/translate/transform are plain fields, removeProperty clears them.
class FakeStyle {
  removeProperty(name) { delete this[name]; }
  setProperty(name, value) { this[name] = String(value); }
}

let animations = [];
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.id = ''; this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = '';
    this.rect = null; this.style = new FakeStyle(); this.attrs = new Map(); this.classes = new Set();
    listenerHost(this);
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, force) => { const on = force === undefined ? !this.classes.has(name) : !!force; on ? this.classes.add(name) : this.classes.delete(name); return on; },
    };
  }
  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); this.children.forEach((child) => { child.parentElement = null; }); this.children = []; }
  get src() { return this.getAttribute('src') ?? ''; }
  set src(value) { this.setAttribute('src', value); }
  setAttribute(key, value) {
    this.attrs.set(key, String(value));
    if (key === 'id') this.id = String(value);
    if (key === 'class') this.className = value;
    if (key === 'hidden') this.hidden = true;
    if (key.startsWith('data-')) this.dataset[camel(key.slice(5))] = String(value);
  }
  getAttribute(key) { return attrValue(this, key); }
  appendChild(node) { this.append(node); return node; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      node.parentElement = this; this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children.forEach((child) => { child.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
  matches(selector) { return matchesSelector(this, selector); }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
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
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
  select() { document.selectedText = this.value; }
  setPointerCapture() {}
  hasPointerCapture() { return false; }
  releasePointerCapture() {}
  animate(frames, options) {
    const animation = { frames, options, done: false, cancelled: false, onfinish: null, cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation;
  }
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  }
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
      for (let i = stack.length - 1; i > 0; i -= 1) if (stack[i].tag === name) { stack.length = i; break; }
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
      }
      stack[stack.length - 1].append(el);
      if (SKIP_CONTENT.has(el.tag)) {
        token.lastIndex = source.toLowerCase().indexOf(`</${el.tag}>`, token.lastIndex) + el.tag.length + 3;
        continue;
      }
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] && stack.length > 1) stack[stack.length - 1]._text += m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  }
  return { top };
}

const mediaState = { standalone: false, reduced: false, changeListeners: [] };
function matchMedia(query) {
  return {
    media: query,
    get matches() {
      if (query === '(display-mode: standalone)') return mediaState.standalone;
      if (query === '(prefers-reduced-motion: reduce)') return mediaState.reduced;
      return false;
    },
    addEventListener(type, fn) { if (type === 'change') mediaState.changeListeners.push(fn); },
  };
}

function stubBrowser(store = new Map()) {
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  const { top } = parseHtml(readFileSync(new URL('index.html', root), 'utf8'));
  const htmlEl = top.children.find((child) => child.tag === 'html');
  const body = htmlEl.children.find((child) => child.tag === 'body');
  const ids = new Map();
  for (const el of top.querySelectorAll('[id]')) ids.set(el.id, el);
  // A missing id is a failure of the test, as it would be a TypeError in the browser: nothing is auto-created.
  const byId = (id) => { assert.ok(ids.has(id), `index.html defines #${id}`); return ids.get(id); };
  byId('wheel-wrap').rect = { left: 100, top: 200, width: 200, height: 200 };

  document = {
    activeElement: null, visibilityState: 'visible', hidden: false, readyState: 'loading', selectedText: null, copied: [],
    body, head: htmlEl.children.find((child) => child.tag === 'head'), documentElement: htmlEl,
    getElementById: (id) => ids.get(id) || null,
    querySelector: (selector) => top.querySelector(selector),
    querySelectorAll: (selector) => top.querySelectorAll(selector),
    createElement: (tag) => new FakeElement(tag),
    execCommand: (name) => { if (name === 'copy') document.copied.push(document.selectedText); return name === 'copy'; },
  };
  listenerHost(document);

  const wake = { requests: [], failNext: false, gate: null, openGate: null };
  const navigator = {
    userAgent: 'node-test', standalone: false, registered: [], vibrations: [], clipboard: null,
    vibrate: (ms) => { navigator.vibrations.push(ms); return true; },
    wakeLock: {
      request: async (type) => {
        if (wake.failNext) { wake.failNext = false; throw new Error('NotAllowedError'); }
        if (wake.gate) await wake.gate;
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { if (name === 'release') lock.handlers.push(fn); };
        lock.release = async () => { if (lock.released) return; lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        wake.requests.push(lock);
        return lock;
      },
    },
    serviceWorker: { register: async (url, options) => { const registration = { url, options, updated: 0, update: async () => { registration.updated += 1; } }; navigator.registered.push(registration); return registration; } },
  };
  // The browser, not the page, releases a screen wake lock when the document becomes hidden. Registered before any
  // page script, so it runs first on visibilitychange. The tests never release a lock on the app's behalf.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const lock of wake.requests) if (!lock.released) lock.release();
  });

  const frames = new Map();
  let frameId = 0;
  const location = { hash: '', search: '', hostname: 'example.test', protocol: 'https:', origin: 'https://example.test', pathname };
  window = {
    document, localStorage, location, navigator, innerWidth: 400, innerHeight: 800, setTimeout, clearTimeout, matchMedia,
    Event: class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    requestAnimationFrame: (fn) => { frameId += 1; frames.set(frameId, fn); return frameId; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
  };
  listenerHost(window);
  const runFrames = () => { const due = [...frames.values()]; frames.clear(); due.forEach((fn) => fn(performance.now())); };

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('localStorage', localStorage);
  define('matchMedia', matchMedia);
  animations = [];
  mediaState.changeListeners = [];
  return { store, localStorage, byId, wake, navigator, runFrames, pending: () => frames.size };
}

// Dispatches like a browser: capture from window down, then bubble up; stopPropagation is honoured. A listener that
// throws or rejects is recorded as an uncaught error.
async function fire(target, type, init = {}, { optional = false } = {}) {
  const event = {
    type, target, timeStamp: performance.now(), cancelable: true, defaultPrevented: false, stopped: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...init,
  };
  const chain = [];
  if (target !== window) {
    if (target !== document) for (let node = target; node; node = node.parentElement) chain.push(node);
    chain.push(document);
  }
  chain.push(window);
  if (!optional) assert.ok(chain.some((node) => (node.listeners[type] || []).length > 0), `a listener is registered for ${type}`);
  const pending = [];
  const run = (node, capture) => {
    for (const entry of [...(node.listeners[type] || [])]) {
      if (entry.capture !== capture) continue;
      if (entry.once) node.removeEventListener(type, entry.fn);
      try {
        const result = entry.fn.call(node, event);
        if (result && typeof result.then === 'function') pending.push(result);
      } catch (error) { errors.push(`uncaught listener error on ${type}: ${error?.stack || error}`); }
    }
  };
  for (const capture of [true, false]) {
    for (const node of capture ? [...chain].reverse() : chain) {
      run(node, capture);
      if (event.stopped) break;
    }
    if (event.stopped) break;
  }
  for (const result of await Promise.allSettled(pending)) if (result.status === 'rejected') errors.push(`rejected listener on ${type}: ${result.reason?.stack || result.reason}`);
  return event;
}

const pageScripts = (() => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(([, attrs, body]) => ({
    src: attrs.match(/\bsrc="([^"]+)"/)?.[1] || null, module: /type="module"/.test(attrs), defer: /\bdefer\b/.test(attrs), body,
  }));
})();

// Loads the page as the browser does: immediate scripts, then deferred scripts in document order (the module entry
// is deferred by nature), then DOMContentLoaded and load.
async function bootPage(search = '') {
  const immediate = pageScripts.filter((script) => !script.module && !script.defer);
  const deferred = pageScripts.filter((script) => script.module || script.defer);
  // Personal and friend builds both ship update-prompt.js.
  const expectedOrder = ['./settings-ui.js', './update-prompt.js', './app.js'];
  assert.deepEqual(deferred.map((script) => script.src), expectedOrder, 'index.html loads the expected scripts in order');
  assert.equal(deferred[deferred.length - 1].module, true);
  for (const script of immediate) runInThisContext(readFileSync(new URL(script.src, root), 'utf8'), { filename: script.src });
  for (const script of deferred) {
    if (script.module) { const url = new URL(script.src, root); url.search = search; await import(url); }
    else runInThisContext(readFileSync(new URL(script.src, root), 'utf8'), { filename: script.src });
  }
  document.readyState = 'interactive';
  await fire(document, 'DOMContentLoaded', {}, { optional: true });
  document.readyState = 'complete';
  await fire(window, 'load', {}, { optional: true });
  await settle();
}

let env = stubBrowser();
const node = (id) => env.byId(id);
const stored = (key) => env.localStorage.getItem(key);
const state = () => JSON.parse(stored(KEYS.state));
const liveLocks = () => env.wake.requests.filter((lock) => !lock.released);
const ptr = (id, x, y, extra = {}) => ({ pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y, ...extra });
const touches = (...points) => points.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY }));
const circular = (a, b) => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);
const rotationOf = (el) => Number(el.style.transform.match(/^rotate\((-?[\d.e+-]+)deg\)$/)[1]);

async function tapWheel(x, y) {
  await fire(node('wheel-wrap'), 'pointerdown', ptr(1, x, y));
  await fire(node('wheel-wrap'), 'pointerup', ptr(1, x, y));
}
// A swipe on the wheel: starts at the top (angle 0), curves a little, ends on the right/left side.
async function swipe(clockwise = true) {
  const wrap = node('wheel-wrap');
  const [start, mid, end] = clockwise ? [[200, 200], [260, 220], [300, 300]] : [[200, 200], [140, 220], [100, 300]];
  await fire(wrap, 'pointerdown', ptr(1, ...start));
  await fire(wrap, 'pointermove', ptr(1, ...mid));
  await fire(wrap, 'pointerup', ptr(1, ...end));
}
function finishSpin() {
  const animation = animations.find((item) => !item.done);
  assert.ok(animation, 'a spin animation is running');
  animation.done = true;
  animation.onfinish();
  return animation;
}
async function twoFingerSwipe(dx = 0, dy = 140) {
  await fire(document, 'touchstart', { touches: touches([1, 100, 300]) });
  await fire(document, 'touchstart', { touches: touches([1, 100, 300], [2, 300, 300]) });
  const moved = await fire(document, 'touchmove', { touches: touches([1, 100 + dx, 300 + dy], [2, 300 + dx, 300 + dy]) });
  await fire(document, 'touchend', { touches: [] });
  return moved;
}
const settingsOpen = () => node('settings').hidden === false;
async function openSettings() {
  const moved = await twoFingerSwipe();
  assert.equal(moved.defaultPrevented, true);
  assert.equal(settingsOpen(), true);
}
// deferred: the user's answer is given later through log.answer(), so a test can look at the page while the prompt is open.
const nativeInstall = (outcome, { throws = false, deferred = false } = {}) => {
  const log = { prompted: 0, answer: null };
  const userChoice = deferred ? new Promise((resolve) => { log.answer = () => resolve({ outcome }); }) : Promise.resolve({ outcome });
  return { log, init: { prompt: async () => { log.prompted += 1; if (throws) throw new Error('InvalidStateError'); }, userChoice } };
};

const ACCEPTED = '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.';
const MANUAL = '브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.';

test('boot: settings-ui.js runs as a classic script and app.js loads as a module with logic.js, reaching the ready stage', async () => {
  await bootPage();
  assert.equal(typeof window.MagicSettingsUI.installGuide, 'function', 'settings-ui.js classic script ran');
  assert.deepEqual(state(), { targetAngle: null, forceSpin: 4, spins: 0, previousAngle: null, rotation: 0 }, 'boot saves the default state');
  assert.equal(node('guide').hidden, false, 'first run shows the guide');
  assert.equal(node('settings').hidden, true);
  assert.equal(node('target-value').textContent, '선택 전');
  assert.equal(node('spin-value').textContent, '0회');
  assert.equal(node('force-spin').value, '4');
  assert.equal(node('wheel-wrap').dataset.targetCue, 'idle');
  assert.equal(node('target-corner-left').dataset.targetCue, 'idle');
  assert.equal(document.querySelector('.stage').dataset.tableTheme, 'emerald');
  assert.equal(document.querySelector('.stage').dataset.screenDesign, 'casino');
  assert.equal(node('spinner-arrow').src, './casino-assets/arrow.svg');
  assert.equal(node('spinner-arrow').style.transform, 'rotate(0deg)');
  assert.equal(node('spin-status').parentElement.classes.has('stage-bottom'), true);
  assert.equal(node('install-app-group').hidden, false);
  assert.equal(node('install-app-group').dataset.installState, 'browser');
  assert.equal(node('install-help').hidden, true);
  assert.equal(env.navigator.registered.length, 1);
  assert.equal(env.navigator.registered[0].url, './sw.js');
  assert.deepEqual(env.navigator.registered[0].options, { updateViaCache: 'none' });
  assert.equal(env.navigator.registered[0].updated, 1, 'registration.update() is called');
  assert.equal(env.wake.requests.length, 1, 'boot requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);

  const overview = document.querySelector('.magic-overview');
  assert.ok(overview, 'settings-ui.js mounted its overview into [data-settings-root]');
  assert.equal(overview.parentElement, node('settings').children[0]);
  assert.equal(overview.querySelector('h2').textContent, 'TYCHE');
  assert.deepEqual(overview.querySelectorAll('p').map((p) => p.textContent), [
    '티케는 우연. 누구 편도 아닌 우연이 한 번만 방향을 가져요.',
    '운명이라기엔 짧고, 우연이라기엔 정확한 순간이에요.',
    FRIEND ? '같이 쓰거나 선물하려고 만들었어요. 편하게 즐겨 주세요.' : '같이 쓰거나 선물하려고 만들었어요. 화면은 조금씩 바꿀 수 있어요.',
  ]);
  assert.equal(document.querySelector('.magic-customize-open') !== null, !FRIEND, 'the appearance page exists only in the personal build');
  assert.equal(document.querySelector('.magic-contact-link') !== null, true);
});

test('guide: blocks the wheel and the settings swipe until it is dismissed, then remembers the dismissal', async () => {
  const guide = node('guide');
  assert.equal(guide.hidden, false);
  await tapWheel(300, 300);
  assert.equal(state().targetAngle, null, 'wheel input is ignored while the guide is open');
  const moved = await twoFingerSwipe();
  assert.equal(moved.defaultPrevented, false);
  assert.equal(settingsOpen(), false, 'settings cannot open while the guide is shown');
  assert.equal(stored(KEYS.guide), null);

  await fire(node('guide-close'), 'click');
  assert.equal(guide.hidden, true);
  assert.equal(stored(KEYS.guide), '1');
});

test('target: the first touch picks the secret direction, the cue changes and the device vibrates once', async () => {
  const wrap = node('wheel-wrap');
  // A non-primary pointer is ignored.
  await fire(wrap, 'pointerdown', ptr(5, 300, 300, { isPrimary: false }));
  await fire(wrap, 'pointerup', ptr(5, 300, 300, { isPrimary: false }));
  assert.equal(state().targetAngle, null);
  // A touch outside the wheel is ignored.
  await fire(document.querySelector('.stage'), 'pointerdown', ptr(6, 300, 300));
  await fire(document.querySelector('.stage'), 'pointerup', ptr(6, 300, 300));
  assert.equal(state().targetAngle, null);

  await tapWheel(300, 300); // right of the centre (200,300): 90 degrees
  assert.ok(Math.abs(state().targetAngle - 90) < 1e-9, `target angle is 90, got ${state().targetAngle}`);
  assert.equal(state().spins, 0);
  assert.deepEqual(env.navigator.vibrations, [12]);
  assert.equal(wrap.dataset.targetCue, 'acknowledged');
  assert.equal(wrap.classes.has('target-cue-acknowledged'), true);
  assert.equal(document.querySelector('.stage').dataset.targetCue, 'acknowledged');
  assert.equal(document.querySelector('.stage').classes.has('target-cue-acknowledged'), true);
  for (const id of ['target-corner-left', 'target-corner-right']) {
    assert.equal(node(id).dataset.targetCue, 'acknowledged');
    assert.equal(node(id).classes.has('is-acknowledged'), true);
  }
  assert.equal(node('spinner-arrow').style.transform, 'rotate(0deg)', 'choosing the target does not turn the arrow');
});

test('settings swipe: only a two-finger downward drag opens settings, and it releases the wake lock', async () => {
  const before = await twoFingerSwipe(100, 100);
  assert.equal(before.defaultPrevented, false, 'a diagonal drag is not the gesture');
  const short = await twoFingerSwipe(0, 60);
  assert.equal(short.defaultPrevented, false, 'a short drag is not the gesture');
  assert.equal(settingsOpen(), false);

  // Three fingers block the gesture until every finger is lifted.
  await fire(document, 'touchstart', { touches: touches([1, 50, 300], [2, 150, 300], [3, 250, 300]) });
  await fire(document, 'touchstart', { touches: touches([1, 100, 300], [2, 300, 300]) });
  const blocked = await fire(document, 'touchmove', { touches: touches([1, 100, 440], [2, 300, 440]) });
  assert.equal(blocked.defaultPrevented, false);
  assert.equal(settingsOpen(), false);
  await fire(document, 'touchend', { touches: [] });

  assert.equal(liveLocks().length, 1);
  await openSettings();
  assert.equal(node('target-value').textContent, '위치 지정됨');
  assert.equal(node('spin-value').textContent, '0회');
  assert.equal(node('force-spin').value, '4');
  assert.equal(liveLocks().length, 0, 'settings does not hold the screen awake');
  assert.equal(env.wake.requests.length, 1);

  // While settings is open the wheel and a second swipe do nothing.
  await tapWheel(200, 200);
  assert.ok(Math.abs(state().targetAngle - 90) < 1e-9, 'wheel input is ignored while settings is open');
  const again = await twoFingerSwipe();
  assert.equal(again.defaultPrevented, false);
});

test('settings controls: forced turn, table colour, screen design and clearing the target are saved', async () => {
  node('force-spin').value = '3';
  await fire(node('force-spin'), 'change');
  assert.equal(state().forceSpin, 3);
  assert.equal(node('spin-value').textContent, '0회');

  const stage = document.querySelector('.stage');
  node('table-theme').value = 'burgundy';
  await fire(node('table-theme'), 'change');
  assert.equal(stage.dataset.tableTheme, 'burgundy');
  assert.equal(stored(KEYS.theme), 'burgundy');
  node('table-theme').value = 'nonsense';
  await fire(node('table-theme'), 'change');
  assert.equal(stage.dataset.tableTheme, 'emerald', 'an unknown colour falls back to the default table');
  assert.equal(stored(KEYS.theme), 'emerald');
  node('table-theme').value = 'burgundy';
  await fire(node('table-theme'), 'change');

  node('screen-design').value = 'hybrid';
  await fire(node('screen-design'), 'change');
  assert.equal(stage.dataset.screenDesign, 'hybrid');
  assert.equal(stored(KEYS.design), 'hybrid');
  assert.equal(node('spinner-arrow').src, './hybrid-assets/arrow.svg');
  assert.equal(node('spin-status').parentElement.classes.has('instrument-header'), true, 'the status line moves to the header');
  node('screen-design').value = 'casino';
  await fire(node('screen-design'), 'change');
  assert.equal(node('spinner-arrow').src, './casino-assets/arrow.svg');
  assert.equal(node('spin-status').parentElement.classes.has('stage-bottom'), true);
  node('screen-design').value = 'hybrid';
  await fire(node('screen-design'), 'change');

  // "목표 다시 선택" clears the target, closes settings and the next touch selects again.
  await fire(node('clear-target'), 'click');
  assert.equal(state().targetAngle, null);
  assert.equal(node('target-value').textContent, '선택 전');
  assert.equal(node('wheel-wrap').dataset.targetCue, 'idle');
  assert.equal(node('target-corner-right').classes.has('is-acknowledged'), false);
  assert.equal(settingsOpen(), false);
  assert.equal(liveLocks().length, 1, 'closing settings requests the wake lock again');
  assert.equal(env.wake.requests.length, 2);
  await tapWheel(300, 300);
  assert.ok(Math.abs(state().targetAngle - 90) < 1e-9);

  await openSettings();
  await fire(node('settings-close'), 'click');
  assert.equal(settingsOpen(), false);
  assert.equal(liveLocks().length, 1);
  assert.equal(env.wake.requests.length, 3);
});

test('spins: queued swipes, outcome rules, the forced turn lands on the target, motion preference and busy settings', async () => {
  const arrow = node('spinner-arrow');
  const wrap = node('wheel-wrap');
  const target = state().targetAngle;
  // Live drag turns the arrow with the finger.
  await fire(wrap, 'pointerdown', ptr(1, 200, 200));
  await fire(wrap, 'pointermove', ptr(1, 260, 220));
  assert.ok(Math.abs(rotationOf(arrow) - 36.8698976) < 1e-5, `arrow follows the finger, got ${rotationOf(arrow)}`);
  await fire(wrap, 'pointercancel', ptr(1, 260, 220));
  assert.equal(arrow.style.transform, 'rotate(0deg)', 'a cancelled drag puts the arrow back');

  await swipe(true);
  assert.equal(animations.length, 1);
  assert.equal(node('spin-status').textContent, '회전 중…');
  assert.equal(animations[0].options.duration, 1100);
  assert.ok(Math.abs(Number(animations[0].frames[0].transform.match(/rotate\((.*)deg\)/)[1]) - 36.8698976) < 1e-5, 'the spin starts where the finger left the arrow');
  // Busy: a second swipe is queued, and the settings gesture is refused.
  await swipe(false);
  await swipe(true);
  assert.equal(animations.length, 1, 'later swipes wait in the queue');
  await twoFingerSwipe();
  assert.equal(settingsOpen(), false, 'settings does not open during a spin');

  mediaState.reduced = true; // read when the next queued spin starts
  const first = animations[0];
  const startRotation = Number(first.frames[0].transform.match(/rotate\((.*)deg\)/)[1]);
  const endRotation = Number(first.frames[1].transform.match(/rotate\((.*)deg\)/)[1]);
  assert.ok(endRotation - startRotation >= 720, 'a clockwise spin turns forward at least two full turns');
  finishSpin();
  const afterFirst = state();
  assert.equal(afterFirst.spins, 1);
  assert.equal(node('spin-status').textContent, '회전 중…', 'the queued spin starts at once');
  assert.ok(circular(afterFirst.previousAngle, target) > 30, `spin 1 keeps away from the target, got ${afterFirst.previousAngle}`);
  assert.ok(Math.abs(afterFirst.rotation - ((endRotation % 360) + 360) % 360) < 1e-6);
  assert.equal(animations.length, 2);
  assert.equal(animations[1].options.duration, 50, 'reduced motion shortens the animation');
  const secondStart = Number(animations[1].frames[0].transform.match(/rotate\((.*)deg\)/)[1]);
  const secondEnd = Number(animations[1].frames[1].transform.match(/rotate\((.*)deg\)/)[1]);
  assert.ok(secondEnd < secondStart && secondStart - secondEnd >= 720, 'a counter-clockwise swipe turns backwards');

  mediaState.reduced = false;
  finishSpin();
  const afterSecond = state();
  assert.equal(afterSecond.spins, 2);
  assert.ok(circular(afterSecond.previousAngle, target) > 30, 'spin 2 keeps away from the target');
  assert.ok(circular(afterSecond.previousAngle, afterFirst.previousAngle) > 10, 'spin 2 differs from spin 1 by more than 10 degrees');
  assert.equal(animations[2].options.duration, 1100);

  finishSpin();
  const afterThird = state();
  assert.equal(afterThird.spins, 3);
  assert.ok(Math.abs(afterThird.previousAngle - target) < 1e-9, `the forced third spin lands exactly on the target, got ${afterThird.previousAngle}`);
  assert.ok(Math.abs(rotationOf(arrow) % 360 - target) < 1e-6 || Math.abs((rotationOf(arrow) % 360 + 360) % 360 - target) < 1e-6, 'the arrow points at the target');
  assert.equal(node('spin-status').textContent, '', 'the status is cleared when the queue is empty');
  assert.equal(animations.every((item) => item.cancelled), true, 'finished animations are cancelled after the final style is set');
  assert.equal(animations.length, 3);
});

test('settings after spins show the count; "연출 다시 시작" resets target and count but keeps the forced turn and appearance', async () => {
  await openSettings();
  assert.equal(node('spin-value').textContent, '3회');
  assert.equal(node('target-value').textContent, '위치 지정됨');
  assert.equal(node('force-spin').value, '3');
  await fire(node('start-performance'), 'click');
  assert.equal(settingsOpen(), false);
  assert.equal(state().targetAngle, null);
  assert.equal(state().spins, 0);
  assert.equal(state().previousAngle, null);
  assert.equal(state().forceSpin, 3);
  assert.equal(node('target-value').textContent, '선택 전');
  assert.equal(node('wheel-wrap').dataset.targetCue, 'idle');
  assert.equal(document.querySelector('.stage').dataset.tableTheme, 'burgundy');
  assert.equal(liveLocks().length, 1);
  // The next touch selects a new target and does not spin.
  await tapWheel(100, 300); // left of centre: 270 degrees
  assert.ok(Math.abs(state().targetAngle - 270) < 1e-9);
  assert.equal(animations.length, 3);
});

test('wake lock: the browser releases it on hide, it is requested again when visible, refusal and late grants are handled', async () => {
  const setVisible = async (visible) => {
    document.hidden = !visible;
    document.visibilityState = visible ? 'visible' : 'hidden';
    await fire(document, 'visibilitychange');
    await settle();
  };
  const base = env.wake.requests.length;
  const first = liveLocks()[0];
  assert.ok(first);
  await setVisible(false);
  assert.equal(first.released, true, 'the hidden page lost its lock');
  assert.equal(liveLocks().length, 0);
  assert.equal(env.wake.requests.length, base, 'no new lock is requested while hidden');
  await setVisible(true);
  assert.equal(env.wake.requests.length, base + 1);
  assert.equal(liveLocks().length, 1);
  assert.equal(liveLocks()[0].type, 'screen');

  // A system release while the page is visible makes the app ask again.
  await liveLocks()[0].release();
  await settle();
  assert.equal(env.wake.requests.length, base + 2);
  assert.equal(liveLocks().length, 1);

  // A refused request is tolerated and the next visibility change retries.
  await setVisible(false);
  env.wake.failNext = true;
  await setVisible(true);
  assert.equal(liveLocks().length, 0, 'the refusal leaves no lock');
  await setVisible(false);
  await setVisible(true);
  assert.equal(liveLocks().length, 1, 'a later visible event acquires the lock');

  // A grant that arrives after the page became hidden is handed back.
  await setVisible(false);
  env.wake.gate = new Promise((resolve) => { env.wake.openGate = resolve; });
  await setVisible(true);
  const pendingCount = env.wake.requests.length;
  document.hidden = true;
  document.visibilityState = 'hidden';
  await fire(document, 'visibilitychange');
  env.wake.openGate();
  env.wake.gate = null;
  await settle();
  assert.equal(env.wake.requests.length, pendingCount + 1);
  assert.equal(env.wake.requests.at(-1).released, true, 'a lock granted after hiding is released again');
  assert.equal(liveLocks().length, 0);
  await setVisible(true);
  assert.equal(liveLocks().length, 1);

  // Settings open: going hidden and visible must not take a new lock.
  await openSettings();
  const during = env.wake.requests.length;
  await setVisible(false);
  await setVisible(true);
  assert.equal(env.wake.requests.length, during, 'no lock while settings is open');
  assert.equal(liveLocks().length, 0);
  await fire(node('settings-close'), 'click');
  assert.equal(liveLocks().length, 1);
});

test('install (app.js): native prompt outcomes, manual instructions, appinstalled and standalone display', async () => {
  await openSettings();
  const help = node('install-help');
  const group = node('install-app-group');
  assert.equal(help.hidden, true);

  const accepted = nativeInstall('accepted');
  const event = await fire(window, 'beforeinstallprompt', accepted.init);
  assert.equal(event.defaultPrevented, true, 'the browser mini-infobar is suppressed');
  assert.equal(window.__magicInstallPrompt, event, 'settings-ui.js keeps the event in the shared slot');
  await fire(node('install-app'), 'click');
  assert.equal(accepted.log.prompted, 1);
  assert.equal(help.textContent, ACCEPTED);
  assert.equal(help.hidden, false);

  env.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  await fire(node('install-app'), 'click');
  assert.equal(help.textContent, 'Safari에서 공유 → 홈 화면에 추가를 선택하세요.', 'no pending prompt: iOS gets the Safari steps');
  env.navigator.userAgent = 'node-test';

  const dismissed = nativeInstall('dismissed');
  await fire(window, 'beforeinstallprompt', dismissed.init);
  await fire(node('install-app'), 'click');
  assert.equal(dismissed.log.prompted, 1);
  assert.equal(help.textContent, MANUAL, 'a dismissed prompt falls back to the menu instructions');

  help.textContent = '';
  const refused = nativeInstall('accepted', { throws: true });
  await fire(window, 'beforeinstallprompt', refused.init);
  await fire(node('install-app'), 'click');
  assert.equal(refused.log.prompted, 1);
  assert.equal(help.textContent, MANUAL, 'a refused prompt() falls back to the menu instructions');

  await fire(window, 'appinstalled');
  assert.equal(window.__magicInstallPrompt, null);
  assert.equal(help.textContent, '설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.');

  // The app starts in standalone display: the install group disappears and the root class is set.
  mediaState.standalone = true;
  help.textContent = 'unchanged';
  mediaState.changeListeners.forEach((fn) => fn({ matches: true }));
  assert.equal(group.hidden, true);
  assert.equal(group.dataset.installState, 'hidden');
  assert.equal(group.classes.has('is-installed'), true);
  assert.equal(document.documentElement.classes.has('spinner-standalone'), true);
  await fire(node('install-app'), 'click');
  assert.equal(help.textContent, 'unchanged', 'standalone click only re-syncs the group');
  const standaloneEvent = nativeInstall('accepted');
  await fire(window, 'beforeinstallprompt', standaloneEvent.init);
  await fire(window, 'appinstalled');
  assert.equal(help.textContent, 'unchanged', 'appinstalled in standalone shows no help');
  mediaState.standalone = false;
  mediaState.changeListeners.forEach((fn) => fn({ matches: false }));
  assert.equal(group.hidden, false);
  assert.equal(group.dataset.installState, 'browser');
  assert.equal(document.documentElement.classes.has('spinner-standalone'), false);
});

test('install and contact (settings-ui.js): manual install button, guides and the feedback footer', async () => {
  const button = document.querySelector('.magic-install-button');
  const status = document.querySelector('.magic-install-status');
  assert.equal(button.textContent, '수동 설치');
  assert.equal(status.hidden, true);
  const texts = () => status.children.map((child) => child.textContent);
  const steps = () => status.querySelectorAll('li').map((li) => li.textContent);

  await fire(button, 'click');
  assert.equal(status.hidden, false);
  assert.equal(status.children[0].textContent, '브라우저에서 직접 설치해요.');
  assert.deepEqual(steps(), ['주소창 오른쪽의 설치 아이콘을 누르세요.', "없으면 브라우저 메뉴에서 '앱 설치' 또는 '홈 화면에 추가'를 고르세요."]);

  env.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  await fire(button, 'click');
  assert.equal(status.children[0].textContent, '아이폰과 아이패드는 직접 추가해요.');
  assert.equal(steps().length, 3);
  env.navigator.userAgent = 'node-test';

  const accepted = nativeInstall('accepted', { deferred: true });
  await fire(window, 'beforeinstallprompt', accepted.init);
  await fire(button, 'click');
  assert.equal(button.disabled, true, 'the button is disabled while the prompt is open');
  accepted.log.answer();
  await settle();
  assert.equal(accepted.log.prompted, 1);
  assert.equal(button.disabled, false);
  assert.equal(window.__magicInstallPrompt, null, 'the shared event is used once');
  assert.deepEqual(texts(), ['설치를 시작했어요. 홈 화면에서 앱 아이콘을 확인해 주세요.']);

  const dismissed = nativeInstall('dismissed');
  await fire(window, 'beforeinstallprompt', dismissed.init);
  await fire(button, 'click');
  await settle();
  assert.deepEqual(texts(), ['설치를 취소했어요. 다시 누르면 직접 설치하는 방법을 알려드려요.']);

  const refused = nativeInstall('accepted', { throws: true });
  // prompt() throwing synchronously is the "already used" case of a browser that refuses the call.
  refused.init.prompt = () => { throw new Error('InvalidStateError'); };
  await fire(window, 'beforeinstallprompt', refused.init);
  await fire(button, 'click');
  assert.equal(status.children[0].textContent, '브라우저에서 직접 설치해요.', 'a refused prompt shows the manual guide');

  mediaState.standalone = true;
  await fire(button, 'click');
  assert.deepEqual(texts(), ['이미 설치된 앱으로 실행 중이에요.']);
  mediaState.standalone = false;

  const link = document.querySelector('.magic-contact-link');
  assert.equal(link.textContent, '카카오톡 문의');
  assert.equal(link.href, 'https://qr.kakao.com/talk/eshVqDvk7WKk0zDKtiC9UTa.T6Q-');
  assert.equal(link.rel, 'noopener noreferrer');
  const copy = document.querySelector('.magic-contact-copy');
  assert.equal(document.querySelector('.magic-contact-id').textContent, 'ID: KaliDCerona');
  const written = [];
  env.navigator.clipboard = { writeText: async (text) => { written.push(text); } };
  await fire(copy, 'click');
  await settle();
  assert.deepEqual(written, ['KaliDCerona']);
  assert.equal(copy.textContent, '복사됨');
  env.navigator.clipboard = { writeText: async () => { throw new Error('denied'); } };
  copy.textContent = 'ID 복사';
  await fire(copy, 'click');
  await settle();
  assert.deepEqual(document.copied, ['KaliDCerona'], 'a refused clipboard falls back to a selected textarea and execCommand');
  assert.equal(copy.textContent, '복사됨');
});

test('install: one beforeinstallprompt event is prompted once even if both install buttons are tapped', async () => {
  assert.equal(settingsOpen(), true, 'settings stay open from the previous install tests');
  for (const order of ['app first, then settings', 'settings first, then app']) {
    const calls = { prompted: 0 };
    // A real browser rejects a second prompt() on the same event with InvalidStateError.
    const init = { prompt: async () => { calls.prompted += 1; if (calls.prompted > 1) throw new Error('InvalidStateError'); }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
    const event = await fire(window, 'beforeinstallprompt', init);
    assert.equal(window.__magicInstallPrompt, event);
    const taps = [() => fire(node('install-app'), 'click'), () => fire(document.querySelector('.magic-install-button'), 'click')];
    if (order.startsWith('settings')) taps.reverse();
    for (const tap of taps) { await tap(); await settle(5); }
    assert.equal(calls.prompted, 1, `${order}: the shared event is prompted exactly once`);
    assert.equal(window.__magicInstallPrompt, null, `${order}: using the event clears the shared slot`);
  }
});

test('appearance page: personal build lets the wheel size and position be saved; the friend build has no such page', async () => {
  const hasKey = [...env.store.keys()].some((key) => key.startsWith('magic-appearance'));
  if (FRIEND) {
    assert.equal(document.querySelector('.magic-customize-open'), null);
    assert.equal(document.querySelector('#magic-customize-page'), null);
    assert.equal(hasKey, false, 'the friend build never touches appearance storage');
    return;
  }
  const appearanceEvents = [];
  document.addEventListener('magic-appearance-change', (event) => appearanceEvents.push(event.detail.app));
  env.runFrames();
  assert.deepEqual(appearanceEvents, ['spinner'], 'the first layout pass announces the appearance');
  assert.equal(node('wheel-wrap').style.scale, undefined, 'default appearance leaves the wheel untouched');

  await fire(document.querySelector('.magic-customize-open'), 'click');
  const page = document.querySelector('#magic-customize-page');
  assert.equal(page.hidden, false);
  assert.equal(page.getAttribute('aria-label'), '화면 커스텀');
  const fields = document.querySelectorAll('.magic-appearance-field');
  assert.deepEqual(fields.map((label) => label.textContent), ['표시 크기', '위아래 위치', '좌우 위치']);
  const [scale, offset, axisX] = fields.map((label) => label.querySelector('input'));
  assert.deepEqual([scale.value, offset.value, axisX.value], [100, 0, 0]);
  assert.deepEqual(fields.map((label) => label.querySelector('output').textContent), ['100%', '0vh', '0vw']);

  scale.value = '120';
  await fire(scale, 'input');
  env.runFrames();
  assert.equal(node('wheel-wrap').style.scale, '1.2');
  assert.equal(node('wheel-wrap').style.translate, '0px 0px');
  offset.value = '5';
  await fire(offset, 'input');
  axisX.value = '10';
  await fire(axisX, 'input');
  env.runFrames();
  assert.equal(node('wheel-wrap').style.translate, '40px 40px', 'x 10 percent of 400 and y 5 percent of 800');
  assert.equal(fields[0].querySelector('output').textContent, '120%');
  // The plus button raises the value by its step through the same input listener.
  await fire(fields[0].querySelectorAll('button')[1], 'click');
  assert.equal(scale.value, 121);
  scale.value = '300';
  await fire(scale, 'input');
  env.runFrames();
  assert.equal(node('wheel-wrap').style.scale, '1.4', 'the size is clamped to 140 percent');
  scale.value = '120';
  await fire(scale, 'input');
  env.runFrames();

  // Touches on the page do not reach the stage handlers.
  const pointerdown = await fire(page, 'pointerdown', ptr(9, 10, 10));
  assert.equal(pointerdown.stopped, true);
  assert.equal(stored(APPEARANCE_KEY), null, 'nothing is stored before saving');

  const saveButton = document.querySelectorAll('.magic-appearance-actions button').find((item) => item.textContent === '저장');
  await fire(saveButton, 'click');
  assert.equal(stored(APPEARANCE_KEY), '{"scale":120,"offset":5,"x":10,"labels":{},"parts":{}}');
  assert.equal(document.querySelector('.magic-appearance-status').textContent, '이 기기에 저장했어요.');
  assert.equal(page.hidden, true, 'saving returns to settings');
  assert.equal(settingsOpen(), true);

  // Escape closes the page; the reset button clears the saved appearance.
  await fire(document.querySelector('.magic-customize-open'), 'click');
  assert.equal(page.hidden, false);
  await fire(page, 'keydown', { key: 'Escape' });
  assert.equal(page.hidden, true);
  await fire(document.querySelector('.magic-customize-open'), 'click');
  const clearButton = document.querySelectorAll('.magic-appearance-actions button').find((item) => item.textContent === '꾸미기 초기화');
  await fire(clearButton, 'click');
  env.runFrames();
  assert.equal(stored(APPEARANCE_KEY), null);
  assert.deepEqual([scale.value, offset.value, axisX.value], [100, 0, 0]);
  assert.equal(document.querySelector('.magic-appearance-status').textContent, '꾸미기를 처음 모습으로 돌렸어요.');
  assert.equal(node('wheel-wrap').style.scale, undefined);

  // Save once more so the relaunch test sees a stored appearance.
  scale.value = '120';
  await fire(scale, 'input');
  offset.value = '5';
  await fire(offset, 'input');
  axisX.value = '10';
  await fire(axisX, 'input');
  await fire(document.querySelectorAll('.magic-appearance-actions button').find((item) => item.textContent === '저장'), 'click');
  assert.equal(stored(APPEARANCE_KEY), '{"scale":120,"offset":5,"x":10,"labels":{},"parts":{}}');
  await fire(node('settings-close'), 'click');
});

test('relaunch: a fresh page load restores the saved choices, forgets the secret target and keeps storage keys of its own root', async () => {
  const savedRotation = state().rotation;
  assert.equal(state().forceSpin, 3);
  const store = env.store;
  env = stubBrowser(store);
  await bootPage('?relaunch=1');

  assert.deepEqual(state(), { targetAngle: null, forceSpin: 3, spins: 0, previousAngle: null, rotation: savedRotation }, 'the target and count are not carried over, the forced turn and rotation are');
  assert.equal(node('guide').hidden, true, 'the guide stays dismissed');
  assert.equal(node('force-spin').value, '3');
  const stage = document.querySelector('.stage');
  assert.equal(stage.dataset.tableTheme, 'burgundy');
  assert.equal(node('table-theme').value, 'burgundy');
  assert.equal(stage.dataset.screenDesign, 'hybrid');
  assert.equal(node('screen-design').value, 'hybrid');
  assert.equal(node('spinner-arrow').src, './hybrid-assets/arrow.svg');
  assert.equal(node('spin-status').parentElement.classes.has('instrument-header'), true);
  assert.equal(rotationOf(node('spinner-arrow')), savedRotation);
  assert.equal(env.wake.requests.length, 1, 'the guide is already dismissed, so the lock is requested at once');

  // The first touch of a new launch picks the target again, even with a saved state.
  await tapWheel(200, 200);
  assert.ok(Math.abs(state().targetAngle - 0) < 1e-9);
  assert.equal(animations.length, 0, 'that touch did not spin');

  if (!FRIEND) {
    env.runFrames();
    assert.equal(node('wheel-wrap').style.scale, '1.2', 'the saved appearance is applied on load');
    assert.equal(node('wheel-wrap').style.translate, '40px 40px');
    const fields = document.querySelectorAll('.magic-appearance-field');
    assert.deepEqual(fields.map((label) => label.querySelector('input').value), [120, 5, 10]);
  }
  const keys = [...store.keys()];
  assert.deepEqual(keys.filter((key) => key.startsWith(`${OTHER_PREFIX}-`)), [], 'no key of the other build is written');
  assert.deepEqual(keys.filter((key) => key.startsWith(`${PREFIX}-`)).sort(), [KEYS.design, KEYS.guide, KEYS.state, KEYS.theme].sort());
});
