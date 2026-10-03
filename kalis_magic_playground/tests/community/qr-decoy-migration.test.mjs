import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../../zz13/core.mjs';

vm.runInThisContext(fs.readFileSync(new URL('../../zz13/vendor/qrcodegen.js', import.meta.url), 'utf8'));
const decoderContext = { module: { exports: {} }, exports: {}, Uint8ClampedArray };
vm.runInNewContext(fs.readFileSync(new URL('../../zz13/vendor/jsQR.js', import.meta.url), 'utf8'), decoderContext);
globalThis.jsQR = decoderContext.module.exports;

const PREVIOUS = [
  'https://www.ikea.com/kr/ko/',
  'https://www.instagram.com/p/CARmsi2HRlV/',
  'https://www.youtube.com/',
  'https://thirtymall.com/',
  'https://www.penguinmagic.com/',
  'https://cafe.naver.com/conjuring',
  'https://www.naver.com/',
  'https://music.youtube.com/',
];
const ADDED = [
  'https://www.ikea.com/',
  'https://bbq.co.kr/',
  'https://www.musinsa.com/',
  'https://www.kyobobook.co.kr/',
  'https://ridibooks.com/',
  'https://www.apple.com/kr/',
  'https://www.ebay.co.uk/',
  'https://www.amazon.com/',
  'https://www.samsung.com/',
];

test('default decoys keep the previous list and add the nine new urls', () => {
  assert.equal(core.DEFAULTS_REVISION, 3);
  assert.deepEqual(core.DEFAULTS.decoys.slice(0, PREVIOUS.length), PREVIOUS);
  assert.deepEqual(core.DEFAULTS.decoys.slice(PREVIOUS.length), ADDED);
  assert.equal(core.DEFAULTS.target, 'https://lnmagic.co.kr/');
  const html = fs.readFileSync(new URL('../../zz13/index.html', import.meta.url), 'utf8');
  assert.match(html, /<h1 class="apptitle">QR 코드<br>랜덤 생성기<\/h1>/);
  assert.match(html, /id="generate"/);
  assert.match(html, /id="png" disabled/);
});

test('revision migration extends untouched default decoys and leaves custom ones', () => {
  const extended = core.migrateDefaults({
    target: 'https://example.com/kept',
    ordinal: 9,
    dot: 110,
    extraTargets: [{ ordinal: 3, target: 'https://example.com/extra' }],
    decoys: PREVIOUS.slice(),
  }, 2);
  assert.equal(extended.target, 'https://example.com/kept');
  assert.equal(extended.ordinal, 9);
  assert.equal(extended.dot, 110);
  assert.deepEqual(extended.extraTargets, [{ ordinal: 3, target: 'https://example.com/extra' }]);
  assert.deepEqual(extended.decoys, [...PREVIOUS, ...ADDED]);

  const custom = {
    target: 'https://example.com/kept',
    ordinal: 9,
    dot: 105,
    extraTargets: [],
    decoys: ['https://example.com/mine'],
  };
  assert.deepEqual(core.migrateDefaults(custom, 2), custom);
  assert.deepEqual(core.migrateDefaults({ ...custom, decoys: [...PREVIOUS].reverse() }, 1).decoys, [...PREVIOUS].reverse());
});

test('pasted decoy controls are stripped by line and stored arrays are not repaired', () => {
  const parsed = core.settings({
    target: 'https://example.com/',
    ordinal: 1,
    dot: 100,
    decoys: '\u0000https://www.ikea.com/\u0007\nhttps://bbq.co.kr/\r',
  });
  assert.deepEqual(parsed.decoys, ['https://www.ikea.com/', 'https://bbq.co.kr/']);
  const raw = JSON.stringify({
    schema: 1,
    defaultsRevision: 3,
    counter: 2,
    frozen: false,
    config: {
      target: 'https://example.com/\u0000secret',
      ordinal: 4,
      dot: 100,
      extraTargets: [],
      decoys: ['https://example.com/\u0001kept'],
    },
    bag: [],
    last: null,
  });
  const restored = core.restore(raw);
  assert.equal(restored.config.target, 'https://example.com/\u0000secret');
  assert.deepEqual(restored.config.decoys, ['https://example.com/\u0001kept']);
  assert.equal(restored.counter, 2);
  assert.throws(() => core.restore('{'), /JSON|Unexpected|Invalid/);
  assert.throws(() => core.settings({ target: 'javascript:alert(1)', ordinal: 1, dot: 100, decoys: [] }));
});

test('extending default decoys keeps the current edit, counter, and bag', () => {
  const config = core.settings({
    target: 'https://example.com/kept-target',
    ordinal: 7,
    dot: 110,
    extraTargets: [{ ordinal: 3, target: 'https://example.com/extra' }],
    decoys: PREVIOUS,
  });
  const state = { config, counter: 0, frozen: false, current: null, bag: [], last: null };
  assert.equal(core.next(state, () => 0), true);
  let edited = false;
  for (let y = state.current.size - 1; y >= 0 && !edited; y -= 1) {
    for (let x = state.current.size - 1; x >= 0 && !edited; x -= 1) {
      if (state.current.meta.map[y][x]) edited = core.toggle(state.current, x, y).ok;
    }
  }
  assert.equal(edited, true);
  state.counter = 4;
  state.bag = ['https://www.youtube.com/'];
  state.last = 'https://www.naver.com/';
  const saved = JSON.parse(core.serialize(state));
  saved.defaultsRevision = 2;
  saved.config.decoys = PREVIOUS.slice();
  const nextState = core.restore(JSON.stringify(saved));
  assert.equal(nextState.config.target, 'https://example.com/kept-target');
  assert.equal(nextState.config.ordinal, 7);
  assert.equal(nextState.config.dot, 110);
  assert.deepEqual(nextState.config.extraTargets, [{ ordinal: 3, target: 'https://example.com/extra' }]);
  assert.deepEqual(nextState.config.decoys, [...PREVIOUS, ...ADDED]);
  assert.equal(nextState.counter, 4);
  assert.deepEqual(nextState.bag, ['https://www.youtube.com/']);
  assert.equal(nextState.last, 'https://www.naver.com/');
  assert.equal(nextState.current.edits.size, 1);
  assert.equal(core.decode(nextState.current), nextState.current.payload);
});
