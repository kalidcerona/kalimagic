import { updateHold } from "./logic.js";
import { performanceScreen, pointOnButton, settingsVisible } from "./dom.js";
import { stopVibration } from "./vibration.js";
import { setLiveContact, showReadyFeedback } from "./stage.js";
import { recorderThemes } from "./controller-themes.js";
import { applyRelease, startHold, cancelUnsettledHold } from "./controller-hold.js";
import { needsHapticPreparation, refreshHapticPreparation } from "./controller-haptic.js";
import { openSettings } from "./controller-screens.js";
import { unlockFromGesture } from "./controller-attempts.js";
import {
  hold, settled, activePointerId, holdPointerId, readyPointerId, primerPointerId, gestureConsumed,
  readyFeedbackShown, pointers, setHold, setActivePointerId, setHoldPointerId, setReadyPointerId,
  setPrimerPointerId, setGestureConsumed, setReadyFeedbackShown,
} from "./controller-state.js";

const SWIPE_DOWN_PX = 96;

function forgetPointer(pointerId) {
  pointers.delete(pointerId);
  if (pointerId === activePointerId) setActivePointerId(null);
  if (pointers.size < 2) setGestureConsumed(false);
}

function maybeOpenFromSwipe() {
  if (gestureConsumed || settingsVisible() || pointers.size !== 2) return;
  const contacts = [...pointers.values()];
  if (contacts.some((contact) => contact.startedOnButton)) return;
  const bothOutside = contacts.every((contact) => !pointOnButton(contact.x, contact.y, null));
  if (!bothOutside) return;
  const bothDown = contacts.every((contact) => {
    const dx = contact.x - contact.startX;
    const dy = contact.y - contact.startY;
    return dy >= SWIPE_DOWN_PX && dy > Math.abs(dx);
  });
  if (!bothDown) return;
  setGestureConsumed(true);
  openSettings();
}

function onPointerDown(event) {
  if (performanceScreen.hidden || settingsVisible()) return;
  if (event.cancelable) event.preventDefault();
  const onButton = pointOnButton(event.clientX, event.clientY, event.target);
  pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    startedOnButton: onButton,
    pointerType: event.pointerType,
  });
  // Travel before the second finger lands does not count toward the 96px rule.
  if (pointers.size === 2 && [...pointers.values()].every((contact) => contact.pointerType === 'touch')) {
    for (const contact of pointers.values()) {
      contact.startX = contact.x;
      contact.startY = contact.y;
    }
  }
  try {
    performanceScreen.setPointerCapture(event.pointerId);
  } catch {
    /* Capture can fail if the pointer already ended. */
  }
  unlockFromGesture();
  // Loading blocks only the contact pad; outside pointers still open settings.
  if (onButton && performanceScreen.dataset.recorderLoading === "true") return;
  // Touch activation occurs at lift, not down. Preparation never counts an attempt.
  if (needsHapticPreparation()) {
    if (onButton && pointers.size === 1) { setPrimerPointerId(event.pointerId); recorderThemes.setPressed(true); }
    refreshHapticPreparation();
    return;
  }
  refreshHapticPreparation();
  if (!onButton && !readyFeedbackShown && holdPointerId == null) {
    setReadyFeedbackShown(true);
    setReadyPointerId(event.pointerId);
    showReadyFeedback();
  }
  if (pointers.size > 1) {
    if (!settled && hold.phase !== "idle") cancelUnsettledHold();
    return;
  }
  if (onButton && activePointerId == null) startHold(event);
}

function onPointerMove(event) {
  const contact = pointers.get(event.pointerId);
  if (!contact || performanceScreen.hidden) return;
  contact.x = event.clientX;
  contact.y = event.clientY;
  if (performanceScreen.dataset.displayTheme === "recorder" && event.pointerId === holdPointerId && !pointOnButton(contact.x, contact.y, null)) {
    if (!settled) cancelUnsettledHold();
    setLiveContact(false);
    setHoldPointerId(null);
  }
  if (event.pointerId === activePointerId && !settled && hold.phase === "holding") {
    const updated = updateHold(hold, event.clientX, event.clientY);
    setHold(updated.hold);
    if (updated.cancelled) applyRelease(performance.now(), event.clientX, event.clientY);
  }
  maybeOpenFromSwipe();
}

function onPointerUp(event) {
  if (event.pointerId === primerPointerId) {
    setPrimerPointerId(null);
    recorderThemes.setPressed(false);
    stopVibration();
    forgetPointer(event.pointerId);
    refreshHapticPreparation();
    return;
  }
  const contact = pointers.get(event.pointerId);
  if (!contact) return;
  contact.x = event.clientX;
  contact.y = event.clientY;
  const endsHold = event.pointerId === holdPointerId || event.pointerId === activePointerId;
  const endsReady = event.pointerId === readyPointerId;
  if (event.pointerId === activePointerId && !settled) {
    applyRelease(performance.now(), event.clientX, event.clientY);
  }
  if (endsHold || endsReady) {
    stopVibration();
    if (endsReady) setReadyPointerId(null);
    setLiveContact(false);
    if (event.pointerId === holdPointerId) setHoldPointerId(null);
  }
  maybeOpenFromSwipe();
  forgetPointer(event.pointerId);
}

function onPointerCancel(event) {
  if (event.pointerId === primerPointerId) { setPrimerPointerId(null); recorderThemes.setPressed(false); }
  const endsHold = event.pointerId === holdPointerId || event.pointerId === activePointerId;
  const endsReady = event.pointerId === readyPointerId;
  if (endsHold && !settled && hold.phase !== "idle") cancelUnsettledHold();
  if (endsHold || endsReady) stopVibration();
  if (endsHold) { setLiveContact(false); setHoldPointerId(null); setActivePointerId(null); }
  if (endsReady) setReadyPointerId(null);
  forgetPointer(event.pointerId);
}

function onLostPointerCapture(event) {
  // A missing pointerup is a cancelled contact, never an extra attempt.
  onPointerCancel(event);
}

export {
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture,
};
