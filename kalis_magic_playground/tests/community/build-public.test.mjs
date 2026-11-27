import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, PUBLIC_DIRS, PRIVATE_PATTERNS, DISTRIBUTION_APPS, SHARED_UNLOCK_FILES, SETTINGS_UI_FILES, buildPublic, verifyAppDisplayPolicy, injectLegacyMigration, injectLegacyShellModules } from '../../scripts/build-public.mjs';
import { BELL_PUBLIC_BETA, SLOT_PUBLIC_BETA } from '../../netlify/edge-functions/tools-gate.mjs';
import { ZZ_IMPORT_FILES, zzImportFiles, injectZzImport, transformZzImportWorker } from '../../scripts/zz-import-build.mjs';
const zzFiles = target => zzImportFiles(target).map(file => `zz-import/${file}`);
async function assertZzModules(directory, root) {
  for (const file of zzImportFiles(path.basename(directory))) assert.deepEqual(await readFile(path.join(directory, 'zz-import', file)), await readFile(path.join(root, 'zz-import', file)), `ZZ import module ${file}`);
}

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

test('distribution catalog uses canonical snapshots', () => {
  assert.deepEqual(PUBLIC_DIRS.filter(route => /^zz\d+$/.test(route)), []);
  assert.deepEqual(DISTRIBUTION_APPS, [
    ...['asrai', 'alter', 'uramichi'].map(name => ({ source: `distribution-snapshots/${name}`, target: name, tool: name })),
    { source: 'distribution-snapshots/memdeck', target: 'memdeck', tool: 'memdeck' },
    { source: 'distribution-snapshots/bell', target: 'bell', tool: 'bell' },
    { source: 'distribution-snapshots/slot', target: 'slot', tool: 'slot' },
    { source: 'distribution-snapshots/gwayubulgeup', target: 'gwayubulgeup', tool: 'gwayubulgeup' },
    { source: 'distribution-snapshots/magicshow', target: 'magicshow', tool: 'magicshow' },
    { source: 'distribution-snapshots/planbcafe', target: 'planbcafe', tool: 'planbcafe' },
    { source: 'distribution-snapshots/choice', target: 'choice', tool: 'choice' },
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

test('public build serves integrated stopwatch on both retained entitlement routes', async (t) => {
  await buildPublic();
  for (const route of ['tools/release', 'tools/hitsuzen']) {
    const appRoot = new URL(`../../dist/${route}/`, import.meta.url);
    assert.match(await readFile(new URL('index.html', appRoot), 'utf8'), /src=["']\.\/performance-link\.js["']/);
    assert.match(await readFile(new URL('sw.js', appRoot), 'utf8'), /performance-link\.js/);
    const source = DISTRIBUTION_APPS.find(app => route === `tools/${app.target}`).source;
    assert.deepEqual(await readFile(new URL('performance-link.js', appRoot)),
      await readFile(new URL(`../../${source}/performance-link.js`, import.meta.url)));
  }

  for (const [tool, isPublic] of [['bell', BELL_PUBLIC_BETA], ['slot', SLOT_PUBLIC_BETA]]) {
    await t.test(`${tool} ships the selected HTML guard and worker policy`, async () => {
      const root = new URL(`../../dist/tools/${tool}/`, import.meta.url);
      const html = await readFile(new URL('index.html', root), 'utf8');
      assert.equal(html.split('id="friend-apps-check"').length - 1, isPublic ? 0 : 1);
      assert.equal(html.includes(`/tools/_check?tool=${tool}`), !isPublic);
      assert.match(html, /data-magic-customize="off"/);

      const worker = await readFile(new URL('sw.js', root), 'utf8');
      const snapshot = await readFile(new URL(`../../distribution-snapshots/${tool}/sw.js`, import.meta.url), 'utf8');
      if (!isPublic) {
        assert.equal(worker, snapshot);
        return;
      }
      assert.match(worker, /-public-beta';/);
      const scope = `https://example.test/tools/${tool}/`;
      const listeners = new Map();
      const login = Response.redirect('https://example.test/tools/login/', 302);
      const fetch = t.mock.fn(async (_request, options) => {
        assert.equal(options.cache, 'no-store');
        return login;
      });
      let precached;
      vm.runInNewContext(worker, {
        URL, Request, Response, fetch,
        self: { registration: { scope, active: true }, addEventListener: (event, listener) => listeners.set(event, listener) },
        caches: { open: async () => ({ addAll: async (requests) => { precached = Array.from(requests, ({ url }) => url); } }) }
      });
      let install;
      listeners.get('install')({ waitUntil: promise => { install = promise; } });
      await install;
      assert.ok(precached.some(url => url.endsWith('/app.mjs')));
      assert.ok(!precached.includes(scope + 'index.html'));
      for (const file of ['', 'index.html']) {
        let response;
        listeners.get('fetch')({ request: new Request(scope + file), respondWith: promise => { response = promise; } });
        assert.equal(await response, login);
      }
      assert.equal(fetch.mock.callCount(), 2);
    });
  }
  const sharedUnlock = await readFile(new URL('../../dist/tools/release/index.html', import.meta.url), 'utf8');
  const sharedStopwatch = await readFile(new URL('../../dist/tools/kairos/index.html', import.meta.url), 'utf8');
  const sharedCalculator = await readFile(new URL('../../dist/tools/hitsuzen/index.html', import.meta.url), 'utf8');
  const sharedAletheia = await readFile(new URL('../../dist/tools/aletheia/index.html', import.meta.url), 'utf8');
  const sharedUsotsuki = await readFile(new URL('../../dist/tools/usotsuki/index.html', import.meta.url), 'utf8');

  for (const html of [sharedUsotsuki]) {
    assert.match(html, /id="scan-duration"/);
    assert.match(html, /id="vibration-level"/);
  }
  const legacyStopwatch = await readFile(new URL('../../dist/tools/kairos-classic/index.html', import.meta.url), 'utf8');

  assert.match(sharedUnlock, /id="friend-apps-check"/);
  assert.match(sharedUnlock, /tools\/_check\?tool=unlock/);
  assert.doesNotMatch(sharedUnlock, /data-magic-customize="off"/);
  for (const html of [sharedStopwatch, sharedCalculator, sharedAletheia, sharedUsotsuki]) assert.match(html, /data-magic-customize="off"/);

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
  assert.equal(stripGate(legacyStopwatch).replaceAll('friend-kairos-classic', 'friend-kairos').replaceAll('target: "kairos-classic"', 'target: "kairos"').replaceAll('=== "stopwatch"', '=== "stopwatch-uni"').replaceAll('data-zz-bootstrap="kairos-classic"', 'data-zz-bootstrap="kairos"'), stripGate(sharedStopwatch));
  const sharedQr = new URL('../../dist/tools/arosaegida/', import.meta.url);
  const sharedQrHtml = await readFile(new URL('index.html', sharedQr), 'utf8');
  assert.match(sharedQrHtml, /tools\/_check\?tool=arosaegida/);
  assert.match(sharedQrHtml, /data-magic-customize="off"/);
  assert.match(sharedQrHtml, /아로새기다/);
  assert.deepEqual(await readFile(new URL('brand-logo.png', sharedQr)), await readFile(new URL('../../distribution-snapshots/qr/brand-logo.png', import.meta.url)));
  assert.match(await readFile(new URL('sw.js', sharedQr), 'utf8'), /scope\.pathname\.startsWith\('\/tools\/'\)/);
  for (const route of DISTRIBUTION_APPS.map((app) => 'tools/' + app.target)) {
    const fullscreen = new URL('../../dist/' + route + '/fullscreen.js', import.meta.url);
    // Choice publishes the compatibility stub. It must not request fullscreen. Every other route omits the file.
    if (route === 'tools/choice') {
      const stub = await readFile(fullscreen, 'utf8');
      assert.match(stub, /never request fullscreen/);
      assert.doesNotMatch(stub, /\b(?:requestFullscreen|webkitRequestFullscreen|webkitRequestFullScreen|mozRequestFullScreen|msRequestFullscreen)\b/);
      continue;
    }
    await assert.rejects(stat(fullscreen), { code: 'ENOENT' });
  }
  const qrManifest = JSON.parse(await readFile(new URL('manifest.webmanifest', sharedQr), 'utf8'));
  assert.equal(qrManifest.scope, './');
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

test('legacy shell injection appends legacy-1 before a distribution suffix and stays idempotent', () => {
  const distributed = [
    "const CACHE_NAME = CACHE_PREFIX + 'v20261004-coherent-1-distribution';",
    'const SHELL = [',
    '  "./index.html"',
    '];',
    ''
  ].join('\n');
  const once = injectLegacyShellModules(distributed);
  assert.equal(injectLegacyShellModules(once), once);
  assert.match(once, /const CACHE_NAME = CACHE_PREFIX \+ 'v20261004-coherent-1-legacy-1-distribution';/);
  assert.doesNotMatch(once, /-distribution-legacy-1/);
  assert.match(once, /"\.\/legacy-shared-contract\.mjs"/);
  assert.match(once, /"\.\/legacy-storage-migration\.mjs"/);
  const plain = distributed.replace('-distribution', '');
  const plainOnce = injectLegacyShellModules(plain);
  assert.equal(injectLegacyShellModules(plainOnce), plainOnce);
  assert.match(plainOnce, /const CACHE_NAME = CACHE_PREFIX \+ 'v20261004-coherent-1-legacy-1';/);
});

test('both KAIROS routes use the canonical snapshot', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const snapshotDir = path.join(root, 'distribution-snapshots', 'kairos');
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
    assert.deepEqual(await filesUnder(distributedDir), [...snapshotFiles, 'legacy-shared-contract.mjs', 'legacy-storage-migration.mjs', ...zzFiles()].sort(), target);
    for (const file of ['legacy-shared-contract.mjs', 'legacy-storage-migration.mjs']) assert.deepEqual(await readFile(path.join(distributedDir, file)), await readFile(path.join(root, 'scripts', file)), `${target}/${file}`);
    await assertZzModules(distributedDir, root);
    const prefix = `friend-${target}_`;
    for (const file of snapshotFiles) {
      const [snapshotBytes, distributedBytes] = await Promise.all([
        readFile(path.join(snapshotDir, file)),
        readFile(path.join(distributedDir, file)),
      ]);
      let comparable = distributedBytes;
      let expected = snapshotBytes;
      if (file === 'index.html') {
        const snapshotHtml = snapshotBytes.toString('utf8');
        const isolate = (html) => html
          .replaceAll('stopwatch_', prefix)
          .replaceAll('stopwatch2_', `friend-${target}-legacy_`)
          .replaceAll('stopwatch-settings-entry-tutorial-', `friend-${target}-settings-entry-tutorial-`)
          .replace(/<body\b/, '<body data-magic-customize="off"');
        comparable = Buffer.from(distributedBytes.toString('utf8').replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, ''));
        // The snapshot loads its app from ./app.js, so its HTML carries no inline startup hook; app.js is checked below.
        assert.equal(snapshotHtml.includes('else initApp();'), false);
        expected = Buffer.from(injectZzImport(isolate(snapshotHtml), target));
        const html = distributedBytes.toString('utf8');
        assert.match(html, new RegExp(`tools\\/_check\\?tool=${tool}`));
        assert.doesNotMatch(html, /["']stopwatch_/);
        assert.doesNotMatch(html, /["']stopwatch2_/);
        assert.doesNotMatch(html, /["']stopwatch-settings-entry-tutorial-/);
        assert.match(html, /src="\.\/app\.js"/);
        assert.match(html, /href="\.\/style\.css"/);
      } else if (['app.js', 'settings-swipe.js', 'selftest.js', 'settings-tutorial.js', 'wake-lock.js', 'install-nudge.js', 'sw-register.js', 'style.css'].includes(file)) {
        // These files used to be inline in index.html, so they get the same per-target key isolation (and app.js the startup hook).
        const isolate = (source) => source
          .replaceAll('stopwatch_', prefix)
          .replaceAll('stopwatch2_', `friend-${target}-legacy_`)
          .replaceAll('stopwatch-settings-entry-tutorial-', `friend-${target}-settings-entry-tutorial-`);
        const script = distributedBytes.toString('utf8');
        comparable = Buffer.from(script);
        expected = Buffer.from(file === 'app.js' ? injectLegacyMigration(isolate(snapshotBytes.toString('utf8')), target) : isolate(snapshotBytes.toString('utf8')));
        assert.doesNotMatch(script, /["']stopwatch_/);
        assert.doesNotMatch(script, /["']stopwatch2_/);
        assert.doesNotMatch(script, /["']stopwatch-settings-entry-tutorial-/);
        if (file === 'app.js') {
          assert.match(script, new RegExp(`${prefix}preset_cs`));
          assert.match(script, new RegExp(`${prefix}ui_mode`));
          assert.match(script, /legacy-storage-migration\.mjs/);
          assert.equal(script.includes('else initApp();'), false);
        }
        if (file === 'settings-tutorial.js') assert.match(script, new RegExp(`friend-${target}-settings-entry-tutorial-v1`));
      } else if (file === 'logic.js') {
        const isolate = (source) => source.replaceAll('stopwatch_', prefix).replaceAll('stopwatch2_', `friend-${target}-legacy_`);
        const logic = distributedBytes.toString('utf8');
        comparable = Buffer.from(logic);
        expected = Buffer.from(isolate(snapshotBytes.toString('utf8')));
        assert.match(logic, new RegExp(`${prefix}preset_cs`));
        assert.match(logic, new RegExp(`friend-${target}-legacy_preset_cs`));
        assert.match(logic, new RegExp(`${prefix}storage_migrated_v2`));
        assert.doesNotMatch(logic, /["']stopwatch_/);
        assert.doesNotMatch(logic, /["']stopwatch2_/);
      } else if (file === 'manifest.webmanifest') {
        expected = Buffer.from(JSON.stringify({ ...JSON.parse(snapshotBytes), id: `/tools/${target}/`, start_url: './', scope: './' }, null, 2) + '\n');
      } else if (file === 'sw.js') {
        const snapshotSource = snapshotBytes.toString('utf8');
        const injected = injectLegacyShellModules(snapshotSource);
        assert.equal(injectLegacyShellModules(injected), injected);
        assert.match(injected, /const CACHE_NAME = CACHE_PREFIX \+ '[^']*-legacy-1';/);
        assert.doesNotMatch(snapshotSource, /-legacy-1/);
        expected = Buffer.from(transformZzImportWorker(injected, target));
      }
      assert.deepEqual(comparable, expected, `${target}/${file} must follow the kairos snapshot`);
    }
  }
});

test('shared unlock stays on the pinned snapshot until explicit promotion', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const source = path.join(root, 'distribution-snapshots', 'unlock');
  const target = path.join(root, 'dist', 'tools', 'release');
  const copiedFiles = (await readdir(target)).sort();
  assert.deepEqual(copiedFiles, [...SHARED_UNLOCK_FILES, ...SETTINGS_UI_FILES, 'zz-import'].sort());
  assert.deepEqual((await readdir(path.join(target, 'zz-import'))).sort(), [...ZZ_IMPORT_FILES].sort());
  await assertZzModules(target, root);

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
      assert.doesNotMatch(distributed.toString('utf8'), /data-magic-customize="off"/);
      assert.equal(withoutGuard, injectZzImport(snapshot.toString('utf8'), 'release'));
    } else if (file === 'manifest.webmanifest') {
      const expected = { ...JSON.parse(snapshot), id: '/tools/release/', start_url: './', scope: './' };
      assert.deepEqual(JSON.parse(distributed), expected);

    } else if (file === 'sw.js') {
      assert.equal(distributed.toString('utf8'), transformZzImportWorker(snapshot.toString('utf8'), 'release'));
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
    assert.deepEqual(await filesUnder(target), [...sourceFiles, ...zzFiles()].sort(), `${app} file inventory`);
    await assertZzModules(target, root);
    const manifest = JSON.parse(await readFile(path.join(target, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.id, `/tools/${app}/`);
    for (const file of sourceFiles) {
      const [sourceBytes, targetBytes] = await Promise.all([
        readFile(path.join(snapshot, file)), readFile(path.join(target, file))
      ]);
      if (file === 'index.html') {
        const html = targetBytes.toString('utf8');
        assert.match(html, new RegExp(`tools\\/_check\\?tool=${app}`));
        assert.equal(html.replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, ''), injectZzImport(injectLegacyMigration(sourceBytes.toString('utf8').replace(/<body\b/, '<body data-magic-customize="off"'), typeof app === 'string' ? app : app.target), typeof app === 'string' ? app : app.target));
      } else if (file === 'manifest.webmanifest') {
        assert.deepEqual(JSON.parse(targetBytes), { ...JSON.parse(sourceBytes), id: `/tools/${app}/`, start_url: './', scope: './' });
      } else if (file === 'sw.js') {
        assert.equal(targetBytes.toString('utf8'), transformZzImportWorker(sourceBytes.toString('utf8'), app));
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
    assert.deepEqual(await filesUnder(target), [...sourceFiles, ...additional, ...zzFiles(app.target)].sort(), `${app.target} file inventory`);
    await assertZzModules(target, root);
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
        assert.equal(html.replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, ''), injectZzImport(injectLegacyMigration(sourceBytes.toString('utf8').replace(/<body\b/, '<body data-magic-customize="off"'), typeof app === 'string' ? app : app.target), typeof app === 'string' ? app : app.target));
      } else if (file === 'manifest.webmanifest') {
        const manifest = JSON.parse(targetBytes);
        assert.equal(manifest.id, `/tools/${app.target}/`);
        assert.equal(manifest.start_url, './');
        assert.equal(manifest.scope, './');
        assert.deepEqual(manifest, { ...JSON.parse(sourceBytes), id: `/tools/${app.target}/`, start_url: './', scope: './' });
      } else if (file === 'sw.js' && app.target === 'hitsuzen') {
        const snapshotSource = sourceBytes.toString('utf8');
        const injected = injectLegacyShellModules(snapshotSource);
        assert.equal(injectLegacyShellModules(injected), injected);
        assert.match(injected, /const CACHE_NAME = CACHE_PREFIX \+ '[^']*-legacy-1';/);
        assert.doesNotMatch(injected, /-legacy-1-legacy-1/);
        assert.doesNotMatch(snapshotSource, /-legacy-1/);
        assert.equal(targetBytes.toString('utf8'), transformZzImportWorker(injected, app.target));
      } else if (file === 'sw.js') {
        assert.equal(targetBytes.toString('utf8'), transformZzImportWorker(sourceBytes.toString('utf8'), app.target));
      } else {
        assert.deepEqual(targetBytes, sourceBytes, `${app.target}/${file}`);
      }
    }
  }
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
  const route = 'tools/release';
  const app = path.join(fixture, route);
  await mkdir(app, { recursive: true });
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
    await verifyAppDisplayPolicy(fixture, ['tools/release']);
    await writeFile(path.join(shared, 'index.html'), '<body data-magic-customize="off"></body>');
    await assert.rejects(verifyAppDisplayPolicy(fixture, ['tools/release']), /customization policy/);
    const other = path.join(fixture, 'tools', 'kairos');
    await mkdir(other, { recursive: true });
    await writeFile(path.join(other, 'manifest.webmanifest'), JSON.stringify({ display: 'standalone' }));
    await writeFile(path.join(other, 'index.html'), '<body></body>');
    await assert.rejects(verifyAppDisplayPolicy(fixture, ['tools/kairos']), /customization policy/);
    await writeFile(path.join(other, 'index.html'), '<body data-magic-customize="off"></body>');
    await verifyAppDisplayPolicy(fixture, ['tools/kairos']);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('fullscreen exception is limited to RELEASE index and pin files with the rewind function', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'magic-rewind-policy-'));
  const fullscreen = '<script>function enterRewindFullscreen() { document.documentElement.requestFullscreen(); }</script>';
  try {
    for (const route of ['tools/release', 'tools/kairos']) {
      const app = path.join(fixture, route);
      await mkdir(app, { recursive: true });
      await writeFile(path.join(app, 'manifest.webmanifest'), JSON.stringify({ display: 'standalone' }));
      const body = route === 'tools/kairos' ? '<body data-magic-customize="off"></body>' : '<body></body>';
      await writeFile(path.join(app, 'index.html'), body + fullscreen);
      if (route === 'tools/kairos') {
        await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /Fullscreen is disabled/);
      } else {
        await verifyAppDisplayPolicy(fixture, [route]);
        await writeFile(path.join(app, 'index.html'), body + '<script>document.documentElement.requestFullscreen()</script>');
        await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /Fullscreen is disabled/);
        await writeFile(path.join(app, 'index.html'), body + fullscreen);
        await writeFile(path.join(app, 'pin.js'), fullscreen);
        await verifyAppDisplayPolicy(fixture, [route]);
        await writeFile(path.join(app, 'extra.js'), fullscreen);
        await assert.rejects(verifyAppDisplayPolicy(fixture, [route]), /Fullscreen is disabled/);
      }
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('all final apps resolve to distinct install identities', async () => {
  await buildPublic();
  const origin = 'https://kalimagic.netlify.app';
  const routes = DISTRIBUTION_APPS.map((app) => `tools/${app.target}`);
  const ids = [];
  for (const route of routes) {
    const manifest = JSON.parse(await readFile(new URL(`../../dist/${route}/manifest.webmanifest`, import.meta.url), 'utf8'));
    const start = new URL(manifest.start_url, `${origin}/${route}/manifest.webmanifest`);
    const id = manifest.id ? new URL(manifest.id, start.origin + '/') : start;
    ids.push(id.href);
    if (route === 'tools/planbcafe') {
      assert.equal(manifest.id, '/tools/planbcafe/');
      assert.equal(id.href, `${origin}/tools/planbcafe/`);
    } else if (route.startsWith('tools/')) assert.equal(id.href, `${origin}/${route}/`);
  }
  assert.equal(new Set(ids).size, routes.length, JSON.stringify(ids));
  assert.ok(ids.includes(origin + '/tools/arosaegida/'));
});
