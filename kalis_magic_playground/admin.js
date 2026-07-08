(function () {
  var state = { filter: 'all', session: null, flash: '', memberQuery: '' };
  var listEl = document.querySelector('[data-admin-list]');
  var authPanel = document.querySelector('[data-auth-panel]');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('[data-admin-filter]'));

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  async function fetchJson(url, options) {
    var headers = window.MagicAuth ? await window.MagicAuth.authHeader() : {};
    if (options && options.body) headers['content-type'] = 'application/json; charset=utf-8';
    var response = await fetch(url, Object.assign({}, options, { headers: headers }));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.message || data.error || '요청을 처리하지 못했습니다.');
    return data;
  }

  async function renderAuth() {
    clear(authPanel);
    state.session = window.MagicAuth ? await window.MagicAuth.getSession() : null;
    if (!state.session) {
      authPanel.appendChild(el('p', 'playground-auth__text', '관리자 확인은 Google 로그인이 필요합니다.'));
      var login = el('button', 'playground-button', 'Google로 로그인');
      login.type = 'button';
      login.addEventListener('click', function () {
        window.MagicAuth.login();
      });
      authPanel.appendChild(login);
      return;
    }
    authPanel.appendChild(el('p', 'playground-auth__text', state.session.user.email || '로그인됨'));
  }

  function statusLabel(item) {
    return item.category + ' · ' + item.visibility + ' · ' + item.status;
  }

  function createYouTubeLiteEmbed(videoId, title) {
    var id = String(videoId || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    var wrapper = el('div', 'yt-lite');
    var button = el('button', 'yt-lite__button');
    button.type = 'button';
    button.setAttribute('aria-label', (title || '첨부된 유튜브 영상') + ' 재생');
    button.style.backgroundImage = 'url("https://img.youtube.com/vi/' + id + '/hqdefault.jpg")';
    var play = el('span', 'yt-lite__play', '▶');
    play.setAttribute('aria-hidden', 'true');
    button.appendChild(play);
    button.appendChild(el('span', 'yt-lite__label', title || '첨부된 유튜브 영상'));
    button.addEventListener('click', function () {
      var iframe = el('iframe', 'yt-lite__iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1';
      iframe.title = title || '첨부된 유튜브 영상';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      wrapper.replaceChildren(iframe);
      wrapper.classList.add('yt-lite--loaded');
    }, { once: true });
    wrapper.appendChild(button);
    return wrapper;
  }

  function actionButton(label, action, postId) {
    var button = el('button', 'playground-button playground-button--ghost', label);
    button.type = 'button';
    button.addEventListener('click', async function () {
      await fetchJson('/.netlify/functions/admin-moderate', {
        method: 'POST',
        body: JSON.stringify({ action: action, postId: postId })
      });
      await loadCurrentView();
    });
    return button;
  }

  function answerButton(item, slot) {
    var button = el('button', 'playground-button playground-button--ghost', '답변 작성');
    button.type = 'button';
    button.addEventListener('click', function () {
      clear(slot);
      slot.appendChild(answerForm(item));
    });
    return button;
  }

  function option(value, text, selected) {
    var node = document.createElement('option');
    node.value = value;
    node.textContent = text;
    if (selected) node.selected = true;
    return node;
  }

  function answerForm(item) {
    var form = el('form', 'playground-comment-form');
    var body = document.createElement('textarea');
    body.name = 'body';
    body.rows = 4;
    body.required = true;
    body.placeholder = '답변 내용을 적어주세요.';
    var visibility = document.createElement('select');
    visibility.name = 'visibility';
    visibility.appendChild(option('public', '전체 공개', item.visibility === 'public'));
    visibility.appendChild(option('author_only', '질문자에게만', item.visibility !== 'public'));
    var youtubeUrl = document.createElement('input');
    youtubeUrl.name = 'youtubeUrl';
    youtubeUrl.type = 'url';
    youtubeUrl.placeholder = '유튜브 링크 선택';
    var submit = el('button', 'playground-button', '답변 등록');
    submit.type = 'submit';
    var cancel = el('button', 'playground-button playground-button--ghost', '취소');
    cancel.type = 'button';
    var status = el('p', 'playground-form-status');
    var controls = el('div', 'admin-card__actions');
    controls.appendChild(submit);
    controls.appendChild(cancel);
    form.appendChild(body);
    form.appendChild(visibility);
    form.appendChild(youtubeUrl);
    form.appendChild(controls);
    form.appendChild(status);
    cancel.addEventListener('click', function () {
      form.remove();
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var formData = new FormData(form);
      status.classList.remove('is-error');
      status.textContent = '답변을 등록하는 중입니다.';
      try {
        await fetchJson('/.netlify/functions/answers', {
          method: 'POST',
          body: JSON.stringify({
            questionPostId: item.id,
            body: formData.get('body'),
            visibility: formData.get('visibility'),
            youtubeUrl: formData.get('youtubeUrl')
          })
        });
        state.flash = '답변이 등록됐습니다';
        await loadInbox();
      } catch (error) {
        status.textContent = error.message || '답변을 등록하지 못했습니다.';
        status.classList.add('is-error');
      }
    });
    return form;
  }

  function renderItems(items) {
    clear(listEl);
    if (state.flash) {
      listEl.appendChild(el('p', 'playground-form-status', state.flash));
      state.flash = '';
    }
    if (!items.length) {
      var empty = el('article', 'playground-empty');
      empty.appendChild(el('h2', '', '확인할 항목이 없습니다'));
      empty.appendChild(el('p', '', '새 글이 올라오면 이곳에 표시됩니다.'));
      listEl.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var card = el('article', 'admin-card');
      card.appendChild(el('h2', '', item.title));
      card.appendChild(el('p', '', statusLabel(item)));
      card.appendChild(el('span', '', item.authorLabel || '마술인'));
      var video = createYouTubeLiteEmbed(item.youtubeVideoId, '질문에 첨부된 영상');
      if (video) card.appendChild(video);
      var actions = el('div', 'admin-card__actions');
      var answerSlot = el('div', '');
      if (item.postType === 'question') actions.appendChild(answerButton(item, answerSlot));
      actions.appendChild(actionButton('숨김', 'hide', item.id));
      actions.appendChild(actionButton('복구', 'restore', item.id));
      actions.appendChild(actionButton('삭제', 'delete', item.id));
      actions.appendChild(actionButton('매거진 후보', 'mark_magazine_candidate', item.id));
      card.appendChild(actions);
      card.appendChild(answerSlot);
      listEl.appendChild(card);
    });
  }

  async function loadInbox() {
    clear(listEl);
    listEl.appendChild(el('p', 'playground-loading', '관리자 항목을 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/admin-inbox?filter=' + encodeURIComponent(state.filter));
      renderItems(data.items || []);
    } catch (error) {
      clear(listEl);
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '관리자 권한이 필요합니다'));
      box.appendChild(el('p', '', error.message || '항목을 불러오지 못했습니다.'));
      listEl.appendChild(box);
    }
  }

  function memberSearchCard() {
    var card = el('article', 'admin-card');
    var form = el('form', 'playground-comment-form');
    var input = document.createElement('input');
    input.type = 'search';
    input.name = 'q';
    input.placeholder = '닉네임 검색';
    input.value = state.memberQuery;
    var actions = el('div', 'admin-card__actions');
    var submit = el('button', 'playground-button', '검색');
    submit.type = 'submit';
    actions.appendChild(submit);
    form.appendChild(input);
    form.appendChild(actions);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      state.memberQuery = input.value;
      loadMembers();
    });
    card.appendChild(el('h2', '', '회원 관리'));
    card.appendChild(el('p', '', '빈 검색은 최근 가입 30명을 보여줍니다.'));
    card.appendChild(form);
    return card;
  }

  function memberRoleButton(member, card) {
    var targetRole = member.role === 'expert' ? 'member' : 'expert';
    var label = member.role === 'expert' ? '전문가 해제' : '전문가 부여';
    var button = el('button', 'playground-button playground-button--ghost', label);
    button.type = 'button';
    button.addEventListener('click', async function () {
      var status = card.querySelector('[data-member-status]');
      status.textContent = '처리 중입니다.';
      status.classList.remove('is-error');
      button.disabled = true;
      try {
        var data = await fetchJson('/.netlify/functions/admin-members', {
          method: 'POST',
          body: JSON.stringify(memberRolePayload(member, targetRole))
        });
        member.role = data.role || targetRole;
        card.replaceWith(memberRow(member));
      } catch (error) {
        status.textContent = error.message || '역할을 변경하지 못했습니다.';
        status.classList.add('is-error');
        button.disabled = false;
      }
    });
    return button;
  }

  function memberRolePayload(member, targetRole) {
    if (targetRole === 'expert') return { userId: member.userId, role: 'expert' };
    return { userId: member.userId, role: 'member' };
  }

  function memberRow(member) {
    var card = el('article', 'admin-card');
    var protectedRolePattern = /^(admin|kali)$/;
    card.appendChild(el('h2', '', member.nickname || '닉네임 없음'));
    card.appendChild(el('p', '', 'role ' + (member.role || 'member')));
    card.appendChild(el('span', '', member.createdAt ? new Date(member.createdAt).toLocaleDateString('ko-KR') : '가입일 없음'));
    var actions = el('div', 'admin-card__actions');
    if (!protectedRolePattern.test(member.role || '')) {
      actions.appendChild(memberRoleButton(member, card));
    }
    card.appendChild(actions);
    var status = el('p', 'playground-form-status');
    status.setAttribute('data-member-status', '');
    card.appendChild(status);
    return card;
  }

  function renderMembers(members) {
    clear(listEl);
    listEl.appendChild(memberSearchCard());
    if (!members.length) {
      var empty = el('article', 'playground-empty');
      empty.appendChild(el('h2', '', '회원이 없습니다'));
      empty.appendChild(el('p', '', '검색어를 바꿔 다시 시도해주세요.'));
      listEl.appendChild(empty);
      return;
    }
    members.forEach(function (member) {
      listEl.appendChild(memberRow(member));
    });
  }

  async function loadMembers() {
    clear(listEl);
    listEl.appendChild(memberSearchCard());
    listEl.appendChild(el('p', 'playground-loading', '회원 목록을 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/admin-members?q=' + encodeURIComponent(state.memberQuery));
      renderMembers(data.members || []);
    } catch (error) {
      clear(listEl);
      listEl.appendChild(memberSearchCard());
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '회원 목록을 불러오지 못했습니다'));
      box.appendChild(el('p', '', error.message || '잠시 후 다시 시도해주세요.'));
      listEl.appendChild(box);
    }
  }

  function loadCurrentView() {
    if (state.filter === 'members') return loadMembers();
    return loadInbox();
  }

  function bindFilters() {
    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        state.filter = button.dataset.adminFilter || 'all';
        filterButtons.forEach(function (tab) {
          tab.classList.toggle('is-active', tab === button);
        });
        loadCurrentView();
      });
    });
  }

  async function init() {
    bindFilters();
    await renderAuth();
    await loadInbox();
  }

  init();
})();
