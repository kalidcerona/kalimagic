'use strict';
// Diagnostic uses the harness's actual page setup without starting its full run.
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'mobile-verify.cjs'),'utf8');
const diagnostic=String.raw`
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const evidence=[];
 try{
  for(const [tag,url] of [['current',base],['baseline',baseline]]){
   if(!url)continue;
   for(const movements of [[40,85,135,175],[175]]){
    const {context,page}=await fresh(browser,url,'zz8',390,844);
    try{
     await preparePerformance(page,'zz8');
     await page.evaluate(()=>{
      window.__gestureEvents=[];
      for(const type of ['pointerdown','pointermove','pointercancel','pointerup','touchstart','touchmove','touchcancel','touchend'])document.addEventListener(type,e=>{
       window.__gestureEvents.push({type,id:e.pointerId,y:e.clientY,cancelable:e.cancelable,defaultPrevented:e.defaultPrevented,target:e.target.id||e.target.tagName,settings:!document.querySelector('#settings-screen').hidden,touches:e.touches?.length});
      },{passive:true});
     });
     const cdp=await page.context().newCDPSession(page);
     const points=y=>[{id:1,x:136,y,radiusX:8,radiusY:8,force:1},{id:2,x:253,y,radiusX:8,radiusY:8,force:1}];
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(151)});
     await page.waitForTimeout(60);
     for(const d of movements){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(151+d)});await page.waitForTimeout(35);}
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await page.waitForTimeout(800);
     const state=await page.evaluate(()=>({opened:!document.querySelector('#settings-screen').hidden,events:window.__gestureEvents,scrollTop:document.scrollingElement.scrollTop}));
     state.tag=tag;state.movements=movements;state.screenshot=await shot(page,'zz8-'+tag+'-'+movements.join('-'));evidence.push(state);
    }finally{await context.close();}
   }
  }
  for(const [cls,width,height] of classes.filter(c=>['C','D','F'].includes(c[0]))){
   const {context,page}=await fresh(browser,base,'zz6',width,height);
   try{
    await preparePerformance(page,'zz6');await openSettings(page,'zz6');await expand(page,profiles.zz6.panel);
    const field=page.locator(profiles.zz6.panel+' input:visible:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not(:disabled)').first();
    await field.focus();await page.setViewportSize({width,height:Math.floor(height*.55)});await page.waitForTimeout(70);
    const nearest=await reachable(page,field);
    const occlusion=await field.evaluate(e=>{const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,occluder:t?.outerHTML.slice(0,400),height:innerHeight};});
    await field.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await page.waitForTimeout(70);
    const centered=await reachable(page,field);
    evidence.push({app:'zz6',class:cls,nearest,occlusion,centered,screenshot:await shot(page,'zz6-'+cls+'-centered-field')});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(evidence,null,2)+'\n');
 process.stdout.write(JSON.stringify(evidence.map(e=>e.app?{app:e.app,class:e.class,occlusion:e.occlusion,nearest:e.nearest,centered:e.centered}:{tag:e.tag,movements:e.movements,opened:e.opened,eventTypes:e.events.map(x=>x.type)}),null,2)+'\n');
})().catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1;});
`;
new Function('require','__dirname','process',source.slice(source.indexOf('\n')+1,source.lastIndexOf('(async()=>{'))+diagnostic)(require,__dirname,process);
