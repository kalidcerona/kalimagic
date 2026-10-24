import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Loads zz4/app.js and its real imports as separate ES modules (no concatenation, no shared scope).
// A module that uses an identifier it does not import throws ReferenceError here, as it does in the browser.
// The DOM is built by parsing the real index.html, so ids and selectors the modules look up are the shipped ones.
// Flows are driven through the listeners the app registers: boot to the fake home, number entry by tap,
// swipe, wallpaper and dock, the notes app, the two-finger settings swipe, saved settings, the list wizard with
// history back, the list detail and editor, backup, the check screen, offline readiness, user icons, wake lock,
// the gesture guide, the install prompt and the inline self-repair script.
// Deliberately not asserted: the relative order in which startup listeners are registered.
// Not reachable with these stubs: settings-ui.js (shared classic appearance script, not a CHOICE module),
// the wallpaper photo store (IndexedDB), and the corrupt-storage recovery panel (needs a corrupt boot).
// CHOICE_ROOT points the same test at the friend snapshot distribution-snapshots/choice.
const root = process.env.CHOICE_ROOT ? pathToFileURL(`${process.env.CHOICE_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz4/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

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
const PIECE = /^(?:([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]|:(checked))/;
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
    else if (m[9]) tests.push({ pseudo: m[9] });
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
    if (t.pseudo) return el.checked === true;
    const v = attrValue(el, t.attr);
    if (v === null) return false;
    if (t.op === '') return true;
    if (t.op === '=') return v === t.val;
    if (t.op === '*=') return v.includes(t.val);
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
  target.dispatchEvent = (native) => {
    const event = makeEvent(native.type, { bubbles: native.bubbles });
    runEvent(target, event);
    return !event.defaultPrevented;
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
async function dispatch(target, type, init = {}) {
  const event = makeEvent(type, init);
  await Promise.all(runEvent(target, event));
  return event;
}
async function click(el) {
  const event = await dispatch(el, 'click');
  // A back arrow goes through history.back, whose popstate arrives on a later task.
  if (el.closest('[data-sv-go]')) await settle(5);
  return event;
}
async function typeInto(el, value, type = 'input') { el.value = value; return dispatch(el, type); }

// ----- elements -----
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.nodeType = tag === '#text' ? 3 : 1; this.id = '';
    this.attrs = new Map(); this.classes = new Set(); this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = '';
    this.rect = null; this.inert = false; this.tabIndex = 0;
    const props = new Map();
    this.style = {
      setProperty: (k, v) => { props.set(k, String(v)); }, removeProperty: (k) => { props.delete(k); },
      getPropertyValue: (k) => props.get(k) ?? '',
    };
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
  removeAttribute(k) {
    this.attrs.delete(k);
    if (k === 'id') this.id = '';
    if (k === 'hidden') this.hidden = false;
    if (k.startsWith('data-')) delete this.dataset[camel(k.slice(5))];
  }
  append(...nodes) {
    for (const raw of nodes) {
      const node = typeof raw === 'string' ? textNode(raw) : raw;
      if (node.tag === '#fragment') { this.append(...node.children); node.children = []; continue; }
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((c) => c !== node);
      node.parentElement = this; this.children.push(node);
    }
  }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children.forEach((c) => { c.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parentElement) { this.parentElement.children = this.parentElement.children.filter((c) => c !== this); this.parentElement = null; } }
  contains(node) { for (let n = node; n; n = n.parentElement) if (n === this) return true; return false; }
  matches(selector) { return matchesSelector(this, selector); }
  closest(selector) { for (let n = this; n; n = n.parentElement) if (n.nodeType === 1 && n.matches(selector)) return n; return null; }
  querySelectorAll(selector) {
    const chains = parseSelector(selector);
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.nodeType === 1 && chains.some((chain) => matchChain(child, chain, chain.length - 1))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  cloneNode(deep) {
    const copy = new FakeElement(this.tag);
    copy.id = this.id; copy.attrs = new Map(this.attrs); copy.classes = new Set(this.classes); copy.dataset = { ...this.dataset };
    copy.hidden = this.hidden; copy.value = this.value; copy._text = this._text; copy.checked = this.checked; copy.disabled = this.disabled;
    for (const key of ['type', 'src', 'href', 'rel', 'maxLength', 'autocomplete', 'draggable']) if (key in this) copy[key] = this[key];
    if (deep) this.children.forEach((c) => copy.append(c.cloneNode(true)));
    return copy;
  }
  attachShadow() { const root = new FakeElement('#shadow-root'); root.host = this; this.shadowRoot = root; return root; }
  getRootNode() { let n = this; while (n.parentElement) n = n.parentElement; return n; }
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  getContext() { return { clearRect() {}, drawImage() {} }; }
  toDataURL() { return 'data:image/png;base64,AAAA'; }
  setPointerCapture() {}
  click() { this.clicked = (this.clicked || 0) + 1; }
}
const textNode = (text) => { const node = new FakeElement('#text'); node._text = text; return node; };
const textOf = (el) => el._text + el.children.map(textOf).join('');
const allText = (list) => [...list].map(textOf);

// ----- parse the real index.html into the stub DOM -----
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
const SKIP_CONTENT = new Set(['script', 'style', 'noscript']);
function parseHtml(source) {
  const top = new FakeElement('#root');
  const stack = [top];
  const inlineScripts = {};
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
        if (['src', 'href', 'rel', 'type', 'maxlength'].includes(k)) el[k === 'maxlength' ? 'maxLength' : k] = v;
      }
      stack[stack.length - 1].append(el);
      if (SKIP_CONTENT.has(el.tag)) {
        const end = source.toLowerCase().indexOf(`</${el.tag}>`, token.lastIndex);
        if (el.tag === 'script' && el.id) inlineScripts[el.id] = source.slice(token.lastIndex, end);
        token.lastIndex = end + el.tag.length + 3;
        continue;
      }
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] && stack.length > 1) stack[stack.length - 1]._text += m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  for (const select of top.querySelectorAll('select')) {
    const first = select.children.find((c) => c.tag === 'option');
    if (first && !select.attrs.has('value')) select.value = first.attrs.get('value') ?? first._text;
  }
  return { top, inlineScripts };
}

// ----- browser stubs -----
function stubBrowser() {
  const { top, inlineScripts } = parseHtml(html);
  const htmlEl = top.children.find((c) => c.tag === 'html');
  const body = htmlEl.children.find((c) => c.tag === 'body');
  const ids = new Map();
  for (const el of top.querySelectorAll('[id]')) ids.set(el.id, el);

  const sessionMap = new Map();
  const localMap = new Map();
  const store = (map) => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  });
  const localStorage = store(localMap);
  const sessionStorage = store(sessionMap);

  document = {
    title: '', activeElement: null, visibilityState: 'visible', documentElement: htmlEl, body, readyState: 'complete',
    getElementById: (id) => ids.get(id) || null,
    querySelector: (selector) => top.querySelector(selector),
    querySelectorAll: (selector) => top.querySelectorAll(selector),
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => textNode(text),
    createDocumentFragment: () => new FakeElement('#fragment'),
  };
  listen(document);
  htmlEl.parentElement = null;

  const calls = { fetch: [], reload: 0, vibrate: [], history: [], objectUrls: [] };
  const cachedUrls = new Set();
  const cacheNames = [];
  const caches = {
    keys: async () => [...cacheNames],
    delete: async (name) => { const i = cacheNames.indexOf(name); if (i >= 0) cacheNames.splice(i, 1); return i >= 0; },
    open: async () => ({ match: async (url) => (cachedUrls.has(url) ? {} : undefined) }),
  };
  const registration = { scope: 'https://example.test/zz4/', active: { state: 'activated' }, unregistered: 0 };
  registration.unregister = async () => { registration.unregistered += 1; return true; };
  const serviceWorker = {
    registered: [], controller: null,
    register: async (url, options) => { serviceWorker.registered.push({ url, options }); return registration; },
    getRegistration: async () => registration,
    getRegistrations: async () => [registration],
    ready: Promise.resolve(registration),
  };
  listen(serviceWorker);
  const lockState = { requests: [] };
  const navigator = {
    userAgent: 'node-test', platform: 'node', maxTouchPoints: 0, serviceWorker, onLine: true, standalone: false,
    vibrate: (pattern) => { calls.vibrate.push(pattern); return true; },
    wakeLock: {
      request: async (type) => {
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { lock.handlers.push(fn); };
        lock.release = async () => { lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        lockState.requests.push(lock);
        return lock;
      },
    },
  };

  const entries = [{ state: null }];
  let at = 0;
  const history = {
    get state() { return entries[at].state; },
    pushState(state) { entries.splice(at + 1); entries.push({ state }); at += 1; calls.history.push('push'); },
    replaceState(state) { entries[at].state = state; },
    back() { if (at > 0) { at -= 1; const state = entries[at].state; setTimeout(() => dispatch(window, 'popstate', { state, bubbles: false }), 0); } },
  };
  const location = {
    href: 'https://example.test/zz4/', protocol: 'https:', hostname: 'example.test', search: '', pathname: '/zz4/',
    reload() { calls.reload += 1; },
  };

  window = {
    innerWidth: 400, innerHeight: 800, navigator, history, location, caches,
    setTimeout, clearTimeout, scrollTo() {},
    matchMedia: () => ({ matches: false }),
  };
  listen(window);

  class ImageStub {
    constructor() { this.naturalWidth = 200; this.naturalHeight = 100; }
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
    get src() { return this._src; }
  }
  class OptionStub extends FakeElement {
    constructor(text, value) { super('option'); this._text = text; this.value = value ?? text; }
  }
  const fetchStub = async (url) => { calls.fetch.push(String(url)); cachedUrls.add(new URL(String(url), location.href).href); return { ok: true }; };
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('history', history);
  define('localStorage', localStorage);
  define('sessionStorage', sessionStorage);
  define('caches', caches);
  define('fetch', fetchStub);
  define('HTMLElement', FakeElement);
  define('Element', FakeElement);
  define('Option', OptionStub);
  define('Image', ImageStub);
  define('requestAnimationFrame', (fn) => setTimeout(() => fn(0), 0));
  URL.createObjectURL = (blob) => { calls.objectUrls.push(blob); return `blob:test/${calls.objectUrls.length}`; };
  URL.revokeObjectURL = () => {};
  return { top, htmlEl, body, ids, localStorage, sessionStorage, calls, cachedUrls, cacheNames, caches, registration, serviceWorker, navigator, lockState, inlineScripts, history };
}

const env = stubBrowser();
const byId = (id) => {
  const el = document.getElementById(id);
  assert.ok(el, `index.html defines #${id}`);
  return el;
};
const stored = (key) => JSON.parse(env.localStorage.getItem(key));

// ----- gesture helpers (pointer ids and clocks are per helper call) -----
let clock = 1000;
let pointerSeq = 0;
const pointer = (id, x, y, extra = {}) => ({ pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: clock, ...extra });
async function tapAt(target, x, y) {
  pointerSeq += 1;
  clock += 2000;
  await dispatch(target, 'pointerdown', pointer(pointerSeq, x, y));
  clock += 50;
  await dispatch(target, 'pointerup', pointer(pointerSeq, x, y));
}
async function swipe(target, x, y, dx) {
  pointerSeq += 1;
  clock += 2000;
  await dispatch(target, 'pointerdown', pointer(pointerSeq, x, y));
  clock += 100;
  await dispatch(target, 'pointermove', pointer(pointerSeq, x + dx, y));
  await dispatch(target, 'pointerup', pointer(pointerSeq, x + dx, y));
}
const GRID = { left: 0, top: 100, width: 500, height: 600 };
const keyCenter = (digit) => ({ x: (((digit - 1) % 3) + 1) * 100 + 50, y: 100 + (Math.floor((digit - 1) / 3) + 1) * 100 + 50 });
const grid = (page) => document.querySelector(`[data-home-grid="${page}"]`);
const tapKey = (digit, page) => { const { x, y } = keyCenter(digit); return tapAt(grid(page), x, y); };
async function twoFingerSwipe(dy) {
  const touch = (id, y) => ({ identifier: id, screenY: y, clientX: id * 100, clientY: y });
  await dispatch(document, 'touchstart', { touches: [touch(1, 300), touch(2, 300)], changedTouches: [touch(1, 300), touch(2, 300)] });
  const moved = [touch(1, 300 + dy), touch(2, 300 + dy)];
  const move = await dispatch(document, 'touchmove', { touches: moved, changedTouches: moved });
  await dispatch(document, 'touchend', { touches: [], changedTouches: moved });
  return move;
}
const viewVisible = (name) => byId(`view-${name}`).hidden === false;
const visibleViews = () => env.top.querySelectorAll('#settings .sv').filter((v) => !v.hidden).map((v) => v.dataset.viewName);

let logic;
let perf;
let precheck;
let gestureGuide;
let homeManifest;

test('boot imports the real zz4 modules and starts on the fake home surface', async () => {
  logic = await import(new URL('logic.js', root));
  homeManifest = await import(new URL('home-manifest.js', root));
  // The inline repair script of index.html listens for choice-module-start before app.js runs.
  env.repairTimers = [];
  env.repairFetches = [];
  const repairSource = env.inlineScripts['choice-repair'];
  assert.ok(repairSource, 'index.html has the inline choice-repair script');
  env.repairSource = repairSource;
  env.runRepair = new Function('document', 'setTimeout', 'fetch', 'sessionStorage', 'navigator', 'location', 'window', repairSource);
  env.runRepair(
    document, (fn, ms) => { env.repairTimers.push({ fn, ms }); return env.repairTimers.length; },
    async (url, options) => { env.repairFetches.push({ url, options }); return { ok: true }; },
    env.sessionStorage, env.navigator, window.location, window,
  );
  // Start in the performance, as a performer who chose "공연" does.
  const seeded = logic.emptyState();
  seeded.options = { ...logic.defaultOptions(), startMode: 'performance' };
  assert.equal(logic.saveState(env.localStorage, seeded).ok, true);

  await import(new URL('app.js', root));
  perf = await import(new URL('performance.js', root));
  precheck = await import(new URL('precheck.js', root));
  gestureGuide = await import(new URL('gesture-guide.js', root));
  await settle(10);

  assert.equal(env.htmlEl.getAttribute('data-choice-ready'), '1', 'the repair watchdog flag is set when boot finished');
  assert.equal(byId('fake-home').hidden, false, 'fake home is visible');
  assert.equal(byId('settings').hidden, true, 'settings is hidden');
  assert.equal(document.title, '메모');
  assert.equal(document.body.dataset.view, 'fake-home');
  assert.ok(perf.fakeHomeSession, 'a performance session is open');
  assert.equal(perf.fakeHomeSession.page, 0);
  assert.equal(perf.fakeHomeSession.notes.length, 4, 'four built-in lists are in the notes');
  for (const page of [0, 1, 2]) {
    assert.equal(grid(page).children.length, homeManifest.HOME_MANIFEST.pages[page].length, `home page ${page} icons are drawn`);
  }
  assert.equal(byId('phone-dock').children.length, homeManifest.HOME_MANIFEST.dock.length, 'dock icons are drawn');
  assert.equal(byId('fake-home').dataset.ready, 'true');
  assert.deepEqual(env.serviceWorker.registered, [{ url: './sw.js', options: { scope: './' } }]);
  assert.equal(env.localStorage.getItem(logic.STORAGE_KEY).includes('"startMode":"performance"'), true, 'boot did not rewrite the saved store');
  // The settings screen behind it was rendered during boot.
  assert.match(textOf(byId('home-summary')), /^노트 목록 4개가 켜져 있어요\./);
  assert.equal(byId('notes-entry-title').textContent, '공연 준비 완료');
  assert.equal(byId('home-lists').children.length, 4, 'one card per built-in list');
  assert.equal(byId('template-list').children.length, 4, 'template list is drawn');
  assert.equal(byId('wallpaper-state').textContent, '지금 기본 배경을 쓰고 있습니다.');
  assert.equal(byId('memory-table').children.length, 18, 'memory table lists the nine icons on each of two pages');
  assert.equal(byId('opt-start-mode').value, 'performance');
  assert.equal(byId('vibrate-capability').hidden, true, 'vibration is supported by the stub');
  assert.equal(byId('input-guide').checked, false);
  assert.equal(env.top.querySelectorAll('.pv-stage').every((host) => host.shadowRoot && host.inert), true, 'settings previews are built and inert');
});

test('wake lock is held on the fake home, released when hidden and taken again when visible', async () => {
  assert.equal(env.lockState.requests.length, 1);
  assert.equal(env.lockState.requests[0].type, 'screen');
  assert.equal(env.lockState.requests[0].released, false);
  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(env.lockState.requests[0].released, true, 'hidden page releases the lock');
  assert.equal(env.lockState.requests.length, 1);
  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(env.lockState.requests.length, 2, 'visible page requests a new lock');
  assert.equal(env.lockState.requests[1].released, false);
});

test('gesture guide is shown on the first performance and remembers its dismissal', async () => {
  const guide = byId('settings-gesture-guide');
  const dismiss = byId('settings-gesture-dismiss');
  assert.equal(guide.hidden, false);
  assert.equal(document.activeElement, dismiss, 'focus moves to the dismiss button');
  assert.equal(env.localStorage.getItem(gestureGuide.GESTURE_GUIDE_KEY), null);
  let stopped = 0;
  await dispatch(guide, 'touchstart', { touches: [], stopPropagation() { stopped += 1; } });
  assert.equal(stopped, 1, 'touches on the guide do not travel further');
  await click(dismiss);
  assert.equal(guide.hidden, true);
  assert.equal(env.localStorage.getItem(gestureGuide.GESTURE_GUIDE_KEY), 'done');
});

test('wallpaper and dock taps count as 0, a key tap enters its digit, and the notes app opens the chosen line', async () => {
  const phone = byId('fake-phone');
  for (const g of [0, 1, 2]) grid(g).rect = GRID;
  env.top.querySelector('.fake-home-frame').rect = { left: 0, top: 0, width: 500, height: 800 };

  await tapAt(byId('fake-wallpaper'), 250, 400);
  assert.equal(perf.fakeHomeSession.entry.tens, 0, 'a wallpaper tap enters 0 as the tens digit');
  assert.equal(perf.fakeHomeSession.page, 1, 'second home after the first digit');
  assert.equal(byId('fake-home').dataset.page, '1');
  await tapKey(7, 1);
  assert.equal(perf.fakeHomeSession.entry.ones, 7);
  assert.equal(perf.fakeHomeSession.entry.value, 7);
  assert.equal(perf.fakeHomeSession.entry.locked, true);
  assert.equal(perf.fakeHomeSession.page, 2, 'third home after both digits');
  assert.equal(byId('entry-readout').hidden, true, 'performance display never shows the digits');

  await tapAt(grid(2).querySelector('[data-action="notes"]'), 250, 400);
  assert.equal(perf.fakeHomeSession.page, 'notes');
  assert.equal(byId('fake-notes').hidden, false);
  assert.equal(byId('fake-home').classList.contains('is-notes'), true);
  const rows = byId('fake-notes-body').querySelectorAll('.notes-row');
  assert.equal(rows.length, 4);

  const note = perf.fakeHomeSession.notes[0];
  await settle(170); // the click guard after a tap swallows an echo click for 150 ms
  await click(rows.find((row) => row.dataset.noteId === note.id));
  assert.equal(perf.fakeHomeSession.openNoteId, note.id);
  assert.equal(perf.fakeHomeSession.numberLocked, true);
  assert.equal(byId('fake-notes-title').textContent, note.name);
  const lines = byId('fake-notes-body').querySelectorAll('.notes-lines > li');
  assert.equal(lines.length, note.items.length + 1);
  assert.equal(lines[6].children[1].textContent, note.forceItem, 'line 7 is the prophecy item');
  assert.equal(lines[6].classList.contains('is-emphasis'), false, 'emphasis is off by default');
  assert.equal(byId('fake-notes-back').hidden, false);

  await click(byId('fake-notes-back'));
  assert.equal(perf.fakeHomeSession.openNoteId, null);
  assert.equal(byId('fake-notes-body').querySelectorAll('.notes-row').length, 4, 'back returns to the index');
  await click(byId('fake-notes-home'));
  assert.equal(perf.fakeHomeSession.page, 2);
  assert.equal(byId('fake-notes').hidden, true);
  assert.equal(phone.getAttribute('aria-hidden'), 'false');
});

test('right swipe undoes a digit, a left swipe and a dock tap enter digits, and three corner taps reset the number', async () => {
  // Reset the earlier number through the secret corner: three quick taps in the top right.
  const frame = env.top.querySelector('.fake-home-frame');
  for (let i = 0; i < 3; i += 1) {
    pointerSeq += 1;
    clock += 100;
    await dispatch(frame, 'pointerdown', pointer(pointerSeq, 480, 10));
    clock += 40;
    await dispatch(frame, 'pointerup', pointer(pointerSeq, 480, 10));
  }
  assert.equal(perf.fakeHomeSession.page, 0);
  assert.deepEqual(perf.fakeHomeSession.entry, logic.createFakeHomeEntry());

  await swipe(grid(0), 300, 350, -160);
  assert.equal(perf.fakeHomeSession.entry.tens, 6, 'a left swipe on key 6 enters 6');
  assert.equal(perf.fakeHomeSession.page, 1);
  await swipe(grid(1), 300, 350, 160);
  assert.equal(perf.fakeHomeSession.entry.tens, null, 'a right swipe removes the digit');
  assert.equal(perf.fakeHomeSession.page, 0);

  await tapAt(byId('phone-dock'), 250, 750);
  assert.equal(perf.fakeHomeSession.entry.tens, 0, 'a dock tap enters 0');
  await tapKey(9, 1);
  assert.equal(perf.fakeHomeSession.entry.value, 9);
  assert.equal(perf.fakeHomeSession.page, 2);
});

test('holding the page dots shows the digits only while pressed', async () => {
  // Reset, enter 3 on the first home, then press the page dots for longer than the hold time.
  const frame = env.top.querySelector('.fake-home-frame');
  for (let i = 0; i < 3; i += 1) {
    pointerSeq += 1;
    clock += 100;
    await dispatch(frame, 'pointerdown', pointer(pointerSeq, 480, 10));
    clock += 40;
    await dispatch(frame, 'pointerup', pointer(pointerSeq, 480, 10));
  }
  await tapKey(3, 0);
  assert.equal(byId('entry-readout').hidden, true);
  const dots = env.top.querySelector('.home-dots');
  pointerSeq += 1;
  clock += 2000;
  await dispatch(dots, 'pointerdown', pointer(pointerSeq, 250, 760));
  await settle(450);
  assert.equal(byId('entry-readout').hidden, false);
  assert.equal(byId('entry-readout').textContent, '3 ○');
  assert.equal(byId('entry-readout').dataset.kind, 'peek');
  await dispatch(dots, 'pointerup', pointer(pointerSeq, 250, 760));
  assert.equal(byId('entry-readout').hidden, true);
  assert.equal(byId('entry-readout').textContent, '');
});

test('a two-finger downward swipe leaves the performance for the settings and lets the screen sleep', async () => {
  const move = await twoFingerSwipe(150);
  assert.equal(move.defaultPrevented, true, 'the downward move is taken over from the browser');
  assert.equal(perf.fakeHomeSession, null);
  assert.equal(byId('settings').hidden, false);
  assert.equal(byId('fake-home').hidden, true);
  assert.equal(document.title, '너의 선택은?');
  assert.equal(document.body.dataset.view, 'settings');
  assert.deepEqual(visibleViews(), ['home']);
  assert.equal(env.lockState.requests.at(-1).released, true, 'settings does not hold the screen awake');
  assert.equal(history.state.sv, 'home');
  assert.equal(byId('fake-notes').hidden, true);
  assert.equal(byId('entry-readout').hidden, true);
});

test('a short two-finger move does not leave the performance', async () => {
  await click(byId('start-notes-show'));
  await settle(5);
  assert.ok(perf.fakeHomeSession, 'the start button opens the fake home');
  assert.equal(document.title, '메모');
  await twoFingerSwipe(40);
  assert.ok(perf.fakeHomeSession, 'a swipe below the threshold keeps the performance');
  await twoFingerSwipe(150);
  assert.equal(perf.fakeHomeSession, null);
});

test('settings are saved to storage through the option controls', async () => {
  await click(env.top.querySelector('[data-sv-go="advanced"]'));
  assert.deepEqual(visibleViews(), ['advanced']);
  const read = () => stored(logic.STORAGE_KEY).options;

  await typeInto(byId('opt-display'), 'practice', 'change');
  assert.equal(read().display, 'practice');
  byId('opt-vibrate').checked = true;
  await dispatch(byId('opt-vibrate'), 'change');
  assert.equal(read().vibrate, true);
  await typeInto(byId('opt-note-emphasis'), 'bold', 'change');
  assert.equal(read().noteEmphasis, 'bold');
  const font = byId('opt-note-font');
  await typeInto(font, '22', 'input');
  assert.equal(byId('opt-note-font-value').textContent, '22px', 'dragging updates the label before saving');
  assert.equal(byId('note-style-sample').style.fontSize, '22px');
  assert.equal(read().noteFont === 22, false, 'dragging alone does not save');
  await dispatch(font, 'change');
  assert.equal(read().noteFont, 22);
  assert.equal(read().startMode, 'performance', 'other saved options are kept');

  byId('input-guide').checked = true;
  await dispatch(byId('input-guide'), 'change');
  assert.equal(env.localStorage.getItem('magic-choice.v1.input-guide') ?? env.localStorage.getItem('magic-choice-dist.v1.input-guide'), '1');

  await typeInto(byId('opt-start-mode'), 'settings', 'change');
  assert.equal(read().startMode, 'settings');
  assert.equal(byId('options-message').textContent, '');
  assert.equal(byId('adv-pv-notes').shadowRoot.querySelector('.notes-lines') !== null, true, 'the notes preview is drawn');
});

test('list cards switch lists in and out of the notes', async () => {
  await click(env.top.querySelector('#view-advanced [data-sv-go="home"]'));
  assert.deepEqual(visibleViews(), ['home']);
  const cards = byId('home-lists').children;
  assert.equal(cards.length, 4);
  const toggle = cards[0].querySelector('.sv-sw');
  assert.equal(toggle.getAttribute('aria-checked'), 'true');
  await click(toggle);
  assert.equal(stored(logic.STORAGE_KEY).builtins['builtin-movies'].enabled, false);
  assert.match(textOf(byId('home-summary')), /^노트 목록 3개가 켜져 있어요\./);
  assert.equal(byId('home-lists').children[0].querySelector('.sv-sw').getAttribute('aria-checked'), 'false');
  await click(byId('home-lists').children[0].querySelector('.sv-sw'));
  assert.equal(stored(logic.STORAGE_KEY).builtins['builtin-movies'].enabled, true);
  assert.match(textOf(byId('home-summary')), /^노트 목록 4개가 켜져 있어요\./);

  // Changing a built-in list's prophecy item from its card.
  await click(byId('home-lists').children[0].querySelector('[data-action="target"]'));
  assert.deepEqual(visibleViews(), ['w3']);
  const picks = byId('wz-picks').children;
  assert.equal(picks.length, 100);
  await click(picks[4]);
  await click(byId('wz-save'));
  await settle(10);
  assert.equal(stored(logic.STORAGE_KEY).builtins['builtin-movies'].target, 5);
  assert.deepEqual(visibleViews(), ['done']);
  await click(env.top.querySelector('#view-done [data-sv-go="home"]'));
  assert.deepEqual(visibleViews(), ['home']);
});

test('the list wizard walks three steps, history back returns one step, and the saved list reaches the store', async () => {
  await click(byId('new-list'));
  assert.deepEqual(visibleViews(), ['w1']);
  await click(byId('wz-next1'));
  assert.equal(byId('wz-message1').textContent, '목록 이름을 입력하세요.');
  assert.deepEqual(visibleViews(), ['w1']);

  await typeInto(byId('wz-title'), '주사위 목록', 'input');
  await click(env.top.querySelectorAll('#wz-looks .sv-chip')[2]);
  await click(byId('wz-next1'));
  assert.deepEqual(visibleViews(), ['w2']);
  assert.equal(byId('wz-next2').disabled, true, 'two items are needed first');

  // The browser Back button (history.back) returns to step 1 and keeps the entered title.
  await click(byId('wz-back2'));
  await settle(10);
  assert.deepEqual(visibleViews(), ['w1']);
  assert.equal(byId('wz-title').value, '주사위 목록');
  await click(byId('wz-next1'));

  await typeInto(byId('wz-items'), '하나\n둘\n셋\n넷\n다섯', 'input');
  assert.equal(textOf(byId('wz-count')), '5개');
  assert.equal(byId('wz-next2').disabled, false);
  await click(byId('wz-next2'));
  assert.deepEqual(visibleViews(), ['w3']);
  assert.equal(byId('wz-picks').children.length, 5);
  assert.equal(byId('wz-save').disabled, true, 'a prophecy item must be picked first');

  await click(byId('wz-picks').children[2]);
  assert.equal(byId('wz-picks').children[2].getAttribute('aria-checked'), 'true');
  assert.equal(byId('wz-save').disabled, false);
  assert.equal(byId('wz-pv-title').textContent, '주사위 목록');
  await click(byId('wz-plus'));
  assert.equal(byId('wz-num').textContent, '2');
  await click(byId('wz-minus'));
  assert.equal(byId('wz-num').textContent, '1');

  // Editing the items on step 3 reorders and trims them.
  await click(byId('wz-edit-toggle'));
  assert.equal(byId('wz-picks').children[0].children.length, 6, 'edit rows have number, text and four buttons');
  await click(byId('wz-picks').children[4].querySelector('[data-act="del"]'));
  assert.equal(byId('wz-picks').children.length, 4);
  await click(byId('wz-edit-toggle'));
  assert.equal(byId('wz-picks').children.length, 4);
  assert.equal(byId('wz-picks').children[2].getAttribute('aria-checked'), 'true', 'the prophecy item stays selected');

  await click(byId('wz-save'));
  await settle(10);
  const saved = stored(logic.STORAGE_KEY);
  assert.equal(saved.presets.length, 1);
  assert.equal(saved.presets[0].name, '주사위 목록');
  assert.equal(saved.presets[0].appearance, 'todo');
  const split = logic.splitForcePreset(saved.presets[0]);
  assert.equal(split.forceItem, '셋');
  assert.deepEqual(split.items, ['하나', '둘', '넷']);
  assert.deepEqual(visibleViews(), ['done']);
  assert.match(byId('done-text').textContent, /주사위 목록/);
  assert.equal(byId('wz-message3').textContent, '');
  assert.equal(history.state.sv, 'done');

  await click(env.top.querySelector('#view-done [data-sv-go="home"]'));
  assert.deepEqual(visibleViews(), ['home']);
  assert.equal(byId('home-lists').children.length, 5);
  assert.match(textOf(byId('home-lists').children[0]), /주사위 목록/);
  assert.match(textOf(byId('home-summary')), /^노트 목록 5개가 켜져 있어요\./);
});

test('the list detail renames, switches and deletes a list through the confirm dialog', async () => {
  const card = byId('home-lists').children.find((entry) => textOf(entry).includes('주사위 목록'));
  const id = card.dataset.listId;
  await click(card);
  assert.deepEqual(visibleViews(), ['detail']);
  assert.equal(byId('detail-title').textContent, '주사위 목록');
  assert.equal(byId('detail-target').textContent, '셋');

  await click(byId('detail-rename-open'));
  assert.equal(byId('detail-rename').hidden, false);
  assert.equal(byId('detail-rename-input').value, '주사위 목록');
  await typeInto(byId('detail-rename-input'), '주사위 둘', 'input');
  await click(byId('detail-rename-save'));
  assert.equal(stored(logic.STORAGE_KEY).presets[0].name, '주사위 둘');
  assert.equal(byId('detail-title').textContent, '주사위 둘');
  assert.equal(byId('detail-message').textContent, '이름을 바꿨어요.');

  await click(byId('detail-switch'));
  assert.deepEqual(stored(logic.STORAGE_KEY).hiddenPresetIds, [id]);
  assert.equal(byId('detail-switch').getAttribute('aria-checked'), 'false');
  await click(byId('detail-switch'));
  assert.deepEqual(stored(logic.STORAGE_KEY).hiddenPresetIds, []);

  // The editor fields still preview the list being typed.
  await typeInto(byId('items'), '가\n나\n다', 'input');
  assert.equal(byId('item-count').textContent, '3개 / 199 (예언 항목 제외)');
  await typeInto(byId('force-item'), '예언', 'input');
  assert.equal(byId('editor-preview').children.length, 4);
  assert.match(textOf(byId('editor-preview').children.find((row) => row.classList.contains('is-force'))), /예언 \(예언 항목\)$/);

  // Delete asks first. Cancel keeps the list, OK removes it.
  const dialog = byId('confirm-dialog');
  await click(byId('detail-delete'));
  assert.equal(dialog.open, true);
  assert.match(byId('confirm-text').textContent, /주사위 둘/);
  dialog.returnValue = 'cancel';
  await dispatch(dialog, 'close');
  await settle(5);
  assert.equal(stored(logic.STORAGE_KEY).presets.length, 1);
  await click(byId('detail-delete'));
  dialog.returnValue = 'ok';
  await dispatch(dialog, 'close');
  await settle(5);
  assert.equal(stored(logic.STORAGE_KEY).presets.length, 0);
  assert.deepEqual(visibleViews(), ['home']);
  assert.equal(byId('home-lists').children.length, 4);
});

test('backup exports the lists and imports the same file again as a preview and an applied copy', async () => {
  // A list to export again.
  await click(byId('new-list'));
  await typeInto(byId('wz-title'), '백업 목록', 'input');
  await click(byId('wz-next1'));
  await typeInto(byId('wz-items'), 'a1\na2\na3', 'input');
  await click(byId('wz-next2'));
  await click(byId('wz-picks').children[1]);
  await click(byId('wz-save'));
  await settle(10);
  assert.equal(stored(logic.STORAGE_KEY).presets.length, 1);
  await click(env.top.querySelector('#view-done [data-sv-go="home"]'));

  await click(byId('export-backup'));
  assert.match(byId('backup-message').textContent, /^목록 1개, 묶음 0개, 일상 메모 0개를 내보냈습니다\./);
  const blob = env.calls.objectUrls.at(-1);
  const text = await blob.text();
  const backup = JSON.parse(text);
  assert.equal(backup.presets[0].name, '백업 목록');

  const file = { size: text.length, text: async () => text };
  byId('import-file').files = [file];
  await dispatch(byId('import-file'), 'change');
  await settle(5);
  assert.equal(byId('import-preview').hidden, false);
  const rows = allText(byId('import-list').children);
  assert.ok(rows.some((row) => row.startsWith('목록 「백업 목록」') && row.includes('건너뜀')), 'an identical list is skipped');
  assert.match(rows.at(-1), /^합계: 추가 0개/);
  assert.equal(byId('import-apply').disabled, true, 'nothing new to apply');
  await click(byId('import-cancel'));
  assert.equal(byId('import-preview').hidden, true);
  assert.match(byId('backup-message').textContent, /가져오기를 취소했습니다/);
  assert.equal(stored(logic.STORAGE_KEY).presets.length, 1);

  // A file with another list in it is previewed first, then added without touching the saved list.
  const other = JSON.parse(text);
  other.presets[0] = { ...other.presets[0], id: 'imported-1', name: '가져온 목록' };
  const otherText = JSON.stringify(other);
  byId('import-file').files = [{ size: otherText.length, text: async () => otherText }];
  await dispatch(byId('import-file'), 'change');
  await settle(5);
  assert.ok(allText(byId('import-list').children).some((row) => row.startsWith('목록 「가져온 목록」: 추가')));
  assert.equal(byId('import-apply').disabled, false);
  assert.equal(stored(logic.STORAGE_KEY).presets.length, 1, 'the preview saves nothing');
  await click(byId('import-apply'));
  const after = stored(logic.STORAGE_KEY).presets.map((preset) => preset.name);
  assert.deepEqual(after, ['백업 목록', '가져온 목록']);
  assert.match(byId('backup-message').textContent, /^1개를 가져왔습니다\./);
  assert.equal(byId('import-preview').hidden, true);
});

test('dummy notes and a performance set decide which notes the performance shows', async () => {
  await click(env.top.querySelector('[data-sv-go="dummy"]'));
  assert.deepEqual(visibleViews(), ['dummy']);
  assert.equal(byId('dummy-list').children[0].textContent, '일상 메모가 없습니다.');
  await click(byId('dummy-examples'));
  assert.equal(byId('dummy-message').textContent, '예시 4개를 넣었습니다.');
  assert.equal(stored(logic.STORAGE_KEY).dummyNotes.length, 4);
  assert.equal(byId('dummy-list').children.length, 4);

  await click(env.top.querySelector('[data-sv-go="sets"]'));
  assert.deepEqual(visibleViews(), ['sets']);
  await typeInto(byId('set-name'), '오늘 공연', 'input');
  const boxes = byId('set-presets').querySelectorAll('input');
  assert.equal(boxes.length, 4 + stored(logic.STORAGE_KEY).presets.length, 'saved lists and four built-in lists');
  boxes.find((box) => box.value === 'builtin-foods').checked = true;
  await click(byId('set-save'));
  assert.equal(byId('set-message').textContent, '묶음을 저장했습니다.');
  const saved = stored(logic.STORAGE_KEY);
  assert.equal(saved.sets.length, 1);
  assert.deepEqual(saved.sets[0].presetIds, ['builtin-foods']);
  await typeInto(byId('set-active'), saved.sets[0].id, 'change');
  assert.equal(stored(logic.STORAGE_KEY).activeSetId, saved.sets[0].id);
  assert.match(byId('set-summary').textContent, /^지금 노트에 나오는 것: 목록 1개, 일상 메모 0개, 묶음 「오늘 공연」/);

  await click(env.top.querySelector('#view-sets [data-sv-go="advanced"]') || env.top.querySelector('[data-sv-go="advanced"]'));
  await click(byId('start-notes-show'));
  await settle(5);
  assert.deepEqual(perf.fakeHomeSession.notes.map((note) => note.id), ['builtin-foods']);
  await twoFingerSwipe(150);
  assert.equal(perf.fakeHomeSession, null);
  await typeInto(byId('set-active'), '', 'change');
  assert.equal(stored(logic.STORAGE_KEY).activeSetId, null);
});

test('the check screen reports the show state and reads offline readiness from the caches', async () => {
  const prefixes = ['choice-shell-', 'choice-dist-shell-'];
  const scope = encodeURIComponent('https://example.test/zz4/');
  await click(env.top.querySelector('[data-sv-go="check"]'));
  assert.deepEqual(visibleViews(), ['check']);
  await settle(10);
  const rows = () => allText(byId('precheck-list').children);
  assert.equal(rows()[0], '공연 시작: 가능합니다.');
  assert.ok(rows().includes('설정 이동 안내: 확인함'), 'the dismissed gesture guide is reflected');
  assert.ok(rows().some((row) => row.startsWith('고른 번호 줄 강조: 켜짐.')), 'bold emphasis is flagged as risky');
  assert.ok(rows().some((row) => row.startsWith('숫자 칸 보여 주기: 켜짐. 주의:') || row.startsWith('숫자 칸 보여 주기: 켜짐 (연습용)')));
  assert.ok(rows().some((row) => row.startsWith('기본 제공 목록: 4개를 노트에 넣음')));
  assert.ok(rows().some((row) => row.startsWith('백업 목록: 항목 3개, 목표 설정됨')));
  assert.equal(rows().at(-4).startsWith('오프라인 저장: 아직 준비되지 않았습니다.'), true, 'no artwork is cached yet');
  assert.equal(byId('check-summary').textContent, '문제 없음');

  // The worker takes control: the app fetches every artwork URL and the check line turns ready.
  for (const prefix of prefixes) env.cacheNames.push(`${prefix}${scope}-v1`);
  env.cacheNames.push('unrelated-cache');
  const urls = precheck.choiceArtworkUrls();
  assert.ok(urls.length > 20, 'the artwork list comes from the home manifest');
  env.serviceWorker.controller = {};
  await dispatch(env.serviceWorker, 'controllerchange', { bubbles: false });
  await settle(20);
  assert.deepEqual([...env.calls.fetch].sort(), [...urls].sort(), 'every artwork URL is fetched once');
  assert.equal(rows().some((row) => row === '오프라인 저장: 준비됨'), true);

  env.cachedUrls.clear();
  await click(byId('precheck-refresh'));
  await settle(20);
  assert.equal(rows().some((row) => row.startsWith('오프라인 저장: 아직 준비되지 않았습니다.')), true, 'the refresh button rereads the caches');
  for (const url of urls) env.cachedUrls.add(url);
  await click(byId('precheck-refresh'));
  await settle(20);
  assert.equal(rows().some((row) => row === '오프라인 저장: 준비됨'), true);

  await click(env.top.querySelector('#view-check [data-sv-go="advanced"]'));
});

test('own app icons are cropped, saved to storage, drawn on the fake home and removed again', async () => {
  await click(env.top.querySelector('#view-advanced [data-sv-go="home"]'));
  await click(env.top.querySelector('[data-sv-go="deco"]'));
  assert.deepEqual(visibleViews(), ['deco']);
  assert.equal(byId('usericon-editor').hidden, true);
  assert.equal(byId('usericon-list').children.length, 0);

  const file = { name: 'icon.png', type: 'image/png' };
  byId('usericon-file').files = [file];
  await dispatch(byId('usericon-file'), 'change');
  await settle(5);
  assert.equal(byId('usericon-editor').hidden, false);
  assert.equal(byId('usericon-slots').children.length, 30);
  assert.equal(byId('usericon-slot-text').textContent, '고른 칸: 5행 1열', 'the first free cell is pre-picked');

  await typeInto(byId('usericon-page'), '2', 'change');
  const slots = byId('usericon-slots').children;
  const open = slots.find((slot) => !slot.disabled && slot.listeners.has('click'));
  assert.ok(open, 'the third home has free zero cells');
  await click(open);
  assert.match(byId('usericon-slot-text').textContent, /^고른 칸: \d행 \d열$/);
  await click(byId('usericon-add'));
  assert.equal(byId('usericon-message').textContent, '앱 이름을 입력하세요.');
  await typeInto(byId('usericon-label'), '내 앱', 'input');
  await click(byId('usericon-add'));
  assert.equal(byId('usericon-message').textContent, '「내 앱」를 넣었습니다.');
  assert.equal(byId('usericon-editor').hidden, true);

  const icons = JSON.parse(env.localStorage.getItem(logic.USER_ICON_KEY));
  assert.equal(icons.length, 1);
  assert.equal(icons[0].label, '내 앱');
  assert.equal(icons[0].page, 2);
  assert.equal(icons[0].dataUrl, 'data:image/png;base64,AAAA');
  assert.equal(byId('usericon-list').children.length, 1);
  assert.match(textOf(byId('usericon-list').children[0]), /^내 앱 · 셋째 홈 \d행 \d열빼기$/);
  assert.ok(grid(2).querySelectorAll('.app-glyph').some((img) => img.src === 'data:image/png;base64,AAAA'), 'the fake home draws the saved icon');
  assert.ok(grid(2).querySelectorAll('.app-name').some((name) => name.textContent === '내 앱'));

  // The settings preview copy follows the icon too.
  const previewGrid = byId('deco-pv-home').shadowRoot.querySelector('[data-home-grid="2"]');
  assert.ok(previewGrid.querySelectorAll('.app-glyph').some((img) => img.src === 'data:image/png;base64,AAAA'));

  await click(byId('usericon-list').children[0].querySelector('.danger'));
  assert.equal(byId('usericon-message').textContent, '뺐습니다.');
  assert.deepEqual(JSON.parse(env.localStorage.getItem(logic.USER_ICON_KEY)), []);
  assert.equal(byId('usericon-list').children.length, 0);
  assert.equal(grid(2).querySelectorAll('.app-glyph').some((img) => img.src === 'data:image/png;base64,AAAA'), false);
});

test('the wallpaper reset saves the default wallpaper through the option controls', async () => {
  assert.equal(stored(logic.STORAGE_KEY).options.wallpaper, 'default');
  byId('wallpaper-state').textContent = '';
  await click(byId('wallpaper-reset'));
  await settle(5);
  assert.equal(byId('wallpaper-state').textContent, '지금 기본 배경을 쓰고 있습니다.');
  assert.equal(stored(logic.STORAGE_KEY).options.wallpaper, 'default');
  assert.equal(stored(logic.STORAGE_KEY).options.wallpaperId, '');
  assert.equal(stored(logic.STORAGE_KEY).options.noteEmphasis, 'bold', 'the other saved options come along');
  await click(env.top.querySelector('#view-deco [data-sv-go="home"]'));
  assert.deepEqual(visibleViews(), ['home']);
});

test('the saved practice display, vibration and bold emphasis drive the next performance', async () => {
  const guideHidden = byId('settings-gesture-guide').hidden;
  const vibrations = env.calls.vibrate.length;
  const locks = env.lockState.requests.length;
  await click(byId('start-notes-show'));
  await settle(5);
  assert.ok(perf.fakeHomeSession);
  assert.equal(byId('settings-gesture-guide').hidden, guideHidden, 'a dismissed guide stays hidden');
  assert.equal(env.lockState.requests.length, locks + 1);
  assert.equal(env.lockState.requests.at(-1).released, false);
  assert.equal(byId('entry-readout').hidden, false, 'practice shows the entry from the start');
  assert.equal(byId('entry-readout').textContent, '○ ○');
  assert.equal(byId('fake-home').style.getPropertyValue('--icon-scale'), '1');

  await tapKey(3, 0);
  assert.equal(byId('entry-readout').textContent, '3 ○');
  assert.equal(byId('entry-readout').dataset.kind, 'practice');
  assert.equal(env.calls.vibrate.length, vibrations + 1);
  assert.deepEqual(env.calls.vibrate.at(-1), 30);
  await tapKey(2, 1);
  assert.equal(byId('entry-readout').textContent, '3 2');
  assert.equal(perf.fakeHomeSession.entry.value, 32);
  await tapAt(grid(2).querySelector('[data-action="notes"]'), 250, 400);
  assert.equal(perf.fakeHomeSession.page, 'notes');

  assert.equal(perf.fakeHomeSession.notes.length, logic.selectNotes(stored(logic.STORAGE_KEY)).notes.length);
  await settle(170);
  await click(byId('fake-notes-body').querySelectorAll('.notes-row').find((row) => row.dataset.noteId === 'builtin-movies'));
  const lines = byId('fake-notes-body').querySelectorAll('.notes-lines > li');
  const noted = perf.fakeHomeSession.notes.find((note) => note.id === perf.fakeHomeSession.openNoteId);
  assert.equal(lines[31].children[1].textContent, noted.forceItem);
  assert.equal(lines[31].classList.contains('is-emphasis'), true, 'bold emphasis marks the chosen line');
  assert.equal(lines[31].dataset.emphasis, 'bold');
  assert.equal(byId('fake-notes-body').querySelector('.notes-lines').style.getPropertyValue('--note-size'), '22px');

  // Hiding the page ends the transient input: the practice digits go away until the next digit.
  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(env.lockState.requests.at(-1).released, true);
  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(env.lockState.requests.at(-1).released, false, 'the lock is taken again on return');

  await twoFingerSwipe(150);
  assert.equal(perf.fakeHomeSession, null);
  assert.equal(byId('settings').hidden, false);
  assert.deepEqual(visibleViews(), ['home']);
});

test('the install card shows instructions, then the native prompt and the install result', async () => {
  await import(new URL('install-prompt.js', root));
  const guidance = env.top.querySelector('[data-install-guidance]');
  const button = env.top.querySelector('[data-install-button]');
  assert.equal(button.hidden, true);
  assert.match(guidance.textContent, /^Chrome 메뉴\(⋮\)에서/);

  let prompted = 0;
  let prevented = 0;
  const native = (outcome) => ({
    preventDefault() { prevented += 1; },
    prompt: async () => { prompted += 1; },
    userChoice: Promise.resolve({ outcome }),
  });
  await dispatch(window, 'beforeinstallprompt', native('accepted'));
  assert.equal(prevented, 1);
  assert.equal(button.hidden, false);
  assert.equal(guidance.textContent, '버튼을 눌러 이 앱을 설치하세요.');
  await click(button);
  assert.equal(prompted, 1);
  assert.equal(button.hidden, true);
  assert.match(guidance.textContent, /^설치 요청을 보냈습니다\./);

  await dispatch(window, 'beforeinstallprompt', native('dismissed'));
  await click(button);
  assert.equal(prompted, 2);
  assert.match(guidance.textContent, /^Chrome 메뉴\(⋮\)에서/, 'a dismissed prompt falls back to instructions');

  await dispatch(window, 'appinstalled');
  assert.match(guidance.textContent, /^설치 요청을 받았습니다\./);
});

test('the inline self-repair stays idle after a clean boot and clears only this app caches when boot never finished', async () => {
  const armed = env.repairTimers.filter((timer) => timer.ms === 3000);
  assert.equal(armed.length, 1, 'choice-module-start arms the 3 second clock once');
  env.sessionStorage.setItem('choice-self-repair', '1');
  armed[0].fn();
  await settle(5);
  assert.equal(env.repairFetches.length, 0, 'no probe when data-choice-ready is set');
  assert.equal(env.sessionStorage.getItem('choice-self-repair'), null, 'the once-only marker is cleared after a good boot');
  assert.equal(env.calls.reload, 0);

  // Pretend the module never reached the ready flag.
  const prefix = env.repairSource.match(/var prefix = '([^']+)'/)[1];
  env.htmlEl.removeAttribute('data-choice-ready');
  env.cacheNames.length = 0;
  const scope = encodeURIComponent('https://example.test/zz4/');
  env.cacheNames.push(`${prefix}${scope}-v1`, `${prefix}${encodeURIComponent('https://example.test/other/')}-v1`, 'unrelated-cache');
  armed[0].fn();
  await settle(10);
  assert.equal(env.repairFetches.length, 1);
  assert.match(env.repairFetches[0].url, /^sw\.js\?probe=\d+$/);
  assert.equal(env.sessionStorage.getItem('choice-self-repair'), '1');
  assert.deepEqual(env.cacheNames, [`${prefix}${encodeURIComponent('https://example.test/other/')}-v1`, 'unrelated-cache'], 'only this scope cache family is deleted');
  assert.equal(env.registration.unregistered, 1);
  assert.equal(env.calls.reload, 1);

  armed[0].fn();
  await settle(5);
  assert.equal(env.repairFetches.length, 1, 'repair runs once per session');
  console.error = originalConsoleError;
});
