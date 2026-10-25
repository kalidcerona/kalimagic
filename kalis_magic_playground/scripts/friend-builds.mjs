// Friend build generator: personal source (zz*) minus owner-only parts plus the per-app friend config.
//
//   node scripts/friend-builds.mjs list
//   node scripts/friend-builds.mjs generate <app|all> [--out DIR]     (default: a fresh OS temp dir)
//   node scripts/friend-builds.mjs compare [--report FILE]            (generate all, diff against distribution-snapshots)
//   node scripts/friend-builds.mjs generate <app|all> --write         (rewrites distribution-snapshots/<name>; ONLY on "친구용 반영")
//
// Without --write nothing under distribution-snapshots/ is ever touched.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRIEND_APPS } from './friend-config.mjs';
import { PRIVATE_PATTERNS, SHARED_UNLOCK_FILES, SETTINGS_UI_FILES, shouldCopyChoice, shouldCopyPimax } from './build-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOTS = path.join(ROOT, 'distribution-snapshots');
export const DEFAULT_REPORT = '/Users/sumpie/Desktop/AI/runtime/jobs/20261024-modularize/friend-compare.txt';
const TEXT_EXT = /\.(?:m?js|html|css|webmanifest)$/;
const CODE_EXT = /\.(?:m?js|html)$/;
const OWNER_FILE = /(?:^|\/)local-preview\.m?js$/;
const HOOK_MARK = 'local-preview-hook';
const FULLSCREEN_PATTERN = String.raw`(?:^|\/)fullscreen\.js$`;
const OWNER_WORDS = /local-preview|magic-local-settings|localSettingsReady/;

export const friendApps = () => Object.keys(FRIEND_APPS);

// Accepts the app name (release) or its snapshot folder name (unlock).
export function resolveApp(name) {
  const app = FRIEND_APPS[name] ? name : friendApps().find((key) => FRIEND_APPS[key].snapshot === name);
  if (!app) throw new Error(`Unknown friend app: ${name}. Known: ${friendApps().join(', ')}`);
  return app;
}

function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Owner-only hook. Returns { text, path } where path is 'marker', 'inline' or 'none'.
export function stripLocalPreview(text) {
  let path = 'none';
  const lines = text.split('\n');
  const kept = [];
  for (const line of lines) {
    if (!line.includes(HOOK_MARK)) { kept.push(line); continue; }
    path = 'marker';
    // The blank line that separated the hook from the code above it goes with it.
    if (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  }
  let next = kept.join('\n');
  const before = next;
  // Fallback for the older inline block (no marker, no separate file).
  next = next.replace(/(\n)\n?const localSettingsHost[^\n]*\nif \(localSettingsHost[\s\S]*?localSettingsReady = 'true';\n\}\n/, '$1');
  if (next !== before) path = path === 'none' ? 'inline' : 'marker+inline';
  // A shell-list entry for the removed file that lost its marker.
  next = next.replace(/^[ \t]*["']\.\/local-preview\.m?js["'],?[ \t]*\n/gm, '');
  return { text: next, path };
}

function findCacheLiteral(source) {
  const patterns = [/const CACHE_NAME = CACHE_PREFIX \+ '([^']*)'/, /CACHE=PREFIX\+'([^']*)'/];
  let found = null;
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match && (!found || match.index < found.index)) found = match;
  }
  return found;
}

// Drops the owner-only version tokens and adds the friend suffix. The family prefix is untouched.
export function friendCacheName(source, suffix = '') {
  const found = findCacheLiteral(source);
  if (!found) return source;
  let literal = found[1].replace(/-local-preview(?:-module)?-\d+/g, '');
  if (suffix && !literal.endsWith(suffix)) literal += suffix;
  return source.replace(found[0], found[0].replace(found[1], literal));
}

function replaceQuoted(text, from, to) {
  const pattern = new RegExp(`(['"\`])${escapeRegExp(from)}\\1`, 'g');
  let hits = 0;
  const next = text.replace(pattern, (_, quote) => { hits += 1; return `${quote}${to}${quote}`; });
  return { text: next, hits };
}

function applyManifest(text, cfg) {
  let next = text;
  if (cfg.manifestId) {
    next = /"id":\s*"[^"]*"/.test(next)
      ? next.replace(/("id":\s*)"[^"]*"/, `$1${JSON.stringify(cfg.manifestId)}`)
      : next.replace(/^\{\n/, `{\n  "id": ${JSON.stringify(cfg.manifestId)},\n`);
  }
  if (cfg.manifestStartUrl) next = next.replace(/("start_url":\s*)"[^"]*"/, `$1${JSON.stringify(cfg.manifestStartUrl)}`);
  return next;
}

async function walk(directory, base = directory, out = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

function isShipped(rel, cfg) {
  if (rel.split('/').some((part) => part.startsWith('.'))) return false;
  // Snapshots keep fullscreen.js (the publish step drops it), so only the other private patterns apply here.
  if (PRIVATE_PATTERNS.some((pattern) => pattern.source !== FULLSCREEN_PATTERN && pattern.test(rel))) return false;
  if (OWNER_FILE.test(rel) || (cfg.exclude || []).includes(rel)) return false;
  if (cfg.files === 'choice') return shouldCopyChoice(rel);
  if (cfg.files === 'pimax') return shouldCopyPimax(rel);
  if (cfg.files === 'unlock') return [...SHARED_UNLOCK_FILES, ...SETTINGS_UI_FILES].includes(rel);
  if (Array.isArray(cfg.files)) return cfg.files.includes(rel);
  return true;
}

export function transformFile(rel, bytes, cfg, report) {
  if (!TEXT_EXT.test(rel)) return bytes;
  let text = bytes.toString('utf8');
  if (CODE_EXT.test(rel)) {
    const stripped = stripLocalPreview(text);
    text = stripped.text;
    if (stripped.path !== 'none') report.hookPaths.push(`${rel}:${stripped.path}`);
  }
  if (rel === 'sw.js') text = friendCacheName(text, cfg.cacheSuffix);
  if (CODE_EXT.test(rel)) {
    (cfg.keys || []).forEach(([from, to, options], index) => {
      if (options?.files && !options.files.includes(rel)) return;
      const result = replaceQuoted(text, from, to);
      text = result.text;
      report.keyHits[index] += result.hits;
    });
  }
  for (const [file, from, to] of cfg.plain || []) {
    if (file !== rel) continue;
    const count = text.split(from).length - 1;
    if (count !== 1) report.warnings.push(`${rel}: plain replacement hit ${count} times: ${from}`);
    else { text = text.replace(from, to); report.plainHits += 1; }
  }
  if (rel === 'manifest.webmanifest') text = applyManifest(text, cfg);
  return Buffer.from(text);
}

// Resolves symlinks in the part of the path that exists and appends the rest, so a not-yet-created path is judged by where it would really land.
export async function realpathLoose(target) {
  let current = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      return path.join(await realpath(current), ...rest.reverse());
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

async function insideSnapshots(target) {
  return within(await realpathLoose(SNAPSHOTS), await realpathLoose(target));
}

// The report is a plain text file outside the app: never the snapshots, the personal apps, any other file of this checkout or a magic-* sibling.
export async function assertSafeReportPath(file) {
  const real = await realpathLoose(file);
  const projects = path.resolve(ROOT, '../..');
  const siblings = (await readdir(projects).catch(() => [])).filter((name) => name.startsWith('magic-'));
  const forbidden = [await realpathLoose(ROOT), ...await Promise.all(siblings.map((name) => realpathLoose(path.join(projects, name))))];
  if (forbidden.some((dir) => within(dir, real))) throw new Error(`Refusing to write the report inside the app tree: ${file}`);
  const existing = await lstat(file).catch(() => null);
  if (existing && !existing.isFile()) throw new Error(`Refusing to overwrite a non-regular report path: ${file}`);
}

async function filesEqual(a, b) {
  const [x, y] = await Promise.all([readFile(a).catch(() => null), readFile(b).catch(() => null)]);
  return Boolean(x && y && x.equals(y));
}

const CACHE_LITERAL_SLOT = '@@CACHE@@';
const withCacheSlot = (text) => {
  const found = findCacheLiteral(text);
  return found ? text.replace(found[0], found[0].replace(found[1], CACHE_LITERAL_SLOT)) : text;
};

// Installed friend phones only refetch when the worker's cache name changes. When anything the worker could precache differs from
// the baseline (the current snapshot) but the cache name does not, add -f<hash of the generated files>. When nothing else changed the baseline
// name is kept, so identical output stays byte-identical (and regenerating after a write reproduces the written snapshot).
export async function ensureFreshCacheName(outDir, baselineDir, files, tail = '') {
  const swPath = path.join(outDir, 'sw.js');
  const generated = await readFile(swPath, 'utf8').catch(() => null);
  const baseline = await readFile(path.join(baselineDir, 'sw.js'), 'utf8').catch(() => null);
  const found = generated && findCacheLiteral(generated);
  if (!found || baseline === null) return null;
  const baseLiteral = findCacheLiteral(baseline)?.[1];
  let changed = withCacheSlot(generated) !== withCacheSlot(baseline);
  const hash = createHash('sha256');
  for (const rel of [...files].sort()) {
    if (rel === 'sw.js') continue;
    const bytes = await readFile(path.join(outDir, rel));
    hash.update(rel).update(bytes);
    if (!changed && !(await filesEqual(path.join(outDir, rel), path.join(baselineDir, rel)))) changed = true;
  }
  const mark = `-f${hash.digest('hex').slice(0, 8)}`;
  const generatedLiteral = found[1];
  // Keep a trailing family suffix such as -distribution last.
  const bumped = tail && generatedLiteral.endsWith(tail) ? `${generatedLiteral.slice(0, -tail.length)}${mark}${tail}` : `${generatedLiteral}${mark}`;
  if (!changed) {
    // Nothing a phone could notice changed: keep the baseline name (and so the baseline bytes), including its own suffix.
    if (baseLiteral && baseLiteral !== generatedLiteral) {
      await writeFile(swPath, generated.replace(found[0], found[0].replace(generatedLiteral, baseLiteral)));
      return null;
    }
    return null;
  }
  if (baseLiteral !== generatedLiteral) return null;
  await writeFile(swPath, generated.replace(found[0], found[0].replace(generatedLiteral, bumped)));
  return bumped;
}

// Writes the friend build of one app into outDir and nothing else. sourceDir is only for RELEASE promotion from its sibling checkout.
// baselineDir is the build to stay compatible with (default: the current snapshot); it only decides the cache name.
export async function generate(app, outDir, { write = false, sourceDir, baselineDir } = {}) {
  const cfg = FRIEND_APPS[app];
  if (!cfg) throw new Error(`Unknown friend app: ${app}`);
  if (!outDir) throw new Error('generate needs an output directory');
  if (!write && await insideSnapshots(outDir)) throw new Error(`Refusing to write into distribution-snapshots without --write: ${outDir}`);
  const source = sourceDir ? path.resolve(sourceDir) : path.join(ROOT, cfg.source);
  const report = { app, warnings: [], hookPaths: [], keyHits: (cfg.keys || []).map(() => 0), plainHits: 0, files: [], cacheBump: null };
  await mkdir(outDir, { recursive: true });
  const realOut = await realpath(outDir);
  for (const rel of await walk(source)) {
    if (!isShipped(rel, cfg)) continue;
    const output = transformFile(rel, await readFile(path.join(source, rel)), cfg, report);
    const destination = path.join(outDir, rel);
    // Judge by where the write really lands, and never write through an existing symlink.
    const realParent = await realpathLoose(path.dirname(destination));
    if (!within(realOut, realParent)) throw new Error(`Refusing to write outside the output directory: ${rel}`);
    if (!write && within(await realpathLoose(SNAPSHOTS), realParent)) throw new Error(`Refusing to write into distribution-snapshots without --write: ${rel}`);
    const existing = await lstat(destination).catch(() => null);
    if (existing?.isSymbolicLink()) throw new Error(`Refusing to write through a symlink: ${rel}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, output);
    report.files.push(rel);
  }
  (cfg.keys || []).forEach(([from], index) => { if (!report.keyHits[index]) report.warnings.push(`key rewrite never matched: ${from}`); });
  const plainWanted = (cfg.plain || []).length;
  if (report.plainHits !== plainWanted) report.warnings.push(`plain replacements applied ${report.plainHits}/${plainWanted}`);
  report.cacheBump = await ensureFreshCacheName(outDir, baselineDir || path.join(SNAPSHOTS, cfg.snapshot), report.files, cfg.cacheSuffix);
  for (const rel of report.files) {
    if (!TEXT_EXT.test(rel)) continue;
    const text = await readFile(path.join(outDir, rel), 'utf8');
    if (OWNER_WORDS.test(text)) report.warnings.push(`owner-only text left in ${rel}`);
    for (const source of cfg.leak || []) if (new RegExp(source).test(text)) report.warnings.push(`personal key left in ${rel}: /${source}/`);
  }
  return report;
}

// "친구용 반영": replace distribution-snapshots/<name> with a fresh build. Explicit callers only.
export async function writeFriendBuild(app, { sourceDir, targetDir } = {}) {
  const cfg = FRIEND_APPS[app];
  const target = targetDir || path.join(SNAPSHOTS, cfg.snapshot);
  const staging = await mkdtemp(path.join(os.tmpdir(), `friend-${app}-`));
  try {
    const report = await generate(app, staging, { sourceDir, baselineDir: target });
    if (report.warnings.length) throw new Error(`Refusing to write ${app}: ${report.warnings.join('; ')}`);
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await cp(staging, target, { recursive: true });
    return report;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

const keyLiterals = (text) => new Set([...text.matchAll(/(['"`])([A-Za-z0-9_.\-]{4,})\1/g)].map((m) => m[2]).filter((x) => /[._\-]/.test(x)));

function changedLines(a, b) {
  try {
    execFileSync('diff', ['-U0', a, b], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { removed: 0, added: 0 };
  } catch (error) {
    const lines = String(error.stdout || '').split('\n');
    return {
      removed: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length,
      added: lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length
    };
  }
}

export async function compareApp(app, generatedDir) {
  const cfg = FRIEND_APPS[app];
  const snapDir = path.join(SNAPSHOTS, cfg.snapshot);
  const gen = new Set(await walk(generatedDir));
  const snap = new Set(await walk(snapDir));
  const result = { app, snapshot: cfg.snapshot, onlyGenerated: [], onlySnapshot: [], changed: [], same: 0, keyDeltas: [], cacheName: null };
  for (const rel of gen) if (!snap.has(rel)) result.onlyGenerated.push(rel);
  for (const rel of snap) if (!gen.has(rel)) result.onlySnapshot.push(rel);
  for (const rel of gen) {
    if (!snap.has(rel)) continue;
    const [a, b] = await Promise.all([readFile(path.join(snapDir, rel)), readFile(path.join(generatedDir, rel))]);
    if (a.equals(b)) { result.same += 1; continue; }
    if (!TEXT_EXT.test(rel)) { result.changed.push({ rel, binary: true }); continue; }
    const lines = changedLines(path.join(snapDir, rel), path.join(generatedDir, rel));
    result.changed.push({ rel, ...lines });
    const A = keyLiterals(a.toString('utf8'));
    const B = keyLiterals(b.toString('utf8'));
    const snapOnly = [...A].filter((x) => !B.has(x));
    const genOnly = [...B].filter((x) => !A.has(x));
    if (snapOnly.length || genOnly.length) result.keyDeltas.push({ rel, snapOnly, genOnly });
    if (rel === 'sw.js') {
      const pick = (buf) => findCacheLiteral(buf.toString('utf8'))?.[1] ?? null;
      result.cacheName = { snapshot: pick(a), generated: pick(b) };
    }
  }
  return result;
}

export function formatCompare(results, reports) {
  const out = [`Friend build compare (generated from personal source vs current distribution-snapshots)`, ''];
  for (const r of results) {
    const rep = reports[r.app];
    out.push(`== ${r.app}  (${FRIEND_APPS[r.app].source} -> distribution-snapshots/${r.snapshot})`);
    out.push(`  files: ${r.same} identical, ${r.changed.length} changed, ${r.onlyGenerated.length} only in generated, ${r.onlySnapshot.length} only in snapshot`);
    if (rep.cacheBump) out.push(`  cache name: content changed, version suffix added -> ${rep.cacheBump}`);
    out.push(`  local-preview removal path: ${rep.hookPaths.length ? rep.hookPaths.join(', ') : 'nothing to remove'}`);
    if (rep.warnings.length) out.push(`  WARNINGS: ${rep.warnings.join(' | ')}`);
    for (const rel of r.onlyGenerated) out.push(`  + only generated: ${rel}`);
    for (const rel of r.onlySnapshot) out.push(`  - only snapshot:  ${rel}`);
    for (const c of r.changed) out.push(`  ~ ${c.rel}: ${c.binary ? 'binary differs' : `-${c.removed}/+${c.added} lines`}`);
    if (r.cacheName) out.push(`  cache version: snapshot "${r.cacheName.snapshot}" -> generated "${r.cacheName.generated}"`);
    for (const d of r.keyDeltas) {
      if (d.snapOnly.length) out.push(`  key-like literals only in snapshot (${d.rel}): ${d.snapOnly.join(' ')}`);
      if (d.genOnly.length) out.push(`  key-like literals only in generated (${d.rel}): ${d.genOnly.join(' ')}`);
    }
    out.push('');
  }
  return out.join('\n');
}

async function main(argv) {
  const [command, target, ...rest] = argv;
  const flag = (name) => rest.includes(name) || target === name;
  const option = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  if (command === 'list') {
    for (const [app, cfg] of Object.entries(FRIEND_APPS)) console.log(`${app}\t${cfg.source}\t-> distribution-snapshots/${cfg.snapshot}`);
    return;
  }
  const apps = !target || target.startsWith('--') || target === 'all' ? friendApps() : [resolveApp(target)];
  if (command === 'generate') {
    if (flag('--write')) {
      for (const app of apps) { const rep = await writeFriendBuild(app); console.log(`wrote distribution-snapshots/${FRIEND_APPS[app].snapshot} (${rep.files.length} files)`); }
      return;
    }
    const out = option('--out') || await mkdtemp(path.join(os.tmpdir(), 'friend-builds-'));
    for (const app of apps) {
      const rep = await generate(app, path.join(out, FRIEND_APPS[app].snapshot));
      console.log(`${app}: ${rep.files.length} files${rep.warnings.length ? ` WARNINGS ${rep.warnings.join(' | ')}` : ''}`);
    }
    console.log(`output: ${out}`);
    return;
  }
  if (command === 'compare') {
    const out = await mkdtemp(path.join(os.tmpdir(), 'friend-compare-'));
    const results = [];
    const reports = {};
    try {
      for (const app of friendApps()) {
        reports[app] = await generate(app, path.join(out, app));
        results.push(await compareApp(app, path.join(out, app)));
      }
    } finally { await rm(out, { recursive: true, force: true }); }
    const text = formatCompare(results, reports);
    const file = option('--report') || DEFAULT_REPORT;
    await assertSafeReportPath(file);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
    console.log(text);
    console.log(`report written to ${file}`);
    return;
  }
  throw new Error('Usage: node scripts/friend-builds.mjs list | generate <app|all> [--out DIR | --write] | compare [--report FILE]');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
