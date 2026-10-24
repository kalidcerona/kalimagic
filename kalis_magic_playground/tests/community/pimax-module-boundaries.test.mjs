import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Loads zz14/app.mjs and its real imports as separate ES modules (no concatenation, no shared scope),
// then drives boot, install sheet, all three tabs, settings, checkers, weak review and reset through DOM events.
// Click targets are parsed from the rendered markup (real data-* and disabled attributes).
// PIMAX_ROOT lets the mutation check point the same test at a scratch copy.
const root = process.env.PIMAX_ROOT ? pathToFileURL(`${process.env.PIMAX_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz14/', import.meta.url);

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };

const camel = (key) => key.replace(/-(\w)/g, (_, ch) => ch.toUpperCase());
const parseDataset = (attrs) => Object.fromEntries([...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [camel(key), value]));
const hasDisabled = (attrs) => /(^|\s)disabled(\s|=|$)/.test(attrs.replace(/"[^"]*"/g, '""'));

function stubBrowser() {
  const storage = new Map();
  const handlers = {};
  const cache = new Map();
  const focusable = (node) => Object.assign(node, { focus() { document.activeElement = node; } });
  // Buttons parsed from markup; memoized per markup string so identity (focus, contains) is stable.
  const buttonsIn = (html) => {
    if (!cache.has(html)) {
      cache.set(html, [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, text]) => focusable({
        dataset: parseDataset(attrs), disabled: hasDisabled(attrs), text, getAttribute: () => null,
      })));
    }
    return cache.get(html);
  };
  const header = { inert: false, setAttribute() {}, removeAttribute() {} };
  const body = { dataset: {}, children: [], addEventListener(type, fn) { (handlers[type] ||= []).push(fn); } };
  const app = {
    innerHTML: '', parentElement: body, setAttribute() {}, removeAttribute() {}, children: [],
    querySelector(selector) {
      if (selector !== '[data-install-sheet]' || !app.innerHTML.includes('data-install-sheet')) return null;
      const html = app.innerHTML.slice(app.innerHTML.indexOf('<div class="install-sheet"'));
      const buttons = buttonsIn(html);
      const sheet = {
        parentElement: app, buttons,
        contains: (node) => buttons.includes(node),
        querySelectorAll: () => buttons,
        querySelector: (inner) => (inner === "[data-action='install']" ? buttons.find((b) => b.dataset.action === 'install') || null : buttons[0] || null),
      };
      app.children = [sheet];
      return sheet;
    },
  };
  body.children = [app, header];
  const notice = { textContent: '' };
  const nav = ['learn', 'practice', 'settings'].map((tab) => {
    const node = focusable({ dataset: { action: 'tab', tab }, disabled: false, aria: tab === 'practice', classList: { toggle() {} },
      setAttribute() { node.aria = true; }, removeAttribute() { node.aria = false; } });
    return node;
  });
  const inputs = {};
  class HTMLFormElement { constructor(id) { this.id = id; this.prevented = false; } preventDefault() { this.prevented = true; } }
  class HTMLInputElement { constructor(id) { this.id = id; this.value = ''; } }
  for (const id of ['page-check', 'month-check', 'day-check']) inputs[`#${id}`] = new HTMLInputElement(id);
  const document = {
    body, activeElement: null, visibilityState: 'visible', addEventListener() {},
    documentElement: { style: { visibility: 'hidden' }, dataset: {} },
    querySelector(selector) {
      if (selector === '#app') return app;
      if (selector === '#notice') return notice;
      if (selector === "#nav button[aria-current='page']") return nav.find((node) => node.aria) || null;
      return inputs[selector] || null;
    },
    querySelectorAll: (selector) => (selector === '#nav button' ? nav : []),
  };
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', { addEventListener() {}, matchMedia: () => ({ matches: false }), scrollY: 0, scrollTo() {} });
  define('navigator', { userAgent: 'node-test', maxTouchPoints: 0 });
  define('location', { hostname: 'example.test', search: '' });
  define('localStorage', {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
  });
  define('HTMLFormElement', HTMLFormElement);
  define('HTMLInputElement', HTMLInputElement);
  return { storage, handlers, app, notice, nav, header, inputs, buttonsIn, HTMLFormElement };
}

// Click the first rendered button whose data attributes match; the app's own handler sees the real disabled flag.
function tap(env, match) {
  const pool = match.tab ? env.nav : env.buttonsIn(env.app.innerHTML);
  const button = pool.find((item) => Object.entries(match).every(([key, value]) => item.dataset[key] === value));
  assert.ok(button, `no visible button for ${JSON.stringify(match)}`);
  for (const fn of env.handlers.click) fn({ target: { closest: () => button } });
}

test('Pi Max modules run as real separate ES modules through boot, install sheet, tabs, settings, checkers, weak review and reset', async () => {
  const env = stubBrowser();
  const { MODES } = await import(new URL('core.mjs', root));
  await import(new URL('app.mjs', root));
  const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const step = async (name, action) => { await action(); await settle(); assert.deepEqual(errors, [], `${name} raised errors`); };
  const stored = (key) => JSON.parse(env.storage.get(key));
  const submit = (id) => { const form = new env.HTMLFormElement(id); for (const fn of env.handlers.submit) fn({ target: form, preventDefault: () => form.preventDefault() }); assert.ok(form.prevented, `${id} default prevented`); };
  const type = (id, value) => { env.inputs[`#${id}`].value = value; for (const fn of env.handlers.input) fn({ target: env.inputs[`#${id}`] }); };

  await step('boot', async () => {
    assert.ok(env.handlers.click?.length && env.handlers.submit?.length && env.handlers.input?.length && env.handlers.keydown?.length, 'boot registered UI listeners');
    assert.match(env.app.innerHTML, /class="workspace practice-workspace"/);
    assert.match(env.app.innerHTML, /문제 1 \/ \d+/);
    assert.match(env.app.innerHTML, /data-install-sheet/, 'install sheet is shown at boot');
    assert.equal(document.body.dataset.tab, 'practice');
    assert.equal(document.activeElement, null, 'focus waits while the page is concealed');
    document.documentElement.style.visibility = '';
    await settle(120);
    assert.equal(document.activeElement?.dataset.action, 'install-later', 'focus moves into the sheet once the page is revealed');
  });

  await step('install sheet', async () => {
    assert.equal(env.header.inert, true, 'background is inert while the sheet is open');
    document.activeElement = env.nav[0];
    let prevented = false;
    for (const fn of env.handlers.keydown) fn({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });
    assert.ok(prevented, 'Tab outside the sheet is trapped');
    assert.equal(document.activeElement.dataset.action, 'install-later');
    tap(env, { action: 'install-later' });
    assert.doesNotMatch(env.app.innerHTML, /data-install-sheet/);
    assert.equal(env.header.inert, false, 'inert cleared when the sheet closes');
    assert.equal(document.activeElement, env.nav[1], 'focus returns to the current tab');
  });

  await step('learn tab and checkers', async () => {
    tap(env, { tab: 'learn' });
    assert.equal(document.body.dataset.tab, 'learn');
    assert.doesNotMatch(env.app.innerHTML, /practice-workspace/);
    assert.match(env.app.innerHTML, /<h2>암기표<\/h2>/);
    assert.match(env.app.innerHTML, /OBESE GOATS<\/span><span class="spoken">오비스 고츠/, 'phrase row with phonetic');
    type('page-check', '17');
    submit('page-form');
    assert.match(env.app.innerHTML, /<span>17쪽<\/span>/);
    type('month-check', '3');
    type('day-check', '14');
    submit('date-form');
    assert.match(env.app.innerHTML, /<span>64쪽<\/span>/);
    tap(env, { action: 'checker-order', order: 'DDMM' });
    submit('date-form');
    assert.match(env.app.innerHTML, /<span>일월 /);
  });

  await step('settings tab and save', async () => {
    tap(env, { tab: 'settings' });
    assert.equal(document.body.dataset.tab, 'settings');
    assert.match(env.app.innerHTML, /<h2>설정<\/h2>/);
    tap(env, { action: 'count', count: '15' });
    assert.equal(stored('pimax-practice-settings').count, 15);
    assert.equal(stored('pimax-practice-session').questions.length, 15, 'pristine session was rebuilt at the new length');
    assert.match(env.app.innerHTML, /data-count="15" class="selected"/);
    assert.match(env.notice.textContent, /바로 적용/);
    tap(env, { action: 'phonetic', on: 'false' });
    assert.equal(stored('pimax-practice-settings').phonetic, false);
    assert.match(env.app.innerHTML, /data-on="false" class="selected"/);
    tap(env, { tab: 'learn' });
    assert.doesNotMatch(env.app.innerHTML, /class="spoken"/, 'phonetic text is hidden in the learn tab');
    assert.match(env.app.innerHTML, /OBESE GOATS/);
    tap(env, { tab: 'settings' });
    tap(env, { action: 'install' });
    assert.match(env.app.innerHTML, /브라우저 메뉴를 열어 위 순서대로/, 'install help opens without a native prompt');
  });

  await step('practice answer', async () => {
    tap(env, { tab: 'practice' });
    assert.match(env.app.innerHTML, /문제 1 \/ 15/);
    tap(env, { action: 'tap' });
    assert.match(env.notice.textContent, /답을 공개/);
    assert.match(env.app.innerHTML, /한 번 더 탭하면 다음/);
    tap(env, { action: 'weak-toggle' });
    assert.equal(stored('pimax-practice-stats').weak.length >= 1, true, 'weak mark saved');
    assert.match(env.notice.textContent, /약점으로 표시/);
    tap(env, { action: 'tap' });
    assert.match(env.app.innerHTML, /문제 2 \/ 15/);
    const saved = stored('pimax-practice-session');
    assert.equal(saved.index, 1);
    assert.equal(saved.questions[0].graded, 'revealed');
    tap(env, { action: 'mode', mode: MODES[1] });
    assert.match(env.app.innerHTML, new RegExp(`data-mode="${MODES[1]}" class="selected"`));
  });

  await step('phrase display, weak review and new session', async () => {
    tap(env, { action: 'mode', mode: 'phrase' });
    tap(env, { action: 'phrase-display', value: 'half' });
    assert.equal(stored('pimax-practice-settings').phraseDisplay, 'half');
    tap(env, { action: 'map-pool', pool: 'weak' });
    assert.equal(stored('pimax-practice-session').mode, 'review');
    assert.match(env.app.innerHTML, /표시한 약점을 다시 떠올립니다/);
    tap(env, { action: 'new-session' });
    assert.equal(stored('pimax-practice-settings').mapPool, 'weak');
    assert.equal(stored('pimax-practice-session').mode, 'review', 'new session in weak pool restarts the review');
    tap(env, { action: 'map-pool', pool: 'all' });
    assert.equal(stored('pimax-practice-session').mode, 'map');
    assert.match(env.notice.textContent, /전체 문제로 시작/);
    const before = stored('pimax-practice-session').id;
    tap(env, { action: 'new-session' });
    assert.notEqual(stored('pimax-practice-session').id, before, 'new session builds a fresh round');
  });

  await step('reset stats', async () => {
    tap(env, { tab: 'settings' });
    tap(env, { action: 'reset-ask' });
    assert.match(env.app.innerHTML, /정말 지우기/);
    tap(env, { action: 'reset-no' });
    assert.doesNotMatch(env.app.innerHTML, /정말 지우기/);
    tap(env, { action: 'reset-ask' });
    tap(env, { action: 'reset-yes' });
    assert.deepEqual(stored('pimax-practice-stats').weak, []);
    assert.match(env.notice.textContent, /연습 기록을 지웠습니다/);
  });
  console.error = originalConsoleError;
});
