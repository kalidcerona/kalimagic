#!/usr/bin/env node
'use strict';
// Read-only app validation. Writes are limited to the explicit --out directory.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { PNG } = require('/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const pixelmatch = require('/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pixelmatch').default;
const opts = {};
for (let i=2;i<process.argv.length;i++) {
  const key=process.argv[i];
  if (!/^--/.test(key) || !process.argv[i+1] || /^--/.test(process.argv[i+1])) throw new Error(`Missing value for ${key}`);
  opts[key.slice(2)]=process.argv[++i];
}
if (!opts.out || !opts['base-url']) throw new Error('Required: --base-url URL --out ABSOLUTE_PATH');
const boundary=path.resolve(__dirname);
const out=path.resolve(opts.out);
if (out!==boundary && !out.startsWith(boundary+path.sep)) throw new Error('--out must be inside rollout/validation');
fs.mkdirSync(out,{recursive:true});
if(!fs.realpathSync(out).startsWith(fs.realpathSync(boundary)+path.sep) && fs.realpathSync(out)!==fs.realpathSync(boundary))throw new Error('Output directory resolves outside validation boundary');
for(const name of fs.readdirSync(out))if(fs.lstatSync(path.join(out,name)).isSymbolicLink())throw new Error('Refusing output directory containing symlinks');
const base=opts['base-url'].replace(/\/$/,'');
const baseline=opts['baseline-url']?.replace(/\/$/,'');
const classes=[['A',320,740],['B',390,844],['C',480,960],['D',280,900],['E',768,900],['F',744,1133],['G',820,1180],['H',1280,1848]];
const profiles={
 zz1:{panel:'#settings-card',root:'#settings',cta:'#settings-close'},
 zz2:{panel:'[data-settings-root]',root:'#settings-screen',start:'#start',cta:'#start'},
 zz3:{panel:'#date-settings',root:'#date-settings'},
 zz4:{panel:'[data-settings-root]',root:'#settings',start:'#start-notes-show',cta:'#start-notes-show'},
 zz5:{panel:'[data-settings-root]',root:'#settings',start:'#card-start-button',cta:'#card-start-button'},
 zz6:{panel:'[data-settings-root]',root:'#settings',start:'#start-show',cta:'#start-show'},
 zz7:{panel:'#settings-screen [data-settings-root]',root:'#settings-screen',start:'#start-performance',cta:'#start-performance'},
 zz8:{panel:'[data-settings-root]',root:'#settings-screen',start:'#start-performance',cta:'#start-performance'},
 zz9:{panel:'#settings-screen .settings-panel',root:'#settings-screen',start:'#start-show',cta:'#start-show'},
 zz10:{panel:'[data-settings-root]',root:'#settings',cta:'#close-settings'},
 zz11:{panel:'[data-settings-root]',root:'#settings',cta:'#settings-close'},
 zz12:{panel:'#main',root:'#main'},
 zz13:{panel:'#form',root:'#settings',cta:'#form button[type="submit"]'}
};
const apps=opts.apps?opts.apps.split(','):Object.keys(profiles);
for(const app of apps) if(!profiles[app]) throw new Error(`Unknown app: ${app}`);
const results=[];const performanceResults=[];const runtimeErrors=[];const generated=[];
const seeds={
 'stopwatch-settings-entry-tutorial-v1':'1','stopwatch_uni_install_nudge_done':'1','stopwatch_ui_mode':'portrait',
 'unlock-settings-entry-tutorial-v1':'1','calculator-settings-entry-tutorial-v1:/zz3':'1',
 'magic-choice.settings-gesture-guide.v1':'done','aletheia.settings-gesture-guide.v1':'done',
 'tobira.settings-gesture-guide.v1':'done','asrai.prototype.settings-guide.v1':'1',
 'false-memory-photo.settings-guide.v1':'1','alter-settings-gesture-guide-v1':'seen','zz11-guide-seen-v2':'1'
};
function fail(item,message){item.failures.push(message);}
async function shot(page,name){const file=`${name}.png`;await page.screenshot({path:path.join(out,file),fullPage:false,animations:'disabled'});generated.push(file);return file;}
async function visible(page,sel){return page.locator(sel).first().isVisible().catch(()=>false);}
async function fresh(browser,url,app,width,height){
 const context=await browser.newContext({viewport:{width,height},screen:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'ko-KR',timezoneId:'Asia/Seoul',permissions:['camera'],serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(4000);
 await page.addInitScript(values=>{for(const [k,v] of Object.entries(values)){try{localStorage.setItem(k,v);}catch{}}},seeds);
 page.on('pageerror',error=>runtimeErrors.push({app,url,error:String(error)}));
 await page.goto(`${url}/${app}/`,{waitUntil:'load',timeout:20000});
 await page.waitForTimeout(250);
 // Dismiss only source-backed onboarding controls, using their real click handlers.
 for(const sel of ['#settings-entry-tutorial-dismiss','#settings-gesture-dismiss','#guide-close','#close-gesture-guide','.gesture-guide button']){
  if(await visible(page,sel))await page.locator(sel).first().click();
 }
 return {context,page};
}
function imageFixture(color){const png=new PNG({width:40,height:40});for(let i=0;i<png.data.length;i+=4){png.data[i]=color;png.data[i+1]=80;png.data[i+2]=180;png.data[i+3]=255;}return PNG.sync.write(png);}
async function preparePerformance(page,app){
 const p=profiles[app];
 if(app==='zz12')return {method:'initial-study-tab'};
 if(app==='zz9' && await visible(page,p.panel)){
  for(const [id,c] of [['wrong-file',40],['target-file',190]])await page.locator(`#${id}`).setInputFiles({name:`${id}.png`,mimeType:'image/png',buffer:imageFixture(c)});
  await page.waitForFunction(()=>!document.querySelector('#start-show').disabled,null,{timeout:5000});
 }
 if(app==='zz10'){
  if(await visible(page,'#start')){await page.locator('#start').click();await page.waitForTimeout(800);}
  return {method:'real-start-with-Chromium-fake-camera',syntheticCamera:true};
 }
 if(app==='zz13' && await visible(page,'dialog#settings'))await page.locator('#close').click();
 if(p.start && await visible(page,p.panel)){
  const button=page.locator(p.start);await button.scrollIntoViewIfNeeded();await button.click();await page.waitForTimeout(300);
 }
 if(await visible(page,p.panel))throw new Error('Performance preparation left settings visible; no settings gesture claim is possible');
 return {method:p.start?'real-start-button-or-initial-performance':'initial-performance'};
}
async function gesture(page,movements=[40,85,135,175]){
 const v=page.viewportSize(),cdp=await page.context().newCDPSession(page);
 const startY=Math.min(180,Math.floor(v.height*.18));
 const points=y=>[{id:1,x:Math.floor(v.width*.35),y,radiusX:8,radiusY:8,force:1},{id:2,x:Math.floor(v.width*.65),y,radiusX:8,radiusY:8,force:1}];
 try{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(startY)});
  await page.waitForTimeout(60);
  for(const d of movements){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(startY+d)});await page.waitForTimeout(35);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await cdp.detach();}
 await page.waitForTimeout(800);
}
async function openSettings(page,app){
 if(app==='zz12'){
  await page.locator('nav [data-tab="settings"]').click();await page.waitForTimeout(150);
  if(!(await page.locator('nav [data-tab="settings"]').evaluate(e=>e.classList.contains('active'))))throw new Error('Existing settings tab did not activate');
  if(await page.locator('#main [data-settings-root]').count())profiles.zz12.panel='#main [data-settings-root]';
  else if(await page.locator('#main .settings-page').count())profiles.zz12.panel='#main .settings-page';
  return {method:'existing-settings-tab',opened:true};
 }
 // ASRAI's unchanged pointer contract must receive its 96px threshold before
 // Chromium's default panning cancels pointers. Diagnostic proves the same
 // native fast swipe opens both baseline and current; no touch-action override.
 const movements=app==='zz8'?[175]:[40,85,135,175];
 await gesture(page,movements);
 const opened=await visible(page,profiles[app].panel);
 if(!opened)throw new Error('Native two-finger downward gesture did not open settings');
 return {method:'native-CDP-two-finger-down',opened:true,movementsPx:movements,waitAfterGestureMs:800};
}
async function expand(page,selector){
 const summaries=page.locator(`${selector} details > summary`);
 for(let i=0;i<await summaries.count();i++){
  const s=summaries.nth(i);
  if(await s.isVisible() && !(await s.evaluate(e=>e.parentElement.open)))await s.click();
 }
}
async function geometry(page,app){
 return page.evaluate(({panel})=>{
  const p=document.querySelector(panel);if(!p)return {missing:true};
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[hidden]');};
  const controls=[...p.querySelectorAll('button,input,select,textarea,summary,[role="button"]')].filter(e=>!e.disabled&&e.type!=='hidden'&&visible(e)).map(e=>{
   const label=(e.type==='checkbox'||e.type==='radio'||e.type==='file')&&(e.closest('label')||[...p.querySelectorAll('label')].find(l=>l.htmlFor===e.id));
   const target=label&&visible(label)?label:e;
   return {id:e.id,tag:e.tagName,type:e.type,text:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,70),box:rect(e),hit:rect(target),label:!!label};
  });
  // Hidden file inputs remain interactive through visible associated labels.
  for(const e of p.querySelectorAll('input[type="file"]')){
   if(e.disabled||visible(e))continue;
   const label=e.closest('label')||[...p.querySelectorAll('label')].find(l=>l.htmlFor===e.id);
   if(label&&visible(label))controls.push({id:e.id,tag:'INPUT',type:'file',text:label.innerText.trim().slice(0,70),hit:rect(label),label:true});
  }
  const identity=p.querySelector('.identity,.settings-identity,[data-settings-identity]');
  const copy=identity?.querySelector('.identity-copy,.settings-identity-copy');
  const mark=identity?.querySelector('svg.sig,svg,[data-settings-signature]')||p.querySelector('[data-settings-signature],svg.sig');
  return {panel:rect(p),panelScrollWidth:p.scrollWidth,panelClientWidth:p.clientWidth,documentWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,controls,identity:identity&&rect(identity),copy:copy&&rect(copy),mark:mark&&rect(mark),pcHelp:[...document.querySelectorAll('.desktop-settings-help,#desktop-settings,#desktop-settings-toggle,#setup.desktop')].filter(visible).map(e=>e.id||e.className),visibleText:document.body.innerText};
 },profiles[app]);
}
function checkGeometry(item,g,prefix=''){
 if(g.missing){fail(item,`${prefix}설정 루트 없음`);return;}
 if(g.documentWidth>g.clientWidth+1)fail(item,`${prefix}문서 가로 넘침 ${g.documentWidth}/${g.clientWidth}`);
 if(g.panel.width>561)fail(item,`${prefix}설정 콘텐츠 560px 초과: ${g.panel.width}`);
 if(g.panelScrollWidth>g.panelClientWidth+1)fail(item,`${prefix}설정 콘텐츠 가로 넘침`);
 for(const c of g.controls)if(c.hit.width<43.9||c.hit.height<43.9)fail(item,`${prefix}44px 미만 터치 영역: ${c.id||c.tag} ${c.hit.width.toFixed(1)}×${c.hit.height.toFixed(1)}`);
 if(!g.mark||g.mark.width<1||g.mark.height<1)fail(item,`${prefix}앱 정체성 기호 없음`);
 if(!g.identity||!g.copy)fail(item,`${prefix}정체성 기호·문구 정렬 근거 없음`);
 if(g.identity&&g.copy&&g.mark){
  if(g.mark.x<g.copy.right-1)fail(item,`${prefix}정체성 기호가 문구 오른쪽에 있지 않음`);
  if(Math.abs(g.mark.y+g.mark.height/2-g.copy.y-g.copy.height/2)>10)fail(item,`${prefix}정체성 기호·문구 중앙 차이 10px 초과`);
  if(g.mark.right>g.identity.right+1)fail(item,`${prefix}정체성 기호 경계 넘침`);
 }
 if(g.pcHelp.length||/PC에서는|Shift\s*\+\s*(?:Esc|Escape)/i.test(g.visibleText))fail(item,`${prefix}PC 설정 보조 UI/문구 노출`);
 delete g.visibleText;
}
async function scrollBottom(page,app){
 await page.evaluate(({root,panel})=>{
  const p=document.querySelector(panel),r=document.querySelector(root);
  for(const e of [p,r,document.scrollingElement])if(e)e.scrollTop=e.scrollHeight;
 },profiles[app]);
 await page.waitForTimeout(50);
}
async function scrollTop(page,app){await page.evaluate(({root,panel})=>{for(const e of [document.querySelector(panel),document.querySelector(root),document.scrollingElement])if(e)e.scrollTop=0;},profiles[app]);}
async function reachable(page,locator){
 await locator.scrollIntoViewIfNeeded();
 return locator.evaluate(e=>{const r=e.getBoundingClientRect();const x=Math.max(0,r.left)+Math.min(r.width,innerWidth-r.left)/2,y=Math.max(0,r.top)+Math.min(r.height,innerHeight-r.top)/2;const top=document.elementFromPoint(x,y);return {box:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},visible:r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1,unoccluded:!!top&&(e===top||e.contains(top)||top.contains(e))};});
}
async function ctaLocator(page,app){
 const p=profiles[app];
 if(p.cta && await visible(page,p.cta))return page.locator(p.cta).first();
 return page.locator(`${p.panel} button:visible:not(:disabled)`).last();
}
async function stress(page,app,item){
 const panel=profiles[app].panel;
 item.longKorean=await page.evaluate(sel=>{
  const p=document.querySelector(sel);const samples=[...p.querySelectorAll('h1,h2,h3,p,label,summary')].filter(e=>e.children.length===0).slice(0,10);
  const originals=samples.map(e=>e.textContent);
  samples.forEach(e=>e.textContent+=' 설정 설명과 이름이 매우 길어지는 경우에도 화면 안에서 읽고 조작할 수 있어야 합니다.'.repeat(8));
  const result={sampleCount:samples.length,documentWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,panelWidth:p.scrollWidth,panelClient:p.clientWidth};
  samples.forEach((e,i)=>e.textContent=originals[i]);return result;
 },panel);
 if(!item.longKorean.sampleCount)fail(item,'긴 한국어 텍스트 검사 대상 없음');
 if(item.longKorean.documentWidth>item.longKorean.clientWidth+1||item.longKorean.panelWidth>item.longKorean.panelClient+1)fail(item,'긴 한국어 텍스트 가로 넘침');
 const original=page.viewportSize();
 const field=page.locator(`${panel} input:visible:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not(:disabled),${panel} textarea:visible:not(:disabled),${panel} select:visible:not(:disabled)`).first();
 item.keyboard={synthetic:true,note:'운영체제 키보드/IME가 아닌 높이 축소와 수동 스크롤 검사',available:await field.count()>0};
 if(await field.count()){
  await field.focus();await page.setViewportSize({width:original.width,height:Math.max(260,Math.floor(original.height*.55))});
  await page.waitForTimeout(70);
  // Centering is an actual manual scroll and accounts for fixed bottom CTAs.
  // Keep the subsequent hit-test so an overlay still causes a failure.
  await field.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  await page.waitForTimeout(50);item.keyboard.field=await reachable(page,field);
  item.keyboard.fieldId=await field.getAttribute('id');
  item.keyboard.screenshotField=await shot(page,`${app}-${item.class}-keyboard-field-synthetic`);
  item.keyboard.focusKept=await field.evaluate(e=>document.activeElement===e);
  const cta=await ctaLocator(page,app);item.keyboard.cta=await reachable(page,cta);
  item.keyboard.screenshot=await shot(page,`${app}-${item.class}-keyboard-synthetic`);
  if(!item.keyboard.focusKept||!item.keyboard.field.visible||!item.keyboard.field.unoccluded)fail(item,'높이 축소 후 입력 필드 스크롤 도달 실패');
  if(!item.keyboard.cta.visible||!item.keyboard.cta.unoccluded)fail(item,'높이 축소 후 CTA 스크롤 도달 실패');
  await page.setViewportSize(original);
 }
}
async function safeAreaStress(page,app,item){
 const result={synthetic:true,insetsPx:{top:28,right:18,bottom:32,left:18},failures:[],note:'격리된 케이스 브라우저에서 실제 CSS env()를 대체한 합성 검사; 물리 기기 safe-area 확인 아님'};
 item.safeArea=result;
 try{
  result.substitution=await page.evaluate(values=>{
   const pattern=/env\(\s*safe-area-inset-(top|right|bottom|left)(?:\s*,\s*[^)]*)?\)/g;
   let substitutions=0;
   const replace=text=>text.replace(pattern,(_,side)=>{substitutions++;return values[side]+'px';});
   const sheets=[];const unreadable=[];
   // Duplicate the complete cascade in source order, changing only actual env()
   // values. This preserves later declarations and nested media/supports rules.
   for(const sheet of [...document.styleSheets]){
    if(sheet.disabled)continue;
    try{
     const text=[...sheet.cssRules].filter(r=>r.type!==3).map(r=>r.cssText).join('\n');
     const rewritten=replace(text);
     const style=document.createElement('style');style.dataset.validationSafeArea='true';
     style.textContent=sheet.media?.mediaText?`@media ${sheet.media.mediaText}{${rewritten}}`:rewritten;
     sheets.push(style);
    }catch(error){unreadable.push({href:sheet.href,error:String(error)});}
   }
   for(const style of sheets)document.head.append(style);
   const inline=[];
   for(const element of document.querySelectorAll('[style]')){
    const before=element.getAttribute('style');const after=replace(before);
    if(before!==after){inline.push({element,before});element.setAttribute('style',after);}
   }
   window.__validationSafeAreaRestore=()=>{
    for(const style of sheets)style.remove();
    for(const entry of inline)entry.element.setAttribute('style',entry.before);
    delete window.__validationSafeAreaRestore;
   };
   return {actualEnvSubstitutions:substitutions,copiedStylesheets:sheets.length,inlineDeclarations:inline.length,unreadable};
  },result.insetsPx);
  if(!result.substitution.actualEnvSubstitutions)result.failures.push('실제 safe-area env() 선언이 없어 합성 검사 불가');
  if(result.substitution.unreadable.length)result.failures.push('읽지 못한 스타일시트가 있어 safe-area 대체 범위 불완전');
  await page.waitForTimeout(70);await scrollTop(page,app);
  result.geometry=await geometry(page,app);
  const previousCount=item.failures.length;
  checkGeometry(item,result.geometry,'합성 safe-area: ');
  result.failures.push(...item.failures.splice(previousCount).map(message=>message.replace(/^합성 safe-area: /,'')));
  result.clipping=await page.evaluate(({panel})=>{
   const p=document.querySelector(panel),r=p.getBoundingClientRect();const clipped=[];
   if(r.left < -1 || r.right > innerWidth+1)clipped.push('card outside viewport horizontally');
   for(let parent=p.parentElement;parent;parent=parent.parentElement){
    const style=getComputedStyle(parent),box=parent.getBoundingClientRect();
    if(/^(hidden|clip|auto|scroll)$/.test(style.overflowX) && (r.left<box.left+parent.clientLeft-1 || r.right>box.left+parent.clientLeft+parent.clientWidth+1))clipped.push(`horizontal clipping ancestor ${parent.id||parent.tagName}`);
   }
   return {panel:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},clipped};
  },profiles[app]);
  if(result.clipping.clipped.length)result.failures.push('설정 카드 잘림: '+result.clipping.clipped.join(', '));
  result.screenshotTop=await shot(page,`${app}-${item.class}-safe-area-synthetic-top`);
  await scrollBottom(page,app);
  const cta=await ctaLocator(page,app);result.cta=await reachable(page,cta);
  if(!result.cta.visible||!result.cta.unoccluded)result.failures.push('CTA 스크롤 도달 또는 가림 검사 실패');
  result.screenshotBottom=await shot(page,`${app}-${item.class}-safe-area-synthetic-bottom`);
 }catch(error){result.failures.push(String(error.message||error));}
 finally{
  await page.evaluate(()=>window.__validationSafeAreaRestore?.());
  result.restored=await page.evaluate(()=>!document.querySelector('[data-validation-safe-area]')&&!window.__validationSafeAreaRestore);
  if(!result.restored)result.failures.push('합성 safe-area CSS 복원 실패');
  await scrollTop(page,app);
 }
 for(const message of result.failures)fail(item,`합성 safe-area: ${message}`);
}
async function capture(browser,app,descriptor){
 const [cls,width,height]=descriptor;const item={app,class:cls,viewport:{width,height},failures:[],screenshots:[]};results.push(item);
 let context,page;
 try{
  ({context,page}=await fresh(browser,base,app,width,height));
  item.performancePreparation=await preparePerformance(page,app);
  item.entry=await openSettings(page,app);
  await scrollTop(page,app);item.screenshots.push(await shot(page,`${app}-${cls}-settings-top`));
  await expand(page,profiles[app].panel);
  item.geometry=await geometry(page,app);checkGeometry(item,item.geometry);
  await scrollBottom(page,app);item.screenshots.push(await shot(page,`${app}-${cls}-settings-bottom`));
  const cta=await ctaLocator(page,app);item.cta={id:await cta.getAttribute('id'),text:await cta.innerText(),...await reachable(page,cta)};
  if(!item.cta.visible||!item.cta.unoccluded)fail(item,'설정 CTA 스크롤 도달 실패');
  await stress(page,app,item);
  await safeAreaStress(page,app,item);
  if(cls==='D'){
   item.fold={samePage:true,path:'cover → inner → cover',steps:[]};
   for(const [step,w,h] of [['cover-before',280,900],['inner',768,900],['cover-after',280,900]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(70);
    const g=await geometry(page,app);checkGeometry(item,g,`Fold ${step}: `);
    const open=app==='zz12'?await page.locator('nav [data-tab="settings"]').evaluate(e=>e.classList.contains('active')):await visible(page,profiles[app].panel);
    if(!open)fail(item,`Fold ${step}: 설정이 닫힘`);
    await scrollTop(page,app);item.fold.steps.push({step,open,geometry:g,screenshot:await shot(page,`${app}-D-fold-${step}`)});
   }
  }
 }catch(error){fail(item,String(error.message||error));if(page)item.failureScreenshot=await shot(page,`${app}-${cls}-failure`).catch(()=>null);}
 finally{if(context)await context.close();}
 return item;
}
async function performanceCapture(browser,app,url,tag){
 let context,page;
 try{
  ({context,page}=await fresh(browser,url,app,390,844));const preparation=await preparePerformance(page,app);
  const masks=page.locator('#p-time-display,#l-time-display,.lock-time,.lock-date,#clock,#date');
  const file=`${app}-B-performance-${tag}.png`;
  await page.screenshot({path:path.join(out,file),animations:'disabled',mask:await masks.all()});generated.push(file);
  return {file,preparation,maskSelectors:'#p-time-display,#l-time-display,.lock-time,.lock-date,#clock,#date'};
 }finally{if(context)await context.close();}
}
async function performanceCompare(browser,app){
 const item={app,failures:[],comparison:'보조 근거이며 공연 보존 단정은 별도 소스 검토 필요'};performanceResults.push(item);
 try{
  item.current=await performanceCapture(browser,app,base,'current');
  if(!baseline){item.baselineUnavailable=true;return;}
  item.baseline=await performanceCapture(browser,app,baseline,'baseline');
  const a=PNG.sync.read(fs.readFileSync(path.join(out,item.current.file))),b=PNG.sync.read(fs.readFileSync(path.join(out,item.baseline.file)));
  if(a.width!==b.width||a.height!==b.height)throw new Error('Performance screenshot dimensions differ');
  const diff=new PNG({width:a.width,height:a.height});item.changedPixels=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.1});item.totalPixels=a.width*a.height;
  item.pixelRatio=item.changedPixels/item.totalPixels;
  item.differenceFile=`${app}-B-performance-difference.png`;fs.writeFileSync(path.join(out,item.differenceFile),PNG.sync.write(diff));generated.push(item.differenceFile);
  item.dynamic=['zz2','zz3','zz10','zz13'].includes(app);
  item.judgement=item.changedPixels===0?'마스크 영역 외 동일 픽셀':'차이 있음: 시간·날짜·무작위·카메라·canvas 가능성 포함, 보존 위반 단정 불가';
 }catch(error){fail(item,String(error.message||error));}
}
function htmlEscape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function writeReports(){
 const failures=results.flatMap(r=>r.failures.map(message=>({app:r.app,class:r.class,message}))).concat(performanceResults.flatMap(r=>r.failures.map(message=>({app:r.app,kind:'performance',message}))),runtimeErrors.map(e=>({app:e.app,kind:'runtime',message:e.error,url:e.url})));
 const actualPngFiles=fs.readdirSync(out).filter(f=>f.endsWith('.png')).sort();
 const report={createdAt:new Date().toISOString(),baseUrl:base,baselineUrl:baseline||null,apps,classes,plannedSettingsCases:apps.length*classes.length,executedSettingsCases:results.length,failedSettingsCases:results.filter(r=>r.failures.length).length,failures,runtimeErrors,performanceResults,results,pngCount:actualPngFiles.length,generatedPngCount:generated.length,pngFiles:actualPngFiles,limitations:['Chromium 터치 에뮬레이션이며 실기 확인 아님','높이 축소는 합성 검사이며 OS IME 아님','safe-area는 실제 env() 대체 합성 검사이며 물리 기기 확인 아님','공연 픽셀 차이는 소스 보존 검토를 대체하지 않음']};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const tabs=classes.map(([c,w,h])=>`<button data-class="${c}">${c} ${w}×${h}</button>`).join('');
 const rows=results.map(r=>`<section class="case" data-class="${r.class}"><h2>${r.app} · ${r.class} · ${r.failures.length?'실패':'통과'}</h2><p>${r.failures.map(htmlEscape).join('<br>')}</p><div class="shots">${[...r.screenshots,r.failureScreenshot,r.keyboard?.screenshotField,r.keyboard?.screenshot,r.safeArea?.screenshotTop,r.safeArea?.screenshotBottom,...(r.fold?.steps||[]).map(s=>s.screenshot)].filter(Boolean).map(s=>`<figure><a href="${s}"><img loading="lazy" src="${s}"></a><figcaption>${s}</figcaption></figure>`).join('')}</div></section>`).join('');
 fs.writeFileSync(path.join(out,'gallery.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>13개 앱 모바일 설정 검증</title><style>body{margin:20px;background:#15191b;color:#eee;font:15px system-ui}nav{position:sticky;top:0;background:#15191b;padding:12px;display:flex;gap:8px;flex-wrap:wrap}button{min-height:44px}.shots{display:flex;gap:16px;overflow:auto}figure{margin:0}img{width:260px;max-height:850px;object-fit:contain;object-position:top}.gray img{filter:grayscale(1)}.case[hidden]{display:none}</style><h1>모바일 설정 검증</h1><p>실행 ${results.length}/${report.plannedSettingsCases}건 · 실패 ${failures.length}항목 · 실제 PNG ${report.pngCount}개. 실기·OS 키보드·물리 안전 영역 확인은 포함하지 않습니다. safe-area는 합성 검사입니다.</p><nav>${tabs}<button id="all">모두 보기</button><button id="gray">흑백 전환</button></nav>${rows}<script>document.querySelectorAll('[data-class]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>document.querySelectorAll('.case').forEach(e=>e.hidden=e.dataset.class!==b.dataset.class)});document.querySelector('#all').onclick=()=>document.querySelectorAll('.case').forEach(e=>e.hidden=false);document.querySelector('#gray').onclick=()=>document.body.classList.toggle('gray');</script></html>`);
 fs.writeFileSync(path.join(out,'SUMMARY.md'),`# 모바일 설정 검증\n\n- 실행: ${results.length}/${report.plannedSettingsCases}건\n- 설정 실패: ${report.failedSettingsCases}건\n- 전체 실패 항목: ${failures.length}개(공연·실행 오류 포함)\n- 실제 PNG: ${report.pngCount}개, 이번 실행 생성: ${generated.length}개\n- 실기, 운영체제 키보드/IME, 물리 안전 영역은 확인하지 않았습니다. 실제 env()를 대체한 합성 safe-area 검사를 별도 기록했습니다.\n\n세부 근거: report.json, gallery.html.\n`);
 process.stdout.write(JSON.stringify({settingsCases:results.length,failedSettingsCases:report.failedSettingsCases,failures:failures.length,pngCount:report.pngCount,report:path.join(out,'report.json')})+'\n');
 return failures.length;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{for(const app of apps){for(const descriptor of classes)await capture(browser,app,descriptor);await performanceCompare(browser,app);}}
 finally{await browser.close();}
 process.exitCode=writeReports()?1:0;
})().catch(error=>{runtimeErrors.push({app:'harness',error:String(error)});writeReports();process.exitCode=2;});
