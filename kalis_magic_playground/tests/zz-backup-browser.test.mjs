// ZZ_BACKUP_LEGACY and ZZ_BACKUP_CANDIDATE are directories containing built zzN app shells.
// Copy or extract the last pre-backup release's dist to a separate directory before building the candidate.
// Point ZZ_BACKUP_LEGACY at that archived directory; do not point both inputs at a current build.
// Run with `node --test tests/zz-backup-browser.test.mjs`. Set CHROME_BIN/PLAYWRIGHT_CORE if needed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import test from 'node:test';
import { appIds, fixtures, hash, photoPresets, photoSets } from './zz-backup-fixtures.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const legacy = process.env.ZZ_BACKUP_LEGACY;
const candidate = path.resolve(process.env.ZZ_BACKUP_CANDIDATE || path.join(cwd, 'dist'));
const browserPath = process.env.CHROME_BIN;
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const timeout = 10000;

function launch(profile, options = {}) {
  return chromium.launchPersistentContext(path.join(profile, 'chrome'), {
    executablePath: browserPath, headless: true, acceptDownloads: true, downloadsPath: profile,
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...options,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
}

async function browserTools(page) {
  await page.evaluate(() => {
    const request = req => new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const done = tx => new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    const name = 'zz-migration-v1';
    async function backup(operation) {
      if (!(await indexedDB.databases()).some(db => db.name === name)) return null;
      const db = await request(indexedDB.open(name));
      try { return await operation(db); }
      finally { db.close(); }
    }
    function get(db, store, key) {
      return request(db.transaction(store).objectStore(store).get(key));
    }
    async function digest(blob) {
      const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
    }
    window.fixture = {
      async deleteMedia({ dbName, store, key }) {
        const db = await request(indexedDB.open(dbName));
        try {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).delete(key);
          await done(tx);
        } finally { db.close(); }
      },
      async seedMedia({ dbName, store, refs }) {
        const opening = indexedDB.open(dbName, 1);
        opening.onupgradeneeded = () => opening.result.createObjectStore(store);
        const db = await request(opening);
        try {
          const blobs = await Promise.all(refs.map(async ref => (await fetch(`/fixture-media/${ref.sha256}`)).blob()));
          const tx = db.transaction(store, 'readwrite');
          const finished = done(tx);
          for (const [i, ref] of refs.entries()) {
            const value = ref.recordMeta ? { ...ref.recordMeta, blob: blobs[i] } : blobs[i];
            tx.objectStore(store).put(value, ref.key);
          }
          await finished;
        } finally { db.close(); }
      },
      async head(appId) {
        return backup(async db => {
          const key = await get(db, 'heads', appId);
          return key ? get(db, 'snapshots', key) : null;
        });
      },
      async keys(store) {
        return backup(db => request(db.transaction(store).objectStore(store).getAllKeys()));
      },
      async metadata(ref) {
        return backup(async db => {
          const blob = await get(db, 'media', ref.sha256);
          const image = await createImageBitmap(blob);
          try { return { sha256: await digest(blob), size: blob.size, type: blob.type, width: image.width }; }
          finally { image.close(); }
        });
      },
    };
  });
}

function normalizeRefs(refs) {
  return refs.map(({ db, store, key, type, size, sha256, recordMeta, valueShape }) => ({ db, store, key, type, size, sha256, recordMeta: recordMeta || {}, valueShape })).sort((a, b) => a.key.localeCompare(b.key));
}

function validateSnapshot(snapshot, { appId, origin, raw, media }) {
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.appId, appId);
  assert.equal(snapshot.sourceOrigin, origin);
  assert.equal(snapshot.sourcePath, `/${appId}/`);
  assert.ok(snapshot.buildId && Number.isFinite(Date.parse(snapshot.createdAt)));
  assert.equal(snapshot.snapshotId, `${appId}:${snapshot.contentHash}`);
  assert.equal(snapshot.contentHash, hash(JSON.stringify([appId, snapshot.rawEntries, snapshot.mediaRefs])));
  for (const [key, expected] of Object.entries(raw)) assert.equal(snapshot.rawEntries[key], expected, `${appId}: ${key}`);
  assert.equal(snapshot.counts.rawEntries, Object.keys(snapshot.rawEntries).length);
  assert.equal(snapshot.counts.mediaRefs, media.length);
  assert.deepEqual(normalizeRefs(snapshot.mediaRefs), normalizeRefs(media.map(ref => ({ ...ref, valueShape: ref.recordMeta ? 'record' : 'blob' }))));
}

async function poll(read, label) {
  const until = Date.now() + timeout;
  do {
    const value = await read();
    if (value) return value;
    await pause(50);
  } while (Date.now() < until);
  assert.fail(`Timed out waiting for ${label}`);
}

function waitUntilHead(page, appId, key, value) {
  return poll(() => page.evaluate(async ({ appId, key, value }) => {
    const head = await window.fixture.head(appId);
    return head && (!key || head.rawEntries[key] === value) ? head : false;
  }, { appId, key, value }), `${appId} committed head${key ? ` with ${key}=${value}` : ''}`);
}

async function checkDomainItems(harness) {
  const choice = await harness.evaluate(() => window.fixture.head('zz4'));
  const state = JSON.parse(choice.rawEntries['magic-choice.v1.store']);
  assert.deepEqual([state.presets.length, state.presets[0].items.length, state.sets.length, state.dummyNotes.length], [1, 2, 1, 1]);
  assert.equal(state.sets[0].presetIds[0], state.presets[0].id);
  assert.equal(state.sets[0].dummyIds[0], state.dummyNotes[0].id);
  assert.ok(choice.mediaRefs.some(ref => ref.key === state.options.wallpaperKey));
  assert.equal(JSON.parse(choice.rawEntries['magic-choice.v1.user-icons']).length, 1);
  assert.equal(JSON.parse(choice.rawEntries['magic-choice.performance-log.v1']).length, 2);
  const aletheia = await harness.evaluate(() => window.fixture.head('zz5'));
  const sets = JSON.parse(aletheia.rawEntries['aletheia.photoSets.v2']).sets;
  assert.deepEqual(sets.map(set => set.length), [12, 12, 12]);
  assert.deepEqual(sets.flat().filter(Boolean), aletheia.mediaRefs.map(ref => ref.key));
  console.log('CHOICE 1 preset/2 items/1 set/1 note/1 icon/2 records; ALETHEIA 3 sets × 12 cells, all photo references resolve.');
}

async function downloadBackup(page, profile, appId) {
  const button = page.locator(`[data-zz-backup="${appId}"] button`);
  await button.waitFor({ state: 'attached', timeout });
  // Exercise the existing control even when the app's own settings pane starts closed.
  const event = page.waitForEvent('download', { timeout });
  await button.evaluate(node => node.click());
  const download = await event;
  const filename = path.join(profile, download.suggestedFilename());
  await download.saveAs(filename);
  return filename;
}

async function webServer() {
  const updated = new Set();
  const navigations = [];
  let stage = 'legacy';
  let fault;
  let sample;
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname.replace(/^\//, '').replace(/\/$/, '/index.html');
    const appId = file.split('/')[0];
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers['sec-fetch-mode'] === 'navigate' && appIds.includes(appId)) navigations.push([stage, pathname]);
    if (file === 'fixture.html') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>ZZ backup fixture</title>'); return; }
    if (file.startsWith('fixture-media/')) { res.setHeader('Content-Type', 'image/png'); res.end(sample.blobs[file.split('/')[1]]); return; }
    if (!appIds.includes(appId)) { res.writeHead(404).end(); return; }
    const pinLegacyWorker = file.endsWith('/sw.js') && !updated.has(appId);
    const root = stage === 'legacy' || pinLegacyWorker ? path.resolve(legacy) : candidate;
    try {
      let body = await readFile(path.join(root, file));
      if (fault && file.includes('/zz-backup-') && file.endsWith('/media-worker.mjs')) {
        body = Buffer.concat([Buffer.from(fault[file.split('/')[0]] || ''), body]);
      }
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  sample = fixtures(origin);
  return { origin, sample, updated, navigations, stage(value) { stage = value; }, fault(value) { fault = value; }, async close() {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  } };
}

function trackPlatformCalls() {
  window.platformCalls = [];
  function watch(target, name) {
    const original = target?.[name];
    if (!original) return;
    target[name] = function (...args) {
      window.platformCalls.push({ name, args, activation: navigator.userActivation.isActive });
      return original.apply(this, args);
    };
  }
  watch(navigator.wakeLock, 'request');
  watch(navigator.mediaDevices, 'getUserMedia');
  watch(navigator.permissions, 'query');
  watch(navigator.storage, 'persist');
  watch(window.DeviceOrientationEvent, 'requestPermission');
  watch(window.DeviceMotionEvent, 'requestPermission');
}

async function startupCalls(page) {
  await page.waitForLoadState('load');
  return page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.platformCalls.slice();
  });
}

async function firstInteraction(page, appId) {
  if (appId === 'zz4') {
    await page.locator('#new-list').click({ timeout });
    await page.locator('#view-w1').waitFor({ state: 'visible', timeout });
  } else if (appId === 'zz10') {
    await page.locator('#start').click({ timeout });
    await page.waitForFunction(() => window.platformCalls.some(call => call.name === 'getUserMedia'), null, { timeout });
  }
}

async function legacyBehavior(context, origin) {
  const baseline = new Map();
  for (const appId of appIds) {
    const page = await context.newPage();
    try {
      await page.addInitScript(trackPlatformCalls);
      assert.ok((await page.goto(`${origin}/${appId}/`)).ok());
      const startup = await startupCalls(page);
      await firstInteraction(page, appId);
      const after = await startupCalls(page);
      baseline.set(appId, { startup, interaction: after.slice(startup.length) });
    } finally { await page.close(); }
  }
  assert.ok(baseline.get('zz3').startup.some(call => call.name === 'request' && call.args[0] === 'screen'), 'calculator keeps the display awake on startup');
  assert.ok(!baseline.get('zz10').startup.some(call => call.name === 'getUserMedia'), 'ALTER starts without requesting camera access');
  assert.ok(baseline.get('zz10').interaction.some(call => call.name === 'getUserMedia' && call.activation), 'ALTER starts camera only on the explicit native click');
  return baseline;
}

async function enableLegacyWorkers(context, { origin }) {
  for (const appId of appIds) {
    const page = await context.newPage();
    try {
      assert.ok((await page.goto(`${origin}/${appId}/`, { waitUntil: 'load' })).ok(), appId);
      await page.evaluate(async () => navigator.serviceWorker.register('./sw.js'));
      await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout });
      assert.equal(await page.evaluate(async () => Boolean(await caches.match('./open-backup-v1.html'))), false, `${appId}: new URL absent from previous shell`);
    } finally { await page.close(); }
  }
}

async function openOnce(context, harness, server, appId, baseline) {
  const url = `${server.origin}/${appId}/open-backup-v1.html`;
  const page = await context.newPage();
  const navigations = [];
  page.on('request', req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) navigations.push(req.url()); });
  const diagnostics = [];
  await page.addInitScript(trackPlatformCalls);
  page.on('pageerror', error => diagnostics.push(error.message));
  page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
  await page.addInitScript(() => {
    sessionStorage.setItem('stopwatch2_text_at', 'fixture-session-only');
    window.initialController = navigator.serviceWorker.controller?.scriptURL;
    window.accountedTasks = [];
    new PerformanceObserver(list => window.accountedTasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })))).observe({ type: 'longtask', buffered: true });
  });
  try {
    assert.ok((await page.goto(url, { waitUntil: 'domcontentloaded' })).ok(), appId);
    assert.equal(await page.evaluate(() => window.initialController), `${server.origin}/${appId}/sw.js`);
    assert.equal(page.url(), `${server.origin}/${appId}/`);
    const startup = await startupCalls(page);
    assert.deepEqual(startup, baseline.startup, `${appId}: startup wake-lock, camera and permission calls`);
    if (appId === 'zz4') {
      await firstInteraction(page, appId);
      assert.equal(await harness.evaluate(() => window.fixture.head('zz4')), null, 'CHOICE handled its first native interaction before backup completed');
    }
    const snapshot = await waitUntilHead(harness, appId);
    const tasks = await page.evaluate(() => {
      const ready = performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd;
      return window.accountedTasks.filter(task => task.startTime >= ready);
    });
    assert.deepEqual(navigations, [url], `${appId}: no automatic navigation or reload`);
    assert.deepEqual(tasks, [], `${appId}: 50ms main-thread long tasks after initial app load`);
    if (appId === 'zz10') {
      // Camera setup may be costly in both releases. Measure the backup before launching it.
      assert.deepEqual(await startupCalls(page), baseline.startup, 'ALTER backup does not begin a camera or permission request');
      await firstInteraction(page, appId);
    }
    const after = await startupCalls(page);
    assert.deepEqual(after.slice(startup.length), baseline.interaction, `${appId}: wake-lock, camera and permission calls through first input`);
    return snapshot;
  } catch (error) {
    if (diagnostics.length) console.log(`${appId} browser diagnostics: ${diagnostics.join(' | ')}`);
    throw error;
  } finally { await page.close(); }
}

async function exerciseWorkerFaults(context, harness, server, profile) {
  const appId = 'zz3';
  const setting = 'magic-calc-date-delay';
  const backupStatus = '[data-zz-backup="zz3"] [role="status"]';
  const previous = await waitUntilHead(harness, appId);
  const originalSnapshots = await harness.evaluate(() => window.fixture.keys('snapshots'));
  server.stage('fault');
  const failures = [
    ['quota', '저장 공간이 부족합니다.', `
      const openDB = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (name, ...args) {
        if (name === 'zz-migration-v1') throw new DOMException('Fixture quota', 'QuotaExceededError');
        return openDB.call(this, name, ...args);
      };
    `],
    ['aborted-commit', '기기 백업 실패.', `
      const putRecord = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        const request = putRecord.apply(this, args);
        if (this.transaction.db.name === 'zz-migration-v1' && this.name === 'heads') this.transaction.abort();
        return request;
      };
    `],
  ];
  try {
    for (const [mode, label, fault] of failures) {
      server.fault({ [appId]: fault });
      const page = await context.newPage();
      try {
        await harness.evaluate(key => localStorage.setItem(key, '2099'), setting);
        assert.ok((await page.goto(`${server.origin}/${appId}/open-backup-v1.html`)).ok());
        await page.locator(backupStatus).filter({ hasText: label }).waitFor({ state: 'attached', timeout });
        assert.equal((await waitUntilHead(harness, appId)).snapshotId, previous.snapshotId, mode);
        assert.deepEqual(await harness.evaluate(() => window.fixture.keys('snapshots')), originalSnapshots, `${mode}: no partially committed manifest`);
        if (mode === 'quota') {
          const file = await downloadBackup(page, profile, appId);
          assert.equal(JSON.parse(await readFile(file, 'utf8')).rawEntries[setting], '2099');
        }
      } finally { await page.close(); }
    }
    server.fault(null);
    const photoPage = await context.newPage();
    try {
      const original = await waitUntilHead(harness, 'zz4');
      server.fault({ zz4: `
        const openDB = IDBFactory.prototype.open;
        IDBFactory.prototype.open = function (name, ...args) {
          if (name === 'magic-choice.v1.media') throw new DOMException('Fixture read denied', 'SecurityError');
          return openDB.call(this, name, ...args);
        };
      ` });
      assert.ok((await photoPage.goto(`${server.origin}/zz4/open-backup-v1.html`)).ok());
      await photoPage.locator('[data-zz-backup="zz4"] [role="status"]').filter({ hasText: '기기 백업 실패.' }).waitFor({ state: 'attached', timeout });
      assert.equal((await waitUntilHead(harness, 'zz4')).snapshotId, original.snapshotId);
    } finally { await photoPage.close(); }
  } finally {
    await harness.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: setting, value: previous.rawEntries[setting] });
    server.fault(null);
    server.stage('candidate');
  }
}

test('first release with all 14 legacy workers, one new-URL visit per app', { timeout: 240000 }, async (t) => {
  assert.ok(legacy, 'Set ZZ_BACKUP_LEGACY to the pre-release dist');
  const profile = await mkdtemp(path.join(cwd, 'tests', '.zz-backup-profile.'));
  const server = await webServer();
  let context;
  try {
    context = await launch(profile);
    const harness = context.pages()[0] || await context.newPage();
    await harness.goto(`${server.origin}/fixture.html`);
    await browserTools(harness);
    await enableLegacyWorkers(context, server);
    const { origin, sample } = server;
    const sourceEntries = Object.assign({}, ...Object.values(sample.raw), sample.excluded);
    await harness.evaluate(entries => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, sourceEntries);
    for (const refs of Object.values(sample.media)) {
      const [{ db: dbName, store }] = refs;
      await harness.evaluate(fixture => window.fixture.seedMedia(fixture), { dbName, store, refs });
    }
    assert.equal(await harness.evaluate(() => window.fixture.keys('heads')), null, 'legacy release did not create a backup');
    const baseline = await legacyBehavior(context, origin);
    server.stage('candidate');
    const snapshots = new Map();
    for (const appId of appIds) {
      await t.test(appId, async () => {
        const snapshot = await openOnce(context, harness, server, appId, baseline.get(appId));
        snapshots.set(appId, snapshot);
        assert.ok(!Object.hasOwn(snapshot.rawEntries, 'stopwatch2_text_at'), 'sessionStorage was excluded');
        validateSnapshot(snapshot, { appId, origin, raw: sample.raw[appId], media: sample.media[appId] || [] });
        const foreign = Object.assign({}, sourceEntries);
        Object.keys(sample.raw[appId]).forEach(key => delete foreign[key]);
        for (const key of Object.keys(foreign)) assert.ok(!Object.hasOwn(snapshot.rawEntries, key), `${appId}: excluded ${key}`);
        console.log(`${appId}: ${snapshot.counts.rawEntries} exact keys, ${snapshot.counts.mediaRefs} photo references`);
      });
    }
    await t.test('origin preservation, domain counts and hash-deduplicated decodable photos', async () => {
      assert.deepEqual(await harness.evaluate(() => window.fixture.keys('heads')), [...appIds].sort());
      const totals = [...snapshots.values()].reduce((sum, snapshot) => ({
        rawEntries: sum.rawEntries + snapshot.counts.rawEntries,
        mediaRefs: sum.mediaRefs + snapshot.counts.mediaRefs,
      }), { rawEntries: 0, mediaRefs: 0 });
      const blobSizes = Object.values(sample.blobs).map(blob => blob.length);
      console.log(`${totals.rawEntries} raw entries, ${totals.mediaRefs} photo refs, ${blobSizes.length} unique Blobs (${blobSizes.join(', ')} bytes).`);
      await checkDomainItems(harness);
      assert.deepEqual(await harness.evaluate(() => window.fixture.keys('media')), Object.keys(sample.blobs).sort());
      for (const [sha256, bytes] of Object.entries(sample.blobs)) {
        assert.deepEqual(await harness.evaluate(ref => window.fixture.metadata(ref), { sha256 }), { sha256, size: bytes.length, type: 'image/png', width: bytes.readUInt32BE(16) });
      }
      const found = await harness.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(sample.excluded));
      assert.deepEqual(found, sample.excluded);
      for (const appId of appIds) assert.equal(server.navigations.filter(([stage, path]) => stage === 'candidate' && path === `/${appId}/open-backup-v1.html`).length, 1);
    });
    await t.test('read denial, quota with direct file fallback, and transaction abort preserve the last good snapshot', async () => {
      await exerciseWorkerFaults(context, harness, server, profile);
    });
    await t.test('normal icon routes launch offline after new workers activate', async () => {
      for (const appId of appIds) {
        server.updated.add(appId);
        await harness.evaluate(async path => (await navigator.serviceWorker.getRegistration(path)).update(), `/${appId}/`);
        await poll(() => harness.evaluate(async appId => {
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            if (await cache.match(`/${appId}/open-backup-v1.html`)) return true;
          }
          return false;
        }, appId), `${appId} updated shell`);
      }
      await context.setOffline(true);
      try {
        for (const appId of appIds) {
          const manifest = JSON.parse(await readFile(path.join(candidate, appId, 'manifest.webmanifest'), 'utf8'));
          const page = await context.newPage();
          try {
            const url = new URL(manifest.start_url, `${origin}/${appId}/`).href;
            assert.ok((await page.goto(url, { waitUntil: 'domcontentloaded' })).ok(), appId);
            if (['zz12', 'zz14'].includes(appId)) await page.locator('[data-tab="settings"]').click({ timeout });
            await page.locator(`[data-zz-backup="${appId}"] [role="status"]`).filter({ hasText: '이 기기에 백업했습니다.' }).waitFor({ state: 'attached', timeout });
            assert.equal((await waitUntilHead(harness, appId)).snapshotId, snapshots.get(appId).snapshotId);
          } finally { await page.close(); }
        }
      } finally { await context.setOffline(false); }
    });
    await t.test('ongoing edits, two tabs, unchanged re-run, empty source, and JSON/ZIP downloads', async () => {
      const left = await context.newPage();
      const right = await context.newPage();
      try {
        await left.goto(`${origin}/zz3/`);
        await right.goto(`${origin}/zz3/`);
        const setting = 'magic-calc-date-delay';
        const original = await waitUntilHead(harness, 'zz3');
        await left.evaluate(key => localStorage.setItem(key, '2122'), setting);
        await right.evaluate(key => localStorage.setItem(key, '2255'), setting);
        const changed = await waitUntilHead(harness, 'zz3', setting, '2255');
        assert.notEqual(changed.snapshotId, original.snapshotId);
        const manifest = JSON.parse(await readFile(await downloadBackup(left, profile, 'zz3'), 'utf8'));
        assert.equal(manifest.snapshotId, changed.snapshotId);
        await left.reload();
        await left.locator('[data-zz-backup="zz3"] [role="status"]').filter({ hasText: '이 기기에 백업했습니다.' }).waitFor({ state: 'attached', timeout });
        assert.equal((await waitUntilHead(harness, 'zz3')).snapshotId, changed.snapshotId);
        await right.evaluate(keys => keys.forEach(key => localStorage.removeItem(key)), Object.keys(sample.raw.zz3));
        await right.locator('[data-zz-backup="zz3"] [role="status"]').filter({ hasText: '백업할 원본이 없습니다.' }).waitFor({ state: 'attached', timeout });
        assert.equal((await waitUntilHead(harness, 'zz3')).snapshotId, changed.snapshotId);
        await left.goto(`${origin}/zz4/`);
        const archive = await downloadBackup(left, profile, 'zz4');
        const manifestText = execFileSync('/usr/bin/unzip', ['-p', archive, 'manifest.json']);
        const zipped = JSON.parse(manifestText);
        assert.equal(zipped.rawEntries['magic-choice.v1.user-icons'], sample.raw.zz4['magic-choice.v1.user-icons']);
        const [{ sha256 }] = sample.media.zz4;
        assert.equal(hash(execFileSync('/usr/bin/unzip', ['-p', archive, `media/${sha256}`], { maxBuffer: 16 * 1024 * 1024 })), sha256);
      } finally { await left.close(); await right.close(); }
    });
  } finally {
    await context?.close();
    await server.close();
    await rm(profile, { recursive: true, force: true });
  }
});


test('fresh profile: empty source DB is untouched and a photo-only source backs up', { timeout: 30000 }, async () => {
  const profile = await mkdtemp(path.join(cwd, 'tests', '.zz-backup-profile.'));
  const server = await webServer();
  let context;
  try {
    context = await launch(profile);
    server.stage('candidate');
    const page = context.pages()[0];
    await page.goto(`${server.origin}/fixture.html`);
    await browserTools(page);
    const appId = 'zz2';
    const moduleDir = (await readdir(path.join(candidate, appId))).find(name => name.startsWith('zz-backup-v1-'));
    assert.ok(moduleDir);
    await page.evaluate(async ({ appId, moduleDir }) => {
      document.body.innerHTML = '<main data-settings-root></main>';
      await import(`/${appId}/${moduleDir}/entry.mjs`);
    }, { appId, moduleDir });
    const status = page.locator('[data-zz-backup="zz2"] [role="status"]');
    await status.filter({ hasText: '백업할 원본이 없습니다.' }).waitFor({ state: 'attached', timeout });
    const refs = server.sample.media[appId];
    const [{ db: dbName, store }] = refs;
    assert.ok(!(await page.evaluate(() => indexedDB.databases())).some(db => db.name === dbName));
    assert.equal(await page.evaluate(appId => window.fixture.head(appId), appId), null);
    await page.evaluate(fixture => window.fixture.seedMedia(fixture), { dbName, store, refs });
    const snapshot = await waitUntilHead(page, appId);
    assert.deepEqual(snapshot.rawEntries, {});
    assert.deepEqual(snapshot.counts, { rawEntries: 0, mediaRefs: 3 });
    assert.deepEqual(normalizeRefs(snapshot.mediaRefs), normalizeRefs(refs.map(ref => ({ ...ref, valueShape: 'blob' }))));
  } finally {
    await context?.close();
    await server.close();
    await rm(profile, { recursive: true, force: true });
  }
});

async function withCandidate(operation, browserOptions = {}) {
  const profile = await mkdtemp(path.join(cwd, 'tests', '.zz-backup-profile.'));
  const server = await webServer();
  let context;
  try {
    context = await launch(profile, browserOptions);
    server.stage('candidate');
    appIds.forEach(id => server.updated.add(id));
    const harness = context.pages()[0];
    await harness.goto(`${server.origin}/fixture.html`);
    await browserTools(harness);
    await operation({ context, harness, server });
  } finally {
    await context?.close();
    await server.close();
    await rm(profile, { recursive: true, force: true });
  }
}

async function seedStorage(page, entries) {
  await page.evaluate(entries => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  }, entries);
}

function backupStatus(page, appId, text = '이 기기에 백업했습니다.') {
  return page.locator(`[data-zz-backup="${appId}"] [role="status"]`).filter({ hasText: text }).waitFor({ state: 'attached', timeout });
}

async function visitApp(context, origin, appId, run, entry = 'open-backup-v1.html') {
  const page = await context.newPage();
  try {
    assert.ok((await page.goto(`${origin}/${appId}/${entry}`)).ok(), appId);
    await run(page);
  } finally { await page.close(); }
}

test('RELEASE backs up exactly the effective source and keeps corrupt personal bytes', { timeout: 45000 }, async t => {
  await withCandidate(async ({ context, harness, server }) => {
    const personalKey = 'unlock-settings-personal-v2';
    const legacyKey = 'unlock-settings-v1';
    const oldRaw = '{"digits":4, "style":"galaxy", "timeDelay":17}';
    const newRaw = '{"digits":6, "style":"ios", "timeDelay":21}';
    for (const [label, personal, used, adoptedLegacy] of [
      ['missing personal settings', null, [4, 'galaxy', 17], true],
      ['corrupt personal settings', '{invalid\r\n', [4, 'galaxy', 17], true],
      ['valid personal settings', newRaw, [6, 'ios', 21], false],
    ]) {
      await t.test(label, async () => {
        await seedStorage(harness, { [personalKey]: personal, [legacyKey]: oldRaw, 'unlock-settings-entry-tutorial-v1': '1' });
        await visitApp(context, server.origin, 'zz2', async page => {
          const actual = await page.evaluate(async () => {
            const { session } = await import('./session.js');
            const { digits, style, timeDelay } = session.settings;
            return [digits, style, timeDelay];
          });
          assert.deepEqual(actual, used);
          await backupStatus(page, 'zz2');
          const { rawEntries } = await waitUntilHead(harness, 'zz2');
          assert.equal(rawEntries[personalKey], personal ?? undefined);
          assert.equal(rawEntries[legacyKey], adoptedLegacy ? oldRaw : undefined);
          assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), oldRaw);
        });
      });
    }
  });
});

test('TYCHE keeps exact pre-reset v2 and captures real edits across launches', { timeout: 45000 }, async () => {
  await withCandidate(async ({ context, harness, server }) => {
    const v1 = 'zz11-spinner-state-v1';
    const v2 = 'zz11-spinner-state-v2';
    const archive = 'zz11-spinner-state-v2-prelaunch';
    const rawV1 = '{"forceSpin":3}';
    const rawV2 = '{ "targetAngle":75, "forceSpin":6, "spins":2, "previousAngle":30, "rotation":120 }';
    await seedStorage(harness, { [v1]: rawV1, [v2]: rawV2, 'zz11-guide-seen-v2': '1' });
    const reset = { targetAngle: null, forceSpin: 6, spins: 0, previousAngle: null, rotation: 120 };
    let firstHead;
    let editedRaw;
    for (const entry of ['open-backup-v1.html', '']) {
      await visitApp(context, server.origin, 'zz11', async page => {
        await backupStatus(page, 'zz11');
        assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), v2), reset, 'live app still requires a new target each launch');
        const snapshot = await waitUntilHead(harness, 'zz11');
        assert.equal(snapshot.rawEntries[v2], rawV2);
        assert.equal(snapshot.rawEntries[archive], rawV2);
        assert.equal(snapshot.rawEntries[v1], rawV1);
        if (!firstHead) { firstHead = snapshot.snapshotId; return; }
        assert.equal(snapshot.snapshotId, firstHead, 'another startup reset leaves the migration head unchanged');
        const wheel = page.locator('#wheel-wrap');
        const wheelBox = await wheel.boundingBox();
        await wheel.click({ position: { x: wheelBox.width * 0.73, y: wheelBox.height * 0.49 }, timeout });
        assert.equal(await wheel.getAttribute('data-target-cue'), 'acknowledged');
        await page.locator('#force-spin').evaluate(select => {
          select.value = '7';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        editedRaw = await page.evaluate(key => localStorage.getItem(key), v2);
        assert.equal(JSON.parse(editedRaw).forceSpin, 7, 'real app handler changed the configured turn');
        assert.ok(Number.isFinite(JSON.parse(editedRaw).targetAngle), 'real wheel click added a target');
        const edited = await waitUntilHead(harness, 'zz11', v2, editedRaw);
        assert.notEqual(edited.snapshotId, firstHead);
        assert.equal(edited.rawEntries[archive], rawV2);
      }, entry);
    }
    await visitApp(context, server.origin, 'zz11', async page => {
      await backupStatus(page, 'zz11');
      const snapshot = await waitUntilHead(harness, 'zz11');
      assert.equal(snapshot.rawEntries[v2], editedRaw, 'latest real edit survives a subsequent startup reset');
      assert.equal(snapshot.rawEntries[archive], rawV2);
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), v2), { ...reset, forceSpin: 7 });
    });
  });
});

test('TYCHE retains v1-only source when the app migrates its configured turn', { timeout: 30000 }, async () => {
  await withCandidate(async ({ context, harness, server }) => {
    const v1 = 'zz11-spinner-state-v1';
    const v2 = 'zz11-spinner-state-v2';
    const original = '{ "forceSpin":3 }';
    await seedStorage(harness, { [v1]: original, 'zz11-guide-seen-v2': '1' });
    await visitApp(context, server.origin, 'zz11', async page => {
      await backupStatus(page, 'zz11');
      const { rawEntries } = await waitUntilHead(harness, 'zz11');
      assert.equal(rawEntries[v1], original);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).forceSpin, v2), 3);
    });
  });
});

test('ALETHEIA rejects dangling slots and presets, retains the good head, and commits a true deletion', { timeout: 45000 }, async () => {
  await withCandidate(async ({ context, harness, server }) => {
    const setsKey = 'aletheia.photoSets.v2';
    const metaKey = 'aletheia.meta.v1';
    const [slot, preset] = server.sample.media.zz5;
    const entries = { [setsKey]: photoSets([slot.key]), [metaKey]: photoPresets(preset.key) };
    const store = { dbName: slot.db, store: slot.store };
    const missingStatus = /사진.*(?:누락|없)/;
    await seedStorage(harness, entries);
    await visitApp(context, server.origin, 'zz5', async page => {
      await browserTools(page);
      assert.deepEqual(await page.evaluate(async ({ setsKey, metaKey }) => {
        const { parseMeta, parsePhotoSets } = await import('./logic.js');
        return [parsePhotoSets(localStorage.getItem(setsKey)).ok, parseMeta(localStorage.getItem(metaKey)).ok];
      }, { setsKey, metaKey }), [true, true]);
      await backupStatus(page, 'zz5', missingStatus);
      assert.equal(await harness.evaluate(() => window.fixture.head('zz5')), null, 'dangling first visit has no successful head');
      await page.evaluate(data => window.fixture.seedMedia(data), { ...store, refs: [slot, preset] });
      await backupStatus(page, 'zz5');
      const complete = await waitUntilHead(harness, 'zz5');
      validateSnapshot(complete, { appId: 'zz5', origin: server.origin, raw: entries, media: [slot, preset] });
      const completeSnapshotKeys = await harness.evaluate(() => window.fixture.keys('snapshots'));
      for (const ref of [preset, slot]) {
        await page.evaluate(data => window.fixture.deleteMedia(data), { ...store, key: ref.key });
        await backupStatus(page, 'zz5', missingStatus);
        assert.equal((await waitUntilHead(harness, 'zz5')).snapshotId, complete.snapshotId);
        assert.deepEqual(await harness.evaluate(() => window.fixture.keys('snapshots')), completeSnapshotKeys);
        await page.evaluate(data => window.fixture.seedMedia(data), { ...store, refs: [ref] });
        await backupStatus(page, 'zz5');
        assert.equal((await waitUntilHead(harness, 'zz5')).snapshotId, complete.snapshotId);
      }
      const deletedEntries = { [setsKey]: photoSets([]), [metaKey]: photoPresets(null) };
      await seedStorage(page, deletedEntries);
      for (const ref of [slot, preset]) await page.evaluate(data => window.fixture.deleteMedia(data), { ...store, key: ref.key });
      const deleted = await poll(() => harness.evaluate(async key => {
        const head = await window.fixture.head('zz5');
        return head?.counts.mediaRefs === 0 && typeof head.rawEntries[key] === 'string' ? head : false;
      }, setsKey), 'ALETHEIA head with all refs and corresponding records removed');
      await backupStatus(page, 'zz5');
      validateSnapshot(deleted, { appId: 'zz5', origin: server.origin, raw: deletedEntries, media: [] });
      assert.notEqual(deleted.snapshotId, complete.snapshotId);
      assert.ok((await harness.evaluate(() => window.fixture.keys('snapshots'))).includes(complete.snapshotId));
    });
  });
});

const primaryModule = {
  zz1: 'app.js', zz2: 'app.js', zz3: 'boot.js', zz4: 'app.js', zz5: 'app.js', zz6: 'app.js',
  zz7: 'detector.js', zz8: 'contacts.js', zz10: 'app.js', zz12: 'app.mjs',
  zz13: 'app.mjs', zz14: 'app.mjs', zz15: 'app.mjs',
};

async function tapTycheFirstTarget(page, original) {
  const liveKey = 'zz11-spinner-state-v2';
  const archiveKey = `${liveKey}-prelaunch`;
  await page.locator('#wheel-wrap').waitFor({ state: 'visible', timeout });
  const wheel = page.locator('#wheel-wrap');
  assert.equal(await wheel.getAttribute('data-target-cue'), 'idle');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), archiveKey), original, 'TYCHE archived the original before the independent backup loader');
  assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), liveKey), {
    targetAngle: null, forceSpin: 6, spins: 0, previousAngle: null, rotation: 120,
  });
  const box = await wheel.boundingBox();
  const x = box.x + box.width * 0.73;
  const y = box.y + box.height * 0.49;
  assert.ok(await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest('#wheel-wrap')), [x, y]), 'real touchscreen coordinate hits the wheel');
  await page.touchscreen.tap(x, y);
  assert.equal(await wheel.getAttribute('data-target-cue'), 'acknowledged', 'one real touch selects a target while backup is unavailable');
  const live = await page.evaluate(key => localStorage.getItem(key), liveKey);
  assert.ok(Number.isFinite(JSON.parse(live).targetAngle));
  assert.notEqual(live, original);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), archiveKey), original);
  return live;
}

test('app startup and first TYCHE tap survive delayed and failed optional backup module', { timeout: 140000 }, async t => {
  for (const mode of ['delayed', 'failed']) {
    for (const entry of ['', 'open-backup-v1.html']) {
      await t.test(`${mode} backup · ${entry ? 'announcement links' : 'canonical routes'}`, async () => {
        // Block SW registration so the fault targets the page request rather than a worker's precache request.
        // The separate upgrade regression above uses the real legacy and candidate workers.
        await withCandidate(async ({ context, harness, server }) => {
          const { origin, sample } = server;
          const originalTyche = '{ "targetAngle":75, "forceSpin":6, "spins":2, "previousAngle":30, "rotation":120 }';
          await seedStorage(harness, { ...Object.assign({}, ...Object.values(sample.raw)), 'zz11-spinner-state-v2': originalTyche });
          for (const refs of Object.values(sample.media)) {
            const [{ db: dbName, store }] = refs;
            await harness.evaluate(data => window.fixture.seedMedia(data), { dbName, store, refs });
          }
          for (const appId of appIds) {
            const page = await context.newPage();
            let release;
            let seen = false;
            let delivered = false;
            const pending = new Promise(resolve => { release = resolve; });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            try {
              await page.addInitScript(() => {
                window.testFrameAfterLoad = 0;
                addEventListener('load', () => requestAnimationFrame(() => { window.testFrameAfterLoad = performance.now(); }), { once: true });
              });
              await page.route(/\/zz-backup-v1-[^/]+\/start\.js$/, async route => {
                seen = true;
                if (mode === 'delayed') {
                  await pending;
                  await route.continue();
                } else {
                  await route.fulfill({ status: 503, contentType: 'application/javascript', body: '/* fixture outage */' });
                }
                delivered = true;
              });
              const suffix = '?regression=optional-loader#fixture';
              assert.ok((await page.goto(`${origin}/${appId}/${entry}${suffix}`, { waitUntil: 'commit' })).ok());
              await poll(() => seen, `${appId} browser request for optional start.js`);
              await page.waitForLoadState('load', { timeout: 3000 });
              assert.equal(page.url(), `${origin}/${appId}/${suffix}`, `${appId}: target URL and query/hash`);
              const state = await page.evaluate(({ appId, module }) => ({
                ready: document.readyState,
                frame: window.testFrameAfterLoad > 0,
                appResource: performance.getEntriesByType('resource').some(event => {
                  const pathname = new URL(event.name).pathname;
                  return appId === 'zz11' ? /^\/zz11\/app-[a-f\d]+\.js$/.test(pathname) : pathname === `/${appId}/${module}`;
                }),
              }), { appId, module: primaryModule[appId] });
              assert.deepEqual(state, { ready: 'complete', frame: true, appResource: true }, `${appId}: app entry and first frame complete independently`);
              if (mode === 'failed') await poll(() => delivered, `${appId} injected 503 response`);
              assert.equal(delivered, mode === 'failed', `${appId}: optional response state before interaction`);
              assert.equal(await harness.evaluate(id => window.fixture.head(id), appId), null, `${appId}: backup still unavailable`);
              let live;
              if (appId === 'zz11') live = await tapTycheFirstTarget(page, originalTyche);
              if (appId === 'zz4') await firstInteraction(page, appId);
              assert.deepEqual(errors, [], `${appId}: runtime errors with optional asset unavailable`);
              if (mode === 'delayed') {
                assert.equal(delivered, false, `${appId}: interaction completed while request was held`);
                release();
                if (['zz12', 'zz14'].includes(appId)) {
                  if (appId === 'zz12') {
                    const dismiss = page.locator('.first-run-guide button');
                    if (await dismiss.isVisible()) await dismiss.click({ timeout });
                  }
                  await page.locator('[data-tab="settings"]').click({ timeout });
                }
                await backupStatus(page, appId);
                const head = await waitUntilHead(harness, appId);
                if (appId === 'zz11') {
                  assert.equal(head.rawEntries['zz11-spinner-state-v2'], live);
                  assert.equal(head.rawEntries['zz11-spinner-state-v2-prelaunch'], originalTyche);
                }
              } else {
                assert.equal(await page.locator(`[data-zz-backup="${appId}"]`).count(), 0);
              }
              const timing = await poll(() => page.evaluate(() => {
                const optional = performance.getEntriesByType('resource').find(event => /\/zz-backup-v1-[^/]+\/start\.js$/.test(event.name));
                return optional && { start: optional.startTime, frame: window.testFrameAfterLoad };
              }), `${appId} optional request timing`);
              assert.ok(timing.start >= timing.frame, `${appId}: optional request starts after the first frame`);
            } finally {
              release();
              await page.unrouteAll({ behavior: 'wait' });
              await page.close();
            }
          }
          console.log(`${mode} ${entry ? 'announcement' : 'canonical'}: all 14 apps initialized with the optional request unavailable.`);
        }, { serviceWorkers: 'block' });
      });
    }
  }
});
