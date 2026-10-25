import { mayOverwritePrimary, loadFromRaw, serializeState } from "./logic.js";
import { truthInput, attemptProgress } from "./dom.js";
import {
  STATE_KEY, SCAN_DURATION_KEY, SOUND_KEY, VIBRATION_KEY, storageGet, storageSet,
} from "./storage.js";
import { loadVibrationPreference, applyVibrationCapability } from "./vibration.js";
import { setStatus, loadSoundPreference, setScanDuration } from "./preferences.js";
import { appState, setAppState } from "./controller-state.js";

let storageLocked = false;

function canPersistState() {
  return mayOverwritePrimary({
    preserveStoredRaw: storageLocked,
    backupSaved: false,
    acknowledged: false,
  });
}

function persistState() {
  if (!canPersistState()) return false;
  return storageSet(STATE_KEY, serializeState(appState));
}

function updateAttemptProgress() {
  attemptProgress.textContent = `완료한 시도 ${appState.attemptCount}회. 공연을 시작하면 0이 됩니다.`;
}

function bootStorage() {
  const stored = storageGet(STATE_KEY);
  const sound = storageGet(SOUND_KEY);
  const vibration = storageGet(VIBRATION_KEY);
  setScanDuration(storageGet(SCAN_DURATION_KEY).value);
  if (sound.ok) loadSoundPreference(sound.value);
  if (vibration.ok) loadVibrationPreference(vibration.value);
  applyVibrationCapability();
  if (!stored.ok) {
    setAppState(loadFromRaw(null).state);
    storageLocked = true;
    setStatus("브라우저 저장소를 사용할 수 없습니다. 이번 공연 값만 유지됩니다.");
    return;
  }
  const loaded = loadFromRaw(stored.value);
  setAppState(loaded.state);
  storageLocked = loaded.preserveStoredRaw === true;
  truthInput.value = appState.settings.truthAttempts.join(",");
  updateAttemptProgress();
  if (storageLocked) {
    setStatus("저장된 기록을 읽지 못했습니다. 기존 값은 덮어쓰지 않습니다.");
  }
}

export { storageLocked, persistState, updateAttemptProgress, bootStorage };
