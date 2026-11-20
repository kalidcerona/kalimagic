// clientX/clientY already follow the visible viewport in both landscape rotations.
export function createGesture() {
  const contacts = new Map();
  let pair, tap, blocked;
  function reset() {
    contacts.clear();
    pair = null;
    tap = null;
    blocked = false;
  }
  reset();
  function move(id, x, y) {
    if (!contacts.has(id)) return;
    contacts.set(id, { x, y });
    if (tap && Math.hypot(x - tap.x, y - tap.y) > 12) tap = null;
    if (pair && [...pair].every(([key, start]) => {
      const end = contacts.get(key);
      return end && end.y - start.y >= 96 && end.y - start.y > 1.5 * Math.abs(end.x - start.x);
    })) {
      blocked = true;
      pair = null;
      return 'settings';
    }
  }
  return {
    reset,
    down(id, x, y) {
      contacts.set(id, { x, y });
      tap = contacts.size === 1 ? { x, y } : null;
      if (contacts.size > 2) blocked = true;
      pair = contacts.size === 2 && !blocked ? new Map(contacts) : null;
    },
    move,
    up(id, x, y, cancelled = false) {
      if (!contacts.has(id)) return;
      const action = cancelled ? undefined : move(id, x, y) || (tap ? 'ring' : undefined);
      contacts.delete(id);
      pair = tap = null;
      blocked = true;
      if (!contacts.size) reset();
      return action;
    },
  };
}

export function listen(surface, dispatch) {
  const gesture = createGesture();
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
      if (action) dispatch(action);
    });
  }
  window.addEventListener('blur', gesture.reset);
  document.addEventListener('visibilitychange', gesture.reset);
}
