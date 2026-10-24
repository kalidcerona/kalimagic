import * as E from './engine.mjs';
import { WebAudioEngine } from './audio.mjs';
import { $, el, button, showScreen } from './ui.mjs';
import { prefs } from './prefs.mjs';
import { timer, gate } from './clock.mjs';
import { store, current, renderEditor } from './show.mjs';

const LONG_PRESS_KEY_MS = 1200; // In 'release' mode holding GO this long is PANIC (and no GO), as on Android.
const HOLD_MS = 700;

let ctx = null;       // the one shared AudioContext
let runtime = null;   // { show, engine, audio, decode, problems, bytes, resumed, notice, lastError }
let lastDevices = [];

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

export { ctx, runtime, perform, scheduleRender, keyGate, pointerGate, eventAge };
