    let wakeLock = null;
    let wakeLockPending = false;

    async function acquireWakeLock() {
      if (
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

        if (document.visibilityState !== "visible") {
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

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        acquireWakeLock();
      } else {
        releaseWakeLock();
      }
    });

