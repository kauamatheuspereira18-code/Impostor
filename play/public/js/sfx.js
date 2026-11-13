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
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
  }

  get ready() {
    return !!this.ctx && !this.muted;
  }

  setMuted(v) {
    this.muted = !!v;
    if (this.master) this.master.gain.value = v ? 0 : 0.55;
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
    this.tone({ freq: 620, to: 480, type: 'triangle', dur: 0.06, gain: 0.10 });
  }

  hover() {
    this.tone({ freq: 900, type: 'sine', dur: 0.03, gain: 0.03 });
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
    this.noise({ dur: 0.07, gain: 0.05, filter: 320, type: 'lowpass' });
  }

  vent() {
    this.noise({ dur: 0.35, gain: 0.16, filter: 900, sweepTo: 240 });
    this.tone({ freq: 200, to: 90, type: 'sawtooth', dur: 0.3, gain: 0.08 });
  }

  kill() {
    this.noise({ dur: 0.45, gain: 0.32, filter: 1600, sweepTo: 180 });
    this.tone({ freq: 180, to: 55, type: 'sawtooth', dur: 0.5, gain: 0.22 });
    this.tone({ freq: 90, to: 40, type: 'sine', dur: 0.7, gain: 0.2, delay: 0.03 });
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
    this.noise({ dur: 1.4, gain: 0.20, filter: 200, type: 'lowpass', sweepTo: 2400 });
    this.tone({ freq: 120, to: 60, type: 'sine', dur: 1.2, gain: 0.14 });
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
    g.gain.value = 0.045;
    osc.connect(f);
    osc2.connect(f);
    f.connect(g).connect(this.master);
    osc.start();
    osc2.start();
    this.ambient = { osc, osc2, g };
  }

  stopAmbient() {
    if (!this.ambient) return;
    try {
      this.ambient.osc.stop();
      this.ambient.osc2.stop();
    } catch { /* já parado */ }
    this.ambient = null;
  }
}

export const sfx = new Sfx();
