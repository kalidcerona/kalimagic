const key = 'friend-slot.settings.v1';
export function validRound(n) { return Number.isInteger(n) && n >= 1 && n <= 20; }
export function preferences() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  return {round: validRound(saved?.round) ? saved.round : 1, sound:saved?.sound !== false, vibration:saved?.vibration === true};
}
export function save({sound,vibration,round}) {
  try { localStorage.setItem(key, JSON.stringify({sound,vibration,round})); } catch {}
}
