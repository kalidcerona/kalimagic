/**
 * Pure Lie Detector rules.
 * No DOM, timers, audio, or network. Callers pass timestamps and pointer
 * coordinates; this module only decides cancellation, attempt count, and verdict.
 *
 * A spectator holds one button. Releasing before HOLD_THRESHOLD_MS, or moving
 * farther than HOLD_MOVE_TOLERANCE_PX from the initial contact, cancels the
 * hold and does not increment the attempt count. A completed hold is one attempt.
 * Attempts listed in settings.truthAttempts read TRUE; all others read LIE.
 */

export const HOLD_THRESHOLD_MS = 2000;
export const HOLD_MOVE_TOLERANCE_PX = 24;
export const TRUTH_ATTEMPT_MIN = 1;
export const TRUTH_ATTEMPT_MAX = 20;
export const TRUTH_ATTEMPT_DEFAULT = 4;

export const LIMITS = Object.freeze({
  truthAttemptMin: TRUTH_ATTEMPT_MIN,
  truthAttemptMax: TRUTH_ATTEMPT_MAX,
  truthAttemptDefault: TRUTH_ATTEMPT_DEFAULT,
  holdThresholdMs: HOLD_THRESHOLD_MS,
  holdMoveTolerancePx: HOLD_MOVE_TOLERANCE_PX,
});

export function createDefaultState() {
  return {
    version: 1,
    attemptCount: 0,
    settings: {
      truthAttempts: [TRUTH_ATTEMPT_DEFAULT],
    },
  };
}

export function createHold() {
  return {
    phase: "idle",
    startedAt: null,
    originX: null,
    originY: null,
  };
}

function movementPx(originX, originY, x, y) {
  return Math.hypot(x - originX, y - originY);
}

function holdOf(hold) {
  if (!hold || typeof hold !== "object" || Array.isArray(hold)) return createHold();
  if (hold.phase !== "holding" && hold.phase !== "cancelled") return createHold();
  if (!Number.isFinite(hold.startedAt) || !Number.isFinite(hold.originX) || !Number.isFinite(hold.originY)) {
    return createHold();
  }
  return {
    phase: hold.phase,
    startedAt: hold.startedAt,
    originX: hold.originX,
    originY: hold.originY,
  };
}

/**
 * Accept an integer in 1..20. Numeric strings are allowed ("6");
 * blanks, decimals, booleans, and out-of-range values are not.
 */
export function parseTruthAttempt(value) {
  let numeric = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) return { ok: false, error: "truth-attempt" };
    numeric = Number(trimmed);
  }
  if (typeof numeric !== "number" || !Number.isInteger(numeric)) {
    return { ok: false, error: "truth-attempt" };
  }
  if (numeric < TRUTH_ATTEMPT_MIN || numeric > TRUTH_ATTEMPT_MAX) {
    return { ok: false, error: "truth-attempt" };
  }
  return { ok: true, value: numeric };
}

/** Accept comma-separated 1..20 attempt indices, without duplicates. */
export function parseTruthAttempts(value) {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [value];
  if (parts.length === 0 || parts.length > TRUTH_ATTEMPT_MAX) return { ok: false, error: "truth-attempt" };
  const parsed = [];
  for (const part of parts) {
    const item = parseTruthAttempt(part);
    if (!item.ok || parsed.includes(item.value)) return { ok: false, error: "truth-attempt" };
    parsed.push(item.value);
  }
  return { ok: true, value: parsed.sort((a, b) => a - b) };
}

export function coerceTruthAttempts(value) {
  const parsed = parseTruthAttempts(value);
  return parsed.ok ? parsed.value : [TRUTH_ATTEMPT_DEFAULT];
}

export function coerceTruthAttempt(value) {
  const parsed = parseTruthAttempt(value);
  return parsed.ok ? parsed.value : TRUTH_ATTEMPT_DEFAULT;
}

export function coerceAttemptCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}

export function shapeAppState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "shape" };
  }
  const settings = input.settings && typeof input.settings === "object" && !Array.isArray(input.settings)
    ? input.settings
    : {};
  return {
    ok: true,
    state: {
      version: 1,
      attemptCount: coerceAttemptCount(input.attemptCount),
      settings: {
        truthAttempts: coerceTruthAttempts(settings.truthAttempts ?? settings.truthAttempt),
      },
    },
  };
}

export function serializeState(state) {
  const shaped = shapeAppState(state);
  if (!shaped.ok) throw new Error("refusing to serialize an invalid lie detector state");
  return JSON.stringify(shaped.state);
}

export function parseStoredPayload(raw) {
  if (raw == null || raw === "") return { status: "empty" };
  if (typeof raw !== "string") return { status: "malformed", raw: String(raw) };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: "malformed", raw };
  }
  const shaped = shapeAppState(data);
  if (!shaped.ok) return { status: "invalid", raw };
  return { status: "ok", state: shaped.state };
}

/**
 * Empty storage uses defaults. Unreadable storage keeps the original string
 * so a caller can avoid overwriting it until mayOverwritePrimary allows it.
 * Hold geometry is never persisted; a reloaded state is always between attempts.
 */
export function loadFromRaw(raw) {
  const parsed = parseStoredPayload(raw);
  if (parsed.status === "empty") {
    return {
      source: "default",
      state: createDefaultState(),
      preserveStoredRaw: false,
      recoveryRaw: null,
    };
  }
  if (parsed.status === "ok") {
    return {
      source: "saved",
      state: parsed.state,
      preserveStoredRaw: false,
      recoveryRaw: null,
    };
  }
  return {
    source: "unreadable",
    state: createDefaultState(),
    preserveStoredRaw: true,
    recoveryRaw: parsed.raw,
  };
}

export function mayOverwritePrimary({ preserveStoredRaw, backupSaved, acknowledged }) {
  if (!preserveStoredRaw) return true;
  return backupSaved === true || acknowledged === true;
}

export function trySetTruthAttempt(state, value) {
  const parsed = parseTruthAttempts(value);
  if (!parsed.ok) return { ok: false, state, error: parsed.error };
  const shaped = shapeAppState(state);
  const base = shaped.ok ? shaped.state : createDefaultState();
  return {
    ok: true,
    state: {
      ...base,
      settings: { truthAttempts: parsed.value },
    },
    error: null,
  };
}

export function resetAttempts(state) {
  const shaped = shapeAppState(state);
  const base = shaped.ok ? shaped.state : createDefaultState();
  return { ...base, attemptCount: 0 };
}

/** Verdict for a 1-based completed attempt. Non-positive attempts have none. */
export function verdictForAttempt(attemptNumber, truthAttempts) {
  const attempt = coerceAttemptCount(attemptNumber);
  if (attempt <= 0) return null;
  const truths = coerceTruthAttempts(truthAttempts);
  return truths.includes(attempt) ? "TRUE" : "LIE";
}

export function beginHold(hold, nowMs, x, y) {
  const current = holdOf(hold);
  if (current.phase !== "idle") {
    return { hold: current, accepted: false, reason: "busy" };
  }
  if (!Number.isFinite(nowMs) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { hold: current, accepted: false, reason: "input" };
  }
  return {
    hold: { phase: "holding", startedAt: nowMs, originX: x, originY: y },
    accepted: true,
    reason: "holding",
  };
}

/**
 * Movement beyond the tolerance cancels and stays cancelled even if the
 * pointer later returns. Idle holds are unchanged.
 */
export function updateHold(hold, x, y) {
  const current = holdOf(hold);
  if (current.phase === "idle") {
    return { hold: current, cancelled: false, reason: "idle", movementPx: 0 };
  }
  if (current.phase === "cancelled") {
    return { hold: current, cancelled: true, reason: "cancelled", movementPx: null };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      hold: { ...current, phase: "cancelled" },
      cancelled: true,
      reason: "input",
      movementPx: null,
    };
  }
  const moved = movementPx(current.originX, current.originY, x, y);
  if (moved > HOLD_MOVE_TOLERANCE_PX) {
    return {
      hold: { ...current, phase: "cancelled" },
      cancelled: true,
      reason: "movement",
      movementPx: moved,
    };
  }
  return { hold: current, cancelled: false, reason: "holding", movementPx: moved };
}

function finishCancelled(state, reason, elapsedMs, movement) {
  return {
    state,
    hold: createHold(),
    counted: false,
    outcome: "cancelled",
    attempt: state.attemptCount,
    verdict: null,
    reason,
    elapsedMs,
    movementPx: movement,
  };
}

/**
 * Release ends the gesture. Count increases only when the hold is still
 * active and elapsed time is at least HOLD_THRESHOLD_MS. Threshold is inclusive.
 */
export function releaseHold(state, hold, nowMs, x, y) {
  const shaped = shapeAppState(state);
  const safeState = shaped.ok ? shaped.state : createDefaultState();
  const current = holdOf(hold);
  if (current.phase === "idle") {
    return {
      state: safeState,
      hold: current,
      counted: false,
      outcome: "ignored",
      attempt: safeState.attemptCount,
      verdict: null,
      reason: "idle",
      elapsedMs: null,
      movementPx: 0,
    };
  }

  let phase = current.phase;
  let moved = null;
  if (phase === "holding") {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      phase = "cancelled";
    } else {
      moved = movementPx(current.originX, current.originY, x, y);
      if (moved > HOLD_MOVE_TOLERANCE_PX) phase = "cancelled";
    }
  }

  const elapsed = Number.isFinite(nowMs) ? nowMs - current.startedAt : Number.NaN;
  if (phase === "cancelled") {
    return finishCancelled(safeState, "movement", Number.isFinite(elapsed) ? elapsed : null, moved);
  }
  if (!Number.isFinite(elapsed) || elapsed < HOLD_THRESHOLD_MS) {
    return finishCancelled(safeState, "early", Number.isFinite(elapsed) ? elapsed : null, moved);
  }

  const attempt = safeState.attemptCount + 1;
  return {
    state: { ...safeState, attemptCount: attempt },
    hold: createHold(),
    counted: true,
    outcome: "completed",
    attempt,
    verdict: verdictForAttempt(attempt, safeState.settings.truthAttempts),
    reason: "threshold",
    elapsedMs: elapsed,
    movementPx: moved,
  };
}
