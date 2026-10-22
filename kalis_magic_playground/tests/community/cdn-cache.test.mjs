import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cacheHeaders,
  cacheableJson,
  hasCredential,
  purgeOnWrite,
  purgeTags
} from '../../netlify/functions/_lib/cache.mjs';
import { handler as postsHandler, shapePostListRow } from '../../netlify/functions/posts.mjs';
import { handler as eventPhotosHandler } from '../../netlify/functions/event-photos.mjs';
import { handler as commentsHandler } from '../../netlify/functions/comments.mjs';

const anon = (extra = {}) => ({ httpMethod: 'GET', headers: {}, queryStringParameters: {}, ...extra });

function installFakeFetch(t) {
  const original = globalThis.fetch;
  const envBefore = { ...process.env };
  const purges = [];
  process.env.SUPABASE_URL = 'http://supabase.test';
  process.env.SUPABASE_SECRET_KEY = 'secret';
  process.env.SITE_ID = 'site-1';
  process.env.NETLIFY_PURGE_API_TOKEN = 'purge-token';
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.startsWith('https://api.netlify.com/api/v1/purge')) {
      purges.push({ body: JSON.parse(init.body), authorization: init.headers.authorization });
      return new Response('{}', { status: 200 });
    }
    if (href.includes('/auth/v1/')) {
      return new Response(JSON.stringify({ message: 'invalid' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = original;
    process.env = envBefore;
  });
  return purges;
}

test('anonymous GET gets CDN headers with tags and a query plus Authorization cache key', () => {
  const headers = cacheHeaders(anon(), { tags: ['pg-list'], varyQuery: ['category', 'offset'] });
  assert.equal(headers['netlify-cdn-cache-control'], 'public, max-age=30, stale-while-revalidate=300, durable');
  assert.equal(headers['cache-control'], 'public, max-age=0, must-revalidate');
  assert.equal(headers['netlify-vary'], 'query=category|offset,header=Authorization');
  assert.equal(headers['netlify-cache-tag'], 'pg-public,pg-list');
});

test('any credential disables shared caching, in any header casing', () => {
  for (const name of ['authorization', 'Authorization', 'AUTHORIZATION', 'proxy-authorization']) {
    const event = anon({ headers: { [name]: 'Bearer abc' } });
    assert.equal(hasCredential(event), true);
    assert.equal(cacheHeaders(event, { tags: ['x'] }), null);
    const response = cacheableJson(event, { ok: true });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['netlify-cdn-cache-control'], undefined);
  }
  // Even an empty or malformed credential counts.
  assert.equal(cacheHeaders(anon({ headers: { authorization: '' } })), null);
});

test('non-GET requests are never cacheable', () => {
  for (const httpMethod of ['POST', 'DELETE', 'PATCH', 'PUT']) {
    assert.equal(cacheHeaders(anon({ httpMethod })), null);
  }
});

test('posts list: anonymous 200 is cached, credentialed 200 and errors are not', async (t) => {
  installFakeFetch(t);
  const ok = await postsHandler(anon({ queryStringParameters: { category: 'all' } }));
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.headers['netlify-cdn-cache-control']);
  assert.match(ok.headers['netlify-cache-tag'], /pg-list/);

  const withAuth = await postsHandler(anon({
    headers: { authorization: 'Bearer not-a-real-token' },
    queryStringParameters: { category: 'all' }
  }));
  assert.equal(withAuth.statusCode, 200);
  assert.equal(withAuth.headers['netlify-cdn-cache-control'], undefined);
  assert.equal(withAuth.headers['cache-control'], 'no-store');

  const bad = await postsHandler(anon({ queryStringParameters: { category: 'nope' } }));
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.headers['netlify-cdn-cache-control'], undefined);
  assert.equal(bad.headers['cache-control'], 'no-store');

  const wrongMethod = await postsHandler(anon({ httpMethod: 'PUT' }));
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers['netlify-cdn-cache-control'], undefined);
});

test('event-photos: anonymous cached, credentialed not, db error not', async (t) => {
  installFakeFetch(t);
  const ok = await eventPhotosHandler(anon());
  assert.equal(ok.statusCode, 200);
  assert.match(ok.headers['netlify-cache-tag'], /pg-events/);
  const authed = await eventPhotosHandler(anon({ headers: { Authorization: 'Bearer x' } }));
  assert.equal(authed.headers['netlify-cdn-cache-control'], undefined);

  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } });
  const failed = await eventPhotosHandler(anon());
  assert.equal(failed.statusCode, 500);
  assert.equal(failed.headers['netlify-cdn-cache-control'], undefined);
  assert.equal(failed.headers['cache-control'], 'no-store');
});

test('comments: forbidden and missing-id errors are never cached', async (t) => {
  installFakeFetch(t);
  const missing = await commentsHandler(anon());
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.headers['netlify-cdn-cache-control'], undefined);
  const forbidden = await commentsHandler(anon({ queryStringParameters: { postId: '11111111-1111-4111-8111-111111111111' } }));
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.headers['netlify-cdn-cache-control'], undefined);
});

test('purgeTags posts de-duplicated tags with the purge token and never throws', async (t) => {
  const purges = installFakeFetch(t);
  assert.equal(await purgeTags(['pg-list', 'pg-list', null, 'post:1'], {}), true);
  assert.deepEqual(purges[0].body, { site_id: 'site-1', cache_tags: ['pg-list', 'post:1'] });
  assert.equal(purges[0].authorization, 'Bearer purge-token');

  globalThis.fetch = async () => { throw new Error('network down'); };
  assert.equal(await purgeTags(['pg-list'], {}), false);

  const noToken = await purgeTags(['pg-list'], {}, {});
  assert.equal(noToken, false);
});

test('purgeTags uses the Lambda clientContext token when no env token exists', async (t) => {
  const purges = installFakeFetch(t);
  delete process.env.NETLIFY_PURGE_API_TOKEN;
  await purgeTags(['a'], { clientContext: { custom: { purge_api_token: 'ctx-token' } } });
  assert.equal(purges[0].authorization, 'Bearer ctx-token');
});

test('writes purge: successful writes purge, failed writes and reads do not', async (t) => {
  const purges = installFakeFetch(t);
  const wrapped = purgeOnWrite(async (event) => ({ statusCode: event.status, headers: {}, body: '{"id":"p1"}' }), () => ['pg-list', 'post:p1']);
  await wrapped({ httpMethod: 'POST', status: 201 }, {});
  assert.equal(purges.length, 1);
  assert.deepEqual(purges[0].body.cache_tags, ['pg-list', 'post:p1']);
  await wrapped({ httpMethod: 'POST', status: 403 }, {});
  await wrapped({ httpMethod: 'GET', status: 200 }, {});
  assert.equal(purges.length, 1);
});

test('real write handlers do not purge when the write is rejected', async (t) => {
  const purges = installFakeFetch(t);
  const created = await postsHandler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(created.statusCode, 401);
  const commented = await commentsHandler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(commented.statusCode, 401);
  assert.equal(purges.length, 0);
});

test('anonymous list shape carries no viewer-specific fields or locked bodies', () => {
  const row = {
    id: 'p1', post_type: 'question', category: 'question', title: 't', body: 'secret body',
    youtube_video_id: 'abc', author_user_id: 'author-1', display_mode: 'nickname',
    visibility: 'expert_only', status: 'visible', created_at: '2026-01-01', view_count: 3,
    profiles: { nickname: 'nick', role: 'member' }
  };
  const locked = shapePostListRow(row, null, { viewerLikedPostIds: new Set(['p1']) });
  assert.equal(locked.viewerLiked, false);
  assert.equal(locked.bodyPreview, null);
  assert.equal(locked.authorId, null);
  assert.equal(locked.canReadBody, false);
  // listPosts only loads viewer likes when a viewer exists, so anonymous state has none.
  const open = shapePostListRow({ ...row, visibility: 'public' }, null, {});
  assert.equal(open.viewerLiked, false);
  assert.equal(open.authorId, null);
});
