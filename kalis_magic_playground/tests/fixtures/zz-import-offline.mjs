// Built-artifact smoke test: real SW caches and offline initialization for every destination.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ZZ_IMPORT_TARGETS, zzImportFiles } from '../../scripts/zz-import-build.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.MAGIC_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.ZZ_B_DIST || fileURLToPath(new URL('../../dist/', import.meta.url)));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const filename = path.resolve(root, '.' + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!filename.startsWith(root + path.sep)) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const bytes = await readFile(filename);
    res.writeHead(200, {
      'content-type': types[path.extname(filename)] || 'application/octet-stream',
      ...(process.env.ZZ_TEST_CSP
        ? {
          'content-security-policy':
            "script-src 'self' 'unsafe-inline'; worker-src 'self'; object-src 'none'",
        }
        : {}),
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.ZZ_BROWSER_CHANNEL || 'chrome',
});
try {
  // A tab that arrives during an interrupted write must wait, then recover before app reads.
  if (!process.env.ZZ_TARGET || process.env.ZZ_TARGET === 'kairos') {
    const context = await browser.newContext();
    const writer = await context.newPage();
    await writer.route(
      '**/writer-test.html',
      (route) =>
        route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Interrupted writer</title>' }),
    );
    await writer.goto(`${origin}/tools/kairos/writer-test.html`);
    await writer.evaluate(async () => {
      localStorage.setItem('friend-kairos_custom_text', 'partial');
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('zz-import-state-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put({
          status: 'writing',
          target: 'kairos',
          before: { entries: [['friend-kairos_custom_text', 'before']], media: [] },
        }, 'journal:kairos');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      navigator.locks.request('zz-app-live:kairos', async () => {
        globalThis.writerHeld = true;
        await new Promise(() => {});
      });
    });
    await writer.waitForFunction(() => globalThis.writerHeld);
    const waiting = await context.newPage();
    await waiting.goto(`${origin}/tools/kairos/`);
    assert.notEqual(await waiting.locator('[data-zz-bootstrap]').getAttribute('data-zz-ready'), 'true');
    await writer.close();
    await waiting.waitForFunction(() =>
      document.querySelector('[data-zz-bootstrap]')?.dataset.zzReady === 'true'
    );
    assert.equal(await waiting.evaluate(() => localStorage.getItem('friend-kairos_custom_text')), 'before');
    console.log('writer crash: waiting startup recovered original before app initialization');
    await context.close();
  }
  for (
    const target of ZZ_IMPORT_TARGETS.filter((target) =>
      !process.env.ZZ_TARGET || target === process.env.ZZ_TARGET
    )
  ) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log(target + ' pageerror: ' + error.message));
    await page.goto(`${origin}/tools/${target}/`);
    await page.waitForFunction(() =>
      document.querySelector('[data-zz-bootstrap]')?.dataset.zzReady === 'true'
    ).catch(async (error) => {
      console.log(
        await page.locator('[role=alert]').allTextContents(),
        await page.locator('script[type="application/x-zz-deferred"]').evaluateAll((nodes) =>
          nodes.map((n) => n.src)
        ),
      );
      throw error;
    });
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cached = await page.evaluate(
      async (files) =>
        Promise.all(
          files.map(async (file) => !!await caches.match(new URL(`./zz-import/${file}`, location.href))),
        ),
      zzImportFiles(target),
    );
    assert.ok(cached.every(Boolean), `${target}: importer shell not cached`);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('[data-zz-bootstrap]')?.dataset.zzReady === 'true'
    ).catch(async (error) => {
      console.log(
        await page.locator('[role=alert]').allTextContents(),
        await page.locator('script[type="application/x-zz-deferred"]').evaluateAll((nodes) =>
          nodes.map((n) => n.src)
        ),
      );
      throw error;
    });
    assert.equal(
      await page.getByText('이전 데이터 복구를 완료하지 못해 앱 시작을 멈췄습니다.', { exact: false })
        .count(),
      0,
      target,
    );
    console.log(`offline ${target}: ${cached.length} importer modules cached; app scripts started`);
    if (target === 'kairos') {
      await context.setOffline(false);
      const old = await context.newPage();
      await old.route(
        '**/old-shell-test.html',
        (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><title>Old shell without migration locks</title>',
          }),
      );
      await old.goto(`${origin}/tools/kairos/old-shell-test.html`);
      const attempt = () =>
        page.evaluate(async () => {
          try {
            const { exclusiveWrite } = await import('./zz-import/ui-bootstrap.mjs');
            await exclusiveWrite(async () => true);
            return 'allowed';
          } catch (error) {
            return error.message;
          }
        });
      assert.match(await attempt(), /다른 탭/, 'old uncoordinated client must block import');
      await old.close();
      assert.equal(await attempt(), 'allowed', 'single current tab releases its shared lock before writing');
      console.log('old shell window detected; retry allowed after closing it');
    }

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
