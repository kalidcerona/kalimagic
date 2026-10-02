import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const ROOT = new URL('../../', import.meta.url);
const APPS = [
  ['zz1/index.html', 'nudge'], ['distribution-snapshots/kairos/index.html', 'nudge'],
  ['zz2/install-prompt.js', 'offer'], ['distribution-snapshots/unlock/install-prompt.js', 'offer'],
  ['zz3/index.html', 'nudge'], ['distribution-snapshots/calculator/index.html', 'nudge'],
  ['zz4/install-prompt.js', 'card'], ['zz5/install-prompt.js', 'card'],
  ['distribution-snapshots/aletheia/install-prompt.js', 'card'],
  ['zz6/install-prompt.js', 'panel'], ['zz7/install-prompt.js', 'panel'],
  ['distribution-snapshots/usotsuki/install-prompt.js', 'panel'],
  ['distribution-snapshots/tobira/install-prompt.js', 'panel'],
  ['zz8/install-ui.js', 'control'], ['zz10/install-ui.js', 'controls'],
  ['zz11/app.js', 'spinner'], ['distribution-snapshots/spinner/app.js', 'spinner'],
  ['zz13/app.mjs', 'qr'], ['distribution-snapshots/qr/app.mjs', 'qr'],
];

async function runtime(file, kind, { saved = new Map(), standalone = false } = {}) {
  let source = await readFile(new URL(file, ROOT), 'utf8');
  if (kind === 'nudge') {
    source = [...source.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)]
      .map(match => match[1]).find(script => /install.nudge.done|installNudgeDone/i.test(script));
    assert.ok(source, file);
  } else if (kind === 'spinner') {
    const display = source.slice(source.indexOf('function standaloneDisplay()'), source.indexOf("stage.addEventListener('pointerdown'"));
    const handlers = source.slice(source.indexOf("window.addEventListener('beforeinstallprompt'"), source.indexOf("if ('serviceWorker' in navigator"));
    source = `let installPrompt = null; let installRevision = 0;\n${display}\n${handlers}`;
  } else if (kind === 'qr') {
    source = source.slice(source.indexOf('let deferredPrompt='), source.indexOf('watchDisplay();') + 'watchDisplay();'.length);
    source += '\nrenderInstall();';
  }
  const events = new Map(), nodes = new Map();
  function node(key) {
    if (!nodes.has(key)) nodes.set(key, {
      hidden: false, textContent: '', events: new Map(), dataset: {},
      classList: { toggle() {} },
      addEventListener(name, listener) { this.events.set(name, listener); },
      querySelector: node,
      remove() { this.hidden = true; },
    });
    return nodes.get(key);
  }
  const ids = {
    nudge: ['bar', 'button', 'span'],
    offer: ['install-offer', 'install-action', 'install-instructions'],
    card: ['[data-install-card]', '[data-install-button]', '[data-install-guidance]'],
    panel: ['#install-panel, .install-panel', '#install-action, [data-install-action]', '#install-instructions, [data-install-instructions]'],
    control: ['install-control', 'install-app', 'install-help'],
    controls: ['install-control', 'install-app', 'install-help'],
    spinner: ['install-app-group', 'install-app', 'install-help'],
    qr: ['install-status', 'install', 'install-status'],
  }[kind];
  const [box, button, description] = ids.map(node);
  if (['nudge', 'offer', 'panel'].includes(kind)) box.hidden = true;
  const media = () => ({ matches: standalone, addEventListener() {}, addListener() {} });
  const navigator = { userAgent: 'Mozilla/5.0 Android Chrome/140', standalone: false };
  const window = { navigator, matchMedia: media, addEventListener: (name, listener) => events.set(name, listener) };
  runInNewContext(source.replace(/export function /g, 'function '), {
    window, navigator, matchMedia: media, location: { pathname: '/zz2/', hash: '' },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    document: { getElementById: node, querySelector: node, createElement: () => box,
      documentElement: node('documentElement'), body: { appendChild() { box.hidden = false; } } },
    $: node,
  }, { filename: file });
  const click = async (act = 'install') => {
    const target = kind === 'nudge' ? box : act === 'close' ? node('install-later') : button;
    const handler = target.events.get('click') || target.onclick;
    assert.equal(typeof handler, 'function', `${file}: ${act}`);
    return handler({ stopPropagation() {}, target: { closest: () => ({ dataset: { act } }) } });
  };
  const prompt = (choice, request = async () => {}) => events.get('beforeinstallprompt')({
    isTrusted: true, preventDefault() {}, prompt: request, userChoice: choice,
  });
  function assertPending() {
    assert.equal(box.hidden, false);
    assert.match(description.textContent, /설치 요청.*아이콘.*메뉴/);
    assert.doesNotMatch(description.textContent, /설치 완료 신호/);
    if (kind === 'controls') {
      assert.equal(node('setup-install-control').hidden, false);
      assert.match(node('setup-install-help').textContent, /설치 요청.*아이콘.*메뉴/);
    }
  }
  return { saved, events, box, button, description, node, click, prompt, assertPending };
}

for (const [file, kind] of APPS) {
  for (const outcome of ['dismissed', 'error']) {
    test(`${file}: ${outcome} leaves manual retry available and consumes its event once`, async () => {
      const app = await runtime(file, kind);
      let calls = 0;
      app.prompt(Promise.resolve({ outcome: 'dismissed' }), async () => {
        calls += 1;
        if (outcome === 'error') throw new Error('native prompt unavailable');
      });
      await app.click();
      await app.click();
      assert.equal(calls, 1);
      assert.equal(app.box.hidden, false);
      assert.equal(app.saved.size, 0);
      const manual = kind === 'qr' ? app.node('install-manual').textContent : app.description.textContent;
      assert.match(manual, /메뉴/);
    });
  }

  test(`${file}: appinstalled consumes the event, keeps help, and does not suppress a reload or fresh retry`, async () => {
    const app = await runtime(file, kind);
    let calls = 0;
    app.prompt(Promise.resolve({ outcome: 'accepted' }), async () => { calls += 1; });
    app.events.get('appinstalled')();
    app.assertPending();
    assert.equal(app.saved.size, 0);
    await app.click();
    assert.equal(calls, 0, 'appinstalled consumed the old native event');
    app.prompt(Promise.resolve({ outcome: 'accepted' }), async () => { calls += 1; });
    await app.click();
    await app.click();
    assert.equal(calls, 1, 'a fresh native event is accepted and used once');
    assert.equal(app.saved.size, 0);
    const reload = await runtime(file, kind, { saved: app.saved });
    reload.prompt(Promise.resolve({ outcome: 'accepted' }), async () => { calls += 1; });
    await reload.click();
    reload.assertPending();
    assert.equal(calls, 2, 'a failed package install cannot persistently suppress retry');
  });

  for (const outcome of ['accepted', 'dismissed', 'error']) {
    test(`${file}: early appinstalled is not overwritten by late ${outcome}`, async () => {
      const app = await runtime(file, kind);
      let resolveChoice, rejectPrompt;
      const choice = new Promise(resolve => { resolveChoice = resolve; });
      const nativeRequest = outcome === 'error' ? new Promise((resolve, reject) => { rejectPrompt = reject; }) : Promise.resolve();
      let calls = 0;
      app.prompt(choice, () => { calls += 1; return nativeRequest; });
      const click = app.click();
      await Promise.resolve();
      app.events.get('appinstalled')();
      app.assertPending();
      if (outcome === 'error') rejectPrompt(new Error('package install failed'));
      else resolveChoice({ outcome });
      await click;
      app.assertPending();
      assert.equal(calls, 1);
      assert.equal(app.saved.size, 0);
    });
  }

  test(`${file}: a late result cannot overwrite a newer native offer`, async () => {
    const app = await runtime(file, kind);
    let resolveChoice;
    app.prompt(new Promise(resolve => { resolveChoice = resolve; }));
    const oldClick = app.click();
    await Promise.resolve();
    app.events.get('appinstalled')();
    let calls = 0;
    app.prompt(Promise.resolve({ outcome: 'accepted' }), async () => { calls += 1; });
    const before = [app.button.hidden, app.button.disabled, app.description.textContent];
    resolveChoice({ outcome: 'dismissed' });
    await oldClick;
    assert.deepEqual([app.button.hidden, app.button.disabled, app.description.textContent], before);
    await app.click();
    assert.equal(calls, 1);
    app.assertPending();
  });

  if (['nudge', 'offer'].includes(kind)) {
    test(`${file}: explicit close remains durable and late events cannot reopen it`, async () => {
      const app = await runtime(file, kind);
      let resolveChoice;
      app.prompt(new Promise(resolve => { resolveChoice = resolve; }));
      const oldClick = app.click();
      await Promise.resolve();
      await app.click('close');
      const before = app.description.textContent;
      app.events.get('appinstalled')();
      resolveChoice({ outcome: 'accepted' });
      await oldClick;
      app.prompt(Promise.resolve({ outcome: 'accepted' }));
      assert.equal(app.box.hidden, true);
      assert.equal(app.description.textContent, before);
      assert.equal(app.saved.size, 1);
      const reload = await runtime(file, kind, { saved: app.saved });
      assert.equal(reload.box.hidden, true);
      assert.equal(reload.events.has('appinstalled'), false);
      assert.deepEqual([...reload.saved], [...app.saved]);
    });
  }

  test(`${file}: actual standalone display keeps the existing promotion policy`, async () => {
    const app = await runtime(file, kind, { standalone: true });
    if (kind === 'qr') {
      assert.equal(app.button.hidden, true);
      assert.match(app.description.textContent, /단독 창/);
    } else assert.equal(app.box.hidden, true);
    assert.equal(app.saved.size, 0);
  });
}
