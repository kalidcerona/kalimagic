import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));
const personal = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13]
  .map(number => ({ route: `zz${number}`, source: `zz${number}/sw.js` }));
const shared = [
  ['calculator', 'hitsuzen'], ['unlock', 'release'], ['aletheia', 'aletheia'],
  ['usotsuki', 'usotsuki'], ['tobira', 'tobira'], ['spinner', 'tyche'],
  ['kairos', 'kairos'], ['kairos', 'kairos-classic'], ['qr', 'arosaegida']
].map(([snapshot, slug]) => ({ route: `tools/${slug}`, source: `distribution-snapshots/${snapshot}/sw.js` }));
const routes = [...personal, ...shared];
const manifest = id => ({ name: 'Install metadata', start_url: './', scope: './', display: 'standalone', id });
const jsonResponse = value => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' }
});

function worker(app, network, { emptyCache = false, failCacheWrite = false } = {}) {
  const scope = `https://kalimagic.netlify.app/${app.route}/`;
  const events = {};
  const calls = [];
  const puts = [];
  const deletes = [];
  const opened = [];
  const added = [];
  let claims = 0;
  let skips = 0;
  const cache = {
    match: async () => emptyCache ? undefined : jsonResponse(manifest('/')),
    put: async (key, response) => {
      if (failCacheWrite) throw new Error('Quota');
      puts.push({ key, value: await response.json() });
    },
    addAll: async assets => { added.push(...assets); }
  };
  const context = {
    URL, Request, Response, Set, Promise, encodeURIComponent,
    self: {
      registration: { scope }, location: new URL(`${scope}sw.js`),
      addEventListener: (name, handler) => { events[name] = handler; },
      clients: { claim: async () => { claims++; } },
      skipWaiting: async () => { skips++; }
    },
    caches: {
      open: async name => { opened.push(name); return cache; },
      keys: async () => [opened[0], `${opened[0]}-old-version`, 'foreign-app-cache'],
      delete: async name => { deletes.push(name); return true; }
    },
    fetch: async request => { calls.push(request); return network(request); }
  };
  vm.runInNewContext(readFileSync(`${root}${app.source}`, 'utf8'), context, { filename: app.source });
  async function dispatch(url = `${scope}manifest.webmanifest`, init) {
    let answer;
    const pending = [];
    events.fetch({
      request: new Request(url, init),
      respondWith: value => { answer = Promise.resolve(value); },
      waitUntil: value => { pending.push(value); }
    });
    const response = answer ? await answer : undefined;
    await Promise.all(pending);
    return response;
  }
  async function lifecycle(name) {
    let pending;
    events[name]({ waitUntil: value => { pending = value; } });
    await pending;
  }
  return { scope, dispatch, lifecycle, calls, puts, deletes, opened, added, claims: () => claims, skips: () => skips };
}

test('the freshness matrix covers 20 public source workers and 21 deployed scopes', () => {
  assert.equal(routes.length, 21);
  assert.equal(new Set(routes.map(app => app.source)).size, 20);
  assert.equal(new Set(routes.map(app => app.route)).size, 21);
  assert.ok(routes.every(app => app.route !== 'zz9'));
});

for (const app of routes) {
  test(`${app.route}: current manifest replaces an old root identity, including versioned requests`, async () => {
    for (const suffix of ['', '?install=current']) {
      const fresh = manifest(`/${app.route}/`);
      const instance = worker(app, () => jsonResponse(fresh));
      const response = await instance.dispatch(`${instance.scope}manifest.webmanifest${suffix}`);
      assert.deepEqual(await response.json(), fresh);
      assert.equal(instance.calls.length, 1);
      assert.equal(instance.calls[0].cache, 'no-store');
      assert.equal(instance.calls[0].redirect, 'error');
      assert.deepEqual(instance.puts, [{ key: `${instance.scope}manifest.webmanifest`, value: fresh }]);
    }
    const noCache = worker(app, () => jsonResponse(manifest(`/${app.route}/`)), { emptyCache: true });
    assert.equal((await (await noCache.dispatch()).json()).id, `/${app.route}/`);
    const quota = worker(app, () => jsonResponse(manifest(`/${app.route}/`)), { failCacheWrite: true });
    assert.equal((await (await quota.dispatch()).json()).id, `/${app.route}/`);
  });

  test(`${app.route}: offline and untrusted responses preserve the cached manifest`, async () => {
    const variants = [
      () => { throw new Error('Offline'); },
      () => new Response('<html>Login required</html>', { headers: { 'Content-Type': 'text/html' } }),
      () => new Response('{broken', { headers: { 'Content-Type': 'application/manifest+json' } }),
      () => jsonResponse(null), () => jsonResponse([]), () => jsonResponse({ ok: true }),
      () => jsonResponse({ name: 'Invalid start', start_url: 'https://other.example/' }),
      () => new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }),
      () => new Response(JSON.stringify(manifest('/wrong/')), { headers: { 'Content-Type': 'text/html' } }),
      () => { const response = jsonResponse(manifest('/wrong/')); Object.defineProperty(response, 'redirected', { value: true }); return response; },
      () => { const response = jsonResponse(manifest('/wrong/')); Object.defineProperty(response, 'url', { value: 'https://other.example/manifest.webmanifest' }); return response; },
      () => { const response = jsonResponse(manifest('/wrong/')); Object.defineProperty(response, 'type', { value: 'opaque' }); return response; }
    ];
    for (const network of variants) {
      const instance = worker(app, network);
      assert.equal((await (await instance.dispatch()).json()).id, '/');
      assert.equal(instance.calls.length, 1);
      assert.equal(instance.puts.length, 0);
    }
    const instance = worker(app, () => { throw new Error('Offline'); }, { emptyCache: true });
    assert.equal((await instance.dispatch()).type, 'error');
    assert.equal(instance.puts.length, 0);
  });

  test(`${app.route}: metadata refresh does not intercept authentication, APIs, foreign scopes or POST`, async () => {
    const instance = worker(app, () => { throw new Error('Must stay outside the worker'); });
    for (const url of [
      'https://other.example/manifest.webmanifest',
      'https://kalimagic.netlify.app/other-app/manifest.webmanifest',
      'https://kalimagic.netlify.app/tools/_check?tool=unlock',
      'https://kalimagic.netlify.app/.netlify/functions/tool-access',
      `${instance.scope}api/session`
    ]) assert.equal(await instance.dispatch(url), undefined);
    assert.equal(await instance.dispatch(`${instance.scope}manifest.webmanifest`, { method: 'POST' }), undefined);
    assert.equal(instance.calls.length, 0);
    assert.equal(instance.puts.length, 0);
  });

  test(`${app.route}: activation preserves foreign caches and the prior install/claim policy`, async () => {
    const instance = worker(app, () => jsonResponse(manifest(`/${app.route}/`)));
    await instance.dispatch();
    await instance.lifecycle('install');
    await instance.lifecycle('activate');
    assert.equal(instance.deletes.length, 1);
    assert.ok(instance.deletes[0].endsWith('old-version'));
    assert.ok(!instance.deletes.includes('foreign-app-cache'));
    assert.equal(instance.claims(), 1);
    assert.equal(instance.skips(), app.route === 'zz12' ? 0 : 1);
    assert.ok(instance.added.some(asset => String(asset instanceof Request ? asset.url : asset).includes('manifest.webmanifest')));
    if (app.route === 'tools/arosaegida') {
      assert.ok(!instance.added.includes('./') && !instance.added.includes('./index.html'));
    }
  });
}
