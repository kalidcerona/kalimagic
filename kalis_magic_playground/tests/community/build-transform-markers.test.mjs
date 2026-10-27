import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DISTRIBUTION_APPS, transformDistributionDocument, transformKairosScript, injectLegacyShellModules, preparePimaxRuntime,
} from '../../scripts/build-public.mjs';

// build-public.mjs rewrites builds by matching exact text. Each marker must occur exactly once in the source
// and the transform must visibly happen in the output, so a silent no-op cannot ship.
const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const count = (text, needle) => text.split(needle).length - 1;
const GUARDED_APPS = DISTRIBUTION_APPS.filter((app) => app.target !== 'magicshow' && app.target !== 'planbcafe');

test('every friend index.html has exactly one <head> and one <body, and the transform adds the guard', () => {
  for (const app of GUARDED_APPS) {
    const html = read(`${app.source}/index.html`);
    assert.equal(count(html, '<head>'), 1, `${app.target} <head>`);
    assert.equal((html.match(/<body\b/g) || []).length, 1, `${app.target} <body`);
    const out = transformDistributionDocument(html, app);
    assert.equal(count(out, 'id="friend-apps-check"'), 1, `${app.target} guard`);
    assert.match(out, new RegExp(`tools/_check\\?tool=${app.tool}`), `${app.target} guard tool`);
    // RELEASE friends keep the personal editor, so it is the only app without the customize marker.
    assert.equal(out.includes('<body data-magic-customize="off"'), app.target !== 'release', `${app.target} customize marker`);
  }
});

test('a friend document without <head> fails the build instead of shipping without its guard', () => {
  assert.throws(() => transformDistributionDocument('<body></body>', { tool: 'unlock', target: 'release' }), /missing <head>/);
});

test('KAIROS startup hook occurs exactly once in the personal and snapshot app.js and is replaced in the output', () => {
  for (const file of ['zz1/app.js', 'distribution-snapshots/kairos/app.js']) {
    const source = read(file);
    assert.equal(count(source, 'else initApp();'), 1, file);
    for (const target of ['kairos', 'kairos-classic']) {
      const out = transformKairosScript(source, target, 'app.js');
      assert.equal(count(out, 'else initApp();'), 0, `${file} ${target}`);
      assert.match(out, /legacy-storage-migration\.mjs/, `${file} ${target}`);
    }
  }
  assert.throws(() => transformKairosScript('else initApp(); else initApp();', 'kairos', 'app.js'), /missing legacy migration hook/);
});

test('HITSUZEN gets its migration tag from the single <head> of the calculator snapshot', () => {
  const app = DISTRIBUTION_APPS.find((item) => item.target === 'hitsuzen');
  const out = transformDistributionDocument(read(`${app.source}/index.html`), app);
  assert.equal(count(out, 'migrateTrustedLegacyStorage({ target: "hitsuzen"'), 1);
});

test('legacy friend workers have one CACHE_NAME literal and one SHELL array, and the output gains both modules', () => {
  for (const app of DISTRIBUTION_APPS.filter((item) => ['kairos', 'kairos-classic', 'hitsuzen'].includes(item.target))) {
    const source = read(`${app.source}/sw.js`);
    assert.equal(count(source, "const CACHE_NAME = CACHE_PREFIX + '"), 1, `${app.target} CACHE_NAME`);
    assert.equal(count(source, 'const SHELL = ['), 1, `${app.target} SHELL`);
    const out = injectLegacyShellModules(source);
    assert.match(out, /const CACHE_NAME = CACHE_PREFIX \+ '[^']*-legacy-1(?:-distribution)?';/, app.target);
    for (const module of ['./legacy-shared-contract.mjs', './legacy-storage-migration.mjs']) assert.equal(count(out, JSON.stringify(module)), 1, `${app.target} ${module}`);
  }
  assert.throws(() => injectLegacyShellModules("const CACHE_NAME = CACHE_PREFIX + 'v1';"), /SHELL/);
  assert.throws(() => injectLegacyShellModules('const SHELL = [];'), /cache name/);
});

test('Pi Max boot boundary occurs exactly once in the personal and snapshot runtime and the build cuts after it', () => {
  const boundary = 'if (typeof document !== "undefined") boot();\n';
  for (const file of ['zz14/app.mjs', 'distribution-snapshots/pimax/app.mjs']) {
    const source = read(file);
    assert.equal(count(source, boundary), 1, file);
    const out = preparePimaxRuntime(source);
    assert.ok(out.endsWith(boundary), file);
    assert.ok(source.startsWith(out), file);
  }
});
