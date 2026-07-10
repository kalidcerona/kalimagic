import test from 'node:test';
import assert from 'node:assert/strict';
import { handler, loadPublicPost } from '../../netlify/functions/post-og.mjs';

test('post OG falls back to the generic shell for invalid ids', async () => {
  const response = await handler({
    httpMethod: 'GET',
    queryStringParameters: { id: 'not-a-uuid' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(response.body, /<title>마술문화 기록소 \| 칼리형<\/title>/);
  assert.match(response.body, /<script src="post\.js" defer><\/script>/);
});

test('public post lookup requires visible public rows', async () => {
  const calls = [];
  const row = { title: '공개 글', body: '본문' };
  const query = {
    select(columns) {
      calls.push(['select', columns]);
      return this;
    },
    eq(column, value) {
      calls.push(['eq', column, value]);
      return this;
    },
    async maybeSingle() {
      calls.push(['maybeSingle']);
      return { data: row, error: null };
    }
  };
  const supabase = {
    from(table) {
      calls.push(['from', table]);
      return query;
    }
  };

  assert.equal(await loadPublicPost(supabase, 'post-id'), row);
  assert.deepEqual(calls, [
    ['from', 'posts'],
    ['select', 'title,body'],
    ['eq', 'id', 'post-id'],
    ['eq', 'status', 'visible'],
    ['eq', 'visibility', 'public'],
    ['maybeSingle']
  ]);
});
