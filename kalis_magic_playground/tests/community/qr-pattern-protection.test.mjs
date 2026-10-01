import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../../zz13/core.mjs';

vm.runInThisContext(fs.readFileSync(new URL('../../zz13/vendor/qrcodegen.js', import.meta.url), 'utf8'));
const decoderContext = { module: { exports: {} }, exports: {}, Uint8ClampedArray };
vm.runInNewContext(fs.readFileSync(new URL('../../zz13/vendor/jsQR.js', import.meta.url), 'utf8'), decoderContext);
globalThis.jsQR = decoderContext.module.exports;

test('finder regions including separator halos and every alignment pattern reject edits', () => {
  const q = core.createQR('https://example.com/', 40, 0);
  for (const [x, y] of [[0, 0], [6, 6], [7, 7], [q.size - 1, 0], [q.size - 8, 7], [0, q.size - 1], [7, q.size - 8]]) {
    const before = { edits: [...q.edits], history: q.history.length };
    assert.deepEqual(core.toggle(q, x, y), { ok: false, reason: 'protected' });
    assert.deepEqual([...q.edits], before.edits);
    assert.equal(q.history.length, before.history);
  }
  for (const version of [1, 4, 7, 40]) {
    const symbol = core.createQR('https://example.com/', version, 0);
    for (const [cx, cy] of core.alignmentCenters(version)) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        assert.deepEqual(core.toggle(symbol, cx + dx, cy + dy), { ok: false, reason: 'protected' });
      }
    }
  }
});

test('restore rejects a stored finder edit; ordinary cells and generation still work', () => {
  const state = { config: core.settings({ target: 'https://example.com/', ordinal: 2, decoys: [] }), counter: 0, frozen: false, current: null, bag: [], last: null };
  assert.equal(state.counter, 0);
  assert.equal(state.current, null);
  assert.equal(core.next(state, () => 0), true);
  assert.equal(state.counter, 1);
  const saved = JSON.parse(core.serialize(state));
  saved.current.edits.push(0);
  assert.throws(() => core.restore(JSON.stringify(saved)), /protected edit/);
  let accepted = false;
  for (let y = state.current.size - 1; y >= 0 && !accepted; y--) for (let x = state.current.size - 1; x >= 0 && !accepted; x--) {
    if (state.current.meta.map[y][x]) accepted = core.toggle(state.current, x, y).ok;
  }
  assert.equal(accepted, true);
  assert.equal(core.decode(state.current), state.current.payload);
});

test('generator controls are present from the empty initial screen', () => {
  const html = fs.readFileSync(new URL('../../zz13/index.html', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../../zz13/app.mjs', import.meta.url), 'utf8');
  for (const id of ['png', 'undo', 'clean']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="png" disabled/);
  assert.match(html, /id="undo" disabled/);
  assert.match(html, /id="clean" disabled/);
  assert.doesNotMatch(html, /id="(?:png|editbar)"[^>]*\shidden/);
  assert.match(app, /\$\('png'\)\.disabled=!q/);
  assert.match(app, /\$\('clean'\)\.disabled=!q\|\|\(!preview&&!q\.edits\.size\)/);
  assert.match(html, /큰 위치 표식과 작은 정렬 표식은 바꿀 수 없습니다/);
});
