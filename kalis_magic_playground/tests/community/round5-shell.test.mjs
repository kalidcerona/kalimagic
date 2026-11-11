import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { TABATA_FILES, URAMICHI_FILES, SPINNER_FILES, MEMDECK_FILES, QR_FILES, PIMAX_FILES, MIRROR_PAIRS, preparePimaxRuntime } from '../../scripts/build-public.mjs';

const lists = { TabataTimer: TABATA_FILES, zz15: URAMICHI_FILES, zz11: [...SPINNER_FILES, 'settings-ui.js', 'settings-ui.css', 'local-preview.js', 'brand-logo.png'], zz12: [...MEMDECK_FILES, 'local-preview.mjs'], zz13: [...QR_FILES, 'local-preview.mjs'], zz14: PIMAX_FILES };
const changed = ['zz2', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11', 'zz12', 'zz13', 'zz14', 'zz15', 'TabataTimer', 'KanameCue'];
for (const app of changed) test(`${app}: every offline module and startup import is present in its deployment`, () => {
  const root = new URL(`../../${app}/`, import.meta.url);
  const context = { URL, self: { registration: { scope: `https://example.test/${app}/` }, addEventListener() {} } };
  vm.runInNewContext(readFileSync(new URL('sw.js', root), 'utf8') + '\nglobalThis.shell = SHELL;', context);
  const shell = new Set(context.shell.map(file => file === './' ? 'index.html' : file.replace(/^\.\//, '')));
  for (const file of shell) {
    assert.ok(existsSync(new URL(file, root)), `${app}/${file}`);
    if (lists[app]) assert.ok(lists[app].includes(file), `${app}/${file} is deploy-allowed`);
    if (!/\.(?:m?js|html)$/.test(file)) continue;
    const raw = readFileSync(new URL(file, root), 'utf8');
    const source = app === 'zz14' && file === 'app.mjs' ? preparePimaxRuntime(raw) : raw;
    const imports = file.endsWith('.html') ? [...source.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)] : [...source.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+)["']/g)];
    for (const [, ref] of imports) {
      const target = new URL(ref, new URL(file, root));
      assert.ok(shell.has(target.pathname.slice(root.pathname.length)), `${app}/${file} imports uncached ${ref}`);
    }
  }
});
test('new module mirror destinations are unique and Pi Max never deploys its development preview', () => {
  const targets = MIRROR_PAIRS.map(([, target]) => target).filter(target => /^zz(?:11|12|13)\//.test(target) && !target.endsWith('/update-prompt.js'));
  // Existing shared update-prompt mappings predate this round; only feature mappings must be unique.
  assert.equal(new Set(targets).size, targets.length);
  assert.ok(!PIMAX_FILES.includes('local-preview.mjs'));
});
