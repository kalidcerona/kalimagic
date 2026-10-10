import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { transformDistributionDocument } from '../../scripts/build-public.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function guardScript(tool, target) {
  const html = transformDistributionDocument('<head></head>else initApp();', { tool, target });
  const match = html.match(/<script id="friend-apps-check">([\s\S]*?)<\/script>/);
  assert.ok(match, `${target} friend-apps-check script missing`);
  return match[1];
}

function entitlement(status, body, type = 'basic') {
  return {
    ok: status >= 200 && status < 300,
    status,
    type,
    json: async () => body,
  };
}

async function settle() {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function runGuard({
  tool = 'unlock',
  target = 'release',
  pathname = '/tools/release/',
  search = '',
  now = NOW,
  storage = new Map(),
  storageThrows = false,
  fetchImpl,
  fireTimeout = false,
  fireTimeoutAfterHeaders = false,
}) {
  const document = { documentElement: { style: { visibility: 'visible' } } };
  const replaced = [];
  const timers = [];
  const cleared = [];
  const localStorage = {
    getItem(key) {
      if (storageThrows) throw new Error('localStorage unavailable');
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      if (storageThrows) throw new Error('localStorage unavailable');
      storage.set(key, String(value));
    },
    removeItem(key) {
      if (storageThrows) throw new Error('localStorage unavailable');
      storage.delete(key);
    },
  };
  const sandbox = {
    location: {
      protocol: 'https:',
      pathname,
      search,
      replace(url) { replaced.push(url); },
    },
    document,
    localStorage,
    AbortController,
    setTimeout(fn, delay) {
      timers.push({ fn, delay });
      return timers.length;
    },
    clearTimeout(id) { cleared.push(id); },
    fetch(url, options) {
      assert.equal(url, `/tools/_check?tool=${tool}`);
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal);
      return fetchImpl(url, options);
    },
    Date: { now: () => now },
  };
  vm.runInNewContext(guardScript(tool, target), sandbox);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 6000);
  const hiddenWhilePending = document.documentElement.style.visibility;
  if (fireTimeout) timers[0].fn();
  if (fireTimeoutAfterHeaders) {
    await settle();
    assert.equal(cleared.length, 0, 'timeout stays armed while the body is unread');
    timers[0].fn();
  }
  await settle();
  return {
    hiddenWhilePending,
    visibility: document.documentElement.style.visibility,
    replaced,
    cleared,
    storage,
    loginUrl: '/tools/login/?to=' + encodeURIComponent(pathname + search),
  };
}

test('success stores a timestamp and reveals the page', async () => {
  const storage = new Map();
  const result = await runGuard({
    storage,
    fetchImpl: () => Promise.resolve(entitlement(200, { ok: true })),
  });
  assert.equal(result.hiddenWhilePending, 'hidden');
  assert.equal(result.visibility, '');
  assert.deepEqual(result.replaced, []);
  assert.equal(storage.get('friend-apps-ok:unlock:/tools/release/'), String(NOW));
  assert.deepEqual(result.cleared, [1]);
});

test('ok:false removes the key and redirects', async () => {
  const key = 'friend-apps-ok:unlock:/tools/release/';
  const storage = new Map([[key, String(NOW)]]);
  const result = await runGuard({
    storage,
    fetchImpl: () => Promise.resolve(entitlement(200, { ok: false })),
  });
  assert.equal(result.visibility, 'hidden');
  assert.deepEqual(result.replaced, [result.loginUrl]);
  assert.equal(storage.has(key), false);
});

test('401 and 403 redirect and remove the key', async () => {
  for (const status of [401, 403]) {
    const key = 'friend-apps-ok:unlock:/tools/release/';
    const storage = new Map([[key, String(NOW)]]);
    const result = await runGuard({
      storage,
      fetchImpl: () => Promise.resolve(entitlement(status, { ok: true })),
    });
    assert.equal(result.visibility, 'hidden', String(status));
    assert.deepEqual(result.replaced, [result.loginUrl], String(status));
    assert.equal(storage.has(key), false, String(status));
  }
});

test('network failure with a 10-day-old stamp reveals', async () => {
  const key = 'friend-apps-ok:unlock:/tools/release/';
  const storage = new Map([[key, String(NOW - 10 * DAY)]]);
  const result = await runGuard({
    storage,
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(result.visibility, '');
  assert.deepEqual(result.replaced, []);
  assert.equal(storage.get(key), String(NOW - 10 * DAY));
});

test('network failure with a 91-day-old stamp redirects', async () => {
  const key = 'friend-apps-ok:unlock:/tools/release/';
  const expired = await runGuard({
    storage: new Map([[key, String(NOW - 91 * DAY)]]),
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(expired.visibility, 'hidden');
  assert.deepEqual(expired.replaced, [expired.loginUrl]);

  const boundary = await runGuard({
    storage: new Map([[key, String(NOW - 90 * DAY)]]),
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(boundary.visibility, '');
  assert.deepEqual(boundary.replaced, []);
});

test('no stamp redirects', async () => {
  const result = await runGuard({
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(result.visibility, 'hidden');
  assert.deepEqual(result.replaced, [result.loginUrl]);
  assert.equal(result.storage.size, 0);
});

test('a 5xx status with a fresh stamp reveals', async () => {
  const key = 'friend-apps-ok:unlock:/tools/release/';
  const storage = new Map([[key, String(NOW)]]);
  const result = await runGuard({
    storage,
    fetchImpl: () => Promise.resolve(entitlement(503, { ok: false })),
  });
  assert.equal(result.visibility, '');
  assert.deepEqual(result.replaced, []);
  assert.equal(storage.get(key), String(NOW));
});

test('a timeout with a fresh stamp reveals', async () => {
  const key = 'friend-apps-ok:unlock:/tools/release/';
  const storage = new Map([[key, String(NOW)]]);
  const result = await runGuard({
    storage,
    fireTimeout: true,
    fetchImpl: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }),
  });
  assert.equal(result.hiddenWhilePending, 'hidden');
  assert.equal(result.visibility, '');
  assert.deepEqual(result.replaced, []);
  assert.equal(storage.get(key), String(NOW));
});

test('a future stamp more than 1 day ahead redirects', async () => {
  const key = 'friend-apps-ok:unlock:/tools/release/';
  const ahead = await runGuard({
    storage: new Map([[key, String(NOW + DAY + 1)]]),
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(ahead.visibility, 'hidden');
  assert.deepEqual(ahead.replaced, [ahead.loginUrl]);

  const skew = await runGuard({
    storage: new Map([[key, String(NOW + DAY)]]),
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(skew.visibility, '');
  assert.deepEqual(skew.replaced, []);
});

test('localStorage throwing redirects', async () => {
  const offline = await runGuard({
    storageThrows: true,
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(offline.visibility, 'hidden');
  assert.deepEqual(offline.replaced, [offline.loginUrl]);

  const online = await runGuard({
    storageThrows: true,
    fetchImpl: () => Promise.resolve(entitlement(200, { ok: true })),
  });
  assert.equal(online.visibility, '');
  assert.deepEqual(online.replaced, []);
});

test('the two kairos routes use separate keys', async () => {
  const storage = new Map();
  const allow = () => Promise.resolve(entitlement(200, { ok: true }));
  const uni = await runGuard({
    tool: 'stopwatch-uni',
    target: 'kairos',
    pathname: '/tools/kairos/',
    storage,
    fetchImpl: allow,
  });
  const classic = await runGuard({
    tool: 'stopwatch',
    target: 'kairos-classic',
    pathname: '/tools/kairos-classic/',
    storage,
    fetchImpl: allow,
  });
  const uniKey = 'friend-apps-ok:stopwatch-uni:/tools/kairos/';
  const classicKey = 'friend-apps-ok:stopwatch:/tools/kairos-classic/';
  assert.notEqual(uniKey, classicKey);
  assert.equal(storage.get(uniKey), String(NOW));
  assert.equal(storage.get(classicKey), String(NOW));
  assert.equal(uni.visibility, '');
  assert.equal(classic.visibility, '');

  storage.delete(classicKey);
  const classicOffline = await runGuard({
    tool: 'stopwatch',
    target: 'kairos-classic',
    pathname: '/tools/kairos-classic/',
    storage,
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(classicOffline.visibility, 'hidden');
  assert.deepEqual(classicOffline.replaced, [classicOffline.loginUrl]);
  assert.equal(storage.get(uniKey), String(NOW));

  const uniOffline = await runGuard({
    tool: 'stopwatch-uni',
    target: 'kairos',
    pathname: '/tools/kairos/',
    storage,
    fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
  });
  assert.equal(uniOffline.visibility, '');
  assert.deepEqual(uniOffline.replaced, []);
});

test('a stalled body takes the offline path after the timeout', async () => {
  const key = 'friend-apps-ok:unlock:/tools/release/';
  const stalled = (_url, options) => Promise.resolve({
    ok: true,
    status: 200,
    type: 'basic',
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }),
  });
  const fresh = await runGuard({
    storage: new Map([[key, String(NOW)]]),
    fetchImpl: stalled,
    fireTimeoutAfterHeaders: true,
  });
  assert.equal(fresh.visibility, '');
  assert.deepEqual(fresh.replaced, []);
  assert.equal(fresh.storage.get(key), String(NOW));

  const missing = await runGuard({
    fetchImpl: stalled,
    fireTimeoutAfterHeaders: true,
  });
  assert.equal(missing.visibility, 'hidden');
  assert.deepEqual(missing.replaced, [missing.loginUrl]);
  assert.equal(missing.storage.size, 0);
});
