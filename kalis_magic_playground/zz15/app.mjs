// URAMICHI web app: stock-camera look-alike scanner with armed presets (port of the Android app).
import * as C from './core.mjs';
import { createPicker, createEditor } from './picker.mjs';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

// ---------- storage (uramichi.web.*; every access may fail in private mode) ----------
const KEY = {
  presets: 'uramichi.web.presets', armed: 'uramichi.web.armed', armMode: 'uramichi.web.armMode',
  recent: 'uramichi.web.recent', settings: 'uramichi.web.settings', intro: 'uramichi.web.intro'
};
function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
function readSettings() {
  try { const s = JSON.parse(read(KEY.settings) || '{}'); return { sameWindow: s?.sameWindow === true }; } catch { return { sameWindow: false }; }
}

const store = {
  cats: C.decodeCategories(read(KEY.presets)) || C.shells(),
  armed: C.decodeArmed(read(KEY.armed)),
  armMode: ['ONCE', 'ALWAYS'].includes(read(KEY.armMode)) ? read(KEY.armMode) : 'ONCE',
  recents: C.decodeRecents(read(KEY.recent)),
  settings: readSettings(),
  setArmed(a) { this.armed = a; write(KEY.armed, a ? C.encodeArmed(a) : null); },
  arm(state, recent) {
    this.setArmed(state);
    this.recents = C.pushRecent(this.recents, recent);
    write(KEY.recent, C.encodeRecents(this.recents));
    try { navigator.vibrate?.(20); } catch { /* no haptics */ }
    closeSettings();
  },
  disarm() { this.setArmed(null); refreshSettings(); },
  setArmMode(mode) {
    this.armMode = mode;
    write(KEY.armMode, mode);
    if (this.armed && this.armed.mode !== 'SEQUENCE') this.setArmed({ ...this.armed, mode });
    refreshSettings();
  },
  saveCategories(list) {
    this.cats = list;
    write(KEY.presets, C.encodeCategories(list));
    this.recents = C.pruneRecents(this.recents, list);
    write(KEY.recent, C.encodeRecents(this.recents));
    picker.render();
  },
  toast(message) {
    const t = $('toast');
    t.textContent = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.textContent = ''; }, 3500);
  },
  ask(title, text, actions) {
    const dialog = $('askDialog');
    $('askTitle').textContent = title;
    $('askText').textContent = text;
    return new Promise((resolve) => {
      $('askActions').replaceChildren(...actions.map(([label, value], i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = i === actions.length - 1 ? 'btn primary' : 'btn2';
        b.textContent = label;
        b.addEventListener('click', () => { dialog.close(); resolve(value); });
        return b;
      }));
      dialog.addEventListener('cancel', () => resolve(actions[0][1]), { once: true });
      dialog.showModal();
    });
  },
  exportPresets() {
    const blob = new Blob([C.encodeCategories(this.cats)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'uramichi-presets.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.toast('프리셋을 내보냈습니다');
  },
  importPresets() { $('importFile').value = ''; $('importFile').click(); }
};
if (read(KEY.presets) === null) write(KEY.presets, C.encodeCategories(store.cats));

$('importFile').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  let text = null;
  try { text = await file.text(); } catch { text = null; }
  const result = C.parseImport(text);
  if (!result.ok) { store.toast(result.message); return; }
  const choice = await store.ask('프리셋 가져오기', `묶음 ${result.categories.length}개를 가져옵니다. 지금 프리셋을 모두 바꿀지, 지금 프리셋에 합칠지 고르세요.`, [['취소', null], ['합치기', 'merge'], ['바꾸기', 'replace']]);
  if (!choice) return;
  store.saveCategories(choice === 'replace' ? result.categories : C.mergeCategories(store.cats, result.categories));
  editor.reload();
  store.toast(choice === 'replace' ? '바꿨습니다' : '합쳤습니다');
});

const picker = createPicker($('picker'), store);
const editor = createEditor($('editor'), $('editorBody'), store);

// ---------- settings dialog ----------
function refreshSettings() { if ($('settings').open) picker.render(); }
function openSettings() {
  if ($('settings').open) return;
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  hideChip(true);
  picker.reset();
  picker.render();
  $('sameWindow').checked = store.settings.sameWindow;
  $('settings').showModal();
  $('settings').scrollTop = 0;
}
function closeSettings() { if ($('settings').open) $('settings').close(); }
$('closeSettings').addEventListener('click', closeSettings);
$('sameWindow').addEventListener('change', (ev) => {
  store.settings = { ...store.settings, sameWindow: ev.target.checked };
  write(KEY.settings, JSON.stringify(store.settings));
});

// ---------- opening a link ----------
const gate = new C.OnceGate(3000);
const opened = [];
function openUrl(url) {
  opened.push(url);
  if (DEBUG && params.get('dry') === '1') return;
  if (store.settings.sameWindow) { location.assign(url); return; }
  // A real anchor click inside the chip tap, so the browser treats it as a normal link opened in a new tab.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.append(a);
  a.click();
  a.remove();
}

/** Chip tap (web version of MainActivity.onChipTap). */
function onChipTap() {
  if (!lastRaw) return;
  const a = store.armed;
  const act = C.scanAction(lastRaw, a, store.cats);
  // Armed with no usable target: disarm and stay silent this time. Silent no-ops never use up the gate.
  if (a && act.open === null) { store.setArmed(null); return; }
  if (!act.open || !gate.tryFire()) return;
  openUrl(act.open);
  if (a && C.sameArmed(store.armed, a)) store.setArmed(act.next);
}

// ---------- camera chrome geometry ----------
const ZOOM_X = [234, 308, 387, 461, 538, 616, 690];
let zoomIndex = 1;
function buildZoom() {
  $('zoom').replaceChildren(...C.ZOOM_LABELS.map((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'p bot zoompill rot' + (i === zoomIndex ? ' on' : '');
    const w = i === zoomIndex ? 76 : 72;
    b.style.cssText = `--x:${ZOOM_X[i]};--y:1469;--w:${w}`;
    b.textContent = i === zoomIndex ? label + '×' : label;
    b.setAttribute('aria-label', '확대 ' + label);
    b.addEventListener('click', () => setZoomIndex(i));
    return b;
  }));
}
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  const landscape = w > h;
  document.body.classList.toggle('landscape', landscape);
  const chrome = $('chrome');
  const cw = landscape ? h : w, ch = landscape ? w : h;
  chrome.style.width = cw + 'px';
  chrome.style.height = ch + 'px';
  chrome.style.transform = landscape ? `translateY(${h}px) rotate(-90deg)` : 'none';
  chrome.style.setProperty('--u', (cw / 923) + 'px');
  // The feed stays level with the screen: counter-rotate it inside the turned viewfinder.
  const vf = $('vf'), feed = $('feed');
  if (landscape) {
    const vw = vf.clientWidth, vh = vf.clientHeight;
    feed.style.width = vh + 'px'; feed.style.height = vw + 'px';
    feed.style.left = (vw - vh) / 2 + 'px'; feed.style.top = (vh - vw) / 2 + 'px';
    feed.style.transform = 'rotate(90deg)';
  } else {
    feed.style.cssText = '';
  }
  sizeCanvas();
}
window.addEventListener('resize', layout);
screen.orientation?.addEventListener?.('change', () => setTimeout(layout, 50));

$('shutter').addEventListener('click', () => {
  const f = $('flash');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
});

// ---------- detection display ----------
const BRACKET_GRACE_MS = 300, CHIP_GRACE_MS = 1000;
let lastRaw = null, lastCorners = null, lastSeen = 0, chipTimer = 0, bracketTimer = 0;
function hideChip(now = false) {
  if (now) { lastRaw = null; lastCorners = null; }
  $('chips').hidden = true;
  drawBrackets();
}
function onDetect(raw, corners) {
  if (!raw) return;
  lastRaw = raw;
  lastCorners = corners || null;
  lastSeen = performance.now();
  $('chipText').textContent = C.chipLabel(raw);
  $('chips').hidden = false;
  drawBrackets();
  clearTimeout(chipTimer); clearTimeout(bracketTimer);
  bracketTimer = setTimeout(() => { lastCorners = null; drawBrackets(); }, BRACKET_GRACE_MS);
  chipTimer = setTimeout(() => { lastRaw = null; hideChip(); }, CHIP_GRACE_MS);
}
$('chip').addEventListener('click', onChipTap);

const canvas = $('brackets');
function sizeCanvas() {
  const r = canvas.getBoundingClientRect();
  const fw = $('feed').offsetWidth, fh = $('feed').offsetHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(fw * dpr));
  canvas.height = Math.max(1, Math.round(fh * dpr));
  void r;
  drawBrackets();
}
function drawBrackets() {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const video = $('video');
  if (!lastCorners || lastCorners.length < 4 || !video.videoWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const fw = $('feed').offsetWidth, fh = $('feed').offsetHeight;
  const s = Math.max(fw / video.videoWidth, fh / video.videoHeight);
  const ox = (fw - video.videoWidth * s) / 2, oy = (fh - video.videoHeight * s) / 2;
  const pts0 = lastCorners.map((p) => ({ x: (p.x * s + ox) * dpr, y: (p.y * s + oy) * dpr }));
  const cx = pts0.reduce((n, p) => n + p.x, 0) / pts0.length, cy = pts0.reduce((n, p) => n + p.y, 0) / pts0.length;
  const pts = pts0.map((p) => ({ x: cx + (p.x - cx) * 1.1, y: cy + (p.y - cy) * 1.1 }));
  const unit = (parseFloat(getComputedStyle($('chrome')).getPropertyValue('--u')) || 0.45) * dpr;
  ctx.strokeStyle = '#fff8e7';
  ctx.lineWidth = 5 * unit;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((c, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length], next = pts[(i + 1) % pts.length];
    const toward = (o) => {
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (!d) return c;
      const len = Math.min(34 * unit, d * 0.22);
      return { x: c.x + (o.x - c.x) / d * len, y: c.y + (o.y - c.y) / d * len };
    };
    const a = toward(prev), b = toward(next);
    ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineTo(b.x, b.y);
  });
  ctx.stroke();
}

// ---------- camera ----------
let stream = null, starting = false, track = null, zoomCaps = null, loopToken = 0, detector = null;
const video = $('video');

function showGate(title, text, button, hint = false) {
  $('gateTitle').textContent = title;
  $('gateText').textContent = text;
  $('gateBtn').textContent = button;
  $('gateHint').hidden = !hint;
  $('gate').hidden = false;
}

function fakeStream() {
  // Debug only: a moving gradient stands in for the camera in headless checks.
  const c = document.createElement('canvas');
  c.width = 960; c.height = 1280;
  const g = c.getContext('2d');
  let t = 0;
  const paint = () => {
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, '#d9cfc0'); grad.addColorStop(0.55, '#8c7b66'); grad.addColorStop(1, '#5e5040');
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(200 + Math.sin(t / 20) * 40, 420, 560, 440);
    t++;
  };
  paint();
  setInterval(paint, 100);
  return c.captureStream(10);
}

let camGen = 0, introDone = false, lastEndedRestart = 0;
const cameraWanted = () => document.visibilityState === 'visible' && (introDone || read(KEY.intro) === '1') && $('gate').hidden;

async function startCamera() {
  if (stream || starting || document.visibilityState !== 'visible') return;
  starting = true;
  const gen = camGen;
  // A stop (page hidden) during an await makes this start stale: release what it got and bail out quietly.
  const stale = () => gen !== camGen || document.visibilityState !== 'visible';
  let local = null;
  try {
    if (DEBUG && params.get('fake') === '1') local = fakeStream();
    else {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera api'), { name: 'NotSupportedError' });
      local = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 }, aspectRatio: { ideal: 4 / 3 } }
      });
    }
    if (stale()) { for (const t of local.getTracks()) t.stop(); return; }
    stream = local;
    video.srcObject = local;
    await video.play().catch(() => {});
    if (stale() || stream !== local) { if (stream === local) stopCamera(); else for (const t of local.getTracks()) t.stop(); return; }
    track = local.getVideoTracks()[0] || null;
    track?.addEventListener?.('ended', () => onTrackEnded(local));
    const caps = track?.getCapabilities?.() || {};
    zoomCaps = caps.zoom && caps.zoom.max > caps.zoom.min ? caps.zoom : null;
    if (zoomCaps) { const z = track.getSettings?.().zoom; if (z) { zoomIndex = C.zoomSelectedIndex(z); buildZoom(); } }
    $('gate').hidden = true;
    runDetection();
  } catch (error) {
    if (local) for (const t of local.getTracks()) t.stop();
    if (stale()) return;
    stopCamera();
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
      showGate('카메라 권한이 필요합니다', '브라우저 주소창 옆의 설정에서 카메라를 허용한 뒤 다시 시도해 주세요.', '다시 시도');
    } else {
      showGate('카메라를 열 수 없습니다', '다른 앱이 카메라를 쓰고 있는지 확인한 뒤 다시 시도해 주세요.', '다시 시도');
    }
  } finally {
    starting = false;
    // Hidden and shown again while this start was pending: the visible handler returned early, so start now.
    if (gen !== camGen && !stream && cameraWanted()) queueMicrotask(startCamera);
  }
}
/** The system ended the camera track (another app took it, device change): restart while visible, at most every 2 s. */
function onTrackEnded(owner) {
  if (stream !== owner || document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (now - lastEndedRestart < 2000) return;
  lastEndedRestart = now;
  stopCamera();
  startCamera();
}
function stopCamera() {
  camGen++;
  loopToken++;
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null; track = null;
  video.srcObject = null;
  hideChip(true);
}

async function setZoomIndex(i) {
  if (!zoomCaps || !track) return;
  const ratio = C.zoomRatioFor(i, zoomCaps.min, zoomCaps.max);
  try {
    await track.applyConstraints({ advanced: [{ zoom: ratio }] });
    zoomIndex = C.zoomSelectedIndex(track.getSettings?.().zoom || ratio);
    buildZoom();
  } catch { /* zoom refused */ }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.append(s);
  });
}
async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.length) {
        const d = new window.BarcodeDetector({ formats });
        return { interval: 70, async detect(v) {
          const codes = await d.detect(v);
          const code = codes.find((c) => c.rawValue);
          return code ? { raw: code.rawValue, corners: code.cornerPoints?.length >= 4 ? code.cornerPoints : boxCorners(code.boundingBox) } : null;
        } };
      }
    } catch { /* fall back to jsQR */ }
  }
  if (!window.jsQR) await loadScript('./vendor/jsQR.js');
  const work = document.createElement('canvas');
  const g = work.getContext('2d', { willReadFrequently: true });
  return { interval: 120, async detect(v) {
    const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.max(1, Math.round(v.videoWidth * scale)), hh = Math.max(1, Math.round(v.videoHeight * scale));
    if (work.width !== w || work.height !== hh) { work.width = w; work.height = hh; }
    g.drawImage(v, 0, 0, w, hh);
    const found = window.jsQR(g.getImageData(0, 0, w, hh).data, w, hh, { inversionAttempts: 'attemptBoth' });
    if (!found || !found.data) return null;
    const L = found.location;
    return { raw: found.data, corners: [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].map((p) => ({ x: p.x / scale, y: p.y / scale })) };
  } };
}
function boxCorners(b) {
  if (!b) return null;
  return [{ x: b.left, y: b.top }, { x: b.right, y: b.top }, { x: b.right, y: b.bottom }, { x: b.left, y: b.bottom }];
}

async function runDetection() {
  const token = ++loopToken;
  try { detector = detector || await makeDetector(); } catch { return; }
  let last = 0;
  const tick = async () => {
    if (token !== loopToken) return;
    const now = performance.now();
    if (!$('settings').open && video.readyState >= 2 && video.videoWidth && now - last >= detector.interval) {
      last = now;
      try {
        const found = await detector.detect(video);
        if (token === loopToken && found) onDetect(found.raw, found.corners);
      } catch { /* a frame can fail while the camera settles */ }
    }
    if (token === loopToken) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

$('gateBtn').addEventListener('click', () => {
  introDone = true;
  write(KEY.intro, '1');
  $('gate').hidden = true;
  startCamera();
});

// ---------- house gesture: two fingers swipe down in the visible direction; pinch zooms when the camera can ----------
let touch = null;
const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
$('cam').addEventListener('touchstart', (event) => {
  if (event.touches.length !== 2) { touch = null; return; }
  const [a, b] = event.touches;
  touch = { start: new Map([...event.touches].map((t) => [t.identifier, { x: t.clientX, y: t.clientY, dx: 0, dy: 0 }])), d0: dist(a, b), pinching: false, zoom0: track?.getSettings?.().zoom || 1 };
}, { passive: true });
$('cam').addEventListener('touchmove', (event) => {
  if (!touch || event.touches.length !== 2) return;
  for (const t of event.touches) {
    const r = touch.start.get(t.identifier);
    if (!r) { touch = null; return; }
    r.dx = t.clientX - r.x; r.dy = t.clientY - r.y;
  }
  event.preventDefault();
  const scale = dist(event.touches[0], event.touches[1]) / Math.max(1, touch.d0);
  const moves = [...touch.start.values()];
  const bothDown = moves.every((r) => r.dy > 12);
  if (!touch.pinching && zoomCaps && !bothDown && Math.abs(scale - 1) > 0.12) touch.pinching = true;
  if (touch.pinching && zoomCaps && track) {
    const z = Math.min(zoomCaps.max, Math.max(zoomCaps.min, touch.zoom0 * scale));
    track.applyConstraints({ advanced: [{ zoom: z }] }).then(() => {
      const ni = C.zoomSelectedIndex(z);
      if (ni !== zoomIndex) { zoomIndex = ni; buildZoom(); }
    }).catch(() => {});
  }
}, { passive: false });
$('cam').addEventListener('touchend', () => {
  if (!touch) return;
  const t = touch;
  touch = null;
  if (t.pinching) return;
  const [a, b] = [...t.start.values()];
  if (a && b && C.classifyTwoFingerSwipe(a.dx, a.dy, b.dx, b.dy, 80) === 'SETTINGS') openSettings();
}, { passive: true });
$('cam').addEventListener('touchcancel', () => { touch = null; }, { passive: true });

// ---------- contact copy (house footer) ----------
function copyContactId(button) {
  const text = 'KaliDCerona';
  const label = button.textContent;
  const finish = (ok) => { button.textContent = ok ? '복사했어요' : 'ID: KaliDCerona'; setTimeout(() => { button.textContent = label; }, 1800); };
  const fallback = () => { try { const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.left = '-999px'; document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok; } catch { return false; } };
  const clip = navigator.clipboard;
  if (clip && typeof clip.writeText === 'function') { clip.writeText(text).then(() => finish(true), () => finish(fallback())); return; }
  finish(fallback());
}
$('contact-copy').addEventListener('click', () => copyContactId($('contact-copy')));

// ---------- screen wake lock (standing rule: the screen stays on while the app is visible) ----------
let wakeLock = null, wakePending = false;
async function keepAwake() {
  if (document.visibilityState !== 'visible' || wakeLock || wakePending || !navigator.wakeLock) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    wakePending = false;
    if (document.visibilityState !== 'visible') { lock.release().catch(() => {}); return; }
    wakeLock = lock;
    lock.addEventListener?.('release', () => { if (wakeLock === lock) { wakeLock = null; if (document.visibilityState === 'visible') keepAwake(); } });
  } catch { wakePending = false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    keepAwake();
    if (cameraWanted()) startCamera();
  } else {
    stopCamera();
    if (wakeLock) { const lock = wakeLock; wakeLock = null; lock.release().catch(() => {}); }
  }
});

// ---------- boot ----------
if (DEBUG) {
  window.__uramichi = {
    decode: (raw, corners) => onDetect(raw, corners),
    tap: () => onChipTap(),
    openSettings, closeSettings,
    get opened() { return opened.slice(); },
    get armed() { return store.armed; },
    get cats() { return store.cats; },
    get chipVisible() { return !$('chips').hidden; }
  };
}
buildZoom();
layout();
keepAwake();
introDone = read(KEY.intro) === '1';
if (introDone) startCamera();
else showGate('카메라를 켭니다', 'URAMICHI는 코드를 읽으려고 카메라를 씁니다. 다음에 뜨는 창에서 카메라 사용을 허용해 주세요. 영상은 이 기기 밖으로 나가지 않습니다.', '카메라 켜기', true);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
