import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handler, nextStatus, noticeValueForAction } from '../../netlify/functions/admin-moderate.mjs';

test('noticeValueForAction maps pin and unpin actions', () => {
  assert.equal(noticeValueForAction('pin_notice'), true);
  assert.equal(noticeValueForAction('unpin_notice'), false);
  assert.equal(noticeValueForAction('hide'), null);
});

test('nextStatus leaves notice actions on existing status', () => {
  assert.equal(nextStatus('hide'), 'hidden');
  assert.equal(nextStatus('restore'), 'visible');
  assert.equal(nextStatus('delete'), 'deleted');
  assert.equal(nextStatus('pin_notice'), null);
  assert.equal(nextStatus('unpin_notice'), null);
});

test('admin moderate records notice events without changing status', () => {
  const source = readFileSync(new URL('../../netlify/functions/admin-moderate.mjs', import.meta.url), 'utf8');
  assert.match(source, /is_notice/);
  assert.match(source, /before_status: before\.status/);
  assert.match(source, /after_status: status \|\| before\.status/);
  assert.match(source, /매거진 후보 지정은 질문 글에서만 사용할 수 있어요/);
});

test('admin moderate reports auditLogged false when the audit insert fails', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;
  const originalConsoleError = console.error;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'secret';
  console.error = () => {};
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) {
      return Response.json({ id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.com' });
    }
    if (url.includes('/rest/v1/profiles')) {
      return Response.json({
        user_id: '11111111-1111-4111-8111-111111111111',
        nickname: '관리자',
        role: 'admin'
      });
    }
    if (url.includes('/rest/v1/posts') && (init.method || 'GET') === 'GET') {
      return Response.json({
        id: '22222222-2222-4222-8222-222222222222',
        status: 'visible',
        visibility: 'public',
        category: 'free',
        post_type: 'free',
        is_notice: false
      });
    }
    if (url.includes('/rest/v1/posts')) return new Response(null, { status: 204 });
    if (url.includes('/rest/v1/moderation_events')) {
      return Response.json({ message: 'audit unavailable', code: 'XX000' }, { status: 500 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({
        postId: '22222222-2222-4222-8222-222222222222',
        action: 'hide'
      })
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { ok: true, auditLogged: false });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalKey;
  }
});
