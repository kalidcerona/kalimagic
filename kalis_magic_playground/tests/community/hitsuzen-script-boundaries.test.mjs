import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

// HITSUZEN (zz3) is a set of CLASSIC scripts that share globals, not ES modules. This test evaluates the real
// files of index.html in ONE shared vm context (the context global is the stub window), in the order a browser
// runs them: scripts without defer in document order (including the two inline ones), then the defer scripts
// (settings-ui.js, performance-link.js), then DOMContentLoaded and load. A global that one file defines and
// another file uses, but that is missing, is a real ReferenceError at the point of use, as in the browser.
// The DOM is parsed from the real index.html. A missing id returns null and nothing is auto-created.
// Drives the key pad (expression path), the percent trick, the date trick, the stack lookups, the two-finger
// downward settings swipe, settings saves, the RELEASE handoff, Shift+Esc on desktop, the install nudge, the
// wake lock (the stub releases it when the page is hidden, like a browser) and the #selftest entry of boot.js.
// The page clock (Date, setTimeout) is controlled by the test and moves only through advance().
// Covers the personal zz3 app and, through ZZ3_ROOT, the friend snapshot distribution-snapshots/calculator.
// Not covered: the appearance editor settings-ui.js builds (it needs a full DOM; only its mount and install slot
// run here), the /tools/_check revoke poll (inline script, only runs under /tools/), the service worker file.
// ZZ3_ROOT lets a mutation check point the same test at a scratch copy.
const root = process.env.ZZ3_ROOT ? pathToFileURL(`${process.env.ZZ3_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz3/', import.meta.url);

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
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
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = ''; this.clientWidth = 0;
    this.style = new FakeStyle(); this.attrs = new Map(); this.classes = new Set(); this.pointerCaptured = [];
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
  setPointerCapture(id) { this.pointerCaptured.push(id); }
  getContext() { return { font: '', measureText: (text) => ({ width: String(text).length * 12 }) }; }
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

// A controlled clock: 2026-10-25 14:05:00 local time, moved only by advance(). The page's Date and its
// setTimeout/clearTimeout both use it, so nothing here depends on real elapsed time (the date trick answer, the
// 500 ms long press and the 700 ms click suppression after a settings swipe are all driven by advance()).
let clockNow = new Date(2026, 9, 25, 14, 5, 0).getTime();
const timers = new Map();
let timerId = 0;
const pageSetTimeout = (fn, ms = 0) => { timerId += 1; timers.set(timerId, { fn, at: clockNow + Number(ms) }); return timerId; };
const pageClearTimeout = (id) => { timers.delete(id); };
async function advance(ms) {
  const target = clockNow + ms;
  for (;;) {
    const due = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
    if (!due) break;
    timers.delete(due[0]);
    clockNow = Math.max(clockNow, due[1].at);
    due[1].fn();
  }
  clockNow = target;
  await settle();
}
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) { if (args.length) super(...args); else super(clockNow); }
  static now() { return clockNow; }
}

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
    activeElement: null, visibilityState: 'visible', readyState: 'loading',
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

  const frames = new Map();
  let frameId = 0;
  const media = { matches: false };
  listenerHost(media);
  const location = { hash: '', search: '', hostname: 'example.test', pathname: '/zz3/index.html' };

  // The vm context global IS the stub window: scripts see these as plain globals and as window.<name>.
  const sandbox = {
    document, navigator, location, localStorage, console, setTimeout: pageSetTimeout, clearTimeout: pageClearTimeout, Date: FixedDate,
    innerWidth: 390, innerHeight: 844,
    // Animation frames are queued and never run: they only lay out the appearance editor, which is not driven here.
    requestAnimationFrame: (fn) => { frameId += 1; frames.set(frameId, fn); return frameId; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
    getComputedStyle: (el) => ({ fontSize: el.style.fontSize || '48px', paddingLeft: '0px', paddingRight: '0px', letterSpacing: 'normal', fontStyle: 'normal', fontWeight: '400', fontFamily: 'sans-serif' }),
    matchMedia: (query) => (query.includes('hover: hover') ? media : { matches: false }),
  };
  listenerHost(sandbox);
  vm.createContext(sandbox);
  sandbox.window = vm.runInContext('globalThis', sandbox);
  document.defaultView = sandbox.window;
  return { sandbox, store, localStorage, wake, navigator, media, byId: (id) => top.querySelector(`#${id}`), top };
}

// Dispatches like a browser: capture from window down, then bubble up; stopPropagation and
// stopImmediatePropagation are honoured. A listener that throws or rejects is recorded as an uncaught error.
const env = stubBrowser();
const win = env.sandbox;
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
    src: attrs.match(/\bsrc="([^"]+)"/)?.[1] || null, defer: /\bdefer\b/.test(attrs), body,
  }));
})();
let inlineCount = 0;
function runClassic(script) {
  const filename = script.src ? script.src.replace(/^\.\//, '') : `inline-${++inlineCount}.js`;
  vm.runInContext(script.src ? readFileSync(new URL(script.src, root), 'utf8') : script.body, win, { filename });
}

const $ = (selector) => document.querySelector(selector);
const need = (selector) => { const el = $(selector); assert.ok(el, `index.html provides ${selector}`); return el; };
const node = (id) => { const el = env.byId(id); assert.ok(el, `index.html defines #${id}`); return el; };
const display = () => node('display').textContent;
const stored = (key) => env.localStorage.getItem(key);

let pointerId = 100;
const touch = (id, x, y, extra = {}) => ({ pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y, ...extra });
async function tap(target) {
  const id = (pointerId += 1);
  await fire(target, 'pointerdown', touch(id, 50, 400));
  await fire(target, 'pointerup', touch(id, 50, 400));
}
const key = (name) => tap(need(`.keypad [data-key="${name}"]`));
const keys = async (text) => { for (const name of [...text]) await key(name); };
async function twoFingerSwipe(dy) {
  const target = node('display');
  const fingers = [[71, 100], [72, 300]];
  for (const [id, x] of fingers) await fire(target, 'pointerdown', touch(id, x, 300));
  const moves = [];
  for (const [id, x] of fingers) moves.push(await fire(target, 'pointermove', touch(id, x, 300 + dy)));
  for (const [id, x] of fingers) await fire(target, 'pointerup', touch(id, x, 300 + dy));
  return moves;
}
const settingsOpen = () => node('date-settings').classes.has('open');
const settingsAction = (action) => tap(need(`#date-settings [data-date-action="${action}"]`));

test('boot: the real scripts run in browser order in one shared context and the calculator reaches its ready state', async () => {
  const immediate = pageScripts.filter((script) => !script.defer);
  const deferred = pageScripts.filter((script) => script.defer);
  assert.deepEqual(immediate.filter((s) => s.src).map((s) => s.src), [
    './settings-swipe.js', './selftest.js', './cards.js', './decimal.js', './expression.js', './tricks.js', './ui-helpers.js',
    './settings-tutorial.js', ...(process.env.ZZ3_ROOT ? [] : ['./update-prompt.js']), './app.js', './wake-lock.js', './boot.js', './install-nudge.js',
  ], 'index.html loads the classic scripts in this order');
  assert.deepEqual(deferred.map((s) => s.src), ['./settings-ui.js', './performance-link.js']);
  immediate.forEach(runClassic);
  // Deferred scripts run after parsing, then DOMContentLoaded (settings-ui mount, release handoff check) and load.
  deferred.forEach(runClassic);
  document.readyState = 'interactive';
  await fire(document, 'DOMContentLoaded');
  document.readyState = 'complete';
  await fire(win, 'load');
  await settle();

  assert.equal(typeof win.MagicSettingsUI.installGuide, 'function', 'settings-ui.js ran');
  assert.equal(typeof win.MagicPerformanceLink.keyFor, 'function', 'performance-link.js ran');
  assert.equal(display(), '0');
  assert.equal(node('app').classes.has('skin-iphone'), false);
  assert.equal(need('.keypad [data-key="C"]').textContent, 'C');
  assert.equal(node('date-delay-value').textContent, '20초');
  assert.equal(node('date-hour-cycle').textContent, '24h');
  assert.equal(node('skin-toggle').textContent, '스킨: 기본');
  assert.equal(node('release-days-value').textContent, '아직 받은 값이 없어요.');
  assert.equal(node('release-days-clear').disabled, true);
  assert.equal(node('stack-result').hidden, true);
  assert.equal(node('settings-entry-tutorial').hidden, false, 'first run shows the settings-entry tutorial');
  assert.equal(node('desktop-settings-entry').hidden, true, 'touch device hides the desktop settings button');
  assert.equal(settingsOpen(), false);
  assert.equal(node('selftest').textContent, '', 'the normal entry does not run the self tests');
  assert.deepEqual(env.navigator.registered, ['./sw.js'], 'the inline script registers the service worker on load');
  assert.equal(env.wake.requests.length, 1, 'boot requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
});

test('wake lock: released by the browser when hidden, requested again when visible, a refused request is tolerated', async () => {
  document.visibilityState = 'hidden';
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests[0].released, true, 'the hidden page lost its lock');
  assert.equal(env.wake.requests.length, 1, 'no request while hidden');
  env.wake.failNext = true;
  document.visibilityState = 'visible';
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 1, 'a refused request leaves no lock and raises no error');
  document.visibilityState = 'hidden';
  await fire(document, 'visibilitychange');
  document.visibilityState = 'visible';
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2, 'the next visible return gets a lock');
  assert.equal(env.wake.requests[1].released, false);
});

test('expression path: keys build, evaluate and format exact decimals through cards/decimal/expression/ui-helpers', async () => {
  await keys('1234×5');
  assert.equal(display(), '5', 'the operand being typed is shown');
  await key('=');
  assert.equal(display(), '6,170', 'result is grouped with commas');
  await key('C');
  assert.equal(display(), '0');

  await keys('0.1+0.2');
  await key('=');
  assert.equal(display(), '0.3', 'decimal arithmetic is exact');
  await key('C');

  await keys('1÷3');
  await key('=');
  assert.equal(display(), '0.3333333333333333');
  assert.equal(node('display').style.fontSize, '30.72px', 'ui-helpers fitDisplayText shrinks an 18-character result');
  await key('C');
  assert.equal(node('display').style.fontSize, '48px');

  await keys('5÷0');
  await key('=');
  assert.equal(display(), '오류');
  await key('7');
  assert.equal(display(), '오류', 'the error state ignores digits');
  await key('C');
  assert.equal(display(), '0');

  await key('()');
  await keys('2+3');
  await key('()');
  await key('×');
  await key('4');
  await key('=');
  assert.equal(display(), '20', '(2+3)×4');
  await key('⌫');
  assert.equal(display(), '0', 'backspace after a result clears it');
  await keys('12');
  await key('±');
  assert.equal(display(), '-12');
  await key('⌫');
  assert.equal(display(), '-1');
  await key('C');
});

test('percent trick: double % stores the number, a calculation runs, double % then = reveals the stored number', async () => {
  await keys('1234');
  await key('%');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-set'), false, 'one % does not arm anything');
  await key('%');
  assert.equal(display(), '0', 'the screen is cleared when the number is stored');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-set'), true);

  await keys('7+8');
  await key('=');
  assert.equal(display(), '15', 'a normal calculation still works while armed');
  await key('%');
  await key('%');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-ready'), true);
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-set'), false);
  await key('=');
  assert.equal(display(), '1,234', 'the stored number appears');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-ready'), false, 'the trick disarms after firing');
  await key('C');
  await keys('2+2');
  await key('=');
  assert.equal(display(), '4', 'back to a plain calculator');
  await key('C');
});

test('date trick: the pen arms it, hints the keys, and typing anything enters the target date number', async () => {
  const pen = node('pen-icon');
  await keys('5');
  await key('=');
  assert.equal(display(), '5');
  await tap(pen);
  assert.equal(pen.classes.has('date-armed'), true);
  // Target = fixed clock + 20 s = 2026-10-25 14:05:20 -> "2610251405"; the difference from 5 is 2610251400 (10 digits).
  assert.equal(need('.keypad [data-key="+"]').classes.has('date-key-hint'), true, 'the + key is hinted');
  assert.equal(need('.keypad [data-key="−"]').classes.has('date-key-hint'), false);
  assert.equal(need('.keypad [data-key="0"]').classes.has('date-key-hint'), true, 'the digit key for "10 digits" is hinted');
  await key('+');
  for (let i = 0; i < 10; i += 1) await key('1');
  assert.equal(display(), '2,610,251,400', 'the keys typed (all 1s) enter the secret difference instead');
  await key('=');
  assert.equal(display(), '2,610,251,405');
  assert.equal(pen.classes.has('date-armed'), false, 'the date trick is spent after =');
  await key('C');
  await tap(pen);
  assert.equal(pen.classes.has('date-armed'), true);
  await tap(pen);
  assert.equal(pen.classes.has('date-armed'), false, 'tapping the pen again disarms');
});

test('stack icon: a short press looks up the Mnemonica stack, a long press the undo setup, a second short press hides it', async () => {
  const icon = node('stack-icon');
  const result = node('stack-result');
  await keys('27');
  await tap(icon);
  assert.equal(result.hidden, false);
  assert.equal(result.textContent, '41번째 · ♣2', 'card 2-7 sits at position 41 and position 27 is the 2 of clubs');
  await tap(icon);
  assert.equal(result.hidden, true, 'a second short press hides the answer');
  await key('C');

  await keys('625');
  const id = (pointerId += 1);
  await fire(icon, 'pointerdown', touch(id, 20, 20));
  assert.equal(icon.pointerCaptured.at(-1), id, 'the icon captures the pointer');
  await advance(560);
  await fire(icon, 'pointerup', touch(id, 20, 20));
  assert.equal(result.hidden, false);
  assert.equal(result.textContent, '28번째 · 35번째', 'undo setup for 6:25');
  await key('1');
  assert.equal(result.hidden, true, 'any key hides the stack answer');
  await key('C');

  await keys('4301');
  await tap(icon);
  assert.equal(result.textContent, '11장 · ♥Q', '4301 = the 3 of diamonds (position 12) cut to 1: 11 cards cut, QH is the bottom');
  await key('C');
});

test('two-finger downward swipe opens settings (short or sideways swipes do not), settings changes are saved', async () => {
  const short = await twoFingerSwipe(50);
  assert.equal(settingsOpen(), false, 'a short swipe does not open settings');
  assert.equal(short.every((event) => !event.defaultPrevented), true);
  const up = await twoFingerSwipe(-140);
  assert.equal(settingsOpen(), false, 'swiping up does not open settings');
  assert.equal(up.every((event) => !event.defaultPrevented), true);

  assert.equal(node('settings-entry-tutorial').hidden, false);
  const moves = await twoFingerSwipe(140);
  assert.equal(settingsOpen(), true);
  assert.equal(node('date-settings').getAttribute('aria-hidden'), 'false');
  assert.equal(moves.at(-1).defaultPrevented, true, 'the opening move is consumed');
  assert.equal(node('settings-entry-tutorial').hidden, true, 'opening settings hides the entry tutorial');

  await settingsAction('increase');
  assert.equal(node('date-delay-value').textContent, '25초');
  assert.equal(stored('magic-calc-date-delay'), '25');
  await settingsAction('decrease');
  await settingsAction('decrease');
  assert.equal(node('date-delay-value').textContent, '15초');
  assert.equal(stored('magic-calc-date-delay'), '15');
  await settingsAction('hour-cycle');
  assert.equal(node('date-hour-cycle').textContent, '12h');
  assert.equal(stored('magic-calc-hour-cycle'), '12');
  await settingsAction('skin');
  assert.equal(node('skin-toggle').textContent, '스킨: 아이폰');
  assert.equal(stored('magic-calc-skin'), 'iphone');
  assert.equal(node('app').classes.has('skin-iphone'), true);
  assert.equal(need('.keypad [data-key="C"]').textContent, 'AC');
  await key('9');
  assert.equal(need('.keypad [data-key="C"]').textContent, '⌫', 'iPhone skin turns AC into backspace once there is input');
  await key('C');
  assert.equal(display(), '0', 'the C key sends backspace in this skin and removes the 9');

  // Put the settings back so later tests see the defaults, through the same buttons.
  await settingsAction('skin');
  await settingsAction('hour-cycle');
  await settingsAction('increase');
  await settingsAction('increase');
  assert.equal(stored('magic-calc-date-delay'), '25');
  await settingsAction('decrease');
  await settingsAction('decrease');
  await settingsAction('increase');
  assert.equal(stored('magic-calc-date-delay'), '20');
  assert.equal(node('app').classes.has('skin-iphone'), false);

  const swipeWhileOpen = await twoFingerSwipe(140);
  assert.equal(swipeWhileOpen.every((event) => !event.defaultPrevented), true, 'a swipe while settings is open does nothing');
  await settingsAction('close');
  assert.equal(settingsOpen(), false);
  assert.equal(node('date-settings').getAttribute('aria-hidden'), 'true');
});

test('entry tutorial: a click right after the swipe is swallowed, a later click dismisses it and stores the flag for this path', async () => {
  const tutorialKey = 'calculator-settings-entry-tutorial-v1:/zz3';
  assert.equal(stored(tutorialKey), null);
  await twoFingerSwipe(140);
  await settingsAction('close');
  const swallowed = await fire(node('settings-entry-tutorial-dismiss'), 'click');
  assert.equal(swallowed.defaultPrevented, true, 'the click that follows a settings swipe is suppressed');
  assert.equal(stored(tutorialKey), null, 'so it does not reach the dismiss button');
  await advance(750);
  await fire(node('settings-entry-tutorial-dismiss'), 'click');
  assert.equal(node('settings-entry-tutorial').hidden, true);
  assert.equal(stored('calculator-settings-entry-tutorial-v1:/zz3'), '1');
});

test('desktop: the settings button appears for a mouse device and Shift+Esc opens settings, but not while editing', async () => {
  const button = node('desktop-settings-entry');
  // The friend snapshot's button follows the media query only (change event); the personal one also rechecks the
  // touch points and the user agent on focus and pageshow, and marks the page with desktop-settings-enabled.
  // The variant comes from the root under test (its path), never from the code being tested.
  const mediaOnly = /\/distribution-snapshots\/calculator\/?$/.test(process.env.ZZ3_ROOT || '');
  const recheck = (type) => (mediaOnly ? fire(env.media, 'change') : fire(win, type));
  env.navigator.maxTouchPoints = 0;
  env.media.matches = true;
  await recheck('focus');
  assert.equal(button.hidden, false);
  if (!mediaOnly) assert.equal(document.documentElement.classes.has('desktop-settings-enabled'), true);

  await fire(win, 'keydown', { key: 'Escape', shiftKey: false, target: document.body });
  assert.equal(settingsOpen(), false, 'plain Escape does nothing');
  await fire(win, 'keydown', { key: 'Escape', shiftKey: true, target: new FakeElement('input') });
  assert.equal(settingsOpen(), false, 'Shift+Esc while typing in an input is left alone');
  await fire(win, 'keydown', { key: 'Escape', shiftKey: true, target: document.body });
  assert.equal(settingsOpen(), true, 'Shift+Esc opens settings');
  await settingsAction('close');
  assert.equal(settingsOpen(), false);
  assert.equal(button.hidden, false);

  await fire(button, 'click', { target: button });
  assert.equal(settingsOpen(), true, 'the visible button opens settings');
  assert.equal(button.hidden, true, 'the button hides while settings is open');
  await settingsAction('close');
  assert.equal(button.hidden, false);
  env.navigator.maxTouchPoints = 5;
  env.media.matches = false;
  await recheck('pageshow');
  assert.equal(button.hidden, true, 'back to a touch device');
});

test('RELEASE handoff: performance-link.js data arms the stored number, clearing it from settings or storage disarms it', async () => {
  const link = win.MagicPerformanceLink;
  const storageKey = link.keyFor('/zz3/index.html');
  assert.equal(storageKey, 'magic-performance-link:v1:release-hitsuzen:personal');
  await key('C');
  assert.equal(node('stack-result').hidden, true);
  assert.equal(link.write(env.localStorage, '/zz3/index.html', 42, 1000), true);
  await fire(win, 'focus');
  assert.equal(node('release-days-value').textContent, '42일을 받았어요.');
  assert.equal(node('release-days-clear').disabled, false);
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-set'), true, 'the received number is stored as the trick target');
  await key('%');
  await key('%');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-ready'), true);
  await key('=');
  assert.equal(display(), '42');
  await key('C');

  await fire(win, 'pageshow');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-set'), false, 'the same revision is not armed twice');

  await settingsAction('release-clear');
  assert.equal(node('release-days-value').textContent, '아직 받은 값이 없어요.');
  assert.equal(node('release-days-clear').disabled, true);
  assert.equal(stored(storageKey), null, 'clearing removes the handoff from storage');

  assert.equal(link.write(env.localStorage, '/zz3/index.html', 7, 2000), true);
  await fire(win, 'focus');
  assert.equal(node('release-days-value').textContent, '7일을 받았어요.');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-set'), true);
  env.localStorage.removeItem(storageKey);
  await fire(win, 'focus');
  assert.equal(node('release-days-value').textContent, '아직 받은 값이 없어요.', 'a removed handoff disarms the imported target');
  assert.equal(need('.keypad [data-key="%"]').classes.has('trick-set'), false);
  await keys('3');
  await key('%');
  await key('%');
  await key('C');
});

test('install nudge: offer bar, native prompt outcomes, then closing is remembered', async () => {
  let prompted = 0;
  const native = (outcome) => ({ prompt: async () => { prompted += 1; }, userChoice: Promise.resolve({ outcome }) });
  const bar = () => document.body.children.find((child) => child.id === 'install-nudge');
  assert.equal(bar(), undefined, 'no bar before the browser offers install');

  const first = await fire(win, 'beforeinstallprompt', native('dismissed'));
  assert.equal(first.defaultPrevented, true, 'the browser mini-infobar is suppressed');
  assert.equal(win.__magicInstallPrompt, first, 'settings-ui.js keeps the event in the shared slot');
  assert.ok(bar(), 'the install bar is appended to the body');
  assert.equal(bar().querySelector('span').textContent, '홈 화면에 앱으로 설치할 수 있어요');
  const button = (act) => { const item = bar().querySelector(`button[data-act="${act}"]`); assert.ok(item, `the bar offers a ${act} button`); return item; };
  const swallowed = await fire(bar(), 'pointerdown', touch(5, 10, 10));
  assert.equal(swallowed.stopped, true, 'touches on the bar do not reach the page');

  await fire(button('install'), 'click');
  assert.equal(prompted, 1);
  assert.equal(bar().querySelector('span').textContent, 'Chrome 메뉴(⋮)에서 앱 설치를 선택하세요.', 'a dismissed prompt points to the browser menu');
  await fire(button('install'), 'click');
  assert.equal(prompted, 1, 'the prompt can be used once');

  await fire(win, 'beforeinstallprompt', native('accepted'));
  assert.equal(bar().querySelector('span').textContent, '홈 화면에 앱으로 설치할 수 있어요', 'a new event resets the offer');
  await fire(button('install'), 'click');
  assert.equal(prompted, 2);
  assert.equal(bar().querySelector('span').textContent, '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 Chrome 메뉴(⋮)에서 다시 시도하세요.');

  await fire(button('close'), 'click');
  assert.equal(bar(), undefined, 'closing removes the bar');
  assert.equal(stored('installNudgeDone'), '1');
  await fire(win, 'beforeinstallprompt', native('accepted'));
  assert.equal(bar(), undefined, 'a closed nudge stays closed');
  await fire(win, 'appinstalled');
  assert.equal(win.__magicInstallPrompt, null, 'settings-ui.js clears the slot when the app is installed');
});

test('selftest entry: booting with #selftest hides the app and the shared globals pass the built-in self tests', async () => {
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  win.location.hash = '#selftest';
  try { runClassic({ src: './boot.js' }); } finally { console.log = originalConsoleLog; win.location.hash = ''; }
  assert.equal(node('app').hidden, true, 'the app is hidden in selftest mode');
  assert.equal(node('selftest').style.display, 'block');
  assert.equal(node('selftest').className, 'pass');
  assert.match(node('selftest').textContent, /^ALL PASS \(\d+ assertions\)$/);
  assert.deepEqual(lines, [node('selftest').textContent]);
  node('app').hidden = false;
  console.error = originalConsoleError;
});
