import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const ROUTES = ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7'];

for (const route of ROUTES) {
  test(`${route} service worker preserves caches owned by other apps`, async () => {
    const source = await readFile(new URL(`../../${route}/sw.js`, import.meta.url), 'utf8');
    const listeners = new Map();
    const deleted = [];
    const foreignKeys = ['another-app-shell-v1', 'workbox-precache-example'];
    const context = {
      self: {
        addEventListener(type, listener) { listeners.set(type, listener); },
        clients: { claim: async () => {} },
        registration: { scope: `https://example.test/${route}/` },
        location: { origin: 'https://example.test' },
      },
      caches: {
        keys: async () => foreignKeys,
        delete: async (key) => { deleted.push(key); return true; },
      },
      URL,
    };

    runInNewContext(source, context, { filename: `${route}/sw.js` });
    const activate = listeners.get('activate');
    assert.equal(typeof activate, 'function');
    let activation;
    activate({ waitUntil(promise) { activation = promise; } });
    await activation;
    assert.deepEqual(deleted, []);
  });
}
