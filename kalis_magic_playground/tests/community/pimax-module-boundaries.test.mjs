import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Loads zz14/app.mjs and its real imports as separate ES modules (no concatenation, no shared scope),
// then drives boot, all three tabs, a settings change and one practice answer through click events.
// PIMAX_ROOT lets the mutation check point the same test at a scratch copy.
const root = process.env.PIMAX_ROOT ? pathToFileURL(`${process.env.PIMAX_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz14/', import.meta.url);

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };

function stubBrowser() {
  const storage = new Map();
  const handlers = {};
  const app = { innerHTML: '', setAttribute() {}, removeAttribute() {}, querySelector: () => null };
  const notice = { textContent: '' };
  const nav = ['learn', 'practice', 'settings'].map((tab) => ({
    dataset: { tab }, classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
  }));
  const document = {
    body: { dataset: {}, addEventListener(type, fn) { (handlers[type] ||= []).push(fn); } },
    documentElement: { style: {}, dataset: {} },
    visibilityState: 'visible',
    activeElement: null,
    addEventListener() {},
    querySelector(selector) {
      if (selector === '#app') return app;
      if (selector === '#notice') return notice;
      if (selector === '#nav button[aria-current=\'page\']' || selector === '#app button') return null;
      return null;
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
  define('HTMLFormElement', class {});
  define('HTMLInputElement', class {});
  return { storage, handlers, app, notice, nav };
}

// Click the first rendered button whose data attributes match, like a real tap on the visible UI.
function tap(env, match) {
  const attrs = (tag) => Object.fromEntries([...tag.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key.replace(/-(\w)/g, (_, ch) => ch.toUpperCase()), value]));
  const fromNav = env.nav.find((button) => match.tab && button.dataset.tab === match.tab);
  const tags = [...env.app.innerHTML.matchAll(/<button\b[^>]*>/g)].map(([tag]) => attrs(tag));
  const dataset = fromNav ? { action: 'tab', tab: fromNav.dataset.tab } : tags.find((item) => Object.entries(match).every(([key, value]) => item[key] === value));
  assert.ok(dataset, `no visible button for ${JSON.stringify(match)}`);
  for (const fn of env.handlers.click) fn({ target: { closest: () => ({ disabled: false, dataset }) } });
}

test('Pi Max modules run as real separate ES modules through boot, tabs, settings and a practice answer', async () => {
  const env = stubBrowser();
  const { MODES } = await import(new URL('core.mjs', root));
  await import(new URL('app.mjs', root));
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const step = async (name, action) => { await action(); await settle(); assert.deepEqual(errors, [], `${name} raised errors`); };

  await step('boot', async () => {
    assert.ok(env.handlers.click?.length && env.handlers.submit?.length && env.handlers.input?.length, 'boot registered UI listeners');
    assert.match(env.app.innerHTML, /class="workspace practice-workspace"/);
    assert.match(env.app.innerHTML, /문제 1 \/ \d+/);
    assert.match(env.app.innerHTML, /data-install-sheet/, 'install sheet is shown at boot');
    assert.equal(document.body.dataset.tab, 'practice');
  });

  await step('install sheet', async () => {
    tap(env, { action: 'install-later' });
    assert.doesNotMatch(env.app.innerHTML, /data-install-sheet/);
  });

  await step('learn tab', async () => {
    tap(env, { tab: 'learn' });
    assert.equal(document.body.dataset.tab, 'learn');
    assert.doesNotMatch(env.app.innerHTML, /practice-workspace/);
    assert.ok(env.app.innerHTML.length > 500, 'learn tab rendered content');
  });

  await step('settings tab and save', async () => {
    tap(env, { tab: 'settings' });
    assert.equal(document.body.dataset.tab, 'settings');
    assert.match(env.app.innerHTML, /<h2>설정<\/h2>/);
    tap(env, { action: 'count', count: '15' });
    assert.equal(JSON.parse(env.storage.get('pimax-practice-settings')).count, 15);
    assert.match(env.app.innerHTML, /data-count="15" class="selected"/);
    assert.match(env.notice.textContent, /문제 수/);
    tap(env, { action: 'phonetic', on: 'false' });
    assert.equal(JSON.parse(env.storage.get('pimax-practice-settings')).phonetic, false);
  });

  await step('practice answer', async () => {
    tap(env, { tab: 'practice' });
    assert.match(env.app.innerHTML, /문제 1 \/ \d+/);
    tap(env, { action: 'tap' });
    assert.match(env.notice.textContent, /답을 공개/);
    assert.match(env.app.innerHTML, /한 번 더 탭하면 다음/);
    tap(env, { action: 'tap' });
    assert.match(env.app.innerHTML, /문제 2 \/ \d+/);
    const saved = JSON.parse(env.storage.get('pimax-practice-session'));
    assert.equal(saved.index, 1);
    assert.equal(saved.questions[0].graded, 'revealed');
    tap(env, { action: 'mode', mode: MODES[1] });
    assert.match(env.app.innerHTML, new RegExp(`data-mode="${MODES[1]}" class="selected"`));
  });
  console.error = originalConsoleError;
});
