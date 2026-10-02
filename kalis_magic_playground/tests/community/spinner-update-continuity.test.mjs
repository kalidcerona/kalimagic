import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

function installDom({ html, stateKey, guideKey, themeKey, initialState = null, controller = null, registerMode = 'ok', updateMode = 'ok' } = {}) {
  const elements = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const store = new Map();
  store.set(guideKey, '1');
  if (initialState) store.set(stateKey, JSON.stringify(initialState));
  const savedGlobals = new Map();
  const reloads = [];
  const registrations = [];
  const swListeners = [];
  function replace(name, value) {
    savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  function make(id) {
    const listeners = new Map();
    const classes = new Set();
    const el = {
      id,
      hidden: false,
      disabled: false,
      textContent: '',
      value: '',
      dataset: {},
      style: {},
      tagName: 'DIV',
      isContentEditable: false,
      attributes: {},
      getAttribute(name) { return el.attributes[name] ?? null; },
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
        contains: (name) => classes.has(name),
      },
      addEventListener(type, fn) { listeners.set(type, fn); },
      listeners,
      getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 }; },
      setPointerCapture() {},
      closest(selector) { return selector === `#${id}` ? el : null; },
      focus() {},
    };
    elements.set(id, el);
    return el;
  }
  const source = readFileSync(html, 'utf8');
  let stage = null;
  for (const match of source.matchAll(/<([a-z][a-z0-9-]*)\b([^>]+)>/gi)) {
    const attributes = Object.fromEntries(Array.from(match[2].matchAll(/([\w-]+)="([^"]*)"/g), item => [item[1], item[2]]));
    const isStage = (attributes.class || '').split(/\s+/).includes('stage');
    if (!attributes.id && !isStage) continue;
    const el = make(attributes.id || 'stage');
    el.tagName = match[1].toUpperCase();
    el.attributes = attributes;
    el.hidden = /(?:^|\s)hidden(?:\s|$)/.test(match[2]);
    for (const name of (attributes.class || '').split(/\s+/).filter(Boolean)) el.classList.add(name);
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith('data-')) el.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    if (isStage) stage = el;
  }
  assert.ok(stage, 'real HTML provides the stage');
  const documentStub = {
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => (selector === '.stage' ? stage : null),
    addEventListener(type, fn) { documentListeners.set(type, fn); },
    documentElement: make('documentElement'),
    body: make('body'),
    hidden: false,
  };
  const navigatorStub = {
    userAgent: 'Mozilla/5.0',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    vibrate() {},
    serviceWorker: {
      controller,
      addEventListener(type, fn) { swListeners.push({ type, fn }); },
      register(url, options) {
        registrations.push({ url, options });
        if (registerMode === 'throw') throw new Error('register failed');
        if (registerMode === 'reject') return Promise.reject(new Error('register failed'));
        return Promise.resolve({
          update() {
            if (updateMode === 'reject') return Promise.reject(new Error('update failed'));
            return Promise.resolve();
          },
        });
      },
    },
  };
  const windowStub = {
    navigator: navigatorStub,
    matchMedia(query) {
      return { query, matches: false, addEventListener() {}, addListener() {} };
    },
    addEventListener(type, fn) { windowListeners.set(type, fn); },
  };
  replace('document', documentStub);
  replace('window', windowStub);
  replace('navigator', navigatorStub);
  replace('matchMedia', (query) => windowStub.matchMedia(query));
  replace('location', { protocol: 'https:', reload() { reloads.push('reload'); } });
  replace('localStorage', {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(key, String(value)); },
  });
  return {
    elements, documentListeners, stage, store, reloads, registrations, swListeners, stateKey, themeKey,
    dispatchControllerChange() {
      for (const item of swListeners) if (item.type === 'controllerchange') item.fn();
    },
    restore() {
      for (const [name, descriptor] of savedGlobals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

function fire(map, type, event) {
  const fn = map.get(type);
  assert.equal(typeof fn, 'function', `${type} listener is wired`);
  fn(event);
  return event;
}

function pointer(target, x, y, pointerId = 1) {
  return { target, isPrimary: true, pointerId, clientX: x, clientY: y, button: 0 };
}

function savedState(dom) {
  return JSON.parse(dom.store.get(dom.stateKey));
}

async function loadApp(options) {
  const dom = installDom(options);
  await import(`${options.module}?spinner-update=${options.moduleId}`);
  await Promise.resolve();
  return dom;
}

test('service worker updates do not reload a live personal or shared spinner', async () => {
  assert.match(readFileSync(new URL('../../zz11/sw.js', import.meta.url), 'utf8'), /v20261002-4/);
  assert.match(readFileSync(new URL('../../distribution-snapshots/spinner/sw.js', import.meta.url), 'utf8'), /v20261002-release-2/);
  const apps = [
    {
      name: 'personal',
      html: new URL('../../zz11/index.html', import.meta.url),
      module: '../../zz11/app.js',
      stateKey: 'zz11-spinner-state-v2',
      guideKey: 'zz11-guide-seen-v2',
      themeKey: 'zz11-table-theme-v1',
    },
    {
      name: 'shared',
      html: new URL('../../distribution-snapshots/spinner/index.html', import.meta.url),
      module: '../../distribution-snapshots/spinner/app.js',
      stateKey: 'friend-spinner-state-v2',
      guideKey: 'friend-spinner-guide-seen-v2',
      themeKey: 'friend-spinner-table-theme-v1',
    },
  ];
  for (const app of apps) {
    const dom = await loadApp({
      ...app,
      moduleId: `${app.name}-live`,
      controller: { scriptURL: './sw.js' },
      initialState: { targetAngle: 20, forceSpin: 6, spins: 4, previousAngle: 73, rotation: 212 },
    });
    try {
      assert.equal(dom.registrations.length, 1);
      assert.equal(dom.registrations[0].url, './sw.js');
      assert.equal(dom.registrations[0].options.updateViaCache, 'none');
      assert.equal(savedState(dom).targetAngle, null, 'fresh launch still clears the previous secret');
      assert.equal(savedState(dom).spins, 0);
      assert.equal(savedState(dom).forceSpin, 6);
      const wheel = dom.elements.get('wheel-wrap');
      fire(dom.stage.listeners, 'pointerdown', pointer(wheel, 200, 100));
      fire(dom.stage.listeners, 'pointerup', pointer(wheel, 200, 100));
      assert.equal(savedState(dom).targetAngle, 90);
      fire(dom.documentListeners, 'touchstart', { touches: [{ clientY: 0 }, { clientY: 0 }] });
      fire(dom.documentListeners, 'touchmove', { touches: [{ clientY: 80 }, { clientY: 80 }], preventDefault() {} });
      assert.equal(dom.elements.get('settings').hidden, false);
      dom.elements.get('force-spin').value = '7';
      dom.dispatchControllerChange();
      dom.dispatchControllerChange();
      assert.equal(dom.reloads.length, 0);
      assert.equal(dom.registrations.length, 1);
      assert.equal(dom.elements.get('settings').hidden, false);
      assert.equal(dom.elements.get('force-spin').value, '7');
      assert.equal(savedState(dom).targetAngle, 90);
      assert.equal(savedState(dom).spins, 0);
      assert.equal(savedState(dom).forceSpin, 6);
      fire(dom.elements.get('settings-close').listeners, 'click', {});
      const animations = [];
      dom.elements.get('spinner-arrow').animate = (frames, options) => {
        const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; }, onfinish: null };
        animations.push(animation);
        return animation;
      };
      const transform = dom.elements.get('spinner-arrow').style.transform;
      fire(dom.stage.listeners, 'pointerdown', pointer(wheel, 130, 100, 2));
      fire(dom.stage.listeners, 'pointerup', pointer(wheel, 130, 100, 2));
      assert.equal(animations.length, 1);
      assert.equal(dom.elements.get('spin-status').textContent, '회전 중…');
      dom.dispatchControllerChange();
      assert.equal(dom.reloads.length, 0);
      assert.equal(animations[0].cancelled, false);
      assert.equal(dom.elements.get('spinner-arrow').style.transform, transform);
      assert.equal(savedState(dom).targetAngle, 90);
      assert.equal(savedState(dom).spins, 0);
      assert.equal(dom.elements.get('spin-status').textContent, '회전 중…');
      animations[0].onfinish();
      assert.equal(savedState(dom).spins, 1);
      assert.equal(savedState(dom).targetAngle, 90);
      assert.equal(dom.stage.dataset.tableTheme, 'emerald');
    } finally { dom.restore(); }

    const fresh = await loadApp({ ...app, moduleId: `${app.name}-fresh`, controller: null });
    try {
      assert.equal(fresh.registrations.length, 1);
      fresh.dispatchControllerChange();
      assert.equal(fresh.reloads.length, 0);
      assert.equal(savedState(fresh).targetAngle, null);
      assert.equal(savedState(fresh).spins, 0);
      const wheel = fresh.elements.get('wheel-wrap');
      fire(fresh.stage.listeners, 'pointerdown', pointer(wheel, 200, 100));
      fire(fresh.stage.listeners, 'pointerup', pointer(wheel, 200, 100));
      assert.equal(savedState(fresh).targetAngle, 90);
      assert.equal(fresh.registrations.length, 1);
    } finally { fresh.restore(); }
  }

  for (const mode of ['reject', 'throw']) {
    const dom = await loadApp({
      html: new URL('../../zz11/index.html', import.meta.url),
      module: '../../zz11/app.js',
      moduleId: `register-${mode}`,
      stateKey: 'zz11-spinner-state-v2',
      guideKey: 'zz11-guide-seen-v2',
      themeKey: 'zz11-table-theme-v1',
      controller: { scriptURL: './sw.js' },
      registerMode: mode,
    });
    try {
      await Promise.resolve();
      assert.equal(dom.registrations.length, 1);
      assert.equal(dom.reloads.length, 0);
      const wheel = dom.elements.get('wheel-wrap');
      fire(dom.stage.listeners, 'pointerdown', pointer(wheel, 200, 100));
      fire(dom.stage.listeners, 'pointerup', pointer(wheel, 200, 100));
      assert.equal(savedState(dom).targetAngle, 90);
    } finally { dom.restore(); }
  }

  const update = await loadApp({
    html: new URL('../../zz11/index.html', import.meta.url),
    module: '../../zz11/app.js',
    moduleId: 'update-reject',
    stateKey: 'zz11-spinner-state-v2',
    guideKey: 'zz11-guide-seen-v2',
    themeKey: 'zz11-table-theme-v1',
    controller: { scriptURL: './sw.js' },
    updateMode: 'reject',
  });
  try {
    await Promise.resolve();
    update.dispatchControllerChange();
    assert.equal(update.reloads.length, 0);
    assert.equal(update.registrations.length, 1);
    assert.equal(savedState(update).spins, 0);
  } finally { update.restore(); }
});
