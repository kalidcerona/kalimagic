import * as E from './engine.mjs';
import { openStore } from './store.mjs';
import {
  $,
  TYPE_LABEL,
  TRIGGER_LABEL,
  LOOP_LABEL,
  el,
  button,
  showScreen,
  openDialog,
  info,
  confirmDelete,
  askText,
} from './ui.mjs';

let store = null;
let shows = [];
let audioIds = new Set();
let current = null;   // show open in the editor
let tab = 'main';

// ---------- persistence ----------
async function refresh() {
  shows = await store.shows();
  audioIds = await store.audioIds();
}
async function saveShow(edited, { report = true } = {}) {
  const previous = current && current.id === edited.id ? current : edited;
  const repaired = E.repairShowReferences(previous, edited);
  await store.saveShow(repaired);
  if (current && current.id === repaired.id) current = repaired;
  await refresh();
  const lines = E.repairReport(previous, edited, repaired);
  if (report && lines.length) info('큐 정리 결과', lines.join('\n'));
  return repaired;
}

// ---------- home ----------
function renderHome() {
  const list = $('showList');
  list.replaceChildren(...shows.map(show => el('article', { class: 'card' },
    el('h2', { text: show.name }),
    el('p', { class: 'meta', text: `메인 ${show.cues.length} · 히트 ${show.hits.length} · 삽입 ${show.inserts.length} · 오디오 ${show.audioFiles.length}` }),
    el('div', { class: 'actions' },
      button('열기', () => openEditor(show), 'btn primary'),
      button('이름', () => askText('공연 이름', '이름', show.name, async name => { await saveShow({ ...show, name: name.trim() || '새 공연' }); renderHome(); })),
      button('복제', async () => { await store.saveShow({ ...structuredClone(show), id: E.newId(), name: show.name + ' 복사' }); await refresh(); renderHome(); }),
      button('삭제', () => confirmDelete('공연 삭제', `${show.name} 공연을 삭제할까요?`, async () => { await store.deleteShow(show.id); await refresh(); renderHome(); }), 'btn2 danger')))));
  $('emptyShows').hidden = shows.length > 0;
  $('storageNote').textContent = store.persistent ? '' : '이 브라우저는 저장을 막고 있어요. 이번 방문 동안만 기억합니다.';
}
$('newShow').addEventListener('click', async () => { const show = E.makeShow(); await store.saveShow(show); await refresh(); openEditor(show); });
$('importShow').addEventListener('click', () => $('showFile').click());
$('showFile').addEventListener('change', async () => {
  const file = $('showFile').files[0];
  $('showFile').value = '';
  if (!file) return;
  try {
    const show = { ...E.importShowBackup(await file.text()), id: E.newId() };
    await store.saveShow(show); await refresh(); renderHome();
    const missing = show.audioFiles.filter(f => !audioIds.has(f.id)).length;
    info('공연을 가져왔어요', missing ? `오디오 ${missing}개가 아직 없어요. 공연을 열고 오디오 여러 개 가져오기에서 같은 이름의 파일을 골라 주세요.` : '오디오도 모두 준비돼 있어요.');
  } catch (error) { info('가져올 수 없습니다', error.message); }
});

// ---------- editor ----------
function openEditor(show) { current = show; tab = 'main'; renderEditor(); showScreen('editor'); }
function renderEditor() {
  const show = current;
  $('showName').textContent = show.name;
  const missing = show.audioFiles.filter(f => !audioIds.has(f.id)).length;
  $('audioSummary').textContent = `${show.audioFiles.length}개` + (missing ? `, ${missing}개 없음` : '');
  $('audioList').replaceChildren(...show.audioFiles.map(f => el('li', {},
    el('span', { text: f.displayName }), el('span', { class: audioIds.has(f.id) ? 'ok' : 'missing', text: audioIds.has(f.id) ? '있음' : '없음' }))));
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  const body = $('tabBody');
  if (tab === 'inserts') {
    const name = el('input', { maxlength: 80, autocomplete: 'off', placeholder: '삽입 목록 이름' });
    body.replaceChildren(
      el('label', { class: 'field' }, el('span', { text: '삽입 목록 이름' }), name),
      button('목록 추가', async () => {
        if (!name.value.trim()) return;
        await saveShow({ ...current, inserts: [...current.inserts, E.makeSideList({ name: name.value.trim() })] }); renderEditor();
      }),
      ...show.inserts.map(side => el('div', { class: 'card' },
        el('h3', { text: '삽입: ' + side.name }),
        el('div', { class: 'actions' },
          button('이름 변경', () => askText('삽입 목록 이름', '이름', side.name, async value => {
            if (!value.trim()) return;
            await saveShow({ ...current, inserts: current.inserts.map(s => s.id === side.id ? { ...s, name: value.trim() } : s) }); renderEditor();
          })),
          button('목록 삭제', () => confirmDelete('삭제 확인', `${side.name} 목록을 삭제할까요?`, async () => {
            await saveShow({ ...current, inserts: current.inserts.filter(s => s.id !== side.id) }); renderEditor();
          }), 'btn2 danger')),
        cueListEditor(side.cues, Infinity, cues => ({ ...current, inserts: current.inserts.map(s => s.id === side.id ? { ...s, cues } : s) })))));
  } else {
    const hits = tab === 'hits';
    body.replaceChildren(
      ...(hits ? [el('p', { class: 'note', text: '히트는 최대 9개까지 버튼으로 바로 실행합니다. 대기 위치는 움직이지 않아요.' })] : []),
      cueListEditor(hits ? show.hits : show.cues, hits ? 9 : Infinity, cues => hits ? { ...current, hits: cues } : { ...current, cues }));
  }
}
function cueSummary(cue) {
  const parts = [TYPE_LABEL[cue.type], TRIGGER_LABEL[cue.trigger]];
  if (cue.delayMs > 0) parts.push(`지연 ${cue.delayMs}ms`);
  const all = [...current.cues, ...current.hits, ...current.inserts.flatMap(s => s.cues)];
  if (cue.type === 'AUDIO') parts.push(current.audioFiles.find(f => f.id === cue.audioFileId)?.displayName || '오디오 없음');
  else if (cue.target === 'ALL') parts.push('전체 재생');
  else { const t = all.find(c => c.id === cue.target); parts.push('대상 ' + (t ? `${t.number} ${t.name}` : '없음')); }
  if (cue.type === 'AUDIO' && cue.loop !== 'NONE') parts.push(cue.loop === 'COUNT' ? `${cue.loopCount}번 재생` : '무한 반복');
  return parts.join(' · ');
}
function cueListEditor(cues, limit, withCues) {
  const save = async next => { await saveShow(withCues(next)); renderEditor(); };
  const wrap = el('div', {});
  wrap.append(el('div', { class: 'actions' }, button('큐 추가', () => editCue(E.makeCue({ number: String(cues.length + 1) }), cues, save), 'btn primary')));
  if (cues.length >= limit) wrap.firstChild.firstChild.disabled = true;
  cues.forEach((cue, i) => wrap.append(el('div', { class: 'cue' },
    el('div', { class: 'cue-title' }, el('span', { class: 'no', text: cue.number }), cue.name),
    el('div', { class: 'cue-meta', text: cueSummary(cue) }),
    el('div', { class: 'actions' },
      button('편집', () => editCue(cue, cues, save), 'btn2 small'),
      button('삭제', () => confirmDelete('삭제 확인', `${cue.number} ${cue.name} 큐를 삭제할까요?`, () => save(cues.filter(c => c.id !== cue.id))), 'btn2 small danger'),
      Object.assign(button('위', () => { const n = [...cues]; n.splice(i - 1, 0, n.splice(i, 1)[0]); save(n); }, 'btn2 small'), { disabled: i === 0 }),
      Object.assign(button('아래', () => { const n = [...cues]; n.splice(i + 1, 0, n.splice(i, 1)[0]); save(n); }, 'btn2 small'), { disabled: i === cues.length - 1 })))));
  if (!cues.length) wrap.append(el('p', { class: 'note', text: '아직 큐가 없어요.' }));
  return wrap;
}
for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => { tab = b.dataset.tab; renderEditor(); });
$('backToList').addEventListener('click', () => { current = null; renderHome(); showScreen('home'); });
$('renameShow').addEventListener('click', () => askText('공연 이름', '이름', current.name, async name => { await saveShow({ ...current, name: name.trim() || '새 공연' }); renderEditor(); }));
$('exportShow').addEventListener('click', () => {
  try {
    const text = E.exportShowBackup(current);
    const link = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: `${current.name}.json` });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  } catch (error) { info('내보낼 수 없습니다', error.message); }
});
$('importAudio').addEventListener('click', () => $('audioFiles').click());
$('audioFiles').addEventListener('change', async () => {
  const files = [...$('audioFiles').files];
  $('audioFiles').value = '';
  if (!files.length || !current) return;
  const { show, assignments } = E.matchAudioFiles(current, files);
  try {
    for (const a of assignments) await store.saveAudio(a.id, a.file, a.file.name);
    await saveShow(show, { report: false });
    requestPersist();
    const matched = assignments.filter(a => a.matched).length;
    if (matched) info('오디오를 가져왔어요', `공연의 오디오 자리에 ${matched}개를 맞춰 넣었어요.` + (assignments.length - matched ? ` 새 오디오 ${assignments.length - matched}개를 추가했어요.` : ''));
  } catch (error) { info('오디오를 저장하지 못했어요', error?.message || '저장 공간을 확인해 주세요.'); }
  renderEditor();
});

// ---------- cue dialog ----------
function editCue(original, cues, save) {
  let cue = { ...original };
  const show = current;
  const all = [...show.cues, ...show.hits, ...show.inserts.flatMap(s => s.cues)];
  const ms = (label, key, extra = {}) => el('label', { class: 'field' }, el('span', { text: label }),
    el('input', { type: 'number', inputmode: 'numeric', min: 0, step: 1, value: cue[key] ?? '', 'data-key': key, ...extra }));
  const select = (label, key, options) => {
    const s = el('select', { 'data-key': key }, ...options.map(([value, text]) => el('option', { value, text })));
    s.value = cue[key];
    return el('label', { class: 'field' }, el('span', { text: label }), s);
  };
  const range = (label, key) => {
    const out = el('span', { text: `${label} ${Math.round(cue[key] * 100)}%` });
    const input = el('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(cue[key] * 100), 'data-key': key });
    input.addEventListener('input', () => { out.textContent = `${label} ${input.value}%`; });
    return el('label', { class: 'field' }, out, input);
  };
  const check = (label, key) => el('label', { class: 'check' }, el('input', { type: 'checkbox', 'data-key': key, checked: cue[key] }), el('span', { text: label }));
  function collect() {
    for (const input of $('cueFields').querySelectorAll('[data-key]')) {
      const key = input.dataset.key;
      if (input.type === 'checkbox') cue[key] = input.checked;
      else if (input.type === 'range') cue[key] = Number(input.value) / 100;
      else if (input.type === 'number') {
        if (key === 'endMs') cue.endMs = input.value === '' ? null : Math.max(0, Math.round(Number(input.value) || 0));
        else if (key === 'loopCount') cue.loopCount = Math.max(1, Math.round(Number(input.value) || 1));
        else cue[key] = Math.max(0, Math.round(Number(input.value) || 0));
      } else if (key !== 'type') cue[key] = input.value;
    }
  }
  function render() {
    const fields = [el('h3', { text: '기본 정보' }),
      el('label', { class: 'field' }, el('span', { text: '표시 번호' }), el('input', { value: cue.number, 'data-key': 'number', maxlength: 20 })),
      el('label', { class: 'field' }, el('span', { text: '이름' }), el('input', { value: cue.name, 'data-key': 'name', maxlength: 80 })),
      select('유형', 'type', E.CUE_TYPES.map(t => [t, TYPE_LABEL[t]])),
      select('트리거', 'trigger', E.TRIGGERS.map(t => [t, TRIGGER_LABEL[t]])),
      ms('지연 ms', 'delayMs'),
      el('h3', { text: '큐 동작' })];
    if (cue.type === 'AUDIO') {
      if (!show.audioFiles.length) fields.push(el('p', { class: 'note', text: '먼저 오디오를 가져오세요.' }));
      fields.push(select('오디오', 'audioFileId', [['', '선택'], ...show.audioFiles.map(f => [f.id, f.displayName])]),
        ms('시작 ms', 'startMs'), ms('종료 ms (빈칸은 끝까지)', 'endMs'),
        select('반복', 'loop', E.LOOP_MODES.map(t => [t, LOOP_LABEL[t]])));
      if (cue.loop === 'COUNT') fields.push(ms('총 재생 횟수', 'loopCount', { min: 1 }));
      fields.push(range('음량', 'volume'), ms('페이드 인 ms', 'fadeInMs'), ms('페이드 아웃 ms', 'fadeOutMs'));
    } else {
      const targets = cue.type === 'GOTO' ? cues : all.filter(c => c.type === 'AUDIO');
      const options = [...(cue.type === 'GOTO' ? [] : [['ALL', '전체 재생']]), ...targets.map(c => [c.id, `${c.number} ${c.name}`])];
      fields.push(select('대상', 'target', [['', '선택'], ...options]));
      if (cue.type === 'FADE') fields.push(range('목표 음량', 'targetVolume'), ms('시간 ms', 'durationMs'), check('완료 시 정지', 'stopAtEnd'));
      if (cue.type === 'STOP') fields.push(ms('정지 페이드 ms (0이어도 20ms로 부드럽게 멈춤)', 'fadeMs'));
      if (cue.type === 'GOTO') fields.push(check('이동한 큐 즉시 실행', 'runNow'));
    }
    $('cueFields').replaceChildren(el('div', { class: 'fields' }, ...fields));
    $('cueFields').querySelector('[data-key="type"]').addEventListener('change', event => { collect(); cue = E.changeCueType(cue, event.target.value, show, cues); render(); });
    $('cueFields').querySelector('[data-key="loop"]')?.addEventListener('change', () => { collect(); render(); });
    $('cueProblem').textContent = '';
  }
  function problem() {
    if (cue.type === 'AUDIO') {
      if (!show.audioFiles.some(f => f.id === cue.audioFileId)) return '오디오를 선택하세요.';
      if (cue.endMs !== null && cue.endMs <= cue.startMs) return '종료 ms는 시작 ms보다 커야 해요.';
    } else if (cue.type === 'GOTO') { if (!cues.some(c => c.id === cue.target)) return '이동할 큐를 선택하세요.'; }
    else if (!(cue.target === 'ALL' || all.some(c => c.type === 'AUDIO' && c.id === cue.target))) return '대상을 선택하세요.';
    return '';
  }
  $('cueSave').onclick = () => {
    collect();
    const message = problem();
    if (message) { $('cueProblem').textContent = message; return; }
    $('cueDialog').close();
    save(cues.some(c => c.id === cue.id) ? cues.map(c => c.id === cue.id ? cue : c) : [...cues, cue]);
  };
  $('cueCancel').onclick = () => $('cueDialog').close();
  render();
  openDialog($('cueDialog'));
}

// Ask the browser not to evict stored audio under storage pressure (iOS, low disk). Asked after an audio import.
async function requestPersist() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist(); } catch {}
}

// ---------- boot ----------
function bootKaname(keepAwake) {
(async () => {
  store = await openStore();
  await refresh();
  renderHome();
  showScreen('home');
  keepAwake();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
}

export { store, shows, current, saveShow, renderEditor, bootKaname };
