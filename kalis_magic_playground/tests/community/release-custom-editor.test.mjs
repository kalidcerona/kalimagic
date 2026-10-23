import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// RELEASE live editor (settings-ui profile.editor): pure math and profile wiring.
const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = read('zz2/settings-ui.js');
const html = read('zz2/index.html');
const sandbox = {};
vm.runInContext(source, vm.createContext(sandbox));
const ui = sandbox.MagicSettingsUI;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('clampStep rounds to the step, clamps to the range and never returns -0', () => {
  assert.equal(ui.clampStep(3.26, [-30, 30], 0.5), 3.5);
  assert.equal(ui.clampStep(-0.2, [-30, 30], 0.5), 0);
  assert.ok(!Object.is(ui.clampStep(-0.2, [-30, 30], 0.5), -0));
  assert.equal(ui.clampStep(99, [-30, 30], 0.5), 30);
  assert.equal(ui.clampStep(-99, [-30, 30], 0.5), -30);
  assert.equal(ui.clampStep(101.4, [50, 160], 1), 101);
});

test('dragValue maps preview pixels to real viewport percent and clamps', () => {
  const viewport = { width: 412, height: 915 };
  const limits = ui.limitsFor(ui.profiles.unlock, 'part');
  // 60 preview px at fit 0.5 = 120 real px = 13.1% of 915 -> 13 at 0.5 steps.
  assert.deepEqual(plain(ui.dragValue({ x: 0, offset: 0 }, { x: 0, y: 60 }, viewport, 0.5, limits, 0.5)), { x: 0, offset: 13 });
  // 41.2 preview px at fit 1 = 10% of the width, added to the start value.
  assert.deepEqual(plain(ui.dragValue({ x: 2, offset: -1 }, { x: -41.2, y: 0 }, viewport, 1, limits, 0.5)), { x: -8, offset: -1 });
  // Far drags stop at the profile limits.
  assert.deepEqual(plain(ui.dragValue({ x: 0, offset: 0 }, { x: 5000, y: -5000 }, viewport, 0.5, limits, 0.5)), { x: 30, offset: -30 });
  // A zero or missing fit is treated as 1, never as a division by zero.
  assert.deepEqual(plain(ui.dragValue({ x: 0, offset: 0 }, { x: 41.2, y: 0 }, viewport, 0, limits, 0.5)), { x: 10, offset: 0 });
});

test('historyPush coalesces a burst of the same change and caps the stack', () => {
  let stack = [];
  stack = ui.historyPush(stack, { snapshot: 'a', key: 'step:x', at: 0 }, 3, 1200);
  stack = ui.historyPush(stack, { snapshot: 'b', key: 'step:x', at: 500 }, 3, 1200);
  stack = ui.historyPush(stack, { snapshot: 'c', key: 'step:x', at: 1600 }, 3, 1200);
  assert.equal(stack.length, 1, 'taps within the window from the last tap share one step');
  assert.equal(stack[0].snapshot, 'a', 'the oldest snapshot is the undo target');
  stack = ui.historyPush(stack, { snapshot: 'd', key: 'step:x', at: 4000 }, 3, 1200);
  stack = ui.historyPush(stack, { snapshot: 'e', key: null, at: 4100 }, 3, 1200);
  stack = ui.historyPush(stack, { snapshot: 'f', key: null, at: 4200 }, 3, 1200);
  assert.deepEqual(stack.map((entry) => entry.snapshot), ['d', 'e', 'f'], 'keyless entries never merge and the cap drops the oldest');
  const before = stack.slice();
  ui.historyPush(stack, { snapshot: 'g', key: null, at: 5000 }, 3, 1200);
  assert.deepEqual(stack, before, 'the input stack is not mutated');
});

test('classifyPointer: small movement is a tap, larger is a drag', () => {
  assert.equal(ui.classifyPointer(3, 4, 6), 'tap');
  assert.equal(ui.classifyPointer(0, 6, 6), 'drag');
  assert.equal(ui.classifyPointer(-5, -5), 'drag');
});

test('unlock opts into wider ranges; saved values from the old ranges load unchanged', () => {
  const unlock = ui.profiles.unlock;
  const legacy = { scale: 96, offset: -3, x: 2, labels: { '#prompt': '암호' }, parts: { '#keypad': { scale: 110, offset: -4, x: 1 }, '#prompt': { scale: 90, offset: 2, x: 0 } } };
  assert.deepEqual(plain(ui.sanitize(legacy, unlock)), legacy);
  const wide = ui.sanitize({ scale: 200, offset: -50, parts: { '#oneui-bar': { scale: 40, offset: 25, x: -31 } } }, unlock);
  assert.equal(wide.scale, 160);
  assert.equal(wide.offset, -30);
  assert.deepEqual(plain(wide.parts['#oneui-bar']), { scale: 50, offset: 25, x: -30 });
});

test('other apps keep the classic ranges and no editor', () => {
  const stopwatch = ui.profiles.stopwatch;
  assert.equal(stopwatch.editor, undefined);
  const value = ui.sanitize({ scale: 200, offset: 20, parts: { '#p-buttons': { scale: 200, offset: 20, x: -20 } } }, stopwatch);
  assert.equal(value.scale, 140);
  assert.equal(value.offset, 12);
  assert.deepEqual(plain(value.parts['#p-buttons']), { scale: 130, offset: 8, x: -8 });
  for (const [name, profile] of Object.entries(ui.profiles)) if (name !== 'unlock') assert.equal(profile.editor, undefined, name);
});

test('editor screens and parts point at real RELEASE elements', () => {
  const editor = ui.profiles.unlock.editor;
  assert.deepEqual(plain(editor.screens.map((screen) => screen.id)), ['pin', 'rewind', 'home1', 'home2']);
  for (const screen of editor.screens) assert.match(html, new RegExp(`id="${screen.preview.slice(1)}"`), screen.preview);
  const parts = ui.profiles.unlock.parts.filter((part) => part.screen);
  assert.ok(parts.length >= 10);
  for (const part of parts) {
    const id = part.selector.match(/#([\w-]+)/)[1];
    assert.match(html, new RegExp(`id="${id}"`), part.selector);
    assert.ok(editor.screens.some((screen) => screen.id === part.screen), part.selector);
  }
  // The rewind digit grid and the PIN screen itself are never draggable: their geometry is the trick's input.
  for (const forbidden of ['#time-black', '#rewind-digit-guide', '#input-screen', '#time-lock', '#unlocked-screen']) assert.ok(!parts.some((part) => part.selector === forbidden), forbidden);
});

test('RELEASE customization is on for the personal build and the friend build', () => {
  assert.equal(ui.customizationAllowed('/zz2/', undefined), true);
  assert.equal(ui.customizationAllowed('/tools/release/', undefined), true);
  assert.equal(ui.customizationAllowed('/tools/unlock/', undefined), true);
  assert.equal(ui.customizationAllowed('/distribution-snapshots/unlock/', undefined), true);
  assert.equal(ui.customizationAllowed('/tools/release/', 'off'), false);
  assert.equal(ui.customizationAllowed('/tools/kairos/', undefined), false);
});

test('the editor never uses browser dialogs or range sliders', () => {
  const start = source.indexOf('/* Live editor (profile.editor)');
  const end = source.indexOf("var actions = node('div', null, 'magic-appearance-actions')");
  assert.ok(start > 0 && end > start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /\b(?:confirm|alert|prompt)\s*\(/);
  assert.doesNotMatch(block, /'range'/);
  assert.match(block, /한 번 더 누르면 전체 초기화/);
  assert.match(block, /이 기기에 자동 저장됨/);
  assert.doesNotMatch(block, /[—~]/);
});

test('layout presets: applying replaces only owned items, keeps keypad/labels, sets the style variant', () => {
  const unlock = ui.profiles.unlock;
  const presets = unlock.editor.presets;
  const ids = plain(presets.list.map((preset) => preset.id));
  assert.deepEqual(ids, ['oneui9', 'oneui85', 'default']);
  const start = ui.sanitize({ scale: 120, offset: 3, x: 0, labels: { '#prompt': '암호' }, parts: { '#keypad': { scale: 90, offset: 2, x: 0 }, '#fingerprint': { scale: 130, offset: 4, x: 1 } } }, unlock);
  const v85 = plain(ui.sanitize(ui.applyPreset(start, presets, 'oneui85'), unlock));
  assert.equal(v85.style, 'oneui85');
  assert.equal(v85.preset, 'oneui85');
  assert.deepEqual(v85.parts['#keypad'], { scale: 90, offset: 2, x: 0 }, 'keypad is not owned by presets');
  assert.deepEqual(v85.labels, { '#prompt': '암호' }, 'labels are untouched');
  assert.deepEqual([v85.scale, v85.offset, v85.x], [100, 0, 0], 'owned target returns to the preset value');
  assert.deepEqual(v85.parts['#fingerprint'], { scale: 115, offset: -5, x: 0 });
  assert.equal(ui.matchPreset(v85, presets), 'oneui85');
  const v9 = plain(ui.sanitize(ui.applyPreset(v85, presets, 'oneui9'), unlock));
  assert.equal(v9.style, undefined, 'One UI 9.0 is the default look: no style variant');
  assert.equal(v9.parts['#fingerprint'], undefined, 'items at 100/0/0 are removed, not stored');
  assert.equal(ui.matchPreset(v9, presets), 'oneui9');
  const back = plain(ui.sanitize(ui.applyPreset(v9, presets, 'default'), unlock));
  assert.equal(ui.matchPreset(back, presets), 'default');
  assert.deepEqual(back.parts, { '#keypad': { scale: 90, offset: 2, x: 0 } });
  assert.equal(ui.applyPreset(start, presets, 'nope'), start, 'unknown preset is a no-op');
});

test('layout presets: every preset value is inside the editor limits and on the step grid', () => {
  const unlock = ui.profiles.unlock;
  const { owns, list } = unlock.editor.presets;
  for (const preset of list) {
    for (const [key, value] of Object.entries(preset.values)) {
      assert.ok(owns.includes(key), `${preset.id} sets an owned item ${key}`);
      const limits = ui.limitsFor(unlock, key === 'target' ? 'target' : 'part');
      for (const field of ['scale', 'offset', 'x']) {
        const step = field === 'scale' ? 1 : 0.5;
        assert.equal(ui.clampStep(value[field], limits[field], step), value[field], `${preset.id} ${key}.${field}`);
      }
    }
  }
});

test('layout presets: any owned edit makes the preset read as edited, undo snapshot restores it', () => {
  const unlock = ui.profiles.unlock;
  const presets = unlock.editor.presets;
  const applied = ui.sanitize(ui.applyPreset(ui.sanitize(null, unlock), presets, 'oneui9'), unlock);
  let history = ui.historyPush([], { snapshot: JSON.stringify(applied), key: null, at: 0 }, 50, 1200);
  const edited = ui.sanitize({ ...plain(applied), parts: { ...plain(applied).parts, '#time-date': { scale: 104, offset: 0.5, x: 0 } } }, unlock);
  assert.equal(ui.matchPreset(edited, presets), '', 'no preset matches after an owned edit');
  assert.equal(edited.preset, 'oneui9', 'the last applied preset is remembered for the edited label');
  const keypadOnly = ui.sanitize({ ...plain(applied), parts: { ...plain(applied).parts, '#keypad': { scale: 80, offset: 0, x: 0 } } }, unlock);
  assert.equal(ui.matchPreset(keypadOnly, presets), 'oneui9', 'non-owned edits keep the preset active');
  const restored = ui.sanitize(JSON.parse(history[history.length - 1].snapshot), unlock);
  assert.equal(ui.matchPreset(restored, presets), 'oneui9');
  history = history.slice(0, -1);
  assert.equal(history.length, 0);
});

test('layout presets: saved preset and style survive sanitize; junk values and other profiles drop them', () => {
  const unlock = ui.profiles.unlock;
  const kept = plain(ui.sanitize({ preset: 'oneui85', style: 'oneui85' }, unlock));
  assert.equal(kept.preset, 'oneui85');
  assert.equal(kept.style, 'oneui85');
  const junk = plain(ui.sanitize({ preset: 'x', style: '<b>' }, unlock));
  assert.equal('preset' in junk, false);
  assert.equal('style' in junk, false);
  assert.deepEqual(Object.keys(plain(ui.sanitize(null, unlock))).sort(), ['labels', 'offset', 'parts', 'scale', 'x'], 'fresh values gain no new keys');
  const other = plain(ui.sanitize({ preset: 'oneui85', style: 'oneui85' }, ui.profiles.stopwatch));
  assert.equal('style' in other, false, 'apps without presets never store a style');
});

test('One UI 8.5 style variant lives under the preset class in personal and friend RELEASE', () => {
  assert.match(html, /#time-lock\.galaxy\.magic-style-oneui85 #time-face \{ top: 16%; flex-direction: column; \}/);
  assert.match(html, /#time-lock\.galaxy\.magic-style-oneui85 #time-clock \{[^}]*font-weight: 400;/);
  const css = read('zz2/settings-ui.css');
  assert.match(css, /@media \(orientation:landscape\) and \(max-height:540px\)/, 'phones in landscape get the rotate hint');
  const dist = read('distribution-snapshots/unlock/index.html');
  assert.match(dist, /#time-lock\.galaxy\.magic-style-oneui85 #time-face \{ top: 16%; flex-direction: column; \}/);
  assert.match(dist, /#time-lock\.galaxy\.magic-style-oneui85 #time-clock \{[^}]*font-weight: 400;/);
});
