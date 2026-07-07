import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');

test('playground v2 styles append a pg-prefixed table block', () => {
  const marker = '/* ---------- magic playground board v2 pg-prefix ---------- */';
  const index = css.indexOf(marker);
  assert.notEqual(index, -1, 'style.css should contain the playground v2 marker');

  const block = css.slice(index);
  assert.match(block, /\.pg-table/);
  assert.match(block, /\.pg-table-wrap/);
  assert.match(block, /\.pg-notice-row/);
  assert.match(block, /\.pg-prefix--question/);
  assert.match(block, /\.pg-prefix--tool/);
  assert.match(block, /\.pg-prefix--meeting/);
  assert.match(block, /\.pg-prefix--magazine/);
  assert.match(block, /\.pg-empty/);
  assert.match(block, /@media \(max-width: 720px\)/);
  assert.equal(block.includes('.playground-'), false, 'new block should not edit existing playground classes');
});

test('playground v2 styles rely on existing color variables', () => {
  const block = css.slice(css.indexOf('/* ---------- magic playground board v2 pg-prefix ---------- */'));

  for (const variable of [
    '--bg-alt',
    '--card-bg',
    '--text-main',
    '--text-muted',
    '--point-gold',
    '--point-gold-rgb',
    '--point-gold-hover',
    '--border-subtle',
    '--border-light'
  ]) {
    assert.equal(block.includes(`var(${variable}`), true, `${variable} should be used`);
  }
});
