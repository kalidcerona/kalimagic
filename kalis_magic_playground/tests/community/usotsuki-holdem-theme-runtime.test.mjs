import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const STATE = 'usotsuki.detector.v1';
const THEME = 'usotsuki.detector.theme.v1';
const SCAN = 'usotsuki.detector.scan-duration.v1';
let serial = 0;

async function fixture({ theme, store = new Map(), readFails = false, stateReadFails = false, writeFails = false, vibrateSupported = true, rect = { left: 20, top: 180, width: 300, height: 120 } } = {}) {
  if (theme !== undefined) store.set(THEME, theme);
  if (!store.has(SCAN)) store.set(SCAN, '0.5');
  if (!store.has('usotsuki.detector.sound.v1')) store.set('usotsuki.detector.sound.v1', '0');
  const saved = new Map();
  const replace = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  const writes = [];
  const nodes = new Map();
  const all = [];
  class FakeElement {
    constructor(tag = 'DIV', attrs = {}) {
      this.tagName = tag.toUpperCase();
      this.attributes = attrs;
      this.id = attrs.id;
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.value = attrs.value || '';
      this.textContent = '';
      this.style = {};
      this.dataset = {};
      this.listeners = new Map();
      this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
      this.classList = { add: (...xs) => xs.forEach(x => this.classes.add(x)), remove: (...xs) => xs.forEach(x => this.classes.delete(x)), contains: x => this.classes.has(x) };
      for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    dispatch(type, props = {}) { this.listeners.get(type)?.({ target: this, pointerId: 1, clientX: 170, clientY: 240, cancelable: true, preventDefault() {}, ...props }); }
    closest(selector) { return selector === `#${this.id}` ? this : null; }
    getBoundingClientRect() { return rect; }
    setPointerCapture() {}
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() {}
    blur() {}
    append(child) { child.parentElement = this; }
    remove() {}
    querySelector() { return null; }
  }
  const html = readFileSync(new URL('../../zz7/index.html', import.meta.url), 'utf8');
  const stack = [];
  for (const match of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const tag = match[2].toLowerCase();
    if (match[1]) { if (stack.at(-1)?.tagName.toLowerCase() === tag) stack.pop(); continue; }
    const attrs = Object.fromEntries(Array.from(match[3].matchAll(/([\w-]+)="([^"]*)"/g), x => [x[1], x[2]]));
    const el = new FakeElement(tag, attrs);
    el.hidden = /(?:^|\s)hidden(?:\s|$)/.test(match[3]);
    el.checked = /(?:^|\s)checked(?:\s|$)/.test(match[3]);
    el.parentElement = stack.at(-1) || null;
    all.push(el);
    if (el.id) { assert.equal(nodes.has(el.id), false, 'actual IDs are unique'); nodes.set(el.id, el); }
    if (!['meta', 'link', 'input', 'img', 'br'].includes(tag) && !match[3].endsWith('/')) stack.push(el);
  }
  const body = all.find(x => x.tagName === 'BODY');
  const documentEvents = new Map();
  const doc = {
    body, hidden: false,
    querySelector(selector) { return selector.startsWith('#') ? nodes.get(selector.slice(1)) || null : all.find(x => x.classes.has(selector.slice(1))) || null; },
    createElement: tag => new FakeElement(tag),
    addEventListener: (type, fn) => documentEvents.set(type, fn),
  };
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const vibrations = [];
  const win = {
    localStorage: {
      getItem(key) { if ((readFails && key === THEME) || (stateReadFails && key === STATE)) throw new Error('blocked storage'); return store.get(key) ?? null; },
      setItem(key, value) { writes.push([key, String(value)]); if (writeFails && key === THEME) throw new Error('blocked storage'); store.set(key, String(value)); },
    },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener() {},
  };
  const nav = vibrateSupported ? { vibrate: x => { vibrations.push(x); return true; } } : {};
  replace('Element', FakeElement); replace('document', doc); replace('window', win); replace('navigator', nav); replace('performance', { now: () => now });
  await import(`../../zz7/detector.js?holdem-test=${++serial}`);
  const element = id => { const el = nodes.get(id); assert.ok(el, `${id} exists in actual HTML`); return el; };
  return {
    writes,
    element, store, rect, timers, vibrations, doc,
    state: () => JSON.parse(store.get(STATE)),
    theme(value) { element('display-theme').value = value; element('display-theme').dispatch('change'); },
    pointer(type, x, y, id = 1, target = element('performance-screen')) { element('performance-screen').dispatch(type, { target, clientX: x, clientY: y, pointerId: id }); },
    tick(ms) {
      const end = now + ms;
      for (let i = 0; i < 100; i++) {
        const ready = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!ready) break;
        now = ready[1].at; timers.delete(ready[0]); ready[1].fn();
      }
      now = end;
    },
    restore() { for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } },
  };
}

test('approved themes validate saved values and keep working when theme storage is blocked', async () => {
  for (const [theme, expected, readFails] of [[undefined, 'green', false], ['green', 'green', false], ['wine', 'wine', false], ['recorder', 'recorder', false], ['invalid', 'green', false], ['', 'green', false], ['wine', 'green', true]]) {
    const f = await fixture({ theme, readFails });
    try { assert.equal(f.element('performance-screen').dataset.displayTheme, expected); assert.equal(f.element('display-theme').value, expected); assert.equal(f.state().attemptCount, 0); }
    finally { f.restore(); }
  }
  const f = await fixture({ writeFails: true });
  try { f.theme('wine'); assert.equal(f.element('performance-screen').dataset.displayTheme, 'wine'); assert.equal(f.store.has(THEME), false); assert.equal(f.state().attemptCount, 0); }
  finally { f.restore(); }
});

test('unreadable performance storage remains untouched during boot, settings and in-memory performance', async () => {
  const original = 'temporarily unreadable user performance data';
  const store = new Map([[STATE, original]]);
  const f = await fixture({ store, stateReadFails: true });
  try {
    assert.equal(store.get(STATE), original, 'boot must not replace unreadable storage');
    f.element('truth-attempt').value = '2,4';
    f.element('truth-attempt').dispatch('change');
    f.element('start-performance').dispatch('click');
    f.pointer('pointerdown', 170, 240); f.tick(500); f.pointer('pointerup', 170, 240);
    f.element('reset-attempts').dispatch('click');
    assert.equal(store.get(STATE), original, 'normal actions must preserve the original');
    f.theme('wine');
    assert.equal(store.get(THEME), 'wine', 'independent theme storage remains usable');
    assert.equal(store.get(STATE), original);
  } finally { f.restore(); }
});

test('theme changes during a hold preserve timing, truth attempts and haptics, and survive restart/relaunch', async () => {
  const store = new Map();
  const f = await fixture({ store });
  try {
    f.element('truth-attempt').value = '2,4'; f.element('truth-attempt').dispatch('change');
    f.element('start-performance').dispatch('click');
    f.pointer('pointerdown', 170, 240);
    assert.equal(f.element('test-indicator').textContent, '검사 중');
    const state = f.store.get(STATE), timers = [...f.timers.entries()], pulses = JSON.stringify(f.vibrations);
    f.theme('wine');
    assert.equal(f.store.get(STATE), state); assert.deepEqual([...f.timers.entries()], timers); assert.equal(JSON.stringify(f.vibrations), pulses);
    assert.equal(f.element('test-indicator').textContent, '검사 중');
    f.tick(499); assert.equal(f.state().attemptCount, 0);
    f.tick(1); assert.equal(f.state().attemptCount, 1); assert.equal(f.element('verdict').textContent, '거짓');
    f.pointer('pointerup', 170, 240);
    f.pointer('pointerdown', 170, 240); f.tick(500); f.pointer('pointerup', 170, 240);
    assert.equal(f.state().attemptCount, 2); assert.equal(f.element('verdict').textContent, '진실');
    f.element('reset-attempts').dispatch('click'); assert.equal(f.state().attemptCount, 0); assert.equal(f.element('performance-screen').dataset.displayTheme, 'wine');
    f.element('start-performance').dispatch('click'); assert.equal(f.element('performance-screen').dataset.displayTheme, 'wine'); assert.deepEqual(f.state().settings.truthAttempts, [2, 4]);
  } finally { f.restore(); }
  const relaunched = await fixture({ store });
  try { assert.equal(relaunched.element('performance-screen').dataset.displayTheme, 'wine'); assert.equal(relaunched.state().attemptCount, 0); assert.deepEqual(relaunched.state().settings.truthAttempts, [2,4]); assert.equal(relaunched.element('scan-duration').value, '0.5'); }
  finally { relaunched.restore(); }
});

test('both rectangular pad corners count, blank space never holds, and movement outside cancels', async () => {
  for (const rect of [{ left: 20, top: 180, width: 300, height: 180 }, { left: 20, top: 180, width: 300, height: 100 }]) {
    const f = await fixture({ rect });
    try {
      for (const y of [rect.top - 8, rect.top + rect.height + 8]) {
        f.pointer('pointerdown', 170, y); assert.equal(f.element('performance-screen').classList.contains('is-testing'), false);
        f.tick(700); f.pointer('pointerup', 170, y); assert.equal(f.state().attemptCount, 0);
      }
      for (const [x, y] of [[rect.left + 1, rect.top + 1], [rect.left + rect.width - 1, rect.top + rect.height - 1]]) {
        f.pointer('pointerdown', x, y); assert.equal(f.element('performance-screen').classList.contains('is-testing'), true);
        f.tick(500); f.pointer('pointerup', x, y);
      }
      assert.equal(f.state().attemptCount, 2);
      f.pointer('pointerdown', rect.left + 1, rect.top + 1);
      f.pointer('pointermove', rect.left - 30, rect.top - 30);
      assert.equal(f.element('test-indicator').textContent, '취소됨');
      f.tick(700); f.pointer('pointerup', rect.left - 30, rect.top - 30); assert.equal(f.state().attemptCount, 2);
      f.pointer('pointerdown', 170, 240); f.tick(50); f.pointer('pointerup', 170, 240); assert.equal(f.state().attemptCount, 2);
    } finally { f.restore(); }
  }
});

test('recorder theme persists, falls back to green, and a hold keeps attempts, timing, sound and scan', async () => {
  const html = readFileSync(new URL('../../zz7/index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../zz7/style.css', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../../zz7/sw.js', import.meta.url), 'utf8');
  assert.match(html, /<option value="recorder">목재 드럼<\/option>/);
  assert.match(css, /#performance-screen\[data-display-theme="recorder"\]/);
  assert.match(css, /recorder-assets\/recorder-shell-blank\.webp/);
  assert.match(css, /#performance-screen\[data-display-theme="wine"\]/);
  assert.match(css, /holdem-assets\/felt-grain\.svg/);
  assert.match(css, /holdem-assets\/leather-grain\.svg/);
  assert.match(sw, /v20261008-three-recorders-12/);
  assert.match(sw, /recorder-assets\/recorder-shell-blank\.webp/);
  assert.match(sw, /pathname\.startsWith\('\/tools\/'\)/);
  const store = new Map([['usotsuki.detector.sound.v1', '0']]);
  const f = await fixture({ store, theme: 'recorder' });
  try {
    assert.equal(f.element('performance-screen').dataset.displayTheme, 'recorder');
    assert.equal(f.element('display-theme').value, 'recorder');
    assert.equal(f.element('sound-enabled').checked, false);
    assert.equal(f.element('scan-duration').value, '0.5');
    assert.equal(f.state().attemptCount, 0);
    f.element('truth-attempt').value = '2,4';
    f.element('truth-attempt').dispatch('change');
    f.element('start-performance').dispatch('click');
    f.pointer('pointerdown', 170, 240);
    assert.equal(f.element('test-indicator').textContent, '검사 중');
    const state = f.store.get(STATE);
    const timers = [...f.timers.entries()];
    const pulses = JSON.stringify(f.vibrations);
    f.theme('recorder');
    assert.equal(f.store.get(THEME), 'recorder');
    assert.equal(f.store.get(STATE), state);
    assert.deepEqual([...f.timers.entries()], timers);
    assert.equal(JSON.stringify(f.vibrations), pulses);
    assert.equal(f.element('test-indicator').textContent, '검사 중');
    assert.equal(f.element('sound-enabled').checked, false);
    assert.equal(store.get('usotsuki.detector.sound.v1'), '0');
    assert.equal(f.element('scan-duration').value, '0.5');
    assert.equal(store.get(SCAN), '0.5');
    f.tick(499);
    assert.equal(f.state().attemptCount, 0);
    f.tick(1);
    assert.equal(f.state().attemptCount, 1);
    assert.equal(f.element('verdict').textContent, '거짓');
    assert.equal(f.element('performance-screen').dataset.displayTheme, 'recorder');
    f.pointer('pointerup', 170, 240);
    f.theme('green');
    assert.equal(f.state().attemptCount, 1);
    assert.equal(f.element('verdict').textContent, '거짓');
    assert.equal(f.element('sound-enabled').checked, false);
    f.theme('not-a-theme');
    assert.equal(f.element('performance-screen').dataset.displayTheme, 'green');
    assert.equal(store.get(THEME), 'green');
    assert.equal(f.state().attemptCount, 1);
    f.theme('recorder');
    assert.equal(f.element('performance-screen').dataset.displayTheme, 'recorder');
    assert.equal(f.state().attemptCount, 1);
    assert.equal(f.element('verdict').textContent, '거짓');
  } finally { f.restore(); }
  const invalid = await fixture({ theme: 'chart-recorder' });
  try {
    assert.equal(invalid.element('performance-screen').dataset.displayTheme, 'green');
    assert.equal(invalid.element('display-theme').value, 'green');
    assert.equal(invalid.state().attemptCount, 0);
  } finally { invalid.restore(); }
  const blocked = await fixture({ writeFails: true });
  try {
    blocked.theme('recorder');
    assert.equal(blocked.element('performance-screen').dataset.displayTheme, 'recorder');
    assert.equal(blocked.store.has(THEME), false);
    assert.equal(blocked.state().attemptCount, 0);
    assert.equal(blocked.element('sound-enabled').checked, false);
  } finally { blocked.restore(); }
  const relaunched = await fixture({ store });
  try {
    assert.equal(relaunched.element('performance-screen').dataset.displayTheme, 'recorder');
    assert.equal(relaunched.state().attemptCount, 0);
    assert.deepEqual(relaunched.state().settings.truthAttempts, [2, 4]);
    assert.equal(relaunched.element('scan-duration').value, '0.5');
    assert.equal(relaunched.element('sound-enabled').checked, false);
  } finally { relaunched.restore(); }
});

test('blank-space downward swipe opens settings and unsupported vibration help stays outside the hidden group', async () => {
  const f = await fixture({ vibrateSupported: false });
  try {
    f.pointer('pointerdown', 10, 20, 1); f.pointer('pointerdown', 30, 20, 2);
    f.pointer('pointermove', 10, 115, 1); f.pointer('pointermove', 30, 115, 2);
    assert.equal(f.element('settings-screen').hidden, true, '95px is too short');
    f.pointer('pointermove', 10, 116, 1); f.pointer('pointermove', 30, 116, 2);
    assert.equal(f.element('settings-screen').hidden, false, '96px downward opens settings');
    assert.equal(f.state().attemptCount, 0);
    const group = f.element('vibration-settings'), capability = f.element('vibration-capability');
    assert.equal(group.style.display, 'none'); assert.equal(capability.hidden, false); assert.match(capability.textContent, /진동|사용/);
    for (let ancestor = capability.parentElement; ancestor; ancestor = ancestor.parentElement) assert.notEqual(ancestor, group, 'capability text is outside hidden disclosure');
  } finally { f.restore(); }
});


test('all five themes load without rewriting the stored raw preference; unknown remains raw',async()=>{
 for(const raw of ['green','wine','recorder','recorder-a','recorder-d','future-theme']){
  const f=await fixture({theme:raw});
  try{
   assert.equal(f.element('performance-screen').dataset.displayTheme,raw==='future-theme'?'green':raw);
   assert.equal(f.store.get(THEME),raw);
   assert.equal(f.writes.filter(([key])=>key===THEME).length,0);
   f.element('start-performance').dispatch('click');
   assert.equal(f.store.get(THEME),raw);
  }finally{f.restore();}
 }
});
