// ---------- keys: Android KeyEvent codes in the JSON, KeyboardEvent.code on the web ----------
const KEYS = {
  Space: 62, Enter: 66, NumpadEnter: 160, Tab: 61, Backspace: 67, Escape: 111, PageUp: 92, PageDown: 93,
  ArrowUp: 19, ArrowDown: 20, ArrowLeft: 21, ArrowRight: 22, Home: 122, End: 123, Delete: 112, Insert: 124,
  MediaTrackNext: 87, MediaTrackPrevious: 88, MediaPlayPause: 85, MediaStop: 86, MediaPlay: 126, MediaPause: 127,
  AudioVolumeUp: 24, AudioVolumeDown: 25, AudioVolumeMute: 164,
  Comma: 55, Period: 56, Minus: 69, Equal: 70, Backquote: 68, BracketLeft: 71, BracketRight: 72, Backslash: 73,
  Semicolon: 74, Quote: 75, Slash: 76
};
for (let i = 0; i < 26; i++) KEYS['Key' + String.fromCharCode(65 + i)] = 29 + i;
for (let i = 0; i < 10; i++) { KEYS['Digit' + i] = 7 + i; KEYS['Numpad' + i] = 144 + i; }
for (let i = 1; i <= 12; i++) KEYS['F' + i] = 130 + i;
// Some clickers report only event.key (code empty).
const KEY_FALLBACK = { ' ': 'Space', Enter: 'Enter', Escape: 'Escape', PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', MediaTrackNext: 'MediaTrackNext', MediaTrackPrevious: 'MediaTrackPrevious', MediaPlayPause: 'MediaPlayPause', AudioVolumeUp: 'AudioVolumeUp', AudioVolumeDown: 'AudioVolumeDown', AudioVolumeMute: 'AudioVolumeMute' };
export const VOLUME_KEYS = [24, 25, 164];
export function androidKeyCode(event) {
  const code = event.code && KEYS[event.code] ? event.code : KEY_FALLBACK[event.key];
  return code ? KEYS[code] : null;
}
const NAMES = Object.fromEntries(Object.entries(KEYS).map(([name, code]) => [code, name]));
const LABELS = { Space: '스페이스', Enter: '엔터', Escape: 'Esc', PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: '위 방향키', ArrowDown: '아래 방향키', ArrowLeft: '왼쪽 방향키', ArrowRight: '오른쪽 방향키', MediaTrackNext: '다음 곡', MediaTrackPrevious: '이전 곡' };
export function keyLabel(code) {
  const name = NAMES[code];
  if (!name) return '키 ' + code;
  return LABELS[name] || name.replace(/^Key/, '').replace(/^Digit/, '');
}
// Android defaults (MainActivity.defaultAction) plus Escape for PANIC on the web.
export function defaultAction(code) {
  if ([93, 62, 66, 160, 22, 20, 87].includes(code)) return 'GO';
  if ([92, 21, 19, 88].includes(code)) return 'BACK';
  if (code === 111) return 'PANIC';
  return null;
}
export const keyAction = (show, code) => code === null ? null : (show.keyMap[String(code)] ?? defaultAction(code));

/**
 * GO timing for a remote key or the on-screen GO. 'release' (default) matches Android: the action fires when the key
 * is let go, and holding GO for longMs fires PANIC instead of GO. 'press' fires on key down for lower latency, and
 * then a held GO never turns into PANIC (Escape or the on-screen long press stop everything instead).
 * A hold therefore never produces GO followed by PANIC.
 */
export class PressGate {
  constructor(clock, fire, longMs = 1200) { this.clock = clock; this.fire = fire; this.longMs = longMs; this.held = null; }
  down(key, action, mode, info) {
    if (this.held) return false;
    const held = { key, action, mode, longFired: false, timer: null };
    this.held = held;
    if (mode === 'press') { this.fire(action, info); return true; }
    if (action === 'GO') held.timer = this.clock.schedule(this.longMs, () => { held.longFired = true; held.timer = null; this.fire('PANIC', info); });
    return true;
  }
  up(key, info) {
    const held = this.held;
    if (!held || held.key !== key) return false;
    this.held = null;
    held.timer?.cancel();
    if (held.mode !== 'press' && !held.longFired) this.fire(held.action, info);
    return true;
  }
  /** Focus loss or a cancelled touch: nothing fires, like Android's onPause. */
  reset() { this.held?.timer?.cancel(); this.held = null; }
}
