import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { readAppStyle } from './app-style.mjs';

// Reopening TOBIRA while the coin is in the "gone" state (kept in sessionStorage) must not paint the coin first and then
// hide it. The stub DOM is seeded from the real index.html and style.css; every change that can alter what is on screen
// is sampled, and the stage counts as painted as soon as data-boot is no longer "loading" (the style.css rule).
const root = new URL('../../zz6/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const css = readAppStyle(root);
const P = 'tobira.';

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
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


const samples = [];
let coin;
let rootEl;
const painted = (label) => {
  const stageShown = rootEl.attrs.get('data-boot') !== 'loading';
  const hiddenByCss = coin.classes.has('is-gone') || coin.style.visibility === 'hidden' || rootEl.attrs.get('data-boot-gone') === '1';
  samples.push({ label, stageShown, coinVisible: !hiddenByCss, boot: rootEl.attrs.get('data-boot') ?? null });
};

function stubBrowser() {
  const local = new Map();
  const session = new Map([[`${P}session-gone`, '1'], [`${P}session-crack`, '1'], [`${P}session-crack-at`, '0.500000,0.425000']]);
  const store = (map) => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  });
  const byId = new Map();
  const loose = new Map();
  const element = (id, tag) => { if (!byId.has(id)) byId.set(id, new FakeElement(tag, id)); return byId.get(id); };

  rootEl = new FakeElement('html');
  const setAttr = rootEl.setAttribute.bind(rootEl);
  const removeAttr = rootEl.removeAttribute.bind(rootEl);
  rootEl.setAttribute = (key, value) => { setAttr(key, value); if (coin) painted(`html ${key}=${value}`); };
  rootEl.removeAttribute = (key) => { removeAttr(key); if (coin) painted(`html -${key}`); };

  const stage = element('stage');
  stage.classes.add('stage');
  stage.rect = { left: 0, top: 0, width: 400, height: 800 };
  // The coin starts exactly as index.html ships it.
  const coinClass = html.match(/<div id="coin" class="([^"]*)"/)[1];
  coin = element('coin');
  coin.className = coinClass;
  coin.classList = {
    add: (...names) => { names.forEach((name) => coin.classes.add(name)); painted(`coin +${names}`); },
    remove: (...names) => { names.forEach((name) => coin.classes.delete(name)); painted(`coin -${names}`); },
    contains: (name) => coin.classes.has(name),
  };
  let visibility = '';
  coin.style = new Proxy({}, {
    get: (target, key) => (key === 'visibility' ? visibility : target[key]),
    set: (target, key, value) => { if (key === 'visibility') { visibility = value; painted(`coin visibility=${value}`); } else target[key] = value; return true; },
  });
  stage.append(coin);
  const edgeGroup = element('edge-group');

  document = {
    activeElement: null, visibilityState: 'visible', title: '',
    body: new FakeElement('body'),
    documentElement: rootEl,
    getElementById: (id) => element(id),
    querySelector(selector) {
      if (/^#[\w-]+$/.test(selector)) return element(selector.slice(1));
      if (!loose.has(selector)) loose.set(selector, new FakeElement());
      return loose.get(selector);
    },
    createElement: (tag) => new FakeElement(tag),
  };
  listenerHost(document);

  class AudioContextStub { constructor() { this.state = 'suspended'; } resume() { return Promise.resolve(); } }
  const navigator = {
    userAgent: 'node-test', maxTouchPoints: 0,
    wakeLock: { request: async () => ({ release: async () => {}, addEventListener() {} }) },
    serviceWorker: { register: async () => {} },
  };
  const window = {
    innerWidth: 400, innerHeight: 800, AudioContext: AudioContextStub,
    DeviceMotionEvent: class {}, DeviceOrientationEvent: class {},
    setTimeout, clearTimeout,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  };
  listenerHost(window);
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', { hostname: 'example.test', search: '' });
  define('localStorage', store(local));
  define('sessionStorage', store(session));
  define('matchMedia', () => ({ matches: false }));
  define('Element', FakeElement);
  define('HTMLElement', FakeElement);
  return { session, local };
}

test('reopening while the coin is gone never shows the coin: the first painted state is already gone', async () => {
  // The style.css rules this test relies on.
  assert.match(css, /html\[data-boot="loading"\] \.stage\s*\{\s*display: none;/);
  assert.match(css, /\.coin\.is-gone \{ visibility: hidden; \}/);

  const env = stubBrowser();
  // Browser order: the inline head script runs first and marks the document as loading.
  const inline = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\));\s*<\/script>/)[1];
  vm.runInNewContext(inline, { document });
  assert.equal(rootEl.attrs.get('data-boot'), 'loading');
  painted('after head script');
  assert.equal(samples.at(-1).stageShown, false, 'nothing of the stage is painted before the app is ready');

  await import(new URL('app.js', root));
  await settle();
  painted('after boot');

  const shown = samples.filter((sample) => sample.stageShown);
  assert.ok(shown.length > 0, 'the stage was painted at the end of boot');
  const flicker = samples.filter((sample) => sample.stageShown && sample.coinVisible);
  assert.deepEqual(flicker, [], 'the coin is never visible while the stage is painted');
  assert.equal(coin.classes.has('is-gone'), true);
  assert.equal(coin.style.visibility, 'hidden');
  assert.equal(env.session.has(`${P}session-gone`), false, 'personal boot starts ready and clears the old gone flag');
  assert.equal(document.body.dataset.mode, 'performance');
});
