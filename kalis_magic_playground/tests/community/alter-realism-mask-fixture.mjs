// Newly held out after first-run cases became disclosed regression inputs.
export const cadence = [65,88,72,111,69,94,75,106,67,90,81,114,70,96,77,103,66,92,79,108];
const quad=[{x:34,y:26},{x:99,y:26},{x:99,y:121},{x:34,y:121}];
export const finalJitter=cadence.map((dt,i)=>({dt,corners:quad.map(p=>({x:p.x+(i%3===0?-1.9:i%3===1?1.6:.3),y:p.y+(i%2?-1.8:1.4)}))}));
export function rotatedGeometry(){
  const c=Math.cos(.19),s=Math.sin(.19);
  const raw=[[-40,-58],[40,-58],[40,58],[-40,58]].map(([x,y])=>({x:112+c*x-s*y,y:104+s*x+c*y}));
  const displayed=raw.map((p,i)=>({x:p.x-2.4+(i>1?.6:0),y:p.y+1.7+(i===1?.4:0)}));
  const mask={width:40,height:58,data:new Uint8ClampedArray(40*58*4)};mask.data.fill(255);
  for(let y=0;y<58;y++)for(let x=0;x<40;x++)if(x<9+(y%7<3?2:0))mask.data[(y*40+x)*4+3]=0;
  return {raw,displayed,mask};
}
export const paperValues=[[218,216,225],[183,194,192],[223,222,216]];
