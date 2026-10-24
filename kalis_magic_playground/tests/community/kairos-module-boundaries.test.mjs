import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { pathToFileURL } from 'node:url';

// Loads KAIROS (zz1) exactly as its index.html does: the classic scripts are evaluated as scripts and the
// module entry (app.js and its real imports) is loaded with dynamic import() as separate ES modules, so a
// module that uses an identifier it does not import throws ReferenceError here as it does in a browser.
// The script list, order, classic/module kind and defer are read from index.html itself.
// Drives boot, the settings-entry guide, the two-finger downward swipe, settings saves, the stopwatch
// performance flow (portrait and landscape), wake lock on visibility and the install prompt through the
// listeners the app registers on a minimal stub DOM.
// KAIROS_ROOT selects another root, for example distribution-snapshots/kairos. That snapshot keeps its
// module inline in index.html, so the inline body is written to a temp dir next to the files it imports.
// Not reachable with these stubs: preset-edit gestures by hand (digit and group swipes), the landscape
// long-press and three-finger mode toggle, ResizeObserver layout, and the appearance editor that
// settings-ui.js mounts (it needs a full DOM; only its install-event slot and API load here).
const root = process.env.KAIROS_ROOT ? pathToFileURL(`${process.env.KAIROS_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz1/', import.meta.url);
const tempDir = mkdtempSync(join(tmpdir(), 'kairos-boundary-'));
after(() => { console.error = originalConsoleError; rmSync(tempDir, { recursive: true, force: true }); });

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
    (target.listeners[type] ||= []).push({ fn, capture: options === true || !!(options && options.capture), once: !!(options && options.once) });
  };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item.fn !== fn); };
}

let document;
let window;
// ----- selector matching (the subset the app uses) -----
const PIECE = /^(?:([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]|:nth-child\((\d+)\))/;
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
    else if (m[9]) tests.push({ nth: Number(m[9]) });
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
    if (t.nth) return Boolean(el.parentElement) && el.parentElement.children.indexOf(el) + 1 === t.nth;
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

class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.id = ''; this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = '';
    this._html = ''; this.rect = null; this.style = {}; this.scrollTop = 0; this.offsetWidth = 0;
    this.attrs = new Map(); this.classes = new Set();
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
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html = String(value); this.replaceChildren(...parseHtml(this._html).top.children); }
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
  prepend(...nodes) { nodes.forEach((node) => { node.parentElement = this; }); this.children.unshift(...nodes); }
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
  scrollIntoView() {}
  setPointerCapture() {}
  hasPointerCapture() { return false; }
  releasePointerCapture() {}
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  }
}

// ----- parse the real index.html into the stub DOM; nothing is created on demand -----
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

function stubBrowser(pathname) {
  const store = new Map();
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
  byId('p-lap-area').rect = { left: 0, top: 300, width: 500, height: 200 };

  document = {
    activeElement: null, visibilityState: 'visible', hidden: false, readyState: 'loading', title: 'KAIROS',
    body, head: htmlEl.children.find((child) => child.tag === 'head'), documentElement: htmlEl,
    getElementById: (id) => ids.get(id) || null,
    querySelector: (selector) => top.querySelector(selector),
    querySelectorAll: (selector) => top.querySelectorAll(selector),
    createElement: (tag) => new FakeElement(tag),
  };
  listenerHost(document);

  const wake = { requests: [], failNext: false };
  const navigator = {
    userAgent: 'node-test', standalone: false, registered: [],
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
    if (document.hidden) for (const lock of wake.requests) if (!lock.released) lock.release();
  });

  const frames = new Map();
  let frameId = 0;
  const location = { hash: '', search: '', hostname: 'example.test', pathname };
  window = {
    document, localStorage, location, navigator, innerWidth: 844, innerHeight: 390, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false }),
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
  define('matchMedia', window.matchMedia);
  define('innerWidth', window.innerWidth);
  define('innerHeight', window.innerHeight);
  define('requestAnimationFrame', window.requestAnimationFrame);
  define('cancelAnimationFrame', window.cancelAnimationFrame);
  return { store, localStorage, byId, wake, navigator, frames, runFrames };
}

// Dispatches like a browser: capture from window down, then bubble up; stopPropagation and
// stopImmediatePropagation are honoured. A listener that throws or rejects is recorded as an uncaught error.
async function fire(target, type, init = {}) {
  const event = {
    type, target, timeStamp: performance.now(), cancelable: true, defaultPrevented: false, stopped: false, immediate: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = true; this.immediate = true; }, ...init,
  };
  const chain = [];
  if (target !== window) {
    if (target !== document) for (let node = target; node; node = node.parentElement) chain.push(node);
    chain.push(document);
  }
  chain.push(window);
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

function runClassic(script) {
  const filename = script.src || 'inline-classic.js';
  runInThisContext(script.src ? readFileSync(new URL(script.src, root), 'utf8') : script.body, { filename });
}
function moduleUrlFor(script) {
  if (script.src) return new URL(script.src, root);
  const imports = [...script.body.matchAll(/\bfrom\s+["'](\.\/[^"']+)["']/g)].map((match) => match[1]);
  for (const name of imports) copyFileSync(new URL(name, root), join(tempDir, name));
  writeFileSync(join(tempDir, 'package.json'), '{"type":"module"}');
  writeFileSync(join(tempDir, 'inline-module.mjs'), script.body);
  return pathToFileURL(join(tempDir, 'inline-module.mjs'));
}

const pathname = process.env.KAIROS_ROOT ? '/distribution-snapshots/kairos/index.html' : '/zz1/index.html';
const env = stubBrowser(pathname);
const node = env.byId;
const MODE_KEY = 'stopwatch_ui_mode';
const DIGIT_GUIDE_KEY = 'stopwatch_portrait_digit_guide_v1';
const stored = (key) => env.localStorage.getItem(key);
env.localStorage.setItem(MODE_KEY, 'portrait');
env.localStorage.setItem(DIGIT_GUIDE_KEY, '1');

const touch = (id, x, y, extra = {}) => ({ pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y, ...extra });
async function tap(target, id, x, y) {
  await fire(target, 'pointerdown', touch(id, x, y));
  await fire(target, 'pointerup', touch(id, x, y));
}
async function twoFingerSwipe(dy) {
  const fingers = [[71, 100], [72, 300]];
  const portrait = node('portrait-app');
  for (const [id, x] of fingers) await fire(portrait, 'pointerdown', touch(id, x, 150));
  const moves = [];
  for (const [id, x] of fingers) moves.push(await fire(portrait, 'pointermove', touch(id, x, 150 + dy)));
  for (const [id, x] of fingers) await fire(portrait, 'pointerup', touch(id, x, 150 + dy));
  await settle(10);
  return moves;
}
const portraitTime = () => {
  const spans = node('p-time-display').querySelectorAll('[data-p-digit]').map((span) => span.textContent).join('');
  const minutes = node('p-minutes').querySelectorAll('[data-p-minute]').map((span) => span.textContent).join('');
  return minutes + spans;
};
const landscapeTime = () => node('l-time-display').querySelectorAll('[data-l-digit]').map((span) => span.textContent).join('');
async function startStop(button, press = (target) => fire(target, 'click')) {
  await press(button);
  env.runFrames();
  await settle(30);
  await press(button);
}

let entryUrl;
test('boot: classic scripts and the app.js module graph load as separate modules and reach the ready stage', async () => {
  const immediate = pageScripts.filter((script) => !script.module && !script.defer);
  const deferred = pageScripts.filter((script) => script.module || script.defer);
  assert.ok(deferred.some((script) => script.module), 'index.html has a module entry');
  immediate.forEach(runClassic);
  // readyState stays 'loading' while the scripts run, so settings-ui.js waits for DOMContentLoaded, which is
  // never fired here: its appearance editor needs a full DOM and is not part of this test.
  for (const script of deferred) {
    if (script.module) { entryUrl = moduleUrlFor(script); await import(entryUrl); }
    else runClassic(script);
  }
  document.readyState = 'complete';
  await fire(window, 'load');
  await settle();

  assert.equal(typeof window.MagicSettingsUI.installGuide, 'function', 'settings-ui.js classic script ran');
  assert.deepEqual(env.navigator.registered, ['./sw.js'], 'service worker registered on load');
  assert.equal(stored('stopwatch_storage_migrated_v2'), '1', 'loadStorage ran the v2 migration');
  assert.equal(node('shell').dataset.uiMode, 'portrait');
  assert.equal(node('portrait-app').hidden, false);
  assert.equal(node('landscape-frame').hidden, true);
  assert.equal(node('mode-portrait').getAttribute('aria-pressed'), 'true');
  assert.equal(node('p-control').textContent, '시작');
  assert.equal(node('p-lap').disabled, true);
  assert.equal(portraitTime(), '000000');
  assert.equal(node('l-control-label').textContent, 'START');
  assert.equal(node('l-control').getAttribute('aria-label'), 'START');
  assert.equal(node('settings').hidden, true);
  assert.equal(env.wake.requests.length, 1, 'boot requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
});

test('selftest entry: opening the app with #selftest hides the shell and the app itself runs the self tests', async () => {
  const entry = new URL(entryUrl);
  entry.search = '?selftest'; // a fresh evaluation of the entry module; its imports stay the same modules
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  location.hash = '#selftest';
  try { await import(entry); } finally { console.log = originalLog; location.hash = ''; }
  assert.equal(node('shell').hidden, true, 'the selftest entry hides the app shell');
  assert.equal(node('selftest').hidden, false);
  assert.equal(node('selftest-result').textContent, 'ALL PASS');
  assert.deepEqual(lines, ['ALL PASS']);
  node('shell').hidden = false;
  node('selftest').hidden = true;
});

test('guide: the digit-cell guide shows once at boot, then the entry tutorial blocks touches until dismissed', async () => {
  const guide = node('p-digit-guide');
  assert.equal(node('p-digit-guide-enabled').checked, true, 'saved opt-in is read at boot');
  assert.equal(guide.hidden, false);
  assert.equal(guide.getAttribute('aria-hidden'), 'false');
  await settle(1350);
  assert.equal(guide.hidden, true, 'the guide fades away on its own');
  assert.equal(guide.getAttribute('aria-hidden'), 'true');

  const tutorial = node('settings-entry-tutorial');
  assert.equal(tutorial.hidden, false, 'first run shows the settings-entry tutorial');
  const blocked = await fire(tutorial, 'pointerdown', touch(5, 10, 10));
  assert.equal(blocked.defaultPrevented, true);
  assert.equal(blocked.stopped, true, 'touches on the tutorial do not reach the app');
  await fire(window, 'pointerup', touch(5, 10, 10));
  const swipesWhileShown = await twoFingerSwipe(140);
  assert.equal(node('settings').hidden, true, 'settings cannot open while the tutorial is shown');
  assert.equal(swipesWhileShown.every((event) => !event.defaultPrevented), true);

  assert.equal(stored('stopwatch-settings-entry-tutorial-v1'), null);
  await fire(node('settings-entry-tutorial-dismiss'), 'click');
  assert.equal(tutorial.hidden, true);
  assert.equal(stored('stopwatch-settings-entry-tutorial-v1'), '1');
});

test('install prompt: offer bar, native prompt outcomes, appinstalled, then dismissal is remembered', async () => {
  let prompted = 0;
  const native = (outcome) => ({ prompt: async () => { prompted += 1; }, userChoice: Promise.resolve({ outcome }) });
  assert.equal(document.body.children.some((child) => child.id === 'install-nudge'), false, 'no bar before the browser offers install');

  const first = await fire(window, 'beforeinstallprompt', native('dismissed'));
  assert.equal(first.defaultPrevented, true, 'the browser mini-infobar is suppressed');
  assert.equal(window.__magicInstallPrompt, first, 'settings-ui.js keeps the event in the shared slot');
  const bar = document.body.children.find((child) => child.id === 'install-nudge');
  assert.ok(bar, 'the install bar is appended to the body');
  assert.equal(bar.querySelector('span').textContent, '홈 화면에 앱으로 설치할 수 있어요');
  const button = (act) => {
    const item = bar.querySelector(`button[data-act="${act}"]`);
    assert.ok(item, `the bar offers a ${act} button`);
    return item;
  };
  const reached = [];
  document.addEventListener('pointerdown', () => reached.push('pointerdown'));
  await fire(bar, 'pointerdown', touch(9, 5, 5));
  assert.deepEqual(reached, [], 'touches on the bar do not reach the app');
  await fire(window, 'pointerup', touch(9, 5, 5));

  await fire(bar, 'click', { target: button('install') });
  assert.equal(prompted, 1);
  assert.equal(bar.querySelector('span').textContent, 'Chrome 메뉴(⋮)에서 앱 설치를 선택하세요.', 'a dismissed prompt falls back to menu instructions');

  await fire(window, 'beforeinstallprompt', native('accepted'));
  assert.equal(bar.querySelector('span').textContent, '홈 화면에 앱으로 설치할 수 있어요');
  await fire(bar, 'click', { target: button('install') });
  assert.equal(prompted, 2);
  assert.equal(bar.querySelector('span').textContent, '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 Chrome 메뉴(⋮)에서 다시 시도하세요.');

  await fire(window, 'appinstalled');
  assert.equal(window.__magicInstallPrompt, null);
  assert.equal(bar.querySelector('span').textContent, '설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 Chrome 메뉴(⋮)에서 다시 시도하세요.');

  assert.equal(stored('stopwatch_uni_install_nudge_done'), null);
  await fire(bar, 'click', { target: button('close') });
  assert.equal(stored('stopwatch_uni_install_nudge_done'), '1');
  assert.equal(document.body.children.includes(bar), false, 'closing removes the bar');
  document.listeners.pointerdown = document.listeners.pointerdown.filter((entry) => !entry.fn.toString().includes("reached.push"));
});

test('wake lock: released when the page hides, requested again when visible, refusal is tolerated', async () => {
  const first = env.wake.requests[0];
  assert.equal(first.released, false);
  document.hidden = true;
  document.visibilityState = 'hidden';
  await fire(document, 'visibilitychange'); // the stub browser releases the lock; the test does not
  await settle();
  assert.equal(first.released, true);
  assert.equal(env.wake.requests.length, 1, 'the app does not ask for a lock while hidden');

  document.hidden = false;
  document.visibilityState = 'visible';
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2, 'a visible page requests a new lock');
  assert.equal(env.wake.requests[1].type, 'screen');
  assert.equal(env.wake.requests[1].released, false);

  env.wake.failNext = true;
  document.hidden = true;
  document.visibilityState = 'hidden';
  await fire(document, 'visibilitychange');
  assert.equal(env.wake.requests[1].released, true, 'the browser released the second lock');
  document.hidden = false;
  document.visibilityState = 'visible';
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2, 'the refused request left no lock');
  await fire(node('portrait-app'), 'pointerdown', touch(61, 50, 50));
  await fire(window, 'pointerup', touch(61, 50, 50));
  await settle();
  assert.equal(env.wake.requests.length, 3, 'a later touch tries again after the refusal');
  assert.equal(env.wake.requests[2].released, false);
});

test('two-finger downward swipe: a short swipe does nothing, a long one opens settings and swallows the click', async () => {
  const short = await twoFingerSwipe(50);
  assert.equal(node('settings').hidden, true, 'a short swipe does not open settings');
  assert.equal(short.every((event) => !event.defaultPrevented), true);

  const long = await twoFingerSwipe(140);
  assert.equal(node('settings').hidden, false);
  assert.equal(node('settings-title').textContent, '설정');
  assert.equal(long[1].defaultPrevented, true, 'the opening move is claimed by the swipe');
  assert.equal(node('mode-portrait').getAttribute('aria-pressed'), 'true');
  assert.equal(node('mode-landscape').getAttribute('aria-pressed'), 'false');
  assert.equal(node('sequence-slots').children.length, 3, 'three empty preset slots are listed');
  assert.equal(node('sequence-status').textContent, '현재 사용: 일반 스톱워치');

  const click = await fire(window, 'click');
  assert.equal(click.defaultPrevented, true, 'the click that follows the swipe is swallowed');
});

test('settings are saved: digit guide, preset slot (edit, add value, save, apply) and screen direction', async () => {
  await settle(720); // the swipe swallows clicks for 700 ms; a person needs longer than that to reach a control
  const guideOn = node('p-digit-guide-enabled');
  guideOn.checked = false;
  await fire(guideOn, 'change');
  assert.equal(stored(DIGIT_GUIDE_KEY), '0');
  guideOn.checked = true;
  await fire(guideOn, 'change');
  assert.equal(stored(DIGIT_GUIDE_KEY), '1');

  const slots = node('sequence-slots');
  const row = slots.children[0];
  const [, actions] = row.children;
  const [apply, edit] = actions.children;
  assert.equal(apply.disabled, true, 'an empty slot cannot be applied');
  await fire(slots, 'click', { target: edit });
  assert.equal(node('preset-editor').hidden, false);
  assert.equal(node('preset-editor-title').textContent, '1번 프리셋 만들기');

  assert.equal(node('slot-kind-text').getAttribute('aria-pressed'), 'true', 'an empty slot starts as a phrase slot');
  await fire(node('slot-kind-seq'), 'click');
  assert.equal(node('slot-kind-seq').getAttribute('aria-pressed'), 'true');
  assert.equal(node('preset-sequence-fields').hidden, false);
  assert.equal(node('preset-text-fields').hidden, true);
  node('sequence-input').value = '123';
  await fire(node('sequence-add'), 'click');
  assert.equal(node('sequence-status').textContent, '00-99 숫자를 최대 8개까지 추가할 수 있습니다.', 'an invalid value is refused');
  node('preset-name').value = '생일';
  node('sequence-input').value = '28';
  await fire(node('sequence-add'), 'click');
  assert.equal(node('sequence-chips').children.length, 1);
  assert.equal(node('sequence-chips').children[0].textContent, '28 ×');
  node('preset-force-after').value = '0';
  await fire(node('preset-save'), 'click');
  assert.deepEqual(JSON.parse(stored('stopwatch_named_presets_v1'))[0], { name: '생일', kind: 'seq', value: '28', forceAfter: 0 });
  assert.equal(node('sequence-status').textContent, '생일 저장됨 · 적용 버튼을 누르면 사용합니다.');
  assert.equal(node('preset-editor').hidden, true);
  const savedApply = slots.children[0].children[1].children[0];
  assert.equal(savedApply.disabled, false);

  await fire(node('mode-landscape'), 'click');
  assert.equal(stored(MODE_KEY), 'landscape');
  assert.equal(node('shell').dataset.uiMode, 'landscape');
  assert.equal(node('landscape-frame').hidden, false);
  assert.equal(node('portrait-app').hidden, true);
  assert.equal(node('mode-landscape').getAttribute('aria-pressed'), 'true');
  await fire(node('mode-portrait'), 'click');
  assert.equal(stored(MODE_KEY), 'portrait');
  assert.equal(node('portrait-app').hidden, false);

  await fire(slots, 'click', { target: savedApply });
  assert.equal(stored('stopwatch_seq'), '28');
  assert.equal(stored('stopwatch_trick3'), '1');
  assert.equal(node('settings').hidden, true, 'applying a preset closes settings');
  assert.equal(node('p-time-display').querySelectorAll('[data-p-digit]').length, 4);
});

test('performance flow: the preset forces the stop digits, lap and reset work, trick cycle reaches digit mode', async () => {
  const control = node('p-control');
  const lap = node('p-lap');
  const colon = node('p-colon');
  assert.equal(colon.className, 'colon trick-seq', 'the applied number sequence shows on the colon');
  assert.equal(control.textContent, '시작');

  await fire(control, 'click');
  env.runFrames();
  assert.equal(control.textContent, '중단');
  assert.equal(control.classList.contains('running'), true);
  assert.equal(lap.disabled, false);
  assert.equal(lap.textContent, '랩');
  await settle(30);
  await fire(lap, 'click');
  const lapRows = node('p-lap-rows');
  assert.equal(lapRows.children.length, 1);
  assert.equal(lapRows.children[0].children[0].textContent, '랩 1');
  assert.match(lapRows.children[0].children[1].textContent, /^00:\d\d\.\d\d$/);
  await fire(control, 'click');
  assert.equal(control.textContent, '시작');
  assert.equal(portraitTime(), '000028', 'forceAfter 0: the first stop shows the configured 28 hundredths');
  assert.equal(lap.textContent, '재설정');
  assert.equal(node('l-control-label').textContent, 'RESET');

  await fire(lap, 'click');
  assert.equal(portraitTime(), '000000');
  assert.equal(lapRows.children.length, 0);
  assert.equal(lap.disabled, true);

  const time = node('p-time-display');
  await fire(time, 'click');
  assert.equal(colon.className, 'colon', 'cycle: sequence preset to normal');
  await fire(time, 'click');
  assert.equal(colon.className, 'colon trick', 'cycle: normal to digit mode');

  const area = node('p-lap-area');
  await tap(area, 81, 450, 350);
  await tap(area, 82, 150, 450);
  assert.equal(node('portrait-app').querySelector('.tab-world').classList.contains('feedback'), true, 'two cell taps arm the digit result');
  await startStop(control);
  assert.equal(portraitTime(), '000057', 'digit mode: tapped cells 5 and 7 become the hundredths');
  await fire(lap, 'click');
  assert.equal(portraitTime(), '000000');
});

test('quick setting from the alarm tab shows a typed phrase on stop; the timer tab opens preset settings', async () => {
  const alarm = node('portrait-app').querySelector('#p-tabs .tab:nth-child(2)');
  await tap(alarm, 91, 120, 700);
  assert.equal(node('quick-settings').hidden, false);
  assert.equal(node('quick-status').textContent, '');
  node('quick-value').value = '   ';
  await fire(node('quick-apply'), 'click');
  assert.equal(node('quick-status').textContent, '표시할 값을 입력하세요.');
  node('quick-value').value = 'KALI';
  await fire(node('quick-apply'), 'click');
  assert.equal(node('quick-settings').hidden, true);
  assert.equal(stored('stopwatch_custom_text'), 'KALI');
  assert.equal(stored('stopwatch_trick3'), '0');
  assert.equal(node('p-colon').className, 'colon trick-text');

  await startStop(node('p-control'));
  assert.equal(node('p-custom-display').hidden, false);
  assert.equal(node('p-custom-display').textContent, 'KALI');
  assert.equal(node('p-numeric-display').hidden, true);
  await fire(node('p-lap'), 'click');
  assert.equal(node('p-numeric-display').hidden, false);

  const timerTab = node('portrait-app').querySelector('#p-tabs .tab:nth-child(4)');
  await fire(timerTab, 'click');
  assert.equal(node('settings').hidden, false);
  assert.equal(node('settings-title').textContent, '프리셋');
  assert.equal(node('settings').classList.contains('preset-focus'), true);
  assert.equal(node('sequence-status').textContent, '현재 사용: 프리셋 모드 · 문구 숫자');
  await fire(node('settings-close'), 'click');
  assert.equal(node('settings').hidden, true);
});

test('landscape flow: the big control starts, stops on the phrase and resets', async () => {
  await fire(node('p-tabs').querySelector('#p-tabs .tab:nth-child(4)'), 'click');
  await fire(node('mode-landscape'), 'click');
  await fire(node('settings-close'), 'click');
  assert.equal(node('landscape-frame').hidden, false);
  const control = node('l-control');
  const press = async (id) => { await fire(control, 'pointerdown', touch(id, 400, 300)); await fire(window, 'pointerup', touch(id, 400, 300)); };

  await press(101);
  env.runFrames();
  assert.equal(node('l-control-label').textContent, 'STOP');
  assert.equal(control.getAttribute('aria-label'), 'STOP');
  await settle(30);
  await press(102);
  assert.equal(node('l-control-label').textContent, 'RESET');
  assert.equal(node('l-custom-display').hidden, false);
  assert.equal(node('l-custom-display').textContent, 'KALI');
  await press(103);
  assert.equal(node('l-control-label').textContent, 'START');
  assert.equal(node('l-custom-display').textContent, 'KALI', 'reset keeps the phrase preset visible until the next start');
});
