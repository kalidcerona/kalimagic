import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function assertPinnedSnapshot(route, file) {
  const path = `${route}/${file}`;
  const pins = JSON.parse(readFileSync(new URL('../../scripts/app-release-pins.json', import.meta.url)));
  const entry = pins.entries.find(entry => entry.path === path);
  assert.ok(entry && entry.kind === 'file', `${path} is an approved public file`);
  const bytes = readFileSync(new URL(`../../${path}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, path);
}
