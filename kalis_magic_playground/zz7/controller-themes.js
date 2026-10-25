import { verdictForAttempt } from "./logic.js";
import { createRecorderThemeController } from "./recorder-theme.js";
import { performanceScreen } from "./dom.js";
import { soundEnabled } from "./preferences.js";
import { appState, hold, activeScanDurationMs, settled } from "./controller-state.js";

const recorderThemes = createRecorderThemeController(performanceScreen, () => ({
  sound: soundEnabled(), duration: activeScanDurationMs,
  startedAt: hold.startedAt, holding: !settled && hold.phase === "holding",
  verdict: verdictForAttempt(appState.attemptCount + 1, appState.settings.truthAttempts),
  attempt: appState.attemptCount,
}));

export { recorderThemes };
