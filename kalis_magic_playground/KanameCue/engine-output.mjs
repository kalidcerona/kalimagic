// ---------- audio policy (AudioPolicy.kt translated to the web) ----------
export const MIN_STOP_RAMP_MS = 20;
export const stopRampMs = requestedMs => Math.max(Number(requestedMs) || 0, MIN_STOP_RAMP_MS);
export const DECODED_WARN_BYTES = 400 * 1024 * 1024;
export const decodedBytes = (frames, channels) => frames * channels * 4;

// Gain values for a fade, used with setValueCurveAtTime. Equal power keeps loudness steadier through a crossfade.
export function fadeCurve(from, to, points = 64, shape = 'linear') {
  const curve = new Float32Array(Math.max(2, points));
  for (let i = 0; i < curve.length; i++) {
    const t = i / (curve.length - 1);
    curve[i] = shape === 'equal'
      ? from * Math.cos(t * Math.PI / 2) + to * Math.sin(t * Math.PI / 2)
      : from + (to - from) * t;
  }
  curve[0] = from; curve[curve.length - 1] = to;
  return curve;
}

// Web stand-in for Android audio focus: the show never stops because the page lost focus or another tab made sound.
// A system interruption (iOS "interrupted", an unrequested "suspended") stops the sound anyway, so it pauses resumably.
export function contextDecision(state, selfSuspended) {
  if (state === 'running') return 'RUNNING';
  if (state === 'closed') return 'LOST';
  if (state === 'interrupted') return 'LOST';
  if (state === 'suspended') return selfSuspended ? 'IGNORE' : 'LOST';
  return 'IGNORE';
}
export const visibilityDecision = () => 'IGNORE';

const outputSignature = d => (d.deviceId || '') + '|' + (d.groupId || '');
/**
 * Classify a devicechange for the outputs: LOST (an output went away), ADDED, SAME, or UNKNOWN when the browser
 * hides device ids (no permission) so a loss cannot be told from any other change.
 */
export function classifyOutputs(before, after) {
  const prev = (before || []).filter(d => d.kind === 'audiooutput');
  const next = (after || []).filter(d => d.kind === 'audiooutput');
  if (next.length < prev.length) return 'LOST';
  if (next.length > prev.length) return 'ADDED';
  const opaque = list => list.length === 0 || list.every(d => !d.deviceId);
  if (opaque(prev) || opaque(next)) return 'UNKNOWN';
  const kept = new Set(next.map(outputSignature));
  return prev.some(d => !kept.has(outputSignature(d))) ? 'LOST' : 'SAME';
}
/** Pause on a real loss and, conservatively, on a change we cannot read (like Android's becoming-noisy broadcast). */
export const outputsLost = (before, after) => ['LOST', 'UNKNOWN'].includes(classifyOutputs(before, after));

/** Collapses devicechange and statechange, which fire for the same unplug. */
export class OutputLossGate {
  constructor(now, windowMs = 1500) { this.now = now; this.windowMs = windowMs; this.last = null; }
  accept() {
    const t = this.now();
    if (this.last !== null && t - this.last < this.windowMs) return false;
    this.last = t; return true;
  }
}
