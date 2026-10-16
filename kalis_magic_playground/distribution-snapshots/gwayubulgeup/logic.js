// Portrait stopwatch trick. Hundredths are the two digits after the decimal (centiseconds).
export const TRICK_STORAGE_KEY = 'gwayubulgeup_trick';
export const TRICK_LIMIT_MS = 16000;
export const MAX_DISPLAY_MS = 99 * 60000 + 59 * 1000 + 990;

// lastLapElapsed is the running-clock point of the latest lap. Snap only when the
// forced value is not earlier than that point; otherwise the lap list would outrun the total.
export function trickStopMs(elapsedMs, trickOn, lastLapElapsed = 0) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (!trickOn) return elapsed;
  const wholeSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(wholeSeconds / 60);
  if (minutes > 0 || elapsed >= TRICK_LIMIT_MS) return elapsed;
  const hundredths = 15 - wholeSeconds;
  const forced = wholeSeconds * 1000 + hundredths * 10;
  const lapPoint = Number.isFinite(lastLapElapsed) ? Math.max(0, lastLapElapsed) : 0;
  if (forced < lapPoint) return elapsed;
  return forced;
}

// Six digits MMSSCC. Running time and a forced stop both render through this.
export function stopwatchDigits(elapsedMs) {
  const elapsed = Math.min(MAX_DISPLAY_MS, Math.max(0, Math.floor(Number(elapsedMs) || 0)));
  const centiseconds = Math.floor(elapsed / 10);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const hundredths = centiseconds % 100;
  return String(minutes).padStart(2, '0') + String(seconds).padStart(2, '0') + String(hundredths).padStart(2, '0');
}
