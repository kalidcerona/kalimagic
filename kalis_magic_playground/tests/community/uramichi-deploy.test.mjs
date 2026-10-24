// URAMICHI web app (zz15): publication boundary, PWA metadata, offline shell, camera headers and copy rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { PUBLIC_DIRS, URAMICHI_FILES } from '../../scripts/build-public.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, 'zz15', file), 'utf8');
const shell = ['index.html', 'style.css', 'app.mjs', 'dom.mjs', 'presets.mjs', 'detect.mjs', 'chrome.mjs', 'scan.mjs', 'camera.mjs', 'core.mjs', 'core-model.mjs', 'core-url.mjs', 'core-encode.mjs', 'core-scan.mjs', 'core-gate.mjs', 'core-card.mjs', 'core-resolve.mjs', 'core-logic.mjs', 'core-json.mjs', 'picker.mjs', 'install-ui.js', 'manifest.webmanifest', 'brand-logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'vendor/jsQR.js', 'vendor/LICENSE-jsqr.txt'];

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...await listFiles(path.join(dir, entry.name), prefix + entry.name + '/'));
    else out.push(prefix + entry.name);
  }
  return out;
}

test('zz15 publishes only its explicit shell in an isolated build', async () => {
  assert.ok(PUBLIC_DIRS.includes('zz15'));
  assert.deepEqual([...URAMICHI_FILES].sort(), [...shell, 'sw.js'].sort());
  const temp = await mkdtemp(path.join(tmpdir(), 'uramichi-deploy-'));
  try {
    const site = path.join(temp, 'site');
    await cp(root, site, { recursive: true, filter: (source) => !['node_modules', 'dist', '.git'].includes(path.relative(root, source).split(path.sep)[0]) });
    await writeFile(path.join(site, 'zz15', 'draft.txt'), 'private fixture');
    await writeFile(path.join(site, 'zz15', 'vendor', 'notes.json'), '{}');
    const result = spawnSync(process.execPath, ['scripts/build-public.mjs'], { cwd: site, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: 'true' } });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const mirrorLog = `${result.stdout}\n${result.stderr}`;
    assert.equal((mirrorLog.match(/WARNING: mirror check skipped on CI: \d+ sibling sources absent/g) || []).length, 1, mirrorLog);
    assert.equal(mirrorLog.includes('mirror check skipped:'), false);
    const published = path.join(site, 'dist', 'zz15');
    assert.deepEqual((await listFiles(published)).sort(), [...shell, 'sw.js'].sort());
    for (const file of [...shell, 'sw.js']) assert.deepEqual(await readFile(path.join(published, file)), await readFile(path.join(root, 'zz15', file)), file);
    const html = await readFile(path.join(published, 'index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) assert.ok((await stat(path.join(published, match[1]))).isFile(), match[1]);
    for (const file of shell.filter((name) => name.endsWith('.mjs') || name.endsWith('.js'))) {
      for (const match of (await readFile(path.join(published, file), 'utf8')).matchAll(/from '(\.\/[^']+)'/g)) assert.ok((await stat(path.join(published, match[1]))).isFile(), `${file} ${match[1]}`);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('zz15 has its own standalone identity, PNG icons, camera permission and Netlify headers', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  for (const key of ['name', 'short_name']) assert.equal(manifest[key], 'URAMICHI');
  for (const key of ['start_url', 'scope']) assert.equal(manifest[key], './');
  assert.equal(manifest.id, undefined, 'identity comes from the start URL, like the other zz apps');
  assert.equal(manifest.display, 'standalone');
  for (const key of ['background_color', 'theme_color']) assert.equal(manifest[key], '#000000');
  for (const [index, size] of [192, 512, 192, 512].entries()) {
    const bytes = await readFile(path.join(root, 'zz15', manifest.icons[index].src));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
  }
  const html = await read('index.html');
  for (const pattern of [/^<!DOCTYPE html>/, /<html lang="ko">/, /viewport-fit=cover/, /name="theme-color" content="#000000"/, /rel="manifest" href="\.\/manifest.webmanifest"/, /<title>URAMICHI<\/title>/, /alt="URAMICHI ウラミチ 로고"/]) assert.match(html, pattern);
  const headers = await readFile(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(headers, /for = "\/zz15\/manifest\.webmanifest"\s+\[headers.values\]\s+Content-Type = "application\/manifest\+json"/);
  assert.match(headers, /for = "\/zz15\/sw\.js"\s+\[headers.values\]\s+Content-Type = "application\/javascript; charset=utf-8"\s+Cache-Control = "no-store, no-cache"/);
  for (const route of ['/zz15', '/zz15/\\*']) assert.match(headers, new RegExp(`for = "${route}"\\s+\\[headers.values\\]\\s+Permissions-Policy = "camera=\\(self\\)`));
  const license = await read('vendor/LICENSE-jsqr.txt');
  assert.match(license, /Apache License/);
  assert.deepEqual(await readFile(path.join(root, 'zz15', 'vendor', 'jsQR.js')), await readFile(path.join(root, 'zz13', 'vendor', 'jsQR.js')));
});

test('zz15 worker precaches the whole shell, serves it offline and ignores other paths', async () => {
  const source = await read('sw.js');
  const scope = 'https://example.com/zz15/';
  const cached = new Map(), names = [];
  const cache = { async addAll(requests) { for (const r of requests) cached.set(r.url, new Response(r.url)); }, async match(url) { return cached.get(url)?.clone(); } };
  const caches = { async open(name) { names.push(name); return cache; }, async keys() { return []; }, async delete() {} };
  const listeners = {};
  const context = vm.createContext({ URL, Request, Response, Set, caches, fetch: async () => { throw new Error('offline'); },
    self: { registration: { scope }, clients: { claim() {} }, skipWaiting() {}, addEventListener(type, handler) { listeners[type] = handler; } } });
  vm.runInContext(source, context);
  let pending;
  listeners.install({ waitUntil(value) { pending = value; } }); await pending;
  assert.ok(names[0].startsWith('uramichi-web-'));
  assert.match(names[0], /v20261024-web-5-modules-2$/);
  assert.deepEqual([...cached.keys()].sort(), shell.map((file) => new URL(file, scope).href).sort());
  for (const file of ['', ...shell.filter((f) => f !== 'manifest.webmanifest')]) {
    listeners.fetch({ request: new Request(new URL(file, scope)), respondWith(value) { pending = value; } });
    assert.equal((await pending).status, 200, file);
  }
  for (const url of ['https://example.com/zz14/', new URL('notes.txt', scope).href]) {
    let intercepted = false;
    listeners.fetch({ request: new Request(url), respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});

test('zz15 keeps the brand copy, footer, wake lock, gesture and storage rules without fullscreen, forbidden punctuation or vendor content', async () => {
  const html = await read('index.html');
  const dom = await read('dom.mjs'), presets = await read('presets.mjs'), scan = await read('scan.mjs'), camera = await read('camera.mjs');
  for (const text of ['<p class="catalog-label">샛길</p>', 'class="settingsbrand"', 'class="identity"', '<details class="overview">', '샛길', 'URAMICHI <span class="reading">ウラミチ</span>', '보이는 경로 너머의 다른 목적지.',
    '裏道(うらみち)는 뒷길, 샛길을 뜻하는 말임.', '표지판이나 코드가 가리키는 길 뒤에 또 다른 길이 숨어 있다는 발상임.', '겉으로 보이는 정보와 실제로 도착하는 곳 사이의 틈에서 시작하는 마술임.',
    '하나의 표지판 뒤에는 우리가 알지 못하는 다른 길이 숨어 있을지도 모름.', 'URAMICHI는 보이는 경로 너머에 존재하는 또 하나의 목적지를 찾아가는 도구임.', '같은 창에서 열기', '안드로이드 앱의 기본 브라우저 방식은 웹 앱에서는 쓸 수 없습니다.']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.indexOf('class="settingsbrand"') < html.indexOf('class="identity"') && html.indexOf('class="identity"') < html.indexOf('<details class="overview">'));
  const zz13 = await readFile(path.join(root, 'zz13', 'index.html'), 'utf8');
  assert.ok(html.includes(zz13.match(/<div class="magic-settings-footer">[\s\S]*?<\/div><\/form>/)[0].replace('</form>', '')));
  assert.match(dom, /const LOCAL_HOSTS = \['localhost', '127\.0\.0\.1', '::1', '\[::1\]'\];\nconst DEBUG = LOCAL_HOSTS\.includes\(location\.hostname\) && params\.get\('debug'\) === '1';/);
  assert.match(camera, /navigator\.wakeLock\.request\('screen'\)/);
  assert.match(camera, /visibilitychange/);
  assert.match(camera, /stopCamera\(\)/);
  // Camera lifecycle: restart does not depend on storage, stale starts bail quietly, an ended track restarts (throttled).
  assert.match(camera, /const cameraWanted = \(\) => document\.visibilityState === 'visible' && \(introDone \|\| read\(KEY\.intro\) === '1'\)/);
  assert.match(camera, /introDone = true;\n  write\(KEY\.intro, '1'\);/);
  assert.match(camera, /function stopCamera\(\) \{\n  camGen\+\+;/);
  assert.match(camera, /if \(stale\(\)\) return;\n    stopCamera\(\);\n    if \(error/);
  assert.match(camera, /addEventListener\?\.\('ended', \(\) => onTrackEnded\(local\)\)/);
  assert.match(camera, /now - lastEndedRestart < 2000/);
  assert.match(camera, /setTimeout\(\(\) => \{ if \(token === loopToken && stream\) runDetection\(\); \}, 2000\)/);
  assert.match(await read('style.css'), /\.recog \{[^}]*width: 6px; height: 6px;/);
  assert.match(html, /id="recog" class="recog" hidden/);
  assert.match(camera, /event\.touches\.length !== 2/);
  assert.match(camera, /facingMode: \{ ideal: 'environment' \}/);
  assert.match(camera, /BarcodeDetector/);
  assert.match(scan, /a\.target = '_blank'/);
  assert.match(presets, /navigator\.vibrate\?\.\(20\)/);
  for (const match of presets.matchAll(/localStorage\.\w+\(/g)) assert.ok(presets.slice(Math.max(0, match.index - 90), match.index).includes('try {'), 'storage access is wrapped');
  for (const key of presets.matchAll(/'(uramichi\.[^']+)'/g)) assert.match(key[1], /^uramichi\.web\./);
  const personal = '/Users/sumpie/Desktop/URAMICHI-개인-프리셋.json';
  let vendorUrls = [];
  try {
    const data = JSON.parse(await readFile(personal, 'utf8'));
    vendorUrls = data.categories.flatMap((c) => c.entries.map((e) => e.url)).filter((u) => !/^https:\/\/www\.google\.com\/search\?q=\{text\}$/.test(u));
  } catch { /* personal file not on this machine */ }
  for (const file of [...URAMICHI_FILES.filter((f) => /\.(?:html|mjs|js|css|webmanifest)$/.test(f) && !f.startsWith('vendor/'))]) {
    const text = await read(file);
    assert.doesNotMatch(text, /\b(?:requestFullscreen|webkitRequestFullscreen|webkitRequestFullScreen|mozRequestFullScreen|msRequestFullscreen)\b/, file);
    assert.doesNotMatch(text, /[—~～〜]/, file);
    for (const u of vendorUrls) assert.ok(!text.includes(u), `${file} must not contain personal preset URLs`);
  }
});

function loadRecognizer(source) {
  const start = source.indexOf('function recognizerCue(on)');
  const end = source.indexOf("$('gateBtn')", start);
  assert.ok(start >= 0 && end > start);
  const cue = { hidden: true };
  const pending = [];
  const timers = [];
  const context = vm.createContext({
    $(id) { return id === 'recog' ? cue : { open: false }; },
    makeDetector() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    requestAnimationFrame() { return 1; },
    performance: { now: () => 0 },
    video: { readyState: 0, videoWidth: 0 },
    onDetect() {},
  });
  vm.runInContext(`
    let loopToken = 0, stream = { id: 'first' }, detector = null;
    ${source.slice(start, end)}
    globalThis.api = {
      runDetection, recognizerCue,
      stop() { loopToken++; stream = null; recognizerCue(false); },
      replace(next) { stream = next; },
      get detector() { return detector; },
    };
  `, context);
  return { api: context.api, cue, pending, timers };
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('zz15 leaves the recognizer cue hidden when preparation rejects after the camera stops', async () => {
  const harness = loadRecognizer(await read('camera.mjs'));
  harness.api.runDetection();
  await flush();
  assert.equal(harness.pending.length, 1);
  assert.equal(harness.cue.hidden, true);
  harness.api.stop();
  harness.pending[0].reject(new Error('stopped'));
  await flush();
  assert.equal(harness.cue.hidden, true);
  assert.equal(harness.timers.length, 0);
  assert.equal(harness.api.detector, null);
});

test('zz15 ignores an older recognizer preparation that settles after a newer loop', async () => {
  const harness = loadRecognizer(await read('camera.mjs'));
  harness.api.runDetection();
  await flush();
  harness.api.stop();
  harness.api.replace({ id: 'second' });
  harness.api.runDetection();
  await flush();
  assert.equal(harness.pending.length, 2);
  harness.pending[1].reject(new Error('newer failed'));
  await flush();
  assert.equal(harness.cue.hidden, false);
  assert.equal(harness.timers.length, 1);
  harness.pending[0].resolve({ interval: 70, async detect() { return null; } });
  await flush();
  assert.equal(harness.cue.hidden, false, 'an older success must not clear the newer error cue');
  assert.equal(harness.api.detector, null);
  assert.equal(harness.timers.length, 1);

  const later = loadRecognizer(await read('camera.mjs'));
  later.api.runDetection();
  await flush();
  later.api.stop();
  later.api.replace({ id: 'second' });
  later.api.runDetection();
  await flush();
  const made = { interval: 70, async detect() { return null; } };
  later.pending[1].resolve(made);
  await flush();
  assert.equal(later.cue.hidden, true);
  assert.equal(later.api.detector, made);
  later.pending[0].reject(new Error('older failed'));
  await flush();
  assert.equal(later.cue.hidden, true, 'an older failure must not show the cue');
  assert.equal(later.api.detector, made);
  assert.equal(later.timers.length, 0);
});
