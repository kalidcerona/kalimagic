// Performance UI for the local fictional contacts prototype.
// Visible name taps call resolveContactClick once. Settings use a two-finger
// downward swipe in viewport coordinates (clientX/clientY), not screenX/screenY.
// Single-finger scrolling and taps are left to the browser. No device contacts,
// network fetches, or the retired asrai.library.v1 key.

import {
  LIMITS,
  charLength,
  classifySettingsSwipe,
  createClickState,
  nameMatchesQuery,
  normalizeName,
  normalizePerformanceSettings,
  resetClickState,
  resolveContactClick,
} from "./logic.js";

const STORAGE_KEY = "asrai.prototype.v2";
const CLICK_SUPPRESS_MS = 500;
const STORAGE_FAIL = "저장하지 못했습니다. 기존 저장 값은 바꾸지 않았고, 이번 변경은 이 화면에만 남습니다.";

const settingsScreen = document.querySelector("#settings-screen");
const listScreen = document.querySelector("#contact-list-screen");
const detailScreen = document.querySelector("#contact-detail-screen");
const targetInput = document.querySelector("#target-click");
const phoneInput = document.querySelector("#fixed-phone");
const regionInput = document.querySelector("#fixed-region");
const noteInput = document.querySelector("#fixed-note");
const namesInput = document.querySelector("#contact-names");
const resetButton = document.querySelector("#reset-clicks");
const startButton = document.querySelector("#start-performance");
const statusNode = document.querySelector("#settings-status");
const contactList = document.querySelector("#contact-list");
const contactSearch = document.querySelector("#contact-search");
const detailName = document.querySelector("#detail-name");
const detailPhone = document.querySelector("#detail-phone");
const detailRegion = document.querySelector("#detail-region");
const detailNote = document.querySelector("#detail-note");
const backButton = document.querySelector("#back-list");

let clickState = createClickState();
let activeNames = [];
let visibleNames = [];
let currentSettings = normalizePerformanceSettings({ targetClick: LIMITS.defaultTargetClick });
let suppressClick = false;
let suppressTimer = 0;
let storageNote = "";

const pointers = new Map();
let peakPointers = 0;

function setStatus(message) {
  statusNode.textContent = message;
}

function canonicalText(value) {
  return String(value).replace(/\u0000/g, "").normalize("NFC").trim().replace(/\s+/g, " ");
}

function showScreen(screen) {
  settingsScreen.hidden = screen !== "settings";
  listScreen.hidden = screen !== "list";
  detailScreen.hidden = screen !== "detail";
}

function performanceOpen() {
  return settingsScreen.hidden;
}

function armClickSuppression() {
  suppressClick = true;
  window.clearTimeout(suppressTimer);
  suppressTimer = window.setTimeout(() => {
    suppressClick = false;
  }, CLICK_SUPPRESS_MS);
}

function currentPayload() {
  return {
    targetClick: currentSettings.targetClick,
    phone: currentSettings.phone,
    region: currentSettings.region,
    note: currentSettings.note,
    names: activeNames.slice(),
    clickCount: clickState.clickCount,
  };
}

function saveRecord(payload) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    storageNote = "";
    return true;
  } catch {
    return false;
  }
}

function storageFailureStatus() {
  setStatus(STORAGE_FAIL);
}

function applyRecord(record, resumeList) {
  activeNames = record.names.slice();
  clickState = { clickCount: record.clickCount };
  currentSettings = normalizePerformanceSettings({
    targetClick: record.targetClick,
    phone: record.phone,
    region: record.region,
    note: record.note,
  });
  targetInput.value = String(currentSettings.targetClick);
  phoneInput.value = currentSettings.phone;
  regionInput.value = currentSettings.region;
  noteInput.value = currentSettings.note;
  namesInput.value = activeNames.join("\n");
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
    storageNote = "unreadable";
    setStatus("저장소를 읽지 못했습니다. 기존 값은 바꾸지 않았습니다.");
    return;
  }
  if (raw == null || raw === "") return;
  const record = parseStored(raw);
  if (!record) {
    storageNote = "invalid";
    setStatus("저장된 기록을 읽지 못했습니다. 기존 저장 값은 지우지 않았습니다.");
    return;
  }
  applyRecord(record, true);
  setStatus(`이전 기록을 불러왔습니다. 열람 횟수는 ${record.clickCount}입니다.`);
}

function renderList() {
  const query = contactSearch.value;
  visibleNames = activeNames.filter((name) => nameMatchesQuery(name, query));
  const fragment = document.createDocumentFragment();
  if (visibleNames.length === 0) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.textContent = canonicalText(query) ? "해당하는 이름이 없습니다." : "표시할 이름이 없습니다.";
    item.append(button);
    fragment.append(item);
  } else {
    visibleNames.forEach((name, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = String(index);
      button.textContent = name;
      item.append(button);
      fragment.append(item);
    });
  }
  contactList.replaceChildren(fragment);
}

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
  targetInput.value = String(currentSettings.targetClick);
  phoneInput.value = currentSettings.phone;
  regionInput.value = currentSettings.region;
  noteInput.value = currentSettings.note;
  namesInput.value = activeNames.join("\n");
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
  activeNames = parsedNames.names;
  currentSettings = normalizePerformanceSettings({
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
      `${duplicateNote}이름 ${activeNames.length}개로 시작합니다. 고정 상세는 ${currentSettings.targetClick}번째이고, 열람 횟수는 ${clickState.clickCount}입니다.`,
    );
  }
  showScreen("list");
}

function resetClicks() {
  clickState = resetClickState(clickState);
  if (activeNames.length === 0) {
    if (storageNote === "invalid") {
      setStatus("열람 횟수는 이 화면에서만 초기화했습니다. 읽지 못한 기존 저장 값은 지우지 않았습니다.");
    } else if (storageNote === "unreadable") {
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

function openContact(name) {
  const result = resolveContactClick(clickState, {
    selectedName: name,
    settings: currentSettings,
    seed: Math.floor(Math.random() * 0xffffffff),
  });
  clickState = result.state;
  const opening = result.opening;
  detailName.textContent = opening.name;
  detailPhone.textContent = opening.phone;
  detailRegion.textContent = opening.region;
  detailNote.textContent = opening.note;
  showScreen("detail");
  if (!saveRecord(currentPayload())) {
    storageFailureStatus();
    return;
  }
  if (statusNode.textContent === STORAGE_FAIL) setStatus("");
}

function onListClick(event) {
  const button = event.target instanceof Element ? event.target.closest("button") : null;
  if (!button || !contactList.contains(button) || button.disabled) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= visibleNames.length) return;
  openContact(visibleNames[index]);
}

function openSettings() {
  if (!performanceOpen()) return;
  armClickSuppression();
  showScreen("settings");
  if (statusNode.textContent === STORAGE_FAIL) return;
  setStatus(`열람 횟수는 ${clickState.clickCount}입니다.`);
}

function swipeFingers() {
  const fingers = [];
  for (const point of pointers.values()) {
    fingers.push({ dx: point.x - point.x0, dy: point.y - point.y0 });
  }
  return fingers;
}

function onPointerDown(event) {
  if (!performanceOpen()) return;
  if (event.pointerType === "mouse") return;
  pointers.set(event.pointerId, {
    x0: event.clientX,
    y0: event.clientY,
    x: event.clientX,
    y: event.clientY,
  });
  peakPointers = Math.max(peakPointers, pointers.size);
}

function onPointerMove(event) {
  const point = pointers.get(event.pointerId);
  if (!point || !performanceOpen()) return;
  point.x = event.clientX;
  point.y = event.clientY;
  if (pointers.size !== 2) return;
  const fingers = swipeFingers();
  const downward = fingers.every((finger) => finger.dy > 0 && Math.abs(finger.dx) <= finger.dy);
  if (downward && event.cancelable) event.preventDefault();
  if (classifySettingsSwipe(fingers).type === "open-settings") openSettings();
}

function onPointerEnd(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (pointers.size > 0) return;
  if (peakPointers >= 2) armClickSuppression();
  peakPointers = 0;
}

function onKeyDown(event) {
  if (event.key !== "Escape" || !event.shiftKey) return;
  if (!performanceOpen()) return;
  event.preventDefault();
  openSettings();
}

function onSwallowClick(event) {
  if (!suppressClick) return;
  suppressClick = false;
  window.clearTimeout(suppressTimer);
  event.preventDefault();
  event.stopPropagation();
}

function registerShell() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  try {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Registration can fail offline or when workers are blocked. The page still runs.
    });
  } catch {
    // Older browsers can throw instead of rejecting.
  }
}

document.addEventListener("click", onSwallowClick, true);
document.addEventListener("keydown", onKeyDown);
document.addEventListener("pointerdown", onPointerDown);
document.addEventListener("pointermove", onPointerMove, { passive: false });
document.addEventListener("pointerup", onPointerEnd);
document.addEventListener("pointercancel", onPointerEnd);
contactList.addEventListener("click", onListClick);
contactSearch.addEventListener("input", () => {
  renderList();
});
backButton.addEventListener("click", () => {
  showScreen("list");
});
resetButton.addEventListener("click", resetClicks);
startButton.addEventListener("click", startPerformance);

loadRecord();
registerShell();
