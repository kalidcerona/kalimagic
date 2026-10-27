// Performance UI for the local fictional contacts prototype.
// Visible name taps call resolveContactClick once. Settings use a two-finger
// downward swipe in viewport coordinates (clientX/clientY), not screenX/screenY.
// Single-finger scrolling and taps are left to the browser. No device contacts,
// network fetches, or the retired asrai.library.v1 key.

import {
  LIMITS,
  DEFAULT_FICTIONAL_NAMES,
} from "./logic.js";
import {
  session,
  contactList,
  contactSearch,
  backButton,
  resetButton,
  startButton,
  settingsScreen,
} from "./contacts-state.js";
import { showScreen } from "./contacts-screen.js";
import {
  onSwallowClick,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onPointerCancel,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  showGestureGuideOnce,
} from "./contacts-gestures.js";
import { openSettings } from "./contacts-gestures.js"; // local-preview-hook
import { onListClick, renderList } from "./contacts-list.js";
import { resetClicks, startPerformance } from "./contacts-settings.js";
import { loadRecord, applyRecord } from "./contacts-storage.js";
import { installLocalPreview } from './local-preview.js'; // local-preview-hook

function registerShell() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  try {
    const registration = navigator.serviceWorker.register("./sw.js");
    registration.catch(() => {
      // Registration can fail offline or when workers are blocked. The page still runs.
    });
    window.MagicUpdate?.init({ registrationPromise: registration, safe: () => !settingsScreen.hidden });
  } catch {
    // Older browsers can throw instead of rejecting.
  }
}

document.addEventListener("click", onSwallowClick, true);
document.addEventListener("pointerdown", onPointerDown);
document.addEventListener("pointermove", onPointerMove, { passive: false });
document.addEventListener("pointerup", onPointerEnd);
document.addEventListener("pointercancel", onPointerCancel);
document.addEventListener("touchstart", onTouchStart, { passive: true });
document.addEventListener("touchmove", onTouchMove, { passive: false });
document.addEventListener("touchend", onTouchEnd, { passive: true });
document.addEventListener("touchcancel", onTouchCancel, { passive: true });
contactList.addEventListener("click", onListClick);
contactSearch.addEventListener("input", () => {
  renderList();
});
backButton.addEventListener("click", () => {
  showScreen("list");
});
resetButton.addEventListener("click", resetClicks);
startButton.addEventListener("click", startPerformance);

function startBootPerformance() {
  if (session.activeNames.length) return;
  applyRecord({
    names: [...DEFAULT_FICTIONAL_NAMES], clickCount: 0,
    targetClick: LIMITS.defaultTargetClick,
    phone: session.currentSettings.phone, region: session.currentSettings.region, note: session.currentSettings.note,
  }, true);
}

loadRecord();
startBootPerformance();
showGestureGuideOnce();
registerShell();

installLocalPreview(() => { document.querySelector('.gesture-guide button')?.click(); openSettings(); }); // local-preview-hook
