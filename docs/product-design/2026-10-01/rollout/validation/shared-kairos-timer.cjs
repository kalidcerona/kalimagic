'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'mobile-verify.cjs'),'utf8');
const checks=String.raw`
(async()=>{
 const browser=await chromium.launch({headless:true});const timer=[];
 try{
  for(const [mode,width,height] of [['portrait',390,844],['landscape',844,390]]){
   const item={route,mode,viewport:{width,height},failures:[]};timer.push(item);
   const {context,page}=await fresh(browser,base,'zz1',width,height);
   try{
    item.customization=await page.evaluate(()=>({off:document.body.dataset.magicCustomize==='off',visibleCards:[...document.querySelectorAll('.magic-customize-page')].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').length}));
    if(!item.customization.off)item.failures.push('공유 빌드 customization-off 속성 없음');
    if(mode==='landscape'){
     item.entry=await openSettings(page,'zz1');await page.locator('#mode-landscape').tap();await page.locator('#settings-close').tap();await page.waitForTimeout(800);
    }
    const control=page.locator(mode==='portrait'?'#p-control':'#l-control');
    const display=page.locator(mode==='portrait'?'#p-time-display':'#l-time-display');
    item.before={label:await control.innerText(),time:await display.innerText()};
    await control.tap();await page.waitForTimeout(320);item.running={label:await control.innerText(),time:await display.innerText()};
    const runningLabel=mode==='portrait'?'중단':'STOP';
    if(item.running.label!==runningLabel)item.failures.push('실제 시작 터치 후 실행 상태가 되지 않음');
    if(item.running.time===item.before.time)item.failures.push('실행 중 시간 표시가 진행되지 않음');
    if(mode==='portrait'){
     await page.locator('#p-lap').tap();item.lapRows=await page.locator('#p-lap-rows .lap-row').count();
     if(item.lapRows<1)item.failures.push('실제 랩 버튼으로 기록이 생기지 않음');
    }
    await control.tap();const stoppedTime=await display.innerText();await page.waitForTimeout(150);
    item.stopped={label:await control.innerText(),time:await display.innerText(),stable:stoppedTime===await display.innerText()};
    if(!item.stopped.stable||item.stopped.label!==(mode==='portrait'?'시작':'RESET'))item.failures.push('실제 중단 터치 후 정지 상태·시간 유지 실패');
    item.stoppedScreenshot=await shot(page,'shared-'+mode+'-timer-stopped');
    if(mode==='portrait')await page.locator('#p-lap').tap();else await control.tap();
    item.reset={label:await control.innerText(),time:await display.innerText()};
    if(item.reset.label!==(mode==='portrait'?'시작':'START')||item.reset.time!==item.before.time)item.failures.push('실제 재설정 터치 후 초기 값 복귀 실패');
    item.geometry=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    if(item.geometry.documentWidth>item.geometry.clientWidth+1)item.failures.push('공유 공연 화면 가로 넘침');
    item.resetScreenshot=await shot(page,'shared-'+mode+'-timer-reset');
   }catch(error){item.failures.push(String(error.message||error));item.failureScreenshot=await shot(page,'shared-'+mode+'-timer-failure').catch(()=>null);}
   finally{await context.close();}
  }
 }finally{await browser.close();}
 const failures=timer.flatMap(r=>r.failures.map(message=>({mode:r.mode,message}))).concat(runtimeErrors.map(r=>({kind:'runtime',...r})));
 const report={baseUrl:base,route,timerCases:timer.length,timer,failures,pngCount:fs.readdirSync(out).filter(f=>f.endsWith('.png')).length,limitations:['실제 dist의 HTTP 로컬 경로 검사이며 HTTPS 인증 실행 검사가 아님','네이티브 터치 에뮬레이션이며 물리 기기 검사 아님']};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 process.stdout.write(JSON.stringify({route,timerCases:timer.length,failures:failures.length,pngCount:report.pngCount})+'\n');process.exitCode=failures.length?1:0;
})().catch(error=>{process.stderr.write(String(error.stack||error)+'\n');process.exitCode=2;});
`;
new Function('require','__dirname','process',source.slice(source.indexOf('\n')+1,source.lastIndexOf('(async()=>{'))+checks)(require,__dirname,process);
