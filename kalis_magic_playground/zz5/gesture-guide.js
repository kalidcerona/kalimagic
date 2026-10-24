import { bootingPerformance } from './controller.js';

const gestureGuide = document.getElementById('settings-gesture-guide');
const gestureGuideDismiss = document.getElementById('settings-gesture-dismiss');
const GESTURE_GUIDE_KEY = 'aletheia.settings-gesture-guide.v1';
let gestureGuideShown = false;

function maybeShowGestureGuide() {
  if (bootingPerformance || gestureGuideShown) return;
  try {
    if (localStorage.getItem(GESTURE_GUIDE_KEY) === 'done') return;
  } catch { /* Private browsing can block storage. */ }
  gestureGuideShown = true;
  gestureGuide.hidden = false;
  gestureGuideDismiss.focus();
}

function hideGestureGuide() {
  gestureGuide.hidden = true;
}

gestureGuideDismiss.addEventListener('click', () => {
  hideGestureGuide();
  try { localStorage.setItem(GESTURE_GUIDE_KEY, 'done'); } catch { /* Keep this session dismissed. */ }
});
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
  gestureGuide.addEventListener(type, (event) => event.stopPropagation());
}

export { maybeShowGestureGuide, hideGestureGuide };
