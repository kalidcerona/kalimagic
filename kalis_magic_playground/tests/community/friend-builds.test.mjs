import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { FRIEND_APPS } from '../../scripts/friend-config.mjs';
import { friendApps, friendCacheName, generate, stripLocalPreview } from '../../scripts/friend-builds.mjs';
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
