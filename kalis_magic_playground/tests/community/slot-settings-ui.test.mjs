import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('capsule round control, progress and instructions share one disclosure', () => {
  const html = readFileSync(new URL('../../distribution-snapshots/slot/index.html', import.meta.url), 'utf8');
  const group = html.match(/<details>[^]*?<summary>캡슐이 나올 회차<\/summary>([^]*?)<\/details>/)[1];
  assert.match(group, /id="round" type="number" min="1" max="20"/);
  assert.match(group, /id="progress"/);
  assert.match(group, /회차 설정은 첫 START 때 적용됩니다/);
  assert.match(html, /<form method="dialog"><button class="primary" autofocus>닫기/);
});
