// Recovery of unreadable stored presets and full reset of stored data.
import { MESSAGES, emptyMeta, salvageMeta } from './logic.js';
import { STORAGE_KEY, repair, resetStorageButton } from './dom.js';
import { setError, setStatus } from './status.js';
import { deleteImage, clearImages, database } from './image-db.js';
import { syncControls, renderList } from './presets.js';
import {
  meta, storageLocked, busy, customIds, customCorrupt,
  setBusy, setCorrupt, setStorageLocked, setResetArmed,
} from './controller-state.js';
import { commitMeta } from './storage-commit.js';
import { resetForm } from './preset-form.js';

export async function recoverStored() {
  if (storageLocked || busy) return;
  setBusy(true);
  syncControls();
  try {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      setStorageLocked(true);
      setError(MESSAGES.storageReadFailed);
      return;
    }
    const salvaged = salvageMeta(raw);
    if (!commitMeta(salvaged.meta, { replaceStored: true })) return;
    setCorrupt(false);
    repair.hidden = true;
    setResetArmed(false);
    resetStorageButton.textContent = '초기화';
    resetForm();
    setStatus(`복구했습니다. 남긴 프리셋 ${salvaged.kept}개, 제외 ${salvaged.dropped}개. 제외된 이미지는 자동으로 지우지 않았습니다.`);
    renderList();
    try {
      await database();
    } catch {
      setError(`${MESSAGES.dbOpenFailed} 프리셋 목록은 복구된 상태입니다.`);
    }
  } finally {
    setBusy(false);
    syncControls();
  }
}

export async function resetStored() {
  if (storageLocked || busy) return;
  setBusy(true);
  syncControls();
  try {
    const presetImageIds = meta.presets.map((item) => item.imageId);
    const keepCustomImages = customCorrupt || customIds.some((id) => typeof id === 'string' && id);
    if (!commitMeta(emptyMeta(), { replaceStored: true })) return;
    setCorrupt(false);
    repair.hidden = true;
    resetForm();
    try {
      if (!keepCustomImages) {
        await clearImages();
        setStatus('저장소를 초기화했습니다.');
      } else if (customCorrupt) {
        setStatus('프리셋 목록은 비웠습니다. 내 사진 정보를 해석할 수 없어 이미지 파일은 지우지 않았습니다.');
      } else {
        for (const id of presetImageIds) {
          if (!id || customIds.includes(id)) continue;
          await deleteImage(id);
        }
        setStatus('프리셋 목록을 초기화했습니다. 내 사진 12장은 그대로 두었습니다.');
      }
    } catch {
      setError(MESSAGES.resetImagesFailed);
    }
    renderList();
  } finally {
    setBusy(false);
    setResetArmed(false);
    resetStorageButton.textContent = '초기화';
    syncControls();
  }
}
