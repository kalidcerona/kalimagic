// Paper tone, hand occlusion mask and held-card evidence. Moved verbatim from vision.js.
import { distanceToQuadEdge, readQuad } from "./vision-geometry.js";
import { assertFrame, differenceGrid, sampleStep } from "./vision-sampling.js";
import { pointInConvex, warmGripPixel } from "./vision-quad.js";
import { applyHomography, mapSourceOntoCorners } from "./vision-homography.js";

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
