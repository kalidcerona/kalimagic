(function () {
  var panel = document.querySelector('[data-panel]');
  var to = window.ToolGateUtil.safeTo(new URLSearchParams(location.search).get('to'));
  var tool = window.ToolGateUtil.toolFromPath(to);
  var names = { calc: 'HITSUZEN', stopwatch: 'KAIROS', unlock: '레리즈', 'stopwatch-uni': 'KAIROS' };
  var appName = names[tool];
  var busy = false;
  var signedIn = false;

  function render(title, message, buttons) {
    panel.replaceChildren();
    if (title) {
      var heading = document.createElement('h1');
      heading.textContent = title;
      panel.appendChild(heading);
    }
    (Array.isArray(message) ? message : [message]).forEach(function (line) {
      if (!line) return;
      var paragraph = document.createElement('p');
      if (line.email) {
        paragraph.className = 'email';
        paragraph.textContent = line.email;
      } else {
        paragraph.textContent = line;
      }
      panel.appendChild(paragraph);
    });
    (buttons || []).forEach(function (spec) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = spec.label;
      button.addEventListener('click', spec.onClick);
      panel.appendChild(button);
    });
    panel.setAttribute('aria-busy', 'false');
  }

  function showLoading(message) {
    render(appName, message || '이용 권한을 확인하는 중입니다.', []);
    panel.setAttribute('aria-busy', 'true');
  }

  function showLogin() {
    signedIn = false;
    render(appName, appName + ' 이용 권한을 확인하려면 구글 계정으로 로그인해주세요.', [
      { label: '구글로 로그인', onClick: login }
    ]);
  }

  function actions() {
    return [
      { label: '다시 확인', onClick: start },
      { label: '다른 계정으로 로그인', onClick: changeAccount }
    ];
  }

  function showPending(email) {
    var friendApp = tool === 'unlock' || tool === 'stopwatch-uni';
    var lines = friendApp
      ? [appName + ' 이용 신청이 접수되었습니다.', '칼리형이 이 구글 계정에 권한을 주면 사용할 수 있습니다.']
      : [appName + ' 이용 권한을 확인 중입니다. 구매가 확인되면 사용할 수 있습니다.'];
    if (email) lines.push({ email: email });
    lines.push(friendApp ? '승인을 받은 뒤 다시 확인해주세요.' : '구매가 확인된 뒤 다시 확인해주세요.');
    render('이용 신청 확인 중', lines, actions());
  }

  function showDenied(email) {
    var lines = [appName + ' 이용 권한이 이 계정에 없습니다. 칼리형에게 문의해주세요.'];
    if (email) lines.push({ email: email });
    render('이 도구는 아직 이용할 수 없습니다', lines, actions());
  }

  function showError() {
    render(appName + ' 연결에 실패했습니다', '네트워크 상태를 확인하고 다시 시도해주세요.', [
      { label: '다시 시도', onClick: start },
      ...(signedIn ? [{ label: '다른 계정으로 로그인', onClick: changeAccount }] : [])
    ]);
  }

  async function login() {
    if (busy) return;
    busy = true;
    showLoading('구글 로그인으로 이동하는 중입니다.');
    try {
      await window.MagicAuth.login();
    } catch (error) {
      showError();
    } finally {
      busy = false;
    }
  }

  async function changeAccount() {
    if (busy) return;
    busy = true;
    showLoading('구글 계정을 변경하는 중입니다.');
    try {
      await window.MagicAuth.logout();
      showLogin();
    } catch (error) {
      showError();
    } finally {
      busy = false;
    }
  }

  async function requestAccess(session) {
    var headers = await window.MagicAuth.authHeader();
    headers['content-type'] = 'application/json; charset=utf-8';
    var response = await fetch('/.netlify/functions/tool-access', {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      body: JSON.stringify({ tool: tool })
    });
    if (response.ok) {
      location.replace(to);
      return;
    }
    var data = await response.json().catch(function () { return {}; });
    var email = session.user && session.user.email;
    if (response.status === 401) return showLogin();
    if (response.status === 403) {
      if (data.error === 'pending' || data.status === 'pending') return showPending(email);
      return showDenied(email);
    }
    showError();
  }

  async function start() {
    if (busy) return;
    busy = true;
    showLoading();
    try {
      if (!window.MagicAuth) return showError();
      var session = await window.MagicAuth.getSession();
      signedIn = Boolean(session);
      if (!session) return showLogin();
      await requestAccess(session);
    } catch (error) {
      showError();
    } finally {
      busy = false;
    }
  }

  start();
})();
