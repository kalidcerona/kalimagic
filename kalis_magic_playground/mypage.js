(function () {
  var state = { session: null, profile: null, badgeData: null, questBadgeData: null, tab: 'posts' };
  var profileEl = document.querySelector('[data-mypage-profile]');
  var badgeEl = document.querySelector('[data-mypage-badges]');
  var questBadgeEl = document.querySelector('[data-mypage-quest-badges]');
  var tabsEl = document.querySelector('[data-mypage-tabs]');
  var listEl = document.querySelector('[data-mypage-list]');
  var tabLabels = {
    posts: '내가 쓴 글',
    received: '받은 답변',
    given: '해준 답변'
  };
  var emptyMessages = {
    posts: '아직 글이 없어요',
    received: '아직 받은 답변이 없어요',
    given: '아직 해준 답변이 없어요'
  };
  var questTrackLabels = {
    questions: '질문',
    answers: '답변',
    answer_helpful_votes: '도움됐어요',
    free_posts: '자유 기록',
    event_reviews: '모임 기록',
    tool_reviews: '도구 기록',
    total_records: '전체 기록'
  };
  var questTrackOrder = [
    'questions',
    'answers',
    'answer_helpful_votes',
    'free_posts',
    'event_reviews',
    'tool_reviews',
    'total_records'
  ];

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;
  var formatDate = window.PgUtil.formatDate;

  function categoryLabel(value) {
    var labels = {
      question: '질문',
      event_review: '모임 후기',
      review: '리뷰',
      review_comment: '리뷰',
      free: '자유게시판',
      routine: '마술 보관소',
      magazine: '매거진'
    };
    return labels[value] || value || '기록';
  }

  function postUrl(id) {
    return 'post.html?id=' + encodeURIComponent(id);
  }

  function goToPost(id) {
    if (!id) return;
    window.location.href = postUrl(id);
  }

  function showLogin() {
    clear(profileEl);
    clear(badgeEl);
    if (questBadgeEl) clear(questBadgeEl);
    clear(tabsEl);
    clear(listEl);
    var box = el('article', 'playground-empty');
    box.appendChild(el('h2', '', '로그인이 필요해요'));
    box.appendChild(el('p', '', '내 활동을 보려면 Google 로그인이 필요합니다.'));
    var button = el('button', 'playground-button', 'Google로 로그인');
    button.type = 'button';
    button.addEventListener('click', function () {
      window.MagicAuth.login();
    });
    box.appendChild(button);
    listEl.appendChild(box);
  }

  function profileForm() {
    var form = el('form', 'playground-comment-form');
    var input = document.createElement('input');
    input.name = 'nickname';
    input.type = 'text';
    input.minLength = 2;
    input.maxLength = 24;
    input.required = true;
    input.value = state.profile && state.profile.nickname ? state.profile.nickname : '';
    input.placeholder = '2-24자';
    var actions = el('div', 'admin-card__actions');
    var save = el('button', 'playground-button', '저장');
    save.type = 'submit';
    var cancel = el('button', 'playground-button playground-button--ghost', '취소');
    cancel.type = 'button';
    var status = el('p', 'playground-form-status');
    actions.appendChild(save);
    actions.appendChild(cancel);
    form.appendChild(input);
    form.appendChild(actions);
    form.appendChild(status);

    cancel.addEventListener('click', renderProfile);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      status.classList.remove('is-error');
      status.textContent = '저장하는 중입니다.';
      save.disabled = true;
      try {
        var data = await fetchJson('/.netlify/functions/profile', {
          method: 'POST',
          body: JSON.stringify({ nickname: input.value })
        });
        state.profile = Object.assign({}, state.profile || {}, data);
        renderProfile();
      } catch (error) {
        status.textContent = error.code === 'nickname_taken' ? '이미 사용 중인 닉네임이에요' : '닉네임을 저장하지 못했습니다';
        status.classList.add('is-error');
        save.disabled = false;
        input.focus();
      }
    });
    return form;
  }

  function renderProfile() {
    clear(profileEl);
    var title = el('h2', 'playground-post__title', state.profile && state.profile.nickname ? state.profile.nickname : '닉네임 없음');
    var meta = el('p', 'playground-post__body', '역할 ' + ((state.profile && state.profile.role) || 'member'));
    var actions = el('div', 'admin-card__actions');
    var change = el('button', 'playground-button playground-button--ghost', '닉네임 변경');
    change.type = 'button';
    change.addEventListener('click', function () {
      clear(profileEl);
      profileEl.appendChild(el('h2', 'playground-post__title', '닉네임 변경'));
      profileEl.appendChild(profileForm());
    });
    actions.appendChild(change);
    profileEl.appendChild(title);
    profileEl.appendChild(meta);
    profileEl.appendChild(actions);
  }

  function badgeImage(code, label) {
    var img = document.createElement('img');
    img.className = 'mypage-badge-tile__image';
    img.src = 'assets/playground/badges/' + encodeURIComponent(code) + '.webp';
    img.alt = label || code;
    img.loading = 'lazy';
    return img;
  }

  function badgeMetaText(badge) {
    var wrap = el('span', 'mypage-badge-tile__text');
    wrap.appendChild(el('strong', '', badge.label || badge.code));
    if (badge.description) wrap.appendChild(el('span', '', badge.description));
    return wrap;
  }

  async function savePreferredBadge(code, button) {
    if (!badgeEl) return;
    var status = badgeEl.querySelector('[data-badge-status]');
    if (status) status.textContent = '배지를 저장하는 중입니다.';
    if (button) button.disabled = true;
    try {
      state.badgeData = await fetchJson('/.netlify/functions/member-badges', {
        method: 'PATCH',
        body: JSON.stringify({ preferredBadgeCode: code })
      });
      renderBadges();
    } catch (error) {
      if (status) {
        status.textContent = error.message || '배지를 저장하지 못했습니다.';
        status.classList.add('is-error');
      }
      if (button) button.disabled = false;
    }
  }

  function badgeTile(badge) {
    var canSelect = Boolean(badge.selectable && badge.owned);
    var isComingSoon = !badge.selectable;
    var isActive = state.badgeData && state.badgeData.preferredBadgeCode === badge.code;
    var tile = document.createElement(canSelect ? 'button' : 'div');
    tile.className = 'mypage-badge-tile' +
      (isActive ? ' is-active' : '') +
      (isComingSoon ? ' is-coming-soon' : '') +
      (!isComingSoon && !badge.owned ? ' is-unowned' : '');
    tile.appendChild(badgeImage(badge.code, badge.label));
    tile.appendChild(badgeMetaText(badge));

    if (canSelect) {
      tile.type = 'button';
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-checked', isActive ? 'true' : 'false');
      tile.addEventListener('click', function () {
        savePreferredBadge(badge.code, tile);
      });
    } else {
      tile.setAttribute('aria-disabled', 'true');
      if (isComingSoon) {
        tile.appendChild(el('span', 'mypage-badge-tile__overlay', '추후 공개'));
      } else {
        tile.appendChild(el('span', 'mypage-badge-tile__mark', '미보유'));
      }
    }

    return tile;
  }

  function renderBadges() {
    if (!badgeEl) return;
    clear(badgeEl);
    var title = el('h2', 'mypage-section-title', '배지');
    badgeEl.appendChild(title);

    if (!state.badgeData) {
      badgeEl.appendChild(el('p', 'playground-loading', '배지를 불러오는 중입니다.'));
      return;
    }

    var grid = el('div', 'mypage-badge-grid');
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', '기본 배지 선택');
    (state.badgeData.catalog || []).forEach(function (badge) {
      grid.appendChild(badgeTile(badge));
    });
    badgeEl.appendChild(grid);
    var status = el('p', 'playground-form-status');
    status.setAttribute('data-badge-status', '');
    badgeEl.appendChild(status);
  }

  async function loadBadges() {
    if (!badgeEl) return;
    state.badgeData = null;
    renderBadges();
    try {
      state.badgeData = await fetchJson('/.netlify/functions/member-badges');
      renderBadges();
    } catch (error) {
      clear(badgeEl);
      badgeEl.appendChild(el('h2', 'mypage-section-title', '배지'));
      badgeEl.appendChild(el('p', 'playground-form-status is-error', '배지를 불러오지 못했습니다.'));
    }
  }

  function questBadgeMedia(badge) {
    var media = el('div', 'quest-badge-tile__media');
    var fallback = el('span', 'quest-badge-tile__placeholder', badge.symbol || '?');
    var img = document.createElement('img');
    img.className = 'quest-badge-tile__image';
    img.src = 'assets/playground/quest-badges/' + encodeURIComponent(badge.code) + '.webp';
    img.alt = badge.name || badge.code;
    img.loading = 'lazy';
    img.onerror = function () {
      img.hidden = true;
      img.style.display = 'none';
      media.classList.add('is-placeholder');
    };
    media.appendChild(img);
    media.appendChild(fallback);
    return media;
  }

  function questBadgeProgress(badge) {
    if (badge.owned) return el('span', 'quest-badge-tile__earned', '획득');
    var progress = badge.progress || {};
    var wrap = el('div', 'quest-badge-progress');
    var bar = el('span', 'quest-badge-progress__bar');
    var fill = el('span', 'quest-badge-progress__fill');
    fill.style.width = Math.max(0, Math.min(100, Number(progress.percent) || 0)) + '%';
    bar.appendChild(fill);
    wrap.appendChild(bar);
    wrap.appendChild(el('span', 'quest-badge-progress__text', (progress.current || 0) + '/' + (progress.required || badge.threshold || 0)));
    return wrap;
  }

  function questPublicTile(badge) {
    var tile = el('article', 'quest-badge-tile quest-badge-tile--' + (badge.rarity || 'common') + (badge.owned ? ' is-owned' : ' is-unowned'));
    tile.appendChild(questBadgeMedia(badge));
    var body = el('div', 'quest-badge-tile__body');
    body.appendChild(el('strong', 'quest-badge-tile__name', badge.name || badge.code));
    body.appendChild(el('span', 'quest-badge-tile__meta', (badge.material || '') + ' · ' + (badge.symbol || '')));
    body.appendChild(questBadgeProgress(badge));
    tile.appendChild(body);
    return tile;
  }

  function questSecretTile(badge) {
    var tile = el('article', 'quest-badge-tile quest-badge-tile--secret' + (badge.owned ? ' is-owned' : ' is-unowned'));
    var media = el('div', 'quest-badge-tile__media quest-badge-tile__media--secret');
    media.appendChild(el('span', 'quest-badge-tile__unknown', '???'));
    tile.appendChild(media);
    var body = el('div', 'quest-badge-tile__body');
    body.appendChild(el('strong', 'quest-badge-tile__name', '???'));
    body.appendChild(el('span', 'quest-badge-tile__hint', badge.secretHint || '아직 조건이 숨겨져 있어요'));
    if (badge.owned) body.appendChild(el('span', 'quest-badge-tile__earned', '획득'));
    tile.appendChild(body);
    return tile;
  }

  function renderQuestBadges() {
    if (!questBadgeEl) return;
    clear(questBadgeEl);
    questBadgeEl.appendChild(el('h2', 'mypage-section-title', '퀘스트 배지'));

    if (!state.questBadgeData) {
      questBadgeEl.appendChild(el('p', 'playground-loading', '퀘스트 배지를 불러오는 중입니다.'));
      return;
    }

    var catalog = state.questBadgeData.catalog || [];
    var publicBadges = catalog.filter(function (badge) { return !badge.isSecret; });
    var secretBadges = catalog.filter(function (badge) { return badge.isSecret; });

    questTrackOrder.forEach(function (track) {
      var badges = publicBadges.filter(function (badge) { return badge.track === track; });
      if (!badges.length) return;
      var group = el('section', 'quest-badge-group');
      group.appendChild(el('h3', 'quest-badge-group__title', questTrackLabels[track] || track));
      var grid = el('div', 'quest-badge-grid');
      badges.forEach(function (badge) {
        grid.appendChild(questPublicTile(badge));
      });
      group.appendChild(grid);
      questBadgeEl.appendChild(group);
    });

    if (secretBadges.length) {
      var secretGroup = el('section', 'quest-badge-group quest-badge-group--secret');
      secretGroup.appendChild(el('h3', 'quest-badge-group__title', '비밀 배지'));
      var secretGrid = el('div', 'quest-badge-grid');
      secretBadges.forEach(function (badge) {
        secretGrid.appendChild(questSecretTile(badge));
      });
      secretGroup.appendChild(secretGrid);
      questBadgeEl.appendChild(secretGroup);
    }
  }

  async function loadQuestBadges() {
    if (!questBadgeEl) return;
    state.questBadgeData = null;
    renderQuestBadges();
    try {
      state.questBadgeData = await fetchJson('/.netlify/functions/quest-badges');
      renderQuestBadges();
    } catch (error) {
      clear(questBadgeEl);
      questBadgeEl.appendChild(el('h2', 'mypage-section-title', '퀘스트 배지'));
      questBadgeEl.appendChild(el('p', 'playground-form-status is-error', '퀘스트 배지를 불러오지 못했습니다.'));
    }
  }

  function renderTabs() {
    tabsEl.innerHTML = [
      '<button type="button" data-mypage-tab="posts" class="is-active">내가 쓴 글</button>',
      '<button type="button" data-mypage-tab="received">받은 답변</button>',
      '<button type="button" data-mypage-tab="given">해준 답변</button>'
    ].join('');
    Array.prototype.slice.call(tabsEl.querySelectorAll('[data-mypage-tab]')).forEach(function (button) {
      button.addEventListener('click', function () {
        var tab = button.getAttribute('data-mypage-tab') || 'posts';
        state.tab = tab;
        Array.prototype.slice.call(tabsEl.querySelectorAll('[data-mypage-tab]')).forEach(function (node) {
          node.classList.toggle('is-active', node === button);
        });
        loadActivity();
      });
    });
  }

  function clickableCard(card, id) {
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.addEventListener('click', function () {
      goToPost(id);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goToPost(id);
      }
    });
  }

  function postCard(item) {
    var card = el('article', 'admin-card');
    clickableCard(card, item.id);
    card.appendChild(el('h2', '', item.title || '제목 없음'));
    card.appendChild(el('p', '', categoryLabel(item.category) + ' · ' + formatDate(item.createdAt) + ' · 댓글 ' + (item.commentCount || 0)));
    return card;
  }

  function activityCard(item) {
    var card = el('article', 'admin-card');
    clickableCard(card, item.postId);
    card.appendChild(el('h2', '', item.postTitle || '제목 없음'));
    card.appendChild(el('p', '', item.body || '본문이 없습니다'));
    card.appendChild(el('span', '', formatDate(item.createdAt)));
    return card;
  }

  function renderActivity(items) {
    clear(listEl);
    if (!items.length) {
      var empty = el('article', 'playground-empty');
      empty.appendChild(el('h2', '', emptyMessages[state.tab]));
      listEl.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      listEl.appendChild(state.tab === 'posts' ? postCard(item) : activityCard(item));
    });
  }

  async function loadActivity() {
    clear(listEl);
    listEl.appendChild(el('p', 'playground-loading', tabLabels[state.tab] + '을 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/my-activity?tab=' + encodeURIComponent(state.tab));
      renderActivity(data.items || []);
    } catch (error) {
      clear(listEl);
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '활동을 불러오지 못했어요'));
      box.appendChild(el('p', '', error.message || '잠시 후 다시 시도해주세요.'));
      listEl.appendChild(box);
    }
  }

  async function init() {
    if (!profileEl || !tabsEl || !listEl || !window.MagicAuth) return;
    state.session = await window.MagicAuth.getSession();
    if (!state.session) {
      showLogin();
      return;
    }
    profileEl.innerHTML = '<p class="playground-loading">프로필을 불러오는 중입니다.</p>';
    try {
      state.profile = await fetchJson('/.netlify/functions/profile');
      renderProfile();
    } catch (error) {
      clear(profileEl);
      profileEl.appendChild(el('p', 'playground-form-status is-error', '프로필을 불러오지 못했습니다.'));
    }
    await loadBadges();
    await loadQuestBadges();
    renderTabs();
    await loadActivity();
  }

  window.addEventListener('profile:nickname-updated', function (event) {
    state.profile = Object.assign({}, state.profile || {}, event.detail || {});
    if (profileEl) renderProfile();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
