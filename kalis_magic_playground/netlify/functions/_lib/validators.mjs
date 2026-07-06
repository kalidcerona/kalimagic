const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POST_TYPES = new Set(['question', 'event_review', 'review_comment', 'free', 'magazine']);
const DISPLAY_MODES = new Set(['nickname', 'anonymous']);
const VISIBILITIES = new Set(['public', 'kali_only', 'expert_only']);
const ANSWER_VISIBILITIES = new Set(['public', 'author_only']);
const MODERATION_ACTIONS = new Set(['hide', 'restore', 'delete', 'mark_magazine_candidate', 'change_visibility']);

function clean(value) {
  return String(value ?? '').trim();
}

function assertLength(name, value, min, max) {
  if (value.length < min || value.length > max) {
    throw new Error(`${name} must be ${min}-${max} characters`);
  }
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

export function validatePostPayload(input) {
  const postType = clean(input.postType);
  const title = clean(input.title);
  const body = clean(input.body);
  const displayMode = clean(input.displayMode || 'nickname');
  const visibility = clean(input.visibility || 'public');
  if (!POST_TYPES.has(postType)) throw new Error('postType is invalid');
  if (!DISPLAY_MODES.has(displayMode)) throw new Error('displayMode is invalid');
  if (!VISIBILITIES.has(visibility)) throw new Error('visibility is invalid');
  assertLength('title', title, 2, 120);
  assertLength('body', body, postType === 'question' ? 10 : 1, 5000);
  return {
    postType,
    category: postType === 'question' ? 'question' : postType === 'event_review' ? 'event_review' : 'free',
    title,
    body,
    displayMode,
    visibility,
    youtubeVideoId: parseYouTubeVideoId(input.youtubeUrl)
  };
}

export function validateEventReviewPayload(input) {
  const eventCode = clean(input.eventCode);
  const photoIds = Array.isArray(input.photoIds) ? input.photoIds : [];
  if (!eventCode) throw new Error('eventCode is required');
  if (photoIds.length < 2 || photoIds.length > 5) throw new Error('photoIds must include 2-5 photos');
  for (const id of photoIds) {
    if (!UUID.test(id)) throw new Error('photoIds must be UUIDs');
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
    youtubeVideoId: parseYouTubeVideoId(input.youtubeUrl)
  };
}

export function validateCommentPayload(input) {
  const postId = clean(input.postId);
  const parentCommentId = clean(input.parentCommentId);
  const body = clean(input.body);
  const displayMode = clean(input.displayMode || 'nickname');
  if (!UUID.test(postId)) throw new Error('postId must be a UUID');
  if (parentCommentId && !UUID.test(parentCommentId)) throw new Error('parentCommentId must be a UUID');
  if (!DISPLAY_MODES.has(displayMode)) throw new Error('displayMode is invalid');
  assertLength('body', body, 1, 1200);
  return { postId, parentCommentId: parentCommentId || null, body, displayMode };
}

export function validateAnswerPayload(input) {
  const questionPostId = clean(input.questionPostId);
  const body = clean(input.body);
  const visibility = clean(input.visibility || 'public');
  if (!UUID.test(questionPostId)) throw new Error('questionPostId must be a UUID');
  if (!ANSWER_VISIBILITIES.has(visibility)) throw new Error('visibility is invalid');
  assertLength('body', body, 1, 5000);
  return {
    questionPostId,
    body,
    visibility,
    youtubeVideoId: parseYouTubeVideoId(input.youtubeUrl)
  };
}

export function validateModerationPayload(input) {
  const action = clean(input.action);
  const postId = clean(input.postId || input.targetId);
  const reason = clean(input.reason);
  const visibility = clean(input.visibility);
  if (!MODERATION_ACTIONS.has(action)) throw new Error('action is invalid');
  if (!validateUuid(postId)) throw new Error('postId must be a UUID');
  if (reason.length > 500) throw new Error('reason must be 0-500 characters');
  if (action === 'change_visibility' && !VISIBILITIES.has(visibility)) {
    throw new Error('visibility is invalid');
  }
  return {
    action,
    postId,
    reason: reason || null,
    visibility: visibility || null
  };
}
