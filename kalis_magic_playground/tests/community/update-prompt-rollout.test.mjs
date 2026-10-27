import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { MIRROR_PAIRS } from '../../scripts/build-public.mjs';

const UPDATE_PROMPT_APPS = ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11', 'zz12', 'zz13', 'zz14', 'zz15', 'TabataTimer', 'KanameCue'];
// Friend snapshots (distribution-snapshots/<name>) that carry the same prompt as their personal app.
const SNAPSHOT = { zz1: 'kairos', zz2: 'unlock', zz3: 'calculator', zz4: 'choice', zz5: 'aletheia', zz6: 'tobira', zz7: 'usotsuki', zz11: 'spinner', zz13: 'qr', zz14: 'pimax' };
const read = (app, file) => readFileSync(new URL(`../../${app}/${file}`, import.meta.url), 'utf8');
const SIBLING = { zz1: 'magic-stopwatch-uni', zz2: 'magic-unlock', zz3: 'magic-calculator-v2', zz5: 'magic-aletheia', zz6: 'magic-tobira', zz7: 'magic-usotsuki', zz8: 'magic-asrai', zz10: 'magic-alter', zz11: 'magic-spinner', zz4: 'magic-choice', zz12: 'magic-memdeck', zz13: 'magic-qr', zz14: 'magic-pimax' };
// zz15, TabataTimer and KanameCue have no sibling original; they live only in this repository.
// Entry script each app's index.html loads right after update-prompt.js (it must load first).
const ENTRY = { zz1: './app.js', zz2: './app.js', zz3: './app.js', zz5: './app.js', zz6: './app.js', zz7: 'detector.js', zz8: 'contacts.js', zz10: './app.js', zz11: './app.js', zz4: './app.js', zz12: 'app.mjs', zz13: './app.mjs', zz14: 'app.mjs', zz15: './app.mjs', TabataTimer: './app.js', KanameCue: './app.mjs' };
// Where the prompt is offered (settings only) and the exact safe() expression each app passes.
const WIRING = {
  zz1: { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: '!settings.hidden&&state!=="running"&&!presetMode' },
  zz2: { offer: ['rewind.js'], hide: ['rewind.js'], init: ['settings.js'], safe: "session.screen === 'settings'" },
  zz3: { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: 'dateSettings.classList.contains("open")' },
  zz5: { offer: ['performance-run.js'], hide: ['performance-run.js'], init: ['controller.js'], safe: "view === 'settings' && !settings.hidden" },
  zz6: { offer: ['mode-switch.js'], hide: ['mode-switch.js'], init: ['app.js'], safe: "state.mode === 'settings'" },
  zz7: { offer: ['controller-screens.js'], hide: ['controller-screens.js'], init: ['detector.js'], safe: 'settingsVisible()' },
  zz8: { offer: ['contacts-screen.js'], hide: ['contacts-screen.js'], init: ['contacts.js'], safe: '!settingsScreen.hidden' },
  zz10: { offer: ['settings-panel.js'], hide: ['settings-panel.js', 'camera.js'], init: ['app.js'], safe: '!settings.hidden' },
  zz11: { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: '!settings.hidden' },
  zz4: { offer: ['fake-home-surface.js'], hide: ['fake-home-surface.js'], init: ['app.js'], safe: "document.body.dataset.view === 'settings'" },
  zz12: { offer: ['app.mjs'], hide: ['app.mjs'], init: ['app.mjs'], safe: "tab==='settings'" },
  zz13: { offer: ['app.mjs'], hide: ['app.mjs'], init: ['app.mjs'], safe: "$('settings').open===true" },
  zz14: { offer: ['app.mjs'], hide: ['app.mjs'], init: ['app.mjs'], safe: 'state.tab === "settings"' },
  zz15: { offer: ['presets.mjs'], hide: ['presets.mjs'], init: ['camera.mjs'], safe: "$('settings').open === true" },
  TabataTimer: { offer: ['app.js'], hide: ['app.js'], init: ['app.js'], safe: "$('settings').open === true && $('run').hidden && !running" },
  KanameCue: { offer: ['settings.mjs'], hide: ['settings.mjs'], init: ['show.mjs'], safe: "$('settings').open === true && $('run').hidden" },
};
const JS_FILES = (app) => readdirSync(new URL(`../../${app}/`, import.meta.url)).filter((file) => /\.m?js$/.test(file) && file !== 'update-prompt.js' && file !== 'sw.js');

test('update-prompt.js is one byte-identical file in every adopting app', () => {
  const source = read('zz11', 'update-prompt.js');
  assert.equal(UPDATE_PROMPT_APPS.length, 16);
  for (const app of UPDATE_PROMPT_APPS) assert.equal(read(app, 'update-prompt.js'), source, app);
});

test('every adopting app mirrors update-prompt.js to its sibling original', () => {
  for (const app of UPDATE_PROMPT_APPS.filter((name) => SIBLING[name])) {
    assert.ok(MIRROR_PAIRS.some(([original, mirror]) => original === `../../${SIBLING[app]}/update-prompt.js` && mirror === `${app}/update-prompt.js`), app);
  }
});

test('each app worker precaches the prompt, answers SKIP_WAITING and carries a new cache token', () => {
  for (const app of UPDATE_PROMPT_APPS) {
    const sw = read(app, 'sw.js');
    assert.equal(sw.split('"./update-prompt.js"').length - 1, 1, `${app} shell lists update-prompt.js once`);
    assert.match(sw, /(?:CACHE_NAME = CACHE_PREFIX \+ |CACHE=PREFIX\+)'[^']*-update-prompt-\d+';/, app);
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
  for (const app of UPDATE_PROMPT_APPS.filter((name) => name !== 'zz11')) {
    const wiring = WIRING[app];
    const files = JS_FILES(app);
    for (const [kind, pattern] of [['offer', /MagicUpdate\??\.offer\(\)/], ['hide', /MagicUpdate\??\.hide\(\)/], ['init', /MagicUpdate\??\.init\(/]]) {
      const where = files.filter((file) => pattern.test(read(app, file)));
      assert.deepEqual(where.sort(), [...wiring[kind]].sort(), `${app} ${kind}`);
    }
    const initFile = read(app, wiring.init[0]);
    assert.ok(initFile.includes(`safe: () => ${wiring.safe}`) || initFile.includes(`safe:()=>${wiring.safe}`), `${app} safe()`);
    // The registration stays owned by the app: the prompt is attached to it, never registered by update-prompt.js.
    assert.doesNotMatch(initFile, /MagicUpdate\??\.init\(\{[^}]*swUrl/, app);
    assert.match(initFile, /MagicUpdate\??\.init\(\{ ?(registration|registrationPromise)/, app);
  }
});

test('every friend snapshot carries the identical prompt, worker listener and script tag', () => {
  const source = read('zz11', 'update-prompt.js');
  for (const [app, snapshot] of Object.entries(SNAPSHOT)) {
    const dir = `distribution-snapshots/${snapshot}`;
    assert.equal(readFileSync(new URL(`../../${dir}/update-prompt.js`, import.meta.url), 'utf8'), source, dir);
    assert.match(readFileSync(new URL(`../../${dir}/sw.js`, import.meta.url), 'utf8'), /SKIP_WAITING/, dir);
    assert.match(readFileSync(new URL(`../../${dir}/index.html`, import.meta.url), 'utf8'), /update-prompt\.js/, dir);
    assert.ok(app);
  }
});
