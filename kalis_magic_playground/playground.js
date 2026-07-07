(function () {
  async function renderAuthSlot() {
    const slot = document.querySelector('[data-auth-slot]');
    if (!slot || !window.MagicAuth) return;
    const session = await window.MagicAuth.getSession();
    if (!session) {
      slot.innerHTML = '<button type="button" class="phm-auth-button" data-login-button>구글 로그인</button>';
      slot.querySelector('[data-login-button]').addEventListener('click', () => window.MagicAuth.login());
      return;
    }
    const name = session.user?.user_metadata?.name || session.user?.email || '회원';
    slot.innerHTML = '<span class="phm-auth-name"></span> <button type="button" class="phm-auth-button" data-logout-button>로그아웃</button>';
    slot.querySelector('.phm-auth-name').textContent = name;
    slot.querySelector('[data-logout-button]').addEventListener('click', () => window.MagicAuth.logout());
    try {
      const headers = await window.MagicAuth.authHeader();
      const res = await fetch('/.netlify/functions/admin-inbox?filter=all', { headers });
      if (res.ok) {
        slot.insertAdjacentHTML('beforeend', ' <a class="phm-admin-link" href="admin.html">관리자</a>');
      }
    } catch (e) { /* 관리자 아님 또는 네트워크: 링크 미노출 */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const api = window.KalisPlaygroundApi;
    const listRoot = document.querySelector('[data-post-list]');
    const tabsRoot = document.querySelector('.playground-tabs');

    let list = null;
    if (listRoot && window.KalisPlaygroundList) {
      list = window.KalisPlaygroundList.initPlaygroundList({ api, root: listRoot, tabsRoot });
    }

    const writeLink = document.querySelector('[data-write-link]');
    document.addEventListener('playground:tab-change', (event) => {
      const id = (event.detail || {}).id || 'all';
      const suffix = id === 'all' ? '' : '?category=' + encodeURIComponent(id);
      if (writeLink) writeLink.href = 'write.html' + suffix;
      const mobile = document.querySelector('[data-mobile-write]');
      if (mobile) mobile.href = 'write.html' + suffix;
    });

    renderAuthSlot();
  });
})();
