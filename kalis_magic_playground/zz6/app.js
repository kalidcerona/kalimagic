import {
  GESTURE_THRESHOLD,
  LIMITS,
  RECOVERY_KEY,
  STORAGE_KEY,
  centerFromPointer,
  coinMetrics,
  createRevisionQueue,
  defaultPreset,
  exitReached,
  exitVelocity,
  fullyOffscreen,
  grabOffset,
  leadingEdgeOvershoot,
  nextPresetName,
  normalizedToStage,
  outwardOffset,
  parseStoredState,
  restingCenter,
  sanitizePreset,
  serializeState,
  stageToNormalized,
  wallpaperCropRect,
  classifyTwoFingerSwipe,
} from './logic.js';

const NOTICE_KEY = 'tobira.v1.notice';
const SESSION_GONE = 'tobira.session-gone';
const PREVIOUS_RECOVERY_KEY = `${RECOVERY_KEY}.previous`;
// Appearance is global. It must not be written into the preset schema.
const OBJECT_KIND_KEY = 'tobira.objectKind.v1';
const OBJECT_KIND_CLASS = Object.freeze({
  coin: 'kind-coin',
  'playing card': 'kind-playing-card',
  'business card': 'kind-business-card',
});
const EDGE_ORDER = ['top', 'left', 'right', 'bottom'];
const MARK_MS = 460;
const SPAWN_SLOP_PX = 12;
const SWIPE_REVEAL_PX = 24;
const IMAGE_CHOICE_KEY = 'tobira.coinChoices.v1';
const IMAGE_DB = 'tobira.localImages.v1';
const DEFAULT_COIN_IMAGES = Object.freeze({ kennedy: './coin-kennedy.png', won500: './coin-500won.png' });

const settingsEl = document.querySelector('#settings');
const stageEl = document.querySelector('#stage');
const coinEl = document.querySelector('#coin');
const cueEl = document.querySelector('#cue');
const recoveryEl = document.querySelector('#recovery');
const presetList = document.querySelector('#preset-list');
const presetPicker = document.querySelector('#preset-picker');
const presetEditor = document.querySelector('#preset-editor');
const selectedPresetName = document.querySelector('#selected-preset-name');
const form = document.querySelector('#preset-form');
const nameInput = document.querySelector('#preset-name');
const sizeInput = document.querySelector('#coin-size');
const sizeValue = document.querySelector('#coin-size-value');
const xInput = document.querySelector('#start-x');
const xValue = document.querySelector('#start-x-value');
const yInput = document.querySelector('#start-y');
const yValue = document.querySelector('#start-y-value');
const fadeInput = document.querySelector('#fade-distance');
const fadeValue = document.querySelector('#fade-value');
const durationInput = document.querySelector('#disappear-duration');
const durationValue = document.querySelector('#duration-value');
const edgeGroup = document.querySelector('#edge-group');
const note = document.querySelector('#form-note');
const addButton = document.querySelector('#add-preset');
const deleteButton = document.querySelector('#delete-preset');
const startButton = document.querySelector('#start-show');
const objectKindInput = document.querySelector('#object-kind');
const wallpaperInput = document.querySelector('#wallpaper-upload');
const wallpaperClear = document.querySelector('#wallpaper-clear');
const wallpaperNote = document.querySelector('#wallpaper-note');
const wallpaperEl = document.querySelector('#stage-wallpaper');
const wallpaperCrop = document.querySelector('#wallpaper-crop');
const wallpaperCropValue = document.querySelector('#wallpaper-crop-value');
const wallpaperPreview = document.querySelector('#wallpaper-preview-image');
const wallpaperControls = document.querySelector('#wallpaper-controls');
const WALLPAPER_CROP_KEY = 'tobira.wallpaperCrop.v1';
let wallpaperOriginal = null;
const wallpaperJobs = createRevisionQueue();
const imageChoiceInput = document.querySelector('#coin-image-choice');
const coinImageInput = document.querySelector('#coin-image-upload');
const coinImageNote = document.querySelector('#coin-image-note');
const coinArt = document.querySelector('#coin-art');

let imageDbPromise;
let imageChoices = {};
const imageUrls = new Map();

function openImageDb() {
  if (imageDbPromise) return imageDbPromise;
  imageDbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(IMAGE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return imageDbPromise;
}

async function imageRecord(key, operation, value) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', operation === 'get' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('images');
    const request = operation === 'put' ? store.put(value, key) : operation === 'delete' ? store.delete(key) : store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function imageBlob(file, maxSide) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG, JPG, WebP 이미지만 올릴 수 있습니다.');
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지를 읽지 못했습니다.')), file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.85));
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function croppedWallpaper(blob, percent) {
  const sourceUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const crop = wallpaperCropRect(image.naturalWidth, image.naturalHeight, percent);
    const scale = Math.min(1, 1600 / Math.max(crop.width, crop.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    canvas.getContext('2d').drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const mime = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    return await new Promise((resolve, reject) => canvas.toBlob((output) => output ? resolve(output) : reject(new Error('배경을 자르지 못했습니다.')), mime, 0.88));
  } finally { URL.revokeObjectURL(sourceUrl); }
}

function showWallpaper(blob) {
  const url = useImageUrl('wallpaper', blob);
  wallpaperEl.src = url;
  wallpaperPreview.src = url;
  wallpaperControls.hidden = false;
  stageEl.classList.add('has-wallpaper');
}

async function updateWallpaperCrop() {
  const source = wallpaperOriginal;
  if (!source) return false;
  const token = wallpaperJobs.next();
  const percent = Number(wallpaperCrop.value);
  wallpaperCropValue.textContent = `${percent}%`;
  try {
    const output = await croppedWallpaper(source, percent);
    if (!wallpaperJobs.current(token)) return false;
    const saved = await wallpaperJobs.enqueue(token, async (current) => {
      await imageRecord('wallpaper:original', 'put', source);
      if (!current()) return;
      await imageRecord('wallpaper', 'put', output);
      if (current()) localStorage.setItem(WALLPAPER_CROP_KEY, String(percent));
    });
    if (!saved) return false;
    showWallpaper(output);
    return true;
  } catch (error) {
    if (!wallpaperJobs.current(token)) return false;
    throw error;
  }
}

function useImageUrl(key, blob) {
  const previous = imageUrls.get(key);
  if (previous) URL.revokeObjectURL(previous);
  if (!blob) { imageUrls.delete(key); return null; }
  const url = URL.createObjectURL(blob);
  imageUrls.set(key, url);
  return url;
}

function chosenCoin(id) {
  const requested = imageChoices[id];
  return requested === 'custom' && imageUrls.has(`coin:${id}`) ? imageUrls.get(`coin:${id}`) : DEFAULT_COIN_IMAGES[requested] || DEFAULT_COIN_IMAGES.kennedy;
}

function refreshCoinImage() {
  coinArt.src = chosenCoin(selected().id);
  imageChoiceInput.value = imageChoices[selected().id] || 'kennedy';
  coinImageNote.textContent = imageUrls.has(`coin:${selected().id}`)
    ? '이 자리에 업로드한 이미지가 저장되어 있습니다.'
    : '투명 배경 PNG를 권장합니다. 업로드하면 이 자리의 이미지로 선택됩니다.';
}

function persistImageChoices() {
  try { localStorage.setItem(IMAGE_CHOICE_KEY, JSON.stringify(imageChoices)); }
  catch { coinImageNote.textContent = '이미지 선택을 저장하지 못했습니다.'; }
}

async function loadImages() {
  try {
    const token = wallpaperJobs.next();
    const savedCrop = localStorage.getItem(WALLPAPER_CROP_KEY);
    wallpaperCrop.value = String(Math.min(18, Math.max(0, Number(savedCrop) || 0)));
    wallpaperCropValue.textContent = `${wallpaperCrop.value}%`;
    const storedOriginal = await imageRecord('wallpaper:original', 'get');
    const wallpaper = await imageRecord('wallpaper', 'get');
    if (wallpaperJobs.current(token) && wallpaper) {
      wallpaperOriginal = storedOriginal || wallpaper;
      showWallpaper(wallpaper);
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
              if (current()) localStorage.setItem(WALLPAPER_CROP_KEY, '5');
            });
            if (saved) {
              wallpaperCrop.value = '5';
              wallpaperCropValue.textContent = '5%';
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
              if (current()) localStorage.setItem(WALLPAPER_CROP_KEY, '0');
              if (!storedOriginal && current()) await imageRecord('wallpaper:original', 'put', wallpaper);
            });
          } catch { /* Keep the already displayed wallpaper. */ }
          wallpaperCrop.value = '0';
          wallpaperCropValue.textContent = '0%';
          wallpaperNote.textContent = '기존 배경을 그대로 표시합니다. 윗부분 자동 자르기에 실패했습니다. 설정에서 다시 조절해 주세요.';
        } else if (wallpaperJobs.current(token)) {
          wallpaperNote.textContent = '기존 배경을 표시합니다. 원본 저장에 실패하여 자르기를 다시 조절할 수 없습니다.';
        }
      }
    }
    if (wallpaperJobs.current(token)) wallpaperCrop.disabled = !wallpaperOriginal;
    for (const preset of state.presets) {
      const blob = await imageRecord(`coin:${preset.id}`, 'get');
      if (blob) useImageUrl(`coin:${preset.id}`, blob);
    }
    refreshCoinImage();
  } catch {
    wallpaperNote.textContent = '이 브라우저에서는 업로드한 이미지를 불러오거나 저장할 수 없습니다.';
  }
}

const pointers = new Map();
let state = null;
let recovery = null;
let dismissedToken = '';
let storageWarning = '';
let phase = 'awaiting';
let center = { x: 0, y: 0 };
let grab = { x: 0, y: 0 };
let dragId = null;
let dragClient = null;
let dragBaseline = null;
let dragSamples = [];
let dragExitEdge = null;
let objectLive = false;
let moved = false;
let gestureFired = false;
let stageRect = null;
let lastStage = { width: 0, height: 0 };
let paintedDiameter = 0;
let exitFrame = 0;
let exitToken = 0;
let deleteArmed = false;
let deleteTimer = 0;
let presetSerial = 0;
let spawnId = null;
let spawnClient = null;
let spawnAtPoint = null;
let spawnCancelled = false;

function selected() {
  return state.presets.find((preset) => preset.id === state.selectedId) || state.presets[0];
}

function replaceSelected(preset) {
  const index = state.presets.findIndex((item) => item.id === preset.id);
  if (index >= 0) state.presets[index] = preset;
}

function createPresetId() {
  presetSerial += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `preset-${Date.now().toString(36)}-${presetSerial.toString(36)}-${random}`;
}

function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

function noticeToken(item) {
  const preserved = typeof item?.preserved === 'string' ? item.preserved : '';
  let hash = 0;
  for (let index = 0; index < preserved.length; index += 1) {
    hash = (hash * 31 + preserved.charCodeAt(index)) | 0;
  }
  return `${item?.reason || 'unknown'}:${preserved.length}:${hash}`;
}

function readGoneSession() {
  try {
    return sessionStorage.getItem(SESSION_GONE) === '1';
  } catch {
    return false;
  }
}

function setGoneSession(gone) {
  try {
    if (gone) sessionStorage.setItem(SESSION_GONE, '1');
    else sessionStorage.removeItem(SESSION_GONE);
  } catch {
    // Session storage is only a reload guard.
  }
}

function stashRecovery(raw) {
  const current = localStorage.getItem(RECOVERY_KEY);
  if (current === raw) return;
  if (current != null) localStorage.setItem(PREVIOUS_RECOVERY_KEY, current);
  localStorage.setItem(RECOVERY_KEY, raw);
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state));
  } catch {
    storageWarning = '이 브라우저 저장소를 쓸 수 없어 변경이 기기에 남지 않습니다.';
    note.textContent = storageWarning;
  }
}

function normalizeObjectKind(value) {
  return Object.hasOwn(OBJECT_KIND_CLASS, value) ? value : 'coin';
}

function readObjectKind() {
  try {
    return normalizeObjectKind(localStorage.getItem(OBJECT_KIND_KEY));
  } catch {
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
    raw = null;
  }
  const parsed = parseStoredState(raw);
  state = parsed.state;
  recovery = parsed.recovery;
  if (!parsed.recovery || typeof raw !== 'string') return;
  try {
    stashRecovery(raw);
    localStorage.setItem(STORAGE_KEY, serializeState(parsed.state));
  } catch {
    storageWarning = '손상된 설정의 원본을 보관하지 못했습니다. 기존 기록은 덮어쓰지 않았습니다.';
  }
}

function clearDeleteArm() {
  deleteArmed = false;
  window.clearTimeout(deleteTimer);
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

function renderList() {
  const focusInside = presetList.contains(document.activeElement);
  presetList.replaceChildren();
  for (const [index, preset] of state.presets.entries()) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.dataset.id = preset.id;
    button.textContent = `${index + 1}. ${preset.name}`;
    const pressed = preset.id === state.selectedId;
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.addEventListener('click', () => selectPreset(preset.id));
    item.append(button);
    presetList.append(item);
  }
  addButton.hidden = state.presets.length >= 3;
  if (focusInside) presetList.querySelector('[aria-pressed="true"]')?.focus();
}

function updateReadouts(preset) {
  sizeValue.textContent = formatPercent(preset.coinSize);
  xValue.textContent = formatPercent(preset.startX);
  yValue.textContent = formatPercent(preset.startY);
  fadeValue.textContent = formatPercent(preset.fadeDistance);
  durationValue.textContent = `${(preset.disappearDuration / 1000).toFixed(2)}초`;
}

function fillForm() {
  const preset = selected();
  selectedPresetName.textContent = preset.name;
  nameInput.value = preset.name;
  sizeInput.value = String(preset.coinSize);
  xInput.value = String(preset.startX);
  yInput.value = String(preset.startY);
  fadeInput.value = String(preset.fadeDistance);
  durationInput.value = String(preset.disappearDuration);
  updateReadouts(preset);
  refreshCoinImage();
  for (const button of edgeGroup.querySelectorAll('.edge')) {
    const on = button.dataset.edge === preset.exitEdge;
    button.setAttribute('aria-checked', on ? 'true' : 'false');
    button.tabIndex = on ? 0 : -1;
  }
}

function selectPreset(id) {
  if (!state.presets.some((preset) => preset.id === id)) return;
  state.selectedId = id;
  clearDeleteArm();
  note.textContent = '';
  persist();
  renderList();
  fillForm();
  presetPicker.open = true;
}

function labelFor(id) {
  const buttons = presetList.querySelectorAll('.preset');
  for (const button of buttons) {
    if (button.dataset.id === id) return button;
  }
  return null;
}

function commitName(fallbackEmpty) {
  const limited = Array.from(nameInput.value).slice(0, LIMITS.nameLength).join('');
  if (limited !== nameInput.value) nameInput.value = limited;
  if (!limited.trim() && !fallbackEmpty) return;
  const result = sanitizePreset({ ...selected(), name: limited.trim() ? limited : '동전' });
  if (!result.ok) return;
  replaceSelected(result.preset);
  const button = labelFor(result.preset.id);
  if (button) button.textContent = `${state.presets.findIndex((item) => item.id === result.preset.id) + 1}. ${result.preset.name}`;
  if (fallbackEmpty) nameInput.value = result.preset.name;
  persist();
}

function commitNumbers() {
  const result = sanitizePreset({
    ...selected(),
    coinSize: Number(sizeInput.value),
    startX: Number(xInput.value),
    startY: Number(yInput.value),
    fadeDistance: Number(fadeInput.value),
    disappearDuration: Number(durationInput.value),
  });
  if (!result.ok) return;
  replaceSelected(result.preset);
  updateReadouts(result.preset);
  clearDeleteArm();
  persist();
}

function setEdge(edge) {
  const result = sanitizePreset({ ...selected(), exitEdge: edge });
  if (!result.ok) return;
  replaceSelected(result.preset);
  clearDeleteArm();
  fillForm();
  persist();
}

function addPreset() {
  if (state.presets.length >= 3) return;
  const result = sanitizePreset({
    ...selected(),
    id: createPresetId(),
    name: nextPresetName(state.presets),
  });
  if (!result.ok) return;
  state.presets.push(result.preset);
  state.selectedId = result.preset.id;
  clearDeleteArm();
  note.textContent = '';
  persist();
  renderList();
  fillForm();
  presetPicker.open = true;
  presetEditor.open = true;
}

function deleteSelected() {
  if (!deleteArmed) {
    deleteArmed = true;
    note.textContent = '한 번 더 누르면 이 프리셋을 삭제합니다.';
    window.clearTimeout(deleteTimer);
    deleteTimer = window.setTimeout(() => {
      deleteArmed = false;
      if (note.textContent.startsWith('한 번 더')) note.textContent = '';
    }, 4000);
    return;
  }
  clearDeleteArm();
  const index = state.presets.findIndex((preset) => preset.id === state.selectedId);
  if (index < 0) return;
  const removedId = state.selectedId;
  state.presets.splice(index, 1);
  delete imageChoices[removedId];
  persistImageChoices();
  useImageUrl(`coin:${removedId}`, null);
  imageRecord(`coin:${removedId}`, 'delete').catch(() => {});
  if (state.presets.length === 0) {
    const fresh = defaultPreset();
    fresh.id = createPresetId();
    const sanitized = sanitizePreset(fresh);
    state.presets.push(sanitized.preset);
    state.selectedId = sanitized.preset.id;
    note.textContent = '마지막 프리셋 자리에는 기본 동전을 다시 두었습니다.';
  } else {
    const next = state.presets[Math.min(index, state.presets.length - 1)];
    state.selectedId = next.id;
    note.textContent = '';
  }
  persist();
  renderList();
  fillForm();
}

function applyChrome(mode) {
  document.body.dataset.mode = mode;
  document.documentElement.removeAttribute('data-boot');
  const performing = mode === 'performance';
  document.title = performing ? '동전' : 'TOBIRA';
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', performing ? '#E4DDD3' : '#F3EBDF');
  settingsEl.inert = performing;
  if (performing) settingsEl.setAttribute('inert', '');
  else settingsEl.removeAttribute('inert');
}

function measureStage() {
  const rect = stageEl.getBoundingClientRect();
  return {
    width: rect.width || window.innerWidth,
    height: rect.height || window.innerHeight,
  };
}

function paintCoin(x, y, radius, opacity, scale) {
  const diameter = radius * 2;
  if (paintedDiameter !== diameter) {
    paintedDiameter = diameter;
    coinEl.style.width = `${diameter}px`;
    coinEl.style.height = `${diameter}px`;
  }
  coinEl.style.transform = `translate3d(${(x - radius).toFixed(3)}px, ${(y - radius).toFixed(3)}px, 0) scale(${scale.toFixed(4)})`;
  coinEl.style.opacity = opacity.toFixed(4);
}

function cancelExit() {
  exitToken += 1;
  if (exitFrame) window.cancelAnimationFrame(exitFrame);
  exitFrame = 0;
}

function endPointers() {
  for (const pointerId of pointers.keys()) releaseCapture(pointerId);
  pointers.clear();
  dragId = null;
  dragClient = null;
  dragBaseline = null;
  gestureFired = false;
  resetSpawnTracking();
}

function concealCoin() {
  objectLive = false;
  coinEl.classList.add('is-gone');
  coinEl.style.opacity = '0';
  coinEl.style.visibility = 'hidden';
}

function releaseCoinVisibility() {
  coinEl.classList.remove('is-gone');
  coinEl.style.visibility = '';
}

function resetSpawnTracking() {
  spawnId = null;
  spawnClient = null;
  spawnAtPoint = null;
  spawnCancelled = false;
}

function spawnTravel(sample) {
  if (!spawnClient || !Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) return 0;
  return Math.hypot(sample.clientX - spawnClient.x, sample.clientY - spawnClient.y);
}

function revealSpawn(point) {
  const stage = measureStage();
  lastStage = stage;
  stageRect = stageEl.getBoundingClientRect();
  const metrics = coinMetrics(selected(), stage);
  center = { x: point.x, y: point.y };
  moved = true;
  objectLive = true;
  phase = 'idle';
  releaseCoinVisibility();
  stageEl.classList.remove('is-leaving', 'is-mark');
  cueEl.style.opacity = '0';
  paintCoin(center.x, center.y, metrics.radius, 1, 1);
  resetSpawnTracking();
}

function placeAtRest() {
  const stage = measureStage();
  lastStage = stage;
  stageRect = stageEl.getBoundingClientRect();
  const rest = restingCenter(selected(), stage);
  center = { x: rest.x, y: rest.y };
  moved = false;
  phase = 'awaiting';
  stageEl.classList.remove('is-leaving', 'is-mark');
  cueEl.style.opacity = '0';
  concealCoin();
  paintCoin(center.x, center.y, rest.radius, 0, 1);
  resetSpawnTracking();
}

function showSettings() {
  cancelExit();
  endPointers();
  setGoneSession(false);
  state.mode = 'settings';
  applyChrome('settings');
  document.documentElement.removeAttribute('data-boot-gone');
  renderList();
  fillForm();
  persist();
}

function showPerformance({ persistMode = true, keepGone = false } = {}) {
  cancelExit();
  endPointers();
  state.mode = 'performance';
  refreshCoinImage();
  applyChrome('performance');
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  placeAtRest();
  if (keepGone) {
    phase = 'gone';
    coinEl.classList.add('is-gone');
    paintCoin(center.x, center.y, coinMetrics(selected(), lastStage).radius, 0, 1);
  } else {
    setGoneSession(false);
  }
  document.documentElement.removeAttribute('data-boot-gone');
  if (persistMode) persist();
}

function beginExit(edge, speed) {
  if (phase === 'exiting' || phase === 'gone') return;
  if (!EDGE_ORDER.includes(edge)) return;
  if (!(speed > 0)) { phase = 'idle'; return; }
  const capturedId = dragId;
  phase = 'exiting';
  dragId = null;
  dragClient = null;
  dragBaseline = null;
  releaseCapture(capturedId);
  const token = exitToken + 1;
  exitToken = token;
  const preset = selected();
  const startedAt = performance.now();
  const originStage = measureStage();
  const origin = stageToNormalized(center.x, center.y, originStage.width, originStage.height);
  stageEl.classList.add('is-leaving');
  stageEl.classList.remove('is-mark');
  releaseCoinVisibility();

  const step = (now) => {
    if (token !== exitToken) return;
    const stageNow = measureStage();
    const metrics = coinMetrics(preset, stageNow);
    const base = normalizedToStage(origin.x, origin.y, stageNow.width, stageNow.height);
    const offset = outwardOffset(edge, speed * Math.max(0, now - startedAt));
    const next = { x: base.x + offset.x, y: base.y + offset.y };
    paintCoin(next.x, next.y, metrics.radius, 1, 1);
    if (!fullyOffscreen(next, metrics.radius, stageNow, edge)) {
      exitFrame = window.requestAnimationFrame(step);
      return;
    }
    phase = 'gone';
    moved = true;
    concealCoin();
    stageEl.classList.remove('is-leaving');
    cueEl.style.opacity = '';
    stageEl.classList.add('is-mark');
    setGoneSession(true);
    window.setTimeout(() => {
      if (token !== exitToken) return;
      stageEl.classList.remove('is-mark');
    }, MARK_MS);
  };
  exitFrame = window.requestAnimationFrame(step);
}

function screenPoint(event) {
  return {
    screenX: Number.isFinite(event.screenX) ? event.screenX : event.clientX,
    screenY: Number.isFinite(event.screenY) ? event.screenY : event.clientY,
  };
}

function pointInStage(event, rect) {
  if (!rect || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function releaseCapture(pointerId) {
  if (pointerId == null) return;
  try {
    if (stageEl.hasPointerCapture(pointerId)) stageEl.releasePointerCapture(pointerId);
  } catch {
    // The pointer may already have been released.
  }
}

function rebasePointers() {
  for (const entry of pointers.values()) {
    entry.start = { screenX: entry.last.screenX, screenY: entry.last.screenY };
  }
}

function maybeClassify() {
  if (state.mode !== 'performance' || gestureFired || pointers.size !== 2) return;
  const [first, second] = [...pointers.values()];
  const kind = classifyTwoFingerSwipe(first.start, second.start, first.last, second.last, GESTURE_THRESHOLD);
  if (kind === 'none') return;
  gestureFired = true;
  if (kind === 'settings') showSettings();
  else resetCoin();
}

function resetCoin() {
  cancelExit();
  setGoneSession(false);
  document.documentElement.removeAttribute('data-boot-gone');
  placeAtRest();
}

function pointerTravel(sample, origin) {
  if (!origin || !Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) return 0;
  return Math.hypot(sample.clientX - origin.x, sample.clientY - origin.y);
}

// The exit edge is whichever stage edge this drag newly reaches.
// A short tap, or an object that already overhangs where it was grabbed, does not count
// until the finger actually pushes farther out.
function exitEdgeReached(next, radius, stage, travel) {
  let chosen = null;
  let best = -Infinity;
  for (const edge of EDGE_ORDER) {
    const overshoot = leadingEdgeOvershoot(next, radius, stage, edge);
    if (!exitReached(overshoot)) continue;
    const baseline = dragBaseline && Number.isFinite(dragBaseline[edge]) ? dragBaseline[edge] : -Infinity;
    if (exitReached(baseline)) {
      if (!(travel > SPAWN_SLOP_PX) || !(overshoot > baseline)) continue;
    } else if (!(overshoot > baseline)) {
      continue;
    }
    if (overshoot > best) {
      chosen = edge;
      best = overshoot;
    }
  }
  return chosen;
}

function captureDragBaseline(radius, stage) {
  dragBaseline = {};
  for (const edge of EDGE_ORDER) {
    const overshoot = leadingEdgeOvershoot(center, radius, stage, edge);
    dragBaseline[edge] = Number.isFinite(overshoot) ? overshoot : 0;
  }
}

function applyDragSample(sample) {
  if (phase !== 'dragging' || pointers.size !== 1 || gestureFired) return;
  const local = pointInStage(sample, stageRect);
  if (!local) return;
  const preset = selected();
  const metrics = coinMetrics(preset, lastStage);
  const next = centerFromPointer(local, grab);
  if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return;
  const t = Number.isFinite(sample.timeStamp) ? sample.timeStamp : performance.now();
  dragSamples.push({ x: next.x, y: next.y, t });
  dragSamples = dragSamples.filter((item) => t - item.t <= 80);
  const edge = exitEdgeReached(next, metrics.radius, lastStage, pointerTravel(sample, dragClient));
  if (edge) dragExitEdge = edge;
  center = next;
  moved = true;
  objectLive = true;
  paintCoin(center.x, center.y, metrics.radius, 1, 1);
  if (dragExitEdge && fullyOffscreen(next, metrics.radius, lastStage, dragExitEdge)) {
    phase = 'gone';
    dragId = null;
    dragClient = null;
    dragBaseline = null;
    concealCoin();
    setGoneSession(true);
  }
}

function startDrag(event) {
  phase = 'dragging';
  dragId = event.pointerId;
  dragExitEdge = null;
  dragSamples = [];
  stageRect = stageEl.getBoundingClientRect();
  lastStage = measureStage();
  dragClient = {
    x: Number.isFinite(event.clientX) ? event.clientX : 0,
    y: Number.isFinite(event.clientY) ? event.clientY : 0,
  };
  captureDragBaseline(coinMetrics(selected(), lastStage).radius, lastStage);
  const local = pointInStage(event, stageRect);
  if (!local) return;
  grab = grabOffset(local, center);
  dragSamples.push({ x: center.x, y: center.y, t: Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now() });
}

function onPointerDown(event) {
  if (state.mode !== 'performance') return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const screen = screenPoint(event);
  pointers.set(event.pointerId, { start: screen, last: screen });
  try {
    stageEl.setPointerCapture(event.pointerId);
  } catch {
    // Some pointers cannot be captured; window listeners still track them.
  }
  if (event.cancelable) event.preventDefault();
  if (pointers.size >= 2) {
    rebasePointers();
    if (phase === 'dragging') {
      phase = 'idle';
      dragId = null;
      dragClient = null;
      dragBaseline = null;
    }
    if (phase === 'awaiting') spawnCancelled = true;
    return;
  }
  if (phase === 'awaiting') {
    if (spawnCancelled) return;
    stageRect = stageEl.getBoundingClientRect();
    const local = pointInStage(event, stageRect);
    const inside = local
      && local.x >= 0
      && local.y >= 0
      && local.x <= stageRect.width
      && local.y <= stageRect.height;
    if (!inside) return;
    spawnId = event.pointerId;
    spawnClient = { x: event.clientX, y: event.clientY };
    spawnAtPoint = { x: local.x, y: local.y };
    return;
  }
  const onCoin = event.target instanceof Element && event.target.closest('#coin');
  if (phase === 'idle' && onCoin) startDrag(event);
}

function onPointerMove(event) {
  if (state.mode !== 'performance') return;
  const entry = pointers.get(event.pointerId);
  if (!entry) return;
  if (event.cancelable) event.preventDefault();
  const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : null;
  const list = samples && samples.length ? samples : [event];
  for (const sample of list) {
    entry.last = screenPoint(sample);
    if (phase === 'dragging' && event.pointerId === dragId && pointers.size === 1) {
      applyDragSample(sample);
    }
    if (phase === 'awaiting' && (pointers.size !== 1 || spawnTravel(sample) > SPAWN_SLOP_PX)) {
      if (pointers.size === 1 && !spawnCancelled && event.pointerId === spawnId && spawnTravel(sample) >= SWIPE_REVEAL_PX) {
        const local = pointInStage(sample, stageRect);
        if (local) revealSpawn(local);
      } else if (pointers.size !== 1) spawnCancelled = true;
    }
  }
  maybeClassify();
}

function onPointerUp(event) {
  const entry = pointers.get(event.pointerId);
  if (entry) entry.last = screenPoint(event);
  if (event.type === 'pointercancel') spawnCancelled = true;
  maybeClassify();
  if (event.type !== 'pointercancel' && phase === 'dragging' && event.pointerId === dragId) applyDragSample(event);
  const wasDrag = event.pointerId === dragId;
  const canSpawn = phase === 'awaiting'
    && event.pointerId === spawnId
    && !spawnCancelled
    && event.type !== 'pointercancel'
    && spawnAtPoint
    && pointers.size === 1;
  const releasePoint = canSpawn && spawnTravel(event) > SPAWN_SLOP_PX
    ? pointInStage(event, stageRect) || spawnAtPoint
    : spawnAtPoint;
  pointers.delete(event.pointerId);
  releaseCapture(event.pointerId);
  if (canSpawn) revealSpawn(releasePoint);
  if (wasDrag && phase === 'dragging') {
    const edge = dragExitEdge;
    const speed = edge ? exitVelocity(dragSamples, edge) : 0;
    dragId = null;
    dragClient = null;
    dragBaseline = null;
    phase = 'idle';
    if (edge) beginExit(edge, speed);
  }
  if (pointers.size === 2) rebasePointers();
  if (pointers.size === 0) {
    gestureFired = false;
    resetSpawnTracking();
  }
}

function onResize() {
  if (state.mode !== 'performance') return;
  const next = measureStage();
  stageRect = stageEl.getBoundingClientRect();
  if (!(next.width > 0) || !(next.height > 0)) return;
  if (phase === 'dragging') {
    phase = 'idle';
    dragId = null;
    dragClient = null;
    dragBaseline = null;
  }
  // Empty and leaving surfaces stay empty. A live object keeps its normalized center.
  if (!objectLive || phase === 'exiting' || phase === 'gone' || phase === 'awaiting') {
    lastStage = next;
    return;
  }
  if (lastStage.width > 0 && lastStage.height > 0) {
    const normalized = stageToNormalized(center.x, center.y, lastStage.width, lastStage.height);
    center = normalizedToStage(normalized.x, normalized.y, next.width, next.height);
  }
  const metrics = coinMetrics(selected(), next);
  paintCoin(center.x, center.y, metrics.radius, 1, 1);
  lastStage = next;
}

function onEdgeKey(event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const current = EDGE_ORDER.indexOf(selected().exitEdge);
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
  const next = EDGE_ORDER[(current + (forward ? 1 : EDGE_ORDER.length - 1)) % EDGE_ORDER.length];
  setEdge(next);
  edgeGroup.querySelector(`[data-edge="${next}"]`)?.focus();
}

function bind() {
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
  wallpaperInput.addEventListener('change', async () => {
    const file = wallpaperInput.files?.[0];
    if (!file) return;
    const token = wallpaperJobs.next();
    const previousOriginal = wallpaperOriginal;
    wallpaperOriginal = file;
    try {
      wallpaperCrop.value = '5';
      const output = await croppedWallpaper(file, Number(wallpaperCrop.value));
      if (wallpaperJobs.current(token)) {
        const saved = await wallpaperJobs.enqueue(token, async (current) => {
          await imageRecord('wallpaper:original', 'put', file);
          if (!current()) return;
          await imageRecord('wallpaper', 'put', output);
          if (current()) localStorage.setItem(WALLPAPER_CROP_KEY, '5');
        });
        if (saved) {
          wallpaperCropValue.textContent = '5%';
          wallpaperCrop.disabled = false;
          showWallpaper(output);
          wallpaperNote.textContent = '배경 원본과 잘라낸 사진을 이 기기에 저장했습니다.';
        }
      }
    } catch (error) {
      if (wallpaperJobs.current(token)) {
        wallpaperOriginal = previousOriginal;
        wallpaperNote.textContent = error.message || '배경 사진을 저장하지 못했습니다.';
      }
    }
    wallpaperInput.value = '';
  });
  wallpaperCrop.addEventListener('change', async () => {
    try {
      if (await updateWallpaperCrop()) wallpaperNote.textContent = '조정한 배경을 저장했습니다.';
    } catch (error) { wallpaperNote.textContent = error.message || '배경을 조정하지 못했습니다.'; }
  });
  wallpaperCrop.addEventListener('input', () => { wallpaperCropValue.textContent = `${wallpaperCrop.value}%`; });
  wallpaperClear.addEventListener('click', async () => {
    const token = wallpaperJobs.next();
    wallpaperOriginal = null;
    try {
      const deleted = await wallpaperJobs.enqueue(token, async (current) => {
        await imageRecord('wallpaper', 'delete');
        if (!current()) return;
        await imageRecord('wallpaper:original', 'delete');
        if (current()) localStorage.removeItem(WALLPAPER_CROP_KEY);
      });
      if (!deleted) return;
      useImageUrl('wallpaper', null);
      wallpaperEl.removeAttribute('src');
      wallpaperPreview.removeAttribute('src');
      wallpaperControls.hidden = true;
      stageEl.classList.remove('has-wallpaper');
      wallpaperNote.textContent = '기본 배경을 사용합니다.';
    } catch { wallpaperNote.textContent = '배경 사진을 지우지 못했습니다.'; }
  });
  imageChoiceInput.addEventListener('change', () => {
    const choice = imageChoiceInput.value;
    if (choice === 'custom' && !imageUrls.has(`coin:${selected().id}`)) {
      coinImageNote.textContent = '먼저 이 자리에 동전 이미지를 올려 주세요.';
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
    } catch (error) { coinImageNote.textContent = error.message || '동전 이미지를 저장하지 못했습니다.'; }
    coinImageInput.value = '';
  });
  addButton.addEventListener('click', addPreset);
  deleteButton.addEventListener('click', deleteSelected);
  startButton.addEventListener('click', () => showPerformance({ persistMode: true, keepGone: false }));
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !event.shiftKey || event.repeat) return;
    if (state.mode !== 'performance') return;
    event.preventDefault();
    showSettings();
  });
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
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // file:// and locked-down browsers have no offline shell. The page still runs.
    });
  }
}

concealCoin();
loadState();
applyObjectKind(readObjectKind());
try {
  const storedChoices = JSON.parse(localStorage.getItem(IMAGE_CHOICE_KEY) || '{}');
  if (storedChoices && typeof storedChoices === 'object' && !Array.isArray(storedChoices)) imageChoices = storedChoices;
} catch { imageChoices = {}; }
bind();
const imagesReady = loadImages();
renderRecovery();
renderList();
fillForm();
if (state.mode === 'performance') {
  imagesReady.then(
    () => showPerformance({ persistMode: false, keepGone: readGoneSession() }),
    () => showPerformance({ persistMode: false, keepGone: readGoneSession() }),
  );
} else {
  applyChrome('settings');
  setGoneSession(false);
  document.documentElement.removeAttribute('data-boot-gone');
}
