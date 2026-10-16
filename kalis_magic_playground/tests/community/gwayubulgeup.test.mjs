import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
import { FRIEND_APP_TOOLS } from '../../netlify/functions/_lib/friend-app-access.mjs';
import { gateCookieName } from '../../netlify/functions/_lib/tool-gate.mjs';
import { accessTableForTool, isValidTool } from '../../netlify/functions/admin-tools.mjs';
import { allowOnCheckError, selectGate } from '../../netlify/functions/tool-check.mjs';
import { DISTRIBUTION_APPS, transformDistributionDocument } from '../../scripts/build-public.mjs';
import { stopwatchDigits, trickStopMs, TRICK_STORAGE_KEY } from '../../distribution-snapshots/gwayubulgeup/logic.js';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

test('trick stop snaps only whole seconds below 16 when minutes are zero', () => {
  const cases = [
    [0, true, 150],
    [3000, true, 3120],
    [3900, true, 3120],
    [9000, true, 9060],
    [15000, true, 15000],
    [15990, true, 15000],
    [16000, true, 16000],
    [59500, true, 59500],
    [61000, true, 61000],
    [75000, true, 75000],
    [0, false, 0],
    [3000, false, 3000],
    [15990, false, 15990],
    [75000, false, 75000]
  ];
  for (const [elapsed, trickOn, expected] of cases) {
    assert.equal(trickStopMs(elapsed, trickOn), expected, `${elapsed} trick ${trickOn}`);
  }
  assert.equal(stopwatchDigits(trickStopMs(0, true)), '000015');
  assert.equal(stopwatchDigits(trickStopMs(3000, true)), '000312');
  assert.equal(stopwatchDigits(trickStopMs(9000, true)), '000906');
  assert.equal(stopwatchDigits(trickStopMs(15000, true)), '001500');
  assert.equal(stopwatchDigits(trickStopMs(15990, true)), '001500');
  assert.equal(stopwatchDigits(trickStopMs(16000, true)), '001600');
  assert.equal(stopwatchDigits(trickStopMs(75000, true)), '011500');
  assert.equal(stopwatchDigits(3000), '000300');
  assert.equal(stopwatchDigits(75000), '011500');
});

function clockText(ms) {
  const digits = stopwatchDigits(ms);
  return digits.slice(0, 2) + ':' + digits.slice(2, 4) + '.' + digits.slice(4, 6);
}

test('forced stop skips the trick when it would precede the last lap', () => {
  assert.equal(trickStopMs(3950, true, 0), 3120);
  assert.equal(clockText(trickStopMs(3950, true)), '00:03.12');

  const earlyLap = 1000;
  const forced = trickStopMs(3950, true, earlyLap);
  const currentSplit = forced - earlyLap;
  assert.equal(forced, 3120);
  assert.equal(currentSplit, 2120);
  assert.equal(earlyLap + currentSplit, forced);
  assert.equal(trickStopMs(3950, true, 3120), 3120);

  const lateLap = 3900;
  const kept = trickStopMs(3950, true, lateLap);
  assert.equal(kept, 3950);
  assert.equal(clockText(kept), '00:03.95');
  assert.equal(clockText(lateLap), '00:03.90');
  assert.equal(lateLap + (kept - lateLap), kept);

  const resumed = forced + 200;
  const splitsAfterForcedStop = [earlyLap, resumed - earlyLap];
  assert.equal(splitsAfterForcedStop.reduce((sum, split) => sum + split, 0), resumed);

  const resumedAfterRealStop = kept + 200;
  const splitsAfterRejectedTrick = [lateLap, resumedAfterRealStop - lateLap];
  assert.equal(splitsAfterRejectedTrick.reduce((sum, split) => sum + split, 0), resumedAfterRealStop);
  assert.equal(trickStopMs(3950, false, lateLap), 3950);
});

test('portrait app paints real and forced time through the same digits', () => {
  const html = read('distribution-snapshots/gwayubulgeup/index.html');
  const logic = read('distribution-snapshots/gwayubulgeup/logic.js');
  assert.equal(TRICK_STORAGE_KEY, 'gwayubulgeup_trick');
  assert.match(logic, /export function trickStopMs/);
  assert.match(logic, /export function stopwatchDigits/);
  assert.equal(html.includes('function paint'), true);
  assert.match(html, /function paint\(ms\) \{\s*const digits = stopwatchDigits\(ms\);/);
  assert.match(html, /elapsedBase = trickStopMs\(elapsedNow\(\), trickOn, lastLapElapsed\);[\s\S]*paint\(elapsedBase\);/);
  assert.doesNotMatch(html, /lastLapElapsed = elapsedBase/);
  assert.match(html, /paint\(elapsed\)/);
  assert.doesNotMatch(html, /landscape|preset|trickState|digitFromPoint|sequence|stopwatch_ui_mode|l-control|p-digit-guide/);
  assert.match(html, /id="p-world"/);
  assert.match(html, /setTrick\(!trickOn\)/);
  assert.match(html, /html\[data-gwayu-trick="on"\] \.tab-world \.core \{ fill: currentColor; \}/);
  assert.match(html, /\.tab-world \.core \{ fill: #1C1C1E; stroke: none; \}/);
  assert.match(html, /gwayubulgeup_trick/);
  assert.match(html, /alt="Plan B"/);
  assert.match(html, /src="\.\/brand-logo\.png"/);
  assert.match(html, /<img id="settings-brand" src="\.\/brand-logo\.png" alt="Plan B" width="160" height="147">/);
  assert.ok(html.indexOf('id="settings-header"') < html.indexOf('id="settings-brand"'), 'settings header comes before the Plan B logo');
  assert.doesNotMatch(html, /id="settings-brand"[^>]*hidden/);
  assert.doesNotMatch(html, /id="settings-brand"[^>]*onerror/);
  const css = read('distribution-snapshots/gwayubulgeup/settings-ui.css');
  assert.match(css, /#settings #settings-card #settings-brand \{[^}]*display:\s*block !important/);
  assert.match(css, /#settings #settings-card #settings-brand \{[^}]*width:\s*120px !important/);
  assert.doesNotMatch(css, /#settings-brand \{[^}]*display:\s*none/);
  assert.match(css, /word-break:\s*keep-all/);
  assert.match(html, /<span>세계 시계를 누르면 트릭이 켜지고<\/span><span>아이콘 가운데가 채워집니다\.<\/span><span>16초 전에 멈추면<\/span><span>초와 밀리세컨의 합이 15가 됩니다\.<\/span>/);
  assert.match(html, /<span>설정을 열려면<\/span><span>두 손가락으로<\/span><span>화면을 아래로 쓸어내리세요\.<\/span>/);
  assert.match(html, /<span>Plan B 마술 커뮤니티<\/span>\s*<span>마술을 좋아하는 사람들이 모여<\/span>\s*<span>함께 연습하고 나누는 모임입니다\.<\/span>/);
  assert.match(html, /href="https:\/\/open\.kakao\.com\/o\/gUJkfxzi"/);
  assert.match(html, /id="planb-openchat"[^>]*target="_blank"/);
  assert.match(html, /id="planb-openchat"[^>]*rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /\$\('planb-openchat'\)\.addEventListener\('click'/);
  assert.doesNotMatch(html, /window\.open\(\$\('planb-openchat'\)/);
  assert.match(html, />Plan B 오픈채팅 참여하기</);
  assert.match(html, /<span>이 마술은 Plan B의 김훈 님과 칼리 님이<\/span>\s*<span>여러분을 위해 준비했습니다\.<\/span>/);
  const settingsUi = read('distribution-snapshots/gwayubulgeup/settings-ui.js');
  assert.match(settingsUi, /<span>수정할 점이나 버그,|수정할 점이나 버그,/);
  assert.match(settingsUi, /새로운 아이디어가 있다면/);
  assert.match(settingsUi, /카카오톡으로 알려주세요\./);
  assert.doesNotMatch(html, /[—~]/);
  assert.doesNotMatch(html, /requestFullscreen|webkitRequestFullscreen/);
  const sw = read('distribution-snapshots/gwayubulgeup/sw.js');
  assert.match(sw, /gwayubulgeup-shell-/);
  assert.match(sw, /brand-logo\.png/);
  assert.doesNotMatch(sw, /stopwatch-uni-shell-|brand-logo\.jpg/);
  const manifest = JSON.parse(read('distribution-snapshots/gwayubulgeup/manifest.webmanifest'));
  assert.equal(manifest.name, '스톱워치');
  assert.equal(manifest.short_name, '스톱워치');
  assert.equal(manifest.id, '/tools/gwayubulgeup/');
  assert.equal(manifest.orientation, 'portrait');
  assert.equal(manifest.display, 'standalone');
});

test('gwayubulgeup is a separate gated friend app', () => {
  assert.deepEqual(DISTRIBUTION_APPS.find((app) => app.tool === 'gwayubulgeup'), {
    source: 'distribution-snapshots/gwayubulgeup',
    target: 'gwayubulgeup',
    tool: 'gwayubulgeup'
  });
  for (const path of ['/tools/gwayubulgeup', '/tools/gwayubulgeup/', '/tools/GWAYUBULGEUP/', '/tools/gwayubulgeup/index.html', '/tools/gwayubulgeup/logic.js', '/tools/gwayubulgeup/sw.js']) {
    assert.deepEqual(classifyPath(path), { mode: 'gated', tool: 'gwayubulgeup' }, path);
  }
  for (const file of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
    assert.deepEqual(classifyPath(`/tools/gwayubulgeup/${file}`), { mode: 'public' }, file);
  }
  for (const path of ['/tools/gwayubulgeup/../index', '/tools/gwayubulgeup/%2e%2e/index']) {
    assert.deepEqual(classifyPath(path), { mode: 'block' }, path);
  }
  assert.equal(allowOnCheckError('gwayubulgeup'), false);
  assert.equal(selectGate([{ valid: true, tool: 'all' }], 'gwayubulgeup').valid, false);
  assert.equal(gateCookieName('gwayubulgeup'), 'kali_gwayubulgeup_gate');
  assert.equal(accessTableForTool('gwayubulgeup'), 'friend_app_access');
  assert.equal(isValidTool('gwayubulgeup'), true);
  assert.ok(FRIEND_APP_TOOLS.has('gwayubulgeup'));
  const html = transformDistributionDocument('<head></head><body></body>', { tool: 'gwayubulgeup', target: 'gwayubulgeup' });
  assert.match(html, /id="friend-apps-check"/);
  assert.match(html, /\/tools\/_check\?tool=gwayubulgeup/);
  assert.match(html, /data-magic-customize="off"/);
  const sql = read('supabase/migrations/20261016_friend_apps_gwayubulgeup.sql');
  assert.match(sql, /begin;[\s\S]*drop constraint if exists friend_app_access_tool_check;[\s\S]*add constraint friend_app_access_tool_check[\s\S]*commit;/);
  assert.deepEqual([...sql.matchAll(/'([^']+)'/g)].map((match) => match[1]), [...FRIEND_APP_TOOLS]);
  assert.match(read('netlify.toml'), /for = "\/tools\/gwayubulgeup\/manifest\.webmanifest"\s*\[headers.values\]\s*Content-Type = "application\/manifest\+json"/);
});

test('deliberate lines stay separate blocks and wrap inside a line only as a fallback', () => {
  const css = read('distribution-snapshots/gwayubulgeup/settings-ui.css');
  const html = read('distribution-snapshots/gwayubulgeup/index.html');
  const rule = css.match(/#settings #settings-card \.planb-copy > span,\s*#settings #settings-card #trick-note > span,\s*#settings #settings-card > \.magic-overview > p > span \{([^}]+)\}/);
  assert.ok(rule, 'deliberate line rule');
  assert.match(rule[1], /display:\s*block/);
  assert.match(rule[1], /white-space:\s*normal/);
  assert.match(rule[1], /word-break:\s*keep-all/);
  assert.match(rule[1], /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(rule[1], /nowrap/);
  for (const block of [
    html.match(/#trick-note > span \{([^}]+)\}/)?.[1],
    html.match(/#settings-entry-tutorial p > span \{([^}]+)\}/)?.[1]
  ]) {
    assert.ok(block);
    assert.match(block, /display:\s*block/);
    assert.match(block, /white-space:\s*normal/);
    assert.match(block, /word-break:\s*keep-all/);
    assert.match(block, /overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(block, /nowrap/);
  }
  const openChat = css.match(/#settings #settings-card \.planb-openchat \{([^}]+)\}/);
  assert.ok(openChat);
  assert.match(openChat[1], /white-space:\s*normal/);
  assert.match(openChat[1], /word-break:\s*keep-all/);
  assert.match(openChat[1], /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(openChat[1], /nowrap/);
});

test('settings content is centre-aligned and the header stays a navigation bar', () => {
  const css = read('distribution-snapshots/gwayubulgeup/settings-ui.css');
  const html = read('distribution-snapshots/gwayubulgeup/index.html');
  const sw = read('distribution-snapshots/gwayubulgeup/sw.js');
  const centred = css.match(/#settings #settings-card :is\(#trick-note, \.planb-block, \.magic-settings-group, \.magic-overview, \.magic-overview :is\(h2, p\), \.magic-install, \.magic-install-status, \.magic-install-status :is\(p, li, ol\), \.magic-settings-footer, \.magic-contact-heading, \.magic-contact-note, \.magic-contact-help, \.magic-contact-help :is\(p, summary\), \.magic-contact-id\) \{([^}]+)\}/);
  assert.ok(centred, 'settings text centring rule');
  assert.match(centred[1], /text-align:\s*center !important/);
  assert.match(css, /#settings #settings-card \{[^}]*text-align:\s*center/);
  assert.match(html, /#trick-note \{[^}]*text-align:\s*center/);
  const header = css.match(/#settings #settings-card #settings-header \{([^}]*text-align:\s*left[^}]*)\}/);
  assert.ok(header, 'settings header stays left/right');
  assert.match(header[1], /justify-content:\s*space-between !important/);
  assert.match(html, /<header id="settings-header"><h1>설정<\/h1><button id="settings-close" type="button">닫기<\/button><\/header>/);
  const summary = css.match(/#settings #settings-card details > summary,\s*#settings #settings-card \.body-groups summary,\s*#settings #settings-card \.magic-contact-help > summary \{([^}]+)\}/);
  assert.ok(summary, 'disclosure label centring rule');
  assert.match(summary[1], /justify-content:\s*center !important/);
  assert.match(summary[1], /text-align:\s*center !important/);
  const icon = css.match(/#settings #settings-card \.body-groups summary::after,\s*#settings #settings-card \.magic-contact-help > summary::after,\s*#settings #settings-card details > summary::after \{([^}]+)\}/);
  assert.ok(icon, 'disclosure icon stays on the right edge');
  assert.match(icon[1], /position:\s*absolute/);
  assert.match(icon[1], /right:\s*0/);
  assert.match(icon[1], /margin-left:\s*0 !important/);
  const rows = css.match(/#settings #settings-card :is\(\.magic-contact-actions, \.magic-appearance-actions, \.actions, \.row-actions, \.preset-actions, \.install-actions, \.settings-actions, \.setting-actions, \.formbuttons\) \{([^}]+)\}/);
  assert.ok(rows, 'button row centring rule');
  assert.match(rows[1], /justify-content:\s*center/);
  assert.match(css, /#settings #settings-card \.magic-settings-footer :is\(\.magic-contact-link, \.magic-contact-copy\) \{[^}]*flex-grow:\s*0/);
  const full = css.match(/#settings #settings-card :is\(\.planb-openchat, \.magic-install-button, \.magic-customize-open\) \{([^}]+)\}/);
  assert.ok(full, 'full-width settings buttons');
  assert.match(full[1], /width:\s*100%/);
  const steps = css.match(/#settings #settings-card \.magic-install-status ol \{([^}]+)\}/);
  assert.ok(steps);
  assert.match(steps[1], /padding-left:\s*0/);
  assert.match(steps[1], /text-align:\s*center !important/);
  assert.match(steps[1], /list-style:\s*none/);
  assert.match(css, /#settings #settings-card \.magic-install-status li > span:first-child::before \{[^}]*content:\s*counter\(magic-install-step\) "\. "/);
  assert.match(html, /#settings-entry-tutorial \.tutorial-card \{[^}]*text-align:\s*center/);
  assert.match(sw, /v20261016-portrait-1-manual-install-1-coherent-1-planb-1-center-1/);
});

test('installed PWA open chat uses only the anchor navigation', () => {
  const html = read('distribution-snapshots/gwayubulgeup/index.html');
  const anchor = html.match(/<a id="planb-openchat"[^>]*>/);
  assert.ok(anchor);
  assert.match(anchor[0], /href="https:\/\/open\.kakao\.com\/o\/gUJkfxzi"/);
  assert.match(anchor[0], /target="_blank"/);
  assert.match(anchor[0], /rel="noopener noreferrer"/);
  assert.equal(html.includes("addEventListener('click'"), true);
  assert.doesNotMatch(html, /planb-openchat'\)\.addEventListener/);
  assert.doesNotMatch(html, /window\.open\(/);
  const clickAt = html.indexOf("$('planb-openchat')");
  assert.equal(clickAt, -1);
});
