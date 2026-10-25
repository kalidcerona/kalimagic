// Mask, brush and stage geometry for ALETHEIA.
import { LIMITS } from './logic-limits.js';

export function normalizedHiddenPercent(hiddenPercent) {
  if (hiddenPercent == null || hiddenPercent === '') return LIMITS.defaultHidden;
  const number = Number(hiddenPercent);
  if (!Number.isFinite(number)) return LIMITS.defaultHidden;
  return Math.min(LIMITS.maxHidden, Math.max(LIMITS.minHidden, number));
}

export function containRect(containerW, containerH, imageW, imageH) {
  const cw = Number(containerW);
  const ch = Number(containerH);
  const iw = Number(imageW);
  const ih = Number(imageH);
  if (!(cw > 0) || !(ch > 0) || !(iw > 0) || !(ih > 0)) return null;
  if (![cw, ch, iw, ih].every(Number.isFinite)) return null;
  const scale = Math.min(cw / iw, ch / ih);
  const w = iw * scale;
  const h = ih * scale;
  return {
    x: (cw - w) / 2,
    y: (ch - h) / 2,
    w,
    h,
    scale,
  };
}

export function maskDimensions(imageW, imageH, maxSide = LIMITS.maxMaskSide) {
  const iw = Math.floor(Number(imageW));
  const ih = Math.floor(Number(imageH));
  const cap = Math.floor(Number(maxSide));
  if (!(iw > 0) || !(ih > 0) || !(cap > 0)) return null;
  const scale = Math.min(1, cap / Math.max(iw, ih));
  return {
    w: Math.max(1, Math.round(iw * scale)),
    h: Math.max(1, Math.round(ih * scale)),
  };
}

export function mapPointerToMask(clientX, clientY, view, imageRect, maskW, maskH) {
  const maskWidth = Number(maskW);
  const maskHeight = Number(maskH);
  if (!view || !(Number(view.width) > 0) || !(Number(view.height) > 0)) {
    return { x: 0, y: 0, inside: false };
  }
  if (!imageRect || !(Number(imageRect.w) > 0) || !(Number(imageRect.h) > 0)) {
    return { x: 0, y: 0, inside: false };
  }
  if (!(maskWidth > 0) || !(maskHeight > 0)) return { x: 0, y: 0, inside: false };
  const localX = Number(clientX) - Number(view.left);
  const localY = Number(clientY) - Number(view.top);
  const nx = (localX - Number(imageRect.x)) / Number(imageRect.w);
  const ny = (localY - Number(imageRect.y)) / Number(imageRect.h);
  return {
    x: nx * maskWidth,
    y: ny * maskHeight,
    inside: nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1,
  };
}

export function interpolatePoints(x0, y0, x1, y1, spacing) {
  const gap = Number(spacing);
  if (!(gap > 0) || !Number.isFinite(gap)) {
    throw new Error('spacing must be positive');
  }
  const coords = [x0, y0, x1, y1].map(Number);
  if (!coords.every(Number.isFinite)) return [];
  const [sx, sy, ex, ey] = coords;
  const dx = ex - sx;
  const dy = ey - sy;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [];
  const steps = Math.ceil(distance / gap);
  const points = [];
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    points.push({ x: sx + dx * t, y: sy + dy * t });
  }
  return points;
}

export function brushSpacing(diameter) {
  const size = Number(diameter);
  if (!(size > 0) || !Number.isFinite(size)) return 1;
  return Math.max(1, size * 0.3);
}

export function brushDiameterInMask(brushCss, imageCssWidth, maskWidth) {
  const brush = Number(brushCss);
  const viewW = Number(imageCssWidth);
  const maskW = Number(maskWidth);
  if (!(brush > 0) || !(viewW > 0) || !(maskW > 0)) return 0;
  if (![brush, viewW, maskW].every(Number.isFinite)) return 0;
  return brush * (maskW / viewW);
}

export function normalizeCoverage(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= LIMITS.minCoverage && number <= LIMITS.maxCoverage
    ? number : LIMITS.defaultCoverage;
}

export function stageBands(width, height, count = LIMITS.stageCount) {
  const w = Math.floor(Number(width));
  const h = Math.floor(Number(height));
  const n = Math.floor(Number(count));
  if (!(w > 0) || !(h > 0) || !(n > 0)) return [];
  const base = Math.floor(h / n);
  const remainder = h % n;
  const bands = [];
  let y = 0;
  for (let index = 0; index < n; index += 1) {
    const bandH = base + (index < remainder ? 1 : 0);
    bands.push({ index, x: 0, y, w, h: bandH });
    y += bandH;
  }
  return bands;
}

export function initialStageRatios(hiddenPercent, count = LIMITS.stageCount) {
  const n = Math.floor(Number(count));
  if (!(n > 0)) return [];
  const hidden = normalizedHiddenPercent(hiddenPercent);
  const openCount = Math.min(n, Math.floor(((100 - hidden) / 100) * n + 1e-9));
  return Array.from({ length: n }, (_, index) => (index < openCount ? 1 : 0));
}

export function activeStageIndex(ratios, threshold = LIMITS.stageUnlockRatio) {
  if (!Array.isArray(ratios)) return 0;
  const gate = Number(threshold);
  const limit = Number.isFinite(gate) ? gate : LIMITS.stageUnlockRatio;
  for (let index = 0; index < ratios.length; index += 1) {
    if (!(Number(ratios[index]) >= limit)) return index;
  }
  return ratios.length;
}

export function initialFreeClearRect(width, height, hiddenPercent) {
  const w = Math.max(0, Math.floor(Number(width)) || 0);
  const h = Math.max(0, Math.floor(Number(height)) || 0);
  const hidden = normalizedHiddenPercent(hiddenPercent);
  const clearH = Math.min(h, Math.max(0, Math.round(h * ((100 - hidden) / 100))));
  return { x: 0, y: h - clearH, w, h: clearH };
}

export function gradualStartAlpha(hiddenPercent) {
  return normalizedHiddenPercent(hiddenPercent) / 100;
}

export function stampAlpha(mode) {
  if (mode === 'gradual') return LIMITS.gradualStampAlpha;
  return 1;
}
