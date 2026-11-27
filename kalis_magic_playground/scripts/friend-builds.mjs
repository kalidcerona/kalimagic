// Explicit private-source generator for asrai, alter and uramichi. Existing public snapshots are canonical.
//
//   node scripts/friend-builds.mjs list
//   node scripts/friend-builds.mjs generate <asrai|alter|uramichi> --source DIR --out DIR
//   node scripts/friend-builds.mjs generate <asrai|alter|uramichi> --source DIR --write
//
// Without --write nothing under distribution-snapshots/ is ever touched.
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRIEND_APPS } from './friend-config.mjs';
import { PRIVATE_PATTERNS, SHARED_UNLOCK_FILES, SETTINGS_UI_FILES, shouldCopyChoice, shouldCopyPimax } from './build-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOTS = path.join(ROOT, 'distribution-snapshots');
const TEXT_EXT = /\.(?:m?js|html|css|webmanifest)$/;
const CODE_EXT = /\.(?:m?js|html)$/;
// Launch readiness is personal-only, just like the local preview hook.
const OWNER_FILE = /(?:^|\/)(?:local-preview\.m?js|launch-check\.js|photo-save-notice\.js|performance-log\.js)$/;
const HOOK_MARK = 'local-preview-hook';
const FULLSCREEN_PATTERN = String.raw`(?:^|\/)fullscreen\.js$`;
const OWNER_WORDS = /local-preview|magic-local-settings|localSettingsReady/;

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
  next = next
    .replace(/^import \{ startLaunchCheck \} from ["']\.\/launch-check\.js["'];\n/gm, '')
    .replace(/^startLaunchCheck\(\);\n/gm, '')
    .replace(/^[ \t]*["']\.\/launch-check\.js["'],?[ \t]*\n/gm, '');
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
  let literal = found[1].replace(/-local-preview(?:-module)?-\d+/g, '').replace(/-launch-check-\d+/g, '').replace(/-perf-log-\d+/g, '');
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
      : next.replace(/^\{(\n?)/, (_, newline) => `{${newline}  "id": ${JSON.stringify(cfg.manifestId)},${newline}`);
  }
  if (cfg.manifestStartUrl) next = next.replace(/("start_url":\s*)"[^"]*"/, `$1${JSON.stringify(cfg.manifestStartUrl)}`);
  if (cfg.manifestScope) next = next.replace(/("scope":\s*)"[^"]*"/, `$1${JSON.stringify(cfg.manifestScope)}`);
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
  // A file the baseline shipped but the new build no longer does (for example a deleted image) is a change too.
  const built = new Set(files);
  for (const rel of await walk(baselineDir).catch(() => [])) if (!built.has(rel)) changed = true;
  const hash = createHash('sha256');
  hash.update(withCacheSlot(generated));
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
  await writeFile(swPath, generated.replace(found[0], found[0].replace(generatedLiteral, bumped)));
  return bumped;
}

// Generate one approved new public app from an explicit private source into outDir.
// baselineDir is the build to stay compatible with (default: the current snapshot); it only decides the cache name.
export async function generate(app, outDir, { sourceDir, baselineDir } = {}) {
  const cfg = FRIEND_APPS[app];
  if (!cfg?.generated || !sourceDir) throw new Error('Personal app generation is retired except asrai/alter/uramichi with explicit --source DIR; canonical snapshots must never be generation inputs.');
  if (!outDir) throw new Error('generate needs an output directory');
  if (await insideSnapshots(outDir)) throw new Error(`Refusing to write into distribution-snapshots without --write: ${outDir}`);
  const source = await realpath(path.resolve(sourceDir));
  if (await insideSnapshots(source)) throw new Error('Canonical snapshots cannot be generator inputs');
  const output = await realpathLoose(outDir);
  if (within(source, output) || within(output, source)) throw new Error('Source and output must not overlap');
  const existingOut = await lstat(outDir).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (existingOut && (existingOut.isSymbolicLink() || !existingOut.isDirectory() || (await readdir(outDir)).length)) {
    throw new Error('Output must be a new or empty non-symlink directory');
  }
  const report = { app, warnings: [], hookPaths: [], keyHits: (cfg.keys || []).map(() => 0), plainHits: 0, files: [], cacheBump: null };
  await mkdir(outDir, { recursive: true });
  const realOut = await realpath(outDir);
  for (const rel of await walk(source)) {
    if (!isShipped(rel, cfg)) continue;
    const input = await readFile(path.join(source, rel));
    const personalOnly = /\.(?:js|html)$/.test(rel) ? Buffer.from(stripPerformanceLog(stripPhotoSaveNotice(input.toString()))) : input;
    const output = transformFile(rel, personalOnly, cfg, report);
    const destination = path.join(outDir, rel);
    // Judge by where the write really lands, and never write through an existing symlink.
    const realParent = await realpathLoose(path.dirname(destination));
    if (!within(realOut, realParent)) throw new Error(`Refusing to write outside the output directory: ${rel}`);
    if (within(await realpathLoose(SNAPSHOTS), realParent)) throw new Error(`Refusing to write into distribution-snapshots without --write: ${rel}`);
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
  if (!cfg?.generated || !sourceDir) throw new Error('Personal app generation is retired except asrai/alter/uramichi with explicit --source DIR');
  const expected = path.join(SNAPSHOTS, cfg.snapshot);
  const target = targetDir ? path.resolve(targetDir) : expected;
  if (target !== expected) throw new Error('Write target must be the configured canonical snapshot');
  const targetInfo = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (targetInfo && (!targetInfo.isDirectory() || targetInfo.isSymbolicLink())) throw new Error('Unsafe canonical target');
  const source = await realpath(sourceDir);
  const realTarget = await realpathLoose(target);
  if (await insideSnapshots(source) || within(source, realTarget) || within(realTarget, source)) throw new Error('Source and target must not overlap');
  if (realTarget !== path.join(await realpath(SNAPSHOTS), cfg.snapshot)) throw new Error('Unsafe canonical target path');
  const staging = await mkdtemp(path.join(ROOT, `.friend-${app}-`));
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

async function main(argv) {
  const [command, target] = argv;
  if (command === 'list' && argv.length === 1) {
    for (const [app, cfg] of Object.entries(FRIEND_APPS)) console.log(`${app}\tdistribution-snapshots/${cfg.snapshot}${cfg.generated ? ' (explicit private source supported)' : ' (canonical)'}`);
    return;
  }
  const sourceIndex = argv.indexOf('--source');
  const sourceDir = sourceIndex >= 0 ? argv[sourceIndex + 1] : undefined;
  if (command !== 'generate' || !sourceDir || !FRIEND_APPS[target]?.generated) {
    throw new Error('Personal app generation is retired except: generate <asrai|alter|uramichi> --source DIR [--out DIR | --write]');
  }
  const outIndex = argv.indexOf('--out');
  const out = outIndex >= 0 ? argv[outIndex + 1] : undefined;
  const write = argv.includes('--write');
  if (write === Boolean(out)) throw new Error('Choose exactly one of --out DIR or --write');
  const report = write ? await writeFriendBuild(target, { sourceDir }) : await generate(target, out, { sourceDir });
  if (report.warnings.length) throw new Error(report.warnings.join('; '));
  console.log(`${target}: ${report.files.length} files`);
}

export const PERFORMANCE_LOG_CACHE_SUFFIX = '-perf-log-1';

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));

// Job J (2026-11-07): the performance log is personal-only. Friend generation drops the
// module, its hooks and the cache token so pinned snapshots stay byte-identical.
export function stripPerformanceLog(source) {
  return source
    .replace(/^import \{[^}\n]*\} from ["']\.\/performance-log\.js["'];\n/gm, '')
    .replace(/^[ \t]*recordCompletedTest\([^;\n]*\);\n/gm, '')
    .replace(/^[ \t]*recordChoiceReveal\([^;\n]*\);\n/gm, '')
    .replace(/^[ \t]*mountPerformanceLog\(\);\n/gm, '')
    .replace(/^[ \t]*["']\.\/performance-log\.js["'],?[ \t]*\n/gm, '')
    .replaceAll(PERFORMANCE_LOG_CACHE_SUFFIX, '');
}

// Job I (2026-11-07): photo diagnostics are personal-only. Keep future friend generation
// import-complete without promoting this feature or changing the pinned snapshots.
export function stripPhotoSaveNotice(source) {
  return source
    .replace(/^import \{[^\n]*\} from '\.\/photo-save-notice\.js';\n/gm, '')
    .replace(/^.*<p id="photo-save-notice"[^\n]*\n/gm, '')
    .replace(/^[ \t]*["']\.\/photo-save-notice\.js["'],?[^\n]*\n/gm, '')
    .replace(/-photo-notice-1/g, '')
    .replace(/^.*observePhotoTransaction\(tx\);[^\n]*\n/gm, '')
    .replace(/^.*recordPhotoSave\((?:true|false)(?:, storage)?\);[^\n]*\n/gm, '')
    .replace(/^[ \t]*return trackPhotoSave\(async \(\) => \{\n/gm, '')
    .replace(/^[ \t]*\}\); \/\/ photo-notice-wrapper\n/gm, '')
    .replace('return trackPhotoSave(() => new Promise((resolve, reject) => {', 'return new Promise((resolve, reject) => {')
    .replace('})); // photo-notice-wrapper', '});');
}
