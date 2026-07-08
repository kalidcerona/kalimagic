(function () {
  var state = { session: null, profile: null, tab: 'posts' };
  var profileEl = document.querySelector('[data-mypage-profile]');
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
