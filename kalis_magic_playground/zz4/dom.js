const settingsEl = document.getElementById('settings');
const nameInput = document.getElementById('preset-name');
const appearanceInput = document.getElementById('appearance');
const itemsInput = document.getElementById('items');
const forceInput = document.getElementById('force-item');
const itemHint = document.getElementById('item-hint');
const itemCount = document.getElementById('item-count');
const editorMessage = document.getElementById('editor-message');
const editorFields = document.getElementById('editor-fields');
const recoveryEl = document.getElementById('recovery');
const recoveryError = document.getElementById('recovery-error');
const recoveryIssues = document.getElementById('recovery-issues');
const recoveryRaw = document.getElementById('recovery-raw');
const recoverySlim = document.getElementById('recovery-slim');
const repairNote = document.getElementById('repair-note');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmText = document.getElementById('confirm-text');
const confirmOk = document.getElementById('confirm-ok');
const form = document.getElementById('editor-form');
const notesEntryMessage = document.getElementById('notes-entry-message');
const notesEntryAction = document.getElementById('notes-entry-action');
const inputGuideInput = document.getElementById('input-guide');
const fakeHomeEl = document.getElementById('fake-home');
const fakeNotesEl = document.getElementById('fake-notes');
const fakeNotesTitle = document.getElementById('fake-notes-title');
const fakeNotesBody = document.getElementById('fake-notes-body');
const fakeNotesBack = document.getElementById('fake-notes-back');
const fakeNotesSearch = fakeHomeEl?.querySelector('.notes-search');
const fakeNotesFolder = fakeHomeEl?.querySelector('.notes-folder-row');
const fakeHomeDots = fakeHomeEl?.querySelector('.home-dots');
const fakePhone = fakeHomeEl?.querySelector('#fake-phone');
const entryReadout = document.getElementById('entry-readout');
const optStartMode = document.getElementById('opt-start-mode');
const optDisplay = document.getElementById('opt-display');
const optVibrate = document.getElementById('opt-vibrate');
const vibrateCapability = document.getElementById('vibrate-capability');
const optionsMessage = document.getElementById('options-message');
const precheckList = document.getElementById('precheck-list');
const precheckRefresh = document.getElementById('precheck-refresh');
const optNoteFont = document.getElementById('opt-note-font');
const optNoteLine = document.getElementById('opt-note-line');
const optNoteEmphasis = document.getElementById('opt-note-emphasis');
const optIconSize = document.getElementById('opt-icon-size');
const optLabelSize = document.getElementById('opt-label-size');
const optBottomGap = document.getElementById('opt-bottom-gap');
const noteSample = document.getElementById('note-style-sample');
const fakeNotesHome = document.getElementById('fake-notes-home');
const fakeWallpaper = document.getElementById('fake-wallpaper');
const phoneDock = document.getElementById('phone-dock');
const editorWarnings = document.getElementById('editor-warnings');
const editorPreview = document.getElementById('editor-preview');

export {
  settingsEl, nameInput, appearanceInput, itemsInput, forceInput, itemHint, itemCount,
  editorMessage, editorFields, recoveryEl, recoveryError, recoveryIssues, recoveryRaw, recoverySlim,
  repairNote, confirmDialog, confirmText, confirmOk, form, notesEntryMessage, notesEntryAction,
  inputGuideInput, fakeHomeEl, fakeNotesEl, fakeNotesTitle, fakeNotesBody, fakeNotesBack,
  fakeNotesSearch, fakeNotesFolder, fakeHomeDots, fakePhone, entryReadout, optStartMode, optDisplay,
  optVibrate, vibrateCapability, optionsMessage, precheckList, precheckRefresh, optNoteFont,
  optNoteLine, optNoteEmphasis, optIconSize, optLabelSize, optBottomGap, noteSample, fakeNotesHome,
  fakeWallpaper, phoneDock, editorWarnings, editorPreview,
};
