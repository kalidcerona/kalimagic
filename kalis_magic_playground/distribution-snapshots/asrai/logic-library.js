// Preset library ids, validation, JSON backup, and the sample library.

import { LIMITS, charLength } from "./logic-limits.js";
import { normalizeName } from "./logic-search.js";

function cleanText(value) {
  return String(value).normalize("NFC").trim().replace(/\s+/g, " ");
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

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
