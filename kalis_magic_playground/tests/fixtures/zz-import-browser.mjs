// Run after building both releases. Optional historical and A roots exercise the deployed upgrade sequence.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer as http } from 'node:http';
import { createServer as https } from 'node:https';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { checkSettings, seedCompletedImport } from './zz-settings-browser.mjs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.MAGIC_PLAYWRIGHT_MODULE || 'playwright');
const dist = process.env.ZZ_B_DIST || fileURLToPath(new URL('../../dist/', import.meta.url));
const samples = [
  ['zz1', 'kairos', 'stopwatch_custom_text', 'friend-kairos_custom_text', '지난 공연'],
  ['zz1', 'kairos-classic', 'stopwatch_custom_text', 'friend-kairos-classic_custom_text', '지난 공연'],
  ['zz2', 'release', 'unlock-install-personal-v1', 'unlock-install-shared-v1', '1'],
  [
    'zz3',
    'hitsuzen',
    'calculator-settings-entry-tutorial-v1:/zz3',
    'calculator-settings-entry-tutorial-v1:/tools/hitsuzen',
    '1',
  ],
  [
    'zz4',
    'choice',
    'magic-choice.settings-gesture-guide.v1',
    'magic-choice-dist.settings-gesture-guide.v1',
    '1',
  ],
  [
    'zz5',
    'aletheia',
    'aletheia.settings-gesture-guide.v1',
    'aletheia.distribution.settings-gesture-guide.v1',
    '1',
  ],
  ['zz6', 'tobira', 'tobira.settings-gesture-guide.v1', 'friend-tobira.settings-gesture-guide.v1', '1'],
  ['zz7', 'usotsuki', 'usotsuki.detector.sound.v1', 'usotsuki.distribution.detector.sound.v1', 'off'],
  ['zz8', 'asrai', 'asrai.prototype.settings-guide.v1', 'friend-asrai.prototype.settings-guide.v1', '1'],
  [
    'zz10',
    'alter',
    'alter-settings',
    'friend-alter-settings',
    '{"rank":"7","suit":"heart","brightness":105}',
  ],
  ['zz11', 'tyche', 'zz11-guide-seen-v2', 'friend-spinner-guide-seen-v2', '1'],
  [
    'zz12',
    'memdeck',
    'first-settings-guide:v1:memdeck:/zz12',
    'friend-memdeck-first-settings-guide:v1:memdeck:/tools/memdeck',
    '1',
  ],
  [
    'zz13',
    'arosaegida',
    'first-settings-guide:v1:arosaegida:/zz13',
    'first-settings-guide:v1:arosaegida:/tools/arosaegida',
    '1',
  ],
  [
    'zz14',
    'pimax',
    'pimax-practice-settings',
    'pimax.distribution.settings',
    '{"version":1,"count":15,"phonetic":true,"mapPool":"all","practiceStyle":"tap"}',
  ],
  ['zz15', 'uramichi', 'uramichi.web.install.dismissed', 'friend-uramichi.web.install.dismissed', '1'],
];
const media = [
  ['release', 'unlock-images-personal', 'unlock-images', 'images', 'lock'],
  ['choice', 'magic-choice.v1.media', 'magic-choice-dist.v1.media', 'wallpaper', 'current'],
  ['aletheia', 'aletheia', 'aletheia-distribution', 'images', 'img_fixture'],
  ['tobira', 'tobira.localImages.v1', 'friend-tobira.localImages.v1', 'images', 'wallpaper'],
];
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
let root = dist;
const tls = process.env.ZZ_TEST_CERT && process.env.ZZ_TEST_KEY;
const server = tls
  ? https({ cert: await readFile(process.env.ZZ_TEST_CERT), key: await readFile(process.env.ZZ_TEST_KEY) })
  : http();
let authorized = true;
server.on('request', async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fixture') return res.end('<!doctype html><title>ZZ fixture</title>');
  if (url.pathname === '/tools/_check') {
    res.setHeader('content-type', 'application/json');
    res.statusCode = authorized ? 200 : 403;
    return res.end(JSON.stringify({ ok: authorized }));
  }
  const filename = path.resolve(root, '.' + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!filename.startsWith(path.resolve(root) + path.sep)) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const body = await readFile(filename);
    res.writeHead(200, {
      'content-type': types[path.extname(filename)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = (tls ? 'https' : 'http') + '://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({
  headless: true,
  args: tls ? ['--ignore-certificate-errors'] : [],
  channel: process.env.ZZ_BROWSER_CHANNEL || 'chrome',
});
const context = await browser.newContext({ hasTouch: true, viewport: { width: 412, height: 850 } });
await context.route((url) => url.origin !== origin, (route) => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(6000);
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('zz-import')) console.error('HTTP', r.status(), r.url());
});
page.on('pageerror', (error) => console.error('page error', page.url(), error.message));
async function fixture() {
  await page.goto(origin + '/fixture');
}
async function photoOperation({ row, write }) {
  const [target, source, dest, store, key] = row;
  const request = indexedDB.open(write ? source : dest);
  request.onupgradeneeded = () => request.result.createObjectStore(store);
  const db = await new Promise((ok, fail) => {
    request.onsuccess = () => ok(request.result);
    request.onerror = () => fail(request.error);
  });
  try {
    if (write) {
      const canvas = document.createElement('canvas');
      canvas.width = 3;
      canvas.height = 2;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve));
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(target === 'aletheia' ? { blob, savedAt: 100 } : blob, key);
      await new Promise((ok, fail) => {
        tx.oncomplete = ok;
        tx.onabort = () => fail(tx.error);
      });
    }
    const get = db.transaction(store).objectStore(store).get(key);
    const value = await new Promise((ok, fail) => {
      get.onsuccess = () => ok(get.result);
      get.onerror = () => fail(get.error);
    });
    const blob = value?.blob || value;
    const bmp = await createImageBitmap(blob);
    return [
      bmp.width,
      bmp.height,
      Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).join(','),
      value.savedAt,
    ];
  } finally {
    db.close();
  }
}
try {
  if (tls) {
    authorized = false;
    await page.goto(origin + '/tools/alter/');
    await page.waitForURL('**/tools/login/**');
    assert.equal(await page.locator('[data-zz-import]').count(), 0);
    authorized = true;
  }
  await fixture();
  await page.evaluate((rows) => {
    for (const [, , key, , value] of rows) localStorage.setItem(key, value);
  }, samples);
  const hashes = new Map();
  for (const row of media) hashes.set(row[0], await page.evaluate(photoOperation, { row, write: true }));
  const historical = process.env.ZZ_HISTORICAL_ROOT, stageA = process.env.ZZ_A_DIST;
  if (historical && stageA) {
    const ids = [...new Set(samples.map((row) => row[0]))];
    root = historical;
    for (const id of ids) {
      await page.goto(origin + '/' + id + '/');
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('./sw.js');
        await navigator.serviceWorker.ready;
      });
    }
    root = stageA;
    for (const id of ids) {
      await page.goto(origin + '/' + id + '/open-backup-v1.html');
      const deadline = Date.now() + 15000;
      let saved;
      do {
        saved = await page.evaluate(async (id) => {
          if (!(await indexedDB.databases()).some((d) => d.name === 'zz-migration-v1')) return false;
          const db = await new Promise((resolve) => {
            const r = indexedDB.open('zz-migration-v1');
            r.onsuccess = () => resolve(r.result);
          });
          try {
            return await new Promise((resolve) => {
              const r = db.transaction('heads').objectStore('heads').get(id);
              r.onsuccess = () => resolve(!!r.result);
            });
          } finally {
            db.close();
          }
        }, id);
        if (!saved) await new Promise((resolve) => setTimeout(resolve, 100));
      } while (!saved && Date.now() < deadline);
      assert.ok(saved, id + ' did not publish its snapshot at ' + page.url());
      console.log('snapshot', id);
    }
    root = dist;
  }
  for (const [, target, source, key, value] of samples) {
    if (process.env.ZZ_ONLY && !process.env.ZZ_ONLY.split(',').includes(target)) continue;
    // Check settings both before migration and on the same origin after activation.
    await page.goto(origin + '/tools/' + target + '/');
    assert.doesNotMatch(await (await checkSettings(page, target)).innerText(), /ZZ/i);
    await seedCompletedImport(page, target, historical && stageA ? 'snapshot' : 'raw');
    await page.reload();
    assert.doesNotMatch(await (await checkSettings(page, target)).innerText(), /ZZ/i);
    assert.deepEqual(
      await page.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [source, key]),
      [value, value],
      target,
    );
    const row = media.find((r) => r[0] === target);
    if (row) {
      assert.deepEqual(
        await page.evaluate(photoOperation, { row, write: false }),
        hashes.get(target),
        target + ' decoded media',
      );
    }
    console.log('restored', target);
  }
} finally {
  await browser.close();
  server.close();
}
