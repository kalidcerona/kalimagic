// Synthetic-only browser regression. No remote authentication or message endpoints are called.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_CORE_PATH + '/index.mjs');
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
try {
  const page = await browser.newPage();
  const agreementPosts = [];
  let agreementResult = 'unavailable';
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (['/auth.js','/member-policy-config.mjs','/member-policy.css'].includes(path)) return route.fulfill({body:await readFile(new URL('../../'+path.slice(1),import.meta.url)),contentType:path.endsWith('.css')?'text/css':'text/javascript'});
    if(path === '/.netlify/functions/member-agreement') {
      agreementPosts.push({body:route.request().postDataJSON(),authorization:route.request().headers().authorization});
      if (agreementResult === 'error') return route.fulfill({status:503,json:{error:'temporary'}});
      return route.fulfill({json:{recorded:agreementResult === 'recorded'}});
    }
    if(path !== '/') throw Error('Unexpected network request: '+path);
    return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><link rel="stylesheet" href="/member-policy.css"><body><button id="login">로그인</button><script>window.MAGIC_PLAYGROUND_CONFIG={supabaseUrl:"synthetic",supabasePublishableKey:"synthetic"};window.calls=0;window.session=null;window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.session}}),signInWithOAuth:async options=>{window.redirectTo=options.options.redirectTo;window.calls++;return {data:{}}},signOut:async()=>{window.session=null}}})};</script><script src="/auth.js"></script><script>document.querySelector("#login").onclick=()=>MagicAuth.login();</script></body></html>'});
  });
  await page.goto('http://localhost/');
  await page.click('#login');
  await page.click('#signup-accept');
  assert.equal(await page.evaluate(()=>calls),0,'age unchecked blocks OAuth');
  await page.click('#signup-decline');
  assert.equal(await page.evaluate(()=>calls),0,'decline blocks OAuth');
  await page.click('#login'); await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>calls),0,'escape blocks OAuth');
  await page.click('#login'); await page.check('#signup-age'); await page.click('#signup-accept');
  await page.waitForFunction(()=>calls===1);
  assert.equal(agreementPosts.length,0,'no write before authenticated account confirmation');
  const pending = await page.evaluate(()=>JSON.parse(sessionStorage.getItem('member-agreement-pending')));
  assert.equal(pending.ageConfirmed,true); assert.ok(Date.parse(pending.agreedAt));
  await page.evaluate(()=>{session={user:{id:'first',email:'synthetic@example.invalid'},access_token:'synthetic'};window.result=MagicAuth.getSession()});
  await page.locator('#signup-account-dialog').waitFor();
  await page.click('#signup-account-dialog [value="continue"]');
  assert.equal((await page.evaluate(()=>result)).user.id,'first');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('member-notice:')))).syncAttemptAt > 0);
  await page.waitForTimeout(50);
  assert.equal(agreementPosts.length,1);
  assert.deepEqual(agreementPosts[0].body,{version:pending.version,agreedAt:pending.agreedAt,ageConfirmed:true});
  assert.equal(agreementPosts[0].authorization,'Bearer synthetic');
  await page.evaluate(()=>Promise.all([MagicAuth.getSession(),MagicAuth.getSession(),MagicAuth.getSession()]));
  assert.equal(agreementPosts.length,1,'unavailable endpoint is throttled');
  agreementResult='error';
  await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+60001;});
  await page.evaluate(()=>MagicAuth.getSession());await page.waitForTimeout(50);
  assert.equal(agreementPosts.length,2,'unmigrated profile retries after throttle');
  agreementResult='recorded';
  await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+60001;});
  await page.evaluate(()=>MagicAuth.getSession());
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('member-notice:')))).serverRecorded===true);
  assert.equal(agreementPosts.length,3,'transient error retries and then records');
  await page.evaluate(()=>MagicAuth.getSession());assert.equal(agreementPosts.length,3,'recorded agreement is not resent');
  const record = await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('member-notice:')))));
  assert.equal(record.version,pending.version);assert.equal(record.userId,'first');assert.equal(record.agreedAt,pending.agreedAt);
  await page.evaluate(()=>{session={user:{id:'second',email:'second@example.invalid'},access_token:'second'};window.result=MagicAuth.getSession()});
  await page.locator('#signup-consent-dialog').waitFor();
  await page.click('#signup-decline');assert.equal(await page.evaluate(()=>result),null,'other account cannot reuse agreement');
  assert.equal(agreementPosts.length,3,'declined account has no server write');
  const invalidRecords = [String(Date.now()), {...record,ageConfirmed:false}, {...record,agreedAt:'invalid'}, {...record,agreedAt:'2099-01-01T00:00:00.000Z'}, {...record,userId:'wrong'}, {...record,confirmedAt:'2000-01-01T00:00:00.000Z'}];
  for (let i=0;i<invalidRecords.length;i++) {
    const id='invalid-'+i;
    const invalid=typeof invalidRecords[i] === 'string' ? invalidRecords[i] : {...invalidRecords[i],userId:i===4?'wrong':id};
    await page.evaluate(({id,invalid,version})=>{localStorage.setItem('member-notice:'+version+':'+id,typeof invalid==='string'?invalid:JSON.stringify(invalid));session={user:{id,email:id+'@example.invalid'},access_token:id};window.result=MagicAuth.getSession();},{id,invalid,version:record.version});
    await page.locator('#signup-consent-dialog').waitFor();await page.click('#signup-decline');assert.equal(await page.evaluate(()=>result),null);
  }
  assert.equal(agreementPosts.length,3,'malformed legacy records never synchronize');
  await page.evaluate(version=>{sessionStorage.setItem('member-agreement-pending',JSON.stringify({version,ageConfirmed:false,agreedAt:new Date().toISOString()}));session={user:{id:'pending-invalid',email:'pending@example.invalid'},access_token:'pending'};window.result=MagicAuth.getSession();},record.version);
  await page.locator('#signup-consent-dialog').waitFor();await page.click('#signup-decline');assert.equal(await page.evaluate(()=>result),null);
  // Storage denial keeps a validated account record in memory, including the retry throttle.
  agreementResult='unavailable';
  await page.evaluate(()=>{window.savedStorage={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem};Storage.prototype.getItem=Storage.prototype.setItem=Storage.prototype.removeItem=function(){throw Error('blocked');};session={user:{id:'memory',email:'memory@example.invalid'},access_token:'memory-token'};window.result=MagicAuth.getSession();});
  await page.locator('#signup-consent-dialog').waitFor();await page.check('#signup-age');await page.click('#signup-accept');
  await page.locator('#signup-account-dialog').waitFor();await page.click('#signup-account-dialog [value="continue"]');
  assert.equal((await page.evaluate(()=>result)).user.id,'memory');await page.waitForTimeout(50);
  assert.equal(agreementPosts.length,4);assert.equal(agreementPosts.at(-1).authorization,'Bearer memory-token');
  await page.evaluate(()=>MagicAuth.getSession());assert.equal(agreementPosts.length,4);
  assert.equal(await page.locator('dialog').count(),0,'memory fallback avoids repeated consent dialogs');
  await page.evaluate(()=>{Storage.prototype.getItem=savedStorage.get;Storage.prototype.setItem=savedStorage.set;Storage.prototype.removeItem=savedStorage.remove;session={user:{id:'switch-before-confirm',email:'switch@example.invalid'},access_token:'old-token'};window.result=MagicAuth.getSession();});
  await page.locator('#signup-consent-dialog').waitFor();await page.check('#signup-age');await page.click('#signup-accept');await page.locator('#signup-account-dialog').waitFor();
  await page.evaluate(()=>{session={user:{id:'changed',email:'changed@example.invalid'},access_token:'changed-token'};});
  await page.click('#signup-account-dialog [value="continue"]');assert.equal(await page.evaluate(()=>result),null);assert.equal(agreementPosts.length,4,'switched account cannot synchronize prior confirmation');
  console.log('PASS consent-only server sync, strict legacy validation, account isolation, memory fallback, unavailable/error retry throttle and fail-open login');

  await page.evaluate(() => {
    session = {user:{id:'first'},access_token:'renewed-token'};
    history.replaceState({}, '', '/?utm_source=fixture&return=https://invalid.test/#fragment');
  });
  agreementResult = 'unavailable';
  assert.equal(await page.evaluate(async () => MagicAuth.confirmSeminarAgreement(await MagicAuth.getSession({seminar:true}))), false);
  agreementResult = 'recorded';
  const countBeforeRetry = agreementPosts.length;
  assert.deepEqual(await page.evaluate(async () => {
    const current = await MagicAuth.getSession({seminar:true});
    return Promise.all([MagicAuth.confirmSeminarAgreement(current), MagicAuth.confirmSeminarAgreement(current)]);
  }), [true,true]);
  assert.equal(agreementPosts.length, countBeforeRetry + 1, 'member retries coalesce and use the current token');
  assert.equal(agreementPosts.at(-1).authorization, 'Bearer renewed-token');
  await page.evaluate(() => { window.result = MagicAuth.login('cupsnballs'); });
  await page.check('#signup-age'); await page.click('#signup-accept');
  assert.equal(await page.evaluate(() => result), true);
  assert.equal(await page.evaluate(() => redirectTo), 'https://kalimagic.netlify.app/seminar-signup/cupsnballs.html');
  assert.equal(await page.evaluate(() => MagicAuth.seminarUrl('daebeongae')), 'https://kalimagic.netlify.app/seminar-signup/');
  await assert.rejects(page.evaluate(() => MagicAuth.login('https://invalid.test/')));
  await page.evaluate(() => {
    session = {user:{id:'decline'},access_token:'decline-token'};
    window.result = MagicAuth.getSession({seminar:true}).then(() => 'unexpected', () => 'cancelled');
  });
  await page.click('#signup-account-dialog [value="cancel"]');
  assert.equal(await page.evaluate(() => result), 'cancelled');
  await page.evaluate(version => {
    sessionStorage.setItem('member-agreement-pending', JSON.stringify({
      version, ageConfirmed:true, agreedAt:new Date(Date.now() - 3600001).toISOString()
    }));
    session = {user:{id:'expired'},access_token:'expired-fixture'};
    window.result = MagicAuth.getSession({seminar:true}).then(() => 'unexpected', () => 'cancelled');
  }, record.version);
  await page.locator('#signup-consent-dialog').waitFor();
  assert.equal(await page.locator('#signup-account-dialog').count(), 0);
  await page.click('#signup-decline');
  assert.equal(await page.evaluate(() => result), 'cancelled');
  console.log('PASS seminar clean redirects, declined-account signal and verified agreement retries');

  const contact = await browser.newPage();
  const submitted = [], lookups = [], rows = new Map();
  let intakeOpen = true, loseResponse = true, saveOnSubmit = true;
  await contact.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/contact') {
      if (route.request().method() === 'GET') return route.fulfill({json:{open:intakeOpen}});
      const payload = route.request().postDataJSON();
      if(payload.action === 'status') {
        lookups.push(payload);
        return route.fulfill({json:rows.has(payload.idempotencyKey)?{state:'accepted',id:'synthetic'}:{state:'unknown'}});
      }
      submitted.push(payload);
      if(saveOnSubmit) rows.set(payload.idempotencyKey,payload);
      return loseResponse ? route.fulfill({status:503,json:{error:'storage'}}) : route.fulfill({json:{sent:true,id:'synthetic'}});
    }
    if (path === '/auth.js') return route.fulfill({body:'window.MagicAuth={getSession:async()=>{if(window.cancelAuth){window.dispatchEvent(new Event("member-account-switch"));return null;}return window.contactSession || null;}};',contentType:'text/javascript'});
    if (path.startsWith('/npm/')) return route.fulfill({body:'',contentType:'text/javascript'});
    if (['/contact.html','/contact.js','/member-policy.css'].includes(path)) return route.fulfill({body:await readFile(new URL('../../'+path.slice(1),import.meta.url)),contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'});
    return route.abort();
  });
  const settled = () => contact.waitForFunction(()=>!document.querySelector('#contact-retry').disabled);
  const sendNew = async text => {await contact.locator('[name=message]').fill(text);await contact.locator('[type=submit]').click();await settled();};
  await contact.goto('http://localhost/contact.html');
  await contact.locator('#contact-form').waitFor();
  await sendNew('합성 문의');
  assert.equal(submitted.length,1);assert.equal(rows.size,1);
  assert.equal(await contact.locator('#contact-recovery').isVisible(),true,'503 leaves recovery visible');
  const firstKey=submitted[0].idempotencyKey;
  intakeOpen=false;
  await contact.reload();await contact.locator('#contact-recovery').waitFor();
  assert.equal(await contact.locator('#contact-form').isHidden(),true,'closed intake hides new form only');
  await contact.locator('#contact-retry').click();await settled();
  assert.equal(lookups[0].idempotencyKey,firstKey);assert.equal(submitted.length,1);assert.equal(rows.size,1);
  assert.equal(await contact.locator('#contact-recovery').isHidden(),true,'accepted status clears recovery');
  assert.equal(await contact.evaluate(()=>sessionStorage.getItem('contact-attempt-v2')),null);
  // Unknown results do not implicitly insert. Explicit resend retains the original key and body.
  intakeOpen=true;saveOnSubmit=false;
  await contact.reload();await contact.locator('#contact-form').waitFor();await sendNew('미확정 문의');
  const unknownKey=submitted.at(-1).idempotencyKey;
  intakeOpen=false;
  await contact.reload();await contact.locator('#contact-recovery').waitFor();
  await contact.locator('#contact-retry').click();await settled();
  assert.equal(await contact.locator('#contact-resend').isHidden(),true,'closed unknown does not offer resubmission');
  assert.notEqual(await contact.evaluate(()=>sessionStorage.getItem('contact-attempt-v2')),null);
  assert.equal(submitted.length,2);
  intakeOpen=true;
  await contact.reload();await contact.locator('#contact-recovery').waitFor();
  await contact.locator('#contact-retry').click();await settled();
  assert.equal(submitted.length,2);assert.equal(await contact.locator('#contact-resend').isVisible(),true);
  saveOnSubmit=true;loseResponse=false;
  await contact.locator('#contact-resend').click();await settled();
  assert.equal(submitted.length,3);assert.equal(submitted.at(-1).idempotencyKey,unknownKey);assert.equal(submitted.at(-1).message,'미확정 문의');
  // A cancelled account check produces no submission and an explicit cancellation status.
  await contact.evaluate(()=>{window.cancelAuth=true;});
  await sendNew('취소 문의');
  assert.equal(submitted.length,3);assert.match(await contact.locator('#contact-status').textContent(),/취소했습니다/);
  await contact.evaluate(()=>{window.cancelAuth=false;});
  loseResponse=true;
  await sendNew('계정 전환 문의');
  const count=submitted.length, lookupCount=lookups.length;
  await contact.evaluate(()=>{window.contactSession={user:{id:'other'},access_token:'synthetic'};window.dispatchEvent(new Event('member-account-switch'));});
  await contact.locator('#contact-retry').click();await settled();
  assert.equal(lookups.length,lookupCount);assert.equal(submitted.length,count);
  assert.match(await contact.locator('#contact-status').textContent(),/계정이 다릅니다/);
  assert.notEqual(await contact.evaluate(()=>sessionStorage.getItem('contact-attempt-v2')),null);
  await contact.evaluate(()=>{window.contactSession=null;});
  await contact.locator('#contact-retry').click();await settled();
  assert.equal(submitted.length,count);assert.equal(rows.size,3);
  console.log('PASS contact 503/reload/closed recovery, status-only lookup, explicit same-key unknown resend, cancel and account binding');
} finally {await browser.close();}
