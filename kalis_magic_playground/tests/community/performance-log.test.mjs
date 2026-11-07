import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PERFORMANCE_LOG_LIMIT as USOTSUKI_LIMIT,
  recordCompletedTest, readPerformanceLog as readUsotsuki, clearPerformanceLog as clearUsotsuki,
  formatPerformanceResult as formatUsotsuki, mountPerformanceLog as mountUsotsuki,
} from '../../zz7/performance-log.js';
import {
  PERFORMANCE_LOG_LIMIT as CHOICE_LIMIT,
  recordChoiceReveal, readPerformanceLog as readChoice, clearPerformanceLog as clearChoice,
  formatPerformanceResult as formatChoice, mountPerformanceLog as mountChoice,
} from '../../zz4/performance-log.js';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function memoryStorage(initial = null) {
  const store = new Map();
  if (initial != null) store.set('seed', initial);
  return {
    store,
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
}

function throwingStorage() {
  const boom = () => { throw new Error('storage unavailable'); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

test('USOTSUKI records a completed verdict newest first and caps the log at 100', () => {
  const storage = memoryStorage();
  recordCompletedTest({ verdict: 'LIE', theme: 'recorder-a' }, storage);
  recordCompletedTest({ verdict: 'TRUE', theme: 'green' }, storage);
  const entries = readUsotsuki(storage);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].verdict, 'TRUE');
  assert.equal(entries[0].theme, 'green');
  assert.equal(formatUsotsuki(entries[0]), '진실 판정 · 딥 그린 테이블');
  assert.equal(formatUsotsuki(entries[1]), '거짓 판정 · 강철 타자기');
  assert.ok(entries[0].at >= entries[1].at);
  for (let i = 0; i < USOTSUKI_LIMIT + 5; i += 1) recordCompletedTest({ verdict: i % 2 ? 'TRUE' : 'LIE', theme: 'wine' }, storage);
  const capped = readUsotsuki(storage);
  assert.equal(capped.length, 100);
  assert.equal(USOTSUKI_LIMIT, 100);
  assert.equal(capped[0].verdict, 'LIE');
  clearUsotsuki(storage);
  assert.deepEqual(readUsotsuki(storage), []);
});

test('CHOICE records each reveal newest first and caps the log at 100', () => {
  const storage = memoryStorage();
  recordChoiceReveal({ number: 4, list: '음식' }, storage);
  recordChoiceReveal({ number: 12, list: '영화 목록' }, storage);
  const entries = readChoice(storage);
  assert.equal(entries.length, 2);
  assert.deepEqual({ number: entries[0].number, list: entries[0].list }, { number: 12, list: '영화 목록' });
  assert.equal(formatChoice(entries[0]), '12번 · 영화 목록');
  assert.equal(formatChoice(entries[1]), '4번 · 음식');
  assert.ok(entries[0].at >= entries[1].at);
  for (let i = 0; i < CHOICE_LIMIT + 3; i += 1) recordChoiceReveal({ number: i + 1, list: `목록 ${i}` }, storage);
  const capped = readChoice(storage);
  assert.equal(capped.length, 100);
  assert.equal(capped[0].list, `목록 ${CHOICE_LIMIT + 2}`);
  assert.equal(capped.at(-1).list, `목록 ${3}`);
  clearChoice(storage);
  assert.deepEqual(readChoice(storage), []);
});

test('a throwing storage does not break the performance path', () => {
  const storage = throwingStorage();
  let stage = '';
  let revealed = '';
  assert.doesNotThrow(() => {
    stage = 'LIE';
    recordCompletedTest({ verdict: 'LIE', theme: 'recorder' }, storage);
    revealed = '12번 · 영화 목록';
    recordChoiceReveal({ number: 12, list: '영화 목록' }, storage);
    clearUsotsuki(storage);
    clearChoice(storage);
  });
  assert.equal(stage, 'LIE');
  assert.equal(revealed, '12번 · 영화 목록');
  assert.deepEqual(readUsotsuki(storage), []);
  assert.deepEqual(readChoice(storage), []);
});

test('the log is written only after the visible performance result', () => {
  const hold = read('zz7/controller-hold.js');
  const stageAt = hold.indexOf('setStage(result.verdict === "TRUE" ? "TRUE" : "LIE")');
  const soundAt = hold.indexOf('playVerdictSound(result.verdict)');
  const recordAt = hold.indexOf('recordCompletedTest({ verdict: result.verdict, theme: performanceScreen?.dataset?.displayTheme })');
  assert.ok(stageAt > -1 && soundAt > stageAt && recordAt > soundAt);
  const notes = read('zz4/fake-notes.js');
  const renderAt = notes.indexOf('  renderFakeNoteDetail(note, detail);');
  const vibrateAt = notes.indexOf('  if (detail.inRange === false) vibrateCue();');
  const revealAt = notes.indexOf('  recordChoiceReveal({ number: detail.choice, list: note.name });');
  assert.ok(renderAt > -1 && vibrateAt > renderAt && revealAt > vibrateAt);
  assert.equal(notes.includes('recordChoiceReveal'), true);
  assert.equal(notes.slice(0, renderAt).includes('  recordChoiceReveal('), false);
});

function elementStub() {
  const nodes = [];
  function make(tag) {
    const node = {
      tag, id: '', className: '', type: '', _text: '',
      get textContent() { return this._text + this.children.map(child => child.textContent).join(''); },
      set textContent(value) { this._text = value; this.children = []; }, hidden: false, open: false, children: [],
      parentElement: null, listeners: {},
      appendChild(child) { child.parentElement = node; node.children.push(child); return child; },
      insertBefore(child, before) {
        const at = node.children.indexOf(before);
        child.parentElement = node;
        if (at < 0) node.children.push(child);
        else node.children.splice(at, 0, child);
        return child;
      },
      replaceChildren(...kids) { node.children = []; kids.forEach((kid) => node.appendChild(kid)); },
      addEventListener(type, fn) { (node.listeners[type] ||= []).push(fn); },
      querySelector(selector) {
        const id = selector.startsWith('#') ? selector.slice(1) : '';
        const walk = (current) => {
          if (id && current.id === id) return current;
          if (!id && current.className.split(/\s+/).includes(selector.replace(/^\./, ''))) return current;
          for (const child of current.children) {
            const found = walk(child);
            if (found) return found;
          }
          return null;
        };
        return walk(node);
      },
    };
    nodes.push(node);
    return node;
  }
  const stack = make('div');
  stack.className = 'stack';
  const actions = make('div');
  actions.className = 'row-actions';
  stack.appendChild(actions);
  const body = make('div');
  body.className = 'sv-body';
  const doc = {
    nodes,
    createElement: make,
    getElementById(id) { return nodes.find((node) => node.id === id) || null; },
    querySelector(selector) {
      if (selector === '#settings-screen .stack') return stack;
      if (selector === '#view-home .sv-body') return body;
      return null;
    },
  };
  return { doc, stack, actions, body };
}

test('settings show a collapsed 공연 기록, newest first, and 기록 지우기 clears it', async () => {
  const { doc, stack, actions, body } = elementStub();
  const usotsuki = memoryStorage();
  const choice = memoryStorage();
  const previous = globalThis.document;
  globalThis.document = doc;
  try {
    mountUsotsuki(doc, usotsuki);
    mountChoice(doc, choice);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const panels = doc.nodes.filter((node) => node.id === 'performance-log');
    assert.equal(panels.length, 2);
    for (const panel of panels) {
      assert.equal(panel.open, false);
      assert.equal(panel.children[0].textContent, '공연 기록');
      assert.equal(panel.querySelector('#performance-log-empty').textContent, '아직 기록이 없습니다.');
      assert.equal(panel.querySelector('#performance-log-clear').textContent, '기록 지우기');
    }
    assert.equal(stack.children[0].id, 'performance-log');
    assert.equal(stack.children[1], actions);
    assert.equal(body.children.at(-1).id, 'performance-log');
    recordCompletedTest({ verdict: 'LIE', theme: 'wine' }, usotsuki);
    recordCompletedTest({ verdict: 'TRUE', theme: 'recorder-d' }, usotsuki);
    recordChoiceReveal({ number: 3, list: '첫 목록' }, choice);
    recordChoiceReveal({ number: 12, list: '영화 목록' }, choice);
    for (const panel of panels) panel.listeners.toggle[0]();
    const usotsukiList = stack.querySelector('#performance-log-list');
    const choiceList = body.querySelector('#performance-log-list');
    assert.match(usotsukiList.children[0].textContent, /진실 판정 · 황동 타자기/);
    assert.match(usotsukiList.children[1].textContent, /거짓 판정 · 와인 카드룸/);
    assert.match(choiceList.children[0].textContent, /12번 · 영화 목록/);
    assert.match(choiceList.children[1].textContent, /3번 · 첫 목록/);
    assert.match(usotsukiList.children[0].textContent, /\d/);
    stack.querySelector('#performance-log-clear').listeners.click[0]();
    body.querySelector('#performance-log-clear').listeners.click[0]();
    assert.equal(usotsukiList.children.length, 0);
    assert.equal(choiceList.children.length, 0);
    assert.equal(stack.querySelector('#performance-log-empty').hidden, false);
    assert.deepEqual(readUsotsuki(usotsuki), []);
    assert.deepEqual(readChoice(choice), []);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('performance log modules live with the personal apps', () => {
  assert.match(read('zz7/sw.js'), /["']\.\/performance-log\.js["']/);
  assert.match(read('zz4/sw.js'), /["']\.\/performance-log\.js["']/);
  assert.match(read('zz7/sw.js'), /-perf-log-1/);
  assert.match(read('zz4/sw.js'), /-perf-log-1/);
  assert.equal(read('zz7/index.html').includes('공연 기록'), false);
  assert.equal(read('zz4/index.html').includes('공연 기록'), false);
});


test('default storage is deferred until after a frame and a throwing localStorage getter is harmless', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldFrame = globalThis.requestAnimationFrame;
  const oldTimer = globalThis.setTimeout;
  const frames = [], timers = [];
  const storage = memoryStorage();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    globalThis.requestAnimationFrame = callback => frames.push(callback);
    globalThis.setTimeout = callback => timers.push(callback);
    recordCompletedTest({ verdict: 'TRUE', theme: 'green' });
    recordChoiceReveal({ number: 12, list: '목록' });
    assert.equal(storage.store.size, 0);
    frames.splice(0).forEach(callback => callback());
    assert.equal(storage.store.size, 0);
    timers.splice(0).forEach(callback => callback());
    assert.equal(readUsotsuki(storage)[0].verdict, 'TRUE');
    assert.equal(readChoice(storage)[0].number, 12);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('SecurityError'); } });
    assert.doesNotThrow(() => {
      recordCompletedTest({ verdict: 'LIE' });
      recordChoiceReveal({ number: 3 });
      clearUsotsuki(); clearChoice();
      mountUsotsuki(); mountChoice();
    });
    frames.splice(0).forEach(callback => assert.doesNotThrow(callback));
    timers.splice(0).forEach(callback => assert.doesNotThrow(callback));
    assert.deepEqual(readUsotsuki(), []);
    assert.deepEqual(readChoice(), []);
    await Promise.resolve();
  } finally {
    globalThis.setTimeout = oldTimer;
    if (oldFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = oldFrame;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
