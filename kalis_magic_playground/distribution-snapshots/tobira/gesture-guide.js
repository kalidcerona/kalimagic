import { unlockBreakSound } from './audio.js';

const gestureGuide = document.getElementById('settings-gesture-guide');
const gestureGuideDismiss = document.getElementById('settings-gesture-dismiss');
const GESTURE_GUIDE_KEY = 'friend-tobira.settings-gesture-guide.v1';
let gestureGuideShown = false;

function maybeShowGestureGuide() {
  if (gestureGuideShown) return;
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
  // Dismissal is a user gesture, so audio may be unlocked here. Do not start sound by itself.
  unlockBreakSound();
  try { localStorage.setItem(GESTURE_GUIDE_KEY, 'done'); } catch { /* Keep this session dismissed. */ }
});
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
  gestureGuide.addEventListener(type, (event) => event.stopPropagation());
}

export { gestureGuide, maybeShowGestureGuide, hideGestureGuide };
