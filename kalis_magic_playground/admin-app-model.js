(function (root, factory) {
  var model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  if (root) root.AdminAppModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var APP_CATALOG = Object.freeze([
    Object.freeze({ id: 'calc', name: 'HITSUZEN', path: '/tools/calc/', legacy: true }),
    Object.freeze({ id: 'stopwatch', name: 'KAIROS', path: '/tools/stopwatch/', legacy: true }),
    Object.freeze({ id: 'unlock', name: '레리즈', path: '/tools/unlock/', legacy: false }),
    Object.freeze({ id: 'stopwatch-uni', name: 'KAIROS', path: '/tools/stopwatch-uni/', legacy: false })
  ]);
  var TOOL_LABELS = Object.freeze({
    calc: 'HITSUZEN',
    stopwatch: 'KAIROS',
    unlock: '레리즈',
    'stopwatch-uni': 'KAIROS',
    all: 'HITSUZEN + KAIROS'
  });
  var LEGACY_TOOLS = Object.freeze(['calc', 'stopwatch']);

  function toolLabel(tool) {
    return TOOL_LABELS[tool] || String(tool || '앱 미지정');
  }

  function toolsForFilter(tool) {
    return tool === 'all' ? LEGACY_TOOLS.slice() : (!tool || tool === '*' ? APP_CATALOG.map(function (app) { return app.id; }) : [tool]);
  }

  function normalizeAvailability(value) {
    var source = value || {};
    return {
      legacy: source.legacy !== false,
      friendApps: source.friendApps !== false
    };
  }

  function availabilityFromResponse(data) {
    var response = data || {};
    var availability = Object.assign({}, response.availability || {});
    var warnings = Array.isArray(response.warnings) ? response.warnings : [];
    if (availability.friendApps === undefined && warnings.some(function (warning) {
      return warning && warning.code === 'friend_apps_unavailable';
    })) availability.friendApps = false;
    return normalizeAvailability(availability);
  }

  function isToolAvailable(tool, availability) {
    var state = normalizeAvailability(availability);
    if (tool === 'all') return state.legacy;
    var app = APP_CATALOG.find(function (entry) { return entry.id === tool; });
    if (!app) return false;
    return app.legacy ? state.legacy : state.friendApps;
  }

  function pendingToolOptions(item, availability) {
    var tool = item && item.tool;
    if (tool === 'unlock' || tool === 'stopwatch-uni') {
      return isToolAvailable(tool, availability) ? [tool] : [];
    }
    if (tool && LEGACY_TOOLS.indexOf(tool) === -1 && tool !== 'all') return [];
    if (!normalizeAvailability(availability).legacy) return [];
    return ['calc', 'stopwatch', 'all'];
  }

  function isPendingActionAvailable(item, selectedTool, availability) {
    var originalTool = item && item.tool;
    if (originalTool === 'unlock' || originalTool === 'stopwatch-uni') {
      return selectedTool === originalTool && isToolAvailable(originalTool, availability);
    }
    return normalizeAvailability(availability).legacy && ['calc', 'stopwatch', 'all'].indexOf(selectedTool) !== -1;
  }

  function availabilityMessage(availability) {
    var state = normalizeAvailability(availability);
    var unavailable = [];
    if (!state.legacy) unavailable.push('HITSUZEN·KAIROS');
    if (!state.friendApps) unavailable.push('레리즈·KAIROS');
    if (!unavailable.length) return '';
    return unavailable.join(' 및 ') + ' 권한 서비스를 사용할 수 없습니다. 조회 가능한 앱의 권한만 표시됩니다.';
  }

  function filterRows(rows, filters) {
    var options = filters || {};
    var query = String(options.query || '').trim().toLocaleLowerCase('ko-KR');
    var tool = options.tool || 'all';
    var acceptedTools = toolsForFilter(tool);
    return (rows || []).filter(function (item) {
      var toolMatches = tool === '*'
        ? true
        : tool === 'all'
          ? acceptedTools.indexOf(item.tool) !== -1 || item.tool === 'all'
        : item.tool === tool || (item.tool === 'all' && LEGACY_TOOLS.indexOf(tool) !== -1) || (!item.tool && (tool === 'all' || LEGACY_TOOLS.indexOf(tool) !== -1));
      if (!toolMatches) return false;
      if (!query) return true;
      return [item.email, item.displayName, item.nickname].some(function (value) {
        return String(value || '').toLocaleLowerCase('ko-KR').indexOf(query) !== -1;
      });
    });
  }

  function countByTool(rows) {
    var counts = { calc: 0, stopwatch: 0, unlock: 0, 'stopwatch-uni': 0 };
    (rows || []).forEach(function (item) {
      if (item.tool === 'all') {
        counts.calc += 1;
        counts.stopwatch += 1;
      } else if (Object.prototype.hasOwnProperty.call(counts, item.tool)) {
        counts[item.tool] += 1;
      }
    });
    return counts;
  }

  function additionalToolOptions(person, approvedRows, availability) {
    var email = String(person && person.email || '').trim().toLowerCase();
    if (!email) return [];
    var owned = new Set();
    (approvedRows || []).forEach(function (row) {
      if (String(row.email || '').trim().toLowerCase() !== email) return;
      if (row.tool === 'all') LEGACY_TOOLS.forEach(function (tool) { owned.add(tool); });
      else owned.add(row.tool);
    });
    return APP_CATALOG.filter(function (app) {
      return isToolAvailable(app.id, availability) && !owned.has(app.id);
    }).map(function (app) { return app.id; });
  }

  function errorMessage(error) {
    var code = error && error.code;
    var status = error && error.status;
    if (status === 403) return '관리자 권한이 확인되지 않았습니다. 다시 로그인해 주세요.';
    if (status === 409 || code === 'already_exists' || code === 'duplicate_row') {
      return '이 이메일과 앱의 권한이 이미 등록되어 있습니다.';
    }
    if (code === 'not_found') return '대상 권한을 찾지 못했습니다. 목록을 새로고침해 주세요.';
    if (code === 'db_error' || code === 'friend_apps_unavailable') return '권한 서비스를 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    return error && error.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  return Object.freeze({
    APP_CATALOG: APP_CATALOG,
    TOOL_LABELS: TOOL_LABELS,
    toolLabel: toolLabel,
    toolsForFilter: toolsForFilter,
    normalizeAvailability: normalizeAvailability,
    availabilityFromResponse: availabilityFromResponse,
    isToolAvailable: isToolAvailable,
    pendingToolOptions: pendingToolOptions,
    isPendingActionAvailable: isPendingActionAvailable,
    availabilityMessage: availabilityMessage,
    filterRows: filterRows,
    countByTool: countByTool,
    additionalToolOptions: additionalToolOptions,
    errorMessage: errorMessage
  });
});
