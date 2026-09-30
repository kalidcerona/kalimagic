export function normalizeSettings(value = {}, personal = false) {
  const number = (key, fallback, min, max) => {
    const n = Number(value[key] ?? fallback);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    performance: personal || value.performance === 'time-machine' ? 'time-machine' : 'pin',
    timeDelay: number('timeDelay', 3, 0, 60),
    timeDuration: number('timeDuration', 8, 1, 60),
    style: value.style === 'galaxy' ? 'galaxy' : 'ios',
    digits: value.digits === 4 ? 4 : 6,
    unlockMode: value.unlockMode === 'attempt' ? 'attempt' : 'timer',
    unlockAttempt: Math.trunc(number('unlockAttempt', 3, 1, 99)),
    revealAttempt: Math.trunc(number('revealAttempt', 2, 1, 99)),
    vibration: value.vibration !== false,
    birthDaysLink: value.birthDaysLink !== false,
    delaySeconds: number('delaySeconds', 8, 0, 300),
    cropTop: Math.round(number('cropTop', 0, 0, 2000)),
    imagePosition: number('imagePosition', 50, 0, 100),
    statusStyle: value.statusStyle === 'black-translucent' ? 'black-translucent' : 'default',
    statusColor: /^#[0-9a-f]{6}$/i.test(value.statusColor ?? '') ? value.statusColor : '#000000',
  };
}

export function storageIdentityForPath(pathname) {
  const personal = !/^\/tools\/(?:unlock|release)(?:\/|$)/.test(String(pathname));
  return personal
    ? { personal, settingsKey: 'unlock-settings-personal-v2', imageDb: 'unlock-images-personal' }
    : { personal, settingsKey: 'unlock-settings-v1', imageDb: 'unlock-images' };
}

export function personalHomeReady(registeredKeys) {
  return registeredKeys.has('unlock') && registeredKeys.has('home2');
}

export function createState(digits = 6) {
  return {
    attempts: [], current: [], lastAttemptEndedAt: null,
    attemptStartedAt: null, digits: digits === 4 ? 4 : 6, unlocked: false,
    unlockArmed: false,
  };
}

export const FINGERPRINT_HOLD_MS = 600;

export function lockScreenCopy(style, hasDigits = false) {
  if (style === 'galaxy') {
    return { prompt: 'PIN을 입력하세요', emergency: '긴급전화', trailing: '' };
  }
  return {
    prompt: '암호 입력',
    emergency: '긴급 상황',
    trailing: hasDigits ? '삭제' : '취소',
  };
}

export function shouldUnlock(state, now, delayMs, unlockAttempt = null) {
  const complete = state.current.length === state.digits
    && state.attemptStartedAt !== null
    && now >= state.attemptStartedAt;
  if (Number.isInteger(unlockAttempt) && unlockAttempt >= 1) {
    return complete && state.attempts.length + 1 === unlockAttempt;
  }
  const delaySatisfied = state.lastAttemptEndedAt !== null
    && state.attemptStartedAt !== null
    && state.attemptStartedAt - state.lastAttemptEndedAt >= Math.max(0, delayMs);
  const blocked = state.attempts.some((attempt) => (
    attempt.length === state.current.length
    && attempt.every((digit, index) => digit === state.current[index])
  ));
  return complete
    && state.lastAttemptEndedAt !== null
    && !blocked
    && (state.unlockArmed || delaySatisfied);
}

export function pushDigit(state, digit, now, delayMs, autoSubmit = true, unlockAttempt = null) {
  if (state.unlocked || !Number.isInteger(digit) || digit < 0 || digit > 9
      || !Number.isFinite(now) || !Number.isFinite(delayMs)
      || state.current.length >= state.digits) return state;
  const next = {
    ...state,
    current: [...state.current, digit],
    attemptStartedAt: state.attemptStartedAt ?? now,
  };
  if (next.current.length < next.digits || !autoSubmit) return next;
  return submitPin(next, now, delayMs, unlockAttempt);
}

export function submitPin(state, now, delayMs, unlockAttempt = null) {
  if (state.unlocked || state.current.length !== state.digits
      || !Number.isFinite(now) || !Number.isFinite(delayMs)) return state;
  const delaySatisfied = state.lastAttemptEndedAt !== null
    && state.attemptStartedAt !== null
    && state.attemptStartedAt - state.lastAttemptEndedAt >= Math.max(0, delayMs);
  return {
    ...state,
    unlocked: shouldUnlock(state, now, delayMs, unlockAttempt),
    unlockArmed: state.unlockArmed || delaySatisfied,
    attempts: [...state.attempts, [...state.current]],
    lastAttemptEndedAt: now,
    current: [],
    attemptStartedAt: null,
  };
}

export function fingerprintHold(state, heldMs, now, thresholdMs = FINGERPRINT_HOLD_MS) {
  if (state.unlocked || !Number.isFinite(heldMs) || !Number.isFinite(now)
      || !Number.isFinite(thresholdMs) || heldMs < Math.max(0, thresholdMs)) return state;
  return {
    ...state,
    unlocked: true,
    attempts: [...state.attempts, state.current],
    lastAttemptEndedAt: now,
    current: [],
    attemptStartedAt: null,
  };
}

export function attemptFeedback(state, previousAttemptCount) {
  if (!Number.isInteger(previousAttemptCount)
      || state.attempts.length <= previousAttemptCount) return 'pending';
  return state.unlocked ? 'success' : 'failure';
}

export function feedbackVibration(outcome, enabled) {
  if (!enabled) return [];
  if (outcome === 'success') return [20];
  if (outcome === 'failure') return [35, 30, 35];
  return [];
}

export function deleteDigit(state) {
  if (state.unlocked || state.current.length === 0) return state;
  const current = state.current.slice(0, -1);
  return { ...state, current, attemptStartedAt: current.length ? state.attemptStartedAt : null };
}

export function clearCurrent(state) {
  return { ...state, current: [], attemptStartedAt: null };
}

export function toggleDigits(state) {
  return { ...clearCurrent(state), digits: state.digits === 4 ? 6 : 4 };
}

export function reset(state) {
  return createState(state.digits);
}

export function isHomeGestureArea(x, y, width, height) {
  return y >= height * 0.8 && x >= width * 0.25 && x <= width * 0.75;
}

export function peekOffset(startY, currentY, height) {
  return Math.max(-height, Math.min(0, currentY - startY));
}

export function registerTwoFingerTap(sequence, now, screen) {
  const active = sequence && now - sequence.startedAt < 1200;
  const next = active
    ? { ...sequence, count: sequence.count + 1 }
    : { startedAt: now, count: 1, screen };
  if (next.count === 3 && next.screen === 'input' && screen === 'input') {
    return { sequence: null, action: 'settings' };
  }
  if (next.count >= 2 && next.screen !== 'input') {
    return { sequence: null, action: 'reset' };
  }
  return { sequence: next, action: null };
}

export function settleTwoFingerTaps(sequence, now) {
  if (!sequence || now - sequence.startedAt < 1200) {
    return { sequence, action: null };
  }
  return { sequence: null, action: sequence.count >= 2 ? 'reset' : null };
}

export function registerLockTap(sequence, now) {
  const active = sequence && now - sequence.startedAt < 1200;
  const next = active
    ? { ...sequence, count: sequence.count + 1 }
    : { startedAt: now, count: 1 };
  if (next.count === 3) return { sequence: null, action: 'settings' };
  return { sequence: next, action: null };
}

export function parseBirthdate(digits6, todayLocal) {
  if (!Array.isArray(digits6) || digits6.length !== 6
      || digits6.some((digit) => !Number.isInteger(digit) || digit < 0 || digit > 9)
      || !(todayLocal instanceof Date) || Number.isNaN(todayLocal.getTime())) return null;
  const part = (start) => digits6[start] * 10 + digits6[start + 1];
  const shortYear = part(0);
  const currentYear = todayLocal.getFullYear();
  const year = shortYear <= currentYear % 100 ? 2000 + shortYear : 1900 + shortYear;
  const month = part(2);
  const day = part(4);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1
      || birthDate.getDate() !== day) return null;
  const birthDay = Date.UTC(year, month - 1, day);
  const today = Date.UTC(currentYear, todayLocal.getMonth(), todayLocal.getDate());
  return birthDay <= today ? birthDate : null;
}

export function daysAlive(birthDate, todayLocal) {
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())
      || !(todayLocal instanceof Date) || Number.isNaN(todayLocal.getTime())) return null;
  const birthDay = Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  const today = Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
  return Math.floor((today - birthDay) / 86400000);
}

// Gregorian dates of Korean lunar New Year, 1900-2099 (MMDD). Generated from
// the ICU Dangi calendar; 1900, 2000, 2022 and 2024 boundaries are checked in tests.
const LUNAR_NEW_YEAR = [
  131, 219, 208, 129, 216, 204, 125, 213, 202, 122,
  210, 130, 218, 206, 126, 214, 204, 123, 211, 201,
  220, 208, 128, 216, 205, 124, 213, 202, 123, 210,
  130, 217, 206, 126, 214, 204, 124, 211, 131, 219,
  208, 127, 215, 205, 126, 213, 202, 122, 210, 129,
  217, 206, 127, 214, 204, 124, 212, 131, 219, 208,
  128, 215, 205, 125, 213, 202, 122, 209, 130, 217,
  206, 127, 215, 203, 123, 211, 131, 218, 207, 128,
  216, 205, 125, 213, 202, 220, 209, 129, 218, 206,
  127, 215, 204, 123, 210, 131, 219, 208, 128, 216,
  205, 124, 212, 201, 122, 209, 129, 218, 207, 126,
  214, 203, 123, 210, 131, 219, 208, 128, 216, 205,
  125, 212, 201, 122, 210, 129, 217, 207, 127, 213,
  203, 123, 211, 131, 219, 208, 128, 215, 204, 124,
  212, 201, 122, 210, 130, 217, 206, 126, 214, 202,
  123, 211, 201, 219, 208, 128, 215, 204, 124, 212,
  202, 122, 209, 129, 217, 205, 126, 214, 203, 123,
  211, 131, 219, 207, 127, 215, 205, 124, 212, 202,
  122, 209, 129, 217, 206, 126, 214, 203, 124, 211,
  130, 218, 208, 127, 215, 205, 125, 212, 201, 121,
];

export function westernZodiac(birthDate) {
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) return null;
  const md = (birthDate.getMonth() + 1) * 100 + birthDate.getDate();
  if (md >= 1222 || md <= 119) return '염소자리';
  if (md <= 218) return '물병자리';
  if (md <= 320) return '물고기자리';
  if (md <= 419) return '양자리';
  if (md <= 520) return '황소자리';
  if (md <= 620) return '쌍둥이자리';
  if (md <= 722) return '게자리';
  if (md <= 822) return '사자자리';
  if (md <= 922) return '처녀자리';
  if (md <= 1022) return '천칭자리';
  if (md <= 1121) return '전갈자리';
  return '사수자리';
}

export function koreanYearAnimal(birthDate) {
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) return null;
  const year = birthDate.getFullYear();
  const boundary = LUNAR_NEW_YEAR[year - 1900];
  if (boundary === undefined) return null;
  const md = (birthDate.getMonth() + 1) * 100 + birthDate.getDate();
  const lunarYear = md < boundary ? year - 1 : year;
  const animals = ['쥐띠', '소띠', '호랑이띠', '토끼띠', '용띠', '뱀띠', '말띠', '양띠', '원숭이띠', '닭띠', '개띠', '돼지띠'];
  return animals[((lunarYear - 2020) % 12 + 12) % 12];
}

export function birthdateReveal(digits, todayLocal = new Date()) {
  const birthDate = parseBirthdate(digits, todayLocal);
  if (!birthDate) return null;
  return { days: daysAlive(birthDate, todayLocal), zodiac: westernZodiac(birthDate), animal: koreanYearAnimal(birthDate) };
}

export function formatAttemptLabel(digits, index, todayLocal = new Date()) {
  const pin = Array.isArray(digits) ? digits.join('') : '';
  const reveal = birthdateReveal(digits, todayLocal);
  if (!reveal) return pin;
  return `${pin} · ${reveal.days.toLocaleString('ko-KR')}일 · ${reveal.zodiac} · ${reveal.animal}`;
}

export function selectedAttemptReveal(attempts, attemptNumber, todayLocal = new Date()) {
  if (!Array.isArray(attempts) || !Number.isInteger(attemptNumber) || attemptNumber < 1) return null;
  const digits = attempts[attemptNumber - 1];
  if (!Array.isArray(digits) || !digits.length) return null;
  const pin = digits.join('');
  const reveal = birthdateReveal(digits, todayLocal);
  return reveal ? { pin, ...reveal } : { pin, days: null };
}

export function latestBirthdateAttempt(attempts, todayLocal = new Date()) {
  if (!Array.isArray(attempts)) return null;
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const digits = attempts[index];
    const reveal = birthdateReveal(digits, todayLocal);
    if (reveal) return { attemptNumber: index + 1, pin: digits.join(''), ...reveal };
  }
  return null;
}

function homeSwipeThreshold(viewportWidth) {
  const width = Number.isFinite(viewportWidth) ? viewportWidth : 390;
  return Math.max(14, Math.min(22, width * 0.045));
}

export function homeSwipeTarget(page, dx, dy, hasSecond, revealVisible = false, viewportWidth = 390) {
  if (dy <= -90 && Math.abs(dy) > Math.abs(dx) * 1.2) {
    return { page, revealVisible: false, peek: true };
  }
  const horizontalThreshold = page === 'home2' && dx < 0 ? homeSwipeThreshold(viewportWidth) : 70;
  if (Math.abs(dx) < horizontalThreshold || Math.abs(dx) <= Math.abs(dy) * 1.2) {
    return { page, revealVisible, peek: false };
  }
  if (dx < 0) {
    if (page === 'home1' && hasSecond) return { page: 'home2', revealVisible: false, peek: false };
    if (page === 'home2') return { page, revealVisible: true, peek: false };
  } else {
    if (page === 'home2' && revealVisible) return { page, revealVisible: false, peek: false };
    if (page === 'home2') return { page: 'home1', revealVisible: false, peek: false };
  }
  return { page, revealVisible, peek: false };
}

export function completeHomeSwipe(page, dx, dy, hasSecond, viewportWidth = 390) {
  const target = homeSwipeTarget(page, dx, dy, hasSecond, false, viewportWidth);
  return { ...target, revealVisible: false };
}
