// Real Chrome, isolated source-backed server: never rewrites the shared dist tree.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  injectZzImport,
  transformZzImportRuntime,
  transformZzImportWorker,
} from '../../scripts/zz-import-build.mjs';
import { transformDistributionDocument } from '../../scripts/build-public.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const { chromium } = createRequire(import.meta.url)(process.env.MAGIC_PLAYWRIGHT_MODULE || 'playwright');
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
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/fixture') {
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><title>Fixture</title>');
    return;
  }
  if (!pathname.startsWith('/tools/tyche/')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const name = pathname.slice('/tools/tyche/'.length) || 'index.html';
  const filename = path.resolve(
    root,
    name.startsWith('zz-import/') ? name : 'distribution-snapshots/spinner/' + name,
  );
  if (!filename.startsWith(root)) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    let bytes = await readFile(filename);
    if (name === 'index.html') {
      bytes = injectZzImport(
        transformDistributionDocument(bytes.toString(), { target: 'tyche', tool: 'spinner' }),
        'tyche',
      );
    }
    if (name === 'app.js') bytes = transformZzImportRuntime(bytes.toString(), 'tyche', 'app.js');
    if (name === 'sw.js') bytes = transformZzImportWorker(bytes.toString(), 'tyche');
    res.writeHead(200, {
      'content-type': types[path.extname(filename)] || 'application/octet-stream',
      'cache-control': 'no-store',
      'content-security-policy': "script-src 'self' 'unsafe-inline'; worker-src 'self'; object-src 'none'",
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
const original = { targetAngle: 123, forceSpin: 6, spins: 3, previousAngle: 277, rotation: 997 };
const ready = (page) =>
  page.waitForFunction(() => document.querySelector('[data-zz-bootstrap]')?.dataset.zzReady === 'true');
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('friend-spinner-state-v2')));
async function switchProfile(page, id) {
  await page.evaluate(async (id) => {
    const { exclusiveWrite } = await import('./zz-import/ui-bootstrap.mjs');
    const { activateProfile } = await import('./zz-import/apply.mjs');
    await exclusiveWrite(() => activateProfile('tyche', id));
  }, id);
  await page.reload();
  await ready(page);
}
try {
  for (const version of ['v1', 'v2']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin + '/fixture');
    await page.evaluate(({ version, original }) => {
      localStorage.setItem('zz11-spinner-state-' + version, JSON.stringify(original));
      localStorage.setItem(
        'friend-spinner-state-v2',
        JSON.stringify({ ...original, targetAngle: 70, spins: 1 }),
      );
    }, { version, original });
    await page.goto(origin + '/tools/tyche/');
    await ready(page);
    assert.equal((await read(page)).spins, 0, 'ordinary initial launch still resets');
    await page.evaluate(async () => {
      const { discoverSources } = await import('./zz-import/data.mjs');
      const { previewImport, applyImport } = await import('./zz-import/apply.mjs');
      const { exclusiveWrite } = await import('./zz-import/ui-bootstrap.mjs');
      const candidate = (await discoverSources('tyche')).candidates[0];
      const preview = await previewImport('tyche', candidate);
      await exclusiveWrite(() =>
        applyImport('tyche', candidate, { activate: 'zz', expectedRevision: preview.revision })
      );
    });
    // A close/reopen rather than same-tab reload proves the signal is durable.
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(origin + '/tools/tyche/');
    await ready(reopened);
    assert.deepEqual(await read(reopened), original, version + ' resume preserves complete state');
    assert.equal(await reopened.locator('#spin-value').textContent(), '3회');
    assert.equal(
      await reopened.evaluate(async () => {
        const { readResume } = await import('./zz-import/apply.mjs');
        return readResume('tyche');
      }),
      null,
      'resume acknowledged only after entry',
    );
    await switchProfile(reopened, 'public');
    assert.equal((await read(reopened)).spins, 0);
    await switchProfile(reopened, 'zz');
    assert.deepEqual(await read(reopened), original, version + ' profile switch resumes');
    await reopened.reload();
    await ready(reopened);
    const normal = await read(reopened);
    assert.equal(normal.targetAngle, null);
    assert.equal(normal.spins, 0);
    assert.equal(normal.previousAngle, null);
    console.log(
      `${version}: durable close/reopen resume, native visible count, profile switch, and ordinary reset passed`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
