// Exercise the built form with loopback-only assets and synthetic API responses.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {writeFileSync} from 'node:fs';
import {CUPSNBALLS_FORM_URL} from '../../seminar-signup/event-config.mjs';
import {cupsnballs, getOffer} from '../../netlify/functions/_lib/seminar-events.mjs';

import {createHandler} from '../../netlify/functions/seminar-signup.mjs';
import {createLocalSheet} from '../support/seminar-sheet.mjs';

const require = createRequire(import.meta.url);
const output = require('./output-dir.cjs');
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const origin = new URL(process.env.SEMINAR_AUDIT_ORIGIN);
assert.equal(origin.hostname, '127.0.0.1');
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH});
try {
  const page = await browser.newPage({reducedMotion:'reduce'});
  page.setDefaultTimeout(5000);
  const errors = [];
  const submissions = [];
  page.on('pageerror', error => errors.push(error.message));
  let now = new Date('2026-11-27T18:00:00+09:00');
  const syntheticUrl = 'https://script.google.com/macros/s/never-contacted/exec';
  const secret = 'synthetic-browser-only-signing-secret';
  const config = {...cupsnballs, enabled:true, testMode:true, account:'0'.repeat(12), holder:'테스트 운영자',
    contact:'테스트 문의처', signingSecret:secret, hmacSecret:'synthetic-browser-only-fingerprint-secret',
    sheetsUrl:syntheticUrl, testSheetsUrl:syntheticUrl};
  const store = createLocalSheet({eventId:config.id, now:now.getTime(), secret, properties:{
    CUPSNBALLS_SHEET_ID:'local-test-sheet', CUPSNBALLS_SHEETS_SIGNING_SECRET:secret,
    CUPSNBALLS_CONSENT_VERSION:config.consentVersion
  }});
  const submit = createHandler({config, store, now:() => now});
  let offer = getOffer(now, config);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin.origin) throw Error('Unexpected external request');
    if (url.pathname === '/api/seminars/offer') {
      assert.equal(url.searchParams.get('eventId'), 'cupsnballs');
      return route.fulfill({json:{offer}});
    }
    if (url.pathname === '/api/seminars/signup') {
      submissions.push(route.request().postDataJSON());
      const response = await submit({httpMethod:'POST', rawUrl:url.href, body:route.request().postData(),
        headers:{origin:origin.origin, 'content-type':'application/json'}, requestContext:{identity:{sourceIp:'127.0.0.1'}}});
      if (!config.enabled || now >= new Date(config.closesAt)) {
        assert.equal(response.statusCode, 403);
        assert.equal(store.state.rows.length, 1);
        return route.fulfill({status:403,json:JSON.parse(response.body)});
      }
      assert.equal(response.statusCode, 200, response.body.includes('error') ? response.body : 'Unexpected status');
      const data = JSON.parse(response.body);
      assert.equal(store.state.rows.length, 2);
      assert.equal(data.receipt.payment.test, true);
      data.receipt.payment.account = '모의 계좌';
      return route.fulfill({json:data});
    }
    if (url.pathname.startsWith('/api/')) throw Error('Unexpected API route');
    return route.continue();
  });
  const samples = [];
  async function capture(state) {
    for (const width of [320,375,390,414,768,1024,1280,1440]) {
      await page.setViewportSize({width, height:900});
      await page.evaluate(() => document.fonts.ready);
      const layoutIssues = await page.evaluate(() => {
        const issues = [];
        if (document.documentElement.scrollWidth > innerWidth) issues.push('horizontal overflow');
        if (/[—~～]/u.test(document.body.innerText)) issues.push('unexpected punctuation');
        for (const element of document.querySelectorAll('h1,h2,.money,#price-period,#receipt dd')) {
          if (!element.getClientRects().length) continue;
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const lines = new Map();
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.parentElement.closest('.question-number')) continue;
            const range = document.createRange();
            for (const match of node.textContent.matchAll(/(?:[0-9][0-9,]*원)|[^\s]/gu)) {
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              const boxes = range.getClientRects();
              if (!boxes.length) continue;
              if (match[0].endsWith('원') && boxes.length > 1) issues.push(match[0]);
              const y = Math.round(boxes[0].bottom);
              lines.set(y, (lines.get(y) || '') + match[0]);
            }
          }
          const last = [...lines.values()].at(-1);
          if (element.matches('h1,h2') && lines.size > 1 && /^[가-힣]{1,2}[.?!]?$/u.test(last)) issues.push(element.innerText);
        }
        return issues;
      });
      assert.deepEqual(layoutIssues, [], state + ' ' + width + ': ' + layoutIssues.join(', '));
      // Capture one compositor frame at document height. Some Chrome versions repeat
      // the first tile when fullPage captures a document taller than the viewport.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({width, height});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({path:path.join(output, state+'-'+width+'.png')});
      const boxes = await page.evaluate(() => {
        const rules = [['h1','#efb883','#123927'], ['#q1','#143322','#f6f0df'],
          ['#contact-hint','#4b5b47','#f6f0df'], ['#errors a','#793118','#ebe4ce'],
          ['#success-title','#143322','#f6f0df'], ['#test-warning','#961f12','#f6f0df']];
        return rules.flatMap(([selector,fg,bg]) => {
          const element = document.querySelector(selector);
          if (!element?.getClientRects().length) return [];
          const r = element.getBoundingClientRect();
          return [{selector,fg,bg,box:[r.left,r.top+scrollY,r.right,r.bottom+scrollY]}];
        });
      });
      samples.push({file:state+'-'+width+'.png', boxes});
    }
  }
  const fallbackNotice = '현장에서 사진·영상 촬영이 진행됩니다. 본인이 나온 사진·영상을 행사 홍보에 활용하는 동의가 포함됩니다. 내용을 확인한 후 선택하십시오.';
  const offerPath = '**/api/seminars/offer*';
  let failOffer;
  const pendingFailure = new Promise(resolve => { failOffer = resolve; });
  await page.route(offerPath, async route => {
    await pendingFailure;
    await route.fulfill({status:503, body:''});
  }, {times:1});
  await page.goto(new URL(CUPSNBALLS_FORM_URL, origin).href);
  assert.equal(await page.textContent('#photo-notice'), fallbackNotice);
  failOffer();
  await page.waitForFunction(() => document.querySelector('#availability').textContent.includes('불러오지 못했어'));
  assert.equal(await page.textContent('#photo-notice'), fallbackNotice);
  assert.equal(await page.locator('#photo-consent').isDisabled(), true);
  await page.click('#retry');
  await page.waitForFunction(() => !document.querySelector('#submit').disabled);
  for (const id of ['birth-date','gender-male','discovery-instagram','reason-content']) {
    assert.equal(await page.locator('#'+id).isVisible(), true);
    assert.equal(await page.locator('#'+id).evaluate(input => input.required), true);
  }
  assert.equal(await page.locator('#promotion-consent').isVisible(), false);
  assert.equal(await page.locator('#photo-consent').isChecked(), false);
  const seller = await page.textContent('#seller-notice');
  for (const word of ['운영자','문준영','대관비','일회용품']) assert.ok(seller.includes(word), word);
  for (const notice of [seller, await page.textContent('#privacy')]) {
    assert.match(notice,/수업 난이도 조절을 위해 문준영 강사에게 성별 비율, 연령대 등 참가자 구성 정보만 전달합니다/);
    assert.match(notice,/이름과 전화번호는 강사에게 전달하지 않습니다/);
  }
  await capture('initial');
  await page.locator('#submit').click();
  await page.locator('#errors').waitFor({state:'visible'});
  assert.equal(submissions.length, 0);
  await capture('error');
  async function fillApplication() {
    await page.fill('#name','테스트 참가자');
    await page.fill('#contact','01012345678');
    await page.fill('#birth-date','1994-07-01');
    for (const id of ['age-confirmed','gender-male','discovery-instagram','reason-content','admission','consent']) {
      await page.check('#'+id);
    }
  }
  await fillApplication();
  await page.locator('#submit').click();
  assert.equal(submissions.length, 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'photo-consent');
  await page.check('#photo-consent');
  assert.equal(await page.textContent('#total'), '50,000원');
  await capture('selected');
  for (const ended of [true, false]) {
    config.enabled = ended;
    now = new Date(ended ? config.closesAt : config.opensAt);
    store.state.now = now.getTime();
    await page.focus('#submit');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement.id === 'errors');
    const status = ended ? '접수 마감' : '접수 대기';
    assert.equal(await page.locator('#submit').textContent(), status);
    assert.equal(await page.locator('#submit').isDisabled(), true);
    assert.ok((await page.locator('#errors').textContent()).includes(status));
    assert.equal(await page.locator('#availability').getAttribute('aria-live'), 'polite');
    assert.match(await page.locator('#availability').textContent(), ended ? /기간이 끝났어/ : /기다려줘/);
    assert.match(await page.locator('#signup-banner h2').textContent(), ended ? /마감/ : /신청 대기/);
    now = new Date(config.opensAt);
    config.enabled = true;
    store.state.now = now.getTime();
    await page.click('#retry');
    await page.waitForFunction(() => !document.querySelector('#submit').disabled);
    await page.check('#admission');
  }
  await page.locator('#submit').click();
  await page.locator('#success').waitFor({state:'visible'});
  assert.equal(await page.evaluate(() => document.activeElement.id), 'success-title');
  const body = submissions.at(-1);
  assert.equal(submissions.length, 3);
  assert.equal(body.eventId, 'cupsnballs');
  assert.equal(body.ageConfirmed, true);
  assert.equal(body.photoConsent, true);
  assert.equal(body.promotionConsent, true);
  assert.equal(body.birthDate, '1994-07-01');
  assert.equal(body.discovery, 'instagram');
  assert.equal(body.reason, 'content');
  assert.equal(body.gender, 'male');
  assert.deepEqual(body.selection, ['admission']);
  async function checkResultSkip(headingId) {
    const link = page.locator('.skip');
    assert.equal(await link.evaluate(anchor => anchor.hash), '#' + headingId);
    await link.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), headingId);
    assert.equal(await page.locator('#' + headingId).isVisible(), true);
  }
  await capture('success');
  await checkResultSkip('success-title');
  await page.goto(new URL(CUPSNBALLS_FORM_URL, origin).href);
  await page.waitForFunction(() => !document.querySelector('#submit').disabled);
  assert.equal(await page.locator('.skip').getAttribute('href'), '#signup');
  await fillApplication();
  await page.check('#photo-consent');
  await page.route('**/api/seminars/signup', route =>
    route.fulfill({status:409, json:{error:'sold_out'}}), {times:1});
  await page.click('#submit');
  await page.locator('#sold-out-title').waitFor({state:'visible'});
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sold-out-title');
  await checkResultSkip('sold-out-title');
  offer = getOffer('2026-12-19T00:00:00+09:00', config);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#retry').disabled);
  assert.equal(await page.locator('#submit').isDisabled(), true);
  await capture('closed');
  await page.setViewportSize({width:320,height:900});
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  writeFileSync(path.join(output,'cups-samples.json'),JSON.stringify(samples));
  assert.deepEqual(errors, []);
  console.log('PASS cups form: 5 states × 8 widths, no horizontal overflow, four analysis fields required, mandatory single photo agreement, focused receipt, two closures during entry, one saved synthetic submission');
} finally {
  await browser.close();
}
