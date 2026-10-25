import { LIMITS, defaultPreset, nextPresetName, sanitizePreset } from './logic.js';
import {
  presetList, presetPicker, presetEditor, selectedPresetName, nameInput, sizeInput, sizeValue,
  xInput, xValue, yInput, yValue, fadeInput, fadeValue, durationInput, durationValue, edgeGroup,
  note, addButton, coinArt,
} from './dom.js';
import { state, selected, replaceSelected, persist } from './state-store.js';
import { imageChoices, imageRecord, useImageUrl, chosenCoin, refreshCoinImage, persistImageChoices } from './images.js';
import { paintLiveCoin } from './coin-paint.js';
import { phase, objectLive } from './performance.js';

let deleteArmed = false;
let deleteTimer = 0;
let presetSerial = 0;
function createPresetId() {
  presetSerial += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `preset-${Date.now().toString(36)}-${presetSerial.toString(36)}-${random}`;
}

function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

function clearDeleteArm() {
  deleteArmed = false;
  window.clearTimeout(deleteTimer);
}

function renderList() {
  const focusInside = presetList.contains(document.activeElement);
  presetList.replaceChildren();
  for (const [index, preset] of state.presets.entries()) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.dataset.id = preset.id;
    button.textContent = `${index + 1}. ${preset.name}`;
    const pressed = preset.id === state.selectedId;
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.addEventListener('click', () => selectPreset(preset.id));
    item.append(button);
    presetList.append(item);
  }
  addButton.hidden = state.presets.length >= 3;
  if (focusInside) presetList.querySelector('[aria-pressed="true"]')?.focus();
}

function updateReadouts(preset) {
  sizeValue.textContent = formatPercent(preset.coinSize);
  xValue.textContent = formatPercent(preset.startX);
  yValue.textContent = formatPercent(preset.startY);
  fadeValue.textContent = formatPercent(preset.fadeDistance);
  durationValue.textContent = `${(preset.disappearDuration / 1000).toFixed(2)}초`;
}

function fillForm() {
  const preset = selected();
  selectedPresetName.textContent = preset.name;
  nameInput.value = preset.name;
  sizeInput.value = String(preset.coinSize);
  xInput.value = String(preset.startX);
  yInput.value = String(preset.startY);
  fadeInput.value = String(preset.fadeDistance);
  durationInput.value = String(preset.disappearDuration);
  updateReadouts(preset);
  refreshCoinImage();
  for (const button of edgeGroup.querySelectorAll('.edge')) {
    const on = button.dataset.edge === preset.exitEdge;
    button.setAttribute('aria-checked', on ? 'true' : 'false');
    button.tabIndex = on ? 0 : -1;
  }
}

function selectPreset(id) {
  if (!state.presets.some((preset) => preset.id === id)) return;
  state.selectedId = id;
  clearDeleteArm();
  note.textContent = '';
  persist();
  renderList();
  fillForm();
  presetPicker.open = true;
}

function labelFor(id) {
  const buttons = presetList.querySelectorAll('.preset');
  for (const button of buttons) {
    if (button.dataset.id === id) return button;
  }
  return null;
}

function commitName(fallbackEmpty) {
  const limited = Array.from(nameInput.value).slice(0, LIMITS.nameLength).join('');
  if (limited !== nameInput.value) nameInput.value = limited;
  if (!limited.trim() && !fallbackEmpty) return;
  const result = sanitizePreset({ ...selected(), name: limited.trim() ? limited : '동전' });
  if (!result.ok) return;
  replaceSelected(result.preset);
  const button = labelFor(result.preset.id);
  if (button) button.textContent = `${state.presets.findIndex((item) => item.id === result.preset.id) + 1}. ${result.preset.name}`;
  if (fallbackEmpty) nameInput.value = result.preset.name;
  persist();
}

function commitNumbers() {
  const result = sanitizePreset({
    ...selected(),
    coinSize: Number(sizeInput.value),
    startX: Number(xInput.value),
    startY: Number(yInput.value),
    fadeDistance: Number(fadeInput.value),
    disappearDuration: Number(durationInput.value),
  });
  if (!result.ok) return;
  replaceSelected(result.preset);
  updateReadouts(result.preset);
  clearDeleteArm();
  persist();
}

// Narrow bridge for the shared customizer. Values stay on the selected preset.
function appearanceNumber(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readAppearance() {
  const preset = selected();
  return {
    coinSize: preset.coinSize,
    startX: preset.startX,
    startY: preset.startY,
  };
}

function previewAspect(choice) {
  if (choice === 'riderRed') return 649 / 929;
  if (choice === 'riderBlue') return 661 / 1038;
  const art = coinArt;
  if (choice === 'custom' && art && art.naturalWidth > 0 && art.naturalHeight > 0) {
    return art.naturalWidth / art.naturalHeight;
  }
  return 1;
}

function previewAppearance() {
  const preset = selected();
  const choice = imageChoices[preset.id] || 'kennedy';
  const image = chosenCoin(preset.id);
  const art = coinArt;
  const loaded = art && art.naturalWidth > 0 && art.naturalHeight > 0
    && typeof art.src === 'string' && art.src.endsWith(String(image).replace(/^\.\//, ''));
  return {
    image,
    widthRatio: preset.coinSize,
    aspectRatio: loaded ? art.naturalWidth / art.naturalHeight : previewAspect(choice),
    startX: preset.startX,
    startY: preset.startY,
  };
}

function updateAppearance(value) {
  const current = selected();
  const patch = value && typeof value === 'object' ? value : {};
  const result = sanitizePreset({
    ...current,
    coinSize: appearanceNumber(patch.coinSize, current.coinSize),
    startX: appearanceNumber(patch.startX, current.startX),
    startY: appearanceNumber(patch.startY, current.startY),
  });
  if (!result.ok) return Promise.resolve(readAppearance());
  replaceSelected(result.preset);
  sizeInput.value = String(result.preset.coinSize);
  xInput.value = String(result.preset.startX);
  yInput.value = String(result.preset.startY);
  updateReadouts(result.preset);
  clearDeleteArm();
  persist();
  if (objectLive && phase === 'idle' && state.mode === 'performance') paintLiveCoin();
  return Promise.resolve(readAppearance());
}

function setEdge(edge) {
  const result = sanitizePreset({ ...selected(), exitEdge: edge });
  if (!result.ok) return;
  replaceSelected(result.preset);
  clearDeleteArm();
  fillForm();
  persist();
}

function addPreset() {
  if (state.presets.length >= 3) return;
  const result = sanitizePreset({
    ...selected(),
    id: createPresetId(),
    name: nextPresetName(state.presets),
  });
  if (!result.ok) return;
  state.presets.push(result.preset);
  state.selectedId = result.preset.id;
  clearDeleteArm();
  note.textContent = '';
  persist();
  renderList();
  fillForm();
  presetPicker.open = true;
  presetEditor.open = true;
}

function deleteSelected() {
  if (!deleteArmed) {
    deleteArmed = true;
    note.textContent = '한 번 더 누르면 이 프리셋을 삭제합니다.';
    window.clearTimeout(deleteTimer);
    deleteTimer = window.setTimeout(() => {
      deleteArmed = false;
      if (note.textContent.startsWith('한 번 더')) note.textContent = '';
    }, 4000);
    return;
  }
  clearDeleteArm();
  const index = state.presets.findIndex((preset) => preset.id === state.selectedId);
  if (index < 0) return;
  const removedId = state.selectedId;
  state.presets.splice(index, 1);
  delete imageChoices[removedId];
  persistImageChoices();
  useImageUrl(`coin:${removedId}`, null);
  imageRecord(`coin:${removedId}`, 'delete').catch(() => {});
  if (state.presets.length === 0) {
    const fresh = defaultPreset();
    fresh.id = createPresetId();
    const sanitized = sanitizePreset(fresh);
    state.presets.push(sanitized.preset);
    state.selectedId = sanitized.preset.id;
    note.textContent = '마지막 프리셋 자리에는 기본 동전을 다시 두었습니다.';
  } else {
    const next = state.presets[Math.min(index, state.presets.length - 1)];
    state.selectedId = next.id;
    note.textContent = '';
  }
  persist();
  renderList();
  fillForm();
}

export {
  renderList, fillForm, commitName, commitNumbers, readAppearance, previewAppearance,
  updateAppearance, setEdge, addPreset, deleteSelected,
};
