export function createAudio(enabled) {
  let ctx, motor;
  const voices = new Set();
  function tone(hz,end,duration,volume,type,delay=0) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz,t);
    gain.gain.setValueAtTime(.001,t);
    gain.gain.linearRampToValueAtTime(volume,t+.009);
    if (duration) {
      osc.frequency.exponentialRampToValueAtTime(end,t+duration);
      gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    }
    osc.connect(gain).connect(ctx.destination);
    voices.add(osc);
    osc.onended = () => { voices.delete(osc); osc.disconnect(); gain.disconnect(); };
    osc.start(t);
    if (duration) osc.stop(t+duration);
    return osc;
  }
  return {
    unlock() {
      try {
        ctx ||= new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume().catch(() => {});
      } catch {}
    },
    stop() {
      for (const voice of voices) { try { voice.stop(); } catch {} }
      motor = null;
    },
    play(effect,index=0) {
      if (!enabled() || ctx?.state !== 'running') return;
      const pitch = [1,.96,1.04][index%3];
      if (effect === 'motor') motor ||= tone(83,83,0,.026,'triangle');
      if (effect === 'tick') tone(730*pitch,370,.032,.031,'triangle');
      if (effect === 'stop') {
        if (index === 3 && motor) { motor.stop(); motor = null; }
        tone(205*pitch,61,.11,.12,'triangle');
      }
      if (effect === 'open') tone(510,940,.19,.085,'sine');
      if (effect === 'win') [523,659,784,1047].forEach((f,i) => tone(f,f,.3,.075,'sine',i*.105));
    }
  };
}
