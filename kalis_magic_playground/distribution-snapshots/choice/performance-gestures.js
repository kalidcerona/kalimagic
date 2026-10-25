import {
  applyFakeHomeSwipe, applyFakeHomeTap, applyFakeHomeUndo, classifyFakeHomeGesture, fakeHomeDigit,
  isTwoFingerDownSwipe,
} from './logic.js';
import { fakeHomeEl, fakeNotesEl, fakeHomeDots, fakePhone } from './dom.js';
import { syncFakeHomeSurface } from './fake-notes.js';
import { acquireWakeLock, releaseWakeLock } from './wake-lock.js';
import {
  fakeHomeSession, peek, rehearsalSurfaceOpen, leaveRehearsalSurface, vibrateAccepted, endPeek, beginPeek,
  activeFakeHomeGrid, openNotesApp, resetForNextSpectator,
} from './fake-home-surface.js';

const CLICK_GUARD_MS = 150;
const PEEK_MOVE_PX = 10;
const RESET_TAPS = 3;
const RESET_TAP_WINDOW_MS = 1200;
const RESET_CORNER_PX = 56;

let armed = null;
let fakeHomeGesture = null;
let clickGuardUntil = 0;
let readoutCleared = false;
let resetTaps = null;
let cornerDown = null;

function setArmed(value) {
  armed = value;
}

function setFakeHomeGesture(value) {
  fakeHomeGesture = value;
}

function setResetTaps(value) {
  resetTaps = value;
}

function setReadoutCleared(value) {
  readoutCleared = value;
}

// Blur, hiding, resize and touch cancel must never leave a digit on screen or a half-finished touch.
function resetTransientInput() {
  fakeHomeGesture = null;
  cornerDown = null;
  resetTaps = null;
  armed = null;
  clickGuardUntil = 0;
  // Practice digits come back only with the next accepted digit.
  readoutCleared = true;
  endPeek();
}

function finishFakeHomePointer(event, canceled) {
  if (!fakeHomeSession || !fakeHomeGesture || event.pointerId !== fakeHomeGesture.id) return;
  const gesture = fakeHomeGesture;
  fakeHomeGesture = null;
  const motion = {
    dx: event.clientX - gesture.startX,
    dy: event.clientY - gesture.startY,
    ms: event.timeStamp - gesture.startTime,
    canceled: canceled || gesture.canceled
  };
  const kind = classifyFakeHomeGesture(motion);
  const entry = fakeHomeSession.entry;
  let next = entry;
  if (kind === 'left') next = applyFakeHomeSwipe(entry, { digit: gesture.digit, ...motion });
  else if (kind === 'tap') next = applyFakeHomeTap(entry, { digit: gesture.digit, ...motion });
  else if (kind === 'right') next = applyFakeHomeUndo(entry, motion, { noteOpened: fakeHomeSession.numberLocked === true });
  if (next === entry) {
    // Once both digits are in, a tap on the notes app on the third home opens it.
    if (kind === 'tap' && entry.locked === true && fakeHomeSession.page === 2
      && gesture.target?.closest?.('[data-action="notes"]')) {
      clickGuardUntil = Date.now() + CLICK_GUARD_MS;
      openNotesApp();
    }
    return;
  }
  // A swipe or tap can still produce a click on whatever appears under the finger.
  clickGuardUntil = Date.now() + CLICK_GUARD_MS;
  readoutCleared = false;
  fakeHomeSession.entry = next;
  fakeHomeSession.page = next.locked ? 2 : (next.tens == null ? 0 : 1);
  if (kind !== 'right') vibrateAccepted();
  syncFakeHomeSurface();
}

function onFakeHomePointerDown(event) {
  // A new touch is genuine input, never the echo of the previous gesture.
  clickGuardUntil = 0;
  if (!fakeHomeSession || fakeHomeEl.hidden) return;
  if (inResetCorner(event)) {
    cornerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp };
    return;
  }
  if (peek) {
    endPeek();
    return;
  }
  if (fakeHomeGesture) {
    fakeHomeGesture.canceled = true;
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (beginPeek(event)) return;
  const grid = activeFakeHomeGrid();
  let digit = null;
  if (grid) {
    if (grid.contains(event.target)) {
      const rect = grid.getBoundingClientRect();
      digit = fakeHomeDigit(
        { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        event.clientX,
        event.clientY
      );
    } else if (fakePhone?.contains(event.target) && !fakeHomeDots?.contains(event.target)) {
      // Wallpaper and dock count as 0, like the dummy icons. The page dots do not.
      digit = 0;
    } else return;
  } else if (fakeHomeSession.page !== 'notes' || fakeHomeSession.numberLocked || !fakeNotesEl.contains(event.target)) {
    // The notes list only listens for the undo swipe, and only until a note has been opened.
    return;
  }
  fakeHomeGesture = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startTime: event.timeStamp,
    digit,
    target: event.target,
    canceled: false
  };
}

// The reset zone is the top right corner above the icon grid. It never takes digits.
function inResetCorner(event) {
  const frame = fakeHomeEl.querySelector('.fake-home-frame');
  if (!frame) return false;
  const rect = frame.getBoundingClientRect();
  const height = 40;
  return event.clientX >= rect.right - rect.width * 0.32 && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.top + height;
}

function finishCornerTap(event) {
  const down = cornerDown;
  if (!down || down.id !== event.pointerId) return false;
  cornerDown = null;
  const tap = Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 12 && event.timeStamp - down.t <= 400;
  if (!tap) {
    resetTaps = null;
    return true;
  }
  if (resetTaps && event.timeStamp - resetTaps.first <= RESET_TAP_WINDOW_MS) resetTaps.count += 1;
  else resetTaps = { first: event.timeStamp, count: 1 };
  if (resetTaps.count >= RESET_TAPS) {
    resetTaps = null;
    clickGuardUntil = Date.now() + CLICK_GUARD_MS;
    resetForNextSpectator();
  }
  return true;
}

function onFakeHomePointerMove(event) {
  if (!peek || event.pointerId !== peek.id) return;
  if (Math.hypot(event.clientX - peek.x, event.clientY - peek.y) > PEEK_MOVE_PX) endPeek();
}

function onFakeHomePointerUp(event) {
  if (finishCornerTap(event)) return;
  if (peek && event.pointerId === peek.id) endPeek();
  finishFakeHomePointer(event, false);
}

function onFakeHomePointerCancel(event) {
  if (cornerDown && cornerDown.id === event.pointerId) cornerDown = null;
  if (peek && event.pointerId === peek.id) endPeek();
  finishFakeHomePointer(event, true);
}

function rememberTouches(touches) {
  armed = new Map();
  for (const touch of touches) {
    armed.set(touch.identifier, { startY: touch.screenY, lastY: touch.screenY });
  }
}

function gestureMoves() {
  return [...armed.values()].map((record) => record.lastY - record.startY);
}

// While a performance surface is open nothing may lead to editing or a menu. Only the
// two-finger downward swipe above leaves it.
function blockWhilePerforming(event) {
  if (rehearsalSurfaceOpen()) event.preventDefault();
}

function bindPerformanceInput() {
  document.addEventListener('pointerdown', onFakeHomePointerDown);
  document.addEventListener('pointermove', onFakeHomePointerMove);
  document.addEventListener('pointerup', onFakeHomePointerUp);
  document.addEventListener('pointercancel', onFakeHomePointerCancel);

  document.addEventListener('touchstart', (event) => {
    if (!rehearsalSurfaceOpen()) return;
    if (event.touches.length === 2) {
      if (fakeHomeGesture) fakeHomeGesture.canceled = true;
      rememberTouches(event.touches);
    } else armed = null;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!rehearsalSurfaceOpen() || !armed || event.touches.length !== 2) return;
    const moves = [];
    for (const touch of event.touches) {
      const record = armed.get(touch.identifier);
      if (!record) {
        armed = null;
        return;
      }
      record.lastY = touch.screenY;
      moves.push(touch.screenY - record.startY);
    }
    if (moves.length === 2 && moves.every((delta) => delta > 8)) event.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', (event) => {
    if (!rehearsalSurfaceOpen() || !armed) return;
    for (const touch of event.changedTouches) {
      const record = armed.get(touch.identifier);
      if (record) record.lastY = touch.screenY;
    }
    if (armed.size === 2 && isTwoFingerDownSwipe(gestureMoves())) {
      armed = null;
      leaveRehearsalSurface();
      return;
    }
    if (event.touches.length < 2) armed = null;
  }, { passive: true });

  document.addEventListener('touchcancel', resetTransientInput, { passive: true });
  window.addEventListener('blur', resetTransientInput);
  window.addEventListener('pagehide', resetTransientInput);
  window.addEventListener('resize', resetTransientInput);
  document.addEventListener('visibilitychange', () => {
    resetTransientInput();
    if (document.visibilityState === 'visible') acquireWakeLock();
    else releaseWakeLock();
  });

  for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
    document.addEventListener(type, blockWhilePerforming, true);
  }
  document.addEventListener('click', (event) => {
    if (!rehearsalSurfaceOpen() || Date.now() >= clickGuardUntil) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

export {
  readoutCleared, setArmed, setFakeHomeGesture, setResetTaps, setReadoutCleared, bindPerformanceInput,
};
