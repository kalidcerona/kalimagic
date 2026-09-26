/** Observations for a card moving toward, then out of, the camera frame. */
import { AlterState } from "./logic.js";

const MAX_SAMPLE_GAP_MS = 260;
const EXIT_ABSENCE_MS = 350;

/** Show live video only with a valid B cover or after the deliberate A reveal. */
export function cameraShouldBeMasked(state, overlayShown) {
  if (state === AlterState.REAL_CARD || state === AlterState.DONE) return false;
  return state !== AlterState.ALTER_VISIBLE || !overlayShown;
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
 * keeps the camera masked during absence until a stable reentry or manual reveal.
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
  const distances = edgeDistances(corners, width, height);
  const edgeDistance = Math.min(...distances);
  const edge = distances.indexOf(edgeDistance);
  const outward = continuous && tracker.edge === edge &&
    tracker.edgeDistance != null &&
    tracker.edgeDistance - edgeDistance >= 3;
  const returning = continuous && tracker.edge === edge &&
    tracker.edgeDistance != null && edgeDistance - tracker.edgeDistance >= 3;
  const exitOriginDistance = outward
    ? (tracker.outwardSteps ? tracker.exitOriginDistance : tracker.edgeDistance)
    : (continuous && !returning && tracker.edge === edge ? tracker.exitOriginDistance : null);
  const outwardSteps = outward ? tracker.outwardSteps + 1
    : (continuous && !returning && tracker.edge === edge ? tracker.outwardSteps : 0);
  const nearBoundary = edgeDistance <= Math.max(12, Math.min(width, height) * 0.035);
  const traveledFarEnough = exitOriginDistance != null &&
    exitOriginDistance - edgeDistance >= Math.max(14, Math.min(width, height) * 0.05);
  const exitArmed = nearBoundary && outwardSteps >= 2 && traveledFarEnough &&
    (outward || (continuous && tracker.exitArmed && !returning));
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
