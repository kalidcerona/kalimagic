// Settings swipe, input repeat, and performance corner zones.

import { LIMITS } from "./logic-limits.js";

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function reduceInput(state, kind, now, minInterval = LIMITS.inputIntervalMs) {
  const previous =
    state && typeof state.at === "number" && typeof state.kind === "string"
      ? state
      : null;
  if (typeof now !== "number" || !Number.isFinite(now) || typeof kind !== "string" || kind === "") {
    return { accept: false, state: previous };
  }
  if (previous && previous.kind === kind && now - previous.at < minInterval) {
    return { accept: false, state: previous };
  }
  return { accept: true, state: { kind, at: now } };
}

export function classifySettingsSwipe(fingers) {
  if (!Array.isArray(fingers) || fingers.length !== 2) return { type: "none" };
  const ok = fingers.every((finger) => {
    if (!finger || !Number.isFinite(finger.dx) || !Number.isFinite(finger.dy)) return false;
    return finger.dy >= LIMITS.settingsSwipePx && Math.abs(finger.dx) <= finger.dy;
  });
  return { type: ok ? "open-settings" : "none" };
}

export function performanceZones(width, height, safe = {}) {
  const left = positiveFinite(safe.left);
  const right = positiveFinite(safe.right);
  const bottom = positiveFinite(safe.bottom);
  const viewW = positiveFinite(width);
  const viewH = positiveFinite(height);
  const innerW = Math.max(0, viewW - left - right);
  const innerH = Math.max(0, viewH - bottom);
  let zoneW = LIMITS.zoneWidth;
  let zoneH = LIMITS.zoneHeight;
  if (innerW < zoneW * 2) zoneW = Math.floor(innerW / 2);
  if (innerH < zoneH) zoneH = Math.floor(innerH);
  zoneW = Math.max(0, zoneW);
  zoneH = Math.max(0, zoneH);
  const y = Math.max(0, viewH - bottom - zoneH);
  return {
    reveal: { x: viewW - right - zoneW, y, w: zoneW, h: zoneH },
    reset: { x: left, y, w: zoneW, h: zoneH },
  };
}

function contains(rect, x, y) {
  if (!rect || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

export function classifyZoneTap(x, y, zones) {
  if (!zones) return "none";
  const inReveal = contains(zones.reveal, x, y);
  const inReset = contains(zones.reset, x, y);
  if (inReveal && inReset) return "none";
  if (inReveal) return "reveal";
  if (inReset) return "reset";
  return "none";
}
