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
