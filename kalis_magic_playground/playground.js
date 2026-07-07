(function () {
  var state = { category: 'all', session: null, selectedPostId: null };
  var listEl = document.querySelector('[data-post-list]');
  var detailEl = document.querySelector('[data-post-detail]');
  var authPanel = document.querySelector('[data-auth-panel]');
  var questionForm = document.querySelector('[data-question-form]');
  var questionStatus = document.querySelector('[data-question-status]');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-category]'));

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function categoryLabel(category) {
    return {
      question: '질문',
      event_review: '모임 후기',
      review: '리뷰/후기',
      free: '자유게시판',
      magazine: '매거진'
    }[category] || '전체';
  }

  function visibilityLabel(visibility) {
    return {
      public: '전체 공개',
      kali_only: '칼리에게만 공개',
      expert_only: '전문가 이상 공개',
      author_only: '질문자에게만 공개'
    }[visibility] || '전체 공개';
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

  function setStatus(message, isError) {
    if (!questionStatus) return;
    questionStatus.textContent = message || '';
    questionStatus.classList.toggle('is-error', Boolean(isError));
  }

  async function renderAuth() {
    if (!authPanel || !window.MagicAuth) return;
    clear(authPanel);
    state.session = await window.MagicAuth.getSession();
    if (!state.session) {
      authPanel.appendChild(el('p', 'playground-auth__text', '글 작성은 Google 로그인 후 열립니다.'));
      var loginButton = el('button', 'playground-button', 'Google로 로그인');
      loginButton.type = 'button';
      loginButton.addEventListener('click', function () {
        window.MagicAuth.login().catch(showError);
      });
      authPanel.appendChild(loginButton);
      if (questionForm) questionForm.classList.add('is-disabled');
      return;
    }
    authPanel.appendChild(el('p', 'playground-auth__text', state.session.user.email || '로그인됨'));
    var logoutButton = el('button', 'playground-button playground-button--ghost', '로그아웃');
    logoutButton.type = 'button';
    logoutButton.addEventListener('click', function () {
      window.MagicAuth.logout().catch(showError);
    });
    authPanel.appendChild(logoutButton);
    if (questionForm) questionForm.classList.remove('is-disabled');
  }

  function renderEmpty(message) {
    clear(listEl);
    var empty = el('article', 'playground-empty');
    empty.appendChild(el('h2', '', '아직 글이 없습니다'));
    empty.appendChild(el('p', '', message || '첫 질문과 후기가 이곳에 쌓일 예정입니다.'));
    listEl.appendChild(empty);
  }

  function renderPosts(posts) {
    clear(listEl);
    if (!posts.length) {
      renderEmpty();
      return;
    }
    posts.forEach(function (post) {
      var item = el('article', 'playground-post');
      var meta = el('div', 'playground-post__meta');
      meta.appendChild(el('span', '', categoryLabel(post.category)));
      meta.appendChild(el('span', '', visibilityLabel(post.visibility)));
      meta.appendChild(el('span', '', post.authorLabel || '익명'));

      var title = el('h2', 'playground-post__title', post.title);
      var body = el('p', 'playground-post__body', post.bodyLocked ? '작성자가 허용한 사람만 내용을 볼 수 있습니다.' : post.body);
      var openButton = el('button', 'playground-link-button', '자세히 보기');
      openButton.type = 'button';
      openButton.addEventListener('click', function () {
        state.selectedPostId = post.id;
        loadDetail(post.id).catch(showDetailError);
      });
      if (post.bodyLocked) body.classList.add('is-locked');

      item.appendChild(meta);
      item.appendChild(title);
      item.appendChild(body);
      item.appendChild(openButton);
      listEl.appendChild(item);
    });
  }

  function showLoading() {
    clear(listEl);
    listEl.appendChild(el('p', 'playground-loading', '불러오는 중입니다.'));
  }

  function showDetailLoading() {
    clear(detailEl);
    detailEl.appendChild(el('p', 'playground-loading', '상세 내용을 불러오는 중입니다.'));
  }

  function showError(error) {
    clear(listEl);
    var box = el('article', 'playground-empty');
    box.appendChild(el('h2', '', '잠시 후 다시 시도해주세요'));
    box.appendChild(el('p', '', error && error.message ? error.message : '목록을 불러오지 못했습니다.'));
    listEl.appendChild(box);
  }

  function showDetailError(error) {
    clear(detailEl);
    var box = el('article', 'playground-empty');
    box.appendChild(el('h2', '', '상세 내용을 열 수 없습니다'));
    box.appendChild(el('p', '', error && error.message ? error.message : '권한이 없거나 글이 사라졌습니다.'));
    detailEl.appendChild(box);
  }

  async function fetchJson(url, options) {
    var headers = window.MagicAuth ? await window.MagicAuth.authHeader() : {};
    if (options && options.body) headers['content-type'] = 'application/json; charset=utf-8';
    var response = await fetch(url, Object.assign({}, options, { headers: headers }));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.message || data.error || '요청을 처리하지 못했습니다.');
    return data;
  }

  async function loadPosts() {
    if (!listEl) return;
    showLoading();
    var data = await fetchJson('/.netlify/functions/posts?category=' + encodeURIComponent(state.category));
    renderPosts(data.posts || []);
  }

  async function loadDetail(id) {
    showDetailLoading();
    var data = await fetchJson('/.netlify/functions/post-detail?id=' + encodeURIComponent(id));
    renderDetail(data);
  }

  function renderDetail(data) {
    clear(detailEl);
    var post = data.post;
    var title = el('h2', 'playground-detail__title', post.title);
    var meta = el('div', 'playground-post__meta');
    meta.appendChild(el('span', '', categoryLabel(post.category)));
    meta.appendChild(el('span', '', visibilityLabel(post.visibility)));
    meta.appendChild(el('span', '', post.authorLabel || '익명'));
    var body = el('p', 'playground-detail__body', post.bodyLocked ? '이 글은 작성자가 허용한 사람만 내용을 볼 수 있습니다.' : post.body);
    if (post.bodyLocked) body.classList.add('is-locked');
    detailEl.appendChild(meta);
    detailEl.appendChild(title);
    detailEl.appendChild(body);
    if (post.bodyLocked) return;
    var postVideo = createYouTubeLiteEmbed(post.youtubeVideoId, '질문에 첨부된 영상');
    if (postVideo) detailEl.appendChild(postVideo);
    renderAnswers(data.answers || []);
    renderComments(data.comments || []);
  }

  function renderAnswers(answers) {
    var section = el('section', 'playground-detail__section');
    section.appendChild(el('h3', '', '답변'));
    if (!answers.length) {
      section.appendChild(el('p', 'playground-loading', '아직 답변이 없습니다.'));
      detailEl.appendChild(section);
      return;
    }
    answers.forEach(function (answer) {
      var item = el('article', 'playground-answer');
      var meta = el('div', 'playground-post__meta');
      meta.appendChild(el('span', '', answer.authorLabel || '답변자'));
      meta.appendChild(el('span', '', visibilityLabel(answer.visibility)));
      item.appendChild(meta);
      item.appendChild(el('p', '', answer.body));
      var answerVideo = createYouTubeLiteEmbed(answer.youtubeVideoId, '답변에 첨부된 영상');
      if (answerVideo) item.appendChild(answerVideo);
      section.appendChild(item);
    });
    detailEl.appendChild(section);
  }

  function renderComments(comments) {
    var section = el('section', 'playground-detail__section');
    section.appendChild(el('h3', '', '댓글'));
    if (!comments.length) {
      section.appendChild(el('p', 'playground-loading', '아직 댓글이 없습니다.'));
      section.appendChild(commentForm(null));
      detailEl.appendChild(section);
      return;
    }
    comments.forEach(function (comment) {
      var item = el('article', comment.parentCommentId ? 'playground-comment is-reply' : 'playground-comment');
      item.appendChild(el('strong', '', comment.authorLabel || '익명'));
      item.appendChild(el('p', '', comment.body));
      if (!comment.parentCommentId) {
        var reply = el('button', 'playground-link-button', '답글');
        reply.type = 'button';
        reply.addEventListener('click', function () {
          if (item.querySelector('form')) return;
          item.appendChild(commentForm(comment.id));
        });
        item.appendChild(reply);
      }
      section.appendChild(item);
    });
    section.appendChild(commentForm(null));
    detailEl.appendChild(section);
  }

  function commentForm(parentCommentId) {
    var form = el('form', 'playground-comment-form');
    var textarea = document.createElement('textarea');
    textarea.name = 'body';
    textarea.rows = 3;
    textarea.required = true;
    textarea.placeholder = parentCommentId ? '답글을 남겨주세요.' : '댓글을 남겨주세요.';
    var displayMode = document.createElement('select');
    displayMode.name = 'displayMode';
    var nickname = document.createElement('option');
    nickname.value = 'nickname';
    nickname.textContent = '닉네임';
    var anonymous = document.createElement('option');
    anonymous.value = 'anonymous';
    anonymous.textContent = '익명';
    displayMode.appendChild(nickname);
    displayMode.appendChild(anonymous);
    var button = el('button', 'playground-button', parentCommentId ? '답글 올리기' : '댓글 올리기');
    button.type = 'submit';
    var status = el('p', 'playground-form-status');
    form.appendChild(textarea);
    form.appendChild(displayMode);
    form.appendChild(button);
    form.appendChild(status);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!state.session) {
        status.textContent = '로그인 후 댓글을 쓸 수 있습니다.';
        status.classList.add('is-error');
        return;
      }
      var formData = new FormData(form);
      status.classList.remove('is-error');
      status.textContent = '댓글을 올리는 중입니다.';
      try {
        await fetchJson('/.netlify/functions/comments', {
          method: 'POST',
          body: JSON.stringify({
            postId: state.selectedPostId,
            parentCommentId: parentCommentId,
            body: formData.get('body'),
            displayMode: formData.get('displayMode')
          })
        });
        await loadDetail(state.selectedPostId);
      } catch (error) {
        status.textContent = error.message || '댓글을 올리지 못했습니다.';
        status.classList.add('is-error');
      }
    });
    return form;
  }

  async function submitQuestion(event) {
    event.preventDefault();
    if (!state.session) {
      setStatus('로그인 후 질문을 올릴 수 있습니다.', true);
      return;
    }
    var formData = new FormData(questionForm);
    setStatus('질문을 올리는 중입니다.', false);
    await fetchJson('/.netlify/functions/posts', {
      method: 'POST',
      body: JSON.stringify({
        postType: 'question',
        title: formData.get('title'),
        body: formData.get('body'),
        visibility: formData.get('visibility'),
        displayMode: formData.get('displayMode'),
        youtubeUrl: formData.get('youtubeUrl')
      })
    });
    questionForm.reset();
    setStatus('질문이 올라갔습니다.', false);
    state.category = 'question';
    tabs.forEach(function (tab) {
      tab.classList.toggle('is-active', tab.dataset.category === 'question');
    });
    await loadPosts();
  }

  function bindTabs() {
    tabs.forEach(function (button) {
      button.addEventListener('click', function () {
        state.category = button.dataset.category || 'all';
        tabs.forEach(function (tab) {
          tab.classList.toggle('is-active', tab === button);
        });
        loadPosts().catch(showError);
      });
    });
  }

  async function init() {
    bindTabs();
    if (questionForm) questionForm.addEventListener('submit', function (event) {
      submitQuestion(event).catch(function (error) {
        setStatus(error.message, true);
      });
    });
    await renderAuth();
    await loadPosts();
    var params = new URLSearchParams(window.location.search);
    if (params.get('post')) await loadDetail(params.get('post'));
  }

  window.MagicPlayground = { loadPosts: loadPosts, loadDetail: loadDetail };
  init().catch(showError);
})();
