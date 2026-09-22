// Coordinates are local to the black performance screen.
export function gridMinutes(x, y, width, height, values = [1,2,3,4,5,6,7,8,9]) {
  if (![x,y,width,height].every(Number.isFinite) || width <= 0 || height <= 0
      || x < 0 || y < 0 || x >= width || y >= height) return null;
  return values[Math.floor(y / height * 3) * 3 + Math.floor(x / width * 3)];
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
    return dy >= 60 && Math.abs(dx) <= dy * 0.65;
  });
}

export function horizontalPeekOffset(startX, currentX, width) {
  return Math.max(-width, Math.min(0, currentX - startX));
}
