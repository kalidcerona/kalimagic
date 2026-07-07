import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handler,
  shapePost,
  shouldIncrementView
} from '../../netlify/functions/post-detail.mjs';

const publicRow = {
  id: '11111111-1111-4111-8111-111111111111',
  post_type: 'question',
  category: 'question',
  title: '이 마술은 어디서 배워야 하나요?',
  body: '처음 보는 계열이라 어떤 자료부터 보면 좋을지 궁금합니다.',
  youtube_video_id: 'abcDEF123_4',
  author_user_id: 'author-1',
  display_mode: 'nickname',
  visibility: 'public',
  status: 'visible',
  created_at: '2026-07-07T00:00:00.000Z',
  view_count: 9,
  is_notice: true,
  profiles: { nickname: '마술인07' }
};

test('post detail rejects malformed ids before loading the post', async () => {
  const response = await handler({
    httpMethod: 'GET',
    queryStringParameters: { id: 'not-a-uuid' }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'invalid_id' });
});

test('post detail treats missing ids as invalid ids', async () => {
  const response = await handler({
    httpMethod: 'GET',
    queryStringParameters: {}
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'invalid_id' });
});

test('post detail includes counts when body is readable', () => {
  const shaped = shapePost(publicRow, null, {
    viewCount: 10,
    likeCount: 4,
    viewerLiked: false
  });

  assert.equal(shaped.canReadBody, true);
  assert.equal(shaped.viewCount, 10);
  assert.equal(shaped.likeCount, 4);
  assert.equal(shaped.viewerLiked, false);
  assert.equal(shaped.isNotice, true);
});

test('post detail hides counts and youtube id when body is locked', () => {
  const row = {
    ...publicRow,
    visibility: 'expert_only',
    author_user_id: 'author-2',
    view_count: 12
  };
  const shaped = shapePost(row, { userId: 'member-1', role: 'member' }, {
    viewCount: 13,
    likeCount: 8,
    viewerLiked: true
  });

  assert.equal(shaped.canReadBody, false);
  assert.equal(shaped.bodyLocked, true);
  assert.equal(shaped.body, '');
  assert.equal(shaped.youtubeVideoId, null);
  assert.equal(shaped.viewCount, null);
  assert.equal(shaped.likeCount, null);
  assert.equal(shaped.viewerLiked, false);
});

test('shouldIncrementView only allows visible readable posts', () => {
  assert.equal(shouldIncrementView(publicRow, null), true);
  assert.equal(shouldIncrementView({ ...publicRow, status: 'hidden' }, { role: 'admin' }), false);
  assert.equal(shouldIncrementView({
    ...publicRow,
    visibility: 'kali_only',
    author_user_id: 'author-2'
  }, { userId: 'member-1', role: 'member' }), false);
  assert.equal(shouldIncrementView({
    ...publicRow,
    visibility: 'kali_only',
    author_user_id: 'author-2'
  }, { userId: 'kali-1', role: 'kali' }), true);
});
