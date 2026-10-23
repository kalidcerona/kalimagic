(() => {
  const D = window.TabataData;
  const TYPES = Object.fromEntries(Object.entries({prep:'준비',work:'운동',rest:'휴식',setrest:'사이클 휴식',cool:'쿨다운'}).map(([key,label]) => [key,{label,voice:label,color:`var(--${key})`}]));
  const FIELDS = [
    {key:'prep',name:'준비',hint:'시작 전 카운트다운',time:true},
    {key:'work',name:'운동',hint:'한 라운드의 운동 시간',time:true},
    {key:'rest',name:'휴식',hint:'라운드 사이 쉬는 시간',time:true},
    {key:'rounds',name:'라운드',hint:'1라운드는 운동 + 휴식',time:false},
    {key:'cycles',name:'사이클',hint:'전체 라운드 반복 횟수',time:false},
    {key:'setrest',name:'사이클 사이 휴식',hint:'사이클이 끝날 때마다',time:true},
    {key:'cool',name:'쿨다운',hint:'마무리 스트레칭',time:true}
  ];
  const memory = new Map();
  const storage = {
    getItem(k) { if(memory.has(k)) return memory.get(k);try { return localStorage.getItem(k); } catch { return null; } },
    setItem(k,v) { memory.set(k,v);try { localStorage.setItem(k,v);return true; } catch { return false; } }
  };
  const store = {
    get(k,d) { try { return JSON.parse(storage.getItem(k)) ?? d; } catch { return d; } },
    set(k,v) { try { return storage.setItem(k,JSON.stringify(v)); } catch { return false; } }
  };
  let timers = D.load(storage), active = D.timer(), cfg = active.v, draft = null, picker = null;
  let opts = Object.assign({beep:true,voice:true,vibe:true},store.get('tt.opts',{}));
  const $ = id => document.getElementById(id);
  const fmt = s => { s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
  const displayTime = s => s < 60 ? ':'+String(s).padStart(2,'0') : fmt(s);
  function build(c,skipLast = true) {
    const segs=[];
    if(c.prep>0) segs.push({type:'prep',dur:c.prep,round:0,cycle:1});
    for(let cy=1;cy<=c.cycles;cy++) {
      for(let r=1;r<=c.rounds;r++) {
        segs.push({type:'work',dur:c.work,round:r,cycle:cy});
        if(c.rest>0 && !(r===c.rounds && skipLast)) segs.push({type:'rest',dur:c.rest,round:r,cycle:cy});
      }
      if(cy<c.cycles && c.setrest>0) segs.push({type:'setrest',dur:c.setrest,round:c.rounds,cycle:cy});
    }
    if(c.cool>0) segs.push({type:'cool',dur:c.cool,round:c.rounds,cycle:c.cycles});
    let t=0; segs.forEach(s=>{s.start=t;t+=s.dur;}); return segs;
  }
  const totalOf = segs => segs.reduce((a,s)=>a+s.dur,0);
  function applyColors(timer) { for(const [key,color] of Object.entries(timer.colors)) document.documentElement.style.setProperty('--'+key,color); }
  function paintStrip(el,segs) {
    el.replaceChildren(...segs.map(s=>{const span=document.createElement('span');span.style.flex=String(s.dur/(totalOf(segs)||1));span.style.background=TYPES[s.type].color;return span;}));
  }
  function button(label,action,className='btn2') {
    const b=document.createElement('button'); b.type='button'; b.className=className;b.textContent=label;b.addEventListener('click',action); return b;
  }
  function persist(next) {
    timers=next;
    $('storageNote').textContent=store.set('tt.timers.v2',timers)?'':'저장 공간을 사용할 수 없어요. 이 화면을 닫으면 변경 사항이 사라질 수 있어요.';
    renderHome();
  }
  let menuReturn = null;
  function renderHome() {
    $('timers').replaceChildren(...timers.map(timer=>{
      const card=document.createElement('article');card.className='timer-card';card.style.setProperty('--timer-color',timer.colors.work);
      const launch=button('',()=>{active=D.timer(timer);cfg=active.v;start();},'timer-launch');
      const duration=document.createElement('span');duration.className='timer-duration num';duration.textContent=fmt(totalOf(build(timer.v,timer.skipLast))).padStart(5,'0');
      const name=document.createElement('strong');name.textContent=timer.name;launch.append(duration,name);
      const menu=button('⋯',()=>openMenu(timer,menu),'timer-menu');menu.setAttribute('aria-label',timer.name+' 메뉴'); menu.setAttribute('aria-haspopup','dialog');
      card.append(launch,menu);return card;
    }));
    $('empty').hidden=timers.length>0;
  }
  function openMenu(timer,origin) {
    menuReturn=origin; $('menuTitle').textContent=timer.name;
    const actions=$('menuActions');actions.replaceChildren(
      button('편집',()=>{$('timerMenu').close();openEditor(timer);}),
      button('복제',()=>{persist(D.duplicate(timers,timer.id));$('timerMenu').close();}),
      button('삭제',()=>{
        $('menuTitle').textContent='이 타이머를 삭제할까요?';
        actions.replaceChildren(button('취소',()=>$('timerMenu').close()),button('삭제',()=>{persist(D.remove(timers,timer.id));$('timerMenu').close();},'btn2 danger'));
      },'btn2 danger')
    );$('timerMenu').showModal();
  }
  $('timerMenu').addEventListener('close',()=>{if(menuReturn?.isConnected) menuReturn.focus();else $('newTimer').focus();});
  $('closeMenu').addEventListener('click',()=>$('timerMenu').close());
  function openEditor(timer) {
    draft=D.timer(timer);$('timerName').value=draft.name;$('optSkipLast').checked=draft.skipLast;
    $('setup').hidden=true;$('editor').hidden=false;renderRows();$('timerName').focus();
  }
  function closeEditor() { $('editor').hidden=true;$('setup').hidden=false;draft=null;$('newTimer').focus(); }
  $('cancelEditor').addEventListener('click',closeEditor);
  $('saveTimer').addEventListener('click',()=>{
    if(!$('timerName').value.trim()) {$('timerName').focus();return;}
    draft.name=$('timerName').value.trim();draft.skipLast=$('optSkipLast').checked;
    persist(D.save(timers,draft));closeEditor();
  });
  $('newTimer').addEventListener('click',()=>{
    $('templateChoices').replaceChildren(button('새 타이머',()=>{$('newSheet').close();openEditor();}),...D.BUILTIN.map(p=>button(p.name,()=>{$('newSheet').close();openEditor(p);})));
    $('newSheet').showModal();
  });
  $('closeNew').addEventListener('click',()=>$('newSheet').close());
  function renderRows() {
    $('rows').replaceChildren(...FIELDS.filter(f=>f.key!=='setrest'||draft.optional.cycles).map(f=>{
      const optional=f.key==='cycles'||f.key==='cool';
      const absent=optional&&!draft.optional[f.key];
      const row=button('',()=>{if(absent){draft=D.optional(draft,f.key,true);renderRows();}else openPicker(f);},'edit-row'+(absent?' optional-row':''));
      const phase=draft.colors[f.key]||draft.colors[f.key==='rounds'?'work':'setrest'];
      row.style.setProperty('--row-color',phase);
      const title=document.createElement('span');title.className='row-label';
      const name=document.createElement('strong');name.textContent=f.name;
      const hint=document.createElement('small');hint.textContent=f.hint;title.append(name,hint);
      const value=document.createElement('span');value.className='row-value num';value.textContent=absent?'+':f.time?displayTime(draft.v[f.key]):draft.v[f.key];
      const chevron=document.createElement('span');chevron.className='chevron';chevron.textContent=absent?'':'›';
      row.append(title,value,chevron);return row;
    }));
    $('editorTotal').textContent='총 '+fmt(totalOf(build(draft.v,$('optSkipLast').checked)));
  }
  $('optSkipLast').addEventListener('change',renderRows);
  function openPicker(field) {
    picker={field,value:D.clamp(field.key,draft.v[field.key]),color:draft.colors[field.key]};
    $('pickerTitle').textContent=field.name;$('editor').hidden=true;$('picker').hidden=false;
    const removeKey=['cycles','setrest'].includes(field.key)?'cycles':field.key==='cool'?'cool':null;
    $('removePhase').hidden=!removeKey;$('removePhase').textContent=(removeKey==='cycles'?'사이클':field.name)+' 삭제';
    $('phaseColors').hidden=!field.time;
    $('phaseColors').replaceChildren(...D.COLORS.map((color,i)=>{
      const dot=button('',()=>{picker.color=color;refreshDots();},'color-dot');dot.style.background=color;dot.dataset.color=color;dot.setAttribute('aria-label',['빨강','주황','호박','초록','파랑','보라'][i]);return dot;
    }));refreshDots();
    const wheels=$('wheels');wheels.replaceChildren();
    if(field.time) {
      let minutes,seconds;
      const update=value=>{picker.value=D.clamp(field.key,value);if(picker.value!==value){minutes?.(Math.floor(picker.value/60));seconds?.(picker.value%60);}};
      minutes=makeWheel('MIN',0,Math.floor(D.clamp(field.key,Number.MAX_SAFE_INTEGER)/60),Math.floor(picker.value/60),v=>update(v*60+picker.value%60));
      seconds=makeWheel('SEC',0,59,picker.value%60,v=>update(Math.floor(picker.value/60)*60+v));
    }
    else makeWheel(field.name,1,field.key==='cycles'?20:99,picker.value,v=>{picker.value=v;});
    $('cancelPicker').focus();
  }
  function refreshDots() { for(const dot of $('phaseColors').children) dot.setAttribute('aria-pressed',String(dot.dataset.color===picker.color)); }
  function makeWheel(label,min,max,initial,onChange) {
    const wrap=document.createElement('div');wrap.className='wheel-column';
    const caption=document.createElement('span');caption.textContent=label;caption.className='wheel-caption';
    const wheel=document.createElement('div');wheel.className='wheel';wheel.tabIndex=0;wheel.setAttribute('role','spinbutton');wheel.setAttribute('aria-label',label);wheel.setAttribute('aria-valuemin',min);wheel.setAttribute('aria-valuemax',max);
    let selected=initial;
    const select=value=>{selected=Math.min(max,Math.max(min,value));wheel.setAttribute('aria-valuenow',selected);onChange(selected);for(const option of wheel.children) option.classList.toggle('selected',Number(option.dataset.value)===selected);};
    const go=value=>{select(value);wheel.scrollTo({top:(selected-min)*64,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
    for(let value=min;value<=max;value++) {const option=button(String(value).padStart(2,'0'),()=>go(value),'wheel-number');option.tabIndex=-1;option.dataset.value=value;wheel.append(option);}
    wheel.addEventListener('scroll',()=>select(min+Math.round(wheel.scrollTop/64)),{passive:true});
    wheel.addEventListener('keydown',e=>{
      const next={ArrowUp:selected-1,ArrowDown:selected+1,ArrowLeft:selected-1,ArrowRight:selected+1,Home:min,End:max,PageUp:selected-5,PageDown:selected+5}[e.key];
      if(next!==undefined){e.preventDefault();go(next);}
    });
    wrap.append(caption,wheel);$('wheels').append(wrap);select(initial);wheel.scrollTop=(initial-min)*64;
    return value=>{selected=value;wheel.setAttribute('aria-valuenow',selected);for(const option of wheel.children) option.classList.toggle('selected',Number(option.dataset.value)===selected);if(wheel.scrollTop!==(selected-min)*64)wheel.scrollTop=(selected-min)*64;};
  }
  function closePicker() {$('picker').hidden=true;$('editor').hidden=false;picker=null;renderRows();$('rows').querySelector('button')?.focus();}
  $('cancelPicker').addEventListener('click',closePicker);
  $('savePicker').addEventListener('click',()=>{draft.v[picker.field.key]=D.clamp(picker.field.key,picker.value);if(picker.color)draft.colors[picker.field.key]=picker.color;closePicker();});
  $('removePhase').addEventListener('click',()=>{draft=D.optional(draft,['cycles','setrest'].includes(picker.field.key)?'cycles':'cool',false);closePicker();});
  [['optBeep','beep'],['optVoice','voice'],['optVibe','vibe']].forEach(([id,key])=>{const el=$(id);el.checked=!!opts[key];el.addEventListener('change',()=>{opts[key]=el.checked;store.set('tt.opts',opts);});});
  // ---------- sound ----------
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function unlockAudio() {
    const a = audio();
    if (!a) return;
    try {
      const source = a.createBufferSource();
      source.buffer = a.createBuffer(1, 1, a.sampleRate);
      source.connect(a.destination);
      source.start(0);
    } catch {}
  }
  function tone(freq, dur, when = 0, vol = 0.32) {
    if (!opts.beep) return;
    const a = audio(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function say(text) {
    if (!opts.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch {}
  }
  function vibe(p) { if (opts.vibe && navigator.vibrate) { try { navigator.vibrate(p); } catch {} } }

  // ---------- run engine (time is derived from a monotonic clock, never decremented) ----------
  let segs = [], total = 0, startedAt = 0, pausedAt = 0, offset = 0, running = false, finished = false;
  let lastIdx = -1, lastWhole = -1, raf = 0, iv = 0, wake = null;

  const now = () => performance.now() / 1000;
  const elapsed = () => Math.min(total, (running ? now() - startedAt : pausedAt - startedAt) + offset);

  function locate(t) {
    for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].start) return i;
    return 0;
  }

  let wakePending = false;
  const wantsWake = () => document.visibilityState === 'visible';
  function releaseWake() {
    const lock = wake;
    wake = null;
    if (lock) { try { Promise.resolve(lock.release()).catch(() => {}); } catch {} }
  }
  async function keepAwake() {
    if (!wantsWake() || !('wakeLock' in navigator) || wake || wakePending) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // A request can resolve after the user leaves the page.
      if (!wantsWake()) { await lock.release(); return; }
      wake = lock;
      lock.addEventListener('release', () => {
        if (wake === lock) wake = null;
        if (wantsWake()) setTimeout(keepAwake, 1000);
      });
    } catch {} finally { wakePending = false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { keepAwake(); tick(); }
    else releaseWake();
  });

  function start() {
    applyColors(active);
    segs = build(cfg, active.skipLast); total = totalOf(segs);
    if (!total) return;
    unlockAudio();
    offset = 0; startedAt = now(); running = true; finished = false; lastIdx = -1; lastWhole = -1;
    $('setup').hidden = true; $('run').hidden = false;
    $('run').classList.remove('paused');
    paintStrip($('rStrip'), segs);
    $('pauseBtn').textContent = '일시정지';
    restoreRunBody();
    keepAwake();
    loop();
    clearInterval(iv); iv = setInterval(tick, 200);
  }

  function loop() { tick(); if (!finished && !$('run').hidden) raf = requestAnimationFrame(loop); }

  function tick() {
    if ($('run').hidden || finished) return;
    const t = elapsed();
    if (t >= total) { finish(); return; }
    const i = locate(t), s = segs[i];
    const left = s.start + s.dur - t;
    const whole = Math.ceil(left);
    if (i !== lastIdx) { enter(i); lastIdx = i; lastWhole = whole; }
    else if (running && whole !== lastWhole) {
      if (whole <= 3 && whole >= 1) { tone(880, 0.12); vibe(60); }
      lastWhole = whole;
    }
    draw(i, s, left, t);
  }

  function enter(i) {
    const s = segs[i], ty = TYPES[s.type];
    $('run').style.setProperty('--ph', ty.color);
    $('rPhase').textContent = ty.label;
    if (running) {
      tone(s.type === 'work' ? 1320 : 660, 0.45);
      vibe(s.type === 'work' ? [220] : [120, 80, 120]);
      say(ty.voice);
    }
  }

  function draw(i, s, left, t) {
    const whole = Math.ceil(left);
    $('rCount').textContent = whole >= 60 ? fmt(whole) : String(whole);
    $('rSub').textContent = s.type === 'work' || s.type === 'rest' ? `${fmt(s.dur)} 중` : '';
    $('rBar').setAttribute('stroke-dashoffset', String(1000 * (1 - left / s.dur)));
    $('rRound').textContent = s.round ? `라운드 ${s.round}/${cfg.rounds}` : `라운드 0/${cfg.rounds}`;
    $('rCycle').textContent = `사이클 ${s.cycle}/${cfg.cycles}`;
    $('rCycle').hidden = cfg.cycles < 2;
    $('rLeft').textContent = `남은 시간 ${fmt(total - t)}`;
    const n = segs[i + 1];
    $('rNext').innerHTML = n ? `다음 <b>${TYPES[n.type].label} ${fmt(n.dur)}</b>` : '다음 <b>완료</b>';
    $('rHead').style.left = (100 * t / total) + '%';
  }

  function togglePause() {
    if (finished) return;
    if (running) { pausedAt = now(); running = false; $('pauseBtn').textContent = '계속'; $('run').classList.add('paused'); say('일시정지'); }
    else { startedAt += now() - pausedAt; running = true; $('pauseBtn').textContent = '일시정지'; $('run').classList.remove('paused'); unlockAudio(); keepAwake(); }
  }

  function jump(dir) {
    if (finished) return;
    const t = elapsed(), i = locate(t);
    let target;
    if (dir > 0) target = i + 1 < segs.length ? segs[i + 1].start : total;
    else target = (t - segs[i].start > 2 || i === 0) ? segs[i].start : segs[i - 1].start;
    const base = running ? now() - startedAt : pausedAt - startedAt;
    offset = target - base + 0.0001;
    lastIdx = -1;
    tick();
  }

  function finish() {
    finished = true; running = false;
    cancelAnimationFrame(raf); clearInterval(iv);
    tone(988, 0.18); tone(1319, 0.5, 0.2); vibe([200, 100, 200, 100, 400]); say('완료');
    $('run').style.setProperty('--ph', 'var(--accent)');
    $('rCenter').innerHTML = `<div class="donebox"><h2>완료</h2><p class="num">총 ${fmt(total)} · ${segs.filter(s => s.type === 'work').length}번 운동</p></div>`;
    $('rHead').style.left = '100%';
    $('rLeft').textContent = '남은 시간 0:00';
    $('pauseBtn').textContent = '다시 시작';
  }

  const runBodyHTML = $('rCenter').innerHTML;
  function restoreRunBody() {
    if (!$('rBar')) $('rCenter').innerHTML = runBodyHTML;
  }

  function stop() {
    cancelAnimationFrame(raf); clearInterval(iv);
    running = false; finished = false;
    try { speechSynthesis.cancel(); } catch {}
    $('run').hidden = true; $('setup').hidden = false;
    renderHome();
  }

  $('pauseBtn').addEventListener('click', () => { if (finished) start(); else togglePause(); });
  $('prevBtn').addEventListener('click', () => jump(-1));
  $('nextBtn').addEventListener('click', () => jump(1));
  const stopBtn = $('stopBtn');
  stopBtn.addEventListener('click', () => {
    if (finished || stopBtn.classList.contains('armed')) { stopBtn.classList.remove('armed'); stopBtn.textContent = '종료'; stop(); return; }
    stopBtn.classList.add('armed'); stopBtn.textContent = '한 번 더 누르면 종료';
    setTimeout(() => { stopBtn.classList.remove('armed'); stopBtn.textContent = '종료'; }, 2500);
  });
  document.addEventListener('keydown', e => {
    if ($('run').hidden) return;
    if (e.key === ' ') { e.preventDefault(); if (finished) start(); else togglePause(); }
    else if (e.key === 'ArrowRight') jump(1);
    else if (e.key === 'ArrowLeft') jump(-1);
  });


  $('openInfo').addEventListener('click', () => $('settings').showModal());
  $('closeInfo').addEventListener('click', () => $('settings').close());
  function copyContactId(button){
  const text='KaliDCerona';
  const finish=ok=>{button.textContent=ok?'복사됨':'ID 복사';if(ok)setTimeout(()=>{if(button.textContent==='복사됨')button.textContent='ID 복사';},1500);};
  const fallback=()=>{try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-999px';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;}catch{return false;}};
  const clip=navigator.clipboard;
  if(clip&&typeof clip.writeText==='function'){clip.writeText(text).then(()=>finish(true),()=>finish(fallback()));return;}
  finish(fallback());
}

  $('contact-copy').addEventListener('click', () => copyContactId($('contact-copy')));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

  renderHome();
  keepAwake();
})();
