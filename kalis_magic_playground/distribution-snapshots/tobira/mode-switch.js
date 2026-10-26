import { coinMetrics } from './logic.js';
import { stageEl, coinEl } from './dom.js';
import { maybeShowGestureGuide, hideGestureGuide } from './gesture-guide.js';
import { state, selected, persist } from './state-store.js';
import { refreshCoinImage } from './images.js';
import { renderList, fillForm } from './presets.js';
import { applyChrome, paintCoin } from './coin-paint.js';
import { syncPerformanceWakeLock } from './wake-lock.js';
import { center, setPhase } from './perf-state.js';
import { cancelSensorEffects, updateMotionActivation } from './sensor-effects.js';
import {
  crackNormalized, setGoneSession, readCrackSession, setCrackSession, clearBreakthrough,
  applyCrackPosition,
} from './crack-session.js';
import { lastStage, cancelExit, endPointers, placeAtRest } from './pointer-gestures.js';

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
    setPhase('gone');
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

export { showSettings, showPerformance };
