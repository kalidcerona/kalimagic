import { parseStoredState as parseLaunchState } from './logic.js';
// Silent launch self-check. No UI. A soft vibration on the first single-finger
// touch means this launch's checks passed. A miss, a failed read, or a multi-touch
// first gesture stays quiet. One vibration per page load (a reload arms it again).

const { FINGER_GAP_MS, softLaunchPattern, startLaunchCheck } = (() => {
const FINGER_GAP_MS = 80;

// TOBIRA: saved settings plus the bundled default preset. A custom coin or card image
// chosen for any saved preset must be in IndexedDB. Built-in coin and card art is
// a shell asset, so a missing upload is ready only when the choice is not "custom".
const VIBRATION_KEY = null;
const SHELL_PREFIX = 'tobira-shell-';
const SETTINGS_KEYS = [
  'tobira.v1',
  'tobira.objectKind.v1',
  'tobira.coinChoices.v1',
  'tobira.motion-effects.v1',
  'tobira.wallpaperCrop.v1',
];
const IMAGE_DB = 'tobira.localImages.v1';
const IMAGE_STORE = 'images';

function softLaunchPattern(totalMs = 2000) {
  const pattern = [];
  let used = 0;
  while (used < totalMs) {
    const pulse = Math.min(30, totalMs - used);
    pattern.push(pulse);
    used += pulse;
    if (used >= totalMs) break;
    const gap = Math.min(70, totalMs - used);
    pattern.push(gap);
    used += gap;
  }
  return pattern;
}

function storageArea() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') return localStorage;
  } catch { /* fall through to window */ }
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') return window.localStorage;
  } catch { /* storage is blocked */ }
  return null;
}

function readItem(key) {
  const area = storageArea();
  if (!area) throw new Error('storage');
  return area.getItem(key);
}

function vibrationEnabled() {
  if (!VIBRATION_KEY) return true;
  try {
    const input = typeof document !== 'undefined' && document.querySelector ? document.querySelector('#vibration-level') : null;
    if (input && input.value === 'off') return false;
    if (readItem(VIBRATION_KEY) === 'off') return false;
    return true;
  } catch {
    return false;
  }
}

function readSettings() {
  try {
    for (const key of SETTINGS_KEYS) readItem(key);
    return true;
  } catch {
    return false;
  }
}

function readImage(dbName, storeName, key) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      const idb = typeof indexedDB !== 'undefined' ? indexedDB : (typeof window !== 'undefined' ? window.indexedDB : null);
      if (!idb || typeof idb.open !== 'function') { reject(new Error('idb')); return; }
      request = idb.open(dbName);
    } catch (error) {
      reject(error);
      return;
    }
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error('idb'));
    };
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error('blocked'));
    request.onupgradeneeded = () => {
      try { request.transaction.abort(); } catch { /* missing database */ }
      fail(new Error('missing'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      try {
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          fail(new Error('missing-store'));
          return;
        }
        const tx = db.transaction(storeName, 'readonly');
        tx.onabort = () => { db.close(); fail(tx.error); };
        tx.onerror = () => { db.close(); fail(tx.error); };
        const get = tx.objectStore(storeName).get(key);
        get.onsuccess = () => {
          if (settled) return;
          settled = true;
          try { db.close(); } catch { /* already closing */ }
          resolve(get.result || null);
        };
        get.onerror = () => {
          try { db.close(); } catch { /* already closing */ }
          fail(get.error);
        };
      } catch (error) {
        try { db.close(); } catch { /* already closing */ }
        fail(error);
      }
    };
  });
}

async function assetsPresent() {
  try {
    const parsed = parseLaunchState(readItem('tobira.v1'));
    if (!parsed.ok) return false;
    const choiceRaw = readItem('tobira.coinChoices.v1');
    const choices = choiceRaw == null ? {} : JSON.parse(choiceRaw);
    if (!choices || typeof choices !== 'object' || Array.isArray(choices)) return false;
    for (const preset of parsed.state.presets) {
      if (choices[preset.id] === 'custom') {
        const record = await readImage(IMAGE_DB, IMAGE_STORE, `coin:${preset.id}`);
        if (!(record instanceof Blob) || record.size === 0) return false;
      }
    }
    // Clearing a wallpaper removes its crop setting as well. This surviving marker
    // requires the performance wallpaper, but not the editing-only original.
    if (readItem('tobira.wallpaperCrop.v1') != null) {
      const wallpaper = await readImage(IMAGE_DB, IMAGE_STORE, 'wallpaper');
      if (!(wallpaper instanceof Blob) || wallpaper.size === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function shellReady() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return true;
    const controller = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!controller) return false;
    if (typeof caches === 'undefined' || !caches || typeof caches.keys !== 'function' || typeof caches.open !== 'function') return false;
    // Match this release and registration scope, never another installation or stale cache.
    const scope = new URL('./', controller.scriptURL).href;
    const current = SHELL_PREFIX + encodeURIComponent(scope) + '-v20261004-first-guide-1-manual-install-1-perf-1-coherent-1-img-2-compat-1-wake-1-local-preview-1-modules-1-order-1-local-preview-module-1-perf-split-1-css-1-update-prompt-3-persist-1-launch-check-1-photo-notice-1';
    if (!(await caches.keys()).includes(current)) return false;
    const cache = await caches.open(current);
    return Boolean(await cache.match(new URL('index.html', scope).href));
  } catch {
    return false;
  }
}

function timerHost() {
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function' && typeof window.clearTimeout === 'function') return window;
  return globalThis;
}

function buzz() {
  try {
    if (!vibrationEnabled()) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(softLaunchPattern());
  } catch { /* haptics are optional */ }
}

let started = false;

function startLaunchCheck() {
  if (started) return;
  started = true;
  const pending = Promise.resolve().then(async () => readSettings() && await assetsPresent() && await shellReady()).catch(() => false);
  let settled = false;
  let fingers = 0;
  let multi = false;
  let timer = 0;
  const host = () => timerHost();
  const clear = () => {
    if (!timer) return;
    try { host().clearTimeout(timer); } catch { /* ignore */ }
    timer = 0;
  };
  const finish = (shouldBuzz) => {
    if (settled) return;
    settled = true;
    clear();
    if (shouldBuzz) buzz();
  };
  const listen = (type, fn) => {
    const target = typeof window !== 'undefined' ? window : globalThis;
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, fn, { passive: true });
  };
  const onUp = () => {
    if (fingers > 0) fingers -= 1;
  };
  const onDown = (event) => {
    if (settled) return;
    fingers += 1;
    if (fingers > 1 || (event && event.isPrimary === false)) {
      multi = true;
      finish(false);
      return;
    }
    if (timer) return;
    try {
      timer = host().setTimeout(() => {
        timer = 0;
        pending.then((ok) => finish(Boolean(ok) && !multi)).catch(() => finish(false));
      }, FINGER_GAP_MS);
    } catch {
      finish(false);
    }
  };
  listen('pointerdown', onDown);
  listen('pointerup', onUp);
  listen('pointercancel', onUp);
}

return { FINGER_GAP_MS, softLaunchPattern, startLaunchCheck };
})();

export { FINGER_GAP_MS, softLaunchPattern, startLaunchCheck };
