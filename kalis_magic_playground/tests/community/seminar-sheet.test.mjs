import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalSheet, localSubmission } from '../support/seminar-sheet.mjs';
test('signed readiness is read only; unsigned, tampered, stale and wrong-event calls do not open sheet', () => {
  const sheet=createLocalSheet(); const opens=sheet.state.opens, rows=sheet.state.rows.length;
  for (const envelope of [{}, {...sheet.sign({action:'readiness',eventId:'daebeongae'}),signature:'0'.repeat(64)},sheet.sign({action:'readiness',eventId:'daebeongae'},sheet.state.now-300001),sheet.sign({action:'readiness',eventId:'other'})]) assert.equal(sheet.send(envelope).ok,false);
  assert.equal(sheet.state.opens,opens); assert.deepEqual(sheet.ready(),{ok:true,ready:true}); assert.equal(sheet.state.rows.length,rows);
});
test('59 + two competing new calls serialize to one receipt and one sold_out, with replay at capacity', async () => {
  const sheet=createLocalSheet(); for(let i=1;i<=59;i++) assert.equal(sheet.submit(localSubmission(i,sheet.state.now)).ok,true);
  const p=localSubmission(60,sheet.state.now),q=localSubmission(61,sheet.state.now);
  const results=await Promise.all([Promise.resolve().then(()=>sheet.submit(p)),Promise.resolve().then(()=>sheet.submit(q))]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).error,'sold_out');assert.equal(sheet.state.rows.length,61);
  sheet.state.now=Date.parse('2027-01-12T01:00:00Z');p.eligible=false;p.rejection={error:'signup_closed'};
  assert.deepEqual(sheet.submit(p).receipt,results[0].receipt);assert.equal(sheet.state.rows.length,61);
  assert.equal(sheet.submit({...p,fingerprint:'f'.repeat(64)}).error,'idempotency_conflict');
});
test('flush/response loss and same-key concurrent retry converge to the original row and due time', async () => {
  const sheet=createLocalSheet(),p=localSubmission(1,sheet.state.now);sheet.state.failFlush=true;
  assert.equal(sheet.submit(p).error,'storage_unavailable'); assert.equal(sheet.state.rows.length,2);assert.equal(sheet.state.locked,false);
  const results=await Promise.all([Promise.resolve().then(()=>sheet.submit(p)),Promise.resolve().then(()=>sheet.submit(p))]);
  assert.deepEqual(results[0],results[1]);assert.equal(sheet.state.rows.length,2);assert.equal(Date.parse(results[0].receipt.paymentDueAt)-Date.parse(results[0].receipt.createdAt),86400000);
});
test('same-IP guests share 180 attempts, contact fourth is limited, expiry recovers, replay consumes nothing', () => {
  const sheet=createLocalSheet(); const ip='a'.repeat(64);
  for(let i=1;i<=10;i++) {const p=localSubmission(i,sheet.state.now,{ipHash:ip});assert.equal(sheet.submit(p).ok,true);assert.equal(sheet.submit(p).ok,true);}
  for(let i=11;i<=180;i++) {
    const result=sheet.submit(localSubmission(i,sheet.state.now,{ipHash:ip}));
    if(i<=60) assert.equal(result.ok,true); else assert.equal(result.error,'sold_out');
  }
  assert.equal(sheet.submit(localSubmission(181,sheet.state.now,{ipHash:ip})).error,'rate_limited');
  sheet.state.now+=600001;assert.equal(sheet.submit(localSubmission(182,sheet.state.now,{ipHash:ip})).error,'sold_out');
  const other=createLocalSheet();for(let i=1;i<=4;i++) {const p=localSubmission(i,other.state.now);p.record.contact='01099999999';const result=other.submit(p);assert.equal(result.ok,i<=3);if(i===4)assert.equal(result.error,'rate_limited');}
  other.state.now+=3600001;const p=localSubmission(5,other.state.now);p.record.contact='01099999999';assert.equal(other.submit(p).ok,true);
});
test('price-changed new calls consume IP quota but never rows', () => {
  const sheet=createLocalSheet();for(let i=1;i<=181;i++){const p=localSubmission(i,sheet.state.now,{ipHash:'b'.repeat(64),eligible:false,rejection:{error:'price_changed',quote:{total:25000}}});assert.equal(sheet.submit(p).error,i<=180?'price_changed':'rate_limited');}assert.equal(sheet.state.rows.length,1);
});
test('malformed records and inconsistent existing rows fail closed', () => {
  for(const mutate of [p=>p.record.total++,p=>p.record.items[0].quantity=2,p=>p.record.items.push({...p.record.items[0]}),p=>p.record.contact='invalid',p=>p.record.name='bad\nname',p=>p.record.paymentDueAt=p.receivedAt,p=>p.extra=true]) {const sheet=createLocalSheet(),p=localSubmission(1,sheet.state.now);mutate(p);assert.equal(sheet.submit(p).ok,false);assert.equal(sheet.state.rows.length,1);}
  for(const mutate of [rows=>rows[0][0]='bad header',rows=>rows[1][7]++,rows=>rows.push([...rows[1]]),rows=>rows[1][19]='bad JSON',rows=>rows.push(Array(21).fill(''))]) {const sheet=createLocalSheet();sheet.submit(localSubmission(1,sheet.state.now));mutate(sheet.state.rows);const count=sheet.state.rows.length;assert.equal(sheet.submit(localSubmission(2,sheet.state.now)).error,'storage_unavailable');assert.equal(sheet.state.rows.length,count);}
});
test('lock and property quota failures close writes; paid rows still consume seats', () => {
  const sheet=createLocalSheet();sheet.state.lockUnavailable=true;assert.equal(sheet.submit(localSubmission()).error,'storage_unavailable');sheet.state.lockUnavailable=false;sheet.state.failProperties=true;assert.equal(sheet.submit(localSubmission()).error,'storage_unavailable');assert.equal(sheet.state.rows.length,1);
  sheet.state.failProperties=false;const p=localSubmission();sheet.submit(p);sheet.state.rows[1][sheet.state.rows[0].indexOf('입금')]=1;assert.equal(sheet.submit(p).receipt.status,'paid');
});
test('setup protects immutable columns and preserves existing records; native CSV values remain safe', () => {
  const sheet=createLocalSheet();assert.equal(sheet.state.protections.length,1);assert.equal(sheet.state.validation.allowInvalid,false);assert.equal(sheet.state.rows[0].at(-1),'입금');assert.equal(sheet.state.validation.formula,'=AND(ISNUMBER(AE2),OR(AE2=0,AE2=1))');assert.equal(sheet.state.rules[0].formula,'=$AE2=1');assert.equal(sheet.state.rules[0].ranges[0].width,31);
  const p=localSubmission();p.record.name='  =SUM(1,2)';p.record.payerName='+cmd';p.record.contactType='phone';p.record.contact='01012345678';assert.equal(sheet.submit(p).ok,true);
  const row=sheet.state.rows[1];assert.equal(row.at(-1),0);assert.equal(row[2],'’  =SUM(1,2)');assert.equal(row[3],'’+cmd');assert.equal(row[5],'01012345678');assert.equal(typeof row[7],'number');
  const csv=row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',');assert.ok(csv.includes('"’  =SUM(1,2)"'));assert.ok(csv.includes('"01012345678"'));
  const before=JSON.stringify(sheet.state.rows);assert.throws(()=>sheet.context.setupSeminarSheet(),/existing_rows_preserved/);assert.equal(JSON.stringify(sheet.state.rows),before);
});
test('historical signed price snapshots replay after future price changes', () => {
  const sheet=createLocalSheet(),p=localSubmission();p.record.items[0].unitPrice=23456;p.record.total=23456;assert.equal(sheet.submit(p).receipt.total,23456);p.eligible=false;p.rejection={error:'price_changed'};assert.equal(sheet.submit(p).receipt.total,23456);
});
test('header-only legacy setup expands and reinitializes twice without duplicate protection or rules', () => {
  const sheet=createLocalSheet();
  sheet.state.rows=[Array.from(sheet.context.SEMINAR_LEGACY_HEADERS)];sheet.state.maxColumns=21;
  for(let iteration=0;iteration<2;iteration++) {
    sheet.context.setupSeminarSheet();
    assert.deepEqual(sheet.state.rows[0],Array.from(sheet.context.SEMINAR_HEADERS));
    assert.equal(sheet.state.maxColumns,31);assert.equal(sheet.state.maxRows,61);
    assert.equal(sheet.state.protections.length,1);assert.equal(sheet.state.rules.length,1);
    assert.equal(sheet.state.protections[0].ranges[0].col,31);assert.equal(sheet.state.protections[0].ranges[0].height,60);
    assert.equal(sheet.state.filter.width,31);assert.equal(sheet.state.filter.height,61);
    assert.equal(sheet.state.validation.col,31);assert.equal(sheet.state.validation.height,60);
    assert.equal(sheet.state.rules[0].ranges[0].height,60);assert.equal(sheet.state.locked,false);
  }
  assert.ok(sheet.state.cleared.some(range=>range.col===21&&range.kind==='validation'));
  const p=localSubmission();p.record.discovery='other';p.record.discoveryOther='=formula';p.record.reason='other';p.record.reasonOther='+formula';
  const first=sheet.submit(p);assert.equal(first.ok,true);
  const value=name=>sheet.state.rows[1][sheet.state.rows[0].indexOf(name)];
  assert.equal(value('생년월일'),'1990-01-02');assert.equal(value('연락처'),'01000000001');
  assert.equal(value('유입 경로 기타'),'’=formula');assert.equal(value('신청 이유 기타'),'’+formula');
  assert.equal(value('촬영 안내 버전'),'2026-11-30-v2');assert.equal(value('입금'),0);
  sheet.state.rows[1][30]=1;assert.equal(sheet.submit(p).receipt.status,'paid');
});
test('setup rejects populated and unknown legacy tabs before changing any cells or metadata', () => {
  for(const kind of ['populated','unknown']) {
    const sheet=createLocalSheet();sheet.state.rows=[Array.from(sheet.context.SEMINAR_LEGACY_HEADERS)];
    if(kind==='populated')sheet.state.rows.push(Array(21).fill('existing'));else sheet.state.rows[0][0]='unknown';
    const snapshot=JSON.stringify(sheet.state);
    assert.throws(()=>sheet.context.setupSeminarSheet(),kind==='populated'?/existing_rows_preserved/:/existing_header_preserved/);
    // Opening the spreadsheet is the only observable operation on a rejected setup.
    const expected=JSON.parse(snapshot);expected.opens++;
    assert.deepEqual(JSON.parse(JSON.stringify(sheet.state)),expected);
  }
});
test('new answer validation rejects missing, invalid, hidden, outdated and unknown fields without rows', () => {
  const mutations=[
    r=>delete r.birthDate,r=>r.birthDate='2026-02-29',r=>r.birthDate='2026-12-16',r=>r.birthDate='1990-1-02',
    r=>r.gender='other',r=>r.discovery='facebook',r=>r.reason='advertisement',
    r=>r.discoveryOther='hidden',r=>r.reasonOther='hidden',r=>r.discovery='other',r=>r.reason='other',
    r=>{r.discovery='other';r.discoveryOther='x'.repeat(101);},r=>{r.reason='other';r.reasonOther='bad\nanswer';},
    r=>r.photoConsent=false,r=>delete r.consent,r=>r.consentVersion='old',r=>r.photoConsentVersion='old',
    r=>r.photoConsentedAt='2000-01-01T00:00:00Z',r=>{r.contactType='email';r.contact='test@example.test';},r=>r.email='test@example.test'
  ];
  for(const mutate of mutations){const sheet=createLocalSheet(),p=localSubmission();mutate(p.record);assert.equal(sheet.submit(p).error,p.record.consentVersion==='old'||p.record.photoConsentVersion==='old'?'consent_changed':'invalid_request');assert.equal(sheet.state.rows.length,1);}
  const sheet=createLocalSheet(),p=localSubmission();p.record.birthDate='2012-12-15';assert.equal(sheet.submit(p).ok,true);
});
test('notice rotation preserves historical receipts, duplicate checks and capacity while requiring current notices for new rows', () => {
  const sheet=createLocalSheet(), original=localSubmission(1,sheet.state.now);
  const accepted=sheet.submit(original);assert.equal(accepted.ok,true);
  sheet.context.SEMINAR_CONSENT_VERSION='2026-11-27-v2';
  sheet.context.SEMINAR_PHOTO_CONSENT_VERSION='2026-11-27-v2';
  assert.deepEqual(sheet.ready(),{ok:true,ready:true});
  assert.deepEqual(sheet.submit({...original,eligible:false,rejection:{error:'consent_changed'}}),accepted);
  assert.equal(sheet.submit({...original,fingerprint:'f'.repeat(64)}).error,'idempotency_conflict');
  assert.equal(sheet.submit(localSubmission(2,sheet.state.now)).error,'consent_changed');
  assert.equal(sheet.state.rows.length,2);
  function current(index) {
    const request=localSubmission(index,sheet.state.now);
    request.record.consentVersion='2026-11-27-v2';request.record.photoConsentVersion='2026-11-27-v2';
    return request;
  }
  for(let i=2;i<=60;i++)assert.equal(sheet.submit(current(i)).ok,true);
  assert.equal(sheet.state.rows.length,61);
  assert.equal(sheet.submit(current(61)).error,'sold_out');
  assert.deepEqual(sheet.submit(original),accepted);
  assert.equal(sheet.state.rows[1][sheet.state.rows[0].indexOf('동의 버전')],'2026-11-30-v2');
  assert.equal(sheet.state.rows[2][sheet.state.rows[0].indexOf('동의 버전')],'2026-11-27-v2');
});

test('member bridge verifies both notice versions, preserves legacy retries and keeps identifiers private',()=>{
  const s=createLocalSheet(), member=localSubmission(), id=member.idempotencyKey;
  const version='2026-11-30-v3', photo='2026-11-30-v2';
  const ready={action:'readiness',eventId:'daebeongae',requireMemberLinkage:true,consentVersion:version,photoConsentVersion:photo};
  assert.equal(s.submit(ready).memberLinkageReady,true);
  assert.equal(s.submit({...ready,photoConsentVersion:version}).ok,false);
  Object.assign(member.record,{signupMode:'member',memberId:id,linkageConsent:true,linkageConsentVersion:version,
    linkageConsentedAt:member.receivedAt,consentVersion:version});
  const rejected=structuredClone(member);rejected.record.linkageConsent=false;
  assert.equal(s.submit(rejected).error,'invalid_request');
  const guest=structuredClone(member);guest.record.signupMode='guest';
  assert.equal(s.submit(guest).error,'invalid_request');
  const accepted=s.submit(member);
  assert.equal(accepted.ok,true);assert.equal(JSON.stringify(accepted).includes(id),false);
  assert.deepEqual(s.state.rows[1].slice(-3),['회원',id,0]);
  member.eligible=false;member.rejection={error:'agreement_required'};
  assert.deepEqual(s.submit(member),accepted);
  assert.equal(s.submit({...member,fingerprint:'e'.repeat(64)}).error,'idempotency_conflict');
  const old=localSubmission(2), replay=s.submit(old);
  assert.deepEqual(s.state.rows[2].slice(-3),['기존 접수','',0]);
  s.props.SEMINAR_ACCEPT_PREVIOUS_NOTICE='false';
  assert.deepEqual(s.submit(old),replay);
  assert.equal(s.submit(localSubmission(3)).error,'consent_changed');
});

test('event-local IP counters prune legacy entries, enforce growth bounds and preserve replay',()=>{
  const s=createLocalSheet(), svc=s.context.PropertiesService.getScriptProperties();
  const hash='a'.repeat(64), now=s.state.now, rate=(event,key)=>s.context.seminarRate(svc,event,key,now);
  for(let i=0;i<180;i++)assert.equal(rate('daebeongae',hash),null);
  assert.equal(rate('daebeongae',hash).retryAfter,600);
  assert.equal(rate('cupsnballs',hash),null);
  const value=JSON.stringify({count:1,expires:now+600000});
  for(let n=0;n<1998;n++)s.props['seminar_rate_'+n]=value;
  assert.throws(()=>rate('cupsnballs','b'.repeat(64)),/limiter_full/);
  assert.equal(rate('cupsnballs',hash),null);
  s.props.seminar_rate_0=JSON.stringify({count:1,expires:now});
  assert.equal(rate('cupsnballs','b'.repeat(64)),null);
  assert.equal(Object.hasOwn(s.props,'seminar_rate_0'),false);
  s.props.misc='x'.repeat(400000);
  assert.throws(()=>rate('cupsnballs',hash),/limiter_full/);
});

test('150 distinct phones on the same IP can submit to Cups across successive minutes',()=>{
  const version='2026-11-27-000000000000', eventId='cupsnballs', ipHash='9'.repeat(64);
  const s=createLocalSheet({eventId,properties:{CUPSNBALLS_SHEET_ID:'local-test-sheet',
    CUPSNBALLS_SHEETS_SIGNING_SECRET:'local-test-signing-secret-32-characters',CUPSNBALLS_CONSENT_VERSION:version}});
  for(let i=1;i<=150;i++){
    const p=localSubmission(i,s.state.now,{eventId,capacity:null,ipHash});
    Object.assign(p.record,{items:[{id:'admission',label:'테스트',quantity:1,unitPrice:20000}],
      consentVersion:version,photoConsentVersion:version,promotionConsent:false});
    assert.equal(s.submit(p).ok,true);s.state.now+=800;
  }
  assert.equal(s.state.rows.length,151);
});
