// Capture one candidate on contact, then commit only a short release on the same target.
export function listen(surface, candidate, settings) {
  const contacts = new Map();
  let tap, pair;
  function reset() { contacts.clear(); tap = pair = null; }
  surface.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    surface.setPointerCapture(e.pointerId);
    const point = {x:e.clientX, y:e.clientY, dx:0, dy:0};
    contacts.set(e.pointerId, point);
    tap = contacts.size === 1 ? candidate(point.x, point.y) : null;
    if (contacts.size === 2 && pair !== false) pair = true;
    if (contacts.size > 2) pair = false;
  });
  function move(e) {
    const p = contacts.get(e.pointerId);
    if (!p) return;
    p.dx = e.clientX - p.x;
    p.dy = e.clientY - p.y;
    if (Math.hypot(p.dx,p.dy) > 12) tap = null;
    if (pair && [...contacts.values()].every(v => v.dy >= 96 && v.dy > Math.abs(v.dx)*1.5)) {
      pair = false;
      settings();
    }
  }
  surface.addEventListener('pointermove', move);
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    surface.addEventListener(type, e => {
      if (!contacts.has(e.pointerId)) return;
      if (type === 'pointerup') { move(e); tap?.(e.clientX,e.clientY,e.timeStamp); }
      contacts.delete(e.pointerId);
      tap = null;
      pair = false;
      if (!contacts.size) reset();
    });
  }
  return reset;
}
