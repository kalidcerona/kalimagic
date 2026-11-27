import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('build rejects an incomplete release before deleting the previous dist', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pin-preflight-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const item of ['scripts', 'zz-migration', 'netlify', 'member-policy-config.mjs']) {
    await cp(new URL(`../../${item}`, import.meta.url), path.join(root, item), { recursive: true });
  }
  const gameEntry = 'distribution-snapshots/magicshow/index.html';
  await mkdir(path.dirname(path.join(root, gameEntry)), { recursive: true });
  await cp(new URL(`../../${gameEntry}`, import.meta.url), path.join(root, gameEntry));
  await mkdir(path.join(root, 'dist'));
  const sentinel = path.join(root, 'dist/keep');
  await writeFile(sentinel, 'previous build');
  await assert.rejects(promisify(execFile)(process.execPath, ['scripts/build-public.mjs'], { cwd: root }),
    error => error.code === 1 && /ENOENT.*distribution-snapshots\/aletheia/.test(error.stderr));
  assert.equal(await readFile(sentinel, 'utf8'), 'previous build');
});
