import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const prompt = readFileSync(new URL('./update-prompt.js', import.meta.url), 'utf8');
const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
class Target {
  handlers = {};
  addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
  emit(name, event = {}) { for (const fn of this.handlers[name] || []) fn(event); }
}
class Node extends Target {
  hidden = false; disabled = false; style = {}; textContent = ''; isConnected = true;
  children = new Map();
  querySelector(key) { if (!this.children.has(key)) this.children.set(key, new Node()); return this.children.get(key); }
  querySelectorAll() { return [...this.children.values()]; }
  setAttribute() {} focus() {} append(node) { node.parentNode = this; this.last = node; }
}
async function page({ marker, storageFails = false, titleHidden = false, installing = false } = {}) {
  const timers = new Map(), store = new Map(marker ? [['magicshow.update.reloaded', marker]] : []);
  let timerId = 0, reloads = 0, saves = 0;
  const sw = new Target(), old = new Target(), worker = new Target();
  old.state = 'activated'; worker.state = installing ? 'installing' : 'installed';
  old.messages = []; worker.messages = [];
  for (const w of [old, worker]) w.postMessage = m => w.messages.push(m);
  sw.controller = old;
  const registration = new Target();
  Object.assign(registration, { waiting: installing ? null : worker, installing: installing ? worker : null, active: old, update: async () => {} });
  sw.register = async (url, options) => { assert.equal(url, './sw.js'); assert.equal(options.updateViaCache, 'none'); return registration; };
  const body = new Node(), title = new Node(); title.hidden = titleHidden;
  const document = new Target();
  Object.assign(document, { body, visibilityState: 'visible', getElementById: () => title, createElement: () => new Node(), querySelector: () => null });
  const window = new Target(); window.MagicShowUI = { isRestScreen: () => true, save: () => { saves++; return true; } };
  vm.runInNewContext(prompt, { navigator: { serviceWorker: sw }, document, window, console, Date,
    location: { reload: () => reloads++ }, MutationObserver: class { observe() {} },
    sessionStorage: { getItem: k => { if (storageFails) throw Error('denied'); return store.get(k); }, setItem: (k, v) => store.set(k, v) },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id), setInterval() {} });
  await flush();
  return { sw, old, worker, registration, store, timers,
    release(w = worker, value = 'release26') { sw.emit('message', { source: w, data: { type: 'MAGICSHOW_RELEASE', release: value } }); },
    get reloads() { return reloads; }, get saves() { return saves; },
    accept() { body.last.querySelector('[data-update]').emit('click'); },
    button(key) { return body.last.querySelector(key); },
    timeout() { const pending = [...timers.values()]; timers.clear(); for (const t of pending) t.fn(); },
    control(w = worker) { sw.controller = w; w.state = 'activated'; registration.active = w; registration.waiting = null; sw.emit('controllerchange'); },
  };
}
test('deadline never reloads; accepted controller and release reload exactly once', async () => {
  const p = await page(); p.release(); p.accept(); p.timeout();
  assert.equal(p.reloads, 0); assert.equal(p.button('[data-retry]').hidden, false);
  p.control(p.old); assert.equal(p.reloads, 0);
  p.control(); p.sw.emit('controllerchange'); assert.equal(p.reloads, 1);
  assert.equal(p.store.get('magicshow.update.reloaded'), 'release26');
});
test('missing release identity cannot start activation', async () => {
  const p = await page(); p.accept(); p.timeout(); assert.equal(p.reloads, 0);
  assert.equal(p.worker.messages.some(m => m.type === 'SKIP_WAITING'), false);
});
test('accepting during installation waits for installed and then for controller ownership', async () => {
  const p = await page({ installing: true }); p.release(); p.accept();
  assert.equal(p.worker.messages.some(m => m.type === 'SKIP_WAITING'), false);
  p.registration.installing = null; p.registration.waiting = p.worker;
  p.worker.state = 'installed'; p.worker.emit('statechange');
  assert.equal(p.worker.messages.some(m => m.type === 'SKIP_WAITING'), true);
  p.timeout(); assert.equal(p.reloads, 0); p.control(); assert.equal(p.reloads, 1);
});
test('later suppresses acceptance; no automatic reload on unrelated claim', async () => {
  const p = await page(); p.button('[data-later]').emit('click'); p.control();
  assert.equal(p.reloads, 0);
});
test('cross-document marker and unavailable session storage provide recovery', async () => {
  for (const options of [{ marker: 'release26' }, { storageFails: true }]) {
    const p = await page(options); p.release(); p.accept(); p.control();
    assert.equal(p.reloads, 0); assert.equal(p.button('[data-continue]').hidden, false);
  }
});
test('retry is safe and continuing after a delay cancels automatic reload', async () => {
  const p = await page(); p.release(); p.accept(); p.timeout();
  p.button('[data-retry]').emit('click'); assert.equal(p.reloads, 0);
  p.timeout(); p.button('[data-continue]').emit('click'); p.control(); assert.equal(p.reloads, 0);
});
test('redundant accepted worker reports failure after activation began', async () => {
  const p = await page(); p.release(); p.accept(); p.worker.state = 'redundant'; p.worker.emit('statechange');
  assert.equal(p.button('[data-install-error]').hidden, false); assert.equal(p.reloads, 0);
});
test('title preserves saves and update never warms the old controller', async () => {
  const p = await page(); p.release(); p.accept(); assert.equal(p.saves, 0);
  assert.equal(p.old.messages.some(m => /PRECACHE_ART|WARM_ART_BATCH/.test(m.type)), false);
  const q = await page({ titleHidden: true }); q.release(); q.accept(); assert.equal(q.saves, 1);
});
function workerEnv({ failCleanup = false, artCount = 8, stalled = false, responseStatus = 200, failPut = false } = {}) {
  const self = new Target(), timers = new Map(); let claims = 0, fetches = 0, aborted = 0;
  self.registration = { scope: 'http://127.0.0.1/tools/magicshow/', active: null };
  self.clients = { claim: async () => claims++, matchAll: async () => [] };
  self.skipWaiting = async () => {};
  const cache = { match: async () => null, put: async () => { if (failPut) throw Error('quota'); } };
  const caches = { open: async () => cache, keys: async () => { if (failCleanup) throw Error('quota'); return ['other-app']; }, delete: async () => true };
  const source = template.replace(/const SHELL = \[[\s\S]*?\];/, `const SHELL = ${JSON.stringify(['./index.html', ...Array.from({ length: artCount }, (_, i) => `./assets/${i}.png`)])};`);
  vm.runInNewContext(source, { self, caches, URL, Request, Response, AbortController, console: { warn() {} },
    setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async request => { fetches++; if (stalled) return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => { aborted++; reject(Error('aborted')); })); return new Response('ok', { status: responseStatus }); } });
  async function event(name, data) { const pending = []; self.emit(name, { data, source: { postMessage() {} }, waitUntil: p => pending.push(p) }); await Promise.all(pending); }
  return { self, event, timers, get claims() { return claims; }, get fetches() { return fetches; }, get aborted() { return aborted; } };
}
test('activation claims despite cleanup failure', async () => {
  const w = workerEnv({ failCleanup: true }); await w.event('activate'); assert.equal(w.claims, 1);
});
test('art uses four-request batches; legacy warming and updating workers do no work', async () => {
  const w = workerEnv(); await w.event('message', { type: 'PRECACHE_ART' }); assert.equal(w.fetches, 0);
  w.self.registration.waiting = {}; await w.event('message', { type: 'WARM_ART_BATCH' }); assert.equal(w.fetches, 0);
  w.self.registration.waiting = null; await w.event('message', { type: 'WARM_ART_BATCH' }); assert.equal(w.fetches, 4);
  await w.event('message', { type: 'WARM_ART_BATCH' }); assert.equal(w.fetches, 8);
});
test('optional request abort and timeout release the message lifetime', async () => {
  const w = workerEnv({ stalled: true }); const pending = w.event('message', { type: 'WARM_ART_BATCH' }); await flush();
  await w.event('message', { type: 'ABORT_ART' }); await pending; assert.equal(w.aborted, 1);
  const t = workerEnv({ stalled: true, artCount: 1 }); const timed = t.event('message', { type: 'WARM_ART_BATCH' }); await flush();
  for (const fn of t.timers.values()) fn(); await timed; assert.equal(t.aborted, 1);
});

test('critical network and quota failures reject installation rather than claiming', async () => {
  for (const options of [{ responseStatus: 403 }, { failPut: true }]) {
    const w = workerEnv(options); await assert.rejects(w.event('install')); assert.equal(w.claims, 0);
  }
});

test('retry during activating preserves acceptance and completes on controllerchange or statechange', async () => {
  for (const stateFirst of [true, false]) {
    const p = await page(); p.release(); p.accept();
    p.registration.waiting = null; p.worker.state = 'activating';
    p.timeout(); p.button('[data-retry]').emit('click');
    assert.equal(p.timers.size, 1, 'retry re-arms the recovery deadline');
    assert.equal(p.reloads, 0);
    if (stateFirst) {
      p.worker.state = 'activated'; p.worker.emit('statechange');
      assert.equal(p.reloads, 0); p.control();
    } else {
      p.sw.controller = p.worker; p.sw.emit('controllerchange');
      assert.equal(p.reloads, 0);
      p.worker.state = 'activated'; p.worker.emit('statechange');
    }
    assert.equal(p.reloads, 1);
    assert.equal(p.timers.size, 0);
  }
});

function releaseFixture() {
  const stores = new Map();
  let generation = 'A', offline = false, failApp = false, updates = 0, deployment = 'aa', switchOnApp = null;
  const requests = [];
  const scope = 'http://127.0.0.1/tools/magicshow/';
  function boot(version, active = null) {
    const self = new Target();
    self.registration = { scope, active, update: async () => updates++ };
    self.clients = { claim: async () => {}, matchAll: async () => [] };
    const source = template.replace('__VERSION__', version).replace(/const SHELL = \[[\s\S]*?\];/,
      'const SHELL = ["./index.html", "./app.js", "./update-prompt.js", "./sw.js"];');
    const caches = {
      open: async name => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        return { put: async (url, response) => entries.set(String(url), await response.text()),
          match: async url => entries.has(String(url)) ? new Response(entries.get(String(url))) : undefined };
      },
      keys: async () => [...stores.keys()], delete: async name => stores.delete(name),
    };
    vm.runInNewContext(source, { self, caches, URL, Request, Response, AbortController, setTimeout, clearTimeout, console,
      fetch: async request => {
        requests.push(request.url);
        if (offline || (failApp && request.url.endsWith('app.js'))) throw Error('offline');
        if (request.url.endsWith('sw.js')) return new Response(template.replace('__VERSION__', deployment));
        if (request.url.endsWith('app.js') && switchOnApp) deployment = switchOnApp;
        return new Response(request.url.endsWith('app.js') ? `globalThis.launched = '${generation}';` : `${generation}:${request.url.split('/').pop()}`);
      } });
    return {
      async lifecycle(name) { const pending = []; self.emit(name, { waitUntil: p => pending.push(p) }); await Promise.all(pending); },
      async get(name) {
        let response; const pending = [];
        self.emit('fetch', { request: new Request(new URL(name, scope)), respondWith: p => response = p, waitUntil: p => pending.push(p) });
        const result = await response; await Promise.all(pending); return result;
      },
    };
  }
  return { boot, stores, requests, scope, set generation(v) { generation = v; }, set offline(v) { offline = v; },
    set deployment(v) { deployment = v; }, set switchOnApp(v) { switchOnApp = v; },
    set failApp(v) { failApp = v; }, get updates() { return updates; } };
}

test('legacy rescue keeps the previous offline shell on failure and launches the full replacement offline on success', async () => {
  const f = releaseFixture(), old = f.boot('aa');
  await old.lifecycle('install'); await old.lifecycle('activate');
  f.generation = 'B'; f.deployment = 'bb'; f.failApp = true;
  const rescue = f.boot('bb', { postMessage() {} });
  await assert.rejects(rescue.lifecycle('install'));
  f.offline = true;
  assert.equal(await (await old.get('index.html')).text(), 'A:index.html');
  const oldRuntime = {}; vm.runInNewContext(await (await old.get('app.js')).text(), oldRuntime);
  assert.equal(oldRuntime.launched, 'A');
  f.offline = false; f.failApp = false;
  const retry = f.boot('bb', { postMessage() {} });
  await retry.lifecycle('install'); await retry.lifecycle('activate'); f.offline = true;
  assert.equal(await (await retry.get('index.html')).text(), 'B:index.html');
  const runtime = {}; vm.runInNewContext(await (await retry.get('app.js')).text(), runtime);
  assert.equal(runtime.launched, 'B');
  assert.equal(f.stores.size, 1);
});

test('A HTML plus a missing app.js never fetches or caches B executable; requests an update', async () => {
  const f = releaseFixture(), a = f.boot('aa'); await a.lifecycle('install');
  const entries = [...f.stores.values()][0]; entries.delete(new URL('app.js', f.scope).href);
  f.generation = 'B'; f.requests.length = 0;
  assert.equal(await (await a.get('index.html')).text(), 'A:index.html');
  assert.equal((await a.get('app.js')).type, 'error');
  assert.equal(entries.has(new URL('app.js', f.scope).href), false);
  assert.deepEqual(f.requests, []); assert.equal(f.updates, 1);
});

test('late or absent modern release responses never select a partial legacy install', async () => {
  const f = releaseFixture(); let probes = 0;
  const worker = f.boot('aa', { postMessage() { probes++; } });
  await worker.lifecycle('install');
  assert.equal(probes, 0, 'installation does not infer version from response latency');
  assert.equal([...f.stores.values()][0].size, 4, 'all executable files are installed');
});


test('release identity mismatch before or during installation rejects and removes the partial release', async () => {
  for (const duringDownload of [false, true]) {
    const f = releaseFixture(), old = f.boot('aa'); await old.lifecycle('install');
    if (duringDownload) { f.deployment = 'bb'; f.switchOnApp = 'cc'; }
    else f.deployment = 'cc';
    const replacement = f.boot('bb');
    await assert.rejects(replacement.lifecycle('install'), /Release changed; update needed/);
    assert.equal(f.stores.size, 1, 'only the previous complete cache survives');
    f.offline = true;
    assert.equal(await (await old.get('index.html')).text(), 'A:index.html');
  }
});
