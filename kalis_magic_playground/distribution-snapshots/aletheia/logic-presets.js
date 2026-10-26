// Preset validation and stored meta parsing for ALETHEIA.
import { LIMITS, MODES, MESSAGES } from './logic-limits.js';

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
