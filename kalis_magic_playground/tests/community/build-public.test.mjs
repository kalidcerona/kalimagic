import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, PUBLIC_DIRS, PRIVATE_PATTERNS, MIRROR_PAIRS, DISTRIBUTION_APPS, SHARED_UNLOCK_FILES, CHOICE_FILES, USOTSUKI_FILES, ALETHEIA_COURT_FILES, buildPublic } from '../../scripts/build-public.mjs';

test('public build allowlist includes visible site pages', () => {
  assert.ok(PUBLIC_FILES.includes('index.html'));
  assert.ok(PUBLIC_FILES.includes('reviews.html'));
  assert.ok(PUBLIC_FILES.includes('admin.js'));
  assert.ok(PUBLIC_FILES.includes('style.css'));
  assert.ok(PUBLIC_FILES.includes('nav.js'));
  assert.ok(PUBLIC_FILES.includes('pg-util.js'));
  assert.ok(PUBLIC_FILES.includes('invite-client.js'));
  assert.ok(PUBLIC_FILES.includes('reveal.js'));
  assert.ok(PUBLIC_FILES.includes('track.js'));
  assert.ok(PUBLIC_FILES.includes('playground-api.js'));
  assert.ok(PUBLIC_FILES.includes('playground-list.js'));
  assert.ok(PUBLIC_FILES.includes('playground-compose.js'));
  assert.ok(PUBLIC_FILES.includes('playground-detail.js'));
  assert.ok(PUBLIC_DIRS.includes('assets'));
});

test('public build explicitly excludes local planning and source folders', () => {
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('MAGIC-PLAYGROUND-PRD.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('COMMUNITY-MVP-DESIGN.md')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('netlify/functions/posts.mjs')));
  assert.ok(PRIVATE_PATTERNS.some((pattern) => pattern.test('distribution-snapshots/unlock/index.html')));
  assert.equal(PUBLIC_DIRS.includes('netlify'), false);
  assert.equal(PUBLIC_DIRS.includes('supabase'), false);
  assert.equal(PUBLIC_DIRS.includes('distribution-snapshots'), false);
});

test('unfinished FALSE MEMORY is excluded from the public build', () => {
  assert.deepEqual(PUBLIC_DIRS.filter((entry) => /^zz\d+$/.test(entry)), ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7']);
  assert.equal(MIRROR_PAIRS.some(([, mirror]) => mirror.startsWith('zz9/')), false);
});

test('public build mirrors the current calculator and integrated stopwatch sources', () => {
  for (const file of ['index.html', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon.svg', 'manifest.webmanifest', 'brand-logo.jpg']) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-calculator-v2/${file}` && mirror === `zz3/${file}`), `calculator ${file}`);
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-stopwatch-uni/${file}` && mirror === `zz1/${file}`), `stopwatch ${file}`);
  }
  assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
    source === '../../magic-calculator-v2/brand-logo.jpg' && mirror === 'zz3/brand-logo.jpg'));
  for (const file of CHOICE_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-choice/${file}` && mirror === `zz4/${file}`), `choice ${file}`);
  }
  for (const [source, route] of [['magic-aletheia', 'zz5'], ['magic-tobira', 'zz6']]) {
    for (const file of CHOICE_FILES) {
      assert.ok(MIRROR_PAIRS.some(([original, mirror]) =>
        original === `../../${source}/${file}` && mirror === `${route}/${file}`), `${route} ${file}`);
    }
  }
  for (const file of USOTSUKI_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-usotsuki/${file}` && mirror === `zz7/${file}`), `zz7 ${file}`);
  }
  assert.equal(ALETHEIA_COURT_FILES.length, 12);
  for (const file of ALETHEIA_COURT_FILES) {
    assert.ok(MIRROR_PAIRS.some(([source, mirror]) =>
      source === `../../magic-aletheia/${file}` && mirror === `zz5/${file}`), `zz5 ${file}`);
  }
  for (const [source, route] of [
    ['magic-stopwatch-uni', 'zz1'],
    ['magic-unlock', 'zz2'],
    ['magic-calculator-v2', 'zz3'],
    ['magic-calculator-v2', 'tools/calc'],
    ['magic-choice', 'zz4'],
    ['magic-aletheia', 'zz5'],
    ['magic-tobira', 'zz6'],
    ['magic-usotsuki', 'zz7']
  ]) {
    assert.ok(MIRROR_PAIRS.some(([original, mirror]) =>
      original === `../../${source}/brand-logo.png` && mirror === `${route}/brand-logo.png`), `${route} high-resolution logo`);
  }
  assert.equal(MIRROR_PAIRS.some(([, mirror]) => mirror.startsWith('zz8/')), false);
  assert.deepEqual(DISTRIBUTION_APPS, [
    { source: 'distribution-snapshots/unlock', target: 'unlock', tool: 'unlock' },
    { source: 'zz1', target: 'stopwatch-uni', tool: 'stopwatch-uni' },
    { source: 'zz1', target: 'stopwatch', tool: 'stopwatch' }
  ]);
});

test('public build serves integrated stopwatch on both retained entitlement routes', async () => {
  await buildPublic();
  const personalStopwatch = await readFile(new URL('../../dist/zz1/index.html', import.meta.url), 'utf8');
  const sharedUnlock = await readFile(new URL('../../dist/tools/unlock/index.html', import.meta.url), 'utf8');
  const sharedStopwatch = await readFile(new URL('../../dist/tools/stopwatch-uni/index.html', import.meta.url), 'utf8');
  const legacyStopwatch = await readFile(new URL('../../dist/tools/stopwatch/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(personalStopwatch, /id="friend-apps-check"/);
  assert.match(sharedUnlock, /id="friend-apps-check"/);
  assert.match(sharedUnlock, /tools\/_check\?tool=unlock/);
  assert.match(sharedStopwatch, /id="friend-apps-check"/);
  assert.match(sharedStopwatch, /tools\/_check\?tool=stopwatch-uni/);
  assert.match(legacyStopwatch, /tools\/_check\?tool=stopwatch/);
  const stripGate = (html) => html.replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, '');
  assert.equal(stripGate(legacyStopwatch), stripGate(sharedStopwatch));
  await stat(new URL('../../dist/zz4/index.html', import.meta.url));
  await stat(new URL('../../dist/zz5/index.html', import.meta.url));
  await stat(new URL('../../dist/zz6/index.html', import.meta.url));
  await stat(new URL('../../dist/zz7/index.html', import.meta.url));
  await assert.rejects(stat(new URL('../../dist/zz7/app.js', import.meta.url)), { code: 'ENOENT' });
  await assert.rejects(stat(new URL('../../dist/zz8/index.html', import.meta.url)), { code: 'ENOENT' });
  await assert.rejects(stat(new URL('../../dist/zz9/index.html', import.meta.url)), { code: 'ENOENT' });
});

test('admin distribution catalog lists one integrated stopwatch while keeping its canonical route', async () => {
  const admin = await readFile(new URL('../../admin.html', import.meta.url), 'utf8');
  assert.match(admin, /data-app-card="stopwatch-uni"/);
  assert.match(admin, /data-copy-link="\/tools\/stopwatch-uni\/"/);
  assert.match(admin, /<h3>KAIROS<\/h3>/);
  assert.match(admin, /<h3>HITSUZEN<\/h3>/);
  assert.match(admin, /<h3>레리즈<\/h3>/);
  assert.doesNotMatch(admin, /data-app-card="stopwatch"/);
  assert.doesNotMatch(admin, /data-copy-link="\/tools\/stopwatch\/"/);
});

test('shared unlock stays on the pinned snapshot until explicit promotion', async () => {
  await buildPublic();
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const source = path.join(root, 'distribution-snapshots', 'unlock');
  const target = path.join(root, 'dist', 'tools', 'unlock');
  const copiedFiles = (await readdir(target)).sort();
  assert.deepEqual(copiedFiles, [...SHARED_UNLOCK_FILES].sort());

  const manifest = JSON.parse(await readFile(path.join(source, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(SHARED_UNLOCK_FILES.includes(icon.src.replace(/^\.\//, '')), `Missing manifest icon: ${icon.src}`);
  }

  for (const file of SHARED_UNLOCK_FILES) {
    const [snapshot, distributed] = await Promise.all([
      readFile(path.join(source, file)),
      readFile(path.join(target, file))
    ]);
    if (file === 'index.html') {
      const withoutGuard = distributed.toString('utf8').replace(/\n  <script id="friend-apps-check">[\s\S]*?<\/script>/, '');
      assert.equal(withoutGuard, snapshot.toString('utf8'));
    } else {
      assert.deepEqual(distributed, snapshot, file);
    }
  }
});

test('public build does not copy dotfiles from public directories', async () => {
  await buildPublic();
  await assert.rejects(
    stat(new URL('../../dist/kalimeeting/.DS_Store', import.meta.url)),
    /ENOENT/
  );
});

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  }));
  return files.flat();
}

function localAssetPath(htmlFile, value, distDir) {
  if (!value) return null;
  const withoutFragment = value.split('#')[0];
  const cleanValue = withoutFragment.split('?')[0];
  if (!cleanValue || cleanValue.startsWith('#')) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(cleanValue)) return null;
  if (/^(?:mailto|tel|data|javascript):/i.test(cleanValue)) return null;
  const decoded = decodeURIComponent(cleanValue);
  if (decoded.startsWith('/')) return path.join(distDir, decoded);
  return path.resolve(path.dirname(htmlFile), decoded);
}

test('public build includes every local src and href referenced by dist html', async () => {
  await buildPublic();
  const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
  const htmlFiles = await listHtmlFiles(distDir);
  const missing = [];

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      const assetPath = localAssetPath(htmlFile, match[1], distDir);
      if (!assetPath) continue;
      if (!assetPath.startsWith(distDir + path.sep)) {
        missing.push(`${path.relative(distDir, htmlFile)} -> ${match[1]}`);
        continue;
      }
      try {
        await stat(assetPath);
      } catch {
        missing.push(`${path.relative(distDir, htmlFile)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(missing.sort(), []);
});
