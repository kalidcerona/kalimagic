// ALETHEIA settings, local storage, and performance surface.
import {
  ERASED_ALPHA_MAX,
  LIMITS,
  MESSAGES,
  MODE_HINTS,
  MODE_LABELS,
  TITLES,
  VEIL_COLOR,
  activeStageIndex,
  allowsRevealStroke,
  brushDiameterInMask,
  brushSpacing,
  canAddPreset,
  cardAtIndex,
  classifyGesture,
  containRect,
  createId,
  emptyMeta,
  emptyPhotoSets,
  gradualStartAlpha,
  initialFreeClearRect,
  initialStageRatios,
  interpolatePoints,
  mapPointerToCell,
  mapPointerToMask,
  maskDimensions,
  normalizeCoverage,
  parseMeta,
  parsePhotoSets,
  salvageMeta,
  stageBands,
  stampAlpha,
  validateImage,
  validatePresetInput,
} from './logic.js';
import { createDeckSlots } from './deck-loader.js';

const STORAGE_KEY = 'aletheia.distribution.meta.v1';
const CUSTOM_KEY = 'aletheia.distribution.custom12.v1';
const PHOTO_SETS_KEY = 'aletheia.distribution.photoSets.v2';
const PHOTO_SET_COUNT = 3;
const CELL_GUIDE_KEY = 'aletheia.distribution.cellGuide.v1';
const COVERAGE_KEY = 'aletheia.distribution.coverage.v1';
const CELL_GUIDE_HOLD_MS = 800;
const CELL_GUIDE_FADE_MS = 200;
const CUSTOM_COUNT = 12;
const DB_NAME = 'aletheia-distribution';
const DB_STORE = 'images';
const IMAGE_ID_RE = /^img_[A-Za-z0-9_-]{1,44}$/;
const SUIT_CODE = Object.freeze({
  spade: 'S',
  diamond: 'D',
  club: 'C',
  heart: 'H',
});

const settings = document.querySelector('#settings');
const stage = document.querySelector('#stage');
const canvas = document.querySelector('#stage-canvas');
const theme = document.querySelector('meta[name="theme-color"]');
const repair = document.querySelector('#repair');
const errorBox = document.querySelector('#error');
const statusBox = document.querySelector('#status');
const presetList = document.querySelector('#preset-list');
const emptyHint = document.querySelector('#empty-hint');
const startButton = document.querySelector('#start-button');
const cardStartButton = document.querySelector('#card-start-button');
const customSlotsRoot = document.querySelector('#custom-slots');
const customStartButtons = [];
const customReadyHints = [];
const customRepair = document.querySelector('#custom-repair');
const editorForm = document.querySelector('#editor');
const editorFields = document.querySelector('#editor-fields');
const legend = document.querySelector('#editor-legend');
const nameInput = document.querySelector('#preset-name');
const fileInput = document.querySelector('#preset-file');
const fileStatus = document.querySelector('#file-status');
const preview = document.querySelector('#file-preview');
const modeInput = document.querySelector('#preset-mode');
const modeHint = document.querySelector('#mode-hint');
const brushInput = document.querySelector('#preset-brush');
const brushReadout = document.querySelector('#brush-readout');
const hiddenEnable = document.querySelector('#hidden-enable');
const hiddenInput = document.querySelector('#preset-hidden');
const hiddenReadout = document.querySelector('#hidden-readout');
const saveButton = document.querySelector('#save-button');
const cancelEdit = document.querySelector('#cancel-edit');
const recoverButton = document.querySelector('#recover-button');
const resetStorageButton = document.querySelector('#reset-storage-button');
const cellGuideInput = document.querySelector('#cell-guide-enable');
const cellGuide = document.querySelector('#cell-guide');
const coverageInput = document.querySelector('#coverage-size');
const coverageReadout = document.querySelector('#coverage-readout');

let meta = emptyMeta();
let view = 'settings';
let corrupt = false;
let storageLocked = false;
let busy = false;
let formMode = 'create';
let editingId = null;
let armDeleteId = null;
let resetArmed = false;
let blockPointerUntil = 0;
let previewUrl = null;
let dbPromise = null;
let customIds = emptyPhotoSets().flat();
let customCorrupt = false;
const customSlots = [];
const customPendingFiles = Array.from({ length: CUSTOM_COUNT * PHOTO_SET_COUNT }, () => null);
const customPendingUrls = Array.from({ length: CUSTOM_COUNT * PHOTO_SET_COUNT }, () => null);
const customStoredUrls = Array.from({ length: CUSTOM_COUNT * PHOTO_SET_COUNT }, () => null);
let running = null;
let lastStageSample = 0;
let cellGuideEnabled = false;
let coverageSize = LIMITS.defaultCoverage;
let cellGuideToken = 0;
let cellGuideTimer = 0;
let cellGuideFadeTimer = 0;
const contacts = new Map();
const liveUrls = new Set();
let multiTouchGroup = false;
let gestureResolved = null;

function setError(message) {
  statusBox.hidden = true;
  statusBox.textContent = '';
  if (!message) {
    errorBox.hidden = true;
    errorBox.textContent = '';
    return;
  }
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function setStatus(message) {
  errorBox.hidden = true;
  errorBox.textContent = '';
  if (!message) {
    statusBox.hidden = true;
    statusBox.textContent = '';
    return;
  }
  statusBox.hidden = false;
  statusBox.textContent = message;
}

function revokeUrl(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  liveUrls.delete(url);
}

function revokeAllUrls() {
  for (const url of liveUrls) URL.revokeObjectURL(url);
  liveUrls.clear();
  previewUrl = null;
}

function syncControls() {
  const locked = storageLocked || corrupt || busy;
  editorFields.disabled = locked;
  startButton.disabled = locked || !meta.selectedId;
  if (cardStartButton) cardStartButton.disabled = busy;
  syncCustomControls();
  recoverButton.disabled = busy || storageLocked;
  resetStorageButton.disabled = busy || storageLocked;
  if (cellGuideInput) cellGuideInput.disabled = busy || storageLocked;
  if (coverageInput) coverageInput.disabled = busy || storageLocked;
  emptyHint.hidden = corrupt || meta.presets.length > 0;
}

function commitMeta(next, options = {}) {
  if (storageLocked) {
    setError(MESSAGES.storageReadFailed);
    return false;
  }
  if (corrupt && !options.replaceStored) {
    setError(MESSAGES.metaCorrupt);
    return false;
  }
  let raw;
  try {
    raw = JSON.stringify(next);
  } catch {
    setError(MESSAGES.storageFailed);
    return false;
  }
  if (!parseMeta(raw).ok) {
    setError(MESSAGES.storageFailed);
    return false;
  }
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, raw);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!parseMeta(stored).ok) {
      if (previous == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      setError(MESSAGES.storageFailed);
      return false;
    }
  } catch {
    setError(MESSAGES.storageFailed);
    return false;
  }
  meta = parseMeta(raw).meta;
  return true;
}

function setIds(setIndex) {
  return customIds.slice(setIndex * CUSTOM_COUNT, (setIndex + 1) * CUSTOM_COUNT);
}

function commitCustom(ids) {
  if (storageLocked || customCorrupt || !Array.isArray(ids) || ids.length !== CUSTOM_COUNT * PHOTO_SET_COUNT) {
    setError('내 사진 세트를 저장하지 못했습니다. 기존 사진은 바꾸지 않았습니다.');
    return false;
  }
  const sets = Array.from({ length: PHOTO_SET_COUNT }, (_, index) => ids.slice(index * CUSTOM_COUNT, (index + 1) * CUSTOM_COUNT));
  const raw = JSON.stringify({ version: 2, sets });
  if (!parsePhotoSets(raw).ok) {
    setError('내 사진 세트를 저장하지 못했습니다. 기존 사진은 바꾸지 않았습니다.');
    return false;
  }
  let previous;
  try {
    previous = localStorage.getItem(PHOTO_SETS_KEY);
    localStorage.setItem(PHOTO_SETS_KEY, raw);
    if (localStorage.getItem(PHOTO_SETS_KEY) !== raw) throw new Error('verify');
  } catch {
    try {
      if (previous === null) localStorage.removeItem(PHOTO_SETS_KEY);
      else if (previous !== undefined) localStorage.setItem(PHOTO_SETS_KEY, previous);
    } catch { /* Preserve legacy and IndexedDB data. */ }
    setError('내 사진 세트를 저장하지 못했습니다. 기존 사진은 바꾸지 않았습니다.');
    return false;
  }
  customIds = ids.slice();
  return true;
}

function customDeckReady(setIndex) {
  return !customCorrupt && setIds(setIndex).every((id) => typeof id === 'string' && id);
}

function syncCustomControls() {
  for (let setIndex = 0; setIndex < PHOTO_SET_COUNT; setIndex += 1) {
    const ready = customDeckReady(setIndex);
    const button = customStartButtons[setIndex];
    const hint = customReadyHints[setIndex];
    if (button) button.disabled = busy || storageLocked || !ready;
    if (hint) {
      const filled = setIds(setIndex).filter(Boolean).length;
      hint.textContent = customCorrupt
        ? '저장된 사진 정보를 해석할 수 없습니다. 원본 데이터는 유지됩니다.'
        : ready ? '12장이 준비되었습니다.' : `사진 ${filled}/12장 저장됨 · 12장이 모두 있어야 연출할 수 있습니다.`;
    }
  }
  const slotLocked = busy || storageLocked || customCorrupt;
  for (const slot of customSlots) {
    slot.file.disabled = slotLocked;
    slot.button.disabled = slotLocked;
  }
  if (customRepair) customRepair.hidden = !customCorrupt;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('idb'));
    request.onblocked = () => reject(new Error('blocked'));
  });
}

function database() {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function finishTransaction(transaction) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error || new Error('idb'));
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    transaction.onabort = () => fail(transaction.error);
    transaction.onerror = () => fail(transaction.error);
  });
}

async function putImage(id, blob) {
  const db = await database();
  const transaction = db.transaction(DB_STORE, 'readwrite');
  transaction.objectStore(DB_STORE).put({ blob, savedAt: Date.now() }, id);
  await finishTransaction(transaction);
}

async function getImage(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, 'readonly');
    const request = transaction.objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('idb'));
  });
}

async function deleteImage(id) {
  const db = await database();
  const transaction = db.transaction(DB_STORE, 'readwrite');
  transaction.objectStore(DB_STORE).delete(id);
  await finishTransaction(transaction);
}

async function clearImages() {
  const db = await database();
  const transaction = db.transaction(DB_STORE, 'readwrite');
  transaction.objectStore(DB_STORE).clear();
  await finishTransaction(transaction);
}

function updateModeHint() {
  modeHint.textContent = MODE_HINTS[modeInput.value] || '';
}

function resetForm() {
  formMode = 'create';
  editingId = null;
  editorForm.reset();
  revokeUrl(previewUrl);
  previewUrl = null;
  preview.hidden = true;
  preview.removeAttribute('src');
  brushInput.value = String(LIMITS.defaultBrush);
  hiddenInput.value = '100';
  hiddenInput.disabled = true;
  hiddenEnable.checked = false;
  brushReadout.textContent = String(LIMITS.defaultBrush);
  hiddenReadout.textContent = '100';
  fileStatus.textContent = '선택된 파일 없음';
  legend.textContent = '새 프리셋';
  saveButton.textContent = '프리셋 저장';
  cancelEdit.hidden = true;
  updateModeHint();
}

function renderList() {
  presetList.replaceChildren();
  for (const item of meta.presets) {
    const selected = item.id === meta.selectedId;
    const card = document.createElement('article');
    card.className = selected ? 'preset selected' : 'preset';
    card.dataset.id = item.id;

    const name = document.createElement('h3');
    name.className = 'preset-name';
    name.textContent = item.name;

    const info = document.createElement('p');
    info.className = 'preset-meta';
    const hiddenLabel = item.hiddenPercent == null ? '가림 100%' : `가림 ${item.hiddenPercent}%`;
    info.textContent = `${MODE_LABELS[item.mode]} · ${hiddenLabel}`;

    const actions = document.createElement('div');
    actions.className = 'preset-actions';
    actions.append(
      actionButton(selected ? '선택됨' : '선택', 'select', selected),
      actionButton('수정', 'edit', false),
      actionButton(armDeleteId === item.id ? '정말 삭제' : '삭제', 'delete', false),
    );
    card.append(name, info, actions);
    presetList.append(card);
  }
  syncControls();
}

function actionButton(text, action, pressed) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = text;
  button.className = action === 'delete' ? 'danger' : 'secondary';
  if (action === 'select') button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  return button;
}

function selectPreset(id) {
  armDeleteId = null;
  if (storageLocked || corrupt) {
    setError(storageLocked ? MESSAGES.storageReadFailed : MESSAGES.metaCorrupt);
    renderList();
    return;
  }
  const item = meta.presets.find((preset) => preset.id === id);
  if (!item) return;
  if (meta.selectedId !== id) {
    const next = { version: 1, selectedId: id, presets: meta.presets.slice() };
    if (!commitMeta(next)) {
      renderList();
      return;
    }
  }
  setStatus(`선택했습니다: ${item.name}`);
  renderList();
}

function editPreset(id) {
  armDeleteId = null;
  const item = meta.presets.find((preset) => preset.id === id);
  if (!item || storageLocked || corrupt) return;
  resetForm();
  formMode = 'edit';
  editingId = id;
  nameInput.value = item.name;
  modeInput.value = item.mode;
  brushInput.value = String(item.brushSize);
  brushReadout.textContent = String(item.brushSize);
  if (item.hiddenPercent == null) {
    hiddenEnable.checked = false;
    hiddenInput.disabled = true;
    hiddenInput.value = '100';
  } else {
    hiddenEnable.checked = true;
    hiddenInput.disabled = false;
    hiddenInput.value = String(item.hiddenPercent);
  }
  hiddenReadout.textContent = hiddenInput.value;
  fileStatus.textContent = '현재 이미지가 저장되어 있습니다. 바꾸려면 새 파일을 고르세요.';
  legend.textContent = '프리셋 수정';
  saveButton.textContent = '수정 내용 저장';
  cancelEdit.hidden = false;
  updateModeHint();
  renderList();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  editorForm.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

async function commitDelete(id) {
  if (busy) return;
  const target = meta.presets.find((item) => item.id === id);
  if (!target) return;
  busy = true;
  syncControls();
  try {
    const presets = meta.presets.filter((item) => item.id !== id);
    const selectedId = meta.selectedId === id
      ? (presets[0] ? presets[0].id : null)
      : meta.selectedId;
    if (!commitMeta({ version: 1, selectedId, presets })) return;
    if (editingId === id) resetForm();
    try {
      await deleteImage(target.imageId);
      setStatus('프리셋을 삭제했습니다.');
    } catch {
      setError(MESSAGES.imageDeleteFailed);
    }
    renderList();
  } finally {
    busy = false;
    syncControls();
  }
}

function deletePreset(id) {
  if (storageLocked || corrupt) {
    setError(storageLocked ? MESSAGES.storageReadFailed : MESSAGES.metaCorrupt);
    return;
  }
  if (armDeleteId !== id) {
    armDeleteId = id;
    renderList();
    return;
  }
  armDeleteId = null;
  void commitDelete(id);
}

function onFileChange() {
  revokeUrl(previewUrl);
  previewUrl = null;
  preview.hidden = true;
  preview.removeAttribute('src');
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    fileStatus.textContent = editingId
      ? '현재 이미지가 저장되어 있습니다. 바꾸려면 새 파일을 고르세요.'
      : '선택된 파일 없음';
    return;
  }
  const checked = validateImage({ bytes: file.size, mime: file.type }, { required: true });
  if (!checked.ok) {
    fileInput.value = '';
    fileStatus.textContent = editingId
      ? '현재 이미지가 저장되어 있습니다. 바꾸려면 새 파일을 고르세요.'
      : '선택된 파일 없음';
    setError(checked.error);
    return;
  }
  previewUrl = URL.createObjectURL(file);
  liveUrls.add(previewUrl);
  preview.src = previewUrl;
  preview.hidden = false;
  fileStatus.textContent = `선택한 파일: ${file.name}`;
  setStatus('이미지를 확인했습니다. 저장하기 전에는 반영되지 않습니다.');
}

async function savePreset() {
  if (busy || storageLocked || corrupt) return;
  const editing = formMode === 'edit'
    ? meta.presets.find((item) => item.id === editingId)
    : null;
  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  const validated = validatePresetInput({
    name: nameInput.value,
    mode: modeInput.value,
    brushSize: brushInput.value,
    hiddenPercent: hiddenEnable.checked ? hiddenInput.value : null,
    hasImage: Boolean(file),
    imageBytes: file ? file.size : null,
    imageMime: file ? file.type : '',
    imageRequired: !editing,
  });
  if (!validated.ok) {
    setError(validated.error);
    return;
  }
  if (!editing && !canAddPreset(meta.presets.length)) {
    setError(MESSAGES.tooManyPresets);
    return;
  }

  busy = true;
  syncControls();
  let wroteNewImage = false;
  let imageId = editing ? editing.imageId : null;
  let imageMime = editing ? editing.imageMime : null;
  const previousImageId = editing ? editing.imageId : null;
  try {
    if (file) {
      let buffer;
      try {
        buffer = await file.arrayBuffer();
      } catch {
        setError(MESSAGES.imageStoreFailed);
        return;
      }
      if (buffer.byteLength <= 0) {
        setError(MESSAGES.imageEmpty);
        return;
      }
      if (buffer.byteLength > LIMITS.maxImageBytes) {
        setError(MESSAGES.imageTooLarge);
        return;
      }
      const blob = new Blob([buffer], { type: validated.value.image.mime });
      imageId = createId('img');
      imageMime = validated.value.image.mime;
      try {
        await putImage(imageId, blob);
        wroteNewImage = true;
      } catch {
        setError(MESSAGES.imageStoreFailed);
        return;
      }
    }
    if (!imageId || !imageMime) {
      setError(MESSAGES.imageRequired);
      return;
    }
    const preset = {
      id: editing ? editing.id : createId('p'),
      name: validated.value.name,
      mode: validated.value.mode,
      brushSize: validated.value.brushSize,
      hiddenPercent: validated.value.hiddenPercent,
      imageId,
      imageMime,
      updatedAt: Date.now(),
    };
    const presets = editing
      ? meta.presets.map((item) => (item.id === editing.id ? preset : item))
      : [...meta.presets, preset];
    if (!commitMeta({ version: 1, selectedId: preset.id, presets })) {
      if (wroteNewImage) {
        try { await deleteImage(imageId); } catch { /* previous metadata remains */ }
      }
      return;
    }
    if (wroteNewImage && previousImageId && previousImageId !== imageId) {
      try {
        await deleteImage(previousImageId);
      } catch {
        setStatus(MESSAGES.previousImageKept);
        resetForm();
        renderList();
        return;
      }
    }
    setStatus(MESSAGES.saved);
    resetForm();
    renderList();
  } finally {
    busy = false;
    syncControls();
  }
}

async function recoverStored() {
  if (storageLocked || busy) return;
  busy = true;
  syncControls();
  try {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      storageLocked = true;
      setError(MESSAGES.storageReadFailed);
      return;
    }
    const salvaged = salvageMeta(raw);
    if (!commitMeta(salvaged.meta, { replaceStored: true })) return;
    corrupt = false;
    repair.hidden = true;
    resetArmed = false;
    resetStorageButton.textContent = '초기화';
    resetForm();
    setStatus(`복구했습니다. 남긴 프리셋 ${salvaged.kept}개, 제외 ${salvaged.dropped}개. 제외된 이미지는 자동으로 지우지 않았습니다.`);
    renderList();
    try {
      await database();
    } catch {
      setError(`${MESSAGES.dbOpenFailed} 프리셋 목록은 복구된 상태입니다.`);
    }
  } finally {
    busy = false;
    syncControls();
  }
}

async function resetStored() {
  if (storageLocked || busy) return;
  busy = true;
  syncControls();
  try {
    const presetImageIds = meta.presets.map((item) => item.imageId);
    const keepCustomImages = customCorrupt || customIds.some((id) => typeof id === 'string' && id);
    if (!commitMeta(emptyMeta(), { replaceStored: true })) return;
    corrupt = false;
    repair.hidden = true;
    resetForm();
    try {
      if (!keepCustomImages) {
        await clearImages();
        setStatus('저장소를 초기화했습니다.');
      } else if (customCorrupt) {
        setStatus('프리셋 목록은 비웠습니다. 내 사진 정보를 해석할 수 없어 이미지 파일은 지우지 않았습니다.');
      } else {
        for (const id of presetImageIds) {
          if (!id || customIds.includes(id)) continue;
          await deleteImage(id);
        }
        setStatus('프리셋 목록을 초기화했습니다. 내 사진 12장은 그대로 두었습니다.');
      }
    } catch {
      setError(MESSAGES.resetImagesFailed);
    }
    renderList();
  } finally {
    busy = false;
    resetArmed = false;
    resetStorageButton.textContent = '초기화';
    syncControls();
  }
}

function decodeImage(blob) {
  const url = URL.createObjectURL(blob);
  liveUrls.add(url);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      revokeUrl(url);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('decode'));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      revokeUrl(url);
      reject(new Error('decode'));
    };
    image.src = url;
  });
}

const COURT_CARD_COUNT = 12;

// Local vector faces. currentColor is not used so the SVG paints without a stylesheet.
function suitShape(suit, ink) {
  if (suit === 'heart') {
    return `<path fill="${ink}" d="M50 92C18 66 2 50 2 32 2 16 14 6 28 6c10 0 16 6 22 14C56 12 62 6 72 6c14 0 26 10 26 26 0 18-16 34-48 60z"/>`;
  }
  if (suit === 'diamond') {
    return `<path fill="${ink}" d="M50 2 94 50 50 98 6 50Z"/>`;
  }
  if (suit === 'club') {
    return `<g fill="${ink}"><circle cx="50" cy="30" r="16"/><circle cx="30" cy="54" r="16"/><circle cx="70" cy="54" r="16"/><path d="M43 56h14l8 38H35z"/></g>`;
  }
  return `<g fill="${ink}"><path d="M50 2C50 2 10 36 10 60c0 16 12 26 26 22-2 8-8 16-8 16h36s-6-8-8-16c14 4 26-6 26-22C90 36 50 2 50 2z"/><path d="M42 76h16l8 22H34z"/></g>`;
}

function courtCardSvg(card) {
  const red = card.suit === 'heart' || card.suit === 'diamond';
  const ink = red ? '#C0392B' : '#141414';
  const shape = suitShape(card.suit, ink);
  const rank = card.rank;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1080" viewBox="0 0 720 1080">
  <rect width="720" height="1080" fill="#F7F1E6"/>
  <rect x="22" y="22" width="676" height="1036" rx="36" fill="#FFFCF7" stroke="${ink}" stroke-width="10"/>
  <text x="70" y="140" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="700">${rank}</text>
  <g transform="translate(44,156) scale(0.78)">${shape}</g>
  <g transform="translate(360,430) scale(3.15) translate(-50,-50)">${shape}</g>
  <text x="360" y="760" text-anchor="middle" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="210" font-weight="700">${rank}</text>
  <g transform="translate(720 1080) rotate(180)">
    <text x="70" y="140" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="700">${rank}</text>
    <g transform="translate(44,156) scale(0.78)">${shape}</g>
  </g>
</svg>`;
}

function loadSvgImage(svg) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  liveUrls.add(url);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        revokeUrl(url);
        reject(new Error('decode'));
        return;
      }
      resolve({ image, url });
    };
    image.onerror = () => {
      revokeUrl(url);
      reject(new Error('decode'));
    };
    image.src = url;
  });
}

async function loadVectorCourtDeck() {
  const images = [];
  const urls = [];
  try {
    for (let index = 0; index < COURT_CARD_COUNT; index += 1) {
      const card = cardAtIndex(index);
      if (!card) throw new Error('decode');
      const loaded = await loadSvgImage(courtCardSvg(card));
      images.push(loaded.image);
      urls.push(loaded.url);
    }
    return { images, urls };
  } catch (error) {
    for (const url of urls) revokeUrl(url);
    throw error;
  }
}

function createCourtDeckSlots() {
  const loaders = Array.from({ length: COURT_CARD_COUNT }, (_, index) => async () => {
    const card = cardAtIndex(index);
    if (!card) throw new Error('decode');
    try {
      return { image: await loadKeptImage(`./court-cards/${slotLabel(card)}.png`) };
    } catch {
      return loadSvgImage(courtCardSvg(card));
    }
  });
  return createDeckSlots(loaders, ({ image, url }) => {
    if (url) revokeUrl(url);
    if (image) image.src = '';
  });
}

let warmedCourtSlots = null;

function warmCourtDeck() {
  if (!warmedCourtSlots) warmedCourtSlots = createCourtDeckSlots();
}

function isCardPerformance() {
  return Boolean(running && running.cardMode);
}

function isCardSelectPhase() {
  return isCardPerformance() && running.cardPhase === 'select';
}

function viewportCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return mapPointerToCell(clientX, clientY, {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });
}

// Missing or unreadable values stay off. Other stored presets and photos are left untouched.
function parseCellGuideEnabled(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  return parsed.enabled === true;
}

function loadCellGuidePreference() {
  cellGuideEnabled = false;
  try {
    cellGuideEnabled = parseCellGuideEnabled(localStorage.getItem(CELL_GUIDE_KEY));
  } catch {
    cellGuideEnabled = false;
  }
  if (cellGuideInput) cellGuideInput.checked = cellGuideEnabled;
}

function loadCoveragePreference() {
  try {
    const raw = localStorage.getItem(COVERAGE_KEY);
    coverageSize = raw === null ? LIMITS.defaultCoverage : normalizeCoverage(JSON.parse(raw));
  } catch {
    coverageSize = LIMITS.defaultCoverage;
  }
  coverageInput.value = String(coverageSize);
  coverageReadout.textContent = `${coverageSize}px`;
}

function onCoverageChange() {
  if (coverageInput.disabled) return;
  const next = normalizeCoverage(coverageInput.value);
  try {
    const payload = JSON.stringify(next);
    localStorage.setItem(COVERAGE_KEY, payload);
    if (localStorage.getItem(COVERAGE_KEY) !== payload) throw new Error('verify');
  } catch {
    coverageInput.value = String(coverageSize);
    coverageReadout.textContent = `${coverageSize}px`;
    setError('지우개 범위를 저장하지 못했습니다. 이전 설정을 유지합니다.');
    return;
  }
  coverageSize = next;
  coverageReadout.textContent = `${next}px`;
}

function persistCellGuideEnabled(enabled) {
  const payload = JSON.stringify({ version: 1, enabled: Boolean(enabled) });
  const previous = localStorage.getItem(CELL_GUIDE_KEY);
  localStorage.setItem(CELL_GUIDE_KEY, payload);
  const stored = localStorage.getItem(CELL_GUIDE_KEY);
  if (stored !== payload) {
    if (previous == null) localStorage.removeItem(CELL_GUIDE_KEY);
    else localStorage.setItem(CELL_GUIDE_KEY, previous);
    throw new Error('verify');
  }
}

function onCellGuideChange() {
  if (!cellGuideInput || cellGuideInput.disabled) return;
  const next = cellGuideInput.checked === true;
  try {
    persistCellGuideEnabled(next);
  } catch {
    cellGuideInput.checked = cellGuideEnabled;
    setError('칸 번호 안내 설정을 저장하지 못했습니다. 기존 저장 내용은 바꾸지 않았습니다.');
    return;
  }
  cellGuideEnabled = next;
  setStatus(next
    ? '칸 번호 안내를 켰습니다. 12칸 공연을 시작할 때만 번호가 잠시 나타납니다.'
    : '칸 번호 안내를 껐습니다. 공연 화면에 번호가 나타나지 않습니다.');
}

function clearCellGuideTimers() {
  if (cellGuideTimer) {
    clearTimeout(cellGuideTimer);
    cellGuideTimer = 0;
  }
  if (cellGuideFadeTimer) {
    clearTimeout(cellGuideFadeTimer);
    cellGuideFadeTimer = 0;
  }
}

function hideCellGuide() {
  const pending = cellGuideTimer || cellGuideFadeTimer;
  const visible = Boolean(cellGuide && !cellGuide.hidden);
  const filled = Boolean(cellGuide && cellGuide.childElementCount > 0);
  if (!pending && !visible && !filled) return;
  cellGuideToken += 1;
  clearCellGuideTimers();
  if (!cellGuide) return;
  cellGuide.classList.remove('is-fading');
  cellGuide.hidden = true;
  cellGuide.setAttribute('aria-hidden', 'true');
  cellGuide.style.pointerEvents = 'none';
  cellGuide.replaceChildren();
}

function alignCellGuide() {
  if (!cellGuide || cellGuide.hidden) return;
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  if (canvasRect.width < 2 || canvasRect.height < 2) return;
  cellGuide.style.left = `${canvasRect.left - stageRect.left}px`;
  cellGuide.style.top = `${canvasRect.top - stageRect.top}px`;
  cellGuide.style.width = `${canvasRect.width}px`;
  cellGuide.style.height = `${canvasRect.height}px`;
}

function fillCellGuideLabels() {
  if (!cellGuide) return;
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= COURT_CARD_COUNT; number += 1) {
    const label = document.createElement('span');
    label.textContent = String(number);
    fragment.append(label);
  }
  cellGuide.replaceChildren(fragment);
}

// White 1-12 only, on the same canvas rectangle the 12-cell tap uses.
function showCellGuide() {
  if (!cellGuide || !cellGuideEnabled || !isCardPerformance()) return;
  cellGuideToken += 1;
  const token = cellGuideToken;
  clearCellGuideTimers();
  fillCellGuideLabels();
  cellGuide.classList.remove('is-fading');
  cellGuide.hidden = false;
  cellGuide.setAttribute('aria-hidden', 'true');
  cellGuide.style.pointerEvents = 'none';
  void cellGuide.offsetWidth;
  alignCellGuide();
  cellGuideTimer = window.setTimeout(() => {
    cellGuideTimer = 0;
    if (token !== cellGuideToken) return;
    if (!cellGuide || cellGuide.hidden || view !== 'performance' || !isCardPerformance()) return;
    cellGuide.classList.add('is-fading');
    cellGuideFadeTimer = window.setTimeout(() => {
      cellGuideFadeTimer = 0;
      if (token !== cellGuideToken) return;
      hideCellGuide();
    }, CELL_GUIDE_FADE_MS);
  }, CELL_GUIDE_HOLD_MS);
}

function maybeShowCellGuide() {
  if (isCardPerformance() && cellGuideEnabled) showCellGuide();
  else hideCellGuide();
}

// Card mode ignores stored hidden-percent and always starts fully covered.
function paintOpaqueCardMask() {
  if (!running) return;
  const { mask, maskCtx } = running;
  maskCtx.save();
  maskCtx.globalCompositeOperation = 'source-over';
  maskCtx.globalAlpha = 1;
  maskCtx.clearRect(0, 0, mask.width, mask.height);
  maskCtx.fillStyle = '#000000';
  maskCtx.fillRect(0, 0, mask.width, mask.height);
  maskCtx.restore();
}

function lockCourtCard(cell) {
  if (!isCardSelectPhase() || !cell || !running.cards) return;
  const image = running.cards[cell.index];
  if (!image) return;
  const size = maskDimensions(image.naturalWidth, image.naturalHeight, LIMITS.maxMaskSide);
  if (!size) return;
  // Match the chosen photo so a rectangular image stays contained without stretching the veil.
  if (running.mask.width !== size.w || running.mask.height !== size.h) {
    running.mask.width = size.w;
    running.mask.height = size.h;
  }
  running.selectedIndex = cell.index;
  running.image = image;
  running.cardPhase = 'reveal';
  running.pendingPointerId = null;
  running.pendingCell = null;
  // Hide the guide before the selecting pointerdown paints its first scratch.
  hideCellGuide();
  paintOpaqueCardMask();
  redraw();
}

function selectCourtCard(cell, clientX, clientY, pointerId) {
  if (!isCardSelectPhase() || !cell || !running.deckSlots) return;
  const session = running;
  session.selectedIndex = cell.index;
  session.cardPhase = 'loading';
  session.queuedPoints = [{ x: clientX, y: clientY }];
  hideCellGuide();
  void session.deckSlots.get(cell.index).then(({ image, url }) => {
    if (running !== session || view !== 'performance') return;
    session.cards[cell.index] = image;
    if (url) session.cardUrls.push(url);
    session.cardPhase = 'select';
    lockCourtCard(cell);
    const contact = { last: null };
    const points = [];
    for (const point of session.queuedPoints) {
      points.push(...pointsFor(contact, point.x, point.y));
    }
    session.queuedPoints = [];
    if (points.length) stampPoints(points);
    const activeContact = contacts.get(pointerId);
    if (activeContact) activeContact.last = contact.last;
  }).catch(() => {
    if (running !== session || view !== 'performance') return;
    stopPerformance();
    setError('선택한 카드를 열 수 없습니다. 저장된 데이터는 바꾸지 않았습니다.');
  });
}

function paintInitialMask() {
  const { mask, maskCtx, preset, ratios } = running;
  const width = mask.width;
  const height = mask.height;
  maskCtx.save();
  maskCtx.globalCompositeOperation = 'source-over';
  maskCtx.clearRect(0, 0, width, height);
  maskCtx.globalAlpha = preset.mode === 'gradual' ? gradualStartAlpha(preset.hiddenPercent) : 1;
  maskCtx.fillStyle = VEIL_COLOR;
  maskCtx.fillRect(0, 0, width, height);
  maskCtx.globalAlpha = 1;
  if (preset.mode === 'free') {
    const rect = initialFreeClearRect(width, height, preset.hiddenPercent);
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (preset.mode === 'stages') {
    const bands = stageBands(width, height, LIMITS.stageCount);
    maskCtx.globalCompositeOperation = 'destination-out';
    bands.forEach((band, index) => {
      if (band.w <= 0 || band.h <= 0) {
        ratios[index] = 1;
        return;
      }
      if (ratios[index] >= 1) maskCtx.fillRect(band.x, band.y, band.w, band.h);
    });
  }
  maskCtx.restore();
}

function activeDrawableBand() {
  if (!running) return null;
  const bands = stageBands(running.mask.width, running.mask.height, LIMITS.stageCount);
  for (let guard = 0; guard < bands.length; guard += 1) {
    const index = activeStageIndex(running.ratios, LIMITS.stageUnlockRatio);
    if (index >= bands.length) return null;
    const band = bands[index];
    if (!band || band.w <= 0 || band.h <= 0) {
      running.ratios[index] = 1;
      continue;
    }
    return band;
  }
  return null;
}

function erasedRatio(ctx, band) {
  const image = ctx.getImageData(band.x, band.y, band.w, band.h);
  const step = 8;
  let total = 0;
  let clear = 0;
  for (let y = 0; y < band.h; y += step) {
    for (let x = 0; x < band.w; x += step) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      total += 1;
      if (alpha < ERASED_ALPHA_MAX) clear += 1;
    }
  }
  return total ? clear / total : 0;
}

function maybeAdvanceStage(force = false) {
  if (!running || running.preset.mode !== 'stages') return;
  const now = performance.now();
  if (!force && now - lastStageSample < 80) return;
  lastStageSample = now;
  const band = activeDrawableBand();
  if (!band) return;
  let ratio;
  try {
    ratio = erasedRatio(running.maskCtx, band);
  } catch {
    return;
  }
  running.ratios[band.index] = ratio;
  if (ratio < LIMITS.stageUnlockRatio) return;
  const ctx = running.maskCtx;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.restore();
  running.ratios[band.index] = 1;
}

function redraw() {
  if (view !== 'performance' || !running) return;
  const viewRect = canvas.getBoundingClientRect();
  if (viewRect.width < 2 || viewRect.height < 2) return;
  const cssW = viewRect.width;
  const cssH = viewRect.height;
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  const bufferW = Math.max(1, Math.round(cssW * dpr));
  const bufferH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(bufferW / cssW, 0, 0, bufferH / cssH, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, cssW, cssH);
  // Before a court is locked, the stage stays empty black. No card, no veil edge.
  if (running.cardMode && running.cardPhase !== 'reveal') return;
  if (!running.image) return;
  const imageRect = containRect(cssW, cssH, running.image.naturalWidth, running.image.naturalHeight);
  if (!imageRect) return;
  ctx.drawImage(running.image, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(running.mask, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
}

function currentBrushDiameter() {
  if (!running) return 0;
  const viewRect = canvas.getBoundingClientRect();
  const imageRect = containRect(
    viewRect.width,
    viewRect.height,
    running.image.naturalWidth,
    running.image.naturalHeight,
  );
  if (!imageRect) return 0;
  return brushDiameterInMask(coverageSize, imageRect.w, running.mask.width);
}

function mapFromClient(clientX, clientY) {
  const viewRect = canvas.getBoundingClientRect();
  const imageRect = containRect(
    viewRect.width,
    viewRect.height,
    running.image.naturalWidth,
    running.image.naturalHeight,
  );
  if (!imageRect) return { x: 0, y: 0, inside: false };
  return mapPointerToMask(clientX, clientY, {
    left: viewRect.left,
    top: viewRect.top,
    width: viewRect.width,
    height: viewRect.height,
  }, imageRect, running.mask.width, running.mask.height);
}

function pointsFor(contact, clientX, clientY) {
  const diameter = currentBrushDiameter();
  if (!(diameter > 0)) return [];
  const mapped = mapFromClient(clientX, clientY);
  const previous = contact.last;
  contact.last = { x: mapped.x, y: mapped.y };
  if (!previous) {
    if (mapped.inside) return [{ x: mapped.x, y: mapped.y }];
    // A grid cell can be outside a letterboxed photo; reveal its closest edge immediately.
    if (running.cardMode) return [{
      x: Math.min(running.mask.width, Math.max(0, mapped.x)),
      y: Math.min(running.mask.height, Math.max(0, mapped.y)),
    }];
    return [];
  }
  try {
    return interpolatePoints(previous.x, previous.y, mapped.x, mapped.y, brushSpacing(diameter));
  } catch {
    return [];
  }
}

function stampPoints(points) {
  if (!running || !points.length) return;
  // Card strokes only paint after the card selection is committed.
  if (running.cardMode && running.cardPhase !== 'reveal') return;
  hideCellGuide();
  const ctx = running.maskCtx;
  const mode = running.preset.mode;
  const diameter = currentBrushDiameter();
  if (!(diameter > 0)) return;
  const radius = diameter / 2;
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = stampAlpha(mode);
    if (mode === 'stages') {
      const band = activeDrawableBand();
      if (!band) return;
      ctx.beginPath();
      ctx.rect(band.x, band.y, band.w, band.h);
      ctx.clip();
    }
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } finally {
    ctx.restore();
  }
  if (mode === 'stages') maybeAdvanceStage();
  redraw();
}

function contactDeltas() {
  // screenX/screenY deltas are CSS pixels in screen coordinates.
  return [...contacts.values()].map((contact) => ({
    dx: contact.x - contact.startX,
    dy: contact.y - contact.startY,
  }));
}

function screenPoint(event) {
  return {
    x: Number.isFinite(event.screenX) ? event.screenX : event.clientX,
    y: Number.isFinite(event.screenY) ? event.screenY : event.clientY,
  };
}

function clearContacts() {
  const ids = [...contacts.keys()];
  contacts.clear();
  multiTouchGroup = false;
  gestureResolved = null;
  for (const id of ids) {
    try { canvas.releasePointerCapture(id); } catch { /* already released */ }
  }
}

function resetVeil() {
  if (!running) return;
  // Card scratches and the locked court stay until the performance is left.
  if (running.cardMode) return;
  running.ratios = initialStageRatios(running.preset.hiddenPercent, LIMITS.stageCount);
  lastStageSample = 0;
  paintInitialMask();
  for (const contact of contacts.values()) contact.last = null;
  redraw();
}

function destroyRunning() {
  if (!running) return;
  if (running.deckSlots) running.deckSlots.close();
  if (Array.isArray(running.cardUrls)) {
    for (const url of running.cardUrls) revokeUrl(url);
    running.cardUrls = [];
  }
  running.mask.width = 0;
  running.mask.height = 0;
  if (running.image) running.image.src = '';
  if (Array.isArray(running.cards)) {
    for (const card of running.cards) {
      if (card && card !== running.image) card.src = '';
    }
  }
  running = null;
}

function stopPerformance() {
  hideCellGuide();
  clearContacts();
  destroyRunning();
  view = 'settings';
  stage.hidden = true;
  settings.hidden = false;
  document.body.classList.remove('view-performance');
  document.body.classList.add('view-settings');
  document.title = TITLES.settings;
  if (theme) theme.setAttribute('content', '#4C1420');
  warmCourtDeck();
}

function openSettings() {
  if (view !== 'performance') return;
  blockPointerUntil = Date.now() + 700;
  stopPerformance();
}

function onViewportChange() {
  if (view !== 'performance') return;
  alignCellGuide();
  for (const contact of contacts.values()) contact.last = null;
  redraw();
}

function canPaintPointer(event) {
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
    if (event.type === 'pointerdown') return true;
    if (typeof event.buttons !== 'number') return true;
    return event.buttons === 1;
  }
  return true;
}

function onPointerDown(event) {
  if (view !== 'performance') return;
  if ((event.pointerType === 'mouse' || event.pointerType === 'pen') && event.button !== 0) return;
  if (event.cancelable) event.preventDefault();
  try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  if (contacts.size === 0) {
    multiTouchGroup = false;
    gestureResolved = null;
  }
  const point = screenPoint(event);
  const contact = {
    startX: point.x,
    startY: point.y,
    x: point.x,
    y: point.y,
    last: null,
  };
  contacts.set(event.pointerId, contact);
  if (contacts.size > 1) {
    multiTouchGroup = true;
    for (const item of contacts.values()) item.last = null;
    if (isCardSelectPhase()) {
      running.pendingPointerId = null;
      running.pendingCell = null;
    }
  } else if (isCardSelectPhase()) {
    selectCourtCard(viewportCell(event.clientX, event.clientY), event.clientX, event.clientY, event.pointerId);
    return;
  }
  if (isCardSelectPhase() || (running && running.cardPhase === 'loading')) return;
  if (allowsRevealStroke(contacts.size, multiTouchGroup) && canPaintPointer(event)) {
    const points = pointsFor(contact, event.clientX, event.clientY);
    if (points.length) stampPoints(points);
  }
}

function onPointerMove(event) {
  const contact = contacts.get(event.pointerId);
  if (!contact || view !== 'performance') return;
  if (event.cancelable) event.preventDefault();
  const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : null;
  const list = samples && samples.length ? samples : [event];
  const paint = [];
  for (const sample of list) {
    const point = screenPoint(sample);
    contact.x = point.x;
    contact.y = point.y;
    if (running && running.cardPhase === 'loading' && contacts.size === 1 && !multiTouchGroup
      && running.queuedPoints.length < 256) {
      running.queuedPoints.push({ x: sample.clientX, y: sample.clientY });
    }
    if (isCardSelectPhase() || (running && running.cardPhase === 'loading')
      || gestureResolved || !allowsRevealStroke(contacts.size, multiTouchGroup)) continue;
    if (!canPaintPointer(sample)) continue;
    paint.push(...pointsFor(contact, sample.clientX, sample.clientY));
  }
  if (!gestureResolved && contacts.size >= 2) {
    const gesture = classifyGesture(contactDeltas());
    if (gesture === 'settings') {
      gestureResolved = 'settings';
      openSettings();
      return;
    }
    if (gesture === 'reset') {
      gestureResolved = 'reset';
      if (!isCardPerformance()) resetVeil();
      return;
    }
  }
  if (paint.length && !isCardSelectPhase() && allowsRevealStroke(contacts.size, multiTouchGroup) && !gestureResolved) {
    stampPoints(paint);
  }
}

function endPointer(event) {
  if (!contacts.has(event.pointerId)) return;
  const contact = contacts.get(event.pointerId);
  const point = screenPoint(event);
  contact.x = point.x;
  contact.y = point.y;
  const selecting = isCardSelectPhase();
  // pointercancel and lostpointercapture must not lock or uncover a court.
  const commitSelection = selecting
    && event.type === 'pointerup'
    && !gestureResolved
    && !multiTouchGroup
    && contacts.size === 1
    && running.pendingPointerId === event.pointerId
    && running.pendingCell;
  const pendingCell = commitSelection ? running.pendingCell : null;
  const revealEnded = view === 'performance'
    && Boolean(running)
    && !selecting
    && running.preset.mode === 'stages'
    && !gestureResolved
    && allowsRevealStroke(contacts.size, multiTouchGroup);
  if (view === 'performance' && !gestureResolved && contacts.size >= 2) {
    const gesture = classifyGesture(contactDeltas());
    if (gesture === 'settings') {
      gestureResolved = 'settings';
      openSettings();
      return;
    }
    if (gesture === 'reset') {
      gestureResolved = 'reset';
      if (!isCardPerformance()) resetVeil();
    }
  }
  if (selecting && running && running.pendingPointerId === event.pointerId) {
    running.pendingPointerId = null;
    running.pendingCell = null;
  }
  contacts.delete(event.pointerId);
  try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  if (contacts.size === 0) {
    multiTouchGroup = false;
    gestureResolved = null;
  }
  if (pendingCell && isCardSelectPhase() && view === 'performance') {
    lockCourtCard(pendingCell);
    return;
  }
  if (revealEnded && running && view === 'performance') {
    maybeAdvanceStage(true);
    redraw();
  }
}

async function startPerformance() {
  if (busy || corrupt || storageLocked) return;
  const preset = meta.presets.find((item) => item.id === meta.selectedId);
  if (!preset) {
    setError(MESSAGES.choosePreset);
    return;
  }
  busy = true;
  syncControls();
  try {
    let record;
    try {
      record = await getImage(preset.imageId);
    } catch {
      setError(MESSAGES.imageReadFailed);
      return;
    }
    if (!record || !record.blob) {
      setError(MESSAGES.imageMissing);
      return;
    }
    const image = await decodeImage(record.blob);
    const size = maskDimensions(image.naturalWidth, image.naturalHeight, LIMITS.maxMaskSide);
    if (!size) {
      image.src = '';
      setError(MESSAGES.imageDecodeFailed);
      return;
    }
    const mask = document.createElement('canvas');
    mask.width = size.w;
    mask.height = size.h;
    const maskCtx = mask.getContext('2d', {
      alpha: true,
      willReadFrequently: preset.mode === 'stages',
    });
    running = {
      preset,
      image,
      mask,
      maskCtx,
      ratios: initialStageRatios(preset.hiddenPercent, LIMITS.stageCount),
    };
    paintInitialMask();
    showPerformanceSurface();
  } catch (error) {
    hideCellGuide();
    destroyRunning();
    view = 'settings';
    stage.hidden = true;
    settings.hidden = false;
    document.body.classList.remove('view-performance');
    document.body.classList.add('view-settings');
    document.title = TITLES.settings;
    setError(error instanceof Error && error.message === 'decode'
      ? MESSAGES.imageDecodeFailed
      : MESSAGES.imageReadFailed);
  } finally {
    busy = false;
    syncControls();
  }
}

function showPerformanceSurface() {
  view = 'performance';
  settings.hidden = true;
  stage.hidden = false;
  document.body.classList.remove('view-settings');
  document.body.classList.add('view-performance');
  document.title = TITLES.performance;
  if (theme) theme.setAttribute('content', '#000000');
  clearContacts();
  redraw();
  maybeShowCellGuide();
  requestAnimationFrame(() => {
    alignCellGuide();
    redraw();
    requestAnimationFrame(() => {
      alignCellGuide();
      redraw();
    });
  });
  try {
    canvas.focus({ preventScroll: true });
  } catch {
    try { canvas.focus(); } catch { /* keyboard listener is on window */ }
  }
}

function slotLabel(card) {
  return `${SUIT_CODE[card.suit]}-${card.rank}`;
}

function setSlotStatus(index, message) {
  const slot = customSlots[index];
  if (!slot) return;
  slot.status.textContent = message;
}

function showSlotImage(index) {
  const slot = customSlots[index];
  if (!slot) return;
  const url = customPendingUrls[index] || customStoredUrls[index];
  if (!url) {
    slot.preview.hidden = true;
    slot.preview.removeAttribute('src');
    return;
  }
  slot.preview.alt = `${Math.floor(index / CUSTOM_COUNT) + 1}세트 ${index % CUSTOM_COUNT + 1}번 칸 미리보기`;
  slot.preview.src = url;
  slot.preview.hidden = false;
}

function updateSlotAction(index) {
  const slot = customSlots[index];
  if (!slot) return;
  const filled = typeof customIds[index] === 'string' && customIds[index];
  slot.button.textContent = filled ? '이 칸 사진 바꾸기' : '이 칸에 올리기';
}

function renderCustomSlots() {
  if (!customSlotsRoot || customSlots.length) return;
  for (let index = 0; index < CUSTOM_COUNT * PHOTO_SET_COUNT; index += 1) {
    const setIndex = Math.floor(index / CUSTOM_COUNT);
    const slotNumber = index % CUSTOM_COUNT;
    if (slotNumber === 0) {
      const details = document.createElement('details');
      details.className = 'photo-set';
      const summary = document.createElement('summary');
      summary.textContent = `사진 세트 ${setIndex + 1}`;
      const slots = document.createElement('div');
      slots.className = 'custom-slots';
      const hint = document.createElement('p');
      hint.className = 'hint';
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'primary photo-set-start';
      start.textContent = '이 세팅으로 연출하기';
      start.addEventListener('click', () => { void startCustomPerformance(setIndex); });
      details.append(summary, hint, start, slots);
      customSlotsRoot.append(details);
      customReadyHints.push(hint);
      customStartButtons.push(start);
    }
    const card = cardAtIndex(slotNumber);
    const code = card ? slotLabel(card) : String(slotNumber + 1);
    const article = document.createElement('article');
    article.className = 'custom-slot';
    article.dataset.slot = String(index);

    const title = document.createElement('h3');
    title.textContent = card
      ? `${card.guide} = ${code} · ${card.label}`
      : `${slotNumber + 1}`;

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png,image/webp,image/gif';
    file.setAttribute('aria-label', `${setIndex + 1}세트 ${slotNumber + 1}번 ${code} 사진 파일`);

    const status = document.createElement('p');
    status.className = 'hint slot-status';
    status.textContent = '저장된 사진 없음';

    const preview = document.createElement('img');
    preview.className = 'preview';
    preview.alt = '';
    preview.hidden = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = '이 칸에 올리기';

    article.append(title, file, status, preview, button);
    customSlotsRoot.lastElementChild.querySelector('.custom-slots').append(article);
    customSlots.push({ file, status, preview, button });

    file.addEventListener('change', () => onCustomFile(index));
    button.addEventListener('click', () => {
      void saveCustomSlot(index);
    });
    preview.addEventListener('error', () => {
      const current = customPendingUrls[index] || customStoredUrls[index];
      if (!current || preview.src !== current) return;
      if (customPendingUrls[index]) {
        setSlotStatus(index, '선택한 파일을 미리볼 수 없습니다. 이 칸은 바꾸지 않았습니다.');
        return;
      }
      setSlotStatus(index, '이 칸의 저장된 사진을 열 수 없습니다. 데이터는 바꾸지 않았습니다.');
    });
  }
}

function onCustomFile(index) {
  const slot = customSlots[index];
  if (!slot || busy || storageLocked || customCorrupt) return;
  revokeUrl(customPendingUrls[index]);
  customPendingUrls[index] = null;
  customPendingFiles[index] = null;
  const file = slot.file.files && slot.file.files[0];
  if (!file) {
    setSlotStatus(index, customIds[index]
      ? '저장된 사진이 있습니다. 바꾸려면 새 파일을 고르세요.'
      : '선택된 파일 없음');
    showSlotImage(index);
    return;
  }
  const checked = validateImage({ bytes: file.size, mime: file.type }, { required: true });
  if (!checked.ok) {
    slot.file.value = '';
    setError(checked.error);
    setSlotStatus(index, checked.error);
    showSlotImage(index);
    return;
  }
  customPendingFiles[index] = file;
  customPendingUrls[index] = URL.createObjectURL(file);
  liveUrls.add(customPendingUrls[index]);
  showSlotImage(index);
  setSlotStatus(index, `선택한 파일: ${file.name}. 아직 저장되지 않았습니다.`);
  setStatus('파일을 확인했습니다. 이 칸의 올리기 또는 바꾸기를 눌러야 저장됩니다.');
}

function customIdStillUsed(id) {
  if (!id) return false;
  if (customIds.includes(id)) return true;
  if (!corrupt && meta.presets.some((preset) => preset.imageId === id)) return true;
  return false;
}

async function refreshSlotPreview(index) {
  const id = customIds[index];
  revokeUrl(customStoredUrls[index]);
  customStoredUrls[index] = null;
  updateSlotAction(index);
  if (typeof id !== 'string' || !id) {
    if (!customPendingFiles[index]) {
      setSlotStatus(index, '저장된 사진 없음');
      showSlotImage(index);
    }
    return true;
  }
  let record;
  try {
    record = await getImage(id);
  } catch {
    setSlotStatus(index, '이 칸의 사진을 불러오지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
    showSlotImage(index);
    return false;
  }
  const blob = record && record.blob;
  if (!(blob instanceof Blob) || blob.size <= 0) {
    setSlotStatus(index, '이 칸의 저장 파일을 찾지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
    showSlotImage(index);
    return false;
  }
  const url = URL.createObjectURL(blob);
  customStoredUrls[index] = url;
  liveUrls.add(url);
  if (!customPendingFiles[index]) {
    setSlotStatus(index, '저장된 사진이 있습니다.');
  }
  showSlotImage(index);
  return true;
}

async function refreshCustomPreviews() {
  let failed = false;
  for (let index = 0; index < CUSTOM_COUNT * PHOTO_SET_COUNT; index += 1) {
    const ok = await refreshSlotPreview(index);
    if (!ok) failed = true;
  }
  if (failed && errorBox.hidden) {
    setError('일부 칸의 사진을 표시하지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
  }
}

async function saveCustomSlot(index) {
  if (busy || storageLocked || customCorrupt) return;
  const slot = customSlots[index];
  const file = customPendingFiles[index];
  if (!file) {
    const message = '올릴 사진을 먼저 고르세요. 이 칸은 바꾸지 않았습니다.';
    setSlotStatus(index, message);
    setError(message);
    return;
  }
  const checked = validateImage({ bytes: file.size, mime: file.type }, { required: true });
  if (!checked.ok) {
    setSlotStatus(index, checked.error);
    setError(checked.error);
    return;
  }
  busy = true;
  syncControls();
  let wroteNewImage = false;
  let imageId = null;
  try {
    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      setError(MESSAGES.imageStoreFailed);
      setSlotStatus(index, '이미지를 읽지 못했습니다. 이 칸은 바꾸지 않았습니다.');
      return;
    }
    if (buffer.byteLength <= 0) {
      setError(MESSAGES.imageEmpty);
      setSlotStatus(index, MESSAGES.imageEmpty);
      return;
    }
    if (buffer.byteLength > LIMITS.maxImageBytes) {
      setError(MESSAGES.imageTooLarge);
      setSlotStatus(index, MESSAGES.imageTooLarge);
      return;
    }
    const blob = new Blob([buffer], { type: checked.value.mime });
    imageId = createId('img');
    try {
      await putImage(imageId, blob);
      wroteNewImage = true;
    } catch {
      const message = '사진을 저장하지 못했습니다. 이 칸과 프리셋은 바꾸지 않았습니다.';
      setError(message);
      setSlotStatus(index, message);
      return;
    }
    const previousId = customIds[index];
    const next = customIds.slice();
    next[index] = imageId;
    // Store the blob first. Metadata is the commit point; roll back the new blob if it fails.
    if (!commitCustom(next)) {
      if (wroteNewImage) {
        try {
          await deleteImage(imageId);
        } catch {
          setError('사진 목록 저장에 실패했습니다. 방금 저장한 파일을 지우지 못했지만, 이 칸은 이전 사진을 유지합니다.');
        }
      }
      setSlotStatus(index, '저장에 실패했습니다. 이 칸의 이전 사진은 유지됩니다.');
      return;
    }
    if (slot) slot.file.value = '';
    revokeUrl(customPendingUrls[index]);
    customPendingUrls[index] = null;
    customPendingFiles[index] = null;
    let keptReason = null;
    if (previousId && previousId !== imageId) {
      if (corrupt) keptReason = 'corrupt';
      else if (customIdStillUsed(previousId)) keptReason = 'shared';
      else {
        try {
          await deleteImage(previousId);
        } catch {
          keptReason = 'failed';
        }
      }
    }
    const previewOk = await refreshSlotPreview(index);
    if (!previewOk) {
      setError('이 칸은 새 사진으로 저장했습니다. 미리보기만 만들지 못했고, 저장된 데이터는 되돌리지 않았습니다.');
      return;
    }
    const code = cardAtIndex(index % CUSTOM_COUNT) ? slotLabel(cardAtIndex(index % CUSTOM_COUNT)) : '';
    if (keptReason === 'corrupt') {
      setStatus('이 칸은 새 사진으로 바꿨습니다. 프리셋 정보를 해석할 수 없어 이전 사진 파일은 지우지 않았습니다.');
      return;
    }
    if (keptReason === 'shared') {
      setStatus('이 칸은 새 사진으로 바꿨습니다. 이전 파일은 다른 칸이나 프리셋이 쓰고 있어 지우지 않았습니다.');
      return;
    }
    if (keptReason === 'failed') {
      setStatus('이 칸은 새 사진으로 바꿨습니다. 이전 사진 파일은 지우지 못했습니다.');
      return;
    }
    setStatus(`${Math.floor(index / CUSTOM_COUNT) + 1}세트 ${index % CUSTOM_COUNT + 1}번 칸(${code})을 저장했습니다.`);
  } finally {
    busy = false;
    syncControls();
  }
}

function loadKeptImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('decode'));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error('decode'));
    image.src = url;
  });
}

function createCustomDeckSlots(setIndex) {
  const loaders = Array.from({ length: CUSTOM_COUNT }, (_, index) => async () => {
    const id = customIds[setIndex * CUSTOM_COUNT + index];
    if (typeof id !== 'string' || !IMAGE_ID_RE.test(id)) throw new Error('missing');
    let record;
    try {
      record = await getImage(id);
    } catch {
      throw new Error('read');
    }
    const blob = record && record.blob;
    if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('missing');
    const url = URL.createObjectURL(blob);
    liveUrls.add(url);
    try {
      return { image: await loadKeptImage(url), url };
    } catch (error) {
      revokeUrl(url);
      throw error;
    }
  });
  return createDeckSlots(loaders, ({ image, url }) => {
    if (url) revokeUrl(url);
    if (image) image.src = '';
  });
}

function beginCardSurface(deckSlots) {
  let attached = false;
  try {
    const size = maskDimensions(600, 800, LIMITS.maxMaskSide);
    if (!size) throw new Error('decode');
    const mask = document.createElement('canvas');
    mask.width = size.w;
    mask.height = size.h;
    const maskCtx = mask.getContext('2d', { alpha: true, willReadFrequently: false });
    if (!maskCtx) throw new Error('decode');
    running = {
      preset: {
        mode: 'free',
        brushSize: LIMITS.defaultBrush,
        hiddenPercent: 100,
      },
      image: null,
      cards: Array(COURT_CARD_COUNT).fill(null),
      cardUrls: [],
      deckSlots,
      queuedPoints: [],
      mask,
      maskCtx,
      ratios: initialStageRatios(100, LIMITS.stageCount),
      cardMode: true,
      cardPhase: 'select',
      pendingPointerId: null,
      pendingCell: null,
      selectedIndex: null,
    };
    attached = true;
    paintOpaqueCardMask();
    showPerformanceSurface();
  } catch (error) {
    if (!attached) {
      deckSlots.close();
    }
    throw error;
  }
}

async function startCustomPerformance(setIndex) {
  if (busy || view !== 'settings' || storageLocked || customCorrupt) return;
  if (!customDeckReady(setIndex)) {
    setError('사진 12장이 모두 있어야 내 사진으로 시작할 수 있습니다. 저장된 데이터는 바꾸지 않았습니다.');
    return;
  }
  busy = true;
  syncControls();
  try {
    if (warmedCourtSlots) {
      warmedCourtSlots.close();
      warmedCourtSlots = null;
    }
    beginCardSurface(createCustomDeckSlots(setIndex));
  } catch (error) {
    destroyRunning();
    if (view !== 'settings') stopPerformance();
    const code = error instanceof Error ? error.message : '';
    if (code === 'missing') {
      setError('내 사진 12장 중 일부를 찾지 못했습니다. 저장된 사진과 프리셋은 바꾸지 않았습니다.');
    } else if (code === 'decode') {
      setError('내 사진 중 열 수 없는 파일이 있습니다. 저장된 데이터는 바꾸지 않았습니다.');
    } else {
      setError('내 사진을 불러오지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
    }
  } finally {
    busy = false;
    syncControls();
  }
}

async function startCardPerformance() {
  if (busy || view !== 'settings') return;
  busy = true;
  syncControls();
  try {
    const deckSlots = warmedCourtSlots || createCourtDeckSlots();
    warmedCourtSlots = null;
    beginCardSurface(deckSlots);
  } catch {
    destroyRunning();
    if (view !== 'settings') stopPerformance();
    setError('기본 카드를 준비하지 못했습니다. 저장된 프리셋은 바꾸지 않았습니다.');
  } finally {
    busy = false;
    syncControls();
  }
}

function registerShell() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
    // Registration needs http(s). The page still runs without a worker.
  });
}

function bindEvents() {
  presetList.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !presetList.contains(button)) return;
    const card = button.closest('[data-id]');
    if (!card) return;
    const id = card.getAttribute('data-id');
    const action = button.getAttribute('data-action');
    if (action === 'select') selectPreset(id);
    else if (action === 'edit') editPreset(id);
    else if (action === 'delete') deletePreset(id);
  });
  editorForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void savePreset();
  });
  cancelEdit.addEventListener('click', () => {
    armDeleteId = null;
    resetForm();
    renderList();
  });
  fileInput.addEventListener('change', onFileChange);
  modeInput.addEventListener('change', updateModeHint);
  brushInput.addEventListener('input', () => {
    brushReadout.textContent = brushInput.value;
  });
  hiddenEnable.addEventListener('change', () => {
    hiddenInput.disabled = !hiddenEnable.checked;
  });
  hiddenInput.addEventListener('input', () => {
    hiddenReadout.textContent = hiddenInput.value;
  });
  startButton.addEventListener('click', () => {
    void startPerformance();
  });
  cardStartButton.addEventListener('click', () => {
    void startCardPerformance();
  });
  if (cellGuideInput) {
    cellGuideInput.addEventListener('change', onCellGuideChange);
  }
  coverageInput.addEventListener('input', () => {
    coverageReadout.textContent = `${coverageInput.value}px`;
  });
  coverageInput.addEventListener('change', onCoverageChange);
  recoverButton.addEventListener('click', () => {
    void recoverStored();
  });
  resetStorageButton.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      resetStorageButton.textContent = '정말 초기화';
      return;
    }
    void resetStored();
  });
  settings.addEventListener('pointerdown', (event) => {
    if (Date.now() < blockPointerUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  settings.addEventListener('click', (event) => {
    if (Date.now() < blockPointerUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('selectstart', (event) => event.preventDefault());
  canvas.addEventListener('touchmove', (event) => {
    if (view === 'performance' && event.cancelable) event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('gesturestart', (event) => event.preventDefault());
  window.addEventListener('keydown', (event) => {
    if (view === 'performance' && event.shiftKey && event.key === 'Escape') {
      event.preventDefault();
      openSettings();
    }
  });
  window.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => onViewportChange());
    observer.observe(stage);
  }
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) revokeAllUrls();
  });
}

async function boot() {
  loadCellGuidePreference();
  loadCoveragePreference();
  brushInput.min = String(LIMITS.minBrush);
  brushInput.max = String(LIMITS.maxBrush);
  brushInput.value = String(LIMITS.defaultBrush);
  brushReadout.textContent = String(LIMITS.defaultBrush);
  hiddenInput.value = '100';
  hiddenReadout.textContent = '100';
  document.title = TITLES.settings;
  updateModeHint();
  bindEvents();
  registerShell();
  renderCustomSlots();
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageLocked = true;
    setError(MESSAGES.storageReadFailed);
    syncControls();
    return;
  }
  let presetFailed = false;
  if (raw == null) {
    meta = emptyMeta();
  } else {
    const parsed = parseMeta(raw);
    if (!parsed.ok) {
      corrupt = true;
      meta = emptyMeta();
      repair.hidden = false;
      presetFailed = true;
    } else {
      meta = parsed.meta;
    }
  }
  try {
    const savedSets = localStorage.getItem(PHOTO_SETS_KEY);
    const legacy = localStorage.getItem(CUSTOM_KEY);
    const parsedCustom = parsePhotoSets(savedSets, legacy);
    if (!parsedCustom.ok) {
      customCorrupt = true;
    } else {
      const ids = parsedCustom.sets.flat();
      if (parsedCustom.needsMigration) {
        if (!commitCustom(ids)) {
          storageLocked = true;
          return;
        }
      } else {
        customIds = ids;
      }
    }
  } catch {
    storageLocked = true;
    setError(MESSAGES.storageReadFailed);
    syncControls();
    return;
  }
  if (presetFailed) setError(MESSAGES.metaCorrupt);
  else if (customCorrupt) {
    setError('저장된 내 사진 12장 정보를 해석할 수 없습니다. 기존 데이터는 자동으로 지우지 않았습니다.');
  }
  if (customCorrupt) {
    for (let index = 0; index < CUSTOM_COUNT * PHOTO_SET_COUNT; index += 1) {
      setSlotStatus(index, '목록을 해석할 수 없어 이 칸을 표시하지 않습니다. 데이터는 지우지 않았습니다.');
    }
  }
  if (!presetFailed) renderList();
  try {
    await database();
  } catch {
    setError(MESSAGES.dbOpenFailed);
    syncControls();
    return;
  }
  if (!customCorrupt) {
    try {
      await refreshCustomPreviews();
    } catch {
      setError('내 사진 미리보기를 만들지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
    }
  }
  syncControls();
}

boot().catch(() => {
  setError(MESSAGES.storageReadFailed);
});
requestAnimationFrame(() => {
  if (view === 'settings') warmCourtDeck();
});
