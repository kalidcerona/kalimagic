// Settings form reading, performance start, and click reset.

import {
  LIMITS,
  charLength,
  normalizeName,
  normalizePerformanceSettings,
  resetClickState,
} from "./logic.js";
import {
  session,
  targetInput,
  phoneInput,
  regionInput,
  noteInput,
  namesInput,
  contactSearch,
} from "./contacts-state.js";
import { setStatus, showScreen } from "./contacts-screen.js";
import {
  canonicalText,
  currentPayload,
  saveRecord,
  storageFailureStatus,
} from "./contacts-storage.js";
import { renderList } from "./contacts-list.js";
import { showGestureGuideOnce } from "./contacts-gestures.js";

function readTarget() {
  const trimmed = String(targetInput.value).trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const targetClick = Number(trimmed);
  if (!Number.isInteger(targetClick) || targetClick < LIMITS.targetClickMin || targetClick > LIMITS.targetClickMax) {
    return null;
  }
  return targetClick;
}

function readFixedField(input, max, message) {
  const value = canonicalText(input.value);
  if (charLength(value) > max) return { ok: false, message };
  return { ok: true, value };
}

function readNames() {
  const names = [];
  const seen = new Set();
  let duplicates = 0;
  const lines = String(namesInput.value).split(/\r?\n/);
  for (const line of lines) {
    const name = canonicalText(line);
    if (!name) continue;
    if (charLength(name) > LIMITS.contactName) {
      return { ok: false, message: `이름은 한 줄에 ${LIMITS.contactName}자까지입니다.` };
    }
    const key = normalizeName(name);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  if (names.length < 1) {
    return { ok: false, message: "이름을 한 줄에 하나 이상 적어 주세요." };
  }
  if (names.length > LIMITS.contacts) {
    return { ok: false, message: `이름은 ${LIMITS.contacts}개까지입니다. 지금은 ${names.length}개입니다.` };
  }
  return { ok: true, names, duplicates };
}

function fillSettingsForm() {
  targetInput.value = String(session.currentSettings.targetClick);
  phoneInput.value = session.currentSettings.phone;
  regionInput.value = session.currentSettings.region;
  noteInput.value = session.currentSettings.note;
  namesInput.value = session.activeNames.join("\n");
}

function startPerformance() {
  const targetClick = readTarget();
  if (targetClick == null) {
    setStatus("고정으로 보여줄 횟수는 1부터 20까지의 정수입니다.");
    return;
  }
  const phone = readFixedField(phoneInput, LIMITS.phone, `고정 전화번호는 ${LIMITS.phone}자까지입니다.`);
  if (!phone.ok) {
    setStatus(phone.message);
    return;
  }
  const region = readFixedField(regionInput, LIMITS.region, `고정 지역은 ${LIMITS.region}자까지입니다.`);
  if (!region.ok) {
    setStatus(region.message);
    return;
  }
  const note = readFixedField(noteInput, LIMITS.note, `고정 메모는 ${LIMITS.note}자까지입니다.`);
  if (!note.ok) {
    setStatus(note.message);
    return;
  }
  const parsedNames = readNames();
  if (!parsedNames.ok) {
    setStatus(parsedNames.message);
    return;
  }
  session.activeNames = parsedNames.names;
  session.currentSettings = normalizePerformanceSettings({
    targetClick,
    phone: phone.value,
    region: region.value,
    note: note.value,
  });
  fillSettingsForm();
  contactSearch.value = "";
  renderList();
  const saved = saveRecord(currentPayload());
  const duplicateNote = parsedNames.duplicates > 0 ? `중복 ${parsedNames.duplicates}개를 뺐습니다. ` : "";
  if (!saved) {
    storageFailureStatus();
  } else {
    setStatus(
      `${duplicateNote}이름 ${session.activeNames.length}개로 시작합니다. 고정 상세는 ${session.currentSettings.targetClick}번째이고, 열람 횟수는 ${session.clickState.clickCount}입니다.`,
    );
  }
  showScreen("list");
  showGestureGuideOnce();
}

function resetClicks() {
  session.clickState = resetClickState(session.clickState);
  if (session.activeNames.length === 0) {
    if (session.storageNote === "invalid") {
      setStatus("열람 횟수는 이 화면에서만 초기화했습니다. 읽지 못한 기존 저장 값은 지우지 않았습니다.");
    } else if (session.storageNote === "unreadable") {
      setStatus("열람 횟수는 이 화면에서만 초기화했습니다. 저장소를 읽지 못했습니다.");
    } else {
      setStatus("열람 횟수를 초기화했습니다.");
    }
    return;
  }
  if (!saveRecord(currentPayload())) {
    setStatus("열람 횟수는 이 화면에서만 초기화했습니다. 저장하지 못했습니다.");
    return;
  }
  setStatus("열람 횟수를 초기화했습니다.");
}

export { resetClicks, startPerformance };
