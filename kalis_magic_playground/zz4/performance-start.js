import { NOTE_LIST_LIMIT, NOTE_MAX_ITEMS, NOTE_MIN_ITEMS, selectNotes } from './logic.js';
import { notesEntryMessage, notesEntryAction, fakeHomeEl, settingsEl } from './dom.js';
import { currentView } from './views.js';
import { syncPerformanceWakeLock } from './wake-lock.js';
import { store, recoveryState } from './controller.js';
import { openFakeHome, setFakeHomeSession } from './fake-home-surface.js';
import { setFakeHomeGesture } from './performance-gestures.js';

// Isolated fake-home entry. Legacy performance rendering stays untouched.
function setNotesEntryMessage(text) {
  notesEntryMessage.textContent = text || '';
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
  setFakeHomeSession(null);
  setFakeHomeGesture(null);
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
// Startup listener registration lives in bind functions. controller.js calls them in the order the
// pre-split single file registered them (tests/community/choice-startup-order.test.mjs).
function bindStartButton() {
  document.getElementById('start-notes-show').addEventListener('click', startNotesShow);
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

export {
  startBlockReason, showStartProblem, startNotesShow, bindStartButton, startBootPerformance,
};
