// Run with the installed Playwright core and bundled headless shell. Requests never leave the fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE_PATH + '/index.mjs');
const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = 'http://localhost';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const codes = ['2026-08', 'mongwhan-2026', 'garage-life-2026', 'kwangwoon-2026',
  'yonsei-korea-sogang-2026', 'hanyang-2026', 'hanyang-2025-2', 'kali-big-meetup-2025',
  'hanyang-2025-1', 'hanyang-2024', 'umu-lecture-2023'];
const title = '공개행사후기'.repeat(12);
const body = '연속된본문을끝까지읽습니다'.repeat(20);
function requestBarrier() {
  let ready;
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Expected eleven distinct event review requests')), 5000);
    ready = () => { clearTimeout(timer); resolve(); };
  });
  return { promise, ready };
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
async function geometry(element) {
  return element.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()];
    const parent = node.parentElement.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return {
      lines: new Set(rects.map(r => r.y)).size,
      contained: rects.every(r => r.left >= parent.left - 1 && r.right <= parent.right + 1 && r.bottom <= box.bottom + 1),
      width: [node.scrollWidth, node.clientWidth],
      pageWidth: [document.documentElement.scrollWidth, window.innerWidth]
    };
  });
}
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    const held = new Map();
    const calls = [];
    let requests = requestBarrier();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/.netlify/functions/track') return route.fulfill({ status: 204 });
      if (url.pathname.startsWith('/.netlify/functions/')) {
        assert.equal(url.pathname, '/.netlify/functions/event-reviews');
        assert.equal(route.request().method(), 'GET');
        const code = url.searchParams.get('eventCode');
        calls.push(code);
        held.set(code, route);
        if (held.size === codes.length) requests.ready();
        return;
      }
      const ext = path.extname(url.pathname);
      if (!types[ext]) return route.abort();
      return route.fulfill({ contentType: types[ext] + '; charset=utf-8', body: await readFile(path.join(root, url.pathname)) });
    });
    await page.goto(origin + '/reviews.html', { waitUntil: 'domcontentloaded' });
    await requests.promise;
    await page.waitForFunction(() => document.querySelectorAll('.mobile-event-reviews summary').length === 11);
    const summaries = page.locator('.mobile-event-reviews summary');
    const desktop = page.locator('[data-event-review-list]');
    assert.deepEqual(await desktop.evaluateAll(nodes => nodes.map(n => n.dataset.eventCode)), codes);
    assert.deepEqual(await summaries.allTextContents(), await desktop.evaluateAll(nodes =>
      nodes.map(n => {
        const heading = n.closest('.event-block').querySelector('.event-block-title').cloneNode(true);
        heading.querySelector('.ev-count')?.remove();
        return heading.textContent.trim();
      })));
    assert.equal(await summaries.first().isVisible(), width === 390);
    if (width === 390) {
      await summaries.first().focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
    }
    for (const [i, code] of codes.entries()) {
      const summary = summaries.nth(i);
      const details = summary.locator('..');
      const panel = width === 390 ? details.locator('.event-review-list') : desktop.nth(i);
      if (width === 390) {
        assert.ok(await summary.evaluate(e => e === document.activeElement));
        await page.keyboard.press(i % 2 ? 'Space' : 'Enter');
        assert.ok(await details.evaluate(e => e.open));
        assert.equal(await panel.innerText(), '후기를 불러오는 중입니다.');
      }
      // The held request resolves only after the mobile reader has opened this entry.
      await held.get(code).fulfill({ json: { reviews: [{ title: title + code, body, authorLabel: '행사 참여자' }] } });
      await panel.locator('strong').waitFor();
      assert.equal(await panel.locator('p').innerText(), body);
      assert.equal(await panel.locator('strong').innerText(), title + code);
      assert.ok((await panel.innerText()).includes('행사 참여자'));
      assert.equal(await panel.locator('a,button,form,[data-author-id]').count(), 0);
      for (const selector of ['strong', 'p']) {
        const metrics = await geometry(panel.locator(selector));
        assert.ok(metrics.contained, JSON.stringify(metrics));
        assert.deepEqual(metrics.pageWidth, [width, width]);
        assert.equal(metrics.width[0], metrics.width[1]);
        console.log(width, code, selector, metrics.lines, 'lines, contained');
      }
      if (width === 390) {
        assert.ok(await summary.evaluate(e => e === document.activeElement && e.parentElement.open));
        await page.keyboard.press('Enter');
        assert.equal(await details.evaluate(e => e.open), false);
        await page.keyboard.press('Tab');
      }
    }
    await page.setViewportSize({ width: width === 390 ? 1280 : 390, height: 850 });
    if (width === 390) await desktop.last().locator('strong').waitFor();
    else {
      await summaries.last().focus();
      await page.keyboard.press('Enter');
      await summaries.last().locator('..').locator('article').waitFor();
    }
    assert.deepEqual(calls.slice().sort(), codes.slice().sort());
    if (width === 390) {
      await page.setViewportSize({ width, height: 850 });
      held.clear();
      requests = requestBarrier();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await requests.promise;
      await summaries.first().focus();
      await page.keyboard.press('Enter');
      for (const code of codes) {
        const route = held.get(code);
        await route.fulfill(code === codes[1] ? { status: 503, json: {} } : { json: { reviews: [] } });
      }
      await summaries.first().locator('..').getByText('아직 등록된 후기가 없습니다.', { exact: true }).waitFor();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await summaries.nth(1).locator('..').getByText('후기를 불러오지 못했습니다.', { exact: true }).waitFor();
      assert.deepEqual(calls.slice(codes.length).sort(), codes.slice().sort());
    }
    await page.close();
  }
  console.log('PASS all 11 feeds, one GET per event, keyboard access, delayed updates, resize and full text');
} finally {
  await browser.close();
}
