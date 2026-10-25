import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { pathToFileURL } from 'node:url';

// Loads the friend-only 과유불급 stopwatch (distribution-snapshots/gwayubulgeup) exactly as its index.html does:
// the inline pre-paint head script, install-nudge.js and sw-register.js run as classic scripts, settings-ui.js is
// a deferred classic script, and app.js is a real ES module whose imports (logic.js, settings-swipe.js,
// wake-lock.js) load as separate modules. A module that uses an identifier it does not import throws
// ReferenceError here, as it does in a browser. Script order follows the browser: scripts without defer in
// document order, then the deferred ones (the module included), then DOMContentLoaded and load.
// The DOM is parsed from the real index.html; a missing id returns null and nothing is auto-created.
// The page clock (Date, performance.now) is controlled by the test and moves only through advance().
// gwayubulgeup.test.mjs checks the pure trick maths and the page markup statically; this file drives the running app.
// Not covered: the appearance editor settings-ui.js mounts (it needs a full DOM; its mount runs on the stub),
// animation layout, and sw.js itself. GWAYU_ROOT lets a mutation check point the same test at a scratch copy.
const root = process.env.GWAYU_ROOT ? pathToFileURL(`${process.env.GWAYU_ROOT.replace(/\/?$/, '/')}`) : new URL('../../distribution-snapshots/gwayubulgeup/', import.meta.url);

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
const realPerformance = globalThis.performance;
const RealDate = Date;
afterEach(async () => {
  await settle();
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
});
const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function listenerHost(target) {
  target.listeners = {};
  target.addEventListener = (type, fn, options) => {
    (target.listeners[type] ||= []).push({ fn, capture: options === true || !!(options && options.capture), once: !!(options && options.once) });
  };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item.fn !== fn); };
}

// ----- selector matching (the subset the app and settings-ui use) -----
const PIECE = /^(?:([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]|:not\(\[([\w-]+)(?:=(?:"([^"]*)"))?\]\))/;
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
    else if (m[9]) tests.push({ not: { attr: m[9], val: m[10] } });
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
    if (t.not) { const v = attrValue(el, t.not.attr); return !(v !== null && (t.not.val === undefined || v === t.not.val)); }
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

class FakeStyle {
  removeProperty(name) { delete this[camel(name)]; }
  setProperty(name, value) { this[camel(name)] = value; }
  getPropertyValue(name) { return this[camel(name)] ?? ''; }
}
let document;
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.nodeType = 1; this.id = ''; this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = ''; this.scrollTop = 0;
    this.style = new FakeStyle(); this.attrs = new Map(); this.classes = new Set();
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
  set innerHTML(value) { this.replaceChildren(...parseHtml(String(value)).top.children); }
  setAttribute(key, value) {
    this.attrs.set(key, String(value));
    if (key === 'id') this.id = String(value);
    if (key === 'class') this.className = value;
    if (key === 'hidden') this.hidden = true;
    if (key.startsWith('data-')) this.dataset[camel(key.slice(5))] = String(value);
  }
  removeAttribute(key) { this.attrs.delete(key); if (key.startsWith('data-')) delete this.dataset[camel(key.slice(5))]; }
  getAttribute(key) { return attrValue(this, key); }
  appendChild(node) { this.append(node); return node; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      node.parentElement = this; this.children.push(node);
    }
  }
  prepend(...nodes) { for (const node of nodes) { if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node); node.parentElement = this; } this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children.forEach((child) => { child.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
  contains(node) { for (let n = node; n; n = n.parentElement) if (n === this) return true; return false; }
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
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
}

// ----- parse real HTML into the stub DOM; nothing is created on demand -----
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
const SKIP_CONTENT = new Set(['script', 'style', 'noscript']);
const decode = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
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
        const v = decode(a ?? b ?? c ?? '');
        el.setAttribute(k, v);
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
    if (m[5] && stack.length > 1) stack[stack.length - 1]._text += decode(m[5]).trim();
  }
  return { top };
}

// ----- controlled clock: Date and performance.now move only through advance() -----
const START = new RealDate(2026, 9, 25, 14, 5, 0).getTime();
let clockNow = START;
class FixedDate extends RealDate {
  constructor(...args) { if (args.length) super(...args); else super(clockNow); }
  static now() { return clockNow; }
}
const frames = new Map();
let frameId = 0;
function advance(ms) { clockNow += ms; }
// Runs the animation frames the page has queued, once, at the current page time.
function runFrames() { const due = [...frames.values()]; frames.clear(); due.forEach((fn) => fn(clockNow)); }

function stubBrowser() {
  const store = new Map();
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  const { top } = parseHtml(readFileSync(new URL('index.html', root), 'utf8'));
  const htmlEl = top.children.find((child) => child.tag === 'html');
  const body = htmlEl.children.find((child) => child.tag === 'body');
  const head = htmlEl.children.find((child) => child.tag === 'head');

  document = {
    activeElement: null, visibilityState: 'visible', hidden: false, readyState: 'loading', title: head.querySelector('title')._text,
    body, head, documentElement: htmlEl,
    getElementById: (id) => top.querySelector(`#${id}`),
    querySelector: (selector) => top.querySelector(selector),
    querySelectorAll: (selector) => top.querySelectorAll(selector),
    createElement: (tag) => new FakeElement(tag),
    execCommand: () => false,
  };
  listenerHost(document);

  const wake = { requests: [], failNext: false };
  const navigator = {
    userAgent: 'node-test', maxTouchPoints: 5, onLine: true, registered: [],
    wakeLock: {
      request: async (type) => {
        if (wake.failNext) { wake.failNext = false; throw new Error('NotAllowedError'); }
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { if (name === 'release') lock.handlers.push(fn); };
        lock.release = async () => { lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        wake.requests.push(lock);
        return lock;
      },
    },
    serviceWorker: { register: async (url) => { navigator.registered.push(url); } },
  };
  // The browser, not the page, releases a screen wake lock when the document becomes hidden. Registered before
  // any page script, so it runs first on visibilitychange. The tests never release a lock on the app's behalf.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') for (const lock of wake.requests) if (!lock.released) lock.release();
  });

  const location = { hash: '', search: '', hostname: 'example.test', pathname: '/distribution-snapshots/gwayubulgeup/index.html' };
  const window = {
    document, localStorage, location, navigator, innerWidth: 390, innerHeight: 844, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ fontSize: '16px' }),
    requestAnimationFrame: (fn) => { frameId += 1; frames.set(frameId, fn); return frameId; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
  };
  listenerHost(window);
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('localStorage', localStorage);
  define('Date', FixedDate);
  define('performance', { now: () => clockNow - START });
  define('requestAnimationFrame', window.requestAnimationFrame);
  define('cancelAnimationFrame', window.cancelAnimationFrame);
  define('getComputedStyle', window.getComputedStyle);
  define('matchMedia', window.matchMedia);
  return { window, store, localStorage, wake, navigator, byId: (id) => top.querySelector(`#${id}`) };
}

const env = stubBrowser();
const win = env.window;
// Dispatches like a browser: capture from window down, then bubble up; stopPropagation and
// stopImmediatePropagation are honoured. A listener that throws or rejects is recorded as an uncaught error.
async function fire(target, type, init = {}) {
  const event = {
    type, target, cancelable: true, defaultPrevented: false, stopped: false, immediate: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = true; this.immediate = true; }, ...init,
  };
  const chain = [];
  if (target !== win) {
    if (target !== document) for (let node = target; node; node = node.parentElement) chain.push(node);
    chain.push(document);
  }
  chain.push(win);
  assert.ok(chain.some((node) => (node.listeners[type] || []).length > 0), `a listener is registered for ${type}`);
  const pending = [];
  const run = (node, capture) => {
    for (const entry of [...(node.listeners[type] || [])]) {
      if (event.immediate) return;
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
let inlineCount = 0;
const runClassic = (script) => runInThisContext(script.src ? readFileSync(new URL(script.src, root), 'utf8') : script.body, { filename: script.src ? script.src.replace(/^\.\//, '') : `inline-${++inlineCount}.js` });

const $ = (selector) => document.querySelector(selector);
const need = (selector) => { const el = $(selector); assert.ok(el, `index.html provides ${selector}`); return el; };
const node = (id) => { const el = env.byId(id); assert.ok(el, `index.html defines #${id}`); return el; };
const stored = (key) => env.localStorage.getItem(key);
const digits = () => document.querySelectorAll('[data-p-minute], [data-p-digit]').map((span) => span.textContent).join('');
const trickAttr = () => document.documentElement.getAttribute('data-gwayu-trick');

let pointerId = 100;
const touch = (id, x, y, extra = {}) => ({ pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y, ...extra });
async function twoFingerSwipe(dy) {
  const target = node('p-time-display');
  const fingers = [[71, 100], [72, 300]];
  for (const [id, x] of fingers) await fire(target, 'pointerdown', touch(id, x, 300));
  const moves = [];
  for (const [id, x] of fingers) moves.push(await fire(target, 'pointermove', touch(id, x, 300 + dy)));
  for (const [id, x] of fingers) await fire(target, 'pointerup', touch(id, x, 300 + dy));
  return moves;
}
const click = (id) => fire(node(id), 'click');
async function runFor(ms) { advance(ms); runFrames(); await settle(); }

test('boot: pre-paint script, classic scripts and the real app.js module graph load and reach the ready stopwatch', async () => {
  env.localStorage.setItem('gwayubulgeup_trick', '1');
  const immediate = pageScripts.filter((s) => !s.module && !s.defer);
  const deferred = pageScripts.filter((s) => s.module || s.defer);
  assert.deepEqual(immediate.map((s) => s.src), [null, './install-nudge.js', './sw-register.js'], 'inline pre-paint script, then the two classic scripts');
  assert.deepEqual(deferred.map((s) => [s.src, s.module]), [['./settings-ui.js', false], ['./app.js', true]]);
  immediate.forEach(runClassic);
  assert.equal(trickAttr(), 'on', 'the pre-paint script marks the page before the app runs');
  for (const script of deferred) {
    if (script.module) await import(new URL(script.src, root));
    else runClassic(script);
  }
  document.readyState = 'interactive';
  await fire(document, 'DOMContentLoaded');
  document.readyState = 'complete';
  await fire(win, 'load');
  await settle();

  assert.equal(typeof win.MagicSettingsUI.installGuide, 'function', 'settings-ui.js ran');
  assert.deepEqual(env.navigator.registered, ['./sw.js'], 'sw-register.js registered the service worker on load');
  assert.equal(digits(), '000000');
  assert.equal(node('p-control').textContent, '시작');
  assert.equal(node('p-lap').textContent, '랩');
  assert.equal(node('p-lap').disabled, true);
  assert.equal(trickAttr(), 'on', 'a saved trick stays on');
  assert.equal(node('settings').hidden, true);
  assert.equal(node('settings-entry-tutorial').hidden, false, 'first run shows the settings-entry tutorial');
  assert.equal(env.wake.requests.length, 1, 'boot requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
});

test('wake lock: released by the browser when hidden, requested again when visible', async () => {
  document.visibilityState = 'hidden';
  document.hidden = true;
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests[0].released, true, 'the hidden page lost its lock');
  assert.equal(env.wake.requests.length, 1, 'no request while hidden');
  document.visibilityState = 'visible';
  document.hidden = false;
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2, 'visible again requests a new lock');
  assert.equal(env.wake.requests[1].released, false);
  env.wake.failNext = true;
  env.wake.requests[1].release();
  await settle();
  assert.equal(env.wake.requests.length, 2, 'a refused request is tolerated');
  await fire(document, 'pointerdown', touch(9, 5, 5));
  await fire(document, 'pointerup', touch(9, 5, 5));
  await settle();
  assert.equal(env.wake.requests.length, 3, 'the next touch gets a lock again');
});

test('tutorial: touches on it are blocked, no swipe opens settings under it, dismiss is remembered', async () => {
  const tutorial = node('settings-entry-tutorial');
  const blocked = await fire(tutorial, 'pointerdown', touch(5, 10, 10));
  assert.equal(blocked.defaultPrevented, true);
  assert.equal(blocked.stopped, true, 'touches on the tutorial do not reach the app');
  await fire(win, 'pointerup', touch(5, 10, 10));
  const moves = await twoFingerSwipe(140);
  assert.equal(node('settings').hidden, true, 'settings cannot open while the tutorial is shown');
  assert.equal(moves.every((event) => !event.defaultPrevented), true);
  assert.equal(stored('gwayubulgeup-settings-entry-tutorial-v1'), null);
  await click('settings-entry-tutorial-dismiss');
  assert.equal(tutorial.hidden, true);
  assert.equal(stored('gwayubulgeup-settings-entry-tutorial-v1'), '1');
});

test('stopwatch with the trick on: a stop before 16 s snaps to seconds plus hundredths of 15', async () => {
  await click('p-control');
  assert.equal(node('p-control').textContent, '중단');
  assert.equal(node('p-control').classes.has('running'), true);
  assert.equal(node('p-lap').disabled, false);
  await runFor(3000);
  assert.equal(digits(), '000300', 'running time is painted as it passes');
  await click('p-control');
  assert.equal(digits(), '000312', '3 s is forced to 3.12 so seconds plus hundredths make 15');
  assert.equal(node('p-control').textContent, '시작');
  assert.equal(node('p-lap').textContent, '재설정');
  await click('p-lap');
  assert.equal(digits(), '000000');
  assert.equal(node('p-lap').textContent, '랩');
  assert.equal(node('p-lap').disabled, true);

  await click('p-control');
  await runFor(16000);
  await click('p-control');
  assert.equal(digits(), '001600', 'from 16 s on the real time is kept');
  await click('p-lap');
});

test('trick switch: the world clock toggles the mark and the stored flag, and an off trick stops on the real time', async () => {
  const world = node('p-world');
  const toggled = await fire(world, 'click');
  assert.equal(toggled.defaultPrevented, true);
  assert.equal(trickAttr(), null, 'the filled icon mark is removed');
  assert.equal(stored('gwayubulgeup_trick'), '0');
  await click('p-control');
  await runFor(3000);
  await click('p-control');
  assert.equal(digits(), '000300', 'with the trick off the stop is the real time');
  await click('p-lap');
  await fire(world, 'click');
  assert.equal(trickAttr(), 'on');
  assert.equal(stored('gwayubulgeup_trick'), '1');
});

test('laps: each lap shows its own split and a new lap goes to the top', async () => {
  await fire(node('p-world'), 'click');
  await click('p-control');
  await runFor(1000);
  await click('p-lap');
  await runFor(2500);
  await click('p-lap');
  const rows = node('p-lap-rows').children.map((row) => row.children.map((cell) => cell.textContent));
  assert.deepEqual(rows, [['랩 2', '00:02.50'], ['랩 1', '00:01.00']]);
  await click('p-control');
  assert.equal(digits(), '000350');
  await click('p-lap');
  assert.equal(node('p-lap-rows').children.length, 0, 'reset clears the laps');
  await fire(node('p-world'), 'click');
  assert.equal(trickAttr(), 'on');
});

test('settings swipe: two fingers down open settings (not while running), the click after the swipe is swallowed, close works', async () => {
  const short = await twoFingerSwipe(50);
  assert.equal(node('settings').hidden, true, 'a short swipe does not open settings');
  assert.equal(short.every((event) => !event.defaultPrevented), true);

  await click('p-control');
  const running = await twoFingerSwipe(140);
  assert.equal(node('settings').hidden, true, 'settings do not open while the stopwatch runs');
  assert.equal(running.every((event) => !event.defaultPrevented), true);
  await click('p-control');
  await click('p-lap');

  const moves = await twoFingerSwipe(140);
  assert.equal(node('settings').hidden, false);
  assert.equal(moves.at(-1).defaultPrevented, true, 'the opening move is consumed');
  const swallowed = await click('settings-close');
  assert.equal(swallowed.defaultPrevented, true, 'a click right after the swipe is suppressed');
  assert.equal(node('settings').hidden, false);
  advance(750);
  await click('settings-close');
  assert.equal(node('settings').hidden, true);
  const again = await twoFingerSwipe(140);
  assert.equal(again.at(-1).defaultPrevented, true, 'settings can be opened again');
  advance(750);
  await click('settings-close');
});

test('install nudge: offer bar, native prompt outcomes, then closing is remembered', async () => {
  let prompted = 0;
  const native = (outcome) => ({ prompt: async () => { prompted += 1; }, userChoice: Promise.resolve({ outcome }) });
  const bar = () => document.body.children.find((child) => child.id === 'install-nudge');
  assert.equal(bar(), undefined, 'no bar before the browser offers install');
  const first = await fire(win, 'beforeinstallprompt', native('dismissed'));
  assert.equal(first.defaultPrevented, true, 'the browser mini-infobar is suppressed');
  assert.equal(win.__magicInstallPrompt, first, 'settings-ui.js keeps the event in the shared slot');
  assert.equal(bar().querySelector('span').textContent, '홈 화면에 앱으로 설치할 수 있어요');
  const button = (act) => { const item = bar().querySelector(`button[data-act="${act}"]`); assert.ok(item, `the bar offers a ${act} button`); return item; };
  const swallowed = await fire(bar(), 'pointerdown', touch(6, 10, 10));
  assert.equal(swallowed.stopped, true, 'touches on the bar do not reach the page');

  await fire(button('install'), 'click');
  assert.equal(prompted, 1);
  assert.equal(bar().querySelector('span').textContent, 'Chrome 메뉴(⋮)에서 앱 설치를 선택하세요.');
  await fire(win, 'beforeinstallprompt', native('accepted'));
  await fire(button('install'), 'click');
  assert.equal(prompted, 2);
  assert.equal(bar().querySelector('span').textContent, '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 Chrome 메뉴(⋮)에서 다시 시도하세요.');
  await fire(button('close'), 'click');
  assert.equal(bar(), undefined, 'closing removes the bar');
  assert.equal(stored('gwayubulgeup_install_nudge_done'), '1');
  await fire(win, 'beforeinstallprompt', native('accepted'));
  assert.equal(bar(), undefined, 'a closed nudge stays closed');
  await fire(win, 'appinstalled');
  assert.equal(win.__magicInstallPrompt, null);
  console.error = originalConsoleError;
  Object.defineProperty(globalThis, 'performance', { value: realPerformance, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'Date', { value: RealDate, configurable: true, writable: true });
});
