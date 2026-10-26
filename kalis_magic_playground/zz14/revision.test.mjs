import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from './core.mjs';
import { pimaxAppScript, pimaxAppModules } from '../tests/community/pimax-app-script.mjs';
import { accessGuard, preparePimaxRuntime } from '../scripts/build-public.mjs';
import { readAppStyle } from '../tests/community/app-style.mjs';

function load(initial = {}, standalone = false) {
  const values = new Map(Object.entries(initial)), events = {};
  const app = { innerHTML: '', setAttribute() {}, removeAttribute() {} };
  const context = vm.createContext({ __core: core, Date, Math, JSON,
    navigator: { userAgent: 'Android Chrome', maxTouchPoints: 1, standalone },
    window: { addEventListener(name, fn) { events[name] = fn; }, matchMedia() { return { matches: standalone }; } },
    document: { body: { dataset: {}, addEventListener() {} }, querySelector: s => s === '#app' ? app : {}, querySelectorAll: () => [] },
    localStorage: { getItem: k => values.get(k) ?? null, setItem(k, v) { values.set(k, v); } },
  });
  const source = pimaxAppScript(new URL('./', import.meta.url));
  vm.runInContext(source + '\nglobalThis.api = { state, startSession, render, onClick, current, saveSession };', context);
  return { ...context.api, app, values, events };
}
const click = (env, action, extra = {}) => env.onClick({ target: { closest: () => ({ dataset: { action, ...extra } }) } });

test('half prompts sample both words and round-trip for phrase mode', () => {
  const words = new Set();
  for (let seed = 0; seed < 20; seed++) {
    const session = core.buildSession({ mode: 'phrase', count: 10, seed, phraseDisplay: 'half' });
    assert(core.validateSession(JSON.parse(JSON.stringify(session))));
    for (const q of session.questions) {
      words.add(q.word);
      assert.equal(q.public.big, core.LINES[q.answer.row].phrase.split(' ')[q.word]);
      assert(!q.public.big.includes(' '));
    }
  }
  assert.deepEqual([...words].sort(), [0, 1]);
});

test('phrase controls preserve two taps, display choice, weak records and reload', () => {
  const env = load();
  env.startSession('phrase', { force: true });
  click(env, 'phrase-display', { value: 'half' });
  const q = env.current();
  assert.equal(q.usedReveal, false);
  assert(core.validateSession(env.state.session));
  click(env, 'tap');
  assert.match(env.app.innerHTML, /<span>[^<]+<\/span><span>/);
  assert.equal(env.state.session.index, 0);
  click(env, 'tap');
  assert.equal(env.state.session.index, 1);
  click(env, 'weak-toggle');
  const restored = load(Object.fromEntries(env.values));
  assert.equal(restored.state.settings.phraseDisplay, 'half');
  assert.equal(restored.state.stats.weak.length, 1);
  assert(core.validateStats(restored.state.stats));
  restored.startSession('phrase', { force: true });
  const phrase = restored.current().answer.phrase;
  click(restored, 'tap');
  assert(restored.app.innerHTML.includes(`<span>${phrase}</span>`));
});

test('map marks migrate to complete pairs and toggling either direction removes both', () => {
  const questions = core.buildQuestions('map', 20, 3);
  const p = questions.find(q => q.key === 'map:letter:P');
  const nine = questions.find(q => q.key === 'map:digit:9');
  const stats = core.defaultStats();
  core.recordWeak(stats, p);
  assert.deepEqual(stats.weak.map(item => item.key).sort(), ['map:digit:9', 'map:letter:P']);
  assert.equal(core.weakMapSymbols([{ key: p.key }]).length, 2);
  stats.weak = stats.weak.filter(item => item.key === p.key);
  const env = load({ 'pimax-practice-stats': JSON.stringify(stats) });
  assert.equal(env.state.stats.weak.length, 2);
  env.state.session.questions = [nine, p];
  env.state.session.count = 2;
  env.state.session.index = 0;
  env.render();
  assert.match(env.app.innerHTML, /data-action="weak-toggle" aria-pressed="true"/);
  click(env, 'weak-toggle');
  assert.equal(env.state.stats.weak.length, 0);
  click(env, 'weak-toggle');
  click(env, 'map-pool', { pool: 'weak' });
  assert.deepEqual(Array.from(env.state.session.questions, q => q.key).sort(), ['map:digit:9', 'map:letter:P']);
  core.clearWeak(env.state.stats, p.key);
  assert.equal(env.state.stats.weak.length, 0);
});

test('legacy saved presentation migrates without losing drafts, flags or progress', () => {
  for (const mode of ['odd', 'next', 'birthday']) {
    const session = core.buildSession({ mode, seed: 2 });
    session.index = 2;
    const q = session.questions[2];
    q.draft = '줄 회상'; q.usedReveal = true;
    let raw = JSON.stringify(session).replaceAll('페이지 2', '홀수 쪽').replaceAll('0-4', '0~4');
    if (mode === 'birthday') raw = raw.replaceAll('쪽, 줄,', '쪽, 주소 줄,').replaceAll('줄은 월×2', '주소 줄은 월×2');
    if (mode === 'next') raw = raw.replaceAll('보이는 다섯 자리 다음부터 숫자 열 개를 떠올립니다.', '이 다섯 자리 바로 다음 열 자리입니다. 다섯 자리는 다시 쓰지 않습니다.');
    const read = core.readSlot(raw, null, core.validateSession);
    assert.equal(read.corrupt, false, mode);
    assert.equal(read.value.index, 2);
    assert.equal(read.value.questions[2].draft, '줄 회상');
    assert.equal(read.value.questions[2].usedReveal, true);
  }
});

test('install sheet opens once per launch and settings keep the full card', async () => {
  const env = load();
  assert.match(env.app.innerHTML, /data-install-sheet/);
  assert.match(env.app.innerHTML, /role="dialog"/);
  assert.doesNotMatch(env.app.innerHTML, /data-install-card|install-compact|설치 방법 보기|data-action="install-dismiss"/);
  assert.match(env.app.innerHTML, /앱 설치 버튼이 없으면 Chrome 메뉴에서/);
  assert.match(env.app.innerHTML, /data-action="install-later"[^>]*>나중에</);
  const key = env.current().key;
  click(env, 'install-later');
  assert.doesNotMatch(env.app.innerHTML, /data-install-sheet/);
  assert.equal(env.current().key, key);
  env.render();
  assert.doesNotMatch(env.app.innerHTML, /data-install-sheet/);
  const again = load(Object.fromEntries(env.values));
  assert.match(again.app.innerHTML, /data-install-sheet/);
  click(again, 'tab', { tab: 'settings' });
  assert.match(again.app.innerHTML, /data-install-card/);
  assert.match(again.app.innerHTML, /설치 방법 보기/);
  let prompts = 0;
  const event = { isTrusted: true, prompt: async () => prompts++, userChoice: Promise.resolve({ outcome: 'accepted' }), preventDefault() {} };
  again.events.beforeinstallprompt(event);
  assert.match(again.app.innerHTML, /data-action="install"[^>]*>앱 설치</);
  click(again, 'install');
  await Promise.resolve();
  assert.equal(prompts, 1);
  again.events.appinstalled();
  assert.doesNotMatch(again.app.innerHTML, /data-install-sheet|data-install-card/);
  assert.doesNotMatch(load({}, true).app.innerHTML, /data-install-sheet|data-install-card/);
  const late = load();
  click(late, 'tab', { tab: 'learn' });
  late.events.beforeinstallprompt(event);
  assert.match(late.app.innerHTML, /data-action="install"[^>]*>앱 설치</);
  late.events.keydown({ key: 'Escape', preventDefault() {} });
  assert.doesNotMatch(late.app.innerHTML, /data-install-sheet/);
});

class RevealObserver {
  constructor(callback) { this.callback = callback; this.target = null; }
  observe(target) {
    this.target = target;
    if (!target.__observers) target.__observers = new Set();
    target.__observers.add(this);
  }
  disconnect() { this.target?.__observers?.delete(this); }
  takeRecords() { return []; }
}

function sheetHarness() {
  let activeElement = null;
  const focusLog = [];
  let visibilityValue = '';
  const documentElement = {};
  documentElement.style = {
    get visibility() { return visibilityValue; },
    set visibility(value) {
      visibilityValue = String(value);
      for (const observer of [...(documentElement.__observers || [])]) observer.callback();
    },
  };
  const bodyListeners = {};
  function isUnder(el, ancestor) {
    let node = el;
    while (node) {
      if (node === ancestor) return true;
      node = node.parentElement;
    }
    return false;
  }
  function collect(el) {
    const out = [];
    for (const child of el.children || []) {
      out.push(child);
      out.push(...collect(child));
    }
    return out;
  }
  function nodeMatches(el, selector) {
    if (selector === 'button' || selector === 'input' || selector === 'select' || selector === 'textarea') return el.tag === selector;
    if (selector === 'a[href]') return el.tag === 'a' && 'href' in el.attrs;
    if (selector === '[tabindex]') return 'tabindex' in el.attrs;
    if (selector === '[data-install-sheet]') return 'data-install-sheet' in el.attrs;
    if (selector === '[data-install-inert]') return 'data-install-inert' in el.attrs;
    const action = selector.match(/^\[data-action=(['"])([^'"]+)\1\]$/);
    if (action) return el.attrs['data-action'] === action[2];
    if (selector === "#nav button[aria-current='page']") return el.tag === 'button' && el.attrs['aria-current'] === 'page' && isUnder(el, nav);
    if (selector === '#app button') return el.tag === 'button' && isUnder(el, app);
    return false;
  }
  function queryAllFrom(root, selector) {
    const parts = String(selector).split(',').map((part) => part.trim()).filter(Boolean);
    const pool = collect(root);
    const found = [];
    for (const part of parts) for (const node of pool) if (nodeMatches(node, part) && !found.includes(node)) found.push(node);
    return found;
  }
  function extractButtons(html) {
    const buttons = [];
    for (const match of String(html).matchAll(/<button\b([^>]*)>/g)) {
      const attrs = {};
      for (const attr of match[1].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
      buttons.push(attrs);
    }
    return buttons;
  }
  function make(tag, attrs = {}, parent = null) {
    const el = {
      tag,
      attrs: { ...attrs },
      children: [],
      parentElement: parent,
      inert: false,
      disabled: false,
      isConnected: true,
      dataset: { tab: attrs['data-tab'], action: attrs['data-action'] },
    };
    el.classList = {
      toggle(name, force) {
        const parts = new Set(String(el.attrs.class || '').split(/\s+/).filter(Boolean));
        const on = force === undefined ? !parts.has(name) : !!force;
        if (on) parts.add(name); else parts.delete(name);
        el.attrs.class = [...parts].join(' ');
        return on;
      },
    };
    el.getAttribute = (name) => (name in el.attrs ? String(el.attrs[name]) : null);
    el.setAttribute = (name, value) => {
      el.attrs[name] = String(value);
      if (name === 'data-tab') el.dataset.tab = String(value);
      if (name === 'data-action') el.dataset.action = String(value);
    };
    el.removeAttribute = (name) => { delete el.attrs[name]; };
    el.hasAttribute = (name) => name in el.attrs;
    el.focus = () => { focusLog.push(el); activeElement = el; };
    el.contains = (other) => isUnder(other, el);
    el.querySelector = (sel) => queryAllFrom(el, sel)[0] || null;
    el.querySelectorAll = (sel) => queryAllFrom(el, sel);
    if (parent) parent.children.push(el);
    return el;
  }
  const body = make('body');
  body.dataset = {};
  body.addEventListener = (type, fn) => { bodyListeners[type] = fn; };
  const shell = make('div', { id: 'shell' }, body);
  const header = make('header', {}, shell);
  const nav = make('nav', { id: 'nav' }, shell);
  make('button', { type: 'button', 'data-action': 'tab', 'data-tab': 'learn' }, nav);
  const practiceTab = make('button', { type: 'button', 'data-action': 'tab', 'data-tab': 'practice', class: 'active', 'aria-current': 'page' }, nav);
  make('button', { type: 'button', 'data-action': 'tab', 'data-tab': 'settings' }, nav);
  const app = make('main', { id: 'app' }, shell);
  const notice = make('p', { id: 'notice' }, shell);
  const footer = make('footer', {}, shell);
  Object.defineProperty(app, 'innerHTML', {
    get() { return app._html || ''; },
    set(html) {
      app._html = String(html);
      app.children = [];
      const cut = app._html.indexOf('data-install-sheet');
      const pageHtml = cut === -1 ? app._html : app._html.slice(0, cut);
      const sheetHtml = cut === -1 ? '' : app._html.slice(cut);
      const page = make('section', { class: 'workspace' }, app);
      for (const attrs of extractButtons(pageHtml)) make('button', attrs, page);
      if (cut !== -1) {
        const sheet = make('div', { class: 'install-sheet', 'data-install-sheet': '' }, app);
        const panel = make('div', { class: 'install-sheet-panel', role: 'dialog', 'aria-modal': 'true' }, sheet);
        const actions = make('div', { class: 'install-actions' }, panel);
        for (const attrs of extractButtons(sheetHtml)) make('button', attrs, actions);
      }
    },
  });
  const document = {
    documentElement,
    body,
    get activeElement() { return activeElement; },
    querySelector(sel) {
      if (sel === '#app') return app;
      if (sel === '#notice') return notice;
      if (sel === '#page-check' || sel === '#month-check' || sel === '#day-check') return null;
      return queryAllFrom(body, sel)[0] || null;
    },
    querySelectorAll(sel) {
      if (sel === '#nav button') return nav.children.filter((el) => el.tag === 'button');
      return queryAllFrom(body, sel);
    },
  };
  const events = {};
  const values = new Map();
  const fetchCalls = [];
  let releaseCheck = null;
  const context = vm.createContext({
    __core: core,
    __fetchCalls: fetchCalls,
    Date, Math, JSON, MutationObserver: RevealObserver, AbortController,
    setTimeout: () => 1,
    clearTimeout() {},
    navigator: { userAgent: 'Android Chrome', maxTouchPoints: 1, standalone: false },
    location: { protocol: 'https:', pathname: '/tools/pimax/', search: '', replaced: null, replace(url) { this.replaced = url; } },
    fetch(url, options) {
      fetchCalls.push([url, options]);
      return new Promise((resolve) => { releaseCheck = resolve; });
    },
    window: { addEventListener(name, fn) { events[name] = fn; }, matchMedia() { return { matches: false }; } },
    document,
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem(key, value) { values.set(key, value); }, removeItem(key) { values.delete(key); } },
  });
  // The host fetch above is replaced by one created inside the realm so its Promise settles there.
  vm.runInContext(`globalThis.fetch = (url, options) => new Promise((resolve) => { globalThis.__fetchCalls.push([url, options]); globalThis.__releaseCheck = resolve; });`, context);
  const source = pimaxAppScript(new URL('./', import.meta.url));
  return { context, source, app, document, events, bodyListeners, focusLog, practiceTab, shell, header, nav, notice, footer, fetchCalls, values, get activeElement() { return activeElement; } };
}

function bootSheet(env, { gate = false } = {}) {
  if (gate) {
    const script = accessGuard('pimax', 'pimax').replace(/^\s*<script\b[^>]*>/, '').replace(/<\/script>\s*$/, '');
    vm.runInContext(script, env.context);
  }
  vm.runInContext(`${env.source}\nglobalThis.api = { state, onClick, render };`, env.context);
  return env;
}

function sheetOf(app) {
  return app.querySelector('[data-install-sheet]');
}

test('install sheet traps tab, inerts the background, and restores focus', () => {
  const env = bootSheet(sheetHarness());
  const sheet = sheetOf(env.app);
  const page = env.app.children[0];
  assert.equal(env.focusLog.length, 1);
  assert.equal(env.focusLog[0].getAttribute('data-action'), 'install-later');
  assert.equal(env.activeElement, env.focusLog[0]);
  assert.equal(page.inert, true);
  assert.equal(env.nav.inert, true);
  assert.equal(env.header.inert, true);
  assert.equal(env.footer.inert, true);
  assert.equal(env.notice.inert, true);
  assert.equal(env.shell.inert, false);
  assert.equal(env.app.inert, false);
  assert.equal(sheet.inert, false);
  assert.equal(env.nav.hasAttribute('data-install-inert'), true);
  const only = sheet.querySelector('button');
  const shift = { key: 'Tab', shiftKey: true, preventDefault() { this.prevented = true; } };
  env.bodyListeners.keydown(shift);
  env.events.keydown(shift);
  assert.equal(shift.prevented, true);
  assert.equal(env.activeElement, only);
  assert.notEqual(env.activeElement, page.querySelector('button'));
  const event = { isTrusted: true, prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }), preventDefault() {} };
  env.events.beforeinstallprompt(event);
  const buttons = sheetOf(env.app).querySelectorAll('button');
  assert.deepEqual(buttons.map((button) => button.getAttribute('data-action')), ['install', 'install-later']);
  assert.equal(env.activeElement, buttons[0]);
  const back = { key: 'Tab', shiftKey: true, preventDefault() { this.prevented = true; } };
  env.events.keydown(back);
  assert.equal(back.prevented, true);
  assert.equal(env.activeElement.getAttribute('data-action'), 'install-later');
  const forward = { key: 'Tab', shiftKey: false, preventDefault() { this.prevented = true; } };
  env.events.keydown(forward);
  assert.equal(forward.prevented, true);
  assert.equal(env.activeElement.getAttribute('data-action'), 'install');
  const practiceControl = env.app.children[0].querySelector('button');
  practiceControl.focus();
  const pulled = { key: 'Tab', preventDefault() { this.prevented = true; } };
  env.events.keydown(pulled);
  assert.equal(pulled.prevented, true);
  assert.equal(env.activeElement.getAttribute('data-action'), 'install');
  env.bodyListeners.focusin({ target: practiceControl });
  assert.equal(env.activeElement.getAttribute('data-action'), 'install');
  env.events.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(sheetOf(env.app), null);
  assert.equal(env.nav.inert, false);
  assert.equal(env.nav.hasAttribute('data-install-inert'), false);
  assert.equal(env.activeElement, env.practiceTab);
  const outside = { key: 'Tab', shiftKey: true, preventDefault() { this.prevented = true; } };
  env.events.keydown(outside);
  assert.equal(outside.prevented, undefined);
});

test('distribution access guard defers sheet focus until the document is revealed', async () => {
  const env = bootSheet(sheetHarness(), { gate: true });
  assert.equal(env.document.documentElement.style.visibility, 'hidden');
  assert.equal(env.focusLog.length, 0);
  assert.equal(env.activeElement, null);
  assert.equal(env.nav.inert, true);
  assert.equal(sheetOf(env.app).inert, false);
  env.bodyListeners.focusin({ target: env.practiceTab });
  assert.equal(env.focusLog.length, 0);
  assert.equal(env.context.location.replaced, null);
  assert.equal(env.context.__fetchCalls[0][0], '/tools/_check?tool=pimax');
  assert.equal(env.context.__fetchCalls[0][1].cache, 'no-store');
  env.context.__releaseCheck({ type: 'basic', status: 200, ok: true, json: () => Promise.resolve({ ok: true }) });
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  assert.equal(env.document.documentElement.style.visibility, '');
  assert.equal(env.focusLog.length, 1);
  assert.equal(env.activeElement.getAttribute('data-action'), 'install-later');
  assert.equal(sheetOf(env.app).contains(env.activeElement), true);
  assert.equal(env.nav.inert, true);
});

test('both Pi Max runtimes share the install-sheet focus trap', () => {
  const normalize = (source) => source
    .replaceAll('pimax.distribution.settings', 'pimax-practice-settings')
    .replaceAll('pimax.distribution.stats', 'pimax-practice-stats')
    .replaceAll('pimax.distribution.session', 'pimax-practice-session');
  const modules = pimaxAppModules(new URL('./', import.meta.url));
  assert.deepEqual(pimaxAppModules(new URL('../distribution-snapshots/pimax/', import.meta.url)), modules);
  assert.ok(modules.includes('install.mjs'));
  for (const file of modules) {
    const personal = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    const shared = readFileSync(new URL(`../distribution-snapshots/pimax/${file}`, import.meta.url), 'utf8');
    const runtime = (source) => file === 'app.mjs' ? preparePimaxRuntime(source) : source;
    assert.equal(runtime(normalize(shared)), runtime(personal), file);
  }
});

test('birthday formulas render computed example and variable blocks reserve line space', () => {
  const env = load(); click(env, 'tab', { tab: 'learn' });
  const mmdd = core.birthdayAddress(3, 14, 'MMDD'), ddmm = core.birthdayAddress(3, 14, 'DDMM');
  for (const copy of ['쪽 = 일 + 50', '줄 = 월 × 2', 'MMDD(월일) 시작 = 월 + 3', 'DDMM(일월) 시작 = 월 + 1', `예: 3월 14일 → 쪽 ${mmdd.page}, 줄 ${mmdd.line}, MMDD 시작 ${mmdd.column}, DDMM 시작 ${ddmm.column}`]) assert(env.app.innerHTML.includes(copy));
  const css = readAppStyle(new URL('./', import.meta.url));
  assert.match(css, /min-height: 2lh/);
  assert.doesNotMatch(css, /min-height: [34]lh/);
});

// Captured from HEAD's pre-revision core.mjs (e5c3fde), with progress fields set.
const legacySessions = JSON.parse(readFileSync(new URL('./legacy-v1-sessions.json', import.meta.url), 'utf8'));
test('genuine pre-revision v1 sessions restore every old mode and regenerate copy', () => {
  assert.deepEqual(legacySessions.map(s => s.mode).sort(), [...core.MODES, 'lie'].sort());
  for (const saved of legacySessions) for (const graded of [null, 'revealed', 'assisted']) {
    const session = structuredClone(saved);
    session.questions[session.index].graded = graded;
    const raw = JSON.stringify(session);
    if (session.mode === 'lie') {
      const retired = load({ 'pimax-practice-session': raw });
      assert.equal(retired.state.session.mode, 'map');
      assert.equal(retired.state.notice.includes('저장된 문제'), false);
      assert.equal(JSON.parse(retired.values.get('pimax-practice-session')).mode, 'map');
      continue;
    }
    const env = load({ 'pimax-practice-session': raw });
    assert.equal(env.state.session.id, session.id, session.mode);
    for (const field of ['mode', 'count', 'index', 'finished', 'statsPosted', 'accumulatedMs']) assert.equal(env.state.session[field], session[field], `${session.mode}: ${field}`);
    for (let i = 0; i < session.questions.length; i++) {
      const actual = env.state.session.questions[i], before = session.questions[i];
      for (const field of ['key', 'draft', 'graded', 'usedReveal', 'hintUsed', 'showHint']) assert.equal(actual[field], before[field], `${session.mode}: ${field}`);
      const current = core.buildSession({ mode: session.mode, count: 5, seed: 42 }).questions[i];
      assert.deepEqual(actual.public, current.public);
      assert.equal(actual.hint, current.hint);
    }
    assert(!env.state.notice.includes('저장된 문제'));
  }
});

test('presentation copy is disposable but answer data and identity remain validated', () => {
  for (const mode of core.MODES) {
    const session = core.buildSession({ mode, seed: 42 });
    for (const q of session.questions) {
      q.public = { big: 'old prompt', note: 'old note' };
      q.hint = 'old hint';
      if ('phrase' in q.answer) q.answer.phrase = 'old spelling';
    }
    assert(core.validateSession(session));
    const restored = core.readSlot(JSON.stringify(session), null, core.validateSession);
    assert(!restored.corrupt);
    assert.notEqual(restored.value.questions[0].public.big, 'old prompt');
    const broken = structuredClone(session);
    broken.questions[0].key += ':bad';
    assert(!core.validateSession(broken));
    const badAnswer = structuredClone(session);
    badAnswer.questions[0].answer.digits = 'invalid';
    assert(!core.validateSession(badAnswer));
  }
});

test('40 weak items retain whole map pairs and evict the oldest whole item', () => {
  const pool = core.buildQuestions('next', 30, 42);
  const other = core.buildQuestions('birthday', 30, 42);
  const singles = [...new Map([...pool, ...other].map(q => [q.key, q])).values()];
  assert(singles.length >= 41);
  const pair = core.buildQuestions('map', 20, 3).find(q => q.key === 'map:letter:P');
  for (const count of [38, 39, 40, 41]) {
    const stats = core.defaultStats();
    for (const q of singles.slice(0, count)) core.recordWeak(stats, q);
    core.recordWeak(stats, pair);
    assert.equal(new Set(stats.weak.map(item => core.weakKeys(item.key)[0])).size, Math.min(count + 1, 40));
    assert.equal(stats.weak.length, Math.min(count + 1, 40) + 1);
    assert.equal(stats.weak.filter(item => item.mode === 'map').length, 2);
    assert(core.validateStats(stats));
    assert(!core.readSlot(JSON.stringify(stats), null, core.validateStats).corrupt);
    core.migrateWeak(stats);
    assert.equal(stats.weak.length, Math.min(count + 1, 40) + 1);
  }
  const stats = core.defaultStats();
  core.recordWeak(stats, pair);
  for (const q of singles.slice(0, 39)) core.recordWeak(stats, q);
  assert.equal(stats.weak.length, 41);
  core.recordWeak(stats, singles[39]);
  assert.equal(stats.weak.length, 40);
  assert(!stats.weak.some(item => item.mode === 'map'));
  core.recordWeak(stats, pair);
  assert(!stats.weak.some(item => item.key === singles[0].key));
  // A full set of ten map pairs plus thirty other items uses fifty entries.
  const full = core.defaultStats();
  for (const q of singles.slice(0, 30)) core.recordWeak(full, q);
  for (const q of core.buildQuestions('map', 20, 3)) core.recordWeak(full, q);
  assert.equal(full.weak.length, 50);
  assert(core.validateStats(full));
  const env = load({ 'pimax-practice-stats': JSON.stringify(full) });
  click(env, 'map-pool', { pool: 'weak' });
  assert(core.validateSession(env.state.session));
  const restored = load(Object.fromEntries(env.values));
  assert.equal(restored.state.session.id, env.state.session.id);
  assert.equal(restored.state.session.count, 50);
});

test('removed modes fall back to 대응 and old stats still load', () => {
  for (const mode of ['lie', 'phrase-next']) {
    const session = core.buildSession({ mode: 'map', count: 2, seed: 4 });
    session.mode = mode;
    session.questions.forEach((question) => { question.mode = mode; });
    const env = load({ 'pimax-practice-session': JSON.stringify(session) });
    assert.equal(env.state.session.mode, core.MODES[0], mode);
    assert.equal(env.state.notice.includes('저장된 문제'), false, mode);
    assert.doesNotMatch(env.app.innerHTML, /거짓말|이어서 문장/);
  }
  const kept = core.buildQuestions('phrase', 1, 2)[0];
  const stats = core.defaultStats();
  core.recordWeak(stats, kept);
  stats.recent.unshift({ id: 'lie-old', mode: 'lie', endedAt: Date.now(), count: 1, direct: 0, assisted: 0, wrong: 1, revealed: 0, hints: 0, reveals: 0, ms: 10 });
  stats.recent.unshift({ id: 'next-old', mode: 'phrase-next', endedAt: Date.now(), count: 1, direct: 1, assisted: 0, wrong: 0, revealed: 0, hints: 0, reveals: 0, ms: 12 });
  stats.weak.push({ key: 'lie:83136', mode: 'lie', misses: 1, label: '거짓말', question: { mode: 'lie', key: 'lie:83136', answer: { type: 'lie' } } });
  const settings = { ...core.defaultSettings(), count: 15, phraseDisplay: 'half', phraseLength: 10, installDismissed: true, mode: 'lie' };
  const env = load({
    'pimax-practice-settings': JSON.stringify(settings),
    'pimax-practice-stats': JSON.stringify(stats),
  });
  assert.equal(env.state.settings.count, 15);
  assert.equal(env.state.settings.phraseDisplay, 'half');
  assert.equal(env.state.settings.phraseLength, 10);
  assert.equal(env.state.settings.installDismissed, undefined);
  assert.equal(env.state.settings.mode, undefined);
  assert.equal(env.state.notice.includes('설정을 읽지 못해'), false);
  assert.equal(env.state.notice.includes('저장된 기록'), false);
  assert.deepEqual(env.state.stats.recent.map(item => item.mode), []);
  assert.equal(env.state.stats.weak.length, 1);
  assert.equal(env.state.stats.weak[0].mode, 'phrase');
  assert.equal(core.validateStats(env.state.stats), true);
  const savedSettings = JSON.parse(env.values.get('pimax-practice-settings'));
  assert.equal(savedSettings.installDismissed, undefined);
  assert.equal(savedSettings.count, 15);
  const phrase = core.buildQuestions('phrase', 1, 3)[0];
  const review = {
    version: 1, mode: 'review', index: 1, count: 2, finished: false, statsPosted: false, accumulatedMs: 40,
    questions: [
      { mode: 'lie', key: 'lie:1', answer: { type: 'lie', heard: '83136' }, draft: '', graded: null, hintUsed: false, usedReveal: false, showHint: false },
      phrase,
    ],
  };
  const reviewEnv = load({ 'pimax-practice-session': JSON.stringify(review) });
  assert.equal(reviewEnv.state.session.mode, 'review');
  assert.equal(reviewEnv.state.session.questions.length, 1);
  assert.equal(reviewEnv.current().key, phrase.key);
  assert.equal(reviewEnv.state.notice.includes('저장된 문제'), false);
});

test('phrase display changes only future questions after reveal, grade and reload', () => {
  const env = load();
  env.startSession('phrase', { force: true });
  {
    click(env, 'tap');
    const current = JSON.stringify(env.current());
    click(env, 'phrase-display', { value: 'half' });
    assert.equal(JSON.stringify(env.current()), current);
    assert.equal(env.state.session.questions[1].word === 0 || env.state.session.questions[1].word === 1, true);
    const restored = load(Object.fromEntries(env.values));
    assert.equal(JSON.stringify(restored.current()), current);
    click(restored, 'tap');
    assert.equal(restored.state.session.index, 1);
    assert(!restored.current().public.big.includes(' '));
    assert.equal(restored.current().usedReveal, false);
    const previous = JSON.stringify(restored.state.session.questions[0]);
    click(restored, 'tap');
    const half = JSON.stringify(restored.current());
    click(restored, 'phrase-display', { value: 'full' });
    assert.equal(JSON.stringify(restored.current()), half);
    assert.equal(JSON.stringify(restored.state.session.questions[0]), previous);
    click(restored, 'tap');
    assert.equal(restored.current().public.big, restored.current().answer.type === 'phrase' ? restored.current().answer.phrase : core.LINES[restored.current().answer.row].phrase);
  }
});

test('settings install card includes request and fallback expands and collapses help', () => {
  const env = load();
  click(env, 'tab', { tab: 'settings' });
  assert.match(env.app.innerHTML, /홈 화면에 설치하면 공연 중에도 바로 열 수 있어요\./);
  assert.match(env.app.innerHTML, /aria-expanded="false"/);
  click(env, 'install');
  assert.match(env.app.innerHTML, /aria-expanded="true"/);
  assert.match(env.app.innerHTML, /브라우저 메뉴를 열어 위 순서대로 설치해 주세요\./);
  click(env, 'install');
  assert.match(env.app.innerHTML, /aria-expanded="false"/);
  assert.doesNotMatch(env.app.innerHTML, /브라우저 메뉴를 열어 위 순서대로 설치해 주세요\./);
});

test('answer layout grows for long sequences and uses compact per-mode reservations', () => {
  const css = readAppStyle(new URL('./', import.meta.url));
  const revision = css.slice(css.indexOf('/* Revision:'));
  assert.match(revision, /grid-template-rows: minmax\(var\(--answer-height\), auto\)/);
  assert.match(revision, /\.quiz-actions \.blind-answer \{ height: auto; min-height: var\(--answer-height\); max-height: none; overflow: visible; \}/);
  assert.match(revision, /\.quiz-actions\.answer-map \{ --answer-height: 160px; \}/);
  assert.match(revision, /\.quiz-actions\.answer-phrase \{ --answer-height: 160px; \}/);
  assert.match(revision, /\.quiz-actions\.sequence-actions \{ --answer-height: 160px; \}/);
  assert.doesNotMatch(revision, /300px|min-height: [34]lh/);
  const env = load();
  env.startSession('phrase', { force: true });
  assert.match(env.app.innerHTML, /class="quiz-actions answer-phrase"/);
  click(env, 'tap');
  assert.match(env.app.innerHTML, /class="blind-answer phrase-answer"/);
  env.startSession('map', { force: true });
  assert.match(env.app.innerHTML, /class="quiz-actions answer-map"/);
  assert.equal((env.app.innerHTML.match(/data-action="mode"/g) || []).length, 6);
  assert.doesNotMatch(env.app.innerHTML, /data-mode="lie"|data-mode="phrase-next"|이어서 문장|거짓말/);
});
