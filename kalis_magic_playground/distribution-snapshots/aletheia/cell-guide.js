import { remainingCellGuideMs } from './logic.js';
import { view, running } from './controller.js';
import { CELL_GUIDE_HOLD_MS, CELL_GUIDE_FADE_MS, stage, canvas, cellGuide } from './dom.js';
import { COURT_CARD_COUNT } from './court-cards.js';
import { isCardPerformance } from './card-select.js';
import { cellGuideEnabled } from './preferences.js';

let cellGuideToken = 0;
let cellGuideTimer = 0;
let cellGuideFadeTimer = 0;

function clearCellGuideTimers() {
  if (cellGuideTimer) {
    clearTimeout(cellGuideTimer);
    cellGuideTimer = 0;
  }
  if (cellGuideFadeTimer) {
    clearTimeout(cellGuideFadeTimer);
    cellGuideFadeTimer = 0;
  }
}

function hideCellGuide() {
  // Also invalidate a guide still waiting for its deck image promises.
  cellGuideToken += 1;
  clearCellGuideTimers();
  if (!cellGuide) return;
  cellGuide.classList.remove('is-fading');
  cellGuide.hidden = true;
  cellGuide.setAttribute('aria-hidden', 'true');
  cellGuide.style.pointerEvents = 'none';
  cellGuide.replaceChildren();
}

function alignCellGuide() {
  if (!cellGuide || cellGuide.hidden) return;
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  if (canvasRect.width < 2 || canvasRect.height < 2) return;
  cellGuide.style.left = `${canvasRect.left - stageRect.left}px`;
  cellGuide.style.top = `${canvasRect.top - stageRect.top}px`;
  cellGuide.style.width = `${canvasRect.width}px`;
  cellGuide.style.height = `${canvasRect.height}px`;
}

function fillCellGuidePreviews() {
  const fragment = document.createDocumentFragment();
  const previews = Array.from({ length: COURT_CARD_COUNT }, (_, index) => {
    const preview = document.createElement('img');
    preview.alt = '';
    preview.draggable = false;
    preview.decoding = 'async';
    preview.loading = 'eager';
    preview.dataset.cell = String(index);
    fragment.append(preview);
    return preview;
  });
  cellGuide.replaceChildren(fragment);
  return previews;
}

// Fill each position as its card becomes ready, without delaying the 2500ms guide window.
function showCellGuide() {
  if (!cellGuide || !cellGuideEnabled || !isCardPerformance()) return;
  const startedAt = performance.now();
  cellGuideToken += 1;
  const token = cellGuideToken;
  clearCellGuideTimers();
  const session = running;
  const previews = fillCellGuidePreviews();
  previews.forEach((preview, index) => {
    session.deckSlots.get(index).then(({ image }) => {
      if (token !== cellGuideToken || running !== session || view !== 'performance' || !isCardPerformance()) return;
      if (remainingCellGuideMs(startedAt, performance.now(), CELL_GUIDE_HOLD_MS) <= 0) return;
      preview.src = image.currentSrc || image.src;
    }, () => {});
  });
  cellGuide.classList.remove('is-fading');
  cellGuide.hidden = false;
  cellGuide.setAttribute('aria-hidden', 'true');
  cellGuide.style.pointerEvents = 'none';
  void cellGuide.offsetWidth;
  alignCellGuide();
  cellGuideTimer = window.setTimeout(() => {
      cellGuideTimer = 0;
      if (token !== cellGuideToken) return;
      if (!cellGuide || cellGuide.hidden || view !== 'performance' || !isCardPerformance()) return;
      const fadeMs = remainingCellGuideMs(startedAt, performance.now(), CELL_GUIDE_HOLD_MS);
      if (fadeMs <= 0) {
        hideCellGuide();
        return;
      }
      cellGuide.classList.add('is-fading');
      cellGuideFadeTimer = window.setTimeout(() => {
        cellGuideFadeTimer = 0;
        if (token !== cellGuideToken) return;
        hideCellGuide();
      }, Math.min(CELL_GUIDE_FADE_MS, fadeMs));
  }, CELL_GUIDE_HOLD_MS - CELL_GUIDE_FADE_MS);
}

function maybeShowCellGuide() {
  if (isCardPerformance() && cellGuideEnabled) showCellGuide();
  else hideCellGuide();
}

export { hideCellGuide, alignCellGuide, maybeShowCellGuide };
