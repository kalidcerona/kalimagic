// Photo-save diagnostics stay inside settings; never alter the performance surface.
const PHOTO_SAVE_NOTICE_KEY = 'choice.photo-save-failed.v1';
const PHOTO_SAVE_NOTICE_TEXT = '저장 공간이 부족해 사진을 저장하지 못했어요';
let photoNoticePending;
function browserStorage(name) {
  try { return globalThis[name]; } catch { return undefined; }
}
function savedFlag(storage) {
  try { return Number(storage?.getItem(PHOTO_SAVE_NOTICE_KEY)) > 0; } catch { return false; }
}
function renderPhotoSaveNotice(storage = browserStorage('localStorage')) {
  const failed = photoNoticePending ?? (savedFlag(storage) || savedFlag(browserStorage('sessionStorage')));
  if (typeof document === 'undefined') return;
  const line = document.getElementById?.('photo-save-notice');
  if (line) {
    line.textContent = failed ? PHOTO_SAVE_NOTICE_TEXT : '';
    line.hidden = !failed;
  }
}
function recordPhotoSave(ok, storage = browserStorage('localStorage')) {
  photoNoticePending = !ok;
  const timestamp = String(Date.now());
  // Session storage is a fallback when even a tiny localStorage write is refused.
  // Neither diagnostics nor a blocked storage getter may change the original save result.
  for (const target of new Set([storage, browserStorage('sessionStorage')])) {
    try {
      if (ok) target?.removeItem(PHOTO_SAVE_NOTICE_KEY);
      else target?.setItem(PHOTO_SAVE_NOTICE_KEY, timestamp);
    } catch { /* Retain the notice in memory if all storage is unavailable. */ }
  }
  renderPhotoSaveNotice(storage);
}
async function trackPhotoSave(save) {
  try {
    const result = await save();
    recordPhotoSave(true);
    return result;
  } catch (error) {
    recordPhotoSave(false);
    throw error;
  }
}
renderPhotoSaveNotice();

export { PHOTO_SAVE_NOTICE_KEY, PHOTO_SAVE_NOTICE_TEXT, renderPhotoSaveNotice, recordPhotoSave, trackPhotoSave };
