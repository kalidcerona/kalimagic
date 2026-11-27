// Real Chrome storage and file acceptance. Faults are injected at browser API boundaries.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.MAGIC_PLAYWRIGHT_MODULE || 'playwright');
const dist = path.resolve(process.env.ZZ_B_DIST || fileURLToPath(new URL('../../dist/', import.meta.url)));
const aRoot = process.env.ZZ_A_MODULE_ROOT ||
  fileURLToPath(
    new URL('../../../../kalis-magic-wt-site-design9/kalis_magic_playground/zz-migration/', import.meta.url),
  );
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('cache-control', 'no-store');
  if (url.pathname === '/fixture' || url.pathname === '/tools/alter/legacy-fixture') {
    res.setHeader('content-type', 'text/html');
    return res.end('<!doctype html><title>ZZ independent failures</title>');
  }
  if (url.pathname === '/tools/alter/' || url.pathname === '/tools/alter/index.html') {
    res.setHeader('content-type', 'text/html');
    return res.end(
      '<!doctype html><div id="settings"></div><script>globalThis.zzImportAccess=Promise.resolve()</script><script type="module" data-zz-bootstrap="alter" src="./zz-import/ui-bootstrap.mjs"></script>',
    );
  }
  let filename;
  if (/^\/a\/(media-worker|zip)\.mjs$/.test(url.pathname)) {
    filename = path.join(aRoot, path.basename(url.pathname));
  } else {
    filename = path.resolve(dist, '.' + url.pathname);
    if (!filename.startsWith(dist + path.sep)) {
      res.writeHead(404);
      return res.end();
    }
  }
  try {
    const data = await readFile(filename);
    res.setHeader(
      'content-type',
      /\.(mjs|js)$/.test(filename)
        ? 'text/javascript'
        : filename.endsWith('.png')
        ? 'image/png'
        : 'application/octet-stream',
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
async function check(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.error('FAIL', name, error.message);
  }
}
async function contextPage() {
  const context = await browser.newContext();
  await context.route((url) => url.origin !== origin, (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(origin + '/fixture');
  return { context, page };
}
try {
  browser = await chromium.launch({ channel: process.env.ZZ_BROWSER_CHANNEL || 'chrome', headless: true });
  const source = await contextPage();
  const files = await source.page.evaluate(async () => {
    const request = (req) =>
      new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    canvas.getContext('2d').fillRect(0, 0, 2, 2);
    const photo = await new Promise((resolve) => canvas.toBlob(resolve));
    const req = indexedDB.open('unlock-images-personal');
    req.onupgradeneeded = () => req.result.createObjectStore('images');
    const db = await request(req);
    const tx = db.transaction('images', 'readwrite');
    tx.objectStore('images').put(photo, 'lock');
    await new Promise((resolve) => tx.oncomplete = resolve);
    db.close();
    async function exportA(appId, rawEntries, media) {
      const worker = new Worker('/a/media-worker.mjs', { type: 'module' });
      try {
        return await new Promise((resolve, reject) => {
          worker.onerror = (event) => reject(Error(event.message));
          worker.onmessage = (event) => {
            if (event.data.verify) worker.postMessage({ confirm: true });
            else if (event.data.error) reject(Error(event.data.error));
            else resolve(event.data.file);
          };
          worker.postMessage({
            config: { appId, buildId: 'real-A-fixture', media },
            rawEntries,
            sourceOrigin: location.origin,
            sourcePath: `/${appId}/`,
            exporting: true,
          });
        });
      } finally {
        worker.terminate();
      }
    }
    return {
      json: [
        ...new Uint8Array(
          await (await exportA('zz10', { 'alter-settings-gesture-guide-v1': '1' }, null)).arrayBuffer(),
        ),
      ],
      zip: [
        ...new Uint8Array(
          await (await exportA('zz2', { 'unlock-install-personal-v1': '1' }, {
            db: 'unlock-images-personal',
            store: 'images',
          })).arrayBuffer(),
        ),
      ],
    };
  });
  await source.context.close();
  await check('A JSON in fresh profile: import, preserve public, switch, receipt retry', async () => {
    const { context, page } = await contextPage();
    try {
      const result = await page.evaluate(async (bytes) => {
        const data = await import('/tools/alter/zz-import/data.mjs'),
          apply = await import('/tools/alter/zz-import/apply.mjs');
        localStorage.setItem('friend-alter-settings-gesture-guide-v1', 'public');
        const candidate = await data.readImportFile(new File([new Uint8Array(bytes)], 'a.json'), 'alter');
        const preview = await apply.previewImport('alter', candidate);
        await apply.applyImport('alter', candidate, { expectedRevision: preview.revision });
        const original = localStorage.getItem('friend-alter-settings-gesture-guide-v1');
        await apply.activateProfile('alter', 'zz');
        const imported = localStorage.getItem('friend-alter-settings-gesture-guide-v1');
        await apply.activateProfile('alter', 'public');
        return {
          original,
          imported,
          restored: localStorage.getItem('friend-alter-settings-gesture-guide-v1'),
          duplicate:
            (await apply.applyImport('alter', candidate, { expectedRevision: preview.revision })).duplicate,
        };
      }, files.json);
      assert.deepEqual(result, { original: 'public', imported: '1', restored: 'public', duplicate: true });
    } finally {
      await context.close();
    }
  });
  await check('A ZIP in fresh profile: decode and preserve both photo profile hashes', async () => {
    const { context, page } = await contextPage();
    try {
      const result = await page.evaluate(async (bytes) => {
        const data = await import('/tools/release/zz-import/data.mjs'),
          apply = await import('/tools/release/zz-import/apply.mjs'),
          store = await import('/tools/release/zz-import/apply-store.mjs');
        const candidate = await data.readImportFile(new File([new Uint8Array(bytes)], 'a.zip'), 'release');
        const canvas = document.createElement('canvas');
        canvas.width = 3;
        canvas.height = 3;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 3, 3);
        const publicBlob = await new Promise((resolve) => canvas.toBlob(resolve));
        const item = candidate.media[0];
        await store.writeMedia({ ...item, value: publicBlob });
        localStorage.setItem('unlock-install-shared-v1', 'public');
        const expectedPublic = await data.sha256(publicBlob), expectedZZ = await data.sha256(item.value);
        const preview = await apply.previewImport('release', candidate);
        await apply.applyImport('release', candidate, { expectedRevision: preview.revision });
        const publicHash = await data.sha256(await store.readMedia(item));
        await apply.activateProfile('release', 'zz');
        const restored = await store.readMedia(item), bitmap = await createImageBitmap(restored);
        const zzHash = await data.sha256(restored);
        await apply.activateProfile('release', 'public');
        return {
          expectedPublic,
          expectedZZ,
          publicHash,
          zzHash,
          restoredPublic: await data.sha256(await store.readMedia(item)),
          width: bitmap.width,
          height: bitmap.height,
        };
      }, files.zip);
      assert.equal(result.publicHash, result.expectedPublic);
      assert.equal(result.zzHash, result.expectedZZ);
      assert.equal(result.restoredPublic, result.expectedPublic);
      assert.equal(result.width, 2);
      assert.equal(result.height, 2);
    } finally {
      await context.close();
    }
  });
  await check('truncated ZIP, bad hash, unsupported schema, missing photo fail without writes', async () => {
    const { context, page } = await contextPage();
    try {
      const result = await page.evaluate(async (files) => {
        const data = await import('/tools/release/zz-import/data.mjs');
        localStorage.setItem('unchanged', 'yes');
        let failures = 0;
        const json = JSON.parse(new TextDecoder().decode(new Uint8Array(files.json)));
        const candidate = await data.readImportFile(new Blob([new Uint8Array(files.zip)]), 'release');
        const attempts = [
          [new Blob(['{broken']), 'alter'],
          [new Blob([new Uint8Array(files.zip).slice(0, -5)]), 'release'],
          [new Blob([JSON.stringify({ ...json, schemaVersion: 8 })]), 'alter'],
          [new Blob([JSON.stringify({ ...json, contentHash: '0'.repeat(64) })]), 'alter'],
          [new Blob([JSON.stringify(candidate.snapshot)]), 'release'],
        ];
        for (const [file, target] of attempts) {
          try {
            await data.readImportFile(file, target);
          } catch {
            failures++;
          }
        }
        return { failures, unchanged: localStorage.getItem('unchanged'), keys: localStorage.length };
      }, files);
      assert.deepEqual(result, { failures: 5, unchanged: 'yes', keys: 1 });
    } finally {
      await context.close();
    }
  });
  await check(
    'denied reads produce warnings; no source and ambiguous shared keys produce no offer',
    async () => {
      const { context, page } = await contextPage();
      try {
        const result = await page.evaluate(async () => {
          const data = await import('/tools/hitsuzen/zz-import/data.mjs');
          const none = await data.discoverSources('hitsuzen');
          localStorage.setItem('magic-calc-skin', 'dark');
          const shared = await data.discoverSources('hitsuzen');
          const denied = await data.discoverSources('hitsuzen', {
            storage: {
              get length() {
                throw new DOMException('Denied', 'SecurityError');
              },
            },
            indexedDB: {
              databases: async () => {
                throw new DOMException('Denied', 'SecurityError');
              },
            },
          });
          return {
            none: none.candidates.length,
            shared: shared.candidates.length,
            denied: denied.candidates.length,
            warnings: denied.warnings.length,
          };
        });
        assert.deepEqual(result, { none: 0, shared: 0, denied: 0, warnings: 2 });
      } finally {
        await context.close();
      }
    },
  );
  await check('stale preview blocks before writes and permits fresh retry', async () => {
    const { context, page } = await contextPage();
    try {
      const result = await page.evaluate(async (bytes) => {
        const data = await import('/tools/alter/zz-import/data.mjs'),
          apply = await import('/tools/alter/zz-import/apply.mjs');
        const candidate = await data.readImportFile(new Blob([new Uint8Array(bytes)]), 'alter'),
          preview = await apply.previewImport('alter', candidate);
        localStorage.setItem('friend-alter-settings-gesture-guide-v1', 'edited');
        let blocked = false;
        try {
          await apply.applyImport('alter', candidate, { expectedRevision: preview.revision });
        } catch {
          blocked = true;
        }
        const preserved = localStorage.getItem('friend-alter-settings-gesture-guide-v1');
        const retry = await apply.previewImport('alter', candidate);
        await apply.applyImport('alter', candidate, { expectedRevision: retry.revision });
        return { blocked, preserved, complete: (await apply.previewImport('alter', candidate)).completed };
      }, files.json);
      assert.deepEqual(result, { blocked: true, preserved: 'edited', complete: true });
    } finally {
      await context.close();
    }
  });
  await check(
    'quota during localStorage write rolls back photo and public bytes; retry succeeds',
    async () => {
      const { context, page } = await contextPage();
      try {
        const result = await page.evaluate(async (bytes) => {
          const data = await import('/tools/release/zz-import/data.mjs'),
            apply = await import('/tools/release/zz-import/apply.mjs'),
            store = await import('/tools/release/zz-import/apply-store.mjs');
          const candidate = await data.readImportFile(new Blob([new Uint8Array(bytes)]), 'release');
          localStorage.setItem('unlock-install-shared-v1', 'public');
          const preview = await apply.previewImport('release', candidate);
          const original = Storage.prototype.setItem;
          let once = true;
          Storage.prototype.setItem = function (key, value) {
            if (once && key === 'unlock-install-shared-v1') {
              once = false;
              throw new DOMException('Injected quota', 'QuotaExceededError');
            }
            return original.call(this, key, value);
          };
          let blocked = false;
          try {
            await apply.applyImport('release', candidate, {
              activate: 'zz',
              expectedRevision: preview.revision,
            });
          } catch {
            blocked = true;
          } finally {
            Storage.prototype.setItem = original;
          }
          const preserved = localStorage.getItem('unlock-install-shared-v1'),
            photoRemoved = (await store.readMedia(candidate.media[0])) === undefined,
            receipt = (await apply.previewImport('release', candidate)).completed;
          const retry = await apply.previewImport('release', candidate);
          await apply.applyImport('release', candidate, { expectedRevision: retry.revision, activate: 'zz' });
          return {
            blocked,
            preserved,
            photoRemoved,
            receipt,
            retried: (await apply.previewImport('release', candidate)).completed,
          };
        }, files.zip);
        assert.deepEqual(result, {
          blocked: true,
          preserved: 'public',
          photoRemoved: true,
          receipt: false,
          retried: true,
        });
      } finally {
        await context.close();
      }
    },
  );
  await check('journal quota rejects before any destination write', async () => {
    const { context, page } = await contextPage();
    try {
      const result = await page.evaluate(async (bytes) => {
        const data = await import('/tools/release/zz-import/data.mjs'),
          apply = await import('/tools/release/zz-import/apply.mjs'),
          store = await import('/tools/release/zz-import/apply-store.mjs');
        const candidate = await data.readImportFile(new Blob([new Uint8Array(bytes)]), 'release');
        localStorage.setItem('unlock-install-shared-v1', 'public');
        const preview = await apply.previewImport('release', candidate);
        let writes = 0, blocked = false;
        const quotaStore = {
          ...store.browserStore,
          statePut: async () => {
            throw new DOMException('Injected journal quota', 'QuotaExceededError');
          },
          set: () => {
            writes++;
          },
          writeMedia: async () => {
            writes++;
          },
        };
        try {
          await apply.applyImport('release', candidate, {
            store: quotaStore,
            activate: 'zz',
            expectedRevision: preview.revision,
          });
        } catch {
          blocked = true;
        }
        return {
          blocked,
          writes,
          preserved: localStorage.getItem('unlock-install-shared-v1'),
          photoAbsent: (await store.readMedia(candidate.media[0])) === undefined,
          completed: (await apply.previewImport('release', candidate)).completed,
        };
      }, files.zip);
      assert.deepEqual(result, {
        blocked: true,
        writes: 0,
        preserved: 'public',
        photoAbsent: true,
        completed: false,
      });
    } finally {
      await context.close();
    }
  });
  await check('page closure after media and localStorage write rolls back journal on reopen', async () => {
    const { context, page } = await contextPage();
    try {
      await page.evaluate(async (bytes) => {
        const data = await import('/tools/release/zz-import/data.mjs'),
          apply = await import('/tools/release/zz-import/apply.mjs'),
          store = await import('/tools/release/zz-import/apply-store.mjs');
        const candidate = await data.readImportFile(new Blob([new Uint8Array(bytes)]), 'release');
        localStorage.setItem('unlock-install-shared-v1', 'public');
        const preview = await apply.previewImport('release', candidate);
        const crashStore = {
          ...store.browserStore,
          statePut: async (key, value) => {
            await store.statePut(key, value);
            if (key === 'journal:release' && value.step === 'entry:0') {
              globalThis.crashPoint = true;
              await new Promise(() => {});
            }
          },
        };
        globalThis.pendingImport = apply.applyImport('release', candidate, {
          store: crashStore,
          activate: 'zz',
          expectedRevision: preview.revision,
        });
      }, files.zip);
      await page.waitForFunction(() => globalThis.crashPoint);
      await page.close();
      const reopened = await context.newPage();
      await reopened.goto(origin + '/fixture');
      const result = await reopened.evaluate(async (bytes) => {
        const data = await import('/tools/release/zz-import/data.mjs'),
          apply = await import('/tools/release/zz-import/apply.mjs'),
          store = await import('/tools/release/zz-import/apply-store.mjs');
        const candidate = await data.readImportFile(new Blob([new Uint8Array(bytes)]), 'release');
        const recovered = await apply.recoverImport('release');
        return {
          recovered: recovered.recovered,
          public: localStorage.getItem('unlock-install-shared-v1'),
          photoRemoved: (await store.readMedia(candidate.media[0])) === undefined,
          completed: (await apply.previewImport('release', candidate)).completed,
        };
      }, files.zip);
      assert.deepEqual(result, { recovered: true, public: 'public', photoRemoved: true, completed: false });
    } finally {
      await context.close();
    }
  });
  await check('real two-tab live locks reject import; close sibling then import and retry once', async () => {
    const { context, page } = await contextPage();
    try {
      await page.goto(origin + '/tools/alter/');
      await page.waitForSelector('[data-zz-ready=true]', { state: 'attached' });
      const sibling = await context.newPage();
      await sibling.goto(origin + '/tools/alter/');
      await sibling.waitForSelector('[data-zz-ready=true]', { state: 'attached' });
      const blocked = await page.evaluate(async () => {
        const { exclusiveWrite } = await import('/tools/alter/zz-import/ui-bootstrap.mjs');
        try {
          await exclusiveWrite(() => localStorage.setItem('unsafe-write', 'yes'));
          return false;
        } catch (error) {
          return /다른 탭/.test(error.message);
        }
      });
      assert.equal(blocked, true);
      assert.equal(await page.evaluate(() => localStorage.getItem('unsafe-write')), null);
      await sibling.close();
      const oldTab = await context.newPage();
      await oldTab.goto(origin + '/tools/alter/legacy-fixture');
      const oldBlocked = await page.evaluate(async () => {
        const { exclusiveWrite } = await import('/tools/alter/zz-import/ui-bootstrap.mjs');
        try {
          await exclusiveWrite(() => localStorage.setItem('unsafe-write', 'yes'));
          return false;
        } catch (error) {
          return /다른 탭/.test(error.message);
        }
      });
      assert.equal(oldBlocked, true, 'SW must find previous-shell tabs without live locks');
      await oldTab.close();
      const result = await page.evaluate(async (bytes) => {
        const data = await import('/tools/alter/zz-import/data.mjs'),
          apply = await import('/tools/alter/zz-import/apply.mjs'),
          { exclusiveWrite } = await import('/tools/alter/zz-import/ui-bootstrap.mjs');
        const candidate = await data.readImportFile(new Blob([new Uint8Array(bytes)]), 'alter'),
          preview = await apply.previewImport('alter', candidate);
        await exclusiveWrite(() =>
          apply.applyImport('alter', candidate, { expectedRevision: preview.revision })
        );
        return (await exclusiveWrite(() =>
          apply.applyImport('alter', candidate, { expectedRevision: preview.revision })
        )).duplicate;
      }, files.json);
      assert.equal(result, true);
    } finally {
      await context.close();
    }
  });
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  JSON.stringify(
    {
      browser: 'installed Chrome',
      checks: results.length,
      passed: results.filter((x) => x.passed).length,
      results,
    },
    null,
    2,
  ),
);
if (results.some((result) => !result.passed)) process.exitCode = 1;
