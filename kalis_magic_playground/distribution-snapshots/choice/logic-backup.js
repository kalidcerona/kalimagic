import { MAX_NAME } from './logic-core.js';
import { makeId, splitForcePreset } from './logic-presets.js';
import { MAX_SETS, MAX_DUMMIES, normalizeDummyNotes, normalizeSets } from './logic-extras.js';
import { recoverPreset, serializeState } from './logic-storage.js';

// ----- Backup and import -----------------------------------------------------------------

export const BACKUP_FORMAT = 'magic-choice-backup';

export function buildBackup(state, now = Date.now()) {
  const serialized = JSON.parse(serializeState(state));
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now,
    presets: serialized.presets,
    sets: serialized.sets,
    dummyNotes: serialized.dummyNotes
  };
}

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_PRESETS = 500;
export const IMPORT_MAX_DUMMIES = 200;
export const IMPORT_MAX_SETS = 100;

export function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: '파일이 비어 있습니다.' };
  if (text.length > IMPORT_MAX_BYTES) return { ok: false, error: '파일이 너무 큽니다. 2MB 이하의 백업 파일만 가져올 수 있습니다.' };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: '백업 파일을 읽을 수 없습니다. JSON 형식이 아닙니다.' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: '이 앱의 백업 파일이 아닙니다.' };
  }
  if (parsed.version !== 1) return { ok: false, error: '지원하지 않는 백업 버전입니다.' };
  if (!Array.isArray(parsed.presets)) return { ok: false, error: '백업 파일에 목록이 없습니다.' };
  const arrayLength = (value) => (Array.isArray(value) ? value.length : 0);
  if (parsed.presets.length > IMPORT_MAX_PRESETS || arrayLength(parsed.dummyNotes) > IMPORT_MAX_DUMMIES || arrayLength(parsed.sets) > IMPORT_MAX_SETS) {
    return { ok: false, error: `백업 파일의 항목이 너무 많습니다. 목록 ${IMPORT_MAX_PRESETS}개, 일상 메모 ${IMPORT_MAX_DUMMIES}개, 묶음 ${IMPORT_MAX_SETS}개까지 가져올 수 있습니다.` };
  }
  const issues = [];
  const presets = [];
  parsed.presets.forEach((entry, index) => {
    const recovered = recoverPreset(entry, index);
    if (!recovered.ok) issues.push(recovered.issue);
    else presets.push(recovered.preset);
  });
  return {
    ok: true,
    backup: {
      presets,
      sets: normalizeSets(parsed.sets),
      dummyNotes: normalizeDummyNotes(parsed.dummyNotes)
    },
    issues
  };
}

function presetFingerprint(preset) {
  const split = splitForcePreset(preset);
  return JSON.stringify([preset.name, preset.appearance, split.items, split.forceItem]);
}

function uniqueName(base, taken, max = MAX_NAME) {
  const clip = (value) => Array.from(value).slice(0, max).join('');
  if (!taken.has(base)) return base;
  for (let n = 1; n < 1000; n += 1) {
    const suffix = n === 1 ? ' (가져옴)' : ` (가져옴 ${n})`;
    const room = Math.max(1, max - Array.from(suffix).length);
    const candidate = Array.from(base).slice(0, room).join('') + suffix;
    if (!taken.has(candidate)) return clip(candidate);
  }
  return base;
}

/**
 * Previews what a merge import would do. Nothing already saved is replaced:
 * identical entries are skipped, differing ones come in as renamed copies.
 */
export function planImport(state, backup, { now = Date.now(), rand = Math.random } = {}) {
  const current = Array.isArray(state?.presets) ? state.presets : [];
  const takenNames = new Set(current.map((preset) => preset.name));
  const takenIds = new Set(current.map((preset) => preset.id));
  const idMap = new Map();
  const presets = [];
  backup.presets.forEach((incoming, index) => {
    const sameId = current.find((preset) => preset.id === incoming.id);
    const sameName = current.find((preset) => preset.name === incoming.name);
    const identical = [sameId, sameName].find((preset) => preset && presetFingerprint(preset) === presetFingerprint(incoming));
    if (identical) {
      idMap.set(incoming.id, identical.id);
      presets.push({ action: 'skip', name: incoming.name, reason: '이미 같은 목록이 있습니다.' });
      return;
    }
    const needsId = takenIds.has(incoming.id);
    const newId = needsId ? makeId(now + index, rand()) : incoming.id;
    const newName = uniqueName(incoming.name, takenNames);
    takenIds.add(newId);
    takenNames.add(newName);
    idMap.set(incoming.id, newId);
    presets.push({
      action: newName === incoming.name && !needsId ? 'add' : 'add-copy',
      name: incoming.name,
      newName,
      preset: { ...incoming, id: newId, name: newName, items: incoming.items.slice() },
      reason: newName === incoming.name && !needsId ? '' : '같은 이름 또는 번호가 있어 사본으로 추가합니다.'
    });
  });
  const currentSets = normalizeSets(state?.sets);
  const setNames = new Set(currentSets.map((set) => set.name));
  const setIds = new Set(currentSets.map((set) => set.id));
  const currentDummies = normalizeDummyNotes(state?.dummyNotes);
  const dummyIds = new Set(currentDummies.map((note) => note.id));
  const dummyMap = new Map();
  const dummies = [];
  let dummyRoom = MAX_DUMMIES - currentDummies.length;
  backup.dummyNotes.forEach((incoming, index) => {
    const twin = currentDummies.find((note) => note.id === incoming.id || (note.title === incoming.title && note.body === incoming.body));
    if (twin && twin.title === incoming.title && twin.body === incoming.body) {
      dummyMap.set(incoming.id, twin.id);
      dummies.push({ action: 'skip', name: incoming.title, reason: '이미 같은 일상 메모가 있습니다.' });
      return;
    }
    if (dummyRoom <= 0) {
      dummies.push({ action: 'full', name: incoming.title, reason: `일상 메모는 ${MAX_DUMMIES}개까지라 가져오지 못합니다. 지금 있는 일상 메모를 정리한 뒤 다시 가져오세요.` });
      return;
    }
    dummyRoom -= 1;
    const newId = dummyIds.has(incoming.id) ? makeId(now + 500 + index, rand()).replace('mc_', 'dm_') : incoming.id;
    dummyIds.add(newId);
    dummyMap.set(incoming.id, newId);
    dummies.push({ action: newId === incoming.id ? 'add' : 'add-copy', name: incoming.title, note: { ...incoming, id: newId }, reason: '' });
  });
  const sets = [];
  let setRoom = MAX_SETS - currentSets.length;
  backup.sets.forEach((incoming, index) => {
    const mapped = {
      presetIds: incoming.presetIds.map((id) => idMap.get(id)).filter(Boolean),
      dummyIds: incoming.dummyIds.map((id) => dummyMap.get(id)).filter(Boolean)
    };
    const twin = currentSets.find((set) => set.name === incoming.name
      && JSON.stringify([set.presetIds, set.dummyIds]) === JSON.stringify([mapped.presetIds, mapped.dummyIds]));
    if (twin) {
      sets.push({ action: 'skip', name: incoming.name, reason: '이미 같은 묶음이 있습니다.' });
      return;
    }
    if (setRoom <= 0) {
      sets.push({ action: 'full', name: incoming.name, reason: `묶음은 ${MAX_SETS}개까지라 가져오지 못합니다. 지금 있는 묶음을 정리한 뒤 다시 가져오세요.` });
      return;
    }
    setRoom -= 1;
    const newId = setIds.has(incoming.id) ? makeId(now + 900 + index, rand()).replace('mc_', 'st_') : incoming.id;
    const newName = uniqueName(incoming.name, setNames);
    setIds.add(newId);
    setNames.add(newName);
    sets.push({
      action: newName === incoming.name && newId === incoming.id ? 'add' : 'add-copy',
      name: incoming.name,
      newName,
      set: { id: newId, name: newName, presetIds: [...new Set(mapped.presetIds)], dummyIds: [...new Set(mapped.dummyIds)] },
      reason: ''
    });
  });
  const count = (list, action) => list.filter((entry) => entry.action === action).length;
  return {
    presets, dummies, sets,
    counts: {
      added: [presets, dummies, sets].reduce((sum, list) => sum + list.filter((entry) => entry.action === 'add' || entry.action === 'add-copy').length, 0),
      skipped: [presets, dummies, sets].reduce((sum, list) => sum + count(list, 'skip'), 0),
      dropped: [presets, dummies, sets].reduce((sum, list) => sum + count(list, 'full'), 0),
      copies: [presets, dummies, sets].reduce((sum, list) => sum + count(list, 'add-copy'), 0)
    }
  };
}

/** Applies a plan by appending only. Existing lists, sets and dummy notes are kept as they are. */
export function applyImportPlan(state, plan) {
  return {
    ...state,
    presets: state.presets.concat(plan.presets.filter((entry) => entry.preset).map((entry) => entry.preset)),
    sets: normalizeSets(state.sets).concat(plan.sets.filter((entry) => entry.set).map((entry) => entry.set)),
    dummyNotes: normalizeDummyNotes(state.dummyNotes).concat(plan.dummies.filter((entry) => entry.note).map((entry) => entry.note))
  };
}
