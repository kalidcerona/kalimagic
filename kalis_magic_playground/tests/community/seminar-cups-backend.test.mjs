import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {cupsnballs,getOffer,getEvent,accountForEvent} from '../../netlify/functions/_lib/seminar-events.mjs';
import {validateSignup,submitSignup} from '../../netlify/functions/_lib/seminar-signups.mjs';
import {createLocalSheet,localSubmission} from '../support/seminar-sheet.mjs';
const now = new Date('2026-11-27T18:00:00+09:00');
const secret='local-cups-signing-secret-32-characters';
const config={...cupsnballs,enabled:true,testMode:true,account:'0'.repeat(12),holder:'테스트',contact:'help@example.test',sheetsUrl:'https://script.google.com/macros/s/local-cups/exec',testSheetsUrl:'https://script.google.com/macros/s/local-cups/exec',signingSecret:secret,hmacSecret:'local-cups-hmac-secret-32-characters'};
function input(overrides={}) { const offer=getOffer(now,config); return {eventId:'cupsnballs',selection:['admission'],name:'테스트',contactType:'phone',contact:'01012345678',birthDate:'1990-01-01',gender:'male',discovery:'instagram',reason:'content',ageConfirmed:true,promotionConsent:true,photoConsent:true,photoConsentVersion:offer.photoConsentVersion,consent:true,consentVersion:offer.consentVersion,idempotencyKey:randomUUID(),quote:{version:offer.version,tier:offer.tier,total:50000},...overrides}; }
function sheet() {return createLocalSheet({now:now.getTime(),secret,eventId:'cupsnballs',properties:{CUPSNBALLS_SHEET_ID:'local-test-sheet',CUPSNBALLS_SHEETS_SIGNING_SECRET:secret,CUPSNBALLS_CONSENT_VERSION:config.consentVersion}});}
function context(store,date=now) { return {offer:getOffer(date,config),config,store,secret:config.hmacSecret,ip:randomUUID(),now:date}; }
test('cups boundaries and registry expose neither credentials nor internal capacity',()=>{
 for (const [date,open,price] of [['2026-11-27T17:59:59+09:00',false,50000],['2026-11-27T18:00:00+09:00',true,50000],['2026-12-06T23:59:59+09:00',true,50000],['2026-12-07T00:00:00+09:00',true,60000],['2026-12-13T23:59:59+09:00',true,60000],['2026-12-14T00:00:00+09:00',true,70000],['2026-12-19T00:00:00+09:00',false,70000]]) {const o=getOffer(date,config);assert.equal(o.open,open);assert.equal(o.prices.admission,price);assert.equal('capacity' in o,false);assert.equal('account' in o,false);}
 assert.equal(getEvent('constructor'),null);assert.equal(getEvent('eggbag'),null);
});
test('cups required defaults and independently disabled optional switches',()=>{
 const body=input(); assert.doesNotThrow(()=>validateSignup(body,'cupsnballs',now,config.policy));
 for(const field of ['birthDate','gender','discovery','reason']) assert.throws(()=>validateSignup({...body,[field]:''},'cupsnballs',now,config.policy));
 assert.throws(()=>validateSignup({...body,ageConfirmed:false},'cupsnballs',now,config.policy));
 assert.throws(()=>validateSignup({...body,birthDate:'2020-01-01'},'cupsnballs',now,config.policy));
 assert.throws(()=>validateSignup({...body,promotionConsent:false},'cupsnballs',now,config.policy));
 const optional={...config.policy,requireBirthDate:false,requireGender:false,requireDiscovery:false,requireReason:false,splitPhotoConsent:true};
 const value=validateSignup({...body,discovery:'',reason:'',promotionConsent:false},'cupsnballs',now,optional);
 assert.equal(value.birthDate,'');assert.equal(value.gender,'');assert.equal(value.promotionConsent,false);
 assert.doesNotThrow(()=>validateSignup({...body,reason:''},'cupsnballs',now,{...config.policy,requireReason:false}));
 assert.match(config.privacyNotice,/참가자 분석/);assert.match(config.privacyNotice,/필수 수집 항목/);
});
test('cups actual signed sheet allows 16th applicant, persists optional promotion and replays after close',async()=>{
 const store=sheet();let first,receipt;
 for(let i=0;i<16;i++){const body=input({contact:'010'+String(i).padStart(8,'0')}); const result=await submitSignup(body,context(store));if(!first){first=body;receipt=result.receipt;}}
 assert.equal(store.state.rows.length,17);assert.equal(store.state.tab,'컵앤볼 신청 명단');assert.equal(receipt.total,50000);
 assert.equal(store.state.rows[1][30],'20261127180001');assert.equal(store.state.rows[16][30],'20261127180016');
 assert.equal(receipt.displayReceiptNumber,store.state.rows[1][30]);
 const record=JSON.parse(store.state.rows[1][19]);assert.equal(record.promotionConsent,true);assert.equal(record.birthDate,'1990-01-01');assert.equal(record.ageConfirmed,true);
 const later=new Date('2026-12-20T00:00:00+09:00');store.state.now=later.getTime();assert.deepEqual((await submitSignup(first,context(store,later))).receipt,receipt);
});
test('cups rejects stale notice and wrong event without rows',async()=>{
 const store=sheet();await assert.rejects(submitSignup(input({consentVersion:'old'}),context(store)),/consent_changed/);assert.equal(store.state.rows.length,1);
 const opens = store.state.opens;
 const reply=store.submit({action:'readiness',eventId:'daebeongae'});
 assert.equal(reply.error,'invalid_event');assert.equal(store.state.opens,opens);assert.equal(store.state.rows.length,1);
});

test('cups saved receipt survives policy changes; new old-notice requests stay closed',async()=>{
 const store=sheet(), body=input({birthDate:'',gender:'',discovery:'',reason:'',promotionConsent:false});
 const oldConfig={...config,policy:{...config.policy,requireBirthDate:false,requireGender:false,requireDiscovery:false,requireReason:false,splitPhotoConsent:true}};
 const first=await submitSignup(body,{...context(store),config:oldConfig});
 const changed={...config,consentVersion:'2026-11-27-123456789abc',photoConsentVersion:'2026-11-27-123456789abc',policy:{...config.policy,requireBirthDate:true,requireDiscovery:true,splitPhotoConsent:false}};
 const ctx={...context(store),config:changed,offer:getOffer(now,changed)};
 assert.deepEqual((await submitSignup(body,ctx)).receipt,first.receipt);
 await assert.rejects(submitSignup({...body,idempotencyKey:randomUUID()},ctx),/consent_changed/);
 assert.equal(store.state.rows.length,2);
 assert.equal(store.state.rows[0].includes('홍보용 사진 활용 동의'),true);
});

test('cups readiness rejects missing and mismatched notices before opening sheet',()=>{
 const store=sheet(), before=store.state.opens;
 assert.equal(store.submit({action:'readiness',eventId:'cupsnballs'}).ok,false);
 assert.equal(store.submit({action:'readiness',eventId:'cupsnballs',consentVersion:'2026-11-27-000000000000'}).ok,false);
 assert.equal(store.state.opens,before);
 assert.equal(store.submit({action:'readiness',eventId:'cupsnballs',consentVersion:config.consentVersion}).ready,true);
});

test('event groups never borrow missing credentials and equal UUIDs remain event-scoped',async()=>{
 const env={SEMINAR_BANK_ACCOUNT:'synthetic-kakao',SEMINAR_BANK_HOLDER:'테스트'};
 assert.deepEqual(accountForEvent('cupsnballs',env),accountForEvent('daebeongae',env));
 assert.equal(accountForEvent('intro',env).account,undefined);assert.equal(accountForEvent('unknown',env),null);
 const body=input(), cups=sheet();await submitSignup(body,context(cups));
 const legacy=createLocalSheet();const payload=localSubmission();payload.idempotencyKey=body.idempotencyKey;
 assert.equal(legacy.submit(payload).ok,true);assert.equal(cups.state.rows.length,2);assert.equal(legacy.state.rows.length,2);
 assert.equal(getEvent('eggbag'),null);
});

test('cups 61st signup expands physical rows, payment controls, filter and protection',async()=>{
 const store=sheet();
 for(let i=0;i<61;i++) await submitSignup(input({contact:'010'+String(i).padStart(8,'0')}),context(store));
 assert.equal(store.state.rows.length,62);assert.ok(store.state.maxRows>=62);
 assert.equal(store.state.validation.height,store.state.maxRows-1);
 assert.equal(store.state.validation.col,32);
 assert.equal(store.state.filter.height,store.state.maxRows);
 assert.equal(store.state.protections[0].ranges[0].height,store.state.maxRows-1);
 assert.equal(store.state.rules[0].ranges[0].height,store.state.maxRows-1);
});

test('cups keeps filter object on ordinary signup and criteria across growth/retry',async()=>{
 const store=sheet(), filter=store.state.filter, criterion={synthetic:'paid-only'};
 filter.setColumnFilterCriteria(32,criterion);
 await submitSignup(input(),context(store));assert.equal(store.state.filter,filter);
 for(let i=1;i<60;i++) await submitSignup(input({contact:'010'+String(i).padStart(8,'0')}),context(store));
 const body=input({contact:'01099999999'});store.state.failFilter=true;
 await assert.rejects(submitSignup(body,context(store)),/service_unavailable/);
 assert.equal(store.state.filter.getColumnFilterCriteria(32),criterion);
 assert.equal(store.state.rows.length,61);
 const retry = await submitSignup(body,context(store));
 assert.equal(retry.receipt.displayReceiptNumber,'20261127180062');
 assert.equal(store.state.filter.getColumnFilterCriteria(32),criterion);
 assert.equal(store.state.filter.height,store.state.maxRows);
});

test('cups seller and required consent show the same instructor disclosure and reject the prior sheet version', () => {
  const offer = getOffer(now,config);
  for (const notice of [offer.formConfig.sellerNotice, offer.privacyNotice]) {
    assert.match(notice,/수업 난이도 조절을 위해 문준영 강사에게 성별 비율, 연령대 등 참가자 구성 정보만 전달합니다/);
    assert.match(notice,/참가자의 이름과 전화번호는 강사에게 전달하지 않습니다/);
    assert.doesNotMatch(notice,/명단 항목만 전달/);
  }
  const previous = '2026-11-27-d3c161f5f877';
  assert.notEqual(offer.consentVersion,previous);
  assert.equal(offer.photoConsentVersion,offer.consentVersion);
  const store = sheet();
  const readiness = consentVersion => store.submit({action:'readiness',eventId:'cupsnballs',consentVersion});
  assert.equal(readiness(previous).ok,false);
  assert.equal(readiness(offer.consentVersion).ready,true);
});

test('one spreadsheet isolates signed requests and setup across three named tabs', async () => {
  const contactSecret = 'local-inquiry-test-secret-32-characters';
  const store = createLocalSheet({setup:false, properties:{
    SEMINAR_EVENT_ID:' daebeongae, cupsnballs ',
    CUPSNBALLS_SHEET_ID:'local-test-sheet', CUPSNBALLS_SHEETS_SIGNING_SECRET:secret,
    CUPSNBALLS_CONSENT_VERSION:config.consentVersion,
    CONTACT_SHEET_ID:'local-test-sheet', CONTACT_SHEETS_SIGNING_SECRET:contactSecret
  }});
  assert.throws(() => store.context.setupSeminarSheet(), /invalid_event/);
  assert.equal(store.submit({action:'readiness',eventId:'other'}).error, 'invalid_event');
  assert.equal(store.submit({action:'readiness',eventId:'cupsnballs'}).error, 'invalid_signature');
  assert.equal(store.state.opens, 0);

  store.context.setupDaebeongaeSheet();
  const legacy = store.tabs.get('신청 명단').state;
  const payload = localSubmission(1, store.state.now);
  assert.equal(store.submit(payload).ok, true);
  const rows = structuredClone(legacy.rows);
  const [protection] = legacy.protections;
  const {ranges} = protection;
  const {rules, filter} = legacy;
  store.context.setupCupsnballsSheet();
  store.context.setupInquirySheet();
  const cupsStore = {submit: data => store.send(store.sign(data, store.state.now, secret))};
  const date = new Date(store.state.now);
  const offer = getOffer(date, config);
  await submitSignup(input({quote:{version:offer.version,tier:offer.tier,total:offer.prices.admission}}), context(cupsStore,date));
  const inquiry = {action:'inquiry_submit',eventId:'contact',idempotencyKey:randomUUID(),
    fingerprint:payload.fingerprint,ipHash:payload.ipHash,receivedAt:date.toISOString(),
    record:{message:'문의 내용',reply:'help@example.test',author:'비회원'}};
  assert.equal(store.send(store.sign(inquiry, store.state.now, contactSecret)).ok, true);

  assert.deepEqual(legacy.rows, rows);
  assert.equal(legacy.protections[0], protection);
  assert.equal(protection.ranges, ranges);
  assert.equal(legacy.rules, rules);
  assert.equal(legacy.filter, filter);
  assert.equal(store.tabs.get('컵앤볼 신청 명단').state.rows.length, 2);
  assert.equal(store.tabs.get('문의').state.rows.length, 2);
});

test('existing deployment adds the cups tab before upgrading the empty legacy roster', () => {
  const fileId = 'local-test-sheet';
  const store = createLocalSheet({setup:false, properties:{
    SEMINAR_EVENT_ID:'daebeongae,cupsnballs', SEMINAR_SHEET_ID:fileId,
    CUPSNBALLS_SHEET_ID:fileId, CUPSNBALLS_SHEETS_SIGNING_SECRET:secret,
    CUPSNBALLS_CONSENT_VERSION:config.consentVersion
  }});
  const file = store.context.SpreadsheetApp.openById(fileId);
  const legacySheet = file.insertSheet('신청 명단');
  const oldHeader = Array.from(store.context.SEMINAR_LEGACY_HEADERS);
  assert.equal(oldHeader.length, 21);
  legacySheet.getRange(1,1,1,21).setValues([oldHeader]);
  file.insertSheet('시트1');
  const blank = store.tabs.get('시트1').state;
  const blankBefore = structuredClone(blank);
  const legacy = store.tabs.get('신청 명단').state;

  store.context.setupCupsnballsSheet();
  assert.deepEqual(legacy.rows, [oldHeader]);
  assert.equal(legacy.maxColumns, 21);
  assert.equal(legacy.protections.length, 0);
  assert.equal(legacySheet.getFilter(), null);
  assert.equal(legacy.rules, undefined);
  const cups = store.tabs.get('컵앤볼 신청 명단').state;
  const cupsRows = structuredClone(cups.rows);
  assert.equal(cupsRows.length, 1);
  assert.equal(cupsRows[0].length, 32);
  assert.deepEqual(cupsRows[0].slice(-2), ['표시 접수번호','입금']);
  const {filter, rules, validation} = cups;
  const [protection] = cups.protections;
  const {ranges} = protection;

  store.context.setupDaebeongaeSheet();
  assert.equal(file.getSheetByName('신청 명단'), legacySheet);
  assert.deepEqual(legacy.rows, [Array.from(store.context.SEMINAR_BASE_HEADERS)]);
  assert.equal(legacy.rows[0].length, 29);
  assert.equal(legacy.validation.col, 29);
  assert.deepEqual(cups.rows, cupsRows);
  assert.equal(cups.filter, filter);
  assert.equal(cups.rules, rules);
  assert.equal(cups.validation, validation);
  assert.equal(cups.protections[0], protection);
  assert.equal(protection.ranges, ranges);
  assert.deepEqual(blank, blankBefore);
  assert.deepEqual([...store.tabs.keys()], ['신청 명단','시트1','컵앤볼 신청 명단']);

  const cupsRequest = {action:'readiness',eventId:'cupsnballs',consentVersion:config.consentVersion};
  assert.equal(store.send(store.sign(cupsRequest, store.state.now, secret)).ready, true);
  assert.equal(store.submit({action:'readiness',eventId:'daebeongae'}).ready, true);
});

test('cup display number uses the stored maximum, survives deletion and resets at the next KST minute', async () => {
  const store = sheet(), first = input();
  const accepted = (await submitSignup(first,context(store))).receipt;
  delete store.props.seminar_receipt_cupsnballs_20261127;
  const second = input({contact:'01000000002'});
  assert.equal((await submitSignup(second,context(store))).receipt.displayReceiptNumber,'20261127180002');
  store.state.rows.pop();
  const third = input({contact:'01000000003'});
  assert.equal((await submitSignup(third,context(store))).receipt.displayReceiptNumber,'20261127180003');
  store.state.now += 60000;
  const next = (await submitSignup(input({contact:'01000000004'}),context(store,new Date(store.state.now)))).receipt;
  assert.equal(next.displayReceiptNumber,'20261127180101');
  assert.deepEqual((await submitSignup(first,context(store,new Date(store.state.now)))).receipt,accepted);
});

test('cup requests serialize display numbers and replay a stored receipt after response loss', async () => {
  const store = sheet(), first = input(), second = input({contact:'01000000002'});
  store.state.failFlush = true;
  await assert.rejects(submitSignup(first,context(store)), /service_unavailable/);
  const responses = await Promise.all([first,second,first].map(body => submitSignup(body,context(store))));
  assert.equal(responses[0].receipt.displayReceiptNumber,'20261127180001');
  assert.equal(responses[1].receipt.displayReceiptNumber,'20261127180002');
  assert.deepEqual(responses[0],responses[2]);
  assert.equal(store.state.rows.length,3);
  await assert.rejects(submitSignup({...first,name:'다른 신청 이름'},context(store)), /idempotency_conflict/);
});

test('cup 100th request waits for the next minute while replay succeeds at the cap', async () => {
  const store = sheet();
  const bodies = Array.from({length:99},(_,i) => input({contact:'010'+String(i).padStart(8,'0')}));
  for (const [index, body] of bodies.entries()) {
    const result = await submitSignup(body,context(store));
    assert.equal(result.receipt.displayReceiptNumber,'202611271800'+String(index+1).padStart(2,'0'));
  }
  const overflow = input({contact:'01099999999'});
  await assert.rejects(submitSignup(overflow,context(store)), error => error.message === 'rate_limited' && error.status === 429 && error.details.retryAfter === 60);
  assert.equal(store.state.rows.length,100);
  assert.equal((await submitSignup(bodies[98],context(store))).receipt.displayReceiptNumber,'20261127180099');
  store.state.now += 60000;
  const result = await submitSignup(overflow,context(store,new Date(store.state.now)));
  assert.equal(result.receipt.displayReceiptNumber,'20261127180101');
});

test('cup sheet rejects wrong-minute, zero, non-text and duplicate display numbers', async () => {
  const store = sheet();
  await submitSignup(input(),context(store));
  await submitSignup(input({contact:'01000000002'}),context(store));
  for (const number of ['20261127180102','20261127180000',20261127180002,'20261127180001']) {
    store.state.rows[2][30] = number;
    const readiness = {action:'readiness',eventId:'cupsnballs',consentVersion:config.consentVersion};
    assert.equal(store.submit(readiness).error,'storage_unavailable');
  }
});

test('cup signup accepts a legacy UUID receipt and rejects malformed display numbers from the store', async () => {
  const body = input();
  const raw = {
    id:randomUUID(), eventId:'cupsnballs', items:[{id:'admission',label:'컵앤볼',quantity:1,price:50000}],
    total:50000, status:'pending', createdAt:now.toISOString(), payerName:body.name,
    paymentDueAt:new Date(now.getTime()+86400000).toISOString()
  };
  const submitReceipt = receipt => submitSignup(body,context({submit:() => ({ok:true,receipt})}));
  const legacy = (await submitReceipt(raw)).receipt;
  assert.equal(legacy.id,raw.id);
  assert.equal(Object.hasOwn(legacy,'displayReceiptNumber'),false);
  const valid = '20261127180001';
  assert.equal((await submitReceipt({...raw,displayReceiptNumber:valid})).receipt.displayReceiptNumber,valid);
  for (const number of [Number(valid), '20261131180001', '20261127180101', '20261127180000', valid+'\n', null]) {
    await assert.rejects(submitReceipt({...raw,displayReceiptNumber:number}), {message:'service_unavailable',status:503});
  }
});

function checkCupsMigration(filterWidth) {
  const store = createLocalSheet({setup:false, properties:{
    SEMINAR_EVENT_ID:'daebeongae,cupsnballs', CUPSNBALLS_SHEET_ID:'local-test-sheet',
    CUPSNBALLS_SHEETS_SIGNING_SECRET:secret, CUPSNBALLS_CONSENT_VERSION:config.consentVersion,
    CONTACT_SHEET_ID:'local-test-sheet', CONTACT_SHEETS_SIGNING_SECRET:'local-inquiry-test-secret-32-characters'
  }});
  store.context.setupDaebeongaeSheet();
  store.context.setupInquirySheet();
  const file = store.context.SpreadsheetApp.openById('local-test-sheet');
  const cupsSheet = file.insertSheet('컵앤볼 신청 명단');
  cupsSheet.insertColumnsAfter(21,filterWidth-21);
  const oldHeader = [...store.context.SEMINAR_BASE_HEADERS.slice(0,-1),'만 14세 이상 확인','홍보용 사진 활용 동의','입금'];
  cupsSheet.getRange(1,1,1,31).setValues([oldHeader]);
  const cups = store.tabs.get('컵앤볼 신청 명단').state;
  const payment = cupsSheet.getRange(2,31,cups.maxRows-1,1);
  payment.setDataValidation({formula:'=ISNUMBER(AE2)'});
  const protection = cupsSheet.protect().setUnprotectedRanges([payment]);
  const paymentCriterion = {synthetic:'paid-only',getCriteriaType:() => null};
  const secondCriterion = {synthetic:'selected',getCriteriaType:() => null};
  cupsSheet.getRange(1,1,cups.maxRows,filterWidth).createFilter()
    .setColumnFilterCriteria(31,paymentCriterion).setColumnFilterCriteria(5,secondCriterion);
  const daebeongae = store.tabs.get('신청 명단').state;
  const inquiry = store.tabs.get('문의').state;
  const legacyRows = structuredClone(daebeongae.rows);
  const inquiryRows = structuredClone(inquiry.rows);
  const legacyFilter = daebeongae.filter, legacyValidation = daebeongae.validation;
  const legacyRange = daebeongae.protections[0].ranges, inquiryRange = inquiry.protections[0].ranges;

  cups.failFilter = true;
  assert.throws(() => store.context.migrateCupsnballsSheet(), /filter_failure/);
  assert.deepEqual(cups.rows, [oldHeader]);
  assert.equal(cups.filter.width,filterWidth);
  assert.equal(cups.filter.getColumnFilterCriteria(31),paymentCriterion);
  assert.equal(cups.filter.getColumnFilterCriteria(5),secondCriterion);
  store.state.failFlush = true;
  assert.throws(() => store.context.migrateCupsnballsSheet(), /lost_flush_response/);
  assert.deepEqual(cups.rows, [oldHeader]);
  assert.equal(store.state.locked,false);
  store.context.migrateCupsnballsSheet();
  assert.deepEqual(cups.rows, [[...oldHeader.slice(0,-1),'표시 접수번호','입금']]);
  assert.equal(cups.maxColumns,32);
  assert.ok(cups.cleared.some(({kind,col}) => kind === 'validation' && col === 31));
  assert.ok(cups.formats.some(({col,format}) => col === 31 && format === '@'));
  assert.equal(cups.validation.formula,'=AND(ISNUMBER(AF2),OR(AF2=0,AF2=1))');
  assert.equal(cups.rules[0].formula,'=$AF2=1');
  assert.equal(cups.rules[0].ranges[0].width,32);
  assert.equal(protection.ranges[0].col,32);
  assert.equal(cups.filter.width,32);
  assert.equal(cups.filter.getColumnFilterCriteria(31),null);
  assert.equal(cups.filter.getColumnFilterCriteria(32),paymentCriterion);
  assert.equal(cups.filter.getColumnFilterCriteria(5),secondCriterion);
  assert.deepEqual(daebeongae.rows, legacyRows);
  assert.deepEqual(inquiry.rows, inquiryRows);
  assert.equal(daebeongae.filter, legacyFilter);
  assert.equal(daebeongae.validation, legacyValidation);
  assert.equal(daebeongae.protections[0].ranges, legacyRange);
  assert.equal(inquiry.protections[0].ranges, inquiryRange);

  const filter = cups.filter, flushes = store.state.flushes;
  store.context.migrateCupsnballsSheet();
  assert.equal(cups.filter,filter);
  assert.equal(store.state.flushes,flushes);
}
for (const filterWidth of [31,32]) {
  test(`cups migration preserves payment controls across tabs with a ${filterWidth}-column filter`, () => checkCupsMigration(filterWidth));
}

test('cups migration refuses existing legacy rows, unknown headers and lock contention before writing', () => {
  const store = sheet(), cups = store.state;
  cups.rows[0].splice(30,1);
  const filter = cups.filter, validation = cups.validation, flushes = cups.flushes;
  const props = {...store.props};
  const assertUntouched = (message) => {
    const rows = structuredClone(cups.rows);
    assert.throws(() => store.context.migrateCupsnballsSheet(),message);
    assert.deepEqual(cups.rows,rows);
    assert.deepEqual(store.props,props);
    assert.equal(cups.flushes,flushes);
    assert.equal(cups.filter,filter);
    assert.equal(cups.validation,validation);
  };
  cups.rows.push(['existing application']);
  assertUntouched(/existing_rows_preserved/);
  cups.rows.pop();
  cups.rows[0][29] = '알 수 없는 열';
  assertUntouched(/existing_header_preserved/);
  cups.rows[0][29] = '홍보용 사진 활용 동의';
  filter.setColumnFilterCriteria(5,{getCriteriaType:() => 'CUSTOM_FORMULA'});
  assertUntouched(/unsupported_filter_formula/);
  filter.setColumnFilterCriteria(5,null);
  filter.setColumnFilterCriteria(31,{getCriteriaType:() => null});
  filter.setColumnFilterCriteria(32,{getCriteriaType:() => null});
  assertUntouched(/payment_filter_conflict/);
  store.state.lockUnavailable = true;
  assertUntouched(/lock_unavailable/);
});
