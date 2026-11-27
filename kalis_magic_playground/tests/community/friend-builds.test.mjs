import test from 'node:test';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { FRIEND_APPS } from '../../scripts/friend-config.mjs';
import { ensureFreshCacheName, friendCacheName, transformFile } from '../../scripts/friend-builds.mjs';
import assert from 'node:assert/strict';
import { generate, writeFriendBuild, stripLocalPreview } from '../../scripts/friend-builds.mjs';

test('stripLocalPreview removes the marked line, and the old inline block as a fallback', () => {
  const marked = "a();\n\nawait import('./local-preview.js').catch(() => {}); // local-preview-hook\nb();\n";
  assert.deepEqual(stripLocalPreview(marked), { text: 'a();\nb();\n', path: 'marker' });
  const inline = "a();\nconst localSettingsHost = typeof location !== 'undefined' && true;\nif (localSettingsHost && x) {\n  y();\n  document.documentElement.dataset.localSettingsReady = 'true';\n}\nb();\n";
  assert.deepEqual(stripLocalPreview(inline), { text: 'a();\nb();\n', path: 'inline' });
  assert.deepEqual(stripLocalPreview('plain();\n'), { text: 'plain();\n', path: 'none' });
});

test('cache bump is deterministic, keeps the suffix last and settles after a write', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'friend-cache-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const make = async (files, cache) => {
    const dir = await mkdtemp(path.join(temp, 'bump-'));
    await writeFile(path.join(dir, 'sw.js'), `const CACHE_PREFIX = 'x-shell-';\nconst CACHE_NAME = CACHE_PREFIX + '${cache}';\n`);
    for (const [name, body] of Object.entries(files)) await writeFile(path.join(dir, name), body);
    return dir;
  };
  const baseline = await make({ 'a.js': '1' }, 'v1-distribution');
  const same = await make({ 'a.js': '1' }, 'v1-distribution');
  assert.equal(await ensureFreshCacheName(same, baseline, ['a.js', 'sw.js'], '-distribution'), null);
  const changedA = await make({ 'a.js': '2' }, 'v1-distribution');
  const changedB = await make({ 'a.js': '2' }, 'v1-distribution');
  const nameA = await ensureFreshCacheName(changedA, baseline, ['a.js', 'sw.js'], '-distribution');
  assert.match(nameA, /^v1-f[0-9a-f]{8}-distribution$/);
  assert.equal(await ensureFreshCacheName(changedB, baseline, ['a.js', 'sw.js'], '-distribution'), nameA);
  // After writing, the new snapshot is the baseline; regenerating the same source must reproduce it byte for byte.
  const again = await make({ 'a.js': '2' }, 'v1-distribution');
  await ensureFreshCacheName(again, changedA, ['a.js', 'sw.js'], '-distribution');
  assert.equal(await readFile(path.join(again, 'sw.js'), 'utf8'), await readFile(path.join(changedA, 'sw.js'), 'utf8'));
});

test('friendCacheName drops owner-only tokens and keeps the family prefix', () => {
  const sw = "const CACHE_PREFIX = 'x-shell-' + s + '-';\nconst CACHE_NAME = CACHE_PREFIX + 'v1-local-preview-1-a-1-local-preview-module-1';\n";
  assert.match(friendCacheName(sw, '-distribution'), /CACHE_PREFIX \+ 'v1-a-1-distribution'/);
  assert.match(friendCacheName(sw), /CACHE_PREFIX = 'x-shell-'/);
});

test('retired generation entry points fail before accessing source or output', async () => {
  for (const operation of [generate, writeFriendBuild]) {
    await assert.rejects(operation('release', '/nonexistent/output'), /Personal app generation is retired/);
  }
});

test('new public source transformations isolate keys and reject snapshot self-input', async () => {
  for (const app of ['asrai', 'alter', 'uramichi']) {
    const cfg = FRIEND_APPS[app];
    const report = { hookPaths: [], keyHits: cfg.keys.map(() => 0), warnings: [], plainHits: 0 };
    const text = cfg.keys.map(([key]) => JSON.stringify(key)).join(';');
    const result = transformFile('fixture.js', Buffer.from(text), cfg, report).toString();
    for (const [key, replacement] of cfg.keys) {
      assert.ok(!result.includes(JSON.stringify(key)));
      assert.ok(result.includes(JSON.stringify(replacement)));
    }
    await assert.rejects(generate(app, '/nonexistent/output', { sourceDir: new URL(`../../distribution-snapshots/${app}`, import.meta.url).pathname }), /cannot be generator inputs/);
  }
});

test('URAMICHI public wake lock releases for settings and pending acquisitions', async () => {
  const source = readFileSync(new URL('../../distribution-snapshots/uramichi/camera.mjs', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('// Keep the screen awake'), source.indexOf('// ---------- boot ----------'));
  const settings = { open: false }, gate = { hidden: true };
  let releaseCount = 0, requested = 0, resolveLock;
  const lock = { release: async () => { releaseCount++; }, addEventListener() {} };
  let deferred = false;
  const context = { document: { visibilityState: 'visible', addEventListener() {} },
    navigator: { wakeLock: { request: async () => { requested++; return deferred ? new Promise(resolve => { resolveLock = resolve; }) : lock; } } },
    $: id => id === 'settings' ? settings : gate,
    cameraWanted: () => gate.hidden,
    MutationObserver: class { observe() {} }, recovery: { reset() {}, cancel() {} }, startCamera() {}, stopCamera() {} };
  vm.createContext(context);
  vm.runInContext(code + '\nglobalThis.testWake = keepAwake;', context);
  await context.testWake();
  assert.equal(requested, 1);
  settings.open = true;
  await context.testWake();
  assert.equal(releaseCount, 1);
  assert.equal(requested, 1);
  settings.open = false;
  deferred = true;
  const pending = context.testWake();
  settings.open = true;
  resolveLock(lock);
  await pending;
  assert.equal(releaseCount, 2);
});

test('generation rejects overlapping inputs and preserves existing output files', async () => {
  const root = await mkdtemp(new URL('../../.friend-safety-', import.meta.url).pathname);
  try {
    const source = `${root}/source`;
    const output = `${root}/output`;
    await mkdir(source);
    await mkdir(output);
    await writeFile(`${output}/sentinel`, 'preserve');
    await assert.rejects(generate('asrai', `${source}/nested`, { sourceDir: source }), /must not overlap/);
    await assert.rejects(generate('asrai', root, { sourceDir: source }), /must not overlap/);
    await assert.rejects(generate('asrai', output, { sourceDir: source }), /new or empty/);
    await assert.rejects(writeFriendBuild('asrai', { sourceDir: source, targetDir: root }), /configured canonical/);
    await assert.rejects(writeFriendBuild('asrai', { sourceDir: new URL('../../', import.meta.url).pathname }), /must not overlap/);
    assert.equal(await readFile(`${output}/sentinel`, 'utf8'), 'preserve');
  } finally { await rm(root, { recursive: true, force: true }); }
});
