import { updateAlterState } from "./logic.js";
import { createObservationTracker } from "./performance.js";
import { coverGeometry } from "./camera-geometry.js";
import { createBackgroundCalibrator } from "./calibration.js";
import { installLocalPreview } from './local-preview.js'; // local-preview-hook
import { $, stage, video, settings, rank, suit, brightness } from "./dom.js";
import { machine, stream, sampleGeometry, setMachine, setTracker, setCalibrator } from "./state.js";
import { recordLifecycle, setRuntimeStatus } from "./status.js";
import { closeGestureGuide, showGestureGuide, readSavedSettings } from "./settings-store.js";
import { renderCard, updateStateNote } from "./card-view.js";
import { resetAppearance, geometryKey, resetGeometry } from "./tracking-reset.js";
import { hideOverlay } from "./overlay.js";
import { releaseWakeLock, acquireWakeLock } from "./wake-lock.js";
import { openSettings, closeSettings, settingsContacts, settingsPairReady } from "./settings-panel.js";
import { stopCamera, startCamera, suspendAnalysis, resumeAnalysis } from "./camera.js";

let settingsOrigins = null;
let settingsGestureBlocked = false;

$("start").addEventListener("click", startCamera);
$("close-gesture-guide").addEventListener("click", () => closeGestureGuide());
$("setup-settings").addEventListener("click", openSettings);
$("close-settings").addEventListener("click", closeSettings);
$("reveal").addEventListener("click", () => {
  setMachine(updateAlterState(machine, { type: "reveal", t: performance.now() }));
  resetAppearance();
  hideOverlay();
  closeSettings();
});
$("reset").addEventListener("click", () => {
  setMachine(updateAlterState(machine, { type: "reset" }));
  setTracker(createObservationTracker());
  setCalibrator(createBackgroundCalibrator());
  resetAppearance();
  setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
  hideOverlay();
  closeSettings();
});
$("stop").addEventListener("click", () => stopCamera());
for (const control of [rank, suit, brightness]) {
  control.addEventListener("change", () => {
    renderCard();
    setMachine(updateAlterState(machine, { type: "reset" }));
    setTracker(createObservationTracker());
    setCalibrator(createBackgroundCalibrator());
    resetAppearance();
    setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
    hideOverlay();
    updateStateNote();
  });
}
stage.addEventListener("touchstart", (event) => {
  if (event.touches.length > 2) {
    settingsGestureBlocked = true;
    settingsOrigins = null;
    return;
  }
  if (event.touches.length === 2 && !settingsGestureBlocked) {
    settingsOrigins = settingsContacts(event.touches);
    return;
  }
  settingsOrigins = null;
}, { passive: true });
stage.addEventListener("touchmove", (event) => {
  if (settingsGestureBlocked || !settingsOrigins || event.touches.length !== 2) return;
  if (!settingsPairReady(settingsOrigins, settingsContacts(event.touches))) return;
  settingsOrigins = null;
  settingsGestureBlocked = true;
  event.preventDefault();
  openSettings();
}, { passive: false });
stage.addEventListener("touchend", (event) => {
  if (event.touches.length < 2) settingsOrigins = null;
  if (event.touches.length === 0) settingsGestureBlocked = false;
}, { passive: true });
stage.addEventListener("touchcancel", () => {
  settingsOrigins = null;
  settingsGestureBlocked = false;
}, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settings.hidden) closeSettings();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    suspendAnalysis("visibility-hidden");
    releaseWakeLock();
  } else {
    resumeAnalysis();
    acquireWakeLock();
  }
});
window.addEventListener("pagehide", () => suspendAnalysis("page-hidden"));
window.addEventListener("pageshow", resumeAnalysis);
window.addEventListener("resize", () => {
  if (!stream) return;
  const geometry = coverGeometry(
    video.videoWidth, video.videoHeight, stage.clientWidth, stage.clientHeight,
  );
  if (!geometry) return;
  const nextGeometry = geometryKey(geometry);
  if (sampleGeometry === nextGeometry) return;
  resetGeometry(nextGeometry);
  recordLifecycle("resize");
});

showGestureGuide();
readSavedSettings();
renderCard();
updateStateNote();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
installLocalPreview(() => { openSettings(); }); // local-preview-hook
