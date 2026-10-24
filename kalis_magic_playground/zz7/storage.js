const STATE_KEY = "usotsuki.detector.v1";
const SCAN_DURATION_KEY = "usotsuki.detector.scan-duration.v1";
const SOUND_KEY = "usotsuki.detector.sound.v1";
const VIBRATION_KEY = "usotsuki.detector.vibration.v1";

function storageGet(key) {
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export { STATE_KEY, SCAN_DURATION_KEY, SOUND_KEY, VIBRATION_KEY, storageGet, storageSet };
