import { normalizeOptions } from './logic.js';
import {
  optStartMode, optDisplay, optVibrate, vibrateCapability, optionsMessage, optNoteFont, optNoteLine,
  optNoteEmphasis, optIconSize, optLabelSize, optBottomGap, noteSample,
} from './dom.js';
import { markPreviewGroup, schedulePreviews } from './previews.js';
import { store, recoveryState, persist } from './controller.js';

const LINE_HEIGHTS = { compact: 1.3, normal: 1.5, relaxed: 1.85 };

function renderOptions() {
  const options = normalizeOptions(store.options);
  if (optStartMode) optStartMode.value = options.startMode;
  if (optDisplay) optDisplay.value = options.display;
  if (optVibrate) optVibrate.checked = options.vibrate;
  if (optNoteFont) optNoteFont.value = String(options.noteFont);
  if (optNoteLine) optNoteLine.value = options.noteLine;
  if (optNoteEmphasis) optNoteEmphasis.value = options.noteEmphasis;
  if (optIconSize) optIconSize.value = String(options.iconSize);
  if (optLabelSize) optLabelSize.value = String(options.labelSize);
  if (optBottomGap) optBottomGap.value = String(options.bottomGap);
  renderOptionLabels();
}

function renderOptionLabels(event) {
  const set = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
  set('opt-note-font-value', `${optNoteFont?.value}px`);
  set('opt-icon-size-value', `${optIconSize?.value}%`);
  set('opt-label-size-value', `${optLabelSize?.value}px`);
  set('opt-bottom-gap-value', `${optBottomGap?.value}px`);
  if (noteSample && optNoteFont) {
    noteSample.style.fontSize = `${optNoteFont.value}px`;
    noteSample.style.lineHeight = String(LINE_HEIGHTS[optNoteLine?.value] || LINE_HEIGHTS.normal);
    noteSample.style.fontWeight = optNoteEmphasis?.value === 'bold' ? '800' : '400';
    noteSample.style.textDecoration = optNoteEmphasis?.value === 'underline' ? 'underline' : 'none';
    noteSample.style.background = optNoteEmphasis?.value === 'highlight' ? '#fff9a8' : '#fff';
  }
  // Home sliders and note sliders are separate groups. An icon-size drag must not rebuild note scrollers.
  markPreviewGroup(event?.target?.id || '');
  schedulePreviews();
  applyVibrationCapability();
}

// Settings only. iPhone Safari has no Vibration API. Do not play a sound
// instead, and do not rewrite the saved checkbox value.
function applyVibrationCapability() {
  const available = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  if (optVibrate) {
    optVibrate.disabled = !available;
    if (!available) optVibrate.setAttribute('aria-disabled', 'true');
    else optVibrate.removeAttribute('aria-disabled');
  }
  if (vibrateCapability) {
    vibrateCapability.hidden = available;
    vibrateCapability.textContent = available
      ? ''
      : '이 브라우저는 진동을 지원하지 않아요. 나머지 기능은 그대로 쓸 수 있어요.';
  }
}

function controlOptions(patch = {}) {
  return normalizeOptions({
    ...normalizeOptions(store.options),
    startMode: optStartMode.value,
    display: optDisplay.value,
    vibrate: optVibrate.checked,
    noteFont: Number(optNoteFont.value),
    noteLine: optNoteLine.value,
    noteEmphasis: optNoteEmphasis.value,
    iconSize: Number(optIconSize.value),
    labelSize: Number(optLabelSize.value),
    bottomGap: Number(optBottomGap.value),
    ...patch
  });
}

function saveOptionsFromControls() {
  if (recoveryState) return;
  const options = controlOptions();
  const ok = persist({ ...store, options });
  if (!ok) renderOptions();
  if (optionsMessage) optionsMessage.textContent = ok ? '' : '설정을 저장하지 못했습니다. 저장된 목록은 그대로입니다.';
}

for (const control of [optStartMode, optDisplay, optVibrate]) control?.addEventListener('change', saveOptionsFromControls);

for (const range of [optNoteFont, optNoteLine, optNoteEmphasis, optIconSize, optLabelSize, optBottomGap]) {
  range?.addEventListener('input', renderOptionLabels);
  range?.addEventListener('change', saveOptionsFromControls);
}

export { LINE_HEIGHTS, renderOptions, controlOptions };
