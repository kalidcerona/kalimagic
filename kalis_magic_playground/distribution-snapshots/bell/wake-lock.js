export function setupWakeLock (onVisible) {
  let wake = null;
  let returnedWhilePending = false;
  let wakePending = false, shortLived = 0;
  const wantsWake = () => document.visibilityState === 'visible';
  function releaseWake() {
    const lock = wake;
    wake = null;
    if (lock) { try { Promise.resolve(lock.release()).catch(() => {}); } catch {} }
  }
  async function keepAwake() {
    if (!wantsWake() || !('wakeLock' in navigator) || (wake && !wake.released) || wakePending) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // A request can resolve after the user leaves the page.
      if (!wantsWake()) { await lock.release(); return; }
      if (lock.released) return;
      wake = lock;
      const acquiredAt = Date.now();
      lock.addEventListener('release', () => {
        if (wake !== lock) return;
        wake = null;
        if (!wantsWake()) return;
        // Three locks dropped within 10s means the platform will not keep one. A visible return, or one held 10s, tries again.
        if (Date.now() - acquiredAt >= 10000) shortLived = 0;
        else if (++shortLived >= 3) return;
        setTimeout(keepAwake, 1000);
      });
    } catch {} finally {
      wakePending = false;
      if (returnedWhilePending) {
        returnedWhilePending = false;
        keepAwake();
      }
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (wantsWake()) {
      shortLived = 0;
      if (wakePending) returnedWhilePending = true;
      else keepAwake();
      onVisible();
    }
    else releaseWake();
  });

  return { keepAwake };
};
