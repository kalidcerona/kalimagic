import { readFile } from 'node:fs/promises';
import { buildPostMeta, injectPostMeta } from './_lib/post-meta.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const SITE_ORIGIN = 'https://kalimagic.netlify.app';
const shellPromise = readFile('post.html', 'utf8');

export async function loadPublicPost(supabase, id) {
  const { data, error } = await supabase
    .from('posts')
    .select('title,body')
    .eq('id', id)
    .eq('status', 'visible')
    .eq('visibility', 'public')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'content-type': 'text/plain; charset=utf-8', allow: 'GET' },
      body: 'Method Not Allowed'
    };
  }

  const id = event.queryStringParameters?.id;
  const validId = validateUuid(id);
  let post = null;
  if (validId) {
    try {
      post = await loadPublicPost(getSupabaseAdmin(), id);
    } catch {
      post = null;
    }
  }

  const canonicalUrl = validId
    ? `${SITE_ORIGIN}/p/${encodeURIComponent(id)}`
    : `${SITE_ORIGIN}/playground.html`;
  const meta = buildPostMeta(post, canonicalUrl);
  const shell = await shellPromise;

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: injectPostMeta(shell, meta.html)
  };
}
