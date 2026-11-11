export function installSettingsGesture({ settings, guide, showSettings, cancelDrag }) {
  let settingsOrigins = null;
  let settingsGestureBlocked = false;
  function settingsContacts(list) {
    return Array.from(list || [], (touch) => ({ id: touch.identifier, x: touch.clientX, y: touch.clientY }));
  }
  // Origins are the positions at the moment the pair forms, in viewport coordinates.
  function settingsPairReady(origins, contacts) {
    return origins.every((origin) => {
      const end = contacts.find((point) => point.id === origin.id);
      if (!end) return false;
      const dx = end.x - origin.x;
      const dy = end.y - origin.y;
      return dy >= 96 && dy > Math.abs(dx) * 1.5;
    });
  }
  document.addEventListener('touchstart', event => {
    if (event.touches.length > 2) {
      settingsOrigins = null;
      settingsGestureBlocked = true;
      return;
    }
    if (event.touches.length === 2 && !settingsGestureBlocked && settings.hidden && guide.hidden) {
      settingsOrigins = settingsContacts(event.touches);
      cancelDrag();
      return;
    }
    settingsOrigins = null;
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (settingsGestureBlocked || !settingsOrigins || event.touches.length !== 2) return;
    if (!settingsPairReady(settingsOrigins, settingsContacts(event.touches))) return;
    event.preventDefault();
    settingsOrigins = null;
    settingsGestureBlocked = true;
    showSettings();
  }, { passive: false });
  document.addEventListener('touchend', event => {
    if (event.touches.length < 2) settingsOrigins = null;
    if (event.touches.length === 0) settingsGestureBlocked = false;
  }, { passive: true });
  document.addEventListener('touchcancel', () => {
    settingsOrigins = null;
    settingsGestureBlocked = false;
  }, { passive: true });

}
