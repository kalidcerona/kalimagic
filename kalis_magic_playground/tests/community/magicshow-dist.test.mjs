import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { MAGICSHOW_EXTRAS, magicshowRuntimeFiles } from '../../scripts/magicshow-files.mjs';
import { DISTRIBUTION_APPS, shouldCopyMagicshow, transformDistributionDocument, verifyAppDisplayPolicy } from '../../scripts/build-public.mjs';
import gate, { classifyPath, MAGICSHOW_PUBLIC_BETA } from '../../netlify/edge-functions/tools-gate.mjs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { gateCookieName, signGateCookie, verifyGateCookie } from '../../netlify/functions/_lib/tool-gate.mjs';
import { allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';
const root = new URL('../../', import.meta.url);
const read = file => readFile(new URL(file, root));
const shared = 'distribution-snapshots/magicshow';
async function filesUnder(route) {
  const files = [];
  for (const entry of await readdir(new URL(`${route}/`, root), { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(`${route}/${entry.name}`)).map(file => `${entry.name}/${file}`));
    else files.push(entry.name);
  }
  return files.sort();
}

test('Magicshow snapshot contains only allowed runtime files and exact deployment precache', async () => {
  const files = await filesUnder(shared);
  const html = (await read(`${shared}/index.html`)).toString();
  const runtime = magicshowRuntimeFiles(html);
  const base = [...new Set([...runtime, ...MAGICSHOW_EXTRAS])];
  assert.deepEqual(files.filter(file => !file.startsWith('assets/') && !file.startsWith('fonts/')), base.sort());
  for (const anchor of ['</head>', '<body', '</body>']) assert.equal(html.split(anchor).length, 2, anchor);
  assert.ok(files.some(file => file.startsWith('assets/')));
  for (const file of ['assets/aud-a1.webp', 'assets/ui/ui-button.webp', 'assets/kit/panel.webp', 'assets/story/intro-1-living.webp', 'assets/ui/minigames/monte-queen.webp', 'assets/future/deeper/art.webp']) assert.equal(shouldCopyMagicshow(file), true, file);
  for (const font of ['fonts/Galmuri11.woff2', 'fonts/Galmuri11-Bold.woff2', 'fonts/Galmuri9.woff2', 'fonts/OFL.md']) assert.ok(files.includes(font), font);
  for (const file of files) {
    assert.equal(shouldCopyMagicshow(file), true, file);
    assert.deepEqual(classifyPath(`/tools/magicshow/${file}`), { mode: 'public' }, file);
  }
  for (const file of ['.env', '.gen/icon.png', 'README.md', 'PLAN.md', 'test-core.mjs', 'sim.mjs', 'tools/x.js', 'assets/.private.png', 'assets/logo.bak.png', 'assets/.private.webp', 'assets/logo.bak.webp.txt', 'fonts/private.js', 'fonts/.private.woff2', 'fonts/nested/private.woff2']) assert.equal(shouldCopyMagicshow(file), false, file);
  assert.deepEqual(DISTRIBUTION_APPS.find(app => app.tool === 'magicshow'), { source: shared, target: 'magicshow', tool: 'magicshow' });
  const sw = (await read(`${shared}/sw.js`)).toString();
  const precache = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(precache.map(file => file.replace(/^\.\//, '')).sort(), files.filter(file => file !== 'update.html'));
  assert.equal(new Set(precache).size, files.length - 1);
  for (const file of runtime) { assert.ok(files.includes(file), file); assert.ok(precache.includes('./' + file), file); }
  assert.deepEqual(precache.slice(1, runtime.length + 1), runtime.map(file => './' + file));
  assert.match(sw, /CACHE_PREFIX = 'magicshow-dist-'/);
  assert.match(sw, /CACHE_NAME = CACHE_PREFIX \+ '[a-f0-9]{16}-coherent-1-distribution'/);
  assert.ok(!precache.some(file => file.includes('/tools/_check')));
});

test('Magicshow manifest and HTML preserve the fullscreen beta identity (any orientation: the game has a portrait layout) without a login check', async () => {
  const manifest = JSON.parse(await read(`${shared}/manifest.webmanifest`));
  assert.equal(manifest.name, '칼리의 마술 성장기');
  assert.equal(manifest.short_name, '칼리마술');
  for (const field of ['id', 'start_url', 'scope']) assert.equal(manifest[field], '/tools/magicshow/');
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.theme_color, '#151020');
  assert.equal(manifest.background_color, '#151020');
  for (const size of [192, 512]) {
    assert.ok(manifest.icons.some(icon => icon.src === `icon-${size}.png` && icon.sizes === `${size}x${size}` && icon.type === 'image/png'));
    const png = await read(`${shared}/icon-${size}.png`);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  for (const [file, width, height] of [['apple-touch-icon.png', 180, 180], ['favicon-32.png', 32, 32], ['og-image.png', 1200, 630]]) {
    const png = await read(`${shared}/${file}`);
    assert.equal(png.readUInt32BE(16), width, file);
    assert.equal(png.readUInt32BE(20), height, file);
  }
  const html = (await read(`${shared}/index.html`)).toString();
  const description = '가족 거실에서 우주까지, 마술로 관객을 감탄시키는 방치형 게임';
  for (const value of ['<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">', '<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">', `<meta name="description" content="${description}">`, '<meta property="og:type" content="website">', '<meta property="og:site_name" content="칼리의 마술 성장기">', '<meta property="og:title" content="칼리의 마술 성장기">', `<meta property="og:description" content="${description}">`, '<meta property="og:url" content="https://kalimagic.netlify.app/tools/magicshow/">', '<meta property="og:image" content="https://kalimagic.netlify.app/tools/magicshow/og-image.png">', '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', '<meta name="twitter:card" content="summary_large_image">']) assert.ok(html.includes(value), value);
  for (const value of ['rel="manifest"', 'apple-mobile-web-app-capable', 'theme-color', 'src="update-prompt.js"', 'data-magic-customize="off"', 'src="install-prompt.js"', 'href="install-prompt.css"']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /friend-apps-check|\/tools\/_check|accessGuard/);
  assert.equal(transformDistributionDocument(html, { target: 'magicshow', tool: 'magicshow' }), html);
});

test('Magicshow entry variants are public while traversal and duplicate slashes are rejected', () => {
  for (const path of ['/tools/magicshow', '/tools/magicshow/', '/tools/MAGICSHOW/', '/TOOLS/MAGICSHOW/', '/tools/magicshow/index', '/tools/magicshow/index.html', '/tools/magicshow/ui.js', '/tools/magicshow/sw.js', '/tools/magicshow/icon.svg', '/tools/magicshow/nested/icon-192.png', '/tools/magicshow/index/manifest.webmanifest']) {
    assert.deepEqual(classifyPath(path), { mode: 'public' }, path);
  }
  for (const path of ['/tools/magicshow/../index', '/tools/magicshow/%2e%2e/index', '/tools/magicshow/%2e/index', '/tools/magicshow/./index', '/tools//magicshow//index.html', '/tools/magicshow//ui.js', '/tools/magicshow/%2fui.js']) assert.deepEqual(classifyPath(path), { mode: 'block' });
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) assert.deepEqual(classifyPath(`/tools/magicshow/${file}`), { mode: 'public' });
  assert.equal(MAGICSHOW_PUBLIC_BETA, true);
  for (const tool of ['choice', 'pimax', 'calc', 'aletheia', 'usotsuki', 'tobira', 'spinner', 'unlock', 'stopwatch-uni']) {
    for (const suffix of ['', '/', '/index', '/index.html', '/app.js']) assert.deepEqual(classifyPath(`/tools/${tool}${suffix}`), { mode: 'gated', tool }, tool + suffix);
  }
  assert.deepEqual(classifyPath('/tools/magicshow-other/'), { mode: 'gated', tool: 'calc' });
  assert.equal(allowOnCheckError('magicshow'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'magicshow').valid, false);
  assert.equal(gateCookieName('magicshow'), 'kali_magicshow_gate');
  assert.equal(accessTableForTool('magicshow'), 'friend_app_access');
  assert.equal(isValidTool('magicshow'), true);
  assert.ok(FRIEND_APP_TOOLS.has('magicshow'));
});

test('Magicshow edge serves no-cookie runtime without checking grants; other tools still reject it', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { throw new Error('Public beta must not call the grant endpoint'); };
  const context = { next: async () => { calls++; return new Response('runtime'); } };
  try {
    const token = await signGateCookie('friend@example.com', 'magicshow', 'test-secret');
    assert.equal((await verifyGateCookie(token, 'test-secret')).tool, 'magicshow');
    for (const route of ['/tools/magicshow', '/tools/MAGICSHOW/', '/TOOLS/MAGICSHOW/index', '/tools/magicshow/ui.js']) {
      const response = await gate(new Request(`https://example.com${route}`), context);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'runtime');
    }
    assert.equal(calls, 4);
    for (const tool of ['choice', 'pimax', 'calc', 'aletheia', 'usotsuki', 'unlock']) {
      let response = await gate(new Request(`https://example.com/tools/${tool}/`), context);
      if (response.status === 301) response = await gate(new Request(new URL(response.headers.get('location'), 'https://example.com')), context);
      assert.equal(response.status, 302, tool);
    }
    assert.equal(calls, 4);
  } finally { globalThis.fetch = previousFetch; }
});

test('Magicshow login, hosting, migration and admin grant are registered', async () => {
  const window = {};
  vm.runInNewContext((await read('tools/login/gate-util.js')).toString(), { window });
  assert.equal(window.ToolGateUtil.safeTo('/tools/magicshow/index.html'), '/tools/magicshow/index.html');
  assert.equal(window.ToolGateUtil.toolFromPath('/tools/magicshow/'), 'magicshow');
  assert.ok((await read('tools/login/login.js')).toString().includes("magicshow: '칼리 마술 성장기 (베타)'"));
  const context = {};
  vm.runInNewContext((await read('admin-app-model.js')).toString(), context);
  const html = (await read('admin.html')).toString();
  for (const [tool, name] of [['magicshow', '칼리 마술 성장기 (베타)']]) {
    assert.ok(context.AdminAppModel.APP_CATALOG.some(app => app.id === tool && app.path === `/tools/${tool}/`));
    assert.equal(context.AdminAppModel.toolLabel(tool), name);
    assert.ok(html.includes(`data-app-card="${tool}"`));
    assert.ok(html.includes(`data-copy-link="/tools/${tool}/"`));
  }
  assert.match((await read('netlify.toml')).toString(), /for = "\/tools\/magicshow\/manifest\.webmanifest"\s*\[headers.values\]\s*Content-Type = "application\/manifest\+json"/);
  const sql = (await read('supabase/migrations/20261011_friend_apps_magicshow.sql')).toString();
  assert.match(sql, /begin;[\s\S]*drop constraint if exists friend_app_access_tool_check;[\s\S]*add constraint friend_app_access_tool_check[\s\S]*commit;/);
  assert.deepEqual([...sql.matchAll(/'([^']+)'/g)].map(match => match[1]), [...FRIEND_APP_TOOLS].filter(tool => tool !== 'gwayubulgeup'));
  assert.doesNotMatch(sql, /row level security|create policy|drop policy/i);
});

test('Magicshow built files equal the pinned snapshot and all local references exist', { skip: process.env.MAGICSHOW_VERIFY_DIST !== '1' }, async () => {
  assert.deepEqual(await filesUnder('dist/tools/magicshow'), await filesUnder(shared));
  for (const file of await filesUnder(shared)) assert.deepEqual(await read(`dist/tools/magicshow/${file}`), await read(`${shared}/${file}`), file);
  const html = (await read('dist/tools/magicshow/index.html')).toString();
  for (const [, file] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) { if (!/^(?:https?:|data:)/.test(file)) await read(`dist/tools/magicshow/${file}`); }
  await verifyAppDisplayPolicy(new URL('../../dist/', import.meta.url).pathname, ['tools/magicshow']);
});

async function installRuntime({ ua = 'Android Chrome/140', platform = 'Linux', touch = 0, display = '', saved = new Map(), now = 1000000000, storageError = false, standalone = false } = {}) {
  const events = new Map(), queries = [], nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {
      hidden: false, disabled: false, textContent: '', innerHTML: '', className: '', events: new Map(),
      addEventListener(name, callback) { this.events.set(name, callback); },
      focus() { document.activeElement = this; },
      querySelector: node,
      querySelectorAll() { return ['[data-close]', '[data-install]', '[data-copy]', '[data-later]'].map(node); }
    });
    return nodes.get(key);
  };
  const created = [];
  const document = { activeElement: node('game-intro'), events: new Map(), addEventListener(name, callback, capture) { this.events.set(name, { callback, capture }); }, createElement: tag => (created.push(tag), node(tag)), body: { appendChild() {} } };
  const location = { href: 'https://example.test/tools/magicshow/?friend=1' };
  let copied = '';
  const navigator = { userAgent: ua, platform, maxTouchPoints: touch, standalone, clipboard: { async writeText(value) { copied = value; } } };
  const window = { addEventListener: (name, callback) => events.set(name, callback), matchMedia(query) {
    const media = { matches: query === `(display-mode: ${display})`, addEventListener(name, callback) { this.change = callback; } };
    queries.push(media); return media;
  } };
  const localStorage = { getItem(key) { if (storageError) throw Error('denied'); return saved.get(key) ?? null; }, setItem(key, value) { if (storageError) throw Error('denied'); saved.set(key, value); } };
  vm.runInNewContext((await read('scripts/magicshow-dist/install-prompt.js')).toString(), {
    window, navigator, document, location, localStorage, URL, Date: { now: () => now }
  });
  const click = key => node(key).events.get('click')();
  const tapInstallButton = () => {
    const result = { prevented: 0, stopped: 0 };
    const target = { closest: selector => selector === '#installButton' ? target : null };
    document.events.get('click').callback({ target, preventDefault() { result.prevented++; }, stopImmediatePropagation() { result.stopped++; } });
    return result;
  };
  return { created, tapInstallButton, events, queries, node, saved, click, location, copied: () => copied, document, now };
}

test('Magicshow first-open offer waits three days and manual entry restores it without touching intro', async () => {
  const app = await installRuntime();
  assert.equal(app.node('div').hidden, false);
  assert.equal(app.node('button').hidden, false);
  app.click('[data-later]');
  assert.equal(app.node('div').hidden, true);
  assert.equal(app.document.activeElement, app.node('game-intro'));
  const early = await installRuntime({ saved: app.saved, now: app.now + 3 * 86400000 - 1 });
  assert.equal(early.node('div').hidden, true);
  const tap = early.tapInstallButton();
  assert.deepEqual(tap, { prevented: 1, stopped: 1 });
  assert.equal(early.document.events.get('click').capture, true);
  assert.deepEqual(early.created, ['div'], 'no launcher element is created');
  assert.deepEqual(early.created, ['div'], 'no launcher element is created');
  assert.equal(early.node('div').hidden, false);
  const due = await installRuntime({ saved: app.saved, now: app.now + 3 * 86400000 });
  assert.equal(due.node('div').hidden, false);
  const privateMode = await installRuntime({ storageError: true });
  assert.equal(privateMode.node('div').hidden, false);
  privateMode.click('[data-close]');
  assert.equal(privateMode.node('div').hidden, true);
});

test('Magicshow installed modes and installation signal suppress the popup and leave the game install button alone', async () => {
  for (const options of [{ display: 'fullscreen' }, { display: 'standalone' }, { standalone: true }]) {
    const app = await installRuntime(options);
    assert.equal(app.node('div').hidden, true);
    assert.deepEqual(app.tapInstallButton(), { prevented: 0, stopped: 0 });
    assert.equal(app.node('div').hidden, true);
    let prompts = 0;
    app.events.get('beforeinstallprompt')({ preventDefault() { prompts++; } });
    assert.equal(prompts, 0);
  }
  const app = await installRuntime();
  app.events.get('appinstalled')();
  assert.equal(app.node('div').hidden, true);
  assert.deepEqual(app.tapInstallButton(), { prevented: 0, stopped: 0 });
  const changed = await installRuntime();
  changed.queries[0].matches = true;
  changed.queries[0].change();
  assert.equal(changed.node('div').hidden, true);
});

test('Magicshow Chrome and Samsung prompts run only on tap, are consumed once and handle late outcomes', async () => {
  for (const ua of ['Android Chrome/140', 'Android SamsungBrowser/28 Chrome/140']) {
    for (const outcome of ['accepted', 'dismissed', 'error']) {
      const app = await installRuntime({ ua });
      let prompts = 0, prevented = 0;
      app.events.get('beforeinstallprompt')({ preventDefault() { prevented++; }, prompt() { prompts++; if (outcome === 'error') throw Error('unavailable'); }, userChoice: Promise.resolve({ outcome }) });
      assert.equal(prevented, 1);
      assert.equal(prompts, 0);
      const tapped = app.click('[data-install]');
      assert.equal(prompts, 1, 'prompt runs synchronously inside the user tap');
      await tapped;
      await app.click('[data-install]');
      assert.equal(prompts, 1);
      assert.equal(app.node('[data-install]').disabled, false);
    }
  }
  const app = await installRuntime();
  let resolve;
  app.events.get('beforeinstallprompt')({ preventDefault() {}, prompt() {}, userChoice: new Promise(done => { resolve = done; }) });
  const pending = app.click('[data-install]');
  app.events.get('appinstalled')();
  resolve({ outcome: 'accepted' });
  await pending;
  assert.equal(app.node('div').hidden, true);
  assert.equal(app.node('[data-status]').textContent, '');
});

test('Magicshow Safari uses visual steps and places the share arrow for iPhone and iPad', async () => {
  for (const [options, position] of [[{ ua: 'iPhone Safari/604' }, 'is-iphone'], [{ ua: 'iPad Safari/604' }, 'is-ipad'], [{ ua: 'Macintosh Safari/604', platform: 'MacIntel', touch: 5 }, 'is-ipad']]) {
    const app = await installRuntime(options);
    assert.match(app.node('[data-guide]').innerHTML, /□↑[\s\S]*홈 화면에 추가[\s\S]*추가/);
    assert.match(app.node('[data-arrow]').className, new RegExp(position));
    assert.equal(app.node('[data-arrow]').hidden, false);
    app.click('[data-close]');
    assert.equal(app.node('[data-arrow]').hidden, true);
  }
});

test('Magicshow in-app browsers explain external opening and copy the current link', async () => {
  for (const name of ['KAKAOTALK', 'Instagram', 'FBAN', 'FBAV', 'NAVER', 'Line/14']) {
    for (const os of ['iPhone Safari/604', 'Android Chrome/140']) {
      const app = await installRuntime({ ua: `${os} ${name}` });
      assert.equal(app.node('[data-install]').textContent, '브라우저로 열기');
      assert.equal(app.node('[data-copy]').hidden, false);
      assert.match(app.node('[data-guide]').textContent, os.startsWith('iPhone') ? /Safari/ : /다른 브라우저로 열기/);
      await app.click('[data-copy]');
      assert.equal(app.copied(), 'https://example.test/tools/magicshow/?friend=1');
      await app.click('[data-install]');
      if (name === 'KAKAOTALK' && os.startsWith('Android')) assert.match(app.location.href, /^intent:\/\/example\.test\/tools\/magicshow\/\?friend=1#Intent;scheme=https;package=com\.android\.chrome;/);
      else assert.equal(app.location.href, 'https://example.test/tools/magicshow/?friend=1');
    }
  }
  const css = (await read('scripts/magicshow-dist/install-prompt.css')).toString();
  assert.match(css, /Galmuri11\.woff2/);
  assert.match(css, /min-height:44px;min-width:44px/);
  assert.match(css, /max-height:calc\(100dvh/);
});

async function runWorker({ active }) {
  const listeners = new Map(), calls = { skipWaiting: 0, claim: 0, deleted: [] };
  let cachedAll = null, installDone;
  const self = {
    registration: { scope: 'https://example.test/tools/magicshow/', active },
    skipWaiting() { calls.skipWaiting++; return Promise.resolve(); },
    clients: { claim() { calls.claim++; return Promise.resolve(); } },
    addEventListener: (name, callback) => listeners.set(name, callback)
  };
  const caches = {
    open: async () => ({ addAll: async requests => { cachedAll = requests.length; if (self.failCache) throw Error('offline'); } }),
    keys: async () => ['magicshow-dist-old', 'other-cache'],
    delete: async name => { calls.deleted.push(name); return true; }
  };
  vm.runInNewContext((await read('scripts/magicshow-dist/sw-template.js')).toString(), { self, caches, URL, Request, Promise, Response, fetch: async () => new Response('') });
  return { listeners, calls, self, cached: () => cachedAll };
}
const waitFor = async (listeners, name) => { let promise; listeners.get(name)({ waitUntil: p => { promise = p; } }); return promise; };

test('Magicshow service worker waits on install, accepts SKIP_WAITING and still claims and prunes', async () => {
  for (const active of [null, { state: 'activated' }]) {
    const worker = await runWorker({ active });
    await waitFor(worker.listeners, 'install');
    assert.equal(worker.calls.skipWaiting, 0, `active=${Boolean(active)}`);
    let accepted; worker.listeners.get('message')({ data: { type: 'SKIP_WAITING' }, waitUntil: p => { accepted = p; } });
    await accepted; assert.equal(worker.calls.skipWaiting, 1);
    assert.ok(worker.cached() > 0);
    await waitFor(worker.listeners, 'activate');
    assert.equal(worker.calls.claim, 1);
    assert.deepEqual(worker.calls.deleted, ['magicshow-dist-old']);
  }
  const failing = await runWorker({ active: { state: 'activated' } });
  failing.self.failCache = true;
  await assert.rejects(waitFor(failing.listeners, 'install'));
  assert.equal(failing.calls.skipWaiting, 0, 'incomplete shell must not take over');
});

test('Magicshow art warms after shell, tolerates a missing asset, and retries only missing files next launch', async () => {
  const template = (await read('scripts/magicshow-dist/sw-template.js')).toString();
  const shell = ['./index.html', './ui.js', './fonts/Galmuri11.woff2', './assets/missing.webp', './assets/ok.webp'];
  const source = template.replace(/const SHELL = \[[\s\S]*?\];/, `const SHELL = ${JSON.stringify(shell)};`);
  const listeners = new Map(), stored = new Map(), requests = [], warnings = [];
  let critical = [], fail = true;
  const self = { registration: { scope: 'https://example.test/tools/magicshow/' }, clients: { claim: async () => {} }, addEventListener: (name, callback) => listeners.set(name, callback) };
  const cache = { addAll: async items => { critical = items.map(r => new URL(r.url).pathname.split('/').pop()); }, match: async url => stored.get(url), put: async (url, response) => stored.set(url, response) };
  const caches = { open: async () => cache, keys: async () => [], delete: async () => true };
  vm.runInNewContext(source, { self, caches, URL, Request, Promise, Response, console: { warn: (...args) => warnings.push(args) }, fetch: async request => { requests.push(request.url); if (fail && request.url.endsWith('missing.webp')) throw Error('offline'); return new Response('art'); } });
  await waitFor(listeners, 'install');
  assert.deepEqual(Array.from(critical), ['index.html', 'ui.js']); assert.equal(requests.length, 0);
  await waitFor(listeners, 'activate');
  assert.equal(requests.length, 0, 'activation must not start or await optional art');
  let warm; listeners.get('message')({ data: { type: 'PRECACHE_ART' }, waitUntil: p => { warm = p; } }); await warm;
  assert.equal(stored.size, 2); assert.equal(warnings.length, 1);
  fail = false; requests.length = 0;
  let retry; listeners.get('message')({ data: { type: 'PRECACHE_ART' }, waitUntil: p => { retry = p; } }); await retry;
  assert.equal(stored.size, 3); assert.equal(requests.length, 1); assert.match(requests[0], /missing\.webp$/);
});

async function runRegistration({ waiting = true, safe = false } = {}) {
  const source = (await read('scripts/magicshow-dist/update-prompt.js')).toString();
  const listen = () => { const map = new Map(); return { map, addEventListener: (name, callback) => map.set(name, callback) }; };
  const messages = [], saved = [], nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, Object.assign(listen(), { hidden: true, isConnected: true, setAttribute() {}, focus() { doc.activeElement = this; }, querySelector: node, querySelectorAll: () => [node('[data-update]'), node('[data-later]')] })); return nodes.get(id); };
  const worker = { postMessage: message => messages.push(message.type) };
  const registration = Object.assign(listen(), { waiting: waiting ? worker : null, active: worker, update: async () => { updates++; } });
  const sw = Object.assign(listen(), { controller: worker, register: async () => registration });
  let updates = 0, reloads = 0, now = 1000000000, poll, timeout;
  const win = listen(), doc = Object.assign(listen(), { visibilityState: 'visible', body: { append() {} }, querySelector: () => null, createElement: () => node('panel') });
  win.MagicShowUI = { save: () => { saved.push('save'); }, isRestScreen: () => safe };
  const location = { reload: () => { reloads++; } };
  vm.runInNewContext(source, { navigator: { serviceWorker: sw }, window: win, document: doc, location, Date: { now: () => now }, console, setTimeout: (fn, ms) => { assert.equal(ms, 5000); timeout = fn; }, setInterval: fn => { poll = fn; }, MutationObserver: class { observe() {} } });
  win.map.get('load')(); await Promise.resolve();
  return { sw, doc, win, registration, messages, saved, node, poll: () => poll(), safe: value => { safe = value; poll(); }, click: id => node(id).map.get('click')(), tick: ms => { now += ms; }, timeout: () => timeout(), count: () => ({ updates, reloads }) };
}

test('Magicshow popup waits for rest, hides when play resumes, and accepts save then reload exactly once', async () => {
  const page = await runRegistration();
  assert.equal(page.node('panel').hidden, true);
  page.safe(true); assert.equal(page.node('panel').hidden, false);
  page.safe(false); assert.equal(page.node('panel').hidden, true);
  page.sw.map.get('controllerchange')(); assert.equal(page.count().reloads, 0);
  page.safe(true); page.click('[data-update]');
  assert.deepEqual(page.saved, ['save']); assert.equal(page.messages.at(-1), 'SKIP_WAITING');
  page.sw.map.get('controllerchange')(); page.sw.map.get('controllerchange')();
  page.timeout(); assert.equal(page.count().reloads, 1);
});

test('Magicshow save conflict stays visible and missing controllerchange reloads only once', async () => {
  const page = await runRegistration({ safe: true });
  page.win.MagicShowUI.save = () => false;
  page.click('[data-update]');
  assert.equal(page.node('panel').hidden, false);
  assert.equal(page.node('[data-save-error]').hidden, false);
  assert.ok(!page.messages.includes('SKIP_WAITING'));
  page.win.MagicShowUI.save = () => true;
  page.click('[data-update]');
  assert.equal(page.node('[data-save-error]').hidden, true);
  page.timeout(); page.timeout(); page.sw.map.get('controllerchange')();
  assert.equal(page.count().reloads, 1);
});

test('Magicshow later suppresses prompts for this launch, reappears next launch, and detects late waiting workers', async () => {
  const page = await runRegistration({ safe: true });
  page.click('[data-later]'); page.poll(); assert.equal(page.node('panel').hidden, true);
  assert.ok(!page.messages.includes('SKIP_WAITING'));
  const next = await runRegistration({ safe: true }); assert.equal(next.node('panel').hidden, false);
  const late = await runRegistration({ safe: true, waiting: false }); assert.equal(late.node('panel').hidden, true);
  late.registration.waiting = { postMessage() {} }; late.poll(); assert.equal(late.node('panel').hidden, false);
  const css = (await read('scripts/magicshow-dist/update-prompt.css')).toString(); assert.match(css, /min-height: 44px/);
});

test('Magicshow page checks for updates when visible again at most once per ten minutes', async () => {
  const page = await runRegistration();
  const visible = page.doc.map.get('visibilitychange');
  visible(); assert.equal(page.count().updates, 0);
  page.tick(600000); page.doc.visibilityState = 'hidden'; visible(); assert.equal(page.count().updates, 0);
  page.doc.visibilityState = 'visible'; visible(); assert.equal(page.count().updates, 1);
  page.tick(540000); visible(); assert.equal(page.count().updates, 1);
  page.tick(60000); visible(); assert.equal(page.count().updates, 2);
});

test('Magicshow update.html escape page is public, never precached, and only clears the app shell caches', async () => {
  const html = (await read(`${shared}/update.html`)).toString();
  const sw = (await read(`${shared}/sw.js`)).toString();
  assert.ok((await filesUnder(shared)).includes('update.html'));
  assert.equal(shouldCopyMagicshow('update.html'), true);
  assert.deepEqual(classifyPath('/tools/magicshow/update.html'), { mode: 'public' });
  assert.ok(!sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].includes('update.html'));
  assert.ok(!(await read('scripts/magicshow-dist/sw-template.js')).toString().includes('update.html'));
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /getRegistrations\(\)/);
  assert.match(html, /\.unregister\(\)/);
  assert.match(html, /PREFIX = 'magicshow-dist-'/);
  assert.match(html, /k\.indexOf\(PREFIX\) === 0/);
  assert.match(html, /location\.replace\('\/tools\/magicshow\/\?fresh=' \+ Date\.now\(\)\)/);
  assert.match(html, /다시 시도/);
});

test('Magicshow runtime extraction follows document order and rejects unsafe or duplicate paths', () => {
  const html = '<link href="style-new.css" rel="stylesheet"><script src="data-new.js"></script><script src="modules/future.js"></script>';
  assert.deepEqual(magicshowRuntimeFiles(html), ['style-new.css', 'data-new.js', 'modules/future.js']);
  assert.ok(shouldCopyMagicshow('modules/future.js', magicshowRuntimeFiles(html)));
  assert.ok(shouldCopyMagicshow('modules', magicshowRuntimeFiles(html)));
  assert.equal(shouldCopyMagicshow('test-new.js', magicshowRuntimeFiles(html)), false);
  for (const value of ['../escape.js', '/absolute.js', 'https://example.test/a.js']) assert.throws(() => magicshowRuntimeFiles(`<script src="${value}"></script>`));
  assert.throws(() => magicshowRuntimeFiles('<script src="same.js"></script><script src="same.js"></script>'));
});

test('Magicshow rest hook is read-only and excludes fights, story, minigames, cutscenes and coaching', async () => {
  const source = (await read(`${shared}/ui-boot.js`)).toString();
  const body = source.match(/isRestScreen: \(\) => \{([\s\S]*?)\n    \},/)[1];
  const state = { mode: 'fight', u15: { scene: null, queue: [], tutorial: { active: false } }, batchD: { twist: { scene: null } }, features: { climax: { left: 0 } } };
  const visible = new Set(); let sheet = false;
  const context = { state, titleLaunchPending: false, document: { hidden: false }, $: id => ({ hidden: !visible.has(id) }), blockingSheetOpen: () => sheet, chainFighting: false, dealerBusy: false, menu: '', dealerGameView: null, presentation: { busy: false }, wonMoment: null, stageRewardHost: null, clock: 0, titleLaunchPending: false };
  const rest = vm.runInNewContext(`() => {${body}}`, context);
  const before = JSON.stringify(state);
  context.titleLaunchPending = true; visible.add('titleScreen');
  assert.equal(rest(), true, 'button title waits at rest before a choice, even when the new-game state starts in fight');
  assert.equal(JSON.stringify(state), before, 'waiting on the title does not mutate progress');
  context.titleLaunchPending = false; visible.clear();
  assert.equal(rest(), false, 'active fight');
  sheet = true; assert.equal(rest(), true, 'paused menu/settings');
  for (const id of ['storyDialog', 'introStory', 'sceneCard', 'tutorialCoach', 'routineCutin']) { visible.add(id); assert.equal(rest(), false, id); visible.clear(); }
  for (const key of ['dealerBusy', 'chainFighting', 'wonMoment']) { context[key] = true; assert.equal(rest(), false, key); context[key] = false; }
  context.menu = 'dealer'; context.dealerGameView = 'cups'; assert.equal(rest(), false, 'idle minigame is still a minigame'); context.menu = ''; context.dealerGameView = null;
  state.u15.scene = {}; assert.equal(rest(), false); state.u15.scene = null;
  state.u15.queue.push('next'); assert.equal(rest(), false); state.u15.queue = [];
  state.batchD.twist.scene = {}; assert.equal(rest(), false); state.batchD.twist.scene = null;
  state.u15.tutorial.active = true; assert.equal(rest(), false); state.u15.tutorial.active = false;
  context.presentation.busy = true; assert.equal(rest(), false); context.presentation.busy = false;
  sheet = false; state.mode = 'transition'; assert.equal(rest(), true, 'venue end');
  state.mode = 'ending'; assert.equal(rest(), true, 'result');
  state.mode = 'fight'; visible.add('titleScreen'); assert.equal(rest(), false, 'title cannot override a running fight');
  state.mode = 'transition'; assert.equal(rest(), true, 'quiet title'); visible.clear(); state.mode = 'fight';
  context.titleLaunchPending = true; assert.equal(rest(), true, 'game waits behind the title screen'); context.titleLaunchPending = false;
  assert.equal(JSON.stringify(state), before, 'hook does not mutate state');
});


test('Magicshow version fingerprint covers every art/font and runtime byte', async () => {
  const worker = (await read(`${shared}/sw.js`)).toString();
  const version = worker.match(/CACHE_NAME = CACHE_PREFIX \+ '([a-f0-9]{16})/)[1];
  const hash = createHash('sha256').update(worker.replace(version, '__VERSION__'));
  const files = (await filesUnder(shared)).filter(name => !['sw.js', 'update.html'].includes(name)).sort((a, b) => a.localeCompare(b, 'en'));
  for (const name of files) hash.update(name).update('\0').update(await read(`${shared}/${name}`));
  assert.equal(hash.digest('hex').slice(0, 16), version);
});
