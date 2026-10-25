import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Startup-order comparator for CHOICE. It boots an app entry (app.js) in a recording stub browser and returns
// every addEventListener registration in the order it happened: target, type, capture/passive/once and a stable
// identity of the handler (a short hash of its source text). The pre-split single-file build is materialised from
// git history into a temporary directory, which the caller removes with dispose().

export const SPLIT_COMMIT = '83d3caa';

export function gitRoot(cwd) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
}

export function commitAvailable(cwd) {
  try {
    execFileSync('git', ['cat-file', '-e', `${SPLIT_COMMIT}^{commit}`], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Writes every file of `folder` (repo-relative, e.g. kalis_magic_playground/zz4) as it was before the split.
export function materializePreSplit(cwd, folder) {
  const dir = mkdtempSync(path.join(tmpdir(), 'choice-presplit-'));
  const dispose = () => rmSync(dir, { recursive: true, force: true });
  try {
    const root = gitRoot(cwd);
    const prefix = path.relative(root, path.resolve(cwd, folder)).split(path.sep).join('/');
    writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
    const names = execFileSync('git', ['ls-tree', '-r', '--name-only', `${SPLIT_COMMIT}^`, `${prefix}/`], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(Boolean);
    for (const name of names) {
      const rel = name.slice(prefix.length + 1);
      if (!/\.(js|mjs)$/.test(rel)) continue;
      const target = path.join(dir, rel);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, execFileSync('git', ['show', `${SPLIT_COMMIT}^:${name}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return { dir, dispose };
}

function hashOf(fn) {
  const source = typeof fn === 'function' ? Function.prototype.toString.call(fn) : typeof fn?.handleEvent === 'function' ? `handleEvent:${Function.prototype.toString.call(fn.handleEvent)}` : String(fn);
  // Whitespace is not identity: re-indenting a handler must not change it.
  const flat = source.replace(/\s+/g, ' ');
  return `${createHash('sha1').update(flat).digest('hex').slice(0, 10)} ${flat.slice(0, 60)}`;
}

function optionsOf(options) {
  if (typeof options === 'boolean') return `capture=${options}`;
  const o = options && typeof options === 'object' ? options : {};
  return `capture=${Boolean(o.capture)} passive=${o.passive === undefined ? '-' : Boolean(o.passive)} once=${Boolean(o.once)}`;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

// Boots dir/app.js once in a fresh stub browser. Each entry file is imported at most once per process, so every
// directory gets its own boot.
export async function recordStartupListeners(dir) {
  const log = [];
  const record = (label) => (type, fn, options) => { log.push(`${label} | ${type} | ${optionsOf(options)} | ${hashOf(fn)}`); };
  const cache = new Map();
  const make = (label, tag = 'div') => {
    const node = {
      tagName: String(tag).toUpperCase(), nodeType: 1, id: '', className: '', textContent: '', value: '', checked: false,
      hidden: false, disabled: false, open: false, inert: false, type: '', title: '', tabIndex: 0, src: '', alt: '',
      min: '', max: '', step: '', dataset: {}, children: [], attributes: {}, parentElement: null, parentNode: null,
      style: new Proxy({}, {
        get(target, key) {
          if (key === 'setProperty') return (name, value) => { target[name] = value; };
          if (key === 'removeProperty') return (name) => { delete target[name]; };
          return target[key] ?? '';
        },
        set(target, key, value) { target[key] = value; return true; },
      }),
      classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
      appendChild(child) { if (child && typeof child === 'object') { child.parentElement = node; child.parentNode = node; node.children.push(child); } return child; },
      append(...kids) { kids.forEach((kid) => { if (kid && typeof kid === 'object' && kid.appendChild) node.appendChild(kid); }); },
      replaceChildren(...kids) { node.children = []; kids.flat().forEach((kid) => node.appendChild(kid)); },
      remove() { node.parentElement = null; node.parentNode = null; },
      setAttribute(name, value) { node.attributes[name] = String(value); },
      getAttribute(name) { return Object.prototype.hasOwnProperty.call(node.attributes, name) ? node.attributes[name] : null; },
      removeAttribute(name) { delete node.attributes[name]; },
      addEventListener: record(label),
      removeEventListener() {},
      dispatchEvent() { return true; },
      querySelector(selector) { return pick(`${label} > ${selector}`); },
      querySelectorAll(selector) { return [pick(`${label} > ${selector} [0]`), pick(`${label} > ${selector} [1]`)]; },
      closest() { return null; }, matches() { return false; }, contains() { return false; }, focus() {}, click() {}, blur() {},
      cloneNode() { return make(label, tag); },
      getBoundingClientRect() { return { left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20, x: 0, y: 0 }; },
      scrollIntoView() {}, showModal() {}, close() {}, getContext() { return null; },
    };
    return node;
  };
  const pick = (label) => {
    if (!cache.has(label)) cache.set(label, make(label));
    return cache.get(label);
  };
  const documentElement = make('documentElement', 'html');
  const body = make('body', 'body');
  body.dataset.view = 'settings';
  const doc = {
    title: '', readyState: 'complete', body, documentElement, cookie: '', hidden: false, visibilityState: 'visible',
    getElementById: (id) => { const node = pick(`#${id}`); node.id = id; return node; },
    querySelector: (selector) => pick(`document > ${selector}`),
    querySelectorAll: (selector) => [pick(`document > ${selector} [0]`), pick(`document > ${selector} [1]`)],
    createElement: (tag) => make(`<${tag}>`, tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
    addEventListener: record('document'),
    removeEventListener() {},
    dispatchEvent() { return true; },
  };
  const names = ['document', 'window', 'location', 'history', 'localStorage', 'HTMLElement', 'Option', 'addEventListener',
    'removeEventListener', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval',
    'clearInterval', 'fetch', 'visualViewport', 'innerWidth', 'innerHeight', 'matchMedia', 'getComputedStyle', 'screen'];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const define = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  const store = new Map();
  define('document', doc);
  define('window', globalThis);
  define('location', { protocol: 'http:', href: 'http://localhost/zz4/', hostname: 'localhost', pathname: '/zz4/', hash: '', search: '?local-preview=1' });
  define('history', { state: null, pushState() {}, replaceState() {}, back() {} });
  define('localStorage', { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => { store.set(key, String(value)); }, removeItem: (key) => { store.delete(key); } });
  define('HTMLElement', class HTMLElement {});
  define('Option', class Option { constructor(text, value) { this.tagName = 'OPTION'; this.textContent = String(text ?? ''); this.value = String(value ?? ''); this.children = []; } });
  define('addEventListener', record('window'));
  define('removeEventListener', () => {});
  define('requestAnimationFrame', (fn) => { fn(); return 1; });
  define('cancelAnimationFrame', () => {});
  define('setTimeout', () => 0);
  define('clearTimeout', () => {});
  define('setInterval', () => 0);
  define('clearInterval', () => {});
  define('fetch', () => Promise.reject(new Error('offline')));
  define('visualViewport', { width: 412, height: 915, offsetTop: 0, offsetLeft: 0, addEventListener: record('visualViewport') });
  define('innerWidth', 412);
  define('innerHeight', 915);
  define('matchMedia', () => ({ matches: false, addEventListener: record('matchMedia') }));
  define('getComputedStyle', () => ({ getPropertyValue: () => '' }));
  define('screen', { width: 412, height: 915 });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      userAgent: 'test', platform: 'test', maxTouchPoints: 0, language: 'ko-KR', vibrate: () => true,
      serviceWorker: { controller: null, ready: new Promise(() => {}), register: () => Promise.resolve({}), addEventListener: record('serviceWorker') },
    },
  });
  try {
    await import(pathToFileURL(path.join(dir, 'app.js')).href);
    for (let i = 0; i < 5; i += 1) await tick();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
  }
  return log;
}

// Index of the first position where the two sequences differ, or -1 when they are identical.
export function firstDivergence(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) if (a[i] !== b[i]) return i;
  return -1;
}

// Readable unified-style view of how `after` differs from `before` (longest common subsequence).
export function diffSequences(before, after) {
  const n = before.length;
  const m = after.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) { i += 1; j += 1; } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) { out.push(`+ [${j}] ${after[j]}`); j += 1; } else { out.push(`- [${i}] ${before[i]}`); i += 1; }
  }
  return out;
}
