// Stored custom photo set rules for ALETHEIA.

export const PHOTO_SET_COUNT = 3;
export const PHOTO_SLOT_COUNT = 12;
const PHOTO_ID_RE = /^img_[A-Za-z0-9_-]{1,44}$/;

export function emptyPhotoSets() {
  return Array.from({ length: PHOTO_SET_COUNT }, () => Array(PHOTO_SLOT_COUNT).fill(null));
}

export function parsePhotoSets(raw, legacyRaw = null) {
  if (raw == null && legacyRaw == null) return { ok: true, needsMigration: false, sets: emptyPhotoSets() };
  let value;
  try { value = JSON.parse(raw == null ? legacyRaw : raw); } catch { return { ok: false }; }
  const legacy = raw == null;
  const sets = legacy ? [value?.imageIds, ...emptyPhotoSets().slice(1)] : value?.sets;
  if (value?.version !== (legacy ? 1 : 2) || !Array.isArray(sets) || sets.length !== PHOTO_SET_COUNT) return { ok: false };
  if (!sets.every((ids) => Array.isArray(ids) && ids.length === PHOTO_SLOT_COUNT
    && ids.every((id) => id === null || (typeof id === 'string' && PHOTO_ID_RE.test(id))))) return { ok: false };
  return { ok: true, needsMigration: legacy, sets: sets.map((ids) => ids.slice()) };
}
