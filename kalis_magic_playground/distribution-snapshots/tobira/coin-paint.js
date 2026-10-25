import { coinMetrics } from './logic.js';
import { settingsEl, stageEl, coinEl } from './dom.js';
import { state, selected } from './state-store.js';
import { phase, center, objectLive, wobbleX, wobbleY, wobbleAngle } from './performance.js';

let paintedDiameter = 0;
function applyChrome(mode) {
  document.body.dataset.mode = mode;
  document.documentElement.removeAttribute('data-boot');
  const performing = mode === 'performance';
  document.title = performing ? '동전' : 'TOBIRA';
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', '#000000');
  settingsEl.inert = performing;
  if (performing) settingsEl.setAttribute('inert', '');
  else settingsEl.removeAttribute('inert');
}

function measureStage() {
  const rect = stageEl.getBoundingClientRect();
  return {
    width: rect.width || window.innerWidth,
    height: rect.height || window.innerHeight,
  };
}

function paintCoin(x, y, radius, opacity, scale) {
  const diameter = radius * 2;
  if (paintedDiameter !== diameter) {
    paintedDiameter = diameter;
    coinEl.style.width = `${diameter}px`;
    coinEl.style.height = `${diameter}px`;
  }
  coinEl.style.transform = `translate3d(${(x - radius + wobbleX).toFixed(3)}px, ${(y - radius + wobbleY).toFixed(3)}px, 0) rotate(${wobbleAngle.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
  coinEl.style.opacity = opacity.toFixed(4);
}

function paintLiveCoin() {
  if (!objectLive || phase !== 'idle' || state.mode !== 'performance') return;
  const metrics = coinMetrics(selected(), measureStage());
  paintCoin(center.x, center.y, metrics.radius, 1, 1);
}

export { applyChrome, measureStage, paintCoin, paintLiveCoin };
