import {
  addDummyNote, deleteDummyNote, deleteSet, saveSet, selectNotes, updateDummyNote,
} from './logic.js';
import { HOME_MANIFEST, iconSrc } from './home-manifest.js';
import { BUILTIN_LISTS } from './builtin-lists.js';
import { confirmAsk, renderEditorPreview } from './editor.js';
import { renderWallpaperState } from './wallpaper.js';
import { store, recoveryState, persist } from './controller.js';

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

let dummyLoadedId = null;
let setLoadedId = null;

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

function bindExtras() {
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
}

export { renderDummies, renderSets, renderMemoryTable, renderExtras, bindExtras };
