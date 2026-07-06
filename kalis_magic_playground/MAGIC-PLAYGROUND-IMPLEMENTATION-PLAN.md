# Magic Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `마술 놀이터`, a Google-login community layer for kalimagic with Q&A, event reviews, comments/replies, and an admin inbox while keeping the existing static site safe and reversible.

**Architecture:** Keep the current static HTML/CSS/JS site, add a curated `dist/` build, Netlify Functions as the only write/admin API boundary, and Supabase Auth/Postgres for identity, permissions, and community data. The public browser renders only data returned by policy-checked functions; private question bodies and admin data are never bundled into static JS.

**Tech Stack:** Vanilla HTML/CSS/JS, Node 20 ESM, Netlify Functions, Supabase Auth/Postgres, built-in `node:test`, existing Python pytest smoke tests.

---

## Spec Inputs

- Primary PRD: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/MAGIC-PLAYGROUND-PRD.md`
- Reference draft only: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/COMMUNITY-MVP-DESIGN.md`
- Existing site files: `index.html`, `reviews.html`, `modal.js`, `style.css`, `nav.js`, `content.js`

## Adversarial Review Before Build

The PRD is directionally right, but five risks must shape the implementation order:

1. **Scope risk:** Q&A, event reviews, comments, admin, Google login, and Supabase are too large for one undivided task. The plan splits them into independently testable slices.
2. **Deployment exposure risk:** The project root contains docs, drafts, archive files, and source. The first task creates a curated `dist/` build so Netlify does not publish the whole working tree.
3. **Privacy risk:** Private question titles are visible, but bodies, author identity, answers, and comments require access checks. Public list and detail functions must be separate from admin/detail functions.
4. **Moderation risk:** Event reviews are immediate-public. Admin hide/restore/delete must exist before event reviews are launched publicly.
5. **Free-tier risk:** No direct photo/video upload in MVP. Event review photos are chosen from Kali-uploaded static assets only; videos are YouTube IDs only.

## File Structure

Create these files:

- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/package.json`  
  Node scripts for tests and curated static build.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify.toml`  
  Netlify build and functions configuration, publishing only `dist/`.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/scripts/build-public.mjs`  
  Copies allowlisted site files/assets to `dist/`.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/.env.example`  
  Placeholder environment variable names only.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/supabase/migrations/20260706_magic_playground.sql`  
  Tables, indexes, RLS, and helper functions.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/http.mjs`  
  Request/response helpers.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/supabase.mjs`  
  Server-side Supabase clients.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/auth.mjs`  
  JWT and role checks.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/validators.mjs`  
  Validation and YouTube parsing.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/health.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/posts.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/post-detail.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/comments.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/answers.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/admin-inbox.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/auth.js`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/playground.js`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/reviews-community.js`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/playground.html`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/admin.html`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/validators.test.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/build-public.test.mjs`
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/access-policy.test.mjs`

Modify these files:

- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/nav.js`  
  Add `마술 놀이터` nav item.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/reviews.html`  
  Add event review mount area and load `auth.js` / `reviews-community.js`.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css`  
  Add scoped `.playground-*`, `.community-*`, `.admin-*`, and `.event-review-*` styles.
- `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/test_site.py`  
  Add static smoke checks for new pages and script references.

Do not modify:

- Existing review card content unless a later task explicitly adds stable IDs.
- Existing `modal.js` behavior in the first backend/auth slice.
- `kalimagic-v2/` or any ignored design handoff folder.

---

### Task 1: Safe Static Build and Function Skeleton

**Files:**
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/package.json`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify.toml`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/scripts/build-public.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/.env.example`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/health.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/build-public.test.mjs`

- [ ] **Step 1: Write the build allowlist test**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/build-public.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_FILES, PUBLIC_DIRS, PRIVATE_PATTERNS } from '../../scripts/build-public.mjs';

test('public build allowlist includes visible site pages', () => {
  assert.ok(PUBLIC_FILES.includes('index.html'));
  assert.ok(PUBLIC_FILES.includes('reviews.html'));
  assert.ok(PUBLIC_FILES.includes('style.css'));
  assert.ok(PUBLIC_FILES.includes('nav.js'));
});

test('public build explicitly excludes local planning and source folders', () => {
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('MAGIC-PLAYGROUND-PRD.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('COMMUNITY-MVP-DESIGN.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('netlify/functions/posts.mjs')));
  assert.equal(PUBLIC_DIRS.includes('netlify'), false);
  assert.equal(PUBLIC_DIRS.includes('supabase'), false);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test tests/community/build-public.test.mjs
```

Expected: FAIL with `Cannot find module ... scripts/build-public.mjs`.

- [ ] **Step 3: Create `package.json`**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/package.json`:

```json
{
  "name": "kalimagic-playground",
  "private": true,
  "type": "module",
  "engines": {
    "node": "20.x"
  },
  "scripts": {
    "build": "node scripts/build-public.mjs",
    "test": "node --test tests/community/*.test.mjs && python3 -m pytest tests",
    "test:js": "node --test tests/community/*.test.mjs",
    "test:py": "python3 -m pytest tests"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {}
}
```

- [ ] **Step 4: Create the curated build script**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/scripts/build-public.mjs`:

```js
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

export const PUBLIC_FILES = [
  'about.html',
  'collapsible.js',
  'content.js',
  'editor.js',
  'favicon.svg',
  'index.html',
  'intro.html',
  'lesson.html',
  'lightbox.js',
  'mmbs.html',
  'modal.js',
  'nav.js',
  'playground.html',
  'admin.html',
  'reviews.html',
  'script.js',
  'style.css',
  'video.html',
  'works.html',
  'auth.js',
  'playground.js',
  'reviews-community.js'
];

export const PUBLIC_DIRS = [
  'assets',
  'imigi3',
  'kalimeeting',
  'planb'
];

export const PRIVATE_PATTERNS = [
  /^MAGIC-PLAYGROUND-PRD\.md$/,
  /^MAGIC-PLAYGROUND-IMPLEMENTATION-PLAN\.md$/,
  /^COMMUNITY-MVP-DESIGN\.md$/,
  /^netlify\/functions\//,
  /^supabase\//,
  /^tests\//,
  /^archive\//,
  /^docs\//,
  /^node_modules\//,
  /^\.env/,
  /^package-lock\.json$/
];

async function exists(relativePath) {
  try {
    await stat(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(relativePath) {
  if (!(await exists(relativePath))) return;
  await cp(path.join(ROOT, relativePath), path.join(DIST, relativePath), { recursive: true });
}

export async function buildPublic() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const file of PUBLIC_FILES) await copyIfExists(file);
  for (const dir of PUBLIC_DIRS) await copyIfExists(dir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPublic();
}
```

- [ ] **Step 5: Create Netlify configuration**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

- [ ] **Step 6: Create environment template**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/.env.example`:

```bash
SUPABASE_URL=https://example.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_example
SUPABASE_SECRET_KEY=sb_secret_example
MAGIC_PLAYGROUND_ADMIN_EMAILS=kali@example.com
```

- [ ] **Step 7: Create health function**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/health.mjs`:

```js
export async function handler() {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ok: true, service: 'magic-playground' })
  };
}
```

- [ ] **Step 8: Run JS tests and build**

Run:

```bash
npm install
npm run test:js
npm run build
```

Expected:

```text
tests pass
dist/index.html exists
dist/reviews.html exists
dist/MAGIC-PLAYGROUND-PRD.md does not exist
dist/netlify/functions/health.mjs does not exist
```

- [ ] **Step 9: Commit Task 1 only**

Run:

```bash
git add package.json package-lock.json netlify.toml scripts/build-public.mjs .env.example netlify/functions/health.mjs tests/community/build-public.test.mjs
git commit -m "chore(playground): add safe build and function skeleton"
```

---

### Task 2: Supabase Schema and Access Contract

**Files:**
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/supabase/migrations/20260706_magic_playground.sql`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/access-policy.test.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/access-policy.mjs`

- [ ] **Step 1: Write access policy tests**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/access-policy.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadPostBody, canReadAuthor, canPublishAnswer } from '../../netlify/functions/_lib/access-policy.mjs';

const author = { userId: 'u1', role: 'member' };
const other = { userId: 'u2', role: 'member' };
const kali = { userId: 'u3', role: 'kali' };
const expert = { userId: 'u4', role: 'expert' };

test('public post body is readable by anonymous visitors', () => {
  assert.equal(canReadPostBody({ visibility: 'public', authorUserId: 'u1' }, null), true);
});

test('kali_only post body is readable only by author or kali/admin', () => {
  const post = { visibility: 'kali_only', authorUserId: 'u1' };
  assert.equal(canReadPostBody(post, null), false);
  assert.equal(canReadPostBody(post, other), false);
  assert.equal(canReadPostBody(post, author), true);
  assert.equal(canReadPostBody(post, kali), true);
});

test('expert_only post body is readable by author, expert, kali, or admin', () => {
  const post = { visibility: 'expert_only', authorUserId: 'u1' };
  assert.equal(canReadPostBody(post, other), false);
  assert.equal(canReadPostBody(post, author), true);
  assert.equal(canReadPostBody(post, expert), true);
  assert.equal(canReadPostBody(post, kali), true);
});

test('private post author is hidden from unauthorized readers', () => {
  const post = { visibility: 'kali_only', authorUserId: 'u1' };
  assert.equal(canReadAuthor(post, other), false);
  assert.equal(canReadAuthor(post, author), true);
});

test('answer cannot be more public than the question', () => {
  assert.equal(canPublishAnswer({ visibility: 'kali_only' }, 'public'), false);
  assert.equal(canPublishAnswer({ visibility: 'public' }, 'public'), true);
  assert.equal(canPublishAnswer({ visibility: 'kali_only' }, 'author_only'), true);
});
```

- [ ] **Step 2: Run the access tests and verify failure**

Run:

```bash
node --test tests/community/access-policy.test.mjs
```

Expected: FAIL with missing `access-policy.mjs`.

- [ ] **Step 3: Create the access policy module**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/access-policy.mjs`:

```js
const ELEVATED_ROLES = new Set(['admin', 'kali']);

export function isElevated(viewer) {
  return Boolean(viewer && ELEVATED_ROLES.has(viewer.role));
}

export function isExpertOrHigher(viewer) {
  return Boolean(viewer && (viewer.role === 'expert' || ELEVATED_ROLES.has(viewer.role)));
}

export function isAuthor(post, viewer) {
  return Boolean(viewer && post.authorUserId && post.authorUserId === viewer.userId);
}

export function canReadPostBody(post, viewer) {
  if (post.visibility === 'public') return true;
  if (isAuthor(post, viewer)) return true;
  if (post.visibility === 'kali_only') return isElevated(viewer);
  if (post.visibility === 'expert_only') return isExpertOrHigher(viewer);
  return false;
}

export function canReadAuthor(post, viewer) {
  if (post.visibility === 'public') return true;
  return canReadPostBody(post, viewer);
}

export function canPublishAnswer(question, answerVisibility) {
  if (answerVisibility === 'author_only') return true;
  if (answerVisibility !== 'public') return false;
  return question.visibility === 'public';
}
```

- [ ] **Step 4: Create the database migration**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/supabase/migrations/20260706_magic_playground.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  role text not null default 'member' check (role in ('member', 'expert', 'admin', 'kali')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  post_type text not null check (post_type in ('question', 'event_review', 'review_comment', 'free', 'magazine')),
  category text not null check (category in ('question', 'event_review', 'review', 'free', 'magazine')),
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  display_mode text not null default 'nickname' check (display_mode in ('nickname', 'anonymous')),
  visibility text not null default 'public' check (visibility in ('public', 'kali_only', 'expert_only')),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  youtube_video_id text null check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  post_id uuid primary key references public.posts(id) on delete cascade,
  answer_status text not null default 'waiting' check (answer_status in ('waiting', 'answered', 'closed')),
  magazine_candidate boolean not null default false
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_post_id uuid not null references public.posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  visibility text not null default 'public' check (visibility in ('public', 'author_only')),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  is_pinned boolean not null default false,
  youtube_video_id text null check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  image_src text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_reviews (
  post_id uuid primary key references public.posts(id) on delete cascade,
  event_code text not null,
  good_moment text not null,
  impressive_scene text not null,
  next_program text not null,
  message_to_first_timer text not null
);

create table if not exists public.event_review_photos (
  post_id uuid not null references public.posts(id) on delete cascade,
  photo_id uuid not null references public.event_photos(id) on delete restrict,
  sort_order integer not null,
  primary key (post_id, photo_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_comment_id uuid null references public.comments(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  display_mode text not null default 'nickname' check (display_mode in ('nickname', 'anonymous')),
  body text not null check (char_length(body) between 1 and 1200),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_table text not null,
  target_id uuid not null,
  action text not null check (action in ('hide', 'restore', 'delete', 'answer', 'edit_answer', 'mark_magazine_candidate', 'change_visibility')),
  reason text null,
  before_status text null,
  after_status text null,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid references auth.users(id) on delete cascade,
  badge_id uuid references public.badges(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.support_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  support_level text not null check (support_level in ('3000', '10000', '50000')),
  source text null,
  created_at timestamptz not null default now()
);

create index if not exists posts_public_list_idx on public.posts (status, visibility, category, created_at desc);
create index if not exists posts_author_idx on public.posts (author_user_id, created_at desc);
create index if not exists comments_post_idx on public.comments (post_id, created_at asc);
create index if not exists answers_question_idx on public.answers (question_post_id, created_at asc);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.event_photos enable row level security;
alter table public.event_reviews enable row level security;
alter table public.event_review_photos enable row level security;
alter table public.comments enable row level security;
alter table public.moderation_events enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.support_records enable row level security;

insert into public.badges (code, label, description)
values
  ('user', '이용자', '마술 놀이터 이용자'),
  ('supporter_3000', '3천원 후원자', '운영비를 응원한 사람'),
  ('supporter_10000', '1만원 후원자', '운영비를 응원한 사람'),
  ('supporter_50000', '5만원 후원자', '운영비를 크게 응원한 사람'),
  ('expert', '전문가', '칼리형이 승인한 답변자'),
  ('kali', '칼리', '칼리형')
on conflict (code) do nothing;
```

- [ ] **Step 5: Run JS tests**

Run:

```bash
npm run test:js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2 only**

Run:

```bash
git add supabase/migrations/20260706_magic_playground.sql netlify/functions/_lib/access-policy.mjs tests/community/access-policy.test.mjs
git commit -m "feat(playground): define community schema and access policy"
```

---

### Task 3: Function Helpers and Validation

**Files:**
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/http.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/supabase.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/auth.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/validators.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/validators.test.mjs`

- [ ] **Step 1: Write validator tests**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/community/validators.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeVideoId,
  validatePostPayload,
  validateEventReviewPayload,
  validateCommentPayload
} from '../../netlify/functions/_lib/validators.mjs';

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

test('validateCommentPayload accepts parent comment id for replies', () => {
  const payload = validateCommentPayload({
    postId: '11111111-1111-4111-8111-111111111111',
    parentCommentId: '22222222-2222-4222-8222-222222222222',
    body: '저도 같은 생각입니다.',
    displayMode: 'nickname'
  });
  assert.equal(payload.parentCommentId, '22222222-2222-4222-8222-222222222222');
});
```

- [ ] **Step 2: Run validator tests and verify failure**

Run:

```bash
node --test tests/community/validators.test.mjs
```

Expected: FAIL with missing `validators.mjs`.

- [ ] **Step 3: Create `validators.mjs`**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/validators.mjs` with exported functions named in the test. Use these rules:

```js
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POST_TYPES = new Set(['question', 'event_review', 'review_comment', 'free', 'magazine']);
const DISPLAY_MODES = new Set(['nickname', 'anonymous']);
const VISIBILITIES = new Set(['public', 'kali_only', 'expert_only']);

function clean(value) {
  return String(value ?? '').trim();
}

function assertLength(name, value, min, max) {
  if (value.length < min || value.length > max) {
    throw new Error(`${name} must be ${min}-${max} characters`);
  }
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
  return { eventCode, photoIds, goodMoment, impressiveScene, nextProgram, messageToFirstTimer };
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
```

- [ ] **Step 4: Create HTTP helpers**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/http.mjs`:

```js
export function json(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    },
    body: JSON.stringify(data)
  };
}

export function methodNotAllowed() {
  return json(405, { error: 'method_not_allowed' });
}

export function readJsonBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error('invalid_json');
  }
}

export function requireMethod(event, allowed) {
  if (!allowed.includes(event.httpMethod)) throw new Error('method_not_allowed');
}
```

- [ ] **Step 5: Create Supabase helper**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/supabase.mjs`:

```js
import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('supabase_admin_env_missing');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function getSupabasePublic() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('supabase_public_env_missing');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
```

- [ ] **Step 6: Create auth helper**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/_lib/auth.mjs`:

```js
import { getSupabaseAdmin } from './supabase.mjs';

export function bearerToken(event) {
  const value = event.headers.authorization || event.headers.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
}

export async function requireViewer(event) {
  const token = bearerToken(event);
  if (!token) throw new Error('auth_required');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('auth_invalid');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,nickname,role')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  return {
    userId: data.user.id,
    email: data.user.email,
    nickname: profile?.nickname || data.user.email?.split('@')[0] || '마술인',
    role: profile?.role || 'member'
  };
}

export async function requireAdmin(event) {
  const viewer = await requireViewer(event);
  if (!['admin', 'kali'].includes(viewer.role)) throw new Error('admin_required');
  return viewer;
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test:js
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3 only**

Run:

```bash
git add netlify/functions/_lib/http.mjs netlify/functions/_lib/supabase.mjs netlify/functions/_lib/auth.mjs netlify/functions/_lib/validators.mjs tests/community/validators.test.mjs
git commit -m "feat(playground): add function helpers and validation"
```

---

### Task 4: Auth UI and Playground Read/List MVP

**Files:**
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/auth.js`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/playground.html`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/playground.js`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/posts.mjs`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/nav.js`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/test_site.py`

- [ ] **Step 1: Add static smoke tests**

Modify `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/test_site.py` to assert:

```python
def test_magic_playground_static_files_exist():
    root = Path(__file__).resolve().parents[1]
    playground = (root / "playground.html").read_text(encoding="utf-8")
    nav = (root / "nav.js").read_text(encoding="utf-8")
    style = (root / "style.css").read_text(encoding="utf-8")
    assert "마술 놀이터" in playground
    assert "playground.js" in playground
    assert "auth.js" in playground
    assert "playground.html" in nav
    assert ".playground-shell" in style
```

- [ ] **Step 2: Run Python test and verify failure**

Run:

```bash
python3 -m pytest tests/test_site.py::test_magic_playground_static_files_exist -q
```

Expected: FAIL because `playground.html` does not exist.

- [ ] **Step 3: Create `auth.js`**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/auth.js`:

```js
(function () {
  var config = window.MAGIC_PLAYGROUND_CONFIG || {};
  var supabaseClient = null;

  function ensureClient() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || !config.supabaseUrl || !config.supabasePublishableKey) return null;
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
    return supabaseClient;
  }

  async function getSession() {
    var client = ensureClient();
    if (!client) return null;
    var result = await client.auth.getSession();
    return result.data.session || null;
  }

  async function login() {
    var client = ensureClient();
    if (!client) throw new Error('Supabase 설정이 필요합니다.');
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
  }

  async function logout() {
    var client = ensureClient();
    if (!client) return;
    await client.auth.signOut();
    window.location.reload();
  }

  async function authHeader() {
    var session = await getSession();
    return session ? { Authorization: 'Bearer ' + session.access_token } : {};
  }

  window.MagicAuth = { getSession: getSession, login: login, logout: logout, authHeader: authHeader };
})();
```

- [ ] **Step 4: Create posts function**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/posts.mjs` with GET support first:

```js
import { json } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { requireViewer } from './_lib/auth.mjs';
import { canReadPostBody, canReadAuthor } from './_lib/access-policy.mjs';

async function optionalViewer(event) {
  try {
    return await requireViewer(event);
  } catch {
    return null;
  }
}

function publicShape(row, viewer) {
  const canReadBody = canReadPostBody({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);
  const canReadName = canReadAuthor({ visibility: row.visibility, authorUserId: row.author_user_id }, viewer);
  return {
    id: row.id,
    postType: row.post_type,
    category: row.category,
    title: row.title,
    body: canReadBody ? row.body : '',
    bodyLocked: !canReadBody,
    authorLabel: canReadName && row.display_mode === 'nickname' ? row.profiles?.nickname || '마술인' : '익명',
    displayMode: row.display_mode,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
  const category = event.queryStringParameters?.category || 'all';
  const viewer = await optionalViewer(event);
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('posts')
    .select('id,post_type,category,title,body,author_user_id,display_mode,visibility,status,created_at,profiles(nickname)')
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(50);
  if (category !== 'all') query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return json(500, { error: 'db_error' });
  return json(200, { posts: data.map((row) => publicShape(row, viewer)) });
}
```

- [ ] **Step 5: Create `playground.html`**

Create a static page with:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>마술 놀이터 | 칼리형</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script>
    window.MAGIC_PLAYGROUND_CONFIG = {
      supabaseUrl: '',
      supabasePublishableKey: ''
    };
  </script>
  <script src="nav.js"></script>
</head>
<body>
  <script>renderNav('playground')</script>
  <main class="playground-shell">
    <header class="playground-header">
      <p class="playground-eyebrow">마술인을 위한 양지 아카이브</p>
      <h1>마술 놀이터</h1>
      <p>질문은 묻히지 않게, 답변은 오래 남게.</p>
      <div class="playground-auth" data-auth-panel></div>
    </header>
    <nav class="playground-tabs" aria-label="마술 놀이터 카테고리">
      <button type="button" data-category="all" class="is-active">전체</button>
      <button type="button" data-category="question">질문</button>
      <button type="button" data-category="event_review">모임 후기</button>
      <button type="button" data-category="review">리뷰/후기</button>
    </nav>
    <section class="playground-list" data-post-list aria-live="polite"></section>
  </main>
  <script src="auth.js"></script>
  <script src="playground.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create `playground.js`**

Create a client that fetches `/.netlify/functions/posts`, renders using `textContent`, and never uses user-content `innerHTML`. Export no globals except `window.MagicPlayground`.

- [ ] **Step 7: Update nav**

Modify `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/nav.js` to include:

```js
{ key: 'playground', label: '마술 놀이터', href: 'playground.html' }
```

- [ ] **Step 8: Add scoped CSS**

Append `.playground-*` rules to `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css`. Use existing dark/gold variables and keep cards at 8px radius or less unless matching local card style.

- [ ] **Step 9: Run checks**

Run:

```bash
npm run test:js
python3 -m pytest tests/test_site.py::test_magic_playground_static_files_exist -q
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit Task 4 only**

Run:

```bash
git add auth.js playground.html playground.js netlify/functions/posts.mjs nav.js style.css tests/test_site.py
git commit -m "feat(playground): add community board shell"
```

---

### Task 5: Post Creation, Q&A, and Answers

**Files:**
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/posts.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/post-detail.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/answers.mjs`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/playground.html`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/playground.js`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css`

- [ ] **Step 1: Add a question form to `playground.html`**

Add fields:

- title
- body
- visibility: `public`, `kali_only`, `expert_only`
- display mode: `nickname`, `anonymous`
- optional YouTube URL

- [ ] **Step 2: Extend `posts.mjs` with POST**

Implementation requirements:

- `requireViewer(event)`
- `validatePostPayload(body)`
- Insert into `posts`
- If `postType === 'question'`, insert into `questions`
- Return created post id
- Reject unauthenticated writes

- [ ] **Step 3: Add private detail function**

Create `post-detail.mjs`:

- GET by `id`
- optional viewer
- return title always if visible
- return body/author/answers/comments only when policy allows
- return 404 for hidden/deleted unless admin/kali

- [ ] **Step 4: Add answers function**

Create `answers.mjs`:

- POST only
- require admin/kali initially
- validate answer body length 1-5000
- validate answer visibility `public` or `author_only`
- call `canPublishAnswer(question, answerVisibility)`
- insert answer and update `questions.answer_status = 'answered'`

- [ ] **Step 5: Update `playground.js`**

Add:

- login-required write state
- post submit
- detail opening
- locked body display for private questions
- answer list rendering

All user content must use `textContent`.

- [ ] **Step 6: Run checks**

Run:

```bash
npm run test:js
npm run build
python3 -m pytest tests -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5 only**

Run:

```bash
git add playground.html playground.js style.css netlify/functions/posts.mjs netlify/functions/post-detail.mjs netlify/functions/answers.mjs
git commit -m "feat(playground): add qna posting and answers"
```

---

### Task 6: Event Reviews from `reviews.html`

**Files:**
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/reviews-community.js`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/event-photos.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/event-reviews.mjs`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/reviews.html`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/test_site.py`

- [ ] **Step 1: Add static smoke test**

Update `tests/test_site.py` to assert:

```python
def test_reviews_event_review_mount_exists():
    root = Path(__file__).resolve().parents[1]
    reviews = (root / "reviews.html").read_text(encoding="utf-8")
    assert 'data-event-review-app' in reviews
    assert 'reviews-community.js' in reviews
```

- [ ] **Step 2: Add mount area to `reviews.html`**

Add a section near the event/review area:

```html
<section class="section section--tight kx-fade">
  <div class="container">
    <div class="event-review-app" data-event-review-app data-event-code="2026-08">
      <h2 class="section-title">모임 후기 남기기</h2>
      <p class="section-lead">좋았던 순간을 사진과 함께 남겨줘. 바로 마술 놀이터에도 올라가.</p>
    </div>
  </div>
</section>
```

Load scripts:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="auth.js"></script>
<script src="reviews-community.js"></script>
```

- [ ] **Step 3: Create `event-photos.mjs`**

GET visible photos by `event_code`. Return `id`, `image_src`, `alt_text`, `sort_order`.

- [ ] **Step 4: Create `event-reviews.mjs`**

POST event review:

- require viewer
- validate event review payload
- create `posts` row with `post_type='event_review'`, `category='event_review'`, `visibility='public'`
- create `event_reviews` row
- create `event_review_photos` rows
- return created post id

- [ ] **Step 5: Create `reviews-community.js`**

Client behavior:

- Load event photos
- Let user select 2-5 photos
- Render guided fields
- Submit review
- Render latest event reviews on `reviews.html`
- Link each review to `playground.html?post=<id>`

- [ ] **Step 6: Add CSS**

Add `.event-review-*` styles scoped to the review app. Use square-ish photo cards, stable aspect ratio, and mobile-safe wrapping.

- [ ] **Step 7: Run checks**

Run:

```bash
npm run test:js
python3 -m pytest tests/test_site.py::test_reviews_event_review_mount_exists -q
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6 only**

Run:

```bash
git add reviews.html reviews-community.js style.css netlify/functions/event-photos.mjs netlify/functions/event-reviews.mjs tests/test_site.py
git commit -m "feat(reviews): add event review submission"
```

---

### Task 7: Comments, Replies, and Admin Inbox

**Files:**
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/admin.html`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/admin.js`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/comments.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/admin-inbox.mjs`
- Create: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/netlify/functions/admin-moderate.mjs`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/playground.js`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/tests/test_site.py`

- [ ] **Step 1: Add comments function**

`comments.mjs`:

- GET comments for a post if viewer can read the post body
- POST comment/reply with `requireViewer`
- Use `validateCommentPayload`
- Replies use `parent_comment_id`

- [ ] **Step 2: Add comments UI**

In `playground.js` detail view:

- show comments
- show reply buttons
- render nested replies one level deep
- require login to write
- use `textContent`

- [ ] **Step 3: Create admin page**

`admin.html`:

- login panel
- inbox filters
- list container
- detail/action panel

`admin.js`:

- require session
- call admin functions with bearer token
- render inbox
- action buttons for hide/restore/delete/answer/mark magazine candidate

- [ ] **Step 4: Create admin functions**

`admin-inbox.mjs`:

- require admin/kali
- return latest posts/comments/answers
- filters: `all`, `questions`, `waiting`, `event_reviews`, `comments`, `private`, `hidden`, `deleted`, `magazine_candidates`

`admin-moderate.mjs`:

- require admin/kali
- actions: `hide`, `restore`, `delete`, `mark_magazine_candidate`, `change_visibility`
- insert `moderation_events`

- [ ] **Step 5: Add static tests**

Update `tests/test_site.py`:

```python
def test_admin_page_static_shell_exists():
    root = Path(__file__).resolve().parents[1]
    admin = (root / "admin.html").read_text(encoding="utf-8")
    assert "관리자" in admin
    assert "admin.js" in admin
    assert "auth.js" in admin
```

- [ ] **Step 6: Run checks**

Run:

```bash
npm run test:js
python3 -m pytest tests -q
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7 only**

Run:

```bash
git add admin.html admin.js playground.js style.css netlify/functions/comments.mjs netlify/functions/admin-inbox.mjs netlify/functions/admin-moderate.mjs tests/test_site.py
git commit -m "feat(playground): add comments and admin inbox"
```

---

### Task 8: End-to-End QA and Launch Hardening

**Files:**
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/README.md` if present, otherwise create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/MAGIC-PLAYGROUND-RUNBOOK.md`
- Modify: `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/MAGIC-PLAYGROUND-PRD.md`

- [ ] **Step 1: Write launch runbook**

Create `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/MAGIC-PLAYGROUND-RUNBOOK.md`:

```md
# 마술 놀이터 운영 런북

## 환경변수

- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- MAGIC_PLAYGROUND_ADMIN_EMAILS

## 출시 전 점검

- `npm test` 통과
- `npm run build` 후 `dist/`에 private docs 없음
- Supabase Google provider redirect URL 설정
- admin/kali profile role 설정
- 비공개 질문 public API 노출 수동 확인

## 사고 대응

비공개 데이터 노출 의심:
1. Netlify functions를 이전 deploy로 rollback한다.
2. Supabase secret key를 rotate한다.
3. `moderation_events`와 Netlify function logs를 확인한다.
4. 노출 가능성이 있는 질문자에게 공지한다.

문제 글:
1. admin inbox에서 hide 처리한다.
2. 필요하면 delete 처리한다.
3. 반복 사용자는 role/계정 제한을 검토한다.
```

- [ ] **Step 2: Run full local checks**

Run:

```bash
npm test
npm run build
find dist -maxdepth 2 -type f | sort
```

Expected:

- JS tests pass
- Python tests pass
- `dist/` contains site pages/scripts/assets
- `dist/` does not contain `MAGIC-PLAYGROUND-PRD.md`, `COMMUNITY-MVP-DESIGN.md`, `supabase/`, `netlify/functions/`, `tests/`, or `.env.example`

- [ ] **Step 3: Manual browser QA**

Start local static server:

```bash
cd dist
python3 -m http.server 8787
```

Open:

```text
http://127.0.0.1:8787/
http://127.0.0.1:8787/playground.html
http://127.0.0.1:8787/reviews.html
http://127.0.0.1:8787/admin.html
```

Verify:

- nav link to 마술 놀이터 exists
- playground page is readable on desktop/mobile
- reviews page still opens old modal cards
- event review form area does not overlap existing review content
- admin page does not show admin data without login

- [ ] **Step 4: Netlify/Supabase staging QA**

After environment variables are configured in Netlify and Supabase migrations are applied:

- Login with Google
- Create public question as nickname
- Create public question as anonymous
- Create kali-only question and verify public list shows title only
- Login as non-author and verify private body is not visible
- Login as kali/admin and answer private question
- Submit event review from `reviews.html`
- Verify it appears on `reviews.html` and `playground.html`
- Add comment and reply on event review
- Hide event review from admin inbox and verify public pages remove it
- Restore event review and verify public pages show it again

- [ ] **Step 5: Update PRD status**

Modify `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/MAGIC-PLAYGROUND-PRD.md`:

```md
> Status: IMPLEMENTATION_READY
```

Add a short line under the status block:

```md
> Implementation plan: `MAGIC-PLAYGROUND-IMPLEMENTATION-PLAN.md`
```

- [ ] **Step 6: Commit Task 8 only**

Run:

```bash
git add MAGIC-PLAYGROUND-RUNBOOK.md MAGIC-PLAYGROUND-PRD.md
git commit -m "docs(playground): add launch runbook"
```

---

## Self-Review

Spec coverage:

- Google login: Task 4
- 통합 게시판: Task 4
- Q&A visibility and answer policy: Tasks 2, 5
- 비공개 질문 title-only list: Tasks 2, 4, 5
- 모임 후기 via `reviews.html`: Task 6
- 사진 풀 2-5장 선택: Tasks 2, 6
- 댓글/답글: Task 7
- 관리자 페이지: Task 7
- 무료 운영 and no direct media upload: Tasks 1, 6, 8
- Safe deployment: Tasks 1, 8

Known execution risks:

- Supabase Auth redirect setup must be done in the Supabase dashboard before real login works.
- `MAGIC_PLAYGROUND_ADMIN_EMAILS` only seeds policy in app code unless a follow-up admin bootstrap script is added.
- If Netlify account free credits are exhausted, functions stop serving until the next cycle or upgrade.
- The plan avoids direct photo upload; if attendee upload becomes required later, it needs a separate storage/security plan.

Recommended execution path:

1. Build Tasks 1-3 first and review.
2. Build Tasks 4-5 for a working Q&A alpha.
3. Build Task 7 admin before publicly launching Task 6 event reviews.
4. Build Task 6 before the 2026년 8월 모임.
5. Run Task 8 before any production push.
