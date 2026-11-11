globalThis.TabataRun = function ({ D, $, sound, keepAwake, renderHome }) {
  const { TYPES, fmt, build, totalOf, applyColors, paintStrip } = TabataView;
  const { unlockAudio, tone, say, vibe } = sound;
  let active = D.timer(), cfg = active.v;
  // ---------- run engine (time is derived from a monotonic clock, never decremented) ----------
  let segs = [], total = 0, startedAt = 0, pausedAt = 0, offset = 0, running = false, finished = false, ready = false;
  let lastIdx = -1, lastWhole = -1, raf = 0, iv = 0;

  const now = () => performance.now() / 1000;
  const elapsed = () => Math.min(total, (running ? now() - startedAt : pausedAt - startedAt) + offset);

  function locate(t) {
    for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].start) return i;
    return 0;
  }

  function start() {
    applyColors(active);
    segs = build(cfg, active.skipLast); total = totalOf(segs);
    if (!total) return;
    unlockAudio();
    offset = 0; startedAt = now(); running = true; finished = false; ready = false; lastIdx = -1; lastWhole = -1;
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
    if (t >= total) { if (!ready) finish(); return; }
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

  function paintStill(t) {
    const i = locate(t), s = segs[i], left = s.start + s.dur - t, ty = TYPES[s.type];
    $('run').style.setProperty('--ph', ty.color);
    $('rPhase').textContent = ty.label;
    lastIdx = i; lastWhole = Math.ceil(left);
    draw(i, s, left, t);
  }

  function assignRun(patch) {
    if ('active' in patch) active = patch.active;
    if ('cfg' in patch) cfg = patch.cfg;
    if ('segs' in patch) segs = patch.segs;
    if ('total' in patch) total = patch.total;
    offset = patch.offset; startedAt = patch.startedAt; pausedAt = patch.pausedAt;
    running = patch.running; finished = patch.finished; ready = patch.ready;
    lastIdx = patch.lastIdx; lastWhole = patch.lastWhole;
  }

  const readySession = {
    clone: timer => D.timer(timer), segments: build, total: totalOf, applyColors, assign: assignRun,
    cancelLoops() { cancelAnimationFrame(raf); clearInterval(iv); },
    showRun() { $('setup').hidden = true; $('run').hidden = false; $('run').classList.remove('paused'); },
    setPlayLabel(text) { $('pauseBtn').textContent = text; }, restoreBody: restoreRunBody,
    paintSegments() { paintStrip($('rStrip'), segs); }, keepAwake, paintAt: paintStill, isReady: () => ready, elapsed, unlockAudio,
    clearPaused() { $('run').classList.remove('paused'); },
    startLoops() { loop(); clearInterval(iv); iv = setInterval(tick, 200); }
  };

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
    if (TabataReady.beginReady(readySession, now())) return;
    if (running) { pausedAt = now(); running = false; ready = false; $('pauseBtn').textContent = '계속'; $('run').classList.add('paused'); say('일시정지'); }
    else { startedAt += now() - pausedAt; running = true; $('pauseBtn').textContent = '일시정지'; $('run').classList.remove('paused'); unlockAudio(); keepAwake(); }
  }

  function jump(dir) {
    if (finished) return;
    const t = elapsed(), i = locate(t);
    let target;
    if (dir > 0) target = i + 1 < segs.length ? segs[i + 1].start : (ready ? segs[i].start : total);
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
    running = false; finished = false; ready = false;
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


  return { openReady: timer => TabataReady.openReady(readySession, timer), tick, isRunning: () => running };
};
