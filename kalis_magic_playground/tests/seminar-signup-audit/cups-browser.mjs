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
const widths = [320,375,390,414,768,1024,1280,1440];
const viewportHeight = 900;
async function captureFrame(page, session, file, bottom = false) {
  const {width, height:viewportHeight} = page.viewportSize();
  const height = bottom ? viewportHeight : await page.evaluate(() => document.documentElement.scrollHeight);
  if (!bottom) {
    await page.setViewportSize({width, height});
  }
  await page.evaluate(async bottom => {
    window.scrollTo({top:bottom ? document.documentElement.scrollHeight : 0, behavior:'instant'});
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, bottom);
  // Capture the viewport surface without requesting an offscreen full-page clip.
  const {data} = await session.send('Page.captureScreenshot', {format:'png', captureBeyondViewport:false});
  const png = Buffer.from(data, 'base64');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height],
    file + ': Chrome clamped the capture dimensions. Set CHROME_PATH to a Chromium headless shell.');
  writeFileSync(path.join(output, file), png);
}
try {
  const page = await browser.newPage({reducedMotion:'reduce'});
  page.setDefaultTimeout(5000);
  const errors = [];
  const landing = await browser.newPage({timezoneId:'America/Los_Angeles'});
  landing.on('pageerror', error => errors.push(error.message));
  await landing.route('**/*', route => new URL(route.request().url()).origin === origin.origin
    ? route.continue() : route.abort());
  const boundaries = [
    ['2026-11-27T18:00:00+09:00', null, '50,000원'],
    ['2026-12-07T00:00:00+09:00', '50,000원', '60,000원'],
    ['2026-12-14T00:00:00+09:00', '60,000원', '70,000원'],
    ['2026-12-19T00:00:00+09:00', '70,000원', null]
  ];
  async function checkTier(amount) {
    assert.deepEqual(await landing.locator('.ticket-prices .current .amount').allTextContents(), amount ? [amount] : []);
    assert.equal(await landing.locator('.current .current-marker').count(), amount ? 1 : 0);
    assert.equal(await landing.locator('.fee-hint').isHidden(), Boolean(amount));
    assert.equal(await landing.locator('.pill-cta.wide').textContent(), '자리 신청하기');
  }
  await landing.clock.install({time:new Date('2026-11-26T00:00:00+09:00')});
  for (const [boundary, before, after] of boundaries) {
    await landing.clock.pauseAt(new Date(Date.parse(boundary) - 1000));
    await landing.goto(new URL('/cupsnballs/', origin).href);
    await checkTier(before);
    if (!before) {
      assert.equal(await landing.locator('.ticket-period').first().textContent(), '11월 27일 18:00부터 (12월 6일까지)');
      assert.equal(await landing.locator('.fee-next').textContent(), '11월 27일 18:00부터 50,000원');
    }
    await landing.clock.runFor(1000);
    await checkTier(after);
    if (!after) {
      assert.equal(await landing.locator('.fee-hint').textContent(), '요금 적용 기간 종료');
      assert.equal(await landing.locator('.fee-next').textContent(), '');
    }
  }
  await landing.clock.setFixedTime(new Date('2026-11-28T01:07:00+09:00'));
  await landing.evaluate(() => window.dispatchEvent(new Event('focus')));
  await checkTier('50,000원');
  assert.equal(await landing.locator('.nav-hot').getAttribute('href'), '#tickets');
  await landing.clock.resume();
  await landing.bringToFront();
  const landingCapture = await landing.context().newCDPSession(landing);
  await landing.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => {
      image.loading = 'eager';
      return image.decode();
    }));
  });
  for (const width of widths) {
    await landing.setViewportSize({width,height:viewportHeight});
    assert.ok(await landing.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await captureFrame(landing, landingCapture, 'detail-'+width+'.png');
  }
  for (const selector of ['.hero .pill-cta','.pill-cta.wide']) {
    await landing.locator(selector).click();
    assert.equal(new URL(landing.url()).pathname, CUPSNBALLS_FORM_URL);
    await landing.goBack();
  }
  await landing.close();
  await page.bringToFront();
  const formCapture = await page.context().newCDPSession(page);
  console.log('PASS landing: opening, both price changes and closing at KST boundaries');
  const submissions = [];
  page.on('pageerror', error => errors.push(error.message));
  let now = new Date('2026-11-27T18:00:00+09:00');
  await page.clock.setFixedTime(now);
  await page.context().grantPermissions(['clipboard-read','clipboard-write'], {origin:origin.origin});
  const syntheticUrl = 'https://script.google.com/macros/s/never-contacted/exec';
  const secret = 'synthetic-browser-only-signing-secret';
  const config = {...cupsnballs, enabled:true, testMode:true, account:'0'.repeat(12), holder:'테스트 운영자',
    contact:'카카오톡 ID sample_operator', signingSecret:secret, hmacSecret:'synthetic-browser-only-fingerprint-secret',
    sheetsUrl:syntheticUrl, testSheetsUrl:syntheticUrl};
  const store = createLocalSheet({eventId:config.id, now:now.getTime(), secret, properties:{
    CUPSNBALLS_SHEET_ID:'local-test-sheet', CUPSNBALLS_SHEETS_SIGNING_SECRET:secret,
    CUPSNBALLS_CONSENT_VERSION:config.consentVersion
  }});
  const submit = createHandler({config, store, now:() => now});
  let offer = {...getOffer(now, config), test:false};
  let offerRequests = 0;
  let lastReceipt;
  let loseResponse = false;
  let expectedRows = 2;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin.origin) throw Error('Unexpected external request');
    if (url.pathname === '/api/seminars/offer') {
      offerRequests++;
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
      assert.equal(store.state.rows.length, expectedRows);
      assert.equal(data.receipt.payment.test, true);
      if (loseResponse) {
        loseResponse = false;
        return route.abort('connectionreset');
      }
      data.receipt.test = false;
      Object.assign(data.receipt.payment, {test:false, bank:'모의 은행', account:'000-000-000000', holder:'모의 운영자'});
      lastReceipt = data.receipt;
      return route.fulfill({json:data});
    }
    if (url.pathname.startsWith('/api/')) throw Error('Unexpected API route');
    return route.continue();
  });
  const samples = [];
  const wrapFailures = [];
  async function checkLineBreaks() {
    return page.evaluate(() => {
      const issues = [];
      const selectors = [
        'h1', 'h2', 'label', 'summary', '.hint', '.question-intro', 'button',
        '#availability', '#payment-message', '#test-warning', '#errors a', '#copy-status',
        '#unresolved-attempt p', '#price-change p',
      ];
      for (const element of document.querySelectorAll(selectors.join(','))) {
        if (!element.offsetWidth || element.closest('.trap, .sr-only')) continue;
        let lineTop;
        function visit(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches('br, .question-number')) {
              lineTop = undefined;
              return;
            }
            // The retention note may wrap between its two phrases on narrow screens.
            if (node.matches('.retention-note > .phrase')) lineTop = undefined;
            node.childNodes.forEach(visit);
            return;
          }
          if (node.nodeType !== Node.TEXT_NODE) return;
          const preservesBreaks = getComputedStyle(node.parentElement).whiteSpace === 'pre-line';
          const lines = preservesBreaks ? node.textContent.split('\n') : [node.textContent];
          let offset = 0;
          for (const [index, line] of lines.entries()) {
            if (index) lineTop = undefined;
            const first = line.search(/\S/u);
            if (first !== -1) {
              const range = document.createRange();
              range.setStart(node, offset + first);
              range.setEnd(node, offset + line.trimEnd().length);
              for (const rect of range.getClientRects()) {
                if (!rect.width) continue;
                lineTop ??= rect.top;
                if (Math.abs(lineTop - rect.top) > 3) {
                  issues.push([element.id || element.htmlFor || element.tagName, element.innerText.trim()]);
                }
              }
            }
            offset += line.length + 1;
          }
        }
        element.childNodes.forEach(visit);
      }
      return issues;
    });
  }

  async function capture(state) {
    for (const width of widths) {
      await page.setViewportSize({width, height:viewportHeight});
      await page.evaluate(() => document.fonts.ready);
      const unplanned = await checkLineBreaks();
      if (unplanned.length) wrapFailures.push({state,width,unplanned});
      if (['initial','expanded','filled'].includes(state)) {
        const prices = (await page.locator('#signup').innerText()).match(/[0-9][0-9,]*원/g) || [];
        assert.deepEqual(prices, ['50,000원'], state + ' at ' + width);
        const summary = page.locator('.form-summary [role="status"][aria-live="polite"][aria-atomic="true"]');
        assert.equal(await summary.locator('#total').textContent(), '50,000원');
        assert.equal(await page.evaluate(() => {
          const box = selector => document.querySelector(selector).getBoundingClientRect();
          return box('.form-main').bottom < box('.form-summary').top &&
            ['#refund-notice', '#seller-notice'].every(selector =>
              document.querySelector(selector).compareDocumentPosition(document.querySelector('#submit')) &
              Node.DOCUMENT_POSITION_FOLLOWING);
        }), true, state + ' vertical flow at ' + width);
      }
      const layoutIssues = await page.evaluate(() => {
        const issues = [];
        if (document.documentElement.scrollWidth > innerWidth) issues.push('horizontal overflow');
        if (/[—~～]/u.test(document.body.innerText)) issues.push('unexpected punctuation');
        for (const element of document.querySelectorAll('h1,h2,summary,.money,#receipt dd')) {
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
          if (element.matches('h1,h2,summary') && lines.size > 1 && /^[가-힣]{1,2}[.?!]?$/u.test(last)) issues.push(element.innerText);
        }
        return issues;
      });
      assert.deepEqual(layoutIssues, [], state + ' ' + width + ': ' + layoutIssues.join(', '));
      await captureFrame(page, formCapture, state+'-'+width+'.png', state === 'filled');
      const boxes = await page.evaluate(() => {
        const selectors = ['h1','#q1','.question .cups-notice summary','#errors a','#success-title','#test-warning'];
        return selectors.flatMap(selector => {
          const element = document.querySelector(selector);
          if (!element?.getClientRects().length) return [];
          const r = element.getBoundingClientRect();
          const fg = getComputedStyle(element).color;
          let bg = 'rgba(0, 0, 0, 0)';
          for (let ancestor = element; ancestor && bg === 'rgba(0, 0, 0, 0)'; ancestor = ancestor.parentElement) {
            bg = getComputedStyle(ancestor).backgroundColor;
          }
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
  const formUrl = new URL(CUPSNBALLS_FORM_URL, origin).href;
  const landingUrl = new URL('/cupsnballs/', origin).href;
  await page.goto(landingUrl);
  const pendingOffer = page.waitForRequest(offerPath);
  await page.goto(formUrl);
  await pendingOffer;
  assert.equal(await page.textContent('#photo-notice'), fallbackNotice);
  failOffer();
  await page.waitForFunction(() => document.querySelector('#availability').textContent.includes('불러오지 못했어'));
  assert.equal(await page.textContent('#photo-notice'), fallbackNotice);
  assert.equal(await page.locator('#photo-consent').isDisabled(), true);
  await page.click('#retry');
  await page.waitForFunction(() => !document.querySelector('#submit').disabled);
  assert.ok(await page.locator('#signup-banner').isHidden());
  for (const id of ['birth-date','gender-male','discovery-instagram','reason-content']) {
    assert.equal(await page.locator('#'+id).isVisible(), true);
    assert.equal(await page.locator('#'+id).evaluate(input => input.required), true);
  }
  assert.equal(await page.locator('#promotion-consent').isVisible(), false);
  assert.equal(await page.locator('#photo-consent').isChecked(), false);
  assert.equal(await page.locator('#contact-hint, #q7, #admission, #photo-contact').count(), 0);
  assert.equal(await page.locator('label[for="photo-consent"]').isVisible(), true);
  assert.equal(await page.locator('label[for="consent"]').isVisible(), true);
  assert.equal(await page.locator('#photo-consent').getAttribute('aria-describedby'), 'photo-notice');
  assert.equal(await page.locator('#consent').getAttribute('aria-describedby'), 'privacy operator-contact');
  const notices = page.locator('#signup .cups-notice:visible');
  assert.equal(await notices.count(), 3);
  assert.equal(await page.locator('#signup .cups-notice[open]').count(), 0);
  const seller = await page.textContent('#seller-notice');
  assert.equal(seller, offer.formConfig.sellerNotice);
  assert.equal(await page.textContent('#photo-notice'), offer.photoNotice);
  assert.equal(await page.textContent('#privacy'), offer.privacyNotice);
  for (const word of ['운영자','문준영','대관비','일회용품']) assert.ok(seller.includes(word), word);
  for (const notice of [seller, await page.textContent('#privacy')]) {
    assert.match(notice,/수업 난이도 조절을 위해 문준영 강사에게 성별 비율, 연령대 등 참가자 구성 정보만 전달합니다/);
    assert.match(notice,/이름과 전화번호는 강사에게 전달하지 않습니다/);
  }
  await capture('initial');
  for (const summary of await notices.locator('summary').all()) await summary.press('Space');
  assert.equal(await page.locator('#signup .cups-notice[open]').count(), 3);
  assert.deepEqual((await page.locator('#signup').innerText()).match(/문의: 카카오톡 ID sample_operator/g),
    ['문의: 카카오톡 ID sample_operator']);
  await capture('expanded');
  for (const summary of await notices.locator('summary').all()) await summary.press('Enter');
  assert.equal(await page.locator('#signup .cups-notice[open]').count(), 0);
  await page.locator('#submit').click();
  await page.locator('#errors').waitFor({state:'visible'});
  assert.equal(await page.locator('#errors a[href="#contact"]').textContent(), '올바른 국내 휴대전화 번호를 적어줘.');
  assert.equal(await page.locator('#contact').getAttribute('aria-describedby'), 'errors');
  assert.equal(submissions.length, 0);
  await capture('error');
  async function fillApplication() {
    await page.fill('#name','테스트 참가자');
    await page.fill('#contact','010-1234-5678');
    await page.fill('#birth-date','1994-07-01');
    for (const id of ['age-confirmed','gender-male','discovery-instagram','reason-content','consent']) {
      await page.check('#'+id);
    }
  }
  await fillApplication();
  assert.equal(await page.locator('#contact').getAttribute('aria-describedby'), null);
  await page.locator('#submit').click();
  assert.equal(submissions.length, 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'photo-consent');
  await page.locator('#photo-consent').press('Space');
  assert.ok(await page.locator('#photo-consent').isChecked());
  assert.equal(await page.locator('#errors').isVisible(), false);
  assert.equal(await page.textContent('#total'), '50,000원');
  await capture('filled');
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
    assert.ok(await page.locator('#retry').isHidden());
    now = new Date(config.opensAt);
    config.enabled = true;
    store.state.now = now.getTime();
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#submit').disabled);
    await fillApplication();
    await page.check('#photo-consent');
    assert.equal(await page.textContent('#total'), '50,000원');
  }
  await page.locator('#submit').click();
  await page.locator('#success').waitFor({state:'visible'});
  async function checkCompletion(payerName) {
    await page.locator('#success').waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => document.activeElement.id), 'success-title');
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    assert.equal(await page.locator('#signup, #signup-header, #signup-banner').filter({visible:true}).count(), 0);
    assert.equal(await page.locator('#payment-message').textContent(), '아래 계좌로 24시간 안에 입금해줘.');
    assert.deepEqual((await page.locator('#receipt dt').allTextContents()).slice(-6),
      [ '은행', '계좌번호', '예금주', '입금자명', '입금 기한', '문의']);
    assert.equal(await page.locator('#receipt dt').filter({hasText:/^입금자명$/}).locator('+ dd').textContent(), payerName);
  }
  await checkCompletion('테스트 참가자');
  const body = submissions.at(-1);
  assert.equal(submissions.length, 3);
  assert.equal(body.eventId, 'cupsnballs');
  assert.equal(body.contact, '01012345678');
  assert.equal(body.ageConfirmed, true);
  assert.equal(body.photoConsent, true);
  assert.equal(body.promotionConsent, true);
  assert.equal(body.birthDate, '1994-07-01');
  assert.equal(body.discovery, 'instagram');
  assert.equal(body.reason, 'content');
  assert.equal(body.gender, 'male');
  assert.deepEqual(body.selection, ['admission']);
  assert.equal(await page.locator('#receipt dt').filter({hasText:/^문의$/}).count(), 1);
  assert.equal(await page.locator('#receipt dt').filter({hasText:/^문의$/}).locator('+ dd').textContent(), config.contact);
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
  async function copiedReceipt() {
    await page.click('#copy');
    return page.evaluate(() => navigator.clipboard.readText());
  }
  const receiptText = await copiedReceipt();
  assert.match(receiptText, /접수번호: 20261127180001/);
  const saved = await page.evaluate(() => {
    const keys = Object.keys(sessionStorage);
    if (keys.length !== 1) throw Error('Expected one saved receipt');
    sessionStorage.setItem('another-event', 'keep');
    return {key:keys[0], value:sessionStorage.getItem(keys[0])};
  });
  assert.doesNotMatch(saved.value, /01012345678|1994-07-01|instagram|idempotencyKey/);
  const initialCount = submissions.length;
  const initialOffers = offerRequests;
  await page.reload();
  await checkCompletion('테스트 참가자');
  assert.equal(await copiedReceipt(), receiptText);
  await capture('restored');
  await page.goto(landingUrl);
  await page.goBack();
  await checkCompletion('테스트 참가자');
  await page.goForward();
  assert.equal(page.url(), landingUrl);
  await page.goto(formUrl);
  await page.goBack();
  await page.goForward();
  await checkCompletion('테스트 참가자');
  assert.equal(await copiedReceipt(), receiptText);
  await page.clock.setFixedTime(new Date(config.closesAt));
  await page.reload();
  await page.waitForSelector('#success-title:visible');
  assert.match(await page.locator('#success').innerText(), /지났/);
  assert.match(await copiedReceipt(), /지났/);
  assert.equal(submissions.length, initialCount);
  assert.equal(offerRequests, initialOffers);
  await page.clock.setFixedTime(now);
  await page.getByRole('button',{name:'새로 신청하기'}).click();
  await page.waitForSelector('#submit:enabled');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('another-event')), 'keep');
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), saved.key), null);
  assert.equal(await page.locator('#name').inputValue(),'');
  assert.equal(await page.locator('#consent').isChecked(),false);
  assert.equal(await page.locator('.skip').evaluate(link => link.hash), '#signup');

  await fillApplication();
  await page.fill('#contact', '010-1234-5679');
  await page.check('#photo-consent');
  expectedRows = 3;
  loseResponse = true;
  await page.click('#submit');
  await page.waitForSelector('#check-original:enabled');
  await page.fill('#name', '수정한 참가자');
  await page.click('#submit');
  assert.equal(submissions.length, 4);
  await page.setViewportSize({width:320,height:900});
  assert.deepEqual(await checkLineBreaks(), []);
  await page.click('#check-original');
  await checkCompletion('테스트 참가자');
  assert.equal(submissions.length, 5);
  assert.deepEqual(submissions[4], submissions[3]);
  assert.equal(store.state.rows.length, 3);

  await page.getByRole('button',{name:'새로 신청하기'}).click();
  await page.waitForSelector('#submit:enabled');
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
  await page.waitForSelector('#signup-banner:visible');
  assert.equal(await page.locator('#submit').isDisabled(), true);
  await capture('closed');
  const mismatched = JSON.parse(saved.value);
  mismatched.receipt.eventId = 'daebeongae';
  const invalidNumber = JSON.parse(saved.value);
  invalidNumber.receipt.displayReceiptNumber = '20260231180000';
  const testReceipt = JSON.parse(saved.value);
  testReceipt.receipt.test = true;
  const restoresBefore = submissions.length;
  await page.evaluate(({key,value}) => sessionStorage.setItem(key,value),
    {key:saved.key,value:JSON.stringify(testReceipt)});
  await page.reload();
  await page.waitForSelector('#test-warning:visible');
  const missingTest = structuredClone(testReceipt);
  delete missingTest.receipt.test;
  const missingBank = JSON.parse(saved.value);
  delete missingBank.receipt.payment.bank;
  const invalidTest = JSON.parse(saved.value);
  invalidTest.receipt.test = 'false';
  for (const [value, clock] of [
    [JSON.stringify(missingTest), now], [JSON.stringify(missingBank), now], [JSON.stringify(invalidTest), now],
    ['{', now], [JSON.stringify(mismatched), now], [JSON.stringify(invalidNumber), now],
    [saved.value, new Date('2026-12-19T23:30:00+09:00')]
  ]) {
    await page.evaluate(({key,value}) => sessionStorage.setItem(key,value), {key:saved.key,value});
    await page.clock.setFixedTime(clock);
    await page.reload();
    await page.waitForSelector('#signup-banner:visible');
    assert.ok(await page.locator('#success').isHidden());
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), saved.key), null);
  }
  assert.equal(submissions.length, restoresBefore);
  const oldStored = JSON.parse(saved.value);
  delete oldStored.receipt.displayReceiptNumber;
  oldStored.receipt.id = lastReceipt.id;
  await page.evaluate(({key,value}) => sessionStorage.setItem(key,value),
    {key:saved.key,value:JSON.stringify(oldStored)});
  await page.clock.setFixedTime(now);
  await page.reload();
  await page.waitForSelector('#success:visible');
  assert.equal(await page.textContent('#display-receipt-number'), lastReceipt.id);
  assert.equal(submissions.length, restoresBefore);
  // Storage can be disabled by browser policy. The live legacy receipt must still work.
  offer = {...getOffer(now,config),test:false};
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {get() {throw new DOMException('Disabled','SecurityError');}});
  });
  await page.clock.setFixedTime(now);
  await page.reload();
  await page.waitForSelector('#submit:enabled');
  await fillApplication();
  await page.check('#photo-consent');
  const {displayReceiptNumber, ...legacyReceipt} = lastReceipt;
  assert.ok(displayReceiptNumber);
  await page.route('**/api/seminars/signup', route => route.fulfill({json:{receipt:legacyReceipt}}), {times:1});
  await page.click('#submit');
  await page.waitForSelector('#success-title:visible');
  assert.equal(await page.textContent('#display-receipt-number'), legacyReceipt.id);
  assert.ok((await copiedReceipt()).includes(legacyReceipt.id));
  await page.setViewportSize({width:320,height:900});
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  offer = {...offer,formConfig:{...offer.formConfig,minimumAge:0,requireBirthDate:false,requireGender:false,
    requireDiscovery:false,requireReason:false,photoConsentMode:'split'}};
  await page.getByRole('button', {name:'새로 신청하기'}).click();
  await page.waitForSelector('#submit:enabled');
  for (const id of ['birth-date','age-confirmed','gender-male']) assert.ok(await page.locator('#'+id).isHidden());
  for (const id of ['discovery-skip','reason-skip','promotion-consent']) {
    assert.ok(await page.locator('#'+id).isVisible());
    assert.equal(await page.locator('#'+id).evaluate(input => input.required), false);
  }
  writeFileSync(path.join(output,'cups-samples.json'),JSON.stringify(samples));
  assert.deepEqual(errors, []);
  assert.deepEqual(wrapFailures, []);
  console.log('PASS cups form: 8 states × 8 widths, native notice toggles, phone validation, automatic admission, receipt contact, two closures during entry, direct completion, lost-response recovery with one row per signup, back and refresh without POST');
} finally {
  await browser.close();
}
