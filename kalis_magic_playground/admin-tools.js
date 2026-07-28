(function () {
  var root = document.querySelector('[data-tools-root]');
  if (!root || !window.PgUtil) return;

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;
  var TOOL_LABELS = { calc: '계산기', stopwatch: '스톱워치', all: '전체' };

  function addCard() {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', '도구 권한'));
    card.appendChild(el('p', '', '이메일을 등록하면 그 계정이 도구를 쓸 수 있습니다.'));

    var form = el('form', 'playground-comment-form');
    var email = document.createElement('input');
    email.type = 'email';
    email.name = 'email';
    email.required = true;
    email.placeholder = '구글 계정 이메일';

    var tool = document.createElement('select');
    tool.name = 'tool';
    ['calc', 'stopwatch', 'all'].forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = TOOL_LABELS[value];
      tool.appendChild(option);
    });

    var note = document.createElement('input');
    note.type = 'text';
    note.name = 'note';
    note.placeholder = '메모 (선택)';

    var lifetime = document.createElement('input');
    lifetime.type = 'checkbox';
    lifetime.name = 'lifetime';
    lifetime.style.width = 'auto';
    var lifetimeLabel = el('label', 'admin-card__actions');
    lifetimeLabel.appendChild(lifetime);
    lifetimeLabel.appendChild(document.createTextNode('평생 권한'));

    var actions = el('div', 'admin-card__actions');
    var submit = el('button', 'playground-button', '추가');
    submit.type = 'submit';
    actions.appendChild(submit);

    var status = el('p', 'playground-form-status');
    form.appendChild(email);
    form.appendChild(tool);
    form.appendChild(note);
    form.appendChild(lifetimeLabel);
    form.appendChild(actions);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      status.textContent = '등록하는 중입니다.';
      status.classList.remove('is-error');
      submit.disabled = true;
      try {
        await fetchJson('/.netlify/functions/admin-tools', {
          method: 'POST',
          body: JSON.stringify({
            email: email.value.trim(),
            tool: tool.value,
            note: note.value.trim(),
            lifetime: lifetime.checked
          })
        });
        email.value = '';
        note.value = '';
        lifetime.checked = false;
        await load();
      } catch (error) {
        status.textContent = error.message || '등록하지 못했습니다.';
        status.classList.add('is-error');
        submit.disabled = false;
      }
    });

    card.appendChild(form);
    card.appendChild(status);
    return card;
  }

  function itemRow(item) {
    var card = el('article', 'admin-card');
    card.appendChild(el('h2', '', item.email || '이메일 없음'));
    var toolLine = el('p', '', TOOL_LABELS[item.tool] || item.tool || '');
    if (item.lifetime) {
      toolLine.appendChild(document.createTextNode(' '));
      toolLine.appendChild(el('span', 'pg-badge', '평생'));
    }
    card.appendChild(toolLine);
    if (item.note) card.appendChild(el('p', '', item.note));
    card.appendChild(el('span', '', item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '등록일 없음'));

    var status = el('p', 'playground-form-status');
    var actions = el('div', 'admin-card__actions');
    var remove = el('button', 'playground-button playground-button--ghost', '삭제');
    remove.type = 'button';
    remove.addEventListener('click', async function () {
      status.textContent = '삭제하는 중입니다.';
      status.classList.remove('is-error');
      remove.disabled = true;
      try {
        await fetchJson('/.netlify/functions/admin-tools?id=' + encodeURIComponent(item.id), { method: 'DELETE' });
        await load();
      } catch (error) {
        status.textContent = error.message || '삭제하지 못했습니다.';
        status.classList.add('is-error');
        remove.disabled = false;
      }
    });
    actions.appendChild(remove);
    card.appendChild(actions);
    card.appendChild(status);
    return card;
  }

  function render(items) {
    clear(root);
    root.appendChild(addCard());
    if (!items.length) {
      var empty = el('article', 'playground-empty');
      empty.appendChild(el('h2', '', '등록된 권한이 없습니다'));
      empty.appendChild(el('p', '', '위에서 이메일을 추가해주세요.'));
      root.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      root.appendChild(itemRow(item));
    });
  }

  async function load() {
    clear(root);
    root.appendChild(el('p', 'playground-loading', '도구 권한을 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/admin-tools');
      render(data.items || []);
    } catch (error) {
      clear(root);
      root.appendChild(addCard());
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '도구 권한을 불러오지 못했습니다'));
      box.appendChild(el('p', '', error.message || '관리자 권한이 필요합니다.'));
      root.appendChild(box);
    }
  }

  load();
})();
