// Coordinates are local to the black performance screen's invisible phone keypad.
export function hiddenDigit(x, y, width, height) {
  if (![x,y,width,height].every(Number.isFinite) || width <= 0 || height <= 0
      || x < 0 || y < 0 || x >= width || y >= height) return null;
  const column = Math.floor(x / width * 3);
  const row = Math.floor(y / height * 4);
  if (row === 3) return column === 1 ? 0 : null;
  return row * 3 + column + 1;
}

export function appendMinuteDigit(digits, digit) {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9 || digits.length >= 2) {
    return { digits, minutes: null };
  }
  const next = [...digits, digit];
  return { digits: next, minutes: next.length === 2 ? next[0] * 10 + next[1] : null };
}

export function registerEmergencyTap(lastTap, now) {
  if (lastTap !== null && now - lastTap <= 450 && now >= lastTap) {
    return { lastTap: null, enter: true };
  }
  return { lastTap: now, enter: false };
}

export const REWIND_STEP_MS = 800;

function rewindMinutes(minutes) {
  return Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
}
function rewindDelay(delaySeconds) {
  return Number.isFinite(delaySeconds) ? Math.max(0, delaySeconds) * 1000 : 0;
}

// The legacy duration argument is ignored: each full minute takes exactly 800ms.
export function timeMachineOffset(minutes, triggeredAt, now, delaySeconds) {
  const total = rewindMinutes(minutes);
  if (!Number.isFinite(triggeredAt) || !Number.isFinite(now)) return total * 60000;
  const elapsed = Math.max(0, now - triggeredAt - rewindDelay(delaySeconds));
  const steps = Math.min(total, Math.floor(elapsed / REWIND_STEP_MS));
  return (total - steps) * 60000;
}

// Freeze the wall-clock baseline during the steps so wall-minute rollover cannot
// cancel a decrement. Hold the final anchored minute for one step before
// resuming the live clock, so its rollover cannot swallow the final decrement.
export function timeMachineClock(minutes, triggeredAt, now, delaySeconds, wallNow, triggeredWallAt) {
  const total = rewindMinutes(minutes);
  const offset = timeMachineOffset(minutes, triggeredAt, now, delaySeconds);
  const delay = rewindDelay(delaySeconds);
  if (!total || !Number.isFinite(triggeredAt) || !Number.isFinite(now)
      || !Number.isFinite(triggeredWallAt) || now < triggeredAt + delay
      || now >= triggeredAt + delay + (total + 1) * REWIND_STEP_MS) return wallNow + offset;
  return triggeredWallAt + delay + offset;
}

export function isSettingsSwipe(start, current) {
  if (start?.length !== 2 || current?.length !== 2) return false;
  return start.every((point) => {
    const end = current.find((candidate) => candidate.id === point.id);
    if (!end) return false;
    const dx = end.x - point.x, dy = end.y - point.y;
    return dy >= 96 && Math.abs(dx) <= dy * 0.65;
  });
}

export function horizontalPeekOffset(startX, currentX, width) {
  return Math.max(-width, Math.min(0, currentX - startX));
}

export function unlockDragTarget(distance, velocity, height) {
  return distance / height >= .28 || (distance >= 24 && velocity >= .45);
}
