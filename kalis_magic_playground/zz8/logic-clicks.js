// Seeded detail generation and the one-click performance transition.

import {
  LIMITS,
  clipChars,
  countContactOpening,
  keepSelectedName,
  normalizePerformanceSettings,
} from "./logic-limits.js";

const REGION_POOL = Object.freeze([
  "허구시 별빛구",
  "없음군 연습읍",
  "이야기시 달동네",
  "안개군 샘물리",
  "노을시 바람동",
  "모래시 시계로",
  "구름군 이슬읍",
  "별무리시 허구동",
]);

const NOTE_POOL = Object.freeze([
  "실존 인물이 아닌 연습 기록",
  "공연용으로만 만든 허구 메모",
  "장치 주소록과 무관한 예시",
  "로컬에서만 만든 가상 문장",
  "네트워크로 보내지 않은 문구",
  "다른 클릭마다 바뀌는 가짜 메모",
]);

const DETAIL_POOL = Object.freeze([
  "즉시 표시되는 가상 상세",
  "한 번에 보이는 허구 정보",
  "관객이 고른 이름 외의 가짜 내용",
  "고정값과 다른 로컬 생성 내용",
  "서버에 저장하지 않는 예시 상세",
  "권한 없이 만든 가짜 연락 정보",
]);

export function createClickState() {
  return { clickCount: 0 };
}

/** Fresh counter. Ignores the previous object and does not mutate it. */
export function resetClickState(state) {
  void state;
  return { clickCount: 0 };
}

/**
 * Deterministic integer generator in [0, exclusiveMax).
 * The same seed always yields the same sequence.
 */
export function createSeededRandomInt(seed) {
  let x = typeof seed === "number" && Number.isFinite(seed) ? seed >>> 0 : 0x6d2b79f5;
  if (x === 0) x = 0x6d2b79f5;
  return function randomInt(exclusiveMax) {
    const max = Number.isInteger(exclusiveMax) && exclusiveMax > 0 ? exclusiveMax : 1;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % max;
  };
}

function mixSeed(seed, clickIndex) {
  const base = typeof seed === "number" && Number.isFinite(seed) ? seed >>> 0 : 0x51ed27;
  const count = clickIndex >>> 0;
  let z = (base + Math.imul(count, 0x9e3779b1)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x7feb352d) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x846ca68b) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  return z === 0 ? 1 : z;
}

function callRandomInt(randomInt, exclusiveMax) {
  const raw = Number(randomInt(exclusiveMax));
  if (!Number.isFinite(raw)) return 0;
  const floored = Math.floor(Math.abs(raw));
  return floored % exclusiveMax;
}

function secretsOf(fixed) {
  return [fixed.phone, fixed.region, fixed.note, fixed.details].filter(
    (value) => typeof value === "string" && value.length > 0,
  );
}

function fieldLeaks(field, secrets) {
  if (typeof field !== "string" || field.length === 0) return true;
  return secrets.some((secret) => {
    if (field === secret) return true;
    return secret.length >= 4 && field.includes(secret);
  });
}

function bundleLeaks(bundle, secrets) {
  return (
    fieldLeaks(bundle.phone, secrets) ||
    fieldLeaks(bundle.region, secrets) ||
    fieldLeaks(bundle.note, secrets) ||
    fieldLeaks(bundle.details, secrets)
  );
}

function pad4(value) {
  return String(value).padStart(4, "0");
}

function stripLongSecrets(text, secrets) {
  let next = text;
  const ordered = secrets.slice().sort((left, right) => right.length - left.length);
  for (const secret of ordered) {
    if (secret.length < 4) continue;
    while (next.includes(secret)) next = next.split(secret).join("");
  }
  return next;
}

function scrubbedFallback(clickIndex, secrets) {
  const make = (label, attempt) => {
    let text = stripLongSecrets(`${label}${clickIndex}x${attempt}`, secrets);
    if (!text || fieldLeaks(text, secrets)) {
      text = stripLongSecrets(`◈${attempt}${clickIndex}`, secrets);
    }
    if (!text || fieldLeaks(text, secrets)) text = `◈${attempt}`;
    return clipChars(text, LIMITS.phone);
  };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const bundle = {
      phone: make("번호", attempt),
      region: clipChars(make("구역", attempt), LIMITS.region),
      note: clipChars(make("메모", attempt), LIMITS.note),
      details: clipChars(make("상세", attempt), LIMITS.details),
    };
    if (!bundleLeaks(bundle, secrets)) return bundle;
  }
  const marks = ["☎", "◈", "※", "☆", "☂", "❀", "♪", "☯"];
  const used = new Set();
  const pick = () => {
    for (const mark of marks) {
      if (used.has(mark) || fieldLeaks(mark, secrets)) continue;
      used.add(mark);
      return mark;
    }
    for (let code = 0x2460; code < 0x2480; code += 1) {
      const mark = String.fromCodePoint(code);
      if (used.has(mark) || fieldLeaks(mark, secrets)) continue;
      used.add(mark);
      return mark;
    }
    return "x";
  };
  return {
    phone: pick(),
    region: pick(),
    note: pick(),
    details: pick(),
  };
}

function buildFictionalDetails(randomInt, clickIndex, secrets) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const regionBase =
      REGION_POOL[(callRandomInt(randomInt, REGION_POOL.length) + attempt) % REGION_POOL.length];
    const noteBase = NOTE_POOL[(callRandomInt(randomInt, NOTE_POOL.length) + attempt) % NOTE_POOL.length];
    const detailBase =
      DETAIL_POOL[(callRandomInt(randomInt, DETAIL_POOL.length) + attempt) % DETAIL_POOL.length];
    const mid = ((callRandomInt(randomInt, 9000) + clickIndex * 17 + attempt * 29) % 9000) + 1000;
    const end = (callRandomInt(randomInt, 10000) + clickIndex * 13 + attempt * 7) % 10000;
    const phone010 = `010-${pad4(mid)}-${pad4(end)}`;
    const phoneAlt = `☎${clickIndex}-${attempt}`;
    const phone = fieldLeaks(phone010, secrets) ? phoneAlt : phone010;
    const bundle = {
      phone: clipChars(phone, LIMITS.phone),
      region: clipChars(`${regionBase} ${clickIndex}-${attempt}호`, LIMITS.region),
      note: clipChars(`${noteBase} #${clickIndex}.${attempt}`, LIMITS.note),
      details: clipChars(`${detailBase} (${clickIndex}-${attempt})`, LIMITS.details),
    };
    if (!bundleLeaks(bundle, secrets)) return bundle;
  }
  return scrubbedFallback(clickIndex, secrets);
}

function resolveRandomInt(source, clickIndex) {
  if (typeof source.randomInt === "function") return source.randomInt;
  return createSeededRandomInt(mixSeed(source.seed, clickIndex));
}

/**
 * Count one detail opening and resolve what to show immediately.
 * `randomInt(exclusiveMax)` or `seed` makes non-target text deterministic.
 * Supplied randomInt wins over seed. Input state and settings are not mutated.
 */
export function resolveContactClick(state, input) {
  const source = input && typeof input === "object" ? input : {};
  const settings = normalizePerformanceSettings(source.settings);
  const clickIndex = countContactOpening(state);
  const name = keepSelectedName(
    Object.prototype.hasOwnProperty.call(source, "selectedName") ? source.selectedName : source.name,
  );
  const isTarget = clickIndex === settings.targetClick;
  let phone = settings.phone;
  let region = settings.region;
  let note = settings.note;
  let details = settings.details;
  if (!isTarget) {
    const generated = buildFictionalDetails(
      resolveRandomInt(source, clickIndex),
      clickIndex,
      secretsOf(settings),
    );
    phone = generated.phone;
    region = generated.region;
    note = generated.note;
    details = generated.details;
  }
  return {
    state: { clickCount: clickIndex },
    opening: {
      clickIndex,
      targetClick: settings.targetClick,
      isTarget,
      name,
      phone,
      region,
      note,
      details,
    },
  };
}
