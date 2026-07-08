(function () {
  var FLAG_PREFIX = 'nickname-onboarding-shown';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function flagKey(session) {
    var user = session && session.user ? session.user : {};
    return FLAG_PREFIX + ':' + (user.id || user.email || 'current');
  }

  async function fetchProfile(options) {
    var headers = window.MagicAuth ? await window.MagicAuth.authHeader() : {};
    if (options && options.body) headers['content-type'] = 'application/json; charset=utf-8';
    var response = await fetch('/.netlify/functions/profile', Object.assign({}, options, { headers: headers }));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.message || data.error || '프로필을 저장하지 못했습니다.');
      error.status = response.status;
      error.code = data.error;
      throw error;
    }
    return data;
  }

  function showModal(profile, key) {
    var overlay = el('div', 'field-modal-overlay nickname-onboarding');
    var dialog = el('div', 'field-modal');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'nickname-onboarding-title');
    dialog.tabIndex = -1;

    var close = el('button', 'field-modal-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '나중에 하기');

    var title = el('span', 'field-modal-tag', '닉네임 설정');
    title.id = 'nickname-onboarding-title';
    var guide = el('p', 'field-modal-quote', '커뮤니티에서 쓸 닉네임을 정해주세요');
    var form = el('form', 'playground-comment-form');
    var input = document.createElement('input');
    input.name = 'nickname';
    input.type = 'text';
    input.minLength = 2;
    input.maxLength = 24;
    input.required = true;
    input.placeholder = '2-24자';
    input.value = profile && profile.nickname ? profile.nickname : '';
    var actions = el('div', 'admin-card__actions');
    var save = el('button', 'playground-button', '저장');
    save.type = 'submit';
    var later = el('button', 'playground-button playground-button--ghost', '나중에 하기');
    later.type = 'button';
    var status = el('p', 'playground-form-status');

    actions.appendChild(save);
    actions.appendChild(later);
    form.appendChild(input);
    form.appendChild(actions);
    form.appendChild(status);
    dialog.appendChild(close);
    dialog.appendChild(title);
    dialog.appendChild(guide);
    dialog.appendChild(form);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.body.classList.add('field-modal-open');

    function closeModal() {
      overlay.remove();
      document.body.classList.remove('field-modal-open');
    }

    close.addEventListener('click', closeModal);
    later.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeModal();
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      status.classList.remove('is-error');
      status.textContent = '저장하는 중입니다.';
      save.disabled = true;
      try {
        var data = await fetchProfile({
          method: 'POST',
          body: JSON.stringify({ nickname: input.value })
        });
        try {
          sessionStorage.setItem(key, 'saved');
        } catch (storageError) {}
        window.dispatchEvent(new CustomEvent('profile:nickname-updated', { detail: data }));
        closeModal();
      } catch (error) {
        status.textContent = error.code === 'nickname_taken' ? '이미 사용 중인 닉네임이에요' : '닉네임을 저장하지 못했습니다';
        status.classList.add('is-error');
        save.disabled = false;
        input.focus();
      }
    });

    try {
      sessionStorage.setItem(key, 'shown');
    } catch (storageError) {}
    input.focus();
  }

  async function init() {
    if (!window.MagicAuth) return;
    var session = await window.MagicAuth.getSession();
    if (!session) return;
    var key = flagKey(session);
    try {
      if (sessionStorage.getItem(key)) return;
    } catch (storageError) {}

    try {
      var profile = await fetchProfile();
      if (profile.nicknameSet === false) showModal(profile, key);
    } catch (error) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
