// Run against a completed public build with Chrome and the existing Playwright fixture dependency.
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZZ_IMPORT_TARGETS } from '../../scripts/zz-import-build.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.MAGIC_PLAYWRIGHT_MODULE || 'playwright');
const dist = path.resolve(process.env.ZZ_B_DIST || fileURLToPath(new URL('../../dist/', import.meta.url)));
const controls = {
  kairos: ['#settings-entry-tutorial-dismiss', '#p-control'],
  'kairos-classic': ['#settings-entry-tutorial-dismiss', '#p-control'],
  release: ['#settings-entry-tutorial-dismiss', '#lock-screen'],
  hitsuzen: ['#settings-entry-tutorial-dismiss', '[data-key="7"]'],
  choice: ['#settings-gesture-dismiss', '#new-list'],
  aletheia: ['#settings-gesture-dismiss', '#card-start-button', '#stage-canvas'],
  tobira: ['#settings-gesture-dismiss', '#start-show'],
  usotsuki: ['button:text-is("알겠어요")', '#detector-button'],
  asrai: ['.gesture-guide button', '#start-performance', '#contact-list-screen'],
  alter: ['#close-gesture-guide', '#setup-settings'],
  tyche: ['#guide-close'],
  memdeck: ['button:text-is("알겠어요")', '[data-tab="quiz"]'],
  arosaegida: ['button:text-is("알겠어요")', '#generate'],
  pimax: ['[data-action="install-later"]', '[data-tab="learn"]'],
  uramichi: ['#installLater', '#gateBtn', '#switchCamera'],
};
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const filename = path.resolve(dist, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  try {
    if (!filename.startsWith(dist + path.sep)) throw new Error('Outside fixture root');
    const body = await readFile(filename);
    res.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.ZZ_BROWSER_CHANNEL || 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

async function checkStartup(target, mode) {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 412, height: 850 },
    serviceWorkers: 'block',
  });
  let releaseResponse;
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  const appUrl = `${origin}/tools/${target}/`;
  const uiUrl = appUrl + 'zz-import/ui.mjs';
  try {
    await context.route((url) => url.origin !== origin, (route) => route.abort());
    await context.route(uiUrl, async (route) => {
      if (mode === '503') return route.fulfill({ status: 503 });
      await responseGate;
      if (mode === 'delayed') await route.continue();
      else await route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const cdp = await context.newCDPSession(page);
    const scriptUrls = new Map();
    const handlers = new EventEmitter();
    cdp.on('Debugger.scriptParsed', ({ scriptId, url }) => scriptUrls.set(scriptId, url));
    cdp.on('Debugger.paused', ({ callFrames }) => {
      const url = scriptUrls.get(callFrames[0]?.location.scriptId);
      if (url?.startsWith(appUrl) && !url.startsWith(appUrl + 'zz-import/')) handlers.emit('app-handler');
      void cdp.send('Debugger.resume');
    });
    await cdp.send('Debugger.enable');
    const uiResponse = mode === '503' ? page.waitForResponse(uiUrl) : null;
    await Promise.all([
      page.waitForRequest(uiUrl),
      page.goto(appUrl, { waitUntil: 'commit' }),
      uiResponse,
    ]);
    if (mode === '503') assert.equal((await uiResponse).status(), 503);
    await page.locator('[data-zz-ready="true"]').waitFor({ state: 'attached' });
    // Pausing the preceding touch or pointer event can prevent Chrome from dispatching its click.
    await cdp.send('DOMDebugger.setEventListenerBreakpoint', { eventName: 'click' });
    const visibleControls = controls[target].map((selector) => page.locator(`${selector}:visible`).first());
    await page.locator(controls[target].map((selector) => `${selector}:visible`).join(', ')).first().waitFor();
    let control;
    for (const candidate of visibleControls) {
      if (await candidate.isVisible()) {
        control = candidate;
        break;
      }
    }
    assert.ok(control, 'no visible first-touch control');
    await Promise.all([
      once(handlers, 'app-handler', { signal: AbortSignal.timeout(6000) }).catch((error) => {
        throw new Error('first tap never reached an app handler', { cause: error });
      }),
      control.tap(),
    ]);
    assert.equal(await page.getByText('이전 데이터 복구를 완료하지 못해 앱 시작을 멈췄습니다.', { exact: false }).count(), 0);
    if (mode === 'delayed') {
      const response = page.waitForResponse(uiUrl);
      releaseResponse();
      assert.equal((await response).status(), 200);
    }
    await cdp.detach();
  } catch (error) {
    throw new Error(`${target} ${mode}: ${error.message}`, { cause: error });
  } finally {
    releaseResponse();
    await context.close();
  }
}

try {
  const targets = process.env.ZZ_TARGET ? [process.env.ZZ_TARGET] : ZZ_IMPORT_TARGETS;
  for (const target of targets) {
    for (const mode of ['delayed', 'pending', '503']) await checkStartup(target, mode);
    console.log(`${target}: first touch reached an app handler with delayed, pending and HTTP 503 importer UI`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
