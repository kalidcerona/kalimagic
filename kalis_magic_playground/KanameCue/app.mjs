// KANAME Cue web app: show editing, run screen, remote keys, output-loss handling and screen wake lock.
import * as E from './engine.mjs';
import { WebAudioEngine } from './audio.mjs';
import { openStore } from './store.mjs';

const $ = id => document.getElementById(id);
const TYPE_LABEL = { AUDIO: '오디오', FADE: '페이드', STOP: '정지', GOTO: '이동' };
const TRIGGER_LABEL = { MANUAL: '수동', WITH_PREVIOUS: '이전과 함께', AFTER_PREVIOUS: '이전 완료 후' };
const LOOP_LABEL = { NONE: '없음', COUNT: '횟수', INFINITE: '무한' };
const LONG_PRESS_KEY_MS = 1200; // In 'release' mode holding GO this long is PANIC (and no GO), as on Android.
const HOLD_MS = 700;

const prefs = (() => {
  const read = () => { try { return JSON.parse(localStorage.getItem('kc.prefs')) || {}; } catch { return {}; } };
  const value = { fadeCurve: 'linear', goTrigger: 'release', ...read() };
  return { get: key => value[key], set(key, v) { value[key] = v; try { localStorage.setItem('kc.prefs', JSON.stringify(value)); } catch {} } };
})();

let store = null;
let shows = [];
let audioIds = new Set();
let current = null;   // show open in the editor
let tab = 'main';
let ctx = null;       // the one shared AudioContext
let runtime = null;   // { show, engine, audio, decode, problems, bytes, resumed, notice, lastError }
const timer = new E.GoTimer(() => performance.now());
const gate = new E.OutputLossGate(() => performance.now());
let lastDevices = [];

// ---------- helpers ----------
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}
const button = (text, onclick, cls = 'btn2') => el('button', { type: 'button', class: cls, text, onclick });
function showScreen(name) {
  for (const id of ['home', 'editor', 'run']) $(id).hidden = id !== name;
  window.scrollTo(0, 0);
}
function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function info(title, text) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text;
  $('confirmOk').hidden = true; $('confirmCancel').textContent = '확인';
  openDialog($('confirmDialog'));
}
function confirmDelete(title, text, action) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text;
  $('confirmOk').hidden = false; $('confirmCancel').textContent = '취소';
  $('confirmOk').onclick = () => { $('confirmDialog').close(); action(); };
  openDialog($('confirmDialog'));
}
function askText(title, label, value, action) {
  $('textTitle').textContent = title; $('textLabel').textContent = label; $('textInput').value = value;
  $('textOk').onclick = () => { $('textDialog').close(); action($('textInput').value); };
  openDialog($('textDialog'));
  $('textInput').focus();
}
$('confirmCancel').addEventListener('click', () => $('confirmDialog').close());
$('textCancel').addEventListener('click', () => $('textDialog').close());
$('textInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $('textOk').click(); } });

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

// ---------- audio context ----------
function ensureContext() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx({ latencyHint: 'interactive' });
    ctx.addEventListener('statechange', () => {
      const decision = E.contextDecision(ctx.state, runtime?.audio.selfSuspended);
      if (decision === 'LOST') outputLost('lost');
      scheduleRender();
    });
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  }
  if (ctx.state !== 'running' && !runtime?.engine.paused) {
    if (runtime) runtime.audio.selfSuspended = false;
    ctx.resume().catch(() => {});
  }
  return ctx;
}
// Ask the browser not to evict stored audio under storage pressure (iOS, low disk). Asked after an audio import.
async function requestPersist() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist(); } catch {}
}
async function snapshotDevices() {
  try { return await navigator.mediaDevices.enumerateDevices(); } catch { return []; }
}
if (navigator.mediaDevices?.addEventListener) {
  snapshotDevices().then(list => { lastDevices = list; });
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    const next = await snapshotDevices();
    const change = E.classifyOutputs(lastDevices, next);
    lastDevices = next;
    // An unreadable change pauses too (conservative), but says "changed" rather than "lost".
    if (change === 'LOST') outputLost('lost');
    else if (change === 'UNKNOWN') outputLost('changed');
  });
}
function outputLost(kind) {
  if (!runtime) return;
  if (!gate.accept()) return;
  const engine = runtime.engine;
  runtime.lossKind = kind;
  if (engine.outputLost()) runtime.notice = null;
  else if (engine.mode !== E.MODE.EDIT) runtime.notice = kind === 'changed' ? '출력 장치가 바뀌었어요. 소리가 나갈 곳을 확인하세요.' : '출력 장치가 끊겼어요. 연결을 확인하세요.';
  scheduleRender();
}

// ---------- run ----------
async function startShow(show) {
  ensureContext();
  const saved = await store.position(show.id);
  const audio = new WebAudioEngine(ctx, {
    curve: () => prefs.get('fadeCurve'),
    started: cue => { if (timer.started(cue.name, { outputLatency: ctx.outputLatency, baseLatency: ctx.baseLatency })) scheduleRender(); }
  });
  // Resume needs a check: iOS can refuse while an interruption lasts, and the cues must stay paused then.
  const resumeAll = audio.resumeAll.bind(audio);
  audio.resumeAll = () => resumeAll().then(() => setTimeout(() => {
    if (runtime?.audio === audio && ctx.state !== 'running' && runtime.engine.outputLost()) {
      runtime.notice = '아직 소리를 낼 수 없어요. 출력 장치와 다른 앱의 소리를 확인한 뒤 다시 재개하세요.';
      scheduleRender();
    }
  }, 400));
  const scheduler = { now: () => performance.now(), schedule(delay, action) { const id = setTimeout(action, delay); return { cancel: () => clearTimeout(id) }; } };
  runtime = { show, audio, engine: null, lossKind: 'lost', decode: { done: 0, total: 0, finished: false }, problems: [], bytes: 0, resumed: Boolean(saved), notice: null, lastError: null };
  const engine = new E.CueEngine(show, audio, scheduler, saved || undefined,
    snap => { store.savePosition(show.id, snap).catch(() => { if (runtime) runtime.lastError = '위치 저장 실패'; }); },
    event => {
      if (!runtime) return;
      if (event.type === 'Error') runtime.lastError = event.message;
      if (event.type === 'Rejected') { flash('rejected'); navigator.vibrate?.([0, 45, 65, 45]); }
      if (event.type === 'Accepted') { flash('fired'); navigator.vibrate?.(35); }
      scheduleRender();
    },
    scheduleRender);
  runtime.engine = engine;
  engine.setMode(E.MODE.RUN);
  setMediaSession(show);
  showScreen('run');
  render();
  const cues = [...show.cues, ...show.hits, ...show.inserts.flatMap(s => s.cues)].filter(c => c.type === 'AUDIO');
  const result = await audio.decodeAll(cues.map(c => c.audioFileId), async id => {
    const record = await store.audio(id);
    return record ? record.blob.arrayBuffer() : null;
  }, (done, total) => { if (runtime?.audio === audio) { runtime.decode = { done, total, finished: false }; scheduleRender(); } });
  if (runtime?.audio !== audio) return;
  runtime.decode.finished = true;
  runtime.bytes = result.bytes;
  runtime.problems = cues.filter(c => !audio.buffers.has(c.audioFileId)).map(c => `파일 확인 필요: ${c.number} ${c.name}`);
  scheduleRender();
}
function endShow() {
  if (!runtime) return;
  keyGate.reset(); pointerGate.reset();
  runtime.engine.setMode(E.MODE.EDIT);
  runtime.audio.release(); // 20 ms ramp per track, nodes released about 40 ms later
  runtime = null;
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  renderEditor();
  showScreen('editor');
}
function setMediaSession(show) {
  try { if ('mediaSession' in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: show.name, artist: 'KANAME Cue' }); } catch {}
}
function flash(cls) {
  const go = $('goBtn');
  go.classList.remove('fired', 'rejected');
  void go.offsetWidth;
  go.classList.add(cls);
  setTimeout(() => go.classList.remove(cls), 220);
}
function hint(text) { $('holdHint').textContent = text; clearTimeout(hint.t); hint.t = setTimeout(() => { $('holdHint').textContent = ''; }, 1800); }

function perform(action, eventAgeMs = 0) {
  if (!runtime) return;
  const engine = runtime.engine;
  if (action === 'GO') {
    if (!runtime.decode.finished && !engine.paused) { hint('오디오 준비 중이에요. 준비 완료가 뜨면 GO를 눌러 주세요.'); return; }
    ensureContext();
    const resuming = engine.paused;
    timer.start('GO', eventAgeMs);
    if (!engine.go() || resuming) timer.cancel(); // a resume-GO starts no new cue, so nothing to time
    runtime.resumed = false;
  } else if (action === 'BACK') engine.back();
  else if (action === 'PANIC') engine.panic();
  else if (action.startsWith('HIT:')) {
    if (!runtime.decode.finished) { hint('오디오 준비 중이에요.'); return; }
    ensureContext();
    timer.start('HIT', eventAgeMs);
    engine.hit(Number(action.slice(4)));
    if (timer.pending) timer.cancel();
  } else if (action.startsWith('INSERT:')) engine.insert(action.slice(7));
  scheduleRender();
}
const eventAge = event => {
  const age = performance.now() - (event?.timeStamp || performance.now());
  return age > 0 && age < 1000 ? age : 0;
};

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
function render() {
  if (!runtime) return;
  const { engine, show } = runtime;
  const runEl = $('run');
  const locked = engine.mode === E.MODE.LOCKED;
  runEl.classList.toggle('locked', locked);
  $('lockPanel').hidden = !locked;
  $('runList').textContent = engine.position.listId === 'main' ? '메인 목록' : '삽입: ' + (show.inserts.find(s => s.id === engine.position.listId)?.name || '');
  const cue = engine.standby();
  $('runStandby').textContent = (runtime.resumed ? '이어서: ' : '대기: ') + (cue ? `${cue.number} ${cue.name}` : '목록 끝');
  $('runNext').textContent = '다음: ' + (engine.next()?.name || '없음');
  const ready = $('runReady');
  const mb = (runtime.bytes / 1048576).toFixed(1);
  if (!runtime.decode.finished) { ready.textContent = `오디오 준비 중 ${runtime.decode.done}/${runtime.decode.total}`; ready.classList.remove('bad'); }
  else if (runtime.problems.length) { ready.textContent = runtime.problems.join('\n'); ready.classList.add('bad'); }
  else {
    ready.textContent = `준비 완료 · 오디오 ${mb}MB` + (runtime.bytes > E.DECODED_WARN_BYTES ? ' · 메모리를 많이 써요. 기기에서 멈추면 파일을 나눠 주세요.' : '');
    ready.classList.toggle('bad', runtime.bytes > E.DECODED_WARN_BYTES);
  }
  $('runPaused').hidden = !engine.paused;
  const changed = runtime.lossKind === 'changed';
  $('runPausedTitle').textContent = changed ? '출력 장치가 바뀌었어요' : '출력 장치가 끊겼어요';
  $('runPausedNote').textContent = (changed ? '끊긴 것인지 알 수 없어 안전하게 멈춰 두었어요. 소리가 나갈 곳을 확인하고 재개를 누르세요.' : '재생을 멈춰 두었어요. 연결을 확인하고 재개를 누르세요.') + (engine.droppedOnLoss > 0 ? ` (예약된 큐 ${engine.droppedOnLoss}개는 취소됨)` : '');
  $('runNotice').hidden = !runtime.notice;
  $('runNoticeText').textContent = runtime.notice || '';
  $('runError').hidden = !runtime.lastError;
  $('runError').textContent = runtime.lastError || '';
  const hits = show.hits.slice(0, 9);
  if ($('hitGrid').childElementCount !== hits.length) {
    $('hitGrid').replaceChildren(...hits.map((hit, i) => {
      const b = el('button', { type: 'button' }, el('b', { text: `히트 ${i + 1}` }), hit.name);
      b.addEventListener('pointerdown', event => { if (event.isPrimary) { event.preventDefault(); perform('HIT:' + i, eventAge(event)); } });
      return b;
    }));
  }
  const inserts = show.inserts.filter(s => s.cues.length);
  if ($('insertRow').childElementCount !== inserts.length) $('insertRow').replaceChildren(...inserts.map(s => button('삽입: ' + s.name, () => perform('INSERT:' + s.id))));
  $('pendingLine').textContent = `예약된 큐: ${engine.pendingCount}`;
  const status = runtime.audio.status();
  $('activeList').replaceChildren(...[...engine.active.values()].map(active => {
    const s = status.get(active.id);
    const remaining = s?.remainingMs === null || s === undefined ? '알 수 없음' : Math.floor(s.remainingMs / 1000);
    return el('div', { class: 'card' }, el('strong', { text: `${active.number} ${active.name}` }),
      el('span', { class: 'muted num', text: `경과 ${Math.floor((s?.elapsedMs || 0) / 1000)}초  남음 ${remaining}${typeof remaining === 'number' ? '초' : ''}${s?.fading ? '  페이드 중' : ''}` }));
  }));
  $('timingLine').textContent = timer.last ? '마지막 소리 시작까지: ' + E.describeTiming(timer.last) : '';
}
setInterval(() => { if (runtime && !document.hidden && runtime.engine.active.size) scheduleRender(); }, 250);

let starting = false;
$('startShow').addEventListener('click', () => {
  if (!current || runtime || starting) return; // a double tap must not create a second runtime
  starting = true;
  startShow(current).finally(() => { starting = false; });
});
// GO timing follows the per-device setting: on release (default, Android parity) or on press (faster).
const timeouts = { now: () => performance.now(), schedule(delay, action) { const id = setTimeout(action, delay); return { cancel: () => clearTimeout(id) }; } };
const fireGate = (action, info) => perform(action, info?.age ?? 0);
const keyGate = new E.PressGate(timeouts, fireGate, LONG_PRESS_KEY_MS);
const pointerGate = new E.PressGate(timeouts, fireGate, LONG_PRESS_KEY_MS);
$('goBtn').addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button > 0) return;
  event.preventDefault();
  try { $('goBtn').setPointerCapture(event.pointerId); } catch {}
  pointerGate.down('pointer', 'GO', prefs.get('goTrigger'), { age: eventAge(event) });
});
$('goBtn').addEventListener('pointerup', event => { if (event.isPrimary) pointerGate.up('pointer', { age: eventAge(event) }); });
$('goBtn').addEventListener('pointercancel', () => pointerGate.reset());
$('goBtn').addEventListener('contextmenu', event => event.preventDefault());
$('backBtn').addEventListener('click', () => perform('BACK'));
$('resumeBtn').addEventListener('click', () => { if (runtime) { ensureContext(); runtime.engine.resume(); render(); } });
$('noticeOk').addEventListener('click', () => { if (runtime) { runtime.notice = null; render(); } });
$('lockBtn').addEventListener('click', () => { runtime?.engine.setMode(E.MODE.LOCKED); });
function holdButton(node, label, action) {
  let t = null;
  node.style.setProperty('--hold-ms', HOLD_MS + 'ms');
  const cancel = () => { clearTimeout(t); t = null; node.classList.remove('holding'); };
  node.addEventListener('pointerdown', event => {
    if (!event.isPrimary) return;
    event.preventDefault();
    node.classList.add('holding');
    t = setTimeout(() => { cancel(); action(); }, HOLD_MS);
  });
  node.addEventListener('pointerup', () => { if (t) hint(label); cancel(); });
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('contextmenu', event => event.preventDefault());
}
holdButton($('panicBtn'), '길게 누르면 전체 정지합니다.', () => { perform('PANIC'); navigator.vibrate?.(60); });
holdButton($('exitBtn'), '길게 누르면 공연을 끝냅니다.', endShow);
holdButton($('unlockBtn'), '길게 누르면 잠금이 풀립니다.', () => runtime?.engine.setMode(E.MODE.RUN));

// ---------- keys: Bluetooth clickers and footswitches send ordinary key events ----------
let learning = null;
document.addEventListener('keydown', event => {
  const code = E.androidKeyCode(event);
  if (learning) {
    if (event.key === 'Tab') return;
    event.preventDefault();
    if (code === null) { learning.fail('이 키는 저장할 수 없어요. 다른 버튼을 눌러 주세요.'); return; }
    if (E.VOLUME_KEYS.includes(code)) { learning.fail('볼륨 키는 사용하지 않습니다.'); return; }
    learning.done(code);
    return;
  }
  if (!runtime || runtime.engine.mode === E.MODE.EDIT) return;
  if (document.activeElement?.matches?.('input, select, textarea') || $('cueDialog').open || $('textDialog').open) return;
  const action = E.keyAction(runtime.show, code);
  if (!action) return;
  event.preventDefault();
  // A focused button would otherwise also click on keyup in some browsers (Firefox Space).
  if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
  if (event.repeat) return;
  keyGate.down(code, action, prefs.get('goTrigger'), { age: eventAge(event) });
});
document.addEventListener('keyup', event => {
  const code = E.androidKeyCode(event);
  if (keyGate.held && keyGate.held.key === code) { event.preventDefault(); keyGate.up(code, { age: eventAge(event) }); }
});
window.addEventListener('blur', () => { keyGate.reset(); pointerGate.reset(); });

// ---------- settings (house gesture: two fingers swipe down in the visible direction) ----------
let swipe = null;
document.addEventListener('touchstart', event => {
  if (event.touches.length !== 2) { swipe = null; return; }
  // In run mode a GO, HIT or hold button under a finger keeps its own meaning.
  if ([...event.touches].some(t => t.target.closest?.('.go, .hits button, .hold'))) { swipe = null; return; }
  swipe = new Map([...event.touches].map(t => [t.identifier, { x: t.clientX, y: t.clientY, dx: 0, dy: 0 }]));
}, { passive: true });
document.addEventListener('touchmove', event => {
  if (!swipe || event.touches.length !== 2) return;
  for (const t of event.touches) {
    const r = swipe.get(t.identifier);
    if (!r) { swipe = null; return; }
    r.dx = t.clientX - r.x; r.dy = t.clientY - r.y;
  }
  if ([...swipe.values()].every(r => r.dy > 8)) event.preventDefault();
}, { passive: false });
document.addEventListener('touchend', () => {
  if (!swipe) return;
  const moves = [...swipe.values()];
  swipe = null;
  if (moves.length === 2 && moves.every(r => r.dy > 60 && Math.abs(r.dx) < r.dy)) openSettings();
}, { passive: true });
document.addEventListener('touchcancel', () => { swipe = null; }, { passive: true });

let settingsShowId = null;
function openSettings() {
  if ($('settings').open) return;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  renderSettings();
  $('settings').showModal();
}
function renderSettings() {
  $('fadeCurve').value = prefs.get('fadeCurve');
  $('goTrigger').value = prefs.get('goTrigger');
  $('persistNote').textContent = '';
  navigator.storage?.persisted?.().then(on => { $('persistNote').textContent = '저장 공간 보호: ' + (on ? '켜짐' : '꺼짐'); }).catch(() => {});
  $('timingHistory').replaceChildren(...timer.history.slice().reverse().map(entry => el('li', { text: E.describeTiming(entry) + ' · ' + entry.cue })));
  if (!timer.history.length) $('timingHistory').replaceChildren(el('li', { class: 'note', text: '아직 기록이 없어요.' }));
  const box = $('perShow');
  if (runtime) {
    box.replaceChildren(el('p', { class: 'note', text: '공연 중에는 공연별 설정을 바꿀 수 없어요. 공연을 끝낸 뒤 바꿔 주세요.' }), keySummary(runtime.show));
    return;
  }
  const target = shows.find(s => s.id === settingsShowId) || (current && shows.find(s => s.id === current.id)) || shows[0];
  if (!target) { box.replaceChildren(el('p', { class: 'note', text: '공연을 만든 뒤 리모컨 버튼과 실행 설정을 정하세요.' })); return; }
  const chooser = el('select', {}, ...shows.map(s => el('option', { value: s.id, text: s.name })));
  chooser.value = target.id;
  chooser.addEventListener('change', () => { settingsShowId = chooser.value; renderSettings(); });
  const saveSettings = async updated => {
    const saved = await saveShow(updated, { report: false });
    settingsShowId = saved.id;
    renderSettings();
    if (current && !$('editor').hidden) renderEditor();
  };
  const number = (label, key) => {
    const input = el('input', { type: 'number', inputmode: 'numeric', min: 0, step: 1, value: target.settings[key] });
    input.addEventListener('change', () => {
      const value = Math.round(Number(input.value));
      if (Number.isFinite(value) && value >= 0) saveSettings({ ...target, settings: { ...target.settings, [key]: value } });
    });
    return el('label', { class: 'field' }, el('span', { text: label }), input);
  };
  box.replaceChildren(
    el('label', { class: 'field' }, el('span', { text: '공연' }), chooser),
    el('h3', { text: '리모컨 버튼' }),
    el('p', { class: 'note', text: '동작을 누른 다음 리모컨이나 키보드 버튼을 누르세요. 볼륨 키는 사용하지 않습니다. 연결하지 않은 키는 기본 키를 따릅니다.' }),
    keyEditor(target, saveSettings),
    el('h3', { text: '실행 설정' }),
    number('GO 중복 방지 ms', 'debounceMs'),
    number('전체 정지 페이드 ms', 'panicFadeMs'));
}
function keyActions(show) {
  return [['GO', 'GO'], ['BACK', '이전'], ['PANIC', '전체 정지'],
    ...show.hits.slice(0, 9).map((_, i) => ['HIT:' + i, `히트 ${i + 1}`]),
    ...show.inserts.filter(s => s.cues.length).map(s => ['INSERT:' + s.id, '삽입 ' + s.name])];
}
const DEFAULT_KEYS = { GO: '스페이스, 엔터, PageDown, 오른쪽, 아래 방향키', BACK: 'PageUp, 왼쪽, 위 방향키', PANIC: 'Esc, GO 키 길게 (뗄 때 방식)' };
function keySummary(show) {
  return el('ul', { class: 'plain small' }, ...keyActions(show).map(([action, label]) => {
    const keys = Object.entries(show.keyMap).filter(([, a]) => a === action).map(([k]) => E.keyLabel(Number(k)));
    return el('li', { text: `${label}: ${keys.join(', ') || DEFAULT_KEYS[action] || '없음'}` });
  }));
}
function keyEditor(show, save) {
  const wrap = el('div', {});
  for (const [action, label] of keyActions(show)) {
    const keys = Object.entries(show.keyMap).filter(([, a]) => a === action).map(([k]) => E.keyLabel(Number(k)));
    const status = el('span', { class: 'keys', text: keys.join(', ') || (DEFAULT_KEYS[action] ? '기본: ' + DEFAULT_KEYS[action] : '없음') });
    const learn = button('버튼 연결', () => {
      if (learning) learning.cancel();
      learn.setAttribute('aria-pressed', 'true');
      status.textContent = '버튼 입력 대기 중';
      learning = {
        done: code => { learning = null; save({ ...show, keyMap: { ...show.keyMap, [String(code)]: action } }); },
        fail: message => { status.textContent = message; },
        cancel: () => { learning = null; learn.setAttribute('aria-pressed', 'false'); status.textContent = keys.join(', ') || '없음'; }
      };
    }, 'btn2 small');
    wrap.append(el('div', { class: 'keyrow' }, el('div', {}, el('strong', { text: label }), el('br'), status), learn));
  }
  wrap.append(el('div', { class: 'actions' }, button('기본 키로 초기화', () => save({ ...show, keyMap: {} }))));
  return wrap;
}
$('openSettings').addEventListener('click', openSettings);
$('editorSettings').addEventListener('click', () => { settingsShowId = current?.id || null; openSettings(); });
$('closeSettings').addEventListener('click', () => $('settings').close());
$('settings').addEventListener('close', () => { if (learning) learning.cancel(); });
$('fadeCurve').addEventListener('change', () => prefs.set('fadeCurve', $('fadeCurve').value));
$('goTrigger').addEventListener('change', () => { keyGate.reset(); pointerGate.reset(); prefs.set('goTrigger', $('goTrigger').value); });
function copyContactId(node) {
  const text = 'KaliDCerona';
  const finish = ok => { node.textContent = ok ? '복사됨' : 'ID 복사'; if (ok) setTimeout(() => { if (node.textContent === '복사됨') node.textContent = 'ID 복사'; }, 1500); };
  const fallback = () => { try { const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.left = '-999px'; document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok; } catch { return false; } };
  const clip = navigator.clipboard;
  if (clip && typeof clip.writeText === 'function') { clip.writeText(text).then(() => finish(true), () => finish(fallback())); return; }
  finish(fallback());
}
$('contact-copy').addEventListener('click', () => copyContactId($('contact-copy')));

// ---------- screen wake lock (standing rule: the screen stays on while the app is visible) ----------
let wakeLock = null, wakePending = false;
async function keepAwake() {
  if (document.visibilityState !== 'visible' || wakeLock || wakePending || !navigator.wakeLock) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    wakePending = false;
    if (document.visibilityState !== 'visible') { lock.release().catch(() => {}); return; }
    wakeLock = lock;
    // The system may drop the lock while the page stays visible (battery saver); ask again then.
    lock.addEventListener?.('release', () => { if (wakeLock === lock) { wakeLock = null; if (document.visibilityState === 'visible') keepAwake(); } });
  } catch { wakePending = false; }
}
document.addEventListener('visibilitychange', () => {
  // Hiding the page never stops the show (web stand-in for the Android focus policy).
  if (document.visibilityState === 'visible') { keepAwake(); scheduleRender(); }
  else if (wakeLock) { const lock = wakeLock; wakeLock = null; lock.release().catch(() => {}); }
});

// ---------- boot ----------
// Inspection hook for headless checks only.
if (new URLSearchParams(location.search).get('debug') === '1') window.__kaname = { get ctx() { return ctx; }, get runtime() { return runtime; }, timer, perform };
(async () => {
  store = await openStore();
  await refresh();
  renderHome();
  showScreen('home');
  keepAwake();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
