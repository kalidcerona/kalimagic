// Browser-only synthetic sessions and offers. No credentials or live services.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {cupsnballs, event, getOffer} from '../../netlify/functions/_lib/seminar-events.mjs';
import {createHandler} from '../../netlify/functions/seminar-signup.mjs';
import {createLocalSheet} from '../support/seminar-sheet.mjs';
const require = createRequire(import.meta.url);
const output = process.env.SEMINAR_AUDIT_DIR ? require('./output-dir.cjs') : null;
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const origin = new URL(process.env.SEMINAR_AUDIT_ORIGIN || 'http://127.0.0.1:8927');
assert.equal(origin.hostname,'127.0.0.1');
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH});
try {
  for (const config of [cupsnballs,event]) {
    const cups = config.id === 'cupsnballs';
    const url = new URL(cups ? '/seminar-signup/cupsnballs.html' : '/seminar-signup/', origin);
    url.search = '?utm_source=fixture';
    const now = cups ? '2026-11-28T10:00:00+09:00' : '2026-12-15T10:00:00+09:00';
    const offer = {...getOffer(now,config), open:true, memberLinkageEnabled:true};
    for (const width of [390,1440]) {
      const page = await browser.newPage({viewport:{width,height:900}, reducedMotion:'reduce'});
      page.setDefaultTimeout(3500);
      await page.clock.setFixedTime(new Date(now));
      const posts = [], errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin.origin ? route.continue() : route.abort());
      await page.route('**/api/seminars/offer?*',route => route.fulfill({json:{offer}}));
      let rejectFirst = false, requireAgreement = false, closeSignup = false;
      await page.route('**/api/seminars/signup',route => {
        const body = route.request().postDataJSON();
        posts.push({body,token:route.request().headers().authorization});
        if (closeSignup) return route.fulfill({status:403,json:{error:'signup_closed',availabilityState:'ended'}});
        if (requireAgreement) { requireAgreement = false; return route.fulfill({status:403,json:{error:'agreement_required'}}); }
        if (rejectFirst) { rejectFirst = false; return route.fulfill({status:503,json:{error:'unavailable'}}); }
        const total = body.quote.total;
        return route.fulfill({json:{receipt:{eventId:config.id,id:'00000000-0000-4000-8000-000000000001',status:'pending',
          createdAt:new Date(now).toISOString(), paymentDueAt:new Date(Date.parse(now)+86400000).toISOString(),
          items:[{label:cups ? '컵앤볼 기본 참가권 및 현장 실습 프로그램' : '테스트 참가권',price:total}],total,payerName:body.name,payment:{bank:'테스트 은행',holder:'테스트 운영자'},test:true}}});
      });
      await page.addInitScript(() => {
        window.fixture = {id:'synthetic-account', token:'synthetic-token', reads:0, logins:0, agreement:true};
        window.MagicAuth = {
          getSession:async () => { const f = window.fixture; f.sessionUrl = location.href; f.reads++; return f.id ? {user:{id:f.id, phone:'+821000000001',phone_confirmed_at:'2026-01-01'},access_token:f.token} : null; },
          confirmSeminarAgreement:async () => window.fixture.agreement,
          login:async () => { window.fixture.logins++; return false; }
        };
      });
      const shot = async (state,id) => {
        await page.locator(id).evaluate(el => el.scrollIntoView({block:'start',behavior:'instant'}));
        if (output) await page.screenshot({path:path.join(output,config.id+'-'+state+'-'+width+'.png')});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      };
      const fill = async () => {
        await page.fill('#name','테스트 참가자');
        await page.fill('#birth-date','2000-01-01');
        await page.fill('#contact','01000000001');
        for (const id of ['age-confirmed','gender-female','discovery-instagram','reason-reviews',...(!cups ? ['open-no'] : []),'photo-consent','consent']) await page.check('#'+id);
      };
      const checkRetention = async () => {
        const note = page.locator('.retention-note');
        assert.equal(await note.isVisible(),true);
        assert.equal(await note.textContent(),'신청 내역은 행사 종료 후 30일 이내에 삭제됩니다.');
        assert.equal(await note.evaluate(el => el.nextElementSibling.id),'submit');
      };
      await page.goto(url.href);
      await page.waitForSelector('#entry-choice');
      await shot('choice','#entry-title');
      await page.evaluate(() => { window.fixture.agreement = false; });
      await page.click('#entry-member');
      await page.waitForSelector('#entry-help');
      assert.equal(await page.evaluate(() => window.fixture.logins),0);
      await page.reload();
      await page.waitForSelector('#entry-choice');
      await page.click('#entry-guest');
      assert.equal(await page.evaluate(() => document.activeElement.id),'name');
      assert.equal(await page.textContent('#entry-mode-title'),'비회원 신청');
      assert.equal(await page.isVisible('#entry-linkage'),false);
      await shot('guest','#entry-mode');
      if (cups) {
        await checkRetention();
        await shot('guest-submit','.form-summary');
      }
      await fill();
      await page.click('#submit');
      await page.waitForSelector('#success');
      assert.equal(posts[0].token,undefined);
      assert.equal(await page.evaluate(() => window.fixture.reads),0);
      if (cups) {
        await page.reload();
        await page.waitForSelector('#success');
        await page.click('#new-signup');
      } else await page.goto(url.href + '&fresh=1');
      await page.click('#entry-member');
      await page.waitForSelector('#entry-linkage');
      assert.equal(await page.inputValue('#name'),'');
      assert.equal(await page.inputValue('#contact'),'01000000001');
      assert.equal(await page.isChecked('#linkage-consent'),false);
      assert.equal(await page.isVisible('#entry-mode'),false);
      const linkageNotice = page.locator('#entry-linkage details');
      assert.equal(await linkageNotice.evaluate(el => el.open),false);
      assert.equal(await page.textContent('#linkage-notice'),offer.linkageNotice);
      assert.equal(await page.locator('#entry-linkage').evaluate(el => el.closest('.card').contains(document.querySelector('#consent'))),true);
      await shot('member-top','#signup');
      await shot('member','#entry-linkage');
      await linkageNotice.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await linkageNotice.evaluate(el => el.open),true);
      await page.keyboard.press('Enter');
      assert.equal(await linkageNotice.evaluate(el => el.open),false);
      if (cups) {
        for (const size of width === 390 ? [360,390,430] : [1440]) {
          await page.setViewportSize({width:size,height:900});
          await checkRetention();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
        }
        await page.setViewportSize({width,height:900});
        await shot('member-submit','.form-summary');
      }
      await fill();
      await page.click('#submit');
      assert.equal(await page.evaluate(() => document.activeElement.id),'linkage-consent');
      assert.match(await page.textContent('#errors'),/회원 식별자 보관에 동의하거나 비회원으로 계속해 주세요/);
      await page.check('#linkage-consent');
      requireAgreement = true;
      await page.click('#submit');
      await page.waitForFunction(() => document.querySelector('#errors').textContent.includes('약관 확인이 필요합니다'));
      await page.evaluate(() => { window.fixture.agreement = false; });
      await page.click('#submit');
      await page.waitForFunction(() => document.querySelector('#errors').textContent.includes('약관 동의를 확인하지 못했습니다'));
      assert.equal(posts.length,2);
      await page.evaluate(() => { window.fixture.agreement = true; });
      rejectFirst = true;
      await page.click('#submit');
      await page.waitForSelector('#check-original');
      await page.evaluate(() => { window.fixture.id = 'different'; });
      await page.click('#check-original');
      await page.waitForSelector('#member-recovery');
      assert.equal(posts.length,3);
      // Close the event and disable linkage while the original POST outcome is unknown.
      offer.open = offer.memberLinkageEnabled = false;
      await page.reload();
      await page.waitForSelector('#member-recovery');
      assert.equal(await page.isVisible('#entry-choice'),false);
      assert.equal(await page.isVisible('#signup'),false);
      const stored = await page.evaluate(id => JSON.parse(sessionStorage.getItem('seminar-pending-member:'+id)),config.id);
      assert.equal(stored.key,posts[2].body.idempotencyKey);
      assert.equal(JSON.stringify(stored).includes('synthetic-token'),false);
      await page.evaluate(() => { window.fixture.id = null; });
      await page.click('#recovery-check');
      await page.click('#recovery-login');
      assert.equal(await page.evaluate(() => window.fixture.logins),1);
      assert.equal(posts.length,3);
      await page.goto(url.origin+url.pathname+'?code=synthetic-recovery');
      await page.waitForSelector('#member-recovery');
      await page.evaluate(() => { window.fixture.id='another-account'; });
      await page.click('#recovery-check');
      await page.waitForFunction(() => document.querySelector('#recovery-status').textContent.includes('원래 계정'));
      assert.equal(posts.length,3);
      await page.evaluate(() => { window.fixture.id='synthetic-account'; window.fixture.token='renewed'; });
      await page.click('#recovery-check');
      await page.waitForSelector('#success');
      assert.equal(posts[1].body.signupMode,'member');
      assert.equal(posts[1].body.linkageConsent,true);
      assert.equal(posts[1].token,'Bearer synthetic-token');
      assert.equal(posts[3].token,'Bearer renewed');
      assert.equal(posts[1].body.idempotencyKey,posts[3].body.idempotencyKey);
      assert.deepEqual(posts[2].body,posts[3].body);
      assert.equal(await page.evaluate(id => sessionStorage.getItem('seminar-pending-member:'+id),config.id),null);
      offer.open = offer.memberLinkageEnabled = true;
      if (cups) {
        for (const size of width === 390 ? [360,390,430] : [1440]) {
          await page.setViewportSize({width:size,height:900});
          await page.locator('#receipt').evaluate((receipt, size) => {
            const {left,right} = receipt.getBoundingClientRect();
            const rows = [...receipt.querySelectorAll('.ruled')];
            if (rows.length !== 2) throw Error('Expected two receipt dividers');
            for (const row of rows) {
              const [label,value] = row.children;
              const bounds = row.getBoundingClientRect();
              if (bounds.left !== left || bounds.right !== right || getComputedStyle(row).borderTopWidth !== '1px' ||
                  [label,value].some(cell => getComputedStyle(cell).borderTopWidth !== '0px')) {
                throw Error(`Receipt divider does not span both columns at ${size}px`);
              }
            }
            if (size === 360 && rows[1].lastElementChild.offsetHeight <= parseFloat(getComputedStyle(rows[1].lastElementChild).lineHeight)) {
              throw Error('Expected the payment deadline to wrap');
            }
          },size);
        }
        await page.setViewportSize({width,height:900});
      }
      await shot('success','#success');
      if (cups) await page.click('#new-signup'); else await page.reload();
      await page.waitForSelector('#entry-choice');
      await page.evaluate(width => {
        Object.defineProperty(navigator,'userAgent',{value:width === 390?'iPhone Instagram':'Android KAKAOTALK'});
        Object.defineProperty(navigator,'clipboard',{value:{writeText:async () => { throw Error('denied'); }}});
      },width);
      await page.click('#entry-member');
      await page.click('#handoff-copy');
      await page.waitForSelector('#handoff-url');
      assert.equal(await page.inputValue('#handoff-url'),'https://kalimagic.netlify.app'+url.pathname);
      assert.equal(await page.isVisible('#handoff-chrome'),width===1440);
      await shot('in-app','#entry-choice');
      await page.click('#entry-guest');
      await page.waitForSelector('#name');
      await page.evaluate(({id}) => sessionStorage.setItem('seminar-member-return:'+id,String(Date.now())),{id:config.id});
      await page.goto(url.origin + url.pathname + '?code=synthetic');
      await page.waitForSelector('#entry-linkage');
      assert.equal(new URL(page.url()).search,'');
      assert.equal(new URL(await page.evaluate(() => window.fixture.sessionUrl)).search,'?code=synthetic');
      await page.fill('#name','입력 보존');
      await page.click('#entry-switch');
      assert.equal(await page.inputValue('#name'),'입력 보존');
      assert.equal(await page.isVisible('#entry-linkage'),false);
      assert.equal(await page.isVisible('#entry-mode'),true);
      await page.reload();
      await page.waitForSelector('#entry-mode');
      assert.equal(await page.evaluate(() => window.fixture.reads),0);
      await page.goto(url.origin+url.pathname+'?final=1');
      await page.click('#entry-member');
      await fill();
      await page.check('#linkage-consent');
      closeSignup = true;
      await page.click('#submit');
      await page.waitForFunction(() => document.querySelector('#errors').textContent.includes('저장되지 않'));
      assert.equal(await page.isDisabled('#submit'),true);
      assert.equal(await page.isVisible('#member-recovery'),false);
      assert.equal(await page.evaluate(id => sessionStorage.getItem('seminar-pending-member:'+id),config.id),null);
      closeSignup = false;
      await page.goto(url.href);
      await page.click('#entry-member');
      await fill();
      await page.check('#linkage-consent');
      const before = posts.length;
      await page.evaluate(() => { window.fixture.id = null; });
      await page.click('#submit');
      await page.waitForSelector('#entry-choice');
      assert.equal(posts.length,before);
      assert.equal(await page.evaluate(id => sessionStorage.getItem('seminar-pending-member:'+id),config.id),null);
      await page.click('#entry-member');
      await page.waitForSelector('#entry-help');
      assert.equal(await page.evaluate(() => window.fixture.logins),1);
      await page.click('#entry-guest');
      assert.equal(await page.inputValue('#name'),'테스트 참가자');
      assert.equal(await page.isChecked('#reason-reviews'),true);
      await fill();
      const sheetsUrl = 'https://script.google.com/macros/s/local-test/exec';
      const settings = {...config, enabled:true, memberLinkageEnabled:false, testMode:true, sheetsUrl, testSheetsUrl:sheetsUrl,
        account:'000000000000', holder:'테스트', contact:'테스트 문의', signingSecret:'local-signing-secret-at-least-32-bytes',
        hmacSecret:'local-hmac-secret-at-least-32-bytes'};
      const sheet = createLocalSheet({eventId:config.id, now:Date.parse(now), secret:settings.signingSecret, properties:{
        CUPSNBALLS_SHEET_ID:'local-test-sheet', CUPSNBALLS_SHEETS_SIGNING_SECRET:settings.signingSecret,
        CUPSNBALLS_CONSENT_VERSION:config.consentVersion, CUPSNBALLS_LINKAGE_CONSENT_VERSION:config.consentVersion}});
      const handler = createHandler({config:settings, store:sheet, now:()=>new Date(now)});
      const calls = [], receipts = [];
      let loseResponse = true;
      const submitGuest = async route => {
        const request = route.request();
        calls.push(request.postDataJSON());
        const response = await handler({httpMethod:'POST', rawUrl:request.url(), headers:{origin:origin.origin,'content-type':'application/json'},
          body:request.postData(), requestContext:{identity:{sourceIp:'127.0.0.1'}}});
        if (response.statusCode === 200) receipts.push(JSON.parse(response.body).receipt);
        if (loseResponse) { loseResponse = false; return route.abort(); }
        return route.fulfill({status:response.statusCode, contentType:'application/json', body:response.body});
      };
      const pending = () => page.evaluate(id => JSON.parse(sessionStorage.getItem('seminar-pending-member:'+id)), config.id);
      await page.route('**/api/seminars/signup', submitGuest);
      await page.click('#submit');
      await page.waitForSelector('#check-original');
      const original = await pending();
      assert.deepEqual({...original.payload,idempotencyKey:original.key},calls[0]);
      await page.reload();
      settings.sheetsUrl = '';
      for (const outage of ['missing configuration','roster lock unavailable']) {
        if (outage === 'roster lock unavailable') {
          settings.sheetsUrl = sheetsUrl;
          sheet.state.lockUnavailable = true;
        }
        const response = page.waitForResponse(r => r.url().endsWith('/api/seminars/signup'));
        await page.click('#recovery-check');
        assert.equal((await response).status(),503,outage);
        await page.waitForFunction(() => !document.querySelector('#recovery-check').disabled);
        assert.deepEqual(await pending(),original,outage);
      }
      sheet.state.lockUnavailable = false;
      await page.click('#recovery-check');
      await page.waitForSelector('#success');
      assert.deepEqual(calls,Array(4).fill(calls[0]));
      assert.deepEqual(receipts,[receipts[0],receipts[0]]);
      assert.equal(sheet.state.rows.length,2); // Header and one registration.
      assert.equal(await pending(),null);

      offer.memberLinkageEnabled = false;
      for (const drop of [false,true]) {
        if (cups) await page.click('#new-signup');
        await page.goto(url.href);
        await page.evaluate(() => Object.defineProperty(window,'sessionStorage',{
          get() { throw new DOMException('Storage blocked','SecurityError'); }
        }));
        await fill();
        const beforePosts = calls.length, beforeRows = sheet.state.rows.length;
        loseResponse = drop;
        await page.click('#submit');
        if (drop) {
          await page.waitForSelector('#memory-recovery-hint');
          assert.match(await page.textContent('#memory-recovery-hint'),/운영자/);
          await page.click('#check-original');
        }
        await page.waitForSelector('#success');
        assert.equal(calls.length-beforePosts,drop ? 2 : 1);
        assert.equal(sheet.state.rows.length-beforeRows,1);
        if (drop) assert.deepEqual(calls.at(-1),calls.at(-2));
      }
      await page.unroute('**/api/seminars/signup',submitGuest);
      if (cups) await page.click('#new-signup');
      for (const scenario of ['missing','expired','error','closed','disabled']) {
        offer.open = scenario !== 'closed';
        offer.memberLinkageEnabled = scenario !== 'disabled';
        if (scenario === 'expired' || scenario === 'error' || !offer.open || !offer.memberLinkageEnabled)
          await page.evaluate(({id,expired}) => sessionStorage.setItem('seminar-member-return:'+id,
            String(Date.now()-(expired ? 3600001 : 0))),{id:config.id,expired:scenario === 'expired'});
        await page.goto(url.origin+url.pathname+(scenario === 'error' ? '?error=access_denied' : '?code=fixture#access_token=fixture'));
        await page.waitForFunction(() => !location.search && !location.hash);
        if (offer.open && offer.memberLinkageEnabled) await page.click('#entry-guest');
        await page.waitForSelector('#signup');
      }
      offer.open = offer.memberLinkageEnabled = true;
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log(config.id+' entry, guest, member retry, handoff and receipts PASS (390, 1440)');
    if (cups) console.log('cupsnballs retention and continuous receipt dividers PASS (360, 390, 430, 1440; wrapped deadline at 360)');
  }
} finally { await browser.close(); }
