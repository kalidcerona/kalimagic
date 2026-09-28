import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import toolsGate, { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { signGateCookie, gateCookieName } from '../../netlify/functions/_lib/tool-gate.mjs';
import { allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { isValidTool, accessTableForTool } from '../../netlify/functions/admin-tools.mjs';

function worker(source, scope, overrides = {}) {
  const listeners = {};
  const context = { URL, Response, Request,
    self: { registration: { scope }, addEventListener(name, fn) { listeners[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    ...overrides };
  vm.runInNewContext(source, context);
  return listeners;
}
const routes = ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11'];
test('every personal shell precaches existing runtime assets and waits for a complete install', async () => {
  for (const route of routes) {
    const source = await readFile(new URL(`../../${route}/sw.js`, import.meta.url), 'utf8');
    let files, completed = false, release;
    const listeners = worker(source, `https://example.test/${route}/`, {
      caches: { open: async () => ({ addAll: async (urls) => { files = urls.map((request) => { assert.equal(request.redirect, 'error'); assert.equal(request.cache, 'reload'); return './' + new URL(request.url).pathname.slice(('/' + route + '/').length); }); await new Promise((r) => { release = r; }); } }) }
    });
    let installation;
    listeners.install({ waitUntil(p) { installation = p.then(() => { completed = true; }); } });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(completed, false);
    assert.ok(files.includes('./index.html')); assert.ok(files.includes('./settings-ui.js'));
    for (const file of files) await stat(new URL(`../../${route}/${file.slice(2)}`, import.meta.url));
    if (route === 'zz5') assert.equal(files.filter((f) => f.startsWith('./court-cards/')).length, 12);
    release(); await installation;
    assert.equal(completed, true);
    const failing = worker(source, `https://example.test/${route}/`, { caches: { open: async () => ({ addAll: async () => { throw new Error('missing asset'); } }) } });
    failing.install({ waitUntil(p) { installation = p; } });
    await assert.rejects(installation, /missing asset/);
  }
});
test('static launch ignores a stalled network while auth and unknown files are not intercepted', async () => {
  for (const route of routes) {
    const source = await readFile(new URL(`../../${route}/sw.js`, import.meta.url), 'utf8');
    const cached = new Response('cached');
    let networkCalls = 0;
    const listeners = worker(source, `https://example.test/${route}/`, {
      caches: { open: async () => ({ match: async () => cached }) }, fetch: () => { networkCalls++; return new Promise(() => {}); }
    });
    let result;
    listeners.fetch({ request: { method: 'GET', mode: 'cors', url: `https://example.test/${route}/settings-ui.js?v=2` }, respondWith(p) { result = p; } });
    assert.equal(await result, cached); assert.equal(networkCalls, 0);
    for (const url of [`https://example.test/${route}/private.json`, 'https://example.test/tools/_check?tool=tobira', 'https://example.test/.netlify/functions/tool-access']) {
      let intercepted = false;
      listeners.fetch({ request: { method: 'GET', mode: 'cors', url }, respondWith() { intercepted = true; } });
      assert.equal(intercepted, false);
    }
  }
});
test('friend navigation observes server denial instead of a cached app', async () => {
  for (const [app, slug] of [['unlock', 'release'], ['aletheia', 'aletheia'], ['usotsuki', 'usotsuki'], ['tobira', 'tobira'], ['spinner', 'tyche']]) {
    const source = await readFile(new URL(`../../distribution-snapshots/${app}/sw.js`, import.meta.url), 'utf8');
    const denial = new Response('', { status: 302, headers: { Location: '/tools/login/' } });
    const listeners = worker(source, `https://example.test/tools/${slug}/`, {
      caches: { open: async () => ({ match: async () => new Response('cached app') }) }, fetch: async () => denial
    });
    let result;
    listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: `https://example.test/tools/${slug}/` }, respondWith(p) { result = p; } });
    assert.equal(await result, denial);
  }
});
test('product slugs preserve stable entitlement IDs and redirect legacy links with their queries', async () => {
  for (const [tool, slug] of [['calc', 'hitsuzen'], ['unlock', 'release'], ['stopwatch-uni', 'kairos'], ['stopwatch', 'kairos-classic'], ['spinner', 'tyche'], ['tobira', 'tobira']]) {
    assert.deepEqual(classifyPath(`/tools/${slug}/app.js`), { mode: 'gated', tool });
    if (tool !== slug) {
      const result = await toolsGate(new Request(`https://example.test/tools/${tool}/index.html?from=invite`), { next() { throw new Error('must redirect'); } });
      assert.equal(result.status, 301);
      assert.equal(result.headers.get('Location'), `https://example.test/tools/${slug}/index.html?from=invite`);
    }
  }
});
test('new friends require their own approval and cookie; legacy all grants cannot unlock them', async () => {
  for (const tool of ['tobira', 'spinner']) {
    assert.equal(isValidTool(tool), true); assert.equal(accessTableForTool(tool), 'friend_app_access');
    assert.equal(allowOnCheckError(tool), false);
    assert.equal(selectGate([{ valid: true, tool: 'all' }], tool).valid, false);
    const signed = await signGateCookie('friend@example.test', tool, 'test-secret');
    assert.ok(signed); assert.equal(gateCookieName(tool), `kali_${tool}_gate`);
  }
});
test('TOBIRA and TYCHE snapshots isolate local state and install identities', async () => {
  const tobira = await readFile(new URL('../../distribution-snapshots/tobira/app.js', import.meta.url), 'utf8');
  const tobiraLogic = await readFile(new URL('../../distribution-snapshots/tobira/logic.js', import.meta.url), 'utf8');
  assert.match(tobira, /'friend-tobira\.localImages\.v1'/);
  assert.match(tobiraLogic, /STORAGE_KEY = 'friend-tobira\.v1'/);
  const spinner = await readFile(new URL('../../distribution-snapshots/spinner/app.js', import.meta.url), 'utf8');
  assert.match(spinner, /'friend-spinner-state-v2'/);
  assert.doesNotMatch(spinner, /'zz11-spinner-state/);
  for (const app of ['tobira', 'spinner']) {
    const manifest = JSON.parse(await readFile(new URL(`../../distribution-snapshots/${app}/manifest.webmanifest`, import.meta.url), 'utf8'));
    assert.equal(manifest.id, './'); assert.equal(manifest.scope, './'); assert.equal(manifest.start_url, './');
  }
});
test('TOBIRA and TYCHE edge assets fail closed after approval is revoked', async () => {
  const priorFetch = globalThis.fetch, priorNetlify = globalThis.Netlify;
  globalThis.Netlify = { env: { get: () => 'test-secret' } };
  try {
    for (const [tool, slug] of [['tobira', 'tobira'], ['spinner', 'tyche']]) {
      const token = await signGateCookie('friend@example.test', tool, 'test-secret');
      let active = false, nextCalls = 0;
      globalThis.fetch = async (url) => {
        assert.equal(new URL(url).searchParams.get('tool'), tool);
        return new Response(JSON.stringify({ ok: active }));
      };
      const request = new Request(`https://example.test/tools/${slug}/app.js`, { headers: { cookie: `${gateCookieName(tool)}=${token}` } });
      const context = { next: async () => { nextCalls++; return new Response('runtime'); } };
      assert.equal((await toolsGate(request, context)).status, 302); assert.equal(nextCalls, 0);
      active = true;
      assert.equal((await toolsGate(request, context)).status, 200); assert.equal(nextCalls, 1);
    }
  } finally {
    globalThis.fetch = priorFetch;
    if (priorNetlify === undefined) delete globalThis.Netlify; else globalThis.Netlify = priorNetlify;
  }
});
