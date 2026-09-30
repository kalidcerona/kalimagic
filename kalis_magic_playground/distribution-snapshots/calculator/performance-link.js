// Share only the revealed number, scoped to personal or friend apps on this origin.
(function (root) {
  'use strict';
  function keyFor(pathname) {
    return 'magic-performance-link:v1:release-hitsuzen:' + (/^\/tools(?:\/|$)/.test(pathname || '') ? 'shared' : 'personal');
  }
  function read(storage, pathname) {
    try {
      var value = JSON.parse(storage.getItem(keyFor(pathname)));
      if (value?.version !== 1 || !Number.isInteger(value.days) || value.days < 0 || value.days > 100000
        || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) return null;
      return { days: value.days, updatedAt: value.updatedAt, revision: value.updatedAt + ':' + value.days };
    } catch (_) { return null; }
  }
  function write(storage, pathname, days, now) {
    if (!Number.isInteger(days) || days < 0 || days > 100000) return false;
    var timestamp = now === undefined ? Date.now() : now;
    if (!Number.isFinite(timestamp) || timestamp < 0) return false;
    try {
      if (read(storage, pathname)?.days === days) return true;
      storage.setItem(keyFor(pathname), JSON.stringify({ version: 1, days: days, updatedAt: timestamp }));
      return true;
    } catch (_) { return false; }
  }
  function clear(storage, pathname) {
    try { storage.removeItem(keyFor(pathname)); return true; } catch (_) { return false; }
  }
  root.MagicPerformanceLink = Object.freeze({ keyFor: keyFor, read: read, write: write, clear: clear });
})(typeof window === 'undefined' ? globalThis : window);
