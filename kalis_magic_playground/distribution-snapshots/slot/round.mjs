import {stopTime} from './reels.mjs';
import {contains, rankAt, suitAt} from './zones.mjs';
export function createRound({box, blocked, render, reels, capsule, audio, vibrate, reveal, now = () => performance.now()}) {
  let phase, suit, rank, elapsed = 0, stopped = 0;
  function enter(next) { phase = next; render(next); }
  function reset() {
    suit = rank = undefined;
    elapsed = stopped = 0;
    audio.stop();
    reels.reset();
    capsule('idle');
    reveal(null);
    enter('dark');
  }
  function candidate(x,y) {
    if (blocked()) return;
    const start = phase, at = now();
    const target = {dark:'stage',ready:'spin',waiting:'capsule'}[start];
    if (!target) return;
    const rect = box(target);
    if (!contains(rect,x,y)) return;
    return (endX,endY) => {
      if (phase !== start || blocked() || now()-at > 550 || !contains(box(target),endX,endY)) return;
      if (start === 'dark') {
        suit = suitAt(rect,x,y);
        audio.unlock();
        enter('ready');
      } else if (start === 'ready') {
        rank = rankAt(rect,x,y);
        enter('spinning');
      } else {
        audio.play('open');
        vibrate();
        elapsed = 0;
        capsule('split');
        enter('opening');
      }
    };
  }
  function advance(ms) {
    if (blocked()) return;
    if (phase === 'spinning') {
      elapsed += ms;
      while (stopped < 3 && elapsed >= stopTime(stopped)) {
        stopped++;
        audio.play('stop');
      }
      reels.frame(elapsed);
      if (stopped === 3) {
        elapsed = 0;
        capsule('roll');
        enter('rolling');
      }
    } else if (phase === 'rolling' || phase === 'opening') {
      elapsed += ms;
      if (phase === 'rolling' && elapsed >= 600) enter('waiting');
      if (phase === 'opening' && elapsed >= 300) {
        reveal({suit,rank});
        enter('revealed');
      }
    }
  }
  reset();
  return {reset,candidate,advance};
}
