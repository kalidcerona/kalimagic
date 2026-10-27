import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../zz11/update-prompt.js', import.meta.url), 'utf8');

// Minimal DOM: just what update-prompt.js touches.
function el(tag) {
  const listeners = {};
  const node = {
    tag, tagName: tag.toUpperCase(), children: [], attrs: {}, style: {}, textContent: '', parent: null, disabled: false,
    setAttribute(k, v) { node.attrs[k] = v; },
    removeAttribute(k) { delete node.attrs[k]; },
    hasAttribute(k) { return k in node.attrs; },
    appendChild(c) { c.parent = node; node.children.push(c); return c; },
    addEventListener(t, f) { listeners[t] = f; },
    click() { if (!node.disabled) listeners.click(); },
    focus() { if (node.ownerDoc) node.ownerDoc.activeElement = node; },
    contains(n) { return n === node || node.children.some((c) => c.contains(c === n ? c : n)); },
    remove() { if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node); node.parent = null; },
  };
  return node;
}
function find(node, pred, out = []) { if (pred(node)) out.push(node); node.children.forEach((c) => find(c, pred, out)); return out; }

function setup({ controller = {}, waiting = false, installing = null } = {}) {
  const swListeners = {}, regListeners = {}, reloads = [], messages = [], timers = [], registered = [], docListeners = {};
  const body = el('body');
  const stage = el('main'); body.appendChild(stage);
  const worker = (state = 'installed') => { const l = {}; const w = { state, failPost: false, postMessage: (m) => { if (w.failPost) throw new Error('gone'); messages.push(m); }, addEventListener: (t, f) => { l[t] = f; }, fire: (t) => l[t]() }; return w; };
  const registration = { waiting: waiting ? worker() : null, installing, active: {}, addEventListener: (t, f) => { regListeners[t] = f; }, updates: 0, update: async () => { registration.updates++; } };
  const doc = {
    body, activeElement: null,
    createElement: (tag) => { const n = el(tag); n.ownerDoc = doc; return n; },
    addEventListener: (t, f) => { docListeners[t] = f; }, removeEventListener: (t) => { delete docListeners[t]; },
  };
  const win = {
    navigator: { serviceWorker: { controller, addEventListener: (t, f) => { swListeners[t] = f; }, register: async (url, opts) => { registered.push({ url, opts }); return registration; } } },
    location: { protocol: 'https:', reload: () => reloads.push(1) },
    document: doc,
    setTimeout: (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; },
    clearTimeout: (id) => { if (timers[id]) timers[id].live = false; },
  };
  vm.runInNewContext(source, { window: win, Promise });
  const dialogs = () => find(body, (n) => n.attrs.role === 'dialog');
  const buttons = () => find(body, (n) => n.tag === 'button');
  const btn = (label) => buttons().find((b) => b.textContent === label);
  const key = (k, shiftKey = false) => { let prevented = false; docListeners.keydown({ key: k, shiftKey, preventDefault() { prevented = true; } }); return prevented; };
  const fireTimer = () => { const t = timers.find((x) => x.live); t.live = false; t.fn(); };
  return { win, body, stage, doc, registration, worker, messages, reloads, swListeners, regListeners, registered, dialogs, buttons, btn, key, timers, fireTimer, docListeners };
}
const tick = () => new Promise((r) => setImmediate(r));
const json = (v) => JSON.stringify(v);

test('nothing is shown without a waiting worker; swUrl registers once with updateViaCache none', async () => {
  const t = setup();
  const status = await t.win.MagicUpdate.init({ swUrl: './sw.js', safe: () => true });
  assert.equal(json(status), json({ ok: true, registered: true }));
  assert.equal(t.win.MagicUpdate.offer(), false);
  assert.equal(t.dialogs().length, 0);
  assert.equal(json(t.registered), json([{ url: './sw.js', opts: { updateViaCache: 'none' } }]));
  assert.equal(t.registration.updates, 0, 'update() only when checkForUpdate is true');
  await t.win.MagicUpdate.init({ swUrl: './sw.js' });
  assert.equal(t.registered.length, 1, 'no double registration');
});

test('init accepts an existing registration or a promise without registering, and checkForUpdate calls update()', async () => {
  for (const make of [(r) => ({ registration: r }), (r) => ({ registrationPromise: Promise.resolve(r) })]) {
    const t = setup();
    const status = await t.win.MagicUpdate.init({ ...make(t.registration), checkForUpdate: true });
    assert.equal(status.ok, true);
    assert.equal(t.registered.length, 0);
    assert.equal(t.registration.updates, 1);
  }
});

test('registration failure is observable and init can be retried', async () => {
  const t = setup();
  const failed = await t.win.MagicUpdate.init({ registrationPromise: Promise.reject(new Error('boom')) });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /boom/);
  assert.equal((await t.win.MagicUpdate.init({ registration: t.registration })).ok, true);
});

test('a waiting worker with no controller (first install) is not offered', async () => {
  const t = setup({ controller: null, waiting: true });
  await t.win.MagicUpdate.init({ registration: t.registration });
  assert.equal(t.win.MagicUpdate.offer(), false);
});

test('offer() shows an accessible dialog with two 44px+ buttons and makes the page inert', async () => {
  const t = setup({ waiting: true });
  await t.win.MagicUpdate.init({ registration: t.registration });
  assert.equal(t.dialogs().length, 0, 'default safe() never auto-shows');
  assert.equal(t.win.MagicUpdate.offer(), true);
  assert.equal(t.dialogs().length, 1);
  assert.equal(t.win.MagicUpdate.offer(), false, 'no second dialog');
  assert.equal(find(t.body, (n) => n.textContent === '새 버전이 있어요. 지금 업데이트할까요?').length, 1);
  assert.equal(json(t.buttons().map((b) => b.textContent)), json(['나중에', '지금 업데이트']));
  for (const b of t.buttons()) assert.match(b.style.cssText, /min-height:48px;min-width:44px/);
  assert.equal(t.doc.activeElement, t.btn('지금 업데이트'));
  assert.equal(t.stage.hasAttribute('inert'), true, 'background is inert while shown');
  t.btn('나중에').click();
  assert.equal(t.stage.hasAttribute('inert'), false, 'inert is restored on close');
});

test('Tab and Shift+Tab stay inside the dialog; focus that escapes is pulled back', async () => {
  const t = setup({ waiting: true });
  await t.win.MagicUpdate.init({ registration: t.registration });
  t.win.MagicUpdate.offer();
  const later = t.btn('나중에'), now = t.btn('지금 업데이트');
  assert.equal(t.key('Tab'), true);
  assert.equal(t.doc.activeElement, later);
  t.key('Tab');
  assert.equal(t.doc.activeElement, now);
  t.key('Tab', true);
  assert.equal(t.doc.activeElement, later);
  t.key('Tab', true);
  assert.equal(t.doc.activeElement, now);
  const outside = el('button'); outside.ownerDoc = t.doc; t.stage.appendChild(outside); outside.focus();
  t.docListeners.focusin({ target: outside });
  assert.ok([later, now].includes(t.doc.activeElement));
});

test('explicit offer() obeys safe(); hide() closes without counting as later', async () => {
  let ok = false;
  const t = setup({ waiting: true });
  await t.win.MagicUpdate.init({ registration: t.registration, safe: () => ok });
  assert.equal(t.win.MagicUpdate.offer(), false);
  ok = true;
  assert.equal(t.win.MagicUpdate.offer(), true);
  t.win.MagicUpdate.hide();
  assert.equal(t.dialogs().length, 0);
  assert.equal(t.stage.hasAttribute('inert'), false);
  assert.equal(t.win.MagicUpdate.offer(), true);
});

test('later suppresses further offers and a late takeover never reloads', async () => {
  const t = setup({ waiting: true });
  await t.win.MagicUpdate.init({ registration: t.registration });
  t.win.MagicUpdate.offer();
  t.btn('나중에').click();
  assert.equal(t.win.MagicUpdate.offer(), false);
  assert.equal(t.messages.length, 0);
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 0);
});

test('update now: pending state, SKIP_WAITING, reload once only when the accepted worker takes control', async () => {
  const t = setup({ waiting: true });
  const accepted = t.registration.waiting;
  await t.win.MagicUpdate.init({ registration: t.registration, safe: () => true });
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 0, 'no reload before the performer agrees');
  t.win.MagicUpdate.offer();
  t.btn('지금 업데이트').click();
  assert.equal(json(t.messages), json([{ type: 'SKIP_WAITING' }]));
  assert.equal(t.dialogs().length, 1, 'pending dialog stays');
  assert.equal(t.btn('지금 업데이트').disabled, true);
  assert.equal(t.timers.filter((x) => x.live)[0].ms, 10000);
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 0, 'a different/unrelated takeover (worker not activating) does not reload');
  accepted.state = 'activated';
  t.swListeners.controllerchange();
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 1);
});

test('no reload when the performer left the safe screen', async () => {
  let ok = true;
  const t = setup({ waiting: true });
  const accepted = t.registration.waiting;
  await t.win.MagicUpdate.init({ registration: t.registration, safe: () => ok });
  t.win.MagicUpdate.offer();
  t.btn('지금 업데이트').click();
  t.win.MagicUpdate.hide(); // settings closed
  accepted.state = 'activated';
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 0);
  // and when safe() flips without hide()
  const u = setup({ waiting: true });
  const w2 = u.registration.waiting;
  await u.win.MagicUpdate.init({ registration: u.registration, safe: () => ok });
  u.win.MagicUpdate.offer();
  u.btn('지금 업데이트').click();
  ok = false; w2.state = 'activated';
  u.swListeners.controllerchange();
  assert.equal(u.reloads.length, 0);
  assert.equal(u.dialogs().length, 0);
});

test('timeout disarms auto reload and offers retry only when safe; never reloads from elapsed time', async () => {
  let ok = true;
  const t = setup({ waiting: true });
  const accepted = t.registration.waiting;
  await t.win.MagicUpdate.init({ registration: t.registration, safe: () => ok });
  t.win.MagicUpdate.offer();
  t.btn('지금 업데이트').click();
  t.fireTimer();
  assert.equal(t.reloads.length, 0);
  assert.equal(t.btn('다시 시도').disabled, false);
  accepted.state = 'activated';
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 0, 'late takeover after timeout does not reload');
  t.btn('다시 시도').click();
  assert.equal(t.messages.length, 2);
  // timeout while not safe closes instead of offering retry
  ok = false;
  t.fireTimer();
  assert.equal(t.dialogs().length, 0);
  assert.equal(t.reloads.length, 0);
});

test('a postMessage failure is caught and shows retry', async () => {
  const t = setup({ waiting: true });
  t.registration.waiting.failPost = true;
  await t.win.MagicUpdate.init({ registration: t.registration, safe: () => true });
  t.win.MagicUpdate.offer();
  t.btn('지금 업데이트').click();
  assert.equal(t.btn('다시 시도').disabled, false);
  assert.equal(t.timers.filter((x) => x.live).length, 0);
});

test('safe() false prevents auto show; true shows when a new worker finishes installing', async () => {
  for (const safe of [false, true]) {
    const t = setup();
    await t.win.MagicUpdate.init({ registration: t.registration, safe: () => safe });
    const w = t.worker('installing');
    t.registration.installing = w;
    t.regListeners.updatefound();
    w.state = 'installed';
    t.registration.waiting = w;
    w.fire('statechange');
    assert.equal(t.dialogs().length, safe ? 1 : 0);
  }
});

test('a worker already installing at init is tracked', async () => {
  const t = setup();
  const w = t.worker('installing');
  t.registration.installing = w;
  await t.win.MagicUpdate.init({ registration: t.registration, safe: () => true });
  w.state = 'installed';
  t.registration.waiting = w;
  w.fire('statechange');
  assert.equal(t.dialogs().length, 1);
});

test('zz11 service worker skips waiting only on the SKIP_WAITING message and ships the prompt script', async () => {
  const sw = readFileSync(new URL('../../zz11/sw.js', import.meta.url), 'utf8');
  const listeners = {}; let skips = 0;
  vm.runInNewContext(sw, { URL, Response, Request, self: { registration: { scope: 'https://example.test/zz11/' }, addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting: async () => { skips++; }, clients: { claim: async () => {} } } });
  listeners.message({ data: { type: 'other' } });
  listeners.message({ data: null });
  assert.equal(skips, 0);
  listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(skips, 1);
  assert.match(sw, /"\.\/update-prompt\.js"/);
  assert.match(sw, /update-prompt-2';/);
});

test('zz11 page loads update-prompt.js before app.js and offers only from showSettings', () => {
  const html = readFileSync(new URL('../../zz11/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('./update-prompt.js') > 0 && html.indexOf('./update-prompt.js') < html.indexOf('./app.js'));
  const app = readFileSync(new URL('../../zz11/app.js', import.meta.url), 'utf8');
  const offers = [...app.matchAll(/MagicUpdate\??\.offer\(\)/g)];
  assert.equal(offers.length, 1);
  const show = app.slice(app.indexOf('function showSettings()'), app.indexOf('function closeSettings()'));
  assert.match(show, /MagicUpdate\?\.offer\(\)/);
  assert.ok(show.indexOf('settings.hidden = false') < show.indexOf('offer()'));
  assert.ok(app.includes("MagicUpdate.init({ swUrl: './sw.js', checkForUpdate: true, safe: () => !settings.hidden })"), 'prompt is only safe while settings is open');
  const guideClose = app.slice(app.indexOf("getElementById('guide-close')"), app.indexOf('try { guide.hidden = localStorage'));
  assert.match(guideClose, /MagicUpdate\?\.hide\(\)/);
  assert.match(app.slice(app.indexOf('function closeSettings()'), app.indexOf('function angleAt')), /MagicUpdate\?\.hide\(\)/);
});
