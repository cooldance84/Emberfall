/* ---------- themed backdrops: one set of parallax layers per stage ---------- */
const THEME_DEF = [
  { sky: ['#0a0b22', '#2a1740', '#6b2a3a'], star: '255,240,220', cloud: '130,60,110', far: '#2b1a3c', far2: '#1d1230', glow: '255,120,50', win: '#ffb05a', mid: '#170e26',
    tree: '#0f0819', wall: '#251830', wallRGB: [40, 24, 52], arch: '#120a1c', pil: '#3a2548', trim: '#4a3058', trim2: '#6a4a7a', ban: '#6e1d2a', ban2: '#4a121c',
    floor: ['#3a2a3e', '#17101d'], tile: '255,220,255', line: '10,6,16', fog: '140,100,160', fogA: 0.16, amb: '#ff9a4a', dark: 'rgba(18,12,40,0.5)', torch: '255,140,50',
    flame: ['#ff5a1f', '#ffb43a', '#fff1b0'], post: ['#1a1020', '#4b3558'], moon: { col: '#ffe9c8', spot: '#e6c9a8', r: 15, halo: '255,220,190', x: 380, y: 34 },
    fg: ['#07040b', '#120a19'], acc: ['#c9a86a'], farK: 'castle', midK: 'trees', wallK: 'gate' },
  { sky: ['#06130f', '#12302a', '#2c5a44'], star: '200,255,220', cloud: '60,120,90', far: '#10281f', far2: '#0a1a14', glow: '120,255,160', win: '#9dffb0', mid: '#0b1d16',
    tree: '#061410', wall: '#16281f', wallRGB: [22, 40, 31], arch: '#08140f', pil: '#2a4a38', trim: '#2e4a3a', trim2: '#4a7a5a', ban: '#2a5a3a', ban2: '#1a3a26',
    floor: ['#2b3b2c', '#101a12'], tile: '200,255,210', line: '4,10,6', fog: '120,200,150', fogA: 0.3, amb: '#9dffb0', dark: 'rgba(6,24,20,0.5)', torch: '120,255,160',
    flame: ['#2aa860', '#7aff9a', '#e8fff0'], post: ['#0d1a12', '#35523f'], moon: { col: '#d8ffe6', spot: '#b6e6c6', r: 13, halo: '170,255,200', x: 330, y: 40 },
    fg: ['#030906', '#0b1a12'], acc: ['#4a3a28', '#6a5238', '#0a1812', '#9dffb0', '#2a6a3a'], farK: 'marsh', midK: 'reeds', wallK: 'marsh' },
  { sky: ['#1a0806', '#4a1408', '#a03a10'], star: '255,200,150', cloud: '160,60,30', far: '#2a100c', far2: '#1a0806', glow: '255,110,30', win: '#ffcf5a', mid: '#1c0c08',
    tree: '#120604', wall: '#2c1812', wallRGB: [48, 30, 24], arch: '#140806', pil: '#4a2c22', trim: '#5a3a2a', trim2: '#8a5a3a', ban: '#7a2a10', ban2: '#4a1608',
    floor: ['#3a2620', '#140a08'], tile: '255,190,140', line: '12,4,2', fog: '200,110,70', fogA: 0.2, amb: '#ffb43a', dark: 'rgba(30,8,4,0.45)', torch: '255,120,30',
    flame: ['#ff4a10', '#ffa020', '#fff0a0'], post: ['#1a0c08', '#6a4a3a'], moon: { r: 0 }, fg: ['#080302', '#1a0c08'], acc: ['#ff7a20', '#ffd070', '#5a3a2a'],
    farK: 'forge', midK: 'pipes', wallK: 'forge' },
  { sky: ['#050210', '#1a0828', '#4a0e30'], star: '255,200,220', cloud: '120,30,70', far: '#14081c', far2: '#0a0410', glow: '255,40,60', win: '#ff4a5a', mid: '#0c0614',
    tree: '#060210', wall: '#160a22', wallRGB: [28, 14, 40], arch: '#08040e', pil: '#2a1440', trim: '#341a4a', trim2: '#5a2a7a', ban: '#1a0a22', ban2: '#0a0410',
    floor: ['#2a1634', '#0c0612'], tile: '255,160,220', line: '6,2,12', fog: '150,60,120', fogA: 0.18, amb: '#ff5aa6', dark: 'rgba(14,4,28,0.55)', torch: '255,90,170',
    flame: ['#c8107a', '#ff4aa6', '#ffd6ee'], post: ['#0c0612', '#3a2050'], moon: { col: '#ff6a74', spot: '#d84a58', r: 34, halo: '255,80,100', x: 360, y: 52 },
    fg: ['#030106', '#0c0612'], acc: ['#7a1428', '#a01c38', '#e0b44a'], farK: 'throne', midK: 'crystals', wallK: 'throne' },
  { sky: ['#0c0620', '#3a1a40', '#e08a2a'], star: '255,240,200', cloud: '255,170,70', far: '#2a1236', far2: '#1a0a24', glow: '255,200,90', win: '#fff0a0', mid: '#1a0c1c',
    tree: '#10060f', wall: '#2a1a2a', wallRGB: [42, 26, 42], arch: '#120812', pil: '#5a3a2a', trim: '#6a4a2a', trim2: '#ffcf5a', ban: '#8a5a10', ban2: '#4a2a08',
    floor: ['#4a3438', '#1a1014'], tile: '255,230,170', line: '12,6,8', fog: '255,190,110', fogA: 0.2, amb: '#ffe08a', dark: 'rgba(30,14,16,0.4)', torch: '255,200,90',
    flame: ['#ffb020', '#ffe070', '#fffbe0'], post: ['#1c1014', '#6a5030'], moon: { col: '#fff1b0', spot: '#ffcf5a', r: 40, halo: '255,210,110', x: 300, y: 56 },
    fg: ['#060204', '#1a0e10'], acc: ['#ffcf5a', '#fff0b0', '#7a5a30'], farK: 'sanctum', midK: 'crystals', wallK: 'sanctum' }
];

function themeSky(c, w, h, T) {
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, T.sky[0]); gr.addColorStop(0.55, T.sky[1]); gr.addColorStop(1, T.sky[2]);
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${T.star},${rnd(0.2, 0.9)})`; c.fillRect(Math.random() * w | 0, Math.random() * h * 0.6 | 0, 1, 1); }
  for (let i = 0; i < 9; i++) { const cx = rnd(40, w - 200), cy = h * 0.22 + Math.random() * h * 0.5; for (let j = 0; j < 5; j++) { c.fillStyle = `rgba(${T.cloud},0.13)`; c.beginPath(); c.ellipse(cx + j * 22, cy + rnd(-3, 3), 40, 5, 0, 0, 7); c.fill(); } }
}

function glowDot(c, x, y, r, rgb, a) {
  const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
}

function hexMix(a, b, t) { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), m = (s) => Math.round((p >> s & 255) * (1 - t) + (q >> s & 255) * t);
  return '#' + [16, 8, 0].map(s => m(s).toString(16).padStart(2, '0')).join(''); } // (the cached mixHex is not ready yet when the themes are built)
function fh(i, s) { return (((i * 73856093) ^ (s * 19349663)) >>> 0) % 1000 / 1000; } // a steady pseudo-random number for a world cell
/* ---- the far layer: the theme's own distant scenery, plus one landmark: the theme's own in act I, the act's own from act II on ---- */
function lmCathedral(c, w, h, T) { // Sunken Marsh: a half-sunken, leaning cathedral tower with green light in its windows
  const bx = 505, by = h - 14;
  glowDot(c, bx, by - 70, 90, T.glow, 0.34);
  c.save(); c.translate(bx, by); c.rotate(-0.12); c.fillStyle = T.far2;
  c.fillRect(-14, -80, 28, 80); c.fillRect(-18, -84, 36, 4);
  c.beginPath(); c.moveTo(-14, -84); c.lineTo(0, -120); c.lineTo(14, -84); c.fill(); c.fillRect(-1, -130, 2, 12); // spire and finial
  c.fillRect(-21, -46, 7, 46); c.fillRect(14, -54, 7, 54); // buttresses
  c.fillRect(-74, -34, 54, 34); for (let i = 0; i < 3; i++) c.fillRect(-74 + i * 20, -40 - (i % 2) * 5, 12, 8); // the broken nave
  c.fillStyle = T.win;
  for (const [wy, wh2] of [[-72, 11], [-54, 12], [-36, 11]]) { c.beginPath(); c.moveTo(-3, wy + wh2); c.lineTo(-3, wy + 3); c.lineTo(0, wy); c.lineTo(3, wy + 3); c.lineTo(3, wy + wh2); c.fill(); }
  for (const nx of [-66, -48, -30]) { c.beginPath(); c.moveTo(nx - 2, -6); c.lineTo(nx - 2, -22); c.lineTo(nx, -26); c.lineTo(nx + 2, -22); c.lineTo(nx + 2, -6); c.fill(); }
  c.restore();
  c.fillStyle = T.far; c.fillRect(bx - 130, h - 34, 260, 40); // the water takes the foot of the tower
  c.fillStyle = 'rgba(140,255,190,0.22)'; c.fillRect(bx - 120, h - 34, 240, 1);
  glowDot(c, bx - 6, h - 26, 16, T.glow, 0.45);
}
function lmFurnace(c, w, h, T) { // Ember Forge: a giant furnace, its barred mouth the face
  const fx = 520, fy = h - 34;
  glowDot(c, fx, fy - 56, 100, '255,140,40', 0.5);
  c.fillStyle = T.far2;
  c.beginPath(); c.moveTo(fx - 92, fy); c.lineTo(fx - 70, fy - 92); c.lineTo(fx - 36, fy - 106); c.lineTo(fx + 36, fy - 106); c.lineTo(fx + 70, fy - 92); c.lineTo(fx + 92, fy); c.fill();
  c.fillRect(fx - 60, fy - 124, 18, 36); c.fillRect(fx + 42, fy - 120, 18, 32); c.fillRect(fx - 64, fy - 126, 26, 5); c.fillRect(fx + 38, fy - 122, 26, 5);
  for (let s = 0; s < 5; s++) { c.fillStyle = `rgba(70,46,40,${0.34 - s * 0.05})`; c.beginPath(); c.ellipse(fx - 51 + s * 7, fy - 134 - s * 10, 9 + s * 4, 5 + s * 2, 0, 0, 7); c.fill(); }
  c.fillStyle = '#ffb43a'; // slanted eyes
  c.beginPath(); c.moveTo(fx - 46, fy - 82); c.lineTo(fx - 16, fy - 74); c.lineTo(fx - 18, fy - 68); c.lineTo(fx - 48, fy - 74); c.fill();
  c.beginPath(); c.moveTo(fx + 46, fy - 82); c.lineTo(fx + 16, fy - 74); c.lineTo(fx + 18, fy - 68); c.lineTo(fx + 48, fy - 74); c.fill();
  const mg = c.createLinearGradient(0, fy - 58, 0, fy - 14); mg.addColorStop(0, '#ffe070'); mg.addColorStop(1, '#ff4a10');
  c.fillStyle = mg; c.beginPath(); c.moveTo(fx - 34, fy - 14); c.lineTo(fx - 34, fy - 48); c.arc(fx, fy - 48, 34, Math.PI, 0); c.lineTo(fx + 34, fy - 14); c.fill(); // the glowing mouth
  c.fillStyle = T.far2; for (let b = -3; b <= 3; b++) c.fillRect(fx + b * 9 - 1.5, fy - 80, 3, 66); c.fillRect(fx - 36, fy - 36, 72, 3);
}
function lmThrone(c, w, h, T) { // Obsidian Throne: a spiked throne at the top of a stair, red light behind it
  const kx = 470, gy = h - 34;
  glowDot(c, kx, gy - 62, 90, '255,40,70', 0.5);
  c.fillStyle = T.far2;
  for (let s = 0; s < 5; s++) c.fillRect(kx - 70 + s * 9, gy - s * 7 - 7, 140 - s * 18, 8);
  c.fillRect(kx - 26, gy - 40, 52, 5);
  c.fillRect(kx - 16, gy - 56, 32, 17); c.fillRect(kx - 26, gy - 54, 10, 4); c.fillRect(kx + 16, gy - 54, 10, 4);
  c.fillRect(kx - 13, gy - 90, 26, 36);
  c.beginPath(); c.moveTo(kx - 13, gy - 90); c.lineTo(kx, gy - 106); c.lineTo(kx + 13, gy - 90); c.fill();
  for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.3; c.beginPath(); c.moveTo(kx + i * 3.6 - 2, gy - 82); c.lineTo(kx + Math.cos(a) * 30 + i * 2, gy - 82 + Math.sin(a) * 26); c.lineTo(kx + i * 3.6 + 2, gy - 82); c.fill(); }
  c.fillStyle = T.win; c.fillRect(kx - 2, gy - 76, 4, 8);
  c.strokeStyle = 'rgba(255,60,110,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(kx + 13, gy - 90); c.lineTo(kx + 13, gy - 54); c.lineTo(kx + 16, gy - 54); c.stroke();
}
function lmHeart(c, w, h, T) { // Heart-Ember Sanctum: the dome, and the Heart-Ember floating above it
  const dx = 470, by = h - 34;
  glowDot(c, dx, by - 80, 150, T.glow, 0.5);
  c.fillStyle = T.far2; c.beginPath(); c.ellipse(dx, by, 78, 56, 0, Math.PI, 0); c.fill(); c.fillRect(dx - 86, by - 4, 172, 8);
  c.strokeStyle = 'rgba(255,200,90,0.55)'; c.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(dx + i * 11, by); c.quadraticCurveTo(dx + i * 13, by - 44, dx + i * 3, by - 56); c.stroke(); }
  c.strokeStyle = '#ffd070'; c.lineWidth = 2; c.beginPath(); c.ellipse(dx, by, 78, 56, 0, Math.PI, 0); c.stroke(); c.fillStyle = '#ffd070'; c.fillRect(dx - 86, by - 4, 172, 2);
  c.fillStyle = T.far2; c.fillRect(dx - 6, by - 70, 12, 14); c.fillRect(dx - 3, by - 76, 6, 7);
  const hy = by - 94;
  glowDot(c, dx, hy, 62, '255,240,180', 0.85);
  c.strokeStyle = 'rgba(255,230,150,0.32)'; c.lineWidth = 1; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(dx + Math.cos(a) * 18, hy + Math.sin(a) * 18); c.lineTo(dx + Math.cos(a) * (34 + (i % 2) * 12), hy + Math.sin(a) * (34 + (i % 2) * 12)); c.stroke(); }
  c.fillStyle = '#fff2b8'; c.beginPath(); c.moveTo(dx, hy - 19); c.lineTo(dx + 11, hy - 2); c.lineTo(dx + 6, hy + 14); c.lineTo(dx - 6, hy + 14); c.lineTo(dx - 11, hy - 2); c.fill();
  c.fillStyle = '#ffc850'; c.beginPath(); c.moveTo(dx, hy - 19); c.lineTo(dx + 11, hy - 2); c.lineTo(dx, hy + 14); c.fill();
  c.fillStyle = '#fffbe0'; c.beginPath(); c.moveTo(dx, hy - 12); c.lineTo(dx - 4, hy); c.lineTo(dx, hy + 6); c.lineTo(dx + 3, hy); c.fill();
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.4, r = 26 + (i % 3) * 9, sx = dx + Math.cos(a) * r, sy = hy + Math.sin(a) * r * 0.8, sz = 1.5 + (i % 2);
    c.fillStyle = '#ffd070'; c.beginPath(); c.moveTo(sx, sy - sz * 1.5); c.lineTo(sx + sz, sy); c.lineTo(sx, sy + sz * 1.5); c.lineTo(sx - sz, sy); c.fill(); }
}
function lmAct(c, w, h, T, act) { // the landmark of acts II-VII, in the middle of the far layer
  const gy = h - 34, X = 480;
  if (act !== 4 && act !== 5 && act !== 6) glowDot(c, X, gy - 56, 150, T.glow, 0.42); // a soft backlight so the dark landmark stands out of the sky
  const dune = (cx, wd, ht) => { c.beginPath(); c.moveTo(cx - wd, h); c.quadraticCurveTo(cx - wd * 0.3, gy - ht, cx, gy - ht); c.quadraticCurveTo(cx + wd * 0.5, gy - ht + 4, cx + wd, h); c.fill(); };
  if (act === 1) { // II  Shattered Bridge: a stone bridge broken in the middle, blue mist below
    const y0 = gy - 54, span = (a, b) => { const m = (a + b) / 2; c.beginPath(); c.moveTo(a, y0); c.lineTo(b, y0); c.lineTo(b, y0 + 30); c.quadraticCurveTo(m, y0 - 10, a, y0 + 30); c.closePath(); c.fill(); };
    glowDot(c, X, y0 + 30, 80, '120,170,255', 0.3); c.fillStyle = T.far2;
    span(300, 366); span(366, 432); span(528, 594); span(594, 660);
    for (const [px, ph] of [[300, 0], [366, 0], [432, 14], [528, 10], [594, 0], [660, 0]]) c.fillRect(px - 6, y0 + 28 + ph, 12, gy - y0 - 28 - ph + 6);
    for (let i = 0; i < 12; i++) { c.fillRect(300 + i * 12, y0 - 7, 7, 4); if (i < 7) c.fillRect(530 + i * 12 + 4, y0 - 7, 7, 4); }
    c.beginPath(); c.moveTo(432, y0); c.lineTo(452, y0 + 6); c.lineTo(440, y0 + 14); c.lineTo(450, y0 + 24); c.lineTo(432, y0 + 30); c.fill();
    c.beginPath(); c.moveTo(528, y0); c.lineTo(510, y0 + 8); c.lineTo(520, y0 + 16); c.lineTo(508, y0 + 26); c.lineTo(528, y0 + 30); c.fill();
    for (const [bx, by, an] of [[470, y0 + 22, 0.4], [486, y0 + 40, -0.6], [498, y0 + 12, 0.9], [478, y0 + 58, 0.2], [466, y0 + 74, -0.3]]) { c.save(); c.translate(bx, by); c.rotate(an); c.fillRect(-5, -4, 10, 8); c.restore(); }
    for (let i = 0; i < 16; i++) { c.fillStyle = 'rgba(140,185,245,0.15)'; c.beginPath(); c.ellipse(290 + i * 26, gy - 2 + (i % 3) * 5, 42, 9, 0, 0, 7); c.fill(); }
  } else if (act === 2) { // III  Ashen Wastes: ash dunes, burnt trees, falling ash
    c.fillStyle = T.far2; dune(300, 90, 26); dune(380, 130, 40); dune(560, 150, 56); dune(700, 90, 30);
    c.strokeStyle = 'rgba(255,225,200,0.13)'; c.lineWidth = 1; c.beginPath(); c.moveTo(430, gy - 38); c.quadraticCurveTo(520, gy - 58, 600, gy - 44); c.stroke();
    c.strokeStyle = '#06030a'; c.lineCap = 'round';
    for (const [tx, ty, th2] of [[350, gy - 24, 40], [418, gy - 34, 56], [510, gy - 50, 62], [586, gy - 46, 48], [660, gy - 24, 38]]) {
      c.lineWidth = 3; c.beginPath(); c.moveTo(tx, ty + 4); c.quadraticCurveTo(tx + rnd(-5, 5), ty - th2 * 0.5, tx + rnd(-3, 3), ty - th2); c.stroke();
      c.lineWidth = 1.5; for (let b = 0; b < 3; b++) { const by = ty - th2 * (0.35 + b * 0.22), dir = b % 2 ? 1 : -1; c.beginPath(); c.moveTo(tx, by); c.lineTo(tx + dir * rnd(7, 13), by - rnd(4, 9)); c.stroke(); }
    }
    c.strokeStyle = 'rgba(210,195,185,0.22)'; for (let i = 0; i < 54; i++) { const ax = rnd(280, 700), ay = rnd(10, gy - 20); c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 4, ay + rnd(6, 14)); c.stroke(); }
  } else if (act === 3) { // IV  Withered Wilds: giant dry trees, thorny vines
    c.strokeStyle = T.far2; c.fillStyle = T.far2; c.lineCap = 'round';
    const br = (x, y, len, ang, wd, d) => { if (d > 3 || len < 6) return; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; c.lineWidth = wd;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); br(x2, y2, len * rnd(0.62, 0.78), ang - rnd(0.3, 0.7), wd * 0.65, d + 1);
      br(x2, y2, len * rnd(0.55, 0.75), ang + rnd(0.3, 0.7), wd * 0.65, d + 1); if (d === 1) br(x2, y2, len * 0.5, ang + rnd(-0.2, 0.2), wd * 0.6, d + 1); };
    for (const [tx, tl, tw] of [[390, 34, 9], [490, 42, 11], [590, 32, 8]]) br(tx, gy + 2, tl, -Math.PI / 2 + rnd(-0.1, 0.1), tw, 0);
    const vine = (x0, y0, dir) => { c.lineWidth = 2; const pts = []; c.beginPath(); c.moveTo(x0, y0);
      for (let t = 0; t <= 1.001; t += 0.05) { const x = x0 + dir * (t * 56 + Math.sin(t * 9) * 8), y = y0 - t * 64 - Math.sin(t * 5) * 6; pts.push([x, y]);
      c.lineTo(x, y); } c.stroke(); for (let i = 2; i < pts.length; i += 2) { const [x, y] = pts[i]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dir * 4, y - 6);
      c.lineTo(x + dir, y); c.fill(); } };
    vine(340, gy + 2, 1); vine(440, gy + 2, -1); vine(540, gy + 2, 1); vine(640, gy + 2, -1);
  } else if (act === 4) { // V  Gilded Dunes: a buried giant stone head, a huge sun
    glowDot(c, 430, gy - 52, 140, '255,215,120', 0.55); c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(430, gy - 52, 36, 0, 7); c.fill(); c.fillStyle = '#fff6cc'; c.beginPath(); c.arc(430, gy - 52, 26, 0, 7); c.fill();
    const hx = 545, hy = gy + 4;
    c.beginPath(); c.moveTo(hx - 58, hy); c.lineTo(hx - 56, hy - 30); c.lineTo(hx - 50, hy - 42); c.lineTo(hx - 55, hy - 48); c.lineTo(hx - 49, hy - 52);
      c.lineTo(hx - 58, hy - 62); c.lineTo(hx - 47, hy - 68); c.lineTo(hx - 51, hy - 76); c.lineTo(hx - 45, hy - 90);
      c.quadraticCurveTo(hx - 20, hy - 106, hx + 20, hy - 96); c.quadraticCurveTo(hx + 52, hy - 80, hx + 46, hy); c.closePath();
    c.fillStyle = hexMix(T.far2, '#ffd9a0', 0.16); c.fill();
    c.strokeStyle = 'rgba(255,225,160,0.4)'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#05030a'; c.fillRect(hx - 44, hy - 73, 11, 3); c.fillRect(hx - 50, hy - 50, 9, 2); // eye and mouth
    c.fillStyle = hexMix(T.far2, '#ffd9a0', 0.1); c.fillRect(hx - 8, hy - 100, 28, 7); // a band of the crown
    c.fillStyle = T.far2; dune(500, 120, 20); dune(600, 100, 16); dune(380, 100, 22);
  } else if (act === 5) { // VI  Eclipse Gate: a black sun with a ring of light, a glowing gate
    const sx = 535, sy = 40;
    glowDot(c, sx, sy, 100, '255,200,140', 0.45);
    for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283, l = 36 + (i % 3) * 9; c.strokeStyle = 'rgba(255,225,170,0.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx + Math.cos(a) * 26, sy + Math.sin(a) * 26); c.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); c.stroke(); }
    c.strokeStyle = 'rgba(255,235,190,0.8)'; c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy, 25, 0, 7); c.stroke(); c.fillStyle = '#000'; c.beginPath(); c.arc(sx, sy, 24, 0, 7); c.fill();
    const gx = 420; glowDot(c, gx, gy - 30, 70, T.glow, 0.5);
    c.fillStyle = T.far2; c.fillRect(gx - 36, gy - 56, 12, 58); c.fillRect(gx + 24, gy - 56, 12, 58);
    c.beginPath(); c.moveTo(gx - 36, gy - 56); c.arc(gx, gy - 56, 36, Math.PI, 0); c.lineTo(gx + 24, gy - 56); c.arc(gx, gy - 56, 24, 0, Math.PI, true); c.closePath(); c.fill();
    const ig = c.createLinearGradient(0, gy - 82, 0, gy); ig.addColorStop(0, '#fff3c0'); ig.addColorStop(1, `rgb(${T.glow})`);
    c.fillStyle = ig; c.beginPath(); c.moveTo(gx - 24, gy); c.lineTo(gx - 24, gy - 56); c.arc(gx, gy - 56, 24, Math.PI, 0); c.lineTo(gx + 24, gy); c.fill();
    c.fillStyle = 'rgba(255,230,170,0.16)'; c.beginPath(); c.moveTo(gx - 22, gy); c.lineTo(gx + 22, gy); c.lineTo(gx + 90, h); c.lineTo(gx - 90, h); c.fill();
  } else if (act === 6) { // VII  World-Forge: a forge-mountain with rivers of lava, the first flame on its peak
    glowDot(c, 500, gy, 130, '255,110,30', 0.32);
    c.fillStyle = T.far2; c.beginPath(); c.moveTo(250, h); c.lineTo(330, gy - 24); c.lineTo(392, gy - 46); c.lineTo(444, gy - 78); c.lineTo(476, gy - 92);
      c.lineTo(500, gy - 100); c.lineTo(524, gy - 90); c.lineTo(552, gy - 76); c.lineTo(596, gy - 50); c.lineTo(650, gy - 28); c.lineTo(730, h); c.fill();
    c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#ff7a20'; c.shadowBlur = 8;
    for (const [pts, wd] of [[[[498, gy - 92], [486, gy - 70], [496, gy - 52], [480, gy - 30], [488, gy - 4]], 3], [[[506, gy - 88], [528, gy - 66], [518, gy - 46], [542,
      gy - 26], [534, gy - 4]], 2.4], [[[470, gy - 80], [446, gy - 58], [454, gy - 40], [430, gy - 22]], 2], [[[538, gy - 74], [566, gy - 52], [584, gy - 34], [576,
      gy - 8]], 2]]) {
      c.strokeStyle = 'rgba(255,120,30,0.95)'; c.lineWidth = wd; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
      c.shadowBlur = 0; c.strokeStyle = '#ffd070'; c.lineWidth = Math.max(0.8, wd * 0.35); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); c.shadowBlur = 8;
    }
    c.shadowBlur = 0; glowDot(c, 500, gy - 104, 36, '255,210,110', 0.9);
    c.fillStyle = '#ffeaa0'; c.beginPath(); c.moveTo(500, gy - 126); c.quadraticCurveTo(510, gy - 112, 500, gy - 102); c.quadraticCurveTo(490, gy - 112, 500, gy - 126); c.fill();
    c.fillStyle = '#ff9a2a'; c.beginPath(); c.moveTo(500, gy - 116); c.quadraticCurveTo(505, gy - 108, 500, gy - 103); c.quadraticCurveTo(495, gy - 108, 500, gy - 116); c.fill();
  }
}
function themeFar(c, w, h, T) {
  c.fillStyle = T.far; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) c.lineTo(x, h - 52 - periodic(x, 1.3) * 16);
  c.lineTo(w, h); c.fill();
  const k = T.farK, act = T.act | 0, mid = x => x > 340 && x < 620; // the middle of the layer belongs to the landmark
  if (k === 'castle') {
    for (const cx0 of act ? [800] : [330, 800]) {
      glowDot(c, cx0 + 40, h - 60, 95, T.glow, 0.38);
      c.fillStyle = T.far2; c.fillRect(cx0, h - 92, 80, 52); c.fillRect(cx0 - 14, h - 112, 22, 72); c.fillRect(cx0 + 72, h - 106, 22, 66); c.fillRect(cx0 + 30, h - 124, 20, 84);
      for (let t = 0; t < 4; t++) { c.fillRect(cx0 - 14 + t * 6, h - 116, 4, 5); c.fillRect(cx0 + 72 + t * 6, h - 110, 4, 5); }
      c.beginPath(); c.moveTo(cx0 + 28, h - 124); c.lineTo(cx0 + 40, h - 146); c.lineTo(cx0 + 52, h - 124); c.fill();
      c.fillStyle = T.win; for (const [wx, wy] of [[cx0 + 10, h - 80], [cx0 + 60, h - 80], [cx0 + 38, h - 108], [cx0 - 6, h - 98], [cx0 + 80, h - 92]]) c.fillRect(wx, wy, 3, 5);
    }
    c.fillStyle = T.far2;
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 135 + rnd(-20, 20), bw = rnd(14, 26), bh = rnd(50, 95); if (act && mid(x)) continue;
      c.fillStyle = T.far2; c.fillRect(x, h - 40 - bh, bw, bh + 40); c.fillRect(x - 3, h - 40 - bh, bw + 6, 4);
      for (let t = 0; t < 3; t++) c.fillRect(x - 3 + t * (bw / 2 + 1), h - 46 - bh, 4, 6);
      c.fillStyle = T.win; c.fillRect(x + bw / 2 - 1, h - 40 - bh * 0.6, 2, 4);
    }
  } else if (k === 'marsh') {
    for (let i = 0; i < 6; i++) { // dead trees with hanging moss
      const x = 70 + i * 150 + rnd(-25, 25), th = rnd(70, 105); if (mid(x)) continue;
      c.strokeStyle = T.far2; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, h - 30); c.quadraticCurveTo(x + rnd(-14, 14), h - 30 - th * 0.55, x + rnd(-10, 10), h - 30 - th); c.stroke();
      c.lineWidth = 3;
      for (let b = 0; b < 5; b++) { const by = h - 30 - th * (0.4 + b * 0.12), dir = b % 2 ? 1 : -1; c.beginPath(); c.moveTo(x, by);
        c.quadraticCurveTo(x + dir * 14, by - 10, x + dir * (24 + b * 4), by - 4 + b * 3); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + dir * 18, by - 8);
        c.lineTo(x + dir * 24, by - 18); c.stroke(); c.lineWidth = 3; }
      c.strokeStyle = 'rgba(80,150,110,0.5)'; c.lineWidth = 1;
      for (let m = 0; m < 7; m++) { const mx = x + rnd(-26, 26), my = h - 30 - th * rnd(0.55, 0.95); c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + rnd(-2, 2), my + rnd(14, 30)); c.stroke(); }
    }
    for (let i = 0; i < 14; i++) glowDot(c, rnd(0, w), rnd(h - 110, h - 40), 9, '160,255,190', 0.7); // will-o'-the-wisps
    if (!act) lmCathedral(c, w, h, T);
  } else if (k === 'forge') {
    for (const cx0 of [60, 190, 760, 880]) {
      const ch = rnd(60, 90); c.fillStyle = T.far2; c.fillRect(cx0, h - 36 - ch, 14, ch + 36); c.fillRect(cx0 - 3, h - 36 - ch, 20, 5);
      glowDot(c, cx0 + 7, h - 38 - ch, 22, '255,140,40', 0.5);
      for (let s = 0; s < 5; s++) { c.fillStyle = `rgba(70,46,40,${0.32 - s * 0.05})`; c.beginPath(); c.ellipse(cx0 + 7 + s * 5, h - 44 - ch - s * 11, 9 + s * 4, 5 + s * 2, 0, 0, 7); c.fill(); }
    }
    const sg2 = c.createLinearGradient(0, h - 16, 0, h); sg2.addColorStop(0, 'rgba(255,120,30,0)'); sg2.addColorStop(1, 'rgba(255,120,30,0.55)'); c.fillStyle = sg2; c.fillRect(0, h - 16, w, 16);
    if (!act) lmFurnace(c, w, h, T);
  } else if (k === 'sanctum') {
    for (let i = 0; i < 8; i++) { const x = 30 + i * 120, bh = rnd(60, 115); if (mid(x)) continue; c.fillStyle = T.far2; c.fillRect(x, h - 36 - bh, 16, bh + 36); c.fillRect(x - 4, h - 36 - bh, 24, 5); glowDot(c, x + 8, h - 40 - bh, 14, '255,200,90', 0.5); }
    if (!act) lmHeart(c, w, h, T); else glowDot(c, 470, h - 90, 120, T.glow, 0.3);
  } else { // throne
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 105 + rnd(-15, 15), bh = rnd(70, 130), bw = rnd(10, 20); if (mid(x)) continue;
      c.fillStyle = T.far2; c.beginPath(); c.moveTo(x - bw, h - 36); c.lineTo(x - bw * 0.3, h - 36 - bh); c.lineTo(x, h - 36 - bh - 18); c.lineTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.fill();
      c.strokeStyle = 'rgba(255,60,90,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.stroke();
    }
    for (let i = 0; i < 12; i++) { const sx = rnd(0, w), sy = rnd(20, h - 90), sz = rnd(3, 7); if (mid(sx)) continue; c.fillStyle = T.far2; c.beginPath();
      c.moveTo(sx, sy - sz * 1.6); c.lineTo(sx + sz, sy); c.lineTo(sx, sy + sz * 1.6); c.lineTo(sx - sz, sy); c.fill(); c.fillStyle = 'rgba(255,60,90,0.5)';
      c.fillRect(sx - 1, sy - 1, 2, 2); }
    if (!act) lmThrone(c, w, h, T);
  }
  if (act) lmAct(c, w, h, T, act);
}

function themeMid(c, w, h, T) {
  c.fillStyle = T.mid; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 3) c.lineTo(x, h - 26 - periodic(x + 90, 2.1) * 12);
  c.lineTo(w, h); c.fill();
  const k = T.midK;
  if (k === 'trees') {
    c.strokeStyle = T.tree; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x = i * 106 + rnd(0, 40), y = h - 20; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-3, 3), y - 34); c.moveTo(x, y - 20); c.lineTo(x + 10, y - 32); c.moveTo(x, y - 26); c.lineTo(x - 9, y - 38); c.stroke(); }
  } else if (k === 'reeds') {
    c.strokeStyle = T.tree; c.lineWidth = 1;
    for (let i = 0; i < 130; i++) { const x = rnd(0, w), y = h - 16 - rnd(0, 8), L = rnd(18, 40), lean = rnd(-5, 5); c.beginPath(); c.moveTo(x, y); c.lineTo(x + lean, y - L); c.stroke(); if (i % 3 === 0) { c.fillStyle = '#2a1e14'; c.fillRect(x + lean - 1, y - L - 5, 3, 7); } }
    c.lineWidth = 2; for (let i = 0; i < 6; i++) { const x = i * 160 + rnd(0, 60), y = h - 18; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-3, 3), y - 36); c.moveTo(x, y - 22); c.lineTo(x + 9, y - 33); c.stroke(); }
  } else if (k === 'pipes') {
    c.fillStyle = T.tree; c.fillRect(0, h - 50, w, 6); c.fillRect(0, h - 40, w, 3);
    for (let x = 20; x < w; x += 80) { c.fillRect(x, h - 50, 5, 40); c.fillRect(x - 3, h - 12, 11, 4); }
    for (const gx of [130, 350, 610, 830]) { c.beginPath(); c.arc(gx, h - 34, 13, 0, 7); c.fill(); for (let t = 0; t < 10; t++) { const a = t / 10 * Math.PI * 2;
      c.fillRect(gx + Math.cos(a) * 14 - 2, h - 34 + Math.sin(a) * 14 - 2, 4, 4); } c.fillStyle = T.mid; c.beginPath(); c.arc(gx, h - 34, 4, 0, 7); c.fill();
      c.fillStyle = T.tree; }
    for (let x = 60; x < w; x += 160) glowDot(c, x, h - 47, 8, '255,150,50', 0.6);
  } else {
    for (let i = 0; i < 18; i++) { const x = rnd(0, w), n = 2 + (i % 3); for (let j = 0; j < n; j++) { const bx = x + j * 7, bh = rnd(14, 34); c.fillStyle = T.tree;
      c.beginPath(); c.moveTo(bx - 4, h - 14); c.lineTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.fill(); c.strokeStyle = 'rgba(255,60,90,0.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.stroke(); } }
  }
  if (k === 'pipes') midScaffold(c, w, h, T);
}

function themeWall(c, w, h, T) {
  c.fillStyle = T.wall; c.fillRect(0, 70, w, h - 70);
  const [r0, g0, b0] = T.wallRGB;
  for (let x = 0; x < w; x += 8) for (let y = 70; y < h; y += 8) { c.fillStyle = `rgb(${r0 + rnd(-8, 8) | 0},${g0 + rnd(-6, 6) | 0},${b0 + rnd(-8, 8) | 0})`; c.fillRect(x, y, 7, 7); }
  for (let x = 0; x < w; x += 160) {
    c.beginPath(); c.moveTo(x + 24, h); c.lineTo(x + 24, 92); c.arc(x + 80, 92, 56, Math.PI, 0); c.lineTo(x + 136, h);
    c.globalCompositeOperation = 'destination-out'; c.fill(); c.globalCompositeOperation = 'source-over'; // the arches are windows: the sky and the far landmark show through
    const ag = c.createLinearGradient(0, 36, 0, h); ag.addColorStop(0, T.arch + '3a'); ag.addColorStop(1, T.arch + 'b0'); c.fillStyle = ag; c.fill(); // a dark haze over the view, deeper toward the floor
    c.fillStyle = T.pil; c.fillRect(x, 64, 14, h - 64); c.fillRect(x - 3, 60, 20, 6);
  }
  if (T.wallK === 'sanctum') { c.strokeStyle = T.trim2; c.lineWidth = 2; for (let x = 0; x < w; x += 160) { c.beginPath(); c.moveTo(x + 24, h); c.lineTo(x + 24, 92);
    c.arc(x + 80, 92, 56, Math.PI, 0); c.lineTo(x + 136, h); c.stroke(); } c.strokeStyle = 'rgba(255,240,170,0.45)'; c.lineWidth = 1;
    for (let x = 0; x < w; x += 160) { c.beginPath(); c.moveTo(x + 29, h); c.lineTo(x + 29, 92); c.arc(x + 80, 92, 51, Math.PI, 0); c.lineTo(x + 131, h); c.stroke();
    } } // gilded arches
  const k = T.wallK;
  for (let x = 0; x < w; x += 160) {
    if (k === 'gate') {
      const bx = x + 71; c.fillStyle = T.ban; c.beginPath(); c.moveTo(bx, 66); c.lineTo(bx + 18, 66); c.lineTo(bx + 18, 118); c.lineTo(bx + 9, 110); c.lineTo(bx, 118); c.fill();
      c.fillStyle = T.ban2; c.fillRect(bx + 12, 66, 6, 50); c.fillStyle = '#d9a93a'; c.fillRect(bx - 1, 64, 20, 3);
      c.beginPath(); c.moveTo(bx + 9, 80); c.lineTo(bx + 14, 88); c.lineTo(bx + 9, 96); c.lineTo(bx + 4, 88); c.fill();
    } else if (k === 'marsh') {
      for (let v = 0; v < 7; v++) { const vx = x + 28 + rnd(0, 104), vl = rnd(20, 56); c.strokeStyle = '#2a6a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(vx, 70); c.lineTo(vx + rnd(-2, 2), 70 + vl); c.stroke(); c.fillStyle = '#3a8a4a'; c.fillRect(vx - 2, 70 + vl, 4, 3); }
      c.strokeStyle = '#1a2a20'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 80, 66); c.lineTo(x + 80, 84); c.stroke();
      glowDot(c, x + 80, 92, 22, '120,255,160', 0.5); c.fillStyle = '#0c1a12'; c.fillRect(x + 75, 84, 10, 12); c.fillStyle = '#9dffb0'; c.fillRect(x + 77, 86, 6, 8);
    } else if (k === 'forge') {
      glowDot(c, x + 80, 112, 46, '255,140,40', 0.5);
      c.fillStyle = '#0c0504'; c.fillRect(x + 58, 96, 44, 36); const fgr = c.createLinearGradient(0, 98, 0, 130); fgr.addColorStop(0, '#ffcf5a'); fgr.addColorStop(1, '#ff4a10'); c.fillStyle = fgr; c.fillRect(x + 61, 99, 38, 30);
      c.fillStyle = '#1a0c08'; for (let b = 0; b < 4; b++) c.fillRect(x + 66 + b * 9, 99, 2, 30);
      c.fillStyle = '#5a3a2a'; for (const cx of [x + 40, x + 120]) for (let l = 0; l < 7; l++) c.fillRect(cx - 1 + (l % 2), 66 + l * 6, 3, 4);
      c.fillStyle = '#8a5a3a'; for (let r = 70; r < h - 8; r += 12) { c.fillRect(x + 3, r, 2, 2); c.fillRect(x + 9, r, 2, 2); }
    } else if (k === 'sanctum') {
      glowDot(c, x + 80, 108, 44, '255,200,90', 0.35);
      c.fillStyle = '#ffcf5a'; for (let r = 74; r < h - 10; r += 12) { c.fillRect(x + 3, r, 7, 2); c.fillRect(x + 3 + (r % 5), r + 4, 2, 4); }
      const bx = x + 71; c.fillStyle = T.ban; c.beginPath(); c.moveTo(bx, 66); c.lineTo(bx + 18, 66); c.lineTo(bx + 18, 118); c.lineTo(bx + 9, 110); c.lineTo(bx, 118); c.fill();
      c.fillStyle = '#ffe9a0'; c.beginPath(); c.moveTo(bx + 9, 78); c.lineTo(bx + 14, 90); c.lineTo(bx + 9, 102); c.lineTo(bx + 4, 90); c.fill();
    } else {
      c.fillStyle = '#ff4a5a'; for (let r = 72; r < h - 10; r += 14) { c.fillRect(x + 4, r, 6, 2); c.fillRect(x + 4 + (r % 3), r + 4, 2, 5); }
      const bx = x + 71; c.fillStyle = T.ban; c.beginPath(); c.moveTo(bx, 66); c.lineTo(bx + 18, 66); c.lineTo(bx + 18, 118); c.lineTo(bx + 9, 110); c.lineTo(bx, 118); c.fill();
      c.fillStyle = '#ff4a5a'; c.fillRect(bx - 1, 64, 20, 2); c.beginPath(); c.moveTo(bx + 3, 92); c.lineTo(bx + 3, 82); c.lineTo(bx + 6, 87); c.lineTo(bx + 9, 80); c.lineTo(bx + 12, 87); c.lineTo(bx + 15, 82); c.lineTo(bx + 15, 92); c.fill();
    }
  }
  c.fillStyle = T.trim; c.fillRect(0, h - 6, w, 6); c.fillStyle = T.trim2; c.fillRect(0, h - 6, w, 1);
}

const buildTheme = T => Object.assign({}, T, {
  skyL: makeLayer((c, w, h) => themeSky(c, w, h, T)),
  farL: makeLayer((c, w, h) => themeFar(c, w, h, T)),
  midL: makeLayer((c, w, h) => themeMid(c, w, h, T)),
  wallL: makeLayer((c, w, h) => themeWall(c, w, h, T), GROUND_TOP + 6)
});
const THEMES = THEME_DEF.map(buildTheme);
/* act palettes: later acts regrade every colour of a theme (frost, deep crimson, violet-gold) */
const ACT_GRADE = [{ c: null, s: 1, l: 1 }, { c: 205, k: 0.75, s: 0.85, l: 1.1 }, { c: 355, k: 0.7, s: 1.15, l: 0.92 }, { c: 128, k: 0.68, s: 1.05, l: 0.95 }, { c: 42, k: 0.66, s: 1.15, l: 1.08 }, { c: 330, k: 0.72, s: 1.2, l: 0.78 }, { c: 275, k: 0.7, s: 1.05, l: 1.02 }];
function gradeRGB(r, g, b, G) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  if (G.c !== null) { const dh = ((G.c - h + 540) % 360) - 180; h = ((h + dh * G.k) % 360 + 360) % 360; } s = Math.min(1, s * G.s); l = Math.min(0.95, l * G.l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return s === 0 ? [l, l, l].map(v => Math.round(v * 255)) : [f(h / 360 + 1 / 3), f(h / 360), f(h / 360 - 1 / 3)].map(v => Math.round(v * 255));
}
function gradeVal(v, G) {
  if (typeof v === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(v)) { const n = parseInt(v.slice(1), 16), c = gradeRGB(n >> 16 & 255, n >> 8 & 255, n & 255, G); return '#' + c.map(x => x.toString(16).padStart(2, '0')).join(''); }
    if (/^\d+,\d+,\d+$/.test(v)) { const a = v.split(',').map(Number); return gradeRGB(a[0], a[1], a[2], G).join(','); }
    const m = v.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/); if (m) return 'rgba(' + gradeRGB(+m[1], +m[2], +m[3], G).join(',') + ',' + m[4] + ')';
    return v;
  }
  if (Array.isArray(v)) return (v.length === 3 && typeof v[0] === 'number') ? gradeRGB(v[0], v[1], v[2], G) : v.map(x => gradeVal(x, G));
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = gradeVal(v[k], G); return o; }
  return v;
}
const _actThemes = {};
function themeFor(idx, act) {
  act = Math.max(0, Math.min(6, act | 0)); if (!act) return THEMES[idx];
  const key = act + ':' + idx; if (!_actThemes[key]) { const T = {}; for (const k in THEME_DEF[idx]) T[k] = k === 'fogA' ? THEME_DEF[idx][k] : gradeVal(THEME_DEF[idx][k], ACT_GRADE[act]); T.act = act; _actThemes[key] = buildTheme(T); }
  return _actThemes[key];
}
const actOf = si => Math.min(6, (si / 5) | 0);
/* weather: what falls through each act and theme */
const WEATHER = [[null, 'rain', 'sparks', 'storm', 'ash'], ['snow', 'snow', 'blizzard', 'blizzard', 'snow'], ['ash', 'storm', 'ash', 'storm', 'sparks'], ['rain', 'motes',
  'rain', 'storm', 'motes'], ['ash', 'sparks', 'ash', 'storm', 'sparks'], ['storm', 'ash', 'blizzard', 'storm', 'ash'], ['motes', 'rain', 'sparks', 'storm', 'motes']];
let weather = 'ash';
const wh = (i, s) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
function updateWeather() { if ((weather === 'storm') && ((tickN + 137) % 540 === 0 || (tickN + 137) % 540 === 11)) flashA = Math.max(flashA, 0.4); }
function drawWeather() {
  const w = weather; if (!w) return; const t = tickN;
  if (w === 'rain' || w === 'storm') {
    g.fillStyle = 'rgba(170,195,225,0.4)';
    for (let i = 0; i < (w === 'storm' ? 150 : 90); i++) { const sp = 5 + wh(i, 3) * 3, x = ((wh(i, 1) * (W + 40) - t * 0.9) % (W + 40) + W + 40) % (W + 40), y = (wh(i, 2) * H + t * sp) % H; g.fillRect(x | 0, y | 0, 1, 5 + (i % 3)); }
  } else if (w === 'snow' || w === 'blizzard') {
    const wind = w === 'blizzard' ? -2.4 : -0.3, n = w === 'blizzard' ? 170 : 85;
    for (let i = 0; i < n; i++) { const sp = 0.5 + wh(i, 3) * 1.1 + (w === 'blizzard' ? 1.2 : 0), x = ((wh(i, 1) * (W + 60) + t * wind + Math.sin(t * 0.03 + i) * 6) % (W + 60) + W + 60) % (W + 60), y = (wh(i, 2) * H + t * sp) % H;
      g.fillStyle = `rgba(235,245,255,${0.5 + wh(i, 4) * 0.4})`; g.fillRect(x | 0, y | 0, wh(i, 5) > 0.7 ? 2 : 1, wh(i, 5) > 0.7 ? 2 : 1); }
  } else if (w === 'ash') {
    for (let i = 0; i < 70; i++) { const x = ((wh(i, 1) * (W + 30) + t * 0.35 + Math.sin(t * 0.02 + i) * 10) % (W + 30)), y = (wh(i, 2) * H + t * (0.4 + wh(i, 3) * 0.7)) % H; g.fillStyle = i % 9 === 0 ? 'rgba(255,150,70,0.8)' : 'rgba(190,175,170,0.5)'; g.fillRect(x | 0, y | 0, 1, 1); }
  } else if (w === 'sparks') {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) { const x = (wh(i, 1) * W + Math.sin(t * 0.05 + i) * 8 + W) % W, y = H - ((wh(i, 2) * H + t * (0.6 + wh(i, 3) * 1.2)) % H); g.fillStyle = `rgba(255,${130 + wh(i, 4) * 100 | 0},50,${0.4 + 0.4 * Math.abs(Math.sin(t * 0.2 + i))})`; g.fillRect(x | 0, y | 0, 1, 1); }
    g.globalCompositeOperation = 'source-over';
  } else if (w === 'motes') {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 55; i++) { const x = (wh(i, 1) * W + Math.sin(t * 0.017 + i) * 18 + W) % W, y = (wh(i, 2) * H + Math.cos(t * 0.013 + i * 2) * 14 - t * 0.12 * (0.3 + wh(i, 3)) + H * 4) % H;
      g.fillStyle = i % 2 ? `rgba(255,224,140,${0.35 + 0.35 * Math.sin(t * 0.07 + i)})` : `rgba(190,150,255,${0.35 + 0.35 * Math.sin(t * 0.06 + i)})`;
      const s = wh(i, 5) > 0.8 ? 2 : 1; g.fillRect(x | 0, y | 0, s, s); }
    g.globalCompositeOperation = 'source-over';
  }
}

function midScaffold(c, w, h, T) { // Ember Forge, middle layer: scaffolding and a great gear among the pipes
  c.strokeStyle = T.tree; c.fillStyle = T.tree; c.lineCap = 'butt';
  for (const sx of [40, 330, 640, 870]) {
    const sh = rnd(46, 62); c.lineWidth = 2; c.beginPath(); c.moveTo(sx, h - 14); c.lineTo(sx, h - 14 - sh); c.moveTo(sx + 28, h - 14); c.lineTo(sx + 28, h - 14 - sh); c.stroke();
    c.lineWidth = 1; for (let l = 0; l < 3; l++) { const y0 = h - 14 - l * sh / 3; c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx + 28, y0 - sh / 3); c.moveTo(sx + 28, y0); c.lineTo(sx, y0 - sh / 3); c.stroke(); }
    c.fillRect(sx - 6, h - 14 - sh, 40, 3); c.fillRect(sx - 4, h - 14 - sh * 0.5, 36, 2);
  }
  const gx = 500, gy = h - 46, R = 19; c.beginPath(); c.arc(gx, gy, R, 0, 7); c.fill();
  for (let t = 0; t < 12; t++) { const a = t / 12 * Math.PI * 2; c.save(); c.translate(gx + Math.cos(a) * (R + 2), gy + Math.sin(a) * (R + 2)); c.rotate(a); c.fillRect(-3, -3, 6, 6); c.restore(); }
  c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(gx, gy, 6, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
  glowDot(c, gx, gy, 26, '255,150,50', 0.25);
}
/* ---- the floor of each theme, drawn on top of the plain tiles ---- */
function drawFloorFx(T) {
  const k = T.farK, A = T.acc, t = tickN; if (!A || k === 'castle') return;
  if (k === 'marsh') { // a boardwalk over the mud, puddles that hold the moon
    const by0 = 172, by1 = 236, bw = 13, M = T.moon;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, by0 - 3, W, by1 - by0 + 7);
    for (let x = -((cam % bw) + bw) % bw - bw; x < W + bw; x += bw) {
      const i = Math.round((x + cam) / bw), h1 = fh(i, 3); if (h1 > 0.965) continue; // a missing board shows the mud
      const xx = x | 0; g.fillStyle = hexMix(A[0], A[1], Math.round(h1 * 6) / 6); g.fillRect(xx, by0, bw - 1, by1 - by0);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(xx + bw - 2, by0, 1, by1 - by0); g.fillRect(xx + 3 + (i % 3) * 2, by0 + 6 + (fh(i, 5) * 40 | 0), 1, 10);
      g.fillStyle = 'rgba(20,12,6,0.7)'; g.fillRect(xx + 3, by0 + 3, 2, 2); g.fillRect(xx + 3, by1 - 5, 2, 2);
    }
    g.fillStyle = '#17100a'; g.fillRect(0, by0 - 2, W, 3); g.fillRect(0, by1 - 1, W, 3); g.fillStyle = 'rgba(255,230,180,0.18)'; g.fillRect(0, by0 - 2, W, 1);
    for (const [zone, yy, ry, sp] of [[0, 155, 4, 90], [1, 249, 7, 130]]) for (let n = Math.floor((cam - 60) / sp); n <= Math.floor((cam + W + 60) / sp); n++) {
      const hv = fh(n, zone + 7), px = n * sp + hv * sp * 0.7 - cam, py = yy + (fh(n, zone + 9) - 0.5) * 10, rx = 16 + fh(n, zone + 11) * 22; if (px < -50 || px > W + 50) continue;
      g.fillStyle = A[2]; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, 7); g.fill();
      if (M.r) { g.fillStyle = M.col; g.globalAlpha = 0.16; g.beginPath(); g.ellipse(px + rx * 0.1, py, rx * 0.7, ry * 0.8, 0, 0, 7); g.fill(); g.globalAlpha = 0.6; g.beginPath(); g.ellipse(px + rx * 0.1, py, Math.max(2, rx * 0.2), ry * 0.45, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
      if (hv > 0.5) { const rp = (t * 0.02 + hv * 10) % 1; g.strokeStyle = `rgba(200,255,220,${0.28 * (1 - rp)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(px, py, rx * 0.3 + rp * rx * 0.45, ry * 0.3 + rp * ry * 0.5, 0, 0, 7); g.stroke(); }
    }
  } else if (k === 'forge') { // riveted iron, a glowing lava channel at the back, steaming grates
    for (let row = 0; row < 9; row++) { const y = GROUND_TOP + 4 + row * row * 1.6 + row * 6, sp = 24 + row * 7, off0 = -((cam % sp) + sp) % sp, s = row > 4 ? 2 : 1;
      g.fillStyle = 'rgba(210,160,110,0.38)'; for (let x = off0 + (row % 2) * sp / 2 - sp; x < W; x += sp) { g.fillRect((x | 0) + 3, (y | 0) + 2, s, s);
      g.fillRect((x | 0) + sp - 4, (y | 0) + 2, s, s); } }
    g.fillStyle = '#0a0404'; g.fillRect(0, GROUND_TOP, W, 10);
    for (let x = 0; x < W; x += 4) { const v = 0.5 + 0.5 * Math.sin((x + cam) * 0.045 + t * 0.07) * Math.sin((x + cam) * 0.013 - t * 0.03); g.fillStyle = hexMix(A[0], A[1], Math.round(v * 8) / 8); g.fillRect(x, GROUND_TOP + 2, 4, 6); }
    g.fillStyle = '#2a1410'; g.fillRect(0, GROUND_TOP + 8, W, 2); g.fillStyle = 'rgba(255,200,120,0.3)'; g.fillRect(0, GROUND_TOP + 2, W, 1);
    g.save(); g.globalCompositeOperation = 'lighter'; const lg = g.createLinearGradient(0, GROUND_TOP - 14, 0, GROUND_TOP + 30); lg.addColorStop(0, 'rgba(255,120,30,0)');
      lg.addColorStop(0.35, `rgba(255,120,30,${0.26 + 0.05 * Math.sin(t * 0.07)})`); lg.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = lg;
      g.fillRect(0, GROUND_TOP - 14, W, 44); g.restore();
    const gsp = 230; for (let n = Math.floor((cam - 60) / gsp); n <= Math.floor((cam + W + 60) / gsp); n++) {
      const hv = fh(n, 21), gx = n * gsp + hv * 120 - cam, gy = 188 + ((hv * 7 | 0) % 3) * 24, gw = 30 + (gy - 188) / 4; if (gx < -50 || gx > W + 50) continue;
      const x0 = (gx - gw / 2) | 0; g.fillStyle = '#0c0606'; g.fillRect(x0, gy, gw | 0, 9); g.fillStyle = 'rgba(255,120,30,0.5)'; g.fillRect(x0 + 2, gy + 2, (gw | 0) - 4, 5);
      g.fillStyle = '#1c1210'; for (let b = 0; b < gw; b += 5) g.fillRect(x0 + b, gy, 2, 9);
      for (let s = 0; s < 4; s++) { const p = (t * 0.012 + s / 4 + hv) % 1; g.fillStyle = `rgba(225,215,205,${(1 - p) * 0.24})`; g.beginPath(); g.arc(gx + Math.sin(p * 6 + s) * 5, gy - p * 36, 3 + p * 9, 0, 7); g.fill(); }
    }
  } else if (k === 'throne') { // obsidian that holds the torch light, a red carpet with gold edges
    g.save(); g.globalCompositeOperation = 'lighter';
    const sh = ((cam * 0.35) % 360 + 360) % 360; for (let n = -1; n < 3; n++) { const sx = n * 360 - sh + 120, gr = g.createLinearGradient(sx, 0, sx + 90, 0);
      gr.addColorStop(0, 'rgba(255,120,190,0)'); gr.addColorStop(0.5, 'rgba(255,120,190,0.06)'); gr.addColorStop(1, 'rgba(255,120,190,0)'); g.fillStyle = gr;
      g.fillRect(sx, GROUND_TOP, 90, H - GROUND_TOP); }
    for (const tx of torchPositions()) { const x = Math.round(tx - cam), fl = 0.8 + 0.2 * Math.sin(t * 0.2 + tx), rg = g.createLinearGradient(0, GROUND_TOP + 2, 0, GROUND_TOP + 74);
      rg.addColorStop(0, `rgba(${T.torch},${0.5 * fl})`); rg.addColorStop(1, `rgba(${T.torch},0)`); g.fillStyle = rg; g.beginPath(); g.moveTo(x - 5, GROUND_TOP + 2);
      g.lineTo(x + 5, GROUND_TOP + 2); g.lineTo(x + 14, GROUND_TOP + 74); g.lineTo(x - 14, GROUND_TOP + 74); g.fill(); }
    g.restore();
    const c0 = 190, c1 = 226, cy = (c0 + c1) / 2; g.fillStyle = A[0]; g.fillRect(0, c0, W, c1 - c0); g.fillStyle = A[1]; g.globalAlpha = 0.45; g.fillRect(0, c0 + 7, W, c1 - c0 - 14); g.globalAlpha = 1;
    g.fillStyle = A[2]; g.fillRect(0, c0, W, 2); g.fillRect(0, c1 - 2, W, 2); g.fillRect(0, c0 + 5, W, 1); g.fillRect(0, c1 - 6, W, 1);
    const dsp = 44; for (let x = -((cam % dsp) + dsp) % dsp - dsp; x < W + dsp; x += dsp) { const cx = x + dsp / 2; g.fillStyle = A[2]; g.beginPath();
      g.moveTo(cx, cy - 8); g.lineTo(cx + 10, cy); g.lineTo(cx, cy + 8); g.lineTo(cx - 10, cy); g.fill(); g.fillStyle = A[0]; g.beginPath(); g.moveTo(cx, cy - 4);
      g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 5, cy); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, c1, W, 2);
  } else if (k === 'sanctum') { // marble with a gold seal
    g.strokeStyle = 'rgba(255,240,215,0.07)'; g.lineWidth = 1;
    for (let n = Math.floor(cam / 90) - 1; n <= Math.floor((cam + W) / 90) + 1; n++) { const hv = fh(n, 31), x = n * 90 + hv * 60 - cam, y = GROUND_TOP + 14 + fh(n, 33) * 100;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 24, y + 6 + hv * 10, x + 50 + hv * 20, y - 4 + fh(n, 35) * 10); g.stroke(); }
    const per = 620; for (let n = Math.floor((cam - 140) / per); n <= Math.floor((cam + W + 140) / per); n++) {
      const cx = n * per + 310 - cam; if (cx < -150 || cx > W + 150) continue;
      g.save(); g.translate(cx, 208); g.scale(1, 0.26); g.globalAlpha = 0.62; g.strokeStyle = A[0]; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 112, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 102, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 58, 0, 7); g.stroke();
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 104, Math.sin(a) * 104); g.lineTo(Math.cos(a) * 110, Math.sin(a) * 110); g.stroke(); }
      for (let s = 0; s < 2; s++) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = s * Math.PI / 3 + i * 2.094 - Math.PI / 2; g.lineTo(Math.cos(a) * 98, Math.sin(a) * 98); } g.closePath(); g.stroke(); }
      g.fillStyle = A[1]; g.beginPath(); g.moveTo(0, -16); g.lineTo(10, 0); g.lineTo(0, 16); g.lineTo(-10, 0); g.fill(); g.restore();
    }
  }
}
function drawAirFx(T) { // sanctum: light motes drifting through the air
  if (T.farK !== 'sanctum') return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 44; i++) { const px = ((wh(i, 5) * (W + 80) - cam * (0.25 + wh(i, 6) * 0.5) + tickN * 0.08) % (W + 80) + W + 80) % (W + 80) - 40, py = ((wh(i, 7) * H - tickN * (0.12 + wh(i, 8) * 0.3)) % H + H) % H, a = 0.25 + 0.35 * Math.abs(Math.sin(tickN * 0.03 + i * 1.7));
    g.fillStyle = `rgba(255,${200 + wh(i, 9) * 50 | 0},120,${a})`; const s = wh(i, 10) > 0.8 ? 2 : 1; g.fillRect(px | 0, py | 0, s, s); }
  g.restore();
}
/* ---- the foreground: what stands between the camera and the fight, one kind per theme (parallax 1.35, it fades out near the middle of the screen) ---- */
function drawForeground() {
  const T = TH, k = T.farK, A = T.acc || [], t = tickN;
  for (let i = -1; i < 4; i++) {
    const wx = (Math.floor(cam * 1.35 / 520) + i) * 520 + 260, x = Math.round(wx - cam * 1.35);
    const al = clamp((Math.abs(x - W / 2) - 110) / 70, 0, 1); if (al <= 0) continue;
    g.globalAlpha = al;
    if (k === 'marsh') { // hanging moss from above, reeds from below
      for (let m = -6; m <= 6; m++) { const mx = x + m * 14 + ((fh(wx + m, 41) - 0.5) * 8 | 0), ml = 22 + fh(wx + m, 43) * 48, sw = Math.sin(t * 0.025 + m + wx) * 2.5;
        g.strokeStyle = T.fg[0]; g.lineWidth = 3; g.beginPath(); g.moveTo(mx, -2); g.quadraticCurveTo(mx + sw * 0.4, ml * 0.5, mx + sw, ml); g.stroke();
        g.strokeStyle = A[4]; g.globalAlpha = al * 0.5; g.lineWidth = 1; g.beginPath(); g.moveTo(mx + 1, -2);
        g.quadraticCurveTo(mx + 1 + sw * 0.4, ml * 0.5, mx + 1 + sw, ml * 0.8); g.stroke(); g.globalAlpha = al; }
      for (let r = -7; r <= 7; r++) { const rx = x + r * 11 + (fh(wx + r, 47) - 0.5) * 6, rl = 40 + fh(wx + r, 49) * 46, lean = (fh(wx + r, 51) - 0.5) * 18 + Math.sin(t * 0.03 + r * 0.7 + wx) * 3;
        g.strokeStyle = T.fg[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(rx, H + 2); g.quadraticCurveTo(rx + lean * 0.3, H - rl * 0.5, rx + lean, H - rl); g.stroke();
        if (fh(wx + r, 53) > 0.6) { g.fillStyle = '#1e140c'; g.fillRect(rx + lean - 2, H - rl - 10, 4, 12); } }
    } else if (k === 'forge') { // a chain with a hook, a steaming pipe
      const cx0 = x - 40, len = 96 + fh(wx, 61) * 30, sw = Math.sin(t * 0.02 + wx) * 4;
      for (let y = -4, j = 0; y < len; y += 8, j++) { const px = cx0 + sw * y / len; g.strokeStyle = j % 2 ? '#2a1a14' : '#3a261c'; g.lineWidth = 2; if (j % 2) g.strokeRect(px - 3, y, 6, 9); else g.strokeRect(px - 1.5, y, 3, 9); g.fillStyle = 'rgba(255,170,90,0.25)'; g.fillRect(px - 3, y, 1, 8); }
      g.strokeStyle = '#2a1a14'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx0 + sw, len); g.lineTo(cx0 + sw, len + 14); g.arc(cx0 + sw - 8, len + 14, 8, 0, Math.PI * 1.15); g.stroke();
      g.strokeStyle = 'rgba(255,150,70,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx0 + sw + 1, len); g.lineTo(cx0 + sw + 1, len + 14); g.arc(cx0 + sw - 8, len + 14, 9, 0, Math.PI * 1.1); g.stroke();
      const px = x + 70; g.fillStyle = T.fg[1]; g.fillRect(px - 9, 0, 18, H); g.fillStyle = 'rgba(255,170,90,0.2)'; g.fillRect(px - 7, 0, 2, H); g.fillStyle = T.fg[0]; g.fillRect(px + 5, 0, 4, H);
      for (const fy of [28, 120, 214]) { g.fillStyle = T.fg[1]; g.fillRect(px - 13, fy, 26, 8); g.fillStyle = '#6a4a3a'; g.fillRect(px - 11, fy + 3, 2, 2); g.fillRect(px + 9, fy + 3, 2, 2); }
      for (let s = 0; s < 3; s++) { const p = (t * 0.015 + s / 3) % 1; g.fillStyle = `rgba(220,210,200,${(1 - p) * 0.26})`; g.beginPath(); g.arc(px + 13 + p * 14, 120 - p * 30, 3 + p * 7, 0, 7); g.fill(); }
    } else if (k === 'throne') { // an obsidian pillar edged with torch light
      g.fillStyle = T.fg[0]; g.fillRect(x - 14, 0, 28, H); g.fillStyle = T.fg[1]; g.fillRect(x - 14, 0, 4, H);
      g.fillStyle = `rgba(${T.torch},0.35)`; g.fillRect(x + 10, 0, 2, H); g.fillRect(x - 14, 0, 1, H); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x - 6, 0, 3, H);
      g.fillStyle = T.fg[0]; g.fillRect(x - 20, 0, 40, 12); g.fillRect(x - 17, 12, 34, 5); g.fillRect(x - 20, H - 14, 40, 14); g.fillStyle = T.fg[1]; g.fillRect(x - 20, H - 14, 40, 2);
      g.fillStyle = `rgba(${T.torch},0.4)`; g.fillRect(x - 20, 11, 40, 1); g.beginPath(); g.moveTo(x, 66); g.lineTo(x + 5, 74); g.lineTo(x, 82); g.lineTo(x - 5, 74); g.fill();
    } else if (k === 'sanctum') { // a gilded arch
      const ay = 60; g.fillStyle = T.fg[0]; g.beginPath(); g.rect(x - 84, -2, 168, ay + 2); g.moveTo(x + 62, ay); g.arc(x, ay, 62, 0, Math.PI, true); g.closePath(); g.fill('evenodd');
      g.fillRect(x - 84, ay, 22, H - ay); g.fillRect(x + 62, ay, 22, H - ay); g.fillStyle = T.fg[1]; g.fillRect(x - 84, ay, 3, H - ay); g.fillRect(x + 62, ay, 3, H - ay);
      g.strokeStyle = A[0]; g.lineWidth = 2.5; g.beginPath(); g.arc(x, ay, 62, Math.PI, 0); g.stroke(); g.lineWidth = 1; g.strokeStyle = A[1]; g.beginPath(); g.arc(x, ay, 57, Math.PI, 0); g.stroke();
      g.fillStyle = A[0]; g.fillRect(x - 84, ay - 2, 22, 3); g.fillRect(x + 62, ay - 2, 22, 3); g.fillRect(x - 84, H - 12, 22, 3); g.fillRect(x + 62, H - 12, 22, 3); g.beginPath(); g.moveTo(x, -2); g.lineTo(x + 6, 6); g.lineTo(x, 14); g.lineTo(x - 6, 6); g.fill();
    } else { // the castle: plain pillars
      g.fillStyle = T.fg[0]; g.fillRect(x - 12, 0, 24, H); g.fillStyle = T.fg[1]; g.fillRect(x - 12, 0, 3, H);
    }
    g.globalAlpha = 1;
  }
}
/* ---- how a chasm looks in each theme (its width is not touched) ---- */
const PITK = {
  castle: { fill: '#020104', glow: '255,90,20', ga: 0.18, e1: '#7a6a70', e2: '#a8949a', e3: '#100810', sp: '#ff8a2a' },
  marsh: { fill: '#010604', glow: '70,230,140', ga: 0.15, e1: '#364a3a', e2: '#6f8f74', e3: '#06100a', sp: '#8affb0', moss: '#3a8a4a' },
  forge: { fill: '#080202', glow: '255,110,20', ga: 0.34, e1: '#4a3228', e2: '#9a6a44', e3: '#140806', sp: '#ffb43a', lava: true },
  throne: { fill: '#050008', glow: '255,50,120', ga: 0.22, e1: '#3a2a4e', e2: '#8a5ab0', e3: '#0a0412', sp: '#ff5aa6' },
  sanctum: { fill: '#0a0612', glow: '255,215,120', ga: 0.24, e1: '#7a6a58', e2: '#f0d890', e3: '#14100c', sp: '#ffe08a', rays: true }
};

