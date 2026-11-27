import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Personal workers plus friend scopes. Kairos and Kairos Classic share one snapshot.
const WORKERS = [
  ...['asrai', 'alter', 'uramichi'].map(name => [`distribution-snapshots/${name}/sw.js`, `https://example.test/tools/${name}/`]),
  ['distribution-snapshots/memdeck/sw.js', 'https://example.test/tools/memdeck/'],
  ['distribution-snapshots/aletheia/sw.js', 'https://example.test/tools/aletheia/'],
  ['distribution-snapshots/calculator/sw.js', 'https://example.test/tools/hitsuzen/'],
  ['distribution-snapshots/kairos/sw.js', 'https://example.test/tools/kairos/'],
  ['distribution-snapshots/kairos/sw.js', 'https://example.test/tools/kairos-classic/'],
  ['distribution-snapshots/choice/sw.js', 'https://example.test/tools/choice/'],
  ['distribution-snapshots/gwayubulgeup/sw.js', 'https://example.test/tools/gwayubulgeup/'],
  ['distribution-snapshots/magicshow/sw.js', 'https://example.test/tools/magicshow/'],
  ['distribution-snapshots/pimax/sw.js', 'https://example.test/tools/pimax/'],
  ['distribution-snapshots/qr/sw.js', 'https://example.test/tools/arosaegida/'],
  ['distribution-snapshots/spinner/sw.js', 'https://example.test/tools/tyche/'],
  ['distribution-snapshots/tobira/sw.js', 'https://example.test/tools/tobira/'],
  ['distribution-snapshots/unlock/sw.js', 'https://example.test/tools/release/'],
  ['distribution-snapshots/usotsuki/sw.js', 'https://example.test/tools/usotsuki/'],
];

function versioned(source, tag) {
  const declaration = /^(?:const CACHE_NAME = CACHE_PREFIX \+ '|.*?CACHE=PREFIX\+')(.*?)';/m;
  const match = source.match(declaration);
  if (!match) throw new Error('cache name declaration');
  // Match executable declarations, not the quoted identity probe in verifyDeployment.
  const value = match[1];
  const next = value.endsWith('-distribution')
    ? value.slice(0, -'-distribution'.length) + '--' + tag + '-distribution'
    : value + '--' + tag;
  return source.slice(0, match.index) + match[0].replace(value, next) + source.slice(match.index + match[0].length);
}

function cachePrefix(source, scope) {
  const scoped = source.match(/const CACHE_PREFIX = '([^']*)' \+ encodeURIComponent\(self\.registration\.scope\) \+ '-';/);
  if (scoped) return scoped[1] + encodeURIComponent(scope) + '-';
  const raw = source.match(/const CACHE_PREFIX = '([^']*)' \+ self\.registration\.scope \+ '-';/);
  if (raw) return raw[1] + scope + '-';
  const literal = source.match(/const CACHE_PREFIX = '([^']*)';/);
  if (literal) return literal[1];
  const compact = source.match(/PREFIX='([^']*)'\+encodeURIComponent\(scope\.href\)\+'-'/);
  if (compact) return compact[1] + encodeURIComponent(new URL(scope).href) + '-';
  throw new Error('cache prefix');
}

function boot(source, scope, state, stores) {
  const listeners = {};
  const deleted = [];
  let skips = 0;
  let claims = 0;
  let cacheName = '';
  let jsUrl = '';
  const network = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    // Both addAll and explicit install fetches identify the executable probe.
    if (!jsUrl && /\.(?:mjs|js)$/.test(url.pathname)) jsUrl = url.href;
    const base = new URL(scope).pathname;
    let name = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
    if (name === '') name = 'index.html';
    state.fetches.push(name);
    if (state.offline) throw new TypeError('offline');
    // Identity checks must receive the installed worker source, not a manifest/body stub.
    if (name === 'sw.js' && input.cache === 'no-store') return new Response(source);
    return new Response(`${state.generation}:${name}`, { status: 200 });
  };
  const caches = {
    async open(name) {
      cacheName = name;
      if (!stores.has(name)) stores.set(name, { entries: new Map(), puts: 0 });
      const bucket = stores.get(name);
      return {
        async addAll(requests) {
          for (const request of requests) {
            assert.equal(request.cache, 'reload', scope);
            assert.equal(request.redirect, 'error', scope);
            if (!jsUrl && /\.(?:mjs|js)$/.test(new URL(request.url).pathname)) jsUrl = request.url;
            const response = await network(request);
            if (!response.ok) throw new TypeError('precached response was not ok');
            bucket.entries.set(request.url, await response.text());
          }
        },
        async match(key, options = {}) {
          const wanted = new URL(typeof key === 'string' ? key : key.url);
          for (const [stored, body] of bucket.entries) {
            const have = new URL(stored);
            const same = options.ignoreSearch
              ? have.origin === wanted.origin && have.pathname === wanted.pathname
              : have.href === wanted.href;
            if (same) return new Response(body, { status: 200 });
          }
          return undefined;
        },
        async put(key, response) {
          bucket.puts += 1;
          const href = new URL(typeof key === 'string' ? key : key.url).href;
          bucket.entries.set(href, await response.text());
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  vm.runInNewContext(source, {
    URL, Response, Request, AbortController, setTimeout, clearTimeout,
    self: {
      registration: { scope, active: state.active },
      addEventListener(name, fn) { listeners[name] = fn; },
      skipWaiting() { skips += 1; return Promise.resolve(); },
      clients: { claim() { claims += 1; return Promise.resolve(); } },
    },
    fetch: network,
    caches,
  }, { filename: scope + 'sw.js' });
  return {
    listeners,
    deleted,
    get skips() { return skips; },
    get claims() { return claims; },
    get cacheName() { return cacheName; },
    get jsUrl() { return jsUrl; },
    bucket() { return stores.get(cacheName); },
  };
}

async function lifecycle(worker, name) {
  let pending;
  worker.listeners[name]({ waitUntil(value) { pending = value; } });
  await pending;
}

async function dispatch(worker, url) {
  let result;
  const background = [];
  worker.listeners.fetch({
    request: { method: 'GET', url, mode: 'navigate' },
    respondWith(value) { result = Promise.resolve(value); },
    waitUntil(value) { background.push(value); },
  });
  if (!result) throw new Error(`not intercepted: ${url}`);
  return { response: await result, background };
}

test('coherent release covers the 17 deployed worker scopes', () => {
  assert.equal(WORKERS.length, 17);
  assert.equal(new Set(WORKERS.map(([file, scope]) => `${file}@${scope}`)).size, 17);
});

for (const [file, scope] of WORKERS) {
  test(`${file} @ ${new URL(scope).pathname} serves one release until the next launch`, async () => {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.match(source, /-coherent-1/);
    if (file.endsWith('usotsuki/sw.js') && file.includes('distribution-snapshots')) {
      assert.match(source, /-coherent-1-compat-1-gesture-1-wake-1-modules-1-split-1-trim-1-css-1-clean-1-lieflash-2-update-prompt-3-hold-range-76-1-persist-1-distribution'/);
      assert.doesNotMatch(source, /-distribution-coherent-1/);
    }
    const prefix = cachePrefix(source, scope);
    // Pi Max splits one prefix into personal and distribution families. The stale cache must belong to that family.
    const distributionFamily = source.includes("endsWith('-distribution')") && /CACHE_NAME = CACHE_PREFIX \+ '[^']*-distribution';/.test(source);
    const scopedMagicshow = source.includes('const SCOPED_CACHE =');
    const stale = prefix + 'stale-release' + (scopedMagicshow ? '-' + encodeURIComponent(new URL(scope).pathname) : distributionFamily ? '-distribution' : '');
    const stores = new Map([
      ['foreign-app-cache', { entries: new Map([[scope + 'index.html', 'foreign']]), puts: 0 }],
      [stale, { entries: new Map([[scope + 'index.html', 'stale']]), puts: 0 }],
    ]);
    const state = { generation: 'v1', offline: false, fetches: [], active: null };
    const v1 = boot(versioned(source, 'v1'), scope, state, stores);
    await lifecycle(v1, 'install');
    assert.equal(v1.skips, file === 'distribution-snapshots/magicshow/sw.js' ? 0 : 1, 'first magicshow install activates naturally without skipWaiting');
    const htmlUrl = new URL('index.html', scope).href;
    const jsUrl = v1.jsUrl;
    assert.equal(v1.bucket().entries.get(htmlUrl), 'v1:index.html');
    assert.equal(v1.bucket().entries.get(jsUrl), `v1:${new URL(jsUrl).pathname.slice(new URL(scope).pathname.length)}`);

    state.generation = 'v2';
    state.fetches = [];
    const liveHtml = await dispatch(v1, scope);
    const liveJs = await dispatch(v1, jsUrl);
    assert.equal(await liveHtml.response.text(), 'v1:index.html');
    assert.equal(await liveJs.response.text(), v1.bucket().entries.get(jsUrl));
    assert.deepEqual(liveHtml.background, []);
    assert.deepEqual(liveJs.background, []);
    assert.deepEqual(state.fetches, [], 'a cached release must not refresh from the network');
    assert.equal(v1.bucket().entries.get(htmlUrl), 'v1:index.html');
    const queried = await dispatch(v1, htmlUrl + '?install=current');
    assert.equal(await queried.response.text(), 'v1:index.html');
    assert.deepEqual(queried.background, []);
    assert.deepEqual(state.fetches, [], 'a query string still matches the cached shell');

    state.active = { scriptURL: new URL('sw.js', scope).href };
    state.fetches = [];
    const v2 = boot(versioned(source, 'v2'), scope, state, stores);
    await lifecycle(v2, 'install');
    // Magicshow now waits for the player to accept the update prompt (SKIP_WAITING), like the other apps.
    assert.equal(v2.skips, 0, 'an update must stay waiting while a client is open');
    assert.notEqual(v1.cacheName, v2.cacheName);
    assert.equal(v2.bucket().entries.get(htmlUrl), 'v2:index.html');
    assert.equal(v2.bucket().entries.get(jsUrl).startsWith('v2:'), true);
    assert.equal(v1.bucket().entries.get(htmlUrl), 'v1:index.html', 'install must not write the new page into the active cache');
    assert.equal(v1.bucket().entries.get(jsUrl).startsWith('v1:'), true);

    const stillHtml = await dispatch(v1, scope);
    const stillJs = await dispatch(v1, jsUrl);
    assert.equal(await stillHtml.response.text(), 'v1:index.html');
    assert.equal((await stillJs.response.text()).startsWith('v1:'), true);
    assert.deepEqual(stillHtml.background, []);

    if (source.includes('"./home-icons/a1.svg"')) {
      const iconUrl = new URL('home-icons/a1.svg', scope).href;
      if (source.includes('const PRECACHE = SHELL;')) {
        // Choice stores its artwork during install, so each release already holds its own copy.
        assert.equal(v1.bucket().entries.get(iconUrl), 'v1:home-icons/a1.svg');
        assert.equal(v2.bucket().entries.get(iconUrl), 'v2:home-icons/a1.svg');
        const icon = await dispatch(v1, iconUrl);
        assert.equal(await icon.response.text(), 'v1:home-icons/a1.svg');
      } else {
      assert.equal(v1.bucket().entries.has(iconUrl), false);
      const puts = v1.bucket().puts;
      const icon = await dispatch(v1, iconUrl);
      assert.equal(await icon.response.text(), 'v2:home-icons/a1.svg');
      assert.equal(v1.bucket().entries.get(iconUrl), 'v2:home-icons/a1.svg');
      assert.equal(v1.bucket().puts, puts + 1);
      }
      for (const [name, bucket] of stores) {
        if (name !== v1.cacheName && name !== v2.cacheName) assert.equal(bucket.entries.has(iconUrl), false, name);
        if (name === v2.cacheName && !source.includes('const PRECACHE = SHELL;')) assert.equal(bucket.entries.has(iconUrl), false, name);
      }
    }

    const putsBeforeMiss = v1.bucket().puts;
    v1.bucket().entries.delete(jsUrl);
    state.fetches = [];
    const missedJs = await dispatch(v1, jsUrl);
    if (scopedMagicshow) {
      assert.equal(missedJs.response.type, 'error', 'missing executable must not mix a later deployment');
      assert.equal(state.fetches.length, 0);
      assert.equal(v1.bucket().entries.has(jsUrl), false);
      assert.equal(v1.bucket().puts, putsBeforeMiss);
      await Promise.all(missedJs.background);
      v1.bucket().entries.delete(htmlUrl);
      const missedPage = await dispatch(v1, htmlUrl);
      assert.equal(missedPage.response.status, 503, 'missing page asks for a complete replacement');
      assert.equal(state.fetches.length, 0);
      assert.equal(v1.bucket().entries.has(htmlUrl), false);
      assert.equal(v1.bucket().puts, putsBeforeMiss);
      await Promise.all(missedPage.background);
    } else {
    assert.equal((await missedJs.response.text()).startsWith('v2:'), true);
    assert.equal(v1.bucket().entries.has(jsUrl), false, 'an evicted script is returned without being stored');
    assert.equal(state.fetches.length, 1);
    assert.equal(v1.bucket().puts, putsBeforeMiss);

    v1.bucket().entries.delete(htmlUrl);
    const missedPage = await dispatch(v1, htmlUrl);
    assert.equal(await missedPage.response.text(), 'v2:index.html');
    assert.equal(v1.bucket().entries.has(htmlUrl), false, 'an evicted page is returned without being stored');
    assert.equal(v1.bucket().puts, putsBeforeMiss);

    }

    state.offline = true;
    const brokenJs = await dispatch(v1, jsUrl);
    assert.equal(brokenJs.response.type, 'error');
    const brokenPage = await dispatch(v1, scope);
    assert.equal(brokenPage.response.status, 503);
    assert.match(await brokenPage.response.text(), /오프라인/);
    assert.equal(v1.bucket().entries.has(jsUrl), false);
    assert.equal(v1.bucket().entries.has(htmlUrl), false);

    state.offline = false;
    await lifecycle(v2, 'activate');
    assert.equal(v2.claims, 1);
    assert.deepEqual(v2.deleted.slice().sort(), [v1.cacheName, stale].sort());
    assert.equal(stores.has('foreign-app-cache'), true);
    assert.equal(stores.has(v2.cacheName), true);
    assert.equal(stores.has(v1.cacheName), false);
    const nextHtml = await dispatch(v2, scope);
    const nextJs = await dispatch(v2, jsUrl);
    assert.equal(await nextHtml.response.text(), 'v2:index.html');
    assert.equal((await nextJs.response.text()).startsWith('v2:'), true);

    const probeScope = `https://example.test/tools/probe-${file.replace(/[^\w]+/g, '-')}-${new URL(scope).pathname.replace(/[^\w]+/g, '-')}/`;
    const probeStores = new Map();
    const probeState = { generation: 'cached', offline: false, fetches: [], active: null };
    const probe = boot(source, probeScope, probeState, probeStores);
    await lifecycle(probe, 'install');
    probeState.generation = 'network';
    probeState.fetches = [];
    const guarded = await dispatch(probe, probeScope);
    assert.equal(await guarded.response.text(), 'cached:index.html');
    assert.deepEqual(probeState.fetches, [], 'a guarded page is served from the cached release');
    assert.deepEqual(guarded.background, []);
  });
}
