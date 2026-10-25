import { beginHold, createHold, releaseHold } from "./logic.js";
import { performanceScreen } from "./dom.js";
import { stopVibration, startVibration } from "./vibration.js";
import { scanDurationMs, setStatus, syncLiveScanDuration } from "./preferences.js";
import { stopWoodPaper, setLiveContact, setStage } from "./stage.js";
import { recorderThemes } from "./controller-themes.js";
import { playVerdictSound, stopScanningSound, startScanningSound } from "./controller-audio.js";
import { storageLocked, persistState, updateAttemptProgress } from "./controller-storage.js";
import {
  appState, hold, activeScanDurationMs, settled, activePointerId, holdPointerId, setAppState, setHold,
  setSettled, setActiveScanDurationMs, setActivePointerId, setHoldPointerId,
} from "./controller-state.js";

let holdTimer = 0;

function clearHoldTimer() {
  if (holdTimer) {
    window.clearTimeout(holdTimer);
    holdTimer = 0;
  }
}

function applyRelease(nowMs, x, y) {
  if (settled) return;
  setSettled(true);
  clearHoldTimer();
  stopScanningSound();
  stopVibration();
  const result = releaseHold(appState, hold, nowMs, x, y, activeScanDurationMs);
  setHold(result.hold);
  setAppState(result.state);
  // Wood ink freezes at the verdict; other skins retain their lifecycle.
  if (performanceScreen.dataset.displayTheme === "recorder" || !(result.counted && holdPointerId != null)) setLiveContact(false);
  recorderThemes.finish(result.counted, result.verdict, result.counted ? nowMs : performance.now());
  if (result.counted) {
    updateAttemptProgress();
    const saved = persistState();
    setStage(result.verdict === "TRUE" ? "TRUE" : "LIE");
    playVerdictSound(result.verdict);
    if (storageLocked) {
      setStatus("시도는 반영했습니다. 읽을 수 없는 저장값은 덮어쓰지 않습니다.");
    } else if (!saved) {
      setStatus("시도 횟수를 이 브라우저에 저장하지 못했습니다.");
    }
    return;
  }
  if (result.outcome === "cancelled") {
    stopWoodPaper(true);
    // Return to idle without replaying ink or replacing the paper.
    setStage(performanceScreen.dataset.displayTheme === "recorder" ? "idle" : "cancelled", true);
  }
}

function armThresholdTimer() {
  clearHoldTimer();
  holdTimer = window.setTimeout(() => {
    holdTimer = 0;
    if (settled || hold.phase !== "holding" || activePointerId == null) return;
    const now = performance.now();
    if (now - hold.startedAt < activeScanDurationMs) {
      armThresholdTimer();
      return;
    }
    applyRelease(now, hold.originX, hold.originY);
  }, Math.max(0, activeScanDurationMs - (performance.now() - hold.startedAt)));
}

function startHold(event) {
  const begun = beginHold(createHold(), performance.now(), event.clientX, event.clientY);
  if (!begun.accepted) return;
  setHold(begun.hold);
  syncLiveScanDuration();
  setActiveScanDurationMs(scanDurationMs);
  setSettled(false);
  setActivePointerId(event.pointerId);
  setHoldPointerId(event.pointerId);
  setLiveContact(true);
  setStage("testing");
  recorderThemes.begin();
  startScanningSound();
  startVibration(activeScanDurationMs);
  armThresholdTimer();
}

function cancelUnsettledHold() {
  if (settled || hold.phase === "idle") {
    setActivePointerId(null);
    return;
  }
  const startedAt = hold.startedAt;
  applyRelease(startedAt, Number.NaN, Number.NaN);
  setActivePointerId(null);
}

export { clearHoldTimer, applyRelease, startHold, cancelUnsettledHold };
