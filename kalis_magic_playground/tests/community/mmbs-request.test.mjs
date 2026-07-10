import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  requestMmbsAccess,
  shapePendingRequest,
  shapeRequestState
} from '../../netlify/functions/mmbs-request.mjs';

function existingStateSupabase(row) {
  var updateCount = 0;
  return {
    get updateCount() {
      return updateCount;
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        update() { updateCount += 1; return this; },
        maybeSingle() { return Promise.resolve({ data: row, error: null }); }
      };
    }
  };
}

test('request state shapers map profile columns', () => {
  const row = {
    user_id: '11111111-1111-4111-8111-111111111111',
    nickname: '마술인07',
    mmbs_request_status: 'requested',
    mmbs_requested_at: '2026-07-10T00:00:00.000Z'
  };
  assert.deepEqual(shapeRequestState(row), {
    status: 'requested',
    requestedAt: '2026-07-10T00:00:00.000Z'
  });
  assert.deepEqual(shapePendingRequest(row), {
    userId: '11111111-1111-4111-8111-111111111111',
    nickname: '마술인07',
    requestedAt: '2026-07-10T00:00:00.000Z'
  });
});

for (const status of ['requested', 'done']) {
  test(`POST is idempotent when request is already ${status}`, async () => {
    const row = {
      mmbs_request_status: status,
      mmbs_requested_at: '2026-07-10T00:00:00.000Z'
    };
    const supabase = existingStateSupabase(row);
    const response = await requestMmbsAccess(supabase, { userId: 'user-1' });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      status,
      requestedAt: '2026-07-10T00:00:00.000Z'
    });
    assert.equal(supabase.updateCount, 0);
  });
}

test('handler routes viewer GET/POST and admin filtered GET/PATCH', () => {
  const source = readFileSync(new URL('../../netlify/functions/mmbs-request.mjs', import.meta.url), 'utf8');

  assert.match(source, /\['GET', 'POST', 'PATCH'\]/);
  assert.match(source, /queryStringParameters\?\.filter === 'mmbs_requests'/);
  assert.match(source, /isAdminRequest \? await requireAdmin\(event\) : await requireViewer\(event\)/);
  assert.match(source, /event\.httpMethod === 'PATCH'/);
  assert.match(source, /event\.httpMethod === 'POST'/);
  assert.match(source, /mmbs_request_status:\s*'requested'/);
  assert.match(source, /mmbs_request_status:\s*'done'/);
});

test('frontend exposes request, pending, done, and admin completion states', () => {
  const mypageHtml = readFileSync(new URL('../../mypage.html', import.meta.url), 'utf8');
  const mypageJs = readFileSync(new URL('../../mypage.js', import.meta.url), 'utf8');
  const adminHtml = readFileSync(new URL('../../admin.html', import.meta.url), 'utf8');
  const adminJs = readFileSync(new URL('../../admin.js', import.meta.url), 'utf8');

  assert.match(mypageHtml, /data-mypage-mmbs/);
  assert.match(mypageJs, /열람 신청하기/);
  assert.match(mypageJs, /신청 접수됨 — 확인 중입니다/);
  assert.match(mypageJs, /안내 완료 — 카카오톡을 확인해주세요/);
  assert.match(mypageJs, /신청이 접수되었습니다\. 확인 후 카카오톡으로 안내드릴게요\./);
  assert.match(adminHtml, /data-admin-filter="mmbs_requests"/);
  assert.match(adminJs, /mmbs-request\?filter=mmbs_requests/);
  assert.match(adminJs, /method:\s*'PATCH'/);
  assert.match(adminJs, /처리 완료/);
});
