/* Minigames das tarefas. Cada um retorna { el, done() } e chama onDone quando
   o jogador conclui, ou null quando fecha. */

const WIRE_COLORS = ['#ff4757', '#37d0ff', '#45e07a', '#ffd93d'];

export function buildWires(onDone) {
  const wrap = document.createElement('div');
  wrap.className = 'wires';

  const left = [...WIRE_COLORS].sort(() => Math.random() - 0.5);
  const right = [...WIRE_COLORS].sort(() => Math.random() - 0.5);
  const connected = new Set();
  let selected = null;

  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');
    row.className = 'wire-row';

    const l = document.createElement('div');
    l.className = 'wire';
    l.style.background = left[i];
    l.style.cursor = 'pointer';
    l.dataset.color = left[i];
    l.dataset.side = 'left';

    const mid = document.createElement('div');
    mid.className = 'wire';
    mid.style.background = 'rgba(255,255,255,0.07)';
    mid.style.flex = '2';

    const r = document.createElement('div');
    r.className = 'wire';
    r.style.background = right[i];
    r.style.cursor = 'pointer';
    r.dataset.color = right[i];
    r.dataset.side = 'right';

    row.append(l, mid, r);
    wrap.append(row);
  }

  const status = document.createElement('p');
  status.className = 'hint';
  status.textContent = 'Ligue cada fio da esquerda à cor igual da direita.';
  wrap.append(status);

  wrap.addEventListener('click', (ev) => {
    const el = ev.target.closest('.wire');
    if (!el || !el.dataset.color) return;
    const color = el.dataset.color;

    if (el.dataset.side === 'left') {
      selected = color;
      [...wrap.querySelectorAll('.wire[data-side="left"]')].forEach((w) => (w.style.outline = ''));
      el.style.outline = '2px solid #fff';
      return;
    }

    if (!selected) {
      status.textContent = 'Escolha um fio da esquerda primeiro.';
      return;
    }

    if (selected === color) {
      connected.add(color);
      [...wrap.querySelectorAll(`.wire[data-color="${cssEscape(color)}"]`)].forEach((w) => {
        w.style.outline = '2px solid #45e07a';
        w.style.opacity = '0.55';
      });
      selected = null;
      status.textContent = `${connected.size}/4 conectados.`;
      if (connected.size === 4) onDone();
    } else {
      status.textContent = 'Cores diferentes, tente de novo.';
      [...wrap.querySelectorAll('.wire[data-side="left"]')].forEach((w) => (w.style.outline = ''));
      selected = null;
    }
  });

  return wrap;
}

function cssEscape(s) {
  return s.replace(/["\\]/g, '\\$&');
}

export function buildProgress({ label = 'Processando...', ms = 4000, onDone }) {
  const wrap = document.createElement('div');
  const bar = document.createElement('div');
  bar.style.cssText = 'height:16px;border-radius:9px;background:rgba(255,255,255,0.09);overflow:hidden;margin:14px 0 8px';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#37d0ff,#45e07a);transition:width 0.12s linear';
  bar.append(fill);
  const txt = document.createElement('p');
  txt.className = 'hint';
  txt.textContent = label;
  wrap.append(bar, txt);

  let progress = 0;
  const iv = setInterval(() => {
    progress = Math.min(100, progress + (100 / (ms / 120)));
    fill.style.width = progress + '%';
    if (progress >= 100) {
      clearInterval(iv);
      txt.textContent = 'Concluído!';
      onDone();
    }
  }, 120);

  wrap._cleanup = () => clearInterval(iv);
  return wrap;
}

export function buildCard({ onDone }) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div style="height:120px;border-radius:14px;background:linear-gradient(180deg,#22314d,#141d2e);border:1px solid rgba(255,255,255,0.1);position:relative;overflow:hidden;margin-bottom:12px">
      <div style="position:absolute;left:14px;top:14px;width:64px;height:64px;border-radius:10px;background:#37d0ff33;border:1px dashed #37d0ff88"></div>
      <div id="swipeCard" style="position:absolute;left:12px;bottom:12px;width:90px;height:20px;border-radius:6px;background:#ffd93d"></div>
    </div>
    <p class="hint">Arraste o cartão devagar para a direita para ler.</p>`;
  const cardEl = wrap.querySelector('#swipeCard');
  let dragging = false;
  let x = 12;
  let slowFrames = 0;
  let lastX = 12;

  const move = (clientX) => {
    if (!dragging) return;
    const track = wrap.querySelector('div');
    const maxX = Math.max(12, track.clientWidth - 105);
    x = Math.max(12, Math.min(maxX, clientX - wrap.getBoundingClientRect().left - 45));
    cardEl.style.left = x + 'px';
    const step = Math.abs(x - lastX);
    lastX = x;
    // ler o cartão exige arrastar devagar: rápido de mais = erro
    if (step > 26) {
      slowFrames = 0;
      cardEl.style.background = '#ff6b6b';
      return;
    }
    if (x > maxX * 0.18) {
      slowFrames++;
      cardEl.style.background = '#45e07a';
      if (x >= maxX * 0.95 && slowFrames > 6) {
        dragging = false;
        onDone();
      }
    }
  };

  cardEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    cardEl.setPointerCapture(e.pointerId);
  });
  cardEl.addEventListener('pointermove', (e) => move(e.clientX));
  cardEl.addEventListener('pointerup', () => { dragging = false; });

  return wrap;
}

export function buildAsteroids({ onDone, target = 8 }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;height:200px;border-radius:14px;background:#060a12;overflow:hidden;border:1px solid rgba(255,255,255,0.08)';
  const score = document.createElement('p');
  score.className = 'hint';
  score.textContent = `Asteroides: 0/${target}`;

  let hits = 0;
  const rocks = [];

  function spawn() {
    const el = document.createElement('div');
    const size = 22 + Math.random() * 16;
    el.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #94a3b8, #475569 70%);cursor:crosshair;`;
    el.style.left = Math.random() * 80 + '%';
    el.style.top = '-40px';
    const speed = 0.9 + Math.random() * 1.4;
    wrap.append(el);
    const rock = { el, y: -40, speed, size };
    rocks.push(rock);
    el.addEventListener('pointerdown', () => {
      hits++;
      score.textContent = `Asteroides: ${Math.min(hits, target)}/${target}`;
      el.remove();
      rock.dead = true;
      if (hits >= target) {
        clearInterval(iv);
        onDone();
      }
    });
  }

  const iv = setInterval(() => {
    if (wrap.isConnected === false) { clearInterval(iv); return; }
    if (Math.random() < 0.55) spawn();
    for (const r of rocks) {
      if (r.dead) continue;
      r.y += r.speed * 2.4;
      r.el.style.top = r.y + 'px';
      if (r.y > 210) { r.el.remove(); r.dead = true; }
    }
  }, 45);

  wrap._cleanup = () => clearInterval(iv);
  wrap.append(score);
  return wrap;
}

export function buildMultiStep({ label, onDone }) {
  const wrap = document.createElement('div');
  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.style.cssText = 'width:100%;margin-top:10px';
  btn.textContent = label || 'Repetir passo';
  let step = 0;
  const total = 3;
  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = `Passo ${step}/${total}`;
  btn.addEventListener('click', () => {
    step++;
    p.textContent = `Passo ${step}/${total}`;
    if (step >= total) {
      btn.disabled = true;
      btn.textContent = 'Concluído';
      onDone();
    }
  });
  wrap.append(p, btn);
  return wrap;
}

export function buildScan({ onDone }) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div style="position:relative;height:170px;border-radius:14px;background:#08131c;overflow:hidden;border:1px solid rgba(55,208,255,0.35)">
      <div id="scanBar" style="position:absolute;left:0;right:0;height:3px;background:#37d0ff;box-shadow:0 0 16px #37d0ff"></div>
      <div style="position:absolute;inset:0;display:grid;place-items:center;font-size:40px">👨‍🚀</div>
    </div>
    <p class="hint">Aguarde o escaneamento.</p>`;
  const bar = wrap.querySelector('#scanBar');
  let y = 0;
  let dir = 1;
  let passes = 0;
  const iv = setInterval(() => {
    y += dir * 2.2;
    if (y > 168 || y < 0) { dir *= -1; passes++; }
    bar.style.top = y + 'px';
    if (passes >= 4) {
      clearInterval(iv);
      onDone();
    }
  }, 16);
  wrap._cleanup = () => clearInterval(iv);
  return wrap;
}

export const MINIGAMES = {
  wires: buildWires,
  progress: buildProgress,
  card: buildCard,
  asteroids: buildAsteroids,
  multistep: buildMultiStep,
  scan: buildScan,
};
