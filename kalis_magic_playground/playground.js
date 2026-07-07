(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const api = window.KalisPlaygroundApi;
    const listRoot = document.querySelector('[data-post-list]');
    const detailRoot = document.querySelector('[data-post-detail]');
    const composeRoot = document.querySelector('.playground-compose');
    const tabsRoot = document.querySelector('.playground-tabs');

    const list = window.KalisPlaygroundList.initPlaygroundList({
      api,
      root: listRoot,
      tabsRoot
    });

    window.KalisPlaygroundDetail.initPlaygroundDetail({
      api,
      root: detailRoot
    });

    window.KalisPlaygroundCompose.initPlaygroundCompose({
      api,
      root: composeRoot,
      getActiveTarget: list.getActiveTarget,
      onCreated: list.reload
    });

    const mobileWrite = document.querySelector('[data-mobile-write]');
    if (mobileWrite) {
      mobileWrite.addEventListener('click', () => {
        document.querySelector('[data-open-compose]')?.click();
      });
    }

    document.addEventListener('playground:post-deleted', () => {
      list.reload();
    });
  });
})();
