import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { validateSignup, submitSignup, digest } from '../../netlify/functions/_lib/seminar-signups.mjs';
import { createHandler, handler } from '../../netlify/functions/seminar-signup.mjs';
import { createSheetsStore, signEnvelope, validSheetsUrl } from '../../netlify/functions/_lib/seminar-sheets.mjs';
import { event, getOffer } from '../../netlify/functions/_lib/seminar-events.mjs';
const now = new Date('2026-12-20T00:00:00+09:00');
const secret = 'test-hmac-secret-only-not-a-real-key-123456789';
const config = {...event,enabled:true,testMode:true,testSheetsUrl:'https://script.google.com/macros/s/test-deployment/exec',consentVersion:'2026-11-30-v2',privacyNotice:'테스트 고지',account:'000000000000',holder:'테스트',contact:'help@example.test',sheetsUrl:'https://script.google.com/macros/s/test-deployment/exec',signingSecret:'test-signing-secret-not-a-real-key-123456789',hmacSecret:secret};
const offer = getOffer(now, config);
function input(changes = {}) { return {eventId:config.id,selection:['bundle','open'],name:'테스트 참가자',ageConfirmed:true,birthDate:'1990-01-01',gender:'male',discovery:'instagram',reason:'content',photoConsent:true,photoConsentVersion:offer.photoConsentVersion,contactType:'phone',contact:'01012345678',payerName:'',consent:true,consentVersion:offer.consentVersion,idempotencyKey:randomUUID(),quote:{version:offer.version,tier:offer.tier,total:87000},website:'',...changes}; }
function memory() {
  const rows = new Map(); let attempts = 0;
  return {rows,async submit(payload) {
    const previous = rows.get(payload.idempotencyKey);
    if (previous) return previous.fingerprint === payload.fingerprint ? {ok:true,receipt:previous.receipt} : {ok:false,error:'idempotency_conflict'};
    if (!payload.eligible) return {ok:false,...payload.rejection};
    attempts++; if (attempts > 10) return {ok:false,error:'rate_limited',retryAfter:600};
    if (rows.size >= payload.capacity) return {ok:false,error:'sold_out'};
    const row = payload.record;
    const receipt={id:randomUUID(),eventId:payload.eventId,items:row.items,total:row.total,status:'pending',createdAt:payload.receivedAt,payerName:row.payerName||row.name,paymentDueAt:row.paymentDueAt};
    rows.set(payload.idempotencyKey,{fingerprint:payload.fingerprint,receipt});
    return {ok:true,receipt};
  }};
}
function context(store = memory(), changes = {}) { return {config,offer,store,secret,ip:'127.0.0.1',now,...changes}; }
const error = code => e => e.message === code;
function request(body = input(), changes = {}) { return {httpMethod:'POST',rawUrl:'http://localhost/api/seminars/signup',headers:{origin:'http://localhost','content-type':'application/json'},requestContext:{identity:{sourceIp:'127.0.0.1'}},body:JSON.stringify(body),...changes}; }
const jsonResponse = value => new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('normalizes one contact and duplicated payer name', () => {
  const got=validateSignup(input({contactType:'phone',contact:'010-1234-5678',payerName:'테스트 참가자'}),config.id);
  assert.equal(got.contact,'01012345678'); assert.equal(got.payerName,null);
  assert.throws(()=>validateSignup(input({contactType:'email',contact:'TEST@EXAMPLE.TEST'}),config.id),error('invalid_input'));
});
test('rejects unknown keys, quantity, malformed fields, controls, consent and retry keys before transport', async () => {
  const cases=[{unknown:true},{quantity:2},{contactType:'fax'},{contact:'not-email'},{contact:'x'.repeat(255)},{name:'bad\nname'},{name:' '},{name:'가'.repeat(51)},{consent:false},{website:'bot'},{idempotencyKey:'123'},{selection:['bundle','bundle']},{selection:[]},{payerName:false},{quote:{...input().quote,arbitrary:true}}];
  for(const patch of cases) assert.throws(()=>validateSignup(input(patch),config.id),error('invalid_input'));
  for(const selection of [['open'],['bundle','lecture']]) { const ctx=context(); await assert.rejects(submitSignup(input({selection}),ctx),error('invalid_input')); assert.equal(ctx.store.rows.size,0); }
});
test('server recomputes price, sends a rejected decision for atomic key lookup, saves no tampered quote', async () => {
  const ctx=context();
  await assert.rejects(submitSignup(input({quote:{version:offer.version,tier:offer.tier,total:1}}),ctx),e=>e.status===409&&e.details.quote.total===87000);
  assert.equal(ctx.store.rows.size,0);
  const result=await submitSignup(input(),ctx);
  assert.equal(result.receipt.total,87000); assert.equal(ctx.store.rows.size,1);
  assert.equal(Date.parse(result.receipt.paymentDueAt)-Date.parse(result.receipt.createdAt),86400000);
  assert.equal(result.receipt.payment.deadline,result.receipt.paymentDueAt);
  assert.equal(JSON.stringify(result.receipt).includes('test@example.test'),false);
});
test('original key replays receipt and due date after closure, sold-out and price transition', async () => {
  const ctx=context(); const body=input(); const first=await submitSignup(body,ctx);
  const retry=await submitSignup(body,{...ctx,config:{...config,capacity:1},offer:{...offer,open:false,version:'new',tier:'early',prices:{...offer.prices,bundle:85000}},now:new Date('2026-12-26T00:00:00+09:00')});
  assert.deepEqual(retry.receipt,first.receipt); assert.equal(ctx.store.rows.size,1);
  await assert.rejects(submitSignup({...body,name:'변경'},ctx),error('idempotency_conflict'));
});
test('concurrent same-key local contract converges to one receipt', async () => {
  const ctx=context(); const body=input(); const results=await Promise.all([submitSignup(body,ctx),submitSignup(body,ctx)]);
  assert.equal(ctx.store.rows.size,1); assert.equal(results[0].receipt.id,results[1].receipt.id);
});
test('closed sale, unavailable ticket and changed consent return structured failures without writes', async () => {
  const showRequest = {selection:['show'], quote:{version:offer.version,tier:offer.tier,total:offer.prices.show}};
  const withoutShow = {...offer, available:offer.available.filter(id => id !== 'show')};
  for(const [patch,overrides,code] of [
    [{}, {offer:{...offer,open:false}}, 'signup_closed'],
    [showRequest, {offer:withoutShow}, 'option_unavailable'],
    [{consentVersion:'old'}, {}, 'consent_changed']
  ]) {
    const ctx=context(memory(),overrides); await assert.rejects(submitSignup(input(patch),ctx),error(code)); assert.equal(ctx.store.rows.size,0);
  }
});
test('adapter receives hashes only for IP; purpose-separated fingerprints stable across retry times', async () => {
  const seen=[]; const backing=memory(); const ctx=context({submit:async p=>{seen.push(p);return backing.submit(p);}}); const body=input();
  await submitSignup(body,ctx); await submitSignup(body,{...ctx,now:new Date(now.getTime()+1000)});
  assert.equal(seen[0].fingerprint,seen[1].fingerprint); assert.equal(JSON.stringify(seen).includes('127.0.0.1'),false);
  assert.equal(seen[0].ipHash.length,64); assert.notEqual(digest(secret,'ip','same'),digest(secret,'contact','same'));
});
test('upstream errors and malformed receipts cannot expose arbitrary response fields', async () => {
  for(const result of [{ok:false,error:'internal detail test@example.test'},{ok:true,receipt:{contact:'private'}},{unexpected:'test@example.test'}]) await assert.rejects(submitSignup(input(),context({submit:async()=>result})),error('service_unavailable'));
  const run=createHandler({config,now:()=>now,store:{submit:async()=>({ok:false,error:'rate_limited',retryAfter:33,private:'test@example.test'})}});
  const result=await run(request()); assert.equal(result.statusCode,429); assert.equal(result.headers['Retry-After'],'33'); assert.equal(result.body.includes('test@example.test'),false);
});
test('HTTP rejects wrong method/origin/content/body and missing config without transport', async () => {
  assert.equal((await handler(request(undefined,{httpMethod:'GET'}))).statusCode,405);
  assert.equal((await handler(request(undefined,{headers:{origin:'https://evil.test','content-type':'application/json'}}))).statusCode,403);
  assert.equal((await handler(request(undefined,{body:' '.repeat(8193)}))).statusCode,413);
  assert.equal((await handler(request(undefined,{body:'{'}))).statusCode,400);
  let called=false;
  const closed=createHandler({config:{...config,account:'[계좌번호]'},store:{submit:()=>{called=true;}}});
  assert.equal((await closed(request())).statusCode,403); assert.equal(called,false);
});
test('HTTP configured closed deployment still returns previously stored receipt', async () => {
  const store=memory(); const body=input(); let current=offer;
  const run=createHandler({store,config,getOffer:()=>current,now:()=>now});
  const first=await run(request(body)); assert.equal(first.statusCode,200);
  current={...offer,open:false}; assert.deepEqual(JSON.parse((await run(request(body))).body),JSON.parse(first.body));
});
test('HTTP uses the Netlify client IP without a build flag and rejects requests without a trusted IP', async () => {
  const previous = process.env.NETLIFY;
  delete process.env.NETLIFY;
  try {
    const backing = memory();
    const ipHashes = [];
    const store = {async submit(payload) {
      ipHashes.push(payload.ipHash);
      return backing.submit(payload);
    }};
    const run = createHandler({store, config:{...config,testMode:false,account:'123456789012'}, now:()=>now});
    const requestHeaders = {...request().headers, 'x-forwarded-for':'192.0.2.30'};
    const netlifyHeaders = {...requestHeaders, 'X-Nf-Client-Connection-Ip':'192.0.2.20'};

    assert.equal((await run(request(input(), {headers:netlifyHeaders, requestContext:undefined}))).statusCode, 200);
    assert.equal((await run(request(input(), {headers:netlifyHeaders}))).statusCode, 200);
    const missingIp = await run(request(input(), {headers:requestHeaders, requestContext:undefined}));
    assert.equal(missingIp.statusCode, 503);
    assert.deepEqual(JSON.parse(missingIp.body), {error:'service_unavailable'});
    assert.deepEqual(ipHashes, [digest(secret, 'ip', '192.0.2.20'), digest(secret, 'ip', '127.0.0.1')]);
  } finally {
    if (previous === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = previous;
  }
});
test('envelope signs exact UTF8 JSON base64 bytes with version and timestamp', () => {
  const payload={name:'테스트 참가자',action:'readiness'};
  const signed=signEnvelope(payload,config.signingSecret,123456789);
  assert.equal(signed.version,1); assert.equal(signed.timestamp,123456789);
  assert.deepEqual(JSON.parse(Buffer.from(signed.payload,'base64').toString('utf8')),payload);
  assert.equal(signed.signature,createHmac('sha256',config.signingSecret).update(`1\n123456789\n${signed.payload}`).digest('hex'));
});
test('transport follows only Google ContentService output redirect with GET and no signed body', async () => {
  const calls=[]; const store=createSheetsStore(config,{fetcher:async(url,init)=>{calls.push([url,init]);return calls.length===1 ? new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/macros/echo?user_content_key=fake'}}) : jsonResponse({ok:true,ready:true});},clock:()=>123456789});
  assert.deepEqual(await store.submit({action:'readiness',eventId:config.id}),{ok:true,ready:true});
  assert.equal(calls[0][1].method,'POST'); assert.equal(calls[0][1].redirect,'manual'); assert.equal(calls[1][1].method,'GET'); assert.equal(calls[1][1].body,undefined); assert.equal(calls[1][1].headers,undefined);
});
test('transport rejects login HTML, invalid JSON, non-Google redirects, repeated redirects and oversized outputs', async () => {
  for(const response of [new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}}),new Response('{',{headers:{'Content-Type':'application/json'}}),new Response(null,{status:302,headers:{location:'https://evil.test/'}}),new Response(null,{status:307,headers:{location:'https://script.googleusercontent.com/macros/echo'}}),jsonResponse({text:'a'.repeat(17000)})]) {
    const store=createSheetsStore(config,{fetcher:async()=>response}); await assert.rejects(store.submit({action:'readiness'}),error('service_unavailable'));
  }
  const repeated=createSheetsStore(config,{fetcher:async()=>new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/macros/echo'}})});
  await assert.rejects(repeated.submit({}),error('service_unavailable'));
  for(const value of ['http://script.google.com/macros/s/x/exec','https://evil.test/macros/s/x/exec','https://script.google.com/macros/s/x/exec?secret=x','https://user@script.google.com/macros/s/x/exec','https://script.google.com/macros/s/x/dev']) assert.equal(validSheetsUrl(value),false);
});
test('transport aborts deadline and returns only generic retryable error', async () => {
  const store=createSheetsStore(config,{timeoutMs:10,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('private timeout')),{once:true}))});
  await assert.rejects(store.submit({}),error('service_unavailable'));
});

// Actual Code.gs is evaluated in a VM with local Google service doubles.
// This verifies the cross-runtime contract, not Google's hosted lock/durability.
import { createLocalSheet, localSubmission } from '../support/seminar-sheet.mjs';
function connected(sheet) {
  const store=createSheetsStore(config,{clock:()=>sheet.state.now,fetcher:async(url,init)=>jsonResponse(sheet.send(JSON.parse(init.body)))});
  return createHandler({config,store,now:()=>new Date(sheet.state.now)});
}
test('Netlify signed transport → actual Code.gs preserves one receipt after ambiguous flush failure and changed pricing', async () => {
  const sheet=createLocalSheet({now:now.getTime(),secret:config.signingSecret}); const run=connected(sheet); const body=input();
  sheet.state.failFlush=true;
  const failed=await run(request(body)); assert.equal(failed.statusCode,503); assert.equal(sheet.state.rows.length,2);
  const retry=await run(request(body)); assert.equal(retry.statusCode,200); assert.equal(sheet.state.rows.length,2);
  const receipt=JSON.parse(retry.body).receipt;
  assert.equal(receipt.total,87000); assert.equal(Date.parse(receipt.paymentDueAt)-Date.parse(receipt.createdAt),86400000);
  sheet.state.now=Date.parse('2026-12-25T00:00:00+09:00');
  assert.deepEqual(JSON.parse((await run(request(body))).body).receipt,receipt);
  const changed=await run(request(input())); assert.equal(changed.statusCode,409); assert.equal(JSON.parse(changed.body).error,'price_changed'); assert.equal(sheet.state.rows.length,2);
});
test('Netlify → Code.gs 59 seats plus two requests yields one 60th receipt and one sold-out, then replays', async () => {
  const sheet=createLocalSheet({now:now.getTime(),secret:config.signingSecret});
  for(let i=1;i<=59;i++) assert.equal(sheet.submit(localSubmission(i,sheet.state.now)).ok,true);
  const run=connected(sheet); const first=input({contact:'01012345671'}); const second=input({contact:'01012345672'});
  const results=await Promise.all([run(request(first)),run(request(second))]);
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]); assert.equal(sheet.state.rows.length,61);
  const won=results[0].statusCode===200?first:second; const receipt=JSON.parse(results.find(r=>r.statusCode===200).body).receipt;
  assert.equal(JSON.parse(results.find(r=>r.statusCode===409).body).error,'sold_out');
  assert.deepEqual(JSON.parse((await run(request(won))).body).receipt,receipt);
});
test('Netlify → Code.gs enforces IP/contact limits and recovers expired limits without leaking contacts', async () => {
  const sheet=createLocalSheet({now:now.getTime(),secret:config.signingSecret}); const run=connected(sheet);
  for(let i=0;i<3;i++) assert.equal((await run(request(input()))).statusCode,200);
  const contactLimited=await run(request(input())); assert.equal(contactLimited.statusCode,429); assert.equal(contactLimited.headers['Retry-After'],'3600');
  sheet.state.now+=3600001;
  assert.equal((await run(request(input()))).statusCode,200);
  const fresh=createLocalSheet({now:now.getTime(),secret:config.signingSecret}); const freshRun=connected(fresh);
  for(let i=0;i<10;i++) assert.equal((await freshRun(request(input({contact:`0101234567${i}`})))).statusCode,200);
  const ipLimited=await freshRun(request(input({contact:'01012345680'}))); assert.equal(ipLimited.statusCode,429); assert.equal(ipLimited.headers['Retry-After'],'600');
  assert.equal(ipLimited.body.includes('example.test'),false); assert.equal(fresh.state.rows.length,11);
});

test('all-zero account refuses public offer and direct POST without any writes in normal mode', async () => {
  const {createOfferHandler}=await import('../../netlify/functions/seminar-offer.mjs');
  for(const account of ['000000000000','0000-0000-0000','0000 0000 0000']) {
    const settings={...config,testMode:false,account}; let writes=0;
    const publicResponse=await createOfferHandler(settings,()=>now)({httpMethod:'GET'});
    assert.equal(JSON.parse(publicResponse.body).open,false);
    const response=await createHandler({config:settings,now:()=>now,store:{submit:async()=>{writes++;}}})(request());
    assert.equal(response.statusCode,403); assert.equal(writes,0);
  }
});
test('isolated test mode needs an explicit allowlisted deployment and marks successful receipt', async () => {
  for(const patch of [{testMode:false},{testSheetsUrl:undefined},{testSheetsUrl:'https://script.google.com/macros/s/different-test/exec'}]) {
    let writes=0; const settings={...config,...patch};
    assert.equal(getOffer(now,settings).open,false);
    assert.equal((await createHandler({config:settings,now:()=>now,store:{submit:async()=>{writes++;}}})(request())).statusCode,403);
    assert.equal(writes,0);
  }
  const response=await createHandler({config,now:()=>now,store:memory()})(request());
  assert.equal(response.statusCode,200);
  const receipt=JSON.parse(response.body).receipt;
  assert.equal(receipt.test,true); assert.equal(receipt.payment.test,true);
  assert.throws(()=>validateSignup(input({testMode:true}),config.id),error('invalid_input'));
});
test('Netlify production and unknown deployment context cannot enable isolated test mode', async () => {
  const keys=['NETLIFY','CONTEXT','NODE_ENV']; const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    for(const values of [{NETLIFY:'true',CONTEXT:'production',NODE_ENV:'test'},{NETLIFY:'false',CONTEXT:'',NODE_ENV:'production'},{NETLIFY:'true',CONTEXT:'',NODE_ENV:'test'},{NETLIFY:'false',CONTEXT:'production',NODE_ENV:'test'}]) {
      Object.assign(process.env,values); let writes=0;
      assert.equal(getOffer(now,config).open,false);
      const response=await createHandler({config,now:()=>now,store:{submit:async()=>{writes++;}}})(request());
      assert.equal(response.statusCode,403); assert.equal(writes,0);
    }
    for (const preview of ['deploy-preview','branch-deploy']) {
      Object.assign(process.env,{NETLIFY:'true',CONTEXT:preview,NODE_ENV:'production'});
      assert.equal(getOffer(now,config).open,true);
      const response=await createHandler({config,now:()=>now,store:memory()})(request());
      assert.equal(response.statusCode,200);
      assert.equal(JSON.parse(response.body).receipt.payment.test,true);
    }
  } finally {
    for(const key of keys) { if(original[key]===undefined) delete process.env[key]; else process.env[key]=original[key]; }
  }
});

test('Smore fields reject invalid dates, choices, hidden answers and missing acknowledgements before transport', async () => {
  const cases=[{birthDate:undefined},{birthDate:'2026-02-29'},{birthDate:'2000-2-01'},{birthDate:'0000-01-01'},{birthDate:'2026-12-21'},{birthDate:'2000-01-01\n'},
    {gender:'other'},{discovery:'unknown'},{reason:'unknown'},{discovery:'other'},{reason:'other'},{discoveryOther:'hidden'},{reasonOther:'hidden'},
    {discovery:'other',discoveryOther:'가'.repeat(101)},{reason:'other',reasonOther:'\tbad'},{photoConsent:false},{photoConsent:undefined},{photoConsentVersion:undefined},
    {contactType:'email',contact:'person@example.test'},{contact:' '.repeat(15)+'01012345678'},{consent:undefined}];
  for(const patch of cases) {
    let calls=0; const ctx=context({submit:async()=>{calls++;}});
    await assert.rejects(submitSignup(input(patch),ctx),error('invalid_input'));
    assert.equal(calls,0,JSON.stringify(patch));
  }
  assert.equal(validateSignup(input({birthDate:'2000-02-29'}),config.id,now).birthDate,'2000-02-29');
  assert.equal(validateSignup(input({birthDate:'2012-12-20'}),config.id,new Date('2026-12-19T15:00:00Z')).birthDate,'2012-12-20');
  assert.throws(()=>validateSignup(input({birthDate:'2012-12-21'}),config.id,new Date('2026-12-19T15:00:00Z')),error('invalid_input'));
  assert.throws(()=>validateSignup(input({ageConfirmed:false}),config.id,now),error('invalid_input'));
});
test('Smore normalized answers and both acknowledgements are signed and part of replay identity', async () => {
  const seen=[];const backing=memory();const ctx=context({submit:async p=>{seen.push(p);return backing.submit(p);}});
  const body=input({discovery:'other',discoveryOther:'  지인   모임  ',reason:'other',reasonOther:'  새로운 경험  '});
  const first=await submitSignup(body,ctx);
  const record=seen[0].record;
  assert.equal(record.discoveryOther,'지인 모임');assert.equal(record.reasonOther,'새로운 경험');
  for(const field of ['birthDate','gender','discovery','reason','photoConsent','photoConsentVersion','consent']) assert.equal(record[field],body[field]);
  assert.equal(record.photoConsentedAt,now.toISOString());
  assert.deepEqual((await submitSignup({...body,discoveryOther:'지인 모임'},ctx)).receipt,first.receipt);
  for(const patch of [{birthDate:'1991-01-01'},{gender:'female'},{discoveryOther:'다른 경로'},{reasonOther:'다른 이유'},{photoConsentVersion:'old'}])
    await assert.rejects(submitSignup({...body,...patch},ctx),error('idempotency_conflict'));
  assert.equal(backing.rows.size,1);
  await assert.rejects(submitSignup(input({photoConsentVersion:'old'}),context()),error('consent_changed'));
});

test('new answers traverse signed HTTP contract into text-safe sheet columns and replay original receipt', async () => {
  const sheet=createLocalSheet({now:now.getTime(),secret:config.signingSecret}); const run=connected(sheet);
  for(const patch of [{},{discovery:'other',discoveryOther:'=SUM(1,2)',reason:'other',reasonOther:'+새로운 경험'}]) {
    const body=input(patch);const response=await run(request(body)); assert.equal(response.statusCode,200);
    const row=sheet.state.rows.at(-1);const cell=key=>row[sheet.state.rows[0].indexOf(key)];
    assert.equal(cell('생년월일'),body.birthDate);assert.equal(cell('연락처'),body.contact);assert.equal(cell('성별'),'남자');
    assert.equal(cell('유입 경로 기타'),patch.discoveryOther ? '’'+patch.discoveryOther : '');
    assert.equal(cell('신청 이유 기타'),patch.reasonOther ? '’'+patch.reasonOther : '');
    assert.equal(cell('촬영 안내 버전'),offer.photoConsentVersion);assert.equal(cell('입금'),0);
    const saved=JSON.parse(cell('서버 기록'));assert.equal(saved.photoConsent,true);assert.equal(saved.consent,true);
    assert.deepEqual(JSON.parse((await run(request(body))).body),JSON.parse(response.body));
    assert.equal((await run(request({...body,birthDate:'1991-01-01'}))).statusCode,409);
  }
  assert.equal(sheet.state.rows.length,3);
  for(const patch of [{discoveryOther:'hidden'},{photoConsent:false},{birthDate:'2026-02-29'},{contactType:'email',contact:'test@example.test'}]) {
    assert.equal((await run(request(input(patch)))).statusCode,400); assert.equal(sheet.state.rows.length,3);
  }
});


test('other answers normalize whitespace before codepoint limits and reject raw controls first', () => {
  const answer='가'.repeat(98)+'  \u00a0나';
  const result=validateSignup(input({discovery:'other',discoveryOther:answer,reason:'other',reasonOther:'  처음\u3000\u00a0경험  '}),config.id,now);
  assert.equal(result.discoveryOther,'가'.repeat(98)+' 나');
  assert.equal([...result.discoveryOther].length,100);
  assert.equal(result.reasonOther,'처음 경험');
  for(const value of ['처음\t경험','처음\n경험','처음\r경험','처음\u0000경험','처음\u007f경험'])
    assert.throws(()=>validateSignup(input({reason:'other',reasonOther:value}),config.id,now),error('invalid_input'));
});
test('missing bank and either notice or version closes offer and POST without transport', async () => {
  for(const key of ['bank','privacyNotice','consentVersion','photoNotice','photoConsentVersion']) {
    for(const value of [undefined,'','  ']) {
      const settings={...config,[key]:value};let calls=0;
      assert.equal(getOffer(now,settings).open,false,key);
      const response=await createHandler({config:settings,now:()=>now,store:{submit:async()=>{calls++;}}})(request());
      assert.equal(response.statusCode,403,key);assert.equal(calls,0,key);
    }
  }
});

test('actual signed endpoint rejects each stale notice version and both stale versions with zero signup rows', async () => {
  for(const patch of [
    {consentVersion:'2026-11-26-v1'},
    {photoConsentVersion:'2026-11-26-v1'},
    {consentVersion:'2026-11-26-v1',photoConsentVersion:'2026-11-26-v1'}
  ]) {
    const sheet=createLocalSheet({now:now.getTime(),secret:config.signingSecret});const run=connected(sheet);
    const response=await run(request(input(patch)));
    assert.equal(response.statusCode,409,JSON.stringify(patch));
    assert.equal(JSON.parse(response.body).error,'consent_changed');
    assert.equal(sheet.state.rows.length,1,'only the header remains');
  }
});

test('pre-age-check daebeongae receipts replay with original fields after both notice versions change',async()=>{
 const sheet=createLocalSheet();
 const oldBody=input({consentVersion:'2026-11-27-v1',photoConsentVersion:'2026-11-27-v1'});delete oldBody.ageConfirmed;
 const oldConfig={...config,consentVersion:'2026-11-27-v1',photoConsentVersion:'2026-11-27-v1'};
 sheet.context.SEMINAR_CONSENT_VERSION='2026-11-27-v1';sheet.context.SEMINAR_PHOTO_CONSENT_VERSION='2026-11-27-v1';
 const date=new Date(sheet.state.now),first=await submitSignup(oldBody,{...context(sheet),config:oldConfig,offer:{...getOffer(date,oldConfig),tier:oldBody.quote.tier,prices:offer.prices},now:date});
 sheet.context.SEMINAR_CONSENT_VERSION=config.consentVersion;sheet.context.SEMINAR_PHOTO_CONSENT_VERSION=config.photoConsentVersion;
 const replay=await submitSignup(oldBody,{...context(sheet),now:date});assert.deepEqual(replay.receipt,first.receipt);
 await assert.rejects(submitSignup({...oldBody,idempotencyKey:randomUUID()},{...context(sheet),now:date}),error('consent_changed'));
 assert.equal(sheet.state.rows.length,2);
});

test('future daebeongae notice versions preserve age enforcement',()=>{
 assert.throws(()=>validateSignup(input({consentVersion:'future',photoConsentVersion:'future',ageConfirmed:false}),config.id,now),error('invalid_input'));
 assert.throws(()=>validateSignup(input({consentVersion:'future',photoConsentVersion:'future',birthDate:'2020-01-01'}),config.id,now),error('invalid_input'));
});

test('a March birthday is still under age on a leap day in Korea', () => {
 const leapDay = new Date('2028-02-29T12:00:00+09:00');
 assert.throws(() => validateSignup(input({birthDate:'2014-03-01'}),config.id,leapDay),error('invalid_input'));
});
