# Community MVP Architecture Design

> Status: DRAFT
> Date: 2026-07-06
> Project: kalimagic static site
> Scope: design only. No implementation has been approved yet.

## Upgrade Brief

kalimagic currently runs as a static HTML/CSS/JS site with no server, API, database, login, or moderation surface. The upgrade adds a community layer for two first-release workflows:

- 후기 댓글: each review card can show comment count, open the existing modal, list comments, and accept a nickname plus comment.
- 영상 첨부형 Q&A: visitors can ask magic practice questions, optionally attach a YouTube link, choose public or kali-only visibility, and later receive answers from kali or approved experts.

This is a C. 업그레이드 because it changes public user flows, stores user-generated content, and creates future auth/role/moderation responsibilities. The first version must not force GitHub login. It must also avoid a throwaway structure that blocks later Google login, 후원 배지, 전문가 권한, and role-based Q&A visibility.

Out of scope for the first implementation:

- 자유게시판
- paid membership automation
- expert self-service onboarding
- direct video upload
- nested comments
- real-time chat
- public display of hidden, deleted, kali-only, or expert-only content

## Current Site Findings

Relevant files:

- `reviews.html`: desktop `.kx-desktop` and mobile `.kx-mobile` markup are separate.
- `reviews.html`: desktop has 11 `data-modal-card` review cards; mobile has 4 hardcoded review cards.
- `modal.js`: finds `[data-modal]`, upgrades `[data-modal-card]` into keyboard-accessible modal triggers, and renders modal text with `textContent`.
- `style.css`: modal and card styles are scoped through `.field-*` classes.
- `nav.js`: static nav only.

There is currently no `netlify.toml`, `package.json`, `netlify/functions/`, `supabase/`, or environment setup in the project. That means the first implementation step later must be an infrastructure skeleton and publish-scope check, not UI code.

Important existing strength: `modal.js` already avoids rendering review body with `innerHTML`. The community extension should preserve that pattern.

## Impact Analysis

Affected user flows:

- Review browsing changes from static-only reading to reading plus commenting.
- Review modal changes from content-only to content plus community panel.
- Q&A introduces a new public form, question list, question detail view, and admin/moderation workflow.
- Admin work changes from editing HTML manually to reviewing community records in an admin surface.

Affected files in a later implementation:

- `reviews.html`: add stable `data-review-id` to each desktop and mobile card.
- `modal.js`: expose modal lifecycle hooks or slots so `community.js` can mount comments without rewriting modal behavior.
- `style.css`: add scoped `.community-*` styles; do not directly restyle shared `.field-*` classes beyond required modal slot support.
- New `community.js`: client renderer and API caller.
- New `qa.html` or `community.html`: Q&A list/detail/form surface.
- New `admin.html`: private moderation surface.
- New `netlify.toml`: define curated publish directory/build behavior before using Netlify deploys.
- New `netlify/functions/*`: public read/write APIs and admin APIs.
- New `supabase/migrations/*`: schema, indexes, RLS, and views.

Compatibility risks:

- Desktop/mobile review duplication can create mismatched `review_id` values if IDs are added manually twice.
- Comment counts must tolerate missing IDs, hidden comments, and stale network results.
- Static build must not expose private source files through a broad Netlify publish path.
- Browser code must never receive elevated Supabase credentials.

## ADR: Community Data Layer

Decision: keep the site static, add `community.js`, route all community writes and admin reads through Netlify Functions, and store data/auth/roles in Supabase Postgres/Auth.

Recommended path:

```text
static HTML/CSS/JS
-> community.js
-> Netlify Functions API
-> Supabase Postgres
-> Supabase Auth / Google OAuth later
```

Why this choice:

- It keeps the existing static site and deployment model.
- It removes GitHub account friction for students.
- It creates a server-side trust boundary for validation, moderation, role checks, hashing, rate limits, and future admin actions.
- It allows Google login later without making Google the source of permissions. Google identifies a person; `profiles`, `roles`, `badges`, and `support_records` decide what they can do.

Rejected path: GitHub-based comments as the main system.

- giscus, utterances, GitHub Issues, and GitHub Discussions all create a GitHub-account participation barrier.
- They do not fit kali-only / expert-only visibility, future badge logic, or custom moderation needs.

Rejected path: browser talks directly to Supabase for all community writes.

- Supabase supports browser access when RLS is correct, but this MVP needs business-rule validation, hidden/kali-only filtering, token hashing, YouTube parsing, honeypot checks, and admin workflow in one consistent place.
- Direct browser writes can be reconsidered later only for low-risk public reads.

## Architecture

### Browser

`community.js` should be the only community client module.

Responsibilities:

- Load review comment counts by `review_id`.
- Mount a comment panel into the existing modal.
- Render comments and Q&A with `textContent`, DOM APIs, or safe attribute setters only.
- Submit public forms to Netlify Functions.
- Parse only lightweight client state: loading, empty, success, failure.
- Convert YouTube URLs into preview cards only after the API returns a validated `video_id`.

Non-responsibilities:

- No Supabase secret or service-role key.
- No admin authorization logic beyond showing/hiding local UI.
- No raw `innerHTML` for user content.
- No storage of hidden, deleted, kali-only, or expert-only records in public JS state.

### Netlify Functions

Functions are the API boundary and policy enforcement point.

Responsibilities:

- Validate method, content type, body shape, length limits, honeypot, and rate limit.
- Normalize nicknames and text.
- Parse YouTube links server-side and store `video_id`, not arbitrary embed HTML.
- Hash optional email, author token, claim token, and IP/rate keys server-side.
- Enforce visibility/status filtering before returning records.
- Check Supabase Auth JWT and role records for admin, kali, and expert actions.
- Use Supabase secret credentials only in server-side function environment variables.

Suggested function groups:

- `GET /api/review-comments/counts?review_ids=...`
- `GET /api/review-comments?review_id=...`
- `POST /api/review-comments`
- `GET /api/questions`
- `POST /api/questions`
- `GET /api/questions/:id`
- `GET /api/admin/moderation`
- `PATCH /api/admin/moderation`
- `POST /api/admin/answers`

### Supabase

Supabase holds data, Auth, and future role/badge state.

Use the newer key model where possible:

- Browser: publishable key only if/when Supabase Auth is used client-side.
- Server functions: Supabase secret key or legacy `service_role` equivalent, stored only in Netlify environment variables.

RLS should still be enabled on public-schema tables even if server functions handle most access. It is defense in depth and prepares for any future direct read policies.

## Data Model Draft

Use UUID primary keys for mutable community records. Use stable text IDs for review cards.

### profiles

Registered users only.

- `user_id uuid primary key references auth.users(id)`
- `display_name text not null`
- `role text not null default 'member'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed roles:

- `member`
- `expert`
- `admin`
- `kali`

Guest authors do not need profile rows.

### review_comments

- `id uuid primary key`
- `review_id text not null`
- `user_id uuid null references auth.users(id)`
- `author_display_name text not null`
- `author_email_hash text null`
- `author_token_hash text null`
- `claim_token_hash text null`
- `body text not null`
- `status text not null default 'visible'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `hidden_at timestamptz null`
- `deleted_at timestamptz null`
- `moderated_by uuid null references auth.users(id)`

Allowed status:

- `visible`
- `hidden`
- `deleted`

Public APIs return only `status = 'visible'`.

### qa_questions

- `id uuid primary key`
- `user_id uuid null references auth.users(id)`
- `author_display_name text not null`
- `author_email_hash text null`
- `author_token_hash text null`
- `claim_token_hash text null`
- `title text not null`
- `body text not null`
- `youtube_video_id text null`
- `visibility text not null default 'public'`
- `status text not null default 'visible'`
- `answer_status text not null default 'waiting'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `hidden_at timestamptz null`
- `deleted_at timestamptz null`
- `moderated_by uuid null references auth.users(id)`

Allowed visibility:

- `public`
- `kali_only`
- `expert_only`

Initial UI exposes only `public` and `kali_only`. `expert_only` exists in the schema but stays hidden until expert roles are active.

Allowed status:

- `visible`
- `hidden`
- `deleted`

Allowed answer status:

- `waiting`
- `answered`
- `closed`

Public APIs return only `visibility = 'public'` and `status = 'visible'`.

### qa_answers

- `id uuid primary key`
- `question_id uuid not null references qa_questions(id)`
- `user_id uuid not null references auth.users(id)`
- `responder_role text not null`
- `body text not null`
- `youtube_video_id text null`
- `status text not null default 'visible'`
- `is_pinned boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `hidden_at timestamptz null`
- `deleted_at timestamptz null`

Allowed responder roles:

- `expert`
- `admin`
- `kali`

Initial implementation can allow only `kali` and `admin`.

### moderation_events

- `id uuid primary key`
- `actor_user_id uuid null references auth.users(id)`
- `target_table text not null`
- `target_id uuid not null`
- `action text not null`
- `reason text null`
- `before_status text null`
- `after_status text null`
- `created_at timestamptz not null default now()`

This is required for admin trust. Hidden/deleted/restored records should leave an audit trail.

### badges

- `id uuid primary key`
- `code text unique not null`
- `label text not null`
- `description text null`
- `created_at timestamptz not null default now()`

Initial codes:

- `user`
- `supporter`
- `expert`
- `kali`

### user_badges

- `user_id uuid references auth.users(id)`
- `badge_id uuid references badges(id)`
- `granted_by uuid null references auth.users(id)`
- `granted_at timestamptz not null default now()`
- primary key `(user_id, badge_id)`

### support_records

- `id uuid primary key`
- `user_id uuid null references auth.users(id)`
- `support_level text not null`
- `source text null`
- `created_at timestamptz not null default now()`

Allowed support levels:

- `3000`
- `10000`
- `50000`

Support level is an 응원 흔적, not an expert role.

## Stable Review IDs

Add `data-review-id` to every desktop and mobile review card.

Recommended IDs:

- `review_trace2_fake_keycard_001`
- `review_young_mistake_001`
- `review_trace2_life_lecture_001`
- `review_chameleon_001`
- `review_target_001`
- `review_trace2_naematchat_001`
- `review_trace2_noidea_001`
- `review_chameleon_002`
- `review_trace1_phone_young_mistake_001`
- `review_eggback_gote_001`
- `review_noidea_002`

Mobile duplicates must use the same ID as their desktop source, not new IDs:

- mobile TRACE 2 -> `review_trace2_life_lecture_001`
- mobile 젊은 날의 과오 -> `review_young_mistake_001`
- mobile 카멜레온 -> `review_chameleon_002`
- mobile 트레이스 2 · 아 모르겠다 -> `review_trace2_noidea_001`

## Security Threat Model

This is a design-time threat model, not a full security audit.

### Component: Browser community UI

- Spoofing: anyone can submit a nickname as a guest. Mitigation: display guest names as unverified; never imply identity proof until Google login.
- Tampering: users can edit request bodies in DevTools. Mitigation: server-side validation is authoritative.
- Repudiation: guest authors can deny writing content. Mitigation: moderation event logs and hashed abuse metadata, not public identity claims.
- Information disclosure: hidden/kali-only/expert-only content could leak if included in API responses. Mitigation: API filters before serialization.
- Denial of service: repeated public form submissions. Mitigation: server rate limit, honeypot, length limits, CAPTCHA/Turnstile if needed.
- Elevation of privilege: UI hiding admin buttons is not security. Mitigation: admin functions verify JWT plus role from DB.

### Component: Netlify Functions API

- Spoofing: forged admin requests. Mitigation: require `Authorization: Bearer <Supabase JWT>` and verify role in `profiles` or role table.
- Tampering: malicious JSON, overlong fields, unexpected visibility/status. Mitigation: schema validation and explicit allowlists.
- Repudiation: admin changes without audit. Mitigation: every hide/delete/restore/answer/edit writes `moderation_events`.
- Information disclosure: returning kali-only/expert-only content to public callers. Mitigation: separate public and admin query paths.
- Denial of service: burst submissions and expensive list queries. Mitigation: per-IP/per-fingerprint limits, pagination, indexed filters.
- Elevation of privilege: compromised function path using secret key for public operations. Mitigation: small functions, least-data queries, no generic table proxy.

### Component: Supabase Postgres/Auth

- Spoofing: logged-in Google identity is not automatically expert/admin. Mitigation: roles live in DB and are granted by kali/admin only.
- Tampering: direct DB writes with leaked secret. Mitigation: never expose secret keys; rotate immediately if leaked.
- Repudiation: DB updates without actor. Mitigation: moderation events and `moderated_by`.
- Information disclosure: RLS misconfiguration. Mitigation: RLS enabled on all public-schema tables; public views/functions return only visible public data.
- Denial of service: public reads over unbounded tables. Mitigation: pagination, indexes, count endpoints, request caps.
- Elevation of privilege: role column edited by non-admin. Mitigation: role writes only through admin function or locked DB policies.

### Component: YouTube embeds

- Spoofing: fake or malformed URLs. Mitigation: allowlist URL forms and store only `video_id`.
- Tampering: arbitrary iframe HTML injection. Mitigation: never store embed HTML; construct iframe URL from validated ID.
- Information disclosure: third-party tracking. Mitigation: lazy thumbnail first, load iframe only on click, prefer `youtube-nocookie.com`.
- Denial of service: many iframes loading at once. Mitigation: thumbnails only until click.

## Validation Rules

Review comment:

- `review_id`: required, must match known static allowlist.
- `author_display_name`: 2-20 visible characters after trim.
- `body`: 1-800 characters.
- honeypot field must be empty.
- no HTML rendering.

Q&A question:

- `title`: 3-80 characters.
- `body`: 10-3000 characters.
- `author_display_name`: 2-20 visible characters.
- `youtube_url`: optional, parsed to `video_id`.
- `visibility`: initially `public` or `kali_only` only.
- `expert_only`: server rejects until expert role launch flag is enabled.

YouTube allowlist:

- `youtube.com/watch?v=VIDEO_ID`
- `youtu.be/VIDEO_ID`
- `youtube.com/shorts/VIDEO_ID`
- `youtube.com/embed/VIDEO_ID`

Store only a canonical `video_id` that matches a strict YouTube ID pattern.

## Public Read Rules

Public APIs must never return:

- `kali_only` questions
- `expert_only` questions
- `hidden` records
- `deleted` records
- email hashes
- author token hashes
- claim token hashes
- IP hashes
- moderation reasons
- internal admin notes

Public list endpoints should return only the fields needed to render public UI.

## Admin MVP

Admin surface should show:

- latest review comments
- latest Q&A
- video-attached Q&A
- answer-waiting Q&A
- hidden records
- deleted records
- flagged/problem records, once reporting exists

Admin actions:

- hide
- restore
- soft delete
- answer
- edit answer
- pin answer
- change visibility

Hard delete should not be the default. Use soft delete first.

## Migration Plan

Phase 0: Design approval.

- Approve this architecture.
- Decide first release shape: comments + Q&A together, or comments first then Q&A.
- Confirm admin login method for MVP.

Phase 1: Infrastructure skeleton.

- Add `package.json` only if Netlify Functions need local dependencies.
- Add `netlify.toml` with curated publish behavior.
- Add `netlify/functions/health` and test local invocation.
- Add `.env.example` with placeholder names only.
- Confirm secrets are not committed.

Phase 2: Database.

- Create Supabase migrations for enums/tables/indexes/RLS.
- Seed badge codes.
- Add public-safe views or query helpers if useful.

Phase 3: Review comments.

- Add stable `data-review-id` attributes.
- Add `community.js` count loading and modal comment slot.
- Add review comment read/write functions.
- Add moderation actions for comments.

Phase 4: Q&A MVP.

- Add Q&A page/form/list/detail.
- Add YouTube parser and lazy embed UI.
- Add question read/write functions.
- Add kali/admin answer flow.

Phase 5: Auth and roles.

- Add Supabase Auth Google OAuth.
- Connect authenticated `user_id` to profile.
- Keep role/badge/support state in DB, separate from Google identity.

Phase 6: Expert and supporter expansion.

- Enable expert-only visibility.
- Add expert answer permission.
- Add badge display.
- Connect support records to supporter badge.

## Rollback Plan

Safe rollback must preserve static site function:

- Keep all community UI behind a single feature flag or config value in `community.js`.
- If API fails, review cards and modals still work as static content.
- Do not remove existing review text from HTML.
- Database migrations should add tables only in early phases; avoid destructive migrations.
- To disable launch: remove or disable `community.js` script include and Q&A nav entry, leave data intact.
- To revert a bad deploy: Netlify rollback to previous deploy, no DB rollback needed unless schema migration was destructive.

## Testing Plan

Before launch:

- Unit test YouTube URL parsing with allowed and rejected URLs.
- Unit test API validation for too-short, too-long, honeypot, invalid visibility, invalid review ID.
- Integration test public APIs do not return hidden/deleted/kali-only/expert-only content.
- Manual browser test desktop and mobile review modal: open, comment count, list, submit, close, focus return.
- Manual browser test Q&A: public question appears publicly, kali-only question does not.
- Admin test: hide, restore, soft delete, answer, pin.
- Security smoke test: submit `<script>alert(1)</script>` and confirm literal text display or rejection, never execution.

## Open Questions

1. Should MVP launch comments and Q&A together, or ship comments first and Q&A immediately after?
2. Should guest authors receive a claim token/edit link in MVP, or should guest posts be immutable except by admin?
3. Is the first admin login only kali, or kali plus one trusted operator?
4. Should kali-only questions send a Discord/email notification, or only appear in admin?
5. Should public Q&A show author names, masked names, or allow anonymous display?

## Sources Checked

- Supabase API key model: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase CAPTCHA support: https://supabase.com/docs/guides/auth/auth-captcha
- Netlify Functions overview: https://docs.netlify.com/build/functions/overview/
- Netlify environment variables: https://docs.netlify.com/build/configure-builds/environment-variables/
