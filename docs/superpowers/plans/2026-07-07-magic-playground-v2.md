# 마술 놀이터 V2 Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** 기존 `playground.html`을 새 페이지 없이 목록형 게시판 허브로 확장할 수 있도록 서버 데이터 모델과 Netlify Functions API를 V2 규격으로 준비한다.
**Architecture:** Supabase schema는 조회수, 공지, 추천 테이블만 추가하고 기존 `access-policy` 접근 제어는 그대로 둔다. Netlify Functions는 service key 경유 접근을 유지하며 목록, 상세, 추천, 삭제, 관리자 moderation 응답 shape를 프론트가 바로 렌더링할 수 있는 계산 필드 중심으로 정리한다. 작성 타입은 `posts` API와 기존 `event-reviews` API의 책임을 분리해 `[도구]`와 `[모임]` 말머리가 기존 데이터와 충돌하지 않게 한다.
**Tech Stack:** Netlify Functions ESM, Supabase JavaScript client, Supabase SQL migration, Node 20 `node:test`, `node:assert/strict`

## Global Constraints

- `access-policy.mjs`는 변경하지 않는다.
- 비공개 질문 접근 제어 로직인 `access-policy`는 변경하지 않는다.
- 신규 정적 JS 파일은 `kalis_magic_playground/scripts/build-public.mjs`의 `PUBLIC_FILES`에 등록한다.
- 사용자에게 내려가는 서버 메시지는 한국어로 작성한다.
- `canReadBody=false`인 글은 `viewCount=null`, `likeCount=null`, `viewerLiked=false`로 반환한다.
- 프론트는 `viewCount=null`, `likeCount=null`을 조회와 추천 컬럼에서 `-`로 렌더링한다.
- 물결표 금지.
- 빈 화면과 게시판 헤더 SVG는 `stroke="var(--point-gold)"`를 사용한다.
- `free`는 V2에서 작성할 수 없고 서버 작성 요청은 거부한다.
- `event_review`는 일반 `posts` API에서 직접 만들지 않고 기존 `event-reviews` API로만 만든다.
- 목록 페이지네이션은 20개 단위이며 서버는 `limit`이 20을 초과해도 20으로 제한한다.
- 공지글 정렬은 `is_notice desc`, `created_at desc` 순서다.
- 추천은 `post_likes`의 `primary key (post_id, user_id)` 기준 insert/delete 토글이다.
- 작성자 삭제는 물리 삭제가 아니라 `posts.status='deleted'` soft delete다.
- 답변이 달린 질문 삭제 거부 메시지는 `"답변이 달린 질문은 삭제할 수 없어요"`로 고정한다.
- 로그아웃 추천 메시지는 `"로그인하면 추천할 수 있어요"`로 고정한다.
- 배포 순서는 Supabase migration 먼저, Netlify 코드 배포 나중이다.

---

### Task 1: V2 Supabase Migration

**Files:**
- Create: `kalis_magic_playground/supabase/migrations/20260707_magic_playground_v2.sql`
- Test: `kalis_magic_playground/tests/community/magic-playground-v2-migration.test.mjs`

**Interfaces:**
- Consumes: Existing tables `public.posts`, `public.moderation_events`, `auth.users`
- Produces: `posts.view_count integer`, `posts.is_notice boolean`, `public.post_likes(post_id uuid, user_id uuid, created_at timestamptz)`, indexes `post_likes_user_idx`, `posts_v2_public_list_idx`, `posts_v2_category_list_idx`, moderation actions `pin_notice`, `unpin_notice`

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/magic-playground-v2-migration.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = new URL('../../supabase/migrations/20260707_magic_playground_v2.sql', import.meta.url);

const expectedSql = `alter table public.posts
  add column if not exists view_count integer not null default 0 check (view_count >= 0);

alter table public.posts
  add column if not exists is_notice boolean not null default false;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx
  on public.post_likes (user_id, created_at desc);

create index if not exists posts_v2_public_list_idx
  on public.posts (status, is_notice desc, created_at desc);

create index if not exists posts_v2_category_list_idx
  on public.posts (status, category, is_notice desc, created_at desc);

alter table public.moderation_events
  drop constraint if exists moderation_events_action_check;

alter table public.moderation_events
  add constraint moderation_events_action_check
  check (action in (
    'hide',
    'restore',
    'delete',
    'answer',
    'edit_answer',
    'mark_magazine_candidate',
    'change_visibility',
    'pin_notice',
    'unpin_notice'
  ));

alter table public.post_likes enable row level security;
`;

test('magic playground v2 migration matches approved SQL exactly', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  assert.equal(sql, expectedSql);
});

test('post_likes keeps deny-all RLS by enabling RLS without policies', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  assert.match(sql, /alter table public\.post_likes enable row level security;/);
  assert.doesNotMatch(sql, /create policy/i);
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... magic playground v2 migration matches approved SQL exactly
Error: ENOENT: no such file or directory, open .../supabase/migrations/20260707_magic_playground_v2.sql
```

- [ ] **Step 3: 최소 구현**

Create `kalis_magic_playground/supabase/migrations/20260707_magic_playground_v2.sql`:

```sql
alter table public.posts
  add column if not exists view_count integer not null default 0 check (view_count >= 0);

alter table public.posts
  add column if not exists is_notice boolean not null default false;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx
  on public.post_likes (user_id, created_at desc);

create index if not exists posts_v2_public_list_idx
  on public.posts (status, is_notice desc, created_at desc);

create index if not exists posts_v2_category_list_idx
  on public.posts (status, category, is_notice desc, created_at desc);

alter table public.moderation_events
  drop constraint if exists moderation_events_action_check;

alter table public.moderation_events
  add constraint moderation_events_action_check
  check (action in (
    'hide',
    'restore',
    'delete',
    'answer',
    'edit_answer',
    'mark_magazine_candidate',
    'change_visibility',
    'pin_notice',
    'unpin_notice'
  ));

alter table public.post_likes enable row level security;
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/supabase/migrations/20260707_magic_playground_v2.sql kalis_magic_playground/tests/community/magic-playground-v2-migration.test.mjs
git commit -m "feat: 마술 놀이터 v2 마이그레이션 추가"
```

### Task 2: Validators For V2 Post Types And List Query

**Files:**
- Modify: `kalis_magic_playground/netlify/functions/_lib/validators.mjs`
- Modify: `kalis_magic_playground/tests/community/validators.test.mjs`

**Interfaces:**
- Consumes: `validatePostPayload(input)`, `validateModerationPayload(input)`
- Produces: `validatePostPayload(input) -> { postType, category, title, body, displayMode, visibility, youtubeVideoId }` where `question -> question`, `review_comment -> review`, `magazine -> magazine`, `free` throws, `event_review` throws
- Produces: `validateListQuery(query) -> { category: 'all'|'question'|'review'|'magazine', reviewKind: null|'tool'|'meeting', limit: number, offset: number }`
- Produces: `validatePostIdPayload(input) -> { postId: string }`
- Produces: `validateModerationPayload(input)` accepting actions `pin_notice` and `unpin_notice`

- [ ] **Step 1: 실패 테스트 작성**

Append to `kalis_magic_playground/tests/community/validators.test.mjs`:

```js
import {
  validateListQuery,
  validatePostIdPayload
} from '../../netlify/functions/_lib/validators.mjs';

test('validatePostPayload rejects locked free and event review writes through posts api', () => {
  assert.throws(() => validatePostPayload({
    postType: 'free',
    title: '오늘 연습 기록',
    body: '오늘의 연습과 느낀 점을 남깁니다.',
    displayMode: 'nickname',
    visibility: 'public'
  }), /자유 기록은 아직 작성할 수 없어요/);

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
  assert.throws(() => validateListQuery({ category: 'free' }), /게시판 종류가 올바르지 않습니다/);
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
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/validators.test.mjs
SyntaxError: The requested module '../../netlify/functions/_lib/validators.mjs' does not provide an export named 'validateListQuery'
```

- [ ] **Step 3: 최소 구현**

Modify `kalis_magic_playground/netlify/functions/_lib/validators.mjs` constants and add the new exports:

```js
const POST_TYPES = new Set(['question', 'event_review', 'review_comment', 'free', 'magazine']);
const WRITABLE_POST_TYPES = new Set(['question', 'review_comment', 'magazine']);
const LIST_CATEGORIES = new Set(['all', 'question', 'review', 'magazine']);
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

function categoryForPostType(postType) {
  if (postType === 'question') return 'question';
  if (postType === 'review_comment') return 'review';
  if (postType === 'magazine') return 'magazine';
  return null;
}

function parseNonNegativeInteger(value, fallback) {
  const raw = clean(value);
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error('페이지 위치가 올바르지 않습니다');
  return Number(raw);
}
```

Replace `validatePostPayload` with:

```js
export function validatePostPayload(input) {
  const postType = clean(input.postType);
  const title = clean(input.title);
  const body = clean(input.body);
  const displayMode = clean(input.displayMode || 'nickname');
  const visibility = clean(input.visibility || 'public');

  if (!POST_TYPES.has(postType)) throw new Error('글 종류가 올바르지 않습니다');
  if (postType === 'free') throw new Error('자유 기록은 아직 작성할 수 없어요');
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
    youtubeVideoId: parseOptionalYouTubeVideoId(input.youtubeUrl)
  };
}
```

Add these exports below `validatePostPayload`:

```js
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
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/netlify/functions/_lib/validators.mjs kalis_magic_playground/tests/community/validators.test.mjs
git commit -m "feat: 마술 놀이터 v2 입력 검증 추가"
```

### Task 3: Posts List API With Filters, Notices, Pagination, And Private Counts

**Files:**
- Modify: `kalis_magic_playground/netlify/functions/posts.mjs`
- Test: `kalis_magic_playground/tests/community/posts-list.test.mjs`

**Interfaces:**
- Consumes: `validateListQuery(query)`, `validatePostPayload(input)`, `canReadPostBody(post, viewer)`, `canReadAuthor(post, viewer)`, `requireViewer(event)`, `getSupabaseAdmin()`
- Produces: `GET /.netlify/functions/posts?category&reviewKind&limit&offset -> { posts, limit, offset, hasMore }`
- Produces: `shapePostListRow(row, viewer, state) -> { id, postType, category, boardCategory, prefix, title, commentCount, authorLabel, displayMode, visibility, status, createdAt, viewCount, likeCount, viewerLiked, isNotice, canReadBody, bodyLocked }`
- Produces: `applyListFilters(query, params) -> query`
- Produces: `POST /.netlify/functions/posts` accepting `question`, `review_comment`, `magazine`; `magazine` requires `viewer.role` in `admin`, `kali`

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/posts-list.test.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/posts-list.test.mjs
SyntaxError: The requested module '../../netlify/functions/posts.mjs' does not provide an export named 'applyListFilters'
```

- [ ] **Step 3: 최소 구현**

Replace `kalis_magic_playground/netlify/functions/posts.mjs` with:

```js
import { canReadAuthor, canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateListQuery, validatePostPayload } from './_lib/validators.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

export function hasPrivilegedRole(viewer) {
  return ['admin', 'kali'].includes(viewer?.role);
}

export function boardCategoryForCategory(category) {
  if (category === 'review' || category === 'event_review') return 'review';
  return category;
}

export function prefixForCategory(category) {
  if (category === 'question') return '질문';
  if (category === 'review') return '도구';
  if (category === 'event_review') return '모임';
  if (category === 'magazine') return '매거진';
  return '기록';
}

function countByPostId(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
  }
  return counts;
}

export function shapePostListRow(row, viewer, state = {}) {
  const policyPost = { visibility: row.visibility, authorUserId: row.author_user_id };
  const canReadBody = canReadPostBody(policyPost, viewer);
  const canReadName = canReadAuthor(policyPost, viewer);
  const commentCounts = state.commentCounts || new Map();
  const likeCounts = state.likeCounts || new Map();
  const viewerLikedPostIds = state.viewerLikedPostIds || new Set();

  return {
    id: row.id,
    postType: row.post_type,
    category: row.category,
    boardCategory: boardCategoryForCategory(row.category),
    prefix: prefixForCategory(row.category),
    title: row.title,
    commentCount: commentCounts.get(row.id) || 0,
    authorLabel: canReadName && row.display_mode === 'nickname' ? row.profiles?.nickname || '마술인' : '익명',
    displayMode: row.display_mode,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    viewCount: canReadBody ? row.view_count || 0 : null,
    likeCount: canReadBody ? likeCounts.get(row.id) || 0 : null,
    viewerLiked: canReadBody ? viewerLikedPostIds.has(row.id) : false,
    isNotice: Boolean(row.is_notice),
    canReadBody,
    bodyLocked: !canReadBody
  };
}

export function applyListFilters(query, params) {
  if (params.category === 'all') return query.neq('category', 'free');
  if (params.category === 'question') return query.eq('category', 'question');
  if (params.category === 'review' && params.reviewKind === 'tool') return query.eq('category', 'review');
  if (params.category === 'review' && params.reviewKind === 'meeting') return query.eq('category', 'event_review');
  if (params.category === 'review') return query.in('category', ['review', 'event_review']);
  if (params.category === 'magazine') {
    return query.or('category.eq.magazine,and(category.eq.question,questions.magazine_candidate.eq.true)');
  }
  return query.neq('category', 'free');
}

async function loadListState(supabase, postIds, viewer) {
  if (postIds.length === 0) {
    return {
      commentCounts: new Map(),
      likeCounts: new Map(),
      viewerLikedPostIds: new Set()
    };
  }

  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('post_id')
    .eq('status', 'visible')
    .in('post_id', postIds);
  if (commentsError) throw commentsError;

  const { data: likes, error: likesError } = await supabase
    .from('post_likes')
    .select('post_id')
    .in('post_id', postIds);
  if (likesError) throw likesError;

  let viewerLikes = [];
  if (viewer) {
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', viewer.userId)
      .in('post_id', postIds);
    if (error) throw error;
    viewerLikes = data || [];
  }

  return {
    commentCounts: countByPostId(comments),
    likeCounts: countByPostId(likes),
    viewerLikedPostIds: new Set(viewerLikes.map((row) => row.post_id))
  };
}

async function listPosts(event) {
  let params;
  try {
    params = validateListQuery(event.queryStringParameters || {});
  } catch (error) {
    return json(400, { error: 'invalid_query', message: error.message });
  }

  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('posts')
    .select('id,post_type,category,title,body,youtube_video_id,author_user_id,display_mode,visibility,status,created_at,view_count,is_notice,profiles(nickname),questions(magazine_candidate)')
    .eq('status', 'visible')
    .order('is_notice', { ascending: false })
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit);

  query = applyListFilters(query, params);

  const { data, error } = await query;
  if (error) return json(500, { error: 'db_error' });

  const rows = data || [];
  const pageRows = rows.slice(0, params.limit);
  const hasMore = rows.length > params.limit;
  const postIds = pageRows.map((row) => row.id);

  let state;
  try {
    state = await loadListState(supabase, postIds, viewer);
  } catch {
    return json(500, { error: 'db_error' });
  }

  return json(200, {
    posts: pageRows.map((row) => shapePostListRow(row, viewer, state)),
    limit: params.limit,
    offset: params.offset,
    hasMore
  });
}

export async function handler(event) {
  if (event.httpMethod === 'POST') return createPost(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  return listPosts(event);
}

async function createPost(event) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = validatePostPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  if (payload.postType === 'magazine' && !hasPrivilegedRole(viewer)) {
    return json(403, { error: 'forbidden', message: '매거진 글쓰기는 관리자만 사용할 수 있어요' });
  }

  const supabase = getSupabaseAdmin();
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      post_type: payload.postType,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      author_user_id: viewer.userId,
      display_mode: payload.displayMode,
      visibility: payload.visibility,
      youtube_video_id: payload.youtubeVideoId
    })
    .select('id')
    .single();

  if (postError) return json(500, { error: 'db_error' });

  if (payload.postType === 'question') {
    const { error: questionError } = await supabase
      .from('questions')
      .insert({ post_id: post.id });
    if (questionError) return json(500, { error: 'db_error' });
  }

  return json(201, { id: post.id });
}
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/netlify/functions/posts.mjs kalis_magic_playground/tests/community/posts-list.test.mjs
git commit -m "feat: 마술 놀이터 v2 목록 api 추가"
```

### Task 4: Post Detail View Count And Like State

**Files:**
- Modify: `kalis_magic_playground/netlify/functions/post-detail.mjs`
- Test: `kalis_magic_playground/tests/community/post-detail-v2.test.mjs`

**Interfaces:**
- Consumes: `canReadPostBody(post, viewer)`, `canReadAuthor(post, viewer)`, `canReadAnswer(question, answer, viewer)`, `requireViewer(event)`, `getSupabaseAdmin()`
- Produces: `GET /.netlify/functions/post-detail?id=uuid -> { post, answers, comments, viewerCanAnswer }`
- Produces: `shapePost(row, viewer, state) -> post` with `viewCount`, `likeCount`, `viewerLiked`, `isNotice`, `canReadBody`, `canDelete`
- Produces: `shouldIncrementView(row, viewer) -> boolean`

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/post-detail-v2.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/post-detail-v2.test.mjs
SyntaxError: The requested module '../../netlify/functions/post-detail.mjs' does not provide an export named 'shapePost'
```

- [ ] **Step 3: 최소 구현**

Replace `kalis_magic_playground/netlify/functions/post-detail.mjs` with:

```js
import { canReadAnswer, canReadAuthor, canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

function canViewerAnswer(viewer) {
  return ['admin', 'kali'].includes(viewer?.role);
}

function canSeeHiddenPost(viewer) {
  return ['admin', 'kali'].includes(viewer?.role);
}

export function shouldIncrementView(row, viewer) {
  if (!row || row.status !== 'visible') return false;
  return canReadPostBody({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);
}

export function shapePost(row, viewer, state = {}) {
  const policyPost = { visibility: row.visibility, authorUserId: row.author_user_id };
  const canReadBody = canReadPostBody(policyPost, viewer);
  const canReadName = canReadAuthor(policyPost, viewer);
  return {
    id: row.id,
    postType: row.post_type,
    category: row.category,
    title: row.title,
    body: canReadBody ? row.body : '',
    bodyLocked: !canReadBody,
    youtubeVideoId: canReadBody ? row.youtube_video_id : null,
    authorLabel: canReadName && row.display_mode === 'nickname' ? row.profiles?.nickname || '마술인' : '익명',
    displayMode: row.display_mode,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    viewCount: canReadBody ? state.viewCount ?? row.view_count ?? 0 : null,
    likeCount: canReadBody ? state.likeCount ?? 0 : null,
    viewerLiked: canReadBody ? Boolean(state.viewerLiked) : false,
    isNotice: Boolean(row.is_notice),
    canReadBody,
    canDelete: Boolean(viewer?.userId && viewer.userId === row.author_user_id && row.status === 'visible')
  };
}

function shapeAnswer(question, row, viewer) {
  if (!canReadAnswer(question, { visibility: row.visibility }, viewer)) return null;
  return {
    id: row.id,
    body: row.body,
    visibility: row.visibility,
    isPinned: row.is_pinned,
    authorLabel: row.profiles?.nickname || '답변자',
    youtubeVideoId: row.youtube_video_id,
    createdAt: row.created_at
  };
}

function shapeComment(row) {
  return {
    id: row.id,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    authorLabel: row.display_mode === 'nickname' ? row.profiles?.nickname || '마술인' : '익명',
    createdAt: row.created_at
  };
}

async function loadLikeState(supabase, postId, viewer) {
  const { data: likes, error: likesError } = await supabase
    .from('post_likes')
    .select('user_id')
    .eq('post_id', postId);
  if (likesError) throw likesError;

  const likeRows = likes || [];
  return {
    likeCount: likeRows.length,
    viewerLiked: viewer ? likeRows.some((row) => row.user_id === viewer.userId) : false
  };
}

async function incrementViewCount(supabase, row) {
  const nextViewCount = (row.view_count || 0) + 1;
  const { error } = await supabase
    .from('posts')
    .update({ view_count: nextViewCount })
    .eq('id', row.id);
  if (error) throw error;
  return nextViewCount;
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  const id = event.queryStringParameters?.id;
  if (!id) return json(400, { error: 'id_required' });

  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from('posts')
    .select('id,post_type,category,title,body,youtube_video_id,author_user_id,display_mode,visibility,status,created_at,view_count,is_notice,profiles(nickname)')
    .eq('id', id)
    .maybeSingle();

  if (error) return json(500, { error: 'db_error' });
  if (!row || (row.status !== 'visible' && !canSeeHiddenPost(viewer))) {
    return json(404, { error: 'not_found' });
  }

  let state = { viewCount: row.view_count || 0, likeCount: 0, viewerLiked: false };
  const canReadBody = canReadPostBody({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);

  if (shouldIncrementView(row, viewer)) {
    try {
      state.viewCount = await incrementViewCount(supabase, row);
    } catch {
      return json(500, { error: 'db_error' });
    }
  }

  if (canReadBody) {
    try {
      state = { ...state, ...await loadLikeState(supabase, row.id, viewer) };
    } catch {
      return json(500, { error: 'db_error' });
    }
  }

  const post = shapePost(row, viewer, state);
  const question = { visibility: row.visibility, authorUserId: row.author_user_id };
  if (!post.canReadBody) {
    return json(200, { post, answers: [], comments: [], viewerCanAnswer: canViewerAnswer(viewer) });
  }

  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('id,body,visibility,is_pinned,youtube_video_id,created_at,profiles(nickname)')
    .eq('question_post_id', row.id)
    .eq('status', 'visible')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: true });
  if (answersError) return json(500, { error: 'db_error' });

  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('id,parent_comment_id,body,display_mode,created_at,profiles(nickname)')
    .eq('post_id', row.id)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (commentsError) return json(500, { error: 'db_error' });

  return json(200, {
    post,
    answers: answers.map((answer) => shapeAnswer(question, answer, viewer)).filter(Boolean),
    comments: comments.map(shapeComment),
    viewerCanAnswer: canViewerAnswer(viewer)
  });
}
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/netlify/functions/post-detail.mjs kalis_magic_playground/tests/community/post-detail-v2.test.mjs
git commit -m "feat: 상세 조회수와 추천 상태 반환"
```

### Task 5: Post Likes Toggle API

**Files:**
- Create: `kalis_magic_playground/netlify/functions/post-likes.mjs`
- Test: `kalis_magic_playground/tests/community/post-likes.test.mjs`

**Interfaces:**
- Consumes: `requireViewer(event)`, `readJsonBody(event)`, `validatePostIdPayload(input)`, `canReadPostBody(post, viewer)`, `getSupabaseAdmin()`
- Produces: `POST /.netlify/functions/post-likes` with body `{ postId }`
- Produces: success `{ ok: true, likeCount: number, viewerLiked: boolean }`
- Produces: `nextLikeMutation(existingLike) -> 'insert'|'delete'`
- Produces: `shapeLikeResponse(likeRows, viewer) -> { ok: true, likeCount, viewerLiked }`

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/post-likes.test.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/post-likes.test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../netlify/functions/post-likes.mjs
```

- [ ] **Step 3: 최소 구현**

Create `kalis_magic_playground/netlify/functions/post-likes.mjs`:

```js
import { canReadPostBody } from './_lib/access-policy.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validatePostIdPayload } from './_lib/validators.mjs';

export function nextLikeMutation(existingLike) {
  return existingLike ? 'delete' : 'insert';
}

export function shapeLikeResponse(likeRows, viewer) {
  const rows = likeRows || [];
  return {
    ok: true,
    likeCount: rows.length,
    viewerLiked: rows.some((row) => row.user_id === viewer.userId)
  };
}

async function loadLikeRows(supabase, postId) {
  const { data, error } = await supabase
    .from('post_likes')
    .select('user_id')
    .eq('post_id', postId);
  if (error) throw error;
  return data || [];
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required', message: '로그인하면 추천할 수 있어요' });
  }

  let payload;
  try {
    payload = validatePostIdPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id,visibility,author_user_id,status')
    .eq('id', payload.postId)
    .maybeSingle();

  if (postError) return json(500, { error: 'db_error' });
  if (!post || post.status !== 'visible') return json(404, { error: 'not_found' });

  const canReadBody = canReadPostBody({
    visibility: post.visibility,
    authorUserId: post.author_user_id
  }, viewer);
  if (!canReadBody) return json(403, { error: 'forbidden' });

  const { data: existing, error: existingError } = await supabase
    .from('post_likes')
    .select('post_id,user_id')
    .eq('post_id', payload.postId)
    .eq('user_id', viewer.userId)
    .maybeSingle();
  if (existingError) return json(500, { error: 'db_error' });

  const mutation = nextLikeMutation(existing);
  if (mutation === 'insert') {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: payload.postId, user_id: viewer.userId });
    if (error) return json(500, { error: 'db_error' });
  } else {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', payload.postId)
      .eq('user_id', viewer.userId);
    if (error) return json(500, { error: 'db_error' });
  }

  try {
    const likeRows = await loadLikeRows(supabase, payload.postId);
    return json(200, shapeLikeResponse(likeRows, viewer));
  } catch {
    return json(500, { error: 'db_error' });
  }
}
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/netlify/functions/post-likes.mjs kalis_magic_playground/tests/community/post-likes.test.mjs
git commit -m "feat: 게시글 추천 토글 api 추가"
```

### Task 6: Owner Soft Delete For Posts

**Files:**
- Modify: `kalis_magic_playground/netlify/functions/posts.mjs`
- Test: `kalis_magic_playground/tests/community/posts-delete.test.mjs`

**Interfaces:**
- Consumes: `requireViewer(event)`, `readJsonBody(event)`, `validatePostIdPayload(input)`, existing `posts.status`, existing `answers.status`
- Produces: `DELETE /.netlify/functions/posts` with body `{ postId }`
- Produces: success `{ ok: true, status: 'deleted' }`
- Produces: `deleteDecision(post, viewer, visibleAnswerCount) -> { ok: boolean, status: number, body: object }`

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/posts-delete.test.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/posts-delete.test.mjs
SyntaxError: The requested module '../../netlify/functions/posts.mjs' does not provide an export named 'deleteDecision'
```

- [ ] **Step 3: 최소 구현**

Modify the import in `kalis_magic_playground/netlify/functions/posts.mjs`:

```js
import { validateListQuery, validatePostIdPayload, validatePostPayload } from './_lib/validators.mjs';
```

Replace `handler` with:

```js
export async function handler(event) {
  if (event.httpMethod === 'POST') return createPost(event);
  if (event.httpMethod === 'DELETE') return deletePost(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  return listPosts(event);
}
```

Add these functions above `createPost`:

```js
export function deleteDecision(post, viewer, visibleAnswerCount) {
  if (!post || post.status !== 'visible') {
    return { ok: false, status: 404, body: { error: 'not_found' } };
  }
  if (post.author_user_id !== viewer.userId) {
    return { ok: false, status: 403, body: { error: 'forbidden' } };
  }
  if (post.post_type === 'question' && visibleAnswerCount > 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'answered_question',
        message: '답변이 달린 질문은 삭제할 수 없어요'
      }
    };
  }
  return { ok: true, status: 200, body: { ok: true, status: 'deleted' } };
}

async function countVisibleAnswers(supabase, post) {
  if (post.post_type !== 'question') return 0;
  const { data, error } = await supabase
    .from('answers')
    .select('id')
    .eq('question_post_id', post.id)
    .eq('status', 'visible')
    .limit(1);
  if (error) throw error;
  return (data || []).length;
}

async function deletePost(event) {
  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = validatePostIdPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id,post_type,author_user_id,status')
    .eq('id', payload.postId)
    .maybeSingle();
  if (postError) return json(500, { error: 'db_error' });

  let visibleAnswerCount = 0;
  try {
    visibleAnswerCount = await countVisibleAnswers(supabase, post);
  } catch {
    return json(500, { error: 'db_error' });
  }

  const decision = deleteDecision(post, viewer, visibleAnswerCount);
  if (!decision.ok) return json(decision.status, decision.body);

  const { error: updateError } = await supabase
    .from('posts')
    .update({ status: 'deleted' })
    .eq('id', payload.postId);
  if (updateError) return json(500, { error: 'db_error' });

  return json(decision.status, decision.body);
}
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/netlify/functions/posts.mjs kalis_magic_playground/tests/community/posts-delete.test.mjs
git commit -m "feat: 본인 게시글 삭제 api 추가"
```

### Task 7: Admin Moderate Notice Pin And Unpin

**Files:**
- Modify: `kalis_magic_playground/netlify/functions/admin-moderate.mjs`
- Test: `kalis_magic_playground/tests/community/admin-moderate-v2.test.mjs`

**Interfaces:**
- Consumes: `requireAdmin(event)`, `validateModerationPayload(input)`, existing `moderation_events`
- Produces: `POST /.netlify/functions/admin-moderate` action `pin_notice` setting `posts.is_notice=true`
- Produces: `POST /.netlify/functions/admin-moderate` action `unpin_notice` setting `posts.is_notice=false`
- Produces: `noticeValueForAction(action) -> true|false|null`
- Produces: `nextStatus(action) -> 'hidden'|'visible'|'deleted'|null`

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/admin-moderate-v2.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  nextStatus,
  noticeValueForAction
} from '../../netlify/functions/admin-moderate.mjs';

test('noticeValueForAction maps pin and unpin actions', () => {
  assert.equal(noticeValueForAction('pin_notice'), true);
  assert.equal(noticeValueForAction('unpin_notice'), false);
  assert.equal(noticeValueForAction('hide'), null);
});

test('nextStatus leaves notice actions on existing status', () => {
  assert.equal(nextStatus('hide'), 'hidden');
  assert.equal(nextStatus('restore'), 'visible');
  assert.equal(nextStatus('delete'), 'deleted');
  assert.equal(nextStatus('pin_notice'), null);
  assert.equal(nextStatus('unpin_notice'), null);
});

test('admin moderate records notice events without changing status', () => {
  const source = readFileSync(new URL('../../netlify/functions/admin-moderate.mjs', import.meta.url), 'utf8');
  assert.match(source, /is_notice/);
  assert.match(source, /before_status: before\.status/);
  assert.match(source, /after_status: status \|\| before\.status/);
  assert.match(source, /매거진 후보 지정은 질문 글에서만 사용할 수 있어요/);
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/admin-moderate-v2.test.mjs
SyntaxError: The requested module '../../netlify/functions/admin-moderate.mjs' does not provide an export named 'noticeValueForAction'
```

- [ ] **Step 3: 최소 구현**

Replace `kalis_magic_playground/netlify/functions/admin-moderate.mjs` with:

```js
import { requireAdmin } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateModerationPayload } from './_lib/validators.mjs';

export function nextStatus(action) {
  if (action === 'hide') return 'hidden';
  if (action === 'restore') return 'visible';
  if (action === 'delete') return 'deleted';
  return null;
}

export function noticeValueForAction(action) {
  if (action === 'pin_notice') return true;
  if (action === 'unpin_notice') return false;
  return null;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let viewer;
  try {
    viewer = await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  let payload;
  try {
    payload = validateModerationPayload(readJsonBody(event));
  } catch (error) {
    return json(400, { error: 'invalid_payload', message: error.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: before, error: beforeError } = await supabase
    .from('posts')
    .select('id,status,visibility,category,post_type,is_notice')
    .eq('id', payload.postId)
    .maybeSingle();
  if (beforeError) return json(500, { error: 'db_error' });
  if (!before) return json(404, { error: 'not_found' });

  const status = nextStatus(payload.action);
  if (status) {
    const { error } = await supabase.from('posts').update({ status }).eq('id', payload.postId);
    if (error) return json(500, { error: 'db_error' });
  }

  const noticeValue = noticeValueForAction(payload.action);
  if (noticeValue !== null) {
    const { error } = await supabase
      .from('posts')
      .update({ is_notice: noticeValue })
      .eq('id', payload.postId);
    if (error) return json(500, { error: 'db_error' });
  }

  if (payload.action === 'mark_magazine_candidate') {
    if (before.category !== 'question') {
      return json(400, {
        error: 'invalid_payload',
        message: '매거진 후보 지정은 질문 글에서만 사용할 수 있어요'
      });
    }
    const { error } = await supabase
      .from('questions')
      .update({ magazine_candidate: true })
      .eq('post_id', payload.postId);
    if (error) return json(500, { error: 'db_error' });
  }

  if (payload.action === 'change_visibility') {
    const { error } = await supabase.from('posts').update({ visibility: payload.visibility }).eq('id', payload.postId);
    if (error) return json(500, { error: 'db_error' });
  }

  await supabase.from('moderation_events').insert({
    actor_user_id: viewer.userId,
    target_table: 'posts',
    target_id: payload.postId,
    action: payload.action,
    reason: payload.reason,
    before_status: before.status,
    after_status: status || before.status
  });

  return json(200, { ok: true });
}
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/netlify/functions/admin-moderate.mjs kalis_magic_playground/tests/community/admin-moderate-v2.test.mjs
git commit -m "feat: 관리자 공지 고정 액션 추가"
```

### Task 8: Front Module Split

**Files:**
- Create: `kalis_magic_playground/playground-api.js`
- Create: `kalis_magic_playground/playground-list.js`
- Create: `kalis_magic_playground/playground-compose.js`
- Create: `kalis_magic_playground/playground-detail.js`
- Modify: `kalis_magic_playground/playground.js`
- Modify: `kalis_magic_playground/playground.html`
- Test: `kalis_magic_playground/tests/community/playground-modules.test.mjs`

**Interfaces:**
- Consumes: `GET /.netlify/functions/posts?category&reviewKind&limit&offset -> { posts, limit, offset, hasMore }`
- Consumes: `posts[]: { id, postType, category, boardCategory, prefix, title, commentCount, authorLabel, displayMode, visibility, status, createdAt, viewCount, likeCount, viewerLiked, isNotice, canReadBody, bodyLocked }`
- Consumes: `category: 'all'|'question'|'review'|'magazine', reviewKind: null|'tool'|'meeting'`
- Consumes: `GET /.netlify/functions/post-detail?id -> { post, answers, comments, viewerCanAnswer }`
- Consumes: `post` detail fields `viewCount`, `likeCount`, `viewerLiked`, `isNotice`, `canDelete`
- Consumes: `POST /.netlify/functions/post-likes { postId } -> { ok:true, likeCount, viewerLiked }`
- Consumes: `DELETE /.netlify/functions/posts { postId }`
- Consumes: `validatePostPayload` permits `postType: 'question'|'review_comment'|'magazine'` and rejects `postType: 'free'|'event_review'`
- Produces: `window.KalisPlaygroundApi.fetchJson(path, options) -> Promise<object>`
- Produces: `window.KalisPlaygroundApi.listPosts({ category, reviewKind, limit, offset }) -> Promise<{ posts, limit, offset, hasMore }>`
- Produces: `window.KalisPlaygroundApi.getPostDetail(id) -> Promise<{ post, answers, comments, viewerCanAnswer }>`
- Produces: `window.KalisPlaygroundApi.togglePostLike(postId) -> Promise<{ ok:true, likeCount, viewerLiked }>`
- Produces: `window.KalisPlaygroundApi.deletePost(postId) -> Promise<object>`
- Produces: `window.KalisPlaygroundApi.createPost(payload) -> Promise<object>`
- Produces: `window.KalisPlaygroundList.initPlaygroundList({ api, root, tabsRoot }) -> { reload, getActiveTarget }`
- Produces: `window.KalisPlaygroundCompose.initPlaygroundCompose({ api, root, getActiveTarget, onCreated }) -> { open, close }`
- Produces: `window.KalisPlaygroundDetail.initPlaygroundDetail({ api, root }) -> { loadPost, clear }`

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/playground-modules.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('../..', import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('playground front modules exist and html loads them in dependency order', () => {
  const files = [
    'playground-api.js',
    'playground-list.js',
    'playground-compose.js',
    'playground-detail.js'
  ];

  for (const file of files) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }

  const html = read('playground.html');
  const order = [
    'auth.js',
    'playground-api.js',
    'playground-list.js',
    'playground-compose.js',
    'playground-detail.js',
    'playground.js'
  ].map((script) => html.indexOf(`src="${script}"`));

  assert.deepEqual(
    order,
    order.slice().sort((a, b) => a - b),
    'script order should be auth, api, list, compose, detail, bootstrap'
  );
  assert.equal(order.every((index) => index > -1), true);
});

test('playground api module wraps the v2 endpoints with auth headers', () => {
  const source = read('playground-api.js');

  assert.match(source, /function fetchJson/);
  assert.match(source, /Authorization/);
  assert.match(source, /Bearer/);
  assert.match(source, /\/\.netlify\/functions\/posts\?/);
  assert.match(source, /\/\.netlify\/functions\/post-detail\?id=/);
  assert.match(source, /\/\.netlify\/functions\/post-likes/);
  assert.match(source, /method: 'DELETE'/);
  assert.match(source, /createPost/);
});

test('playground list module has six tabs, prefix filters, table rendering, paging, and free lock copy', () => {
  const source = read('playground-list.js');

  assert.match(source, /PLAYGROUND_TABS/);
  assert.match(source, /전체/);
  assert.match(source, /질문함/);
  assert.match(source, /도구 리뷰/);
  assert.match(source, /모임 후기/);
  assert.match(source, /매거진/);
  assert.match(source, /자유 기록🔒/);
  assert.match(source, /reviewKind: 'tool'/);
  assert.match(source, /reviewKind: 'meeting'/);
  assert.match(source, /PREFIX_FILTERS/);
  assert.match(source, /pg-table/);
  assert.match(source, /hasMore/);
  assert.match(source, /자유 기록은 준비 중입니다\. 질문함과 리뷰가 자리 잡은 뒤 열립니다\./);
});

test('playground compose module includes verbatim guide copy and never submits free or event_review post types', () => {
  const source = read('playground-compose.js');
  const requiredCopy = [
    '어떤 기록을 남길지 먼저 골라주면 됨. 질문, 모임 후기, 도구 리뷰, 자유 기록 중에서 가장 가까운 곳에 남기면 사람들이 더 잘 찾아볼 수 있음.',
    '먼저 게시판을 선택하면 제목 예시가 나타남',
    '남기고 싶은 이야기에 가장 가까운 게시판을 선택하면, 그 글에 맞는 안내가 열림',
    '오늘의 연습, 문득 든 생각, 마술하면서 생긴 작은 이야기를 편하게 남기는 공간임.',
    '작은 기록도 쌓이면 누군가에게 길잡이가 됨.',
    '마술을 배우다 막히는 순간이 있으면 질문을 남기는 공간임. 먼저 지나간 사람이 답을 알고 있을 수 있음.',
    '처음 묻는 질문도 좋음. 누군가에게는 같은 고민을 해결하는 첫 기록이 될 수 있음.',
    '모임에서 느낀 분위기와 기억에 남은 순간을 남기는 공간임. 그날의 기록이 다음 모임을 더 좋게 만듦.',
    '모임 후기는 처음 오는 사람에게 가장 큰 안내서가 됨.',
    '직접 써본 도구와 강의 경험을 남기는 공간임. 좋은 점과 활용 장면을 남기면 다음 사람이 선택하기 쉬워짐.',
    '내가 써본 경험이 누군가에게는 시행착오를 줄여주는 길잡이가 됨.',
    '마술 놀이터에 쌓인 좋은 질문과 답변, 후기와 리뷰를 골라 오래 볼 수 있게 모아두는 공간임.',
    '매거진은 흘러가는 게시판에서 오래 남길 만한 기록을 건져 올리는 공간임.'
  ];

  for (const copy of requiredCopy) {
    assert.equal(source.includes(copy), true, `missing copy: ${copy}`);
  }

  assert.match(source, /question: 'question'/);
  assert.match(source, /tool: 'review_comment'/);
  assert.match(source, /magazine: 'magazine'/);
  assert.doesNotMatch(source, /postType: 'free'/);
  assert.doesNotMatch(source, /postType: 'event_review'/);
});

test('playground detail module renders counts, like toggle, owner delete, and hidden private counts', () => {
  const source = read('playground-detail.js');

  assert.match(source, /togglePostLike/);
  assert.match(source, /deletePost/);
  assert.match(source, /viewerLiked/);
  assert.match(source, /canDelete/);
  assert.match(source, /답변이 달린 질문은 삭제할 수 없어요/);
  assert.match(source, /return '-'/);
});

test('playground bootstrap only wires modules together', () => {
  const source = read('playground.js');

  assert.match(source, /initPlaygroundList/);
  assert.match(source, /initPlaygroundCompose/);
  assert.match(source, /initPlaygroundDetail/);
  assert.doesNotMatch(source, /async function loadQuestions/);
  assert.doesNotMatch(source, /addEventListener\('submit'/);
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/playground-modules.test.mjs
AssertionError [ERR_ASSERTION]: playground-api.js should exist
```

- [ ] **Step 3: 최소 구현 작성**

Create `kalis_magic_playground/playground-api.js`:

```js
(function () {
  const POSTS_ENDPOINT = '/.netlify/functions/posts';

  function getSupabaseClient() {
    if (window.magicPlaygroundSupabase) return window.magicPlaygroundSupabase;
    const config = window.MAGIC_PLAYGROUND_CONFIG || {};
    if (!window.supabase || !config.supabaseUrl || !config.supabasePublishableKey) return null;
    window.magicPlaygroundSupabase = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey
    );
    return window.magicPlaygroundSupabase;
  }

  async function getAccessToken() {
    const client = getSupabaseClient();
    if (!client || !client.auth || !client.auth.getSession) return null;
    const { data } = await client.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  }

  async function authHeaders() {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchJson(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const auth = await authHeaders();
    for (const [key, value] of Object.entries(auth)) headers.set(key, value);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const response = await fetch(path, {
      ...options,
      headers
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = new Error(data.message || data.error || '요청을 처리하지 못했어요');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function listPosts({ category = 'all', reviewKind = null, limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    params.set('category', category);
    if (reviewKind !== null && reviewKind !== undefined) params.set('reviewKind', reviewKind);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return fetchJson(`/.netlify/functions/posts?${params.toString()}`);
  }

  function getPostDetail(id) {
    return fetchJson(`/.netlify/functions/post-detail?id=${encodeURIComponent(id)}`);
  }

  function togglePostLike(postId) {
    return fetchJson('/.netlify/functions/post-likes', {
      method: 'POST',
      body: JSON.stringify({ postId })
    });
  }

  function deletePost(postId) {
    return fetchJson(POSTS_ENDPOINT, {
      method: 'DELETE',
      body: JSON.stringify({ postId })
    });
  }

  function createPost(payload) {
    return fetchJson(POSTS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  window.KalisPlaygroundApi = {
    fetchJson,
    listPosts,
    getPostDetail,
    togglePostLike,
    deletePost,
    createPost
  };
})();
```

Create `kalis_magic_playground/playground-list.js`:

```js
(function () {
  const PAGE_SIZE = 20;

  const PLAYGROUND_TABS = [
    { id: 'all', label: '전체', category: 'all', reviewKind: null },
    { id: 'question', label: '질문함', category: 'question', reviewKind: null },
    { id: 'review_tool', label: '도구 리뷰', category: 'review', reviewKind: 'tool' },
    { id: 'review_meeting', label: '모임 후기', category: 'review', reviewKind: 'meeting' },
    { id: 'magazine', label: '매거진', category: 'magazine', reviewKind: null },
    { id: 'free', label: '자유 기록🔒', category: 'free', reviewKind: null, locked: true }
  ];

  const PREFIX_FILTERS = [
    { id: 'all', label: '전체 말머리', category: null, reviewKind: null },
    { id: 'question', label: '[질문]', category: 'question', reviewKind: null },
    { id: 'tool', label: '[도구]', category: 'review', reviewKind: 'tool' },
    { id: 'meeting', label: '[모임]', category: 'review', reviewKind: 'meeting' },
    { id: 'magazine', label: '[매거진]', category: 'magazine', reviewKind: null }
  ];

  const EMPTY_COPY = {
    all: '아직 첫 기록이 올라오지 않았습니다. 질문과 후기가 쌓이면 이 놀이터의 지도가 됩니다.',
    question: '아직 질문이 없습니다. 처음 묻는 질문도 다음 사람에게는 같은 고민을 해결하는 첫 기록이 됩니다.',
    review_tool: '아직 리뷰가 없습니다. 써본 도구와 모임 기억이 이곳에 쌓이면 누군가의 길잡이가 됩니다.',
    review_meeting: '아직 리뷰가 없습니다. 써본 도구와 모임 기억이 이곳에 쌓이면 누군가의 길잡이가 됩니다.',
    magazine: '아직 매거진에 건져 올린 글이 없습니다. 오래 남길 기록을 기다리고 있습니다.',
    free: '자유 기록은 준비 중입니다. 질문함과 리뷰가 자리 잡은 뒤 열립니다.'
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function prefixClass(prefix) {
    if (prefix === '[질문]') return 'question';
    if (prefix === '[도구]') return 'tool';
    if (prefix === '[모임]') return 'meeting';
    if (prefix === '[매거진]') return 'magazine';
    return 'default';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (date.getFullYear() === now.getFullYear()) return `${month}.${day}`;
    return `${date.getFullYear()}.${month}.${day}`;
  }

  function formatCount(post, key) {
    if (post.canReadBody === false || post[key] === null || post[key] === undefined) return '-';
    return String(post[key]);
  }

  function rowHtml(post) {
    const comment = post.commentCount > 0 ? `<span class="pg-comment-count">[${post.commentCount}]</span>` : '';
    const pin = post.isNotice ? '<span class="pg-pin" aria-label="공지">📌</span>' : '';
    const title = post.bodyLocked ? `${post.title} <span class="pg-lock">비공개</span>` : post.title;
    const prefix = post.prefix || '[질문]';

    return `
      <tr class="${post.isNotice ? 'pg-notice-row' : ''}">
        <td class="pg-prefix-cell"><span class="pg-prefix pg-prefix--${prefixClass(prefix)}">${escapeHtml(prefix)}</span></td>
        <td class="pg-title-cell">
          <button type="button" class="pg-title-button" data-post-id="${escapeHtml(post.id)}">${pin}${title}${comment}</button>
        </td>
        <td class="pg-author-cell">${escapeHtml(post.authorLabel || '익명')}</td>
        <td class="pg-date-cell">${formatDate(post.createdAt)}</td>
        <td class="pg-count-cell">${formatCount(post, 'viewCount')}</td>
        <td class="pg-count-cell">${formatCount(post, 'likeCount')}</td>
      </tr>
    `;
  }

  function emptyHtml(tabId) {
    return `
      <div class="pg-empty">
        <svg class="pg-empty-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6.5h14M7 10h10M8 13.5h8M6.5 3.5h11l2 3v13H4.5v-13l2-3Z"></path>
        </svg>
        <p>${EMPTY_COPY[tabId] || EMPTY_COPY.all}</p>
      </div>
    `;
  }

  function lockedHtml() {
    return `
      <div class="pg-empty pg-empty--locked">
        <svg class="pg-empty-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10V7.5a5 5 0 0 1 10 0V10"></path>
          <path d="M6 10h12v10H6V10Z"></path>
          <path d="M12 14v2.5"></path>
        </svg>
        <strong>준비 중</strong>
        <p>${EMPTY_COPY.free}</p>
      </div>
    `;
  }

  function tableHtml(posts, hasMore) {
    const rows = posts.map(rowHtml).join('');
    return `
      <div class="pg-table-wrap">
        <table class="pg-table">
          <thead>
            <tr>
              <th>말머리</th>
              <th>제목</th>
              <th>글쓴이</th>
              <th>날짜</th>
              <th>조회</th>
              <th>추천</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${hasMore ? '<button type="button" class="pg-more" data-load-more>더보기</button>' : ''}
    `;
  }

  function initPlaygroundList({ api, root, tabsRoot }) {
    const state = {
      tabId: 'all',
      prefixId: 'all',
      posts: [],
      offset: 0,
      hasMore: false,
      loading: false
    };

    const tabContainer = tabsRoot || document.querySelector('.playground-tabs');
    if (tabContainer) {
      tabContainer.className = 'pg-tabs';
      tabContainer.innerHTML = PLAYGROUND_TABS.map((tab) => `
        <button type="button" class="pg-tab ${tab.id === state.tabId ? 'is-active' : ''}" data-tab-id="${tab.id}">${tab.label}</button>
      `).join('');
    }

    function activeTab() {
      return PLAYGROUND_TABS.find((tab) => tab.id === state.tabId) || PLAYGROUND_TABS[0];
    }

    function activePrefix() {
      return PREFIX_FILTERS.find((filter) => filter.id === state.prefixId) || PREFIX_FILTERS[0];
    }

    function getActiveTarget() {
      return activeTab();
    }

    function queryForState() {
      const prefix = activePrefix();
      if (prefix.category) {
        return { category: prefix.category, reviewKind: prefix.reviewKind };
      }
      const tab = activeTab();
      return { category: tab.category, reviewKind: tab.reviewKind };
    }

    function renderFilters() {
      return `
        <div class="pg-prefix-filter" aria-label="말머리 필터">
          ${PREFIX_FILTERS.map((filter) => `
            <button type="button" class="pg-prefix-filter-button ${filter.id === state.prefixId ? 'is-active' : ''}" data-prefix-id="${filter.id}">${filter.label}</button>
          `).join('')}
        </div>
      `;
    }

    function render() {
      const tab = activeTab();
      if (tab.locked) {
        root.innerHTML = renderFilters() + lockedHtml();
        return;
      }

      if (state.loading && state.posts.length === 0) {
        root.innerHTML = renderFilters() + '<p class="pg-loading">목록을 불러오는 중입니다.</p>';
        return;
      }

      if (state.posts.length === 0) {
        root.innerHTML = renderFilters() + emptyHtml(tab.id);
        return;
      }

      root.innerHTML = renderFilters() + tableHtml(state.posts, state.hasMore);
    }

    async function load({ append = false } = {}) {
      const tab = activeTab();
      if (tab.locked) {
        state.posts = [];
        state.offset = 0;
        state.hasMore = false;
        render();
        return;
      }

      state.loading = true;
      render();
      const query = queryForState();
      const nextOffset = append ? state.offset + PAGE_SIZE : 0;
      const result = await api.listPosts({
        category: query.category,
        reviewKind: query.reviewKind,
        limit: PAGE_SIZE,
        offset: nextOffset
      });

      state.posts = append ? state.posts.concat(result.posts) : result.posts;
      state.offset = result.offset;
      state.hasMore = result.hasMore;
      state.loading = false;
      render();
    }

    function reload() {
      return load({ append: false });
    }

    if (tabContainer) {
      tabContainer.addEventListener('click', (event) => {
        const button = event.target.closest('[data-tab-id]');
        if (!button) return;
        state.tabId = button.dataset.tabId;
        state.prefixId = 'all';
        for (const tabButton of tabContainer.querySelectorAll('[data-tab-id]')) {
          tabButton.classList.toggle('is-active', tabButton.dataset.tabId === state.tabId);
        }
        document.dispatchEvent(new CustomEvent('playground:tab-change', { detail: getActiveTarget() }));
        load({ append: false });
      });
    }

    root.addEventListener('click', (event) => {
      const postButton = event.target.closest('[data-post-id]');
      if (postButton) {
        document.dispatchEvent(new CustomEvent('playground:select-post', {
          detail: { postId: postButton.dataset.postId }
        }));
        return;
      }

      const moreButton = event.target.closest('[data-load-more]');
      if (moreButton) {
        load({ append: true });
        return;
      }

      const prefixButton = event.target.closest('[data-prefix-id]');
      if (prefixButton) {
        state.prefixId = prefixButton.dataset.prefixId;
        load({ append: false });
      }
    });

    load({ append: false });
    return { reload, getActiveTarget };
  }

  window.KalisPlaygroundList = {
    initPlaygroundList,
    PLAYGROUND_TABS,
    PREFIX_FILTERS
  };
})();
```

Create `kalis_magic_playground/playground-compose.js`:

```js
(function () {
  const PLAYGROUND_GUIDES = {
    all: {
      label: '전체 게시판',
      categoryHelp: '어떤 기록을 남길지 먼저 골라주면 됨. 질문, 모임 후기, 도구 리뷰, 자유 기록 중에서 가장 가까운 곳에 남기면 사람들이 더 잘 찾아볼 수 있음.',
      titlePlaceholder: '먼저 게시판을 선택하면 제목 예시가 나타남',
      bodyPlaceholder: '남기고 싶은 이야기에 가장 가까운 게시판을 선택하면, 그 글에 맞는 안내가 열림',
      extra: ''
    },
    free: {
      label: '자유 게시판',
      description: '오늘의 연습, 문득 든 생각, 마술하면서 생긴 작은 이야기를 편하게 남기는 공간임.',
      titleExamples: [
        '오늘 연습하다가 이런 생각이 들었음',
        '카드 한 벌 들고 나갔다가 생긴 일',
        '요즘 연습 중인 루틴 기록',
        '오늘 마술 보여주고 느낀 점'
      ],
      titleGuide: '오늘 남기고 싶은 이야기를 한 줄로 적으면 좋음.',
      bodyGuide: '연습한 것, 느낀 점, 사람들 반응, 다음에 해보고 싶은 것을 편하게 적으면 됨. 짧아도 좋고, 기록처럼 남겨도 좋음.',
      extra: '작은 기록도 쌓이면 누군가에게 길잡이가 됨.'
    },
    question: {
      label: '질문 게시판',
      description: '마술을 배우다 막히는 순간이 있으면 질문을 남기는 공간임. 먼저 지나간 사람이 답을 알고 있을 수 있음.',
      titleExamples: [
        '이 마술은 어디서 배워야 하나요?',
        '제 마술 피드백해 주실 수 있나요?',
        '카드 컨트롤은 어떤 순서로 연습하면 좋나요?',
        '처음 보여주기 좋은 마술 추천받고 싶음',
        '이 상황에서는 어떤 연출이 잘 맞을까요?'
      ],
      titleGuide: '궁금한 점이 바로 보이도록 한 줄로 적으면 답변받기 좋음.',
      bodyGuide: '궁금한 점과 현재 알고 있는 내용을 편하게 적으면 됨. 연습 중인 영상, 참고한 강의, 막힌 부분을 함께 남기면 더 구체적인 답변을 받을 수 있음.',
      youtubeGuide: '피드백을 받고 싶은 영상이 있다면 유튜브 링크를 함께 붙이면 좋음. 질문을 보는 사람이 장면을 바로 보고 답변할 수 있음.',
      extra: '처음 묻는 질문도 좋음. 누군가에게는 같은 고민을 해결하는 첫 기록이 될 수 있음.'
    },
    meeting: {
      label: '모임 후기 게시판',
      description: '모임에서 느낀 분위기와 기억에 남은 순간을 남기는 공간임. 그날의 기록이 다음 모임을 더 좋게 만듦.',
      titleExamples: [
        '이번 모임 다녀온 후기',
        '처음 참석해본 플랜비 후기',
        '오늘 모임에서 기억에 남은 순간',
        '마술 없이도 재밌었던 모임 기록',
        '다음 모임에도 가고 싶은 이유'
      ],
      titleGuide: '어떤 모임을 다녀왔는지 알 수 있게 적으면 좋음.',
      bodyGuide: '모임에서 좋았던 점, 기억에 남은 사람이나 순간, 다음에 추가되면 좋을 프로그램을 편하게 적으면 됨. 짧은 감상도 좋은 기록이 됨.',
      photoGuide: '칼리형이 올린 사진 중에서 마음에 드는 사진 2-5장을 골라 함께 남길 수 있음.',
      extra: '모임 후기는 처음 오는 사람에게 가장 큰 안내서가 됨.'
    },
    tool: {
      label: '리뷰 후기 게시판',
      description: '직접 써본 도구와 강의 경험을 남기는 공간임. 좋은 점과 활용 장면을 남기면 다음 사람이 선택하기 쉬워짐.',
      titleExamples: [
        '이 덱 직접 써본 후기',
        '초보자가 쓰기 좋았던 카드 도구',
        '이 강의 보고 실제로 써본 느낌',
        '실전에서 반응 좋았던 도구 리뷰',
        '가격 대비 만족스러웠던 마술 도구'
      ],
      titleGuide: '무엇을 써봤는지와 어떤 느낌이었는지 드러나게 적으면 좋음.',
      bodyGuide: '사용해 본 도구나 강의의 장점, 실제로 써본 상황, 추천하고 싶은 사람을 적으면 좋음. 반응이 좋았던 장면이나 연습 난이도를 함께 남기면 더 도움이 됨.',
      extraItemGuide: '가능하면 가격대, 난이도, 필요한 준비물, 실전 활용도를 함께 적으면 기록의 가치가 커짐.',
      extra: '내가 써본 경험이 누군가에게는 시행착오를 줄여주는 길잡이가 됨.'
    },
    magazine: {
      label: '매거진 게시판',
      description: '마술 놀이터에 쌓인 좋은 질문과 답변, 후기와 리뷰를 골라 오래 볼 수 있게 모아두는 공간임.',
      userGuide: '이곳은 마술 놀이터에서 오래 남기고 싶은 글을 모아두는 공간임. 좋은 질문, 좋은 답변, 좋은 후기, 좋은 리뷰가 매거진 후보가 될 수 있음.',
      titleExamples: [
        '처음 마술을 배우는 사람에게 필요한 질문',
        '입문자가 가장 많이 막히는 지점',
        '모임 후기로 보는 마술 놀이터 분위기',
        '실전에서 반응 좋았던 도구 모음',
        '이번 주 좋은 질문과 답변'
      ],
      titleGuide: '나중에 다시 찾아보고 싶은 주제가 드러나게 적으면 좋음.',
      bodyGuide: '원글의 핵심, 답변에서 얻을 수 있는 배움, 다음 사람이 참고할 포인트를 정리하면 좋음. 원글과 답변을 연결해 작은 아카이브처럼 남기면 됨.',
      extra: '매거진은 흘러가는 게시판에서 오래 남길 만한 기록을 건져 올리는 공간임.'
    }
  };

  const POST_TYPE_BY_CATEGORY = {
    question: 'question',
    tool: 'review_comment',
    magazine: 'magazine'
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function categoryFromTarget(target) {
    if (!target || target.id === 'all') return 'all';
    if (target.id === 'question') return 'question';
    if (target.id === 'review_tool') return 'tool';
    if (target.id === 'review_meeting') return 'meeting';
    if (target.id === 'magazine') return 'magazine';
    if (target.id === 'free') return 'free';
    return 'all';
  }

  function guideHtml(category) {
    const guide = PLAYGROUND_GUIDES[category] || PLAYGROUND_GUIDES.all;
    const examples = guide.titleExamples ? `<p class="pg-compose-examples">${guide.titleExamples.map(escapeHtml).join(' / ')}</p>` : '';
    const lines = [
      guide.categoryHelp,
      guide.description,
      guide.userGuide,
      guide.titleGuide,
      guide.bodyGuide,
      guide.youtubeGuide,
      guide.photoGuide,
      guide.extraItemGuide,
      guide.extra
    ].filter(Boolean);

    return `
      <div class="pg-compose-guide">
        <strong>${escapeHtml(guide.label)}</strong>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
        ${examples}
      </div>
    `;
  }

  function selectHtml(selected) {
    const options = [
      ['all', '게시판 선택'],
      ['question', '질문함'],
      ['tool', '도구 리뷰'],
      ['meeting', '모임 후기'],
      ['magazine', '매거진'],
      ['free', '자유 기록🔒']
    ];
    return `
      <label>
        <span>게시판</span>
        <select name="category" required>
          ${options.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
    `;
  }

  function formHtml(category) {
    const guide = PLAYGROUND_GUIDES[category] || PLAYGROUND_GUIDES.all;
    const titlePlaceholder = guide.titleGuide || guide.titlePlaceholder || PLAYGROUND_GUIDES.all.titlePlaceholder;
    const bodyPlaceholder = guide.bodyGuide || guide.bodyPlaceholder || PLAYGROUND_GUIDES.all.bodyPlaceholder;

    if (category === 'free') {
      return `
        ${guideHtml('free')}
        <p class="pg-compose-status">자유 기록은 준비 중입니다. 질문함과 리뷰가 자리 잡은 뒤 열립니다.</p>
      `;
    }

    if (category === 'meeting') {
      return `
        ${guideHtml('meeting')}
        <p class="pg-compose-status">모임 후기는 기존 모임 후기 작성 화면에서 남깁니다.</p>
        <a class="pg-compose-link" href="reviews.html">모임 후기 작성하러 가기</a>
      `;
    }

    return `
      ${guideHtml(category)}
      <form data-playground-compose-form>
        ${selectHtml(category)}
        <label>
          <span>제목</span>
          <input name="title" type="text" maxlength="120" required placeholder="${escapeHtml(titlePlaceholder)}">
        </label>
        <label>
          <span>내용</span>
          <textarea name="body" rows="7" required placeholder="${escapeHtml(bodyPlaceholder)}"></textarea>
        </label>
        <div class="pg-compose-grid">
          <label>
            <span>공개 범위</span>
            <select name="visibility">
              <option value="public">전체 공개</option>
              <option value="kali_only">칼리에게만 공개</option>
              <option value="expert_only">전문가 이상 공개</option>
            </select>
          </label>
          <label>
            <span>표시 이름</span>
            <select name="displayMode">
              <option value="nickname">닉네임 표시</option>
              <option value="anonymous">익명</option>
            </select>
          </label>
        </div>
        <label>
          <span>유튜브 링크 선택</span>
          <input name="youtubeUrl" type="url" placeholder="https://youtu.be/video-id">
        </label>
        <button type="submit" class="pg-submit">글 올리기</button>
        <p class="pg-compose-status" data-compose-status></p>
      </form>
    `;
  }

  function initPlaygroundCompose({ api, root, getActiveTarget, onCreated }) {
    let openCategory = categoryFromTarget(getActiveTarget && getActiveTarget());

    function renderClosed() {
      root.innerHTML = `
        <div class="pg-compose-closed">
          <button type="button" class="pg-write-button" data-open-compose>글쓰기</button>
        </div>
      `;
    }

    function open(category = categoryFromTarget(getActiveTarget && getActiveTarget())) {
      openCategory = category;
      root.innerHTML = `
        <section class="pg-compose" aria-label="글쓰기">
          <div class="pg-compose-head">
            <h2>글쓰기</h2>
            <button type="button" class="pg-compose-close" data-close-compose>닫기</button>
          </div>
          ${formHtml(openCategory)}
        </section>
      `;
    }

    function close() {
      renderClosed();
    }

    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-compose]')) open();
      if (event.target.closest('[data-close-compose]')) close();
    });

    root.addEventListener('change', (event) => {
      if (event.target.name === 'category') open(event.target.value);
    });

    root.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-playground-compose-form]');
      if (!form) return;
      event.preventDefault();
      const status = form.querySelector('[data-compose-status]');
      const formData = new FormData(form);
      const category = formData.get('category');
      const postType = POST_TYPE_BY_CATEGORY[category];
      if (!postType) {
        status.textContent = '이 게시판은 아직 글쓰기를 지원하지 않습니다.';
        return;
      }

      status.textContent = '올리는 중입니다.';
      try {
        await api.createPost({
          postType,
          title: formData.get('title'),
          body: formData.get('body'),
          visibility: formData.get('visibility'),
          displayMode: formData.get('displayMode'),
          youtubeUrl: formData.get('youtubeUrl') || null
        });
        status.textContent = '글이 올라갔습니다.';
        close();
        if (onCreated) onCreated();
      } catch (error) {
        status.textContent = error.message || '글을 올리지 못했어요.';
      }
    });

    document.addEventListener('playground:tab-change', (event) => {
      openCategory = categoryFromTarget(event.detail);
    });

    renderClosed();
    return { open, close };
  }

  window.KalisPlaygroundCompose = {
    initPlaygroundCompose,
    PLAYGROUND_GUIDES
  };
})();
```

Create `kalis_magic_playground/playground-detail.js`:

```js
(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  function countText(post, key) {
    if (post.canReadBody === false || post[key] === null || post[key] === undefined) return '-';
    return String(post[key]);
  }

  function bodyHtml(post) {
    if (post.canReadBody === false || post.bodyLocked) {
      return '<div class="pg-locked-body">비공개 글입니다. 본문 읽기 권한이 필요합니다.</div>';
    }
    return `<div class="pg-detail-body">${escapeHtml(post.body || '').replaceAll('\n', '<br>')}</div>`;
  }

  function answerHtml(answers) {
    if (!answers || answers.length === 0) return '';
    return `
      <section class="pg-detail-section">
        <h3>답변</h3>
        ${answers.map((answer) => `
          <article class="pg-answer">
            <p>${escapeHtml(answer.body || '').replaceAll('\n', '<br>')}</p>
            <small>${escapeHtml(answer.authorLabel || '익명')}</small>
          </article>
        `).join('')}
      </section>
    `;
  }

  function commentHtml(comments) {
    if (!comments || comments.length === 0) return '';
    return `
      <section class="pg-detail-section">
        <h3>댓글</h3>
        ${comments.map((comment) => `
          <article class="pg-comment">
            <p>${escapeHtml(comment.body || '').replaceAll('\n', '<br>')}</p>
            <small>${escapeHtml(comment.authorLabel || '익명')}</small>
          </article>
        `).join('')}
      </section>
    `;
  }

  function detailHtml({ post, answers, comments }) {
    const likeButton = post.canReadBody === false ? '' : `
      <button type="button" class="pg-like-button ${post.viewerLiked ? 'is-active' : ''}" data-like-post="${escapeHtml(post.id)}">
        ${post.viewerLiked ? '추천 취소' : '추천'}
      </button>
    `;
    const deleteButton = post.canDelete ? `
      <button type="button" class="pg-delete-button" data-delete-post="${escapeHtml(post.id)}">삭제</button>
    ` : '';

    return `
      <article class="pg-detail">
        <header class="pg-detail-head">
          <span class="pg-prefix">${escapeHtml(post.prefix || '')}</span>
          <h2>${post.isNotice ? '📌 ' : ''}${escapeHtml(post.title)}</h2>
          <div class="pg-detail-meta">
            <span>${escapeHtml(post.authorLabel || '익명')}</span>
            <span>${formatDate(post.createdAt)}</span>
            <span>조회 ${countText(post, 'viewCount')}</span>
            <span data-like-count>추천 ${countText(post, 'likeCount')}</span>
          </div>
          <div class="pg-detail-actions">
            ${likeButton}
            ${deleteButton}
          </div>
        </header>
        ${bodyHtml(post)}
        ${answerHtml(answers)}
        ${commentHtml(comments)}
        <p class="pg-detail-status" data-detail-status></p>
      </article>
    `;
  }

  function initPlaygroundDetail({ api, root }) {
    let currentPost = null;

    function clear() {
      currentPost = null;
      root.innerHTML = '<p class="pg-detail-placeholder">글을 선택하면 상세 내용이 열립니다.</p>';
    }

    async function loadPost(postId) {
      root.innerHTML = '<p class="pg-loading">글을 불러오는 중입니다.</p>';
      try {
        const data = await api.getPostDetail(postId);
        currentPost = data.post;
        root.innerHTML = detailHtml(data);
      } catch (error) {
        root.innerHTML = `<p class="pg-detail-status">${escapeHtml(error.message || '글을 불러오지 못했어요.')}</p>`;
      }
    }

    root.addEventListener('click', async (event) => {
      const likeButton = event.target.closest('[data-like-post]');
      if (likeButton && currentPost) {
        const status = root.querySelector('[data-detail-status]');
        try {
          const result = await api.togglePostLike(likeButton.dataset.likePost);
          currentPost.likeCount = result.likeCount;
          currentPost.viewerLiked = result.viewerLiked;
          likeButton.classList.toggle('is-active', result.viewerLiked);
          likeButton.textContent = result.viewerLiked ? '추천 취소' : '추천';
          const likeCount = root.querySelector('[data-like-count]');
          if (likeCount) likeCount.textContent = `추천 ${result.likeCount}`;
        } catch (error) {
          if (status) status.textContent = error.status === 401 ? '로그인하면 추천할 수 있어요' : error.message;
        }
        return;
      }

      const deleteButton = event.target.closest('[data-delete-post]');
      if (deleteButton && currentPost) {
        const ok = window.confirm('이 글을 삭제할까요?');
        if (!ok) return;
        const status = root.querySelector('[data-detail-status]');
        try {
          await api.deletePost(deleteButton.dataset.deletePost);
          root.innerHTML = '<p class="pg-detail-status">글이 삭제되었습니다.</p>';
          document.dispatchEvent(new CustomEvent('playground:post-deleted'));
        } catch (error) {
          if (status) status.textContent = error.message || '답변이 달린 질문은 삭제할 수 없어요';
        }
      }
    });

    document.addEventListener('playground:select-post', (event) => {
      loadPost(event.detail.postId);
    });

    clear();
    return { loadPost, clear };
  }

  window.KalisPlaygroundDetail = {
    initPlaygroundDetail
  };
})();
```

Replace `kalis_magic_playground/playground.js` with:

```js
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const api = window.KalisPlaygroundApi;
    const listRoot = document.querySelector('[data-post-list]');
    const detailRoot = document.querySelector('[data-post-detail]');
    const composeRoot = document.querySelector('.playground-compose');
    const tabsRoot = document.querySelector('.playground-tabs');

    const list = window.KalisPlaygroundList.initPlaygroundList({
      api,
      root: listRoot,
      tabsRoot
    });

    window.KalisPlaygroundDetail.initPlaygroundDetail({
      api,
      root: detailRoot
    });

    window.KalisPlaygroundCompose.initPlaygroundCompose({
      api,
      root: composeRoot,
      getActiveTarget: list.getActiveTarget,
      onCreated: list.reload
    });

    document.addEventListener('playground:post-deleted', () => {
      list.reload();
    });
  });
})();
```

Modify the script block at the end of `kalis_magic_playground/playground.html` to:

```html
  <script src="auth.js"></script>
  <script src="playground-api.js"></script>
  <script src="playground-list.js"></script>
  <script src="playground-compose.js"></script>
  <script src="playground-detail.js"></script>
  <script src="playground.js"></script>
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/playground-api.js kalis_magic_playground/playground-list.js kalis_magic_playground/playground-compose.js kalis_magic_playground/playground-detail.js kalis_magic_playground/playground.js kalis_magic_playground/playground.html kalis_magic_playground/tests/community/playground-modules.test.mjs
git commit -m "feat: 마술 놀이터 프론트 모듈 분리"
```

### Task 9: DC-Style Table UI And Styles

**Files:**
- Modify: `kalis_magic_playground/style.css`
- Test: `kalis_magic_playground/tests/community/playground-style.test.mjs`

**Interfaces:**
- Consumes: Task 8 rendered classes `.pg-tabs`, `.pg-tab`, `.pg-prefix-filter`, `.pg-table`, `.pg-notice-row`, `.pg-prefix`, `.pg-empty`, `.pg-more`, `.pg-detail`, `.pg-compose`
- Consumes: existing CSS variables `--bg-color`, `--bg-alt`, `--card-bg`, `--text-main`, `--text-muted`, `--point-gold`, `--point-gold-rgb`, `--point-gold-hover`, `--border-subtle`, `--border-light`
- Produces: appended `.pg-` prefixed CSS block at the end of `kalis_magic_playground/style.css`
- Produces: notice pinned row style through `.pg-notice-row`
- Produces: prefix color variants `.pg-prefix--question`, `.pg-prefix--tool`, `.pg-prefix--meeting`, `.pg-prefix--magazine`
- Produces: mobile two-line compressed table layout under `@media (max-width: 720px)`
- Produces: empty state copy area styles for the verbatim text from the spec

- [ ] **Step 1: 실패 테스트 작성**

Create `kalis_magic_playground/tests/community/playground-style.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');

test('playground v2 styles append a pg-prefixed table block', () => {
  const marker = '/* ---------- magic playground board v2 pg-prefix ---------- */';
  const index = css.indexOf(marker);
  assert.notEqual(index, -1, 'style.css should contain the playground v2 marker');

  const block = css.slice(index);
  assert.match(block, /\.pg-table/);
  assert.match(block, /\.pg-table-wrap/);
  assert.match(block, /\.pg-notice-row/);
  assert.match(block, /\.pg-prefix--question/);
  assert.match(block, /\.pg-prefix--tool/);
  assert.match(block, /\.pg-prefix--meeting/);
  assert.match(block, /\.pg-prefix--magazine/);
  assert.match(block, /\.pg-empty/);
  assert.match(block, /@media \(max-width: 720px\)/);
  assert.equal(block.includes('.playground-'), false, 'new block should not edit existing playground classes');
});

test('playground v2 styles rely on existing color variables', () => {
  const block = css.slice(css.indexOf('/* ---------- magic playground board v2 pg-prefix ---------- */'));

  for (const variable of [
    '--bg-alt',
    '--card-bg',
    '--text-main',
    '--text-muted',
    '--point-gold',
    '--point-gold-rgb',
    '--point-gold-hover',
    '--border-subtle',
    '--border-light'
  ]) {
    assert.equal(block.includes(`var(${variable}`), true, `${variable} should be used`);
  }
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
not ok ... tests/community/playground-style.test.mjs
AssertionError [ERR_ASSERTION]: style.css should contain the playground v2 marker
```

- [ ] **Step 3: 최소 구현 작성**

Append this block to the end of `kalis_magic_playground/style.css`:

```css
/* ---------- magic playground board v2 pg-prefix ---------- */
.pg-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 auto 18px;
  max-width: var(--maxw);
}

.pg-tab,
.pg-prefix-filter-button,
.pg-write-button,
.pg-more,
.pg-submit,
.pg-compose-close,
.pg-like-button,
.pg-delete-button,
.pg-compose-link {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-main);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
}

.pg-tab,
.pg-prefix-filter-button {
  min-height: 38px;
  padding: 7px 12px;
  font-size: 0.9rem;
}

.pg-tab.is-active,
.pg-prefix-filter-button.is-active,
.pg-write-button,
.pg-submit,
.pg-like-button.is-active {
  border-color: rgba(var(--point-gold-rgb), 0.55);
  background: rgba(var(--point-gold-rgb), 0.16);
  color: var(--point-gold);
}

.pg-tab:hover,
.pg-prefix-filter-button:hover,
.pg-write-button:hover,
.pg-more:hover,
.pg-submit:hover,
.pg-compose-close:hover,
.pg-like-button:hover,
.pg-delete-button:hover,
.pg-compose-link:hover {
  border-color: rgba(var(--point-gold-rgb), 0.55);
  color: var(--point-gold);
}

.pg-prefix-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 12px;
}

.pg-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: rgba(18, 13, 10, 0.62);
}

.pg-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.94rem;
}

.pg-table th,
.pg-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-main);
  vertical-align: middle;
}

.pg-table th {
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 800;
  text-align: left;
}

.pg-table th:nth-child(1),
.pg-table td:nth-child(1) {
  width: 86px;
}

.pg-table th:nth-child(3),
.pg-table td:nth-child(3) {
  width: 116px;
}

.pg-table th:nth-child(4),
.pg-table td:nth-child(4),
.pg-table th:nth-child(5),
.pg-table td:nth-child(5),
.pg-table th:nth-child(6),
.pg-table td:nth-child(6) {
  width: 72px;
  text-align: center;
}

.pg-notice-row {
  background: linear-gradient(90deg, rgba(var(--point-gold-rgb), 0.14), rgba(var(--point-gold-rgb), 0.035));
}

.pg-notice-row .pg-title-button {
  color: #fff4e8;
  font-weight: 800;
}

.pg-prefix {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  min-height: 24px;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid rgba(var(--point-gold-rgb), 0.28);
  background: rgba(var(--point-gold-rgb), 0.08);
  color: var(--point-gold);
  font-size: 0.78rem;
  font-weight: 900;
  white-space: nowrap;
}

.pg-prefix--question {
  color: color-mix(in srgb, var(--point-gold) 82%, #f4efe9);
  border-color: rgba(var(--point-gold-rgb), 0.38);
}

.pg-prefix--tool {
  color: color-mix(in srgb, var(--point-gold) 68%, #ffd7a8);
  border-color: rgba(var(--point-gold-rgb), 0.32);
}

.pg-prefix--meeting {
  color: color-mix(in srgb, var(--point-gold) 58%, #f4efe9);
  border-color: rgba(var(--point-gold-rgb), 0.25);
}

.pg-prefix--magazine {
  color: color-mix(in srgb, var(--point-gold) 76%, #ffe6bd);
  border-color: rgba(var(--point-gold-rgb), 0.45);
  background: rgba(var(--point-gold-rgb), 0.13);
}

.pg-title-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-main);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.pg-title-button:hover {
  color: var(--point-gold);
}

.pg-pin,
.pg-comment-count,
.pg-lock {
  color: var(--point-gold);
  font-weight: 900;
}

.pg-author-cell,
.pg-date-cell,
.pg-count-cell {
  color: var(--text-muted);
  font-size: 0.86rem;
}

.pg-more,
.pg-write-button,
.pg-submit,
.pg-compose-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 8px 14px;
  margin-top: 14px;
}

.pg-empty {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 180px;
  padding: 28px 18px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(var(--point-gold-rgb), 0.08), rgba(255, 255, 255, 0.025)), var(--bg-alt);
  color: var(--text-muted);
  text-align: center;
}

.pg-empty strong {
  color: var(--text-main);
  font-size: 1rem;
}

.pg-empty p {
  max-width: 520px;
  margin: 0;
  line-height: 1.75;
}

.pg-empty-icon {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--point-gold);
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pg-loading,
.pg-detail-placeholder,
.pg-detail-status,
.pg-compose-status {
  color: var(--text-muted);
}

.pg-detail,
.pg-compose {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--card-bg);
  padding: 18px;
}

.pg-detail-head h2,
.pg-compose-head h2 {
  margin: 8px 0 10px;
  color: var(--text-main);
  font-size: 1.24rem;
  line-height: 1.45;
}

.pg-detail-meta,
.pg-detail-actions,
.pg-compose-head,
.pg-compose-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.pg-detail-meta {
  color: var(--text-muted);
  font-size: 0.86rem;
}

.pg-detail-actions {
  margin-top: 14px;
}

.pg-like-button,
.pg-delete-button,
.pg-compose-close {
  min-height: 36px;
  padding: 6px 11px;
}

.pg-delete-button {
  border-color: rgba(255, 130, 110, 0.35);
  color: #ffb49d;
}

.pg-detail-body,
.pg-locked-body,
.pg-answer,
.pg-comment,
.pg-compose-guide {
  margin-top: 16px;
  color: #eadfd4;
  line-height: 1.85;
}

.pg-locked-body {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.025);
}

.pg-detail-section {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--border-subtle);
}

.pg-detail-section h3 {
  margin: 0 0 10px;
  color: var(--point-gold);
  font-size: 0.96rem;
}

.pg-answer,
.pg-comment {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.025);
}

.pg-compose-closed {
  display: flex;
  justify-content: flex-end;
}

.pg-compose-guide {
  border: 1px solid rgba(var(--point-gold-rgb), 0.2);
  border-radius: 8px;
  padding: 14px;
  background: rgba(var(--point-gold-rgb), 0.07);
}

.pg-compose-guide strong {
  display: block;
  margin-bottom: 8px;
  color: var(--point-gold);
}

.pg-compose-guide p,
.pg-compose-examples {
  margin: 5px 0 0;
  color: #e8dace;
  font-size: 0.92rem;
}

.pg-compose label {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 800;
}

.pg-compose input,
.pg-compose textarea,
.pg-compose select {
  width: 100%;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: #120d0a;
  color: var(--text-main);
  font: inherit;
  padding: 10px 11px;
}

.pg-compose textarea {
  resize: vertical;
}

.pg-compose-grid > label {
  flex: 1 1 220px;
}

@media (max-width: 720px) {
  .pg-tabs,
  .pg-prefix-filter {
    gap: 6px;
  }

  .pg-tab,
  .pg-prefix-filter-button {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
    padding: 7px 8px;
    font-size: 0.84rem;
  }

  .pg-table-wrap {
    overflow-x: visible;
  }

  .pg-table,
  .pg-table tbody,
  .pg-table tr,
  .pg-table td {
    display: block;
    width: 100%;
  }

  .pg-table thead {
    display: none;
  }

  .pg-table tr {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "prefix title"
      "meta meta";
    gap: 4px 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .pg-table td {
    padding: 0;
    border-bottom: 0;
  }

  .pg-prefix-cell {
    grid-area: prefix;
  }

  .pg-title-cell {
    grid-area: title;
    min-width: 0;
  }

  .pg-title-button {
    width: 100%;
    justify-content: flex-start;
    line-height: 1.45;
  }

  .pg-author-cell,
  .pg-date-cell,
  .pg-count-cell {
    display: inline;
    width: auto;
    color: var(--text-muted);
    font-size: 0.78rem;
    text-align: left;
  }

  .pg-author-cell {
    grid-area: meta;
  }

  .pg-date-cell,
  .pg-count-cell {
    grid-area: meta;
    padding-left: 0;
    margin-left: 0;
  }

  .pg-author-cell::after,
  .pg-date-cell::after,
  .pg-count-cell:first-of-type::after {
    content: " · ";
    color: var(--text-muted);
  }

  .pg-detail,
  .pg-compose {
    padding: 14px;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run:

```bash
cd kalis_magic_playground && npm run test:js
```

Expected:

```text
# pass
# fail 0
```

Run:

```bash
git diff -- kalis_magic_playground/style.css | rg '^-([^-]|$)'
```

Expected:

```text
```

Run:

```bash
git diff -- kalis_magic_playground/style.css | rg '^\+(\.pg-|@media|/\* ---------- magic playground board v2 pg-prefix ---------- \*/)'
```

Expected:

```text
+/* ---------- magic playground board v2 pg-prefix ---------- */
+.pg-tabs {
+.pg-tab,
+.pg-tab,
+.pg-tab.is-active,
+.pg-tab:hover,
+.pg-prefix-filter {
+.pg-table-wrap {
+.pg-table {
+.pg-table th,
+.pg-table th {
+.pg-table th:nth-child(1),
+.pg-table th:nth-child(3),
+.pg-table th:nth-child(4),
+.pg-notice-row {
+.pg-notice-row .pg-title-button {
+.pg-prefix {
+.pg-prefix--question {
+.pg-prefix--tool {
+.pg-prefix--meeting {
+.pg-prefix--magazine {
+.pg-title-button {
+.pg-title-button:hover {
+.pg-pin,
+.pg-author-cell,
+.pg-more,
+.pg-empty {
+.pg-empty strong {
+.pg-empty p {
+.pg-empty-icon {
+.pg-loading,
+.pg-detail,
+.pg-detail-head h2,
+.pg-detail-meta,
+.pg-detail-meta {
+.pg-detail-actions {
+.pg-like-button,
+.pg-delete-button {
+.pg-detail-body,
+.pg-locked-body {
+.pg-detail-section {
+.pg-detail-section h3 {
+.pg-answer,
+.pg-compose-closed {
+.pg-compose-guide {
+.pg-compose-guide strong {
+.pg-compose-guide p,
+.pg-compose label {
+.pg-compose input,
+.pg-compose textarea {
+.pg-compose-grid > label {
+@media (max-width: 720px) {
```

- [ ] **Step 5: 커밋**

```bash
git add kalis_magic_playground/style.css kalis_magic_playground/tests/community/playground-style.test.mjs
git commit -m "feat: 마술 놀이터 테이블 스타일 추가"
```

### Task 10: 포인트 SVG 일러스트

**Files:**
- Create: `kalis_magic_playground/assets/playground/board-header.svg`
- Create: `kalis_magic_playground/assets/playground/empty-question.svg`
- Create: `kalis_magic_playground/assets/playground/empty-review.svg`
- Test: `kalis_magic_playground/tests/community/playground-assets.test.mjs`

- [ ] **Step 1: SVG 에셋 테스트를 먼저 추가**

Create `kalis_magic_playground/tests/community/playground-assets.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const assets = [
  new URL('../../assets/playground/board-header.svg', import.meta.url),
  new URL('../../assets/playground/empty-question.svg', import.meta.url),
  new URL('../../assets/playground/empty-review.svg', import.meta.url)
];

test('playground point svg assets exist and use the shared 24x24 viewBox', () => {
  for (const assetUrl of assets) {
    assert.equal(existsSync(assetUrl), true, `${assetUrl.pathname} should exist`);

    const source = readFileSync(assetUrl, 'utf8');
    assert.match(source, /viewBox="0 0 24 24"/);
    assert.match(source, /stroke="currentColor"/);
  }
});
```

Run the focused test and confirm it fails because the three SVG files do not exist yet:

```bash
cd kalis_magic_playground
node --test tests/community/playground-assets.test.mjs
```

- [ ] **Step 2: 보드 헤더 모자 SVG 생성**

Create `kalis_magic_playground/assets/playground/board-header.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M7.5 18h9" />
  <path d="M8.5 16.5 10 6.5h4l1.5 10" />
  <path d="M7 16.5h10" />
  <path d="M9.5 10.5h5" />
  <path d="M6 18c1.4 1.2 10.6 1.2 12 0" />
  <path d="M12 3.5v3" />
  <path d="M10.8 4.8h2.4" />
</svg>
```

- [ ] **Step 3: 빈 질문 카드 SVG 생성**

Create `kalis_magic_playground/assets/playground/empty-question.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="5" y="4" width="14" height="16" rx="2.2" />
  <path d="M8 8h8" />
  <path d="M8 16h5" />
  <path d="M9.5 10.2c.4-1 1.3-1.7 2.5-1.7 1.4 0 2.5.9 2.5 2.2 0 .9-.5 1.5-1.2 2-.7.5-1.3.9-1.3 1.8v.2" />
  <path d="M12 17.7h.01" />
</svg>
```

- [ ] **Step 4: 빈 후기 편지 SVG 생성**

Create `kalis_magic_playground/assets/playground/empty-review.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M5 7.5h14v10.2c0 1-.8 1.8-1.8 1.8H6.8c-1 0-1.8-.8-1.8-1.8V7.5Z" />
  <path d="m5.8 8.4 6.2 5 6.2-5" />
  <path d="M8 7V5.8C8 5 8.7 4.3 9.5 4.3h5c.8 0 1.5.7 1.5 1.5V7" />
  <path d="M8.5 15.8h5" />
  <path d="M8.5 17.8h3" />
</svg>
```

All three SVGs must keep `stroke="currentColor"` and avoid hardcoded color values so the consuming UI can apply `color: var(--point-gold)` from CSS.

- [ ] **Step 5: 테스트와 커밋**

```bash
cd kalis_magic_playground
node --test tests/community/playground-assets.test.mjs
git add assets/playground/board-header.svg assets/playground/empty-question.svg assets/playground/empty-review.svg tests/community/playground-assets.test.mjs
git commit -m "feat: 마술 놀이터 포인트 SVG 추가"
```

### Task 11: 배포 등록

**Files:**
- Modify: `kalis_magic_playground/scripts/build-public.mjs`
- Test: `kalis_magic_playground/tests/community/build-public.test.mjs`

- [ ] **Step 1: assets 공개 디렉터리 등록 확인**

`assets/`는 신규 SVG가 들어가는 디렉터리이므로 `PUBLIC_DIRS`에 이미 포함되어 있어야 한다. 포함되어 있지 않으면 이 Task에서 중단하고 `PUBLIC_DIRS`에 `assets`를 추가한 뒤 같은 테스트를 다시 실행한다.

```bash
cd kalis_magic_playground
rg -n "PUBLIC_DIRS|assets" scripts/build-public.mjs
```

- [ ] **Step 2: 신규 프론트 모듈을 PUBLIC_FILES에 등록**

Modify `kalis_magic_playground/scripts/build-public.mjs` and add these entries to the existing `PUBLIC_FILES` array without removing existing entries:

```js
  'playground-api.js',
  'playground-list.js',
  'playground-compose.js',
  'playground-detail.js',
```

- [ ] **Step 3: 배포 allowlist 테스트 확인**

Run the existing build-public test and confirm it covers the new JS files and the dist reference integrity test:

```bash
cd kalis_magic_playground
node --test tests/community/build-public.test.mjs
```

- [ ] **Step 4: dist 빌드 무결성 확인**

Run the public build first, then rerun the same dist integrity test so generated output and allowlist stay aligned:

```bash
cd kalis_magic_playground
npm run build
node --test tests/community/build-public.test.mjs
```

- [ ] **Step 5: 커밋**

```bash
cd kalis_magic_playground
git add scripts/build-public.mjs tests/community/build-public.test.mjs
git commit -m "chore: 마술 놀이터 공개 빌드 등록"
```

### Task 12: 통합 검증

**Files:**
- Commit files: none, verification-only empty commit

- [ ] **Step 1: 전체 자동 검증 실행**

Run the project verification command from the package root. Expected result: GREEN.

```bash
cd kalis_magic_playground
npm run verify
```

- [ ] **Step 2: 로컬 http.server 실렌더 확인**

Build the public output, serve it locally, and inspect the actual rendered pages in a browser:

```bash
cd kalis_magic_playground
npm run build
cd dist
python3 -m http.server 4173
```

Open `http://localhost:4173/playground.html` and verify these rendered states:

- 게시판 첫 화면에서 질문, 후기, 자유 기록 탭이 보인다.
- 자유 기록 탭은 잠금 상태로 보이고 글쓰기 API 흐름으로 진입하지 않는다.
- 질문과 후기 목록의 말머리, 공지, 조회수, 추천수 컬럼이 깨지지 않는다.
- 빈 질문 상태와 빈 후기 상태에서 포인트 SVG가 보인다.
- 상세 화면에서 본문, 추천 버튼, 삭제 버튼, 답변 영역이 겹치지 않는다.
- 모바일 폭에서 탭, 리스트, 상세, 작성 닫힘 안내가 가로 스크롤 없이 보인다.

- [ ] **Step 3: 수동 QA 체크리스트**

스펙의 신규 테스트를 사용자 시나리오로 변환해 아래 8개 항목을 확인한다:

- 로그인한 사용자가 글을 추천하고 다시 취소하면 추천수와 버튼 상태가 각각 선택, 해제 상태로 정확히 바뀐다.
- 공지로 지정된 글은 일반 글보다 위에 보이고, 공지 해제 후에는 최신순 위치로 돌아간다.
- 후기 탭에서 도구 후기는 `[도구]`, 모임 후기는 `[모임]` 말머리로 구분되어 보인다.
- 자유 기록 탭을 누르면 준비 중 빈 화면만 보이고 글쓰기 폼이나 목록 요청이 발생하지 않는다.
- 목록을 더 불러오면 한 번에 20개 이하만 추가되고 더 볼 글이 없을 때 추가 로딩 상태가 사라진다.
- 읽을 수 있는 글 상세에 들어가면 조회수가 증가하고, 읽을 수 없는 비공개 글이나 삭제된 글은 조회수가 증가하지 않는다.
- 본인은 답변 없는 글을 삭제할 수 있고, 타인의 글이나 답변이 달린 질문 삭제는 사용자에게 거부 메시지로 안내된다.
- 본문 권한이 없는 비공개 글은 조회수와 추천수가 `-`로 보이고 추천 버튼이 보이지 않는다.

- [ ] **Step 4: 검증 결과 커밋**

This Task changes no code files. Create an empty verification commit so the integration pass is visible in history:

```bash
cd kalis_magic_playground
git status --short
git commit --allow-empty -m "test: 마술 놀이터 v2 통합 검증"
```

- [ ] **Step 5: 최종 상태 확인**

```bash
cd kalis_magic_playground
git status --short
```

## 스펙 커버리지 매핑

| 스펙 주요 절 | 담당 Task | 커버리지 확인 |
| --- | --- | --- |
| 탭·말머리 | Task 2, Task 3, Task 8, Task 9, Task 12 | post type validation, category filter, front module split, table UI, manual QA checklist |
| 조회·추천 토글 | Task 4, Task 5, Task 8, Task 12 | detail view count, like toggle API, front like state, manual QA checklist |
| 본인 삭제 | Task 6, Task 8, Task 12 | owner soft delete API, front delete action, manual QA checklist |
| 공지 | Task 3, Task 7, Task 8, Task 12 | notice sorting, admin pin and unpin, front notice rendering, manual QA checklist |
| 매거진 | Task 8, Task 9, Task 12 | front composition and styled board surface verified in browser |
| 가이드 문구 | Task 8, Task 9, Task 12 | compose closed guide copy, styled guide block, manual render check |
| 빈 상태 | Task 8, Task 9, Task 10, Task 12 | empty state rendering, styling, point SVG assets, browser verification |
| 모바일 | Task 9, Task 12 | responsive CSS and mobile render check |
| SVG | Task 10, Task 12 | board header, empty question, empty review assets and browser verification |
| 배포 안전 | Task 11, Task 12 | PUBLIC_FILES registration, PUBLIC_DIRS asset check, build and verify commands |
| 비공개 숨김 | Task 3, Task 4, Task 8, Task 12 | list and detail private count hiding, front hidden count display, manual QA checklist |
