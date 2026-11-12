/* Minigames das tarefas, seguindo os do jogo original.
 * Cada função recebe { onComplete, onStep, task } e devolve { el, destroy }.
 */

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ---------------------------------------------------------------- SwipeCard */
function swipeCard({ onComplete }) {
  const wrap = el('div', 'task-swipecard');
  wrap.append(el('p', 'task-hint', 'Arraste o cartão devagar para passar.'));
  const slot = el('div', 'card-slot');
  const card = el('div', 'card-chip');
  slot.append(card);
  wrap.append(slot);
  const status = el('p', 'task-status', '');
  wrap.append(status);

  let dragging = false;
  let x = 0;
  let lastX = 0;
  let speedViolations = 0;
  let progress = 0;
  const maxX = () => slot.clientWidth - card.clientWidth - 12;

  const setX = (v) => {
    x = Math.max(0, Math.min(maxX(), v));
    card.style.transform = `translateX(${x}px)`;
  };

  const onDown = (e) => {
    dragging = true;
    lastX = x;
    card.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const rect = slot.getBoundingClientRect();
    const target = e.clientX - rect.left - card.clientWidth / 2;
    const delta = Math.abs(target - x);
    if (delta > 34) {
      speedViolations++;
      card.classList.add('card-error');
      status.textContent = 'Muito rápido! Vá devagar.';
      setTimeout(() => card.classList.remove('card-error'), 250);
      dragging = false;
      setX(0);
      return;
    }
    setX(target);
    progress = maxX() > 0 ? x / maxX() : 0;
    if (progress > 0.25) status.textContent = 'Lendo cartão...';
    if (progress >= 0.97) {
      dragging = false;
      status.textContent = 'Cartão aceito!';
      onComplete();
    }
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    setX(0);
    status.textContent = 'Tente de novo, do começo ao fim, devagar.';
  };
  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onUp);

  return { el: wrap, destroy() {} };
}

/* ------------------------------------------------------------------- Wires */
const WIRE_COLORS = ['#ff3b3b', '#3b7bff', '#ffe14d', '#ff5ec4'];
function wires({ onComplete }) {
  const wrap = el('div', 'task-wires');
  wrap.append(el('p', 'task-hint', 'Ligue cada fio da esquerda na cor igual da direita.'));
  const board = el('div', 'wires-board');
  const leftColors = [...WIRE_COLORS].sort(() => Math.random() - 0.5);
  const rightColors = [...WIRE_COLORS].sort(() => Math.random() - 0.5);
  const connected = new Set();
  let selected = null;

  leftColors.forEach((color, i) => {
    const row = el('div', 'wire-row');
    const l = el('div', 'wire-node');
    l.dataset.color = color;
    l.dataset.side = 'left';
    l.dataset.i = i;
    l.style.background = color;
    const mid = el('div', 'wire-line');
    const r = el('div', 'wire-node');
    r.dataset.color = rightColors[i];
    r.dataset.side = 'right';
    r.style.background = rightColors[i];
    row.append(l, mid, r);
    board.append(row);
  });
  wrap.append(board);

  board.addEventListener('click', (ev) => {
    const node = ev.target.closest('.wire-node');
    if (!node) return;
    if (node.dataset.side === 'left') {
      selected = node;
      board.querySelectorAll('.wire-node').forEach((n) => n.classList.remove('selected'));
      node.classList.add('selected');
      return;
    }
    if (!selected) return;
    if (selected.dataset.color === node.dataset.color) {
      selected.classList.add('linked');
      node.classList.add('linked');
      connected.add(node.dataset.color);
      selected = null;
      if (connected.size === WIRE_COLORS.length) onComplete();
    } else {
      board.querySelectorAll('.wire-node').forEach((n) => n.classList.remove('selected'));
      selected = null;
    }
  });

  return { el: wrap, destroy() {} };
}

/* --------------------------------------------------------------- Asteroids */
function asteroids({ onComplete }) {
  const wrap = el('div', 'task-asteroids');
  const head = el('div', 'asteroid-head');
  head.append(el('span', '', 'Destrua os asteroides'));
  const counter = el('span', 'asteroid-count', '0');
  head.append(counter);
  wrap.append(head);
  const field = el('div', 'asteroid-field');
  field.tabIndex = 0;
  wrap.append(field);

  const TARGET = 14;
  let killed = 0;
  let raf = 0;
  const rocks = [];
  const shots = [];

  const spawn = () => {
    const size = 26 + Math.random() * 26;
    const node = el('div', 'asteroid');
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.left = `${Math.random() * (field.clientWidth - size)}px`;
    node.style.top = '-40px';
    field.append(node);
    rocks.push({
      node,
      x: parseFloat(node.style.left),
      y: -40,
      size,
      vy: 40 + Math.random() * 90,
      vx: (Math.random() - 0.5) * 30,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 3,
    });
  };

  let last = performance.now();
  let spawnTimer = 0;
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    spawnTimer += dt;
    if (spawnTimer > 0.55 && rocks.length < 6) {
      spawnTimer = 0;
      spawn();
    }
    for (const r of rocks) {
      if (r.dead) continue;
      r.y += r.vy * dt * 2;
      r.x += r.vx * dt;
      r.rot += r.rotSpeed * dt;
      r.node.style.transform = `translateY(${r.y + 40}px) rotate(${r.rot}rad)`;
      if (r.y > field.clientHeight) {
        r.dead = true;
        r.node.remove();
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  field.addEventListener('pointerdown', (e) => {
    const rect = field.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const shot = el('div', 'laser-shot');
    shot.style.left = `${px}px`;
    shot.style.top = `${py}px`;
    field.append(shot);
    setTimeout(() => shot.remove(), 180);
    for (const r of rocks) {
      if (r.dead) continue;
      // posição visual: x do style + deslocamento vertical do transform
      const cx = parseFloat(r.node.style.left || r.x) + r.size / 2;
      const cy = (parseFloat((r.node.style.transform.match(/translateY\(([-\d.]+)px\)/) || [0, 0])[1])) + r.size / 2;
      if (Math.hypot(cx - px, cy - py) < r.size / 2 + 10) {
        r.dead = true;
        r.node.classList.add('boom');
        setTimeout(() => r.node.remove(), 220);
        killed++;
        counter.textContent = `${killed}/${TARGET}`;
        if (killed >= TARGET) {
          cancelAnimationFrame(raf);
          onComplete();
        }
        break;
      }
    }
  });

  return {
    el: wrap,
    destroy() { cancelAnimationFrame(raf); },
  };
}

/* -------------------------------------------------------------------- Scan */
function scan({ onComplete }) {
  const wrap = el('div', 'task-scan');
  wrap.append(el('p', 'task-hint', 'Fique parado enquanto o scanner termina.'));
  const box = el('div', 'scan-box', '<div class="scan-person">🧑‍🚀</div><div class="scan-line"></div>');
  wrap.append(box);
  let p = 0;
  const fill = el('div', 'scan-progress');
  wrap.append(fill);
  const timer = setInterval(() => {
    p = Math.min(100, p + 2.2);
    fill.style.width = `${p}%`;
    box.querySelector('.scan-line').style.top = `${(p / 100) * 100}%`;
    if (p >= 100) {
      clearInterval(timer);
      onComplete();
    }
  }, 90);
  return { el: wrap, destroy() { clearInterval(timer); } };
}

/* ---------------------------------------------------------- InspectSample */
function sample({ onComplete }) {
  const wrap = el('div', 'task-sample');
  wrap.append(el('p', 'task-hint', 'Aperte INICIAR e descarte as amostras que ficarem vermelhas.'));
  const grid = el('div', 'sample-grid');
  const cells = [];
  for (let i = 0; i < 5; i++) {
    const c = el('button', 'sample-cell', `<span>${i + 1}</span>`);
    c.disabled = true;
    c.addEventListener('click', () => {
      if (!c.classList.contains('bad') || !running) return;
      c.classList.add('fixed');
      c.disabled = true;
      fixed++;
      if (fixed === 5) {
        clearInterval(timer);
        onComplete();
      }
    });
    grid.append(c);
    cells.push(c);
  }
  wrap.append(grid);
  const startBtn = el('button', 'btn primary small', 'Iniciar');
  const timerBar = el('div', 'sample-timer');
  wrap.append(timerBar, startBtn);

  let running = false;
  let timer = null;
  let fixed = 0;
  let elapsed = 0;

  startBtn.addEventListener('click', () => {
    if (running) return;
    running = true;
    startBtn.disabled = true;
    startBtn.textContent = 'Analisando...';
    // duas amostras ruins
    const badIdx = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 2);
    badIdx.forEach((i) => cells[i].classList.add('bad'));
    timer = setInterval(() => {
      elapsed += 100;
      timerBar.style.width = `${(elapsed / 5000) * 100}%`;
      if (elapsed >= 5000) {
        clearInterval(timer);
        cells.forEach((c) => {
          if (c.classList.contains('bad')) c.disabled = false;
          else {
            c.classList.add('good');
            c.disabled = true;
            fixed++;
          }
        });
        if (fixed === 5) onComplete();
      }
    }, 100);
  });

  return { el: wrap, destroy() { clearInterval(timer); } };
}

/* ------------------------------------------------------------------ Upload */
function upload({ onStep, steps = 2 }) {
  const wrap = el('div', 'task-upload');
  wrap.append(el('p', 'task-hint', 'Baixe e envie os dados.'));
  const bar = el('div', 'upload-bar', '<div class="upload-fill"></div>');
  const btn = el('button', 'btn primary small', 'Baixar dados');
  wrap.append(bar, btn);
  let step = 0;
  btn.addEventListener('click', () => {
    btn.disabled = true;
    const fill = bar.querySelector('.upload-fill');
    let p = 0;
    const t = setInterval(() => {
      p += 6;
      fill.style.width = `${Math.min(100, p)}%`;
      if (p >= 100) {
        clearInterval(t);
        step++;
        onStep();
        if (step >= steps) return;
        fill.style.width = '0%';
        btn.disabled = false;
        btn.textContent = 'Enviar dados';
      }
    }, 70);
  });
  return { el: wrap, destroy() {} };
}

/* ---------------------------------------------------------------- Divert */
function divert({ onStep }) {
  const wrap = el('div', 'task-divert');
  wrap.append(el('p', 'task-hint', 'Desvie a energia para a sala indicada.'));
  const options = ['Admin', 'Armas', 'Escudos', 'Navegação'];
  const target = options[Math.floor(Math.random() * options.length)];
  const targetEl = el('div', 'divert-target', `Destino: <b>${target}</b>`);
  wrap.append(targetEl);
  const grid = el('div', 'divert-grid');
  let sent = false;
  ['Elétrica', 'Admin', 'Armas', 'Escudos', 'Navegação'].sort(() => Math.random() - 0.5).forEach((name) => {
    const b = el('button', 'divert-btn', name);
    b.addEventListener('click', () => {
      if (sent) return;
      if (name === target) {
        sent = true;
        b.classList.add('ok');
        onStep();
      } else {
        b.classList.add('bad');
        setTimeout(() => b.classList.remove('bad'), 300);
      }
    });
    grid.append(b);
  });
  wrap.append(grid);
  return { el: wrap, destroy() {} };
}

/* --------------------------------------------------------------------- O2 */
function o2filter({ onComplete }) {
  const wrap = el('div', 'task-o2');
  wrap.append(el('p', 'task-hint', 'Arraste as folhas para fora do filtro.'));
  const field = el('div', 'o2-field');
  wrap.append(field);
  const leaves = [];
  for (let i = 0; i < 6; i++) {
    const l = el('div', 'leaf', '🍃');
    const x = 20 + Math.random() * 180;
    const y = 20 + Math.random() * 140;
    l.style.left = `${x}px`;
    l.style.top = `${y}px`;
    l.dataset.dragging = '0';
    let drag = false;
    let ox = 0;
    let oy = 0;
    l.addEventListener('pointerdown', (e) => {
      drag = true;
      ox = e.clientX - l.offsetLeft;
      oy = e.clientY - l.offsetTop;
      l.setPointerCapture?.(e.pointerId);
    });
    l.addEventListener('pointermove', (e) => {
      if (!drag) return;
      l.style.left = `${e.clientX - ox}px`;
      l.style.top = `${e.clientY - oy}px`;
    });
    l.addEventListener('pointerup', () => {
      if (!drag) return;
      drag = false;
      const fx = parseFloat(l.style.left);
      const fy = parseFloat(l.style.top);
      if (fx < -10 || fy > 190 || fx > 230) {
        l.remove();
        removed++;
        if (removed === 6) onComplete();
      }
    });
    field.append(l);
    leaves.push(l);
  }
  let removed = 0;
  return { el: wrap, destroy() {} };
}

/* ------------------------------------------------------------- Steering */
function steering({ onComplete }) {
  const wrap = el('div', 'task-steering');
  wrap.append(el('p', 'task-hint', 'Alinhe a nave no centro da faixa.'));
  const dial = el('div', 'steer-dial');
  const needle = el('div', 'steer-needle');
  const band = el('div', 'steer-band');
  dial.append(band, needle);
  const btn = el('button', 'btn primary small', 'Estabilizar');
  wrap.append(dial, btn);
  let angle = (Math.random() - 0.5) * 120;
  let vel = (Math.random() - 0.5) * 1.2;
  const timer = setInterval(() => {
    vel += (Math.random() - 0.5) * 0.35;
    vel = Math.max(-3, Math.min(3, vel));
    angle += vel;
    if (Math.abs(angle) > 90) { angle = Math.sign(angle) * 90; vel *= -0.7; }
    needle.style.transform = `rotate(${angle}deg)`;
  }, 30);
  btn.addEventListener('click', () => {
    if (Math.abs(angle) < 12) {
      clearInterval(timer);
      onComplete();
    } else {
      btn.textContent = 'De novo!';
      setTimeout(() => (btn.textContent = 'Estabilizar'), 600);
    }
  });
  return { el: wrap, destroy() { clearInterval(timer); } };
}

/* ----------------------------------------------------------------- Reactor */
function reactor({ onStep }) {
  const wrap = el('div', 'task-reactor');
  wrap.append(el('p', 'task-hint', 'Aperte os números na ordem que piscarem (1 a 3).'));
  const pad = el('div', 'reactor-pad');
  const buttons = [];
  for (let i = 0; i < 9; i++) {
    const b = el('button', 'reactor-btn', `${i + 1}`);
    b.disabled = true;
    pad.append(b);
    buttons.push(b);
  }
  wrap.append(pad);
  const seq = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 3);
  let idx = 0;
  setTimeout(() => {
    seq.forEach((n, i) => {
      setTimeout(() => {
        buttons[n].classList.add('flash');
        setTimeout(() => buttons[n].classList.remove('flash'), 400);
      }, i * 650);
    });
    setTimeout(() => buttons.forEach((b) => (b.disabled = false)), seq.length * 650 + 200);
  }, 300);

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => {
      if (i === seq[idx]) {
        b.classList.add('ok');
        b.disabled = true;
        idx++;
        if (idx === seq.length) onStep();
      } else {
        b.classList.add('bad');
        setTimeout(() => b.classList.remove('bad'), 350);
      }
    });
  });
  return { el: wrap, destroy() {} };
}

/* -------------------------------------------------------------- Manifolds */
function manifolds({ onStep }) {
  const wrap = el('div', 'task-manifolds');
  wrap.append(el('p', 'task-hint', 'Aperte os números em ordem crescente.'));
  const grid = el('div', 'manifold-grid');
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5);
  let next = 1;
  nums.forEach((n) => {
    const b = el('button', 'manifold-btn', `${n}`);
    b.addEventListener('click', () => {
      if (n === next) {
        b.classList.add('ok');
        b.disabled = true;
        next++;
        if (next > 10) onStep();
      } else {
        b.classList.add('bad');
        setTimeout(() => b.classList.remove('bad'), 300);
      }
    });
    grid.append(b);
  });
  wrap.append(grid);
  return { el: wrap, destroy() {} };
}

/* ------------------------------------------------------------ AlignEngine */
function alignEngine({ onStep }) {
  const wrap = el('div', 'task-engine');
  wrap.append(el('p', 'task-hint', 'Alinhe as duas peças do motor.'));
  const track = el('div', 'engine-track');
  const targetZone = el('div', 'engine-target');
  const slider = el('div', 'engine-slider');
  track.append(targetZone, slider);
  const btn = el('button', 'btn primary small', 'Confirmar');
  wrap.append(track, btn);
  const target = 20 + Math.random() * 60;
  targetZone.style.left = `${target}%`;
  let pos = Math.random() * 100;
  const input = el('input', 'range');
  input.type = 'range';
  input.min = 0;
  input.max = 100;
  input.value = pos;
  input.addEventListener('input', () => {
    pos = +input.value;
    slider.style.left = `${pos}%`;
  });
  wrap.append(input);
  btn.addEventListener('click', () => {
    if (Math.abs(pos - target) < 7) onStep();
    else {
      btn.textContent = 'Fora do alvo!';
      setTimeout(() => (btn.textContent = 'Confirmar'), 700);
    }
  });
  return { el: wrap, destroy() {} };
}

/* ------------------------------------------------------------------ Fuel */
function fuel({ onStep, step }) {
  const wrap = el('div', 'task-fuel');
  wrap.append(el('p', 'task-hint', 'Segure para encher o tanque.'));
  const tank = el('div', 'fuel-tank', '<div class="fuel-fill"></div>');
  const btn = el('button', 'btn primary small', 'Segurar para abastecer');
  wrap.append(tank, btn);
  const fill = tank.querySelector('.fuel-fill');
  let holding = false;
  let value = 0;
  const tick = () => {
    if (holding) {
      value = Math.min(100, value + 1.6);
      fill.style.height = `${value}%`;
      if (value >= 100) {
        holding = false;
        onStep();
      }
    }
    requestAnimationFrame(tick);
  };
  btn.addEventListener('pointerdown', () => {
    holding = true;
    btn.textContent = 'Abastecendo...';
  });
  btn.addEventListener('pointerup', () => {
    holding = false;
    if (value < 100) btn.textContent = 'Segurar para abastecer';
  });
  requestAnimationFrame(tick);
  return { el: wrap, destroy() {} };
}

/* ---------------------------------------------------------------- Garbage */
function garbage({ onComplete }) {
  const wrap = el('div', 'task-garbage');
  wrap.append(el('p', 'task-hint', 'Puxe a alavanca repetidamente para ejetar o lixo.'));
  const chute = el('div', 'garbage-chute', '<div class="garbage-door"></div>');
  const lever = el('button', 'garbage-lever', 'PUXAR');
  const counter = el('div', 'garbage-count', '0%');
  wrap.append(chute, lever, counter);
  let pull = 0;
  lever.addEventListener('click', () => {
    pull = Math.min(100, pull + 9);
    counter.textContent = `${Math.round(pull)}%`;
    lever.style.transform = 'translateY(4px)';
    setTimeout(() => (lever.style.transform = ''), 90);
    if (pull >= 100) onComplete();
  });
  return { el: wrap, destroy() {} };
}

/* ------------------------------------------------------------------ Chart */
function chart({ onComplete }) {
  const wrap = el('div', 'task-chart');
  wrap.append(el('p', 'task-hint', 'Toque no destino do curso traçado.'));
  const map = el('div', 'chart-map');
  wrap.append(map);
  const points = [
    { x: 22, y: 30, ok: false }, { x: 60, y: 20, ok: true }, { x: 40, y: 62, ok: false }, { x: 74, y: 54, ok: false },
  ];
  let done = false;
  points.forEach((p) => {
    const b = el('button', 'chart-dot', '');
    b.style.left = `${p.x}%`;
    b.style.top = `${p.y}%`;
    b.addEventListener('click', () => {
      if (done) return;
      if (p.ok) {
        done = true;
        b.classList.add('ok');
        onComplete();
      } else {
        b.classList.add('bad');
        setTimeout(() => b.classList.remove('bad'), 300);
      }
    });
    map.append(b);
  });
  return { el: wrap, destroy() {} };
}

/* --------------------------------------------------------------------- Calibrate */
function calibrate({ onComplete }) {
  const wrap = el('div', 'task-calibrate');
  wrap.append(el('p', 'task-hint', 'Pare cada ponteiro no centro da zona verde.'));
  const row = el('div', 'calib-row');
  wrap.append(row);
  const dials = [];
  for (let i = 0; i < 3; i++) {
    const d = el('div', 'calib-dial', '<div class="calib-needle"></div><div class="calib-zone"></div>');
    const zone = 18 + Math.random() * 50;
    d.dataset.zone = zone;
    d.querySelector('.calib-zone').style.left = `${zone}%`;
    row.append(d);
    dials.push(d);
  }
  const btn = el('button', 'btn primary small', 'Calibrar');
  wrap.append(btn);
  let ticks = 0;
  const timer = setInterval(() => {
    ticks++;
    for (const d of dials) {
      const speed = 3 + (+d.dataset.zone % 3);
      const angle = Math.sin(ticks / speed) * 70;
      d.querySelector('.calib-needle').style.transform = `rotate(${angle}deg)`;
      d.dataset.angle = angle;
    }
  }, 30);
  btn.addEventListener('click', () => {
    const ok = dials.every((d) => Math.abs(+d.dataset.angle) < 14);
    if (ok) {
      clearInterval(timer);
      onComplete();
    } else {
      btn.textContent = 'Errou!';
      setTimeout(() => (btn.textContent = 'Calibrar'), 700);
    }
  });
  return { el: wrap, destroy() { clearInterval(timer); } };
}

/* ------------------------------------------------------------------ registry */
export const TASK_GAMES = {
  swipecard: { title: 'Passar o Cartão', build: swipeCard },
  wires: { title: 'Consertar Fiação', build: wires },
  asteroids: { title: 'Destruir Asteroides', build: asteroids },
  scan: { title: 'Enviar Scan', build: scan },
  sample: { title: 'Inspecionar Amostra', build: sample },
  upload: { title: 'Enviar Dados', build: upload },
  divert: { title: 'Desviar Energia', build: divert },
  o2filter: { title: 'Limpar Filtro de O2', build: o2filter },
  steering: { title: 'Estabilizar Direção', build: steering },
  reactor: { title: 'Iniciar Reator', build: reactor },
  manifolds: { title: 'Destravar Manifolds', build: manifolds },
  alignengine: { title: 'Alinhar Motor', build: alignEngine },
  fuel: { title: 'Abastecer Motores', build: fuel },
  garbage: { title: 'Esvaziar Lixo', build: garbage },
  chart: { title: 'Traçar Curso', build: chart },
  calibrate: { title: 'Calibrar Distribuidor', build: calibrate },
  multistep: { title: 'Tarefa', build: (opts) => ({ el: el('div', '', '<p class="task-hint">Complete os passos.</p>'), destroy() {} , auto: opts }) },
};
