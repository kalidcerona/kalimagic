import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../admin-app-model.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const model = context.AdminAppModel;

test('catalog exposes only the four distribution apps', () => {
  assert.deepEqual(Array.from(model.APP_CATALOG, (app) => [app.id, app.path]), [
    ['calc', '/tools/calc/'],
    ['stopwatch', '/tools/stopwatch/'],
    ['unlock', '/tools/unlock/'],
    ['stopwatch-uni', '/tools/stopwatch-uni/']
  ]);
});

test('legacy all access is labelled as calculator and stopwatch only', () => {
  assert.equal(model.toolLabel('all'), '계산기 + 스톱워치');
  assert.deepEqual(Array.from(model.toolsForFilter('all')), ['calc', 'stopwatch']);
  assert.equal(model.toolsForFilter('all').includes('unlock'), false);
});

test('filters access rows by email, display name, nickname and selected app', () => {
  const rows = [
    { email: 'min@example.com', displayName: '민수', nickname: '마술사', tool: 'calc' },
    { email: 'jane@example.com', displayName: '제인', nickname: '제이', tool: 'unlock' }
  ];
  assert.deepEqual(Array.from(model.filterRows(rows, { query: '마술사', tool: 'calc' })), [rows[0]]);
  assert.deepEqual(Array.from(model.filterRows(rows, { query: 'Jane', tool: '*' })), [rows[1]]);
  assert.deepEqual(Array.from(model.filterRows(rows, { query: '', tool: 'stopwatch' })), []);
});

test('friend app availability is unknown when its service is down', () => {
  const availability = model.normalizeAvailability({ legacy: true, friendApps: false });
  assert.equal(model.isToolAvailable('calc', availability), true);
  assert.equal(model.isToolAvailable('stopwatch', availability), true);
  assert.equal(model.isToolAvailable('unlock', availability), false);
  assert.equal(model.isToolAvailable('stopwatch-uni', availability), false);
  assert.equal(model.availabilityMessage(availability), '언락·통합 스톱워치 권한 서비스를 사용할 수 없습니다. 조회 가능한 앱의 권한만 표시됩니다.');
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
  assert.deepEqual(Array.from(model.filterRows([row], { tool: 'calc' })), [row]);
  assert.deepEqual(Array.from(model.filterRows([row], { tool: 'unlock' })), []);
  assert.equal(model.pendingToolOptions(row, model.normalizeAvailability({ legacy: false, friendApps: true })).length, 0);
});

test('legacy all records contribute only to calculator and stopwatch counts', () => {
  const counts = model.countByTool([
    { status: 'approved', tool: 'all' },
    { status: 'pending', tool: 'all' },
    { status: 'approved', tool: 'unlock' }
  ]);
  assert.equal(counts.calc, 2);
  assert.equal(counts.stopwatch, 2);
  assert.equal(counts.unlock, 1);
  assert.equal(counts['stopwatch-uni'], 0);
});

test('admin API errors map duplicate grants and denied sessions to clear messages', () => {
  assert.equal(model.errorMessage({ status: 409, code: 'already_exists' }), '이 이메일과 앱의 권한이 이미 등록되어 있습니다.');
  assert.equal(model.errorMessage({ status: 403 }), '관리자 권한이 확인되지 않았습니다. 다시 로그인해 주세요.');
});
