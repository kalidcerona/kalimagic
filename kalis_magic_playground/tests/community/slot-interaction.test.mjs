import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {suitAt,rankAt} from '../../distribution-snapshots/slot/zones.mjs';
import {listen} from '../../distribution-snapshots/slot/gestures.mjs';
import {createRound} from '../../distribution-snapshots/slot/round.mjs';
import {createReels} from '../../distribution-snapshots/slot/reels.mjs';
import {drawCard} from '../../distribution-snapshots/slot/card-face.mjs';
import {portraitGuard} from '../../distribution-snapshots/slot/orientation.mjs';

const dir = new URL('../../distribution-snapshots/slot/',import.meta.url);
const read = name => readFileSync(new URL(name,dir),'utf8');
const rect = (left,top,width,height) => ({left,top,width,height,right:left+width,bottom:top+height});
const boxes = {stage:rect(0,0,400,800),spin:rect(30,340,340,64),capsule:rect(164,470,72,72)};
class Element extends EventTarget {
  children = [];
  style = {};
  attributes = {};
  setPointerCapture() {}
  append(node) { this.children.push(node); }
  replaceChildren() { this.children = []; }
  setAttribute(k,v) { this.attributes[k] = v; }
}
function harness() {
  const surface = new Element(), result = new Element(), symbols = [new Element(),new Element(),new Element()];
  const events = [];
  let time = 0, phase, modal = false, sideways = false;
  const round = createRound({
    box:key => boxes[key],blocked:() => modal || sideways,now:() => time,
    render:value => { phase = value; events.push(value); },
    reels:createReels(symbols,() => .8),
    capsule:value => events.push(value),
    reveal:card => { drawCard(result,card); events.push(card ? 'face' : 'empty'); },
    audio:{stop:() => events.push('mute'),unlock:() => events.push('unlock'),play:v => events.push(v)},
    vibrate:() => events.push('buzz')
  });
  const clear = listen(surface,round.candidate,() => { modal = true; });
  function point(type,x,y,id=1) {
    const e = Object.assign(new Event(type),{clientX:x,clientY:y,pointerId:id,button:0});
    surface.dispatchEvent(e);
  }
  return {events,result,symbols,round,point,
    tap(x,y) { point('pointerdown',x,y); point('pointerup',x,y); },
    advance(ms) { time += ms; round.advance(ms); },
    landscape(v) { sideways = v; clear(); },
    phase:() => phase, modal:() => modal
  };
}
test('button-relative and stage boundaries include the outer edges',() => {
  for (let i=0;i<10;i++) {
    assert.equal(rankAt(boxes.spin,30+34*i,404),i+1);
    if (i) assert.equal(rankAt(boxes.spin,30+34*i-.01,340),i);
  }
  assert.equal(rankAt(boxes.spin,370,404),10);
  assert.equal(rankAt(boxes.spin,371,404),undefined);
  assert.equal(rankAt(boxes.spin,30,339),undefined);
  assert.deepEqual([[0,0],[200,0],[0,400],[200,400]].map(([x,y]) => suitAt(boxes.stage,x,y)),['♠','♦','♣','♥']);
});
test('40 event paths share the entire pre-reveal trace and render exactly one correct face',t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:() => new Element()}});
  t.after(() => descriptor ? Object.defineProperty(globalThis,'document',descriptor) : delete globalThis.document);
  let reference;
  for (const [index,name] of ['스페이드','다이아몬드','클럽','하트'].entries()) {
    for (let rank=1;rank<=10;rank++) {
      const h = harness();
      h.tap(index%2*200+50,Math.floor(index/2)*400+40);
      h.tap(47+(rank-1)*34,362);
      const trace = [];
      for (const ms of [78,822,300,300,599]) {
        h.advance(ms);
        trace.push(h.symbols.map(node => [node.textContent,node.style.transform]));
        assert.equal(h.result.children.length,0);
      }
      assert.equal(h.phase(),'rolling');
      h.point('pointerdown',200,500);
      h.advance(1);
      h.point('pointerup',200,500);
      assert.equal(h.phase(),'waiting');
      trace.push([...h.events]);
      reference ??= trace;
      assert.deepEqual(trace,reference);
      h.tap(200,500); h.tap(200,500); h.advance(300);
      assert.equal(h.phase(),'revealed');
      assert.equal(h.result.children.length,1);
      const face = h.result.children[0];
      assert.equal(face.attributes['aria-label'],name+' '+(rank===1?'A':rank));
      assert.equal(face.children.length,rank+2);
      const columns = [[],[1],[2],[3],[2,2],[2,1,2],[3,3],[3,1,3],[3,2,3],[4,1,4],[4,2,4]];
      const pips = face.children.slice(2);
      assert.deepEqual(['27%','50%','73%'].map(x => pips.filter(p => p.style.left === x).length)
        .filter(Boolean),columns[rank]);
      assert.equal(new Set(pips.map(p => p.style.left+','+p.style.top)).size,rank);
      for (const pip of pips) assert.equal(pip.className === 'inverted', parseFloat(pip.style.top)>50);
      const suit = ['♠','♦','♣','♥'][index];
      assert.ok(face.children.slice(2).every(pip => pip.textContent === suit));
      assert.equal(face.children[0].textContent,(rank===1?'A':rank)+'\n'+suit);
      h.round.reset();
      assert.equal(h.result.children.length,0);
      assert.equal(h.phase(),'dark');
    }
  }
});
test('multitouch, drag, cancellation and held taps across every performance phase',() => {
  function prepare(phase) {
    const h = harness();
    if (phase === 'dark') return h;
    h.tap(20,20);
    if (phase === 'ready') return h;
    h.tap(50,370);
    if (phase === 'spinning') return h;
    h.advance(1500);
    if (phase === 'rolling') return h;
    h.advance(600);
    if (phase === 'waiting') return h;
    h.tap(200,500);
    return h;
  }
  for (const phase of ['dark','ready','spinning','rolling','waiting','opening']) {
    const h = prepare(phase);
    const [x,y] = phase === 'ready' ? [50,370] : [200,500];
    for (const id of [1,2,3]) h.point('pointerdown',x+id,y,id);
    for (const id of [1,2,3]) h.point('pointermove',x+id,y+110,id);
    for (const id of [1,2,3]) h.point('pointerup',x+id,y+110,id);
    assert.equal(h.modal(),false);
    h.point('pointerdown',x,y); h.point('pointermove',x+18,y); h.point('pointerup',x,y);
    h.point('pointerdown',x,y); h.point('pointercancel',x,y); h.point('pointerup',x,y);
    assert.equal(h.phase(),phase);
    for (const id of [1,2]) h.point('pointerdown',x+id,y,id);
    for (const id of [1,2]) h.point('pointermove',x+id,y+100,id);
    for (const id of [1,2]) h.point('pointerup',x+id,y+100,id);
    assert.equal(h.modal(),true);
    h.advance(1000);
    assert.equal(h.phase(),phase);
    h.round.reset(); h.advance(1000); assert.equal(h.phase(),'dark');
  }
  const h = prepare('ready');
  h.point('pointerdown',80,370); h.advance(600); h.point('pointerup',80,370);
  assert.equal(h.phase(),'ready');
});
test('two-finger settings swipe consumes the performance gesture',() => {
  const h = harness();
  for (const [type,y] of [['pointerdown',40],['pointermove',148],['pointerup',148]]) {
    h.point(type,100,y,1); h.point(type,200,y,2);
  }
  assert.equal(h.modal(),true); assert.equal(h.phase(),'dark');
});
test('landscape blocks input, cancels a held press and freezes the round',() => {
  const h = harness();
  h.landscape(true); h.tap(12,12); assert.equal(h.phase(),'dark');
  h.landscape(false); h.tap(12,12); h.point('pointerdown',50,370);
  h.landscape(true); h.landscape(false); h.point('pointerup',50,370);
  assert.equal(h.phase(),'ready');
  h.tap(50,370); h.landscape(true); h.advance(5000); assert.equal(h.phase(),'spinning');
  h.landscape(false); h.advance(1500); assert.equal(h.phase(),'rolling');
  h.round.reset(); h.advance(5000); assert.equal(h.phase(),'dark');
});
test('orientation guard follows landscape changes even when lock fails',async () => {
  const media = new EventTarget(); let changes = 0;
  const guard = vm.runInNewContext('('+portraitGuard.toString()+')',{
    matchMedia:q => {assert.equal(q,'(orientation: landscape)');return media;},
    screen:{orientation:{lock:async () => {throw Error('denied');}}}
  })(() => changes++);
  media.matches = true; media.dispatchEvent(new Event('change'));
  assert.equal(guard(),true); assert.equal(changes,1);
});
test('visible return retries wake lock after rejection and release',async () => {
  const doc = new EventTarget(); doc.visibilityState = 'visible';
  let requests = 0, releases = 0;
  const wakeLock = {request:async type => {
    assert.equal(type,'screen');
    if (++requests === 1) throw Error('denied');
    const lock = new EventTarget();
    lock.release = async () => { releases++; };
    return lock;
  }};
  const wake = vm.runInNewContext(read('wake-lock.js').replace('export function','function')+'\nsetupWakeLock',
    {document:doc,navigator:{wakeLock},setTimeout})(() => {});
  await wake.keepAwake();
  for (let i=0;i<2;i++) {
    for (const value of ['hidden','visible']) {
      doc.visibilityState = value; doc.dispatchEvent(new Event('visibilitychange'));
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  assert.equal(requests,3); assert.equal(releases,1);
});
test('service worker lists the exact app shell, manifest and PNG dimensions match',() => {
  const sw = read('sw.js');
  const files = JSON.parse(/const SHELL = (\[[\s\S]*?\]);/.exec(sw)[1]);
  assert.deepEqual(files.sort(),readdirSync(dir).filter(f => f!=='sw.js').sort().map(f=>'./'+f));
  assert.match(sw,/friend-slot-shell-/); assert.match(sw,/v20261121-2/);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.orientation,'portrait'); assert.equal(manifest.id,'/tools/slot/');
  for (const n of [192,512]) {
    const png = readFileSync(new URL('icon-'+n+'.png',dir));
    assert.equal(png.toString('ascii',1,4),'PNG');
    assert.equal(png.readUInt32BE(16),n); assert.equal(png.readUInt32BE(20),n);
  }
});

test('strips descend continuously, settle at centred cells in left-to-right order',() => {
  const strips = Array.from({length:3},() => new Element());
  const reels = createReels(strips,() => .6);
  reels.reset();
  const text = strips.map(strip => strip.textContent);
  assert.ok(text.every(value => value.split('\n').every(symbol => ['🍒','🍋','🔔','7'].includes(symbol))));
  function positions(t) {
    reels.frame(t);
    return strips.map(strip => parseFloat(strip.style.transform.slice(11)));
  }
  const start = positions(0), early = positions(100), later = positions(200);
  for (let i=0;i<3;i++) {
    assert.ok(later[i]>early[i] && early[i]>start[i]);
    assert.ok(early[i]-start[i]>later[i]-early[i]);
    const stop = 900+300*i;
    const bounce = positions(stop-55)[i], end = positions(stop)[i];
    assert.ok(bounce>end);
    assert.equal(Math.abs(end)%100,0);
    assert.equal(positions(stop+60)[i],end);
    if (i<2) assert.notEqual(positions(stop)[i+1],positions(stop+60)[i+1]);
  }
  assert.deepEqual(strips.map(strip => strip.textContent),text);
});
