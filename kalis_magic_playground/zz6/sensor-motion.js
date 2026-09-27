// Pure motion helpers. Coordinates use CSS pixels with positive Y downward.

const UPRIGHT_ANGLE_DEGREES = 30;
const DIRECT_SHAKE_THRESHOLD = 9;
const GRAVITY_SHAKE_THRESHOLD = 7.5;
const GRAVITY_SHAKE_MAX_GAP_MS = 200;
const SNAP_DIRECT_THRESHOLD = 13;
const SNAP_GRAVITY_THRESHOLD = 13;
const SNAP_COOLDOWN_MS = 1800;

function finiteVector(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    return null;
  }
  return { x: value.x, y: value.y, z: value.z };
}

function screenVector(x, y, screenAngle = 0) {
  const turns = Number.isFinite(screenAngle) ?
    Math.round((((screenAngle % 360) + 360) % 360) / 90) % 4 : 0;
  if (turns === 1) return { x: y, y: x };
  if (turns === 2) return { x: -x, y: -y };
  if (turns === 3) return { x: -y, y: -x };
  return { x, y };
}

function exitDirection(vector) {
  if (Math.abs(vector.x) >= 0.5 && Math.abs(vector.x) >= Math.abs(vector.y) * 0.6) {
    return vector.x > 0 ? 'right' : 'left';
  }
  return vector.y <= -0.5 ? 'top' : null;
}

export function orientationExitDirection({ beta, gamma, screenAngle } = {}) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  const vector = screenVector(Math.sin(gamma * Math.PI / 180),
    Math.sin(beta * Math.PI / 180), screenAngle);
  return exitDirection(vector);
}

export function gravityExitDirection(gravity, { screenAngle } = {}) {
  const vector = finiteVector(gravity);
  if (!vector) return null;
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude < 7 || magnitude > 12) return null;
  const direction = exitDirection(screenVector(-vector.x / magnitude, -vector.y / magnitude, screenAngle));
  // Gravity alone has device-dependent sign, so a vertical reading cannot prove an upward exit.
  return direction === 'top' ? null : direction;
}

export function isPhoneUpright({ beta, gamma, screenAngle, screenOrientation } = {}) {
  const orientation = typeof screenOrientation === 'string' ? screenOrientation.toLowerCase() : '';
  const landscape = orientation.startsWith('landscape') ||
    (!orientation.startsWith('portrait') && Number.isFinite(screenAngle) &&
      Math.round((((screenAngle % 360) + 360) % 360) / 90) % 2 === 1);
  const tilt = landscape ? gamma : beta;
  if (!Number.isFinite(tilt)) return false;

  // Sine maps both face-up (0°) and face-down (180°) flat positions to zero.
  return Math.abs(Math.sin(tilt * Math.PI / 180)) >=
    Math.sin(UPRIGHT_ANGLE_DEGREES * Math.PI / 180);
}

export function isGravityUpright(gravity, { screenAngle, screenOrientation } = {}) {
  const vector = finiteVector(gravity);
  if (!vector) return false;
  const orientation = typeof screenOrientation === 'string' ? screenOrientation.toLowerCase() : '';
  const landscape = orientation.startsWith('landscape') ||
    (!orientation.startsWith('portrait') && Number.isFinite(screenAngle) &&
      Math.round((((screenAngle % 360) + 360) % 360) / 90) % 2 === 1);
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  return magnitude >= 5 && Math.abs(landscape ? vector.x : vector.y) / magnitude >=
    Math.sin(UPRIGHT_ANGLE_DEGREES * Math.PI / 180);
}

export function shakeImpulse(motionEvent, previousSample = null) {
  const direct = finiteVector(motionEvent?.acceleration);
  if (direct) {
    const magnitude = Math.hypot(direct.x, direct.y, direct.z);
    return {
      detected: magnitude >= DIRECT_SHAKE_THRESHOLD,
      magnitude,
      sample: { source: 'direct', ...direct },
    };
  }

  const gravity = finiteVector(motionEvent?.accelerationIncludingGravity);
  if (!gravity) return { detected: false, magnitude: 0, sample: null };

  const prior = previousSample?.source === 'gravity' ? finiteVector(previousSample) : null;
  const delta = prior ? {
    x: gravity.x - prior.x,
    y: gravity.y - prior.y,
    z: gravity.z - prior.z,
  } : null;
  const magnitude = delta ? Math.hypot(delta.x, delta.y, delta.z) : 0;
  const gravityMagnitude = Math.hypot(gravity.x, gravity.y, gravity.z);
  const shock = Boolean(delta && magnitude >= GRAVITY_SHAKE_THRESHOLD &&
    Math.abs(gravityMagnitude - 9.81) >= 5.5);
  const pending = prior ? finiteVector(previousSample.pending) : null;
  const priorMagnitude = pending ? Math.hypot(pending.x, pending.y, pending.z) : 0;
  const timeStamp = Number.isFinite(motionEvent?.timeStamp) ? motionEvent.timeStamp : null;
  const gap = pending && Number.isFinite(previousSample.pending.timeStamp) && timeStamp !== null
    ? timeStamp - previousSample.pending.timeStamp : 0;
  const pendingIsRecent = Boolean(pending && gap >= 0 && gap <= GRAVITY_SHAKE_MAX_GAP_MS);
  // A single large gravity-vector change can be a phone rotation. A shake reverses it.
  const reversed = Boolean(delta && pendingIsRecent && magnitude >= GRAVITY_SHAKE_THRESHOLD &&
    priorMagnitude >= GRAVITY_SHAKE_THRESHOLD &&
    delta.x * pending.x + delta.y * pending.y + delta.z * pending.z <=
      -0.5 * magnitude * priorMagnitude);
  const detected = shock || reversed;
  return {
    detected,
    magnitude,
    sample: {
      source: 'gravity',
      ...gravity,
      snap: shock && magnitude >= 9 && Math.abs(gravityMagnitude - 9.81) >= 7,
      pending: detected ? null : magnitude >= GRAVITY_SHAKE_THRESHOLD
        ? { ...delta, timeStamp } : pendingIsRecent ? previousSample.pending : null,
    },
  };
}

export function isBreakthroughSnap(impulse, now, lastSnapAt = -Infinity) {
  if (!impulse?.detected || !Number.isFinite(now) || now - lastSnapAt < SNAP_COOLDOWN_MS) return false;
  const threshold = impulse.sample?.source === 'direct' ? SNAP_DIRECT_THRESHOLD : SNAP_GRAVITY_THRESHOLD;
  return impulse.magnitude >= threshold || impulse.sample?.source === 'gravity' &&
    impulse.sample.snap === true;
}

export function fallPosition(startY, floorY, elapsedMs, accelerationPxPerSecondSquared = 1800) {
  if (!Number.isFinite(startY) || !Number.isFinite(floorY)) {
    throw new TypeError('startY and floorY must be finite');
  }
  const time = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) / 1000 : 0;
  const acceleration = Number.isFinite(accelerationPxPerSecondSquared) &&
    accelerationPxPerSecondSquared > 0 ? accelerationPxPerSecondSquared : 1800;
  return Math.min(floorY, startY + 0.5 * acceleration * time * time);
}
