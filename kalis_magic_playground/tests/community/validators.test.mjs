import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeVideoId,
  validateAnswerPayload,
  validateCommentPayload,
  validateEventReviewPayload,
  validateModerationPayload,
  validatePostPayload
} from '../../netlify/functions/_lib/validators.mjs';
import { defaultProfileNickname } from '../../netlify/functions/_lib/auth.mjs';

test('parseYouTubeVideoId accepts supported YouTube formats', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=abcDEF123_4'), 'abcDEF123_4');
  assert.equal(parseYouTubeVideoId('https://youtu.be/abcDEF123_4'), 'abcDEF123_4');
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/shorts/abcDEF123_4'), 'abcDEF123_4');
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/embed/abcDEF123_4'), 'abcDEF123_4');
});

test('parseYouTubeVideoId rejects non-YouTube URLs and malformed IDs', () => {
  assert.equal(parseYouTubeVideoId('https://example.com/watch?v=abcDEF123_4'), null);
  assert.equal(parseYouTubeVideoId('https://youtu.be/too-short'), null);
});

test('validatePostPayload accepts a public question', () => {
  const payload = validatePostPayload({
    postType: 'question',
    title: '이 마술은 어디서 배워야 하나요?',
    body: '처음 보는 계열이라 어떤 자료부터 보면 좋을지 궁금합니다.',
    displayMode: 'anonymous',
    visibility: 'public',
    youtubeUrl: ''
  });
  assert.equal(payload.postType, 'question');
  assert.equal(payload.youtubeVideoId, null);
  assert.equal(defaultProfileNickname('a@example.com', () => 7), '마술인07');
  assert.equal(defaultProfileNickname('abcdefghijklmnopqrstuvwxy@example.com'), 'abcdefghijklmnopqrstuvwx');
});

test('validatePostPayload rejects invalid visibility and short body', () => {
  assert.throws(() => validatePostPayload({
    postType: 'question',
    title: '질문',
    body: '짧음',
    displayMode: 'nickname',
    visibility: 'everyone'
  }), /visibility/);
});

test('validateEventReviewPayload requires 2 to 5 photo ids', () => {
  assert.throws(() => validateEventReviewPayload({
    eventCode: '2026-08',
    photoIds: ['p1'],
    goodMoment: '좋았던 순간이 있었습니다.',
    impressiveScene: '분위기가 인상 깊었습니다.',
    nextProgram: '다음엔 카드 코너가 더 있으면 좋겠습니다.',
    messageToFirstTimer: '처음 와도 편합니다.'
  }), /photoIds/);
});

test('validateEventReviewPayload accepts optional YouTube links', () => {
  const payload = validateEventReviewPayload({
    eventCode: '2026-08',
    photoIds: [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    ],
    goodMoment: '같이 웃던 순간이 좋았습니다.',
    impressiveScene: '눈앞에서 카드가 바뀌던 장면이 기억납니다.',
    nextProgram: '다음엔 관객 참여 코너가 더 있으면 좋겠습니다.',
    messageToFirstTimer: '처음 와도 편하게 즐길 수 있습니다.',
    youtubeUrl: 'https://www.youtube.com/watch?v=abcDEF123_4'
  });
  assert.equal(payload.youtubeVideoId, 'abcDEF123_4');
});


test('validateCommentPayload accepts parent comment id for replies', () => {
  const payload = validateCommentPayload({
    postId: '11111111-1111-4111-8111-111111111111',
    parentCommentId: '22222222-2222-4222-8222-222222222222',
    body: '저도 같은 생각입니다.',
    displayMode: 'nickname'
  });
  assert.equal(payload.parentCommentId, '22222222-2222-4222-8222-222222222222');
});

test('validateAnswerPayload accepts author only answers with optional YouTube links', () => {
  const payload = validateAnswerPayload({
    questionPostId: '11111111-1111-4111-8111-111111111111',
    body: '이 질문은 먼저 기초 카드 핸들링부터 잡는 게 좋겠습니다.',
    visibility: 'author_only',
    youtubeUrl: 'https://youtu.be/abcDEF123_4'
  });
  assert.equal(payload.visibility, 'author_only');
  assert.equal(payload.youtubeVideoId, 'abcDEF123_4');
});

test('validateAnswerPayload rejects invalid visibility', () => {
  assert.throws(() => validateAnswerPayload({
    questionPostId: '11111111-1111-4111-8111-111111111111',
    body: '좋은 질문입니다.',
    visibility: 'expert_only'
  }), /visibility/);
  assert.throws(() => validateModerationPayload({
    action: 'hide',
    postId: 'not-a-uuid',
    reason: '확인 필요'
  }), /postId/);
  assert.throws(() => validateModerationPayload({
    action: 'hide',
    postId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    reason: 'x'.repeat(501)
  }), /reason/);
  assert.deepEqual(validateModerationPayload({
    action: 'hide',
    postId: 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
    reason: ' 확인 필요 '
  }), {
    action: 'hide',
    postId: 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
    reason: '확인 필요',
    visibility: null
  });
});
