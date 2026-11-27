import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const loader = `{
  const url = document.currentScript.dataset.zzBackup;
  window.addEventListener("load", () => requestAnimationFrame(() => {
    const begin = () => import(url).catch(() => {});
    if (window.requestIdleCallback) requestIdleCallback(begin, {timeout: 2000});
    else setTimeout(begin, 0);
  }), {once: true});
}`;
const scriptHash = code => "'sha256-" + createHash('sha256').update(code).digest('base64') + "'";

function replaceOnce(text, expected, replacement) {
  assert.equal(text.split(expected).length, 2, 'expected exactly one ' + expected);
  return text.replace(expected, () => replacement);
}

async function checkWheel(dir, entry, wheel) {
  const read = name => readFile(path.join(dir, name), 'utf8');
  assert.equal(await read(entry), replaceOnce(await read('app.js'), "from './spin.js'", "from './" + wheel + "'"));
  const writer = await readFile(new URL('../../zz-migration/tyche-prelaunch.js', import.meta.url), 'utf8');
  const spin = replaceOnce(await read('spin.js'), '  save();\n\n  function save()',
    '  const writeState = installTycheStateWriter(key);\n  save(true);\n\n  function save(launch = false)');
  assert.equal(await read(wheel), replaceOnce(spin, 'localStorage.setItem(key, JSON.stringify(state))',
    'writeState(JSON.stringify(state), launch)') + '\n' + writer);
}

// Compare ordinary runtime bytes after independently validating and removing the generated additions.
export async function inspectBackupOutput(directory) {
  const dir = directory instanceof URL ? fileURLToPath(directory) : directory;
  const appId = path.basename(dir);
  const ids = (await readdir(dir)).filter(name => /^zz-backup-v1-[0-9a-f]{16}$/.test(name));
  assert.equal(ids.length, 1, appId);
  const [id] = ids;
  const modules = ['snapshot.mjs', 'media-worker.mjs'];
  if (['zz2', 'zz4', 'zz5', 'zz6'].includes(appId)) modules.push('zip.mjs');
  modules.push('entry.mjs', 'start.js');
  const alias = 'open-backup-v1.html';
  const revision = id.slice('zz-backup-v1-'.length);
  const wheelFiles = appId === 'zz11' ? ['app-' + revision + '.js', 'spin-' + revision + '.js'] : [];
  const files = [alias, ...modules.map(name => id + '/' + name), ...wheelFiles];
  assert.deepEqual((await readdir(path.join(dir, id))).sort(), [...modules].sort());
  assert.equal(await readFile(path.join(dir, id, 'start.js'), 'utf8'), "import './entry.mjs';\n");
  const hook = '<script data-zz-backup="./' + id + '/start.js">' + loader + '</script>\n';
  let index = await readFile(path.join(dir, 'index.html'), 'utf8');
  let launch = await readFile(path.join(dir, alias), 'utf8');
  const canonical = 'history.replaceState(history.state, "", "/' + appId + '/" + location.search + location.hash);';
  if (appId === 'zz8') {
    const prefix = "script-src 'self'";
    index = replaceOnce(index, prefix + ' ' + scriptHash(loader) + ';', prefix + ';');
    launch = replaceOnce(launch, prefix + ' ' + scriptHash(loader) + ' ' + scriptHash(canonical) + ';', prefix + ';');
  }
  const firstScript = launch.indexOf('<script');
  assert.ok(firstScript >= 0);
  assert.ok(launch.startsWith('<script>' + canonical + '</script>', firstScript), appId + ' first script');
  assert.equal(replaceOnce(launch, '<script>' + canonical + '</script>', ''), index);
  index = replaceOnce(index, hook + '</body>', '</body>');
  if (wheelFiles.length) {
    await checkWheel(dir, ...wheelFiles);
    index = replaceOnce(index, '<script type="module" src="./' + wheelFiles[0] + '"></script>',
      '<script type="module" src="./app.js"></script>');
  }

  const worker = await readFile(path.join(dir, 'sw.js'), 'utf8');
  const shell = 'const SHELL = [\n' + files.map(name => '  "./' + name + '",').join('\n');
  const unversionedShell = replaceOnce(worker, shell, 'const SHELL = [');
  const original = {
    'index.html': Buffer.from(index),
    'sw.js': Buffer.from(replaceOnce(unversionedShell, '-' + id + "'", "'")),
  };
  return {
    files,
    entries: [alias, id, ...wheelFiles],
    sourceBytes(file, bytes) { return original[file] ?? bytes; },
  };
}
