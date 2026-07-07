import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  nextLikeMutation,
  shapeLikeResponse
} from '../../netlify/functions/post-likes.mjs';

test('nextLikeMutation inserts when viewer has not liked and deletes when liked', () => {
  assert.equal(nextLikeMutation(null), 'insert');
  assert.equal(nextLikeMutation({ post_id: 'p1', user_id: 'u1' }), 'delete');
});

test('shapeLikeResponse returns current count and viewer state', () => {
  const response = shapeLikeResponse([
    { user_id: 'viewer-1' },
    { user_id: 'viewer-2' }
  ], { userId: 'viewer-1' });

  assert.deepEqual(response, {
    ok: true,
    likeCount: 2,
    viewerLiked: true
  });
});

test('post-likes handler uses requireViewer and body permission before toggling', () => {
  const source = readFileSync(new URL('../../netlify/functions/post-likes.mjs', import.meta.url), 'utf8');
  assert.match(source, /requireViewer\(event\)/);
  assert.match(source, /canReadPostBody/);
  assert.match(source, /로그인하면 추천할 수 있어요/);
  assert.match(source, /post_likes/);
});
