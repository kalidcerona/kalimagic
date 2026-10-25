import {
  NOTE_LIST_LIMIT, NOTE_MAX_ITEMS, NOTE_MIN_ITEMS, applyFakeHomeSwipe, applyFakeHomeTap,
  applyFakeHomeUndo, classifyFakeHomeGesture, createFakeHomeEntry, fakeHomeDigit,
  isTwoFingerDownSwipe, normalizeOptions, selectNotes,
} from './logic.js';
import { maybeShowGestureGuide, hideGestureGuide } from './gesture-guide.js';
import {
  settingsEl, notesEntryMessage, notesEntryAction, fakeHomeEl, fakeNotesEl, fakeNotesTitle,
  fakeHomeDots, fakePhone, entryReadout,
} from './dom.js';
import { choiceArtworkUrls, refreshVisibleOfflineReady } from './precheck.js';
import { currentView, navState, showView } from './views.js';
import { syncUserIconsFromStorage, ensureFakeHomeIcons } from './user-icons.js';
import { releaseWallpaper, applyWallpaper } from './previews.js';
import { dismissInputGuide } from './input-guide.js';
import { syncFakeHomeSurface, clearFakeNotesView } from './fake-notes.js';
import { acquireWakeLock, releaseWakeLock, syncPerformanceWakeLock } from './wake-lock.js';
import { store, recoveryState } from './controller.js';

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

let armed = null;
let fakeHomeSession = null;
let fakeHomeGesture = null;

let peek = null;
let clickGuardUntil = 0;
let readoutCleared = false;

let resetTaps = null;
let cornerDown = null;

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

function openFakeHome(notes) {
  syncUserIconsFromStorage();
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
  syncFakeHomeSurface();
  settingsEl.hidden = true;
  fakeHomeEl.hidden = false;
  document.title = '메모';
  document.body.dataset.view = 'fake-home';
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
  fakeHomeGesture = null;
  resetTaps = null;
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
  fakeHomeSession = null;
  fakeHomeGesture = null;
  if (fakeHomeEl) fakeHomeEl.hidden = true;
  if (settingsEl) settingsEl.hidden = false;
  document.body.dataset.view = 'settings';
  document.title = '너의 선택은?';
  showStartProblem({ recovery: false, text: `공연 화면을 열지 못했습니다. (${error?.message || '알 수 없는 오류'}) 저장된 목록은 그대로입니다. 앱을 완전히 닫았다가 다시 열어 보세요.` });
  syncPerformanceWakeLock();
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
    } else if (fakePhone?.contains(event.target) && !fakeHomeDots?.contains(event.target)) {
      // Wallpaper and dock count as 0, like the dummy icons. The page dots do not.
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

// The reset zone is the top right corner above the icon grid. It never takes digits.
function inResetCorner(event) {
  const frame = fakeHomeEl.querySelector('.fake-home-frame');
  if (!frame) return false;
  const rect = frame.getBoundingClientRect();
  const height = 40;
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

// Startup listener registration lives in bind functions. controller.js calls them in the order the
// pre-split single file registered them (tests/community/choice-startup-order.test.mjs).
function bindStartButton() {
  document.getElementById('start-notes-show').addEventListener('click', startNotesShow);
}

// While a performance surface is open nothing may lead to editing or a menu. Only the
// two-finger downward swipe above leaves it.
function blockWhilePerforming(event) {
  if (rehearsalSurfaceOpen()) event.preventDefault();
}

function bindPerformanceInput() {
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
  document.addEventListener('visibilitychange', () => {
    resetTransientInput();
    if (document.visibilityState === 'visible') acquireWakeLock();
    else releaseWakeLock();
  });

  for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
    document.addEventListener(type, blockWhilePerforming, true);
  }
  document.addEventListener('click', (event) => {
    if (!rehearsalSurfaceOpen() || Date.now() >= clickGuardUntil) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

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
// Three tries, with a short bounded pause between them. A miss must not retry forever.
const ARTWORK_ATTEMPTS = 3;
const ARTWORK_BACKOFF_MS = 300;
let artworkWarmStarted = false;
let artworkWarmPending = 0;

function artworkWarmSettled() {
  artworkWarmPending -= 1;
  if (artworkWarmPending === 0) refreshVisibleOfflineReady();
}

function warmOneArtwork(url, attempt) {
  fetch(url, { cache: 'reload' }).then((response) => {
    if (!response || response.ok === false) throw new Error('artwork miss');
    artworkWarmSettled();
  }).catch(() => {
    if (attempt >= ARTWORK_ATTEMPTS) {
      artworkWarmSettled();
      return;
    }
    setTimeout(() => warmOneArtwork(url, attempt + 1), ARTWORK_BACKOFF_MS * attempt);
  });
}

function warmShellArtwork() {
  if (artworkWarmStarted || !navigator.serviceWorker?.controller) return;
  artworkWarmStarted = true;
  const urls = choiceArtworkUrls();
  artworkWarmPending = urls.length;
  if (!urls.length) {
    refreshVisibleOfflineReady();
    return;
  }
  urls.forEach((url) => warmOneArtwork(url, 1));
}

// Wait until a controller exists. ready covers a page that is already controlled;
// controllerchange covers the first claim. Neither path is a timed guess.
function armArtworkWarmup() {
  try {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker) return;
    const worker = navigator.serviceWorker;
    const kick = () => { if (worker.controller) warmShellArtwork(); };
    if (typeof worker.addEventListener === 'function') worker.addEventListener('controllerchange', kick);
    const ready = worker.ready;
    if (ready && typeof ready.then === 'function') ready.then(kick, () => {});
  } catch { /* A blocked worker must not stop the app. */ }
}

export {
  fakeHomeSession, rehearsalSurfaceOpen, applyHomeStyle, vibrateCue, renderEntryReadout,
  attachPinchZoom, closeFakeHome, backToFakeHome, startBlockReason, showStartProblem,
  startNotesShow, startBootPerformance, armArtworkWarmup, bindStartButton, bindPerformanceInput,
};
