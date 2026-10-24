const performanceScreen = document.querySelector("#performance-screen");
const detectorButton = document.querySelector("#detector-button");
const testIndicator = document.querySelector("#test-indicator");
const verdict = document.querySelector("#verdict");
const signalMode = document.querySelector(".signal-mode");
const settingsScreen = document.querySelector("#settings-screen");
const truthInput = document.querySelector("#truth-attempt");
const soundInput = document.querySelector("#sound-enabled");
const vibrationInput = document.querySelector("#vibration-level");
const vibrationHelp = document.querySelector("#vibration-help");
const vibrationCapability = document.querySelector("#vibration-capability");
const vibrationSummary = document.querySelector("#vibration-settings-summary");
const scanDurationInput = document.querySelector("#scan-duration");
const scanDurationHelp = document.querySelector("#scan-duration-help");
const holdDurationHelp = document.querySelector("#hold-duration-help");
const signalTimeMid = document.querySelector("#signal-time-mid");
const signalTimeEnd = document.querySelector("#signal-time-end");
const resetButton = document.querySelector("#reset-attempts");
const startButton = document.querySelector("#start-performance");
const settingsStatus = document.querySelector("#settings-status");
const attemptProgress = document.querySelector("#attempt-progress");

function pointOnButton(x, y, target) {
  if (performanceScreen.dataset.displayTheme !== "recorder" && target instanceof Element && target.closest("#detector-button")) return true;
  const rect = detectorButton.getBoundingClientRect();
  // The approved contact surfaces are rectangular, so blank table space is not a hit.
  if (rect.width <= 0 || rect.height <= 0) return false;
  return x >= rect.left && x <= rect.left + rect.width &&
    y >= rect.top && y <= rect.top + rect.height;
}

function settingsVisible() {
  return !settingsScreen.hidden;
}

export {
  performanceScreen, detectorButton, testIndicator, verdict, signalMode, settingsScreen, truthInput,
  soundInput, vibrationInput, vibrationHelp, vibrationCapability, vibrationSummary,
  scanDurationInput, scanDurationHelp, holdDurationHelp, signalTimeMid, signalTimeEnd, resetButton,
  startButton, settingsStatus, attemptProgress, pointOnButton, settingsVisible,
};
