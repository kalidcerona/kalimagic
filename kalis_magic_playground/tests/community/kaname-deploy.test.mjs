// KANAME Cue web app: publication boundary, PWA metadata, offline shell, copy rules and the Web Audio engine wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { PUBLIC_DIRS, KANAME_FILES } from '../../scripts/build-public.mjs';
import { WebAudioEngine } from '../../KanameCue/audio.mjs';
import { makeCue } from '../../KanameCue/engine.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => readFile(path.join(root, 'KanameCue', file), 'utf8');
const shell = ['index.html', 'style.css', 'app.mjs', 'engine.mjs', 'audio.mjs', 'store.mjs', 'install-ui.js', 'manifest.webmanifest', 'brand-logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png'];

test('KanameCue publishes only its explicit shell at the exact path in an isolated build', async () => {
  assert.ok(PUBLIC_DIRS.includes('KanameCue'));
  assert.deepEqual([...KANAME_FILES].sort(), [...shell, 'sw.js'].sort());
  const temp = await mkdtemp(path.join(tmpdir(), 'kaname-deploy-'));
  try {
    const site = path.join(temp, 'site');
    await cp(root, site, { recursive: true, filter: source => !['node_modules', 'dist', '.git'].includes(path.relative(root, source).split(path.sep)[0]) });
    await writeFile(path.join(site, 'KanameCue', 'draft.txt'), 'private fixture');
    const result = spawnSync(process.execPath, ['scripts/build-public.mjs'], { cwd: site, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: 'true' } });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const mirrorLog = `${result.stdout}\n${result.stderr}`;
    assert.equal((mirrorLog.match(/WARNING: mirror check skipped on CI: \d+ sibling sources absent/g) || []).length, 1, mirrorLog);
    assert.equal(mirrorLog.includes('mirror check skipped:'), false);
    const published = path.join(site, 'dist', 'KanameCue');
    assert.deepEqual((await readdir(published)).sort(), [...shell, 'sw.js'].sort());
    for (const file of [...shell, 'sw.js']) assert.deepEqual(await readFile(path.join(published, file)), await readFile(path.join(root, 'KanameCue', file)), file);
    const html = await readFile(path.join(published, 'index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) assert.ok((await stat(path.join(published, match[1]))).isFile(), match[1]);
    for (const file of ['app.mjs', 'audio.mjs', 'store.mjs']) {
      for (const match of (await readFile(path.join(published, file), 'utf8')).matchAll(/from '(\.\/[^']+)'/g)) assert.ok((await stat(path.join(published, match[1]))).isFile(), match[1]);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('KanameCue has its own standalone identity, PNG icons on the house brown and Netlify headers', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  for (const key of ['name', 'short_name']) assert.equal(manifest[key], 'KANAME Cue');
  for (const key of ['id', 'start_url', 'scope']) assert.equal(manifest[key], './');
  assert.equal(manifest.display, 'standalone');
  for (const key of ['background_color', 'theme_color']) assert.equal(manifest[key], '#1a1512');
  assert.deepEqual(manifest.icons.map(icon => [icon.sizes, icon.purpose]), [['192x192', undefined], ['512x512', undefined], ['192x192', 'maskable'], ['512x512', 'maskable']]);
  for (const [index, size] of [192, 512, 192, 512].entries()) {
    const bytes = await readFile(path.join(root, 'KanameCue', manifest.icons[index].src));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
  }
  const html = await read('index.html');
  for (const pattern of [/^<!DOCTYPE html>/, /<html lang="ko">/, /viewport-fit=cover/, /name="theme-color" content="#1a1512"/, /rel="manifest" href="\.\/manifest.webmanifest"/, /<title>KANAME Cue<\/title>/, /alt="KANAME Cue 로고"/]) assert.match(html, pattern);
  const headers = await readFile(path.join(root, 'netlify.toml'), 'utf8');
  for (const route of ['KanameCue', 'kanamecue']) {
    assert.match(headers, new RegExp(`for = "/${route}/manifest\\.webmanifest"\\s+\\[headers.values\\]\\s+Content-Type = "application/manifest\\+json"`));
    assert.match(headers, new RegExp(`for = "/${route}/sw\\.js"\\s+\\[headers.values\\]\\s+Content-Type = "application/javascript; charset=utf-8"\\s+Cache-Control = "no-store, no-cache"`));
  }
});

test('KanameCue worker precaches the whole shell, serves it offline and ignores other paths', async () => {
  const source = await read('sw.js');
  for (const scope of ['https://example.com/KanameCue/', 'https://example.com/kanamecue/']) {
    const cached = new Map(), names = [];
    const cache = { async addAll(requests) { for (const r of requests) cached.set(r.url, new Response(r.url)); }, async match(url) { return cached.get(url)?.clone(); } };
    const caches = { async open(name) { names.push(name); return cache; }, async keys() { return []; }, async delete() {} };
    const listeners = {};
    const context = vm.createContext({ URL, Request, Response, Set, caches, fetch: async () => { throw new Error('offline'); },
      self: { registration: { scope }, clients: { claim() {} }, skipWaiting() {}, addEventListener(type, handler) { listeners[type] = handler; } } });
    vm.runInContext(source, context);
    let pending;
    listeners.install({ waitUntil(value) { pending = value; } }); await pending;
    assert.ok(names[0].startsWith('kaname-cue-'));
    assert.deepEqual([...cached.keys()].sort(), shell.map(file => new URL(file === 'index.html' ? './' : file, scope).href).sort());
    for (const file of ['', ...shell.filter(f => f !== 'manifest.webmanifest')]) {
      listeners.fetch({ request: new Request(new URL(file, scope)), respondWith(value) { pending = value; } });
      assert.equal((await pending).status, 200, file);
    }
    for (const url of ['https://example.com/TabataTimer/', new URL('notes.txt', scope).href]) {
      let intercepted = false;
      listeners.fetch({ request: new Request(url), respondWith() { intercepted = true; } });
      assert.equal(intercepted, false, url);
    }
  }
});

test('KanameCue keeps brand copy, contact footer, wake lock and the house settings gesture without fullscreen or forbidden punctuation', async () => {
  const html = await read('index.html'), app = await read('app.mjs');
  for (const text of ['중심', '모든 큐가 모이는 무대의 중심.', '要(かなめ)는 여러 부분을 묶는 핵심이라는 뜻임.', '무대 위의 수많은 움직임은 하나의 타이밍에서 서로 연결됨.', 'KANAME Cue는 소리와 영상, 그리고 공연자의 순간을 하나로 묶는 중심임.', 'Android Chrome: ⋮', 'iPhone Safari: 공유']) assert.ok(html.includes(text), text);
  const zz13 = await readFile(path.join(root, 'zz13', 'index.html'), 'utf8');
  assert.ok(html.includes(zz13.match(/<div class="magic-settings-footer">[\s\S]*?<\/div><\/form>/)[0].replace('</form>', '')));
  assert.match(app, /navigator\.wakeLock\.request\('screen'\)/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /touches\.length !== 2/);
  assert.match(app, /latencyHint: 'interactive'/);
  for (const file of ['index.html', 'app.mjs', 'engine.mjs', 'audio.mjs', 'store.mjs', 'style.css', 'manifest.webmanifest', 'sw.js', 'install-ui.js']) {
    const text = await read(file);
    assert.doesNotMatch(text, /\b(?:requestFullscreen|webkitRequestFullscreen|webkitRequestFullScreen|mozRequestFullScreen|msRequestFullscreen)\b/, file);
    assert.doesNotMatch(text, /[—~～〜]/, file);
  }
});

// Minimal Web Audio stand-in that records automation and source scheduling.
function fakeContext() {
  const log = [];
  const param = name => ({
    value: 1, events: [],
    setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; },
    linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); },
    setValueCurveAtTime(c, t, d) { this.events.push(['curve', c[0], c[c.length - 1], t, d]); },
    cancelAndHoldAtTime(t) { this.events.push(['hold', t]); },
    cancelScheduledValues(t) { this.events.push(['cancel', t]); },
    name
  });
  const ctx = {
    state: 'running', currentTime: 10, destination: {}, log,
    createGain() { const g = { gain: param('gain'), connect() {}, disconnect() {} }; log.push(['gain', g]); return g; },
    createBufferSource() {
      const s = { connect() {}, start(...args) { log.push(['start', ...args]); }, stop(t) { log.push(['stop', t]); }, onended: null };
      log.push(['source', s]); return s;
    },
    decodeAudioData: async () => ({ duration: 4, length: 4 * 48000, numberOfChannels: 2 }),
    suspend: async () => { ctx.state = 'suspended'; }, resume: async () => { ctx.state = 'running'; }
  };
  return ctx;
}

test('Web Audio engine decodes before GO, starts sources at once, ramps gains and never hard-cuts a stop', async () => {
  const ctx = fakeContext();
  const started = [];
  const engine = new WebAudioEngine(ctx, { started: cue => started.push(cue.id) });
  const progress = [];
  const result = await engine.decodeAll(['f1', 'f1', 'missing'], async id => id === 'f1' ? new ArrayBuffer(8) : null, (d, t) => progress.push(`${d}/${t}`));
  assert.deepEqual(progress, ['0/2', '1/2', '2/2']);
  assert.equal(result.bytes, 4 * 48000 * 2 * 4);
  assert.equal(result.errors.get('missing'), '파일 없음');
  let done = 0, failure = '';
  engine.play(makeCue({ id: 'c', name: '음악', audioFileId: 'f1', fadeInMs: 500, fadeOutMs: 1000, volume: 0.8 }), () => done++, m => { failure = m; });
  assert.equal(failure, '');
  assert.deepEqual(started, ['c']);
  const start = ctx.log.find(entry => entry[0] === 'start');
  assert.deepEqual(start.slice(1), [10, 0, 4]);
  const gain = ctx.log.filter(entry => entry[0] === 'gain')[1][1].gain;
  assert.deepEqual(gain.events.slice(0, 2), [['set', 0, 10], ['ramp', 0.8, 10.5]]);
  assert.deepEqual(gain.events.slice(2), [['set', 0.8, 13], ['ramp', 0, 14]], 'fade out over the last second');
  engine.fade('c', 0, 20, true);
  assert.deepEqual(gain.events.slice(4), [['hold', 10], ['ramp', 0, 10.02]]);
  const stop = ctx.log.filter(entry => entry[0] === 'stop').at(-1);
  assert.ok(Math.abs(stop[1] - 10.023) < 1e-9, 'source stops just after the 20 ms ramp');
  ctx.log.find(entry => entry[0] === 'source')[1].onended();
  assert.equal(done, 1);
  engine.play(makeCue({ id: 'm', name: '없는 파일', audioFileId: 'missing' }), () => {}, m => { failure = m; });
  assert.equal(failure, '파일 없음: 없는 파일');
});

test('Web Audio engine loops by count, uses an equal-power curve when chosen, and stops at once while suspended', async () => {
  const ctx = fakeContext();
  const engine = new WebAudioEngine(ctx, { curve: () => 'equal' });
  await engine.decodeAll(['f1'], async () => new ArrayBuffer(8));
  engine.play(makeCue({ id: 'loop', audioFileId: 'f1', loop: 'COUNT', loopCount: 3, startMs: 1000, endMs: 3000 }), () => {}, () => {});
  const source = ctx.log.filter(entry => entry[0] === 'source').at(-1)[1];
  assert.equal(source.loop, true); assert.equal(source.loopStart, 1); assert.equal(source.loopEnd, 3);
  assert.deepEqual(ctx.log.filter(entry => entry[0] === 'stop').at(-1), ['stop', 16], 'three plays of two seconds');
  assert.equal(engine.status().get('loop').remainingMs, 6000);
  engine.fade('loop', 0.2, 1000, false);
  const gain = ctx.log.filter(entry => entry[0] === 'gain').at(-1)[1].gain;
  const curve = gain.events.at(-1);
  assert.equal(curve[0], 'curve'); assert.equal(curve[1], 1); assert.ok(Math.abs(curve[2] - 0.2) < 1e-6);
  let finished = 0;
  engine.play(makeCue({ id: 'x', audioFileId: 'f1' }), () => finished++, () => {});
  await engine.pauseAll();
  assert.equal(engine.selfSuspended, true);
  engine.fade('x', 0, 300, true);
  assert.equal(finished, 1, 'a suspended context cannot ramp, so the stop completes immediately');
  await engine.resumeAll();
  assert.equal(ctx.state, 'running'); assert.equal(engine.selfSuspended, false);
});

test('without cancelAndHoldAtTime a throwing curve falls back safely, and retrigger or release ramps 20 ms before stopping', async () => {
  const ctx = fakeContext();
  const engine = new WebAudioEngine(ctx, { curve: () => 'equal' });
  await engine.decodeAll(['f1'], async () => new ArrayBuffer(8));
  engine.play(makeCue({ id: 'a', audioFileId: 'f1' }), () => {}, () => {});
  const gain = ctx.log.filter(entry => entry[0] === 'gain').at(-1)[1].gain;
  delete gain.cancelAndHoldAtTime;
  gain.cancelAndHoldAtTime = undefined;
  gain.setValueCurveAtTime = () => { throw new Error('overlap'); };
  gain.value = 0.7;
  engine.fade('a', 0, 300, true);
  assert.deepEqual(gain.events.slice(-3), [['cancel', 0], ['set', 0.7, 10], ['ramp', 0, 10.3]], 'value read, events cleared, held, then a linear ramp');
  // Even the linear ramp throwing still stops the cue.
  let finished = 0;
  engine.play(makeCue({ id: 'b', audioFileId: 'f1' }), () => finished++, () => {});
  const broken = ctx.log.filter(entry => entry[0] === 'gain').at(-1)[1].gain;
  broken.cancelAndHoldAtTime = () => { throw new Error('x'); };
  broken.cancelScheduledValues = () => { throw new Error('x'); };
  engine.fade('b', 0, 300, true);
  assert.equal(finished, 1); assert.equal(engine.tracks.has('b'), false);
  // Retrigger and release: previous instance ramps to 0 over 20 ms, stops after it, no completion callback.
  let firstDone = 0;
  engine.play(makeCue({ id: 'c', audioFileId: 'f1' }), () => firstDone++, () => {});
  const firstGain = ctx.log.filter(entry => entry[0] === 'gain').at(-1)[1].gain;
  engine.play(makeCue({ id: 'c', audioFileId: 'f1' }), () => {}, () => {});
  assert.deepEqual(firstGain.events.slice(-2), [['hold', 10], ['ramp', 0, 10.02]]);
  assert.ok(Math.abs(ctx.log.filter(entry => entry[0] === 'stop').at(-1)[1] - 10.023) < 1e-9);
  assert.equal(firstDone, 0);
  const secondGain = ctx.log.filter(entry => entry[0] === 'gain').at(-1)[1].gain;
  engine.release();
  assert.deepEqual(secondGain.events.slice(-2), [['hold', 10], ['ramp', 0, 10.02]]);
  assert.equal(engine.tracks.size, 0);
});
