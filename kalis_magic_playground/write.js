(function () {
  const CATEGORY_TARGETS = {
    question: { id: 'question', category: 'question' },
    review_tool: { id: 'review_tool', category: 'review', reviewKind: 'tool' },
    review_meeting: { id: 'review_meeting', category: 'review', reviewKind: 'meeting' },
    magazine: { id: 'magazine', category: 'magazine' },
    free: { id: 'free', category: 'free' }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const api = window.KalisPlaygroundApi;
    const composeRoot = document.querySelector('[data-write-compose]');
    const loginBox = document.querySelector('[data-write-login]');
    const params = new URLSearchParams(location.search);
    const target = CATEGORY_TARGETS[params.get('category')] || { id: 'all' };

    const session = await window.MagicAuth.getSession();
    if (!session) {
      if (loginBox) loginBox.hidden = false;
      document.querySelector('[data-login-button]')?.addEventListener('click', () => {
        window.MagicAuth.login();
      });
    }

    const compose = window.KalisPlaygroundCompose.initPlaygroundCompose({
      api,
      root: composeRoot,
      getActiveTarget: () => target,
      onCreated: (result) => {
        if (result && result.id) {
          location.href = 'post.html?id=' + encodeURIComponent(result.id);
        } else {
          location.href = 'playground.html';
        }
      }
    });
    if (compose && compose.open) compose.open();
  });
})();
