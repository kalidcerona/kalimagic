// Pure performance rules for the fictional contact-memory PWA.
// A spectator taps any displayed fictional contact. The chosen name stays exact.
// Each detail opening increments one local counter. Only the target click
// (default 4, allowed 1..20) shows the single fixed preset. Every other click
// shows different locally generated fictional phone/region/note/details at once.
// No DOM, storage, network, server, or device-contact access lives in this file.

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

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export function charLength(value) {
  return Array.from(String(value)).length;
}

function clipChars(value, max) {
  const chars = Array.from(String(value));
  if (chars.length <= max) return chars.join("");
  return chars.slice(0, max).join("");
}

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

export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function nameMatchesQuery(name, query) {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return normalizeSearch(name).includes(needle);
}

function cleanText(value) {
  return String(value).normalize("NFC").trim().replace(/\s+/g, " ");
}

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function projectAudienceList(contacts, query) {
  if (!Array.isArray(contacts)) return [];
  const rows = [];
  for (const contact of contacts) {
    if (!contact || typeof contact.id !== "string" || typeof contact.name !== "string") {
      continue;
    }
    if (!nameMatchesQuery(contact.name, query)) continue;
    rows.push({ id: contact.id, name: contact.name });
  }
  return rows;
}

export function reduceInput(state, kind, now, minInterval = LIMITS.inputIntervalMs) {
  const previous =
    state && typeof state.at === "number" && typeof state.kind === "string"
      ? state
      : null;
  if (typeof now !== "number" || !Number.isFinite(now) || typeof kind !== "string" || kind === "") {
    return { accept: false, state: previous };
  }
  if (previous && previous.kind === kind && now - previous.at < minInterval) {
    return { accept: false, state: previous };
  }
  return { accept: true, state: { kind, at: now } };
}

export function classifySettingsSwipe(fingers) {
  if (!Array.isArray(fingers) || fingers.length !== 2) return { type: "none" };
  const ok = fingers.every((finger) => {
    if (!finger || !Number.isFinite(finger.dx) || !Number.isFinite(finger.dy)) return false;
    return finger.dy >= LIMITS.settingsSwipePx && Math.abs(finger.dx) <= finger.dy;
  });
  return { type: ok ? "open-settings" : "none" };
}

export function performanceZones(width, height, safe = {}) {
  const left = positiveFinite(safe.left);
  const right = positiveFinite(safe.right);
  const bottom = positiveFinite(safe.bottom);
  const viewW = positiveFinite(width);
  const viewH = positiveFinite(height);
  const innerW = Math.max(0, viewW - left - right);
  const innerH = Math.max(0, viewH - bottom);
  let zoneW = LIMITS.zoneWidth;
  let zoneH = LIMITS.zoneHeight;
  if (innerW < zoneW * 2) zoneW = Math.floor(innerW / 2);
  if (innerH < zoneH) zoneH = Math.floor(innerH);
  zoneW = Math.max(0, zoneW);
  zoneH = Math.max(0, zoneH);
  const y = Math.max(0, viewH - bottom - zoneH);
  return {
    reveal: { x: viewW - right - zoneW, y, w: zoneW, h: zoneH },
    reset: { x: left, y, w: zoneW, h: zoneH },
  };
}

function contains(rect, x, y) {
  if (!rect || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

export function classifyZoneTap(x, y, zones) {
  if (!zones) return "none";
  const inReveal = contains(zones.reveal, x, y);
  const inReset = contains(zones.reset, x, y);
  if (inReveal && inReset) return "none";
  if (inReveal) return "reveal";
  if (inReset) return "reset";
  return "none";
}

export function moveItem(list, index, direction) {
  if (!Array.isArray(list)) return [];
  const next = list.slice();
  const target = index + direction;
  if (!Number.isInteger(index) || index < 0 || index >= next.length) return next;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function createId(prefix, random = Math.random) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let body = "";
  for (let i = 0; i < 10; i += 1) {
    const index = Math.min(alphabet.length - 1, Math.floor(random() * alphabet.length));
    body += alphabet[index];
  }
  return `${prefix}-${body}`;
}

function fail(errors, code, extra = {}) {
  errors.push({ code, ...extra });
}

function validateContact(contact, contactIndex) {
  const errors = [];
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
    fail(errors, "invalid-type", { contactIndex });
    return { ok: false, errors };
  }
  if (typeof contact.id !== "string" || !ID_PATTERN.test(contact.id)) {
    fail(errors, "invalid-id", { contactIndex });
  }
  const value = { id: contact.id };
  const specs = [
    ["name", LIMITS.contactName, "empty-name", "name-too-long", true],
    ["phone", LIMITS.phone, null, "phone-too-long", false],
    ["birthday", LIMITS.birthday, null, "birthday-too-long", false],
    ["address", LIMITS.address, null, "address-too-long", false],
    ["note", LIMITS.note, null, "note-too-long", false],
  ];
  for (const [key, max, emptyCode, longCode, required] of specs) {
    if (contact[key] == null) {
      value[key] = "";
      if (required) fail(errors, emptyCode, { contactIndex });
      continue;
    }
    if (typeof contact[key] !== "string") {
      fail(errors, "invalid-type", { contactIndex });
      value[key] = "";
      continue;
    }
    const cleaned = cleanText(contact[key]);
    value[key] = cleaned;
    if (required && cleaned === "") fail(errors, emptyCode, { contactIndex });
    else if (charLength(cleaned) > max) fail(errors, longCode, { contactIndex });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value };
}

export function validatePreset(preset, options = {}) {
  const errors = [];
  const presetIndex = options.presetIndex;
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    fail(errors, "invalid-type", { presetIndex });
    return { ok: false, errors };
  }
  if (typeof preset.id !== "string" || !ID_PATTERN.test(preset.id)) {
    fail(errors, "invalid-id", { presetIndex });
  }
  let presetName = "";
  if (typeof preset.name !== "string") fail(errors, "invalid-type", { presetIndex });
  else {
    presetName = cleanText(preset.name);
    if (!presetName) fail(errors, "empty-preset-name", { presetIndex });
    else if (charLength(presetName) > LIMITS.presetName) {
      fail(errors, "preset-name-too-long", { presetIndex });
    }
  }
  if (
    presetName &&
    options.takenNames instanceof Set &&
    options.takenNames.has(normalizeName(presetName))
  ) {
    fail(errors, "duplicate-preset-name", { presetIndex });
  }
  const contacts = [];
  const seenNames = new Set();
  const seenIds = new Set();
  if (!Array.isArray(preset.contacts)) fail(errors, "invalid-type", { presetIndex });
  else if (preset.contacts.length > LIMITS.contacts) {
    fail(errors, "too-many-contacts", { presetIndex });
  } else if (preset.contacts.length < 1) fail(errors, "no-contacts", { presetIndex });
  else {
    preset.contacts.forEach((contact, contactIndex) => {
      const result = validateContact(contact, contactIndex);
      if (!result.ok) {
        result.errors.forEach((error) => errors.push({ ...error, presetIndex }));
        return;
      }
      const nameKey = normalizeName(result.value.name);
      if (seenNames.has(nameKey)) fail(errors, "duplicate-name", { presetIndex, contactIndex });
      else seenNames.add(nameKey);
      if (seenIds.has(result.value.id)) fail(errors, "duplicate-id", { presetIndex, contactIndex });
      else seenIds.add(result.value.id);
      contacts.push(result.value);
    });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { id: preset.id, name: presetName, contacts } };
}

export function validateLibrary(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: [{ code: "invalid-type" }] };
  }
  if (input.version !== 1) return { ok: false, errors: [{ code: "bad-version" }] };
  if (!Array.isArray(input.presets)) return { ok: false, errors: [{ code: "invalid-type" }] };
  if (input.presets.length > LIMITS.presets) {
    return { ok: false, errors: [{ code: "too-many-presets" }] };
  }
  if (input.mode != null && input.mode !== "settings" && input.mode !== "performance") {
    return { ok: false, errors: [{ code: "invalid-mode" }] };
  }
  if (input.activePresetId != null && typeof input.activePresetId !== "string") {
    return { ok: false, errors: [{ code: "invalid-type" }] };
  }
  const errors = [];
  const presets = [];
  const takenNames = new Set();
  const presetIds = new Set();
  input.presets.forEach((preset, presetIndex) => {
    const result = validatePreset(preset, { presetIndex, takenNames });
    if (!result.ok) {
      errors.push(...result.errors);
      return;
    }
    if (presetIds.has(result.value.id)) errors.push({ code: "duplicate-id", presetIndex });
    else presetIds.add(result.value.id);
    takenNames.add(normalizeName(result.value.name));
    presets.push(result.value);
  });
  if (errors.length) return { ok: false, errors };
  let activePresetId = input.activePresetId ?? null;
  if (activePresetId && !presets.some((preset) => preset.id === activePresetId)) {
    activePresetId = null;
  }
  let mode = input.mode === "performance" ? "performance" : "settings";
  if (mode === "performance" && !activePresetId) mode = "settings";
  return {
    ok: true,
    value: { version: 1, mode, activePresetId, presets },
  };
}

export function parseLibraryJson(text) {
  if (typeof text !== "string") return { ok: false, errors: [{ code: "invalid-json" }] };
  if (text.length > LIMITS.backupChars) return { ok: false, errors: [{ code: "too-large" }] };
  try {
    return validateLibrary(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch {
    return { ok: false, errors: [{ code: "invalid-json" }] };
  }
}

export function createSampleLibrary() {
  return {
    version: 1,
    mode: "settings",
    activePresetId: null,
    presets: [
      {
        id: "sample-preset",
        name: "연습용 가상 목록",
        contacts: [
          {
            id: "sample-1",
            name: "별빛 하나",
            phone: "010-0000-1111",
            birthday: "13월 40일",
            address: "가상시 연습구 1번길",
            note: "실존하지 않는 예시",
          },
          {
            id: "sample-2",
            name: "구름 둘",
            phone: "010-0000-2222",
            birthday: "2월 31일",
            address: "없음동 허구로 2",
            note: "",
          },
          {
            id: "sample-3",
            name: "이슬 셋",
            phone: "",
            birthday: "",
            address: "이야기읍 샘플리",
            note: "번호 없는 가상 인물",
          },
        ],
      },
    ],
  };
}
