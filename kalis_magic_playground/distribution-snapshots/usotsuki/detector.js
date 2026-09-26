/**
 * Performance UI for the lie detector.
 * Pointer timing and verdicts come from logic.js. This module only binds
 * gestures, visuals, sound, and storage. It never reads or writes the legacy
 * `usotsuki` localStorage key and never navigates or contacts a server.
 */

import {
  HOLD_THRESHOLD_MS,
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
const SOUND_KEY = "usotsuki.distribution.detector.sound.v1";
const SWIPE_DOWN_PX = 96;
const STAGE_CLASSES = ["is-testing", "is-lie", "is-true", "is-cancelled"];

const performanceScreen = document.querySelector("#performance-screen");
const detectorButton = document.querySelector("#detector-button");
const testIndicator = document.querySelector("#test-indicator");
const verdict = document.querySelector("#verdict");
const settingsScreen = document.querySelector("#settings-screen");
const truthInput = document.querySelector("#truth-attempt");
const soundInput = document.querySelector("#sound-enabled");
const resetButton = document.querySelector("#reset-attempts");
const startButton = document.querySelector("#start-performance");
const settingsStatus = document.querySelector("#settings-status");
const attemptProgress = document.querySelector("#attempt-progress");

let appState = loadFromRaw(null).state;
let storageLocked = false;
let hold = createHold();
let holdTimer = 0;
let settled = true;
let activePointerId = null;
let gestureConsumed = false;
let audioContext = null;
let scanOscillator = null;
let scanGain = null;

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

function bootStorage() {
  const stored = storageGet(STATE_KEY);
  const sound = storageGet(SOUND_KEY);
  if (!stored.ok) {
    appState = loadFromRaw(null).state;
    storageLocked = false;
    setStatus("브라우저 저장소를 사용할 수 없습니다. 이번 공연 값만 유지됩니다.");
    return;
  }
  const loaded = loadFromRaw(stored.value);
  appState = loaded.state;
  storageLocked = loaded.preserveStoredRaw === true;
  if (sound.ok) loadSoundPreference(sound.value);
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
    verdict.textContent = mode;
    return;
  }
  testIndicator.textContent = "READY TO SCAN";
  verdict.textContent = "";
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
  pointers.clear();
  settingsScreen.hidden = true;
  performanceScreen.hidden = false;
  detectorButton.disabled = false;
}

function ensureAudio() {
  if (!soundEnabled()) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
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
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
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
  } catch {
    /* Visual result still stands when audio is unavailable. */
  }
}

function stopScanningSound() {
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
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(148, now);
    oscillator.frequency.linearRampToValueAtTime(226, now + 1.85);
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
  } catch {
    stopScanningSound();
    /* Visual reaction still works when audio is unavailable. */
  }
}

function applyRelease(nowMs, x, y) {
  if (settled) return;
  settled = true;
  clearHoldTimer();
  stopScanningSound();
  const result = releaseHold(appState, hold, nowMs, x, y);
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
    applyRelease(performance.now(), hold.originX, hold.originY);
  }, HOLD_THRESHOLD_MS);
}

function startHold(event) {
  const begun = beginHold(createHold(), performance.now(), event.clientX, event.clientY);
  if (!begun.accepted) return;
  hold = begun.hold;
  settled = false;
  activePointerId = event.pointerId;
  setStage("testing");
  startScanningSound();
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
  if (!soundEnabled()) return;
  ensureAudio();
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

function onVisibilityChange() {
  if (!document.hidden) return;
  if (!settled && hold.phase !== "idle") cancelUnsettledHold();
  stopScanningSound();
  pointers.clear();
  activePointerId = null;
}

function onRehearsalKey(event) {
  if (event.key !== "Escape" || !event.shiftKey || event.isComposing) return;
  if (performanceScreen.hidden) return;
  event.preventDefault();
  openSettings();
}

function bind() {
  performanceScreen.addEventListener("pointerdown", onPointerDown, { passive: false });
  performanceScreen.addEventListener("pointermove", onPointerMove);
  performanceScreen.addEventListener("pointerup", onPointerUp);
  performanceScreen.addEventListener("pointercancel", onPointerCancel);
  performanceScreen.addEventListener("contextmenu", (event) => event.preventDefault());
  truthInput.addEventListener("change", commitTruthAttempt);
  resetButton.addEventListener("click", onResetAttempts);
  startButton.addEventListener("click", onStartPerformance);
  soundInput.addEventListener("change", onSoundChange);
  window.addEventListener("keydown", onRehearsalKey);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

bootStorage();
showSettings();
bind();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
