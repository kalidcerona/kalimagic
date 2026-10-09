import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as clock from '../../zz2/time-machine.js';
import * as logic from '../../zz2/logic.js';
const builds = ['zz2', 'distribution-snapshots/unlock'];
const html = build => readFileSync(new URL(`../../${build}/index.html`, import.meta.url), 'utf8');
const section = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end,text.indexOf(start)));
function fixture(build) {
  let now = new Date(2026,9,9,15,59,0,0).getTime(), serial=0;
  const jobs=new Map(), nodes=new Map(), events=new Map();
  const node=id=> {
    if (!nodes.has(id)) nodes.set(id,{hidden:false,textContent:'',style:{},events:new Map(),
      classList:{add(){},remove(){},toggle(){}},
      addEventListener(type,fn){const handlers=this.events.get(type)||[];handlers.push(fn);this.events.set(type,handlers);},
      setAttribute(key,value){this[key]=value;},height:800,captures:new Set(),getBoundingClientRect(){return {left:0,top:0,width:400,height:this.height};},
      setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);},
      getAnimations(){return [];},
      animate(frames,options){const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;}};return animation;}});
    return nodes.get(id);
  };
  const NativeDate=Date;
  class FakeDate extends NativeDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const ctx=vm.createContext({Date:FakeDate,Intl,navigator:{language:'ko-KR'},window:{innerHeight:800,addEventListener(t,fn){events.set(t,fn);}},
    document:{visibilityState:'visible',addEventListener(t,fn){events.set(t,fn);}},
    $:node,screen:'time-lock',settings:{timeDelay:0,performance:'time-machine'},
    timeFrame:null,timeMinutes:2,timeTriggeredAt:null,timeTriggeredWallAt:null,timeLastTap:null,timePointer:null,timeSuppressUntil:0,
    timeDigits:[],emergencyLastTap:null,performance:{now:()=>now},matchMedia:()=>({matches:false}),
    setTimeout(fn,ms){const id=++serial;jobs.set(id,{fn,at:now+ms});return id;},clearTimeout(id){jobs.delete(id);},
    requestAnimationFrame(fn){const id=++serial;jobs.set(id,{fn,at:now+16});return id;},cancelAnimationFrame(id){jobs.delete(id);},
    enterRewindFullscreen(){ctx.fullscreenRequested=true;},exitRewindFullscreen(){},
    enterRewindStatusCover(){ctx.statusCoverApplied=true;},
    ...clock,unlockTimer:null,UNLOCK_ANIMATION_MS:520,state:{unlocked:false},clearFeedback(){},renderAttempts(){},setHomePage(){},
    showScreen(next){ctx.screen=next;ctx.shown=next;}});
  const text=html(build);
  vm.runInContext(section(text,'    function renderTimeMachine()',"    // One geometry read"),ctx);
  return {ctx,node,jobs,events,text,advance(ms){now+=ms;for(const [id,job]of [...jobs])if(job.at<=now){jobs.delete(id);job.fn();}},now:()=>now};
}
for (const build of builds) {
  test(`${build}: original renderer rewinds 15:59 + 02 to 16:01, 16:00, 15:59 then live time`,()=>{
    const f=fixture(build);
    const render=()=>vm.runInContext('renderTimeMachine()',f.ctx);
    const value=()=>f.node('time-hour').textContent+':'+f.node('time-minute').textContent;
    render();assert.equal(value(),'16:01');
    f.ctx.timeTriggeredAt=f.now();f.ctx.timeTriggeredWallAt=f.now();
    f.advance(799);assert.equal(value(),'16:01');
    f.advance(1);render();assert.equal(value(),'16:00');
    f.advance(800);assert.equal(value(),'15:59');
    f.advance(800);assert.equal(value(),'15:59');
    f.advance(60000);assert.equal(value(),'16:00');
    assert.match(f.text,/import \{[^}]*timeMachineClock[^}]*\} from '\.\/time-machine\.js'/);
    assert.match(f.text,/toLocaleDateString\('ko-KR'/);
    assert.doesNotMatch(f.text,/clockFormat|lockClockParts|playRewindMotion/);
  });
  test(`${build}: real entry listeners preserve emergency double tap and hidden 2-digit flow`,()=>{
    const f=fixture(build);
    f.ctx.screen='input';f.ctx.timeTriggeredWallAt=1;
    vm.runInContext(section(f.text,"    $('emergency').addEventListener", "    backspaceKey.addEventListener"),f.ctx);
    const click=f.node('emergency').events.get('click')[0];click({});f.advance(100);click({});
    assert.equal(f.ctx.screen,'time-black');
    assert.equal(f.ctx.timeTriggeredWallAt,null);
    vm.runInContext(section(f.text,"    for (const id of ['time-black', 'time-lock'])", "    $('settings-form').addEventListener('input'"),f.ctx);
    for(const [x,y]of [[200,700],[200,100]]) {
      const e={isPrimary:true,pointerId:1,clientX:x,clientY:y};
      f.node('time-black').events.get('pointerdown')[0](e);f.advance(10);f.node('time-black').events.get('pointerup')[0](e);
    }
    assert.equal(f.ctx.screen,'time-lock');assert.equal(f.ctx.timeMinutes,2);
    vm.runInContext('renderTimeMachine()',f.ctx);
    assert.equal(f.node('time-minute').textContent,'01');
    assert.equal(f.ctx.statusCoverApplied,true);
    assert.equal(f.ctx.fullscreenRequested,true);
    const lock=f.node('time-lock');
    const tap={isPrimary:true,pointerId:1,clientX:200,clientY:200};
    lock.events.get('pointerdown')[0](tap);lock.events.get('pointerup')[0](tap);
    f.advance(100);lock.events.get('pointerdown')[0](tap);lock.events.get('pointerup')[0](tap);
    assert.notEqual(f.ctx.timeTriggeredAt,null);
    f.advance(800);assert.equal(f.node('time-minute').textContent,'00');
    f.advance(800);assert.equal(f.node('time-minute').textContent,'59');
  });
  test(`${build}: drag follows finger, fast release completes, cancel springs back, reduced motion settles immediately`,()=>{
    const f=fixture(build);
    vm.runInContext(section(f.text,'    // One geometry read',"    for (const id of ['time-black', 'time-lock'])"),f.ctx);
    const dispatch=(t,y)=>{for(const fn of f.node('time-lock').events.get(t)||[])fn({isPrimary:true,pointerId:1,clientY:y});};
    dispatch('pointerdown',600);f.advance(20);dispatch('pointermove',540);
    assert.equal(f.node('time-lock').style.transform,'translate3d(0,-60px,0)');
    f.advance(10);dispatch('pointerup',530);assert.equal(f.ctx.screen,'unlocked');
    f.advance(520);assert.equal(f.node('time-lock').hidden,true);assert.equal(f.node('unlocked-screen').hidden,false);
    f.ctx.screen='time-lock';f.node('time-lock').hidden=false;
    dispatch('pointerdown',600);f.advance(200);dispatch('pointermove',570);dispatch('pointercancel',570);
    f.advance(520);assert.equal(f.ctx.screen,'time-lock');assert.equal(f.node('unlocked-screen').hidden,true);
    assert.equal(f.node('time-lock').style.pointerEvents,'');
    f.ctx.matchMedia=()=>({matches:true});dispatch('pointerdown',600);f.advance(30);dispatch('pointermove',200);dispatch('pointerup',200);
    f.advance(0);assert.equal(f.node('time-lock').hidden,true);
  });
}
test('RELEASE entry and original settings shape retain distinct storage namespaces',()=>{
  for(const saved of [{},{performance:'pin'},{performance:'time-machine'}])
    assert.equal(logic.normalizeSettings(saved,false).performance,logic.normalizeSettings(saved,true).performance);
  assert.notEqual(logic.storageIdentityForPath('/zz2/').settingsKey,logic.storageIdentityForPath('/tools/release/').settingsKey);
  assert.notEqual(logic.storageIdentityForPath('/zz2/').imageDb,logic.storageIdentityForPath('/tools/release/').imageDb);
  assert.equal(Object.hasOwn(logic.normalizeSettings({clockFormat:'12'}),'clockFormat'),false);
});
test('status-bar covering policy matches in manifest, meta, safe-area CSS and entry JS',async()=>{
  const personal=html(builds[0]), distribution=html(builds[1]);
  for(const build of builds) {
    const manifest=JSON.parse(readFileSync(new URL(`../../${build}/manifest.webmanifest`,import.meta.url),'utf8'));
    assert.equal(manifest.display,'standalone');
    assert.equal(manifest.theme_color,'#000000');
    const text=html(build);
    assert.match(text,/viewport-fit=cover/);
    assert.match(text,/<meta name="apple-mobile-web-app-status-bar-style" content="default">/);
    assert.match(text,/<meta name="theme-color" content="#000000">/);
    assert.match(text,/#app \{ position: absolute; top: env\(safe-area-inset-top, 0px\)/);
    assert.match(text,/background: var\(--status-color\)/);
    assert.match(text,/if \(result.enter\) \{\s*enterRewindFullscreen\(\);\s*enterRewindStatusCover\(\);/);
    const properties=new Map(), metas=new Map();
    const document={documentElement:{style:{setProperty(k,v){properties.set(k,v);}}},querySelector(key){if(!metas.has(key))metas.set(key,{});return metas.get(key);}};
    const ctx=vm.createContext({document});
    vm.runInContext(section(text,'    function enterRewindStatusCover()',"    $('emergency').addEventListener"),ctx);
    vm.runInContext('enterRewindStatusCover()',ctx);
    assert.equal(properties.get('--status-color'),'#000000');
    assert.equal(metas.get('meta[name="theme-color"]').content,'#000000');
    assert.equal(metas.get('meta[name="apple-mobile-web-app-status-bar-style"]').content,'default');
    // The only fullscreen call is inside the rewind entry helper.
    const fullscreenCalls=text.match(/requestFullscreen|webkitRequestFullscreen/g)||[];
    assert.equal(fullscreenCalls.length,2);
    assert.equal(section(text,'    function enterRewindFullscreen()','    function exitRewindFullscreen()').match(/requestFullscreen|webkitRequestFullscreen/g).length,2);
  }
  assert.equal(section(personal,'    function enterRewindFullscreen()',"    backspaceKey.addEventListener"),section(distribution,'    function enterRewindFullscreen()',"    backspaceKey.addEventListener"));
});
test('PIN success uses shared transition with reduced motion and upward lock/home frames',()=>{
  for(const build of builds) {
    const f=fixture(build);
    assert.match(f.text,/settleUnlockMotion\(\$\('input-screen'\), 0, true\)/);
    vm.runInContext(section(f.text,'    // One geometry read',"    for (const id of ['time-black', 'time-lock'])"),f.ctx);
    f.ctx.screen='unlocked';
    vm.runInContext("settleUnlockMotion($('input-screen'),0,true)",f.ctx);
    assert.equal(vm.runInContext('unlockAnimations[0].frames[1].transform',f.ctx),'translate3d(0,-800px,0)');
    assert.equal(vm.runInContext('unlockAnimations[1].frames[0].transform',f.ctx),'translate3d(0,28px,0) scale(0.96)');
    f.advance(520);assert.equal(f.node('input-screen').hidden,true);
    f.ctx.matchMedia=()=>({matches:true});
    vm.runInContext("settleUnlockMotion($('input-screen'),0,true)",f.ctx);
    assert.equal(vm.runInContext('unlockAnimations[0].options.duration',f.ctx),0);
    f.advance(0);assert.equal(f.node('unlocked-screen').hidden,false);
  }
});
test('entry handlers, minute renderer and unlock compositor remain byte-identical across builds',()=>{
  for(const [start,end]of [['    function renderTimeMachine()',"    $('settings-form').addEventListener('input'"],["    $('emergency').addEventListener","    backspaceKey.addEventListener"]])
    assert.equal(section(html(builds[0]),start,end),section(html(builds[1]),start,end));
  assert.equal(readFileSync(new URL('../../zz2/time-machine.js',import.meta.url),'utf8'),readFileSync(new URL('../../distribution-snapshots/unlock/time-machine.js',import.meta.url),'utf8'));
  const animation=section(html(builds[0]),'    // One geometry read',"    for (const id of ['time-black', 'time-lock'])");
  assert.doesNotMatch(animation,/offsetWidth|offsetHeight|filter:|style\.(top|height|width|left)/);
  assert.equal(clock.unlockDragTarget(0,3,800),false);
  assert.equal(clock.unlockDragTarget(223,.1,800),false);
  assert.equal(clock.unlockDragTarget(224,0,800),true);
});

test('two-finger settings swipe follows visible screen coordinates in portrait and rotated viewports',()=>{
  for(const [width,height]of [[390,844],[844,390]]) {
    const start=[{id:1,x:width*.3,y:height*.1},{id:2,x:width*.6,y:height*.1}];
    const down=start.map(p=>({...p,y:p.y+110}));
    assert.equal(clock.isSettingsSwipe(start,down),true);
    assert.equal(clock.isSettingsSwipe(start,start.map(p=>({...p,y:p.y-110}))),false);
    assert.equal(clock.isSettingsSwipe(start,start.map(p=>({...p,x:p.x+110}))),false);
  }
  for(const build of builds)assert.match(html(build),/if \(settingsSwipe && event.touches.length === 2 && isSettingsSwipe\(settingsSwipe,/);
});

function motionFixture(build) {
  const f=fixture(build);
  Object.assign(f.ctx,{applyAppearance(){},cancelReveal(){},renderInput(){},refreshCroppedImages(){},
    populateForm(){},startRewindGuide(){},stopRewindGuide(){},STORAGE:{personal:true},originals:new Map(),
    swipe:null,homePage:'home1',settingsSwipe:null,tapCandidate:null,revealVisible:false,revealShownAt:null});
  vm.runInContext(section(f.text,'    function showScreen(', '\n    }\n')+'\n    }\n',f.ctx);
  vm.runInContext(section(f.text,'    // One geometry read',"    for (const id of ['time-black', 'time-lock'])"),f.ctx);
  vm.runInContext(section(f.text,'    function returnSwipe(',"    document.addEventListener('touchmove'"),f.ctx);
  vm.runInContext("showScreen('time-lock')",f.ctx);
  const pointer=(type,y=600,id=1)=>{
    const e={isPrimary:id===1,pointerId:id,clientY:y,clientX:200};
    if(type==='pointerdown')f.events.get(type)?.(e);
    for(const fn of f.node('time-lock').events.get(type)||[])fn(e);
  };
  const drag=()=>{pointer('pointerdown');f.advance(20);pointer('pointermove',300);};
  const complete=()=>{drag();pointer('pointerup',300);};
  const consistent=screen=>{
    assert.equal(f.ctx.screen,screen);
    assert.equal(f.node('time-lock').hidden,screen!=='time-lock');
    assert.equal(f.node('unlocked-screen').hidden,screen!=='unlocked');
    for(const id of ['input-screen','time-lock','unlocked-screen'])
      for(const key of ['transform','opacity','pointerEvents'])assert.equal(f.node(id).style[key],'',`${id}.${key}`);
    assert.equal(f.node('time-face').style.opacity,'');
    assert.equal(f.node('time-lock').captures.size,0);
    assert.equal(vm.runInContext('unlockAnimations.length',f.ctx),0);
  };
  const retry=()=>{vm.runInContext("showScreen('time-lock')",f.ctx);f.advance(801);complete();f.advance(520);assert.equal(f.node('time-lock').hidden,true);};
  return {...f,pointer,drag,complete,consistent,retry};
}
for(const build of builds) {
  test(`${build}: two-finger contact mid-completion settles layers and permits rewind again`,()=>{
    const f=motionFixture(build);f.complete();
    assert.equal(f.ctx.screen,'unlocked');assert.equal(f.node('time-lock').hidden,false);assert.equal(f.node('unlocked-screen').hidden,false);
    f.events.get('touchstart')({touches:[{identifier:1,clientX:100,clientY:100},{identifier:2,clientX:200,clientY:100}],preventDefault(){}});
    assert.notDeepEqual({screen:f.ctx.screen,lockHidden:f.node('time-lock').hidden,
      homeHidden:f.node('unlocked-screen').hidden,pendingAnimations:vm.runInContext('unlockAnimations.length',f.ctx),
      pendingJobs:f.jobs.size}, {screen:'unlocked',lockHidden:false,homeHidden:false,pendingAnimations:0,pendingJobs:0});
    f.consistent('unlocked');f.advance(520);f.consistent('unlocked');f.retry();
  });
  test(`${build}: two-finger contact during PIN completion hides the input lock`,()=>{
    const f=motionFixture(build);
    vm.runInContext("showScreen('unlocked',true)",f.ctx);
    assert.equal(f.node('input-screen').hidden,false);
    f.events.get('touchstart')({touches:[{identifier:1,clientX:100,clientY:100},{identifier:2,clientX:200,clientY:100}],preventDefault(){}});
    assert.equal(f.node('input-screen').hidden,true);f.consistent('unlocked');
    f.advance(520);f.consistent('unlocked');f.retry();
  });
  for(const phase of ['drag','completion'])for(const event of ['blur','visibilitychange','resize','orientationchange','pointerdown'])
    test(`${build}: real ${event} handler interrupts ${phase} consistently`,()=>{
      const f=motionFixture(build);phase==='drag'?f.drag():f.complete();
      if(event==='visibilitychange')f.ctx.document.visibilityState='hidden';
      if(event==='pointerdown')f.pointer('pointerdown',500,2);
      else {assert.equal(typeof f.events.get(event),'function');f.events.get(event)();}
      f.consistent(phase==='drag'?'time-lock':'unlocked');f.advance(520);f.consistent(phase==='drag'?'time-lock':'unlocked');f.retry();
    });
  test(`${build}: rotation during drag retains cached height until resize cancels it`,()=>{
    const f=motionFixture(build);f.drag();f.node('time-lock').height=400;f.ctx.window.innerHeight=400;
    f.pointer('pointermove',400);
    assert.equal(vm.runInContext('unlockDrag.height',f.ctx),800);
    assert.equal(f.node('unlocked-screen').style.transform,'translate3d(0,21px,0) scale(0.97)');
    f.events.get('resize')();f.consistent('time-lock');
    f.pointer('pointerdown');assert.equal(vm.runInContext('unlockDrag.height',f.ctx),400);
    f.pointer('pointermove',450);f.pointer('pointerup',450);f.advance(520);assert.equal(f.ctx.screen,'unlocked');
  });
}

for (const build of builds) {
  test(`${build}: rewind fullscreen handles supported, unsupported and already fullscreen devices`, async () => {
    const document = { documentElement: {} };
    const ctx = vm.createContext({ document });
    vm.runInContext(section(html(build), '    function enterRewindFullscreen()', '    function enterRewindStatusCover()'), ctx);
    assert.doesNotThrow(() => vm.runInContext('enterRewindFullscreen(); exitRewindFullscreen()', ctx));
    for (const [requestKey, elementKey, exitKey] of [
      ['requestFullscreen', 'fullscreenElement', 'exitFullscreen'],
      ['webkitRequestFullscreen', 'webkitFullscreenElement', 'webkitExitFullscreen']
    ]) {
      let enters = 0, exits = 0;
      document.documentElement[requestKey] = function (options) {
        assert.equal(this, document.documentElement);
        assert.equal(options.navigationUI, 'hide');
        enters++;
        document[elementKey] = this;
        return Promise.resolve();
      };
      document[exitKey] = function () {
        assert.equal(this, document);
        exits++;
        document[elementKey] = null;
        return Promise.resolve();
      };
      vm.runInContext('enterRewindFullscreen(); enterRewindFullscreen()', ctx);
      assert.equal(enters, 1);
      vm.runInContext('exitRewindFullscreen(); exitRewindFullscreen()', ctx);
      assert.equal(exits, 1);
      delete document.documentElement[requestKey];
      delete document[exitKey];
    }
    for (const fail of [() => { throw new Error('denied'); }, () => Promise.reject(new Error('denied'))]) {
      document.documentElement.requestFullscreen = fail;
      assert.doesNotThrow(() => vm.runInContext('enterRewindFullscreen()', ctx));
      document.fullscreenElement = document.documentElement;
      document.exitFullscreen = fail;
      assert.doesNotThrow(() => vm.runInContext('exitRewindFullscreen()', ctx));
      document.fullscreenElement = null;
      await new Promise(resolve => setImmediate(resolve));
    }
  });
  test(`${build}: showScreen exits fullscreen only outside rewind screens`, () => {
    const f = motionFixture(build);
    let exits = 0;
    f.ctx.document.documentElement = {};
    f.ctx.document.exitFullscreen = () => { exits++; f.ctx.document.fullscreenElement = null; };
    vm.runInContext(section(f.text, '    function enterRewindFullscreen()', '    function enterRewindStatusCover()'), f.ctx);
    f.ctx.document.fullscreenElement = f.ctx.document.documentElement;
    for (const next of ['time-black', 'time-lock']) {
      vm.runInContext(`showScreen('${next}')`, f.ctx);
      assert.equal(exits, 0);
    }
    for (const [index, next] of ['unlocked', 'settings', 'input'].entries()) {
      f.ctx.document.fullscreenElement = f.ctx.document.documentElement;
      vm.runInContext(`showScreen('${next}')`, f.ctx);
      assert.equal(exits, index + 1);
    }
  });
}

for (const build of builds) {
  test(`${build}: no desktop settings button, Shift+Esc handler or PC hint`, () => {
    const text = html(build);
    assert.doesNotMatch(text, /desktop-settings|bindDesktopSettingsAccess|desktopSettingsAccess|Shift\+Esc|Shift\+Escape|PC에서는|PC 설정/);
    assert.doesNotMatch(text, /event\.key !== 'Escape'|key === 'Escape'/);
  });
}
