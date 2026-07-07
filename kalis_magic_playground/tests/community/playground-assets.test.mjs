import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const assets = [
  new URL('../../assets/playground/board-header.svg', import.meta.url),
  new URL('../../assets/playground/empty-question.svg', import.meta.url),
  new URL('../../assets/playground/empty-review.svg', import.meta.url)
];

test('playground point svg assets exist and use the shared 24x24 viewBox', () => {
  for (const assetUrl of assets) {
    assert.equal(existsSync(assetUrl), true, `${assetUrl.pathname} should exist`);

    const source = readFileSync(assetUrl, 'utf8');
    assert.match(source, /viewBox="0 0 24 24"/);
    assert.match(source, /stroke="currentColor"/);
  }
});
