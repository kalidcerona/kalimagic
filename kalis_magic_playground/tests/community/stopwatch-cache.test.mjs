import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('integrated stopwatch worker keeps its cache isolated by app scope', async () => {
  const code = readFileSync(new URL('../../zz1/sw.js', import.meta.url), 'utf8');
  const names = [];
  const workers = [];
  const deleted = [];
  for (const scope of [
    'https://example.com/zz1/',
    'https://example.com/tools/stopwatch/',
    'https://example.com/tools/stopwatch-uni/'
  ]) {
    const listeners = {};
    vm.runInNewContext(code, {
      self: { registration: { scope }, clients: { claim: async () => {} },
        skipWaiting: async () => {}, addEventListener: (name, callback) => { listeners[name] = callback; } },
      caches: { open: async name => { names.push(name); return { addAll: async () => {} }; },
        keys: async () => names.slice(), delete: async name => { deleted.push(name); } }
    });
    let installed;
    listeners.install({ waitUntil: p => { installed = p; } });
    await installed;
    workers.push(listeners);
  }
  assert.notEqual(names[0], names[1]);
  for (const listeners of workers) {
    let activated;
    listeners.activate({ waitUntil: p => { activated = p; } });
    await activated;
  }
  assert.deepEqual(deleted, []);
});

test('the ZZ1 worker does not read the calculator response left in a global cache', async () => {
  const code = readFileSync(new URL('../../zz1/sw.js', import.meta.url), 'utf8');
  const listeners = {};
  const staleCalculator = { source: 'old calculator shell' };
  const networkStopwatch = { source: 'integrated stopwatch' };
  let globalCacheLookups = 0;
  vm.runInNewContext(code, {
    URL,
    caches: {
      match: async () => { globalCacheLookups += 1; return staleCalculator; },
      open: async () => ({ match: async () => null, put: async () => {} })
    },
    fetch: async () => networkStopwatch,
    self: {
      registration: { scope: 'https://example.com/zz1/' },
      location: { origin: 'https://example.com' },
      addEventListener(name, callback) { listeners[name] = callback; }
    }
  });

  let result;
  listeners.fetch({
    request: { method: 'GET', url: 'https://example.com/zz1/icon.svg', mode: 'cors' },
    respondWith(promise) { result = promise; }
  });
  assert.equal((await result).source, 'integrated stopwatch');
  assert.equal(globalCacheLookups, 0);
});
