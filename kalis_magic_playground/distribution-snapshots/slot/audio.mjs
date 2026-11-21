export function createAudio(enabled) {
  let ctx;
  const tones = new Set();
  function stop() {
    for (const tone of tones) { try { tone.stop(); } catch {} }
    tones.clear();
  }
  return {stop, unlock() {
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume().catch(() => {});
    } catch {}
  }, play(effect) {
    if (!enabled() || ctx?.state !== 'running') return;
    try {
      const tone = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime;
      const open = effect === 'open', duration = open ? .19 : .075;
      tone.type = open ? 'sine' : 'triangle';
      tone.frequency.setValueAtTime(open ? 510 : 320,t);
      tone.frequency.exponentialRampToValueAtTime(open ? 940 : 125,t+duration);
      gain.gain.setValueAtTime(.085,t);
      gain.gain.exponentialRampToValueAtTime(.001,t+duration);
      tone.connect(gain).connect(ctx.destination);
      tones.add(tone);
      tone.onended = () => { tones.delete(tone); tone.disconnect(); gain.disconnect(); };
      tone.start(t); tone.stop(t+duration);
    } catch {}
  }};
}
