import * as E from './engine.mjs';
import { $, el, button } from './ui.mjs';
import { prefs } from './prefs.mjs';
import { timer } from './clock.mjs';
import { shows, current, saveShow, renderEditor } from './show.mjs';
import { runtime, keyGate, pointerGate, eventAge } from './playback.mjs';

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
