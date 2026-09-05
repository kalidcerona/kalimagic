import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('event review list filters body-returning rows through the access policy', () => {
  const source = readFileSync(new URL('../../netlify/functions/event-reviews.mjs', import.meta.url), 'utf8');

  assert.match(source, /import \{ canReadPostBody \} from '\.\/_lib\/access-policy\.mjs'/);
  assert.match(source, /visibility,authorUserId:author_user_id/);
  assert.match(source, /data\.filter\(\(row\) => canReadPostBody\(row, viewer\)\)\.map\(shapeReview\)/);
});
