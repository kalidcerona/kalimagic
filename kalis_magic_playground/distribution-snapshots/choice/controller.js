import './backup.js';
import {
  APPEARANCES, MSG, addPreset, emptyState, wizardPayload, normalizeBuiltins, loadFromStorage,
  overwritePreset, replaceStoreKeepingBackup, saveState, splitForcePreset,
} from './logic.js';
import {
  nameInput, appearanceInput, itemsInput, forceInput, editorMessage, recoveryEl, recoveryError,
  recoverySlim,
} from './dom.js';
import { setEditorMessage, confirmSaveReport, renderTargets } from './editor.js';
import { renderOptions } from './options.js';
import { renderPrecheck, renderRecovery } from './precheck.js';
import {
  wizard, noteStoreDirty, flushDirtyViews, renderSaved, notesFate, finishWizard, bindSettingsViews,
} from './views.js';
import { commitItemEdits, renderWizardStep3 } from './wizard.js';
import { renderMemoryTable, renderExtras } from './extras.js';
import { syncUserIconsFromStorage, renderUserIcons } from './user-icons.js';
import { initPreviews } from './previews.js';
import { loadInputGuidePreference } from './input-guide.js';
import { startBootPerformance, armArtworkWarmup } from './performance.js';

let store = emptyState();
let recoveryState = null;
let repairIssues = [];
let loadedId = null;

function persist(next) {
  const previous = store;
  const replacing = Boolean(recoveryState);
  const result = replacing
    ? replaceStoreKeepingBackup(localStorage, next)
    : saveState(localStorage, next);
  if (!result.ok) {
    setEditorMessage(result.error);
    if (recoveryState) recoveryError.textContent = result.error;
    return false;
  }
  recoveryState = null;
  repairIssues = [];
  // The write already normalized the value. Reading it back would parse the same JSON again.
  store = result.data || next;
  noteStoreDirty(previous, next);
  renderRecovery();
  flushDirtyViews();
  return true;
}

function fillEditor(preset) {
  loadedId = preset ? preset.id : null;
  nameInput.value = preset ? preset.name : '';
  appearanceInput.value = preset && APPEARANCES[preset.appearance] ? preset.appearance : 'memo';
  const split = preset ? splitForcePreset(preset) : null;
  itemsInput.value = split ? split.items.join('\n') : '';
  forceInput.value = split ? split.forceItem : '';
  renderTargets();
  setEditorMessage('');
  renderSaved();
}

async function saveWizard() {
  if (wizard && wizard.editing) { commitItemEdits(); renderWizardStep3(); }
  if (!wizard || wizard.target < 0) return;
  const message = document.getElementById('wz-message3');
  if (recoveryState) { message.textContent = '저장본을 먼저 확인해 주세요.'; return; }
  const builtinTitle = wizard.title;
  if (wizard.mode === 'builtin') {
    const builtins = normalizeBuiltins(store.builtins);
    if (!persist({ ...store, builtins: { ...builtins, [wizard.id]: { enabled: true, target: wizard.target + 1 } } })) { message.textContent = '저장하지 못했습니다. 저장된 목록은 그대로입니다.'; return; }
    const fate = notesFate(wizard.id, builtinTitle);
    finishWizard(`${fate} 예언 항목은 목록에서 언제든 바꿀 수 있어요.`);
    return;
  }
  const payload = wizardPayload({ title: wizard.title, appearance: wizard.look, items: wizard.items, target: wizard.target });
  if (!payload) { message.textContent = '예언 항목을 먼저 고르세요.'; return; }
  // The checks read the same fields as before, so the saved form is filled first (the others, and the prophecy item apart).
  nameInput.value = payload.name;
  appearanceInput.value = payload.appearance;
  itemsInput.value = payload.items.filter((_, index) => index !== payload.targetIndex).join('\n');
  forceInput.value = payload.items[payload.targetIndex];
  loadedId = wizard.id;
  setEditorMessage('');
  if (!(await confirmSaveReport())) { message.textContent = editorMessage.textContent; return; }
  if (!wizard) return;
  const now = Date.now();
  const result = wizard.mode === 'new'
    ? addPreset(store.presets, payload, { now })
    : overwritePreset(store.presets, wizard.id, payload, { now });
  if (!result.ok) { message.textContent = result.error === MSG.duplicateName ? '같은 이름의 목록이 있습니다. 1단계에서 이름을 바꿔 주세요.' : result.error; return; }
  if (!persist({ ...store, presets: result.presets })) { message.textContent = '저장하지 못했습니다. 저장된 목록은 그대로입니다.'; return; }
  if (wizard.mode === 'new') finishWizard(`${notesFate(result.preset.id, wizard.title)} 예언 항목은 목록에서 언제든 바꿀 수 있어요.`);
  else finishWizard('', { detailId: wizard.id });
}

loadInputGuidePreference();
bindSettingsViews();

const loaded = loadFromStorage(localStorage);
if (!loaded.ok) {
  recoveryState = loaded;
  store = emptyState();
} else {
  store = loaded.data;
  repairIssues = loaded.issues.slice();
}
renderRecovery();
renderSaved();
renderOptions();
syncUserIconsFromStorage();
renderUserIcons();
initPreviews();
renderMemoryTable();
renderExtras();
renderPrecheck();
renderTargets('');
startBootPerformance();
document.getElementById('notes-entry-recovery')?.addEventListener('click', () => {
  recoveryEl.hidden = false;
  recoverySlim.hidden = true;
  recoveryEl.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
});
// A caught performance-start failure still finished booting. The repair watchdog only runs when this flag never arrives.
document.documentElement.setAttribute('data-choice-ready', '1');
armArtworkWarmup();

export { store, recoveryState, repairIssues, loadedId, persist, fillEditor, saveWizard };
