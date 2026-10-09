import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  for (const [personal, snapshot, id] of [['zz7', 'usotsuki', 'display-theme'], ['zz11', 'spinner', 'table-theme'], ['zz11', 'spinner', 'screen-design']]) {
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
      .replaceAll('friend-spinner-table-theme-', 'zz11-table-theme-')
      .replaceAll('friend-spinner-screen-design-', 'zz11-screen-design-');
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
  for (const key of ['friend-spinner-state-v2', 'friend-spinner-state-v1', 'friend-spinner-guide-seen-v2', 'friend-spinner-table-theme-v1', 'friend-spinner-screen-design-v1']) assert.ok(spinner.includes(key), key);
});


test('USOTSUKI personal and snapshot preserve full HTML bytes and exclude unused assets from deployment', async () => {
  assert.equal((await read('zz7', 'index.html')).toString(), (await read('distribution-snapshots/usotsuki', 'index.html')).toString().replace('usotsuki.distribution.detector.theme.v1', 'usotsuki.detector.theme.v1'));
  for (const file of ['fonts/NanumGothicCoding-Regular.ttf', 'ink-print.svg']) {
    assert.ok(!USOTSUKI_FILES.includes(file), file);
    for (const route of ['zz7', 'distribution-snapshots/usotsuki']) assert.ok(!(await read(route, 'sw.js')).toString().includes(`"./${file}"`), `${route}/${file}`);
    for (const route of ['zz7', 'distribution-snapshots/usotsuki']) {
      for (const runtime of ['index.html', 'style.css', 'detector.js', 'recorder-theme.js', 'recorder-engine.js', 'recorder-trace.js', 'recorder-a.html', 'recorder-d.html']) assert.ok(!(await read(route, runtime)).toString().includes(file), `${route}/${runtime}: ${file}`);
    }
  }
  assert.ok(USOTSUKI_FILES.includes('recorder-assets/recorder-shell-blank.webp'));
});


test('Three recorder themes retain exact bytes and cache isolation', async () => {
  for (const file of ['index.html', 'style.css', 'detector.js', 'sw.js', 'recorder-theme.js', 'recorder-engine.js', 'recorder-trace.js', 'recorder-a.html', 'recorder-d.html']) {
    const personal = await read('zz7', file);
    let snapshot = (await read('distribution-snapshots/usotsuki', file)).toString();
    if (file === 'index.html') snapshot = snapshot.replace('usotsuki.distribution.detector.theme.v1', 'usotsuki.detector.theme.v1');
    if (file === 'detector.js') {
      for (const [constant, key] of [['STATE_KEY','detector.v1'], ['SOUND_KEY','detector.sound.v1'], ['DISPLAY_THEME_KEY','detector.theme.v1']]) {
        snapshot = snapshot.replace(`${constant} = "usotsuki.distribution.${key}"`, `${constant} = "usotsuki.${key}"`);
      }
    } else if (file === 'sw.js') {
      assert.ok(snapshot.includes("CACHE_NAME = CACHE_PREFIX + 'v20261009-continuous-paper-20-distribution'"));
      snapshot = snapshot.replace('v20261009-continuous-paper-20-distribution', 'v20261009-continuous-paper-20');
      assert.ok(personal.includes('v20261009-continuous-paper-20'));
    }
    assert.equal(snapshot, personal.toString(), `normalized snapshot ${file}`);
    if (file === 'style.css') {
      const protectedPrefix = personal.toString().split('\n').slice(0, 929).join('\n') + '\n';
      assert.equal(createHash('sha256').update(protectedPrefix).digest('hex'), '07ad81bbc85967754c072d262d8ef2337cf2e0077ec2d077b008139108a8e288');
      assert.ok(personal.toString().includes('recorder-shell-blank.webp'));
      assert.ok(personal.toString().includes('#performance-screen.is-preparing #test-indicator { font-size: clamp(12px, 3.5vw, 16px); letter-spacing: 0; white-space: nowrap; }'));
    }
  }
});
