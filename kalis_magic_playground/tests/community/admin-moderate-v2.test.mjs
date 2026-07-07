import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextStatus, noticeValueForAction } from '../../netlify/functions/admin-moderate.mjs';

test('noticeValueForAction maps pin and unpin actions', () => {
  assert.equal(noticeValueForAction('pin_notice'), true);
  assert.equal(noticeValueForAction('unpin_notice'), false);
  assert.equal(noticeValueForAction('hide'), null);
});

test('nextStatus leaves notice actions on existing status', () => {
  assert.equal(nextStatus('hide'), 'hidden');
  assert.equal(nextStatus('restore'), 'visible');
  assert.equal(nextStatus('delete'), 'deleted');
  assert.equal(nextStatus('pin_notice'), null);
  assert.equal(nextStatus('unpin_notice'), null);
});

test('admin moderate records notice events without changing status', () => {
  const source = readFileSync(new URL('../../netlify/functions/admin-moderate.mjs', import.meta.url), 'utf8');
  assert.match(source, /is_notice/);
  assert.match(source, /before_status: before\.status/);
  assert.match(source, /after_status: status \|\| before\.status/);
  assert.match(source, /매거진 후보 지정은 질문 글에서만 사용할 수 있어요/);
});
