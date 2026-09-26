import {
  APPEARANCES,
  addPreset,
  applyFakeHomeSwipe,
  beginPerformance,
  chooseNumber,
  createFakeHomeEntry,
  deletePreset,
  emptyState,
  fakeHomeDigit,
  forceList,
  isRehearsalShortcut,
  isTwoFingerDownSwipe,
  loadFromStorage,
  overwritePreset,
  parseItemText,
  renamePreset,
  replaceStoreKeepingBackup,
  revealList,
  saveState,
  toPublic
} from './logic.js';

const settingsEl = document.getElementById('settings');
const performanceEl = document.getElementById('performance');
const stage = document.getElementById('stage');
const live = document.getElementById('performance-live');
const nameInput = document.getElementById('preset-name');
const appearanceInput = document.getElementById('appearance');
const itemsInput = document.getElementById('items');
const targetInput = document.getElementById('target');
const itemHint = document.getElementById('item-hint');
const itemCount = document.getElementById('item-count');
const editorMessage = document.getElementById('editor-message');
const presetList = document.getElementById('preset-list');
const twoEnabled = document.getElementById('two-enabled');
const twoA = document.getElementById('two-a');
const twoB = document.getElementById('two-b');
const twoMessage = document.getElementById('two-message');
const editorFields = document.getElementById('editor-fields');
const twoFields = document.getElementById('two-fields');
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
const inputGuideInput = document.getElementById('input-guide');
const fakeHomeEl = document.getElementById('fake-home');
const fakeNotesEl = document.getElementById('fake-notes');
const fakeNotesTitle = document.getElementById('fake-notes-title');
const fakeNotesBody = document.getElementById('fake-notes-body');
const fakeNotesBack = document.getElementById('fake-notes-back');
const fakeNotesSearch = fakeHomeEl?.querySelector('.notes-search');
const fakeNotesFolder = fakeHomeEl?.querySelector('.notes-folder-row');

const NOTE_ITEM_COUNT = 100;
const NOTE_LIST_LIMIT = 5;
const INPUT_GUIDE_KEY = 'magic-choice.v1.input-guide';
const INPUT_GUIDE_HOLD_MS = 800;
const INPUT_GUIDE_FADE_MS = 240;
const noteDateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

let store = emptyState();
let recoveryState = null;
let repairIssues = [];
let loadedId = null;
let session = null;
let performing = false;
let armed = null;
let liveSignature = '';
let pendingFocus = null;
let fakeHomeSession = null;
let fakeHomeGesture = null;
let inputGuidePage = null;
let inputGuideToken = 0;
let inputGuideTimers = { hold: 0, fade: 0 };

const FAKE_HOME_ICONS = [
  [
    ['사진', '▣', '#ef6b4a'],
    ['카메라', '◉', '#8e8e93'],
    ['날씨', '☼', '#4aa3f0'],
    ['시계', '◷', '#111111'],
    ['지도', '⌖', '#34a36b'],
    ['음악', '♪', '#ff2d55'],
    ['팟캐스트', '◌', '#b150e2'],
    ['메일', '✉', '#4c8dff'],
    ['캘린더', '▦', '#ff3b30'],
    ['알림', '☑', '#ff9f0a'],
    ['주식', '↗', '#222222'],
    ['뉴스', 'N', '#ff375f'],
    ['도서', 'B', '#ff9500'],
    ['건강', '♥', '#ff2d55'],
    ['지갑', 'W', '#1c1c1e'],
    ['설정', '⚙', '#8e8e93']
  ],
  [
    ['번역', '文', '#5ac8fa'],
    ['피트니스', '⌁', '#30d158'],
    ['파일', '▤', '#007aff'],
    ['계산기', '+', '#333333'],
    ['나침반', '✧', '#222222'],
    ['음성', '〰️', '#ff3b30'],
    ['홈', '⌂', '#ff9f0a'],
    ['단축어', '◇', '#ff375f'],
    ['찾기', '◎', '#34c759'],
    ['TV', '▷', '#111111'],
    ['스토어', 'A', '#0a84ff'],
    ['측정', '⊥', '#ffcc00'],
    ['팁', '!', '#8e8e93'],
    ['연락처', '☺', '#acb4bf'],
    ['영상', '☺', '#34c759'],
    ['사파리', '◎', '#2f80ed']
  ]
];

function setEditorMessage(text) {
  editorMessage.textContent = text || '';
}

function setTwoMessage(text) {
  twoMessage.textContent = text || '';
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
  renderTwo();
  return true;
}

function readEditor() {
  return {
    name: nameInput.value,
    itemsText: itemsInput.value,
    targetIndex: targetInput.value === '' ? null : Number(targetInput.value),
    appearance: appearanceInput.value
  };
}

function renderTargets(preferred) {
  const parsed = parseItemText(itemsInput.value);
  const items = parsed.ok ? parsed.items : [];
  const previous = preferred != null ? String(preferred) : targetInput.value;
  targetInput.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '목표 항목 선택';
  targetInput.append(placeholder);
  items.forEach((item, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1}. ${item}`;
    targetInput.append(option);
  });
  if (previous !== '' && items[Number(previous)] != null) targetInput.value = previous;
  else targetInput.value = '';
  itemCount.textContent = `${items.length}개 / 200`;
  if (!itemsInput.value.trim()) {
    itemHint.textContent = '한 줄에 하나씩 입력합니다. 빈 줄은 빠집니다. 최대 200개, 각 120자.';
  } else if (!parsed.ok) {
    itemHint.textContent = parsed.error;
  } else {
    itemHint.textContent = '빈 줄은 빠집니다. 목표 항목은 비어 있는 줄을 뺀 순서를 기준으로 합니다.';
  }
}

function fillEditor(preset) {
  loadedId = preset ? preset.id : null;
  nameInput.value = preset ? preset.name : '';
  appearanceInput.value = preset && APPEARANCES[preset.appearance] ? preset.appearance : 'memo';
  itemsInput.value = preset ? preset.items.join('\n') : '';
  renderTargets(preset ? preset.targetIndex : '');
  setEditorMessage('');
  renderSaved();
}

function isDirty() {
  if (!loadedId) {
    return nameInput.value.trim() !== '' || itemsInput.value.trim() !== '' || targetInput.value !== '';
  }
  const preset = store.presets.find((entry) => entry.id === loadedId);
  if (!preset) return true;
  const parsed = parseItemText(itemsInput.value);
  const sameItems = parsed.ok && parsed.items.join('\n') === preset.items.join('\n');
  return nameInput.value.trim() !== preset.name
    || appearanceInput.value !== preset.appearance
    || targetInput.value !== String(preset.targetIndex)
    || !sameItems;
}

function renderSaved() {
  presetList.replaceChildren();
  if (!store.presets.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '저장된 목록이 없습니다.';
    presetList.append(empty);
    return;
  }
  const sorted = store.presets.slice().sort((left, right) => right.updatedAt - left.updatedAt);
  sorted.forEach((preset) => {
    const card = document.createElement('article');
    card.className = 'preset';
    if (preset.id === loadedId) card.setAttribute('aria-current', 'true');
    const title = document.createElement('h3');
    title.textContent = preset.name;
    const meta = document.createElement('p');
    meta.className = 'hint';
    const appearance = APPEARANCES[preset.appearance]?.heading || preset.appearance;
    meta.textContent = `${appearance} · ${preset.items.length}개 · 목표 ${preset.targetIndex + 1}. ${preset.targetItem}`;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '편집';
    edit.addEventListener('click', () => {
      fillEditor(preset);
      nameInput.focus();
    });
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'primary';
    start.textContent = '이 목록으로 시작';
    start.addEventListener('click', () => { startSingle(preset.id); });
    actions.append(edit, start);
    card.append(title, meta, actions);
    presetList.append(card);
  });
}

function fillSelect(select, selected) {
  const current = selected == null ? '' : selected;
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '목록 선택';
  select.append(placeholder);
  store.presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    select.append(option);
  });
  select.value = store.presets.some((preset) => preset.id === current) ? current : '';
}

function renderTwo() {
  twoEnabled.checked = Boolean(store.twoList?.enabled);
  fillSelect(twoA, store.twoList?.presetIdA || '');
  fillSelect(twoB, store.twoList?.presetIdB || '');
}

function renderRecovery() {
  const blocked = Boolean(recoveryState);
  editorFields.disabled = blocked;
  twoFields.disabled = blocked;
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

function onSaveNew() {
  const created = addPreset(store.presets, readEditor(), { now: Date.now() });
  if (!created.ok) {
    setEditorMessage(created.error);
    return;
  }
  if (!persist({ ...store, presets: created.presets })) return;
  const saved = store.presets.find((preset) => preset.id === created.preset.id) || created.preset;
  fillEditor(saved);
  setEditorMessage('새 목록을 저장했습니다.');
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

async function onOverwrite() {
  const current = currentPreset();
  if (!current) {
    setEditorMessage('저장된 목록을 먼저 불러오세요.');
    return;
  }
  const accepted = await confirmAsk(
    `「${current.name}」의 항목, 목표 항목, 모양을 지금 입력으로 바꿀까요? 이름은 바뀌지 않습니다.`,
    '덮어쓰기'
  );
  if (!accepted) return;
  const overwritten = overwritePreset(store.presets, current.id, readEditor(), { now: Date.now() });
  if (!overwritten.ok) {
    setEditorMessage(overwritten.error);
    return;
  }
  if (!persist({ ...store, presets: overwritten.presets })) return;
  fillEditor(store.presets.find((preset) => preset.id === current.id) || overwritten.preset);
  setEditorMessage('목록 내용을 덮어썼습니다.');
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

function saveTwoFromControls() {
  if (recoveryState) return;
  const next = {
    ...store,
    twoList: {
      enabled: twoEnabled.checked,
      presetIdA: twoA.value || null,
      presetIdB: twoB.value || null
    }
  };
  if (!persist(next)) renderTwo();
  else setTwoMessage('');
}

async function startSingle(id) {
  if (recoveryState) {
    setEditorMessage('저장본을 먼저 처리하세요.');
    return;
  }
  const preset = store.presets.find((entry) => entry.id === id);
  if (!preset) {
    setEditorMessage('저장된 목록을 선택하세요.');
    return;
  }
  if (isDirty()) {
    const accepted = await confirmAsk('저장하지 않은 편집은 공연에 들어가지 않습니다. 저장된 목록으로 시작할까요?', '시작');
    if (!accepted) return;
  }
  const started = beginPerformance(store, { mode: 'single', presetId: id });
  if (!started.ok) {
    setEditorMessage(started.error);
    return;
  }
  setEditorMessage('');
  enterPerformance(started.session);
}

async function startTwo() {
  if (recoveryState) {
    setTwoMessage('저장본을 먼저 처리하세요.');
    return;
  }
  if (!twoEnabled.checked) {
    setTwoMessage('두 목록 사용을 켜 주세요.');
    return;
  }
  if (isDirty()) {
    const accepted = await confirmAsk('저장하지 않은 편집은 공연에 들어가지 않습니다. 저장된 두 목록으로 시작할까요?', '시작');
    if (!accepted) return;
  }
  const started = beginPerformance(store, {
    mode: 'two',
    presetIdA: twoA.value || null,
    presetIdB: twoB.value || null
  });
  if (!started.ok) {
    setTwoMessage(started.error);
    return;
  }
  setTwoMessage('');
  enterPerformance(started.session);
}

function enterPerformance(nextSession) {
  session = nextSession;
  performing = true;
  liveSignature = '';
  live.textContent = '';
  pendingFocus = 'start';
  settingsEl.hidden = true;
  performanceEl.hidden = false;
  document.title = '목록';
  document.body.dataset.view = 'performance';
  renderPerformance();
}

function exitPerformance() {
  if (!performing) return;
  performing = false;
  session = null;
  armed = null;
  live.textContent = '';
  liveSignature = '';
  pendingFocus = null;
  stage.replaceChildren();
  performanceEl.hidden = true;
  performanceEl.removeAttribute('data-appearance');
  performanceEl.removeAttribute('data-mode');
  settingsEl.hidden = false;
  document.title = '너의 선택은?';
  document.body.dataset.view = 'settings';
  settingsEl.querySelector('h1')?.focus();
}

function renderPerformance() {
  const pub = toPublic(session);
  const active = document.activeElement;
  const activeId = active?.id || '';
  const activeChoice = active?.dataset?.choice || '';
  performanceEl.dataset.appearance = pub.mode === 'single' ? pub.lists[0].appearance : 'mixed';
  performanceEl.dataset.mode = pub.mode;
  stage.replaceChildren();
  pub.lists.forEach((list, index) => {
    if (pub.mode === 'two' && index > 0 && !pub.lists[index - 1].revealed) return;
    stage.append(renderSheet(list, index));
  });
  if (pub.combined) stage.append(renderCombined(pub));
  updateLive(pub);
  if (pendingFocus === 'start') stage.querySelector('h2')?.focus();
  else if (pendingFocus === 'reveal') {
    const target = stage.querySelector('.combined h2') || stage.querySelector('.sheet:last-of-type h2');
    target?.focus();
  } else if (activeId && document.getElementById(activeId)) document.getElementById(activeId).focus();
  else if (activeChoice) stage.querySelector(`[data-choice="${activeChoice}"]`)?.focus();
  pendingFocus = null;
}

function updateLive(pub) {
  const chunks = [];
  pub.lists.forEach((list) => {
    if (list.revealed) chunks.push(`${list.heading}. ${list.items.join(', ')}`);
  });
  if (pub.combined) chunks.push(`함께 보기. ${pub.combined.join(', ')}`);
  const signature = chunks.join('|');
  if (signature !== liveSignature) {
    liveSignature = signature;
    live.textContent = chunks.join(' ');
  }
}

function renderSheet(list, index) {
  const section = document.createElement('section');
  section.className = 'sheet';
  section.dataset.appearance = list.appearance;
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = list.name;
  const heading = document.createElement('h2');
  heading.tabIndex = -1;
  heading.textContent = list.heading;
  section.append(kicker, heading);
  section.append(list.revealed ? renderRows(list) : renderChooser(list, index));
  return section;
}

function renderChooser(list, index) {
  const wrap = document.createElement('div');
  const prompt = document.createElement('p');
  prompt.className = 'prompt';
  prompt.id = `prompt-${index}`;
  prompt.textContent = list.numberPrompt;
  const select = document.createElement('select');
  select.id = `number-${index}`;
  select.setAttribute('aria-labelledby', prompt.id);
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = list.numberPrompt;
  select.append(blank);
  for (let number = 1; number <= list.count; number += 1) {
    const option = document.createElement('option');
    option.value = String(number);
    option.textContent = String(number);
    select.append(option);
  }
  if (list.choice) select.value = String(list.choice);
  select.addEventListener('change', () => {
    if (!select.value) {
      select.value = list.choice ? String(list.choice) : '';
      return;
    }
    applyChoice(index, Number(select.value));
  });
  const grid = document.createElement('div');
  grid.className = 'numbers';
  for (let number = 1; number <= list.count; number += 1) {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.textContent = String(number);
    choice.dataset.choice = `${index}-${number}`;
    choice.setAttribute('aria-label', `번호 ${number}`);
    choice.setAttribute('aria-pressed', list.choice === number ? 'true' : 'false');
    choice.addEventListener('click', () => applyChoice(index, number));
    grid.append(choice);
  }
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'primary reveal';
  reveal.textContent = list.revealLabel;
  reveal.disabled = !Number.isInteger(list.choice);
  reveal.addEventListener('click', () => applyReveal(index));
  wrap.append(prompt, select, grid, reveal);
  return wrap;
}

function renderRows(list) {
  const rows = document.createElement('ol');
  rows.className = 'rows';
  list.items.forEach((item, itemIndex) => {
    const row = document.createElement('li');
    row.className = 'row';
    const chosen = list.choice === itemIndex + 1;
    if (chosen) {
      row.classList.add('is-chosen');
      row.setAttribute('aria-current', 'true');
    }
    row.append(markerFor(list.appearance, itemIndex + 1, chosen), itemLabel(item));
    rows.append(row);
  });
  const note = document.createElement('p');
  note.className = 'sr-only';
  note.textContent = '선택한 번호가 고정되었습니다.';
  const wrap = document.createElement('div');
  wrap.append(rows, note);
  return wrap;
}

function markerFor(appearance, number, chosen) {
  const mark = document.createElement('span');
  mark.setAttribute('aria-hidden', 'true');
  if (appearance === 'ranking') {
    mark.className = 'rank-no';
    mark.textContent = String(number);
  } else if (appearance === 'todo') {
    mark.className = 'check';
    mark.textContent = chosen ? '✓' : '';
  } else if (appearance === 'travel') {
    mark.className = 'pin';
    mark.textContent = '⌖';
  } else if (appearance === 'menu') {
    mark.className = 'menu-mark';
    mark.textContent = '✦';
  } else {
    mark.className = 'memo-mark';
    mark.textContent = '✎';
  }
  return mark;
}

function itemLabel(item) {
  const text = document.createElement('span');
  text.className = 'item-label';
  text.textContent = item;
  return text;
}

function renderCombined(pub) {
  const section = document.createElement('section');
  section.className = 'combined';
  const heading = document.createElement('h2');
  heading.tabIndex = -1;
  heading.textContent = '함께 보기';
  section.append(heading);
  pub.combined.forEach((item, index) => {
    const card = document.createElement('article');
    const kicker = document.createElement('p');
    kicker.className = 'kicker';
    kicker.textContent = pub.lists[index].name;
    const line = document.createElement('p');
    line.className = 'combined-item';
    line.textContent = item;
    card.append(kicker, line);
    section.append(card);
  });
  return section;
}

function applyChoice(index, choice) {
  const result = chooseNumber(session, index, choice);
  if (!result.ok) {
    showPerformanceError(result.error);
    return;
  }
  session = result.session;
  renderPerformance();
}

function applyReveal(index) {
  const result = revealList(session, index);
  if (!result.ok) {
    showPerformanceError(result.error);
    return;
  }
  session = result.session;
  pendingFocus = 'reveal';
  renderPerformance();
}

function showPerformanceError(text) {
  let note = document.getElementById('performance-error');
  if (!note) {
    note = document.createElement('p');
    note.id = 'performance-error';
    note.className = 'message';
    note.setAttribute('role', 'alert');
    stage.prepend(note);
  }
  note.textContent = text;
}

// Isolated fake-home entry. Legacy performance rendering stays untouched.
function setNotesEntryMessage(text) {
  notesEntryMessage.textContent = text || '';
}

function rehearsalSurfaceOpen() {
  return performing || fakeHomeSession != null;
}

function leaveRehearsalSurface() {
  if (performing) exitPerformance();
  else if (fakeHomeSession) closeFakeHome();
}

function createAppIcon(label, symbol, tone) {
  const cell = document.createElement('div');
  cell.className = 'app-icon';
  const glyph = document.createElement('span');
  glyph.className = 'app-glyph';
  glyph.style.setProperty('--tone', tone);
  glyph.textContent = symbol;
  glyph.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'app-name';
  name.textContent = label;
  cell.append(glyph, name);
  return cell;
}

function ensureFakeHomeIcons() {
  if (fakeHomeEl.dataset.ready === 'true') return;
  fakeHomeEl.querySelectorAll('[data-home-grid]').forEach((grid) => {
    const pageIndex = Number(grid.dataset.homeGrid);
    (FAKE_HOME_ICONS[pageIndex] || []).forEach(([label, symbol, tone]) => {
      grid.append(createAppIcon(label, symbol, tone));
    });
  });
  fakeHomeEl.dataset.ready = 'true';
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
  if (row === 0 || col === 0) return 0;
  return (row - 1) * 3 + col;
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

// Static 4×4 map only. Never render the entered tens, ones, or chosen value.
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
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
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
  fakeHomeEl.querySelectorAll('.home-dots span').forEach((dot, index) => {
    dot.classList.toggle('is-current', !onNotes && index === page);
  });
  if (onNotes && !fakeHomeSession.notesMounted) {
    fakeHomeSession.notesMounted = true;
    renderFakeNotesIndex();
  }
  if (onNotes && !fakeHomeSession.openNoteId) fakeNotesTitle?.focus();
}

function activeFakeHomeGrid() {
  if (!fakeHomeSession || fakeHomeSession.page === 'notes') return null;
  return fakeHomeEl.querySelector(`[data-home-grid="${fakeHomeSession.page}"]`);
}

function isEligibleNotePreset(preset) {
  if (!preset || !Array.isArray(preset.items) || preset.items.length !== NOTE_ITEM_COUNT) return false;
  if (!preset.items.every((item) => typeof item === 'string' && item.trim() !== '')) return false;
  return Number.isInteger(preset.targetIndex)
    && preset.targetIndex >= 0
    && preset.targetIndex < preset.items.length;
}

function snapshotEligibleNotes(presets) {
  const eligible = [];
  if (!Array.isArray(presets)) return { notes: eligible, truncated: false };
  for (const preset of presets) {
    if (!isEligibleNotePreset(preset)) continue;
    eligible.push({
      id: preset.id,
      name: preset.name,
      items: preset.items.slice(),
      targetIndex: preset.targetIndex,
      updatedAt: preset.updatedAt
    });
  }
  return {
    notes: eligible.slice(0, NOTE_LIST_LIMIT),
    truncated: eligible.length > NOTE_LIST_LIMIT
  };
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
  fakeNotesBody?.replaceChildren();
  fakeNotesEl?.classList.remove('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = true;
  if (fakeNotesTitle) fakeNotesTitle.textContent = '메모';
  if (fakeNotesSearch) fakeNotesSearch.hidden = false;
  if (fakeNotesFolder) fakeNotesFolder.hidden = false;
}

function renderFakeNotesIndex(focusId) {
  if (!fakeHomeSession || !fakeNotesBody) return;
  fakeHomeSession.openNoteId = null;
  fakeNotesEl.classList.remove('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = true;
  if (fakeNotesTitle) fakeNotesTitle.textContent = '메모';
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

function renderFakeNoteDetail(name, items) {
  if (!fakeNotesBody) return;
  fakeNotesEl.classList.add('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = false;
  if (fakeNotesTitle) fakeNotesTitle.textContent = name;
  if (fakeNotesSearch) fakeNotesSearch.hidden = true;
  if (fakeNotesFolder) fakeNotesFolder.hidden = true;
  fakeNotesBody.replaceChildren();
  const scroller = document.createElement('div');
  scroller.className = 'notes-detail-scroll';
  const lines = document.createElement('ol');
  lines.className = 'notes-lines';
  items.forEach((item, index) => {
    const row = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'notes-line-no';
    number.textContent = String(index + 1);
    const text = document.createElement('span');
    text.className = 'notes-line-text';
    text.textContent = item;
    row.append(number, text);
    lines.append(row);
  });
  scroller.append(lines);
  fakeNotesBody.append(scroller);
  fakeNotesBack?.focus();
}

function openFakeNote(noteId) {
  const current = fakeHomeSession;
  if (!current || current.page !== 'notes' || current.entry?.locked !== true) return;
  const note = current.notes.find((entry) => entry.id === noteId);
  if (!note) return;
  const forced = forceList(note.items.slice(), note.targetIndex, current.entry.value);
  if (!forced.ok || !Array.isArray(forced.items)) return;
  current.openNoteId = noteId;
  renderFakeNoteDetail(note.name, forced.items);
}

function backToFakeNotesIndex() {
  if (!fakeHomeSession || fakeHomeSession.page !== 'notes') return;
  const focusId = fakeHomeSession.openNoteId;
  renderFakeNotesIndex(focusId);
}

function openFakeHome(notes) {
  if (performing) return;
  ensureFakeHomeIcons();
  fakeHomeGesture = null;
  clearFakeNotesView();
  fakeHomeSession = {
    entry: createFakeHomeEntry(),
    page: 0,
    notes,
    openNoteId: null,
    notesMounted: false
  };
  fakeHomeEl.classList.remove('is-notes');
  fakeNotesEl.hidden = true;
  syncFakeHomeSurface();
  settingsEl.hidden = true;
  performanceEl.hidden = true;
  fakeHomeEl.hidden = false;
  document.title = '메모';
  document.body.dataset.view = 'fake-home';
  fakeHomeEl.focus();
}

function closeFakeHome() {
  dismissInputGuide();
  if (!fakeHomeSession) return;
  fakeHomeSession = null;
  fakeHomeGesture = null;
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
  settingsEl.querySelector('h1')?.focus();
}

function startNotesShow() {
  if (recoveryState) {
    setNotesEntryMessage('저장본을 먼저 처리한 다음 노트 연출을 시작하세요.');
    return;
  }
  const snapped = snapshotEligibleNotes(store.presets);
  if (!snapped.notes.length) {
    setNotesEntryMessage('노트 연출에 쓸 수 있는 목록이 없습니다. 목록 편집에서 비어 있지 않은 항목 100개를 저장하고, 각 목록의 목표 항목을 고른 뒤 다시 노트 연출 시작을 누르세요.');
    return;
  }
  if (snapped.truncated) {
    setNotesEntryMessage('조건에 맞는 목록이 다섯 개를 넘어, 저장된 순서의 앞 다섯 개만 노트로 사용합니다. 저장본은 바꾸지 않았습니다.');
  } else {
    setNotesEntryMessage('');
  }
  openFakeHome(snapped.notes);
}

function finishFakeHomePointer(event, canceled) {
  if (!fakeHomeSession || !fakeHomeGesture || event.pointerId !== fakeHomeGesture.id) return;
  const gesture = fakeHomeGesture;
  fakeHomeGesture = null;
  const next = applyFakeHomeSwipe(fakeHomeSession.entry, {
    digit: gesture.digit,
    dx: event.clientX - gesture.startX,
    dy: event.clientY - gesture.startY,
    canceled: canceled || gesture.canceled
  });
  if (next === fakeHomeSession.entry) return;
  fakeHomeSession.entry = next;
  fakeHomeSession.page = next.locked ? 'notes' : 1;
  syncFakeHomeSurface();
}

function onFakeHomePointerDown(event) {
  if (!fakeHomeSession || fakeHomeEl.hidden) return;
  if (fakeHomeGesture) {
    fakeHomeGesture.canceled = true;
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const grid = activeFakeHomeGrid();
  if (!grid || !grid.contains(event.target)) return;
  const rect = grid.getBoundingClientRect();
  fakeHomeGesture = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    digit: fakeHomeDigit(
      { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      event.clientX,
      event.clientY
    ),
    canceled: false
  };
}

function onFakeHomePointerUp(event) {
  finishFakeHomePointer(event, false);
}

function onFakeHomePointerCancel(event) {
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

document.getElementById('save-new').addEventListener('click', onSaveNew);
document.getElementById('rename').addEventListener('click', onRename);
document.getElementById('overwrite').addEventListener('click', () => { onOverwrite(); });
document.getElementById('delete-preset').addEventListener('click', () => { onDelete(); });
document.getElementById('reset-form').addEventListener('click', () => fillEditor(null));
document.getElementById('start-one').addEventListener('click', () => {
  if (!loadedId) {
    setEditorMessage('저장된 목록을 먼저 불러오거나 저장하세요.');
    return;
  }
  startSingle(loadedId);
});
document.getElementById('start-two').addEventListener('click', () => { startTwo(); });
document.getElementById('start-notes-show').addEventListener('click', startNotesShow);
inputGuideInput?.addEventListener('change', persistInputGuidePreference);
fakeNotesBack?.addEventListener('click', backToFakeNotesIndex);
form.addEventListener('submit', (event) => event.preventDefault());
itemsInput.addEventListener('input', () => renderTargets());
twoEnabled.addEventListener('change', saveTwoFromControls);
twoA.addEventListener('change', saveTwoFromControls);
twoB.addEventListener('change', saveTwoFromControls);

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

document.addEventListener('keydown', (event) => {
  if (!rehearsalSurfaceOpen() || event.repeat) return;
  if (!isRehearsalShortcut(event)) return;
  event.preventDefault();
  leaveRehearsalSurface();
});

document.addEventListener('pointerdown', onFakeHomePointerDown);
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

document.addEventListener('touchcancel', () => { armed = null; }, { passive: true });

loadInputGuidePreference();

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
renderTwo();
renderTargets('');

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
