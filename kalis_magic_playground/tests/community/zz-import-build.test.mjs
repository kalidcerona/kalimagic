import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  injectZzImport,
  transformZzImportRuntime,
  ZZ_IMPORT_TARGETS,
} from '../../scripts/zz-import-build.mjs';
import { DISTRIBUTION_APPS, transformDistributionDocument } from '../../scripts/build-public.mjs';
test('all 15 import destinations gate app reads after the existing access guard', async () => {
  assert.equal(ZZ_IMPORT_TARGETS.length, 15);
  for (const target of ZZ_IMPORT_TARGETS) {
    const app = DISTRIBUTION_APPS.find((app) => app.target === target);
    const html = await readFile(new URL(`../../${app.source}/index.html`, import.meta.url), 'utf8');
    const result = injectZzImport(transformDistributionDocument(html, app), target);
    assert.equal((result.match(/data-zz-bootstrap=/g) || []).length, 1, target);
    assert.match(result, /<script id="friend-apps-check">/, target);
    assert.ok(result.includes('application/x-zz-deferred'), target);
    assert.throws(() => injectZzImport(result, target), /Duplicate/);
    const executable = [...result.matchAll(/<script\b([^>]*)>/g)].filter((match) =>
      !match[1].includes('application/x-zz-deferred')
    );
    assert.equal(executable.length, 2, target);
  }
});
test('unrelated apps are untouched', () =>
  assert.equal(injectZzImport('<body>hello</body>', 'bell'), '<body>hello</body>'));

test('TYCHE resume transform is bounded to verified startup markers', async () => {
  const source = await readFile(
    new URL('../../distribution-snapshots/spinner/app.js', import.meta.url),
    'utf8',
  );
  const transformed = transformZzImportRuntime(source, 'tyche', 'app.js');
  assert.match(transformed, /if \(!globalThis\.zzImportResume\?\.tyche\)/);
  assert.match(transformed, /let needsFirstTouchTarget = !\(globalThis\.zzImportResume\?\.tyche/);
  assert.equal(transformZzImportRuntime(source, 'choice', 'app.js'), source);
  assert.equal(transformZzImportRuntime(source, 'tyche', 'logic.js'), source);
  assert.throws(
    () =>
      transformZzImportRuntime(source.replace('let needsFirstTouchTarget = true;', ''), 'tyche', 'app.js'),
    /boundary changed/,
  );
});
