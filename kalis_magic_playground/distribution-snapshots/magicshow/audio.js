/* Small procedural sound bank. No network or audio assets required. */
(function () {
  'use strict';
  const KEY = 'magicShowBuster.v3.sound';
  let gestured = false;
  let context, master, muted = false, lastTap = -Infinity;
  const voices = new Set();
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (error) { /* Storage is optional. */ }
  function unlock() {
    gestured = true;
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!context) {
        context = new Audio(); master = context.createGain();
        master.gain.value = muted ? 0 : .16; master.connect(context.destination);
      }
      if ((context.state === 'suspended' || context.state === 'interrupted')) context.resume().catch(() => {});
    } catch (error) { /* Unsupported audio must never interrupt the game. */ }
  }
  function tone(freq, duration, delay = 0, type = 'sine', volume = .4, end = freq) {
    if (!context || context.state !== 'running' || muted || document.hidden || voices.size >= 16) return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(master); voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .01);
  }
  function play(name, options = {}) {
    if (!context || muted) return;
    const quiet = options.auto ? .23 : 1;
    const note = (f, d, t = 0, type = 'sine', v = .4, end = f) => tone(f, d, t, type, v * quiet, end);
    const melody = (notes, step, type = 'triangle') => notes.forEach((f, i) => note(f, step * 1.7, i * step, type, .35));
    switch (name) {
      case 'event': melody([784,1047,1568,2093], .06); break;
      case 'skill': melody([523,784,1047,1568], .10); break;
      case 'tap':
        if (context.currentTime - lastTap < .06) return;
        lastTap = context.currentTime; note(1500, .035, 0, 'square', .17, 700); break;
      case 'worker': note(960, .035, 0, 'triangle', .16, 640); break;
      case 'box': note(220, .12, 0, 'triangle', .65, 750); break;
      case 'whoosh': note(1700, .18, 0, 'sawtooth', .08, 120); break;
      case 'hit': note(130, .09, 0, 'square', .3, 45); break;
      case 'heckle': note(340, .15, 0, 'sawtooth', .2, 210); note(240, .13, .13, 'sawtooth', .18, 150); break;
      case 'mental': note(95, .22, 0, 'triangle', .6, 32); break;
      case 'combo': note(330 * Math.pow(2, Math.min(24, options.combo || 1) / 12), .09, 0, 'triangle', .25); break;
      case 'crit': note(1320, .08, 0, 'triangle', .4, 1980); break;
      case 'caseLevel': melody([659, 880, 1047], .055); break;
      case 'caseTier': melody([523, 784, 1047, 1568], .10); break;
      case 'golden': melody([784, 1047, 1568], .09); break;
      case 'milestone': melody([523, 659, 1047], .07); break;
      case 'encore': melody([392, 523, 784, 1047], .1); break;
      case 'finisher': melody([392, 523, 659, 784, 1047], .09); break;
      case 'failure': melody([294, 277, 262], .17, 'sawtooth'); note(247, .65, .51, 'sawtooth', .25, 123); break;
      case 'coin': note(1047, .18, 0, 'sine', .3); note(1568, .25, .06, 'sine', .2); break;
      case 'slot': melody([180, 240, 300, 180, 240, 360, 420, 540], .1, 'square'); break;
      case 'flip': note(800, .06, 0, 'triangle', .25, 220); break;
      case 'rebirth': melody([262, 392, 523, 659, 784, 1047, 1319], .12); break;
      case 'ending': melody([392, 440, 523, 659, 587, 523, 440, 523, 784], .3); break;
    }
  }
  function toggle() {
    unlock(); muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : .16, context.currentTime, .02);
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (error) { /* Storage is optional. */ }
    return !muted;
  }
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && gestured) unlock();
  });
  globalThis.Sfx = { play, unlock, toggle, isMuted: () => muted };
})();
