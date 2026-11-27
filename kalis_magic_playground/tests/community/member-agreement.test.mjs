import assert from 'node:assert/strict';
import test from 'node:test';
import { PRIVACY_VERSION as version, TERMS_VERSION } from '../../member-policy-config.mjs';
import { createAgreementHandler } from '../../netlify/functions/member-agreement.mjs';

const agreedAt = '2026-11-30T00:00:00.000Z';
const input = {version, agreedAt, ageConfirmed:true};
const empty = () => ({terms_version:null, privacy_version:null, agreed_at:null});

function fixture({row = empty(), readError, writeError, authError} = {}) {
  let writes = 0;
  const db = {from(table) {
    assert.equal(table, 'profiles');
    const filters = [];
    let changes;
    const query = {
      select() {return query;},
      update(values) {changes = values; return query;},
      eq(name, value) {filters.push([name, value]); return query;},
      is(name, value) {assert.equal(value,null); return query.eq(name,value);},
      async maybeSingle() {
        assert.deepEqual(filters[0], ['user_id','verified-user']);
        if (!changes) return {data: row && {...row}, error:readError};
        const matches = filters.slice(1).every(([k,v])=>row[k]===v);
        if (writeError || !matches) return {data:null,error:writeError};
        Object.assign(row, changes);
        writes++;
        return {data:{user_id:'verified-user'}};
      }
    };
    return query;
  }};
  const handle = createAgreementHandler({getAdmin:()=>db, now:()=>Date.parse(agreedAt), viewer:async()=>{
    if (authError) throw new Error('auth_invalid');
    return {userId:'verified-user'};
  }});
  const post = (body = input, token = 'Bearer fixture') => handle({
    httpMethod:'POST', headers:{authorization:token}, body:JSON.stringify(body)
  });
  return {post,row,get writes() {return writes;}};
}

test('a verified profile gets its first receipt only once, including concurrent requests', async () => {
  const f = fixture();
  const replies = await Promise.all([f.post({...input,userId:'other'}), f.post()]);
  assert.ok(replies.some(r=>JSON.parse(r.body).recorded));
  assert.equal(f.writes,1);
  assert.deepEqual(f.row,{terms_version:TERMS_VERSION,privacy_version:version,agreed_at:agreedAt});
  assert.equal(JSON.parse((await f.post({...input,agreedAt:'2026-11-29T23:50:00.000Z'})).body).recorded,true);
  assert.equal(f.writes,1);
});

test('a missing schema or row defers the write without an error response', async () => {
  for (const options of [{readError:{code:'42703'}},{readError:{code:'PGRST204'}},{writeError:{code:'42703'}},{row:null}]) {
    const f = fixture(options);
    const result = await f.post();
    assert.equal(result.statusCode,200);
    assert.deepEqual(JSON.parse(result.body),{recorded:false});
    assert.equal(f.writes,0);
  }
});

test('identity, acceptance and version are checked before recording', async () => {
  const f = fixture();
  assert.equal((await f.post(input,'')).statusCode,401);
  assert.equal((await fixture({authError:true}).post()).statusCode,401);
  for (const overrides of [{version:'old'},{ageConfirmed:false},{agreedAt:'bad'},{agreedAt:'2100-01-01T00:00:00.000Z'}]) {
    assert.equal((await f.post({...input,...overrides})).statusCode,400);
  }
  assert.equal(f.writes,0);
});

test('new acceptance advances a previous version and cannot downgrade a newer receipt', async () => {
  const row = {terms_version:'2026-01-01',privacy_version:'2026-01-01',agreed_at:'2026-01-01T12:00:00Z'};
  const f = fixture({row});
  assert.equal(JSON.parse((await f.post()).body).recorded,true);
  row.terms_version = '2027-01-01';
  assert.equal(JSON.parse((await f.post()).body).recorded,false);
  assert.equal(f.writes,1);
  assert.equal((await fixture({readError:{code:'unexpected'}}).post()).statusCode,503);
});
