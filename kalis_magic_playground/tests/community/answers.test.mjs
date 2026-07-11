import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../netlify/functions/answers.mjs', import.meta.url), 'utf8');

test('answers POST handler requires an authenticated viewer', () => {
  assert.match(source, /event\.httpMethod !== 'POST'/);
  assert.match(source, /try\s*\{\s*viewer = await requireViewer\(event\);\s*\}\s*catch\s*\{\s*return json\(401,\s*\{\s*error:\s*'auth_required'\s*\}\s*\);\s*\}/);
});

test('answers POST handler rejects viewers without answer permission', () => {
  assert.match(source, /if \(!canAnswerQuestion\(question, viewer\)\)\s*\{\s*return json\(403,\s*\{\s*error:\s*'answer_role_insufficient'\s*\}\s*\);\s*\}/);
});

test('answers POST handler checks authorization before inserts or badge awards', () => {
  const authIndex = source.indexOf('await requireViewer(event)');
  const answerPermissionIndex = source.indexOf('canAnswerQuestion(question, viewer)');
  const answerInsertIndex = source.indexOf(".from('answers')\n    .insert({");
  const badgeAwardIndex = source.indexOf('await awardQuestBadges(');

  assert.ok(authIndex >= 0, 'requireViewer call is present');
  assert.ok(answerPermissionIndex >= 0, 'canAnswerQuestion call is present');
  assert.ok(answerInsertIndex >= 0, 'answer insert is present');
  assert.ok(badgeAwardIndex >= 0, 'badge award is present');
  assert.ok(authIndex < answerPermissionIndex, 'authentication happens before answer authorization');
  assert.ok(answerPermissionIndex < answerInsertIndex, 'answer authorization happens before insertion');
  assert.ok(answerPermissionIndex < badgeAwardIndex, 'answer authorization happens before badge awards');
});
