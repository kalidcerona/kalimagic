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
    if (window.MagicAuth && window.MagicAuth.authHeader) {
      const headers = await window.MagicAuth.authHeader();
      if (headers && headers.Authorization) return headers;
    }
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

  function markAnswerHelpful(answerId) {
    return fetchJson('/.netlify/functions/answer-helpful', {
      method: 'POST',
      body: JSON.stringify({ answerId })
    });
  }

  function unmarkAnswerHelpful(answerId) {
    return fetchJson('/.netlify/functions/answer-helpful', {
      method: 'DELETE',
      body: JSON.stringify({ answerId })
    });
  }

  function deletePost(postId) {
    return fetchJson(POSTS_ENDPOINT, {
      method: 'DELETE',
      body: JSON.stringify({ postId })
    });
  }

  function getMemberBadges(userId) {
    const suffix = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return fetchJson(`/.netlify/functions/member-badges${suffix}`);
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
    markAnswerHelpful,
    unmarkAnswerHelpful,
    deletePost,
    getMemberBadges,
    createPost
  };
})();
