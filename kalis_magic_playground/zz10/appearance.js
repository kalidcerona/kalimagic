/** Display-only paper match. Sampling never writes the camera frame or the mask. */

import { applyHomography, computeHomography, mapSourceOntoCorners } from "./vision.js";

const NEUTRAL = Object.freeze({ r: 251, g: 249, b: 243, gain: 1 });
const ANALYSIS_COLS = 24;
const ANALYSIS_ROWS = 32;
const PAPER_TAU_MS = 180;
const PAPER_GAP_MS = 320;
const PAPER_DEADBAND = 3;
const MAX_CHANNEL_STEP = 6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function neutralColor() {
  return { r: NEUTRAL.r, g: NEUTRAL.g, b: NEUTRAL.b, gain: NEUTRAL.gain };
}

function isNeutralFallback(color) {
  return Boolean(color)
    && color.r === NEUTRAL.r
    && color.g === NEUTRAL.g
    && color.b === NEUTRAL.b
    && color.gain === NEUTRAL.gain;
}

function paperLike(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma < 168 || luma > 252) return false;
  if (max - min > 30) return false;
  // Warm skin can be bright enough to look like dirty paper. Chroma above
  // already rejects most of it; this catches a moderate red cast.
  if (r > g + 10 && r > b + 18) return false;
  return true;
}

function clampPaper(r, g, b) {
  const avg = (r + g + b) / 3;
  const limit = 16;
  let red = avg + clamp(r - avg, -limit, limit);
  let green = avg + clamp(g - avg, -limit, limit);
  let blue = avg + clamp(b - avg, -limit, limit);
  const luma = 0.299 * red + 0.587 * green + 0.114 * blue;
  const neutralLuma = 0.299 * NEUTRAL.r + 0.587 * NEUTRAL.g + 0.114 * NEUTRAL.b;
  const gain = clamp(luma / neutralLuma, 0.72, 1.05);
  const scale = (neutralLuma * gain) / Math.max(luma, 1);
  return {
    r: Math.round(clamp(red * scale, 168, 252)),
    g: Math.round(clamp(green * scale, 168, 252)),
    b: Math.round(clamp(blue * scale, 168, 252)),
    gain: Math.round(gain * 1000) / 1000,
  };
}

export function createPaperMatch() {
  return { color: null, at: null };
}

/**
 * Estimate replacement paper from the current frame and the raw quad.
 * Hand pixels are whatever the mask marks transparent. Dark print, saturated
 * ink, and skin-like chroma are ignored. Unreliable coverage returns neutral
 * white instead of guessing. The frame and mask buffers are read-only.
 */
export function sampleCardPaper(frame, corners, mask) {
  const fallback = { reliable: false, coverage: 0, color: neutralColor() };
  if (!frame?.data || !frame.width || !frame.height || !mask?.data || !mask.width || !mask.height) {
    return fallback;
  }
  if (mask.data.length < mask.width * mask.height * 4) return fallback;
  const homography = mapSourceOntoCorners(mask.width, mask.height, corners);
  if (!homography) return fallback;

  const step = Math.max(1, Math.ceil(Math.max(frame.width, frame.height) / 256));
  const x0 = Math.floor(mask.width * 0.12);
  const x1 = Math.max(x0 + 1, Math.ceil(mask.width * 0.88));
  const y0 = Math.floor(mask.height * 0.12);
  const y1 = Math.max(y0 + 1, Math.ceil(mask.height * 0.88));
  const bins = new Uint8Array(9);
  let count = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  let minU = 1;
  let maxU = 0;
  let minV = 1;
  let maxV = 0;

  for (let row = 0; row < ANALYSIS_ROWS; row += 1) {
    const my = Math.min(mask.height - 1, y0 + Math.floor(((row + 0.5) * (y1 - y0)) / ANALYSIS_ROWS));
    for (let col = 0; col < ANALYSIS_COLS; col += 1) {
      const mx = Math.min(mask.width - 1, x0 + Math.floor(((col + 0.5) * (x1 - x0)) / ANALYSIS_COLS));
      if (mask.data[(my * mask.width + mx) * 4 + 3] === 0) continue;
      const point = applyHomography(homography, mx + 0.5, my + 0.5);
      if (!point) continue;
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) continue;
      const sx = Math.min(frame.width - 1, Math.round(x / step) * step);
      const sy = Math.min(frame.height - 1, Math.round(y / step) * step);
      const offset = (sy * frame.width + sx) * 4;
      const sampleRed = frame.data[offset];
      const sampleGreen = frame.data[offset + 1];
      const sampleBlue = frame.data[offset + 2];
      if (!paperLike(sampleRed, sampleGreen, sampleBlue)) continue;
      count += 1;
      red += sampleRed;
      green += sampleGreen;
      blue += sampleBlue;
      const u = col / ANALYSIS_COLS;
      const v = row / ANALYSIS_ROWS;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
      const bx = u < 0.33 ? 0 : u < 0.66 ? 1 : 2;
      const by = v < 0.33 ? 0 : v < 0.66 ? 1 : 2;
      bins[by * 3 + bx] = 1;
    }
  }

  const coveredBins = bins.reduce((sum, value) => sum + value, 0);
  const coverage = count / (ANALYSIS_COLS * ANALYSIS_ROWS);
  if (count < 48 || coveredBins < 4 || maxU - minU < 0.35 || maxV - minV < 0.35) {
    return { reliable: false, coverage, color: neutralColor() };
  }
  return {
    reliable: true,
    coverage,
    color: clampPaper(red / count, green / count, blue / count),
  };
}

/**
 * Modest low-pass. No extrapolation across a gap, and no chase of a bad sample.
 * An unreliable sample that already carries the neutral fallback replaces the
 * previous tint. A different unreliable reading is not adopted.
 */
export function updatePaperMatch(state, sample, t) {
  const neutral = neutralColor();
  const current = state?.color ? { ...state.color } : null;
  if (!Number.isFinite(t)) return { state: createPaperMatch(), color: neutral };
  if (state?.at != null && t < state.at) return { state, color: current || neutral };

  const reliable = Boolean(sample?.reliable && sample.color);
  const target = reliable ? sample.color : neutral;
  const gap = state?.at == null ? Infinity : t - state.at;
  if (!current || gap > PAPER_GAP_MS) {
    const color = reliable
      ? { r: target.r, g: target.g, b: target.b, gain: target.gain }
      : neutral;
    return { state: { color: { ...color }, at: t }, color };
  }
  if (!reliable) {
    if (isNeutralFallback(sample?.color)) {
      const color = neutralColor();
      return { state: { color: { ...color }, at: t }, color };
    }
    return { state: { color: current, at: state.at }, color: current };
  }

  const alpha = clamp(1 - Math.exp(-(t - state.at) / PAPER_TAU_MS), 0.12, 0.4);
  const next = { gain: target.gain };
  for (const channel of ["r", "g", "b"]) {
    const delta = target[channel] - current[channel];
    if (Math.abs(delta) <= PAPER_DEADBAND) next[channel] = current[channel];
    else next[channel] = Math.round(current[channel] + clamp(alpha * delta, -MAX_CHANNEL_STEP, MAX_CHANNEL_STEP));
  }
  return { state: { color: next, at: t }, color: next };
}

function maskRect(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

function minNeighborAlpha(data, width, height, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let alpha = 255;
  let seen = false;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const sx = ix + ox;
      const sy = iy + oy;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      seen = true;
      const sample = data[(sy * width + sx) * 4 + 3];
      if (sample < alpha) alpha = sample;
    }
  }
  return seen ? alpha : 0;
}

/**
 * Warp a mask built on the raw quad into the displayed card plane.
 * Display texel → frame → raw mask. Outside the raw quad, or an invalid
 * mapped point, stays transparent. The minimum nearby raw alpha keeps a live
 * hand edge and never makes a pixel more opaque. The input mask is not written.
 * Returns null when the geometry cannot be mapped; callers hide the overlay.
 */
export function remapOcclusionToDisplay(mask, rawCorners, displayCorners) {
  if (!mask?.data || !Number.isInteger(mask.width) || !Number.isInteger(mask.height)) return null;
  const width = mask.width;
  const height = mask.height;
  if (width < 1 || height < 1 || mask.data.length < width * height * 4) return null;
  const rect = maskRect(width, height);
  const displayToFrame = mapSourceOntoCorners(width, height, displayCorners);
  const frameToRaw = computeHomography(rawCorners, rect);
  if (!displayToFrame || !frameToRaw) return null;

  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const frame = applyHomography(displayToFrame, x + 0.5, y + 0.5);
      const raw = frame && applyHomography(frameToRaw, frame.x, frame.y);
      const outside = !raw || raw.x < 0 || raw.y < 0 || raw.x > width || raw.y > height;
      const alpha = outside ? 0 : minNeighborAlpha(mask.data, width, height, raw.x, raw.y);
      const offset = (y * width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alpha;
    }
  }
  return { width, height, data };
}

/**
 * A failed mask, or the same bitmap presented for a different quad, is not a
 * source. Callers must draw `mask` or clear the overlay; never keep `previous`.
 */
export function resolveOverlayMask(previous, quadKey, mask) {
  if (!quadKey || !mask) return { quadKey: "", mask: null };
  if (previous?.quadKey && previous.quadKey !== quadKey && previous.mask === mask) {
    return { quadKey: "", mask: null };
  }
  return { quadKey, mask };
}
