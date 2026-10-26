import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Loads zz5/index.html's own scripts: settings-ui.js as a classic script, then app.js and install-prompt.js
// with their real imports as separate ES modules (no concatenation, no shared scope). A module that uses an
// identifier it does not import throws ReferenceError here, as it does in the browser.
// Drives boot, the gesture guide, wake lock on visibility, the install prompt, the two-finger settings
// swipe and reset swipe, appearance settings saved to storage, preset save/select/edit/delete, the default
// card flow, the cell-guide preview and the custom photo set flow through the listeners the app registers
// on a stub DOM. The element ids come from the real index.html, so a removed id fails.
// ALETHEIA_ROOT selects another root, for example distribution-snapshots/aletheia.
const root = process.env.ALETHEIA_ROOT ? pathToFileURL(`${process.env.ALETHEIA_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz5/', import.meta.url);

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 400; i += 1) {
    const value = check();
    if (value) return value;
    await settle(2);
  }
  assert.fail(`timed out waiting for: ${label}`);
}

function listenerHost(target) {
  target.listeners = {};
  target.addEventListener = (type, fn) => { (target.listeners[type] ||= []).push(fn); };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item !== fn); };
}
// emit() awaits async listeners so a throw or rejection fails the step that caused it.
async function emit(target, type, event = {}) {
  const fns = [...(target.listeners[type] || [])];
  assert.ok(fns.length > 0, `a listener is registered for ${type} on ${target.id || target.tag || 'window'}`);
  await Promise.all(fns.map((fn) => fn(event)));
}

const html = readFileSync(new URL('index.html', root), 'utf8');
// The friend snapshot is an older build with its own storage prefix and a Shift+Esc exit.
const K = readFileSync(new URL('dom.js', root), 'utf8').includes('aletheia.distribution.') ? 'aletheia.distribution.' : 'aletheia.';
const kebabToCamel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

let document;
class FakeElement {
  constructor(tag = 'div', id = '') {
    this.tag = tag; this.id = id; this.attrs = new Map(); this.classes = new Set(); this.style = {}; this.dataset = {};
    this.children = []; this.parentElement = null; this.hidden = false; this.value = ''; this.checked = false;
    this.disabled = false; this.textContent = ''; this.files = null;
    listenerHost(this);
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
    };
  }
  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
  get lastElementChild() { return this.children.at(-1) || null; }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  getAttribute(key) {
    if (key.startsWith('data-') && kebabToCamel(key.slice(5)) in this.dataset) return this.dataset[kebabToCamel(key.slice(5))];
    return this.attrs.has(key) ? this.attrs.get(key) : null;
  }
  removeAttribute(key) { this.attrs.delete(key); }
  append(...nodes) {
    for (const node of nodes) {
      if (node.isFragment) { this.append(...node.children.splice(0)); continue; }
      node.parentElement = this; this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
    if (/^[a-z]+$/.test(selector)) return this.tag === selector;
    const attr = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attr) {
      const key = attr[1].startsWith('data-') ? kebabToCamel(attr[1].slice(5)) : null;
      if (attr[2] === undefined) return key !== null && key in this.dataset;
      return (key !== null ? this.dataset[key] : this.getAttribute(attr[1])) === attr[2];
    }
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
  reset() {}
  scrollIntoView() {}
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rect || {};
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
}

// Records canvas calls so scratch, veil repaint and image draws can be asserted.
function makeContext() {
  const ctx = { ops: [], fillStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over' };
  for (const name of ['save', 'restore', 'clearRect', 'setTransform', 'beginPath', 'rect', 'clip', 'fill', 'drawImage', 'arc', 'fillRect']) {
    ctx[name] = (...args) => { ctx.ops.push({ name, args, style: ctx.fillStyle, composite: ctx.globalCompositeOperation }); };
  }
  ctx.getImageData = (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
  return ctx;
}
class FakeCanvas extends FakeElement {
  constructor() { super('canvas'); this.width = 300; this.height = 150; this.context = makeContext(); }
  getContext() { return this.context; }
}

function makeIndexedDB() {
  const records = new Map();
  return {
    records,
    open() {
      const request = {};
      setTimeout(() => {
        request.result = {
          objectStoreNames: { contains: () => false },
          createObjectStore() {},
          close() {},
          transaction() {
            const tx = {};
            const done = () => setTimeout(() => tx.oncomplete?.(), 0);
            tx.objectStore = () => ({
              put: (value, key) => { records.set(key, value); done(); },
              delete: (key) => { records.delete(key); done(); },
              clear: () => { records.clear(); done(); },
              get: (key) => {
                const get = {};
                queueMicrotask(() => { get.result = records.get(key); get.onsuccess?.(); });
                return get;
              },
            });
            return tx;
          },
        };
        request.onupgradeneeded?.();
        request.onsuccess?.();
      }, 0);
      return request;
    },
  };
}

function stubBrowser() {
  const local = new Map();
  const localStore = {
    getItem: (key) => (local.has(key) ? local.get(key) : null),
    setItem: (key, value) => { local.set(key, String(value)); },
    removeItem: (key) => { local.delete(key); },
  };
  const byId = new Map();
  for (const [, tag, before, id, after] of html.matchAll(/<(\w+)([^>]*?)\sid="([^"]+)"([^>]*)>/g)) {
    const el = tag === 'canvas' ? new FakeCanvas() : new FakeElement(tag, id);
    el.id = id;
    const attrs = `${before} ${after}`;
    el.hidden = /\shidden(\s|$|=)/.test(` ${attrs}`);
    if (/type="checkbox"/.test(attrs)) el.type = 'checkbox';
    byId.set(id, el);
  }
  const canvas = byId.get('stage-canvas');
  canvas.rect = { left: 0, top: 0, width: 400, height: 800 };
  const masks = [];
  // Elements below exist only if the shipped index.html contains them; a missing one stays null.
  const theme = /<meta[^>]*name="theme-color"/.test(html) ? new FakeElement('meta') : null;
  let installCard = null;
  let installButton = null;
  let installGuidance = null;
  const cardHtml = html.match(/<section\b([^>]*\bdata-install-card\b[^>]*)>([\s\S]*?)<\/section>/);
  if (cardHtml) {
    installCard = new FakeElement('section');
    installCard.dataset.installCard = '';
    const guidanceHtml = cardHtml[2].match(/<p\b[^>]*\bdata-install-guidance\b[^>]*>/);
    const buttonHtml = cardHtml[2].match(/<button\b[^>]*\bdata-install-button\b[^>]*>/);
    if (guidanceHtml) {
      installGuidance = new FakeElement('p');
      installGuidance.dataset.installGuidance = '';
      installCard.append(installGuidance);
    }
    if (buttonHtml) {
      installButton = new FakeElement('button');
      installButton.dataset.installButton = '';
      installButton.hidden = /\shidden(\s|>|=)/.test(buttonHtml[0]);
      installCard.append(installButton);
    }
  }

  document = {
    activeElement: null, visibilityState: 'visible', readyState: 'loading', title: '',
    body: new FakeElement('body'),
    documentElement: new FakeElement('html'),
    getElementById: (id) => byId.get(id) || null,
    querySelector(selector) {
      if (/^#[\w-]+$/.test(selector)) return byId.get(selector.slice(1)) || null;
      if (selector === 'meta[name="theme-color"]') return theme;
      if (selector === '[data-install-card]') return installCard;
      return null;
    },
    createElement(tag) {
      if (tag !== 'canvas') return new FakeElement(tag);
      const created = new FakeCanvas();
      masks.push(created);
      return created;
    },
    createDocumentFragment() { const fragment = new FakeElement('fragment'); fragment.isFragment = true; return fragment; },
  };
  document.body.dataset.magicApp = 'aletheia';
  listenerHost(document);

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
  class FakeImage {
    constructor() { this.naturalWidth = 600; this.naturalHeight = 800; this._src = ''; }
    get src() { return this._src; }
    set src(value) {
      this._src = value;
      if (value) setTimeout(() => this.onload?.(), 0);
    }
  }
  const location = { hostname: 'localhost', search: '?local-preview=1', pathname: '/zz5/', hash: '' };
  const window = {
    innerWidth: 400, innerHeight: 800, setTimeout, clearTimeout, navigator, location, document,
    matchMedia: () => ({ matches: false }),
  };
  listenerHost(window);

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('localStorage', localStore);
  define('indexedDB', makeIndexedDB());
  define('Image', FakeImage);
  define('requestAnimationFrame', (fn) => setTimeout(() => fn(performance.now()), 0));
  return { local: localStore, canvas, masks, wake, navigator, window, installCard, installButton, installGuidance, theme, el: (id) => byId.get(id) };
}

const env = stubBrowser();
const stored = (key) => JSON.parse(env.local.getItem(key));
const stage = () => env.el('stage');
const settings = () => env.el('settings');
const inPerformance = () => document.body.classes.has('view-performance');
const stageOps = () => env.canvas.context.ops;
const maskCtx = () => env.masks.at(-1).context;
const arcs = (ctx) => ctx.ops.filter((op) => op.name === 'arc' && op.composite === 'destination-out');
const pointer = (id, x, y, extra = {}) => ({
  pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, screenX: x, screenY: y,
  target: env.canvas, cancelable: true, preventDefault() {}, ...extra,
});
async function swipe(dy) {
  const starts = [[11, 100, 300], [12, 300, 300]];
  for (const [id, x, y] of starts) await emit(env.canvas, 'pointerdown', pointer(id, x, y));
  for (const [id, x, y] of starts) await emit(env.canvas, 'pointermove', pointer(id, x, y + dy));
  for (const [id, x, y] of starts) await emit(env.canvas, 'pointerup', pointer(id, x, y + dy, { type: 'pointerup' }));
}
async function tap(x, y) {
  await emit(env.canvas, 'pointerdown', pointer(1, x, y));
  await emit(env.canvas, 'pointerup', pointer(1, x, y, { type: 'pointerup' }));
}
const imageFile = (name, bytes = 1200) => Object.assign(new Blob([new Uint8Array(bytes).fill(7)], { type: 'image/png' }), { name });
const lastDraw = () => stageOps().filter((op) => op.name === 'drawImage' && typeof op.args[0].src === 'string').at(-1);

afterEach(async () => {
  await settle(5);
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
  assert.equal(env.el('error').hidden, true, `the app shows no error banner: ${env.el('error').textContent}`);
});

test('boot loads the classic script and the real zz5 modules, then reaches the default card stage', async () => {
  runInThisContext(readFileSync(new URL('settings-ui.js', root), 'utf8'));
  assert.equal(typeof window.MagicSettingsUI.installGuide, 'function', 'classic settings-ui.js ran and exposed its API');
  assert.equal(window.MagicSettingsUI.profiles.aletheia.name, 'ALETHEIA');
  await import(new URL('app.js', root));
  await import(new URL('install-prompt.js', root));
  await until(inPerformance, 'boot performance surface');
  await settle(5);
  assert.equal(document.title, '이미지');
  assert.equal(settings().hidden, true);
  assert.equal(stage().hidden, false);
  assert.equal(document.body.classes.has('view-settings'), false);
  assert.equal(env.theme.getAttribute('content'), '#000000');
  assert.deepEqual(env.navigator.registered, [{ url: './sw.js', options: { scope: './' } }]);
  assert.equal(env.el('coverage-size').value, '110');
  assert.equal(env.el('coverage-readout').textContent, '110px');
  assert.equal(env.el('preset-list').children.length, 0);
  assert.equal(env.el('start-button').disabled, true, 'no preset yet');
  assert.equal(env.el('card-start-button').disabled, false);
  const sets = env.el('custom-slots').children;
  assert.equal(sets.length, 3, 'three photo sets are rendered');
  assert.equal(sets[0].children[3].children.length, 12, 'twelve slots per set');
  assert.match(sets[0].children[1].textContent, /^사진 0\/12장 저장됨/);
  assert.equal(sets[0].children[2].disabled, true, 'an empty set cannot start');
  assert.ok(stageOps().some((op) => op.name === 'fillRect' && op.style === '#000000'), 'the empty black stage is painted');
  assert.equal(env.wake.requests.length, 1, 'performance requests the wake lock');
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
  assert.equal(env.el('settings-gesture-guide').hidden, false, 'gesture guide shows on the first ready stage');
  assert.equal(document.activeElement, env.el('settings-gesture-dismiss'));
  if (env.window.listeners['magic-local-settings']) assert.equal(document.documentElement.dataset.localSettingsReady, 'true');
});

test('wake lock is released when hidden and requested again when visible', async () => {
  document.visibilityState = 'hidden';
  await emit(document, 'visibilitychange');
  await settle(5);
  assert.equal(env.wake.requests[0].released, true, 'hidden page releases the lock');
  assert.equal(env.wake.requests.length, 1);
  document.visibilityState = 'visible';
  await emit(document, 'visibilitychange');
  await until(() => env.wake.requests.length === 2, 'second wake lock request');
  assert.equal(env.wake.requests[1].released, false);
});

test('install prompt guides, offers the native prompt, and reports the outcome', async () => {
  assert.ok(env.installCard && env.installGuidance && env.installButton, 'index.html defines the install card, guidance and button');
  assert.match(env.installGuidance.textContent, /^Chrome 메뉴\(⋮\)에서/);
  assert.equal(env.installButton.hidden, true);
  let prompted = 0;
  let prevented = 0;
  const native = (outcome) => ({
    preventDefault() { prevented += 1; },
    prompt: async () => { prompted += 1; },
    userChoice: Promise.resolve({ outcome }),
  });
  const accepted = native('accepted');
  await emit(env.window, 'beforeinstallprompt', accepted);
  assert.ok(prevented >= 2, 'both install listeners take the event');
  assert.equal(env.window.__magicInstallPrompt, accepted, 'settings-ui keeps the event in the shared slot');
  assert.equal(env.installButton.hidden, false);
  assert.equal(env.installGuidance.textContent, '버튼을 눌러 이 앱을 설치하세요.');
  await emit(env.installButton, 'click');
  assert.equal(prompted, 1);
  assert.match(env.installGuidance.textContent, /^설치 요청을 보냈습니다\./);
  assert.equal(env.installButton.hidden, true);
  await emit(env.window, 'beforeinstallprompt', native('dismissed'));
  await emit(env.installButton, 'click');
  assert.equal(prompted, 2);
  assert.match(env.installGuidance.textContent, /^Chrome 메뉴\(⋮\)에서/, 'a dismissed prompt falls back to the manual steps');
  await emit(env.window, 'appinstalled');
  assert.match(env.installGuidance.textContent, /^설치 요청을 받았습니다\./);
  assert.equal(env.installButton.hidden, true);
});

test('gesture guide stops touches from reaching the stage, then remembers the dismissal', async () => {
  const guide = env.el('settings-gesture-guide');
  assert.equal(env.local.getItem(`${K}settings-gesture-guide.v1`), null);
  let stopped = 0;
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    await emit(guide, type, { stopPropagation() { stopped += 1; } });
  }
  assert.equal(stopped, 4);
  await emit(env.el('settings-gesture-dismiss'), 'click');
  assert.equal(guide.hidden, true);
  assert.equal(env.local.getItem(`${K}settings-gesture-guide.v1`), 'done');
});

test('default card flow: a tap locks a card, a two-finger reset keeps it, a two-finger down swipe opens settings', async () => {
  const before = stageOps().length;
  await tap(200, 400);
  await until(() => arcs(maskCtx()).length > 0, 'locked card scratch');
  const draw = lastDraw();
  assert.ok(stageOps().length > before);
  assert.match(draw.args[0].src, /court-cards\/C-Q\.webp$/, 'row 3 column 2 is the club queen');
  assert.equal(draw.args[0].naturalWidth, 600);
  const afterTap = arcs(maskCtx()).length;
  assert.ok(afterTap >= 1);

  const mark = maskCtx().ops.length;
  await swipe(-140);
  const repaint = maskCtx().ops.slice(mark).filter((op) => op.name === 'clearRect' || op.name === 'fillRect');
  assert.deepEqual(repaint, [], 'two-finger reset does not repaint the card veil');
  assert.equal(inPerformance(), true);

  const requestsBefore = env.wake.requests.length;
  await swipe(140);
  assert.equal(inPerformance(), false);
  assert.equal(document.body.classes.has('view-settings'), true);
  assert.equal(document.title, 'ALETHEIA');
  assert.equal(settings().hidden, false);
  assert.equal(stage().hidden, true);
  assert.equal(env.theme.getAttribute('content'), '#4C1420');
  assert.equal(env.wake.requests.length, requestsBefore);
  assert.equal(env.wake.requests.at(-1).released, true, 'settings does not hold the screen awake');
  assert.equal(env.el('settings-gesture-guide').hidden, true);

  let stopped = 0;
  await emit(settings(), 'click', { preventDefault() {}, stopPropagation() { stopped += 1; } });
  assert.equal(stopped, 1, 'a click right after the swipe is swallowed by the settings screen');
});

test('appearance settings are saved to storage', async () => {
  const coverage = env.el('coverage-size');
  coverage.value = '150';
  await emit(coverage, 'input');
  assert.equal(env.el('coverage-readout').textContent, '150px');
  await emit(coverage, 'change');
  assert.equal(stored(`${K}coverage.v1`), 150);

  const guide = env.el('cell-guide-enable');
  guide.checked = true;
  await emit(guide, 'change');
  assert.deepEqual(stored(`${K}cellGuide.v1`), { version: 1, enabled: true });
  assert.equal(env.el('status').hidden, false);
  assert.equal(env.el('status').textContent, '칸 이미지 미리보기를 켰습니다. 12칸 공연을 시작할 때만 카드가 잠시 비칩니다.');
});

test('preset save, select, edit and cancel go through the form and storage', async () => {
  const fileInput = env.el('preset-file');
  fileInput.files = [imageFile('veil.png')];
  await emit(fileInput, 'change');
  assert.equal(env.el('file-preview').hidden, false);
  assert.equal(env.el('file-status').textContent, '선택한 파일: veil.png');
  env.el('preset-name').value = '봄 베일';
  env.el('preset-mode').value = 'free';
  await emit(env.el('preset-mode'), 'change');
  await emit(env.el('editor'), 'submit', { preventDefault() {} });
  await until(() => env.el('preset-list').children.length === 1, 'preset card rendered');
  const meta = stored(`${K}meta.v1`);
  assert.equal(meta.presets.length, 1);
  assert.equal(meta.presets[0].name, '봄 베일');
  assert.equal(meta.presets[0].mode, 'free');
  assert.equal(meta.presets[0].imageMime, 'image/png');
  assert.equal(meta.presets[0].hiddenPercent, null);
  assert.equal(meta.selectedId, meta.presets[0].id);
  assert.equal(env.el('status').textContent, '저장했습니다.');
  assert.equal(env.el('start-button').disabled, false);

  const card = () => env.el('preset-list').children[0];
  const button = (index) => card().children[2].children[index];
  assert.equal(card().children[0].textContent, '봄 베일');
  assert.equal(button(0).textContent, '선택됨');
  await emit(env.el('preset-list'), 'click', { target: button(1) });
  assert.equal(env.el('editor-legend').textContent, '프리셋 수정');
  assert.equal(env.el('preset-name').value, '봄 베일');
  assert.equal(env.el('cancel-edit').hidden, false);
  await emit(env.el('cancel-edit'), 'click');
  assert.equal(env.el('editor-legend').textContent, '새 프리셋');
  assert.equal(env.el('cancel-edit').hidden, true);
});

test('preset performance: scratch reveals the image, two-finger up repaints the veil, local preview event returns to settings', async () => {
  const requests = env.wake.requests.length;
  await emit(env.el('start-button'), 'click');
  await until(inPerformance, 'preset performance');
  assert.equal(document.title, '이미지');
  assert.equal(env.wake.requests.length, requests + 1);
  assert.equal(env.wake.requests.at(-1).released, false);
  const ctx = maskCtx();
  assert.ok(ctx.ops.some((op) => op.name === 'fillRect' && op.style === '#121212'), 'the veil is painted over the image');

  const scratchStart = arcs(ctx).length;
  await emit(env.canvas, 'pointerdown', pointer(1, 200, 400));
  await emit(env.canvas, 'pointermove', pointer(1, 260, 430));
  await emit(env.canvas, 'pointerup', pointer(1, 260, 430, { type: 'pointerup' }));
  assert.ok(arcs(ctx).length - scratchStart >= 2, 'a stroke erases the veil along its path');
  assert.deepEqual([...new Set(arcs(ctx).slice(scratchStart).map((op) => op.args[2]))], [(150 * 600) / 400 / 2],
    'erase radius follows the saved coverage of 150px');
  const maskDraw = stageOps().filter((op) => op.name === 'drawImage').at(-1);
  assert.equal(maskDraw.args[0], env.masks.at(-1), 'the veil mask is drawn over the image');
  assert.equal(typeof lastDraw().args[0].src, 'string');

  const mark = ctx.ops.length;
  await swipe(-140);
  const repaint = ctx.ops.slice(mark);
  assert.ok(repaint.some((op) => op.name === 'clearRect'));
  assert.ok(repaint.some((op) => op.name === 'fillRect' && op.style === '#121212'), 'two-finger up repaints the veil');
  assert.equal(inPerformance(), true);

  if (env.window.listeners['magic-local-settings']) await emit(env.window, 'magic-local-settings');
  else {
    // No Shift+Escape shortcut any more (desktop-only control removed); settings are reached by the two-finger down swipe.
    assert.equal(env.window.listeners.keydown, undefined, 'no keydown shortcut is registered on window');
    await swipe(140);
  }
  assert.equal(inPerformance(), false);
  assert.equal(settings().hidden, false);
  assert.equal(env.wake.requests.at(-1).released, true);

  // A new coverage setting changes the erase size of the next performance: the 600px mask is shown 400px wide.
  const coverage = env.el('coverage-size');
  coverage.value = '80';
  await emit(coverage, 'input');
  await emit(coverage, 'change');
  assert.equal(stored(`${K}coverage.v1`), 80);
  await emit(env.el('start-button'), 'click');
  await until(inPerformance, 'second preset performance');
  const second = maskCtx();
  assert.notEqual(second, ctx, 'a new veil mask is created');
  const secondStart = arcs(second).length;
  await emit(env.canvas, 'pointerdown', pointer(1, 200, 400));
  await emit(env.canvas, 'pointermove', pointer(1, 260, 430));
  await emit(env.canvas, 'pointerup', pointer(1, 260, 430, { type: 'pointerup' }));
  const radii = new Set(arcs(second).slice(secondStart).map((op) => op.args[2]));
  assert.deepEqual([...radii], [(80 * 600) / 400 / 2], 'erase radius follows the saved coverage of 80px');
  await swipe(140);
  assert.equal(inPerformance(), false);
});

test('preset delete needs a second press and clears storage', async () => {
  const del = () => env.el('preset-list').children[0].children[2].children[2];
  await emit(env.el('preset-list'), 'click', { target: del() });
  assert.equal(del().textContent, '정말 삭제');
  assert.equal(stored(`${K}meta.v1`).presets.length, 1);
  await emit(env.el('preset-list'), 'click', { target: del() });
  await until(() => env.el('preset-list').children.length === 0, 'preset removed');
  assert.equal(stored(`${K}meta.v1`).presets.length, 0);
  assert.equal(env.el('status').textContent, '프리셋을 삭제했습니다.');
  assert.equal(env.el('start-button').disabled, true);
});

test('custom photo set: twelve uploads are saved, then the set starts with its own photos and cell preview', async () => {
  const set = env.el('custom-slots').children[0];
  const startSet = set.children[2];
  for (let index = 0; index < 12; index += 1) {
    const article = set.children[3].children[index];
    const [, file, , , save] = article.children;
    file.files = [imageFile(`photo-${index}.png`, 900 + index)];
    await emit(file, 'change');
    assert.match(env.el('status').textContent, /^파일을 확인했습니다/);
    await emit(save, 'click');
    await until(() => new RegExp(`^1세트 ${index + 1}번 칸\\(.+\\)을 저장했습니다\\.$`).test(env.el('status').textContent), `slot ${index + 1} saved`);
    assert.match(stored(`${K}photoSets.v2`).sets[0][index], /^img_/);
    assert.equal(save.textContent, '이 칸 사진 바꾸기');
    assert.equal(startSet.disabled, index < 11, 'the set starts only when all twelve are saved');
  }
  assert.equal(set.children[1].textContent, '12장이 준비되었습니다.');

  await emit(startSet, 'click');
  await until(inPerformance, 'custom set performance');
  const guide = env.el('cell-guide');
  assert.equal(guide.hidden, false, 'cell preview shows when enabled');
  assert.equal(guide.children.length, 12);
  await until(() => guide.children.every((preview) => preview.src), 'cell previews loaded');
  assert.ok(guide.children.every((preview) => preview.src.startsWith('blob:')), 'previews show the saved photos');

  await tap(200, 400);
  await until(() => guide.hidden && arcs(maskCtx()).length > 0, 'cell preview hidden by first touch');
  assert.equal(guide.children.length, 0);
  assert.ok(lastDraw().args[0].src.startsWith('blob:'), 'the chosen cell shows the custom photo');

  await swipe(140);
  assert.equal(inPerformance(), false);
});

test('default cards with the cell preview: previews show the kept card images and the first touch clears them', async () => {
  await emit(env.el('card-start-button'), 'click');
  await until(inPerformance, 'default card performance');
  const guide = env.el('cell-guide');
  assert.equal(guide.hidden, false);
  assert.equal(guide.children.length, 12);
  await until(() => guide.children.every((preview) => preview.src), 'default previews loaded');
  assert.ok(guide.children.every((preview) => /court-cards\/[SDCH]-[JQK]\.webp$/.test(preview.src)));
  await tap(60, 60);
  await until(() => guide.hidden && arcs(maskCtx()).length > 0, 'preview hidden by first touch');
  assert.match(lastDraw().args[0].src, /court-cards\/S-J\.webp$/, 'top-left cell is the spade jack');
  await swipe(140);
  assert.equal(inPerformance(), false);
  assert.equal(env.wake.requests.at(-1).released, true);
});

after(() => { console.error = originalConsoleError; });
