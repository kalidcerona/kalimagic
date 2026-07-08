import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeVideoId,
  validateAnswerPayload,
  validateCommentPayload,
  validateEventReviewPayload,
  validateListQuery,
  validateModerationPayload,
  validatePostIdPayload,
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
  }), /공개 범위/);
});

test('validators return Korean user-facing messages', () => {
  assert.throws(() => validatePostPayload({
    postType: 'question',
    title: '질',
    body: '충분히 긴 질문 본문입니다.',
    displayMode: 'nickname',
    visibility: 'public'
  }), /제목은 2자 이상 120자 이하로 적어주세요/);
  assert.throws(() => validatePostPayload({
    postType: 'question',
    title: '질문 제목',
    body: '짧음',
    displayMode: 'nickname',
    visibility: 'public'
  }), /내용은 10자 이상 5000자 이하로 적어주세요/);
  assert.throws(() => validatePostPayload({
    postType: 'question',
    title: '질문 제목',
    body: '충분히 긴 질문 본문입니다.',
    displayMode: 'nickname',
    visibility: 'public',
    youtubeUrl: 'https://example.com/watch?v=abcDEF123_4'
  }), /유튜브 링크 형식이 올바르지 않습니다/);
});

test('validateEventReviewPayload requires 2 to 5 photo ids', () => {
  assert.throws(() => validateEventReviewPayload({
    eventCode: '2026-08',
    photoIds: ['p1'],
    goodMoment: '좋았던 순간이 있었습니다.',
    impressiveScene: '분위기가 인상 깊었습니다.',
    nextProgram: '다음엔 카드 코너가 더 있으면 좋겠습니다.',
    messageToFirstTimer: '처음 와도 편합니다.'
  }), /사진은 2장 이상 5장 이하로 올려주세요/);
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
  }), /답변 공개 범위/);
  assert.throws(() => validateModerationPayload({
    action: 'hide',
    postId: 'not-a-uuid',
    reason: '확인 필요'
  }), /게시글 ID/);
  assert.throws(() => validateModerationPayload({
    action: 'hide',
    postId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    reason: 'x'.repeat(501)
  }), /사유는 500자 이하로 적어주세요/);
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

test('validatePostPayload accepts free and routine posts and keeps event review writes on the event review api', () => {
  const free = validatePostPayload({
    postType: 'free',
    title: '오늘 연습 기록',
    body: '오늘의 연습과 느낀 점을 남깁니다.',
    displayMode: 'nickname',
    visibility: 'public'
  });
  assert.equal(free.postType, 'free');
  assert.equal(free.category, 'free');

  const routine = validatePostPayload({
    postType: 'routine',
    title: '오늘 배운 루틴',
    body: '동작 순서와 연출 포인트를 정리합니다.',
    displayMode: 'nickname',
    visibility: 'expert_only'
  });
  assert.equal(routine.postType, 'routine');
  assert.equal(routine.category, 'routine');
  assert.equal(routine.visibility, 'expert_only');

  assert.throws(() => validatePostPayload({
    postType: 'event_review',
    title: '이번 모임 다녀온 후기',
    body: '모임에서 느낀 분위기와 기억을 남깁니다.',
    displayMode: 'nickname',
    visibility: 'public'
  }), /모임 후기는 모임 후기 API를 사용해주세요/);
});

test('validatePostPayload maps review comments and magazine posts', () => {
  const review = validatePostPayload({
    postType: 'review_comment',
    title: '이 덱 직접 써본 후기',
    body: '실전에서 반응이 좋았고 입문자에게도 설명하기 쉬웠습니다.',
    displayMode: 'nickname',
    visibility: 'public'
  });
  assert.equal(review.postType, 'review_comment');
  assert.equal(review.category, 'review');

  const magazine = validatePostPayload({
    postType: 'magazine',
    title: '처음 마술을 배우는 사람에게 필요한 질문',
    body: '입문자가 다시 찾아볼 수 있도록 핵심 질문과 답변을 정리합니다.',
    displayMode: 'nickname',
    visibility: 'public'
  });
  assert.equal(magazine.postType, 'magazine');
  assert.equal(magazine.category, 'magazine');
});

test('validateListQuery clamps pagination and validates review filters', () => {
  assert.deepEqual(validateListQuery({ category: 'review', reviewKind: 'tool', limit: '99', offset: '40' }), {
    category: 'review',
    reviewKind: 'tool',
    limit: 20,
    offset: 40
  });
  assert.deepEqual(validateListQuery({}), {
    category: 'all',
    reviewKind: null,
    limit: 20,
    offset: 0
  });
  assert.deepEqual(validateListQuery({ category: 'free' }), {
    category: 'free',
    reviewKind: null,
    limit: 20,
    offset: 0
  });
  assert.deepEqual(validateListQuery({ category: 'routine' }), {
    category: 'routine',
    reviewKind: null,
    limit: 20,
    offset: 0
  });
  assert.throws(() => validateListQuery({ category: 'review', reviewKind: 'random' }), /리뷰 말머리가 올바르지 않습니다/);
  assert.throws(() => validateListQuery({ offset: '-1' }), /페이지 위치가 올바르지 않습니다/);
});

test('validatePostIdPayload requires uuid post id', () => {
  assert.deepEqual(validatePostIdPayload({
    postId: '11111111-1111-4111-8111-111111111111'
  }), {
    postId: '11111111-1111-4111-8111-111111111111'
  });
  assert.throws(() => validatePostIdPayload({ postId: 'bad-id' }), /게시글 ID가 올바르지 않습니다/);
});

test('validateModerationPayload accepts notice pin actions', () => {
  assert.deepEqual(validateModerationPayload({
    action: 'pin_notice',
    postId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    reason: '공지로 고정'
  }), {
    action: 'pin_notice',
    postId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    reason: '공지로 고정',
    visibility: null
  });

  assert.deepEqual(validateModerationPayload({
    action: 'unpin_notice',
    postId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    reason: ''
  }), {
    action: 'unpin_notice',
    postId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    reason: null,
    visibility: null
  });
});
