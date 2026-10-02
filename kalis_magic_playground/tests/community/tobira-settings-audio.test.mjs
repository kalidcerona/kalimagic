import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const apps = [
  {
    name: 'personal',
    file: path.join(root, 'zz6/app.js'),
    html: path.join(root, 'zz6/index.html'),
    css: path.join(root, 'zz6/style.css'),
    sw: path.join(root, 'zz6/sw.js'),
    state: 'tobira.v1',
    motion: 'tobira.motion-effects.v1',
    images: 'tobira.coinChoices.v1',
    cache: 'v20261003-install-1',
  },
  {
    name: 'shared',
    file: path.join(root, 'distribution-snapshots/tobira/app.js'),
    html: path.join(root, 'distribution-snapshots/tobira/index.html'),
    css: path.join(root, 'distribution-snapshots/tobira/style.css'),
    sw: path.join(root, 'distribution-snapshots/tobira/sw.js'),
    state: 'friend-tobira.v1',
    motion: 'friend-tobira.motion-effects.v1',
    images: 'friend-tobira.coinChoices.v1',
    cache: 'v20261003-install-1',
  },
];

function preset(id, extra = {}) {
  return {
    id, name: id, coinSize: 0.3, startX: 0.2, startY: 0.4, exitEdge: 'top', fadeDistance: 0.22, disappearDuration: 700, ...extra,
  };
}

function memoryStorage(seed = {}, unreadable = new Set()) {
  const map = new Map(Object.entries(seed));
  const writes = [];
  return {
    map,
    writes,
    getItem(key) {
      if (unreadable.has(key)) throw new Error('read denied');
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) { writes.push(key); map.set(key, String(value)); },
    removeItem(key) { writes.push(key); map.delete(key); },
  };
}

function element(id) {
  const listeners = new Map();
  return {
    id,
    hidden: id === 'settings-gesture-guide',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    open: false,
    src: '',
    min: '',
    max: '',
    step: '',
    tabIndex: 0,
    className: '',
    inert: false,
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener() {},
    dispatch(type, event = {}) {
      for (const fn of listeners.get(type) || []) fn(event);
    },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    append(...kids) { this.children.push(...kids); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...kids) { this.children = [...kids]; },
    focus() {},
    blur() {},
    contains() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() { return { width: 390, height: 844, top: 0, left: 0, right: 390, bottom: 844 }; },
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() { return false; },
  };
}

async function boot(app, storage, session = memoryStorage(), audioFactory) {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  let hooks = null;
  const sandbox = {
    console,
    URL, URLSearchParams, TextEncoder, TextDecoder, queueMicrotask,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Object, Array, String, Number, Boolean, Symbol, Date, RegExp,
    Error, TypeError, RangeError, Promise, Map, Set, WeakMap, WeakSet, Proxy, Reflect,
    parseInt, parseFloat, isNaN, isFinite, decodeURIComponent, encodeURIComponent,
    Intl, structuredClone,
    HTMLElement: class HTMLElement {},
    Element: class Element {},
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    localStorage: storage,
    sessionStorage: session,
    navigator: {},
    isSecureContext: true,
    document: {
      title: '',
      readyState: 'complete',
      activeElement: null,
      documentElement: element('documentElement'),
      body: element('body'),
      getElementById: (id) => el(id),
      querySelector: (selector) => {
        const match = String(selector).match(/#([A-Za-z0-9_-]+)/);
        return el(match ? match[1] : selector);
      },
      querySelectorAll: () => [],
      createElement: (tag) => el(`${tag}-${elements.size}`),
      addEventListener() {},
    },
    __TOBIRA_TEST_HOOKS__(api) { hooks = api; },
    addEventListener() {},
    removeEventListener() {},
  };
  if (audioFactory) audioFactory(sandbox);
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const imports = {
    ...await import(pathToFileURL(path.join(path.dirname(app.file), 'logic.js')).href),
    ...await import(pathToFileURL(path.join(path.dirname(app.file), 'sensor-motion.js')).href),
  };
  Object.assign(sandbox, imports);
  const context = vm.createContext(sandbox);
  const source = fs.readFileSync(app.file, 'utf8')
    .replace(/^import \{[\s\S]*?\} from '\.\/logic\.js';\n/, '')
    .replace(/^import \{[^\n]*\} from '\.\/sensor-motion\.js';\n/, '');
  assert.doesNotMatch(source, /^import /m);
  vm.runInContext(source + `\n__TOBIRA_TEST_HOOKS__({playWallSound, unlockBreakSound, enableMotion, effects: () => motionEffects, state: () => state});`, context, { filename: app.file });
  return { hooks, elements: el, sandbox };
}

test('guide diagram, cache scope and sound control exist in both Tobira copies', () => {
  for (const app of apps) {
    const html = fs.readFileSync(app.html, 'utf8');
    const css = fs.readFileSync(app.css, 'utf8');
    const sw = fs.readFileSync(app.sw, 'utf8');
    const source = fs.readFileSync(app.file, 'utf8');
    assert.match(html, /id="motion-wall-sound"/);
    assert.match(html, /id="motion-wall-test"/);
    assert.match(html, /class="gesture-story"/);
    assert.match(html, /aria-describedby="settings-gesture-text"/);
    assert.match(html, /두 접점/);
    assert.doesNotMatch(html, /gesture-guide-demo" aria-hidden="true"><span>/);
    assert.match(css, /min-height:\s*44px/);
    assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.gesture-drop \{ animation: none/);
    assert.doesNotMatch(css, /gesture-guide-down/);
    assert.match(sw, new RegExp(app.cache.replace(/[.]/g, '\\.')));
    assert.match(sw, /CACHE_PREFIX/);
    const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
    for (const asset of ['./app.js', './sensor-motion.js', './install-prompt.js']) {
      assert.ok(shell.includes(JSON.stringify(asset)), `${app.name} precaches ${asset}`);
    }
    assert.match(source, /classifyTwoFingerSwipe/);
    assert.match(source, /if \(!probe && !wallSoundEnabled\(\)\) return/);
    if (app.name === 'shared') {
      assert.match(source, /friend-tobira\.motion-effects\.v1/);
      assert.match(source, /event\.key !== 'Escape'/);
      assert.doesNotMatch(source, /'tobira\.motion-effects\.v1'/);
    }
  }
});

for (const app of apps) {
  test(`${app.name} reloads saved preset, image choice and wall sound without writing performance mode`, async () => {
    const saved = {
      version: 1,
      selectedId: 'preset-b',
      mode: 'settings',
      studio: 'keep-me',
      presets: [preset('preset-a'), preset('preset-b', { coinSize: 0.44, marker: 'kept' })],
    };
    const storage = memoryStorage({
      [app.state]: JSON.stringify(saved),
      [app.motion]: JSON.stringify({ tilt: false, exit: false, breakthrough: false, wobble: true, edges: ['left'], wallSound: false, wallVolume: 40, customFlag: 'stay' }),
      [app.images]: JSON.stringify({ 'preset-b': 'won500', note: 'keep-image' }),
    });
    const first = await boot(app, storage);
    assert.equal(first.hooks.state().selectedId, 'preset-b');
    assert.equal(first.hooks.state().presets.find((item) => item.id === 'preset-b').coinSize, 0.44);
    assert.equal(first.hooks.effects().wallSound, false);
    assert.equal(first.hooks.effects().wallVolume, 40);
    assert.equal(first.hooks.effects().wobble, true);
    assert.equal(first.elements('coin-image-choice').value, 'won500');
    assert.equal(first.elements('motion-wall-sound').checked, false);
    assert.equal(storage.writes.includes(app.state), false);
    assert.equal(JSON.parse(storage.map.get(app.state)).mode, 'settings');

    first.elements('coin-size').value = '0.5';
    first.elements('coin-size').dispatch('input');
    const rewritten = JSON.parse(storage.map.get(app.state));
    assert.equal(rewritten.selectedId, 'preset-b');
    assert.equal(rewritten.studio, 'keep-me');
    assert.equal(rewritten.presets.find((item) => item.id === 'preset-b').marker, 'kept');
    assert.equal(rewritten.presets.find((item) => item.id === 'preset-b').coinSize, 0.5);
    assert.equal(storage.map.get(app.images), JSON.stringify({ 'preset-b': 'won500', note: 'keep-image' }));

    const reloaded = await boot(app, storage);
    assert.equal(reloaded.hooks.effects().wallSound, false);
    assert.equal(reloaded.hooks.effects().breakthrough, false);
    assert.equal(reloaded.elements('motion-wall-volume').value, '40');
    assert.equal(reloaded.hooks.state().selectedId, 'preset-b');
  });

  test(`${app.name} keeps sound off, unlocks wall audio with breakthrough off, and preserves unreadable storage`, async () => {
    const originalState = '{not-json';
    const originalMotion = '[1,2]';
    const originalImages = '"nope"';
    const storage = memoryStorage({
      [app.state]: originalState,
      [app.motion]: originalMotion,
      [app.images]: originalImages,
    });
    let resumes = 0;
    let oscillators = 0;
    let audioState = 'interrupted';
    const booted = await boot(app, storage, memoryStorage(), (sandbox) => {
      sandbox.AudioContext = class AudioContext {
        constructor() { this.currentTime = 0; this.destination = {}; }
        get state() { return audioState; }
        resume() { resumes += 1; return Promise.resolve(); }
        createOscillator() {
          oscillators += 1;
          const node = { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return node; }, start() {}, stop() {} };
          return node;
        }
        createGain() {
          const node = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return node; } };
          return node;
        }
      };
    });
    assert.equal(storage.map.get(app.state), originalState);
    assert.equal(storage.map.get(app.motion), originalMotion);
    assert.equal(storage.map.get(app.images), originalImages);
    assert.match(booted.elements('motion-note').textContent, /덮어쓰지|읽지 못했/);

    booted.elements('motion-breakthrough').checked = false;
    booted.elements('motion-enabled').checked = true;
    booted.elements('motion-exit').checked = false;
    booted.elements('motion-wobble').checked = false;
    booted.elements('motion-breakthrough').dispatch('change');
    assert.equal(booted.hooks.effects().breakthrough, false);
    assert.equal(booted.hooks.effects().tilt, true);
    assert.ok(resumes > 0);
    audioState = 'running';
    booted.elements('motion-wall-sound').checked = false;
    booted.elements('motion-wall-sound').dispatch('change');
    assert.equal(booted.hooks.effects().wallSound, false);
    booted.hooks.playWallSound(900);
    assert.equal(oscillators, 0);
    booted.hooks.playWallSound(720, { probe: true });
    assert.equal(oscillators, 1);
    assert.equal(storage.map.get(app.state), originalState);
    assert.equal(storage.map.get(app.motion), originalMotion);

    booted.elements('motion-wall-sound').dispatch('change');
    booted.elements('coin-size').dispatch('input');
    assert.equal(storage.map.get(app.state), originalState);
    assert.equal(storage.map.get(app.motion), originalMotion);
    assert.equal(storage.map.get(app.images), originalImages);
  });

  test(`${app.name} does not replace storage when the read itself throws`, async () => {
    const storage = memoryStorage({
      [app.state]: '{"kept":true}',
      [app.motion]: '{"wallSound":false}',
      [app.images]: '{"preset-default":"won500"}',
    }, new Set([app.state, app.motion, app.images]));
    const booted = await boot(app, storage, memoryStorage(), (sandbox) => {
      sandbox.AudioContext = class AudioContext {
        constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
        resume() { return Promise.reject(new Error('audio blocked')); }
        createOscillator() { throw new Error('unavailable'); }
        createGain() { throw new Error('unavailable'); }
      };
    });
    assert.equal(storage.writes.length, 0);
    assert.equal(storage.map.get(app.state), '{"kept":true}');
    assert.match(booted.elements('motion-note').textContent, /덮어쓰지/);
    assert.doesNotThrow(() => booted.hooks.unlockBreakSound());
    assert.doesNotThrow(() => booted.hooks.playWallSound(500, { probe: true }));
    await Promise.resolve();
    assert.match(booted.elements('motion-note').textContent, /소리/);
    booted.sandbox.AudioContext = class {
      constructor() { throw new Error('no audio'); }
    };
    booted.hooks.playWallSound(500, { probe: true });
    assert.equal(storage.writes.length, 0);
  });
}
