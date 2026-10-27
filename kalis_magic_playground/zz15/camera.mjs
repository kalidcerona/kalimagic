import * as C from './core.mjs';
import { $, params, DEBUG } from './dom.mjs';
import { KEY, read, write, store, openSettings, closeSettings } from './presets.mjs';
import { hideChip, onDetect } from './detect.mjs';
import { layout } from './chrome.mjs';
import { onChipTap, opened } from './scan.mjs';


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
  recognizerCue(false);
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

function recognizerCue(on) {
  const cue = $('recog');
  if (cue) cue.hidden = !on;
}
async function runDetection() {
  const token = ++loopToken;
  const owner = stream;
  let prepared = detector, failed = false;
  try {
    if (!prepared) prepared = await makeDetector();
  } catch { failed = true; }
  // This start was stopped, or a newer loop owns the camera. Leave the cue, detector and retry alone.
  if (token !== loopToken || stream !== owner) return;
  if (failed) {
    recognizerCue(true);
    setTimeout(() => { if (token === loopToken && stream) runDetection(); }, 2000);
    return;
  }
  detector = prepared;
  recognizerCue(false);
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
if ('serviceWorker' in navigator) {
  const registration = navigator.serviceWorker.register('./sw.js');
  registration.catch(() => {});
  globalThis.MagicUpdate?.init({ registrationPromise: registration, safe: () => $('settings').open === true });
}
