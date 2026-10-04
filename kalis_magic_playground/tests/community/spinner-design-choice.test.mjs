import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { angularDistance } from '../../zz11/logic.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const appDir = resolve(import.meta.dirname, '../../zz11');

function installDom({ guideSeen = true, finePointer = true, initialState = null, initialTheme, initialDesign, storageReadFails = false, storageWriteFails = false, reducedMotion = false, sharedStore = null } = {}) {
  const elements = new Map();
  const allElements = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const mediaQueries = [];
  const store = sharedStore || new Map();
  if (initialDesign !== undefined) store.set('zz11-screen-design-v1', initialDesign);
  if (initialTheme !== undefined) store.set('zz11-table-theme-v1', initialTheme);
  if (guideSeen) store.set('zz11-guide-seen-v2', '1');
  if (initialState) store.set('zz11-spinner-state-v2', JSON.stringify(initialState));
  const savedGlobals = new Map();
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
      get src() { return el.attributes.src || ''; },
      set src(value) { el.attributes.src = value; },
      setPointerCapture() {},
      appendChild(child) { child.parentElement = el; return child; },
      closest(selector) { return selector === `#${id}` ? el : null; },
      focus() {},
    };
    elements.set(id, el);
    allElements.push(el);
    return el;
  }
  const html = readFileSync(resolve(appDir, 'index.html'), 'utf8');
  let stage = null;
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]+)>/gi)) {
    const attributes = Object.fromEntries(Array.from(match[2].matchAll(/([\w-]+)="([^"]*)"/g), item => [item[1], item[2]]));
    const isStage = (attributes.class || '').split(/\s+/).includes('stage');

    const el = make(attributes.id || (isStage ? 'stage' : `anon-${allElements.length}`));
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
    querySelector: (selector) => selector === '.stage' ? stage : selector.startsWith('.') ? allElements.find(el => el.classList.contains(selector.slice(1))) || null : null,
    addEventListener(type, fn) { documentListeners.set(type, fn); },
    documentElement: make('documentElement'),
    body: make('body'),
    hidden: false,
  };
  documentStub.body.tagName = 'BODY';
  const windowStub = {
    navigator: { userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 0, vibrate() {} },
    matchMedia(query) {
      const media = {
        query,
        matches: query.includes('prefers-reduced-motion') ? reducedMotion : finePointer && query.includes('any-pointer') && query.includes('any-hover'),
        addEventListener(type, fn) { if (type === 'change') media.onChange = fn; },
        addListener(fn) { media.onChange = fn; },
      };
      mediaQueries.push(media);
      return media;
    },
    addEventListener(type, fn) { windowListeners.set(type, fn); },
  };
  replace('document', documentStub);
  replace('window', windowStub);
  replace('navigator', windowStub.navigator);
  replace('matchMedia', (query) => windowStub.matchMedia(query));
  replace('localStorage', {
    getItem: (key) => { if (storageReadFails && ['zz11-table-theme-v1','zz11-screen-design-v1'].includes(key)) throw new Error('Storage unavailable'); return store.has(key) ? store.get(key) : null; },
    setItem: (key, value) => { if (storageWriteFails && ['zz11-table-theme-v1','zz11-screen-design-v1'].includes(key)) throw new Error('Storage unavailable'); store.set(key, String(value)); },
  });
  return {
    elements, documentListeners, windowListeners, mediaQueries, store, stage, html,
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

function savedState(store) {
  assert.equal(store.has('zz11-spinner-state-v2'), true);
  return JSON.parse(store.get('zz11-spinner-state-v2'));
}

function assertCornerCue(dom, cue) {
  const acknowledged = cue === 'acknowledged';
  for (const id of ['target-corner-left', 'target-corner-right']) {
    const corner = dom.elements.get(id);
    assert.ok(corner, `${id} exists in actual HTML`);
    assert.equal(corner.dataset.targetCue, cue);
    assert.equal(corner.classList.contains('is-acknowledged'), acknowledged);
    assert.equal(corner.getAttribute('aria-hidden'), 'true');
  }
  assert.equal(dom.stage.dataset.targetCue, cue);
  assert.equal(dom.elements.get('wheel-wrap').dataset.targetCue, cue);
  assert.equal(dom.elements.get('wheel-wrap').classList.contains('target-cue-acknowledged'), acknowledged);
  for (const id of ['table-corner-left', 'table-corner-right']) {
    const corner = dom.elements.get(id);
    assert.ok(corner, `${id} exists in actual HTML`);
    assert.equal(corner.getAttribute('aria-hidden'), 'true');
    assert.equal(corner.classList.contains('is-acknowledged'), false);
    assert.equal(corner.dataset.targetCue, undefined);
  }
  assert.equal(dom.elements.has('green-sector-core'), false, 'obsolete cue is absent from the real DOM');
}

async function loadSpinner(options) {
  const dom = installDom(options);
  await import(`${pathToFileURL(resolve(appDir, 'app.js')).href}?review=${options.moduleId}`);
  return dom;
}

test('table theme validates stored palettes and tolerates missing or unavailable storage', async () => {
  const cases = [
    { moduleId: 'theme-default', expected: 'emerald' },
    { moduleId: 'theme-emerald', initialTheme: 'emerald', expected: 'emerald' },
    { moduleId: 'theme-burgundy', initialTheme: 'burgundy', expected: 'burgundy' },
    { moduleId: 'theme-invalid', initialTheme: 'invalid-theme', expected: 'emerald' },
    { moduleId: 'theme-empty', initialTheme: '', expected: 'emerald' },
    { moduleId: 'theme-unreadable', initialTheme: 'burgundy', storageReadFails: true, expected: 'emerald' },
  ];
  for (const options of cases) {
    const dom = await loadSpinner(options);
    try {
      assert.equal(dom.stage.dataset.tableTheme, options.expected);
      assert.equal(dom.elements.get('table-theme').value, options.expected);
      assertCornerCue(dom, 'idle');
    } finally { dom.restore(); }
  }
  const dom = await loadSpinner({ moduleId: 'theme-unwritable', storageWriteFails: true });
  try {
    fire(dom.elements.get('table-theme').listeners, 'change', { target: { value: 'burgundy' } });
    assert.equal(dom.stage.dataset.tableTheme, 'burgundy', 'storage failure keeps the selected table usable');
    assert.equal(dom.store.has('zz11-table-theme-v1'), false);
    assert.equal(savedState(dom.store).targetAngle, null);
  } finally { dom.restore(); }
});

test('table theme preserves the round and wheel position, survives restart and relaunch', async () => {
  const store = new Map();
  const dom = await loadSpinner({ moduleId: 'theme-state', sharedStore: store,
    initialState: { targetAngle: 20, forceSpin: 6, spins: 2, previousAngle: 73, rotation: 212 } });
  try {
    const wheel = dom.elements.get('wheel-wrap');
    fire(dom.stage.listeners, 'pointerdown', pointer(wheel, 200, 100));
    fire(dom.stage.listeners, 'pointerup', pointer(wheel, 200, 100));
    const before = savedState(store);
    assert.equal(before.targetAngle, 90);
    assertCornerCue(dom, 'acknowledged');
    const arrowTransform = dom.elements.get('spinner-arrow').style.transform;
    fire(dom.elements.get('table-theme').listeners, 'change', { target: { value: 'burgundy' } });
    assert.deepEqual(savedState(store), before, 'appearance selection never resets the performance state');
    assert.equal(dom.elements.get('spinner-arrow').style.transform, arrowTransform);
    assert.equal(store.get('zz11-table-theme-v1'), 'burgundy');
    assertCornerCue(dom, 'acknowledged');
    fire(dom.elements.get('start-performance').listeners, 'click', {});
    assert.equal(savedState(store).targetAngle, null);
    assert.equal(savedState(store).spins, 0);
    assert.equal(savedState(store).rotation, before.rotation);
    assert.equal(dom.stage.dataset.tableTheme, 'burgundy');
    assertCornerCue(dom, 'idle');
    fire(dom.stage.listeners, 'pointerdown', pointer(wheel, 100, 0));
    fire(dom.stage.listeners, 'pointerup', pointer(wheel, 100, 0));
    assert.equal(savedState(store).spins, 0, 'first target tap after restart does not spin');
    assertCornerCue(dom, 'acknowledged');
    fire(dom.elements.get('clear-target').listeners, 'click', {});
    assertCornerCue(dom, 'idle');
    assert.equal(dom.stage.dataset.tableTheme, 'burgundy');
  } finally { dom.restore(); }
  const relaunched = await loadSpinner({ moduleId: 'theme-relaunch', sharedStore: store });
  try {
    assert.equal(relaunched.stage.dataset.tableTheme, 'burgundy');
    assert.equal(relaunched.elements.get('table-theme').value, 'burgundy');
    assert.equal(savedState(store).targetAngle, null);
    assert.equal(savedState(store).spins, 0);
    assert.equal(savedState(store).forceSpin, 6);
    assert.equal(savedState(store).rotation, 212);
    assertCornerCue(relaunched, 'idle');
  } finally { relaunched.restore(); }
});

test('corner cues and theme preserve the forced outcome, eight-entry queue and animation timing', async () => {
  for (const reducedMotion of [false, true]) {
    const dom = await loadSpinner({ moduleId: `queue-motion-${reducedMotion}`, reducedMotion });
    try {
      const wheel = dom.elements.get('wheel-wrap');
      const animations = [];
      dom.elements.get('spinner-arrow').animate = (frames, options) => {
        const animation = { frames, options, cancel() { this.cancelled = true; }, onfinish: null };
        animations.push(animation);
        return animation;
      };
      fire(dom.stage.listeners, 'pointerdown', pointer(wheel, 100, 0));
      fire(dom.stage.listeners, 'pointerup', pointer(wheel, 100, 0));
      assert.equal(animations.length, 0, 'target selection never starts animation');
      assertCornerCue(dom, 'acknowledged');
      for (let i = 0; i < 11; i++) {
        fire(dom.stage.listeners, 'pointerdown', pointer(wheel, 130, 100, i + 2));
        fire(dom.stage.listeners, 'pointerup', pointer(wheel, 130, 100, i + 2));
      }
      assert.equal(animations.length, 1, 'pending inputs do not animate before current completion');
      const duringSpin = savedState(dom.store);
      fire(dom.elements.get('screen-design').listeners, 'change', { target: { value: 'hybrid' } });
      assert.deepEqual(savedState(dom.store), duringSpin);
      assert.equal(animations.length, 1, 'design change preserves active animation');
      assert.equal(animations[0].cancelled, undefined);
      fire(dom.elements.get('screen-design').listeners, 'change', { target: { value: 'casino' } });
      fire(dom.elements.get('table-theme').listeners, 'change', { target: { value: 'burgundy' } });
      assert.deepEqual(savedState(dom.store), duringSpin, 'theme change during a spin preserves state');
      assertCornerCue(dom, 'acknowledged');
      let previous = null;
      for (let i = 0; i < 9; i++) {
        const animation = animations[i];
        assert.ok(animation, `accepted queued spin ${i + 1} exists`);
        assert.equal(animation.options.duration, reducedMotion ? 50 : 1100);
        assert.equal(animation.options.easing, 'cubic-bezier(.12,.7,.13,1)');
        assert.equal(animation.options.fill, 'forwards');
        animation.onfinish();
        assert.equal(animation.cancelled, true);
        const state = savedState(dom.store);
        assert.equal(state.spins, i + 1);
        if (i + 1 === 4) assert.equal(state.previousAngle, 0, 'forced fourth spin lands exactly on target');
        else {
          assert.ok(angularDistance(state.previousAngle, 0) > 30);
          if (previous !== null) assert.ok(angularDistance(state.previousAngle, previous) > 10);
        }
        previous = state.previousAngle;
        assertCornerCue(dom, 'acknowledged');
      }
      assert.equal(animations.length, 9, 'one active spin plus eight queued inputs, excess discarded');
      assert.equal(dom.elements.get('spin-status').textContent, '');
      assert.equal(dom.stage.dataset.tableTheme, 'burgundy');
    } finally { dom.restore(); }
  }
});

for (const palette of ['emerald', 'burgundy']) {
  for (const [stored, expected] of [[undefined, 'casino'], ['', 'casino'], ['invalid', 'casino'], ['casino', 'casino'], ['hybrid', 'hybrid']]) {
    test(`${palette}/${String(stored)}: screen design validates and remains independent of palette/state`, async () => {
      const dom = await loadSpinner({ moduleId: `design-${palette}-${stored}`, initialTheme: palette, initialDesign: stored });
      try {
        assert.match(dom.html, /data-screen-design="casino"/, 'initial HTML prevents hybrid flash');
        assert.equal(dom.stage.dataset.screenDesign, expected);
        assert.equal(dom.elements.get('screen-design').value, expected);
        const before = savedState(dom.store), rotation = dom.elements.get('spinner-arrow').style.transform;
        fire(dom.elements.get('screen-design').listeners, 'change', { target: { value: 'hybrid' } });
        assert.equal(dom.stage.dataset.screenDesign, 'hybrid');
        assert.equal(dom.elements.get('spin-status').parentElement.classList.contains('instrument-header'), true);
        assert.equal(dom.elements.get('spinner-arrow').src, './hybrid-assets/arrow.svg');
        assert.equal(dom.stage.dataset.tableTheme, palette);
        assert.equal(dom.store.get('zz11-screen-design-v1'), 'hybrid');
        assert.deepEqual(savedState(dom.store), before);
        assert.equal(dom.elements.get('spinner-arrow').style.transform, rotation);
        fire(dom.elements.get('screen-design').listeners, 'change', { target: { value: 'casino' } });
        assert.equal(dom.stage.dataset.screenDesign, 'casino');
        assert.equal(dom.elements.get('spin-status').parentElement.classList.contains('stage-bottom'), true);
        assert.equal(dom.elements.get('spinner-arrow').src, './casino-assets/arrow.svg');
        assert.equal(dom.stage.dataset.tableTheme, palette);
        assert.deepEqual(savedState(dom.store), before);
        const ids = [...dom.html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        assert.equal(ids.length, new Set(ids).size, 'actual HTML IDs are unique');
      } finally { dom.restore(); }
    });
  }
}
for (const failure of ['read', 'write']) {
  test(`screen design tolerates storage ${failure} failure`, async () => {
    const dom = await loadSpinner({ moduleId: `design-storage-${failure}`, initialDesign: 'hybrid', storageReadFails: failure === 'read', storageWriteFails: failure === 'write' });
    try {
      assert.equal(dom.stage.dataset.screenDesign, failure === 'read' ? 'casino' : 'hybrid');
      fire(dom.elements.get('screen-design').listeners, 'change', { target: { value: 'hybrid' } });
      assert.equal(dom.stage.dataset.screenDesign, 'hybrid');
      assert.equal(savedState(dom.store).targetAngle, null);
    } finally { dom.restore(); }
  });
}

test('screen design and palette survive restart/relaunch with independent keys', async () => {
  const sharedStore = new Map();
  const dom = await loadSpinner({ moduleId: 'screen-design-relaunch-first', sharedStore });
  try {
    fire(dom.elements.get('screen-design').listeners, 'change', { target: { value: 'hybrid' } });
    fire(dom.elements.get('table-theme').listeners, 'change', { target: { value: 'burgundy' } });
    fire(dom.elements.get('start-performance').listeners, 'click', {});
    assert.equal(dom.stage.dataset.screenDesign, 'hybrid');
    assert.equal(dom.stage.dataset.tableTheme, 'burgundy');
  } finally { dom.restore(); }
  const again = await loadSpinner({ moduleId: 'screen-design-relaunch-second', sharedStore });
  try {
    assert.equal(again.stage.dataset.screenDesign, 'hybrid');
    assert.equal(again.stage.dataset.tableTheme, 'burgundy');
    assert.equal(again.elements.get('spinner-arrow').src, './hybrid-assets/arrow.svg');
    assert.equal(savedState(sharedStore).targetAngle, null);
    assert.equal(savedState(sharedStore).spins, 0);
  } finally { again.restore(); }
});
