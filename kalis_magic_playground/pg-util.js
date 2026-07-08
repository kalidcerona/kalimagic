(function () {
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  async function fetchJson(url, options) {
    var headers = window.MagicAuth ? await window.MagicAuth.authHeader() : {};
    if (options && options.body) headers['content-type'] = 'application/json; charset=utf-8';
    var response = await fetch(url, Object.assign({}, options, { headers: headers }));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.message || data.error || '요청을 처리하지 못했습니다.');
      error.status = response.status;
      error.code = data.error;
      throw error;
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // style: 'long' (default, mypage.js 원본 — falsy value 조기 반환 포함) · 'detail' (playground-detail.js 원본, 2자리 점 표기) · 'short' (playground-list.js 원본, 올해면 월.일만)
  function formatDate(value, style) {
    if (style === 'detail') {
      var detailDate = new Date(value);
      if (Number.isNaN(detailDate.getTime())) return '';
      return detailDate.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    if (style === 'short') {
      var shortDate = new Date(value);
      if (Number.isNaN(shortDate.getTime())) return '';
      var now = new Date();
      var month = String(shortDate.getMonth() + 1).padStart(2, '0');
      var day = String(shortDate.getDate()).padStart(2, '0');
      if (shortDate.getFullYear() === now.getFullYear()) return month + '.' + day;
      return shortDate.getFullYear() + '.' + month + '.' + day;
    }
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  window.PgUtil = {
    el: el,
    clear: clear,
    fetchJson: fetchJson,
    escapeHtml: escapeHtml,
    formatDate: formatDate
  };
})();
