import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isExcludedLegacyTree,
  injectLegacyMigration,
  isolateKairosStorageKeys,
  publishLegacyBridgeFiles,
  publishLegacyMigrationModules,
  transformDistributionDocument,
} from '../../scripts/build-public.mjs';
import { legacyBridgeSource } from '../../scripts/legacy-sw-bridge.mjs';
import { LEGACY_SHARED_WORKERS } from '../../scripts/legacy-shared-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function startupRuntime({ target = 'kairos', marker, loader, unreadable = false } = {}) {
  const events = [];
  const timers = new Map();
  let timerId = 0;
  const code = injectLegacyMigration('else initApp();', target)
    .replace(/^else /, '')
    .replace('import("./legacy-storage-migration.mjs")', 'loadMigration()');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('initApp', 'sessionStorage', 'localStorage', 'location', 'setTimeout', 'clearTimeout', 'loadMigration', code);
  return {
    events,
    timers,
    run: () => execute(
      () => events.push('init'),
      { getItem() { if (unreadable) throw new Error('unreadable'); return marker ?? null; } },
      {}, { pathname: target === 'kairos' ? '/tools/kairos/' : '/tools/kairos-classic/', search: '' },
      (fn, delay) => { assert.equal(delay, 1500); timers.set(++timerId, fn); return timerId; },
      id => timers.delete(id),
      () => { events.push('import'); return loader(); },
    ),
  };
}

test('ordinary, mismatched and unreadable KAIROS launches initialize without importing migration', async () => {
  for (const options of [{}, { marker: 'stopwatch' }, { marker: 'stopwatch-uni', unreadable: true }, { target: 'kairos-classic', marker: 'stopwatch-uni' }]) {
    const runtime = startupRuntime({ ...options, loader() { throw new Error('must not import'); } });
    await runtime.run();
    assert.deepEqual(runtime.events, ['init']);
    assert.equal(runtime.timers.size, 0);
  }
});

test('trusted migration finishes before initialization and import failure starts the app', async () => {
  for (const target of ['kairos', 'kairos-classic']) {
    const runtime = startupRuntime({ target, marker: target === 'kairos' ? 'stopwatch-uni' : 'stopwatch', loader: async () => ({ migrateTrustedLegacyStorage(input) { assert.equal(input.target, target); runtime.events.push('migrate'); } }) });
    await runtime.run();
    assert.deepEqual(runtime.events, ['import', 'migrate', 'init']);
    assert.equal(runtime.timers.size, 0);
  }
  const failed = startupRuntime({ marker: 'stopwatch-uni', loader: () => Promise.reject(new Error('offline')) });
  await failed.run();
  assert.deepEqual(failed.events, ['import', 'init']);
  assert.equal(failed.timers.size, 0);
});

test('trusted import timeout initializes once and ignores a later resolved migration', async () => {
  let complete;
  const runtime = startupRuntime({ marker: 'stopwatch-uni', loader: () => new Promise(resolve => { complete = resolve; }) });
  const started = runtime.run();
  assert.deepEqual(runtime.events, ['import']);
  assert.equal(runtime.timers.size, 1);
  [...runtime.timers.values()][0]();
  await started;
  assert.deepEqual(runtime.events, ['import', 'init']);
  complete({ migrateTrustedLegacyStorage() { runtime.events.push('late-write'); } });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(runtime.events, ['import', 'init']);
  assert.equal(runtime.timers.size, 0);
});

test('key rewrite misses raw legacy keys and the injected module keeps them', () => {
  const source = 'const marker = "stopwatch_storage_migrated_v2"; const pairs = [["stopwatch2_preset_cs", "stopwatch_preset_cs"]];';
  const rewritten = isolateKairosStorageKeys(source, 'kairos');
  assert.equal(rewritten.includes('stopwatch_'), false);
  assert.equal(rewritten.includes('stopwatch2_'), false);
  assert.match(rewritten, /friend-kairos-legacy_preset_cs/);
  assert.match(rewritten, /friend-kairos_preset_cs/);
  const migration = readFileSync(new URL('../../scripts/legacy-storage-migration.mjs', import.meta.url), 'utf8');
  assert.match(migration, /stopwatch_/);
  assert.match(migration, /stopwatch2_/);
});

test('distribution transform injects migration without editing canonical snapshots', async () => {
  const kairos = await readFile(path.join(root, 'distribution-snapshots/kairos/index.html'), 'utf8');
  const before = kairos;
  const classic = transformDistributionDocument(kairos, { target: 'kairos-classic', tool: 'stopwatch' });
  const uni = transformDistributionDocument(kairos, { target: 'kairos', tool: 'stopwatch-uni' });
  assert.equal(kairos, before);
  for (const [html, prefix] of [[classic, 'friend-kairos-classic_'], [uni, 'friend-kairos_']]) {
    assert.equal(html.includes('stopwatch_'), false);
    assert.equal(html.includes('stopwatch2_'), false);
    assert.match(html, new RegExp(`${prefix}preset_cs`));
    assert.match(html, /id="friend-apps-check"/);
    assert.match(html, /if \(!result\.ok\) \{ location\.replace\(loginUrl\); return; \}/);
    assert.match(html, /\.catch\(\(\) => \{ location\.replace\(loginUrl\); \}\)/);
    assert.match(html, /data-magic-customize="off"/);
    assert.match(html, /legacy-storage-migration\.mjs/);
    assert.equal(html.includes('else initApp();'), false);
  }
  const calculator = await readFile(path.join(root, 'distribution-snapshots/calculator/index.html'), 'utf8');
  const hitsuzen = transformDistributionDocument(calculator, { target: 'hitsuzen', tool: 'calc' });
  assert.equal(calculator.includes('legacy-storage-migration.mjs'), false);
  assert.match(hitsuzen, /target: "hitsuzen"/);
  assert.match(hitsuzen, /magic-calc-date-delay/);
  assert.match(hitsuzen, /magic-calc-hour-cycle/);
  assert.match(hitsuzen, /magic-calc-skin/);
  assert.match(hitsuzen, /id="friend-apps-check"/);
  assert.equal(hitsuzen.includes('stopwatch_preset_cs'), false);
});

test('build publishes bridge files outside the excluded legacy trees', async () => {
  assert.equal(isExcludedLegacyTree('tools/stopwatch/sw.js'), true);
  assert.equal(isExcludedLegacyTree('tools/stopwatch-uni/sw.js'), true);
  assert.equal(isExcludedLegacyTree('tools/calc/sw.js'), true);
  assert.equal(isExcludedLegacyTree('tools/stopwatch2/sw.js'), false);
  assert.equal(isExcludedLegacyTree('legacy-bridges/stopwatch/sw.js'), false);
  const directory = await mkdtemp(path.join(root, 'tmp-legacy-build-'));
  try {
    await publishLegacyBridgeFiles(directory);
    await publishLegacyMigrationModules(path.join(directory, 'app'));
    const published = [];
    for (const spec of LEGACY_SHARED_WORKERS) {
      const file = path.join(directory, spec.bridgeFile);
      published.push(spec.bridgeFile);
      assert.equal(await readFile(file, 'utf8'), legacyBridgeSource(spec));
    }
    assert.deepEqual(published.sort(), LEGACY_SHARED_WORKERS.map((spec) => spec.bridgeFile).sort());
    assert.equal((await readdir(directory)).includes('tools'), false);
    const migration = await readFile(path.join(directory, 'app/legacy-storage-migration.mjs'), 'utf8');
    assert.match(migration, /LANDSCAPE_PREFIX = 'stopwatch_'/);
    assert.match(migration, /PORTRAIT_PREFIX = 'stopwatch2_'/);
    assert.match(migration, /'preset_cs'/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
