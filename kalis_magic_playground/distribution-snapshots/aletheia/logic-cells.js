// Full-viewport reading order: columns left-to-right J, Q, K;
// rows top-to-bottom spade, diamond, club, heart.
// Index is 0-based row-major. Guide is the same cell as a 1-based number.
const CELL_COLS = 3;
const CELL_ROWS = 4;
const CELL_SUITS = Object.freeze(['spade', 'diamond', 'club', 'heart']);
const CELL_RANKS = Object.freeze(['J', 'Q', 'K']);
const SUIT_LABELS = Object.freeze({
  spade: '스페이드',
  diamond: '다이아몬드',
  club: '클럽',
  heart: '하트',
});
const RANK_LABELS = Object.freeze({
  J: '잭',
  Q: '퀸',
  K: '킹',
});

function cellCard(rowIndex, colIndex) {
  const suit = CELL_SUITS[rowIndex];
  const rank = CELL_RANKS[colIndex];
  const index = rowIndex * CELL_COLS + colIndex;
  return {
    row: rowIndex + 1,
    col: colIndex + 1,
    index,
    guide: index + 1,
    suit,
    rank,
    label: `${SUIT_LABELS[suit]} ${RANK_LABELS[rank]}`,
  };
}

// Maps index 0-11 to its card. Non-integers and anything outside 0-11 return null.
export function cardAtIndex(index) {
  if (typeof index !== 'number' || !Number.isInteger(index)) return null;
  if (index < 0 || index >= CELL_ROWS * CELL_COLS) return null;
  return cellCard(Math.floor(index / CELL_COLS), index % CELL_COLS);
}

// Maps a pointer into the 4×3 cell grid of `rect` ({ left, top, width, height }).
// Interior splits are half-open: a shared edge belongs to the cell on the right or below.
// The exact right edge and exact bottom edge are clamped inward into the last column or row.
// Strictly outside points, non-finite values, and non-positive rectangles return null.
export function mapPointerToCell(x, y, rect) {
  if (!rect || typeof rect !== 'object') return null;
  const left = Number(rect.left);
  const top = Number(rect.top);
  const width = Number(rect.width);
  const height = Number(rect.height);
  const px = Number(x);
  const py = Number(y);
  if (![left, top, width, height, px, py].every(Number.isFinite)) return null;
  if (!(width > 0) || !(height > 0)) return null;

  const localX = px - left;
  const localY = py - top;
  if (localX < 0 || localY < 0 || localX > width || localY > height) return null;

  let col = Math.floor((localX / width) * CELL_COLS);
  let row = Math.floor((localY / height) * CELL_ROWS);
  if (col >= CELL_COLS) col = CELL_COLS - 1;
  if (row >= CELL_ROWS) row = CELL_ROWS - 1;
  if (col < 0 || row < 0) return null;
  return cellCard(row, col);
}

// Returns the remaining time in an overlay's lifetime, including delayed async work.
export function remainingCellGuideMs(startedAt, now, lifetimeMs = 800) {
  if (![startedAt, now, lifetimeMs].every(Number.isFinite) || lifetimeMs < 0) return 0;
  return Math.max(0, lifetimeMs - Math.max(0, now - startedAt));
}
