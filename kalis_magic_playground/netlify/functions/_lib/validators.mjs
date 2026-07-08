const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POST_TYPES = new Set(['question', 'event_review', 'review_comment', 'free', 'routine', 'magazine']);
const WRITABLE_POST_TYPES = new Set(['question', 'review_comment', 'free', 'routine', 'magazine']);
const LIST_CATEGORIES = new Set(['all', 'question', 'review', 'free', 'routine', 'magazine']);
const REVIEW_KINDS = new Set(['tool', 'meeting']);
const DISPLAY_MODES = new Set(['nickname', 'anonymous']);
const VISIBILITIES = new Set(['public', 'kali_only', 'expert_only']);
const ANSWER_VISIBILITIES = new Set(['public', 'author_only']);
const MODERATION_ACTIONS = new Set([
  'hide',
  'restore',
  'delete',
  'mark_magazine_candidate',
  'change_visibility',
  'pin_notice',
  'unpin_notice'
]);

function clean(value) {
  return String(value ?? '').trim();
}

function assertLength(name, value, min, max) {
  if (value.length < min || value.length > max) {
    throw new Error(lengthMessage(name, min, max));
  }
}

function lengthMessage(name, min, max) {
  const labels = {
    title: '제목',
    body: '내용',
    goodMoment: '좋았던 순간',
    impressiveScene: '인상 깊었던 장면',
    nextProgram: '다음에 보고 싶은 프로그램',
    messageToFirstTimer: '처음 오는 사람에게 남기는 말'
  };
  const label = labels[name] || name;
  return `${label}은 ${min}자 이상 ${max}자 이하로 적어주세요`;
}

function categoryForPostType(postType) {
  if (postType === 'question') return 'question';
  if (postType === 'review_comment') return 'review';
  if (postType === 'free') return 'free';
  if (postType === 'routine') return 'routine';
  if (postType === 'magazine') return 'magazine';
  return null;
}

function parseNonNegativeInteger(value, fallback) {
  const raw = clean(value);
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error('페이지 위치가 올바르지 않습니다');
  return Number(raw);
}

export function validateUuid(value) {
  return UUID.test(clean(value));
}

export function parseYouTubeVideoId(value) {
  const raw = clean(value);
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  let id = null;
  if (host === 'youtube.com' && url.pathname === '/watch') id = url.searchParams.get('v');
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  if (host === 'youtube.com' && url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2];
  if (host === 'youtube.com' && url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2];
  return id && YOUTUBE_ID.test(id) ? id : null;
}

function parseOptionalYouTubeVideoId(value) {
  const raw = clean(value);
  if (!raw) return null;
  const videoId = parseYouTubeVideoId(raw);
  if (!videoId) throw new Error('유튜브 링크 형식이 올바르지 않습니다');
  return videoId;
}

export function validatePostPayload(input) {
  const postType = clean(input.postType);
  const title = clean(input.title);
  const body = clean(input.body);
  const displayMode = clean(input.displayMode || 'nickname');
  const visibility = clean(input.visibility || 'public');

  if (!POST_TYPES.has(postType)) throw new Error('글 종류가 올바르지 않습니다');
  if (postType === 'event_review') throw new Error('모임 후기는 모임 후기 API를 사용해주세요');
  if (!WRITABLE_POST_TYPES.has(postType)) throw new Error('글 종류가 올바르지 않습니다');
  if (!DISPLAY_MODES.has(displayMode)) throw new Error('표시 이름 방식이 올바르지 않습니다');
  if (!VISIBILITIES.has(visibility)) throw new Error('공개 범위가 올바르지 않습니다');

  assertLength('title', title, 2, 120);
  assertLength('body', body, postType === 'question' ? 10 : 1, 5000);

  return {
    postType,
    category: categoryForPostType(postType),
    title,
    body,
    displayMode,
    visibility,
    youtubeVideoId: parseOptionalYouTubeVideoId(input.youtubeUrl),
    badgeCode: clean(input.badgeCode) || null
  };
}

export function validateListQuery(query = {}) {
  const category = clean(query.category || 'all');
  const rawReviewKind = clean(query.reviewKind);
  const rawLimit = clean(query.limit || '20');
  const offset = parseNonNegativeInteger(query.offset, 0);

  if (!LIST_CATEGORIES.has(category)) throw new Error('게시판 종류가 올바르지 않습니다');

  let reviewKind = null;
  if (rawReviewKind) {
    if (category !== 'review') throw new Error('리뷰 말머리는 리뷰 탭에서만 사용할 수 있습니다');
    if (!REVIEW_KINDS.has(rawReviewKind)) throw new Error('리뷰 말머리가 올바르지 않습니다');
    reviewKind = rawReviewKind;
  }

  if (rawLimit && !/^\d+$/.test(rawLimit)) throw new Error('페이지 크기가 올바르지 않습니다');
  const requestedLimit = rawLimit ? Number(rawLimit) : 20;
  const limit = Math.min(Math.max(requestedLimit || 20, 1), 20);

  return { category, reviewKind, limit, offset };
}

export function validatePostIdPayload(input = {}) {
  const postId = clean(input.postId || input.id);
  if (!validateUuid(postId)) throw new Error('게시글 ID가 올바르지 않습니다');
  return { postId };
}

export function validateEventReviewPayload(input) {
  const eventCode = clean(input.eventCode);
  const photoIds = Array.isArray(input.photoIds) ? input.photoIds : [];
  if (!eventCode) throw new Error('모임 정보가 올바르지 않습니다');
  if (photoIds.length < 2 || photoIds.length > 5) throw new Error('사진은 2장 이상 5장 이하로 올려주세요');
  for (const id of photoIds) {
    if (!UUID.test(id)) throw new Error('사진 정보가 올바르지 않습니다');
  }
  const goodMoment = clean(input.goodMoment);
  const impressiveScene = clean(input.impressiveScene);
  const nextProgram = clean(input.nextProgram);
  const messageToFirstTimer = clean(input.messageToFirstTimer);
  assertLength('goodMoment', goodMoment, 2, 1200);
  assertLength('impressiveScene', impressiveScene, 2, 1200);
  assertLength('nextProgram', nextProgram, 2, 1200);
  assertLength('messageToFirstTimer', messageToFirstTimer, 2, 1200);
  return {
    eventCode,
    photoIds,
    goodMoment,
    impressiveScene,
    nextProgram,
    messageToFirstTimer,
    youtubeVideoId: parseOptionalYouTubeVideoId(input.youtubeUrl)
  };
}

export function validateCommentPayload(input) {
  const postId = clean(input.postId);
  const parentCommentId = clean(input.parentCommentId);
  const body = clean(input.body);
  const displayMode = clean(input.displayMode || 'nickname');
  if (!UUID.test(postId)) throw new Error('게시글 ID가 올바르지 않습니다');
  if (parentCommentId && !UUID.test(parentCommentId)) throw new Error('부모 댓글 ID가 올바르지 않습니다');
  if (!DISPLAY_MODES.has(displayMode)) throw new Error('표시 이름 방식이 올바르지 않습니다');
  assertLength('body', body, 1, 1200);
  return { postId, parentCommentId: parentCommentId || null, body, displayMode };
}

export function validateAnswerPayload(input) {
  const questionPostId = clean(input.questionPostId);
  const body = clean(input.body);
  const visibility = clean(input.visibility || 'public');
  if (!UUID.test(questionPostId)) throw new Error('질문 ID가 올바르지 않습니다');
  if (!ANSWER_VISIBILITIES.has(visibility)) throw new Error('답변 공개 범위가 올바르지 않습니다');
  assertLength('body', body, 1, 5000);
  return {
    questionPostId,
    body,
    visibility,
    youtubeVideoId: parseOptionalYouTubeVideoId(input.youtubeUrl)
  };
}

export function validateModerationPayload(input) {
  const action = clean(input.action);
  const postId = clean(input.postId || input.targetId);
  const reason = clean(input.reason);
  const visibility = clean(input.visibility);
  if (!MODERATION_ACTIONS.has(action)) throw new Error('관리 작업이 올바르지 않습니다');
  if (!validateUuid(postId)) throw new Error('게시글 ID가 올바르지 않습니다');
  if (reason.length > 500) throw new Error('사유는 500자 이하로 적어주세요');
  if (action === 'change_visibility' && !VISIBILITIES.has(visibility)) {
    throw new Error('공개 범위가 올바르지 않습니다');
  }
  return {
    action,
    postId,
    reason: reason || null,
    visibility: visibility || null
  };
}
