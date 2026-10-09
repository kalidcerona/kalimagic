import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const read = (appDir, file) => readFileSync(resolve(appDir, file), 'utf8');
const flush = () => new Promise(setImmediate);
async function fixture(appDir, theme = 'recorder', layout = false, scan = '0.5') {
  const { createContinuousTrace } = await import(pathToFileURL(resolve(appDir, 'recorder-trace.js')).href);
  const logic = await import(pathToFileURL(resolve(appDir, 'logic.js')).href);
  const source = read(appDir, 'detector.js');
  const key = name => source.match(new RegExp('const ' + name + ' = "([^"]+)"'))[1];
  let now = 0, serial = 0;
  const frames = new Map();
  const timers = new Map(), nodes = new Map(), pending = [], calls = [];
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
  const stored = new Map([[key('DISPLAY_THEME_KEY'),theme],...(scan == null ? [] : [['usotsuki.detector.scan-duration.v1',scan]]),[key('SOUND_KEY'),'0'],['usotsuki.detector.vibration.v1','off']]);
  const win = Object.assign(new EventTarget(), {
    localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v))},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
  });
  const module = {mountRecorder(){calls.push('mount');return {
    setSoundEnabled(){},setPressed:v=>calls.push(['pressed',v]),begin:()=>calls.push('begin'),
    finish:()=>calls.push('finish'),destroy(){},suspend(){},unlock(){},snapshot:()=>({mounted:true}),
  };}};
  const sandbox = {createContinuousTrace,...logic,Element:Node,Event,document:doc,window:win,navigator:{},performance:{now:()=>now},console,
    deferredLoad:()=>new Promise((resolve,reject)=>pending.push({resolve:()=>resolve([module,'']),reject})),
  };
  let glyph;
  if (layout) {
    const strip=node('.wood-paper-strip');
    strip.innerHTML=read(appDir,'index.html').split('<div class="wood-paper-strip">')[1].split('</div>')[0];
    glyph={box:{width:160,height:48},bounds:{x:20,y:-10,width:120,height:24},attrs:{},callbacks:{}};
    const text={getBBox:()=>glyph.bounds,removeAttribute:k=>delete glyph.attrs[k],setAttribute:(k,v)=>glyph.attrs[k]=v};
    strip.querySelectorAll=()=>strip.innerHTML.includes('<svg')?[{querySelector:()=>text}]:[];
    strip.getBoundingClientRect=()=>node('#performance-screen').hidden?{width:0,height:0}:glyph.box;
    node('#performance-screen').hidden=true;
    doc.fonts={ready:new Promise(resolve=>glyph.fontReady=resolve),addEventListener:(event,fn)=>glyph.callbacks[event]=fn};
    sandbox.ResizeObserver=class {constructor(fn){glyph.resize=fn;}observe(n){glyph.observed=n;}};
  }
  vm.createContext(sandbox);
  const controller = read(appDir, 'recorder-theme.js').replaceAll('import.meta.url','"https://example.test/recorder-theme.js"').replace('export function','function').replace('load = loadRecorder','load = deferredLoad');
  vm.runInContext(controller, sandbox);
  const detector = source.replace('import { createContinuousTrace } from "./recorder-trace.js";','').replace(/import \{[\s\S]*?\} from "\.\/logic.js";/,'').replace('import { createRecorderThemeController } from "./recorder-theme.js";','');
  vm.runInContext(detector, sandbox);
  function dispatch(target,type,props={}) {
    // Model browser hit testing: inert surfaces cannot receive user input.
    if (target.inert || target.hidden) return false;
    const event = new Event(type,{cancelable:true});
    for (const [key,value] of Object.entries(props)) Object.defineProperty(event,key,{value});
    return target.dispatchEvent(event);
  }
  const screen = node('#performance-screen');
  const pointer = (type,x,y,id=1,target=screen)=>dispatch(screen,type,{clientX:x,clientY:y,pointerId:id,target});
  return {node,screen,doc,win,pending,calls,stored,dispatch,pointer,frames,glyph,
    state:()=>{
      const current=JSON.parse(vm.runInContext('JSON.stringify(appState)',sandbox));
      const raw=stored.get(key('STATE_KEY'));
      if(raw!=null)assert.equal(JSON.parse(raw).attemptCount,current.attemptCount,'saved counts match live state after a counted result');
      return current;
    },
    path:()=>node('.wood-trace').getAttribute('d'),
    visibility(hidden){doc.hidden=hidden;doc.dispatchEvent(new Event('visibilitychange'));},
    swipe(){pointer('pointerdown',20,30,1);pointer('pointerdown',60,30,2);pointer('pointermove',20,140,1);pointer('pointermove',60,140,2);},
    tick(ms){const end=now+ms;while(now<end){now=Math.min(end,now+10);
      for(const [id,job] of [...timers])if(job.at<=now){timers.delete(id);job.fn();}
      for(const [id,fn] of [...frames]){frames.delete(id);fn(now);}
    }},
  };
}


const appDirs = [resolve(import.meta.dirname, '../../zz7'), resolve(import.meta.dirname, '../../distribution-snapshots/usotsuki')];

for (const appDir of appDirs) {
  for (const end of ['off-plate','pointerup']) test(`${appDir}: ${end} after verdict preserves the trace`, async()=>{
    const f=await fixture(appDir);f.pointer('pointerdown',194,634);f.tick(500);const last=f.path();
    const child=f.node('.captured-child');child.closest=()=>f.node('#detector-button');
    f.pointer(end==='off-plate'?'pointermove':end,0,0,1,child);f.tick(10000);
    assert.equal(f.path(),last);assert.equal(f.frames.size,0);assert.equal(f.state().attemptCount,1);
  });
  test(`${appDir}: verdict freezes wood trace through captured off-plate drag and release`, async () => {
    const f = await fixture(appDir);
    f.pointer('pointerdown',194,634); f.tick(100);
    const early=f.path(); f.tick(100); assert.notEqual(f.path(),early,'live scan changes trace');
    f.tick(300); const verdict=f.path(); assert.equal(f.state().attemptCount,1);
    f.tick(10000); assert.equal(f.path(),verdict,'held finger cannot animate after verdict');
    const child=f.node('.captured-child'); child.closest=()=>f.node('#detector-button');
    f.pointer('pointermove',0,0,1,child); f.tick(100); assert.equal(f.path(),verdict);
    f.pointer('pointermove',194,634); f.tick(1000); assert.equal(f.path(),verdict);
    f.pointer('pointerdown',194,634,2); f.tick(500); assert.equal(f.state().attemptCount,1,'second pointer cannot restart before lift');
    f.pointer('pointerup',194,634,2); f.pointer('pointerup',194,634);
    f.tick(1000); assert.equal(f.path(),verdict,'release preserves last trace'); assert.equal(f.frames.size,0);
    f.pointer('pointerdown',194,634,3); f.tick(100); assert.notEqual(f.path(),verdict);
    f.tick(400); assert.equal(f.state().attemptCount,2); f.pointer('pointerup',194,634,3);
  });
  for (const end of ['off-plate','pointerup','pointercancel','lostpointercapture','blur','hidden','settings','resize','orientationchange']) {
    test(`${appDir}: ${end} freezes active wood trace without counting or reentry restart`, async () => {
      const f=await fixture(appDir); f.pointer('pointerdown',194,634); f.tick(100); const last=f.path();
      if(end==='off-plate') {
        const child=f.node('.captured-child'); child.closest=()=>f.node('#detector-button');
        f.pointer('pointermove',0,0,1,child);
      } else if(end==='hidden') f.visibility(true);
      else if(end==='settings') f.swipe();
      else if(['blur','resize','orientationchange'].includes(end)) f.win.dispatchEvent(new Event(end));
      else f.pointer(end,194,634);
      f.tick(1000); assert.equal(f.path(),last); assert.equal(f.frames.size,0); assert.equal(f.state().attemptCount,0);
      f.pointer('pointermove',194,634); f.tick(1000); assert.equal(f.path(),last); assert.equal(f.state().attemptCount,0);
    });
  }
  for(const theme of ['green','wine','recorder-a','recorder-d']) {
    test(`${appDir}: ${theme} retains verdict contact lifecycle`, async()=>{
      const f=await fixture(appDir,theme);
      if(theme.startsWith('recorder-')) {f.pending.shift().resolve();await flush();}
      f.pointer('pointerdown',194,634); f.tick(500);
      assert.equal(f.state().attemptCount,1); assert.equal(f.screen.classList.contains('is-live'),true);
      f.pointer('pointerup',194,634); assert.equal(f.screen.classList.contains('is-live'),false);
      f.tick(1000); assert.equal(f.state().attemptCount,1);
    });
  }
}

for(const appDir of appDirs)for(const theme of ['recorder','recorder-a','recorder-d','green','wine'])
 test(`${appDir}: ${theme} cancellation preserves the active screen and renderer identity`,async()=>{
  const f=await fixture(appDir,theme);if(f.pending.length){f.pending.shift().resolve();await flush();}
  const screen=f.screen,themeBefore=screen.dataset.displayTheme,mounts=f.calls.filter(x=>x==='mount').length;
  for(const reason of ['release','leave','blur','visibility','resize']){
   f.pointer('pointerdown',194,634);f.tick(80);
   if(reason==='release')f.pointer('pointerup',194,634);
   if(reason==='leave')f.pointer('pointermove',0,0);
   if(reason==='blur')f.dispatch(f.win,'blur');
   if(reason==='visibility'){f.visibility(true);f.visibility(false);}
   if(reason==='resize')f.dispatch(f.win,'resize');
   for(const ms of [0,8,16,32,80,220]){f.tick(ms);assert.equal(f.screen,screen);assert.equal(screen.hidden,false);assert.equal(f.node('#settings-screen').hidden,true);assert.equal(screen.dataset.displayTheme,themeBefore);assert.equal(f.calls.filter(x=>x==='mount').length,mounts);assert.equal(f.pending.length,0);}
   f.pointer('pointerup',194,634);f.dispatch(f.win,'focus');
  }
 });

for(const appDir of appDirs) test(`${appDir}: first-load idle glyph centers before any test and follows fonts/layout/settings`,async()=>{
 const f=await fixture(appDir,'recorder',true),g=f.glyph;
 const centered=()=>{
  assert.ok(g.attrs.transform,'fresh HTML must be an SVG fitted after the screen becomes visible');
  const [x,y,scale]=g.attrs.transform.match(/[-\d.]+/g).map(Number),b=g.bounds;
  assert.ok(Math.abs(x+scale*(b.x+b.width/2)-g.box.width/2)<1e-9);
  assert.ok(Math.abs(y+scale*(b.y+b.height/2)-g.box.height/2)<1e-9);
 };
 centered();assert.equal(f.state().attemptCount,0);assert.equal(g.observed,f.node('.wood-paper-strip'));
 g.bounds={x:12,y:-15,width:132,height:30};g.fontReady();await flush();centered();
 g.box={width:300,height:24};g.resize();centered();g.bounds={x:22,y:-8,width:140,height:16};g.callbacks.loadingdone();centered();
 f.win.dispatchEvent(new Event('orientationchange'));centered();f.swipe();assert.equal(f.screen.hidden,true);
 f.dispatch(f.node('#start-performance'),'click');centered();assert.equal(f.frames.size,0);
});

for(const appDir of appDirs) test(`${appDir}: irregular damped wood peaks remain inside paper with late lie ratios`,async()=>{
 const source=read(appDir,'detector.js');
 const {buildHeartbeat,heartbeatValue}=vm.runInNewContext(source.slice(source.indexOf('function buildHeartbeat'),source.indexOf('import { createContinuousTrace'))+';({buildHeartbeat,heartbeatValue})');
 const {createContinuousTrace}=await import(pathToFileURL(resolve(appDir,'recorder-trace.js')).href);
 const duration=3000,seed=42,truth=buildHeartbeat({durationMs:duration,seed}),lie=buildHeartbeat({durationMs:duration,seed,verdict:'LIE'});
 for(let t=0;t<=2250;t+=2)assert.equal(heartbeatValue(truth,t),heartbeatValue(lie,t));
 const results=[];
 for(const model of [truth,lie]){
  const trace=createContinuousTrace({position:62,retain:472,responseMs:16,integrationMs:2,smooth:true}),ys=[];
  trace.begin({duration,travel:344,target:t=>heartbeatValue(model,t)});
  for(let t=0;t<=duration;t+=2)ys.push(trace.advance(t).position);
  const peaks=ys.map((y,i)=>({y,t:i*2})).filter((p,i)=>i>0&&i<ys.length-1&&p.y<60&&p.y<ys[i-1]&&p.y<=ys[i+1]);
  const height=(62-Math.min(...ys))/124;
  const early=62-Math.min(...ys.slice(0,1126));
  assert.ok(early/124>=.25&&early/124<=.34,`early rendered R/paper ${early/124}`);assert.ok(peaks.length>=6&&peaks.length<=7);
  assert.ok(Math.min(...ys)>7&&Math.max(...ys)<117);assert.ok(trace.snapshot().samples<=8192);
  assert.match(trace.path(p=>[p.distance,p.position]),/ C/);
  const mean=a=>a.reduce((sum,p)=>sum+62-p.y,0)/a.length;
  const earlyPeaks=peaks.filter(p=>p.t<=duration*.75),latePeaks=peaks.filter(p=>p.t>duration*.75);
  if(model===lie)assert.ok(latePeaks.every(p=>62-p.y>Math.max(...earlyPeaks.map(p=>62-p.y))));
  results.push({early:mean(earlyPeaks),late:mean(latePeaks)});
 }
 assert.ok(Math.abs(results[0].late/results[0].early-1)<.1);
 assert.ok(results[1].late/results[1].early>=1.4&&results[1].late/results[1].early<=1.6);
 assert.equal(results[0].early,results[1].early);
 // Scheduled late R times retain the .72 compression after input calibration.
 for(const [t,y] of truth.points.filter(([t,y])=>t>2250&&t<3000&&y<50)){
  assert.ok(lie.points.some(([at])=>Math.abs(at-(2250+(t-2250)*.72))<1e-8));
 }
});

for(const appDir of appDirs) test(`${appDir}: absent scan preference defaults to 3s with read-only load and saved short values retained`,async()=>{
 for(const scan of [null,'0.5','2','6','10']){
  const f=await fixture(appDir,'green',false,scan);
  const expected=scan??'3';
  assert.equal(f.node('#scan-duration').value,expected);
  assert.equal(f.stored.get('usotsuki.detector.scan-duration.v1'),scan??undefined);
  f.pointer('pointerdown',194,634);f.tick(Number(expected)*1000-10);
  assert.equal(f.state().attemptCount,0);
  f.tick(10);assert.equal(f.state().attemptCount,1);
  assert.equal(f.stored.get('usotsuki.detector.scan-duration.v1'),expected);
 }
});
