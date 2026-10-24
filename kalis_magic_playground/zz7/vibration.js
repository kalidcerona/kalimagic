import { vibrationInput, vibrationHelp, vibrationCapability, vibrationSummary } from "./dom.js";
import { VIBRATION_KEY, storageSet } from "./storage.js";

function loadVibrationPreference(raw) {
  if (raw === "low") vibrationInput.value = "medium";
  else if (["off", "medium", "high", "max"].includes(raw)) vibrationInput.value = raw;
}

function continuousVibrationAvailable() {
  return typeof navigator.vibrate === "function";
}

// Settings only. Safari has no continuous vibration API; do not invent a pulse
// or turn sound on. The stored intensity stays for a browser that can use it.
function applyVibrationCapability() {
  const available = continuousVibrationAvailable();
  const settings = document.querySelector("#vibration-settings");
  if (settings) {
    settings.hidden = !available;
    settings.style.display = available ? "" : "none";
  }
  if (vibrationCapability) {
    vibrationCapability.setAttribute("data-vibration-capability", available ? "available" : "unsupported");
    vibrationCapability.hidden = available;
    vibrationCapability.textContent = available
      ? ""
      : "이 브라우저는 연속 진동을 지원하지 않습니다. 스위치용 짧은 시스템 햅틱은 검사 진동을 대신하지 못합니다. 저장한 세기는 유지되며, 소리와 검사 화면은 그대로 동작합니다.";
  }
  if (vibrationHelp) vibrationHelp.hidden = !available;
  if (vibrationInput) {
    vibrationInput.disabled = !available;
    if (!available) vibrationInput.setAttribute("aria-disabled", "true");
  }
  if (vibrationSummary && !available) {
    vibrationSummary.textContent = "준비와 검사 진동 (이 브라우저에서는 사용할 수 없음)";
  }
}

let vibrationRecheckTimers = [];
function clearVibrationRecheck() {
  vibrationRecheckTimers.forEach((id) => window.clearTimeout(id));
  vibrationRecheckTimers = [];
}

function cancelVibration() {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(0);
  } catch { /* Haptics are optional. */ }
}

function stopVibration() {
  clearVibrationRecheck();
  cancelVibration();
  // Android can drop a cancel that races the vibration it cancels (reported on a
  // Galaxy S25 Ultra); repeat it shortly after. A new start clears these first.
  vibrationRecheckTimers = [60, 180].map((ms) => window.setTimeout(cancelVibration, ms));
}

function startVibration(durationMs) {
  clearVibrationRecheck();
  if (typeof navigator.vibrate !== "function" || vibrationInput.value === "off") return;
  try {
    const pulse = { medium: [100, 100], high: [150, 50] }[vibrationInput.value];
    if (vibrationInput.value === "max") navigator.vibrate(durationMs);
    else if (pulse) {
      const pattern = [];
      let remaining = durationMs;
      while (remaining > 0) {
        const segment = Math.min(pulse[pattern.length % 2], remaining);
        pattern.push(segment);
        remaining -= segment;
      }
      navigator.vibrate(pattern);
    }
  } catch { /* Visual scanning still works without haptics. */ }
}

function onVibrationChange() {
  storageSet(VIBRATION_KEY, vibrationInput.value);
}

export {
  loadVibrationPreference, applyVibrationCapability, clearVibrationRecheck, stopVibration,
  startVibration, onVibrationChange,
};
