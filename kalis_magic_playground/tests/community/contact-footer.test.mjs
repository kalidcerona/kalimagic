import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const URL_EXACT = 'https://qr.kakao.com/talk/eshVqDvk7WKk0zDKtiC9UTa.T6Q-';

test('shared settings footer is a real link plus an ID copy button', () => {
  const source = fs.readFileSync(new URL('../../zz1/settings-ui.js', import.meta.url), 'utf8');
  assert.equal(source.includes('수정, 버그, 아이디어는 카카오톡 KaliDCerona로 알려 주세요.'), false);
  assert.equal((source.match(/appendChild\(contactFooter\(\)\)/g) || []).length, 2);
  assert.doesNotMatch(source, /kakaotalk:|addfriend|Kakao\.init/i);
  const nodes = [];
  function create(tag) {
    const node = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      children: [],
      hidden: false,
      dataset: {},
      style: {},
      type: '',
      href: '',
      rel: '',
      listeners: {},
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      focus() {},
      remove() {},
    };
    nodes.push(node);
    return node;
  }
  const container = create('div');
  const copied = [];
  const sandbox = {
    document: {
      readyState: 'complete',
      body: { dataset: { magicApp: 'spinner', magicCustomize: 'off' } },
      documentElement: create('html'),
      createElement: create,
      querySelector(selector) {
        return String(selector).includes('data-settings-root') || selector === '#settings .settings-panel' ? container : null;
      },
      addEventListener() {},
    },
    location: { hash: '', search: '', pathname: '/tools/spinner', origin: 'https://example.test' },
    navigator: { clipboard: { writeText(value) { copied.push(value); return Promise.resolve(); } } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    addEventListener() {},
    setTimeout(fn) { fn(); return 0; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInContext(fs.readFileSync(new URL('../../zz1/settings-ui.js', import.meta.url), 'utf8'), vm.createContext(sandbox));
  const footer = container.children.find((child) => child.className === 'magic-settings-footer');
  assert.ok(footer);
  const link = footer.children.flatMap((child) => child.children || [child]).find((child) => child.tagName === 'A');
  const button = footer.children.flatMap((child) => child.children || [child]).find((child) => child.tagName === 'BUTTON');
  assert.equal(link.href, URL_EXACT);
  assert.equal(link.textContent, '카카오톡 문의');
  assert.equal(button.textContent, 'ID 복사');
  assert.equal(button.type, 'button');
  button.listeners.click();
  return Promise.resolve().then(() => assert.deepEqual(copied, ['KaliDCerona']));
});

test('zz12 and zz13 contact lives in settings and uses the same url', () => {
  const zz12 = fs.readFileSync(new URL('../../zz12/app.mjs', import.meta.url), 'utf8');
  const zz13 = fs.readFileSync(new URL('../../zz13/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../zz1/settings-ui.css', import.meta.url), 'utf8');
  assert.match(zz12, /function renderSettings\(\)\{[\s\S]*카카오톡 문의/);
  assert.match(zz12, /href="\$\{contactHref\(navigator\)\}"/);
  assert.match(zz13, /dialog id="settings"[^>]*data-settings-root/);
  assert.match(zz13, new RegExp(`href="${URL_EXACT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(zz13, />카카오톡 문의</);
  assert.doesNotMatch(`${zz12}\n${zz13}`, /kakaotalk:/i);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /input\[type="checkbox"\]/);
  assert.match(css, /input\[type="range"\]/);
  assert.doesNotMatch(css, /input\[type="checkbox"\][\s\S]{0,120}min-height:\s*44px/);
});

// These URI values are the exact mobile redirects returned by the supplied Kakao QR page.
test('contact anchors choose Kakao mobile launch URIs while retaining an HTTPS fallback', () => {
  for (const path of ['zz1/settings-ui.js', 'zz12/app.mjs', 'zz13/app.mjs']) {
    const source = fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
    const match = source.match(/function contactHref\(nav\) \{[\s\S]*?\n\s*\}/);
    assert.ok(match, path);
    const context = vm.createContext({});
    vm.runInContext(match[0], context);
    const uri = (nav) => context.contactHref(nav);
    const code = 'eshVqDvk7WKk0zDKtiC9UTa.T6Q-';
    assert.equal(uri({userAgent:'Android Chrome'}), 'intent://viewer?#Intent;scheme=kakaotalkqrcode%3A%2F%2F' + code + ';action=android.intent.action.SEND;category=android.intent.category.BROWSABLE;package=com.kakao.talk;end;');
    assert.equal(uri({userAgent:'iPhone'}), 'kakaotalkqrcode://' + code);
    assert.equal(uri({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}), 'kakaotalkqrcode://' + code);
    assert.equal(uri({userAgent:''}), URL_EXACT);
    assert.match(path === 'zz13/app.mjs' ? fs.readFileSync(new URL('../../zz13/index.html', import.meta.url), 'utf8') : source, /카카오톡 친구 추가에서/);
  }
});
