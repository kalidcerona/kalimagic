import {
  wallSoundEnabled, wallVolumeGain, loadMotionEffects, saveMotionEffects, saveSoundPreferences,
} from './motion-prefs.js';
import { phase, center, objectLive } from './perf-state.js';
import { motionEnabled, wobbleX, wobbleY, wobbleAngle, enableMotion } from './sensor-effects.js';
import {
  concealCoin, onPointerDown, onPointerMove, onPointerUp, onResize, onEdgeKey,
} from './pointer-gestures.js';
import { showSettings, showPerformance } from './mode-switch.js';

export {
  wallSoundEnabled, wallVolumeGain, loadMotionEffects, saveMotionEffects, saveSoundPreferences,
  phase, center, objectLive, motionEnabled, wobbleX, wobbleY, wobbleAngle, enableMotion,
  concealCoin, showSettings, showPerformance, onPointerDown, onPointerMove, onPointerUp, onResize,
  onEdgeKey,
};
