globalThis.TabataAudio = function (opts) {
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function unlockAudio() {
    const a = audio();
    if (!a) return;
    try {
      const source = a.createBufferSource();
      source.buffer = a.createBuffer(1, 1, a.sampleRate);
      source.connect(a.destination);
      source.start(0);
    } catch {}
  }
  function tone(freq, dur, when = 0, vol = 0.32) {
    if (!opts.beep) return;
    const a = audio(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function say(text) {
    if (!opts.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch {}
  }
  function vibe(p) { if (opts.vibe && navigator.vibrate) { try { navigator.vibrate(p); } catch {} } }

  return { unlockAudio, tone, say, vibe };
};
