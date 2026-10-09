import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const source = process.env.ALTER_SOURCE || fileURLToPath(new URL('../../zz10/', import.meta.url));
const dataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
test('actual DOM loop hides failed mask rather than showing stale foreground geometry', async () => {
  const saved = new Map();
  function install(name, value) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {configurable:true, writable:true, value});
  }
  const elements = new Map();
  function el(id) {
    if (!elements.has(id)) {
      const classes = new Set(), listeners = new Map();
      elements.set(id, {hidden:true, value:'', textContent:'', options:[], clientWidth:192,clientHeight:256,
        style:{setProperty(name,value){this[name]=value;}},listeners,
        addEventListener:(name, fn)=>listeners.set(name,fn), querySelectorAll:()=>[],focus(){},
        classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),
          toggle(c,on){if(on)classes.add(c);else classes.delete(c);}}});
    }
    return elements.get(id);
  }
  let nextFrame, serial = 0;
  const ctx = {drawImage(){},getImageData(_x,_y,width,height){
    const data = new Uint8ClampedArray(width*height*4);data.fill(210);return {width,height,data};
  },createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};
  install('__heldoutDetection', null);
  install('__heldoutMaskMode', 'normal');
  install('__heldoutMaskCorners', []);
  install('document',{hidden:false,getElementById:el,addEventListener(){},createElement:()=>({getContext:()=>ctx,toDataURL:()=>`data:image/png;base64,mask${++serial}`})});
  install('window',{isSecureContext:true,addEventListener(){}});
  install('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}],getVideoTracks:()=>[{addEventListener(){}}]})}});
  install('localStorage',{getItem:()=>null,setItem(){}});
  install('sessionStorage',{setItem(){}});
  install('HTMLMediaElement',{HAVE_CURRENT_DATA:2});
  install('requestAnimationFrame',cb=>{nextFrame=cb;return 1;});
  install('cancelAnimationFrame',()=>{});
  install('setTimeout',()=>1);install('clearTimeout',()=>{});
  el('rank').value='7';el('suit').value='heart';el('brightness').value='100';
  Object.assign(el('camera'),{readyState:2,videoWidth:192,videoHeight:256,play:async()=>{}});
  const stub = dataUrl(`
    export { mapSourceOntoCorners } from ${JSON.stringify(pathToFileURL(`${source}/vision.js`).href)};
    export function detectCard(){return globalThis.__heldoutDetection;}
    export function detectCardAgainstBackground(){return globalThis.__heldoutDetection;}
    export function cardOcclusionMask(frame,corners){
      globalThis.__heldoutMaskCorners.push(corners.map(p=>({...p})));
      if(globalThis.__heldoutMaskMode==='null')return null;
      if(globalThis.__heldoutMaskMode==='throw')throw new Error('heldout mask failure');
      const data=new Uint8ClampedArray(12*16*4);data.fill(255);
      for(let i=0;i<16;i++)data[i*12*4+3]=0;
      return {width:12,height:16,data};
    }`);
  try {
    let code = await readFile(`${source}/app.js`,'utf8');
    code = code.replace(/from\s+["']\.\/([^"']+)["']/g, (_m,file)=>`from ${JSON.stringify(file==='vision.js'?stub:pathToFileURL(`${source}/${file}`).href)}`);
    await import(dataUrl(code));await el('start').listeners.get('click')();
    for(let t=100;t<=2100;t+=100)nextFrame(t);
    const corners=[{x:48,y:55},{x:120,y:55},{x:120,y:156},{x:48,y:156}];
    globalThis.__heldoutDetection={corners};nextFrame(2200);nextFrame(2300);
    assert.equal(el('card-overlay').hidden,false,'test precondition: valid mask shows card');
    const firstMask=el('card-overlay').style.maskImage;
    const moved=corners.map(p=>({x:p.x+1.7,y:p.y-2.3}));
    globalThis.__heldoutDetection={corners:moved};globalThis.__heldoutMaskMode='null';nextFrame(2400);
    assert.equal(el('card-overlay').hidden,true,'null mask must hide current overlay');
    assert.deepEqual(globalThis.__heldoutMaskCorners.at(-1),moved,'foreground mask uses raw quad');
    globalThis.__heldoutMaskMode='normal';nextFrame(2500);
    assert.equal(el('card-overlay').hidden,false,'normal current mask restores overlay');
    assert.notEqual(el('card-overlay').style.maskImage,firstMask,'fresh mask replaces old mask');
    globalThis.__heldoutMaskMode='throw';nextFrame(2600);
    assert.equal(el('card-overlay').hidden,true,'thrown mask failure hides overlay');
  } finally {
    for(const [name,descriptor] of saved) {
      if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
    }
  }
});
