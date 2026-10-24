import { APPEARANCES, MSG, MAX_ITEMS, MAX_CHARS, MAX_NAME, charLength } from './logic-core.js';

function fail(error, raw, partial = null, issues = []) {
  return { ok: false, error, raw, partial, issues, data: null };
}

function makeId(now = Date.now(), rand = Math.random()) {
  const time = Number.isFinite(now) ? now : Date.now();
  const salt = Number.isFinite(rand) ? rand : Math.random();
  return `mc_${time.toString(36)}_${Math.floor(salt * 1e9).toString(36)}`;
}

export function normalizeItems(items) {
  if (!Array.isArray(items)) return { ok: false, error: MSG.badItemType };
  if (items.length === 0) return { ok: false, error: MSG.emptyList };
  if (items.length > MAX_ITEMS) return { ok: false, error: MSG.tooManyItems };
  const normalized = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (typeof item !== 'string') {
      return { ok: false, error: `${index + 1}번 항목이 문자가 아닙니다.` };
    }
    const trimmed = item.trim();
    if (!trimmed) return { ok: false, error: `${index + 1}번 항목이 비어 있습니다.` };
    if (charLength(trimmed) > MAX_CHARS) {
      return { ok: false, error: `${index + 1}번 항목이 120자를 넘습니다.` };
    }
    normalized.push(trimmed);
  }
  return { ok: true, items: normalized };
}

export function parseItemText(text) {
  if (typeof text !== 'string') return { ok: false, error: MSG.badItemType };
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed) continue;
    if (charLength(trimmed) > MAX_CHARS) {
      return { ok: false, error: `${index + 1}번째 줄이 120자를 넘습니다.` };
    }
    items.push(trimmed);
  }
  if (items.length === 0) return { ok: false, error: MSG.emptyList };
  if (items.length > MAX_ITEMS) return { ok: false, error: MSG.tooManyItems };
  return { ok: true, items };
}

function normalizeName(name) {
  if (typeof name !== 'string') return { ok: false, error: MSG.needName };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: MSG.needName };
  if (charLength(trimmed) > MAX_NAME) return { ok: false, error: MSG.nameTooLong };
  return { ok: true, name: trimmed };
}

export function createPreset(input, options = {}) {
  const name = normalizeName(input?.name);
  if (!name.ok) return { ok: false, error: name.error };
  const parsed = typeof input.itemsText === 'string'
    ? parseItemText(input.itemsText)
    : normalizeItems(input?.items);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { items } = parsed;
  const separate = Object.prototype.hasOwnProperty.call(input, 'forceItem');
  const forceItem = separate ? String(input.forceItem ?? '').trim() : null;
  if (separate && (!forceItem || charLength(forceItem) > MAX_CHARS)) return { ok: false, error: MSG.needForce };
  if (separate && items.length >= MAX_ITEMS) return { ok: false, error: MSG.tooManyItems };
  if (!separate && (!Number.isInteger(input.targetIndex) || input.targetIndex < 0 || input.targetIndex >= items.length)) {
    return { ok: false, error: MSG.needTarget };
  }
  if (!Object.prototype.hasOwnProperty.call(APPEARANCES, input.appearance)) {
    return { ok: false, error: MSG.badAppearance };
  }
  return {
    ok: true,
    preset: {
      id: options.id || makeId(options.now, options.rand),
      name: name.name,
      items,
      ...(separate ? { forceItem } : { targetIndex: input.targetIndex, targetItem: items[input.targetIndex] }),
      appearance: input.appearance,
      updatedAt: options.now ?? Date.now()
    }
  };
}

export function addPreset(presets, input, options = {}) {
  if (!Array.isArray(presets)) return { ok: false, error: MSG.badItemType };
  const created = createPreset(input, options);
  if (!created.ok) return created;
  if (presets.some((preset) => preset.name === created.preset.name)) {
    return { ok: false, error: MSG.duplicateName };
  }
  if (presets.some((preset) => preset.id === created.preset.id)) {
    return { ok: false, error: '같은 식별자가 이미 있습니다.' };
  }
  return { ok: true, presets: presets.concat(created.preset), preset: created.preset };
}

export function renamePreset(presets, id, newName, options = {}) {
  const name = normalizeName(newName);
  if (!name.ok) return { ok: false, error: name.error };
  const current = presets.find((preset) => preset.id === id);
  if (!current) return { ok: false, error: MSG.missingList };
  if (presets.some((preset) => preset.id !== id && preset.name === name.name)) {
    return { ok: false, error: MSG.duplicateName };
  }
  const preset = {
    ...current,
    name: name.name,
    items: current.items.slice(),
    updatedAt: options.now ?? current.updatedAt
  };
  return {
    ok: true,
    preset,
    presets: presets.map((entry) => (entry.id === id ? preset : entry))
  };
}

export function overwritePreset(presets, id, input, options = {}) {
  const current = presets.find((preset) => preset.id === id);
  if (!current) return { ok: false, error: MSG.missingList };
  const created = createPreset({
    name: current.name,
    items: input?.items,
    itemsText: input?.itemsText,
    ...(Object.prototype.hasOwnProperty.call(input ?? {}, 'forceItem') ? { forceItem: input.forceItem } : {}),
    targetIndex: input?.targetIndex,
    appearance: input?.appearance
  }, { id: current.id, now: options.now ?? current.updatedAt });
  if (!created.ok) return created;
  return {
    ok: true,
    preset: created.preset,
    presets: presets.map((entry) => (entry.id === id ? created.preset : entry))
  };
}

export function deletePreset(presets, id) {
  if (!Array.isArray(presets) || !presets.some((preset) => preset.id === id)) {
    return { ok: false, error: MSG.missingList };
  }
  return { ok: true, presets: presets.filter((preset) => preset.id !== id) };
}

export function forceList(items, targetIndex, choice) {
  const normalized = normalizeItems(items);
  if (!normalized.ok) return { ok: false, error: normalized.error };
  const list = normalized.items;
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= list.length) {
    return { ok: false, error: MSG.badTarget };
  }
  if (!Number.isInteger(choice) || choice < 1 || choice > list.length) {
    return { ok: false, error: MSG.badChoice };
  }
  const next = list.slice();
  const destination = choice - 1;
  if (destination !== targetIndex) {
    const displaced = next[destination];
    next[destination] = next[targetIndex];
    next[targetIndex] = displaced;
  }
  return {
    ok: true,
    items: next,
    selectedItem: next[destination],
    choice,
    index: destination
  };
}

export function insertForceItem(items, forceItem, choice) {
  // A valid legacy one-item list has no ordinary items after its force item is split out.
  const normalized = Array.isArray(items) && items.length === 0
    ? { ok: true, items: [] }
    : normalizeItems(items);
  if (!normalized.ok) return normalized;
  if (typeof forceItem !== 'string' || !forceItem.trim() || charLength(forceItem.trim()) > MAX_CHARS) {
    return { ok: false, error: MSG.needForce };
  }
  if (normalized.items.length >= MAX_ITEMS) return { ok: false, error: MSG.tooManyItems };
  if (!Number.isInteger(choice) || choice < 1 || choice > normalized.items.length + 1) {
    return { ok: false, error: MSG.badChoice };
  }
  const next = normalized.items.slice();
  next.splice(choice - 1, 0, forceItem.trim());
  return { ok: true, items: next, selectedItem: forceItem.trim(), choice, index: choice - 1 };
}

export function splitForcePreset(preset) {
  if (typeof preset?.forceItem === 'string') return { items: preset.items.slice(), forceItem: preset.forceItem };
  const items = preset.items.slice();
  const [forceItem] = items.splice(preset.targetIndex, 1);
  return { items, forceItem };
}

export { fail, makeId, normalizeName };
