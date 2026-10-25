// BEGIN SETTINGS SWIPE
function installSettingsSwipe(open, cancel, enabled, cancelHold = cancel) {
  const pointers = new Map();
  let pair = null, blocked = false, suppressUntil = 0;
  const options = { capture: true, passive: false };
  window.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 2) { blocked = true; pair = null; }
    if (pointers.size !== 2 || blocked || !enabled() || event.target.closest('input,textarea,button[data-date-action],#settings,#text-editor,#date-settings,#install-nudge')) return;
    pair = [...pointers].map(([id, point]) => ({ id, ...point, dx: 0, dy: 0 }));
    cancelHold();
  }, options);
  window.addEventListener('pointermove', event => {
    if (!pair || blocked) return;
    const point = pair.find(point => point.id === event.pointerId);
    if (!point) return;
    point.dx = event.clientX - point.x;
    point.dy = event.clientY - point.y;
    if (Math.hypot(point.dx, point.dy) > 15) cancel();
    if (!pair.every(point => point.dy >= 96 && point.dy > Math.abs(point.dx) * 1.5)) return;
    blocked = true;
    pair = null;
    suppressUntil = Date.now() + 700;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (enabled()) open();
  }, options);
  const release = event => {
    pointers.delete(event.pointerId);
    pair = null;
    if (!pointers.size) blocked = false;
  };
  window.addEventListener('pointerup', release, options);
  window.addEventListener('pointercancel', release, options);
  window.addEventListener('blur', () => { pointers.clear(); pair = null; blocked = false; });
  window.addEventListener('click', event => {
    if (Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, options);
}
// END SETTINGS SWIPE

export { installSettingsSwipe };
