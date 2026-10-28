/* Small procedural sound bank. No network or audio assets required. */
(function () {
  'use strict';
  const KEY = 'magicShowBuster.v3.sound';
  let gestured = false, needsGesture = true;
  let context, master, muted = false, lastTap = -Infinity;
  const SAME_GAP = .07, lastPlayed = new Map(), FEVER_BPM = 132; // v4 U47 9: 피버 plays the same score faster (112 BPM normally)
  const MUSIC_KEY='magicShowBuster.v3.music';
  let musicOn=true,musicVolume=.35,musicBus,musicTimer=null,musicStep=0,musicNext=0,musicScene={group:'cozy',tense:false,fever:false},musicSignature='',noiseBuffer;
  const musicVoices=new Set();
  try {const saved=JSON.parse(localStorage.getItem(MUSIC_KEY));if(saved&&typeof saved.on==='boolean')musicOn=saved.on;if(saved&&Number.isFinite(saved.volume))musicVolume=Math.max(0,Math.min(1,saved.volume));} catch(error) { /* Optional preference. */ }
  const voices = new Set();
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (error) { /* Storage is optional. */ }
  // U55: keep activation work synchronous; promises only observe the result.
  let recoverySince = null, clockProbe = null, lastAudioError = '';
  const RECOVERY_MS = 1500;
  function playbackSession() {
    try { if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback'; }
    catch (error) { lastAudioError = 'audioSession: ' + error.message; }
  }
  function discardContext() {
    const old = context;
    if (old) old.onstatechange = null;
    stopMusic();
    for (const source of voices) { try { source.stop(); source.disconnect(); } catch (error) { /* Already ended. */ } }
    voices.clear();
    if (master) master.disconnect();
    context = master = noiseBuffer = undefined;
    lastTap = -Infinity; lastPlayed.clear();
    recoverySince = clockProbe = null;
    try { if (old && old.state !== 'closed') Promise.resolve(old.close()).catch(() => {}); }
    catch (error) { /* A broken context must not prevent replacement. */ }
  }
  function unlock() {
    gestured = true;
    if (document.hidden) { needsGesture = true; return; }
    const now = Date.now();
    const frozen = context?.state === 'running' && clockProbe &&
      context.currentTime === clockProbe.time && now - clockProbe.at >= RECOVERY_MS;
    if (context && (context.state === 'closed' || frozen ||
      (context.state !== 'running' && recoverySince !== null && now - recoverySince >= RECOVERY_MS))) discardContext();
    if (context?.state === 'running' && !needsGesture) {
      if (!clockProbe || context.currentTime !== clockProbe.time) clockProbe = { time: context.currentTime, at: now };
      startMusic(); return Promise.resolve();
    }
    needsGesture = true;
    playbackSession();
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!context) {
        context = new Audio(); // Let the output device choose its sample rate.
        const created = context;
        context.onstatechange = () => {
          if (context !== created) return;
          needsGesture = created.state !== 'running';
          if (needsGesture) { clockProbe = null; stopMusic(); }
          else { recoverySince = null; startMusic(); }
        };
        master = context.createGain();
        master.gain.value = muted ? 0 : .16; master.connect(context.destination);
      }
      const active = context;
      if (recoverySince === null) recoverySince = now;
      let resumed;
      try { if (active.state !== 'running') resumed = active.resume(); }
      catch (error) { lastAudioError = 'resume: ' + error.message; }
      // Start in the gesture, not in resume().then(): older iOS needs a buffer source.
      try {
        const source = active.createBufferSource();
        source.buffer = active.createBuffer(1, 1, active.sampleRate);
        source.connect(master);
        source.onended = () => source.disconnect();
        source.start(0);
      } catch (error) { lastAudioError = 'unlock buffer: ' + error.message; }
      const ready = () => {
        if (context !== active) return;
        needsGesture = active.state !== 'running';
        if (!needsGesture) {
          recoverySince = null; clockProbe = { time: active.currentTime, at: Date.now() };
          startMusic();
        }
      };
      ready();
      return Promise.resolve(resumed).then(ready, error => {
        if (context !== active) return;
        needsGesture = true; lastAudioError = 'resume: ' + error.message;
      });
    } catch (error) { needsGesture = true; lastAudioError = 'unlock: ' + error.message; }
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
  // s4e2 F: one hand clap = a short band-passed noise burst (same voice cap as tone()). The buffer is built once per context.
  let clapBuffer;
  function clap(delay, volume) {
    if (!context || context.state !== 'running' || muted || document.hidden || voices.size >= 16) return;
    if (!clapBuffer) { clapBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .06), context.sampleRate); const d = clapBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    const source = context.createBufferSource(), gain = context.createGain(), start = context.currentTime + delay;
    source.buffer = clapBuffer; gain.gain.setValueAtTime(volume, start);
    let out = source;
    if (context.createBiquadFilter) { const band = context.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1400 + Math.random() * 900; band.Q.value = 1.2; source.connect(band); out = band; }
    out.connect(gain); gain.connect(master); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); if (out !== source) out.disconnect(); gain.disconnect(); };
    source.start(start); source.stop(start + .07);
  }
  function play(name, options = {}) {
    if (!context || muted) return;
    // v4 U46 A9: the same sound never starts twice within SAME_GAP seconds (a 25-case chain would otherwise stack 25 copies into one blur).
    if (name !== 'tap') { const now = context.currentTime; if (now - (lastPlayed.get(name) ?? -Infinity) < SAME_GAP) return; lastPlayed.set(name, now); }
    const quiet = (options.auto ? .23 : 1) * (Number.isFinite(options.gain) ? Math.max(0, options.gain) : 1);
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
      case 'drumroll': for (let i = 0; i < 7; i++) note(70 + i * 10, .04, i * .055, 'square', .11, 42); break;
      case 'rise': note(494, .1, 0, 'triangle', .28, 988); break;
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
      // s4e2: a win claps (a few bursts, a headliner about 1.1 s of them, under the 16-voice cap), the curtain call opens on a short fanfare,
      // and a level-up or a learned 비법 answers with a short rising tone.
      case 'applause': { const n = options.big ? 10 : 5, span = options.big ? 1.1 : .42; for (let i = 0; i < n; i++) clap(i * span / n + (i % 3) * .013, .5 * quiet * (options.big && i > n * .6 ? .7 : 1)); break; }
      case 'fanfare': melody([392, 523, 659], .08); note(784, .38, .24, 'triangle', .35); note(1047, .3, .3, 'sine', .18); break;
      case 'levelUp': note(392, .16, 0, 'triangle', .32, 784); note(1047, .12, .12, 'sine', .22); break;
      case 'learn': note(523, .12, 0, 'triangle', .3, 1047); note(1319, .08, .1, 'sine', .18); break;
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
    if(scene.fever){
      // v4 U47 9: fever variation: a brighter lead (the octave above on a sawtooth), an off-beat sparkle, a driving bass and a kick/clap pulse on every beat.
      out.push({midi:melody+12,type:'sawtooth',duration:.12,volume:.04});
      if(beat%2)out.push({midi:melody+19,type:'square',duration:.07,volume:.03});
      if(beat%4===0)out.push({midi:root-12,type:'triangle',duration:.3,volume:.12});
      if(beat%2===0)out.push({midi:0,type:'noise',duration:.06,volume:.04});
    }
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
    while(musicNext<context.currentTime+.35){for(const note of scoreStep(musicStep++,musicScene))musicNote(note,musicNext,musicBus);musicNext+=60/(musicScene.fever?FEVER_BPM:112)/2;}
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
    if(signature===musicSignature)return;musicSignature=signature;
    // v4 U47 9: when only the fever flag flips (in or out) the score keeps its place, so the music speeds up and brightens without jumping back to bar one.
    const feverOnly=musicScene.slug===next.slug&&musicScene.tense===next.tense&&musicScene.fever!==next.fever;
    musicScene=next;
    if(musicBus&&context&&musicOn){
      const old=musicBus;old.gain.setTargetAtTime(0,context.currentTime,feverOnly?.3:.16);
      musicBus=context.createGain();musicBus.gain.value=0;musicBus.connect(context.destination);musicBus.gain.setTargetAtTime(musicVolume*.22,context.currentTime,feverOnly?.3:.16);
      setTimeout(()=>old.disconnect(),feverOnly?1600:900);
      if(!feverOnly){musicStep=0;musicNext=context.currentTime+.04;}else musicNext=Math.max(musicNext,context.currentTime+.04);
    }
    startMusic();
  }
  function toggleMusic(){musicOn=!musicOn;saveMusic();if(musicOn){unlock();startMusic();}else stopMusic();return musicOn;}
  function setMusicVolume(value){if(!Number.isFinite(Number(value)))return;musicVolume=Math.max(0,Math.min(1,Number(value)));saveMusic();if(musicBus)musicBus.gain.setTargetAtTime(musicVolume*.22,context.currentTime,.02);}
  for(const event of ['pointerdown','pointerup','touchend','click','keydown'])document.addEventListener(event,unlock,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{
    needsGesture=true; recoverySince=clockProbe=null;
    if(document.hidden){stopMusic();if(context&&context.suspend)context.suspend().catch(()=>{});}
  });
  globalThis.addEventListener?.('pageshow',()=>{needsGesture=true;recoverySince=clockProbe=null;stopMusic();});
  // U55: opt-in diagnostics, no UI or media element in normal play.
  function mountAudioTest() {
    if (!globalThis.location?.search || typeof globalThis.URLSearchParams !== 'function') return;
    try { if (new globalThis.URLSearchParams(globalThis.location.search).get('audiotest') !== '1') return; }
    catch (error) { return; }
    const panel = document.createElement('section');
    panel.id = 'audioTestPanel'; panel.setAttribute('aria-label', '오디오 진단');
    panel.style.cssText = 'position:fixed;right:8px;top:8px;z-index:2147483647;max-width:calc(100vw - 16px);max-height:60vh;overflow:auto;padding:10px;background:#111;color:#fff;border:1px solid #aaa;border-radius:8px;font:12px/1.5 monospace;pointer-events:auto';
    const status = document.createElement('pre'); status.style.cssText = 'margin:0 0 6px;white-space:pre-wrap';
    let result = '버튼을 눌러 소리를 비교하세요.';
    const update = () => {
      let session = '미지원';
      try { session = globalThis.navigator?.audioSession?.type || session; } catch (error) { /* Optional API. */ }
      status.textContent = '오디오 진단\nstate: ' + (context?.state || '미생성') +
        '\nsampleRate: ' + (context?.sampleRate || '-') + '\naudioSession: ' + session +
        '\nmuted: ' + muted + ' / music: ' + musicOn + ' / volume: ' + musicVolume +
        '\nneedsGesture: ' + needsGesture + '\n' + result + (lastAudioError ? '\n최근 오류: ' + lastAudioError : '');
    };
    const beep = document.createElement('button'); beep.textContent = '삐 소리';
    beep.addEventListener('click', () => {
      const active = unlock();
      const failed = error => { result = '삐 소리 실패: ' + (error?.message || lastAudioError || '오디오가 실행되지 않았습니다. 버튼을 다시 눌러 주세요.'); update(); };
      const sound = () => {
        if (context?.state !== 'running' || document.hidden) { failed(); return; }
        try { tone(880, .25, 0, 'sine', .6); result = muted ? '게임 음소거가 켜져 있습니다.' : '게임 master로 삐 소리 요청'; update(); }
        catch (error) { failed(error); }
      };
      if (context?.state === 'running') sound(); else Promise.resolve(active).then(sound, failed);
    });
    const basic = document.createElement('button'); basic.textContent = '기본 소리';
    basic.style.marginLeft = '8px';
    // PCM mono 16-bit, 8 kHz, 250 ms. No assets or Web Audio dependency.
    const rate = 8000, count = 2000, wav = new Uint8Array(44 + count * 2), view = new DataView(wav.buffer);
    const ascii = (at, text) => { for (let i = 0; i < text.length; i++) wav[at + i] = text.charCodeAt(i); };
    ascii(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, 'data'); view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 880 * i / rate) * 6000 * Math.min(1, i / 80, (count - 1 - i) / 80)), true);
    const media = document.createElement('audio');
    media.src = 'data:audio/wav;base64,' + btoa(String.fromCharCode(...wav)); media.preload = 'auto';
    basic.addEventListener('click', () => {
      try {
        media.currentTime = 0;
        Promise.resolve(media.play()).then(() => { result = 'HTML audio 재생 요청 성공, 실제 소리를 확인하세요.'; update(); }, error => { result = 'HTML audio 실패: ' + error.message; update(); });
      } catch (error) { result = 'HTML audio 실패: ' + error.message; update(); }
    });
    panel.append(status, beep, basic, media); document.body.append(panel); update();
    setInterval(update, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAudioTest, { once: true });
  else mountAudioTest();
  globalThis.Sfx = { play, unlock, toggle, isMuted: () => muted, toggleMusic,setMusicVolume,setMusicScene,musicGroup,scoreStep,musicEnabled:()=>musicOn,musicVolume:()=>musicVolume,musicStatus:()=>({scheduled:musicTimer!==null,voices:musicVoices.size,step:musicStep}) };
})();
