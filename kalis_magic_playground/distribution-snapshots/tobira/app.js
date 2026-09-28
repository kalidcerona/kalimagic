import {
  GESTURE_THRESHOLD,
  LIMITS,
  RECOVERY_KEY,
  STORAGE_KEY,
  centerFromPointer,
  coinMetrics,
  createRevisionQueue,
  cropPercentFromDrag,
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
import { advanceTiltBody, fallPosition, gravityTiltVector, isBreakthroughSnap, orientationTiltVector, outwardTravel, shakeImpulse } from './sensor-motion.js';

const gestureGuide = document.getElementById('settings-gesture-guide');
const gestureGuideDismiss = document.getElementById('settings-gesture-dismiss');
const GESTURE_GUIDE_KEY = 'friend-tobira.settings-gesture-guide.v1';
let gestureGuideShown = false;

function maybeShowGestureGuide() {
  if (gestureGuideShown) return;
  try {
    if (localStorage.getItem(GESTURE_GUIDE_KEY) === 'done') return;
  } catch { /* Private browsing can block storage. */ }
  gestureGuideShown = true;
  gestureGuide.hidden = false;
  gestureGuideDismiss.focus();
}

function hideGestureGuide() {
  gestureGuide.hidden = true;
}

gestureGuideDismiss.addEventListener('click', () => {
  hideGestureGuide();
  try { localStorage.setItem(GESTURE_GUIDE_KEY, 'done'); } catch { /* Keep this session dismissed. */ }
});
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
  gestureGuide.addEventListener(type, (event) => event.stopPropagation());
}

const NOTICE_KEY = 'friend-tobira.v1.notice';
const SESSION_GONE = 'friend-tobira.session-gone';
const SESSION_CRACK = 'friend-tobira.session-crack';
const SESSION_CRACK_AT = `${SESSION_CRACK}-at`;
const PREVIOUS_RECOVERY_KEY = `${RECOVERY_KEY}.previous`;
// Appearance is global. It must not be written into the preset schema.
const OBJECT_KIND_KEY = 'friend-tobira.objectKind.v1';
const OBJECT_KIND_CLASS = Object.freeze({
  coin: 'kind-coin',
  'playing card': 'kind-playing-card',
  'business card': 'kind-business-card',
});
const EDGE_ORDER = ['top', 'left', 'right', 'bottom'];
const SPAWN_SLOP_PX = 12;
const SWIPE_REVEAL_PX = 24;
const IMAGE_CHOICE_KEY = 'friend-tobira.coinChoices.v1';
const IMAGE_DB = 'friend-tobira.localImages.v1';
const DEFAULT_COIN_IMAGES = Object.freeze({
  kennedy: './coin-kennedy.png',
  won500: './coin-500won.png',
  riderRed: './card-rider-red.jpg',
  riderBlue: './card-rider-blue.jpg',
});

const settingsEl = document.querySelector('#settings');
const stageEl = document.querySelector('#stage');
const breakthroughEl = document.querySelector('#breakthrough');
const coinEl = document.querySelector('#coin');
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
const wallpaperFrame = document.querySelector('#wallpaper-preview');
const wallpaperCropOverlay = document.querySelector('#wallpaper-crop-overlay');
const wallpaperCropHandle = document.querySelector('#wallpaper-crop-handle');
const wallpaperControls = document.querySelector('#wallpaper-controls');
const WALLPAPER_CROP_KEY = 'friend-tobira.wallpaperCrop.v1';
let wallpaperOriginal = null;
let cropDrag = null;
const wallpaperJobs = createRevisionQueue();
const imageChoiceInput = document.querySelector('#coin-image-choice');
const coinImageInput = document.querySelector('#coin-image-upload');
const coinImageNote = document.querySelector('#coin-image-note');
const coinArt = document.querySelector('#coin-art');
const motionToggle = document.querySelector('#motion-enabled');
const motionNote = document.querySelector('#motion-note');
const motionActivation = document.querySelector('#motion-activate');
const MOTION_SETTINGS_KEY = 'friend-tobira.motion-effects.v1';
const motionInputs = {
  tilt: motionToggle,
  exit: document.querySelector('#motion-exit'),
  breakthrough: document.querySelector('#motion-breakthrough'),
  wobble: document.querySelector('#motion-wobble'),
};
const motionEdges = Object.fromEntries(['top', 'left', 'right', 'bottom'].map((edge) =>
  [edge, document.querySelector(`#motion-edge-${edge}`)]));
const DEFAULT_MOTION_EFFECTS = Object.freeze({
  tilt: true, exit: false, breakthrough: true, wobble: false,
  edges: ['right'],
});
let motionEffects = { ...DEFAULT_MOTION_EFFECTS };
let motionPermissionDenied = false;

function loadMotionEffects() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOTION_SETTINGS_KEY) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      motionEffects = {
        tilt: typeof saved.tilt === 'boolean' ? saved.tilt : true,
        exit: saved.exit === true,
        breakthrough: typeof saved.breakthrough === 'boolean' ? saved.breakthrough : true,
        wobble: saved.wobble === true,
        edges: Array.isArray(saved.edges) ? EDGE_ORDER.filter((edge) => saved.edges.includes(edge)) : ['right'],
      };
      if (motionEffects.exit) motionEffects.tilt = true;
    }
  } catch { /* Use safe defaults for damaged settings or unavailable storage. */ }
  for (const [key, input] of Object.entries(motionInputs)) input.checked = motionEffects[key];
  for (const [edge, input] of Object.entries(motionEdges)) input.checked = motionEffects.edges.includes(edge);
}

function saveMotionEffects() {
  motionPermissionDenied = false;
  if (motionInputs.exit.checked) motionInputs.tilt.checked = true;
  motionEffects = {
    ...Object.fromEntries(Object.entries(motionInputs).map(([key, input]) => [key, input.checked])),
    edges: EDGE_ORDER.filter((edge) => motionEdges[edge].checked),
  };
  try { localStorage.setItem(MOTION_SETTINGS_KEY, JSON.stringify(motionEffects)); }
  catch { motionNote.textContent = '센서 설정을 저장하지 못했습니다. 이번 실행에서는 계속 사용할 수 있습니다.'; }
  unlockBreakSound();
  if (!motionEffects.tilt && tiltFrame) {
    window.cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
  }
  if (!Object.values(motionInputs).some((input) => input.checked)) disableMotion();
  else if (!motionEnabled) void enableMotion();
  updateMotionActivation();
}

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

function cropAmount(percent) {
  const snapped = Math.round((Number(percent) || 0) * 2) / 2;
  return Math.min(18, Math.max(0, snapped));
}

function cropLabel(percent) {
  const value = cropAmount(percent);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function readCropPercent() {
  return cropAmount(wallpaperCrop.value);
}

function paintCropChrome(percent) {
  const label = cropLabel(percent);
  wallpaperCrop.value = label;
  wallpaperCropValue.textContent = `${label}%`;
  wallpaperCropOverlay.style.height = `${label}%`;
  wallpaperCropHandle.style.top = `${label}%`;
  wallpaperCropHandle.setAttribute('aria-valuenow', label);
  wallpaperCropHandle.setAttribute('aria-valuetext', `${label}%`);
}

function setCropEnabled(enabled) {
  wallpaperCrop.disabled = !enabled;
  wallpaperCropHandle.tabIndex = enabled ? 0 : -1;
  wallpaperCropHandle.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

function showWallpaper(blob) {
  const url = useImageUrl('wallpaper', blob);
  wallpaperEl.src = url;
  wallpaperControls.hidden = false;
  stageEl.classList.add('has-wallpaper');
}

function showWallpaperOriginal(blob) {
  const url = useImageUrl('wallpaper-preview', blob);
  if (!url) wallpaperPreview.removeAttribute('src');
  else {
    wallpaperPreview.src = url;
    wallpaperControls.hidden = false;
  }
}

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
              if (current()) localStorage.setItem(WALLPAPER_CROP_KEY, '5');
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
              if (current()) localStorage.setItem(WALLPAPER_CROP_KEY, '0');
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
let pinch = null;
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
let motionEnabled = false;
let motionRequestId = 0;
let motionRequestPending = false;
let upright = false;
let lastOrientationAt = -Infinity;
let activeOutwardDirection = null;
let shakeSample = null;
let lastShakeAt = -Infinity;
let lastSnapAt = -Infinity;
let audioContext = null;
let breakthroughLatched = false;
let fallFrame = 0;
let fallToken = 0;
let wobbleFrame = 0;
let wobbleToken = 0;
let wobbleX = 0;
let wobbleY = 0;
let wobbleAngle = 0;
let tiltVector = { x: 0, y: 0 };
let tiltBody = null;
let tiltFrame = 0;
let tiltLastAt = 0;

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

let crackNormalized = null;

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}

function parseCrackPoint(raw) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clampUnit(x), y: clampUnit(y) };
}

function formatCrackPoint(point) {
  return `${clampUnit(point.x).toFixed(6)},${clampUnit(point.y).toFixed(6)}`;
}

function readCrackSession() {
  try {
    const flagged = sessionStorage.getItem(SESSION_CRACK) === '1';
    if (!breakthroughLatched && !flagged) return false;
    // A legacy flag has no coordinates. Leave the point empty so paint can fall back once.
    if (!crackNormalized) crackNormalized = parseCrackPoint(sessionStorage.getItem(SESSION_CRACK_AT));
    return true;
  } catch { return breakthroughLatched; }
}

function setCrackSession(cracked) {
  breakthroughLatched = cracked;
  try {
    if (cracked) {
      sessionStorage.setItem(SESSION_CRACK, '1');
      if (crackNormalized && Number.isFinite(crackNormalized.x) && Number.isFinite(crackNormalized.y)) {
        sessionStorage.setItem(SESSION_CRACK_AT, formatCrackPoint(crackNormalized));
      }
    } else {
      crackNormalized = null;
      sessionStorage.removeItem(SESSION_CRACK);
      sessionStorage.removeItem(SESSION_CRACK_AT);
    }
  } catch { /* Keep the current visual state in memory. */ }
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

// Narrow bridge for the shared customizer. Values stay on the selected preset.
function appearanceNumber(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readAppearance() {
  const preset = selected();
  return {
    coinSize: preset.coinSize,
    startX: preset.startX,
    startY: preset.startY,
  };
}

function previewAspect(choice) {
  if (choice === 'riderRed') return 649 / 929;
  if (choice === 'riderBlue') return 661 / 1038;
  const art = coinArt;
  if (choice === 'custom' && art && art.naturalWidth > 0 && art.naturalHeight > 0) {
    return art.naturalWidth / art.naturalHeight;
  }
  return 1;
}

function previewAppearance() {
  const preset = selected();
  const choice = imageChoices[preset.id] || 'kennedy';
  const image = chosenCoin(preset.id);
  const art = coinArt;
  const loaded = art && art.naturalWidth > 0 && art.naturalHeight > 0
    && typeof art.src === 'string' && art.src.endsWith(String(image).replace(/^\.\//, ''));
  return {
    image,
    widthRatio: preset.coinSize,
    aspectRatio: loaded ? art.naturalWidth / art.naturalHeight : previewAspect(choice),
    startX: preset.startX,
    startY: preset.startY,
  };
}

function updateAppearance(value) {
  const current = selected();
  const patch = value && typeof value === 'object' ? value : {};
  const result = sanitizePreset({
    ...current,
    coinSize: appearanceNumber(patch.coinSize, current.coinSize),
    startX: appearanceNumber(patch.startX, current.startX),
    startY: appearanceNumber(patch.startY, current.startY),
  });
  if (!result.ok) return Promise.resolve(readAppearance());
  replaceSelected(result.preset);
  sizeInput.value = String(result.preset.coinSize);
  xInput.value = String(result.preset.startX);
  yInput.value = String(result.preset.startY);
  updateReadouts(result.preset);
  clearDeleteArm();
  persist();
  if (objectLive && phase === 'idle' && state.mode === 'performance') paintLiveCoin();
  return Promise.resolve(readAppearance());
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
  if (theme) theme.setAttribute('content', '#000000');
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
  coinEl.style.transform = `translate3d(${(x - radius + wobbleX).toFixed(3)}px, ${(y - radius + wobbleY).toFixed(3)}px, 0) rotate(${wobbleAngle.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
  coinEl.style.opacity = opacity.toFixed(4);
}

function paintLiveCoin() {
  if (!objectLive || phase !== 'idle' || state.mode !== 'performance') return;
  const metrics = coinMetrics(selected(), measureStage());
  paintCoin(center.x, center.y, metrics.radius, 1, 1);
}

function cancelFall() {
  fallToken += 1;
  if (fallFrame) window.cancelAnimationFrame(fallFrame);
  fallFrame = 0;
  if (activeOutwardDirection && phase === 'exiting') phase = 'idle';
  activeOutwardDirection = null;
}

function cancelWobble() {
  wobbleToken += 1;
  if (wobbleFrame) window.cancelAnimationFrame(wobbleFrame);
  wobbleFrame = 0;
  wobbleX = 0;
  wobbleY = 0;
  wobbleAngle = 0;
}

function cancelSensorEffects() {
  cancelFall();
  cancelWobble();
  if (tiltFrame) window.cancelAnimationFrame(tiltFrame);
  tiltFrame = 0;
  tiltLastAt = 0;
  tiltBody = null;
}

function unlockBreakSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    audioContext ||= new AudioContextClass();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
  } catch { audioContext = null; }
}

function playBreakSound() {
  if (!audioContext || audioContext.state !== 'running') return;
  try {
    const now = audioContext.currentTime;
    // Start the audible transient before the noise buffer is filled.
    const thump = audioContext.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(125, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + .25);
    const thumpGain = audioContext.createGain();
    thumpGain.gain.setValueAtTime(.5, now);
    thumpGain.gain.exponentialRampToValueAtTime(.001, now + .22);
    thump.connect(thumpGain).connect(audioContext.destination);
    thump.start(now);
    thump.stop(now + .22);

    const length = Math.ceil(audioContext.sampleRate * .28);
    const noise = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const crack = audioContext.createBufferSource();
    crack.buffer = noise;
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 850;
    const crackGain = audioContext.createGain();
    crackGain.gain.setValueAtTime(.45, now);
    crackGain.gain.exponentialRampToValueAtTime(.001, now + .28);
    crack.connect(highpass).connect(crackGain).connect(audioContext.destination);
    crack.start(now);
    crack.stop(now + .28);
  } catch { /* Keep the visual effect if audio output fails. */ }
}

function playWallSound(speed) {
  if (!audioContext || audioContext.state !== 'running') return;
  try {
    const now = audioContext.currentTime;
    const level = Math.min(0.22, Math.max(0.045, speed / 3600));
    const tap = audioContext.createOscillator();
    const gain = audioContext.createGain();
    tap.type = 'triangle';
    tap.frequency.setValueAtTime(230, now);
    tap.frequency.exponentialRampToValueAtTime(85, now + 0.075);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    tap.connect(gain).connect(audioContext.destination);
    tap.start(now);
    tap.stop(now + 0.09);
  } catch { /* The collision remains visual when audio is unavailable. */ }
}

function clearBreakthrough() {
  stageEl.classList.remove('is-breaking', 'is-breaking-play');
  if (breakthroughEl) {
    breakthroughEl.style.left = '';
    breakthroughEl.style.top = '';
  }
  setCrackSession(false);
}

function breakthroughSpawn() {
  if (readCrackSession() || !motionEffects.breakthrough || state.mode !== 'performance' || !gestureGuide.hidden || pointers.size !== 0 ||
    !['idle', 'awaiting', 'gone'].includes(phase)) return false;
  // The live center has to be sampled before cancellation or conceal moves it.
  const crackPoint = resolveCrackPoint();
  if (!crackPoint) return false;
  cancelSensorEffects();
  phase = 'gone';
  concealCoin();
  setGoneSession(true);
  crackNormalized = crackPoint;
  applyCrackPosition(crackPoint);
  // Force the first crack animation to start from its initial frame.
  void stageEl.offsetWidth;
  stageEl.classList.add('is-breaking', 'is-breaking-play');
  setCrackSession(true);
  playBreakSound();
  return true;
}

// Stage fractions use width and height separately, matching stageToNormalized.
// An unusable stage returns null instead of that helper's center fallback.
function stageCrackPoint(point, stage) {
  const width = Number(stage?.width);
  const height = Number(stage?.height);
  if (!(width > 0) || !(height > 0) || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  const x = Math.min(width, Math.max(0, point.x));
  const y = Math.min(height, Math.max(0, point.y));
  return { x: x / width, y: y / height };
}

// Live objects use their visual center. A hidden or ejected object keeps its last
// stage point, clamped to the stage edge, and never invents the stage center.
function resolveCrackPoint() {
  const stage = measureStage();
  if (objectLive && Number.isFinite(center?.x) && Number.isFinite(center?.y)) {
    return stageCrackPoint({
      x: center.x + (Number.isFinite(wobbleX) ? wobbleX : 0),
      y: center.y + (Number.isFinite(wobbleY) ? wobbleY : 0),
    }, stage);
  }
  if (!Number.isFinite(center?.x) || !Number.isFinite(center?.y)) return null;
  return stageCrackPoint(center, stage);
}

function applyCrackPosition(normalized) {
  if (!breakthroughEl || !Number.isFinite(normalized?.x) || !Number.isFinite(normalized?.y)) return;
  const x = Math.min(1, Math.max(0, normalized.x));
  const y = Math.min(1, Math.max(0, normalized.y));
  breakthroughEl.style.left = `${(x * 100).toFixed(4)}%`;
  breakthroughEl.style.top = `${(y * 100).toFixed(4)}%`;
}

function startFall() {
  if (motionEffects.tilt) { startTiltTracking(); return; }
  if (!motionEnabled || !upright || state.mode !== 'performance' || phase !== 'idle' || !objectLive || pointers.size !== 0 || stageEl.classList.contains('is-breaking')) return;
  const stage = measureStage();
  const radius = coinMetrics(selected(), stage).radius;
  const floor = Math.max(radius, stage.height - radius);
  if (center.y >= floor - 1) return;
  cancelFall();
  const token = fallToken;
  const startedAt = performance.now();
  const startY = center.y;
  const step = (now) => {
    if (token !== fallToken || !motionEnabled || phase !== 'idle' || !objectLive || state.mode !== 'performance') return;
    const currentStage = measureStage();
    const currentRadius = coinMetrics(selected(), currentStage).radius;
    const currentFloor = Math.max(currentRadius, currentStage.height - currentRadius);
    center.y = fallPosition(startY, currentFloor, now - startedAt);
    paintCoin(center.x, center.y, currentRadius, 1, 1);
    if (center.y < currentFloor - 0.5) fallFrame = window.requestAnimationFrame(step);
    else fallFrame = 0;
  };
  fallFrame = window.requestAnimationFrame(step);
}

function startTiltTracking() {
  if (!motionEnabled || !motionEffects.tilt || state.mode !== 'performance' ||
    phase !== 'idle' || !objectLive || pointers.size !== 0 ||
    stageEl.classList.contains('is-breaking') || activeOutwardDirection || tiltFrame) return;
  tiltBody ||= { x: center.x, y: center.y, vx: 0, vy: 0, collisions: 0 };
  tiltLastAt = 0;
  const step = (now) => {
    tiltFrame = 0;
    if (!motionEnabled || !motionEffects.tilt || state.mode !== 'performance' ||
      phase !== 'idle' || !objectLive || pointers.size !== 0 ||
      stageEl.classList.contains('is-breaking') || activeOutwardDirection) return;
    const stage = measureStage();
    const radius = coinMetrics(selected(), stage).radius;
    const elapsed = tiltLastAt ? now - tiltLastAt : 16;
    tiltLastAt = now;
    const exitEdges = motionEffects.exit ? motionEffects.edges : [];
    const result = advanceTiltBody(tiltBody, tiltVector, stage, radius, elapsed, exitEdges);
    tiltBody = result.body;
    for (const impact of result.impacts) playWallSound(impact.speed);
    center = { x: tiltBody.x, y: tiltBody.y };
    paintLiveCoin();
    if (result.exit) {
      startOutwardFall(result.exit, result.exitSpeed);
      return;
    }
    tiltFrame = window.requestAnimationFrame(step);
  };
  tiltFrame = window.requestAnimationFrame(step);
}

function startOutwardFall(direction, impactSpeed = 0) {
  if (!motionEnabled || !motionEffects.exit || !motionEffects.edges.includes(direction) || !direction || state.mode !== 'performance' || phase !== 'idle' ||
    !objectLive || pointers.size !== 0 || stageEl.classList.contains('is-breaking')) return;
  if (tiltFrame) window.cancelAnimationFrame(tiltFrame);
  tiltFrame = 0;
  if (activeOutwardDirection === direction) return;
  cancelFall();
  activeOutwardDirection = direction;
  phase = 'exiting';
  const token = fallToken;
  const startedAt = performance.now();
  const start = { ...center };
  const launchSpeed = Math.max(0, impactSpeed);
  const step = (now) => {
    if (token !== fallToken || !motionEnabled || phase !== 'exiting' || !objectLive || state.mode !== 'performance') return;
    const stage = measureStage();
    const radius = coinMetrics(selected(), stage).radius;
    const travel = outwardTravel(launchSpeed, now - startedAt, 550);
    center.x = start.x + (direction === 'right' ? travel : direction === 'left' ? -travel : 0);
    center.y = start.y + (direction === 'bottom' ? travel : direction === 'top' ? -travel : 0);
    paintCoin(center.x, center.y, radius, 1, 1);
    if (!fullyOffscreen(center, radius, stage, direction)) {
      fallFrame = window.requestAnimationFrame(step);
    } else {
      fallFrame = 0;
      phase = 'gone';
      concealCoin();
      setGoneSession(true);
      activeOutwardDirection = null;
    }
  };
  fallFrame = window.requestAnimationFrame(step);
}

function startWobble(magnitude) {
  if (!motionEnabled || !motionEffects.wobble || state.mode !== 'performance' || phase !== 'idle' ||
    !objectLive || pointers.size !== 0 || stageEl.classList.contains('is-breaking')) return;
  cancelWobble();
  const token = wobbleToken;
  const startedAt = performance.now();
  const amplitude = Math.min(15, Math.max(7, magnitude * 0.8));
  const step = (now) => {
    if (token !== wobbleToken || !motionEnabled || phase !== 'idle' || !objectLive || state.mode !== 'performance') return;
    const elapsed = Math.max(0, now - startedAt);
    if (elapsed >= 650) {
      cancelWobble();
      paintLiveCoin();
      return;
    }
    const fade = (1 - elapsed / 650) ** 2;
    wobbleX = Math.sin(elapsed * 0.057) * amplitude * fade;
    wobbleY = Math.sin(elapsed * 0.043) * amplitude * 0.35 * fade;
    wobbleAngle = Math.sin(elapsed * 0.065) * Math.min(11, amplitude * 0.75) * fade;
    paintLiveCoin();
    wobbleFrame = window.requestAnimationFrame(step);
  };
  wobbleFrame = window.requestAnimationFrame(step);
}

function applyTilt(vector) {
  if (!vector) return;
  tiltVector = vector;
  if (motionEffects.tilt) startTiltTracking();
}

function onDeviceOrientation(event) {
  if (!motionEnabled) return;
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  lastOrientationAt = performance.now();
  const screenAngle = window.screen?.orientation?.angle ?? window.orientation;
  applyTilt(orientationTiltVector({ beta: event.beta, gamma: event.gamma, screenAngle }));
}

function onDeviceMotion(event) {
  if (!motionEnabled) return;
  const gravity = event.accelerationIncludingGravity;
  const gravityMagnitude = gravity && Number.isFinite(gravity.x) && Number.isFinite(gravity.y) && Number.isFinite(gravity.z)
    ? Math.hypot(gravity.x, gravity.y, gravity.z) : 0;
  if (performance.now() - lastOrientationAt > 750 && gravityMagnitude >= 7 && gravityMagnitude <= 12) {
    applyTilt(gravityTiltVector(gravity, {
      screenAngle: window.screen?.orientation?.angle ?? window.orientation,
    }));
  }
  if (state.mode !== 'performance') {
    shakeSample = null;
    return;
  }
  const impulse = shakeImpulse(event, shakeSample);
  shakeSample = impulse.sample;
  if (!impulse.detected) return;
  const now = performance.now();
  if (motionEffects.breakthrough && isBreakthroughSnap(impulse, now, lastSnapAt)) {
    if (breakthroughSpawn()) lastSnapAt = now;
    return;
  }
  if (!motionEffects.wobble || !objectLive) return;
  if (now - lastShakeAt < 700) return;
  lastShakeAt = now;
  startWobble(impulse.magnitude);
}

function disableMotion(message = '선택한 기기 움직임 연출이 없습니다.') {
  motionRequestId += 1;
  motionRequestPending = false;
  motionEnabled = false;
  upright = false;
  lastOrientationAt = -Infinity;
  shakeSample = null;
  cancelSensorEffects();
  window.removeEventListener('deviceorientation', onDeviceOrientation);
  window.removeEventListener('devicemotion', onDeviceMotion);
  motionNote.textContent = message;
  updateMotionActivation();
  paintLiveCoin();
}

function updateMotionActivation() {
  const selected = Object.values(motionInputs).some((input) => input.checked);
  motionActivation.hidden = state?.mode !== 'settings' || !selected || motionEnabled;
  motionActivation.disabled = motionRequestPending;
  motionActivation.textContent = motionRequestPending ? '센서 연결 중…' :
    motionPermissionDenied ? '센서 연결 실패 · 다시 시도' : '움직임 켜기';
}

async function enableMotion() {
  if (!Object.values(motionEffects).some((enabled) => enabled === true)) return;
  if (motionEnabled || motionRequestPending) return;
  const requestId = ++motionRequestId;
  motionRequestPending = true;
  updateMotionActivation();
  if (motionEffects.breakthrough) unlockBreakSound();
  if (window.isSecureContext === false) {
    motionPermissionDenied = true;
    disableMotion('센서는 HTTPS에서만 사용할 수 있습니다. 손가락 연출은 그대로 사용할 수 있습니다.');
    return;
  }
  const orientationAvailable = 'DeviceOrientationEvent' in window || 'ondeviceorientation' in window;
  const motionAvailable = 'DeviceMotionEvent' in window || 'ondevicemotion' in window;
  if (!orientationAvailable && !motionAvailable) {
    motionPermissionDenied = true;
    disableMotion('이 기기의 브라우저는 움직임 센서를 지원하지 않습니다.');
    return;
  }
  try {
    // Start both permission requests in this user-initiated event before awaiting either one.
    const requests = [];
    const requestedSensors = [];
    if (orientationAvailable && typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
      requests.push(window.DeviceOrientationEvent.requestPermission());
      requestedSensors.push('orientation');
    }
    if (motionAvailable && typeof window.DeviceMotionEvent?.requestPermission === 'function') {
      requests.push(window.DeviceMotionEvent.requestPermission());
      requestedSensors.push('motion');
    }
    const permissions = await Promise.allSettled(requests);
    if (requestId !== motionRequestId) return;
    const allowed = (sensor) => {
      const index = requestedSensors.indexOf(sensor);
      return index < 0 || permissions[index].status === 'fulfilled' && permissions[index].value === 'granted';
    };
    const useOrientation = orientationAvailable && allowed('orientation');
    const useMotion = motionAvailable && allowed('motion');
    if (!useOrientation && !useMotion) {
      motionPermissionDenied = true;
      disableMotion('센서 권한이 없어 움직임 연출을 켜지 못했습니다.');
      return;
    }
    motionEnabled = true;
    motionPermissionDenied = false;
    motionRequestPending = false;
    lastOrientationAt = -Infinity;
    if (useOrientation) window.addEventListener('deviceorientation', onDeviceOrientation);
    if (useMotion) window.addEventListener('devicemotion', onDeviceMotion);
    motionNote.textContent = useOrientation && useMotion
      ? '선택한 움직임 연출을 사용할 수 있습니다.'
      : useOrientation ? '기울기 연출을 사용할 수 있습니다. 이 기기에서는 스냅과 흔들기를 사용할 수 없습니다.'
        : '움직임 센서를 사용할 수 있습니다.';
    updateMotionActivation();
  } catch {
    if (requestId === motionRequestId) {
      motionPermissionDenied = true;
      disableMotion('센서 권한을 받지 못했습니다. 손가락 연출은 그대로 사용할 수 있습니다.');
    }
  }
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
  pinch = null;
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

function revealSpawn(point, { sensorFall = true } = {}) {
  const stage = measureStage();
  lastStage = stage;
  stageRect = stageEl.getBoundingClientRect();
  const metrics = coinMetrics(selected(), stage);
  center = { x: point.x, y: point.y };
  moved = true;
  objectLive = true;
  phase = 'idle';
  releaseCoinVisibility();
  stageEl.classList.remove('is-leaving');
  paintCoin(center.x, center.y, metrics.radius, 1, 1);
  resetSpawnTracking();
  if (sensorFall) startFall();
}

function placeAtRest() {
  cancelSensorEffects();
  const stage = measureStage();
  lastStage = stage;
  stageRect = stageEl.getBoundingClientRect();
  const rest = restingCenter(selected(), stage);
  center = { x: rest.x, y: rest.y };
  moved = false;
  phase = 'awaiting';
  stageEl.classList.remove('is-leaving');
  concealCoin();
  paintCoin(center.x, center.y, rest.radius, 0, 1);
  resetSpawnTracking();
}

function showSettings() {
  hideGestureGuide();
  cancelExit();
  cancelSensorEffects();
  endPointers();
  setGoneSession(false);
  state.mode = 'settings';
  applyChrome('settings');
  updateMotionActivation();
  document.documentElement.removeAttribute('data-boot-gone');
  renderList();
  fillForm();
  persist();
}

function showPerformance({ persistMode = true, keepGone = false } = {}) {
  const keepCrack = keepGone && readCrackSession();
  if (!keepGone) clearBreakthrough();
  cancelExit();
  endPointers();
  state.mode = 'performance';
  refreshCoinImage();
  applyChrome('performance');
  updateMotionActivation();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  placeAtRest();
  if (keepGone) {
    phase = 'gone';
    coinEl.classList.add('is-gone');
    paintCoin(center.x, center.y, coinMetrics(selected(), lastStage).radius, 0, 1);
    if (keepCrack) {
      // Legacy sessions stored only the flag. Keep that crack visible at the old center.
      applyCrackPosition(crackNormalized || { x: 0.5, y: 0.5 });
      stageEl.classList.add('is-breaking');
      setCrackSession(true);
    }
  } else {
    setGoneSession(false);
  }
  document.documentElement.removeAttribute('data-boot-gone');
  if (persistMode) persist();
  maybeShowGestureGuide();
}

function beginExit(edge, speed) {
  if (phase === 'exiting' || phase === 'gone') return;
  if (!EDGE_ORDER.includes(edge)) return;
  if (!(speed > 0)) { phase = 'idle'; return; }
  cancelSensorEffects();
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
  releaseCoinVisibility();

  const step = (now) => {
    if (token !== exitToken) return;
    const stageNow = measureStage();
    const metrics = coinMetrics(preset, stageNow);
    const base = normalizedToStage(origin.x, origin.y, stageNow.width, stageNow.height);
    const offset = outwardOffset(edge, speed * Math.max(0, now - startedAt));
    const next = { x: base.x + offset.x, y: base.y + offset.y };
    center = next;
    paintCoin(next.x, next.y, metrics.radius, 1, 1);
    if (!fullyOffscreen(next, metrics.radius, stageNow, edge)) {
      exitFrame = window.requestAnimationFrame(step);
      return;
    }
    phase = 'gone';
    moved = true;
    concealCoin();
    stageEl.classList.remove('is-leaving');
    setGoneSession(true);
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

function pointerDistance(first, second) {
  return Math.hypot(first.last.screenX - second.last.screenX,
    first.last.screenY - second.last.screenY);
}

function finishPinch() {
  if (!pinch) return;
  if (pinch.active) {
    persist();
    if (state.mode === 'settings') fillForm();
  }
  pinch = null;
}

function maybePinch() {
  if (!pinch || gestureFired || pointers.size !== 2 || state.mode !== 'performance') return false;
  const [first, second] = [...pointers.values()];
  const distance = pointerDistance(first, second);
  if (!pinch.active) {
    const driftX = ((first.last.screenX - first.start.screenX) +
      (second.last.screenX - second.start.screenX)) / 2;
    const driftY = ((first.last.screenY - first.start.screenY) +
      (second.last.screenY - second.start.screenY)) / 2;
    if (Math.abs(distance - pinch.startDistance) < 18 || Math.hypot(driftX, driftY) > 36) return false;
    pinch.active = true;
    cancelSensorEffects();
  }
  const size = Math.min(LIMITS.coinSize.max, Math.max(LIMITS.coinSize.min,
    Math.round(pinch.startSize * distance / pinch.startDistance * 100) / 100));
  if (size !== selected().coinSize) {
    replaceSelected({ ...selected(), coinSize: size });
    paintLiveCoin();
  }
  return true;
}

function maybeClassify() {
  if (pinch?.active) return;
  if (state.mode !== 'performance' || gestureFired || pointers.size !== 2) return;
  const [first, second] = [...pointers.values()];
  const kind = classifyTwoFingerSwipe(first.start, second.start, first.last, second.last, GESTURE_THRESHOLD);
  if (kind === 'none') return;
  gestureFired = true;
  pinch = null;
  if (kind === 'settings') showSettings();
  else resetCoin();
}

function resetCoin() {
  cancelExit();
  clearBreakthrough();
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
  cancelSensorEffects();
  paintLiveCoin();
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
  if (state.mode !== 'performance' || !gestureGuide.hidden) return;
  unlockBreakSound();
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const screen = screenPoint(event);
  pointers.set(event.pointerId, { start: screen, last: screen,
    onCoin: event.target instanceof Element && Boolean(event.target.closest('#coin')) });
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
    if (pointers.size === 2 && phase === 'idle' && objectLive) {
      const entries = [...pointers.values()];
      const distance = pointerDistance(entries[0], entries[1]);
      const nearCoin = event.target instanceof Element && Boolean(event.target.closest('#coin')) ||
        entries.some((entry) => entry.onCoin);
      pinch = nearCoin && distance >= 24 ?
        { startDistance: distance, startSize: selected().coinSize, active: false } : null;
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
  if (!maybePinch()) maybeClassify();
}

function onPointerUp(event) {
  const entry = pointers.get(event.pointerId);
  if (entry) entry.last = screenPoint(event);
  if (event.type === 'pointercancel') spawnCancelled = true;
  if (!maybePinch()) maybeClassify();
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
  if (pinch && pointers.size === 2) finishPinch();
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
    pinch = null;
    gestureFired = false;
    resetSpawnTracking();
    startFall();
  }
}

function onResize() {
  if (state.mode !== 'performance') return;
  if (activeOutwardDirection && phase === 'exiting') {
    lastStage = measureStage();
    stageRect = stageEl.getBoundingClientRect();
    return;
  }
  cancelSensorEffects();
  const next = measureStage();
  stageRect = stageEl.getBoundingClientRect();
  if (!(next.width > 0) || !(next.height > 0)) return;
  if (crackNormalized) applyCrackPosition(crackNormalized);
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
  startFall();
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
  for (const input of [...Object.values(motionInputs), ...Object.values(motionEdges)]) {
    input.addEventListener('change', saveMotionEffects);
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
          if (current()) localStorage.setItem(WALLPAPER_CROP_KEY, '5');
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
        if (current()) localStorage.removeItem(WALLPAPER_CROP_KEY);
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
    startButton.disabled = true;
    try {
      if (!motionEnabled && Object.values(motionInputs).some((input) => input.checked)) await enableMotion();
      showPerformance({ persistMode: true, keepGone: false });
    } finally {
      startButton.disabled = false;
    }
  });
  motionActivation.addEventListener('click', () => { void enableMotion(); });
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

window.MagicTobiraAppearance = {
  read: readAppearance,
  update: updateAppearance,
  preview: previewAppearance,
};

concealCoin();
loadState();
loadMotionEffects();
applyObjectKind(readObjectKind());
try {
  const storedChoices = JSON.parse(localStorage.getItem(IMAGE_CHOICE_KEY) || '{}');
  if (storedChoices && typeof storedChoices === 'object' && !Array.isArray(storedChoices)) imageChoices = storedChoices;
} catch { imageChoices = {}; }
bind();
if (typeof window.DeviceOrientationEvent?.requestPermission !== 'function' &&
    typeof window.DeviceMotionEvent?.requestPermission !== 'function') void enableMotion();
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
