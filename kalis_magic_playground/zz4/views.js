import {
  deletePreset, listCards, normalizeHiddenIds, parseWizardItems, stripItemPrefixes, presetFullList,
  readinessSummary, normalizeBuiltins, renamePreset, selectNotes,
} from './logic.js';
import { BUILTIN_LISTS, builtinById } from './builtin-lists.js';
import { settingsEl } from './dom.js';
import { confirmAsk } from './editor.js';
import { renderOptions } from './options.js';
import { renderPrecheck } from './precheck.js';
import {
  markStep, goWizardStep, syncStep2, setItemsLabels, renderWizardCount, wizardNext1, wizardNext2,
  showStep3, commitItemEdits, onWizardPicksClick, onWizardPicksInput, renderWizardStep3,
  toggleItemEditing, addItemRow, renderWizardPreview, stepWizardNumber,
} from './wizard.js';
import { renderDummies, renderSets } from './extras.js';
import { renderWallpaperState } from './wallpaper.js';
import { warmPreviews, warmDecoTab } from './previews.js';
import {
  fakeHomeSession, startBlockReason, showStartProblem, startNotesShow,
} from './performance.js';
import { store, recoveryState, persist, saveWizard } from './controller.js';

// ===== Settings views: home with list cards, three step list wizard, list detail, templates =====
const settingsViews = [...document.querySelectorAll('#settings .sv')];
const homeLists = document.getElementById('home-lists');
const templateList = document.getElementById('template-list');
const homeSummary = document.getElementById('home-summary');
let currentView = 'home';
let wizard = null;
let detailId = null;
// Hidden screens keep a dirty bit instead of being rebuilt on every save.
const dirtyViews = { home: false, dummy: true, sets: true, check: true, detail: false, options: false, wallpaper: true };

function noteStoreDirty(previous, next) {
  const presets = previous.presets !== next.presets
    || previous.hiddenPresetIds !== next.hiddenPresetIds
    || previous.builtins !== next.builtins
    || previous.twoList !== next.twoList;
  const options = previous.options !== next.options;
  const dummies = previous.dummyNotes !== next.dummyNotes;
  const sets = previous.sets !== next.sets || previous.activeSetId !== next.activeSetId;
  if (presets || sets || dummies || options) dirtyViews.home = true;
  if (presets || sets || dummies) dirtyViews.sets = true;
  if (dummies) dirtyViews.dummy = true;
  if (presets) dirtyViews.detail = true;
  if (options) dirtyViews.options = true;
  if (options) dirtyViews.wallpaper = true;
  dirtyViews.check = true;
}

function flushDirtyViews() {
  if (currentView === 'home' && dirtyViews.home) {
    dirtyViews.home = false;
    renderHomeLists();
    renderHomeSummary();
  } else if (currentView === 'advanced') {
    if (dirtyViews.home) renderHomeSummary();
    if (dirtyViews.options) { dirtyViews.options = false; renderOptions(); }
  } else if (currentView === 'detail' && dirtyViews.detail && store.presets.some((entry) => entry.id === detailId)) {
    dirtyViews.detail = false;
    renderDetail();
  } else if (currentView === 'dummy' && dirtyViews.dummy) {
    dirtyViews.dummy = false;
    renderDummies();
  } else if (currentView === 'sets' && dirtyViews.sets) {
    dirtyViews.sets = false;
    renderSets();
  } else if (currentView === 'check') {
    dirtyViews.check = false;
    renderPrecheck();
  } else if (currentView === 'deco') {
    if (dirtyViews.wallpaper) { dirtyViews.wallpaper = false; renderWallpaperState(); }
    if (dirtyViews.options) { dirtyViews.options = false; renderOptions(); }
  }
}

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
  if (name === 'deco' || name === 'advanced') warmPreviews(name);
  settingsViews.forEach((view) => { view.hidden = view.dataset.viewName !== name; });
  currentView = name;
  // A wizard only lives while one of its screens is open, so Back or Forward can never revive an abandoned one.
  // A half written new list is kept as a draft in memory, so leaving by mistake never loses it.
  if (name !== 'w1' && name !== 'w2' && name !== 'w3') {
    if (wizard && wizard.mode === 'new') keepWizardDraft();
    wizard = null;
  }
  if (name === 'w2') syncStep2();
  if (name === 'home') {
    if (dirtyViews.home) { dirtyViews.home = false; renderHomeLists(); renderHomeSummary(); }
    renderDraftButton();
  }
  if (name === 'dummy' && dirtyViews.dummy) { dirtyViews.dummy = false; renderDummies(); }
  if (name === 'sets' && dirtyViews.sets) { dirtyViews.sets = false; renderSets(); }
  if (name === 'detail' && dirtyViews.detail && store.presets.some((entry) => entry.id === detailId)) {
    dirtyViews.detail = false;
    renderDetail();
  }
  if (name === 'advanced') {
    if (dirtyViews.options) { dirtyViews.options = false; renderOptions(); }
    if (dirtyViews.home) renderHomeSummary();
  }
  if (name === 'deco') {
    if (dirtyViews.wallpaper) { dirtyViews.wallpaper = false; renderWallpaperState(); }
    if (dirtyViews.options) { dirtyViews.options = false; renderOptions(); }
  }
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
    warmDecoTab(kind);
    document.getElementById('deco-pv-home').hidden = kind !== 'home';
    document.getElementById('deco-pv-notes').hidden = kind !== 'notes';
    document.getElementById('deco-pv-cap').hidden = kind !== 'home';
    document.getElementById('deco-pv-notes-cap').hidden = kind !== 'notes';
  }));
  document.getElementById('wz-add').addEventListener('click', addItemRow);
  const wizardPicks = document.getElementById('wz-picks');
  wizardPicks.addEventListener('click', onWizardPicksClick);
  wizardPicks.addEventListener('input', onWizardPicksInput);
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

export {
  currentView, wizard, dirtyViews, noteStoreDirty, flushDirtyViews, navState, showView, renderSaved,
  wzTitle, wzItems, wzSave, notesFate, finishWizard, bindSettingsViews,
};
