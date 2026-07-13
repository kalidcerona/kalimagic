import { readFile } from 'node:fs/promises';
import { buildPostMeta, injectPostMeta } from './_lib/post-meta.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { validateUuid } from './_lib/validators.mjs';

const SITE_ORIGIN = 'https://kalimagic.netlify.app';

// post.html(SSR 셸)은 함수 번들에서 빌드 base(git 루트) 기준 상대경로로 포함돼
// 위치가 환경마다 다르다. 여러 후보를 순서대로 시도하고 성공분을 1회 캐시한다.
let shellCache;
async function loadShell() {
  if (shellCache !== undefined) return shellCache;
  // esbuild 번들에서 import.meta.url이 불안정하므로 cwd(/var/task) 기준 문자열 경로만 사용.
  const candidates = [
    'kalis_magic_playground/post.html',
    'post.html'
  ];
  for (const src of candidates) {
    try {
      shellCache = await readFile(src, 'utf8');
      return shellCache;
    } catch {
      // 다음 후보 시도
    }
  }
  shellCache = null;
  return shellCache;
}

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
  const shell = await loadShell();
  if (shell == null) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'post shell unavailable'
    };
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: injectPostMeta(shell, meta.html)
  };
}
