// Two-finger gesture classification for ALETHEIA.
import { LIMITS } from './logic-limits.js';

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
