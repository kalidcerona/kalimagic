import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { MIRROR_PAIRS } from '../../scripts/build-public.mjs';
import { UPDATE_PROMPT_APPS, UPDATE_PROMPT_HOOKS, stripUpdatePrompt } from './update-prompt-hooks.mjs';

const read = (app, file) => readFileSync(new URL(`../../${app}/${file}`, import.meta.url), 'utf8');
const SIBLING = { zz1: 'magic-stopwatch-uni', zz2: 'magic-unlock', zz3: 'magic-calculator-v2', zz5: 'magic-aletheia', zz6: 'magic-tobira', zz7: 'magic-usotsuki', zz8: 'magic-asrai', zz10: 'magic-alter', zz11: 'magic-spinner' };
// Entry script each app's index.html loads right after update-prompt.js (it must load first).
const ENTRY = { zz1: './app.js', zz2: './app.js', zz3: './app.js', zz5: './app.js', zz6: './app.js', zz7: 'detector.js', zz8: 'contacts.js', zz10: './app.js', zz11: './app.js' };
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
};
const JS_FILES = (app) => Object.keys(UPDATE_PROMPT_HOOKS).filter((key) => key.startsWith(`${app}/`)).map((key) => key.slice(app.length + 1));

test('update-prompt.js is one byte-identical file in every adopting app', () => {
  const source = read('zz11', 'update-prompt.js');
  assert.equal(UPDATE_PROMPT_APPS.length, 9);
  for (const app of UPDATE_PROMPT_APPS) assert.equal(read(app, 'update-prompt.js'), source, app);
});

test('every adopting app mirrors update-prompt.js to its sibling original', () => {
  for (const app of UPDATE_PROMPT_APPS) {
    assert.ok(MIRROR_PAIRS.some(([original, mirror]) => original === `../../${SIBLING[app]}/update-prompt.js` && mirror === `${app}/update-prompt.js`), app);
  }
});

test('each app worker precaches the prompt, answers SKIP_WAITING and carries a new cache token', () => {
  for (const app of UPDATE_PROMPT_APPS) {
    const sw = read(app, 'sw.js');
    assert.equal(sw.split('"./update-prompt.js"').length - 1, 1, `${app} shell lists update-prompt.js once`);
    assert.match(sw, /const CACHE_NAME = CACHE_PREFIX \+ '[^']*-update-prompt-\d+';/, app);
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
    const files = JS_FILES(app).filter((file) => file.endsWith('.js') && file !== 'sw.js');
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

test('the approved hook table strips back to text without any update-prompt trace', () => {
  for (const key of Object.keys(UPDATE_PROMPT_HOOKS)) {
    const [app, file] = key.split('/');
    const stripped = stripUpdatePrompt(app, file, read(app, file));
    assert.doesNotMatch(stripped, /MagicUpdate|update-prompt/, key);
  }
});
