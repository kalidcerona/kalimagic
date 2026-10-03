import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../zz7/style.css', import.meta.url), 'utf8');

test('거짓말 탐지기 is about 30–36px at 390px and still smaller than the verdict', () => {
  const rule = css.match(/#performance-screen #performance-title \{[^}]*font-size:\s*clamp\(\s*(\d+)px\s*,\s*([\d.]+)vw\s*,\s*(\d+)px\s*\)/);
  assert.ok(rule);
  const min = Number(rule[1]);
  const vw = Number(rule[2]);
  const max = Number(rule[3]);
  const at = (width) => Math.min(max, Math.max(min, width * vw / 100));
  assert.ok(at(390) >= 30 && at(390) <= 36);
  assert.equal(at(280), 30);
  assert.ok(7 * at(280) <= 280 - 24);
  assert.match(css, /#performance-screen #performance-title \{ font-size: 30px; \}/);
  assert.match(css, /#performance-screen #verdict \{[^}]*clamp\(38px, 12vw, 64px\)/);
  assert.match(css, /#performance-screen\[data-display-theme="wine"\]/);
  assert.match(css, /--pub-ground: #102820/);
  assert.match(css, /--pub-ground: #351a22/);
});
