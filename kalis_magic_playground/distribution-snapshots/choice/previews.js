import { fakeNotesEl, fakePhone, fakeWallpaper } from './dom.js';
import { LINE_HEIGHTS, controlOptions } from './options.js';
import { ensureFakeHomeIcons } from './user-icons.js';
import { fakeHomeSession, applyHomeStyle } from './performance.js';
import { emphasisRow, buildNoteScroller } from './fake-notes.js';

let wallpaperUrl = null;

// ----- live preview of the home and notes screens (settings only) -----
// A scaled copy of the real screens' markup, filled by the same icon code and styled by the same CSS and options.
// It is inert and holds no handlers, never reads or writes the performance session, and its ids are removed.
const PV_NOTE = { name: '샘플 목록', choice: 3, items: ['아침 산책하기', '커피 한 잔', '책 열 쪽 읽기', '점심 약속', '장보기', '저녁 요리', '일기 쓰기', '운동 30분', '빨래 널기', '내일 준비'] };
const pvHomes = [];
const pvNotes = [];
const pvDirty = { home: false, notes: false };
const pvPainted = new WeakMap();
let pvTick = 0;
let pvWallpaperUrl = null;
let pvWallpaperKey = null;
let pvWallpaperToken = 0;

function pvStage(host, markup, kind) {
  const frame = document.createElement('div');
  frame.className = 'fake-home-frame';
  const clone = markup.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  clone.querySelectorAll('[tabindex]').forEach((node) => node.removeAttribute('tabindex'));
  clone.querySelectorAll('button').forEach((node) => { node.tabIndex = -1; });
  clone.querySelectorAll('.digit-guide, .entry-readout').forEach((node) => node.remove());
  clone.removeAttribute('aria-hidden');
  frame.append(clone);
  const home = document.createElement('div');
  home.className = 'pv-home';
  home.dataset.pv = kind;
  home.append(frame);
  const scale = document.createElement('div');
  scale.className = 'pv-scale';
  scale.append(home);
  // A shadow root keeps the copy out of every document query and id lookup, so nothing in the app can find or drive it.
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = document.querySelector('link[rel="stylesheet"][href*="style.css"]')?.href || './style.css';
  root.replaceChildren(sheet, scale);
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  return home;
}

function initPreviews() {
  document.querySelectorAll('.pv-stage').forEach((host) => {
    if (host.dataset.pvKind === 'home' && fakePhone) {
      const home = pvStage(host, fakePhone, 'home');
      home.querySelector('.phone-shell').dataset.wallpaper = 'default';
      const wallpaper = home.querySelector('.wallpaper');
      if (wallpaper) wallpaper.style.backgroundImage = '';
      pvHomes.push(home);
    } else if (host.dataset.pvKind === 'notes' && fakeNotesEl) {
      const home = pvStage(host, fakeNotesEl, 'notes');
      const notes = home.querySelector('.notes-landing');
      notes.hidden = false;
      notes.classList.add('is-detail');
      const back = notes.querySelector('.notes-back');
      if (back) back.hidden = false;
      const title = notes.querySelector('h2');
      if (title) title.textContent = PV_NOTE.name;
      pvNotes.push(home);
    }
  });
  pvRefreshIcons();
  pvDirty.home = true;
  pvDirty.notes = true;
  renderPreviews();
}

function pvRefreshIcons() {
  pvHomes.forEach((home) => ensureFakeHomeIcons(home));
}

function markPreviewGroup(id) {
  const home = id === 'opt-icon-size' || id === 'opt-label-size' || id === 'opt-bottom-gap';
  const notes = id === 'opt-note-font' || id === 'opt-note-line' || id === 'opt-note-emphasis';
  if (!id || (!home && !notes)) {
    pvDirty.home = true;
    pvDirty.notes = true;
    return;
  }
  if (home) pvDirty.home = true;
  if (notes) pvDirty.notes = true;
}

function previewStage(node) {
  const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
  return root && root.host ? root.host : null;
}

function previewWillShow(node, { openingView = null, openingStageId = null } = {}) {
  const stage = previewStage(node);
  if (!stage) return false;
  let current = stage;
  while (current) {
    if (current.hidden) {
      const opening = (openingView && current.dataset?.viewName === openingView)
        || (openingStageId && current.id === openingStageId);
      if (!opening) return false;
    }
    current = current.parentElement;
  }
  return true;
}

function homeStamp(options) {
  return `${options.iconSize}\0${options.labelSize}\0${options.bottomGap}`;
}

function notesStamp(options) {
  return `${options.noteFont}\0${options.noteLine}\0${options.noteEmphasis}`;
}

function paintHomePreview(node, options) {
  const stamp = pvPainted.get(node) || {};
  const next = homeStamp(options);
  if (stamp.home === next) return;
  applyHomeStyle(options, node);
  stamp.home = next;
  pvPainted.set(node, stamp);
}

function paintNotePreview(node, options) {
  const body = node.querySelector('.notes-landing-body');
  if (!body) return;
  const stamp = pvPainted.get(node) || {};
  const next = notesStamp(options);
  const lines = body.querySelector('.notes-lines');
  if (!lines) {
    body.replaceChildren(buildNoteScroller(PV_NOTE.items, PV_NOTE.choice, options, { zoomable: false }));
    stamp.notes = next;
    pvPainted.set(node, stamp);
    return;
  }
  if (stamp.notes === next) return;
  lines.style.setProperty('--note-size', `${options.noteFont}px`);
  lines.style.setProperty('--note-leading', String(LINE_HEIGHTS[options.noteLine] || LINE_HEIGHTS.normal));
  [...lines.children].forEach((row, index) => {
    row.classList.remove('is-emphasis');
    if (row.dataset && Object.prototype.hasOwnProperty.call(row.dataset, 'emphasis')) delete row.dataset.emphasis;
    if (index + 1 === PV_NOTE.choice) emphasisRow(row, options);
  });
  stamp.notes = next;
  pvPainted.set(node, stamp);
}

function syncPreviewGroup(group, options, opening) {
  const list = group === 'home' ? pvHomes : pvNotes;
  list.forEach((node) => {
    if (!previewWillShow(node, opening)) return;
    if (group === 'home') paintHomePreview(node, options);
    else paintNotePreview(node, options);
  });
}

function recomputePreviewDirty(options) {
  const home = homeStamp(options);
  const notes = notesStamp(options);
  pvDirty.home = pvHomes.some((node) => pvPainted.get(node)?.home !== home);
  pvDirty.notes = pvNotes.some((node) => pvPainted.get(node)?.notes !== notes);
}

function renderPreviews() {
  pvTick = 0;
  if (!pvHomes.length && !pvNotes.length) return;
  const options = controlOptions();
  if (pvDirty.home) {
    syncPreviewGroup('home', options, {});
    pvApplyWallpaper(options);
  }
  if (pvDirty.notes) syncPreviewGroup('notes', options, {});
  recomputePreviewDirty(options);
}

// Paint what is about to become visible, while the view or tab is still hidden.
function warmPreviews(viewName) {
  if (!pvHomes.length && !pvNotes.length) return;
  const options = controlOptions();
  syncPreviewGroup('home', options, { openingView: viewName });
  syncPreviewGroup('notes', options, { openingView: viewName });
  recomputePreviewDirty(options);
}

function warmDecoTab(kind) {
  if (!pvHomes.length && !pvNotes.length) return;
  const options = controlOptions();
  const group = kind === 'notes' ? 'notes' : 'home';
  syncPreviewGroup(group, options, { openingStageId: kind === 'notes' ? 'deco-pv-notes' : 'deco-pv-home' });
  recomputePreviewDirty(options);
}

function schedulePreviews() {
  if (pvTick || (!pvHomes.length && !pvNotes.length)) return;
  pvTick = requestAnimationFrame(renderPreviews);
}

async function pvApplyWallpaper(options) {
  const key = options.wallpaper === 'photo' ? wallpaperKey(options) : null;
  if (key === pvWallpaperKey) return;
  pvWallpaperKey = key;
  const token = ++pvWallpaperToken;
  let url = null;
  if (key) {
    try {
      const blob = await readWallpaper(key);
      if (blob) url = URL.createObjectURL(blob);
    } catch { /* A missing or blocked photo shows the default wallpaper. */ }
  }
  if (token !== pvWallpaperToken) { if (url) URL.revokeObjectURL(url); return; }
  if (pvWallpaperUrl) URL.revokeObjectURL(pvWallpaperUrl);
  pvWallpaperUrl = url;
  pvHomes.forEach((home) => {
    const wallpaper = home.querySelector('.wallpaper');
    if (wallpaper) wallpaper.style.backgroundImage = url ? `url("${url}")` : '';
    const shell = home.querySelector('.phone-shell');
    if (shell) shell.dataset.wallpaper = url ? 'photo' : 'default';
  });
}

// The wallpaper photo lives in IndexedDB on this device only and is never part of the app files.
const MEDIA_DB = 'magic-choice-dist.v1.media';
function mediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('wallpaper');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function mediaRun(mode, run) {
  const db = await mediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wallpaper', mode);
    const request = run(tx.objectStore('wallpaper'));
    tx.oncomplete = () => { db.close(); resolve(request?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
// Each photo has its own key. A new photo is written first, the saved settings point at it only after
// that worked, and the old photo is dropped last, so a failure at any step keeps the old photo.
const wallpaperKey = (options) => (options.wallpaperId ? `w_${options.wallpaperId}` : 'current');
const readWallpaper = (key) => mediaRun('readonly', (store) => store.get(key));
const writeWallpaper = (key, blob) => mediaRun('readwrite', (store) => store.put(blob, key));
const clearWallpaper = (key) => mediaRun('readwrite', (store) => store.delete(key));

function releaseWallpaper() {
  if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
  wallpaperUrl = null;
  if (fakeWallpaper) fakeWallpaper.style.backgroundImage = '';
  fakePhone?.setAttribute('data-wallpaper', 'default');
}

async function applyWallpaper(options) {
  releaseWallpaper();
  if (options.wallpaper !== 'photo') return;
  try {
    const blob = await readWallpaper(wallpaperKey(options));
    if (!blob || !fakeHomeSession) return;
    wallpaperUrl = URL.createObjectURL(blob);
    fakeWallpaper.style.backgroundImage = `url("${wallpaperUrl}")`;
    fakePhone.setAttribute('data-wallpaper', 'photo');
  } catch { /* A missing or blocked photo falls back to the default wallpaper. */ }
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    image.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export {
  initPreviews, pvRefreshIcons, markPreviewGroup, warmPreviews, warmDecoTab, schedulePreviews,
  wallpaperKey, writeWallpaper, clearWallpaper, releaseWallpaper, applyWallpaper, loadImageFile,
  canvasBlob,
};
