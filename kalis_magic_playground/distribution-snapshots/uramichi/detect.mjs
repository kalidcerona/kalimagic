import * as C from './core.mjs';
import { $ } from './dom.mjs';

// ---------- detection display ----------
const BRACKET_GRACE_MS = 300, CHIP_GRACE_MS = 1000;
let lastRaw = null, lastCorners = null, lastSeen = 0, chipTimer = 0, bracketTimer = 0;
function hideChip(now = false) {
  if (now) { lastRaw = null; lastCorners = null; }
  $('chips').hidden = true;
  drawBrackets();
}
function onDetect(raw, corners) {
  if (!raw) return;
  lastRaw = raw;
  lastCorners = corners || null;
  lastSeen = performance.now();
  $('chipText').textContent = C.chipLabel(raw);
  $('chips').hidden = false;
  drawBrackets();
  clearTimeout(chipTimer); clearTimeout(bracketTimer);
  bracketTimer = setTimeout(() => { lastCorners = null; drawBrackets(); }, BRACKET_GRACE_MS);
  chipTimer = setTimeout(() => { lastRaw = null; hideChip(); }, CHIP_GRACE_MS);
}
const canvas = $('brackets');
function sizeCanvas() {
  const r = canvas.getBoundingClientRect();
  const fw = $('feed').offsetWidth, fh = $('feed').offsetHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(fw * dpr));
  canvas.height = Math.max(1, Math.round(fh * dpr));
  void r;
  drawBrackets();
}
function drawBrackets() {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const video = $('video');
  if (!lastCorners || lastCorners.length < 4 || !video.videoWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const fw = $('feed').offsetWidth, fh = $('feed').offsetHeight;
  const s = Math.max(fw / video.videoWidth, fh / video.videoHeight);
  const ox = (fw - video.videoWidth * s) / 2, oy = (fh - video.videoHeight * s) / 2;
  const pts0 = lastCorners.map((p) => ({ x: (p.x * s + ox) * dpr, y: (p.y * s + oy) * dpr }));
  const cx = pts0.reduce((n, p) => n + p.x, 0) / pts0.length, cy = pts0.reduce((n, p) => n + p.y, 0) / pts0.length;
  const pts = pts0.map((p) => ({ x: cx + (p.x - cx) * 1.1, y: cy + (p.y - cy) * 1.1 }));
  const unit = (parseFloat(getComputedStyle($('chrome')).getPropertyValue('--u')) || 0.45) * dpr;
  ctx.strokeStyle = '#fff8e7';
  ctx.lineWidth = 5 * unit;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((c, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length], next = pts[(i + 1) % pts.length];
    const toward = (o) => {
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (!d) return c;
      const len = Math.min(34 * unit, d * 0.22);
      return { x: c.x + (o.x - c.x) / d * len, y: c.y + (o.y - c.y) / d * len };
    };
    const a = toward(prev), b = toward(next);
    ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineTo(b.x, b.y);
  });
  ctx.stroke();
}

export {
  hideChip,
  onDetect,
  sizeCanvas,
  lastRaw,
};
