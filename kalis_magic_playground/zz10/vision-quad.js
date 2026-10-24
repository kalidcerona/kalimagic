// Quad refinement against image edges and card-shape scoring. Moved verbatim from vision.js.
import { clamp01, isDegenerateQuad, orderCorners, quadArea, signedPolygonArea } from "./vision-geometry.js";
import { channelDistance, lumaAt, rgbAt } from "./vision-sampling.js";

const MIN_CONTRAST = 18;
const MIN_ASPECT = 1.25;
const MAX_ASPECT = 1.95;
const IDEAL_ASPECT = 1.4;
const MIN_SIDE_SUPPORT = 0.45;
const MIN_MEAN_SUPPORT = 0.6;

function sobelAt(frame, x, y) {
  if (x < 1 || y < 1 || x >= frame.width - 1 || y >= frame.height - 1) return null;
  const { data, width } = frame;
  const at = (px, py) => lumaAt(data, width, px, py);
  const a = at(x - 1, y - 1);
  const b = at(x, y - 1);
  const c = at(x + 1, y - 1);
  const d = at(x - 1, y);
  const e = at(x + 1, y);
  const f = at(x - 1, y + 1);
  const g = at(x, y + 1);
  const h = at(x + 1, y + 1);
  const gx = -a + c - 2 * d + 2 * e - f + h;
  const gy = -a - 2 * b - c + f + 2 * g + h;
  return { gx, gy, mag: Math.hypot(gx, gy) };
}

function fitLine(points) {
  let meanX = 0;
  let meanY = 0;
  for (const point of points) {
    meanX += point.x;
    meanY += point.y;
  }
  meanX /= points.length;
  meanY /= points.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx + syy < 1e-4) return null;
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { x: meanX, y: meanY, dx: Math.cos(angle), dy: Math.sin(angle) };
}

function intersectLines(first, second) {
  const det = first.dx * second.dy - first.dy * second.dx;
  if (Math.abs(det) < 1e-8) return null;
  const t = ((second.x - first.x) * second.dy - (second.y - first.y) * second.dx) / det;
  const x = first.x + t * first.dx;
  const y = first.y + t * first.dy;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function sideGeometry(corners, side) {
  const start = corners[side];
  const end = corners[(side + 1) % 4];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  let cx = 0;
  let cy = 0;
  for (const point of corners) {
    cx += point.x;
    cy += point.y;
  }
  cx /= 4;
  cy /= 4;
  const midX = (start.x + end.x) * 0.5;
  const midY = (start.y + end.y) * 0.5;
  let nx = length ? -dy / length : 0;
  let ny = length ? dx / length : 0;
  if (nx * (midX - cx) + ny * (midY - cy) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const previous = corners[(side + 3) % 4];
  const adjacent = Math.hypot(start.x - previous.x, start.y - previous.y);
  return {
    start,
    dx,
    dy,
    length,
    nx,
    ny,
    inward: Math.max(28, Math.min(72, adjacent * 0.42)),
  };
}

function lineThrough(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: start.x, y: start.y, dx: dx / length, dy: dy / length };
}

// A short-edge grip continues across the boundary. That is not evidence the
// card edge is missing, and it is not used as a skin classifier.
function gripCoversProbe(frame, x, y, nx, ny, inward) {
  if (warmGripPixel(frame, x, y)) return true;
  const edge = rgbAt(frame, x, y);
  const outside = rgbAt(frame, x + nx * 8, y + ny * 8);
  const inside = rgbAt(frame, x - nx * 5, y - ny * 5);
  const deep = rgbAt(frame, x - nx * inward, y - ny * inward);
  if (!edge || !outside || !inside || !deep) return false;
  if (channelDistance(edge, outside) > 14) return false;
  if (channelDistance(inside, outside) > 18) return false;
  return channelDistance(deep, outside) >= 16;
}

/**
 * Snap each side of a coarse rectangle to the strongest nearby image gradient
 * and replace the corners with line intersections. Returns null when a side
 * lacks enough gradient support for a stable fit. One grip-covered side may
 * keep its coarse line.
 */
function refineQuad(coarse, frame, step, contrast) {
  const radius = Math.max(3, step + 2);
  const magMin = Math.max(30, contrast * 0.75);
  const samples = 16;
  const lines = [];
  let coveredSides = 0;

  for (let side = 0; side < 4; side += 1) {
    const geometry = sideGeometry(coarse, side);
    if (geometry.length < 8) return null;
    const tx = geometry.dx / geometry.length;
    const ty = geometry.dy / geometry.length;
    const nx = -ty;
    const ny = tx;
    const hits = [];
    let covered = 0;

    for (let i = 0; i < samples; i += 1) {
      const t = 0.14 + (0.72 * (i + 0.5)) / samples;
      const baseX = geometry.start.x + tx * geometry.length * t;
      const baseY = geometry.start.y + ty * geometry.length * t;
      if (gripCoversProbe(frame, baseX, baseY, geometry.nx, geometry.ny, geometry.inward)) {
        covered += 1;
      }
      let best = null;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const x = baseX + nx * offset;
        const y = baseY + ny * offset;
        const gradient = sobelAt(frame, Math.round(x), Math.round(y));
        if (!gradient || gradient.mag < magMin) continue;
        const alignment = Math.abs(gradient.gx * nx + gradient.gy * ny) / gradient.mag;
        if (alignment < 0.5) continue;
        if (!best || gradient.mag > best.mag) {
          best = { mag: gradient.mag, x, y };
        }
      }
      if (best) hits.push(best);
    }

    if (hits.length >= samples * 0.55) {
      const line = fitLine(hits);
      if (!line) return null;
      lines.push(line);
    } else if (covered >= samples * 0.45) {
      coveredSides += 1;
      if (coveredSides > 1) return null;
      lines.push(lineThrough(geometry.start, coarse[(side + 1) % 4]));
    } else return null;
  }

  const corners = [];
  for (let i = 0; i < 4; i += 1) {
    const corner = intersectLines(lines[(i + 3) % 4], lines[i]);
    if (!corner) return null;
    corners.push(corner);
  }
  return corners;
}

function sideLengths(corners) {
  return corners.map((point, index) => {
    const next = corners[(index + 1) % corners.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
}

function aspectOf(corners) {
  const lengths = sideLengths(corners);
  const pairA = (lengths[0] + lengths[2]) * 0.5;
  const pairB = (lengths[1] + lengths[3]) * 0.5;
  const longSide = Math.max(pairA, pairB);
  const shortSide = Math.min(pairA, pairB);
  if (shortSide < 1e-6) return null;
  return {
    aspect: longSide / shortSide,
    longSide,
    shortSide,
    lengths,
  };
}

function roughlyRectangular(corners) {
  const shape = aspectOf(corners);
  if (!shape) return false;
  const { lengths } = shape;
  const pairA = (lengths[0] + lengths[2]) * 0.5;
  const pairB = (lengths[1] + lengths[3]) * 0.5;
  if (Math.abs(lengths[0] - lengths[2]) > 0.18 * pairA) return false;
  if (Math.abs(lengths[1] - lengths[3]) > 0.18 * pairB) return false;
  for (let i = 0; i < 4; i += 1) {
    const prev = corners[(i + 3) % 4];
    const curr = corners[i];
    const next = corners[(i + 1) % 4];
    const ax = curr.x - prev.x;
    const ay = curr.y - prev.y;
    const bx = next.x - curr.x;
    const by = next.y - curr.y;
    const denom = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (denom < 1e-6) return false;
    // Adjacent sides of a rectangle are perpendicular, so |cos| is near 0.
    if (Math.abs((ax * bx + ay * by) / denom) > 0.45) return false;
  }
  return true;
}

function pointInConvex(point, corners) {
  let sign = 0;
  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const value = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(value) <= 1e-6) continue;
    const next = value > 0 ? 1 : -1;
    if (sign === 0) sign = next;
    else if (sign !== next) return false;
  }
  return true;
}

function warmGripPixel(frame, x, y) {
  const i = (Math.max(0, Math.min(frame.height - 1, Math.round(y))) * frame.width +
    Math.max(0, Math.min(frame.width - 1, Math.round(x)))) * 4;
  const r = frame.data[i], g = frame.data[i + 1], b = frame.data[i + 2];
  return r - b > Math.max(16, r * 0.07) && r - g > Math.max(7, r * 0.03);
}

function edgeSupport(corners, frame, contrast) {
  const magMin = Math.max(28, contrast * 0.7);
  const samples = 18;
  const ratios = [];
  let occludedSides = 0;

  for (let side = 0; side < 4; side += 1) {
    const geometry = sideGeometry(corners, side);
    if (geometry.length < 8) return 0;
    const tx = geometry.dx / geometry.length;
    const ty = geometry.dy / geometry.length;
    const nx = -ty;
    const ny = tx;
    let hits = 0;
    let available = 0;
    let covered = 0;

    for (let i = 0; i < samples; i += 1) {
      const t = 0.12 + (0.76 * (i + 0.5)) / samples;
      const x = geometry.start.x + geometry.dx * t;
      const y = geometry.start.y + geometry.dy * t;
      // A foreground grip can remove a real edge. One mostly covered side is
      // allowed; the other three still need their own gradient support.
      if (gripCoversProbe(frame, x, y, geometry.nx, geometry.ny, geometry.inward)) {
        covered += 1;
        continue;
      }
      available += 1;
      let best = null;
      for (let offset = -1; offset <= 1; offset += 1) {
        const gradient = sobelAt(
          frame,
          Math.round(x + nx * offset),
          Math.round(y + ny * offset),
        );
        if (gradient && (!best || gradient.mag > best.mag)) best = gradient;
      }
      if (!best || best.mag < magMin) continue;
      const alignment = Math.abs(best.gx * nx + best.gy * ny) / best.mag;
      if (alignment >= 0.55) hits += 1;
    }

    const coveredSide = covered >= samples * 0.45 &&
      (available < 8 || hits < available * MIN_SIDE_SUPPORT);
    if (coveredSide) {
      occludedSides += 1;
      if (occludedSides > 1) return 0;
      continue;
    }
    if (available < 8) return 0;
    const ratio = hits / available;
    if (ratio < MIN_SIDE_SUPPORT) return 0;
    ratios.push(ratio);
  }

  if (!ratios.length || ratios.length + occludedSides !== 4) return 0;
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

function cornersClose(first, second, limit) {
  for (let i = 0; i < 4; i += 1) {
    if (Math.hypot(first[i].x - second[i].x, first[i].y - second[i].y) > limit) {
      return false;
    }
  }
  return true;
}

function scoreQuad(corners, frame, contrast, anchor) {
  const ordered = orderCorners(corners);
  if (!ordered || isDegenerateQuad(ordered)) return null;
  if (signedPolygonArea(ordered) <= 0) return null;
  if (!roughlyRectangular(ordered)) return null;
  if (gluedToFrame(ordered, frame.width, frame.height)) return null;

  const shape = aspectOf(ordered);
  if (!shape) return null;
  if (shape.aspect < MIN_ASPECT || shape.aspect > MAX_ASPECT) return null;
  if (shape.shortSide < 18) return null;

  const frameArea = frame.width * frame.height;
  const area = quadArea(ordered);
  const fraction = area / frameArea;
  if (fraction < 0.015 || fraction > 0.78) return null;

  const margin = 3;
  for (const point of ordered) {
    if (
      point.x < -margin ||
      point.y < -margin ||
      point.x > frame.width + margin ||
      point.y > frame.height + margin
    ) {
      return null;
    }
  }
  if (anchor && !pointInConvex(anchor, ordered)) return null;

  const support = edgeSupport(ordered, frame, contrast);
  if (support < MIN_MEAN_SUPPORT) return null;

  const contrastScore = clamp01((contrast - MIN_CONTRAST) / 120);
  const aspectScore = 1 - clamp01(Math.abs(shape.aspect - IDEAL_ASPECT) / 0.55);
  const confidence = clamp01(0.55 * support + 0.3 * contrastScore + 0.15 * aspectScore);
  if (confidence < 0.5) return null;

  return {
    corners: ordered,
    confidence,
    aspectRatio: shape.aspect,
  };
}

function gluedToFrame(corners, width, height) {
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    if (a.x <= 2.5 && b.x <= 2.5) return true;
    if (a.y <= 2.5 && b.y <= 2.5) return true;
    if (a.x >= width - 2.5 && b.x >= width - 2.5) return true;
    if (a.y >= height - 2.5 && b.y >= height - 2.5) return true;
  }
  return false;
}

export { MIN_CONTRAST, cornersClose, pointInConvex, refineQuad, scoreQuad, warmGripPixel };
