import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldCopyMagicshow } from './build-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// CLI path (or --source PATH) takes precedence over the environment override.
const args = process.argv.slice(2);
if (args.length > 2 || (args.length === 2 && args[0] !== '--source') || (args[0] === '--source' && !args[1])) throw new Error('Usage: sync-magicshow-snapshot.mjs [--source] [PATH]');
const SOURCE = path.resolve((args[0] === '--source' ? args[1] : args[0]) || process.env.MAGICSHOW_SOURCE || '/Users/sumpie/Desktop/AI/AiGo/magic-show-game/v3');
const SNAPSHOT = path.join(ROOT, 'distribution-snapshots/magicshow');
const ADDITIONS = path.join(ROOT, 'scripts/magicshow-dist');
const files = new Map();
async function readRegular(base, file) {
  const full = path.join(base, file);
  if (!(await lstat(full)).isFile()) throw new Error(`Expected regular file: ${full}`);
  return readFile(full);
}
function replaceOnce(source, anchor, addition) {
  if (source.split(anchor).length !== 2) throw new Error(`Missing or ambiguous index anchor: ${anchor}`);
  return source.replace(anchor, addition);
}
for (const file of ['index.html', 'style.css', 'data.js', 'core.js', 'audio.js', 'ui.js']) {
  files.set(file, await readRegular(SOURCE, file));
}
async function collect(directory) {
  // Recursive, sorted; the allowlist decides per directory and per file (assets/ui is the only nested folder).
  for (const entry of (await readdir(path.join(SOURCE, directory), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const file = `${directory}/${entry.name}`;
    if (entry.isFile() && shouldCopyMagicshow(file)) files.set(file, await readRegular(SOURCE, file));
    else if (entry.isDirectory() && shouldCopyMagicshow(file)) await collect(file);
  }
}
for (const directory of ['assets', 'fonts']) await collect(directory);
for (const file of ['install-prompt.js', 'install-prompt.css']) files.set(file, await readRegular(ADDITIONS, file));
for (const size of [192, 512]) files.set(`icon-${size}.png`, await readRegular(ADDITIONS, `icon-${size}.png`));
for (const file of ['apple-touch-icon.png', 'favicon-32.png', 'og-image.png']) files.set(file, await readRegular(ADDITIONS, file));
files.set('manifest.webmanifest', Buffer.from(JSON.stringify({
  name: '칼리의 마술 성장기', short_name: '칼리마술',
  id: '/tools/magicshow/', start_url: '/tools/magicshow/', scope: '/tools/magicshow/',
  display: 'fullscreen', orientation: 'landscape', theme_color: '#151020', background_color: '#151020',
  icons: [192, 512].map(size => ({ src: `icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' }))
}, null, 2) + '\n'));
let html = files.get('index.html').toString();
const DESCRIPTION = '가족 거실에서 우주까지, 마술로 관객을 감탄시키는 방치형 게임';
const PREVIEW_META = [
  ['name', 'description', DESCRIPTION], ['property', 'og:type', 'website'], ['property', 'og:site_name', '칼리의 마술 성장기'],
  ['property', 'og:title', '칼리의 마술 성장기'], ['property', 'og:description', DESCRIPTION],
  ['property', 'og:url', 'https://kalimagic.netlify.app/tools/magicshow/'], ['property', 'og:image', 'https://kalimagic.netlify.app/tools/magicshow/og-image.png'],
  ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'], ['name', 'twitter:card', 'summary_large_image']
].map(([key, name, content]) => `<meta ${key}="${name}" content="${content}">`).join('');
html = replaceOnce(html, '</head>', `<link rel="stylesheet" href="install-prompt.css"><script defer src="install-prompt.js"></script><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png"><link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#151020">${PREVIEW_META}</head>`);
html = replaceOnce(html, '<body>', '<body data-magic-customize="off">');
const REGISTER_SW = `if ('serviceWorker' in navigator) { var sw = navigator.serviceWorker, hadController = !!sw.controller, reloaded = false, registration = null, lastCheck = Date.now(); sw.addEventListener('controllerchange', function () { if (!hadController) { hadController = true; return; } if (reloaded) return; reloaded = true; try { window.dispatchEvent(new Event('pagehide')); } catch (e) {} try { window.MagicShowUI && window.MagicShowUI.save && window.MagicShowUI.save(); } catch (e) {} location.reload(); }); window.addEventListener('load', function () { sw.register('./sw.js').then(function (r) { registration = r; }).catch(function () {}); }); document.addEventListener('visibilitychange', function () { if (document.visibilityState !== 'visible' || !registration || Date.now() - lastCheck < 600000) return; lastCheck = Date.now(); registration.update().catch(function () {}); }); }`;
html = replaceOnce(html, '</body>', `<script>${REGISTER_SW}</script></body>`);
files.set('index.html', Buffer.from(html));
let worker = (await readRegular(ADDITIONS, 'sw-template.js')).toString();
const shell = [...files.keys(), 'sw.js'].sort().map(file => `./${file}`);
if (!/const SHELL = \[[\s\S]*?\];/.test(worker)) throw new Error('Missing service worker shell anchor');
worker = worker.replace(/const SHELL = \[[\s\S]*?\];/, `const SHELL = ${JSON.stringify(shell, null, 2)};`);
const hash = createHash('sha256').update(worker);
for (const [name, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b, 'en'))) hash.update(name).update('\0').update(bytes);
worker = replaceOnce(worker, '__VERSION__', hash.digest('hex').slice(0, 16));
files.set('sw.js', Buffer.from(worker));
// Escape page for stuck phones: added after the SHELL list is built so the worker never precaches it.
files.set('update.html', await readRegular(ADDITIONS, 'update.html'));
// Validate paths before deleting anything; source and generated icons stay read-only.
const parent = await realpath(path.dirname(SNAPSHOT));
if (!parent.startsWith((await realpath(ROOT)) + path.sep)) throw new Error('Snapshot parent escapes project');
try {
  if (!(await lstat(SNAPSHOT)).isDirectory() || (await lstat(SNAPSHOT)).isSymbolicLink()) throw new Error('Snapshot must be a real directory');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(SNAPSHOT, { recursive: true, force: true });
await mkdir(path.join(SNAPSHOT, 'assets'), { recursive: true });
let bytes = 0;
for (const [file, content] of files) {
  if (!shouldCopyMagicshow(file)) throw new Error(`Disallowed snapshot file: ${file}`);
  await mkdir(path.dirname(path.join(SNAPSHOT, file)), { recursive: true });
  await writeFile(path.join(SNAPSHOT, file), content);
  bytes += content.length;
}
console.log(`magicshow snapshot: ${files.size} files, ${bytes} bytes`);
