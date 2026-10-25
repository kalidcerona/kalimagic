    let wakeLock = null;
    let wakeLockPending = false;
    async function acquireWakeLock() {
      if (wakeLock || wakeLockPending || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
      wakeLockPending = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        wakeLock = lock;
        lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; if (document.visibilityState === 'visible') acquireWakeLock(); });
      } catch (error) {}
      finally { wakeLockPending = false; }
    }

export { wakeLock, acquireWakeLock };
