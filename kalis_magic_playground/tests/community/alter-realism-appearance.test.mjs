import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {corners,paperScene,movingQuad,jitterSeries} from './alter-realism-fixture.mjs';
const source=process.env.ALTER_SOURCE || fileURLToPath(new URL('../../zz10/', import.meta.url));
if(!source)throw new Error('ALTER_SOURCE required for new helper tests');
const {createDisplaySmoother,smoothDisplayedCorners}=await import(pathToFileURL(`${source}/performance.js`));
const {createPaperMatch,sampleCardPaper,updatePaperMatch}=await import(pathToFileURL(`${source}/appearance.js`));
test('heldout two-axis stationary jitter is reduced without mutating raw geometry',()=>{
  let state=createDisplaySmoother();const displayed=[];
  const original=structuredClone(jitterSeries);
  for(const frame of jitterSeries){const result=smoothDisplayedCorners(state,frame.corners,frame.t);state=result.state;displayed.push(result.corners[0]);}
  const spread=points=>{
    const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cy=points.reduce((s,p)=>s+p.y,0)/points.length;
    return Math.sqrt(points.reduce((s,p)=>s+(p.x-cx)**2+(p.y-cy)**2,0)/points.length);
  };
  const raw=spread(jitterSeries.map(f=>f.corners[0])),filtered=spread(displayed);
  assert.ok(filtered<raw*.8,`display spread ${filtered} vs raw ${raw}`);
  assert.deepEqual(jitterSeries,original);
});
test('real motion, jumps, gaps, reset and absence do not drag displayed corners',()=>{
  let result=smoothDisplayedCorners(createDisplaySmoother(),corners,100);
  const moved=movingQuad(17,0);result=smoothDisplayedCorners(result.state,moved,180);
  assert.ok(Math.abs(result.corners[0].x-moved[0].x)<=4);
  const jumped=movingQuad(91,0);result=smoothDisplayedCorners(result.state,jumped,260);assert.deepEqual(result.corners,jumped);
  const distant=movingQuad(103,0);result=smoothDisplayedCorners(result.state,distant,1660);assert.deepEqual(result.corners,distant);
  const absent=smoothDisplayedCorners(result.state,null,1740);assert.equal(absent.corners,null);
  assert.deepEqual(smoothDisplayedCorners(absent.state,corners,1820).corners,corners);
  assert.deepEqual(smoothDisplayedCorners(createDisplaySmoother(),corners,1900).corners,corners);
});
test('current paper excludes masked hands and print; input buffers remain read only',()=>{
  const scene=paperScene({hand:true}),before=scene.frame.data.slice(),maskBefore=scene.mask.data.slice();
  const sample=sampleCardPaper(scene.frame,corners,scene.mask);
  assert.equal(sample.reliable,true);
  for(const [channel,value] of [['r',203],['g',211],['b',205]])assert.ok(Math.abs(sample.color[channel]-value)<=2,`${channel}: ${sample.color[channel]}`);
  assert.deepEqual(scene.frame.data,before);assert.deepEqual(scene.mask.data,maskBefore);
});
test('dark, saturated, insufficient and narrow coverage all use neutral fallback',()=>{
  const neutral=sampleCardPaper(null,corners,null).color;
  for(const options of [{paper:[61,66,60]},{paper:[215,108,40]},{patch:true},{stripe:true}]){
    const {frame,mask}=paperScene(options),sample=sampleCardPaper(frame,corners,mask);
    assert.equal(sample.reliable,false,JSON.stringify(options));assert.deepEqual(sample.color,neutral);
  }
});
test('unreliable paper on subsequent current frame uses neutral instead of retained tint',()=>{
  const scene=paperScene(),reliable=sampleCardPaper(scene.frame,corners,scene.mask);
  const first=updatePaperMatch(createPaperMatch(),reliable,100);
  const dark=paperScene({paper:[61,66,60]}),bad=sampleCardPaper(dark.frame,corners,dark.mask);
  const next=updatePaperMatch(first.state,bad,180);
  assert.deepEqual(next.color,bad.color);
});
