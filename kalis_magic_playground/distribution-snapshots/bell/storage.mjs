import { preset } from './presets.mjs';

const key = 'friend-bell.settings.v1';
export function readSound(getStore = () => localStorage) {
  try { return preset(getStore().getItem(key)).id; }
  catch { return preset().id; }
}
export function saveSound(id, getStore = () => localStorage) {
  const sound = preset(id);
  try { getStore().setItem(key, sound.id); } catch {}
  return sound.id;
}

function choice(key, alternate, fallback, getStore) {
  try { return getStore().getItem(key) === alternate ? alternate : fallback; }
  catch { return fallback; }
}
export function readBackground(getStore = () => localStorage) {
  return choice('friend-bell.background.v1', 'dark', 'marble', getStore);
}
export function readCardBack(getStore = () => localStorage) {
  return choice('friend-bell.cardBack.v1', 'red', 'blue', getStore);
}

export function readItem(slot, getStore = () => localStorage) {
  const fallback = slot === 'firstItem' ? readCardBack(getStore) : 'none';
  try {
    const value = getStore().getItem('friend-bell.' + slot + '.v1');
    return ['blue', 'red', 'kennedy', 'walking', 'barber'].includes(value) ? value : fallback;
  } catch { return fallback; }
}
