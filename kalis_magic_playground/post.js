(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const api = window.KalisPlaygroundApi;
    const root = document.querySelector('[data-post-detail]');
    const detail = window.KalisPlaygroundDetail.initPlaygroundDetail({ api, root });
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      root.innerHTML = '<div class="pg-empty pg-error"><p>글을 찾을 수 없습니다. 목록에서 다시 선택해주세요.</p></div>';
      return;
    }
    detail.loadPost(id);
    document.addEventListener('playground:post-deleted', () => {
      location.href = 'playground.html';
    });
  });
})();
