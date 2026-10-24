const $ = id => document.getElementById(id);
const TYPE_LABEL = { AUDIO: '오디오', FADE: '페이드', STOP: '정지', GOTO: '이동' };
const TRIGGER_LABEL = { MANUAL: '수동', WITH_PREVIOUS: '이전과 함께', AFTER_PREVIOUS: '이전 완료 후' };
const LOOP_LABEL = { NONE: '없음', COUNT: '횟수', INFINITE: '무한' };

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

export {
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
};
