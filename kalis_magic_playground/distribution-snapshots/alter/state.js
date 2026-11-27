import { createAlterState } from "./logic.js";
import { createObservationTracker, createDisplaySmoother } from "./performance.js";
import { createBackgroundCalibrator } from "./calibration.js";
import { createPaperMatch } from "./appearance.js";

let machine = createAlterState({ exitDelayMs: 0 });
let tracker = createObservationTracker();
let stream = null;
let cameraEnded = false;
let animation = 0;
let lastSampleAt = 0;
let calibrator = createBackgroundCalibrator();
let sampleGeometry = null;
let displaySmooth = createDisplaySmoother();
let paperMatch = createPaperMatch();
let occlusionSlot = { quadKey: "", mask: null };

function setMachine(value) { machine = value; }
function setTracker(value) { tracker = value; }
function setStream(value) { stream = value; }
function setCameraEnded(value) { cameraEnded = value; }
function setAnimation(value) { animation = value; }
function setLastSampleAt(value) { lastSampleAt = value; }
function setCalibrator(value) { calibrator = value; }
function setSampleGeometry(value) { sampleGeometry = value; }
function setDisplaySmooth(value) { displaySmooth = value; }
function setPaperMatch(value) { paperMatch = value; }
function setOcclusionSlot(value) { occlusionSlot = value; }

export {
  machine, tracker, stream, cameraEnded, animation, lastSampleAt, calibrator, sampleGeometry, displaySmooth, paperMatch, occlusionSlot,
  setMachine, setTracker, setStream, setCameraEnded, setAnimation, setLastSampleAt, setCalibrator, setSampleGeometry, setDisplaySmooth, setPaperMatch, setOcclusionSlot,
};
