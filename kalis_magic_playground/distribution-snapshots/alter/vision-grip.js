// Border-grip peeling and finger-slab checks on labelled components. Moved verbatim from vision.js.
import { channelDistance, median, rgbAt } from "./vision-sampling.js";

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

export { besideBorderBody, peelBorderGrip, shortFingerSlab };
