import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { PRIVATE_PATTERNS } from '../../scripts/build-public.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4';

function externalScripts(html) {
  return [...html.matchAll(/<script\b([^>]*?)><\/script>/gi)].map((match) => {
    const attrs = match[1];
    const src = (attrs.match(/\bsrc="([^"]+)"/) || [])[1] || '';
    return { src, defer: /\bdefer\b/.test(attrs) };
  });
}

function inlineScripts(html) {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

test('admin pages pin and defer supabase ahead of the same dependent scripts', () => {
  const admin = externalScripts(read('admin.html'));
  const community = externalScripts(read('admin-community.html'));
  assert.deepEqual(admin.map((script) => script.src), [
    SUPABASE,
    'pg-util.js',
    'auth.js',
    'admin-session.js',
    'admin-app-model.js',
    'admin-tools.js'
  ]);
  assert.deepEqual(community.map((script) => script.src), [
    SUPABASE,
    'nav.js',
    'pg-util.js',
    'auth.js',
    'admin-session.js',
    'badges.js',
    'admin.js'
  ]);
  assert.equal(admin.every((script) => script.defer), true);
  assert.equal(community.every((script) => script.defer), true);
  for (const name of ['admin.html', 'admin-community.html']) {
    const html = read(name);
    assert.equal(html.includes('@supabase/supabase-js@2"'), false, name);
    assert.equal(html.includes('@supabase/supabase-js@2/'), false, name);
  }
  const adminInlines = inlineScripts(read('admin.html'));
  assert.equal(adminInlines.length, 1);
  assert.match(adminInlines[0], /MAGIC_PLAYGROUND_CONFIG/);
  assert.doesNotMatch(adminInlines[0], /window\.supabase|PgUtil|AdminSession|renderNav/);
  const communityInlines = inlineScripts(read('admin-community.html'));
  assert.equal(communityInlines.length, 2);
  assert.match(communityInlines[0], /MAGIC_PLAYGROUND_CONFIG/);
  assert.match(communityInlines[1], /DOMContentLoaded/);
  assert.match(communityInlines[1], /renderNav\('admin'\)/);
});

function classListFor(node) {
  const readNames = () => String(node.className || '').split(/\s+/).filter(Boolean);
  const write = (names) => { node.className = names.join(' '); };
  return {
    add(...names) {
      const set = new Set(readNames());
      names.forEach((name) => set.add(name));
      write([...set]);
    },
    remove(...names) {
      const drop = new Set(names);
      write(readNames().filter((name) => !drop.has(name)));
    },
    toggle(name, force) {
      const has = readNames().includes(name);
      const should = force === undefined ? !has : Boolean(force);
      if (should) this.add(name);
      else this.remove(name);
      return should;
    },
    contains(name) { return readNames().includes(name); }
  };
}

class El {
  constructor(tag) {
    this.tagName = String(tag || 'DIV').toUpperCase();
    this.className = '';
    this._text = '';
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.parentNode = null;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.style = {};
    this.classList = classListFor(this);
  }

  get textContent() {
    if (this.children.length) return this.children.map((child) => child.textContent).join('');
    return this._text;
  }

  set textContent(value) {
    this._text = value == null ? '' : String(value);
    this.children = [];
  }

  get firstChild() { return this.children[0] || null; }
  get lastElementChild() { return this.children[this.children.length - 1] || null; }

  appendChild(child) {
    if (child && child.isFragment) {
      while (child.firstChild) this.appendChild(child.firstChild);
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[camel] = String(value);
    }
  }

  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  focus() {}
  setSelectionRange() {}

  replaceWith(node) {
    const parent = this.parentNode;
    if (!parent) throw new Error('replaceWith without parent');
    const index = parent.children.indexOf(this);
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = parent;
    parent.children.splice(index, 1, node);
    this.parentNode = null;
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
}

function matchSimple(node, selector) {
  if (selector === 'input:checked') return node.tagName === 'INPUT' && node.checked;
  if (selector.startsWith('.')) return String(node.className || '').split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith('[') && selector.endsWith(']')) {
    const inner = selector.slice(1, -1);
    const eq = inner.indexOf('=');
    if (eq === -1) return Object.prototype.hasOwnProperty.call(node.attributes, inner);
    const name = inner.slice(0, eq);
    const value = inner.slice(eq + 1).replace(/^"|"$/g, '');
    return node.attributes[name] === value;
  }
  return node.tagName === selector.toUpperCase();
}

function matches(node, selector) {
  const parts = selector.trim().split(/\s+/);
  if (!matchSimple(node, parts[parts.length - 1])) return false;
  let current = node.parentNode;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    while (current && !matchSimple(current, parts[index])) current = current.parentNode;
    if (!current) return false;
    current = current.parentNode;
  }
  return true;
}

function click(node) {
  return Promise.all((node.listeners.click || []).slice().map((fn) => fn({ preventDefault() {}, target: node })));
}

function documentFor(root) {
  return {
    body: root,
    documentElement: root,
    createElement: (tag) => new El(tag),
    createDocumentFragment: () => {
      const fragment = new El('#document-fragment');
      fragment.isFragment = true;
      return fragment;
    },
    createTextNode: (text) => {
      const node = new El('#text');
      node.textContent = text;
      return node;
    },
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
    execCommand() { return false; }
  };
}

async function flush() {
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
}

test('reopening an admin tab paints the cached list before the background fetch resolves', async () => {
  const rootEl = new El('div');
  const list = new El('section');
  list.setAttribute('data-admin-list', '');
  for (const name of ['all', 'waiting', 'members']) {
    const button = new El('button');
    button.setAttribute('data-admin-filter', name);
    rootEl.appendChild(button);
  }
  rootEl.appendChild(list);
  const calls = [];
  const context = vm.createContext({
    console,
    document: documentFor(rootEl),
    AdminSession: { ready: Promise.resolve(true) }
  });
  context.window = context;
  vm.runInContext(read('pg-util.js'), context);
  context.PgUtil.fetchJson = (url, options = {}) => new Promise((resolve, reject) => {
    calls.push({
      url,
      method: options.method || 'GET',
      painted: list.textContent,
      loading: list.textContent.includes('불러오는 중')
    });
    calls[calls.length - 1].resolve = resolve;
    calls[calls.length - 1].reject = reject;
  });
  vm.runInContext(read('admin.js'), context);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].loading, true);
  const first = { id: 'post-1', title: '첫 질문', category: '질문', visibility: 'public', status: 'visible', postType: 'note' };
  calls[0].resolve({ items: [first] });
  await flush();
  const card = list.querySelector('article');
  assert.match(card.textContent, /첫 질문/);

  const waiting = rootEl.querySelectorAll('button').find((button) => button.dataset.adminFilter === 'waiting');
  const reopenAll = rootEl.querySelectorAll('button').find((button) => button.dataset.adminFilter === 'all');
  click(waiting);
  await flush();
  calls.at(-1).resolve({ items: [{ id: 'post-2', title: '대기 질문', category: '질문', visibility: 'public', status: 'visible', postType: 'note' }] });
  await flush();
  assert.match(list.textContent, /대기 질문/);

  click(reopenAll);
  await flush();
  const background = calls.at(-1);
  assert.equal(background.method, 'GET');
  assert.equal(background.loading, false);
  assert.match(background.painted, /첫 질문/);
  const restored = list.querySelector('article');
  assert.match(restored.textContent, /첫 질문/);
  background.resolve({ items: [first] });
  await flush();
  assert.equal(list.querySelector('article'), restored, 'unchanged data must not rebuild the list');
  click(waiting);
  await flush();
  calls.at(-1).resolve({ items: [{ id: 'post-2', title: '대기 질문', category: '질문', visibility: 'public', status: 'visible' }] });
  await flush();
  click(reopenAll);
  await flush();
  const next = calls.at(-1);
  next.resolve({ items: [{ id: 'post-3', title: '바뀐 질문', category: '질문', visibility: 'public', status: 'visible' }] });
  await flush();
  assert.match(list.textContent, /바뀐 질문/);
});

test('a member role POST replaces that row and does not refetch the list', async () => {
  const rootEl = new El('div');
  const list = new El('section');
  list.setAttribute('data-admin-list', '');
  for (const name of ['all', 'members']) {
    const button = new El('button');
    button.setAttribute('data-admin-filter', name);
    rootEl.appendChild(button);
  }
  rootEl.appendChild(list);
  const calls = [];
  const rejections = [];
  const onRejection = (error) => rejections.push(error);
  process.on('unhandledRejection', onRejection);
  const context = vm.createContext({
    console,
    document: documentFor(rootEl),
    AdminSession: { ready: Promise.resolve(true) }
  });
  context.window = context;
  try {
    vm.runInContext(read('pg-util.js'), context);
    context.PgUtil.fetchJson = (url, options = {}) => new Promise((resolve, reject) => {
      calls.push({ url, method: options.method || 'GET', body: options.body || '' });
      calls[calls.length - 1].resolve = resolve;
      calls[calls.length - 1].reject = reject;
    });
    vm.runInContext(read('admin.js'), context);
    await flush();
    calls[0].resolve({ items: [] });
    await flush();
    const members = rootEl.querySelectorAll('button').find((button) => button.dataset.adminFilter === 'members');
    click(members);
    await flush();
    calls.at(-1).resolve({ members: [{ userId: 'user-1', nickname: '민수', role: 'member', createdAt: '2026-01-01T00:00:00.000Z' }] });
    await flush();
    const grant = rootEl.querySelectorAll('button').find((button) => button.textContent === '전문가 부여');
    const card = grant.closest('article');
    assert.match(card.textContent, /role 일반회원/);
    const pending = click(grant);
    assert.equal(calls.at(-1).method, 'POST');
    assert.match(calls.at(-1).url, /\/admin-members$/);
    calls.at(-1).reject(Object.assign(new Error('역할을 변경하지 못했습니다.'), { status: 500 }));
    await pending;
    await flush();
    assert.equal(card.parentNode, list, 'failed POST keeps the original row');
    assert.equal(grant.closest('article'), card);
    assert.match(card.textContent, /role 일반회원/);
    assert.match(card.textContent, /역할을 변경하지 못했습니다/);
    assert.equal(card.querySelector('[data-member-status]').classList.contains('is-error'), true);
    assert.equal(calls.filter((call) => call.method === 'GET' && call.url.includes('admin-members')).length, 1);

    const retry = click(grant);
    calls.at(-1).resolve({ ok: true, role: 'expert' });
    await retry;
    await flush();
    assert.equal(calls.filter((call) => call.method === 'GET' && call.url.includes('admin-members')).length, 1);
    assert.match(list.textContent, /role expert/);
    assert.match(list.textContent, /전문가 해제/);
    assert.equal(card.parentNode, null);
    assert.equal(/\blocalStorage\b|\bsessionStorage\b/.test(read('admin.js')), false);
    assert.equal(/\blocalStorage\b|\bsessionStorage\b/.test(read('admin-tools.js')), false);
  } finally {
    process.off('unhandledRejection', onRejection);
  }
  assert.deepEqual(rejections, []);
});

test('permission POST updates one access row locally and a reopened tab does not wait to paint', async () => {
  const rootEl = new El('div');
  const tools = new El('div');
  tools.setAttribute('data-tools-root', '');
  const auth = new El('div');
  auth.setAttribute('data-auth-panel', '');
  rootEl.appendChild(auth);
  rootEl.appendChild(tools);
  const calls = [];
  const rejections = [];
  const onRejection = (error) => rejections.push(error);
  process.on('unhandledRejection', onRejection);
  const context = vm.createContext({
    console,
    URL,
    document: documentFor(rootEl),
    navigator: { clipboard: null },
    location: { origin: 'https://example.test', href: 'https://example.test/admin.html' },
    isSecureContext: true,
    AdminSession: { ready: Promise.resolve(true) }
  });
  context.window = context;
  const payload = {
    pending: [{ id: 'pending-1', email: 'wait@example.com', tool: 'unlock', status: 'pending' }],
    approved: [{ id: 'approved-1', email: 'done@example.com', tool: 'calc', status: 'approved', lifetime: true, createdAt: '2026-01-02T00:00:00.000Z' }],
    availability: { legacy: true, friendApps: true }
  };
  try {
    vm.runInContext(read('pg-util.js'), context);
    vm.runInContext(read('admin-app-model.js'), context);
    assert.ok(context.AdminAppModel);
    context.PgUtil.fetchJson = (url, options = {}) => new Promise((resolve, reject) => {
      calls.push({
        url,
        method: options.method || 'GET',
        painted: tools.textContent,
        loading: tools.textContent.includes('불러오고 있습니다')
      });
      calls[calls.length - 1].resolve = resolve;
      calls[calls.length - 1].reject = reject;
    });
    vm.runInContext(read('admin-tools.js'), context);
    await flush();
    assert.equal(calls.length, 1);
    calls[0].resolve(structuredClone(payload));
    await flush();
    assert.match(tools.textContent, /wait@example.com/);
    const approvedTab = tools.querySelectorAll('button').find((button) => button.textContent.includes('승인 완료'));
    click(approvedTab);
    await flush();
    const background = calls.at(-1);
    assert.equal(background.method, 'GET');
    assert.equal(background.loading, false);
    assert.match(background.painted, /done@example.com/);
    const heading = tools.querySelectorAll('h3').find((node) => node.textContent === 'done@example.com');
    background.resolve(structuredClone(payload));
    await flush();
    assert.equal(tools.querySelectorAll('h3').find((node) => node.textContent === 'done@example.com'), heading);

    const pendingTab = tools.querySelectorAll('button').find((button) => button.textContent.includes('승인 대기'));
    click(pendingTab);
    await flush();
    calls.at(-1).resolve(structuredClone(payload));
    await flush();
    const getsBeforePost = calls.filter((call) => call.method === 'GET').length;
    const approve = tools.querySelectorAll('button').find((button) => button.textContent === '승인');
    const card = approve.closest('.admin-access-card');
    click(approve);
    await flush();
    assert.equal(calls.at(-1).method, 'POST');
    calls.at(-1).reject(Object.assign(new Error('권한을 승인하지 못했습니다.'), { status: 500 }));
    await flush();
    assert.equal(card.parentNode !== null, true);
    assert.match(tools.textContent, /wait@example.com/);
    assert.match(tools.textContent, /권한을 승인하지 못했습니다/);
    assert.equal(calls.filter((call) => call.method === 'GET').length, getsBeforePost);

    click(approve);
    await flush();
    calls.at(-1).resolve({ ok: true });
    await flush();
    assert.equal(calls.filter((call) => call.method === 'GET').length, getsBeforePost);
    assert.equal(tools.textContent.includes('wait@example.com'), false);
  } finally {
    process.off('unhandledRejection', onRejection);
  }
  assert.deepEqual(rejections, []);
});

function headerRules(toml) {
  const rules = [];
  const pattern = /\[\[headers\]\]\s+for = "([^"]+)"\s+\[headers\.values\]([\s\S]*?)(?=\n\[\[|$)/g;
  for (const match of toml.matchAll(pattern)) {
    const values = {};
    for (const line of match[2].split('\n')) {
      const pair = line.match(/^\s+([A-Za-z0-9-]+) = "(.*)"\s*$/);
      if (pair) values[pair[1]] = pair[2];
    }
    rules.push({ for: match[1], values });
  }
  return rules;
}

function cacheControlFor(rules, urlPath) {
  let best = null;
  rules.forEach((rule, index) => {
    if (!Object.prototype.hasOwnProperty.call(rule.values, 'Cache-Control')) return;
    const body = rule.for.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    if (!new RegExp(`^${body}$`).test(urlPath)) return;
    const score = rule.for.replace(/\*/g, '').length * 10 - (rule.for.match(/\*/g) || []).length;
    if (!best || score > best.score || (score === best.score && index > best.index)) {
      best = { score, index, value: rule.values['Cache-Control'] };
    }
  });
  return best && best.value;
}

test('cache headers leave global Cache-Control unset, keep admin private, and long-cache eight profile webp files', () => {
  const toml = read('netlify.toml');
  const rules = headerRules(toml);
  assert.match(toml, /\[\[edge_functions\]\]\s+path = "\/tools\/\*"\s+function = "tools-gate"/);
  assert.match(toml, /\[\[edge_functions\]\]\s+path = "\/tools"\s+function = "tools-gate"/);
  assert.equal(rules.some((rule) => rule.for === '/tools/*' || rule.for === '/tools'), false);
  const global = rules.find((rule) => rule.for === '/*');
  assert.equal(Object.prototype.hasOwnProperty.call(global.values, 'Cache-Control'), false);
  assert.equal(global.values['X-Content-Type-Options'], 'nosniff');
  assert.equal(global.values['Referrer-Policy'], 'strict-origin-when-cross-origin');
  for (const urlPath of ['/admin.html', '/admin-community.html', '/admin']) {
    assert.equal(cacheControlFor(rules, urlPath), 'private, no-store', urlPath);
  }
  const longCached = [
    '/assets/profile/lecture-outdoor-800w.webp',
    '/assets/profile/lecture-outdoor-1200w.webp',
    '/assets/profile/magic-cards-800w.webp',
    '/assets/profile/magic-cards-1200w.webp',
    '/assets/profile/magic-table-800w.webp',
    '/assets/profile/magic-table-1200w.webp',
    '/assets/profile/portrait-800w.webp',
    '/assets/profile/portrait-1200w.webp'
  ];
  for (const urlPath of longCached) {
    assert.equal(cacheControlFor(rules, urlPath), 'public, max-age=2592000', urlPath);
    const rule = rules.find((item) => item.for === urlPath);
    assert.equal(rule.values['Cache-Control'], 'public, max-age=2592000', urlPath);
    assert.equal(rule.for.includes('*'), false, urlPath);
  }
  assert.equal(
    rules.filter((rule) => rule.values['Cache-Control'] === 'public, max-age=2592000').length,
    longCached.length
  );
  assert.equal(toml.includes('/assets/profile/*-800w.webp'), false);
  assert.equal(toml.includes('/assets/profile/*-1200w.webp'), false);
  assert.equal(toml.includes('/assets/**/*.webp'), false);
  for (const urlPath of [
    '/assets/playground/badges/star.webp',
    '/assets/profile/bar-reaction-800w.webp',
    '/assets/profile/portrait.jpg',
    '/index.html',
    '/tools/hitsuzen/manifest.webmanifest'
  ]) {
    assert.equal(cacheControlFor(rules, urlPath), null, urlPath);
  }
  for (const urlPath of ['/tools/stopwatch/sw.js', '/tools/stopwatch-uni/sw.js', '/tools/calc/sw.js', '/legacy-bridges/stopwatch/sw.js']) {
    assert.equal(cacheControlFor(rules, urlPath), 'no-store, no-cache', urlPath);
  }
  assert.equal(toml.includes('immutable'), false);
});

test('public copy and dist safety reject test artifacts', async () => {
  assert.equal(PRIVATE_PATTERNS.some((pattern) => pattern.test('zz4/sw.activation.test.mjs')), true);
  assert.equal(PRIVATE_PATTERNS.some((pattern) => pattern.test('sw.activation.test.mjs')), true);
  assert.equal(PRIVATE_PATTERNS.some((pattern) => pattern.test('tools/demo/app.test.js')), true);
  assert.equal(PRIVATE_PATTERNS.some((pattern) => pattern.test('zz4/sw.js')), false);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dist-safety-'));
  try {
    await writeFile(path.join(dir, 'app.js'), 'console.log("ok");\n');
    const clean = spawnSync(process.execPath, ['scripts/check-dist-safety.mjs', '--dist', dir], { cwd: root, encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stderr);
    await mkdir(path.join(dir, 'zz4'));
    await writeFile(path.join(dir, 'zz4', 'sw.activation.test.mjs'), 'export {}\n');
    await writeFile(path.join(dir, 'notes.test.json'), '{}\n');
    const dirty = spawnSync(process.execPath, ['scripts/check-dist-safety.mjs', '--dist', dir], { cwd: root, encoding: 'utf8' });
    assert.notEqual(dirty.status, 0);
    assert.match(dirty.stderr, /sw\.activation\.test\.mjs/);
    assert.match(dirty.stderr, /notes\.test\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
