import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const appDir = resolve(import.meta.dirname, '../../zz7');

const STATE = 'usotsuki.detector.v1';
const THEME = 'usotsuki.detector.theme.v1';
const SCAN = 'usotsuki.detector.scan-duration.v1';
let serial = 0;

async function fixture({ theme, store = new Map(), readFails = false, stateReadFails = false, writeFails = false, vibrateSupported = true, active = true, activationKnown = true, reducedMotion = false, rect = { left: 20, top: 180, width: 300, height: 120 } } = {}) {
  if (theme !== undefined) store.set(THEME, theme);
  if (!store.has(SCAN)) store.set(SCAN, '0.5');
  if (!store.has('usotsuki.detector.sound.v1')) store.set('usotsuki.detector.sound.v1', '0');
  const saved = new Map();
  const replace = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  const nodes = new Map();
  const all = [];
  class FakeElement {
    constructor(tag = 'DIV', attrs = {}) {
      this.tagName = tag.toUpperCase();
      this.attributes = attrs;
      this.id = attrs.id;
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.value = attrs.value || '';
      this.textContent = '';
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.dataset = {};
      this.listeners = new Map();
      this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
      this.classList = { add: (...xs) => xs.forEach(x => this.classes.add(x)), remove: (...xs) => xs.forEach(x => this.classes.delete(x)), contains: x => this.classes.has(x), toggle: (x, force) => { const on = force === undefined ? !this.classes.has(x) : force; if (on) this.classes.add(x); else this.classes.delete(x); return on; } };
      for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
    dispatch(type, props = {}) { for (const fn of this.listeners.get(type) || []) fn({ target: this, pointerId: 1, pointerType: 'touch', isTrusted: true, clientX: 170, clientY: 240, cancelable: true, preventDefault() {}, ...props }); }
    closest(selector) { return selector === `#${this.id}` ? this : null; }
    getBoundingClientRect() { return rect; }
    setPointerCapture() {}
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() {}
    blur() {}
    append(child) { child.parentElement = this; all.push(child); if (child.id) nodes.set(child.id, child); }
    remove() { this.removed = true; }
    querySelector(selector) { return all.find(x => x.parentElement === this && (selector === 'button' ? x.tagName === 'BUTTON' : selector.startsWith('#') ? x.id === selector.slice(1) : x.classes.has(selector.slice(1)))) || null; }
  }
  const html = readFileSync(resolve(appDir, 'index.html'), 'utf8');
  const stack = [];
  for (const match of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const tag = match[2].toLowerCase();
    if (match[1]) { if (stack.at(-1)?.tagName.toLowerCase() === tag) stack.pop(); continue; }
    const attrs = Object.fromEntries(Array.from(match[3].matchAll(/([\w-]+)="([^"]*)"/g), x => [x[1], x[2]]));
    const el = new FakeElement(tag, attrs);
    el.hidden = /(?:^|\s)hidden(?:\s|$)/.test(match[3]);
    el.checked = /(?:^|\s)checked(?:\s|$)/.test(match[3]);
    el.parentElement = stack.at(-1) || null;
    all.push(el);
    if (el.id) { assert.equal(nodes.has(el.id), false, 'actual IDs are unique'); nodes.set(el.id, el); }
    if (!['meta', 'link', 'input', 'img', 'br'].includes(tag) && !match[3].endsWith('/')) stack.push(el);
  }
  const body = all.find(x => x.tagName === 'BODY');
  const documentEvents = new Map();
  const doc = {
    body, hidden: false,
    querySelector(selector) { return selector.split(',').map(x => x.trim()).map(x => x.startsWith('#') ? nodes.get(x.slice(1)) : all.find(el => el.classes.has(x.slice(1)))).find(Boolean) || null; },
    createElement: tag => new FakeElement(tag),
    addEventListener: (type, fn) => documentEvents.set(type, fn),
  };
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const vibrations = [];
  const frames = new Map();
  const raf = fn => { const id = ++nextTimer; frames.set(id, fn); return id; };
  const caf = id => frames.delete(id);
  const windowEvents = new Map();
  const win = { requestAnimationFrame: raf, cancelAnimationFrame: caf, matchMedia: () => ({ matches: reducedMotion, addEventListener() {} }),
    localStorage: {
      getItem(key) { if ((readFails && key === THEME) || (stateReadFails && key === STATE)) throw new Error('blocked storage'); return store.get(key) ?? null; },
      setItem(key, value) { if (writeFails && key === THEME) throw new Error('blocked storage'); store.set(key, String(value)); },
    },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn) { windowEvents.set(type, fn); },
  };
  const activation = { hasBeenActive: active, isActive: active };
  const nav = vibrateSupported ? { vibrate: x => { vibrations.push(x); return activation.hasBeenActive; } } : {};
  if (activationKnown) nav.userActivation = activation;
  replace('requestAnimationFrame', raf); replace('cancelAnimationFrame', caf); replace('matchMedia', win.matchMedia); replace('Element', FakeElement); replace('document', doc); replace('window', win); replace('navigator', nav); replace('performance', { now: () => now });
  await import(`${pathToFileURL(resolve(appDir, 'detector.js')).href}?review=${++serial}`);
  const element = id => { const el = nodes.get(id); assert.ok(el, `${id} exists in actual HTML`); return el; };
  return {
    element, store, rect, timers, frames, vibrations, doc, windowEvents, documentEvents, activation,
    trace: () => all.find(x => x.classes.has('signal-trace')),
    optional: id => nodes.get(id) || null,
    frame(ms = 16) { now += ms; const batch = [...frames.entries()]; frames.clear(); for (const [, fn] of batch) fn(now); },
    activateClick(id) { activation.hasBeenActive = true; activation.isActive = true; element(id).dispatch('click'); },
    state: () => JSON.parse(store.get(STATE)),
    theme(value) { element('display-theme').value = value; element('display-theme').dispatch('change'); },
    pointer(type, x, y, id = 1, target = element('performance-screen')) { element('performance-screen').dispatch(type, { target, clientX: x, clientY: y, pointerId: id }); },
    tick(ms) {
      const end = now + ms;
      for (let i = 0; i < 100; i++) {
        const ready = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!ready) break;
        now = ready[1].at; timers.delete(ready[0]); ready[1].fn();
      }
      now = end;
    },
    restore() { for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } },
  };
}


for (const endEvent of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'visibilitychange']) {
  test(`recorder geometry evolves during contact and RAF stops on ${endEvent}`, async () => {
    const f = await fixture({ theme: 'recorder', store: new Map([['usotsuki.detector.vibration.v1', 'high']]) });
    try {
      f.pointer('pointerdown', 170, 240);
      assert.equal(f.frames.size, 1, 'exactly one frame is scheduled');
      const paths = new Set([f.trace().getAttribute('d')]);
      for (let i = 0; i < 12; i++) {
        f.frame(25);
        paths.add(f.trace().getAttribute('d'));
        assert.equal(f.frames.size, 1, 'animation stays bounded to one pending frame');
      }
      assert.ok(paths.size > 3, 'actual SVG geometry changes repeatedly');
      for (const d of paths) {
        assert.ok(d && !/NaN|Infinity/.test(d), 'path coordinates remain finite');
        const numbers = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(x => Number(x[0]));
        assert.ok(numbers.length >= 20, 'trace contains a waveform, not a moving marker');
      }
      // A verdict is allowed while the original finger is still held.
      f.tick(500);
      assert.equal(f.state().attemptCount, 1);
      const settledPath = f.trace().getAttribute('d');
      f.frame(33);
      assert.notEqual(f.trace().getAttribute('d'), settledPath, 'trace continues after verdict until physical termination');
      if (endEvent === 'visibilitychange') { f.doc.hidden = true; f.documentEvents.get(endEvent)?.(); }
      else if (endEvent === 'blur') f.windowEvents.get(endEvent)?.();
      else f.pointer(endEvent, 170, 240);
      assert.equal(f.frames.size, 0, 'termination cancels the pending frame');
      const stopped = f.trace().getAttribute('d');
      const stopIndex = f.vibrations.length;
      f.frame(300); f.tick(5000);
      assert.equal(f.trace().getAttribute('d'), stopped, 'ended contact never redraws');
      assert.equal(f.frames.size, 0);
      assert.ok(f.vibrations.slice(stopIndex).every(x => x === 0), 'ended contact never restarts haptics');
    } finally { f.restore(); }
  });
}

test('fresh touch requires an explicit activation tap before starting a counted hold', async () => {
  const f = await fixture({ theme: 'recorder', active: false, store: new Map([['usotsuki.detector.vibration.v1', 'high']]) });
  try {
    assert.match(f.element('test-indicator').textContent, /터치.*준비/, 'fresh document shows sensor readiness instruction');
    f.pointer('pointerdown', 170, 240); f.tick(1000);
    assert.equal(f.state().attemptCount, 0, 'unarmed touch cannot silently consume a round');
    assert.equal(f.frames.size, 0, 'unarmed touch does not start ECG');
    assert.ok(f.vibrations.every(x => x === 0), 'no knowingly rejected haptic request is made before activation');
    const beforeLift = f.vibrations.length;
    f.activation.hasBeenActive = true; f.activation.isActive = true;
    f.pointer('pointerup', 170, 240);
    assert.equal(f.element('test-indicator').textContent, '검사 대기 중');
    assert.ok(f.vibrations.slice(beforeLift).every(x => x === 0), 'primer lift never starts vibration');
    f.pointer('pointerdown', 170, 240);
    assert.ok(f.vibrations.some(x => Array.isArray(x) || x > 0), 'next actual hold requests vibration');
    assert.equal(f.frames.size, 1);
    f.pointer('pointerup', 170, 240);
    assert.equal(f.vibrations.at(-1), 0, 'lifting stops vibration');
    assert.equal(f.state().attemptCount, 0);
  } finally { f.restore(); }
});

for (const config of [
  { label: 'off', vibrateSupported: true, level: 'off' },
  { label: 'unsupported API', vibrateSupported: false, level: 'high' },
  { label: 'unknown activation API', vibrateSupported: true, activationKnown: false, level: 'high' },
]) {
  test(`${config.label} does not block touch behind arming`, async () => {
    const f = await fixture({ theme: 'recorder', active: false, ...config, store: new Map([['usotsuki.detector.vibration.v1', config.level]]) });
    try {
      assert.doesNotMatch(f.element('test-indicator').textContent, /터치.*준비/);
      f.pointer('pointerdown', 170, 240); f.tick(500);
      assert.equal(f.state().attemptCount, 1);
      f.pointer('pointerup', 170, 240);
      assert.equal(f.frames.size, 0);
    } finally { f.restore(); }
  });
}

for (const theme of ['green', 'wine']) {
  test(`${theme} holds retain verdict timing without recorder RAF`, async () => {
    const f = await fixture({ theme });
    try {
      f.pointer('pointerdown', 170, 240); f.tick(499);
      assert.equal(f.state().attemptCount, 0);
      assert.equal(f.frames.size, 0);
      f.tick(1); assert.equal(f.state().attemptCount, 1);
      f.pointer('pointerup', 170, 240);
    } finally { f.restore(); }
  });
}

test('movement cancellation stops ECG and cannot count a delayed attempt', async () => {
  const f = await fixture({ theme: 'recorder' });
  try {
    f.pointer('pointerdown', 170, 240); f.frame(30);
    f.pointer('pointermove', 300, 370);
    assert.equal(f.frames.size, 0);
    assert.equal(f.element('test-indicator').textContent, '취소됨');
    const d = f.trace().getAttribute('d'); f.frame(100); f.tick(5000);
    assert.equal(f.trace().getAttribute('d'), d);
    assert.equal(f.state().attemptCount, 0);
  } finally { f.restore(); }
});

test('repeated recorder contacts never accumulate RAF callbacks', async () => {
  const f = await fixture({ theme: 'recorder' });
  try {
    for (let i = 0; i < 12; i++) {
      f.pointer('pointerdown', 170, 240); f.frame(20);
      assert.equal(f.frames.size, 1);
      f.pointer('pointerup', 170, 240);
      assert.equal(f.frames.size, 0);
    }
    assert.equal(f.state().attemptCount, 0);
  } finally { f.restore(); }
});

for (const level of ['medium', 'high', 'max']) {
  test(`unsupported API blank contact is safe with saved ${level} preference`, async () => {
    const f = await fixture({ theme: 'recorder', vibrateSupported: false, store: new Map([['usotsuki.detector.vibration.v1', level]]) });
    try {
      assert.doesNotThrow(() => f.pointer('pointerdown', 10, 20));
      f.pointer('pointerup', 10, 20);
      assert.equal(f.state().attemptCount, 0);
    } finally { f.restore(); }
  });
}

test('visibility cancellation clears primer ownership before pointer id reuse', async () => {
  const f = await fixture({ theme: 'recorder', active: false, store: new Map([['usotsuki.detector.vibration.v1', 'high']]) });
  try {
    f.pointer('pointerdown', 170, 240, 1);
    f.doc.hidden = true; f.documentEvents.get('visibilitychange')();
    f.doc.hidden = false;
    f.activation.hasBeenActive = true;
    f.documentEvents.get('click')?.();
    f.pointer('pointerdown', 170, 240, 1); f.tick(100);
    f.pointer('pointerup', 170, 240, 1);
    assert.equal(f.frames.size, 0, 'reused id terminates new hold rather than stale primer');
    f.tick(5000);
    assert.equal(f.state().attemptCount, 0, 'early lifted actual contact cannot become a verdict');
  } finally { f.restore(); }
});

test('palette switch away from recorder cancels recorder RAF and restores common trace', async () => {
  const f = await fixture({ theme: 'recorder' });
  try {
    const rest = f.trace().getAttribute('d');
    f.pointer('pointerdown', 170, 240); f.frame(40);
    assert.notEqual(f.trace().getAttribute('d'), rest);
    f.theme('wine');
    assert.equal(f.frames.size, 0);
    assert.equal(f.trace().getAttribute('d'), rest);
    f.frame(100); assert.equal(f.trace().getAttribute('d'), rest);
    f.pointer('pointerup', 170, 240);
  } finally { f.restore(); }
});

test('reduced motion contact paints a finite static ECG without RAF', async () => {
  const f = await fixture({ theme: 'recorder', reducedMotion: true });
  try {
    const rest = f.trace().getAttribute('d');
    f.pointer('pointerdown', 170, 240);
    const live = f.trace().getAttribute('d');
    assert.notEqual(live, rest);
    assert.doesNotMatch(live, /NaN|Infinity/);
    assert.equal(f.frames.size, 0);
    f.frame(100); assert.equal(f.trace().getAttribute('d'), live);
    f.pointer('pointerup', 170, 240);
    assert.equal(f.trace().getAttribute('d'), rest);
  } finally { f.restore(); }
});

for (const end of ['pointercancel', 'lostpointercapture']) {
  test(`fresh primer ${end} allows a new activation and hold without stale ownership`, async () => {
    const f = await fixture({ theme: 'recorder', active: false, store: new Map([['usotsuki.detector.vibration.v1', 'high']]) });
    try {
      f.pointer('pointerdown', 170, 240, 1); f.pointer(end, 170, 240, 1);
      f.activation.hasBeenActive = true; f.documentEvents.get('click')?.();
      assert.equal(f.element('test-indicator').textContent, '검사 대기 중');
      f.pointer('pointerdown', 170, 240, 1); f.tick(100); f.pointer('pointerup', 170, 240, 1);
      assert.equal(f.frames.size, 0); f.tick(5000); assert.equal(f.state().attemptCount, 0);
    } finally { f.restore(); }
  });
}

test('second pointer ending during fresh primer never creates an attempt or haptic restart', async () => {
  const f = await fixture({ theme: 'recorder', active: false, store: new Map([['usotsuki.detector.vibration.v1', 'high']]) });
  try {
    f.pointer('pointerdown', 170, 240, 1); f.pointer('pointerdown', 10, 20, 2);
    f.activation.hasBeenActive = true;
    f.pointer('pointerup', 10, 20, 2); f.pointer('pointerup', 170, 240, 1);
    assert.equal(f.state().attemptCount, 0); assert.equal(f.frames.size, 0);
    assert.ok(f.vibrations.every(x => x === 0));
    f.pointer('pointerdown', 170, 240, 1); f.tick(100); f.pointer('pointerup', 170, 240, 1);
    f.tick(1000); assert.equal(f.state().attemptCount, 0); assert.equal(f.frames.size, 0);
  } finally { f.restore(); }
});

test('fresh preparation preserves two-finger settings entry and subsequent performance', async () => {
  const f = await fixture({ theme: 'recorder', active: false, store: new Map([['usotsuki.detector.vibration.v1', 'high']]) });
  try {
    f.pointer('pointerdown', 10, 10, 1); f.pointer('pointerdown', 350, 10, 2);
    f.pointer('pointermove', 10, 120, 1); f.pointer('pointermove', 350, 120, 2);
    assert.equal(f.element('settings-screen').hidden, false);
    assert.equal(f.frames.size, 0); assert.equal(f.state().attemptCount, 0);
    f.activateClick('start-performance');
    assert.equal(f.element('settings-screen').hidden, true);
    f.pointer('pointerdown', 170, 240, 1); f.tick(100); f.pointer('pointerup', 170, 240, 1);
    assert.equal(f.frames.size, 0); f.tick(1000); assert.equal(f.state().attemptCount, 0);
  } finally { f.restore(); }
});
