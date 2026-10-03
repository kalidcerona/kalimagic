import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyPresetSlot,
  formatCs,
  nativeStopwatchRender,
  parseStopwatchText,
  portraitPresetEntryFromCs,
  presetRenderModel,
  resolveStopOutcome,
} from '../../zz1/logic.js';

const page = readFileSync(new URL('../../zz1/index.html', import.meta.url), 'utf8');
const style = page.match(/<style>([\s\S]*?)<\/style>/)[1];
const worker = readFileSync(new URL('../../zz1/sw.js', import.meta.url), 'utf8');

function stopDisplay(customText, elapsed = 3450) {
  const outcome = resolveStopOutcome({
    trickState: 'text',
    customText,
    elapsed,
    reservedTens: 2,
    stopDigit: 8,
  });
  if (outcome.kind === 'text') return presetRenderModel(outcome.text);
  return nativeStopwatchRender(outcome.cs);
}

function geometry(model) {
  return {
    kind: model.kind,
    portraitCells: model.portraitDigits.length,
    landscapeCells: model.landscapeDigits.length,
    portraitTemplate: '00:00.00',
    landscapeTemplate: model.showLandscapeMinutes ? 'MM:SS.CC' : '00:00',
    minutePrefix: model.showLandscapeMinutes,
  };
}

test('00:00 and 00.00 stop on the native templates instead of custom text', () => {
  for (const text of ['00:00', '00.00', '00:00.00', '0:00']) {
    assert.equal(parseStopwatchText(text), 0, text);
    const display = stopDisplay(text, 3450);
    assert.equal(display.kind, 'digits');
    assert.equal(display.value, 0);
    assert.equal(display.portraitDigits, '000000');
    assert.equal(display.landscapeDigits, '0000');
    assert.equal(display.showLandscapeMinutes, false);
    assert.deepEqual(geometry(display), geometry(nativeStopwatchRender(0)));
  }
});

test('12:34 and 12.34 stay 12 seconds plus 34 centiseconds in both templates', () => {
  const expected = nativeStopwatchRender(1234);
  assert.equal(expected.portraitDigits, '001234');
  assert.equal(expected.landscapeDigits, '1234');
  assert.equal(expected.showLandscapeMinutes, false);
  for (const text of ['12:34', '12.34', '00:12.34']) {
    assert.equal(parseStopwatchText(text), 1234, text);
    assert.notEqual(parseStopwatchText(text), 12 * 6000 + 34 * 100);
    const display = stopDisplay(text, 3450);
    assert.deepEqual(display, expected);
    assert.deepEqual(geometry(display), geometry(nativeStopwatchRender(0)));
    assert.deepEqual(geometry(display), geometry(nativeStopwatchRender(Math.floor(12340 / 10))));
  }
  const stored = applyPresetSlot({ kind: 'text', value: '12:34' }, { sequence: [6], trick3Enabled: true });
  assert.equal(stored.customText, '12:34');
  assert.equal(stored.trickState, 'text');
});

test('full MM:SS.CC presets keep minutes and the landscape minute prefix', () => {
  assert.equal(parseStopwatchText('01:23.45'), 1 * 6000 + 23 * 100 + 45);
  const display = stopDisplay('01:23.45', 1000);
  assert.equal(display.kind, 'digits');
  assert.equal(display.portraitDigits, '012345');
  assert.equal(display.landscapeMinutes, '01');
  assert.equal(display.landscapeDigits, '2345');
  assert.equal(display.showLandscapeMinutes, true);
  assert.equal(geometry(display).portraitTemplate, '00:00.00');
  assert.equal(geometry(display).landscapeTemplate, 'MM:SS.CC');
  assert.deepEqual(stopDisplay('99:59.99'), nativeStopwatchRender(99 * 6000 + 59 * 100 + 99));
  assert.equal(nativeStopwatchRender(6000).portraitDigits, '010000');
  assert.equal(nativeStopwatchRender(6000).landscapeDigits, '0000');
  assert.equal(nativeStopwatchRender(5999).showLandscapeMinutes, false);
  assert.equal(nativeStopwatchRender(5999).landscapeDigits, '5999');
});

test('native numeral geometry matches before start, while running, and after a numeric stop', () => {
  const idle = nativeStopwatchRender(0);
  for (let cs = 0; cs < 6000; cs += 50) {
    const running = nativeStopwatchRender(cs);
    const formatted = formatCs(cs);
    assert.equal(running.kind, 'digits');
    assert.equal(running.portraitDigits, portraitPresetEntryFromCs(cs));
    assert.equal(running.landscapeDigits, formatted.sec + formatted.cs);
    assert.equal(running.landscapeMinutes, '');
    assert.deepEqual(geometry(running), geometry(idle));
    assert.equal(running.portraitDigits.slice(2), running.landscapeDigits);
  }
  for (const cs of [6000, 8345, 599999]) {
    const minute = nativeStopwatchRender(cs);
    const entry = portraitPresetEntryFromCs(cs);
    assert.equal(minute.portraitDigits, entry);
    assert.equal(minute.landscapeMinutes + minute.landscapeDigits, entry);
    assert.equal(minute.portraitDigits.length, idle.portraitDigits.length);
    assert.equal(minute.landscapeDigits.length, idle.landscapeDigits.length);
    assert.equal(minute.showLandscapeMinutes, true);
  }
});

test('ordinary text and invalid time-like text stay literal', () => {
  for (const text of ['KALI', '12:3', '12.3', '00:00:00', '1:2', '12:34.5', 'ab:cd', '12-34', '00:0', '99.9', '1234567', '12 : 34', 'MM:SS']) {
    assert.equal(parseStopwatchText(text), null, text);
    assert.deepEqual(presetRenderModel(text), { kind: 'text', text });
    const outcome = resolveStopOutcome({
      trickState: 'text',
      customText: text,
      elapsed: 3450,
      reservedTens: 2,
      stopDigit: 8,
    });
    assert.equal(outcome.kind, 'text');
    assert.equal(outcome.text, text);
    assert.notEqual(stopDisplay(text).kind, 'digits');
  }
});

test('portrait and landscape numeral cells share fixed widths in the page', () => {
  assert.match(page, /data-p-minute="0"/);
  assert.match(page, /data-p-minute="1"/);
  assert.match(page, /data-l-minute="0"/);
  assert.match(page, /data-l-minute="1"/);
  assert.equal(page.match(/data-p-digit="/g).length, 4);
  assert.equal(page.match(/data-l-digit="/g).length, 4);
  const portraitCells = style.match(/\[data-p-digit\], \[data-p-minute\] \{([^}]+)\}/);
  assert.ok(portraitCells);
  assert.match(portraitCells[1], /flex:\s*0 0 0\.56em/);
  assert.match(portraitCells[1], /width:\s*0\.56em/);
  assert.doesNotMatch(style, /#p-minutes\s*\{[^}]*letter-spacing/);
  const landscapeGroups = style.match(/#l-seconds, #l-centiseconds \{([^}]+)\}/);
  const landscapeCells = style.match(/\[data-l-digit\], \[data-l-minute\] \{([^}]+)\}/);
  assert.ok(landscapeGroups);
  assert.ok(landscapeCells);
  assert.match(landscapeGroups[1], /width:\s*2ch/);
  assert.match(landscapeGroups[1], /max-width:\s*2ch/);
  assert.match(landscapeGroups[1], /letter-spacing:\s*0/);
  assert.match(landscapeCells[1], /width:\s*1ch/);
  assert.match(landscapeCells[1], /letter-spacing:\s*0/);
  assert.match(style, /#p-colon \{[^}]*width:\s*0\.22em/);
  assert.match(style, /#l-colon \{[^}]*width:\s*0\.2em/);
  assert.match(style, /#p-decimal \{[^}]*width:\s*0\.20em/);
  assert.match(page, /function renderCs\(totalCs\)\{renderNative\(nativeStopwatchRender\(totalCs\)\);\}/);
  assert.match(page, /presetRenderModel\(text\)/);
  assert.match(page, /if\(model\.kind==="digits"\)\{renderNative\(model\);return;\}/);
  assert.doesNotMatch(page, /pMinutes\.textContent|lMinutesPrefix\.textContent/);
  assert.match(worker, /v20261003-preset-3/);
  assert.doesNotMatch(worker, /v20261003-install-2/);
  assert.match(worker, /async function freshManifest/);
  assert.match(worker, /const GUARDED = new URL\(self\.registration\.scope\)\.pathname\.startsWith\('\/tools\/'\)/);
});
