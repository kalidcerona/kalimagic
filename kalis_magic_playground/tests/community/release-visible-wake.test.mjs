import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../zz2/rewind.js', import.meta.url), 'utf8');
const start = source.indexOf('function performanceWakeWanted()');
const end = source.indexOf('\n}', source.indexOf('function syncPerformanceWakeLock()'));
// RELEASE indents its helpers; stop at the next feature function instead.
const stop = source.includes('function showScreen(next')
  ? source.indexOf('    function showScreen(next', start) : end + 2;
const code = 'let wakeLock = null, wakeLockPending = false;\n' + source.slice(start, stop);
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('visible settings tolerates rejection, deduplicates pending requests and releases a late hidden lock', async () => {
  const document = { visibilityState: 'visible' };
  let calls = 0, releases = 0, resolve;
  const navigator = { wakeLock: { request() {
    calls++;
    if (calls === 1) return Promise.reject(new Error('denied'));
    return new Promise(done => { resolve = done; });
  } } };
  const context = vm.createContext({ document, navigator });
  vm.runInContext(code, context);
  await context.acquireWakeLock();
  assert.equal(calls, 1);
  context.syncPerformanceWakeLock();
  context.syncPerformanceWakeLock();
  assert.equal(calls, 2);
  document.visibilityState = 'hidden';
  resolve({ async release() { releases++; } });
  await flush();
  assert.equal(releases, 1);
  await context.acquireWakeLock();
  assert.equal(calls, 2);
  document.visibilityState = 'visible';
  context.syncPerformanceWakeLock();
  assert.equal(calls, 3);
  resolve({ async release() { releases++; }, addEventListener() {} });
  await flush();
  context.syncPerformanceWakeLock();
  assert.equal(calls, 3, 'visible settings retains the held lock');
  assert.equal(releases, 1);
});
