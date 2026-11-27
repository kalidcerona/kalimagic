import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cupsDefinition, getCupsFormConfig, CUPSNBALLS_FORM_URL} from '../../seminar-signup/event-config.mjs';
import {quote} from '../../seminar-signup/pricing.mjs';

test('cups single admission quote rejects legacy tickets, extras, quantity tricks and unsafe prices', () => {
  const offer = {eventId:'cupsnballs',version:'test',tier:'super',prices:{admission:50000}};
  assert.deepEqual(quote(offer,['admission']), {items:[{id:'admission',label:'참가권',price:50000,quantity:1}],total:50000,version:'test',tier:'super'});
  for (const selection of [[],['bundle'],['admission','open'],['admission','admission'],['constructor'],[{}],null])
    assert.throws(() => quote(offer,selection), /invalid_selection/);
  for (const price of [0,-1,'50000',NaN,Infinity,Number.MAX_SAFE_INTEGER+1])
    assert.throws(() => quote({...offer,prices:{admission:price}},['admission']), /invalid_price/);
});

test('cups public metadata has the approved KST dates and no public seat limit', () => {
  assert.equal(cupsDefinition.opensAt,'2026-11-27T18:00:00+09:00');
  assert.equal(cupsDefinition.closesAt,'2026-12-19T00:00:00+09:00');
  assert.equal(cupsDefinition.capacity,null);
  assert.equal(cupsDefinition.paymentDueHours,24);
  assert.deepEqual(cupsDefinition.tiers.map(t=>[new Date(t.start).toISOString(),t.price]),[
    ['2026-11-27T09:00:00.000Z',50000],['2026-12-06T15:00:00.000Z',60000],['2026-12-13T15:00:00.000Z',70000]
  ]);
  assert.equal(CUPSNBALLS_FORM_URL,'/seminar-signup/cupsnballs.html');
});

test('owner-confirmed defaults require all analysis fields and combined photo consent; switches remain reversible', () => {
  const config = getCupsFormConfig();
  assert.equal(config.minimumAge,14);
  assert.match(config.sellerNotice,/판매·접수 주체는 칼리매직 운영자/);
  assert.match(config.sellerNotice,/문준영/);
  assert.match(config.sellerNotice,/신청과 입금을 받고, 대관비·일회용품 등 비용을 공제한 뒤 문준영 강사에게 지급/);
  for (const key of ['requireBirthDate','requireGender','requireDiscovery','requireReason']) assert.equal(config[key],true);
  assert.equal(config.photoConsentMode,'required');
  const changed = getCupsFormConfig({CUPSNBALLS_MINIMUM_AGE:'0',CUPSNBALLS_REQUIRE_BIRTH_DATE:'false',
    CUPSNBALLS_REQUIRE_GENDER:'false',CUPSNBALLS_REQUIRE_DISCOVERY:'false',CUPSNBALLS_REQUIRE_REASON:'false',
    CUPSNBALLS_PHOTO_CONSENT_MODE:'split',CUPSNBALLS_SELLER_NOTICE:'판매자 안내'});
  assert.equal(changed.minimumAge,0);
  for (const key of ['requireBirthDate','requireGender','requireDiscovery','requireReason']) assert.equal(changed[key],false);
  assert.equal(changed.photoConsentMode,'split');
  assert.ok(changed.sellerNotice.startsWith('판매자 안내 '));
  assert.match(changed.sellerNotice,/문준영 강사에게 성별 비율, 연령대 등 참가자 구성 정보만 전달합니다/);
  assert.equal(getCupsFormConfig({CUPSNBALLS_MINIMUM_AGE:'invalid',CUPSNBALLS_PHOTO_CONSENT_MODE:'invalid'}).minimumAge,14);
});
