// BEGIN SETTINGS SWIPE
// BEGIN DESKTOP SETTINGS ACCESS
function bindDesktopSettingsAccess(button, open, canOpen = () => true, canShow = canOpen) {
  const media = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const updateButton = () => { button.hidden = !media.matches || !canShow(); };
  updateButton();
  media.addEventListener?.('change', updateButton);
  const isEditingTarget = (target) => {
    const element = target?.nodeType === 3 ? target.parentElement : target;
    return Boolean(element?.isContentEditable || element?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
  };
  const activate = (event) => {
    if (isEditingTarget(event.target) || !canOpen()) return false;
    event.preventDefault?.();
    open();
    updateButton();
    return true;
  };
  button.addEventListener('click', activate);
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
    activate(event);
  });
  return { activate, updateButton };
}
// END DESKTOP SETTINGS ACCESS
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

