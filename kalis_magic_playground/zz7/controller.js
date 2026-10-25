import { resetAttempts } from "./logic.js";
import "./recorder-theme.js";
import "./dom.js";
import "./storage.js";
import "./vibration.js";
import "./wake-lock.js";
import "./preferences.js";
import { setStage } from "./stage.js";
import { bind } from "./bindings.js";
import { appState, setAppState } from "./controller-state.js";
import "./controller-themes.js";
import "./controller-audio.js";
import { updateAttemptProgress, bootStorage } from "./controller-storage.js";
import "./controller-hold.js";
import "./controller-haptic.js";
import { showPerformance } from "./controller-screens.js";
import "./controller-attempts.js";
import "./controller-gestures.js";
import "./controller-display-theme.js";

bootStorage();
setAppState(resetAttempts(appState));
updateAttemptProgress();
// Loading preserves the original stored bytes; saves happen only after user actions.
setStage("idle");
showPerformance();
bind();

export { recorderThemes } from "./controller-themes.js";
export { appState, hold, activeScanDurationMs, settled, holdPointerId, pointers } from "./controller-state.js";
export { updateAttemptProgress } from "./controller-storage.js";
export { refreshHapticPreparation } from "./controller-haptic.js";
export { stopScanningSound } from "./controller-audio.js";
export { openSettings, resumeRecorderTheme, onVisibilityChange, onWindowBlur } from "./controller-screens.js";
export {
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture,
} from "./controller-gestures.js";
export { unlockFromGesture, commitTruthAttempt, onResetAttempts, onStartPerformance } from "./controller-attempts.js";
