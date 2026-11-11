import { MIRROR_PAIRS } from '../../scripts/build-public.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../zz11/', import.meta.url);
const source = (name) => readFileSync(new URL(name, root), 'utf8');

test('spinner live announcements stay visually clipped in both screen designs', () => {
  assert.match(source('index.html'), /id="spin-status" class="spin-status spin-status-accessible" aria-live="polite"/);
  const rule = source('style-casino.css').match(/#spin-status\.spin-status-accessible\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule);
  for (const declaration of ['position: absolute', 'width: 1px', 'height: 1px', 'overflow: hidden', 'clip-path: inset(50%)']) {
    assert.ok(rule.includes(`${declaration} !important`), declaration);
  }
  const html = source('index.html');
  assert.match(html, /href="\.\/style-casino.css"/);
  assert.match(source('spin.js'), /showStatus\('회전 중…'\)/);
});

test('spinner startup modules have shell and mirror entries and byte-identical source copies', () => {
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const code = source(file);
    assert.ok(source('sw.js').includes(`"./${file}"`), `${file} is precached`);
    assert.equal(code, readFileSync(new URL(`../../../../magic-spinner/${file}`, import.meta.url), 'utf8'));
    for (const match of code.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) visit(match[1]);
  }
  visit('app.js');
  for (const file of ['spin.js', 'theme.js', 'wake-lock.js', 'settings-gesture.js', 'install.js']) {
    assert.ok(visited.has(file), file);
    assert.ok(MIRROR_PAIRS.some(([source, target]) => source === `../../magic-spinner/${file}` && target === `zz11/${file}`), file);
  }
});
