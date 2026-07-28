(function () {
  var state = {
    filter: 'all',
    session: null,
    flash: '',
    memberQuery: '',
    memberToolAccessByUserId: null
  };
  var listEl = document.querySelector('[data-admin-list]');
  var authPanel = document.querySelector('[data-auth-panel]');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('[data-admin-filter]'));

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;

  function roleBadgeHtml(role) {
    return window.KalisBadges && typeof window.KalisBadges.badgeHtml === 'function'
      ? window.KalisBadges.badgeHtml(role)
      : '';
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

  function magazinePublishButton(item, slot) {
    var button = el('button', 'playground-button', '발행하기');
    button.type = 'button';
    button.addEventListener('click', async function () {
      clear(slot);
      var status = el('p', 'playground-form-status', '원본 글을 불러오는 중입니다.');
      slot.appendChild(status);
      button.disabled = true;
      try {
        var detail = await fetchJson('/.netlify/functions/post-detail?id=' + encodeURIComponent(item.id));
        clear(slot);
        slot.appendChild(magazinePublishForm(item, detail.post || {}));
      } catch (error) {
        status.textContent = error.message || '원본 글을 불러오지 못했습니다.';
        status.classList.add('is-error');
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  function magazinePublishForm(item, post) {
    var form = el('form', 'playground-comment-form');
    var titleLabel = el('label', '', '제목');
    var title = document.createElement('input');
    title.name = 'title';
    title.required = true;
    title.minLength = 3;
    title.maxLength = 120;
    title.value = post.title || item.title || '';
    titleLabel.appendChild(title);
    var bodyLabel = el('label', '', '본문 (각색·익명화 후 발행)');
    var body = document.createElement('textarea');
    body.name = 'body';
    body.rows = 10;
    body.required = true;
    body.minLength = 10;
    body.maxLength = 5000;
    body.value = post.body || '';
    bodyLabel.appendChild(body);
    var submit = el('button', 'playground-button', '매거진으로 발행');
    submit.type = 'submit';
    var cancel = el('button', 'playground-button playground-button--ghost', '취소');
    cancel.type = 'button';
    var controls = el('div', 'admin-card__actions');
    var status = el('p', 'playground-form-status');
    controls.appendChild(submit);
    controls.appendChild(cancel);
    form.appendChild(titleLabel);
    form.appendChild(bodyLabel);
    form.appendChild(controls);
    form.appendChild(status);
    cancel.addEventListener('click', function () {
      form.remove();
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      status.classList.remove('is-error');
      status.textContent = '매거진으로 발행하는 중입니다.';
      submit.disabled = true;
      try {
        await fetchJson('/.netlify/functions/admin-magazine', {
          method: 'POST',
          body: JSON.stringify({ sourcePostId: item.id, title: title.value, body: body.value })
        });
        state.flash = '매거진으로 발행됐어';
        await loadInbox();
      } catch (error) {
        status.textContent = error.message || '매거진으로 발행하지 못했습니다.';
        status.classList.add('is-error');
        submit.disabled = false;
      }
    });
    return form;
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
      if (state.filter === 'magazine_candidates') actions.appendChild(magazinePublishButton(item, answerSlot));
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

  function reportRow(item) {
    var card = el('article', 'admin-card');
    var targetLabel = item.targetType === 'comment' ? '댓글 신고' : '게시글 신고';
    card.appendChild(el('h2', '', item.title || '삭제된 게시글'));
    card.appendChild(el('p', '', targetLabel + ' · 신고 ' + String(item.reportCount || 0) + '건 · ' + (item.status || 'deleted')));
    card.appendChild(el('span', '', item.authorLabel || '알 수 없음'));
    if (item.commentBody) card.appendChild(el('p', '', item.commentBody));
    var actions = el('div', 'admin-card__actions');
    if (item.postId) actions.appendChild(actionButton('숨김', 'hide', item.postId));
    card.appendChild(actions);
    return card;
  }

  function renderReports(items) {
    clear(listEl);
    if (!items.length) {
      var empty = el('article', 'playground-empty');
      empty.appendChild(el('h2', '', '접수된 신고가 없습니다'));
      listEl.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      listEl.appendChild(reportRow(item));
    });
  }

  async function loadReports() {
    clear(listEl);
    listEl.appendChild(el('p', 'playground-loading', '신고 항목을 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/admin-inbox?filter=reports');
      renderReports(data.items || []);
    } catch (error) {
      clear(listEl);
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '신고 항목을 불러오지 못했습니다'));
      box.appendChild(el('p', '', error.message || '관리자 권한이 필요합니다.'));
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
    return memberRoleChangeButton(member, card, targetRole, label);
  }

  function memberGodButton(member, card) {
    var targetRole = member.role === 'god' ? 'member' : 'god';
    var label = member.role === 'god' ? '마술의 신 해제' : '마술의 신 부여';
    return memberRoleChangeButton(member, card, targetRole, label);
  }

  function memberRoleChangeButton(member, card, targetRole, label) {
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
    return { userId: member.userId, role: targetRole };
  }

  function memberRoleNode(member) {
    var role = member.role || 'member';
    var row = el('p', '');
    var badge = roleBadgeHtml(role);
    if (badge) {
      row.insertAdjacentHTML('beforeend', badge);
      return row;
    }
    row.textContent = 'role ' + (role === 'member' ? '일반회원' : role);
    return row;
  }

  var MEMBER_TOOL_LABELS = {
    calc: '계산기',
    stopwatch: '스톱워치',
    all: '전체'
  };

  function memberToolAccessMap(data) {
    var accessByUserId = Object.create(null);
    (data.approved || []).forEach(function (access) {
      if (!access.userId) return;
      accessByUserId[access.userId] = {
        id: access.id,
        tool: access.tool,
        lifetime: access.lifetime === true,
        status: access.status
      };
    });
    return accessByUserId;
  }

  async function loadMemberToolAccess() {
    try {
      var data = await fetchJson('/.netlify/functions/admin-tools');
      state.memberToolAccessByUserId = memberToolAccessMap(data);
    } catch {
      state.memberToolAccessByUserId = null;
    }
  }

  function memberToolAccess(member) {
    if (!state.memberToolAccessByUserId || !member.userId) return null;
    return state.memberToolAccessByUserId[member.userId] || null;
  }

  function memberToolAccessNode(member) {
    if (state.memberToolAccessByUserId === null) return null;
    var access = memberToolAccess(member);
    var text = '도구 권한 없음';
    if (access) {
      text = '도구 권한 · ' + (MEMBER_TOOL_LABELS[access.tool] || access.tool);
      if (access.lifetime) text += ' · 평생';
    }
    return el('p', '', text);
  }

  function setMemberToolBusy(toggle, panel, busy) {
    toggle.disabled = busy;
    Array.prototype.forEach.call(panel.querySelectorAll('button'), function (button) {
      button.disabled = busy;
    });
  }

  function memberToolPanel(member, card, toggle) {
    var access = memberToolAccess(member);
    var form = el('form', 'playground-comment-form');
    form.hidden = true;
    form.setAttribute('data-member-tool-panel', '');

    var tool = document.createElement('select');
    tool.name = 'tool';
    tool.appendChild(option('calc', '계산기', access && access.tool === 'calc'));
    tool.appendChild(option('stopwatch', '스톱워치', access && access.tool === 'stopwatch'));
    tool.appendChild(option('all', '전체', access && access.tool === 'all'));

    var lifetimeLabel = document.createElement('label');
    var lifetime = document.createElement('input');
    lifetime.type = 'checkbox';
    lifetime.name = 'lifetime';
    lifetime.checked = Boolean(access && access.lifetime);
    lifetimeLabel.appendChild(lifetime);
    lifetimeLabel.appendChild(document.createTextNode(' 평생 권한'));

    var controls = el('div', 'admin-card__actions');
    var add = el('button', 'playground-button', '추가');
    add.type = 'submit';
    controls.appendChild(add);

    if (access && access.id) {
      var revoke = el('button', 'playground-button playground-button--ghost', '권한 회수');
      revoke.type = 'button';
      revoke.addEventListener('click', async function () {
        if (!window.confirm('이 회원의 도구 권한을 회수할까요?')) return;
        var status = card.querySelector('[data-member-status]');
        status.textContent = '처리 중입니다.';
        status.classList.remove('is-error');
        setMemberToolBusy(toggle, form, true);
        try {
          await fetchJson('/.netlify/functions/admin-tools?id=' + encodeURIComponent(access.id), {
            method: 'DELETE'
          });
          delete state.memberToolAccessByUserId[member.userId];
          card.replaceWith(memberRow(member));
        } catch (error) {
          status.textContent = error.message || '도구 권한을 회수하지 못했습니다.';
          status.classList.add('is-error');
          setMemberToolBusy(toggle, form, false);
        }
      });
      controls.appendChild(revoke);
    }

    form.appendChild(tool);
    form.appendChild(lifetimeLabel);
    form.appendChild(controls);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var status = card.querySelector('[data-member-status]');
      status.textContent = '처리 중입니다.';
      status.classList.remove('is-error');
      setMemberToolBusy(toggle, form, true);
      try {
        await fetchJson('/.netlify/functions/admin-tools', {
          method: 'POST',
          body: JSON.stringify({
            action: 'grantByUser',
            userId: member.userId,
            tool: tool.value,
            lifetime: lifetime.checked
          })
        });
        await loadMemberToolAccess();
        card.replaceWith(memberRow(member));
      } catch (error) {
        status.textContent = error.message || '도구 권한을 부여하지 못했습니다.';
        status.classList.add('is-error');
        setMemberToolBusy(toggle, form, false);
      }
    });
    return form;
  }

  function memberToolButton(member, card) {
    var button = el('button', 'playground-button playground-button--ghost', '도구 권한');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', function () {
      var panel = card.querySelector('[data-member-tool-panel]');
      var willOpen = panel.hidden;
      panel.hidden = !willOpen;
      button.setAttribute('aria-expanded', String(willOpen));
    });
    return button;
  }

  function memberRow(member) {
    var card = el('article', 'admin-card');
    var protectedRolePattern = /^(admin|kali)$/;
    var nameEl = el('h2', '', member.nickname || '닉네임 없음');
    if (member.userId) {
      nameEl.setAttribute('data-author-id', member.userId);
      nameEl.setAttribute('data-author-nickname', member.nickname || '닉네임 없음');
    }
    card.appendChild(nameEl);
    card.appendChild(memberRoleNode(member));
    var toolAccessNode = memberToolAccessNode(member);
    if (toolAccessNode) card.appendChild(toolAccessNode);
    card.appendChild(el('span', '', member.createdAt ? new Date(member.createdAt).toLocaleDateString('ko-KR') : '가입일 없음'));
    var actions = el('div', 'admin-card__actions');
    if (!protectedRolePattern.test(member.role || '')) {
      actions.appendChild(memberRoleButton(member, card));
      actions.appendChild(memberGodButton(member, card));
    }
    var toolButton = memberToolButton(member, card);
    actions.appendChild(toolButton);
    card.appendChild(actions);
    card.appendChild(memberToolPanel(member, card, toolButton));
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
      var results = await Promise.all([
        fetchJson('/.netlify/functions/admin-members?q=' + encodeURIComponent(state.memberQuery)),
        loadMemberToolAccess()
      ]);
      var data = results[0];
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

  function mmbsRequestRow(request) {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', request.nickname || '닉네임 없음'));
    card.appendChild(el('p', '', request.requestedAt ? new Date(request.requestedAt).toLocaleString('ko-KR') : '신청일 없음'));
    var actions = el('div', 'admin-card__actions');
    var complete = el('button', 'playground-button', '처리 완료');
    complete.type = 'button';
    var status = el('p', 'playground-form-status');
    complete.addEventListener('click', async function () {
      status.textContent = '처리 중입니다.';
      status.classList.remove('is-error');
      complete.disabled = true;
      try {
        await fetchJson('/.netlify/functions/mmbs-request', {
          method: 'PATCH',
          body: JSON.stringify({ userId: request.userId })
        });
        state.flash = (request.nickname || '회원') + '님의 신청을 처리 완료했습니다.';
        await loadMmbsRequests();
      } catch (error) {
        status.textContent = error.message || '신청을 처리하지 못했습니다.';
        status.classList.add('is-error');
        complete.disabled = false;
      }
    });
    actions.appendChild(complete);
    card.appendChild(actions);
    card.appendChild(status);
    return card;
  }

  function renderMmbsRequests(requests) {
    clear(listEl);
    if (state.flash) {
      listEl.appendChild(el('p', 'playground-form-status', state.flash));
      state.flash = '';
    }
    if (!requests.length) {
      var empty = el('article', 'playground-empty');
      empty.appendChild(el('h2', '', '대기 중인 신청이 없습니다'));
      empty.appendChild(el('p', '', '새 입문 강의 신청이 접수되면 이곳에 표시됩니다.'));
      listEl.appendChild(empty);
      return;
    }
    requests.forEach(function (request) {
      listEl.appendChild(mmbsRequestRow(request));
    });
  }

  async function loadMmbsRequests() {
    clear(listEl);
    listEl.appendChild(el('p', 'playground-loading', '입문 강의 신청을 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/mmbs-request?filter=mmbs_requests');
      renderMmbsRequests(data.requests || []);
    } catch (error) {
      clear(listEl);
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '입문 강의 신청을 불러오지 못했습니다'));
      box.appendChild(el('p', '', '신청 기능을 준비 중입니다. 마이그레이션 적용 후 다시 시도해주세요.'));
      listEl.appendChild(box);
    }
  }

  function analyticsStatItem(label, value) {
    var item = el('div', 'admin-stat');
    item.appendChild(el('p', 'admin-stat__label', label));
    item.appendChild(el('p', 'admin-stat__value', String(value)));
    return item;
  }

  function analyticsTotalsCard(totals) {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', '최근 30일 요약'));
    var grid = el('div', 'admin-stat-grid');
    grid.appendChild(analyticsStatItem('방문', totals.pageviews));
    grid.appendChild(analyticsStatItem('세션', totals.sessions));
    grid.appendChild(analyticsStatItem('CTA 클릭', totals.ctaClicks));
    grid.appendChild(analyticsStatItem('리드', totals.leadSubmits));
    grid.appendChild(analyticsStatItem('회원', totals.members));
    card.appendChild(grid);
    return card;
  }

  var FUNNEL_STEP_LABEL = { pageview: '방문', cta_click: 'CTA 클릭', lead_submit: '리드 제출' };

  function analyticsFunnelCard(funnel) {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', '퍼널'));
    var list = el('div', 'admin-funnel');
    (funnel || []).forEach(function (step) {
      var row = el('div', 'admin-funnel__row');
      row.appendChild(el('span', '', FUNNEL_STEP_LABEL[step.step] || step.step));
      row.appendChild(el('span', '', String(step.sessions) + '세션'));
      row.appendChild(el('span', '', step.rate + '%'));
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  function analyticsTableCard(title, headers, rows) {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', title));
    if (!rows.length) {
      card.appendChild(el('p', '', '데이터가 없습니다.'));
      return card;
    }
    var table = document.createElement('table');
    table.className = 'admin-table';
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    headers.forEach(function (label) {
      var th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.forEach(function (cells) {
      var tr = document.createElement('tr');
      cells.forEach(function (cell) {
        var td = document.createElement('td');
        td.textContent = String(cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);
    return card;
  }

  function renderAnalytics(data) {
    clear(listEl);
    listEl.appendChild(analyticsTotalsCard(data.totals || {}));
    listEl.appendChild(analyticsFunnelCard(data.funnel || []));
    listEl.appendChild(analyticsTableCard(
      'CTA별 클릭',
      ['이름', '클릭', '세션'],
      (data.byCta || []).map(function (row) { return [row.eventName, row.clicks, row.sessions]; })
    ));
    listEl.appendChild(analyticsTableCard(
      '페이지별 조회',
      ['페이지', '조회', '세션'],
      (data.byPage || []).map(function (row) { return [row.page, row.pageviews, row.sessions]; })
    ));
  }

  async function loadAnalytics() {
    clear(listEl);
    listEl.appendChild(el('p', 'playground-loading', '측정 데이터를 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/admin-analytics');
      renderAnalytics(data);
    } catch (error) {
      clear(listEl);
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '관리자 권한이 필요합니다'));
      box.appendChild(el('p', '', error.message || '측정 데이터를 불러오지 못했습니다.'));
      listEl.appendChild(box);
    }
  }

  function loadCurrentView() {
    if (state.filter === 'members') return loadMembers();
    if (state.filter === 'mmbs_requests') return loadMmbsRequests();
    if (state.filter === 'analytics') return loadAnalytics();
    if (state.filter === 'reports') return loadReports();
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
    if (window.KalisBadges && typeof window.KalisBadges.bindAuthorCells === 'function') {
      window.KalisBadges.bindAuthorCells(listEl);
    }
    await renderAuth();
    await loadInbox();
  }

  init();
})();
