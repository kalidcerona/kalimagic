(function () {
  var root = document.querySelector('[data-tools-root]');
  if (!root || !window.PgUtil) return;

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;
  var TOOL_LABELS = { calc: '계산기', stopwatch: '스톱워치', all: '전체' };
  var ENDPOINT = '/.netlify/functions/admin-tools';

  function toolSelect(selected) {
    var select = document.createElement('select');
    select.name = 'tool';
    ['calc', 'stopwatch', 'all'].forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = TOOL_LABELS[value];
      if (value === selected) option.selected = true;
      select.appendChild(option);
    });
    return select;
  }

  function lifetimeField(input) {
    input.type = 'checkbox';
    input.name = 'lifetime';
    input.style.width = 'auto';
    var label = el('label', 'admin-card__actions');
    label.appendChild(input);
    label.appendChild(document.createTextNode('평생 권한'));
    return label;
  }

  function noteInput() {
    var note = document.createElement('input');
    note.type = 'text';
    note.name = 'note';
    note.placeholder = '메모 (선택)';
    return note;
  }

  function formatWhen(value) {
    if (!value) return '';
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ko-KR');
  }

  // 버튼 하나가 서버를 부르고, 성공하면 목록을 다시 읽고, 실패하면 한국어 메시지를 남긴다.
  async function mutate(status, button, busyText, failText, run) {
    status.textContent = busyText;
    status.classList.remove('is-error');
    button.disabled = true;
    try {
      await run();
      await load();
    } catch (error) {
      status.textContent = error.message || failText;
      status.classList.add('is-error');
      button.disabled = false;
    }
  }

  function addCard() {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', '직접 추가'));
    card.appendChild(el('p', '', '이메일로 이용 권한을 바로 등록합니다. 등록한 계정으로 도구를 쓸 수 있습니다.'));

    var form = el('form', 'playground-comment-form');
    var email = document.createElement('input');
    email.type = 'email';
    email.name = 'email';
    email.required = true;
    email.placeholder = '구글 계정 이메일';

    var tool = toolSelect('calc');
    var note = noteInput();
    var lifetime = document.createElement('input');

    var actions = el('div', 'admin-card__actions');
    var submit = el('button', 'playground-button', '추가');
    submit.type = 'submit';
    actions.appendChild(submit);

    var status = el('p', 'playground-form-status');
    form.appendChild(email);
    form.appendChild(tool);
    form.appendChild(note);
    form.appendChild(lifetimeField(lifetime));
    form.appendChild(actions);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      mutate(status, submit, '등록하는 중입니다.', '등록하지 못했습니다.', function () {
        return fetchJson(ENDPOINT, {
          method: 'POST',
          body: JSON.stringify({
            action: 'add',
            email: email.value.trim(),
            tool: tool.value,
            note: note.value.trim(),
            lifetime: lifetime.checked
          })
        });
      });
    });

    card.appendChild(form);
    card.appendChild(status);
    return card;
  }

  function whoLine(item) {
    return [
      item.displayName ? '구글 이름 ' + item.displayName : '구글 이름 없음',
      item.nickname ? '닉네임 ' + item.nickname : '닉네임 없음'
    ].join(' / ');
  }

  function pendingCard(item) {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', item.email || '이메일 없음'));
    card.appendChild(el('p', '', whoLine(item)));
    card.appendChild(el('span', '', '접속 ' + (formatWhen(item.requestedAt || item.createdAt) || '시각 없음')));

    var tool = toolSelect(item.tool || 'calc');
    var lifetime = document.createElement('input');
    var note = noteInput();
    var status = el('p', 'playground-form-status');

    var approve = el('button', 'playground-button', '권한 주기');
    approve.type = 'button';
    approve.addEventListener('click', function () {
      mutate(status, approve, '권한을 주는 중입니다.', '권한을 주지 못했습니다.', function () {
        return fetchJson(ENDPOINT, {
          method: 'POST',
          body: JSON.stringify({
            action: 'approve',
            id: item.id,
            tool: tool.value,
            lifetime: lifetime.checked,
            note: note.value.trim()
          })
        });
      });
    });

    var reject = el('button', 'playground-button playground-button--ghost', '목록에서 삭제');
    reject.type = 'button';
    reject.addEventListener('click', function () {
      if (!window.confirm((item.email ? item.email + ' 계정을' : '이 계정을') + ' 목록에서 삭제할까요?')) return;
      mutate(status, reject, '목록에서 삭제하는 중입니다.', '목록에서 삭제하지 못했습니다.', function () {
        return fetchJson(ENDPOINT + '?id=' + encodeURIComponent(item.id), { method: 'DELETE' });
      });
    });

    var actions = el('div', 'admin-card__actions');
    actions.appendChild(tool);
    actions.appendChild(lifetimeField(lifetime));
    actions.appendChild(approve);
    actions.appendChild(reject);

    card.appendChild(note);
    card.appendChild(actions);
    card.appendChild(status);
    return card;
  }

  function approvedCard(item) {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', item.email || '이메일 없음'));
    card.appendChild(el('p', '', whoLine(item)));

    var toolLine = el('p', '', TOOL_LABELS[item.tool] || item.tool || '');
    if (item.lifetime) {
      toolLine.appendChild(document.createTextNode(' '));
      toolLine.appendChild(el('span', 'pg-badge', '평생'));
    }
    card.appendChild(toolLine);
    if (item.note) card.appendChild(el('p', '', item.note));
    card.appendChild(el('span', '', item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '등록일 없음'));

    var status = el('p', 'playground-form-status');
    var revoke = el('button', 'playground-button playground-button--ghost', '권한 회수');
    revoke.type = 'button';
    revoke.addEventListener('click', function () {
      if (!window.confirm((item.email || '이 계정') + ' 권한을 회수할까요?')) return;
      mutate(status, revoke, '회수하는 중입니다.', '회수하지 못했습니다.', function () {
        return fetchJson(ENDPOINT + '?id=' + encodeURIComponent(item.id), { method: 'DELETE' });
      });
    });

    var actions = el('div', 'admin-card__actions');
    actions.appendChild(revoke);
    card.appendChild(actions);
    card.appendChild(status);
    return card;
  }

  function emptyBox(title, message) {
    var box = el('article', 'playground-empty');
    box.appendChild(el('h2', '', title));
    box.appendChild(el('p', '', message));
    return box;
  }

  function render(data) {
    var pending = data.pending || [];
    var approved = data.approved || [];
    clear(root);

    root.appendChild(el('h2', '', '권한 없이 접속한 사람 ' + pending.length + '건'));
    if (!pending.length) {
      root.appendChild(emptyBox('권한 없이 접속한 계정이 없습니다', '도구에 로그인했지만 아직 이용 권한이 없는 계정입니다. 구매가 확인되면 권한을 주세요.'));
    } else {
      pending.forEach(function (item) { root.appendChild(pendingCard(item)); });
    }

    root.appendChild(el('h2', '', '이용 권한 있음 ' + approved.length + '건'));
    root.appendChild(addCard());
    if (!approved.length) {
      root.appendChild(emptyBox('등록된 권한이 없습니다', '위에서 이메일을 추가하거나 권한 없이 접속한 계정에 권한을 주세요.'));
      return;
    }
    approved.forEach(function (item) { root.appendChild(approvedCard(item)); });
  }

  async function load() {
    clear(root);
    root.appendChild(el('p', 'playground-loading', '도구 권한을 불러오는 중입니다.'));
    try {
      render(await fetchJson(ENDPOINT));
    } catch (error) {
      clear(root);
      root.appendChild(addCard());
      root.appendChild(emptyBox('도구 권한을 불러오지 못했습니다', error.message || '관리자 권한이 필요합니다.'));
    }
  }

  load();
})();
