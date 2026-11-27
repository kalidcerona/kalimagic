import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function replaceOnce(source, before, after) {
  const index = source.indexOf(before);
  if (index < 0 || source.indexOf(before, index + before.length) >= 0) {
    throw new Error('Unexpected private TYCHE wheel source: ' + before);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

export async function prepareTyche(directory, buildId) {
  const [app, spin, writer] = await Promise.all([
    readFile(path.join(directory, 'app.js'), 'utf8'),
    readFile(path.join(directory, 'spin.js'), 'utf8'),
    readFile(new URL('../zz-migration/tyche-prelaunch.js', import.meta.url), 'utf8'),
  ]);
  const revision = buildId.slice('zz-backup-v1-'.length);
  const entry = 'app-' + revision + '.js';
  const wheel = 'spin-' + revision + '.js';
  const appSource = replaceOnce(app, "from './spin.js'", "from './" + wheel + "'");
  const wheelSource = replaceOnce(spin, '  save();\n\n  function save()',
    '  const writeState = installTycheStateWriter(key);\n  save(true);\n\n  function save(launch = false)');
  const wheelWithWriter = replaceOnce(wheelSource, 'localStorage.setItem(key, JSON.stringify(state))',
    'writeState(JSON.stringify(state), launch)') + '\n' + writer;
  await Promise.all([
    writeFile(path.join(directory, entry), appSource),
    writeFile(path.join(directory, wheel), wheelWithWriter),
  ]);
  return { entry, files: [entry, wheel] };
}
