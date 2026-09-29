/**
 * Performance UI for the lie detector.
 * Pointer timing and verdicts come from logic.js. This module only binds
 * gestures, visuals, sound, and storage. It never reads or writes the legacy
 * `usotsuki` localStorage key and never navigates or contacts a server.
 */

import {
  HOLD_THRESHOLD_MS,
  normalizeHoldThresholdMs,
  beginHold,
  createHold,
  loadFromRaw,
  mayOverwritePrimary,
  preparePerformance,
  releaseHold,
  resetAttempts,
  serializeState,
  trySetTruthAttempt,
  updateHold,
} from "./logic.js";

const STATE_KEY = "usotsuki.distribution.detector.v1";
const SCAN_DURATION_KEY = "usotsuki.detector.scan-duration.v1";
const SOUND_KEY = "usotsuki.distribution.detector.sound.v1";
const VIBRATION_KEY = "usotsuki.detector.vibration.v1";
const SWIPE_DOWN_PX = 96;
const READY_FEEDBACK_MS = 600;
const READY_HAPTIC_MS = { medium: 18, high: 28, max: 38 };
const STAGE_CLASSES = ["is-testing", "is-lie", "is-true", "is-cancelled"];

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

let appState = loadFromRaw(null).state;
let storageLocked = false;
let hold = createHold();
let holdTimer = 0;
let scanDurationMs = HOLD_THRESHOLD_MS;
let activeScanDurationMs = HOLD_THRESHOLD_MS;
let settled = true;
let activePointerId = null;
let gestureConsumed = false;
let audioContext = null;
let audioResumePromise = null;
let soundRequestId = 0;
let scanOscillator = null;
let scanGain = null;
let readyTimer = 0;
let readyFeedbackShown = false;

/** @type {Map<number, {x: number, y: number, startX: number, startY: number, startedOnButton: boolean}>} */
const pointers = new Map();

function storageGet(key) {
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

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

function setStatus(message) {
  settingsStatus.textContent = message;
}

function updateAttemptProgress() {
  attemptProgress.textContent = `현재 완료한 시도: ${appState.attemptCount}회 · 공연 시작 시 0회로 초기화`;
}

function soundEnabled() {
  return soundInput.checked;
}

function loadSoundPreference(raw) {
  if (raw === "0" || raw === "off" || raw === "false") soundInput.checked = false;
  if (raw === "1" || raw === "on" || raw === "true") soundInput.checked = true;
}

function persistSoundPreference() {
  storageSet(SOUND_KEY, soundInput.checked ? "1" : "0");
}

function paintScanDuration(ms) {
  const seconds = ms / 1000;
  if (scanDurationHelp) scanDurationHelp.textContent = `버튼을 ${seconds}초 누르면 판정합니다. 0.5-10초 사이에서 0.5초 단위로 설정하세요.`;
  if (holdDurationHelp) holdDurationHelp.textContent = `초록 버튼을 직접 누른 채 ${seconds}초 유지하면 판정이 나옵니다.`;
  if (signalTimeMid) signalTimeMid.textContent = `${seconds / 2}s`;
  if (signalTimeEnd) signalTimeEnd.textContent = `${seconds}s`;
  detectorButton.setAttribute("aria-label", `검사를 시작하려면 ${seconds}초간 누르기`);
}

// A finished number can be applied immediately. Blank and partial text must not
// replace the stored preference or the field the performer is still editing.
function finishedScanDurationMs(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;
  return normalizeHoldThresholdMs(numeric * 1000);
}

function setScanDuration(raw) {
  const numeric = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  scanDurationMs = normalizeHoldThresholdMs(numeric * 1000);
  const seconds = scanDurationMs / 1000;
  if (scanDurationInput) scanDurationInput.value = String(seconds);
  paintScanDuration(scanDurationMs);
}

function persistScanDuration() {
  return storageSet(SCAN_DURATION_KEY, String(scanDurationMs / 1000));
}

// Safari can leave a focused number unchanged on `change` until after the
// start control runs. Apply a finished value without rewriting partial text.
function syncLiveScanDuration() {
  if (!scanDurationInput) return false;
  const ms = finishedScanDurationMs(scanDurationInput.value);
  if (ms == null) return false;
  scanDurationMs = ms;
  // A hold already captured activeScanDurationMs. Do not move its scale mid-scan.
  if (settled) paintScanDuration(ms);
  return persistScanDuration();
}

function onScanDurationInput() {
  syncLiveScanDuration();
}

function onScanDurationChange() {
  setScanDuration(scanDurationInput.value);
  if (!persistScanDuration()) {
    setStatus("검사 시간은 적용했지만 이 브라우저에 저장하지 못했습니다.");
  }
}

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

function stopVibration() {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(0);
  } catch { /* Haptics are optional. */ }
}

function startVibration(durationMs) {
  if (typeof navigator.vibrate !== "function") return;
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
    storageLocked = false;
    setStatus("브라우저 저장소를 사용할 수 없습니다. 이번 공연 값만 유지됩니다.");
    return;
  }
  const loaded = loadFromRaw(stored.value);
  appState = loaded.state;
  storageLocked = loaded.preserveStoredRaw === true;
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
  if (!storageLocked && stored.value) {
    try {
      const old = JSON.parse(stored.value);
      if (old?.settings && !Array.isArray(old.settings.truthAttempts) && old.settings.truthAttempt != null) {
        persistState();
      }
    } catch { /* loadFromRaw already preserves unreadable content */ }
  }
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

function setStage(mode) {
  if (signalMode) signalMode.textContent = mode === "testing" ? "측정 중" : mode === "cancelled" ? "취소" : mode === "TRUE" || mode === "LIE" ? "완료" : "대기";
  if (readyTimer) {
    window.clearTimeout(readyTimer);
    readyTimer = 0;
  }
  for (const node of [document.body, performanceScreen, detectorButton, verdict]) {
    node.classList.remove(...STAGE_CLASSES);
  }
  detectorButton.setAttribute("aria-busy", mode === "testing" ? "true" : "false");
  if (mode === "testing") {
    performanceScreen.classList.add("is-testing");
    detectorButton.classList.add("is-testing");
    document.body.classList.add("is-testing");
    testIndicator.textContent = "검사 중";
    verdict.textContent = "";
    return;
  }
  if (mode === "cancelled") {
    performanceScreen.classList.add("is-cancelled");
    detectorButton.classList.add("is-cancelled");
    verdict.classList.add("is-cancelled");
    testIndicator.textContent = "취소됨";
    verdict.textContent = "";
    return;
  }
  if (mode === "LIE" || mode === "TRUE") {
    const tone = mode === "TRUE" ? "is-true" : "is-lie";
    performanceScreen.classList.add(tone);
    detectorButton.classList.add(tone);
    verdict.classList.add(tone);
    document.body.classList.add(tone);
    testIndicator.textContent = "";
    verdict.textContent = mode === "TRUE" ? "진실" : "거짓";
    return;
  }
  testIndicator.textContent = "검사 대기 중";
  verdict.textContent = "";
}

function showReadyFeedback() {
  testIndicator.textContent = "준비완료";
  const pulseMs = READY_HAPTIC_MS[vibrationInput.value];
  if (pulseMs && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(pulseMs); } catch { /* Visual feedback remains available. */ }
  }
  readyTimer = window.setTimeout(() => {
    readyTimer = 0;
    if (testIndicator.textContent === "준비완료") testIndicator.textContent = "검사 대기 중";
  }, READY_FEEDBACK_MS);
}

function pointOnButton(x, y, target) {
  if (target instanceof Element && target.closest("#detector-button")) return true;
  const rect = detectorButton.getBoundingClientRect();
  const radius = rect.width / 2;
  if (radius <= 0) return false;
  const centerX = rect.left + radius;
  const centerY = rect.top + rect.height / 2;
  return Math.hypot(x - centerX, y - centerY) <= radius + 1;
}

function settingsVisible() {
  return !settingsScreen.hidden;
}

function showSettings() {
  stopScanningSound();
  stopVibration();
  if (readyTimer) {
    window.clearTimeout(readyTimer);
    readyTimer = 0;
  }
  settingsScreen.hidden = false;
  performanceScreen.hidden = true;
  detectorButton.disabled = true;
  document.body.classList.remove("is-testing");
  performanceScreen.classList.remove("is-testing");
  detectorButton.classList.remove("is-testing");
  detectorButton.setAttribute("aria-busy", "false");
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
}

function showPerformance() {
  gestureConsumed = false;
  readyFeedbackShown = false;
  pointers.clear();
  settingsScreen.hidden = true;
  performanceScreen.hidden = false;
  detectorButton.disabled = false;
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
  if (!soundEnabled()) return;
  withReadyAudio((ctx) => {
    // Let the scan tone's short release ramp finish before the verdict cue.
    const start = ctx.currentTime + 0.06;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.8, start);
    master.connect(ctx.destination);
    if (result === "LIE") {
      playTone(ctx, master, 196, start, 0.34, "square", 0.24);
      playTone(ctx, master, 277, start, 0.34, "square", 0.12);
      window.setTimeout(() => master.disconnect(), 500);
      return;
    }
    if (result === "TRUE") {
      // ding-dong-dang: three separated notes, not a chord.
      const notes = [784, 659.25, 1046.5];
      notes.forEach((frequency, index) => {
        playTone(ctx, master, frequency, start + index * 0.2, 0.18, "sine", 0.32);
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
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.08);
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
  if (result.outcome === "cancelled") setStage("cancelled");
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
  setStage("testing");
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
  });
  try {
    performanceScreen.setPointerCapture(event.pointerId);
  } catch {
    /* Capture can fail if the pointer already ended. */
  }
  unlockFromGesture();
  if (!onButton && !readyFeedbackShown) {
    readyFeedbackShown = true;
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
  if (event.pointerId === activePointerId && !settled && hold.phase === "holding") {
    const updated = updateHold(hold, event.clientX, event.clientY);
    hold = updated.hold;
    if (updated.cancelled) applyRelease(performance.now(), event.clientX, event.clientY);
  }
  maybeOpenFromSwipe();
}

function onPointerUp(event) {
  const contact = pointers.get(event.pointerId);
  if (!contact) return;
  contact.x = event.clientX;
  contact.y = event.clientY;
  if (event.pointerId === activePointerId && !settled) {
    applyRelease(performance.now(), event.clientX, event.clientY);
  }
  maybeOpenFromSwipe();
  forgetPointer(event.pointerId);
}

function onPointerCancel(event) {
  if (event.pointerId === activePointerId) cancelUnsettledHold();
  forgetPointer(event.pointerId);
}

function unlockFromGesture() {
  if (!soundEnabled() || document.hidden) return;
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
    setStatus("TRUE 회차는 1부터 20 사이의 서로 다른 정수를 쉼표로 구분해 입력하세요. 예: 2,4");
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
    setStatus("TRUE 회차는 1부터 20 사이의 서로 다른 정수를 쉼표로 구분해 입력하세요. 예: 4,7");
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

function onSoundChange() {
  persistSoundPreference();
  if (soundInput.checked) unlockFromGesture();
  else stopScanningSound();
}

function onVibrationChange() {
  storageSet(VIBRATION_KEY, vibrationInput.value);
}

function onVisibilityChange() {
  if (!document.hidden) return;
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  stopScanningSound();
  stopVibration();
  pointers.clear();
  activePointerId = null;
  // Discard contexts that iOS can leave frozen after backgrounding.
  const ctx = audioContext;
  audioContext = null;
  audioResumePromise = null;
  try { ctx?.close().catch(() => {}); } catch { /* Already closed. */ }
}

function onRehearsalKey(event) {
  if (event.key !== "Escape" || !event.shiftKey || event.isComposing) return;
  if (performanceScreen.hidden) return;
  event.preventDefault();
  openSettings();
}

function bind() {
  performanceScreen.addEventListener("touchstart", unlockFromGesture, { passive: true });
  performanceScreen.addEventListener("touchend", unlockFromGesture, { passive: true });
  performanceScreen.addEventListener("click", unlockFromGesture);
  performanceScreen.addEventListener("pointerdown", onPointerDown, { passive: false });
  performanceScreen.addEventListener("pointermove", onPointerMove);
  performanceScreen.addEventListener("pointerup", onPointerUp);
  performanceScreen.addEventListener("pointercancel", onPointerCancel);
  performanceScreen.addEventListener("contextmenu", (event) => event.preventDefault());
  truthInput.addEventListener("change", commitTruthAttempt);
  resetButton.addEventListener("click", onResetAttempts);
  startButton.addEventListener("click", onStartPerformance);
  soundInput.addEventListener("change", onSoundChange);
  vibrationInput.addEventListener("change", onVibrationChange);
  scanDurationInput?.addEventListener("input", onScanDurationInput);
  scanDurationInput?.addEventListener("blur", onScanDurationInput);
  scanDurationInput?.addEventListener("change", onScanDurationChange);
  window.addEventListener("keydown", onRehearsalKey);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

bootStorage();
showSettings();
bind();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
