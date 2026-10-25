import {
  deletePreset, parseItemText, renamePreset, splitForcePreset, validateListInput,
} from './logic.js';
import {
  nameInput, appearanceInput, itemsInput, forceInput, itemHint, itemCount, editorMessage,
  confirmDialog, confirmText, confirmOk, form, editorWarnings, editorPreview,
} from './dom.js';
import { precheckRow } from './precheck.js';
import { store, loadedId, persist, fillEditor } from './controller.js';

function setEditorMessage(text) {
  editorMessage.textContent = text || '';
}

function confirmAsk(text, okLabel) {
  confirmText.textContent = text;
  confirmOk.textContent = okLabel;
  return new Promise((resolve) => {
    const onClose = () => {
      confirmDialog.removeEventListener('close', onClose);
      resolve(confirmDialog.returnValue === 'ok');
    };
    confirmDialog.addEventListener('close', onClose);
    confirmDialog.showModal();
  });
}

function readEditor() {
  return {
    name: nameInput.value,
    itemsText: itemsInput.value,
    forceItem: forceInput.value,
    appearance: appearanceInput.value
  };
}

function editorReport() {
  const others = store.presets
    .filter((preset) => preset.id !== loadedId)
    .map((preset) => splitForcePreset(preset).forceItem);
  return validateListInput({ itemsText: itemsInput.value, forceItem: forceInput.value }, { otherForceItems: others });
}

function renderEditorPreview() {
  if (!editorPreview || !editorWarnings) return;
  const report = editorReport();
  editorWarnings.replaceChildren(...report.warnings.map((warning) => precheckRow(warning.message, 'warn')));
  editorPreview.replaceChildren(...report.preview.map((entry) => {
    const row = document.createElement('li');
    if (entry.force) row.className = 'is-force';
    const no = document.createElement('span');
    no.className = 'no';
    no.textContent = String(entry.number);
    const text = document.createElement('span');
    text.textContent = entry.force ? `${entry.text} (예언 항목)` : entry.text;
    row.append(no, text);
    return row;
  }));
}

// Hard errors stop the save. Warnings are listed and the performer decides.
async function confirmSaveReport() {
  const report = editorReport();
  if (!report.ok) {
    setEditorMessage(report.errors[0]);
    return false;
  }
  if (!report.warnings.length) return true;
  return confirmAsk(`저장 전에 확인하세요.\n${report.warnings.map((warning) => `- ${warning.message}`).join('\n')}\n그래도 저장할까요?`, '저장');
}

function renderTargets() {
  renderEditorPreview();
  const parsed = parseItemText(itemsInput.value);
  const items = parsed.ok ? parsed.items : [];
  itemCount.textContent = `${items.length}개 / 199 (예언 항목 제외)`;
  if (!itemsInput.value.trim()) {
    itemHint.textContent = '예언 항목은 항목에 넣지 마세요. 항목은 한 줄에 하나씩, 최대 199개입니다.';
  } else if (!parsed.ok) {
    itemHint.textContent = parsed.error;
  } else {
    itemHint.textContent = '빈 줄은 빠집니다. 예언 항목은 관객이 고른 번호에 끼워 넣습니다.';
  }
}

function currentPreset() {
  return store.presets.find((preset) => preset.id === loadedId) || null;
}

function onRename() {
  if (!loadedId) {
    setEditorMessage('저장된 목록을 먼저 불러오세요.');
    return;
  }
  const renamed = renamePreset(store.presets, loadedId, nameInput.value, { now: Date.now() });
  if (!renamed.ok) {
    setEditorMessage(renamed.error);
    return;
  }
  if (!persist({ ...store, presets: renamed.presets })) return;
  fillEditor(store.presets.find((preset) => preset.id === loadedId) || renamed.preset);
  setEditorMessage('이름을 바꿨습니다. 항목은 그대로입니다.');
}

async function onDelete() {
  const current = currentPreset();
  if (!current) {
    setEditorMessage('저장된 목록을 먼저 불러오세요.');
    return;
  }
  const accepted = await confirmAsk(
    `「${current.name}」 목록을 삭제할까요? 삭제한 목록은 되돌릴 수 없습니다.`,
    '삭제'
  );
  if (!accepted) return;
  const removed = deletePreset(store.presets, current.id);
  if (!removed.ok) {
    setEditorMessage(removed.error);
    return;
  }
  const twoList = {
    ...store.twoList,
    presetIdA: store.twoList.presetIdA === current.id ? null : store.twoList.presetIdA,
    presetIdB: store.twoList.presetIdB === current.id ? null : store.twoList.presetIdB
  };
  if (!persist({ ...store, presets: removed.presets, twoList })) return;
  fillEditor(null);
  setEditorMessage('목록을 삭제했습니다.');
}

function bindEditorInputs() {
  form.addEventListener('submit', (event) => event.preventDefault());
  itemsInput.addEventListener('input', () => renderTargets());
  forceInput.addEventListener('input', () => renderEditorPreview());
}

export { setEditorMessage, confirmAsk, renderEditorPreview, confirmSaveReport, renderTargets, bindEditorInputs };
