export function supported() { return typeof navigator.vibrate === 'function'; }
export function vibrate() {
  try { if (supported()) navigator.vibrate(12); } catch {}
}
