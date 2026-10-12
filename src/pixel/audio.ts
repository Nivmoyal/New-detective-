// Procedural ambience built with the Web Audio API - no sound files.
// Street hum and distant traffic, rain, the station's fluorescent buzz and
// phones, the club's bass through the walls, and footsteps.

type Scene = 'station' | 'street' | 'club';
/** Quiet noir score: a walking bass on the streets, a sparse piano at the station, a heartbeat in the interrogation room. */
export type MusicKind = 'street' | 'station' | 'interrogation';

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** D minor, round and round: Dm9 - Bbmaj7 - Gm7 - A7(b9). */
const CHORDS = [
  { root: 38, notes: [50, 53, 57, 60, 64], walk: [38, 45, 50, 44] },
  { root: 34, notes: [46, 53, 57, 62], walk: [34, 41, 46, 42] },
  { root: 31, notes: [43, 50, 53, 58], walk: [31, 38, 43, 44] },
  { root: 33, notes: [45, 52, 55, 61, 58], walk: [33, 40, 45, 37] },
];
const MELODY = [62, 65, 67, 69, 72, 74, 77];

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

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

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
  private music: MusicKind | null = null;
  private musicBus: GainNode | null = null;
  private musicStop: (() => void) | null = null;
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
      if (this.music) this.buildMusic();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    setSoundPreference(on);
    if (!on) {
      this.clear();
      this.stopMusic();
      void this.ctx?.suspend();
    } else {
      this.unlock();
      if (this.ctx && this.scene) this.build();
      if (this.ctx && this.music) this.buildMusic();
    }
  }

  setScene(kind: Scene, rain: boolean) {
    if (this.scene && this.scene.kind === kind && this.scene.rain === rain) return;
    this.scene = { kind, rain };
    if (this.ctx && this.enabled) this.build();
  }

  /** How loud the club is: muffled outside, loud inside. The score steps aside for the DJ. */
  setInsideClub(inside: boolean) {
    if (!this.ctx) return;
    this.musicBus?.gain.setTargetAtTime(inside ? 0.04 : 0.3, this.ctx.currentTime, 0.6);
    if (!this.clubFilter) return;
    this.clubFilter.frequency.setTargetAtTime(inside ? 2400 : 260, this.ctx.currentTime, 0.4);
  }

  setMusic(kind: MusicKind | null) {
    if (kind === this.music) return;
    this.music = kind;
    if (this.ctx && this.enabled) this.buildMusic();
  }

  private stopMusic() {
    this.musicStop?.();
    this.musicStop = null;
    const bus = this.musicBus;
    this.musicBus = null;
    if (bus && this.ctx) {
      bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      window.setTimeout(() => bus.disconnect(), 3000);
    }
  }

  /** One note of the score, at an exact time on the audio clock. */
  private play(bus: AudioNode, freq: number, at: number, dur: number, gain: number, type: OscillatorType, cutoff: number, attack = 0.02, vibrato = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5;
      depth.gain.value = freq * vibrato;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.1);
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + attack);
    g.gain.setTargetAtTime(0, at + Math.max(attack, dur * 0.6), dur * 0.35);
    o.connect(f).connect(g).connect(bus);
    o.start(at);
    o.stop(at + dur * 2 + 0.2);
  }

  private brush(bus: AudioNode, at: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.white!;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 5200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, at + 0.18);
    src.connect(f).connect(g).connect(bus);
    src.start(at, Math.random(), 0.2);
  }

  private buildMusic() {
    this.stopMusic();
    const ctx = this.ctx;
    const kind = this.music;
    if (!ctx || !kind || !this.white) return;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(kind === 'station' ? 0.22 : 0.3, ctx.currentTime, 1.5);
    bus.connect(this.master!);
    this.musicBus = bus;
    const beat = 60 / (kind === 'street' ? 68 : kind === 'station' ? 56 : 52);
    let bar = 0;
    let next = ctx.currentTime + 0.3;
    const stops: (() => void)[] = [];

    if (kind === 'interrogation') {
      // A low drone that never resolves: D and the A above, slowly beating.
      for (const [m, detune] of [[26, 0], [33, 4]] as const) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(m);
        o.detune.value = detune;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 220;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        o.connect(f).connect(g).connect(bus);
        o.start();
        stops.push(() => o.stop());
      }
    }

    const scheduleBar = (t: number, n: number) => {
      const chord = CHORDS[n % CHORDS.length];
      if (kind === 'interrogation') {
        // Heartbeat on one, and a glassy note that rubs against the drone.
        for (let b = 0; b < 4; b += 2) {
          this.play(bus, 58, t + b * beat, 0.18, 0.32, 'sine', 300, 0.005);
          this.play(bus, 52, t + b * beat + 0.24, 0.16, 0.22, 'sine', 300, 0.005);
        }
        if (n % 2 === 1) this.play(bus, midi(pick([74, 75, 80, 81])), t + beat * (1 + Math.random() * 2), beat * 3, 0.025, 'sine', 3000, 0.8);
        return;
      }
      // Soft pad on the chord.
      for (const m of chord.notes) this.play(bus, midi(m), t, beat * 4, kind === 'station' ? 0.018 : 0.022, 'triangle', 900, 0.9);
      if (kind === 'street') {
        // Walking upright bass, brushes on two and four.
        chord.walk.forEach((m, i) => this.play(bus, midi(m), t + i * beat, beat * 0.9, 0.14, 'triangle', 420, 0.01));
        this.brush(bus, t + beat, 0.02);
        this.brush(bus, t + 3 * beat, 0.02);
        this.brush(bus, t + 3.66 * beat, 0.01);
        // Now and then a muted horn line.
        if (n % 4 !== 0 && Math.random() < 0.55) {
          let at = t + beat * (0.5 + Math.floor(Math.random() * 2));
          const count = 1 + Math.floor(Math.random() * 3);
          for (let k = 0; k < count && at < t + beat * 4; k++) {
            const len = beat * (k === count - 1 ? 1.6 : 0.66);
            this.play(bus, midi(pick(MELODY)), at, len, 0.045, 'sawtooth', 1300, 0.06, 0.006);
            at += len;
          }
        }
      } else {
        // The station: a tired piano, a note or two per bar.
        this.play(bus, midi(chord.root + 12), t, beat * 2, 0.08, 'sine', 600, 0.01);
        if (Math.random() < 0.7) this.play(bus, midi(pick(chord.notes) + 12), t + beat * (1 + Math.floor(Math.random() * 3)), beat * 1.5, 0.035, 'sine', 2500, 0.01);
      }
    };
    const timer = window.setInterval(() => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 1.2) {
        scheduleBar(next, bar++);
        next += beat * 4;
      }
    }, 250);
    stops.push(() => window.clearInterval(timer));
    this.musicStop = () => stops.forEach((f) => f());
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
