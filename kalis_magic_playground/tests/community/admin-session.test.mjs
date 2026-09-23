import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../admin-session.js', import.meta.url), 'utf8');
function harness(auth) {
  const node = () => ({ children: [], appendChild(child) { this.children.push(child); },
    append(...children) { this.children.push(...children); }, setAttribute() {},
    addEventListener(type, fn) { this[type] = fn; } });
  const panel = node();
  const context = { document: { querySelector: () => panel }, window: {
    MagicAuth: auth,
    PgUtil: { clear: n => { n.children = []; }, el: (tag, cls, text) => Object.assign(node(), {tag, textContent:text}) }
  } };
  vm.runInNewContext(source, context);
  return { ready: context.window.AdminSession.ready, panel };
}

test('admin session keeps protected page loaders closed for signed-out viewers', async () => {
  const { ready, panel } = harness({ getSession: async () => null, login: async () => {} });
  assert.equal(await ready, false);
  assert.ok(panel.children.some(n => n.tag === 'button' && n.textContent === 'Google로 로그인'));
});

test('admin session supplies account display before protected loaders run', async () => {
  const { ready, panel } = harness({ getSession: async () => ({ user: {email:'admin@example.com'} }) });
  assert.equal(await ready, true);
  assert.equal(panel.children[0].textContent, 'admin@example.com');
});

test('session lookup failure fails closed and explains recovery', async () => {
  const { ready, panel } = harness({ getSession: async () => { throw new Error('offline'); } });
  assert.equal(await ready, false);
  assert.match(panel.children[0].textContent, /새로고침/);
});

test('failed Google redirect restores the login control', async () => {
  const { ready, panel } = harness({ getSession: async () => null,
    login: async () => { throw new Error('oauth unavailable'); } });
  await ready;
  const login = panel.children.find(n => n.tag === 'button');
  await login.click();
  assert.equal(login.disabled, false);
  assert.match(panel.children.at(-1).textContent, /다시 시도/);
});
