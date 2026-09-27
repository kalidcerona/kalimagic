export function mod(value, base = 360) {
  return ((value % base) + base) % base;
}

export function angleAtPoint(x, y, centerX, centerY) {
  return mod(Math.atan2(x - centerX, centerY - y) * 180 / Math.PI);
}

export function angularDistance(first, second) {
  return Math.abs(mod(first - second + 180) - 180);
}

export function landingRotation(current, angle, direction, turns) {
  if (!Number.isFinite(angle)) throw new RangeError('Invalid angle');
  const desired = mod(angle);
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

export function chooseOutcome(spinNumber, forceSpin, targetAngle, previousAngle, draw = randomInt) {
  if (spinNumber === forceSpin && targetAngle !== null) return mod(targetAngle);
  const candidates = Array.from({ length: 360 }, (_, angle) => angle)
    .filter((angle) => (targetAngle === null || angularDistance(angle, targetAngle) > 30)
      && (previousAngle === null || angularDistance(angle, previousAngle) > 10));
  return candidates[draw(candidates.length)];
}
