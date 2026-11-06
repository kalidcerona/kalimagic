import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import gate, { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { gateCookieName, signGateCookie } from '../../netlify/functions/_lib/tool-gate.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';
import { allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { DISTRIBUTION_APPS, MEMDECK_FILES, transformDistributionDocument } from '../../scripts/build-public.mjs';
import { stripLocalPreview } from '../../scripts/friend-builds.mjs';
import { freshState, loadState } from '../../distribution-snapshots/memdeck/core.mjs';

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const snapshot = 'distribution-snapshots/memdeck';

test('Memdeck snapshot isolates all storage families and preserves the complete practice runtime', () => {
  assert.deepEqual(readdirSync(new URL(`../../${snapshot}/`, import.meta.url)).sort(), [...MEMDECK_FILES].sort());
  for (const file of MEMDECK_FILES.filter(file => /\.(?:m?js|html)$/.test(file))) {
    const friend = read(`${snapshot}/${file}`);
    assert.doesNotMatch(friend, /magic-memdeck-|local-preview|magic-local-settings|localSettingsReady|['"`]first-settings-guide:/, file);
    let expected = stripLocalPreview(read(`zz12/${file}`)).text
      .replaceAll("'magic-memdeck-v1'", "'friend-memdeck-v1'")
      .replaceAll("'first-settings-guide:v1:'", "'friend-memdeck-first-settings-guide:v1:'")
      .replaceAll("'magic-memdeck-'", "'friend-memdeck-shell-'");
    if (file === 'sw.js') expected = expected.replace('-local-preview-module-1', '').replace("-update-prompt-3-persist-1'", "-update-prompt-3-persist-1-distribution'");
    assert.equal(friend, expected, file);
  }
  assert.match(read(`${snapshot}/app.mjs`), /KEY='friend-memdeck-v1',PRESERVED_KEY=KEY\+'-preserved-raw'/);
  const state = freshState();
  state.progress.redford.notes['7'] = '별자리';
  state.progress.redford.review['7'] = { step: 2, due: 1800000000000 };
  state.progress.mnemonica.history.push({ at: 1710000001000, mode: 'card', total: 2, correct: 1, ms: 1500 });
  assert.deepEqual(loadState(JSON.stringify(state)), state);
  assert.throws(() => loadState('{not-json'));
});

test('Memdeck has its own install identity, hosting header and live distribution check', () => {
  const manifest = JSON.parse(read(`${snapshot}/manifest.webmanifest`));
  assert.equal(manifest.name, '멤덱 연습실');
  for (const field of ['id', 'start_url', 'scope']) assert.equal(manifest[field], '/tools/memdeck/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(DISTRIBUTION_APPS.find(app => app.tool === 'memdeck'), { source: snapshot, target: 'memdeck', tool: 'memdeck' });
  const html = transformDistributionDocument(read(`${snapshot}/index.html`), { tool: 'memdeck', target: 'memdeck' });
  assert.match(html, /id="friend-apps-check"/);
  assert.match(html, /\/tools\/_check\?tool=memdeck/);
  assert.match(html, /data-magic-customize="off"/);
  assert.match(read('netlify.toml'), /for = "\/tools\/memdeck\/manifest\.webmanifest"\s*\[headers.values\]\s*Content-Type = "application\/manifest\+json"/);
});

test('Memdeck gate rejects traversal, unrelated grants and errors with only exact public metadata exceptions', () => {
  for (const path of ['/tools/memdeck', '/tools/MEMDECK/', '/tools//memdeck//index.html', '/tools/memdeck/app.mjs', '/tools/memdeck/sw.js', '/tools/memdeck/nested/icon-192.png', '/tools/memdeck/nested/manifest.webmanifest']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'memdeck' }, path);
  }
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) assert.deepEqual(classifyPath(`/tools/memdeck/${file}`), { mode: 'public' });
  for (const path of ['/tools/memdeck/../index', '/tools/memdeck/%2e%2e/index']) assert.deepEqual(classifyPath(path), { mode: 'block' });
  assert.ok(FRIEND_APP_TOOLS.has('memdeck'));
  assert.equal(gateCookieName('memdeck'), 'kali_memdeck_gate');
  assert.equal(accessTableForTool('memdeck'), 'friend_app_access');
  assert.equal(isValidTool('memdeck'), true);
  assert.equal(allowOnCheckError('memdeck'), false);
  for (const tool of ['all', 'pimax']) assert.equal(selectGate([{ valid: true, tool }], 'memdeck').valid, false);
  const window = {};
  vm.runInNewContext(read('tools/login/gate-util.js'), { window });
  assert.equal(window.ToolGateUtil.safeTo('/tools/memdeck/'), '/tools/memdeck/');
  assert.equal(window.ToolGateUtil.toolFromPath('/tools/memdeck/'), 'memdeck');
  assert.equal(window.ToolGateUtil.safeTo('/tools/memdeck/%2e%2e/index'), '/tools/hitsuzen/');
});

test('Memdeck edge checks live approval and blocks missing, wrong, revoked or unavailable access', async () => {
  const previousFetch = globalThis.fetch, previousNetlify = globalThis.Netlify;
  const secret = 'memdeck-test-secret';
  globalThis.Netlify = { env: { get: () => secret } };
  let calls = 0;
  const context = { next: async () => { calls++; return new Response('runtime'); } };
  const request = cookie => new Request('https://example.test/tools/memdeck/app.mjs', { headers: { cookie } });
  try {
    assert.equal((await gate(request(''), context)).status, 302);
    const wrong = await signGateCookie('friend@example.com', 'all', secret);
    assert.equal((await gate(request(`kali_memdeck_gate=${wrong}`), context)).status, 302);
    const token = await signGateCookie('friend@example.com', 'memdeck', secret);
    for (const behavior of ['pending', 'revoked', 'error', 'approved']) {
      globalThis.fetch = async (url, options) => {
        assert.equal(new URL(url).searchParams.get('tool'), 'memdeck');
        assert.equal(options.cache, 'no-store');
        if (behavior === 'error') throw new Error('offline');
        return new Response(JSON.stringify({ ok: behavior === 'approved' }));
      };
      assert.equal((await gate(request(`kali_memdeck_gate=${token}`), context)).status, behavior === 'approved' ? 200 : 302);
    }
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  }
});

test('Memdeck worker deletes only its own scoped friend cache and ignores auth and sibling requests', async () => {
  const listeners = {}, deleted = [];
  const scope = 'https://example.test/tools/memdeck/';
  const old = `friend-memdeck-shell-${scope}-old`;
  vm.runInNewContext(read(`${snapshot}/sw.js`), {
    URL, Response,
    self: { location: { origin: 'https://example.test' }, registration: { scope }, clients: { claim() {} }, addEventListener(name, fn) { listeners[name] = fn; } },
    caches: { keys: async () => [old, `magic-memdeck-${scope}-old`, 'other-app'], delete: async key => deleted.push(key) }
  });
  let done;
  listeners.activate({ waitUntil(promise) { done = promise; } });
  await done;
  assert.deepEqual(deleted, [old]);
  for (const path of ['/tools/_check?tool=memdeck', '/zz12/', '/tools/pimax/']) {
    let intercepted = false;
    listeners.fetch({ request: { method: 'GET', url: `https://example.test${path}` }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
});

test('Memdeck retains visibility-controlled screen wake lock', async () => {
  const source = read(`${snapshot}/app.mjs`);
  const start = source.indexOf('function keepVisibleScreenAwake()');
  const end = source.indexOf('\nkeepVisibleScreenAwake();', start) + '\nkeepVisibleScreenAwake();'.length;
  const listeners = {}, document = { visibilityState: 'visible', addEventListener(name, fn) { listeners[name] = fn; } };
  let requests = 0, releases = 0;
  const navigator = { wakeLock: { request: async type => { assert.equal(type, 'screen'); requests++; return { release() { releases++; }, addEventListener() {} }; } } };
  vm.runInNewContext(source.slice(start, end), { document, navigator, Date, Promise, setTimeout });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  document.visibilityState = 'hidden'; listeners.visibilitychange();
  assert.equal(releases, 1);
  document.visibilityState = 'visible'; listeners.visibilitychange();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 2);
});

test('Memdeck migration retains every previously allowed tool without changing RLS', () => {
  const sql = read('supabase/migrations/20261103_friend_apps_memdeck.sql');
  assert.deepEqual([...sql.matchAll(/'([^']+)'/g)].map(match => match[1]), [...FRIEND_APP_TOOLS]);
  assert.match(sql, /begin;[\s\S]*drop constraint if exists friend_app_access_tool_check;[\s\S]*add constraint friend_app_access_tool_check[\s\S]*commit;/);
  assert.doesNotMatch(sql, /row level security|create policy|drop policy/i);
});
