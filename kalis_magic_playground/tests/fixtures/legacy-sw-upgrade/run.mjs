// Real browser upgrade fixture. VM tests do not prove this path.
// Historical workers are served from tests/fixtures/legacy and are not modified.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outputDir = await mkdtemp(path.join(os.tmpdir(), 'magic-legacy-upgrade-'));
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const historicalWorker = await readFile(path.join(root, 'tests/fixtures/legacy/landscape-sw.js'));
const migration = await readFile(path.join(root, 'scripts/legacy-storage-migration.mjs'));
const contract = await readFile(path.join(root, 'scripts/legacy-shared-contract.mjs'));
const { legacyBridgeSource } = await import('../../../scripts/legacy-sw-bridge.mjs');
const { legacyWorkerSpecByTool } = await import('../../../scripts/legacy-shared-contract.mjs');
const bridge = Buffer.from(legacyBridgeSource(legacyWorkerSpecByTool('stopwatch')));

const performanceHtml = `<!doctype html><meta charset="utf-8"><title>perf</title>
<script>
window.__boot = Date.now();
window.__ticks = 0;
setInterval(() => { window.__ticks += 1; }, 50);
localStorage.setItem('stopwatch_preset_cs', '1187');
localStorage.setItem('stopwatch_preset_at', '1700000000001');
localStorage.setItem('stopwatch2_preset_cs', '2222');
localStorage.setItem('magic-calc-skin', 'iphone');
localStorage.setItem('zz6-sentinel', 'stay');
navigator.serviceWorker.register('/tools/stopwatch/sw.js', { updateViaCache: 'none' });
</script>`;
const canonicalHtml = `<!doctype html><meta charset="utf-8"><title>canonical</title>
<script type="module">
import { migrateTrustedLegacyStorage } from './legacy-storage-migration.mjs';
const result = migrateTrustedLegacyStorage({
  target: 'kairos-classic',
  storage: localStorage,
  session: sessionStorage,
  pathname: location.pathname,
  search: location.search
});
document.documentElement.dataset.result = JSON.stringify(result);
document.documentElement.dataset.preset = localStorage.getItem('friend-kairos-classic_preset_cs') || '';
document.documentElement.dataset.raw = localStorage.getItem('stopwatch_preset_cs') || '';
document.documentElement.dataset.portrait = localStorage.getItem('stopwatch2_preset_cs') || '';
document.documentElement.dataset.skin = localStorage.getItem('magic-calc-skin') || '';
document.documentElement.dataset.marker = localStorage.getItem('friend-kairos-classic_legacy_shared_migrated_v1') || '';
document.documentElement.dataset.sentinel = localStorage.getItem('zz6-sentinel') || '';
</script>`;


class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const data = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString();
      const message = JSON.parse(data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

let phase = 'historical';
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const send = (body, type) => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store, no-cache' });
    res.end(body);
  };
  if (url.pathname === '/tools/stopwatch/sw.js') {
    send(phase === 'historical' ? historicalWorker : bridge, 'application/javascript; charset=utf-8');
    return;
  }
  if (url.pathname === '/tools/stopwatch/' || url.pathname === '/tools/stopwatch/index.html') {
    send(performanceHtml, 'text/html; charset=utf-8');
    return;
  }
  if (url.pathname === '/tools/stopwatch/manifest.webmanifest') {
    send('{"name":"스톱워치","start_url":"./"}', 'application/manifest+json');
    return;
  }
  if (url.pathname === '/tools/stopwatch/icon-192.png' || url.pathname === '/tools/stopwatch/icon-512.png') {
    send(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png');
    return;
  }
  if (url.pathname === '/tools/kairos-classic/' || url.pathname === '/tools/kairos-classic/index.html') {
    send(canonicalHtml, 'text/html; charset=utf-8');
    return;
  }
  if (url.pathname === '/tools/kairos-classic/legacy-storage-migration.mjs') {
    send(migration, 'text/javascript; charset=utf-8');
    return;
  }
  if (url.pathname === '/tools/kairos-classic/legacy-shared-contract.mjs') {
    send(contract, 'text/javascript; charset=utf-8');
    return;
  }
  res.writeHead(404, { 'Cache-Control': 'no-store' });
  res.end('missing');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
await mkdir(outputDir, { recursive: true });
const profile = await mkdtemp(path.join(outputDir, 'chrome-profile-'));
const result = {
  status: 'UNEXECUTED',
  browser: 'Google Chrome',
  note: 'VM service-worker mocks are not evidence of a browser upgrade.',
};

function finish(status, extra = {}) {
  Object.assign(result, extra, { status });
}

let chrome;
try {
  await readFile(chromePath);
  chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--disable-crash-reporter',
    '--disable-breakpad',
    `--user-data-dir=${profile}`,
    `--crash-dumps-dir=${path.join(outputDir, 'crashes')}`,
    '--remote-debugging-port=0',
    'about:blank',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  const browserWs = await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error(`devtools did not start: ${text}`)), 10000);
    const onData = (chunk) => {
      text += chunk;
      const match = text.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/\S+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    chrome.stderr.on('data', onData);
    chrome.stdout.on('data', onData);
    chrome.on('exit', (code) => reject(new Error(`chrome exited ${code}: ${text}`)));
  });
  const cdp = new Cdp(new WebSocket(browserWs));
  await new Promise((resolve, reject) => {
    cdp.ws.addEventListener('open', resolve, { once: true });
    cdp.ws.addEventListener('error', reject, { once: true });
  });
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url: `${origin}/tools/stopwatch/index.html` }, sessionId);
  const ready = await evaluateNavigated(cdp, sessionId, `Promise.race([
    navigator.serviceWorker.ready.then((registration) => ({ scriptURL: registration.active && registration.active.scriptURL, scope: registration.scope })),
    new Promise((_, reject) => setTimeout(() => reject(new Error('historical install timeout')), 8000))
  ])`);
  phase = 'bridge';
  const upgraded = await evaluate(cdp, sessionId, `(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/tools/stopwatch/');
    const changed = new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve('controllerchange'), { once: true });
    });
    await registration.update();
    const signal = await Promise.race([
      changed,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 8000))
    ]);
    const current = await navigator.serviceWorker.getRegistration('/tools/stopwatch/');
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      signal,
      scriptURL: current.active && current.active.scriptURL,
      scope: current.scope,
      href: location.href,
      title: document.title,
      boot: window.__boot,
      ticks: window.__ticks,
      caches: await caches.keys(),
    };
  })()`);
  const next = await cdp.send('Target.createTarget', { url: `${origin}/tools/stopwatch/` });
  const nextAttached = await cdp.send('Target.attachToTarget', { targetId: next.targetId, flatten: true });
  await cdp.send('Page.enable', {}, nextAttached.sessionId);
  await cdp.send('Runtime.enable', {}, nextAttached.sessionId);
  const launched = await evaluateNavigated(cdp, nextAttached.sessionId, `(async () => {
    const started = Date.now();
    while (!document.documentElement.dataset.result && Date.now() - started < 8000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    return {
      href: location.href,
      dataset: { ...document.documentElement.dataset },
      scopes: registrations.map((registration) => registration.scope),
    };
  })()`);
  const stillThere = await evaluate(cdp, sessionId, `({ href: location.href, title: document.title, boot: window.__boot, ticks: window.__ticks })`);
  const failures = [];
  if (ready.scope !== `${origin}/tools/stopwatch/`) failures.push(`historical scope ${ready.scope}`);
  if (upgraded.signal !== 'controllerchange') failures.push(`update signal ${upgraded.signal}`);
  if (upgraded.scriptURL !== `${origin}/tools/stopwatch/sw.js`) failures.push(`scriptURL ${upgraded.scriptURL}`);
  if (upgraded.scope !== `${origin}/tools/stopwatch/`) failures.push(`bridge scope ${upgraded.scope}`);
  if (upgraded.href !== `${origin}/tools/stopwatch/index.html`) failures.push(`active href ${upgraded.href}`);
  if (upgraded.title !== 'perf' || upgraded.boot !== stillThere.boot) failures.push('active performance page changed');
  if (!(upgraded.ticks > 0) || stillThere.ticks < upgraded.ticks) failures.push('performance timer interrupted');
  if (!upgraded.caches.includes('kali-stopwatch-v2')) failures.push(`caches ${upgraded.caches.join(',')}`);
  if (launched.href !== `${origin}/tools/kairos-classic/`) failures.push(`next launch ${launched.href}`);
  if (launched.dataset.preset !== '1187' || launched.dataset.raw !== '1187') failures.push('raw value was not preserved into an empty canonical key');
  if (launched.dataset.portrait !== '2222') failures.push('portrait value changed');
  if (launched.dataset.skin !== 'iphone' || launched.dataset.sentinel !== 'stay') failures.push('other app sentinel changed');
  if (launched.dataset.marker !== '1') failures.push('marker missing');
  if (launched.scopes.some((scope) => scope.includes('/tools/kairos-classic/'))) failures.push(`canonical scope controlled ${launched.scopes.join(',')}`);
  finish(failures.length ? 'FAILED' : 'EXECUTED', {
    ready, upgraded, launched, stillThere, failures,
  });
  chrome.kill('SIGTERM');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const home = process.env.HOME || '';
  finish(result.status === 'FAILED' ? 'FAILED' : 'UNEXECUTED', {
    error: home ? message.replaceAll(home, '$HOME') : message,
  });
} finally {
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    const closed = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill('SIGTERM');
    let timer;
    await Promise.race([closed, new Promise((resolve) => { timer = setTimeout(resolve, 3000); })]);
    clearTimeout(timer);
    if (chrome.exitCode === null && chrome.signalCode === null) { chrome.kill('SIGKILL'); await closed; }
  }
  server.close();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  await writeFile(path.join(outputDir, 'legacy-sw-browser-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ artifact: path.join(outputDir, 'legacy-sw-browser-result.json'), status: result.status, failures: result.failures || [], error: result.error || null }));
  process.exit(result.status === 'EXECUTED' ? 0 : 2);
}

function evaluate(cdp, sessionId, expression) {
  return cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId).then((value) => {
    if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
    return value.result.value;
  });
}

// Navigation replaces execution contexts; retry only these idempotent readiness reads.
async function evaluateNavigated(cdp, sessionId, expression) {
  const deadline = Date.now() + 15000;
  while (true) {
    try { return await evaluate(cdp, sessionId, expression); }
    catch (error) {
      if (!/Execution context was destroyed|Cannot find context/.test(String(error)) || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
