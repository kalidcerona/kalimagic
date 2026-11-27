// Embedded in the private wheel module so the launch reset can preserve its source synchronously.
function installTycheStateWriter(key) {
  const firstKey = key + '-prelaunch';
  const resetKey = 'zz-migration:tyche:launch-reset';

  function readMarker() {
    try {
      return JSON.parse(localStorage.getItem(resetKey));
    } catch { /* Unreadable metadata cannot override the app's own value. */ }
    return null;
  }

  function sourceValue(current, marker = readMarker()) {
    return marker && current === marker.reset && typeof marker.original === 'string' ? marker.original : current;
  }
  window.zzBackupTycheState = sourceValue;

  return function write(value, launch) {
    if (launch) {
      const current = localStorage.getItem(key);
      const marker = readMarker();
      const original = sourceValue(current, marker);
      // The first source is immutable. The marker follows later launches and edits.
      if (original !== null && current !== marker?.reset && localStorage.getItem(firstKey) === null) {
        localStorage.setItem(firstKey, original);
      }
      if (current === null || original !== value) {
        localStorage.setItem(resetKey, JSON.stringify({ original, reset: value }));
      }
      localStorage.setItem(key, value);
      return;
    }
    localStorage.setItem(key, value);
    localStorage.removeItem(resetKey);
  };
}
