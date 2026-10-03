import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../zz11/style.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../zz11/app.js', import.meta.url), 'utf8');

function px(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)px`));
  assert.ok(match, name);
  return Number(match[1]);
}

const frame = px('frame-inner');
const rim = px('rim-out');
const gutter = px('felt-gutter');
const cap = px('wheel-cap');
const railTop = px('rail-top-extra');
const railBottom = px('rail-bottom-extra');

function ringBox(width, height, safe) {
  const side = Math.max(safe.left, safe.right);
  const areaH = height - (Math.max(32, safe.top) + railTop) - (safe.bottom + railBottom);
  return Math.min(
    width - side * 2 - frame * 2 - gutter * 2 - rim * 2,
    areaH - gutter * 2 - rim * 2,
    cap,
  );
}

test('TYCHE wheel rings stay inside the safe inner felt on portrait widths', () => {
  assert.equal(frame, 19);
  assert.equal(rim, 10);
  assert.equal(gutter, 12);
  assert.match(css, /--side-safe:\s*max\(env\(safe-area-inset-left/);
  assert.match(css, /width:\s*var\(--ring-box\)/);
  assert.match(css, /width:\s*calc\(var\(--ring-box\) \* 90 \/ 93\)/);
  assert.doesNotMatch(css, /transform:\s*scale\(/);
  assert.match(app, /getBoundingClientRect\(\)/);
  assert.match(app, /box\.left \+ box\.width \/ 2/);
  assert.doesNotMatch(css, /iPhone|Galaxy|SM-/);
  for (const width of [280, 320, 390, 480, 690, 768, 1032]) {
    for (const height of [Math.round(width * 1.45), Math.round(width * 2.05)]) {
      for (const safe of [
        { top: 0, right: 0, bottom: 0, left: 0 },
        { top: 47, right: 0, bottom: 34, left: 0 },
        { top: 0, right: 47, bottom: 21, left: 0 },
      ]) {
        const ring = ringBox(width, height, safe);
        assert.ok(ring > 80, `${width}x${height} ring ${ring}`);
        const visual = ring + rim * 2;
        const center = width / 2;
        const left = center - visual / 2;
        const right = center + visual / 2;
        const innerLeft = safe.left + frame + gutter;
        const innerRight = width - safe.right - frame - gutter;
        assert.ok(left >= innerLeft - 0.01, `left ${left} inner ${innerLeft}`);
        assert.ok(right <= innerRight + 0.01, `right ${right} inner ${innerRight}`);
        const areaTop = Math.max(32, safe.top) + railTop;
        const areaH = height - areaTop - (safe.bottom + railBottom);
        const circleTop = areaTop + (areaH - visual) / 2;
        const circleBottom = circleTop + visual;
        assert.ok(circleTop >= Math.max(32, safe.top) + frame + gutter - 0.01);
        assert.ok(circleBottom <= height - safe.bottom - frame - gutter + 0.01);
      }
    }
  }
});

test('TYCHE felt starts below the status inset and both casino themes remain', () => {
  assert.match(css, /\.stage \{[\s\S]*?background-color:\s*#1a1512;\s*background-image:\s*none;/);
  assert.match(css, /\.nap \{[\s\S]*?top:\s*var\(--table-safe-top\)/);
  assert.match(css, /--table-safe-top:\s*max\(32px, env\(safe-area-inset-top/);
  assert.match(css, /felt-emerald\.svg/);
  assert.match(css, /felt-burgundy\.svg/);
  assert.match(css, /data-table-theme="burgundy"/);
  assert.match(css, /\.cushion \{[\s\S]*?var\(--table-safe-top\)/);
  assert.match(css, /\.brass-lip \{[\s\S]*?var\(--table-safe-top\)/);
  assert.match(css, /\.sight-a:not\(\.is-acknowledged\), \.sight-b:not\(\.is-acknowledged\)/);
});
