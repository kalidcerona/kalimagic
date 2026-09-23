(function () {
  'use strict';

  var root = document.querySelector('[data-tools-root]');
  var authPanel = document.querySelector('[data-auth-panel]');
  var model = window.AdminAppModel;
  if (!root || !authPanel || !window.PgUtil || !model) return;

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;
  var endpoint = '/.netlify/functions/admin-tools';
  var state = { data: null, tab: 'pending', query: '', tool: '*', loadError: '' };

  function setStatus(node, message, isError) {
    node.textContent = message;
    node.classList.toggle('is-error', Boolean(isError));
    node.classList.toggle('is-success', Boolean(message && !isError));
  }

  function button(label, className, onClick) {
    var control = el('button', className || 'admin-button', label);
    control.type = 'button';
    if (onClick) control.addEventListener('click', onClick);
    return control;
  }

  function labeledControl(labelText, control, id) {
    var label = el('label', 'admin-field');
    label.htmlFor = id;
    label.appendChild(el('span', 'admin-field__label', labelText));
    control.id = id;
    label.appendChild(control);
    return label;
  }

  function selectControl(name, options, selected) {
    var select = document.createElement('select');
    select.name = name;
    options.forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry.value;
      option.textContent = entry.label;
      option.selected = entry.value === selected;
      select.appendChild(option);
    });
    return select;
  }

  function textInput(type, name, placeholder, required) {
    var input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.placeholder = placeholder || '';
    input.required = Boolean(required);
    return input;
  }

  function formatDate(value, includeTime) {
    if (!value) return '기록 시각 없음';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '기록 시각 없음';
    return date.toLocaleString('ko-KR', includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' });
  }

  function availableOptions(availability, includeLegacyAll) {
    var result = model.APP_CATALOG.filter(function (app) {
      return model.isToolAvailable(app.id, availability);
    }).map(function (app) {
      return { value: app.id, label: app.name };
    });
    if (includeLegacyAll && model.isToolAvailable('all', availability)) {
      result.push({ value: 'all', label: model.toolLabel('all') });
    }
    return result;
  }

  function setAllDisabled(form, disabled) {
    Array.prototype.forEach.call(form.elements, function (control) {
      control.disabled = disabled;
    });
  }

  async function refresh(preserveOnFailure) {
    try {
      var data = await fetchJson(endpoint);
      if (!Array.isArray(data.pending) || !Array.isArray(data.approved)) {
        throw new Error('권한 목록 응답 형식이 올바르지 않습니다.');
      }
      state.data = data;
      state.loadError = '';
      render();
      return true;
    } catch (error) {
      state.loadError = model.errorMessage(error);
      if (error.status === 403) {
        renderDenied();
        return false;
      }
      if (preserveOnFailure && state.data) {
        var notice = root.querySelector('[data-refresh-error]');
        if (notice) setStatus(notice, '목록을 새로고침하지 못했습니다. ' + state.loadError, true);
        return false;
      }
      renderLoadError();
      return false;
    }
  }

  function actionError(error) {
    if (error.status === 403) {
      renderDenied();
      return;
    }
    return model.errorMessage(error);
  }

  async function runMutation(status, control, busyMessage, run) {
    status.classList.remove('is-error', 'is-success');
    status.textContent = busyMessage;
    control.disabled = true;
    try {
      await run();
    } catch (error) {
      var message = actionError(error);
      if (message) setStatus(status, message, true);
      if (error.status !== 403) control.disabled = false;
      return;
    }

    var updated = await refresh(true);
    if (!updated && state.data) {
      var mutationScope = control.closest('.admin-access-card, .admin-grant-card');
      if (mutationScope) {
        Array.prototype.forEach.call(mutationScope.querySelectorAll('button, input, select'), function (field) {
          field.disabled = true;
        });
      }
      setStatus(status, '저장은 완료됐지만 목록을 새로고침하지 못했습니다. 중복 처리를 막기 위해 이 동작은 비활성화했습니다. 페이지를 새로고침해 상태를 확인해 주세요.', true);
    }
  }

  function renderDenied() {
    clear(root);
    root.setAttribute('aria-busy', 'false');
    Array.prototype.forEach.call(document.querySelectorAll('[data-app-count]'), function (counter) {
      counter.textContent = '권한 조회 불가';
      counter.classList.add('is-unavailable');
    });
    root.appendChild(el('div', 'admin-alert admin-alert--error', '관리자 권한이 확인되지 않았습니다. 권한 데이터와 입력 폼을 숨겼습니다. 다시 로그인한 뒤 새로고침해 주세요.'));
  }

  function renderLoadError() {
    clear(root);
    root.setAttribute('aria-busy', 'false');
    Array.prototype.forEach.call(document.querySelectorAll('[data-app-count]'), function (counter) {
      counter.textContent = '권한 조회 실패';
    });
    var box = el('div', 'admin-empty admin-empty--error');
    box.appendChild(el('h3', '', '권한 목록을 불러오지 못했습니다'));
    box.appendChild(el('p', '', state.loadError || '관리자 세션과 권한 서비스를 확인해 주세요.'));
    box.appendChild(button('다시 불러오기', 'admin-button', function () {
      root.setAttribute('aria-busy', 'true');
      refresh(false);
    }));
    root.appendChild(box);
  }

  function renderTabs() {
    var approved = state.data.approved.length;
    var pending = state.data.pending.length;
    var tabs = el('div', 'admin-view-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '권한 목록 상태');
    [
      { id: 'pending', label: '승인 대기', count: pending },
      { id: 'approved', label: '승인 완료', count: approved }
    ].forEach(function (tab) {
      var control = button('', 'admin-view-tab' + (state.tab === tab.id ? ' is-active' : ''), function () {
        state.tab = tab.id;
        render();
      });
      control.setAttribute('role', 'tab');
      control.setAttribute('aria-selected', state.tab === tab.id ? 'true' : 'false');
      control.appendChild(document.createTextNode(tab.label));
      var count = el('span', 'admin-view-tab__count', String(tab.count));
      control.appendChild(count);
      tabs.appendChild(control);
    });
    return tabs;
  }

  function appFilter() {
    var choices = [{ value: '*', label: '모든 앱' }].concat(model.APP_CATALOG.map(function (app) {
      return { value: app.id, label: app.name };
    }));
    var select = selectControl('appFilter', choices, state.tool);
    select.setAttribute('aria-label', '앱별 권한 필터');
    select.addEventListener('change', function () {
      state.tool = select.value;
      render();
    });
    return select;
  }

  function searchControl() {
    var search = textInput('search', 'search', '이메일, 이름, 닉네임 검색', false);
    search.value = state.query;
    search.setAttribute('aria-label', '이메일, 이름 또는 닉네임 검색');
    search.addEventListener('input', function () {
      state.query = search.value;
      var cursor = search.selectionStart;
      renderList();
      var replacement = root.querySelector('[name="search"]');
      if (replacement) {
        replacement.focus();
        replacement.setSelectionRange(cursor, cursor);
      }
    });
    return search;
  }

  function filtersRow() {
    var filters = el('div', 'admin-list-filters');
    filters.appendChild(searchControl());
    filters.appendChild(appFilter());
    return filters;
  }

  function makeLifetime() {
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'lifetime';
    var label = el('label', 'admin-checkbox');
    label.appendChild(input);
    label.appendChild(el('span', '', '평생 권한'));
    return { input: input, label: label };
  }

  function addForm(availability) {
    var card = el('section', 'admin-grant-card');
    card.setAttribute('aria-labelledby', 'admin-grant-title');
    var heading = el('div', 'admin-grant-card__heading');
    heading.appendChild(el('span', 'admin-card-kicker', 'NEW ACCESS'));
    heading.appendChild(el('h3', '', '앱 권한 추가'));
    heading.appendChild(el('p', '', '이메일 주소와 앱을 선택해 바로 접근 권한을 부여합니다.'));
    card.appendChild(heading);
    var form = el('form', 'admin-grant-form');
    var email = textInput('email', 'email', 'name@example.com', true);
    email.autocomplete = 'email';
    form.appendChild(labeledControl('Google 계정 이메일', email, 'admin-grant-email'));
    var options = availableOptions(availability, true);
    var selected = options.length ? options[0].value : '';
    var tool = selectControl('tool', options, selected);
    tool.required = true;
    form.appendChild(labeledControl('부여할 앱', tool, 'admin-grant-tool'));
    var note = textInput('text', 'note', '예: 구매 확인, 초대 대상', false);
    form.appendChild(labeledControl('메모 (선택)', note, 'admin-grant-note'));
    var lifetime = makeLifetime();
    form.appendChild(lifetime.label);
    var submit = el('button', 'admin-button admin-button--gold', '권한 추가');
    submit.type = 'submit';
    form.appendChild(submit);
    var status = el('p', 'admin-action-status');
    status.setAttribute('role', 'status');
    form.appendChild(status);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      runMutation(status, submit, '권한을 추가하고 있습니다.', function () {
        return fetchJson(endpoint, {
          method: 'POST',
          body: JSON.stringify({ action: 'add', email: email.value.trim(), tool: tool.value, note: note.value.trim(), lifetime: lifetime.input.checked })
        });
      });
    });
    var unavailable = options.length === 0;
    if (unavailable) {
      setAllDisabled(form, true);
      setStatus(status, '사용할 수 있는 권한 서비스가 없습니다.', true);
    }
    card.appendChild(form);
    return card;
  }

  function personDetails(item) {
    var details = [];
    if (item.displayName) details.push('Google 이름 ' + item.displayName);
    if (item.nickname) details.push('닉네임 ' + item.nickname);
    return details.length ? details.join(' · ') : '이름 정보 없음';
  }

  function toolBadge(item) {
    var badge = el('span', 'admin-tool-badge', model.toolLabel(item.tool));
    return badge;
  }

  function pendingCard(item, availability) {
    var card = el('article', 'admin-access-card');
    var top = el('div', 'admin-access-card__top');
    var identity = el('div', 'admin-access-card__identity');
    identity.appendChild(el('h3', '', item.email || '이메일 없음'));
    identity.appendChild(el('p', '', personDetails(item)));
    top.appendChild(identity);
    top.appendChild(toolBadge(item));
    card.appendChild(top);
    card.appendChild(el('p', 'admin-access-card__date', '요청 ' + formatDate(item.requestedAt || item.createdAt, true)));
    var form = el('div', 'admin-access-card__controls');
    var choices = model.pendingToolOptions(item, availability).map(function (toolId) {
      return { value: toolId, label: model.toolLabel(toolId) };
    });
    if (!choices.length) choices = [{ value: item.tool || '', label: model.toolLabel(item.tool) }];
    var tool = selectControl('tool', choices, item.tool || choices[0].value);
    tool.setAttribute('aria-label', (item.email || '계정') + ' 승인 앱 선택');
    var note = textInput('text', 'note', '승인 메모 (선택)', false);
    note.setAttribute('aria-label', (item.email || '계정') + ' 승인 메모');
    var lifetime = makeLifetime();
    var status = el('p', 'admin-action-status');
    status.setAttribute('role', 'status');
    var approve = button('승인', 'admin-button admin-button--gold');
    approve.addEventListener('click', function () {
      runMutation(status, approve, '권한을 승인하고 있습니다.', function () {
        return fetchJson(endpoint, { method: 'POST', body: JSON.stringify({ action: 'approve', id: item.id, tool: tool.value, lifetime: lifetime.input.checked, note: note.value.trim() }) });
      });
    });
    var reject = button('요청 삭제', 'admin-button admin-button--quiet');
    reject.addEventListener('click', function () {
      if (!window.confirm((item.email || '이 계정') + '의 권한 요청을 삭제할까요?')) return;
      runMutation(status, reject, '요청을 삭제하고 있습니다.', function () {
        return fetchJson(endpoint + '?id=' + encodeURIComponent(item.id) + '&tool=' + encodeURIComponent(item.tool || ''), { method: 'DELETE' });
      });
    });
    var isUnavailable = !model.isPendingActionAvailable(item, tool.value, availability);
    if (isUnavailable) {
      tool.disabled = true;
      approve.disabled = true;
      reject.disabled = true;
      setStatus(status, item.tool ? '이 앱의 권한 서비스가 중단되어 승인과 삭제를 잠시 사용할 수 없습니다.' : '계산기·스톱워치 권한 서비스가 중단되어 이 기존 요청을 처리할 수 없습니다.', true);
    }
    tool.addEventListener('change', function () {
      var canAct = model.isPendingActionAvailable(item, tool.value, availability);
      approve.disabled = !canAct;
      reject.disabled = !canAct;
      if (canAct) status.textContent = '';
    });
    form.appendChild(tool);
    form.appendChild(note);
    form.appendChild(lifetime.label);
    form.appendChild(approve);
    form.appendChild(reject);
    card.appendChild(form);
    card.appendChild(status);
    return card;
  }

  function approvedCard(item, availability) {
    var card = el('article', 'admin-access-card');
    var top = el('div', 'admin-access-card__top');
    var identity = el('div', 'admin-access-card__identity');
    identity.appendChild(el('h3', '', item.email || '이메일 없음'));
    identity.appendChild(el('p', '', personDetails(item)));
    top.appendChild(identity);
    top.appendChild(toolBadge(item));
    card.appendChild(top);
    var meta = el('div', 'admin-access-card__meta');
    meta.appendChild(el('span', '', item.lifetime ? '평생 권한' : '기간 권한'));
    meta.appendChild(el('span', '', '등록 ' + formatDate(item.createdAt, false)));
    card.appendChild(meta);
    if (item.note) card.appendChild(el('p', 'admin-access-card__note', item.note));
    var availableToAdd = model.additionalToolOptions(item, state.data.approved, availability);
    var grantForm = el('form', 'admin-access-card__grant');
    var grantLabel = el('label', 'admin-field');
    grantLabel.appendChild(el('span', 'admin-field__label', '이 계정에 앱 권한 추가'));
    var grantSelect = selectControl('additionalTool', availableToAdd.map(function (toolId) {
      return { value: toolId, label: model.toolLabel(toolId) };
    }), availableToAdd[0]);
    grantSelect.setAttribute('aria-label', (item.email || '계정') + ' 추가할 앱');
    grantLabel.appendChild(grantSelect);
    grantForm.appendChild(grantLabel);
    var grantLifetime = makeLifetime();
    grantForm.appendChild(grantLifetime.label);
    var grantButton = el('button', 'admin-button admin-button--gold', '권한 추가');
    grantButton.type = 'submit';
    grantForm.appendChild(grantButton);
    var grantStatus = el('p', 'admin-action-status');
    grantStatus.setAttribute('role', 'status');
    grantForm.appendChild(grantStatus);
    if (availableToAdd.length) {
      grantForm.addEventListener('submit', function (event) {
        event.preventDefault();
        runMutation(grantStatus, grantButton, '권한을 추가하고 있습니다.', function () {
          return fetchJson(endpoint, { method: 'POST', body: JSON.stringify({
            action: 'addToPerson', email: item.email, tool: grantSelect.value,
            lifetime: grantLifetime.input.checked
          }) });
        });
      });
    } else {
      grantSelect.disabled = true;
      grantLifetime.input.disabled = true;
      grantButton.disabled = true;
      setStatus(grantStatus, '추가할 수 있는 앱 권한이 없습니다.', true);
    }
    card.appendChild(grantForm);
    var status = el('p', 'admin-action-status');
    status.setAttribute('role', 'status');
    var revoke = button('권한 회수', 'admin-button admin-button--quiet');
    revoke.setAttribute('aria-label', (item.email || '계정') + '의 ' + model.toolLabel(item.tool) + ' 권한 회수');
    revoke.addEventListener('click', function () {
      if (!window.confirm((item.email || '이 계정') + '의 ' + model.toolLabel(item.tool) + ' 권한을 회수할까요?')) return;
      runMutation(status, revoke, '권한을 회수하고 있습니다.', function () {
        return fetchJson(endpoint + '?id=' + encodeURIComponent(item.id) + '&tool=' + encodeURIComponent(item.tool || ''), { method: 'DELETE' });
      });
    });
    if (!model.isToolAvailable(item.tool, availability)) {
      revoke.disabled = true;
      setStatus(status, '이 앱의 권한 서비스가 중단되어 회수를 잠시 사용할 수 없습니다.', true);
    }
    var actions = el('div', 'admin-access-card__actions');
    actions.appendChild(revoke);
    card.appendChild(actions);
    card.appendChild(status);
    return card;
  }

  function renderList() {
    var list = root.querySelector('[data-access-list]');
    if (!list || !state.data) return;
    clear(list);
    var allRows = state.tab === 'pending' ? state.data.pending : state.data.approved;
    var rows = model.filterRows(allRows, { query: state.query, tool: state.tool });
    if (!rows.length) {
      var empty = el('div', 'admin-empty');
      empty.appendChild(el('span', 'admin-empty__mark', state.query || state.tool !== '*' ? '⌕' : '✓'));
      empty.appendChild(el('h3', '', state.query || state.tool !== '*' ? '조건에 맞는 계정이 없습니다' : (state.tab === 'pending' ? '승인을 기다리는 계정이 없습니다' : '등록된 권한이 없습니다')));
      empty.appendChild(el('p', '', state.query || state.tool !== '*' ? '검색어나 앱 필터를 바꿔 다시 확인해 보세요.' : (state.tab === 'pending' ? '새 요청이 들어오면 이곳에서 확인할 수 있습니다.' : '새 권한은 이 화면에서 추가할 수 있습니다.')));
      list.appendChild(empty);
      return;
    }
    var availability = model.availabilityFromResponse(state.data);
    rows.forEach(function (item) {
      list.appendChild(state.tab === 'pending' ? pendingCard(item, availability) : approvedCard(item, availability));
    });
  }

  function render() {
    var data = state.data;
    var availability = model.availabilityFromResponse(data);
    if (!availability.legacy && !availability.friendApps) {
      state.loadError = '모든 앱 권한 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
      renderLoadError();
      return;
    }
    var approvedCounts = model.countByTool(data.approved);
    Array.prototype.forEach.call(document.querySelectorAll('[data-app-count]'), function (counter) {
      var appId = counter.getAttribute('data-app-count');
      if (!model.isToolAvailable(appId, availability)) {
        counter.textContent = '권한 조회 불가';
        counter.classList.add('is-unavailable');
      } else {
        counter.textContent = approvedCounts[appId] + '개 권한';
        counter.classList.remove('is-unavailable');
      }
    });
    root.setAttribute('aria-busy', 'false');
    clear(root);
    var warningText = model.availabilityMessage(availability);
    if (warningText) {
      var warning = el('div', 'admin-alert admin-alert--warning', warningText);
      warning.setAttribute('role', 'status');
      root.appendChild(warning);
    }
    var refreshStatus = el('p', 'admin-action-status admin-refresh-status');
    refreshStatus.setAttribute('data-refresh-error', '');
    refreshStatus.setAttribute('role', 'status');
    root.appendChild(refreshStatus);
    root.appendChild(renderTabs());
    if (state.tab === 'approved') root.appendChild(addForm(availability));
    var listHead = el('div', 'admin-list-heading');
    var count = state.tab === 'pending' ? data.pending.length : data.approved.length;
    listHead.appendChild(el('h3', '', (state.tab === 'pending' ? '승인 대기 계정' : '승인된 계정')));
    listHead.appendChild(el('span', 'admin-list-total', count + '개 계정'));
    var refreshButton = button('새로고침', 'admin-button admin-button--quiet', function () {
      refreshStatus.textContent = '';
      refresh(true);
    });
    refreshButton.setAttribute('aria-label', '권한 목록 새로고침');
    listHead.appendChild(refreshButton);
    root.appendChild(listHead);
    root.appendChild(filtersRow());
    root.appendChild(el('div', 'admin-access-list'));
    root.lastElementChild.setAttribute('data-access-list', '');
    renderList();
  }

  function copyFallback(text) {
    var input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    var copied = document.execCommand('copy');
    input.remove();
    return copied;
  }

  function bindCopyLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy-link]'), function (control) {
      control.addEventListener('click', async function () {
        var path = control.getAttribute('data-copy-link');
        var value = new URL(path, window.location.origin).toString();
        var copied = false;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            copied = true;
          } else {
            copied = copyFallback(value);
          }
        } catch (_) {
          copied = copyFallback(value);
        }
        control.textContent = copied ? '복사됨' : '복사 실패';
        control.setAttribute('aria-label', copied ? '배포 링크를 복사했습니다' : '배포 링크 복사에 실패했습니다');
        window.setTimeout(function () {
          control.textContent = '복사';
          control.setAttribute('aria-label', path + ' 배포 링크 복사');
        }, 1800);
      });
    });
  }

  async function start() {
    bindCopyLinks();
    try {
      if (!window.AdminSession || !window.AdminSession.ready) throw new Error('관리자 세션 모듈을 불러오지 못했습니다.');
      var authorized = await window.AdminSession.ready;
      if (authorized !== true) {
        root.setAttribute('aria-busy', 'false');
        clear(root);
        root.appendChild(el('div', 'admin-alert admin-alert--neutral', '관리자 로그인이 확인되면 앱 권한 목록이 표시됩니다.'));
        Array.prototype.forEach.call(document.querySelectorAll('[data-app-count]'), function (counter) {
          counter.textContent = '로그인 후 표시';
        });
        return;
      }
      root.setAttribute('aria-busy', 'true');
      clear(root);
      root.appendChild(el('p', 'admin-loading', '앱 권한을 불러오고 있습니다.'));
      await refresh(false);
    } catch (error) {
      state.loadError = error.message || '관리자 세션 확인에 실패했습니다.';
      renderLoadError();
    }
  }

  start();
})();
