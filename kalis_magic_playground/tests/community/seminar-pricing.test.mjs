import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {event, getOffer} from '../../netlify/functions/_lib/seminar-events.mjs';
import {quote, labels} from '../../seminar-signup/pricing.mjs';

const ready = {...event, enabled: true, testMode: true, testSheetsUrl: 'https://script.google.com/macros/s/test/exec', account: '0000-0000-0000',
  holder: '테스트', contact: 'ops@example.test', sheetsUrl: 'https://script.google.com/macros/s/test/exec',
  signingSecret: 'x'.repeat(32), hmacSecret: 'y'.repeat(32)};
const offer = time => getOffer(new Date(time+'+09:00'), ready);
test('KST sale window and each tier change, start inclusive and end exclusive', () => {
  for (const [time, open, total] of [
    ['2026-12-14T23:59:59',false,87000],['2026-12-15T00:00:00',false,87000],
    ['2026-12-15T09:59:59',false,87000],['2026-12-15T10:00:00',true,87000],
    ['2026-12-24T23:59:59',true,87000],['2026-12-25T00:00:00',true,92000],
    ['2027-01-01T23:59:59',true,92000],['2027-01-02T00:00:00',true,97000],
    ['2027-01-10T23:59:59',true,97000],['2027-01-11T00:00:00',false,97000]
  ]) {
    assert.equal(offer(time).open,open,time);
    assert.equal(quote(offer(time),['bundle','open']).total,total,time);
  }
});
test('placeholders, operational switch, confirmed lecture availability and custom closing instant', () => {
  const at = new Date('2026-12-18T08:00:00Z');
  for (const field of ['account','holder','contact','sheetsUrl','signingSecret','hmacSecret','consentVersion','privacyNotice'])
    assert.equal(getOffer(at,{...ready,[field]:'[미정]'}).open,false,field);
  assert.equal(getOffer(at,{...ready,enabled:false}).open,false);
  assert.equal(getOffer(at,{...ready,closesAt:at.toISOString()}).open,false);
  assert.equal(getOffer(new Date(+at-1),{...ready,closesAt:at.toISOString()}).open,true);
  assert.deepEqual(getOffer(at,ready).available,['bundle','special','lecture','show','meeting','open']);
});
test('published tickets match the server, individually and in combinations', () => {
  const html = readFileSync(new URL('../../daebeongae/index.html',import.meta.url),'utf8');
  const first = offer('2026-12-20T00:00:00');
  for (const time of ['2026-12-15','2026-12-25','2027-01-02']) {
    const {bundleLabel,prices} = offer(time+'T00:00:00');
    assert.ok(html.includes('<dt>'+bundleLabel.replace(' 통합권','')+'</dt><dd>'+prices.bundle.toLocaleString('ko-KR')+'원'));
  }
  const priceText = html.replaceAll('<small>원</small>', '원')
    .replace('<span class="badge">핵심</span></dt>', '</dt>');
  for (const [id,price] of Object.entries(first.prices).filter(([id])=>id!=='bundle'))
    assert.ok(priceText.includes('<dt>'+labels[id]+'</dt><dd>'+price.toLocaleString('ko-KR')+'원'));
  assert.equal(quote(first,['lecture','show','open']).total,67000);
  assert.equal(quote(first,['lecture','special','show','meeting']).total,120000);
  for (const ids of [[],['open'],['bundle','lecture'],['show','show'],['constructor'],[{}]]) assert.throws(()=>quote(first,ids));
});

test('all 32 eligible ticket combinations at each tier', () => {
  const singles = [['special',30000],['lecture',20000],['show',40000],['meeting',30000]];
  for (const [day,bundle] of [['2026-12-15',80000],['2026-12-25',85000],['2027-01-02',90000]]) {
    const current = offer(day+'T10:00:00');
    for (const extra of [[],['open']]) {
      const addOn = extra.length * 7000;
      assert.equal(quote(current,['bundle',...extra]).total,bundle+addOn);
      for (let mask=1; mask<16; mask++) {
        const selected = singles.filter((_,index)=>mask & (1<<index));
        const ids = selected.map(([id])=>id);
        const expected = selected.reduce((sum,[,price])=>sum+price,addOn);
        assert.equal(quote(current,[...ids,...extra]).total,expected);
      }
    }
  }
});

test('guest quote is read-only and excludes server settings and bank details', async () => {
  const {createOfferHandler} = await import('../../netlify/functions/seminar-offer.mjs');
  const handle = createOfferHandler(ready, () => new Date('2026-12-15T01:00:00Z'));
  const result = await handle({httpMethod:'GET', queryStringParameters:{eventId:ready.id}});
  assert.equal(result.headers['cache-control'], 'no-store');
  const publicOffer = JSON.parse(result.body);
  assert.equal(publicOffer.open, true);
  for (const key of ['account','holder','sheetsUrl','signingSecret','hmacSecret']) {
    assert.equal(Object.hasOwn(publicOffer, key), false);
    assert.equal(result.body.includes(ready[key]), false);
  }
  assert.equal((await handle({httpMethod:'POST'})).statusCode, 405);
  assert.equal((await handle({httpMethod:'GET',queryStringParameters:{eventId:'other'}})).statusCode, 404);
});
