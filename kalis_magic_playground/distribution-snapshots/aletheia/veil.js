import {
  ERASED_ALPHA_MAX, LIMITS, VEIL_COLOR, activeStageIndex, brushDiameterInMask, brushSpacing,
  containRect, gradualStartAlpha, initialFreeClearRect, initialStageRatios, interpolatePoints,
  mapPointerToMask, stageBands, stampAlpha,
} from './logic.js';
import { view, running } from './controller.js';
import { canvas } from './dom.js';
import { coverageSize } from './preferences.js';
import { hideCellGuide, alignCellGuide } from './cell-guide.js';
import { contacts } from './pointer.js';

let lastStageSample = 0;

function paintInitialMask() {
  const { mask, maskCtx, preset, ratios } = running;
  const width = mask.width;
  const height = mask.height;
  maskCtx.save();
  maskCtx.globalCompositeOperation = 'source-over';
  maskCtx.clearRect(0, 0, width, height);
  maskCtx.globalAlpha = preset.mode === 'gradual' ? gradualStartAlpha(preset.hiddenPercent) : 1;
  maskCtx.fillStyle = VEIL_COLOR;
  maskCtx.fillRect(0, 0, width, height);
  maskCtx.globalAlpha = 1;
  if (preset.mode === 'free') {
    const rect = initialFreeClearRect(width, height, preset.hiddenPercent);
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (preset.mode === 'stages') {
    const bands = stageBands(width, height, LIMITS.stageCount);
    maskCtx.globalCompositeOperation = 'destination-out';
    bands.forEach((band, index) => {
      if (band.w <= 0 || band.h <= 0) {
        ratios[index] = 1;
        return;
      }
      if (ratios[index] >= 1) maskCtx.fillRect(band.x, band.y, band.w, band.h);
    });
  }
  maskCtx.restore();
}

function activeDrawableBand() {
  if (!running) return null;
  const bands = stageBands(running.mask.width, running.mask.height, LIMITS.stageCount);
  for (let guard = 0; guard < bands.length; guard += 1) {
    const index = activeStageIndex(running.ratios, LIMITS.stageUnlockRatio);
    if (index >= bands.length) return null;
    const band = bands[index];
    if (!band || band.w <= 0 || band.h <= 0) {
      running.ratios[index] = 1;
      continue;
    }
    return band;
  }
  return null;
}

function erasedRatio(ctx, band) {
  const image = ctx.getImageData(band.x, band.y, band.w, band.h);
  const step = 8;
  let total = 0;
  let clear = 0;
  for (let y = 0; y < band.h; y += step) {
    for (let x = 0; x < band.w; x += step) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      total += 1;
      if (alpha < ERASED_ALPHA_MAX) clear += 1;
    }
  }
  return total ? clear / total : 0;
}

function maybeAdvanceStage(force = false) {
  if (!running || running.preset.mode !== 'stages') return;
  const now = performance.now();
  if (!force && now - lastStageSample < 80) return;
  lastStageSample = now;
  const band = activeDrawableBand();
  if (!band) return;
  let ratio;
  try {
    ratio = erasedRatio(running.maskCtx, band);
  } catch {
    return;
  }
  running.ratios[band.index] = ratio;
  if (ratio < LIMITS.stageUnlockRatio) return;
  const ctx = running.maskCtx;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.restore();
  running.ratios[band.index] = 1;
}

function redraw() {
  if (view !== 'performance' || !running) return;
  const viewRect = canvas.getBoundingClientRect();
  if (viewRect.width < 2 || viewRect.height < 2) return;
  const cssW = viewRect.width;
  const cssH = viewRect.height;
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  const bufferW = Math.max(1, Math.round(cssW * dpr));
  const bufferH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(bufferW / cssW, 0, 0, bufferH / cssH, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, cssW, cssH);
  // Before a court is locked, the stage stays empty black. No card, no veil edge.
  if (running.cardMode && running.cardPhase !== 'reveal') return;
  if (!running.image) return;
  const imageRect = containRect(cssW, cssH, running.image.naturalWidth, running.image.naturalHeight);
  if (!imageRect) return;
  ctx.drawImage(running.image, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(running.mask, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
}

function currentBrushDiameter() {
  if (!running) return 0;
  const viewRect = canvas.getBoundingClientRect();
  const imageRect = containRect(
    viewRect.width,
    viewRect.height,
    running.image.naturalWidth,
    running.image.naturalHeight,
  );
  if (!imageRect) return 0;
  return brushDiameterInMask(coverageSize, imageRect.w, running.mask.width);
}

function mapFromClient(clientX, clientY) {
  const viewRect = canvas.getBoundingClientRect();
  const imageRect = containRect(
    viewRect.width,
    viewRect.height,
    running.image.naturalWidth,
    running.image.naturalHeight,
  );
  if (!imageRect) return { x: 0, y: 0, inside: false };
  return mapPointerToMask(clientX, clientY, {
    left: viewRect.left,
    top: viewRect.top,
    width: viewRect.width,
    height: viewRect.height,
  }, imageRect, running.mask.width, running.mask.height);
}

function pointsFor(contact, clientX, clientY) {
  const diameter = currentBrushDiameter();
  if (!(diameter > 0)) return [];
  const mapped = mapFromClient(clientX, clientY);
  const previous = contact.last;
  contact.last = { x: mapped.x, y: mapped.y };
  if (!previous) {
    if (mapped.inside) return [{ x: mapped.x, y: mapped.y }];
    // A grid cell can be outside a letterboxed photo; reveal its closest edge immediately.
    if (running.cardMode) return [{
      x: Math.min(running.mask.width, Math.max(0, mapped.x)),
      y: Math.min(running.mask.height, Math.max(0, mapped.y)),
    }];
    return [];
  }
  try {
    return interpolatePoints(previous.x, previous.y, mapped.x, mapped.y, brushSpacing(diameter));
  } catch {
    return [];
  }
}

function stampPoints(points) {
  if (!running || !points.length) return;
  // Card strokes only paint after the card selection is committed.
  if (running.cardMode && running.cardPhase !== 'reveal') return;
  hideCellGuide();
  const ctx = running.maskCtx;
  const mode = running.preset.mode;
  const diameter = currentBrushDiameter();
  if (!(diameter > 0)) return;
  const radius = diameter / 2;
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = stampAlpha(mode);
    if (mode === 'stages') {
      const band = activeDrawableBand();
      if (!band) return;
      ctx.beginPath();
      ctx.rect(band.x, band.y, band.w, band.h);
      ctx.clip();
    }
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } finally {
    ctx.restore();
  }
  if (mode === 'stages') maybeAdvanceStage();
  redraw();
}

function resetVeil() {
  if (!running) return;
  // Card scratches and the locked court stay until the performance is left.
  if (running.cardMode) return;
  running.ratios = initialStageRatios(running.preset.hiddenPercent, LIMITS.stageCount);
  lastStageSample = 0;
  paintInitialMask();
  for (const contact of contacts.values()) contact.last = null;
  redraw();
}

function onViewportChange() {
  if (view !== 'performance') return;
  alignCellGuide();
  for (const contact of contacts.values()) contact.last = null;
  redraw();
}

export {
  paintInitialMask, maybeAdvanceStage, redraw, pointsFor, stampPoints, resetVeil, onViewportChange,
};
