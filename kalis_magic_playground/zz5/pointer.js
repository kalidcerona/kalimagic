import { allowsRevealStroke, classifyGesture } from './logic.js';
import { view, running, stopPerformance } from './controller.js';
import { canvas } from './dom.js';
import {
  isCardPerformance, isCardSelectPhase, viewportCell, lockCourtCard, selectCourtCard,
} from './card-select.js';
import { maybeAdvanceStage, redraw, pointsFor, stampPoints, resetVeil } from './veil.js';

let blockPointerUntil = 0;

const contacts = new Map();

let multiTouchGroup = false;
let gestureResolved = null;

function contactDeltas() {
  // screenX/screenY deltas are CSS pixels in screen coordinates.
  return [...contacts.values()].map((contact) => ({
    dx: contact.x - contact.startX,
    dy: contact.y - contact.startY,
  }));
}

function screenPoint(event) {
  return {
    x: Number.isFinite(event.screenX) ? event.screenX : event.clientX,
    y: Number.isFinite(event.screenY) ? event.screenY : event.clientY,
  };
}

function clearContacts() {
  const ids = [...contacts.keys()];
  contacts.clear();
  multiTouchGroup = false;
  gestureResolved = null;
  for (const id of ids) {
    try { canvas.releasePointerCapture(id); } catch { /* already released */ }
  }
}

function openSettings() {
  if (view !== 'performance') return;
  blockPointerUntil = Date.now() + 700;
  stopPerformance();
}

function canPaintPointer(event) {
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
    if (event.type === 'pointerdown') return true;
    if (typeof event.buttons !== 'number') return true;
    return event.buttons === 1;
  }
  return true;
}

function onPointerDown(event) {
  if (view !== 'performance') return;
  if ((event.pointerType === 'mouse' || event.pointerType === 'pen') && event.button !== 0) return;
  if (event.cancelable) event.preventDefault();
  try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  if (contacts.size === 0) {
    multiTouchGroup = false;
    gestureResolved = null;
  }
  const point = screenPoint(event);
  const contact = {
    startX: point.x,
    startY: point.y,
    x: point.x,
    y: point.y,
    last: null,
    pointerType: event.pointerType,
  };
  contacts.set(event.pointerId, contact);
  // Travel before the second finger lands does not count toward the 96px rule.
  if (contacts.size === 2 && [...contacts.values()].every((item) => item.pointerType === 'touch')) {
    for (const item of contacts.values()) {
      item.startX = item.x;
      item.startY = item.y;
    }
  }
  if (contacts.size > 1) {
    multiTouchGroup = true;
    for (const item of contacts.values()) item.last = null;
    if (isCardSelectPhase()) {
      running.pendingPointerId = null;
      running.pendingCell = null;
    }
  } else if (isCardSelectPhase()) {
    selectCourtCard(viewportCell(event.clientX, event.clientY), event.clientX, event.clientY, event.pointerId);
    return;
  }
  if (isCardSelectPhase() || (running && running.cardPhase === 'loading')) return;
  if (allowsRevealStroke(contacts.size, multiTouchGroup) && canPaintPointer(event)) {
    const points = pointsFor(contact, event.clientX, event.clientY);
    if (points.length) stampPoints(points);
  }
}

function onPointerMove(event) {
  const contact = contacts.get(event.pointerId);
  if (!contact || view !== 'performance') return;
  if (event.cancelable) event.preventDefault();
  const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : null;
  const list = samples && samples.length ? samples : [event];
  const paint = [];
  for (const sample of list) {
    const point = screenPoint(sample);
    contact.x = point.x;
    contact.y = point.y;
    if (running && running.cardPhase === 'loading' && contacts.size === 1 && !multiTouchGroup
      && running.queuedPoints.length < 256) {
      running.queuedPoints.push({ x: sample.clientX, y: sample.clientY });
    }
    if (isCardSelectPhase() || (running && running.cardPhase === 'loading')
      || gestureResolved || !allowsRevealStroke(contacts.size, multiTouchGroup)) continue;
    if (!canPaintPointer(sample)) continue;
    paint.push(...pointsFor(contact, sample.clientX, sample.clientY));
  }
  if (!gestureResolved && contacts.size >= 2) {
    const gesture = classifyGesture(contactDeltas());
    if (gesture === 'settings') {
      gestureResolved = 'settings';
      openSettings();
      return;
    }
    if (gesture === 'reset') {
      gestureResolved = 'reset';
      if (!isCardPerformance()) resetVeil();
      return;
    }
  }
  if (paint.length && !isCardSelectPhase() && allowsRevealStroke(contacts.size, multiTouchGroup) && !gestureResolved) {
    stampPoints(paint);
  }
}

function endPointer(event) {
  if (!contacts.has(event.pointerId)) return;
  const contact = contacts.get(event.pointerId);
  const point = screenPoint(event);
  contact.x = point.x;
  contact.y = point.y;
  const selecting = isCardSelectPhase();
  // pointercancel and lostpointercapture must not lock or uncover a court.
  const commitSelection = selecting
    && event.type === 'pointerup'
    && !gestureResolved
    && !multiTouchGroup
    && contacts.size === 1
    && running.pendingPointerId === event.pointerId
    && running.pendingCell;
  const pendingCell = commitSelection ? running.pendingCell : null;
  const revealEnded = view === 'performance'
    && Boolean(running)
    && !selecting
    && running.preset.mode === 'stages'
    && !gestureResolved
    && allowsRevealStroke(contacts.size, multiTouchGroup);
  if (view === 'performance' && !gestureResolved && contacts.size >= 2) {
    const gesture = classifyGesture(contactDeltas());
    if (gesture === 'settings') {
      gestureResolved = 'settings';
      openSettings();
      return;
    }
    if (gesture === 'reset') {
      gestureResolved = 'reset';
      if (!isCardPerformance()) resetVeil();
    }
  }
  if (selecting && running && running.pendingPointerId === event.pointerId) {
    running.pendingPointerId = null;
    running.pendingCell = null;
  }
  contacts.delete(event.pointerId);
  try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  if (contacts.size === 0) {
    multiTouchGroup = false;
    gestureResolved = null;
  }
  if (pendingCell && isCardSelectPhase() && view === 'performance') {
    lockCourtCard(pendingCell);
    return;
  }
  if (revealEnded && running && view === 'performance') {
    maybeAdvanceStage(true);
    redraw();
  }
}

export {
  blockPointerUntil, contacts, clearContacts, openSettings, onPointerDown, onPointerMove,
  endPointer,
};
