import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storedMode} from '../../distribution-snapshots/kairos/logic.js';

test('shared stopwatch first paint is landscape before module initialization', () => {
  const html=readFileSync(new URL('../../distribution-snapshots/kairos/index.html',import.meta.url),'utf8');
  assert.match(html, /<main id="shell" data-ui-mode="landscape">/);
  assert.match(html, /<section id="portrait-app"[^>]*\bhidden\b/);
  assert.doesNotMatch(html.match(/<section id="landscape-frame"[^>]*>/)[0], /\bhidden\b/);
  assert.match(html, /let uiMode="landscape",state="idle"/);
});

test('shared default retains stored choices and never rewrites storage while reading', () => {
  for (const [value,expected] of [[null,'landscape'],['portrait','portrait'],['landscape','landscape']]) {
    assert.equal(storedMode({getItem:()=>value,setItem:()=>assert.fail('read must not write')}),expected);
  }
  assert.equal(storedMode({getItem(){throw Error('unreadable');}}),'landscape');
});
