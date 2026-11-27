import { preset } from './presets.mjs';

const bellNoiseBand = [3000, 8000];
const knockSound = {
  hz: [240, 615], weights: [1, .42], decay: [.021, .010],
  level: .24, noise: .42, noiseBand: [500, 1800],
};

function strike(context, sound, voices, onStarted) {
  const time = context.currentTime;
  const bus = context.createGain();
  bus.connect(context.destination);
  const sources = [];
  const nodes = [bus];
  const scale = (sound.level ?? .35) / sound.weights.reduce((total, weight) => total + weight, 0);
  const previous = voices.length === 2 ? voices.shift() : null;
  if (previous) previous.fade(time);

  function play(source, path, end) {
    sources.push(source);
    nodes.push(source, ...path);
    let output = source;
    for (const node of path) output = output.connect(node);
    output.connect(bus);
    source.start(time);
    if (sources.length === 1) onStarted?.();
    source.stop(end);
  }

  sound.hz.forEach((hz, i) => {
    const wave = context.createOscillator();
    wave.frequency.value = hz;
    const envelope = context.createGain();
    const peak = scale * sound.weights[i];
    const end = time + .003 + sound.decay[i];
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(peak, time + .003);
    envelope.gain.exponentialRampToValueAtTime(peak * .01, end);
    envelope.gain.linearRampToValueAtTime(0, end + .010);
    play(wave, [envelope], end + .010);
  });

  if (sound.noise) {
    const noise = context.createBufferSource();
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .008), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const [low, high] = sound.noiseBand ?? bellNoiseBand;
    const filters = [['highpass', low], ['lowpass', high]].map(([type, hz]) => {
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = hz;
      return filter;
    });
    const level = context.createGain();
    level.gain.setValueAtTime(Math.max(...sound.weights) * scale * sound.noise, time);
    level.gain.linearRampToValueAtTime(0, time + .008);
    play(noise, [...filters, level], time + .008);
  }

  const voice = { fade(now) {
    bus.gain.setValueAtTime(1, now);
    bus.gain.linearRampToValueAtTime(0, now + .015);
    for (const source of sources) source.stop(now + .015);
  }};
  voices.push(voice);
  // The first partial has the longest envelope in every sound.
  sources[0].onended = () => {
    const index = voices.indexOf(voice);
    if (index >= 0) voices.splice(index, 1);
    for (const node of nodes) node.disconnect();
  };
}

export function createSynth(makeContext = () => new (window.AudioContext || window.webkitAudioContext)()) {
  let context;
  let voices = [];
  let generation = 0;

  async function play(sound, onStarted) {
    const ticket = generation;
    try {
      if (!context || context.state === 'closed') {
        context = makeContext();
        voices = [];
      }
      const device = context;
      if (device.state !== 'running') await device.resume();
      if (device === context && device.state === 'running' && generation === ticket) strike(device, sound, voices, onStarted);
    } catch { /* Audio can be unavailable on a restricted device. */ }
  }

  return {
    cancelPending() { generation++; },
    ring(id, onStarted) { return play(preset(id), onStarted); },
    knock() { return play(knockSound); },
  };
}
