/**
 * Pure finite-state machine for the ALTER card effect.
 * Overlay B turns on only after a stable detection, stays through a confirmed
 * full-frame exit, and turns off on the first stable reentry.
 */

export const AlterState = Object.freeze({
  IDLE: "IDLE",
  CARD_DETECTED: "CARD_DETECTED",
  ALTER_VISIBLE: "ALTER_VISIBLE",
  CARD_FULLY_OUT: "CARD_FULLY_OUT",
  REAL_CARD: "REAL_CARD",
  DONE: "DONE",
});

const STATES = new Set(Object.values(AlterState));
const DEFAULT_EXIT_DELAY_MS = 300;

function isPlainObject(value) {
  return value !== null && typeof value === "object";
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidDelay(value) {
  return isFiniteNumber(value) && value >= 0;
}

function assertDelay(exitDelayMs) {
  if (!isValidDelay(exitDelayMs)) {
    throw new TypeError(
      "exitDelayMs must be a finite number greater than or equal to 0",
    );
  }
}

function assertTimestamp(value, label) {
  if (!isFiniteNumber(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function assertMachine(state) {
  if (!isPlainObject(state)) {
    throw new TypeError("state must be an object");
  }
  if (!STATES.has(state.state)) {
    throw new TypeError("state.state is invalid");
  }
  assertDelay(state.exitDelayMs);
  if (state.lastTimestamp != null) {
    assertTimestamp(state.lastTimestamp, "state.lastTimestamp");
  }
  if (state.absenceStart != null) {
    assertTimestamp(state.absenceStart, "state.absenceStart");
  }
}

function cloneWith(state, patch) {
  return {
    state: patch.state ?? state.state,
    exitDelayMs: state.exitDelayMs,
    lastTimestamp:
      patch.lastTimestamp === undefined ? state.lastTimestamp : patch.lastTimestamp,
    absenceStart:
      patch.absenceStart === undefined ? state.absenceStart : patch.absenceStart,
  };
}

function laterTimestamp(previous, next) {
  if (previous == null) {
    return next;
  }
  return Math.max(previous, next);
}

/**
 * @param {{ exitDelayMs?: number }} [options]
 * @returns {{
 *   state: string,
 *   exitDelayMs: number,
 *   lastTimestamp: number | null,
 *   absenceStart: number | null,
 * }}
 */
export function createAlterState(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError("options must be an object");
  }
  const exitDelayMs =
    options.exitDelayMs === undefined ? DEFAULT_EXIT_DELAY_MS : options.exitDelayMs;
  assertDelay(exitDelayMs);
  return {
    state: AlterState.IDLE,
    exitDelayMs,
    lastTimestamp: null,
    absenceStart: null,
  };
}

/** Overlay B is on only while the alter is showing, including the confirmed exit. */
export function overlayBVisible(state) {
  assertMachine(state);
  return (
    state.state === AlterState.ALTER_VISIBLE ||
    state.state === AlterState.CARD_FULLY_OUT
  );
}

function readObservation(event) {
  assertTimestamp(event.t, "event.t");
  assertBoolean(event.seen, "event.seen");
  assertBoolean(event.fullFrameExit, "event.fullFrameExit");
  assertBoolean(event.stableCorners, "event.stableCorners");
  return {
    t: event.t,
    seen: event.seen,
    fullFrameExit: event.fullFrameExit,
    stableCorners: event.stableCorners,
  };
}

function cardPresent(obs) {
  return obs.seen && !obs.fullFrameExit;
}

function stablePresent(obs) {
  return cardPresent(obs) && obs.stableCorners;
}

function reduceIdle(state, obs) {
  if (stablePresent(obs)) {
    return cloneWith(state, { state: AlterState.ALTER_VISIBLE, absenceStart: null });
  }
  if (cardPresent(obs)) {
    return cloneWith(state, { state: AlterState.CARD_DETECTED, absenceStart: null });
  }
  return cloneWith(state, { absenceStart: null });
}

function reduceDetected(state, obs) {
  if (stablePresent(obs)) {
    return cloneWith(state, { state: AlterState.ALTER_VISIBLE, absenceStart: null });
  }
  // A single dropped detector frame is not an exit. A real full-frame exit
  // before the alter was ever shown returns to idle with overlay B still off.
  if (!obs.seen && !obs.fullFrameExit) {
    return state;
  }
  if (obs.fullFrameExit || !obs.seen) {
    return cloneWith(state, { state: AlterState.IDLE, absenceStart: null });
  }
  return cloneWith(state, { absenceStart: null });
}

function reduceAlterVisible(state, obs) {
  if (obs.fullFrameExit) {
    const absenceStart = state.absenceStart ?? obs.t;
    if (obs.t - absenceStart >= state.exitDelayMs) {
      return cloneWith(state, {
        state: AlterState.CARD_FULLY_OUT,
        absenceStart: null,
      });
    }
    return cloneWith(state, { absenceStart });
  }
  if (obs.seen) {
    // Card returned before the exit delay: brief absence is not a full exit.
    return cloneWith(state, { state: AlterState.ALTER_VISIBLE, absenceStart: null });
  }
  // Missed frame: do not start, cancel, or complete the exit timer.
  return state;
}

function reduceFullyOut(state, obs) {
  if (stablePresent(obs)) {
    return cloneWith(state, { state: AlterState.REAL_CARD, absenceStart: null });
  }
  return cloneWith(state, { absenceStart: null });
}

function reduceRealCard(state, obs) {
  if (stablePresent(obs)) {
    return cloneWith(state, { state: AlterState.DONE, absenceStart: null });
  }
  return cloneWith(state, { absenceStart: null });
}

function reduceDone(state) {
  return cloneWith(state, { absenceStart: null });
}

function applyObservation(state, event) {
  const obs = readObservation(event);
  // Ignore time that runs backwards. Do not treat the delta as elapsed exit.
  if (state.lastTimestamp != null && obs.t < state.lastTimestamp) {
    return state;
  }
  const timed = cloneWith(state, { lastTimestamp: obs.t });
  switch (timed.state) {
    case AlterState.IDLE:
      return reduceIdle(timed, obs);
    case AlterState.CARD_DETECTED:
      return reduceDetected(timed, obs);
    case AlterState.ALTER_VISIBLE:
      return reduceAlterVisible(timed, obs);
    case AlterState.CARD_FULLY_OUT:
      return reduceFullyOut(timed, obs);
    case AlterState.REAL_CARD:
      return reduceRealCard(timed, obs);
    case AlterState.DONE:
      return reduceDone(timed);
    default:
      throw new TypeError("state.state is invalid");
  }
}

function applyReveal(state, event) {
  assertTimestamp(event.t, "event.t");
  const lastTimestamp = laterTimestamp(state.lastTimestamp, event.t);
  if (state.state === AlterState.DONE) {
    return cloneWith(state, { lastTimestamp, absenceStart: null });
  }
  if (state.state === AlterState.REAL_CARD) {
    return cloneWith(state, {
      state: AlterState.DONE,
      lastTimestamp,
      absenceStart: null,
    });
  }
  return cloneWith(state, {
    state: AlterState.REAL_CARD,
    lastTimestamp,
    absenceStart: null,
  });
}

function applyReset(state) {
  return {
    state: AlterState.IDLE,
    exitDelayMs: state.exitDelayMs,
    lastTimestamp: null,
    absenceStart: null,
  };
}

function applyInterrupt(state, event) {
  assertTimestamp(event.t, "event.t");
  // Camera loss is not card absence. Drop any exit accumulation so the gap
  // cannot satisfy exitDelayMs, and do not change the effect state.
  return cloneWith(state, {
    lastTimestamp: laterTimestamp(state.lastTimestamp, event.t),
    absenceStart: null,
  });
}

/**
 * @param {ReturnType<typeof createAlterState>} state
 * @param {{ type: "observe" | "reveal" | "reset" | "interrupt", t?: number, seen?: boolean, fullFrameExit?: boolean, stableCorners?: boolean }} event
 */
export function updateAlterState(state, event) {
  assertMachine(state);
  if (!isPlainObject(event)) {
    throw new TypeError("event must be an object");
  }
  switch (event.type) {
    case "observe":
      return applyObservation(state, event);
    case "reveal":
      return applyReveal(state, event);
    case "reset":
      return applyReset(state);
    case "interrupt":
      return applyInterrupt(state, event);
    default:
      throw new TypeError("event.type is invalid");
  }
}
