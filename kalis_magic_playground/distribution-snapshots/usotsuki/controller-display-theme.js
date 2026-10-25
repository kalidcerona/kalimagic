import { performanceScreen } from "./dom.js";
import { storageGet, storageSet } from "./storage.js";
import { stopLiveTrace, startLiveTrace, stopWoodPaper, presentStatuses } from "./stage.js";
import { recorderThemes } from "./controller-themes.js";
import { audioContext, stopScanningSound, setAudioContext, setAudioResumePromise } from "./controller-audio.js";
import { holdPointerId } from "./controller-state.js";

// Display appearance is independent of the detector's performance state.
const DISPLAY_THEME_KEY = "usotsuki.distribution.detector.theme.v1";
const displayThemeSelect = document.querySelector("#display-theme");
function normalizeDisplayTheme(value) { return ["green", "wine", "recorder", "recorder-a", "recorder-d"].includes(value) ? value : "green"; }
function applyDisplayTheme(value) {
  const theme = normalizeDisplayTheme(value);
  if (performanceScreen.dataset.displayTheme !== theme) {
    stopScanningSound();
    const previousAudio = audioContext;
    setAudioContext(null);
    setAudioResumePromise(null);
    try { previousAudio?.close().catch(() => {}); } catch { /* Already closed. */ }
  }
  recorderThemes.switchTheme(theme);
  performanceScreen.dataset.displayTheme = theme;
  if (theme !== "recorder") stopWoodPaper();
  displayThemeSelect.value = theme;
  if (theme !== "recorder") stopLiveTrace();
  else if (holdPointerId != null && performanceScreen.classList.contains("is-live")) startLiveTrace();
  return theme;
}
applyDisplayTheme(storageGet(DISPLAY_THEME_KEY).value);
displayThemeSelect.addEventListener("change", (event) => {
  const theme = applyDisplayTheme(event.target.value);
  storageSet(DISPLAY_THEME_KEY, theme);
  presentStatuses();
});
