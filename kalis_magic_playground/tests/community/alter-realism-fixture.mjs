// Generated independently before seeing the implementation's sampler tests.
export const corners = [{x:12,y:10},{x:82,y:10},{x:82,y:118},{x:12,y:118}];
export function paperScene({paper=[203,211,205],hand=false,patch=false,stripe=false}={}) {
  const width=96,height=128,data=new Uint8ClampedArray(width*height*4);
  const mask={width:70,height:108,data:new Uint8ClampedArray(70*108*4)};
  mask.data.fill(255);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    let rgb=[43,69,88];
    if(x>=12&&x<=82&&y>=10&&y<=118) {
      rgb=paper;
      if(patch&&(x<42||x>49||y<52||y>63))rgb=[25,28,24];
      if(stripe&&(x<43||x>50))rgb=[25,28,24];
      if(!patch&&!stripe&&y>35&&y<89&&x>25&&x<61)rgb=(x+y)%13<6?[19,21,23]:[175,22,37];
      if(hand&&x>=59)rgb=[232,164,133];
    }
    data.set([...rgb,255],(y*width+x)*4);
  }
  if(hand)for(let y=0;y<mask.height;y++)for(let x=47;x<mask.width;x++)mask.data[(y*mask.width+x)*4+3]=0;
  return {frame:{width,height,data},mask};
}
export const movingQuad=(x,y)=>corners.map(p=>({x:p.x+x,y:p.y+y}));
export const jitterSeries=Array.from({length:20},(_,i)=>({t:80*(i+1),corners:movingQuad(i%2?1.7:-1.7,i%3?2.3:-2.3)}));
