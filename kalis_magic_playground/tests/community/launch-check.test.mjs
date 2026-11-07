import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseMeta as parseLaunchMeta } from '../../zz5/logic-presets.js';
import { parseStoredState as parseLaunchState, defaultState } from '../../zz6/logic.js';

const apps = [['usotsuki', 'zz7', 'detector.js'], ['aletheia', 'zz5', 'app.js'], ['tobira', 'zz6', 'app.js']];
const read = (route, file) => readFileSync(new URL(`../../${route}/${file}`, import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function fixture(app, route, options = {}) {
  const calls = [], listeners = new Map(), timers = new Map(), opened = [];
  const scope = `https://example.test/${route}/`;
  const version = read(route, 'sw.js').match(/const CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/)[1];
  const cacheName = `${app}-shell-${encodeURIComponent(scope)}-${version}`;
  const navigator = { serviceWorker: { controller: { scriptURL: `${scope}sw.js` } }, vibrate: pattern => calls.push(Array.from(pattern)) };
  if (options.noVibrate) delete navigator.vibrate;
  if (options.noSW) delete navigator.serviceWorker;
  if (options.noController) navigator.serviceWorker.controller = null;
  const stored = options.stored || {};
  const sandbox = {
    URL, Blob, Promise, parseLaunchMeta, parseLaunchState, navigator,
    localStorage: { getItem(key) { if (options.storageError) throw Error('blocked'); return stored[key] ?? null; } },
    caches: {
      async keys() { if (options.cacheError) throw Error('blocked'); return options.stale ? [`${app}-shell-other-scope-old`] : [cacheName]; },
      async open(name) { opened.push(name); return { async match(url) { assert.equal(url, `${scope}index.html`); return !options.noIndex; } }; },
    },
    indexedDB: { open() {
      const request = {};
      queueMicrotask(() => {
        if (options.idbError) { request.onerror(); return; }
        request.result = {
          objectStoreNames: { contains: () => true }, close() {},
          transaction() { return { objectStore() { return { get(key) {
            const result = {};
            queueMicrotask(() => { result.result = options.records?.[key]; result.onsuccess(); });
            return result;
          } }; } }; },
        };
        request.onsuccess();
      });
      return request;
    } },
    window: {
      addEventListener(type, fn, settings) { assert.equal(settings.passive, true); listeners.set(type, fn); },
      setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  };
  const code = read(route, 'launch-check.js').replace(/^import .*;\n/gm, '').replace(/^export .*;\n/gm, '');
  vm.runInNewContext(`${code}\nstartLaunchCheck(); startLaunchCheck();`, sandbox);
  await flush();
  const down = (event = {}) => listeners.get('pointerdown')({ isPrimary: true, ...event });
  const up = () => listeners.get('pointerup')({});
  const advance = async () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } await flush(); };
  return { calls, down, up, advance, opened, cacheName };
}

for (const [app, route, entry] of apps) {
  test(`${app}: launch hook and exact release are precached`, () => {
    assert.match(read(route, entry), /startLaunchCheck\(\)/);
    assert.match(read(route, 'sw.js'), /["']\.\/launch-check.js["']/);
    assert.match(read(route, 'sw.js'), /-launch-check-1(?:-photo-notice-1|-perf-log-1)?'/);
  });
  test(`${app}: ready single pointerdown vibrates once for about two seconds without consuming events`, async () => {
    const f = await fixture(app, route);
    assert.equal(f.calls.length, 0);
    f.down({ preventDefault() { assert.fail('gesture consumed'); }, stopPropagation() { assert.fail('gesture stopped'); } });
    await f.advance();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].reduce((a, b) => a + b, 0), 2000);
    assert.ok(f.calls[0].every((ms, index) => ms === (index % 2 ? 70 : 30)));
    assert.deepEqual(f.opened, [f.cacheName]);
    f.up(); f.down(); await f.advance();
    assert.equal(f.calls.length, 1);
  });
  for (const failure of ['storageError', 'noController', 'cacheError', 'stale', 'noIndex']) {
    test(`${app}: ${failure} stays silent for this launch`, async () => {
      const f = await fixture(app, route, { [failure]: true });
      f.down(); await f.advance(); f.up(); f.down(); await f.advance();
      assert.equal(f.calls.length, 0);
    });
  }
  test(`${app}: no vibration API is harmless`, async () => {
    const f = await fixture(app, route, { noVibrate: true });
    f.down(); await f.advance(); assert.equal(f.calls.length, 0);
  });
  test(`${app}: unavailable service workers skip only the shell check`, async () => {
    const f = await fixture(app, route, { noSW: true });
    f.down(); await f.advance(); assert.equal(f.calls.length, 1);
  });
  test(`${app}: first multi-touch gesture stays silent, including later touches`, async () => {
    const f = await fixture(app, route);
    f.down(); f.down({ isPrimary: false }); await f.advance();
    f.up(); f.up(); f.down(); await f.advance(); assert.equal(f.calls.length, 0);
  });
}

for (const value of ['off', 'malformed']) {
  test(`usotsuki: ${value} saved setting suppresses readiness vibration`, async () => {
    const stored = value === 'off' ? { 'usotsuki.detector.vibration.v1': 'off' } : { 'usotsuki.detector.v1': '{' };
    const f = await fixture('usotsuki', 'zz7', { stored }); f.down(); await f.advance(); assert.equal(f.calls.length, 0);
  });
}
const photoIds = Array.from({ length: 12 }, (_, i) => `img_${i}`);
const photos = { 'aletheia.photoSets.v2': JSON.stringify({ version: 2, sets: [photoIds, Array(12).fill(null), Array(12).fill(null)] }) };
for (const mode of ['present', 'missing', 'empty', 'idbError', 'partial']) {
  test(`aletheia: registered photo set ${mode}`, async () => {
    const records = Object.fromEntries(photoIds.map(id => [id, { blob: new Blob(['photo']) }]));
    if (mode === 'missing') delete records.img_0;
    if (mode === 'empty') records.img_0 = {};
    const stored = { ...photos };
    if (mode === 'partial') stored['aletheia.photoSets.v2'] = JSON.stringify({ version: 2, sets: [[...photoIds.slice(1), null], Array(12).fill(null), Array(12).fill(null)] });
    const f = await fixture('aletheia', 'zz5', { stored, records, idbError: mode === 'idbError' });
    f.down(); await f.advance(); assert.equal(f.calls.length, mode === 'present' ? 1 : 0);
  });
}
for (const mode of ['present', 'missing', 'empty', 'idbError']) {
  test(`tobira: registered custom image ${mode}`, async () => {
    const state = defaultState(), id = state.presets[0].id;
    const stored = { 'tobira.v1': JSON.stringify(state), 'tobira.coinChoices.v1': JSON.stringify({ [id]: 'custom' }) };
    const records = mode === 'missing' ? {} : { [`coin:${id}`]: new Blob(mode === 'empty' ? [] : ['photo']) };
    const f = await fixture('tobira', 'zz6', { stored, records, idbError: mode === 'idbError' });
    f.down(); await f.advance(); assert.equal(f.calls.length, mode === 'present' ? 1 : 0);
  });
}
for (const present of [true, false]) {
  test(`tobira: wallpaper registration marker requires stored wallpaper (${present})`, async () => {
    const f = await fixture('tobira', 'zz6', { stored: { 'tobira.wallpaperCrop.v1': '5' }, records: present ? { wallpaper: new Blob(['photo']) } : {} });
    f.down(); await f.advance(); assert.equal(f.calls.length, present ? 1 : 0);
  });
}

for (const present of [true, false]) {
  test(`aletheia: saved performance preset image must exist (${present})`, async () => {
    const preset = { id: 'p_demo', name: 'Opening', mode: 'free', brushSize: 46, hiddenPercent: null, imageId: 'img_demo', imageMime: 'image/png', updatedAt: 10 };
    const stored = { 'aletheia.meta.v1': JSON.stringify({ version: 1, selectedId: preset.id, presets: [preset] }) };
    const records = present ? { img_demo: { blob: new Blob(['photo']) } } : {};
    const f = await fixture('aletheia', 'zz5', { stored, records });
    f.down(); await f.advance(); assert.equal(f.calls.length, present ? 1 : 0);
  });
}
for (const [app, route, key] of [['aletheia', 'zz5', 'aletheia.meta.v1'], ['tobira', 'zz6', 'tobira.v1']]) {
  test(`${app}: corrupt saved settings never signal ready`, async () => {
    const f = await fixture(app, route, { stored: { [key]: '{}' } });
    f.down(); await f.advance(); assert.equal(f.calls.length, 0);
  });
}
