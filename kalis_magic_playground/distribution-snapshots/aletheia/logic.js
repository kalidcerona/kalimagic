// Pure preset, geometry, and gesture rules for ALETHEIA.
// No DOM, storage, or network access lives in this file.

export const LIMITS = Object.freeze({
  maxPresets: 8,
  maxNameLength: 24,
  maxImageBytes: 6 * 1024 * 1024,
  minBrush: 12,
  maxBrush: 140,
  defaultBrush: 46,
  minCoverage: 40,
  maxCoverage: 260,
  defaultCoverage: 110,
  minHidden: 0,
  maxHidden: 100,
  defaultHidden: 100,
  gestureDistance: 96,
  stageCount: 4,
  stageUnlockRatio: 0.6,
  maxMaskSide: 1600,
  gradualStampAlpha: 0.22,
  allowedMime: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
});

export const MODES = Object.freeze(['free', 'gradual', 'stages']);

export const PHOTO_SET_COUNT = 3;
export const PHOTO_SLOT_COUNT = 12;
const PHOTO_ID_RE = /^img_[A-Za-z0-9_-]{1,44}$/;

export function emptyPhotoSets() {
  return Array.from({ length: PHOTO_SET_COUNT }, () => Array(PHOTO_SLOT_COUNT).fill(null));
}

export function parsePhotoSets(raw, legacyRaw = null) {
  if (raw == null && legacyRaw == null) return { ok: true, needsMigration: false, sets: emptyPhotoSets() };
  let value;
  try { value = JSON.parse(raw == null ? legacyRaw : raw); } catch { return { ok: false }; }
  const legacy = raw == null;
  const sets = legacy ? [value?.imageIds, ...emptyPhotoSets().slice(1)] : value?.sets;
  if (value?.version !== (legacy ? 1 : 2) || !Array.isArray(sets) || sets.length !== PHOTO_SET_COUNT) return { ok: false };
  if (!sets.every((ids) => Array.isArray(ids) && ids.length === PHOTO_SLOT_COUNT
    && ids.every((id) => id === null || (typeof id === 'string' && PHOTO_ID_RE.test(id))))) return { ok: false };
  return { ok: true, needsMigration: legacy, sets: sets.map((ids) => ids.slice()) };
}

export const MODE_LABELS = Object.freeze({
  free: '자유 스크래치',
  gradual: '서서히 공개',
  stages: '단계 공개',
});

export const MODE_HINTS = Object.freeze({
  free: '문지른 자리가 바로 열립니다.',
  gradual: '같은 자리를 여러 번 문질러야 조금씩 드러납니다.',
  stages: '위쪽 구역부터 순서대로 열립니다. 현재 구역만 문지를 수 있습니다.',
});

export const TITLES = Object.freeze({
  settings: 'ALETHEIA',
  performance: '이미지',
  installed: '이미지',
});

export const VEIL_COLOR = '#121212';
export const STAGE_COLOR = '#000000';
export const ERASED_ALPHA_MAX = 128;

export const MESSAGES = Object.freeze({
  nameRequired: '이름을 입력하세요. 최대 24자입니다.',
  nameTooLong: '이름은 24자 이하여야 합니다.',
  nameInvalid: '이름에 사용할 수 없는 문자가 있습니다.',
  modeInvalid: '공개 방식은 자유 스크래치, 서서히 공개, 단계 공개 중에서 고르세요.',
  brushInvalid: '붓 크기는 12에서 140 사이의 숫자여야 합니다.',
  hiddenInvalid: '처음 가림 비율은 비우거나 0에서 100 사이의 숫자여야 합니다.',
  imageRequired: '공개할 이미지를 선택하세요.',
  imageEmpty: '이미지 파일이 비어 있습니다. 기존 데이터는 바꾸지 않았습니다.',
  imageTooLarge: '이미지는 6MB 이하여야 합니다. 이 파일은 저장하지 않았고, 기존 데이터도 바꾸지 않았습니다.',
  imageType: 'JPEG, PNG, WEBP, GIF 이미지만 사용할 수 있습니다. 기존 데이터는 바꾸지 않았습니다.',
  tooManyPresets: '프리셋은 최대 8개까지 저장할 수 있습니다. 기존 프리셋은 유지됩니다.',
  metaCorrupt: '저장된 프리셋 정보를 해석할 수 없습니다. 기존 데이터는 자동으로 지우지 않았습니다.',
  storageFailed: '저장에 실패했습니다. 기존 데이터는 바꾸지 않았습니다.',
  storageReadFailed: '저장된 데이터를 읽지 못했습니다. 기존 값을 바꾸지 않도록 저장을 막아 두었습니다.',
  imageStoreFailed: '이미지를 저장하지 못했습니다. 기존 프리셋은 바꾸지 않았습니다.',
  imageReadFailed: '이미지를 불러오지 못했습니다. 프리셋은 그대로 두었습니다.',
  dbOpenFailed: '이미지 저장소를 열지 못했습니다. 프리셋 목록은 바꾸지 않았습니다.',
  imageMissing: '이 프리셋의 이미지를 찾지 못했습니다. 프리셋 목록은 유지했습니다.',
  imageDecodeFailed: '이미지를 열 수 없습니다. 프리셋은 유지했습니다.',
  imageDeleteFailed: '프리셋 목록에서는 뺐지만 이미지 파일을 지우지 못했습니다. 다른 프리셋은 그대로입니다.',
  previousImageKept: '프리셋은 저장했습니다. 이전 이미지 파일은 지우지 못했습니다.',
  resetImagesFailed: '프리셋 목록은 비웠지만 일부 이미지를 지우지 못했습니다.',
  choosePreset: '공연할 프리셋을 선택하세요.',
  saved: '저장했습니다.',
  repaired: '읽을 수 있는 프리셋만 다시 저장했습니다.',
});

const PRESET_ID_RE = /^p_[A-Za-z0-9_-]{1,46}$/;
const IMAGE_ID_RE = /^img_[A-Za-z0-9_-]{1,44}$/;
const ALLOWED_MIME = new Set(LIMITS.allowedMime);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function emptyMeta() {
  return {
    version: 1,
    selectedId: null,
    presets: [],
  };
}

export function canAddPreset(count) {
  return Number.isInteger(count) && count >= 0 && count < LIMITS.maxPresets;
}

export function createId(prefix = 'p', uuid) {
  const head = prefix === 'img' ? 'img' : 'p';
  let body = '';
  if (typeof uuid === 'function') {
    const value = uuid();
    if (typeof value === 'string') body = value.replace(/[^A-Za-z0-9_-]/g, '');
  }
  if (!body) {
    body = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  let id = `${head}_${body}`;
  if (id.length > 48) id = id.slice(0, 48);
  const pattern = head === 'img' ? IMAGE_ID_RE : PRESET_ID_RE;
  if (!pattern.test(id)) {
    id = `${head}_${Math.random().toString(36).slice(2, 12)}`;
  }
  return id;
}

function nameError(name) {
  if (typeof name !== 'string') return MESSAGES.nameRequired;
  const trimmed = name.trim();
  if (!trimmed) return MESSAGES.nameRequired;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return MESSAGES.nameInvalid;
  if (Array.from(trimmed).length > LIMITS.maxNameLength) return MESSAGES.nameTooLong;
  return null;
}

function parseBrushInput(value) {
  const number = Math.round(Number(value));
  if (!Number.isInteger(number) || number < LIMITS.minBrush || number > LIMITS.maxBrush) return null;
  return number;
}

function parseBrushStored(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < LIMITS.minBrush || value > LIMITS.maxBrush) return null;
  return value;
}

function parseHiddenInput(value) {
  if (value == null || value === '') return { ok: true, value: null };
  const number = Math.round(Number(value));
  if (!Number.isInteger(number) || number < LIMITS.minHidden || number > LIMITS.maxHidden) {
    return { ok: false, value: null };
  }
  return { ok: true, value: number };
}

export function validateImage(image, options = {}) {
  const required = Boolean(options.required);
  if (!image) {
    return required
      ? { ok: false, error: MESSAGES.imageRequired }
      : { ok: true, value: null };
  }
  const mime = typeof image.mime === 'string' ? image.mime.toLowerCase() : '';
  if (!ALLOWED_MIME.has(mime)) return { ok: false, error: MESSAGES.imageType };
  const bytes = Number(image.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: MESSAGES.imageEmpty };
  if (bytes > LIMITS.maxImageBytes) return { ok: false, error: MESSAGES.imageTooLarge };
  return { ok: true, value: { mime, bytes } };
}

export function validatePresetInput(input) {
  const source = isPlainObject(input) ? input : {};
  const nameProblem = nameError(source.name);
  if (nameProblem) return { ok: false, error: nameProblem };
  if (!MODES.includes(source.mode)) return { ok: false, error: MESSAGES.modeInvalid };
  const brushSize = parseBrushInput(source.brushSize);
  if (brushSize == null) return { ok: false, error: MESSAGES.brushInvalid };
  const hidden = parseHiddenInput(source.hiddenPercent);
  if (!hidden.ok) return { ok: false, error: MESSAGES.hiddenInvalid };
  const image = validateImage(
    source.hasImage
      ? { bytes: source.imageBytes, mime: source.imageMime }
      : null,
    { required: Boolean(source.imageRequired) },
  );
  if (!image.ok) return image;
  return {
    ok: true,
    value: {
      name: source.name.trim(),
      mode: source.mode,
      brushSize,
      hiddenPercent: hidden.value,
      image: image.value,
    },
  };
}

function inspectPreset(input, lenient) {
  if (!isPlainObject(input)) return { ok: false };
  if (typeof input.id !== 'string' || !PRESET_ID_RE.test(input.id)) return { ok: false };
  if (nameError(input.name)) return { ok: false };
  if (!MODES.includes(input.mode)) return { ok: false };
  const brushSize = parseBrushStored(input.brushSize);
  if (brushSize == null) return { ok: false };

  let hiddenPercent;
  if (!Object.prototype.hasOwnProperty.call(input, 'hiddenPercent')) {
    if (!lenient) return { ok: false };
    hiddenPercent = null;
  } else if (input.hiddenPercent === null) {
    hiddenPercent = null;
  } else if (typeof input.hiddenPercent !== 'number' || !Number.isInteger(input.hiddenPercent)
    || input.hiddenPercent < LIMITS.minHidden || input.hiddenPercent > LIMITS.maxHidden) {
    return { ok: false };
  } else {
    hiddenPercent = input.hiddenPercent;
  }

  if (typeof input.imageId !== 'string' || !IMAGE_ID_RE.test(input.imageId)) return { ok: false };
  const imageMime = typeof input.imageMime === 'string' ? input.imageMime.toLowerCase() : '';
  if (!ALLOWED_MIME.has(imageMime)) return { ok: false };

  let updatedAt;
  if (!Object.prototype.hasOwnProperty.call(input, 'updatedAt')
    || typeof input.updatedAt !== 'number'
    || !Number.isFinite(input.updatedAt)
    || input.updatedAt < 0) {
    if (!lenient) return { ok: false };
    updatedAt = 0;
  } else {
    updatedAt = input.updatedAt;
  }

  return {
    ok: true,
    value: {
      id: input.id,
      name: input.name.trim(),
      mode: input.mode,
      brushSize,
      hiddenPercent,
      imageId: input.imageId,
      imageMime,
      updatedAt,
    },
  };
}

function decodeMeta(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (isPlainObject(raw)) return raw;
  return undefined;
}

export function parseMeta(raw) {
  try {
    const data = decodeMeta(raw);
    if (!isPlainObject(data)) return { ok: false, reason: 'json' };
    if (data.version !== 1) return { ok: false, reason: 'version' };
    if (!Array.isArray(data.presets)) return { ok: false, reason: 'shape' };
    if (data.presets.length > LIMITS.maxPresets) return { ok: false, reason: 'count' };

    const presets = [];
    const seen = new Set();
    for (const item of data.presets) {
      const inspected = inspectPreset(item, false);
      if (!inspected.ok) return { ok: false, reason: 'preset' };
      if (seen.has(inspected.value.id)) return { ok: false, reason: 'duplicate' };
      seen.add(inspected.value.id);
      presets.push(inspected.value);
    }

    let selectedId = null;
    if (Object.prototype.hasOwnProperty.call(data, 'selectedId') && data.selectedId != null) {
      if (typeof data.selectedId !== 'string' || !seen.has(data.selectedId)) {
        return { ok: false, reason: 'selection' };
      }
      selectedId = data.selectedId;
    }

    return {
      ok: true,
      meta: {
        version: 1,
        selectedId,
        presets,
      },
    };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export function salvageMeta(raw) {
  try {
    const data = decodeMeta(raw);
    if (!isPlainObject(data) || !Array.isArray(data.presets)) {
      return { meta: emptyMeta(), kept: 0, dropped: 0, recognized: false };
    }
    const presets = [];
    const seen = new Set();
    let dropped = 0;
    for (const item of data.presets) {
      const inspected = inspectPreset(item, true);
      if (!inspected.ok || seen.has(inspected.value.id) || presets.length >= LIMITS.maxPresets) {
        dropped += 1;
        continue;
      }
      seen.add(inspected.value.id);
      presets.push(inspected.value);
    }
    const selectedId = typeof data.selectedId === 'string' && seen.has(data.selectedId)
      ? data.selectedId
      : null;
    return {
      meta: { version: 1, selectedId, presets },
      kept: presets.length,
      dropped,
      recognized: true,
    };
  } catch {
    return { meta: emptyMeta(), kept: 0, dropped: 0, recognized: false };
  }
}

export function normalizedHiddenPercent(hiddenPercent) {
  if (hiddenPercent == null || hiddenPercent === '') return LIMITS.defaultHidden;
  const number = Number(hiddenPercent);
  if (!Number.isFinite(number)) return LIMITS.defaultHidden;
  return Math.min(LIMITS.maxHidden, Math.max(LIMITS.minHidden, number));
}

export function containRect(containerW, containerH, imageW, imageH) {
  const cw = Number(containerW);
  const ch = Number(containerH);
  const iw = Number(imageW);
  const ih = Number(imageH);
  if (!(cw > 0) || !(ch > 0) || !(iw > 0) || !(ih > 0)) return null;
  if (![cw, ch, iw, ih].every(Number.isFinite)) return null;
  const scale = Math.min(cw / iw, ch / ih);
  const w = iw * scale;
  const h = ih * scale;
  return {
    x: (cw - w) / 2,
    y: (ch - h) / 2,
    w,
    h,
    scale,
  };
}

export function maskDimensions(imageW, imageH, maxSide = LIMITS.maxMaskSide) {
  const iw = Math.floor(Number(imageW));
  const ih = Math.floor(Number(imageH));
  const cap = Math.floor(Number(maxSide));
  if (!(iw > 0) || !(ih > 0) || !(cap > 0)) return null;
  const scale = Math.min(1, cap / Math.max(iw, ih));
  return {
    w: Math.max(1, Math.round(iw * scale)),
    h: Math.max(1, Math.round(ih * scale)),
  };
}

export function mapPointerToMask(clientX, clientY, view, imageRect, maskW, maskH) {
  const maskWidth = Number(maskW);
  const maskHeight = Number(maskH);
  if (!view || !(Number(view.width) > 0) || !(Number(view.height) > 0)) {
    return { x: 0, y: 0, inside: false };
  }
  if (!imageRect || !(Number(imageRect.w) > 0) || !(Number(imageRect.h) > 0)) {
    return { x: 0, y: 0, inside: false };
  }
  if (!(maskWidth > 0) || !(maskHeight > 0)) return { x: 0, y: 0, inside: false };
  const localX = Number(clientX) - Number(view.left);
  const localY = Number(clientY) - Number(view.top);
  const nx = (localX - Number(imageRect.x)) / Number(imageRect.w);
  const ny = (localY - Number(imageRect.y)) / Number(imageRect.h);
  return {
    x: nx * maskWidth,
    y: ny * maskHeight,
    inside: nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1,
  };
}

export function interpolatePoints(x0, y0, x1, y1, spacing) {
  const gap = Number(spacing);
  if (!(gap > 0) || !Number.isFinite(gap)) {
    throw new Error('spacing must be positive');
  }
  const coords = [x0, y0, x1, y1].map(Number);
  if (!coords.every(Number.isFinite)) return [];
  const [sx, sy, ex, ey] = coords;
  const dx = ex - sx;
  const dy = ey - sy;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [];
  const steps = Math.ceil(distance / gap);
  const points = [];
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    points.push({ x: sx + dx * t, y: sy + dy * t });
  }
  return points;
}

export function brushSpacing(diameter) {
  const size = Number(diameter);
  if (!(size > 0) || !Number.isFinite(size)) return 1;
  return Math.max(1, size * 0.3);
}

export function brushDiameterInMask(brushCss, imageCssWidth, maskWidth) {
  const brush = Number(brushCss);
  const viewW = Number(imageCssWidth);
  const maskW = Number(maskWidth);
  if (!(brush > 0) || !(viewW > 0) || !(maskW > 0)) return 0;
  if (![brush, viewW, maskW].every(Number.isFinite)) return 0;
  return brush * (maskW / viewW);
}

export function normalizeCoverage(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= LIMITS.minCoverage && number <= LIMITS.maxCoverage
    ? number : LIMITS.defaultCoverage;
}

function dominantDown(pointer) {
  if (!pointer || typeof pointer !== 'object') return false;
  const dx = Number(pointer.dx);
  const dy = Number(pointer.dy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  return dy >= LIMITS.gestureDistance && dy >= Math.abs(dx);
}

function dominantUp(pointer) {
  if (!pointer || typeof pointer !== 'object') return false;
  const dx = Number(pointer.dx);
  const dy = Number(pointer.dy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  const up = -dy;
  return up >= LIMITS.gestureDistance && up >= Math.abs(dx);
}

export function isSettingsSwipe(pointers) {
  return Array.isArray(pointers) && pointers.length === 2 && pointers.every(dominantDown);
}

export function isResetSwipe(pointers) {
  return Array.isArray(pointers) && pointers.length === 2 && pointers.every(dominantUp);
}

export function classifyGesture(pointers) {
  if (isSettingsSwipe(pointers)) return 'settings';
  if (isResetSwipe(pointers)) return 'reset';
  return 'none';
}

export function allowsRevealStroke(activePointerCount, multiTouchGroup) {
  return activePointerCount === 1 && multiTouchGroup !== true;
}

export function stageBands(width, height, count = LIMITS.stageCount) {
  const w = Math.floor(Number(width));
  const h = Math.floor(Number(height));
  const n = Math.floor(Number(count));
  if (!(w > 0) || !(h > 0) || !(n > 0)) return [];
  const base = Math.floor(h / n);
  const remainder = h % n;
  const bands = [];
  let y = 0;
  for (let index = 0; index < n; index += 1) {
    const bandH = base + (index < remainder ? 1 : 0);
    bands.push({ index, x: 0, y, w, h: bandH });
    y += bandH;
  }
  return bands;
}

export function initialStageRatios(hiddenPercent, count = LIMITS.stageCount) {
  const n = Math.floor(Number(count));
  if (!(n > 0)) return [];
  const hidden = normalizedHiddenPercent(hiddenPercent);
  const openCount = Math.min(n, Math.floor(((100 - hidden) / 100) * n + 1e-9));
  return Array.from({ length: n }, (_, index) => (index < openCount ? 1 : 0));
}

export function activeStageIndex(ratios, threshold = LIMITS.stageUnlockRatio) {
  if (!Array.isArray(ratios)) return 0;
  const gate = Number(threshold);
  const limit = Number.isFinite(gate) ? gate : LIMITS.stageUnlockRatio;
  for (let index = 0; index < ratios.length; index += 1) {
    if (!(Number(ratios[index]) >= limit)) return index;
  }
  return ratios.length;
}

export function initialFreeClearRect(width, height, hiddenPercent) {
  const w = Math.max(0, Math.floor(Number(width)) || 0);
  const h = Math.max(0, Math.floor(Number(height)) || 0);
  const hidden = normalizedHiddenPercent(hiddenPercent);
  const clearH = Math.min(h, Math.max(0, Math.round(h * ((100 - hidden) / 100))));
  return { x: 0, y: h - clearH, w, h: clearH };
}

export function gradualStartAlpha(hiddenPercent) {
  return normalizedHiddenPercent(hiddenPercent) / 100;
}

export function stampAlpha(mode) {
  if (mode === 'gradual') return LIMITS.gradualStampAlpha;
  return 1;
}

// Full-viewport reading order: columns left-to-right J, Q, K;
// rows top-to-bottom spade, diamond, club, heart.
// Index is 0-based row-major. Guide is the same cell as a 1-based number.
const CELL_COLS = 3;
const CELL_ROWS = 4;
const CELL_SUITS = Object.freeze(['spade', 'diamond', 'club', 'heart']);
const CELL_RANKS = Object.freeze(['J', 'Q', 'K']);
const SUIT_LABELS = Object.freeze({
  spade: '스페이드',
  diamond: '다이아몬드',
  club: '클럽',
  heart: '하트',
});
const RANK_LABELS = Object.freeze({
  J: '잭',
  Q: '퀸',
  K: '킹',
});

function cellCard(rowIndex, colIndex) {
  const suit = CELL_SUITS[rowIndex];
  const rank = CELL_RANKS[colIndex];
  const index = rowIndex * CELL_COLS + colIndex;
  return {
    row: rowIndex + 1,
    col: colIndex + 1,
    index,
    guide: index + 1,
    suit,
    rank,
    label: `${SUIT_LABELS[suit]} ${RANK_LABELS[rank]}`,
  };
}

// Maps index 0-11 to its card. Non-integers and anything outside 0-11 return null.
export function cardAtIndex(index) {
  if (typeof index !== 'number' || !Number.isInteger(index)) return null;
  if (index < 0 || index >= CELL_ROWS * CELL_COLS) return null;
  return cellCard(Math.floor(index / CELL_COLS), index % CELL_COLS);
}

// Maps a pointer into the 4×3 cell grid of `rect` ({ left, top, width, height }).
// Interior splits are half-open: a shared edge belongs to the cell on the right or below.
// The exact right edge and exact bottom edge are clamped inward into the last column or row.
// Strictly outside points, non-finite values, and non-positive rectangles return null.
export function mapPointerToCell(x, y, rect) {
  if (!rect || typeof rect !== 'object') return null;
  const left = Number(rect.left);
  const top = Number(rect.top);
  const width = Number(rect.width);
  const height = Number(rect.height);
  const px = Number(x);
  const py = Number(y);
  if (![left, top, width, height, px, py].every(Number.isFinite)) return null;
  if (!(width > 0) || !(height > 0)) return null;

  const localX = px - left;
  const localY = py - top;
  if (localX < 0 || localY < 0 || localX > width || localY > height) return null;

  let col = Math.floor((localX / width) * CELL_COLS);
  let row = Math.floor((localY / height) * CELL_ROWS);
  if (col >= CELL_COLS) col = CELL_COLS - 1;
  if (row >= CELL_ROWS) row = CELL_ROWS - 1;
  if (col < 0 || row < 0) return null;
  return cellCard(row, col);
}
