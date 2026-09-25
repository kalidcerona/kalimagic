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

// Remove an offset from the live clock, never from a frozen clock snapshot.
export function timeMachineOffset(minutes, triggeredAt, now, delaySeconds, durationSeconds) {
  const offset = Math.max(0, minutes) * 60000;
  if (triggeredAt === null) return offset;
  const elapsed = Math.max(0, now - triggeredAt - delaySeconds * 1000);
  const progress = Math.min(1, elapsed / Math.max(1, durationSeconds * 1000));
  return Math.round(offset * (1 - progress));
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
