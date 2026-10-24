// Frame validation, the luma grid, the empty-scene difference grid and border statistics. Moved verbatim from vision.js.
import { isPlainObject } from "./vision-geometry.js";

const MAX_GRID_SIDE = 192;

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

export { assertFrame, borderStats, buildLumaGrid, cellToImage, channelDistance, differenceGrid, lightForegroundThreshold, lumaAt, median, rgbAt, sampleStep };
