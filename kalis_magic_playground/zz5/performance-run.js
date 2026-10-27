// Performance run: custom-image and card decks, performance surface, start and stop.
import {
  LIMITS, MESSAGES, TITLES, cardAtIndex, initialStageRatios, maskDimensions,
} from './logic.js';
import { maybeShowGestureGuide, hideGestureGuide } from './gesture-guide.js';
import { settings, stage, canvas, theme } from './dom.js';
import { setError } from './status.js';
import { revokeUrl, decodeImage } from './images.js';
import { getImage } from './image-db.js';
import { syncControls } from './presets.js';
import { customDeckReady, createCustomDeckSlots } from './photo-sets.js';
import { COURT_CARD_COUNT, createCourtDeckSlots } from './court-cards.js';
import { paintOpaqueCardMask } from './card-select.js';
import { hideCellGuide, alignCellGuide, maybeShowCellGuide } from './cell-guide.js';
import { paintInitialMask, redraw } from './veil.js';
import { clearContacts } from './pointer.js';
import { syncPerformanceWakeLock } from './wake-lock.js';
import {
  meta, view, corrupt, storageLocked, busy, customCorrupt, running,
  setView, setBusy, setRunning,
} from './controller-state.js';

let warmedCourtSlots = null;

export function warmCourtDeck() {
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
  setRunning(null);
}

export function stopPerformance() {
  hideGestureGuide();
  hideCellGuide();
  clearContacts();
  destroyRunning();
  setView('settings');
  stage.hidden = true;
  settings.hidden = false;
  document.body.classList.remove('view-performance');
  document.body.classList.add('view-settings');
  document.title = TITLES.settings;
  if (theme) theme.setAttribute('content', '#4C1420');
  warmCourtDeck();
  syncPerformanceWakeLock();
  window.MagicUpdate?.offer(); // settings is off-stage
}

export async function startPerformance() {
  if (busy || corrupt || storageLocked) return;
  const preset = meta.presets.find((item) => item.id === meta.selectedId);
  if (!preset) {
    setError(MESSAGES.choosePreset);
    return;
  }
  setBusy(true);
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
    setRunning({
      preset,
      image,
      mask,
      maskCtx,
      ratios: initialStageRatios(preset.hiddenPercent, LIMITS.stageCount),
    });
    paintInitialMask();
    showPerformanceSurface();
  } catch (error) {
    hideCellGuide();
    destroyRunning();
    setView('settings');
    stage.hidden = true;
    settings.hidden = false;
    document.body.classList.remove('view-performance');
    document.body.classList.add('view-settings');
    document.title = TITLES.settings;
    setError(error instanceof Error && error.message === 'decode'
      ? MESSAGES.imageDecodeFailed
      : MESSAGES.imageReadFailed);
  } finally {
    setBusy(false);
    syncControls();
  }
}

function showPerformanceSurface() {
  setView('performance');
  window.MagicUpdate?.hide();
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
    setRunning({
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
    });
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

export async function startCustomPerformance(setIndex) {
  if (busy || view !== 'settings' || storageLocked || customCorrupt) return;
  if (!customDeckReady(setIndex)) {
    setError('사진 12장이 모두 있어야 내 사진으로 시작할 수 있습니다. 저장된 데이터는 바꾸지 않았습니다.');
    return;
  }
  setBusy(true);
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
    setBusy(false);
    syncControls();
  }
}

export async function startCardPerformance() {
  if (busy || view !== 'settings') return;
  setBusy(true);
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
    setBusy(false);
    syncControls();
  }
}
