import {
  performanceScreen, truthInput, soundInput, vibrationInput, scanDurationInput, resetButton,
  startButton,
} from "./dom.js";
import { stopVibration, onVibrationChange } from "./vibration.js";
import { onScanDurationInput, onScanDurationChange, onSoundChange } from "./preferences.js";
import {
  refreshHapticPreparation, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  onLostPointerCapture, unlockFromGesture, commitTruthAttempt, onResetAttempts, onStartPerformance,
  resumeRecorderTheme, onVisibilityChange, onWindowBlur,
} from "./controller.js";

function bind() {
  // Dismissing the first-run guide also arms this document through a trusted click.
  document.addEventListener("click", refreshHapticPreparation);
  performanceScreen.addEventListener("touchend", refreshHapticPreparation, { passive: true });
  performanceScreen.addEventListener("touchstart", unlockFromGesture, { passive: true });
  performanceScreen.addEventListener("touchend", unlockFromGesture, { passive: true });
  // Independent of pointer events: once no finger is down, nothing may vibrate.
  const stopWhenAllLifted = (event) => { if (!event.touches || event.touches.length === 0) stopVibration(); };
  performanceScreen.addEventListener("touchend", stopWhenAllLifted, { passive: true });
  performanceScreen.addEventListener("touchcancel", stopWhenAllLifted, { passive: true });
  performanceScreen.addEventListener("click", unlockFromGesture);
  performanceScreen.addEventListener("pointerdown", onPointerDown, { passive: false });
  performanceScreen.addEventListener("pointermove", onPointerMove);
  performanceScreen.addEventListener("pointerup", onPointerUp);
  performanceScreen.addEventListener("pointercancel", onPointerCancel);
  performanceScreen.addEventListener("lostpointercapture", onLostPointerCapture);
  performanceScreen.addEventListener("contextmenu", (event) => event.preventDefault());
  truthInput.addEventListener("change", commitTruthAttempt);
  resetButton.addEventListener("click", onResetAttempts);
  startButton.addEventListener("click", onStartPerformance);
  soundInput.addEventListener("change", onSoundChange);
  vibrationInput.addEventListener("change", onVibrationChange);
  scanDurationInput?.addEventListener("input", onScanDurationInput);
  scanDurationInput?.addEventListener("blur", onScanDurationInput);
  scanDurationInput?.addEventListener("change", onScanDurationChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onWindowBlur);
  const invalidateWoodContact = () => { if (performanceScreen.dataset.displayTheme === "recorder") onWindowBlur(); };
  window.addEventListener("resize", invalidateWoodContact);
  window.addEventListener("orientationchange", invalidateWoodContact);
  window.addEventListener("focus", resumeRecorderTheme);
}

export { bind };
