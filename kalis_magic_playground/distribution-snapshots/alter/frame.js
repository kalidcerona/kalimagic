import { AlterState, updateAlterState } from "./logic.js";
import { cardOcclusionMask, detectCard, detectCardAgainstBackground, heldCardPresent } from "./vision.js";
import { bleedCorners, createDisplaySmoother, createObservationTracker, overlayCorners, smoothDisplayedCorners, trackObservation } from "./performance.js";
import { coverGeometry } from "./camera-geometry.js";
import { claimCalibrationReady, observeCalibration } from "./calibration.js";
import { remapOcclusionToDisplay, resolveOverlayMask, sampleCardPaper, updatePaperMatch } from "./appearance.js";
import { stage, video, settings, sample, sampleContext } from "./dom.js";
import {
  machine, tracker, stream, calibrator, sampleGeometry, displaySmooth, paperMatch, occlusionSlot, lastSampleAt,
  setMachine, setTracker, setAnimation, setLastSampleAt, setDisplaySmooth, setPaperMatch, setOcclusionSlot,
} from "./state.js";
import { recordLifecycle, setRuntimeStatus } from "./status.js";
import { updateStateNote } from "./card-view.js";
import { HELD_OPAQUE, applyPaperStyle, hideOverlay, isPortrait, quadKey, showOverlay } from "./overlay.js";
import { geometryKey, interruptTracking, resetAppearance, resetGeometry } from "./tracking-reset.js";

let sampleIntervalMs = 60;

function processFrame(t) {
  if (!stream) return;
  setAnimation(requestAnimationFrame(processFrame));
  if (document.hidden || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      interruptTracking(t);
      setRuntimeStatus("카메라 영상을 기다리는 중");
    }
    return;
  }
  if (t - lastSampleAt < sampleIntervalMs) return;
  setLastSampleAt(t);
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
      // The previous quad, while the card was last seen, lets detection split a backlit
      // card from the hand it sits on once brightness no longer does.
      const hint = tracker.corners && tracker.seenAt != null && t - tracker.seenAt <= 1000
        ? tracker.corners : null;
      candidate = detectCardAgainstBackground(pixels, calibrator.reference, hint);
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
    setTracker(result.tracker);
    setMachine(updateAlterState(machine, { type: "observe", ...result.observation }));
    updateStateNote();

    // Smoothing affects only the displayed quad. Exit and stability stay on the raw tracker.
    // The occlusion mask is sampled on the raw quad, then remapped into the displayed plane.
    const heldCorners = overlayCorners(tracker, detection, t);
    let displayCorners = null;
    if (detection?.corners) {
      const smoothed = smoothDisplayedCorners(displaySmooth, detection.corners, t);
      setDisplaySmooth(smoothed.state);
      displayCorners = smoothed.corners;
    } else if (heldCorners) {
      displayCorners = displaySmooth.corners || heldCorners;
    } else {
      setDisplaySmooth(createDisplaySmoother());
    }
    if (machine.state === AlterState.ALTER_VISIBLE && displayCorners) {
      // The replacement is drawn a little larger than the fitted quad so a quad a pixel
      // or two inside the real edge cannot leave the real card's rim showing.
      const drawCorners = bleedCorners(displayCorners) || displayCorners;
      if (detection?.corners) {
        const mask = cardOcclusionMask(pixels, detection.corners, calibrator.reference);
        const matched = updatePaperMatch(paperMatch, sampleCardPaper(pixels, detection.corners, mask), t);
        setPaperMatch(matched.state);
        applyPaperStyle(matched.color);
        setOcclusionSlot(resolveOverlayMask(occlusionSlot, quadKey(detection.corners), mask));
        const displayMask = occlusionSlot.mask
          ? remapOcclusionToDisplay(occlusionSlot.mask, detection.corners, drawCorners, { extend: true })
          : null;
        showOverlay(drawCorners, displayMask, geometry);
      } else {
        setOcclusionSlot({ quadKey: "", mask: null });
        // The hold bridges a missed detection, not a card that has left. Draw the old quad
        // only while something card-like (not just a hand or the empty wall) is still in it.
        const paper = paperMatch.color;
        const learned = paper && !(paper.r === 251 && paper.g === 249 && paper.b === 243) ? [paper.r, paper.g, paper.b] : null;
        if (heldCorners && heldCardPresent(pixels, heldCorners, calibrator.reference, learned)) {
          showOverlay(drawCorners, HELD_OPAQUE, geometry);
        } else hideOverlay();
      }
    } else hideOverlay();
  } catch {
    setMachine(updateAlterState(machine, { type: "interrupt", t }));
    setTracker(createObservationTracker());
    resetAppearance();
    hideOverlay();
    recordLifecycle("analysis-error");
    setRuntimeStatus("카드 분석을 다시 시도하는 중");
  } finally {
    const elapsed = performance.now() - analysisStarted;
    sampleIntervalMs = Math.max(60, Math.min(120, elapsed * 1.5));
  }
}

export { processFrame };
