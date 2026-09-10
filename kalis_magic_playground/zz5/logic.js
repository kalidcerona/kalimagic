export function normalizeSettings(value = {}) {
  const number = (key, fallback, min, max) => {
    const n = Number(value[key] ?? fallback);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    style: value.style === 'galaxy' ? 'galaxy' : 'ios',
    digits: value.digits === 4 ? 4 : 6,
    delaySeconds: number('delaySeconds', 8, 0, 300),
    cropTop: Math.round(number('cropTop', 0, 0, 2000)),
    imagePosition: number('imagePosition', 50, 0, 100),
    statusStyle: value.statusStyle === 'default' ? 'default' : 'black-translucent',
    statusColor: /^#[0-9a-f]{6}$/i.test(value.statusColor ?? '') ? value.statusColor : '#000000',
  };
}

export function createState(digits = 6) {
  return {
    attempts: [], current: [], lastAttemptEndedAt: null,
    attemptStartedAt: null, digits: digits === 4 ? 4 : 6, unlocked: false,
  };
}

export function shouldUnlock(state, now, delayMs) {
  return state.current.length === state.digits
    && state.lastAttemptEndedAt !== null
    && state.attemptStartedAt !== null
    && now >= state.attemptStartedAt
    && state.attemptStartedAt - state.lastAttemptEndedAt >= Math.max(0, delayMs);
}

export function pushDigit(state, digit, now, delayMs) {
  if (state.unlocked || !Number.isInteger(digit) || digit < 0 || digit > 9
      || !Number.isFinite(now) || !Number.isFinite(delayMs)) return state;
  const next = {
    ...state,
    current: [...state.current, digit],
    attemptStartedAt: state.attemptStartedAt ?? now,
  };
  if (next.current.length < next.digits) return next;
  return {
    ...next,
    unlocked: shouldUnlock(next, now, delayMs),
    attempts: [...state.attempts, next.current],
    lastAttemptEndedAt: now,
    current: [],
    attemptStartedAt: null,
  };
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
