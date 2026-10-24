import { BUILTIN_LISTS, builtinById } from './builtin-lists.js';
import { MSG, MAX_ITEMS, MAX_CHARS, charLength } from './logic-core.js';
import { insertForceItem, splitForcePreset } from './logic-presets.js';
import {
  normalizeDummyNotes, normalizeSets, normalizeHiddenIds, normalizeBuiltins,
} from './logic-extras.js';
import { resolveChoice } from './logic-fake-home.js';

export const NOTE_MAX_ITEMS = 100;
export const NOTE_MIN_ITEMS = 2;
export const NOTE_LIST_LIMIT = 30;
export const LONG_ITEM_CHARS = 60;

/** A list can be a note when it has a target, no blank items and 2-100 items in total. */
export function isNoteEligible(preset, maxItems = NOTE_MAX_ITEMS) {
  if (!preset || !Array.isArray(preset.items)) return false;
  const split = splitForcePreset(preset);
  if (typeof split.forceItem !== 'string' || split.forceItem.trim() === '') return false;
  if (!split.items.every((item) => typeof item === 'string' && item.trim() !== '')) return false;
  const total = split.items.length + 1;
  return total >= NOTE_MIN_ITEMS && total <= maxItems;
}

/** Pre-show check rows for the settings screen. Pure: no storage or DOM access. */
export function buildPrecheck(presets, { maxItems = NOTE_MAX_ITEMS } = {}) {
  const list = Array.isArray(presets) ? presets : [];
  const notes = list.map((preset) => {
    const split = Array.isArray(preset?.items) ? splitForcePreset(preset) : { items: [], forceItem: '' };
    const hasTarget = typeof split.forceItem === 'string' && split.forceItem.trim() !== '';
    return {
      id: preset?.id ?? null,
      name: typeof preset?.name === 'string' ? preset.name : '',
      itemCount: split.items.length + (hasTarget ? 1 : 0),
      hasTarget,
      eligible: isNoteEligible(preset, maxItems)
    };
  });
  return {
    noteCount: notes.length,
    eligibleCount: notes.filter((note) => note.eligible).length,
    missingTargets: notes.filter((note) => !note.hasTarget).length,
    notes
  };
}

/**
 * Notes shown on the fake home. With an active set, only that set's lists and dummy notes,
 * in the set's order. Without one, every eligible list in saved order and every dummy note.
 * Returns plain snapshots so later edits never reach a running show.
 */
export function builtinNote(id, settings) {
  const list = builtinById(id);
  if (!list) return null;
  const target = normalizeBuiltins({ [id]: settings })[id].target;
  const items = list.items.slice();
  const [forceItem] = items.splice(target - 1, 1);
  // A fixed old date keeps the ready made lists below the performer's own lists in the index.
  return { kind: 'force', id, name: list.name, items, forceItem, updatedAt: 1735689600000, builtin: true };
}

export function selectNotes(state, { limit = NOTE_LIST_LIMIT, maxItems = NOTE_MAX_ITEMS } = {}) {
  const presets = Array.isArray(state?.presets) ? state.presets : [];
  const dummies = normalizeDummyNotes(state?.dummyNotes);
  const sets = normalizeSets(state?.sets);
  const builtins = normalizeBuiltins(state?.builtins);
  const active = sets.find((set) => set.id === state?.activeSetId) || null;
  let pickedPresets = presets;
  let pickedDummies = dummies;
  let pickedBuiltinIds = BUILTIN_LISTS.map((list) => list.id);
  if (active) {
    pickedPresets = active.presetIds.map((id) => presets.find((preset) => preset?.id === id)).filter(Boolean);
    pickedDummies = active.dummyIds.map((id) => dummies.find((note) => note.id === id)).filter(Boolean);
    pickedBuiltinIds = active.presetIds.filter((id) => builtinById(id));
  }
  const hidden = new Set(normalizeHiddenIds(state?.hiddenPresetIds));
  const eligible = pickedPresets.filter((preset) => !hidden.has(preset.id) && isNoteEligible(preset, maxItems));
  const forced = eligible.slice(0, limit).map((preset) => {
    const split = splitForcePreset(preset);
    return {
      kind: 'force',
      id: preset.id,
      name: preset.name,
      items: split.items,
      forceItem: split.forceItem,
      updatedAt: preset.updatedAt
    };
  });
  const ready = pickedBuiltinIds.filter((id) => builtins[id].enabled).map((id) => builtinNote(id, builtins[id]));
  const plain = pickedDummies.slice(0, limit).map((note) => ({
    kind: 'dummy', id: note.id, name: note.title, body: note.body, updatedAt: note.updatedAt
  }));
  const index = forced.concat(ready, plain)
    .map((note, order) => ({ note, order }))
    .sort((left, right) => (right.note.updatedAt || 0) - (left.note.updatedAt || 0) || left.order - right.order)
    .map((entry) => entry.note);
  return {
    notes: index,
    forceCount: forced.length + ready.length,
    truncated: eligible.length > limit,
    setName: active ? active.name : null
  };
}

/** Lines of a note for an entered number (see resolveChoice). */
export function noteLines(note, value) {
  const resolved = resolveChoice(value, note.items.length + 1);
  if (!resolved) return { ok: false, error: MSG.badChoice };
  const forced = insertForceItem(note.items.slice(), note.forceItem, resolved.choice);
  if (!forced.ok) return { ok: false, error: forced.error };
  return { ok: true, items: forced.items, choice: resolved.choice, inRange: resolved.inRange, last: resolved.last };
}

/**
 * Checks a list before it is saved and builds the numbered preview.
 * errors block saving, warnings are shown and need an explicit confirm.
 * The preview puts the target at the last number as an example; at show time it goes
 * to whatever number the spectator picks.
 */
export function validateListInput(input, { otherForceItems = [] } = {}) {
  const errors = [];
  const warnings = [];
  const text = typeof input?.itemsText === 'string' ? input.itemsText : '';
  const force = typeof input?.forceItem === 'string' ? input.forceItem.trim() : '';
  const lines = text.length ? text.split(/\r?\n/) : [];
  const items = [];
  let blank = 0;
  const longLines = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      blank += 1;
      return;
    }
    items.push(trimmed);
    const length = charLength(trimmed);
    if (length > MAX_CHARS) errors.push(`${items.length}번 항목이 ${MAX_CHARS}자를 넘습니다.`);
    else if (length > LONG_ITEM_CHARS) longLines.push(items.length);
  });
  // Trailing newline in a textarea is not a blank line the performer typed on purpose.
  if (lines.length && !lines[lines.length - 1].trim()) blank -= 1;
  if (items.length === 0) errors.push(MSG.emptyList);
  if (items.length > MAX_ITEMS - 1) errors.push(MSG.tooManyItems);
  if (!force) errors.push(MSG.needForce);
  else if (charLength(force) > MAX_CHARS) errors.push(`예언 항목이 ${MAX_CHARS}자를 넘습니다.`);
  if (blank > 0) warnings.push({ code: 'blank-lines', message: `빈 줄 ${blank}개는 저장하지 않고 건너뜁니다. 번호가 한 칸씩 당겨집니다.` });
  if (longLines.length) {
    warnings.push({ code: 'long-items', message: `${longLines.slice(0, 5).join(', ')}번 항목이 ${LONG_ITEM_CHARS}자보다 깁니다. 공개 화면에서 여러 줄로 보입니다.` });
  }
  const seen = new Map();
  items.forEach((item, index) => {
    const key = item.toLocaleLowerCase('ko-KR');
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(index + 1);
  });
  const dupes = [...seen.values()].filter((numbers) => numbers.length > 1);
  if (dupes.length) {
    const sample = dupes.slice(0, 3).map((numbers) => `${numbers.join('번, ')}번`).join(' / ');
    warnings.push({ code: 'duplicate-items', message: `같은 항목이 겹칩니다: ${sample}${dupes.length > 3 ? ' 외' : ''}.` });
  }
  if (force) {
    const same = seen.get(force.toLocaleLowerCase('ko-KR'));
    if (same) warnings.push({ code: 'force-in-items', message: `예언 항목과 같은 문장이 항목 ${same.join('번, ')}번에 있습니다. 어느 줄이 예언 항목인지 드러날 수 있습니다.` });
    if (otherForceItems.some((other) => typeof other === 'string' && other.trim().toLocaleLowerCase('ko-KR') === force.toLocaleLowerCase('ko-KR'))) {
      warnings.push({ code: 'force-in-other-list', message: '다른 목록에도 같은 예언 항목이 있습니다.' });
    }
  }
  const total = items.length + (force ? 1 : 0);
  if (total > NOTE_MAX_ITEMS) warnings.push({ code: 'too-long-for-notes', message: `항목이 ${total}개라 노트 연출에는 쓸 수 없습니다. 노트는 ${NOTE_MIN_ITEMS}개에서 ${NOTE_MAX_ITEMS}개까지입니다.` });
  const preview = items.map((item, index) => ({ number: index + 1, text: item, force: false }));
  if (force) preview.push({ number: items.length + 1, text: force, force: true });
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    items,
    preview,
    counts: { lines: lines.length, blank, items: items.length, total }
  };
}
