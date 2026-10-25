import {
  listCards, normalizeBuiltins, normalizeHiddenIds, readinessSummary,
} from './logic.js';
import { BUILTIN_LISTS } from './builtin-lists.js';
import { startBlockReason, showStartProblem } from './performance.js';
import { store, recoveryState, persist } from './controller.js';
import { currentView } from './views.js';
import { renderDetail, openDetail } from './detail-view.js';
import { openTargetPicker } from './wizard-view.js';

const homeLists = document.getElementById('home-lists');
const templateList = document.getElementById('template-list');
const homeSummary = document.getElementById('home-summary');

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

export { renderHomeSummary, renderHomeLists, renderSaved, setListEnabled };
