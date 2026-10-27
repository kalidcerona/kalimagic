import { LIMITS, cropPercentFromDrag } from './logic.js';
import {
  stageEl, form, nameInput, sizeInput, xInput, yInput, fadeInput, durationInput, edgeGroup,
  addButton, deleteButton, startButton, objectKindInput, wallpaperInput, wallpaperClear,
  wallpaperNote, wallpaperEl, wallpaperCrop, wallpaperFrame, wallpaperCropHandle, wallpaperControls,
  imageChoiceInput, coinImageInput, coinImageNote, motionActivation, wallSoundInput,
  wallVolumeInput, wallVolumeValue, wallTestButton, motionInputs, motionEdges,
} from './dom.js';
import { unlockBreakSound, playWallSound } from './audio.js';
import { gestureGuide } from './gesture-guide.js';
import {
  state, selected, readObjectKind, applyObjectKind, persistObjectKind, loadState, renderRecovery,
} from './state-store.js';
import {
  WALLPAPER_CROP_KEY, wallpaperJobs, imageChoices, imageUrls, imageRecord, imageBlob,
  croppedWallpaper, cropLabel, readCropPercent, paintCropChrome, setCropEnabled, showWallpaper,
  showWallpaperOriginal, useImageUrl, refreshCoinImage, loadImageChoices, persistImageChoices,
} from './images.js';
import {
  renderList, fillForm, commitName, commitNumbers, readAppearance, previewAppearance,
  updateAppearance, setEdge, addPreset, deleteSelected,
} from './presets.js';
import {
  loadMotionEffects, saveMotionEffects, saveSoundPreferences, motionEnabled, enableMotion,
  concealCoin, showPerformance, onPointerDown, onPointerMove, onPointerUp, onResize,
  onEdgeKey,
} from './performance.js';

let wallpaperOriginal = null;
let cropDrag = null;
let wallpaperStorageBlocked = false;
async function updateWallpaperCrop() {
  const source = wallpaperOriginal;
  if (!source) return false;
  const token = wallpaperJobs.next();
  const percent = readCropPercent();
  paintCropChrome(percent);
  try {
    const output = await croppedWallpaper(source, percent);
    if (!wallpaperJobs.current(token)) return false;
    const saved = await wallpaperJobs.enqueue(token, async (current) => {
      await imageRecord('wallpaper:original', 'put', source);
      if (!current()) return;
      await imageRecord('wallpaper', 'put', output);
      if (current()) writeWallpaperCrop(String(percent));
    });
    if (!saved) return false;
    showWallpaper(output);
    return true;
  } catch (error) {
    if (!wallpaperJobs.current(token)) return false;
    throw error;
  }
}

function writeWallpaperCrop(value) {
  if (wallpaperStorageBlocked) {
    throw new Error('배경 자르기 설정을 읽지 못해 저장하지 않았습니다. 기존 기록은 그대로입니다.');
  }
  localStorage.setItem(WALLPAPER_CROP_KEY, value);
}

function removeWallpaperCrop() {
  if (wallpaperStorageBlocked) {
    throw new Error('배경 자르기 설정을 읽지 못해 지우지 않았습니다. 기존 기록은 그대로입니다.');
  }
  localStorage.removeItem(WALLPAPER_CROP_KEY);
}

async function loadImages() {
  try {
    const token = wallpaperJobs.next();
    let savedCrop = null;
    try {
      savedCrop = localStorage.getItem(WALLPAPER_CROP_KEY);
    } catch (error) {
      wallpaperStorageBlocked = true;
      wallpaperNote.textContent = '배경 자르기 설정을 읽지 못했습니다. 기존 기록은 덮어쓰지 않습니다.';
      throw error;
    }
    paintCropChrome(Math.min(18, Math.max(0, Number(savedCrop) || 0)));
    const storedOriginal = await imageRecord('wallpaper:original', 'get');
    const wallpaper = await imageRecord('wallpaper', 'get');
    if (wallpaperJobs.current(token) && wallpaper) {
      wallpaperOriginal = storedOriginal || wallpaper;
      showWallpaper(wallpaper);
      showWallpaperOriginal(wallpaperOriginal);
      wallpaperNote.textContent = '배경 사진이 이 기기에 저장되어 있습니다.';
      try {
        if (savedCrop === null) {
          // Older versions stored only a reduced wallpaper. Preserve that blob before one-time cropping.
          const migrated = await croppedWallpaper(wallpaperOriginal, 5);
          if (wallpaperJobs.current(token)) {
            const saved = await wallpaperJobs.enqueue(token, async (current) => {
              if (!storedOriginal) await imageRecord('wallpaper:original', 'put', wallpaperOriginal);
              if (!current()) return;
              await imageRecord('wallpaper', 'put', migrated);
              if (current()) writeWallpaperCrop('5');
            });
            if (saved) {
              paintCropChrome(5);
              showWallpaper(migrated);
              wallpaperNote.textContent = '기존 배경의 윗부분 5%를 잘랐습니다. 설정에서 다시 조절할 수 있습니다.';
            }
          }
        } else if (!storedOriginal) {
          await wallpaperJobs.enqueue(token, () => imageRecord('wallpaper:original', 'put', wallpaper));
        }
      } catch {
        if (wallpaperJobs.current(token) && savedCrop === null) {
          try {
            await wallpaperJobs.enqueue(token, async (current) => {
              if (current()) writeWallpaperCrop('0');
              if (!storedOriginal && current()) await imageRecord('wallpaper:original', 'put', wallpaper);
            });
          } catch { /* Keep the already displayed wallpaper. */ }
          paintCropChrome(0);
          wallpaperNote.textContent = '기존 배경을 그대로 표시합니다. 윗부분 자동 자르기에 실패했습니다. 설정에서 다시 조절해 주세요.';
        } else if (wallpaperJobs.current(token)) {
          wallpaperNote.textContent = '기존 배경을 표시합니다. 원본 저장에 실패하여 자르기를 다시 조절할 수 없습니다.';
        }
      }
    }
    if (wallpaperJobs.current(token)) setCropEnabled(Boolean(wallpaperOriginal));
    for (const preset of state.presets) {
      const blob = await imageRecord(`coin:${preset.id}`, 'get');
      if (blob) useImageUrl(`coin:${preset.id}`, blob);
    }
    refreshCoinImage();
  } catch {
    if (!wallpaperStorageBlocked) wallpaperNote.textContent = '이 브라우저에서는 업로드한 이미지를 불러오거나 저장할 수 없습니다.';
  }
}

function bind() {
  for (const input of [...Object.values(motionInputs), ...Object.values(motionEdges)]) {
    input.addEventListener('change', saveMotionEffects);
  }
  if (wallSoundInput) wallSoundInput.addEventListener('change', saveSoundPreferences);
  if (wallVolumeInput) {
    wallVolumeInput.addEventListener('input', () => {
      if (wallVolumeValue) wallVolumeValue.textContent = `${wallVolumeInput.value}%`;
    });
    wallVolumeInput.addEventListener('change', saveSoundPreferences);
  }
  if (wallTestButton) {
    wallTestButton.addEventListener('click', () => {
      // Explicit preview only. It does not change presets or sensor permission.
      playWallSound(720, { probe: true });
    });
  }
  sizeInput.min = String(LIMITS.coinSize.min);
  sizeInput.max = String(LIMITS.coinSize.max);
  fadeInput.min = String(LIMITS.fadeDistance.min);
  fadeInput.max = String(LIMITS.fadeDistance.max);
  durationInput.min = String(LIMITS.disappearDuration.min);
  durationInput.max = String(LIMITS.disappearDuration.max);
  form.addEventListener('submit', (event) => event.preventDefault());
  nameInput.addEventListener('input', () => commitName(false));
  nameInput.addEventListener('blur', () => commitName(true));
  for (const input of [sizeInput, xInput, yInput, fadeInput, durationInput]) {
    input.addEventListener('input', commitNumbers);
  }
  edgeGroup.addEventListener('click', (event) => {
    const button = event.target.closest('.edge');
    if (!button) return;
    setEdge(button.dataset.edge);
  });
  edgeGroup.addEventListener('keydown', onEdgeKey);
  if (objectKindInput) {
    objectKindInput.addEventListener('change', () => {
      persistObjectKind(applyObjectKind(objectKindInput.value));
    });
  }
  async function commitWallpaperCrop() {
    try {
      if (await updateWallpaperCrop()) wallpaperNote.textContent = '조정한 배경을 저장했습니다.';
    } catch (error) { wallpaperNote.textContent = error.message || '배경을 조정하지 못했습니다.'; }
  }
  setCropEnabled(false);
  wallpaperInput.addEventListener('change', async () => {
    const file = wallpaperInput.files?.[0];
    if (!file) return;
    const token = wallpaperJobs.next();
    const previousOriginal = wallpaperOriginal;
    const previousPercent = readCropPercent();
    wallpaperOriginal = file;
    cropDrag = null;
    setCropEnabled(false);
    try {
      paintCropChrome(5);
      const output = await croppedWallpaper(file, readCropPercent());
      if (wallpaperJobs.current(token)) {
        const saved = await wallpaperJobs.enqueue(token, async (current) => {
          await imageRecord('wallpaper:original', 'put', file);
          if (!current()) return;
          await imageRecord('wallpaper', 'put', output);
          if (current()) writeWallpaperCrop('5');
        });
        if (saved) {
          setCropEnabled(true);
          showWallpaper(output);
          showWallpaperOriginal(file);
          wallpaperNote.textContent = '배경 원본과 잘라낸 사진을 이 기기에 저장했습니다.';
        }
      }
    } catch (error) {
      if (wallpaperJobs.current(token)) {
        wallpaperOriginal = previousOriginal;
        paintCropChrome(previousPercent);
        setCropEnabled(Boolean(previousOriginal));
        wallpaperNote.textContent = error.message || '배경 사진을 저장하지 못했습니다.';
      }
    }
    wallpaperInput.value = '';
  });
  wallpaperCrop.addEventListener('change', () => { commitWallpaperCrop(); });
  wallpaperCrop.addEventListener('input', () => { paintCropChrome(wallpaperCrop.value); });
  const finishCropDrag = (event) => {
    if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
    const startPercent = cropDrag.startPercent;
    cropDrag = null;
    if (wallpaperFrame.hasPointerCapture(event.pointerId)) wallpaperFrame.releasePointerCapture(event.pointerId);
    if (event.type === 'pointercancel') paintCropChrome(startPercent);
    else if (readCropPercent() !== startPercent) commitWallpaperCrop();
  };
  wallpaperFrame.addEventListener('pointerdown', (event) => {
    if (wallpaperCrop.disabled || cropDrag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = wallpaperFrame.getBoundingClientRect();
    if (!(rect.height > 0)) return;
    const boundaryY = rect.top + rect.height * readCropPercent() / 100;
    const onHandle = Boolean(event.target.closest('#wallpaper-crop-handle'));
    const onOverlay = Boolean(event.target.closest('#wallpaper-crop-overlay'));
    const nearBoundary = Math.abs(event.clientY - boundaryY) <= 28;
    if (!onHandle && !onOverlay && !nearBoundary) return;
    cropDrag = { pointerId: event.pointerId, startY: event.clientY, startPercent: readCropPercent() };
    wallpaperFrame.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  wallpaperFrame.addEventListener('pointermove', (event) => {
    if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
    const height = wallpaperFrame.getBoundingClientRect().height;
    const next = cropPercentFromDrag(cropDrag.startPercent, cropDrag.startY, event.clientY, height);
    paintCropChrome(next);
    event.preventDefault();
  });
  wallpaperFrame.addEventListener('pointerup', finishCropDrag);
  wallpaperFrame.addEventListener('pointercancel', finishCropDrag);
  wallpaperCropHandle.addEventListener('keydown', (event) => {
    if (wallpaperCrop.disabled) return;
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 2 : 0.5;
    const current = readCropPercent();
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? 18
        : event.key === 'ArrowDown' ? current + step
          : current - step;
    if (cropLabel(next) === cropLabel(current)) return;
    paintCropChrome(next);
    commitWallpaperCrop();
  });
  wallpaperClear.addEventListener('click', async () => {
    const token = wallpaperJobs.next();
    wallpaperOriginal = null;
    cropDrag = null;
    try {
      const deleted = await wallpaperJobs.enqueue(token, async (current) => {
        await imageRecord('wallpaper', 'delete');
        if (!current()) return;
        await imageRecord('wallpaper:original', 'delete');
        if (current()) removeWallpaperCrop();
      });
      if (!deleted) return;
      useImageUrl('wallpaper', null);
      wallpaperEl.removeAttribute('src');
      showWallpaperOriginal(null);
      paintCropChrome(0);
      setCropEnabled(false);
      wallpaperControls.hidden = true;
      stageEl.classList.remove('has-wallpaper');
      wallpaperNote.textContent = '기본 배경을 사용합니다.';
    } catch { wallpaperNote.textContent = '배경 사진을 지우지 못했습니다.'; }
  });
  imageChoiceInput.addEventListener('change', () => {
    const choice = imageChoiceInput.value;
    if (choice === 'custom' && !imageUrls.has(`coin:${selected().id}`)) {
      coinImageNote.textContent = '먼저 이 자리에 물건 이미지를 올려 주세요.';
      imageChoiceInput.value = imageChoices[selected().id] || 'kennedy';
      return;
    }
    imageChoices[selected().id] = choice;
    persistImageChoices();
    refreshCoinImage();
  });
  coinImageInput.addEventListener('change', async () => {
    const file = coinImageInput.files?.[0];
    if (!file) return;
    const id = selected().id;
    try {
      const blob = await imageBlob(file, 600);
      await imageRecord(`coin:${id}`, 'put', blob);
      useImageUrl(`coin:${id}`, blob);
      imageChoices[id] = 'custom';
      persistImageChoices();
      refreshCoinImage();
    } catch (error) { coinImageNote.textContent = error.message || '물건 이미지를 저장하지 못했습니다.'; }
    coinImageInput.value = '';
  });
  addButton.addEventListener('click', addPreset);
  deleteButton.addEventListener('click', deleteSelected);
  startButton.addEventListener('click', async () => {
    unlockBreakSound();
    startButton.disabled = true;
    try {
      if (!motionEnabled && Object.values(motionInputs).some((input) => input.checked)) await enableMotion();
      showPerformance({ persistMode: true, keepGone: false });
    } finally {
      startButton.disabled = false;
    }
  });
  motionActivation.addEventListener('click', () => { void enableMotion(); });
  window.addEventListener('touchstart', () => {
    if (state.mode !== 'performance' || !gestureGuide.hidden) return;
    unlockBreakSound();
  }, { capture: true, passive: true });
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  window.addEventListener('pointerup', onPointerUp, { capture: true, passive: false });
  window.addEventListener('pointercancel', onPointerUp, { capture: true, passive: false });
  if ('onpointerrawupdate' in window) {
    window.addEventListener('pointerrawupdate', onPointerMove, { capture: true, passive: false });
  }
  stageEl.addEventListener('touchmove', (event) => {
    if (state.mode === 'performance' && event.cancelable) event.preventDefault();
  }, { passive: false });
  stageEl.addEventListener('contextmenu', (event) => event.preventDefault());
  stageEl.addEventListener('gesturestart', (event) => event.preventDefault());
  stageEl.addEventListener('gesturechange', (event) => event.preventDefault());
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
    window.visualViewport.addEventListener('scroll', onResize);
  }
  if ('serviceWorker' in navigator) {
    const registration = navigator.serviceWorker.register('./sw.js', { scope: './' });
    registration.catch(() => {
      // file:// and locked-down browsers have no offline shell. The page still runs.
    });
    window.MagicUpdate?.init({ registrationPromise: registration, safe: () => state.mode === 'settings' });
  }
}

window.MagicTobiraAppearance = {
  read: readAppearance,
  update: updateAppearance,
  preview: previewAppearance,
};

concealCoin();
loadState();
loadMotionEffects();
applyObjectKind(readObjectKind());
loadImageChoices();
bind();
const imagesReady = loadImages();
renderRecovery();
renderList();
fillForm();
// Start ready without writing the saved mode or requesting motion access.
// Coin disappearance and the crack stay in sessionStorage, not in this record.
showPerformance({ persistMode: false, keepGone: false, showGuide: true });
imagesReady.then(refreshCoinImage, refreshCoinImage);
