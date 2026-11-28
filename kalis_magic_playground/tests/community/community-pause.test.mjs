import test from 'node:test';
import assert from 'node:assert/strict';

test('archive writes return one no-store response before any transport or credential access', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const transport = t.mock.fn(() => { throw new Error('Unexpected transport'); });
  globalThis.fetch = transport;
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'fetch', descriptor);
    else delete globalThis.fetch;
  });
  for (const name of ['posts', 'comments', 'answers', 'event-reviews', 'post-likes', 'answer-helpful', 'report']) {
    const { handler } = await import('../../netlify/functions/' + name + '.mjs');
    const methods = ['posts', 'answer-helpful'].includes(name) ? ['POST', 'DELETE'] : ['POST'];
    for (const httpMethod of methods) {
      const result = await handler({
        httpMethod,
        get headers() { throw new Error('Unexpected credential access'); },
        get body() { throw new Error('Unexpected body access'); }
      });
      assert.equal(result.statusCode, 503, name + ' ' + httpMethod);
      assert.equal(result.headers['cache-control'], 'no-store');
      assert.deepEqual(JSON.parse(result.body), { error: 'community_paused' });
    }
  }
  assert.equal(transport.mock.callCount(), 0);
});
