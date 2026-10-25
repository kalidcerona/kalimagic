import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Loads KanameCue/app.mjs and its real imports as separate ES modules (no concatenation, no shared scope).
// A module that uses an identifier it does not import throws ReferenceError here, as it does in the browser.
// The DOM is built by parsing the real index.html, so ids and selectors the modules look up are the shipped ones,
// and the classic install-ui.js runs against the real install sheet markup before the modules, as in the page.
// Flows are driven through the listeners the app registers: boot, install sheet, wake lock on visibility, creating,
// renaming, duplicating and deleting shows, audio import from stub files, the cue dialog (audio, fade, stop, loop,
// hits, inserts), JSON export/import, settings and saved preferences, remote key learning, then a run: keyboard and
// on-screen GO, rejected double GO, insert lists, hits, STOP, panic by key/hold/button, BACK, lock, output loss
// and resume, the saved standby position and ending the show.
// The audio stub records what the app schedules (which cue, start time, gain events, fade curve, stop time), so the
// assertions check real scheduling decisions, not only that something was called.
// Not reachable with these stubs: IndexedDB (the app's own in-memory fallback is used), real sound and latency,
// the ?debug=1 inspection hook, the output-loss 1.5 s dedupe window, the resume button after a second loss, and
// sw.js (a separate worker file, covered by kaname-deploy.test.mjs).
const root = new URL('../../KanameCue/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const installSource = readFileSync(new URL('install-ui.js', root), 'utf8');
const appSource = readFileSync(new URL('app.mjs', root), 'utf8');

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
const realSetInterval = globalThis.setInterval;
// The run screen refreshes on a 250 ms interval; unref it so a finished test file can exit.
globalThis.setInterval = (fn, ms, ...rest) => { const timer = realSetInterval(fn, ms, ...rest); timer.unref?.(); return timer; };
afterEach(async () => {
  await settle(5);
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
});
after(() => { console.error = originalConsoleError; globalThis.setInterval = realSetInterval; });

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const near = (actual, expected, label = 'value') => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: expected ${expected}, got ${actual}`);

// ----- selector matching (the subset the app uses) -----
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
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function attrValue(el, name) {
  if (name.startsWith('data-')) { const v = el.dataset[camel(name.slice(5))]; return v === undefined ? null : String(v); }
  if (name === 'id') return el.id || null;
  if (name === 'hidden') return el.hidden ? '' : null;
  if (name === 'open') return el.open ? '' : null;
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
const matchesSelector = (el, selector) => parseSelector(selector).some((chain) => matchChain(el, chain, chain.length - 1));

// ----- events: capture, target, bubble over element -> document -> window; on<type> properties run too -----
function listen(target) {
  target.listeners = new Map();
  target.addEventListener = (type, fn, opts) => {
    if (!target.listeners.has(type)) target.listeners.set(type, []);
    target.listeners.get(type).push({ fn, capture: opts === true || opts?.capture === true });
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
      results.push(l.fn.call(node, event));
      if (event.immediate) return;
    }
    const handler = node[`on${event.type}`];
    if (phase !== 'capture' && typeof handler === 'function') results.push(handler.call(node, event));
  };
  for (let i = path.length - 1; i > 0 && !event.stopped; i -= 1) call(path[i], 'capture');
  if (!event.stopped) call(path[0], 'target');
  if (event.bubbles !== false) for (let i = 1; i < path.length && !event.stopped; i += 1) call(path[i], 'bubble');
  return results;
}
const makeEvent = (type, init) => ({
  type, bubbles: true, cancelable: true, defaultPrevented: false, isTrusted: false, timeStamp: 0,
  preventDefault() { this.defaultPrevented = true; },
  stopPropagation() { this.stopped = true; },
  ...init,
});
async function dispatch(target, type, init = {}) {
  const event = makeEvent(type, init);
  await Promise.all(runEvent(target, event));
  return event;
}
async function click(el) {
  assert.equal(el.disabled, false, 'the clicked control is enabled');
  const event = await dispatch(el, 'click');
  await settle(5);
  return event;
}

// ----- elements -----
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.nodeType = tag === '#text' ? 3 : 1; this.id = '';
    this.attrs = new Map(); this.classes = new Set(); this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = '';
    this.open = false; this.type = ''; this.files = []; this.clicked = 0;
    const props = new Map();
    this.style = { setProperty: (k, v) => { props.set(k, String(v)); }, getPropertyValue: (k) => props.get(k) ?? '' };
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
  get childElementCount() { return this.children.filter((c) => c.nodeType === 1).length; }
  get firstChild() { return this.children[0] || null; }
  get offsetWidth() { return 0; }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = v;
    if (k === 'hidden') this.hidden = true;
    if (k === 'checked') this.checked = true;
    if (k === 'value') this.value = String(v);
    if (['type', 'href', 'download', 'src'].includes(k)) this[k] = String(v);
    if (k.startsWith('data-')) this.dataset[camel(k.slice(5))] = String(v);
  }
  getAttribute(k) { return attrValue(this, k); }
  append(...nodes) {
    for (const raw of nodes) {
      const node = typeof raw === 'string' ? textNode(raw) : raw;
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
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
  setPointerCapture() {}
  click() { this.clicked += 1; return dispatch(this, 'click'); }
  showModal() { this.open = true; }
  close() {
    if (!this.open) return;
    this.open = false;
    if (this.contains(document.activeElement)) document.activeElement = null;
    runEvent(this, makeEvent('close', { bubbles: false }));
  }
}
class FakeButton extends FakeElement { constructor() { super('button'); } }
const create = (tag) => (tag.toLowerCase() === 'button' ? new FakeButton() : new FakeElement(tag));
const textNode = (text) => { const node = new FakeElement('#text'); node._text = text; return node; };
const textOf = (el) => el._text + el.children.map(textOf).join('');

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
      const el = create(m[2]);
      for (const [, k, a, b, c] of m[3].matchAll(attr)) el.setAttribute(k, a ?? b ?? c ?? '');
      stack[stack.length - 1].append(el);
      if (SKIP_CONTENT.has(el.tag)) { token.lastIndex = source.toLowerCase().indexOf(`</${el.tag}>`, token.lastIndex) + el.tag.length + 3; continue; }
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] && stack.length > 1) stack[stack.length - 1]._text += m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  return top;
}

// ----- audio stub: records what the app schedules -----
const audio = { contexts: [], persistCalls: 0 };
class StubParam {
  constructor(ctx) { this.ctx = ctx; this.events = [{ kind: 'set', value: 1, time: -1e9 }]; this.log = []; }
  add(event) { this.events.push(event); this.events.sort((a, b) => a.time - b.time); }
  valueAt(t) {
    let v = 1;
    let from = null;
    for (const e of this.events) {
      if (e.time <= t) { v = e.value; from = e.time; continue; }
      if (e.kind === 'ramp' && from !== null) v += (e.value - v) * (t - from) / (e.time - from);
      break;
    }
    return v;
  }
  get value() { return this.valueAt(this.ctx.currentTime); }
  set value(v) { this.log.push({ call: 'value=', value: v }); this.events = [{ kind: 'set', value: v, time: -1e9 }]; }
  setValueAtTime(value, time) { this.log.push({ call: 'setValueAtTime', value, time }); this.add({ kind: 'set', value, time }); }
  linearRampToValueAtTime(value, time) { this.log.push({ call: 'linearRampToValueAtTime', value, time }); this.add({ kind: 'ramp', value, time }); }
  setValueCurveAtTime(curve, time, duration) { this.log.push({ call: 'setValueCurveAtTime', curve, time, duration }); this.add({ kind: 'set', value: curve[curve.length - 1], time: time + duration }); }
  cancelAndHoldAtTime(time) {
    this.log.push({ call: 'cancelAndHoldAtTime', time });
    const value = this.valueAt(time);
    this.events = this.events.filter((e) => e.time <= time);
    this.events.push({ kind: 'set', value, time });
  }
  cancelScheduledValues(time) { this.log.push({ call: 'cancelScheduledValues', time }); this.events = this.events.filter((e) => e.time < time); }
}
class StubAudioContext {
  constructor(options) {
    this.options = options; this.state = 'suspended'; this.currentTime = 0; this.outputLatency = 0.02; this.baseLatency = 0.005;
    this.destination = { name: 'destination' }; this.sources = []; this.gains = []; this.resumeCalls = 0; this.suspendCalls = 0;
    listen(this);
    audio.contexts.push(this);
  }
  setState(state) { this.state = state; runEvent(this, makeEvent('statechange', { bubbles: false })); }
  async resume() { this.resumeCalls += 1; this.setState('running'); }
  async suspend() { this.suspendCalls += 1; this.setState('suspended'); }
  createGain() {
    const node = { gain: new StubParam(this), connected: [], disconnected: false, connect(next) { this.connected.push(next); }, disconnect() { this.disconnected = true; } };
    this.gains.push(node);
    return node;
  }
  createBufferSource() {
    const source = {
      buffer: null, loop: false, loopStart: 0, loopEnd: 0, starts: [], stops: [], onended: null, output: null, ended: false,
      connect(next) { this.output = next; }, start(...args) { this.starts.push(args); }, stop(...args) { this.stops.push(args); },
      end() { if (!this.ended) { this.ended = true; this.onended?.(); } },
    };
    this.sources.push(source);
    return source;
  }
  // The stub file bytes are [seconds, tag]; an empty file cannot be decoded.
  async decodeAudioData(data) {
    const bytes = new Uint8Array(data);
    if (!bytes.length) throw new Error('stub: undecodable audio');
    return { duration: bytes[0], length: bytes[0] * 48000, numberOfChannels: 2, sampleRate: 48000, tag: ['', 'intro', 'sfx'][bytes[1]] };
  }
}
const ctx = () => audio.contexts[0];
const gainLog = (source) => source.output.gain.log;
const curveCalls = (source) => gainLog(source).filter((e) => e.call === 'setValueCurveAtTime');

// ----- browser stubs -----
function stubBrowser() {
  const top = parseHtml(html);
  const htmlEl = top.children.find((c) => c.tag === 'html');
  const body = htmlEl.children.find((c) => c.tag === 'body');
  htmlEl.parentElement = null;
  const ids = new Map();
  for (const el of top.querySelectorAll('[id]')) ids.set(el.id, el);

  const localMap = new Map();
  const localStorage = {
    getItem: (key) => (localMap.has(key) ? localMap.get(key) : null),
    setItem: (key, value) => { localMap.set(key, String(value)); },
    removeItem: (key) => { localMap.delete(key); },
  };
  document = {
    activeElement: null, visibilityState: 'visible', body, documentElement: htmlEl,
    get hidden() { return this.visibilityState === 'hidden'; },
    getElementById: (id) => ids.get(id) || null,
    querySelector: (selector) => top.querySelector(selector),
    querySelectorAll: (selector) => top.querySelectorAll(selector),
    createElement: create,
  };
  listen(document);

  const calls = { vibrate: [], objectUrls: [], serviceWorker: [] };
  const wake = { requests: [], hold: false, resolveHeld: null };
  const devices = { list: [{ kind: 'audiooutput', deviceId: 'speaker', groupId: 'g1' }, { kind: 'audiooutput', deviceId: 'headset', groupId: 'g2' }] };
  const mediaDevices = { enumerateDevices: async () => [...devices.list] };
  listen(mediaDevices);
  const navigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/125', platform: 'Linux armv8l', maxTouchPoints: 5, standalone: false,
    vibrate: (pattern) => { calls.vibrate.push(pattern); return true; },
    serviceWorker: { register: async (url) => { calls.serviceWorker.push(url); return {}; } },
    mediaDevices, mediaSession: { metadata: null },
    storage: { persisted: async () => false, persist: async () => { audio.persistCalls += 1; return true; } },
    wakeLock: {
      request: async (type) => {
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { if (name === 'release') lock.handlers.push(fn); };
        lock.release = async () => { lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        wake.requests.push(lock);
        if (wake.hold) await new Promise((resolve) => { wake.resolveHeld = resolve; });
        return lock;
      },
    },
  };
  const location = { href: 'https://example.test/KanameCue/', search: '', pathname: '/KanameCue/' };
  const displayMode = { matches: false };
  listen(displayMode);
  window = { navigator, location, scrollTo() {}, AudioContext: StubAudioContext, matchMedia: () => displayMode };
  listen(window);
  class MediaMetadata { constructor(init) { Object.assign(this, init); } }
  window.MediaMetadata = MediaMetadata;

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('localStorage', localStorage);
  define('HTMLButtonElement', FakeButton);
  define('MediaMetadata', MediaMetadata);
  define('requestAnimationFrame', (fn) => setTimeout(() => fn(0), 0));
  URL.createObjectURL = (blob) => { calls.objectUrls.push(blob); return `blob:test/${calls.objectUrls.length}`; };
  URL.revokeObjectURL = () => {};
  return { top, htmlEl, localStorage, calls, wake, devices, mediaDevices, navigator, displayMode };
}
const env = stubBrowser();
const byId = (id) => {
  const el = document.getElementById(id);
  assert.ok(el, `index.html defines #${id}`);
  return el;
};
const buttonsOf = (container) => container.querySelectorAll('button');
const buttonByText = (container, text, nth = 0) => {
  const found = buttonsOf(container).filter((b) => textOf(b) === text)[nth];
  assert.ok(found, `button "${text}" exists`);
  return found;
};
const screens = () => ['home', 'editor', 'run'].filter((id) => !byId(id).hidden);
const dialogInfo = () => ({ open: byId('confirmDialog').open, title: byId('confirmTitle').textContent, text: byId('confirmText').textContent });

// ----- input helpers -----
const ptr = (extra = {}) => ({ isPrimary: true, button: 0, pointerId: 1, ...extra });
async function tapGo() {
  await dispatch(byId('goBtn'), 'pointerdown', ptr());
  await dispatch(byId('goBtn'), 'pointerup', ptr());
  await settle(5);
}
async function press(code, { hold = 0 } = {}) {
  const down = await dispatch(document, 'keydown', { code, key: code, repeat: false });
  if (hold) await settle(hold);
  await dispatch(document, 'keyup', { code, key: code });
  await settle(5);
  return down;
}
async function holdButton(id, ms) {
  await dispatch(byId(id), 'pointerdown', ptr());
  await settle(ms);
  await dispatch(byId(id), 'pointerup', ptr());
  await settle(5);
}
async function twoFingerSwipe(target, dy) {
  const touch = (id, y) => ({ identifier: id, clientX: id * 100, clientY: y, target });
  await dispatch(document, 'touchstart', { touches: [touch(1, 300), touch(2, 300)] });
  const move = await dispatch(document, 'touchmove', { touches: [touch(1, 300 + dy), touch(2, 300 + dy)] });
  await dispatch(document, 'touchend', { touches: [] });
  await settle(5);
  return move;
}
async function hit(time) {
  ctx().currentTime = time;
  await dispatch(byId('hitGrid').children[0], 'pointerdown', ptr());
  await settle(5);
}
// A stopped source ends later in the browser; the stub ends it on request so the app sees onended.
const endStopped = () => ctx().sources.filter((s) => s.stops.length).forEach((s) => s.end());
const standby = () => byId('runStandby').textContent;
const activeNames = () => byId('activeList').children.map((c) => textOf(c.children[0]));

let mods;
let showMod;
let playback;
let ids;

// ----- show editor helpers -----
const field = (key) => {
  const found = byId('cueFields').querySelector(`[data-key="${key}"]`);
  assert.ok(found, `cue dialog has the ${key} field`);
  return found;
};
async function openAddCue(nth = 0) {
  await click(buttonByText(byId('tabBody'), '큐 추가', nth));
  assert.equal(byId('cueDialog').open, true);
}
async function saveCue() { await click(byId('cueSave')); }
async function changeField(key, value) { field(key).value = value; await dispatch(field(key), 'change'); }
async function fill(values) { for (const [key, value] of Object.entries(values)) field(key).value = value; }
const cueRow = (name) => {
  const row = byId('tabBody').querySelectorAll('.cue').find((r) => textOf(r.querySelector('.cue-title')).endsWith(name));
  assert.ok(row, `cue row ${name}`);
  return row;
};
const cueNames = (list = showMod.current.cues) => list.map((c) => c.name);
const stub = (name, seconds, tag) => new File([Uint8Array.of(seconds, tag)], name);

test('boot loads the real KANAME modules in page order, runs the install script and shows an empty home', async () => {
  const scripts = env.top.querySelectorAll('script');
  assert.deepEqual(scripts.filter((s) => s.attrs.get('type') === 'module').map((s) => s.attrs.get('src')), ['./app.mjs']);
  const classic = scripts.find((s) => s.attrs.get('src') === './install-ui.js');
  assert.ok(classic && classic.attrs.has('defer'), 'install-ui.js is a deferred classic script');
  assert.equal(scripts.indexOf(classic) < scripts.findIndex((s) => s.attrs.get('type') === 'module'), true, 'classic script comes first');

  // The classic script runs first, against the real install sheet markup.
  new Function(installSource)();
  assert.equal(byId('installSheet').open, true, 'first visit opens the install sheet');
  assert.match(byId('installHelp').textContent, /^Chrome 메뉴에서 앱 설치를 선택해 주세요/);
  assert.equal(env.localStorage.getItem('kc.install.seen'), '1');

  const imported = [...appSource.matchAll(/import\s+(?:[^'"]*from\s+)?'\.\/([\w.-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(imported, ['engine.mjs', 'audio.mjs', 'store.mjs', 'prefs.mjs', 'clock.mjs', 'ui.mjs', 'show.mjs', 'playback.mjs', 'settings.mjs', 'wake.mjs']);
  await import(new URL('app.mjs', root));
  mods = {};
  for (const name of imported) mods[name] = await import(new URL(name, root));
  showMod = mods['show.mjs'];
  playback = mods['playback.mjs'];
  await settle(20);

  assert.deepEqual(screens(), ['home']);
  assert.equal(byId('showList').children.length, 0);
  assert.equal(byId('emptyShows').hidden, false);
  assert.equal(byId('storageNote').textContent, '이 브라우저는 저장을 막고 있어요. 이번 방문 동안만 기억합니다.', 'no IndexedDB: the in-memory store is used and says so');
  assert.equal(showMod.store.persistent, false);
  assert.deepEqual(env.calls.serviceWorker, ['./sw.js']);
  assert.equal(env.wake.requests.length, 1);
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
});

test('wake lock follows visibility, is asked again when the system drops it, and a late grant is released when hidden', async () => {
  const requests = env.wake.requests;
  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(requests[0].released, true, 'hiding the page releases the lock');
  assert.equal(requests.length, 1);
  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(requests.length, 2, 'visible again asks for a new lock');
  assert.equal(requests[1].released, false);

  await requests[1].release(); // the system drops the lock while the page stays visible
  await settle(5);
  assert.equal(requests.length, 3, 'the app asks again');
  assert.equal(requests[2].released, false);

  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(requests[2].released, true);
  env.wake.hold = true;
  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(requests.length, 4, 'a request is pending');
  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  env.wake.resolveHeld();
  await settle(5);
  assert.equal(requests[3].released, true, 'a lock granted after the page was hidden is released at once');
  env.wake.hold = false;
  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(requests.length, 5);
  assert.equal(requests[4].released, false);
});

test('install sheet: later, native prompt accepted and dismissed, iPhone steps, installed state and settings closing the sheet', async () => {
  const sheet = byId('installSheet');
  const help = byId('installHelp');
  await click(byId('installLater'));
  assert.equal(sheet.open, false);
  assert.equal(env.localStorage.getItem('kc.install.dismissed'), '1');

  let prompted = 0;
  let prevented = 0;
  const native = (outcome) => ({ preventDefault() { prevented += 1; }, prompt: async () => { prompted += 1; }, userChoice: Promise.resolve({ outcome }) });
  await dispatch(window, 'beforeinstallprompt', native('accepted'));
  assert.equal(prevented, 1, 'the browser mini-bar is held back for the sheet');
  await click(byId('openInstall'));
  assert.equal(sheet.open, true);
  await click(byId('installApp'));
  assert.equal(prompted, 1);
  assert.equal(sheet.open, false, 'accepted install closes the sheet');

  await dispatch(window, 'beforeinstallprompt', native('dismissed'));
  await click(byId('openInstall'));
  await click(byId('installApp'));
  assert.equal(prompted, 2);
  assert.equal(sheet.open, true, 'a dismissed prompt keeps the sheet with manual steps');
  assert.match(help.textContent, /^Chrome 메뉴에서/);

  await click(byId('installLater'));
  env.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari';
  await click(byId('openInstall'));
  assert.match(help.textContent, /^Safari에서 이 주소를 열고 공유/);
  env.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 14) Chrome/125';

  await click(byId('openSettings'));
  assert.equal(byId('settings').open, true, 'the settings button opens the settings dialog');
  assert.equal(sheet.open, false, 'opening settings closes other open dialogs');
  assert.match(textOf(byId('perShow')), /^공연을 만든 뒤 리모컨 버튼과 실행 설정을 정하세요\./);
  await click(byId('closeSettings'));
  assert.equal(byId('settings').open, false);

  env.displayMode.matches = true;
  await dispatch(env.displayMode, 'change', { bubbles: false });
  assert.equal(byId('openInstall').hidden, true, 'a standalone app hides the install button');
  env.displayMode.matches = false;
  await dispatch(window, 'appinstalled');
  assert.equal(byId('openInstall').hidden, true);
  assert.equal(env.localStorage.getItem('kc.install.dismissed'), '1');
});

test('shows: create, rename with Enter, duplicate, delete with confirm, and reopen', async () => {
  await click(byId('newShow'));
  assert.deepEqual(screens(), ['editor']);
  assert.equal(byId('showName').textContent, '새 공연');
  assert.equal(byId('audioSummary').textContent, '0개');
  assert.equal(textOf(byId('tabBody')).includes('아직 큐가 없어요.'), true);
  assert.equal(showMod.current.name, '새 공연');

  await click(byId('backToList'));
  assert.deepEqual(screens(), ['home']);
  assert.equal(byId('showList').children.length, 1);
  assert.equal(byId('emptyShows').hidden, true);
  assert.equal(textOf(byId('showList').children[0].querySelector('.meta')), '메인 0 · 히트 0 · 삽입 0 · 오디오 0');

  await click(buttonByText(byId('showList').children[0], '복제'));
  assert.deepEqual(byId('showList').children.map((c) => textOf(c.querySelector('h2'))), ['새 공연', '새 공연 복사']);

  await click(buttonByText(byId('showList').children[1], '삭제'));
  assert.deepEqual(dialogInfo(), { open: true, title: '공연 삭제', text: '새 공연 복사 공연을 삭제할까요?' });
  assert.equal(byId('confirmOk').hidden, false);
  await click(byId('confirmCancel'));
  assert.equal(byId('confirmDialog').open, false);
  assert.equal(byId('showList').children.length, 2, 'cancel keeps the show');
  await click(buttonByText(byId('showList').children[1], '삭제'));
  await click(byId('confirmOk'));
  assert.equal(byId('confirmDialog').open, false);
  assert.equal(byId('showList').children.length, 1, 'confirm removes it');

  await click(buttonByText(byId('showList').children[0], '이름'));
  assert.equal(byId('textDialog').open, true);
  assert.equal(byId('textInput').value, '새 공연');
  assert.equal(document.activeElement, byId('textInput'));
  await click(byId('textCancel'));
  assert.equal(byId('textDialog').open, false);
  assert.equal(textOf(byId('showList').children[0].querySelector('h2')), '새 공연');
  await click(buttonByText(byId('showList').children[0], '이름'));
  byId('textInput').value = 'Stage A';
  const enter = await dispatch(byId('textInput'), 'keydown', { key: 'Enter' });
  await settle(5);
  assert.equal(enter.defaultPrevented, true);
  assert.equal(byId('textDialog').open, false, 'Enter saves and closes');
  assert.equal(textOf(byId('showList').children[0].querySelector('h2')), 'Stage A');

  await click(buttonByText(byId('showList').children[0], '열기'));
  assert.deepEqual(screens(), ['editor']);
  assert.equal(showMod.current.name, 'Stage A');
  await click(byId('renameShow'));
  byId('textInput').value = '   ';
  await click(byId('textOk'));
  assert.equal(byId('showName').textContent, '새 공연', 'a blank name falls back to the default');
  await click(byId('renameShow'));
  byId('textInput').value = 'Stage A';
  await click(byId('textOk'));
  assert.equal(byId('showName').textContent, 'Stage A');
  assert.equal((await showMod.store.shows()).length, 1);
});

test('audio import from stub files fills the show audio slots and asks the browser to keep the storage', async () => {
  const picker = byId('audioFiles');
  const before = picker.clicked;
  await click(byId('importAudio'));
  assert.equal(picker.clicked, before + 1, 'the button opens the hidden file picker');

  picker.files = [stub('intro.wav', 4, 1), stub('sfx.wav', 2, 2), new File([new Uint8Array(0)], 'broken.wav')];
  await dispatch(picker, 'change');
  await settle(10);
  assert.equal(audio.persistCalls, 1);
  assert.deepEqual(showMod.current.audioFiles.map((f) => f.displayName), ['intro.wav', 'sfx.wav', 'broken.wav']);
  ids = Object.fromEntries(showMod.current.audioFiles.map((f) => [f.displayName.replace('.wav', ''), f.id]));
  assert.equal(byId('audioSummary').textContent, '3개');
  assert.deepEqual(byId('audioList').children.map((li) => li.children.map(textOf)), [['intro.wav', '있음'], ['sfx.wav', '있음'], ['broken.wav', '있음']]);
  assert.equal(dialogInfo().open, false, 'new files add silently');
  assert.deepEqual([...(await showMod.store.audioIds())].sort(), Object.values(ids).sort());
  assert.equal((await showMod.store.audio(ids.intro)).name, 'intro.wav');

  picker.files = [stub('intro.wav', 4, 1)];
  await dispatch(picker, 'change');
  await settle(10);
  assert.equal(showMod.current.audioFiles.length, 3, 'the same name replaces the stored audio instead of adding one');
  assert.deepEqual(dialogInfo(), { open: true, title: '오디오를 가져왔어요', text: '공연의 오디오 자리에 1개를 맞춰 넣었어요.' });
  assert.equal(byId('confirmOk').hidden, true);
  await click(byId('confirmCancel'));
  assert.equal(byId('confirmDialog').open, false);
});

test('the cue dialog validates, builds audio, loop, fade and stop cues, and the list reorders, edits and deletes', async () => {
  await openAddCue();
  assert.equal(field('type').value, 'AUDIO');
  await saveCue();
  assert.equal(byId('cueProblem').textContent, '오디오를 선택하세요.');
  assert.equal(byId('cueDialog').open, true, 'an invalid cue keeps the dialog open');
  await fill({ audioFileId: ids.intro, startMs: '250', endMs: '100' });
  await saveCue();
  assert.equal(byId('cueProblem').textContent, '종료 ms는 시작 ms보다 커야 해요.');
  await fill({ name: 'intro', volume: '80', endMs: '', fadeInMs: '500', fadeOutMs: '1000' });
  await saveCue();
  assert.equal(byId('cueDialog').open, false);
  assert.deepEqual(cueNames(), ['intro']);
  const intro = showMod.current.cues[0];
  assert.deepEqual({ n: intro.number, file: intro.audioFileId, volume: intro.volume, start: intro.startMs, end: intro.endMs, fi: intro.fadeInMs, fo: intro.fadeOutMs }, { n: '1', file: ids.intro, volume: 0.8, start: 250, end: null, fi: 500, fo: 1000 });
  assert.equal(textOf(cueRow('intro').querySelector('.cue-meta')), '오디오 · 수동 · intro.wav');

  await openAddCue();
  await fill({ name: 'sfx', audioFileId: ids.sfx });
  await changeField('loop', 'COUNT');
  await fill({ loopCount: '2' });
  await saveCue();
  assert.equal(textOf(cueRow('sfx').querySelector('.cue-meta')), '오디오 · 수동 · sfx.wav · 2번 재생');

  await openAddCue();
  await fill({ name: 'fade' });
  await changeField('type', 'FADE');
  assert.equal(field('target').value, 'ALL', 'changing the type keeps the valid "all playing" target');
  await changeField('target', '');
  await saveCue();
  assert.equal(byId('cueProblem').textContent, '대상을 선택하세요.');
  await fill({ target: intro.id, targetVolume: '20', durationMs: '1000' });
  await saveCue();
  const fade = showMod.current.cues[2];
  assert.deepEqual({ type: fade.type, number: fade.number, target: fade.target, volume: fade.targetVolume, ms: fade.durationMs, stopAtEnd: fade.stopAtEnd }, { type: 'FADE', number: '3', target: intro.id, volume: 0.2, ms: 1000, stopAtEnd: false });
  assert.equal(textOf(cueRow('fade').querySelector('.cue-meta')), '페이드 · 수동 · 대상 1 intro');

  await openAddCue();
  await fill({ name: 'stop' });
  await changeField('type', 'STOP');
  await fill({ target: 'ALL', fadeMs: '500' });
  await saveCue();
  assert.equal(textOf(cueRow('stop').querySelector('.cue-meta')), '정지 · 수동 · 전체 재생');

  await openAddCue();
  await fill({ name: 'broken', audioFileId: ids.broken });
  await saveCue();
  assert.deepEqual(cueNames(), ['intro', 'sfx', 'fade', 'stop', 'broken']);

  // Edit, reorder and delete a throwaway cue.
  await openAddCue();
  await fill({ name: 'tmp', audioFileId: ids.sfx });
  await saveCue();
  await click(buttonByText(cueRow('tmp'), '편집'));
  assert.equal(field('name').value, 'tmp');
  await fill({ name: 'tmp2' });
  await click(byId('cueCancel'));
  assert.equal(byId('cueDialog').open, false);
  assert.deepEqual(cueNames().at(-1), 'tmp', 'cancel discards the edit');
  await click(buttonByText(cueRow('tmp'), '편집'));
  await fill({ name: 'tmp2' });
  await saveCue();
  assert.deepEqual(cueNames().slice(-2), ['broken', 'tmp2']);
  assert.equal(buttonByText(cueRow('intro'), '위').disabled, true);
  assert.equal(buttonByText(cueRow('tmp2'), '아래').disabled, true);
  await click(buttonByText(cueRow('tmp2'), '위'));
  assert.deepEqual(cueNames().slice(-2), ['tmp2', 'broken']);
  await click(buttonByText(cueRow('tmp2'), '아래'));
  assert.deepEqual(cueNames().slice(-2), ['broken', 'tmp2']);
  await click(buttonByText(cueRow('tmp2'), '삭제'));
  assert.equal(dialogInfo().title, '삭제 확인');
  assert.equal(dialogInfo().text, '6 tmp2 큐를 삭제할까요?');
  await click(byId('confirmOk'));
  assert.deepEqual(cueNames(), ['intro', 'sfx', 'fade', 'stop', 'broken']);
});

test('hits and insert lists are added through their tabs', async () => {
  const tab = (name) => document.querySelectorAll('.tabs button').find((b) => b.dataset.tab === name);
  await click(tab('hits'));
  assert.equal(tab('hits').getAttribute('aria-selected'), 'true');
  assert.equal(tab('main').getAttribute('aria-selected'), 'false');
  await openAddCue();
  await fill({ name: 'hit-sfx', audioFileId: ids.sfx });
  await saveCue();
  assert.deepEqual(cueNames(showMod.current.hits), ['hit-sfx']);

  await click(tab('inserts'));
  await click(buttonByText(byId('tabBody'), '목록 추가'));
  assert.equal(showMod.current.inserts.length, 0, 'an empty name adds nothing');
  const nameInput = byId('tabBody').querySelector('input');
  nameInput.value = 'Encore';
  await click(buttonByText(byId('tabBody'), '목록 추가'));
  assert.deepEqual(showMod.current.inserts.map((s) => s.name), ['Encore']);
  await openAddCue();
  await fill({ name: 'encore', audioFileId: ids.sfx });
  await saveCue();
  assert.deepEqual(cueNames(showMod.current.inserts[0].cues), ['encore']);
  await click(tab('main'));
  assert.equal(byId('tabBody').querySelectorAll('.cue').length, 5);
});

test('JSON export carries the show without audio, and import creates a copy and reports bad files', async () => {
  await click(byId('exportShow'));
  const blob = env.calls.objectUrls.at(-1);
  assert.equal(blob.type, 'application/json');
  const text = await blob.text();
  const exported = JSON.parse(text);
  assert.equal(exported.name, 'Stage A');
  assert.deepEqual(exported.cues.map((c) => c.name), ['intro', 'sfx', 'fade', 'stop', 'broken']);
  assert.equal(exported.audioFiles.length, 3);
  assert.equal(JSON.stringify(exported).includes('Blob'), false);

  await click(byId('backToList'));
  const before = showMod.shows.length;
  const picker = byId('showFile');
  picker.files = [{ text: async () => text }];
  await dispatch(picker, 'change');
  await settle(10);
  assert.equal(showMod.shows.length, before + 1);
  const copy = showMod.shows.find((s) => s.id !== showMod.current?.id && s.name === 'Stage A' && s.id !== exported.id);
  assert.ok(copy, 'the import gets a new id');
  assert.deepEqual(dialogInfo(), { open: true, title: '공연을 가져왔어요', text: '오디오도 모두 준비돼 있어요.' });
  await click(byId('confirmCancel'));

  picker.files = [{ text: async () => 'not json' }];
  await dispatch(picker, 'change');
  await settle(10);
  assert.deepEqual(dialogInfo(), { open: true, title: '가져올 수 없습니다', text: 'JSON을 읽을 수 없습니다' });
  await click(byId('confirmCancel'));
  assert.equal(showMod.shows.length, before + 1, 'a bad file adds nothing');

  // Remove the imported copy; open the original again.
  const cards = byId('showList').children;
  assert.equal(cards.length, 2);
  await click(buttonByText(cards[1], '삭제'));
  await click(byId('confirmOk'));
  assert.equal(byId('showList').children.length, 1);
  await click(buttonByText(byId('showList').children[0], '열기'));
  assert.equal(showMod.current.cues.length, 5);
});

test('settings save preferences to storage, per-show run settings, and learned remote keys', async () => {
  await click(byId('editorSettings'));
  assert.equal(byId('settings').open, true);
  assert.equal(byId('goTrigger').value, 'release');
  assert.equal(byId('fadeCurve').value, 'linear');
  assert.equal(byId('persistNote').textContent, '저장 공간 보호: 꺼짐');
  assert.equal(textOf(byId('timingHistory')), '아직 기록이 없어요.');

  byId('fadeCurve').value = 'equal';
  await dispatch(byId('fadeCurve'), 'change');
  assert.deepEqual(JSON.parse(env.localStorage.getItem('kc.prefs')), { fadeCurve: 'equal', goTrigger: 'release' });
  const fresh = await import(new URL('prefs.mjs?fresh', root));
  assert.equal(fresh.prefs.get('fadeCurve'), 'equal', 'a new page load reads the saved preference');
  assert.equal(fresh.prefs.get('goTrigger'), 'release');

  const numbers = () => byId('perShow').querySelectorAll('input').filter((i) => i.type === 'number');
  assert.deepEqual(numbers().map((i) => i.value), ['400', '300']);
  numbers()[0].value = '150';
  await dispatch(numbers()[0], 'change');
  await settle(10);
  assert.equal(showMod.current.settings.debounceMs, 150);
  numbers()[1].value = '250';
  await dispatch(numbers()[1], 'change');
  await settle(10);
  assert.equal(showMod.current.settings.panicFadeMs, 250);
  numbers()[0].value = '-5';
  await dispatch(numbers()[0], 'change');
  await settle(10);
  assert.equal(showMod.current.settings.debounceMs, 150, 'a negative value is not saved');

  const rows = () => byId('perShow').querySelectorAll('.keyrow');
  const rowFor = (label) => rows().find((r) => textOf(r.querySelector('strong')) === label);
  assert.deepEqual(rows().map((r) => textOf(r.querySelector('strong'))), ['GO', '이전', '전체 정지', '히트 1', '삽입 Encore']);
  assert.equal(textOf(rowFor('GO').querySelector('.keys')), '기본: 스페이스, 엔터, PageDown, 오른쪽, 아래 방향키');
  await click(buttonByText(rowFor('GO'), '버튼 연결'));
  assert.equal(textOf(rowFor('GO').querySelector('.keys')), '버튼 입력 대기 중');
  await dispatch(document, 'keydown', { code: 'KeyG', key: 'g' });
  await settle(10);
  assert.deepEqual(showMod.current.keyMap, { 35: 'GO' });
  assert.equal(textOf(rowFor('GO').querySelector('.keys')), 'G');

  await click(buttonByText(rowFor('전체 정지'), '버튼 연결'));
  await dispatch(document, 'keydown', { code: 'AudioVolumeUp', key: 'AudioVolumeUp' });
  assert.equal(textOf(rowFor('전체 정지').querySelector('.keys')), '볼륨 키는 사용하지 않습니다.');
  await dispatch(document, 'keydown', { code: 'F20', key: 'F20' });
  assert.equal(textOf(rowFor('전체 정지').querySelector('.keys')), '이 키는 저장할 수 없어요. 다른 버튼을 눌러 주세요.');
  await dispatch(document, 'keydown', { code: 'KeyP', key: 'p' });
  await settle(10);
  assert.deepEqual(showMod.current.keyMap, { 35: 'GO', 44: 'PANIC' });

  await click(buttonByText(rowFor('이전'), '버튼 연결'));
  await click(byId('closeSettings'));
  await dispatch(document, 'keydown', { code: 'KeyB', key: 'b' });
  assert.deepEqual(showMod.current.keyMap, { 35: 'GO', 44: 'PANIC' }, 'closing the dialog cancels learning');
  assert.equal(byId('settings').open, false);
});

test('start: the run screen decodes the stub audio, reports the unreadable file and ignores a double tap', async () => {
  const gainsBefore = audio.contexts.length;
  assert.equal(gainsBefore, 0);
  await Promise.all([click(byId('startShow')), click(byId('startShow'))]);
  await settle(30);
  assert.equal(audio.contexts.length, 1);
  assert.deepEqual(ctx().options, { latencyHint: 'interactive' });
  assert.equal(ctx().state, 'running', 'the context is resumed by the start tap');
  assert.equal(ctx().gains.length, 1, 'a double tap creates one audio engine (one output gain)');
  assert.deepEqual(screens(), ['run']);
  assert.equal(playback.runtime.show.settings.debounceMs, 150);
  assert.equal(playback.runtime.decode.finished, true);
  assert.equal(byId('runList').textContent, '메인 목록');
  assert.equal(standby(), '대기: 1 intro');
  assert.equal(byId('runNext').textContent, '다음: sfx');
  assert.equal(byId('runReady').textContent, '파일 확인 필요: 5 broken');
  assert.equal(byId('runReady').classList.contains('bad'), true);
  assert.equal(byId('hitGrid').children.length, 1);
  assert.equal(textOf(byId('hitGrid').children[0]), '히트 1hit-sfx');
  assert.equal(byId('insertRow').children.length, 1);
  assert.equal(textOf(byId('insertRow').children[0]), '삽입: Encore');
  assert.equal(env.navigator.mediaSession.metadata.title, 'Stage A');
  assert.deepEqual(await showMod.store.position(showMod.current.id), { standby: { listId: 'main', index: 0 }, stack: [] });
  assert.equal(ctx().sources.length, 0, 'nothing plays before GO');
});

test('GO by key release schedules the intro with its start offset, fade in and fade out; a quick second GO is rejected', async () => {
  ctx().currentTime = 10;
  const down = await dispatch(document, 'keydown', { code: 'Space', key: ' ', repeat: false });
  assert.equal(down.defaultPrevented, true);
  assert.equal(ctx().sources.length, 0, 'release mode waits for the key to come up');
  await dispatch(document, 'keyup', { code: 'Space', key: ' ' });
  await settle(5);
  assert.equal(ctx().sources.length, 1);
  const [source] = ctx().sources;
  assert.equal(source.buffer.tag, 'intro');
  assert.deepEqual(source.starts, [[10, 0.25, 3.75]]);
  assert.equal(source.loop, false);
  assert.deepEqual(gainLog(source), [
    { call: 'setValueAtTime', value: 0, time: 10 },
    { call: 'linearRampToValueAtTime', value: 0.8, time: 10.5 },
    { call: 'setValueAtTime', value: 0.8, time: 12.75 },
    { call: 'linearRampToValueAtTime', value: 0, time: 13.75 },
  ]);
  assert.equal(standby(), '대기: 2 sfx');
  assert.equal(byId('runNext').textContent, '다음: fade');
  assert.deepEqual(activeNames(), ['1 intro']);
  assert.deepEqual(env.calls.vibrate, [35]);
  assert.match(byId('timingLine').textContent, /^마지막 소리 시작까지: GO \d+\.\dms \(출력 20ms, 기본 5ms\)$/);
  assert.deepEqual(await showMod.store.position(showMod.current.id), { standby: { listId: 'main', index: 1 }, stack: [] });

  await tapGo();
  assert.equal(ctx().sources.length, 1, 'inside the debounce window nothing starts');
  assert.equal(standby(), '대기: 2 sfx');
  assert.deepEqual(env.calls.vibrate.at(-1), [0, 45, 65, 45]);
});

test('an insert list takes over standby, plays its cue and hands standby back to the main list', async () => {
  await settle(170);
  await click(byId('insertRow').children[0]);
  assert.equal(byId('runList').textContent, '삽입: Encore');
  assert.equal(standby(), '대기: 1 encore');
  assert.deepEqual(playback.runtime.engine.insertStack, [{ listId: 'main', index: 1 }]);

  ctx().currentTime = 10.2;
  await tapGo();
  assert.equal(ctx().sources.length, 2);
  const encore = ctx().sources[1];
  assert.equal(encore.buffer.tag, 'sfx');
  assert.deepEqual(encore.starts, [[10.2, 0, 2]]);
  assert.equal(byId('runList').textContent, '메인 목록', 'the last insert cue returns to the main list');
  assert.equal(standby(), '대기: 2 sfx');
  assert.deepEqual(playback.runtime.engine.insertStack, []);
  assert.deepEqual(activeNames(), ['1 intro', '1 encore']);
  encore.end();
  await settle(10);
  assert.deepEqual(activeNames(), ['1 intro'], 'a finished cue leaves the active list');
});

test('GO by Enter starts the counted loop; the learned G key starts a fade that uses the equal-power curve', async () => {
  await settle(170);
  ctx().currentTime = 11;
  await press('Enter');
  assert.equal(ctx().sources.length, 3);
  const sfx = ctx().sources[2];
  assert.equal(sfx.buffer.tag, 'sfx');
  assert.equal(sfx.loop, true);
  assert.deepEqual([sfx.loopStart, sfx.loopEnd], [0, 2]);
  assert.deepEqual(sfx.starts, [[11, 0]]);
  assert.deepEqual(sfx.stops, [[15]], 'two plays of a 2 s segment end at 15');
  assert.deepEqual(gainLog(sfx), [{ call: 'setValueAtTime', value: 1, time: 11 }]);
  assert.equal(standby(), '대기: 3 fade');

  await settle(170);
  ctx().currentTime = 12;
  await press('KeyG');
  assert.equal(ctx().sources.length, 3, 'a fade starts no source');
  const intro = ctx().sources[0];
  const [curve] = curveCalls(intro);
  assert.ok(curve, 'the fade ramps with a value curve');
  assert.equal(curve.curve.length, 200);
  near(curve.curve[0], 0.8, 'curve starts at the current gain');
  near(curve.curve[199], 0.2, 'curve ends at the target volume');
  assert.ok(curve.curve[100] > 0.69 && curve.curve[100] < 0.72, 'equal-power midpoint is about 0.707, not the linear 0.5');
  near(curve.time, 12.0005);
  assert.equal(curve.duration, 1);
  assert.equal(gainLog(intro).some((e) => e.call === 'cancelAndHoldAtTime' && e.time === 12), true);
  const tail = gainLog(intro).slice(-2);
  assert.deepEqual(tail.map((e) => [e.call, e.value]), [['setValueAtTime', 0.2], ['linearRampToValueAtTime', 0]]);
  near(tail[0].time, 13.0015);
  near(tail[1].time, 13.75);
  assert.equal(standby(), '대기: 4 stop');
  assert.equal(activeNames().length, 2);
});

test('a hit plays without moving standby, and the STOP cue ramps every active cue by its own fade out', async () => {
  await hit(12.2);
  assert.equal(ctx().sources.length, 4);
  const hitSource = ctx().sources[3];
  assert.equal(hitSource.buffer.tag, 'sfx');
  assert.deepEqual(hitSource.starts, [[12.2, 0, 2]]);
  assert.equal(standby(), '대기: 4 stop', 'hits leave standby alone');
  assert.deepEqual(activeNames(), ['1 intro', '2 sfx', '1 hit-sfx']);
  assert.match(byId('timingLine').textContent, /^마지막 소리 시작까지: HIT /);

  await settle(170);
  ctx().currentTime = 12.4;
  await press('ArrowRight');
  const [intro, , sfx] = ctx().sources;
  const lastCurve = (s) => curveCalls(s).at(-1);
  assert.equal(lastCurve(intro).duration, 1, 'the intro fades out over its own 1000 ms');
  assert.equal(lastCurve(sfx).duration, 0.5, 'the stop cue fade (500 ms) applies to the others');
  assert.equal(lastCurve(hitSource).duration, 0.5);
  near(lastCurve(hitSource).time, 12.4005);
  near(lastCurve(hitSource).curve.at(-1), 0, 'the stop ramps to silence');
  near(intro.stops.at(-1)[0], 13.4035, 'the intro source stops after its ramp');
  near(sfx.stops.at(-1)[0], 12.9035);
  near(hitSource.stops.at(-1)[0], 12.9035);
  assert.equal(standby(), '대기: 5 broken');
  endStopped();
  await settle(10);
  assert.deepEqual(activeNames(), []);
});

test('panic works by Escape, by holding the GO key (without a GO), and by the held panic button; a short press only hints', async () => {
  await hit(12.6);
  assert.equal(ctx().sources.length, 5);
  await press('Escape');
  const first = ctx().sources[4];
  assert.equal(curveCalls(first).at(-1).duration, 0.25, 'panic uses the show panic fade');
  near(first.stops.at(-1)[0], 12.8535);
  assert.equal(standby(), '대기: 5 broken', 'panic does not move standby');
  endStopped();

  await hit(12.7);
  const second = ctx().sources[5];
  const generation = playback.runtime.engine.generation;
  await dispatch(document, 'keydown', { code: 'Space', key: ' ', repeat: false });
  await settle(1250);
  assert.equal(playback.runtime.engine.generation, generation + 1, 'holding GO fired PANIC');
  assert.equal(second.stops.length, 1);
  await dispatch(document, 'keyup', { code: 'Space', key: ' ' });
  await settle(5);
  assert.equal(ctx().sources.length, 6, 'the held GO key starts no cue');
  assert.equal(standby(), '대기: 5 broken');
  endStopped();

  await hit(12.8);
  const third = ctx().sources[6];
  await holdButton('panicBtn', 50);
  assert.equal(byId('holdHint').textContent, '길게 누르면 전체 정지합니다.');
  assert.equal(third.stops.length, 0, 'a short press does not stop anything');
  const vibrations = env.calls.vibrate.length;
  await holdButton('panicBtn', 750);
  assert.equal(third.stops.length, 1);
  assert.deepEqual(env.calls.vibrate.length, vibrations + 1);
  assert.equal(env.calls.vibrate.at(-1), 60);
  endStopped();
  await settle(10);
  // The engine drops the ended cue and PANIC's completion must still trigger a render (no card left on screen).
  assert.equal(playback.runtime.engine.active.size, 0);
  assert.deepEqual(activeNames(), [], 'the active list renders empty after panic');
  assert.equal(byId('pendingLine').textContent, '예약된 큐: 0');
});

test('keys are ignored while typing, a held key is dropped on window blur, and a focused button is blurred', async () => {
  byId('textInput').focus();
  const typing = await dispatch(document, 'keydown', { code: 'Space', key: ' ', repeat: false });
  assert.equal(typing.defaultPrevented, false, 'a focused input keeps its keys');
  assert.equal(playback.keyGate.held, null);
  byId('textInput').blur();

  await dispatch(document, 'keydown', { code: 'Space', key: ' ', repeat: false });
  assert.notEqual(playback.keyGate.held, null);
  await dispatch(window, 'blur', { bubbles: false });
  assert.equal(playback.keyGate.held, null, 'blur resets a held key');
  const sources = ctx().sources.length;
  await dispatch(document, 'keyup', { code: 'Space', key: ' ' });
  await settle(5);
  assert.equal(ctx().sources.length, sources);
  assert.equal(standby(), '대기: 5 broken');

  byId('backBtn').focus();
  await press('PageUp');
  assert.equal(document.activeElement, null, 'a focused button is blurred before the key acts');
  assert.equal(standby(), '대기: 4 stop', 'PageUp is BACK');
  await click(byId('backBtn'));
  assert.equal(standby(), '대기: 3 fade');
});

test('the run lock hides the controls until the unlock button is held', async () => {
  await click(byId('lockBtn'));
  assert.equal(byId('lockPanel').hidden, false);
  assert.equal(byId('run').classList.contains('locked'), true);
  await holdButton('unlockBtn', 50);
  assert.equal(byId('holdHint').textContent, '길게 누르면 잠금이 풀립니다.');
  assert.equal(byId('lockPanel').hidden, false, 'a short press keeps the lock');
  await holdButton('unlockBtn', 750);
  assert.equal(byId('lockPanel').hidden, true);
  assert.equal(byId('run').classList.contains('locked'), false);
});

test('the two-finger swipe opens settings during the run: show settings are locked and the timing history lists each start', async () => {
  const onGo = await twoFingerSwipe(byId('goBtn'), 150);
  assert.equal(onGo.defaultPrevented, false);
  assert.equal(byId('settings').open, false, 'a swipe that starts on GO keeps its own meaning');
  await twoFingerSwipe(byId('runStandby'), 40);
  assert.equal(byId('settings').open, false, 'a short swipe does not open settings');
  const move = await twoFingerSwipe(byId('runStandby'), 150);
  assert.equal(move.defaultPrevented, true);
  assert.equal(byId('settings').open, true);
  assert.equal(textOf(byId('perShow').children[0]), '공연 중에는 공연별 설정을 바꿀 수 없어요. 공연을 끝낸 뒤 바꿔 주세요.');
  assert.deepEqual(byId('perShow').children[1].children.map(textOf), [
    'GO: G', '이전: PageUp, 왼쪽, 위 방향키', '전체 정지: P', '히트 1: 없음', '삽입 Encore: 없음',
  ]);
  const history = byId('timingHistory').children.map(textOf);
  assert.equal(history.length, 7, 'three GO starts and four hits');
  assert.match(history[0], /^HIT \d+\.\dms \(출력 20ms, 기본 5ms\) · hit-sfx$/);
  assert.match(history.at(-1), /^GO \d+\.\dms \(출력 20ms, 기본 5ms\) · intro$/);

  byId('goTrigger').value = 'press';
  await dispatch(byId('goTrigger'), 'change');
  assert.deepEqual(JSON.parse(env.localStorage.getItem('kc.prefs')), { fadeCurve: 'equal', goTrigger: 'press' });
  await click(byId('closeSettings'));
});

test('press mode fires GO on key down; fade, stop and audio cues report their problems on the run screen', async () => {
  await settle(170);
  const vibrations = env.calls.vibrate.length;
  const down = await dispatch(document, 'keydown', { code: 'Enter', key: 'Enter', repeat: false });
  await settle(5);
  assert.equal(down.defaultPrevented, true);
  assert.equal(env.calls.vibrate.length, vibrations + 1, 'GO already fired on key down');
  assert.equal(standby(), '대기: 4 stop');
  assert.equal(byId('runError').hidden, false);
  assert.equal(byId('runError').textContent, '재생 중인 대상이 없습니다: 1 intro');
  await dispatch(document, 'keyup', { code: 'Enter', key: 'Enter' });
  await settle(5);
  assert.equal(standby(), '대기: 4 stop', 'key up adds nothing in press mode');

  await settle(170);
  await press('Enter');
  assert.equal(byId('runError').textContent, '재생 중인 대상이 없습니다: 전체 재생');
  assert.equal(standby(), '대기: 5 broken');
  const sources = ctx().sources.length;
  await settle(170);
  await press('Enter');
  assert.equal(byId('runError').textContent, '파일 없음: broken');
  assert.equal(ctx().sources.length, sources, 'an undecodable file creates no source');
  assert.equal(standby(), '대기: 목록 끝');
  assert.deepEqual(await showMod.store.position(showMod.current.id), { standby: { listId: 'main', index: 5 }, stack: [] });
  await settle(170);
  const quiet = env.calls.vibrate.length;
  await press('Enter');
  assert.equal(env.calls.vibrate.length, quiet, 'GO at the end of the list does nothing');
});

test('a lost output device pauses the running cue and GO resumes it; hiding the page does not stop the show', async () => {
  await hit(13);
  const source = ctx().sources.at(-1);
  assert.deepEqual(activeNames(), ['1 hit-sfx']);

  const lock = env.wake.requests.at(-1);
  document.visibilityState = 'hidden';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(lock.released, true);
  assert.equal(source.stops.length, 0, 'hiding the page never stops the show');
  document.visibilityState = 'visible';
  await dispatch(document, 'visibilitychange');
  await settle(5);
  assert.equal(env.wake.requests.at(-1).released, false);

  env.devices.list = [env.devices.list[0]];
  await dispatch(env.mediaDevices, 'devicechange', { bubbles: false });
  await settle(10);
  assert.equal(ctx().suspendCalls, 1);
  assert.equal(ctx().state, 'suspended');
  assert.equal(byId('runPaused').hidden, false);
  assert.equal(byId('runPausedTitle').textContent, '출력 장치가 끊겼어요');
  assert.equal(byId('runPausedNote').textContent, '재생을 멈춰 두었어요. 연결을 확인하고 재개를 누르세요.');
  assert.equal(source.stops.length, 0, 'the cue is paused, not stopped');

  await settle(170);
  const resumes = ctx().resumeCalls;
  await press('Enter');
  await settle(450);
  assert.equal(ctx().resumeCalls, resumes + 1);
  assert.equal(ctx().state, 'running');
  assert.equal(byId('runPaused').hidden, true);
  assert.equal(byId('runNotice').hidden, true);
  assert.deepEqual(activeNames(), ['1 hit-sfx']);
});

test('holding exit ends the show with a short ramp, and starting again continues from the saved standby', async () => {
  const source = ctx().sources.at(-1);
  await holdButton('exitBtn', 50);
  assert.equal(byId('holdHint').textContent, '길게 누르면 공연을 끝냅니다.');
  assert.deepEqual(screens(), ['run']);
  await holdButton('exitBtn', 750);
  assert.deepEqual(screens(), ['editor']);
  assert.equal(playback.runtime, null);
  assert.equal(env.navigator.mediaSession.metadata, null);
  const ramp = gainLog(source).at(-1);
  assert.equal(ramp.call, 'linearRampToValueAtTime');
  assert.equal(ramp.value, 0);
  near(ramp.time - ctx().currentTime, 0.02, 'a 20 ms release ramp');
  // Leaving edit-lock panics first (250 ms show fade), then the engine release retires the track with its 20 ms ramp.
  assert.equal(source.stops.length, 2);
  near(source.stops[0][0], 13.2535, 'panic fade stop');
  near(source.stops[1][0], 13.023, 'release stop');

  await click(byId('startShow'));
  await settle(30);
  assert.deepEqual(screens(), ['run']);
  assert.equal(standby(), '이어서: 목록 끝', 'the saved standby position is used');
  assert.equal(byId('runReady').textContent, '파일 확인 필요: 5 broken');
  await holdButton('exitBtn', 750);
  assert.deepEqual(screens(), ['editor']);
  await click(byId('backToList'));
  assert.deepEqual(screens(), ['home']);
  assert.equal(byId('showList').children.length, 1);
});
