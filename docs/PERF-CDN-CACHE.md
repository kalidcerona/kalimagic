# CDN cache for anonymous public reads

## What is cached
Anonymous GET 200 responses of these functions get these headers (helper: `kalis_magic_playground/netlify/functions/_lib/cache.mjs`):

| Endpoint | Netlify-Cache-Tag (besides `pg-public`) | Netlify-Vary query keys |
|---|---|---|
| `posts` (list) | `pg-list` | category, reviewKind, limit, offset |
| `comments` (GET) | `post:<id>` | postId |
| `event-reviews` (GET) | `pg-events` | eventCode |
| `event-photos` | `pg-events` | eventCode |
| `post-og` (`/p/:id` HTML shell) | `post:<id>` | id |

```
Netlify-CDN-Cache-Control: public, max-age=30, stale-while-revalidate=300, durable
Cache-Control: public, max-age=0, must-revalidate      (browser always revalidates)
Netlify-Vary: query=<keys above>,header=Authorization
Netlify-Cache-Tag: pg-public,<tags above>
```
Sources: https://docs.netlify.com/build/caching/caching-overview/ (headers, SWR, durable, Netlify-Vary, tags, purge). Unknown query params (for example `?t=`) are not part of the cache key.

Not cached: everything else, including `health` (liveness smoke check only), `member-badges`, `profile`, `quest-badges`, `my-activity`, all admin endpoints, all writes.

## Why it is safe
- The browser sends credentials only as `Authorization: Bearer` (`auth.js`, `playground-api.js`, `pg-util.js`); no cookie auth is used by these endpoints. Logged-out clients send no Authorization header.
- `cacheHeaders()` returns nothing when the method is not GET or when any `Authorization`/`Proxy-Authorization` header exists (even empty or invalid). Those responses keep `Cache-Control: no-store`.
- Only `json(200, ...)` success paths use the helper; 4xx/5xx errors keep `no-store`.
- `Netlify-Vary: header=Authorization` additionally keeps a credentialed request off the anonymous cache key (defense in depth; Netlify docs do not describe Authorization handling explicitly, so verify below).
- An anonymous response is identical for every anonymous visitor: viewer-only fields (`viewerLiked`, `authorId`, `viewerHelpful`) are empty/false and non-public bodies are locked.
- Logged-in users bypass the cache, so they see no speedup.

## Purge
Writes call the Netlify purge API (`POST https://api.netlify.com/api/v1/purge`, `site_id` from `SITE_ID`, token from `NETLIFY_PURGE_API_TOKEN` or the Lambda `context.clientContext.custom.purge_api_token`) via `purgeOnWrite()`. No `@netlify/functions` dependency was added. Purge is best-effort (3 s timeout, errors logged, never changes the write response) and is skipped when no token is present (tests, local).

| Write | Purged tags |
|---|---|
| post create/delete, admin moderate | `pg-list`, `post:<id>` |
| comment create, post like toggle | `pg-list`, `post:<id>` |
| answer create | `post:<id>` |
| admin magazine publish | `pg-list` |
| event review create | `pg-events`, `pg-list` |
| role / badge / nickname change (admin-members, admin-badges, admin-quest-badges, member-badges PATCH, profile POST) | `pg-public` (everything) |

Bounded staleness when a purge is missed or for indirect changes (quest-badge awards, answer-helpful votes, `event-photos` rows edited in the DB): up to 30 s fresh + 300 s stale-while-revalidate. New deploys invalidate the cache automatically.
`post-detail` is deliberately not cached: it increments `view_count` only when the function runs, so caching it would stop counting anonymous views (default chosen 2026-10-23; the owner can opt in later).

## Verify after deploy
```
U='https://kalimagic.netlify.app/.netlify/functions/posts?category=all&limit=20&offset=0'
for i in 1 2 3; do curl -s -D - -o /dev/null "$U" | grep -i -E '^(cache-status|age|netlify-|cache-control|http)'; echo; done
# expect: first "Netlify Edge"; fwd=miss, then ; hit and a growing age
curl -s -D - -o /dev/null -H 'Authorization: Bearer x' "$U" | grep -i -E '^(cache-status|cache-control|netlify-cdn)'
# expect: cache-control no-store, no netlify-cdn-cache-control, never a hit
curl -s -D - -o /dev/null "$U&t=$RANDOM" | grep -i cache-status   # expect hit (t is ignored)
```
Also confirm that a logged-in browser session still shows its own like state after an anonymous request warmed the cache, and that a new post appears within seconds after posting (purge).

## Roll back
`git revert` the commit on `perf-cdn-cache` and deploy. To stop caching without removing code, make `cacheHeaders()` return `null`. Flush what is already cached: Netlify UI cache purge, or `curl -X POST -H "Authorization: Bearer <PAT>" -H 'Content-Type: application/json' -d '{"site_id":"<id>","cache_tags":["pg-public"]}' https://api.netlify.com/api/v1/purge`. A new deploy also invalidates everything.
