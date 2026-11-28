import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../netlify/functions/post-og.mjs';

test('old share previews always redirect without a cacheable body', async () => {
  for (const id of ['', 'invalid', '11111111-1111-4111-8111-111111111111']) {
    const response = await handler({ httpMethod: 'GET', queryStringParameters: { id } });
    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, '/playground.html');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.body, '');
  }
});
