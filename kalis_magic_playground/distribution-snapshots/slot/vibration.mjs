export function vibrate(enabled) {
  try { if (enabled) navigator.vibrate?.(35); } catch {}
}
