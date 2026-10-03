import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MAGIC_PLAYWRIGHT_MODULE || 'playwright');
const appUrl = process.env.MAGIC_ASRAI_TEST_URL || 'http://127.0.0.1:19405/kalis_magic_playground/zz8/';

async function newPage(browser, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(appUrl);
  await page.locator('#contact-list-screen:not([hidden])').waitFor();
  return { context, page, cdp: await context.newCDPSession(page) };
}

async function dispatch(cdp, type, touchPoints) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
}

test('trusted two-finger move opens settings before the screen-change pointer cancellation', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context, page, cdp } = await newPage(browser);
    await page.evaluate(() => {
      window.__touchLog = [];
      window.addEventListener('pointercancel', (event) => window.__touchLog.push({ type: 'pointercancel', trusted: event.isTrusted, settingsOpen: !document.querySelector('#settings-screen').hidden }), true);
      window.addEventListener('touchmove', (event) => window.__touchLog.push({ type: 'touchmove', trusted: event.isTrusted, prevented: event.defaultPrevented }), false);
    });
    const points = (y) => [{ x: 160, y, id: 1 }, { x: 230, y, id: 2 }];
    await dispatch(cdp, 'touchStart', points(110));
    await dispatch(cdp, 'touchMove', points(170));
    await dispatch(cdp, 'touchMove', points(250));
    await dispatch(cdp, 'touchEnd', []);
    await page.locator('#settings-screen:not([hidden])').waitFor({ timeout: 3000 });
    const events = await page.evaluate(() => window.__touchLog);
    assert.ok(events.some((event) => event.type === 'touchmove' && event.trusted && event.prevented), JSON.stringify(events));
    assert.equal(events.some((event) => event.type === 'pointercancel' && !event.settingsOpen), false, JSON.stringify(events));
    await cdp.detach();
    await context.close();
  } finally {
    await browser.close();
  }
});

test('single-finger list scroll, contact tap, and search remain available', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const scrolling = await newPage(browser, { width: 320, height: 320 });
    await scrolling.page.evaluate(() => {
      window.__touchLog = [];
      window.addEventListener('touchmove', (event) => window.__touchLog.push({ trusted: event.isTrusted, prevented: event.defaultPrevented }), false);
    });
    await dispatch(scrolling.cdp, 'touchStart', [{ x: 160, y: 290, id: 11 }]);
    await dispatch(scrolling.cdp, 'touchMove', [{ x: 160, y: 100, id: 11 }]);
    await dispatch(scrolling.cdp, 'touchEnd', []);
    await scrolling.page.waitForTimeout(250);
    const scrollState = await scrolling.page.evaluate(() => ({ y: window.scrollY, events: window.__touchLog }));
    assert.ok(scrollState.y > 0, JSON.stringify(scrollState));
    assert.ok(scrollState.events.some((event) => event.trusted && !event.prevented), JSON.stringify(scrollState));
    await scrolling.cdp.detach();
    await scrolling.context.close();

    const tapping = await newPage(browser);
    const first = await tapping.page.locator('#contact-list button').first().boundingBox();
    assert.ok(first);
    const x = first.x + first.width / 2;
    const y = first.y + first.height / 2;
    await dispatch(tapping.cdp, 'touchStart', [{ x, y, id: 21 }]);
    await dispatch(tapping.cdp, 'touchEnd', []);
    await tapping.page.locator('#contact-detail-screen:not([hidden])').waitFor({ timeout: 3000 });
    await tapping.cdp.detach();
    await tapping.context.close();

    const searching = await newPage(browser);
    const search = await searching.page.locator('#contact-search').boundingBox();
    assert.ok(search);
    const sx = search.x + search.width / 2;
    const sy = search.y + search.height / 2;
    await dispatch(searching.cdp, 'touchStart', [{ x: sx, y: sy, id: 31 }]);
    await dispatch(searching.cdp, 'touchEnd', []);
    await searching.page.waitForFunction(() => document.activeElement?.id === 'contact-search', undefined, { timeout: 3000 });
    await searching.page.locator('#contact-search').fill('별빛 하나');
    await searching.page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('#contact-list button'));
      return rows.length === 1 && rows[0].textContent === '별빛 하나';
    }, undefined, { timeout: 3000 });
    await searching.cdp.detach();
    await searching.context.close();
  } finally {
    await browser.close();
  }
});
