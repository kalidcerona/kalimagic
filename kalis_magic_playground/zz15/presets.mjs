import * as C from './core.mjs';
import { createPicker, createEditor } from './picker.mjs';
import { $ } from './dom.mjs';
import { hideChip } from './detect.mjs';

// ---------- storage (uramichi.web.*; every access may fail in private mode) ----------
const KEY = {
  presets: 'uramichi.web.presets', armed: 'uramichi.web.armed', armMode: 'uramichi.web.armMode',
  recent: 'uramichi.web.recent', settings: 'uramichi.web.settings', intro: 'uramichi.web.intro'
};
function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
function readSettings() {
  try { const s = JSON.parse(read(KEY.settings) || '{}'); return { sameWindow: s?.sameWindow === true }; } catch { return { sameWindow: false }; }
}

const store = {
  cats: C.decodeCategories(read(KEY.presets)) || C.shells(),
  armed: C.decodeArmed(read(KEY.armed)),
  armMode: ['ONCE', 'ALWAYS'].includes(read(KEY.armMode)) ? read(KEY.armMode) : 'ONCE',
  recents: C.decodeRecents(read(KEY.recent)),
  settings: readSettings(),
  setArmed(a) { this.armed = a; write(KEY.armed, a ? C.encodeArmed(a) : null); },
  arm(state, recent) {
    this.setArmed(state);
    this.recents = C.pushRecent(this.recents, recent);
    write(KEY.recent, C.encodeRecents(this.recents));
    try { navigator.vibrate?.(20); } catch { /* no haptics */ }
    closeSettings();
  },
  disarm() { this.setArmed(null); refreshSettings(); },
  setArmMode(mode) {
    this.armMode = mode;
    write(KEY.armMode, mode);
    if (this.armed && this.armed.mode !== 'SEQUENCE') this.setArmed({ ...this.armed, mode });
    refreshSettings();
  },
  saveCategories(list) {
    this.cats = list;
    write(KEY.presets, C.encodeCategories(list));
    this.recents = C.pruneRecents(this.recents, list);
    write(KEY.recent, C.encodeRecents(this.recents));
    picker.render();
  },
  toast(message) {
    const t = $('toast');
    t.textContent = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.textContent = ''; }, 3500);
  },
  ask(title, text, actions) {
    const dialog = $('askDialog');
    $('askTitle').textContent = title;
    $('askText').textContent = text;
    return new Promise((resolve) => {
      $('askActions').replaceChildren(...actions.map(([label, value], i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = i === actions.length - 1 ? 'btn primary' : 'btn2';
        b.textContent = label;
        b.addEventListener('click', () => { dialog.close(); resolve(value); });
        return b;
      }));
      dialog.addEventListener('cancel', () => resolve(actions[0][1]), { once: true });
      dialog.showModal();
    });
  },
  exportPresets() {
    const blob = new Blob([C.encodeCategories(this.cats)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'uramichi-presets.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.toast('프리셋을 내보냈습니다');
  },
  importPresets() { $('importFile').value = ''; $('importFile').click(); }
};
if (read(KEY.presets) === null) write(KEY.presets, C.encodeCategories(store.cats));

$('importFile').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  let text = null;
  try { text = await file.text(); } catch { text = null; }
  const result = C.parseImport(text);
  if (!result.ok) { store.toast(result.message); return; }
  const choice = await store.ask('프리셋 가져오기', `묶음 ${result.categories.length}개를 가져옵니다. 지금 프리셋을 모두 바꿀지, 지금 프리셋에 합칠지 고르세요.`, [['취소', null], ['합치기', 'merge'], ['바꾸기', 'replace']]);
  if (!choice) return;
  store.saveCategories(choice === 'replace' ? result.categories : C.mergeCategories(store.cats, result.categories));
  editor.reload();
  store.toast(choice === 'replace' ? '바꿨습니다' : '합쳤습니다');
});

const picker = createPicker($('picker'), store);
const editor = createEditor($('editor'), $('editorBody'), store);

// ---------- settings dialog ----------
function refreshSettings() { if ($('settings').open) picker.render(); }
function openSettings() {
  if ($('settings').open) return;
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  hideChip(true);
  picker.reset();
  picker.render();
  $('sameWindow').checked = store.settings.sameWindow;
  $('settings').showModal();
  $('settings').scrollTop = 0;
}
function closeSettings() { if ($('settings').open) $('settings').close(); }
$('closeSettings').addEventListener('click', closeSettings);
$('sameWindow').addEventListener('change', (ev) => {
  store.settings = { ...store.settings, sameWindow: ev.target.checked };
  write(KEY.settings, JSON.stringify(store.settings));
});

export {
  KEY,
  read,
  write,
  store,
  openSettings,
  closeSettings,
};
