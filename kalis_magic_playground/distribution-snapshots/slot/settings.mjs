import {save,validRound} from './storage.mjs';
export function settings(dialog,prefs,reset,onChange,progress) {
  for (const key of ['sound','vibration']) {
    const input = dialog.querySelector('#'+key);
    input.checked = prefs[key];
    input.addEventListener('change', () => { prefs[key] = input.checked; save(prefs); });
  }
  const field = dialog.querySelector('#round');
  field.value = prefs.round;
  field.onchange = () => {
    if (validRound(field.valueAsNumber)) {
      prefs.round = field.valueAsNumber;
      save(prefs);
    }
    field.value = prefs.round;
  };
  dialog.querySelector('#next').onclick = () => { reset(); dialog.close(); };
  dialog.addEventListener('close',onChange);
  return () => { if (!dialog.open) { dialog.querySelector('#progress').textContent = '현재 '+progress()+'회째'; dialog.showModal(); onChange(); } };
}
