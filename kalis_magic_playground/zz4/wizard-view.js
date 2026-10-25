import { presetFullList, normalizeBuiltins, selectNotes } from './logic.js';
import { builtinById } from './builtin-lists.js';
import { startBlockReason, showStartProblem } from './performance.js';
import { store, recoveryState } from './controller.js';
import { setItemsLabels, renderWizardCount, markStep, showStep3 } from './wizard.js';
import { currentView, showView } from './views.js';
import { detailId, setDetailId, openDetail } from './detail-view.js';

// ----- list wizard (new list, edit items, choose the prophecy item) -----
const wzTitle = document.getElementById('wz-title');
const wzItems = document.getElementById('wz-items');
const wzSave = document.getElementById('wz-save');
let wizard = null;

function wizardLooks() {
  if (!wizard) return;
  document.querySelectorAll('#wz-looks .sv-chip').forEach((chip) => {
    const on = chip.dataset.look === wizard.look;
    chip.classList.toggle('on', on);
    chip.setAttribute('aria-checked', String(on));
  });
}

// The draft only lives in memory (no new storage), and only until the list is saved or started over.
let wizardDraft = null;

const draftNote = document.getElementById('wz-draft-note');

function keepWizardDraft() {
  const title = wzTitle.value;
  const text = wzItems.value;
  if (!title.trim() && !text.trim() && !wizard.items.length) { wizardDraft = null; return; }
  wizardDraft = { title, text, look: wizard.look, items: wizard.items.slice(), target: wizard.target, number: wizard.number, reached: wizard.reached || 1, strip: wizard.strip };
}

function renderDraftButton() {
  const button = document.getElementById('new-list');
  if (!button) return;
  const name = wizardDraft && wizardDraft.title.trim();
  button.textContent = wizardDraft ? `✎ 쓰던 목록 이어서 만들기${name ? ` (${name})` : ''}` : '＋ 새 목록 만들기';
}

function openNewWizard({ fresh = false } = {}) {
  if (recoveryState) { showStartProblem(startBlockReason()); return; }
  if (fresh) wizardDraft = null;
  const draft = wizardDraft;
  wizard = { mode: 'new', id: null, title: '', look: 'memo', items: [], target: -1, number: 1, returnTo: 'home', strip: true, reached: 1, editing: false };
  if (draft) {
    Object.assign(wizard, { look: draft.look, items: draft.items.slice(), target: draft.target, number: draft.number, reached: draft.reached, strip: draft.strip });
  }
  wzTitle.value = draft ? draft.title : '';
  wzItems.value = draft ? draft.text : '';
  if (draftNote) draftNote.hidden = !draft;
  setItemsLabels();
  document.getElementById('wz-message1').textContent = '';
  wizardLooks();
  renderWizardCount();
  showView('w1');
  markStep(1);
  wzTitle.focus({ preventScroll: true });
}

// What the saved list does in the notes right now, given the switches and the active performance set.
function notesFate(id, title) {
  const picked = selectNotes(store);
  if (picked.notes.some((note) => note.id === id)) return `「${title}」이 노트에 바로 나옵니다.`;
  if (picked.setName) return `지금 쓰는 공연 묶음 「${picked.setName}」에 이 목록이 들어 있지 않아 노트에 나오지 않습니다. 더 보기의 공연 묶음에서 넣어 주세요.`;
  return `「${title}」은 지금 노트에 나오지 않습니다. 목록의 스위치와 항목 수를 확인해 주세요.`;
}

function finishWizard(text, { detailId: back = null } = {}) {
  wizard = null;
  if (back) { openDetail(back, '저장했어요.'); return; }
  wizardDraft = null;
  document.getElementById('done-message').textContent = '';
  document.getElementById('done-title').textContent = '저장했어요';
  document.getElementById('done-text').textContent = text;
  showView('done');
}

function openTargetPicker(card, returnTo = 'home') {
  if (recoveryState) { showStartProblem(startBlockReason()); return; }
  if (card.builtin) {
    const list = builtinById(card.id);
    const target = normalizeBuiltins(store.builtins)[card.id].target - 1;
    wizard = { mode: 'builtin', id: card.id, title: list.name, look: 'memo', items: list.items.slice(), target, number: 1, returnTo, editing: false };
  } else {
    const preset = store.presets.find((entry) => entry.id === card.id);
    if (!preset) return;
    const full = presetFullList(preset);
    setDetailId(preset.id);
    wizard = { mode: 'edit-target', id: preset.id, title: preset.name, look: preset.appearance, items: full.items, target: full.target, number: 1, returnTo: currentView === 'detail' ? 'detail' : 'home', editing: false };
  }
  wizard.number = Math.min(37, wizard.items.length);
  showStep3();
}

function openEditItems() {
  const preset = store.presets.find((entry) => entry.id === detailId);
  if (!preset || recoveryState) return;
  const full = presetFullList(preset);
  wizard = { mode: 'edit', id: preset.id, title: preset.name, look: preset.appearance, items: full.items, target: full.target, number: Math.min(37, full.items.length), returnTo: 'detail', strip: false, editing: false };
  wzItems.value = full.items.join('\n');
  setItemsLabels();
  renderWizardCount();
  showView('w2');
}

// Registered from bindSettingsViews at the position the draft clear listener always had.
function bindWizardDraftClear() {
  document.getElementById('wz-draft-clear').addEventListener('click', () => {
    wizardDraft = null;
    wizard = { mode: 'new', id: null, title: '', look: 'memo', items: [], target: -1, number: 1, returnTo: 'home', strip: true, reached: 1, editing: false };
    wzTitle.value = ''; wzItems.value = '';
    draftNote.hidden = true;
    wizardLooks(); renderWizardCount(); markStep(1);
    wzTitle.focus({ preventScroll: true });
  });
}

function setWizard(value) {
  wizard = value;
}

export {
  wizard, setWizard, wzTitle, wzItems, wzSave, draftNote, wizardLooks, keepWizardDraft, renderDraftButton,
  openNewWizard, notesFate, finishWizard, openTargetPicker, openEditItems, bindWizardDraftClear,
};
