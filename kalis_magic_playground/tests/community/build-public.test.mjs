import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, PUBLIC_DIRS, PRIVATE_PATTERNS, MIRROR_PAIRS, DISTRIBUTION_APPS, SHARED_UNLOCK_FILES, CHOICE_FILES, NEW_APP_FILES, USOTSUKI_FILES, ASRAI_FILES, ALTER_FILES, SPINNER_FILES, MEMDECK_FILES, QR_FILES, ALETHEIA_COURT_FILES, SETTINGS_UI_FILES, buildPublic, verifyAppDisplayPolicy, injectLegacyMigration } from '../../scripts/build-public.mjs';

test('public build allowlist includes visible site pages', () => {
  assert.ok(PUBLIC_FILES.includes('index.html'));
  assert.ok(PUBLIC_FILES.includes('reviews.html'));
  assert.ok(PUBLIC_FILES.includes('admin.js'));
  assert.ok(PUBLIC_FILES.includes('style.css'));
  assert.ok(PUBLIC_FILES.includes('nav.js'));
  assert.ok(PUBLIC_FILES.includes('pg-util.js'));
  assert.ok(PUBLIC_FILES.includes('invite-client.js'));
  assert.ok(PUBLIC_FILES.includes('reveal.js'));
  assert.ok(PUBLIC_FILES.includes('track.js'));
  assert.ok(PUBLIC_FILES.includes('playground-api.js'));
  assert.ok(PUBLIC_FILES.includes('playground-list.js'));
  assert.ok(PUBLIC_FILES.includes('playground-compose.js'));
  assert.ok(PUBLIC_FILES.includes('playground-detail.js'));
  assert.ok(PUBLIC_DIRS.includes('assets'));
});

test('public build explicitly excludes local planning and source folders', () => {
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('MAGIC-PLAYGROUND-PRD.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('COMMUNITY-MVP-DESIGN.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('netlify/functions/posts.mjs')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('distribution-snapshots/unlock/index.html')));
  assert.equal(PUBLIC_DIRS.includes('netlify'), false);
  assert.equal(PUBLIC_DIRS.includes('supabase'), false);
  assert.equal(PUBLIC_DIRS.includes('distribution-snapshots'), false);
});

test('personal ALTER, Asrai, and spinner are included while unfinished FALSE MEMORY stays private', () => {
  assert.deepEqual(PUBLIC_DIRS.filter((entry) => /^zz\d+$/.test(entry)), ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11', 'zz12', 'zz13', 'zz14']);
  assert.equal(MIRROR_PAIRS.some(([, mirror]) => mirror.startsWith('zz9/')), false);
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('zz8/app.js')));
});

test('public build mirrors the current calculator and integrated stopwatch sources', () => {
  for (const file of ['index.html', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon.svg', 'manifest.webmanifest', 'brand-logo.jpg']) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-calculator-v2/${file}` && mirror === `zz3/${file}`), `calculator ${file}`);
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-stopwatch-uni/${file}` && mirror === `zz1/${file}`), `stopwatch ${file}`);
  }
  assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
    source === '../../magic-calculator-v2/brand-logo.jpg' && mirror === 'zz3/brand-logo.jpg'));
  for (const file of CHOICE_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-choice/${file}` && mirror === `zz4/${file}`), `choice ${file}`);
  }
  // Only the choice app ships the home screen artwork; the shared new-app file list stays unchanged.
  assert.ok(CHOICE_FILES.includes('home-manifest.js') && CHOICE_FILES.includes('home-icons/a1.svg') && CHOICE_FILES.includes('home-icons/own-memdeck.png'));
  assert.equal(NEW_APP_FILES.some((file) => file.startsWith('home-')), false);
  for (const [source, route] of [['magic-aletheia', 'zz5'], ['magic-tobira', 'zz6']]) {
    for (const file of NEW_APP_FILES) {
      assert.ok(MIRROR_PAIRS.some(([original, mirror]) =>
        original === `../../${source}/${file}` && mirror === `${route}/${file}`), `${route} ${file}`);
    }
  }
  for (const file of USOTSUKI_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-usotsuki/${file}` && mirror === `zz7/${file}`), `zz7 ${file}`);
  }
  for (const [source, route, files] of [
    ['magic-asrai', 'zz8', ASRAI_FILES],
    ['magic-alter', 'zz10', ALTER_FILES],
    ['magic-spinner', 'zz11', SPINNER_FILES]
  ]) {
    for (const file of files) {
      assert.ok(MIRROR_PAIRS.some(([original, mirror]) =>
        original === `../../${source}/${file}` && mirror === `${route}/${file}`), `${route} ${file}`);
    }
  }
  assert.equal(ALETHEIA_COURT_FILES.length, 12);
  for (const file of ALETHEIA_COURT_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-aletheia/${file}` && mirror === `zz5/${file}`), `zz5 ${file}`);
  }
  for (const [source, route] of [
    ['magic-stopwatch-uni', 'zz1'],
    ['magic-unlock', 'zz2'],
    ['magic-calculator-v2', 'zz3'],
    ['magic-choice', 'zz4'],
    ['magic-aletheia', 'zz5'],
    ['magic-tobira', 'zz6'],
    ['magic-usotsuki', 'zz7']
  ]) {
    assert.ok(MIRROR_PAIRS.some(([original, mirror]) =>
      original === `../../${source}/brand-logo.png` && mirror === `${route}/brand-logo.png`), `${route} high-resolution logo`);
  }
  assert.equal(MIRROR_PAIRS.some(([, mirror]) => mirror === 'tools/calc' || mirror.startsWith('tools/calc/')), false);
  assert.deepEqual(DISTRIBUTION_APPS, [
    { source: 'distribution-snapshots/pimax', target: 'pimax', tool: 'pimax' },
    { source: 'distribution-snapshots/calculator', target: 'hitsuzen', tool: 'calc' },
    { source: 'distribution-snapshots/unlock', target: 'release', tool: 'unlock' },
    { source: 'distribution-snapshots/aletheia', target: 'aletheia', tool: 'aletheia' },
    { source: 'distribution-snapshots/usotsuki', target: 'usotsuki', tool: 'usotsuki' },
    { source: 'distribution-snapshots/tobira', target: 'tobira', tool: 'tobira' },
    { source: 'distribution-snapshots/spinner', target: 'tyche', tool: 'spinner' },
    { source: 'distribution-snapshots/kairos', target: 'kairos', tool: 'stopwatch-uni' },
    { source: 'distribution-snapshots/kairos', target: 'kairos-classic', tool: 'stopwatch' },
    { source: 'distribution-snapshots/qr', target: 'arosaegida', tool: 'arosaegida' }
  ]);
});

test('public build serves integrated stopwatch on both retained entitlement routes', async () => {
  await buildPublic();
  for (const route of ['zz2', 'zz3', 'tools/release', 'tools/hitsuzen']) {
    const appRoot = new URL(`../../dist/${route}/`, import.meta.url);
    assert.match(await readFile(new URL('index.html', appRoot), 'utf8'), /src=["']\.\/performance-link\.js["']/);
    assert.match(await readFile(new URL('sw.js', appRoot), 'utf8'), /performance-link\.js/);
    assert.equal(await readFile(new URL('performance-link.js', appRoot), 'utf8'),
      await readFile(new URL('../../../../magic-app-common/performance-link.js', import.meta.url), 'utf8'));
  }
  const personalStopwatch = await readFile(new URL('../../dist/zz1/index.html', import.meta.url), 'utf8');
  const sharedUnlock = await readFile(new URL('../../dist/tools/release/index.html', import.meta.url), 'utf8');
  const sharedStopwatch = await readFile(new URL('../../dist/tools/kairos/index.html', import.meta.url), 'utf8');
  const sharedCalculator = await readFile(new URL('../../dist/tools/hitsuzen/index.html', import.meta.url), 'utf8');
  const sharedAletheia = await readFile(new URL('../../dist/tools/aletheia/index.html', import.meta.url), 'utf8');
  const sharedUsotsuki = await readFile(new URL('../../dist/tools/usotsuki/index.html', import.meta.url), 'utf8');
  const personalUsotsuki = await readFile(new URL('../../dist/zz7/index.html', import.meta.url), 'utf8');
  for (const html of [personalUsotsuki, sharedUsotsuki]) {
    assert.match(html, /id="scan-duration"/);
    assert.match(html, /id="vibration-level"/);
  }
  const legacyStopwatch = await readFile(new URL('../../dist/tools/kairos-classic/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(personalStopwatch, /id="friend-apps-check"/);
  assert.match(sharedUnlock, /id="friend-apps-check"/);
  assert.match(sharedUnlock, /tools\/_check\?tool=unlock/);
  for (const html of [sharedUnlock, sharedStopwatch, sharedCalculator, sharedAletheia, sharedUsotsuki]) assert.match(html, /data-magic-customize="off"/);
  assert.doesNotMatch(personalStopwatch, /data-magic-customize="off"/);
  assert.match(sharedStopwatch, /id="friend-apps-check"/);
  assert.match(sharedStopwatch, /tools\/_check\?tool=stopwatch-uni/);
  assert.match(sharedStopwatch, /<title>KAIROS · 스톱워치<\/title>/);
  assert.match(sharedStopwatch, /data-magic-app="stopwatch"/);
  assert.match(sharedCalculator, /<title>HITSUZEN<\/title>/);
  assert.match(sharedCalculator, /data-magic-app="calculator"/);
  assert.match(sharedCalculator, /tools\/_check\?tool=calc/);
  assert.doesNotMatch(sharedStopwatch, /data-magic-app="calculator"/);
  assert.doesNotMatch(sharedCalculator, /data-magic-app="stopwatch"/);
  assert.match(sharedAletheia, /tools\/_check\?tool=aletheia/);
  assert.match(sharedUsotsuki, /tools\/_check\?tool=usotsuki/);
  assert.match(legacyStopwatch, /tools\/_check\?tool=stopwatch/);
  const stripGate = (html) => html.replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, '');
  assert.equal(stripGate(legacyStopwatch).replaceAll('friend-kairos-classic', 'friend-kairos').replaceAll('target: "kairos-classic"', 'target: "kairos"').replaceAll('=== "stopwatch"', '=== "stopwatch-uni"'), stripGate(sharedStopwatch));
  await stat(new URL('../../dist/zz4/index.html', import.meta.url));
  await stat(new URL('../../dist/zz5/index.html', import.meta.url));
  await stat(new URL('../../dist/zz6/index.html', import.meta.url));
  await stat(new URL('../../dist/zz7/index.html', import.meta.url));
  await assert.rejects(stat(new URL('../../dist/zz7/app.js', import.meta.url)), { code: 'ENOENT' });
  await stat(new URL('../../dist/zz8/index.html', import.meta.url));
  await stat(new URL('../../dist/zz10/index.html', import.meta.url));
  await stat(new URL('../../dist/zz11/index.html', import.meta.url));
  const trainer = new URL('../../dist/zz12/', import.meta.url);
  assert.deepEqual((await readdir(trainer)).sort(), [...MEMDECK_FILES].sort());
  const trainerSource = await stat(new URL('../../../../magic-memdeck/', import.meta.url)).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
  for (const file of MEMDECK_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) => source === `../../magic-memdeck/${file}` && mirror === `zz12/${file}`));
    if (trainerSource) {
      const original = await readFile(new URL(`../../../../magic-memdeck/${file}`, import.meta.url));
      assert.deepEqual(await readFile(new URL(file, trainer)), original);
    }
  }
  const qr = new URL('../../dist/zz13/', import.meta.url);
  const qrFiles = [];
  async function collectQrFiles(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await collectQrFiles(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`);
      else qrFiles.push(`${prefix}${entry.name}`);
    }
  }
  await collectQrFiles(qr);
  assert.deepEqual(qrFiles.sort(), [...QR_FILES].sort());
  const qrSource = await stat(new URL('../../../../magic-qr/', import.meta.url)).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
  for (const file of QR_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) => source === `../../magic-qr/${file}` && mirror === `zz13/${file}`));
    if (qrSource) assert.deepEqual(await readFile(new URL(file, qr)), await readFile(new URL(`../../../../magic-qr/${file}`, import.meta.url)));
  }
  const sharedQr = new URL('../../dist/tools/arosaegida/', import.meta.url);
  const sharedQrHtml = await readFile(new URL('index.html', sharedQr), 'utf8');
  assert.match(sharedQrHtml, /tools\/_check\?tool=arosaegida/);
  assert.match(sharedQrHtml, /data-magic-customize="off"/);
  assert.match(sharedQrHtml, /아로새기다/);
  assert.deepEqual(await readFile(new URL('brand-logo.png', sharedQr)), await readFile(new URL('../../distribution-snapshots/qr/brand-logo.png', import.meta.url)));
  assert.match(await readFile(new URL('sw.js', sharedQr), 'utf8'), /scope\.pathname\.startsWith\('\/tools\/'\)/);
  for (const route of [...PUBLIC_DIRS.filter((route) => /^zz\d+$/.test(route)), ...DISTRIBUTION_APPS.map((app) => 'tools/' + app.target)]) {
    await assert.rejects(stat(new URL('../../dist/' + route + '/fullscreen.js', import.meta.url)), { code: 'ENOENT' });
  }
  const qrManifest = JSON.parse(await readFile(new URL('manifest.webmanifest', qr), 'utf8'));
  assert.equal(qrManifest.display, 'standalone');
  assert.equal(qrManifest.scope, './');
  const trainerManifest = JSON.parse(await readFile(new URL('manifest.webmanifest', trainer), 'utf8'));
  assert.equal(trainerManifest.display, 'standalone');
  assert.equal(trainerManifest.scope, './');
  const headers = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');
  assert.match(headers, /for = "\/zz12\/manifest\.webmanifest"\s+\[headers.values\]\s+Content-Type = "application\/manifest\+json"/);
  await assert.rejects(stat(new URL('../../dist/zz8/app.js', import.meta.url)), { code: 'ENOENT' });
  await assert.rejects(stat(new URL('../../dist/zz9/index.html', import.meta.url)), { code: 'ENOENT' });
});

test('admin distribution catalog lists one integrated stopwatch while keeping its canonical route', async () => {
  const admin = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
  assert.match(admin, /data-app-card="stopwatch-uni"/);
  assert.match(admin, /data-app-card="aletheia"/);
  assert.match(admin, /data-app-card="usotsuki"/);
  assert.match(admin, /data-copy-link="\/tools\/kairos\/"/);
  assert.match(admin, /data-copy-link="\/tools\/aletheia\/"/);
  assert.match(admin, /data-copy-link="\/tools\/usotsuki\/"/);
  assert.match(admin, /<h3>카이로스\(KAIROS\)<\/h3>/);
  assert.match(admin, /<h3>히츠젠\(HITSUZEN\)<\/h3>/);
  assert.match(admin, /<h3>레리즈\(RELEASE\)<\/h3>/);
  assert.match(admin, /<h3>알레테이아\(ALETHEIA\)<\/h3>/);
  assert.match(admin, /<h3>우소츠키\(USOTSUKI\)<\/h3>/);
  assert.doesNotMatch(admin, /data-app-card="stopwatch"/);
  assert.doesNotMatch(admin, /data-copy-link="\/tools\/kairos-classic\/"/);
});

test('personal KAIROS edits do not change either shared route', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const snapshotDir = path.join(root, 'distribution-snapshots', 'kairos');
  const personalDir = path.join(root, 'zz1');
  async function filesUnder(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    const parts = await Promise.all(entries.map(async (entry) => {
      const name = path.join(prefix, entry.name);
      return entry.isDirectory() ? filesUnder(path.join(dir, entry.name), name) : [name];
    }));
    return parts.flat().sort();
  }
  const snapshotFiles = (await filesUnder(snapshotDir)).filter((file) => !PRIVATE_PATTERNS.some((pattern) => pattern.test(file)));
  assert.ok(snapshotFiles.includes('index.html') && snapshotFiles.includes('logic.js'));
  assert.equal(snapshotFiles.includes('fullscreen.js'), false);
  for (const [target, tool] of [['kairos', 'stopwatch-uni'], ['kairos-classic', 'stopwatch']]) {
    const distributedDir = path.join(root, 'dist', 'tools', target);
    assert.deepEqual(await filesUnder(distributedDir), [...snapshotFiles, 'legacy-shared-contract.mjs', 'legacy-storage-migration.mjs'].sort(), target);
    for (const file of ['legacy-shared-contract.mjs', 'legacy-storage-migration.mjs']) assert.deepEqual(await readFile(path.join(distributedDir, file)), await readFile(path.join(root, 'scripts', file)), `${target}/${file}`);
    const prefix = `friend-${target}_`;
    for (const file of snapshotFiles) {
      const [snapshotBytes, distributedBytes, personalBytes] = await Promise.all([
        readFile(path.join(snapshotDir, file)),
        readFile(path.join(distributedDir, file)),
        readFile(path.join(personalDir, file)).catch((error) => { if (error.code === 'ENOENT') return null; throw error; })
      ]);
      let comparable = distributedBytes;
      let expected = snapshotBytes;
      let personalExpected = personalBytes;
      if (file === 'index.html') {
        const snapshotHtml = snapshotBytes.toString('utf8');
        const personalHtml = personalBytes ? personalBytes.toString('utf8') : null;
        const isolate = (html) => html
          .replaceAll('stopwatch_', prefix)
          .replaceAll('stopwatch2_', `friend-${target}-legacy_`)
          .replaceAll('stopwatch-settings-entry-tutorial-', `friend-${target}-settings-entry-tutorial-`)
          .replace(/<body\b/, '<body data-magic-customize="off"');
        comparable = Buffer.from(distributedBytes.toString('utf8').replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, ''));
        expected = Buffer.from(injectLegacyMigration(isolate(snapshotHtml), target));
        personalExpected = personalHtml === null ? null : Buffer.from(injectLegacyMigration(isolate(personalHtml), target));
        const html = distributedBytes.toString('utf8');
        assert.match(html, new RegExp(`tools\\/_check\\?tool=${tool}`));
        assert.match(html, new RegExp(`${prefix}preset_cs`));
        assert.match(html, new RegExp(`${prefix}ui_mode`));
        assert.match(html, new RegExp(`friend-${target}-settings-entry-tutorial-v1`));
        assert.doesNotMatch(html, /["']stopwatch_/);
        assert.doesNotMatch(html, /["']stopwatch2_/);
        assert.doesNotMatch(html, /["']stopwatch-settings-entry-tutorial-/);
      } else if (file === 'logic.js') {
        const isolate = (source) => source.replaceAll('stopwatch_', prefix).replaceAll('stopwatch2_', `friend-${target}-legacy_`);
        const logic = distributedBytes.toString('utf8');
        comparable = Buffer.from(logic);
        expected = Buffer.from(isolate(snapshotBytes.toString('utf8')));
        personalExpected = personalBytes ? Buffer.from(isolate(personalBytes.toString('utf8'))) : null;
        assert.match(logic, new RegExp(`${prefix}preset_cs`));
        assert.match(logic, new RegExp(`friend-${target}-legacy_preset_cs`));
        assert.match(logic, new RegExp(`${prefix}storage_migrated_v2`));
        assert.doesNotMatch(logic, /["']stopwatch_/);
        assert.doesNotMatch(logic, /["']stopwatch2_/);
      } else if (file === 'manifest.webmanifest') {
        expected = Buffer.from(JSON.stringify({ ...JSON.parse(snapshotBytes), id: `/tools/${target}/`, start_url: './', scope: './' }, null, 2) + '\n');
        personalExpected = personalBytes
          ? Buffer.from(JSON.stringify({ ...JSON.parse(personalBytes), id: `/tools/${target}/`, start_url: './', scope: './' }, null, 2) + '\n')
          : null;
      }
      assert.deepEqual(comparable, expected, `${target}/${file} must follow the kairos snapshot`);
      if (personalExpected && !personalBytes.equals(snapshotBytes)) {
        assert.notDeepEqual(comparable, personalExpected, `${target}/${file} leaked personal zz1`);
      }
    }
  }
});

test('shared unlock stays on the pinned snapshot until explicit promotion', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const source = path.join(root, 'distribution-snapshots', 'unlock');
  const target = path.join(root, 'dist', 'tools', 'release');
  const copiedFiles = (await readdir(target)).sort();
  assert.deepEqual(copiedFiles, [...SHARED_UNLOCK_FILES, ...SETTINGS_UI_FILES].sort());

  const manifest = JSON.parse(await readFile(path.join(source, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(SHARED_UNLOCK_FILES.includes(icon.src.replace(/^\.\//, '')), `Missing manifest icon: ${icon.src}`);
  }

  for (const file of [...SHARED_UNLOCK_FILES, ...SETTINGS_UI_FILES]) {
    const [snapshot, distributed] = await Promise.all([
      readFile(path.join(source, file)),
      readFile(path.join(target, file))
    ]);
    if (file === 'index.html') {
      const withoutGuard = distributed.toString('utf8').replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, '');
      assert.equal(withoutGuard, snapshot.toString('utf8').replace(/<body\b/, '<body data-magic-customize="off"'));
    } else if (file === 'manifest.webmanifest') {
      const expected = { ...JSON.parse(snapshot), id: '/tools/release/', start_url: './', scope: './' };
      assert.deepEqual(JSON.parse(distributed), expected);
    } else {
      assert.deepEqual(distributed, snapshot, file);
    }
  }
});

test('ALETHEIA and USOTSUKI distribution builds use pinned snapshots and separate PWA identities', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  async function filesUnder(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    const parts = await Promise.all(entries.map(async (entry) => {
      const name = path.join(prefix, entry.name);
      return entry.isDirectory() ? filesUnder(path.join(dir, entry.name), name) : [name];
    }));
    return parts.flat().sort();
  }
  for (const app of ['aletheia', 'usotsuki']) {
    const snapshot = path.join(root, 'distribution-snapshots', app);
    const target = path.join(root, 'dist', 'tools', app);
    const sourceFiles = (await filesUnder(snapshot)).filter((file) => !PRIVATE_PATTERNS.some((pattern) => pattern.test(file)));
    assert.deepEqual(await filesUnder(target), sourceFiles, `${app} file inventory`);
    const manifest = JSON.parse(await readFile(path.join(target, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.id, `/tools/${app}/`);
    for (const file of sourceFiles) {
      const [sourceBytes, targetBytes] = await Promise.all([
        readFile(path.join(snapshot, file)), readFile(path.join(target, file))
      ]);
      if (file === 'index.html') {
        const html = targetBytes.toString('utf8');
        assert.match(html, new RegExp(`tools\\/_check\\?tool=${app}`));
        assert.equal(html.replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, ''), injectLegacyMigration(sourceBytes.toString('utf8').replace(/<body\b/, '<body data-magic-customize="off"'), app.target));
      } else if (file === 'manifest.webmanifest') {
        assert.deepEqual(JSON.parse(targetBytes), { ...JSON.parse(sourceBytes), id: `/tools/${app}/`, start_url: './', scope: './' });
      } else {
        assert.deepEqual(targetBytes, sourceBytes, `${app}/${file}`);
      }
    }
  }
});

test('HITSUZEN and AROSAEGIDA keep every pinned snapshot byte except gate, customize, and manifest identity', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const apps = DISTRIBUTION_APPS.filter((app) => app.source === 'distribution-snapshots/calculator' || app.source === 'distribution-snapshots/qr');
  assert.deepEqual(apps.map((app) => [app.source, app.target, app.tool]), [
    ['distribution-snapshots/calculator', 'hitsuzen', 'calc'],
    ['distribution-snapshots/qr', 'arosaegida', 'arosaegida']
  ]);
  async function filesUnder(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    const parts = await Promise.all(entries.map(async (entry) => {
      const name = path.join(prefix, entry.name);
      return entry.isDirectory() ? filesUnder(path.join(dir, entry.name), name) : [name];
    }));
    return parts.flat().sort();
  }
  for (const app of apps) {
    const snapshot = path.join(root, app.source);
    const target = path.join(root, 'dist', 'tools', app.target);
    const sourceFiles = (await filesUnder(snapshot)).filter((file) => !file.split(/[\\/]/).some((part) => part.startsWith('.')) && !PRIVATE_PATTERNS.some((pattern) => pattern.test(file)));
    assert.ok(sourceFiles.length > 1, app.source);
    assert.ok(sourceFiles.includes('index.html') && sourceFiles.includes('manifest.webmanifest') && sourceFiles.includes('sw.js'), app.source);
    const additional = app.target === 'hitsuzen' ? ['legacy-shared-contract.mjs', 'legacy-storage-migration.mjs'] : [];
    assert.deepEqual(await filesUnder(target), [...sourceFiles, ...additional].sort(), `${app.target} file inventory`);
    for (const file of additional) assert.deepEqual(await readFile(path.join(target, file)), await readFile(path.join(root, 'scripts', file)), `${app.target}/${file}`);
    for (const file of sourceFiles) {
      const [sourceBytes, targetBytes] = await Promise.all([
        readFile(path.join(snapshot, file)),
        readFile(path.join(target, file))
      ]);
      if (file === 'index.html') {
        const html = targetBytes.toString('utf8');
        assert.match(html, new RegExp(`id="friend-apps-check"[\\s\\S]*tools\\/_check\\?tool=${app.tool}`));
        assert.match(html, /data-magic-customize="off"/);
        assert.equal(html.replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, ''), injectLegacyMigration(sourceBytes.toString('utf8').replace(/<body\b/, '<body data-magic-customize="off"'), app.target));
      } else if (file === 'manifest.webmanifest') {
        const manifest = JSON.parse(targetBytes);
        assert.equal(manifest.id, `/tools/${app.target}/`);
        assert.equal(manifest.start_url, './');
        assert.equal(manifest.scope, './');
        assert.deepEqual(manifest, { ...JSON.parse(sourceBytes), id: `/tools/${app.target}/`, start_url: './', scope: './' });
      } else {
        assert.deepEqual(targetBytes, sourceBytes, `${app.target}/${file}`);
      }
    }
  }
});

test('Asrai, ALTER, and spinner personal builds keep exact runtime mirrors and distinct install identities', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  async function filesUnder(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    const parts = await Promise.all(entries.map(async (entry) => {
      const name = path.join(prefix, entry.name);
      return entry.isDirectory() ? filesUnder(path.join(dir, entry.name), name) : [name];
    }));
    return parts.flat().sort();
  }
  for (const [source, route, files, name] of [
    ['magic-asrai', 'zz8', ASRAI_FILES, '아스라이'],
    ['magic-alter', 'zz10', ALTER_FILES, 'ALTER'],
    ['magic-spinner', 'zz11', SPINNER_FILES, 'TYCHE']
  ]) {
    const distDir = path.join(root, 'dist', route);
    const runtimeFiles = [...files, ...SETTINGS_UI_FILES];
    assert.deepEqual(await filesUnder(distDir), runtimeFiles.sort());
    const manifest = JSON.parse(await readFile(path.join(distDir, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.id, undefined);
    assert.equal(manifest.scope, './');
    assert.equal(manifest.name, name);
    assert.match(manifest.start_url, /^\.\/(?:index\.html)?$/);
    for (const file of runtimeFiles) {
      const [original, mirror] = await Promise.all([
        readFile(path.join(root, '..', '..', source, file)),
        readFile(path.join(distDir, file))
      ]);
      assert.deepEqual(mirror, original, `${route}/${file}`);
    }
    assert.doesNotMatch(await readFile(path.join(distDir, 'index.html'), 'utf8'), /id="friend-apps-check"/);
  }
  await assert.rejects(stat(path.join(root, 'dist', 'zz9', 'index.html')), { code: 'ENOENT' });
});

test('public build does not copy dotfiles from public directories', async () => {
  await buildPublic();
  await assert.rejects(
    stat(new URL('../../dist/kalimeeting/.DS_Store', import.meta.url)),
    /ENOENT/
  );
});

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  }));
  return files.flat();
}

function localAssetPath(htmlFile, value, distDir) {
  if (!value) return null;
  const withoutFragment = value.split('#')[0];
  const cleanValue = withoutFragment.split('?')[0];
  if (!cleanValue || cleanValue.startsWith('#')) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(cleanValue)) return null;
  if (/^(?:mailto|tel|data|javascript):/i.test(cleanValue)) return null;
  const decoded = decodeURIComponent(cleanValue);
  if (decoded.startsWith('/')) return path.join(distDir, decoded);
  return path.resolve(path.dirname(htmlFile), decoded);
}

test('public build includes every local src and href referenced by dist html', async () => {
  await buildPublic();
  const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
  const htmlFiles = await listHtmlFiles(distDir);
  const missing = [];

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      const assetPath = localAssetPath(htmlFile, match[1], distDir);
      if (!assetPath) continue;
      if (!assetPath.startsWith(distDir + path.sep)) {
        missing.push(`${path.relative(distDir, htmlFile)} -> ${match[1]}`);
        continue;
      }
      try {
        await stat(assetPath);
      } catch {
        missing.push(`${path.relative(distDir, htmlFile)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(missing.sort(), []);
});


test('final app policy rejects fullscreen and mixed personal/friend customization', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'magic-display-policy-'));
  const route = 'zz1';
  const app = path.join(fixture, route);
  await mkdir(app);
  const manifest = path.join(app, 'manifest.webmanifest');
  const html = path.join(app, 'index.html');
  try {
    await writeFile(manifest, JSON.stringify({ display: 'standalone' }));
    await writeFile(html, '<body data-magic-app="stopwatch"></body>');
    await verifyAppDisplayPolicy(fixture, [route]);
    await writeFile(manifest, JSON.stringify({ display: 'fullscreen' }));
    await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /must remain standalone/);
    await writeFile(manifest, JSON.stringify({ display: 'standalone', display_override: ['fullscreen'] }));
    await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /must remain standalone/);
    await writeFile(manifest, JSON.stringify({ display: 'standalone' }));
    await writeFile(html, '<body data-magic-customize="off"></body>');
    await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /customization policy/);
    await writeFile(html, '<body></body><script>document.documentElement.requestFullscreen()</script>');
    await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /Fullscreen is disabled/);
    const shared = path.join(fixture, 'tools', 'release');
    await mkdir(shared, { recursive: true });
    await writeFile(path.join(shared, 'manifest.webmanifest'), JSON.stringify({ display: 'standalone' }));
    await writeFile(path.join(shared, 'index.html'), '<body></body>');
    await assert.rejects(verifyAppDisplayPolicy(fixture, ['tools/release']), /customization policy/);
    await writeFile(path.join(shared, 'index.html'), '<body data-magic-customize="off"></body>');
    await verifyAppDisplayPolicy(fixture, ['tools/release']);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('fullscreen exception is limited to RELEASE index files with the rewind function', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'magic-rewind-policy-'));
  const fullscreen = '<script>function enterRewindFullscreen() { document.documentElement.requestFullscreen(); }</script>';
  try {
    for (const route of ['zz2', 'tools/release', 'zz1']) {
      const app = path.join(fixture, route);
      await mkdir(app, { recursive: true });
      await writeFile(path.join(app, 'manifest.webmanifest'), JSON.stringify({ display: 'standalone' }));
      const body = route.startsWith('tools/') ? '<body data-magic-customize="off"></body>' : '<body></body>';
      await writeFile(path.join(app, 'index.html'), body + fullscreen);
      if (route === 'zz1') {
        await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /Fullscreen is disabled/);
      } else {
        await verifyAppDisplayPolicy(fixture, [route]);
        await writeFile(path.join(app, 'index.html'), body + '<script>document.documentElement.requestFullscreen()</script>');
        await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /Fullscreen is disabled/);
        await writeFile(path.join(app, 'index.html'), body + fullscreen);
        await writeFile(path.join(app, 'extra.js'), fullscreen);
        await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /Fullscreen is disabled/);
      }
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

// Manifest id resolves against start_url's origin, not the manifest directory (W3C 1.11).
test('all final apps resolve to distinct install identities', async () => {
  await buildPublic();
  const origin = 'https://kalimagic.netlify.app';
  const routes = [...PUBLIC_DIRS.filter((entry) => /^zz\d+$/.test(entry)), ...DISTRIBUTION_APPS.map((app) => `tools/${app.target}`)];
  const ids = [];
  for (const route of routes) {
    const manifest = JSON.parse(await readFile(new URL(`../../dist/${route}/manifest.webmanifest`, import.meta.url), 'utf8'));
    const start = new URL(manifest.start_url, `${origin}/${route}/manifest.webmanifest`);
    const id = manifest.id ? new URL(manifest.id, start.origin + '/') : start;
    ids.push(id.href);
    if (route.startsWith('tools/')) assert.equal(id.href, `${origin}/${route}/`);
  }
  assert.equal(new Set(ids).size, routes.length, JSON.stringify(ids));
  assert.ok(ids.includes(origin + '/zz13/'));
});
