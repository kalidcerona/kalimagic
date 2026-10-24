import { timer } from './clock.mjs';
import { ctx, runtime, perform, scheduleRender } from './playback.mjs';
import { bootKaname } from './show.mjs';

// ---------- screen wake lock (standing rule: the screen stays on while the app is visible) ----------
let wakeLock = null, wakePending = false;
async function keepAwake() {
  if (document.visibilityState !== 'visible' || wakeLock || wakePending || !navigator.wakeLock) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    wakePending = false;
    if (document.visibilityState !== 'visible') { lock.release().catch(() => {}); return; }
    wakeLock = lock;
    // The system may drop the lock while the page stays visible (battery saver); ask again then.
    lock.addEventListener?.('release', () => { if (wakeLock === lock) { wakeLock = null; if (document.visibilityState === 'visible') keepAwake(); } });
  } catch { wakePending = false; }
}
document.addEventListener('visibilitychange', () => {
  // Hiding the page never stops the show (web stand-in for the Android focus policy).
  if (document.visibilityState === 'visible') { keepAwake(); scheduleRender(); }
  else if (wakeLock) { const lock = wakeLock; wakeLock = null; lock.release().catch(() => {}); }
});

// Inspection hook for headless checks only.
if (new URLSearchParams(location.search).get('debug') === '1') window.__kaname = { get ctx() { return ctx; }, get runtime() { return runtime; }, timer, perform };
bootKaname(keepAwake);
