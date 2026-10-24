// Quad analysis, corner order, convex hull, minimum-area rectangle and small quad helpers. Moved verbatim from vision.js.

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

export { analyzeQuad, centroidOf, clamp01, convexHull, distanceToQuadEdge, expandedQuad, isPlainObject, minimumAreaRect, polygonArea, readQuad };
