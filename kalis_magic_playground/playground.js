(function () {
  const CATEGORY_GUIDES = {
    all: {
      title: '전체 보기',
      body: '질문, 모임 후기, 도구 리뷰가 함께 모이는 공간. 기록을 남기려면 먼저 게시판을 골라주세요.'
    },
    question: {
      title: '질문함',
      body: '마술을 배우다 막힌 순간을 남기는 곳. 먼저 지나간 사람이 답을 알고 있을 수 있어요.'
    },
    review: {
      title: '도구 리뷰',
      body: '직접 써본 경험이 다음 사람의 길잡이가 되는 곳.'
    },
    event_review: {
      title: '모임 후기',
      body: '모임의 분위기와 기억이 남는 곳. 처음 오는 사람에게 가장 큰 안내서가 됩니다.'
    },
    free: {
      title: '자유 기록',
      body: '오늘의 연습과 문득 든 생각이 쌓이는 곳.'
    },
    magazine: {
      title: '매거진',
      body: '오래 남길 기록을 골라 모아두는 곳.'
    }
  };

  function guideKeyFromTarget(target) {
    if (!target || target.id === 'all') return 'all';
    if (target.id === 'review_tool' || target.reviewKind === 'tool') return 'review';
    if (target.id === 'review_meeting' || target.reviewKind === 'meeting') return 'event_review';
    return CATEGORY_GUIDES[target.id] ? target.id : 'all';
  }

  function renderCategoryGuide(target) {
    const guideBox = document.querySelector('[data-category-guide]');
    if (!guideBox) return;
    const guide = CATEGORY_GUIDES[guideKeyFromTarget(target)] || CATEGORY_GUIDES.all;
    guideBox.innerHTML = `<strong>${guide.title}</strong><span>${guide.body}</span>`;
  }

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

    const compose = window.KalisPlaygroundCompose.initPlaygroundCompose({
      api,
      root: composeRoot,
      getActiveTarget: list.getActiveTarget,
      onCreated: list.reload
    });

    renderCategoryGuide({ id: 'all' });

    document.addEventListener('playground:tab-change', (event) => {
      const target = event.detail || {};
      renderCategoryGuide({ id: target.id, reviewKind: target.reviewKind });
    });

    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-open-compose]');
      if (!opener || composeRoot.contains(opener)) return;
      compose.open();
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
