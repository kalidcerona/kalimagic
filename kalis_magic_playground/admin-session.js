(function () {
  var panel = document.querySelector('[data-auth-panel]');
  var util = window.PgUtil;
  async function initialize() {
    if (!panel || !util) return false;
    util.clear(panel);
    try {
      if (!window.MagicAuth) throw new Error('로그인 기능을 불러오지 못했습니다.');
      var session = await window.MagicAuth.getSession();
      if (!session) {
        panel.appendChild(util.el('p', 'playground-auth__text', '관리자 구글 계정으로 로그인해 주십시오.'));
        var login = util.el('button', 'playground-button', '구글로 계속하기');
        login.type = 'button';
        login.addEventListener('click', async function () {
          login.disabled = true;
          try { if (await window.MagicAuth.login() === false) login.disabled = false; }
          catch (error) {
            login.disabled = false;
            status.textContent = '로그인을 시작하지 못했습니다. 다시 시도해 주십시오.';
          }
        });
        var status = util.el('p', 'playground-form-status');
        status.setAttribute('role', 'status');
        panel.insertAdjacentHTML('beforeend', window.MagicAuth.noticeHtml);
        panel.append(login, status);
        return false;
      }
      panel.appendChild(util.el('p', 'playground-auth__text', session.user.email || '로그인됨'));
      return true;
    } catch (error) {
      panel.appendChild(util.el('p', 'playground-form-status is-error', '로그인 상태를 확인하지 못했습니다. 페이지를 새로고침해 주십시오.'));
      return false;
    }
  }
  window.AdminSession = { ready: initialize() };
})();
