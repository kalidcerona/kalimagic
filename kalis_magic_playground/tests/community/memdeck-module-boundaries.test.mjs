import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { resolveObjectURL } from 'node:buffer';
import { pathToFileURL } from 'node:url';

// Loads the memdeck practice app (zz12) the way its index.html does: first-run-guide.js is a classic deferred
// script evaluated for real, then app.mjs is dynamically imported with its real imports (core.mjs, mnemonic.mjs,
// data.mjs) as separate ES modules. A module that uses an identifier it does not import throws ReferenceError
// here, as it does in a browser. The DOM is parsed from the real index.html; a missing id returns null and nothing
// is auto-created. app.mjs renders through innerHTML, so the stub parses that HTML into elements.
// Drives boot, the first-run guide, the study tabs, the quiz and weak-card flow, the four-of-a-kind (rank) flow,
// the memory trainer (pair, image, palace, story, review), settings export/import/order import, storage failure
// and the wake lock re-request on visibilitychange (the stub, like a browser, releases the lock on hide).
// MEMDECK_ROOT lets a mutation check point the same test at a scratch copy.
// Not covered: the corrupt-storage recovery path (needs a fresh evaluation of the module), the
// local-preview query hook and the service worker file itself. No friend snapshot of this app exists.
const root = process.env.MEMDECK_ROOT ? pathToFileURL(`${process.env.MEMDECK_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz12/', import.meta.url);

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
afterEach(async () => {
  await settle(5);
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
});
const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function listenerHost(target) {
  target.listeners = {};
  target.addEventListener = (type, fn, options) => {
    (target.listeners[type] ||= []).push({ fn, capture: options === true || !!(options && options.capture), once: !!(options && options.once) });
  };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item.fn !== fn); };
}

let document;
let window;
// ----- selector matching (the subset the app uses) -----
const PIECE = /^(?:([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\])/;
function parseCompound(source) {
  const tests = [];
  let rest = source;
  while (rest) {
    const m = rest.match(PIECE);
    if (!m) throw new Error(`stub: unsupported selector part "${source}"`);
    if (m[1]) tests.push({ tag: m[1].toLowerCase() });
    else if (m[2]) tests.push({ id: m[2] });
    else if (m[3]) tests.push({ cls: m[3] });
    else if (m[4]) tests.push({ attr: m[4], op: m[5] || '', val: m[6] ?? m[7] ?? m[8] ?? '' });
    rest = rest.slice(m[0].length);
  }
  return tests;
}
function parseSelector(selector) {
  return selector.split(',').map((part) => {
    const chain = [];
    let comb = ' ';
    for (const token of part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/)) {
      if (token === '>') { comb = '>'; continue; }
      chain.push({ tests: parseCompound(token), comb });
      comb = ' ';
    }
    return chain;
  });
}
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function attrValue(el, name) {
  if (name.startsWith('data-')) { const v = el.dataset[camel(name.slice(5))]; return v === undefined ? null : String(v); }
  if (name === 'id') return el.id || null;
  if (name === 'hidden') return el.hidden ? '' : null;
  return el.attrs.has(name) ? el.attrs.get(name) : null;
}
function matchCompound(el, tests) {
  return tests.every((t) => {
    if (t.tag) return t.tag === '*' || el.tag === t.tag;
    if (t.id) return el.id === t.id;
    if (t.cls) return el.classes.has(t.cls);
    const v = attrValue(el, t.attr);
    if (v === null) return false;
    if (t.op === '') return true;
    if (t.op === '=') return v === t.val;
    throw new Error(`stub: unsupported attribute operator ${t.op}`);
  });
}
function matchChain(el, chain, i) {
  if (!matchCompound(el, chain[i].tests)) return false;
  if (i === 0) return true;
  if (chain[i].comb === '>') return Boolean(el.parentElement) && matchChain(el.parentElement, chain, i - 1);
  for (let p = el.parentElement; p; p = p.parentElement) if (matchChain(p, chain, i - 1)) return true;
  return false;
}
const matchesSelector = (el, selector) => parseSelector(selector).some((chain) => matchChain(el, chain, chain.length - 1));

const downloads = [];
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.id = ''; this.dataset = {}; this.children = []; this.parentElement = null;
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this._text = '';
    this.style = {}; this.attrs = new Map(); this.classes = new Set(); this.files = null;
    listenerHost(this);
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, force) => { const on = force === undefined ? !this.classes.has(name) : !!force; on ? this.classes.add(name) : this.classes.delete(name); return on; },
    };
  }
  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); this.children.forEach((child) => { child.parentElement = null; }); this.children = []; }
  set innerHTML(value) { this.replaceChildren(...parseHtml(String(value)).top.children); }
  get isConnected() { let node = this; while (node.parentElement) node = node.parentElement; return node.tag === '#root'; }
  get elements() { return new Proxy({}, { get: (_, name) => this.querySelector(`[name="${name}"]`) }); }
  insertAdjacentHTML(where, html) { assert.equal(where, 'beforeend'); this.append(...parseHtml(String(html)).top.children); }
  setAttribute(key, value) {
    this.attrs.set(key, String(value));
    if (key === 'id') this.id = String(value);
    if (key === 'class') this.className = value;
    if (key === 'hidden') this.hidden = true;
    if (key.startsWith('data-')) this.dataset[camel(key.slice(5))] = String(value);
  }
  removeAttribute(key) {
    this.attrs.delete(key);
    if (key.startsWith('data-')) delete this.dataset[camel(key.slice(5))];
  }
  getAttribute(key) { return attrValue(this, key); }
  appendChild(node) { this.append(node); return node; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      node.parentElement = this; this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children.forEach((child) => { child.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
  matches(selector) { return matchesSelector(this, selector); }
  querySelectorAll(selector) {
    const chains = parseSelector(selector);
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (chains.some((chain) => matchChain(child, chain, chain.length - 1))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
  click() {
    // Anchors with a download name are what app.mjs uses to hand files to the user; record the blob they point at.
    if (this.tag === 'a' && this.download) downloads.push({ name: this.download, blob: resolveObjectURL(this.href) });
  }
}

// ----- parse real HTML into the stub DOM; nothing is created on demand -----
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
const SKIP_CONTENT = new Set(['script', 'style', 'noscript']);
const decode = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function parseHtml(source) {
  const top = new FakeElement('#root');
  const stack = [top];
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
  const attr = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = token.exec(source))) {
    if (m[1]) {
      const name = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) if (stack[i].tag === name) { stack.length = i; break; }
      continue;
    }
    if (m[2]) {
      const el = new FakeElement(m[2]);
      for (const [, k, a, b, c] of m[3].matchAll(attr)) {
        const v = decode(a ?? b ?? c ?? '');
        el.setAttribute(k, v);
        if (k === 'checked') el.checked = true;
        if (k === 'disabled') el.disabled = true;
        if (k === 'value') el.value = v;
      }
      stack[stack.length - 1].append(el);
      if (SKIP_CONTENT.has(el.tag)) {
        token.lastIndex = source.toLowerCase().indexOf(`</${el.tag}>`, token.lastIndex) + el.tag.length + 3;
        continue;
      }
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] && stack.length > 1) stack[stack.length - 1]._text += decode(m[5]).trim();
  }
  for (const area of top.querySelectorAll('textarea')) area.value = area._text;
  for (const select of top.querySelectorAll('select')) {
    const first = select.querySelector('option');
    if (first) select.value = first.attrs.has('value') ? first.attrs.get('value') : first._text;
  }
  return { top };
}

function stubBrowser() {
  const store = new Map();
  const storage = { failWrites: false };
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { if (storage.failWrites) throw new Error('QuotaExceededError'); store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  const { top } = parseHtml(readFileSync(new URL('index.html', root), 'utf8'));
  const htmlEl = top.children.find((child) => child.tag === 'html');
  const body = htmlEl.children.find((child) => child.tag === 'body');
  const head = htmlEl.children.find((child) => child.tag === 'head');

  document = {
    activeElement: null, visibilityState: 'visible', readyState: 'loading', title: head.querySelector('title')._text,
    body, head, documentElement: htmlEl,
    get hidden() { return this.visibilityState === 'hidden'; },
    getElementById: (id) => top.querySelector(`#${id}`),
    querySelector: (selector) => top.querySelector(selector),
    querySelectorAll: (selector) => top.querySelectorAll(selector),
    createElement: (tag) => new FakeElement(tag),
  };
  listenerHost(document);

  const wake = { requests: [] };
  const clipboard = { written: [], writeText: async (text) => { clipboard.written.push(text); } };
  const navigator = {
    userAgent: 'node-test', platform: 'node', maxTouchPoints: 0, registered: [], clipboard,
    wakeLock: {
      request: async (type) => {
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { if (name === 'release') lock.handlers.push(fn); };
        lock.release = async () => { lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        wake.requests.push(lock);
        return lock;
      },
    },
    serviceWorker: { register: async (url) => { navigator.registered.push(url); } },
  };
  // The browser, not the page, releases a screen wake lock when the document becomes hidden. Registered before
  // any page script, so it runs first on visibilitychange. The tests never release a lock on the app's behalf.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const lock of wake.requests) if (!lock.released) lock.release();
  });

  const location = { hash: '', search: '', hostname: 'example.test', pathname: '/zz12/index.html' };
  window = { document, localStorage, location, navigator, setTimeout, clearTimeout };
  listenerHost(window);

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('localStorage', localStorage);
  return { store, storage, localStorage, wake, navigator, clipboard };
}

// Dispatches like a browser: capture from window down, then bubble up. Property handlers (onclick, onchange,
// onsubmit) run on the bubble pass, as the app assigns them. A throwing or rejecting listener is a test error.
async function fire(target, type, init = {}) {
  const event = {
    type, target, cancelable: true, defaultPrevented: false, stopped: false, immediate: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = true; this.immediate = true; }, ...init,
  };
  const chain = [];
  if (target !== window) {
    if (target !== document) for (let node = target; node; node = node.parentElement) chain.push(node);
    chain.push(document);
  }
  chain.push(window);
  const handlerOf = (node) => (typeof node[`on${type}`] === 'function' ? node[`on${type}`] : null);
  assert.ok(chain.some((node) => (node.listeners[type] || []).length > 0 || handlerOf(node)), `a listener is registered for ${type}`);
  const pending = [];
  const call = (node, fn) => {
    try {
      const result = fn.call(node, event);
      if (result && typeof result.then === 'function') pending.push(result);
    } catch (error) { errors.push(`uncaught listener error on ${type}: ${error?.stack || error}`); }
  };
  const run = (node, capture) => {
    for (const entry of [...(node.listeners[type] || [])]) {
      if (event.immediate) return;
      if (entry.capture !== capture) continue;
      if (entry.once) node.removeEventListener(type, entry.fn);
      call(node, entry.fn);
    }
    if (!capture && handlerOf(node) && !event.immediate) call(node, handlerOf(node));
  };
  for (const capture of [true, false]) {
    for (const node of capture ? [...chain].reverse() : chain) {
      run(node, capture);
      if (event.stopped) break;
    }
    if (event.stopped) break;
  }
  for (const result of await Promise.allSettled(pending)) if (result.status === 'rejected') errors.push(`rejected listener on ${type}: ${result.reason?.stack || result.reason}`);
  return event;
}

const pageScripts = (() => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(([, attrs, body]) => ({
    src: attrs.match(/\bsrc="([^"]+)"/)?.[1] || null, module: /type="module"/.test(attrs), defer: /\bdefer\b/.test(attrs), body,
  }));
})();

const env = stubBrowser();
const STORE_KEY = 'magic-memdeck-v1';
const $ = (selector) => document.querySelector(selector);
const need = (selector) => { const el = $(selector); assert.ok(el, `the page rendered ${selector}`); return el; };
const click = (selector) => fire(need(selector), 'click');
const tab = (name) => click(`[data-tab="${name}"]`);
const train = (name) => click(`[data-train="${name}"]`);
const stored = () => JSON.parse(env.localStorage.getItem(STORE_KEY));
const notice = () => need('#notice').textContent;
const submit = (selector = '#answer-form') => fire(need(selector), 'submit');
// Plain fields have no listener (the app reads them on click); only a 'change' is dispatched, for the selects that handle it.
const input = async (selector, value, type = null) => { const el = need(selector); el.value = value; if (type) await fire(el, type); };

let data;
let deck = () => data.STACKS.redford.cards;
const label = (card) => data.label(card);

// Reads which position the current drill prompt shows (card label or position number), then answers it.
function shownPosition() {
  const big = need('.practice-card .big');
  const span = big.querySelector('span');
  return span ? deck().findIndex((card) => label(card) === span.textContent) + 1 : Number(big.textContent);
}
async function answerShown(correct) {
  const pos = shownPosition();
  if (need('#answer-form').querySelector('#rank')) {
    const card = correct ? deck()[pos - 1] : deck()[pos % 52];
    need('#rank').value = card.slice(0, -1);
    need('#suit').value = card.slice(-1);
  } else {
    need('#number').value = String(correct ? pos : (pos % 52) + 1);
  }
  await submit();
  return pos;
}
const statsOf = (pos) => JSON.stringify(stored().progress.redford.stats[pos] ?? null);

test('boot: first-run-guide.js runs as a classic script, then app.mjs and its real imports load and render the study tab', async () => {
  assert.deepEqual(pageScripts.map((s) => [s.src, s.module, s.defer]), [['./first-run-guide.js', false, true], ['./update-prompt.js', false, true], ['app.mjs', true, false]]);
  data = await import(new URL('data.mjs', root));
  runInThisContext(readFileSync(new URL('first-run-guide.js', root), 'utf8'), { filename: 'first-run-guide.js' });
  await import(new URL('app.mjs', root));
  document.readyState = 'complete';
  await fire(document, 'DOMContentLoaded');
  await settle();

  assert.equal(document.title, '멤덱 연습실');
  assert.equal(need('[data-tab="study"]').getAttribute('aria-current'), 'page');
  assert.equal(need('[data-tab="quiz"]').getAttribute('aria-current'), 'false');
  assert.equal(need('#stack').value, 'redford');
  assert.equal(need('.pill').textContent, '1 / 52');
  assert.equal(need('#flip .big span').textContent, 'Q♥', 'Redford position 1 is the queen of hearts');
  assert.equal(need('#flip .big span').classes.has('red'), true);
  assert.equal(need('.association').textContent, '기억 탭에서 장면을 적을 수 있습니다.');
  assert.equal(need('.metric strong').textContent, '0%');
  assert.deepEqual(env.navigator.registered, ['./sw.js']);
  assert.equal(env.localStorage.getItem(STORE_KEY), null, 'rendering alone does not write the saved state');
  assert.equal(notice(), '');
});

test('first-run guide: shown over the study tab, traps keys and touches, dismiss removes it and stores the flag', async () => {
  const overlay = need('.first-run-guide');
  assert.equal(need('#first-run-guide-title').textContent, '설정 여는 방법');
  assert.equal(need('#first-run-guide-text').textContent, '화면 위 메뉴에서\n설정을 누르세요.');
  assert.equal(need('.first-run-guide__mark').textContent, '≡', 'memdeck variant has the menu mark, not fingers');
  assert.ok(document.head.querySelector('#first-run-guide-styles'), 'guide styles are installed once');
  const dismiss = need('.first-run-guide__card button');
  assert.equal(dismiss.textContent, '알겠어요');
  assert.equal(document.activeElement, dismiss, 'focus moves to the dismiss button');
  const key = 'first-settings-guide:v1:memdeck:/zz12';
  assert.equal(env.localStorage.getItem(key), null);

  const tabbed = await fire(overlay, 'keydown', { key: 'Tab' });
  assert.equal(tabbed.defaultPrevented, true, 'Tab is trapped inside the guide');
  const touched = await fire(overlay, 'touchstart');
  assert.equal(touched.stopped, true, 'touches on the guide do not reach the app');

  await fire(dismiss, 'click');
  assert.equal($('.first-run-guide'), null, 'overlay removed');
  assert.equal(env.localStorage.getItem(key), '1');
});

test('wake lock: requested on boot, released by the browser when hidden, requested again when visible', async () => {
  assert.equal(env.wake.requests.length, 1);
  assert.equal(env.wake.requests[0].type, 'screen');
  assert.equal(env.wake.requests[0].released, false);
  document.visibilityState = 'hidden';
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests[0].released, true, 'the hidden page lost its lock');
  assert.equal(env.wake.requests.length, 1, 'no request while hidden');
  document.visibilityState = 'visible';
  await fire(document, 'visibilitychange');
  await settle();
  assert.equal(env.wake.requests.length, 2, 'visible again requests a new lock');
  assert.equal(env.wake.requests[1].released, false);
});

test('study: next, study mode, range buttons and an invalid range message from core.range', async () => {
  await click('#next');
  assert.equal(need('.pill').textContent, '2 / 52');
  assert.equal(need('#flip .big span').textContent, '2♠');
  await input('#study-mode', 'position', 'change');
  assert.equal(need('#flip .big').textContent, '2', 'position mode shows only the number');
  assert.equal(need('#flip .caption').textContent, '떠올린 뒤 눌러서 확인');
  await click('#flip');
  assert.equal(need('#flip .big span').textContent, '2♠', 'flip reveals the card');
  await input('#study-mode', 'pair', 'change');
  await click('[data-range="13"]');
  assert.equal(need('.pill').textContent, '1 / 13');
  assert.equal(need('[data-range="13"]').classes.has('selected'), true);
  need('#start').value = '5';
  need('#end').value = '3';
  await click('#apply-range');
  assert.equal(notice(), '범위는 1-52 사이의 시작·끝 번호를 입력하세요.');
});

test('stack switch saves the selection and shows the other stack in its own order', async () => {
  await input('#stack', 'mnemonica', 'change');
  assert.equal(stored().selected, 'mnemonica');
  assert.equal(need('#flip .big span').textContent, '4♣', 'Mnemonica position 1 is the four of clubs');
  assert.equal(need('.metric span').textContent, '전체 정답률');
  await input('#stack', 'redford', 'change');
  assert.equal(stored().selected, 'redford');
  assert.equal(need('#flip .big span').textContent, 'Q♥');
});

let weakPos;
test('quiz (card to number): a right answer and a wrong answer are graded, saved and listed as history and weak cards', async () => {
  await tab('quiz');
  await input('#mode', 'card', 'change');
  await click('#begin');
  const session = stored().session;
  assert.equal(session.mode, 'card');
  assert.equal(session.queue.length, 13, 'range 1-13 from the study tab is kept');
  const [q1, q2] = session.queue;
  assert.equal(need('.pill').textContent, '1 / 13');
  assert.equal(need('.practice-card .big span').textContent, label(deck()[q1.position - 1]));
  assert.equal(need('.practice-card .caption').textContent, '몇 번째일까요?');

  need('#number').value = String(q1.position);
  await submit();
  assert.equal(need('.feedback').classes.has('error'), false);
  assert.ok(need('.feedback').textContent.startsWith('정답입니다'));
  const afterFirst = stored();
  assert.equal(afterFirst.session.answered, true);
  assert.deepEqual({ ...afterFirst.progress.redford.stats[q1.position], totalMs: 0 }, { attempts: 1, correct: 1, wrong: 0, slow: 0, totalMs: 0 });
  assert.equal(afterFirst.progress.redford.review[q1.position].step, 1, 'a first right answer schedules review at step 1');

  await click('#next-question');
  assert.equal(need('.pill').textContent, '2 / 13');
  need('#number').value = String((q2.position % 52) + 1);
  await submit();
  assert.equal(need('.feedback').classes.has('error'), true);
  assert.ok(need('.feedback').textContent.startsWith('다시 기억해 두세요'));
  weakPos = q2.position;
  const wrong = stored().progress.redford;
  assert.equal(wrong.stats[weakPos].wrong, 1);
  assert.equal(wrong.review[weakPos].step, 0);

  await click('#finish');
  assert.equal(stored().session, null);
  assert.equal(stored().progress.redford.history[0].mode, 'card');
  assert.deepEqual([stored().progress.redford.history[0].total, stored().progress.redford.history[0].correct], [2, 1]);
  assert.match(notice(), /^이번 연습: 2장 중 1장 정답 · 평균 \d+\.\d초$/);
  assert.equal(need('[data-tab="records"]').getAttribute('aria-current'), 'page');
  assert.deepEqual(document.querySelectorAll('.stats-grid strong').map((el) => el.textContent), ['2', '50%', '1']);
  const cells = document.querySelectorAll('.stack-cell.weak');
  assert.equal(cells.length, 1);
  assert.equal(cells[0].querySelector('span').textContent, `${weakPos}번`);
  assert.equal(cells[0].querySelector('strong span').textContent, label(deck()[weakPos - 1]));
});

test('weak-card practice (number to card) quizzes only the missed card and finishes with a result', async () => {
  await click('#weak-practice');
  assert.equal(need('[data-tab="quiz"]').getAttribute('aria-current'), 'page');
  assert.equal(need('#weak-only').checked, true);
  await input('#mode', 'position', 'change');
  await click('#begin');
  const session = stored().session;
  assert.equal(session.mode, 'position');
  assert.deepEqual(session.queue.map((q) => q.position), [weakPos], 'only the weak card is asked');
  assert.equal(need('.practice-card .big').textContent, String(weakPos));
  assert.equal(need('.practice-card .caption').textContent, '번째 카드');
  assert.equal($('#next-question'), null, 'no next button before answering');
  const card = deck()[weakPos - 1];
  need('#rank').value = card.slice(0, -1);
  need('#suit').value = card.slice(-1);
  await submit();
  assert.deepEqual({ ...stored().progress.redford.stats[weakPos], totalMs: 0 }, { attempts: 2, correct: 1, wrong: 1, slow: 0, totalMs: 0 });
  assert.equal(need('#next-question').textContent, '결과 보기');
  await click('#next-question');
  assert.match(notice(), /^이번 연습: 1장 중 1장 정답 · 평균 \d+\.\d초$/);
  assert.equal(stored().progress.redford.history[0].mode, 'position');
  const rows = document.querySelectorAll('tbody tr');
  assert.equal(rows[0].querySelectorAll('td')[1].textContent, '번호 → 카드');
  assert.equal(rows[0].querySelectorAll('td')[2].textContent, '1 / 1');
});

test('four-of-a-kind (rank): bad answers are rejected by core, good answers are saved with the rank record', async () => {
  await tab('rank');
  await input('#choose-rank', 'K');
  await click('#begin-rank');
  assert.equal(stored().session.mode, 'rank');
  assert.deepEqual(stored().session.queue, ['K']);
  assert.equal(need('.rank-progress').textContent, '1 / 1');
  assert.equal(need('.practice-card .big').textContent, 'K');

  const form = need('#rank-form');
  for (const suit of ['S', 'H', 'D', 'C']) form.elements[suit].value = '1';
  await submit('#rank-form');
  assert.equal(notice(), '각 무늬에 서로 다른 1-52 정수 번호 네 개를 입력하세요.');
  assert.equal(stored().session.answered, false);

  for (const suit of ['S', 'H', 'D', 'C']) form.elements[suit].value = String(deck().indexOf(`K${suit}`) + 1);
  await submit('#rank-form');
  assert.ok(need('.feedback').textContent.startsWith('네 장 모두 정답입니다'));
  assert.equal(need('.feedback').classes.has('error'), false);
  const rankStats = stored().progress.redford.rankStats.K;
  assert.deepEqual([rankStats.attempts, rankStats.correct], [1, 1]);
  assert.equal(document.querySelectorAll('.feedback p').length, 4);
  assert.ok(document.querySelectorAll('.feedback p')[0].textContent.startsWith('✓ 정답'));
  await click('#next-question');
  assert.equal(notice(), '포카드 연습: 1종 중 1종 네 장 모두 정답');
  assert.equal(stored().session, null);
  assert.equal(stored().progress.redford.rankHistory[0].correct, 1);
  const rankRows = document.querySelectorAll('tbody tr');
  assert.equal(rankRows.some((row) => row.querySelectorAll('td')[0]?.textContent === 'K'), true, 'records list the K rank');
});

test('memory pair drill: cued, wrong and right attempts are told apart, retries are queued, the summary counts them', async () => {
  await tab('memory');
  assert.equal(need('[data-train="pair"]').getAttribute('aria-pressed'), 'true');
  await click('#start-pair');
  assert.equal(need('.pill').textContent, '1 / 5 · 짝');
  assert.match(need('.practice-card .caption').textContent, /번과 같이 보기$/);

  const before1 = JSON.stringify(stored().progress.redford.stats);
  const pos1 = await answerShown(true);
  const name1 = label(deck()[pos1 - 1]);
  assert.equal(notice(), `답은 맞습니다. ${name1}는 ${pos1}번. 단서가 있어 맞춘 기록에 넣지 않습니다.`);
  assert.equal(stored().progress.redford.recall[pos1].hinted, 1);
  assert.equal(JSON.stringify(stored().progress.redford.stats), before1, 'an unconcealed pair is not a direct recall');

  await click('#next-drill');
  assert.equal(need('.pill').textContent, '2 / 6 · 짝', 'the cued pair is queued once more as a direct attempt');
  await click('#conceal');
  const pos2 = shownPosition();
  const before2 = JSON.parse(statsOf(pos2) === 'null' ? '{"attempts":0,"wrong":0}' : statsOf(pos2));
  await answerShown(false);
  assert.equal(notice(), `직접 오답입니다. ${label(deck()[pos2 - 1])}는 ${pos2}번. 복습으로 돌아갑니다.`);
  assert.equal(stored().progress.redford.recall[pos2].directWrong, 1);
  const after2 = stored().progress.redford.stats[pos2];
  assert.deepEqual([after2.attempts, after2.wrong], [before2.attempts + 1, before2.wrong + 1]);
  assert.equal(need('.feedback').classes.has('error'), true);

  await click('#next-drill');
  assert.equal(need('.pill').textContent, '3 / 7 · 짝');
  await click('#conceal');
  const pos3 = await answerShown(true);
  assert.equal(notice(), `직접 맞췄습니다. ${label(deck()[pos3 - 1])}는 ${pos3}번. 복습 간격에 반영합니다.`);
  assert.equal(stored().progress.redford.recall[pos3].directCorrect, 1);
  await click('#end-drill');
  assert.equal(notice(), '직접 맞춤 1 · 직접 오답 1 · 단서 1 · 답 보기 0');
  assert.equal(need('#start-pair').textContent, '시작', 'back to the pair setup');
});

const SCENE = '불꽃 & <b>"큰" 장면</b>';
test('memory image: saving checks storage failure, stores the scene and the study tab shows it escaped', async () => {
  await train('image');
  await input('#num-image', '촛불 하나');
  await input('#card-image', '왕비 하트');
  await input('#scene-text', SCENE);
  env.storage.failWrites = true;
  await click('#save-image');
  assert.ok(notice().startsWith('기기에 저장되지 않았습니다.'), 'a failed write is reported, not hidden');
  assert.equal(stored().progress.redford.mnemonics.images['1'], undefined, 'nothing was stored');
  env.storage.failWrites = false;
  await click('#save-image');
  assert.equal(notice(), '1번 장면을 저장했습니다.');
  const saved = stored().progress.redford;
  assert.deepEqual(saved.mnemonics.images['1'], { numberImage: '촛불 하나', cardImage: '왕비 하트', scene: SCENE });
  assert.equal(saved.notes['1'], SCENE);

  await tab('study');
  await click('[data-range="13"]');
  assert.equal(need('.association').textContent, SCENE, 'escapeHTML kept the markup as text');
  assert.equal(need('.association').querySelector('b'), null);
});

test('memory image drill: scene, cue and direct stages are asked in order and a cued answer is not a direct record', async () => {
  await tab('memory');
  await train('image');
  await click('#start-image');
  assert.equal(need('.pill').textContent, '1 / 15 · 장면');
  const pos = shownPosition();
  const scene = need('.association').textContent;
  if (pos === 1) assert.equal(scene, SCENE);
  else assert.match(scene, /^.+ 옆에 .+가 있다\.$/);
  const statsBefore = statsOf(pos);
  const hintedBefore = stored().progress.redford.recall[pos]?.hinted ?? 0;
  await answerShown(true);
  assert.equal(stored().progress.redford.recall[pos].hinted, hintedBefore + 1);
  assert.equal(statsOf(pos), statsBefore, 'a scene pass leaves quiz stats alone');
  await click('#next-drill');
  assert.equal(need('.pill').textContent, '2 / 15 · 단서');
  await click('#end-drill');
  assert.equal(notice(), '직접 맞춤 0 · 직접 오답 0 · 단서 1 · 답 보기 0');
});

test('memory palace: example loci are editable and savable, walking shows saved and starter scenes, the quiz can reveal', async () => {
  await train('palace');
  assert.ok(need('.hint').textContent.startsWith('지금 보이는 장소는 예시입니다.'));
  assert.deepEqual(document.querySelectorAll('.locus-name').map((el) => el.value), ['현관문', '신발장', '거실 소파', '식탁', '주방 싱크']);
  await input('.locus-name', '현관 매트');
  await click('#add-locus');
  assert.equal(document.querySelectorAll('.locus-name').length, 6);
  assert.deepEqual(document.querySelectorAll('.locus-pos').map((el) => el.value).at(-1), '6');
  assert.equal(document.querySelectorAll('.locus-name')[0].value, '현관 매트', 'the edit survives the draft re-render');
  await click('#save-palace');
  assert.equal(notice(), '궁전을 이 스택에 저장했습니다.');
  assert.deepEqual(stored().progress.redford.mnemonics.palace, {
    title: '우리 집',
    loci: [['현관 매트', 1], ['신발장', 2], ['거실 소파', 3], ['식탁', 4], ['주방 싱크', 5]].map(([name, position]) => ({ name, position })),
  });
  assert.equal($('.hint'), null, 'saved palace no longer shows the example hint');

  await click('#start-walk');
  assert.equal(need('.locus-title').textContent, '현관 매트');
  assert.equal(need('.practice-card .caption').textContent, '1번');
  assert.equal(need('.association').textContent, `= 1번${SCENE}`, 'walk shows the saved scene for position 1');
  await click('#walk-next');
  assert.equal(need('.locus-title').textContent, '신발장');
  assert.equal(need('.association').textContent, '= 2번백조 옆에 두 점 검은 삽가 있다.', 'starter scene: peg 2 beside the 2 of spades');
  await click('#conceal');
  assert.equal(need('.practice-card .caption').textContent, '카드와 번호를 가렸습니다');
  assert.equal($('.association'), null);

  await click('#start-palace');
  assert.equal(need('.pill').textContent, '1 / 5 · 직접');
  await click('#reveal-answer');
  assert.match(notice(), /^답을 열었습니다\. .+ 맞춘 기록에 넣지 않습니다\.$/);
  const revealed = Object.entries(stored().progress.redford.recall).filter(([, r]) => r.revealed === 1);
  assert.equal(revealed.length, 1);
  await click('#next-drill');
  assert.equal(need('.pill').textContent, '2 / 6 · 직접', 'the revealed card comes back as a retry');
  await click('#end-drill');
  assert.equal(notice(), '직접 맞춤 0 · 직접 오답 0 · 단서 0 · 답 보기 1');
});

test('memory story: range limit, starter story, cue shows the story, save and delete go through the validated store', async () => {
  await train('story');
  need('#mem-start').value = '1';
  need('#mem-end').value = '9';
  await click('#mem-apply');
  assert.equal(notice(), '이야기는 한 번에 8장까지입니다.');
  need('#mem-end').value = '5';
  await click('#mem-apply');
  assert.equal(notice(), '');
  const text = need('#story-text').value;
  assert.ok(text.startsWith('촛불가 왕비 붉은 심장를 만난다. 백조가 두 점 검은 삽를 만난다.'));
  assert.equal(document.querySelectorAll('.order-line > span').length, 5);
  assert.equal(need('.order-line > span').textContent, '1');
  assert.equal(need('.order-line > span span').textContent, 'Q♥');

  await click('#start-story');
  assert.equal(need('.pill').textContent, '1 / 5 · 직접');
  await click('#cue');
  assert.equal(need('.association').textContent, text, 'the cue is the story the user was shown');
  await click('#end-drill');
  assert.equal(notice(), '연습을 마쳤습니다.');

  await input('#story-text', '짧은 이야기');
  await click('#save-story');
  assert.equal(notice(), '이야기를 이 스택에 저장했습니다.');
  assert.deepEqual(stored().progress.redford.mnemonics.stories, [{ start: 1, end: 5, text: '짧은 이야기' }]);
  assert.equal(need('#story-text').value, '짧은 이야기');
  assert.equal(need('[data-story="0"]').textContent, '1-5');
  await click('#delete-story');
  assert.equal(notice(), '이 범위의 이야기를 지웠습니다.');
  assert.deepEqual(stored().progress.redford.mnemonics.stories, []);
});

test('settings: contact link and copy, backup export, a rejected import and a good import that makes a card due for review', async () => {
  await tab('settings');
  assert.equal(need('#main').getAttribute('data-product-settings'), '');
  assert.equal(need('.magic-contact-link').getAttribute('href'), 'https://qr.kakao.com/talk/eshVqDvk7WKk0zDKtiC9UTa.T6Q-');
  await click('#contact-copy');
  await settle();
  assert.deepEqual(env.clipboard.written, ['KaliDCerona']);
  assert.equal(need('#contact-copy').textContent, '복사됨');

  await click('#export');
  const backup = downloads.at(-1);
  assert.equal(backup.name, 'memdeck-backup.json');
  const exported = JSON.parse(await backup.blob.text());
  assert.equal(exported.version, 2);
  assert.deepEqual(exported.progress.redford.mnemonics.stories, []);
  assert.equal(exported.progress.redford.mnemonics.palace.title, '우리 집');

  const reviewBefore = stored().progress.redford.review;
  const bad = new File(['{"version":9}'], 'bad.json');
  need('#import').files = [bad];
  await fire(need('#import'), 'change');
  assert.equal(notice(), '가져오기 실패: 지원하지 않는 백업 형식입니다. 기존 기록은 유지됩니다.');
  assert.deepEqual(stored().progress.redford.review, reviewBefore, 'a rejected backup leaves the stored records alone');

  exported.progress.redford.review = { 3: { step: 2, due: 0 } };
  need('#import').files = [new File([JSON.stringify(exported)], 'good.json')];
  await fire(need('#import'), 'change');
  assert.equal(downloads.at(-1).name, 'memdeck-before-import.json', 'a safety backup is requested before replacing records');
  assert.equal(notice(), '백업을 가져왔습니다. 두 스택의 기록을 확인하세요.');
  assert.deepEqual(stored().progress.redford.review, { 3: { step: 2, due: 0 } });
  await tab('study');
  assert.equal(need('#main').getAttribute('data-product-settings'), null, 'leaving settings clears the settings marker');
});

test('memory review: the imported due card is asked directly and its review step advances', async () => {
  await tab('memory');
  await train('review');
  assert.ok(need('.hint').textContent.startsWith('오늘 복습 1장.'));
  assert.equal(need('#start-review').disabled, false);
  await click('#start-review');
  assert.equal(need('.pill').textContent, '1 / 1 · 직접');
  const pos = shownPosition();
  assert.equal(pos, 3);
  await answerShown(true);
  assert.equal(notice(), `직접 맞췄습니다. ${label(deck()[2])}는 3번. 복습 간격에 반영합니다.`);
  assert.equal(stored().progress.redford.review['3'].step, 3, 'a timely right answer moves up one step');
  await click('#next-drill');
  assert.equal(notice(), '직접 맞춤 1 · 직접 오답 0 · 단서 0 · 답 보기 0');
  assert.equal(need('.hint').textContent.startsWith('오늘 복습 0장.'), true);
  assert.equal(need('#start-review').disabled, true);
});

test('settings stack order: an invalid order is refused, a valid one replaces the stack and restarts its records', async () => {
  await tab('settings');
  await input('#stack-json', '["AS","2S"]');
  await click('#stack-import');
  assert.equal(notice(), '순서 적용 실패: 카드 순서는 중복 없이 52장이어야 합니다. 예: AS, 10H, QC 기존 순서와 기록은 유지됩니다.');
  assert.equal(stored().stacks.redford[0], 'QH');

  const reversed = [...stored().stacks.redford].reverse();
  need('#stack-json').value = JSON.stringify(reversed);
  await click('#stack-import');
  assert.equal(downloads.at(-1).name, 'memdeck-before-order-change.json');
  assert.equal(notice(), '카드 순서를 적용하고 이 스택의 기록을 새로 시작했습니다.');
  assert.equal(stored().stacks.redford[0], reversed[0]);
  assert.deepEqual(stored().progress.redford.stats, {});
  assert.equal(stored().progress.redford.mnemonics.palace, null, 'the palace of the replaced stack is cleared');
  assert.equal(stored().progress.mnemonica.history.length, 0);
  await tab('study');
  assert.equal(need('#flip .big span').textContent, label(reversed[0]));
  console.error = originalConsoleError;
});
