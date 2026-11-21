export function contains(box, x, y) {
  return box.width > 0 && box.height > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
export function suitAt(box, x, y) {
  if (!contains(box, x, y)) return;
  const right = x >= box.left + box.width / 2;
  return y < box.top + box.height / 2 ? (right ? '♦' : '♠') : (right ? '♥' : '♣');
}
export function rankAt(box, x, y) {
  if (contains(box, x, y)) return Math.min(10, 1 + Math.floor((x - box.left) * 10 / box.width));
}
