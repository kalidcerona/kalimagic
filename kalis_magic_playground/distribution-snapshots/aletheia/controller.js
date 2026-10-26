// ALETHEIA controller: boot, event wiring and the public facade for the feature modules.
import {
  LIMITS, MESSAGES, TITLES, emptyMeta, parseMeta, parsePhotoSets,
} from './logic.js';
import { maybeShowGestureGuide } from './gesture-guide.js';
import {
  STORAGE_KEY, CUSTOM_KEY, PHOTO_SETS_KEY, PHOTO_SET_COUNT, CUSTOM_COUNT, settings, stage, canvas,
  presetList, startButton, cardStartButton, editorForm, nameInput, fileInput,
  modeInput, brushInput, brushReadout, hiddenEnable, hiddenInput,
  hiddenReadout, cancelEdit, recoverButton, resetStorageButton, cellGuideInput,
  coverageInput, coverageReadout, repair,
} from './dom.js';
import { setError } from './status.js';
import './images.js';
import { database } from './image-db.js';
import { syncControls, updateModeHint, renderList } from './presets.js';
import { setSlotStatus, renderCustomSlots, refreshCustomPreviews } from './photo-sets.js';
import './court-cards.js';
import './card-select.js';
import {
  loadCellGuidePreference, loadCoveragePreference, onCoverageChange, onCellGuideChange,
} from './preferences.js';
import './cell-guide.js';
import { onViewportChange } from './veil.js';
import {
  blockPointerUntil, onPointerDown, onPointerMove, endPointer,
} from './pointer.js';
import './wake-lock.js';
import {
  meta, view, corrupt, storageLocked, resetArmed, customCorrupt,
  setMeta, setCorrupt, setStorageLocked, setArmDeleteId, setResetArmed, setCustomIds,
  setCustomCorrupt,
} from './controller-state.js';
import { commitCustom } from './storage-commit.js';
import {
  resetForm, selectPreset, editPreset, deletePreset, onFileChange, savePreset, revokeAllUrls,
} from './preset-form.js';
import { recoverStored, resetStored } from './stored-recovery.js';
import { startPerformance, startCardPerformance } from './performance-run.js';

let bootingPerformance = true;

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
    setArmDeleteId(null);
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
      setResetArmed(true);
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
    setStorageLocked(true);
    setError(MESSAGES.storageReadFailed);
    syncControls();
    return;
  }
  let presetFailed = false;
  if (raw == null) {
    setMeta(emptyMeta());
  } else {
    const parsed = parseMeta(raw);
    if (!parsed.ok) {
      setCorrupt(true);
      setMeta(emptyMeta());
      repair.hidden = false;
      presetFailed = true;
    } else {
      setMeta(parsed.meta);
    }
  }
  try {
    const savedSets = localStorage.getItem(PHOTO_SETS_KEY);
    const legacy = localStorage.getItem(CUSTOM_KEY);
    const parsedCustom = parsePhotoSets(savedSets, legacy);
    if (!parsedCustom.ok) {
      setCustomCorrupt(true);
    } else {
      const ids = parsedCustom.sets.flat();
      if (parsedCustom.needsMigration) {
        if (!commitCustom(ids)) {
          setStorageLocked(true);
          return;
        }
      } else {
        setCustomIds(ids);
      }
    }
  } catch {
    setStorageLocked(true);
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
  meta, view, corrupt, storageLocked, busy, armDeleteId, customIds, customCorrupt, running,
} from './controller-state.js';
export { warmCourtDeck, stopPerformance, startCustomPerformance } from './performance-run.js';
export { saveCustomSlot } from './custom-slot-save.js';
export { bootingPerformance, boot, startBootPerformance };
