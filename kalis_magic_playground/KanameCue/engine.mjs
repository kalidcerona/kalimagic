// KANAME Cue pure logic: show model, validation, cue engine and audio policy.
// Ported from the Android app (magic-kalicue Model.kt, CueEngine.kt, AudioPolicy.kt) so one show JSON works in both.
// No DOM or Web Audio here; node tests drive it with a fake clock and fake audio.

export const CUE_TYPES = ['AUDIO', 'FADE', 'STOP', 'GOTO'];
export const TRIGGERS = ['MANUAL', 'WITH_PREVIOUS', 'AFTER_PREVIOUS'];
export const LOOP_MODES = ['NONE', 'COUNT', 'INFINITE'];
export const MODE = { EDIT: 'EDIT', RUN: 'RUN', LOCKED: 'LOCKED' };

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}

// Field order matches the Kotlin data classes; Android exports with encodeDefaults, so every field is present.
export function makeCue(values = {}) {
  return {
    id: newId(), number: '1', name: '새 큐', type: 'AUDIO', trigger: 'MANUAL', delayMs: 0,
    audioFileId: '', startMs: 0, endMs: null, loop: 'NONE', loopCount: 1, volume: 1,
    fadeInMs: 0, fadeOutMs: 0, target: 'ALL', targetVolume: 0, durationMs: 300,
    stopAtEnd: false, fadeMs: 300, runNow: false,
    ...values
  };
}
export const makeAudioFile = (values = {}) => ({ id: newId(), displayName: '오디오', ...values });
export const makeSideList = (values = {}) => ({ id: newId(), name: '삽입', cues: [], ...values });
export const makeSettings = (values = {}) => ({ debounceMs: 400, panicFadeMs: 300, ...values });
export function makeShow(values = {}) {
  return {
    id: newId(), name: '새 공연', cues: [], hits: [], inserts: [], keyMap: {},
    settings: makeSettings(), audioFiles: [], ...values
  };
}
export const position = (listId = 'main', index = 0) => ({ listId, index });
const samePosition = (a, b) => a.listId === b.listId && a.index === b.index;
const positionKey = p => p.listId + '\u0000' + p.index;

// Decode like kotlinx Json { ignoreUnknownKeys = true }: unknown keys dropped, missing keys get defaults.
function pick(defaults, raw) {
  const out = {};
  for (const key of Object.keys(defaults)) out[key] = raw && Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : defaults[key];
  return out;
}
function decodeCue(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('잘못된 큐 형식');
  const cue = pick(makeCue({ id: raw.id ?? newId() }), raw);
  if (!CUE_TYPES.includes(cue.type)) throw new Error('잘못된 큐 유형: ' + cue.type);
  if (!TRIGGERS.includes(cue.trigger)) throw new Error('잘못된 트리거: ' + cue.trigger);
  if (!LOOP_MODES.includes(cue.loop)) throw new Error('잘못된 반복: ' + cue.loop);
  for (const key of ['id', 'number', 'name', 'audioFileId', 'target']) if (typeof cue[key] !== 'string') throw new Error('잘못된 값: ' + key);
  for (const key of ['delayMs', 'startMs', 'loopCount', 'volume', 'fadeInMs', 'fadeOutMs', 'targetVolume', 'durationMs', 'fadeMs']) {
    if (typeof cue[key] !== 'number') throw new Error('잘못된 숫자: ' + key);
  }
  if (cue.endMs !== null && typeof cue.endMs !== 'number') throw new Error('잘못된 숫자: endMs');
  for (const key of ['stopAtEnd', 'runNow']) if (typeof cue[key] !== 'boolean') throw new Error('잘못된 값: ' + key);
  return cue;
}
const list = value => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('잘못된 목록 형식');
  return value;
};
export function decodeShow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('공연 JSON 형식이 아닙니다');
  const show = pick(makeShow({ id: raw.id ?? newId() }), raw);
  show.cues = list(raw.cues).map(decodeCue);
  show.hits = list(raw.hits).map(decodeCue);
  show.inserts = list(raw.inserts).map(side => {
    const value = pick(makeSideList({ id: side?.id ?? newId() }), side);
    if (typeof value.name !== 'string') throw new Error('잘못된 삽입 목록');
    return { ...value, cues: list(side.cues).map(decodeCue) };
  });
  show.audioFiles = list(raw.audioFiles).map(file => {
    const value = pick(makeAudioFile({ id: file?.id ?? newId() }), file);
    if (typeof value.displayName !== 'string') throw new Error('잘못된 오디오 목록');
    return value;
  });
  show.settings = pick(makeSettings(), raw.settings ?? {});
  const keyMap = raw.keyMap ?? {};
  if (typeof keyMap !== 'object' || Array.isArray(keyMap)) throw new Error('잘못된 리모컨 형식');
  show.keyMap = {};
  for (const [key, action] of Object.entries(keyMap)) {
    if (!/^-?\d+$/.test(key) || typeof action !== 'string') throw new Error('잘못된 리모컨 형식');
    show.keyMap[String(Number(key))] = action;
  }
  if (typeof show.name !== 'string' || typeof show.id !== 'string') throw new Error('잘못된 공연 이름');
  return show;
}

const allCues = show => [...show.cues, ...show.hits, ...show.inserts.flatMap(side => side.cues)];
const fail = message => { throw new Error(message); };
const require_ = (ok, message) => { if (!ok) fail(message); };
const finite = n => typeof n === 'number' && Number.isFinite(n);

export function validateShow(show) {
  const cues = allCues(show);
  require_(new Set(cues.map(c => c.id)).size === cues.length, '중복된 큐 ID');
  require_(new Set(show.inserts.map(s => s.id)).size === show.inserts.length && show.inserts.every(s => s.id !== 'main' && s.id !== 'hits'), '중복된 목록 ID');
  const audioIds = show.audioFiles.map(f => f.id);
  require_(new Set(audioIds).size === audioIds.length, '중복된 오디오 ID');
  require_(audioIds.every(id => /^[A-Za-z0-9_-]+$/.test(id)), '잘못된 오디오 ID');
  const audioCueIds = new Set(cues.filter(c => c.type === 'AUDIO').map(c => c.id));
  for (const cues_ of [show.cues, show.hits, ...show.inserts.map(s => s.cues)]) {
    for (const cue of cues_) {
      if (cue.type === 'AUDIO') require_(cue.audioFileId.trim() !== '' && audioIds.includes(cue.audioFileId), '오디오 참조를 확인하세요: ' + cue.name);
      else if (cue.type === 'GOTO') require_(cue.target.trim() !== '' && cues_.some(c => c.id === cue.target), '이동할 큐가 없습니다: ' + cue.name);
      else require_(cue.target === 'ALL' || (cue.target.trim() !== '' && audioCueIds.has(cue.target)), '오디오 대상 큐가 없습니다: ' + cue.name);
    }
  }
  for (const [rawKey, action] of Object.entries(show.keyMap)) {
    const key = Number(rawKey);
    let usable = false;
    if (['GO', 'BACK', 'PANIC'].includes(action)) usable = true;
    else if (action.startsWith('HIT:')) usable = [0, 1, 2, 3, 4, 5, 6, 7, 8].some(i => action === 'HIT:' + i && i < show.hits.length);
    else if (action.startsWith('INSERT:')) usable = show.inserts.some(s => action === 'INSERT:' + s.id && s.cues.length > 0);
    require_(key > 0 && ![24, 25, 164].includes(key) && usable, `사용할 수 없는 키 동작: ${key} (${action})`);
  }
  require_(show.settings.debounceMs >= 0 && show.settings.panicFadeMs >= 0, '잘못된 공연 설정');
  for (const c of cues) {
    require_(finite(c.volume) && c.volume >= 0 && c.volume <= 1 && finite(c.targetVolume) && c.targetVolume >= 0 && c.targetVolume <= 1, '잘못된 음량: ' + c.name);
    require_([c.delayMs, c.startMs, c.fadeInMs, c.fadeOutMs, c.durationMs, c.fadeMs].every(n => n >= 0) && (c.endMs === null || c.endMs > c.startMs), '잘못된 시간: ' + c.name);
    require_(c.loopCount > 0, '잘못된 반복 횟수: ' + c.name);
  }
}

// Remove dependent controls rather than silently broadening an audio target to ALL.
export function repairShowReferences(previous, edited) {
  let result = edited;
  for (;;) {
    const before = result;
    const audioIds = new Set(allCues(before).filter(c => c.type === 'AUDIO').map(c => c.id));
    const repair = cues => cues.filter(cue => cue.type === 'GOTO' ? cues.some(c => c.id === cue.target)
      : cue.type === 'AUDIO' ? true : cue.target === 'ALL' || audioIds.has(cue.target));
    result = { ...before, cues: repair(before.cues), hits: repair(before.hits), inserts: before.inserts.map(s => ({ ...s, cues: repair(s.cues) })) };
    const same = result.cues.length === before.cues.length && result.hits.length === before.hits.length
      && result.inserts.every((s, i) => s.cues.length === before.inserts[i].cues.length);
    if (same) { result = before; break; }
  }
  const keyMap = {};
  for (const [key, action] of Object.entries(edited.keyMap)) {
    let repaired = action;
    if (action.startsWith('HIT:')) {
      const old = Number(action.slice(4));
      const id = Number.isInteger(old) ? previous.hits[old]?.id : undefined;
      const index = result.hits.findIndex(c => c.id === id);
      repaired = index >= 0 && index <= 8 ? 'HIT:' + index : null;
    } else if (action.startsWith('INSERT:')) {
      repaired = result.inserts.some(s => action === 'INSERT:' + s.id && s.cues.length > 0) ? action : null;
    }
    if (repaired !== null) keyMap[key] = repaired;
  }
  return { ...result, keyMap };
}

// Keep valid explicit targets; an invalid target requires a fresh user selection.
export function changeCueType(cue, type, show, cues) {
  let valid;
  if (type === 'AUDIO') valid = false;
  else if (type === 'GOTO') valid = cues.some(c => c.id === cue.target);
  else valid = cue.target === 'ALL' || allCues(show).some(c => c.id === cue.target && (c.id === cue.id ? type : c.type) === 'AUDIO');
  return { ...cue, type, target: valid ? cue.target : '' };
}

export function repairReport(previous, edited, repaired) {
  const lists = show => [['메인', show.cues], ['히트', show.hits], ...show.inserts.map(s => ['삽입 ' + s.name, s.cues])];
  const remaining = new Set(lists(repaired).flatMap(([, cues]) => cues.map(c => c.id)));
  const lines = lists(edited).flatMap(([label, cues]) => cues.filter(c => !remaining.has(c.id)).map(c => `삭제: ${label} / ${c.number} ${c.name}`));
  const oldLists = [previous.cues, previous.hits, ...previous.inserts.map(s => s.cues)];
  const describe = c => c ? `${c.number} ${c.name}` : '없음';
  for (const [label, cues] of lists(repaired)) {
    cues.forEach((cue, index) => {
      const oldList = oldLists.find(l => l.some(c => c.id === cue.id));
      const oldIndex = oldList ? oldList.findIndex(c => c.id === cue.id) : -1;
      if (cue.trigger !== 'MANUAL' && oldIndex >= 0) {
        const oldAnchor = oldList[oldIndex - 1];
        const anchor = cues[index - 1];
        if (oldAnchor?.id !== anchor?.id) lines.push(`변경: ${label} / ${cue.number} ${cue.name}: 이전 큐 ${describe(oldAnchor)} → ${describe(anchor)}`);
      }
    });
  }
  if (JSON.stringify(edited.keyMap) !== JSON.stringify(repaired.keyMap)) lines.push('리모컨 연결을 정리했습니다');
  return lines;
}

// Kotlin prettyPrint uses four spaces and prints Float 1f as 1.0; the decoder accepts either form.
export function exportShowBackup(show) {
  validateShow(show);
  return JSON.stringify(show, null, 4);
}
export function importShowBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('JSON을 읽을 수 없습니다'); }
  const show = decodeShow(raw);
  validateShow(show);
  return show;
}

// Audio files live outside the JSON. Match picked files to the show by id first, then by display name.
export function matchAudioFiles(show, files, hasAudio = () => false) {
  const audioFiles = show.audioFiles.map(f => ({ ...f }));
  const assignments = [];
  for (const file of files) {
    const byId = audioFiles.find(f => f.id === file.name || f.id === file.name.replace(/\.[^.]+$/, ''));
    const byName = audioFiles.find(f => f.displayName === file.name && !hasAudio(f.id) && !assignments.some(a => a.id === f.id));
    const target = byId || byName;
    if (target) assignments.push({ id: target.id, file, matched: true });
    else {
      const created = makeAudioFile({ displayName: file.name });
      audioFiles.push(created);
      assignments.push({ id: created.id, file, matched: false });
    }
  }
  return { show: { ...show, audioFiles }, assignments };
}

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
 * Decide whether a devicechange removed an output. When the browser hides device ids (no permission),
 * the lists are opaque, so any change is treated as a possible loss, like Android's becoming-noisy broadcast.
 */
export function outputsLost(before, after) {
  const prev = (before || []).filter(d => d.kind === 'audiooutput');
  const next = (after || []).filter(d => d.kind === 'audiooutput');
  if (next.length < prev.length) return true;
  if (next.length > prev.length) return false; // an output was added
  const opaque = list => list.length === 0 || list.every(d => !d.deviceId);
  if (opaque(prev) || opaque(next)) return true;
  const kept = new Set(next.map(outputSignature));
  return prev.some(d => !kept.has(outputSignature(d)));
}

/** Collapses devicechange and statechange, which fire for the same unplug. */
export class OutputLossGate {
  constructor(now, windowMs = 1500) { this.now = now; this.windowMs = windowMs; this.last = null; }
  accept() {
    const t = this.now();
    if (this.last !== null && t - this.last < this.windowMs) return false;
    this.last = t; return true;
  }
}

/** GO/HIT handler to source.start(), plus the output latency the context reports. */
export class GoTimer {
  constructor(now, maxHistory = 50) { this.now = now; this.maxHistory = maxHistory; this.history = []; this.pending = null; this.last = null; }
  start(label, eventAgeMs = 0) { this.pending = { label, t0: this.now(), eventAgeMs: Math.max(0, eventAgeMs) }; }
  started(cueName, latency = {}) {
    const p = this.pending;
    if (!p) return null;
    this.pending = null;
    const entry = {
      label: p.label, cue: cueName, handlerMs: round(this.now() - p.t0), eventAgeMs: round(p.eventAgeMs),
      outputLatencyMs: latency.outputLatency ? round(latency.outputLatency * 1000) : null,
      baseLatencyMs: latency.baseLatency ? round(latency.baseLatency * 1000) : null
    };
    this.last = entry;
    this.history.push(entry);
    if (this.history.length > this.maxHistory) this.history.shift();
    return entry;
  }
  cancel() { this.pending = null; }
}
const round = n => Math.round(n * 100) / 100;
export function describeTiming(entry) {
  if (!entry) return '';
  const extra = [entry.outputLatencyMs !== null ? `출력 ${entry.outputLatencyMs}ms` : '', entry.baseLatencyMs !== null ? `기본 ${entry.baseLatencyMs}ms` : ''].filter(Boolean).join(', ');
  return `${entry.label} ${(entry.handlerMs + entry.eventAgeMs).toFixed(1)}ms` + (extra ? ` (${extra})` : '');
}

// ---------- keys: Android KeyEvent codes in the JSON, KeyboardEvent.code on the web ----------
const KEYS = {
  Space: 62, Enter: 66, NumpadEnter: 160, Tab: 61, Backspace: 67, Escape: 111, PageUp: 92, PageDown: 93,
  ArrowUp: 19, ArrowDown: 20, ArrowLeft: 21, ArrowRight: 22, Home: 122, End: 123, Delete: 112, Insert: 124,
  MediaTrackNext: 87, MediaTrackPrevious: 88, MediaPlayPause: 85, MediaStop: 86, MediaPlay: 126, MediaPause: 127,
  AudioVolumeUp: 24, AudioVolumeDown: 25, AudioVolumeMute: 164,
  Comma: 55, Period: 56, Minus: 69, Equal: 70, Backquote: 68, BracketLeft: 71, BracketRight: 72, Backslash: 73,
  Semicolon: 74, Quote: 75, Slash: 76
};
for (let i = 0; i < 26; i++) KEYS['Key' + String.fromCharCode(65 + i)] = 29 + i;
for (let i = 0; i < 10; i++) { KEYS['Digit' + i] = 7 + i; KEYS['Numpad' + i] = 144 + i; }
for (let i = 1; i <= 12; i++) KEYS['F' + i] = 130 + i;
// Some clickers report only event.key (code empty).
const KEY_FALLBACK = { ' ': 'Space', Enter: 'Enter', Escape: 'Escape', PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', MediaTrackNext: 'MediaTrackNext', MediaTrackPrevious: 'MediaTrackPrevious', MediaPlayPause: 'MediaPlayPause', AudioVolumeUp: 'AudioVolumeUp', AudioVolumeDown: 'AudioVolumeDown', AudioVolumeMute: 'AudioVolumeMute' };
export const VOLUME_KEYS = [24, 25, 164];
export function androidKeyCode(event) {
  const code = event.code && KEYS[event.code] ? event.code : KEY_FALLBACK[event.key];
  return code ? KEYS[code] : null;
}
const NAMES = Object.fromEntries(Object.entries(KEYS).map(([name, code]) => [code, name]));
const LABELS = { Space: '스페이스', Enter: '엔터', Escape: 'Esc', PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: '위 방향키', ArrowDown: '아래 방향키', ArrowLeft: '왼쪽 방향키', ArrowRight: '오른쪽 방향키', MediaTrackNext: '다음 곡', MediaTrackPrevious: '이전 곡' };
export function keyLabel(code) {
  const name = NAMES[code];
  if (!name) return '키 ' + code;
  return LABELS[name] || name.replace(/^Key/, '').replace(/^Digit/, '');
}
// Android defaults (MainActivity.defaultAction) plus Escape for PANIC on the web.
export function defaultAction(code) {
  if ([93, 62, 66, 160, 22, 20, 87].includes(code)) return 'GO';
  if ([92, 21, 19, 88].includes(code)) return 'BACK';
  if (code === 111) return 'PANIC';
  return null;
}
export const keyAction = (show, code) => code === null ? null : (show.keyMap[String(code)] ?? defaultAction(code));

// ---------- cue engine (CueEngine.kt) ----------
/** All calls, scheduler actions and audio callbacks run on the page's single thread. */
export class CueEngine {
  constructor(show, audio, clock, saved = { standby: position(), stack: [] }, persist = () => {}, event = () => {}, changed = () => {}) {
    this.show = show; this.audio = audio; this.clock = clock;
    this.persist = persist; this.event = event; this.changed = changed;
    this.mode = MODE.EDIT;
    this.position = { ...(saved.standby || position()) };
    this.stack = (saved.stack || []).map(p => ({ ...p }));
    this.active = new Map();
    this.pending = new Map();
    this.serial = 0; this.generation = 0; this.lastGo = null;
    this.instances = new Map(); this.runSerial = 0;
    this.paused = false; this.droppedOnLoss = 0;
    this.normalize(); this.save();
  }
  get pendingCount() { return this.pending.size; }
  get insertStack() { return this.stack.map(p => ({ ...p })); }
  list(id = this.position.listId) {
    if (id === 'main') return this.show.cues;
    if (id === 'hits') return this.show.hits.slice(0, 9);
    return this.show.inserts.find(s => s.id === id)?.cues ?? [];
  }
  standby() { return this.list()[this.position.index] ?? null; }
  next() { return this.list().slice(this.position.index + 1).find(c => c.trigger === 'MANUAL') ?? null; }
  snapshot() { return { standby: { ...this.position }, stack: this.insertStack }; }
  setMode(value) { this.mode = value; if (value === MODE.EDIT) this.panic(); this.changed(); }
  normalize() {
    if (this.position.listId !== 'main' && !this.show.inserts.some(s => s.id === this.position.listId)) this.position = position();
    this.position = { ...this.position, index: Math.min(Math.max(this.position.index, 0), this.list().length) };
  }
  save() {
    this.normalize();
    try { this.persist(this.snapshot()); } catch (e) { this.error(e?.message || '위치 저장 실패'); }
    this.changed();
  }
  go() {
    if (this.mode === MODE.EDIT) return false;
    if (this.paused) return this.resume();
    const now = this.clock.now();
    if (this.lastGo !== null && now - this.lastGo < this.show.settings.debounceMs) { this.event({ type: 'Rejected' }); return false; }
    const cue = this.standby();
    if (!cue) return false;
    this.lastGo = now;
    const origin = { ...this.position };
    this.advance(origin);
    this.event({ type: 'Accepted' });
    this.launch(origin, cue, new Set());
    this.save();
    return true;
  }
  advance(origin) {
    const cues = this.list(origin.listId);
    let next = origin.index + 1;
    while (next < cues.length && cues[next].trigger !== 'MANUAL') next++;
    this.position = { ...origin, index: next };
  }
  later(delay, action) {
    if (delay <= 0) { action(); return; }
    const id = ++this.serial;
    this.pending.set(id, this.clock.schedule(delay, () => { this.pending.delete(id); action(); this.changed(); }));
    this.changed();
  }
  launch(origin, cue, gotoPath) {
    let current = origin;
    let next = cue;
    while (next) {
      const scheduledOrigin = current, scheduledCue = next, epoch = this.generation;
      this.later(Math.max(scheduledCue.delayMs, 0), () => {
        if (epoch === this.generation) this.execute(scheduledOrigin, scheduledCue, gotoPath, epoch);
      });
      current = { ...current, index: current.index + 1 };
      const candidate = this.list(origin.listId)[current.index];
      next = candidate && candidate.trigger === 'WITH_PREVIOUS' ? candidate : null;
    }
  }
  execute(origin, cue, gotoPath, epoch) {
    if (cue.type === 'GOTO' && gotoPath.has(positionKey(origin))) { this.error('GOTO 반복 한도 초과'); return; }
    const token = ++this.runSerial;
    let completed = false;
    const complete = () => {
      if (epoch !== this.generation || completed) return;
      completed = true;
      if (origin.listId === 'hits') return;
      const next = this.list(origin.listId)[origin.index + 1];
      if (next?.trigger === 'AFTER_PREVIOUS') this.launch({ ...origin, index: origin.index + 1 }, next, gotoPath);
      this.changed();
    };
    const release = () => { if (this.instances.get(cue.id) === token) { this.active.delete(cue.id); this.instances.delete(cue.id); } };
    try {
      if (cue.type === 'AUDIO') {
        this.active.set(cue.id, cue); this.instances.set(cue.id, token);
        this.audio.play(cue, () => { release(); complete(); }, message => { release(); this.error(message); complete(); });
      } else if (cue.type === 'FADE' || cue.type === 'STOP') {
        const targets = cue.target === 'ALL' ? [...this.active.keys()] : [cue.target].filter(id => this.active.has(id));
        if (targets.length === 0) this.error('재생 중인 대상이 없습니다: ' + cue.target);
        for (const id of targets) {
          const stop = cue.type === 'STOP' || cue.stopAtEnd;
          const duration = Math.max(cue.type === 'STOP' ? Math.max(cue.fadeMs, this.active.get(id)?.fadeOutMs ?? 0) : cue.durationMs, 0);
          const volume = cue.type === 'STOP' ? 0 : Math.min(Math.max(cue.targetVolume, 0), 1);
          this.audio.fade(id, volume, stop ? stopRampMs(duration) : duration, stop);
        }
        complete();
      } else if (cue.type === 'GOTO') {
        const index = this.list(origin.listId).findIndex(c => c.id === cue.target);
        if (index < 0) this.error('이동할 큐가 없습니다: ' + cue.target);
        else if (origin.listId === 'hits') {
          if (cue.runNow) {
            const target = this.list('hits')[index];
            const path = new Set(gotoPath); path.add(positionKey(origin));
            this.later(Math.max(target.delayMs, 0), () => { if (epoch === this.generation) this.execute(position('hits', index), target, path, epoch); });
          }
        } else {
          this.position = position(origin.listId, index);
          if (cue.runNow) {
            const path = new Set(gotoPath); path.add(positionKey(origin));
            this.advance(this.position);
            this.launch(position(origin.listId, index), this.list(origin.listId)[index], path);
          }
          this.save();
        }
        complete();
      }
    } catch (e) { this.active.delete(cue.id); this.error(e?.message || '큐 실행 오류'); complete(); }
    if (origin.listId !== 'main' && origin.listId !== 'hits' && origin.index === this.list(origin.listId).length - 1) {
      // A nested insert may own standby while this insert's delayed final cue fires.
      if (origin.listId === this.position.listId && this.position.index >= this.list().length && this.stack.length > 0) {
        this.position = this.stack.pop();
        this.save();
      } else {
        let saved = -1;
        for (let i = this.stack.length - 1; i >= 0; i--) {
          if (this.stack[i].listId === origin.listId && this.stack[i].index >= this.list(origin.listId).length) { saved = i; break; }
        }
        if (saved >= 0) { this.stack.splice(saved, 1); this.save(); }
      }
    }
    this.changed();
  }
  back() {
    if (this.mode === MODE.EDIT) return;
    const cues = this.list();
    let index = -1;
    for (let i = Math.min(this.position.index, cues.length) - 1; i >= 0; i--) if (cues[i].trigger === 'MANUAL') { index = i; break; }
    if (index < 0) return;
    this.position = { ...this.position, index }; this.save();
  }
  hit(index) {
    if (this.mode === MODE.EDIT) return;
    if (this.paused) { this.event({ type: 'Rejected' }); return; }
    const cue = this.show.hits.slice(0, 9)[index];
    if (cue) this.execute(position('hits', index), cue, new Set(), this.generation);
  }
  insert(id) {
    if (this.mode === MODE.EDIT || !this.show.inserts.some(s => s.id === id && s.cues.length > 0)) return;
    this.stack.push({ ...this.position }); this.position = position(id, 0); this.save();
  }
  panic() {
    this.generation++;
    for (const handle of this.pending.values()) handle.cancel();
    this.pending.clear();
    this.paused = false;
    for (const id of [...this.active.keys()]) this.audio.fade(id, 0, stopRampMs(Math.max(this.show.settings.panicFadeMs, 0)), true);
    // Cancelled insert tails cannot execute their normal return path.
    this.stack = this.stack.filter(p => !(p.listId !== 'main' && p.index >= this.list(p.listId).length));
    while (this.position.listId !== 'main' && this.position.index >= this.list().length && this.stack.length > 0) this.position = this.stack.pop();
    this.save();
  }
  /**
   * Output device removed. Active cues are paused and stay resumable; delayed (not yet started) cues are dropped
   * because they would otherwise start on the phone speaker. Returns false when nothing was playing or scheduled.
   */
  outputLost() {
    if (this.mode === MODE.EDIT || this.paused || (this.active.size === 0 && this.pending.size === 0)) return false;
    this.droppedOnLoss = this.pending.size;
    for (const handle of this.pending.values()) handle.cancel();
    this.pending.clear();
    this.paused = true; this.audio.pauseAll?.(); this.changed();
    return true;
  }
  resume() {
    if (!this.paused) return false;
    this.paused = false; this.audio.resumeAll?.(); this.event({ type: 'Accepted' }); this.changed();
    return true;
  }
  error(message) { this.event({ type: 'Error', message }); this.changed(); }
}
