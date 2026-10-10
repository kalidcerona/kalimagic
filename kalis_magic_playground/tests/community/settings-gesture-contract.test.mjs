import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APPS = [
  { file: 'zz10/app.js', html: 'zz10/index.html', kind: 'alter', rotation: true, storage: { 'alter-settings-gesture-guide-v1': 'seen' } },
  { file: 'zz11/app.js', html: 'zz11/index.html', kind: 'spinner', rotation: true, storage: { 'zz11-guide-seen-v2': '1' } },
  { file: 'distribution-snapshots/spinner/app.js', html: 'distribution-snapshots/spinner/index.html', kind: 'spinner', rotation: true, storage: { 'friend-spinner-guide-seen-v2': '1' } },
  { file: 'zz13/app.mjs', html: 'zz13/index.html', kind: 'qr', rotation: true, storage: {} },
  { file: 'distribution-snapshots/qr/app.mjs', html: 'distribution-snapshots/qr/index.html', kind: 'qr', rotation: true, storage: {} },
  { file: 'zz8/contacts.js', html: 'zz8/index.html', kind: 'asrai', rotation: false, storage: { 'asrai.prototype.settings-guide.v1': '1' } },
];

function element(id) {
  const classes = new Set();
  const listeners = new Map();
  const el = {
    id: id || '',
    hidden: false,
    disabled: false,
    open: false,
    textContent: '',
    value: '',
    className: '',
    src: '',
    href: '',
    download: '',
    width: 0,
    height: 0,
    dataset: {},
    attributes: {},
    children: [],
    options: [],
    listeners,
    classes,
    style: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      contains: (name) => classes.has(name),
    },
    addEventListener(type, fn, options) { listeners.set(type, { fn, options }); },
    appendChild(child) { el.children.push(child); return child; },
    append(child) { el.children.push(child); },
    replaceChildren() { el.children = []; },
    removeChild(child) { el.children = el.children.filter((item) => item !== child); return child; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    focus() {},
    remove() {},
    click() {},
    setPointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 290, height: 290, right: 290, bottom: 290 }; },
    getContext() { return { putImageData() {}, clearRect() {}, drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; } }; },
    getAttribute(name) { return Object.hasOwn(el.attributes, name) ? el.attributes[name] : null; },
    setAttribute(name, value) { el.attributes[name] = String(value); },
    showModal() { el.open = true; },
    close() { el.open = false; },
    toBlob(callback) { callback(new Blob(['png'])); },
  };
  Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
  el.style.setProperty = (name, value) => { el.style[name] = value; };
  return el;
}

function installPage(htmlText, storageSeed) {
  const elements = new Map();
  const nodes = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const store = new Map(Object.entries(storageSeed));
  const saved = new Map();
  function replace(name, value) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  function make(id) {
    const el = element(id);
    nodes.push(el);
    if (id) elements.set(id, el);
    return el;
  }
  for (const match of htmlText.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const attrs = {};
    for (const attr of match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
    const el = attrs.id && elements.has(attrs.id) ? elements.get(attrs.id) : make(attrs.id || '');
    el.attributes = { ...el.attributes, ...attrs };
    if (attrs.value !== undefined && attrs.value !== '') el.value = attrs.value;
    if (/(?:^|\s)hidden(?:\s|=|$)/.test(match[2]) && !match[2].includes('aria-hidden') && !match[2].includes('hidden=')) el.hidden = true;
    if (/(?:^|\s)hidden(?:\s|$)/.test(match[2])) el.hidden = true;
    for (const name of (attrs.class || '').split(/\s+/).filter(Boolean)) el.classes.add(name);
    if (attrs.src) el.src = attrs.src;
  }
  const storage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  const mediaFor = (query) => ({
    query,
    matches: /orientation:\s*landscape/.test(query) ? Boolean(mediaFor.landscape) : false,
    addEventListener() {},
    addListener() {},
  });
  mediaFor.landscape = false;
  const windowStub = {
    innerWidth: 390,
    innerHeight: 844,
    navigator: null,
    document: null,
    localStorage: storage,
    sessionStorage: storage,
    isSecureContext: false,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    matchMedia: (query) => mediaFor(query),
    addEventListener(type, fn, options) { windowListeners.set(type, { fn, options }); },
    location: { protocol: 'https:', pathname: '/zz13/' },
  };
  const navigatorStub = {
    userAgent: 'Mozilla/5.0',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    standalone: false,
    vibrate() {},
  };
  windowStub.navigator = navigatorStub;
  const body = make('body');
  const documentStub = {
    hidden: false,
    visibilityState: 'visible',
    documentElement: make('documentElement'),
    body,
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => {
      if (selector.startsWith('#')) return elements.get(selector.slice(1)) || null;
      if (selector.startsWith('.')) return nodes.find((node) => node.classes.has(selector.slice(1))) || null;
      return null;
    },
    createElement: () => make(''),
    createDocumentFragment: () => ({ append() {} }),
    addEventListener(type, fn, options) { documentListeners.set(type, { fn, options }); },
  };
  windowStub.document = documentStub;
  replace('document', documentStub);
  replace('window', windowStub);
  replace('navigator', navigatorStub);
  replace('localStorage', storage);
  replace('sessionStorage', storage);
  replace('location', windowStub.location);
  replace('matchMedia', (query) => mediaFor(query));
  return {
    elements, nodes, documentListeners, windowListeners, window: windowStub, mediaFor, store,
    restore() {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

function touches(points) {
  const list = points.map((point) => ({ identifier: point.id, clientX: point.x, clientY: point.y }));
  list.item = (index) => list[index];
  return list;
}

test('settings gestures require both fingers to travel 96px after the pair forms', async () => {
  for (const app of APPS) {
    const html = readFileSync(new URL(`../../${app.html}`, import.meta.url), 'utf8');
    const page = installPage(html, app.storage);
    const performanceCalls = [];
    try {
      await import(`../../${app.file}?gesture-contract=${encodeURIComponent(app.file)}`);
      const bag = app.kind === 'alter' ? page.elements.get('stage').listeners : page.documentListeners;
      const arrow = page.elements.get('spinner-arrow');
      if (arrow) arrow.animate = () => { performanceCalls.push('spin'); return { cancel() {}, onfinish: null }; };
      const settings = page.elements.get('settings') || page.elements.get('settings-screen');
      const detail = page.elements.get('contact-detail-screen');
      const runtimeNote = page.elements.get('runtime-note');
      const runtimeBefore = runtimeNote ? runtimeNote.textContent : '';
      const opened = () => app.kind === 'qr' ? settings.open === true : settings.hidden === false;
      assert.equal(opened(), false, `${app.file} starts closed`);
      const close = () => {
        if (app.kind === 'qr') settings.open = false;
        else settings.hidden = true;
        if (detail) detail.hidden = true;
        const list = page.elements.get('contact-list-screen');
        if (list) list.hidden = false;
      };
      let prevented = 0;
      const active = new Set();
      const emit = (type, event) => {
        const record = bag.get(type);
        assert.ok(record, `${app.file} listens for ${type}`);
        record.fn(event);
      };
      const moveEvent = (points) => ({
        touches: touches(points),
        changedTouches: touches(points),
        cancelable: true,
        preventDefault() { prevented += 1; },
      });
      function release() {
        if (app.kind === 'qr' || app.channel === 'pointer') {
          for (const id of active) emit('pointerup', { pointerId: id, pointerType: 'touch', clientX: 0, clientY: 0, target: page.elements.get('empty'), button: 0, preventDefault() {} });
        } else {
          emit('touchend', { touches: touches([]), changedTouches: touches([]) });
        }
        active.clear();
        close();
        prevented = 0;
      }
      function runChannel(channel) {
        app.channel = channel;
        const usePointer = channel === 'pointer';
        const down = (points) => {
          if (usePointer) {
            for (const point of points) {
              active.add(point.id);
              emit('pointerdown', { pointerId: point.id, pointerType: 'touch', clientX: point.x, clientY: point.y, target: page.elements.get('empty') || page.elements.get('contact-list'), button: 0, cancelable: true, preventDefault() { prevented += 1; } });
            }
            return;
          }
          for (const point of points) active.add(point.id);
          emit('touchstart', { touches: touches(points), changedTouches: touches(points) });
        };
        const move = (points) => {
          if (usePointer) {
            for (const point of points) emit('pointermove', { pointerId: point.id, pointerType: 'touch', clientX: point.x, clientY: point.y, target: page.elements.get('empty'), cancelable: true, preventDefault() { prevented += 1; } });
            return;
          }
          emit('touchmove', moveEvent(points));
        };
        const cancel = () => {
          if (usePointer) {
            for (const id of [...active]) emit('pointercancel', { pointerId: id, pointerType: 'touch', clientX: 0, clientY: 0, preventDefault() {} });
          } else emit('touchcancel', { touches: touches([]), changedTouches: touches([]) });
          active.clear();
        };
        const pair = (y, x1 = 24, x2 = 90) => [{ id: 1, x: x1, y }, { id: 2, x: x2, y }];
        down(pair(10));
        move(pair(105));
        assert.equal(opened(), false, `${app.file} ${channel} rejects 95px`);
        assert.equal(performanceCalls.length, 0, `${app.file} ${channel} does not perform during recognition`);
        if (detail) assert.equal(detail.hidden, true, `${app.file} contact stays closed`);
        if (runtimeNote) assert.equal(runtimeNote.textContent, runtimeBefore, `${app.file} camera status stays put`);
        move(pair(106));
        assert.equal(opened(), true, `${app.file} ${channel} accepts 96px`);
        release();

        down(pair(10));
        move([{ id: 1, x: 24, y: 210 }, { id: 2, x: 90, y: 10 }]);
        assert.equal(opened(), false, `${app.file} ${channel} rejects a stationary finger`);
        release();

        if (usePointer) {
          down([{ id: 1, x: 24, y: 0 }]);
          move([{ id: 1, x: 24, y: 400 }]);
          down([{ id: 2, x: 90, y: 20 }]);
        } else {
          down([{ id: 1, x: 24, y: 0 }]);
          move([{ id: 1, x: 24, y: 400 }]);
          down([{ id: 1, x: 24, y: 400 }, { id: 2, x: 90, y: 20 }]);
        }
        assert.equal(opened(), false, `${app.file} ${channel} ignores movement before pairing`);
        move([{ id: 1, x: 24, y: 495 }, { id: 2, x: 90, y: 115 }]);
        assert.equal(opened(), false, `${app.file} ${channel} counts 95px only after pairing`);
        move([{ id: 1, x: 24, y: 496 }, { id: 2, x: 90, y: 116 }]);
        assert.equal(opened(), true, `${app.file} ${channel} accepts 96px after pairing`);
        release();

        down([...pair(10), { id: 3, x: 150, y: 10 }]);
        move([{ id: 1, x: 24, y: 210 }, { id: 2, x: 90, y: 210 }, { id: 3, x: 150, y: 210 }]);
        move([{ id: 1, x: 24, y: 220 }, { id: 2, x: 90, y: 220 }]);
        assert.equal(opened(), false, `${app.file} ${channel} rejects a third finger`);
        release();
        down(pair(10));
        move(pair(106));
        assert.equal(opened(), true, `${app.file} ${channel} accepts a later pair after a third finger`);
        release();

        down(pair(10));
        move(pair(90));
        cancel();
        move(pair(220));
        assert.equal(opened(), false, `${app.file} ${channel} cancel resets the gesture`);
        down(pair(10));
        move(pair(106));
        assert.equal(opened(), true, `${app.file} ${channel} accepts a new pair after cancel`);
        release();

        if (usePointer) {
          down([{ id: 7, x: 40, y: 40 }]);
          move([{ id: 7, x: 40, y: 300 }]);
          assert.equal(opened(), false, `${app.file} one pointer does not open settings`);
          assert.equal(prevented, 0, `${app.file} one pointer does not cancel scrolling`);
          release();
        } else {
          const before = prevented;
          down([{ id: 7, x: 40, y: 300 }]);
          move([{ id: 7, x: 40, y: 40 }]);
          assert.equal(opened(), false, `${app.file} one finger does not open settings`);
          assert.equal(prevented, before, `${app.file} one finger does not cancel scrolling`);
          release();
        }

        if (app.rotation) {
          page.window.innerWidth = 844;
          page.window.innerHeight = 390;
          page.mediaFor.landscape = true;
          down(pair(40));
          move([{ id: 1, x: 24 + 120, y: 40 }, { id: 2, x: 90 + 120, y: 40 }]);
          assert.equal(opened(), false, `${app.file} ${channel} rotated layout ignores a sideways swipe`);
          release();
          down(pair(40));
          move(pair(136));
          assert.equal(opened(), true, `${app.file} ${channel} rotated layout accepts visible downward 96px`);
          release();
          page.window.innerWidth = 390;
          page.window.innerHeight = 844;
          page.mediaFor.landscape = false;
        }
      }

      if (app.kind === 'alter' || app.kind === 'spinner') {
        assert.equal(bag.get('touchmove').options.passive, false, `${app.file} keeps passive:false`);
        runChannel('touch');
      } else if (app.kind === 'qr') {
        runChannel('pointer');
        downSafeTouchCancel();
      } else {
        assert.equal(bag.get('pointermove').options.passive, false);
        assert.equal(bag.get('touchmove').options.passive, false);
        runChannel('pointer');
        runChannel('touch');
      }

      function downSafeTouchCancel() {
        app.channel = 'pointer';
        const down = (points) => {
          for (const point of points) {
            active.add(point.id);
            emit('pointerdown', { pointerId: point.id, pointerType: 'touch', clientX: point.x, clientY: point.y, target: page.elements.get('empty'), button: 0, cancelable: true, preventDefault() {} });
          }
        };
        down([{ id: 1, x: 24, y: 10 }, { id: 2, x: 90, y: 10 }]);
        emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 24, clientY: 80, target: page.elements.get('empty'), preventDefault() {} });
        emit('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 90, clientY: 80, target: page.elements.get('empty'), preventDefault() {} });
        emit('touchcancel', { touches: touches([]) });
        emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 24, clientY: 200, target: page.elements.get('empty'), preventDefault() {} });
        emit('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 90, clientY: 200, target: page.elements.get('empty'), preventDefault() {} });
        assert.equal(opened(), false, `${app.file} touchcancel resets the gesture`);
        for (const id of active) emit('pointerup', { pointerId: id, pointerType: 'touch', clientX: 0, clientY: 0, target: page.elements.get('empty'), button: 0, preventDefault() {} });
        active.clear();
      }
    } finally {
      page.restore();
    }
  }
});
