import {
  APPEARANCES,
  BOTTOM_GAP_RANGE,
  HOME_LAYOUT,
  MSG,
  IMPORT_MAX_BYTES,
  ICON_SIZE_RANGE,
  LABEL_SIZE_RANGE,
  NOTE_FONT_RANGE,
  NOTE_LIST_LIMIT,
  NOTE_MAX_ITEMS,
  NOTE_MIN_ITEMS,
  addDummyNote,
  addPreset,
  applyFakeHomeSwipe,
  applyFakeHomeTap,
  applyFakeHomeUndo,
  applyImportPlan,
  buildBackup,
  buildPrecheck,
  classifyFakeHomeGesture,
  createFakeHomeEntry,
  deleteDummyNote,
  deletePreset,
  deleteSet,
  emptyState,
  fakeHomeDigit,
  homeCellDigit,
  listCards,
  normalizeHiddenIds,
  parseWizardItems,
  stripItemPrefixes,
  presetFullList,
  previewNote,
  readinessSummary,
  wizardPayload,
  WIZARD_MAX_ITEMS,
  isZeroSlot,
  normalizeBuiltins,
  isTwoFingerDownSwipe,
  loadFromStorage,
  loadUserIcons,
  noteLines,
  normalizeOptions,
  overwritePreset,
  parseBackup,
  parseItemText,
  placeUserIcon,
  planImport,
  removeUserIcon,
  renamePreset,
  replaceStoreKeepingBackup,
  saveSet,
  saveState,
  saveUserIcons,
  selectNotes,
  splitForcePreset,
  updateDummyNote,
  validateListInput
} from './logic.js';
import { HOME_MANIFEST, iconSrc, manifestFiles } from './home-manifest.js';
import { BUILTIN_LISTS, builtinById } from './builtin-lists.js';

const gestureGuide = document.getElementById('settings-gesture-guide');
const gestureGuideDismiss = document.getElementById('settings-gesture-dismiss');
const GESTURE_GUIDE_KEY = 'magic-choice.settings-gesture-guide.v1';
let gestureGuideShown = false;

function maybeShowGestureGuide() {
  if (gestureGuideShown) return;
  try {
    if (localStorage.getItem(GESTURE_GUIDE_KEY) === 'done') return;
  } catch { /* Private browsing can block storage. */ }
  gestureGuideShown = true;
  gestureGuide.hidden = false;
  gestureGuideDismiss.focus();
}

function hideGestureGuide() {
  gestureGuide.hidden = true;
}

gestureGuideDismiss.addEventListener('click', () => {
  hideGestureGuide();
  try { localStorage.setItem(GESTURE_GUIDE_KEY, 'done'); } catch { /* Keep this session dismissed. */ }
});
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
  gestureGuide.addEventListener(type, (event) => event.stopPropagation());
}

const settingsEl = document.getElementById('settings');
const nameInput = document.getElementById('preset-name');
const appearanceInput = document.getElementById('appearance');
const itemsInput = document.getElementById('items');
const forceInput = document.getElementById('force-item');
const itemHint = document.getElementById('item-hint');
const itemCount = document.getElementById('item-count');
const editorMessage = document.getElementById('editor-message');
const editorFields = document.getElementById('editor-fields');
const recoveryEl = document.getElementById('recovery');
const recoveryError = document.getElementById('recovery-error');
const recoveryIssues = document.getElementById('recovery-issues');
const recoveryRaw = document.getElementById('recovery-raw');
const recoverySlim = document.getElementById('recovery-slim');
const repairNote = document.getElementById('repair-note');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmText = document.getElementById('confirm-text');
const confirmOk = document.getElementById('confirm-ok');
const form = document.getElementById('editor-form');
const notesEntryMessage = document.getElementById('notes-entry-message');
const notesEntryAction = document.getElementById('notes-entry-action');
const inputGuideInput = document.getElementById('input-guide');
const fakeHomeEl = document.getElementById('fake-home');
const fakeNotesEl = document.getElementById('fake-notes');
const fakeNotesTitle = document.getElementById('fake-notes-title');
const fakeNotesBody = document.getElementById('fake-notes-body');
const fakeNotesBack = document.getElementById('fake-notes-back');
const fakeNotesSearch = fakeHomeEl?.querySelector('.notes-search');
const fakeNotesFolder = fakeHomeEl?.querySelector('.notes-folder-row');
const fakeHomeDots = fakeHomeEl?.querySelector('.home-dots');
const fakePhone = fakeHomeEl?.querySelector('#fake-phone');
const fakeStatus = fakeHomeEl?.querySelector('.phone-status');
const entryReadout = document.getElementById('entry-readout');
const optStartMode = document.getElementById('opt-start-mode');
const optDisplay = document.getElementById('opt-display');
const optVibrate = document.getElementById('opt-vibrate');
const optionsMessage = document.getElementById('options-message');
const precheckList = document.getElementById('precheck-list');
const precheckRefresh = document.getElementById('precheck-refresh');
const optNoteFont = document.getElementById('opt-note-font');
const optNoteLine = document.getElementById('opt-note-line');
const optNoteEmphasis = document.getElementById('opt-note-emphasis');
const optIconSize = document.getElementById('opt-icon-size');
const optLabelSize = document.getElementById('opt-label-size');
const optBottomGap = document.getElementById('opt-bottom-gap');
const noteSample = document.getElementById('note-style-sample');
const fakeNotesHome = document.getElementById('fake-notes-home');
const fakeWallpaper = document.getElementById('fake-wallpaper');
const phoneDock = document.getElementById('phone-dock');
const statusTime = document.getElementById('status-time');
const editorWarnings = document.getElementById('editor-warnings');
const editorPreview = document.getElementById('editor-preview');

const INPUT_GUIDE_KEY = 'magic-choice.v1.input-guide';
const INPUT_GUIDE_HOLD_MS = 800;
const INPUT_GUIDE_FADE_MS = 240;
const PEEK_HOLD_MS = 400;
const VIBRATE_MS = 30;
const CLICK_GUARD_MS = 150;
const PEEK_MAX_MS = 1500;
const PEEK_MOVE_PX = 10;
const RESET_TAPS = 3;
const RESET_TAP_WINDOW_MS = 1200;
const RESET_CORNER_PX = 56;
const PINCH_MIN_ZOOM = 0.8;
const PINCH_MAX_ZOOM = 2.6;
const LINE_HEIGHTS = { compact: 1.3, normal: 1.5, relaxed: 1.85 };
const MAX_ITEM_CHARS = 120;
const noteDateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

let store = emptyState();
let recoveryState = null;
let repairIssues = [];
let loadedId = null;
let armed = null;
let fakeHomeSession = null;
let fakeHomeGesture = null;
let inputGuidePage = null;
let inputGuideToken = 0;
let inputGuideTimers = { hold: 0, fade: 0 };
let peek = null;
let clickGuardUntil = 0;
let readoutCleared = false;
let userIcons = [];
let resetTaps = null;
let cornerDown = null;
let wallpaperUrl = null;
let statusClock = 0;

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

function persist(next) {
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
  const reloaded = loadFromStorage(localStorage);
  store = reloaded.ok ? reloaded.data : next;
  renderRecovery();
  renderSaved();
  renderOptions();
  renderExtras();
  renderPrecheck();
  return true;
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

function renderOptions() {
  const options = normalizeOptions(store.options);
  if (optStartMode) optStartMode.value = options.startMode;
  if (optDisplay) optDisplay.value = options.display;
  if (optVibrate) optVibrate.checked = options.vibrate;
  if (optNoteFont) optNoteFont.value = String(options.noteFont);
  if (optNoteLine) optNoteLine.value = options.noteLine;
  if (optNoteEmphasis) optNoteEmphasis.value = options.noteEmphasis;
  if (optIconSize) optIconSize.value = String(options.iconSize);
  if (optLabelSize) optLabelSize.value = String(options.labelSize);
  if (optBottomGap) optBottomGap.value = String(options.bottomGap);
  renderOptionLabels();
}

function renderOptionLabels() {
  schedulePreviews();
  const set = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
  set('opt-note-font-value', `${optNoteFont?.value}px`);
  set('opt-icon-size-value', `${optIconSize?.value}%`);
  set('opt-label-size-value', `${optLabelSize?.value}px`);
  set('opt-bottom-gap-value', `${optBottomGap?.value}px`);
  if (noteSample && optNoteFont) {
    noteSample.style.fontSize = `${optNoteFont.value}px`;
    noteSample.style.lineHeight = String(LINE_HEIGHTS[optNoteLine?.value] || LINE_HEIGHTS.normal);
    noteSample.style.fontWeight = optNoteEmphasis?.value === 'bold' ? '800' : '400';
    noteSample.style.textDecoration = optNoteEmphasis?.value === 'underline' ? 'underline' : 'none';
    noteSample.style.background = optNoteEmphasis?.value === 'highlight' ? '#fff9a8' : '#fff';
  }
}

function controlOptions(patch = {}) {
  return normalizeOptions({
    ...normalizeOptions(store.options),
    startMode: optStartMode.value,
    display: optDisplay.value,
    vibrate: optVibrate.checked,
    noteFont: Number(optNoteFont.value),
    noteLine: optNoteLine.value,
    noteEmphasis: optNoteEmphasis.value,
    iconSize: Number(optIconSize.value),
    labelSize: Number(optLabelSize.value),
    bottomGap: Number(optBottomGap.value),
    ...patch
  });
}

function saveOptionsFromControls() {
  if (recoveryState) return;
  const options = controlOptions();
  const ok = persist({ ...store, options });
  if (!ok) renderOptions();
  if (optionsMessage) optionsMessage.textContent = ok ? '' : '설정을 저장하지 못했습니다. 저장된 목록은 그대로입니다.';
}

// Offline readiness: a registered, activated service worker owns the app shell cache.
async function checkOfflineReady() {
  try {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const registration = await navigator.serviceWorker.getRegistration('./');
    if (registration?.active?.state === 'activated') return 'ready';
    return 'pending';
  } catch {
    return 'unsupported';
  }
}

function precheckRow(text, tone) {
  const row = document.createElement('li');
  row.textContent = text;
  if (tone) row.dataset.tone = tone;
  return row;
}

function renderPrecheck(offline) {
  if (!precheckList) return;
  const report = buildPrecheck(store.presets, { maxItems: NOTE_MAX_ITEMS });
  const rows = [];
  const block = startBlockReason();
  rows.push(precheckRow(block ? `공연 시작: 지금은 시작할 수 없습니다. ${block.text}` : '공연 시작: 가능합니다.', block ? 'warn' : 'ok'));
  rows.push(precheckRow(`노트 ${report.noteCount}개, 공연에 쓸 수 있는 노트 ${report.eligibleCount}개`, report.eligibleCount ? 'ok' : 'warn'));
  const shown = selectNotes(store);
  rows.push(precheckRow(`노트 앱에 나오는 것: 목록 ${shown.forceCount}개, 일상 메모 ${shown.notes.length - shown.forceCount}개${shown.setName ? `, 묶음 「${shown.setName}」` : ', 묶음 없음'}`, shown.forceCount ? 'ok' : 'warn'));
  const readyCount = BUILTIN_LISTS.filter((list) => normalizeBuiltins(store.builtins)[list.id].enabled).length;
  rows.push(precheckRow(`기본 제공 목록: ${readyCount}개를 노트에 넣음`, ''));
  report.notes.forEach((note) => {
    const target = note.hasTarget ? '목표 설정됨' : '목표 없음';
    const size = note.eligible ? '' : ` (노트에는 ${NOTE_MIN_ITEMS}개에서 ${NOTE_MAX_ITEMS}개가 필요합니다)`;
    rows.push(precheckRow(`${note.name || '이름 없음'}: 항목 ${note.itemCount}개, ${target}${size}`, note.hasTarget && note.eligible ? 'ok' : 'warn'));
  });
  const offlineText = {
    ready: '오프라인 저장: 준비됨',
    pending: '오프라인 저장: 아직 준비되지 않았습니다. 인터넷이 연결된 상태에서 한 번 더 열어 주세요.',
    unsupported: '오프라인 저장: 이 브라우저에서는 확인할 수 없습니다.',
    checking: '오프라인 저장: 확인 중'
  };
  rows.push(precheckRow(offlineText[offline || 'checking'], offline === 'ready' ? 'ok' : 'warn'));
  let guideDone = false;
  try { guideDone = localStorage.getItem(GESTURE_GUIDE_KEY) === 'done'; } catch { /* Unknown counts as not done. */ }
  rows.push(precheckRow(guideDone ? '설정 이동 안내: 확인함' : '설정 이동 안내: 첫 공연 시작 때 한 번 나옵니다', guideDone ? 'ok' : ''));
  const shownOptions = normalizeOptions(store.options);
  if (isInputGuideEnabled()) {
    rows.push(precheckRow(shownOptions.display === 'performance'
      ? '숫자 칸 보여 주기: 켜짐. 주의: 공연 모드에서도 홈 화면에 들어올 때 키패드 숫자 대응표가 약 0.8초 관객에게 보입니다. 공연 전에는 끄세요.'
      : '숫자 칸 보여 주기: 켜짐 (연습용)', shownOptions.display === 'performance' ? 'warn' : ''));
  } else {
    rows.push(precheckRow('숫자 칸 보여 주기: 꺼짐', 'ok'));
  }
  if (shownOptions.noteEmphasis !== 'none') {
    rows.push(precheckRow('고른 번호 줄 강조: 켜짐. 주의: 공연에서 관객이 보는 노트에 목표 줄만 눈에 띄게 표시됩니다. 비밀이 드러나니 공연 전에 끄세요.', 'warn'));
  } else {
    rows.push(precheckRow('고른 번호 줄 강조: 꺼짐', 'ok'));
  }
  precheckList.replaceChildren(...rows);
  if (!offline) {
    checkOfflineReady().then((state) => renderPrecheck(state));
  }
}

function renderRecovery() {
  const blocked = Boolean(recoveryState);
  editorFields.disabled = blocked;
  const optionsFields = document.getElementById('options-fields');
  if (optionsFields) optionsFields.disabled = blocked;
  if (!recoveryState) {
    recoveryEl.hidden = true;
    recoverySlim.hidden = true;
    repairNote.hidden = repairIssues.length === 0;
    repairNote.textContent = repairIssues.length
      ? `저장본에서 고친 내용이 있습니다. 다시 저장하기 전까지는 이 화면에만 적용됩니다. ${repairIssues.join(' ')}`
      : '';
    return;
  }
  recoveryEl.hidden = false;
  recoverySlim.hidden = true;
  repairNote.hidden = true;
  recoveryError.textContent = recoveryState.error || '';
  recoveryIssues.replaceChildren();
  (recoveryState.issues || []).forEach((issue) => {
    const item = document.createElement('li');
    item.textContent = issue;
    recoveryIssues.append(item);
  });
  recoveryRaw.value = typeof recoveryState.raw === 'string' ? recoveryState.raw : '';
  document.getElementById('recovery-partial').disabled = !(recoveryState.partial?.presets?.length);
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

// ===== Settings views: home with list cards, three step list wizard, list detail, templates =====
const settingsViews = [...document.querySelectorAll('#settings .sv')];
const homeLists = document.getElementById('home-lists');
const templateList = document.getElementById('template-list');
const homeSummary = document.getElementById('home-summary');
let currentView = 'home';
let wizard = null;
let detailId = null;

// History keeps only the view name, an index and a per page load token. Wizard and detail screens are restored
// only while their in memory state exists; after a reload every older entry falls back to the settings home.
const NAV_TOKEN = Math.random().toString(36).slice(2);
let navIndex = 0;
const navState = (name) => ({ sv: name, i: navIndex, t: NAV_TOKEN });

function viewAllowed(name) {
  if (name === 'w1') return Boolean(wizard) && wizard.mode === 'new';
  if (name === 'w2') return Boolean(wizard) && (wizard.mode === 'new' || wizard.mode === 'edit');
  if (name === 'w3') return Boolean(wizard) && Array.isArray(wizard.items) && wizard.items.length >= 2;
  if (name === 'done') return false;
  if (name === 'detail') return store.presets.some((entry) => entry.id === detailId);
  return true;
}

function showView(name, { push = true } = {}) {
  if (!settingsViews.some((view) => view.dataset.viewName === name)) name = 'home';
  if (currentView === 'w3' && name !== 'w3') commitItemEdits();
  settingsViews.forEach((view) => { view.hidden = view.dataset.viewName !== name; });
  currentView = name;
  // A wizard only lives while one of its screens is open, so Back or Forward can never revive an abandoned one.
  // A half written new list is kept as a draft in memory, so leaving by mistake never loses it.
  if (name !== 'w1' && name !== 'w2' && name !== 'w3') {
    if (wizard && wizard.mode === 'new') keepWizardDraft();
    wizard = null;
  }
  if (name === 'w2') syncStep2();
  if (name === 'home') renderDraftButton();
  if (name === 'deco' || name === 'advanced') schedulePreviews();
  if (push) { try { history.pushState({ sv: name, i: navIndex + 1, t: NAV_TOKEN }, ''); navIndex += 1; } catch { /* History can be blocked. */ } }
  window.scrollTo(0, 0);
  const view = document.getElementById(`view-${name}`);
  view?.querySelector('.sv-title')?.focus({ preventScroll: true });
  if (name === 'check') renderPrecheck();
}

// UI back buttons step back in the browser history, so the browser Back button never reopens a screen that was left.
function goBack(fallback = 'home') {
  const state = history.state;
  if (state && state.t === NAV_TOKEN && state.i > 0) {
    try { history.back(); return; } catch { /* Fall through to the fallback screen. */ }
  }
  showView(viewAllowed(fallback) ? fallback : 'home', { push: false });
  navIndex = 0;
  try { history.replaceState(navState(currentView), ''); } catch { /* History can be blocked. */ }
}

function onPopState(event) {
  const state = event.state;
  const ours = Boolean(state) && state.t === NAV_TOKEN && typeof state.sv === 'string' && Number.isInteger(state.i);
  if (fakeHomeSession) {
    // The performance stays open: undo the history step so the stack and the settings view still agree when it closes.
    try { navIndex = (ours ? state.i : navIndex) + 1; history.pushState(navState(currentView), ''); } catch { /* History can be blocked. */ }
    return;
  }
  try {
    let name = ours ? state.sv : 'home';
    navIndex = ours ? state.i : 0;
    if (!viewAllowed(name)) name = 'home';
    showView(name, { push: false });
    if (name === 'detail') renderDetail();
    else if (name === 'w3') { renderWizardStep3(); markStep(3); }
    else if (name === 'w2') markStep(2);
    else if (name === 'w1') markStep(1);
    if (!ours || name !== state.sv) { try { history.replaceState(navState(name), ''); } catch { /* History can be blocked. */ } }
  } catch {
    showView('home', { push: false });
  }
}

function renderHomeSummary() {
  if (!homeSummary) return;
  const block = startBlockReason();
  const summary = readinessSummary(store);
  document.getElementById('notes-entry-title').textContent = block ? '공연 준비 필요' : '공연 준비 완료';
  if (block) {
    homeSummary.textContent = block.recovery ? '저장본을 먼저 확인해야 해요.' : '노트에 나올 목록이 없어요. 아래에서 켜거나 만들어 주세요.';
  } else {
    const extra = summary.tooLong ? ` 항목 수가 2개에서 100개가 아니라서 노트에 못 쓰는 목록이 ${summary.tooLong}개 있어요.` : ' 모두 예언 항목이 정해져 있습니다.';
    const outside = summary.outsideSet ? ` 공연 묶음 밖이라 안 나오는 목록은 ${summary.outsideSet}개예요.` : '';
    homeSummary.textContent = summary.setName
      ? `공연 묶음 「${summary.setName}」 기준으로 노트 목록 ${summary.onCount}개가 나와요.${extra}${outside}`
      : `노트 목록 ${summary.onCount}개가 켜져 있어요.${extra}`;
  }
  const check = document.getElementById('check-summary');
  if (check) check.textContent = block ? '확인이 필요해요' : '문제 없음';
}

function makeCardSwitch(card) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sv-sw';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(card.enabled));
  toggle.setAttribute('aria-label', `${card.title} 노트에 넣기`);
  toggle.addEventListener('click', (event) => { event.stopPropagation(); setListEnabled(card, !card.enabled); });
  return toggle;
}

function cardSummary(card) {
  const line = document.createElement('span');
  line.className = 'sv-s';
  line.append(document.createTextNode(`항목 ${card.count}개 · 예언 `));
  const target = document.createElement('b');
  target.textContent = card.target || '없음';
  line.append(target);
  if (!card.usable) line.append(document.createTextNode(' · 노트에는 2개에서 100개까지만 나와요'));
  return line;
}

function makeListCard(card) {
  const box = document.createElement('div');
  box.className = 'sv-card sv-list';
  box.dataset.listId = card.id;
  const row = document.createElement('div');
  row.className = 'sv-row';
  const copy = document.createElement('span');
  copy.className = 'sv-grow';
  const title = document.createElement('span');
  title.className = 'sv-t';
  title.textContent = card.title;
  if (card.builtin) {
    const tag = document.createElement('span');
    tag.className = 'sv-chip-tag';
    tag.textContent = '기본 제공';
    title.append(tag);
  }
  copy.append(title, cardSummary(card));
  row.append(copy, makeCardSwitch(card));
  const actions = document.createElement('div');
  actions.className = 'sv-actions';
  if (!card.builtin) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'sv-btn sv-sm';
    edit.dataset.action = 'edit';
    edit.textContent = '편집';
    edit.addEventListener('click', (event) => { event.stopPropagation(); openDetail(card.id); });
    actions.append(edit);
  }
  const change = document.createElement('button');
  change.type = 'button';
  change.className = 'sv-btn sv-sm';
  change.dataset.action = 'target';
  change.textContent = '예언 항목 바꾸기';
  change.addEventListener('click', (event) => { event.stopPropagation(); openTargetPicker(card); });
  actions.append(change);
  box.append(row, actions);
  if (!card.builtin) box.addEventListener('click', () => openDetail(card.id));
  return box;
}

function renderHomeLists() {
  if (!homeLists) return;
  homeLists.replaceChildren(...listCards(store).map(makeListCard));
}

function renderTemplates() {
  if (!templateList) return;
  templateList.replaceChildren(...BUILTIN_LISTS.map((list) => {
    const box = document.createElement('div');
    box.className = 'sv-card sv-list';
    const row = document.createElement('div');
    row.className = 'sv-row';
    const copy = document.createElement('span');
    copy.className = 'sv-grow';
    const title = document.createElement('span');
    title.className = 'sv-t';
    title.textContent = list.name;
    const count = document.createElement('span');
    count.className = 'sv-s';
    count.textContent = `항목 ${list.items.length}개`;
    copy.append(title, count);
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'sv-btn sv-sm sv-primary';
    use.dataset.template = list.id;
    use.textContent = '쓰기';
    use.addEventListener('click', () => openTargetPicker({ id: list.id, builtin: true, title: list.name }, 'templates'));
    row.append(copy, use);
    box.append(row);
    return box;
  }));
}

function renderSaved() {
  renderHomeLists();
  renderTemplates();
  renderHomeSummary();
}

function setListEnabled(card, enabled) {
  if (recoveryState) { showStartProblem(startBlockReason()); return; }
  let next;
  if (card.builtin) {
    const builtins = normalizeBuiltins(store.builtins);
    next = { ...store, builtins: { ...builtins, [card.id]: { ...builtins[card.id], enabled } } };
  } else {
    const hidden = new Set(normalizeHiddenIds(store.hiddenPresetIds));
    if (enabled) hidden.delete(card.id); else hidden.add(card.id);
    next = { ...store, hiddenPresetIds: [...hidden] };
  }
  persist(next);
  if (currentView === 'detail') renderDetail();
}

// ----- list wizard (new list, edit items, choose the prophecy item) -----
const wzTitle = document.getElementById('wz-title');
const wzItems = document.getElementById('wz-items');
const wzSave = document.getElementById('wz-save');

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

// Step bar: the current step is marked; earlier and already reached steps can be tapped to jump there.
function currentStep() { return currentView === 'w1' ? 1 : currentView === 'w2' ? 2 : 3; }

function markStep(step) {
  if (!wizard) return;
  const reached = Math.max(wizard.reached || 1, step);
  wizard.reached = reached;
  ['wz-steps1', 'wz-steps2', 'wz-steps3'].forEach((id) => {
    document.querySelectorAll(`#${id} .sv-stp`).forEach((button) => {
      const n = Number(button.dataset.step);
      button.classList.toggle('on', n <= reached);
      button.disabled = n > reached && n !== step;
      if (n === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
  });
}

function goWizardStep(target) {
  if (!wizard || wizard.mode !== 'new') return;
  const from = currentStep();
  if (target === from || target > (wizard.reached || 1)) return;
  if (target < from) {
    if (from === 3) commitItemEdits();
    showView(`w${target}`);
    markStep(target);
    return;
  }
  // Forward to a step that was already reached: the same checks as the Next buttons.
  if (from === 1) { wizardNext1(); if (currentView !== 'w2') return; }
  if (target === 3) wizardNext2();
}

// Items edited on step 3 are written back to the step 2 text, so both screens always agree.
function syncStep2() {
  if (!wizard) return;
  if (wizard.itemsDirty) {
    wzItems.value = wizard.items.join('\n');
    wizard.itemsDirty = false;
    wizard.strip = false;
  }
  renderWizardCount();
}

function duplicateNumbers(items) {
  const seen = new Map();
  items.forEach((item, index) => {
    const key = item.toLocaleLowerCase('ko-KR');
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(index + 1);
  });
  return [...seen.values()].filter((numbers) => numbers.length > 1);
}

// Existing items open as they are saved; only a new list strips "1. " / "- " from pasted lines. Editing a saved list offers "번호 지우기" instead.
function setItemsLabels() {
  const editing = Boolean(wizard) && wizard.mode === 'edit';
  document.getElementById('wz-title2').textContent = editing ? '항목 편집' : '새 목록 만들기';
  document.getElementById('wz-steps2').hidden = editing;
  document.getElementById('wz-q2').textContent = editing ? '항목을 고치거나 붙여 넣으세요' : '2. 항목을 붙여 넣으세요';
}

function renderWizardCount() {
  const stripPrefix = !wizard || wizard.strip !== false;
  const parsed = parseWizardItems(wzItems.value, { stripPrefix });
  document.getElementById('wz-strip').hidden = stripPrefix || stripItemPrefixes(wzItems.value) === wzItems.value;
  const count = document.getElementById('wz-count');
  count.replaceChildren();
  const strong = document.createElement('b');
  strong.textContent = `${parsed.count}개`;
  if (!parsed.ok) strong.className = 'bad';
  count.append(strong);
  const warnings = [];
  if (parsed.tooLongAt) warnings.push(`${parsed.tooLongAt}번 항목이 ${MAX_ITEM_CHARS}자를 넘습니다.`);
  else if (parsed.count > WIZARD_MAX_ITEMS) warnings.push(`노트에는 ${WIZARD_MAX_ITEMS}개까지만 나옵니다. 줄여 주세요.`);
  const dupes = duplicateNumbers(parsed.items);
  if (dupes.length) warnings.push(`같은 항목이 겹칩니다: ${dupes.slice(0, 3).map((numbers) => `${numbers.join('번, ')}번`).join(' / ')}${dupes.length > 3 ? ' 외' : ''}`);
  document.getElementById('wz-warnings').replaceChildren(...warnings.map((text) => { const li = document.createElement('li'); li.textContent = text; return li; }));
  document.getElementById('wz-next2').disabled = !parsed.ok;
  return parsed;
}

function wizardNext1() {
  if (!wizard) { showView('home'); return; }
  const title = wzTitle.value.trim();
  const message = document.getElementById('wz-message1');
  if (!title) { message.textContent = '목록 이름을 입력하세요.'; return; }
  if (Array.from(title).length > 40) { message.textContent = '목록 이름은 40자까지 입력할 수 있습니다.'; return; }
  if (store.presets.some((preset) => preset.name === title && preset.id !== wizard.id)) { message.textContent = '같은 이름의 목록이 있습니다. 다른 이름을 써 주세요.'; return; }
  message.textContent = '';
  wizard.title = title;
  showView('w2');
  markStep(2);
  wzItems.focus({ preventScroll: true });
}

function wizardNext2() {
  if (!wizard) { showView('home'); return; }
  const parsed = renderWizardCount();
  if (!parsed.ok) return;
  const previous = wizard.items[wizard.target];
  const unchanged = parsed.items.length === wizard.items.length && parsed.items.every((text, index) => text === wizard.items[index]);
  wizard.items = parsed.items;
  // The prophecy item stays selected when the items are unchanged or its text is still in the list, otherwise it has to be picked again.
  if (!unchanged) wizard.target = previous != null ? parsed.items.indexOf(previous) : -1;
  wizard.number = Math.min(Math.max(wizard.number, 1), parsed.items.length);
  wizard.editing = false;
  showStep3();
}

function showStep3() {
  const quick = wizard.mode === 'builtin' || wizard.mode === 'edit-target';
  const plain = quick || wizard.mode === 'edit';
  document.getElementById('wz-steps3').hidden = plain;
  document.getElementById('wz-title3').textContent = quick ? '예언 항목 바꾸기' : (wizard.mode === 'new' ? '새 목록 만들기' : '항목 편집');
  document.getElementById('wz-q3').textContent = plain ? '예언 항목을 탭하세요' : '3. 예언 항목을 탭하세요';
  wzSave.textContent = wizard.mode === 'builtin' ? '이 목록 쓰기' : '목록 저장';
  document.getElementById('wz-message3').textContent = '';
  renderWizardStep3();
  showView('w3');
  markStep(3);
}

// Items can be fixed in place while the list is being made: text, order and removal, and the prophecy item follows its text.
function canEditItems() { return Boolean(wizard) && wizard.mode !== 'builtin'; }

function commitItemEdits() {
  if (!wizard || !wizard.editing) return;
  wizard.editing = false;
  const kept = [];
  let target = -1;
  wizard.items.forEach((text, index) => {
    const clean = text.trim();
    if (!clean) return;
    if (index === wizard.target) target = kept.length;
    kept.push(clean);
  });
  wizard.items = kept;
  wizard.target = target;
  wizard.number = Math.min(Math.max(wizard.number, 1), Math.max(kept.length, 1));
}

function moveItem(index, delta) {
  const to = index + delta;
  if (to < 0 || to >= wizard.items.length) return;
  const items = wizard.items;
  [items[index], items[to]] = [items[to], items[index]];
  if (wizard.target === index) wizard.target = to;
  else if (wizard.target === to) wizard.target = index;
  wizard.itemsDirty = true;
}

function removeItem(index) {
  wizard.items.splice(index, 1);
  if (wizard.target === index) wizard.target = -1;
  else if (wizard.target > index) wizard.target -= 1;
  wizard.number = Math.min(Math.max(wizard.number, 1), Math.max(wizard.items.length, 1));
  wizard.itemsDirty = true;
}

function editRow(text, index) {
  const row = document.createElement('div');
  row.className = 'sv-erow';
  row.dataset.index = String(index);
  const n = document.createElement('span'); n.className = 'n'; n.textContent = String(index + 1);
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'sv-einput'; input.value = text; input.maxLength = MAX_ITEM_CHARS;
  input.setAttribute('aria-label', `${index + 1}번 항목`);
  input.autocomplete = 'off';
  input.addEventListener('input', () => { wizard.items[index] = input.value; wizard.itemsDirty = true; renderWizardMeta(); });
  const button = (act, label, glyph, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sv-eb'; b.dataset.act = act; b.textContent = glyph; b.disabled = disabled;
    b.setAttribute('aria-label', `${index + 1}번 ${label}`);
    return b;
  };
  const star = button('target', '예언 항목으로', wizard.target === index ? '★' : '☆');
  star.setAttribute('aria-pressed', String(wizard.target === index));
  star.addEventListener('click', () => { wizard.target = index; renderWizardStep3(); });
  const up = button('up', '위로', '▲', index === 0);
  up.addEventListener('click', () => { moveItem(index, -1); renderWizardStep3(); });
  const down = button('down', '아래로', '▼', index === wizard.items.length - 1);
  down.addEventListener('click', () => { moveItem(index, 1); renderWizardStep3(); });
  const del = button('del', '빼기', '✕');
  del.addEventListener('click', () => { removeItem(index); renderWizardStep3(); });
  row.append(n, input, star, up, down, del);
  return row;
}

// Counts, the sample note and the save button follow the items, without redrawing the rows being typed in.
function renderWizardMeta() {
  const filled = wizard.items.filter((text) => text.trim());
  const targetText = wizard.target >= 0 ? wizard.items[wizard.target] : '';
  const targetOk = wizard.target >= 0 && targetText.trim();
  const tooFew = filled.length < 2;
  const tooMany = filled.length > WIZARD_MAX_ITEMS;
  document.getElementById('wz-pick-label').textContent = wizard.editing ? `항목 ${filled.length}개 고치는 중` : `항목 ${wizard.items.length}개 중 하나 고르기`;
  document.getElementById('wz-message3').textContent = tooFew ? '항목은 2개 이상 필요해요.' : tooMany ? `노트에는 ${WIZARD_MAX_ITEMS}개까지만 나옵니다. 줄여 주세요.` : '';
  wzSave.disabled = !targetOk || tooFew || tooMany;
  const previewTarget = targetOk ? wizard.items.slice(0, wizard.target).filter((text) => text.trim()).length : -1;
  renderWizardPreview('wz-pv-title', 'wz-pv-lines', wizard.title, wizard.editing ? filled : wizard.items, wizard.editing ? previewTarget : wizard.target, Math.min(Math.max(wizard.number, 1), Math.max(filled.length, 1)));
}

function renderWizardStep3() {
  const { items, target } = wizard;
  const editable = canEditItems();
  const toggle = document.getElementById('wz-edit-toggle');
  toggle.hidden = !editable;
  toggle.textContent = wizard.editing ? '고치기 끝' : '항목 고치기';
  toggle.setAttribute('aria-pressed', String(Boolean(wizard.editing)));
  document.getElementById('wz-edit-hint').hidden = !wizard.editing;
  document.getElementById('wz-add').hidden = !wizard.editing;
  const picksBox = document.getElementById('wz-picks');
  picksBox.classList.toggle('sv-edit', Boolean(wizard.editing));
  if (wizard.editing) {
    picksBox.removeAttribute('role');
    picksBox.replaceChildren(...items.map(editRow));
    document.getElementById('wz-num').textContent = String(wizard.number);
    renderWizardMeta();
    return;
  }
  picksBox.setAttribute('role', 'radiogroup');
  document.getElementById('wz-pick-label').textContent = `항목 ${items.length}개 중 하나 고르기`;
  const picks = items.map((text, index) => {
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'sv-pick';
    pick.setAttribute('role', 'radio');
    pick.setAttribute('aria-checked', String(index === target));
    pick.dataset.index = String(index);
    const n = document.createElement('span'); n.className = 'n'; n.textContent = String(index + 1);
    const x = document.createElement('span'); x.className = 'x'; x.textContent = text;
    const tag = document.createElement('span'); tag.className = 'tg'; tag.textContent = '예언';
    pick.append(n, x, tag);
    pick.addEventListener('click', () => { wizard.target = index; renderWizardStep3(); });
    return pick;
  });
  picksBox.replaceChildren(...picks);
  renderWizardPreview('wz-pv-title', 'wz-pv-lines', wizard.title, items, target, wizard.number);
  document.getElementById('wz-num').textContent = String(wizard.number);
  document.getElementById('wz-message3').textContent = items.length < 2 ? '항목은 2개 이상 필요해요.' : '';
  wzSave.disabled = target < 0 || items.length < 2 || items.length > WIZARD_MAX_ITEMS;
}

function toggleItemEditing() {
  if (!wizard || !canEditItems()) return;
  if (wizard.editing) commitItemEdits(); else wizard.editing = true;
  renderWizardStep3();
}

function addItemRow() {
  if (!wizard || !wizard.editing || wizard.items.length >= WIZARD_MAX_ITEMS) return;
  wizard.items.push('');
  wizard.itemsDirty = true;
  renderWizardStep3();
  const rows = document.querySelectorAll('#wz-picks .sv-einput');
  rows[rows.length - 1]?.focus();
}

// A small note drawn from the list, the way the notes app will show it for a sample number.
function renderWizardPreview(titleId, linesId, title, items, target, number) {
  document.getElementById(titleId).textContent = title;
  const box = document.getElementById(linesId);
  const view = target >= 0 ? previewNote(items, target, number) : null;
  if (!view) { box.textContent = '예언 항목을 고르면 여기에 보여요.'; return; }
  box.replaceChildren(...view.lines.map((line) => {
    const row = document.createElement('div');
    row.className = line.hit ? 'sv-pv-l hit' : 'sv-pv-l';
    const n = document.createElement('span'); n.textContent = String(line.number);
    const t = document.createElement('span'); t.textContent = line.text;
    row.append(n, t);
    return row;
  }));
}

function stepWizardNumber(delta) {
  if (!wizard) return;
  wizard.number = Math.min(Math.max(1, wizard.number + delta), wizard.items.length);
  renderWizardStep3();
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
    detailId = preset.id;
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

// The soft keyboard must never cover the bottom buttons: lift them by what the keyboard takes away.
function trackKeyboard() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const apply = () => {
    const covered = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    settingsEl.style.setProperty('--kb', `${covered}px`);
  };
  viewport.addEventListener('resize', apply);
  viewport.addEventListener('scroll', apply);
  apply();
  settingsEl.addEventListener('focusin', (event) => {
    const field = event.target;
    if (field instanceof HTMLElement && field.matches('input[type="text"], textarea')) setTimeout(() => field.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 250);
  });
}

function bindSettingsViews() {
  settingsEl.addEventListener('click', (event) => {
    const go = event.target.closest?.('[data-sv-go]');
    if (!go) return;
    if (go.classList.contains('sv-ib') && go.textContent.trim() === '‹') goBack(go.dataset.svGo);
    else showView(go.dataset.svGo);
  });
  document.getElementById('new-list').addEventListener('click', () => openNewWizard());
  document.getElementById('wz-draft-clear').addEventListener('click', () => {
    wizardDraft = null;
    wizard = { mode: 'new', id: null, title: '', look: 'memo', items: [], target: -1, number: 1, returnTo: 'home', strip: true, reached: 1, editing: false };
    wzTitle.value = ''; wzItems.value = '';
    draftNote.hidden = true;
    wizardLooks(); renderWizardCount(); markStep(1);
    wzTitle.focus({ preventScroll: true });
  });
  document.querySelectorAll('.sv-steps .sv-stp').forEach((button) => button.addEventListener('click', () => goWizardStep(Number(button.dataset.step))));
  document.getElementById('wz-edit-toggle').addEventListener('click', toggleItemEditing);
  document.querySelectorAll('.sv-tab').forEach((tab) => tab.addEventListener('click', () => {
    const kind = tab.dataset.pv;
    document.querySelectorAll('.sv-tab').forEach((other) => { const on = other === tab; other.classList.toggle('on', on); other.setAttribute('aria-pressed', String(on)); });
    document.getElementById('deco-pv-home').hidden = kind !== 'home';
    document.getElementById('deco-pv-notes').hidden = kind !== 'notes';
    document.getElementById('deco-pv-cap').hidden = kind !== 'home';
    document.getElementById('deco-pv-notes-cap').hidden = kind !== 'notes';
  }));
  document.getElementById('wz-add').addEventListener('click', addItemRow);
  document.querySelectorAll('#wz-looks .sv-chip').forEach((chip) => chip.addEventListener('click', () => { if (!wizard) return; wizard.look = chip.dataset.look; wizardLooks(); }));
  document.getElementById('wz-next1').addEventListener('click', wizardNext1);
  wzTitle.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); wizardNext1(); } });
  wzItems.addEventListener('input', renderWizardCount);
  document.getElementById('wz-next2').addEventListener('click', wizardNext2);
  document.getElementById('wz-strip').addEventListener('click', () => {
    if (!wizard) return;
    const before = parseWizardItems(wzItems.value, { stripPrefix: false }).items;
    wzItems.value = stripItemPrefixes(wzItems.value);
    const after = parseWizardItems(wzItems.value, { stripPrefix: false }).items;
    // The chosen prophecy item keeps its place when the lines were the saved ones.
    if (before.length === wizard.items.length && before.every((text, index) => text === wizard.items[index])) wizard.items = after;
    renderWizardCount();
  });
  const backFromItems = () => goBack(wizard && wizard.mode === 'edit' ? 'detail' : 'w1');
  document.getElementById('wz-back2').addEventListener('click', backFromItems);
  document.getElementById('wz-prev2').addEventListener('click', backFromItems);
  document.getElementById('wz-back3').addEventListener('click', () => {
    commitItemEdits();
    goBack(wizard && (wizard.mode === 'new' || wizard.mode === 'edit') ? 'w2' : (wizard?.returnTo || 'home'));
  });
  document.getElementById('wz-minus').addEventListener('click', () => stepWizardNumber(-1));
  document.getElementById('wz-plus').addEventListener('click', () => stepWizardNumber(1));
  wzSave.addEventListener('click', () => { saveWizard(); });
  document.getElementById('done-start').addEventListener('click', startNotesShow);
  document.getElementById('detail-switch').addEventListener('click', () => {
    const card = listCards(store).find((entry) => entry.id === detailId);
    if (card) setListEnabled(card, !card.enabled);
  });
  document.getElementById('detail-change').addEventListener('click', () => { const card = listCards(store).find((entry) => entry.id === detailId); if (card) openTargetPicker(card); });
  document.getElementById('detail-edit').addEventListener('click', openEditItems);
  document.getElementById('detail-rename-open').addEventListener('click', () => {
    const box = document.getElementById('detail-rename');
    box.hidden = !box.hidden;
    if (!box.hidden) { const input = document.getElementById('detail-rename-input'); input.value = store.presets.find((entry) => entry.id === detailId)?.name || ''; input.focus(); }
  });
  document.getElementById('detail-rename-save').addEventListener('click', saveRename);
  document.getElementById('detail-rename-cancel').addEventListener('click', () => { document.getElementById('detail-rename').hidden = true; });
  document.getElementById('detail-delete').addEventListener('click', () => { deleteDetail(); });
  window.addEventListener('popstate', onPopState);
  try { history.replaceState(navState('home'), ''); } catch { /* History can be blocked. */ }
  trackKeyboard();
}

// ----- Settings extras: dummy notes, performance sets, backup, own app icons, memory table -----
const DUMMY_EXAMPLES = [
  { title: '장보기', body: '우유 1팩\n계란 한 판\n두부\n대파\n현미밥 세 개\n샴푸 (세일 확인)' },
  { title: '이번 주 운동', body: '월 러닝 30분\n수 스트레칭\n금 가벼운 근력 운동\n토 친구랑 등산\n\n물 많이 마시기' },
  { title: '회의 메모', body: '금요일 오후 3시 팀 회의\n자료는 전날까지 공유\n예산표 수정본 확인\n다음 주 일정 다시 조율' },
  { title: '읽고 싶은 책', body: '바다가 보이는 방\n천천히 오래 걷는 법\n작은 도시의 하루\n(도서관 대출 가능한지 먼저 확인)' }
];
const dummyList = document.getElementById('dummy-list');
const dummyTitle = document.getElementById('dummy-title');
const dummyBody = document.getElementById('dummy-body');
const dummyMessage = document.getElementById('dummy-message');
const setActive = document.getElementById('set-active');
const setSelect = document.getElementById('set-select');
const setName = document.getElementById('set-name');
const setPresets = document.getElementById('set-presets');
const setDummies = document.getElementById('set-dummies');
const setMessage = document.getElementById('set-message');
const setSummary = document.getElementById('set-summary');
const backupMessage = document.getElementById('backup-message');
const importPreview = document.getElementById('import-preview');
const importList = document.getElementById('import-list');
let dummyLoadedId = null;
let setLoadedId = null;
let pendingImport = null;

function persistExtras(patch, message, target) {
  if (recoveryState) {
    target.textContent = '저장본을 먼저 처리하세요.';
    return false;
  }
  const ok = persist({ ...store, ...patch });
  target.textContent = ok ? (message || '') : '저장하지 못했습니다. 저장된 목록은 그대로입니다.';
  return ok;
}

function fillDummyForm(note) {
  dummyLoadedId = note ? note.id : null;
  dummyTitle.value = note ? note.title : '';
  dummyBody.value = note ? note.body : '';
}

function renderDummies() {
  const notes = store.dummyNotes || [];
  dummyList.replaceChildren();
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '일상 메모가 없습니다.';
    dummyList.append(empty);
    return;
  }
  notes.forEach((note) => {
    const card = document.createElement('article');
    card.className = 'preset';
    const title = document.createElement('h3');
    title.textContent = note.title;
    const meta = document.createElement('p');
    meta.className = 'hint';
    meta.textContent = note.body.split('\n')[0].slice(0, 40);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '편집';
    edit.addEventListener('click', () => { fillDummyForm(note); dummyTitle.focus(); });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '삭제';
    remove.addEventListener('click', async () => {
      if (!(await confirmAsk(`일상 메모 「${note.title}」를 삭제할까요?`, '삭제'))) return;
      const removed = deleteDummyNote(store, note.id);
      if (!removed.ok) { dummyMessage.textContent = removed.error; return; }
      if (persistExtras({ dummyNotes: removed.dummyNotes, sets: removed.sets }, '삭제했습니다.', dummyMessage) && dummyLoadedId === note.id) fillDummyForm(null);
    });
    actions.append(edit, remove);
    card.append(title, meta, actions);
    dummyList.append(card);
  });
}

function onDummySave() {
  const input = { title: dummyTitle.value, body: dummyBody.value };
  const result = dummyLoadedId ? updateDummyNote(store, dummyLoadedId, input) : addDummyNote(store, input);
  if (!result.ok) { dummyMessage.textContent = result.error; return; }
  if (persistExtras({ dummyNotes: result.dummyNotes }, '저장했습니다.', dummyMessage)) fillDummyForm(null);
}

function onDummyExamples() {
  let state = store;
  let added = 0;
  const stamp = Date.now();
  DUMMY_EXAMPLES.forEach((example, index) => {
    // Older timestamps keep the dummies below fresh lists in the notes index.
    const result = addDummyNote(state, { ...example, updatedAt: stamp - (index + 1) * 86400000 * 3 }, { now: stamp + index });
    if (result.ok) { state = { ...state, dummyNotes: result.dummyNotes }; added += 1; }
  });
  if (!added) { dummyMessage.textContent = '예시는 이미 모두 들어 있습니다.'; return; }
  persistExtras({ dummyNotes: state.dummyNotes }, `예시 ${added}개를 넣었습니다.`, dummyMessage);
}

function checkRow(container, id, label, checked) {
  const row = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = id;
  input.checked = checked;
  const text = document.createElement('span');
  text.textContent = label;
  row.append(input, text);
  container.append(row);
}

function renderSets() {
  const sets = store.sets || [];
  setActive.replaceChildren(new Option('묶음 없음 (조건에 맞는 모든 목록)', ''), ...sets.map((set) => new Option(set.name, set.id)));
  setActive.value = store.activeSetId || '';
  setSelect.replaceChildren(new Option('새 묶음', ''), ...sets.map((set) => new Option(set.name, set.id)));
  if (!sets.some((set) => set.id === setLoadedId)) setLoadedId = null;
  setSelect.value = setLoadedId || '';
  const loaded = sets.find((set) => set.id === setLoadedId) || null;
  setName.value = loaded ? loaded.name : setName.value;
  setPresets.replaceChildren();
  store.presets.forEach((preset) => checkRow(setPresets, preset.id, preset.name, Boolean(loaded?.presetIds.includes(preset.id))));
  BUILTIN_LISTS.forEach((list) => checkRow(setPresets, list.id, `${list.name} (기본 제공)`, Boolean(loaded?.presetIds.includes(list.id))));
  setDummies.replaceChildren();
  (store.dummyNotes || []).forEach((note) => checkRow(setDummies, note.id, note.title, Boolean(loaded?.dummyIds.includes(note.id))));
  const shown = selectNotes(store);
  setSummary.textContent = `지금 노트에 나오는 것: 목록 ${shown.forceCount}개, 일상 메모 ${shown.notes.length - shown.forceCount}개${shown.setName ? `, 묶음 「${shown.setName}」` : ''}`;
}

function checkedValues(container) {
  return [...container.querySelectorAll('input:checked')].map((input) => input.value);
}

function onSetSave() {
  const result = saveSet(store, { id: setLoadedId, name: setName.value, presetIds: checkedValues(setPresets), dummyIds: checkedValues(setDummies) });
  if (!result.ok) { setMessage.textContent = result.error; return; }
  setLoadedId = result.set.id;
  persistExtras({ sets: result.sets }, '묶음을 저장했습니다.', setMessage);
}

async function onSetDelete() {
  const current = (store.sets || []).find((set) => set.id === setLoadedId);
  if (!current) { setMessage.textContent = '지울 묶음을 먼저 고르세요.'; return; }
  if (!(await confirmAsk(`묶음 「${current.name}」를 삭제할까요? 목록과 일상 메모는 그대로 남습니다.`, '삭제'))) return;
  const removed = deleteSet(store, current.id);
  if (!removed.ok) { setMessage.textContent = removed.error; return; }
  setLoadedId = null;
  setName.value = '';
  persistExtras({ sets: removed.sets, activeSetId: removed.activeSetId }, '삭제했습니다.', setMessage);
}

function onBackupExport() {
  const backup = buildBackup(store, Date.now());
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  const link = document.createElement('a');
  const day = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.download = `너의-선택은-백업-${day}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  backupMessage.textContent = `목록 ${backup.presets.length}개, 묶음 ${backup.sets.length}개, 일상 메모 ${backup.dummyNotes.length}개를 내보냈습니다.`;
}

function renderImportPreview(plan, issues) {
  const label = { add: '추가', 'add-copy': '사본으로 추가', skip: '건너뜀', full: '가져오지 못함' };
  const rows = [];
  const push = (kind, entries) => entries.forEach((entry) => rows.push(precheckRow(
    `${kind} 「${entry.newName && entry.newName !== entry.name ? `${entry.name} → ${entry.newName}` : entry.name}」: ${label[entry.action]}${entry.reason ? ` (${entry.reason})` : ''}`,
    entry.action === 'skip' ? '' : (entry.action === 'full' ? 'warn' : 'ok')
  )));
  push('목록', plan.presets);
  push('일상 메모', plan.dummies);
  push('묶음', plan.sets);
  issues.forEach((issue) => rows.push(precheckRow(`읽지 못함: ${issue}`, 'warn')));
  rows.push(precheckRow(`합계: 추가 ${plan.counts.added}개 (그중 사본 ${plan.counts.copies}개), 건너뜀 ${plan.counts.skipped}개${plan.counts.dropped ? `, 한도 때문에 가져오지 못함 ${plan.counts.dropped}개` : ''}. 지금 저장된 것은 바꾸지 않습니다.`, plan.counts.dropped ? 'warn' : ''));
  importList.replaceChildren(...rows);
  importPreview.hidden = false;
  document.getElementById('import-apply').disabled = plan.counts.added === 0;
}

async function onImportFile(event) {
  const file = event.target.files?.[0];
  pendingImport = null;
  importPreview.hidden = true;
  if (!file) return;
  if (recoveryState) { backupMessage.textContent = '저장본을 먼저 처리하세요.'; return; }
  if (file.size > IMPORT_MAX_BYTES) { backupMessage.textContent = '파일이 너무 큽니다. 2MB 이하의 백업 파일만 가져올 수 있습니다.'; event.target.value = ''; return; }
  const text = await file.text().catch(() => '');
  const parsed = parseBackup(text);
  if (!parsed.ok) { backupMessage.textContent = parsed.error; return; }
  const plan = planImport(store, parsed.backup);
  pendingImport = { plan };
  backupMessage.textContent = '';
  renderImportPreview(plan, parsed.issues);
}

function onImportApply() {
  if (!pendingImport) return;
  const merged = applyImportPlan(store, pendingImport.plan);
  const { added: count, dropped } = pendingImport.plan.counts;
  if (!persist({ ...store, presets: merged.presets, sets: merged.sets, dummyNotes: merged.dummyNotes })) {
    backupMessage.textContent = '저장하지 못했습니다. 저장된 목록은 그대로입니다.';
    return;
  }
  pendingImport = null;
  importPreview.hidden = true;
  document.getElementById('import-file').value = '';
  backupMessage.textContent = dropped ? `${count}개를 가져왔습니다. 한도 때문에 ${dropped}개는 가져오지 못했습니다.` : `${count}개를 가져왔습니다.`;
}

function onImportCancel() {
  pendingImport = null;
  importPreview.hidden = true;
  document.getElementById('import-file').value = '';
  backupMessage.textContent = '가져오기를 취소했습니다. 아무것도 바뀌지 않았습니다.';
}

// Own app icons: pick an image or a home screen capture, crop a square, give it a name and a 0 cell.
const iconEditor = document.getElementById('usericon-editor');
const iconCanvas = document.getElementById('usericon-canvas');
const iconZoom = document.getElementById('usericon-zoom');
const iconLabel = document.getElementById('usericon-label');
const iconPage = document.getElementById('usericon-page');
const iconSlots = document.getElementById('usericon-slots');
const iconSlotText = document.getElementById('usericon-slot-text');
const iconMessage = document.getElementById('usericon-message');
const iconList = document.getElementById('usericon-list');
const CROP_VIEW = 240;
const CROP_OUT = 112;
let crop = null;
let iconPick = null;

function drawCrop() {
  if (!crop) return;
  const ctx = iconCanvas.getContext('2d');
  ctx.clearRect(0, 0, CROP_VIEW, CROP_VIEW);
  ctx.drawImage(crop.image, crop.ox, crop.oy, crop.image.naturalWidth * crop.scale, crop.image.naturalHeight * crop.scale);
}

function clampCrop() {
  const width = crop.image.naturalWidth * crop.scale;
  const height = crop.image.naturalHeight * crop.scale;
  crop.ox = Math.min(0, Math.max(CROP_VIEW - width, crop.ox));
  crop.oy = Math.min(0, Math.max(CROP_VIEW - height, crop.oy));
}

function setCropZoom(factor) {
  const center = { x: (CROP_VIEW / 2 - crop.ox) / crop.scale, y: (CROP_VIEW / 2 - crop.oy) / crop.scale };
  crop.scale = crop.cover * factor;
  crop.ox = CROP_VIEW / 2 - center.x * crop.scale;
  crop.oy = CROP_VIEW / 2 - center.y * crop.scale;
  clampCrop();
  drawCrop();
}

async function onIconFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  iconMessage.textContent = '';
  try {
    const image = await loadImageFile(file);
    const cover = CROP_VIEW / Math.min(image.naturalWidth, image.naturalHeight);
    crop = { image, cover, scale: cover, ox: 0, oy: 0 };
    iconZoom.value = '100';
    setCropZoom(1);
    iconEditor.hidden = false;
    iconPick = iconPick || { page: 0, row: 4, col: 0 };
    renderSlotPicker();
  } catch {
    iconMessage.textContent = '그림을 읽을 수 없습니다. PNG, JPEG, WebP 파일을 골라 주세요.';
  }
}

function closeIconEditor() {
  crop = null;
  iconEditor.hidden = true;
  document.getElementById('usericon-file').value = '';
  iconLabel.value = '';
}

function renderSlotPicker() {
  if (!iconSlots) return;
  const page = Number(iconPage.value);
  if (iconPick && iconPick.page !== page) iconPick = null;
  const manifest = new Map((HOME_MANIFEST.pages[page] || []).map((cell) => [`${cell.row}:${cell.col}`, cell]));
  const placed = new Map(userIcons.filter((icon) => icon.page === page).map((icon) => [`${icon.row}:${icon.col}`, icon]));
  const buttons = [];
  for (let row = 0; row < HOME_LAYOUT.rows; row += 1) {
    for (let col = 0; col < HOME_LAYOUT.cols; col += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      const key = `${row}:${col}`;
      const cell = manifest.get(key);
      const mine = placed.get(key);
      const zero = isZeroSlot(page, row, col);
      button.setAttribute('aria-label', `${row + 1}행 ${col + 1}열${zero ? '' : ' (숫자 칸)'}`);
      if (cell?.action) {
        button.disabled = true;
        button.setAttribute('aria-label', `${row + 1}행 ${col + 1}열 (노트 앱 자리)`);
        const img = document.createElement('img');
        img.alt = '';
        img.src = iconSrc(cell.file);
        button.append(img);
      } else if (!zero) {
        button.disabled = true;
        button.textContent = String(homeCellDigit(row, col));
      } else {
        const img = document.createElement('img');
        img.alt = '';
        if (mine) img.src = mine.dataUrl;
        else if (cell) img.src = iconSrc(cell.file);
        if (mine || cell) button.append(img); else button.classList.add('is-zero-empty');
        if (iconPick && iconPick.row === row && iconPick.col === col) button.classList.add('is-picked');
        button.addEventListener('click', () => { iconPick = { page, row, col }; renderSlotPicker(); });
      }
      buttons.push(button);
    }
  }
  iconSlots.replaceChildren(...buttons);
  iconSlotText.textContent = iconPick ? `고른 칸: ${iconPick.row + 1}행 ${iconPick.col + 1}열` : '넣을 칸을 고르세요. 숫자 칸은 고를 수 없습니다.';
}

function renderUserIcons() {
  userIcons = loadUserIcons(localStorage, reservedCells());
  if (iconList) {
    iconList.replaceChildren();
    userIcons.forEach((icon) => {
      const row = document.createElement('article');
      row.className = 'preset usericon-item';
      const img = document.createElement('img');
      img.src = icon.dataUrl;
      img.alt = '';
      const text = document.createElement('span');
      text.textContent = `${icon.label} · ${['첫째', '둘째', '셋째'][icon.page]} 홈 ${icon.row + 1}행 ${icon.col + 1}열`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = '빼기';
      remove.addEventListener('click', () => {
        const result = removeUserIcon(userIcons, icon.id, reservedCells());
        if (!result.ok) { iconMessage.textContent = result.error; return; }
        const saved = saveUserIcons(localStorage, result.icons);
        iconMessage.textContent = saved.ok ? '뺐습니다.' : saved.error;
        renderUserIcons();
      });
      row.append(img, text, remove);
      iconList.append(row);
    });
  }
  renderSlotPicker();
  pvRefreshIcons();
}

function onIconAdd() {
  if (!crop) return;
  if (!iconPick) { iconMessage.textContent = '넣을 칸을 먼저 고르세요.'; return; }
  const out = document.createElement('canvas');
  out.width = CROP_OUT;
  out.height = CROP_OUT;
  const ratio = CROP_OUT / CROP_VIEW;
  out.getContext('2d').drawImage(crop.image, crop.ox * ratio, crop.oy * ratio, crop.image.naturalWidth * crop.scale * ratio, crop.image.naturalHeight * crop.scale * ratio);
  let dataUrl = out.toDataURL('image/png');
  if (dataUrl.length > 80000) dataUrl = out.toDataURL('image/jpeg', 0.8);
  const result = placeUserIcon(userIcons, { ...iconPick, label: iconLabel.value, dataUrl }, { reserved: reservedCells() });
  if (!result.ok) { iconMessage.textContent = result.error; return; }
  const saved = saveUserIcons(localStorage, result.icons);
  if (!saved.ok) { iconMessage.textContent = saved.error; return; }
  iconMessage.textContent = `「${result.icon.label}」를 넣었습니다.`;
  closeIconEditor();
  renderUserIcons();
}

function bindIconCropper() {
  let drag = null;
  iconCanvas.addEventListener('pointerdown', (event) => {
    if (!crop) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: crop.ox, oy: crop.oy };
    iconCanvas.setPointerCapture?.(event.pointerId);
  });
  iconCanvas.addEventListener('pointermove', (event) => {
    if (!drag || !crop || event.pointerId !== drag.id) return;
    const scale = CROP_VIEW / iconCanvas.getBoundingClientRect().width;
    crop.ox = drag.ox + (event.clientX - drag.x) * scale;
    crop.oy = drag.oy + (event.clientY - drag.y) * scale;
    clampCrop();
    drawCrop();
  });
  const end = (event) => { if (drag && event.pointerId === drag.id) drag = null; };
  iconCanvas.addEventListener('pointerup', end);
  iconCanvas.addEventListener('pointercancel', end);
  iconZoom.addEventListener('input', () => { if (crop) setCropZoom(Number(iconZoom.value) / 100); });
}

// Wallpaper photo: pick, position (cover, drag and zoom), shrink, then keep it on this device only.
const wpEditor = document.getElementById('wallpaper-editor');
const wpCanvas = document.getElementById('wallpaper-canvas');
const wpZoom = document.getElementById('wallpaper-zoom');
const WP_VIEW = { width: 200, height: 433 };
const WP_OUT = { width: 780, height: 1688 };
let wp = null;

function drawWallpaperCrop(canvas = wpCanvas, ratio = 1) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(wp.image, wp.ox * ratio, wp.oy * ratio, wp.image.naturalWidth * wp.scale * ratio, wp.image.naturalHeight * wp.scale * ratio);
}

function clampWallpaperCrop() {
  wp.ox = Math.min(0, Math.max(WP_VIEW.width - wp.image.naturalWidth * wp.scale, wp.ox));
  wp.oy = Math.min(0, Math.max(WP_VIEW.height - wp.image.naturalHeight * wp.scale, wp.oy));
}

function setWallpaperZoom(factor) {
  const center = { x: (WP_VIEW.width / 2 - wp.ox) / wp.scale, y: (WP_VIEW.height / 2 - wp.oy) / wp.scale };
  wp.scale = wp.cover * factor;
  wp.ox = WP_VIEW.width / 2 - center.x * wp.scale;
  wp.oy = WP_VIEW.height / 2 - center.y * wp.scale;
  clampWallpaperCrop();
  drawWallpaperCrop();
}

async function onWallpaperFile(event) {
  const file = event.target.files?.[0];
  const message = document.getElementById('home-message');
  if (!file) return;
  message.textContent = '';
  try {
    const image = await loadImageFile(file);
    const cover = Math.max(WP_VIEW.width / image.naturalWidth, WP_VIEW.height / image.naturalHeight);
    wp = { image, cover, scale: cover, ox: 0, oy: 0 };
    wpZoom.value = '100';
    setWallpaperZoom(1);
    wpEditor.hidden = false;
  } catch {
    message.textContent = '그림을 읽을 수 없습니다. PNG, JPEG, WebP 파일을 골라 주세요.';
  }
}

function closeWallpaperEditor() {
  wp = null;
  wpEditor.hidden = true;
  document.getElementById('wallpaper-file').value = '';
}

async function onWallpaperApply() {
  const message = document.getElementById('home-message');
  if (!wp) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = WP_OUT.width;
    canvas.height = WP_OUT.height;
    drawWallpaperCrop(canvas, WP_OUT.width / WP_VIEW.width);
    const blob = await canvasBlob(canvas, 'image/jpeg', 0.82);
    if (!blob) throw new Error('blob');
    const previous = normalizeOptions(store.options);
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const key = `w_${id}`;
    await writeWallpaper(key, blob);
    if (!persist({ ...store, options: controlOptions({ wallpaper: 'photo', wallpaperId: id }) })) {
      // The settings still point at the old photo. Drop the unused new one.
      try { await clearWallpaper(key); } catch { /* Nothing more to undo. */ }
      throw new Error('save');
    }
    if (previous.wallpaper === 'photo') { try { await clearWallpaper(wallpaperKey(previous)); } catch { /* A stray old photo is harmless. */ } }
    message.textContent = '';
    closeWallpaperEditor();
    renderWallpaperState();
  } catch {
    message.textContent = '배경화면을 저장하지 못했습니다. 지금 쓰던 배경은 그대로입니다.';
  }
}

function bindWallpaperCropper() {
  let drag = null;
  wpCanvas.addEventListener('pointerdown', (event) => {
    if (!wp) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: wp.ox, oy: wp.oy };
    wpCanvas.setPointerCapture?.(event.pointerId);
  });
  wpCanvas.addEventListener('pointermove', (event) => {
    if (!drag || !wp || event.pointerId !== drag.id) return;
    const scale = WP_VIEW.width / wpCanvas.getBoundingClientRect().width;
    wp.ox = drag.ox + (event.clientX - drag.x) * scale;
    wp.oy = drag.oy + (event.clientY - drag.y) * scale;
    clampWallpaperCrop();
    drawWallpaperCrop();
  });
  const end = (event) => { if (drag && event.pointerId === drag.id) drag = null; };
  wpCanvas.addEventListener('pointerup', end);
  wpCanvas.addEventListener('pointercancel', end);
  wpZoom.addEventListener('input', () => { if (wp) setWallpaperZoom(Number(wpZoom.value) / 100); });
}

async function onWallpaperReset() {
  const message = document.getElementById('home-message');
  const previous = normalizeOptions(store.options);
  if (!persist({ ...store, options: controlOptions({ wallpaper: 'default', wallpaperId: '' }) })) {
    message.textContent = '설정을 저장하지 못했습니다. 지금 쓰던 배경은 그대로입니다.';
    return;
  }
  if (previous.wallpaper === 'photo') { try { await clearWallpaper(wallpaperKey(previous)); } catch { /* A stray photo is harmless. */ } }
  renderWallpaperState();
}

function renderWallpaperState() {
  const node = document.getElementById('wallpaper-state');
  if (node) node.textContent = normalizeOptions(store.options).wallpaper === 'photo' ? '지금 내 배경 사진을 쓰고 있습니다.' : '지금 기본 배경을 쓰고 있습니다.';
}

function renderMemoryTable() {
  const table = document.getElementById('memory-table');
  if (!table) return;
  const rows = [];
  [0, 1].forEach((page) => {
    HOME_MANIFEST.pages[page].filter((cell) => cell.digit > 0).sort((a, b) => a.digit - b.digit).forEach((cell) => {
      const row = document.createElement('li');
      const digit = document.createElement('span');
      digit.className = 'digit';
      digit.textContent = String(cell.digit);
      const img = document.createElement('img');
      img.src = iconSrc(cell.file);
      img.alt = '';
      const text = document.createElement('span');
      text.textContent = `${page === 0 ? '첫째 홈 (십의 자리)' : '둘째 홈 (일의 자리)'} · ${cell.name}: ${cell.hint || ''}`;
      row.append(digit, img, text);
      rows.push(row);
    });
  });
  table.replaceChildren(...rows);
}

function renderExtras() {
  renderDummies();
  renderSets();
  renderWallpaperState();
  renderEditorPreview();
}

// Isolated fake-home entry. Legacy performance rendering stays untouched.
function setNotesEntryMessage(text) {
  notesEntryMessage.textContent = text || '';
}

function rehearsalSurfaceOpen() {
  return fakeHomeSession != null;
}

function leaveRehearsalSurface() {
  if (fakeHomeSession) closeFakeHome();
}

// Cells that carry an action (the notes app) can never be replaced by an own icon.
function reservedCells() {
  return HOME_MANIFEST.pages.flatMap((cells, page) => cells.filter((cell) => cell.action).map((cell) => ({ page, row: cell.row, col: cell.col })));
}

// Home screen cells come from home-manifest.js; the performer's own icons (device storage) win.
function homeDescriptors(page) {
  const cells = new Map();
  (HOME_MANIFEST.pages[page] || []).forEach((cell) => {
    cells.set(`${cell.row}:${cell.col}`, {
      row: cell.row, col: cell.col, src: iconSrc(cell.file),
      name: cell.name, kind: cell.kind || 'app', action: cell.action || '', mask: cell.mask === true
    });
  });
  userIcons.filter((icon) => icon.page === page).forEach((icon) => {
    cells.set(`${icon.row}:${icon.col}`, {
      row: icon.row, col: icon.col, src: icon.dataUrl, name: icon.label, kind: 'app', action: '', user: true
    });
  });
  return [...cells.values()];
}

function createAppIcon(cell) {
  const item = document.createElement('div');
  item.className = 'app-icon';
  item.style.gridRow = String(cell.row + 1);
  item.style.gridColumn = String(cell.col + 1);
  if (cell.action) item.dataset.action = cell.action;
  if (cell.kind === 'folder') item.dataset.kind = 'folder';
  const glyph = document.createElement('img');
  glyph.className = cell.user || cell.mask ? 'app-glyph is-user' : 'app-glyph';
  glyph.src = cell.src;
  glyph.alt = '';
  glyph.draggable = false;
  glyph.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'app-name';
  name.textContent = cell.name;
  item.append(glyph, name);
  return item;
}

function ensureFakeHomeIcons(root = fakeHomeEl) {
  root.querySelectorAll('[data-home-grid]').forEach((grid) => {
    const pageIndex = Number(grid.dataset.homeGrid);
    grid.replaceChildren(...homeDescriptors(pageIndex).map(createAppIcon));
  });
  const dock = root === fakeHomeEl ? phoneDock : root.querySelector('.phone-dock');
  if (dock) {
    dock.replaceChildren(...HOME_MANIFEST.dock.map((entry) => {
      const app = document.createElement('span');
      app.className = 'dock-app';
      const glyph = document.createElement('img');
      glyph.className = 'dock-glyph';
      glyph.src = iconSrc(entry.file);
      glyph.alt = '';
      glyph.draggable = false;
      app.append(glyph);
      return app;
    }));
  }
  if (root === fakeHomeEl) fakeHomeEl.dataset.ready = 'true';
}

function applyHomeStyle(options, root = fakeHomeEl) {
  root.style.setProperty('--icon-scale', String(options.iconSize / 100));
  root.style.setProperty('--label-size', `${options.labelSize}px`);
  root.style.setProperty('--bottom-gap', `${options.bottomGap}px`);
}

// ----- live preview of the home and notes screens (settings only) -----
// A scaled copy of the real screens' markup, filled by the same icon code and styled by the same CSS and options.
// It is inert and holds no handlers, never reads or writes the performance session, and its ids are removed.
const PV_NOTE = { name: '샘플 목록', choice: 3, items: ['아침 산책하기', '커피 한 잔', '책 열 쪽 읽기', '점심 약속', '장보기', '저녁 요리', '일기 쓰기', '운동 30분', '빨래 널기', '내일 준비'] };
const pvHomes = [];
const pvNotes = [];
let pvTick = 0;
let pvWallpaperUrl = null;
let pvWallpaperKey = null;
let pvWallpaperToken = 0;

function pvStage(host, markup, kind) {
  const frame = document.createElement('div');
  frame.className = 'fake-home-frame';
  const clone = markup.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  clone.querySelectorAll('[tabindex]').forEach((node) => node.removeAttribute('tabindex'));
  clone.querySelectorAll('button').forEach((node) => { node.tabIndex = -1; });
  clone.querySelectorAll('.digit-guide, .entry-readout').forEach((node) => node.remove());
  clone.removeAttribute('aria-hidden');
  frame.append(clone);
  const home = document.createElement('div');
  home.className = 'pv-home';
  home.dataset.pv = kind;
  home.append(frame);
  const scale = document.createElement('div');
  scale.className = 'pv-scale';
  scale.append(home);
  // A shadow root keeps the copy out of every document query and id lookup, so nothing in the app can find or drive it.
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = document.querySelector('link[rel="stylesheet"][href*="style.css"]')?.href || './style.css';
  root.replaceChildren(sheet, scale);
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  return home;
}

function initPreviews() {
  document.querySelectorAll('.pv-stage').forEach((host) => {
    if (host.dataset.pvKind === 'home' && fakePhone) {
      const home = pvStage(host, fakePhone, 'home');
      home.querySelector('.phone-shell').dataset.wallpaper = 'default';
      const wallpaper = home.querySelector('.wallpaper');
      if (wallpaper) wallpaper.style.backgroundImage = '';
      const time = home.querySelector('.status-time');
      if (time) time.textContent = '12:40';
      pvHomes.push(home);
    } else if (host.dataset.pvKind === 'notes' && fakeNotesEl) {
      const home = pvStage(host, fakeNotesEl, 'notes');
      const notes = home.querySelector('.notes-landing');
      notes.hidden = false;
      notes.classList.add('is-detail');
      const back = notes.querySelector('.notes-back');
      if (back) back.hidden = false;
      const title = notes.querySelector('h2');
      if (title) title.textContent = PV_NOTE.name;
      pvNotes.push(home);
    }
  });
  pvRefreshIcons();
  renderPreviews();
}

function pvRefreshIcons() {
  pvHomes.forEach((home) => ensureFakeHomeIcons(home));
}

function renderPreviews() {
  pvTick = 0;
  if (!pvHomes.length && !pvNotes.length) return;
  const options = controlOptions();
  pvHomes.forEach((home) => applyHomeStyle(options, home));
  pvNotes.forEach((home) => {
    const body = home.querySelector('.notes-landing-body');
    if (body) body.replaceChildren(buildNoteScroller(PV_NOTE.items, PV_NOTE.choice, options, { zoomable: false }));
  });
  pvApplyWallpaper(options);
}

function schedulePreviews() {
  if (pvTick || (!pvHomes.length && !pvNotes.length)) return;
  pvTick = requestAnimationFrame(renderPreviews);
}

async function pvApplyWallpaper(options) {
  const key = options.wallpaper === 'photo' ? wallpaperKey(options) : null;
  if (key === pvWallpaperKey) return;
  pvWallpaperKey = key;
  const token = ++pvWallpaperToken;
  let url = null;
  if (key) {
    try {
      const blob = await readWallpaper(key);
      if (blob) url = URL.createObjectURL(blob);
    } catch { /* A missing or blocked photo shows the default wallpaper. */ }
  }
  if (token !== pvWallpaperToken) { if (url) URL.revokeObjectURL(url); return; }
  if (pvWallpaperUrl) URL.revokeObjectURL(pvWallpaperUrl);
  pvWallpaperUrl = url;
  pvHomes.forEach((home) => {
    const wallpaper = home.querySelector('.wallpaper');
    if (wallpaper) wallpaper.style.backgroundImage = url ? `url("${url}")` : '';
    const shell = home.querySelector('.phone-shell');
    if (shell) shell.dataset.wallpaper = url ? 'photo' : 'default';
  });
}

// The wallpaper photo lives in IndexedDB on this device only and is never part of the app files.
const MEDIA_DB = 'magic-choice.v1.media';
function mediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('wallpaper');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function mediaRun(mode, run) {
  const db = await mediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wallpaper', mode);
    const request = run(tx.objectStore('wallpaper'));
    tx.oncomplete = () => { db.close(); resolve(request?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
// Each photo has its own key. A new photo is written first, the saved settings point at it only after
// that worked, and the old photo is dropped last, so a failure at any step keeps the old photo.
const wallpaperKey = (options) => (options.wallpaperId ? `w_${options.wallpaperId}` : 'current');
const readWallpaper = (key) => mediaRun('readonly', (store) => store.get(key));
const writeWallpaper = (key, blob) => mediaRun('readwrite', (store) => store.put(blob, key));
const clearWallpaper = (key) => mediaRun('readwrite', (store) => store.delete(key));

function releaseWallpaper() {
  if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
  wallpaperUrl = null;
  if (fakeWallpaper) fakeWallpaper.style.backgroundImage = '';
  fakePhone?.setAttribute('data-wallpaper', 'default');
}

async function applyWallpaper(options) {
  releaseWallpaper();
  if (options.wallpaper !== 'photo') return;
  try {
    const blob = await readWallpaper(wallpaperKey(options));
    if (!blob || !fakeHomeSession) return;
    wallpaperUrl = URL.createObjectURL(blob);
    fakeWallpaper.style.backgroundImage = `url("${wallpaperUrl}")`;
    fakePhone.setAttribute('data-wallpaper', 'photo');
  } catch { /* A missing or blocked photo falls back to the default wallpaper. */ }
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    image.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isInputGuideEnabled() {
  if (inputGuideInput) return inputGuideInput.checked === true;
  try {
    return localStorage.getItem(INPUT_GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

function loadInputGuidePreference() {
  if (!inputGuideInput) return;
  let enabled = false;
  try {
    enabled = localStorage.getItem(INPUT_GUIDE_KEY) === '1';
  } catch {
    enabled = false;
  }
  inputGuideInput.checked = enabled;
}

function persistInputGuidePreference() {
  if (!inputGuideInput) return;
  try {
    localStorage.setItem(INPUT_GUIDE_KEY, inputGuideInput.checked ? '1' : '0');
  } catch {
    // Preference only. The list store is left untouched.
  }
}

function staticGuideDigit(row, col) {
  return homeCellDigit(row, col);
}

function removeInputGuideNodes() {
  fakeHomeEl?.querySelectorAll('.digit-guide').forEach((node) => node.remove());
}

function clearInputGuideTimers() {
  inputGuideToken += 1;
  if (inputGuideTimers.hold) clearTimeout(inputGuideTimers.hold);
  if (inputGuideTimers.fade) clearTimeout(inputGuideTimers.fade);
  inputGuideTimers = { hold: 0, fade: 0 };
}

function dismissInputGuide() {
  inputGuidePage = null;
  clearInputGuideTimers();
  removeInputGuideNodes();
}

// Static keypad map only. Never render the entered tens, ones, or chosen value.
function showInputGuide(page) {
  if (!isInputGuideEnabled() || (page !== 0 && page !== 1)) {
    dismissInputGuide();
    return;
  }
  if (inputGuidePage === page && fakeHomeEl?.querySelector('.digit-guide')) return;
  dismissInputGuide();
  const grid = fakeHomeEl?.querySelector(`[data-home-grid="${page}"]`);
  if (!grid) return;
  const overlay = document.createElement('div');
  overlay.className = 'digit-guide';
  overlay.setAttribute('aria-hidden', 'true');
  for (let row = 0; row < HOME_LAYOUT.rows; row += 1) {
    for (let col = 0; col < HOME_LAYOUT.cols; col += 1) {
      const cell = document.createElement('span');
      cell.className = 'digit-guide-cell';
      cell.textContent = String(staticGuideDigit(row, col));
      overlay.append(cell);
    }
  }
  grid.append(overlay);
  inputGuidePage = page;
  const token = inputGuideToken;
  inputGuideTimers.hold = setTimeout(() => {
    if (token !== inputGuideToken) return;
    overlay.classList.add('is-fading');
    inputGuideTimers.fade = setTimeout(() => {
      if (token !== inputGuideToken) return;
      overlay.remove();
      if (inputGuidePage === page) inputGuidePage = null;
    }, INPUT_GUIDE_FADE_MS);
  }, INPUT_GUIDE_HOLD_MS);
}

function syncFakeHomeSurface() {
  if (!fakeHomeSession) return;
  const page = fakeHomeSession.page;
  const onNotes = page === 'notes';
  if (onNotes) dismissInputGuide();
  else showInputGuide(page);
  fakeHomeEl.dataset.page = onNotes ? 'notes' : String(page);
  fakeHomeEl.classList.toggle('is-notes', onNotes);
  fakeNotesEl.hidden = !onNotes;
  const phone = document.getElementById('fake-phone');
  if (phone) phone.setAttribute('aria-hidden', onNotes ? 'true' : 'false');
  fakeHomeEl.querySelectorAll('.home-page').forEach((homePage) => {
    const current = !onNotes && homePage.dataset.homePage === String(page);
    homePage.setAttribute('aria-hidden', current ? 'false' : 'true');
  });
  fakeHomeEl.querySelectorAll('.home-dots > span').forEach((dot, index) => {
    dot.classList.toggle('is-current', !onNotes && index === page);
  });
  if (!onNotes) fakeHomeSession.notesMounted = false;
  if (onNotes && !fakeHomeSession.notesMounted) {
    fakeHomeSession.notesMounted = true;
    renderFakeNotesIndex();
  }
  if (onNotes && !fakeHomeSession.openNoteId) fakeNotesTitle?.focus();
  renderEntryReadout();
}

function vibrateAccepted() {
  if (fakeHomeSession?.options?.vibrate !== true) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(VIBRATE_MS);
  } catch { /* Vibration is optional and never blocks an entry. */ }
}

function vibrateCue() {
  if (fakeHomeSession?.options?.vibrate !== true) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([VIBRATE_MS, 70, VIBRATE_MS]);
  } catch { /* Vibration is optional. */ }
}

// Practice shows the entered digits all the time. Performance shows them only while
// the secret long press is held, and the text is removed from the page otherwise.
function renderEntryReadout() {
  if (!entryReadout) return;
  const current = fakeHomeSession;
  const practice = current?.options?.display === 'practice' && !readoutCleared;
  if (!current || !(practice || peek?.visible === true)) {
    entryReadout.hidden = true;
    entryReadout.textContent = '';
    delete entryReadout.dataset.kind;
    return;
  }
  const digit = (value) => (value == null ? '○' : String(value));
  entryReadout.textContent = `${digit(current.entry.tens)} ${digit(current.entry.ones)}`
    + (current.outOfRange === true && !practice ? '\n범위 밖' : '');
  entryReadout.dataset.kind = practice ? 'practice' : 'peek';
  entryReadout.hidden = false;
}

function endPeek() {
  if (peek) { clearTimeout(peek.timer); clearTimeout(peek.cap); }
  peek = null;
  renderEntryReadout();
}

function beginPeek(event) {
  if (fakeHomeSession?.options?.display === 'practice') return false;
  const target = event.target;
  const onDots = fakeHomeSession.page !== 'notes' && fakeHomeDots?.contains(target);
  const onTitle = fakeHomeSession.page === 'notes' && fakeNotesTitle?.contains(target);
  if (!onDots && !onTitle) return false;
  const state = { id: event.pointerId, visible: false, timer: 0, cap: 0, x: event.clientX, y: event.clientY };
  state.timer = setTimeout(() => {
    if (peek !== state) return;
    state.visible = true;
    renderEntryReadout();
    // Even a finger that stays down hides the digits again after a short while.
    state.cap = setTimeout(() => { if (peek === state) endPeek(); }, PEEK_MAX_MS);
  }, PEEK_HOLD_MS);
  peek = state;
  return true;
}

// Blur, hiding, resize and touch cancel must never leave a digit on screen or a half-finished touch.
function resetTransientInput() {
  fakeHomeGesture = null;
  cornerDown = null;
  resetTaps = null;
  armed = null;
  clickGuardUntil = 0;
  // Practice digits come back only with the next accepted digit.
  readoutCleared = true;
  endPeek();
}

function activeFakeHomeGrid() {
  if (!fakeHomeSession || fakeHomeSession.page === 'notes') return null;
  return fakeHomeEl.querySelector(`[data-home-grid="${fakeHomeSession.page}"]`);
}

function noteStamp(updatedAt) {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return '';
  try {
    return noteDateFormat.format(updatedAt);
  } catch {
    return '';
  }
}

function clearFakeNotesView() {
  removeRangeCue();
  fakeNotesBody?.replaceChildren();
  fakeNotesEl?.classList.remove('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = true;
  setNotesTitle('메모');
  if (fakeNotesSearch) fakeNotesSearch.hidden = false;
  if (fakeNotesFolder) fakeNotesFolder.hidden = false;
}

function renderFakeNotesIndex(focusId) {
  if (!fakeHomeSession || !fakeNotesBody) return;
  fakeHomeSession.openNoteId = null;
  removeRangeCue();
  fakeNotesEl.classList.remove('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = true;
  setNotesTitle('메모');
  if (fakeNotesSearch) fakeNotesSearch.hidden = false;
  if (fakeNotesFolder) fakeNotesFolder.hidden = false;
  fakeNotesBody.replaceChildren();
  const index = document.createElement('div');
  index.className = 'notes-index';
  fakeHomeSession.notes.forEach((note) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'notes-row';
    button.dataset.noteId = String(note.id);
    const copy = document.createElement('span');
    copy.className = 'notes-row-copy';
    const title = document.createElement('span');
    title.className = 'notes-row-title';
    title.textContent = note.name;
    copy.append(title);
    const stamp = noteStamp(note.updatedAt);
    if (stamp) {
      const meta = document.createElement('span');
      meta.className = 'notes-row-meta';
      meta.textContent = stamp;
      copy.append(meta);
    }
    button.append(copy);
    button.addEventListener('click', () => openFakeNote(note.id));
    index.append(button);
  });
  fakeNotesBody.append(index);
  if (focusId != null) {
    const target = [...index.querySelectorAll('.notes-row')].find((button) => button.dataset.noteId === String(focusId));
    if (target) {
      target.focus();
      return;
    }
  }
  fakeNotesTitle?.focus();
}

// The shared label module keeps the notes title at its native label, so the label itself is what changes.
function setNotesTitle(text) {
  if (!fakeNotesTitle) return;
  fakeNotesTitle.dataset.magicNativeLabel = text;
  fakeNotesTitle.textContent = text;
}

function removeRangeCue() {
  fakeNotesEl?.querySelectorAll('.notes-range-cue').forEach((node) => node.remove());
}

function emphasisRow(row, options) {
  if (options.noteEmphasis === 'none') return;
  row.classList.add('is-emphasis');
  row.dataset.emphasis = options.noteEmphasis;
}

// Pinch inside an open note scales its text. Two fingers moving down together stay the
// settings gesture, so a pinch only counts once the distance between the fingers changes.
function attachPinchZoom(scroller, lines) {
  let pinch = null;
  const distance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  scroller.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
      pinch = { start: distance(event.touches), zoom: Number(lines.dataset.zoom || 1), active: false };
    } else pinch = null;
  }, { passive: true });
  scroller.addEventListener('touchmove', (event) => {
    if (!pinch || event.touches.length !== 2) return;
    const now = distance(event.touches);
    if (!pinch.active && Math.abs(now - pinch.start) < 14) return;
    pinch.active = true;
    armed = null;
    const zoom = Math.min(PINCH_MAX_ZOOM, Math.max(PINCH_MIN_ZOOM, pinch.zoom * (now / pinch.start)));
    lines.dataset.zoom = String(zoom);
    lines.style.setProperty('--note-zoom', String(zoom));
    event.preventDefault();
  }, { passive: false });
  scroller.addEventListener('touchend', () => { pinch = null; }, { passive: true });
}

// The numbered lines of an open list note, with the picked line emphasised; the settings preview draws the same thing.
function buildNoteScroller(items, choice, options, { zoomable = true } = {}) {
  const scroller = document.createElement('div');
  scroller.className = 'notes-detail-scroll';
  const lines = document.createElement('ol');
  lines.className = 'notes-lines';
  lines.style.setProperty('--note-size', `${options.noteFont}px`);
  lines.style.setProperty('--note-leading', String(LINE_HEIGHTS[options.noteLine] || LINE_HEIGHTS.normal));
  items.forEach((item, index) => {
    const row = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'notes-line-no';
    number.textContent = String(index + 1);
    const text = document.createElement('span');
    text.className = 'notes-line-text';
    text.textContent = item;
    row.append(number, text);
    if (index + 1 === choice) emphasisRow(row, options);
    lines.append(row);
  });
  scroller.append(lines);
  if (zoomable) attachPinchZoom(scroller, lines);
  return scroller;
}

function renderFakeNoteDetail(note, detail) {
  if (!fakeNotesBody) return;
  const options = fakeHomeSession?.options || normalizeOptions(store.options);
  fakeNotesEl.classList.add('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = false;
  setNotesTitle(note.name);
  removeRangeCue();
  if (detail?.inRange === false && fakeNotesTitle?.parentElement) {
    // The shared label module owns the title text, so the quiet cue lives beside it in the header bar.
    const cue = document.createElement('i');
    cue.className = 'notes-range-cue';
    cue.setAttribute('aria-hidden', 'true');
    fakeNotesTitle.parentElement.append(cue);
  }
  if (fakeNotesSearch) fakeNotesSearch.hidden = true;
  if (fakeNotesFolder) fakeNotesFolder.hidden = true;
  fakeNotesBody.replaceChildren();
  let scroller;
  if (note.kind === 'dummy') {
    scroller = document.createElement('div');
    scroller.className = 'notes-detail-scroll';
    const body = document.createElement('p');
    body.className = 'notes-dummy-body';
    body.textContent = note.body;
    body.style.setProperty('--note-size', `${options.noteFont}px`);
    body.style.setProperty('--note-leading', String(LINE_HEIGHTS[options.noteLine] || LINE_HEIGHTS.normal));
    scroller.append(body);
    attachPinchZoom(scroller, body);
  } else {
    scroller = buildNoteScroller(detail.items, detail.choice, options);
  }
  fakeNotesBody.append(scroller);
  fakeNotesBack?.focus();
}

function openFakeNote(noteId) {
  const current = fakeHomeSession;
  if (!current || current.page !== 'notes' || current.entry?.locked !== true) return;
  const note = current.notes.find((entry) => entry.id === noteId);
  if (!note) return;
  if (note.kind === 'dummy') {
    current.openNoteId = noteId;
    renderFakeNoteDetail(note, null);
    return;
  }
  const detail = noteLines(note, current.entry.value);
  if (!detail.ok || !Array.isArray(detail.items)) return;
  current.openNoteId = noteId;
  current.numberLocked = true;
  current.outOfRange = detail.inRange === false;
  renderFakeNoteDetail(note, detail);
  if (detail.inRange === false) vibrateCue();
}

function backToFakeNotesIndex() {
  if (!fakeHomeSession || fakeHomeSession.page !== 'notes') return;
  const focusId = fakeHomeSession.openNoteId;
  renderFakeNotesIndex(focusId);
}

function openFakeHome(notes) {
  userIcons = loadUserIcons(localStorage, reservedCells());
  ensureFakeHomeIcons();
  fakeHomeGesture = null;
  resetTaps = null;
  clearFakeNotesView();
  readoutCleared = false;
  fakeHomeSession = {
    entry: createFakeHomeEntry(),
    page: 0,
    notes,
    openNoteId: null,
    notesMounted: false,
    numberLocked: false,
    outOfRange: false,
    options: normalizeOptions(store.options)
  };
  applyHomeStyle(fakeHomeSession.options);
  fakeHomeEl.classList.remove('is-notes');
  fakeNotesEl.hidden = true;
  updateStatusTime();
  clearInterval(statusClock);
  statusClock = setInterval(updateStatusTime, 20000);
  syncFakeHomeSurface();
  settingsEl.hidden = true;
  fakeHomeEl.hidden = false;
  document.title = '메모';
  document.body.dataset.view = 'fake-home';
  applyWallpaper(fakeHomeSession.options);
  fakeHomeEl.focus();
  maybeShowGestureGuide();
}

function closeFakeHome() {
  hideGestureGuide();
  dismissInputGuide();
  if (!fakeHomeSession) return;
  fakeHomeSession = null;
  fakeHomeGesture = null;
  resetTaps = null;
  clearInterval(statusClock);
  statusClock = 0;
  releaseWallpaper();
  endPeek();
  clearFakeNotesView();
  fakeHomeEl.classList.remove('is-notes');
  fakeHomeEl.dataset.page = '0';
  fakeNotesEl.hidden = true;
  fakeHomeEl.hidden = true;
  const phone = document.getElementById('fake-phone');
  if (phone) phone.removeAttribute('aria-hidden');
  settingsEl.hidden = false;
  document.title = '너의 선택은?';
  document.body.dataset.view = 'settings';
  showView('home', { push: false });
  // The history entry under the performance must say what is visible now.
  try { history.replaceState(navState('home'), ''); } catch { /* History can be blocked. */ }
}

// Secret next-spectator reset: clears the number, closes any open note and goes back to the first home.
function resetForNextSpectator() {
  const current = fakeHomeSession;
  if (!current) return;
  current.entry = createFakeHomeEntry();
  current.page = 0;
  current.openNoteId = null;
  current.numberLocked = false;
  current.outOfRange = false;
  current.notesMounted = false;
  fakeHomeGesture = null;
  readoutCleared = false;
  endPeek();
  clearFakeNotesView();
  syncFakeHomeSurface();
  vibrateAccepted();
}

function openNotesApp() {
  const current = fakeHomeSession;
  if (!current || current.page !== 2 || current.entry?.locked !== true) return;
  current.page = 'notes';
  syncFakeHomeSurface();
}

function backToFakeHome() {
  const current = fakeHomeSession;
  if (!current || current.page !== 'notes') return;
  clearFakeNotesView();
  current.openNoteId = null;
  current.page = 2;
  syncFakeHomeSurface();
}

// Why the performance cannot start right now, or null. The same reason is shown under the start button and in the check panel.
function startBlockReason() {
  if (recoveryState) {
    return {
      recovery: true,
      text: `저장본에 읽을 수 없는 부분이 있어 공연을 시작할 수 없습니다. ${recoveryState.error || ''} 아래 '저장본 확인하기'에서 가능한 항목만 저장하거나 새 목록으로 시작할 수 있습니다. 저장된 원본은 아직 바꾸지 않았습니다.`.replace(/\s+/g, ' ')
    };
  }
  if (!selectNotes(store).forceCount) {
    return {
      recovery: false,
      text: `노트에 넣을 목록이 없어 공연을 시작할 수 없습니다. 기본 제공 목록을 '노트에 넣기'로 켜거나, 예언 항목이 있고 전체 항목이 ${NOTE_MIN_ITEMS}개에서 ${NOTE_MAX_ITEMS}개인 목록을 저장하세요. 공연 묶음을 쓰고 있다면 묶음에 목록을 넣어야 합니다.`
    };
  }
  return null;
}

// A blocking reason is always shown right under the button, with the way out when there is one.
function startMessageElement() {
  return (currentView === 'done' && document.getElementById('done-message')) || notesEntryMessage;
}

function setStartMessage(text) {
  if (currentView === 'done') document.getElementById('done-message').textContent = text || '';
  else setNotesEntryMessage(text);
}

function showStartProblem(problem, { scroll = true } = {}) {
  setStartMessage(problem.text);
  if (notesEntryAction) notesEntryAction.hidden = !problem.recovery;
  if (scroll) startMessageElement()?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

// Anything unexpected while opening the fake home leaves the settings screen usable and says what happened.
function abortStart(error) {
  try { clearInterval(statusClock); } catch { /* Nothing to stop. */ }
  fakeHomeSession = null;
  fakeHomeGesture = null;
  if (fakeHomeEl) fakeHomeEl.hidden = true;
  if (settingsEl) settingsEl.hidden = false;
  document.body.dataset.view = 'settings';
  document.title = '너의 선택은?';
  showStartProblem({ recovery: false, text: `공연 화면을 열지 못했습니다. (${error?.message || '알 수 없는 오류'}) 저장된 목록은 그대로입니다. 앱을 완전히 닫았다가 다시 열어 보세요.` });
}

function startNotesShow() {
  try {
    const problem = startBlockReason();
    if (problem) {
      showStartProblem(problem);
      return;
    }
    const snapped = selectNotes(store);
    if (notesEntryAction) notesEntryAction.hidden = true;
    if (snapped.truncated) {
      setStartMessage(`조건에 맞는 목록이 ${NOTE_LIST_LIMIT}개를 넘어, 앞 ${NOTE_LIST_LIMIT}개만 노트로 사용합니다. 저장본은 바꾸지 않았습니다.`);
    } else {
      setStartMessage('');
    }
    openFakeHome(snapped.notes);
  } catch (error) {
    abortStart(error);
  }
}

function finishFakeHomePointer(event, canceled) {
  if (!fakeHomeSession || !fakeHomeGesture || event.pointerId !== fakeHomeGesture.id) return;
  const gesture = fakeHomeGesture;
  fakeHomeGesture = null;
  const motion = {
    dx: event.clientX - gesture.startX,
    dy: event.clientY - gesture.startY,
    ms: event.timeStamp - gesture.startTime,
    canceled: canceled || gesture.canceled
  };
  const kind = classifyFakeHomeGesture(motion);
  const entry = fakeHomeSession.entry;
  let next = entry;
  if (kind === 'left') next = applyFakeHomeSwipe(entry, { digit: gesture.digit, ...motion });
  else if (kind === 'tap') next = applyFakeHomeTap(entry, { digit: gesture.digit, ...motion });
  else if (kind === 'right') next = applyFakeHomeUndo(entry, motion, { noteOpened: fakeHomeSession.numberLocked === true });
  if (next === entry) {
    // Once both digits are in, a tap on the notes app on the third home opens it.
    if (kind === 'tap' && entry.locked === true && fakeHomeSession.page === 2
      && gesture.target?.closest?.('[data-action="notes"]')) {
      clickGuardUntil = Date.now() + CLICK_GUARD_MS;
      openNotesApp();
    }
    return;
  }
  // A swipe or tap can still produce a click on whatever appears under the finger.
  clickGuardUntil = Date.now() + CLICK_GUARD_MS;
  readoutCleared = false;
  fakeHomeSession.entry = next;
  fakeHomeSession.page = next.locked ? 2 : (next.tens == null ? 0 : 1);
  if (kind !== 'right') vibrateAccepted();
  syncFakeHomeSurface();
}

function onFakeHomePointerDown(event) {
  // A new touch is genuine input, never the echo of the previous gesture.
  clickGuardUntil = 0;
  if (!fakeHomeSession || fakeHomeEl.hidden) return;
  if (inResetCorner(event)) {
    cornerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp };
    return;
  }
  if (peek) {
    endPeek();
    return;
  }
  if (fakeHomeGesture) {
    fakeHomeGesture.canceled = true;
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (beginPeek(event)) return;
  const grid = activeFakeHomeGrid();
  let digit = null;
  if (grid) {
    if (grid.contains(event.target)) {
      const rect = grid.getBoundingClientRect();
      digit = fakeHomeDigit(
        { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        event.clientX,
        event.clientY
      );
    } else if (fakePhone?.contains(event.target) && !fakeStatus?.contains(event.target) && !fakeHomeDots?.contains(event.target)) {
      // Wallpaper and dock count as 0, like the dummy icons. The page dots and status bar do not.
      digit = 0;
    } else return;
  } else if (fakeHomeSession.page !== 'notes' || fakeHomeSession.numberLocked || !fakeNotesEl.contains(event.target)) {
    // The notes list only listens for the undo swipe, and only until a note has been opened.
    return;
  }
  fakeHomeGesture = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startTime: event.timeStamp,
    digit,
    target: event.target,
    canceled: false
  };
}

// The reset zone is the top right corner, where the status bar sits. It never takes digits.
function inResetCorner(event) {
  const frame = fakeHomeEl.querySelector('.fake-home-frame');
  if (!frame) return false;
  const rect = frame.getBoundingClientRect();
  let height = 40;
  if (fakeHomeSession.page !== 'notes' && fakeStatus) {
    height = Math.min(height, Math.max(24, fakeStatus.getBoundingClientRect().bottom - rect.top));
  }
  return event.clientX >= rect.right - rect.width * 0.32 && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.top + height;
}

function finishCornerTap(event) {
  const down = cornerDown;
  if (!down || down.id !== event.pointerId) return false;
  cornerDown = null;
  const tap = Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 12 && event.timeStamp - down.t <= 400;
  if (!tap) {
    resetTaps = null;
    return true;
  }
  if (resetTaps && event.timeStamp - resetTaps.first <= RESET_TAP_WINDOW_MS) resetTaps.count += 1;
  else resetTaps = { first: event.timeStamp, count: 1 };
  if (resetTaps.count >= RESET_TAPS) {
    resetTaps = null;
    clickGuardUntil = Date.now() + CLICK_GUARD_MS;
    resetForNextSpectator();
  }
  return true;
}

function onFakeHomePointerMove(event) {
  if (!peek || event.pointerId !== peek.id) return;
  if (Math.hypot(event.clientX - peek.x, event.clientY - peek.y) > PEEK_MOVE_PX) endPeek();
}

function onFakeHomePointerUp(event) {
  if (finishCornerTap(event)) return;
  if (peek && event.pointerId === peek.id) endPeek();
  finishFakeHomePointer(event, false);
}

function onFakeHomePointerCancel(event) {
  if (cornerDown && cornerDown.id === event.pointerId) cornerDown = null;
  if (peek && event.pointerId === peek.id) endPeek();
  finishFakeHomePointer(event, true);
}

function rememberTouches(touches) {
  armed = new Map();
  for (const touch of touches) {
    armed.set(touch.identifier, { startY: touch.screenY, lastY: touch.screenY });
  }
}

function gestureMoves() {
  return [...armed.values()].map((record) => record.lastY - record.startY);
}

document.getElementById('start-notes-show').addEventListener('click', startNotesShow);
inputGuideInput?.addEventListener('change', () => { persistInputGuidePreference(); renderPrecheck(); });
for (const control of [optStartMode, optDisplay, optVibrate]) control?.addEventListener('change', saveOptionsFromControls);
precheckRefresh?.addEventListener('click', () => renderPrecheck());
fakeNotesBack?.addEventListener('click', backToFakeNotesIndex);
fakeNotesHome?.addEventListener('click', backToFakeHome);
form.addEventListener('submit', (event) => event.preventDefault());
itemsInput.addEventListener('input', () => renderTargets());
forceInput.addEventListener('input', () => renderEditorPreview());

document.getElementById('recovery-partial').addEventListener('click', () => {
  if (!recoveryState?.partial?.presets?.length) return;
  const partial = recoveryState.partial;
  if (!persist(partial)) return;
  fillEditor(null);
  setEditorMessage('복구된 목록만 저장했습니다. 이전 원본은 백업에 남아 있습니다.');
});

document.getElementById('recovery-fresh').addEventListener('click', async () => {
  const accepted = await confirmAsk('손상된 원본은 백업으로 옮기고, 빈 목록으로 다시 시작할까요?', '새로 시작');
  if (!accepted) return;
  if (!persist(emptyState())) return;
  fillEditor(null);
  setEditorMessage('새 저장소로 시작했습니다. 이전 원본은 백업에 남아 있습니다.');
});

document.getElementById('recovery-dismiss').addEventListener('click', () => {
  recoveryEl.hidden = true;
  recoverySlim.hidden = false;
});

document.getElementById('recovery-reopen').addEventListener('click', () => {
  recoveryEl.hidden = false;
  recoverySlim.hidden = true;
});

document.getElementById('dummy-save').addEventListener('click', onDummySave);
document.getElementById('dummy-new').addEventListener('click', () => { fillDummyForm(null); dummyMessage.textContent = ''; });
document.getElementById('dummy-examples').addEventListener('click', onDummyExamples);
setActive.addEventListener('change', () => {
  persistExtras({ activeSetId: setActive.value || null }, '', setMessage);
});
setSelect.addEventListener('change', () => { setLoadedId = setSelect.value || null; if (!setLoadedId) setName.value = ''; renderSets(); });
document.getElementById('set-save').addEventListener('click', onSetSave);
document.getElementById('set-delete').addEventListener('click', () => { onSetDelete(); });
document.getElementById('set-new').addEventListener('click', () => { setLoadedId = null; setName.value = ''; setMessage.textContent = ''; renderSets(); });
document.getElementById('export-backup').addEventListener('click', onBackupExport);
document.getElementById('import-file').addEventListener('change', (event) => { onImportFile(event); });
document.getElementById('import-apply').addEventListener('click', onImportApply);
document.getElementById('import-cancel').addEventListener('click', onImportCancel);
document.getElementById('usericon-file').addEventListener('change', (event) => { onIconFile(event); });
document.getElementById('usericon-add').addEventListener('click', onIconAdd);
document.getElementById('usericon-cancel').addEventListener('click', closeIconEditor);
iconPage.addEventListener('change', renderSlotPicker);
bindIconCropper();
document.getElementById('wallpaper-file').addEventListener('change', (event) => { onWallpaperFile(event); });
document.getElementById('wallpaper-apply').addEventListener('click', () => { onWallpaperApply(); });
document.getElementById('wallpaper-cancel').addEventListener('click', closeWallpaperEditor);
bindWallpaperCropper();
document.getElementById('wallpaper-reset').addEventListener('click', () => { onWallpaperReset(); });
for (const range of [optNoteFont, optNoteLine, optNoteEmphasis, optIconSize, optLabelSize, optBottomGap]) {
  range?.addEventListener('input', renderOptionLabels);
  range?.addEventListener('change', saveOptionsFromControls);
}

document.addEventListener('pointerdown', onFakeHomePointerDown);
document.addEventListener('pointermove', onFakeHomePointerMove);
document.addEventListener('pointerup', onFakeHomePointerUp);
document.addEventListener('pointercancel', onFakeHomePointerCancel);

document.addEventListener('touchstart', (event) => {
  if (!rehearsalSurfaceOpen()) return;
  if (event.touches.length === 2) {
    if (fakeHomeGesture) fakeHomeGesture.canceled = true;
    rememberTouches(event.touches);
  } else armed = null;
}, { passive: true });

document.addEventListener('touchmove', (event) => {
  if (!rehearsalSurfaceOpen() || !armed || event.touches.length !== 2) return;
  const moves = [];
  for (const touch of event.touches) {
    const record = armed.get(touch.identifier);
    if (!record) {
      armed = null;
      return;
    }
    record.lastY = touch.screenY;
    moves.push(touch.screenY - record.startY);
  }
  if (moves.length === 2 && moves.every((delta) => delta > 8)) event.preventDefault();
}, { passive: false });

document.addEventListener('touchend', (event) => {
  if (!rehearsalSurfaceOpen() || !armed) return;
  for (const touch of event.changedTouches) {
    const record = armed.get(touch.identifier);
    if (record) record.lastY = touch.screenY;
  }
  if (armed.size === 2 && isTwoFingerDownSwipe(gestureMoves())) {
    armed = null;
    leaveRehearsalSurface();
    return;
  }
  if (event.touches.length < 2) armed = null;
}, { passive: true });

document.addEventListener('touchcancel', resetTransientInput, { passive: true });
window.addEventListener('blur', resetTransientInput);
window.addEventListener('pagehide', resetTransientInput);
window.addEventListener('resize', resetTransientInput);
document.addEventListener('visibilitychange', resetTransientInput);

// While a performance surface is open nothing may lead to editing or a menu. Only the
// two-finger downward swipe above leaves it.
function blockWhilePerforming(event) {
  if (rehearsalSurfaceOpen()) event.preventDefault();
}
for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
  document.addEventListener(type, blockWhilePerforming, true);
}
document.addEventListener('click', (event) => {
  if (!rehearsalSurfaceOpen() || Date.now() >= clickGuardUntil) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

// Boot never rewrites a saved or corrupt store. The app opens on the settings screen unless the performer
// chose to start in the performance, which always begins on the first page of the fake home screen.
function startBootPerformance() {
  if (store.options?.startMode !== 'performance') return;
  try {
    const problem = startBlockReason();
    if (problem) {
      showStartProblem(problem, { scroll: false });
      return;
    }
    openFakeHome(selectNotes(store).notes);
  } catch (error) {
    abortStart(error);
  }
}

// Fetching the artwork now lets the service worker keep it for offline use without slowing the install.
function warmShellArtwork() {
  if (!navigator.serviceWorker?.controller) return;
  manifestFiles().forEach((file) => { fetch(iconSrc(file)).catch(() => {}); });
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
userIcons = loadUserIcons(localStorage, reservedCells());
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
document.documentElement.setAttribute('data-choice-ready', '1');
setTimeout(warmShellArtwork, 1500);

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
