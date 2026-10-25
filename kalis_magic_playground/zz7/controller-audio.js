import { soundEnabled } from "./preferences.js";
import { recorderThemes } from "./controller-themes.js";
import { hold, activeScanDurationMs, settled, activePointerId } from "./controller-state.js";

// Pre-verdict sound dip, matched to recorder A: 420 ms of silence plus the 46 ms
// to the first typebar strike. The verdict cue starts 60 ms after the release,
// so the scan tone is silent for the last 406 ms (after a 35 ms fade).
const SCAN_DIP_MS = 406;
const SCAN_DIP_FADE_MS = 35;

let audioContext = null;
let audioResumePromise = null;
let soundRequestId = 0;
let scanOscillator = null;
let scanGain = null;

function setAudioContext(value) { audioContext = value; }
function setAudioResumePromise(value) { audioResumePromise = value; }

function ensureAudio() {
  if (!soundEnabled()) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioCtx();
    audioResumePromise = null;
  }
  const ctx = audioContext;
  if (ctx.state !== "running") {
    // Retry from each real gesture, including WebKit's interrupted state.
    audioResumePromise = Promise.resolve(ctx.resume()).catch(() => {});
  }
  return ctx;
}

function withReadyAudio(play) {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const requestId = soundRequestId;
    const playIfCurrent = () => {
      if (requestId !== soundRequestId || ctx !== audioContext ||
          ctx.state !== "running" || !soundEnabled() || document.hidden) return;
      try { play(ctx); } catch { /* Visual feedback remains available. */ }
    };
    if (ctx.state === "running") playIfCurrent();
    else audioResumePromise?.then(playIfCurrent);
  } catch {
    /* Audio support or permission may be unavailable. */
  }
}

function playTone(ctx, destination, frequency, startAt, duration, type, peak) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function playVerdictSound(result) {
  if (recorderThemes.active()) return;
  if (!soundEnabled()) return;
  withReadyAudio((ctx) => {
    // Let the scan tone's short release ramp finish before the verdict cue.
    const start = ctx.currentTime + 0.06;
    const master = ctx.createGain();
    master.gain.setValueAtTime(1, start);
    master.connect(ctx.destination);
    if (result === "LIE") {
      // The two peaks sum to 0.76, leaving headroom at the output.
      playTone(ctx, master, 196, start, 0.34, "square", 0.52);
      playTone(ctx, master, 277, start, 0.34, "square", 0.24);
      window.setTimeout(() => master.disconnect(), 500);
      return;
    }
    if (result === "TRUE") {
      // ding-dong-dang: three separated notes, not a chord.
      const notes = [784, 659.25, 1046.5];
      notes.forEach((frequency, index) => {
        playTone(ctx, master, frequency, start + index * 0.2, 0.18, "sine", 0.68);
      });
      window.setTimeout(() => master.disconnect(), 800);
    }
  });
}

function stopScanningSound() {
  // Also cancel callbacks waiting for resume, even before a node exists.
  soundRequestId += 1;
  if (!scanOscillator) return;
  const oscillator = scanOscillator;
  const gain = scanGain;
  scanOscillator = null;
  scanGain = null;
  try {
    const now = audioContext?.currentTime ?? 0;
    gain?.gain.cancelScheduledValues(now);
    if (gain) {
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    }
    oscillator.stop(now + 0.045);
  } catch {
    try { oscillator.stop(); } catch { /* Oscillator may already have stopped. */ }
  }
}

function startScanningSound() {
  stopScanningSound();
  if (recorderThemes.active()) return;
  if (!soundEnabled()) return;
  withReadyAudio((ctx) => {
    if (settled || hold.phase !== "holding" || activePointerId == null) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(148, now);
    oscillator.frequency.linearRampToValueAtTime(226, now + activeScanDurationMs / 1000 * 0.925);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.17, now + 0.08);
    const remainingS = (activeScanDurationMs - (performance.now() - hold.startedAt)) / 1000;
    const dipFadeStart = now + remainingS - (SCAN_DIP_MS + SCAN_DIP_FADE_MS) / 1000;
    if (dipFadeStart > now + 0.4) {
      gain.gain.setValueAtTime(0.17, dipFadeStart);
      gain.gain.exponentialRampToValueAtTime(0.0001, dipFadeStart + SCAN_DIP_FADE_MS / 1000);
    }
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    scanOscillator = oscillator;
    scanGain = gain;
    oscillator.start(now);
  });
}

export {
  audioContext, ensureAudio, playVerdictSound, stopScanningSound, startScanningSound,
  setAudioContext, setAudioResumePromise,
};
