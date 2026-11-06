import { state } from './state-store.js';

let wakeLock = null;
let wakeLockPending = false;

function performanceWakeWanted() {
  return state.mode === 'performance';
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

export { syncPerformanceWakeLock };
