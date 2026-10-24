import {
  NOTE_MAX_ITEMS, NOTE_MIN_ITEMS, buildPrecheck, emptyState, normalizeBuiltins, normalizeOptions,
  selectNotes,
} from './logic.js';
import { iconSrc, manifestFiles } from './home-manifest.js';
import { BUILTIN_LISTS } from './builtin-lists.js';
import { GESTURE_GUIDE_KEY } from './gesture-guide.js';
import {
  editorFields, recoveryEl, recoveryError, recoveryIssues, recoveryRaw, recoverySlim, repairNote,
  precheckList, precheckRefresh,
} from './dom.js';
import { setEditorMessage, confirmAsk } from './editor.js';
import { currentView, dirtyViews } from './views.js';
import { isInputGuideEnabled } from './input-guide.js';
import { startBlockReason } from './performance.js';
import { store, recoveryState, repairIssues, persist, fillEditor } from './controller.js';

// This registration's cache family. The worker stores the same encoded scope prefix.
function choiceScopeHref() {
  return new URL('./', location.href).href;
}

function choiceCachePrefix() {
  return 'choice-dist-shell-' + encodeURIComponent(choiceScopeHref()) + '-';
}

function choiceArtworkUrls() {
  return manifestFiles().map((file) => new URL(iconSrc(file), choiceScopeHref()).href);
}

// Offline readiness: every artwork URL is in this scope's cache. An active worker is not enough.
async function choiceArtworkCached(url) {
  if (typeof caches === 'undefined' || !caches || typeof caches.keys !== 'function') return false;
  const prefix = choiceCachePrefix();
  const names = await caches.keys();
  for (const name of names) {
    if (typeof name !== 'string' || name.indexOf(prefix) !== 0) continue;
    const cache = await caches.open(name);
    if (await cache.match(url, { ignoreSearch: true })) return true;
  }
  return false;
}

async function checkOfflineReady() {
  try {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker) return 'unsupported';
    const registration = await navigator.serviceWorker.getRegistration('./');
    if (registration?.active?.state !== 'activated') return 'pending';
    const urls = choiceArtworkUrls();
    for (const url of urls) {
      if (!(await choiceArtworkCached(url))) return 'pending';
    }
    return 'ready';
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
  if (currentView !== 'check') { dirtyViews.check = true; return; }
  dirtyViews.check = false;
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
  rows.push(precheckRow(offlineReadyCopy(offline || 'checking'), offline === 'ready' ? 'ok' : 'warn'));
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
    const epoch = ++offlineReadyEpoch;
    checkOfflineReady().then((state) => {
      if (epoch !== offlineReadyEpoch) return;
      renderPrecheck(state);
    });
  }
}

const OFFLINE_READY_TEXT = {
  ready: '오프라인 저장: 준비됨',
  pending: '오프라인 저장: 아직 준비되지 않았습니다. 인터넷이 연결된 상태에서 한 번 더 열어 주세요.',
  unsupported: '오프라인 저장: 이 브라우저에서는 확인할 수 없습니다.',
  checking: '오프라인 저장: 확인 중'
};
let offlineReadyEpoch = 0;

function offlineReadyCopy(state) {
  return OFFLINE_READY_TEXT[state] || OFFLINE_READY_TEXT.checking;
}

// Artwork warm-up finishes after the check screen has already read the cache.
// Replace only that line, and only while the screen is open. A hidden screen reads the cache the next time it opens.
function paintOfflineReadyLine(state) {
  if (!precheckList) return false;
  const kids = precheckList.children;
  for (let index = 0; index < kids.length; index += 1) {
    const row = kids[index];
    if (!String(row.textContent || '').startsWith('오프라인 저장:')) continue;
    row.textContent = offlineReadyCopy(state);
    row.dataset.tone = state === 'ready' ? 'ok' : 'warn';
    return true;
  }
  return false;
}

function refreshVisibleOfflineReady() {
  if (currentView !== 'check' || !precheckList) return;
  const epoch = ++offlineReadyEpoch;
  checkOfflineReady().then((state) => {
    if (epoch !== offlineReadyEpoch || currentView !== 'check') return;
    if (!paintOfflineReadyLine(state)) renderPrecheck(state);
  });
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

precheckRefresh?.addEventListener('click', () => renderPrecheck());

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

export {
  choiceArtworkUrls, precheckRow, renderPrecheck, refreshVisibleOfflineReady, renderRecovery,
};
