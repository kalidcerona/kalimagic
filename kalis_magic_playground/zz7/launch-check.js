// Silent launch self-check. No UI. A soft vibration on the first single-finger
// touch means this launch's checks passed. A miss, a failed read, or a multi-touch
// first gesture stays quiet. One vibration per page load (a reload arms it again).

const { FINGER_GAP_MS, softLaunchPattern, startLaunchCheck } = (() => {
const FINGER_GAP_MS = 80;

// USOTSUKI has no uploaded media. The performer registers truth rounds in the saved
// state. A missing state uses the built-in default and is ready. A saved state must
// parse and carry a truthAttempts list of integers from 1 to 20. Vibration "off"
// is a setting, not a failed check: the launch stays quiet.
const VIBRATION_KEY = "usotsuki.detector.vibration.v1";
const SHELL_PREFIX = "usotsuki-shell-";
const SETTINGS_KEYS = [
  "usotsuki.detector.v1",
  "usotsuki.detector.scan-duration.v1",
  "usotsuki.detector.sound.v1",
  "usotsuki.detector.vibration.v1",
  "usotsuki.detector.theme.v1",
];

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

async function assetsPresent() {
  try {
    const raw = readItem("usotsuki.detector.v1");
    if (raw == null || raw === "") return true;
    const data = JSON.parse(raw);
    const configured = data?.settings;
    const attempts = configured?.truthAttempts ?? (configured?.truthAttempt == null ? null : [configured.truthAttempt]);
    if (!Array.isArray(attempts) || attempts.length === 0) return false;
    return attempts.every((n) => Number.isInteger(n) && n >= 1 && n <= 20);
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
    const current = SHELL_PREFIX + encodeURIComponent(scope) + '-v20261009-continuous-paper-20-haptic-dip-manual-install-1-perf-1-coherent-1-compat-1-gesture-1-wake-1-modules-1-split-1-trim-1-css-1-clean-1-lieflash-2-local-preview-module-1-update-prompt-3-hold-range-76-1-persist-1-launch-check-1-perf-log-1-r5-b3-1';
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
