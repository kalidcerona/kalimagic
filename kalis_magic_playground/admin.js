(function () {
  var state = { filter: 'all', session: null };
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

  function actionButton(label, action, postId) {
    var button = el('button', 'playground-button playground-button--ghost', label);
    button.type = 'button';
    button.addEventListener('click', async function () {
      await fetchJson('/.netlify/functions/admin-moderate', {
        method: 'POST',
        body: JSON.stringify({ action: action, postId: postId })
      });
      await loadInbox();
    });
    return button;
  }

  function renderItems(items) {
    clear(listEl);
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
      var actions = el('div', 'admin-card__actions');
      actions.appendChild(actionButton('숨김', 'hide', item.id));
      actions.appendChild(actionButton('복구', 'restore', item.id));
      actions.appendChild(actionButton('삭제', 'delete', item.id));
      actions.appendChild(actionButton('매거진 후보', 'mark_magazine_candidate', item.id));
      card.appendChild(actions);
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

  function bindFilters() {
    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        state.filter = button.dataset.adminFilter || 'all';
        filterButtons.forEach(function (tab) {
          tab.classList.toggle('is-active', tab === button);
        });
        loadInbox();
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
