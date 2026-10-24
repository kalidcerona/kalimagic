import { HOLD_THRESHOLD_MS, normalizeHoldThresholdMs } from "./logic.js";
import {
  detectorButton, soundInput, scanDurationInput, scanDurationHelp, holdDurationHelp, signalTimeMid,
  signalTimeEnd, settingsStatus,
} from "./dom.js";
import { SCAN_DURATION_KEY, SOUND_KEY, storageSet } from "./storage.js";
import { recorderThemes, settled, stopScanningSound, unlockFromGesture } from "./controller.js";

let scanDurationMs = HOLD_THRESHOLD_MS;

function setStatus(message) {
  settingsStatus.textContent = message;
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
  if (scanDurationHelp) scanDurationHelp.textContent = `버튼을 ${seconds}초 누르면 판정합니다. 0.5–10초, 0.5초 단위입니다.`;
  if (holdDurationHelp) holdDurationHelp.textContent = `접촉 버튼을 ${seconds}초 누르고 있으면 판정합니다.`;
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

function onSoundChange() {
  recorderThemes.setSoundEnabled(soundEnabled());
  persistSoundPreference();
  if (soundInput.checked) unlockFromGesture();
  else stopScanningSound();
}

export {
  scanDurationMs, setStatus, soundEnabled, loadSoundPreference, setScanDuration,
  syncLiveScanDuration, onScanDurationInput, onScanDurationChange, onSoundChange,
};
