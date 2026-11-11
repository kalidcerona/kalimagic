globalThis.TabataWakeLock = function (onVisible) {
  let wake = null;
  let wakePending = false, shortLived = 0;
  const wantsWake = () => document.visibilityState === 'visible';
  function releaseWake() {
    const lock = wake;
    wake = null;
    if (lock) { try { Promise.resolve(lock.release()).catch(() => {}); } catch {} }
  }
  async function keepAwake() {
    if (!wantsWake() || !('wakeLock' in navigator) || wake || wakePending) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // A request can resolve after the user leaves the page.
      if (!wantsWake()) { await lock.release(); return; }
      wake = lock;
      const acquiredAt = Date.now();
      lock.addEventListener('release', () => {
        if (wake === lock) wake = null;
        if (!wantsWake()) return;
        // Three locks dropped within 10s means the platform will not keep one. A visible return, or one held 10s, tries again.
        if (Date.now() - acquiredAt >= 10000) shortLived = 0;
        else if (++shortLived >= 3) return;
        setTimeout(keepAwake, 1000);
      });
    } catch {} finally { wakePending = false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { shortLived = 0; keepAwake(); onVisible(); }
    else releaseWake();
  });

  return { keepAwake };
};
