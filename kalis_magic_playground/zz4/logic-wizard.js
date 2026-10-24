import { BUILTIN_LISTS } from './builtin-lists.js';
import { MAX_CHARS, charLength } from './logic-core.js';
import { splitForcePreset } from './logic-presets.js';
import { normalizeSets, normalizeHiddenIds, normalizeBuiltins } from './logic-extras.js';
import { isNoteEligible, selectNotes } from './logic-notes.js';

// ----- Settings home, list wizard and previews (no change to what is stored) ---------------

export const WIZARD_MIN_ITEMS = 2;
export const WIZARD_MAX_ITEMS = 100;

const LIST_PREFIX = /^(?:\d{1,3}[.)]\s+|[-*\u2022]\s+)/;

/** The text with a leading "1. " or "- " removed from every line (the explicit "번호 지우기" action and fresh pasted input). */
export function stripItemPrefixes(text) {
  return (typeof text === 'string' ? text.split(/\r?\n/) : []).map((line) => line.replace(LIST_PREFIX, '')).join('\n');
}

/** Items typed or pasted: one per line, blank lines dropped. A leading "1. " or "- " is removed unless stripPrefix is false (items loaded from a saved list stay as they are). One pass trims, strips and finds the first over-long line. */
export function parseWizardItems(text, { stripPrefix = true } = {}) {
  const raw = typeof text === 'string' ? text.split(/\r?\n/) : [];
  const items = [];
  let tooLongAt = null;
  for (let index = 0; index < raw.length; index += 1) {
    let trimmed = raw[index].trim();
    if (!trimmed) continue;
    if (stripPrefix) {
      trimmed = trimmed.replace(LIST_PREFIX, '').trim();
      if (!trimmed) continue;
    }
    if (tooLongAt == null && charLength(trimmed) > MAX_CHARS) tooLongAt = items.length + 1;
    items.push(trimmed);
  }
  const count = items.length;
  const ok = count >= WIZARD_MIN_ITEMS && count <= WIZARD_MAX_ITEMS && tooLongAt == null;
  return { items, count, ok, tooLongAt };
}

/** The full list of a saved preset with its prophecy item back inside (a list that kept the target in place keeps it there). */
export function presetFullList(preset) {
  if (!preset || !Array.isArray(preset.items)) return { items: [], target: -1 };
  if (typeof preset.forceItem === 'string') return { items: preset.items.concat(preset.forceItem), target: preset.items.length };
  const index = Number.isInteger(preset.targetIndex) ? preset.targetIndex : -1;
  return { items: preset.items.slice(), target: index >= 0 && index < preset.items.length ? index : -1 };
}

/** What addPreset or overwritePreset takes. The whole list keeps its order and the prophecy item is a position in it (targetIndex). */
export function wizardPayload({ title, appearance = 'memo', items, target }) {
  if (!Array.isArray(items) || !Number.isInteger(target) || target < 0 || target >= items.length) return null;
  return { name: title, appearance, items: items.slice(), targetIndex: target };
}

/** Lines of a note for a sample number, around the chosen place, to check the result before saving. */
export function previewNote(items, target, number, { around = 2 } = {}) {
  if (!Array.isArray(items) || items.length < 2 || !Number.isInteger(target) || target < 0 || target >= items.length) return null;
  const rest = items.filter((_, index) => index !== target);
  const place = Math.min(Math.max(1, Math.floor(number) || 1), items.length);
  rest.splice(place - 1, 0, items[target]);
  const from = Math.max(0, place - 1 - around);
  const to = Math.min(rest.length, place + around);
  return { number: place, total: rest.length, lines: rest.slice(from, to).map((text, offset) => ({ number: from + offset + 1, text, hit: from + offset + 1 === place })) };
}

/** One card per list for the settings home: the performer's own lists first, then the ready made ones. */
export function listCards(state) {
  const hidden = new Set(normalizeHiddenIds(state?.hiddenPresetIds));
  const builtins = normalizeBuiltins(state?.builtins);
  const own = (Array.isArray(state?.presets) ? state.presets : []).map((preset) => {
    const split = splitForcePreset(preset);
    const total = split.items.length + 1;
    return {
      id: preset.id, builtin: false, title: preset.name, count: total, target: split.forceItem,
      enabled: !hidden.has(preset.id), usable: isNoteEligible(preset), updatedAt: preset.updatedAt
    };
  }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const ready = BUILTIN_LISTS.map((list) => ({
    id: list.id, builtin: true, title: list.name, count: list.items.length,
    target: list.items[builtins[list.id].target - 1], enabled: builtins[list.id].enabled, usable: true
  }));
  return own.concat(ready);
}

/** The line under the start button: how many lists will really appear in the notes (the active performance set counts) and whether every one is usable. */
export function readinessSummary(state) {
  const cards = listCards(state);
  const picked = selectNotes(state);
  const sets = normalizeSets(state?.sets);
  const active = sets.find((set) => set.id === state?.activeSetId) || null;
  const inSet = (card) => !active || active.presetIds.includes(card.id);
  const tooLong = cards.filter((card) => !card.builtin && card.enabled && !card.usable && inSet(card));
  const onCount = picked.forceCount;
  const switchedOn = cards.filter((card) => card.enabled && card.usable).length;
  return { onCount, tooLong: tooLong.length, ready: onCount > 0, setName: picked.setName, outsideSet: active ? Math.max(0, switchedOn - onCount) : 0 };
}
