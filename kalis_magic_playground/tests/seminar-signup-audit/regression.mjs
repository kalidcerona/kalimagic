// Local browser -> real Netlify handlers -> signed adapter -> actual Code.gs VM.
// No remote credentials or Google account are used. GAS concurrency remains simulated.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { event as defaults, getOffer } from '../../netlify/functions/_lib/seminar-events.mjs';
import { createSheetsStore } from '../../netlify/functions/_lib/seminar-sheets.mjs';
import { createHandler } from '../../netlify/functions/seminar-signup.mjs';
import { createOfferHandler } from '../../netlify/functions/seminar-offer.mjs';
import { createLocalSheet, localSubmission } from '../support/seminar-sheet.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const config = { ...defaults, enabled:true, account:'000000000000', holder:'테스트', contact:'help@example.test', sheetsUrl:'https://script.google.com/macros/s/local-test/exec', signingSecret:'test-signing-secret-not-real-1234567890', hmacSecret:'test-hmac-secret-not-real-1234567890' };
config.testMode=true; config.testSheetsUrl=config.sheetsUrl;
let testOffer = getOffer;
let sheet, calls, receipts, activeConfig, handler, offerHandler;
function reset({ seats=0, failFlush=false }={}) {
  sheet = createLocalSheet({now:Date.parse('2026-12-20T01:00:00Z'),secret:config.signingSecret});
  for (let i=1;i<=seats;i++) assert.equal(sheet.submit(localSubmission(i,sheet.state.now)).ok,true);
  sheet.state.failFlush=failFlush; calls=[]; receipts=[]; activeConfig={...config};
  const store=createSheetsStore(activeConfig,{clock:()=>sheet.state.now,fetcher:async(url,init)=>{
    assert.equal(url,config.sheetsUrl);
    return new Response(JSON.stringify(sheet.send(JSON.parse(init.body))),{headers:{'content-type':'application/json'}});
  }});
  handler=createHandler({getOffer:(...args)=>testOffer(...args),config:activeConfig,store,now:()=>new Date(sheet.state.now)});
  offerHandler=createOfferHandler(activeConfig,()=>new Date(sheet.state.now));
}
reset();
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname.startsWith('/api/')) {
      let body='';for await(const chunk of req)body+=chunk;
      const request={httpMethod:req.method,rawUrl:url.href,headers:req.headers,body,queryStringParameters:Object.fromEntries(url.searchParams),requestContext:{identity:{sourceIp:'127.0.0.1'}}};
      let response;
      if(url.pathname==='/api/seminars/signup') {calls.push(JSON.parse(body));response=await handler(request);if(response.statusCode===200)receipts.push(JSON.parse(response.body).receipt);}
      else if(url.pathname==='/api/seminars/offer') response=await offerHandler(request);
      else {res.writeHead(404);res.end();return;}
      res.writeHead(response.statusCode,response.headers);res.end(response.body);return;
    }
    const relative=url.pathname==='/seminar-signup/'?'seminar-signup/index.html':url.pathname.slice(1);
    const filename=path.resolve(root,relative);
    if(!filename.startsWith(root+path.sep) || !relative.startsWith('seminar-signup/')){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'content-type':filename.endsWith('.html')?'text/html; charset=utf-8':filename.endsWith('.css')?'text/css':filename.endsWith('.mjs')?'text/javascript':'application/octet-stream','cache-control':'no-store'});
    res.end(await readFile(filename));
  } catch(error) {res.writeHead(500);res.end('local_test_failure');console.error(error);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const evidence=[];
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext();
  // Fail any accidental external request. All live APIs run on the local server.
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error=>console.error('BROWSER',error));
  async function openForm(){await page.goto(origin+'/seminar-signup/');await page.waitForFunction(()=>!document.querySelector('#submit').disabled);}
  const fill = () => require('./form-fixture.cjs').fill(page);
  async function wait503(){await page.waitForFunction(()=>!document.querySelector('#errors').hidden && document.querySelector('#errors').textContent.includes('확인'));assert.equal(sheet.state.rows.length,2);assert.equal(calls.length,1);}
  async function terminal(id){
    assert.equal(await page.locator(id).isVisible(),true);
    assert.equal(await page.locator('#signup').isVisible(),false);
    assert.equal(await page.locator('#retry').isVisible(),false);
    assert.equal(await page.locator('#availability').isVisible() && (await page.locator('#availability').textContent()).includes('신청을 받고'),false);
    const before=calls.length;
    await page.locator('#signup').dispatchEvent('submit');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(calls.length,before);
  }
  reset();await openForm();await fill();await page.uncheck('#age-confirmed');await page.locator('#signup').dispatchEvent('submit');
  assert.equal(calls.length,0);assert.equal(sheet.state.rows.length,1);assert.match(await page.textContent('#errors'),/14세/);
  await page.check('#age-confirmed');await page.fill('#birth-date','2020-01-01');await page.locator('#signup').dispatchEvent('submit');
  assert.equal(calls.length,0);assert.equal(sheet.state.rows.length,1);assert.match(await page.textContent('#errors'),/보호자/);
  evidence.push('underage DOB and missing age confirmation block client POST with zero saved rows');
  // Finding 1: restoring normalized original intent must not create a new key.
  reset({failFlush:true});await openForm();await fill();await page.click('#submit');await wait503();
  const firstKey=calls[0].idempotencyKey,firstId=sheet.state.rows[1][0],firstDue=sheet.state.rows[1][18];
  await page.fill('#name','임시 변경');await page.fill('#name','  테스트 참가자  ');
  await page.fill('#contact','010 1234 5678');
  await page.click('#submit');await page.waitForSelector('#success:visible');
  assert.equal(calls.length,2);assert.equal(calls[1].idempotencyKey,firstKey);
  assert.equal(receipts[0].id,firstId);assert.equal(receipts[0].paymentDueAt,firstDue);assert.equal(sheet.state.rows.length,2);
  await terminal('#success');evidence.push('post-save 503 + normalized edit/revert: same key, receipt ID, due time, one row; success terminal');
  // A changed request cannot escape an unresolved saved attempt. Original retry is explicit.
  reset({failFlush:true});await openForm();await fill();await page.click('#submit');await wait503();
  const original=structuredClone(calls[0]),originalId=sheet.state.rows[1][0];
  await page.fill('#name','다른 참가자');
  await page.locator('#signup').dispatchEvent('submit');
  await page.waitForFunction(()=>document.querySelector('#errors').textContent.length>0);
  assert.equal(calls.length,1);assert.equal(sheet.state.rows.length,2);
  activeConfig.enabled=false;
  const originalRetry=page.locator('#check-original');
  assert.equal(await originalRetry.isVisible(),true);
  await originalRetry.click();await page.waitForSelector('#success:visible');
  assert.deepEqual(calls[1],original);assert.equal(receipts[0].id,originalId);assert.equal(sheet.state.rows.length,2);
  await terminal('#success');evidence.push('changed intent blocked pending resolution; explicit original retry after closure preserves immutable payload');
  // Finding 3: sold-out is terminal even though a fresh public offer may still say open.
  reset({seats:60});await openForm();await fill();await page.click('#submit');await page.waitForSelector('#sold-out:visible');
  assert.equal(sheet.state.rows.length,61);await terminal('#sold-out');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'sold-out-title');
  evidence.push('sold-out keeps 60 rows, hides open banner and price retry, prevents hidden-form submit');
  // Finding 4: temporary error description must be additive and removable.
  reset();await openForm();await page.fill('#name','테스트');await page.fill('#contact','invalid');await page.click('#submit');
  for(const [id,base] of [['contact','contact-hint'],['consent','privacy']]) {
    let descriptions=(await page.getAttribute('#'+id,'aria-describedby')).split(/\s+/);
    assert.ok(descriptions.includes(base));assert.ok(descriptions.includes('errors'));
  }
  await page.fill('#contact','01012345678');await page.check('#consent');
  for(const [id,base] of [['contact','contact-hint'],['consent','privacy']]) {
    const descriptions=(await page.getAttribute('#'+id,'aria-describedby')).split(/\s+/);
    assert.ok(descriptions.includes(base));assert.ok(!descriptions.includes('errors'));
    assert.notEqual(await page.getAttribute('#'+id,'aria-invalid'),'true');
  }
  evidence.push('contact-hint/privacy aria-describedby preserved through validation and correction');
  // A definitive policy rejection resolves the old attempt and lets corrected intent proceed.
  reset();activeConfig.consentVersion='previous-notice';await openForm();await fill();activeConfig.consentVersion=defaults.consentVersion;
  await page.click('#submit');await page.waitForFunction(()=>!document.querySelector('#consent').checked);
  assert.equal(sheet.state.rows.length,1);assert.equal(await page.inputValue('#name'),'테스트 참가자');
  const consentKey=calls[0].idempotencyKey;await page.check('#photo-consent');await page.check('#consent');await page.click('#submit');
  await page.waitForSelector('#success:visible');assert.notEqual(calls[1].idempotencyKey,consentKey);assert.equal(sheet.state.rows.length,2);
  reset();await openForm();await fill();const onlyLecture=(at,cfg)=>({...getOffer(at,cfg),available:['lecture']});
  offerHandler=async()=>({statusCode:200,headers:{},body:JSON.stringify(onlyLecture(sheet.state.now,activeConfig))});
  testOffer=onlyLecture;
  await page.click('#submit');await page.waitForFunction(()=>document.querySelector('#bundle').disabled);
  assert.equal(sheet.state.rows.length,1);assert.equal(await page.inputValue('#name'),'테스트 참가자');
  const optionKey=calls[0].idempotencyKey;await page.check('#ticket-lecture');await page.click('#submit');
  await page.waitForSelector('#success:visible');assert.notEqual(calls[1].idempotencyKey,optionKey);assert.equal(sheet.state.rows.length,2);
  evidence.push('definitive consent/option 409 preserves inputs and allows corrected new attempt with one stored row');
  console.log(JSON.stringify({status:'PASS',checks:evidence,scope:'Actual browser/handlers/signed adapter/Code.gs; local Google service doubles, no hosted concurrency proof'},null,2));
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
