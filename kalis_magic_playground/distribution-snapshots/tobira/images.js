import { createRevisionQueue, wallpaperCropRect } from './logic.js';
import {
  IMAGE_CHOICE_KEY, IMAGE_DB, DEFAULT_COIN_IMAGES, stageEl, wallpaperEl, wallpaperCrop,
  wallpaperCropValue, wallpaperPreview, wallpaperCropOverlay, wallpaperCropHandle,
  wallpaperControls, imageChoiceInput, coinImageNote, coinArt,
} from './dom.js';
import { selected } from './state-store.js';

const WALLPAPER_CROP_KEY = 'friend-tobira.wallpaperCrop.v1';
const wallpaperJobs = createRevisionQueue();
let imageDbPromise;
let imageChoices = {};
let imageChoicesBlocked = false;
const imageUrls = new Map();

function openImageDb() {
  if (imageDbPromise) return imageDbPromise;
  imageDbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(IMAGE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return imageDbPromise;
}

async function imageRecord(key, operation, value) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', operation === 'get' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('images');
    const request = operation === 'put' ? store.put(value, key) : operation === 'delete' ? store.delete(key) : store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function imageBlob(file, maxSide) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG, JPG, WebP 이미지만 올릴 수 있습니다.');
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지를 읽지 못했습니다.')), file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.85));
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function croppedWallpaper(blob, percent) {
  const sourceUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const crop = wallpaperCropRect(image.naturalWidth, image.naturalHeight, percent);
    const scale = Math.min(1, 1600 / Math.max(crop.width, crop.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    canvas.getContext('2d').drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const mime = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    return await new Promise((resolve, reject) => canvas.toBlob((output) => output ? resolve(output) : reject(new Error('배경을 자르지 못했습니다.')), mime, 0.88));
  } finally { URL.revokeObjectURL(sourceUrl); }
}

function cropAmount(percent) {
  const snapped = Math.round((Number(percent) || 0) * 2) / 2;
  return Math.min(18, Math.max(0, snapped));
}

function cropLabel(percent) {
  const value = cropAmount(percent);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function readCropPercent() {
  return cropAmount(wallpaperCrop.value);
}

function paintCropChrome(percent) {
  const label = cropLabel(percent);
  wallpaperCrop.value = label;
  wallpaperCropValue.textContent = `${label}%`;
  wallpaperCropOverlay.style.height = `${label}%`;
  wallpaperCropHandle.style.top = `${label}%`;
  wallpaperCropHandle.setAttribute('aria-valuenow', label);
  wallpaperCropHandle.setAttribute('aria-valuetext', `${label}%`);
}

function setCropEnabled(enabled) {
  wallpaperCrop.disabled = !enabled;
  wallpaperCropHandle.tabIndex = enabled ? 0 : -1;
  wallpaperCropHandle.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

function showWallpaper(blob) {
  const url = useImageUrl('wallpaper', blob);
  wallpaperEl.src = url;
  wallpaperControls.hidden = false;
  stageEl.classList.add('has-wallpaper');
}

function showWallpaperOriginal(blob) {
  const url = useImageUrl('wallpaper-preview', blob);
  if (!url) wallpaperPreview.removeAttribute('src');
  else {
    wallpaperPreview.src = url;
    wallpaperControls.hidden = false;
  }
}

function useImageUrl(key, blob) {
  const previous = imageUrls.get(key);
  if (previous) URL.revokeObjectURL(previous);
  if (!blob) { imageUrls.delete(key); return null; }
  const url = URL.createObjectURL(blob);
  imageUrls.set(key, url);
  return url;
}

function chosenCoin(id) {
  const requested = imageChoices[id];
  return requested === 'custom' && imageUrls.has(`coin:${id}`) ? imageUrls.get(`coin:${id}`) : DEFAULT_COIN_IMAGES[requested] || DEFAULT_COIN_IMAGES.kennedy;
}

function refreshCoinImage() {
  coinArt.src = chosenCoin(selected().id);
  imageChoiceInput.value = imageChoices[selected().id] || 'kennedy';
  if (imageChoicesBlocked) {
    coinImageNote.textContent = '이미지 선택을 읽지 못했습니다. 기존 기록은 덮어쓰지 않았습니다.';
    return;
  }
  coinImageNote.textContent = imageUrls.has(`coin:${selected().id}`)
    ? '이 자리에 업로드한 이미지가 저장되어 있습니다.'
    : '투명 배경 PNG를 권장합니다. 업로드하면 이 자리의 이미지로 선택됩니다.';
}

function loadImageChoices() {
  imageChoices = {};
  let raw = null;
  try {
    raw = localStorage.getItem(IMAGE_CHOICE_KEY);
  } catch {
    imageChoicesBlocked = true;
    coinImageNote.textContent = '이미지 선택을 읽지 못했습니다. 기존 기록은 덮어쓰지 않습니다.';
    return;
  }
  if (raw == null || raw === '') return;
  try {
    const stored = JSON.parse(raw);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('invalid image choices');
    imageChoices = stored;
  } catch {
    imageChoicesBlocked = true;
    imageChoices = {};
    coinImageNote.textContent = '이미지 선택을 읽지 못했습니다. 기존 기록은 덮어쓰지 않았습니다.';
  }
}

function persistImageChoices() {
  if (imageChoicesBlocked) {
    coinImageNote.textContent = '이미지 선택을 읽지 못해 저장하지 않았습니다. 기존 기록은 그대로입니다.';
    return false;
  }
  try {
    localStorage.setItem(IMAGE_CHOICE_KEY, JSON.stringify(imageChoices));
    return true;
  } catch {
    coinImageNote.textContent = '이미지 선택을 저장하지 못했습니다.';
    return false;
  }
}

export {
  WALLPAPER_CROP_KEY, wallpaperJobs, imageChoices, imageUrls, imageRecord, imageBlob,
  croppedWallpaper, cropLabel, readCropPercent, paintCropChrome, setCropEnabled, showWallpaper,
  showWallpaperOriginal, useImageUrl, chosenCoin, refreshCoinImage, loadImageChoices,
  persistImageChoices,
};
