import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { FRIEND_APPS } from '../../scripts/friend-config.mjs';
import { assertSafeReportPath, ensureFreshCacheName, friendApps, friendCacheName, generate, stripLocalPreview } from '../../scripts/friend-builds.mjs';
import { SETTINGS_UI_FILES, SHARED_UNLOCK_FILES, promoteSharedUnlock } from '../../scripts/build-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOTS = path.join(ROOT, 'distribution-snapshots');
const TEXT = /\.(?:m?js|html|css|webmanifest)$/;
const KEY_APPS = ['tobira', 'aletheia', 'tyche', 'usotsuki', 'choice', 'pimax'];

async function walk(directory, base = directory, out = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

async function treeHash(directory) {
  const hash = createHash('sha256');
  for (const rel of await walk(directory)) hash.update(rel).update(await readFile(path.join(directory, rel)));
  return hash.digest('hex');
}

const built = new Map();
async function build(app, temp) {
  if (!built.has(app)) built.set(app, generate(app, path.join(temp, app)).then((report) => ({ report, dir: path.join(temp, app) })));
  return built.get(app);
}

test('friend build generator', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'friend-builds-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));

  await t.test('generated output has no owner-only local preview code or file', async () => {
    for (const app of friendApps()) {
      const { report, dir } = await build(app, temp);
      assert.deepEqual(report.warnings, [], `${app}: ${report.warnings.join(' | ')}`);
      for (const rel of await walk(dir)) {
        assert.doesNotMatch(rel, /local-preview/, `${app}/${rel}`);
        if (!TEXT.test(rel)) continue;
        const text = await readFile(path.join(dir, rel), 'utf8');
        assert.doesNotMatch(text, /local-preview|magic-local-settings|localSettingsReady/, `${app}/${rel}`);
      }
    }
  });

  await t.test('friend storage keys equal the keys in today snapshot (Class A apps)', async () => {
    const friendish = /friend-|\.distribution\.|-distribution|-dist[.\-]|pimax\.distribution/;
    const literals = async (directory, skip) => {
      const found = new Set();
      for (const rel of await walk(directory)) {
        if (!/\.(?:m?js|html)$/.test(rel) || skip?.(rel)) continue;
        const text = await readFile(path.join(directory, rel), 'utf8');
        for (const match of text.matchAll(/(['"`])([A-Za-z0-9_.\-]{4,})\1/g)) {
          // The cache version literal is allowed to move; its family prefix is a separate literal and stays compared.
          if (friendish.test(match[2]) && !/^v\d{8}-/.test(match[2])) found.add(match[2]);
        }
      }
      return [...found].sort();
    };
    for (const app of KEY_APPS) {
      const cfg = FRIEND_APPS[app];
      const { dir } = await build(app, temp);
      // TOBIRA boot handling follows the personal build on purpose (Class C), so its old inline boot script is not compared.
      const skip = app === 'tobira' ? (rel) => rel === 'index.html' : undefined;
      const generated = await literals(dir, skip);
      const snapshot = await literals(path.join(SNAPSHOTS, cfg.snapshot), skip);
      assert.deepEqual(generated, snapshot, `${app}: friend key literals drifted from the snapshot`);
      for (const [, to] of cfg.keys) assert.ok(generated.includes(to), `${app}: ${to} missing from generated output`);
    }
  });

  await t.test('cache family prefixes stay the same as the snapshot', async () => {
    for (const app of friendApps()) {
      const { dir } = await build(app, temp);
      const prefix = async (directory) => (await readFile(path.join(directory, 'sw.js'), 'utf8')).match(/(?:CACHE_PREFIX = |PREFIX=)('[^']*'(?:\s*\+[^;,]*)?)/)?.[1];
      assert.equal(await prefix(dir), await prefix(path.join(SNAPSHOTS, FRIEND_APPS[app].snapshot)), app);
    }
  });

  await t.test('generate never writes outside its outDir and refuses distribution-snapshots without write', async () => {
    const before = await treeHash(SNAPSHOTS);
    const out = await mkdtemp(path.join(os.tmpdir(), 'friend-builds-out-'));
    t.after(() => rm(out, { recursive: true, force: true }));
    for (const app of friendApps()) await generate(app, path.join(out, app));
    assert.equal(await treeHash(SNAPSHOTS), before);
    await assert.rejects(() => generate('tobira', path.join(SNAPSHOTS, 'tobira')), /without --write/);
    await assert.rejects(() => generate('tobira', path.join(SNAPSHOTS, 'brand-new')), /without --write/);
    const cli = execFileSync(process.execPath, [path.join(ROOT, 'scripts/friend-builds.mjs'), 'generate', 'unlock'], { encoding: 'utf8' });
    assert.match(cli, /output: /);
    assert.equal(await treeHash(SNAPSHOTS), before);
    await assert.rejects(() => stat(path.join(SNAPSHOTS, 'brand-new')));
  });

  await t.test('a changed friend build always gets a new cache name; an unchanged one stays byte-identical', async () => {
    const cacheOf = (text) => /(?:CACHE_NAME = CACHE_PREFIX \+ |CACHE=PREFIX\+)'([^']*)'/.exec(text)[1];
    const slot = (text) => text.replace(cacheOf(text), '');
    for (const app of friendApps()) {
      const { dir } = await build(app, temp);
      const snapDir = path.join(SNAPSHOTS, FRIEND_APPS[app].snapshot);
      const generatedSw = await readFile(path.join(dir, 'sw.js'), 'utf8');
      const snapshotSw = await readFile(path.join(snapDir, 'sw.js'), 'utf8');
      let changed = slot(generatedSw) !== slot(snapshotSw);
      for (const rel of await walk(dir)) {
        if (rel === 'sw.js') continue;
        const other = await readFile(path.join(snapDir, rel)).catch(() => null);
        if (!other || !other.equals(await readFile(path.join(dir, rel)))) changed = true;
      }
      if (changed) assert.notEqual(cacheOf(generatedSw), cacheOf(snapshotSw), `${app}: files changed but the cache name did not`);
      else assert.equal(generatedSw, snapshotSw, `${app}: nothing changed, sw.js must be byte-identical`);
      // The family suffix stays last so publish-time family filters keep matching.
      if (FRIEND_APPS[app].cacheSuffix) assert.ok(cacheOf(generatedSw).endsWith(FRIEND_APPS[app].cacheSuffix), app);
    }
  });

  await t.test('cache bump is deterministic, keeps the suffix last and settles after a write', async () => {
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

  await t.test('every relative import in a generated app resolves to a generated file', async () => {
    for (const app of friendApps()) {
      const { dir } = await build(app, temp);
      const files = new Set(await walk(dir));
      for (const rel of files) {
        if (!/\.m?js$/.test(rel)) continue;
        const text = await readFile(path.join(dir, rel), 'utf8');
        for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\1/g)) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), match[2]));
          assert.ok(files.has(target), `${app}/${rel} imports ${match[2]} which is not generated`);
        }
      }
    }
    // controller.js boots USOTSUKI; detector.js must keep importing it after the hook line is gone.
    assert.match(await readFile(path.join((await build('usotsuki', temp)).dir, 'detector.js'), 'utf8'), /from "\.\/controller\.js"/);
  });

  await t.test('the compare report cannot be pointed at app files', async () => {
    for (const bad of [
      path.join(SNAPSHOTS, 'tobira', 'app.js'), path.join(ROOT, 'zz6', 'app.js'), path.join(ROOT, 'scripts', 'build-public.mjs'),
      path.resolve(ROOT, '../../magic-tobira/app.js')
    ]) await assert.rejects(() => assertSafeReportPath(bad), /Refusing/, bad);
    const outside = await mkdtemp(path.join(os.tmpdir(), 'friend-report-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    await assertSafeReportPath(path.join(outside, 'report.txt'));
    // A symlink into the snapshots is judged by where it lands.
    const link = path.join(outside, 'link');
    await symlink(path.join(SNAPSHOTS, 'tobira'), link);
    await assert.rejects(() => assertSafeReportPath(path.join(link, 'app.js')), /Refusing/);
    const target = path.join(SNAPSHOTS, 'tobira', 'app.js');
    const before = await readFile(target);
    assert.throws(() => execFileSync(process.execPath, [path.join(ROOT, 'scripts/friend-builds.mjs'), 'compare', '--report', target], { stdio: 'pipe' }));
    assert.ok((await readFile(target)).equals(before));
  });

  await t.test('generate does not follow symlinks out of its outDir or into distribution-snapshots', async () => {
    const before = await treeHash(SNAPSHOTS);
    const sandbox = await mkdtemp(path.join(os.tmpdir(), 'friend-symlink-'));
    t.after(() => rm(sandbox, { recursive: true, force: true }));
    const outside = path.join(sandbox, 'outside');
    await mkdir(outside);
    // 1. a directory inside outDir that points elsewhere
    const out1 = path.join(sandbox, 'out1');
    await mkdir(out1);
    await symlink(outside, path.join(out1, 'court-cards'));
    await assert.rejects(() => generate('aletheia', out1), /outside the output directory/);
    assert.deepEqual(await readdir(outside), []);
    // 2. an existing destination file that is a symlink
    const victim = path.join(outside, 'victim.txt');
    await writeFile(victim, 'keep');
    const out2 = path.join(sandbox, 'out2');
    await mkdir(out2);
    await symlink(victim, path.join(out2, 'index.html'));
    await assert.rejects(() => generate('aletheia', out2), /through a symlink/);
    assert.equal(await readFile(victim, 'utf8'), 'keep');
    // 3. outDir itself is a symlink into the snapshots
    const out3 = path.join(sandbox, 'out3');
    await symlink(path.join(SNAPSHOTS, 'tobira'), out3);
    await assert.rejects(() => generate('tobira', out3), /without --write/);
    // 4. a symlink inside outDir that points into the snapshots
    const out4 = path.join(sandbox, 'out4');
    await mkdir(out4);
    await symlink(path.join(SNAPSHOTS, 'aletheia', 'court-cards'), path.join(out4, 'court-cards'));
    await assert.rejects(() => generate('aletheia', out4), /Refusing/);
    assert.equal(await treeHash(SNAPSHOTS), before);
  });

  await t.test('unlock promotion still ships the same files', async () => {
    const sibling = path.resolve(ROOT, '../../magic-unlock');
    const source = await stat(sibling).then(() => sibling, () => path.join(ROOT, 'zz2'));
    const snapshot = await mkdtemp(path.join(os.tmpdir(), 'friend-unlock-'));
    t.after(() => rm(snapshot, { recursive: true, force: true }));
    await promoteSharedUnlock({ source, snapshot });
    const shipped = await walk(snapshot);
    for (const file of SHARED_UNLOCK_FILES) assert.ok(shipped.includes(file), `missing ${file}`);
    assert.deepEqual(shipped, [...SHARED_UNLOCK_FILES, ...SETTINGS_UI_FILES].sort());
    assert.deepEqual(shipped, await walk(path.join(SNAPSHOTS, 'unlock')));
    assert.match(await readFile(path.join(snapshot, 'sw.js'), 'utf8'), /'friend-unlock-shell-'/);
  });

  await t.test('KAIROS friend build starts in landscape', async () => {
    const { dir } = await build('kairos', temp);
    assert.match(await readFile(path.join(dir, 'app.js'), 'utf8'), /let uiMode="landscape"/);
    assert.match(await readFile(path.join(dir, 'index.html'), 'utf8'), /<main id="shell" data-ui-mode="landscape">/);
  });
});

test('stripLocalPreview removes the marked line, and the old inline block as a fallback', () => {
  const marked = "a();\n\nawait import('./local-preview.js').catch(() => {}); // local-preview-hook\nb();\n";
  assert.deepEqual(stripLocalPreview(marked), { text: 'a();\nb();\n', path: 'marker' });
  const inline = "a();\nconst localSettingsHost = typeof location !== 'undefined' && true;\nif (localSettingsHost && x) {\n  y();\n  document.documentElement.dataset.localSettingsReady = 'true';\n}\nb();\n";
  assert.deepEqual(stripLocalPreview(inline), { text: 'a();\nb();\n', path: 'inline' });
  assert.deepEqual(stripLocalPreview('plain();\n'), { text: 'plain();\n', path: 'none' });
});

test('friendCacheName drops owner-only tokens and keeps the family prefix', () => {
  const sw = "const CACHE_PREFIX = 'x-shell-' + s + '-';\nconst CACHE_NAME = CACHE_PREFIX + 'v1-local-preview-1-a-1-local-preview-module-1';\n";
  assert.match(friendCacheName(sw, '-distribution'), /CACHE_PREFIX \+ 'v1-a-1-distribution'/);
  assert.match(friendCacheName(sw), /CACHE_PREFIX = 'x-shell-'/);
});
