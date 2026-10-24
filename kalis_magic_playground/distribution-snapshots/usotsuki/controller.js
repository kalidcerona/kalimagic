import {
  HOLD_THRESHOLD_MS, beginHold, createHold, loadFromRaw, mayOverwritePrimary, preparePerformance,
  releaseHold, resetAttempts, serializeState, trySetTruthAttempt, updateHold, verdictForAttempt,
} from "./logic.js";
import { createRecorderThemeController } from "./recorder-theme.js";
import {
  performanceScreen, detectorButton, testIndicator, settingsScreen, truthInput, vibrationInput,
  startButton, attemptProgress, pointOnButton, settingsVisible,
} from "./dom.js";
import {
  STATE_KEY, SCAN_DURATION_KEY, SOUND_KEY, VIBRATION_KEY, storageGet, storageSet,
} from "./storage.js";
import {
  loadVibrationPreference, applyVibrationCapability, stopVibration, startVibration,
} from "./vibration.js";
import { acquireWakeLock, releaseWakeLock, syncPerformanceWakeLock } from "./wake-lock.js";
import {
  scanDurationMs, setStatus, soundEnabled, loadSoundPreference, setScanDuration,
  syncLiveScanDuration,
} from "./preferences.js";
import {
  stopLiveTrace, startLiveTrace, centerWoodText, stopWoodPaper, setLiveContact, presentInk,
  presentStatuses, setStage, showReadyFeedback, showSettings,
} from "./stage.js";
import { bind } from "./bindings.js";

const SWIPE_DOWN_PX = 96;

// Pre-verdict sound dip, matched to recorder A: 420 ms of silence plus the 46 ms
// to the first typebar strike. The verdict cue starts 60 ms after the release,
// so the scan tone is silent for the last 406 ms (after a 35 ms fade).
const SCAN_DIP_MS = 406;
const SCAN_DIP_FADE_MS = 35;

const recorderThemes = createRecorderThemeController(performanceScreen, () => ({
  sound: soundEnabled(), duration: activeScanDurationMs,
  startedAt: hold.startedAt, holding: !settled && hold.phase === "holding",
  verdict: verdictForAttempt(appState.attemptCount + 1, appState.settings.truthAttempts),
  attempt: appState.attemptCount,
}));

let appState = loadFromRaw(null).state;
let storageLocked = false;
let hold = createHold();
let holdTimer = 0;

let activeScanDurationMs = HOLD_THRESHOLD_MS;
let settled = true;
let activePointerId = null;
let holdPointerId = null;
let readyPointerId = null;
let primerPointerId = null;
let gestureConsumed = false;
let audioContext = null;
let audioResumePromise = null;
let soundRequestId = 0;
let scanOscillator = null;
let scanGain = null;

let readyFeedbackShown = false;

/** @type {Map<number, {x: number, y: number, startX: number, startY: number, startedOnButton: boolean, pointerType: string}>} */
const pointers = new Map();

function canPersistState() {
  return mayOverwritePrimary({
    preserveStoredRaw: storageLocked,
    backupSaved: false,
    acknowledged: false,
  });
}

function persistState() {
  if (!canPersistState()) return false;
  return storageSet(STATE_KEY, serializeState(appState));
}

function updateAttemptProgress() {
  attemptProgress.textContent = `완료한 시도 ${appState.attemptCount}회. 공연을 시작하면 0이 됩니다.`;
}

function bootStorage() {
  const stored = storageGet(STATE_KEY);
  const sound = storageGet(SOUND_KEY);
  const vibration = storageGet(VIBRATION_KEY);
  setScanDuration(storageGet(SCAN_DURATION_KEY).value);
  if (sound.ok) loadSoundPreference(sound.value);
  if (vibration.ok) loadVibrationPreference(vibration.value);
  applyVibrationCapability();
  if (!stored.ok) {
    appState = loadFromRaw(null).state;
    storageLocked = true;
    setStatus("브라우저 저장소를 사용할 수 없습니다. 이번 공연 값만 유지됩니다.");
    return;
  }
  const loaded = loadFromRaw(stored.value);
  appState = loaded.state;
  storageLocked = loaded.preserveStoredRaw === true;
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
  if (storageLocked) {
    setStatus("저장된 기록을 읽지 못했습니다. 기존 값은 덮어쓰지 않습니다.");
  }
}

function clearHoldTimer() {
  if (holdTimer) {
    window.clearTimeout(holdTimer);
    holdTimer = 0;
  }
}

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

function showPerformance() {
  gestureConsumed = false;
  readyFeedbackShown = false;
  pointers.clear();
  settingsScreen.hidden = true;
  performanceScreen.hidden = false;
  centerWoodText();
  resumeRecorderTheme();
  detectorButton.disabled = false;
  primerPointerId = null;
  refreshHapticPreparation();
  syncPerformanceWakeLock();
}

function ensureAudio() {
  if (!soundEnabled()) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioCtx();
    audioResumePromise = null;
  }
  const ctx = audioContext;
  if (ctx.state !== "running") {
    // Retry from each real gesture, including WebKit's interrupted state.
    audioResumePromise = Promise.resolve(ctx.resume()).catch(() => {});
  }
  return ctx;
}

function withReadyAudio(play) {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const requestId = soundRequestId;
    const playIfCurrent = () => {
      if (requestId !== soundRequestId || ctx !== audioContext ||
          ctx.state !== "running" || !soundEnabled() || document.hidden) return;
      try { play(ctx); } catch { /* Visual feedback remains available. */ }
    };
    if (ctx.state === "running") playIfCurrent();
    else audioResumePromise?.then(playIfCurrent);
  } catch {
    /* Audio support or permission may be unavailable. */
  }
}

function playTone(ctx, destination, frequency, startAt, duration, type, peak) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function playVerdictSound(result) {
  if (recorderThemes.active()) return;
  if (!soundEnabled()) return;
  withReadyAudio((ctx) => {
    // Let the scan tone's short release ramp finish before the verdict cue.
    const start = ctx.currentTime + 0.06;
    const master = ctx.createGain();
    master.gain.setValueAtTime(1, start);
    master.connect(ctx.destination);
    if (result === "LIE") {
      // The two peaks sum to 0.76, leaving headroom at the output.
      playTone(ctx, master, 196, start, 0.34, "square", 0.52);
      playTone(ctx, master, 277, start, 0.34, "square", 0.24);
      window.setTimeout(() => master.disconnect(), 500);
      return;
    }
    if (result === "TRUE") {
      // ding-dong-dang: three separated notes, not a chord.
      const notes = [784, 659.25, 1046.5];
      notes.forEach((frequency, index) => {
        playTone(ctx, master, frequency, start + index * 0.2, 0.18, "sine", 0.68);
      });
      window.setTimeout(() => master.disconnect(), 800);
    }
  });
}

function stopScanningSound() {
  // Also cancel callbacks waiting for resume, even before a node exists.
  soundRequestId += 1;
  if (!scanOscillator) return;
  const oscillator = scanOscillator;
  const gain = scanGain;
  scanOscillator = null;
  scanGain = null;
  try {
    const now = audioContext?.currentTime ?? 0;
    gain?.gain.cancelScheduledValues(now);
    if (gain) {
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    }
    oscillator.stop(now + 0.045);
  } catch {
    try { oscillator.stop(); } catch { /* Oscillator may already have stopped. */ }
  }
}

function startScanningSound() {
  stopScanningSound();
  if (recorderThemes.active()) return;
  if (!soundEnabled()) return;
  withReadyAudio((ctx) => {
    if (settled || hold.phase !== "holding" || activePointerId == null) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(148, now);
    oscillator.frequency.linearRampToValueAtTime(226, now + activeScanDurationMs / 1000 * 0.925);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.17, now + 0.08);
    const remainingS = (activeScanDurationMs - (performance.now() - hold.startedAt)) / 1000;
    const dipFadeStart = now + remainingS - (SCAN_DIP_MS + SCAN_DIP_FADE_MS) / 1000;
    if (dipFadeStart > now + 0.4) {
      gain.gain.setValueAtTime(0.17, dipFadeStart);
      gain.gain.exponentialRampToValueAtTime(0.0001, dipFadeStart + SCAN_DIP_FADE_MS / 1000);
    }
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    scanOscillator = oscillator;
    scanGain = gain;
    oscillator.start(now);
  });
}

function applyRelease(nowMs, x, y) {
  if (settled) return;
  settled = true;
  clearHoldTimer();
  stopScanningSound();
  stopVibration();
  const result = releaseHold(appState, hold, nowMs, x, y, activeScanDurationMs);
  hold = result.hold;
  appState = result.state;
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
  hold = begun.hold;
  syncLiveScanDuration();
  activeScanDurationMs = scanDurationMs;
  settled = false;
  activePointerId = event.pointerId;
  holdPointerId = event.pointerId;
  setLiveContact(true);
  setStage("testing");
  recorderThemes.begin();
  startScanningSound();
  startVibration(activeScanDurationMs);
  armThresholdTimer();
}

function cancelUnsettledHold() {
  if (settled || hold.phase === "idle") {
    activePointerId = null;
    return;
  }
  const startedAt = hold.startedAt;
  applyRelease(startedAt, Number.NaN, Number.NaN);
  activePointerId = null;
}

function openSettings() {
  if (performanceScreen.hidden) return;
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  pointers.clear();
  activePointerId = null;
  holdPointerId = null;
  readyPointerId = null;
  primerPointerId = null;
  setLiveContact(false);
  gestureConsumed = false;
  clearHoldTimer();
  showSettings();
}

function forgetPointer(pointerId) {
  pointers.delete(pointerId);
  if (pointerId === activePointerId) activePointerId = null;
  if (pointers.size < 2) gestureConsumed = false;
}

function maybeOpenFromSwipe() {
  if (gestureConsumed || settingsVisible() || pointers.size !== 2) return;
  const contacts = [...pointers.values()];
  if (contacts.some((contact) => contact.startedOnButton)) return;
  const bothOutside = contacts.every((contact) => !pointOnButton(contact.x, contact.y, null));
  if (!bothOutside) return;
  const bothDown = contacts.every((contact) => {
    const dx = contact.x - contact.startX;
    const dy = contact.y - contact.startY;
    return dy >= SWIPE_DOWN_PX && dy > Math.abs(dx);
  });
  if (!bothDown) return;
  gestureConsumed = true;
  openSettings();
}

function onPointerDown(event) {
  if (performanceScreen.hidden || settingsVisible()) return;
  if (event.cancelable) event.preventDefault();
  const onButton = pointOnButton(event.clientX, event.clientY, event.target);
  pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    startedOnButton: onButton,
    pointerType: event.pointerType,
  });
  // Travel before the second finger lands does not count toward the 96px rule.
  if (pointers.size === 2 && [...pointers.values()].every((contact) => contact.pointerType === 'touch')) {
    for (const contact of pointers.values()) {
      contact.startX = contact.x;
      contact.startY = contact.y;
    }
  }
  try {
    performanceScreen.setPointerCapture(event.pointerId);
  } catch {
    /* Capture can fail if the pointer already ended. */
  }
  unlockFromGesture();
  // Loading blocks only the contact pad; outside pointers still open settings.
  if (onButton && performanceScreen.dataset.recorderLoading === "true") return;
  // Touch activation occurs at lift, not down. Preparation never counts an attempt.
  if (needsHapticPreparation()) {
    if (onButton && pointers.size === 1) { primerPointerId = event.pointerId; recorderThemes.setPressed(true); }
    refreshHapticPreparation();
    return;
  }
  refreshHapticPreparation();
  if (!onButton && !readyFeedbackShown && holdPointerId == null) {
    readyFeedbackShown = true;
    readyPointerId = event.pointerId;
    showReadyFeedback();
  }
  if (pointers.size > 1) {
    if (!settled && hold.phase !== "idle") cancelUnsettledHold();
    return;
  }
  if (onButton && activePointerId == null) startHold(event);
}

function onPointerMove(event) {
  const contact = pointers.get(event.pointerId);
  if (!contact || performanceScreen.hidden) return;
  contact.x = event.clientX;
  contact.y = event.clientY;
  if (performanceScreen.dataset.displayTheme === "recorder" && event.pointerId === holdPointerId && !pointOnButton(contact.x, contact.y, null)) {
    if (!settled) cancelUnsettledHold();
    setLiveContact(false);
    holdPointerId = null;
  }
  if (event.pointerId === activePointerId && !settled && hold.phase === "holding") {
    const updated = updateHold(hold, event.clientX, event.clientY);
    hold = updated.hold;
    if (updated.cancelled) applyRelease(performance.now(), event.clientX, event.clientY);
  }
  maybeOpenFromSwipe();
}

function onPointerUp(event) {
  if (event.pointerId === primerPointerId) {
    primerPointerId = null;
    recorderThemes.setPressed(false);
    stopVibration();
    forgetPointer(event.pointerId);
    refreshHapticPreparation();
    return;
  }
  const contact = pointers.get(event.pointerId);
  if (!contact) return;
  contact.x = event.clientX;
  contact.y = event.clientY;
  const endsHold = event.pointerId === holdPointerId || event.pointerId === activePointerId;
  const endsReady = event.pointerId === readyPointerId;
  if (event.pointerId === activePointerId && !settled) {
    applyRelease(performance.now(), event.clientX, event.clientY);
  }
  if (endsHold || endsReady) {
    stopVibration();
    if (endsReady) readyPointerId = null;
    setLiveContact(false);
    if (event.pointerId === holdPointerId) holdPointerId = null;
  }
  maybeOpenFromSwipe();
  forgetPointer(event.pointerId);
}

function onPointerCancel(event) {
  if (event.pointerId === primerPointerId) { primerPointerId = null; recorderThemes.setPressed(false); }
  const endsHold = event.pointerId === holdPointerId || event.pointerId === activePointerId;
  const endsReady = event.pointerId === readyPointerId;
  if (endsHold && !settled && hold.phase !== "idle") cancelUnsettledHold();
  if (endsHold || endsReady) stopVibration();
  if (endsHold) { setLiveContact(false); holdPointerId = null; activePointerId = null; }
  if (endsReady) readyPointerId = null;
  forgetPointer(event.pointerId);
}

function onLostPointerCapture(event) {
  // A missing pointerup is a cancelled contact, never an extra attempt.
  onPointerCancel(event);
}

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
  appState = next.state;
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
  appState = resetAttempts(appState);
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
  appState = next.state;
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
  setStage("idle");
  if (!persistState()) setStatus("이번 공연의 시도 횟수를 이 브라우저에 저장하지 못했습니다.");
  else setStatus("");
  unlockFromGesture();
  showPerformance();
  startButton.blur();
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
  activePointerId = null;
  holdPointerId = null;
  readyPointerId = null;
  primerPointerId = null;
  // Discard contexts that iOS can leave frozen after backgrounding.
  const ctx = audioContext;
  audioContext = null;
  audioResumePromise = null;
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
  activePointerId = null;
  holdPointerId = null;
  readyPointerId = null;
  primerPointerId = null;
}

// Display appearance is independent of the detector's performance state.
const DISPLAY_THEME_KEY = "usotsuki.distribution.detector.theme.v1";
const displayThemeSelect = document.querySelector("#display-theme");
function normalizeDisplayTheme(value) { return ["green", "wine", "recorder", "recorder-a", "recorder-d"].includes(value) ? value : "green"; }
function applyDisplayTheme(value) {
  const theme = normalizeDisplayTheme(value);
  if (performanceScreen.dataset.displayTheme !== theme) {
    stopScanningSound();
    const previousAudio = audioContext;
    audioContext = null;
    audioResumePromise = null;
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

bootStorage();
appState = resetAttempts(appState);
updateAttemptProgress();
// Loading preserves the original stored bytes; saves happen only after user actions.
setStage("idle");
showPerformance();
bind();

export {
  recorderThemes, appState, hold, activeScanDurationMs, settled, holdPointerId, pointers,
  updateAttemptProgress, refreshHapticPreparation, stopScanningSound, openSettings, onPointerDown,
  onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, unlockFromGesture,
  commitTruthAttempt, onResetAttempts, onStartPerformance, resumeRecorderTheme, onVisibilityChange,
  onWindowBlur,
};
