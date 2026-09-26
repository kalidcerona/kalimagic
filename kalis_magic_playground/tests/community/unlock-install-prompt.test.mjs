import test from 'node:test';
import assert from 'node:assert/strict';
import { installInstructions, shouldOfferInstall, installStorageKey } from '../../zz2/install-prompt.js';

test('Android Chrome keeps a menu fallback when the native install prompt is unavailable', () => {
  assert.match(installInstructions('Mozilla/5.0 (Linux; Android 15) Chrome/140.0'), /⋮.*홈 화면에 추가/);
  assert.equal(shouldOfferInstall({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0', standalone: false, dismissed: false }), true);
});

test('iPhone Safari receives manual Add to Home Screen instructions', () => {
  assert.match(installInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'), /공유.*홈 화면에 추가/);
  assert.equal(shouldOfferInstall({ userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1', standalone: false, dismissed: false }), true);
});

test('iPhone Chrome uses its own Share menu wording', () => {
  assert.match(installInstructions('Mozilla/5.0 (iPhone) CriOS/140.0'), /Chrome 공유.*홈 화면에 추가/);
});

test('installed or dismissed apps do not show the first-run offer', () => {
  assert.equal(shouldOfferInstall({ userAgent: 'Android', standalone: true, dismissed: false }), false);
  assert.equal(shouldOfferInstall({ userAgent: 'iPhone', standalone: false, dismissed: true }), false);
});

test('personal and shared unlock remember dismissal separately', () => {
  assert.notEqual(installStorageKey('/zz2/'), installStorageKey('/tools/unlock/'));
});

test('the first Android visit offers installation and uses Chrome’s native prompt after a tap', async () => {
  const saved = new Map();
  const windowEvents = new Map();
  const elements = new Map(['install-offer', 'install-action', 'install-later', 'install-instructions'].map((id) => [id, {
    hidden: id !== 'install-action' && id !== 'install-later',
    textContent: '',
    events: new Map(),
    addEventListener(name, listener) { this.events.set(name, listener); }
  }]));
  const globals = ['document', 'navigator', 'location', 'matchMedia', 'localStorage', 'window'];
  const prior = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    Object.assign(globalThis, {
      document: { getElementById: (id) => elements.get(id) },
      navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0' },
      location: { pathname: '/zz2/' },
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
      window: { addEventListener: (name, listener) => windowEvents.set(name, listener) }
    });
    await import('../../zz2/install-prompt.js?runtime-android');
    assert.equal(elements.get('install-offer').hidden, false);
    let nativePromptCalls = 0;
    windowEvents.get('beforeinstallprompt')({
      preventDefault() {},
      async prompt() { nativePromptCalls += 1; return { outcome: 'accepted' }; }
    });
    assert.equal(elements.get('install-action').textContent, '설치');
    await elements.get('install-action').events.get('click')();
    assert.equal(nativePromptCalls, 1);
    assert.equal(elements.get('install-offer').hidden, true);
    assert.equal(saved.get(installStorageKey('/zz2/')), '1');
  } finally {
    for (const key of globals) {
      const descriptor = prior.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
