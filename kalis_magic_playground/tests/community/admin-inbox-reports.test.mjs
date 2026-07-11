import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateReports, shapeReport } from '../../netlify/functions/admin-inbox.mjs';

test('aggregateReports groups targets and sorts by latest report then count', () => {
  const groups = aggregateReports([
    { target_type: 'post', target_id: 'post-1', created_at: '2026-07-14T01:00:00.000Z' },
    { target_type: 'post', target_id: 'post-1', created_at: '2026-07-14T03:00:00.000Z' },
    { target_type: 'comment', target_id: 'comment-1', created_at: '2026-07-14T02:00:00.000Z' }
  ]);

  assert.deepEqual(groups, [
    {
      targetType: 'post',
      targetId: 'post-1',
      reportCount: 2,
      latestReportedAt: '2026-07-14T03:00:00.000Z'
    },
    {
      targetType: 'comment',
      targetId: 'comment-1',
      reportCount: 1,
      latestReportedAt: '2026-07-14T02:00:00.000Z'
    }
  ]);
});

test('shapeReport includes comment author and parent post context', () => {
  const item = shapeReport({
    targetType: 'comment',
    targetId: 'comment-1',
    reportCount: 3,
    latestReportedAt: '2026-07-14T03:00:00.000Z'
  }, {
    posts: new Map(),
    comments: new Map([['comment-1', {
      id: 'comment-1',
      post_id: 'post-1',
      body: '신고된 댓글',
      status: 'visible',
      profiles: { nickname: '댓글 작성자' },
      posts: { id: 'post-1', title: '원문 제목', status: 'visible' }
    }]])
  });

  assert.equal(item.title, '원문 제목');
  assert.equal(item.authorLabel, '댓글 작성자');
  assert.equal(item.postId, 'post-1');
  assert.equal(item.reportCount, 3);
  assert.equal(item.commentBody, '신고된 댓글');
});
