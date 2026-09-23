import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('stopwatch worker activation preserves caches belonging to other app scopes', async () => {
  const code = readFileSync(new URL('../../zz6/sw.js', import.meta.url), 'utf8');
  const names = [];
  const workers = [];
  const deleted = [];
  for (const scope of ['https://example.com/zz6/', 'https://example.com/tools/stopwatch-uni/']) {
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
