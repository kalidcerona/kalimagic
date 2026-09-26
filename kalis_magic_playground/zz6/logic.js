// Pure preset, geometry, and gesture helpers. No DOM and no storage.

export const STORAGE_KEY = 'tobira.v1';
export const RECOVERY_KEY = 'tobira.v1.recovery';
export const GESTURE_THRESHOLD = 96;
export const EXIT_EPSILON_PX = 0.5;
export const REST_INSET_PX = 1;
export const COIN_DIAMETER_CAP_PX = 260;
export const EDGES = Object.freeze(['left', 'right', 'top', 'bottom']);

export const LIMITS = Object.freeze({
  coinSize: Object.freeze({ min: 0.18, max: 0.56 }),
  position: Object.freeze({ min: 0, max: 1 }),
  fadeDistance: Object.freeze({ min: 0.05, max: 0.75 }),
  disappearDuration: Object.freeze({ min: 200, max: 4000 }),
  nameLength: 32,
  idLength: 80,
});

const EXIT_SCALE_DROP = 0.86;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function clampNumber(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new TypeError('value must be a finite number');
  }
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.min(high, Math.max(low, value));
}

export function normalizeName(name) {
  const cleaned = String(name)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const clipped = Array.from(cleaned).slice(0, LIMITS.nameLength).join('').trim();
  return clipped || '동전';
}

function readNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

export function sanitizePreset(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'not-an-object' };
  }
  if (typeof input.id !== 'string' || input.id.length > LIMITS.idLength || !ID_PATTERN.test(input.id)) {
    return { ok: false, reason: 'id' };
  }
  if (typeof input.name !== 'string') return { ok: false, reason: 'name' };
  const coinSize = readNumber(input.coinSize);
  if (coinSize == null) return { ok: false, reason: 'coinSize' };
  const startX = readNumber(input.startX);
  if (startX == null) return { ok: false, reason: 'startX' };
  const startY = readNumber(input.startY);
  if (startY == null) return { ok: false, reason: 'startY' };
  if (typeof input.exitEdge !== 'string' || !EDGES.includes(input.exitEdge)) {
    return { ok: false, reason: 'exitEdge' };
  }
  const fadeDistance = readNumber(input.fadeDistance);
  if (fadeDistance == null) return { ok: false, reason: 'fadeDistance' };
  const disappearDuration = readNumber(input.disappearDuration);
  if (disappearDuration == null) return { ok: false, reason: 'disappearDuration' };

  return {
    ok: true,
    preset: {
      id: input.id,
      name: normalizeName(input.name),
      coinSize: clampNumber(coinSize, LIMITS.coinSize.min, LIMITS.coinSize.max),
      startX: clampNumber(startX, LIMITS.position.min, LIMITS.position.max),
      startY: clampNumber(startY, LIMITS.position.min, LIMITS.position.max),
      exitEdge: input.exitEdge,
      fadeDistance: clampNumber(fadeDistance, LIMITS.fadeDistance.min, LIMITS.fadeDistance.max),
      disappearDuration: clampNumber(
        disappearDuration,
        LIMITS.disappearDuration.min,
        LIMITS.disappearDuration.max,
      ),
    },
  };
}

export function defaultPreset() {
  return {
    id: 'preset-default',
    name: '기본 동전',
    coinSize: 0.28,
    startX: 0.5,
    startY: 0.62,
    exitEdge: 'top',
    fadeDistance: 0.22,
    disappearDuration: 700,
  };
}

export function defaultState() {
  const preset = defaultPreset();
  return {
    version: 1,
    selectedId: preset.id,
    mode: 'settings',
    presets: [preset],
  };
}

function collectPresets(list) {
  const presets = [];
  const dropped = [];
  const seen = new Set();
  list.forEach((item, index) => {
    const result = sanitizePreset(item);
    if (!result.ok) {
      dropped.push({ index, reason: result.reason });
      return;
    }
    if (seen.has(result.preset.id)) {
      dropped.push({ index, reason: 'duplicate-id' });
      return;
    }
    seen.add(result.preset.id);
    presets.push(result.preset);
  });
  return { presets, dropped };
}

function stateFromPresets(presets, selectedId, mode) {
  const selected = presets.some((preset) => preset.id === selectedId) ? selectedId : presets[0].id;
  return {
    version: 1,
    selectedId: selected,
    mode: mode === 'performance' ? 'performance' : 'settings',
    presets,
  };
}

export function parseStoredState(raw) {
  if (raw == null || raw === '') {
    return { ok: true, state: defaultState(), recovery: null };
  }
  if (typeof raw !== 'string') {
    return {
      ok: false,
      state: defaultState(),
      recovery: { reason: 'unreadable', preserved: null, dropped: [] },
    };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      state: defaultState(),
      recovery: { reason: 'unreadable', preserved: raw, dropped: [] },
    };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.presets)) {
    return {
      ok: false,
      state: defaultState(),
      recovery: { reason: 'invalid-shape', preserved: raw, dropped: [] },
    };
  }
  const collected = collectPresets(data.presets);
  if (collected.presets.length === 0) {
    return {
      ok: false,
      state: defaultState(),
      recovery: { reason: 'no-valid-presets', preserved: raw, dropped: collected.dropped },
    };
  }
  const state = stateFromPresets(collected.presets, data.selectedId, data.mode);
  if (collected.dropped.length > 0) {
    return {
      ok: false,
      state,
      recovery: { reason: 'partial', preserved: raw, dropped: collected.dropped },
    };
  }
  return { ok: true, state, recovery: null };
}

export function serializeState(state) {
  const collected = collectPresets(Array.isArray(state?.presets) ? state.presets : []);
  const presets = collected.presets.length ? collected.presets : defaultState().presets;
  return JSON.stringify(stateFromPresets(presets, state?.selectedId, state?.mode));
}

export function nextPresetName(presets) {
  const list = Array.isArray(presets) ? presets : [];
  const names = new Set(list.map((preset) => preset?.name));
  let index = list.length + 1;
  let name = `프리셋 ${index}`;
  while (names.has(name)) {
    index += 1;
    name = `프리셋 ${index}`;
  }
  return name;
}

export function stageToNormalized(x, y, width, height) {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: 0.5, y: 0.5 };
  }
  return { x: x / width, y: y / height };
}

export function normalizedToStage(nx, ny, width, height) {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(nx) || !Number.isFinite(ny)) {
    return { x: 0, y: 0 };
  }
  return { x: nx * width, y: ny * height };
}

export function coinMetrics(preset, stage) {
  const width = Number(stage?.width) || 0;
  const height = Number(stage?.height) || 0;
  const minSide = width > 0 && height > 0 ? Math.min(width, height) : 0;
  const fraction = clampNumber(
    readNumber(preset?.coinSize) ?? LIMITS.coinSize.min,
    LIMITS.coinSize.min,
    LIMITS.coinSize.max,
  );
  let diameter = fraction * minSide;
  if (minSide > 0) {
    diameter = Math.min(diameter, COIN_DIAMETER_CAP_PX, Math.max(0, minSide - 2));
  }
  return { diameter, radius: diameter / 2 };
}

export function restingCenter(preset, stage) {
  const metrics = coinMetrics(preset, stage);
  const width = Number(stage?.width) || 0;
  const height = Number(stage?.height) || 0;
  if (!(width > 0) || !(height > 0)) {
    return { x: 0, y: 0, radius: metrics.radius, diameter: metrics.diameter };
  }
  const minX = metrics.radius + REST_INSET_PX;
  const maxX = width - metrics.radius - REST_INSET_PX;
  const minY = metrics.radius + REST_INSET_PX;
  const maxY = height - metrics.radius - REST_INSET_PX;
  const startX = readNumber(preset?.startX) ?? 0.5;
  const startY = readNumber(preset?.startY) ?? 0.5;
  return {
    x: maxX > minX ? clampNumber(startX * width, minX, maxX) : width / 2,
    y: maxY > minY ? clampNumber(startY * height, minY, maxY) : height / 2,
    radius: metrics.radius,
    diameter: metrics.diameter,
  };
}

export function grabOffset(pointer, center) {
  return { x: pointer.x - center.x, y: pointer.y - center.y };
}

export function centerFromPointer(pointer, grab) {
  return { x: pointer.x - grab.x, y: pointer.y - grab.y };
}

function clampSpan(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  if (!(max > min)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampDragCenter(center, radius, stage, exitEdge) {
  const width = Number(stage?.width) || 0;
  const height = Number(stage?.height) || 0;
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  let x = Number.isFinite(center?.x) ? center.x : width / 2;
  let y = Number.isFinite(center?.y) ? center.y : height / 2;
  const fitsX = width > r * 2;
  const fitsY = height > r * 2;

  if (!EDGES.includes(exitEdge)) {
    return {
      x: clampSpan(x, r, width - r, width / 2),
      y: clampSpan(y, r, height - r, height / 2),
    };
  }

  if (exitEdge === 'left' || exitEdge === 'right') {
    y = clampSpan(y, r, height - r, height / 2);
    if (exitEdge === 'right') x = Math.max(x, fitsX ? r : width / 2);
    else x = Math.min(x, fitsX ? width - r : width / 2);
  } else {
    x = clampSpan(x, r, width - r, width / 2);
    if (exitEdge === 'bottom') y = Math.max(y, fitsY ? r : height / 2);
    else y = Math.min(y, fitsY ? height - r : height / 2);
  }
  return { x, y };
}

export function leadingEdgeOvershoot(center, radius, stage, edge) {
  if (!center || !stage) return null;
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(radius)) return null;
  if (!Number.isFinite(stage.width) || !Number.isFinite(stage.height)) return null;
  if (edge === 'left') return radius - center.x;
  if (edge === 'right') return center.x + radius - stage.width;
  if (edge === 'top') return radius - center.y;
  if (edge === 'bottom') return center.y + radius - stage.height;
  return null;
}

export function edgeProgress(center, radius, stage, edge, fadeDistance) {
  const overshoot = leadingEdgeOvershoot(center, radius, stage, edge);
  if (overshoot == null) return 0;
  if (!(fadeDistance > 0)) return overshoot > 0 ? 1 : 0;
  return clampNumber(overshoot / fadeDistance, 0, 1);
}

export function exitReached(overshoot) {
  return Number.isFinite(overshoot) && overshoot > EXIT_EPSILON_PX;
}

export function fullyOffscreen(center, radius, stage, edge) {
  return leadingEdgeOvershoot(center, radius, stage, edge) >= 2 * radius;
}

export function exitVelocity(samples, edge) {
  if (!Array.isArray(samples) || samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples[0];
  const elapsed = last.t - first.t;
  if (!(elapsed > 0)) return 0;
  const axis = edge === 'left' || edge === 'right' ? 'x' : 'y';
  const sign = edge === 'left' || edge === 'top' ? -1 : 1;
  return Math.max(0, sign * (last[axis] - first[axis]) / elapsed);
}

export function wallpaperCropRect(width, height, percent) {
  const top = Math.round(height * clampNumber(Number(percent) || 0, 0, 18) / 100);
  return { x: 0, y: top, width, height: height - top };
}

export function createRevisionQueue() {
  let revision = 0;
  let tail = Promise.resolve();
  return {
    next() { return ++revision; },
    current(token) { return token === revision; },
    enqueue(token, work) {
      const job = tail.then(async () => {
        if (token !== revision) return false;
        await work(() => token === revision);
        return token === revision;
      });
      tail = job.catch(() => {});
      return job;
    },
  };
}

export function contactCenter(center, radius, stage, edge) {
  const next = {
    x: Number.isFinite(center?.x) ? center.x : 0,
    y: Number.isFinite(center?.y) ? center.y : 0,
  };
  const r = Number.isFinite(radius) ? radius : 0;
  if (edge === 'left') next.x = r;
  else if (edge === 'right') next.x = (Number(stage?.width) || 0) - r;
  else if (edge === 'top') next.y = r;
  else if (edge === 'bottom') next.y = (Number(stage?.height) || 0) - r;
  return next;
}

export function fadeDistancePx(preset, stage) {
  const horizontal = preset?.exitEdge === 'left' || preset?.exitEdge === 'right';
  const axis = horizontal ? Number(stage?.width) || 0 : Number(stage?.height) || 0;
  const fraction = readNumber(preset?.fadeDistance) ?? 0;
  if (!(axis > 0) || !(fraction > 0)) return 0;
  return fraction * axis;
}

export function travelDistancePx(fadeDistance, diameter) {
  const fade = Number.isFinite(fadeDistance) && fadeDistance > 0 ? fadeDistance : 0;
  const span = Number.isFinite(diameter) && diameter > 0 ? diameter : 0;
  return fade + span;
}

export function outwardOffset(edge, distance) {
  const span = Number.isFinite(distance) ? distance : 0;
  if (edge === 'left') return { x: -span, y: 0 };
  if (edge === 'right') return { x: span, y: 0 };
  if (edge === 'top') return { x: 0, y: -span };
  if (edge === 'bottom') return { x: 0, y: span };
  return { x: 0, y: 0 };
}

export function smoothstep(value) {
  const t = clampNumber(Number.isFinite(value) ? value : 0, 0, 1);
  return t * t * (3 - 2 * t);
}

export function exitVisual(linear) {
  const travel = smoothstep(linear);
  return {
    travel,
    opacity: 1 - travel,
    scale: 1 - EXIT_SCALE_DROP * travel,
    gone: Number.isFinite(linear) && linear >= 1,
  };
}

function isScreenPoint(value) {
  return Boolean(value) && Number.isFinite(value.screenX) && Number.isFinite(value.screenY);
}

// Screen deltas are CSS pixels (screenX/screenY). Both fingers must agree.
export function classifyTwoFingerSwipe(startA, startB, endA, endB, threshold = GESTURE_THRESHOLD) {
  if (!isScreenPoint(startA) || !isScreenPoint(startB) || !isScreenPoint(endA) || !isScreenPoint(endB)) {
    return 'none';
  }
  const limit = Number.isFinite(threshold) ? threshold : GESTURE_THRESHOLD;
  const dxA = endA.screenX - startA.screenX;
  const dyA = endA.screenY - startA.screenY;
  const dxB = endB.screenX - startB.screenX;
  const dyB = endB.screenY - startB.screenY;
  const verticalA = Math.abs(dyA) > Math.abs(dxA);
  const verticalB = Math.abs(dyB) > Math.abs(dxB);
  if (dyA >= limit && dyB >= limit && verticalA && verticalB) return 'settings';
  if (dyA <= -limit && dyB <= -limit && verticalA && verticalB) return 'reset';
  return 'none';
}
