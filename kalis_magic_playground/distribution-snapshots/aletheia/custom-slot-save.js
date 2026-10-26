// Saving one custom photo slot.
import { LIMITS, MESSAGES, cardAtIndex, createId, validateImage } from './logic.js';
import { CUSTOM_COUNT } from './dom.js';
import { setError, setStatus } from './status.js';
import { revokeUrl } from './images.js';
import { putImage, deleteImage } from './image-db.js';
import { syncControls } from './presets.js';
import {
  customSlots, customPendingFiles, customPendingUrls, setSlotStatus, customIdStillUsed,
  refreshSlotPreview,
} from './photo-sets.js';
import { slotLabel } from './court-cards.js';
import {
  corrupt, storageLocked, busy, customIds, customCorrupt, setBusy,
} from './controller-state.js';
import { commitCustom } from './storage-commit.js';

export async function saveCustomSlot(index) {
  if (busy || storageLocked || customCorrupt) return;
  const slot = customSlots[index];
  const file = customPendingFiles[index];
  if (!file) {
    const message = '올릴 사진을 먼저 고르세요. 이 칸은 바꾸지 않았습니다.';
    setSlotStatus(index, message);
    setError(message);
    return;
  }
  const checked = validateImage({ bytes: file.size, mime: file.type }, { required: true });
  if (!checked.ok) {
    setSlotStatus(index, checked.error);
    setError(checked.error);
    return;
  }
  setBusy(true);
  syncControls();
  let wroteNewImage = false;
  let imageId = null;
  try {
    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      setError(MESSAGES.imageStoreFailed);
      setSlotStatus(index, '이미지를 읽지 못했습니다. 이 칸은 바꾸지 않았습니다.');
      return;
    }
    if (buffer.byteLength <= 0) {
      setError(MESSAGES.imageEmpty);
      setSlotStatus(index, MESSAGES.imageEmpty);
      return;
    }
    if (buffer.byteLength > LIMITS.maxImageBytes) {
      setError(MESSAGES.imageTooLarge);
      setSlotStatus(index, MESSAGES.imageTooLarge);
      return;
    }
    const blob = new Blob([buffer], { type: checked.value.mime });
    imageId = createId('img');
    try {
      await putImage(imageId, blob);
      wroteNewImage = true;
    } catch {
      const message = '사진을 저장하지 못했습니다. 이 칸과 프리셋은 바꾸지 않았습니다.';
      setError(message);
      setSlotStatus(index, message);
      return;
    }
    const previousId = customIds[index];
    const next = customIds.slice();
    next[index] = imageId;
    // Store the blob first. Metadata is the commit point; roll back the new blob if it fails.
    if (!commitCustom(next)) {
      if (wroteNewImage) {
        try {
          await deleteImage(imageId);
        } catch {
          setError('사진 목록 저장에 실패했습니다. 방금 저장한 파일을 지우지 못했지만, 이 칸은 이전 사진을 유지합니다.');
        }
      }
      setSlotStatus(index, '저장에 실패했습니다. 이 칸의 이전 사진은 유지됩니다.');
      return;
    }
    if (slot) slot.file.value = '';
    revokeUrl(customPendingUrls[index]);
    customPendingUrls[index] = null;
    customPendingFiles[index] = null;
    let keptReason = null;
    if (previousId && previousId !== imageId) {
      if (corrupt) keptReason = 'corrupt';
      else if (customIdStillUsed(previousId)) keptReason = 'shared';
      else {
        try {
          await deleteImage(previousId);
        } catch {
          keptReason = 'failed';
        }
      }
    }
    const previewOk = await refreshSlotPreview(index);
    if (!previewOk) {
      setError('이 칸은 새 사진으로 저장했습니다. 미리보기만 만들지 못했고, 저장된 데이터는 되돌리지 않았습니다.');
      return;
    }
    const code = cardAtIndex(index % CUSTOM_COUNT) ? slotLabel(cardAtIndex(index % CUSTOM_COUNT)) : '';
    if (keptReason === 'corrupt') {
      setStatus('이 칸은 새 사진으로 바꿨습니다. 프리셋 정보를 해석할 수 없어 이전 사진 파일은 지우지 않았습니다.');
      return;
    }
    if (keptReason === 'shared') {
      setStatus('이 칸은 새 사진으로 바꿨습니다. 이전 파일은 다른 칸이나 프리셋이 쓰고 있어 지우지 않았습니다.');
      return;
    }
    if (keptReason === 'failed') {
      setStatus('이 칸은 새 사진으로 바꿨습니다. 이전 사진 파일은 지우지 못했습니다.');
      return;
    }
    setStatus(`${Math.floor(index / CUSTOM_COUNT) + 1}세트 ${index % CUSTOM_COUNT + 1}번 칸(${code})을 저장했습니다.`);
  } finally {
    setBusy(false);
    syncControls();
  }
}
