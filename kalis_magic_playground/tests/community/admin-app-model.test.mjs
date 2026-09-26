import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../admin-app-model.js', import.meta.url), 'utf8');
const adminHtml = readFileSync(new URL('../../admin.html', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const model = context.AdminAppModel;

test('catalog exposes all six distribution apps', () => {
  assert.deepEqual(Array.from(model.APP_CATALOG, (app) => [app.id, app.path]), [
    ['calc', '/tools/calc/'],
    ['stopwatch', '/tools/stopwatch/'],
    ['unlock', '/tools/unlock/'],
    ['stopwatch-uni', '/tools/stopwatch-uni/'],
    ['aletheia', '/tools/aletheia/'],
    ['usotsuki', '/tools/usotsuki/']
  ]);
});

test('new friend app cards expose separate links, copy controls and counters', () => {
  for (const [id, name] of [['aletheia', 'ALETHEIA'], ['usotsuki', 'USOTSUKI']]) {
    const card = adminHtml.match(new RegExp('<article class="admin-app-card" data-app-card="' + id + '">([\\s\\S]*?)</article>'))?.[1];
    assert.ok(card, name + ' card exists');
    assert.match(card, new RegExp('<h3>' + name + '</h3>'));
    assert.match(card, new RegExp('data-app-count="' + id + '"'));
    assert.match(card, new RegExp('href="/tools/' + id + '/"'));
    assert.match(card, new RegExp('data-copy-link="/tools/' + id + '/"'));
  }
});

test('legacy all access is labelled as calculator and stopwatch only', () => {
  assert.equal(model.toolLabel('all'), 'HITSUZEN + KAIROS');
  assert.equal(model.toolLabel('stopwatch'), 'KAIROS');
  assert.equal(model.toolLabel('stopwatch-uni'), 'KAIROS');
  assert.equal(model.toolLabel('unlock'), '레리즈');
  assert.equal(model.toolLabel('aletheia'), 'ALETHEIA');
  assert.equal(model.toolLabel('usotsuki'), 'USOTSUKI');
  assert.deepEqual(Array.from(model.toolsForFilter('all')), ['calc', 'stopwatch']);
  assert.equal(model.toolsForFilter('all').includes('unlock'), false);
  assert.equal(model.toolsForFilter('all').includes('aletheia'), false);
  assert.equal(model.toolsForFilter('all').includes('usotsuki'), false);
});

test('filters access rows by email, display name, nickname and selected app', () => {
  const rows = [
    { email: 'min@example.com', displayName: '민수', nickname: '마술사', tool: 'calc' },
    { email: 'jane@example.com', displayName: '제인', nickname: '제이', tool: 'unlock' },
    { email: 'kim@example.com', displayName: '김', nickname: '친구', tool: 'aletheia' },
    { email: 'lee@example.com', displayName: '이', nickname: '친구', tool: 'usotsuki' }
  ];
  assert.deepEqual(Array.from(model.filterRows(rows, { query: '마술사', tool: 'calc' })), [rows[0]]);
  assert.deepEqual(Array.from(model.filterRows(rows, { query: 'Jane', tool: '*' })), [rows[1]]);
  assert.deepEqual(Array.from(model.filterRows(rows, { query: '', tool: 'stopwatch' })), []);
  assert.deepEqual(Array.from(model.filterRows(rows, { query: '친구', tool: 'aletheia' })), [rows[2]]);
  assert.deepEqual(Array.from(model.filterRows(rows, { query: '', tool: 'usotsuki' })), [rows[3]]);
});

test('friend app availability is unknown when its service is down', () => {
  const availability = model.normalizeAvailability({ legacy: true, friendApps: false });
  assert.equal(model.isToolAvailable('calc', availability), true);
  assert.equal(model.isToolAvailable('stopwatch', availability), true);
  assert.equal(model.isToolAvailable('unlock', availability), false);
  assert.equal(model.isToolAvailable('stopwatch-uni', availability), false);
  assert.equal(model.isToolAvailable('aletheia', availability), false);
  assert.equal(model.isToolAvailable('usotsuki', availability), false);
  assert.equal(model.availabilityMessage(availability), '레리즈·KAIROS·ALETHEIA·USOTSUKI 권한 서비스를 사용할 수 없습니다. 조회 가능한 앱의 권한만 표시됩니다.');
});

test('friend app outage warnings override legacy response defaults', () => {
  const availability = model.availabilityFromResponse({ warnings: [{ code: 'friend_apps_unavailable' }] });
  assert.equal(availability.legacy, true);
  assert.equal(availability.friendApps, false);
});

test('legacy pending rows without a tool stay actionable only through the legacy table', () => {
  const row = { id: 'legacy-pending', email: 'legacy@example.com', tool: null };
  const availability = model.normalizeAvailability({ legacy: true, friendApps: true });
  assert.deepEqual(Array.from(model.pendingToolOptions(row, availability)), ['calc', 'stopwatch', 'all']);
  assert.equal(model.isPendingActionAvailable(row, 'calc', availability), true);
  assert.equal(model.isPendingActionAvailable(row, 'unlock', availability), false);
  assert.equal(model.isPendingActionAvailable(row, 'aletheia', availability), false);
  assert.equal(model.isPendingActionAvailable(row, 'usotsuki', availability), false);
  assert.deepEqual(Array.from(model.filterRows([row], { tool: 'calc' })), [row]);
  assert.deepEqual(Array.from(model.filterRows([row], { tool: 'unlock' })), []);
  assert.deepEqual(Array.from(model.filterRows([row], { tool: 'aletheia' })), []);
  assert.equal(model.pendingToolOptions(row, model.normalizeAvailability({ legacy: false, friendApps: true })).length, 0);
});

test('each new friend app can only approve its own pending entitlement while available', () => {
  for (const tool of ['aletheia', 'usotsuki']) {
    const row = { email: 'friend@example.com', tool };
    assert.deepEqual(Array.from(model.pendingToolOptions(row, { friendApps: true })), [tool]);
    assert.equal(model.isPendingActionAvailable(row, tool, { friendApps: true }), true);
    assert.equal(model.isPendingActionAvailable(row, 'all', { friendApps: true }), false);
    assert.deepEqual(Array.from(model.pendingToolOptions(row, { friendApps: false })), []);
    assert.equal(model.isPendingActionAvailable(row, tool, { friendApps: false }), false);
  }
});

test('legacy all records contribute only to calculator and stopwatch counts', () => {
  const counts = model.countByTool([
    { status: 'approved', tool: 'all' },
    { status: 'pending', tool: 'all' },
    { status: 'approved', tool: 'unlock' },
    { status: 'approved', tool: 'aletheia' },
    { status: 'approved', tool: 'usotsuki' }
  ]);
  assert.equal(counts.calc, 2);
  assert.equal(counts.stopwatch, 2);
  assert.equal(counts.unlock, 1);
  assert.equal(counts['stopwatch-uni'], 0);
  assert.equal(counts.aletheia, 1);
  assert.equal(counts.usotsuki, 1);
});

test('admin API errors map duplicate grants and denied sessions to clear messages', () => {
  assert.equal(model.errorMessage({ status: 409, code: 'already_exists' }), '이 이메일과 앱의 권한이 이미 등록되어 있습니다.');
  assert.equal(model.errorMessage({ status: 403 }), '관리자 권한이 확인되지 않았습니다. 다시 로그인해 주세요.');
});

test('an approved person can be offered only apps they do not already have', () => {
  const person = { email: 'friend@example.com', tool: 'stopwatch' };
  const approved = [person, { email: 'FRIEND@example.com', tool: 'unlock' }, { email: 'other@example.com', tool: 'calc' }];
  assert.deepEqual(Array.from(model.additionalToolOptions(person, approved, { legacy: true, friendApps: true })), ['calc', 'stopwatch-uni', 'aletheia', 'usotsuki']);
  assert.deepEqual(Array.from(model.additionalToolOptions(person, approved, { legacy: true, friendApps: false })), ['calc']);
  assert.deepEqual(Array.from(model.additionalToolOptions({ email: 'all@example.com', tool: 'all' }, [{ email: 'all@example.com', tool: 'all' }], { legacy: true, friendApps: true })), ['unlock', 'stopwatch-uni', 'aletheia', 'usotsuki']);
  assert.deepEqual(Array.from(model.additionalToolOptions({ email: 'friend@example.com' }, approved.concat([
    { email: 'friend@example.com', tool: 'aletheia' }
  ]), { legacy: true, friendApps: true })), ['calc', 'stopwatch-uni', 'usotsuki']);
});
