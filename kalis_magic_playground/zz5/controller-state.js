// Shared mutable controller state. ES module importers cannot reassign these bindings, so writes go through the setters.
import { emptyMeta, emptyPhotoSets } from './logic.js';

export let meta = emptyMeta();
export let view = 'settings';
export let corrupt = false;
export let storageLocked = false;
export let busy = false;
export let formMode = 'create';
export let editingId = null;
export let armDeleteId = null;
export let resetArmed = false;
export let previewUrl = null;
export let customIds = emptyPhotoSets().flat();
export let customCorrupt = false;
export let running = null;

export function setMeta(value) { meta = value; }
export function setView(value) { view = value; }
export function setCorrupt(value) { corrupt = value; }
export function setStorageLocked(value) { storageLocked = value; }
export function setBusy(value) { busy = value; }
export function setFormMode(value) { formMode = value; }
export function setEditingId(value) { editingId = value; }
export function setArmDeleteId(value) { armDeleteId = value; }
export function setResetArmed(value) { resetArmed = value; }
export function setPreviewUrl(value) { previewUrl = value; }
export function setCustomIds(value) { customIds = value; }
export function setCustomCorrupt(value) { customCorrupt = value; }
export function setRunning(value) { running = value; }
