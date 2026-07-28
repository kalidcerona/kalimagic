(function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  var DEFAULT_TO = '/tools/calc/';
  var ALLOWED = /^\/tools\/(calc|stopwatch)\//;

  // 도구 게이트는 두 도구 경로로만 되돌려보낸다. 그 밖의 값은 전부 기본 경로로 떨어뜨린다.
  function safeTo(raw) {
    if (typeof raw !== 'string' || !raw) return DEFAULT_TO;
    if (raw.indexOf('\\') !== -1 || raw.indexOf('://') !== -1) return DEFAULT_TO;
    if (raw.indexOf('..') !== -1 || /%2e/i.test(raw)) return DEFAULT_TO;
    if (raw.indexOf('//', 1) !== -1) return DEFAULT_TO;
    if (!ALLOWED.test(raw)) return DEFAULT_TO;
    return raw;
  }

  function toolFromPath(path) {
    return /^\/tools\/stopwatch\//.test(path) ? 'stopwatch' : 'calc';
  }

  function selfTest() {
    var cases = [
      ['/tools/../admin.html', DEFAULT_TO],
      ['/tools/%2e%2e/admin.html', DEFAULT_TO],
      ['/tools//evil.com', DEFAULT_TO],
      ['/tools/calc/', '/tools/calc/'],
      ['/tools/stopwatch/', '/tools/stopwatch/'],
      ['/tools/calc/?x=1', '/tools/calc/?x=1'],
      ['//evil.com', DEFAULT_TO],
      ['https://evil.com', DEFAULT_TO],
      ['javascript:alert(1)', DEFAULT_TO],
      ['/admin.html', DEFAULT_TO],
      ['/tools/calc', DEFAULT_TO],
      ['/tools/CALC/', DEFAULT_TO],
      ['', DEFAULT_TO],
      [null, DEFAULT_TO]
    ];
    var lines = [];
    var failed = 0;
    cases.forEach(function (row) {
      var actual = safeTo(row[0]);
      var ok = actual === row[1];
      if (!ok) failed += 1;
      lines.push((ok ? 'PASS' : 'FAIL') + ' safeTo(' + JSON.stringify(row[0]) + ') = ' + JSON.stringify(actual) + (ok ? '' : ' (expected ' + JSON.stringify(row[1]) + ')'));
    });
    [['/tools/stopwatch/', 'stopwatch'], ['/tools/calc/', 'calc'], [DEFAULT_TO, 'calc']].forEach(function (row) {
      var actual = toolFromPath(row[0]);
      var ok = actual === row[1];
      if (!ok) failed += 1;
      lines.push((ok ? 'PASS' : 'FAIL') + ' toolFromPath(' + JSON.stringify(row[0]) + ') = ' + JSON.stringify(actual));
    });
    lines.push(failed === 0 ? 'ALL PASS (' + cases.length + '+3)' : failed + ' FAILED');
    return { failed: failed, text: lines.join('\n') };
  }

  g.ToolGateUtil = { safeTo: safeTo, toolFromPath: toolFromPath, selfTest: selfTest };

  if (typeof location !== 'undefined' && location.hash === '#selftest') {
    var result = selfTest();
    console.log(result.text);
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', function () {
        var pre = document.createElement('pre');
        pre.style.cssText = 'white-space:pre-wrap;text-align:left;font-size:12px;color:' + (result.failed ? '#ff6b6b' : '#7bd88f');
        pre.textContent = result.text;
        document.body.appendChild(pre);
      });
    }
  }
})();
