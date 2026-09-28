import { AlterState, createAlterState, updateAlterState } from "./logic.js";
import { cardOcclusionMask, detectCard, detectCardAgainstBackground, mapSourceOntoCorners } from "./vision.js";
import { createObservationTracker, overlayCorners, trackObservation } from "./performance.js";
import { coverGeometry, samplePointToView } from "./camera-geometry.js";
import { claimCalibrationReady, createBackgroundCalibrator, observeCalibration } from "./calibration.js";

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
let touchStart = null;
let sampleIntervalMs = 60;
let sampleGeometry = null;
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

function interruptTracking(t) {
  machine = updateAlterState(machine, { type: "interrupt", t });
  tracker = createObservationTracker();
  hideOverlay();
  lastSampleAt = 0;
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

function openSettings() {
  if (!settings.hidden) return;
  if (!gestureGuide.hidden) closeGestureGuide();
  if (stream) {
    machine = updateAlterState(machine, { type: "interrupt", t: performance.now() });
    tracker = createObservationTracker();
    overlay.hidden = true;
  }
  settings.classList.toggle("is-running", Boolean(stream));
  updateStateNote();
  settings.hidden = false;
  $("close-settings").focus();
}

function closeSettings() {
  settings.hidden = true;
  lastSampleAt = 0;
  tracker = createObservationTracker();
}

function showOverlay(corners, geometry, frame, reference) {
  const mapped = corners.map((point) => samplePointToView(point, geometry));
  const h = mapSourceOntoCorners(240, 336, mapped);
  if (!h) {
    overlay.hidden = true;
    return false;
  }
  overlay.style.transform = `matrix3d(${[
    h[0], h[3], 0, h[6],
    h[1], h[4], 0, h[7],
    0, 0, 1, 0,
    h[2], h[5], 0, h[8],
  ].join(",")})`;
  const mask = frame && cardOcclusionMask(frame, corners, reference);
  if (mask && occlusionContext) {
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
  }
  overlay.hidden = false;
  return true;
}

function hideOverlay() {
  overlay.hidden = true;
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
    const geometryKey = `${geometry.sampleWidth}:${geometry.sampleHeight}:${stage.clientWidth}:${stage.clientHeight}`;
    if (sampleGeometry !== geometryKey) {
      interruptTracking(t);
      calibrator = createBackgroundCalibrator();
      sampleGeometry = geometryKey;
      setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
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

    const visibleCorners = overlayCorners(tracker, detection, t);
    if (machine.state === AlterState.ALTER_VISIBLE && visibleCorners) {
      showOverlay(visibleCorners, geometry, pixels, calibrator.reference);
    } else hideOverlay();
  } catch {
    machine = updateAlterState(machine, { type: "interrupt", t });
    tracker = createObservationTracker();
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
  setRuntimeStatus("카메라 시작 전");
  settings.hidden = true;
  stage.hidden = true;
  if (showSetup) setup.hidden = false;
  updateStateNote();
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
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { exact: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
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
    lastSampleAt = 0;
    setup.hidden = true;
    stage.hidden = false;
    settings.hidden = true;
    setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
    animation = requestAnimationFrame(processFrame);
    closeGestureGuide(false);
    message.textContent = "시작을 누르면 브라우저가 카메라 사용 권한을 묻습니다. 허용을 선택해 주세요. 영상은 기기 밖으로 전송하거나 저장하지 않습니다.";
  } catch (error) {
    stopCamera();
    message.textContent = error.name === "NotAllowedError"
      ? "카메라 권한이 거부됐습니다. 브라우저 설정에서 권한을 허용한 뒤 다시 시작해 주세요."
      : error.name === "OverconstrainedError" || error.name === "NotFoundError"
        ? "전면 카메라를 찾을 수 없습니다. 기기의 카메라 상태를 확인해 주세요."
        : error.message || "카메라를 열 수 없습니다. 다른 앱의 카메라 사용을 종료한 뒤 다시 시도해 주세요.";
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
  hideOverlay();
  closeSettings();
});
$("reset").addEventListener("click", () => {
  machine = updateAlterState(machine, { type: "reset" });
  tracker = createObservationTracker();
  calibrator = createBackgroundCalibrator();
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
    setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
    hideOverlay();
    updateStateNote();
  });
}
stage.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 2) { touchStart = null; return; }
  touchStart = (event.touches[0].clientY + event.touches[1].clientY) / 2;
}, { passive: true });
stage.addEventListener("touchmove", (event) => {
  if (touchStart == null || event.touches.length !== 2) return;
  const y = (event.touches[0].clientY + event.touches[1].clientY) / 2;
  if (y - touchStart >= 55) {
    touchStart = null;
    event.preventDefault();
    openSettings();
  }
}, { passive: false });
stage.addEventListener("touchend", (event) => {
  if (event.touches.length < 2) touchStart = null;
}, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "s" && stream && settings.hidden) openSettings();
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
  if (document.hidden) suspendAnalysis("visibility-hidden");
  else resumeAnalysis();
});
window.addEventListener("pagehide", () => suspendAnalysis("page-hidden"));
window.addEventListener("pageshow", resumeAnalysis);
window.addEventListener("resize", () => {
  if (!stream) return;
  machine = updateAlterState(machine, { type: "interrupt", t: performance.now() });
  tracker = createObservationTracker();
  calibrator = createBackgroundCalibrator();
  sampleGeometry = null;
  lastSampleAt = 0;
  recordLifecycle("resize");
  setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
  hideOverlay();
});

showGestureGuide();
readSavedSettings();
renderCard();
updateStateNote();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
