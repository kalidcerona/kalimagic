// Compare the built first release with the reader and retirement workers before deploying B.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { mapKey, TARGETS } from '../../zz-import/data.mjs';
import { ZZ_RETIREMENT_SPECS } from '../../scripts/zz-retirement.mjs';

const [firstRelease] = process.argv.slice(2);
if (!firstRelease) throw new Error('Expected the path to the first release dist directory.');
const origin = 'https://example.test';
let keys = 0;
for (const { id, backupVersion } of ZZ_RETIREMENT_SPECS) {
  const directory = path.join(firstRelease, id);
  const worker = await readFile(path.join(directory, 'sw.js'), 'utf8');
  const actualVersion = /(?:CACHE_NAME\s*=\s*CACHE_PREFIX|CACHE=PREFIX)\s*\+\s*'([^']+)'/.exec(worker)?.[1];
  assert.equal(actualVersion, backupVersion, id + ' retirement cache');
  const buildId = /zz-backup-v1-[a-f0-9]+$/.exec(actualVersion)[0];
  const entry = await readFile(path.join(directory, buildId, 'entry.mjs'), 'utf8');
  const config = JSON.parse(/^const config = (.*);$/m.exec(entry)[1]);
  assert.equal(config.appId, id);
  const targets = Object.entries(TARGETS).filter(([, reader]) => reader.appId === id);
  assert.ok(targets.length);
  for (const [target, reader] of targets) {
    const allowed = [...config.keys];
    if (config.appearance) {
      for (const suffix of ['', '/', '/index.html']) {
        allowed.push('magic-appearance:v1:' + config.appearance + ':' + origin + '/' + id + suffix);
      }
    }
    for (const key of allowed) {
      assert.notEqual(mapKey(target, key, { origin }), undefined, target + ' cannot read ' + key);
      keys++;
    }
    if (config.media) {
      assert.ok(reader.media.some((row) => row.db === config.media.db && row.store === config.media.store));
    }
  }
}
console.log(
  ZZ_RETIREMENT_SPECS.length + ' retirement cache versions, ' + Object.keys(TARGETS).length +
    ' destinations, ' + keys + ' source keys matched',
);
