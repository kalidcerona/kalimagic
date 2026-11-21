import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { presets, preset } from '../../distribution-snapshots/bell/presets.mjs';
import { readSound, saveSound } from '../../distribution-snapshots/bell/storage.mjs';
import { createGesture } from '../../distribution-snapshots/bell/gestures.mjs';
import { createSynth } from '../../distribution-snapshots/bell/audio.mjs';
import { transformDistributionDocument } from '../../scripts/build-public.mjs';
import { BELL_PUBLIC_BETA } from '../../netlify/edge-functions/tools-gate.mjs';

const root = new URL('../../distribution-snapshots/bell/', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');

test('only known sound IDs survive invalid or inaccessible storage', () => {
  assert.deepEqual(presets.map(sound => sound.id), ['desk', 'brass', 'glass']);
  const values = new Map();
  const store = () => ({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  const denied = () => { throw Error(); };
  for (const sound of presets) {
    assert.equal(preset(sound.id), sound);
    assert.equal(saveSound(sound.id, store), sound.id);
    assert.equal(values.get('friend-bell.settings.v1'), readSound(store));
  }
  values.set('friend-bell.settings.v1', '__proto__');
  assert.equal(readSound(store), 'desk');
  assert.equal(readSound(denied), 'desk');
  assert.equal(saveSound('glass', denied), 'glass');
  assert.equal(saveSound('unknown', store), 'desk');
});

test('release confirms tap, cancellation and drags stay silent', () => {
  const g = createGesture();
  g.down(1, 0, 0);
  assert.equal(g.up(1, 1, 1), 'ring');
  g.down(1, 0, 0);
  g.move(1, 20, 3);
  assert.equal(g.up(1, 0, 0), undefined);
  g.down(1, 0, 0);
  assert.equal(g.up(1, 0, 0, true), undefined);
  g.down(1, 0, 0);
  g.down(2, 40, 0);
  assert.equal(g.up(2, 40, 0), undefined);
  assert.equal(g.up(1, 0, 0), undefined);
});

test('both fingers must move down from pairing in portrait and landscape viewport coordinates', () => {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const x = width / 2, y = height / 4;
    const g = createGesture();
    g.down(4, x, 0);
    g.move(4, x, y);
    g.down(8, x + 40, y);
    assert.equal(g.move(8, x + 40, y + 100), undefined);
    assert.equal(g.move(4, x + 130, y + 100), undefined);
    assert.equal(g.move(4, x, y + 95), undefined);
    assert.equal(g.move(4, x, y + 96), 'settings');
    assert.equal(g.up(4, x, y + 96), undefined);
    assert.equal(g.up(8, x + 40, y + 100), undefined);
  }
});

test('first gesture resumes audio, four partials per strike, third fades the oldest in 15 ms', async () => {
  const buses = [], oscillators = [], noises = [];
  function node() {
    return { connect: to => to, disconnect() {}, start() {}, stops: [], stop(t) { this.stops.push(t); } };
  }
  function gain() {
    const events = [];
    return { ...node(), gain: { events, setValueAtTime: (...v) => events.push(v),
      linearRampToValueAtTime: (...v) => events.push(v), exponentialRampToValueAtTime: (...v) => events.push(v) } };
  }
  const device = { state: 'suspended', currentTime: 1, sampleRate: 48000, destination: {},
    resume() { this.state = 'running'; },
    createGain() { const item = gain(); buses.push(item); return item; },
    createOscillator() { const item = { ...node(), frequency: {} }; oscillators.push(item); return item; },
    createBufferSource() { const item = node(); noises.push(item); return item; },
    createBuffer: (_, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBiquadFilter: () => ({ ...node(), frequency: {} }),
  };
  const synth = createSynth(() => device);
  await synth.ring('desk');
  assert.equal(oscillators.length, 4);
  const peaks = buses.slice(1, 5).map(item => item.gain.events[1][0]);
  assert.ok(Math.abs(peaks.reduce((a,b) => a+b) - .35) < 1e-9);
  await synth.ring('glass');
  assert.equal(noises.length, 1);
  device.currentTime = 2;
  await synth.ring('brass');
  assert.equal(oscillators.length, 12);
  assert.equal(noises.length, 2);
  assert.deepEqual(buses[0].gain.events, [[1, 2], [0, 2.015]]);
  assert.deepEqual(oscillators.map(o => o.stops.length), [2,2,2,2,1,1,1,1,1,1,1,1]);
});

test('bell snapshot assets are local and the published guard follows the beta switch', () => {
  const files = readdirSync(root).sort();
  const shell = JSON.parse(read('sw.js').match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(shell.map(path => path.slice(2)).sort(), files.filter(file => file !== 'sw.js'));
  for (const file of files.filter(file => !file.endsWith('.png'))) {
    assert.doesNotMatch(read(file).replace('http://www.w3.org/2000/svg', ''), /(?:https?:)?\/\/[\w-]+\./);
  }
  const html = transformDistributionDocument(read('index.html'), { target: 'bell', tool: 'bell' });
  assert.equal(html.split('id="friend-apps-check"').length - 1, BELL_PUBLIC_BETA ? 0 : 1);
  assert.equal(html.includes('/tools/_check?tool=bell'), !BELL_PUBLIC_BETA);
  assert.equal(JSON.parse(read('manifest.webmanifest')).id, '/tools/bell/');
});

function mockNavigator(t, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
  t.after(() => {
    if (original) {
      Object.defineProperty(globalThis, 'navigator', original);
    } else {
      delete globalThis.navigator;
    }
  });
}

test('only the accepted controller can reload the current settings session', async t => {
  const { setupUpdates } = await import('../../distribution-snapshots/bell/install-update.mjs');
  const dialog = Object.assign(new EventTarget(), { open: true });
  const button = { closest: () => dialog };
  const messages = [];
  const waiting = { postMessage: message => messages.push(message) };
  const registration = Object.assign(new EventTarget(), { waiting });
  const workers = Object.assign(new EventTarget(), { register: async () => registration });
  mockNavigator(t, { serviceWorker: workers });
  let reloads = 0;
  globalThis.location = { reload: () => reloads++ };
  t.after(() => { delete globalThis.location; });
  await setupUpdates(button);
  const change = controller => {
    workers.controller = controller;
    workers.dispatchEvent(new Event('controllerchange'));
  };
  button.onclick();
  assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
  dialog.open = false;
  change(waiting);
  assert.equal(reloads, 0);
  dialog.open = true;
  button.onclick();
  dialog.open = false;
  dialog.dispatchEvent(new Event('close'));
  dialog.open = true;
  change(waiting);
  assert.equal(reloads, 0);
  button.onclick();
  change({});
  assert.equal(reloads, 0);
  change(waiting);
  change(waiting);
  assert.equal(reloads, 1);
});

test('a visible return retries a late wake rejection once', async t => {
  const { setupWakeLock } = await import('../../distribution-snapshots/bell/wake-lock.js');
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  globalThis.document = page;
  t.after(() => { delete globalThis.document; });
  const requests = [];
  const wakeLock = { request: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) };
  mockNavigator(t, { wakeLock });
  const first = setupWakeLock(() => {}).keepAwake();
  for (const state of ['hidden', 'visible', 'hidden', 'visible']) {
    page.visibilityState = state;
    page.dispatchEvent(new Event('visibilitychange'));
  }
  assert.equal(requests.length, 1);
  requests[0].reject(new Error('stale request'));
  await first;
  assert.equal(requests.length, 2);
  requests[1].reject(new Error('permission denied'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
});
