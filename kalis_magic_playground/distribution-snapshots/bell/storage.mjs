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
