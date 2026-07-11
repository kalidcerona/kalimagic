(function () {
  var PENDING_INVITE_STORAGE_KEY = 'kalimagic_pending_invite_v1';
  var INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{12}$/;

  function pendingInviteCode() {
    try {
      var code = window.localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
      return INVITE_CODE_PATTERN.test(code || '') ? code : null;
    } catch (error) {
      return null;
    }
  }

  function saveInviteFromUrl() {
    try {
      var code = new URLSearchParams(window.location.search).get('ref');
      if (INVITE_CODE_PATTERN.test(code || '')) {
        window.localStorage.setItem(PENDING_INVITE_STORAGE_KEY, code);
      }
    } catch (error) {
      // Invite attribution is optional and must not interrupt the page.
    }
  }

  function clearPendingInvite() {
    try {
      window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    } catch (error) {
      // Storage may be unavailable in a restricted browser context.
    }
  }

  async function redeemPendingInvite() {
    try {
      var code = pendingInviteCode();
      if (!code || !window.MagicAuth || typeof window.MagicAuth.getSession !== 'function') return;
      if (!window.PgUtil || typeof window.PgUtil.fetchJson !== 'function') return;

      var session = await window.MagicAuth.getSession();
      if (!session) return;

      await window.PgUtil.fetchJson('/.netlify/functions/invite-redeem', {
        method: 'POST',
        body: JSON.stringify({ code: code })
      });
      clearPendingInvite();
    } catch (error) {
      if (error && [400, 403, 409].includes(error.status)) clearPendingInvite();
    }
  }

  saveInviteFromUrl();
  redeemPendingInvite();
})();
