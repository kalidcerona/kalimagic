import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {cadence,finalJitter,paperValues} from './alter-realism-mask-fixture.mjs';
import {paperScene,corners} from './alter-realism-fixture.mjs';
const source=process.env.ALTER_SOURCE || fileURLToPath(new URL('../../zz10/', import.meta.url));if(!source)throw new Error('ALTER_SOURCE required');
const {createObservationTracker,trackObservation,createDisplaySmoother,smoothDisplayedCorners}=await import(pathToFileURL(`${source}/performance.js`));
const {createPaperMatch,sampleCardPaper,updatePaperMatch}=await import(pathToFileURL(`${source}/appearance.js`));
const card=x=>({corners:[{x,y:45},{x:x+58,y:45},{x:x+58,y:133},{x,y:133}]});
const observe=(state,x,t)=>trackObservation(state,x===null?null:card(x),t,230,230);
function arm(){let state=createObservationTracker();for(const [x,t]of[[25,100],[14,173],[4,245]])state=observe(state,x,t).tracker;return state;}
test('new heldout variable cadence jitter is reduced while move responds immediately',()=>{
  let state=createDisplaySmoother(),t=0;const shown=[];
  const original=structuredClone(finalJitter);
  for(const frame of finalJitter){t+=frame.dt;const result=smoothDisplayedCorners(state,frame.corners,t);state=result.state;shown.push(result.corners[0]);}
  const spread=points=>{const x=points.reduce((s,p)=>s+p.x,0)/points.length,y=points.reduce((s,p)=>s+p.y,0)/points.length;return Math.sqrt(points.reduce((s,p)=>s+(p.x-x)**2+(p.y-y)**2,0)/points.length);};
  const raw=spread(finalJitter.map(f=>f.corners[0])),filtered=spread(shown);assert.ok(filtered<raw*.8,`${filtered} vs ${raw}`);
  const moving=finalJitter.at(-1).corners.map(p=>({x:p.x+19,y:p.y-8}));
  const moved=smoothDisplayedCorners(state,moving,t+cadence[0]);
  assert.ok(Math.hypot(moved.corners[0].x-moving[0].x,moved.corners[0].y-moving[0].y)<=4);
  assert.deepEqual(finalJitter,original);
});
test('new heldout backwards observation relative to last absence poll cancels earned exit',()=>{
  let state=observe(arm(),null,398).tracker;
  state=observe(state,null,376).tracker;
  assert.equal(observe(state,null,595).observation.fullFrameExit,false);
});
test('new heldout gradual real movement does not stay inside a growing dead zone',()=>{
  const first=finalJitter[0].corners;
  let result=smoothDisplayedCorners(createDisplaySmoother(),first,100),previous=first[0].x;
  for(let i=1;i<=9;i++){
    const moving=first.map(p=>({x:p.x+i*2.6,y:p.y}));
    result=smoothDisplayedCorners(result.state,moving,100+i*80);
    assert.ok(moving[0].x-result.corners[0].x<=3.5,`step ${i} lag ${moving[0].x-result.corners[0].x}`);
    assert.ok(result.corners[0].x>previous,`step ${i} must progress`);previous=result.corners[0].x;
  }
});
test('new heldout regular absence polls retain genuine exact350ms full exit',()=>{
  let state=arm();
  for(const t of[323,398,471,544,594]){const result=observe(state,null,t);assert.equal(result.observation.fullFrameExit,false);state=result.tracker;}
  assert.equal(observe(state,null,595).observation.fullFrameExit,true);
});
test('new heldout cool and dim neutral paper remains bounded then resets after exposure gap',()=>{
  let state=createPaperMatch();let t=100;
  for(const paper of paperValues){
    const {frame,mask}=paperScene({paper,hand:true});const original=frame.data.slice(),originalMask=mask.data.slice();
    const sample=sampleCardPaper(frame,corners,mask);assert.equal(sample.reliable,true);
    assert.ok(sample.color.gain>=.72&&sample.color.gain<=1.05);
    for(const channel of['r','g','b'])assert.ok(sample.color[channel]>=168&&sample.color[channel]<=252);
    const result=updatePaperMatch(state,sample,t);state=result.state;t+=85;
    assert.deepEqual(frame.data,original);assert.deepEqual(mask.data,originalMask);
  }
  const {frame,mask}=paperScene({paper:[77,64,72]});const bad=sampleCardPaper(frame,corners,mask);
  const result=updatePaperMatch(state,bad,t+1380);assert.deepEqual(result.color,bad.color);
});
