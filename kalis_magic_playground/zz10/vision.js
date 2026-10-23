/**
 * Card-shaped geometry prototype for a live mobile camera.
 *
 * This module detects one convex card quadrilateral from an RGBA frame,
 * optionally using a stored empty-scene reference. It does not recognize a
 * printed identity, suit, rank, or "card A",
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
 *   grayscale buffer is allocated. The final bright-paper fallback sorts at
 *   most one grid of foreground luminance values (O(N log N), N <= 192²).
 *
 * Limitations:
 *   - Single-frame detection estimates the scene from its border. The stored
 *     empty-scene path supports varied backgrounds. Both paths can separate a
 *     border-touching grip, including a short-edge end grip, from the card.
 *     Strongly warm paper or a grip that covers more than one side can still fail.
 *     A card cut off by the frame is rejected. One covered short edge is not.
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
const MIN_CONTRAST = 18;
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

/** A compact, fixed camera reference. Capture while the stage is empty. */
export function captureBackground(frame) {
  assertFrame(frame);
  const step = sampleStep(frame.width, frame.height);
  const gridWidth = Math.ceil(frame.width / step);
  const gridHeight = Math.ceil(frame.height / step);
  const rgb = new Uint8Array(gridWidth * gridHeight * 3);
  for (let gy = 0; gy < gridHeight; gy += 1) {
    const y = Math.min(frame.height - 1, gy * step);
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const x = Math.min(frame.width - 1, gx * step);
      const src = (y * frame.width + x) * 4;
      const dst = (gy * gridWidth + gx) * 3;
      rgb[dst] = frame.data[src];
      rgb[dst + 1] = frame.data[src + 1];
      rgb[dst + 2] = frame.data[src + 2];
    }
  }
  return { width: frame.width, height: frame.height, step, gridWidth, gridHeight, rgb };
}

function differenceGrid(frame, reference) {
  if (!reference || reference.width !== frame.width || reference.height !== frame.height ||
      reference.step !== sampleStep(frame.width, frame.height)) return null;
  const { gridWidth, gridHeight, step, rgb } = reference;
  const channels = [[], [], []];
  // The outer band is normally empty. Its median shift cancels a camera-wide
  // exposure or white-balance adjustment without learning the inserted card.
  for (let gy = 0; gy < gridHeight; gy += 1) {
    const y = Math.min(frame.height - 1, gy * step);
    for (let gx = 0; gx < gridWidth; gx += 1) {
      if (gx > 1 && gy > 1 && gx < gridWidth - 2 && gy < gridHeight - 2) continue;
      const x = Math.min(frame.width - 1, gx * step);
      const src = (y * frame.width + x) * 4;
      const dst = (gy * gridWidth + gx) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        channels[channel].push(frame.data[src + channel] - rgb[dst + channel]);
      }
    }
  }
  const offset = channels.map(median);
  const luma = new Float64Array(gridWidth * gridHeight);
  const borderNoise = [];
  for (let gy = 0; gy < gridHeight; gy += 1) {
    const y = Math.min(frame.height - 1, gy * step);
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const x = Math.min(frame.width - 1, gx * step);
      const src = (y * frame.width + x) * 4;
      const dst = (gy * gridWidth + gx) * 3;
      let difference = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = frame.data[src + channel] - rgb[dst + channel] - offset[channel];
        difference += Math.abs(delta);
      }
      const value = difference / 3;
      const index = gy * gridWidth + gx;
      luma[index] = value;
      if (gx <= 1 || gy <= 1 || gx >= gridWidth - 2 || gy >= gridHeight - 2) {
        borderNoise.push(value);
      }
    }
  }
  const noise = median(borderNoise);
  return { luma, gridWidth, gridHeight, step, noise };
}

/** Fraction of interior sample cells that differ from a stored scene. */
export function sceneChangeFraction(frame, reference) {
  assertFrame(frame);
  const grid = differenceGrid(frame, reference);
  if (!grid) return 1;
  const threshold = Math.max(20, grid.noise * 3 + 14);
  let changed = 0;
  let total = 0;
  for (let y = 2; y < grid.gridHeight - 2; y += 1) {
    for (let x = 2; x < grid.gridWidth - 2; x += 1) {
      total += 1;
      if (grid.luma[y * grid.gridWidth + x] >= threshold) changed += 1;
    }
  }
  return total ? changed / total : 1;
}

function channelDistance(first, second) {
  return (Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]) +
    Math.abs(first[2] - second[2])) / 3;
}

function rgbAt(frame, x, y) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) return null;
  const offset = (py * frame.width + px) * 4;
  return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]];
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
  const sorted = samples.slice().sort((a, b) => a - b);
  const brightBorder = sorted[Math.floor((sorted.length - 1) * 0.9)];
  return { bg, std, brightBorder };
}

function lightForegroundThreshold(frame, grid, changeThreshold) {
  const values = [];
  for (let y = 0; y < grid.gridHeight; y += 1) {
    for (let x = 0; x < grid.gridWidth; x += 1) {
      if (grid.luma[y * grid.gridWidth + x] < changeThreshold) continue;
      values.push(lumaAt(frame.data, frame.width,
        Math.min(frame.width - 1, x * grid.step), Math.min(frame.height - 1, y * grid.step)));
    }
  }
  values.sort((a, b) => a - b);
  // Recover the bright paper cluster even when the grip has neutral chroma.
  // Keep this local to changed foreground when an empty-scene reference exists.
  // Retain the antialiased off-white rim rather than selecting white highlights only.
  return values.length ? Math.max(110, Math.min(230,
    values[Math.floor((values.length - 1) * 0.95)] * 0.95)) : 255;
}

function labelComponents(grid, threshold, bg, brightOnly = false, frame = null, paleWarm = false,
  paperFloor = 0) {
  const { luma, gridWidth, gridHeight } = grid;
  const count = gridWidth * gridHeight;
  const foreground = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    foreground[i] = (brightOnly ? luma[i] >= threshold : Math.abs(luma[i] - bg) >= threshold) ? 1 : 0;
    if (foreground[i] && frame) {
      const x = Math.min(frame.width - 1, (i % gridWidth) * grid.step);
      const y = Math.min(frame.height - 1, Math.floor(i / gridWidth) * grid.step);
      const offset = (y * frame.width + x) * 4;
      const r = frame.data[offset];
      const g = frame.data[offset + 1];
      const b = frame.data[offset + 2];
      if (lumaAt(frame.data, frame.width, x, y) < paperFloor) foreground[i] = 0;
      // A holding hand joins the card's change silhouette to the frame edge.
      // Split warm foreground away from the paper before fitting its geometry.
      // This is a fallback mask, never a claim that a pixel identifies skin.
      const high = Math.max(r, g, b);
      // Retry pale/desaturated grips separately so the stronger first mask
      // can still retain warm paper. Cream paper with r-g <= 6 survives both.
      const blueGap = paleWarm ? Math.max(12, high * 0.05) : Math.max(26, high * 0.18);
      const greenGap = paleWarm ? Math.max(6, high * 0.025) : Math.max(12, high * 0.07);
      if (r - b > blueGap && r - g > greenGap) {
        foreground[i] = 0;
      }
    }
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

function medianRgb(colors) {
  return [0, 1, 2].map((channel) => median(colors.map((color) => color[channel])));
}

// Drop a grip that is connected to the frame edge when its color differs from
// the far side of the same silhouette. A clipped card is the same material at
// the frame and is left untouched.
function peelBorderGrip(frame, grid, labels, component) {
  const { gridWidth, gridHeight, step } = grid;
  const colorAt = (gx, gy) => {
    const x = Math.min(frame.width - 1, gx * step);
    const y = Math.min(frame.height - 1, gy * step);
    const offset = (y * frame.width + x) * 4;
    return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]];
  };
  const borderCells = [];
  const farColors = [];
  const cells = [];
  let maxBorderDistance = 0;
  for (let gy = component.minY; gy <= component.maxY; gy += 1) {
    for (let gx = component.minX; gx <= component.maxX; gx += 1) {
      const index = gy * gridWidth + gx;
      if (labels[index] !== component.id) continue;
      const borderDistance = Math.min(gx, gy, gridWidth - 1 - gx, gridHeight - 1 - gy);
      if (borderDistance > maxBorderDistance) maxBorderDistance = borderDistance;
      cells.push({ gx, gy, index, borderDistance });
      if (borderDistance === 0) borderCells.push(colorAt(gx, gy));
    }
  }
  if (borderCells.length < 2 || cells.length < 30) return null;
  const farCut = Math.max(3, maxBorderDistance * 0.55);
  for (const cell of cells) {
    if (cell.borderDistance >= farCut) farColors.push(colorAt(cell.gx, cell.gy));
  }
  if (farColors.length < 12) return null;
  const farMedian = medianRgb(farColors);
  let cardLikeBorder = 0;
  for (const color of borderCells) {
    if (channelDistance(color, farMedian) < 5) cardLikeBorder += 1;
  }
  if (cardLikeBorder / borderCells.length > 0.35) return null;
  const borderMedian = medianRgb(borderCells);
  if (channelDistance(borderMedian, farMedian) < 5) return null;

  const drop = new Uint8Array(gridWidth * gridHeight);
  const queue = [];
  const consider = (gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return;
    const index = gy * gridWidth + gx;
    if (labels[index] !== component.id || drop[index]) return;
    if (channelDistance(colorAt(gx, gy), borderMedian) > 4) return;
    drop[index] = 1;
    queue.push(index);
  };
  for (const cell of cells) {
    if (cell.borderDistance === 0) consider(cell.gx, cell.gy);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const gx = index % gridWidth;
    const gy = (index - gx) / gridWidth;
    consider(gx - 1, gy);
    consider(gx + 1, gy);
    consider(gx, gy - 1);
    consider(gx, gy + 1);
  }
  if (!queue.length) return null;
  const keep = new Uint8Array(gridWidth * gridHeight);
  let keepCount = 0;
  for (const cell of cells) {
    if (drop[cell.index]) continue;
    keep[cell.index] = 1;
    keepCount += 1;
  }
  if (keepCount < cells.length * 0.45 || keepCount < 24) return null;

  const nextLabels = new Int32Array(gridWidth * gridHeight);
  const stack = [];
  let best = null;
  let nextId = 1;
  for (let gy = component.minY; gy <= component.maxY; gy += 1) {
    for (let gx = component.minX; gx <= component.maxX; gx += 1) {
      const start = gy * gridWidth + gx;
      if (!keep[start] || nextLabels[start]) continue;
      const componentId = nextId;
      nextId += 1;
      nextLabels[start] = componentId;
      stack.push(start);
      let area = 0;
      let sum = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = gx;
      let maxX = gx;
      let minY = gy;
      let maxY = gy;
      let touchesBorder = false;
      while (stack.length > 0) {
        const index = stack.pop();
        const x = index % gridWidth;
        const y = (index - x) / gridWidth;
        area += 1;
        sum += grid.luma[index];
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === gridWidth - 1 || y === gridHeight - 1) touchesBorder = true;
        if (x > 0 && keep[index - 1] && !nextLabels[index - 1]) {
          nextLabels[index - 1] = componentId;
          stack.push(index - 1);
        }
        if (x + 1 < gridWidth && keep[index + 1] && !nextLabels[index + 1]) {
          nextLabels[index + 1] = componentId;
          stack.push(index + 1);
        }
        if (y > 0 && keep[index - gridWidth] && !nextLabels[index - gridWidth]) {
          nextLabels[index - gridWidth] = componentId;
          stack.push(index - gridWidth);
        }
        if (y + 1 < gridHeight && keep[index + gridWidth] && !nextLabels[index + gridWidth]) {
          nextLabels[index + gridWidth] = componentId;
          stack.push(index + gridWidth);
        }
      }
      if (touchesBorder) continue;
      const candidate = {
        id: componentId,
        area,
        mean: sum / area,
        minX,
        maxX,
        minY,
        maxY,
        touchesBorder: false,
        cx: sumX / area,
        cy: sumY / area,
      };
      if (!best || candidate.area > best.area) best = candidate;
    }
  }
  if (!best) return null;
  return { labels: nextLabels, component: best };
}

// Fingers left by a clipped card are a short solid slab. Apply this only to a
// peeled border remainder, or to a slab sitting on a border-touching body.
// An isolated silhouette, including a small card, is not rejected.
// Geometry only, not a skin classification.
function shortFingerSlab(component, grid) {
  const spanX = component.maxX - component.minX + 1;
  const spanY = component.maxY - component.minY + 1;
  if (component.area < spanX * spanY * 0.85) return false;
  const shortSide = Math.min(spanX, spanY) * grid.step;
  const longSide = Math.max(spanX, spanY) * grid.step;
  if (shortSide < 1 || shortSide >= 72) return false;
  return longSide / shortSide >= 1.65;
}

function componentTone(component, labels, grid, frame) {
  const colors = [];
  const strideX = Math.max(1, Math.ceil((component.maxX - component.minX + 1) / 8));
  const strideY = Math.max(1, Math.ceil((component.maxY - component.minY + 1) / 8));
  for (let y = component.minY; y <= component.maxY; y += strideY) {
    for (let x = component.minX; x <= component.maxX; x += strideX) {
      if (labels[y * grid.gridWidth + x] !== component.id) continue;
      const color = rgbAt(frame, x * grid.step, y * grid.step);
      if (color) colors.push(color);
    }
  }
  return colors.length ? medianRgb(colors) : null;
}

function besideBorderBody(component, components, labels, grid, frame) {
  const gap = 2;
  let tone;
  for (const other of components) {
    if (other.id === component.id || !other.touchesBorder) continue;
    if (component.minX > other.maxX + gap || other.minX > component.maxX + gap) continue;
    if (component.minY > other.maxY + gap || other.minY > component.maxY + gap) continue;
    // Compare live RGB, not difference-grid magnitude, which varies with the room.
    // Proximity to furniture alone is not evidence of a connected hand.
    if (tone === undefined) tone = componentTone(component, labels, grid, frame);
    const bodyTone = componentTone(other, labels, grid, frame);
    if (tone && bodyTone && channelDistance(tone, bodyTone) <= 6) return true;
    // A clipped printed card can separate a differently colored finger band
    // from the wrist. Require the band to sit across the near end of that
    // border body, rather than merely beside a large room panel.
    if (acrossBorderBodyEnd(component, other, labels, grid, gap)) return true;
  }
  return false;
}

function acrossBorderBodyEnd(component, body, labels, grid, gap) {
  const horizontal = component.maxX - component.minX >= component.maxY - component.minY;
  const lo = horizontal ? component.minX : component.minY;
  const hi = horizontal ? component.maxX : component.maxY;
  const bodyLo = horizontal ? body.minX : body.minY;
  const bodyHi = horizontal ? body.maxX : body.maxY;
  const length = hi - lo + 1;
  const bodyLength = bodyHi - bodyLo + 1;
  const overlap = Math.min(hi, bodyHi) - Math.max(lo, bodyLo) + 1;
  if (bodyLength < length * 0.7 || bodyLength > length * 1.6 || overlap < length * 0.7) return false;
  let edge, direction;
  if (horizontal && body.maxY === grid.gridHeight - 1 &&
      body.minY > component.maxY && body.minY <= component.maxY + gap + 1) {
    edge = component.maxY; direction = 1;
  } else if (horizontal && body.minY === 0 &&
      body.maxY < component.minY && body.maxY >= component.minY - gap - 1) {
    edge = component.minY; direction = -1;
  } else if (!horizontal && body.maxX === grid.gridWidth - 1 &&
      body.minX > component.maxX && body.minX <= component.maxX + gap + 1) {
    edge = component.maxX; direction = 1;
  } else if (!horizontal && body.minX === 0 &&
      body.maxX < component.minX && body.maxX >= component.minX - gap - 1) {
    edge = component.minX; direction = -1;
  } else return false;
  let contacts = 0;
  for (let i = 0; i < 8; i += 1) {
    const along = Math.round(lo + (hi - lo) * (i + 0.5) / 8);
    const x = horizontal ? along : edge, y = horizontal ? edge : along;
    if (labels[y * grid.gridWidth + x] !== component.id) continue;
    for (let distance = 1; distance <= gap + 2; distance += 1) {
      const nx = horizontal ? x : x + direction * distance;
      const ny = horizontal ? y + direction * distance : y;
      if (nx < 0 || ny < 0 || nx >= grid.gridWidth || ny >= grid.gridHeight) break;
      if (labels[ny * grid.gridWidth + nx] === body.id) { contacts += 1; break; }
    }
  }
  return contacts >= 5;
}

function detectFromComponent(component, labels, grid, frame, bg, minFill = 0.62, maxContrast = Infinity) {
  // The changed-scene magnitude is not the contrast at a paper/hand edge.
  const contrast = Math.min(maxContrast, Math.abs(component.mean - bg));
  if (contrast < MIN_CONTRAST) return null;

  const boundary = componentBoundary(labels, component, grid, frame.width, frame.height);
  if (boundary.length < 8) return null;
  const hull = convexHull(boundary);
  const hullArea = polygonArea(hull);
  const estimatedArea = component.area * grid.step * grid.step;
  if (hullArea < 1) return null;
  // A card silhouette is solid. Sparse noise hulls fail this fill test.
  if (estimatedArea < hullArea * minFill || estimatedArea > hullArea * 1.85) return null;

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

  const { bg, std, brightBorder } = borderStats(grid);
  const threshold = Math.max(MIN_CONTRAST, std * 4 + 12);
  const primary = labelComponents(grid, threshold, bg);
  const frameArea = frame.width * frame.height;

  function findBest({ labels, components }, minFill, limit, maxContrast = Infinity) {
    let best = null;
    let considered = 0;
    let peelAttempts = 0;
    for (const component of components) {
      if (considered >= limit) break;
      let card = component;
      let cardLabels = labels;
      let peeledBorder = false;
      if (component.touchesBorder) {
        const bulk = component.area * grid.step * grid.step;
        if (peelAttempts >= 3 || bulk < frameArea * 0.02 || bulk > frameArea * 0.85) continue;
        peelAttempts += 1;
        const peeled = peelBorderGrip(frame, grid, labels, component);
        if (!peeled || peeled.component.touchesBorder) continue;
        card = peeled.component;
        cardLabels = peeled.labels;
        peeledBorder = true;
      }
      const estimatedArea = card.area * grid.step * grid.step;
      if (estimatedArea < frameArea * 0.012 || estimatedArea > frameArea * 0.8) continue;
      if (shortFingerSlab(card, grid) && (peeledBorder || besideBorderBody(card, components, labels, grid, frame))) continue;
      considered += 1;
      const detection = detectFromComponent(card, cardLabels, grid, frame, bg, minFill, maxContrast);
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

  const primaryHit = findBest(primary, 0.62, 4);
  if (primaryHit) return primaryHit;

  // A printed face can fragment the bright card region. Try its light
  // silhouette against the brightest part of the surrounding scene.
  const brightThreshold = Math.max(110, Math.min(235, brightBorder + 18));
  const brightHit = findBest(labelComponents(grid, brightThreshold, bg, true), 0.25, 8);
  if (brightHit) return brightHit;

  // A light card can be darker than highlights on a real room's boundary.
  // Try a threshold relative to the median border, while retaining the same
  // geometry and edge checks that reject connected background regions.
  const midThreshold = Math.max(110, Math.min(235, bg + 18));
  if (midThreshold < brightThreshold - 2) {
    const midHit = findBest(labelComponents(grid, midThreshold, bg, true), 0.25, 8);
    if (midHit) return midHit;
  }
  return findBest(labelComponents(grid, 110, bg, true, frame), 0.25, 8, 60) ||
    findBest(labelComponents(grid, 110, bg, true, frame, true), 0.25, 8, 60) ||
    findBest(labelComponents(grid, 110, bg, true, frame, false,
      lightForegroundThreshold(frame, grid, 110)), 0.25, 8, 60);
}

/**
 * Find a newly inserted card against the empty scene captured on camera start.
 * `hint` is the previous raw quad while the card is being tracked. It never relaxes a
 * check; it only enables the colour-split fallback, near where the card last was, for a
 * card that stopped separating from its hand by brightness (backlit paper).
 */
export function detectCardAgainstBackground(frame, reference, hint = null) {
  assertFrame(frame);
  if (frame.width < 32 || frame.height < 32) return null;
  const grid = differenceGrid(frame, reference);
  if (!grid || grid.gridWidth < 12 || grid.gridHeight < 12) return null;
  const threshold = Math.max(18, grid.noise * 3 + 14);
  const frameArea = frame.width * frame.height;
  function findBest({ labels, components }, maxContrast = Infinity) {
    let considered = 0;
    let peelAttempts = 0;
    let best = null;
    for (const component of components) {
      if (considered >= 12) break;
      let card = component;
      let cardLabels = labels;
      let peeledBorder = false;
      if (component.touchesBorder) {
        const bulk = component.area * grid.step * grid.step;
        if (peelAttempts >= 3 || bulk < frameArea * 0.02 || bulk > frameArea * 0.85) continue;
        peelAttempts += 1;
        const peeled = peelBorderGrip(frame, grid, labels, component);
        if (!peeled || peeled.component.touchesBorder) continue;
        card = peeled.component;
        cardLabels = peeled.labels;
        peeledBorder = true;
      }
      const estimatedArea = card.area * grid.step * grid.step;
      if (estimatedArea < frameArea * 0.012 || estimatedArea > frameArea * 0.8) continue;
      if (shortFingerSlab(card, grid) && (peeledBorder || besideBorderBody(card, components, labels, grid, frame))) continue;
      considered += 1;
      const detection = detectFromComponent(card, cardLabels, grid, frame, 0, 0.30, maxContrast);
      if (!detection) continue;
      if (!best || detection.confidence > best.confidence + 1e-9 ||
          (Math.abs(detection.confidence - best.confidence) <= 1e-9 &&
            quadArea(detection.corners) > quadArea(best.corners))) best = detection;
    }
    return best;
  }
  return findBest(labelComponents(grid, threshold, 0, true)) ||
    findBest(labelComponents(grid, threshold, 0, true, frame), 60) ||
    findBest(labelComponents(grid, threshold, 0, true, frame, true), 60) ||
    findBest(labelComponents(grid, threshold, 0, true, frame, false,
      lightForegroundThreshold(frame, grid, threshold)), 60) ||
    detectByColorSplit(frame, grid, threshold, hint);
}

// A backlit card is often darker than the wall and sits on a palm that is
// darker still, so brightness cannot separate paper from hand and the pair
// merges into one square-ish blob. Cluster the changed cells by colour, then
// ask each cluster, on its own, whether it is a card-shaped solid. Every
// geometric and edge check is unchanged, so this only adds candidates.
const SPLIT_CLUSTERS = 4;
const SPLIT_MIN_CELLS = 80;

function skinToneColor(color) {
  return color[0] - color[1] > 22 && color[0] - color[2] > 8;
}

function hintRegion(hint, frame) {
  const quad = readQuad(hint);
  if (!quad) return null;
  const xs = quad.map((point) => point.x);
  const ys = quad.map((point) => point.y);
  const marginX = (Math.max(...xs) - Math.min(...xs)) * 0.4;
  const marginY = (Math.max(...ys) - Math.min(...ys)) * 0.4;
  return {
    quad,
    minX: Math.max(0, Math.min(...xs) - marginX), maxX: Math.min(frame.width, Math.max(...xs) + marginX),
    minY: Math.max(0, Math.min(...ys) - marginY), maxY: Math.min(frame.height, Math.max(...ys) + marginY),
  };
}

function detectByColorSplit(frame, grid, threshold, hint) {
  // Without a recent quad there is nothing to tell a darker card from a darker hand
  // (a neutral finger band splits exactly like backlit paper), so a first sighting
  // keeps using only the checks above.
  const region = hint ? hintRegion(hint, frame) : null;
  return region ? splitAndDetect(frame, grid, threshold, region) : null;
}

function splitAndDetect(frame, grid, threshold, region) {
  const { gridWidth: gw, gridHeight: gh, step } = grid;
  const cells = [];
  const colors = [];
  for (let i = 0; i < gw * gh; i += 1) {
    if (grid.luma[i] < threshold) continue;
    const x = Math.min(frame.width - 1, (i % gw) * step);
    const y = Math.min(frame.height - 1, Math.floor(i / gw) * step);
    if ((x < region.minX || x > region.maxX || y < region.minY || y > region.maxY)) continue;
    const offset = (y * frame.width + x) * 4;
    cells.push(i);
    colors.push([frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]]);
  }
  if (cells.length < SPLIT_MIN_CELLS) return null;
  const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const order = colors.map((_, index) => index).sort((a, b) => luma(colors[a]) - luma(colors[b]));
  let centers = [];
  for (let k = 0; k < SPLIT_CLUSTERS; k += 1) {
    centers.push(colors[order[Math.floor(((k + 0.5) / SPLIT_CLUSTERS) * order.length)]].slice());
  }
  const assign = new Int8Array(cells.length);
  for (let pass = 0; pass < 8; pass += 1) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < cells.length; j += 1) {
      const c = colors[j];
      let best = 0;
      let bestDistance = Infinity;
      for (let k = 0; k < SPLIT_CLUSTERS; k += 1) {
        const d = Math.abs(centers[k][0] - c[0]) + Math.abs(centers[k][1] - c[1]) + Math.abs(centers[k][2] - c[2]);
        if (d < bestDistance) { bestDistance = d; best = k; }
      }
      assign[j] = best;
      sums[best][0] += c[0]; sums[best][1] += c[1]; sums[best][2] += c[2]; sums[best][3] += 1;
    }
    centers = sums.map((sum, k) => (sum[3] ? [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]] : centers[k]));
  }
  const frameArea = frame.width * frame.height;
  let best = null;
  for (let k = 0; k < SPLIT_CLUSTERS; k += 1) {
    if (skinToneColor(centers[k])) continue;
    // Cells outside this cluster read as zero so the shared labeller sees only its mask,
    // while component contrast still comes from the real difference grid.
    const masked = new Float64Array(gw * gh);
    let count = 0;
    for (let j = 0; j < cells.length; j += 1) {
      if (assign[j] !== k) continue;
      masked[cells[j]] = grid.luma[cells[j]];
      count += 1;
    }
    if (count < SPLIT_MIN_CELLS * 0.5) continue;
    const { labels, components } = labelComponents(
      { luma: masked, gridWidth: gw, gridHeight: gh, step }, threshold, 0, true);
    for (const component of components.slice(0, 2)) {
      if (component.touchesBorder) continue;
      const area = component.area * step * step;
      if (area < frameArea * 0.012 || area > frameArea * 0.8) continue;
      if (shortFingerSlab(component, grid)) continue;
      const detection = detectFromComponent(component, labels, grid, frame, 0, 0.30, 60);
      if (!detection) continue;
      if (!pointInConvex(centroidOf(detection.corners), expandedQuad(region.quad, 1.4))) continue;
      if (!best || detection.confidence > best.confidence) best = detection;
    }
  }
  return best;
}

function centroidOf(corners) {
  return {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  };
}

function expandedQuad(corners, scale) {
  const center = centroidOf(corners);
  return corners.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  }));
}

function distanceToQuadEdge(x, y, corners) {
  let min = Infinity;
  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;
    const distance = Math.abs(dx * (a.y - y) - dy * (a.x - x)) / length;
    if (distance < min) min = distance;
  }
  return min;
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


// Paper next to a hand: a slightly inset quad must not turn the card's own rim
// into "hand". The card's colour is read from this frame's quad interior, then
// excluded from seeds and from the flood.
const PAPER_TOLERANCE = 14;
const PAPER_CHROMA_TOLERANCE = 8;
const MAX_HAND_FRACTION = 0.3;

function estimatePaperTone(frame, quad, inside, gw, gh, step) {
  const center = quad.reduce((sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }), { x: 0, y: 0 });
  const core = quad.map((point) => ({
    x: center.x + (point.x - center.x) * 0.7,
    y: center.y + (point.y - center.y) * 0.7,
  }));
  const bins = new Map();
  let total = 0;
  for (let i = 0; i < inside.length; i += 2) {
    if (!inside[i]) continue;
    const x = (i % gw) * step;
    const y = Math.floor(i / gw) * step;
    if (!pointInConvex({ x, y }, core)) continue;
    const offset = (Math.min(frame.height - 1, y) * frame.width + Math.min(frame.width - 1, x)) * 4;
    const key = `${frame.data[offset] >> 4},${frame.data[offset + 1] >> 4},${frame.data[offset + 2] >> 4}`;
    const entry = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    entry.count += 1;
    entry.r += frame.data[offset];
    entry.g += frame.data[offset + 1];
    entry.b += frame.data[offset + 2];
    bins.set(key, entry);
    total += 1;
  }
  if (total < 12) return null;
  let best = null;
  for (const entry of bins.values()) if (!best || entry.count > best.count) best = entry;
  // A card mostly hidden by a hand has no dominant paper colour to learn.
  if (best.count < total * 0.3) return null;
  return [best.r / best.count, best.g / best.count, best.b / best.count];
}

/** True when `color` is the card's own paper, within lighting variation across the card. */
function matchesPaper(color, paper) {
  if (!paper) return false;
  if (Math.abs(color[0] - paper[0]) > PAPER_TOLERANCE || Math.abs(color[1] - paper[1]) > PAPER_TOLERANCE ||
      Math.abs(color[2] - paper[2]) > PAPER_TOLERANCE) return false;
  return Math.abs((color[0] - color[2]) - (paper[0] - paper[2])) <= PAPER_CHROMA_TOLERANCE;
}

function smoothStep(value) {
  const t = value < 0 ? 0 : value > 1 ? 1 : value;
  return t * t * (3 - 2 * t);
}

/** Preserve changed foreground connected across a card edge, including neutral grips.
 * Color similarity is local evidence, not identity/skin recognition. Static room
 * pixels are excluded by the empty-scene reference; disconnected printed artwork
 * cannot seed a hole. The returned alpha mask is in the replacement's own plane.
 * A false hole shows the real card, so every doubtful case stays opaque: a seed must be
 * connected outward (away from the quad) in one non-card colour, which lighting changes along
 * the paper's own edge never are; a flood never takes a cell nearer the paper's colour than the
 * hand's; and holes that are only weakly connected outward are dropped when they pass 30% of the card.
 * Alpha is continuous along a hole edge (bilinear coverage of the 3px cell grid).
 */
export function cardOcclusionMask(frame, corners, reference = null, width = 120, height = 168) {
  assertFrame(frame);
  const quad = readQuad(corners);
  const h = quad && mapSourceOntoCorners(width, height, quad);
  if (!h) return null;
  const step = sampleStep(frame.width, frame.height);
  const gw = Math.ceil(frame.width / step), gh = Math.ceil(frame.height / step);
  const inside = new Uint8Array(gw * gh), removed = new Uint8Array(gw * gh), ambiguous = new Uint8Array(gw * gh);
  const handOutside = new Uint8Array(gw * gh);
  const changed = reference ? differenceGrid(frame, reference) : null;
  const threshold = changed ? Math.max(18, changed.noise * 3 + 14) : 0;
  const pixel = i => (Math.min(frame.height - 1, Math.floor(i / gw) * step) * frame.width +
    Math.min(frame.width - 1, (i % gw) * step)) * 4;
  for (let i = 0; i < inside.length; i += 1) {
    inside[i] = pointInConvex({ x: (i % gw) * step, y: Math.floor(i / gw) * step }, quad) ? 1 : 0;
  }
  const cardCells = inside.reduce((sum,value) => sum + value, 0);
  const paper = estimatePaperTone(frame, quad, inside, gw, gh, step);
  const colorAt = i => { const p = pixel(i); return [frame.data[p], frame.data[p+1], frame.data[p+2]]; };
  // A hand can be darker and pinker than the paper without being "warm" in absolute terms.
  const warmerThanPaper = c => Boolean(paper) &&
    (c[0] - c[2]) - (paper[0] - paper[2]) >= 14 && (c[0] - c[1]) - (paper[0] - paper[1]) >= 8;
  const seen = new Int32Array(gw * gh);
  let stamp = 0;
  function outwardReach(from, color) {
    stamp += 1;
    const queue = [from];
    seen[from] = stamp;
    let dist = 0;
    for (let head = 0; head < queue.length && queue.length < 80; head += 1) {
      const at = queue[head], ax = at % gw, ay = Math.floor(at / gw);
      dist = Math.max(dist, distanceToQuadEdge(ax * step, ay * step, quad));
      for (const [nx,ny] of [[ax-1,ay],[ax+1,ay],[ax,ay-1],[ax,ay+1]]) {
        if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
        const next = ny * gw + nx;
        if (seen[next] === stamp || inside[next] || (changed && changed.luma[next] < threshold)) continue;
        const p = pixel(next);
        if (color.some((c,ch) => Math.abs(frame.data[p+ch] - c) > 18)) continue;
        seen[next] = stamp;
        queue.push(next);
      }
    }
    return { dist, size: queue.length };
  }
  const weakCells = [];
  // Only an exterior foreground sample adjacent to the card can seed occlusion.
  for (let i = 0; i < inside.length; i += 1) {
    if (inside[i] || removed[i]) continue;
    const x = i % gw, y = Math.floor(i / gw);
    if (![[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([nx,ny]) =>
      nx >= 0 && nx < gw && ny >= 0 && ny < gh && inside[ny * gw + nx])) continue;
    if (changed ? changed.luma[i] < threshold : !warmGripPixel(frame, x * step, y * step)) continue;
    const seed = pixel(i), color = [frame.data[seed], frame.data[seed+1], frame.data[seed+2]];
    const luminance = .299 * color[0] + .587 * color[1] + .114 * color[2];
    const neutralGrip = luminance >= 120 && luminance <= 220 && Math.max(...color) - Math.min(...color) <= 35;
    const warm = warmGripPixel(frame, x * step, y * step) || warmerThanPaper(color);
    if (!neutralGrip && !warm) continue;
    // A fitting error of a pixel or two must not mistake the paper rim, or a lit edge band
    // of the paper, for a finger. A real hand is connected OUTWARD: the same changed,
    // non-card colour keeps going away from the quad. Paper along the edge never does.
    const reach = outwardReach(i, color);
    if (reach.dist < 4 * step) continue;
    if (matchesPaper(color, paper) && reach.dist < 6 * step) continue;
    const strong = reach.dist >= 6 * step && reach.size >= 12;
    // A hand that wears the paper colour means the interior mode learned the hand, not the card.
    const bound = paper && Math.max(...color.map((c, ch) => Math.abs(c - paper[ch]))) > 8 ? paper : null;
    handOutside[i] = 1;
    const queue = [i]; removed[i] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head], ax = at % gw, ay = Math.floor(at / gw);
      for (const [nx,ny] of [[ax-1,ay],[ax+1,ay],[ax,ay-1],[ax,ay+1]]) {
        if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
        const next = ny * gw + nx;
        if (removed[next] || ambiguous[next] || (!inside[next] && next !== i)) continue;
        const p = pixel(next);
        // Neutral grips have little chroma evidence. Match both luminance and
        // channel differences tightly rather than absorbing similarly lit paper.
        const tolerance = neutralGrip ? 6 : 18;
        if (color.some((c,ch) => Math.abs(frame.data[p+ch] - c) > tolerance)) continue;
        if (neutralGrip && Math.abs((frame.data[p] - frame.data[p+2]) - (color[0] - color[2])) > 6) continue;
        // Never take a cell that is closer to the card's paper than to the hand.
        if (bound && Math.max(0, ...color.map((c, ch) => Math.abs(frame.data[p+ch] - bound[ch]))) <=
          Math.max(...color.map((c, ch) => Math.abs(frame.data[p+ch] - c)))) continue;
        removed[next] = 1; queue.push(next);
      }
    }
    // A broad end grip can cover more than a narrow pinch and still stay on
    // one edge. Trim only the part that reaches the card center, and reject a
    // flood that still covers most of the card.
    const shortSide = Math.min(
      Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y),
      Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y),
    );
    if (strong) continue;
    // Only a weakly outward-connected flood is doubted: trim the part that reaches the card
    // centre and reject one that still covers most of the card. A large grip whose hand
    // visibly continues away from the card is kept as a hole; painting the card over a real
    // hand is worse than the rare mis-segmentation.
    const depthLimit = shortSide * 0.47;
    let keptInterior = 0;
    for (const at of queue) {
      if (!inside[at]) continue;
      const gx = at % gw;
      const gy = Math.floor(at / gw);
      if (distanceToQuadEdge(gx * step, gy * step, quad) > depthLimit) {
        removed[at] = 0;
        ambiguous[at] = 1;
      } else keptInterior += 1;
    }
    if (keptInterior > cardCells * 0.42) {
      for (const at of queue) {
        if (inside[at]) { removed[at] = 0; ambiguous[at] = 1; }
      }
    } else for (const at of queue) if (inside[at] && removed[at]) weakCells.push(at);
  }
  // Weakly connected holes covering this much of the card are a mis-segmentation.
  let weakCount = 0;
  for (const at of weakCells) if (removed[at]) weakCount += 1;
  if (weakCount > cardCells * MAX_HAND_FRACTION) for (const at of weakCells) { removed[at] = 0; ambiguous[at] = 1; }
  // A one-cell sliver reaching into the card is noise, not a finger.
  for (let i = 0; i < removed.length; i += 1) {
    if (!removed[i] || !inside[i]) continue;
    const x = i % gw, y = Math.floor(i / gw);
    let linked = 0;
    for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
      const next = ny * gw + nx;
      if (removed[next] || handOutside[next]) linked += 1;
    }
    if (linked < 2) removed[i] = 2;
  }
  let handCells = 0;
  for (let i = 0; i < removed.length; i += 1) {
    if (removed[i] === 2) removed[i] = 0;
    else if (removed[i] && inside[i]) handCells += 1;
  }
  const data = new Uint8ClampedArray(width * height * 4);
  // Only cells inside the card count: the hand outside it is not drawn over anyway, and its
  // coverage would otherwise feather into the paper along the whole shared edge.
  const covered = (gx, gy) => (gx >= 0 && gx < gw && gy >= 0 && gy < gh && removed[gy * gw + gx] && inside[gy * gw + gx] ? 1 : 0);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    data[i] = data[i+1] = data[i+2] = 255;
    if (!handCells) { data[i+3] = 255; continue; }
    const point = applyHomography(h, x + .5, y + .5);
    const fx = point.x / step, fy = point.y / step;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const coverage = (covered(x0, y0) * (1 - tx) + covered(x0 + 1, y0) * tx) * (1 - ty) +
      (covered(x0, y0 + 1) * (1 - tx) + covered(x0 + 1, y0 + 1) * tx) * ty;
    // Starts a little before the cell edge so the grip's antialiasing stays in the live feed.
    data[i+3] = Math.round(255 * (1 - smoothStep((coverage - 0.12) / 0.5)));
  }
  return { width, height, data };
}

/**
 * Cheap check, while detection is briefly lost, that a held quad still has something card-like
 * in it. Two independent signals, both over the quad's inner 70%:
 * `changed` = share of cells that differ from the empty scene (the card or a hand is there),
 * `tone` = share that still match the learned paper colour (it is the card, not just a hand).
 * Either signal is skipped when it cannot be computed; with neither, nothing is verifiable
 * and the answer is false. A blurred or briefly undetectable card passes; an empty
 * background or a bare hand does not.
 */
export function heldCardEvidence(frame, corners, reference = null, paperColor = null) {
  assertFrame(frame);
  const quad = readQuad(corners);
  if (!quad) return null;
  const center = quad.reduce((sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }), { x: 0, y: 0 });
  const core = quad.map((point) => ({
    x: center.x + (point.x - center.x) * 0.7,
    y: center.y + (point.y - center.y) * 0.7,
  }));
  const step = sampleStep(frame.width, frame.height);
  const diff = reference ? differenceGrid(frame, reference) : null;
  const threshold = diff ? Math.max(18, diff.noise * 3 + 14) : 0;
  let cells = 0, changed = 0, tone = 0, skin = 0;
  const gw = Math.ceil(frame.width / step), gh = Math.ceil(frame.height / step);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const x = Math.min(frame.width - 1, gx * step), y = Math.min(frame.height - 1, gy * step);
      if (!pointInConvex({ x, y }, core)) continue;
      cells += 1;
      if (diff && diff.luma[gy * gw + gx] >= threshold) changed += 1;
      const o = (y * frame.width + x) * 4;
      const r = frame.data[o], g = frame.data[o + 1], b = frame.data[o + 2];
      // Same two skin rules as the paper sampler: bright warm skin, and the dim pink cast of a backlit palm.
      const skinLike = (r > g + 10 && r > b + 18) || (r - g > 14 && r - b > 4);
      if (skinLike) skin += 1;
      if (paperColor && !skinLike && Math.abs(r - paperColor[0]) <= 18 && Math.abs(g - paperColor[1]) <= 18 &&
          Math.abs(b - paperColor[2]) <= 18) tone += 1;
    }
  }
  if (cells < 12) return null;
  return { changed: diff ? changed / cells : null, tone: paperColor ? tone / cells : null, skin: skin / cells };
}

export function heldCardPresent(frame, corners, reference = null, paperColor = null) {
  const evidence = heldCardEvidence(frame, corners, reference, paperColor);
  if (!evidence || (evidence.changed == null && evidence.tone == null)) return false;
  if (evidence.changed != null && evidence.changed < 0.5) return false;
  // A hand left in the quad is changed and may even sit near the paper's brightness: reject skin.
  if (evidence.skin >= 0.35) return false;
  if (evidence.tone != null && evidence.tone < 0.05) return false;
  return true;
}
