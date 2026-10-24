import {
  GESTURE_THRESHOLD, LIMITS, centerFromPointer, coinMetrics, exitReached, exitVelocity,
  fullyOffscreen, grabOffset, leadingEdgeOvershoot, normalizedToStage, outwardOffset, restingCenter,
  stageToNormalized, classifyTwoFingerSwipe,
} from './logic.js';
import {
  advanceTiltBody, fallPosition, gravityTiltVector, isBreakthroughSnap, orientationTiltVector,
  outwardTravel, shakeImpulse,
} from './sensor-motion.js';
import {
  SESSION_GONE, SESSION_CRACK, SESSION_CRACK_AT, EDGE_ORDER, SPAWN_SLOP_PX, SWIPE_REVEAL_PX,
  stageEl, breakthroughEl, coinEl, edgeGroup, motionNote, motionActivation, wallSoundInput,
  wallVolumeInput, wallVolumeValue, MOTION_SETTINGS_KEY, motionInputs, motionEdges,
  DEFAULT_MOTION_EFFECTS, DEFAULT_WALL_VOLUME, MOTION_OWNED_KEYS,
} from './dom.js';
import { gestureGuide, maybeShowGestureGuide, hideGestureGuide } from './gesture-guide.js';
import { unlockBreakSound, playBreakSound, playWallSound } from './audio.js';
import { state, selected, replaceSelected, persist } from './state-store.js';
import { refreshCoinImage } from './images.js';
import { renderList, fillForm, setEdge } from './presets.js';
import { applyChrome, measureStage, paintCoin, paintLiveCoin } from './coin-paint.js';
import { syncPerformanceWakeLock } from './wake-lock.js';

let motionEffects = { ...DEFAULT_MOTION_EFFECTS, wallSound: true, wallVolume: DEFAULT_WALL_VOLUME };
let motionExtras = {};
let motionStorageBlocked = false;
let motionPermissionDenied = false;

function sensorEffectEnabled() {
  return ['tilt', 'exit', 'breakthrough', 'wobble'].some((key) => motionEffects[key] === true);
}

function wallSoundEnabled() {
  return motionEffects.wallSound !== false;
}

function wallVolumeGain() {
  const volume = Number.isFinite(motionEffects.wallVolume) ? motionEffects.wallVolume : DEFAULT_WALL_VOLUME;
  return Math.min(1, Math.max(0, volume / 100));
}

function applyMotionForm() {
  for (const [key, input] of Object.entries(motionInputs)) input.checked = Boolean(motionEffects[key]);
  for (const [edge, input] of Object.entries(motionEdges)) input.checked = motionEffects.edges.includes(edge);
  if (wallSoundInput) wallSoundInput.checked = wallSoundEnabled();
  if (wallVolumeInput) {
    const volume = Number.isFinite(motionEffects.wallVolume) ? motionEffects.wallVolume : DEFAULT_WALL_VOLUME;
    wallVolumeInput.value = String(volume);
    if (wallVolumeValue) wallVolumeValue.textContent = `${volume}%`;
  }
}

function loadMotionEffects() {
  motionEffects = { ...DEFAULT_MOTION_EFFECTS, wallSound: true, wallVolume: DEFAULT_WALL_VOLUME };
  motionExtras = {};
  let raw = null;
  try {
    raw = localStorage.getItem(MOTION_SETTINGS_KEY);
  } catch {
    // Unreadable storage stays untouched. In-memory defaults are not written back.
    motionStorageBlocked = true;
    motionNote.textContent = '움직임 설정을 읽지 못했습니다. 기존 기록은 덮어쓰지 않습니다.';
    applyMotionForm();
    return;
  }
  if (raw == null || raw === '') {
    applyMotionForm();
    return;
  }
  let saved = null;
  try {
    saved = JSON.parse(raw);
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    motionStorageBlocked = true;
    motionNote.textContent = '움직임 설정을 읽지 못했습니다. 이번 실행만 기본값을 쓰며, 기존 기록은 덮어쓰지 않았습니다.';
    applyMotionForm();
    return;
  }
  for (const [key, value] of Object.entries(saved)) {
    if (!MOTION_OWNED_KEYS.has(key)) motionExtras[key] = value;
  }
  motionEffects = {
    tilt: typeof saved.tilt === 'boolean' ? saved.tilt : true,
    exit: saved.exit === true,
    breakthrough: typeof saved.breakthrough === 'boolean' ? saved.breakthrough : true,
    wobble: saved.wobble === true,
    edges: Array.isArray(saved.edges) ? EDGE_ORDER.filter((edge) => saved.edges.includes(edge)) : ['right'],
    wallSound: typeof saved.wallSound === 'boolean' ? saved.wallSound : true,
    wallVolume: typeof saved.wallVolume === 'number' && Number.isFinite(saved.wallVolume)
      ? Math.min(100, Math.max(0, saved.wallVolume)) : DEFAULT_WALL_VOLUME,
  };
  if (motionEffects.exit) motionEffects.tilt = true;
  applyMotionForm();
}

function motionPayload() {
  return {
    ...motionExtras,
    tilt: motionEffects.tilt === true,
    exit: motionEffects.exit === true,
    breakthrough: motionEffects.breakthrough === true,
    wobble: motionEffects.wobble === true,
    edges: motionEffects.edges,
    wallSound: wallSoundEnabled(),
    wallVolume: Number.isFinite(motionEffects.wallVolume) ? motionEffects.wallVolume : DEFAULT_WALL_VOLUME,
  };
}

function writeMotionStorage() {
  if (motionStorageBlocked) {
    motionNote.textContent = '움직임 설정을 읽지 못해 저장하지 않았습니다. 기존 기록은 그대로입니다.';
    return false;
  }
  try {
    localStorage.setItem(MOTION_SETTINGS_KEY, JSON.stringify(motionPayload()));
    return true;
  } catch {
    motionNote.textContent = '센서 설정을 저장하지 못했습니다. 이번 실행에서는 계속 사용할 수 있습니다.';
    return false;
  }
}

function saveMotionEffects() {
  motionPermissionDenied = false;
  if (motionInputs.exit.checked) motionInputs.tilt.checked = true;
  motionEffects = {
    ...motionEffects,
    ...Object.fromEntries(Object.entries(motionInputs).map(([key, input]) => [key, input.checked])),
    edges: EDGE_ORDER.filter((edge) => motionEdges[edge].checked),
  };
  writeMotionStorage();
  unlockBreakSound();
  if (!motionEffects.tilt && tiltFrame) {
    window.cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
  }
  if (!Object.values(motionInputs).some((input) => input.checked)) disableMotion();
  else if (!motionEnabled) void enableMotion();
  updateMotionActivation();
}

function saveSoundPreferences() {
  // Sound is independent of sensor permission and of the selected preset.
  const volume = Math.min(100, Math.max(0, Number(wallVolumeInput?.value)));
  motionEffects = {
    ...motionEffects,
    wallSound: Boolean(wallSoundInput?.checked),
    wallVolume: Number.isFinite(volume) ? volume : DEFAULT_WALL_VOLUME,
  };
  if (wallVolumeValue) wallVolumeValue.textContent = `${motionEffects.wallVolume}%`;
  writeMotionStorage();
}

const pointers = new Map();
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
let exitFrame = 0;
let exitToken = 0;
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
  if (!sensorEffectEnabled()) return;
  if (motionEnabled || motionRequestPending) return;
  const requestId = ++motionRequestId;
  motionRequestPending = true;
  updateMotionActivation();
  unlockBreakSound();
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
    // The revealing tap may already have finished while permission was pending.
    if (state.mode === 'performance') startFall();
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
  syncPerformanceWakeLock();
}

function showPerformance({ persistMode = true, keepGone = false, showGuide = true } = {}) {
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
  if (showGuide) maybeShowGestureGuide();
  syncPerformanceWakeLock();
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

export {
  wallSoundEnabled, wallVolumeGain, loadMotionEffects, saveMotionEffects, saveSoundPreferences,
  phase, center, objectLive, motionEnabled, wobbleX, wobbleY, wobbleAngle, enableMotion,
  concealCoin, showSettings, showPerformance, onPointerDown, onPointerMove, onPointerUp, onResize,
  onEdgeKey,
};
