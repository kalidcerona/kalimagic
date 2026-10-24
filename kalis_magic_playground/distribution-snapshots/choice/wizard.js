import { parseWizardItems, stripItemPrefixes, previewNote, WIZARD_MAX_ITEMS } from './logic.js';
import { currentView, wizard, showView, wzTitle, wzItems, wzSave } from './views.js';
import { store } from './controller.js';

const MAX_ITEM_CHARS = 120;

// Step 2 parses on each keystroke. Next must reuse that result instead of walking the lines again.
let wizardCountCache = null;

// Step bar: the current step is marked; earlier and already reached steps can be tapped to jump there.
function currentStep() { return currentView === 'w1' ? 1 : currentView === 'w2' ? 2 : 3; }

function markStep(step) {
  if (!wizard) return;
  const reached = Math.max(wizard.reached || 1, step);
  wizard.reached = reached;
  ['wz-steps1', 'wz-steps2', 'wz-steps3'].forEach((id) => {
    document.querySelectorAll(`#${id} .sv-stp`).forEach((button) => {
      const n = Number(button.dataset.step);
      button.classList.toggle('on', n <= reached);
      button.disabled = n > reached && n !== step;
      if (n === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
  });
}

function goWizardStep(target) {
  if (!wizard || wizard.mode !== 'new') return;
  const from = currentStep();
  if (target === from || target > (wizard.reached || 1)) return;
  if (target < from) {
    if (from === 3) commitItemEdits();
    showView(`w${target}`);
    markStep(target);
    return;
  }
  // Forward to a step that was already reached: the same checks as the Next buttons.
  if (from === 1) { wizardNext1(); if (currentView !== 'w2') return; }
  if (target === 3) wizardNext2();
}

// Items edited on step 3 are written back to the step 2 text, so both screens always agree.
function syncStep2() {
  if (!wizard) return;
  if (wizard.itemsDirty) {
    wzItems.value = wizard.items.join('\n');
    wizard.itemsDirty = false;
    wizard.strip = false;
  }
  renderWizardCount();
}

function duplicateNumbers(items) {
  const seen = new Map();
  items.forEach((item, index) => {
    const key = item.toLocaleLowerCase('ko-KR');
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(index + 1);
  });
  return [...seen.values()].filter((numbers) => numbers.length > 1);
}

// Existing items open as they are saved; only a new list strips "1. " / "- " from pasted lines. Editing a saved list offers "번호 지우기" instead.
function setItemsLabels() {
  const editing = Boolean(wizard) && wizard.mode === 'edit';
  document.getElementById('wz-title2').textContent = editing ? '항목 편집' : '새 목록 만들기';
  document.getElementById('wz-steps2').hidden = editing;
  document.getElementById('wz-q2').textContent = editing ? '항목을 고치거나 붙여 넣으세요' : '2. 항목을 붙여 넣으세요';
}

function renderWizardCount() {
  const stripPrefix = !wizard || wizard.strip !== false;
  const text = wzItems.value;
  if (wizardCountCache && wizardCountCache.text === text && wizardCountCache.stripPrefix === stripPrefix) return wizardCountCache.parsed;
  const parsed = parseWizardItems(text, { stripPrefix });
  document.getElementById('wz-strip').hidden = stripPrefix || stripItemPrefixes(text) === text;
  const count = document.getElementById('wz-count');
  count.replaceChildren();
  const strong = document.createElement('b');
  strong.textContent = `${parsed.count}개`;
  if (!parsed.ok) strong.className = 'bad';
  count.append(strong);
  const warnings = [];
  if (parsed.tooLongAt) warnings.push(`${parsed.tooLongAt}번 항목이 ${MAX_ITEM_CHARS}자를 넘습니다.`);
  else if (parsed.count > WIZARD_MAX_ITEMS) warnings.push(`노트에는 ${WIZARD_MAX_ITEMS}개까지만 나옵니다. 줄여 주세요.`);
  const dupes = duplicateNumbers(parsed.items);
  if (dupes.length) warnings.push(`같은 항목이 겹칩니다: ${dupes.slice(0, 3).map((numbers) => `${numbers.join('번, ')}번`).join(' / ')}${dupes.length > 3 ? ' 외' : ''}`);
  document.getElementById('wz-warnings').replaceChildren(...warnings.map((text) => { const li = document.createElement('li'); li.textContent = text; return li; }));
  document.getElementById('wz-next2').disabled = !parsed.ok;
  wizardCountCache = { text, stripPrefix, parsed };
  return parsed;
}

function wizardNext1() {
  if (!wizard) { showView('home'); return; }
  const title = wzTitle.value.trim();
  const message = document.getElementById('wz-message1');
  if (!title) { message.textContent = '목록 이름을 입력하세요.'; return; }
  if (Array.from(title).length > 40) { message.textContent = '목록 이름은 40자까지 입력할 수 있습니다.'; return; }
  if (store.presets.some((preset) => preset.name === title && preset.id !== wizard.id)) { message.textContent = '같은 이름의 목록이 있습니다. 다른 이름을 써 주세요.'; return; }
  message.textContent = '';
  wizard.title = title;
  showView('w2');
  markStep(2);
  wzItems.focus({ preventScroll: true });
}

function wizardNext2() {
  if (!wizard) { showView('home'); return; }
  const parsed = renderWizardCount();
  if (!parsed.ok) return;
  const previous = wizard.items[wizard.target];
  const nextItems = parsed.items;
  let unchanged = nextItems.length === wizard.items.length;
  if (unchanged) {
    for (let index = 0; index < nextItems.length; index += 1) {
      if (nextItems[index] !== wizard.items[index]) { unchanged = false; break; }
    }
  }
  // Copy so later edits do not rewrite the cached parse.
  wizard.items = nextItems.slice();
  // The prophecy item stays selected when the items are unchanged or its text is still in the list, otherwise it has to be picked again.
  if (!unchanged) wizard.target = previous != null ? parsed.items.indexOf(previous) : -1;
  wizard.number = Math.min(Math.max(wizard.number, 1), parsed.items.length);
  wizard.editing = false;
  showStep3();
}

function showStep3() {
  const quick = wizard.mode === 'builtin' || wizard.mode === 'edit-target';
  const plain = quick || wizard.mode === 'edit';
  document.getElementById('wz-steps3').hidden = plain;
  document.getElementById('wz-title3').textContent = quick ? '예언 항목 바꾸기' : (wizard.mode === 'new' ? '새 목록 만들기' : '항목 편집');
  document.getElementById('wz-q3').textContent = plain ? '예언 항목을 탭하세요' : '3. 예언 항목을 탭하세요';
  wzSave.textContent = wizard.mode === 'builtin' ? '이 목록 쓰기' : '목록 저장';
  document.getElementById('wz-message3').textContent = '';
  renderWizardStep3();
  showView('w3');
  markStep(3);
}

// Items can be fixed in place while the list is being made: text, order and removal, and the prophecy item follows its text.
function canEditItems() { return Boolean(wizard) && wizard.mode !== 'builtin'; }

function commitItemEdits() {
  if (!wizard || !wizard.editing) return;
  wizard.editing = false;
  const kept = [];
  let target = -1;
  wizard.items.forEach((text, index) => {
    const clean = text.trim();
    if (!clean) return;
    if (index === wizard.target) target = kept.length;
    kept.push(clean);
  });
  wizard.items = kept;
  wizard.target = target;
  wizard.number = Math.min(Math.max(wizard.number, 1), Math.max(kept.length, 1));
}

function moveItem(index, delta) {
  const to = index + delta;
  if (to < 0 || to >= wizard.items.length) return false;
  const items = wizard.items;
  [items[index], items[to]] = [items[to], items[index]];
  if (wizard.target === index) wizard.target = to;
  else if (wizard.target === to) wizard.target = index;
  wizard.itemsDirty = true;
  return true;
}

function removeItem(index) {
  wizard.items.splice(index, 1);
  if (wizard.target === index) wizard.target = -1;
  else if (wizard.target > index) wizard.target -= 1;
  wizard.number = Math.min(Math.max(wizard.number, 1), Math.max(wizard.items.length, 1));
  wizard.itemsDirty = true;
}

function renumberEditRows(box) {
  [...box.children].forEach((row, index) => {
    row.dataset.index = String(index);
    const n = row.querySelector('.n');
    if (n) n.textContent = String(index + 1);
    const input = row.querySelector('input');
    if (input) input.setAttribute('aria-label', `${index + 1}번 항목`);
    row.querySelectorAll('button').forEach((button) => {
      const act = button.dataset.act;
      const label = act === 'target' ? '예언 항목으로' : act === 'up' ? '위로' : act === 'down' ? '아래로' : '빼기';
      button.setAttribute('aria-label', `${index + 1}번 ${label}`);
      if (act === 'up') button.disabled = index === 0;
      if (act === 'down') button.disabled = index === wizard.items.length - 1;
      if (act === 'target') {
        const on = wizard.target === index;
        button.textContent = on ? '★' : '☆';
        button.setAttribute('aria-pressed', String(on));
      }
    });
  });
}

function chooseWizardTarget(index) {
  const previous = wizard.target;
  wizard.target = index;
  const box = document.getElementById('wz-picks');
  if (!box) { renderWizardStep3(); return; }
  if (wizard.editing) {
    const rows = [...box.children];
    if (rows.length !== wizard.items.length) { renderWizardStep3(); return; }
    [previous, index].forEach((at) => {
      const star = rows[at]?.querySelector('[data-act="target"]');
      if (!star) return;
      const on = at === index;
      star.textContent = on ? '★' : '☆';
      star.setAttribute('aria-pressed', String(on));
    });
    renderWizardMeta();
    return;
  }
  const picks = [...box.children];
  if (picks.length !== wizard.items.length) { renderWizardStep3(); return; }
  if (previous >= 0 && picks[previous]) picks[previous].setAttribute('aria-checked', 'false');
  if (picks[index]) picks[index].setAttribute('aria-checked', 'true');
  renderWizardPreview('wz-pv-title', 'wz-pv-lines', wizard.title, wizard.items, wizard.target, wizard.number);
  document.getElementById('wz-message3').textContent = wizard.items.length < 2 ? '항목은 2개 이상 필요해요.' : '';
  wzSave.disabled = wizard.target < 0 || wizard.items.length < 2 || wizard.items.length > WIZARD_MAX_ITEMS;
}

function shiftEditRow(index, delta) {
  const from = index;
  if (!moveItem(from, delta)) return;
  const to = from + delta;
  const box = document.getElementById('wz-picks');
  const rows = box ? [...box.children] : [];
  if (!wizard.editing || rows.length !== wizard.items.length) { renderWizardStep3(); return; }
  const row = rows[from];
  const anchor = rows[to];
  if (to > from) box.insertBefore(row, anchor.nextSibling);
  else box.insertBefore(row, anchor);
  renumberEditRows(box);
  renderWizardMeta();
  row.querySelector(`[data-act="${delta < 0 ? 'up' : 'down'}"]`)?.focus();
}

function deleteEditRow(index) {
  const box = document.getElementById('wz-picks');
  const rows = box ? [...box.children] : [];
  removeItem(index);
  const num = document.getElementById('wz-num');
  if (num) num.textContent = String(wizard.number);
  if (!wizard.editing || rows.length !== wizard.items.length + 1) { renderWizardStep3(); return; }
  const next = rows[index + 1] || rows[index - 1] || null;
  rows[index].remove();
  renumberEditRows(box);
  renderWizardMeta();
  (next?.querySelector('.sv-einput') || document.getElementById('wz-add'))?.focus();
}

let pickRowTemplate = null;
let editRowTemplate = null;

function pickRowTemplateNode() {
  if (pickRowTemplate) return pickRowTemplate;
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'sv-pick';
  pick.setAttribute('role', 'radio');
  const n = document.createElement('span'); n.className = 'n';
  const x = document.createElement('span'); x.className = 'x';
  const tag = document.createElement('span'); tag.className = 'tg'; tag.textContent = '예언';
  pick.append(n, x, tag);
  pickRowTemplate = pick;
  return pickRowTemplate;
}

function editRowTemplateNode() {
  if (editRowTemplate) return editRowTemplate;
  const row = document.createElement('div');
  row.className = 'sv-erow';
  const n = document.createElement('span'); n.className = 'n';
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'sv-einput'; input.maxLength = MAX_ITEM_CHARS; input.autocomplete = 'off';
  const button = (act, glyph) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sv-eb'; b.dataset.act = act; b.textContent = glyph;
    return b;
  };
  row.append(n, input, button('target', '☆'), button('up', '▲'), button('down', '▼'), button('del', '✕'));
  editRowTemplate = row;
  return editRowTemplate;
}

function wizardPickContext(target) {
  let act = null;
  let row = null;
  let node = target;
  while (node && node.id !== 'wz-picks') {
    if (node.nodeType === 1) {
      if (!act && node.dataset && node.dataset.act) act = node;
      if (!row && node.classList && (node.classList.contains('sv-pick') || node.classList.contains('sv-erow'))) row = node;
    }
    node = node.parentElement;
  }
  return { act, row };
}

function onWizardPicksClick(event) {
  if (!wizard) return;
  const { act, row } = wizardPickContext(event.target);
  if (!row) return;
  const index = Number(row.dataset.index);
  if (!Number.isInteger(index)) return;
  if (row.classList.contains('sv-pick')) { chooseWizardTarget(index); return; }
  if (!act) return;
  const action = act.dataset.act;
  if (action === 'target') chooseWizardTarget(index);
  else if (action === 'up') shiftEditRow(index, -1);
  else if (action === 'down') shiftEditRow(index, 1);
  else if (action === 'del') deleteEditRow(index);
}

function onWizardPicksInput(event) {
  if (!wizard || !wizard.editing) return;
  const input = event.target;
  if (!input || !input.classList || !input.classList.contains('sv-einput')) return;
  const at = Number(input.parentElement && input.parentElement.dataset.index);
  if (!Number.isInteger(at) || at < 0 || at >= wizard.items.length) return;
  wizard.items[at] = input.value;
  wizard.itemsDirty = true;
  renderWizardMeta();
}

function editRow(text, index) {
  const row = editRowTemplateNode().cloneNode(true);
  const number = index + 1;
  row.dataset.index = String(index);
  row.children[0].textContent = String(number);
  const input = row.children[1];
  input.value = text;
  input.setAttribute('aria-label', `${number}번 항목`);
  const star = row.children[2];
  const up = row.children[3];
  const down = row.children[4];
  const del = row.children[5];
  const on = wizard.target === index;
  star.textContent = on ? '★' : '☆';
  star.setAttribute('aria-pressed', String(on));
  star.setAttribute('aria-label', `${number}번 예언 항목으로`);
  up.disabled = index === 0;
  up.setAttribute('aria-label', `${number}번 위로`);
  down.disabled = index === wizard.items.length - 1;
  down.setAttribute('aria-label', `${number}번 아래로`);
  del.setAttribute('aria-label', `${number}번 빼기`);
  return row;
}

function pickRow(text, index, selected) {
  const pick = pickRowTemplateNode().cloneNode(true);
  pick.dataset.index = String(index);
  pick.setAttribute('aria-checked', String(selected));
  pick.children[0].textContent = String(index + 1);
  pick.children[1].textContent = text;
  return pick;
}

// Build every row off-document, then insert the fragment once. Clicks and typing are handled on the list.
function mountWizardRows(box, items, build) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < items.length; index += 1) fragment.appendChild(build(items[index], index));
  box.replaceChildren(fragment);
}

// Counts, the sample note and the save button follow the items, without redrawing the rows being typed in.
function renderWizardMeta() {
  const filled = wizard.items.filter((text) => text.trim());
  const targetText = wizard.target >= 0 ? wizard.items[wizard.target] : '';
  const targetOk = wizard.target >= 0 && targetText.trim();
  const tooFew = filled.length < 2;
  const tooMany = filled.length > WIZARD_MAX_ITEMS;
  document.getElementById('wz-pick-label').textContent = wizard.editing ? `항목 ${filled.length}개 고치는 중` : `항목 ${wizard.items.length}개 중 하나 고르기`;
  document.getElementById('wz-message3').textContent = tooFew ? '항목은 2개 이상 필요해요.' : tooMany ? `노트에는 ${WIZARD_MAX_ITEMS}개까지만 나옵니다. 줄여 주세요.` : '';
  wzSave.disabled = !targetOk || tooFew || tooMany;
  const previewTarget = targetOk ? wizard.items.slice(0, wizard.target).filter((text) => text.trim()).length : -1;
  renderWizardPreview('wz-pv-title', 'wz-pv-lines', wizard.title, wizard.editing ? filled : wizard.items, wizard.editing ? previewTarget : wizard.target, Math.min(Math.max(wizard.number, 1), Math.max(filled.length, 1)));
}

function renderWizardStep3() {
  const { items, target } = wizard;
  const editable = canEditItems();
  const toggle = document.getElementById('wz-edit-toggle');
  toggle.hidden = !editable;
  toggle.textContent = wizard.editing ? '고치기 끝' : '항목 고치기';
  toggle.setAttribute('aria-pressed', String(Boolean(wizard.editing)));
  document.getElementById('wz-edit-hint').hidden = !wizard.editing;
  document.getElementById('wz-add').hidden = !wizard.editing;
  const picksBox = document.getElementById('wz-picks');
  picksBox.classList.toggle('sv-edit', Boolean(wizard.editing));
  if (wizard.editing) {
    picksBox.removeAttribute('role');
    mountWizardRows(picksBox, items, editRow);
    document.getElementById('wz-num').textContent = String(wizard.number);
    renderWizardMeta();
    return;
  }
  picksBox.setAttribute('role', 'radiogroup');
  document.getElementById('wz-pick-label').textContent = `항목 ${items.length}개 중 하나 고르기`;
  mountWizardRows(picksBox, items, (text, index) => pickRow(text, index, index === target));
  renderWizardPreview('wz-pv-title', 'wz-pv-lines', wizard.title, items, target, wizard.number);
  document.getElementById('wz-num').textContent = String(wizard.number);
  document.getElementById('wz-message3').textContent = items.length < 2 ? '항목은 2개 이상 필요해요.' : '';
  wzSave.disabled = target < 0 || items.length < 2 || items.length > WIZARD_MAX_ITEMS;
}

function toggleItemEditing() {
  if (!wizard || !canEditItems()) return;
  if (wizard.editing) commitItemEdits(); else wizard.editing = true;
  renderWizardStep3();
}

function addItemRow() {
  if (!wizard || !wizard.editing || wizard.items.length >= WIZARD_MAX_ITEMS) return;
  wizard.items.push('');
  wizard.itemsDirty = true;
  renderWizardStep3();
  const rows = document.querySelectorAll('#wz-picks .sv-einput');
  rows[rows.length - 1]?.focus();
}

// A small note drawn from the list, the way the notes app will show it for a sample number.
function renderWizardPreview(titleId, linesId, title, items, target, number) {
  document.getElementById(titleId).textContent = title;
  const box = document.getElementById(linesId);
  const view = target >= 0 ? previewNote(items, target, number) : null;
  if (!view) { box.textContent = '예언 항목을 고르면 여기에 보여요.'; return; }
  box.replaceChildren(...view.lines.map((line) => {
    const row = document.createElement('div');
    row.className = line.hit ? 'sv-pv-l hit' : 'sv-pv-l';
    const n = document.createElement('span'); n.textContent = String(line.number);
    const t = document.createElement('span'); t.textContent = line.text;
    row.append(n, t);
    return row;
  }));
}

function stepWizardNumber(delta) {
  if (!wizard) return;
  wizard.number = Math.min(Math.max(1, wizard.number + delta), wizard.items.length);
  const num = document.getElementById('wz-num');
  if (num) num.textContent = String(wizard.number);
  if (wizard.editing) renderWizardMeta();
  else renderWizardPreview('wz-pv-title', 'wz-pv-lines', wizard.title, wizard.items, wizard.target, wizard.number);
}

export {
  markStep, goWizardStep, syncStep2, setItemsLabels, renderWizardCount, wizardNext1, wizardNext2,
  showStep3, commitItemEdits, onWizardPicksClick, onWizardPicksInput, renderWizardStep3,
  toggleItemEditing, addItemRow, renderWizardPreview, stepWizardNumber,
};
