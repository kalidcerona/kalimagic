import { $, rank, suit, brightness, gestureGuide } from "./dom.js";

const gestureGuideKey = "alter-settings-gesture-guide-v1";
const suits = {
  spade: { symbol: "♠", red: false },
  heart: { symbol: "♥", red: true },
  club: { symbol: "♣", red: false },
  diamond: { symbol: "♦", red: true },
};

function shouldShowGestureGuide() {
  try { return localStorage.getItem(gestureGuideKey) !== "seen"; }
  catch { return true; }
}

function closeGestureGuide(remember = true) {
  gestureGuide.hidden = true;
  if (!remember) return;
  try { localStorage.setItem(gestureGuideKey, "seen"); }
  catch { /* The guide may reappear when storage is unavailable. */ }
}

function showGestureGuide() {
  if (!shouldShowGestureGuide()) return;
  gestureGuide.hidden = false;
  $("close-gesture-guide").focus();
}

function readSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("alter-settings") || "{}");
    if ([...rank.options].some((option) => option.value === saved.rank)) rank.value = saved.rank;
    if (suits[saved.suit]) suit.value = saved.suit;
    if (Number.isFinite(saved.brightness)) {
      brightness.value = String(Math.max(75, Math.min(125, saved.brightness)));
    }
  } catch {
    // Storage is optional; private browsing may block it.
  }
}

function saveSettings() {
  try {
    localStorage.setItem("alter-settings", JSON.stringify({
      rank: rank.value, suit: suit.value, brightness: Number(brightness.value),
    }));
  } catch {
    // The effect continues without persistence.
  }
}

export { suits, shouldShowGestureGuide, closeGestureGuide, showGestureGuide, readSavedSettings, saveSettings };
