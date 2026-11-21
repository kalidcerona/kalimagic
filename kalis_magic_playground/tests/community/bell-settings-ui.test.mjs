import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSettings } from '../../distribution-snapshots/bell/settings.mjs';

test('appearance preferences survive reopen and notify the performance when storage is unavailable', t => {
  const fields = new Map();
  const doc = new EventTarget();
  doc.querySelector = selector => {
    if (!fields.has(selector)) fields.set(selector, { add() {} });
    return fields.get(selector);
  };
  const dialog = doc.querySelector('dialog');
  Object.assign(dialog, { querySelector: doc.querySelector, close() { this.open = false; }, showModal() { this.open = true; } });
  const values = new Map([['friend-bell.background.v1', 'dark'], ['friend-bell.cardBack.v1', 'invalid']]);
  for (const [key, value] of Object.entries({
    document: doc, window: { matchMedia: () => ({ matches: false }) }, navigator: {},
    Option: class {}, localStorage: { getItem: key => values.get(key), setItem: () => { throw Error(); } },
  })) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => prior ? Object.defineProperty(globalThis, key, prior) : delete globalThis[key]);
  }
  const panel = setupSettings(() => {});
  panel.open();
  assert.equal(doc.querySelector('#background').value, 'dark');
  const card = doc.querySelector('#cardBack');
  assert.equal(card.value, 'blue');
  const appearance = t.mock.fn();
  doc.addEventListener('bell:appearance', appearance);
  card.value = 'red';
  card.onchange();
  assert.deepEqual(appearance.mock.calls[0].arguments[0].detail, { cardBack: 'red' });
  const reset = t.mock.fn();
  doc.addEventListener('bell:next-performance', reset);
  doc.querySelector('#next').onclick();
  assert.equal(reset.mock.callCount(), 1);
  assert.equal(dialog.open, false);
  panel.open();
  assert.equal(card.value, 'red');
});
