import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const source=process.env.ALTER_SOURCE||fileURLToPath(new URL('../../zz10/', import.meta.url));
const {detectCard}=await import(pathToFileURL(resolve(source,'vision.js')));
const {createBackgroundCalibrator,observeCalibration}=await import(pathToFileURL(resolve(source,'calibration.js')));
function frame(w,h,colorAt) {
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set([...colorAt(x,y),255],(y*w+x)*4);
  return {width:w,height:h,data};
}
const backgrounds={
  'three neutral wall panels':(x,y)=>{const c=x<76?42:x<122?128:218;return [c,c,c];},
  'static narrow furniture at left edge':(x,y)=>x<38&&y>80&&y<250?[165,133,94]:[40,44,48],
  'smooth room gradient':(x,y)=>{const c=Math.round(30+x*.63+y*.14);return [c,c,c];},
};
for(const [name,colorAt] of Object.entries(backgrounds))test(`empty static ${name} can calibrate`,()=>{
  const f=frame(256,352,colorAt);assert.equal(detectCard(f),null,'empty frame must not look like a card');
  const c=createBackgroundCalibrator();
  for(let t=0;t<=3000;t+=100)observeCalibration(c,f,t,false);
  assert.ok(c.reference,`${name}: static card-free scene never became ready`);
});
for(const [width,height,short,long] of [[140,192,45,81],[256,352,65,117]])test(`ungripped ${short}x${long} portrait silhouette retains original detection at ${width}x${height}`,()=>{
  const x0=Math.floor((width-short)/2),y0=Math.floor((height-long)/2);
  const f=frame(width,height,(x,y)=>x>=x0&&x<x0+short&&y>=y0&&y<y0+long?[236,236,230]:[20,24,28]);
  assert.ok(detectCard(f),'valid ungripped portrait within existing aspect/area limits must remain detectable');
});
test('ungripped small portrait beside static bright border furniture remains detectable',()=>{
  const f=frame(256,352,(x,y)=>x<93?[250,250,250]:(x>=95&&x<160&&y>=105&&y<222?[236,236,230]:[20,24,28]));
  const detected=detectCard(f);
  assert.ok(detected,'a separate border panel must not turn a nearby small card into a finger slab');
  assert.ok(detected.corners.every(p=>p.x>=89&&p.x<=164&&p.y>=101&&p.y<=226),JSON.stringify(detected.corners));
});
