// Synthetic Web Audio API Sound Effects for Basketball Dropzone (0 external dependencies)

export type BasketballSoundKind =
  | 'launch'
  | 'swish2'
  | 'swish3'
  | 'greenRelease'
  | 'rimClank'
  | 'backboardThud'
  | 'floorBounce';

export function playBasketballSound(kind: BasketballSoundKind, enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (kind === 'launch') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (kind === 'greenRelease') {
      // 2K style brilliant green release bell chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(1318.51, now); // E6
      osc2.frequency.setValueAtTime(1567.98, now + 0.04); // G6
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now + 0.04);
      osc1.stop(now + 0.46);
      osc2.stop(now + 0.46);
    } else if (kind === 'rimClank') {
      // Metallic iron clang
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (kind === 'backboardThud') {
      // Heavy acrylic/wood thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.16);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (kind === 'floorBounce') {
      // Ball bouncing on wood floor
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      // Swish net sound
      const bufferSize = ctx.sampleRate * 0.2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now);

      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'triangle';
      if (kind === 'swish3') {
        chime.frequency.setValueAtTime(587.33, now + 0.03);
        chime.frequency.setValueAtTime(783.99, now + 0.09);
        chime.frequency.setValueAtTime(1046.5, now + 0.16);
        chimeGain.gain.setValueAtTime(0.065, now + 0.03);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      } else {
        chime.frequency.setValueAtTime(587.33, now + 0.04);
        chime.frequency.setValueAtTime(880, now + 0.11);
        chimeGain.gain.setValueAtTime(0.05, now + 0.04);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      }
      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.start(now + 0.03);
      chime.stop(now + 0.35);
    }
  } catch {
    // Ignore audio context restrictions
  }
}
