import { STORAGE_KEY, parseStoredState, serializeState } from './logic.js';
import { NOTICE_KEY, OBJECT_KIND_KEY, OBJECT_KIND_CLASS, coinEl, recoveryEl, note, objectKindInput } from './dom.js';

let state = null;
let recovery = null;
let recoveryWriteBlocked = false;
let dismissedToken = '';
let storageWarning = '';
function selected() {
  return state.presets.find((preset) => preset.id === state.selectedId) || state.presets[0];
}

function replaceSelected(preset) {
  const index = state.presets.findIndex((item) => item.id === preset.id);
  if (index >= 0) state.presets[index] = preset;
}

function noticeToken(item) {
  const preserved = typeof item?.preserved === 'string' ? item.preserved : '';
  let hash = 0;
  for (let index = 0; index < preserved.length; index += 1) {
    hash = (hash * 31 + preserved.charCodeAt(index)) | 0;
  }
  return `${item?.reason || 'unknown'}:${preserved.length}:${hash}`;
}

const STATE_OWNED_KEYS = new Set(['version', 'selectedId', 'mode', 'presets']);
const PRESET_OWNED_KEYS = new Set(['id', 'name', 'coinSize', 'startX', 'startY', 'exitEdge', 'fadeDistance', 'disappearDuration']);
let storedStateExtras = null;
let objectKindBlocked = false;

function rememberStateExtras(raw) {
  storedStateExtras = { root: {}, presets: {} };
  if (typeof raw !== 'string' || !raw) return;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    storedStateExtras = null;
    return;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    storedStateExtras = null;
    return;
  }
  for (const [key, value] of Object.entries(data)) {
    if (!STATE_OWNED_KEYS.has(key)) storedStateExtras.root[key] = value;
  }
  if (!Array.isArray(data.presets)) return;
  for (const preset of data.presets) {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset) || typeof preset.id !== 'string') continue;
    const extra = {};
    for (const [key, value] of Object.entries(preset)) {
      if (!PRESET_OWNED_KEYS.has(key)) extra[key] = value;
    }
    if (Object.keys(extra).length) storedStateExtras.presets[preset.id] = extra;
  }
}

function configurationPayload() {
  const next = JSON.parse(serializeState(state));
  if (!storedStateExtras) return JSON.stringify(next);
  return JSON.stringify({
    ...storedStateExtras.root,
    version: next.version,
    selectedId: next.selectedId,
    mode: next.mode,
    presets: next.presets.map((preset) => ({
      ...(storedStateExtras.presets[preset.id] || {}),
      ...preset,
    })),
  });
}

function persist() {
  // Never replace an unreadable original with the in-memory fallback.
  if (recoveryWriteBlocked) {
    storageWarning = '저장된 설정을 읽지 못해 변경을 덮어쓰지 않았습니다. 이번 실행의 변경은 화면에만 있습니다.';
    note.textContent = storageWarning;
    renderRecovery();
    return false;
  }
  try {
    const raw = configurationPayload();
    localStorage.setItem(STORAGE_KEY, raw);
    rememberStateExtras(raw);
    return true;
  } catch {
    storageWarning = '이 브라우저 저장소를 쓸 수 없어 변경이 기기에 남지 않습니다.';
    note.textContent = storageWarning;
    return false;
  }
}

function normalizeObjectKind(value) {
  return Object.hasOwn(OBJECT_KIND_CLASS, value) ? value : 'coin';
}

function readObjectKind() {
  try {
    return normalizeObjectKind(localStorage.getItem(OBJECT_KIND_KEY));
  } catch {
    objectKindBlocked = true;
    storageWarning = storageWarning || '물건 종류 설정을 읽지 못했습니다. 기존 기록은 덮어쓰지 않습니다.';
    return 'coin';
  }
}

function applyObjectKind(kind) {
  const safe = normalizeObjectKind(kind);
  for (const className of Object.values(OBJECT_KIND_CLASS)) coinEl.classList.remove(className);
  coinEl.classList.add(OBJECT_KIND_CLASS[safe]);
  if (objectKindInput) objectKindInput.value = safe;
  return safe;
}

function persistObjectKind(kind) {
  if (objectKindBlocked) {
    storageWarning = '물건 종류 설정을 읽지 못해 저장하지 않았습니다. 기존 기록은 그대로입니다.';
    note.textContent = storageWarning;
    return;
  }
  try {
    localStorage.setItem(OBJECT_KIND_KEY, kind);
  } catch {
    storageWarning = '이 브라우저 저장소를 쓸 수 없어 변경이 기기에 남지 않습니다.';
    note.textContent = storageWarning;
  }
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    dismissedToken = localStorage.getItem(NOTICE_KEY) || '';
  } catch {
    storageWarning = '저장소를 열 수 없습니다. 이번 실행의 변경은 보관되지 않습니다.';
    recoveryWriteBlocked = true;
    raw = null;
  }
  const parsed = parseStoredState(raw);
  state = parsed.state;
  recovery = parsed.recovery;
  if (recoveryWriteBlocked) return;
  if (parsed.recovery) {
    // Keep the original bytes. A playable fallback must not be written back.
    recoveryWriteBlocked = true;
    storageWarning = parsed.recovery.reason === 'partial'
      ? '일부 프리셋 기록을 읽지 못했습니다. 저장소의 원래 기록은 바꾸지 않았습니다.'
      : '저장된 설정을 읽지 못했습니다. 이번 실행은 기본 화면으로 열었고, 저장소의 원래 기록은 바꾸지 않았습니다.';
    return;
  }
  rememberStateExtras(typeof raw === 'string' ? raw : '');
}

function renderRecovery() {
  recoveryEl.replaceChildren();
  const token = recovery ? noticeToken(recovery) : '';
  if ((!recovery || token === dismissedToken) && !storageWarning) {
    recoveryEl.hidden = true;
    return;
  }
  recoveryEl.hidden = false;
  const text = document.createElement('p');
  if (storageWarning) text.textContent = storageWarning;
  else if (recovery.reason === 'partial') {
    text.textContent = '일부 프리셋은 형식이 맞지 않아 빼 두었습니다. 원래 기록은 이 기기에 그대로 보관했습니다.';
  } else {
    text.textContent = '저장된 설정을 읽지 못해 기본 프리셋으로 열었습니다. 원래 기록은 지우지 않고 이 기기에 보관했습니다.';
  }
  recoveryEl.append(text);
  if (!recovery || token === dismissedToken) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-quiet';
  button.textContent = '알림 닫기';
  button.addEventListener('click', () => {
    try {
      localStorage.setItem(NOTICE_KEY, token);
    } catch {
      // The banner can stay if dismissal cannot be stored.
    }
    dismissedToken = token;
    renderRecovery();
  });
  recoveryEl.append(button);
}

export {
  state, selected, replaceSelected, persist, readObjectKind, applyObjectKind, persistObjectKind,
  loadState, renderRecovery,
};
