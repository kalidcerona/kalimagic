// Public metadata only. Account credentials and sheet bindings belong on the server.
export const CUPSNBALLS_FORM_URL = '/seminar-signup/cupsnballs.html';
export const linkageNotice = '회원으로 신청하시면 반복·부정 신청 확인을 위해 사이트 회원 식별자를 신청 내역과 함께 보관합니다. 행사 종료 후 30일 이내에 명단과 사본에서 삭제합니다. 동의하지 않으셔도 비회원으로 신청할 수 있습니다.';
export const cupsDefinition = Object.freeze({
  id: 'cupsnballs', name: '문준영의 컵 앤 볼 입문 클래스',
  opensAt: '2026-11-27T18:00:00+09:00', closesAt: '2026-12-19T00:00:00+09:00',
  eventDate: '2026-12-19', startsAt: '2026-12-19T18:30:00+09:00', endsAt: '2026-12-19T23:30:00+09:00',
  venue: '렉쳐노트 퍼블리싱 · 서울 동작구 남부순환로 2043 지하 1층',
  capacity: null, paymentDueHours: 24,
  tiers: Object.freeze([
    ['2026-11-27T18:00:00+09:00', 'super', '슈퍼 얼리버드', 50000],
    ['2026-12-07T00:00:00+09:00', 'early', '얼리버드', 60000],
    ['2026-12-14T00:00:00+09:00', 'regular', '정가', 70000]
  ].map(([date, id, label, price]) => Object.freeze({start: Date.parse(date), id, label, price})))
});

// Explicit deployment settings let the operator apply Q46/Q52/Q54 settings without a code edit.
export function getCupsFormConfig(env = {}) {
  const flag = name => env['CUPSNBALLS_REQUIRE_' + name] !== 'false';
  const seller = env.CUPSNBALLS_SELLER_NOTICE?.trim() ||
    '판매·접수 주체는 칼리매직 운영자입니다. 운영자가 신청과 입금을 받고, 대관비·일회용품 등 비용을 공제한 뒤 문준영 강사에게 지급합니다.';
  const instructorNotice = '운영자는 수업 난이도 조절을 위해 문준영 강사에게 성별 비율, 연령대 등 참가자 구성 정보만 전달합니다. 참가자의 이름과 전화번호는 강사에게 전달하지 않습니다.';
  return {
    linkageNotice,
    minimumAge: env.CUPSNBALLS_MINIMUM_AGE === '0' ? 0 : 14,
    requireBirthDate: flag('BIRTH_DATE'), requireGender: flag('GENDER'),
    requireDiscovery: flag('DISCOVERY'), requireReason: flag('REASON'),
    photoConsentMode: env.CUPSNBALLS_PHOTO_CONSENT_MODE === 'split' ? 'split' : 'required',
    sellerNotice: seller + ' ' + instructorNotice
  };
}
