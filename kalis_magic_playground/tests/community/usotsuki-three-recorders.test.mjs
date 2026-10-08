import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createRecorderThemeController } from '../../zz7/recorder-theme.js';

const read = file => readFileSync(new URL('../../zz7/'+file, import.meta.url), 'utf8');
function engineFixture({ reduced=false, AudioContext }={}) {
 let now=0, serial=0; const timers=new Map(), frames=new Map(), ids=new Map();
 class Node {
  constructor(){this.children=[];this.style={setProperty(k,v){this[k]=v;}};this.dataset={};this.attrs={};this.textContent='';this.classes=new Set();this.classList={toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k)};}
  append(...xs){this.children.push(...xs);} replaceChildren(...xs){this.children=xs;}
  setAttribute(k,v){this.attrs[k]=v;} getAttribute(k){return this.attrs[k];}
 }
 const root={getElementById(id){if(!ids.has(id))ids.set(id,new Node());return ids.get(id);},replaceChildren(){ids.clear();}};
 const sandbox={performance:{now:()=>now},window:{AudioContext,matchMedia:()=>({matches:reduced})},document:{createElement:()=>new Node(),createElementNS:()=>new Node()},URLSearchParams,
 requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
 const code=read('recorder-engine.js').replace('export function mountRecorder','function mountRecorder')+'\nthis.mountRecorder=mountRecorder;';
 vm.runInNewContext(code,sandbox);const renderer=sandbox.mountRecorder(root,{skin:'a',ink:'#1a120c'});
 function advance(t){now=t;for(const [id,job]of [...timers])if(job.at<=now){timers.delete(id);job.fn();}const batch=[...frames];frames.clear();for(const [,fn]of batch)fn(now);}
 return {renderer,advance,timers,frames,ids,begin:(duration=500,verdict='LIE')=>renderer.begin({duration,startedAt:now,verdict,attempt:1,sound:false})};
}

test('heartbeat paper travel adopts 90px at .5s and 380px at 10s; detector owns finish',()=>{
 for(const [duration,rise]of [[500,90],[10000,380]]){
  const f=engineFixture();f.begin(duration);f.advance(duration);
  assert.equal(f.renderer.snapshot().rise,rise);assert.equal(f.renderer.snapshot().mode,'scan');assert.equal(f.ids.get('glyphs').children.length,0);
  f.renderer.finish(true,'TRUE',duration);f.advance(duration+466);f.advance(duration+576);
  assert.deepEqual(Array.from(f.renderer.snapshot().struck),[true,true]);assert.equal(f.ids.get('glyphs').children[0].children[1].children[0].textContent,'진');
  assert.equal(f.renderer.snapshot().volume,.48);assert.equal(f.renderer.snapshot().paperShift,rise);
 }
});
test('early release leaves partial ink, no verdict strikes; teardown clears jobs, frames and audio',()=>{
 const f=engineFixture();f.begin(2000);f.advance(500);f.renderer.finish(false,null,500);
 assert.ok(f.renderer.snapshot().paperShift>0);assert.ok(f.renderer.snapshot().paperShift<f.renderer.snapshot().rise);
 f.advance(3000);assert.deepEqual(Array.from(f.renderer.snapshot().struck),[false,false]);f.renderer.destroy();
 assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.equal(f.renderer.snapshot().contextState,'closed');
 f.renderer.setPressed(false);f.renderer.finish(false,null,3000);assert.equal(f.frames.size,0);
});
test('repeat feed fits inside detector duration and previous glyph coordinates stay fixed',()=>{
 const f=engineFixture();f.begin();f.advance(500);f.renderer.finish(true,'LIE',500);f.advance(966);f.advance(1076);f.advance(1140);
 const positions=f.ids.get('glyphs').children.map(g=>g.style.top);
 f.begin();assert.equal(f.renderer.snapshot().feedMs,240);f.advance(1640);f.renderer.finish(true,'TRUE',1640);f.advance(2106);f.advance(2216);
 assert.deepEqual(f.ids.get('glyphs').children.slice(0,2).map(g=>g.style.top),positions);assert.equal(f.ids.get('glyphs').children.length,4);
});
test('reduced motion still prints two actual verdict glyphs without a delayed job',()=>{
 const f=engineFixture({reduced:true});f.begin();f.advance(500);f.renderer.finish(true,'LIE',500);
 assert.deepEqual(Array.from(f.renderer.snapshot().struck),[true,true]);assert.equal(f.timers.size,0);f.renderer.destroy();assert.equal(f.frames.size,0);
});
test('A/D skins retain single stylus, long idle typebar, black 80px impressions and no controls',()=>{
 for(const skin of ['a','d']){
  const html=read(`recorder-${skin}.html`);
  assert.equal((html.match(/id="penRigid"/g)||[]).length,1);assert.equal((html.match(/id="typebar"/g)||[]).length,1);
  assert.match(html,/font:80px\/80px/);assert.match(html,/fill:#1a120c/);assert.doesNotMatch(html,/<script|<nav|<button/);
 }
});
test('protected CSS prefix and shared preparation rule remain unchanged',()=>{
 const css=read('style.css');assert.equal(createHash('sha256').update(css.split('\n').slice(0,929).join('\n')+'\n').digest('hex'),'07ad81bbc85967754c072d262d8ef2337cf2e0077ec2d077b008139108a8e288');
 assert.equal((css.match(/#performance-screen\.is-preparing #test-indicator \{ font-size: clamp\(12px, 3\.5vw, 16px\); letter-spacing: 0; white-space: nowrap; \}/g)||[]).length,1);
});
test('theme switch destroys old engine and ignores stale asynchronous mounts',async()=>{
 const originalDoc=globalThis.document;const mounts=[],pending=[];let removed=0,dead=0;
 const node=()=>({dataset:{},style:{setProperty(){}},setAttribute(){},attachShadow(){return this.shadowRoot={innerHTML:'',append(){},querySelector:()=>({getBoundingClientRect:()=>({x:.303466796875,y:0,width:389.39306640625,height:844})})};},remove(){removed++;}});
 globalThis.document={createElement:node};
 const screen={dataset:{},attachShadow(){},getBoundingClientRect:()=>({width:390,height:844}),style:{setProperty(){}},append(){}};
 const module={mountRecorder(root,config){mounts.push(config.skin);return {setSoundEnabled(){},setPressed(){},destroy(){dead++;},snapshot:()=>({})};}};
 const load=()=>new Promise(resolve=>pending.push(()=>resolve([module,'<main></main>'])));
 try{
  const c=createRecorderThemeController(screen,()=>({sound:false,holding:false}),load);
  c.switchTheme('recorder-a');c.switchTheme('recorder-d');pending[0]();await new Promise(setImmediate);assert.deepEqual(mounts,[]);
  pending[1]();await new Promise(setImmediate);assert.deepEqual(mounts,['d']);c.switchTheme('green');assert.equal(dead,1);assert.equal(removed,1);assert.equal(c.snapshot(),null);
 }finally{globalThis.document=originalDoc;}
});


test('all skin filter references resolve locally inside the isolated root',()=>{
 for(const skin of ['a','d']){
  const html=read(`recorder-${skin}.html`), ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  for(const match of html.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.has(match[1]),match[1]);
  for(const id of ['inkBleed1Truth','inkBleed2Truth','inkBleed1Lie','inkBleed2Lie'])assert.ok(ids.has(id),id);
  assert.match(html,/:host\(\[data-concept=['"]d['"]\]\)/);
 }
});

test('font rejection or pending FontFaceSet cannot block the actual A/D loader and host',async()=>{
 for(const outcome of ['reject','pending']){
  let fontCalls=0,mounts=0;
  const module={mountRecorder(){mounts++;return {setSoundEnabled(){},setPressed(){},destroy(){}};}};
  const node=()=>({dataset:{},style:{setProperty(){}},setAttribute(){},attachShadow(){return this.shadowRoot={innerHTML:'',append(){},querySelector:()=>({getBoundingClientRect:()=>({x:.303466796875,y:0,width:389.39306640625,height:844})})};},remove(){}});
  const screen={dataset:{},attachShadow(){},getBoundingClientRect:()=>({width:390,height:844}),style:{setProperty(){}},append(){}};
  const sandbox={URL,console:{error(){}},setTimeout,clearTimeout,document:{createElement:node,fonts:{ready:new Promise(()=>{}),add(){}}},
   FontFace:class{load(){fontCalls++;return outcome==='reject'?Promise.reject(new Error('NetworkError: A network error occurred.')):new Promise(()=>{});}},
   fetch:async()=>({ok:true,text:async()=>'<main></main>'}),importEngine:async()=>module};
  const code=read('recorder-theme.js').replaceAll('import.meta.url','"https://example.test/recorder-theme.js"').replace('import("./recorder-engine.js")','importEngine()').replace('export function createRecorderThemeController','function createRecorderThemeController');
  vm.runInNewContext(code+';this.controller=createRecorderThemeController;',sandbox);
  sandbox.controller(screen,()=>({sound:false,holding:false})).switchTheme('recorder-a');
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(mounts,1,outcome+' host mounts');assert.equal(fontCalls,0);
 }
});


test('native contact target follows the actual stage transform across resize and screen offset',async()=>{
 const originalDoc=globalThis.document,originalObserver=globalThis.ResizeObserver;
 const properties={};let resize;
 let screenBox={x:13,y:17,width:390,height:844};
 let stageBox={x:13.303466796875,y:17,width:389.39306640625,height:844};
 const host={dataset:{},style:{setProperty(){}},setAttribute(){},remove(){},attachShadow(){return this.shadowRoot={querySelector:()=>({getBoundingClientRect:()=>stageBox})};}};
 const screen={attachShadow(){},append(){},getBoundingClientRect:()=>screenBox,style:{setProperty(k,v){properties[k]=parseFloat(v);}}};
 globalThis.document={createElement:()=>host};
 globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}disconnect(){}};
 const module={mountRecorder:()=>({setSoundEnabled(){},setPressed(){},destroy(){}})};
 try{
  const controller=createRecorderThemeController(screen,()=>({sound:false}),async()=>[module,'']);
  controller.switchTheme('recorder-d');await new Promise(setImmediate);
  function check(){
   const scale=stageBox.width/412;
   assert.equal(properties['--ad-key-left'],stageBox.x-screenBox.x+132*scale);
   assert.equal(properties['--ad-key-top'],stageBox.y-screenBox.y+566*scale);
   assert.equal(properties['--ad-key-size'],148*scale);
  }
  check();screenBox={x:5,y:7,width:844,height:390};stageBox={x:337.0336,y:7,width:179.9328,height:390};resize();check();
  controller.switchTheme('green');
 }finally{globalThis.document=originalDoc;globalThis.ResizeObserver=originalObserver;}
});


test('suspend invalidates a pending load and disconnects mounted observers until resume', async()=>{
 const oldDoc=globalThis.document, oldRO=globalThis.ResizeObserver;
 const pending=[], calls=[];let observed=0,disconnected=0;
 const host={dataset:{},style:{setProperty(){}},setAttribute(){},remove(){},attachShadow(){return this.shadowRoot={querySelector:()=>({getBoundingClientRect:()=>({x:0,y:0,width:390,height:844})})};}};
 globalThis.document={createElement:()=>host};
 globalThis.ResizeObserver=class{observe(){observed++;}disconnect(){disconnected++;}};
 const screen={attachShadow(){},append(){},style:{setProperty(){}},getBoundingClientRect:()=>({x:0,y:0,width:390,height:844})};
 const module={mountRecorder(){calls.push('mount');return {setSoundEnabled(){},setPressed(v){calls.push(v);},suspend(){calls.push('suspend');},destroy(){},unlock(){}};}};
 const load=()=>new Promise(resolve=>pending.push(()=>resolve([module,''])));
 try{
  const c=createRecorderThemeController(screen,()=>({sound:true,holding:false}),load);
  c.switchTheme('recorder-a');c.suspend();pending.shift()();await new Promise(setImmediate);
  assert.deepEqual(calls,[]);assert.equal(observed,0);
  c.switchTheme('recorder-a');c.finish(true,'TRUE');assert.equal(pending.length,0);assert.deepEqual(calls,[]);
  c.setPressed(true);pending.shift()();await new Promise(setImmediate);
  assert.equal(observed,1);c.suspend();assert.equal(disconnected,1);
  const before=calls.length;c.setPressed(false);assert.equal(calls.length,before);
  c.setPressed(true);assert.equal(observed,2);c.switchTheme('green');assert.equal(disconnected,2);
 }finally{globalThis.document=oldDoc;globalThis.ResizeObserver=oldRO;}
});

test('opened AudioContext is closed on suspend and release cannot queue frames',()=>{
 const contexts=[];
 const param=()=>({value:0,setValueAtTime(){}});
 class AudioContext {
  constructor(){this.state='running';this.currentTime=0;this.destination={};this.closeCalls=0;contexts.push(this);}
  createGain(){return {gain:param(),connect(){}};}
  createDynamicsCompressor(){return {threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){}};}
  close(){this.closeCalls++;this.state='closed';return Promise.resolve();}
 }
 const f=engineFixture({AudioContext});f.renderer.setSoundEnabled(true);f.renderer.unlock();
 assert.equal(contexts.length,1);assert.equal(f.renderer.snapshot().contextState,'running');
 f.renderer.suspend();assert.equal(contexts[0].state,'closed');assert.equal(contexts[0].closeCalls,1);
 f.renderer.setPressed(false);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
 f.renderer.destroy();assert.equal(contexts[0].closeCalls,1);
});

test('A/D gesture unlock does not open the legacy detector AudioContext',()=>{
 const code=read('detector.js');const body=code.slice(code.indexOf('function unlockFromGesture()'),code.indexOf('function commitTruthAttempt()'));
 let legacy=0,unlocked=0;
 vm.runInNewContext(body+';unlockFromGesture();',{recorderThemes:{active:()=>true,setSoundEnabled(){},unlock(){unlocked++;}},soundEnabled:()=>true,settingsVisible:()=>false,document:{hidden:false},ensureAudio(){legacy++;return null;}});
 assert.equal(unlocked,1);assert.equal(legacy,0);
});

test('snapshot changes exactly three named constants and excludes the localhost preview hook',()=>{
 const personal=read('detector.js');let shared=readFileSync(new URL('../../distribution-snapshots/usotsuki/detector.js',import.meta.url),'utf8');
 assert.equal((shared.match(/usotsuki\.distribution\./g)||[]).length,3);
 let changes=0;
 for(const name of ['STATE_KEY','SOUND_KEY','DISPLAY_THEME_KEY']){
  const pattern=new RegExp('(const '+name+' = ")usotsuki\\.distribution\\.');
  assert.match(shared,pattern);shared=shared.replace(pattern,'$1usotsuki.');changes++;
 }
 assert.equal(changes,3);assert.equal(shared,personal);assert.doesNotMatch(personal,/magic-local-settings/);
});


test('nameplate retains referenced prototype glyphs with local masks and unique ids',()=>{
 for(const skin of ['a','d']){
  const html=read(`recorder-${skin}.html`),plate=html.match(/<svg class="plateWords"[\s\S]*?<\/svg>/)[0];
  assert.equal((plate.match(/<use\b/g)||[]).length,11);
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  assert.equal((plate.split('</defs>')[1].match(/<use\b/g)||[]).length,4);
  for(const match of plate.matchAll(/<text([^>]*)>/g)){
   assert.match(match[1],/dominant-baseline="central"/);assert.match(match[1],/text-anchor="middle"/);
   assert.match(match[1],/font-size:40px;font-weight:600;letter-spacing:\.02em;line-height:1/);
  }
  for(const match of plate.matchAll(/url\(#([^)]*)\)/g))assert.ok(plate.includes(`id="${match[1]}"`));
 }
});
