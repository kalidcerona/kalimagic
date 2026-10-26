// Preset form, selection, edit, delete and save.
import {
  LIMITS, MESSAGES, canAddPreset, createId, validateImage, validatePresetInput,
} from './logic.js';
import {
  editorForm, legend, nameInput, fileInput, fileStatus, preview, modeInput, brushInput, brushReadout,
  hiddenEnable, hiddenInput, hiddenReadout, saveButton, cancelEdit,
} from './dom.js';
import { setError, setStatus } from './status.js';
import { liveUrls, revokeUrl } from './images.js';
import { putImage, deleteImage } from './image-db.js';
import { syncControls, updateModeHint, renderList } from './presets.js';
import {
  meta, storageLocked, corrupt, busy, formMode, editingId, armDeleteId, previewUrl,
  setBusy, setFormMode, setEditingId, setArmDeleteId, setPreviewUrl,
} from './controller-state.js';
import { commitMeta } from './storage-commit.js';

export function revokeAllUrls() {
  for (const url of liveUrls) URL.revokeObjectURL(url);
  liveUrls.clear();
  setPreviewUrl(null);
}

export function resetForm() {
  setFormMode('create');
  setEditingId(null);
  editorForm.reset();
  revokeUrl(previewUrl);
  setPreviewUrl(null);
  preview.hidden = true;
  preview.removeAttribute('src');
  brushInput.value = String(LIMITS.defaultBrush);
  hiddenInput.value = '100';
  hiddenInput.disabled = true;
  hiddenEnable.checked = false;
  brushReadout.textContent = String(LIMITS.defaultBrush);
  hiddenReadout.textContent = '100';
  fileStatus.textContent = '선택된 파일 없음';
  legend.textContent = '새 프리셋';
  saveButton.textContent = '프리셋 저장';
  cancelEdit.hidden = true;
  updateModeHint();
}

export function selectPreset(id) {
  setArmDeleteId(null);
  if (storageLocked || corrupt) {
    setError(storageLocked ? MESSAGES.storageReadFailed : MESSAGES.metaCorrupt);
    renderList();
    return;
  }
  const item = meta.presets.find((preset) => preset.id === id);
  if (!item) return;
  if (meta.selectedId !== id) {
    const next = { version: 1, selectedId: id, presets: meta.presets.slice() };
    if (!commitMeta(next)) {
      renderList();
      return;
    }
  }
  setStatus(`선택했습니다: ${item.name}`);
  renderList();
}

export function editPreset(id) {
  setArmDeleteId(null);
  const item = meta.presets.find((preset) => preset.id === id);
  if (!item || storageLocked || corrupt) return;
  resetForm();
  setFormMode('edit');
  setEditingId(id);
  nameInput.value = item.name;
  modeInput.value = item.mode;
  brushInput.value = String(item.brushSize);
  brushReadout.textContent = String(item.brushSize);
  if (item.hiddenPercent == null) {
    hiddenEnable.checked = false;
    hiddenInput.disabled = true;
    hiddenInput.value = '100';
  } else {
    hiddenEnable.checked = true;
    hiddenInput.disabled = false;
    hiddenInput.value = String(item.hiddenPercent);
  }
  hiddenReadout.textContent = hiddenInput.value;
  fileStatus.textContent = '현재 이미지가 저장되어 있습니다. 바꾸려면 새 파일을 고르세요.';
  legend.textContent = '프리셋 수정';
  saveButton.textContent = '수정 내용 저장';
  cancelEdit.hidden = false;
  updateModeHint();
  renderList();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  editorForm.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

async function commitDelete(id) {
  if (busy) return;
  const target = meta.presets.find((item) => item.id === id);
  if (!target) return;
  setBusy(true);
  syncControls();
  try {
    const presets = meta.presets.filter((item) => item.id !== id);
    const selectedId = meta.selectedId === id
      ? (presets[0] ? presets[0].id : null)
      : meta.selectedId;
    if (!commitMeta({ version: 1, selectedId, presets })) return;
    if (editingId === id) resetForm();
    try {
      await deleteImage(target.imageId);
      setStatus('프리셋을 삭제했습니다.');
    } catch {
      setError(MESSAGES.imageDeleteFailed);
    }
    renderList();
  } finally {
    setBusy(false);
    syncControls();
  }
}

export function deletePreset(id) {
  if (storageLocked || corrupt) {
    setError(storageLocked ? MESSAGES.storageReadFailed : MESSAGES.metaCorrupt);
    return;
  }
  if (armDeleteId !== id) {
    setArmDeleteId(id);
    renderList();
    return;
  }
  setArmDeleteId(null);
  void commitDelete(id);
}

export function onFileChange() {
  revokeUrl(previewUrl);
  setPreviewUrl(null);
  preview.hidden = true;
  preview.removeAttribute('src');
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    fileStatus.textContent = editingId
      ? '현재 이미지가 저장되어 있습니다. 바꾸려면 새 파일을 고르세요.'
      : '선택된 파일 없음';
    return;
  }
  const checked = validateImage({ bytes: file.size, mime: file.type }, { required: true });
  if (!checked.ok) {
    fileInput.value = '';
    fileStatus.textContent = editingId
      ? '현재 이미지가 저장되어 있습니다. 바꾸려면 새 파일을 고르세요.'
      : '선택된 파일 없음';
    setError(checked.error);
    return;
  }
  setPreviewUrl(URL.createObjectURL(file));
  liveUrls.add(previewUrl);
  preview.src = previewUrl;
  preview.hidden = false;
  fileStatus.textContent = `선택한 파일: ${file.name}`;
  setStatus('이미지를 확인했습니다. 저장하기 전에는 반영되지 않습니다.');
}

export async function savePreset() {
  if (busy || storageLocked || corrupt) return;
  const editing = formMode === 'edit'
    ? meta.presets.find((item) => item.id === editingId)
    : null;
  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  const validated = validatePresetInput({
    name: nameInput.value,
    mode: modeInput.value,
    brushSize: brushInput.value,
    hiddenPercent: hiddenEnable.checked ? hiddenInput.value : null,
    hasImage: Boolean(file),
    imageBytes: file ? file.size : null,
    imageMime: file ? file.type : '',
    imageRequired: !editing,
  });
  if (!validated.ok) {
    setError(validated.error);
    return;
  }
  if (!editing && !canAddPreset(meta.presets.length)) {
    setError(MESSAGES.tooManyPresets);
    return;
  }

  setBusy(true);
  syncControls();
  let wroteNewImage = false;
  let imageId = editing ? editing.imageId : null;
  let imageMime = editing ? editing.imageMime : null;
  const previousImageId = editing ? editing.imageId : null;
  try {
    if (file) {
      let buffer;
      try {
        buffer = await file.arrayBuffer();
      } catch {
        setError(MESSAGES.imageStoreFailed);
        return;
      }
      if (buffer.byteLength <= 0) {
        setError(MESSAGES.imageEmpty);
        return;
      }
      if (buffer.byteLength > LIMITS.maxImageBytes) {
        setError(MESSAGES.imageTooLarge);
        return;
      }
      const blob = new Blob([buffer], { type: validated.value.image.mime });
      imageId = createId('img');
      imageMime = validated.value.image.mime;
      try {
        await putImage(imageId, blob);
        wroteNewImage = true;
      } catch {
        setError(MESSAGES.imageStoreFailed);
        return;
      }
    }
    if (!imageId || !imageMime) {
      setError(MESSAGES.imageRequired);
      return;
    }
    const preset = {
      id: editing ? editing.id : createId('p'),
      name: validated.value.name,
      mode: validated.value.mode,
      brushSize: validated.value.brushSize,
      hiddenPercent: validated.value.hiddenPercent,
      imageId,
      imageMime,
      updatedAt: Date.now(),
    };
    const presets = editing
      ? meta.presets.map((item) => (item.id === editing.id ? preset : item))
      : [...meta.presets, preset];
    if (!commitMeta({ version: 1, selectedId: preset.id, presets })) {
      if (wroteNewImage) {
        try { await deleteImage(imageId); } catch { /* previous metadata remains */ }
      }
      return;
    }
    if (wroteNewImage && previousImageId && previousImageId !== imageId) {
      try {
        await deleteImage(previousImageId);
      } catch {
        setStatus(MESSAGES.previousImageKept);
        resetForm();
        renderList();
        return;
      }
    }
    setStatus(MESSAGES.saved);
    resetForm();
    renderList();
  } finally {
    setBusy(false);
    syncControls();
  }
}
