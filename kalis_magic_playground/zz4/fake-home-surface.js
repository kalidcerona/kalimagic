import { createFakeHomeEntry, normalizeOptions } from './logic.js';
import { maybeShowGestureGuide, hideGestureGuide } from './gesture-guide.js';
import {
  settingsEl, fakeHomeEl, fakeNotesEl, fakeNotesTitle, fakeHomeDots, entryReadout,
} from './dom.js';
import { navState, showView } from './views.js';
import { syncUserIconsFromStorage, ensureFakeHomeIcons } from './user-icons.js';
import { releaseWallpaper, applyWallpaper } from './previews.js';
import { dismissInputGuide } from './input-guide.js';
import { syncFakeHomeSurface, clearFakeNotesView } from './fake-notes.js';
import { syncPerformanceWakeLock } from './wake-lock.js';
import { store } from './controller.js';
import {
  readoutCleared, setArmed, setFakeHomeGesture, setReadoutCleared, setResetTaps,
} from './performance-gestures.js';

const PEEK_HOLD_MS = 400;
const VIBRATE_MS = 30;
const PEEK_MAX_MS = 1500;
const PINCH_MIN_ZOOM = 0.8;
const PINCH_MAX_ZOOM = 2.6;

let fakeHomeSession = null;
let peek = null;

function rehearsalSurfaceOpen() {
  return fakeHomeSession != null;
}

function leaveRehearsalSurface() {
  if (fakeHomeSession) closeFakeHome();
}

function applyHomeStyle(options, root = fakeHomeEl) {
  root.style.setProperty('--icon-scale', String(options.iconSize / 100));
  root.style.setProperty('--label-size', `${options.labelSize}px`);
  root.style.setProperty('--bottom-gap', `${options.bottomGap}px`);
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

function activeFakeHomeGrid() {
  if (!fakeHomeSession || fakeHomeSession.page === 'notes') return null;
  return fakeHomeEl.querySelector(`[data-home-grid="${fakeHomeSession.page}"]`);
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
    setArmed(null);
    const zoom = Math.min(PINCH_MAX_ZOOM, Math.max(PINCH_MIN_ZOOM, pinch.zoom * (now / pinch.start)));
    lines.dataset.zoom = String(zoom);
    lines.style.setProperty('--note-zoom', String(zoom));
    event.preventDefault();
  }, { passive: false });
  scroller.addEventListener('touchend', () => { pinch = null; }, { passive: true });
}

function openFakeHome(notes) {
  syncUserIconsFromStorage();
  ensureFakeHomeIcons();
  setFakeHomeGesture(null);
  setResetTaps(null);
  clearFakeNotesView();
  setReadoutCleared(false);
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
  syncFakeHomeSurface();
  settingsEl.hidden = true;
  fakeHomeEl.hidden = false;
  document.title = '메모';
  document.body.dataset.view = 'fake-home';
  globalThis.MagicUpdate?.hide();
  applyWallpaper(fakeHomeSession.options);
  fakeHomeEl.focus();
  maybeShowGestureGuide();
  syncPerformanceWakeLock();
}

function closeFakeHome() {
  hideGestureGuide();
  dismissInputGuide();
  if (!fakeHomeSession) return;
  fakeHomeSession = null;
  setFakeHomeGesture(null);
  setResetTaps(null);
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
  globalThis.MagicUpdate?.offer(); // the settings screen is off-stage
  showView('home', { push: false });
  // The history entry under the performance must say what is visible now.
  try { history.replaceState(navState('home'), ''); } catch { /* History can be blocked. */ }
  syncPerformanceWakeLock();
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
  setFakeHomeGesture(null);
  setReadoutCleared(false);
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

function setFakeHomeSession(value) {
  fakeHomeSession = value;
}

export {
  fakeHomeSession, peek, setFakeHomeSession, rehearsalSurfaceOpen, leaveRehearsalSurface, applyHomeStyle,
  vibrateAccepted, vibrateCue, renderEntryReadout, endPeek, beginPeek, activeFakeHomeGrid, attachPinchZoom,
  openFakeHome, closeFakeHome, resetForNextSpectator, openNotesApp, backToFakeHome,
};
