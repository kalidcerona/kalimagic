// Session-only camera controls and deterministic state transitions.
export const initialControls = () => ({ mode: 'photo', recording: false, started: 0, album: [], index: -1, gallery: false });
export function controlState(state, action) {
  switch (action.type) {
    case 'mode': return { ...state, mode: action.mode, recording: false, started: 0 };
    case 'shutter': return state.mode === 'video' ? { ...state, recording: !state.recording, started: state.recording ? 0 : action.now } : state;
    case 'capture': {
      const album = [...state.album, action.url].slice(-20);
      return { ...state, album, index: album.length - 1 };
    }
    case 'open': return { ...state, gallery: true, recording: false, index: state.album.length - 1 };
    case 'close': return { ...state, gallery: false };
    case 'step': return { ...state, index: state.album.length ? (state.index + action.delta + state.album.length) % state.album.length : -1 };
    case 'stop': return { ...state, recording: false, started: 0 };
    default: return state;
  }
}
export function timerLabel(started, now) {
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// One pending retry, exponential spacing, and a bounded burst. A healthy feed or
// a new visible session resets the budget; repeated dead tracks cannot spin.
export function createCameraRecovery({ restart, wanted, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let timer = null, attempts = 0, last = -Infinity;
  const clear = () => { if (timer !== null) cancel(timer); timer = null; };
  return {
    ended() {
      if (timer !== null || !wanted()) return;
      if (now() - last >= 30000) attempts = 0;
      if (attempts >= 5) return;
      const delay = attempts ? Math.max(0, Math.min(16000, 2000 * 2 ** (attempts - 1)) - (now() - last)) : 0;
      timer = schedule(() => {
        timer = null;
        if (!wanted()) return;
        attempts++; last = now(); restart();
      }, delay);
    },
    reset() { clear(); attempts = 0; last = -Infinity; },
    cancel: clear
  };
}

export function mountCameraControls({ $, switchCamera, isMirrored }) {
  let state = initialControls(), capturing = false, disposed = false, tick = null;
  const shutter = $('shutter'), gallery = $('gallery'), more = $('moreModes');
  const modes = [...document.querySelectorAll('[data-mode]')];
  const dispatch = (action) => { state = controlState(state, action); render(); };
  function render() {
    modes.forEach((b) => { const on = b.dataset.mode === state.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    shutter.classList.toggle('video-mode', state.mode === 'video');
    shutter.classList.toggle('recording', state.recording);
    shutter.setAttribute('aria-label', state.mode === 'video' ? (state.recording ? '촬영 중지' : '동영상 촬영') : '촬영');
    $('recordTimer').hidden = !state.recording;
    $('recordTimer').textContent = timerLabel(state.started, performance.now());
    if (tick !== null) clearInterval(tick);
    tick = state.recording ? setInterval(() => { $('recordTimer').textContent = timerLabel(state.started, performance.now()); }, 250) : null;
    gallery.hidden = !state.gallery;
    $('galleryImage').hidden = state.index < 0;
    $('galleryEmpty').hidden = state.album.length > 0;
    if (state.index >= 0) $('galleryImage').src = state.album[state.index];
    else $('galleryImage').removeAttribute('src');
    $('galleryCount').textContent = state.album.length ? `${state.index + 1} / ${state.album.length}` : '';
    $('galleryPrev').disabled = $('galleryNext').disabled = state.album.length < 2;
    const latest = state.album.at(-1);
    $('album').style.backgroundImage = latest ? `url("${latest}")` : '';
  }
  async function capture() {
    if (capturing || disposed) return;
    const video = $('video');
    if (video.readyState < 2 || !video.videoWidth) return;
    capturing = true;
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (isMirrored()) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob || disposed) return;
      const url = URL.createObjectURL(blob);
      const evicted = state.album.length === 20 ? state.album[0] : null;
      dispatch({ type: 'capture', url });
      if (evicted) URL.revokeObjectURL(evicted);
    } catch { /* Camera interruptions stay silent on the performance screen. */ }
    finally { capturing = false; }
  }
  shutter.addEventListener('click', () => {
    if (state.mode === 'video') { dispatch({ type: 'shutter', now: performance.now() }); return; }
    const flash = $('flash');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    capture();
  });
  $('switchCamera').addEventListener('click', async () => {
    const button = $('switchCamera');
    if (button.disabled) return;
    dispatch({ type: 'stop' });
    button.disabled = true;
    $('vf').classList.add('flipping');
    try { await switchCamera(); }
    finally { setTimeout(() => { $('vf').classList.remove('flipping'); button.disabled = false; }, 180); }
  });
  modes.forEach((button) => button.addEventListener('click', () => {
    dispatch({ type: 'mode', mode: button.dataset.mode });
    more.hidden = state.mode !== 'more';
  }));
  more.addEventListener('click', (event) => {
    if (event.target.closest('[data-extra]') || event.target === more) {
      more.hidden = true;
      dispatch({ type: 'mode', mode: 'photo' });
    }
  });
  $('album').addEventListener('click', () => { dispatch({ type: 'open' }); $('galleryClose').focus(); });
  const close = () => { dispatch({ type: 'close' }); $('album').focus(); };
  $('galleryClose').addEventListener('click', close);
  $('galleryPrev').addEventListener('click', () => dispatch({ type: 'step', delta: -1 }));
  $('galleryNext').addEventListener('click', () => dispatch({ type: 'step', delta: 1 }));
  $('galleryFrame').addEventListener('click', () => { if (!suppressClick) dispatch({ type: 'step', delta: 1 }); });
  let origin = null, suppressClick = false;
  gallery.addEventListener('touchstart', (event) => {
    suppressClick = false;
    const t = event.touches[0]; origin = event.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  gallery.addEventListener('touchend', (event) => {
    if (!origin) return;
    const t = event.changedTouches[0];
    const delta = document.body.classList.contains('landscape') ? origin.y - t.clientY : t.clientX - origin.x;
    if (Math.abs(delta) > 35) { suppressClick = true; dispatch({ type: 'step', delta: delta < 0 ? 1 : -1 }); }
    origin = null;
  }, { passive: true });
  gallery.addEventListener('touchcancel', () => { origin = null; }, { passive: true });
  gallery.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') dispatch({ type: 'step', delta: event.key === 'ArrowLeft' ? -1 : 1 });
    if (event.key === 'Tab') {
      const buttons = [...gallery.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
  // Touches on spectator controls never reach the two-finger settings gesture.
  for (const el of [shutter, $('switchCamera'), $('album'), gallery, more, ...modes]) {
    for (const name of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) el.addEventListener(name, (event) => event.stopPropagation(), { passive: true });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') dispatch({ type: 'stop' }); });
  window.addEventListener('pagehide', (event) => {
    dispatch({ type: 'stop' });
    if (event.persisted) return;
    disposed = true;
    state.album.forEach((url) => URL.revokeObjectURL(url));
    state = initialControls(); render();
  });
  render();
}
