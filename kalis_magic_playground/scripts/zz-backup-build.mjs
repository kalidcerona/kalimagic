import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareTyche } from './zz-tyche-build.mjs';
import { registry, runtimeKeys } from '../zz-migration/registry.mjs';

function replaceOnce(source, pattern, replacement, context) {
  if ([...source.matchAll(pattern)].length !== 1) throw new Error('Unexpected backup hook boundary: ' + context);
  return source.replace(pattern, replacement);
}

// Execute the optional import after native startup and a rendering opportunity.
// Resolving the module must never be a dependency of parsing, DOMContentLoaded, or load.
const loader = `{
  const url = document.currentScript.dataset.zzBackup;
  window.addEventListener("load", () => requestAnimationFrame(() => {
    const begin = () => import(url).catch(() => {});
    if (window.requestIdleCallback) requestIdleCallback(begin, {timeout: 2000});
    else setTimeout(begin, 0);
  }), {once: true});
}`;

function allowInline(source, scripts) {
  if (!source.includes('http-equiv="Content-Security-Policy"')) return source;
  const hashes = scripts.map(script => "'sha256-" + createHash('sha256').update(script).digest('base64') + "'");
  return replaceOnce(source, /script-src 'self';/g, "script-src 'self' " + hashes.join(' ') + ';', 'script CSP');
}

export async function publishPersonalBackups(dist, routes) {
  if (routes.slice().sort().join() !== Object.keys(registry).sort().join()) {
    throw new Error('ZZ backup registry and personal release list differ');
  }
  const modules = new Map();
  for (const file of ['snapshot.mjs', 'media-worker.mjs']) {
    modules.set(file, await readFile(new URL('../zz-migration/' + file, import.meta.url), 'utf8'));
  }
  const zip = await readFile(new URL('../zz-migration/zip.mjs', import.meta.url), 'utf8');
  const tychePrelaunch = await readFile(new URL('../zz-migration/tyche-prelaunch.js', import.meta.url), 'utf8');
  const tycheBuilder = await readFile(new URL('./zz-tyche-build.mjs', import.meta.url));
  const builder = await readFile(new URL(import.meta.url));
  for (const appId of routes) {
    const directory = path.join(dist, appId);
    const config = { ...registry[appId], appId };
    const appModules = new Map(modules);
    if (config.media) appModules.set('zip.mjs', zip);
    const hash = createHash('sha256').update(builder).update(JSON.stringify(config)).update(runtimeKeys.toString());
    if (appId === 'zz11') {
      hash.update(tychePrelaunch).update(tycheBuilder);
      for (const file of ['app.js', 'spin.js']) hash.update(await readFile(path.join(directory, file)));
    }
    for (const source of appModules.values()) hash.update(source);
    const buildId = 'zz-backup-v1-' + hash.digest('hex').slice(0, 16);
    const entry = [
      "import { start } from './snapshot.mjs';",
      'const config = ' + JSON.stringify({ ...config, buildId }) + ';',
      'const resolveKeys = ' + runtimeKeys.toString() + ';',
      'start({ ...config, keys: resolveKeys(config, location) });'
    ].join('\n');
    const assets = new Map([...appModules, ['entry.mjs', entry]]);
    assets.set('start.js', "import './entry.mjs';\n");
    const output = path.join(directory, buildId);
    await mkdir(output);
    for (const [name, source] of assets) await writeFile(path.join(output, name), source);
    const indexPath = path.join(directory, 'index.html');
    const index = await readFile(indexPath, 'utf8');
    if (index.includes('data-zz-backup')) throw new Error('Duplicate backup hook: ' + appId);
    const tyche = appId === 'zz11' ? await prepareTyche(directory, buildId) : null;
    const nativeIndex = tyche
      ? replaceOnce(index, /<script type="module" src="\.\/app\.js"><\/script>/g,
        '<script type="module" src="./' + tyche.entry + '"></script>', appId)
      : index;
    const hook = '<script data-zz-backup="./' + buildId + '/start.js">' + loader + '</script>';
    const hooked = replaceOnce(nativeIndex, /<\/body>/gi, hook + '\n</body>', appId);
    const html = allowInline(hooked, [loader]);
    const canonical = 'history.replaceState(history.state, "", "/' + appId + '/" + location.search + location.hash);';
    const firstScript = hooked.indexOf('<script');
    const launch = allowInline(hooked.slice(0, firstScript) + '<script>' + canonical + '</script>' +
      hooked.slice(firstScript), [loader, canonical]);
    const alias = 'open-backup-v1.html';
    await writeFile(indexPath, html);
    await writeFile(path.join(directory, alias), launch);
    const swPath = path.join(directory, 'sw.js');
    const original = await readFile(swPath, 'utf8');
    const versioned = replaceOnce(original, /((?:CACHE_NAME\s*=\s*CACHE_PREFIX|CACHE=PREFIX)\s*\+\s*'[^']+)'/g, '$1-' + buildId + "'", appId);
    const files = [alias, ...Array.from(assets.keys(), name => buildId + '/' + name), ...(tyche?.files || [])];
    const shell = files.map(name => '  "./' + name + '",').join('\n');
    await writeFile(swPath, replaceOnce(versioned, /const SHELL = \[/g, 'const SHELL = [\n' + shell, appId));
  }
}
