import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../../zz13/core.mjs';

const KEY = 'magic-qr-session-v1';
const PRESERVED = KEY + '-preserved-raw';
const html = fs.readFileSync(new URL('../../zz13/index.html', import.meta.url), 'utf8');

vm.runInThisContext(fs.readFileSync(new URL('../../zz13/vendor/qrcodegen.js', import.meta.url), 'utf8'));
const decoderContext = { module: { exports: {} }, exports: {}, Uint8ClampedArray };
vm.runInNewContext(fs.readFileSync(new URL('../../zz13/vendor/jsQR.js', import.meta.url), 'utf8'), decoderContext);
globalThis.jsQR = decoderContext.module.exports;
if (typeof globalThis.ImageData !== 'function') {
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
}

class El {
  constructor(id, tag = 'DIV') {
    this.id = id;
    this.tagName = tag;
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.textContent = '';
    this.value = '';
    this.className = '';
    this.attributes = {};
    this.children = [];
    this.style = {};
    this.width = 0;
    this.height = 0;
    this.clicked = 0;
    this.download = '';
    this.href = '';
  }
  get value() { return this._value || ''; }
  set value(value) { this._value = String(value); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); return child; }
  get firstChild() { return this.children[0] || null; }
  remove() { this.parentElement?.removeChild(this); }
  querySelectorAll(selector) {
    const className = selector.startsWith('.') ? selector.slice(1) : null;
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (className && child.className === className) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getContext() { return { putImageData() {} }; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width || 290, height: this.height || 290 }; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.clicked += 1; }
  toBlob(callback) { callback(new Blob(['png'])); }
}

function installDom({ raw, throwGet = false, rejectSet = null, shared = false, pathname } = {}) {
  const markup = shared ? fs.readFileSync(new URL('../../distribution-snapshots/qr/index.html', import.meta.url), 'utf8') : html;
  pathname = pathname || (shared ? '/distribution-snapshots/qr/' : '/zz13/');
  const primaryKey = pathname.toLowerCase().startsWith('/tools/arosaegida') ? KEY + '-arosaegida' : KEY;
  const store = new Map();
  if (raw !== undefined) store.set(primaryKey, raw);
  const writes = [];
  const blobs = [];
  const anchors = [];
  const elements = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const saved = new Map();
  function replace(name, value) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  function make(id, tag) {
    const el = new El(id, tag);
    if (id) elements.set(id, el);
    el.click = () => { el.clicked += 1; if (el.tagName === 'A') anchors.push(el); };
    return el;
  }
  for (const match of markup.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const id = /\bid="([^"]+)"/.exec(match[2]);
    if (!id) continue;
    const el = make(id[1], match[1].toUpperCase());
    const value = /\bvalue="([^"]*)"/.exec(match[2]);
    if (value) el.value = value[1];
    if (/(?:^|\s)disabled(?:\s|$)/.test(match[2])) el.disabled = true;
    if (/(?:^|\s)hidden(?:\s|$)/.test(match[2])) el.hidden = true;
  }
  for (const id of ['notice', 'empty', 'qr', 'png', 'generate', 'freeze', 'undo', 'clean', 'dot', 'dotvalue', 'extras', 'settings', 'target', 'ordinal', 'decoys', 'session', 'error', 'close', 'add-extra', 'form', 'backup', 'import', 'install-status', 'install', 'install-manual', 'install-android', 'install-android-recovery']) {
    if (shared && id === 'clean') continue;
    assert.ok(elements.has(id), `actual markup provides #${id}`);
  }
  replace('document', {
    visibilityState: 'visible',
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => make(null, String(tag).toUpperCase()),
    addEventListener: (type, fn) => { documentListeners.set(type, fn); },
  });
  replace('window', {
    addEventListener: (type, fn) => { windowListeners.set(type, fn); },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  });
  replace('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0, standalone: false });
  replace('location', { pathname });
  replace('localStorage', {
    getItem(key) { if (throwGet) throw new Error('getItem failed'); return store.has(key) ? store.get(key) : null; },
    setItem(key, value) {
      if (rejectSet && rejectSet(key)) throw new Error('setItem failed');
      const text = String(value);
      writes.push([key, text]);
      store.set(key, text);
    },
  });
  const urlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: (blob) => { blobs.push(blob); return `blob:${blobs.length}`; } });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: () => {} });
  return {
    elements, documentListeners, windowListeners, store, writes, blobs, anchors, primaryKey, shared,
    setThrowGet(value) { throwGet = value; },
    setRejectSet(value) { rejectSet = value; },
    restore() {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
      if (urlDescriptor) Object.defineProperty(URL, 'createObjectURL', urlDescriptor);
      else delete URL.createObjectURL;
      if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
      else delete URL.revokeObjectURL;
    },
  };
}

function savedSession(config, extra = {}) {
  return core.serialize({
    config: core.settings(config),
    counter: 0,
    frozen: false,
    current: null,
    bag: [],
    last: null,
    ...extra,
  });
}

async function boot(name, options) {
  const dom = installDom(options);
  try {
    await import(`../../${options?.shared ? 'distribution-snapshots/qr' : 'zz13'}/app.mjs?storage=${encodeURIComponent(name)}`);
  } catch (error) {
    dom.restore();
    throw error;
  }
  return dom;
}

function fire(dom, type, event) {
  const fn = dom.documentListeners.get(type);
  assert.equal(typeof fn, 'function', type);
  fn(event);
}

function pointer(dom, target, x, y, pointerId = 4) {
  const base = { pointerId, clientX: x, clientY: y, target, button: 0 };
  fire(dom, 'pointerdown', base);
  fire(dom, 'pointerup', { ...base });
}

function openSettings(dom) {
  const background = dom.elements.get('empty');
  fire(dom, 'pointerdown', { pointerId: 1, clientX: 20, clientY: 20, target: background, button: 0 });
  fire(dom, 'pointerdown', { pointerId: 2, clientX: 70, clientY: 20, target: background, button: 0 });
  fire(dom, 'pointermove', { pointerId: 1, clientX: 20, clientY: 100, target: background });
  fire(dom, 'pointermove', { pointerId: 2, clientX: 70, clientY: 100, target: background });
  fire(dom, 'pointerup', { pointerId: 1, clientX: 20, clientY: 100, target: background, button: 0 });
  fire(dom, 'pointerup', { pointerId: 2, clientX: 70, clientY: 100, target: background, button: 0 });
  assert.equal(dom.elements.get('settings').open, true);
}

function resume(dom) {
  globalThis.document.visibilityState = 'hidden';
  fire(dom, 'visibilitychange', {});
  dom.windowListeners.get('blur')();
  globalThis.document.visibilityState = 'visible';
  fire(dom, 'visibilitychange', {});
}

function submitSettings(dom, { target, ordinal = '4', decoys = 'https://example.com/decoy', dot = '110' }) {
  dom.elements.get('target').value = target;
  dom.elements.get('ordinal').value = ordinal;
  dom.elements.get('decoys').value = decoys;
  dom.elements.get('dot').value = dot;
  dom.elements.get('form').onsubmit({ preventDefault() {} });
}

async function importBackup(dom, text) {
  await dom.elements.get('import').onchange({
    target: { files: [{ size: text.length, text: async () => text }], value: 'backup.json' },
  });
}

async function exportedText(dom) {
  const blob = dom.blobs.at(-1);
  assert.ok(blob, 'backup download exists');
  return blob.text();
}

async function useLoadedQr(dom, { edit = false } = {}) {
  dom.elements.get('generate').onclick();
  assert.equal(dom.elements.get('qr').hidden, false, 'generation still runs from the in-memory session');
  dom.elements.get('freeze').onclick();
  assert.equal(dom.elements.get('freeze').textContent, '고정됨');
  dom.elements.get('undo').onclick();
  dom.elements.get('clean').onclick();
  if (edit) assert.equal(await editOneCell(dom), true);
  resume(dom);
}

async function editOneCell(dom) {
  const qr = dom.elements.get('qr');
  const size = qr.width / 16 - 8;
  assert.equal(Number.isInteger(size), true);
  qr.getBoundingClientRect = () => ({ left: 0, top: 0, width: size + 8, height: size + 8 });
  if (!dom.shared) {
    pointer(dom, qr, 4.5, 4.5);
    assert.equal(dom.elements.get('undo').disabled, true, 'protected cell produces no edit history');
  }
  const undo = dom.elements.get('undo');
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = size - 1; x >= 0; x -= 1) {
      if (core.isProtectedModule(size, x, y)) continue;
      pointer(dom, qr, x + 4.5, y + 4.5);
      if (undo.disabled) continue;
      pointer(dom, dom.elements.get('generate'), 3, 3);
      if (!undo.disabled) return true;
    }
  }
  return false;
}

test('missing storage is a normal default and is not reported as a failed read', async () => {
  const dom = await boot('missing', {});
  try {
    assert.equal(dom.elements.get('notice').textContent, '');
    assert.equal(dom.writes.map(([key]) => key).includes(PRESERVED), false);
    const saved = JSON.parse(stored(dom));
    assert.equal(saved.config.target, core.DEFAULTS.target);
    assert.equal(saved.counter, 0);
    assert.equal(saved.frozen, false);
    openSettings(dom);
    assert.equal(dom.elements.get('error').textContent, '');
    assert.equal(dom.elements.get('session').textContent, '현재 생성 횟수: 0');
    assert.equal(dom.elements.get('target').value, core.DEFAULTS.target);
  } finally { dom.restore(); }
});

test('the scoped service worker cache includes this app change', () => {
  const sw = fs.readFileSync(new URL('../../zz13/sw.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../../zz13/app.mjs', import.meta.url), 'utf8');
  assert.match(sw, /CACHE=PREFIX\+'v20261004-polish-1'/);
  assert.match(sw, /\.\/app\.mjs/);
  assert.match(app, /writesHeld/);
  assert.doesNotMatch(app, /distribution-snapshots/);
});

test('malformed, invalid, and unreadable storage keep the exact bytes through later actions', async () => {
  const cases = [
    ['malformed', '{'],
    ['empty-string', ''],
    ['bad-schema', JSON.stringify({ schema: 2, counter: 0, frozen: false })],
    ['bad-counter', JSON.stringify({ schema: 1, counter: -1, frozen: false, config: { target: 'https://example.com/', ordinal: 1, decoys: [], dot: 100, extraTargets: [] } })],
    ['bad-config', JSON.stringify({ schema: 1, counter: 0, frozen: false, config: { target: 'not a url', ordinal: 1, decoys: [], dot: 100, extraTargets: [] } })],
    ['bad-bag', savedSession({ target: 'https://example.com/bag', ordinal: 2, decoys: 'https://example.com/ok', dot: 100 }, { bag: ['https://example.com/not-listed'] })],
  ];
  for (const [name, raw] of cases) {
    const dom = await boot(name, { raw });
    try {
      assert.equal(stored(dom), raw, name);
      assert.equal(dom.writes.length, 0, name);
      assert.match(dom.elements.get('notice').textContent, /원본은 그대로 두었고 자동 저장은 멈췄습니다/, name);
      openSettings(dom);
      assert.match(dom.elements.get('error').textContent, /설정 백업으로 그 원본을 받을 수 있습니다/, name);
      dom.elements.get('settings').close();
      dom.elements.get('backup').onclick();
      assert.equal(await exportedText(dom), raw, name);
      assert.equal(dom.anchors.at(-1).download, 'QR-backup.json', name);
      assert.equal(await exportedText(dom) === core.serialize({ config: core.DEFAULTS, counter: 0, frozen: false, current: null, bag: [], last: null }), false);
      await useLoadedQr(dom, { edit: name === 'malformed' });
      assert.equal(stored(dom), raw, name);
      assert.equal(dom.writes.length, 0, name);
      assert.equal(dom.store.has(PRESERVED), false, name);
    } finally { dom.restore(); }
  }
});

test('a thrown getItem keeps original even on explicit form save and import', async () => {
  const dom = await boot('throw-get', { raw: 'SECRET-ORIGINAL', throwGet: true });
  try {
    assert.equal(stored(dom), 'SECRET-ORIGINAL');
    assert.equal(dom.writes.length, 0);
    assert.match(dom.elements.get('notice').textContent, /저장된 내용을 읽지 못했습니다/);
    assert.match(dom.elements.get('notice').textContent, /원본을 읽고 보관할 수 있을 때까지/);
    assert.doesNotMatch(dom.elements.get('notice').textContent, /원본은 그대로 두었고/);
    dom.elements.get('backup').onclick();
    assert.equal(dom.blobs.length, 0);
    assert.match(dom.elements.get('notice').textContent, /기본 설정을 백업으로 내려받지 않습니다/);
    await useLoadedQr(dom);
    assert.equal(stored(dom), 'SECRET-ORIGINAL');
    assert.equal(dom.writes.length, 0);
    submitSettings(dom, { target: 'https://example.com/replaced' });
    assert.equal(stored(dom), 'SECRET-ORIGINAL');
    assert.equal(dom.writes.length, 0);
    await importBackup(dom, savedSession({ target: 'https://example.com/import', ordinal: 2, decoys: '', dot: 110 }));
    assert.equal(stored(dom), 'SECRET-ORIGINAL');
    assert.equal(dom.writes.length, 0);
    assert.equal(dom.store.has(PRESERVED), false);
    assert.match(dom.elements.get('error').textContent, /원본/);
    assert.doesNotMatch(dom.elements.get('notice').textContent, /복원했습니다|바꾸었습니다/);
  } finally { dom.restore(); }
});

test('startup reset keeps valid configuration and resume keeps the new count', async () => {
  const config = { target: 'https://example.com/start', ordinal: 3, decoys: 'https://example.com/other', dot: 115, extraTargets: [{ ordinal: 2, target: 'https://example.com/second' }] };
  const raw = savedSession(config, { counter: 9, frozen: true, bag: ['https://example.com/other'], last: null });
  const dom = await boot('startup-reset', { raw });
  try {
    const resetSaved = JSON.parse(stored(dom));
    assert.equal(resetSaved.config.target, 'https://example.com/start');
    assert.equal(resetSaved.config.ordinal, 3);
    assert.equal(resetSaved.config.dot, 115);
    assert.deepEqual(resetSaved.config.decoys, ['https://example.com/other']);
    assert.deepEqual(resetSaved.config.extraTargets, [{ ordinal: 2, target: 'https://example.com/second' }]);
    assert.equal(resetSaved.counter, 0);
    assert.equal(resetSaved.frozen, false);
    assert.equal(resetSaved.current, null);
    assert.deepEqual(resetSaved.bag, []);
    assert.equal(resetSaved.last, null);
    assert.equal(dom.elements.get('notice').textContent, '');
    openSettings(dom);
    assert.equal(dom.elements.get('target').value, 'https://example.com/start');
    assert.equal(String(dom.elements.get('ordinal').value), '3');
    assert.equal(String(dom.elements.get('dot').value), '115');
    assert.equal(dom.elements.get('decoys').value, 'https://example.com/other');
    assert.equal(dom.elements.get('session').textContent, '현재 생성 횟수: 0');
    assert.equal(dom.elements.get('error').textContent, '');
    dom.elements.get('settings').close();
    dom.elements.get('generate').onclick();
    assert.equal(JSON.parse(stored(dom)).counter, 1);
    assert.equal(JSON.parse(stored(dom)).frozen, false);
    resume(dom);
    assert.equal(JSON.parse(stored(dom)).counter, 1);
    assert.equal(JSON.parse(stored(dom)).config.target, 'https://example.com/start');
    openSettings(dom);
    assert.equal(dom.elements.get('session').textContent, '현재 생성 횟수: 1');
    dom.elements.get('backup').onclick();
    const backup = JSON.parse(await exportedText(dom));
    assert.equal(backup.counter, 1);
    assert.equal(backup.config.target, 'https://example.com/start');
    assert.notEqual(backup.config.target, core.DEFAULTS.target);
    submitSettings(dom, { target: 'https://example.com/start', ordinal: '3', decoys: 'https://example.com/other', dot: '115' });
    const afterSave = JSON.parse(stored(dom));
    assert.equal(afterSave.counter, 0);
    assert.equal(afterSave.frozen, false);
    assert.equal(afterSave.current, null);
    assert.equal(afterSave.config.target, 'https://example.com/start');
  } finally { dom.restore(); }
});

test('zero, false, and empty fields stay configured instead of becoming defaults', async () => {
  const raw = savedSession({ target: 'https://example.com/empty', ordinal: 1, decoys: '', dot: '100', extraTargets: [] });
  const dom = await boot('empty-valid', { raw });
  try {
    assert.equal(stored(dom), raw);
    assert.equal(dom.elements.get('notice').textContent, '');
    openSettings(dom);
    assert.equal(dom.elements.get('target').value, 'https://example.com/empty');
    assert.equal(String(dom.elements.get('ordinal').value), '1');
    assert.equal(dom.elements.get('decoys').value, '');
    assert.equal(String(dom.elements.get('dot').value), '100');
    assert.equal(dom.elements.get('session').textContent, '현재 생성 횟수: 0');
    assert.equal(dom.elements.get('extras').children.length, 0);
    assert.equal(dom.elements.get('error').textContent, '');
  } finally { dom.restore(); }
});

test('invalid current QR still restores a valid config and then applies startup reset', async () => {
  const rawObject = JSON.parse(savedSession({ target: 'https://example.com/kept', ordinal: 4, decoys: 'https://example.com/decoy', dot: 110 }, { counter: 6, frozen: true }));
  rawObject.current = { payload: 'not-a-real-qr', version: 1, mask: 0, dot: 110, edits: [0] };
  const raw = JSON.stringify(rawObject);
  const dom = await boot('invalid-current', { raw });
  try {
    assert.notEqual(stored(dom), raw);
    const saved = JSON.parse(stored(dom));
    assert.equal(saved.config.target, 'https://example.com/kept');
    assert.deepEqual(saved.config.decoys, ['https://example.com/decoy']);
    assert.equal(saved.config.dot, 110);
    assert.equal(saved.counter, 0);
    assert.equal(saved.frozen, false);
    assert.equal(saved.current, null);
    assert.equal(dom.elements.get('notice').textContent, '');
    assert.equal(dom.store.has(PRESERVED), false);
  } finally { dom.restore(); }
});

test('explicit import and settings save recover without pretending defaults are the original', async () => {
  const original = '{"schema":1,"config":';
  const dom = await boot('recover', { raw: original });
  try {
    assert.equal(stored(dom), original);
    const imported = savedSession({ target: 'https://example.com/imported', ordinal: 6, decoys: '', dot: 105 }, { counter: 4, frozen: true });
    await importBackup(dom, imported);
    assert.equal(dom.store.get(PRESERVED), original);
    const restored = JSON.parse(stored(dom));
    assert.equal(restored.config.target, 'https://example.com/imported');
    assert.equal(restored.counter, 4);
    assert.equal(restored.frozen, true);
    assert.match(dom.elements.get('error').textContent, /백업을 복원했습니다/);
    assert.match(dom.elements.get('notice').textContent, /이전 저장 내용은 바꾸었습니다/);
    assert.equal(await exportedText(dom), original);
    assert.equal(dom.anchors.at(-1).download, 'QR-original.json');
    submitSettings(dom, { target: 'https://example.com/saved', ordinal: '8', decoys: '', dot: '100' });
    const replaced = JSON.parse(stored(dom));
    assert.equal(replaced.config.target, 'https://example.com/saved');
    assert.equal(replaced.config.dot, 100);
    assert.deepEqual(replaced.config.decoys, []);
    assert.equal(replaced.counter, 0);
    assert.equal(replaced.frozen, false);
    assert.equal(replaced.current, null);
    assert.equal(dom.store.get(PRESERVED), original);
    dom.elements.get('backup').onclick();
    const backup = JSON.parse(await exportedText(dom));
    assert.equal(backup.config.target, 'https://example.com/saved');
    assert.notEqual(backup.config.target, core.DEFAULTS.target);
    assert.equal(backup.counter, 0);
  } finally { dom.restore(); }
});

test('explicit save keeps the original when it can be stored and refuses to replace it when that copy fails', async () => {
  const original = 'NOT-JSON-ORIGINAL';
  const blocked = await boot('stash-fails', { raw: original, rejectSet: (key) => key === PRESERVED });
  try {
    submitSettings(blocked, { target: 'https://example.com/should-not-land' });
    assert.equal(stored(blocked), original);
    assert.equal(blocked.store.has(PRESERVED), false);
    assert.match(blocked.elements.get('notice').textContent, /원본을 따로 남기지 못해 저장소는 바꾸지 않았습니다/);
    blocked.elements.get('backup').onclick();
    assert.equal(await exportedText(blocked), original);
    assert.equal(stored(blocked), original);
  } finally { blocked.restore(); }

  const allowed = await boot('stash-ok', { raw: original });
  try {
    submitSettings(allowed, { target: 'https://example.com/explicit', ordinal: '2', decoys: 'https://example.com/one', dot: '120' });
    assert.equal(allowed.store.get(PRESERVED), original);
    const saved = JSON.parse(stored(allowed));
    assert.equal(saved.config.target, 'https://example.com/explicit');
    assert.equal(saved.counter, 0);
    assert.equal(saved.frozen, false);
    assert.match(allowed.elements.get('notice').textContent, /백업 파일 다운로드도 요청했습니다/);
    assert.equal(await exportedText(allowed), original);
  } finally { allowed.restore(); }
});

function stored(dom) { return dom.store.get(dom.primaryKey); }

for (const shared of [false, true]) {
  const variant = shared ? 'shared' : 'personal';
  test(`${variant}: valid empty target preserves the complete configuration on fresh launch`, async () => {
    const config = { target: '', ordinal: 3, decoys: ['https://example.com/decoy'], dot: 105, extraTargets: [{ ordinal: 4, target: 'https://example.com/extra' }] };
    const raw = savedSession(config, { counter: 8, frozen: true, bag: ['https://example.com/decoy'], last: null });
    const dom = await boot(`${variant}-empty-target`, { raw, shared });
    try {
      const saved = JSON.parse(stored(dom));
      assert.deepEqual(saved.config, config);
      assert.equal(saved.counter, 0);assert.equal(saved.frozen, false);
      assert.equal(dom.elements.get('generate').disabled, true);
      openSettings(dom);
      assert.equal(dom.elements.get('target').value, '');
      assert.equal(dom.elements.get('ordinal').value, '3');
      assert.equal(dom.elements.get('dot').value, '105');
    } finally { dom.restore(); }
  });

  test(`${variant}: failed reads preserve original through form and import despite writable storage`, async () => {
    const original = 'UNREADABLE-ORIGINAL';
    const dom = await boot(`${variant}-failed-read`, { raw: original, throwGet: true, shared });
    try {
      openSettings(dom);
      submitSettings(dom, { target: 'https://example.com/settings' });
      await importBackup(dom, savedSession({ target: 'https://example.com/import', ordinal: 1, decoys: '', dot: 100 }));
      assert.equal(stored(dom), original);assert.equal(dom.writes.length, 0);
      assert.match(dom.elements.get('error').textContent, /원본을 읽고 보관할 수 있을 때까지/);
      assert.doesNotMatch(dom.elements.get('notice').textContent, /복원했습니다|바꾸었습니다/);
      dom.setThrowGet(false);
      submitSettings(dom, { target: 'https://example.com/recovered' });
      assert.equal(dom.store.get(PRESERVED), original);
      assert.equal(JSON.parse(stored(dom)).config.target, 'https://example.com/recovered');
    } finally { dom.restore(); }
  });

  test(`${variant}: successful original stash cannot turn failed primary form/import writes into success`, async () => {
    for (const action of ['form', 'import']) {
      const original = '{BROKEN-ORIGINAL';
      const dom = await boot(`${variant}-primary-fails-${action}`, { raw: original, shared, rejectSet: key => key === KEY });
      try {
        openSettings(dom);
        if (action === 'form') submitSettings(dom, { target: 'https://example.com/settings' });
        else await importBackup(dom, savedSession({ target: 'https://example.com/import', ordinal: 3, decoys: '', dot: 105 }));
        assert.equal(dom.store.get(PRESERVED), original);
        assert.equal(stored(dom), original);
        assert.equal(dom.elements.get('settings').open, true);
        assert.match(dom.elements.get('error').textContent, /저장할 수 없습니다/);
        assert.doesNotMatch(dom.elements.get('notice').textContent, /복원했습니다|바꾸었습니다|내려받았습니다/);
        dom.setRejectSet(null);
        dom.elements.get('settings').close();
        dom.elements.get('generate').onclick();
        assert.equal(stored(dom), original, 'automatic generation remains locked after failed explicit write');
        dom.elements.get('backup').onclick();
        assert.equal(await exportedText(dom), original, 'backup still exports the exact original');
        openSettings(dom);
        submitSettings(dom, { target: 'https://example.com/success' });
        assert.equal(JSON.parse(stored(dom)).config.target, 'https://example.com/success');
      } finally { dom.restore(); }
    }
  });
}


test('shared public tool retains its isolated primary and preserved-original keys', async () => {
  const original='{SHARED-TOOL-ORIGINAL';
  const dom=await boot('shared-tool-isolation',{raw:original,shared:true,pathname:'/tools/arosaegida/'});
  try {
    dom.store.set(KEY,'PERSONAL-UNCHANGED');
    assert.equal(stored(dom),original);assert.equal(dom.writes.length,0);
    submitSettings(dom,{target:'https://example.com/shared'});
    assert.equal(dom.store.get(KEY),'PERSONAL-UNCHANGED');
    assert.equal(dom.store.get(dom.primaryKey+'-preserved-raw'),original);
    assert.equal(dom.store.has(PRESERVED),false);
    assert.equal(JSON.parse(stored(dom)).config.target,'https://example.com/shared');
  } finally { dom.restore(); }
});

for (const shared of [false,true]) test(`${shared?'shared':'personal'}: normal generation and accepted edits retain primary-write failure notice`,async()=>{
  const raw=savedSession({target:'https://example.com/normal',ordinal:2,decoys:'https://example.com/decoy',dot:110});
  const dom=await boot(`normal-write-notice-${shared}`,{raw,shared,rejectSet:key=>key===KEY});
  try {
    dom.elements.get('generate').onclick();
    assert.match(dom.elements.get('notice').textContent,/저장할 수 없습니다/);
    assert.equal(await editOneCell(dom),true);
    assert.match(dom.elements.get('notice').textContent,/저장할 수 없습니다/);
    assert.equal(stored(dom),raw);
  } finally {dom.restore();}
});
