import { SWIPE_PX, PUBLIC_COPY, APPEARANCES, MSG } from './logic-core.js';
import { createPreset, insertForceItem, splitForcePreset } from './logic-presets.js';

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
