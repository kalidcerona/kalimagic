import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { signGateCookie, gateCookieName } from '../../netlify/functions/_lib/tool-gate.mjs';
import { readFileSync } from 'node:fs';
import gate, { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { legacyBridgeSource } from '../../scripts/legacy-sw-bridge.mjs';
import { LEGACY_SHARED_WORKERS } from '../../scripts/legacy-shared-contract.mjs';

globalThis.Netlify = { env: { get: () => 'synthetic-fixture-placeholder' } };
const signedCookie = async (tool, expired = false) => `${gateCookieName(tool)}=${await signGateCookie('fixture@example.test', tool, 'synthetic-fixture-placeholder', Date.now() - (expired ? 91 * 86400000 : 0))}`;
const next = async () => new Response('synthetic-app', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

function mediaType(response) {
  return (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
}

async function request(pathname, cookie = '') {
  return gate(new Request(`https://fixture.invalid${pathname}`, {
    headers: cookie ? { cookie } : {},
  }), { next });
}

test('exact legacy worker paths are direct javascript with no-store', async () => {
  for (const spec of LEGACY_SHARED_WORKERS) {
    for (const cookie of ['', await signedCookie(spec.tool, true), await signedCookie(spec.tool)]) {
      const response = await request(spec.legacyWorkerPath, cookie);
      assert.equal(response.status, 200, spec.legacyWorkerPath);
      assert.equal(mediaType(response), 'application/javascript');
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.match(response.headers.get('cache-control'), /no-cache/);
      assert.equal(response.headers.get('location'), null);
      assert.equal(response.headers.get('service-worker-allowed'), null);
      const body = await response.text();
      assert.equal(body, legacyBridgeSource(spec));
      assert.equal(body.includes('synthetic-app'), false);
      assert.equal(body.includes('friend-apps-check'), false);
      assert.equal(body.includes('magic-calc-'), false);
      assert.equal(body.includes('clients.navigate'), false);
      assert.equal(body.includes('.navigate('), false);
      assert.equal(body.includes('reload'), false);
      assert.equal(body.includes('caches.delete'), false);
      assert.equal(body.includes('unregister'), false);
      assert.equal(body.includes('localStorage'), false);
      assert.equal(body.includes('.clear('), false);
    }
  }
});

test('normalized legacy worker paths match and malicious paths do not', async () => {
  const allowed = await request('/TOOLS/Stopwatch/SW.JS');
  assert.equal(allowed.status, 200);
  assert.equal(mediaType(allowed), 'application/javascript');
  const encoded = await request('/tools/%73topwatch-uni/%73w.js');
  assert.equal(encoded.status, 200);
  assert.equal(mediaType(encoded), 'application/javascript');
  const collapsed = await request('/tools//calc//sw.js?update=1');
  assert.equal(collapsed.status, 200);
  assert.equal(mediaType(collapsed), 'application/javascript');

  const rejected = [
    '/tools/stopwatch/sw.js/',
    '/tools/stopwatch/sw.js.bak',
    '/tools/stopwatch/other/sw.js',
    '/tools/stopwatch2/sw.js',
    '/tools/stopwatch/%2e%2e/hitsuzen/index.html',
    '/tools/stopwatch/sw.js/%2e%2e/index.html',
    '/tools/kairos/sw.js',
    '/tools/kairos-classic/index.html',
    '/tools/hitsuzen/',
    '/tools/hitsuzen/index.html',
  ];
  for (const pathname of rejected) {
    const response = await request(pathname);
    const body = await response.text();
    assert.notEqual(mediaType(response), 'application/javascript', pathname);
    assert.equal(body.includes('LEGACY_SCOPE_PATH'), false, pathname);
    assert.equal(body.includes('synthetic-app'), false, pathname);
  }
});

test('legacy worker responses do not bypass app or API gates', async () => {
  const guest = await request('/tools/hitsuzen/');
  assert.equal(guest.status, 302);
  assert.match(guest.headers.get('location'), /\/tools\/login\//);
  const expired = await request('/tools/hitsuzen/', await signedCookie('calc', true));
  assert.equal(expired.status, 302);
  const authorized = await request('/tools/hitsuzen/', await signedCookie('calc'));
  assert.equal(authorized.status, 200);
  assert.equal(await authorized.text(), 'synthetic-app');
  const canonicalWorker = await request('/tools/hitsuzen/sw.js', await signedCookie('calc'));
  assert.equal(await canonicalWorker.text(), 'synthetic-app');
  const check = await request('/tools/_check');
  assert.equal(check.status, 200);
  assert.equal(await check.text(), 'synthetic-app');
  const invented = await request('/tools/kairos/', 'fixture_gate_stopwatch-uni=fixture-authorized');
  assert.equal(invented.status, 302);
  assert.match(invented.headers.get('location'), /\/tools\/login\//);
});

test('existing alias navigation and return-path login stay in place', async () => {
  const classic = await request('/tools/stopwatch/index.html');
  assert.equal(classic.status, 301);
  assert.equal(new URL(classic.headers.get('location')).pathname, '/tools/kairos-classic/index.html');
  const uni = await request('/tools/stopwatch-uni/');
  assert.equal(uni.status, 301);
  assert.equal(new URL(uni.headers.get('location')).pathname, '/tools/kairos/');
  const calc = await request('/tools/calc/');
  assert.equal(calc.status, 301);
  assert.equal(new URL(calc.headers.get('location')).pathname, '/tools/hitsuzen/');
  const login = await request('/tools/kairos-classic/?kept=1');
  assert.equal(login.status, 302);
  const location = new URL(login.headers.get('location'));
  assert.equal(location.pathname, '/tools/login/');
  assert.equal(location.searchParams.get('to'), '/tools/kairos-classic/?kept=1');
  const unknown = await request('/tools/stopwatch2/');
  assert.equal(unknown.status, 302);
  assert.match(unknown.headers.get('location'), /\/tools\/login\//);
  assert.equal(new URL(unknown.headers.get('location')).pathname.includes('kairos'), false);
  assert.deepEqual(classifyPath('/zz3/'), { mode: 'public' });
  assert.deepEqual(classifyPath('/zz4/'), { mode: 'public' });
  assert.deepEqual(classifyPath('/zz6/'), { mode: 'public' });
  assert.deepEqual(classifyPath('/tools/stopwatch/sw.js'), { mode: 'legacy-worker', tool: 'stopwatch' });
  assert.deepEqual(classifyPath('/tools/./stopwatch/sw.js'), { mode: 'block' });
  assert.deepEqual(classifyPath('/tools/stopwatch/%2e%2e/sw.js'), { mode: 'block' });
  assert.notEqual(classifyPath('/tools/stopwatch2/sw.js').mode, 'legacy-worker');
});

test('redirect rules serve only the three legacy workers before splat redirects', () => {
  const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
  const rules = [
    ['/tools/stopwatch/sw.js', '/tools/stopwatch/*', '/legacy-bridges/stopwatch/sw.js'],
    ['/tools/stopwatch-uni/sw.js', '/tools/stopwatch-uni/*', '/legacy-bridges/stopwatch-uni/sw.js'],
    ['/tools/calc/sw.js', '/tools/calc/*', '/legacy-bridges/calc/sw.js'],
  ];
  for (const [exact, splat, file] of rules) {
    const exactAt = toml.indexOf(`from = "${exact}"`);
    const splatAt = toml.indexOf(`from = "${splat}"`);
    assert.ok(exactAt !== -1 && splatAt !== -1 && exactAt < splatAt, exact);
    assert.match(toml.slice(exactAt, splatAt), /status = 200/);
    assert.match(toml.slice(exactAt, splatAt), new RegExp(file.replaceAll('/', '\\/')));
    assert.match(toml, new RegExp(`for = "${exact}"[\\s\\S]*Cache-Control = "no-store, no-cache"`));
  }
  assert.equal(toml.includes('from = "/tools/stopwatch2/sw.js"'), false);
});

function installBridge(source, scope) {
  const events = { skipWaiting: 0, claim: 0, navigate: 0, deleted: [], respond: [] };
  const listeners = {};
  vm.runInNewContext(source, {
    URL,
    Response,
    Promise,
    self: {
      registration: { scope },
      skipWaiting() { events.skipWaiting += 1; },
      clients: {
        claim() { events.claim += 1; },
        navigate() { events.navigate += 1; },
      },
      addEventListener(name, callback) { listeners[name] = callback; },
    },
    caches: { delete(name) { events.deleted.push(name); } },
  });
  return { events, listeners };
}

test('bridge claims only its old scope and does not move an active client', async () => {
  const spec = LEGACY_SHARED_WORKERS[0];
  const legacy = installBridge(legacyBridgeSource(spec), `https://fixture.invalid${spec.legacyScopePath}`);
  let installed;
  legacy.listeners.install({ waitUntil(promise) { installed = promise; } });
  await installed;
  let activated;
  legacy.listeners.activate({ waitUntil(promise) { activated = promise; } });
  await activated;
  assert.equal(legacy.events.skipWaiting, 1);
  assert.equal(legacy.events.claim, 1);
  legacy.listeners.fetch({
    request: { method: 'GET', mode: 'cors', url: `https://fixture.invalid${spec.legacyScopePath}icon.svg` },
    respondWith() { legacy.events.respond.push('asset'); },
  });
  assert.deepEqual(legacy.events.respond, []);
  legacy.listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: `https://fixture.invalid${spec.legacyScopePath}` },
    respondWith(response) { legacy.events.respond.push(response); },
  });
  const document = await legacy.events.respond[0];
  const html = await document.text();
  assert.match(html, /sessionStorage\.setItem/);
  assert.match(html, /location\.replace/);
  assert.match(html, new RegExp(spec.canonicalPath));
  assert.equal(html.includes(spec.legacyScopePath), false);
  assert.equal(legacy.events.navigate, 0);
  assert.deepEqual(legacy.events.deleted, []);

  const canonical = installBridge(legacyBridgeSource(spec), `https://fixture.invalid${spec.canonicalPath}`);
  canonical.listeners.install({ waitUntil() { throw new Error('canonical scope must not install the bridge'); } });
  canonical.listeners.activate({ waitUntil() { throw new Error('canonical scope must not activate the bridge'); } });
  canonical.listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: `https://fixture.invalid${spec.canonicalPath}` },
    respondWith() { canonical.events.respond.push('canonical'); },
  });
  assert.equal(canonical.events.skipWaiting, 0);
  assert.equal(canonical.events.claim, 0);
  assert.deepEqual(canonical.events.respond, []);
});
