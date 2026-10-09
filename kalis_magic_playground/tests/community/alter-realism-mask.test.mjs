import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {rotatedGeometry} from './alter-realism-mask-fixture.mjs';
const source=process.env.ALTER_SOURCE || fileURLToPath(new URL('../../zz10/', import.meta.url));if(!source)throw new Error('ALTER_SOURCE required');
const {remapOcclusionToDisplay}=await import(pathToFileURL(`${source}/appearance.js`));
const {computeHomography,applyHomography}=await import(pathToFileURL(`${source}/vision.js`));
test('new rotated heldout transparent hand pixels remain transparent in live frame coordinates',()=>{
  const {raw,displayed,mask}=rotatedGeometry(),before=mask.data.slice();
  const result=remapOcclusionToDisplay(mask,raw,displayed);assert.ok(result);
  const rect=[{x:0,y:0},{x:mask.width,y:0},{x:mask.width,y:mask.height},{x:0,y:mask.height}];
  const toLive=computeHomography(rect,raw),toDisplayed=computeHomography(displayed,[{x:0,y:0},{x:result.width,y:0},{x:result.width,y:result.height},{x:0,y:result.height}]);
  let tested=0;
  for(let y=4;y<mask.height-4;y+=3)for(let x=2;x<12;x++){
    if(mask.data[(y*mask.width+x)*4+3]!==0)continue;
    const live=applyHomography(toLive,x+.5,y+.5),uv=applyHomography(toDisplayed,live.x,live.y);
    const dx=Math.floor(uv.x),dy=Math.floor(uv.y);
    if(dx<0||dy<0||dx>=result.width||dy>=result.height)continue;
    assert.equal(result.data[(dy*result.width+dx)*4+3],0,`live finger ${live.x},${live.y} normalized ${uv.x},${uv.y}`);tested++;
  }
  assert.ok(tested>=80,`coverage ${tested}`);
  const middle=applyHomography(toLive,28,29),uv=applyHomography(toDisplayed,middle.x,middle.y);
  assert.equal(result.data[(Math.floor(uv.y)*result.width+Math.floor(uv.x))*4+3],255,'safe paper remains opaque');
  assert.deepEqual(mask.data,before);
});
