import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SPLIT_COMMIT, commitAvailable, diffSequences, materializePreSplit, recordStartupListeners,
} from './choice-startup-listeners.mjs';

// The CHOICE module split (83d3caa) moved code verbatim, so the order in which startup listeners register must
// equal the pre-split single-file order. The pre-split build is materialised from git into a temp dir that is
// removed afterwards. In a clone without that commit the comparison cannot run and the test is skipped.
const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const available = commitAvailable(appRoot);

for (const [name, folder] of [['personal zz4', 'zz4'], ['friend snapshot', 'distribution-snapshots/choice']]) {
  test(`CHOICE ${name}: startup listener registration order equals the pre-split build`, { skip: available ? false : `commit ${SPLIT_COMMIT} is not in this clone` }, async () => {
    const before = materializePreSplit(appRoot, folder);
    try {
      let expected = await recordStartupListeners(before.dir);
      let actual = await recordStartupListeners(fileURLToPath(new URL(`../../${folder}/`, import.meta.url)));
      // A friend build has the owner-only preview listener removed on purpose; the personal build must keep it exactly.
      if (folder.startsWith('distribution-snapshots/') && !actual.some((line) => line.includes('| magic-local-settings |'))) {
        expected = expected.filter((line) => !line.includes('| magic-local-settings |'));
      }
      assert.ok(expected.length > 100, `the pre-split boot registered ${expected.length} listeners; the stub browser is too thin`);
      assert.deepEqual(diffSequences(expected, actual), [], 'startup listener order changed (- pre-split, + current)');
      assert.deepEqual(actual, expected);
    } finally {
      before.dispose();
    }
  });
}
