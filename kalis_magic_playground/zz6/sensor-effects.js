import { coinMetrics, fullyOffscreen } from './logic.js';
import {
  advanceTiltBody, fallPosition, gravityTiltVector, isBreakthroughSnap, orientationTiltVector,
  outwardTravel, shakeImpulse,
} from './sensor-motion.js';
import { stageEl, motionNote, motionActivation, motionInputs } from './dom.js';
import { unlockBreakSound, playWallSound } from './audio.js';
import { state, selected } from './state-store.js';
import { measureStage, paintCoin, paintLiveCoin } from './coin-paint.js';
import {
  motionEffects, motionPermissionDenied, setMotionPermissionDenied, sensorEffectEnabled,
} from './motion-prefs.js';
import { pointers, phase, center, objectLive, setPhase, setCenter } from './perf-state.js';
import { breakthroughSpawn, setGoneSession } from './crack-session.js';
import { concealCoin } from './pointer-gestures.js';

let motionEnabled = false;
let motionRequestId = 0;
let motionRequestPending = false;
let upright = false;
let lastOrientationAt = -Infinity;
let activeOutwardDirection = null;
let shakeSample = null;
let lastShakeAt = -Infinity;
let lastSnapAt = -Infinity;
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

function cancelFall() {
  fallToken += 1;
  if (fallFrame) window.cancelAnimationFrame(fallFrame);
  fallFrame = 0;
  if (activeOutwardDirection && phase === 'exiting') setPhase('idle');
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

function cancelTiltFrame() {
  if (!tiltFrame) return;
  window.cancelAnimationFrame(tiltFrame);
  tiltFrame = 0;
}

function cancelSensorEffects() {
  cancelFall();
  cancelWobble();
  if (tiltFrame) window.cancelAnimationFrame(tiltFrame);
  tiltFrame = 0;
  tiltLastAt = 0;
  tiltBody = null;
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
    setCenter({ x: tiltBody.x, y: tiltBody.y });
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
  setPhase('exiting');
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
      setPhase('gone');
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
    setMotionPermissionDenied(true);
    disableMotion('센서는 HTTPS에서만 사용할 수 있습니다. 손가락 연출은 그대로 사용할 수 있습니다.');
    return;
  }
  const orientationAvailable = 'DeviceOrientationEvent' in window || 'ondeviceorientation' in window;
  const motionAvailable = 'DeviceMotionEvent' in window || 'ondevicemotion' in window;
  if (!orientationAvailable && !motionAvailable) {
    setMotionPermissionDenied(true);
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
      setMotionPermissionDenied(true);
      disableMotion('센서 권한이 없어 움직임 연출을 켜지 못했습니다.');
      return;
    }
    motionEnabled = true;
    setMotionPermissionDenied(false);
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
      setMotionPermissionDenied(true);
      disableMotion('센서 권한을 받지 못했습니다. 손가락 연출은 그대로 사용할 수 있습니다.');
    }
  }
}

export {
  motionEnabled, motionRequestPending, activeOutwardDirection, wobbleX, wobbleY, wobbleAngle,
  cancelTiltFrame, cancelSensorEffects, startFall, disableMotion, updateMotionActivation, enableMotion,
};
