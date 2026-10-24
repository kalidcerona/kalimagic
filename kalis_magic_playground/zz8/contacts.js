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
  openSettings,
} from "./contacts-gestures.js";
import { onListClick, renderList } from "./contacts-list.js";
import { resetClicks, startPerformance } from "./contacts-settings.js";
import { loadRecord, applyRecord } from "./contacts-storage.js";

function registerShell() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  try {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Registration can fail offline or when workers are blocked. The page still runs.
    });
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

const localSettingsHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
if (localSettingsHost && new URLSearchParams(location.search).get('local-preview') === '1') {
  window.addEventListener('magic-local-settings', () => {
    document.querySelector('.gesture-guide button')?.click();
    openSettings();
  });
  document.documentElement.dataset.localSettingsReady = 'true';
}
