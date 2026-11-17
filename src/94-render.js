/* ---------- rendering ---------- */
function tileLayer(layer, par, yoff) {
  const ox = -((cam * par) % LAYER_W + LAYER_W) % LAYER_W;
  g.drawImage(layer, Math.round(ox), yoff); g.drawImage(layer, Math.round(ox) + LAYER_W, yoff);
}
const TORCH_GAP = 300;
function torchPositions() { const a = []; const s = Math.floor((cam - 60) / TORCH_GAP); for (let i = s; i < s + 4; i++) a.push(i * TORCH_GAP + 150); return a; }

function addDecal(f) { // a lasting mark where a foe fell: the longer it lies, the fainter it gets
  if (f.pn || f.isMount || f.pitT) return;
  const sc = ((f.k && f.k.scale) || 1) * (isBoss(f) ? 1.8 : 1), dots = [];
  for (let i = 0; i < 5; i++) dots.push({ dx: rnd(-22, 22) * sc, dy: rnd(-4, 4) * sc, r: rnd(1, 2.6) });
  decals.push({ x: f.x, y: f.y, sc, el: ENEMY_EL[f.kind] || null, born: tickN, seed: dots });
  if (decals.length > 36) decals.shift();
}
function drawDecals() {
  const DL = 1500;
  decals = decals.filter(d => tickN - d.born < DL);
  for (const d of decals) {
    const sx = Math.round(d.x - cam); if (sx < -60 || sx > W + 60) continue;
    const age = tickN - d.born, a = Math.min(1, age / 10) * (1 - age / DL), fresh = Math.max(0, 1 - age / 150), y = Math.round(d.y);
    const col = d.el === 'frost' ? '170,225,255' : d.el === 'bolt' ? '255,235,120' : d.el === 'fire' ? '30,10,8' : '60,12,16';
    g.fillStyle = `rgba(${col},${(d.el === 'frost' ? 0.22 : 0.4) * a})`; g.beginPath(); g.ellipse(sx, y, 17 * d.sc, 5 * d.sc, 0, 0, 7); g.fill();
    for (const p of d.seed) { g.fillStyle = `rgba(${col},${0.35 * a})`; g.fillRect(Math.round(sx + p.dx), Math.round(y + p.dy), Math.ceil(p.r), 1); }
    if (fresh > 0 && (d.el === 'fire' || d.el === 'bolt')) { // fresh scorch still glows for a moment
      g.globalCompositeOperation = 'lighter'; g.fillStyle = d.el === 'fire' ? `rgba(255,120,40,${0.28 * fresh})` : `rgba(255,240,140,${0.25 * fresh})`;
      g.beginPath(); g.ellipse(sx, y, 11 * d.sc, 3 * d.sc, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
    }
  }
}
function drawWorld() {
  const T = TH;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  tileLayer(T.skyL, 0.02, 0);
  const M = T.moon;
  if (M.r) {
    const mx = M.x - cam * 0.03 % 500, hg = g.createRadialGradient(mx, M.y, M.r * 0.5, mx, M.y, M.r * 4.6);
    hg.addColorStop(0, `rgba(${M.halo},0.28)`); hg.addColorStop(1, `rgba(${M.halo},0)`);
    g.fillStyle = hg; g.fillRect(mx - M.r * 5, 0, M.r * 10, M.y + M.r * 5);
    g.fillStyle = M.col; g.beginPath(); g.arc(mx, M.y, M.r, 0, 7); g.fill();
    g.fillStyle = M.spot; g.beginPath(); g.arc(mx - M.r * 0.33, M.y - M.r * 0.27, M.r * 0.27, 0, 7); g.fill();
  }
  tileLayer(T.farL, 0.18, 0); tileLayer(T.midL, 0.4, 0); tileLayer(T.wallL, 0.85, 0);
  // floor
  const fg = g.createLinearGradient(0, GROUND_TOP, 0, H);
  fg.addColorStop(0, T.floor[0]); fg.addColorStop(1, T.floor[1]);
  g.fillStyle = fg; g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  for (let row = 0; row < 9; row++) {
    const y = GROUND_TOP + 4 + row * row * 1.6 + row * 6, sp = 24 + row * 7;
    g.fillStyle = `rgba(${T.line},0.45)`; g.fillRect(0, y | 0, W, 1);
    const off0 = -((cam % sp) + sp) % sp;
    for (let x = off0 + (row % 2) * sp / 2 - sp; x < W; x += sp) {
      const i = Math.round((x + cam) / sp), hsh = (((i * 73856093) ^ (row * 19349663)) >>> 0) % 100 / 100;
      g.fillStyle = hsh > 0.5 ? `rgba(${T.tile},${(hsh - 0.5) * 0.07})` : `rgba(0,0,0,${(0.5 - hsh) * 0.16})`; g.fillRect(x | 0, y | 0, sp, row * 2 + 6);
      g.fillStyle = `rgba(${T.line},0.45)`; g.fillRect(x | 0, y | 0, 1, row * 2 + 6);
    }
  }
  drawFloorFx(T);
  // torch posts
  for (const tx of torchPositions()) {
    const x = Math.round(tx - cam);
    g.fillStyle = T.post[0]; g.fillRect(x - 2, GROUND_TOP - 40, 4, 40);
    g.fillStyle = T.post[1]; g.fillRect(x - 5, GROUND_TOP - 44, 10, 5);
  }
  // god rays slanting through the hall
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const bx = ((i * 190 + 60 - cam * 0.5) % (W + 260) + W + 260) % (W + 260) - 130, a = 0.035 + 0.015 * Math.sin(tickN * 0.01 + i * 2);
    const gr = g.createLinearGradient(bx, 0, bx + 70, GROUND_TOP); gr.addColorStop(0, `rgba(${T.glow},${a * 2})`); gr.addColorStop(1, `rgba(${T.glow},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx + 26, 0); g.lineTo(bx + 100, GROUND_TOP); g.lineTo(bx + 40, GROUND_TOP); g.fill();
  }
  g.restore();
  drawAirFx(T);
  // hanging chains / vines near the ceiling (parallax 1.15)
  for (let i = -1; i < 7; i++) {
    const wx = (Math.floor(cam * 1.15 / 130) + i) * 130, h = 14 + (((wx * 2654435761) >>> 0) % 40), x = Math.round(wx - cam * 1.15 + 20), sw = Math.sin(tickN * 0.03 + wx) * 1.5;
    g.fillStyle = 'rgba(8,4,12,0.85)';
    for (let y = 0; y < h; y += 4) g.fillRect(Math.round(x + sw * y / h), y, 2, 3);
    g.fillRect(Math.round(x + sw) - 1, h, 4, 4);
  }
}

function drawFog() {
  const T = TH;
  for (let j = 0; j < 7; j++) {
    const sp = j % 2 ? 0.15 : -0.12, x = (((j * 97 - cam * (0.55 + (j % 3) * 0.1) + tickN * sp) % (W + 200)) + W + 200) % (W + 200) - 100, y = GROUND_TOP - 4 + (j % 3) * 9;
    const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, `rgba(${T.fog},${T.fogA})`); gr.addColorStop(1, `rgba(${T.fog},0)`);
    g.save(); g.translate(0, y); g.scale(1, 0.16); g.translate(0, -y); g.fillStyle = gr; g.fillRect(x - 90, y - 90, 180, 180); g.restore();
  }
}
function flame(x, y, s) {
  const t = tickN * 0.3 + x, F = TH.flame;
  g.fillStyle = F[0]; g.fillRect(x - 3 * s, y - 8 * s, 6 * s, 8 * s);
  g.fillStyle = F[1]; g.fillRect(x - 2 * s, y - (9 + Math.sin(t) * 2) * s, 4 * s, 7 * s);
  g.fillStyle = F[2]; g.fillRect(x - 1 * s, y - (6 + Math.sin(t * 1.3)) * s, 2 * s, 4 * s);
}

