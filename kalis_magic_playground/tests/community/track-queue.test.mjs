import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

test('an open tab removes expired analytics before retrying a failed batch', async () => {
  let now = Date.parse('2026-11-01T00:00:00Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const storage = new Map();
  const listeners = {};
  const requests = [];
  const window = {
    localStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    setInterval() {}, setTimeout() {return 1;},
    addEventListener(name, callback) {listeners[name] = callback;},
    async fetch(url, options) {requests.push(JSON.parse(options.body)); return {status:503};}
  };
  runInNewContext(readFileSync(new URL('../../track.js', import.meta.url), 'utf8'), {
    window, document:{addEventListener() {}}, Date:Clock
  });
  await listeners.pagehide();
  assert.equal(requests.length, 1);
  now += 8 * 86400000;
  await listeners.pagehide();
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(storage.get('kalimagic_analytics_queue_v3')), []);
});
