import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const APP_PIN_FILE = 'scripts/app-release-pins.json';

function safePath(value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f:]/.test(value)
      || value.split('/').some(part => !part || part === '.' || part === '..')
      || path.posix.isAbsolute(value)) throw new Error(`Unsafe app release path: ${value}`);
  return value;
}

function checkedRoots(roots) {
  if (!Array.isArray(roots) || !roots.length) throw new Error('App release roots required');
  const sorted = roots.map(safePath).sort();
  for (let i = 0; i < sorted.length; i++) {
    if (sorted.some((other, j) => j !== i && (other === sorted[i] || other.startsWith(`${sorted[i]}/`)))) {
      throw new Error('Duplicate or overlapping app release roots');
    }
  }
  return sorted;
}

async function checkedDirectory(root, relative) {
  let current = root;
  for (const segment of ['', ...safePath(relative).split('/')]) {
    current = path.join(current, segment);
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe app release directory: ${current}`);
  }
}

// Inventory complete retained trees, including nonpublished source files. Build filters
// still decide publication; no ignored new file can accidentally become trusted input.
async function inventory(root, roots) {
  const entries = [];
  async function visit(relative) {
    safePath(relative);
    const info = await lstat(path.join(root, relative));
    if (info.isSymbolicLink()) throw new Error(`App release symlink: ${relative}`);
    if (info.isDirectory()) {
      entries.push({ path: relative, kind: 'directory' });
      for (const name of (await readdir(path.join(root, relative))).sort()) await visit(`${relative}/${name}`);
    } else if (info.isFile()) {
      const bytes = await readFile(path.join(root, relative));
      entries.push({ path: relative, kind: 'file', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    } else throw new Error(`App release special file: ${relative}`);
  }
  for (const relative of roots) {
    await checkedDirectory(root, relative);
    await visit(relative);
  }
  return entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export async function createAppReleasePins({ root, requiredRoots, release }) {
  if (typeof release !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(release)) throw new Error('Explicit app release identifier required');
  const roots = checkedRoots(requiredRoots);
  return {
    schemaVersion: 1,
    release,
    provenance: 'Retained personal app trees and distribution snapshots from the selected site release.',
    roots,
    entries: await inventory(root, roots)
  };
}

export async function verifyAppRelease({ root, requiredRoots, manifestPath = APP_PIN_FILE }) {
  const roots = checkedRoots(requiredRoots);
  safePath(manifestPath);
  await checkedDirectory(root, path.posix.dirname(manifestPath));
  const pinInfo = await lstat(path.join(root, manifestPath));
  if (!pinInfo.isFile() || pinInfo.isSymbolicLink()) throw new Error('App release manifest must be a regular file');
  const pins = JSON.parse(await readFile(path.join(root, manifestPath), 'utf8'));
  if (pins.schemaVersion !== 1 || typeof pins.release !== 'string' || !pins.release.trim()
      || typeof pins.provenance !== 'string' || !pins.provenance.trim()
      || JSON.stringify(pins.roots) !== JSON.stringify(roots) || !Array.isArray(pins.entries)) {
    throw new Error('Invalid app release manifest or build roots');
  }
  let previous = '';
  for (const entry of pins.entries) {
    safePath(entry.path);
    if (entry.path <= previous || !roots.some(base => entry.path === base || entry.path.startsWith(`${base}/`))) {
      throw new Error(`Duplicate, unordered or out-of-scope app release entry: ${entry.path}`);
    }
    previous = entry.path;
    const keys = Object.keys(entry).sort().join(',');
    if (entry.kind === 'directory' ? keys !== 'kind,path'
      : entry.kind !== 'file' || keys !== 'kind,path,sha256,size' || !Number.isSafeInteger(entry.size)
        || entry.size < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Invalid app release entry: ${entry.path}`);
  }
  const actual = await inventory(root, roots);
  const expected = new Map(pins.entries.map(entry => [entry.path, entry]));
  const observed = new Map(actual.map(entry => [entry.path, entry]));
  const problems = [];
  for (const entry of actual) {
    const pin = expected.get(entry.path);
    if (!pin) problems.push(`unexpected ${entry.path}`);
    else if (pin.kind !== entry.kind || pin.size !== entry.size || pin.sha256 !== entry.sha256) problems.push(`changed ${entry.path}`);
  }
  for (const entry of pins.entries) if (!observed.has(entry.path)) problems.push(`missing ${entry.path}`);
  if (problems.length) throw new Error(`App release ${pins.release} drift:\n${problems.join('\n')}`);
  return { release: pins.release, roots: roots.length, files: actual.filter(entry => entry.kind === 'file').length };
}
