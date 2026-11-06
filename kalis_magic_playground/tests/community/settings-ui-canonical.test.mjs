import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIRROR_PAIRS } from '../../scripts/build-public.mjs';

// Site repo root. Sibling originals live two directories above it, the same way MIRROR_PAIRS addresses them.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CANONICAL = '../../magic-app-common/settings-ui.js';
const ROUTES = new Set(['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11']);

// settings-ui.css stays per-app: the ten copies share a shell, then each appends its own settings B block.
const pairs = MIRROR_PAIRS.filter(([source, mirror]) => source.endsWith('/settings-ui.js') && ROUTES.has(mirror.slice(0, mirror.indexOf('/'))));

function readBytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function exists(relativePath) {
  try {
    fs.statSync(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

test('magic-app-common/settings-ui.js is the byte-identical canonical copy of the ten apps and their site mirrors', (t) => {
  assert.equal(pairs.length, 10, 'MIRROR_PAIRS must list settings-ui.js for zz1–zz8, zz10, and zz11');
  const onCi = process.env.NETLIFY === 'true' || Boolean(process.env.CI);
  const missingSources = pairs.map(([source]) => source).filter((source) => !exists(source));
  const canonicalMissing = !exists(CANONICAL);
  // Sibling checkouts are absent on CI. Skip only that source comparison, matching verifyMirrors.
  if (canonicalMissing && missingSources.length === pairs.length && onCi) {
    t.skip(`settings-ui canonical check skipped on CI: ${missingSources.length} sibling sources absent`);
    return;
  }
  assert.equal(canonicalMissing, false, `canonical settings-ui.js missing: ${CANONICAL}`);
  const canonical = readBytes(CANONICAL);
  for (const [, mirror] of pairs) {
    assert.ok(canonical.equals(readBytes(mirror)), `${mirror} must match ${CANONICAL}`);
  }
  if (missingSources.length === pairs.length && onCi) {
    t.diagnostic(`WARNING: settings-ui source check skipped on CI: ${missingSources.length} sibling sources absent`);
    return;
  }
  assert.deepEqual(missingSources, [], `settings-ui sources missing: ${missingSources.join(', ')}`);
  for (const [source] of pairs) {
    assert.ok(canonical.equals(readBytes(source)), `${source} must match ${CANONICAL}`);
  }
});
