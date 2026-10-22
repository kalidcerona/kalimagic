// Web Audio engine for KANAME Cue: one shared AudioContext, fully decoded buffers, per-cue GainNode ramps.
// GO only creates an AudioBufferSourceNode and calls start(); nothing is fetched or decoded on the GO path.
import { fadeCurve, decodedBytes } from './engine.mjs';

const FADE_ZERO_MS = 5; // A FADE of 0 ms still ramps briefly so a jump in level does not click.

export class WebAudioEngine {
  constructor(ctx, { curve = () => 'linear', started = () => {} } = {}) {
    this.ctx = ctx;
    this.curve = curve;           // 'linear' or 'equal', read on every fade
    this.started = started;       // called right after source.start() for the timing log
    this.buffers = new Map();     // audioFileId -> AudioBuffer
    this.errors = new Map();      // audioFileId -> message
    this.tracks = new Map();      // cue id -> track
    this.selfSuspended = false;
    this.output = ctx.createGain();
    this.output.connect(ctx.destination);
  }

  bytes() {
    let total = 0;
    for (const buffer of this.buffers.values()) total += decodedBytes(buffer.length, buffer.numberOfChannels);
    return total;
  }

  /** Decode every referenced file once. load(id) returns an ArrayBuffer or null. */
  async decodeAll(ids, load, progress = () => {}) {
    const wanted = [...new Set(ids)];
    for (const id of [...this.buffers.keys()]) if (!wanted.includes(id)) this.buffers.delete(id);
    this.errors.clear();
    let done = 0;
    progress(done, wanted.length);
    for (const id of wanted) {
      if (!this.buffers.has(id)) {
        try {
          const data = await load(id);
          if (!data) throw new Error('파일 없음');
          this.buffers.set(id, await this.ctx.decodeAudioData(data));
        } catch (error) {
          this.errors.set(id, error?.message || '디코드 실패');
        }
      }
      done++;
      progress(done, wanted.length);
    }
    return { decoded: this.buffers.size, errors: new Map(this.errors), bytes: this.bytes() };
  }

  play(cue, finished, failed) {
    this.stopNow(cue.id, false);
    const buffer = this.buffers.get(cue.audioFileId);
    if (!buffer) { failed('파일 없음: ' + cue.name); return; }
    const ctx = this.ctx;
    const startSec = Math.max(cue.startMs, 0) / 1000;
    const endSec = cue.endMs === null ? buffer.duration : Math.min(cue.endMs / 1000, buffer.duration);
    if (!(endSec > startSec)) { failed('잘못된 재생 구간: ' + cue.name); return; }
    const segment = endSec - startSec;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(this.output);
    const volume = Math.min(Math.max(cue.volume, 0), 1);
    const plays = cue.loop === 'COUNT' ? Math.max(cue.loopCount, 1) : 1;
    const track = { cue, source, gain, finished, stopping: false, volume, t0: 0, segment, plays, end: null, fadeUntil: 0 };
    const t0 = ctx.currentTime;
    track.t0 = t0;
    gain.gain.setValueAtTime(cue.fadeInMs > 0 ? 0 : volume, t0);
    if (cue.fadeInMs > 0) gain.gain.linearRampToValueAtTime(volume, t0 + cue.fadeInMs / 1000);
    if (cue.loop === 'NONE') {
      source.start(t0, startSec, segment);
      track.end = t0 + segment;
    } else {
      source.loop = true;
      source.loopStart = startSec;
      source.loopEnd = endSec;
      source.start(t0, startSec);
      if (cue.loop === 'COUNT') { track.end = t0 + segment * plays; source.stop(track.end); }
    }
    this.scheduleEndFade(track, t0 + cue.fadeInMs / 1000);
    source.onended = () => {
      if (this.tracks.get(cue.id) !== track) return;
      this.tracks.delete(cue.id);
      try { gain.disconnect(); } catch {}
      track.finished();
    };
    this.tracks.set(cue.id, track);
    this.started(cue, source);
  }

  // Fade out over the last fadeOutMs before a finite end; an earlier ramp keeps its own timeline.
  scheduleEndFade(track, notBefore) {
    const { cue, gain } = track;
    if (!(cue.fadeOutMs > 0) || track.end === null || track.stopping) return;
    const start = Math.max(track.end - cue.fadeOutMs / 1000, notBefore, this.ctx.currentTime);
    if (start >= track.end) return;
    gain.gain.setValueAtTime(track.volume, start);
    gain.gain.linearRampToValueAtTime(0, track.end);
  }

  hold(param, at) {
    if (typeof param.cancelAndHoldAtTime === 'function') { param.cancelAndHoldAtTime(at); return; }
    const value = param.value;
    param.cancelScheduledValues(at);
    param.setValueAtTime(value, at);
  }

  fade(id, volume, durationMs, stopAtEnd) {
    const track = this.tracks.get(id);
    if (!track) return;
    const ctx = this.ctx;
    // A suspended context cannot run a ramp; nothing is audible, so stop at once.
    if (stopAtEnd && ctx.state !== 'running') { this.stopNow(id, true); return; }
    const now = ctx.currentTime;
    const target = Math.min(Math.max(volume, 0), 1);
    const seconds = Math.max(durationMs, stopAtEnd ? 0 : FADE_ZERO_MS) / 1000;
    const param = track.gain.gain;
    this.hold(param, now);
    const from = param.value;
    const shape = this.curve();
    let until = now + seconds;
    if (shape === 'equal' && seconds > 0) {
      try {
        param.setValueCurveAtTime(fadeCurve(from, target, Math.max(16, Math.ceil(seconds * 200)), 'equal'), now + 0.0005, seconds);
        until = now + 0.0005 + seconds;
      } catch { param.linearRampToValueAtTime(target, until); }
    } else param.linearRampToValueAtTime(target, until);
    track.fadeUntil = until;
    if (stopAtEnd) {
      track.stopping = true;
      try { track.source.stop(until + 0.003); } catch {}
    } else {
      track.volume = target;
      this.scheduleEndFade(track, until + 0.001);
    }
  }

  stopNow(id, complete) {
    const track = this.tracks.get(id);
    if (!track) return;
    this.tracks.delete(id);
    track.source.onended = null;
    try { track.gain.gain.cancelScheduledValues(0); track.gain.gain.setValueAtTime(0, this.ctx.currentTime); } catch {}
    try { track.source.stop(); } catch {}
    try { track.gain.disconnect(); } catch {}
    if (complete) track.finished();
  }

  status() {
    const now = this.ctx.currentTime;
    const out = new Map();
    for (const [id, t] of this.tracks) {
      const elapsedMs = Math.max(0, (now - t.t0) * 1000);
      const remainingMs = t.cue.loop === 'INFINITE' ? null : Math.max(0, (t.end - now) * 1000);
      out.set(id, { elapsedMs, remainingMs, fading: now < t.fadeUntil });
    }
    return out;
  }

  pauseAll() { this.selfSuspended = true; return this.ctx.suspend?.().catch(() => {}); }
  resumeAll() { this.selfSuspended = false; return this.ctx.resume?.().catch(() => {}); }
  release() { for (const id of [...this.tracks.keys()]) this.stopNow(id, false); }
}
