import { createAlterState } from "./logic.js";
import { createObservationTracker } from "./performance.js";
import { createBackgroundCalibrator } from "./calibration.js";
import { cameraStartMessage, requestCameraStream } from "./camera-stream.js";
import { $, setup, stage, video, settings, sampleContext } from "./dom.js";
import {
  stream, cameraEnded, animation,
  setMachine, setTracker, setStream, setCameraEnded, setAnimation, setLastSampleAt, setCalibrator, setSampleGeometry,
} from "./state.js";
import { recordLifecycle, setRuntimeStatus } from "./status.js";
import { updateStateNote } from "./card-view.js";
import { closeGestureGuide } from "./settings-store.js";
import { hideOverlay } from "./overlay.js";
import { interruptTracking, resetAppearance } from "./tracking-reset.js";
import { syncPerformanceWakeLock } from "./wake-lock.js";
import { processFrame } from "./frame.js";

function stopCamera(showSetup = true) {
  closeGestureGuide(false);
  if (animation) cancelAnimationFrame(animation);
  setAnimation(0);
  const previousStream = stream;
  setStream(null);
  setCameraEnded(false);
  if (previousStream) previousStream.getTracks().forEach((track) => track.stop());
  recordLifecycle("user-stop");
  video.srcObject = null;
  hideOverlay();
  setMachine(createAlterState({ exitDelayMs: 0 }));
  setTracker(createObservationTracker());
  setCalibrator(createBackgroundCalibrator());
  setSampleGeometry(null);
  resetAppearance();
  setRuntimeStatus("카메라 시작 전");
  settings.hidden = true;
  window.MagicUpdate?.hide();
  stage.hidden = true;
  if (showSetup) setup.hidden = false;
  updateStateNote();
  syncPerformanceWakeLock();
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
    setStream(await requestCameraStream());
    setCameraEnded(false);
    video.srcObject = stream;
    await video.play();
    const activeStream = stream;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (stream !== activeStream) return;
        setCameraEnded(true);
        recordLifecycle("track-ended");
        interruptTracking(performance.now());
        setRuntimeStatus("카메라 연결이 끊겼습니다. 설정에서 종료한 뒤 다시 시작해 주세요.");
        if (animation) cancelAnimationFrame(animation);
        setAnimation(0);
      }, { once: true });
    });
    recordLifecycle("camera-start");
    setMachine(createAlterState({ exitDelayMs: 0 }));
    setTracker(createObservationTracker());
    setCalibrator(createBackgroundCalibrator());
    resetAppearance();
    setLastSampleAt(0);
    setup.hidden = true;
    stage.hidden = false;
    settings.hidden = true;
    window.MagicUpdate?.hide();
    setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
    setAnimation(requestAnimationFrame(processFrame));
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
function suspendAnalysis(code) {
  if (!stream) return;
  recordLifecycle(code);
  interruptTracking(performance.now());
  if (animation) cancelAnimationFrame(animation);
  setAnimation(0);
}
function resumeAnalysis() {
  if (!stream || cameraEnded || document.hidden || animation) return;
  recordLifecycle("visible-resume");
  interruptTracking(performance.now());
  setAnimation(requestAnimationFrame(processFrame));
}

export { stopCamera, startCamera, suspendAnalysis, resumeAnalysis };
