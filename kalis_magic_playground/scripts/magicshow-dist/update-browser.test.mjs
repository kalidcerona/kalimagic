import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/sumpie/.insane-search/node/node_modules/playwright-core');
const historical = name => execFileSync('git', ['show', `f459ea2:./distribution-snapshots/magicshow/${name}`], { maxBuffer: 32 * 1024 * 1024 });
const oldSW = historical('sw.js').toString();
const oldPrompt = historical('update-prompt.js').toString();
const newPrompt = readFileSync(new URL('./update-prompt.js', import.meta.url), 'utf8');
const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
const shell = JSON.parse(oldSW.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
const currentWorker = readFileSync(new URL('../../distribution-snapshots/magicshow/sw.js', import.meta.url), 'utf8');
const currentShell = JSON.parse(currentWorker.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
const currentFiles = new Map();
for (const file of currentShell.filter(f => !/^\.\/(assets|fonts)\//.test(f))) {
  currentFiles.set(file.slice(2), readFileSync(new URL('../../distribution-snapshots/magicshow/' + file.slice(2), import.meta.url)));
}
const oldFiles = new Map();
for (const file of shell.filter(f => !/^\.\/(assets|fonts)\//.test(f))) oldFiles.set(file.slice(2), historical(file.slice(2)));
const newSW = version => template.replace('__VERSION__', version).replace(/const SHELL = \[[\s\S]*?\];/, `const SHELL = ${JSON.stringify(currentShell)};`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('one local profile: historical build 20 -> rescue -> normal update; saves preserved', { timeout: 120000 }, async () => {
  let version = '20', holdArt = true, held = [], artRequests = 0, legacyPrompt = false;
  const requests = [];
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://127.0.0.1').pathname.replace('/tools/magicshow/', '');
    requests.push({ version, name });
    res.setHeader('Cache-Control', 'no-store');
    if (name.startsWith('assets/') || name.startsWith('fonts/')) {
      artRequests++;
      if (holdArt && version === '20') { held.push(res); return; }
      res.writeHead(503); res.end('injected optional-art outage'); return;
    }
    res.setHeader('Content-Type', name.endsWith('.js') || name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
    if (name === 'sw.js') { res.end(version === '20' ? oldSW : newSW(version)); return; }
    if (name === 'harness.html') {
      res.end(`<!doctype html><meta charset="utf-8"><title>Lifecycle fixture</title><div id="titleScreen">${version}</div><script>window.MagicShowUI={isRestScreen:()=>true,save:()=>{throw Error('title must not save')}};</script>${legacyPrompt ? '<script src="/legacy-prompt.js"></script>' : ''}`);
      return;
    }
    if (req.url === '/legacy-prompt.js') { res.end(oldPrompt); return; }
    if (name === 'update-prompt.js' && version !== '20') { res.end(newPrompt); return; }
    const files = version === '20' ? oldFiles : currentFiles;
    if (files.has(name)) { res.end(files.get(name)); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
      args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    // Session-only instrumentation survives reload without touching the game's storage.
    await page.addInitScript(() => {
      sessionStorage.setItem('test.documents', String(Number(sessionStorage.getItem('test.documents') || 0) + 1));
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        sessionStorage.setItem('test.claimDocument', sessionStorage.getItem('test.documents'));
        sessionStorage.setItem('test.claims', String(Number(sessionStorage.getItem('test.claims') || 0) + 1));
      });
    });
    await page.goto(`${origin}/tools/magicshow/harness.html`);
    await page.evaluate(async () => { await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const saves = { 'magicShowBuster.v3': '{"version":25,"gold":120,"progress":"보존"}', 'magicShowBuster.v3.backup': 'backup-bytes', 'magicShowBuster.v3.slots': 'slot-bytes' };
    await page.evaluate(values => { for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v); }, saves);
    const storage = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    const before = await storage();
    // Start the exact historical worker's long-lived art message, then run the new prompt against it.
    await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_ART' }));
    for (let i = 0; !held.length && i < 100; i++) await sleep(50);
    assert.ok(held.length, 'historical optional art is actually in flight');
    await page.addScriptTag({ content: newPrompt });
    version = '26a';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.locator('[data-update]').waitFor({ state: 'visible' });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    const documents = await page.evaluate(() => Number(sessionStorage.getItem('test.documents')));
    const claims = await page.evaluate(() => Number(sessionStorage.getItem('test.claims')));
    await page.locator('[data-update]').click();
    await page.locator('[data-retry]').waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.documents'))), documents, 'zero reloads after five seconds without claim');
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.claims'))), claims, 'no replacement controllerchange yet');
    holdArt = false;
    for (const res of held) { res.writeHead(503); res.end('released injected outage'); } held = [];
    await page.waitForFunction(n => Number(sessionStorage.getItem('test.documents')) === n + 1, documents, { timeout: 45000 });
    await sleep(1500);
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.documents'))), documents + 1, 'exactly one reload');
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.claimDocument'))), documents, 'claim occurred in the preceding document');
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.claims'))), claims + 1, 'exactly one replacement controllerchange');
    assert.deepEqual(await storage(), before);
    assert.ok(requests.filter(r => r.version === '26a' && !r.name.startsWith('assets/')).length > 0);
    const identity = await page.evaluate(() => new Promise(resolve => {
      const ch = new MessageChannel(); ch.port1.onmessage = e => resolve(e.data.release);
      navigator.serviceWorker.controller.postMessage({ type: 'GET_RELEASE' }, [ch.port2]);
    }));
    assert.match(identity, /26a/);
    const upgradedData = await page.evaluate(async () => (await fetch('./data-base.js')).text());
    assert.equal(upgradedData, currentFiles.get('data-base.js').toString(), 'new controller serves current build data, not cached build 20');
    assert.notEqual(upgradedData, oldFiles.get('data-base.js').toString());
    console.log('Historical build 20 held >5s: zero early reloads; accepted claim: one reload; all save bytes identical.');
    // Same profile: restore build 20, then exercise its unmodified prompt with only sw.js upgraded.
    version = '20';
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration(); await r.update();
      await new Promise(resolve => { if (r.waiting) return resolve(); r.installing.addEventListener('statechange', () => { if (r.waiting) resolve(); }); });
      r.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
    await sleep(300);
    legacyPrompt = true;
    // Pre-fill optional cache entries so the legacy warming is light in this compatibility case.
    await page.evaluate(async ({ shell, cacheName }) => {
      const cache = await caches.open(cacheName);
      for (const file of shell.filter(f => /^\.\/(assets|fonts)\//.test(f))) await cache.put(new URL(file, location.href), new Response('optional fixture'));
    }, { shell, cacheName: oldSW.match(/const CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/)[1] ? 'magicshow-dist-' + oldSW.match(/const CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/)[1] : '' });
    await page.goto(`${origin}/tools/magicshow/harness.html`);
    const legacyDocuments = await page.evaluate(() => Number(sessionStorage.getItem('test.documents')));
    version = '26b';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.locator('[data-update]').waitFor({ state: 'visible' });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    await page.locator('[data-update]').click();
    await page.waitForFunction(n => Number(sessionStorage.getItem('test.documents')) === n + 1, legacyDocuments);
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.claimDocument'))), legacyDocuments);
    await sleep(5500);
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.documents'))), legacyDocuments + 1);
    assert.deepEqual(await storage(), before);
    console.log('Unmodified build-20 prompt + same sw.js rescue: controllerchange before one reload; saves unchanged.');
    await context.setOffline(true);
    const offlineShell = await page.evaluate(async files => {
      const results = [];
      for (const file of files) {
        const response = await fetch(file);
        results.push({ file, ok: response.ok, text: await response.text() });
      }
      return results;
    }, currentShell.filter(f => /\.(?:html|js|mjs|css)$/.test(f)));
    for (const result of offlineShell) {
      assert.equal(result.ok, true, `offline rescue shell: ${result.file}`);
      const expected = result.file === './sw.js' ? newSW('26b') :
        result.file === './update-prompt.js' ? newPrompt : currentFiles.get(result.file.slice(2)).toString();
      assert.equal(result.text, expected, `offline bytes: ${result.file}`);
    }
    assert.deepEqual(await storage(), before);
    await context.setOffline(false);
    console.log('Rescue offline: every HTML/JS/CSS shell response matches the installed release; saves unchanged.');
    legacyPrompt = false;
    await page.goto(`${origin}/tools/magicshow/harness.html`);
    await page.addScriptTag({ content: newPrompt });
    version = '26c';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.locator('[data-update]').waitFor({ state: 'visible' });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    const normalDocuments = await page.evaluate(() => Number(sessionStorage.getItem('test.documents')));
    assert.deepEqual(await storage(), before);
    await page.locator('[data-update]').click();
    await page.waitForFunction(n => Number(sessionStorage.getItem('test.documents')) === n + 1, normalDocuments);
    await sleep(500);
    assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('test.documents'))), normalDocuments + 1);
    assert.deepEqual(await storage(), before);
    const criticalCount = currentShell.filter(f => !/^\.\/(assets|fonts)\//.test(f)).length;
    const installedCount = await page.evaluate(async () => {
      const names = await caches.keys(); const name = names.find(n => n.includes('26c'));
      return (await (await caches.open(name)).keys()).length;
    });
    assert.ok(installedCount >= criticalCount, 'modern-to-modern update installs the full critical shell');
    console.log('Modern-to-modern update: full critical shell installed, one accepted reload, saves unchanged.');
    console.log(JSON.stringify({ profiles: 1, historicalCommit: 'f459ea2', optionalRequests: artRequests, savesUnchanged: true }));
    await context.close();
  } finally {
    for (const res of held) res.destroy();
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
