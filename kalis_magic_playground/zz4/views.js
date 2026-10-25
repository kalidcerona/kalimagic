import { parseWizardItems, stripItemPrefixes, listCards } from './logic.js';
import { settingsEl } from './dom.js';
import { renderOptions } from './options.js';
import { renderPrecheck } from './precheck.js';
import {
  markStep, goWizardStep, syncStep2, renderWizardCount, wizardNext1, wizardNext2,
  commitItemEdits, onWizardPicksClick, onWizardPicksInput, renderWizardStep3,
  toggleItemEditing, addItemRow, stepWizardNumber,
} from './wizard.js';
import { renderDummies, renderSets } from './extras.js';
import { renderWallpaperState } from './wallpaper.js';
import { warmPreviews, warmDecoTab } from './previews.js';
import { fakeHomeSession, startNotesShow } from './performance.js';
import { store, saveWizard } from './controller.js';
import { renderHomeSummary, renderHomeLists, setListEnabled } from './views-home.js';
import { detailId, renderDetail, saveRename, deleteDetail } from './detail-view.js';
import {
  wizard, setWizard, wzTitle, wzItems, wzSave, wizardLooks, keepWizardDraft, renderDraftButton,
  openNewWizard, openTargetPicker, openEditItems, bindWizardDraftClear,
} from './wizard-view.js';

// ===== Settings views: home with list cards, three step list wizard, list detail, templates =====
const settingsViews = [...document.querySelectorAll('#settings .sv')];
let currentView = 'home';
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
    setWizard(null);
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
  bindWizardDraftClear();
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

export { wizard } from './wizard-view.js';
export { renderSaved } from './views-home.js';
export { wzTitle, wzItems, wzSave, notesFate, finishWizard } from './wizard-view.js';
export { currentView, dirtyViews, noteStoreDirty, flushDirtyViews, navState, showView, bindSettingsViews };
