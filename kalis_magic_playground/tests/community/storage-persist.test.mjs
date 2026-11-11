import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const files = ['zz1/wake-lock.js', 'zz2/rewind.js', 'zz3/wake-lock.js', 'zz4/wake-lock.js', 'zz5/wake-lock.js', 'zz6/wake-lock.js', 'zz7/wake-lock.js', 'zz8/contacts-screen.js', 'zz10/wake-lock.js', 'zz11/spin.js', 'zz12/app.mjs', 'zz13/storage-recovery.mjs', 'zz14/app.mjs', 'TabataTimer/app.js'];
for (const file of files) test(`${file}: one silent, optional persistence request on load`, async () => {
  const source = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
  const start = source.indexOf('function askToKeepStoredData()');
  assert.ok(start >= 0);
  const end = file === 'zz13/storage-recovery.mjs' ? source.indexOf('Object.assign(ctx,', start) : source.indexOf('askToKeepStoredData();', start);
  assert.ok(end > start);
  const code = file === 'zz13/storage-recovery.mjs' ? source.slice(start, end) + '\naskToKeepStoredData();' : source.slice(start, end + 'askToKeepStoredData();'.length);
  for (const mode of ['missing', 'unsupported', 'granted', 'denied', 'reject', 'throw']) {
    let calls = 0;
    const context = {};
    if (mode !== 'missing') context.navigator = mode === 'unsupported' ? {} : { storage: { persist() {
      calls++;
      if (mode === 'throw') throw new Error('blocked');
      if (mode === 'reject') return Promise.reject(new Error('blocked'));
      return Promise.resolve(mode === 'granted');
    } } };
    vm.runInNewContext(code, context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, ['missing', 'unsupported'].includes(mode) ? 0 : 1);
  }
});
test('KanameCue boot and later imports share a once-only request', async () => {
  const source = readFileSync(new URL('../../KanameCue/show.mjs', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('let persistRequested = false;'), source.indexOf('// ---------- boot ----------'));
  let calls = 0;
  const context = { navigator: { storage: { persist: async () => { calls++; return false; } } } };
  vm.runInNewContext(code + '\nrequestPersist(); requestPersist();', context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
});
