import { noteLines, normalizeOptions } from './logic.js';
import {
  fakeHomeEl, fakeNotesEl, fakeNotesTitle, fakeNotesBody, fakeNotesBack, fakeNotesSearch,
  fakeNotesFolder, fakeNotesHome,
} from './dom.js';
import { LINE_HEIGHTS } from './options.js';
import { dismissInputGuide, showInputGuide } from './input-guide.js';
import {
  fakeHomeSession, vibrateCue, renderEntryReadout, attachPinchZoom, backToFakeHome,
} from './performance.js';
import { store } from './controller.js';

const noteDateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

function syncFakeHomeSurface() {
  if (!fakeHomeSession) return;
  const page = fakeHomeSession.page;
  const onNotes = page === 'notes';
  if (onNotes) dismissInputGuide();
  else showInputGuide(page);
  fakeHomeEl.dataset.page = onNotes ? 'notes' : String(page);
  fakeHomeEl.classList.toggle('is-notes', onNotes);
  fakeNotesEl.hidden = !onNotes;
  const phone = document.getElementById('fake-phone');
  if (phone) phone.setAttribute('aria-hidden', onNotes ? 'true' : 'false');
  fakeHomeEl.querySelectorAll('.home-page').forEach((homePage) => {
    const current = !onNotes && homePage.dataset.homePage === String(page);
    homePage.setAttribute('aria-hidden', current ? 'false' : 'true');
  });
  fakeHomeEl.querySelectorAll('.home-dots > span').forEach((dot, index) => {
    dot.classList.toggle('is-current', !onNotes && index === page);
  });
  if (!onNotes) fakeHomeSession.notesMounted = false;
  if (onNotes && !fakeHomeSession.notesMounted) {
    fakeHomeSession.notesMounted = true;
    renderFakeNotesIndex();
  }
  if (onNotes && !fakeHomeSession.openNoteId) fakeNotesTitle?.focus();
  renderEntryReadout();
}

function noteStamp(updatedAt) {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return '';
  try {
    return noteDateFormat.format(updatedAt);
  } catch {
    return '';
  }
}

function clearFakeNotesView() {
  removeRangeCue();
  fakeNotesBody?.replaceChildren();
  fakeNotesEl?.classList.remove('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = true;
  setNotesTitle('메모');
  if (fakeNotesSearch) fakeNotesSearch.hidden = false;
  if (fakeNotesFolder) fakeNotesFolder.hidden = false;
}

function renderFakeNotesIndex(focusId) {
  if (!fakeHomeSession || !fakeNotesBody) return;
  fakeHomeSession.openNoteId = null;
  removeRangeCue();
  fakeNotesEl.classList.remove('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = true;
  setNotesTitle('메모');
  if (fakeNotesSearch) fakeNotesSearch.hidden = false;
  if (fakeNotesFolder) fakeNotesFolder.hidden = false;
  fakeNotesBody.replaceChildren();
  const index = document.createElement('div');
  index.className = 'notes-index';
  fakeHomeSession.notes.forEach((note) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'notes-row';
    button.dataset.noteId = String(note.id);
    const copy = document.createElement('span');
    copy.className = 'notes-row-copy';
    const title = document.createElement('span');
    title.className = 'notes-row-title';
    title.textContent = note.name;
    copy.append(title);
    const stamp = noteStamp(note.updatedAt);
    if (stamp) {
      const meta = document.createElement('span');
      meta.className = 'notes-row-meta';
      meta.textContent = stamp;
      copy.append(meta);
    }
    button.append(copy);
    button.addEventListener('click', () => openFakeNote(note.id));
    index.append(button);
  });
  fakeNotesBody.append(index);
  if (focusId != null) {
    const target = [...index.querySelectorAll('.notes-row')].find((button) => button.dataset.noteId === String(focusId));
    if (target) {
      target.focus();
      return;
    }
  }
  fakeNotesTitle?.focus();
}

// The shared label module keeps the notes title at its native label, so the label itself is what changes.
function setNotesTitle(text) {
  if (!fakeNotesTitle) return;
  fakeNotesTitle.dataset.magicNativeLabel = text;
  fakeNotesTitle.textContent = text;
}

function removeRangeCue() {
  fakeNotesEl?.querySelectorAll('.notes-range-cue').forEach((node) => node.remove());
}

function emphasisRow(row, options) {
  if (options.noteEmphasis === 'none') return;
  row.classList.add('is-emphasis');
  row.dataset.emphasis = options.noteEmphasis;
}

// The numbered lines of an open list note, with the picked line emphasised; the settings preview draws the same thing.
function buildNoteScroller(items, choice, options, { zoomable = true } = {}) {
  const scroller = document.createElement('div');
  scroller.className = 'notes-detail-scroll';
  const lines = document.createElement('ol');
  lines.className = 'notes-lines';
  lines.style.setProperty('--note-size', `${options.noteFont}px`);
  lines.style.setProperty('--note-leading', String(LINE_HEIGHTS[options.noteLine] || LINE_HEIGHTS.normal));
  items.forEach((item, index) => {
    const row = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'notes-line-no';
    number.textContent = String(index + 1);
    const text = document.createElement('span');
    text.className = 'notes-line-text';
    text.textContent = item;
    row.append(number, text);
    if (index + 1 === choice) emphasisRow(row, options);
    lines.append(row);
  });
  scroller.append(lines);
  if (zoomable) attachPinchZoom(scroller, lines);
  return scroller;
}

function renderFakeNoteDetail(note, detail) {
  if (!fakeNotesBody) return;
  const options = fakeHomeSession?.options || normalizeOptions(store.options);
  fakeNotesEl.classList.add('is-detail');
  if (fakeNotesBack) fakeNotesBack.hidden = false;
  setNotesTitle(note.name);
  removeRangeCue();
  if (detail?.inRange === false && fakeNotesTitle?.parentElement) {
    // The shared label module owns the title text, so the quiet cue lives beside it in the header bar.
    const cue = document.createElement('i');
    cue.className = 'notes-range-cue';
    cue.setAttribute('aria-hidden', 'true');
    fakeNotesTitle.parentElement.append(cue);
  }
  if (fakeNotesSearch) fakeNotesSearch.hidden = true;
  if (fakeNotesFolder) fakeNotesFolder.hidden = true;
  fakeNotesBody.replaceChildren();
  let scroller;
  if (note.kind === 'dummy') {
    scroller = document.createElement('div');
    scroller.className = 'notes-detail-scroll';
    const body = document.createElement('p');
    body.className = 'notes-dummy-body';
    body.textContent = note.body;
    body.style.setProperty('--note-size', `${options.noteFont}px`);
    body.style.setProperty('--note-leading', String(LINE_HEIGHTS[options.noteLine] || LINE_HEIGHTS.normal));
    scroller.append(body);
    attachPinchZoom(scroller, body);
  } else {
    scroller = buildNoteScroller(detail.items, detail.choice, options);
  }
  fakeNotesBody.append(scroller);
  fakeNotesBack?.focus();
}

function openFakeNote(noteId) {
  const current = fakeHomeSession;
  if (!current || current.page !== 'notes' || current.entry?.locked !== true) return;
  const note = current.notes.find((entry) => entry.id === noteId);
  if (!note) return;
  if (note.kind === 'dummy') {
    current.openNoteId = noteId;
    renderFakeNoteDetail(note, null);
    return;
  }
  const detail = noteLines(note, current.entry.value);
  if (!detail.ok || !Array.isArray(detail.items)) return;
  current.openNoteId = noteId;
  current.numberLocked = true;
  current.outOfRange = detail.inRange === false;
  renderFakeNoteDetail(note, detail);
  if (detail.inRange === false) vibrateCue();
}

function backToFakeNotesIndex() {
  if (!fakeHomeSession || fakeHomeSession.page !== 'notes') return;
  const focusId = fakeHomeSession.openNoteId;
  renderFakeNotesIndex(focusId);
}

function bindFakeNotes() {
  fakeNotesBack?.addEventListener('click', backToFakeNotesIndex);
  fakeNotesHome?.addEventListener('click', backToFakeHome);
}

export { syncFakeHomeSurface, clearFakeNotesView, emphasisRow, buildNoteScroller, bindFakeNotes };
