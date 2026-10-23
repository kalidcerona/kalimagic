// Fast picker and collapsed editor (web version of the Android PresetScreen).
import * as C from './core.mjs';

const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const todayIso = () => { const d = new Date(); return C.isoDate({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }); };

function bigRow(title, sub, onClick, selected = false) {
  return h('button', { type: 'button', class: 'bigrow' + (selected ? ' on' : ''), onclick: onClick },
    h('b', { text: title.trim() ? title : '이름 없음' }), sub ? h('small', { text: sub }) : null);
}

// ---------- picker ----------

export function createPicker(root, store) {
  const ui = { selectedId: null, digits: '', cardText: '', templateEntry: {}, values: {}, error: '' };

  function render() {
    const cats = store.cats;
    if (!cats.some((c) => c.id === ui.selectedId)) ui.selectedId = store.armed?.categoryId && cats.some((c) => c.id === store.armed.categoryId) ? store.armed.categoryId : cats[0]?.id ?? null;
    const cat = cats.find((c) => c.id === ui.selectedId) || null;
    const mode = C.shownMode(store.armed, store.armMode);

    const armedResolved = (c, r, input) => {
      if (!r.ok) { ui.error = r.reason; render(); return; }
      ui.error = '';
      const [state, recent] = C.armResolved(c, r, input, mode);
      store.arm(state, recent);
    };

    root.replaceChildren(...[
      h('h3', { text: '프리셋' }),
      h('div', { class: 'armedline' },
        h('p', { id: 'armedText', text: '지금: ' + C.describe(store.armed, cats) }),
        store.armed ? h('button', { type: 'button', class: 'textbtn', onclick: () => store.disarm() }, '해제') : null),
      h('div', { class: 'chiprow' },
        h('button', { type: 'button', class: 'fchip' + (mode === 'ONCE' ? ' on' : ''), 'aria-pressed': String(mode === 'ONCE'), onclick: () => store.setArmMode('ONCE') }, '다음 한 번만'),
        h('button', { type: 'button', class: 'fchip' + (mode === 'ALWAYS' ? ' on' : ''), 'aria-pressed': String(mode === 'ALWAYS'), onclick: () => store.setArmMode('ALWAYS') }, '계속 유지')),
      store.recents.length ? h('p', { class: 'label', text: '최근' }) : null,
      store.recents.length ? h('div', { class: 'chiprow' }, store.recents.map((r) => h('button', {
        type: 'button', class: 'recentbtn', onclick: () => {
          const state = C.armFromRecent(r, cats, mode);
          if (!state) { ui.error = '이 최근 항목은 더 이상 쓸 수 없습니다'; render(); } else store.arm(state, r);
        }
      }, r.label))) : null,
      h('div', { class: 'chiprow', role: 'tablist', 'aria-label': '묶음' }, cats.map((c) => h('button', {
        type: 'button', role: 'tab', class: 'fchip' + (c.id === cat?.id ? ' on' : ''), 'aria-selected': String(c.id === cat?.id),
        onclick: () => { ui.selectedId = c.id; ui.error = ''; render(); }
      }, c.name.trim() ? c.name : '이름 없음'))),
      h('p', { class: 'error', role: 'alert', text: ui.error }),
      ...body(cat, armedResolved)
    ].filter(Boolean));
  }

  function body(cat, armedResolved) {
    if (!cat) return [h('p', { class: 'note', text: '프리셋이 없습니다. 아래 편집에서 추가하세요' })];
    const submit = (entry, input) => armedResolved(cat, C.resolve(cat, entry, input), input);
    switch (cat.inputKind) {
      case 'NONE':
        return cat.entries.map((e) => bigRow(e.label, e.url, () => submit(e, null)));
      case 'SEQUENCE': {
        const arm = (i) => {
          const state = C.armSequence(cat, i);
          if (!state) { ui.error = '항목이 없습니다'; render(); return; }
          store.arm(state, C.recentOfSequence(cat));
        };
        return [bigRow('처음부터 순서대로', `${cat.entries.length}개, 찍을 때마다 다음 주소`, () => arm(0)),
          ...cat.entries.map((e, i) => bigRow(`${i + 1}. ${e.label}`, '여기부터 시작', () => arm(i)))];
      }
      case 'NUMBER': {
        const display = h('p', { class: 'digits' + (ui.digits ? '' : ' empty'), text: ui.digits || '번호를 누르세요' });
        const press = (k) => {
          if (k === '지움') ui.digits = ui.digits.slice(0, -1);
          else if (k === '확인') { submit(null, ui.digits); return; }
          else if (ui.digits.length < 9) ui.digits += k;
          display.textContent = ui.digits || '번호를 누르세요';
          display.className = 'digits' + (ui.digits ? '' : ' empty');
        };
        return [display,
          h('div', { class: 'keypad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '확인'].map((k) =>
            h('button', { type: 'button', class: k === '확인' ? 'ok' : null, onclick: () => press(k) }, k))),
          ...cat.entries.filter((e) => e.code.trim()).map((e) => bigRow(`${e.code}. ${e.label}`, e.url, () => submit(e, null)))];
      }
      case 'CARD': {
        const input = h('input', { type: 'text', value: ui.cardText, autocomplete: 'off', autocapitalize: 'characters', enterkeyhint: 'done', spellcheck: 'false', oninput: (ev) => { ui.cardText = ev.target.value; }, onkeydown: (ev) => { if (ev.key === 'Enter') submit(null, ui.cardText); } });
        const grid = [];
        for (const rank of C.RANKS) for (const suit of C.SUITS) {
          grid.push(h('button', { type: 'button', class: suit === 'H' || suit === 'D' ? 'red' : null, onclick: () => submit(null, rank + suit) }, rank + C.suitSymbol(suit)));
        }
        return [h('div', { class: 'inline' }, h('label', { class: 'field' }, '번호로 입력 (예: QH, 121)', input), h('button', { type: 'button', class: 'btn primary', onclick: () => submit(null, ui.cardText) }, '확인')),
          h('div', { class: 'cardgrid' }, grid)];
      }
      case 'TEXT':
      case 'DATE': {
        const isDate = cat.inputKind === 'DATE';
        const chosenId = ui.templateEntry[cat.id];
        const e = cat.entries.find((x) => x.id === chosenId) || cat.entries[0] || null;
        if (ui.values[cat.id] === undefined) ui.values[cat.id] = isDate ? todayIso() : '';
        const field = h('input', { type: 'text', value: ui.values[cat.id], inputmode: isDate ? 'numeric' : 'text', enterkeyhint: 'done', autocomplete: 'off', spellcheck: 'false',
          oninput: (ev) => { ui.values[cat.id] = ev.target.value; }, onkeydown: (ev) => { if (ev.key === 'Enter') submit(e, ui.values[cat.id]); } });
        const out = [];
        if (cat.entries.length > 1) out.push(...cat.entries.map((x) => bigRow(x.label, x.url, () => { ui.templateEntry[cat.id] = x.id; render(); }, x.id === e?.id)));
        else if (e) out.push(h('p', { class: 'label', text: e.label }));
        out.push(h('label', { class: 'field' }, isDate ? '날짜 (예: 2026-10-23)' : '글자', field));
        if (isDate) {
          const set = (v) => { ui.values[cat.id] = v; field.value = v; };
          const native = h('input', { type: 'date', 'aria-label': '달력에서 고르기', onchange: (ev) => { if (ev.target.value) set(ev.target.value); } });
          out.push(h('div', { class: 'daterow' },
            h('button', { type: 'button', class: 'btn2', onclick: () => set(todayIso()) }, '오늘'),
            h('span', { class: 'btn2 datepick', style: 'display:inline-flex;align-items:center' }, '달력에서 고르기', native)));
        }
        out.push(h('button', { type: 'button', class: 'btn primary go', onclick: () => submit(e, ui.values[cat.id]) }, '준비하고 카메라로'));
        return out;
      }
      default:
        return [];
    }
  }

  return { render, reset() { ui.error = ''; ui.digits = ''; } };
}

// ---------- editor ----------

export function createEditor(details, root, store) {
  let draft = clone(store.cats);
  const open = new Set();
  const same = () => JSON.stringify(draft) === JSON.stringify(store.cats);

  function problems() {
    return draft.reduce((n, c) => n + c.entries.filter((e) => C.validateEntry(c.inputKind, e) !== null).length, 0);
  }
  const footer = { line: null, save: null, revert: null };
  function refreshFooter() {
    const p = problems();
    footer.line.textContent = p > 0 ? `확인이 필요한 항목 ${p}개. 그 항목은 찍어도 아무것도 열리지 않습니다` : '';
    footer.save.disabled = same();
    footer.revert.disabled = same();
  }

  function moved(list, i, d) {
    const to = i + d;
    if (to < 0 || to >= list.length) return list;
    const copy = list.slice();
    const [x] = copy.splice(i, 1);
    copy.splice(to, 0, x);
    return copy;
  }

  function render() {
    footer.line = h('p', { class: 'error', role: 'status' });
    footer.save = h('button', { type: 'button', class: 'btn primary', onclick: () => { store.saveCategories(clone(draft)); store.toast('저장했습니다'); render(); } }, '저장');
    footer.revert = h('button', { type: 'button', class: 'btn2', onclick: () => { draft = clone(store.cats); render(); } }, '되돌리기');
    root.replaceChildren(
      h('div', { class: 'ed-actions' },
        h('button', { type: 'button', class: 'btn2', onclick: () => store.exportPresets() }, '프리셋 내보내기'),
        h('button', { type: 'button', class: 'btn2', onclick: () => store.importPresets() }, '프리셋 가져오기')),
      ...draft.map((c, i) => categoryEditor(c, i)),
      h('button', { type: 'button', class: 'btn2', style: 'width:100%;margin-top:8px', onclick: () => { draft.push(C.category(C.newId(), '새 묶음', 'NONE', [])); render(); } }, '묶음 추가'),
      footer.line,
      h('div', { class: 'ed-actions' }, footer.save, footer.revert)
    );
    refreshFooter();
  }

  function categoryEditor(cat, index) {
    const expanded = open.has(cat.id);
    const title = h('span', { class: 'title' });
    const setTitle = () => { title.textContent = `${cat.name.trim() ? cat.name : '이름 없음'} (${C.KIND_NAME[cat.inputKind]}, ${cat.entries.length}개)`; };
    setTitle();
    const box = h('div', { class: 'ed-cat' },
      h('div', { class: 'ed-head' }, title,
        h('button', { type: 'button', class: 'textbtn', disabled: index === 0, onclick: () => { draft = moved(draft, index, -1); render(); } }, '위로'),
        h('button', { type: 'button', class: 'textbtn', disabled: index === draft.length - 1, onclick: () => { draft = moved(draft, index, 1); render(); } }, '아래로'),
        h('button', { type: 'button', class: 'textbtn', 'aria-expanded': String(expanded), onclick: () => { expanded ? open.delete(cat.id) : open.add(cat.id); render(); } }, expanded ? '닫기' : '열기')));
    if (!expanded) return box;
    box.append(
      h('label', { class: 'field' }, '묶음 이름', h('input', { type: 'text', value: cat.name, oninput: (ev) => { cat.name = ev.target.value; setTitle(); refreshFooter(); } })),
      h('div', { class: 'chiprow' }, C.INPUT_KINDS.map((k) => h('button', {
        type: 'button', class: 'fchip' + (cat.inputKind === k ? ' on' : ''), onclick: () => { cat.inputKind = k; render(); }
      }, C.KIND_NAME[k]))),
      h('p', { class: 'note help', text: C.KIND_HELP[cat.inputKind] }),
      ...cat.entries.map((e, i) => entryEditor(cat, e, i, setTitle)),
      h('div', { class: 'ed-row' },
        h('button', { type: 'button', class: 'btn2', onclick: () => { cat.entries.push(C.entry(C.newId(), '새 항목', 'https://')); render(); } }, '항목 추가'),
        h('button', { type: 'button', class: 'textbtn danger-text', onclick: async () => {
          const ok = await store.ask('묶음 지우기', `"${cat.name}" 묶음과 항목 ${cat.entries.length}개를 지울까요? 저장을 눌러야 적용됩니다.`, [['취소', false], ['지우기', true]]);
          if (ok) { draft = draft.filter((c) => c !== cat); render(); }
        } }, '묶음 지우기'))
    );
    return box;
  }

  function entryEditor(cat, e, i, setTitle) {
    const msg = h('p', { class: 'ed-msg' });
    const urlInput = h('input', { type: 'url', value: e.url, inputmode: 'url', autocomplete: 'off', spellcheck: 'false', oninput: (ev) => { e.url = ev.target.value; check(); } });
    const check = () => {
      const m = C.validateEntry(cat.inputKind, e);
      msg.textContent = m || '좋습니다';
      msg.className = 'ed-msg' + (m ? ' bad' : '');
      urlInput.classList.toggle('bad', Boolean(m));
      refreshFooter();
    };
    const withCode = cat.inputKind === 'NUMBER' || cat.inputKind === 'CARD';
    const box = h('div', { class: 'ed-entry' },
      h('label', { class: 'field' }, '이름', h('input', { type: 'text', value: e.label, oninput: (ev) => { e.label = ev.target.value; check(); } })),
      withCode ? h('label', { class: 'field' }, cat.inputKind === 'CARD' ? '카드 (예: QH, 10S, 121, 비우면 모든 카드)' : '번호 (비우면 모든 번호)',
        h('input', { type: 'text', value: e.code, autocomplete: 'off', oninput: (ev) => { e.code = ev.target.value; check(); } })) : null,
      h('label', { class: 'field' }, cat.inputKind === 'NONE' || cat.inputKind === 'SEQUENCE' ? '주소' : '주소 또는 틀', urlInput),
      msg,
      h('div', { class: 'ed-row' },
        h('button', { type: 'button', class: 'textbtn', disabled: i === 0, onclick: () => { cat.entries = moved(cat.entries, i, -1); render(); } }, '위로'),
        h('button', { type: 'button', class: 'textbtn', disabled: i === cat.entries.length - 1, onclick: () => { cat.entries = moved(cat.entries, i, 1); render(); } }, '아래로'),
        h('button', { type: 'button', class: 'textbtn danger-text', onclick: () => { cat.entries.splice(i, 1); setTitle(); render(); } }, '지우기')));
    queueMicrotask(check);
    return box;
  }

  details.addEventListener('toggle', () => { if (details.open) { draft = clone(store.cats); render(); } });
  return { render, reload() { draft = clone(store.cats); if (details.open) render(); } };
}
