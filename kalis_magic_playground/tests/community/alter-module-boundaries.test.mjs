import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Loads zz10/app.js and zz10/install-ui.js (the module scripts of index.html, in page order) and all their real
// imports as separate ES modules (no concatenation, no shared scope). A module that uses an identifier it does not
// import throws ReferenceError here, as it does in the browser. The DOM is built by parsing the real index.html.
// Flows are driven through the listeners the modules register: boot with saved settings, the first-run guide,
// camera refusal and the generic-camera fallback, live frame analysis (background calibration, card detection,
// the alter overlay, hide on removal, reveal, reset), the two-finger downward swipe into settings, settings saved to
// storage, wake lock on visibility, track loss, resize, stop, and the install prompt.
// app.js catches errors thrown inside a camera frame and only records "analysis-error", so this test fails when
// that code or the "retry" status appears. Deliberately not asserted: the order of startup listener registration.
// Not reachable with these stubs: settings-ui.js (the shared classic appearance script, deferred and not an ALTER
// module), real camera pixels, the service worker itself (sw.js), and browser rendering of the overlay.
// ALTER_ROOT points the same test at a friend snapshot (none exists under distribution-snapshots today).
const root = process.env.ALTER_ROOT ? pathToFileURL(`${process.env.ALTER_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz10/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
afterEach(async () => {
  await settle(5);
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
  const events = JSON.parse(env.sessionStorage.getItem('alter-runtime-events') || '{}');
  assert.equal(events['analysis-error'], undefined, 'no frame analysis error was swallowed by app.js');
  assert.notEqual(document.getElementById('runtime-note').textContent, '카드 분석을 다시 시도하는 중');
});

// ----- selector matching (the subset the modules use) -----
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
    else tests.push({ attr: m[4], op: m[5] || '', val: m[6] ?? m[7] ?? m[8] ?? '' });
    rest = rest.slice(m[0].length);
  }
  return tests;
}
const parseSelector = (selector) => selector.split(',').map((part) => part.trim().split(/\s+/).map((token) => parseCompound(token)));
function attrValue(el, name) {
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
  if (!matchCompound(el, chain[i])) return false;
  if (i === 0) return true;
  for (let p = el.parentElement; p; p = p.parentElement) if (matchChain(p, chain, i - 1)) return true;
  return false;
}

// ----- events: capture, target, bubble over element -> document -> window -----
function makeEvent(type, init) {
  return {
    type, bubbles: true, cancelable: true, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; },
    ...init,
  };
}
let document;
let window;
function listen(target) {
  target.listeners = new Map();
  target.addEventListener = (type, fn, opts) => {
    if (!target.listeners.has(type)) target.listeners.set(type, []);
    target.listeners.get(type).push({ fn, once: opts?.once === true });
  };
  target.removeEventListener = (type, fn) => {
    target.listeners.set(type, (target.listeners.get(type) || []).filter((l) => l.fn !== fn));
  };
}
function runEvent(target, event) {
  event.target = target;
  const results = [];
  const path = [];
  if (target === window) path.push(window);
  else {
    for (let n = target; n; n = n.parentElement) path.push(n);
    if (target !== document) path.push(document);
    path.push(window);
  }
  for (const node of path) {
    event.currentTarget = node;
    for (const l of [...(node.listeners?.get(event.type) || [])]) {
      if (l.once) node.removeEventListener(event.type, l.fn);
      results.push(l.fn.call(node, event));
    }
    if (event.stopped || event.bubbles === false) break;
  }
  return results;
}
async function dispatch(target, type, init = {}) {
  const event = makeEvent(type, init);
  await Promise.all(runEvent(target, event));
  return event;
}
const click = (el) => dispatch(el, 'click');

// ----- elements -----
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.nodeType = tag === '#text' ? 3 : 1; this.id = '';
    this.attrs = new Map(); this.classes = new Set(); this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.disabled = false; this._text = '';
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
  get options() { return this.children.filter((c) => c.tag === 'option'); }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = v;
    if (k === 'hidden') this.hidden = true;
  }
  getAttribute(k) { return attrValue(this, k); }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
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
  focus() { document.activeElement = this; }
  getContext(kind) {
    assert.equal(kind, '2d');
    return {
      drawImage: (...args) => { this.drawn = args; },
      getImageData: (x, y, w, h) => frameFor(w, h),
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
    };
  }
  toDataURL() { return 'data:image/png;base64,AAAA'; }
}

// ----- parse the real index.html into the stub DOM -----
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
const SKIP_CONTENT = new Set(['script', 'style']);
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
        if (k === 'value') el.value = v;
      }
      stack[stack.length - 1].append(el);
      if (SKIP_CONTENT.has(el.tag)) { token.lastIndex = source.toLowerCase().indexOf(`</${el.tag}>`, token.lastIndex) + el.tag.length + 3; continue; }
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] && stack.length > 1) stack[stack.length - 1]._text += m[5];
  }
  for (const option of top.querySelectorAll('option')) if (!option.attrs.has('value')) option.value = option._text;
  for (const select of top.querySelectorAll('select')) select.value = select.options[0].value;
  return top;
}

// ----- camera frames: a flat wall, optionally with a white portrait card in the middle -----
let scene = 'empty';
function frameFor(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) { data[i * 4] = 96; data[i * 4 + 1] = 104; data[i * 4 + 2] = 112; data[i * 4 + 3] = 255; }
  if (scene === 'card') {
    const cw = Math.round(w * 0.42);
    const ch = Math.round(cw * 1.4);
    const x0 = Math.round((w - cw) / 2);
    const y0 = Math.round((h - ch) / 2);
    for (let y = y0; y < y0 + ch; y += 1) {
      for (let x = x0; x < x0 + cw; x += 1) {
        const i = (y * w + x) * 4;
        data[i] = 250; data[i + 1] = 248; data[i + 2] = 240;
      }
    }
  }
  return { width: w, height: h, data };
}

// ----- browser stubs -----
function stubBrowser() {
  const top = parseHtml(html);
  const htmlEl = top.children.find((c) => c.tag === 'html');
  const ids = new Map();
  for (const el of top.querySelectorAll('[id]')) ids.set(el.id, el);
  const maps = { local: new Map(), session: new Map() };
  const store = (map) => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  });
  const localStorage = store(maps.local);
  const sessionStorage = store(maps.session);

  document = {
    visibilityState: 'visible', documentElement: htmlEl, activeElement: null,
    get hidden() { return this.visibilityState === 'hidden'; },
    getElementById: (id) => ids.get(id) || null,
    createElement: (tag) => new FakeElement(tag),
  };
  listen(document);

  const raf = { callback: null, id: 0, cancelled: 0 };
  const lockState = { requests: [] };
  const media = { gets: [], queue: [], tracks: [] };
  const serviceWorker = { registered: [] };
  serviceWorker.register = async (url) => { serviceWorker.registered.push(url); return {}; };
  const navigator = {
    userAgent: 'node-test', platform: 'node', maxTouchPoints: 0, standalone: false, serviceWorker,
    mediaDevices: {
      getUserMedia: async (constraints) => {
        media.gets.push(constraints);
        const next = media.queue.shift();
        if (next instanceof Error) throw next;
        const track = { stopped: 0, stop() { this.stopped += 1; } };
        listen(track);
        media.tracks.push(track);
        return { getVideoTracks: () => [track], getTracks: () => [track] };
      },
    },
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
  const standalone = { matches: false };
  window = {
    isSecureContext: true, innerWidth: 400, innerHeight: 800, navigator,
    matchMedia: () => ({ get matches() { return standalone.matches; }, addEventListener() {} }),
  };
  listen(window);
  const location = { href: 'https://example.test/zz10/', hostname: 'example.test', search: '' };
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('localStorage', localStorage);
  define('sessionStorage', sessionStorage);
  define('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
  define('requestAnimationFrame', (fn) => { raf.callback = fn; raf.id += 1; return raf.id; });
  define('cancelAnimationFrame', () => { raf.callback = null; raf.cancelled += 1; });
  return { top, htmlEl, ids, localStorage, sessionStorage, lockState, media, raf, serviceWorker, standalone };
}

const env = stubBrowser();
const byId = (id) => {
  const el = document.getElementById(id);
  assert.ok(el, `index.html defines #${id}`);
  return el;
};
const savedSettings = () => JSON.parse(env.localStorage.getItem('alter-settings'));
const runtimeNote = () => byId('runtime-note').textContent;
const stateNote = () => byId('state-note').textContent;

// ----- gestures and frames -----
const touch = (id, x, y) => ({ identifier: id, clientX: x, clientY: y });
async function twoFingerSwipe(dy, { dx = 0, start = [touch(1, 100, 300), touch(2, 200, 300)] } = {}) {
  const moved = start.slice(0, 2).map((t) => touch(t.identifier, t.clientX + dx, t.clientY + dy));
  await dispatch(byId('stage'), 'touchstart', { touches: start });
  const move = await dispatch(byId('stage'), 'touchmove', { touches: moved });
  await dispatch(byId('stage'), 'touchend', { touches: [] });
  return move;
}
let clock = 0;
async function frames(count, which) {
  scene = which;
  for (let i = 0; i < count; i += 1) {
    clock += 200;
    const callback = env.raf.callback;
    assert.ok(callback, 'a frame callback is scheduled while the camera runs');
    env.raf.callback = null;
    callback(clock);
    await settle(0);
  }
}

// ----- seed saved settings, then load the module scripts exactly as index.html lists them -----
env.localStorage.setItem('alter-settings', JSON.stringify({ rank: 'K', suit: 'diamond', brightness: 200 }));
const moduleSources = env.top.querySelectorAll('script').filter((s) => s.attrs.get('type') === 'module').map((s) => s.attrs.get('src'));
const classicSources = env.top.querySelectorAll('script').filter((s) => s.attrs.get('type') !== 'module').map((s) => s.attrs.get('src'));

test('index.html loads app.js and install-ui.js as modules, plus the classic settings-ui.js that is not run here', () => {
  assert.deepEqual(moduleSources, ['./app.js', './install-ui.js']);
  // The personal build ships update-prompt.js; only a pinned friend snapshot (ALTER_ROOT) may lack it.
  assert.deepEqual(classicSources, process.env.ALTER_ROOT ? ['./settings-ui.js'] : ['./settings-ui.js', './update-prompt.js']);
});

test('boot imports the real zz10 modules, restores saved settings and shows the first-run guide', async () => {
  for (const src of moduleSources) await import(new URL(src, root));
  await settle(5);
  assert.equal(byId('setup').hidden, false);
  assert.equal(byId('stage').hidden, true);
  assert.equal(byId('settings').hidden, true);
  assert.equal(byId('gesture-guide').hidden, false, 'guide shows until it was seen');
  assert.equal(document.activeElement, byId('close-gesture-guide'));
  // readSavedSettings: valid rank and suit are restored, brightness is clamped to 125.
  assert.equal(byId('rank').value, 'K');
  assert.equal(byId('suit').value, 'diamond');
  assert.equal(byId('brightness').value, '125');
  assert.deepEqual(savedSettings(), { rank: 'K', suit: 'diamond', brightness: 125 }, 'renderCard saved the clamped values');
  const overlay = byId('card-overlay');
  assert.equal(overlay.classes.has('red'), true, 'diamond is a red suit');
  assert.deepEqual(overlay.querySelectorAll('.rank').map((e) => e.textContent), ['K', 'K']);
  assert.deepEqual(overlay.querySelectorAll('.suit').map((e) => e.textContent), ['♦', '♦', '♦']);
  assert.equal(byId('stage').style.getPropertyValue('--camera-brightness'), '1.25');
  assert.equal(stateNote(), '카메라 시작 전');
  assert.deepEqual(env.serviceWorker.registered, ['./sw.js']);
});

test('guide: the close button hides it and remembers that it was seen', async () => {
  await click(byId('close-gesture-guide'));
  assert.equal(byId('gesture-guide').hidden, true);
  assert.equal(env.localStorage.getItem('alter-settings-gesture-guide-v1'), 'seen');
});

test('settings opens from the setup screen and closes again with the button and Escape', async () => {
  await click(byId('setup-settings'));
  assert.equal(byId('settings').hidden, false);
  assert.equal(byId('settings').classes.has('is-running'), false);
  assert.equal(document.activeElement, byId('close-settings'));
  assert.equal(stateNote(), '카메라 시작 전');
  assert.equal(env.lockState.requests.length, 0, 'no wake lock without a camera');
  await click(byId('close-settings'));
  assert.equal(byId('settings').hidden, true);
  await click(byId('setup-settings'));
  await dispatch(document, 'keydown', { key: 'Enter' });
  assert.equal(byId('settings').hidden, false, 'other keys do not close it');
  await dispatch(document, 'keydown', { key: 'Escape' });
  assert.equal(byId('settings').hidden, true);
});

test('camera refusal keeps the setup screen with the permission message and re-enables the button', async () => {
  env.media.queue.push(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
  await click(byId('start'));
  assert.equal(env.media.gets.length, 1, 'permission denial is not asked again');
  assert.equal(byId('setup-message').textContent, '카메라 권한이 거부됐습니다. 브라우저 설정에서 권한을 허용한 뒤 다시 시작해 주세요.');
  assert.equal(byId('setup').hidden, false);
  assert.equal(byId('stage').hidden, true);
  assert.equal(byId('start').disabled, false);
});

test('camera start falls back to a generic camera, then shows the stage with a held wake lock', async () => {
  const video = byId('camera');
  Object.assign(video, { readyState: 4, videoWidth: 640, videoHeight: 1000, play: async () => {} });
  Object.assign(byId('stage'), { clientWidth: 300, clientHeight: 500 });
  env.media.queue.push(Object.assign(new Error('none'), { name: 'OverconstrainedError' }));
  await click(byId('start'));
  assert.equal(env.media.gets.length, 3);
  assert.equal(env.media.gets[1].video.facingMode.ideal, 'user');
  assert.equal(env.media.gets[2].video.facingMode, undefined, 'the second attempt drops facingMode');
  assert.equal(env.media.gets[2].audio, false);
  assert.ok(video.srcObject, 'stream attached to the video');
  assert.equal(byId('setup').hidden, true);
  assert.equal(byId('stage').hidden, false);
  assert.equal(byId('settings').hidden, true);
  assert.equal(runtimeNote(), '카메라 준비 중 · 빈 배경을 비춰 주세요');
  assert.equal(env.lockState.requests.length, 1);
  assert.equal(env.lockState.requests[0].type, 'screen');
  assert.equal(env.lockState.requests[0].released, false);
  assert.equal(JSON.parse(env.sessionStorage.getItem('alter-runtime-events'))['camera-start'], 1);
});

test('performance: calibrates on the empty wall, then draws the alter card over the detected card', async () => {
  await frames(8, 'empty');
  assert.equal(runtimeNote(), '카메라 준비 중 · 빈 배경을 비춰 주세요', 'calibration needs about 1.8 s of a still scene');
  await frames(4, 'empty');
  assert.equal(runtimeNote(), '준비 완료');
  assert.equal(byId('card-overlay').hidden, true);
  assert.equal(stateNote(), '카드를 기다리는 중');

  await frames(1, 'card');
  assert.equal(stateNote(), '카드 윤곽 확인 중');
  assert.equal(byId('card-overlay').hidden, true, 'nothing is drawn before the card is stable');
  await frames(6, 'card');
  assert.equal(stateNote(), '카메라 속 카드 표시 중');
  const overlay = byId('card-overlay');
  assert.equal(overlay.hidden, false, 'the alter card is drawn');
  assert.match(overlay.style.transform, /^matrix3d\((-?[\d.e+-]+,){15}-?[\d.e+-]+\)$/);
  assert.match(overlay.style.maskImage, /^url\("data:image\/png;base64,AAAA"\)$/);
  assert.equal(overlay.style.maskSize, '100% 100%');
  assert.match(overlay.style.getPropertyValue('--card-paper'), /^rgb\(\d+, \d+, \d+\)$/, 'the paper colour is matched from the frame');

  await frames(8, 'empty');
  assert.equal(overlay.hidden, true, 'the overlay goes away once the card is gone');
  assert.equal(overlay.style.maskImage, 'none');
  assert.equal(stateNote(), '카메라 속 카드 표시 중', 'the alter state is kept until a full exit or reveal');
});

test('settings: a two-finger downward swipe opens it; short, sideways and three-finger swipes do not', async () => {
  const settings = byId('settings');
  assert.equal((await twoFingerSwipe(60)).defaultPrevented, false);
  assert.equal(settings.hidden, true, 'too short');
  assert.equal((await twoFingerSwipe(150, { dx: 200 })).defaultPrevented, false);
  assert.equal(settings.hidden, true, 'mostly sideways');
  const three = [touch(1, 50, 300), touch(2, 150, 300), touch(3, 250, 300)];
  await dispatch(byId('stage'), 'touchstart', { touches: three });
  const blocked = await dispatch(byId('stage'), 'touchmove', { touches: [touch(1, 50, 460), touch(2, 150, 460)] });
  await dispatch(byId('stage'), 'touchend', { touches: [] });
  assert.equal(blocked.defaultPrevented, false);
  assert.equal(settings.hidden, true, 'a third finger blocks the gesture');
  assert.equal((await twoFingerSwipe(-150)).defaultPrevented, false);
  assert.equal(settings.hidden, true, 'upward does not open');

  const move = await twoFingerSwipe(150);
  assert.equal(move.defaultPrevented, true);
  assert.equal(settings.hidden, false);
  assert.equal(settings.classes.has('is-running'), true);
  assert.equal(stateNote(), '카메라 속 카드 표시 중');
  assert.equal(byId('card-overlay').hidden, true);
  assert.equal(document.activeElement, byId('close-settings'));
  assert.equal(env.lockState.requests[0].released, true, 'wake lock is released while settings is open');
});

test('settings are saved to storage and reset the calibration', async () => {
  byId('rank').value = 'Q';
  byId('suit').value = 'club';
  byId('brightness').value = '90';
  await dispatch(byId('brightness'), 'change');
  assert.deepEqual(savedSettings(), { rank: 'Q', suit: 'club', brightness: 90 });
  const overlay = byId('card-overlay');
  assert.equal(overlay.classes.has('red'), false);
  assert.deepEqual(overlay.querySelectorAll('.rank').map((e) => e.textContent), ['Q', 'Q']);
  assert.deepEqual(overlay.querySelectorAll('.suit').map((e) => e.textContent), ['♣', '♣', '♣']);
  assert.equal(byId('stage').style.getPropertyValue('--camera-brightness'), '0.9');
  assert.equal(runtimeNote(), '카메라 준비 중 · 빈 배경을 비춰 주세요');
  byId('suit').value = 'heart';
  await dispatch(byId('suit'), 'change');
  assert.equal(savedSettings().suit, 'heart');
  assert.equal(overlay.classes.has('red'), true);
  byId('rank').value = '10';
  await dispatch(byId('rank'), 'change');
  assert.equal(savedSettings().rank, '10');
});

test('wake lock follows settings and page visibility; analysis stops while hidden and resumes when visible', async () => {
  const locks = env.lockState.requests;
  assert.equal(locks.length, 1);
  await dispatch(document, 'keydown', { key: 'Escape' });
  await settle(5);
  assert.equal(byId('settings').hidden, true);
  assert.equal(locks.length, 2, 'closing settings takes the lock again');
  assert.equal(locks[1].released, false);

  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(locks[1].released, true, 'a hidden page releases the lock');
  assert.equal(locks.length, 2);
  assert.equal(env.raf.callback, null, 'analysis loop is suspended');
  assert.equal(JSON.parse(env.sessionStorage.getItem('alter-runtime-events'))['visibility-hidden'], 1);

  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(locks.length, 3, 'a visible page takes the lock again');
  assert.equal(locks[2].released, false);
  assert.ok(env.raf.callback, 'analysis loop is running again');
  assert.equal(JSON.parse(env.sessionStorage.getItem('alter-runtime-events'))['visible-resume'], 1);

  await dispatch(window, 'pagehide');
  assert.equal(env.raf.callback, null);
  await dispatch(window, 'pageshow');
  assert.ok(env.raf.callback);
});

test('reveal shows the real card and closes settings; reset returns to calibration', async () => {
  await frames(14, 'empty');
  await frames(8, 'card');
  assert.equal(stateNote(), '카메라 속 카드 표시 중');
  assert.equal(byId('card-overlay').hidden, false);
  await twoFingerSwipe(150);
  assert.equal(byId('settings').hidden, false);
  await click(byId('reveal'));
  assert.equal(byId('settings').hidden, true);
  assert.equal(byId('card-overlay').hidden, true);
  await frames(2, 'card');
  assert.equal(stateNote(), '공연 완료');
  assert.equal(byId('card-overlay').hidden, true);

  await twoFingerSwipe(150);
  await click(byId('reset'));
  assert.equal(byId('settings').hidden, true);
  assert.equal(runtimeNote(), '카메라 준비 중 · 빈 배경을 비춰 주세요');
  await frames(1, 'empty');
  assert.equal(stateNote(), '카드를 기다리는 중');
});

test('resize with a new crop restarts calibration', async () => {
  await frames(14, 'empty');
  assert.equal(runtimeNote(), '준비 완료');
  byId('stage').clientWidth = 280;
  await dispatch(window, 'resize');
  assert.equal(runtimeNote(), '카메라 준비 중 · 빈 배경을 비춰 주세요');
  assert.equal(JSON.parse(env.sessionStorage.getItem('alter-runtime-events')).resize, 1);
});

test('stop releases the camera, returns to setup and releases the wake lock', async () => {
  const track = env.media.tracks.at(-1);
  const lock = env.lockState.requests.at(-1);
  await twoFingerSwipe(150);
  await click(byId('stop'));
  await settle(5);
  assert.equal(track.stopped, 1);
  assert.equal(byId('camera').srcObject, null);
  assert.equal(byId('stage').hidden, true);
  assert.equal(byId('setup').hidden, false);
  assert.equal(byId('settings').hidden, true);
  assert.equal(runtimeNote(), '카메라 시작 전');
  assert.equal(stateNote(), '카메라 시작 전');
  assert.equal(lock.released, true);
  assert.equal(env.raf.callback, null);
  assert.equal(JSON.parse(env.sessionStorage.getItem('alter-runtime-events'))['user-stop'], 1);
});

test('a camera track that ends mid-show asks for a restart', async () => {
  await click(byId('start'));
  assert.equal(byId('stage').hidden, false);
  const track = env.media.tracks.at(-1);
  await dispatch(track, 'ended', { bubbles: false });
  assert.equal(runtimeNote(), '카메라 연결이 끊겼습니다. 설정에서 종료한 뒤 다시 시작해 주세요.');
  assert.equal(env.raf.callback, null, 'analysis stopped');
  assert.equal(JSON.parse(env.sessionStorage.getItem('alter-runtime-events'))['track-ended'], 1);
  await dispatch(document, 'visibilitychange');
  assert.equal(env.raf.callback, null, 'a lost camera is not resumed by visibility');
  await twoFingerSwipe(150);
  await click(byId('stop'));
  assert.equal(byId('setup').hidden, false);
});

test('install prompt: shown controls, native prompt on click, fallback help, installed state', async () => {
  const controls = ['setup-install-control', 'install-control'].map(byId);
  assert.deepEqual(controls.map((c) => c.hidden), [false, false]);
  const helps = ['setup-install-help', 'install-help'].map(byId);
  assert.deepEqual(helps.map((h) => h.hidden), [true, true]);

  // No native prompt yet: manual instructions, Android/desktop wording.
  await click(byId('install-app'));
  assert.match(byId('install-help').textContent, /^브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요\./);
  assert.deepEqual(helps.map((h) => h.hidden), [false, false], 'both install areas show the help');

  // iPhone wording.
  navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  await click(byId('setup-install-app'));
  assert.match(byId('setup-install-help').textContent, /^iPhone·iPad: Safari에서 이 주소를 열고/);
  navigator.userAgent = 'node-test';

  // Native prompt accepted.
  const prompted = { prompts: 0 };
  const event = {
    prompt: async () => { prompted.prompts += 1; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  };
  const dispatched = await dispatch(window, 'beforeinstallprompt', event);
  assert.equal(dispatched.defaultPrevented, true, 'the browser mini-infobar is suppressed');
  await click(byId('install-app'));
  assert.equal(prompted.prompts, 1);
  assert.match(byId('install-help').textContent, /^설치 요청을 보냈습니다\./);
  await click(byId('install-app'));
  assert.equal(prompted.prompts, 1, 'the prompt is used once');

  // Dismissed prompt falls back to the manual instructions.
  await dispatch(window, 'beforeinstallprompt', { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  await click(byId('install-app'));
  assert.match(byId('install-help').textContent, /^브라우저 메뉴에서/);

  // appinstalled while still not standalone points at the app icon.
  await dispatch(window, 'appinstalled');
  assert.match(byId('install-help').textContent, /^설치 요청을 받았습니다\./);

  // Standalone: the controls hide and a prompt event is ignored.
  env.standalone.matches = true;
  await click(byId('install-app'));
  assert.deepEqual(controls.map((c) => c.hidden), [true, true]);
  const ignored = await dispatch(window, 'beforeinstallprompt', { prompt: async () => { throw new Error('must not prompt'); }, userChoice: Promise.resolve({}) });
  assert.equal(ignored.defaultPrevented, false);
});
