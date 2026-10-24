import {
  LIMITS, MESSAGES, TITLES, canAddPreset, cardAtIndex, createId, emptyMeta, emptyPhotoSets,
  initialStageRatios, maskDimensions, parseMeta, parsePhotoSets, salvageMeta, validateImage,
  validatePresetInput,
} from './logic.js';
import { maybeShowGestureGuide, hideGestureGuide } from './gesture-guide.js';
import {
  STORAGE_KEY, CUSTOM_KEY, PHOTO_SETS_KEY, PHOTO_SET_COUNT, CUSTOM_COUNT, settings, stage, canvas,
  theme, repair, presetList, startButton, cardStartButton, editorForm, legend, nameInput, fileInput,
  fileStatus, preview, modeInput, brushInput, brushReadout, hiddenEnable, hiddenInput,
  hiddenReadout, saveButton, cancelEdit, recoverButton, resetStorageButton, cellGuideInput,
  coverageInput, coverageReadout,
} from './dom.js';
import { setError, setStatus } from './status.js';
import { liveUrls, revokeUrl, decodeImage } from './images.js';
import { database, putImage, getImage, deleteImage, clearImages } from './image-db.js';
import { syncControls, updateModeHint, renderList } from './presets.js';
import {
  customSlots, customPendingFiles, customPendingUrls, customDeckReady, setSlotStatus,
  renderCustomSlots, customIdStillUsed, refreshSlotPreview, refreshCustomPreviews,
  createCustomDeckSlots,
} from './photo-sets.js';
import { COURT_CARD_COUNT, createCourtDeckSlots, slotLabel } from './court-cards.js';
import { paintOpaqueCardMask } from './card-select.js';
import {
  loadCellGuidePreference, loadCoveragePreference, onCoverageChange, onCellGuideChange,
} from './preferences.js';
import { hideCellGuide, alignCellGuide, maybeShowCellGuide } from './cell-guide.js';
import { paintInitialMask, redraw, onViewportChange } from './veil.js';
import {
  blockPointerUntil, clearContacts, onPointerDown, onPointerMove, endPointer,
} from './pointer.js';
import { syncPerformanceWakeLock } from './wake-lock.js';

let bootingPerformance = true;

let meta = emptyMeta();
let view = 'settings';
let corrupt = false;
let storageLocked = false;
let busy = false;
let formMode = 'create';
let editingId = null;
let armDeleteId = null;
let resetArmed = false;

let previewUrl = null;

let customIds = emptyPhotoSets().flat();
let customCorrupt = false;

let running = null;

function revokeAllUrls() {
  for (const url of liveUrls) URL.revokeObjectURL(url);
  liveUrls.clear();
  previewUrl = null;
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

let warmedCourtSlots = null;

function warmCourtDeck() {
  if (!warmedCourtSlots) warmedCourtSlots = createCourtDeckSlots();
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
  hideGestureGuide();
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
  syncPerformanceWakeLock();
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
  maybeShowGestureGuide();
  syncPerformanceWakeLock();
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

async function startBootPerformance() {
  try {
    if (!corrupt && !storageLocked) {
      const selectedId = meta.selectedId;
      const candidates = [...meta.presets].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
      for (const preset of candidates) {
        meta.selectedId = preset.id;
        await startPerformance();
        if (view === 'performance') return;
      }
      meta.selectedId = selectedId;
    }
    await startCardPerformance();
  } finally {
    bootingPerformance = false;
    if (view === 'performance') maybeShowGestureGuide();
  }
}

export {
  bootingPerformance, meta, view, corrupt, storageLocked, busy, armDeleteId, customIds,
  customCorrupt, running, warmCourtDeck, stopPerformance, saveCustomSlot, startCustomPerformance,
  boot, startBootPerformance,
};
