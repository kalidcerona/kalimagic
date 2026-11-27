// Two-finger settings swipe and the one-time gesture guide.

import { classifySettingsSwipe } from "./logic.js";
import {
  GUIDE_KEY,
  CLICK_SUPPRESS_MS,
  STORAGE_FAIL,
  statusNode,
  session,
} from "./contacts-state.js";
import { performanceOpen, setStatus, showScreen } from "./contacts-screen.js";

let guideShown = false;

let suppressClick = false;
let suppressTimer = 0;
const pointers = new Map();
const touches = new Map();
let peakPointers = 0;
let gestureRejected = false;
let touchRejected = false;

function showGestureGuideOnce() {
  if (guideShown) return;
  try {
    if (window.localStorage.getItem(GUIDE_KEY) === "1") return;
  } catch {
    // The guide still appears once in this session when storage is unavailable.
  }
  guideShown = true;
  const guide = document.createElement("div");
  guide.className = "gesture-guide";
  guide.innerHTML = `<div class="gesture-guide-card" role="dialog" aria-modal="true" aria-labelledby="gesture-guide-title" aria-describedby="gesture-guide-text">
    <div class="gesture-guide-motion" aria-hidden="true"><span></span><span></span></div>
    <h2 id="gesture-guide-title">설정으로 돌아가기</h2>
    <p id="gesture-guide-text">공연 화면에서 손가락 두 개를 화면에 대고 아래로 쓸어내리세요.</p>
    <button type="button">알겠습니다</button>
  </div>`;
  document.body.append(guide);
  const button = guide.querySelector("button");
  button.addEventListener("click", () => {
    guide.remove();
    try { window.localStorage.setItem(GUIDE_KEY, "1"); } catch {}
  }, { once: true });
  button.focus();
}

function armClickSuppression() {
  suppressClick = true;
  window.clearTimeout(suppressTimer);
  suppressTimer = window.setTimeout(() => {
    suppressClick = false;
  }, CLICK_SUPPRESS_MS);
}

function openSettings() {
  if (!performanceOpen()) return;
  armClickSuppression();
  showScreen("settings");
  if (statusNode.textContent === STORAGE_FAIL) return;
  setStatus(`열람 횟수는 ${session.clickState.clickCount}입니다.`);
}

function swipeFingers() {
  const fingers = [];
  for (const point of pointers.values()) {
    fingers.push({ dx: point.x - point.x0, dy: point.y - point.y0 });
  }
  return fingers;
}

function rebaseOrigins(points) {
  for (const point of points.values()) {
    point.x0 = point.x;
    point.y0 = point.y;
  }
}

function onPointerDown(event) {
  if (!performanceOpen()) return;
  if (event.pointerType === "mouse") return;
  pointers.set(event.pointerId, {
    x0: event.clientX,
    y0: event.clientY,
    x: event.clientX,
    y: event.clientY,
  });
  peakPointers = Math.max(peakPointers, pointers.size);
  if (pointers.size > 2) {
    gestureRejected = true;
    return;
  }
  // Travel before the second finger lands does not count toward the 96px rule.
  if (pointers.size === 2 && !gestureRejected) rebaseOrigins(pointers);
}

function onPointerMove(event) {
  const point = pointers.get(event.pointerId);
  if (!point || !performanceOpen()) return;
  point.x = event.clientX;
  point.y = event.clientY;
  if (gestureRejected || pointers.size !== 2) return;
  const fingers = swipeFingers();
  const downward = fingers.every((finger) => finger.dy > 0 && Math.abs(finger.dx) <= finger.dy);
  if (downward && event.cancelable) event.preventDefault();
  if (classifySettingsSwipe(fingers).type === "open-settings") openSettings();
}

function onPointerEnd(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (pointers.size > 0) return;
  if (peakPointers >= 2) armClickSuppression();
  peakPointers = 0;
  gestureRejected = false;
}

function onPointerCancel(event) {
  pointers.delete(event.pointerId);
  rebaseOrigins(pointers);
  gestureRejected = pointers.size > 2;
  if (pointers.size > 0) return;
  if (peakPointers >= 2) armClickSuppression();
  peakPointers = 0;
  gestureRejected = false;
}

function onTouchStart(event) {
  if (!performanceOpen()) {
    touches.clear();
    return;
  }
  if (event.touches.length > 2) {
    touches.clear();
    touchRejected = true;
    return;
  }
  const live = new Set();
  for (const touch of Array.from(event.touches)) {
    live.add(touch.identifier);
    const point = touches.get(touch.identifier) || {
      x0: touch.clientX,
      y0: touch.clientY,
      x: touch.clientX,
      y: touch.clientY,
    };
    point.x = touch.clientX;
    point.y = touch.clientY;
    touches.set(touch.identifier, point);
  }
  for (const id of touches.keys()) {
    if (!live.has(id)) touches.delete(id);
  }
  if (event.touches.length === 2 && !touchRejected) rebaseOrigins(touches);
}

function onTouchMove(event) {
  if (!performanceOpen() || touchRejected || event.touches.length !== 2 || touches.size !== 2) return;
  for (const touch of Array.from(event.touches)) {
    const point = touches.get(touch.identifier);
    if (!point) return;
    point.x = touch.clientX;
    point.y = touch.clientY;
  }
  const fingers = Array.from(touches.values(), (point) => ({
    dx: point.x - point.x0,
    dy: point.y - point.y0,
  }));
  const coordinatedDownward = fingers.every((finger) => finger.dy > 0 && Math.abs(finger.dx) <= finger.dy)
    && Math.abs(fingers[0].dx - fingers[1].dx) <= 24
    && Math.abs(fingers[0].dy - fingers[1].dy) <= 24;
  if (coordinatedDownward && event.cancelable) event.preventDefault();
  if (classifySettingsSwipe(fingers).type === "open-settings") openSettings();
}

function onTouchEnd() {
  touches.clear();
  touchRejected = false;
}

function onTouchCancel() {
  touches.clear();
  touchRejected = false;
}

function onSwallowClick(event) {
  if (!suppressClick) return;
  suppressClick = false;
  window.clearTimeout(suppressTimer);
  event.preventDefault();
  event.stopPropagation();
}

export {
  showGestureGuideOnce,
  openSettings,
  onSwallowClick,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onPointerCancel,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
};
