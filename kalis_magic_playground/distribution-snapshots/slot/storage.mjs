const key = 'friend-slot.settings.v1';
export function preferences() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  return {sound:saved?.sound !== false, vibration:saved?.vibration === true};
}
export function save({sound,vibration}) {
  try { localStorage.setItem(key, JSON.stringify({sound,vibration})); } catch {}
}
