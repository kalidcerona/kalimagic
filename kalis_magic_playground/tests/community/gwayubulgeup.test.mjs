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
  assert.match(html, /세계 시계를 누르면 트릭이 켜지고, 가운데가 채워집니다\. 16초 전에 멈추면 초와 밀리세컨의 합이 15가 됩니다\./);
  assert.match(html, /두 손가락으로 화면을 아래로 쓸어내리세요/);
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
