/**
 * Card-shaped geometry prototype for a live mobile camera.
 *
 * This module detects one high-contrast convex card quadrilateral from an RGBA
 * frame. It does not recognize a printed identity, suit, rank, or "card A",
 * and it does not recover which physical edge is the top of the artwork.
 * Corner order is image-space only: clockwise, starting at the vertex with the
 * smallest x+y (top-left-most), then the smallest x, then the smallest y.
 *
 * Cost model for a W×H frame:
 *   s = max(1, ceil(max(W, H) / MAX_GRID_SIDE))
 *   Luminance samples, threshold, and connected components run on a grid of
 *   about (W/s) by (H/s), capped near MAX_GRID_SIDE² (≈ 192²) operations.
 *   The convex hull is built from that grid's boundary (O(B log B), B is the
 *   perimeter in grid cells). The minimum-area rectangle is O(H²) on the hull,
 *   which for a card is a short convex chain, not the full camera image.
 *   Full-resolution work is limited to Sobel probes along four sides
 *   (4 sides × ~16 samples × a ±(s+2) pixel normal search). No full-frame
 *   grayscale buffer is allocated.
 *
 * Limitations:
 *   - Needs a silhouette that contrasts with a fairly uniform border. The
 *     border median is the background reference, so a card cut off by the frame
 *     or filling the border is rejected.
 *   - The fitted shape is a rotated rectangle. Strong perspective keystone is
 *     only a limitation of detection; mapSourceOntoCorners still accepts a
 *     general convex destination quad.
 *   - Objects thinner than a few sample steps, heavy clutter, soft shadows,
 *     and low contrast return null. Downsampling limits coarse localization to
 *     about one sample step; refinement recovers a sharp edge only when it lies
 *     within the normal search radius.
 *   - Alpha is ignored. Results are deterministic and contain no tracking.
 */

const MAX_GRID_SIDE = 192;
const MIN_CONTRAST = 26;
const MIN_ASPECT = 1.25;
const MAX_ASPECT = 1.95;
const IDEAL_ASPECT = 1.4;
const MIN_SIDE_SUPPORT = 0.45;
const MIN_MEAN_SUPPORT = 0.6;
const MIN_TURN_SIN = 0.05;

function isPlainObject(value) {
  return value !== null && typeof value === "object";
}

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function readPoint(point) {
  if (!isPlainObject(point)) return null;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: point.x, y: point.y };
}

function readQuad(points) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  const quad = [];
  for (let i = 0; i < 4; i += 1) {
    const point = readPoint(points[i]);
    if (!point) return null;
    quad.push(point);
  }
  return quad;
}

/**
 * Signed shoelace area. Positive means clockwise when y increases downward.
 * @param {{x:number,y:number}[]} points
 */
export function signedPolygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

/** Absolute polygon area. Returns 0 when the point list is unusable. */
export function quadArea(corners) {
  const quad = readQuad(corners);
  if (!quad) return 0;
  return Math.abs(signedPolygonArea(quad));
}

function polygonArea(points) {
  return Math.abs(signedPolygonArea(points));
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

function turnSin(prev, curr, next) {
  const ax = curr.x - prev.x;
  const ay = curr.y - prev.y;
  const bx = next.x - curr.x;
  const by = next.y - curr.y;
  const lenA = Math.hypot(ax, ay);
  const lenB = Math.hypot(bx, by);
  if (lenA === 0 || lenB === 0) return 0;
  return cross(ax, ay, bx, by) / (lenA * lenB);
}

/**
 * True when the quad is missing, non-finite, self-intersecting, non-convex,
 * or too flat / too small to define a stable projective map.
 * The given vertex order is preserved; points are not reordered.
 */
export function isDegenerateQuad(corners) {
  return analyzeQuad(corners) === null;
}

function analyzeQuad(corners) {
  const quad = readQuad(corners);
  if (!quad) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of quad) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const scale = Math.max(maxX - minX, maxY - minY, 1e-9);
  const minSide = Math.max(1e-6, scale * 1e-4);
  const sins = [];
  for (let i = 0; i < 4; i += 1) {
    const prev = quad[(i + 3) % 4];
    const curr = quad[i];
    const next = quad[(i + 1) % 4];
    const side = Math.hypot(next.x - curr.x, next.y - curr.y);
    if (side < minSide) return null;
    const sin = turnSin(prev, curr, next);
    if (Math.abs(sin) < MIN_TURN_SIN) return null;
    sins.push(sin);
  }
  const positive = sins.some((value) => value > 0);
  const negative = sins.some((value) => value < 0);
  if (positive && negative) return null;

  const area = Math.abs(signedPolygonArea(quad));
  if (area < scale * scale * 1e-4) return null;
  return { quad, area, scale };
}

/**
 * Clockwise image order starting at the top-left-most vertex.
 * Returns null when the input is not four finite points.
 */
export function orderCorners(points) {
  const quad = readQuad(points);
  if (!quad) return null;

  let cx = 0;
  let cy = 0;
  for (const point of quad) {
    cx += point.x;
    cy += point.y;
  }
  cx /= 4;
  cy /= 4;

  const sorted = quad
    .map((point) => ({ x: point.x, y: point.y }))
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  let start = 0;
  for (let i = 1; i < 4; i += 1) {
    if (isBefore(sorted[i], sorted[start])) start = i;
  }
  return [0, 1, 2, 3].map((offset) => sorted[(start + offset) % 4]);
}

function isBefore(a, b) {
  const scoreA = a.x + a.y;
  const scoreB = b.x + b.y;
  if (scoreA < scoreB - 1e-9) return true;
  if (scoreB < scoreA - 1e-9) return false;
  if (a.x < b.x - 1e-9) return true;
  if (b.x < a.x - 1e-9) return false;
  return a.y < b.y;
}

function assertFrame(frame) {
  if (!isPlainObject(frame)) {
    throw new TypeError("frame must be an object");
  }
  const { data, width, height } = frame;
  if (!Number.isInteger(width) || width <= 0) {
    throw new TypeError("frame.width must be a positive integer");
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new TypeError("frame.height must be a positive integer");
  }
  if (!data || typeof data.length !== "number") {
    throw new TypeError("frame.data must be an array-like RGBA buffer");
  }
  if (data.length !== width * height * 4) {
    throw new TypeError("frame.data length must be width * height * 4");
  }
}

function lumaAt(data, width, x, y) {
  const offset = (y * width + x) * 4;
  return 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
}

function sampleStep(width, height) {
  return Math.max(1, Math.ceil(Math.max(width, height) / MAX_GRID_SIDE));
}

function buildLumaGrid(frame, step) {
  const { data, width, height } = frame;
  const gridWidth = Math.ceil(width / step);
  const gridHeight = Math.ceil(height / step);
  const luma = new Float64Array(gridWidth * gridHeight);
  for (let gy = 0; gy < gridHeight; gy += 1) {
    const y = Math.min(height - 1, gy * step);
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const x = Math.min(width - 1, gx * step);
      luma[gy * gridWidth + gx] = lumaAt(data, width, x, y);
    }
  }
  return { luma, gridWidth, gridHeight, step };
}

function cellToImage(gx, gy, step, width, height) {
  return {
    x: Math.min(width - 1, gx * step),
    y: Math.min(height - 1, gy * step),
  };
}

function median(values) {
  const copy = values.slice().sort((a, b) => a - b);
  const mid = copy.length >> 1;
  if (copy.length % 2 === 1) return copy[mid];
  return (copy[mid - 1] + copy[mid]) * 0.5;
}

function borderStats(grid) {
  const { luma, gridWidth, gridHeight } = grid;
  const samples = [];
  for (let x = 0; x < gridWidth; x += 1) {
    samples.push(luma[x]);
    samples.push(luma[(gridHeight - 1) * gridWidth + x]);
  }
  for (let y = 1; y < gridHeight - 1; y += 1) {
    samples.push(luma[y * gridWidth]);
    samples.push(luma[y * gridWidth + gridWidth - 1]);
  }
  const bg = median(samples);
  let accum = 0;
  for (const value of samples) {
    const delta = value - bg;
    accum += delta * delta;
  }
  const std = Math.sqrt(accum / samples.length);
  return { bg, std };
}

function labelComponents(grid, threshold, bg) {
  const { luma, gridWidth, gridHeight } = grid;
  const count = gridWidth * gridHeight;
  const foreground = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    foreground[i] = Math.abs(luma[i] - bg) >= threshold ? 1 : 0;
  }

  const labels = new Int32Array(count);
  const components = [];
  const stack = [];
  let nextLabel = 1;

  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const start = gy * gridWidth + gx;
      if (!foreground[start] || labels[start] !== 0) continue;

      const id = nextLabel;
      nextLabel += 1;
      labels[start] = id;
      stack.push(start);

      let area = 0;
      let sum = 0;
      let minX = gx;
      let maxX = gx;
      let minY = gy;
      let maxY = gy;
      let touchesBorder = false;
      let sumX = 0;
      let sumY = 0;

      while (stack.length > 0) {
        const index = stack.pop();
        const x = index % gridWidth;
        const y = (index - x) / gridWidth;
        area += 1;
        sum += luma[index];
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === gridWidth - 1 || y === gridHeight - 1) {
          touchesBorder = true;
        }

        if (x > 0) visit(index - 1, id);
        if (x + 1 < gridWidth) visit(index + 1, id);
        if (y > 0) visit(index - gridWidth, id);
        if (y + 1 < gridHeight) visit(index + gridWidth, id);
      }

      components.push({
        id,
        area,
        mean: sum / area,
        minX,
        maxX,
        minY,
        maxY,
        touchesBorder,
        cx: sumX / area,
        cy: sumY / area,
      });
    }
  }

  function visit(index, id) {
    if (!foreground[index] || labels[index] !== 0) return;
    labels[index] = id;
    stack.push(index);
  }

  components.sort((a, b) => b.area - a.area || a.minY - b.minY || a.minX - b.minX);
  return { labels, components };
}

function componentBoundary(labels, component, grid, width, height) {
  const { gridWidth, gridHeight, step } = grid;
  const boundary = [];
  const { id } = component;

  function filled(x, y) {
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return false;
    return labels[y * gridWidth + x] === id;
  }

  for (let y = component.minY; y <= component.maxY; y += 1) {
    for (let x = component.minX; x <= component.maxX; x += 1) {
      if (!filled(x, y)) continue;
      if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) {
        boundary.push(cellToImage(x, y, step, width, height));
      }
    }
  }
  return boundary;
}

function convexHull(points) {
  if (points.length <= 1) return points.slice();
  const sorted = points
    .slice()
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const unique = [];
  for (const point of sorted) {
    const last = unique[unique.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) unique.push(point);
  }
  if (unique.length <= 2) return unique;

  function chain(source) {
    const output = [];
    for (const point of source) {
      while (output.length >= 2) {
        const b = output[output.length - 1];
        const a = output[output.length - 2];
        if (cross(b.x - a.x, b.y - a.y, point.x - b.x, point.y - b.y) <= 0) {
          output.pop();
        } else {
          break;
        }
      }
      output.push(point);
    }
    output.pop();
    return output;
  }

  const lower = chain(unique);
  const upper = chain(unique.slice().reverse());
  return lower.concat(upper);
}

function minimumAreaRect(hull) {
  if (hull.length < 3) return null;
  let best = null;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const vx = -uy;
    const vy = ux;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const point of hull) {
      const u = point.x * ux + point.y * uy;
      const v = point.x * vx + point.y * vy;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    const edgeAngle = Math.atan2(uy, ux);
    if (
      !best ||
      area < best.area - 1e-6 ||
      (Math.abs(area - best.area) <= 1e-6 && edgeAngle < best.edgeAngle)
    ) {
      best = {
        area,
        edgeAngle,
        corners: [
          { x: ux * minU + vx * minV, y: uy * minU + vy * minV },
          { x: ux * maxU + vx * minV, y: uy * maxU + vy * minV },
          { x: ux * maxU + vx * maxV, y: uy * maxU + vy * maxV },
          { x: ux * minU + vx * maxV, y: uy * minU + vy * maxV },
        ],
      };
    }
  }
  return best ? best.corners : null;
}

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

/**
 * Snap each side of a coarse rectangle to the strongest nearby image gradient
 * and replace the corners with line intersections. Returns null when a side
 * lacks enough gradient support for a stable fit.
 */
function refineQuad(coarse, frame, step, contrast) {
  const radius = Math.max(3, step + 2);
  const magMin = Math.max(30, contrast * 0.75);
  const samples = 16;
  const lines = [];

  for (let side = 0; side < 4; side += 1) {
    const start = coarse[side];
    const end = coarse[(side + 1) % 4];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 8) return null;
    const tx = dx / length;
    const ty = dy / length;
    const nx = -ty;
    const ny = tx;
    const hits = [];

    for (let i = 0; i < samples; i += 1) {
      const t = 0.14 + (0.72 * (i + 0.5)) / samples;
      const baseX = start.x + tx * length * t;
      const baseY = start.y + ty * length * t;
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

    if (hits.length < samples * 0.55) return null;
    const line = fitLine(hits);
    if (!line) return null;
    lines.push(line);
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

function edgeSupport(corners, frame, contrast) {
  const magMin = Math.max(28, contrast * 0.7);
  const samples = 18;
  let supportSum = 0;

  for (let side = 0; side < 4; side += 1) {
    const start = corners[side];
    const end = corners[(side + 1) % 4];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 8) return 0;
    const tx = dx / length;
    const ty = dy / length;
    const nx = -ty;
    const ny = tx;
    let hits = 0;

    for (let i = 0; i < samples; i += 1) {
      const t = 0.12 + (0.76 * (i + 0.5)) / samples;
      const x = start.x + dx * t;
      const y = start.y + dy * t;
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

    const ratio = hits / samples;
    if (ratio < MIN_SIDE_SUPPORT) return 0;
    supportSum += ratio;
  }

  return supportSum / 4;
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

function detectFromComponent(component, labels, grid, frame, bg) {
  const contrast = Math.abs(component.mean - bg);
  if (contrast < MIN_CONTRAST) return null;

  const boundary = componentBoundary(labels, component, grid, frame.width, frame.height);
  if (boundary.length < 8) return null;
  const hull = convexHull(boundary);
  const hullArea = polygonArea(hull);
  const estimatedArea = component.area * grid.step * grid.step;
  if (hullArea < 1) return null;
  // A card silhouette is solid. Sparse noise hulls fail this fill test.
  if (estimatedArea < hullArea * 0.62 || estimatedArea > hullArea * 1.85) return null;

  const coarse = minimumAreaRect(hull);
  if (!coarse) return null;
  const orderedCoarse = orderCorners(coarse);
  if (!orderedCoarse) return null;

  const anchor = cellToImage(
    component.cx,
    component.cy,
    grid.step,
    frame.width,
    frame.height,
  );

  const refined = refineQuad(orderedCoarse, frame, grid.step, contrast);
  if (refined) {
    const orderedRefined = orderCorners(refined);
    const limit = Math.max(8, grid.step * 3);
    if (
      orderedRefined &&
      cornersClose(orderedCoarse, orderedRefined, limit)
    ) {
      const scored = scoreQuad(orderedRefined, frame, contrast, anchor);
      if (scored) return scored;
    }
  }

  return scoreQuad(orderedCoarse, frame, contrast, anchor);
}

/**
 * Detect one card-shaped quadrilateral.
 * @param {{ data: ArrayLike<number>, width: number, height: number }} frame
 * @returns {{ corners: {x:number,y:number}[], confidence: number, aspectRatio: number } | null}
 */
export function detectCard(frame) {
  assertFrame(frame);
  if (frame.width < 32 || frame.height < 32) return null;

  const step = sampleStep(frame.width, frame.height);
  const grid = buildLumaGrid(frame, step);
  if (grid.gridWidth < 12 || grid.gridHeight < 12) return null;

  const { bg, std } = borderStats(grid);
  const threshold = Math.max(MIN_CONTRAST, std * 4 + 12);
  const { labels, components } = labelComponents(grid, threshold, bg);
  const frameArea = frame.width * frame.height;

  let best = null;
  let considered = 0;
  for (const component of components) {
    if (considered >= 4) break;
    if (component.touchesBorder) continue;
    const estimatedArea = component.area * step * step;
    if (estimatedArea < frameArea * 0.012 || estimatedArea > frameArea * 0.8) continue;
    considered += 1;
    const detection = detectFromComponent(component, labels, grid, frame, bg);
    if (!detection) continue;
    if (
      !best ||
      detection.confidence > best.confidence + 1e-9 ||
      (Math.abs(detection.confidence - best.confidence) <= 1e-9 &&
        quadArea(detection.corners) > quadArea(best.corners))
    ) {
      best = detection;
    }
  }
  return best;
}

function normalizePoints(points) {
  let meanX = 0;
  let meanY = 0;
  for (const point of points) {
    meanX += point.x;
    meanY += point.y;
  }
  meanX /= points.length;
  meanY /= points.length;
  let distance = 0;
  for (const point of points) distance += Math.hypot(point.x - meanX, point.y - meanY);
  distance /= points.length;
  if (!Number.isFinite(distance) || distance < 1e-9) return null;
  const scale = Math.SQRT2 / distance;
  return {
    points: points.map((point) => ({
      x: (point.x - meanX) * scale,
      y: (point.y - meanY) * scale,
    })),
    // Maps original homogeneous points into the normalized frame.
    matrix: [scale, 0, -scale * meanX, 0, scale, -scale * meanY, 0, 0, 1],
    inverse: [1 / scale, 0, meanX, 0, 1 / scale, meanY, 0, 0, 1],
  };
}

function multiplyMat3(a, b) {
  const out = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] =
        a[row * 3] * b[col] +
        a[row * 3 + 1] * b[3 + col] +
        a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

function solveLinear(rows, rhs) {
  const size = rhs.length;
  const matrix = rows.map((row, index) => row.concat(rhs[index]));
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    }
    if (Math.abs(matrix[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const swap = matrix[col];
      matrix[col] = matrix[pivot];
      matrix[pivot] = swap;
    }
    const divisor = matrix[col][col];
    for (let colIndex = col; colIndex <= size; colIndex += 1) {
      matrix[col][colIndex] /= divisor;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = matrix[row][col];
      if (factor === 0) continue;
      for (let colIndex = col; colIndex <= size; colIndex += 1) {
        matrix[row][colIndex] -= factor * matrix[col][colIndex];
      }
    }
  }
  return matrix.map((row) => row[size]);
}

/**
 * Row-major 3×3 homography (h22 normalized to 1) mapping src[i] to dst[i].
 * Returns null when either quad is degenerate or the system is singular.
 * @param {{x:number,y:number}[]} src
 * @param {{x:number,y:number}[]} dst
 */
export function computeHomography(src, dst) {
  const source = analyzeQuad(src);
  const destination = analyzeQuad(dst);
  if (!source || !destination) return null;

  const srcNorm = normalizePoints(source.quad);
  const dstNorm = normalizePoints(destination.quad);
  if (!srcNorm || !dstNorm) return null;

  const rows = [];
  const rhs = [];
  for (let i = 0; i < 4; i += 1) {
    const s = srcNorm.points[i];
    const d = dstNorm.points[i];
    rows.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]);
    rhs.push(d.x);
    rows.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]);
    rhs.push(d.y);
  }
  const solved = solveLinear(rows, rhs);
  if (!solved) return null;

  const normalized = [
    solved[0], solved[1], solved[2],
    solved[3], solved[4], solved[5],
    solved[6], solved[7], 1,
  ];
  // dst = inv(Td) * Hn * Ts * src
  const homography = multiplyMat3(
    dstNorm.inverse,
    multiplyMat3(normalized, srcNorm.matrix),
  );
  const scale = homography[8];
  if (!Number.isFinite(scale) || Math.abs(scale) < 1e-12) return null;
  for (let i = 0; i < 9; i += 1) homography[i] /= scale;

  let maxError = 0;
  for (let i = 0; i < 4; i += 1) {
    const mapped = applyHomography(homography, source.quad[i].x, source.quad[i].y);
    if (!mapped) return null;
    maxError = Math.max(
      maxError,
      Math.hypot(mapped.x - destination.quad[i].x, mapped.y - destination.quad[i].y),
    );
    const weight =
      homography[6] * source.quad[i].x +
      homography[7] * source.quad[i].y +
      homography[8];
    if (weight <= 1e-8) return null;
  }
  if (maxError > 1e-4 * Math.max(source.scale, destination.scale)) return null;
  return homography;
}

/**
 * @param {number[]} homography Row-major 3×3 with a finite h22.
 * @returns {{x:number,y:number} | null}
 */
export function applyHomography(homography, x, y) {
  if (!Array.isArray(homography) || homography.length !== 9) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  for (let i = 0; i < 9; i += 1) {
    if (!Number.isFinite(homography[i])) return null;
  }
  const weight = homography[6] * x + homography[7] * y + homography[8];
  if (!Number.isFinite(weight) || Math.abs(weight) < 1e-12) return null;
  const px = (homography[0] * x + homography[1] * y + homography[2]) / weight;
  const py = (homography[3] * x + homography[4] * y + homography[5]) / weight;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return { x: px, y: py };
}

/**
 * Homography from the continuous source rectangle [0, srcWidth] × [0, srcHeight]
 * onto destination corners in TL, TR, BR, BL order (any consistent convex order).
 * Returns null for a degenerate source or destination. This maps geometry only;
 * it does not sample or warp pixel buffers.
 * @returns {number[] | null}
 */
export function mapSourceOntoCorners(srcWidth, srcHeight, corners) {
  if (!Number.isFinite(srcWidth) || !Number.isFinite(srcHeight)) return null;
  if (srcWidth <= 1e-6 || srcHeight <= 1e-6) return null;
  const source = [
    { x: 0, y: 0 },
    { x: srcWidth, y: 0 },
    { x: srcWidth, y: srcHeight },
    { x: 0, y: srcHeight },
  ];
  return computeHomography(source, corners);
}
