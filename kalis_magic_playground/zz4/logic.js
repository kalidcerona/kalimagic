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
  badTwoList: '두 목록 설정을 읽을 수 없습니다. 원본은 그대로 두었습니다.'
};

const MAX_ITEMS = 200;
const MAX_CHARS = 120;
const MAX_NAME = 40;

export function charLength(value) {
  return Array.from(String(value)).length;
}

export function emptyState() {
  return {
    version: 1,
    presets: [],
    twoList: { enabled: false, presetIdA: null, presetIdB: null }
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
  if (!Number.isInteger(input.targetIndex) || input.targetIndex < 0 || input.targetIndex >= items.length) {
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
      targetIndex: input.targetIndex,
      targetItem: items[input.targetIndex],
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

export function takeSnapshot(preset) {
  const created = createPreset({
    name: preset?.name,
    items: preset?.items,
    targetIndex: preset?.targetIndex,
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
      items: snap.snapshot.items.slice(),
      targetIndex: snap.snapshot.targetIndex,
      targetItem: snap.snapshot.targetItem,
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
  const forced = forceList(list.items, list.targetIndex, choice);
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
  const forced = forceList(list.items, list.targetIndex, list.choice);
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
      count: list.items.length,
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

export function isRehearsalShortcut(eventLike) {
  if (!eventLike) return false;
  return eventLike.key === 'Escape'
    && eventLike.shiftKey === true
    && eventLike.altKey !== true
    && eventLike.ctrlKey !== true
    && eventLike.metaKey !== true;
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
  const two = readTwoList(parsed.twoList, Object.prototype.hasOwnProperty.call(parsed, 'twoList'));
  if (!two.ok) {
    return {
      ok: false,
      error: two.error,
      raw,
      data: null,
      issues,
      partial: { version: 1, presets, twoList: emptyState().twoList }
    };
  }
  if (rejected > 0) {
    return {
      ok: false,
      error: MSG.partial,
      raw,
      data: null,
      issues,
      partial: { version: 1, presets, twoList: two.twoList }
    };
  }
  return {
    ok: true,
    data: { version: 1, presets, twoList: two.twoList },
    issues,
    raw
  };
}

export function serializeState(state) {
  return JSON.stringify({
    version: 1,
    presets: state.presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      items: preset.items.slice(),
      targetIndex: preset.targetIndex,
      targetItem: preset.targetItem,
      appearance: preset.appearance,
      updatedAt: preset.updatedAt
    })),
    twoList: {
      enabled: Boolean(state.twoList?.enabled),
      presetIdA: state.twoList?.presetIdA ?? null,
      presetIdB: state.twoList?.presetIdB ?? null
    }
  });
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
    storage.setItem(STORAGE_KEY, serializeState(state));
    return { ok: true };
  } catch {
    return { ok: false, error: MSG.storageWrite };
  }
}

export function replaceStoreKeepingBackup(storage, state) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw != null) storage.setItem(BACKUP_KEY, raw);
    storage.setItem(STORAGE_KEY, serializeState(state));
    return { ok: true };
  } catch {
    return { ok: false, error: MSG.storageWrite };
  }
}

const FAKE_HOME_CELLS = 4;

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isHomeDigit(value) {
  return Number.isInteger(value) && value >= 0 && value <= 9;
}

/**
 * Hidden 4×4 fake-home digit for a pointer inside a rect.
 * The rect is { x, y, width, height } with (x, y) at the top-left.
 * Bands are equal quarters. Digit map (row, then column):
 *   0 0 0 0
 *   0 1 2 3
 *   0 4 5 6
 *   0 7 8 9
 * First row OR first column is 0. The bottom-right 3×3 is row-major 1-9.
 *
 * Edge behavior:
 * - The rect is closed: left/top and the exact right/bottom edges are inside.
 * - A point past any outer edge, even by a fraction, is outside and returns null.
 * - Internal grid lines belong to the higher index (Math.floor of the quarter
 *   ratio), so the shared edge is the cell to the right or below.
 * - The exact right edge is column 3 and the exact bottom edge is row 3
 *   (the ratio lands on 4 and is clamped back into the last band).
 * - Non-finite pointer or rect fields, width <= 0, and height <= 0 return null.
 * - Callers should pass sizes that divide cleanly when asserting exact lines;
 *   the band index is the floor of the raw ratio, not a rounded pixel.
 */
export function fakeHomeDigit(rect, x, y) {
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
  let col = Math.floor((x - left) / (width / FAKE_HOME_CELLS));
  let row = Math.floor((y - top) / (height / FAKE_HOME_CELLS));
  if (col >= FAKE_HOME_CELLS) col = FAKE_HOME_CELLS - 1;
  if (row >= FAKE_HOME_CELLS) row = FAKE_HOME_CELLS - 1;
  if (col < 0 || row < 0) return null;
  if (row === 0 || col === 0) return 0;
  return (row - 1) * 3 + col;
}

/**
 * Tens and ones digits 0-9. Both zero encode 100; every other pair is
 * tens*10+ones (01 → 1, 37 → 37, 99 → 99). Anything that is not an
 * integer digit returns null.
 */
export function fakeHomeNumber(tens, ones) {
  if (!isHomeDigit(tens) || !isHomeDigit(ones)) return null;
  if (tens === 0 && ones === 0) return 100;
  return tens * 10 + ones;
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
  if (state.tens == null) {
    return { tens: swipe.digit, ones: null, value: null, locked: false };
  }
  return {
    tens: state.tens,
    ones: swipe.digit,
    value: fakeHomeNumber(state.tens, swipe.digit),
    locked: true
  };
}
