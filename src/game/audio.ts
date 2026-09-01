export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  sfxOn = true;
  musicOn = true;
  musicTimer = 0;
  step = 0;
  wind: OscillatorNode | null = null;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new C({ latencyHint: "interactive" });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.master.gain.value = 0.7;
    this.sfx.gain.value = this.sfxOn ? 0.9 : 0;
    this.music.gain.value = this.musicOn ? 0.22 : 0;
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(ctx.destination);
    this.startWind();
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    this.sfx?.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx?.currentTime ?? 0, 0.03);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    this.music?.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx?.currentTime ?? 0, 0.05);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.12,
    slide?: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.08, hp = 400) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = n;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  ui() {
    this.tone(880, 0.06, "square", 0.05);
  }
  deny() {
    this.tone(140, 0.16, "square", 0.08, 0.5);
  }
  place() {
    this.tone(90 + Math.random() * 20, 0.14, "triangle", 0.14, 0.7);
    this.noise(0.08, 0.05, 200);
  }
  shoot() {
    this.tone(520 + Math.random() * 40, 0.05, "square", 0.04, 1.4);
  }
  hit() {
    this.tone(220 + Math.random() * 80, 0.05, "square", 0.05);
    this.noise(0.04, 0.04, 800);
  }
  eat() {
    this.noise(0.12, 0.1, 120);
    this.tone(80, 0.18, "sawtooth", 0.08, 0.6);
  }
  brain() {
    this.tone(180, 0.28, "sine", 0.12, 1.6);
    this.tone(270, 0.32, "triangle", 0.08, 1.4);
  }
  groan() {
    this.tone(70 + Math.random() * 18, 0.28, "sawtooth", 0.07, 0.7);
  }
  win() {
    this.tone(392, 0.18, "triangle", 0.1);
    this.tone(523, 0.22, "triangle", 0.1);
    this.tone(659, 0.4, "triangle", 0.12);
  }
  lose() {
    this.tone(220, 0.3, "sawtooth", 0.1, 0.5);
    this.tone(110, 0.5, "triangle", 0.1, 0.4);
  }

  private startWind() {
    const ctx = this.ctx;
    if (!ctx || !this.music || this.wind) return;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 55;
    f.type = "lowpass";
    f.frequency.value = 240;
    g.gain.value = 0.15;
    o.connect(f);
    f.connect(g);
    g.connect(this.music);
    o.start();
    this.wind = o;
  }

  tickMusic(dt: number) {
    if (!this.ctx || !this.musicOn) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.55) return;
    this.musicTimer = 0;
    const notes = [110, 130.8, 146.8, 164.8, 130.8, 98, 110, 87];
    const freq = notes[this.step % notes.length]!;
    this.step += 1;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g);
    g.connect(this.music!);
    o.start(t);
    o.stop(t + 0.55);
  }
}
