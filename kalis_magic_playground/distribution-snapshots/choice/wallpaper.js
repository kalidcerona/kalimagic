import { normalizeOptions } from './logic.js';
import { controlOptions } from './options.js';
import {
  wallpaperKey, writeWallpaper, clearWallpaper, loadImageFile, canvasBlob,
} from './previews.js';
import { store, persist } from './controller.js';

// Wallpaper photo: pick, position (cover, drag and zoom), shrink, then keep it on this device only.
const wpEditor = document.getElementById('wallpaper-editor');
const wpCanvas = document.getElementById('wallpaper-canvas');
const wpZoom = document.getElementById('wallpaper-zoom');
const WP_VIEW = { width: 200, height: 433 };
const WP_OUT = { width: 780, height: 1688 };
let wp = null;

function drawWallpaperCrop(canvas = wpCanvas, ratio = 1) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(wp.image, wp.ox * ratio, wp.oy * ratio, wp.image.naturalWidth * wp.scale * ratio, wp.image.naturalHeight * wp.scale * ratio);
}

function clampWallpaperCrop() {
  wp.ox = Math.min(0, Math.max(WP_VIEW.width - wp.image.naturalWidth * wp.scale, wp.ox));
  wp.oy = Math.min(0, Math.max(WP_VIEW.height - wp.image.naturalHeight * wp.scale, wp.oy));
}

function setWallpaperZoom(factor) {
  const center = { x: (WP_VIEW.width / 2 - wp.ox) / wp.scale, y: (WP_VIEW.height / 2 - wp.oy) / wp.scale };
  wp.scale = wp.cover * factor;
  wp.ox = WP_VIEW.width / 2 - center.x * wp.scale;
  wp.oy = WP_VIEW.height / 2 - center.y * wp.scale;
  clampWallpaperCrop();
  drawWallpaperCrop();
}

async function onWallpaperFile(event) {
  const file = event.target.files?.[0];
  const message = document.getElementById('home-message');
  if (!file) return;
  message.textContent = '';
  try {
    const image = await loadImageFile(file);
    const cover = Math.max(WP_VIEW.width / image.naturalWidth, WP_VIEW.height / image.naturalHeight);
    wp = { image, cover, scale: cover, ox: 0, oy: 0 };
    wpZoom.value = '100';
    setWallpaperZoom(1);
    wpEditor.hidden = false;
  } catch {
    message.textContent = '그림을 읽을 수 없습니다. PNG, JPEG, WebP 파일을 골라 주세요.';
  }
}

function closeWallpaperEditor() {
  wp = null;
  wpEditor.hidden = true;
  document.getElementById('wallpaper-file').value = '';
}

async function onWallpaperApply() {
  const message = document.getElementById('home-message');
  if (!wp) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = WP_OUT.width;
    canvas.height = WP_OUT.height;
    drawWallpaperCrop(canvas, WP_OUT.width / WP_VIEW.width);
    const blob = await canvasBlob(canvas, 'image/jpeg', 0.82);
    if (!blob) throw new Error('blob');
    const previous = normalizeOptions(store.options);
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const key = `w_${id}`;
    await writeWallpaper(key, blob);
    if (!persist({ ...store, options: controlOptions({ wallpaper: 'photo', wallpaperId: id }) })) {
      // The settings still point at the old photo. Drop the unused new one.
      try { await clearWallpaper(key); } catch { /* Nothing more to undo. */ }
      throw new Error('save');
    }
    if (previous.wallpaper === 'photo') { try { await clearWallpaper(wallpaperKey(previous)); } catch { /* A stray old photo is harmless. */ } }
    message.textContent = '';
    closeWallpaperEditor();
    renderWallpaperState();
  } catch {
    message.textContent = '배경화면을 저장하지 못했습니다. 지금 쓰던 배경은 그대로입니다.';
  }
}

function bindWallpaperCropper() {
  let drag = null;
  let pixelsPerCss = 1;
  let paint = false;
  const measure = () => {
    const width = wpCanvas.getBoundingClientRect().width;
    pixelsPerCss = width > 0 ? WP_VIEW.width / width : 1;
  };
  const drawSoon = () => {
    if (paint) return;
    paint = true;
    requestAnimationFrame(() => { paint = false; drawWallpaperCrop(); });
  };
  wpCanvas.addEventListener('pointerdown', (event) => {
    if (!wp) return;
    measure();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: wp.ox, oy: wp.oy };
    wpCanvas.setPointerCapture?.(event.pointerId);
  });
  wpCanvas.addEventListener('pointermove', (event) => {
    if (!drag || !wp || event.pointerId !== drag.id) return;
    wp.ox = drag.ox + (event.clientX - drag.x) * pixelsPerCss;
    wp.oy = drag.oy + (event.clientY - drag.y) * pixelsPerCss;
    clampWallpaperCrop();
    drawSoon();
  });
  const end = (event) => { if (drag && event.pointerId === drag.id) drag = null; };
  wpCanvas.addEventListener('pointerup', end);
  wpCanvas.addEventListener('pointercancel', end);
  wpZoom.addEventListener('input', () => { if (wp) setWallpaperZoom(Number(wpZoom.value) / 100); });
}

async function onWallpaperReset() {
  const message = document.getElementById('home-message');
  const previous = normalizeOptions(store.options);
  if (!persist({ ...store, options: controlOptions({ wallpaper: 'default', wallpaperId: '' }) })) {
    message.textContent = '설정을 저장하지 못했습니다. 지금 쓰던 배경은 그대로입니다.';
    return;
  }
  if (previous.wallpaper === 'photo') { try { await clearWallpaper(wallpaperKey(previous)); } catch { /* A stray photo is harmless. */ } }
  renderWallpaperState();
}

function renderWallpaperState() {
  const node = document.getElementById('wallpaper-state');
  if (node) node.textContent = normalizeOptions(store.options).wallpaper === 'photo' ? '지금 내 배경 사진을 쓰고 있습니다.' : '지금 기본 배경을 쓰고 있습니다.';
}

function bindWallpaper() {
  document.getElementById('wallpaper-file').addEventListener('change', (event) => { onWallpaperFile(event); });
  document.getElementById('wallpaper-apply').addEventListener('click', () => { onWallpaperApply(); });
  document.getElementById('wallpaper-cancel').addEventListener('click', closeWallpaperEditor);
  bindWallpaperCropper();
  document.getElementById('wallpaper-reset').addEventListener('click', () => { onWallpaperReset(); });
}

export { renderWallpaperState, bindWallpaper };
