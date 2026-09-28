/** Observations for a card moving toward, then out of, the camera frame. */

const MAX_SAMPLE_GAP_MS = 1000;
const MAX_EXIT_SAMPLE_GAP_MS = 260;
const EXIT_ABSENCE_MS = 350;
const OVERLAY_HOLD_MS = 250;

/** The live camera remains visible during every effect state and recovery path. */
export function cameraShouldBeMasked() {
  return false;
}

export function createObservationTracker() {
  return {
    corners: null,
    seenAt: null,
    stableCount: 0,
    edge: null,
    edgeDistance: null,
    exitOriginDistance: null,
    outwardSteps: 0,
    exitArmed: false,
  };
}

/** Bridge a short missed detection, then clear stale projection geometry. */
export function overlayCorners(tracker, detection, t) {
  if (detection) return detection.corners;
  if (tracker.corners && tracker.seenAt != null &&
      Number.isFinite(t) && t - tracker.seenAt >= 0 && t - tracker.seenAt <= OVERLAY_HOLD_MS) {
    return tracker.corners;
  }
  return null;
}

function edgeDistances(corners, width, height) {
  return [
    Math.min(...corners.map((point) => point.x)),
    Math.min(...corners.map((point) => width - point.x)),
    Math.min(...corners.map((point) => point.y)),
    Math.min(...corners.map((point) => height - point.y)),
  ];
}

function closeQuads(first, second, width, height) {
  const limit = Math.max(18, Math.hypot(width, height) * 0.085);
  return first.every((point, index) =>
    Math.hypot(point.x - second[index].x, point.y - second[index].y) <= limit,
  );
}

/**
 * A full exit needs repeated outward travel close to an edge, then absence.
 * This remains a visual heuristic: a hand can mimic an exit. The presentation
 * keeps the effect state during absence without hiding the camera background.
 */
export function trackObservation(tracker, detection, t, width, height) {
  if (!Number.isFinite(t) || width <= 0 || height <= 0) {
    throw new TypeError("invalid frame geometry or timestamp");
  }
  if (!detection) {
    return {
      tracker,
      observation: {
        t,
        seen: false,
        stableCorners: false,
        fullFrameExit: tracker.exitArmed && tracker.seenAt != null &&
          t - tracker.seenAt >= EXIT_ABSENCE_MS,
      },
    };
  }

  const corners = detection.corners;
  const continuous = tracker.corners != null && tracker.seenAt != null &&
    t - tracker.seenAt <= MAX_SAMPLE_GAP_MS &&
    closeQuads(tracker.corners, corners, width, height);
  const exitContinuous = continuous && t - tracker.seenAt <= MAX_EXIT_SAMPLE_GAP_MS;
  const distances = edgeDistances(corners, width, height);
  const edgeDistance = Math.min(...distances);
  const edge = distances.indexOf(edgeDistance);
  const outward = exitContinuous && tracker.edge === edge &&
    tracker.edgeDistance != null &&
    tracker.edgeDistance - edgeDistance >= 3;
  const returning = exitContinuous && tracker.edge === edge &&
    tracker.edgeDistance != null && edgeDistance - tracker.edgeDistance >= 3;
  const exitOriginDistance = outward
    ? (tracker.outwardSteps ? tracker.exitOriginDistance : tracker.edgeDistance)
    : (exitContinuous && !returning && tracker.edge === edge ? tracker.exitOriginDistance : null);
  const outwardSteps = outward ? tracker.outwardSteps + 1
    : (exitContinuous && !returning && tracker.edge === edge ? tracker.outwardSteps : 0);
  const nearBoundary = edgeDistance <= Math.max(12, Math.min(width, height) * 0.035);
  const traveledFarEnough = exitOriginDistance != null &&
    exitOriginDistance - edgeDistance >= Math.max(14, Math.min(width, height) * 0.05);
  const exitArmed = nearBoundary && outwardSteps >= 2 && traveledFarEnough &&
    (outward || (exitContinuous && tracker.exitArmed && !returning));
  const next = {
    corners,
    seenAt: t,
    stableCount: continuous ? Math.min(3, tracker.stableCount + 1) : 1,
    edge,
    edgeDistance,
    exitOriginDistance,
    outwardSteps,
    exitArmed,
  };
  return {
    tracker: next,
    observation: {
      t,
      seen: true,
      stableCorners: next.stableCount >= 2,
      fullFrameExit: false,
    },
  };
}
