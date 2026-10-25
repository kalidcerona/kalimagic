import { MODE_HINTS, MODE_LABELS } from './logic.js';
import { meta, corrupt, storageLocked, busy, armDeleteId } from './controller.js';
import {
  presetList, emptyHint, startButton, cardStartButton, editorFields, modeInput, modeHint,
  recoverButton, resetStorageButton, cellGuideInput, coverageInput,
} from './dom.js';
import { syncCustomControls } from './photo-sets.js';

function syncControls() {
  const locked = storageLocked || corrupt || busy;
  editorFields.disabled = locked;
  startButton.disabled = locked || !meta.selectedId;
  if (cardStartButton) cardStartButton.disabled = busy;
  syncCustomControls();
  recoverButton.disabled = busy || storageLocked;
  resetStorageButton.disabled = busy || storageLocked;
  if (cellGuideInput) cellGuideInput.disabled = busy || storageLocked;
  if (coverageInput) coverageInput.disabled = busy || storageLocked;
  emptyHint.hidden = corrupt || meta.presets.length > 0;
}

function updateModeHint() {
  modeHint.textContent = MODE_HINTS[modeInput.value] || '';
}

function renderList() {
  presetList.replaceChildren();
  for (const item of meta.presets) {
    const selected = item.id === meta.selectedId;
    const card = document.createElement('article');
    card.className = selected ? 'preset selected' : 'preset';
    card.dataset.id = item.id;

    const name = document.createElement('h3');
    name.className = 'preset-name';
    name.textContent = item.name;

    const info = document.createElement('p');
    info.className = 'preset-meta';
    const hiddenLabel = item.hiddenPercent == null ? '가림 100%' : `가림 ${item.hiddenPercent}%`;
    info.textContent = `${MODE_LABELS[item.mode]} · ${hiddenLabel}`;

    const actions = document.createElement('div');
    actions.className = 'preset-actions';
    actions.append(
      actionButton(selected ? '선택됨' : '선택', 'select', selected),
      actionButton('수정', 'edit', false),
      actionButton(armDeleteId === item.id ? '정말 삭제' : '삭제', 'delete', false),
    );
    card.append(name, info, actions);
    presetList.append(card);
  }
  syncControls();
}

function actionButton(text, action, pressed) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = text;
  button.className = action === 'delete' ? 'danger' : 'secondary';
  if (action === 'select') button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  return button;
}

export { syncControls, updateModeHint, renderList };
