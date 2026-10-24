import { SWIPE_PX } from './logic-core.js';

// One UI style home: 5 columns, 6 rows. The number apps form a 3x3 keypad at rows 2-4,
// columns 2-4 (zero based row 1-3, column 1-3). Every other cell is 0.
export const HOME_LAYOUT = Object.freeze({ cols: 5, rows: 6, padRow: 1, padCol: 1 });
export const HOME_PAGES = 3;

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isHomeDigit(value) {
  return Number.isInteger(value) && value >= 0 && value <= 9;
}

/**
 * Fake-home digit for a pointer inside a rect.
 * The rect is { x, y, width, height } with (x, y) at the top-left of the icon grid.
 * The grid is HOME_LAYOUT.cols x HOME_LAYOUT.rows equal bands. Digit map (row, column):
 *   0 0 0 0 0
 *   0 1 2 3 0
 *   0 4 5 6 0
 *   0 7 8 9 0
 *   0 0 0 0 0
 *   0 0 0 0 0
 * Edge behavior:
 * - The rect is closed: left/top and the exact right/bottom edges are inside.
 * - A point past any outer edge, even by a fraction, is outside and returns null.
 * - Internal grid lines belong to the higher index (Math.floor of the band ratio);
 *   the exact right edge is the last column and the exact bottom edge the last row.
 * - Non-finite pointer or rect fields, width <= 0, and height <= 0 return null.
 */
export function fakeHomeDigit(rect, x, y, layout = HOME_LAYOUT) {
  if (!rect || typeof rect !== 'object' || Array.isArray(rect)) return null;
  const left = rect.x;
  const top = rect.y;
  const { width, height } = rect;
  if (!finiteNumber(left) || !finiteNumber(top) || !finiteNumber(width) || !finiteNumber(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;
  if (!finiteNumber(x) || !finiteNumber(y)) return null;
  const right = left + width;
  const bottom = top + height;
  if (x < left || y < top || x > right || y > bottom) return null;
  let col = Math.floor((x - left) / (width / layout.cols));
  let row = Math.floor((y - top) / (height / layout.rows));
  if (col >= layout.cols) col = layout.cols - 1;
  if (row >= layout.rows) row = layout.rows - 1;
  if (col < 0 || row < 0) return null;
  return homeCellDigit(row, col, layout);
}

/** Digit of one grid cell (zero based row and column). */
export function homeCellDigit(row, col, layout = HOME_LAYOUT) {
  const r = row - layout.padRow;
  const c = col - layout.padCol;
  if (r < 0 || r > 2 || c < 0 || c > 2) return 0;
  return r * 3 + c + 1;
}

/**
 * Tens and ones digits 0-9. Both zero mean "the last item number of the opened
 * note" and are returned as 0 (resolveChoice maps it to that note's length).
 * Every other pair is tens*10+ones (01 -> 1, 37 -> 37, 99 -> 99).
 * Anything that is not an integer digit returns null.
 */
export function fakeHomeNumber(tens, ones) {
  if (!isHomeDigit(tens) || !isHomeDigit(ones)) return null;
  if (tens === 0 && ones === 0) return 0;
  return tens * 10 + ones;
}

/**
 * Maps the entered number to a position in a note of `count` items.
 * 00 (value 0) is the last item. A number above the note length is out of range:
 * the note then shows its original list, with the target at the last item
 * (the same place 00 uses), and inRange is false so the performer can be told quietly.
 * Returns null for anything that cannot be resolved.
 */
export function resolveChoice(value, count) {
  if (!Number.isInteger(count) || count < 1) return null;
  if (value === 0) return { choice: count, inRange: true, last: true };
  if (!Number.isInteger(value) || value < 1) return null;
  if (value <= count) return { choice: value, inRange: true, last: false };
  return { choice: count, inRange: false, last: false };
}

/** Idle two-step entry: no digits, unlocked, no result. */
export function createFakeHomeEntry() {
  return { tens: null, ones: null, value: null, locked: false };
}

function isValidLeftSwipe(swipe) {
  if (!swipe || typeof swipe !== 'object' || Array.isArray(swipe)) return false;
  if (swipe.canceled === true) return false;
  if (!isHomeDigit(swipe.digit)) return false;
  const { dx, dy } = swipe;
  if (!finiteNumber(dx) || !finiteNumber(dy)) return false;
  // Screen left is decreasing x. Equal diagonals are not left swipes.
  if (dx > -SWIPE_PX) return false;
  if (Math.abs(dx) <= Math.abs(dy)) return false;
  return true;
}

export const TAP_MAX_PX = 12;
export const TAP_MAX_MS = 400;

/**
 * Classifies one finished pointer gesture as 'left', 'right', 'tap', or null.
 * Left and right need at least SWIPE_PX and must be strictly more horizontal
 * than vertical. A tap moves at most TAP_MAX_PX and lasts at most TAP_MAX_MS,
 * so a long press never counts as a digit.
 */
export function classifyFakeHomeGesture(gesture) {
  if (!gesture || typeof gesture !== 'object' || Array.isArray(gesture)) return null;
  if (gesture.canceled === true) return null;
  const { dx, dy } = gesture;
  if (!finiteNumber(dx) || !finiteNumber(dy)) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx <= -SWIPE_PX) return 'left';
    if (dx >= SWIPE_PX) return 'right';
  }
  const ms = gesture.ms;
  if (finiteNumber(ms) && ms >= 0 && ms <= TAP_MAX_MS
    && Math.abs(dx) <= TAP_MAX_PX && Math.abs(dy) <= TAP_MAX_PX) return 'tap';
  return null;
}

function recordDigit(state, digit) {
  if (state.tens == null) {
    return { tens: digit, ones: null, value: null, locked: false };
  }
  return {
    tens: state.tens,
    ones: digit,
    value: fakeHomeNumber(state.tens, digit),
    locked: true
  };
}

/**
 * A short tap enters the digit under the finger exactly like a left swipe.
 * Dummy icons and background resolve to 0 through fakeHomeDigit. Anything that
 * is not a tap, and any tap after the number is locked, returns the same state.
 */
export function applyFakeHomeTap(state, tap) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  if (state.locked === true || state.ones != null) return state;
  if (classifyFakeHomeGesture(tap) !== 'tap' || !isHomeDigit(tap.digit)) return state;
  return recordDigit(state, tap.digit);
}

/**
 * A right swipe removes the last entered digit (ones first, then tens) so it
 * can be entered again. Once a note has been opened the number is locked for
 * good: pass { noteOpened: true } and the same state comes back.
 */
export function applyFakeHomeUndo(state, swipe, { noteOpened = false } = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  if (noteOpened === true) return state;
  if (classifyFakeHomeGesture(swipe) !== 'right') return state;
  if (state.ones != null) return { tens: state.tens, ones: null, value: null, locked: false };
  if (state.tens != null) return createFakeHomeEntry();
  return state;
}

/**
 * First valid left swipe stores `digit` as tens and leaves the entry unlocked.
 * Second valid left swipe stores ones, sets value via fakeHomeNumber, and locks.
 * Canceled, short (< SWIPE_PX left), non-left (right, vertical, or equal
 * diagonal), missing/invalid digit, and any swipe after lock record nothing:
 * the same state object is returned.
 * A valid left swipe is strictly more horizontal than vertical and dx <= -SWIPE_PX.
 */
export function applyFakeHomeSwipe(state, swipe) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  if (state.locked === true || state.ones != null) return state;
  if (!isValidLeftSwipe(swipe)) return state;
  return recordDigit(state, swipe.digit);
}
