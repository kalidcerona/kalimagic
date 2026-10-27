import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../zz11/update-prompt.js', import.meta.url), 'utf8');

// Minimal DOM: just what update-prompt.js touches.
function el(tag) {
  const listeners = {};
  const node = {
    tag, children: [], attrs: {}, style: {}, textContent: '', parent: null, focused: false,
    setAttribute(k, v) { node.attrs[k] = v; },
    appendChild(c) { c.parent = node; node.children.push(c); return c; },
    addEventListener(t, f) { listeners[t] = f; },
    click() { listeners.click(); },
    focus() { node.focused = true; },
    remove() { if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node); node.parent = null; },
  };
  return node;
}
function find(node, pred, out = []) { if (pred(node)) out.push(node); node.children.forEach((c) => find(c, pred, out)); return out; }

function setup({ controller = {}, waiting = null } = {}) {
  const swListeners = {}, regListeners = {}, reloads = [], messages = [];
  const body = el('body'), docListeners = {};
  const worker = (state = 'installed') => { const l = {}; return { state, postMessage: (m) => messages.push(m), addEventListener: (t, f) => { l[t] = f; }, fire: (t) => l[t]() }; };
  const registration = {
    waiting: waiting ? worker() : null, installing: null,
    addEventListener: (t, f) => { regListeners[t] = f; },
    update: async () => {},
  };
  const registered = [];
  const win = {
    navigator: { serviceWorker: { controller, addEventListener: (t, f) => { swListeners[t] = f; }, register: async (url, opts) => { registered.push({ url, opts }); return registration; } } },
    location: { protocol: 'https:', reload: () => reloads.push(1) },
    document: {
      body, activeElement: null, createElement: el,
      addEventListener: (t, f) => { docListeners[t] = f; }, removeEventListener: () => { delete docListeners.keydown; },
    },
  };
  vm.runInNewContext(source, { window: win, Promise, setTimeout });
  const dialogs = () => find(body, (n) => n.attrs.role === 'dialog');
  const buttons = () => find(body, (n) => n.tag === 'button');
  return { win, body, registration, worker, messages, reloads, swListeners, regListeners, registered, dialogs, buttons, docListeners };
}
const tick = () => new Promise((r) => setImmediate(r));

test('nothing is shown without a waiting worker', async () => {
  const t = setup();
  t.win.MagicUpdate.init({ swUrl: './sw.js', safe: () => true });
  await tick();
  assert.equal(t.win.MagicUpdate.offer(), false);
  assert.equal(t.dialogs().length, 0);
  assert.equal(JSON.stringify(t.registered), JSON.stringify([{ url: './sw.js', opts: { updateViaCache: 'none' } }]));
});

test('a waiting worker with no controller (first install) is not offered', async () => {
  const t = setup({ controller: null, waiting: true });
  t.win.MagicUpdate.init({ swUrl: './sw.js' });
  await tick();
  assert.equal(t.win.MagicUpdate.offer(), false);
});

test('offer() with a waiting worker shows an accessible dialog with two 44px+ buttons', async () => {
  const t = setup({ waiting: true });
  t.win.MagicUpdate.init({ swUrl: './sw.js' });
  await tick();
  assert.equal(t.dialogs().length, 0, 'default safe() never auto-shows');
  assert.equal(t.win.MagicUpdate.offer(), true);
  assert.equal(t.dialogs().length, 1);
  assert.equal(t.win.MagicUpdate.offer(), false, 'no second dialog');
  const text = find(t.body, (n) => n.textContent.includes('새 버전'));
  assert.equal(text[0].textContent, '새 버전이 있어요. 지금 업데이트할까요?');
  const labels = t.buttons().map((b) => b.textContent);
  assert.deepEqual(labels, ['나중에', '지금 업데이트']);
  for (const b of t.buttons()) assert.match(b.style.cssText, /min-height:4[4-9]px|min-height:[5-9]\d px/);
  assert.equal(t.buttons()[1].focused, true);
});

test('update now posts SKIP_WAITING and reloads exactly once on controllerchange', async () => {
  const t = setup({ waiting: true });
  t.win.MagicUpdate.init({ swUrl: './sw.js' });
  await tick();
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 0, 'no reload before the performer agrees');
  t.win.MagicUpdate.offer();
  t.buttons().find((b) => b.textContent === '지금 업데이트').click();
  assert.equal(JSON.stringify(t.messages), JSON.stringify([{ type: 'SKIP_WAITING' }]));
  assert.equal(t.dialogs().length, 0);
  t.swListeners.controllerchange();
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 1);
});

test('later suppresses further offers for this launch and sends nothing', async () => {
  const t = setup({ waiting: true });
  t.win.MagicUpdate.init({ swUrl: './sw.js' });
  await tick();
  t.win.MagicUpdate.offer();
  t.buttons().find((b) => b.textContent === '나중에').click();
  assert.equal(t.dialogs().length, 0);
  assert.equal(t.win.MagicUpdate.offer(), false);
  assert.equal(t.messages.length, 0);
  t.swListeners.controllerchange();
  assert.equal(t.reloads.length, 0, 'a worker taking over on its own never reloads the page');
});

test('hide() closes the dialog without counting as later', async () => {
  const t = setup({ waiting: true });
  t.win.MagicUpdate.init({ swUrl: './sw.js' });
  await tick();
  t.win.MagicUpdate.offer();
  t.win.MagicUpdate.hide();
  assert.equal(t.dialogs().length, 0);
  assert.equal(t.win.MagicUpdate.offer(), true);
});

test('safe() false prevents auto show, safe() true shows when a worker finishes installing', async () => {
  for (const safe of [false, true]) {
    const t = setup();
    t.win.MagicUpdate.init({ swUrl: './sw.js', safe: () => safe });
    await tick();
    const w = t.worker('installing');
    t.registration.installing = w;
    t.regListeners.updatefound();
    w.state = 'installed';
    t.registration.waiting = w;
    w.fire('statechange');
    assert.equal(t.dialogs().length, safe ? 1 : 0);
  }
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
  assert.match(sw, /update-prompt-1';/);
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
  assert.match(app, /MagicUpdate\.init\(\{ swUrl: '\.\/sw\.js', safe: \(\) => !settings\.hidden \|\| !guide\.hidden \}\)/);
});
