const OPEN_SWEEP = 195;
const MIN_TANGENT_SWEEP = 135;
const ANGLE_EPSILON = .001;

// Viewport coordinates follow the visible screen in either landscape orientation.
export function createGesture({ hit = () => ({}), draw = () => {}, zoomCard = () => {}, hasSecond = () => false, afterExit = done => done(), cancelPending = () => {} } = {}) {
  const contacts = new Map();
  let phase = 'normal', hold, demo, single, pair, blocked;

  let direction = 0, progress = 0, tangentProgress = 0, second = false, closeTimer;
  let extractedBy, exitToken;
  const settling = () => phase === 'closing' || (phase === 'empty' && exitToken !== undefined);
  function render(extra) {
    const angle = settling() ? 0 : direction * progress;
    draw(phase, { angle, second, ...extra });
  }
  function openIfTurned() {
    if (progress < OPEN_SWEEP - ANGLE_EPSILON || tangentProgress < MIN_TANGENT_SWEEP - ANGLE_EPSILON) return;
    phase = 'open';
    single = null;
  }
  function closeForSecond() {
    second = true;
    phase = 'closing';
    render();
    closeTimer = setTimeout(() => {
      phase = 'stuck';
      if (!single?.deferredTurn) openIfTurned();
      render();
    }, 500);
  }
  function waitForSecondExit() {
    if (second || !hasSecond()) return;
    direction = progress = tangentProgress = 0;
    const token = exitToken = {};
    afterExit(() => {
      if (exitToken !== token) return;
      exitToken = undefined;
      closeForSecond();
    });
  }
  function discardDeferredTurn() {
    if (!settling() && phase !== 'stuck') return;
    for (const point of contacts.values()) {
      if (point.deferredTurn) {
        ({ direction, progress, tangentProgress } = point.deferredTurn);
        point.deferredTurn = null;
        return;
      }
    }
  }
  function interrupt() {
    discardDeferredTurn();
    if (extractedBy !== undefined) {
      extractedBy = undefined;
      phase = 'open';
    }
    contacts.clear();
    hold = demo = single = pair = null;
    blocked = false;
    render();
  }
  function resetPerformance() {
    clearTimeout(closeTimer);
    exitToken = undefined;
    extractedBy = undefined;
    second = false;
    direction = progress = tangentProgress = 0;
    phase = 'normal';
    interrupt();
  }
  function activate() {
    if (phase === 'normal') return 'ring';
    if (phase === 'armed' || phase === 'stuck') {
      phase = 'stuck';
      render();
      return 'stuck';
    }
  }
  function down(id, x, y) {
    const target = hit(x, y);
    const point = { id, x, y, startX: x, startY: y, tap: true, target, angle: 0 };
    contacts.set(id, point);
    if (contacts.size === 1) {
      single = point;
      if (phase === 'normal' && target.secret && !target.dome) hold = point;
      if ((phase === 'stuck' || settling()) && target.rim) {
        point.samples = [];
        point.pendingAngle = point.pendingTangent = point.tangent = 0;
        if (settling()) point.deferredTurn = { direction, progress, tangentProgress };
      }
      return;
    }
    discardDeferredTurn();
    single = null;
    render();
    if (contacts.size === 2 && !blocked) {
      pair = [...contacts.values()].map(p => ({ id: p.id, x: p.x, y: p.y }));
      const [a, b] = pair;
      pair.distance = Math.hypot(b.x - a.x, b.y - a.y);
      pair.midX = (a.x + b.x) / 2;
      pair.midY = (a.y + b.y) / 2;
      pair.card = phase === 'open' && hit(pair.midX, pair.midY).card;
      if (phase === 'normal' && target.dome) demo = point;
    } else {
      cancelPending();
      hold = demo = pair = null;
      blocked = true;
    }
  }
  function move(id, x, y, deferPair = false) {
    const p = contacts.get(id);
    if (!p) return;
    const oldX = p.x, oldY = p.y;
    p.x = x; p.y = y;
    const dx = x - p.startX, dy = y - p.startY;
    if (Math.hypot(dx, dy) > 12) p.tap = false;
    if (p === hold && Math.hypot(dx, dy) > 40) {
      if (hold.requested) cancelPending();
      hold = null;
    }
    if (pair) return deferPair ? undefined : evaluatePair();
    if (single !== p) return;
    moveSingle(p, oldX, oldY, x, y, dx, dy);
  }
  function evaluatePair() {
    if (!pair) return;
    const [a, b] = pair.map(start => contacts.get(start.id));
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const spreading = Math.abs(distance - pair.distance) > Math.max(4, Math.min(24, pair.distance * .12));
    if (pair.card && pair.distance && (pair.pinching || spreading)) {
      pair.pinching = true;
      zoomCard(pair, distance / pair.distance, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if ((phase !== 'open' || !spreading) && pair.every(start => {
      const end = contacts.get(start.id);
      return end.y - start.y >= 96 && end.y - start.y > 1.5 * Math.abs(end.x - start.x);
    })) {
      interrupt();
      return 'settings';
    }
  }
  function moveSingle(p, oldX, oldY, x, y, dx, dy) {
    if (p.samples) {
      const { cx, cy, radius, outerRadius = radius + 1 } = p.target;
      const ax = oldX - cx, ay = oldY - cy, bx = x - cx, by = y - cy;
      const vx = bx - ax, vy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(ax + t * vx, ay + t * vy) < radius * .45 || Math.hypot(bx, by) > outerRadius) {
        p.samples = null;
        render();
        return;
      }
      const delta = Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180 / Math.PI;
      const chord = Math.hypot(dx, dy);
      const length = Math.hypot(vx, vy);
      if (!length) return;
      const threshold = Math.max(8, chord * .1) * chord;
      const curved = chord > 0 && p.samples.some(([sx, sy]) =>
        Math.abs(sx * dy - sy * dx) > threshold);
      p.samples.push([dx, dy]);

      // At the midpoint the radius is perpendicular to either local tangent.
      const rx = ax + bx, ry = ay + by;
      const radial = Math.abs(vx * rx + vy * ry);
      const tangential = radial <= Math.sin(36 * Math.PI / 180) * length * Math.hypot(rx, ry);
      // Track the physical turn separately from tangent credit so a wobbly arc
      // can complete just past a half-turn without accepting a noisy chord.
      p.pendingAngle += delta;
      if (tangential) p.pendingTangent += delta;
      if (!curved) return;
      const increment = p.pendingAngle, tangent = p.pendingTangent;
      p.pendingAngle = p.pendingTangent = 0;
      p.angle += increment;
      p.tangent += tangent;
      if (direction) {
        progress = Math.max(0, progress + direction * increment);
        tangentProgress = Math.min(progress, Math.max(0, tangentProgress + direction * tangent));
      } else if (Math.abs(p.angle) >= 15 - 1e-8) {
        direction = Math.sign(p.angle);
        progress = Math.abs(p.angle);
        tangentProgress = Math.min(progress, Math.max(0, direction * p.tangent));
      }
      if (phase === 'stuck' && !p.deferredTurn) openIfTurned();
      render();
    } else if (phase === 'open' && p.target.card) {
      if (p.target.left + dx >= p.target.width && dx > 1.5 * Math.abs(dy)) {
        phase = 'empty';
        extractedBy = p.id;
        single = null;
      }
      render({ dx, dy });
    }
  }
  function up(id, x, y, cancelled = false) {
    const p = contacts.get(id);
    if (!p) return;
    if (cancelled) { cancelPending(); interrupt(); return; }
    const action = move(id, x, y);
    if (action) return action;
    contacts.delete(id);
    pair = null;
    // A turn begun before settlement can reveal only once its touch ends normally.
    if (p.deferredTurn && phase === 'stuck') openIfTurned();
    if (p === demo && p.tap && hit(x, y).dome) {
      demo = null;
      if (!hold) return activate();
      const demoHold = hold;
      demoHold.requested = true;
      return { action: 'ring', onStarted() {
        if (hold === demoHold) demoHold.rang = true;
      } };
    }
    let result;
    if (p === hold) {
      if (p.requested) {
        cancelPending();
        if (p.rang) phase = 'armed';
      }
      hold = demo = null;
    } else if (single === p && phase === 'open' && p.target.card) {
      const dx = x - p.startX;
      if (dx >= Math.max(48, p.target.width * .12) && dx > 1.5 * Math.abs(y - p.startY)) {
        phase = 'empty';
        render({ dx, dy: y - p.startY });
        waitForSecondExit();
      }
    } else if (single === p && p.tap && p.target.dome && hit(x, y).dome) {
      result = activate();
    }
    if (phase === 'empty' && extractedBy === id) {
      extractedBy = undefined;
      waitForSecondExit();
    }
    if (!contacts.size) interrupt();
    return result;
  }
  return { refresh: render, down, move, up, evaluatePair, activate, reset: interrupt, resetPerformance, phase: () => phase };
}

export function listen(surface, dispatch, options) {
  const gesture = createGesture(options);
  let frame;
  function schedulePair() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const action = gesture.evaluatePair();
      if (action) dispatch(action);
    });
  }
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    surface.setPointerCapture(event.pointerId);
    gesture.down(event.pointerId, event.clientX, event.clientY);
  });
  for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => {
      const action = type === 'pointermove'
        ? (schedulePair(), gesture.move(event.pointerId, event.clientX, event.clientY, true))
        : gesture.up(event.pointerId, event.clientX, event.clientY, type !== 'pointerup');
      if (action?.onStarted) dispatch(action.action, action.onStarted);
      else if (action) dispatch(action);
    });
  }
  return gesture;
}
