import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { USOTSUKI_FILES } from '../../scripts/build-public.mjs';
import { usotsukiAppSource } from './usotsuki-app-script.mjs';
import { readAppStyle } from './app-style.mjs';
import { assertPinnedSnapshot } from './public-snapshot-pins.mjs';
const read = (route, file) => file === 'style.css' ? Promise.resolve(Buffer.from(readAppStyle(new URL(`../../${route}/`, import.meta.url)))) : readFile(new URL(`../../${route}/${file}`, import.meta.url));

async function verifyTree(route, prefix = '') {
 for (const entry of await readdir(new URL(`../../${route}/${prefix}`, import.meta.url), { withFileTypes: true })) {
  if (entry.isDirectory()) await verifyTree(route, `${prefix}${entry.name}/`);
  else assertPinnedSnapshot(route, `${prefix}${entry.name}`);
 }
}
test('public USOTSUKI and TYCHE retain pinned artwork and performance modules', async () => {
 for (const app of ['usotsuki', 'spinner']) await verifyTree(`distribution-snapshots/${app}`);
});
test('public theme selectors retain their approved options', async () => {
 for (const [app, id, values] of [
  ['usotsuki','display-theme',['green','wine','recorder','recorder-a','recorder-d']],
  ['spinner','table-theme',['emerald','burgundy']],
  ['spinner','screen-design',['casino','hybrid']],
 ]) {
  const html = (await read(`distribution-snapshots/${app}`, 'index.html')).toString();
  const select=html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/select>`))?.[0];
  assert.ok(select, id);
  for (const value of values) assert.ok(select.includes(`value="${value}"`), `${id}/${value}`);
 }
});
test('promotion preserves existing shared storage and isolates newly introduced theme preferences', async () => {
  const detector = usotsukiAppSource(fileURLToPath(new URL('../../distribution-snapshots/usotsuki/', import.meta.url)));
  for (const [constant, key] of [
    ['STATE_KEY', 'usotsuki.distribution.detector.v1'],
    ['SOUND_KEY', 'usotsuki.distribution.detector.sound.v1'],
    ['SCAN_DURATION_KEY', 'usotsuki.detector.scan-duration.v1'],
    ['VIBRATION_KEY', 'usotsuki.detector.vibration.v1'],
    ['DISPLAY_THEME_KEY', 'usotsuki.distribution.detector.theme.v1'],
  ]) assert.ok(detector.includes(`${constant} = "${key}"`), constant);
  const spinner = (await read('distribution-snapshots/spinner', 'app.js')).toString();
  for (const key of ['friend-spinner-state-v2', 'friend-spinner-state-v1', 'friend-spinner-guide-seen-v2', 'friend-spinner-table-theme-v1', 'friend-spinner-screen-design-v1']) assert.ok(spinner.includes(key), key);
});


test('USOTSUKI deploys used recorder assets and preserves the approved CSS prefix', async () => {
 const route='distribution-snapshots/usotsuki';
 const source=usotsukiAppSource(fileURLToPath(new URL(`../../${route}/`, import.meta.url)));
 assert.doesNotMatch(source, /magic-local-settings|local-preview|performance-log|launch-check/);
 for (const file of ['fonts/NanumGothicCoding-Regular.ttf','ink-print.svg']) {
  assert.ok(!USOTSUKI_FILES.includes(file));
  assert.ok(!(await read(route,'sw.js')).toString().includes(`"./${file}"`));
 }
 assert.ok(USOTSUKI_FILES.includes('recorder-assets/recorder-shell-blank.webp'));
 const css=(await read(route,'style.css')).toString();
 const prefix=css.split('\n').slice(0,929).join('\n')+'\n';
 assert.equal(createHash('sha256').update(prefix).digest('hex'),'07ad81bbc85967754c072d262d8ef2337cf2e0077ec2d077b008139108a8e288');
 assert.ok(css.includes('recorder-shell-blank.webp'));
});
