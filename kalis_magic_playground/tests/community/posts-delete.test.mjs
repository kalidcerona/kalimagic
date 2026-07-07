import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deleteDecision } from '../../netlify/functions/posts.mjs';

const post = {
  id: '11111111-1111-4111-8111-111111111111',
  post_type: 'question',
  author_user_id: 'author-1',
  status: 'visible'
};

test('deleteDecision rejects non owner posts', () => {
  assert.deepEqual(deleteDecision(post, { userId: 'other-1' }, 0), {
    ok: false,
    status: 403,
    body: { error: 'forbidden' }
  });
});

test('deleteDecision rejects answered questions with fixed Korean message', () => {
  assert.deepEqual(deleteDecision(post, { userId: 'author-1' }, 1), {
    ok: false,
    status: 400,
    body: {
      error: 'answered_question',
      message: '답변이 달린 질문은 삭제할 수 없어요'
    }
  });
});

test('deleteDecision allows owner visible posts without answers', () => {
  assert.deepEqual(deleteDecision(post, { userId: 'author-1' }, 0), {
    ok: true,
    status: 200,
    body: { ok: true, status: 'deleted' }
  });
});

test('posts handler exposes delete method and soft deletes status', () => {
  const source = readFileSync(new URL('../../netlify/functions/posts.mjs', import.meta.url), 'utf8');
  assert.match(source, /event\.httpMethod === 'DELETE'/);
  assert.match(source, /status: 'deleted'/);
  assert.match(source, /answers/);
});
