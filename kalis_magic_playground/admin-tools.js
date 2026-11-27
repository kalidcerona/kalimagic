(function () {
  'use strict';

  var root = document.querySelector('[data-tools-root]');
  var authPanel = document.querySelector('[data-auth-panel]');
  var model = window.AdminAppModel;
  if (!root || !authPanel || !window.PgUtil || !model) return;

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;
  var endpoint = '/.netlify/functions/admin-tools?v=2';
  var state = { data: null, members: { pending: [], approved: [] }, tab: 'grant', batch: false, draftTouched: false, requestDrafts: new Map(), draft: { email: '', tools: [], note: '', lifetime: false }, query: '', tool: '*', loadError: '', selected: new Set(), pendingTools: new Map(), batchTools: new Set(), batchLifetime: false, busy: false };
  var permissionRefreshEpoch = 0;
  var MAX_BATCH_MEMBERS = 25;

  function clearSelection() {
    state.selected.clear();
    state.pendingTools.clear();
    state.batchTools.clear();
    state.batchLifetime = false;
  }

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
    select.value = selected;
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

  function adminToolLabel(tool) {
    if (tool === 'stopwatch') return '카이로스(KAIROS) · 스톱워치';
    if (tool === 'stopwatch-uni') return '카이로스(KAIROS) · 통합 루틴 타이머';
    return model.toolLabel(tool);
  }

  function setAllDisabled(form, disabled) {
    Array.prototype.forEach.call(form.elements, function (control) {
      control.disabled = disabled;
    });
  }

  function permissionSnapshot(data) {
    return JSON.stringify({
      pending: data.pending,
      approved: data.approved,
      availability: data.availability || null,
      warnings: data.warnings || []
    });
  }

  async function refresh(preserveOnFailure) {
    var epoch = ++permissionRefreshEpoch;
    try {
      var data = await fetchJson(endpoint, { cache: 'no-store' });
      if (epoch !== permissionRefreshEpoch) return true;
      if (!Array.isArray(data.pending) || !Array.isArray(data.approved)) {
        throw new Error('권한 목록 응답 형식이 올바르지 않습니다.');
      }
      var unchanged = Boolean(state.data) && permissionSnapshot(state.data) === permissionSnapshot(data);
      state.data = data;
      state.members.pending = model.groupMembers(data.pending);
      state.members.approved = model.groupMembers(data.approved);
      var currentEmails = new Set((state.members[state.tab] || []).map(function (member) { return member.email; }));
      state.selected.forEach(function (email) { if (!currentEmails.has(email)) state.selected.delete(email); });
      state.loadError = '';
      if (!unchanged) render();
      return true;
    } catch (error) {
      if (epoch !== permissionRefreshEpoch) return true;
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

  function accessEmailKey(email) {
    return String(email || '').trim().toLowerCase();
  }

  function updateAccessCounts() {
    if (!state.data) return;
    var availability = model.availabilityFromResponse(state.data);
    var approvedCounts = model.countByTool(state.data.approved);
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
    var tabCounts = root.querySelectorAll('.admin-view-tab__count');
    if (tabCounts[0]) tabCounts[0].textContent = String(state.members.pending.length);
    if (tabCounts[1]) tabCounts[1].textContent = String(state.members.approved.length);
    var heading = root.querySelector('.admin-list-heading .admin-list-total');
    if (heading) heading.textContent = (state.members[state.tab] || []).length + '개 계정';
  }

  function replaceAccessCard(email, control) {
    state.members.pending = model.groupMembers(state.data.pending);
    state.members.approved = model.groupMembers(state.data.approved);
    updateAccessCounts();
    if (state.tab === 'grant') { render(); return; }
    var member = (state.members[state.tab] || []).find(function (entry) {
      return accessEmailKey(entry.email) === accessEmailKey(email);
    });
    var card = control && typeof control.closest === 'function' ? control.closest('.admin-access-card') : null;
    if (!card || !member) {
      renderList();
      return;
    }
    var availability = model.availabilityFromResponse(state.data);
    card.replaceWith(state.tab === 'pending' ? pendingMemberCard(member, availability) : approvedCard(member, availability));
    renderBatchToolbar();
  }

  function applyLocalPermissionRow(change, control) {
    if (!state.data || !change || !change.item) return false;
    if (change.action === 'approve') {
      // A changed selection can affect sibling rows; reload the authoritative projection.
      if (change.tool !== change.item.tool) return false;
      var current = state.data.pending.find(function (row) { return row.id === change.item.id && row.tool === change.item.tool; });
      if (!current) return false;
      state.data.pending = state.data.pending.filter(function (row) { return !(row.id === change.item.id && row.tool === change.item.tool); });
      state.data.approved = state.data.approved.concat([Object.assign({}, current, {
        tool: change.tool,
        lifetime: Boolean(change.lifetime),
        note: change.note || '',
        status: 'approved'
      })]);
    } else if (change.action === 'reject') {
      var pendingBefore = state.data.pending.length;
      state.data.pending = state.data.pending.filter(function (row) { return !(row.id === change.item.id && row.tool === change.item.tool); });
      if (state.data.pending.length === pendingBefore) return false;
    } else if (change.action === 'revoke') {
      var approvedBefore = state.data.approved.length;
      state.data.approved = state.data.approved.filter(function (row) { return !(row.id === change.item.id && row.tool === change.item.tool); });
      if (state.data.approved.length === approvedBefore) return false;
    } else return false;
    // Drop an in-flight list GET so it cannot paint over the row just updated locally.
    permissionRefreshEpoch += 1;
    replaceAccessCard(change.item.email, control);
    return true;
  }

  async function runMutation(status, control, busyMessage, run) {
    var resultKey = status.getAttribute('data-row-result');
    var oldCard = control.closest('.admin-access-card');
    var listBefore = root.querySelector('[data-access-list]');
    var resultIndex = oldCard && listBefore ? Array.prototype.indexOf.call(listBefore.children, oldCard) : 0;
    status.classList.remove('is-error', 'is-success');
    status.textContent = busyMessage;
    if (state.busy) return;
    state.busy = true;
    control.disabled = true;
    var result;
    try {
      result = await run();
      state.busy = false;
    } catch (error) {
      state.busy = false;
      var message = actionError(error);
      if (message) setStatus(status, message, true);
      if (error.status !== 403) control.disabled = false;
      return;
    }

    var localRow = result && result.localRow;
    var applied = localRow && applyLocalPermissionRow(localRow, control);
    var updated = applied || await refresh(true);
    if (updated && localRow) {
      var list = root.querySelector('[data-access-list]');
      var message = localRow.item.email + ' · ' + adminToolLabel(localRow.tool || localRow.item.tool) + ' 처리 완료';
      if (list) {
        var done = el('p', 'admin-action-status is-success', message);
        done.setAttribute('role', 'status');
        if (list.insertBefore) list.insertBefore(done, list.children[resultIndex] || null);
        else list.appendChild(done);
      } else {
        var grantResult = root.querySelector('[data-grant-result]');
        if (grantResult) setStatus(grantResult, message, false);
      }
      return;
    }
    if (updated && resultKey) {
      Array.prototype.forEach.call(root.querySelectorAll('[data-row-result]'), function (node) {
        if (node.getAttribute('data-row-result') === resultKey) setStatus(node, '평생 권한으로 변경했습니다.', false);
      });
    }
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
    var approved = state.members.approved.length;
    var pending = state.members.pending.length;
    var tabs = el('div', 'admin-view-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '권한 목록 상태');
    [
      { id: 'grant', label: '권한 주기', count: '' },
      { id: 'pending', label: '신청 보기', count: pending },
      { id: 'approved', label: '권한 찾기', count: approved }
    ].forEach(function (tab) {
      var control = button('', 'admin-view-tab' + (state.tab === tab.id ? ' is-active' : ''), function () {
        clearSelection();
        state.tab = tab.id;
        state.batch = false;
        render();
        refresh(true);
      });
      control.setAttribute('role', 'tab');
      control.setAttribute('aria-selected', state.tab === tab.id ? 'true' : 'false');
      control.appendChild(document.createTextNode(tab.label));
      var count = el('span', 'admin-view-tab__count', String(tab.count));
      if (tab.count !== '') control.appendChild(count);
      tabs.appendChild(control);
    });
    return tabs;
  }

  function appFilter() {
    var choices = [{ value: '*', label: '모든 앱' }].concat(model.APP_CATALOG.map(function (app) {
      return { value: app.id, label: adminToolLabel(app.id) };
    }));
    var select = selectControl('appFilter', choices, state.tool);
    select.setAttribute('aria-label', '앱별 권한 필터');
    select.addEventListener('change', function () {
      clearSelection();
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
      clearSelection();
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

  function toolChecks(options) {
    var fieldset = el('fieldset', 'admin-tool-choices');
    fieldset.appendChild(el('legend', 'admin-field__label', '부여할 앱 선택'));
    options.forEach(function (toolId) {
      var label = el('label', 'admin-checkbox');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'tools';
      input.value = toolId;
      label.appendChild(input);
      label.appendChild(el('span', '', adminToolLabel(toolId)));
      fieldset.appendChild(label);
    });
    return fieldset;
  }

  function selectedTools(fieldset) {
    return Array.prototype.map.call(fieldset.querySelectorAll('input:checked'), function (input) { return input.value; });
  }

  function visibleMembers() {
    return model.filterMembers(state.members[state.tab], { query: state.query, tool: state.tool });
  }

  function batchEntries(availability) {
    return visibleMembers().filter(function (member) { return state.selected.has(member.email); }).map(function (member) {
      var tools = state.tab === 'pending'
        ? Array.from(state.pendingTools.get(member.email) || []).filter(function (tool) { return model.pendingBulkTools(member, availability).indexOf(tool) !== -1; })
        : Array.from(state.batchTools).filter(function (tool) { return model.missingTools(member, availability).indexOf(tool) !== -1; });
      return { email: member.email, tools: tools };
    }).filter(function (member) { return member.tools.length; });
  }

  function confirmGrant(entries, lifetime) {
    var accounts = entries.map(function (entry) {
      return entry.email + ': ' + entry.tools.map(adminToolLabel).join(', ');
    });
    return window.PgUtil.confirmAction(accounts.join('\n') + '\n기간: ' + (lifetime ? '평생' : '3개월') + '\n권한을 저장할까요?', '권한 저장');
  }

  async function submitMemberBatch(entries, mode, lifetime, note, trigger) {
    if (state.busy || !entries.length || entries.length > MAX_BATCH_MEMBERS) return;
    state.busy = true;
    trigger.disabled = true;
    var notice = root.querySelector('[data-batch-result]');
    setStatus(notice, '계정별 앱 권한을 저장하고 있습니다.', false);
    try {
      var response = await fetchJson(endpoint, { method: 'POST', body: JSON.stringify({
        action: 'grantMembers', mode: mode, members: entries, lifetime: lifetime, note: note
      }) });
      var results = response.results || [];
      if (results.length !== entries.length || results.some(function (member, index) {
        return member.email !== entries[index].email || !Array.isArray(member.results) || member.results.length !== entries[index].tools.length;
      })) throw new Error('일괄 승인 결과를 확인할 수 없습니다. 목록을 새로고침해 주세요.');
      var failed = results.map(function (member) {
        return { email: member.email, results: member.results.filter(function (item) { return item.outcome === 'failed'; }) };
      }).filter(function (member) { return member.results.length; });
      var completed = results.reduce(function (count, member) { return count + member.results.filter(function (item) { return item.outcome === 'granted'; }).length; }, 0);
      var existing = results.reduce(function (count, member) { return count + member.results.filter(function (item) { return item.outcome !== 'granted' && item.outcome !== 'failed'; }).length; }, 0);
      clearSelection();
      state.busy = false;
      var updated = await refresh(true);
      if (!updated) { setStatus(notice, '저장은 완료됐지만 목록 확인에 실패했습니다.', true); notice.appendChild(button('저장 결과 다시 확인', 'admin-button', function () { refresh(true); })); return; }
      render();
      notice = root.querySelector('[data-batch-result]');
      if (failed.length) {
        var failures = failed.reduce(function (count, member) { return count + member.results.length; }, 0);
        var details = failed.map(function (member) {
          return member.email + ' (' + member.results.map(function (item) { return adminToolLabel(item.tool); }).join(', ') + ')';
        }).join('; ');
        setStatus(notice, completed + '개 새로 부여 · ' + existing + '개 이미 보유 · ' + failures + '건 실패: ' + details + '. 목록을 확인해 주세요.', true);
        var retryable = failed.map(function (member) {
          return { email: member.email, tools: member.results.filter(function (item) { return item.error !== 'not_eligible'; }).map(function (item) { return item.tool; }) };
        }).filter(function (member) { return member.tools.length; });
        if (retryable.length) {
          var retry = button('일시적 실패 재시도', 'admin-button admin-button--quiet', async function () {
            var retryLifetime = state.batchLifetime;
            if (await confirmGrant(retryable, retryLifetime)) submitMemberBatch(retryable, mode, retryLifetime, note, retry);
          });
          notice.appendChild(document.createTextNode(' '));
          notice.appendChild(retry);
        }
      } else setStatus(notice, completed + '개 새로 부여 · ' + existing + '개 이미 보유', false);
    } catch (error) {
      state.busy = false;
      var message = actionError(error);
      if (message) setStatus(notice, message, true);
      if (error.status !== 403) trigger.disabled = false;
    } finally {
      state.busy = false;
    }
  }

  function renderBatchToolbar() {
    var host = root.querySelector('[data-batch-toolbar]');
    if (!host || !state.data) return;
    if (!state.batch) { clear(host); return; }
    clear(host);
    var availability = model.availabilityFromResponse(state.data);
    var visible = visibleMembers().filter(function (member) {
      return member.email && (state.tab === 'pending' ? model.pendingBulkTools(member, availability).length : model.missingTools(member, availability).length);
    });
    var selectedCount = visible.filter(function (member) { return state.selected.has(member.email); }).length;
    host.appendChild(el('strong', '', selectedCount + '명 선택'));
    host.appendChild(button(visible.length > MAX_BATCH_MEMBERS ? '현재 목록에서 최대 25명 선택' : '현재 목록 전체 선택', 'admin-button admin-button--quiet', function () {
      state.selected = model.replaceVisibleSelection(state.selected, visible, MAX_BATCH_MEMBERS);
      renderList();
    }));
    host.appendChild(button('선택 해제', 'admin-button admin-button--quiet', function () { clearSelection(); renderList(); }));
    if (visible.length > MAX_BATCH_MEMBERS) host.appendChild(el('span', 'admin-batch-toolbar__hint', '한 번에 최대 ' + MAX_BATCH_MEMBERS + '명만 선택할 수 있습니다.'));
    if (state.tab === 'approved') {
      var choices = toolChecks(availableOptions(availability, false).map(function (item) { return item.value; }));
      choices.querySelector('legend').textContent = '선택 계정에 추가할 앱';
      Array.prototype.forEach.call(choices.querySelectorAll('input'), function (input) {
        input.checked = state.batchTools.has(input.value);
        input.addEventListener('change', function () {
          if (input.checked) state.batchTools.add(input.value); else state.batchTools.delete(input.value);
          renderBatchToolbar();
        });
      });
      host.appendChild(choices);
    }
    var entries = batchEntries(availability);
    var appCount = entries.reduce(function (count, member) { return count + member.tools.length; }, 0);
    host.appendChild(el('span', 'admin-batch-toolbar__summary', entries.length + '명 · ' + appCount + '개 앱 권한 대상'));
    var lifetime = makeLifetime();
    lifetime.input.checked = state.batchLifetime;
    lifetime.input.addEventListener('change', function () { state.batchLifetime = lifetime.input.checked; });
    host.appendChild(lifetime.label);
    var submit = button(state.tab === 'pending' ? '선택 계정의 선택 앱 승인' : '선택 계정에 앱 추가', 'admin-button admin-button--gold', async function () {
      if (!await confirmGrant(entries, lifetime.input.checked)) return;
      submitMemberBatch(entries, state.tab, lifetime.input.checked, '', submit);
    });
    submit.disabled = !appCount || state.busy;
    host.appendChild(submit);
    var result = el('p', 'admin-action-status');
    result.setAttribute('data-batch-result', '');
    result.setAttribute('role', 'status');
    host.appendChild(result);
  }

  async function grantBulk(email, tools, lifetime, note, status, submit) {
    if (state.busy || !tools.length) return;
    state.busy = true;
    submit.disabled = true;
    setStatus(status, '선택한 앱 권한을 저장하고 있습니다.', false);
    try {
      var response = await fetchJson(endpoint, { method: 'POST', body: JSON.stringify({ action: 'grantBulk', email: email, tools: tools, lifetime: lifetime, note: note }) });
      var results = response.results || [];
      if (results.length !== tools.length) throw new Error('저장 결과를 확인할 수 없습니다. 목록을 다시 확인해 주세요.');
      var failed = results.filter(function (entry) { return entry.outcome === 'failed'; }).map(function (entry) { return entry.tool; });
      state.draft.tools = failed;
      state.draft.lifetime = false;
      state.busy = false;
      var updated = await refresh(true);
      if (updated) render();
      var notice = root.querySelector('[data-grant-result]') || status;
      setStatus(notice, results.filter(function (entry) { return entry.outcome === 'granted'; }).length + '개 새로 부여 · ' + results.filter(function (entry) { return entry.outcome !== 'granted' && entry.outcome !== 'failed'; }).length + '개 이미 보유 · ' + failed.length + '개 실패' + (failed.length ? ': ' + failed.map(adminToolLabel).join(', ') : '') + (updated ? '' : ' · 저장 후 목록 확인에 실패했습니다.'), failed.length > 0 || !updated);
      if (failed.length) notice.appendChild(button('실패한 앱 재시도', 'admin-button', async function () {
        var retryLifetime = state.draft.lifetime;
        if (await confirmGrant([{ email: email, tools: failed }], retryLifetime)) grantBulk(email, failed, retryLifetime, note, notice, this);
      }));
      if (!updated) notice.appendChild(button('저장 결과 다시 확인', 'admin-button', function () { refresh(true); }));
    } catch (error) {
      state.busy = false;
      var message = actionError(error);
      if (message) setStatus(status, message, true);
    } finally {
      state.busy = false;
      submit.disabled = false;
    }
  }

  function addForm(availability) {
    var card = el('section', 'admin-grant-card admin-grant-workspace');
    card.appendChild(el('h3', '', '한 계정에 권한 주기'));
    var form = el('form', 'admin-grant-form');
    var draft = state.draft;
    var email = textInput('email', 'email', 'name@example.com', true);
    email.value = draft.email;
    email.autocomplete = 'email';
    form.appendChild(labeledControl('받을 Google 계정 이메일', email, 'admin-grant-email'));
    form.appendChild(button('내 계정 사용', 'admin-button admin-button--quiet', async function () {
      var session = await window.MagicAuth.getSession();
      if (session && session.user) { state.draftTouched = true; draft.email = session.user.email || ''; draft.tools = []; draft.lifetime = false; render(); }
    }));
    var selection = el('div', 'admin-grant-selection');
    var summary = el('p', 'admin-grant-summary');
    var status = el('p', 'admin-action-status');
    status.setAttribute('role', 'status');
    status.setAttribute('data-grant-result', '');
    var submit = el('button', 'admin-button admin-button--gold', '권한 주기');
    submit.type = 'submit';
    function updateSummary() {
      summary.textContent = (draft.email || '계정을 입력하세요') + ' · ' + draft.tools.length + '개 앱 · ' + (draft.lifetime ? '평생' : '3개월');
      submit.textContent = draft.tools.length + '개 앱에 ' + (draft.lifetime ? '평생' : '3개월') + ' 권한 주기';
      submit.disabled = !draft.email.trim() || !draft.tools.length || state.busy;
    }
    function drawChoices() {
      clear(selection);
      if (!draft.email.trim()) {
        selection.appendChild(el('p', 'admin-empty', '받을 계정의 이메일을 입력하거나 내 계정 사용을 누르면 추가할 수 있는 앱과 보유 권한이 표시됩니다.'));
        updateSummary();
        return;
      }
      var options = model.additionalToolOptions({ email: draft.email }, state.data.approved, availability);
      var previous = draft.tools.length;
      draft.tools = draft.tools.filter(function (tool) { return options.indexOf(tool) !== -1; });
      if (previous !== draft.tools.length) setStatus(status, '새로 보유하거나 사용할 수 없게 된 앱은 선택에서 제외했습니다.', false);
      selection.appendChild(button('추가할 수 있는 앱 모두 선택', 'admin-button admin-button--quiet', function () { draft.tools = options.slice(); drawChoices(); }));
      selection.appendChild(button('선택 해제', 'admin-button admin-button--quiet', function () { draft.tools = []; drawChoices(); }));
      var checks = toolChecks(options);
      Array.prototype.forEach.call(checks.querySelectorAll('input'), function (input) {
        input.checked = draft.tools.indexOf(input.value) !== -1;
        input.addEventListener('change', function () { draft.tools = selectedTools(checks); updateSummary(); });
      });
      selection.appendChild(checks);
      var owned = state.data.approved.filter(function (row) { return accessEmailKey(row.email) === accessEmailKey(draft.email); });
      if (owned.length) {
        var holdings = el('section', 'admin-owned-section');
        holdings.appendChild(el('h4', '', '보유 중인 앱 · 기간 변경은 별도 선택'));
        owned.forEach(function (row) { holdings.appendChild(approvedRow(row, availability)); });
        selection.appendChild(holdings);
      }
      updateSummary();
    }
    email.addEventListener('input', function () { setStatus(status, '', false); state.draftTouched = true; draft.email = email.value; draft.tools = []; draft.lifetime = false; lifetime.input.checked = false; drawChoices(); });
    form.appendChild(selection);
    var note = textInput('text', 'note', '구매 확인, 초대 대상 등', false);
    note.value = draft.note;
    note.addEventListener('input', function () { draft.note = note.value; });
    form.appendChild(labeledControl('메모 (선택)', note, 'admin-grant-note'));
    var lifetime = makeLifetime();
    lifetime.input.checked = draft.lifetime;
    lifetime.input.addEventListener('change', function () { draft.lifetime = lifetime.input.checked; updateSummary(); });
    form.appendChild(el('p', '', '기본 기간은 3개월입니다. 평생 권한은 저장할 때마다 직접 선택하세요.'));
    form.appendChild(lifetime.label);
    form.appendChild(summary);
    form.appendChild(submit);
    form.appendChild(status);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var tools = draft.tools.slice();
      if (tools.length > 1 && !await window.PgUtil.confirmAction(draft.email + '\n' + tools.map(adminToolLabel).join(', ') + '\n기간: ' + (draft.lifetime ? '평생' : '3개월') + '\n권한을 부여할까요?', '권한 부여')) return;
      grantBulk(draft.email.trim(), tools, draft.lifetime, draft.note.trim(), status, submit);
    });
    drawChoices();
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
    var badge = el('span', 'admin-tool-badge', adminToolLabel(item.tool));
    return badge;
  }

  function pendingCard(item, availability) {
    var key = item.id + ':' + (item.tool || '');
    var saved = state.requestDrafts.get(key) || { tool: item.tool || '', note: '', lifetime: false };
    state.requestDrafts.set(key, saved);
    var card = el('div', 'admin-pending-row');
    var top = el('div', 'admin-access-card__top');
    top.appendChild(toolBadge(item));
    card.appendChild(top);
    card.appendChild(el('p', 'admin-access-card__date', '요청 ' + formatDate(item.requestedAt || item.createdAt, true)));
    var form = el('div', 'admin-access-card__controls');
    var choices = model.pendingToolOptions(item, availability).map(function (toolId) {
      return { value: toolId, label: adminToolLabel(toolId) };
    });
    if (!choices.length) choices = [{ value: item.tool || '', label: adminToolLabel(item.tool) }];
    if (!item.tool) choices.unshift({ value: '', label: '앱을 선택하세요' });
    var tool = selectControl('tool', choices, saved.tool);
    tool.setAttribute('aria-label', (item.email || '계정') + ' 승인 앱 선택');
    var note = textInput('text', 'note', '승인 메모 (선택)', false);
    note.setAttribute('aria-label', (item.email || '계정') + ' 승인 메모');
    note.value = saved.note;
    note.addEventListener('input', function () { saved.note = note.value; });
    var lifetime = makeLifetime();
    lifetime.input.checked = saved.lifetime;
    lifetime.input.addEventListener('change', function () { saved.lifetime = lifetime.input.checked; });
    var status = el('p', 'admin-action-status');
    status.setAttribute('role', 'status');
    var approve = button('신청대로 승인', 'admin-button admin-button--gold');
    approve.addEventListener('click', async function () {
      if (state.busy || approve.disabled) return;
      var selectedTool = tool.value;
      var selectedLifetime = lifetime.input.checked;
      var selectedNote = note.value.trim();
      if (selectedTool === 'all') {
        approve.disabled = true;
        var confirmed = await window.PgUtil.confirmAction((item.email || '이 계정') + '\n' + adminToolLabel('all') + '\n기간: ' + (selectedLifetime ? '평생' : '3개월') + '\n두 앱을 승인할까요?', '두 앱 승인');
        approve.disabled = false;
        if (!confirmed) return;
      }
      runMutation(status, approve, '권한을 승인하고 있습니다.', async function () {
        await fetchJson(endpoint, { method: 'POST', body: JSON.stringify({ action: 'approve', id: item.id, tool: selectedTool, lifetime: selectedLifetime, note: selectedNote }) });
        return { localRow: { action: 'approve', item: item, tool: selectedTool, lifetime: selectedLifetime, note: selectedNote } };
      });
    });
    var reject = button('요청 삭제', 'admin-button admin-button--quiet');
    reject.addEventListener('click', async function () {
      if (!await window.PgUtil.confirmAction((item.email || '이 계정') + '의 ' + adminToolLabel(item.tool) + ' 권한 요청을 삭제할까요?', '요청 삭제')) return;
      runMutation(status, reject, '요청을 삭제하고 있습니다.', async function () {
        await fetchJson(endpoint + '&id=' + encodeURIComponent(item.id) + '&tool=' + encodeURIComponent(item.tool || ''), { method: 'DELETE' });
        return { localRow: { action: 'reject', item: item } };
      });
    });
    var isUnavailable = !model.isPendingActionAvailable(item, tool.value, availability);
    if (isUnavailable) {
      tool.disabled = choices.length < 2;
      approve.disabled = true;
      reject.disabled = !availability.legacy;
      setStatus(status, !item.tool && availability.legacy ? '승인할 앱을 먼저 선택하세요.' : item.tool ? '이 앱의 권한 서비스가 중단되어 승인과 삭제를 잠시 사용할 수 없습니다.' : '히츠젠(HITSUZEN)·카이로스(KAIROS) 권한 서비스가 중단되어 이 기존 요청을 처리할 수 없습니다.', true);
    }
    tool.addEventListener('change', function () {
      saved.tool = tool.value;
      var canAct = model.isPendingActionAvailable(item, tool.value, availability);
      approve.disabled = !canAct;
      reject.disabled = !canAct;
      if (canAct) status.textContent = '';
    });
    var details = el('details', 'admin-request-options');
    details.open = !item.tool;
    details.appendChild(el('summary', '', '내용 변경'));
    details.appendChild(tool);
    details.appendChild(note);
    details.appendChild(lifetime.label);
    card.appendChild(el('p', '', '기본 승인 · 3개월'));
    form.appendChild(details);
    form.appendChild(approve);
    form.appendChild(reject);
    card.appendChild(form);
    card.appendChild(status);
    return card;
  }

  function approvedRow(item, availability) {
    var row = el('div', 'admin-member-app-row');
    var info = el('div', 'admin-member-app-row__info');
    info.appendChild(toolBadge(item));
    info.appendChild(el('span', '', item.lifetime ? '평생 권한' : '기간 권한'));
    info.appendChild(el('span', '', '등록 ' + formatDate(item.createdAt, false)));
    if (item.note) info.appendChild(el('span', 'admin-member-app-row__note', item.note));
    row.appendChild(info);
    var status = el('p', 'admin-action-status');
    status.setAttribute('role', 'status');
    status.setAttribute('data-row-result', item.id + ':' + item.tool);
    var revoke = button('권한 회수', 'admin-button admin-button--quiet');
    revoke.setAttribute('aria-label', (item.email || '계정') + '의 ' + adminToolLabel(item.tool) + ' 권한 회수');
    revoke.addEventListener('click', async function () {
      if (!await window.PgUtil.confirmAction((item.email || '이 계정') + '의 ' + adminToolLabel(item.tool) + ' · ' + (item.lifetime ? '평생' : '3개월') + ' 권한을 회수할까요?', '권한 회수')) return;
      runMutation(status, revoke, '권한을 회수하고 있습니다.', async function () {
        await fetchJson(endpoint + '&id=' + encodeURIComponent(item.id) + '&tool=' + encodeURIComponent(item.tool || ''), { method: 'DELETE' });
        return { localRow: { action: 'revoke', item: item } };
      });
    });
    if (!model.isToolAvailable(item.tool, availability)) {
      revoke.disabled = true;
      setStatus(status, '이 앱의 권한 서비스가 중단되어 회수를 잠시 사용할 수 없습니다.', true);
    }
    if (!item.lifetime) {
      var convert = button('평생으로 변경', 'admin-button', async function () {
        if (!await window.PgUtil.confirmAction(item.email + ' · ' + adminToolLabel(item.tool) + '\n3개월 권한을 평생으로 변경할까요?', '평생으로 변경')) return;
        runMutation(status, convert, '기간을 변경하고 있습니다.', async function () {
          await fetchJson(endpoint, { method: 'POST', body: JSON.stringify({ action: 'lifetime', id: item.id, tool: item.tool }) });
        });
      });
      convert.disabled = !model.isToolAvailable(item.tool, availability);
      row.appendChild(convert);
    }
    row.appendChild(revoke);
    row.appendChild(status);
    return row;
  }

  function approvedCard(member, availability) {
    var card = el('article', 'admin-access-card');
    var top = el('div', 'admin-access-card__top');
    if (state.batch) top.appendChild(memberSelector(member, availability));
    var identity = el('div', 'admin-access-card__identity');
    identity.appendChild(el('h3', '', member.email || '이메일 없음'));
    identity.appendChild(el('p', '', personDetails(member)));
    top.appendChild(identity);
    top.appendChild(el('span', 'admin-list-total', member.tools.size + '개 앱'));
    card.appendChild(top);
    var portfolio = el('div', 'admin-member-portfolio');
    member.rows.forEach(function (item) { portfolio.appendChild(approvedRow(item, availability)); });
    card.appendChild(portfolio);
    card.appendChild(button('이 계정에 권한 주기', 'admin-button', function () {
      state.draft = { email: member.email, tools: [], note: '', lifetime: false };
      state.tab = 'grant'; render();
    }));
    return card;
  }

  function pendingMemberCard(member, availability) {
    var card = el('article', 'admin-access-card');
    if (state.batch) card.appendChild(memberSelector(member, availability));
    var identity = el('div', 'admin-access-card__identity');
    identity.appendChild(el('h3', '', member.email || '이메일 없음'));
    identity.appendChild(el('p', '', personDetails(member)));
    card.appendChild(identity);
    var bulkOptions = model.pendingBulkTools(member, availability);
    if (state.batch && bulkOptions.length && member.email) {
      var bulkForm = el('div', 'admin-access-card__grant admin-pending-bulk');
      var checks = toolChecks(bulkOptions);
      checks.querySelector('legend').textContent = '신청한 앱 중 승인할 앱 선택';
      checks.setAttribute('aria-label', member.email + ' 승인할 신청 앱');
      var saved = state.pendingTools.get(member.email);
      if (!saved) {
        saved = new Set();
        state.pendingTools.set(member.email, saved);
      }
      Array.prototype.forEach.call(checks.querySelectorAll('input'), function (input) {
        input.checked = saved.has(input.value);
        input.addEventListener('change', function () {
          var checked = input.checked;
          if (checked) saved.add(input.value); else saved.delete(input.value);
          renderBatchToolbar();
        });
      });
      bulkForm.appendChild(checks);

      card.appendChild(bulkForm);
    }
    var requests = el('div', 'admin-member-portfolio');
    if (!state.batch) member.rows.forEach(function (item) { requests.appendChild(pendingCard(item, availability)); });
    card.appendChild(requests);
    return card;
  }

  function memberSelector(member, availability) {
    var label = el('label', 'admin-member-select');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.selected.has(member.email);
    input.disabled = !member.email || !(state.tab === 'pending'
      ? model.pendingBulkTools(member, availability).length
      : model.missingTools(member, availability).length);
    input.setAttribute('aria-label', (member.email || '이메일 없는 계정') + ' 일괄 처리 선택');
    input.addEventListener('change', function () {
      if (input.checked && state.selected.size >= MAX_BATCH_MEMBERS) {
        input.checked = false;
        var notice = root.querySelector('[data-refresh-error]');
        if (notice) setStatus(notice, '한 번에 최대 ' + MAX_BATCH_MEMBERS + '명까지 선택할 수 있습니다.', true);
        return;
      }
      if (input.checked) state.selected.add(member.email); else state.selected.delete(member.email);
      renderBatchToolbar();
    });
    label.appendChild(input);
    label.appendChild(el('span', '', '계정 선택'));
    return label;
  }

  function renderList() {
    var list = root.querySelector('[data-access-list]');
    if (!list || !state.data) return;
    clear(list);
    var members = visibleMembers();
    if (!members.length) {
      var empty = el('div', 'admin-empty');
      empty.appendChild(el('span', 'admin-empty__mark', state.query || state.tool !== '*' ? '⌕' : '✓'));
      empty.appendChild(el('h3', '', state.query || state.tool !== '*' ? '조건에 맞는 계정이 없습니다' : (state.tab === 'pending' ? '승인을 기다리는 계정이 없습니다' : '등록된 권한이 없습니다')));
      empty.appendChild(el('p', '', state.query || state.tool !== '*' ? '검색어나 앱 필터를 바꿔 다시 확인해 보세요.' : (state.tab === 'pending' ? '새 요청이 들어오면 이곳에서 확인할 수 있습니다.' : '새 권한은 이 화면에서 추가할 수 있습니다.')));
      list.appendChild(empty);
      renderBatchToolbar();
      return;
    }
    var availability = model.availabilityFromResponse(state.data);
    var fragment = document.createDocumentFragment();
    members.forEach(function (member) {
      fragment.appendChild(state.tab === 'pending' ? pendingMemberCard(member, availability) : approvedCard(member, availability));
    });
    list.appendChild(fragment);
    renderBatchToolbar();
  }

  function render() {
    var data = state.data;
    var availability = model.availabilityFromResponse(data);
    if (!availability.legacy && !availability.friendApps) {
      state.loadError = '모든 앱 권한 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
      renderLoadError();
      return;
    }
    updateAccessCounts();
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
    if (state.tab === 'grant') { root.appendChild(addForm(availability)); return; }
    var listHead = el('div', 'admin-list-heading');
    var count = (state.members[state.tab] || []).length;
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
    var batchToolbar = el('div', 'admin-batch-toolbar');
    batchToolbar.setAttribute('data-batch-toolbar', '');
    var batchToggle = el('details', 'admin-batch-disclosure');
    batchToggle.open = state.batch;
    batchToggle.appendChild(el('summary', '', '여러 회원 처리'));
    batchToggle.appendChild(batchToolbar);
    batchToggle.addEventListener('toggle', function () { if (state.batch !== batchToggle.open) { state.batch = batchToggle.open; clearSelection(); renderList(); } });
    root.appendChild(batchToggle);
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
      var requestedEmail = new URLSearchParams(window.location.search).get('email');
      if (requestedEmail) state.draft.email = requestedEmail;
      var memberId = new URLSearchParams(window.location.search).get('member');
      if (memberId && !requestedEmail) fetchJson('/.netlify/functions/admin-members?userId=' + encodeURIComponent(memberId)).then(function (member) {
        if (!state.draftTouched && !state.draft.email && !state.draft.tools.length && member.email) { state.draft.email = member.email; if (state.data) render(); }
      }).catch(function () {});
      await refresh(false);
    } catch (error) {
      state.loadError = error.message || '관리자 세션 확인에 실패했습니다.';
      renderLoadError();
    }
  }

  start();
})();
