import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../../distribution-snapshots/aletheia/', import.meta.url);
const html = readFileSync(new URL('index.html', dir), 'utf8');
const app = readFileSync(new URL('app.js', dir), 'utf8');

test('shared ALETHEIA gesture-guide setup runs against its published HTML', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const events = [];
  const document = { getElementById(id) {
    return ids.has(id) ? { addEventListener(type) { events.push([id, type]); } } : null;
  } };
  const setup = app.slice(app.indexOf('const gestureGuide ='), app.indexOf('const STORAGE_KEY ='));
  assert.doesNotThrow(() => vm.runInNewContext(setup, { document }));
  assert.ok(events.some(([id, type]) => id === 'settings-gesture-dismiss' && type === 'click'));
  assert.match(html, /id="settings-gesture-guide"[^>]*\bhidden/);
  const css = readFileSync(new URL('style.css', dir), 'utf8');
  assert.match(css, /\.gesture-guide\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});
