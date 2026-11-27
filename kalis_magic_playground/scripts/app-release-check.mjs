import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_RELEASE_ROOTS, verifyMirrors } from './build-public.mjs';
import { createAppReleasePins, verifyAppRelease } from './app-release-pins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [mode, release, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error('Unexpected app release arguments');
if (mode === '--candidate' && release) {
  // Print only. Normal verification/build never writes or refreshes the selected pins.
  console.log(JSON.stringify(await createAppReleasePins({ root, requiredRoots: APP_RELEASE_ROOTS, release }), null, 2));
} else if ((mode === '--audit-masters' || mode === '--audit-sources') && !release) {
  console.log(JSON.stringify(await verifyMirrors()));

} else if ((!mode || mode === '--verify') && !release) {
  console.log(JSON.stringify(await verifyAppRelease({ root, requiredRoots: APP_RELEASE_ROOTS })));
} else throw new Error('Usage: node scripts/app-release-check.mjs [--verify | --audit-sources | --audit-masters | --candidate RELEASE]');
