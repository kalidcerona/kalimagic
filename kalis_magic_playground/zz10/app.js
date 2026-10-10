import { AlterState, createAlterState, updateAlterState } from "./logic.js";
import { cardOcclusionMask, detectCard, detectCardAgainstBackground, mapSourceOntoCorners } from "./vision.js";
import { createDisplaySmoother, createObservationTracker, overlayCorners, smoothDisplayedCorners, trackObservation } from "./performance.js";
import { coverGeometry, samplePointToView } from "./camera-geometry.js";
import { claimCalibrationReady, createBackgroundCalibrator, observeCalibration } from "./calibration.js";
import { createPaperMatch, remapOcclusionToDisplay, resolveOverlayMask, sampleCardPaper, updatePaperMatch } from "./appearance.js";

const $ = (id) => document.getElementById(id);
const setup = $("setup");
const stage = $("stage");
const video = $("camera");
const overlay = $("card-overlay");
const settings = $("settings");
const rank = $("rank");
const suit = $("suit");
const brightness = $("brightness");
const stateNote = $("state-note");
const runtimeNote = $("runtime-note");
const gestureGuide = $("gesture-guide");
const gestureGuideKey = "alter-settings-gesture-guide-v1";
const sample = document.createElement("canvas");
const sampleContext = sample.getContext("2d", { willReadFrequently: true });
const occlusionCanvas = document.createElement("canvas");
const occlusionContext = occlusionCanvas.getContext("2d");
const suits = {
  spade: { symbol: "♠", red: false },
  heart: { symbol: "♥", red: true },
  club: { symbol: "♣", red: false },
  diamond: { symbol: "♦", red: true },
};

let machine = createAlterState({ exitDelayMs: 0 });
let tracker = createObservationTracker();
let stream = null;
let cameraEnded = false;
let animation = 0;
let lastSampleAt = 0;
let calibrator = createBackgroundCalibrator();
let settingsOrigins = null;
let settingsGestureBlocked = false;
let sampleIntervalMs = 60;
let sampleGeometry = null;
let displaySmooth = createDisplaySmoother();
let paperMatch = createPaperMatch();
let occlusionSlot = { quadKey: "", mask: null };
const lifecycleCounts = Object.create(null);

// Only event codes/counts are retained; frames and device details are never logged.
function recordLifecycle(code) {
  lifecycleCounts[code] = Math.min(999, (lifecycleCounts[code] || 0) + 1);
  try { sessionStorage.setItem("alter-runtime-events", JSON.stringify(lifecycleCounts)); }
  catch { /* Diagnostics are optional in private browsing. */ }
}

function setRuntimeStatus(message) {
  runtimeNote.textContent = message;
}

function resetAppearance() {
  displaySmooth = createDisplaySmoother();
  paperMatch = createPaperMatch();
  applyPaperStyle(null);
  clearOverlayMask();
}

function interruptTracking(t) {
  machine = updateAlterState(machine, { type: "interrupt", t });
  tracker = createObservationTracker();
  resetAppearance();
  hideOverlay();
  lastSampleAt = 0;
}

function geometryKey(geometry) {
  return [geometry.sourceX, geometry.sourceY, geometry.sourceWidth, geometry.sourceHeight,
    geometry.sampleWidth, geometry.sampleHeight, geometry.viewWidth, geometry.viewHeight].join(":");
}

function resetGeometry(nextGeometry) {
  // A changed crop invalidates both the old projection and its calibration.
  machine = updateAlterState(machine, { type: "reset" });
  tracker = createObservationTracker();
  calibrator = createBackgroundCalibrator();
  sampleGeometry = nextGeometry;
  lastSampleAt = 0;
  resetAppearance();
  hideOverlay();
  setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
}

function shouldShowGestureGuide() {
  try { return localStorage.getItem(gestureGuideKey) !== "seen"; }
  catch { return true; }
}

function closeGestureGuide(remember = true) {
  gestureGuide.hidden = true;
  if (!remember) return;
  try { localStorage.setItem(gestureGuideKey, "seen"); }
  catch { /* The guide may reappear when storage is unavailable. */ }
}

function showGestureGuide() {
  if (!shouldShowGestureGuide()) return;
  gestureGuide.hidden = false;
  $("close-gesture-guide").focus();
}

function readSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("alter-settings") || "{}");
    if ([...rank.options].some((option) => option.value === saved.rank)) rank.value = saved.rank;
    if (suits[saved.suit]) suit.value = saved.suit;
    if (Number.isFinite(saved.brightness)) {
      brightness.value = String(Math.max(75, Math.min(125, saved.brightness)));
    }
  } catch {
    // Storage is optional; private browsing may block it.
  }
}

function saveSettings() {
  try {
    localStorage.setItem("alter-settings", JSON.stringify({
      rank: rank.value, suit: suit.value, brightness: Number(brightness.value),
    }));
  } catch {
    // The effect continues without persistence.
  }
}

function renderCard() {
  const chosen = suits[suit.value] || suits.spade;
  overlay.classList.toggle("red", chosen.red);
  overlay.querySelectorAll(".rank").forEach((element) => { element.textContent = rank.value; });
  overlay.querySelectorAll(".suit").forEach((element) => { element.textContent = chosen.symbol; });
  const value = Number(brightness.value) / 100;
  stage.style.setProperty("--camera-brightness", String(value));
  saveSettings();
}

function stateLabel() {
  switch (machine.state) {
    case AlterState.IDLE: return "카드를 기다리는 중";
    case AlterState.CARD_DETECTED: return "카드 윤곽 확인 중";
    case AlterState.ALTER_VISIBLE: return "카메라 속 카드 표시 중";
    case AlterState.CARD_FULLY_OUT: return "카드 재진입 대기 중";
    case AlterState.REAL_CARD: return "실제 카드 공개 중";
    case AlterState.DONE: return "공연 완료";
    default: return "";
  }
}

function updateStateNote() {
  stateNote.textContent = stream ? stateLabel() : "카메라 시작 전";
}

let wakeLock = null;
let wakeLockPending = false;

function performanceWakeWanted() {
  return Boolean(stream) && settings.hidden;
}

async function acquireWakeLock() {
  if (
    !performanceWakeWanted() ||
    !("wakeLock" in navigator) ||
    document.visibilityState !== "visible" ||
    wakeLock !== null ||
    wakeLockPending
  ) {
    return;
  }

  wakeLockPending = true;
  try {
    const lock = await navigator.wakeLock.request("screen");

    if (!performanceWakeWanted() || document.visibilityState !== "visible") {
      await lock.release();
      return;
    }

    wakeLock = lock;
    lock.addEventListener("release", () => {
      if (wakeLock === lock) wakeLock = null;
      if (document.visibilityState === "visible") acquireWakeLock();
    }, { once: true });
  } catch {
    wakeLock = null;
  } finally {
    wakeLockPending = false;
  }
}

async function releaseWakeLock() {
  const lock = wakeLock;
  wakeLock = null;
  if (lock === null) return;

  try {
    await lock.release();
  } catch {
    // Wake Lock API is optional; release failures need no UI.
  }
}

function syncPerformanceWakeLock() {
  if (performanceWakeWanted()) acquireWakeLock();
  else releaseWakeLock();
}

function openSettings() {
  if (!settings.hidden) return;
  if (!gestureGuide.hidden) closeGestureGuide();
  if (stream) {
    machine = updateAlterState(machine, { type: "interrupt", t: performance.now() });
    tracker = createObservationTracker();
    resetAppearance();
    overlay.hidden = true;
  }
  settings.classList.toggle("is-running", Boolean(stream));
  updateStateNote();
  settings.hidden = false;
  $("close-settings").focus();
  syncPerformanceWakeLock();
}

function closeSettings() {
  settings.hidden = true;
  lastSampleAt = 0;
  tracker = createObservationTracker();
  resetAppearance();
  syncPerformanceWakeLock();
}

function applyPaperStyle(color) {
  const style = overlay.style;
  if (!style || typeof style.setProperty !== "function") return;
  if (!color) {
    if (typeof style.removeProperty === "function") style.removeProperty("--card-paper");
    return;
  }
  style.setProperty("--card-paper", `rgb(${color.r}, ${color.g}, ${color.b})`);
}

function clearOverlayMask() {
  occlusionSlot = { quadKey: "", mask: null };
  overlay.style.maskImage = "none";
  overlay.style.webkitMaskImage = "none";
}

function quadKey(corners) {
  if (!corners) return "";
  return corners.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(";");
}

function showOverlay(displayCorners, mask, geometry) {
  const mapped = displayCorners.map((point) => samplePointToView(point, geometry));
  const h = mapSourceOntoCorners(240, 336, mapped);
  if (!h) {
    overlay.hidden = true;
    clearOverlayMask();
    return false;
  }
  overlay.style.transform = `matrix3d(${[
    h[0], h[3], 0, h[6],
    h[1], h[4], 0, h[7],
    0, 0, 1, 0,
    h[2], h[5], 0, h[8],
  ].join(",")})`;
  // A missing mask must not fall back to a solid card or a previous quad's bitmap.
  if (!mask || !occlusionContext) {
    overlay.hidden = true;
    clearOverlayMask();
    return false;
  }
  occlusionCanvas.width = mask.width;
  occlusionCanvas.height = mask.height;
  const image = occlusionContext.createImageData(mask.width, mask.height);
  image.data.set(mask.data);
  occlusionContext.putImageData(image, 0, 0);
  const url = `url("${occlusionCanvas.toDataURL("image/png")}")`;
  overlay.style.maskImage = url;
  overlay.style.webkitMaskImage = url;
  overlay.style.maskSize = overlay.style.webkitMaskSize = "100% 100%";
  overlay.style.maskRepeat = overlay.style.webkitMaskRepeat = "no-repeat";
  overlay.hidden = false;
  return true;
}

function hideOverlay() {
  overlay.hidden = true;
  clearOverlayMask();
}

function isPortrait(corners) {
  const top = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const side = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
  return side > top * 1.05;
}

function processFrame(t) {
  if (!stream) return;
  animation = requestAnimationFrame(processFrame);
  if (document.hidden || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      interruptTracking(t);
      setRuntimeStatus("카메라 영상을 기다리는 중");
    }
    return;
  }
  if (t - lastSampleAt < sampleIntervalMs) return;
  lastSampleAt = t;
  const analysisStarted = performance.now();
  try {
    const geometry = coverGeometry(
      video.videoWidth, video.videoHeight, stage.clientWidth, stage.clientHeight,
    );
    if (!geometry) {
      interruptTracking(t);
      setRuntimeStatus("카메라 화면 크기를 확인하는 중");
      return;
    }
    const nextGeometry = geometryKey(geometry);
    if (sampleGeometry !== nextGeometry) {
      resetGeometry(nextGeometry);
    }
    const width = geometry.sampleWidth;
    const height = geometry.sampleHeight;
    if (sample.width !== width || sample.height !== height) {
      sample.width = width;
      sample.height = height;
    }
    sampleContext.drawImage(
      video,
      geometry.sourceX, geometry.sourceY, geometry.sourceWidth, geometry.sourceHeight,
      0, 0, width, height,
    );
    const pixels = sampleContext.getImageData(0, 0, width, height);
    let candidate;
    if (calibrator.reference) {
      candidate = detectCardAgainstBackground(pixels, calibrator.reference);
      if (!candidate || !isPortrait(candidate.corners)) candidate = detectCard(pixels);
    } else {
      candidate = detectCard(pixels);
      if (machine.state === AlterState.IDLE) {
        observeCalibration(calibrator, pixels, t,
          Boolean(candidate && isPortrait(candidate.corners)));
      }
    }
    if (claimCalibrationReady(calibrator)) setRuntimeStatus("준비 완료");
    if (!settings.hidden) return;
    const detection = candidate && isPortrait(candidate.corners) ? candidate : null;
    const result = trackObservation(tracker, detection, t, width, height);
    tracker = result.tracker;
    machine = updateAlterState(machine, { type: "observe", ...result.observation });
    updateStateNote();

    // Smoothing affects only the displayed quad. Exit and stability stay on the raw tracker.
    // The occlusion mask is sampled on the raw quad, then remapped into the displayed plane.
    const heldCorners = overlayCorners(tracker, detection, t);
    let displayCorners = null;
    if (detection?.corners) {
      const smoothed = smoothDisplayedCorners(displaySmooth, detection.corners, t);
      displaySmooth = smoothed.state;
      displayCorners = smoothed.corners;
    } else if (heldCorners) {
      displayCorners = displaySmooth.corners || heldCorners;
    } else {
      displaySmooth = createDisplaySmoother();
    }
    if (machine.state === AlterState.ALTER_VISIBLE && displayCorners) {
      const maskCorners = detection?.corners || heldCorners;
      let mask = null;
      if (maskCorners) {
        mask = cardOcclusionMask(pixels, maskCorners, calibrator.reference);
        if (detection?.corners) {
          const matched = updatePaperMatch(paperMatch, sampleCardPaper(pixels, detection.corners, mask), t);
          paperMatch = matched.state;
          applyPaperStyle(matched.color);
        }
      }
      occlusionSlot = resolveOverlayMask(occlusionSlot, quadKey(maskCorners), mask);
      const displayMask = occlusionSlot.mask
        ? remapOcclusionToDisplay(occlusionSlot.mask, maskCorners, displayCorners)
        : null;
      showOverlay(displayCorners, displayMask, geometry);
    } else hideOverlay();
  } catch {
    machine = updateAlterState(machine, { type: "interrupt", t });
    tracker = createObservationTracker();
    resetAppearance();
    hideOverlay();
    recordLifecycle("analysis-error");
    setRuntimeStatus("카드 분석을 다시 시도하는 중");
  } finally {
    const elapsed = performance.now() - analysisStarted;
    sampleIntervalMs = Math.max(60, Math.min(120, elapsed * 1.5));
  }
}

function stopCamera(showSetup = true) {
  closeGestureGuide(false);
  if (animation) cancelAnimationFrame(animation);
  animation = 0;
  const previousStream = stream;
  stream = null;
  cameraEnded = false;
  if (previousStream) previousStream.getTracks().forEach((track) => track.stop());
  recordLifecycle("user-stop");
  video.srcObject = null;
  hideOverlay();
  machine = createAlterState({ exitDelayMs: 0 });
  tracker = createObservationTracker();
  calibrator = createBackgroundCalibrator();
  sampleGeometry = null;
  resetAppearance();
  setRuntimeStatus("카메라 시작 전");
  settings.hidden = true;
  stage.hidden = true;
  if (showSetup) setup.hidden = false;
  updateStateNote();
  syncPerformanceWakeLock();
}

// Prefer the front camera without requiring facingMode. Many desktop webcams omit
// that metadata and reject exact:user. The <video> stage is not CSS-mirrored;
// analysis samples the same unmirrored buffer, so neither path may flip alone.
const USER_CAMERA = { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } };
const GENERIC_CAMERA = { width: { ideal: 1280 }, height: { ideal: 720 } };

function cameraConstraintMiss(error) {
  return error?.name === "OverconstrainedError" || error?.name === "NotFoundError";
}

async function requestCameraStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: USER_CAMERA });
  } catch (error) {
    // Permission denial must not be asked again. Only a missing or overconstrained
    // camera may try one generic device.
    if (error?.name === "NotAllowedError" || !cameraConstraintMiss(error)) throw error;
    return navigator.mediaDevices.getUserMedia({ audio: false, video: GENERIC_CAMERA });
  }
}

function cameraStartMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "카메라 권한이 거부됐습니다. 브라우저 설정에서 권한을 허용한 뒤 다시 시작해 주세요.";
  }
  if (cameraConstraintMiss(error)) {
    return "사용할 수 있는 카메라가 없습니다. 카메라 연결 상태를 확인해 주세요.";
  }
  return error?.message || "카메라를 열 수 없습니다. 다른 앱의 카메라 사용을 종료한 뒤 다시 시도해 주세요.";
}

async function startCamera() {
  if (stream) return;
  const button = $("start");
  const message = $("setup-message");
  button.disabled = true;
  message.textContent = "카메라를 여는 중…";
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("HTTPS 또는 localhost에서 열어야 카메라를 사용할 수 있습니다.");
    }
    if (!sampleContext) throw new Error("이 브라우저는 영상 분석을 지원하지 않습니다.");
    stream = await requestCameraStream();
    cameraEnded = false;
    video.srcObject = stream;
    await video.play();
    const activeStream = stream;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (stream !== activeStream) return;
        cameraEnded = true;
        recordLifecycle("track-ended");
        interruptTracking(performance.now());
        setRuntimeStatus("카메라 연결이 끊겼습니다. 설정에서 종료한 뒤 다시 시작해 주세요.");
        if (animation) cancelAnimationFrame(animation);
        animation = 0;
      }, { once: true });
    });
    recordLifecycle("camera-start");
    machine = createAlterState({ exitDelayMs: 0 });
    tracker = createObservationTracker();
    calibrator = createBackgroundCalibrator();
    resetAppearance();
    lastSampleAt = 0;
    setup.hidden = true;
    stage.hidden = false;
    settings.hidden = true;
    setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
    animation = requestAnimationFrame(processFrame);
    closeGestureGuide(false);
    message.textContent = "시작을 누르면 브라우저가 카메라 사용 권한을 묻습니다. 허용을 선택해 주세요. 영상은 기기 밖으로 전송하거나 저장하지 않습니다.";
    syncPerformanceWakeLock();
  } catch (error) {
    if (stream) stopCamera();
    else {
      video.srcObject = null;
      stage.hidden = true;
      setup.hidden = false;
    }
    message.textContent = cameraStartMessage(error);
  } finally {
    button.disabled = false;
  }
}

$("start").addEventListener("click", startCamera);
$("close-gesture-guide").addEventListener("click", () => closeGestureGuide());
$("setup-settings").addEventListener("click", openSettings);
$("close-settings").addEventListener("click", closeSettings);
$("reveal").addEventListener("click", () => {
  machine = updateAlterState(machine, { type: "reveal", t: performance.now() });
  resetAppearance();
  hideOverlay();
  closeSettings();
});
$("reset").addEventListener("click", () => {
  machine = updateAlterState(machine, { type: "reset" });
  tracker = createObservationTracker();
  calibrator = createBackgroundCalibrator();
  resetAppearance();
  setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
  hideOverlay();
  closeSettings();
});
$("stop").addEventListener("click", () => stopCamera());
for (const control of [rank, suit, brightness]) {
  control.addEventListener("change", () => {
    renderCard();
    machine = updateAlterState(machine, { type: "reset" });
    tracker = createObservationTracker();
    calibrator = createBackgroundCalibrator();
    resetAppearance();
    setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
    hideOverlay();
    updateStateNote();
  });
}
function settingsContacts(list) {
  return Array.from(list || [], (touch) => ({ id: touch.identifier, x: touch.clientX, y: touch.clientY }));
}
// Origins are the positions at the moment the pair forms, in viewport coordinates.
function settingsPairReady(origins, contacts) {
  return origins.every((origin) => {
    const end = contacts.find((point) => point.id === origin.id);
    if (!end) return false;
    const dx = end.x - origin.x;
    const dy = end.y - origin.y;
    return dy >= 96 && dy > Math.abs(dx) * 1.5;
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
function suspendAnalysis(code) {
  if (!stream) return;
  recordLifecycle(code);
  interruptTracking(performance.now());
  if (animation) cancelAnimationFrame(animation);
  animation = 0;
}
function resumeAnalysis() {
  if (!stream || cameraEnded || document.hidden || animation) return;
  recordLifecycle("visible-resume");
  interruptTracking(performance.now());
  animation = requestAnimationFrame(processFrame);
}
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
