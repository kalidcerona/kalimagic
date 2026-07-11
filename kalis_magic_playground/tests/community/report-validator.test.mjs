import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportPayload } from '../../netlify/functions/_lib/validators.mjs';

const targetId = '11111111-1111-4111-8111-111111111111';

test('validateReportPayload accepts and trims post and comment reports', () => {
  assert.deepEqual(validateReportPayload({
    targetType: 'post',
    targetId,
    reason: ' 광고성 게시물입니다. '
  }), {
    targetType: 'post',
    targetId,
    reason: '광고성 게시물입니다.'
  });

  assert.equal(validateReportPayload({
    targetType: 'comment',
    targetId,
    reason: '부적절한 댓글'
  }).targetType, 'comment');
});

test('validateReportPayload rejects invalid targets, ids, and reason lengths', () => {
  assert.throws(() => validateReportPayload(null), /invalid report payload/);
  assert.throws(() => validateReportPayload({ targetType: 'answer', targetId, reason: '신고' }), /target type/);
  assert.throws(() => validateReportPayload({ targetType: 'post', targetId: 'bad-id', reason: '신고' }), /target id/);
  assert.throws(() => validateReportPayload({ targetType: 'post', targetId, reason: '   ' }), /reason/);
  assert.throws(() => validateReportPayload({ targetType: 'post', targetId, reason: '가'.repeat(301) }), /reason/);
});
