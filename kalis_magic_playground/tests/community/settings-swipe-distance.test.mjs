import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const app of ['zz2', 'zz3', 'zz4', 'zz6', 'tools/calc', 'tools/stopwatch']) {
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
