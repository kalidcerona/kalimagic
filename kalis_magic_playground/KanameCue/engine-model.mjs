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

// Audio files live outside the JSON. Match picked files to the show by id first, then by display name,
// so picking a corrected file with the same name replaces the stored audio instead of adding a duplicate.
export function matchAudioFiles(show, files) {
  const audioFiles = show.audioFiles.map(f => ({ ...f }));
  const assignments = [];
  for (const file of files) {
    const byId = audioFiles.find(f => f.id === file.name || f.id === file.name.replace(/\.[^.]+$/, ''));
    const byName = audioFiles.find(f => f.displayName === file.name && !assignments.some(a => a.id === f.id));
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

export { positionKey };
