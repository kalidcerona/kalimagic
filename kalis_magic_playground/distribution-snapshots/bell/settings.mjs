import { presets } from './presets.mjs';
import { readSound, saveSound } from './storage.mjs';
import { supported } from './vibration.mjs';

export function setupSettings(play) {
  const dialog = document.querySelector('dialog');
  const select = document.querySelector('#sound');
  const guide = document.querySelector('#install-guide');
  const standalone = window.matchMedia('(display-mode: standalone)');
  const updateGuide = () => { guide.hidden = standalone.matches || navigator.standalone === true; };
  updateGuide();
  standalone.addEventListener?.('change', updateGuide);
  let sound = readSound();
  for (const preset of presets) select.add(new Option(preset.name, preset.id));
  select.value = sound;
  select.onchange = () => { sound = saveSound(select.value); };
  document.querySelector('#preview').onclick = () => play(sound);
  document.querySelector('#vibration').textContent = supported()
    ? '벨을 누르면 짧게 진동합니다.' : '이 브라우저에서는 진동을 지원하지 않습니다.';
  return { sound: () => sound, open() { if (!dialog.open) dialog.showModal(); } };
}
