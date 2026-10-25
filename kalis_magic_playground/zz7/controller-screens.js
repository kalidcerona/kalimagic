import { performanceScreen, detectorButton, settingsScreen, settingsVisible } from "./dom.js";
import { stopVibration } from "./vibration.js";
import { acquireWakeLock, releaseWakeLock, syncPerformanceWakeLock } from "./wake-lock.js";
import { centerWoodText, stopWoodPaper, setLiveContact, showSettings } from "./stage.js";
import { recorderThemes } from "./controller-themes.js";
import { audioContext, stopScanningSound, setAudioContext, setAudioResumePromise } from "./controller-audio.js";
import { clearHoldTimer, cancelUnsettledHold } from "./controller-hold.js";
import { refreshHapticPreparation } from "./controller-haptic.js";
import {
  hold, settled, pointers, setActivePointerId, setHoldPointerId, setReadyPointerId, setPrimerPointerId,
  setGestureConsumed, setReadyFeedbackShown,
} from "./controller-state.js";

function showPerformance() {
  setGestureConsumed(false);
  setReadyFeedbackShown(false);
  pointers.clear();
  settingsScreen.hidden = true;
  performanceScreen.hidden = false;
  centerWoodText();
  resumeRecorderTheme();
  detectorButton.disabled = false;
  setPrimerPointerId(null);
  refreshHapticPreparation();
  syncPerformanceWakeLock();
}

function openSettings() {
  if (performanceScreen.hidden) return;
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  pointers.clear();
  setActivePointerId(null);
  setHoldPointerId(null);
  setReadyPointerId(null);
  setPrimerPointerId(null);
  setLiveContact(false);
  setGestureConsumed(false);
  clearHoldTimer();
  showSettings();
}

function resumeRecorderTheme() {
  if (!document.hidden && !performanceScreen.hidden && !settingsVisible()) recorderThemes.resume();
}

function onVisibilityChange() {
  if (!document.hidden) {
    resumeRecorderTheme();
    acquireWakeLock();
    return;
  }
  releaseWakeLock();
  stopWoodPaper(!settled && hold.phase !== "idle");
  recorderThemes.suspend();
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  stopScanningSound();
  stopVibration();
  setLiveContact(false);
  pointers.clear();
  setActivePointerId(null);
  setHoldPointerId(null);
  setReadyPointerId(null);
  setPrimerPointerId(null);
  // Discard contexts that iOS can leave frozen after backgrounding.
  const ctx = audioContext;
  setAudioContext(null);
  setAudioResumePromise(null);
  try { ctx?.close().catch(() => {}); } catch { /* Already closed. */ }
}

function onWindowBlur() {
  stopWoodPaper(!settled && hold.phase !== "idle");
  recorderThemes.suspend();
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  clearHoldTimer();
  stopScanningSound();
  stopVibration();
  setLiveContact(false);
  pointers.clear();
  setActivePointerId(null);
  setHoldPointerId(null);
  setReadyPointerId(null);
  setPrimerPointerId(null);
}

export { showPerformance, openSettings, resumeRecorderTheme, onVisibilityChange, onWindowBlur };
