export const SEGMENTS = 12;
export const STEP = 360 / SEGMENTS;

export function mod(value, base = 360) {
  return ((value % base) + base) % base;
}

export function segmentAtPoint(x, y, centerX, centerY, rotation = 0) {
  const angle = Math.atan2(x - centerX, centerY - y) * 180 / Math.PI;
  return mod(Math.round(mod(angle - rotation) / STEP), SEGMENTS);
}

export function segmentAtArrow(rotation) {
  return mod(Math.round(-rotation / STEP), SEGMENTS);
}

export function landingRotation(current, index, direction, turns, jitter = 0) {
  if (!Number.isInteger(index) || index < 0 || index >= SEGMENTS) throw new RangeError('Invalid segment');
  const desired = -index * STEP + jitter;
  const fullTurns = Math.max(2, Math.floor(turns)) * 360;
  return direction < 0
    ? current - mod(current - desired) - fullTurns
    : current + mod(desired - current) + fullTurns;
}

export function randomInt(max, random = crypto.getRandomValues.bind(crypto)) {
  if (!Number.isInteger(max) || max < 1) throw new RangeError('Invalid maximum');
  const range = 0x100000000;
  const limit = range - (range % max);
  const sample = new Uint32Array(1);
  do { random(sample); } while (sample[0] >= limit);
  return sample[0] % max;
}

export function chooseOutcome(spinNumber, forceSpin, target, previous, draw = randomInt) {
  if (spinNumber === forceSpin && target !== null) return target;
  const candidates = Array.from({ length: SEGMENTS }, (_, index) => index)
    .filter((index) => index !== target && index !== previous);
  return candidates[draw(candidates.length)];
}
