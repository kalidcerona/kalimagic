// Exact source migration markers keep the private-to-public wake policy reviewable.
export const PRIVATE_URAMICHI_WAKE = `// ---------- screen wake lock (standing rule: the screen stays on while the app is visible) ----------
let wakeLock = null, wakePending = false;
async function keepAwake() {
  if (document.visibilityState !== 'visible' || wakeLock || wakePending || !navigator.wakeLock) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    wakePending = false;
    if (document.visibilityState !== 'visible') { lock.release().catch(() => {}); return; }
    wakeLock = lock;
    lock.addEventListener?.('release', () => { if (wakeLock === lock) { wakeLock = null; if (document.visibilityState === 'visible') keepAwake(); } });
  } catch { wakePending = false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    keepAwake();
    recovery.reset();
    if (cameraWanted()) startCamera();
  } else {
    recovery.cancel();
    stopCamera();
    if (wakeLock) { const lock = wakeLock; wakeLock = null; lock.release().catch(() => {}); }
  }
});

`;

export const PUBLIC_URAMICHI_WAKE = `// Keep the screen awake only during visible scanning, never while settings are open.
let wakeLock = null, wakePending = false;
const wakeWanted = () => cameraWanted() && !$('settings').open;
function releaseWake() {
  if (!wakeLock) return;
  const lock = wakeLock;
  wakeLock = null;
  lock.release().catch(() => {});
}
async function keepAwake() {
  if (!wakeWanted()) { releaseWake(); return; }
  if (wakeLock || wakePending || !navigator.wakeLock) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!wakeWanted()) { await lock.release(); return; }
    wakeLock = lock;
    lock.addEventListener?.('release', () => {
      if (wakeLock === lock) { wakeLock = null; if (wakeWanted()) keepAwake(); }
    });
  } catch { /* Wake lock is optional. */ }
  finally { wakePending = false; }
}
const wakeObserver = new MutationObserver(() => keepAwake());
wakeObserver.observe($('settings'), { attributes: true, attributeFilter: ['open'] });
wakeObserver.observe($('gate'), { attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    keepAwake();
    recovery.reset();
    if (cameraWanted()) startCamera();
  } else {
    recovery.cancel();
    stopCamera();
    releaseWake();
  }
});

`;
