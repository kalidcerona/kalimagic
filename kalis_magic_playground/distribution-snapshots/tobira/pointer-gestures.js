import {
  GESTURE_THRESHOLD, LIMITS, centerFromPointer, coinMetrics, exitReached, exitVelocity,
  fullyOffscreen, grabOffset, leadingEdgeOvershoot, normalizedToStage, outwardOffset, restingCenter,
  stageToNormalized, classifyTwoFingerSwipe,
} from './logic.js';
import { EDGE_ORDER, SPAWN_SLOP_PX, SWIPE_REVEAL_PX, stageEl, coinEl, edgeGroup } from './dom.js';
import { gestureGuide } from './gesture-guide.js';
import { unlockBreakSound } from './audio.js';
import { state, selected, replaceSelected, persist } from './state-store.js';
import { fillForm, setEdge } from './presets.js';
import { measureStage, paintCoin, paintLiveCoin } from './coin-paint.js';
import { sensorEffectEnabled, motionPermissionDenied } from './motion-prefs.js';
import { pointers, phase, center, objectLive, setPhase, setCenter, setObjectLive } from './perf-state.js';
import {
  motionEnabled, motionRequestPending, activeOutwardDirection, cancelSensorEffects, startFall,
  enableMotion,
} from './sensor-effects.js';
import {
  crackNormalized, setGoneSession, clearBreakthrough, applyCrackPosition,
} from './crack-session.js';
import { showSettings } from './mode-switch.js';

let grab = { x: 0, y: 0 };
let dragId = null;
let dragClient = null;
let dragBaseline = null;
let dragSamples = [];
let dragExitEdge = null;
let moved = false;
let gestureFired = false;
let pinch = null;
let stageRect = null;
let lastStage = { width: 0, height: 0 };
let exitFrame = 0;
let exitToken = 0;
let spawnId = null;
let spawnClient = null;
let spawnAtPoint = null;
let spawnCancelled = false;

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
  setObjectLive(false);
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
  setCenter({ x: point.x, y: point.y });
  moved = true;
  setObjectLive(true);
  setPhase('idle');
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
  setCenter({ x: rest.x, y: rest.y });
  moved = false;
  setPhase('awaiting');
  stageEl.classList.remove('is-leaving');
  concealCoin();
  paintCoin(center.x, center.y, rest.radius, 0, 1);
  resetSpawnTracking();
}


function beginExit(edge, speed) {
  if (phase === 'exiting' || phase === 'gone') return;
  if (!EDGE_ORDER.includes(edge)) return;
  if (!(speed > 0)) { setPhase('idle'); return; }
  cancelSensorEffects();
  const capturedId = dragId;
  setPhase('exiting');
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
    setCenter(next);
    paintCoin(next.x, next.y, metrics.radius, 1, 1);
    if (!fullyOffscreen(next, metrics.radius, stageNow, edge)) {
      exitFrame = window.requestAnimationFrame(step);
      return;
    }
    setPhase('gone');
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
  setCenter(next);
  moved = true;
  setObjectLive(true);
  paintCoin(center.x, center.y, metrics.radius, 1, 1);
  if (dragExitEdge && fullyOffscreen(next, metrics.radius, lastStage, dragExitEdge)) {
    setPhase('gone');
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
  setPhase('dragging');
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

function requestPerformanceMotion(event) {
  // Cold start calls showPerformance directly, so the start button never enables motion.
  // The first trusted performance tap is that missing gesture. Denial is not asked again here.
  if (!event || event.isTrusted !== true) return;
  if (!sensorEffectEnabled() || motionEnabled || motionRequestPending || motionPermissionDenied) return;
  void enableMotion();
}

function onPointerDown(event) {
  if (state.mode !== 'performance' || !gestureGuide.hidden) return;
  unlockBreakSound();
  requestPerformanceMotion(event);
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
      setPhase('idle');
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
    setPhase('idle');
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
    setPhase('idle');
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
    setCenter(normalizedToStage(normalized.x, normalized.y, next.width, next.height));
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

export {
  lastStage, cancelExit, endPointers, concealCoin, placeAtRest, onPointerDown, onPointerMove,
  onPointerUp, onResize, onEdgeKey,
};
