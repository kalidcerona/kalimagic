import { HOME_LAYOUT, homeCellDigit } from './logic.js';
import { inputGuideInput, fakeHomeEl } from './dom.js';
import { renderPrecheck } from './precheck.js';

const INPUT_GUIDE_KEY = 'magic-choice-dist.v1.input-guide';
const INPUT_GUIDE_HOLD_MS = 800;
const INPUT_GUIDE_FADE_MS = 240;

let inputGuidePage = null;
let inputGuideToken = 0;
let inputGuideTimers = { hold: 0, fade: 0 };

function isInputGuideEnabled() {
  if (inputGuideInput) return inputGuideInput.checked === true;
  try {
    return localStorage.getItem(INPUT_GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

function loadInputGuidePreference() {
  if (!inputGuideInput) return;
  let enabled = false;
  try {
    enabled = localStorage.getItem(INPUT_GUIDE_KEY) === '1';
  } catch {
    enabled = false;
  }
  inputGuideInput.checked = enabled;
}

function persistInputGuidePreference() {
  if (!inputGuideInput) return;
  try {
    localStorage.setItem(INPUT_GUIDE_KEY, inputGuideInput.checked ? '1' : '0');
  } catch {
    // Preference only. The list store is left untouched.
  }
}

function staticGuideDigit(row, col) {
  return homeCellDigit(row, col);
}

function removeInputGuideNodes() {
  fakeHomeEl?.querySelectorAll('.digit-guide').forEach((node) => node.remove());
}

function clearInputGuideTimers() {
  inputGuideToken += 1;
  if (inputGuideTimers.hold) clearTimeout(inputGuideTimers.hold);
  if (inputGuideTimers.fade) clearTimeout(inputGuideTimers.fade);
  inputGuideTimers = { hold: 0, fade: 0 };
}

function dismissInputGuide() {
  inputGuidePage = null;
  clearInputGuideTimers();
  removeInputGuideNodes();
}

// Static keypad map only. Never render the entered tens, ones, or chosen value.
function showInputGuide(page) {
  if (!isInputGuideEnabled() || (page !== 0 && page !== 1)) {
    dismissInputGuide();
    return;
  }
  if (inputGuidePage === page && fakeHomeEl?.querySelector('.digit-guide')) return;
  dismissInputGuide();
  const grid = fakeHomeEl?.querySelector(`[data-home-grid="${page}"]`);
  if (!grid) return;
  const overlay = document.createElement('div');
  overlay.className = 'digit-guide';
  overlay.setAttribute('aria-hidden', 'true');
  for (let row = 0; row < HOME_LAYOUT.rows; row += 1) {
    for (let col = 0; col < HOME_LAYOUT.cols; col += 1) {
      const cell = document.createElement('span');
      cell.className = 'digit-guide-cell';
      cell.textContent = String(staticGuideDigit(row, col));
      overlay.append(cell);
    }
  }
  grid.append(overlay);
  inputGuidePage = page;
  const token = inputGuideToken;
  inputGuideTimers.hold = setTimeout(() => {
    if (token !== inputGuideToken) return;
    overlay.classList.add('is-fading');
    inputGuideTimers.fade = setTimeout(() => {
      if (token !== inputGuideToken) return;
      overlay.remove();
      if (inputGuidePage === page) inputGuidePage = null;
    }, INPUT_GUIDE_FADE_MS);
  }, INPUT_GUIDE_HOLD_MS);
}

function bindInputGuide() {
  inputGuideInput?.addEventListener('change', () => { persistInputGuidePreference(); renderPrecheck(); });
}

export { isInputGuideEnabled, loadInputGuidePreference, dismissInputGuide, showInputGuide, bindInputGuide };
