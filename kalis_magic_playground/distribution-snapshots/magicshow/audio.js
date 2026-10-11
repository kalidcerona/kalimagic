/* Small procedural sound bank. No network or audio assets required. */
(function () {
  'use strict';
  const KEY = 'magicShowBuster.v3.sound';
  let gestured = false, needsGesture = true;
  let context, master, muted = false, lastTap = -Infinity;
  const MUSIC_KEY='magicShowBuster.v3.music';
  let musicOn=true,musicVolume=.35,musicBus,musicTimer=null,musicStep=0,musicNext=0,musicScene={group:'cozy',tense:false,fever:false},musicSignature='',noiseBuffer;
  const musicVoices=new Set();
  try {const saved=JSON.parse(localStorage.getItem(MUSIC_KEY));if(saved&&typeof saved.on==='boolean')musicOn=saved.on;if(saved&&Number.isFinite(saved.volume))musicVolume=Math.max(0,Math.min(1,saved.volume));} catch(error) { /* Optional preference. */ }
  const voices = new Set();
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (error) { /* Storage is optional. */ }
  function unlock() {
    gestured = true;
    if(context&&context.state==='running'&&!needsGesture){startMusic();return;}
    needsGesture=false;
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!context) {
        context = new Audio();
        context.onstatechange=()=>{if(context.state!=='running'){needsGesture=true;stopMusic();}else startMusic();}; master = context.createGain();
        master.gain.value = muted ? 0 : .16; master.connect(context.destination);
      }
      if ((context.state === 'suspended' || context.state === 'interrupted')) context.resume().then(startMusic).catch(() => {});
      if(musicOn && !document.hidden && !musicTimer) startMusic();
    } catch (error) { /* Unsupported audio must never interrupt the game. */ }
  }
  function tone(freq, duration, delay = 0, type = 'sine', volume = .4, end = freq) {
    if (!context || context.state !== 'running' || muted || document.hidden || voices.size >= 16) return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(master); voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .01);
  }
  function play(name, options = {}) {
    if (!context || muted) return;
    const quiet = options.auto ? .23 : 1;
    const note = (f, d, t = 0, type = 'sine', v = .4, end = f) => tone(f, d, t, type, v * quiet, end);
    const melody = (notes, step, type = 'triangle') => notes.forEach((f, i) => note(f, step * 1.7, i * step, type, .35));
    switch (name) {
      case 'event': melody([784,1047,1568,2093], .06); break;
      case 'skill': melody([523,784,1047,1568], .10); break;
      case 'tap':
        if (context.currentTime - lastTap < .06) return;
        lastTap = context.currentTime; note(1500, .035, 0, 'square', .17, 700); break;
      case 'worker': note(960, .035, 0, 'triangle', .16, 640); break;
      case 'box': note(220, .12, 0, 'triangle', .65, 750); break;
      case 'whoosh': note(1700, .18, 0, 'sawtooth', .08, 120); break;
      case 'hit': note(130, .09, 0, 'square', .3, 45); break;
      case 'heckle': note(340, .15, 0, 'sawtooth', .2, 210); note(240, .13, .13, 'sawtooth', .18, 150); break;
      case 'mental': note(95, .22, 0, 'triangle', .6, 32); break;
      case 'combo': note(330 * Math.pow(2, Math.min(24, options.combo || 1) / 12), .09, 0, 'triangle', .25); break;
      case 'crit': note(1320, .08, 0, 'triangle', .4, 1980); break;
      case 'caseLevel': melody([659, 880, 1047], .055); break;
      case 'caseTier': melody([523, 784, 1047, 1568], .10); break;
      case 'golden': melody([784, 1047, 1568], .09); break;
      case 'milestone': melody([523, 659, 1047], .07); break;
      case 'encore': melody([392, 523, 784, 1047], .1); break;
      case 'finisher': melody([392, 523, 659, 784, 1047], .09); break;
      case 'failure': melody([294, 277, 262], .17, 'sawtooth'); note(247, .65, .51, 'sawtooth', .25, 123); break;
      case 'coin': note(1047, .18, 0, 'sine', .3); note(1568, .25, .06, 'sine', .2); break;
      case 'slot': melody([180, 240, 300, 180, 240, 360, 420, 540], .1, 'square'); break;
      case 'flip': note(800, .06, 0, 'triangle', .25, 220); break;
      case 'rebirth': melody([262, 392, 523, 659, 784, 1047, 1319], .12); break;
      case 'ending': melody([392, 440, 523, 659, 587, 523, 440, 523, 784], .3); break;
    }
  }
  function toggle() {
    unlock(); muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : .16, context.currentTime, .02);
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (error) { /* Storage is optional. */ }
    return !muted;
  }
  // A 32-bar score at 112 BPM repeats after 68.57 seconds. No random source.
  function musicGroup(slug){
    if(['family','party','school'].includes(slug))return 'cozy';
    if(['cafe','meetup','theater','festival'].includes(slug))return 'bright';
    if(['audition','broadcast','vegas','broadway'].includes(slug))return 'showy';
    if(['moon','sun','galaxy'].includes(slug))return 'spacey';
    return ['lecturenote','future'].includes(slug)?'homecoming':'mysterious';
  }
  function scoreStep(step,scene){
    const scales={cozy:[0,2,4,7,9],bright:[0,2,4,5,7,9,11],showy:[0,4,5,7,9,11],spacey:[0,2,5,7,10],mysterious:[0,1,3,6,7,10],homecoming:[0,2,4,7,9]};
    const scale=scales[scene.group]||scales.cozy,n=step%256,bar=Math.floor(n/8),beat=n%8;
    const root=(scene.tense?45:scene.group==='homecoming'?53:48)+[0,5,7,0,9,5,7,0][Math.floor(bar/4)%8];
    const melody=root+12+scale[(beat+bar*3+Math.floor(bar/8))%scale.length];
    const out=[{midi:melody,type:scene.group==='homecoming'?'triangle':'square',duration:.19,volume:scene.group==='homecoming'?.035:.045}];
    if(beat%2===0)out.push({midi:root+(beat===4?7:0),type:'triangle',duration:.42,volume:.08});
    if(beat%4===2)out.push({midi:0,type:'noise',duration:.045,volume:scene.tense?.025:.012});
    if(scene.tense&&beat%2)out.push({midi:root+7,type:'square',duration:.09,volume:.025});
    if(scene.fever)out.push({midi:melody+12,type:'triangle',duration:.12,volume:.05});
    return out;
  }
  function saveMusic(){try{localStorage.setItem(MUSIC_KEY,JSON.stringify({on:musicOn,volume:musicVolume}));}catch(error){ /* Optional storage. */ }}
  function musicNote(note,start,bus){
    if(!context||musicVoices.size>=48)return;
    const gain=context.createGain();let source;
    if(note.type==='noise'){
      if(!noiseBuffer){noiseBuffer=context.createBuffer(1,2048,context.sampleRate);const samples=noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=((i*73%257)/128-1)*.5;}
      source=context.createBufferSource();source.buffer=noiseBuffer;source.loop=true;
    }else{source=context.createOscillator();source.type=note.type;source.frequency.setValueAtTime(440*Math.pow(2,(note.midi-69)/12),start);}
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(note.volume,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+note.duration);
    source.connect(gain);gain.connect(bus);musicVoices.add(source);
    source.onended=()=>{musicVoices.delete(source);source.disconnect();gain.disconnect();};
    source.start(start);source.stop(start+note.duration+.01);
  }
  function scheduleMusic(){
    musicTimer=null;
    if(!context||context.state!=='running'||!musicOn||document.hidden)return;
    if(musicNext<context.currentTime)musicNext=context.currentTime+.04;
    while(musicNext<context.currentTime+.35){for(const note of scoreStep(musicStep++,musicScene))musicNote(note,musicNext,musicBus);musicNext+=60/112/2;}
    musicTimer=setTimeout(scheduleMusic,100);
  }
  function stopMusic(){
    if(musicTimer!==null)clearTimeout(musicTimer);musicTimer=null;
    for(const source of musicVoices){try{source.stop();source.disconnect();}catch(error){ /* Already ended. */ }}musicVoices.clear();
    if(musicBus){musicBus.disconnect();musicBus=null;}
  }
  function startMusic(){
    if(!gestured||!context||context.state!=='running'||!musicOn||document.hidden)return;
    if(!musicBus){musicBus=context.createGain();musicBus.gain.value=musicVolume*.22;musicBus.connect(context.destination);musicNext=context.currentTime+.04;}
    if(musicTimer===null)scheduleMusic();
  }
  function setMusicScene(slug,tense,fever){
    const next={slug:slug,group:musicGroup(slug),tense:!!tense,fever:!!fever},signature=JSON.stringify(next);
    if(signature===musicSignature)return;musicSignature=signature;musicScene=next;
    if(musicBus&&context&&musicOn){
      const old=musicBus;old.gain.setTargetAtTime(0,context.currentTime,.16);
      musicBus=context.createGain();musicBus.gain.value=0;musicBus.connect(context.destination);musicBus.gain.setTargetAtTime(musicVolume*.22,context.currentTime,.16);
      setTimeout(()=>old.disconnect(),900);musicStep=0;musicNext=context.currentTime+.04;
    }
    startMusic();
  }
  function toggleMusic(){musicOn=!musicOn;saveMusic();if(musicOn){unlock();startMusic();}else stopMusic();return musicOn;}
  function setMusicVolume(value){if(!Number.isFinite(Number(value)))return;musicVolume=Math.max(0,Math.min(1,Number(value)));saveMusic();if(musicBus)musicBus.gain.setTargetAtTime(musicVolume*.22,context.currentTime,.02);}
  for(const event of ['pointerdown','pointerup','touchend','click','keydown'])document.addEventListener(event,unlock,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{
    needsGesture=true;
    if(document.hidden){stopMusic();if(context&&context.suspend)context.suspend().catch(()=>{});}
  });
  globalThis.addEventListener?.('pageshow',()=>{needsGesture=true;stopMusic();});
  globalThis.Sfx = { play, unlock, toggle, isMuted: () => muted, toggleMusic,setMusicVolume,setMusicScene,musicGroup,scoreStep,musicEnabled:()=>musicOn,musicVolume:()=>musicVolume,musicStatus:()=>({scheduled:musicTimer!==null,voices:musicVoices.size,step:musicStep}) };
})();
