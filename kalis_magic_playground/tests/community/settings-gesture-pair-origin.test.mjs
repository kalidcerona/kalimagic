import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const saved = new Map();
function replace(name, value) {
  if (!saved.has(name)) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
function restore() {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  saved.clear();
}
async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    const batch = frames.splice(0);
    for (const fn of batch) fn(0);
  }
}
const frames = [];

function context2d() {
  return new Proxy(Object.create(null), {
    get: () => () => {},
    set: () => true,
  });
}

function installAletheia(htmlText) {
  const nodes = new Map();
  class El {
    constructor(tag = 'div', attrs = {}) {
      this.tagName = tag.toUpperCase();
      this.attributes = { ...attrs };
      this.id = attrs.id || '';
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.value = attrs.value || '';
      this.textContent = '';
      this.style = {};
      this.dataset = {};
      this.children = [];
      this.listeners = new Map();
      this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
      this.classList = {
        add: (...names) => names.forEach((name) => this.classes.add(name)),
        remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        contains: (name) => this.classes.has(name),
      };
      if (this.id) nodes.set(this.id, this);
    }
    set className(value) {
      this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
    }
    get className() { return [...this.classes].join(' '); }
    get lastElementChild() { return this.children[this.children.length - 1] || null; }
    addEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      list.push(fn);
      this.listeners.set(type, list);
    }
    append(...kids) {
      for (const kid of kids.flat()) {
        if (!kid) continue;
        kid.parentElement = this;
        this.children.push(kid);
      }
    }
    querySelector(selector) {
      for (const child of this.children) {
        if (selector.startsWith('.') && child.classes.has(selector.slice(1))) return child;
        if (selector.startsWith('#') && child.id === selector.slice(1)) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    contains(node) { return node === this || this.children.some((child) => child.contains?.(node)); }
    replaceChildren(...kids) { this.children = []; this.append(...kids); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() {}
    setPointerCapture() {}
    releasePointerCapture() {}
    getContext() { return context2d(); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 700, right: 390, bottom: 700 }; }
  }
  for (const match of htmlText.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const attrs = {};
    for (const attr of match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
    const el = nodes.has(attrs.id) && attrs.id ? nodes.get(attrs.id) : new El(match[1], attrs);
    if (/(?:^|\s)hidden(?:\s|$)/.test(match[2]) && !match[2].includes('aria-hidden')) el.hidden = true;
  }
  const body = [...nodes.values()].find((el) => el.tagName === 'BODY') || new El('body');
  const documentStub = {
    title: '',
    hidden: false,
    body,
    documentElement: new El('html'),
    getElementById: (id) => nodes.get(id) || null,
    querySelector(selector) {
      if (selector.startsWith('#')) return nodes.get(selector.slice(1)) || null;
      if (selector.startsWith('.')) return [...nodes.values()].find((el) => el.classes.has(selector.slice(1))) || null;
      if (selector.startsWith('meta')) return [...nodes.values()].find((el) => el.tagName === 'META' && el.attributes.name === 'theme-color') || null;
      return null;
    },
    createElement: (tag) => new El(tag),
    createDocumentFragment: () => new El('fragment'),
    addEventListener() {},
  };
  const windowStub = {
    document: documentStub,
    devicePixelRatio: 1,
    localStorage: null,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
  };
  const storage = {
    getItem: (key) => storage.map.has(key) ? storage.map.get(key) : null,
    setItem: (key, value) => { storage.map.set(key, String(value)); },
    removeItem: (key) => { storage.map.delete(key); },
    map: new Map(),
  };
  windowStub.localStorage = storage;
  replace('document', documentStub);
  replace('window', windowStub);
  replace('localStorage', storage);
  replace('navigator', { userAgent: 'test', maxTouchPoints: 2 });
  replace('indexedDB', { open() { throw new Error('idb unavailable'); } });
  replace('requestAnimationFrame', (fn) => { frames.push(fn); return frames.length; });
  replace('cancelAnimationFrame', () => {});
  return {
    elements: nodes,
    emit(type, event) {
      for (const fn of (nodes.get('stage-canvas').listeners.get(type) || [])) fn(event);
    },
  };
}

function pointerEvent(id, x, y) {
  return {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    button: 0,
    cancelable: true,
    preventDefault() {},
  };
}

async function bootAletheia(route) {
  const html = readFileSync(new URL(`../../${route}/index.html`, import.meta.url), 'utf8');
  const page = installAletheia(html);
  await import(`../../${route}/app.js?pair-origin=${encodeURIComponent(route)}`);
  await flush();
  const settings = page.elements.get('settings');
  const error = page.elements.get('error');
  assert.equal(settings.hidden, true, `${route} performance did not start: ${error ? error.textContent : ''}`);
  const restart = async () => {
    for (const fn of page.elements.get('card-start-button').listeners.get('click') || []) fn({ preventDefault() {} });
    await flush();
    assert.equal(settings.hidden, true, `${route} did not return to performance`);
  };
  return { page, settings, restart };
}

async function exerciseAletheia(route) {
  const { page, settings, restart } = await bootAletheia(route);
  const opened = () => settings.hidden === false;
  const down = (id, x, y) => page.emit('pointerdown', pointerEvent(id, x, y));
  const move = (id, x, y) => page.emit('pointermove', pointerEvent(id, x, y));
  const up = (id) => page.emit('pointerup', pointerEvent(id, 0, 0));

  down(1, 24, 10);
  down(2, 90, 10);
  move(1, 24, 105);
  move(2, 90, 105);
  assert.equal(opened(), false, `${route} rejects 95px`);
  move(1, 24, 106);
  move(2, 90, 106);
  assert.equal(opened(), true, `${route} accepts 96px`);
  up(1); up(2);
  await restart();

  down(1, 24, 10);
  down(2, 90, 10);
  move(1, 24, 210);
  assert.equal(opened(), false, `${route} rejects a stationary finger`);
  up(1); up(2);

  down(1, 24, 0);
  move(1, 24, 400);
  down(2, 90, 20);
  assert.equal(opened(), false, `${route} ignores movement before pairing`);
  move(1, 24, 495);
  move(2, 90, 115);
  assert.equal(opened(), false, `${route} counts 95px only after pairing`);
  move(1, 24, 496);
  move(2, 90, 116);
  assert.equal(opened(), true, `${route} accepts 96px after pairing`);
}

function installUsotsuki(htmlText) {
  const nodes = new Map();
  const all = [];
  const rect = { left: 20, top: 180, width: 300, height: 120 };
  class El {
    constructor(tag = 'div', attrs = {}) {
      this.tagName = String(tag).toUpperCase();
      this.attributes = attrs;
      this.id = attrs.id || '';
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.value = attrs.value || '';
      this.textContent = '';
      this.style = {};
      this.dataset = {};
      this.listeners = new Map();
      this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
      this.classList = {
        add: (...names) => names.forEach((name) => this.classes.add(name)),
        remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        contains: (name) => this.classes.has(name),
      };
      this.parentElement = null;
      for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      }
    }
    addEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      list.push(fn);
      this.listeners.set(type, list);
    }
    dispatch(type, props = {}) {
      const event = {
        target: this, pointerId: 1, pointerType: 'touch', isTrusted: true,
        clientX: 170, clientY: 240, button: 0, cancelable: true, preventDefault() {}, ...props,
      };
      for (const fn of this.listeners.get(type) || []) fn(event);
    }
    closest(selector) { return selector === `#${this.id}` ? this : null; }
    getBoundingClientRect() { return rect; }
    setPointerCapture() {}
    releasePointerCapture() {}
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() {}
    blur() {}
    append(child) { child.parentElement = this; all.push(child); if (child.id) nodes.set(child.id, child); }
    remove() {}
    querySelector() { return null; }
  }
  const stack = [];
  for (const match of htmlText.matchAll(/<(\/)?([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const tag = match[2].toLowerCase();
    if (match[1]) {
      if (stack.at(-1)?.tagName.toLowerCase() === tag) stack.pop();
      continue;
    }
    const attrs = Object.fromEntries([...match[3].matchAll(/([\w-]+)="([^"]*)"/g)].map((item) => [item[1], item[2]]));
    const el = new El(tag, attrs);
    el.hidden = /(?:^|\s)hidden(?:\s|$)/.test(match[3]);
    el.checked = /(?:^|\s)checked(?:\s|$)/.test(match[3]);
    el.parentElement = stack.at(-1) || null;
    all.push(el);
    if (el.id) nodes.set(el.id, el);
    if (!['meta', 'link', 'input', 'img', 'br', 'source'].includes(tag) && !match[3].endsWith('/')) stack.push(el);
  }
  const store = new Map([
    ['usotsuki.detector.v1', JSON.stringify({ version: 1, attemptCount: 0, settings: { truthAttempts: [4] } })],
    ['usotsuki.distribution.detector.v1', JSON.stringify({ version: 1, attemptCount: 0, settings: { truthAttempts: [4] } })],
    ['usotsuki.detector.sound.v1', '0'],
    ['usotsuki.distribution.detector.sound.v1', '0'],
    ['usotsuki.detector.vibration.v1', 'off'],
    ['usotsuki.detector.scan-duration.v1', '0.5'],
    ['usotsuki.detector.theme.v1', 'green'],
    ['usotsuki.distribution.detector.theme.v1', 'green'],
  ]);
  const documentEvents = new Map();
  const doc = {
    body: all.find((el) => el.tagName === 'BODY') || new El('body'),
    hidden: false,
    documentElement: new El('html'),
    querySelector(selector) {
      if (selector.startsWith('#')) return nodes.get(selector.slice(1)) || null;
      if (selector.startsWith('.')) return all.find((el) => el.classes.has(selector.slice(1))) || null;
      return null;
    },
    createElement: (tag) => new El(tag),
    addEventListener: (type, fn) => documentEvents.set(type, fn),
  };
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const win = {
    document: doc,
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    },
    requestAnimationFrame(fn) { const id = ++nextTimer; frames.push(fn); return id; },
    cancelAnimationFrame() {},
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  };
  replace('Element', El);
  replace('document', doc);
  replace('window', win);
  replace('navigator', {});
  replace('performance', { now: () => now });
  return {
    element: (id) => nodes.get(id),
    tick(ms) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + 10);
        for (const [id, job] of [...timers]) if (job.at <= now) { timers.delete(id); job.fn(); }
      }
    },
  };
}

async function exerciseUsotsuki(route) {
  const html = readFileSync(new URL(`../../${route}/index.html`, import.meta.url), 'utf8');
  const page = installUsotsuki(html);
  await import(`../../${route}/detector.js?pair-origin=${encodeURIComponent(route)}`);
  await flush();
  const screen = page.element('performance-screen');
  const settings = page.element('settings-screen');
  assert.equal(settings.hidden, true, `${route} starts on the performance screen`);
  const opened = () => settings.hidden === false;
  const down = (id, x, y) => screen.dispatch('pointerdown', { pointerId: id, clientX: x, clientY: y });
  const move = (id, x, y) => screen.dispatch('pointermove', { pointerId: id, clientX: x, clientY: y });
  const restart = () => page.element('start-performance').dispatch('click');

  down(1, 24, 10);
  down(2, 90, 10);
  move(1, 24, 105);
  move(2, 90, 105);
  assert.equal(opened(), false, `${route} rejects 95px`);
  move(1, 24, 106);
  move(2, 90, 106);
  assert.equal(opened(), true, `${route} accepts 96px`);
  restart();
  assert.equal(opened(), false, `${route} returns to performance`);

  down(1, 24, 10);
  down(2, 90, 10);
  move(1, 24, 210);
  assert.equal(opened(), false, `${route} rejects a stationary finger`);
  screen.dispatch('pointerup', { pointerId: 1, clientX: 24, clientY: 210 });
  screen.dispatch('pointerup', { pointerId: 2, clientX: 90, clientY: 10 });

  down(1, 24, 0);
  move(1, 24, 400);
  down(2, 90, 20);
  assert.equal(opened(), false, `${route} ignores movement before pairing`);
  move(1, 24, 495);
  move(2, 90, 115);
  assert.equal(opened(), false, `${route} counts 95px only after pairing`);
  move(1, 24, 496);
  move(2, 90, 116);
  assert.equal(opened(), true, `${route} accepts 96px after pairing`);
}

test('ALETHEIA and USOTSUKI count 96px only after the touch pair forms', async () => {
  try {
    for (const route of ['zz5', 'distribution-snapshots/aletheia']) await exerciseAletheia(route);
  } finally {
    restore();
  }
  try {
    for (const route of ['zz7', 'distribution-snapshots/usotsuki']) await exerciseUsotsuki(route);
  } finally {
    restore();
  }
});
