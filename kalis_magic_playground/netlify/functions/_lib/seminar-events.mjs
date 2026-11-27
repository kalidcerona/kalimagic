import {createHash} from 'node:crypto';
import {cupsDefinition, getCupsFormConfig} from '../../../seminar-signup/event-config.mjs';
import {validSheetsUrl} from './seminar-sheets.mjs';

const tiers = [
  ['2026-12-15', 'super', '슈퍼 얼리버드', 80000],
  ['2026-12-25', 'early', '얼리버드', 85000],
  ['2027-01-02', 'regular', '정가', 90000]
].map(([date, id, label, price]) => ({start: Date.parse(date + 'T00:00:00+09:00'), id, label, price}));
const end = Date.parse('2027-01-11T00:00:00+09:00');

export const accountGroups = Object.freeze({
  kakao:Object.freeze({bank:'카카오뱅크',accountEnv:'SEMINAR_BANK_ACCOUNT',holderEnv:'SEMINAR_BANK_HOLDER'}),
  toss:Object.freeze({bank:'토스뱅크',accountEnv:'LESSON_BANK_ACCOUNT',holderEnv:'LESSON_BANK_HOLDER'})
});
const eventAccountGroups = Object.freeze({daebeongae:'kakao',cupsnballs:'kakao',eggbag:'kakao',intro:'toss',lesson:'toss'});
export function accountForEvent(id, env = process.env) {
  const group = Object.hasOwn(eventAccountGroups,id) && accountGroups[eventAccountGroups[id]];
  return group ? {bank:group.bank,account:env[group.accountEnv],holder:env[group.holderEnv]} : null;
}

export const event = {
  id: 'daebeongae', name: '칼리의 대번개', version: '2027-01-v2', consentVersion: '2026-11-30-v2', photoConsentVersion: '2026-11-30-v2',
  enabled: process.env.SEMINAR_SIGNUPS_ENABLED === 'true',
  testMode: process.env.SEMINAR_TEST_MODE === 'true',
  testSheetsUrl: process.env.SEMINAR_TEST_SHEETS_WEBAPP_URL,
  opensAt: '2026-12-15T10:00:00+09:00', closesAt: '2027-01-11T00:00:00+09:00',
  capacity: 60, paymentDueHours: 24, ...accountForEvent('daebeongae'),
  contact: process.env.SEMINAR_CONTACT, sheetsUrl: process.env.SEMINAR_SHEETS_WEBAPP_URL,
  signingSecret: process.env.SEMINAR_SHEETS_SIGNING_SECRET, hmacSecret: process.env.SEMINAR_HMAC_SECRET,
  photoNotice: '행사 운영 및 홍보를 위해 현장에서 사진이나 영상을 촬영할 수 있습니다. 본인 모습이 담긴 사진·영상의 활용을 원하지 않으시면 행사 전에 운영자에게 요청하십시오.',
  privacyNotice: '칼리매직은 신청 확인, 참가자에 맞춘 행사 준비, 유입 경로와 신청 이유 확인, 입금 대조 및 행사 연락을 위해 이름, 생년월일, 만 14세 이상 확인, 성별, 휴대전화, 유입 경로와 신청 이유(기타 답변 포함), 선택한 이용권·오픈 세션, 입금자명을 수집·이용합니다. 명단은 행사 종료 후 30일간 보관하며 2027년 2월 9일에 명단과 내려받은 사본을 삭제합니다. 동의를 거부할 수 있으며, 거부 시 온라인 신청이 어렵습니다.'
};

const cupsTiers = cupsDefinition.tiers;
const cupsFormConfig = getCupsFormConfig(process.env);
const cupsRequiredFields = ['이름','전화번호','참가권','입금자명',...(cupsFormConfig.requireBirthDate ? ['생년월일'] : []),...(cupsFormConfig.requireGender ? ['성별'] : []),...(cupsFormConfig.requireDiscovery ? ['유입 경로(기타 답변 포함)'] : []),...(cupsFormConfig.requireReason ? ['신청 이유(기타 답변 포함)'] : [])];
const cupsAnalysisFields = [...(cupsFormConfig.requireBirthDate ? ['생년월일'] : []),...(cupsFormConfig.requireGender ? ['성별'] : []),'유입 경로','신청 이유'];
const cupsOptionalFields = [...(!cupsFormConfig.requireDiscovery ? ['유입 경로(기타 답변 포함)'] : []),...(!cupsFormConfig.requireReason ? ['신청 이유(기타 답변 포함)'] : [])];
export const cupsnballs = {
  ...event, ...accountForEvent('cupsnballs'), id:'cupsnballs', name:cupsDefinition.name, version:'2026-12-v1',
  sheetsUrl:process.env.CUPSNBALLS_SHEETS_WEBAPP_URL, signingSecret:process.env.CUPSNBALLS_SHEETS_SIGNING_SECRET, hmacSecret:process.env.CUPSNBALLS_HMAC_SECRET,
  testSheetsUrl:process.env.CUPSNBALLS_TEST_SHEETS_WEBAPP_URL,
  enabled:process.env.CUPSNBALLS_SIGNUPS_ENABLED === 'true',
  opensAt:cupsDefinition.opensAt, closesAt:cupsDefinition.closesAt, capacity:cupsDefinition.capacity,
  formConfig:cupsFormConfig,
  policy:{...cupsFormConfig, splitPhotoConsent:cupsFormConfig.photoConsentMode === 'split'},
  photoNotice:cupsFormConfig.photoConsentMode === 'required' ? '현장에서 사진·영상을 촬영하며, 얼굴이 나온 사진·영상을 행사 홍보물에 사용합니다. 동의하신 경우 신청하실 수 있습니다.' : '현장에서 사진·영상을 촬영합니다. 얼굴이 나온 사진·영상을 홍보물에 사용하는 동의는 별도로 선택하실 수 있으며, 동의하지 않으셔도 신청하실 수 있습니다.',
  privacyNotice:cupsFormConfig.sellerNotice + ' 필수 수집 항목: ' + cupsRequiredFields.join(', ') + '. ' + (cupsOptionalFields.length ? '선택 수집 항목: '+cupsOptionalFields.join(', ')+'. 선택 항목은 답하지 않으셔도 신청하실 수 있습니다. ' : '') + '이름·전화번호·참가권·입금자명은 신청 확인·입금 대조·행사 연락에 이용합니다. 운영자는 ' + cupsAnalysisFields.join('·') + ' 중 실제 답변한 항목을 참가자 분석과 수업 준비에 이용합니다. 행사 종료 후 30일 이내 명단과 사본을 삭제합니다. 삭제를 요청하시려면 운영자가 신청 후 보내드리는 카카오톡 메시지에 답장하십시오. 필수 정보 수집·이용 동의를 거부하실 수 있으나 거부 시 온라인 신청이 어렵습니다.'
};
cupsnballs.consentVersion = cupsnballs.photoConsentVersion = '2026-11-27-' + createHash('sha256').update(JSON.stringify({formConfig:cupsFormConfig,privacyNotice:cupsnballs.privacyNotice,photoNotice:cupsnballs.photoNotice})).digest('hex').slice(0,12);
export const events = Object.freeze({daebeongae:event,cupsnballs});
export function getEvent(id = 'daebeongae') { return typeof id === 'string' && Object.hasOwn(events,id) ? events[id] : null; }

export function isolatedTestMode(config) {
  if (config.testMode !== true || process.env.CONTEXT === 'production') return false;
  if (process.env.NETLIFY === 'true') {
    if (!['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT)) return false;
  } else if (process.env.NODE_ENV === 'production') return false;
  return validSheetsUrl(config.testSheetsUrl) && config.sheetsUrl === config.testSheetsUrl;
}

export function configured(config) {
  const filled = value => typeof value === 'string' && value.trim() && !/[\[\]<>]|미정|placeholder|changeme/i.test(value);
  return ['bank', 'account', 'holder', 'contact', 'signingSecret', 'hmacSecret', 'consentVersion', 'privacyNotice', 'photoConsentVersion', 'photoNotice']
    .every(key => filled(config[key])) &&
    /^\d(?:[ -]?\d){7,19}$/.test(config.account) &&
    (!config.testMode || isolatedTestMode(config)) &&
    (/[1-9]/.test(config.account) || isolatedTestMode(config)) &&
    validSheetsUrl(config.sheetsUrl) &&
    Buffer.byteLength(config.signingSecret) >= 32 && Buffer.byteLength(config.hmacSecret) >= 32 &&
    config.signingSecret !== config.hmacSecret && Date.parse(config.opensAt) < Date.parse(config.closesAt);
}

export function getOffer(at = new Date(), config = event) {
  const now = new Date(at).getTime();
  if (config.id === 'cupsnballs') {
    const tier = cupsTiers.findLast(row => now >= row.start) || cupsTiers[0];
    const next = Math.min(...[...cupsTiers.map(row=>row.start),Date.parse(config.closesAt)].filter(time=>time>now));
    const scheduled = now < Date.parse(config.opensAt);
    const ended = now >= Date.parse(config.closesAt);
    const open = !scheduled && !ended && config.enabled && configured(config);
    return {test:isolatedTestMode(config),eventId:config.id,version:config.version,consentVersion:config.consentVersion,
      photoConsentVersion:config.photoConsentVersion,photoNotice:config.photoNotice,privacyNotice:config.privacyNotice,
      tier:tier.id,bundleLabel:tier.label+' 참가권',prices:{admission:tier.price},available:['admission'],
      open:Boolean(open),
      availabilityState:scheduled ? 'scheduled' : ended ? 'ended' : open ? 'open' : 'unavailable',
      nextBoundary:Number.isFinite(next)?new Date(next).toISOString():null,contact:config.contact || '[운영자 연락처]',formConfig:{...config.formConfig}};
  }
  const tier = tiers.findLast(row => now >= row.start) || tiers[0];
  const boundaries = [...tiers.map(row => row.start), Date.parse(config.opensAt), Date.parse(config.closesAt), end];
  const next = Math.min(...boundaries.filter(time => time > now));
  const prices = {bundle: tier.price, special: 30000, lecture: 20000, show: 40000, meeting: 30000, open: 7000};
  return {
    test: isolatedTestMode(config),
    minimumAge:14, eventId: config.id, version: config.version, consentVersion: config.consentVersion, photoConsentVersion:config.photoConsentVersion, photoNotice:config.photoNotice,
    tier: tier.id, bundleLabel: tier.label + ' 통합권', prices,
    open: Boolean(config.enabled && configured(config) && now >= tiers[0].start && now < end &&
      now >= Date.parse(config.opensAt) && now < Date.parse(config.closesAt)),
    available: Object.keys(prices),
    nextBoundary: Number.isFinite(next) ? new Date(next).toISOString() : null,
    contact: config.contact || '[운영자 연락처]', privacyNotice: config.privacyNotice
  };
}
