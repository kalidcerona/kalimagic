    import { MAX_DISPLAY_MS, TRICK_STORAGE_KEY, stopwatchDigits, trickStopMs } from './logic.js';
    import { installSettingsSwipe } from './settings-swipe.js';
    import { wakeLock, acquireWakeLock } from './wake-lock.js';
    const TUTORIAL_KEY = 'gwayubulgeup-settings-entry-tutorial-v1';
    const $ = (id) => document.getElementById(id);
    const pControl = $('p-control');
    const pLap = $('p-lap');
    const pLapRows = $('p-lap-rows');
    const pWorld = $('p-world');
    const settings = $('settings');
    const tutorial = $('settings-entry-tutorial');
    const digitNodes = [...document.querySelectorAll('[data-p-minute], [data-p-digit]')];
    let state = 'idle';
    let trickOn = false;
    let startedAt = 0;
    let elapsedBase = 0;
    let frameId = 0;
    let lapCount = 0;
    let lastLapElapsed = 0;

    function paint(ms) {
      const digits = stopwatchDigits(ms);
      digitNodes.forEach((node, index) => { node.textContent = digits[index]; });
    }
    function clockText(ms) {
      const digits = stopwatchDigits(ms);
      return digits.slice(0, 2) + ':' + digits.slice(2, 4) + '.' + digits.slice(4, 6);
    }
    function elapsedNow() {
      if (state !== 'running') return elapsedBase;
      return Math.min(MAX_DISPLAY_MS, Math.max(0, elapsedBase + performance.now() - startedAt));
    }
    function renderChrome() {
      pControl.textContent = state === 'running' ? '중단' : '시작';
      pControl.classList.toggle('running', state === 'running');
      pLap.textContent = state === 'stopped' && elapsedBase > 0 ? '재설정' : '랩';
      pLap.disabled = state !== 'running' && elapsedBase === 0;
    }
    function setTrick(on) {
      trickOn = !!on;
      if (trickOn) document.documentElement.setAttribute('data-gwayu-trick', 'on');
      else document.documentElement.removeAttribute('data-gwayu-trick');
      try { localStorage.setItem(TRICK_STORAGE_KEY, trickOn ? '1' : '0'); } catch (error) {}
    }
    function tick() {
      if (state !== 'running') return;
      const elapsed = elapsedNow();
      if (elapsed >= MAX_DISPLAY_MS) { stopTimer(); return; }
      paint(elapsed);
      frameId = requestAnimationFrame(tick);
    }
    function startTimer() {
      if (elapsedBase >= MAX_DISPLAY_MS) return;
      startedAt = performance.now();
      state = 'running';
      paint(elapsedBase);
      renderChrome();
      tick();
    }
    function stopTimer() {
      elapsedBase = trickStopMs(elapsedNow(), trickOn, lastLapElapsed);
      cancelAnimationFrame(frameId);
      frameId = 0;
      state = 'stopped';
      paint(elapsedBase);
      renderChrome();
    }
    function resetTimer() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      state = 'idle';
      elapsedBase = 0;
      lapCount = 0;
      lastLapElapsed = 0;
      pLapRows.replaceChildren();
      paint(0);
      renderChrome();
    }
    function addLap() {
      const elapsed = elapsedNow();
      const split = elapsed - lastLapElapsed;
      lastLapElapsed = elapsed;
      const row = document.createElement('div');
      const label = document.createElement('span');
      const value = document.createElement('span');
      row.className = 'lap-row';
      label.textContent = '랩 ' + (++lapCount);
      value.textContent = clockText(split);
      row.append(label, value);
      pLapRows.prepend(row);
    }
    function openSettings() {
      if (state === 'running' || !settings.hidden) return;
      tutorial.hidden = true;
      settings.hidden = false;
      settings.scrollTop = 0;
    }
    function closeSettings() { settings.hidden = true; }
    function showTutorial() {
      if (!tutorial.hidden) return;
      try { if (localStorage.getItem(TUTORIAL_KEY) === '1') return; } catch (error) {}
      tutorial.hidden = false;
    }
    tutorial.addEventListener('pointerdown', (event) => {
      if (event.target.closest('#settings-entry-tutorial-dismiss')) return;
      event.preventDefault();
      event.stopPropagation();
    });
    $('settings-entry-tutorial-dismiss').addEventListener('click', () => {
      try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (error) {}
      tutorial.hidden = true;
    });
    try { trickOn = localStorage.getItem(TRICK_STORAGE_KEY) === '1'; } catch (error) { trickOn = false; }
    setTrick(trickOn);
    installSettingsSwipe(openSettings, () => tutorial.hidden && state !== 'running' && settings.hidden);
    pControl.addEventListener('click', () => { if (state === 'running') stopTimer(); else startTimer(); });
    pLap.addEventListener('click', () => { if (state === 'running') addLap(); else resetTimer(); });
    pWorld.addEventListener('click', (event) => { event.preventDefault(); setTrick(!trickOn); });
    $('settings-close').addEventListener('click', closeSettings);
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerdown', () => { if (!wakeLock) acquireWakeLock(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) acquireWakeLock(); });
    paint(0);
    renderChrome();
    showTutorial();
    acquireWakeLock();
