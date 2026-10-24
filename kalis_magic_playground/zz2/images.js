import { $, session } from './session.js';

const toast = (...args) => session.toast(...args);
const applyAppearance = (...args) => session.applyAppearance(...args);
const formSettings = (...args) => session.formSettings(...args);
const STORAGE = session.STORAGE;
const originals = new Map();
const imageURLs = new Map();
const previewURLs = new Map();
const previewBlobs = new Map();
const imageVersions = new Map();
const decodedImages = new WeakMap();
const preparedImages = new Map();
const appliedImages = new Map();
const imageKeys = ['lock', 'unlock', 'home2'];
session.originals = originals;
session.imageKeys = imageKeys;

    function setFilePickerState(key, registered) {
      const pickerLabel = $(`${key}-file`)?.parentElement?.querySelector('.file-picker-label');
      if (pickerLabel) pickerLabel.textContent = registered ? '다시 선택' : '이미지 선택';
    }

    function openDB() {
      return new Promise((resolve, reject) => {
        let blocked = false;
        const request = indexedDB.open(STORAGE.imageDb, 1);
        const timeout = setTimeout(() => {
          blocked = true;
          reject(new Error('이미지 저장소 응답이 늦습니다. 다시 열거나 기본 배경으로 공연해 주세요.'));
        }, 2500);
        request.onupgradeneeded = () => request.result.createObjectStore('images');
        request.onsuccess = () => {
          clearTimeout(timeout);
          if (blocked) request.result.close();
          else resolve(request.result);
        };
        request.onerror = () => { clearTimeout(timeout); reject(request.error); };
        request.onblocked = () => {
          clearTimeout(timeout);
          blocked = true;
          reject(new Error('다른 레리즈 창을 닫고 다시 실행해 주세요.'));
        };
      });
    }

    function readImage(key) {
      return new Promise((resolve, reject) => {
        const request = session.db.transaction('images').objectStore('images').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    function saveImage(key, blob) {
      return new Promise((resolve, reject) => {
        const transaction = session.db.transaction('images', 'readwrite');
        transaction.objectStore('images').put(blob, key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    }

    function decodeImage(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
        img.src = url;
      });
    }

    function decodedImage(blob) {
      if (!decodedImages.has(blob)) {
        const promise = decodeImage(blob).catch((error) => { decodedImages.delete(blob); throw error; });
        decodedImages.set(blob, promise);
      }
      return decodedImages.get(blob);
    }

    function preparedImage(key, blob, cropTop) {
      const existing = preparedImages.get(key);
      if (existing?.blob === blob && existing.cropTop === cropTop) return existing.promise;
      const entry = { blob, cropTop, promise: null };
      entry.promise = decodedImage(blob).then(async (img) => {
        let displayBlob = blob;
        const crop = Math.min(cropTop, img.naturalHeight - 1);
        if (crop > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight - crop;
          canvas.getContext('2d').drawImage(img, 0, crop, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          displayBlob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('이미지 처리 실패')), 'image/png'));
        }
        return { displayBlob, width: img.naturalWidth, height: img.naturalHeight };
      }).catch((error) => { if (preparedImages.get(key) === entry) preparedImages.delete(key); throw error; });
      preparedImages.set(key, entry);
      return entry.promise;
    }

    async function displayImage(key, cropTop, hydration = false) {
      const blob = originals.get(key);
      if (!blob) {
        setFilePickerState(key, false);
        $(`${key}-info`).textContent = '기본 배경 사용 · 사진을 등록하면 이 기기에 저장됩니다.';
        return;
      }
      const version = (imageVersions.get(key) ?? 0) + 1;
      imageVersions.set(key, version);
      const prepared = await preparedImage(key, blob, cropTop);
      if (imageVersions.get(key) !== version || originals.get(key) !== blob) return;
      const preview = $(`${key}-preview`);
      if (previewBlobs.get(key) !== blob) {
        const previewURL = URL.createObjectURL(blob);
        const previousPreviewURL = previewURLs.get(key);
        previewURLs.set(key, previewURL);
        previewBlobs.set(key, blob);
        preview.src = previewURL;
        preview.hidden = false;
        if (previousPreviewURL) URL.revokeObjectURL(previousPreviewURL);
      }
      preview.closest('.preview').dataset.naturalHeight = prepared.height;
      $(`${key}-info`).textContent = `등록됨 · ${prepared.width} × ${prepared.height}`;
      setFilePickerState(key, true);
      // A late storage read must not change the audience's scene mid-gesture.
      if (hydration && session.performanceTouched && session.screen !== 'settings') return;
      const applied = appliedImages.get(key);
      if (applied?.blob === blob && applied.cropTop === cropTop) return;
      const url = URL.createObjectURL(prepared.displayBlob);
      const previous = imageURLs.get(key);
      imageURLs.set(key, url);
      appliedImages.set(key, { blob, cropTop });
      $(`${key}-image`).src = url;
      $(`${key}-image`).hidden = false;
      if (key === 'lock') { $('time-wallpaper').src = url; $('time-wallpaper').hidden = false; }
      if (previous) URL.revokeObjectURL(previous);
      applyAppearance(session.screen === 'settings' ? formSettings() : session.settings);
    }

    async function refreshCroppedImages() {
      try { await Promise.all(imageKeys.map((key) => displayImage(key, formSettings().cropTop))); }
      catch { $('storage-status').textContent = '미리보기 처리 실패. 잘라낼 높이와 이미지를 확인하세요.'; }
    }

    let alignmentDrag = null;
    for (const preview of document.querySelectorAll('.preview')) {
      preview.addEventListener('pointerdown', (event) => {
        const naturalHeight = Number(preview.dataset.naturalHeight);
        if (!(naturalHeight > 0)) { toast('먼저 이미지를 등록하세요.'); return; }
        const rect = preview.getBoundingClientRect();
        const boundaryY = rect.top + rect.height * formSettings().cropTop / naturalHeight;
        const cropMode = event.target.closest('.crop-handle') || Math.abs(event.clientY - boundaryY) <= 22;
        alignmentDrag = {
          preview, mode: cropMode ? 'crop' : 'position', startY: event.clientY,
          startPosition: formSettings().imagePosition, naturalHeight,
        };
        preview.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      preview.addEventListener('pointermove', (event) => {
        if (!alignmentDrag || alignmentDrag.preview !== preview) return;
        const rect = preview.getBoundingClientRect();
        if (alignmentDrag.mode === 'crop') {
          const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
          $('crop').value = Math.min(2000, Math.round(ratio * alignmentDrag.naturalHeight));
        } else {
          const next = alignmentDrag.startPosition - (event.clientY - alignmentDrag.startY) / rect.height * 100;
          $('position').value = Math.round(Math.max(0, Math.min(100, next)));
        }
        applyAppearance(formSettings());
        event.preventDefault();
      });
      const finishAlignmentDrag = (event) => {
        if (!alignmentDrag || alignmentDrag.preview !== preview) return;
        const shouldCrop = alignmentDrag.mode === 'crop';
        alignmentDrag = null;
        if (preview.hasPointerCapture(event.pointerId)) preview.releasePointerCapture(event.pointerId);
        if (shouldCrop) refreshCroppedImages();
      };
      preview.addEventListener('pointerup', finishAlignmentDrag);
      preview.addEventListener('pointercancel', finishAlignmentDrag);
      preview.querySelector('.crop-handle').addEventListener('keydown', (event) => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        const step = event.shiftKey ? 10 : 1;
        $('crop').value = Math.max(0, Math.min(2000, formSettings().cropTop + (event.key === 'ArrowDown' ? step : -step)));
        applyAppearance(formSettings());
        refreshCroppedImages();
        event.preventDefault();
      });
    }

    for (const key of imageKeys) {
      $(`${key}-file`).addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        let stored = false;
        session.pendingImages += 1;
        event.target.disabled = true;
        $('start').disabled = true;
        try {
          if (!session.db && session.dbReady) await session.dbReady;
          if (!session.db) throw new Error('이미지 저장소를 사용할 수 없습니다.');
          await decodedImage(file);
          await saveImage(key, file);
          stored = true;
          originals.set(key, file);
          setFilePickerState(key, true);
          await displayImage(key, formSettings().cropTop);
          $('storage-status').textContent = '이미지를 이 기기의 IndexedDB에 저장했습니다.';
        } catch (error) {
          $('storage-status').textContent = stored
            ? '이미지는 저장했지만 미리보기를 만들지 못했습니다. 잘라낼 높이를 줄이고 다시 시작하세요.'
            : `이미지 등록 실패: ${error.message} 저장 공간과 파일 형식을 확인하세요.`;
        } finally {
          session.pendingImages -= 1;
          event.target.disabled = false;
          $('start').disabled = session.pendingImages > 0;
          event.target.value = '';
        }
      });
    }

Object.assign(session, {
  setFilePickerState, openDB, readImage, saveImage, decodeImage, decodedImage,
  preparedImage, displayImage, refreshCroppedImages,
});
