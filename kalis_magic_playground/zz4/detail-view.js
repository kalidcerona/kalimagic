import {
  deletePreset, listCards, normalizeHiddenIds, presetFullList, renamePreset,
} from './logic.js';
import { confirmAsk } from './editor.js';
import { renderWizardPreview } from './wizard.js';
import { showView } from './views.js';
import { store, recoveryState, persist } from './controller.js';

let detailId = null;

function setDetailId(value) {
  detailId = value;
}

// ----- list detail -----
function renderDetail() {
  const preset = store.presets.find((entry) => entry.id === detailId);
  if (!preset) { showView('home', { push: false }); return; }
  const card = listCards(store).find((entry) => entry.id === detailId);
  const full = presetFullList(preset);
  document.getElementById('detail-title').textContent = preset.name;
  document.getElementById('detail-switch').setAttribute('aria-checked', String(card.enabled));
  document.getElementById('detail-target').textContent = card.target || '없음';
  document.getElementById('detail-count').textContent = `${card.count}개 · 붙여 넣어서 한 번에 고칠 수 있어요`;
  const number = Math.min(37, full.items.length);
  document.getElementById('detail-pv-label').textContent = `미리보기 (관객 번호 ${number})`;
  renderWizardPreview('detail-pv-title', 'detail-pv-lines', preset.name, full.items, full.target >= 0 ? full.target : full.items.length - 1, number);
}

function openDetail(id, message = '') {
  if (!store.presets.some((entry) => entry.id === id)) { showView('home'); return; }
  detailId = id;
  document.getElementById('detail-message').textContent = message;
  document.getElementById('detail-rename').hidden = true;
  renderDetail();
  showView('detail');
}

function saveRename() {
  const preset = store.presets.find((entry) => entry.id === detailId);
  if (!preset || recoveryState) return;
  const renamed = renamePreset(store.presets, preset.id, document.getElementById('detail-rename-input').value, { now: Date.now() });
  const message = document.getElementById('detail-message');
  if (!renamed.ok) { message.textContent = renamed.error; return; }
  if (!persist({ ...store, presets: renamed.presets })) { message.textContent = '저장하지 못했습니다.'; return; }
  document.getElementById('detail-rename').hidden = true;
  message.textContent = '이름을 바꿨어요.';
  renderDetail();
}

async function deleteDetail() {
  const preset = store.presets.find((entry) => entry.id === detailId);
  if (!preset || recoveryState) return;
  if (!(await confirmAsk(`「${preset.name}」 목록을 삭제할까요? 삭제한 목록은 되돌릴 수 없습니다.`, '삭제'))) return;
  const removed = deletePreset(store.presets, preset.id);
  if (!removed.ok) { document.getElementById('detail-message').textContent = removed.error; return; }
  const twoList = {
    ...store.twoList,
    presetIdA: store.twoList.presetIdA === preset.id ? null : store.twoList.presetIdA,
    presetIdB: store.twoList.presetIdB === preset.id ? null : store.twoList.presetIdB
  };
  const hidden = normalizeHiddenIds(store.hiddenPresetIds).filter((id) => id !== preset.id);
  if (!persist({ ...store, presets: removed.presets, twoList, hiddenPresetIds: hidden })) return;
  detailId = null;
  showView('home');
}

export { detailId, setDetailId, renderDetail, openDetail, saveRename, deleteDetail };
