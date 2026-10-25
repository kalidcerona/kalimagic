import { trySetTruthAttempt, preparePerformance, resetAttempts } from "./logic.js";
import { settingsVisible, truthInput, startButton } from "./dom.js";
import { setStatus, soundEnabled, syncLiveScanDuration } from "./preferences.js";
import { setStage } from "./stage.js";
import { recorderThemes } from "./controller-themes.js";
import { ensureAudio } from "./controller-audio.js";
import { storageLocked, persistState, updateAttemptProgress } from "./controller-storage.js";
import { showPerformance } from "./controller-screens.js";
import { appState, setAppState } from "./controller-state.js";

function unlockFromGesture() {
  if (document.hidden || settingsVisible()) return;
  recorderThemes.setSoundEnabled(soundEnabled());
  recorderThemes.unlock();
  if (recorderThemes.active() || !soundEnabled() || document.hidden) return;
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    // Start a silent source inside the gesture to unlock iOS audio output.
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.onended = () => source.disconnect();
    source.start(0);
  } catch {
    /* A later gesture can retry without affecting the performance. */
  }
}

function commitTruthAttempt() {
  const next = trySetTruthAttempt(appState, truthInput.value);
  if (!next.ok) {
    truthInput.value = appState.settings.truthAttempts.join(",");
    setStatus("진실 회차는 1부터 20 사이의 서로 다른 정수를 쉼표로 구분해 입력하세요. 예: 2,4");
    return false;
  }
  setAppState(next.state);
  updateAttemptProgress();
  truthInput.value = appState.settings.truthAttempts.join(",");
  const saved = persistState();
  if (storageLocked) {
    setStatus("설정은 적용했습니다. 읽을 수 없는 저장값은 덮어쓰지 않습니다.");
  } else if (!saved) {
    setStatus("설정을 이 브라우저에 저장하지 못했습니다.");
  } else {
    setStatus("");
  }
  return true;
}

function onResetAttempts() {
  setAppState(resetAttempts(appState));
  updateAttemptProgress();
  setStage("idle");
  const saved = persistState();
  if (storageLocked) {
    setStatus("시도 횟수는 초기화했습니다. 읽을 수 없는 저장값은 덮어쓰지 않습니다.");
  } else if (!saved) {
    setStatus("시도 횟수는 초기화했지만 저장하지 못했습니다.");
  } else {
    setStatus("시도 횟수를 초기화했습니다.");
  }
}

function onStartPerformance() {
  syncLiveScanDuration();
  const next = preparePerformance(appState, truthInput.value);
  if (!next.ok) {
    setStatus("진실 회차는 1부터 20 사이의 서로 다른 정수를 쉼표로 구분해 입력하세요. 예: 4,7");
    truthInput.focus();
    return;
  }
  setAppState(next.state);
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
  setStage("idle");
  if (!persistState()) setStatus("이번 공연의 시도 횟수를 이 브라우저에 저장하지 못했습니다.");
  else setStatus("");
  unlockFromGesture();
  showPerformance();
  startButton.blur();
}

export { unlockFromGesture, commitTruthAttempt, onResetAttempts, onStartPerformance };
