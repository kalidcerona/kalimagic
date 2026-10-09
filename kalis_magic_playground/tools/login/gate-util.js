(function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  var DEFAULT_TO = '/tools/hitsuzen/';
  var ALLOWED = /^\/tools\/(?:calc|stopwatch|unlock|stopwatch-uni|aletheia|usotsuki|tobira|spinner|hitsuzen|release|kairos|kairos-classic|tyche|arosaegida|pimax)\//;

  // Return only to allow-listed local distribution paths.
  function safeTo(raw) {
    if (typeof raw !== 'string' || !raw) return DEFAULT_TO;
    if (raw.indexOf('\\') !== -1 || raw.indexOf('://') !== -1) return DEFAULT_TO;
    if (raw.indexOf('..') !== -1 || /%2e/i.test(raw)) return DEFAULT_TO;
    if (raw.indexOf('//', 1) !== -1) return DEFAULT_TO;
    if (!ALLOWED.test(raw)) return DEFAULT_TO;
    return raw;
  }

  function toolFromPath(path) {
    if (/^\/tools\/(?:unlock|release)\//.test(path)) return 'unlock';
    if (/^\/tools\/(?:stopwatch-uni|kairos)\//.test(path)) return 'stopwatch-uni';
    if (/^\/tools\/aletheia\//.test(path)) return 'aletheia';
    if (/^\/tools\/usotsuki\//.test(path)) return 'usotsuki';
    if (/^\/tools\/pimax\//.test(path)) return 'pimax';
    if (/^\/tools\/tobira\//.test(path)) return 'tobira';
    if (/^\/tools\/arosaegida\//.test(path)) return 'arosaegida';
    if (/^\/tools\/(?:spinner|tyche)\//.test(path)) return 'spinner';
    return /^\/tools\/(?:stopwatch|kairos-classic)\//.test(path) ? 'stopwatch' : 'calc';
  }

  function selfTest() {
    var cases = [
      ['/tools/../admin.html', DEFAULT_TO],
      ['/tools/%2e%2e/admin.html', DEFAULT_TO],
      ['/tools//evil.com', DEFAULT_TO],
      ['/tools/calc/', '/tools/calc/'],
      ['/tools/stopwatch/', '/tools/stopwatch/'],
      ['/tools/unlock/', '/tools/unlock/'],
      ['/tools/stopwatch-uni/', '/tools/stopwatch-uni/'],
      ['/tools/aletheia/', '/tools/aletheia/'],
      ['/tools/usotsuki/', '/tools/usotsuki/'],
      ['/tools/arosaegida/', '/tools/arosaegida/'],
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
    var toolCases = [['/tools/stopwatch/', 'stopwatch'], ['/tools/calc/', 'calc'], ['/tools/unlock/', 'unlock'], ['/tools/stopwatch-uni/', 'stopwatch-uni'], ['/tools/aletheia/', 'aletheia'], ['/tools/usotsuki/', 'usotsuki'], ['/tools/arosaegida/', 'arosaegida'], [DEFAULT_TO, 'calc']];
    toolCases.forEach(function (row) {
      var actual = toolFromPath(row[0]);
      var ok = actual === row[1];
      if (!ok) failed += 1;
      lines.push((ok ? 'PASS' : 'FAIL') + ' toolFromPath(' + JSON.stringify(row[0]) + ') = ' + JSON.stringify(actual));
    });
    lines.push(failed === 0 ? 'ALL PASS (' + cases.length + '+' + toolCases.length + ')' : failed + ' FAILED');
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
