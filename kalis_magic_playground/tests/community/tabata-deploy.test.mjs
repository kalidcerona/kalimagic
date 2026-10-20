import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { PUBLIC_DIRS, TABATA_FILES } from '../../scripts/build-public.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => readFile(path.join(root, 'TabataTimer', file), 'utf8');
const shell = ['index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'brand-logo.png', 'icon.svg', 'icon-192.png', 'icon-512.png'];

function worker(scope, caches) {
  const listeners = {};
  const context = vm.createContext({ URL, Request, Response, Set, caches, fetch: async () => { throw new Error('offline'); },
    self: { registration: { scope }, clients: { claim() {} }, skipWaiting() {}, addEventListener(type, handler) { listeners[type] = handler; } } });
  return { context, listeners };
}

test('TabataTimer publishes only its explicit shell at the exact case-sensitive path in an isolated CI build', async () => {
  assert.ok(PUBLIC_DIRS.includes('TabataTimer'));
  assert.deepEqual([...TABATA_FILES].sort(), [...shell, 'sw.js'].sort());
  const temp = await mkdtemp(path.join(tmpdir(), 'tabata-deploy-'));
  try {
    const site = path.join(temp, 'site');
    await cp(root, site, { recursive: true, filter: source => !['node_modules', 'dist', '.git'].includes(path.relative(root, source).split(path.sep)[0]) });
    // Seed non-runtime content in the temporary copy to test the publication boundary.
    await writeFile(path.join(site, 'TabataTimer', 'draft.txt'), 'private fixture');
    await mkdir(path.join(site, 'TabataTimer', 'notes'));
    await writeFile(path.join(site, 'TabataTimer', 'notes', 'index.html'), 'private fixture');
    const result = spawnSync(process.execPath, ['scripts/build-public.mjs'], { cwd: site, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const published = path.join(site, 'dist', 'TabataTimer');
    assert.deepEqual((await readdir(published)).sort(), [...shell, 'sw.js'].sort());
    assert.equal((await readdir(path.join(site, 'dist'))).includes('tabatatimer'), false);
    for (const file of [...shell, 'sw.js']) {
      assert.ok((await stat(path.join(published, file))).isFile(), file);
      assert.deepEqual(await readFile(path.join(published, file)), await readFile(path.join(root, 'TabataTimer', file)), file);
    }
    const html = await readFile(path.join(published, 'index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) {
      assert.ok((await stat(path.join(published, match[1]))).isFile(), match[1]);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('TabataTimer has distinct standalone identity, complete metadata, icons and Netlify headers', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.id, '/TabataTimer/');
  for (const key of ['name', 'short_name']) assert.equal(manifest[key], 'Tabata Timer');
  for (const key of ['start_url', 'scope']) assert.equal(manifest[key], './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.display_override, undefined);
  for (const key of ['background_color', 'theme_color']) assert.equal(manifest[key], '#1a1512');
  for (const route of PUBLIC_DIRS.filter(route => /^zz\d+$/.test(route))) {
    const other = JSON.parse(await readFile(path.join(root, route, 'manifest.webmanifest'), 'utf8'));
    assert.notEqual(new URL(other.id || other.start_url, `https://example.com/${route}/`).pathname, manifest.id);
  }
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  for (const [index, size] of [192, 512].entries()) {
    const icon = manifest.icons[index];
    assert.equal(icon.type, 'image/png');
    const bytes = await readFile(path.join(root, 'TabataTimer', icon.src));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  const html = await read('index.html');
  for (const pattern of [/^<!DOCTYPE html>/, /<html lang="ko">/, /viewport-fit=cover/, /name="theme-color" content="#1a1512"/, /name="color-scheme" content="dark"/, /rel="manifest" href="\.\/manifest.webmanifest"/, /rel="apple-touch-icon" href="\.\/icon-192.png"/, /<title>Tabata Timer<\/title>/]) assert.match(html, pattern);
  const headers = await readFile(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(headers, /for = "\/TabataTimer\/manifest\.webmanifest"\s+\[headers.values\]\s+Content-Type = "application\/manifest\+json"/);
  assert.match(headers, /for = "\/TabataTimer\/sw\.js"\s+\[headers.values\]\s+Content-Type = "application\/javascript; charset=utf-8"\s+Cache-Control = "no-store, no-cache"/);
});

test('TabataTimer worker precaches the complete shell, serves offline and isolates caches by registration scope', async () => {
  const source = await read('sw.js');
  const names = [];
  for (const scope of ['https://example.com/TabataTimer/', 'https://example.com/other-tabata/']) {
    const cached = new Map(), deleted = [];
    const cache = {
      async addAll(requests) { for (const request of requests) cached.set(request.url, new Response(request.url)); },
      async match(url) { return cached.get(url)?.clone(); }
    };
    const caches = { async open(name) { names.push(name); return cache; }, async keys() { return [names.at(-1), names.at(-1).replace(/v20261020-1$/, 'old'), 'pimax-practice-old', 'tabata-timer-unrelated-old']; }, async delete(name) { deleted.push(name); } };
    const { context, listeners } = worker(scope, caches);
    vm.runInContext(source, context);
    let pending;
    listeners.install({ waitUntil(value) { pending = value; } });
    await pending;
    const cacheName = names.at(-1);
    assert.equal(cacheName.startsWith('tabata-timer-'), true);
    assert.deepEqual([...cached.keys()].sort(), shell.map(file => new URL(file, scope).href).sort());
    listeners.activate({ waitUntil(value) { pending = value; } });
    await pending;
    assert.deepEqual(deleted, [cacheName.replace(/v20261020-1$/, 'old')]);
    for (const file of ['', ...shell]) {
      listeners.fetch({ request: new Request(new URL(file, scope)), respondWith(value) { pending = value; } });
      const response = await pending;
      assert.equal(response.status, 200, file);
      assert.equal(await response.text(), new URL(file || 'index.html', scope).href);
    }
    for (const url of ['https://example.com/zz14/', 'https://example.com/TabataTimerSibling/', new URL('notes.txt', scope).href, 'https://other.example/TabataTimer/index.html']) {
      let intercepted = false;
      listeners.fetch({ request: new Request(url), respondWith() { intercepted = true; } });
      assert.equal(intercepted, false, url);
    }
  }
  assert.notEqual(names[0], names.at(-1));
});

test('TabataTimer preserves Korean copy and zz13 contact footer without fullscreen calls or forbidden punctuation', async () => {
  const html = await read('index.html');
  const original = await readFile(path.join(root, 'zz13', 'index.html'), 'utf8');
  const footer = original.match(/<div class="magic-settings-footer">[\s\S]*?<\/div><\/form>/)[0].replace('</form>', '');
  assert.ok(html.includes(footer));
  for (const text of ['개요', 'Android Chrome: ⋮', '앱 설치', 'iPhone Safari: 공유', '홈 화면에 추가', '준비', '운동', '일시정지', '사이클', '종료']) {
    assert.ok((html + await read('app.js')).includes(text), text);
  }
  for (const file of ['index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'sw.js']) {
    const source = await read(file);
    assert.doesNotMatch(source, /\b(?:requestFullscreen|webkitRequestFullscreen|webkitRequestFullScreen|mozRequestFullScreen|msRequestFullscreen)\b/, file);
    assert.doesNotMatch(source, /[\u2014~\uFF5E\u301C]/, file);
  }
  assert.match(await read('style.css'), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

// Run the shipped event handlers with deterministic time and platform API fakes.
async function timerHarness({ delayedWake = false } = {}) {
  const nodes = new Map(), documentEvents = {}, locks = [], utterances = [];
  let clock = 0, wakeRequests = 0, unlocked = 0, resolveWake;
  class Element {
    constructor() { this.events = {}; this.style = { setProperty() {} }; this.dataset = {}; this.value = ''; this.hidden = false; this.innerHTML = ''; this.textContent = ''; this.classes = new Set(); this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), contains: c => this.classes.has(c) }; }
    addEventListener(type, handler) { this.events[type] = handler; }
    replaceChildren(...children) { this.children = children; }
    append(child) { (this.children ||= []).push(child); }
    setAttribute() {}
    querySelectorAll() { return [new Element(), new Element()]; }
    querySelector() { return new Element(); }
  }
  for (const match of (await read('index.html')).matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], new Element());
  nodes.get('run').hidden = true;
  const document = { visibilityState: 'visible', getElementById: id => nodes.get(id), createElement: () => new Element(), addEventListener(type, handler) { documentEvents[type] = handler; } };
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, start() { unlocked++; } }; }
  }
  const navigator = { wakeLock: { request: async type => {
    assert.equal(type, 'screen'); wakeRequests++;
    if (delayedWake) await new Promise(resolve => { resolveWake = resolve; });
    const lock = { released: false, async release() { this.released = true; }, addEventListener() {} };
    locks.push(lock); return lock;
  } } };
  const speechSynthesis = { cancel() {}, speak(utterance) { utterances.push(utterance); } };
  const context = vm.createContext({ document, navigator, window: { AudioContext, speechSynthesis }, speechSynthesis,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    localStorage: { getItem(key) { return key === 'tt.opts' ? JSON.stringify({ beep: false, voice: true, vibe: false, skipLast: true }) : null; }, setItem() {} },
    performance: { now: () => clock }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} });
  vm.runInContext(await read('app.js'), context);
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  return { nodes, document, locks, utterances, get wakeRequests() { return wakeRequests; }, get unlocked() { return unlocked; },
    async click(id) { nodes.get(id).events.click(); await settle(); },
    async visibility(state) { document.visibilityState = state; documentEvents.visibilitychange(); await settle(); },
    async advance(ms) { clock += ms; documentEvents.visibilitychange(); await settle(); },
    async resolveWake() { resolveWake(); await settle(); }
  };
}

test('TabataTimer start unlocks audio with beeps disabled and uses Korean speech; pause, resume and visibility govern wake locks', async () => {
  const app = await timerHarness();
  assert.equal(app.nodes.get('total').textContent, '4:00');
  await app.click('startBtn');
  assert.equal(app.unlocked, 1);
  assert.equal(app.nodes.get('setup').hidden, true);
  assert.equal(app.nodes.get('run').hidden, false);
  assert.equal(app.utterances[0].lang, 'ko-KR');
  assert.equal(app.utterances[0].text, '준비');
  assert.equal(app.wakeRequests, 1);
  await app.advance(10000);
  assert.equal(app.nodes.get('rCount').textContent, '20');
  assert.equal(app.utterances.at(-1).text, '운동');
  await app.click('pauseBtn');
  assert.equal(app.locks[0].released, true);
  await app.advance(5000);
  assert.equal(app.nodes.get('rCount').textContent, '20');
  assert.equal(app.wakeRequests, 1);
  await app.click('pauseBtn');
  assert.equal(app.wakeRequests, 2);
  await app.visibility('hidden');
  assert.equal(app.locks[1].released, true);
  await app.visibility('visible');
  assert.equal(app.wakeRequests, 3);
  await app.advance(225000);
  assert.equal(app.nodes.get('rCount').textContent, '5');
  await app.advance(5000);
  assert.equal(app.nodes.get('pauseBtn').textContent, '다시 시작');
  assert.equal(app.locks[2].released, true);
  assert.equal(app.utterances.at(-1).text, '완료');
});

test('TabataTimer releases a wake lock resolving after stop and does not reacquire it on visibility', async () => {
  const app = await timerHarness({ delayedWake: true });
  await app.click('startBtn');
  await app.click('stopBtn');
  await app.click('stopBtn');
  assert.equal(app.nodes.get('run').hidden, true);
  await app.resolveWake();
  assert.equal(app.locks[0].released, true);
  await app.visibility('visible');
  assert.equal(app.wakeRequests, 1);
});
