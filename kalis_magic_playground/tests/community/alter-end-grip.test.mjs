import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const source = process.env.ALTER_SOURCE || fileURLToPath(new URL('../../zz10/', import.meta.url));
const load = name => import(pathToFileURL(resolve(source, name)));
const {captureBackground, detectCard, detectCardAgainstBackground, cardOcclusionMask, orderCorners} = await load('vision.js');
const {createBackgroundCalibrator, observeCalibration} = await load('calibration.js');
const {createObservationTracker, trackObservation} = await load('performance.js');
const {createAlterState, updateAlterState, AlterState} = await load('logic.js');

// Independent hand-drawn geometry; no production fixtures or copied scenarios.
const W=256, H=352, paper=[237,235,227], warm=[192,137,105], neutral=[201,201,201];
const quad=(x=74,y=83)=>[{x,y},{x:x+108,y},{x:x+108,y:y+151},{x,y:y+151}];
function blank() {
  const data=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
    const v=35+Math.floor(x/48)+Math.floor(y/70), i=(y*W+x)*4;
    data.set([v,v+4,v+8,255],i);
  }
  return {width:W,height:H,data};
}
function rect(f,x0,y0,x1,y1,c) {
  for(let y=Math.max(0,y0);y<Math.min(H,y1);y++)for(let x=Math.max(0,x0);x<Math.min(W,x1);x++) f.data.set([...c,255],(y*W+x)*4);
}
function hand(f,color=warm,shift=0) {
  // Three broad fingers merge into a palm outside the card's short edge.
  rect(f,81,260+shift,180,H,color);
  for(const [x,top,width] of [[84,219,27],[117,214,28],[151,220,27]]) rect(f,x,top+shift,x+width,280+shift,color);
  return f;
}
function scene({color=warm,x=74,y=83,art=true,handShift=0}={}) {
  const f=blank();rect(f,x,y,x+108,y+151,paper);
  if(art){rect(f,x+14,y+17,x+32,y+40,[28,32,36]);rect(f,x+43,y+52,x+72,y+98,[175,27,35]);}
  hand(f,color,handShift);return f;
}
const reference=captureBackground(blank());
function detect(f,ref=reference){return detectCardAgainstBackground(f,ref)||detectCard(f);}
function near(hit,want,tol=6) {
  assert.ok(hit,'a full held card should be detected');
  const actual=orderCorners(hit.corners), expected=orderCorners(want);
  assert.ok(actual.every((p,i)=>Math.hypot(p.x-expected[i].x,p.y-expected[i].y)<=tol),JSON.stringify(actual));
}
function alpha(mask,x,y,q=quad()) {
  const mx=Math.max(0,Math.min(mask.width-1,Math.floor((x-q[0].x)/108*mask.width)));
  const my=Math.max(0,Math.min(mask.height-1,Math.floor((y-q[0].y)/151*mask.height)));
  return mask.data[(my*mask.width+mx)*4+3];
}
test('fingers-only pause never produces a replacement',()=>{
  for(const color of [warm,neutral,[235,207,184]]) {
    let tracker=createObservationTracker(), machine=createAlterState();
    for(let t=0;t<=3000;t+=100) {
      const hit=detect(hand(blank(),color));assert.equal(hit,null,`hand-only ${color}`);
      const r=trackObservation(tracker,hit,t,W,H);tracker=r.tracker;
      machine=updateAlterState(machine,{type:'observe',...r.observation});
    }
    assert.equal(machine.state,AlterState.IDLE);
  }
});
test('broad three-finger short-edge grip retains the full card quad',()=>{
  for(const color of [warm,neutral])near(detect(scene({color})),quad());
});
test('empty calibration, long finger pause, then slowly arriving card activates after full visibility',()=>{
  const c=createBackgroundCalibrator();for(let t=0;t<=2000;t+=100)observeCalibration(c,blank(),t,false);
  assert.ok(c.reference);
  let tracker=createObservationTracker(),machine=createAlterState();
  for(let t=2100;t<=4300;t+=100) {
    const hit=detect(hand(blank()),c.reference);assert.equal(hit,null);
    const r=trackObservation(tracker,hit,t,W,H);tracker=r.tracker;
    machine=updateAlterState(machine,{type:'observe',...r.observation});
  }
  // The card moves slowly upward from clipping; a full quad must be present.
  let visibleAt=null;
  for(let t=4400;t<=6600;t+=100) {
    const y=Math.max(83,240-(t-4400)/10);
    const hit=detect(scene({y}),c.reference);
    const r=trackObservation(tracker,hit,t,W,H);tracker=r.tracker;
    machine=updateAlterState(machine,{type:'observe',...r.observation});
    if(machine.state===AlterState.ALTER_VISIBLE&&visibleAt===null)visibleAt=t;
  }
  assert.ok(visibleAt!==null,'slow full-card arrival must eventually activate');
  assert.ok(visibleAt<6600,'must activate without requiring removal of the end grip');
});
test('warm and neutral fingers remain in front while isolated artwork stays covered',()=>{
  for(const color of [warm,neutral]) {
    const f=scene({color}),saved=f.data.slice(),mask=cardOcclusionMask(f,quad(),reference);
    for(const x of [95,128,162])assert.equal(alpha(mask,x,226),0,`${color}/${x}: live finger`);
    assert.equal(alpha(mask,96,113),255,'black print must remain covered');
    assert.equal(alpha(mask,132,161),255,'red print must remain covered');
    const fraction=mask.data.reduce((sum,v,i)=>sum+(i%4===3&&v===0?1:0),0)/(mask.width*mask.height);
    assert.ok(fraction<.16,`holes ${fraction}`);assert.deepEqual(f.data,saved);
  }
});
test('clipped paper does not activate, full reentry recovers its geometry',()=>{
  for(const y of [-50,-16,240,285]) {
    const hit=detect(scene({y}));assert.equal(hit,null,`clipped y=${y}`);
  }
  near(detect(scene()),quad());
});
test('repeated detection and mask processing remain read-only with bounded output',()=>{
  const f=scene(),saved=f.data.slice();
  for(let i=0;i<12;i++) {
    detect(f);const mask=cardOcclusionMask(f,quad(),reference);
    assert.equal(mask.data.length,120*168*4);
  }
  assert.deepEqual(f.data,saved);
});
