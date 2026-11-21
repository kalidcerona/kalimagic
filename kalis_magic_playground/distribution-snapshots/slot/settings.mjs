import {save} from './storage.mjs';
export function settings(dialog,prefs,reset,onChange) {
  for (const key of ['sound','vibration']) {
    const input = dialog.querySelector('#'+key);
    input.checked = prefs[key];
    input.addEventListener('change', () => { prefs[key] = input.checked; save(prefs); });
  }
  dialog.querySelector('#next').onclick = () => { reset(); dialog.close(); };
  dialog.addEventListener('close',onChange);
  return () => { if (!dialog.open) { dialog.showModal(); onChange(); } };
}
