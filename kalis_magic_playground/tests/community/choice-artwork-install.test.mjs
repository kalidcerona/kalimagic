import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// CHOICE (zz4) stores its artwork during install, so an update done at home is complete offline at the venue.
const source = readFileSync(new URL('../../zz4/sw.js', import.meta.url), 'utf8');
const scope = 'https://example.test/zz4/';

function boot({ failArtwork = false, active = null } = {}) {
  const listeners = {};
  const entries = new Map();
  let skips = 0;
  const fetchLog = [];
  const isArtwork = (url) => url.includes('/home-icons/') || url.includes('home-icons');
  vm.runInNewContext(source, {
    URL, Response, Request,
    self: {
      registration: { scope, active },
      addEventListener(name, fn) { listeners[name] = fn; },
      skipWaiting() { skips += 1; return Promise.resolve(); },
      clients: { claim: () => Promise.resolve() },
    },
    fetch: async (request) => {
      fetchLog.push(request.url);
      if (failArtwork && isArtwork(request.url)) throw new TypeError('offline');
      return new Response('body:' + request.url, { status: 200 });
    },
    caches: {
      async open() {
        return {
          async addAll(requests) { for (const r of requests) entries.set(r.url, 'shell'); },
          async put(key, response) { entries.set(typeof key === 'string' ? key : key.url, await response.text()); },
        };
      },
    },
  });
  return { listeners, entries, fetchLog, get skips() { return skips; } };
}

const shellList = () => [...source.matchAll(/^ {2}"(\.\/home-icons\/[^"]+)"/gm)].map((m) => new URL(m[1], scope).href);

test('install has stored every artwork file before the new version can be used offline', async () => {
  const worker = boot({ active: { scriptURL: scope + 'sw.js' } });
  let done;
  worker.listeners.install({ waitUntil(p) { done = p; } });
  await done;
  const urls = shellList();
  assert.ok(urls.length > 50, 'artwork list found in the shell');
  for (const url of urls) assert.ok(worker.entries.has(url), url);
  assert.ok(worker.entries.has(scope + 'index.html'));
  assert.equal(worker.skips, 0, 'an update still waits for the next launch');
});

test('a failing artwork fetch never fails the install, and the critical shell stays stored', async () => {
  const worker = boot({ failArtwork: true });
  let done;
  worker.listeners.install({ waitUntil(p) { done = p; } });
  await done;
  assert.ok(worker.entries.has(scope + 'index.html'));
  assert.equal(shellList().filter((url) => worker.entries.has(url)).length, 0);
  assert.equal(worker.skips, 1, 'the first install still takes control');
});
