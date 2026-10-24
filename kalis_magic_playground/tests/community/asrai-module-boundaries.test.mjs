import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Loads zz8/contacts.js and zz8/install-ui.js (the two module scripts of index.html) and their real imports as
// separate ES modules (no concatenation, no shared scope). A module that uses an identifier it does not import
// throws ReferenceError here, as it does in the browser.
// The DOM is built by parsing the real index.html, so ids and the install-prompt markup are the shipped ones.
// Flows are driven through the listeners the app registers: boot to the contact list, wake lock on visibility,
// the install prompt, the gesture guide, search and contact detail, the two-finger pointer and touch swipes into
// settings, reset, settings saved to storage and the performance start.
// Not reachable with these stubs: settings-ui.js (classic deferred appearance script shared by every magic app,
// not an Asrai module) and the ?local-preview=1 localhost hook (needs a localhost boot).
// ASRAI_ROOT points the same test at another copy of the app folder (for example a friend snapshot).
const root = process.env.ASRAI_ROOT ? pathToFileURL(`${process.env.ASRAI_ROOT.replace(/\/?$/, '/')}`) : new URL('../../zz8/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

const errors = [];
process.on('unhandledRejection', (reason) => errors.push(`unhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => errors.push(`uncaughtException: ${error?.stack || error}`));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(`console.error: ${args.join(' ')}`); };
afterEach(async () => {
  await settle(5);
  assert.deepEqual(errors, [], 'no uncaught errors, unhandled rejections or console.error');
});

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// ----- events -----
function listenerHost(target) {
  target.listeners = {};
  target.addEventListener = (type, fn) => { (target.listeners[type] ||= []).push(fn); };
  target.removeEventListener = (type, fn) => { target.listeners[type] = (target.listeners[type] || []).filter((item) => item !== fn); };
}
function makeEvent(init = {}) {
  const event = {
    cancelable: true, defaultPrevented: false, propagationStopped: false, timeStamp: 0,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    ...init,
  };
  return event;
}
// Awaits async listeners so a rejection fails the step. Returns the event for assertions on preventDefault.
async function emit(target, type, init = {}) {
  const fns = [...(target.listeners[type] || [])];
  assert.ok(fns.length > 0, `a listener is registered for ${type}`);
  const event = makeEvent(init);
  await Promise.all(fns.map((fn) => fn(event)));
  return event;
}

// ----- selector matching (the subset the app uses: tag, #id, .class, descendant) -----
const PIECE = /^(?:([\w-]+)|#([\w-]+)|\.([\w-]+))/;
function matchesCompound(el, source) {
  let rest = source;
  while (rest) {
    const m = rest.match(PIECE);
    if (!m) throw new Error(`stub: unsupported selector "${source}"`);
    if (m[1] && el.tag !== m[1]) return false;
    if (m[2] && el.id !== m[2]) return false;
    if (m[3] && !el.classes.has(m[3])) return false;
    rest = rest.slice(m[0].length);
  }
  return true;
}
function matchesSelector(el, selector) {
  const parts = selector.trim().split(/\s+/);
  if (!matchesCompound(el, parts.at(-1))) return false;
  let at = parts.length - 2;
  for (let node = el.parentElement; node && at >= 0; node = node.parentElement) {
    if (matchesCompound(node, parts[at])) at -= 1;
  }
  return at < 0;
}

// ----- elements -----
let document;
class FakeElement {
  constructor(tag = 'div') {
    this.tag = tag.toLowerCase(); this.id = ''; this.attrs = new Map(); this.classes = new Set(); this.dataset = {};
    this.children = []; this.parentElement = null; this.hidden = false; this.value = ''; this.disabled = false;
    this._text = ''; this.type = '';
    listenerHost(this);
    this.classList = {
      add: (...n) => n.forEach((x) => this.classes.add(x)),
      remove: (...n) => n.forEach((x) => this.classes.delete(x)),
      contains: (n) => this.classes.has(n),
    };
  }
  get className() { return [...this.classes].join(' '); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children.forEach((c) => { c.parentElement = null; }); this.children = []; this._text = String(v); }
  set innerHTML(source) { this.children = []; this._text = ''; parseInto(this, source); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.tag === '#fragment') { this.append(...node.children); node.children = []; continue; }
      if (node.parentElement) node.remove();
      node.parentElement = this; this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children.forEach((c) => { c.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parentElement) { this.parentElement.children = this.parentElement.children.filter((c) => c !== this); this.parentElement = null; } }
  contains(node) { for (let n = node; n; n = n.parentElement) if (n === this) return true; return false; }
  matches(selector) { return matchesSelector(this, selector); }
  closest(selector) { for (let n = this; n; n = n.parentElement) if (n.matches(selector)) return n; return null; }
  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => { for (const child of node.children) { if (child.matches(selector)) found.push(child); walk(child); } };
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = null; }
}

// ----- parse the real index.html into the stub DOM -----
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
const SKIP_CONTENT = new Set(['script', 'style']);
function parseInto(parent, source) {
  const stack = [parent];
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
  const attr = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = token.exec(source))) {
    if (m[1]) {
      const name = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) if (stack[i].tag === name) { stack.length = i; break; }
      continue;
    }
    if (m[2]) {
      const el = new FakeElement(m[2]);
      for (const [, k, a, b, c] of m[3].matchAll(attr)) {
        const v = a ?? b ?? c ?? '';
        el.setAttribute(k, v);
        if (k === 'id') el.id = v;
        if (k === 'class') el.className = v;
        if (k === 'hidden') el.hidden = true;
        if (k === 'disabled') el.disabled = true;
        if (k === 'value') el.value = v;
        if (k === 'type') el.type = v;
        if (k.startsWith('data-')) el.dataset[k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = v;
      }
      stack.at(-1).append(el);
      if (SKIP_CONTENT.has(el.tag)) {
        token.lastIndex = source.toLowerCase().indexOf(`</${el.tag}>`, token.lastIndex) + el.tag.length + 3;
        continue;
      }
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    if (m[5] && stack.length > 1) stack.at(-1)._text += m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  for (const area of parent.querySelectorAll('textarea')) area.value = area._text;
}

// ----- browser stubs -----
function stubBrowser() {
  const top = new FakeElement('#root');
  parseInto(top, html);
  const htmlEl = top.children.find((c) => c.tag === 'html');
  const body = htmlEl.children.find((c) => c.tag === 'body');
  const storeMap = new Map();
  const localStorage = {
    getItem: (key) => (storeMap.has(key) ? storeMap.get(key) : null),
    setItem: (key, value) => { storeMap.set(key, String(value)); },
    removeItem: (key) => { storeMap.delete(key); },
  };
  const calls = { fetch: [] };
  const display = { standalone: false };

  document = {
    title: '', activeElement: null, visibilityState: 'visible', documentElement: htmlEl, body,
    querySelector: (selector) => top.querySelector(selector),
    getElementById: (id) => top.querySelector(`#${id}`),
    createElement: (tag) => new FakeElement(tag),
    createDocumentFragment: () => new FakeElement('#fragment'),
  };
  listenerHost(document);

  const lockState = { requests: [] };
  const navigator = {
    userAgent: 'node-test', platform: 'node', maxTouchPoints: 0, registered: [],
    wakeLock: {
      request: async (type) => {
        const lock = { type, released: false, handlers: [] };
        lock.addEventListener = (name, fn) => { lock.handlers.push(fn); };
        lock.release = async () => { lock.released = true; lock.handlers.splice(0).forEach((fn) => fn()); };
        lockState.requests.push(lock);
        return lock;
      },
    },
    serviceWorker: { register: async (url, options) => { navigator.registered.push({ url, options }); } },
  };
  const location = { protocol: 'https:', hostname: 'example.test', search: '' };
  const window = {
    innerWidth: 400, innerHeight: 800, localStorage, navigator, location, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: display.standalone, addEventListener() {} }),
  };
  listenerHost(window);

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', document);
  define('window', window);
  define('navigator', navigator);
  define('location', location);
  define('localStorage', localStorage);
  define('Element', FakeElement);
  define('HTMLElement', FakeElement);
  define('fetch', async (url) => { calls.fetch.push(String(url)); return { ok: true }; });
  return { document, window, navigator, localStorage, lockState, calls, display, el: (id) => top.querySelector(`#${id}`), body };
}

const env = stubBrowser();
const { el } = env;
const STORAGE_KEY = 'asrai.prototype.v2';
const GUIDE_KEY = 'asrai.prototype.settings-guide.v1';
const stored = () => JSON.parse(env.localStorage.getItem(STORAGE_KEY));
const scriptSources = [...html.matchAll(/<script\s+type="module"\s+src="([^"]+)"/g)].map((m) => m[1]);
const visibleScreen = () => ['settings-screen', 'contact-list-screen', 'contact-detail-screen'].filter((id) => !el(id).hidden);
const listNames = () => el('contact-list').children.map((li) => li.children[0].textContent);

async function twoFingerPointerSwipe(dy) {
  const starts = [[11, 100, 300], [12, 300, 300]];
  const point = (id, x, y) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, screenX: x + 9, screenY: y + 9 });
  for (const [id, x, y] of starts) await emit(document, 'pointerdown', point(id, x, y));
  const moves = [];
  for (const [id, x, y] of starts) moves.push(await emit(document, 'pointermove', point(id, x, y + dy)));
  for (const [id, x, y] of starts) await emit(document, 'pointerup', point(id, x, y + dy));
  return moves;
}
async function twoFingerTouchSwipe(dy) {
  const touch = (id, y) => ({ identifier: id, clientX: id * 100, clientY: y, screenX: 0, screenY: 0 });
  await emit(document, 'touchstart', { touches: [touch(1, 300), touch(2, 300)] });
  const moved = await emit(document, 'touchmove', { touches: [touch(1, 300 + dy), touch(2, 300 + dy)] });
  await emit(document, 'touchend', { touches: [] });
  return moved;
}
const clickContact = (name) => {
  const button = el('contact-list').children.map((li) => li.children[0]).find((b) => b.textContent === name);
  assert.ok(button, `${name} is listed`);
  return emit(el('contact-list'), 'click', { target: button });
};

let logic;
test('index.html loads exactly the two module scripts, and boot reaches the contact list', async () => {
  assert.deepEqual(scriptSources, ['contacts.js', 'install-ui.js']);
  logic = await import(new URL('logic.js', root));
  await import(new URL(scriptSources[0], root));
  await settle(10);
  assert.deepEqual(visibleScreen(), ['contact-list-screen'], 'boot resumes on the performance list');
  assert.equal(env.localStorage.getItem(STORAGE_KEY), null, 'a clean boot does not write the record');
  assert.equal(env.localStorage.getItem('asrai.library.v1'), null, 'the retired library key stays unused');
  assert.deepEqual(listNames(), [...logic.DEFAULT_FICTIONAL_NAMES]);
  assert.equal(el('target-click').value, '4');
  assert.equal(el('fixed-phone').value, logic.DEFAULT_FIXED_DETAILS.phone);
  assert.equal(el('contact-names').value, logic.DEFAULT_FICTIONAL_NAMES.join('\n'));
  assert.deepEqual(env.navigator.registered, [{ url: './sw.js', options: undefined }]);
  for (const type of ['click', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    assert.ok(document.listeners[type]?.length >= 1, `document listens for ${type}`);
  }
});

test('wake lock is requested on the performance screen, released when hidden and requested again when visible', async () => {
  assert.equal(env.lockState.requests.length, 1);
  assert.equal(env.lockState.requests[0].type, 'screen');
  assert.equal(env.lockState.requests[0].released, false);
  document.visibilityState = 'hidden';
  await emit(document, 'visibilitychange');
  await settle();
  assert.equal(env.lockState.requests[0].released, true, 'hidden page releases the lock');
  assert.equal(env.lockState.requests.length, 1);
  document.visibilityState = 'visible';
  await emit(document, 'visibilitychange');
  await settle();
  assert.equal(env.lockState.requests.length, 2, 'visible page requests a new lock');
  assert.equal(env.lockState.requests[1].released, false);
});

test('install prompt: control appears, manual help, accepted native prompt, dismissed prompt, appinstalled', async () => {
  await import(new URL(scriptSources[1], root));
  const control = el('install-control');
  const button = el('install-app');
  const help = el('install-help');
  assert.equal(control.hidden, false, 'install control shows in a browser tab');
  assert.equal(help.hidden, true);

  await emit(button, 'click');
  assert.equal(help.hidden, false);
  assert.match(help.textContent, /^브라우저 메뉴에서 앱 설치/, 'no native prompt: manual instructions');

  help.hidden = true;
  let prompted = 0;
  let prevented = 0;
  const native = (outcome) => ({
    preventDefault() { prevented += 1; },
    prompt: async () => { prompted += 1; },
    userChoice: Promise.resolve({ outcome }),
  });
  await emit(env.window, 'beforeinstallprompt', native('accepted'));
  assert.equal(prevented, 1, 'the browser mini-infobar is suppressed');
  await emit(button, 'click');
  assert.equal(prompted, 1);
  assert.match(help.textContent, /^설치 요청을 보냈습니다\./);
  assert.equal(help.hidden, false);

  await emit(env.window, 'beforeinstallprompt', native('dismissed'));
  await emit(button, 'click');
  assert.equal(prompted, 2);
  assert.match(help.textContent, /^브라우저 메뉴에서 앱 설치/, 'a dismissed prompt falls back to instructions');

  await emit(env.window, 'appinstalled');
  assert.match(help.textContent, /^설치 요청을 받았습니다\./);

  env.display.standalone = true;
  await emit(env.window, 'beforeinstallprompt', native('accepted'));
  assert.equal(prevented, 2, 'an installed app ignores the prompt');
  env.display.standalone = false;
});

test('gesture guide shows once on the performance screen and remembers the dismissal', async () => {
  const guides = () => env.body.querySelectorAll('.gesture-guide');
  assert.equal(guides().length, 1, 'guide is shown on first run');
  const guide = guides()[0];
  assert.equal(guide.querySelector('h2').textContent, '설정으로 돌아가기');
  assert.equal(env.localStorage.getItem(GUIDE_KEY), null);
  const dismiss = guide.querySelector('button');
  assert.equal(dismiss.textContent, '알겠습니다');
  assert.equal(document.activeElement, dismiss, 'focus moves to the dismiss button');
  await emit(dismiss, 'click');
  assert.equal(guides().length, 0);
  assert.equal(env.localStorage.getItem(GUIDE_KEY), '1');
});

test('performance: search filters names, a tap opens a generated detail and saves the click count', async () => {
  const search = el('contact-search');
  search.value = '구름';
  await emit(search, 'input');
  assert.deepEqual(listNames(), ['구름 둘']);
  search.value = 'zzzz';
  await emit(search, 'input');
  assert.deepEqual(listNames(), ['해당하는 이름이 없습니다.']);
  assert.equal(el('contact-list').children[0].children[0].disabled, true);
  await emit(el('contact-list'), 'click', { target: el('contact-list').children[0].children[0] });
  assert.deepEqual(visibleScreen(), ['contact-list-screen'], 'the empty-result row opens nothing');
  search.value = '';
  await emit(search, 'input');
  assert.equal(listNames().length, logic.DEFAULT_FICTIONAL_NAMES.length);

  await clickContact('구름 둘');
  assert.deepEqual(visibleScreen(), ['contact-detail-screen']);
  assert.equal(el('detail-name').textContent, '구름 둘', 'the tapped name stays exact');
  assert.notEqual(el('detail-phone').textContent, logic.DEFAULT_FIXED_DETAILS.phone, 'a non-target opening is generated');
  assert.equal(stored().clickCount, 1);
  assert.deepEqual(stored().names, [...logic.DEFAULT_FICTIONAL_NAMES]);
  assert.equal(stored().targetClick, 4);

  await emit(el('back-list'), 'click');
  assert.deepEqual(visibleScreen(), ['contact-list-screen']);
  assert.equal(env.lockState.requests.length, 2, 'moving between performance screens keeps the same lock');
});

test('single finger and short swipes stay in the performance; a two-finger pointer swipe down opens settings', async () => {
  await emit(document, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 300 });
  const single = await emit(document, 'pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 460 });
  await emit(document, 'pointerup', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 460 });
  assert.equal(single.defaultPrevented, false);
  assert.deepEqual(visibleScreen(), ['contact-list-screen'], 'one finger does not open settings');

  const moves = await twoFingerPointerSwipe(30);
  assert.deepEqual(visibleScreen(), ['contact-list-screen'], 'a short two-finger move is under the 96px rule');
  assert.equal(moves.at(-1).defaultPrevented, true, 'a downward pair is claimed from the browser');

  await twoFingerPointerSwipe(140);
  assert.deepEqual(visibleScreen(), ['settings-screen']);
  assert.equal(el('settings-status').textContent, '열람 횟수는 1입니다.');
  assert.equal(env.lockState.requests[1].released, true, 'settings does not hold the screen awake');
  assert.equal(env.lockState.requests.length, 2);

  const swallowed = await emit(document, 'click');
  assert.equal(swallowed.defaultPrevented, true, 'the click that ends the gesture is swallowed');
  assert.equal(swallowed.propagationStopped, true);
  const later = await emit(document, 'click');
  assert.equal(later.defaultPrevented, false, 'only one click is swallowed');
});

test('reset clears the click count in storage', async () => {
  await emit(el('reset-clicks'), 'click');
  assert.equal(el('settings-status').textContent, '열람 횟수를 초기화했습니다.');
  assert.equal(stored().clickCount, 0);
});

test('start performance validates the form, then saves settings and shows the deduplicated list', async () => {
  el('target-click').value = '0';
  await emit(el('start-performance'), 'click');
  assert.equal(el('settings-status').textContent, '고정으로 보여줄 횟수는 1부터 20까지의 정수입니다.');
  assert.deepEqual(visibleScreen(), ['settings-screen']);
  assert.equal(stored().targetClick, 4, 'an invalid form does not overwrite the record');

  el('target-click').value = '2';
  el('fixed-phone').value = '  010-1111-2222 ';
  el('fixed-region').value = '가상시 가상구';
  el('fixed-note').value = '가상 메모';
  el('contact-names').value = '가나\n다라\n가나\n  마바  \n\n';
  await emit(el('start-performance'), 'click');
  assert.deepEqual(stored(), {
    targetClick: 2, phone: '010-1111-2222', region: '가상시 가상구', note: '가상 메모',
    names: ['가나', '다라', '마바'], clickCount: 0,
  });
  assert.equal(el('settings-status').textContent, '중복 1개를 뺐습니다. 이름 3개로 시작합니다. 고정 상세는 2번째이고, 열람 횟수는 0입니다.');
  assert.deepEqual(visibleScreen(), ['contact-list-screen']);
  assert.deepEqual(listNames(), ['가나', '다라', '마바']);
  assert.equal(el('contact-names').value, '가나\n다라\n마바', 'form is refilled with the saved names');
  assert.equal(env.lockState.requests.length, 3, 'returning to the performance requests the wake lock again');
  assert.equal(env.lockState.requests[2].released, false);
  assert.equal(env.body.querySelectorAll('.gesture-guide').length, 0, 'a dismissed guide does not come back');
});

test('the saved target click shows the fixed details on exactly that opening', async () => {
  await clickContact('다라');
  assert.notEqual(el('detail-phone').textContent, '010-1111-2222');
  await emit(el('back-list'), 'click');
  await clickContact('마바');
  assert.equal(el('detail-name').textContent, '마바');
  assert.equal(el('detail-phone').textContent, '010-1111-2222');
  assert.equal(el('detail-region').textContent, '가상시 가상구');
  assert.equal(el('detail-note').textContent, '가상 메모');
  assert.equal(stored().clickCount, 2);
  await emit(el('back-list'), 'click');
});

test('a two-finger touch swipe opens settings again and the form shows the saved values', async () => {
  const moved = await twoFingerTouchSwipe(140);
  assert.equal(moved.defaultPrevented, true);
  assert.deepEqual(visibleScreen(), ['settings-screen']);
  assert.equal(el('settings-status').textContent, '열람 횟수는 2입니다.');
  assert.equal(el('target-click').value, '2');
  assert.equal(el('fixed-phone').value, '010-1111-2222');
  assert.equal(env.lockState.requests[2].released, true);

  const swallowed = await emit(document, 'click');
  assert.equal(swallowed.defaultPrevented, true);
  await settle(520);

  await emit(el('start-performance'), 'click');
  assert.deepEqual(visibleScreen(), ['contact-list-screen']);
  assert.equal(env.lockState.requests.length, 4);
  assert.equal(stored().clickCount, 2, 'starting again keeps the count');
  assert.equal(env.calls.fetch.length, 0, 'the app never touches the network');
  console.error = originalConsoleError;
});
