// Camera stream request and start-error messages. Moved verbatim from app.js.

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

export { cameraStartMessage, requestCameraStream };
