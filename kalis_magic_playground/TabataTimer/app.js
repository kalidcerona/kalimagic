(() => {
  const TYPES = {
    prep:    { label: '준비',        color: 'var(--prep)',    voice: '준비' },
    work:    { label: '운동',        color: 'var(--work)',    voice: '운동' },
    rest:    { label: '휴식',        color: 'var(--rest)',    voice: '휴식' },
    setrest: { label: '사이클 휴식', color: 'var(--setrest)', voice: '사이클 휴식' },
    cool:    { label: '쿨다운',      color: 'var(--cool)',    voice: '쿨다운' },
  };
  const FIELDS = [
    { key: 'prep',    type: 'prep',    name: '준비',           hint: '시작 전 자리 잡는 시간', time: true,  step: 5, min: 0,  max: 600 },
    { key: 'work',    type: 'work',    name: '운동',           hint: '한 라운드의 운동 시간',   time: true,  step: 5, min: 5,  max: 3600 },
    { key: 'rest',    type: 'rest',    name: '휴식',           hint: '라운드 사이 쉬는 시간',   time: true,  step: 5, min: 0,  max: 3600 },
    { key: 'rounds',  type: 'work',    name: '라운드',         hint: '운동과 휴식을 몇 번',     time: false, step: 1, min: 1,  max: 99 },
    { key: 'cycles',  type: 'setrest', name: '사이클',         hint: '라운드 묶음을 몇 번',     time: false, step: 1, min: 1,  max: 20 },
    { key: 'setrest', type: 'setrest', name: '사이클 사이 휴식', hint: '사이클이 끝날 때마다',   time: true,  step: 15, min: 0, max: 1800 },
    { key: 'cool',    type: 'cool',    name: '쿨다운',         hint: '마무리 스트레칭',         time: true,  step: 15, min: 0, max: 1800 },
  ];
  const BUILTIN = [
    { name: '타바타 20/10',  v: { prep: 10, work: 20, rest: 10, rounds: 8,  cycles: 1, setrest: 60, cool: 0 } },
    { name: '타바타 4세트',  v: { prep: 10, work: 20, rest: 10, rounds: 8,  cycles: 4, setrest: 60, cool: 120 } },
    { name: 'HIIT 40/20',    v: { prep: 10, work: 40, rest: 20, rounds: 10, cycles: 1, setrest: 60, cool: 60 } },
    { name: '서킷 45/15',    v: { prep: 15, work: 45, rest: 15, rounds: 6,  cycles: 3, setrest: 90, cool: 120 } },
    { name: '매분 1분',      v: { prep: 10, work: 60, rest: 0,  rounds: 10, cycles: 1, setrest: 60, cool: 0 } },
  ];

  const store = {
    get(k, d) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };

  let cfg = Object.assign({}, BUILTIN[0].v, store.get('tt.cfg', {}));
  let opts = Object.assign({ beep: true, voice: true, vibe: true, skipLast: true }, store.get('tt.opts', {}));
  let mine = store.get('tt.mine', []);
  if (!Array.isArray(mine)) mine = [];

  const $ = (id) => document.getElementById(id);
  const fmt = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return m + ':' + String(r).padStart(2, '0'); };
  const parseTime = (t) => {
    t = String(t).trim();
    if (/^\d+:\d{1,2}$/.test(t)) { const [m, s] = t.split(':').map(Number); return m * 60 + s; }
    if (/^\d+$/.test(t)) return Number(t);
    return NaN;
  };

  // ---------- segments ----------
  function build(c) {
    const segs = [];
    if (c.prep > 0) segs.push({ type: 'prep', dur: c.prep, round: 0, cycle: 1 });
    for (let cy = 1; cy <= c.cycles; cy++) {
      for (let r = 1; r <= c.rounds; r++) {
        segs.push({ type: 'work', dur: c.work, round: r, cycle: cy });
        const last = r === c.rounds;
        if (c.rest > 0 && !(last && opts.skipLast)) segs.push({ type: 'rest', dur: c.rest, round: r, cycle: cy });
      }
      if (cy < c.cycles && c.setrest > 0) segs.push({ type: 'setrest', dur: c.setrest, round: c.rounds, cycle: cy });
    }
    if (c.cool > 0) segs.push({ type: 'cool', dur: c.cool, round: c.rounds, cycle: c.cycles });
    let t = 0; segs.forEach(s => { s.start = t; t += s.dur; });
    return segs;
  }
  const totalOf = (segs) => segs.reduce((a, s) => a + s.dur, 0);

  function paintStrip(el, segs) {
    const total = totalOf(segs) || 1;
    el.replaceChildren(...segs.map(s => {
      const sp = document.createElement('span');
      sp.style.flex = String(s.dur / total);
      sp.style.background = TYPES[s.type].color;
      return sp;
    }));
  }

  // ---------- setup view ----------
  function renderRows() {
    const rows = $('rows');
    rows.replaceChildren();
    FIELDS.forEach(f => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <span class="dot" style="background:${TYPES[f.type].color}"></span>
        <div><div class="name">${f.name}</div><div class="hint">${f.hint}</div></div>
        <div class="stepper">
          <button type="button" aria-label="${f.name} 줄이기">−</button>
          <input class="val" id="v-${f.key}" inputmode="${f.time ? 'text' : 'numeric'}" aria-label="${f.name}" autocomplete="off">
          <button type="button" aria-label="${f.name} 늘리기">+</button>
        </div>`;
      const [minus, plus] = row.querySelectorAll('button');
      const input = row.querySelector('input');
      const show = () => { input.value = f.time ? fmt(cfg[f.key]) : String(cfg[f.key]); };
      const setVal = (v) => { cfg[f.key] = Math.min(f.max, Math.max(f.min, v)); show(); changed(); };
      holdRepeat(minus, () => setVal(cfg[f.key] - f.step));
      holdRepeat(plus, () => setVal(cfg[f.key] + f.step));
      input.addEventListener('focus', () => input.select());
      input.addEventListener('change', () => {
        const v = f.time ? parseTime(input.value) : parseInt(input.value, 10);
        if (Number.isFinite(v)) setVal(v); else show();
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
      show();
      rows.append(row);
    });
  }

  function holdRepeat(btn, fn) {
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); fn();
      t1 = setTimeout(() => { t2 = setInterval(fn, 90); }, 420);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }

  function renderPresets() {
    const box = $('presets');
    box.replaceChildren();
    const all = BUILTIN.map(p => ({ ...p, own: false })).concat(mine.map(p => ({ ...p, own: true })));
    all.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.name;
      b.setAttribute('aria-pressed', String(FIELDS.every(f => p.v[f.key] === cfg[f.key])));
      b.addEventListener('click', () => { cfg = Object.assign({}, p.v); renderRows(); changed(); });
      box.append(b);
    });
    if (mine.length) {
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'chip ghost'; del.textContent = '내 프리셋 지우기';
      del.addEventListener('click', () => {
        if (del.dataset.armed) { mine = []; store.set('tt.mine', mine); renderPresets(); return; }
        del.dataset.armed = '1'; del.textContent = '한 번 더 누르면 지워요';
        setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = '내 프리셋 지우기'; } }, 2500);
      });
      box.append(del);
    }
  }

  function renderLegend(segs) {
    const used = [...new Set(segs.map(s => s.type))];
    $('legend').replaceChildren(...used.map(t => {
      const s = document.createElement('span');
      s.innerHTML = `<i style="background:${TYPES[t].color}"></i>${TYPES[t].label}`;
      return s;
    }));
  }

  function changed() {
    store.set('tt.cfg', cfg);
    const segs = build(cfg);
    $('total').textContent = fmt(totalOf(segs));
    $('segcount').textContent = segs.length;
    paintStrip($('strip'), segs);
    renderLegend(segs);
    renderPresets();
  }

  [['optBeep', 'beep'], ['optVoice', 'voice'], ['optVibe', 'vibe'], ['optSkipLast', 'skipLast']].forEach(([id, k]) => {
    const el = $(id); el.checked = !!opts[k];
    el.addEventListener('change', () => { opts[k] = el.checked; store.set('tt.opts', opts); changed(); });
  });

  $('savePreset').addEventListener('click', () => {
    const name = $('presetName').value.trim();
    if (!name) { $('mineNote').textContent = '프리셋 이름을 적어 주세요.'; $('presetName').focus(); return; }
    mine = mine.filter(p => p.name !== name).concat([{ name, v: Object.assign({}, cfg) }]).slice(-8);
    const ok = store.set('tt.mine', mine);
    $('mineNote').textContent = ok ? `"${name}" 저장했어요. 위쪽 목록에서 고를 수 있어요.` : '이 브라우저에서는 저장할 수 없어요. 지금 화면에서는 그대로 쓸 수 있어요.';
    $('presetName').value = '';
    renderPresets();
  });

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
  const wantsWake = () => running && !finished && document.visibilityState === 'visible';
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
      // A request can resolve after the user pauses, stops or leaves the page.
      if (!wantsWake()) { await lock.release(); return; }
      wake = lock;
      lock.addEventListener('release', () => { if (wake === lock) wake = null; });
    } catch {} finally { wakePending = false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { keepAwake(); tick(); }
    else releaseWake();
  });

  function start() {
    segs = build(cfg); total = totalOf(segs);
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
    if (running) { pausedAt = now(); running = false; releaseWake(); $('pauseBtn').textContent = '계속'; $('run').classList.add('paused'); say('일시정지'); }
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
    releaseWake();
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
    releaseWake();
    $('run').hidden = true; $('setup').hidden = false;
  }

  $('startBtn').addEventListener('click', start);
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

  renderRows();
  changed();
})();
