// KANAME Cue pure logic: show model, validation, cue engine and audio policy.
// Ported from the Android app (magic-kalicue Model.kt, CueEngine.kt, AudioPolicy.kt) so one show JSON works in both.
// No DOM or Web Audio here; node tests drive it with a fake clock and fake audio.

export {
  CUE_TYPES,
  TRIGGERS,
  LOOP_MODES,
  MODE,
  newId,
  makeCue,
  makeAudioFile,
  makeSideList,
  makeSettings,
  makeShow,
  position,
  decodeShow,
  validateShow,
  repairShowReferences,
  changeCueType,
  repairReport,
  exportShowBackup,
  importShowBackup,
  matchAudioFiles,
} from './engine-model.mjs';

export {
  MIN_STOP_RAMP_MS,
  stopRampMs,
  DECODED_WARN_BYTES,
  decodedBytes,
  fadeCurve,
  contextDecision,
  visibilityDecision,
  classifyOutputs,
  outputsLost,
  OutputLossGate,
} from './engine-output.mjs';

export {
  GoTimer,
  describeTiming,
} from './engine-timing.mjs';

export {
  VOLUME_KEYS,
  androidKeyCode,
  keyLabel,
  defaultAction,
  keyAction,
  PressGate,
} from './engine-keys.mjs';

export { CueEngine } from './engine-cues.mjs';
