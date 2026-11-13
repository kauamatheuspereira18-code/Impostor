/* Música de fundo (recurso extra, fora do jogo original).
   - Tela inicial: tema próprio ("União Flasco").
   - Lobby (partida criada, ainda não começou): uma das três faixas pedidas,
     sorteada a cada entrada no lobby, em loop e bem baixinho no fundo.
   - Se existir um arquivo de verdade em public/music/<id>.mp3 (ou .ogg/.wav),
     ele é usado no lugar da versão sintetizada.
   Toda a música passa pelo ganho mestre do sfx, então o botão de mudo vale. */

import { sfx } from './sfx.js';

const NOTAS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function hz(nota) {
  const m = /^([A-G]#?)(-?\d)$/.exec(nota);
  if (!m) return 0;
  const semitom = NOTAS[m[1]] + (Number(m[2]) - 4) * 12 - 9;
  return 440 * Math.pow(2, semitom / 12);
}

/* ------------------------------------------------------------------ faixas
   Cada faixa é um loop: 'beats' é o tamanho do compasso em batidas.
   evento = { b: batida, n: nota ('A3'), d: duração em batidas, v: volume } */
const FAIXAS = {
  'uniao-flasco': {
    titulo: 'União Flasco',
    bpm: 98,
    beats: 16,
    lead: [
      { b: 0, n: 'A3', d: 0.5 }, { b: 0.5, n: 'A3', d: 0.5 }, { b: 1, n: 'C4', d: 0.5 },
      { b: 1.5, n: 'D4', d: 0.5 }, { b: 2, n: 'E4', d: 1 }, { b: 3, n: 'D4', d: 0.5 },
      { b: 3.5, n: 'C4', d: 0.5 }, { b: 4, n: 'A3', d: 1.5 }, { b: 6, n: 'G3', d: 0.5 },
      { b: 6.5, n: 'A3', d: 0.5 }, { b: 7, n: 'C4', d: 1 }, { b: 8, n: 'D4', d: 0.5 },
      { b: 8.5, n: 'E4', d: 0.5 }, { b: 9, n: 'G4', d: 1 }, { b: 10, n: 'E4', d: 0.5 },
      { b: 10.5, n: 'D4', d: 0.5 }, { b: 11, n: 'C4', d: 1 }, { b: 12, n: 'A3', d: 2 },
      { b: 14, n: 'G3', d: 0.5 }, { b: 14.5, n: 'A3', d: 0.5 }, { b: 15, n: 'C4', d: 1 },
    ],
    bass: [
      { b: 0, n: 'A2', d: 0.75 }, { b: 1, n: 'A2', d: 0.5 }, { b: 2, n: 'E2', d: 0.75 },
      { b: 3, n: 'E2', d: 0.5 }, { b: 4, n: 'F2', d: 0.75 }, { b: 5, n: 'F2', d: 0.5 },
      { b: 6, n: 'G2', d: 0.75 }, { b: 7, n: 'G2', d: 0.5 }, { b: 8, n: 'A2', d: 0.75 },
      { b: 9, n: 'A2', d: 0.5 }, { b: 10, n: 'E2', d: 0.75 }, { b: 11, n: 'E2', d: 0.5 },
      { b: 12, n: 'F2', d: 0.75 }, { b: 13, n: 'G2', d: 0.75 }, { b: 14, n: 'A2', d: 1 },
      { b: 15, n: 'E2', d: 1 },
    ],
    drums: { kick: [0, 2, 4, 6, 8, 10, 12, 14], hat: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5], snare: [4, 12] },
  },

  'vida-de-empreguete': {
    titulo: 'Vida de Empreguete',
    bpm: 124,
    beats: 16,
    lead: [
      { b: 0, n: 'C5', d: 0.5 }, { b: 0.5, n: 'C5', d: 0.5 }, { b: 1, n: 'E5', d: 0.5 },
      { b: 1.5, n: 'G5', d: 0.5 }, { b: 2, n: 'E5', d: 1 }, { b: 3, n: 'D5', d: 0.5 },
      { b: 3.5, n: 'C5', d: 0.5 }, { b: 4, n: 'D5', d: 1.5 }, { b: 6, n: 'E5', d: 1 },
      { b: 7, n: 'D5', d: 0.5 }, { b: 7.5, n: 'C5', d: 0.5 }, { b: 8, n: 'A4', d: 1 },
      { b: 9, n: 'C5', d: 1 }, { b: 10, n: 'E5', d: 1 }, { b: 11, n: 'G5', d: 1 },
      { b: 12, n: 'F5', d: 0.5 }, { b: 12.5, n: 'E5', d: 0.5 }, { b: 13, n: 'D5', d: 1 },
      { b: 14, n: 'C5', d: 2 },
    ],
    bass: [
      { b: 0, n: 'C3', d: 0.5 }, { b: 0.5, n: 'G3', d: 0.5 }, { b: 1, n: 'C3', d: 0.5 },
      { b: 1.5, n: 'G3', d: 0.5 }, { b: 2, n: 'A2', d: 0.5 }, { b: 2.5, n: 'E3', d: 0.5 },
      { b: 3, n: 'A2', d: 0.5 }, { b: 3.5, n: 'E3', d: 0.5 }, { b: 4, n: 'F2', d: 0.5 },
      { b: 4.5, n: 'C3', d: 0.5 }, { b: 5, n: 'F2', d: 0.5 }, { b: 5.5, n: 'C3', d: 0.5 },
      { b: 6, n: 'G2', d: 0.5 }, { b: 6.5, n: 'D3', d: 0.5 }, { b: 7, n: 'G2', d: 0.5 },
      { b: 7.5, n: 'D3', d: 0.5 }, { b: 8, n: 'C3', d: 0.5 }, { b: 8.5, n: 'G3', d: 0.5 },
      { b: 9, n: 'C3', d: 0.5 }, { b: 9.5, n: 'G3', d: 0.5 }, { b: 10, n: 'A2', d: 0.5 },
      { b: 10.5, n: 'E3', d: 0.5 }, { b: 11, n: 'A2', d: 0.5 }, { b: 11.5, n: 'E3', d: 0.5 },
      { b: 12, n: 'F2', d: 0.5 }, { b: 12.5, n: 'C3', d: 0.5 }, { b: 13, n: 'G2', d: 0.5 },
      { b: 13.5, n: 'D3', d: 0.5 }, { b: 14, n: 'C3', d: 1 }, { b: 15, n: 'G3', d: 1 },
    ],
    drums: { kick: [0, 2, 4, 6, 8, 10, 12, 14], hat: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5], snare: [4, 12] },
  },

  bombapet: {
    titulo: 'Música do Bombapet',
    bpm: 112,
    beats: 16,
    lead: [
      { b: 0, n: 'D5', d: 0.25 }, { b: 0.25, n: 'F5', d: 0.25 }, { b: 0.5, n: 'A5', d: 0.5 },
      { b: 1, n: 'F5', d: 0.5 }, { b: 1.5, n: 'D5', d: 0.5 }, { b: 2, n: 'C5', d: 0.75 },
      { b: 3, n: 'D5', d: 0.75 }, { b: 4, n: 'F5', d: 1 }, { b: 5, n: 'A5', d: 1 },
      { b: 6, n: 'G5', d: 0.5 }, { b: 6.5, n: 'F5', d: 0.5 }, { b: 7, n: 'D5', d: 1 },
      { b: 8, n: 'D5', d: 0.25 }, { b: 8.25, n: 'F5', d: 0.25 }, { b: 8.5, n: 'A5', d: 0.5 },
      { b: 9, n: 'C6', d: 0.5 }, { b: 9.5, n: 'A5', d: 0.5 }, { b: 10, n: 'G5', d: 1 },
      { b: 11, n: 'F5', d: 1 }, { b: 12, n: 'D5', d: 1.5 }, { b: 14, n: 'C5', d: 1 },
      { b: 15, n: 'A4', d: 1 },
    ],
    bass: [
      { b: 0, n: 'D3', d: 0.5 }, { b: 1, n: 'D3', d: 0.5 }, { b: 2, n: 'A2', d: 0.5 },
      { b: 3, n: 'A2', d: 0.5 }, { b: 4, n: 'B2', d: 0.5 }, { b: 5, n: 'B2', d: 0.5 },
      { b: 6, n: 'G2', d: 0.5 }, { b: 7, n: 'G2', d: 0.5 }, { b: 8, n: 'D3', d: 0.5 },
      { b: 9, n: 'D3', d: 0.5 }, { b: 10, n: 'F3', d: 0.5 }, { b: 11, n: 'F3', d: 0.5 },
      { b: 12, n: 'C3', d: 0.5 }, { b: 13, n: 'C3', d: 0.5 }, { b: 14, n: 'A2', d: 1 },
      { b: 15, n: 'D3', d: 1 },
    ],
    drums: { kick: [0, 3, 4, 7, 8, 11, 12, 14], hat: [0.5, 1, 1.5, 2.5, 3.5, 4.5, 5, 5.5, 6.5, 7.5, 8.5, 9, 9.5, 10.5, 11.5, 12.5, 13, 13.5, 14.5, 15], snare: [4, 12] },
  },

  'jin-sheng-yuan': {
    titulo: 'Jin Sheng Yuan',
    bpm: 88,
    beats: 16,
    lead: [
      { b: 0, n: 'D5', d: 1 }, { b: 1, n: 'F5', d: 0.5 }, { b: 1.5, n: 'G5', d: 0.5 },
      { b: 2, n: 'A5', d: 1.5 }, { b: 4, n: 'G5', d: 0.5 }, { b: 4.5, n: 'F5', d: 0.5 },
      { b: 5, n: 'D5', d: 1 }, { b: 6, n: 'C5', d: 1 }, { b: 7, n: 'D5', d: 1 },
      { b: 8, n: 'F5', d: 1 }, { b: 9, n: 'G5', d: 0.5 }, { b: 9.5, n: 'A5', d: 0.5 },
      { b: 10, n: 'C6', d: 1.5 }, { b: 12, n: 'A5', d: 0.5 }, { b: 12.5, n: 'G5', d: 0.5 },
      { b: 13, n: 'F5', d: 1 }, { b: 14, n: 'D5', d: 2 },
    ],
    bass: [
      { b: 0, n: 'D3', d: 1 }, { b: 2, n: 'A2', d: 1 }, { b: 4, n: 'F2', d: 1 },
      { b: 6, n: 'C3', d: 1 }, { b: 8, n: 'D3', d: 1 }, { b: 10, n: 'A2', d: 1 },
      { b: 12, n: 'F2', d: 1 }, { b: 14, n: 'G2', d: 1 }, { b: 15, n: 'A2', d: 1 },
    ],
    drums: { kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], snare: [] },
  },
};

/** Faixa da tela inicial e as três que se revezam no lobby. */
export const MUSICAS = {
  home: 'uniao-flasco',
  lobby: ['vida-de-empreguete', 'bombapet', 'jin-sheng-yuan'],
};

class MusicPlayer {
  constructor() {
    this.cena = null;        // 'home' | 'lobby' | null
    this.desejada = null;    // o que deveria estar tocando (antes do desbloqueio)
    this.faixa = null;       // faixa atual { id, nos, timer, ganho, fonte }
    this.ultima = null;      // última faixa sorteada no lobby
    this.buffers = new Map(); // id -> AudioBuffer | 'sem-arquivo'
    this.ligada = true;      // botão MÚSICA
    this.volume = 0.18;      // bem baixo, só de fundo
    try {
      const salvo = localStorage.getItem('impostor:music');
      if (salvo === 'off') this.ligada = false;
    } catch { /* sem storage */ }
  }

  get pronto() {
    return !!this.ctx && !!this.bus;
  }

  /** Cria o barramento de música dentro do contexto do sfx (mudo vale para tudo). */
  init() {
    if (this.pronto) return true;
    // só entra depois que o navegador liberou o áudio (primeiro gesto)
    if (!sfx.ctx) return false;
    this.ctx = sfx.ctx;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = this.volume;
    // passa pelo ganho mestre do sfx: o botão de mudo silencia tudo
    this.bus.connect(sfx.master || this.ctx.destination);
    return true;
  }

  setLigada(v) {
    this.ligada = !!v;
    try { localStorage.setItem('impostor:music', this.ligada ? 'on' : 'off'); } catch { /* sem storage */ }
    if (!this.ligada) this.stop();
    else if (this.desejada) this.play(this.desejada);
  }

  /** toca a trilha da cena; 'home' e 'lobby' são as únicas cenas com música */
  play(cena) {
    this.desejada = cena;
    if (!this.ligada || !this.init()) return;
    if (this.cena === cena && this.faixa) return;
    if (!cena) return this.parar();
    const id = cena === 'home' ? MUSICAS.home : this.sorteiaLobby();
    this.stop();
    this.cena = cena;
    this.toca(id);
  }

  /** para o som e esquece a cena (não volta sozinho) */
  parar() {
    this.desejada = null;
    this.stop();
  }

  stop() {
    this.cena = null;
    if (!this.faixa) return;
    const f = this.faixa;
    this.faixa = null;
    clearTimeout(f.timer);
    try {
      f.fonte?.stop();
    } catch { /* já parado */ }
    for (const n of f.nos) { try { n.stop(); } catch { /* já parado */ } }
    if (f.ganho) {
      const t = this.ctx.currentTime;
      try {
        f.ganho.gain.cancelScheduledValues(t);
        f.ganho.gain.setValueAtTime(Math.max(0.0001, f.ganho.gain.value), t);
        f.ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      } catch { /* contexto fechado */ }
    }
  }

  sorteiaLobby() {
    const opcoes = MUSICAS.lobby.filter((id) => id !== this.ultima);
    const id = (opcoes.length ? opcoes : MUSICAS.lobby)[Math.floor(Math.random() * (opcoes.length || MUSICAS.lobby.length))];
    this.ultima = id;
    return id;
  }

  /* ---------------- arquivos opcionais ---------------- */
  async carregaArquivo(id) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    for (const ext of ['mp3', 'ogg', 'wav']) {
      try {
        const res = await fetch(`/music/${id}.${ext}`);
        if (!res.ok) continue;
        const dados = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(dados);
        this.buffers.set(id, buf);
        return buf;
      } catch { /* tenta a próxima extensão */ }
    }
    this.buffers.set(id, 'sem-arquivo');
    return 'sem-arquivo';
  }

  async toca(id) {
    const faixa = FAIXAS[id];
    if (!faixa) return;
    const ganho = this.ctx.createGain();
    ganho.gain.value = 0.0001;
    ganho.connect(this.bus);
    const t = this.ctx.currentTime;
    ganho.gain.exponentialRampToValueAtTime(0.9, t + 1.2);
    this.faixa = { id, ganho, nos: [], timer: null, fonte: null };

    const buf = await this.carregaArquivo(id);
    if (this.faixa?.id !== id) return; // parou enquanto carregava
    if (buf && buf !== 'sem-arquivo') {
      // arquivo real do usuário: toca em loop
      const fonte = this.ctx.createBufferSource();
      fonte.buffer = buf;
      fonte.loop = true;
      fonte.connect(ganho);
      fonte.start();
      this.faixa.fonte = fonte;
      return;
    }
    this.sintetiza(id, faixa, ganho);
  }

  /* ---------------- versão sintetizada ---------------- */
  sintetiza(id, faixa, ganho) {
    const segPorBatida = 60 / faixa.bpm;
    const duracao = faixa.beats * segPorBatida;
    let proximo = this.ctx.currentTime + 0.1;
    const ciclo = () => {
      if (!this.faixa || this.faixa.id !== id) return;
      // mantém sempre ~1 loop agendado à frente (no máximo 3 por vez)
      let voltas = 0;
      while (proximo < this.ctx.currentTime + duracao + 0.4 && voltas < 3) {
        this.agendaLoop(faixa, ganho, proximo, segPorBatida);
        proximo += duracao;
        voltas++;
      }
      this.faixa.timer = setTimeout(ciclo, Math.max(200, duracao * 500));
    };
    ciclo();
  }

  agendaLoop(faixa, ganho, inicio, segPorBatida) {
    const nos = this.faixa?.nos || [];
    const onda = (tipo, freq, quando, dur, vol) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(freq, quando);
      g.gain.setValueAtTime(0.0001, quando);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), quando + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
      osc.connect(g).connect(ganho);
      osc.start(quando);
      osc.stop(quando + dur + 0.05);
      nos.push(osc);
      return osc;
    };
    const ruido = (quando, dur, vol, corte, tipo) => {
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = tipo;
      f.frequency.value = corte;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, quando);
      g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
      src.connect(f).connect(g).connect(ganho);
      src.start(quando);
      nos.push(src);
    };

    for (const ev of faixa.lead || []) {
      onda('triangle', hz(ev.n), inicio + ev.b * segPorBatida, ev.d * segPorBatida * 0.92, 0.16);
    }
    for (const ev of faixa.bass || []) {
      onda('sawtooth', hz(ev.n), inicio + ev.b * segPorBatida, ev.d * segPorBatida * 0.8, 0.13);
    }
    for (const b of faixa.drums?.kick || []) onda('sine', 108, inicio + b * segPorBatida, 0.16, 0.22);
    for (const b of faixa.drums?.snare || []) ruido(inicio + b * segPorBatida, 0.12, 0.10, 1800, 'highpass');
    for (const b of faixa.drums?.hat || []) ruido(inicio + b * segPorBatida, 0.05, 0.045, 6000, 'highpass');

    if (this.faixa) this.faixa.nos = nos.slice(-600);
  }
}

export const music = new MusicPlayer();
