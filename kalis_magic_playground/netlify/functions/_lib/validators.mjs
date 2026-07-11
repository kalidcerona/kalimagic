const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POST_TYPES = new Set(['question', 'event_review', 'review_comment', 'free', 'routine', 'magazine']);
const WRITABLE_POST_TYPES = new Set(['question', 'review_comment', 'free', 'routine', 'magazine']);
const LIST_CATEGORIES = new Set(['all', 'question', 'review', 'free', 'routine', 'magazine']);
const REVIEW_KINDS = new Set(['tool', 'meeting']);
const DISPLAY_MODES = new Set(['nickname', 'anonymous']);
const VISIBILITIES = new Set(['public', 'kali_only', 'expert_only']);
const ANSWER_VISIBILITIES = new Set(['public', 'author_only']);
const LEAD_CONTACT_TYPES = new Set(['kakao', 'phone', 'email']);
const TRACK_EVENT_TYPES = new Set(['pageview', 'cta_click', 'share_click', 'invite_click', 'lead_submit']);
const TRACK_BATCH_LIMIT = 20;
const TRACK_PAYLOAD_BYTES_LIMIT = 32 * 1024;
const TRACK_META_BYTES_LIMIT = 2 * 1024;
const TRACK_META_KEYS_LIMIT = 30;
const TRACK_FUTURE_SKEW_MS = 5 * 60 * 1000;
const TRACK_PAST_SKEW_MS = 7 * 24 * 60 * 60 * 1000;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
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

export function validateReportPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid report payload');
  }

  const targetType = clean(input.targetType);
  const targetId = clean(input.targetId);
  const reason = clean(input.reason);

  if (!['post', 'comment'].includes(targetType)) throw new Error('invalid report target type');
  if (!validateUuid(targetId)) throw new Error('invalid report target id');
  if (Array.from(reason).length < 1 || Array.from(reason).length > 300) {
    throw new Error('invalid report reason');
  }

  return { targetType, targetId, reason };
}

export function validateMagazinePublishPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid magazine publish payload');
  }

  const sourcePostId = clean(input.sourcePostId);
  const title = clean(input.title);
  const body = clean(input.body);

  if (sourcePostId && !validateUuid(sourcePostId)) throw new Error('invalid source post id');
  assertLength('title', title, 3, 120);
  assertLength('body', body, 10, 5000);

  return { sourcePostId: sourcePostId || null, title, body };
}

export function validateLeadPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid lead payload');
  }

  const contactType = clean(input.contactType);
  const contact = clean(input.contact);
  const source = clean(input.source);
  const sessionId = clean(input.sessionId);

  if (!input.consent) throw new Error('lead consent is required');
  if (!LEAD_CONTACT_TYPES.has(contactType)) throw new Error('invalid lead contact type');
  if (contact.length < 2 || contact.length > 200) throw new Error('invalid lead contact');
  if (source.length < 1 || source.length > 80) throw new Error('invalid lead source');
  if (!validateUuid(sessionId)) throw new Error('invalid lead session id');

  let page = '/';
  if (clean(input.page)) {
    try {
      page = new URL(clean(input.page), 'https://local.invalid').pathname || '/';
    } catch {
      throw new Error('invalid lead page');
    }
    if (page.length > 300) throw new Error('invalid lead page');
  }

  return { contactType, contact, source, sessionId, page };
}

function utf8Size(value) {
  return new TextEncoder().encode(value).byteLength;
}

function validIsoDateTime(value) {
  if (typeof value !== 'string') return false;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts || !ISO_DATE_TIME.test(value)) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;

  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  return calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day &&
    hour <= 23 && minute <= 59 && second <= 59;
}

function trackNowMs(now) {
  const value = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(value)) throw new Error('invalid tracking clock');
  return value;
}

export function validateTrackEvent(input, { now = Date.now() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('event must be an object');
  }
  if (Object.hasOwn(input, 'user_id') || Object.hasOwn(input, 'userId')) {
    throw new Error('user id is server controlled');
  }

  const eventId = typeof input.eventId === 'string' ? input.eventId.trim() : '';
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
  const eventType = typeof input.eventType === 'string' ? input.eventType.trim() : '';
  const eventName = typeof input.eventName === 'string' ? input.eventName.trim() : '';
  const rawPage = typeof input.page === 'string' ? input.page.trim() : '';
  const page = rawPage.split('?')[0].trim();

  if (!validateUuid(eventId) || !validateUuid(sessionId)) throw new Error('invalid event id');
  if (!TRACK_EVENT_TYPES.has(eventType)) throw new Error('invalid event type');
  if (eventName.length < 1 || eventName.length > 80) throw new Error('invalid event name');
  if (page.length < 1 || page.length > 300) throw new Error('invalid page');

  const meta = input.meta === undefined ? {} : input.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('invalid event meta');
  if (Object.keys(meta).length > TRACK_META_KEYS_LIMIT) throw new Error('too many event meta keys');
  let serializedMeta;
  try {
    serializedMeta = JSON.stringify(meta);
  } catch {
    throw new Error('invalid event meta');
  }
  if (!serializedMeta || utf8Size(serializedMeta) > TRACK_META_BYTES_LIMIT) {
    throw new Error('event meta is too large');
  }

  if (!validIsoDateTime(input.occurredAt)) throw new Error('invalid occurred at');
  const occurredAtMs = Date.parse(input.occurredAt);
  const nowMs = trackNowMs(now);
  if (occurredAtMs > nowMs + TRACK_FUTURE_SKEW_MS || occurredAtMs < nowMs - TRACK_PAST_SKEW_MS) {
    throw new Error('occurred at is outside the accepted window');
  }

  return {
    eventId,
    sessionId,
    eventType,
    eventName,
    page,
    occurredAt: new Date(occurredAtMs).toISOString(),
    meta
  };
}

export function validateEventBatch(input, { now = Date.now() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('payload must be an object');
  }
  if (Object.hasOwn(input, 'user_id') || Object.hasOwn(input, 'userId')) {
    throw new Error('user id is server controlled');
  }
  if (!Array.isArray(input.events) || input.events.length < 1 || input.events.length > TRACK_BATCH_LIMIT) {
    throw new Error('invalid event batch size');
  }

  let serializedPayload;
  try {
    serializedPayload = JSON.stringify(input);
  } catch {
    throw new Error('invalid event payload');
  }
  if (!serializedPayload || utf8Size(serializedPayload) > TRACK_PAYLOAD_BYTES_LIMIT) {
    throw new Error('event payload is too large');
  }

  return input.events.map((event) => validateTrackEvent(event, { now }));
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
