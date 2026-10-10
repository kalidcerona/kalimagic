import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = join(import.meta.dirname, '../..');
const NOTICE = '이 브라우저는 진동을 지원하지 않아요. 나머지 기능은 그대로 쓸 수 있어요.';

function customizeStyles() {
  const files = [];
  for (const dir of readdirSync(root)) {
    if (!/^zz\d+$/.test(dir)) continue;
    files.push(join(root, dir, 'settings-ui.css'));
  }
  const snapshots = join(root, 'distribution-snapshots');
  for (const dir of readdirSync(snapshots)) {
    files.push(join(snapshots, dir, 'settings-ui.css'));
  }
  return files.filter((file) => {
    try {
      return readFileSync(file, 'utf8').includes('.magic-customize-header');
    } catch {
      return false;
    }
  });
}

test('customize header and body pad with lateral safe insets', () => {
  const files = customizeStyles();
  assert.ok(files.length >= 17);
  const lateral = /max\(16px, env\(safe-area-inset-right, 0px\)\)[^;]*max\(16px, env\(safe-area-inset-left, 0px\)\)/;
  for (const file of files) {
    const css = readFileSync(file, 'utf8');
    const header = css.match(/\.magic-customize-header \{[^}]+\}/);
    const body = css.match(/\.magic-customize \{ min-height:0;[^}]+\}/);
    assert.ok(header, file);
    assert.ok(body, file);
    assert.match(header[0], lateral, file);
    assert.match(body[0], lateral, file);
  }
});

function vibrationControl() {
  const writes = [];
  const control = {
    checked: true,
    disabled: false,
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
  };
  const notice = { hidden: true, textContent: '' };
  const other = { disabled: false, checked: true, attrs: {} };
  return { writes, control, notice, other };
}

function runVibrationCapability(sandbox) {
  const source = readFileSync(join(root, 'zz4/app.js'), 'utf8');
  const start = source.indexOf('function applyVibrationCapability()');
  assert.ok(start >= 0);
  let depth = 0;
  let end = source.indexOf('{', start);
  for (let i = end; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const fn = source.slice(start, end);
  assert.equal(fn.split(NOTICE).length - 1, 1);
  assert.doesNotMatch(fn, /Audio|sound|beep|vibrate\(/);
  vm.runInContext(`${fn}\napplyVibrationCapability();\napplyVibrationCapability();`, vm.createContext(sandbox));
}

test('zz4 disables vibration controls and shows one notice without the vibrate API', () => {
  const html = readFileSync(join(root, 'zz4/index.html'), 'utf8');
  const labelAt = html.indexOf('id="opt-vibrate"');
  const noticeAt = html.indexOf('id="vibrate-capability"');
  const nextAt = html.indexOf('id="input-guide"');
  assert.ok(labelAt > 0 && noticeAt > labelAt && nextAt > noticeAt);
  assert.equal(html.split('id="vibrate-capability"').length - 1, 1);

  const ui = vibrationControl();
  const sandbox = {
    navigator: {},
    optVibrate: ui.control,
    vibrateCapability: ui.notice,
    localStorage: { setItem(...args) { ui.writes.push(args); } },
  };
  runVibrationCapability(sandbox);
  assert.equal(ui.control.disabled, true);
  assert.equal(ui.control.attrs['aria-disabled'], 'true');
  assert.equal(ui.control.checked, true);
  assert.equal(ui.notice.hidden, false);
  assert.equal(ui.notice.textContent, NOTICE);
  assert.equal(ui.other.disabled, false);
  assert.deepEqual(ui.writes, []);

  const supported = vibrationControl();
  supported.notice.hidden = true;
  runVibrationCapability({
    navigator: { vibrate() { throw new Error('must not vibrate while reading capability'); } },
    optVibrate: supported.control,
    vibrateCapability: supported.notice,
    localStorage: { setItem(...args) { supported.writes.push(args); } },
  });
  assert.equal(supported.control.disabled, false);
  assert.equal(supported.control.checked, true);
  assert.equal(supported.notice.hidden, true);
  assert.equal(supported.notice.textContent, '');
  assert.equal('aria-disabled' in supported.control.attrs, false);
  assert.deepEqual(supported.writes, []);
});

test('installable shells expose apple and mobile web app capability', () => {
  const pages = [
    'zz12/index.html',
    'zz13/index.html',
    'zz14/index.html',
    'distribution-snapshots/qr/index.html',
    'distribution-snapshots/pimax/index.html',
  ];
  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf8');
    const viewport = html.search(/<meta name="viewport"[^>]*>/);
    const apple = html.indexOf('<meta name="apple-mobile-web-app-capable" content="yes">');
    const mobile = html.indexOf('<meta name="mobile-web-app-capable" content="yes">');
    assert.ok(viewport >= 0, page);
    assert.ok(apple > viewport, page);
    assert.ok(mobile > apple, page);
    assert.equal(html.split('name="apple-mobile-web-app-capable"').length - 1, 1, page);
    assert.equal(html.split('name="mobile-web-app-capable"').length - 1, 1, page);
  }
});
