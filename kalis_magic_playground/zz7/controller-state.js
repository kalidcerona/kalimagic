import { HOLD_THRESHOLD_MS, createHold, loadFromRaw } from "./logic.js";

let appState = loadFromRaw(null).state;
let hold = createHold();

let activeScanDurationMs = HOLD_THRESHOLD_MS;
let settled = true;
let activePointerId = null;
let holdPointerId = null;
let readyPointerId = null;
let primerPointerId = null;
let gestureConsumed = false;

let readyFeedbackShown = false;

/** @type {Map<number, {x: number, y: number, startX: number, startY: number, startedOnButton: boolean, pointerType: string}>} */
const pointers = new Map();

function setAppState(value) { appState = value; }
function setHold(value) { hold = value; }
function setSettled(value) { settled = value; }
function setActiveScanDurationMs(value) { activeScanDurationMs = value; }
function setActivePointerId(value) { activePointerId = value; }
function setHoldPointerId(value) { holdPointerId = value; }
function setReadyPointerId(value) { readyPointerId = value; }
function setPrimerPointerId(value) { primerPointerId = value; }
function setGestureConsumed(value) { gestureConsumed = value; }
function setReadyFeedbackShown(value) { readyFeedbackShown = value; }

export {
  appState, hold, activeScanDurationMs, settled, activePointerId, holdPointerId, readyPointerId,
  primerPointerId, gestureConsumed, readyFeedbackShown, pointers,
  setAppState, setHold, setSettled, setActiveScanDurationMs, setActivePointerId, setHoldPointerId,
  setReadyPointerId, setPrimerPointerId, setGestureConsumed, setReadyFeedbackShown,
};
