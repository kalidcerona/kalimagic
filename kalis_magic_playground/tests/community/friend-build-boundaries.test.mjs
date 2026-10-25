import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// `npm run test:js` runs every boundary test against the personal zz* app only. Each boundary test can also be
// pointed at a friend snapshot through an environment variable. This file runs those tests against every friend
// snapshot that has one, each in its own child process (one at a time, so a loaded machine does not make the
// real-module flows flaky), and requires exit code 0. The child's output is printed when one fails.
// Friend snapshots without a boundary test yet: magicshow. gwayubulgeup has its own test file (no personal app).
const FRIEND_BUILDS = [
  ['tobira', 'tobira-module-boundaries.test.mjs', 'TOBIRA_ROOT', 'tobira'],
  ['aletheia', 'aletheia-module-boundaries.test.mjs', 'ALETHEIA_ROOT', 'aletheia'],
  ['kairos', 'kairos-module-boundaries.test.mjs', 'KAIROS_ROOT', 'kairos'],
  ['hitsuzen', 'hitsuzen-script-boundaries.test.mjs', 'ZZ3_ROOT', 'calculator'],
  ['release', 'release-module-boundaries.test.mjs', 'RELEASE_ROOT', 'unlock'],
  ['tyche', 'tyche-module-boundaries.test.mjs', 'TYCHE_ROOT', 'spinner'],
  ['qr', 'qr-module-boundaries.test.mjs', 'QR_ROOT', 'qr'],
  ['choice', 'choice-module-boundaries.test.mjs', 'CHOICE_ROOT', 'choice'],
  ['usotsuki', 'usotsuki-module-boundaries.test.mjs', 'USOTSUKI_ROOT', 'usotsuki'],
  ['pimax', 'pimax-module-boundaries.test.mjs', 'PIMAX_ROOT', 'pimax'],
];

for (const [name, file, variable, snapshot] of FRIEND_BUILDS) {
  test(`${name}: ${file} passes against distribution-snapshots/${snapshot}`, () => {
    const testFile = fileURLToPath(new URL(file, import.meta.url));
    const snapshotDir = fileURLToPath(new URL(`../../distribution-snapshots/${snapshot}/`, import.meta.url));
    assert.ok(existsSync(testFile), `${file} exists`);
    assert.ok(existsSync(`${snapshotDir}index.html`), `distribution-snapshots/${snapshot}/index.html exists`);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.endsWith('_ROOT') && !key.startsWith('NODE_TEST')));
    env[variable] = snapshotDir;
    const run = spawnSync(process.execPath, ['--test', testFile], { env, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
    assert.equal(run.status, 0, `${file} with ${variable}=${snapshotDir} exited ${run.status ?? run.signal}\n${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /^ℹ pass [1-9]\d*$/m, 'the child really ran tests');
  });
}
