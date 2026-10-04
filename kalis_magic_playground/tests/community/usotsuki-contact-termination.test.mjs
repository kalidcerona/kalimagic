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

async function fixture({ theme, store = new Map(), readFails = false, stateReadFails = false, writeFails = false, vibrateSupported = true, rect = { left: 20, top: 180, width: 300, height: 120 } } = {}) {
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
      this.style = {};
      this.dataset = {};
      this.listeners = new Map();
      this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
      this.classList = { add: (...xs) => xs.forEach(x => this.classes.add(x)), remove: (...xs) => xs.forEach(x => this.classes.delete(x)), contains: x => this.classes.has(x), toggle: (x, force) => { const on = force === undefined ? !this.classes.has(x) : force; if (on) this.classes.add(x); else this.classes.delete(x); return on; } };
      for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    dispatch(type, props = {}) { this.listeners.get(type)?.({ target: this, pointerId: 1, clientX: 170, clientY: 240, cancelable: true, preventDefault() {}, ...props }); }
    closest(selector) { return selector === `#${this.id}` ? this : null; }
    getBoundingClientRect() { return rect; }
    setPointerCapture() {}
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() {}
    blur() {}
    append(child) { child.parentElement = this; }
    remove() {}
    querySelector() { return null; }
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
    querySelector(selector) { return selector.startsWith('#') ? nodes.get(selector.slice(1)) || null : all.find(x => x.classes.has(selector.slice(1))) || null; },
    createElement: tag => new FakeElement(tag),
    addEventListener: (type, fn) => documentEvents.set(type, fn),
  };
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const vibrations = [];
  const windowEvents = new Map();
  const win = {
    localStorage: {
      getItem(key) { if ((readFails && key === THEME) || (stateReadFails && key === STATE)) throw new Error('blocked storage'); return store.get(key) ?? null; },
      setItem(key, value) { if (writeFails && key === THEME) throw new Error('blocked storage'); store.set(key, String(value)); },
    },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn) { windowEvents.set(type, fn); },
  };
  const nav = vibrateSupported ? { vibrate: x => { vibrations.push(x); return true; } } : {};
  replace('Element', FakeElement); replace('document', doc); replace('window', win); replace('navigator', nav); replace('performance', { now: () => now });
  await import(`${pathToFileURL(resolve(appDir, 'detector.js')).href}?review=${++serial}`);
  const element = id => { const el = nodes.get(id); assert.ok(el, `${id} exists in actual HTML`); return el; };
  return {
    element, store, rect, timers, vibrations, doc, windowEvents, documentEvents,
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

// Assert physical pointer termination always sends an explicit stop, including after verdict.
for (const theme of ['green', 'wine', 'recorder']) {
  for (const level of ['medium', 'high', 'max']) {
    for (const endEvent of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      for (const elapsed of [100, 500, 800]) {
        test(`${theme}/${level}: ${endEvent} at ${elapsed}ms stops haptics and prevents timer restart`, async () => {
          const f = await fixture({ theme, store: new Map([['usotsuki.detector.vibration.v1', level]]) });
          try {
            f.element('start-performance').dispatch('click');
            f.pointer('pointerdown', 170, 240);
            f.tick(elapsed);
            const expectedAttempts = elapsed >= 500 ? 1 : 0;
            assert.equal(f.state().attemptCount, expectedAttempts);
            const before = f.vibrations.length;
            f.pointer(endEvent, 170, 240);
            assert.ok(f.vibrations.length > before, 'pointer termination sends a new vibrate(0)');
            assert.equal(f.vibrations.at(-1), 0);
            const termination = f.vibrations.length;
            f.tick(5000);
            assert.ok(f.vibrations.slice(termination).every(pulse => pulse === 0), 'later timers never restart vibration');
            assert.equal(f.state().attemptCount, expectedAttempts, 'termination never adds a later attempt');
          } finally { f.restore(); }
        });
      }
    }
  }
}

test('unrelated second pointer end after verdict cannot cancel the held pointer haptics', async () => {
  const f = await fixture({ theme: 'recorder' });
  try {
    f.element('start-performance').dispatch('click');
    f.pointer('pointerdown', 170, 240, 1); f.tick(500);
    f.pointer('pointerdown', 10, 20, 2);
    const before = f.vibrations.length;
    f.pointer('pointerup', 10, 20, 2);
    assert.equal(f.vibrations.length, before);
    f.pointer('pointerup', 170, 240, 1);
    assert.ok(f.vibrations.length > before); assert.equal(f.vibrations.at(-1), 0);
    assert.equal(f.state().attemptCount, 1);
  } finally { f.restore(); }
});

for (const elapsed of [100, 800]) {
  for (const event of ['blur', 'visibilitychange']) {
    test(`${event} at ${elapsed}ms stops vibration and cancels pending scan`, async () => {
      const f = await fixture({ theme: 'recorder' });
      try {
        f.element('start-performance').dispatch('click');
        f.pointer('pointerdown', 170, 240); f.tick(elapsed);
        const before = f.vibrations.length;
        if (event === 'visibilitychange') { f.doc.hidden = true; f.documentEvents.get(event)?.(); }
        else f.windowEvents.get(event)?.();
        assert.ok(f.vibrations.length > before); assert.equal(f.vibrations.at(-1), 0);
        const termination = f.vibrations.length;
        f.tick(5000);
        assert.ok(f.vibrations.slice(termination).every(x => x === 0));
        assert.equal(f.state().attemptCount, elapsed >= 500 ? 1 : 0);
      } finally { f.restore(); }
    });
  }
}

for (const endEvent of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  test(`blank-area ready pulse ${endEvent} stops immediately without a later restart`, async () => {
    const f = await fixture({ theme: 'recorder', store: new Map([['usotsuki.detector.vibration.v1', 'medium']]) });
    try {
      f.element('start-performance').dispatch('click');
      f.pointer('pointerdown', 10, 20);
      assert.ok(f.vibrations.some(x => typeof x === 'number' && x > 0), 'first blank contact produces ready pulse');
      const before = f.vibrations.length;
      f.pointer(endEvent, 10, 20);
      assert.ok(f.vibrations.length > before, 'ready contact termination sends stop');
      assert.equal(f.vibrations.at(-1), 0);
      const termination = f.vibrations.length; f.tick(5000);
      assert.ok(f.vibrations.slice(termination).every(x => x === 0));
      assert.equal(f.state().attemptCount, 0);
    } finally { f.restore(); }
  });
}

test('background clears ready pulse ownership before pointer id reuse', async () => {
  const f = await fixture({ theme: 'recorder', store: new Map([['usotsuki.detector.vibration.v1', 'medium']]) });
  try {
    f.element('start-performance').dispatch('click');
    f.pointer('pointerdown', 10, 20, 1);
    f.doc.hidden = true; f.documentEvents.get('visibilitychange')();
    f.doc.hidden = false; f.documentEvents.get('visibilitychange')();
    f.pointer('pointerdown', 170, 240, 2); f.tick(500);
    f.pointer('pointerdown', 10, 20, 1);
    const before = f.vibrations.length;
    f.pointer('pointerup', 10, 20, 1);
    assert.equal(f.vibrations.length, before, 'stale ready owner never ends an unrelated settled hold');
    assert.equal(f.element('performance-screen').classList.contains('is-live'), true);
    f.pointer('pointerup', 170, 240, 2);
    assert.equal(f.vibrations.at(-1), 0);
    assert.equal(f.element('performance-screen').classList.contains('is-live'), false);
  } finally { f.restore(); }
});
