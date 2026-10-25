const STORAGE_KEY = 'aletheia.distribution.meta.v1';
const CUSTOM_KEY = 'aletheia.distribution.custom12.v1';
const PHOTO_SETS_KEY = 'aletheia.distribution.photoSets.v2';
const PHOTO_SET_COUNT = 3;
const CELL_GUIDE_KEY = 'aletheia.distribution.cellGuide.v1';
const COVERAGE_KEY = 'aletheia.distribution.coverage.v1';
const CELL_GUIDE_HOLD_MS = 2500;
const CELL_GUIDE_FADE_MS = 200;
const CUSTOM_COUNT = 12;
const DB_NAME = 'aletheia-distribution';
const DB_STORE = 'images';
const IMAGE_ID_RE = /^img_[A-Za-z0-9_-]{1,44}$/;
const SUIT_CODE = Object.freeze({
  spade: 'S',
  diamond: 'D',
  club: 'C',
  heart: 'H',
});

const settings = document.querySelector('#settings');
const stage = document.querySelector('#stage');
const canvas = document.querySelector('#stage-canvas');
const theme = document.querySelector('meta[name="theme-color"]');
const repair = document.querySelector('#repair');
const errorBox = document.querySelector('#error');
const statusBox = document.querySelector('#status');
const presetList = document.querySelector('#preset-list');
const emptyHint = document.querySelector('#empty-hint');
const startButton = document.querySelector('#start-button');
const cardStartButton = document.querySelector('#card-start-button');
const customSlotsRoot = document.querySelector('#custom-slots');
const customStartButtons = [];
const customReadyHints = [];
const customRepair = document.querySelector('#custom-repair');
const editorForm = document.querySelector('#editor');
const editorFields = document.querySelector('#editor-fields');
const legend = document.querySelector('#editor-legend');
const nameInput = document.querySelector('#preset-name');
const fileInput = document.querySelector('#preset-file');
const fileStatus = document.querySelector('#file-status');
const preview = document.querySelector('#file-preview');
const modeInput = document.querySelector('#preset-mode');
const modeHint = document.querySelector('#mode-hint');
const brushInput = document.querySelector('#preset-brush');
const brushReadout = document.querySelector('#brush-readout');
const hiddenEnable = document.querySelector('#hidden-enable');
const hiddenInput = document.querySelector('#preset-hidden');
const hiddenReadout = document.querySelector('#hidden-readout');
const saveButton = document.querySelector('#save-button');
const cancelEdit = document.querySelector('#cancel-edit');
const recoverButton = document.querySelector('#recover-button');
const resetStorageButton = document.querySelector('#reset-storage-button');
const cellGuideInput = document.querySelector('#cell-guide-enable');
const cellGuide = document.querySelector('#cell-guide');
const coverageInput = document.querySelector('#coverage-size');
const coverageReadout = document.querySelector('#coverage-readout');

export {
  STORAGE_KEY, CUSTOM_KEY, PHOTO_SETS_KEY, PHOTO_SET_COUNT, CELL_GUIDE_KEY, COVERAGE_KEY,
  CELL_GUIDE_HOLD_MS, CELL_GUIDE_FADE_MS, CUSTOM_COUNT, DB_NAME, DB_STORE, IMAGE_ID_RE, SUIT_CODE,
  settings, stage, canvas, theme, repair, errorBox, statusBox, presetList, emptyHint, startButton,
  cardStartButton, customSlotsRoot, customStartButtons, customReadyHints, customRepair, editorForm,
  editorFields, legend, nameInput, fileInput, fileStatus, preview, modeInput, modeHint, brushInput,
  brushReadout, hiddenEnable, hiddenInput, hiddenReadout, saveButton, cancelEdit, recoverButton,
  resetStorageButton, cellGuideInput, cellGuide, coverageInput, coverageReadout,
};
