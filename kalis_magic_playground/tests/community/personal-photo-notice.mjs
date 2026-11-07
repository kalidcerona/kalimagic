// Job I, 2026-11-07: photo-save diagnostics ship in personal apps only.
// These save-path files gain recording hooks; snapshots retain their pre-I bytes.
// HTML and SW differences are stripped and still compared in full.
export const PHOTO_NOTICE_SAVE_FILES = {
  choice: ['logic-user-icons.js', 'user-icons.js', 'wallpaper.js', 'previews.js'],
  unlock: ['images.js'],
};
export { stripPhotoSaveNotice } from '../../scripts/friend-builds.mjs';
