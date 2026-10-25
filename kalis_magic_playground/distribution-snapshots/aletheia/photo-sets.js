import { cardAtIndex, validateImage } from './logic.js';
import { createDeckSlots } from './deck-loader.js';
import {
  meta, corrupt, storageLocked, busy, customIds, customCorrupt, saveCustomSlot,
  startCustomPerformance,
} from './controller.js';
import {
  PHOTO_SET_COUNT, CUSTOM_COUNT, IMAGE_ID_RE, errorBox, customSlotsRoot, customStartButtons,
  customReadyHints, customRepair,
} from './dom.js';
import { setError, setStatus } from './status.js';
import { liveUrls, revokeUrl, loadKeptImage } from './images.js';
import { getImage } from './image-db.js';
import { slotLabel } from './court-cards.js';

const customSlots = [];
const customPendingFiles = Array.from({ length: CUSTOM_COUNT * PHOTO_SET_COUNT }, () => null);
const customPendingUrls = Array.from({ length: CUSTOM_COUNT * PHOTO_SET_COUNT }, () => null);
const customStoredUrls = Array.from({ length: CUSTOM_COUNT * PHOTO_SET_COUNT }, () => null);

function setIds(setIndex) {
  return customIds.slice(setIndex * CUSTOM_COUNT, (setIndex + 1) * CUSTOM_COUNT);
}

function customDeckReady(setIndex) {
  return !customCorrupt && setIds(setIndex).every((id) => typeof id === 'string' && id);
}

function syncCustomControls() {
  for (let setIndex = 0; setIndex < PHOTO_SET_COUNT; setIndex += 1) {
    const ready = customDeckReady(setIndex);
    const button = customStartButtons[setIndex];
    const hint = customReadyHints[setIndex];
    if (button) button.disabled = busy || storageLocked || !ready;
    if (hint) {
      const filled = setIds(setIndex).filter(Boolean).length;
      hint.textContent = customCorrupt
        ? '저장된 사진 정보를 해석할 수 없습니다. 원본 데이터는 유지됩니다.'
        : ready ? '12장이 준비되었습니다.' : `사진 ${filled}/12장 저장됨 · 12장이 모두 있어야 연출할 수 있습니다.`;
    }
  }
  const slotLocked = busy || storageLocked || customCorrupt;
  for (const slot of customSlots) {
    slot.file.disabled = slotLocked;
    slot.button.disabled = slotLocked;
  }
  if (customRepair) customRepair.hidden = !customCorrupt;
}

function setSlotStatus(index, message) {
  const slot = customSlots[index];
  if (!slot) return;
  slot.status.textContent = message;
}

function showSlotImage(index) {
  const slot = customSlots[index];
  if (!slot) return;
  const url = customPendingUrls[index] || customStoredUrls[index];
  if (!url) {
    slot.preview.hidden = true;
    slot.preview.removeAttribute('src');
    return;
  }
  slot.preview.alt = `${Math.floor(index / CUSTOM_COUNT) + 1}세트 ${index % CUSTOM_COUNT + 1}번 칸 미리보기`;
  slot.preview.src = url;
  slot.preview.hidden = false;
}

function updateSlotAction(index) {
  const slot = customSlots[index];
  if (!slot) return;
  const filled = typeof customIds[index] === 'string' && customIds[index];
  slot.button.textContent = filled ? '이 칸 사진 바꾸기' : '이 칸에 올리기';
}

function renderCustomSlots() {
  if (!customSlotsRoot || customSlots.length) return;
  for (let index = 0; index < CUSTOM_COUNT * PHOTO_SET_COUNT; index += 1) {
    const setIndex = Math.floor(index / CUSTOM_COUNT);
    const slotNumber = index % CUSTOM_COUNT;
    if (slotNumber === 0) {
      const details = document.createElement('details');
      details.className = 'photo-set';
      const summary = document.createElement('summary');
      summary.textContent = `사진 세트 ${setIndex + 1}`;
      const slots = document.createElement('div');
      slots.className = 'custom-slots';
      const hint = document.createElement('p');
      hint.className = 'hint';
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'primary photo-set-start';
      start.textContent = '이 세팅으로 연출하기';
      start.addEventListener('click', () => { void startCustomPerformance(setIndex); });
      details.append(summary, hint, start, slots);
      customSlotsRoot.append(details);
      customReadyHints.push(hint);
      customStartButtons.push(start);
    }
    const card = cardAtIndex(slotNumber);
    const code = card ? slotLabel(card) : String(slotNumber + 1);
    const article = document.createElement('article');
    article.className = 'custom-slot';
    article.dataset.slot = String(index);

    const title = document.createElement('h3');
    title.textContent = card
      ? `${card.guide} = ${code} · ${card.label}`
      : `${slotNumber + 1}`;

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png,image/webp,image/gif';
    file.setAttribute('aria-label', `${setIndex + 1}세트 ${slotNumber + 1}번 ${code} 사진 파일`);

    const status = document.createElement('p');
    status.className = 'hint slot-status';
    status.textContent = '저장된 사진 없음';

    const preview = document.createElement('img');
    preview.className = 'preview';
    preview.alt = '';
    preview.hidden = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = '이 칸에 올리기';

    article.append(title, file, status, preview, button);
    customSlotsRoot.lastElementChild.querySelector('.custom-slots').append(article);
    customSlots.push({ file, status, preview, button });

    file.addEventListener('change', () => onCustomFile(index));
    button.addEventListener('click', () => {
      void saveCustomSlot(index);
    });
    preview.addEventListener('error', () => {
      const current = customPendingUrls[index] || customStoredUrls[index];
      if (!current || preview.src !== current) return;
      if (customPendingUrls[index]) {
        setSlotStatus(index, '선택한 파일을 미리볼 수 없습니다. 이 칸은 바꾸지 않았습니다.');
        return;
      }
      setSlotStatus(index, '이 칸의 저장된 사진을 열 수 없습니다. 데이터는 바꾸지 않았습니다.');
    });
  }
}

function onCustomFile(index) {
  const slot = customSlots[index];
  if (!slot || busy || storageLocked || customCorrupt) return;
  revokeUrl(customPendingUrls[index]);
  customPendingUrls[index] = null;
  customPendingFiles[index] = null;
  const file = slot.file.files && slot.file.files[0];
  if (!file) {
    setSlotStatus(index, customIds[index]
      ? '저장된 사진이 있습니다. 바꾸려면 새 파일을 고르세요.'
      : '선택된 파일 없음');
    showSlotImage(index);
    return;
  }
  const checked = validateImage({ bytes: file.size, mime: file.type }, { required: true });
  if (!checked.ok) {
    slot.file.value = '';
    setError(checked.error);
    setSlotStatus(index, checked.error);
    showSlotImage(index);
    return;
  }
  customPendingFiles[index] = file;
  customPendingUrls[index] = URL.createObjectURL(file);
  liveUrls.add(customPendingUrls[index]);
  showSlotImage(index);
  setSlotStatus(index, `선택한 파일: ${file.name}. 아직 저장되지 않았습니다.`);
  setStatus('파일을 확인했습니다. 이 칸의 올리기 또는 바꾸기를 눌러야 저장됩니다.');
}

function customIdStillUsed(id) {
  if (!id) return false;
  if (customIds.includes(id)) return true;
  if (!corrupt && meta.presets.some((preset) => preset.imageId === id)) return true;
  return false;
}

async function refreshSlotPreview(index) {
  const id = customIds[index];
  revokeUrl(customStoredUrls[index]);
  customStoredUrls[index] = null;
  updateSlotAction(index);
  if (typeof id !== 'string' || !id) {
    if (!customPendingFiles[index]) {
      setSlotStatus(index, '저장된 사진 없음');
      showSlotImage(index);
    }
    return true;
  }
  let record;
  try {
    record = await getImage(id);
  } catch {
    setSlotStatus(index, '이 칸의 사진을 불러오지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
    showSlotImage(index);
    return false;
  }
  const blob = record && record.blob;
  if (!(blob instanceof Blob) || blob.size <= 0) {
    setSlotStatus(index, '이 칸의 저장 파일을 찾지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
    showSlotImage(index);
    return false;
  }
  const url = URL.createObjectURL(blob);
  customStoredUrls[index] = url;
  liveUrls.add(url);
  if (!customPendingFiles[index]) {
    setSlotStatus(index, '저장된 사진이 있습니다.');
  }
  showSlotImage(index);
  return true;
}

async function refreshCustomPreviews() {
  let failed = false;
  for (let index = 0; index < CUSTOM_COUNT * PHOTO_SET_COUNT; index += 1) {
    const ok = await refreshSlotPreview(index);
    if (!ok) failed = true;
  }
  if (failed && errorBox.hidden) {
    setError('일부 칸의 사진을 표시하지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
  }
}

function createCustomDeckSlots(setIndex) {
  const loaders = Array.from({ length: CUSTOM_COUNT }, (_, index) => async () => {
    const id = customIds[setIndex * CUSTOM_COUNT + index];
    if (typeof id !== 'string' || !IMAGE_ID_RE.test(id)) throw new Error('missing');
    let record;
    try {
      record = await getImage(id);
    } catch {
      throw new Error('read');
    }
    const blob = record && record.blob;
    if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('missing');
    const url = URL.createObjectURL(blob);
    liveUrls.add(url);
    try {
      return { image: await loadKeptImage(url), url };
    } catch (error) {
      revokeUrl(url);
      throw error;
    }
  });
  return createDeckSlots(loaders, ({ image, url }) => {
    if (url) revokeUrl(url);
    if (image) image.src = '';
  });
}

export {
  customSlots, customPendingFiles, customPendingUrls, customDeckReady, syncCustomControls,
  setSlotStatus, renderCustomSlots, customIdStillUsed, refreshSlotPreview, refreshCustomPreviews,
  createCustomDeckSlots,
};
