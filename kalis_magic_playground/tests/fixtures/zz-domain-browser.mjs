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
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { domainSamples } from './zz-domain-samples.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
for (const name of ['qrcodegen.js', 'jsQR.js']) {
  vm.runInThisContext(
    await readFile(new URL('../../distribution-snapshots/qr/vendor/' + name, import.meta.url), 'utf8'),
  );
}
const samples = domainSamples();
samples.find((item) => item.target === 'hitsuzen')
  .sourceEntries['calculator-settings-entry-tutorial-v1:/zz3'] = '1';
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
  headless: process.env.ZZ_HEADLESS !== '0',
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
async function captureTarget(target, sourceEntries, sourceMedia = false) {
  return page.evaluate(async ({ target, sourceEntries, sourceMedia }) => {
    const { mapKey, TARGETS } = await import('/tools/' + target + '/zz-import/data.mjs');
    const entries = Object.keys(sourceEntries).map((key) => mapKey(target, key)).filter(Boolean).map(
      (key) => [key, localStorage.getItem(key)],
    );
    const media = [];
    for (const config of TARGETS[target].media) {
      const req = indexedDB.open(sourceMedia ? config.db : config.targetDb);
      req.onupgradeneeded = () => req.transaction.abort();
      const db = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const rows = await new Promise((resolve, reject) => {
        const rows = [], req = db.transaction(config.store).objectStore(config.store).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve(rows);
          rows.push([cursor.key, cursor.value]);
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
      db.close();
      for (const [key, value] of rows) {
        const blob = value?.blob || value;
        const bitmap = await createImageBitmap(blob);
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(
          (n) => n.toString(16).padStart(2, '0'),
        ).join('');
        media.push([key, hash, value.savedAt ?? null, bitmap.width, bitmap.height]);
        bitmap.close();
      }
    }
    return { entries, media };
  }, { target, sourceEntries, sourceMedia });
}
const results = [];
try {
  for (const sample of samples) {
    if (process.env.ZZ_ONLY && !process.env.ZZ_ONLY.split(',').includes(sample.target)) continue;
    try {
      await page.goto(origin + '/fixture');
      await page.evaluate(async () => {
        localStorage.clear();
        for (const db of await indexedDB.databases()) {
          await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = resolve;
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('blocked reset'));
          });
        }
        for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
      });
      const sourceEntries = { ...sample.sourceEntries };
      await page.evaluate(async ({ target, sourceEntries, publicEntries, media }) => {
        const { mapKey, TARGETS } = await import('/tools/' + target + '/zz-import/data.mjs');
        for (const [key, value] of Object.entries(sourceEntries)) localStorage.setItem(key, value);
        for (const [key, value] of Object.entries(publicEntries)) {
          const destination = mapKey(target, key);
          if (destination && destination !== key) localStorage.setItem(destination, value);
        }
        for (const item of media) {
          const config = TARGETS[target].media.find((config) => config.db === item.db);
          for (const isPublic of [false, true]) {
            const req = indexedDB.open(isPublic ? config.targetDb : item.db);
            req.onupgradeneeded = () => req.result.createObjectStore(item.store);
            const db = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            const canvas = document.createElement('canvas');
            canvas.width = 3;
            canvas.height = 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = isPublic ? '#1255dd' : '#de4433';
            ctx.fillRect(0, 0, 3, 2);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve));
            const tx = db.transaction(item.store, 'readwrite');
            tx.objectStore(item.store).put(
              target === 'aletheia' ? { blob, savedAt: isPublic ? 123 : 456 } : blob,
              item.key,
            );
            await new Promise((resolve, reject) => {
              tx.oncomplete = resolve;
              tx.onabort = () => reject(tx.error);
            });
            db.close();
          }
        }
      }, {
        target: sample.target,
        sourceEntries,
        publicEntries: sample.publicEntries,
        media: sample.media.map(({ db, store, key }) => ({ db, store, key })),
      });
      await page.goto(origin + '/tools/' + sample.target + '/');
      await checkSettings(page, sample.target);
      const publicBefore = await captureTarget(sample.target, sourceEntries);
      const sourceBefore = await captureTarget(sample.target, sourceEntries, true);
      await seedCompletedImport(page, sample.target);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-zz-ready=true]'));
      const firstResume = await page.evaluate(async ({ target, sourceEntries }) => {
        const { mapKey } = await import('./zz-import/data.mjs');
        return Object.entries(sourceEntries).filter(([key]) => mapKey(target, key)).map(([key, value]) => ({
          key: mapKey(target, key),
          expected: value,
          actual: localStorage.getItem(mapKey(target, key)),
        })).filter((row) => row.expected !== row.actual);
      }, { target: sample.target, sourceEntries });
      assert.deepEqual(firstResume, [], sample.target + ' first restored startup');
      if (sample.target === 'tyche') {
        const key = 'zz11-spinner-state-v2';
        sourceEntries[key] = JSON.stringify({
          ...JSON.parse(sourceEntries[key]),
          spins: 0,
          targetAngle: null,
          previousAngle: null,
        });
      }
      // A second real reload catches startup rewriting the newly active profile.
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-zz-ready=true]'));
      await checkSettings(page, sample.target);
      const evidence = await page.evaluate(async ({ target, sourceEntries }) => {
        const { mapKey } = await import('./zz-import/data.mjs');
        const rows = Object.entries(sourceEntries).map(([key, value]) => ({
          sourceKey: key,
          key: mapKey(target, key),
          expected: value,
        })).filter((row) => row.key);
        const mismatches = rows.filter((row) => localStorage.getItem(row.key) !== row.expected).map(
          (row) => ({ key: row.key, expected: row.expected, actual: localStorage.getItem(row.key) }),
        );
        const controls = [...document.querySelectorAll('input,select,textarea')].map((el) => ({
          id: el.id,
          value: el.value,
        })).filter((row) => row.id);
        return {
          mismatches,
          controls,
          text: document.body.innerText.slice(0, 1200),
        };
      }, { target: sample.target, sourceEntries });
      if (sample.target === 'memdeck') assert.equal(await page.locator('#stack').inputValue(), 'mnemonica');
      if (sample.target === 'release') assert.equal(await page.locator('#style').inputValue(), 'galaxy');
      if (sample.target === 'tyche') assert.equal(await page.locator('#force-spin').inputValue(), '7');
      assert.deepEqual(evidence.mismatches, [], sample.target + ' startup changed imported raw data');
      assert.deepEqual(
        (await captureTarget(sample.target, sourceEntries)).media,
        sourceBefore.media,
        sample.target + ' decoded imported media',
      );
      if (sample.target === 'alter') {
        assert.equal(evidence.controls.find((c) => c.id === 'rank')?.value, '9');
        assert.equal(evidence.controls.find((c) => c.id === 'brightness')?.value, '115');
      }
      if (sample.target === 'asrai') assert.ok(evidence.controls.some((c) => c.value.includes('가상 하나')));
      if (sample.target === 'choice') assert.ok(evidence.text.includes('ZZ'));
      if (sample.target === 'tobira') assert.ok(evidence.controls.some((c) => c.value === '보관 동전'));
      if (sample.target === 'arosaegida') {
        assert.ok(evidence.controls.some((c) => c.value === 'https://example.com/heldout'));
      }
      await page.evaluate(async (target) => {
        const { activateProfile } = await import('./zz-import/apply.mjs');
        const { exclusiveWrite } = await import('./zz-import/ui-bootstrap.mjs');
        await exclusiveWrite(() => activateProfile(target, 'public'));
      }, sample.target);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-zz-ready=true]'));
      assert.deepEqual(
        await captureTarget(sample.target, sourceEntries),
        publicBefore,
        sample.target + ' public profile bytes restored after real startup',
      );
      results.push({ target: sample.target, ok: true, controls: evidence.controls.length });
      console.log('domain-browser PASS', sample.target);
    } catch (error) {
      results.push({ target: sample.target, ok: false, error: error.message });
      console.error('domain-browser FAIL', sample.target, error.message);
    }
  }
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
