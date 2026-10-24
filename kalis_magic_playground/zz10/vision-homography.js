// Homography solve and mapping of a source rectangle onto card corners. Moved verbatim from vision.js.
import { analyzeQuad } from "./vision-geometry.js";

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
