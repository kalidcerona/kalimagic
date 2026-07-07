import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyListFilters,
  boardCategoryForCategory,
  hasPrivilegedRole,
  prefixForCategory,
  shapePostListRow
} from '../../netlify/functions/posts.mjs';

function fakeQuery() {
  const calls = [];
  return {
    calls,
    neq(column, value) {
      calls.push(['neq', column, value]);
      return this;
    },
    eq(column, value) {
      calls.push(['eq', column, value]);
      return this;
    },
    in(column, value) {
      calls.push(['in', column, value]);
      return this;
    },
    or(value) {
      calls.push(['or', value]);
      return this;
    }
  };
}

const baseRow = {
  id: '11111111-1111-4111-8111-111111111111',
  post_type: 'review_comment',
  category: 'review',
  title: '이 덱 직접 써본 후기',
  body: '실전에서 반응이 좋았습니다.',
  youtube_video_id: 'abcDEF123_4',
  author_user_id: 'author-1',
  display_mode: 'nickname',
  visibility: 'public',
  status: 'visible',
  created_at: '2026-07-07T00:00:00.000Z',
  view_count: 12,
  is_notice: false,
  profiles: { nickname: '마술인07' }
};

test('posts list maps prefixes and board categories', () => {
  assert.equal(prefixForCategory('question'), '질문');
  assert.equal(prefixForCategory('review'), '도구');
  assert.equal(prefixForCategory('event_review'), '모임');
  assert.equal(prefixForCategory('magazine'), '매거진');
  assert.equal(boardCategoryForCategory('event_review'), 'review');
  assert.equal(boardCategoryForCategory('review'), 'review');
});

test('posts list hides counts and viewer like state when body cannot be read', () => {
  const row = {
    ...baseRow,
    category: 'question',
    post_type: 'question',
    visibility: 'expert_only',
    author_user_id: 'author-2',
    view_count: 42
  };

  const shaped = shapePostListRow(row, { userId: 'member-1', role: 'member' }, {
    commentCounts: new Map([[row.id, 3]]),
    likeCounts: new Map([[row.id, 7]]),
    viewerLikedPostIds: new Set([row.id])
  });

  assert.equal(shaped.canReadBody, false);
  assert.equal(shaped.bodyLocked, true);
  assert.equal(shaped.viewCount, null);
  assert.equal(shaped.likeCount, null);
  assert.equal(shaped.viewerLiked, false);
  assert.equal(shaped.commentCount, 3);
  assert.equal(shaped.authorLabel, '익명');
});

test('posts list includes counts and notice flag when body can be read', () => {
  const shaped = shapePostListRow({ ...baseRow, is_notice: true }, null, {
    commentCounts: new Map([[baseRow.id, 2]]),
    likeCounts: new Map([[baseRow.id, 5]]),
    viewerLikedPostIds: new Set()
  });

  assert.equal(shaped.prefix, '도구');
  assert.equal(shaped.boardCategory, 'review');
  assert.equal(shaped.viewCount, 12);
  assert.equal(shaped.likeCount, 5);
  assert.equal(shaped.viewerLiked, false);
  assert.equal(shaped.isNotice, true);
});

test('applyListFilters matches category and reviewKind rules', () => {
  const all = fakeQuery();
  applyListFilters(all, { category: 'all', reviewKind: null });
  assert.deepEqual(all.calls, [['neq', 'category', 'free']]);

  const review = fakeQuery();
  applyListFilters(review, { category: 'review', reviewKind: null });
  assert.deepEqual(review.calls, [['in', 'category', ['review', 'event_review']]]);

  const tool = fakeQuery();
  applyListFilters(tool, { category: 'review', reviewKind: 'tool' });
  assert.deepEqual(tool.calls, [['eq', 'category', 'review']]);

  const meeting = fakeQuery();
  applyListFilters(meeting, { category: 'review', reviewKind: 'meeting' });
  assert.deepEqual(meeting.calls, [['eq', 'category', 'event_review']]);

  const question = fakeQuery();
  applyListFilters(question, { category: 'question', reviewKind: null });
  assert.deepEqual(question.calls, [['eq', 'category', 'question']]);
});

test('magazine list combines magazine posts and candidate questions', () => {
  const magazine = fakeQuery();
  applyListFilters(magazine, { category: 'magazine', reviewKind: null });
  assert.deepEqual(magazine.calls, [[
    'or',
    'category.eq.magazine,and(category.eq.question,questions.magazine_candidate.eq.true)'
  ]]);
});

test('hasPrivilegedRole only allows admin and kali', () => {
  assert.equal(hasPrivilegedRole({ role: 'admin' }), true);
  assert.equal(hasPrivilegedRole({ role: 'kali' }), true);
  assert.equal(hasPrivilegedRole({ role: 'member' }), false);
  assert.equal(hasPrivilegedRole(null), false);
});
