(function () {
  const PAGE_SIZE = 20;

  const PLAYGROUND_TABS = [
    { id: 'all', label: '전체', category: 'all', reviewKind: null },
    { id: 'question', label: '질문함', category: 'question', reviewKind: null },
    { id: 'review_tool', label: '도구 리뷰', category: 'review', reviewKind: 'tool' },
    { id: 'review_meeting', label: '모임 후기', category: 'review', reviewKind: 'meeting' },
    { id: 'magazine', label: '매거진', category: 'magazine', reviewKind: null },
    { id: 'free', label: '자유 기록🔒', category: 'free', reviewKind: null, locked: true }
  ];

  const EMPTY_COPY = {
    all: '아직 첫 기록이 올라오지 않았습니다. 질문과 후기가 쌓이면 이 놀이터의 지도가 됩니다.',
    question: '아직 질문이 없습니다. 처음 묻는 질문도 다음 사람에게는 같은 고민을 해결하는 첫 기록이 됩니다.',
    review_tool: '아직 리뷰가 없습니다. 써본 도구와 모임 기억이 이곳에 쌓이면 누군가의 길잡이가 됩니다.',
    review_meeting: '아직 리뷰가 없습니다. 써본 도구와 모임 기억이 이곳에 쌓이면 누군가의 길잡이가 됩니다.',
    magazine: '아직 매거진에 건져 올린 글이 없습니다. 오래 남길 기록을 기다리고 있습니다.',
    free: '자유 기록은 준비 중입니다. 질문함과 리뷰가 자리 잡은 뒤 열립니다.'
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function prefixClass(prefix) {
    if (prefix === '[질문]') return 'question';
    if (prefix === '[도구]') return 'tool';
    if (prefix === '[모임]') return 'meeting';
    if (prefix === '[매거진]') return 'magazine';
    return 'default';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (date.getFullYear() === now.getFullYear()) return `${month}.${day}`;
    return `${date.getFullYear()}.${month}.${day}`;
  }

  function formatCount(post, key) {
    if (post.canReadBody === false || post[key] === null || post[key] === undefined) return '-';
    return String(post[key]);
  }

  function rowHtml(post) {
    const comment = post.commentCount > 0 ? `<span class="pg-comment-count">[${post.commentCount}]</span>` : '';
    const pin = post.isNotice ? '<span class="pg-pin" aria-label="공지">📌</span>' : '';
    const titleText = escapeHtml(post.title);
    const title = post.bodyLocked ? `${titleText} <span class="pg-lock">비공개</span>` : titleText;
    const prefix = post.prefix || '[질문]';
    const preview = post.bodyPreview ? `<p class="pg-row-preview">${escapeHtml(post.bodyPreview)}</p>` : '';

    return `
      <tr class="${post.isNotice ? 'pg-notice-row' : ''}">
        <td class="pg-prefix-cell"><span class="pg-prefix pg-prefix--${prefixClass(prefix)}">${escapeHtml(prefix)}</span></td>
        <td class="pg-title-cell">
          <a class="pg-title-button" href="post.html?id=${encodeURIComponent(post.id)}" data-post-id="${escapeHtml(post.id)}">${pin}${title}${comment}</a>
          ${preview}
        </td>
        <td class="pg-author-cell">${escapeHtml(post.authorLabel || '익명')}</td>
        <td class="pg-date-cell">${formatDate(post.createdAt)}</td>
        <td class="pg-count-cell">${formatCount(post, 'viewCount')}</td>
        <td class="pg-count-cell">${formatCount(post, 'likeCount')}</td>
      </tr>
    `;
  }

  function emptyHtml(tabId) {
    return `
      <div class="pg-empty">
        <svg class="pg-empty-icon" viewBox="0 0 24 24" fill="none" stroke="var(--point-gold)" aria-hidden="true">
          <path d="M5 6.5h14M7 10h10M8 13.5h8M6.5 3.5h11l2 3v13H4.5v-13l2-3Z"></path>
        </svg>
        <p>${EMPTY_COPY[tabId] || EMPTY_COPY.all}</p>
      </div>
    `;
  }

  function lockedHtml() {
    return `
      <div class="pg-empty pg-empty--locked">
        <svg class="pg-empty-icon" viewBox="0 0 24 24" fill="none" stroke="var(--point-gold)" aria-hidden="true">
          <path d="M7 10V7.5a5 5 0 0 1 10 0V10"></path>
          <path d="M6 10h12v10H6V10Z"></path>
          <path d="M12 14v2.5"></path>
        </svg>
        <strong>준비 중</strong>
        <p>${EMPTY_COPY.free}</p>
      </div>
    `;
  }

  function errorHtml() {
    return `
      <div class="pg-empty pg-error">
        <svg class="pg-empty-icon" viewBox="0 0 24 24" fill="none" stroke="var(--point-gold)" aria-hidden="true">
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
          <path d="M10.3 3.9h3.4l8.1 14.2-1.7 2.9H3.9l-1.7-2.9 8.1-14.2Z"></path>
        </svg>
        <p>기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      </div>
    `;
  }

  function tableHtml(posts, hasMore) {
    const rows = posts.map(rowHtml).join('');
    return `
      <div class="pg-table-wrap">
        <table class="pg-table pg-table--cards">
          <thead>
            <tr>
              <th>말머리</th>
              <th>제목</th>
              <th>글쓴이</th>
              <th>날짜</th>
              <th>조회</th>
              <th>추천</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${hasMore ? '<button type="button" class="pg-more" data-load-more>더보기</button>' : ''}
    `;
  }

  function initPlaygroundList({ api, root, tabsRoot }) {
    const state = {
      tabId: 'all',
      posts: [],
      offset: 0,
      hasMore: false,
      loading: false,
      error: false
    };

    const tabContainer = tabsRoot || document.querySelector('.playground-tabs');
    if (tabContainer) {
      tabContainer.className = 'pg-tabs';
      tabContainer.innerHTML = PLAYGROUND_TABS.map((tab) => `
        <button type="button" class="pg-tab ${tab.id === state.tabId ? 'is-active' : ''}" data-tab-id="${tab.id}">${tab.label}</button>
      `).join('');
    }

    function activeTab() {
      return PLAYGROUND_TABS.find((tab) => tab.id === state.tabId) || PLAYGROUND_TABS[0];
    }

    function getActiveTarget() {
      return activeTab();
    }

    function queryForState() {
      const tab = activeTab();
      return { category: tab.category, reviewKind: tab.reviewKind };
    }

    function render() {
      const tab = activeTab();
      if (tab.locked) {
        root.innerHTML = lockedHtml();
        return;
      }

      if (state.loading && state.posts.length === 0) {
        root.innerHTML = '<p class="pg-loading">목록을 불러오는 중입니다.</p>';
        return;
      }

      if (state.error) {
        root.innerHTML = errorHtml();
        return;
      }

      if (state.posts.length === 0) {
        root.innerHTML = emptyHtml(tab.id);
        return;
      }

      root.innerHTML = tableHtml(state.posts, state.hasMore);
    }

    async function load({ append = false } = {}) {
      const tab = activeTab();
      if (tab.locked) {
        state.posts = [];
        state.offset = 0;
        state.hasMore = false;
        state.error = false;
        render();
        return;
      }

      state.loading = true;
      state.error = false;
      render();
      try {
        const query = queryForState();
        const nextOffset = append ? state.offset + PAGE_SIZE : 0;
        const result = await api.listPosts({
          category: query.category,
          reviewKind: query.reviewKind,
          limit: PAGE_SIZE,
          offset: nextOffset
        });

        state.posts = append ? state.posts.concat(result.posts) : result.posts;
        state.offset = result.offset;
        state.hasMore = result.hasMore;
      } catch {
        state.error = true;
      } finally {
        state.loading = false;
        render();
      }
    }

    function reload() {
      return load({ append: false });
    }

    if (tabContainer) {
      tabContainer.addEventListener('click', (event) => {
        const button = event.target.closest('[data-tab-id]');
        if (!button) return;
        state.tabId = button.dataset.tabId;
        for (const tabButton of tabContainer.querySelectorAll('[data-tab-id]')) {
          tabButton.classList.toggle('is-active', tabButton.dataset.tabId === state.tabId);
        }
        document.dispatchEvent(new CustomEvent('playground:tab-change', { detail: getActiveTarget() }));
        load({ append: false });
      });
    }

    root.addEventListener('click', (event) => {
      const moreButton = event.target.closest('[data-load-more]');
      if (moreButton) {
        load({ append: true });
        return;
      }
    });

    load({ append: false });
    return { reload, getActiveTarget };
  }

  window.KalisPlaygroundList = {
    initPlaygroundList,
    PLAYGROUND_TABS
  };
})();
