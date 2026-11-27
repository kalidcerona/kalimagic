import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';

const UPDATE_PROMPT_APPS = ['distribution-snapshots/kairos', 'distribution-snapshots/unlock', 'distribution-snapshots/calculator', 'distribution-snapshots/choice', 'distribution-snapshots/aletheia', 'distribution-snapshots/tobira', 'distribution-snapshots/usotsuki', 'distribution-snapshots/spinner', 'distribution-snapshots/memdeck', 'distribution-snapshots/qr', 'distribution-snapshots/pimax', 'distribution-snapshots/asrai', 'distribution-snapshots/alter', 'distribution-snapshots/uramichi', 'TabataTimer', 'KanameCue'];
// Friend snapshots (distribution-snapshots/<name>) that carry the same prompt as their personal app.
const SNAPSHOT = { 'distribution-snapshots/kairos': 'kairos', 'distribution-snapshots/unlock': 'unlock', 'distribution-snapshots/calculator': 'calculator', 'distribution-snapshots/choice': 'choice', 'distribution-snapshots/aletheia': 'aletheia', 'distribution-snapshots/tobira': 'tobira', 'distribution-snapshots/usotsuki': 'usotsuki', 'distribution-snapshots/spinner': 'spinner', 'distribution-snapshots/qr': 'qr', 'distribution-snapshots/pimax': 'pimax' };
const read = (app, file) => readFileSync(new URL(`../../${app}/${file}`, import.meta.url), 'utf8');
const SIBLING = { 'distribution-snapshots/kairos': 'magic-stopwatch-uni', 'distribution-snapshots/unlock': 'magic-unlock', 'distribution-snapshots/calculator': 'magic-calculator-v2', 'distribution-snapshots/aletheia': 'magic-aletheia', 'distribution-snapshots/tobira': 'magic-tobira', 'distribution-snapshots/usotsuki': 'magic-usotsuki', 'distribution-snapshots/asrai': 'magic-asrai', 'distribution-snapshots/alter': 'magic-alter', 'distribution-snapshots/spinner': 'magic-spinner', 'distribution-snapshots/choice': 'magic-choice', 'distribution-snapshots/memdeck': 'magic-memdeck', 'distribution-snapshots/qr': 'magic-qr', 'distribution-snapshots/pimax': 'magic-pimax' };
// zz15, TabataTimer and KanameCue have no sibling original; they live only in this repository.
// Entry script each app's index.html loads right after update-prompt.js (it must load first).
const ENTRY = { 'distribution-snapshots/kairos': './app.js', 'distribution-snapshots/unlock': './app.js', 'distribution-snapshots/calculator': './app.js', 'distribution-snapshots/aletheia': './app.js', 'distribution-snapshots/tobira': './app.js', 'distribution-snapshots/usotsuki': 'detector.js', 'distribution-snapshots/asrai': 'contacts.js', 'distribution-snapshots/alter': './app.js', 'distribution-snapshots/spinner': './app.js', 'distribution-snapshots/choice': './app.js', 'distribution-snapshots/memdeck': 'app.mjs', 'distribution-snapshots/qr': './app.mjs', 'distribution-snapshots/pimax': 'app.mjs', 'distribution-snapshots/uramichi': './app.mjs', TabataTimer: './app.js', KanameCue: './app.mjs' };
// Where the prompt is offered (settings only) and the exact safe() expression each app passes.
const WIRING = {
  'distribution-snapshots/kairos': { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: '!settings.hidden&&state!=="running"&&!presetMode' },
  'distribution-snapshots/unlock': { offer: ['rewind.js'], hide: ['rewind.js'], init: ['settings.js'], safe: "session.screen === 'settings'" },
  'distribution-snapshots/calculator': { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: 'dateSettings.classList.contains("open")' },
  'distribution-snapshots/aletheia': { offer: ['performance-run.js'], hide: ['performance-run.js'], init: ['controller.js'], safe: "view === 'settings' && !settings.hidden" },
  'distribution-snapshots/tobira': { offer: ['mode-switch.js'], hide: ['mode-switch.js'], init: ['app.js'], safe: "state.mode === 'settings'" },
  'distribution-snapshots/usotsuki': { offer: ['controller-screens.js'], hide: ['controller-screens.js'], init: ['detector.js'], safe: 'settingsVisible()' },
  'distribution-snapshots/asrai': { offer: ['contacts-screen.js'], hide: ['contacts-screen.js'], init: ['contacts.js'], safe: '!settingsScreen.hidden' },
  'distribution-snapshots/alter': { offer: ['settings-panel.js'], hide: ['settings-panel.js', 'camera.js'], init: ['app.js'], safe: '!settings.hidden' },
  'distribution-snapshots/spinner': { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: '!settings.hidden' },
  'distribution-snapshots/choice': { offer: ['fake-home-surface.js'], hide: ['fake-home-surface.js'], init: ['app.js'], safe: "document.body.dataset.view === 'settings'" },
  'distribution-snapshots/memdeck': { offer: ['app.mjs'], hide: ['app.mjs'], init: ['app.mjs'], safe: "tab === 'settings'" },
  'distribution-snapshots/qr': { offer: ['app.mjs'], hide: ['app.mjs'], init: ['app.mjs'], safe: "$('settings').open===true" },
  'distribution-snapshots/pimax': { offer: ['app.mjs'], hide: ['app.mjs'], init: ['app.mjs'], safe: 'state.tab === "settings"' },
  'distribution-snapshots/uramichi': { offer: ['presets.mjs'], hide: ['presets.mjs'], init: ['camera.mjs'], safe: "$('settings').open === true" },
  TabataTimer: { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: "$('settings').open === true && $('run').hidden && !run.isRunning()" },
  KanameCue: { offer: ['settings.mjs'], hide: ['settings.mjs'], init: ['show.mjs'], safe: "$('settings').open === true && $('run').hidden" },
};
const JS_FILES = (app) => readdirSync(new URL(`../../${app}/`, import.meta.url)).filter((file) => /\.m?js$/.test(file) && file !== 'update-prompt.js' && file !== 'choice-update-prompt.js' && file !== 'sw.js');

test('update-prompt.js is one byte-identical file in every adopting app', () => {
  const source = read('distribution-snapshots/spinner', 'update-prompt.js');
  assert.equal(UPDATE_PROMPT_APPS.length, 16);
  for (const app of UPDATE_PROMPT_APPS) assert.equal(read(app, 'update-prompt.js'), source, app);
});

test('each app worker precaches the prompt, answers SKIP_WAITING and carries a new cache token', () => {
  for (const app of UPDATE_PROMPT_APPS) {
    const sw = read(app, 'sw.js');
    assert.equal(sw.split('"./update-prompt.js"').length - 1, 1, `${app} shell lists update-prompt.js once`);
    assert.match(sw, /(?:CACHE_NAME = CACHE_PREFIX \+ |CACHE=PREFIX\+)'[^']*-update-prompt-\d+(?:-[A-Za-z0-9-]+)?';/, app);
    const listeners = {}; let skips = 0;
    vm.runInNewContext(sw, { URL, Response, Request, self: { registration: { scope: `https://example.test/${app}/` }, addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting: async () => { skips++; }, clients: { claim: async () => {} } } });
    listeners.message({ data: { type: 'other' } });
    listeners.message({ data: null });
    assert.equal(skips, 0, app);
    listeners.message({ data: { type: 'SKIP_WAITING' } });
    assert.equal(skips, 1, app);
  }
});

test('each app page loads update-prompt.js before its entry script', () => {
  for (const app of UPDATE_PROMPT_APPS) {
    const html = read(app, 'index.html');
    const at = html.indexOf('update-prompt.js"');
    const entry = html.indexOf(`src="${ENTRY[app]}"`);
    assert.ok(at > 0 && entry > at, `${app} loads update-prompt.js first`);
    assert.equal(html.split('update-prompt.js"').length - 1, 1, app);
  }
});

test('offer() is called only where settings opens, hide() where any safe screen closes, init() once with the app safe()', () => {
  for (const app of UPDATE_PROMPT_APPS.filter((name) => name !== 'distribution-snapshots/spinner')) {
    const wiring = WIRING[app];
    const files = JS_FILES(app);
    for (const [kind, pattern] of [['offer', /MagicUpdate\??\.offer\(\)/], ['hide', /MagicUpdate\??\.hide\(\)/], ['init', /MagicUpdate\??\.init\(/]]) {
      const where = files.filter((file) => pattern.test(read(app, file)));
      assert.deepEqual(where.sort(), [...wiring[kind]].sort(), `${app} ${kind}`);
    }
    const initFile = read(app, wiring.init[0]);
    assert.ok(initFile.includes(`safe: () => ${wiring.safe}`) || initFile.includes(`safe:()=>${wiring.safe}`) || initFile.replaceAll(/\s/g, '').includes(`safe:()=>${wiring.safe}`.replaceAll(/\s/g, '')), `${app} safe()`);
    // The registration stays owned by the app: the prompt is attached to it, never registered by update-prompt.js.
    assert.doesNotMatch(initFile, /MagicUpdate\??\.init\(\{[^}]*swUrl/, app);
    assert.match(initFile, /MagicUpdate\??\.init\(\{\s*(registration|registrationPromise)/, app);
  }
});

test('every friend snapshot carries the identical prompt, worker listener and script tag', () => {
  const source = read('distribution-snapshots/spinner', 'update-prompt.js');
  for (const [app, snapshot] of Object.entries(SNAPSHOT)) {
    const dir = `distribution-snapshots/${snapshot}`;
    assert.equal(readFileSync(new URL(`../../${dir}/update-prompt.js`, import.meta.url), 'utf8'), source, dir);
    assert.match(readFileSync(new URL(`../../${dir}/sw.js`, import.meta.url), 'utf8'), /SKIP_WAITING/, dir);
    assert.match(readFileSync(new URL(`../../${dir}/index.html`, import.meta.url), 'utf8'), /update-prompt\.js/, dir);
    assert.ok(app);
  }
});
