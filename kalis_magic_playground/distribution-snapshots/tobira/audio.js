import { motionNote } from './dom.js';
import { wallSoundEnabled, wallVolumeGain } from './performance.js';

let audioContext = null;
function unlockBreakSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
    // iOS can report interrupted as well as suspended. Both need a user gesture.
    if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
      Promise.resolve(audioContext.resume()).catch(() => {});
    }
  } catch { audioContext = null; }
}

function playBreakSound() {
  if (!audioContext || audioContext.state !== 'running') return;
  try {
    const now = audioContext.currentTime;
    // Start the audible transient before the noise buffer is filled.
    const thump = audioContext.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(125, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + .25);
    const thumpGain = audioContext.createGain();
    thumpGain.gain.setValueAtTime(.5, now);
    thumpGain.gain.exponentialRampToValueAtTime(.001, now + .22);
    thump.connect(thumpGain).connect(audioContext.destination);
    thump.start(now);
    thump.stop(now + .22);

    const length = Math.ceil(audioContext.sampleRate * .28);
    const noise = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const crack = audioContext.createBufferSource();
    crack.buffer = noise;
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 850;
    const crackGain = audioContext.createGain();
    crackGain.gain.setValueAtTime(.45, now);
    crackGain.gain.exponentialRampToValueAtTime(.001, now + .28);
    crack.connect(highpass).connect(crackGain).connect(audioContext.destination);
    crack.start(now);
    crack.stop(now + .28);
  } catch { /* Keep the visual effect if audio output fails. */ }
}

function playWallSound(speed, options = {}) {
  const probe = options.probe === true;
  if (!probe && !wallSoundEnabled()) return;
  const gainScale = wallVolumeGain();
  if (!(gainScale > 0)) {
    if (probe) motionNote.textContent = '충돌 소리 크기가 0이라 소리가 나지 않습니다.';
    return;
  }
  if (probe) unlockBreakSound();
  if (!audioContext || (!probe && audioContext.state !== 'running')) {
    if (probe) motionNote.textContent = '소리를 재생하지 못했습니다. 브라우저가 오디오를 시작하지 못했습니다.';
    return;
  }
  try {
    if (probe && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) {
      Promise.resolve(audioContext.resume()).catch(() => {
        motionNote.textContent = '소리를 시작하지 못했습니다. 버튼을 다시 눌러 주세요.';
      });
    }
    const now = audioContext.currentTime;
    const level = Math.min(0.22, Math.max(0.045, speed / 3600)) * gainScale;
    const tap = audioContext.createOscillator();
    const gain = audioContext.createGain();
    tap.type = 'triangle';
    tap.frequency.setValueAtTime(230, now);
    tap.frequency.exponentialRampToValueAtTime(85, now + 0.075);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    tap.connect(gain).connect(audioContext.destination);
    tap.start(now);
    tap.stop(now + 0.09);
  } catch {
    if (probe) motionNote.textContent = '소리를 재생하지 못했습니다.';
  }
}

export { unlockBreakSound, playBreakSound, playWallSound };
