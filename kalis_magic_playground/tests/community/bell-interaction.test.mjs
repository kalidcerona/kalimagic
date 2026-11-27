import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { presets, preset } from '../../distribution-snapshots/bell/presets.mjs';
import { readSound, saveSound, readItem } from '../../distribution-snapshots/bell/storage.mjs';
import { createScene } from '../../distribution-snapshots/bell/dome.mjs';
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
  const g = createGesture({ hit: x => ({ dome: x >= 0 }) });
  for (const [start, end] of [[-1,-1],[-1,1],[1,-1]]) {
    g.down(1,start,0); assert.equal(g.up(1,end,0),undefined);
  }
  g.down(1, 0, 0);
  assert.equal(g.up(1, 1, 1), 'ring');
  g.down(1, 0, 0);
  g.move(1, 20, 3);
  assert.equal(g.up(1, 0, 0), undefined);
  g.down(1, 0, 0);
  assert.equal(g.up(1, 0, 0, true), undefined);
  g.down(1, 0, 0);
  g.down(2, 40, 0);
  assert.equal(g.up(2, 40, 0), 'ring');
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

  device.currentTime = 3;
  await synth.knock();
  const knock = oscillators.slice(12);
  assert.deepEqual(knock.map(o => o.frequency.value), [240, 615]);
  assert.deepEqual(knock.map(o => o.stops[0]), [3 + .003 + .021 + .010, 3 + .003 + .010 + .010]);
  const [lowPartial, highPartial, noiseGain] = buses.slice(-3);
  const lowPeak = lowPartial.gain.events[1][0];
  const highPeak = highPartial.gain.events[1][0];
  assert.ok(Math.abs(lowPeak + highPeak - .24) < 1e-9);
  assert.ok(Math.abs(noiseGain.gain.events[0][0] - .24 * .42 / 1.42) < 1e-9);
  assert.equal(noises.length, 3);
});

test('service worker precaches every snapshot asset', () => {
  const files = readdirSync(root).sort();
  const shell = JSON.parse(read('sw.js').match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(shell.map(path => path.slice(2)).sort(), files.filter(file => file !== 'sw.js'));
});

test('card sources are identical and runtime assets stay local', () => {
  for (const color of ['blue', 'red']) {
    const name = 'card-rider-' + color + '.jpg';
    assert.deepEqual(readFileSync(new URL(name, root)), readFileSync(new URL('../tobira/' + name, root)));
  }
  const links = text => text.match(/https:\/\/[^\s]+/g);
  assert.deepEqual(links(read('CARD_CREDITS.md').split('## 하프 달러')[0]), links(read('../tobira/CARD_CREDITS.md')));
  for (const file of readdirSync(root).filter(file => !/\.(jpg|png)$/.test(file) && file !== 'CARD_CREDITS.md')) {
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

function rehearsal(cancelPending, hasSecond, afterExit) {
  let time = 0;
  const frames = [];
  const g = createGesture({ cancelPending, hasSecond, afterExit, now: () => time, draw: (state, frame) => frames.push(frame),
    hit(x, y) {
      const r = Math.hypot(x, y);
      return { secret: y >= 450, dome: r <= 100, rim: r >= 45 && r <= 100,
        radius: 100, cx: 0, cy: 0, card: r <= 20, width: 500, left: 240 };
    } });
  const tap = (id, x, y) => {
    g.down(id, x, y);
    const result = g.up(id, x, y);
    result?.onStarted?.();
    return result?.action ?? result;
  };
  const hold = (ms = 250) => { g.down(1, 0, 490); time += ms; };
  const arm = () => {
    hold();
    assert.equal(tap(2, 0, 0), 'ring');
    assert.equal(tap(2, 0, 0), 'ring');
    g.up(1, 0, 490);
    assert.equal(g.phase(), 'armed');
    assert.equal(tap(1, 150, 0), undefined);
    assert.equal(tap(1, 0, 0), 'stuck');
    assert.equal(g.activate(), 'stuck');
  };
  const arc = (deg, start = 160, onStep) => {
    const point = a => [80 * Math.cos(a * Math.PI / 180), 80 * Math.sin(a * Math.PI / 180)];
    g.down(1, ...point(start));
    for (let i = 1; i <= Math.abs(deg); i++) {
      g.move(1, ...point(start + i * Math.sign(deg)));
      onStep?.(i);
    }
    g.up(1, ...point(start + deg));
  };
  return { g, frames, hold, tap, arm, arc };
}

test('delayed resume arms only when an oscillator starts before the hold is released', async () => {
  for (const releaseEarly of [true, false]) {
    let resume, starts = 0;
    const envelope = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
    const device = {
      state: 'suspended', currentTime: 0, destination: {},
      resume: () => new Promise(resolve => { resume = resolve; }),
      createGain: () => ({ gain: envelope, connect: node => node }),
      createOscillator: () => ({ frequency: {}, connect: node => node, start() { starts++; }, stop() {} }),
    };
    const synth = createSynth(() => device);
    const { g, hold } = rehearsal(synth.cancelPending);
    hold();
    g.down(2, 0, 0);
    const demo = g.up(2, 0, 0);
    const ring = synth.ring('desk', () => {
      assert.equal(starts, 1);
      demo.onStarted();
    });
    if (releaseEarly) g.up(1, 0, 490);
    device.state = 'running';
    resume();
    await ring;
    if (!releaseEarly) g.up(1, 0, 490);
    assert.equal(starts, releaseEarly ? 0 : 4);
    assert.equal(g.phase(), releaseEarly ? 'normal' : 'armed');
    assert.equal(g.activate(), releaseEarly ? 'ring' : 'stuck');
  }
});

test('a band hold is immediate and tolerates forty pixels of drift', () => {
  for (const [ms, dx, expected] of [[0,0,true],[50,20,true],[0,40,true],[50,41,false]]) {
    const {g,hold,tap} = rehearsal();
    hold(ms); g.move(1, dx, 490);
    assert.equal(tap(2, 0, 0), 'ring');
    assert.equal(tap(2, 0, 0), 'ring');
    g.up(1, dx, 490);
    assert.equal(g.phase(), expected ? 'armed' : 'normal');
  }
  const {g,hold,tap} = rehearsal();
  assert.equal(tap(1, 0, 490), undefined);
  hold(); assert.equal(g.up(1, 0, 490), undefined);
  hold(); g.down(2, 0, 0); g.up(1, 0, 490);
  assert.equal(g.up(2, 0, 0), undefined);
  hold(); g.down(2, 0, 0); g.down(3, 2, 0);
  for (const id of [3,2,1]) assert.equal(g.up(id, 0, id === 1 ? 490 : 0), undefined);
  assert.equal(g.phase(), 'normal');
});

test('a resting finger elsewhere permits repeated dome taps without arming', () => {
  const {g,tap} = rehearsal();
  g.down(1, 170, 200);
  assert.equal(tap(2, 0, 0), 'ring');
  assert.equal(tap(3, 0, 0), 'ring');
  g.up(1, 170, 200);
  assert.equal(g.phase(), 'normal');
});

test('signed rim rotation crosses the angle seam in both directions', () => {
  for (const sign of [-1,1]) {
    const {g,arm,arc} = rehearsal(); arm();
    arc(100 * sign, 170 * sign); assert.equal(g.phase(), 'stuck');
    arc(-60 * sign); arc(94 * sign); assert.equal(g.phase(), 'stuck');
    arc(65 * sign, 170 * sign); assert.equal(g.phase(), 'open');
  }
});

test('chords, central crossings, inner starts and retraced arcs stay stuck', () => {
  const {g,arm} = rehearsal(); arm();
  for (const y of [0,45]) {
    g.down(1,-85,y);
    for (let x = -84; x <= 85; x++) g.move(1,x,y);
    g.up(1,85,y);
  }
  g.down(1,44,0); g.move(1,0,80); g.up(1,-80,0);
  g.down(1,80,0);
  for (let i = 0; i < 3; i++) {
    g.move(1,56,56); g.move(1,0,80); g.move(1,56,56); g.move(1,80,0);
  }
  g.up(1,80,0); assert.equal(g.phase(),'stuck');
});

test('card commits on directional release or beyond the right edge, resets explicitly', () => {
  const {g,arm,arc} = rehearsal(); arm(); arc(200);
  for (const [dx,dy,cancel] of [[-90,0,false],[59,0,false],[60,40,false],[120,0,true]]) {
    g.down(1,0,0); g.move(1,dx,dy); g.up(1,dx,dy,cancel); assert.equal(g.phase(),'open');
  }
  g.down(1,30,0); g.up(1,130,0); assert.equal(g.phase(),'open');
  g.down(1,0,0); g.up(1,60,39); assert.equal(g.phase(),'between');
  assert.equal(g.activate(),undefined); g.resetPerformance(); assert.equal(g.activate(),'ring');
  arm(); arc(-200); g.down(1,0,0); g.move(1,260,0); assert.equal(g.phase(),'empty');
});

test('settings wins in each committed phase and interrupts drop held input', () => {
  const {g,arm,arc,hold,tap} = rehearsal();
  function settings() {
    const phase = g.phase();
    g.down(1,0,0); g.down(2,40,0); g.move(1,0,96,true);
    assert.equal(g.move(2,40,96),'settings'); assert.equal(g.phase(),phase);
    assert.equal(g.up(1,0,96),undefined);
  }
  settings(); hold(); tap(2,0,0); g.reset(); assert.equal(g.up(1,0,490),undefined);
  assert.equal(g.phase(),'normal');
  hold(); tap(2,0,0); g.up(1,0,490); settings(); g.activate(); settings();
  arc(200); settings(); g.down(1,0,0); g.up(1,100,0); settings();
  g.resetPerformance(); arm();
});

test('the stage is concealed until startup preferences are applied and input is ready', () => {
  const html = read('index.html'), app = read('app.mjs');
  assert.ok(html.indexOf('href="./performance.css"') < html.indexOf('<body>'));
  assert.match(read('performance.css'), /body:has\(#stage:not\(\[data-phase\]\)\)\s*\{\s*visibility: hidden/);
  assert.match(app, /appearance\(\);\s*gesture\.resetPerformance\(\);/);
});

test('rotation feedback waits for measurable curvature and interruption retains progress', () => {
  const {g,frames,arm} = rehearsal(); arm();
  g.down(1,80,0);
  for (const angle of [5,10,15,30,60]) {
    const radians = angle * Math.PI / 180;
    g.move(1,80*Math.cos(radians),80*Math.sin(radians));
    assert.equal(Boolean(frames.at(-1).angle), angle === 60);
  }
  g.reset(); assert.equal(g.phase(),'stuck'); assert.ok(Math.abs(frames.at(-1).angle - 60) < 1e-6);
  assert.equal(g.up(1,-80,0),undefined);
});

test('a pinch stays zoom even after both fingers travel down together', () => {
  const {g,arm,arc} = rehearsal(); arm(); arc(200);
  g.down(1,-10,0); g.down(2,10,0);
  g.move(1,-25,0); g.move(2,25,0);
  g.move(1,-10,100,true); g.move(2,10,100,true);
  assert.equal(g.evaluatePair(),undefined);
  g.up(1,-10,100); g.up(2,10,100);
  g.down(1,-10,0); g.down(2,10,0);
  g.move(1,-10,100,true); g.move(2,10,100,true);
  assert.equal(g.evaluatePair(),'settings');
});

test('secret band spans the bottom 152 pixels above the safe inset', t => {
  const box = { left: 0, top: 0, width: 100, height: 100 };
  const element = { dataset: {}, setAttribute() {}, prepend() {}, getBoundingClientRect: () => box };
  element.querySelector = () => element;
  const globals = { document: { createElement: () => element }, innerHeight: 844,
    innerWidth: 390, getComputedStyle: () => ({ getPropertyValue: () => '34px' }) };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
  }
  const { hit } = createScene(element);
  for (const x of [0, 195, 390]) {
    for (const [y, expected] of [[657.99, false], [658, false], [658.01, true], [734, true],
      [809, true], [810, true], [810.01, true], [843, true], [845, false]]) {
      assert.equal(hit(x, y).secret, expected);
    }
  }
  function phaseAfterHold(x, y) {
    let time = 0;
    const gesture = createGesture({ hit, now: () => time });
    gesture.down(1, x, y);
    time = 300;
    gesture.down(2, 50, box.top + 49);
    gesture.up(2, 50, box.top + 49)?.onStarted?.();
    gesture.up(1, x, y);
    return gesture.phase();
  }
  for (const y of [843, 810.01, 810, 809, 734, 658.01]) assert.equal(phaseAfterHold(195, y), 'armed');
  for (const y of [845, 658, 657]) assert.equal(phaseAfterHold(195, y), 'normal');
  box.top = 685;
  assert.equal(hit(50, 734).secret, true);
  assert.equal(hit(50, 734).dome, true);
  assert.equal(phaseAfterHold(50, 734), 'normal');
});

test('item settings migrate red and retain independent selections', () => {
  const values = new Map();
  const store = () => ({ getItem: key => values.get(key) });
  assert.equal(readItem('firstItem', store), 'blue');
  assert.equal(readItem('secondItem', store), 'none');
  values.set('friend-bell.cardBack.v1', 'red');
  assert.equal(readItem('firstItem', store), 'red');
  for (const item of ['kennedy', 'barber', 'walking', 'blue', 'red']) {
    values.set('friend-bell.firstItem.v1', item);
    values.set('friend-bell.secondItem.v1', item);
    assert.equal(readItem('firstItem', store), item);
    assert.equal(readItem('secondItem', store), item);
  }
});

test('each coin photo has a local asset, source, author and license', () => {
  for (const [key, author, license] of [
    ['kennedy', 'United States Mint', '퍼블릭 도메인'],
    ['walking', 'Brandon Grossardt', 'CC BY-SA 3.0'],
    ['barber', 'Patrick20242023', 'CC BY-SA 4.0'],
  ]) {
    const file = 'coin-' + key + '.jpg';
    const credit = read('CARD_CREDITS.md').split('\n').find(line => line.includes(file));
    assert.ok(readFileSync(new URL(file, root)).length > 0);
    assert.ok(credit.includes('https://commons.wikimedia.org/wiki/File:'));
    for (const field of [author, license]) {
      assert.ok(credit.includes(field));
      assert.ok(read('index.html').includes(field));
    }
  }
});

test('the inner lid opens independently and the tray stays empty after the second extraction', () => {
  const {g, arm, arc, frames} = rehearsal(undefined, () => true);
  arm(); arc(60); arc(-80);
  assert.equal(frames.at(-1).angle, 0);
  arc(200);
  assert.equal(frames.at(-1).innerTurn, 0);
  g.down(1,0,0); g.move(1,260,0);
  assert.equal(g.phase(), 'empty');
  g.up(1,260,0);
  assert.equal(g.phase(), 'between');
  assert.equal(frames.at(-1).second, false);
  assert.equal(frames.at(-1).innerTurn, 0);
  arc(-105);
  assert.equal(g.phase(), 'between');
  assert.equal(g.activate(), undefined);
  assert.ok(Math.abs(frames.at(-1).innerTurn + 105) < 1e-6);
  arc(-90, 160, step => {
    if (step === 75) assert.equal(g.phase(), 'between');
  });
  assert.equal(g.phase(), 'open');
  assert.equal(frames.at(-1).second, true);
  g.down(1,0,0); g.up(1,100,0);
  assert.equal(g.phase(), 'empty');
  g.resetPerformance();
  assert.deepEqual(frames.at(-1), {angle: 0, innerTurn: 0, second: false});
});

test('the inner lid can be enabled after the first item leaves an empty tray', () => {
  let enabled = false;
  const {g, arm, arc, frames} = rehearsal(undefined, () => enabled);
  arm(); arc(200);
  g.down(1, 0, 0); g.up(1, 100, 0);
  arc(200);
  assert.equal(g.phase(), 'between');
  assert.equal(frames.at(-1).innerTurn, 0);
  enabled = true;
  arc(200);
  assert.equal(g.phase(), 'open');
  assert.equal(frames.at(-1).second, true);
});

test('item exit follows a replacement transform transition before switching to the inner lid', async t => {
  let rejectFirst, finishReplacement, exited = 0;
  const first = { transitionProperty: 'transform', playState: 'running',
    finished: new Promise((_, reject) => { rejectFirst = reject; }) };
  const replacement = { transitionProperty: 'transform', playState: 'running',
    finished: new Promise(resolve => { finishReplacement = resolve; }) };
  let active = [first];
  const card = { setAttribute() {}, getAnimations: () => active };
  const base = { prepend() {}, querySelector: () => ({}) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => card } });
  t.after(() => previous ? Object.defineProperty(globalThis, 'document', previous) : delete globalThis.document);
  const { afterExit } = createScene({ querySelector: () => base });
  afterExit(() => { exited++; });
  active = [replacement];
  rejectFirst(new Error('Transition retargeted'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(exited, 0);
  finishReplacement();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(exited, 1);
});

test('repeated straight chords in every orientation earn zero rotation', () => {
  const {g, arm, frames} = rehearsal();
  arm();
  for (const a of [0, Math.PI / 4, Math.PI / 2]) {
    for (const y of [0, 50, 70]) {
      const point = x => [x*Math.cos(a)-y*Math.sin(a), x*Math.sin(a)+y*Math.cos(a)];
      for (let pass = 0; pass < 4; pass++) {
        g.down(1, ...point(-65));
        for (let x = -60; x <= 65; x += 5) g.move(1, ...point(x));
        g.up(1, ...point(65));
        assert.equal(frames.at(-1).angle, 0);
        assert.equal(g.phase(), 'stuck');
      }
    }
  }
});

test('short extraction waits for exit and settings contacts survive the switch to the inner lid', () => {
  let finish;
  const {g, arm, arc, frames} = rehearsal(undefined, () => true, done => { finish = done; });
  arm(); arc(200);
  g.down(1,0,0); g.up(1,65,0);
  assert.equal(g.phase(), 'empty');
  assert.equal(frames.at(-1).second, false);
  g.down(1,100,80); g.down(2,210,80);
  g.move(1,100,130,true); g.move(2,210,130,true);
  finish();
  assert.equal(g.phase(), 'between');
  g.move(1,100,200,true);
  assert.equal(g.move(2,210,200), 'settings');
});

test('rotation during item exit is retained and a turn spanning exit must end normally', () => {
  const point = degrees => [80 * Math.cos(degrees * Math.PI / 180), 80 * Math.sin(degrees * Math.PI / 180)];
  for (const cancel of [false, true]) {
    let finish;
    const { g, arm, arc, frames } = rehearsal(undefined, () => true, done => { finish = done; });
    arm(); arc(200);
    g.down(1, 0, 0); g.up(1, 65, 20);
    arc(100);
    assert.equal(g.phase(), 'empty');
    assert.ok(Math.abs(frames.at(-1).innerTurn - 100) < 1e-6);
    g.down(1, ...point(45));
    for (let degrees = 49; degrees <= 149; degrees += 4) g.move(1, ...point(degrees));
    finish();
    assert.equal(g.phase(), 'between');
    g.up(1, ...point(149), cancel);
    if (cancel) {
      assert.equal(g.phase(), 'between');
      assert.ok(Math.abs(frames.at(-1).innerTurn - 100) < 1e-6);
      arc(100);
    }
    assert.equal(g.phase(), 'open');
    assert.equal(frames.at(-1).second, true);
  }
});

function traceGesture(g, points) {
  g.down(1, ...points[0]);
  for (const point of points.slice(1)) g.move(1, ...point);
  g.up(1, ...points.at(-1));
}

test('verifier chords stay at zero over five passes with rounding and seeded pixel noise', () => {
  const { g, arm, frames } = rehearsal();
  arm();
  let seed = 42;
  const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
  for (const [x, y, ex, ey] of [[110,350,280,350],[85,419,305,419],[265,337,265,501],
    [126,503,126,334],[105,402,202,307],[188,306,285,401],[99,374,267,335],[115,340,104,491]]) {
    for (const rounded of [false,true]) for (const jitter of [0,1,2]) {
      for (let pass = 0; pass < 5; pass++) {
        const points = Array.from({length:15}, (_, i) => [
          (x - 195 + (ex-x)*i/14)*.82, (y - 419 + (ey-y)*i/14)*.82,
        ].map(v => rounded ? Math.round(v + noise()*jitter) : v + noise()*jitter));
        traceGesture(g, points);
        assert.equal(frames.at(-1).angle, 0);
        assert.equal(g.phase(), 'stuck');
      }
    }
  }
});

test('wobbly rim drags stay closed at a half-turn and open a little farther in either direction', () => {
  for (const sign of [-1,1]) {
    for (const [degreesPair, radiusPhase] of [[[54,62], .37], [[90,90], .37], [[100,100], .37], [[103,100], 1.11]]) {
      const {g, arm} = rehearsal();
      arm();
      for (const [i, degrees] of degreesPair.entries()) {
        const steps = Math.ceil(degrees/4.5);
        const points = Array.from({length:steps+1}, (_, j) => {
          const f = j/steps, seed = i + radiusPhase;
          const a = (sign*([172,-45][i]+degrees*f)+1.7*Math.sin(4*Math.PI*f))*Math.PI/180;
          const r = .82*(94+12*Math.sin(2*Math.PI*f+seed)+5*Math.sin(5*Math.PI*f+seed));
          return [r*Math.cos(a), r*Math.sin(a)];
        });
        traceGesture(g, points);
        const total = degreesPair[0] + degreesPair[1];
        assert.equal(g.phase(), i === 1 && total >= 195 ? 'open' : 'stuck');
      }
    }
  }
});

test('a clean rim arc opens the lid at 195 degrees in either direction', () => {
  for (const sign of [-1, 1]) {
    for (const degrees of [180, 194, 195]) {
      const {g, arm, arc} = rehearsal();
      arm();
      arc(sign * degrees);
      assert.equal(g.phase(), degrees === 195 ? 'open' : 'stuck');
    }
  }
});
