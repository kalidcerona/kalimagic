import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { freshState, loadState } from '../../zz12/core.mjs';
import { STACKS } from '../../zz12/data.mjs';

const KEY = 'magic-memdeck-v1';
const VOID = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR']);

function historyEntry(at, mode, total, correct, ms) {
  return { at, mode, total, correct, ms };
}

function practicedState() {
  const state = freshState();
  state.progress.redford.history.push(historyEntry(1710000000000, 'mixed', 8, 4, 3000));
  state.progress.redford.notes['7'] = '별자리';
  state.progress.redford.review['7'] = { step: 2, due: 1800000000000 };
  state.progress.mnemonica.history.push(historyEntry(1710000001000, 'card', 2, 1, 1500));
  state.progress.mnemonica.notes['3'] = '창가';
  return state;
}

function sessionState() {
  const state = practicedState();
  state.session = {
    stack: 'redford', mode: 'mixed', queue: [{ position: 3, direction: 'position' }], index: 0, answered: false, results: [],
  };
  return state;
}

class El {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this.id = '';
    this.value = '';
    this.checked = false;
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.className = '';
    this._html = '';
    this.onclick = null;
    this.onchange = null;
    this.onsubmit = null;
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); },
      contains: (name) => classes.has(name),
    };
  }
  setAttribute(name, value) { this.attrs[name] = String(value); if (name === 'id') this.id = String(value); if (name === 'class') this.className = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(type, fn) { this[`on${type}`] = fn; }
  set innerHTML(html) { this._html = String(html); this.children = parseHTML(String(html)); }
  get innerHTML() { return this._html; }
  insertAdjacentHTML(position, html) {
    const nodes = parseHTML(String(html));
    if (position === 'beforeend') this.children.push(...nodes);
    else this.children.unshift(...nodes);
    this._html += String(html);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }
}

function matches(el, selector) {
  if (selector.startsWith('#')) return el.id === selector.slice(1);
  if (selector.startsWith('.')) return el.classList.contains(selector.slice(1));
  const attr = selector.match(/^\[([^\]]+)\]$/);
  if (attr) return el.getAttribute(attr[1]) != null;
  return el.tagName === selector.toUpperCase();
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(raw))) attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function parseHTML(html) {
  const root = new El('fragment');
  const stack = [root];
  const re = /<\/([a-zA-Z0-9-]+)>|<([a-zA-Z0-9-]+)([^>]*)>/g;
  let match;
  while ((match = re.exec(html))) {
    if (match[1]) {
      const tag = match[1].toUpperCase();
      while (stack.length > 1 && stack.at(-1).tagName !== tag) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }
    const el = new El(match[2]);
    const attrs = parseAttrs(match[3] || '');
    for (const [name, value] of Object.entries(attrs)) {
      el.setAttribute(name, value);
      if (name === 'class') for (const item of value.split(/\s+/).filter(Boolean)) el.classList.add(item);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        el.dataset[key] = value;
      }
    }
    stack.at(-1).children.push(el);
    const selfClosing = /\/\s*$/.test(match[3] || '') || VOID.has(el.tagName);
    if (!selfClosing) stack.push(el);
  }
  return root.children;
}

function installDocument() {
  const html = readFileSync(new URL('../../zz12/index.html', import.meta.url), 'utf8');
  const root = new El('document');
  root.children = parseHTML(html);
  const downloads = [];
  const blobs = [];
  root.querySelector = El.prototype.querySelector;
  root.querySelectorAll = El.prototype.querySelectorAll;
  const documentStub = {
    documentElement: root,
    hidden: false,
    createElement(tag) {
      const el = new El(tag);
      el.click = () => { if (el.download) downloads.push({ name: el.download, href: el.href }); };
      return el;
    },
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
    addEventListener(type, fn) { root.addEventListener(type, fn); },
  };
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => {
    const id = `blob:memdeck-${blobs.length}`;
    blobs.push(blob);
    return id;
  };
  URL.revokeObjectURL = () => {};
  return { documentStub, downloads, blobs, restoreURL() { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; } };
}

function installGlobals(values) {
  const saved = new Map();
  for (const [name, value] of Object.entries(values)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

async function boot(moduleId, storage) {
  const dom = installDocument();
  const restore = installGlobals({
    document: dom.documentStub,
    localStorage: storage.localStorage,
    navigator: { serviceWorker: { register: () => Promise.resolve() } },
  });
  try {
    await import(`../../zz12/app.mjs?memdeck=${moduleId}`);
  } catch (error) {
    restore();
    dom.restoreURL();
    throw error;
  }
  return {
    ...dom,
    restore() { restore(); dom.restoreURL(); },
  };
}

function memoryStorage({ raw, readThrows = false, writeThrows = false, rejectSet = null } = {}) {
  const store = new Map();
  const writes = [];
  if (raw !== undefined) store.set(KEY, raw);
  return {
    store,
    writes,
    setReadThrows(value) { readThrows=value; },
    setRejectSet(value) { rejectSet=value; },
    localStorage: {
      getItem(key) {
        if (readThrows) throw new Error('read failed');
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        if (writeThrows || (rejectSet && rejectSet(key))) throw new Error('write failed');
        writes.push(String(value));
        store.set(key, String(value));
      },
    },
  };
}

function tab(documentStub, name) {
  const button = documentStub.querySelectorAll('[data-tab]').find((item) => item.dataset.tab === name);
  assert.ok(button, `${name} tab exists`);
  button.onclick();
  return button;
}

function file(text) {
  return { size: text.length, text: async () => text };
}

async function savedText(blob) {
  return blob.text();
}

test('memdeck preserves unreadable storage and recovers only from a validated backup', async () => {
  const practiced = JSON.stringify(practicedState());
  const active = JSON.stringify(sessionState());
  assert.doesNotThrow(() => loadState(practiced));
  assert.doesNotThrow(() => loadState(active));
  const corrupt = '{not-json';
  const empty = '';
  const invalid = '{"version":9,"selected":"redford","note":"keep-me"}';
  const secret = 'UNREADABLE-ORIGINAL-BYTES';

  {
    const storage = memoryStorage({ raw: active });
    const app = await boot('valid-session', storage);
    try {
      assert.equal(storage.store.get(KEY), active);
      assert.equal(storage.writes.length, 0);
      assert.ok(app.documentStub.querySelector('#finish'));
      assert.equal(app.documentStub.querySelector('#begin'), null);
      assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent, /복구된 원본/);
    } finally { app.restore(); }
  }

  {
    const storage = memoryStorage({ raw: practiced });
    const app = await boot('valid-actions', storage);
    try {
      assert.equal(storage.store.get(KEY), practiced);
      tab(app.documentStub, 'quiz');
      app.documentStub.querySelector('#begin').onclick();
      const afterQuiz = loadState(storage.store.get(KEY));
      assert.deepEqual(afterQuiz.progress.redford.history, practicedState().progress.redford.history);
      assert.deepEqual(afterQuiz.progress.mnemonica.history, practicedState().progress.mnemonica.history);
      assert.equal(afterQuiz.progress.redford.notes['7'], '별자리');
      assert.equal(afterQuiz.progress.mnemonica.notes['3'], '창가');
      assert.equal(afterQuiz.progress.redford.review['7'].step, 2);
      assert.equal(afterQuiz.selected, 'redford');
      assert.ok(afterQuiz.session);
      app.documentStub.querySelector('#stack').onchange({ target: { value: 'mnemonica' } });
      const afterStack = loadState(storage.store.get(KEY));
      assert.equal(afterStack.selected, 'mnemonica');
      assert.deepEqual(afterStack.progress.redford.history, practicedState().progress.redford.history);
      assert.deepEqual(afterStack.progress.mnemonica.history, practicedState().progress.mnemonica.history);
      assert.equal(afterStack.progress.mnemonica.notes['3'], '창가');
      assert.deepEqual(afterStack.stacks.redford, STACKS.redford.cards);
      assert.deepEqual(afterStack.stacks.mnemonica, STACKS.mnemonica.cards);
    } finally { app.restore(); }
  }

  for (const [moduleId, raw, warning] of [
    ['corrupt-json', corrupt, /형식이 올바르지 않습니다/],
    ['empty-payload', empty, /형식이 올바르지 않습니다/],
    ['invalid-schema', invalid, /형식이 올바르지 않습니다/],
  ]) {
    const storage = memoryStorage({ raw });
    const app = await boot(moduleId, storage);
    try {
      const notice = app.documentStub.querySelector('#notice').textContent;
      assert.match(notice, warning);
      assert.match(notice, /복구된 원본이 아닙니다/);
      assert.match(notice, /그대로 두었습니다/);
      app.documentStub.querySelector('#stack').onchange({ target: { value: 'mnemonica' } });
      tab(app.documentStub, 'quiz');
      app.documentStub.querySelector('#begin').onclick();
      assert.equal(storage.store.get(KEY), raw);
      assert.equal(storage.writes.length, 0);
      tab(app.documentStub, 'settings');
      app.documentStub.querySelector('#stack-json').value = JSON.stringify(STACKS.mnemonica.cards);
      app.documentStub.querySelector('#stack-import').onclick();
      assert.equal(storage.store.get(KEY), raw);
      assert.equal(app.downloads.some((item) => item.name === 'memdeck-before-order-change.json'), false);
      app.documentStub.querySelector('#export').onclick();
      assert.equal(app.downloads.at(-1).name, 'memdeck-original-raw.json');
      assert.equal(await savedText(app.blobs.at(-1)), raw);
      await app.documentStub.querySelector('#import').onchange({ target: { files: [file('{')] } });
      assert.equal(storage.store.get(KEY), raw);
      assert.match(app.documentStub.querySelector('#notice').textContent, /가져오기 실패/);
      assert.match(app.documentStub.querySelector('#notice').textContent, /유지됩니다/);
    } finally { app.restore(); }
  }

  {
    const storage = memoryStorage({ raw: secret, readThrows: true });
    const app = await boot('read-exception', storage);
    try {
      const notice = app.documentStub.querySelector('#notice').textContent;
      assert.match(notice, /읽지 못했습니다/);
      assert.match(notice, /복구된 원본이 아닙니다/);
      app.documentStub.querySelector('#stack').onchange({ target: { value: 'mnemonica' } });
      tab(app.documentStub, 'quiz');
      app.documentStub.querySelector('#begin').onclick();
      assert.equal(storage.writes.length, 0);
      assert.equal(storage.store.get(KEY), secret);
      tab(app.documentStub, 'settings');
      const before = app.downloads.length;
      app.documentStub.querySelector('#export').onclick();
      assert.equal(app.downloads.length, before);
      assert.match(app.documentStub.querySelector('#notice').textContent, /원본 파일을 만들 수 없습니다/);
    } finally { app.restore(); }
  }

  {
    const storage = memoryStorage();
    const app = await boot('missing-data', storage);
    try {
      assert.equal(storage.store.has(KEY), false);
      assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent, /원본/);
      app.documentStub.querySelector('#stack').onchange({ target: { value: 'mnemonica' } });
      const saved = loadState(storage.store.get(KEY));
      assert.equal(saved.selected, 'mnemonica');
      assert.deepEqual(saved.progress.redford.history, []);
      assert.equal(storage.writes.length, 1);
    } finally { app.restore(); }
  }

  {
    const backup = practicedState();
    backup.progress.redford.history[0] = historyEntry(1710000002222, 'position', 6, 5, 900);
    const backupText = JSON.stringify(backup);
    const storage = memoryStorage({ raw: invalid });
    const app = await boot('validated-recovery', storage);
    try {
      tab(app.documentStub, 'settings');
      await app.documentStub.querySelector('#import').onchange({ target: { files: [file(backupText)] } });
      assert.equal(app.downloads[0].name, 'memdeck-original-raw.json');
      assert.equal(await savedText(app.blobs[0]), invalid);
      assert.equal(app.downloads.some((item) => item.name === 'memdeck-before-import.json'), false);
      const saved = loadState(storage.store.get(KEY));
      assert.equal(saved.progress.redford.history[0].correct, 5);
      assert.equal(saved.progress.mnemonica.notes['3'], '창가');
      assert.notEqual(storage.store.get(KEY), invalid);
      assert.match(app.documentStub.querySelector('#notice').textContent, /백업을 가져왔습니다/);
      assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent, /복구된 원본이 아닙니다/);
      app.documentStub.querySelector('#stack').onchange({ target: { value: 'mnemonica' } });
      const after = loadState(storage.store.get(KEY));
      assert.equal(after.selected, 'mnemonica');
      assert.equal(after.progress.redford.history[0].correct, 5);
    } finally { app.restore(); }
  }

  {
    const backup = practicedState();
    backup.selected = 'mnemonica';
    const storage = memoryStorage({ raw: secret, readThrows: true });
    const app = await boot('read-exception-recovery', storage);
    try {
      tab(app.documentStub, 'settings');
      await app.documentStub.querySelector('#import').onchange({ target: { files: [file(JSON.stringify(backup))] } });
      assert.equal(app.downloads.length, 0);
      assert.equal(storage.store.get(KEY), secret);
      assert.equal(storage.writes.length, 0);
      assert.match(app.documentStub.querySelector('#notice').textContent, /원본을 읽고 보관할 수 없어/);
      assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent, /백업을 가져왔습니다/);
      storage.setReadThrows(false);
      await app.documentStub.querySelector('#import').onchange({ target: { files: [file(JSON.stringify(backup))] } });
      assert.equal(storage.store.get(KEY+'-preserved-raw'), secret);
      assert.equal(loadState(storage.store.get(KEY)).selected, 'mnemonica');
    } finally { app.restore(); }
  }

  {
    const storage = memoryStorage({ raw: invalid, writeThrows: true });
    const app = await boot('failed-recovery-write', storage);
    try {
      tab(app.documentStub, 'settings');
      await app.documentStub.querySelector('#import').onchange({ target: { files: [file(practiced)] } });
      assert.equal(storage.store.get(KEY), invalid);
      assert.equal(app.blobs.length, 0, 'failed device preservation does not request original download');
      assert.match(app.documentStub.querySelector('#notice').textContent, /가져오기 실패/);
      assert.match(app.documentStub.querySelector('#notice').textContent, /유지됩니다/);
      tab(app.documentStub, 'records');
      assert.doesNotMatch(app.documentStub.querySelector('#main').innerHTML, /4 \/ 8/);
    } finally { app.restore(); }
  }

  {
    const storage = memoryStorage({ raw: practiced, writeThrows: true });
    const app = await boot('failed-normal-write', storage);
    try {
      app.documentStub.querySelector('#stack').onchange({ target: { value: 'mnemonica' } });
      tab(app.documentStub, 'quiz');
      app.documentStub.querySelector('#begin').onclick();
      assert.equal(storage.store.get(KEY), practiced);
      assert.match(app.documentStub.querySelector('#notice').textContent, /기기에 저장되지 않았습니다/);
      assert.match(app.documentStub.querySelector('#notice').textContent, /이 화면에서 계속할 수 있지만/);
      assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent, /복구된 원본이 아닙니다/);
      assert.equal(app.documentStub.querySelector('#stack').value, 'mnemonica');
      tab(app.documentStub, 'settings');
      app.documentStub.querySelector('#stack-json').value = JSON.stringify(STACKS.mnemonica.cards);
      app.documentStub.querySelector('#stack-import').onclick();
      assert.equal(storage.store.get(KEY), practiced);
      assert.match(app.documentStub.querySelector('#notice').textContent, /쓰지 못해/);
      assert.match(app.documentStub.querySelector('#notice').textContent, /유지됩니다/);
      tab(app.documentStub, 'records');
      assert.match(app.documentStub.querySelector('#main').innerHTML, /1 \/ 2/);
    } finally { app.restore(); }
  }

  {
    const storage = memoryStorage({ raw: practiced });
    const app = await boot('stack-replacement', storage);
    try {
      tab(app.documentStub, 'settings');
      app.documentStub.querySelector('#stack-json').value = JSON.stringify(STACKS.mnemonica.cards);
      app.documentStub.querySelector('#stack-import').onclick();
      const saved = loadState(storage.store.get(KEY));
      assert.deepEqual(saved.stacks.redford, STACKS.mnemonica.cards);
      assert.deepEqual(saved.stacks.mnemonica, STACKS.mnemonica.cards);
      assert.deepEqual(saved.progress.redford.history, []);
      assert.deepEqual(saved.progress.redford.notes, {});
      assert.deepEqual(saved.progress.mnemonica.history, practicedState().progress.mnemonica.history);
      assert.equal(saved.progress.mnemonica.notes['3'], '창가');
      assert.equal(saved.selected, 'redford');
      assert.match(app.documentStub.querySelector('#notice').textContent, /이 스택의 기록을 새로 시작했습니다/);
      assert.equal(app.downloads.some((item) => item.name === 'memdeck-before-order-change.json'), true);
    } finally { app.restore(); }
  }
});

test('memdeck failed device stash never replaces primary or reports imported', async () => {
  const original='{ORIGINAL';
  const storage=memoryStorage({raw:original,rejectSet:key=>key===KEY+'-preserved-raw'});
  const app=await boot('recovery-stash-failure',storage);
  try {
    tab(app.documentStub,'settings');
    await app.documentStub.querySelector('#import').onchange({target:{files:[file(JSON.stringify(practicedState()))]}});
    assert.equal(storage.store.get(KEY),original);assert.equal(storage.writes.length,0);
    assert.match(app.documentStub.querySelector('#notice').textContent,/기기에 따로 보관하지 못해/);
    assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent,/백업을 가져왔습니다/);
    assert.equal(app.downloads.length,0);
  } finally { app.restore(); }
});

test('memdeck failed primary after verified stash keeps original, lock and current records until retry', async () => {
  const original='{ORIGINAL-PRIMARY';
  const storage=memoryStorage({raw:original,rejectSet:key=>key===KEY});
  const app=await boot('recovery-primary-failure',storage);
  try {
    tab(app.documentStub,'settings');
    const backup=JSON.stringify(practicedState());
    await app.documentStub.querySelector('#import').onchange({target:{files:[file(backup)]}});
    assert.equal(storage.store.get(KEY+'-preserved-raw'),original);
    assert.equal(storage.store.get(KEY),original);
    assert.match(app.documentStub.querySelector('#notice').textContent,/가져오기 실패/);
    assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent,/백업을 가져왔습니다/);
    storage.setRejectSet(null);
    app.documentStub.querySelector('#stack').onchange({target:{value:'mnemonica'}});
    assert.equal(storage.store.get(KEY),original,'ordinary save remains blocked');
    tab(app.documentStub,'settings');
    await app.documentStub.querySelector('#import').onchange({target:{files:[file(backup)]}});
    assert.equal(storage.store.get(KEY+'-preserved-raw'),original);
    assert.equal(loadState(storage.store.get(KEY)).progress.redford.notes['7'],'별자리');
    assert.match(app.documentStub.querySelector('#notice').textContent,/백업을 가져왔습니다/);
  } finally { app.restore(); }
});

test('memdeck verified device preservation permits recovery even when browser download is blocked', async () => {
  const original='BROKEN-RAW';
  const storage=memoryStorage({raw:original});
  const app=await boot('recovery-download-blocked',storage);
  const createURL=URL.createObjectURL;
  try {
    tab(app.documentStub,'settings');
    URL.createObjectURL=()=>{throw Error('download blocked');};
    await app.documentStub.querySelector('#import').onchange({target:{files:[file(JSON.stringify(practicedState()))]}});
    assert.equal(storage.store.get(KEY+'-preserved-raw'),original);
    assert.equal(loadState(storage.store.get(KEY)).progress.mnemonica.notes['3'],'창가');
    assert.equal(app.downloads.length,0);
    assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent,/내려받았습니다/);
  } finally { URL.createObjectURL=createURL;app.restore(); }
});

test('memdeck stash readback mismatch blocks primary recovery', async () => {
  const original='{MISMATCH-ORIGINAL';
  const storage=memoryStorage({raw:original});
  const read=storage.localStorage.getItem;
  storage.localStorage.getItem=key=>key===KEY+'-preserved-raw'?'mismatch':read(key);
  const app=await boot('recovery-verify-mismatch',storage);
  try {
    tab(app.documentStub,'settings');
    await app.documentStub.querySelector('#import').onchange({target:{files:[file(JSON.stringify(practicedState()))]}});
    assert.equal(storage.store.get(KEY),original);
    assert.doesNotMatch(app.documentStub.querySelector('#notice').textContent,/백업을 가져왔습니다/);
  } finally { app.restore(); }
});
