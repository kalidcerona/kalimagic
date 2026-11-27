import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {config,createContactHandler} from '../../netlify/functions/contact.mjs';
import {createLocalSheet} from '../support/seminar-sheet.mjs';
const settings={sheetsUrl:'https://script.google.com/macros/s/local-contact/exec',signingSecret:'test-contact-signing-secret-32-characters',hmacSecret:'test-contact-hmac-secret-32-characters'};
function fixture(options={}) {
 const store=createLocalSheet({secret:settings.signingSecret,setup:false,properties:{CONTACT_SHEET_ID:'local-test-sheet',CONTACT_SHEETS_SIGNING_SECRET:settings.signingSecret}});store.context.setupInquirySheet();
 const deliveries=[];const handle=createContactHandler({settings,store,webhook:'https://example.invalid/contact?thread_id=123',now:()=>store.state.now,send:async(url,request)=>{assert.equal(new URL(url).searchParams.get('wait'),'true');deliveries.push(JSON.parse(request.body));return Response.json({id:'123456789012345678'});},...options});
 const post=(body,headers={})=>handle({httpMethod:'POST',headers:{'x-nf-client-connection-ip':'local-ip',...headers},body:JSON.stringify(body)});
 return {store,deliveries,handle,post};
}
const body=(changes={})=>({message:'문의 내용',reply:'reply@example.test',idempotencyKey:randomUUID(),...changes});
test('contact needs configuration and signed sheet readiness',async()=>{
 const f=fixture();assert.deepEqual(JSON.parse((await f.handle({httpMethod:'GET'})).body),{open:true});
 for(const options of [{webhook:''},{settings:{}},{store:null}]){const f=fixture(options);assert.equal(JSON.parse((await f.handle({httpMethod:'GET'})).body).open,false);assert.equal((await f.post(body())).statusCode,503);}
 f.store.state.rows[0][0]='wrong';assert.equal(JSON.parse((await f.handle({httpMethod:'GET'})).body).open,false);
});
test('contact stores private content and sends contentless alert only once',async()=>{
 const f=fixture({viewer:async()=>({nickname:'회원',userId:'verified-id'})}),input=body({message:'@everyone ``` private'});
 const response=await f.post(input,{authorization:'Bearer test'});assert.equal(response.statusCode,200);
 assert.equal(f.store.state.rows[1][2],'회원 (verified-id)');assert.equal(f.store.state.rows[1][4],'’'+input.message);assert.equal(f.store.state.rows[1][7],'확인됨');
 assert.deepEqual(f.deliveries[0].allowed_mentions,{parse:[]});assert.match(f.deliveries[0].content,/새 문의가 접수되었습니다/);assert.doesNotMatch(f.deliveries[0].content,/private|verified|reply|회원|everyone/);
 const replay=await f.post(input,{authorization:'Bearer test'});assert.equal(replay.body,response.body);assert.equal(f.store.state.rows.length,2);assert.equal(f.deliveries.length,1);
});
test('contact validates, drops honeypots and rejects unverified users without saving',async()=>{
 const f=fixture({viewer:async()=>{throw Error();}});
 for(const value of [null,{},body({message:' '}),body({message:'x'.repeat(1401)}),body({reply:'x'.repeat(151)}),body({idempotencyKey:'bad'})])assert.equal((await f.post(value)).statusCode,400);
 assert.equal((await f.post({website:'bot'})).statusCode,200);assert.equal((await f.post(body(),{authorization:'bad'})).statusCode,401);assert.equal(f.store.state.rows.length,1);
 assert.equal((await f.post(body({message:'one.example two.example',reply:'three.example four.example'}))).statusCode,400);
});
test('contact enforces warm and durable rate limits; resets and retries do not duplicate',async()=>{
 const f=fixture();for(let i=0;i<3;i++)assert.equal((await f.post(body())).statusCode,200);
 assert.equal((await f.post(body())).statusCode,429);
 const cold=createContactHandler({settings,store:f.store,webhook:'https://example.invalid',now:()=>f.store.state.now});
 assert.equal((await cold({httpMethod:'POST',headers:{'x-nf-client-connection-ip':'local-ip'},body:JSON.stringify(body())})).statusCode,429);
 f.store.state.now+=60000;assert.equal((await f.post(body())).statusCode,200);
});
test('contact ambiguous sheet flush retry preserves one inquiry and no duplicate alert',async()=>{
 const f=fixture(),input=body();f.store.state.failFlush=true;
 assert.equal((await f.post(input)).statusCode,503);assert.equal(f.store.state.rows.length,2);
 assert.equal((await f.post(input)).statusCode,200);assert.equal(f.deliveries.length,0);assert.equal(f.store.state.rows[1][7],'미확인');
});
test('contact Discord receipt failures do not lose stored inquiry or assert notification',async()=>{
 for(const response of [new Response(null,{status:204}),Response.json({}),Response.json({id:'invalid'}),new Response('invalid')]){
  const f=fixture({send:async()=>response}),input=body();assert.equal((await f.post(input)).statusCode,200);assert.equal(f.store.state.rows[1][7],'미확인');assert.equal((await f.post(input)).statusCode,200);assert.equal(f.store.state.rows.length,2);
 }
});
test('contact conflicts and formula-like input stay safe',async()=>{
 const f=fixture(),input=body({message:'=1+1',reply:'+formula'});assert.equal((await f.post(input)).statusCode,200);assert.equal(f.store.state.rows[1][4],'’=1+1');assert.equal((await f.post({...input,message:'changed'})).statusCode,409);
});
test('contact uses the public rate limited route',async()=>{
 assert.equal(config.path,'/api/contact');assert.deepEqual(config.rateLimit,{windowLimit:3,windowSize:60,aggregateBy:['ip','domain']});
 const client=await readFile(new URL('../../contact.js',import.meta.url),'utf8');assert.equal(client.match(/const endpoint = '([^']+)'/)[1],config.path);
});

test('inquiry signature, sheet preservation, lock and readiness failures fail closed',()=>{
 const f=fixture(),count=f.store.state.opens;
 const envelope=f.store.sign({action:'inquiry_readiness',eventId:'contact'});envelope.signature='0'.repeat(64);
 assert.equal(f.store.send(envelope).ok,false);assert.equal(f.store.state.opens,count);
 f.store.state.lockUnavailable=true;assert.equal(f.store.submit({action:'inquiry_readiness',eventId:'contact'}).ok,false);f.store.state.lockUnavailable=false;
 f.store.state.rows.push(['existing']);assert.throws(()=>f.store.context.setupInquirySheet(),/existing_rows_preserved/);assert.deepEqual(f.store.state.rows[1],['existing']);
});

test('inquiry status is read-only and binds key, original fields and verified account',async()=>{
 let member={nickname:'회원',userId:'first'};
 const f=fixture({viewer:async()=>member}),input=body();
 const saved=JSON.parse((await f.post(input,{authorization:'Bearer first'})).body);
 member={nickname:'변경된 닉네임',userId:'first'};
 const status={...input,action:'status'};
 assert.deepEqual(JSON.parse((await f.post(status,{authorization:'Bearer first','x-nf-client-connection-ip':'status-one'})).body),{state:'accepted',id:saved.id});
 for(const candidate of [{...status,message:'changed'},{...status,reply:'changed'}])assert.equal((await f.post(candidate,{authorization:'Bearer first','x-nf-client-connection-ip':randomUUID()})).statusCode,409);
 member={nickname:'회원',userId:'other'};
 assert.equal((await f.post(status,{authorization:'Bearer other','x-nf-client-connection-ip':'status-other'})).statusCode,409);
 assert.equal((await f.post(status,{'x-nf-client-connection-ip':'status-guest'})).statusCode,409);
 assert.equal(f.store.state.rows.length,2);assert.equal(f.deliveries.length,1);
 const unknown=await f.post({...body(),action:'status'},{'x-nf-client-connection-ip':'status-unknown'});
 assert.deepEqual(JSON.parse(unknown.body),{state:'unknown'});assert.equal(f.store.state.rows.length,2);
});

test('lookup survives closed new intake and ambiguous durable save without alert or insertion',async()=>{
 const f=fixture(),input=body();f.store.state.failFlush=true;
 assert.equal((await f.post(input)).statusCode,503);
 const closed=createContactHandler({settings,store:f.store,webhook:'',now:()=>f.store.state.now});
 assert.equal(JSON.parse((await closed({httpMethod:'GET'})).body).open,false);
 const found=await closed({httpMethod:'POST',headers:{},body:JSON.stringify({...input,action:'status'})});
 assert.equal(found.statusCode,200);assert.equal(JSON.parse(found.body).state,'accepted');
 assert.equal(f.store.state.rows.length,2);assert.equal(f.deliveries.length,0);
 const unknown=await closed({httpMethod:'POST',headers:{},body:JSON.stringify({...body(),action:'status'})});
 assert.deepEqual(JSON.parse(unknown.body),{state:'unknown'});assert.equal(f.store.state.rows.length,2);
});

test('inquiry limiter prunes before readiness and capacity and recovers after expiry',async()=>{
 const f=fixture();
 for(let i=0;i<5000;i++)f.store.props['inquiry_rate_'+String(i).padStart(64,'0')]=JSON.stringify({count:3,until:f.store.state.now+60000});
 assert.ok(JSON.stringify(f.store.props).length>400000);
 assert.equal(JSON.parse((await f.handle({httpMethod:'GET'})).body).open,false);
 assert.equal((await f.post(body())).statusCode,503);assert.equal(f.store.state.rows.length,1);
 f.store.state.now+=60001;
 assert.equal(JSON.parse((await f.handle({httpMethod:'GET'})).body).open,true);
 assert.equal(Object.keys(f.store.props).filter(k=>k.startsWith('inquiry_rate_')).length,0);
 assert.equal((await f.post(body())).statusCode,200);assert.equal(f.store.state.rows.length,2);
 // Expired capacity also recovers on submit without a readiness request.
 for(let i=0;i<5000;i++)f.store.props['inquiry_rate_'+String(i).padStart(64,'0')]=JSON.stringify({count:3,until:f.store.state.now-1});
 assert.equal((await f.post(body(),{'x-nf-client-connection-ip':'recovered'})).statusCode,200);
 assert.equal(Object.keys(f.store.props).filter(k=>k.startsWith('inquiry_rate_')).length,2);
});
