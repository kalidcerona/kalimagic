import { updateAlterState } from "./logic.js";
import { createDisplaySmoother, createObservationTracker } from "./performance.js";
import { createBackgroundCalibrator } from "./calibration.js";
import { createPaperMatch } from "./appearance.js";
import { machine, setMachine, setTracker, setLastSampleAt, setCalibrator, setSampleGeometry, setDisplaySmooth, setPaperMatch } from "./state.js";
import { setRuntimeStatus } from "./status.js";
import { applyPaperStyle, clearOverlayMask, hideOverlay } from "./overlay.js";

function resetAppearance() {
  setDisplaySmooth(createDisplaySmoother());
  setPaperMatch(createPaperMatch());
  applyPaperStyle(null);
  clearOverlayMask();
}

function interruptTracking(t) {
  setMachine(updateAlterState(machine, { type: "interrupt", t }));
  setTracker(createObservationTracker());
  resetAppearance();
  hideOverlay();
  setLastSampleAt(0);
}

function geometryKey(geometry) {
  return [geometry.sourceX, geometry.sourceY, geometry.sourceWidth, geometry.sourceHeight,
    geometry.sampleWidth, geometry.sampleHeight, geometry.viewWidth, geometry.viewHeight].join(":");
}

function resetGeometry(nextGeometry) {
  // A changed crop invalidates both the old projection and its calibration.
  setMachine(updateAlterState(machine, { type: "reset" }));
  setTracker(createObservationTracker());
  setCalibrator(createBackgroundCalibrator());
  setSampleGeometry(nextGeometry);
  setLastSampleAt(0);
  resetAppearance();
  hideOverlay();
  setRuntimeStatus("카메라 준비 중 · 빈 배경을 비춰 주세요");
}

export { resetAppearance, interruptTracking, geometryKey, resetGeometry };
