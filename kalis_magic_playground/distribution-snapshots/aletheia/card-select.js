import { LIMITS, mapPointerToCell, maskDimensions } from './logic.js';
import { view, running, stopPerformance } from './controller.js';
import { canvas } from './dom.js';
import { setError } from './status.js';
import { hideCellGuide } from './cell-guide.js';
import { redraw, pointsFor, stampPoints } from './veil.js';
import { contacts } from './pointer.js';

function isCardPerformance() {
  return Boolean(running && running.cardMode);
}

function isCardSelectPhase() {
  return isCardPerformance() && running.cardPhase === 'select';
}

function viewportCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return mapPointerToCell(clientX, clientY, {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });
}

// Card mode ignores stored hidden-percent and always starts fully covered.
function paintOpaqueCardMask() {
  if (!running) return;
  const { mask, maskCtx } = running;
  maskCtx.save();
  maskCtx.globalCompositeOperation = 'source-over';
  maskCtx.globalAlpha = 1;
  maskCtx.clearRect(0, 0, mask.width, mask.height);
  maskCtx.fillStyle = '#000000';
  maskCtx.fillRect(0, 0, mask.width, mask.height);
  maskCtx.restore();
}

function lockCourtCard(cell) {
  if (!isCardSelectPhase() || !cell || !running.cards) return;
  const image = running.cards[cell.index];
  if (!image) return;
  const size = maskDimensions(image.naturalWidth, image.naturalHeight, LIMITS.maxMaskSide);
  if (!size) return;
  // Match the chosen photo so a rectangular image stays contained without stretching the veil.
  if (running.mask.width !== size.w || running.mask.height !== size.h) {
    running.mask.width = size.w;
    running.mask.height = size.h;
  }
  running.selectedIndex = cell.index;
  running.image = image;
  running.cardPhase = 'reveal';
  running.pendingPointerId = null;
  running.pendingCell = null;
  // Hide the guide before the selecting pointerdown paints its first scratch.
  hideCellGuide();
  paintOpaqueCardMask();
  redraw();
}

function selectCourtCard(cell, clientX, clientY, pointerId) {
  if (!isCardSelectPhase() || !cell || !running.deckSlots) return;
  const session = running;
  session.selectedIndex = cell.index;
  session.cardPhase = 'loading';
  session.queuedPoints = [{ x: clientX, y: clientY }];
  hideCellGuide();
  void session.deckSlots.get(cell.index).then(({ image, url }) => {
    if (running !== session || view !== 'performance') return;
    session.cards[cell.index] = image;
    if (url) session.cardUrls.push(url);
    session.cardPhase = 'select';
    lockCourtCard(cell);
    const contact = { last: null };
    const points = [];
    for (const point of session.queuedPoints) {
      points.push(...pointsFor(contact, point.x, point.y));
    }
    session.queuedPoints = [];
    if (points.length) stampPoints(points);
    const activeContact = contacts.get(pointerId);
    if (activeContact) activeContact.last = contact.last;
  }).catch(() => {
    if (running !== session || view !== 'performance') return;
    stopPerformance();
    setError('선택한 카드를 열 수 없습니다. 저장된 데이터는 바꾸지 않았습니다.');
  });
}

export {
  isCardPerformance, isCardSelectPhase, viewportCell, paintOpaqueCardMask, lockCourtCard,
  selectCourtCard,
};
