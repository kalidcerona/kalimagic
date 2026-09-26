import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const app of ['zz1', 'zz3', 'tools/calc', 'tools/stopwatch']) {
  test(`${app} opens settings only after both fingers move at least 96px`, async () => {
    const html = await readFile(new URL(`../../${app}/index.html`, import.meta.url), 'utf8');
    const start = html.indexOf('function installSettingsSwipe(');
    const end = html.indexOf('// END SETTINGS SWIPE', start);
    assert.ok(start >= 0 && end > start);
    const listeners = new Map();
    const fakeWindow = { addEventListener(name, handler) { listeners.set(name, handler); } };
    const install = new Function('window', `${html.slice(start, end)}\nreturn installSettingsSwipe;`)(fakeWindow);
    let opened = 0;
    install(() => { opened += 1; }, () => {}, () => true);
    const event = (id, y) => ({ pointerType: 'touch', pointerId: id, clientX: id * 100, clientY: y,
      target: { closest: () => null }, preventDefault() {}, stopImmediatePropagation() {} });
    listeners.get('pointerdown')(event(1, 10));
    listeners.get('pointerdown')(event(2, 10));
    listeners.get('pointermove')(event(1, 90));
    listeners.get('pointermove')(event(2, 90));
    assert.equal(opened, 0);
    listeners.get('pointermove')(event(1, 110));
    listeners.get('pointermove')(event(2, 110));
    assert.equal(opened, 1);
  });
}

// RELEASE uses its shared gesture helper rather than the inline installer.
test('zz2 requires both fingers to move at least 96px in screen coordinates', async () => {
  const { isSettingsSwipe } = await import('../../zz2/time-machine.js');
  const start = [{ id: 1, x: 60, y: 10 }, { id: 2, x: 200, y: 10 }];
  assert.equal(isSettingsSwipe(start, [{ id: 1, x: 60, y: 105 }, { id: 2, x: 200, y: 105 }]), false);
  assert.equal(isSettingsSwipe(start, [{ id: 1, x: 60, y: 106 }, { id: 2, x: 200, y: 105 }]), false);
  assert.equal(isSettingsSwipe(start, [{ id: 1, x: 60, y: 106 }, { id: 2, x: 200, y: 106 }]), true);
});
