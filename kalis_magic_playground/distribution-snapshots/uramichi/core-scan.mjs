import { isValidWebUrl } from './core-url.mjs';

// ---------- ScanText ----------

export function chipLabel(raw, maxChars = 26) {
  const text = String(raw ?? '').trim();
  if (isValidWebUrl(text)) {
    try {
      const host = new URL(text).hostname;
      if (host) return host.toLowerCase();
    } catch { /* fall through to raw text */ }
  }
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length <= maxChars ? oneLine : oneLine.slice(0, maxChars - 1) + '…';
}

/** Both fingers travel at least [threshold] downward and mostly vertically (the house settings gesture). */
export function classifyTwoFingerSwipe(dxA, dyA, dxB, dyB, threshold) {
  const vA = Math.abs(dyA) > Math.abs(dxA), vB = Math.abs(dyB) > Math.abs(dxB);
  return dyA >= threshold && dyB >= threshold && vA && vB ? 'SETTINGS' : 'NONE';
}

export const ZOOM_LABELS = Object.freeze(['.6', '1', '2', '3', '5', '10', '100']);
const ZOOM_VALUES = [0.6, 1, 2, 3, 5, 10, 100];
export function zoomRatioFor(index, min, max) {
  const wanted = index === 0 ? min : ZOOM_VALUES[index];
  return Math.min(max, Math.max(min, wanted));
}
export function zoomSelectedIndex(ratio) {
  const r = Math.log(Math.max(ratio, 0.01));
  let best = 0;
  ZOOM_VALUES.forEach((v, i) => { if (Math.abs(Math.log(v) - r) < Math.abs(Math.log(ZOOM_VALUES[best]) - r)) best = i; });
  return best;
}
