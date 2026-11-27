// Click limits, fixed-detail defaults, and settings normalization.

export const LIMITS = {
  presetName: 40,
  contactName: 40,
  phone: 24,
  birthday: 24,
  address: 80,
  note: 120,
  region: 40,
  details: 160,
  presets: 20,
  contacts: 30,
  settingsSwipePx: 96,
  inputIntervalMs: 450,
  zoneWidth: 72,
  zoneHeight: 88,
  backupChars: 500000,
  targetClickMin: 1,
  targetClickMax: 20,
  defaultTargetClick: 4,
  maxClickCount: 10000,
};

// Shown only when settings omit a fixed field. Kept disjoint from generated pools.
export const DEFAULT_FIXED_DETAILS = Object.freeze({
  phone: "010-4242-4242",
  region: "미입력 가상구역",
  note: "미입력 가상 메모",
  details: "설정에 고정 상세가 없습니다",
});

// Names offered for the fictional list. A tap keeps whichever one was chosen.
export const DEFAULT_FICTIONAL_NAMES = Object.freeze([
  "별빛 하나",
  "구름 둘",
  "이슬 셋",
  "달그림자",
  "바람결",
  "안개섬",
  "노을별",
  "모래시계",
]);

export function charLength(value) {
  return Array.from(String(value)).length;
}

function clipChars(value, max) {
  const chars = Array.from(String(value));
  if (chars.length <= max) return chars.join("");
  return chars.slice(0, max).join("");
}

export { clipChars };

function cleanLimited(value, max, fallback) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/\u0000/g, "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned) return fallback;
  return clipChars(cleaned, max);
}

/**
 * Map a setting to an integer click index in 1..20.
 * Missing, fractional, and out-of-range values fall back to 4 (no clamping),
 * so a bad setting cannot slide the fixed reveal onto another click.
 */
export function normalizeTargetClick(value) {
  let numeric = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) return LIMITS.defaultTargetClick;
    numeric = Number(trimmed);
  }
  if (typeof numeric !== "number" || !Number.isInteger(numeric)) {
    return LIMITS.defaultTargetClick;
  }
  if (numeric < LIMITS.targetClickMin || numeric > LIMITS.targetClickMax) {
    return LIMITS.defaultTargetClick;
  }
  return numeric;
}

export function normalizeClickCount(state) {
  const count = state && typeof state === "object" ? state.clickCount : 0;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return 0;
  if (count > LIMITS.maxClickCount) return LIMITS.maxClickCount;
  return count;
}

/** 1-based index of the next detail opening. Does not mutate state. */
export function countContactOpening(state) {
  const current = normalizeClickCount(state);
  if (current >= LIMITS.maxClickCount) return LIMITS.maxClickCount;
  return current + 1;
}

export function normalizeFixedDetails(settings) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return {
    phone: cleanLimited(source.phone, LIMITS.phone, DEFAULT_FIXED_DETAILS.phone),
    region: cleanLimited(source.region, LIMITS.region, DEFAULT_FIXED_DETAILS.region),
    note: cleanLimited(source.note, LIMITS.note, DEFAULT_FIXED_DETAILS.note),
    details: cleanLimited(source.details, LIMITS.details, DEFAULT_FIXED_DETAILS.details),
  };
}

export function normalizePerformanceSettings(settings) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return {
    targetClick: normalizeTargetClick(source.targetClick),
    ...normalizeFixedDetails(source),
  };
}

/**
 * Keep the spectator's chosen name exactly, aside from NUL stripping and a
 * hard length cap. Blank or non-string input uses the first fictional name.
 */
export function keepSelectedName(value) {
  if (typeof value !== "string") return DEFAULT_FICTIONAL_NAMES[0];
  const withoutNull = value.replace(/\u0000/g, "");
  if (withoutNull.trim() === "") return DEFAULT_FICTIONAL_NAMES[0];
  return clipChars(withoutNull, LIMITS.contactName);
}
