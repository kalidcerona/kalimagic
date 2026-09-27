import { captureBackground, sceneChangeFraction } from "./vision.js";

const SETTLE_MS = 1800;
const MAX_CHANGED_FRACTION = 0.025;

export function createBackgroundCalibrator() {
  return { candidate: null, stableSince: null, reference: null, readyClaimed: false };
}

/** Give the UI one ready announcement for each calibration cycle. */
export function claimCalibrationReady(calibrator) {
  if (!calibrator.reference || calibrator.readyClaimed) return false;
  calibrator.readyClaimed = true;
  return true;
}

/** Arm only after a camera scene has remained still and card-free. */
export function observeCalibration(calibrator, frame, t, cardSeen = false) {
  if (calibrator.reference) return calibrator;
  if (cardSeen) {
    calibrator.candidate = null;
    calibrator.stableSince = null;
    return calibrator;
  }
  if (!calibrator.candidate || sceneChangeFraction(frame, calibrator.candidate) > MAX_CHANGED_FRACTION) {
    calibrator.candidate = captureBackground(frame);
    calibrator.stableSince = t;
    return calibrator;
  }
  if (t - calibrator.stableSince >= SETTLE_MS) {
    calibrator.reference = captureBackground(frame);
    calibrator.candidate = null;
  }
  return calibrator;
}
