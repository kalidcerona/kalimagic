import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../../zz-migration/tyche-prelaunch.js', import.meta.url), 'utf8');
const key = 'zz11-spinner-state-v2';
const original = JSON.stringify({ targetAngle: 75, forceSpin: 6, spins: 2, previousAngle: 120, rotation: 45 });
const reset = JSON.stringify({ ...JSON.parse(original), targetAngle: null, spins: 0, previousAngle: null });

test('TYCHE retains its source across two launches when the quota prevents saving the prelaunch copy', () => {
  const data = new Map([[key, original]]);
  for (let launch = 0; launch < 2; launch++) {
    class Storage {
      getItem(name) { return data.get(name) ?? null; }
      setItem(name, value) {
        // Existing values fit, but allocating a new backup key exceeds the quota.
        if (!data.has(name)) throw new DOMException('Storage full', 'QuotaExceededError');
        data.set(name, value);
      }
      removeItem(name) { data.delete(name); }
    }
    const localStorage = new Storage();
    const window = {};
    const write = vm.runInNewContext(script + '\ninstallTycheStateWriter(key)', { window, localStorage, key });
    assert.throws(() => write(reset, true), { name: 'QuotaExceededError' });
    assert.equal(localStorage.getItem(key), original);
    assert.equal(window.zzBackupTycheState(localStorage.getItem(key)), original);
    if (launch === 1) {
      const edited = JSON.stringify({ ...JSON.parse(reset), forceSpin: 3 });
      write(edited, false);
      assert.equal(localStorage.getItem(key), edited);
      assert.equal(window.zzBackupTycheState(edited), edited);
    }
  }
});

test('TYCHE launch copies survive subsequent launches and genuine edits', () => {
  const data = new Map([[key, original]]);
  const localStorage = {
    getItem: name => data.get(name) ?? null,
    setItem: (name, value) => data.set(name, value),
    removeItem: name => data.delete(name),
  };
  const window = {};
  const launch = () => {
    const write = vm.runInNewContext(script + '\ninstallTycheStateWriter(key)', { window, localStorage, key });
    write(reset, true);
    return write;
  };
  launch();
  const edit = launch();
  assert.equal(data.get(key), reset);
  assert.equal(window.zzBackupTycheState(reset), original);
  const changed = JSON.stringify({ ...JSON.parse(original), targetAngle: 90 });
  edit(changed, false);
  assert.equal(window.zzBackupTycheState(changed), changed);
  launch();
  assert.equal(window.zzBackupTycheState(reset), changed);
  assert.equal(data.get(key + '-prelaunch'), original);
});

test('TYCHE distinguishes a preexisting reset value from an unchanged clean launch', () => {
  for (const preexisting of [true, false]) {
    const data = new Map(preexisting ? [[key, reset]] : []);
    const localStorage = {
      getItem: name => data.get(name) ?? null,
      setItem: (name, value) => data.set(name, value),
      removeItem: name => data.delete(name),
    };
    for (let launch = 0; launch < 2; launch++) {
      const window = {};
      const write = vm.runInNewContext(script + '\ninstallTycheStateWriter(key)', { window, localStorage, key });
      write(reset, true);
      assert.equal(window.zzBackupTycheState(data.get(key)), reset);
      assert.equal(data.get(key + '-prelaunch'), preexisting ? reset : undefined);
    }
  }
});
