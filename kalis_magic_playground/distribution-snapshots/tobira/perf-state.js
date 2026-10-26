const pointers = new Map();
let phase = 'awaiting';
let center = { x: 0, y: 0 };
let objectLive = false;

function setPhase(value) {
  phase = value;
}

function setCenter(value) {
  center = value;
}

function setObjectLive(value) {
  objectLive = value;
}

export { pointers, phase, center, objectLive, setPhase, setCenter, setObjectLive };
