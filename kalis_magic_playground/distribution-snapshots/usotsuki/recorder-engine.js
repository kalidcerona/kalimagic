import { createContinuousTrace } from "./recorder-trace.js";

export function mountRecorder(root, config) {
'use strict';
let suspended = false;
const TIMING = Object.freeze({silence:420,soundDelay:60,strikeCycle:110,impactAt:46,dwellEnd:70,escapementDelay:8,escapementDur:36,advance:86,settle:0,lampAttack:80,lampRelease:360,keyDownMs:70,keyDownPx:3.5,keyUpMs:100,penLiftPx:2,penLiftMs:40,cancelDemoMs:900,platenSquashLie:.972,platenSquashTruth:.988,squashMs:30,restAngle:80,impactAngle:54,feedDur:240,ampMax:58,writeY:304,traceNeutralX:118,traceXMin:60,traceXMax:176,typebarLength:204,penArmLength:204,penPivotX:118,penRestPivotY:100});
const log=[];
function record(type,data={}){log.push({t:performance.now(),type,testIndex:activeIndex,...data});if(log.length>512)log.splice(0,log.length-512);}
const $=id=>root.getElementById(id),kind=config.skin,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Synthetic audio uses the same committed-ink / glyph events as motion.
const RecorderSound=(()=>{
 const busDefaults=Object.freeze({heartbeat:1,mechanical:1,typebar:1,verdict:1});
 const busGains={...busDefaults};
 const accentDelay=.030,accentPeak=.525;
 const accentDefaults=Object.freeze({truth:Object.freeze({first:587,second:880,duration:.420,lowpass:5000}),lie:Object.freeze({first:622,second:415,detune:418.5,duration:.440,lowpass:2200})});
 let context=null,chain=null,master=null,enabled=true,volume=.48,skin=config?.skin||'a';
 function createChain(ctx,level){
  const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor(),buses={};
  master.gain.value=level;
  limiter.threshold.value=-4;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.08;
  master.connect(limiter);limiter.connect(ctx.destination);
  for(const name of Object.keys(busDefaults)){const bus=ctx.createGain();bus.gain.value=busGains[name];bus.connect(master);buses[name]=bus;}
  return {ctx,master,limiter,buses};
 }
 function unlock(){
  if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context=new Audio();chain=createChain(context,enabled?volume:0);master=chain.master;}
  if(context.state==='suspended')context.resume().catch(()=>{});
 }
 function close(){setEnabled(false); const ctx=context; context=chain=master=null; if(ctx)ctx.close().catch(()=>{});}
 function setEnabled(value){enabled=!!value;if(master)master.gain.setValueAtTime(enabled?volume:0,context.currentTime);}
 function setVolume(value){const n=Number(value);if(Number.isFinite(n))volume=clamp(n,0,1);if(master)master.gain.setValueAtTime(enabled?volume:0,context.currentTime);}
 function setBusGain(name,value){const n=Number(value);if(!Object.hasOwn(busDefaults,name)||!Number.isFinite(n))return;busGains[name]=Math.max(0,n);if(chain)chain.buses[name].gain.setValueAtTime(busGains[name],context.currentTime);}
 function setSkin(value){if(value==='a'||value==='d')skin=value;}
 function soundRecord(type,data){if(kind==='a'||kind==='d')record(type,data);else log.push({t:performance.now(),type,testIndex:0,...data});}
 function event(type,data={}){if(!enabled||!context||context.state!=='running')return null;const at=context.currentTime;soundRecord(type,{audioTime:at,scheduledPerf:(performance.now()-context.currentTime*1000)+at*1000,...data});return at;}
 function renderTone(target,at,frequency,wave,gain,duration,attack=.004,bus='heartbeat'){
  const ctx=target.ctx,osc=ctx.createOscillator(),envelope=ctx.createGain();osc.type=wave;osc.frequency.value=frequency;envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(gain,at+attack);envelope.gain.exponentialRampToValueAtTime(.00001,at+duration);envelope.gain.setValueAtTime(0,at+duration+.001);osc.connect(envelope);envelope.connect(target.buses[bus]);osc.start(at);osc.stop(at+duration+.002);
 }
 function tone(...args){renderTone(chain,...args);}
 function renderNoise(target,at,filterType,frequency,gain,duration,seed,Q=1,bus='mechanical'){
  const ctx=target.ctx,rng=mulberry32(seed),buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=rng()*2-1;const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain();source.buffer=buffer;filter.type=filterType;filter.frequency.value=frequency;filter.Q.value=Q;const boost=Math.ceil(Math.max(1,gain));envelope.gain.setValueAtTime(gain/boost,at);envelope.gain.exponentialRampToValueAtTime(.00001/boost,at+duration);source.connect(filter);filter.connect(envelope);if(boost>1){const output=ctx.createGain();output.gain.value=boost;envelope.connect(output);output.connect(target.buses[bus]);}else envelope.connect(target.buses[bus]);source.start(at);source.stop(at+duration);
 }
 function noise(...args){renderNoise(chain,...args);}
 function beep(apex){if(apex.side!=='right')return;const at=event('beepScheduled',{cycle:apex.cycle,amplitude:apex.amplitude});if(at===null)return;tone(at,700+mulberry32(seedUsed+apex.cycle)()*60,'sine',.969,.09);tone(at,1440,'sine',.0513,.075);}
 function tick(){const at=event('tickScheduled');if(at!==null)noise(at,'bandpass',1800,1.05,.012,seedUsed+Math.round(tickDistance));}
 function renderClack(target,at,index,seed){const rng=mulberry32(seed+index*997),f=2600+rng()*600,scale=.27/.22*12.5;renderNoise(target,at,'highpass',1500,.13*scale,.018,seed+index,1,'typebar');renderNoise(target,at,'bandpass',f,.05*scale,.06,seed+index+71,9,'typebar');renderTone(target,at,140+(index?rng()*8:0),'triangle',.04*scale,.025,.001,'typebar');}
 function clack(index,seed){const at=event('clackScheduled',{index});if(at!==null)renderClack(chain,at,index,seed);}
 // Both skins intentionally use this same recipe. Only the verdict changes it.
 function renderAccent(target,at,verdict){
  const ctx=target.ctx,spec=accentDefaults[verdict],output=ctx.createGain();output.gain.value=accentPeak;output.connect(target.buses.verdict);
  function bell(start,frequencies,duration,cutoff){
   const filter=ctx.createBiquadFilter(),envelope=ctx.createGain();filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.5;filter.connect(envelope);envelope.connect(output);
   envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(1,start+.004);envelope.gain.exponentialRampToValueAtTime(.00001,start+duration-.001);envelope.gain.setValueAtTime(0,start+duration);
   for(const frequency of frequencies)for(const [ratio,level]of [[1,1],[2,.18],[2.76,.08]]){const osc=ctx.createOscillator(),partial=ctx.createGain();osc.type='sine';osc.frequency.value=frequency*ratio;partial.gain.value=level/(1.26*frequencies.length);osc.connect(partial);partial.connect(filter);osc.start(start);osc.stop(start+duration);}
  }
  bell(at,[spec.first],.110,5000);
  bell(at+.095,spec.detune?[spec.second,spec.detune]:[spec.second],spec.duration-.095,spec.lowpass);
 }
 function verdictAccent(verdict,secondGlyphImpact=performance.now()){
  if(!Object.hasOwn(accentDefaults,verdict)||!enabled||!context||context.state!=='running')return;
  const now=performance.now(),at=context.currentTime+Math.max(0,(secondGlyphImpact+accentDelay*1000-now)/1000);
  renderAccent(chain,at,verdict);
  soundRecord('verdictAccentScheduled',{audioTime:at,scheduledPerf:now+(at-context.currentTime)*1000,verdict,secondGlyphImpact,secondGlyphImpactTime:secondGlyphImpact});
 }
 function renderKind(target,kind,at=0){
  if(kind==='truth'||kind==='lie')renderAccent(target,at,kind);
  if(kind==='beep'||kind==='worst'){renderTone(target,at,700+mulberry32(0)()*60,'sine',.969,.09);renderTone(target,at,1440,'sine',.0513,.075);}
  if(kind==='tick')renderNoise(target,at,'bandpass',1800,1.05,.012,0);
  if(kind==='clack'||kind==='worst')renderClack(target,at,0,0);
  if(kind==='worst')renderAccent(target,at,'truth');
 }
 async function play(kind){if(!['truth','lie','clack','beep','tick'].includes(kind))return;unlock();if(context?.state==='suspended')await context.resume();if(!enabled||context?.state!=='running')return;renderKind(chain,kind,context.currentTime);}
 async function measurePeak(kind,masterVolume){
  if(!['truth','lie','clack','beep','tick','worst'].includes(kind))throw new RangeError('Unknown sound kind');
  const level=Number(masterVolume);if(!Number.isFinite(level))throw new RangeError('Invalid master volume');
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw new Error('OfflineAudioContext unavailable');
  const offline=new Offline(1,48000,48000),target=createChain(offline,clamp(level,0,1));renderKind(target,kind);
  const buffer=await offline.startRendering(),samples=buffer.getChannelData(0);let peak=0,sum=0;for(const sample of samples){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}return {peak,rms:Math.sqrt(sum/samples.length)};
 }
 return {close,unlock,setEnabled,setVolume,setBusGain,setSkin,beep,tick,clack,verdictAccent,play,measurePeak,busDefaults,accentDefaults,get busGains(){return {...busGains};},get skin(){return skin;},get context(){return context;},get enabled(){return enabled;},get volume(){return volume;}};
})();

// The comparison page loads only the shared sound engine.
if(kind!=='a'&&kind!=='d')return;
const paper=$('paper'),chart=$('traceChart'),glyphs=$('glyphs'),key=$('contactKey'),lamp=$('contactLamp'),bar=$('typebar'),pen=$('penNib'),platen=$('platen');
const reducedQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced=()=>!!reducedQuery?.matches;

let scanDurationMs=2500,armedVerdict='lie',runIndex=0,activeIndex=0,start=0,mode='idle',pressed=false,held=false,measurementOnly=false,Tms=2500,paperShift=0,shiftAtStart=0,feeding=false,feedMs=0,measurementStart=0,penX=118,penY=304,lastSample=0,lastD=0,ink='',runInk='',trace=null,points=[],responses=[],wander=[],raf=0,jobs=[],struck=[false,false],impactTimes=[],glyphPositions=[],stopTime=null,lampOff=null,keyY=0,keyFrom=0,keyTo=0,keyAt=0,keyDur=0,lampLevel=0,lampFrom=0,lampTo=0,lampAt=0,lampDur=0,escape=0,seedUsed=0,maxLeft=0,maxRight=0,traceSamples=[],plannedSamples=[]; 
// Keep the fiber pattern periodic so rebasing cannot move its phase.
const paperTexture=paper.querySelector?.('.paperRoll .texture');
if(paperTexture){
 $('paperFiber')?.querySelector?.('feTurbulence')?.setAttribute('stitchTiles','stitch');
 paperTexture.innerHTML='<defs><pattern id="r3PaperTile" patternUnits="userSpaceOnUse" width="312" height="220"><rect width="312" height="220" filter="url(#paperFiber)"/></pattern></defs><rect width="100%" height="100%" fill="url(#r3PaperTile)"/>';
}
let metrics=travel(Tms);
let continuous = createContinuousTrace({retain:640,responseMs:4}), originOffset=0;
function duration(seconds){const n=Number(seconds);if(Number.isFinite(n)&&n>=.5&&n<=10){scanDurationMs=n*1000;}}
duration(2.5);
function travel(ms){const rise=clamp(Math.round(56*ms/1000+40),90,380);return {writeY:304,traceNeutralX:118,traceXMin:50,traceXMax:184,ampMax:66,riseBase:rise,riseExtra:0,rise,riseTotal:rise,verdictPaper:rise*.25,measurePaper:rise*.75,feedAfter:0,uVerdict:.75};}
function mulberry32(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// Same seed, rhythm and motion for both materials and both verdicts.
function generateHeartbeat(T,seed,verdict='truth'){
 const rng=mulberry32(seed),rate=1.5+rng()*.7,cycles=Math.max(2,Math.round(T*rate));
 const rise=travel(T*1000).rise,required=Math.max(2,Math.floor(.75*cycles),T===2.5&&cycles>=4?3:0);
 const jitter=.08+rng()*.10,weights=Array.from({length:cycles},()=>1+(rng()*2-1)*jitter),sum=weights.reduce((a,b)=>a+b,0);
 let reducedCount=0,at=0;
 const beats=weights.map((weight,i)=>{
  const width=weight/sum,start=at;at+=width;
  const reduced=rng()<.20&&reducedCount<cycles-required;if(reduced)reducedCount++;
  return {i,start,width,amp:reduced?24+rng()*5:34+rng()*20,reduced,
   pre:(5+rng()*5)*(rng()<.5?-1:1),under:-(6+rng()*8),recovery:(12+rng()*12)*(rng()<.2?-1:1),
   preAt:.12+rng()*.03,peakAt:.39+rng()*.04,recoveryAt:.78+rng()*.05,wander:(rng()*2-1)*1.5};
 });
 const median=beats.map(b=>b.amp).sort((a,b)=>a-b)[Math.floor(cycles/2)];
 const intervalFactor=.84+rng()*.06,peakFactor=1.08+rng()*.06;
 const nodes=[{s:0,d:0}],apices=[];
 for(const beat of beats){
  // >=9 paper px from rise onset to fall end, including at dense long durations.
  const extent=Math.max(9/rise,beat.width*.56),apex=beat.start+beat.width*beat.peakAt;
  const onset=Math.max(beat.start+beat.width*.17,apex-extent*.47),end=Math.min(beat.start+beat.width*.99,onset+extent);
  const controls=[[beat.start,0],[beat.start+beat.width*beat.preAt,beat.pre],
   [onset,0],[apex,beat.amp],[end,0],
   [end+(beat.start+beat.width-end)*.18,beat.under],
   [end+(beat.start+beat.width-end)*.64,beat.recovery],[beat.start+beat.width,beat.wander]];
  beat.mainExtent=(end-onset)*rise;
  for(const [s,d]of controls){
   const main=s===apex,tail=s>=.75;
   const time=tail&&verdict==='lie'?.75+(s-.75)*intervalFactor:s;
   const value=main&&tail?(verdict==='lie'?d*peakFactor:Math.min(d,median)):d;
   nodes.push({s:time,d:value});
   if(main)apices.push({s:time,amplitude:value,side:'right',large:value>=30,cycle:beat.i});
  }
 }
 // Explicit boundary keeps all values before 75% identical, including crossing beats.
 const base=nodes.filter(p=>p.s<.75);
 const raw=[];for(const beat of beats){const extent=Math.max(9/rise,beat.width*.56),apex=beat.start+beat.width*beat.peakAt,onset=Math.max(beat.start+beat.width*.17,apex-extent*.47),end=Math.min(beat.start+beat.width*.99,onset+extent);raw.push({s:beat.start,d:0},{s:beat.start+beat.width*beat.preAt,d:beat.pre},{s:onset,d:0},{s:apex,d:beat.amp},{s:end,d:0},{s:end+(beat.start+beat.width-end)*.18,d:beat.under},{s:end+(beat.start+beat.width-end)*.64,d:beat.recovery},{s:beat.start+beat.width,d:beat.wander});}
 raw.sort((a,b)=>a.s-b.s);
 const boundary=interpolate(raw,.75);
 nodes.splice(0,nodes.length,...base,{s:.75,d:boundary},...nodes.filter(p=>p.s>.75),{s:1,d:0});
 nodes.sort((a,b)=>a.s-b.s);
 const unique=nodes.filter((p,i)=>!i||p.s>nodes[i-1].s+1e-12);
 return {seed,rate,cycles,rightMainPeaks:apices.filter(p=>p.large).length,rise,beats,nodes:unique,apices,median,intervalFactor,peakFactor};
}
let heartbeat=null,apexCursor=0,tickDistance=0;
function controls(seed,verdict){seedUsed=seed;heartbeat=generateHeartbeat(Tms/1000,seed,verdict);responses=heartbeat.beats;points=heartbeat.nodes;wander=[];metrics.responseCount=heartbeat.cycles;metrics.rate=heartbeat.rate;metrics.rightMainPeaks=heartbeat.rightMainPeaks;return responses;}
function smooth(t){return t*t*(3-2*t);}
function interpolate(nodes,s){for(let i=1;i<nodes.length;i++)if(s<=nodes[i].s){const a=nodes[i-1],b=nodes[i];if(b.s===a.s)return b.d;return a.d+(b.d-a.d)*smooth(clamp((s-a.s)/(b.s-a.s),0,1));}return nodes[nodes.length-1]?.d||0;}
function amplitude(s){return interpolate(points,s);}
function bezier(t,x1,y1,x2,y2){if(t<=0)return 0;if(t>=1)return 1;const at=(u,a,b)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u;let lo=0,hi=1;for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(at(mid,x1,x2)<t)lo=mid;else hi=mid;}return at((lo+hi)/2,y1,y2);}
function schedule(fn,delay){jobs.push(setTimeout(fn,Math.max(0,delay)));}
function stopJobs(){cancelAnimationFrame(raf);raf=0;jobs.forEach(clearTimeout);jobs=[];}
function moveKey(down,now=performance.now(),instant=reduced()){pressed=down;keyFrom=keyY;keyTo=down?TIMING.keyDownPx:0;keyAt=now;keyDur=instant?0:down?TIMING.keyDownMs:TIMING.keyUpMs;key.classList.toggle('pressed',down);}
function light(on,now=performance.now(),instant=reduced()){lampFrom=lampLevel;lampTo=on?1:0;lampAt=now;lampDur=instant?0:on?TIMING.lampAttack:TIMING.lampRelease;}
function pathNode(d){const p=document.createElementNS('http:'+'//www.w3.org/2000/svg','path');p.setAttribute('class','trace');p.style.stroke=config?.ink||'#1a120c';p.setAttribute('d',d);chart.append(p);return p;}
function planSamples(){
 const boundaries=points.map(p=>p.s).filter(s=>s>0&&s<=1).sort((a,b)=>a-b);
 let u=0;plannedSamples=[{s:0,d:amplitude(0)}];
 while(u<1-1e-10){while(boundaries.length&&boundaries[0]<=u+1e-10)boundaries.shift();const v=Math.min(u+.35/metrics.rise,boundaries[0]??1,1);plannedSamples.push({s:v,d:amplitude(v)});u=v;}
}
function recordFeed(u){
 const distance=metrics.rise*u;
 while(tickDistance+22<=distance+1e-8){tickDistance+=22;record('tick',{distance:tickDistance});RecorderSound.tick();}
}
function appendTo(u,final=false){
 u=Math.max(u,lastSample);
 const point=continuous.advance(u*Tms,final);
 for(const p of plannedSamples){
  if(p.s<=lastSample+1e-10||p.s>u+1e-10)continue;
  if(heartbeat&&apexCursor<heartbeat.apices.length&&Math.abs(p.s-heartbeat.apices[apexCursor].s)<1e-8){
   const apex=heartbeat.apices[apexCursor++];record('peakApex',{...apex,timeline:measurementStart+p.s*Tms});RecorderSound.beep(apex);
  }
 }
 lastSample=u;lastD=point.position;penX=118+lastD;penY=304;paperShift=point.distance;
 maxLeft=Math.max(maxLeft,-lastD);maxRight=Math.max(maxRight,lastD);
 recordFeed(u);
 // Rebase the entire paper window together. 22px multiples preserve ruled phase.
 if(paperShift>1100){
  const amount=Math.floor((paperShift-660)/220)*220;originOffset+=amount;
  continuous.rebase(amount);paperShift-=amount;shiftAtStart-=amount;
  for(const g of [...glyphs.children]){g.style.top=`${parseFloat(g.style.top)-amount}px`;}
  glyphs.replaceChildren(...[...glyphs.children].filter(g=>parseFloat(g.style.top)+86>=paperShift-112));
  // The paper texture repeats every 220px, exactly the same rebase period.
 }
 runInk=ink=continuous.path(p=>[68+p.position,192+p.distance]);trace.setAttribute('d',runInk);
 traceSamples=[continuous.snapshot()];
}
function scanU(now){return clamp((now-measurementStart)/Tms,0,1);}
function reset(now=performance.now()){stopJobs();mode='idle';held=false;paperShift=shiftAtStart=0;feeding=false;feedMs=0;measurementStart=now;lastSample=lastD=escape=0;penX=118;penY=304;struck=[false,false];impactTimes=[];glyphPositions=[];stopTime=lampOff=null;ink=runInk='M68,176 L68,192';traceSamples=[{s:0,d:0,y:192,slope:0}];continuous=createContinuousTrace({retain:640,responseMs:4});originOffset=0;chart.replaceChildren();trace=pathNode(runInk);glyphs.replaceChildren();keyY=lampLevel=0;moveKey(false,now,true);light(false,now,true);render(now);}
function insertGlyph(i){if(struck[i])return;struck[i]=true;impactTimes.push(Tms+TIMING.silence+i*TIMING.strikeCycle+TIMING.impactAt);const x=139.4+i*86,y=99.6+paperShift,g=document.createElement('div');g.className='impression '+armedVerdict;g.style.left=`${x}px`;g.style.top=`${y}px`;g.style.filter=`url(#inkBleed${i+1}${armedVerdict==='lie'?'Lie':'Truth'})`;g.dataset.glyph=String(i);const indentation=document.createElement('i');indentation.className='indentation';const svg=document.createElementNS('http:'+'//www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 74 86');const face=document.createElementNS(svg.namespaceURI,'text');face.setAttribute('x','37');face.setAttribute('y','43');face.setAttribute('text-anchor','middle');face.setAttribute('dominant-baseline','central');face.textContent=(armedVerdict==='lie'?['거','짓']:['진','실'])[i];svg.append(face);g.append(indentation,svg);if(armedVerdict==='lie'){const dup=document.createElementNS(svg.namespaceURI,'svg');dup.setAttribute('viewBox','0 0 74 86');dup.setAttribute('class','duplicate');const f=document.createElementNS(svg.namespaceURI,'text');f.setAttribute('x','37');f.setAttribute('y','43');f.setAttribute('text-anchor','middle');f.setAttribute('dominant-baseline','central');f.textContent=face.textContent;dup.append(f);g.append(dup);}glyphs.append(g);glyphPositions.push({x,y});record('glyphImpact',{glyph:face.textContent,index:i});RecorderSound.clack(i,seedUsed);if(i===1)RecorderSound.verdictAccent(armedVerdict,performance.now());}
function decision(now){if(mode!=='scan')return;appendTo(1,true);stopTime=measurementStart+Tms;record('verdict',{verdict:measurementOnly?'measured':armedVerdict});mode=measurementOnly?'measured':'silence';if(!held)moveKey(false,stopTime);if(measurementOnly){lampOff=stopTime;light(false,stopTime);}if(reduced()){if(!measurementOnly){insertGlyph(0);insertGlyph(1);mode=armedVerdict;light(false,stopTime);lampOff=stopTime;}}render(now);}
function cancel(now=performance.now()){if(mode!=='scan')return;if(mode==='scan')appendTo(scanU(now),true);stopTime=now;record('cancel');mode='cancel';feeding=false;held=false;moveKey(false,now);light(false,now);lampOff=now;render(now);}
function angle(t){if(t<0||t>=110)return 80;if(t<46)return 80-26*bezier(t/46,.36,.02,.24,1);if(t<70)return 54;return 54+26*bezier((t-70)/40,.2,.6,.2,1);}
function render(now){const keyU=keyDur?clamp((now-keyAt)/keyDur,0,1):1;keyY=keyFrom+(keyTo-keyFrom)*bezier(keyU,...(pressed?[.2,.9,.3,1]:[.2,.6,.2,1]));key.style.transform=`translateY(${keyY}px)`;$('keyStem').style.clipPath=`inset(0 0 ${keyY}px 0)`;const lampU=lampDur?clamp((now-lampAt)/lampDur,0,1):1;lampLevel=lampFrom+(lampTo-lampFrom)*lampU;lamp.style.setProperty('--heat',lampLevel);let squash=1,a=80,dwelling=false;escape=0;
if(!reduced()&&['silence','typing','truth','lie'].includes(mode)){const t=now-measurementStart-Tms-TIMING.silence;if(t<110)escape=86*bezier(clamp((t-54)/36,0,1),.16,.84,.32,1);else if(t<180)escape=86;else if(t<220)escape=86*(1-bezier((t-180)/40,.2,.6,.2,1));for(let i=0;i<2;i++){const local=t-i*110;if(local>=0&&local<110)a=angle(local);if(local>=46&&local<70)dwelling=true;if(local>=46&&!struck[i])insertGlyph(i);const since=local-46;if(since>=0&&since<30)squash=armedVerdict==='lie'?.972:.988;}if(t>=220){mode=armedVerdict;if(lampOff===null){lampOff=measurementStart+Tms+640;light(false,lampOff);}}else if(t>=0)mode='typing';}

paper.style.transform=`translateY(${-paperShift}px)`;const height=2200;paper.style.height=`${height}px`;chart.style.height=`${height}px`;chart.setAttribute('viewBox',`0 0 312 ${height}`);platen.style.transform=`scaleY(${squash})`;const theta=Math.asin((penX-118)/204),pivotY=304-204*Math.cos(theta),lift=penY-304,penAngle=-theta*180/Math.PI;
$('penRigid').setAttribute('transform',`translate(118 ${pivotY+lift}) rotate(${penAngle})`);bar.setAttribute('transform',`translate(${61.36+escape} 374.51) rotate(${a})`);
// Inverse rotation keeps the single light fixed in screen space.
$('precisionMetal').setAttribute('gradientTransform',`rotate(${-penAngle})`);$('typeMetal').setAttribute('gradientTransform',`rotate(${-a})`);$('penRound').setAttribute('gradientTransform',`rotate(${-penAngle})`);$('typeRound').setAttribute('gradientTransform',`rotate(${-a})`);
const slug=$('typeSlug');let mask='M-9 -219H9V-189H-9Z';const radians=a*Math.PI/180,c=Math.cos(radians),sn=Math.sin(radians);
if(!dwelling)for(const g of glyphs.children){const x=50+parseFloat(g.style.left),y=112+parseFloat(g.style.top)-paperShift;const corners=[[x-2,y-2],[x+76,y-2],[x+76,y+88],[x-2,y+88]].map(([gx,gy])=>{const dx=gx-(61.36+escape),dy=gy-374.51;return `${(c*dx+sn*dy).toFixed(3)} ${(-sn*dx+c*dy).toFixed(3)}`;});mask+=' M'+corners.join(' L')+'Z';}$('typeSlugMaskPath').setAttribute('d',mask);slug.dataset.dwelling=String(dwelling);
$('stage').dataset.mode=mode;}
function tick(now){raf=0;if(mode==='scan'){appendTo(scanU(now));}render(now);if(mode==='scan'||mode==='silence'||mode==='typing'||now<Math.max(keyAt+keyDur,lampAt+lampDur,(stopTime||0)+40))raf=requestAnimationFrame(tick);}
function interrupt(){const now=performance.now();if(mode==='scan')appendTo(scanU(now),true);if(mode==='scan'){record('cancel',{reason:'interrupted'});}feeding=false;stopJobs();}
function begin(verdict,options={}){
 suspended=false;interrupt();
 const oldPoints=points,oldElapsed=lastSample*Tms,oldDuration=Tms;
 const nextNeutral=oldPoints.find(p=>p.s*oldDuration>oldElapsed&&Math.abs(p.d)<.01);
 const carry=Math.max(0,(nextNeutral ? nextNeutral.s*oldDuration : oldElapsed)-oldElapsed);
 armedVerdict=verdict;activeIndex=options.runIndex===undefined?runIndex++:options.runIndex;
 Tms=scanDurationMs;metrics=travel(Tms);
 // The optional seed is a test hook; production entropy never uses attempt or verdict.
 controls(options.seed??Math.floor(Math.random()*4294967296),verdict);planSamples();apexCursor=0;tickDistance=0;
 const newPoints=points;
 continuous.begin({duration:Tms,travel:metrics.rise,target:t=>{
  const late=t>=Tms*.75&&verdict==='lie';
  const resumedTime=late?Tms*.75+(t-Tms*.75)/heartbeat.intervalFactor:t;
  return resumedTime<carry?interpolate(oldPoints,(oldElapsed+resumedTime)/oldDuration)*(late?heartbeat.peakFactor:1):interpolate(newPoints,t/Tms);
 }});
 feedMs=0;shiftAtStart=paperShift;lastSample=0;maxLeft=maxRight=0;
 traceSamples=[continuous.snapshot()];struck=[false,false];impactTimes=[];glyphPositions=[];escape=0;stopTime=lampOff=null;
 start=options.startedAt??performance.now();measurementStart=start;
 $('stage').dataset.seed=String(seedUsed);record('testStart',{duration:Tms/1000,seed:seedUsed,cycles:heartbeat.cycles,rate:heartbeat.rate,rightMainPeaks:heartbeat.rightMainPeaks,verdict});
 feeding=false;mode='scan';held=!!options.held;measurementOnly=!!options.measurementOnly;
 moveKey(true,start);light(true,start);
 for(const apex of heartbeat.apices)schedule(()=>{if(mode==='scan'){appendTo(apex.s);render(performance.now());}},measurementStart+apex.s*Tms-performance.now());
 render(performance.now());raf=requestAnimationFrame(tick);
}

function finish(counted, verdict, now=performance.now()) {
 if (suspended) return;
 if (!counted) { cancel(now); stopJobs(); raf=requestAnimationFrame(tick); return; }
 armedVerdict=verdict==='TRUE'?'truth':'lie';
 decision(now);
 stopJobs();
 if (!reduced()) for(let i=0;i<2;i++) for(const offset of [0,46,54,70,90,110])
  schedule(()=>render(performance.now()), measurementStart+Tms+420+i*110+offset-performance.now());
 raf=requestAnimationFrame(tick);
}
function suspend() { suspended=true; cancel(performance.now()); stopJobs(); held=false; moveKey(false,performance.now(),true); light(false,performance.now(),true); RecorderSound.close(); if(mode==='silence'||mode==='typing')mode='frozen'; render(performance.now()); }
reset();
return {
 begin(options) { duration(options.duration/1000); RecorderSound.setEnabled(options.sound); begin(options.verdict==='TRUE'?'truth':'lie',{held:true,startedAt:options.startedAt,runIndex:options.attempt,seed:options.seed}); },
 finish,
 setPressed(down) { if(suspended && !down){held=false;moveKey(false,performance.now(),true);render(performance.now());return;} suspended=false; held=down; moveKey(down); render(performance.now()); if(!raf)raf=requestAnimationFrame(tick); },
 setSoundEnabled:RecorderSound.setEnabled, unlock(){if(RecorderSound.enabled)RecorderSound.unlock();},
 suspend, destroy(){ suspend(); root.replaceChildren(); },
 snapshot:()=>({trace:continuous.snapshot(),penX,penY,originOffset,mode,paperShift,Tms,feeding,feedMs,struck:[...struck],glyphPositions:[...glyphPositions],jobs:jobs.length,raf,log:[...log],volume:RecorderSound.volume,contextState:RecorderSound.context?.state ?? 'closed',...metrics}),
};
}
