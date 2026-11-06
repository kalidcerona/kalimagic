// Screen switching and the performance screen wake lock.

import {
  settingsScreen,
  listScreen,
  detailScreen,
  statusNode,
} from "./contacts-state.js";

let wakeLock = null;
let wakeLockPending = false;

function setStatus(message) {
  statusNode.textContent = message;
}

function showScreen(screen) {
  settingsScreen.hidden = screen !== "settings";
  listScreen.hidden = screen !== "list";
  detailScreen.hidden = screen !== "detail";
  syncPerformanceWakeLock();
  // Update prompt: asked only on the settings screen, hidden on every other screen.
  if (screen === "settings") window.MagicUpdate?.offer(); else window.MagicUpdate?.hide();
}

function performanceOpen() {
  return settingsScreen.hidden;
}

function performanceWakeWanted() {
  return performanceOpen();
}

async function acquireWakeLock() {
  if (
    !performanceWakeWanted() ||
    !("wakeLock" in navigator) ||
    document.visibilityState !== "visible" ||
    wakeLock !== null ||
    wakeLockPending
  ) {
    return;
  }

  wakeLockPending = true;
  try {
    const lock = await navigator.wakeLock.request("screen");

    if (!performanceWakeWanted() || document.visibilityState !== "visible") {
      await lock.release();
      return;
    }

    wakeLock = lock;
    lock.addEventListener("release", () => {
      if (wakeLock === lock) wakeLock = null;
      if (document.visibilityState === "visible") acquireWakeLock();
    }, { once: true });
  } catch {
    wakeLock = null;
  } finally {
    wakeLockPending = false;
  }
}

async function releaseWakeLock() {
  const lock = wakeLock;
  wakeLock = null;
  if (lock === null) return;

  try {
    await lock.release();
  } catch {
    // Wake Lock API is optional; release failures need no UI.
  }
}

function syncPerformanceWakeLock() {
  if (performanceWakeWanted()) acquireWakeLock();
  else releaseWakeLock();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") acquireWakeLock();
  else releaseWakeLock();
});

// Ask once, after this page loads, for the browser to keep stored data. No prompt and no UI.
function askToKeepStoredData() {
  try {
    if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function") return;
    Promise.resolve(navigator.storage.persist()).catch(() => {});
  } catch {
    // A refusal is ignored. Nothing is shown.
  }
}
askToKeepStoredData();

export { setStatus, showScreen, performanceOpen };
