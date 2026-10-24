import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

// Loads the split modules in separate module scopes and submits the real settings form.
const trees = [
  ['zz2', '../../zz2/'],
  ['distribution-snapshots/unlock', '../../distribution-snapshots/unlock/'],
];

function dom() {
  const elements = new Map();
  const listeners = {};
  const make = (id) => {
    if (elements.has(id)) return elements.get(id);
    const node = {
      id, hidden: false, textContent: '', value: '', checked: false, disabled: false,
      style: { setProperty(key, value) { this[key] = value; } },
      dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      handlers: {},
      addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
      setAttribute(key, value) { this[key] = value; },
      querySelector(selector) { return make(`${id}:${selector}`); },
      closest() { return null; },
    };
    elements.set(id, node);
    return node;
  };
  const previews = [0, 1, 2].map(() => ({
    dataset: { naturalHeight: '0' },
    querySelector() { return { style: {}, setAttribute() {} }; },
  }));
  const document = {
    documentElement: make('html'),
    visibilityState: 'visible',
    getElementById: make,
    querySelector(selector) {
      const text = String(selector);
      if (text.includes('theme-color') || text.includes('apple-mobile-web-app-status-bar-style')) return { content: '' };
      return null;
    },
    querySelectorAll(selector) { return selector === '.preview' ? previews : []; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
  return { make, listeners, document };
}

async function exercise(root) {
  const { make, listeners, document } = dom();
  const storage = new Map();
  const timers = new Map();
  const cleared = [];
  let timerId = 1;
  const context = vm.createContext({
    document,
    window: { addEventListener() {} },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    location: { pathname: '/zz2/' },
    navigator: {},
    performance: { now: () => 1000 },
    setTimeout(fn) { const id = timerId; timerId += 1; timers.set(id, fn); return id; },
    clearTimeout(id) { cleared.push(id); timers.delete(id); },
    requestAnimationFrame() { return 0; },
    matchMedia() { return { matches: false }; },
    console, queueMicrotask,
  });
  context.globalThis = context;
  const cache = new Map();
  const load = (href) => {
    if (cache.has(href)) return cache.get(href);
    const linked = new vm.SourceTextModule(readFileSync(new URL(href), 'utf8'), { context, identifier: href });
    cache.set(href, linked);
    return linked;
  };
  const evaluate = async (href) => {
    const linked = load(href);
    if (linked.status === 'unlinked') {
      await linked.link((specifier, referencing) => load(new URL(specifier, referencing.identifier).href));
    }
    if (linked.status === 'linked') await linked.evaluate();
    return linked;
  };

  await evaluate(new URL('gestures.js', root).href);
  const session = cache.get(new URL('session.js', root).href).namespace.session;
  const shown = [];
  session.screen = 'input';
  session.interruptUnlockMotion = () => {};
  session.showScreen = (name) => { shown.push(name); };
  session.displayImage = async () => {};
  session.imageKeys = ['lock', 'unlock', 'home2'];
  const points = [
    { identifier: 1, clientX: 10, clientY: 10 },
    { identifier: 2, clientX: 40, clientY: 12 },
  ];
  for (const type of ['touchstart', 'touchend']) {
    const event = { touches: type === 'touchend' ? [] : points, changedTouches: points, preventDefault() {} };
    for (const fn of listeners[type] || []) fn(event);
  }
  const armed = [...timers.keys()];
  if (armed.length !== 1) return `expected one armed tap timer, saw ${armed.length}`;
  await evaluate(new URL('settings.js', root).href);
  const submit = make('settings-form').handlers.submit;
  if (!submit?.length) return 'settings form did not register a submit handler';
  await submit[0]({ preventDefault() {} });
  const status = make('storage-status').textContent;
  if (status.includes('이미지 처리 실패')) return `submit failed: ${status}; timer pending=${timers.has(armed[0])}`;
  if (shown[0] !== 'input') return `showScreen saw ${shown.join(',') || 'nothing'}; status=${status}`;
  if (timers.has(armed[0]) || !cleared.includes(armed[0])) return 'submit left the two-finger tap timer armed';
  return '';
}

if (process.env.ZZ2_MODULE_LINK === '1') {
  const failures = [];
  for (const [label, relative] of trees) {
    try {
      const detail = await exercise(new URL(relative, import.meta.url));
      if (detail) failures.push(`${label}: ${detail}`);
    } catch (error) {
      failures.push(`${label}: ${error.stack || error.message}`);
    }
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
} else {
  test('settings submit clears the two-finger tap across real module boundaries', () => {
    const child = spawnSync(process.execPath, [
      '--experimental-vm-modules',
      '--input-type=module',
      '-e',
      `import ${JSON.stringify(import.meta.url)};`,
    ], { env: { ...process.env, ZZ2_MODULE_LINK: '1' }, encoding: 'utf8', timeout: 20000 });
    assert.equal(child.status, 0, `${child.stdout || ''}\n${child.stderr || ''}`);
  });
}
