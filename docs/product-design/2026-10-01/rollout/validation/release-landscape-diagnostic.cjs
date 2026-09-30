'use strict';
// Reuse the unchanged harness entry and assertions in dedicated fresh contexts.
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'mobile-verify.cjs'),'utf8');
const diagnostic=String.raw`
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const release=[];const landscapePerformance=[];
 try{
  for(const [tag,url] of [['current',base],['baseline',baseline]]){
   if(!url)continue;
   for(let trial=1;trial<=8;trial++){
    const item={tag,trial,width:768,height:900,failures:[]};release.push(item);
    const {context,page}=await fresh(browser,url,'zz2',768,900);
    try{
     await preparePerformance(page,'zz2');
     item.before=await page.evaluate(()=>({ready:document.querySelector('#prompt').textContent,visibleScreens:[...document.querySelectorAll('.screen')].filter(e=>!e.hidden).map(e=>({id:e.id,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),settingsHidden:document.querySelector('#settings-screen').hidden}));
     await page.evaluate(()=>{
      window.__releaseInput=[];
      for(const type of ['pointerdown','pointercancel','touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>window.__releaseInput.push({type,t:performance.now(),cancelable:e.cancelable,defaultPrevented:e.defaultPrevented,touches:e.touches?[...e.touches].map(t=>({id:t.identifier,x:t.clientX,y:t.clientY})):null,settingsHidden:document.querySelector('#settings-screen').hidden}),{passive:true});
     });
     try{item.entry=await openSettings(page,'zz2');}catch(error){item.failures.push(String(error.message||error));}
     item.after=await page.evaluate(()=>({settingsHidden:document.querySelector('#settings-screen').hidden,events:window.__releaseInput,visibleScreens:[...document.querySelectorAll('.screen')].filter(e=>!e.hidden).map(e=>e.id)}));
     item.screenshot=await shot(page,'release-E-'+tag+'-'+trial);
    }finally{await context.close();}
   }
  }
  for(const app of ['zz7','zz11','zz12','zz13'])for(const descriptor of [['L1',844,390],['L2',1180,820]]){
   const [cls,width,height]=descriptor;
   const item={app,class:cls,viewport:{width,height},failures:[]};landscapePerformance.push(item);
   const {context,page}=await fresh(browser,base,app,width,height);
   try{
    item.preparation=await preparePerformance(page,app);
    item.geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    if(item.geometry.documentWidth>item.geometry.clientWidth+1)item.failures.push('공연·학습 가로 넘침');
    item.initialScreenshot=await shot(page,app+'-'+cls+'-landscape-performance');
    if(app==='zz12'){
     const before=await page.locator('#flip').innerText();await page.locator('#next').click();
     const after=await page.locator('#flip').innerText();item.action={name:'실제 다음 카드 버튼',before,after};
     if(before===after)item.failures.push('다음 카드 버튼으로 학습 카드가 바뀌지 않음');
    }
    if(app==='zz13'){
     await page.locator('#generate').click();await page.waitForTimeout(100);
     item.action=await page.evaluate(()=>{const canvas=document.querySelector('#qr'),ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const decoded=typeof jsQR==='function'?jsQR(pixels.data,pixels.width,pixels.height):null;return {name:'실제 QR 생성 버튼과 픽셀 판독',width:canvas.width,height:canvas.height,decoded:decoded?.data||null,notice:document.querySelector('#notice').textContent};});
     if(!item.action.decoded)item.failures.push('생성된 QR 캔버스를 jsQR로 판독하지 못함');
    }
    if(app==='zz11'){
     const wheel=page.locator('#wheel-wrap'),box=await wheel.boundingBox();
     if(!box)throw new Error('회전판 없음');
     await page.touchscreen.tap(box.x+box.width*.7,box.y+box.height*.5);
     await page.waitForTimeout(80);
     await page.touchscreen.tap(box.x+box.width*.7,box.y+box.height*.5);
     await page.waitForFunction(()=>Number(JSON.parse(localStorage.getItem('zz11-spinner-state-v2')||'{}').spins)>=1,null,{timeout:3000});
     item.action=await page.evaluate(()=>({name:'실제 목표 지정과 회전 입력',state:JSON.parse(localStorage.getItem('zz11-spinner-state-v2')||'{}')}));
    }
    if(app==='zz7'){
     const button=page.locator('#detector-button');await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();
     if(!box)throw new Error('검사 버튼 없음');
     const cdp=await page.context().newCDPSession(page);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:box.x+box.width/2,y:box.y+box.height/2,radiusX:8,radiusY:8,force:1}]});
     await page.waitForTimeout(120);
     const testing=await page.locator('#test-indicator').innerText();
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await page.waitForTimeout(80);
     const after=await page.locator('#test-indicator').innerText();item.action={name:'실제 짧은 홀드와 취소',testing,after};
     if(testing!=='검사 중'||after!=='취소됨')item.failures.push('짧은 홀드/취소 상태가 기대값과 다름');
    }
    item.actionScreenshot=await shot(page,app+'-'+cls+'-landscape-action');
   }catch(error){item.failures.push(String(error.message||error));item.failureScreenshot=await shot(page,app+'-'+cls+'-landscape-performance-failure').catch(()=>null);}
   finally{await context.close();}
   await capture(browser,app,descriptor);
  }
 }finally{await browser.close();}
 const failures=[...release.flatMap(r=>r.failures.map(message=>({kind:'release',tag:r.tag,trial:r.trial,message}))),...results.flatMap(r=>r.failures.map(message=>({kind:'landscape-settings',app:r.app,class:r.class,message}))),...landscapePerformance.flatMap(r=>r.failures.map(message=>({kind:'landscape-performance',app:r.app,class:r.class,message}))),...runtimeErrors.map(e=>({kind:'runtime',...e}))];
 const report={releaseTrialCount:release.length,releaseFailures:release.filter(r=>r.failures.length).length,release,landscapeExpectedCases:8,landscapeSettingsCases:results.length,landscapePerformanceCases:landscapePerformance.length,landscapeSettings:results,landscapePerformance,failures,runtimeErrors,pngCount:fs.readdirSync(out).filter(f=>f.endsWith('.png')).length,limitations:['Chromium 터치 에뮬레이션이며 실기 아님','QR 판독은 내장 jsQR이고 실제 카메라 아님','반복 성공이 기존 104건 중 실패 기록을 지우지 않음']};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const images=fs.readdirSync(out).filter(f=>f.endsWith('.png')).map(f=>'<figure><a href="'+f+'"><img loading="lazy" src="'+f+'"></a><figcaption>'+f+'</figcaption></figure>').join('');
 fs.writeFileSync(path.join(out,'gallery.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><title>RELEASE 반복과 가로 화면 근거</title><style>body{background:#191919;color:#eee;font:16px system-ui}.grid{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0}img{width:320px;max-height:650px;object-fit:contain}</style><h1>RELEASE 반복과 가로 화면 근거</h1><p>상세 수치와 한계는 report.json에 기록했습니다.</p><div class="grid">'+images+'</div></html>');
 process.stdout.write(JSON.stringify({releaseTrials:report.releaseTrialCount,releaseFailures:report.releaseFailures,landscapeSettingsCases:report.landscapeSettingsCases,landscapePerformanceCases:report.landscapePerformanceCases,failures:failures.length,pngCount:report.pngCount})+'\n');
 process.exitCode=failures.length?1:0;
})().catch(error=>{process.stderr.write(String(error.stack||error)+'\n');process.exitCode=2;});
`;
new Function('require','__dirname','process',source.slice(source.indexOf('\n')+1,source.lastIndexOf('(async()=>{'))+diagnostic)(require,__dirname,process);
