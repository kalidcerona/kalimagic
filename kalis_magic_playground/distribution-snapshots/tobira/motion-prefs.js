import {
  EDGE_ORDER, motionNote, wallSoundInput, wallVolumeInput, wallVolumeValue, MOTION_SETTINGS_KEY,
  motionInputs, motionEdges, DEFAULT_MOTION_EFFECTS, DEFAULT_WALL_VOLUME, MOTION_OWNED_KEYS,
} from './dom.js';
import { unlockBreakSound } from './audio.js';
import {
  motionEnabled, cancelTiltFrame, disableMotion, enableMotion, updateMotionActivation,
} from './sensor-effects.js';

let motionEffects = { ...DEFAULT_MOTION_EFFECTS, wallSound: true, wallVolume: DEFAULT_WALL_VOLUME };
let motionExtras = {};
let motionStorageBlocked = false;
let motionPermissionDenied = false;

function setMotionPermissionDenied(value) {
  motionPermissionDenied = value;
}

function sensorEffectEnabled() {
  return ['tilt', 'exit', 'breakthrough', 'wobble'].some((key) => motionEffects[key] === true);
}

function wallSoundEnabled() {
  return motionEffects.wallSound !== false;
}

function wallVolumeGain() {
  const volume = Number.isFinite(motionEffects.wallVolume) ? motionEffects.wallVolume : DEFAULT_WALL_VOLUME;
  return Math.min(1, Math.max(0, volume / 100));
}

function applyMotionForm() {
  for (const [key, input] of Object.entries(motionInputs)) input.checked = Boolean(motionEffects[key]);
  for (const [edge, input] of Object.entries(motionEdges)) input.checked = motionEffects.edges.includes(edge);
  if (wallSoundInput) wallSoundInput.checked = wallSoundEnabled();
  if (wallVolumeInput) {
    const volume = Number.isFinite(motionEffects.wallVolume) ? motionEffects.wallVolume : DEFAULT_WALL_VOLUME;
    wallVolumeInput.value = String(volume);
    if (wallVolumeValue) wallVolumeValue.textContent = `${volume}%`;
  }
}

function loadMotionEffects() {
  motionEffects = { ...DEFAULT_MOTION_EFFECTS, wallSound: true, wallVolume: DEFAULT_WALL_VOLUME };
  motionExtras = {};
  let raw = null;
  try {
    raw = localStorage.getItem(MOTION_SETTINGS_KEY);
  } catch {
    // Unreadable storage stays untouched. In-memory defaults are not written back.
    motionStorageBlocked = true;
    motionNote.textContent = '움직임 설정을 읽지 못했습니다. 기존 기록은 덮어쓰지 않습니다.';
    applyMotionForm();
    return;
  }
  if (raw == null || raw === '') {
    applyMotionForm();
    return;
  }
  let saved = null;
  try {
    saved = JSON.parse(raw);
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    motionStorageBlocked = true;
    motionNote.textContent = '움직임 설정을 읽지 못했습니다. 이번 실행만 기본값을 쓰며, 기존 기록은 덮어쓰지 않았습니다.';
    applyMotionForm();
    return;
  }
  for (const [key, value] of Object.entries(saved)) {
    if (!MOTION_OWNED_KEYS.has(key)) motionExtras[key] = value;
  }
  motionEffects = {
    tilt: typeof saved.tilt === 'boolean' ? saved.tilt : true,
    exit: saved.exit === true,
    breakthrough: typeof saved.breakthrough === 'boolean' ? saved.breakthrough : true,
    wobble: saved.wobble === true,
    edges: Array.isArray(saved.edges) ? EDGE_ORDER.filter((edge) => saved.edges.includes(edge)) : ['right'],
    wallSound: typeof saved.wallSound === 'boolean' ? saved.wallSound : true,
    wallVolume: typeof saved.wallVolume === 'number' && Number.isFinite(saved.wallVolume)
      ? Math.min(100, Math.max(0, saved.wallVolume)) : DEFAULT_WALL_VOLUME,
  };
  if (motionEffects.exit) motionEffects.tilt = true;
  applyMotionForm();
}

function motionPayload() {
  return {
    ...motionExtras,
    tilt: motionEffects.tilt === true,
    exit: motionEffects.exit === true,
    breakthrough: motionEffects.breakthrough === true,
    wobble: motionEffects.wobble === true,
    edges: motionEffects.edges,
    wallSound: wallSoundEnabled(),
    wallVolume: Number.isFinite(motionEffects.wallVolume) ? motionEffects.wallVolume : DEFAULT_WALL_VOLUME,
  };
}

function writeMotionStorage() {
  if (motionStorageBlocked) {
    motionNote.textContent = '움직임 설정을 읽지 못해 저장하지 않았습니다. 기존 기록은 그대로입니다.';
    return false;
  }
  try {
    localStorage.setItem(MOTION_SETTINGS_KEY, JSON.stringify(motionPayload()));
    return true;
  } catch {
    motionNote.textContent = '센서 설정을 저장하지 못했습니다. 이번 실행에서는 계속 사용할 수 있습니다.';
    return false;
  }
}

function saveMotionEffects() {
  motionPermissionDenied = false;
  if (motionInputs.exit.checked) motionInputs.tilt.checked = true;
  motionEffects = {
    ...motionEffects,
    ...Object.fromEntries(Object.entries(motionInputs).map(([key, input]) => [key, input.checked])),
    edges: EDGE_ORDER.filter((edge) => motionEdges[edge].checked),
  };
  writeMotionStorage();
  unlockBreakSound();
  if (!motionEffects.tilt) cancelTiltFrame();
  if (!Object.values(motionInputs).some((input) => input.checked)) disableMotion();
  else if (!motionEnabled) void enableMotion();
  updateMotionActivation();
}

function saveSoundPreferences() {
  // Sound is independent of sensor permission and of the selected preset.
  const volume = Math.min(100, Math.max(0, Number(wallVolumeInput?.value)));
  motionEffects = {
    ...motionEffects,
    wallSound: Boolean(wallSoundInput?.checked),
    wallVolume: Number.isFinite(volume) ? volume : DEFAULT_WALL_VOLUME,
  };
  if (wallVolumeValue) wallVolumeValue.textContent = `${motionEffects.wallVolume}%`;
  writeMotionStorage();
}

export {
  motionEffects, motionPermissionDenied, setMotionPermissionDenied, sensorEffectEnabled,
  wallSoundEnabled, wallVolumeGain, loadMotionEffects, saveMotionEffects, saveSoundPreferences,
};
