// Procedural ambience built with the Web Audio API - no sound files.
// Street hum and distant traffic, rain, the station's fluorescent buzz and
// phones, the club's bass through the walls, and footsteps.

type Scene = 'station' | 'street' | 'club';

const PREF_KEY = 'precinct-sound';

export function soundPreference(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundPreference(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Preference only lasts for this visit.
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

class AmbientAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: { stop: () => void }[] = [];
  private timers: number[] = [];
  private white: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private clubFilter: BiquadFilterNode | null = null;
  private scene: { kind: Scene; rain: boolean } | null = null;
  enabled = soundPreference();

  /** Must be called from a user gesture the first time (browser autoplay rules). */
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.white = noiseBuffer(this.ctx, 2, false);
      this.brown = noiseBuffer(this.ctx, 4, true);
      if (this.scene) this.build();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    setSoundPreference(on);
    if (!on) {
      this.clear();
      void this.ctx?.suspend();
    } else {
      this.unlock();
      if (this.ctx && this.scene) this.build();
    }
  }

  setScene(kind: Scene, rain: boolean) {
    if (this.scene && this.scene.kind === kind && this.scene.rain === rain) return;
    this.scene = { kind, rain };
    if (this.ctx && this.enabled) this.build();
  }

  /** How loud the club is: muffled outside, loud inside. */
  setInsideClub(inside: boolean) {
    if (!this.ctx || !this.clubFilter) return;
    this.clubFilter.frequency.setTargetAtTime(inside ? 2400 : 260, this.ctx.currentTime, 0.4);
  }

  step(surface: 'hard' | 'soft' = 'hard') {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || !this.white || ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = surface === 'hard' ? 1300 + Math.random() * 500 : 500;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(surface === 'hard' ? 0.16 : 0.09, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t, Math.random() * 1.5, 0.12);
  }

  blip() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || ctx.state !== 'running') return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = 'triangle';
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(990, t + 0.06);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.13);
  }

  private clear() {
    this.layers.forEach((l) => l.stop());
    this.layers = [];
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
    this.clubFilter = null;
  }

  private loopNoise(buf: AudioBuffer, filter: BiquadFilterType, freq: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(gain, ctx.currentTime, 1.2);
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    this.layers.push({ stop: () => src.stop() });
  }

  private every(minMs: number, maxMs: number, fn: () => void) {
    const tick = () => {
      fn();
      this.timers.push(window.setTimeout(tick, minMs + Math.random() * (maxMs - minMs)));
    };
    this.timers.push(window.setTimeout(tick, minMs * 0.5 + Math.random() * minMs));
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, slideTo?: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + when;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest ?? this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private build() {
    this.clear();
    if (!this.ctx || !this.scene || !this.white || !this.brown) return;
    const { kind, rain } = this.scene;
    // City hum is everywhere, quieter indoors.
    this.loopNoise(this.brown, 'lowpass', 380, kind === 'station' ? 0.05 : 0.13);
    if (rain) {
      this.loopNoise(this.white, 'highpass', 2600, 0.05);
      this.loopNoise(this.white, 'bandpass', 900, 0.02);
    }
    if (kind === 'street' || kind === 'club') {
      // A car passing in the distance, now and then a horn, a scooter.
      this.every(5000, 11000, () => {
        const ctx = this.ctx!;
        const src = ctx.createBufferSource();
        src.buffer = this.brown!;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.22, t + 1.4);
        g.gain.linearRampToValueAtTime(0, t + 3.2);
        src.connect(f).connect(g).connect(this.master!);
        src.start(t, Math.random() * 2, 3.3);
      });
      this.every(14000, 30000, () => {
        const f = 330 + Math.random() * 120;
        this.tone(f, 0.28, 0.035, 'square');
        if (Math.random() < 0.5) this.tone(f, 0.18, 0.035, 'square', 0.36);
      });
      this.every(18000, 40000, () => this.tone(180, 1.6, 0.025, 'sawtooth', 0, 260));
    }
    if (kind === 'station') {
      // Fluorescent tubes and the phones that never stop.
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.frequency.value = 100;
      const g = ctx.createGain();
      g.gain.value = 0.012;
      o.connect(g).connect(this.master!);
      o.start();
      this.layers.push({ stop: () => o.stop() });
      this.every(16000, 32000, () => {
        for (let r = 0; r < 2; r++)
          for (let i = 0; i < 8; i++) {
            this.tone(i % 2 ? 1320 : 1100, 0.05, 0.018, 'sine', r * 1.1 + i * 0.05);
          }
      });
    }
    if (kind === 'club') {
      // Four on the floor through the walls.
      const ctx = this.ctx;
      this.clubFilter = ctx.createBiquadFilter();
      this.clubFilter.type = 'lowpass';
      this.clubFilter.frequency.value = 260;
      const bus = ctx.createGain();
      bus.gain.value = 0.9;
      bus.connect(this.clubFilter).connect(this.master!);
      const beat = 60 / 124;
      let n = 0;
      const id = window.setInterval(() => {
        this.tone(120, 0.22, 0.3, 'sine', 0, 45, bus);
        if (n % 2 === 1) this.tone(8000, 0.04, 0.03, 'square', 0, undefined, bus);
        if (n % 8 === 4) this.tone(220, 0.35, 0.07, 'sawtooth', 0, 110, bus);
        n++;
      }, beat * 1000);
      this.layers.push({ stop: () => window.clearInterval(id) });
    }
  }
}

export const ambient = new AmbientAudio();
