(function () {
  const CATEGORY_TARGETS = {
    question: { id: 'question', category: 'question' },
    review_tool: { id: 'review_tool', category: 'review', reviewKind: 'tool' },
    review_meeting: { id: 'review_meeting', category: 'review', reviewKind: 'meeting' },
    magazine: { id: 'magazine', category: 'magazine' },
    free: { id: 'free', category: 'free' },
    routine: { id: 'routine', category: 'routine' }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const api = window.KalisPlaygroundApi;
    const composeRoot = document.querySelector('[data-write-compose]');
    const loginBox = document.querySelector('[data-write-login]');
    const params = new URLSearchParams(location.search);
    const target = CATEGORY_TARGETS[params.get('category')] || CATEGORY_TARGETS.free;

    const session = await window.MagicAuth.getSession();
    if (!session) {
      // 비로그인: 폼을 아예 열지 않는다 — 로그인 후 redirectTo로 이 페이지에 복귀하면 폼이 열림
      if (loginBox) loginBox.hidden = false;
      if (composeRoot) composeRoot.hidden = true;
      document.querySelector('[data-login-button]')?.addEventListener('click', () => {
        window.MagicAuth.login();
      });
      return;
    }

    const compose = window.KalisPlaygroundCompose.initPlaygroundCompose({
      api,
      root: composeRoot,
      getActiveTarget: () => target,
      onCreated: (result) => {
        if (result && result.id) {
          location.href = '/p/' + encodeURIComponent(result.id);
        } else {
          location.href = 'playground.html';
        }
      }
    });
    if (compose && compose.open) compose.open();
  });
})();
