export function normalizeSettings(value = {}) {
  const number = (key, fallback, min, max) => {
    const n = Number(value[key] ?? fallback);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    performance: value.performance === 'time-machine' ? 'time-machine' : 'pin',
    timeDelay: number('timeDelay', 3, 0, 60),
    timeDuration: number('timeDuration', 8, 1, 60),
    style: value.style === 'galaxy' ? 'galaxy' : 'ios',
    digits: value.digits === 4 ? 4 : 6,
    unlockMode: value.unlockMode === 'attempt' ? 'attempt' : 'timer',
    unlockAttempt: Math.trunc(number('unlockAttempt', 3, 1, 99)),
    revealAttempt: Math.trunc(number('revealAttempt', 2, 1, 99)),
    vibration: value.vibration !== false,
    delaySeconds: number('delaySeconds', 8, 0, 300),
    cropTop: Math.round(number('cropTop', 0, 0, 2000)),
    imagePosition: number('imagePosition', 50, 0, 100),
    statusStyle: value.statusStyle === 'default' ? 'default' : 'black-translucent',
    statusColor: /^#[0-9a-f]{6}$/i.test(value.statusColor ?? '') ? value.statusColor : '#000000',
  };
}

export function storageIdentityForPath(pathname) {
  const personal = !String(pathname).startsWith('/tools/unlock/');
  return personal
    ? { personal, settingsKey: 'unlock-settings-personal-v2', imageDb: 'unlock-images-personal' }
    : { personal, settingsKey: 'unlock-settings-v1', imageDb: 'unlock-images' };
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
    prompt: '위로 쓸어올려서 Face ID 사용 또는 암호 입력',
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

export function formatAttemptLabel(digits, index, todayLocal = new Date()) {
  const pin = Array.isArray(digits) ? digits.join('') : '';
  if ((index !== 1 && index !== 2) || digits?.length !== 6) return pin;
  const birthDate = parseBirthdate(digits, todayLocal);
  if (!birthDate) return pin;
  return `${pin} · ${daysAlive(birthDate, todayLocal).toLocaleString('en-US')}일`;
}

export function selectedAttemptReveal(attempts, attemptNumber, todayLocal = new Date()) {
  if (!Array.isArray(attempts) || !Number.isInteger(attemptNumber) || attemptNumber < 1) return null;
  const digits = attempts[attemptNumber - 1];
  if (!Array.isArray(digits) || !digits.length) return null;
  const pin = digits.join('');
  const birthDate = parseBirthdate(digits, todayLocal);
  return { pin, days: birthDate ? daysAlive(birthDate, todayLocal) : null };
}

export function homeSwipeTarget(page, dx, dy, hasSecond) {
  if (dy <= -90 && Math.abs(dy) > Math.abs(dx) * 1.2) return 'peek';
  if (Math.abs(dx) < 70 || Math.abs(dx) <= Math.abs(dy) * 1.2) return page;
  if (dx < 0) {
    if (page === 'home1' && hasSecond) return 'home2';
    if (page === 'home2') return 'reveal';
  } else {
    if (page === 'reveal') return 'home2';
    if (page === 'home2') return 'home1';
  }
  return page;
}
