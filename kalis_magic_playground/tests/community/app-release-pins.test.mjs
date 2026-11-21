import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { APP_PIN_FILE, createAppReleasePins, verifyAppRelease } from '../../scripts/app-release-pins.mjs';
import { APP_RELEASE_ROOTS, PUBLIC_DIRS, DISTRIBUTION_APPS } from '../../scripts/build-public.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'app-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'zz1/sub'), { recursive: true });
  await mkdir(path.join(root, 'scripts'));
  await writeFile(path.join(root, 'zz1/index.html'), '<head></head><body>retained</body>');
  await writeFile(path.join(root, 'zz1/sub/runtime.js'), 'const version = "retained";');
  const options = { root, requiredRoots: ['zz1'] };
  const pins = await createAppReleasePins({ ...options, release: 'retained-test-v1' });
  const save = value => writeFile(path.join(root, APP_PIN_FILE), JSON.stringify(value));
  await save(pins);
  return { ...options, pins, save };
}

test('selected release verifies without sibling masters and candidates are deterministic', async t => {
  const f = await fixture(t);
  assert.deepEqual(await verifyAppRelease(f), { release: 'retained-test-v1', roots: 1, files: 2 });
  assert.deepEqual(await createAppReleasePins({ ...f, release: f.pins.release }), f.pins);
  const before = await readFile(path.join(f.root, APP_PIN_FILE));
  await verifyAppRelease(f);
  assert.deepEqual(await readFile(path.join(f.root, APP_PIN_FILE)), before);
});

for (const mutation of ['change', 'missing', 'extra', 'empty-directory', 'file-link', 'directory-link', 'ancestor-link', 'manifest-link']) {
  test(`rejects ${mutation} without modifying output`, async t => {
    const f = await fixture(t);
    await mkdir(path.join(f.root, 'dist'));
    const sentinel = path.join(f.root, 'dist/keep');
    await writeFile(sentinel, 'last usable artifact');
    const file = path.join(f.root, 'zz1/sub/runtime.js');
    if (mutation === 'change') await writeFile(file, 'const version = "changed";');
    if (mutation === 'missing') await rm(file);
    if (mutation === 'extra') await writeFile(path.join(f.root, 'zz1/new.mjs'), 'unexpected');
    if (mutation === 'empty-directory') await mkdir(path.join(f.root, 'zz1/new'));
    if (mutation === 'file-link') { await rm(file); await symlink('../index.html', file); }
    if (mutation === 'directory-link') { await rm(path.join(f.root, 'zz1/sub'), { recursive: true }); await symlink('../scripts', path.join(f.root, 'zz1/sub')); }
    if (mutation === 'ancestor-link') {
      await mkdir(path.join(f.root, 'real')); await symlink('real', path.join(f.root, 'alias'));
      f.requiredRoots = ['alias/app']; await mkdir(path.join(f.root, 'real/app'));
      await f.save({ ...f.pins, roots: f.requiredRoots });
    }
    if (mutation === 'manifest-link') {
      await writeFile(path.join(f.root, 'pins.json'), JSON.stringify(f.pins));
      await rm(path.join(f.root, APP_PIN_FILE)); await symlink('../pins.json', path.join(f.root, APP_PIN_FILE));
    }
    await assert.rejects(verifyAppRelease(f));
    assert.equal(await readFile(sentinel, 'utf8'), 'last usable artifact');
  });
}

for (const corruption of ['traversal', 'absolute', 'backslash', 'duplicate', 'out-of-scope', 'hash', 'size', 'root', 'schema', 'omitted', 'unexpected-key']) {
  test(`rejects manifest ${corruption}`, async t => {
    const f = await fixture(t), pins = structuredClone(f.pins);
    if (corruption === 'traversal') pins.entries[0].path = 'zz1/../outside';
    if (corruption === 'absolute') pins.entries[0].path = '/zz1';
    if (corruption === 'backslash') pins.entries[0].path = 'zz1\\outside';
    if (corruption === 'duplicate') pins.entries.push(pins.entries[0]);
    if (corruption === 'out-of-scope') pins.entries[0].path = 'other';
    if (corruption === 'hash') pins.entries.find(e => e.kind === 'file').sha256 = 'bad';
    if (corruption === 'size') pins.entries.find(e => e.kind === 'file').size = -1;
    if (corruption === 'root') pins.roots = [];
    if (corruption === 'schema') pins.schemaVersion = 2;
    if (corruption === 'omitted') pins.entries.pop();
    if (corruption === 'unexpected-key') pins.entries[0].override = true;
    await f.save(pins); await assert.rejects(verifyAppRelease(f));
  });
}

test('retained project inventory covers every selected personal app and distribution snapshot', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const result = await verifyAppRelease({ root, requiredRoots: APP_RELEASE_ROOTS });
  const sources = DISTRIBUTION_APPS.filter(app => !['magicshow', 'planbcafe'].includes(app.target)).map(app => app.source);
  const expected = new Set([...PUBLIC_DIRS.filter(dir => /^zz\d+$/.test(dir)), ...sources]);
  assert.deepEqual([...APP_RELEASE_ROOTS].sort(), [...expected].sort());
  assert.equal(result.roots, 28);
});

test('candidate rejects duplicate and nested roots', async t => {
  const f = await fixture(t);
  for (const requiredRoots of [['zz1', 'zz1'], ['zz1/sub', 'zz1']]) {
    await assert.rejects(createAppReleasePins({ ...f, requiredRoots, release: 'test' }), /overlapping/);
  }
});
