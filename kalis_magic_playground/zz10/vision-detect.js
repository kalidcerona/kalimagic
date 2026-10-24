// Component labelling, single-component card detection and the colour-split fallback. Moved verbatim from vision.js.
import { centroidOf, convexHull, expandedQuad, minimumAreaRect, orderCorners, polygonArea, quadArea, readQuad } from "./vision-geometry.js";
import { assertFrame, borderStats, buildLumaGrid, cellToImage, differenceGrid, lightForegroundThreshold, lumaAt, sampleStep } from "./vision-sampling.js";
import { MIN_CONTRAST, cornersClose, pointInConvex, refineQuad, scoreQuad } from "./vision-quad.js";
import { besideBorderBody, peelBorderGrip, shortFingerSlab } from "./vision-grip.js";

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
