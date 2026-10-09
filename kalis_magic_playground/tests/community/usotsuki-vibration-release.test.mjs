import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Owner report (Galaxy S25 Ultra): vibration kept going after the finger lifted.
// Every way a contact can end must leave the vibrator stopped: the last navigator.vibrate call is 0
// and no earlier call is still running.
const read = (appDir, file) => readFileSync(resolve(appDir, file), 'utf8');
const flush = () => new Promise(setImmediate);
async function fixture(appDir, theme, level, { primer = false, sound = false, scan = '2.5', dropFirstCancel = false } = {}) {
  const { createContinuousTrace } = await import(pathToFileURL(resolve(appDir, 'recorder-trace.js')).href);
  const logic = await import(pathToFileURL(resolve(appDir, 'logic.js')).href);
  const source = read(appDir, 'detector.js');
  const key = name => source.match(new RegExp('const ' + name + ' = "([^"]+)"'))[1];
  let now = 0, serial = 0;
  const frames = new Map(), timers = new Map(), nodes = new Map(), pending = [], vibes = [], gains = [];
  let cancelDropped = false;
  class Node extends EventTarget {
    constructor() {
      super(); this.dataset = {}; this.hidden = false; this.inert = false;
      this.value = ''; this.checked = false; this.textContent = ''; this.attrs = {};
      const classes = new Set();
      this.classList = {add:(...xs)=>xs.forEach(x=>classes.add(x)), remove:(...xs)=>xs.forEach(x=>classes.delete(x)), contains:x=>classes.has(x)};
      this.style = {setProperty(k,v){this[k]=v;}};
    }
    getBoundingClientRect() { return this === node('#detector-button') ? {left:120,top:560,width:148,height:148} : {x:0,y:0,left:0,top:0,width:412,height:893}; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    setAttribute(k,v) { this.attrs[k] = String(v); }
    setPointerCapture() {} closest() { return null; } focus() {} blur() {} append() {} remove() {}
    querySelector() { return null; }
    attachShadow() { return this.shadowRoot = {querySelector:()=>({getBoundingClientRect:()=>({x:0,y:0,width:412,height:893})})}; }
  }
  function node(id) { if (!nodes.has(id)) nodes.set(id,new Node()); return nodes.get(id); }
  const doc = Object.assign(new EventTarget(), {body:new Node(),hidden:false,querySelector:node,createElement:()=>new Node()});
  const stored = new Map([[key('DISPLAY_THEME_KEY'),theme],['usotsuki.detector.scan-duration.v1',scan],[key('SOUND_KEY'),sound?'1':'0'],['usotsuki.detector.vibration.v1',level]]);
  const win = Object.assign(new EventTarget(), {
    localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v))},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
  });
  const module = {mountRecorder(){return {setSoundEnabled(){},setPressed(){},begin(){},finish(){},destroy(){},suspend(){},unlock(){},snapshot:()=>({mounted:true})};}};
  const navigator = {vibrate:arg=>{
    // Model of an Android build that loses the first cancel racing a running vibration.
    if (dropFirstCancel && arg === 0 && !cancelDropped && vibes.at(-1)?.arg !== 0) {cancelDropped = true; vibes.push({at:now,arg:0,lost:true});return true;}
    vibes.push({at:now,arg});return true;}};
  if (primer) navigator.userActivation = {hasBeenActive:false};
  const param = () => { const events = []; return {events, value:0.0001,
    setValueAtTime:(v,t)=>events.push(['set',v,t]), exponentialRampToValueAtTime:(v,t)=>events.push(['exp',v,t]),
    linearRampToValueAtTime:(v,t)=>events.push(['lin',v,t]), cancelScheduledValues:t=>events.push(['cancel',t])}; };
  class FakeAudio {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; }
    get currentTime() { return now / 1000; }
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createBuffer() { return {}; } createBufferSource() { return {connect(){},start(){},disconnect(){}}; }
    createOscillator() { return {type:'', frequency:param(), connect(){}, disconnect(){}, start(){}, stop(){}}; }
    createGain() { const g = {gain:param(), connect(){}, disconnect(){}}; gains.push(g); return g; }
  }
  win.AudioContext = FakeAudio;
  const sandbox = {createContinuousTrace,...logic,Element:Node,Event,document:doc,window:win,navigator,performance:{now:()=>now},console,
    deferredLoad:()=>new Promise((resolve,reject)=>pending.push({resolve:()=>resolve([module,'']),reject})),
  };
  vm.createContext(sandbox);
  const controller = read(appDir, 'recorder-theme.js').replaceAll('import.meta.url','"https://example.test/recorder-theme.js"').replace('export function','function').replace('load = loadRecorder','load = deferredLoad');
  vm.runInContext(controller, sandbox);
  const detector = source.replace('import { createContinuousTrace } from "./recorder-trace.js";','').replace(/import \{[\s\S]*?\} from "\.\/logic.js";/,'').replace('import { createRecorderThemeController } from "./recorder-theme.js";','');
  vm.runInContext(detector, sandbox);
  function dispatch(target,type,props={}) {
    if (target.inert || target.hidden) return false;
    const event = new Event(type,{cancelable:true});
    for (const [k,value] of Object.entries(props)) Object.defineProperty(event,k,{value});
    return target.dispatchEvent(event);
  }
  const screen = node('#performance-screen');
  const f = {node,screen,doc,win,pending,vibes,gains,
    pointer:(type,x,y,id=1)=>dispatch(screen,type,{clientX:x,clientY:y,pointerId:id,target:screen}),
    visibility(hidden){doc.hidden=hidden;doc.dispatchEvent(new Event('visibilitychange'));},
    tick(ms){const end=now+ms;while(now<end){now=Math.min(end,now+10);
      for(const [id,job] of [...timers])if(job.at<=now){timers.delete(id);job.fn();}
      for(const [id,fn] of [...frames]){frames.delete(id);fn(now);}
    }},
    // True while the most recent vibrate() request would still be buzzing.
    buzzing(){const last=vibes.at(-1);if(!last||last.arg===0)return false;
      const total=Array.isArray(last.arg)?last.arg.reduce((a,b)=>a+b,0):last.arg;return now<last.at+total;},
  };
  if (theme.startsWith('recorder-')) {pending.shift().resolve();await flush();}
  return f;
}
const stopped = (f, label) => {
  assert.equal(f.vibes.at(-1)?.arg, 0, label + ': last vibrate call is 0');
  assert.equal(f.buzzing(), false, label + ': nothing still buzzing');
};

const appDirs = existsSync(resolve(import.meta.dirname, 'detector.js'))
  ? [resolve(import.meta.dirname)]
  : [resolve(import.meta.dirname, '../../zz7'), resolve(import.meta.dirname, '../../distribution-snapshots/usotsuki')];
const BUTTON = [194, 634], OFF = [10, 20];
const endings = {
  'pointerup on button': f => f.pointer('pointerup', ...BUTTON),
  'pointerup off button': f => f.pointer('pointerup', ...OFF),
  'slide off then lift': f => { f.pointer('pointermove', ...OFF); f.pointer('pointerup', ...OFF); },
  'slide off, back on, lift': f => { f.pointer('pointermove', ...OFF); f.pointer('pointermove', ...BUTTON); f.pointer('pointerup', ...BUTTON); },
  'pointercancel': f => f.pointer('pointercancel', ...BUTTON),
  'lostpointercapture': f => f.pointer('lostpointercapture', ...BUTTON),
  'second finger': f => f.pointer('pointerdown', ...OFF, 2),
  'page hidden': f => f.visibility(true),
  'window blur': f => f.win.dispatchEvent(new Event('blur')),
  'touchend (no pointerup delivered)': f => { const e = new Event('touchend'); Object.defineProperty(e, 'touches', {value: []}); f.screen.dispatchEvent(e); },
  'touchcancel (no pointerup delivered)': f => { const e = new Event('touchcancel'); Object.defineProperty(e, 'touches', {value: []}); f.screen.dispatchEvent(e); },
};
for (const appDir of appDirs) {
  for (const theme of ['green', 'wine', 'recorder', 'recorder-a', 'recorder-d']) {
    for (const level of ['medium', 'high', 'max']) {
      for (const [name, end] of Object.entries(endings)) {
        test(`${appDir}: ${theme}/${level} ${name} before the verdict stops vibration`, async () => {
          const f = await fixture(appDir, theme, level);
          f.pointer('pointerdown', ...BUTTON); f.tick(600);
          assert.ok(f.buzzing(), 'vibrating during the hold');
          end(f);
          stopped(f, name);
          const calls = f.vibes.length; f.tick(6000);
          assert.ok(f.vibes.slice(calls).every(v => v.arg === 0), 'nothing restarts vibration later');
        });
        test(`${appDir}: ${theme}/${level} ${name} after the verdict stops vibration`, async () => {
          const f = await fixture(appDir, theme, level);
          f.pointer('pointerdown', ...BUTTON); f.tick(3000);
          stopped(f, 'verdict while holding');
          end(f); f.pointer('pointerup', ...BUTTON); f.pointer('pointerup', ...OFF);
          stopped(f, name);
        });
      }
      test(`${appDir}: ${theme}/${level} primer touch lift leaves no vibration`, async () => {
        const f = await fixture(appDir, theme, level, { primer: true });
        f.pointer('pointerdown', ...BUTTON); f.tick(300);
        f.pointer('pointerup', ...BUTTON);
        assert.equal(f.buzzing(), false); assert.ok(f.vibes.length === 0 || f.vibes.at(-1).arg === 0);
      });
      test(`${appDir}: ${theme}/${level} ready touch lift stops the pulse`, async () => {
        const f = await fixture(appDir, theme, level);
        f.pointer('pointerdown', ...OFF); assert.ok(f.vibes.some(v => v.arg > 0), 'ready pulse sent');
        f.pointer('pointerup', ...OFF);
        stopped(f, 'ready touch');
      });
    }
  }
}

for (const appDir of appDirs) {
  test(`${appDir}: a cancel lost on the device is repeated until the vibrator is off`, async () => {
    for (const level of ['medium', 'max']) {
      const f = await fixture(appDir, 'green', level, { dropFirstCancel: true });
      f.pointer('pointerdown', ...BUTTON); f.tick(600);
      f.pointer('pointerup', ...BUTTON);
      assert.ok(f.vibes.some(v => v.lost), 'first cancel was lost');
      f.tick(300);
      assert.equal(f.vibes.filter(v => v.arg === 0 && !v.lost).length >= 1, true, 'a later cancel got through');
      f.pointer('pointerdown', ...BUTTON); f.tick(100); // a new hold clears pending repeats and starts fresh
      assert.ok(f.buzzing(), 'new hold vibrates again');
      f.tick(150);
      assert.ok(f.buzzing(), 'stale repeated cancel never kills a new hold');
    }
  });

  // Pre-verdict dip, copied from recorder A: 420 ms silence + 46 ms to the first typebar strike.
  const engine = readFileSync(resolve(appDir, 'recorder-engine.js'), 'utf8');
  const silence = Number(engine.match(/silence:(\d+)/)[1]), impact = Number(engine.match(/impactAt:(\d+)/)[1]);
  for (const theme of ['green', 'wine', 'recorder']) {
    test(`${appDir}: ${theme} scan tone dips to silence for ${silence + impact} ms before the verdict cue`, async () => {
      const f = await fixture(appDir, theme, 'off', { sound: true, scan: '2.5' });
      f.pointer('pointerdown', ...BUTTON);
      const scan = f.gains[0].gain.events;
      const dipSet = scan.find(e => e[0] === 'set' && e[1] === 0.17), dipRamp = scan.find(e => e[0] === 'exp' && e[1] === 0.0001 && e[2] > 1);
      assert.ok(dipSet && dipRamp, 'dip scheduled with the scan tone');
      assert.ok(Math.abs((dipRamp[2] - dipSet[2]) - 0.035) < 1e-9, '35 ms fade');
      f.tick(2500);
      const verdictStart = f.gains.flatMap(g => g.gain.events).find(e => e[0] === 'set' && e[1] === 1)[2];
      assert.ok(Math.abs((verdictStart - dipRamp[2]) * 1000 - (silence + impact)) < 1e-6, 'silent gap before the verdict cue equals recorder A');
      assert.ok(Math.abs(verdictStart - 2.56) < 1e-9, 'verdict cue timing unchanged (60 ms after release)');
    });
    test(`${appDir}: ${theme} short scans and early lifts keep the tone untouched`, async () => {
      const short = await fixture(appDir, theme, 'off', { sound: true, scan: '0.5' });
      short.pointer('pointerdown', ...BUTTON);
      assert.equal(short.gains[0].gain.events.some(e => e[0] === 'exp' && e[1] === 0.0001), false);
    });
  }
  test(`${appDir}: recorder A and D share the engine that holds the ${silence} ms silence`, () => {
    assert.equal(silence, 420); assert.equal(impact, 46);
    const theme = readFileSync(resolve(appDir, 'recorder-theme.js'), 'utf8');
    assert.match(theme, /mountRecorder\(root, \{skin:host\.dataset\.concept/);
    assert.match(theme, /recorder-d" \? "d" : "a"/);
  });
}
