// Validated, verified localStorage commits for preset meta and custom photo sets.
import { MESSAGES, parseMeta, parsePhotoSets } from './logic.js';
import { STORAGE_KEY, PHOTO_SETS_KEY, PHOTO_SET_COUNT, CUSTOM_COUNT } from './dom.js';
import { setError } from './status.js';
import { storageLocked, corrupt, customCorrupt, setMeta, setCustomIds } from './controller-state.js';

export function commitMeta(next, options = {}) {
  if (storageLocked) {
    setError(MESSAGES.storageReadFailed);
    return false;
  }
  if (corrupt && !options.replaceStored) {
    setError(MESSAGES.metaCorrupt);
    return false;
  }
  let raw;
  try {
    raw = JSON.stringify(next);
  } catch {
    setError(MESSAGES.storageFailed);
    return false;
  }
  if (!parseMeta(raw).ok) {
    setError(MESSAGES.storageFailed);
    return false;
  }
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, raw);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!parseMeta(stored).ok) {
      if (previous == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      setError(MESSAGES.storageFailed);
      return false;
    }
  } catch {
    setError(MESSAGES.storageFailed);
    return false;
  }
  setMeta(parseMeta(raw).meta);
  return true;
}

export function commitCustom(ids) {
  if (storageLocked || customCorrupt || !Array.isArray(ids) || ids.length !== CUSTOM_COUNT * PHOTO_SET_COUNT) {
    setError('내 사진 세트를 저장하지 못했습니다. 기존 사진은 바꾸지 않았습니다.');
    return false;
  }
  const sets = Array.from({ length: PHOTO_SET_COUNT }, (_, index) => ids.slice(index * CUSTOM_COUNT, (index + 1) * CUSTOM_COUNT));
  const raw = JSON.stringify({ version: 2, sets });
  if (!parsePhotoSets(raw).ok) {
    setError('내 사진 세트를 저장하지 못했습니다. 기존 사진은 바꾸지 않았습니다.');
    return false;
  }
  let previous;
  try {
    previous = localStorage.getItem(PHOTO_SETS_KEY);
    localStorage.setItem(PHOTO_SETS_KEY, raw);
    if (localStorage.getItem(PHOTO_SETS_KEY) !== raw) throw new Error('verify');
  } catch {
    try {
      if (previous === null) localStorage.removeItem(PHOTO_SETS_KEY);
      else if (previous !== undefined) localStorage.setItem(PHOTO_SETS_KEY, previous);
    } catch { /* Preserve legacy and IndexedDB data. */ }
    setError('내 사진 세트를 저장하지 못했습니다. 기존 사진은 바꾸지 않았습니다.');
    return false;
  }
  setCustomIds(ids.slice());
  return true;
}
