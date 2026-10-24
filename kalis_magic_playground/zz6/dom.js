const NOTICE_KEY = 'tobira.v1.notice';
const SESSION_GONE = 'tobira.session-gone';
const SESSION_CRACK = 'tobira.session-crack';
const SESSION_CRACK_AT = `${SESSION_CRACK}-at`;
// Appearance is global. It must not be written into the preset schema.
const OBJECT_KIND_KEY = 'tobira.objectKind.v1';
const OBJECT_KIND_CLASS = Object.freeze({
  coin: 'kind-coin',
  'playing card': 'kind-playing-card',
  'business card': 'kind-business-card',
});
const EDGE_ORDER = ['top', 'left', 'right', 'bottom'];
const SPAWN_SLOP_PX = 12;
const SWIPE_REVEAL_PX = 24;
const IMAGE_CHOICE_KEY = 'tobira.coinChoices.v1';
const IMAGE_DB = 'tobira.localImages.v1';
const DEFAULT_COIN_IMAGES = Object.freeze({
  kennedy: './coin-kennedy.webp',
  won500: './coin-500won.webp',
  riderRed: './card-rider-red.jpg',
  riderBlue: './card-rider-blue.jpg',
});

const settingsEl = document.querySelector('#settings');
const stageEl = document.querySelector('#stage');
const breakthroughEl = document.querySelector('#breakthrough');
const coinEl = document.querySelector('#coin');
const recoveryEl = document.querySelector('#recovery');
const presetList = document.querySelector('#preset-list');
const presetPicker = document.querySelector('#preset-picker');
const presetEditor = document.querySelector('#preset-editor');
const selectedPresetName = document.querySelector('#selected-preset-name');
const form = document.querySelector('#preset-form');
const nameInput = document.querySelector('#preset-name');
const sizeInput = document.querySelector('#coin-size');
const sizeValue = document.querySelector('#coin-size-value');
const xInput = document.querySelector('#start-x');
const xValue = document.querySelector('#start-x-value');
const yInput = document.querySelector('#start-y');
const yValue = document.querySelector('#start-y-value');
const fadeInput = document.querySelector('#fade-distance');
const fadeValue = document.querySelector('#fade-value');
const durationInput = document.querySelector('#disappear-duration');
const durationValue = document.querySelector('#duration-value');
const edgeGroup = document.querySelector('#edge-group');
const note = document.querySelector('#form-note');
const addButton = document.querySelector('#add-preset');
const deleteButton = document.querySelector('#delete-preset');
const startButton = document.querySelector('#start-show');
const objectKindInput = document.querySelector('#object-kind');
const wallpaperInput = document.querySelector('#wallpaper-upload');
const wallpaperClear = document.querySelector('#wallpaper-clear');
const wallpaperNote = document.querySelector('#wallpaper-note');
const wallpaperEl = document.querySelector('#stage-wallpaper');
const wallpaperCrop = document.querySelector('#wallpaper-crop');
const wallpaperCropValue = document.querySelector('#wallpaper-crop-value');
const wallpaperPreview = document.querySelector('#wallpaper-preview-image');
const wallpaperFrame = document.querySelector('#wallpaper-preview');
const wallpaperCropOverlay = document.querySelector('#wallpaper-crop-overlay');
const wallpaperCropHandle = document.querySelector('#wallpaper-crop-handle');
const wallpaperControls = document.querySelector('#wallpaper-controls');
const imageChoiceInput = document.querySelector('#coin-image-choice');
const coinImageInput = document.querySelector('#coin-image-upload');
const coinImageNote = document.querySelector('#coin-image-note');
const coinArt = document.querySelector('#coin-art');
const motionToggle = document.querySelector('#motion-enabled');
const motionNote = document.querySelector('#motion-note');
const motionActivation = document.querySelector('#motion-activate');
const wallSoundInput = document.querySelector('#motion-wall-sound');
const wallVolumeInput = document.querySelector('#motion-wall-volume');
const wallVolumeValue = document.querySelector('#motion-wall-volume-value');
const wallTestButton = document.querySelector('#motion-wall-test');
const MOTION_SETTINGS_KEY = 'tobira.motion-effects.v1';
const motionInputs = {
  tilt: motionToggle,
  exit: document.querySelector('#motion-exit'),
  breakthrough: document.querySelector('#motion-breakthrough'),
  wobble: document.querySelector('#motion-wobble'),
};
const motionEdges = Object.fromEntries(['top', 'left', 'right', 'bottom'].map((edge) =>
  [edge, document.querySelector(`#motion-edge-${edge}`)]));
const DEFAULT_MOTION_EFFECTS = Object.freeze({
  tilt: true, exit: false, breakthrough: true, wobble: false,
  edges: ['right'],
});
const DEFAULT_WALL_VOLUME = 100;
const MOTION_OWNED_KEYS = new Set(['tilt', 'exit', 'breakthrough', 'wobble', 'edges', 'wallSound', 'wallVolume']);

export {
  NOTICE_KEY, SESSION_GONE, SESSION_CRACK, SESSION_CRACK_AT, OBJECT_KIND_KEY, OBJECT_KIND_CLASS,
  EDGE_ORDER, SPAWN_SLOP_PX, SWIPE_REVEAL_PX, IMAGE_CHOICE_KEY, IMAGE_DB, DEFAULT_COIN_IMAGES,
  settingsEl, stageEl, breakthroughEl, coinEl, recoveryEl, presetList, presetPicker, presetEditor,
  selectedPresetName, form, nameInput, sizeInput, sizeValue, xInput, xValue, yInput, yValue,
  fadeInput, fadeValue, durationInput, durationValue, edgeGroup, note, addButton, deleteButton,
  startButton, objectKindInput, wallpaperInput, wallpaperClear, wallpaperNote, wallpaperEl,
  wallpaperCrop, wallpaperCropValue, wallpaperPreview, wallpaperFrame, wallpaperCropOverlay,
  wallpaperCropHandle, wallpaperControls, imageChoiceInput, coinImageInput, coinImageNote, coinArt,
  motionNote, motionActivation, wallSoundInput, wallVolumeInput, wallVolumeValue, wallTestButton,
  MOTION_SETTINGS_KEY, motionInputs, motionEdges, DEFAULT_MOTION_EFFECTS, DEFAULT_WALL_VOLUME,
  MOTION_OWNED_KEYS,
};
