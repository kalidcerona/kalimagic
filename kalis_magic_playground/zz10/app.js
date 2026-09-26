import { AlterState, createAlterState, updateAlterState } from "./logic.js";
import { detectCard, mapSourceOntoCorners } from "./vision.js";
import { cameraShouldBeMasked, createObservationTracker, trackObservation } from "./performance.js";
import { coverGeometry, samplePointToView } from "./camera-geometry.js";

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
const stageMessage = $("stage-message");
const sample = document.createElement("canvas");
const sampleContext = sample.getContext("2d", { willReadFrequently: true });
const suits = {
  spade: { symbol: "♠", red: false },
  heart: { symbol: "♥", red: true },
  club: { symbol: "♣", red: false },
  diamond: { symbol: "♦", red: true },
};

let machine = createAlterState({ exitDelayMs: 0 });
let tracker = createObservationTracker();
let stream = null;
let animation = 0;
let lastSampleAt = 0;
let touchStart = null;

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
  if (stream) {
    machine = updateAlterState(machine, { type: "interrupt", t: performance.now() });
    tracker = createObservationTracker();
    overlay.hidden = true;
    stage.classList.toggle("camera-masked", cameraShouldBeMasked(machine.state, false));
  }
  settings.classList.toggle("is-running", Boolean(stream));
  updateStateNote();
  settings.hidden = false;
  $("close-settings").focus();
}

function closeSettings() {
  settings.hidden = true;
  lastSampleAt = 0;
}

function showOverlay(corners, geometry) {
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
  if (!settings.hidden || document.hidden || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      hideOverlay();
      stage.classList.toggle("camera-masked", cameraShouldBeMasked(machine.state, false));
    }
    return;
  }
  if (t - lastSampleAt < 85) return;
  lastSampleAt = t;
  try {
    const geometry = coverGeometry(
      video.videoWidth, video.videoHeight, stage.clientWidth, stage.clientHeight,
    );
    if (!geometry) {
      hideOverlay();
      stage.classList.toggle("camera-masked", cameraShouldBeMasked(machine.state, false));
      return;
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
    const candidate = detectCard(pixels);
    const detection = candidate && isPortrait(candidate.corners) ? candidate : null;
    const result = trackObservation(tracker, detection, t, width, height);
    tracker = result.tracker;
    machine = updateAlterState(machine, { type: "observe", ...result.observation });
    updateStateNote();

    let overlayShown = false;
    if (machine.state === AlterState.ALTER_VISIBLE && detection) {
      overlayShown = showOverlay(detection.corners, geometry);
    } else hideOverlay();
    stage.classList.toggle("camera-masked", cameraShouldBeMasked(machine.state, overlayShown));
  } catch {
    machine = updateAlterState(machine, { type: "interrupt", t });
    tracker = createObservationTracker();
    hideOverlay();
    stage.classList.toggle("camera-masked", cameraShouldBeMasked(machine.state, false));
    showStageMessage("카드를 다시 비춰 주세요");
  }
}

let messageTimer = 0;
function showStageMessage(message) {
  stageMessage.textContent = message;
  stageMessage.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { stageMessage.hidden = true; }, 2200);
}

function stopCamera(showSetup = true) {
  if (animation) cancelAnimationFrame(animation);
  animation = 0;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  hideOverlay();
  stage.classList.remove("camera-masked");
  machine = createAlterState({ exitDelayMs: 0 });
  tracker = createObservationTracker();
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
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.srcObject = stream;
    await video.play();
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        stopCamera();
        message.textContent = "카메라 연결이 끊겼습니다. 다시 시작해 주세요.";
      }, { once: true });
    });
    machine = createAlterState({ exitDelayMs: 0 });
    tracker = createObservationTracker();
    lastSampleAt = 0;
    stage.classList.add("camera-masked");
    setup.hidden = true;
    stage.hidden = false;
    settings.hidden = true;
    animation = requestAnimationFrame(processFrame);
    message.textContent = "카메라 권한이 필요합니다. 영상은 기기 밖으로 전송하거나 저장하지 않습니다.";
  } catch (error) {
    stopCamera();
    message.textContent = error.name === "NotAllowedError"
      ? "카메라 권한이 거부됐습니다. 브라우저 설정에서 권한을 허용한 뒤 다시 시작해 주세요."
      : error.message || "카메라를 열 수 없습니다. 다른 앱의 카메라 사용을 종료한 뒤 다시 시도해 주세요.";
  } finally {
    button.disabled = false;
  }
}

$("start").addEventListener("click", startCamera);
$("setup-settings").addEventListener("click", openSettings);
$("close-settings").addEventListener("click", closeSettings);
$("reveal").addEventListener("click", () => {
  machine = updateAlterState(machine, { type: "reveal", t: performance.now() });
  hideOverlay();
  stage.classList.remove("camera-masked");
  closeSettings();
});
$("reset").addEventListener("click", () => {
  machine = updateAlterState(machine, { type: "reset" });
  tracker = createObservationTracker();
  hideOverlay();
  stage.classList.add("camera-masked");
  closeSettings();
});
$("stop").addEventListener("click", () => stopCamera());
for (const control of [rank, suit, brightness]) {
  control.addEventListener("change", () => {
    renderCard();
    machine = updateAlterState(machine, { type: "reset" });
    tracker = createObservationTracker();
    hideOverlay();
    stage.classList.add("camera-masked");
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
document.addEventListener("visibilitychange", () => {
  if (document.hidden && stream) stopCamera();
});
window.addEventListener("pagehide", () => {
  if (stream) stopCamera(false);
});
window.addEventListener("resize", () => {
  if (!stream) return;
  machine = updateAlterState(machine, { type: "interrupt", t: performance.now() });
  tracker = createObservationTracker();
  hideOverlay();
});

readSavedSettings();
renderCard();
updateStateNote();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
