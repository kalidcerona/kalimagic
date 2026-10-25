import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveObjectURL } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { pathToFileURL } from 'node:url';

// Loads the QR generator (zz13, ARosaegida) the way its index.html does: first-run-guide.js, vendor/qrcodegen.js and
// vendor/jsQR.js (classic, defer) are evaluated as real scripts, then app.mjs is loaded with dynamic import() as a real
// ES module together with its real import core.mjs. core.mjs reads globalThis.qrcodegen and globalThis.jsQR, so a
// missing vendor script or a missing import fails here as it does in the browser.
// The script list, order, kind and defer flag are read from index.html. The DOM is parsed from the real index.html;
// a missing id is null, nothing is created on demand.
// Drives boot, the first-run guide, the two-finger downward pointer swipe, settings validation and saving, generation
// order (decoys, target, extra targets), the canvas the app paints (decoded with the real jsQR), dot editing with the
// protected/budget/preview rules, undo, clean, PNG export, backup/import, freeze, wake lock on visibilitychange (the stub
// browser releases the lock on hide), the install flow, the feedback footer, a relaunch from storage, unreadable and
// invalid stored data, and the /tools/arosaegida storage key.
// QR_ROOT selects another root, for example distribution-snapshots/qr.
// Not reachable with these stubs: native form validation (required/type=url), the localhost-only local-preview hook,
// real PNG encoding (the stub canvas hands toBlob the raw RGBA bytes), camera decoding, real animation or CSS.
const SNAPSHOT = Boolean(process.env.QR_ROOT);
const root = SNAPSHOT ? pathToFileURL(`${process.env.QR_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz13/', import.meta.url);
const pathname = SNAPSHOT ? '/distribution-snapshots/qr/' : '/zz13/';
const GUIDE_KEY = `first-settings-guide:v1:arosaegida:${pathname.replace(/\/$/, '')}`;
const SESSION_KEY = 'magic-qr-session-v1';

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
  target.dispatchEvent = (event) => {
    for (const entry of [...(target.listeners[event.type] || [])]) {
      try { entry.fn.call(target, event); } catch (error) { errors.push(`uncaught dispatchEvent listener error on ${event.type}: ${error?.stack || error}`); }
    }
    return true;
  };
}

let document;
let window;
// ----- selector matching (the subset the app and the guide use) -----
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

class FakeStyle {
  removeProperty(name) { delete this[name]; }
  setProperty(name, value) { this[name] = String(value); }
}

let downloads = [];
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.id = ''; this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = ''; this.open = false;
    this.rect = null; this.style = new FakeStyle(); this.attrs = new Map(); this.classes = new Set(); this.image = null;
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
  get firstChild() { return this.children[0] || null; }
  setAttribute(key, value) {
    this.attrs.set(key, String(value));
    if (key === 'id') this.id = String(value);
    if (key === 'class') this.className = value;
    if (key === 'hidden') this.hidden = true;
    if (key === 'open') this.open = true;
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
  removeChild(node) { this.children = this.children.filter((child) => child !== node); node.parentElement = null; return node; }
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
  // <dialog>: showModal opens it, close() closes it and the browser fires the close event as a queued task.
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; setTimeout(() => this.dispatchEvent({ type: 'close', target: this }), 0); }
  // <canvas>: the app paints with putImageData; toBlob hands the raw RGBA bytes to the callback.
  getContext() { return { putImageData: (image) => { this.image = image; } }; }
  toBlob(callback) { setTimeout(() => callback(this.image ? new Blob([this.image.data], { type: 'image/png' }) : null), 0); }
  // <a download>: the browser starts a download of the blob behind the object URL.
  click() {
    if (this.tag === 'a' && this.download) downloads.push({ name: this.download, blob: resolveObjectURL(this.href) });
    else this.dispatchEvent({ type: 'click', target: this });
  }
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  }
}

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

const mediaState = { standalone: false, changeListeners: [] };
function matchMedia(query) {
  return {
    media: query,
    get matches() { return query === '(display-mode: standalone)' ? mediaState.standalone : false; },
    addEventListener(type, fn) { if (type === 'change') mediaState.changeListeners.push(fn); },
  };
}

class FakeImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
}

function stubBrowser({ store = new Map(), path = pathname, userAgent = 'node-test' } = {}) {
  const fault = { getKey: null };
  const localStorage = {
    getItem: (key) => { if (fault.getKey === key) throw new Error('SecurityError'); return store.has(key) ? store.get(key) : null; },
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

  document = {
    activeElement: null, visibilityState: 'visible', hidden: false, readyState: 'loading', title: 'QR 코드 랜덤 생성기', selectedText: null, copied: [],
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
    userAgent, standalone: false, registered: [], clipboard: null, maxTouchPoints: 0,
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
    serviceWorker: { register: async (url, options) => { navigator.registered.push({ url, options }); } },
  };
  // The browser, not the page, releases a screen wake lock when the document becomes hidden. Registered before any
  // page script, so it runs first on visibilitychange. The tests never release a lock on the app's behalf.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const lock of wake.requests) if (!lock.released) lock.release();
  });

  const frames = new Map();
  let frameId = 0;
  const location = { hash: '', search: '', hostname: 'example.test', protocol: 'https:', origin: 'https://example.test', pathname: path };
  window = {
    document, localStorage, location, navigator, innerWidth: 400, innerHeight: 800, setTimeout, clearTimeout, matchMedia,
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
  define('matchMedia', matchMedia);
  define('ImageData', FakeImageData);
  downloads = [];
  mediaState.changeListeners = [];
  return { store, localStorage, byId, wake, navigator, fault, frames };
}

// Dispatches like a browser: capture from window down, then bubble up; stopPropagation is honoured. DOM0 handlers
// (onclick, onsubmit, ...) run in the bubble phase of their node. A listener that throws or rejects is recorded.
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
  if (!optional) assert.ok(chain.some((node) => (node.listeners[type] || []).length > 0 || typeof node[`on${type}`] === 'function'), `a listener is registered for ${type}`);
  const pending = [];
  const call = (node, fn) => {
    try {
      const result = fn.call(node, event);
      if (result && typeof result.then === 'function') pending.push(result);
    } catch (error) { errors.push(`uncaught listener error on ${type}: ${error?.stack || error}`); }
  };
  const run = (node, capture) => {
    for (const entry of [...(node.listeners[type] || [])]) {
      if (entry.capture !== capture) continue;
      if (entry.once) node.removeEventListener(type, entry.fn);
      call(node, entry.fn);
    }
    if (!capture && typeof node[`on${type}`] === 'function') call(node, node[`on${type}`]);
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

// Loads the page as the browser does: deferred scripts in document order (the module entry is deferred by nature),
// then DOMContentLoaded, which is when first-run-guide.js shows its guide.
async function bootPage(search = '') {
  const immediate = pageScripts.filter((script) => !script.module && !script.defer);
  const deferred = pageScripts.filter((script) => script.module || script.defer);
  assert.deepEqual(deferred.map((script) => script.src), ['./first-run-guide.js', './vendor/qrcodegen.js', './vendor/jsQR.js', './app.mjs'], 'index.html script order');
  assert.equal(deferred[3].module, true);
  for (const script of immediate) runInThisContext(readFileSync(new URL(script.src, root), 'utf8'), { filename: script.src });
  for (const script of deferred) {
    if (script.module) { const url = new URL(script.src, root); url.search = search; await import(url); }
    else runInThisContext(readFileSync(new URL(script.src, root), 'utf8'), { filename: script.src });
  }
  document.readyState = 'interactive';
  await fire(document, 'DOMContentLoaded', {}, { optional: true });
  document.readyState = 'complete';
  await settle();
}

let env = stubBrowser();
const node = (id) => env.byId(id);
const stored = (key) => env.localStorage.getItem(key);
const ptr = (id, x, y, extra = {}) => ({ pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y, ...extra });
const liveLocks = () => env.wake.requests.filter((lock) => !lock.released);
const settingsOpen = () => node('settings').open === true;

async function twoFingerSwipe(dx = 0, dy = 140, target = node('stage')) {
  await fire(target, 'pointerdown', ptr(1, 100, 300));
  await fire(target, 'pointerdown', ptr(2, 300, 300));
  await fire(target, 'pointermove', ptr(1, 100 + dx, 300 + dy));
  await fire(target, 'pointermove', ptr(2, 300 + dx, 300 + dy));
  await fire(target, 'pointerup', ptr(1, 100 + dx, 300 + dy));
  await fire(target, 'pointerup', ptr(2, 300 + dx, 300 + dy));
  await settle();
}
async function openSettings() {
  await twoFingerSwipe();
  assert.equal(settingsOpen(), true, 'the two-finger swipe opens settings');
}
async function closeSettings() {
  await fire(node('close'), 'click');
  await settle();
  assert.equal(settingsOpen(), false);
}
const downloadText = async (entry) => entry.blob.text();
async function backupJson() {
  const before = downloads.length;
  await fire(node('backup'), 'click');
  assert.equal(downloads.length, before + 1, 'the backup button starts a download');
  assert.equal(downloads.at(-1).name, 'QR-backup.json');
  return JSON.parse(await downloadText(downloads.at(-1)));
}
const image = () => node('qr').image;
const decodeCanvas = () => {
  const img = image();
  return globalThis.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data;
};
const gridSize = () => image().width / 16 - 8;
const cellPixel = (img, x, y) => img.data[(Math.floor((y + 4.5) * 16) * img.width + Math.floor((x + 4.5) * 16)) * 4];
function placeCanvas() {
  const cells = gridSize() + 8;
  node('qr').rect = { left: 20, top: 100, width: cells * 8, height: cells * 8 };
}
async function tapCell(x, y, id = 1) {
  const point = [20 + (x + 4.5) * 8, 100 + (y + 4.5) * 8];
  await fire(node('qr'), 'pointerdown', ptr(id, ...point));
  await fire(node('qr'), 'pointerup', ptr(id, ...point));
}
const nativeInstall = (outcome, { throws = false, deferred = false } = {}) => {
  const log = { prompted: 0, answer: null };
  const userChoice = deferred ? new Promise((resolve) => { log.answer = () => resolve({ outcome }); }) : Promise.resolve({ outcome });
  return { log, init: { prompt: async () => { log.prompted += 1; if (throws) throw new Error('InvalidStateError'); }, userChoice } };
};
const TAB_LINES = ['브라우저 탭입니다.', '설치 여부는 여기서 확인할 수 없습니다.'];
const TAIL_LINES = ['앱 이름: 아로새기다', '이전 이름: QR', '홈 화면·브라우저 앱 목록에서', '아이콘을 확인하세요.', 'iPhone·iPad는 앱 보관함도 확인하세요.', '이 페이지에서는 설치된 앱을 제거하거나 고칠 수 없습니다.'];
const installLines = (middle = [], head = TAB_LINES) => [...head, ...middle, ...TAIL_LINES];
const statusLines = () => node('install-status').textContent.split('\n');
const NOTE_UNREADABLE = '저장된 내용을 읽지 못했습니다.\n원본을 읽고 보관할 수 있을 때까지 저장과 복원을 멈췄습니다.';
const NOTE_INVALID = '저장된 내용을 확인하지 못했습니다.\n원본은 그대로 두었고 자동 저장은 멈췄습니다.\n설정 백업으로 그 원본을 받을 수 있습니다.\n저장하고 시작이나 백업 복원은 원본을 바꿉니다.';
const NOTE_KEPT_FILE = '이전 저장 내용은 바꾸었습니다.\n읽을 수 있던 원본은 이 기기에 따로 남겨 두었고 백업 파일 다운로드도 요청했습니다.';
const NOTE_BACKUP_ORIGINAL = '읽지 못한 저장 원본의 백업 다운로드를 요청했습니다.';
const NOTE_BACKUP_REFUSED = '원본을 읽지 못해 기본 설정을 백업으로 내려받지 않습니다.';

let core;
test('boot: the guide, vendor scripts and the app.mjs module graph load as separate scripts and modules and reach the ready stage', async () => {
  await bootPage();
  core = await import(new URL('core.mjs', root));
  assert.equal(typeof globalThis.qrcodegen.QrCode.encodeSegments, 'function', 'vendor/qrcodegen.js ran');
  assert.equal(typeof globalThis.jsQR, 'function', 'vendor/jsQR.js ran');
  assert.equal(core.encode('https://example.com/', 1, 0).size, 29, 'core.mjs encodes through qrcodegen');
  const saved = JSON.parse(stored(SESSION_KEY));
  assert.equal(saved.schema, 1);
  assert.equal(saved.defaultsRevision, core.DEFAULTS_REVISION);
  assert.equal(saved.counter, 0);
  assert.equal(saved.frozen, false);
  assert.equal(saved.current, null);
  assert.equal(saved.config.target, 'https://lnmagic.co.kr/');
  assert.equal(saved.config.ordinal, 5);
  assert.equal(saved.config.dot, 120);
  assert.equal(node('qr').hidden, true);
  assert.equal(node('empty').hidden, false);
  assert.equal(node('empty').textContent, '생성을 눌러 주세요.');
  assert.equal(node('generate').disabled, false);
  assert.equal(node('freeze').disabled, true);
  assert.equal(node('freeze').textContent, '고정');
  assert.equal(node('png').disabled, true);
  assert.equal(node('undo').disabled, true);
  assert.equal(node('clean').disabled, true);
  assert.equal(node('notice').textContent, '');
  assert.equal(settingsOpen(), false);
  assert.equal(env.navigator.registered.length, 1);
  assert.equal(env.navigator.registered[0].url, './sw.js');
  assert.deepEqual(env.navigator.registered[0].options, { scope: './' });
  assert.equal(env.wake.requests.length, 1, 'boot requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
  assert.equal(node('contact-open').href, 'https://qr.kakao.com/talk/eshVqDvk7WKk0zDKtiC9UTa.T6Q-');
  assert.equal(node('install').hidden, true);
  assert.equal(node('install-android').hidden, true);
  assert.deepEqual(statusLines(), installLines());
  assert.equal(node('install-manual').textContent, '설치 창이 없으면 브라우저 메뉴에서 ‘앱 설치’를 확인하세요.\n‘홈 화면에 추가’는 바로가기일 수 있습니다.\n이 페이지는 시스템 앱 목록을 확인하지 않습니다.');
});

test('first-run guide (first-run-guide.js): blocks touches and the settings swipe until it is dismissed, then remembers it', async () => {
  const overlay = document.querySelector('.first-run-guide');
  assert.ok(overlay, 'the guide is appended to the body on DOMContentLoaded');
  assert.equal(overlay.parentElement, document.body);
  assert.equal(overlay.getAttribute('role'), 'dialog');
  assert.equal(overlay.querySelector('h2').textContent, '설정 여는 방법');
  assert.equal(overlay.querySelector('p').textContent, '손가락 두 개를 대고\n아래로 쓸어내리세요.\n설정 화면이 열립니다.');
  assert.equal(overlay.querySelectorAll('.first-run-guide__finger').length, 2);
  assert.equal(document.head.children.filter((child) => child.id === 'first-run-guide-styles').length, 1, 'its stylesheet is installed once');
  const dismiss = overlay.querySelector('button');
  assert.equal(dismiss.textContent, '알겠어요');
  assert.equal(document.activeElement, dismiss, 'focus moves to the dismiss button');
  assert.equal(stored(GUIDE_KEY), null);

  const pointer = await fire(overlay, 'pointerdown', ptr(7, 50, 50));
  assert.equal(pointer.stopped, true, 'touches on the guide do not reach the app');
  await fire(overlay, 'pointerup', ptr(7, 50, 50));
  await twoFingerSwipe(0, 140, overlay);
  assert.equal(settingsOpen(), false, 'a swipe on the guide does not open settings');

  const tab = await fire(overlay, 'keydown', { key: 'Tab' });
  assert.equal(tab.defaultPrevented, true);
  assert.equal(document.activeElement, dismiss, 'Tab keeps the focus on the button');
  await fire(dismiss, 'click');
  assert.equal(document.body.children.includes(overlay), false, 'dismissing removes the guide');
  assert.equal(stored(GUIDE_KEY), '1');
});

test('settings: the two-finger swipe opens them with the saved values and releases the wake lock; short or diagonal drags do not', async () => {
  await twoFingerSwipe(0, 60);
  assert.equal(settingsOpen(), false, 'a short drag is not the gesture');
  await twoFingerSwipe(150, 140);
  assert.equal(settingsOpen(), false, 'a diagonal drag is not the gesture');
  await fire(node('stage'), 'pointerdown', ptr(1, 50, 300));
  await fire(node('stage'), 'pointerdown', ptr(2, 150, 300));
  await fire(node('stage'), 'pointerdown', ptr(3, 250, 300));
  for (const id of [1, 2, 3]) await fire(node('stage'), 'pointermove', ptr(id, 50 + (id - 1) * 100, 440));
  for (const id of [1, 2, 3]) await fire(node('stage'), 'pointerup', ptr(id, 50 + (id - 1) * 100, 440));
  assert.equal(settingsOpen(), false, 'three fingers never open settings');

  assert.equal(liveLocks().length, 1);
  await openSettings();
  assert.equal(liveLocks().length, 0, 'settings does not hold the screen awake');
  assert.equal(env.wake.requests.length, 1);
  assert.equal(node('target').value, 'https://lnmagic.co.kr/');
  assert.equal(node('ordinal').value, 5);
  assert.equal(node('decoys').value.split('\n').length, core.DEFAULTS.decoys.length);
  assert.equal(node('decoys').value.split('\n')[0], 'https://www.ikea.com/kr/ko/');
  assert.equal(node('dot').value, '120');
  assert.equal(node('dotvalue').textContent, '120%');
  assert.equal(node('session').textContent, '현재 생성 횟수: 0');
  assert.equal(node('error').textContent, '');
  assert.equal(document.querySelectorAll('.extrarow').length, 0);

  // Cancel closes and asks for the lock again.
  await closeSettings();
  assert.equal(liveLocks().length, 1);
  assert.equal(env.wake.requests.length, 2);
});

test('settings form: dot size display, validation messages and saving a new configuration restart the counter', async () => {
  await openSettings();
  node('dot').value = '130';
  await fire(node('dot'), 'input');
  assert.equal(node('dotvalue').textContent, '130%');
  assert.equal(node('dot').getAttribute('aria-valuetext'), '130%');

  const submit = async () => { const event = await fire(node('form'), 'submit'); assert.equal(event.defaultPrevented, true); await settle(); };
  node('target').value = 'ftp://example.com/';
  await submit();
  assert.equal(node('error').textContent, 'HTTP 또는 HTTPS 주소를 입력하세요.');
  node('target').value = 'https://example.com/target';
  node('ordinal').value = '0';
  await submit();
  assert.equal(node('error').textContent, '순서는 1-1000000 사이 정수여야 합니다.');
  node('ordinal').value = '2';
  node('dot').value = '103';
  await submit();
  assert.equal(node('error').textContent, '점 크기는 100%에서 130%까지 5% 단위여야 합니다.');
  node('dot').value = '100';

  await fire(node('add-extra'), 'click');
  assert.equal(document.querySelectorAll('.extrarow').length, 1);
  await submit();
  assert.equal(node('error').textContent, '추가한 순서와 사이트를 모두 입력하거나 해당 행을 삭제하세요.');
  document.querySelector('.extra-ordinal').value = '2';
  document.querySelector('.extra-target').value = 'https://example.com/extra';
  await submit();
  assert.equal(node('error').textContent, '같은 순서를 두 번 지정할 수 없습니다.');
  await fire(document.querySelector('.extra-delete'), 'click');
  assert.equal(document.querySelectorAll('.extrarow').length, 0, 'the row delete button removes the row');
  await fire(node('add-extra'), 'click');
  document.querySelector('.extra-ordinal').value = '4';
  document.querySelector('.extra-target').value = 'https://example.com/extra';
  node('decoys').value = 'https://example.org/one\nhttps://example.net/two\nhttps://example.com/target';
  await submit();

  assert.equal(settingsOpen(), false, 'a valid save closes settings');
  assert.equal(liveLocks().length, 1);
  const saved = JSON.parse(stored(SESSION_KEY));
  assert.deepEqual(saved.config, {
    target: 'https://example.com/target',
    decoys: ['https://example.org/one', 'https://example.net/two'],
    ordinal: 2, dot: 100, extraTargets: [{ ordinal: 4, target: 'https://example.com/extra' }],
  }, 'the target line is dropped from the decoy list');
  assert.equal(saved.counter, 0);
});

test('generation: decoys, the target at its ordinal and the extra target at theirs; the canvas decodes to the payload', async () => {
  const payloads = [];
  for (let n = 1; n <= 5; n += 1) {
    await fire(node('generate'), 'click');
    assert.equal(node('qr').hidden, false);
    assert.equal(node('empty').hidden, true);
    payloads.push(decodeCanvas());
    assert.equal(JSON.parse(stored(SESSION_KEY)).counter, n);
    assert.equal(JSON.parse(stored(SESSION_KEY)).current.payload, payloads.at(-1), 'the stored payload is the painted one');
  }
  const [p1, p2, p3, p4, p5] = payloads;
  assert.equal(p2, 'https://example.com/target', 'the second generation is the target');
  assert.equal(p4, 'https://example.com/extra', 'the fourth generation is the extra target');
  assert.deepEqual([p1, p3].sort(), ['https://example.net/two', 'https://example.org/one'], 'the first cycle uses each decoy once');
  assert.equal(p5, p1, 'the next cycle does not start with the last draw');
  assert.equal(node('generate').disabled, false);
  assert.equal(node('freeze').disabled, false);
  assert.equal(node('png').disabled, false);
  assert.equal(node('notice').textContent, '');
  const backup = await backupJson();
  assert.equal(backup.current.dot, 100);
  assert.equal(backup.current.version, 4);
  assert.equal(image().width, (backup.current.version * 4 + 17 + 8) * 16, 'the canvas is painted at 16 pixels per module');
});

test('editing: a tap flips a dot, finder cells are protected, the budget rule shows a preview, undo and clean restore the QR', async () => {
  placeCanvas();
  const payload = decodeCanvas();
  const backup = await backupJson();
  const { version, mask, dot } = backup.current;
  const size = gridSize();
  const clone = core.createQR(payload, version, mask, dot);

  // Protected: the top-left finder cannot be edited.
  await tapCell(0, 0);
  assert.equal(node('notice').textContent, '이 점은 QR 인식 표식입니다.\n지우면 카메라가 읽지 못할 수 있어요.');
  assert.deepEqual((await backupJson()).current.edits, []);

  // Pick six cells in six different codewords of block 0: the sixth exceeds the per-block budget.
  const picks = [];
  const words = new Set();
  for (let y = 0; y < size && picks.length < 6; y += 1) {
    for (let x = 0; x < size && picks.length < 6; x += 1) {
      const place = clone.meta.map[y][x];
      if (place && place.block === 0 && !words.has(place.word) && !core.isProtectedModule(size, x, y)) { words.add(place.word); picks.push([x, y]); }
    }
  }
  assert.equal(picks.length, 6);
  const expected = picks.map(([x, y]) => core.toggle(clone, x, y));
  assert.equal(expected[0].ok, true, 'the first edit is within the budget');
  const rejectedAt = expected.findIndex((result) => !result.ok);
  assert.ok(rejectedAt > 0, 'a later edit is refused');
  assert.ok(['budget', 'decode'].includes(expected[rejectedAt].reason));

  const first = picks[0];
  const beforePixel = cellPixel(image(), ...first);
  await tapCell(...first);
  assert.notEqual(cellPixel(image(), ...first), beforePixel, 'the tapped dot is painted inverted');
  assert.equal(decodeCanvas(), payload, 'the edited QR still decodes to the same payload');
  assert.deepEqual((await backupJson()).current.edits, [first[1] * size + first[0]]);
  assert.equal(node('undo').disabled, false);
  assert.equal(node('clean').disabled, false);

  for (let i = 1; i < rejectedAt; i += 1) await tapCell(...picks[i]);
  assert.equal((await backupJson()).current.edits.length, rejectedAt, 'accepted edits are all stored');
  const refused = picks[rejectedAt];
  const refusedBefore = cellPixel(image(), ...refused);
  await tapCell(...refused);
  assert.equal((await backupJson()).current.edits.length, rejectedAt, 'a refused edit is not stored');
  assert.notEqual(cellPixel(image(), ...refused), refusedBefore, 'the refused dot is shown inverted as a preview');
  assert.equal(node('undo').disabled, false);
  await fire(node('undo'), 'click');
  assert.equal(cellPixel(image(), ...refused), refusedBefore, 'undo drops the preview first');
  assert.equal((await backupJson()).current.edits.length, rejectedAt);

  // A preview also goes away when the page loses focus.
  await tapCell(...refused);
  assert.notEqual(cellPixel(image(), ...refused), refusedBefore);
  await fire(window, 'blur');
  assert.equal(cellPixel(image(), ...refused), refusedBefore);

  await fire(node('undo'), 'click');
  assert.equal((await backupJson()).current.edits.length, rejectedAt - 1, 'undo removes the last accepted edit');
  await fire(node('clean'), 'click');
  assert.deepEqual((await backupJson()).current.edits, []);
  assert.equal(node('clean').disabled, true);
  assert.equal(node('undo').disabled, true);
  assert.equal(decodeCanvas(), payload);
  assert.equal(cellPixel(image(), ...first), beforePixel, 'cleaning restores the original dot');
});

test('PNG export, freeze, backup and import: downloads carry the painted bytes and the saved session', async () => {
  const before = downloads.length;
  await fire(node('png'), 'click');
  await settle(5);
  assert.equal(downloads.length, before + 1);
  assert.equal(downloads.at(-1).name, 'QR.png');
  assert.equal(downloads.at(-1).blob.size, image().width * image().height * 4, 'the export is made from the painted canvas');

  await fire(node('freeze'), 'click');
  assert.equal(node('freeze').textContent, '고정됨');
  assert.equal(node('freeze').getAttribute('aria-pressed'), 'true');
  assert.equal(node('generate').disabled, true);
  const backup = await backupJson();
  assert.equal(backup.frozen, true);
  assert.equal(backup.counter, 5);
  assert.equal(JSON.parse(stored(SESSION_KEY)).frozen, true);

  // Import: a valid backup replaces the session and opens settings; a bad or oversized file is refused.
  const file = (text, size = text.length) => ({ size, text: async () => text });
  const reimport = JSON.stringify({ ...backup, counter: 9, frozen: false, current: null });
  node('import').files = [file(reimport)];
  await fire(node('import'), 'change');
  await settle();
  assert.equal(node('import').value, '', 'the file input is cleared');
  assert.equal(settingsOpen(), true, 'a restored backup opens settings');
  assert.equal(node('session').textContent, '현재 생성 횟수: 9');
  assert.equal(node('freeze').textContent, '고정');
  assert.equal(node('qr').hidden, true);
  assert.equal(JSON.parse(stored(SESSION_KEY)).counter, 9);
  node('import').files = [file('{"schema":2}')];
  await fire(node('import'), 'change');
  await settle();
  assert.equal(node('error').textContent, '올바른 QR 백업 파일이 아닙니다.');
  node('import').files = [file(reimport, 200000)];
  await fire(node('import'), 'change');
  await settle();
  assert.equal(node('error').textContent, '올바른 QR 백업 파일이 아닙니다.');
  assert.equal(JSON.parse(stored(SESSION_KEY)).counter, 9, 'a refused file leaves the session alone');
  await closeSettings();
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
  assert.equal(env.wake.requests.length, base, 'no new lock is requested while hidden');
  await setVisible(true);
  assert.equal(env.wake.requests.length, base + 1);
  assert.equal(liveLocks().length, 1);

  await liveLocks()[0].release();
  await settle();
  assert.equal(env.wake.requests.length, base + 2, 'a system release while visible makes the app ask again');
  assert.equal(liveLocks().length, 1);

  await setVisible(false);
  env.wake.failNext = true;
  await setVisible(true);
  assert.equal(liveLocks().length, 0, 'the refusal leaves no lock');
  await setVisible(false);
  await setVisible(true);
  assert.equal(liveLocks().length, 1, 'a later visible event acquires the lock');

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
  await setVisible(true);
  assert.equal(liveLocks().length, 1);

  await openSettings();
  const during = env.wake.requests.length;
  await setVisible(false);
  await setVisible(true);
  assert.equal(env.wake.requests.length, during, 'no lock while settings is open');
  await closeSettings();
  assert.equal(liveLocks().length, 1);
});

test('install: native prompt outcomes, appinstalled, standalone display and the platform instructions', async () => {
  await openSettings();
  const button = node('install');
  assert.equal(button.hidden, true);

  const accepted = nativeInstall('accepted', { deferred: true });
  const event = await fire(window, 'beforeinstallprompt', accepted.init);
  assert.equal(event.defaultPrevented, true, 'the browser mini-infobar is suppressed');
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
  const clicking = fire(button, 'click'); // the handler waits for the user's answer
  await settle();
  assert.equal(accepted.log.prompted, 1);
  assert.equal(button.hidden, true, 'the button hides while the prompt is open');
  accepted.log.answer();
  await clicking;
  await settle();
  assert.deepEqual(statusLines(), installLines(['설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.']));

  const dismissed = nativeInstall('dismissed');
  await fire(window, 'beforeinstallprompt', dismissed.init);
  await fire(button, 'click');
  await settle();
  assert.deepEqual(statusLines(), installLines(['설치 창을 닫았습니다. 설치 완료가 아닙니다.']));

  const refused = nativeInstall('accepted', { throws: true });
  await fire(window, 'beforeinstallprompt', refused.init);
  await fire(button, 'click');
  await settle();
  assert.deepEqual(statusLines(), installLines(['설치 창을 열지 못했습니다. 브라우저 메뉴에서 다시 시도하세요.']));

  await fire(window, 'beforeinstallprompt', nativeInstall('accepted').init);
  assert.equal(button.hidden, false);
  await fire(window, 'appinstalled');
  assert.equal(button.hidden, true, 'an installed app has no pending prompt');
  assert.deepEqual(statusLines(), installLines(['설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 브라우저 메뉴에서 다시 시도하세요.']));

  // Platform instructions follow the user agent whenever the page re-renders the install section.
  const rerender = () => mediaState.changeListeners.forEach((fn) => fn({ matches: false }));
  env.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  rerender();
  assert.equal(node('install-manual').textContent.split('\n')[0], 'Safari에서 공유 → 홈 화면에 추가를 누르세요.');
  assert.equal(node('install-android').hidden, true);
  env.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0';
  rerender();
  assert.equal(node('install-manual').textContent.split('\n')[0], 'Chrome 메뉴에서 ‘설치’는 설치 흐름입니다.');
  assert.equal(node('install-android').hidden, false);
  assert.equal(node('install-android-recovery').textContent.split('\n')[0], 'Chrome에서 ‘이미 설치됨’이나 ‘앱을 열 수 없음’이 나오면 휴대전화에서 확인하세요.');
  env.navigator.userAgent = 'node-test';
  rerender();
  assert.equal(node('install-android').hidden, true);

  // Standalone display: the status says so, the prompt is ignored.
  mediaState.standalone = true;
  const standaloneEvent = await fire(window, 'beforeinstallprompt', nativeInstall('accepted').init);
  assert.equal(standaloneEvent.defaultPrevented, false, 'a standalone page leaves the event alone');
  assert.equal(button.hidden, true);
  mediaState.changeListeners.forEach((fn) => fn({ matches: true }));
  assert.equal(statusLines()[0], '단독 창입니다. 홈 화면 바로가기일 수도, 설치된 앱일 수도 있습니다.');
  mediaState.standalone = false;
  rerender();
  assert.equal(statusLines()[0], '브라우저 탭입니다.');
  await closeSettings();
});

test('feedback footer: the link follows the platform and the ID copy falls back to a selected textarea', async () => {
  const copy = node('contact-copy');
  assert.equal(copy.textContent, 'ID 복사');
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
  assert.deepEqual(document.copied, ['KaliDCerona']);
  assert.equal(copy.textContent, '복사됨');
  env.navigator.clipboard = null;
  copy.textContent = 'ID 복사';
  await fire(copy, 'click');
  assert.deepEqual(document.copied, ['KaliDCerona', 'KaliDCerona'], 'no clipboard API: the textarea fallback is used');
  assert.equal(document.body.querySelectorAll('textarea').filter((area) => area.getAttribute('readonly') !== null).length, 0, 'the temporary textarea is removed');
});

test('relaunch: a fresh page load restores the saved configuration and the session where it was', async () => {
  // Build a mid-performance session: a generated QR with one edit, then frozen.
  await openSettings();
  node('target').value = 'https://example.com/target';
  node('ordinal').value = '1';
  node('decoys').value = '';
  node('dot').value = '110';
  await fire(node('form'), 'submit');
  await settle();
  await fire(node('generate'), 'click');
  placeCanvas();
  const payload = decodeCanvas();
  assert.equal(payload, 'https://example.com/target');
  const { version, mask, dot } = (await backupJson()).current;
  const clone = core.createQR(payload, version, mask, dot);
  let edit = null;
  for (let y = 9; y < clone.size - 9 && !edit; y += 1) for (let x = 9; x < clone.size - 9 && !edit; x += 1) if (core.toggle(clone, x, y).ok) edit = [x, y];
  assert.ok(edit);
  await tapCell(...edit);
  await fire(node('freeze'), 'click');
  const before = JSON.parse(stored(SESSION_KEY));
  assert.equal(before.counter, 1);
  assert.equal(before.frozen, true);
  assert.deepEqual(before.current.edits, [edit[1] * clone.size + edit[0]]);

  const store = env.store;
  env = stubBrowser({ store });
  await bootPage('?relaunch=1');
  // A new launch continues where it was: same count, frozen, current QR and dot edits.
  assert.deepEqual(JSON.parse(stored(SESSION_KEY)), before);
  assert.equal(node('qr').hidden, false);
  assert.equal(node('empty').hidden, true);
  assert.equal(node('freeze').textContent, '고정됨');
  assert.equal(node('freeze').disabled, false);
  assert.equal(node('generate').disabled, true);
  assert.equal(node('clean').disabled, false);
  assert.equal(env.wake.requests.length, 1);
  assert.equal(document.querySelector('.first-run-guide'), null, 'the guide stays dismissed');
  placeCanvas();
  assert.equal(decodeCanvas(), 'https://example.com/target', 'the restored QR is painted and still decodes');
  await openSettings();
  assert.equal(node('session').textContent, '현재 생성 횟수: 1 · 고정 중');
  assert.equal(node('dotvalue').textContent, '110%');
  assert.equal(node('target').value, 'https://example.com/target');
  assert.equal(node('ordinal').value, 1);
  await closeSettings();
});

test('stored data that cannot be used: the original is held, never overwritten by automatic saves, and kept before an explicit replace', async () => {
  const garbage = 'not json at all';
  env = stubBrowser({ store: new Map([[SESSION_KEY, garbage]]) });
  await bootPage('?invalid=1');
  assert.equal(node('notice').textContent, NOTE_INVALID);
  assert.equal(stored(SESSION_KEY), garbage, 'booting does not write over the unreadable value');
  await fire(node('generate'), 'click');
  assert.equal(node('qr').hidden, false, 'the app still runs with default settings');
  assert.equal(stored(SESSION_KEY), garbage, 'automatic saves are held');

  await fire(node('backup'), 'click');
  assert.equal(downloads.at(-1).name, 'QR-backup.json');
  assert.equal(await downloadText(downloads.at(-1)), garbage, 'the backup is the original text');
  assert.equal(node('notice').textContent, NOTE_BACKUP_ORIGINAL);

  await openSettings();
  node('target').value = 'https://example.com/replaced';
  await fire(node('form'), 'submit');
  await settle();
  assert.equal(stored(`${SESSION_KEY}-preserved-raw`), garbage, 'the original is stashed on the device');
  assert.equal(downloads.at(-1).name, 'QR-original.json');
  assert.equal(await downloadText(downloads.at(-1)), garbage);
  assert.equal(JSON.parse(stored(SESSION_KEY)).config.target, 'https://example.com/replaced');
  assert.equal(node('notice').textContent, NOTE_KEPT_FILE);
  assert.equal(settingsOpen(), false);
});

test('unreadable storage: nothing is saved or restored until the original can be read and kept', async () => {
  const original = JSON.stringify({ schema: 1, marker: 'original' });
  env = stubBrowser({ store: new Map([[SESSION_KEY, original]]) });
  env.fault.getKey = SESSION_KEY;
  await bootPage('?unreadable=1');
  assert.equal(node('notice').textContent, NOTE_UNREADABLE);
  await fire(node('backup'), 'click');
  assert.equal(node('notice').textContent, NOTE_BACKUP_REFUSED);
  assert.equal(downloads.length, 0, 'no default settings are handed out as a backup');
  await openSettings();
  await fire(node('form'), 'submit');
  await settle();
  assert.equal(settingsOpen(), true, 'a blocked save leaves settings open');
  assert.equal(node('error').textContent, NOTE_UNREADABLE);
  assert.equal(env.store.get(SESSION_KEY), original);

  env.fault.getKey = null;
  await fire(node('form'), 'submit');
  await settle();
  assert.equal(stored(`${SESSION_KEY}-preserved-raw`), original, 'once readable, the original is kept first');
  assert.equal(JSON.parse(stored(SESSION_KEY)).schema, 1);
  assert.equal(JSON.parse(stored(SESSION_KEY)).marker, undefined);
  assert.equal(settingsOpen(), false);
});

test('/tools/arosaegida: its own storage key, its own guide key, Escape closes the guide and Android gets the intent link', async () => {
  env = stubBrowser({ path: '/tools/arosaegida/', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0' });
  await bootPage('?tools=1');
  assert.notEqual(stored(`${SESSION_KEY}-arosaegida`), null);
  assert.equal(stored(SESSION_KEY), null, 'the plain key is not used under /tools/arosaegida');
  assert.ok(node('contact-open').href.startsWith('intent://viewer?#Intent;scheme=kakaotalkqrcode%3A%2F%2FeshVqDvk7WKk0zDKtiC9UTa.T6Q-;'));
  const overlay = document.querySelector('.first-run-guide');
  assert.ok(overlay);
  await fire(overlay, 'keydown', { key: 'Escape' });
  assert.equal(document.body.children.includes(overlay), false);
  assert.equal(stored('first-settings-guide:v1:arosaegida:/tools/arosaegida'), '1');
  assert.equal(stored(GUIDE_KEY), null, 'the guide key of the other path is not touched');
});
