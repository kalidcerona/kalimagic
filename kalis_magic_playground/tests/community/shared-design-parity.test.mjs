import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { USOTSUKI_FILES, SPINNER_FILES } from '../../scripts/build-public.mjs';

const read = (route, file) => readFile(new URL(`../../${route}/${file}`, import.meta.url));

test('shared USOTSUKI and TYCHE retain the approved personal surfaces and artwork', async () => {
  for (const [personal, snapshot, files] of [
    ['zz7', 'usotsuki', USOTSUKI_FILES.filter(f => /\.css$|^(holdem-assets|recorder-assets)\//.test(f))],
    ['zz11', 'spinner', SPINNER_FILES.filter(f => /\.css$|^(casino-assets|hybrid-assets)\//.test(f))],
  ]) {
    assert.ok(files.length > 3);
    for (const file of files) assert.deepEqual(await read(`distribution-snapshots/${snapshot}`, file), await read(personal, file), `${snapshot}/${file}`);
  }
});

test('shared theme selectors expose the same options as their personal counterparts', async () => {
  for (const [personal, snapshot, id] of [['zz7', 'usotsuki', 'display-theme'], ['zz11', 'spinner', 'table-theme']]) {
    const select = new RegExp(`<select[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/select>`);
    const source = (await read(personal, 'index.html')).toString();
    const shared = (await read(`distribution-snapshots/${snapshot}`, 'index.html')).toString();
    assert.ok(source.match(select));
    assert.equal(shared.match(select)?.[0], source.match(select)[0]);
  }
});

test('shared performance code differs only in its explicitly isolated storage keys', async () => {
  for (const [personal, snapshot, file] of [['zz7', 'usotsuki', 'detector.js'], ['zz11', 'spinner', 'app.js']]) {
    const source = (await read(personal, file)).toString();
    const shared = (await read(`distribution-snapshots/${snapshot}`, file)).toString();
    const normalized = shared.replaceAll('usotsuki.distribution.', 'usotsuki.')
      .replaceAll('friend-spinner-state-', 'zz11-spinner-state-')
      .replaceAll('friend-spinner-guide-', 'zz11-guide-')
      .replaceAll('friend-spinner-table-theme-', 'zz11-table-theme-');
    assert.equal(normalized, source);
  }
});

test('promotion preserves existing shared storage and isolates newly introduced theme preferences', async () => {
  const detector = (await read('distribution-snapshots/usotsuki', 'detector.js')).toString();
  for (const [constant, key] of [
    ['STATE_KEY', 'usotsuki.distribution.detector.v1'],
    ['SOUND_KEY', 'usotsuki.distribution.detector.sound.v1'],
    ['SCAN_DURATION_KEY', 'usotsuki.detector.scan-duration.v1'],
    ['VIBRATION_KEY', 'usotsuki.detector.vibration.v1'],
    ['DISPLAY_THEME_KEY', 'usotsuki.distribution.detector.theme.v1'],
  ]) assert.ok(detector.includes(`${constant} = "${key}"`), constant);
  const spinner = (await read('distribution-snapshots/spinner', 'app.js')).toString();
  for (const key of ['friend-spinner-state-v2', 'friend-spinner-state-v1', 'friend-spinner-guide-seen-v2', 'friend-spinner-table-theme-v1']) assert.ok(spinner.includes(key), key);
});
