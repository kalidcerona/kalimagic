import { SESSION_GONE, SESSION_CRACK, SESSION_CRACK_AT, stageEl, breakthroughEl } from './dom.js';
import { gestureGuide } from './gesture-guide.js';
import { playBreakSound } from './audio.js';
import { state } from './state-store.js';
import { measureStage } from './coin-paint.js';
import { motionEffects } from './motion-prefs.js';
import { pointers, phase, center, objectLive, setPhase } from './perf-state.js';
import { cancelSensorEffects, wobbleX, wobbleY } from './sensor-effects.js';
import { concealCoin } from './pointer-gestures.js';

let breakthroughLatched = false;

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
  setPhase('gone');
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

export {
  crackNormalized, readGoneSession, setGoneSession, readCrackSession, setCrackSession,
  clearBreakthrough, breakthroughSpawn, applyCrackPosition,
};
