import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const base = new URL('../../tools/login/', import.meta.url);
const gateSource = readFileSync(new URL('gate-util.js', base), 'utf8');
const loginSource = readFileSync(new URL('login.js', base), 'utf8');

function setup(path, response, overrides = {}) {
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.listeners = {};
      this.className = '';
      this.attributes = {};
    }
    appendChild(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute(name, value) { this.attributes[name] = value; }
    click() { return this.listeners.click?.(); }
  }
  const panel = new Element('main');
  const location = { search: '?to=' + encodeURIComponent(path), replacedWith: null, replace(value) { this.replacedWith = value; } };
  const calls = [];
  const auth = {
    getSession: async () => ({ user: { email: 'test@example.com' } }),
    authHeader: async () => ({ Authorization: 'Bearer test' }),
    login: async () => {},
    logout: async () => {},
    ...overrides
  };
  const context = vm.createContext({
    URLSearchParams,
    location,
    document: { querySelector: () => panel, createElement: (tag) => new Element(tag) },
    window: { MagicAuth: auth },
    fetch: async (...args) => { calls.push(args); return typeof response === 'function' ? response() : response; }
  });
  vm.runInContext(gateSource, context);
  vm.runInContext(loginSource, context);
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
  const text = () => panel.children.map((child) => child.textContent).join(' ');
  const button = (label) => panel.children.find((child) => child.tagName === 'button' && child.textContent === label);
  return { panel, calls, location, flush, text, button };
}

test('all four destinations are named in the login prompt', async () => {
  for (const [path, name] of [
    ['/tools/calc/', 'HITSUZEN'], ['/tools/stopwatch/', 'KAIROS'],
    ['/tools/unlock/', '레리즈'], ['/tools/stopwatch-uni/', 'KAIROS']
  ]) {
    const ui = setup(path, null, { getSession: async () => null });
    await ui.flush();
    assert.match(ui.text(), new RegExp(name));
    assert.ok(ui.button('구글로 로그인'));
  }
});

test('pending approval and denial have distinct messages with the selected account', async () => {
  const pending = setup('/tools/unlock/', { ok: false, status: 403, json: async () => ({ status: 'pending' }) });
  await pending.flush();
  assert.match(pending.text(), /레리즈.*신청이 접수/);
  assert.match(pending.text(), /test@example.com/);
  assert.ok(pending.button('다른 계정으로 로그인'));
  const denied = setup('/tools/calc/', { ok: false, status: 403, json: async () => ({ error: 'denied' }) });
  await denied.flush();
  assert.match(denied.text(), /HITSUZEN/);
  assert.doesNotMatch(denied.text(), /신청이 접수/);
});

test('service failure offers retry and account change, with no duplicate request while pending', async () => {
  let finish;
  const ui = setup('/tools/stopwatch/', { ok: false, status: 500, json: async () => ({}) }, {
    getSession: () => new Promise((resolve) => { finish = resolve; })
  });
  await ui.flush();
  assert.match(ui.text(), /KAIROS/);
  assert.equal(ui.panel.attributes['aria-busy'], 'true');
  assert.equal(ui.calls.length, 0);
  finish({ user: { email: 'test@example.com' } });
  await ui.flush();
  assert.ok(ui.button('다시 시도'));
  assert.ok(ui.button('다른 계정으로 로그인'));
  assert.equal(ui.panel.attributes['aria-busy'], 'false');
});

test('repeated retry activation makes one request and approval returns to the selected tool', async () => {
  let resolveResponse;
  const ui = setup('/tools/unlock/?from=invite', () => new Promise((resolve) => { resolveResponse = resolve; }));
  await ui.flush();
  assert.equal(ui.calls.length, 1);
  resolveResponse({ ok: false, status: 500, json: async () => ({}) });
  await ui.flush();
  const retry = ui.button('다시 시도');
  retry.click();
  retry.click();
  await ui.flush();
  assert.equal(ui.calls.length, 2);
  resolveResponse({ ok: true });
  await ui.flush();
  assert.equal(ui.location.replacedWith, '/tools/unlock/?from=invite');
});

test('failed account change remains recoverable', async () => {
  const ui = setup('/tools/stopwatch-uni/', {
    ok: false, status: 403, json: async () => ({ status: 'pending' })
  }, { logout: async () => { throw new Error('logout failed'); } });
  await ui.flush();
  ui.button('다른 계정으로 로그인').click();
  await ui.flush();
  assert.match(ui.text(), /KAIROS.*연결에 실패/);
  assert.ok(ui.button('다시 시도'));
  assert.ok(ui.button('다른 계정으로 로그인'));
});
