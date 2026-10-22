import { json } from './http.mjs';

// CDN caching for anonymous, non-user-specific public reads.
// Docs: https://docs.netlify.com/build/caching/caching-overview/
export const CDN_CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=300, durable';
export const BROWSER_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
export const PUBLIC_TAG = 'pg-public';
export const LIST_TAG = 'pg-list';
export const EVENTS_TAG = 'pg-events';
export const postTag = (id) => (id ? `post:${id}` : null);

const CREDENTIAL_HEADERS = ['authorization', 'proxy-authorization'];

// Any credential at all (even empty or malformed) disqualifies the request.
export function hasCredential(event) {
  const headers = event?.headers || {};
  return Object.keys(headers).some((name) => CREDENTIAL_HEADERS.includes(name.toLowerCase()));
}

// Returns the CDN headers, or null when the response must not be shared.
export function cacheHeaders(event, { tags = [], varyQuery = [] } = {}) {
  if (event?.httpMethod !== 'GET' || hasCredential(event)) return null;
  const vary = [];
  if (varyQuery.length) vary.push(`query=${varyQuery.join('|')}`);
  // Defense in depth: a request carrying Authorization never maps to the anonymous cache key.
  vary.push('header=Authorization');
  return {
    'cache-control': BROWSER_CACHE_CONTROL,
    'netlify-cdn-cache-control': CDN_CACHE_CONTROL,
    'netlify-vary': vary.join(','),
    'netlify-cache-tag': [PUBLIC_TAG, ...tags.filter(Boolean)].join(',')
  };
}

// 200 JSON for an anonymous GET. Credentialed requests keep json()'s default no-store.
export function cacheableJson(event, data, options) {
  const headers = cacheHeaders(event, options);
  return json(200, data, headers || {});
}

export async function purgeTags(tags, context, env = process.env) {
  const list = [...new Set(tags.filter(Boolean))];
  const token = env.NETLIFY_PURGE_API_TOKEN || context?.clientContext?.custom?.purge_api_token;
  const siteId = env.SITE_ID;
  if (!list.length || !token || !siteId) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch('https://api.netlify.com/api/v1/purge', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ site_id: siteId, cache_tags: list }),
      signal: controller.signal
    });
    if (!response.ok) console.error('cache_purge_failed', response.status);
    return response.ok;
  } catch (error) {
    console.error('cache_purge_failed', error?.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function bodyField(event, name) {
  try {
    const value = JSON.parse(event.body || '{}')?.[name];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

// Wraps a handler: after a successful write, purge the tags tagsFor() names. Never changes the response.
export function purgeOnWrite(inner, tagsFor) {
  return async function handler(event, context) {
    const response = await inner(event, context);
    if (event.httpMethod !== 'GET' && response.statusCode >= 200 && response.statusCode < 300) {
      try {
        await purgeTags(tagsFor(event, response), context);
      } catch (error) {
        console.error('cache_purge_failed', error?.message);
      }
    }
    return response;
  };
}

export function responseId(response) {
  try {
    return JSON.parse(response.body)?.id || null;
  } catch {
    return null;
  }
}
