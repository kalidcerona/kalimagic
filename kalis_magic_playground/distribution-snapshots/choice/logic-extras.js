import { BUILTIN_LISTS } from './builtin-lists.js';
import { MAX_NAME } from './logic-core.js';

export const MAX_SETS = 20;
export const MAX_DUMMIES = 30;
const MAX_DUMMY_TITLE = 40;
const MAX_DUMMY_BODY = 2000;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')).slice(0, max).join('');
}

export function normalizeDummyNote(entry, fallbackId) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const title = cleanText(entry.title, MAX_DUMMY_TITLE).trim();
  const body = cleanText(entry.body, MAX_DUMMY_BODY).replace(/\s+$/, '');
  if (!title) return null;
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id : fallbackId;
  if (!id) return null;
  return { id, title, body, updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0 };
}

export function normalizeDummyNotes(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const notes = [];
  raw.forEach((entry, index) => {
    const note = normalizeDummyNote(entry, `dm_legacy_${index}`);
    if (!note || seen.has(note.id) || notes.length >= MAX_DUMMIES) return;
    seen.add(note.id);
    notes.push(note);
  });
  return notes;
}

export function normalizeSets(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const sets = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    if (typeof entry.id !== 'string' || !entry.id.trim() || seen.has(entry.id)) continue;
    const name = cleanText(entry.name, MAX_NAME).trim();
    if (!name || sets.length >= MAX_SETS) continue;
    const ids = (value) => (Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string' && id))] : []);
    seen.add(entry.id);
    sets.push({ id: entry.id, name, presetIds: ids(entry.presetIds), dummyIds: ids(entry.dummyIds) });
  }
  return sets;
}

/** Settings of the ready made lists: shown in the notes app or not, and which item is the target (1 based). */
/** Ids of the performer's own lists that are switched off for the notes app (an optional, additive field). */
export function normalizeHiddenIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id) => typeof id === 'string' && id))];
}

export function normalizeBuiltins(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const list of BUILTIN_LISTS) {
    const entry = input[list.id] && typeof input[list.id] === 'object' ? input[list.id] : {};
    const target = Number.isInteger(entry.target) && entry.target >= 1 && entry.target <= list.items.length ? entry.target : list.defaultTarget;
    out[list.id] = { enabled: entry.enabled === false ? false : true, target };
  }
  return out;
}

// ----- Dummy notes and sets --------------------------------------------------------------

export function addDummyNote(state, input, { now = Date.now(), rand = Math.random() } = {}) {
  const notes = normalizeDummyNotes(state?.dummyNotes);
  if (notes.length >= MAX_DUMMIES) return { ok: false, error: `일상 메모는 ${MAX_DUMMIES}개까지 만들 수 있습니다.` };
  const note = normalizeDummyNote({ ...input, id: `dm_${now.toString(36)}_${Math.floor(rand * 1e9).toString(36)}`, updatedAt: input?.updatedAt ?? now }, null);
  if (!note) return { ok: false, error: '일상 메모 제목을 입력하세요.' };
  if (notes.some((entry) => entry.title === note.title)) return { ok: false, error: '같은 제목의 일상 메모가 있습니다.' };
  return { ok: true, note, dummyNotes: notes.concat(note) };
}

export function updateDummyNote(state, id, input) {
  const notes = normalizeDummyNotes(state?.dummyNotes);
  const current = notes.find((note) => note.id === id);
  if (!current) return { ok: false, error: '일상 메모를 찾을 수 없습니다.' };
  const next = normalizeDummyNote({ ...current, ...input, id, updatedAt: input?.updatedAt ?? current.updatedAt }, id);
  if (!next) return { ok: false, error: '일상 메모 제목을 입력하세요.' };
  if (notes.some((note) => note.id !== id && note.title === next.title)) return { ok: false, error: '같은 제목의 일상 메모가 있습니다.' };
  return { ok: true, note: next, dummyNotes: notes.map((note) => (note.id === id ? next : note)) };
}

export function deleteDummyNote(state, id) {
  const notes = normalizeDummyNotes(state?.dummyNotes);
  if (!notes.some((note) => note.id === id)) return { ok: false, error: '일상 메모를 찾을 수 없습니다.' };
  const sets = normalizeSets(state?.sets).map((set) => ({ ...set, dummyIds: set.dummyIds.filter((entry) => entry !== id) }));
  return { ok: true, dummyNotes: notes.filter((note) => note.id !== id), sets };
}

export function saveSet(state, input, { now = Date.now(), rand = Math.random() } = {}) {
  const sets = normalizeSets(state?.sets);
  const name = cleanText(input?.name, MAX_NAME).trim();
  if (!name) return { ok: false, error: '묶음 이름을 입력하세요.' };
  const presetIds = new Set([...(state?.presets || []).map((preset) => preset.id), ...BUILTIN_LISTS.map((list) => list.id)]);
  const dummyIds = new Set(normalizeDummyNotes(state?.dummyNotes).map((note) => note.id));
  const next = {
    id: input?.id || `st_${now.toString(36)}_${Math.floor(rand * 1e9).toString(36)}`,
    name,
    presetIds: (input?.presetIds || []).filter((id) => presetIds.has(id)),
    dummyIds: (input?.dummyIds || []).filter((id) => dummyIds.has(id))
  };
  if (sets.some((set) => set.id !== next.id && set.name === name)) return { ok: false, error: '같은 이름의 묶음이 있습니다.' };
  const exists = sets.some((set) => set.id === next.id);
  if (!exists && sets.length >= MAX_SETS) return { ok: false, error: `묶음은 ${MAX_SETS}개까지 만들 수 있습니다.` };
  const merged = exists ? sets.map((set) => (set.id === next.id ? next : set)) : sets.concat(next);
  return { ok: true, set: next, sets: merged };
}

export function deleteSet(state, id) {
  const sets = normalizeSets(state?.sets);
  if (!sets.some((set) => set.id === id)) return { ok: false, error: '묶음을 찾을 수 없습니다.' };
  return { ok: true, sets: sets.filter((set) => set.id !== id), activeSetId: state.activeSetId === id ? null : state.activeSetId ?? null };
}

export { cleanText };
