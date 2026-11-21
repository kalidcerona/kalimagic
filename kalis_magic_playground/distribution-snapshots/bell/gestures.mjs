// Viewport coordinates follow the visible screen in either landscape orientation.
export function createGesture({ hit = () => ({}), now = () => performance.now(), draw = () => {}, cancelPending = () => {} } = {}) {
  const contacts = new Map();
  let phase = 'normal', hold, demo, single, pair, blocked;

  function interrupt() {
    contacts.clear();
    hold = demo = single = pair = null;
    blocked = false;
    draw(phase);
  }
  function resetPerformance() {
    phase = 'normal';
    interrupt();
  }
  function activate() {
    if (phase === 'normal') return 'ring';
    if (phase === 'armed' || phase === 'stuck') {
      phase = 'stuck';
      draw(phase);
      return 'stuck';
    }
  }
  function down(id, x, y) {
    const target = hit(x, y);
    const point = { id, x, y, startX: x, startY: y, time: now(), tap: true, target, angle: 0 };
    contacts.set(id, point);
    if (contacts.size === 1) {
      single = point;
      if (phase === 'normal' && target.secret && !target.dome) hold = point;
      if (phase === 'stuck' && target.rim) point.rotate = true;
      return;
    }
    single = null;
    draw(phase);
    if (contacts.size === 2 && !blocked) {
      pair = [...contacts.values()].map(p => ({ id: p.id, x: p.x, y: p.y }));
      if (hold?.tap && now() - hold.time >= 250 && target.dome) demo = point;
      else hold = null;
    } else {
      cancelPending();
      hold = demo = pair = null;
      blocked = true;
    }
  }
  function move(id, x, y) {
    const p = contacts.get(id);
    if (!p) return;
    const oldX = p.x, oldY = p.y;
    p.x = x; p.y = y;
    const dx = x - p.startX, dy = y - p.startY;
    if (Math.hypot(dx, dy) > 12) p.tap = false;
    if (p === hold && !p.tap) hold = demo = null;
    if (pair?.every(start => {
      const end = contacts.get(start.id);
      return end.y - start.y >= 96 && end.y - start.y > 1.5 * Math.abs(end.x - start.x);
    })) {
      interrupt();
      return 'settings';
    }
    if (single !== p) return;
    if (p.rotate) {
      const { cx, cy, radius } = p.target;
      const ax = oldX - cx, ay = oldY - cy, bx = x - cx, by = y - cy;
      const vx = bx - ax, vy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(ax + t * vx, ay + t * vy) < radius * .45 || Math.hypot(bx, by) > radius + 1) {
        p.rotate = false;
        draw(phase);
        return;
      }
      p.angle += Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180 / Math.PI;
      // A straight chord can subtend 120 degrees without crossing the inner radius.
      // Require a sampled bend away from the chord leading to the current endpoint.
      if (Math.abs(p.angle) < 15) p.bend = null;
      if (Math.abs(p.angle) >= 45 && !p.bend) p.bend = { dx, dy };
      const deviation = p.bend && Math.abs(p.bend.dx * dy - p.bend.dy * dx) / (Math.hypot(dx, dy) || 1);
      if (Math.abs(p.angle) >= 120 - 1e-8 && deviation > radius * .08) {
        phase = 'open';
        single = null;
      }
      draw(phase, { angle: Math.abs(p.angle) >= 15 ? p.angle : 0 });
    } else if (phase === 'open' && p.target.card) {
      if (p.target.left + dx >= p.target.width && dx > 1.5 * Math.abs(dy)) {
        phase = 'empty';
        single = null;
      }
      draw(phase, { dx, dy });
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
    if (p === demo && hold && p.tap) {
      const demoHold = hold;
      demoHold.requested = true;
      demo = null;
      return { action: 'ring', onStarted() {
        if (hold === demoHold) demoHold.rang = true;
      } };
    }
    let result;
    if (p === hold && now() - p.time >= 250) {
      if (p.requested && !contacts.size) {
        cancelPending();
        if (p.rang) phase = 'armed';
      }
      hold = demo = null;
    } else if (single === p && phase === 'open' && p.target.card) {
      const dx = x - p.startX;
      if (dx >= Math.max(48, p.target.width * .12) && dx > 1.5 * Math.abs(y - p.startY)) phase = 'empty';
    } else if (single === p && p.tap && (phase === 'normal' || p.target.dome)) {
      result = activate();
    }
    if (!contacts.size) interrupt();
    return result;
  }
  return { down, move, up, activate, reset: interrupt, resetPerformance, phase: () => phase };
}

export function listen(surface, dispatch, options) {
  const gesture = createGesture(options);
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    surface.setPointerCapture(event.pointerId);
    gesture.down(event.pointerId, event.clientX, event.clientY);
  });
  for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => {
      const action = type === 'pointermove'
        ? gesture.move(event.pointerId, event.clientX, event.clientY)
        : gesture.up(event.pointerId, event.clientX, event.clientY, type !== 'pointerup');
      if (action?.onStarted) dispatch(action.action, action.onStarted);
      else if (action) dispatch(action);
    });
  }
  return gesture;
}
