import { BUILTIN_LISTS, builtinById } from './builtin-lists.js';

export const STORAGE_KEY = 'magic-choice.v1.store';
export const BACKUP_KEY = 'magic-choice.v1.store.backup';
export const SWIPE_PX = 96;

export const PUBLIC_COPY = {
  choose: '번호를 선택하세요',
  reveal: '목록 보기'
};

export const APPEARANCES = {
  memo: { heading: '메모', icon: '✎' },
  ranking: { heading: '순위', icon: '1' },
  todo: { heading: '할 일', icon: '☐' },
  menu: { heading: '메뉴', icon: '✦' },
  travel: { heading: '여행', icon: '⌖' }
};

export const MSG = {
  emptyList: '목록이 비어 있습니다.',
  tooManyItems: '항목은 200개를 넘길 수 없습니다.',
  badItemType: '목록 형식이 올바르지 않습니다.',
  badChoice: '번호는 1부터 목록 개수까지의 정수여야 합니다.',
  badTarget: '목표 항목 위치가 올바르지 않습니다.',
  needTarget: '목표 항목을 선택하세요.',
  locked: '이미 공개된 결과입니다.',
  chooseFirst: '번호를 먼저 선택하세요.',
  differentLists: '서로 다른 두 목록을 선택하세요.',
  missingList: '목록을 찾을 수 없습니다.',
  corruptJson: '저장된 데이터를 읽을 수 없습니다. 원본은 그대로 두었습니다.',
  badShape: '저장된 데이터 구조가 올바르지 않습니다. 원본은 그대로 두었습니다.',
  partial: '일부 목록만 복구할 수 있습니다. 원본은 그대로 두었습니다.',
  duplicateName: '같은 이름의 목록이 있습니다.',
  needName: '목록 이름을 입력하세요.',
  nameTooLong: '목록 이름은 40자까지 입력할 수 있습니다.',
  badAppearance: '목록 모양이 올바르지 않습니다.',
  unknownVersion: '지원하지 않는 저장 버전입니다. 원본은 그대로 두었습니다.',
  badMode: '공연 방식이 올바르지 않습니다.',
  storageRead: '저장소를 읽지 못했습니다.',
  storageWrite: '저장 공간이 부족하거나 저장소에 쓸 수 없습니다.',
  badTwoList: '두 목록 설정을 읽을 수 없습니다. 원본은 그대로 두었습니다.',
  needForce: '예언 항목을 입력하세요.'
};

const MAX_ITEMS = 200;
const MAX_CHARS = 120;
const MAX_NAME = 40;

export function charLength(value) {
  return Array.from(String(value)).length;
}

// Where the app opens: the settings screen, or the performance (fake home screen first).
export const START_MODES = ['settings', 'performance'];
export const DISPLAY_MODES = ['performance', 'practice'];

export const NOTE_FONT_RANGE = { min: 14, max: 30, step: 1 };
export const NOTE_LINE_HEIGHTS = ['compact', 'normal', 'relaxed'];
export const NOTE_EMPHASES = ['none', 'bold', 'highlight', 'underline'];
export const ICON_SIZE_RANGE = { min: 80, max: 120 };
export const LABEL_SIZE_RANGE = { min: 10, max: 16 };
export const BOTTOM_GAP_RANGE = { min: 0, max: 120 };
export const WALLPAPERS = ['default', 'photo'];

export function defaultOptions() {
  return {
    startMode: 'settings',
    display: 'performance',
    vibrate: false,
    noteFont: 17,
    noteLine: 'normal',
    noteEmphasis: 'none',
    iconSize: 100,
    labelSize: 13,
    bottomGap: 0,
    wallpaper: 'default',
    wallpaperId: ''
  };
}

function clampNumber(value, range, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(range.min, Math.min(range.max, Math.round(value)));
}

// Lenient on purpose: an unknown or missing option falls back to its default and
// never rejects the store, so saved notes and targets are not put at risk.
export function normalizeOptions(value) {
  const base = defaultOptions();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  return {
    // Older saves used 'normal' (number picker) and 'home-notes'. Both now mean the performance.
    startMode: START_MODES.includes(value.startMode) ? value.startMode
      : (value.startMode === 'normal' || value.startMode === 'home-notes' ? 'performance' : base.startMode),
    display: DISPLAY_MODES.includes(value.display) ? value.display : base.display,
    vibrate: value.vibrate === true,
    noteFont: clampNumber(value.noteFont, NOTE_FONT_RANGE, base.noteFont),
    noteLine: NOTE_LINE_HEIGHTS.includes(value.noteLine) ? value.noteLine : base.noteLine,
    noteEmphasis: NOTE_EMPHASES.includes(value.noteEmphasis) ? value.noteEmphasis : base.noteEmphasis,
    iconSize: clampNumber(value.iconSize, ICON_SIZE_RANGE, base.iconSize),
    labelSize: clampNumber(value.labelSize, LABEL_SIZE_RANGE, base.labelSize),
    bottomGap: clampNumber(value.bottomGap, BOTTOM_GAP_RANGE, base.bottomGap),
    wallpaper: WALLPAPERS.includes(value.wallpaper) ? value.wallpaper : base.wallpaper,
    // Names the stored photo so a new photo can be written before the old one is dropped.
    wallpaperId: typeof value.wallpaperId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value.wallpaperId) ? value.wallpaperId : base.wallpaperId
  };
}

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

export function takeSnapshot(preset) {
  const created = createPreset({
    name: preset?.name,
    items: preset?.items,
    ...(typeof preset?.forceItem === 'string' ? { forceItem: preset.forceItem } : { targetIndex: preset?.targetIndex }),
    appearance: preset?.appearance
  }, { id: preset?.id, now: preset?.updatedAt });
  if (!created.ok) return created;
  return {
    ok: true,
    snapshot: {
      ...created.preset,
      items: created.preset.items.slice()
    }
  };
}

function cloneList(list, patch = {}) {
  const ordered = Object.prototype.hasOwnProperty.call(patch, 'ordered') ? patch.ordered : list.ordered;
  return {
    ...list,
    ...patch,
    items: list.items.slice(),
    ordered: Array.isArray(ordered) ? ordered.slice() : null
  };
}

export function beginPerformance(state, options) {
  const presets = state?.presets;
  if (!Array.isArray(presets)) return { ok: false, error: MSG.badItemType };
  if (!options || (options.mode !== 'single' && options.mode !== 'two')) {
    return { ok: false, error: MSG.badMode };
  }
  if (options.mode === 'two' && options.presetIdA === options.presetIdB) {
    return { ok: false, error: MSG.differentLists };
  }
  const ids = options.mode === 'single'
    ? [options.presetId]
    : [options.presetIdA, options.presetIdB];
  const lists = [];
  for (const id of ids) {
    const found = presets.find((preset) => preset && preset.id === id);
    if (!found) return { ok: false, error: MSG.missingList };
    const snap = takeSnapshot(found);
    if (!snap.ok) return snap;
    lists.push({
      id: snap.snapshot.id,
      name: snap.snapshot.name,
      appearance: snap.snapshot.appearance,
      ...splitForcePreset(snap.snapshot),
      choice: null,
      revealed: false,
      ordered: null
    });
  }
  return { ok: true, session: { mode: options.mode, lists, locked: false } };
}

export function chooseNumber(session, listIndex, choice) {
  const list = session?.lists?.[listIndex];
  if (!list) return { ok: false, error: MSG.missingList };
  if (session.locked || list.revealed) return { ok: false, error: MSG.locked };
  const forced = insertForceItem(list.items, list.forceItem, choice);
  if (!forced.ok) return { ok: false, error: forced.error };
  return {
    ok: true,
    session: {
      ...session,
      lists: session.lists.map((entry, index) => cloneList(entry, index === listIndex ? { choice } : {}))
    }
  };
}

export function revealList(session, listIndex) {
  const list = session?.lists?.[listIndex];
  if (!list) return { ok: false, error: MSG.missingList };
  if (session.locked || list.revealed) return { ok: false, error: MSG.locked };
  if (!Number.isInteger(list.choice)) return { ok: false, error: MSG.chooseFirst };
  const forced = insertForceItem(list.items, list.forceItem, list.choice);
  if (!forced.ok) return { ok: false, error: forced.error };
  const lists = session.lists.map((entry, index) => cloneList(entry, index === listIndex
    ? { revealed: true, ordered: forced.items }
    : {}));
  return {
    ok: true,
    session: {
      ...session,
      lists,
      locked: lists.every((entry) => entry.revealed)
    }
  };
}

export function toPublic(session) {
  const lists = session.lists.map((list) => {
    const view = {
      name: list.name,
      appearance: list.appearance,
      heading: APPEARANCES[list.appearance]?.heading ?? '',
      icon: APPEARANCES[list.appearance]?.icon ?? '',
      count: list.items.length + 1,
      choice: list.choice,
      revealed: list.revealed,
      numberPrompt: PUBLIC_COPY.choose,
      revealLabel: PUBLIC_COPY.reveal
    };
    if (list.revealed && Array.isArray(list.ordered)) {
      view.items = list.ordered.slice();
      view.selectedItem = list.ordered[list.choice - 1];
    }
    return view;
  });
  return {
    mode: session.mode,
    locked: session.locked,
    lists,
    combined: session.mode === 'two' && session.locked
      ? lists.map((list) => list.selectedItem)
      : null
  };
}

export function isTwoFingerDownSwipe(moves, threshold = SWIPE_PX) {
  if (!Array.isArray(moves) || moves.length !== 2) return false;
  return moves.every((move) => typeof move === 'number' && Number.isFinite(move) && move >= threshold);
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

// One UI style home: 5 columns, 6 rows. The number apps form a 3x3 keypad at rows 2-4,
// columns 2-4 (zero based row 1-3, column 1-3). Every other cell is 0.
export const HOME_LAYOUT = Object.freeze({ cols: 5, rows: 6, padRow: 1, padCol: 1 });
export const HOME_PAGES = 3;

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isHomeDigit(value) {
  return Number.isInteger(value) && value >= 0 && value <= 9;
}

/**
 * Fake-home digit for a pointer inside a rect.
 * The rect is { x, y, width, height } with (x, y) at the top-left of the icon grid.
 * The grid is HOME_LAYOUT.cols x HOME_LAYOUT.rows equal bands. Digit map (row, column):
 *   0 0 0 0 0
 *   0 1 2 3 0
 *   0 4 5 6 0
 *   0 7 8 9 0
 *   0 0 0 0 0
 *   0 0 0 0 0
 * Edge behavior:
 * - The rect is closed: left/top and the exact right/bottom edges are inside.
 * - A point past any outer edge, even by a fraction, is outside and returns null.
 * - Internal grid lines belong to the higher index (Math.floor of the band ratio);
 *   the exact right edge is the last column and the exact bottom edge the last row.
 * - Non-finite pointer or rect fields, width <= 0, and height <= 0 return null.
 */
export function fakeHomeDigit(rect, x, y, layout = HOME_LAYOUT) {
  if (!rect || typeof rect !== 'object' || Array.isArray(rect)) return null;
  const left = rect.x;
  const top = rect.y;
  const { width, height } = rect;
  if (!finiteNumber(left) || !finiteNumber(top) || !finiteNumber(width) || !finiteNumber(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;
  if (!finiteNumber(x) || !finiteNumber(y)) return null;
  const right = left + width;
  const bottom = top + height;
  if (x < left || y < top || x > right || y > bottom) return null;
  let col = Math.floor((x - left) / (width / layout.cols));
  let row = Math.floor((y - top) / (height / layout.rows));
  if (col >= layout.cols) col = layout.cols - 1;
  if (row >= layout.rows) row = layout.rows - 1;
  if (col < 0 || row < 0) return null;
  return homeCellDigit(row, col, layout);
}

/** Digit of one grid cell (zero based row and column). */
export function homeCellDigit(row, col, layout = HOME_LAYOUT) {
  const r = row - layout.padRow;
  const c = col - layout.padCol;
  if (r < 0 || r > 2 || c < 0 || c > 2) return 0;
  return r * 3 + c + 1;
}

/**
 * Tens and ones digits 0-9. Both zero mean "the last item number of the opened
 * note" and are returned as 0 (resolveChoice maps it to that note's length).
 * Every other pair is tens*10+ones (01 -> 1, 37 -> 37, 99 -> 99).
 * Anything that is not an integer digit returns null.
 */
export function fakeHomeNumber(tens, ones) {
  if (!isHomeDigit(tens) || !isHomeDigit(ones)) return null;
  if (tens === 0 && ones === 0) return 0;
  return tens * 10 + ones;
}

/**
 * Maps the entered number to a position in a note of `count` items.
 * 00 (value 0) is the last item. A number above the note length is out of range:
 * the note then shows its original list, with the target at the last item
 * (the same place 00 uses), and inRange is false so the performer can be told quietly.
 * Returns null for anything that cannot be resolved.
 */
export function resolveChoice(value, count) {
  if (!Number.isInteger(count) || count < 1) return null;
  if (value === 0) return { choice: count, inRange: true, last: true };
  if (!Number.isInteger(value) || value < 1) return null;
  if (value <= count) return { choice: value, inRange: true, last: false };
  return { choice: count, inRange: false, last: false };
}

/** Idle two-step entry: no digits, unlocked, no result. */
export function createFakeHomeEntry() {
  return { tens: null, ones: null, value: null, locked: false };
}

function isValidLeftSwipe(swipe) {
  if (!swipe || typeof swipe !== 'object' || Array.isArray(swipe)) return false;
  if (swipe.canceled === true) return false;
  if (!isHomeDigit(swipe.digit)) return false;
  const { dx, dy } = swipe;
  if (!finiteNumber(dx) || !finiteNumber(dy)) return false;
  // Screen left is decreasing x. Equal diagonals are not left swipes.
  if (dx > -SWIPE_PX) return false;
  if (Math.abs(dx) <= Math.abs(dy)) return false;
  return true;
}

export const TAP_MAX_PX = 12;
export const TAP_MAX_MS = 400;

/**
 * Classifies one finished pointer gesture as 'left', 'right', 'tap', or null.
 * Left and right need at least SWIPE_PX and must be strictly more horizontal
 * than vertical. A tap moves at most TAP_MAX_PX and lasts at most TAP_MAX_MS,
 * so a long press never counts as a digit.
 */
export function classifyFakeHomeGesture(gesture) {
  if (!gesture || typeof gesture !== 'object' || Array.isArray(gesture)) return null;
  if (gesture.canceled === true) return null;
  const { dx, dy } = gesture;
  if (!finiteNumber(dx) || !finiteNumber(dy)) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx <= -SWIPE_PX) return 'left';
    if (dx >= SWIPE_PX) return 'right';
  }
  const ms = gesture.ms;
  if (finiteNumber(ms) && ms >= 0 && ms <= TAP_MAX_MS
    && Math.abs(dx) <= TAP_MAX_PX && Math.abs(dy) <= TAP_MAX_PX) return 'tap';
  return null;
}

function recordDigit(state, digit) {
  if (state.tens == null) {
    return { tens: digit, ones: null, value: null, locked: false };
  }
  return {
    tens: state.tens,
    ones: digit,
    value: fakeHomeNumber(state.tens, digit),
    locked: true
  };
}

/**
 * A short tap enters the digit under the finger exactly like a left swipe.
 * Dummy icons and background resolve to 0 through fakeHomeDigit. Anything that
 * is not a tap, and any tap after the number is locked, returns the same state.
 */
export function applyFakeHomeTap(state, tap) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  if (state.locked === true || state.ones != null) return state;
  if (classifyFakeHomeGesture(tap) !== 'tap' || !isHomeDigit(tap.digit)) return state;
  return recordDigit(state, tap.digit);
}

/**
 * A right swipe removes the last entered digit (ones first, then tens) so it
 * can be entered again. Once a note has been opened the number is locked for
 * good: pass { noteOpened: true } and the same state comes back.
 */
export function applyFakeHomeUndo(state, swipe, { noteOpened = false } = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  if (noteOpened === true) return state;
  if (classifyFakeHomeGesture(swipe) !== 'right') return state;
  if (state.ones != null) return { tens: state.tens, ones: null, value: null, locked: false };
  if (state.tens != null) return createFakeHomeEntry();
  return state;
}

/**
 * First valid left swipe stores `digit` as tens and leaves the entry unlocked.
 * Second valid left swipe stores ones, sets value via fakeHomeNumber, and locks.
 * Canceled, short (< SWIPE_PX left), non-left (right, vertical, or equal
 * diagonal), missing/invalid digit, and any swipe after lock record nothing:
 * the same state object is returned.
 * A valid left swipe is strictly more horizontal than vertical and dx <= -SWIPE_PX.
 */
export function applyFakeHomeSwipe(state, swipe) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  if (state.locked === true || state.ones != null) return state;
  if (!isValidLeftSwipe(swipe)) return state;
  return recordDigit(state, swipe.digit);
}

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

// ----- User app icons (device only) ------------------------------------------------------

export const USER_ICON_KEY = 'magic-choice.v1.user-icons';
export const USER_ICON_MAX = 24;
export const USER_ICON_LABEL_MAX = 8;
const USER_ICON_DATA = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const USER_ICON_BYTES = 90000;

/** Pages 0-1 keep the keypad block free; page 2 is an ordinary home, every cell is 0. */
export function isZeroSlot(page, row, col) {
  if (!Number.isInteger(page) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (page < 0 || page >= HOME_PAGES || row < 0 || row >= HOME_LAYOUT.rows || col < 0 || col >= HOME_LAYOUT.cols) return false;
  if (page === 2) return true;
  return homeCellDigit(row, col) === 0;
}

// Cells that must keep their own behaviour (the notes app). reserved: [{ page, row, col }].
export function isReservedSlot(page, row, col, reserved = []) {
  return reserved.some((cell) => cell.page === page && cell.row === row && cell.col === col);
}

export function normalizeUserIcons(raw, reserved = []) {
  if (!Array.isArray(raw)) return [];
  const bySlot = new Map();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    if (typeof entry.id !== 'string' || !entry.id) continue;
    if (typeof entry.dataUrl !== 'string' || entry.dataUrl.length > USER_ICON_BYTES || !USER_ICON_DATA.test(entry.dataUrl)) continue;
    if (!isZeroSlot(entry.page, entry.row, entry.col) || isReservedSlot(entry.page, entry.row, entry.col, reserved)) continue;
    const label = cleanText(entry.label, USER_ICON_LABEL_MAX).trim();
    if (!label) continue;
    bySlot.set(`${entry.page}:${entry.row}:${entry.col}`, { id: entry.id, label, dataUrl: entry.dataUrl, page: entry.page, row: entry.row, col: entry.col });
  }
  return [...bySlot.values()].slice(0, USER_ICON_MAX);
}

export function placeUserIcon(icons, input, { now = Date.now(), rand = Math.random(), reserved = [] } = {}) {
  const current = normalizeUserIcons(icons, reserved);
  if (!isZeroSlot(input?.page, input?.row, input?.col)) return { ok: false, error: '이 칸은 숫자 칸이라 쓸 수 없습니다.' };
  if (isReservedSlot(input.page, input.row, input.col, reserved)) return { ok: false, error: '이 칸은 노트 앱 자리라 쓸 수 없습니다.' };
  const label = cleanText(input?.label, USER_ICON_LABEL_MAX).trim();
  if (!label) return { ok: false, error: '앱 이름을 입력하세요.' };
  const icon = { id: input.id || `ui_${now.toString(36)}_${Math.floor(rand * 1e9).toString(36)}`, label, dataUrl: input.dataUrl, page: input.page, row: input.row, col: input.col };
  const checked = normalizeUserIcons([icon], reserved);
  if (!checked.length) return { ok: false, error: '그림을 읽을 수 없거나 너무 큽니다.' };
  const rest = current.filter((entry) => !(entry.page === icon.page && entry.row === icon.row && entry.col === icon.col) && entry.id !== icon.id);
  if (rest.length >= USER_ICON_MAX) return { ok: false, error: `내 앱 아이콘은 ${USER_ICON_MAX}개까지 둘 수 있습니다.` };
  return { ok: true, icon, icons: rest.concat(icon) };
}

export function removeUserIcon(icons, id, reserved = []) {
  const current = normalizeUserIcons(icons, reserved);
  if (!current.some((entry) => entry.id === id)) return { ok: false, error: '아이콘을 찾을 수 없습니다.' };
  return { ok: true, icons: current.filter((entry) => entry.id !== id) };
}

export function loadUserIcons(storage, reserved = []) {
  try {
    const raw = storage.getItem(USER_ICON_KEY);
    return raw ? normalizeUserIcons(JSON.parse(raw), reserved) : [];
  } catch {
    return [];
  }
}

export function saveUserIcons(storage, icons) {
  try {
    storage.setItem(USER_ICON_KEY, JSON.stringify(normalizeUserIcons(icons)));
    return { ok: true };
  } catch {
    return { ok: false, error: MSG.storageWrite };
  }
}

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
