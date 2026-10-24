import {
  STORAGE_KEY, BACKUP_KEY, APPEARANCES, MSG, MAX_ITEMS, MAX_CHARS, charLength, defaultOptions,
  normalizeOptions,
} from './logic-core.js';
import { fail, normalizeItems, normalizeName } from './logic-presets.js';
import {
  normalizeDummyNotes, normalizeSets, normalizeHiddenIds, normalizeBuiltins,
} from './logic-extras.js';

export function emptyState() {
  return {
    version: 1,
    presets: [],
    twoList: { enabled: false, presetIdA: null, presetIdB: null },
    options: defaultOptions(),
    sets: [],
    activeSetId: null,
    dummyNotes: [],
    builtins: normalizeBuiltins(undefined),
    hiddenPresetIds: []
  };
}

function recoverPreset(entry, index) {
  const label = `${index + 1}번 목록`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, issue: `${label}: 목록 형식이 올바르지 않습니다.` };
  }
  if (typeof entry.id !== 'string' || !entry.id.trim()) {
    return { ok: false, issue: `${label}: 식별자가 없습니다.` };
  }
  const name = normalizeName(entry.name);
  if (!name.ok) return { ok: false, issue: `${label}: ${name.error}` };
  const itemsResult = normalizeItems(entry.items);
  if (!itemsResult.ok) return { ok: false, issue: `${label}: ${itemsResult.error}` };
  if (!Object.prototype.hasOwnProperty.call(APPEARANCES, entry.appearance)) {
    return { ok: false, issue: `${label}: ${MSG.badAppearance}` };
  }
  const items = itemsResult.items;
  if (Object.prototype.hasOwnProperty.call(entry, 'forceItem')) {
    const forceItem = typeof entry.forceItem === 'string' ? entry.forceItem.trim() : '';
    if (!forceItem || charLength(forceItem) > MAX_CHARS || items.length >= MAX_ITEMS) {
      return { ok: false, issue: `${label}: ${MSG.needForce}` };
    }
    return { ok: true, issue: null, preset: {
      id: entry.id, name: name.name, items, forceItem,
      appearance: entry.appearance,
      updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0
    } };
  }
  let targetIndex = entry.targetIndex;
  let issue = null;
  const identity = typeof entry.targetItem === 'string' ? entry.targetItem : null;
  const indexValid = Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < items.length;
  if (indexValid) {
    if (identity != null && items[targetIndex] !== identity) {
      issue = `${name.name}: 목표 항목 기록을 위치에 맞게 고쳤습니다.`;
    }
  } else if (identity != null) {
    const matches = [];
    items.forEach((item, itemIndex) => {
      if (item === identity) matches.push(itemIndex);
    });
    if (matches.length !== 1) return { ok: false, issue: `${label}: ${MSG.badTarget}` };
    targetIndex = matches[0];
    issue = `${name.name}: 목표 위치를 항목 내용으로 복구했습니다.`;
  } else {
    return { ok: false, issue: `${label}: ${MSG.needTarget}` };
  }
  return {
    ok: true,
    issue,
    preset: {
      id: entry.id,
      name: name.name,
      items,
      targetIndex,
      targetItem: items[targetIndex],
      appearance: entry.appearance,
      updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0
    }
  };
}

function readTwoList(value, present) {
  if (!present || value == null) return { ok: true, twoList: emptyState().twoList };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: MSG.badTwoList };
  }
  const idOk = (id) => id == null || typeof id === 'string';
  if (typeof value.enabled !== 'boolean' || !idOk(value.presetIdA) || !idOk(value.presetIdB)) {
    return { ok: false, error: MSG.badTwoList };
  }
  return {
    ok: true,
    twoList: {
      enabled: value.enabled,
      presetIdA: value.presetIdA ?? null,
      presetIdB: value.presetIdB ?? null
    }
  };
}

// Extras never reject the store: unreadable entries are dropped from the view only.
function readExtras(parsed) {
  const sets = normalizeSets(parsed.sets);
  const activeSetId = typeof parsed.activeSetId === 'string' && sets.some((set) => set.id === parsed.activeSetId)
    ? parsed.activeSetId
    : null;
  return { sets, activeSetId, dummyNotes: normalizeDummyNotes(parsed.dummyNotes), builtins: normalizeBuiltins(parsed.builtins), hiddenPresetIds: normalizeHiddenIds(parsed.hiddenPresetIds) };
}

export function parseStorage(raw) {
  if (raw == null || raw === '') {
    return { ok: true, data: emptyState(), issues: [], raw: raw == null ? null : raw };
  }
  if (typeof raw !== 'string') return fail(MSG.badShape, raw);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail(MSG.corruptJson, raw);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(MSG.badShape, raw);
  if (parsed.version != null && parsed.version !== 1) return fail(MSG.unknownVersion, raw, null);
  if (!Array.isArray(parsed.presets)) return fail(MSG.badShape, raw);
  const presets = [];
  const issues = [];
  let rejected = 0;
  parsed.presets.forEach((entry, index) => {
    const recovered = recoverPreset(entry, index);
    if (!recovered.ok) {
      rejected += 1;
      issues.push(recovered.issue);
      return;
    }
    presets.push(recovered.preset);
    if (recovered.issue) issues.push(recovered.issue);
  });
  const options = normalizeOptions(parsed.options);
  const extras = readExtras(parsed);
  const two = readTwoList(parsed.twoList, Object.prototype.hasOwnProperty.call(parsed, 'twoList'));
  if (!two.ok) {
    return {
      ok: false,
      error: two.error,
      raw,
      data: null,
      issues,
      partial: { version: 1, presets, twoList: emptyState().twoList, options, ...extras }
    };
  }
  if (rejected > 0) {
    return {
      ok: false,
      error: MSG.partial,
      raw,
      data: null,
      issues,
      partial: { version: 1, presets, twoList: two.twoList, options, ...extras }
    };
  }
  return {
    ok: true,
    data: { version: 1, presets, twoList: two.twoList, options, ...extras },
    issues,
    raw
  };
}

// The object that serializeState writes. Callers that just saved this value already have it
// and must not read the storage string back.
export function canonicalState(state) {
  const sets = normalizeSets(state.sets);
  return {
    version: 1,
    presets: state.presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      items: preset.items.slice(),
      ...(typeof preset.forceItem === 'string'
        ? { forceItem: preset.forceItem }
        : { targetIndex: preset.targetIndex, targetItem: preset.targetItem }),
      appearance: preset.appearance,
      updatedAt: preset.updatedAt
    })),
    twoList: {
      enabled: Boolean(state.twoList?.enabled),
      presetIdA: state.twoList?.presetIdA ?? null,
      presetIdB: state.twoList?.presetIdB ?? null
    },
    options: normalizeOptions(state.options),
    sets,
    activeSetId: sets.some((set) => set.id === state.activeSetId) ? state.activeSetId : null,
    dummyNotes: normalizeDummyNotes(state.dummyNotes),
    builtins: normalizeBuiltins(state.builtins),
    hiddenPresetIds: normalizeHiddenIds(state.hiddenPresetIds)
  };
}

export function serializeState(state) {
  return JSON.stringify(canonicalState(state));
}

export function loadFromStorage(storage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, error: MSG.storageRead, raw: null, partial: null, issues: [], data: null };
  }
  return parseStorage(raw);
}

export function saveState(storage, state) {
  try {
    const data = canonicalState(state);
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true, data };
  } catch {
    return { ok: false, error: MSG.storageWrite };
  }
}

export function replaceStoreKeepingBackup(storage, state) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw != null) storage.setItem(BACKUP_KEY, raw);
    const data = canonicalState(state);
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true, data };
  } catch {
    return { ok: false, error: MSG.storageWrite };
  }
}

export { recoverPreset };
