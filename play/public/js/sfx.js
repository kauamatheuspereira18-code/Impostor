/* Efeitos sonoros sintetizados com WebAudio (sem arquivos externos).
   Cada som é montado com osciladores e ruído filtrado, no espírito dos
   bipes e alarmes do jogo. */

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambient = null;
    this.alarm = null;
    this.alarmOn = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.70;
    this.master.connect(this.ctx.destination);
  }

  get ready() {
    return !!this.ctx && !this.muted;
  }

  setMuted(v) {
    this.muted = !!v;
    if (this.master) this.master.gain.value = v ? 0 : 0.70;
    if (v) this.stopAlarm();
  }

  /* ---------- blocos básicos ---------- */
  tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.2, to = null, delay = 0, attack = 0.006, curve = 'exp' }) {
    if (!this.ready) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.2, delay = 0, filter = 1200, q = 1, type = 'bandpass', sweepTo = null }) {
    if (!this.ready) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filter, t0);
    f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  /* ---------- interface ---------- */
  click() {
    this.tone({ freq: 620, to: 480, type: 'triangle', dur: 0.06, gain: 0.12 });
  }

  hover() {
    this.tone({ freq: 900, type: 'sine', dur: 0.045, gain: 0.05 });
  }

  taskStep() {
    this.tone({ freq: 520, to: 780, type: 'square', dur: 0.09, gain: 0.07 });
  }

  taskDone() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.11, delay: i * 0.075 }));
  }

  /* ---------- jogo ---------- */
  footstep() {
    this.noise({ dur: 0.09, gain: 0.11, filter: 520, type: 'lowpass' });
  }

  vent() {
    this.noise({ dur: 0.35, gain: 0.16, filter: 900, sweepTo: 240 });
    this.tone({ freq: 200, to: 90, type: 'sawtooth', dur: 0.3, gain: 0.08 });
  }

  kill(volume = 1) {
    // volume cai com a distância (quem está longe ouve o grito abafado)
    const v = Math.max(0.12, Math.min(1, volume));
    this.noise({ dur: 0.45, gain: 0.32 * v, filter: 1600, sweepTo: 180 });
    this.tone({ freq: 180, to: 55, type: 'sawtooth', dur: 0.5, gain: 0.22 * v });
    this.tone({ freq: 90, to: 40, type: 'sine', dur: 0.7, gain: 0.2 * v, delay: 0.03 });
  }

  report() {
    [880, 660, 880, 660].forEach((f, i) =>
      this.tone({ freq: f, type: 'square', dur: 0.14, gain: 0.14, delay: i * 0.13 }));
  }

  meeting() {
    this.report();
    setTimeout(() => this.tone({ freq: 140, to: 90, type: 'sawtooth', dur: 0.7, gain: 0.12 }), 250);
  }

  vote() {
    this.tone({ freq: 760, to: 1180, type: 'triangle', dur: 0.14, gain: 0.12 });
  }

  eject() {
    // ar comprimido da escotilha + casco tremendo
    this.noise({ dur: 1.6, gain: 0.22, filter: 240, type: 'bandpass', sweepTo: 3200 });
    this.noise({ dur: 0.22, gain: 0.12, filter: 1800, type: 'highpass', delay: 0.9 });
    this.tone({ freq: 96, to: 42, type: 'sine', dur: 1.1, gain: 0.16 });
  }

  /** Resultado da votação: acertou o impostor (ok) ou não. */
  ejectResult(ok) {
    if (ok) {
      this.tone({ freq: 523, type: 'triangle', dur: 0.16, gain: 0.13, delay: 0 });
      this.tone({ freq: 659, type: 'triangle', dur: 0.16, gain: 0.13, delay: 0.14 });
      this.tone({ freq: 880, type: 'triangle', dur: 0.30, gain: 0.13, delay: 0.28 });
    } else {
      this.tone({ freq: 330, to: 240, type: 'sine', dur: 0.34, gain: 0.12 });
      this.tone({ freq: 196, to: 150, type: 'sine', dur: 0.40, gain: 0.12, delay: 0.20 });
    }
  }

  denied() {
    this.tone({ freq: 226, type: 'square', dur: 0.11, gain: 0.09 });
    this.tone({ freq: 170, type: 'square', dur: 0.16, gain: 0.09, delay: 0.10 });
  }

  door() {
    this.noise({ dur: 0.28, gain: 0.20, filter: 700, type: 'bandpass', sweepTo: 160 });
    this.tone({ freq: 120, to: 60, type: 'square', dur: 0.22, gain: 0.1 });
  }

  sabotage() {
    this.tone({ freq: 300, to: 120, type: 'sawtooth', dur: 0.7, gain: 0.16 });
    this.tone({ freq: 150, to: 70, type: 'square', dur: 0.8, gain: 0.10, delay: 0.05 });
  }

  fixed() {
    [392, 523, 659].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 0.2, gain: 0.12, delay: i * 0.09 }));
  }

  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      this.tone({ freq: f, type: 'triangle', dur: 0.28, gain: 0.14, delay: i * 0.12 }));
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) =>
      this.tone({ freq: f, type: 'sawtooth', dur: 0.35, gain: 0.13, delay: i * 0.16 }));
  }

  /* ---------- habilidades ---------- */
  shift() {
    // shimmer metálico da transformação
    this.tone({ freq: 320, to: 880, type: 'triangle', dur: 0.4, gain: 0.10 });
    this.tone({ freq: 640, to: 1320, type: 'sine', dur: 0.35, gain: 0.07, delay: 0.05 });
    this.noise({ dur: 0.3, gain: 0.05, filter: 2200, sweepTo: 900 });
  }

  phantom() {
    // quem some: grave subindo + sopro
    this.tone({ freq: 180, to: 60, type: 'sine', dur: 0.6, gain: 0.12 });
    this.noise({ dur: 0.5, gain: 0.07, filter: 500, sweepTo: 1800 });
  }

  shield() {
    // bolha do anjo da guarda
    this.tone({ freq: 520, to: 760, type: 'sine', dur: 0.35, gain: 0.09 });
    this.tone({ freq: 780, to: 1040, type: 'sine', dur: 0.4, gain: 0.06, delay: 0.06 });
  }

  track() {
    this.tone({ freq: 980, to: 1320, type: 'square', dur: 0.08, gain: 0.085 });
    this.tone({ freq: 1320, type: 'square', dur: 0.06, gain: 0.06, delay: 0.09 });
  }

  abilityReady() {
    this.tone({ freq: 660, to: 990, type: 'sine', dur: 0.12, gain: 0.08 });
  }

  killReady() {
    [440, 660].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.1, gain: 0.085, delay: i * 0.1 }));
  }

  /* ---------- interface do jogo ---------- */
  chat() {
    this.tone({ freq: 880, type: 'sine', dur: 0.06, gain: 0.075 });
  }

  tick() {
    this.tone({ freq: 1200, type: 'square', dur: 0.045, gain: 0.07 });
  }

  emergency() {
    this.tone({ freq: 300, to: 180, type: 'square', dur: 0.25, gain: 0.13 });
    this.noise({ dur: 0.25, gain: 0.10, filter: 900, sweepTo: 300 });
  }

  ghost() {
    this.tone({ freq: 220, to: 90, type: 'sine', dur: 0.9, gain: 0.10 });
    this.noise({ dur: 0.8, gain: 0.06, filter: 420, sweepTo: 1200 });
  }

  allTasks() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      this.tone({ freq: f, type: 'triangle', dur: 0.22, gain: 0.12, delay: i * 0.1 }));
  }

  /* ---------- alarme de sabotagem crítica ---------- */
  startAlarm() {
    if (!this.ready || this.alarmOn) return;
    this.alarmOn = true;
    const beep = () => {
      if (!this.alarmOn) return;
      this.tone({ freq: 900, type: 'square', dur: 0.16, gain: 0.085 });
      this.tone({ freq: 640, type: 'square', dur: 0.16, gain: 0.085, delay: 0.2 });
      this.alarm = setTimeout(beep, 900);
    };
    beep();
  }

  stopAlarm() {
    this.alarmOn = false;
    if (this.alarm) clearTimeout(this.alarm);
    this.alarm = null;
  }

  /* ---------- ambiente ---------- */
  startAmbient() {
    if (!this.ready || this.ambient) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const osc2 = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.value = 55;
    osc2.type = 'sine';
    osc2.frequency.value = 82.5;
    f.type = 'lowpass';
    f.frequency.value = 260;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.030, t + 0.8);
    osc.connect(f);
    osc2.connect(f);
    f.connect(g).connect(this.master);
    osc.start(t);
    osc2.start(t);
    this.ambient = { osc, osc2, g };
  }

  stopAmbient() {
    if (!this.ambient) return;
    const { osc, osc2, g } = this.ambient;
    this.ambient = null;
    const t = this.ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.stop(t + 0.4);
      osc2.stop(t + 0.4);
    } catch { /* já parado */ }
  }
}

export const sfx = new Sfx();
