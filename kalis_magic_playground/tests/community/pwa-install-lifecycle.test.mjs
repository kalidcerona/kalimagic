import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const ROOT = new URL('../../', import.meta.url);
const PROMPTS = [
  ['zz2/install-prompt.js', 'offer'], ['distribution-snapshots/unlock/install-prompt.js', 'offer'],
  ['zz4/install-prompt.js', 'card'], ['zz5/install-prompt.js', 'card'],
  ['distribution-snapshots/aletheia/install-prompt.js', 'card'],
  ['zz6/install-prompt.js', 'panel'], ['zz7/install-prompt.js', 'panel'],
  ['distribution-snapshots/tobira/install-prompt.js', 'panel'],
  ['distribution-snapshots/usotsuki/install-prompt.js', 'panel'],
  ['zz8/install-ui.js', 'control'],
  ['zz1/index.html', 'nudge'], ['zz3/index.html', 'nudge'],
  ['distribution-snapshots/kairos/index.html', 'nudge'],
  ['distribution-snapshots/calculator/index.html', 'nudge'],
];

async function runtime(file, kind) {
  let source = await readFile(new URL(file, ROOT), 'utf8');
  if (kind === 'nudge') {
    source = [...source.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]).find((script) => /install.nudge.done|installNudgeDone/i.test(script));
    assert.ok(source, file);
  }
  const saved = new Map(), events = new Map(), nodes = new Map();
  function node(key) {
    if (!nodes.has(key)) nodes.set(key, {
      hidden: false, textContent: '', events: new Map(),
      addEventListener(name, handler) { this.events.set(name, handler); },
      querySelector(selector) { return node(selector); },
      remove() { this.hidden = true; },
    });
    return nodes.get(key);
  }
  const box = node(kind === 'offer' ? 'install-offer' : kind === 'card' ? '[data-install-card]'
    : kind === 'panel' ? '#install-panel, .install-panel' : kind === 'control' ? 'install-control' : 'bar');
  const button = node(kind === 'offer' ? 'install-action' : kind === 'card' ? '[data-install-button]'
    : kind === 'panel' ? '#install-action, [data-install-action]' : kind === 'control' ? 'install-app' : 'button');
  const description = node(kind === 'offer' ? 'install-instructions' : kind === 'card' ? '[data-install-guidance]'
    : kind === 'panel' ? '#install-instructions, [data-install-instructions]' : kind === 'control' ? 'install-help' : 'span');
  const media = () => ({ matches: false, addEventListener() {} });
  const navigator = { userAgent: 'Mozilla/5.0 Android Chrome/140', standalone: false };
  const window = { navigator, matchMedia: media, addEventListener(name, handler) { events.set(name, handler); } };
  runInNewContext(source.replace(/export function /g, 'function '), {
    window, navigator, matchMedia: media, location: { pathname: '/zz2/', hash: '' },
    localStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    document: { getElementById: node, querySelector: node, createElement: () => box, body: { appendChild() {} } },
  }, { filename: file });
  const click = async () => (kind === 'nudge' ? box : button).events.get('click')({
    stopPropagation() {}, target: { closest: () => ({ dataset: { act: 'install' } }) },
  });
  return { saved, events, box, description, click };
}

for (const [file, kind] of PROMPTS) {
  test(`${file}: acceptance and appinstalled keep browser-tab help available`, async () => {
    const app = await runtime(file, kind);
    let calls = 0;
    app.events.get('beforeinstallprompt')({ preventDefault() {},
      async prompt() { calls += 1; return { outcome: 'accepted' }; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    await app.click();
    assert.equal(calls, 1);
    assert.equal(app.box.hidden, false);
    assert.equal(app.saved.size, 0);
    assert.match(app.description.textContent, /설치 요청/);
    await app.click();
    assert.equal(calls, 1, 'the consumed browser event is never reused');
    app.events.get('appinstalled')();
    assert.equal(app.box.hidden, false);
    assert.equal(app.saved.size, 0);
    assert.match(app.description.textContent, /설치 요청.*아이콘.*메뉴/);
  });

  for (const result of ['dismissed', 'error']) {
    test(`${file}: ${result} keeps manual installation available`, async () => {
      const app = await runtime(file, kind);
      app.events.get('beforeinstallprompt')({ preventDefault() {},
        async prompt() { if (result === 'error') throw new Error('prompt failed'); },
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      });
      await app.click();
      assert.equal(app.box.hidden, false);
      assert.equal(app.saved.size, 0);
      assert.match(app.description.textContent, /메뉴/);
    });
  }
}
