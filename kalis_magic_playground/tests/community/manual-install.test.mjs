import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DISTRIBUTION_APPS } from '../../scripts/build-public.mjs';

const COPIES = [
  ...['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11'],
  ...['aletheia', 'calculator', 'kairos', 'spinner', 'tobira', 'unlock', 'usotsuki'].map((name) => `distribution-snapshots/${name}`),
];
const read = (route, file) => fs.readFileSync(new URL(`../../${route}/${file}`, import.meta.url), 'utf8');
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';

function sandboxFor(source, { userAgent = ANDROID_CHROME, standalone = false, customize = 'off' } = {}) {
  function create(tag) {
    return {
      tagName: tag.toUpperCase(), className: '', textContent: '', children: [], hidden: false, disabled: false, dataset: {}, style: {},
      type: '', href: '', rel: '', listeners: {}, attrs: {},
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute(name, value) { this.attrs[name] = value; },
      querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, remove() {},
    };
  }
  const container = create('div');
  const windowListeners = {};
  const sandbox = {
    document: {
      readyState: 'complete', body: Object.assign(create('body'), { dataset: { magicApp: 'spinner', magicCustomize: customize } }), documentElement: create('html'),
      createElement: create,
      querySelector: (selector) => (String(selector).includes('data-settings-root') || selector === '#settings .settings-panel' ? container : null),
      addEventListener() {},
    },
    location: { hash: '', search: '', pathname: '/zz11/', origin: 'https://example.test' },
    navigator: { userAgent, platform: 'Linux', maxTouchPoints: 5, standalone: undefined },
    matchMedia: (query) => ({ matches: standalone && query.includes('standalone') }),
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    addEventListener(type, fn) { windowListeners[type] = fn; },
    setTimeout(fn) { fn(); return 0; },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInContext(source, vm.createContext(sandbox));
  return { sandbox, container, windowListeners };
}
const flatText = (node) => [node.textContent, ...node.children.flatMap(flatText)].filter(Boolean).join('\n');

test('every shared settings-ui copy is byte-identical and carries the manual install block', () => {
  const sources = COPIES.map((route) => read(route, 'settings-ui.js'));
  for (const source of sources) assert.equal(source, sources[0]);
  assert.match(sources[0], /'수동 설치'/);
  assert.equal((sources[0].match(/appendChild\(installBlock\(\)\)/g) || []).length, 2);
  for (const route of COPIES) assert.match(read(route, 'settings-ui.css'), /\.magic-install \.magic-install-button/);
});

test('button sits directly below the overview (the customizable mode is checked in a real browser)', () => {
  const source = read('zz1', 'settings-ui.js');
  for (const customize of ['off']) {
    const { container } = sandboxFor(source, { customize });
    const names = container.children.map((child) => child.className);
    const overview = names.findIndex((name) => name.includes('magic-overview'));
    assert.ok(overview >= 0, customize);
    assert.equal(names[overview + 1], 'magic-install');
    const box = container.children[overview + 1];
    assert.equal(box.children[0].tagName, 'BUTTON');
    assert.equal(box.children[0].textContent, '수동 설치');
    assert.equal(box.children[1].hidden, true);
  }
});

test('early capture shares one slot and prompt() is called once', async () => {
  const { sandbox, container, windowListeners } = sandboxFor(read('zz1', 'settings-ui.js'));
  let prevented = 0; let prompts = 0;
  const event = { preventDefault() { prevented += 1; }, prompt() { prompts += 1; return Promise.resolve(); }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
  windowListeners.beforeinstallprompt(event);
  assert.equal(prevented, 1);
  assert.equal(sandbox.__magicInstallPrompt, event);
  const box = container.children.find((child) => child.className === 'magic-install');
  const [button, status] = box.children;
  button.listeners.click();
  assert.equal(prompts, 1);
  assert.equal(sandbox.__magicInstallPrompt, null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(flatText(status), /설치를 시작했어요/);
  assert.equal(status.hidden, false);
  button.listeners.click();
  assert.equal(prompts, 1, 'second press must not reuse the spent event');
  assert.match(flatText(status), /길게 눌러 삭제/);
});

test('dismissed prompt and a prompt another script already used both end in plain Korean', async () => {
  const { container, windowListeners } = sandboxFor(read('zz1', 'settings-ui.js'));
  const status = container.children.find((child) => child.className === 'magic-install').children[1];
  const button = container.children.find((child) => child.className === 'magic-install').children[0];
  windowListeners.beforeinstallprompt({ preventDefault() {}, prompt: () => Promise.resolve(), userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  button.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(flatText(status), /설치를 취소했어요/);
  windowListeners.beforeinstallprompt({ preventDefault() {}, prompt() { throw new Error('InvalidStateError'); } });
  button.listeners.click();
  assert.match(flatText(status), /기억하고 있을 수 있어요/);
});

test('without a deferred prompt each browser gets its own steps', () => {
  const source = read('zz1', 'settings-ui.js');
  const expectations = [
    [ANDROID_CHROME, /길게 눌러 삭제[\s\S]*다시 여세요[\s\S]*홈 화면에 추가[\s\S]*설치/],
    [SAMSUNG, /현재 페이지 추가[\s\S]*홈 화면/],
    [IPHONE, /공유 버튼[\s\S]*홈 화면에 추가/],
    [IPHONE_CHROME, /공유 버튼[\s\S]*홈 화면에 추가/],
  ];
  for (const [userAgent, pattern] of expectations) {
    const { container } = sandboxFor(source, { userAgent });
    const [button, status] = container.children.find((child) => child.className === 'magic-install').children;
    button.listeners.click();
    assert.match(flatText(status), pattern, userAgent);
  }
  const { container } = sandboxFor(source, { standalone: true });
  const [button, status] = container.children.find((child) => child.className === 'magic-install').children;
  button.listeners.click();
  assert.match(flatText(status), /이미 설치된 앱으로 실행 중/);
});

test('copy has no em dash or tilde', () => {
  const source = read('zz1', 'settings-ui.js');
  const block = source.slice(source.indexOf('function installGuide'), source.indexOf('var api ='));
  assert.doesNotMatch(block, /[—~]/);
});

test('installable manifests never share an id once published', () => {
  const published = new Map();
  const add = (url, manifest) => {
    const id = new URL(manifest.id || manifest.start_url, new URL(url, 'https://example.test')).href;
    assert.ok(!published.has(id), `${url} collides with ${published.get(id)} on ${id}`);
    published.set(id, url);
  };
  for (const route of ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11', 'zz12', 'zz13', 'zz14']) {
    add(`/${route}/manifest.webmanifest`, JSON.parse(read(route, 'manifest.webmanifest')));
  }
  for (const app of DISTRIBUTION_APPS) {
    const manifest = JSON.parse(read(app.source, 'manifest.webmanifest'));
    // The pinned Pi Max snapshot keeps zz14's id on purpose; the build rewrites every snapshot id to its published route.
    add(`/tools/${app.target}/manifest.webmanifest`, { ...manifest, id: `/tools/${app.target}/` });
  }
});
