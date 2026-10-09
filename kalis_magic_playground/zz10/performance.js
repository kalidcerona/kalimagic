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
    observedAt: null,
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

function centroid(corners) {
  return {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  };
}

function disarmExit(tracker) {
  return {
    ...tracker,
    exitArmed: false,
    outwardSteps: 0,
    exitOriginDistance: null,
  };
}

/**
 * A full exit needs repeated outward travel close to an edge, then absence.
 * This remains a visual heuristic: a hand can mimic an exit. The presentation
 * keeps the effect state during absence without hiding the camera background.
 * `observedAt` is the last accepted sample, detection or not. A duplicate or
 * backwards timestamp earns no continuity, stability, outward step, or exit.
 * Broken absence and a gap longer than a second drop exit arming. Raw corners
 * stay on this tracker; display smoothing never writes them.
 */
export function trackObservation(tracker, detection, t, width, height) {
  if (!Number.isFinite(t) || width <= 0 || height <= 0) {
    throw new TypeError("invalid frame geometry or timestamp");
  }
  if (tracker.observedAt != null && t <= tracker.observedAt) {
    // A backwards detection is ignored and must leave the prior tracker
    // object intact. A backwards or duplicate absence is a broken sequence:
    // the returned tracker can no longer complete an exit.
    if (!detection) {
      return {
        tracker: disarmExit(tracker),
        observation: { t, seen: false, stableCorners: false, fullFrameExit: false },
      };
    }
    return {
      tracker,
      observation: { t, seen: true, stableCorners: false, fullFrameExit: false },
    };
  }
  if (!detection) {
    const sinceDetection = tracker.seenAt == null ? Infinity : t - tracker.seenAt;
    const gapTooLarge = sinceDetection > MAX_SAMPLE_GAP_MS;
    const fullFrameExit = Boolean(
      tracker.exitArmed && tracker.seenAt != null &&
      sinceDetection >= EXIT_ABSENCE_MS && !gapTooLarge,
    );
    const next = gapTooLarge
      ? { ...disarmExit(tracker), observedAt: t }
      : { ...tracker, observedAt: t };
    return {
      tracker: next,
      observation: { t, seen: false, stableCorners: false, fullFrameExit },
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
  const centerShift = tracker.corners
    ? Math.hypot(centroid(corners).x - centroid(tracker.corners).x, centroid(corners).y - centroid(tracker.corners).y)
    : 0;
  // A one-corner flicker at the boundary is not outward travel.
  const outward = exitContinuous && tracker.edge === edge &&
    tracker.edgeDistance != null &&
    tracker.edgeDistance - edgeDistance >= 3 &&
    centerShift >= 2;
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
    observedAt: t,
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

const STATIONARY_RADIUS = 2.2;
const SNAP_PX = 15;
const LONG_GAP_MS = 320;
const JITTER_TAU_MS = 180;

function cloneCorners(corners) {
  return corners.map((point) => ({ x: point.x, y: point.y }));
}

function validDisplayQuad(corners) {
  return Array.isArray(corners) && corners.length === 4 && corners.every((point) =>
    point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function maxCornerDelta(first, second) {
  let max = 0;
  for (let index = 0; index < 4; index += 1) {
    max = Math.max(max, Math.hypot(first[index].x - second[index].x, first[index].y - second[index].y));
  }
  return max;
}

/** Display-only corner filter. Raw detections must not pass through this. */
export function createDisplaySmoother() {
  return { corners: null, anchor: null, raw: null, delta: null, motionSteps: 0, at: null };
}

function snapDisplay(corners, t) {
  const snapped = cloneCorners(corners);
  return {
    state: { corners: cloneCorners(snapped), anchor: cloneCorners(snapped), raw: cloneCorners(snapped), delta: null, motionSteps: 0, at: t },
    corners: snapped,
  };
}

/**
 * Reduce small alternating jitter while promptly following consistent movement.
 * The filter only affects display coordinates. Raw tracking and hand masks are
 * independent; a fresh sample after absence or a long gap always snaps.
 */
export function smoothDisplayedCorners(state, corners, t) {
  if (!validDisplayQuad(corners)) return { state: createDisplaySmoother(), corners: null };
  const previous = state?.corners;
  if (!previous || state.at == null || !Number.isFinite(t) || t < state.at) {
    if (previous && Number.isFinite(state.at) && Number.isFinite(t) && t < state.at) {
      return { state, corners: cloneCorners(previous) };
    }
    return snapDisplay(corners, t);
  }
  const dt = t - state.at;
  if (dt <= 0) return { state, corners: cloneCorners(previous) };
  const fromDisplay = maxCornerDelta(previous, corners);
  if (dt > LONG_GAP_MS || fromDisplay >= SNAP_PX) return snapDisplay(corners, t);

  const raw = state.raw || previous;
  const first = centroid(raw), next = centroid(corners);
  const delta = { x: next.x - first.x, y: next.y - first.y };
  const length = Math.hypot(delta.x, delta.y);
  const oldLength = state.delta ? Math.hypot(state.delta.x, state.delta.y) : 0;
  const direction = oldLength > 0.5 && length > 0.5
    ? (delta.x * state.delta.x + delta.y * state.delta.y) / (length * oldLength) : 0;
  const motionSteps = direction > 0.8 ? (state.motionSteps || 1) + 1 : (length > 0.5 ? 1 : 0);
  const moving = motionSteps >= 2 || fromDisplay >= 6;
  let alpha;
  if (moving) alpha = Math.max(0.8, 1 - Math.exp(-dt / 40));
  else if (direction < 0 || fromDisplay <= STATIONARY_RADIUS) alpha = 0;
  else alpha = Math.min(0.1, 1 - Math.exp(-dt / JITTER_TAU_MS));
  const followed = previous.map((point, index) => ({
    x: point.x + alpha * (corners[index].x - point.x),
    y: point.y + alpha * (corners[index].y - point.y),
  }));
  return {
    state: { corners: cloneCorners(followed), anchor: cloneCorners(followed), raw: cloneCorners(corners), delta, motionSteps, at: t },
    corners: cloneCorners(followed),
  };
}
