import { performanceScreen, testIndicator, vibrationInput, settingsVisible } from "./dom.js";
import { presentInk, setStage } from "./stage.js";
import { holdPointerId } from "./controller-state.js";

function needsHapticPreparation() {
  return typeof navigator.vibrate === "function" && vibrationInput.value !== "off" &&
    navigator.userActivation?.hasBeenActive === false;
}

function refreshHapticPreparation() {
  if (performanceScreen.hidden || settingsVisible() || holdPointerId != null) return;
  const preparing = needsHapticPreparation();
  if (preparing) performanceScreen.classList.add("is-preparing");
  else performanceScreen.classList.remove("is-preparing");
  if (preparing) {
    testIndicator.textContent = "한 번 터치해 준비";
    presentInk(testIndicator);
  } else if (testIndicator.textContent === "한 번 터치해 준비") {
    setStage("idle");
  }
}

export { needsHapticPreparation, refreshHapticPreparation };
