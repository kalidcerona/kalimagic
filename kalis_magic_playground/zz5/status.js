import { errorBox, statusBox } from './dom.js';

function setError(message) {
  statusBox.hidden = true;
  statusBox.textContent = '';
  if (!message) {
    errorBox.hidden = true;
    errorBox.textContent = '';
    return;
  }
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function setStatus(message) {
  errorBox.hidden = true;
  errorBox.textContent = '';
  if (!message) {
    statusBox.hidden = true;
    statusBox.textContent = '';
    return;
  }
  statusBox.hidden = false;
  statusBox.textContent = message;
}

export { setError, setStatus };
