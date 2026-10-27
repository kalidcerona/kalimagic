import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { USOTSUKI_FILES, SPINNER_FILES } from '../../scripts/build-public.mjs';
import { stripLocalPreview, stripInlineLocalPreview, dropUnusedSingleImports } from './local-preview-strip.mjs';
import { usotsukiAppModules, usotsukiAppSource } from './usotsuki-app-script.mjs';
import { readAppStyle } from './app-style.mjs';

const read = (route, file) => file === 'style.css' ? Promise.resolve(Buffer.from(readAppStyle(new URL(`../../${route}/`, import.meta.url)))) : readFile(new URL(`../../${route}/${file}`, import.meta.url));
// USOTSUKI detector.js is an ES module entry with local feature modules; both builds carry the same files.
const detectorFiles = (route) => usotsukiAppModules(fileURLToPath(new URL(`../../${route}/`, import.meta.url)));

// Personal USOTSUKI keeps the localhost preview hook as one marked line plus local-preview.js. The friend snapshot excludes it.
function withoutLocalPreviewHook(source) {
  const stripped = stripLocalPreview(source);
  if (stripped === source) throw new Error('local preview hook was not removed');
  return stripped;
}

// Personal TYCHE adds the update prompt (update-prompt.js); the pinned friend snapshot gets it when it is regenerated.
// Only these exact approved hook lines are removed. Retire this exception when the snapshot is regenerated.
const UPDATE_HOOKS = [
  ['  window.MagicUpdate?.offer(); // settings is off-stage; never offered from the wheel\n', 1, ''],
  ['  window.MagicUpdate?.hide();\n', 2, ''],
  [`    // update-prompt.js registers the worker and may ask to update, only while settings is open.
    if (window.MagicUpdate) window.MagicUpdate.init({ swUrl: './sw.js', checkForUpdate: true, safe: () => !settings.hidden });
    else navigator`, 1, '    navigator'],
];
function withoutUpdatePrompt(source) {
  let stripped = source;
  for (const [hook, count, replacement] of UPDATE_HOOKS) {
    assert.equal(stripped.split(hook).length - 1, count, `approved update hook present ${count}x: ${hook.trim().slice(0, 50)}`);
    stripped = stripped.replaceAll(hook, replacement);
  }
  assert.doesNotMatch(stripped, /MagicUpdate/, 'no other update-prompt change hides in the parity exception');
  return stripped;
}

test('shared USOTSUKI and TYCHE retain the approved personal surfaces and artwork', async () => {
  for (const [personal, snapshot, files] of [
    ['zz7', 'usotsuki', USOTSUKI_FILES.filter(f => /\.css$|^(holdem-assets|recorder-assets)\//.test(f))],
    ['zz11', 'spinner', SPINNER_FILES.filter(f => !/^style-/.test(f) && /\.css$|^(casino-assets|hybrid-assets)\//.test(f))],
  ]) {
    assert.ok(files.length > 3);
    for (const file of files) assert.deepEqual(await read(`distribution-snapshots/${snapshot}`, file), await read(personal, file), `${snapshot}/${file}`);
  }
});

test('shared theme selectors expose the same options as their personal counterparts', async () => {
  for (const [personal, snapshot, id] of [['zz7', 'usotsuki', 'display-theme'], ['zz11', 'spinner', 'table-theme'], ['zz11', 'spinner', 'screen-design']]) {
    const select = new RegExp(`<select[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/select>`);
    const source = (await read(personal, 'index.html')).toString();
    const shared = (await read(`distribution-snapshots/${snapshot}`, 'index.html')).toString();
    assert.ok(source.match(select));
    assert.equal(shared.match(select)?.[0], source.match(select)[0]);
  }
});

test('shared performance code differs only in its explicitly isolated storage keys', async () => {
  assert.deepEqual(detectorFiles('distribution-snapshots/usotsuki'), detectorFiles('zz7'));
  for (const [personal, snapshot, file] of [...detectorFiles('zz7').map((file) => ['zz7', 'usotsuki', file]), ['zz11', 'spinner', 'app.js']]) {
    let source = (await read(personal, file)).toString();
    let shared = (await read(`distribution-snapshots/${snapshot}`, file)).toString();
    if (personal === 'zz7' && file === 'detector.js') {
      assert.match(source, /local-preview/);
      assert.doesNotMatch(shared, /magic-local-settings|local-preview/);
      source = dropUnusedSingleImports(withoutLocalPreviewHook(source));
      shared = dropUnusedSingleImports(shared);
    }
    // The pinned spinner snapshot still carries the old inline hook; the personal app now keeps it in local-preview.js.
    if (personal === 'zz11') source = withoutUpdatePrompt(withoutLocalPreviewHook(source));
    const normalized = (snapshot === 'spinner' ? stripInlineLocalPreview(shared) : shared).replaceAll('usotsuki.distribution.', 'usotsuki.')
      .replaceAll('friend-spinner-state-', 'zz11-spinner-state-')
      .replaceAll('friend-spinner-guide-', 'zz11-guide-')
      .replaceAll('friend-spinner-table-theme-', 'zz11-table-theme-')
      .replaceAll('friend-spinner-screen-design-', 'zz11-screen-design-');
    assert.equal(normalized, source);
  }
});

test('promotion preserves existing shared storage and isolates newly introduced theme preferences', async () => {
  const detector = usotsukiAppSource(fileURLToPath(new URL('../../distribution-snapshots/usotsuki/', import.meta.url)));
  for (const [constant, key] of [
    ['STATE_KEY', 'usotsuki.distribution.detector.v1'],
    ['SOUND_KEY', 'usotsuki.distribution.detector.sound.v1'],
    ['SCAN_DURATION_KEY', 'usotsuki.detector.scan-duration.v1'],
    ['VIBRATION_KEY', 'usotsuki.detector.vibration.v1'],
    ['DISPLAY_THEME_KEY', 'usotsuki.distribution.detector.theme.v1'],
  ]) assert.ok(detector.includes(`${constant} = "${key}"`), constant);
  const spinner = (await read('distribution-snapshots/spinner', 'app.js')).toString();
  for (const key of ['friend-spinner-state-v2', 'friend-spinner-state-v1', 'friend-spinner-guide-seen-v2', 'friend-spinner-table-theme-v1', 'friend-spinner-screen-design-v1']) assert.ok(spinner.includes(key), key);
});


test('USOTSUKI personal and snapshot preserve full HTML bytes and exclude unused assets from deployment', async () => {
  assert.equal((await read('zz7', 'index.html')).toString(), (await read('distribution-snapshots/usotsuki', 'index.html')).toString().replace('usotsuki.distribution.detector.theme.v1', 'usotsuki.detector.theme.v1'));
  for (const file of ['fonts/NanumGothicCoding-Regular.ttf', 'ink-print.svg']) {
    assert.ok(!USOTSUKI_FILES.includes(file), file);
    for (const route of ['zz7', 'distribution-snapshots/usotsuki']) assert.ok(!(await read(route, 'sw.js')).toString().includes(`"./${file}"`), `${route}/${file}`);
    for (const route of ['zz7', 'distribution-snapshots/usotsuki']) {
      for (const runtime of ['index.html', 'style.css', ...detectorFiles(route), 'recorder-theme.js', 'recorder-engine.js', 'recorder-trace.js', 'recorder-a.html', 'recorder-d.html']) assert.ok(!(await read(route, runtime)).toString().includes(file), `${route}/${runtime}: ${file}`);
    }
  }
  assert.ok(USOTSUKI_FILES.includes('recorder-assets/recorder-shell-blank.webp'));
});


test('Three recorder themes retain exact bytes and cache isolation', async () => {
  assert.deepEqual(detectorFiles('distribution-snapshots/usotsuki'), detectorFiles('zz7'));
  for (const file of ['index.html', 'style.css', ...detectorFiles('zz7'), 'sw.js', 'recorder-theme.js', 'recorder-engine.js', 'recorder-trace.js', 'recorder-a.html', 'recorder-d.html']) {
    const personal = await read('zz7', file);
    let snapshot = (await read('distribution-snapshots/usotsuki', file)).toString();
    if (file === 'index.html') snapshot = snapshot.replace('usotsuki.distribution.detector.theme.v1', 'usotsuki.detector.theme.v1');
    let personalText = personal.toString();
    if (detectorFiles('zz7').includes(file)) {
      for (const [constant, key] of [['STATE_KEY','detector.v1'], ['SOUND_KEY','detector.sound.v1'], ['DISPLAY_THEME_KEY','detector.theme.v1']]) {
        snapshot = snapshot.replace(`${constant} = "usotsuki.distribution.${key}"`, `${constant} = "usotsuki.${key}"`);
      }
      assert.doesNotMatch(snapshot, /magic-local-settings|local-preview/);
      if (file === 'detector.js') {
        assert.match(personalText, /local-preview/);
        personalText = dropUnusedSingleImports(withoutLocalPreviewHook(personalText));
        snapshot = dropUnusedSingleImports(snapshot);
      }
    } else if (file === 'sw.js') {
      assert.ok(snapshot.includes("CACHE_NAME = CACHE_PREFIX + 'v20261009-continuous-paper-20-haptic-dip-manual-install-1-perf-1-coherent-1-compat-1-gesture-1-wake-1-modules-1-split-1-trim-1-css-1-clean-1-lieflash-2-distribution'"));
      snapshot = snapshot.replace('v20261009-continuous-paper-20-haptic-dip-manual-install-1-perf-1-coherent-1-compat-1-gesture-1-wake-1-modules-1-split-1-trim-1-css-1-clean-1-lieflash-2-distribution', 'v20261009-continuous-paper-20-haptic-dip-manual-install-1-perf-1-coherent-1-compat-1-gesture-1-wake-1-modules-1-split-1-trim-1-css-1-clean-1-lieflash-2');
      assert.ok(personal.includes('v20261009-continuous-paper-20-haptic-dip-manual-install-1-perf-1-coherent-1-compat-1-gesture-1-wake-1-modules-1-split-1'));
      personalText = stripLocalPreview(personalText);
    }
    assert.equal(snapshot, personalText, `normalized snapshot ${file}`);
    if (file === 'style.css') {
      const protectedPrefix = personal.toString().split('\n').slice(0, 929).join('\n') + '\n';
      assert.equal(createHash('sha256').update(protectedPrefix).digest('hex'), '07ad81bbc85967754c072d262d8ef2337cf2e0077ec2d077b008139108a8e288');
      assert.ok(personal.toString().includes('recorder-shell-blank.webp'));
      assert.ok(personal.toString().includes('#performance-screen.is-preparing #test-indicator { font-size: clamp(12px, 3.5vw, 16px); letter-spacing: 0; white-space: nowrap; }'));
    }
  }
});
