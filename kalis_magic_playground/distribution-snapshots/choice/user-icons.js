import {
  HOME_LAYOUT, homeCellDigit, isZeroSlot, loadUserIcons, placeUserIcon, removeUserIcon,
  saveUserIcons, USER_ICON_KEY,
} from './logic.js';
import { HOME_MANIFEST, iconSrc } from './home-manifest.js';
import { fakeHomeEl, phoneDock } from './dom.js';
import { pvRefreshIcons, loadImageFile } from './previews.js';

let userIcons = [];
let iconCacheRaw;
let iconCacheReady = false;
let realHomeIconStamp;

// Own app icons: pick an image or a home screen capture, crop a square, give it a name and a 0 cell.
const iconEditor = document.getElementById('usericon-editor');
const iconCanvas = document.getElementById('usericon-canvas');
const iconZoom = document.getElementById('usericon-zoom');
const iconLabel = document.getElementById('usericon-label');
const iconPage = document.getElementById('usericon-page');
const iconSlots = document.getElementById('usericon-slots');
const iconSlotText = document.getElementById('usericon-slot-text');
const iconMessage = document.getElementById('usericon-message');
const iconList = document.getElementById('usericon-list');
const CROP_VIEW = 240;
const CROP_OUT = 112;
let crop = null;
let iconPick = null;

function drawCrop() {
  if (!crop) return;
  const ctx = iconCanvas.getContext('2d');
  ctx.clearRect(0, 0, CROP_VIEW, CROP_VIEW);
  ctx.drawImage(crop.image, crop.ox, crop.oy, crop.image.naturalWidth * crop.scale, crop.image.naturalHeight * crop.scale);
}

function clampCrop() {
  const width = crop.image.naturalWidth * crop.scale;
  const height = crop.image.naturalHeight * crop.scale;
  crop.ox = Math.min(0, Math.max(CROP_VIEW - width, crop.ox));
  crop.oy = Math.min(0, Math.max(CROP_VIEW - height, crop.oy));
}

function setCropZoom(factor) {
  const center = { x: (CROP_VIEW / 2 - crop.ox) / crop.scale, y: (CROP_VIEW / 2 - crop.oy) / crop.scale };
  crop.scale = crop.cover * factor;
  crop.ox = CROP_VIEW / 2 - center.x * crop.scale;
  crop.oy = CROP_VIEW / 2 - center.y * crop.scale;
  clampCrop();
  drawCrop();
}

async function onIconFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  iconMessage.textContent = '';
  try {
    const image = await loadImageFile(file);
    const cover = CROP_VIEW / Math.min(image.naturalWidth, image.naturalHeight);
    crop = { image, cover, scale: cover, ox: 0, oy: 0 };
    iconZoom.value = '100';
    setCropZoom(1);
    iconEditor.hidden = false;
    iconPick = iconPick || { page: 0, row: 4, col: 0 };
    renderSlotPicker();
  } catch {
    iconMessage.textContent = '그림을 읽을 수 없습니다. PNG, JPEG, WebP 파일을 골라 주세요.';
  }
}

function closeIconEditor() {
  crop = null;
  iconEditor.hidden = true;
  document.getElementById('usericon-file').value = '';
  iconLabel.value = '';
}

function renderSlotPicker() {
  if (!iconSlots) return;
  const page = Number(iconPage.value);
  if (iconPick && iconPick.page !== page) iconPick = null;
  const manifest = new Map((HOME_MANIFEST.pages[page] || []).map((cell) => [`${cell.row}:${cell.col}`, cell]));
  const placed = new Map(userIcons.filter((icon) => icon.page === page).map((icon) => [`${icon.row}:${icon.col}`, icon]));
  const buttons = [];
  for (let row = 0; row < HOME_LAYOUT.rows; row += 1) {
    for (let col = 0; col < HOME_LAYOUT.cols; col += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      const key = `${row}:${col}`;
      const cell = manifest.get(key);
      const mine = placed.get(key);
      const zero = isZeroSlot(page, row, col);
      button.setAttribute('aria-label', `${row + 1}행 ${col + 1}열${zero ? '' : ' (숫자 칸)'}`);
      if (cell?.action) {
        button.disabled = true;
        button.setAttribute('aria-label', `${row + 1}행 ${col + 1}열 (노트 앱 자리)`);
        const img = document.createElement('img');
        img.alt = '';
        img.src = iconSrc(cell.file);
        button.append(img);
      } else if (!zero) {
        button.disabled = true;
        button.textContent = String(homeCellDigit(row, col));
      } else {
        const img = document.createElement('img');
        img.alt = '';
        if (mine) img.src = mine.dataUrl;
        else if (cell) img.src = iconSrc(cell.file);
        if (mine || cell) button.append(img); else button.classList.add('is-zero-empty');
        if (iconPick && iconPick.row === row && iconPick.col === col) button.classList.add('is-picked');
        button.addEventListener('click', () => { iconPick = { page, row, col }; renderSlotPicker(); });
      }
      buttons.push(button);
    }
  }
  iconSlots.replaceChildren(...buttons);
  iconSlotText.textContent = iconPick ? `고른 칸: ${iconPick.row + 1}행 ${iconPick.col + 1}열` : '넣을 칸을 고르세요. 숫자 칸은 고를 수 없습니다.';
}

function syncUserIconsFromStorage() {
  let raw;
  try { raw = localStorage.getItem(USER_ICON_KEY); } catch { return false; }
  if (iconCacheReady && raw === iconCacheRaw) return false;
  iconCacheRaw = raw;
  iconCacheReady = true;
  userIcons = loadUserIcons(localStorage, reservedCells());
  return true;
}

function rememberSavedIcons(icons) {
  userIcons = icons;
  try { iconCacheRaw = localStorage.getItem(USER_ICON_KEY); } catch { iconCacheRaw = null; }
  iconCacheReady = true;
  realHomeIconStamp = undefined;
}

function revokeGridObjectUrls(grid) {
  if (!grid || typeof grid.querySelectorAll !== 'function') return;
  grid.querySelectorAll('img').forEach((img) => {
    const src = typeof img.src === 'string' && img.src ? img.src : (img.getAttribute?.('src') || '');
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
  });
}

function renderUserIcons() {
  if (iconList) {
    iconList.replaceChildren();
    userIcons.forEach((icon) => {
      const row = document.createElement('article');
      row.className = 'preset usericon-item';
      const img = document.createElement('img');
      img.src = icon.dataUrl;
      img.alt = '';
      const text = document.createElement('span');
      text.textContent = `${icon.label} · ${['첫째', '둘째', '셋째'][icon.page]} 홈 ${icon.row + 1}행 ${icon.col + 1}열`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = '빼기';
      remove.addEventListener('click', () => {
        const result = removeUserIcon(userIcons, icon.id, reservedCells());
        if (!result.ok) { iconMessage.textContent = result.error; return; }
        const saved = saveUserIcons(localStorage, result.icons);
        iconMessage.textContent = saved.ok ? '뺐습니다.' : saved.error;
        if (!saved.ok) return;
        rememberSavedIcons(result.icons);
        renderUserIcons();
      });
      row.append(img, text, remove);
      iconList.append(row);
    });
  }
  renderSlotPicker();
  pvRefreshIcons();
  realHomeIconStamp = undefined;
  if (fakeHomeEl) ensureFakeHomeIcons();
}

function onIconAdd() {
  if (!crop) return;
  if (!iconPick) { iconMessage.textContent = '넣을 칸을 먼저 고르세요.'; return; }
  const out = document.createElement('canvas');
  out.width = CROP_OUT;
  out.height = CROP_OUT;
  const ratio = CROP_OUT / CROP_VIEW;
  out.getContext('2d').drawImage(crop.image, crop.ox * ratio, crop.oy * ratio, crop.image.naturalWidth * crop.scale * ratio, crop.image.naturalHeight * crop.scale * ratio);
  let dataUrl = out.toDataURL('image/png');
  if (dataUrl.length > 80000) dataUrl = out.toDataURL('image/jpeg', 0.8);
  const result = placeUserIcon(userIcons, { ...iconPick, label: iconLabel.value, dataUrl }, { reserved: reservedCells() });
  if (!result.ok) { iconMessage.textContent = result.error; return; }
  const saved = saveUserIcons(localStorage, result.icons);
  if (!saved.ok) { iconMessage.textContent = saved.error; return; }
  iconMessage.textContent = `「${result.icon.label}」를 넣었습니다.`;
  rememberSavedIcons(result.icons);
  closeIconEditor();
  renderUserIcons();
}

function bindIconCropper() {
  let drag = null;
  let pixelsPerCss = 1;
  let paint = false;
  const measure = () => {
    const width = iconCanvas.getBoundingClientRect().width;
    pixelsPerCss = width > 0 ? CROP_VIEW / width : 1;
  };
  const drawSoon = () => {
    if (paint) return;
    paint = true;
    requestAnimationFrame(() => { paint = false; drawCrop(); });
  };
  iconCanvas.addEventListener('pointerdown', (event) => {
    if (!crop) return;
    measure();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: crop.ox, oy: crop.oy };
    iconCanvas.setPointerCapture?.(event.pointerId);
  });
  iconCanvas.addEventListener('pointermove', (event) => {
    if (!drag || !crop || event.pointerId !== drag.id) return;
    crop.ox = drag.ox + (event.clientX - drag.x) * pixelsPerCss;
    crop.oy = drag.oy + (event.clientY - drag.y) * pixelsPerCss;
    clampCrop();
    drawSoon();
  });
  const end = (event) => { if (drag && event.pointerId === drag.id) drag = null; };
  iconCanvas.addEventListener('pointerup', end);
  iconCanvas.addEventListener('pointercancel', end);
  iconZoom.addEventListener('input', () => { if (crop) setCropZoom(Number(iconZoom.value) / 100); });
}

// Cells that carry an action (the notes app) can never be replaced by an own icon.
function reservedCells() {
  return HOME_MANIFEST.pages.flatMap((cells, page) => cells.filter((cell) => cell.action).map((cell) => ({ page, row: cell.row, col: cell.col })));
}

// Home screen cells come from home-manifest.js; the performer's own icons (device storage) win.
function homeDescriptors(page) {
  const cells = new Map();
  (HOME_MANIFEST.pages[page] || []).forEach((cell) => {
    cells.set(`${cell.row}:${cell.col}`, {
      row: cell.row, col: cell.col, src: iconSrc(cell.file),
      name: cell.name, kind: cell.kind || 'app', action: cell.action || '', mask: cell.mask === true
    });
  });
  userIcons.filter((icon) => icon.page === page).forEach((icon) => {
    cells.set(`${icon.row}:${icon.col}`, {
      row: icon.row, col: icon.col, src: icon.dataUrl, name: icon.label, kind: 'app', action: '', user: true
    });
  });
  return [...cells.values()];
}

function createAppIcon(cell) {
  const item = document.createElement('div');
  item.className = 'app-icon';
  item.style.gridRow = String(cell.row + 1);
  item.style.gridColumn = String(cell.col + 1);
  if (cell.action) item.dataset.action = cell.action;
  if (cell.kind === 'folder') item.dataset.kind = 'folder';
  const glyph = document.createElement('img');
  glyph.className = cell.user || cell.mask ? 'app-glyph is-user' : 'app-glyph';
  glyph.src = cell.src;
  glyph.alt = '';
  glyph.draggable = false;
  glyph.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'app-name';
  name.textContent = cell.name;
  item.append(glyph, name);
  return item;
}

function ensureFakeHomeIcons(root = fakeHomeEl) {
  const real = root === fakeHomeEl;
  if (real && realHomeIconStamp === iconCacheRaw && root?.dataset?.ready === 'true') return;
  root.querySelectorAll('[data-home-grid]').forEach((grid) => {
    const pageIndex = Number(grid.dataset.homeGrid);
    revokeGridObjectUrls(grid);
    grid.replaceChildren(...homeDescriptors(pageIndex).map(createAppIcon));
  });
  const dock = root === fakeHomeEl ? phoneDock : root.querySelector('.phone-dock');
  if (dock) {
    revokeGridObjectUrls(dock);
    dock.replaceChildren(...HOME_MANIFEST.dock.map((entry) => {
      const app = document.createElement('span');
      app.className = 'dock-app';
      const glyph = document.createElement('img');
      glyph.className = 'dock-glyph';
      glyph.src = iconSrc(entry.file);
      glyph.alt = '';
      glyph.draggable = false;
      app.append(glyph);
      return app;
    }));
  }
  if (real) {
    fakeHomeEl.dataset.ready = 'true';
    realHomeIconStamp = iconCacheRaw;
  }
}

function bindUserIcons() {
  document.getElementById('usericon-file').addEventListener('change', (event) => { onIconFile(event); });
  document.getElementById('usericon-add').addEventListener('click', onIconAdd);
  document.getElementById('usericon-cancel').addEventListener('click', closeIconEditor);
  iconPage.addEventListener('change', renderSlotPicker);
  bindIconCropper();
}

export { syncUserIconsFromStorage, renderUserIcons, ensureFakeHomeIcons, bindUserIcons };
