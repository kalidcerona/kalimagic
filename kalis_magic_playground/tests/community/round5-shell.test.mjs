import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { TABATA_FILES, SPINNER_FILES, MEMDECK_FILES, QR_FILES, PIMAX_FILES, preparePimaxRuntime } from '../../scripts/build-public.mjs';

const lists = { TabataTimer: TABATA_FILES };
const changed = ['distribution-snapshots/unlock', 'distribution-snapshots/choice', 'distribution-snapshots/aletheia', 'distribution-snapshots/tobira', 'distribution-snapshots/usotsuki', 'distribution-snapshots/spinner', 'distribution-snapshots/memdeck', 'distribution-snapshots/qr', 'distribution-snapshots/pimax', 'TabataTimer', 'KanameCue'];
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
    const source = app === 'distribution-snapshots/pimax' && file === 'app.mjs' ? preparePimaxRuntime(raw) : raw;
    const imports = file.endsWith('.html') ? [...source.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)] : [...source.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+)["']/g)];
    for (const [, ref] of imports) {
      const target = new URL(ref, new URL(file, root));
      assert.ok(shell.has(target.pathname.slice(root.pathname.length)), `${app}/${file} imports uncached ${ref}`);
    }
  }
});
test('Pi Max never deploys its development preview', () => {
  assert.ok(!PIMAX_FILES.includes('local-preview.mjs'));
});
