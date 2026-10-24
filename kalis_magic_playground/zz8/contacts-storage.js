// Local performance record parse, load, and save.

import {
  LIMITS,
  charLength,
  normalizeName,
  normalizePerformanceSettings,
} from "./logic.js";
import {
  STORAGE_KEY,
  STORAGE_FAIL,
  session,
  targetInput,
  phoneInput,
  regionInput,
  noteInput,
  namesInput,
  contactSearch,
} from "./contacts-state.js";
import { setStatus, showScreen } from "./contacts-screen.js";
import { renderList } from "./contacts-list.js";

function canonicalText(value) {
  return String(value).replace(/\u0000/g, "").normalize("NFC").trim().replace(/\s+/g, " ");
}

function currentPayload() {
  return {
    targetClick: session.currentSettings.targetClick,
    phone: session.currentSettings.phone,
    region: session.currentSettings.region,
    note: session.currentSettings.note,
    names: session.activeNames.slice(),
    clickCount: session.clickState.clickCount,
  };
}

function saveRecord(payload) {
  // Preserve unreadable original records while the fallback performance runs.
  if (session.storageNote === "invalid" || session.storageNote === "unreadable") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    session.storageNote = "";
    return true;
  } catch {
    return false;
  }
}

function storageFailureStatus() {
  setStatus(STORAGE_FAIL);
}

function applyRecord(record, resumeList) {
  session.activeNames = record.names.slice();
  session.clickState = { clickCount: record.clickCount };
  session.currentSettings = normalizePerformanceSettings({
    targetClick: record.targetClick,
    phone: record.phone,
    region: record.region,
    note: record.note,
  });
  targetInput.value = String(session.currentSettings.targetClick);
  phoneInput.value = session.currentSettings.phone;
  regionInput.value = session.currentSettings.region;
  noteInput.value = session.currentSettings.note;
  namesInput.value = session.activeNames.join("\n");
  contactSearch.value = "";
  renderList();
  if (resumeList) showScreen("list");
}

function parseStored(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (!Array.isArray(data.names) || data.names.length < 1 || data.names.length > LIMITS.contacts) {
    return null;
  }
  const names = [];
  const seen = new Set();
  for (const item of data.names) {
    if (typeof item !== "string") return null;
    const name = canonicalText(item);
    if (!name || name !== item || charLength(name) > LIMITS.contactName) return null;
    const key = normalizeName(name);
    if (seen.has(key)) return null;
    seen.add(key);
    names.push(name);
  }
  const clickCount = data.clickCount;
  const targetClick = data.targetClick;
  if (!Number.isInteger(clickCount) || clickCount < 0 || clickCount > LIMITS.maxClickCount) return null;
  if (!Number.isInteger(targetClick) || targetClick < LIMITS.targetClickMin || targetClick > LIMITS.targetClickMax) {
    return null;
  }
  if (typeof data.phone !== "string" || typeof data.region !== "string" || typeof data.note !== "string") {
    return null;
  }
  const phone = canonicalText(data.phone);
  const region = canonicalText(data.region);
  const note = canonicalText(data.note);
  if (phone !== data.phone || region !== data.region || note !== data.note) return null;
  if (charLength(phone) > LIMITS.phone || charLength(region) > LIMITS.region || charLength(note) > LIMITS.note) {
    return null;
  }
  return { names, clickCount, targetClick, phone, region, note };
}

function loadRecord() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    session.storageNote = "unreadable";
    setStatus("저장소를 읽지 못했습니다. 기존 값은 바꾸지 않았습니다.");
    return;
  }
  if (raw == null || raw === "") return;
  const record = parseStored(raw);
  if (!record) {
    session.storageNote = "invalid";
    setStatus("저장된 기록을 읽지 못했습니다. 기존 저장 값은 지우지 않았습니다.");
    return;
  }
  applyRecord(record, true);
  setStatus(`이전 기록을 불러왔습니다. 열람 횟수는 ${record.clickCount}입니다.`);
}

export {
  canonicalText,
  currentPayload,
  saveRecord,
  storageFailureStatus,
  applyRecord,
  loadRecord,
};
