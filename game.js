'use strict';
/* EMBERFALL — an original side-scrolling brawler.
   Everything (characters, stages, effects) is procedural and original.
   Pipeline: 480x270 pixel scene -> dynamic lighting -> WebGL CRT/bloom shader. */

const W = 480, H = 270, GROUND_TOP = 140, Y_MIN = 160, Y_MAX = 252;
const screen = document.getElementById('screen');
const off = document.createElement('canvas'); off.width = W; off.height = H;
const g = off.getContext('2d');
const lightCv = document.createElement('canvas'); lightCv.width = W; lightCv.height = H;
const lg = lightCv.getContext('2d');

/* ---------- input ---------- */
const keys = {}, pressed = {};
const KEYMAP = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  atk: ['KeyJ', 'KeyZ'], jump: ['KeyK', 'KeyX', 'Space'], magic: ['ShiftLeft', 'ShiftRight', 'KeyL', 'KeyC'], dismount: ['KeyE'], start: ['Enter']
};
addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (e.code === 'KeyF') crtOn = !crtOn;
  if (e.code === 'KeyM') muted = !muted;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  initAudio();
});
addEventListener('keyup', e => { keys[e.code] = false; });
const isDown = a => KEYMAP[a].some(c => keys[c]);
const isHit = a => KEYMAP[a].some(c => pressed[c]);
let crtOn = true, muted = false;

/* ---------- audio (tiny synth) ---------- */
let ac = null;
function initAudio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } }
function tone(type, f0, f1, dur, vol) {
  if (!ac || muted) return;
  const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur);
}
const SFX = {
  swing: () => tone('square', 420, 140, 0.09, 0.05),
  hit: () => { tone('square', 180, 50, 0.12, 0.09); tone('sawtooth', 90, 40, 0.1, 0.05); },
  big: () => { tone('sawtooth', 120, 28, 0.35, 0.12); },
  magic: () => { tone('sawtooth', 160, 900, 0.45, 0.07); tone('square', 90, 30, 0.5, 0.08); },
  pick: () => tone('sine', 600, 1000, 0.14, 0.08),
  land: () => tone('triangle', 90, 40, 0.08, 0.06),
  die: () => tone('sawtooth', 220, 30, 0.5, 0.1)
};

/* ---------- utils ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- procedural backdrops (pre-rendered, parallax) ---------- */
const LAYER_W = 960;
function makeLayer(draw, h) {
  const c = document.createElement('canvas'); c.width = LAYER_W; c.height = h || GROUND_TOP + 10;
  draw(c.getContext('2d'), c.width, c.height); return c;
}
function periodic(x, seed) { // seamless wrap by using integer-cycle sines
  let v = 0;
  for (let i = 1; i <= 6; i++) v += Math.sin(2 * Math.PI * i * x / LAYER_W + seed * i * 1.7) * (1 / i);
  return v;
}
/* ---------- themed backdrops: one set of parallax layers per stage ---------- */
const THEME_DEF = [
  { sky: ['#0a0b22', '#2a1740', '#6b2a3a'], star: '255,240,220', cloud: '130,60,110', far: '#2b1a3c', far2: '#1d1230', glow: '255,120,50', win: '#ffb05a', mid: '#170e26', tree: '#0f0819', wall: '#251830', wallRGB: [40, 24, 52], arch: '#120a1c', pil: '#3a2548', trim: '#4a3058', trim2: '#6a4a7a', ban: '#6e1d2a', ban2: '#4a121c', floor: ['#3a2a3e', '#17101d'], tile: '255,220,255', line: '10,6,16', fog: '140,100,160', fogA: 0.16, amb: '#ff9a4a', dark: 'rgba(18,12,40,0.5)', torch: '255,140,50', flame: ['#ff5a1f', '#ffb43a', '#fff1b0'], post: ['#1a1020', '#4b3558'], moon: { col: '#ffe9c8', spot: '#e6c9a8', r: 15, halo: '255,220,190', x: 380, y: 34 }, fg: ['#07040b', '#120a19'], farK: 'castle', midK: 'trees', wallK: 'gate' },
  { sky: ['#06130f', '#12302a', '#2c5a44'], star: '200,255,220', cloud: '60,120,90', far: '#10281f', far2: '#0a1a14', glow: '120,255,160', win: '#9dffb0', mid: '#0b1d16', tree: '#061410', wall: '#16281f', wallRGB: [22, 40, 31], arch: '#08140f', pil: '#2a4a38', trim: '#2e4a3a', trim2: '#4a7a5a', ban: '#2a5a3a', ban2: '#1a3a26', floor: ['#2b3b2c', '#101a12'], tile: '200,255,210', line: '4,10,6', fog: '120,200,150', fogA: 0.3, amb: '#9dffb0', dark: 'rgba(6,24,20,0.5)', torch: '120,255,160', flame: ['#2aa860', '#7aff9a', '#e8fff0'], post: ['#0d1a12', '#35523f'], moon: { col: '#d8ffe6', spot: '#b6e6c6', r: 13, halo: '170,255,200', x: 330, y: 40 }, fg: ['#030906', '#0b1a12'], farK: 'marsh', midK: 'reeds', wallK: 'marsh' },
  { sky: ['#1a0806', '#4a1408', '#a03a10'], star: '255,200,150', cloud: '160,60,30', far: '#2a100c', far2: '#1a0806', glow: '255,110,30', win: '#ffcf5a', mid: '#1c0c08', tree: '#120604', wall: '#2c1812', wallRGB: [48, 30, 24], arch: '#140806', pil: '#4a2c22', trim: '#5a3a2a', trim2: '#8a5a3a', ban: '#7a2a10', ban2: '#4a1608', floor: ['#3a2620', '#140a08'], tile: '255,190,140', line: '12,4,2', fog: '200,110,70', fogA: 0.2, amb: '#ffb43a', dark: 'rgba(30,8,4,0.45)', torch: '255,120,30', flame: ['#ff4a10', '#ffa020', '#fff0a0'], post: ['#1a0c08', '#6a4a3a'], moon: { r: 0 }, fg: ['#080302', '#1a0c08'], farK: 'forge', midK: 'pipes', wallK: 'forge' },
  { sky: ['#050210', '#1a0828', '#4a0e30'], star: '255,200,220', cloud: '120,30,70', far: '#14081c', far2: '#0a0410', glow: '255,40,60', win: '#ff4a5a', mid: '#0c0614', tree: '#060210', wall: '#160a22', wallRGB: [28, 14, 40], arch: '#08040e', pil: '#2a1440', trim: '#341a4a', trim2: '#5a2a7a', ban: '#1a0a22', ban2: '#0a0410', floor: ['#2a1634', '#0c0612'], tile: '255,160,220', line: '6,2,12', fog: '150,60,120', fogA: 0.18, amb: '#ff5a8a', dark: 'rgba(14,4,28,0.55)', torch: '255,60,90', flame: ['#d01040', '#ff4a6a', '#ffd0dc'], post: ['#0c0612', '#3a2050'], moon: { col: '#ff6a74', spot: '#d84a58', r: 34, halo: '255,80,100', x: 360, y: 52 }, fg: ['#030106', '#0c0612'], farK: 'throne', midK: 'crystals', wallK: 'throne' }
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

function themeFar(c, w, h, T) {
  c.fillStyle = T.far; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) c.lineTo(x, h - 52 - periodic(x, 1.3) * 16);
  c.lineTo(w, h); c.fill();
  const k = T.farK;
  if (k === 'castle') {
    for (const cx0 of [330, 800]) {
      glowDot(c, cx0 + 40, h - 60, 95, T.glow, 0.38);
      c.fillStyle = T.far2; c.fillRect(cx0, h - 92, 80, 52); c.fillRect(cx0 - 14, h - 112, 22, 72); c.fillRect(cx0 + 72, h - 106, 22, 66); c.fillRect(cx0 + 30, h - 124, 20, 84);
      for (let t = 0; t < 4; t++) { c.fillRect(cx0 - 14 + t * 6, h - 116, 4, 5); c.fillRect(cx0 + 72 + t * 6, h - 110, 4, 5); }
      c.beginPath(); c.moveTo(cx0 + 28, h - 124); c.lineTo(cx0 + 40, h - 146); c.lineTo(cx0 + 52, h - 124); c.fill();
      c.fillStyle = T.win; for (const [wx, wy] of [[cx0 + 10, h - 80], [cx0 + 60, h - 80], [cx0 + 38, h - 108], [cx0 - 6, h - 98], [cx0 + 80, h - 92]]) c.fillRect(wx, wy, 3, 5);
    }
    c.fillStyle = T.far2;
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 135 + rnd(-20, 20), bw = rnd(14, 26), bh = rnd(50, 95);
      c.fillStyle = T.far2; c.fillRect(x, h - 40 - bh, bw, bh + 40); c.fillRect(x - 3, h - 40 - bh, bw + 6, 4);
      for (let t = 0; t < 3; t++) c.fillRect(x - 3 + t * (bw / 2 + 1), h - 46 - bh, 4, 6);
      c.fillStyle = T.win; c.fillRect(x + bw / 2 - 1, h - 40 - bh * 0.6, 2, 4);
    }
  } else if (k === 'marsh') {
    for (let i = 0; i < 6; i++) { // gnarled giant trees with hanging moss
      const x = 70 + i * 150 + rnd(-25, 25), th = rnd(70, 105);
      c.strokeStyle = T.far2; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, h - 30); c.quadraticCurveTo(x + rnd(-14, 14), h - 30 - th * 0.55, x + rnd(-10, 10), h - 30 - th); c.stroke();
      c.lineWidth = 4;
      for (let b = 0; b < 4; b++) { const by = h - 30 - th * (0.5 + b * 0.12), dir = b % 2 ? 1 : -1; c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + dir * 14, by - 10, x + dir * (24 + b * 4), by - 4 + b * 3); c.stroke(); }
      c.fillStyle = T.far2; for (let b = 0; b < 5; b++) { c.beginPath(); c.ellipse(x + rnd(-26, 26), h - 30 - th + rnd(-6, 8), rnd(14, 24), rnd(5, 9), 0, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(80,150,110,0.5)'; c.lineWidth = 1;
      for (let m = 0; m < 6; m++) { const mx = x + rnd(-24, 24), my = h - 30 - th + 6; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + rnd(-2, 2), my + rnd(14, 30)); c.stroke(); }
    }
    { // leaning drowned watchtower
      c.save(); c.translate(560, h - 36); c.rotate(-0.08); c.fillStyle = T.far2; c.fillRect(-12, -92, 24, 92); c.fillRect(-16, -96, 32, 5);
      for (let t = 0; t < 3; t++) c.fillRect(-16 + t * 12, -102, 6, 7);
      c.fillStyle = T.win; c.fillRect(-2, -62, 4, 7); c.restore();
    }
    for (let i = 0; i < 14; i++) glowDot(c, rnd(0, w), rnd(h - 110, h - 40), 9, '160,255,190', 0.7); // will-o-wisps
  } else if (k === 'forge') {
    c.fillStyle = T.far2; c.beginPath(); c.moveTo(380, h); c.lineTo(485, h - 118); c.lineTo(500, h - 112); c.lineTo(520, h - 116); c.lineTo(545, h - 110); c.lineTo(660, h); c.fill();
    glowDot(c, 515, h - 112, 80, '255,150,40', 0.7);
    c.strokeStyle = '#ff7a20'; c.lineWidth = 2;
    for (const [ax, bx] of [[505, 470], [520, 545], [512, 498]]) { c.beginPath(); c.moveTo(ax, h - 110); c.lineTo(ax + (bx - ax) * 0.4, h - 70); c.lineTo(bx, h - 28); c.stroke(); }
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(70,46,40,0.35)'; c.beginPath(); c.ellipse(515 + i * 6, h - 130 - i * 8, 22 + i * 4, 8 + i, 0, 0, 7); c.fill(); }
    for (const cx0 of [60, 190, 760, 880]) {
      const ch = rnd(60, 90); c.fillStyle = T.far2; c.fillRect(cx0, h - 36 - ch, 14, ch + 36); c.fillRect(cx0 - 3, h - 36 - ch, 20, 5);
      glowDot(c, cx0 + 7, h - 38 - ch, 22, '255,140,40', 0.5);
    }
    const sg2 = c.createLinearGradient(0, h - 16, 0, h); sg2.addColorStop(0, 'rgba(255,120,30,0)'); sg2.addColorStop(1, 'rgba(255,120,30,0.55)'); c.fillStyle = sg2; c.fillRect(0, h - 16, w, 16);
  } else { // throne
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 105 + rnd(-15, 15), bh = rnd(70, 130), bw = rnd(10, 20);
      c.fillStyle = T.far2; c.beginPath(); c.moveTo(x - bw, h - 36); c.lineTo(x - bw * 0.3, h - 36 - bh); c.lineTo(x, h - 36 - bh - 18); c.lineTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.fill();
      c.strokeStyle = 'rgba(255,60,90,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.stroke();
    }
    { const kx = 470; glowDot(c, kx, h - 80, 70, '255,40,70', 0.45); c.fillStyle = T.far2; c.fillRect(kx - 40, h - 120, 80, 90); c.beginPath(); c.moveTo(kx - 46, h - 120); c.lineTo(kx, h - 150); c.lineTo(kx + 46, h - 120); c.fill();
      for (let t = -1; t <= 1; t++) c.fillRect(kx + t * 28 - 4, h - 140 + Math.abs(t) * 8, 8, 30);
      c.fillStyle = T.win; c.fillRect(kx - 3, h - 96, 6, 16); c.fillRect(kx - 22, h - 80, 4, 8); c.fillRect(kx + 18, h - 80, 4, 8); }
    for (let i = 0; i < 12; i++) { const sx = rnd(0, w), sy = rnd(20, h - 90), sz = rnd(3, 7); c.fillStyle = T.far2; c.beginPath(); c.moveTo(sx, sy - sz * 1.6); c.lineTo(sx + sz, sy); c.lineTo(sx, sy + sz * 1.6); c.lineTo(sx - sz, sy); c.fill(); c.fillStyle = 'rgba(255,70,100,0.6)'; c.fillRect(sx, sy - 1, 1, 2); }
  }
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
    for (const gx of [130, 350, 610, 830]) { c.beginPath(); c.arc(gx, h - 34, 13, 0, 7); c.fill(); for (let t = 0; t < 10; t++) { const a = t / 10 * Math.PI * 2; c.fillRect(gx + Math.cos(a) * 14 - 2, h - 34 + Math.sin(a) * 14 - 2, 4, 4); } c.fillStyle = T.mid; c.beginPath(); c.arc(gx, h - 34, 4, 0, 7); c.fill(); c.fillStyle = T.tree; }
    for (let x = 60; x < w; x += 160) glowDot(c, x, h - 47, 8, '255,150,50', 0.6);
  } else {
    for (let i = 0; i < 18; i++) { const x = rnd(0, w), n = 2 + (i % 3); for (let j = 0; j < n; j++) { const bx = x + j * 7, bh = rnd(14, 34); c.fillStyle = T.tree; c.beginPath(); c.moveTo(bx - 4, h - 14); c.lineTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.fill(); c.strokeStyle = 'rgba(255,60,90,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.stroke(); } }
  }
}

function themeWall(c, w, h, T) {
  c.fillStyle = T.wall; c.fillRect(0, 70, w, h - 70);
  const [r0, g0, b0] = T.wallRGB;
  for (let x = 0; x < w; x += 8) for (let y = 70; y < h; y += 8) { c.fillStyle = `rgb(${r0 + rnd(-8, 8) | 0},${g0 + rnd(-6, 6) | 0},${b0 + rnd(-8, 8) | 0})`; c.fillRect(x, y, 7, 7); }
  for (let x = 0; x < w; x += 160) {
    c.fillStyle = T.arch; c.beginPath(); c.moveTo(x + 24, h); c.lineTo(x + 24, 92); c.arc(x + 80, 92, 56, Math.PI, 0); c.lineTo(x + 136, h); c.fill();
    c.fillStyle = T.pil; c.fillRect(x, 64, 14, h - 64); c.fillRect(x - 3, 60, 20, 6);
  }
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
    } else {
      c.fillStyle = '#ff4a5a'; for (let r = 72; r < h - 10; r += 14) { c.fillRect(x + 4, r, 6, 2); c.fillRect(x + 4 + (r % 3), r + 4, 2, 5); }
      const bx = x + 71; c.fillStyle = T.ban; c.beginPath(); c.moveTo(bx, 66); c.lineTo(bx + 18, 66); c.lineTo(bx + 18, 118); c.lineTo(bx + 9, 110); c.lineTo(bx, 118); c.fill();
      c.fillStyle = '#ff4a5a'; c.fillRect(bx - 1, 64, 20, 2); c.beginPath(); c.moveTo(bx + 3, 92); c.lineTo(bx + 3, 82); c.lineTo(bx + 6, 87); c.lineTo(bx + 9, 80); c.lineTo(bx + 12, 87); c.lineTo(bx + 15, 82); c.lineTo(bx + 15, 92); c.fill();
    }
  }
  c.fillStyle = T.trim; c.fillRect(0, h - 6, w, 6); c.fillStyle = T.trim2; c.fillRect(0, h - 6, w, 1);
}

const THEMES = THEME_DEF.map(T => Object.assign({}, T, {
  skyL: makeLayer((c, w, h) => themeSky(c, w, h, T)),
  farL: makeLayer((c, w, h) => themeFar(c, w, h, T)),
  midL: makeLayer((c, w, h) => themeMid(c, w, h, T)),
  wallL: makeLayer((c, w, h) => themeWall(c, w, h, T), GROUND_TOP + 6)
}));

/* ---------- game state ---------- */
let mode = 'title', cam = 0, lockX = Infinity, hero, enemies, items, parts, shake = 0, freeze = 0;
let score = 0, waveIdx = 0, goBlink = 0, tickN = 0, lastEnemy = null, endTimer = 0, msg = '', msgT = 0;
let mounts = [], dragon = null, impT = 240, flashA = 0;
/* ---------- campaign data: story, stages, bosses ---------- */
const BOSSES = { boss: 1, witch: 1, smith: 1, king: 1 };
const isBoss = e => !!BOSSES[e.kind];
const STORY = {
  intro: [
    'For a thousand years the Ember Wardens kept the Heart-Ember burning: the small, stubborn flame that keeps the whole world warm.',
    'Then the Cinder King, first among the Wardens, swore a new vow: that all fire should be his alone. He tore the Heart-Ember from its altar.',
    'Ash fell on every road. The dead rose as husks, the villages went dark, and the sun forgot the sky above Ashhold.',
    'One Warden remains. Kestrel carries a sword and an old promise: to save the world from the monsters of the ash.'
  ],
  ending: [
    'The Cinder King falls. The Heart-Ember slips from his chest and rises, small and bright and warm.',
    'Kestrel carries it down the black stair, past the cold forge, through the clearing marsh and the open gate.',
    'At the altar of Ashhold the flame takes hold, and dawn breaks over the world for the first time in ten years.',
    'The husks lie still. The villages light their lamps. The Ashen Vow is kept, and the world is saved.'
  ]
};
const STAGES = [
  { name: 'THE BROKEN GATE', tag: 'THE CINDER COLOSSUS BARS THE ROAD NORTH', theme: 0, end: 2700, tint: null,
    waves: [{ x: 260, e: ['h', 'h'] }, { x: 760, e: ['h', 'h', 'h'] }, { x: 1300, e: ['h', 'b', 'h'] }, { x: 1850, e: ['h', 'h', 'b', 'h'] }, { x: 2300, e: ['boss', 'h', 'h'] }],
    clear: ['The Cinder Colossus crumbles into cold slag, and the Broken Gate stands open at last.', 'North of Ashhold the road sinks into the Sunken Marsh, where the Mire Matron whispers the drowned dead awake.'] },
  { name: 'THE SUNKEN MARSH', tag: 'THE MIRE MATRON STIRS THE DROWNED DEAD', theme: 1, end: 2900, tint: { skin: '#5f7f62', hair: '#1c2a20', armor: '#2f4a3a', armor2: '#7aff9a', cloth: '#1c2a22' },
    waves: [{ x: 260, e: ['h', 'h', 'h'] }, { x: 800, e: ['b', 'h', 'h'] }, { x: 1350, e: ['h', 'h', 'b', 'h'] }, { x: 1900, e: ['b', 'b', 'h'] }, { x: 2450, e: ['witch', 'h'] }],
    clear: ['The Mire Matron\'s lantern gutters out. The mist thins, and the drowned villages sleep again.', 'Far ahead the sky glows red: the Ember Forge, where the Cinder King hammers out his armies.'] },
  { name: 'THE EMBER FORGE', tag: 'THE FORGEMASTER HAMMERS OUT AN ARMY', theme: 2, end: 3050, tint: { skin: '#7a5a4a', hair: '#2a1a16', armor: '#5a3a2e', armor2: '#ffcf5a', cloth: '#2a1a16' },
    waves: [{ x: 260, e: ['h', 'h', 'b'] }, { x: 820, e: ['b', 'h', 'h', 'h'] }, { x: 1380, e: ['b', 'b', 'h', 'h'] }, { x: 1950, e: ['h', 'h', 'h', 'b', 'h'] }, { x: 2550, e: ['smith', 'h', 'h'] }],
    clear: ['The Forgemaster\'s hammer falls silent, and the furnaces cool for the first time in ten years.', 'Beyond the forge a black stair climbs into the storm. At its top waits the Obsidian Throne, and the Cinder King.'] },
  { name: 'THE OBSIDIAN THRONE', tag: 'THE CINDER KING WAITS WITH THE HEART-EMBER', theme: 3, end: 3150, tint: { skin: '#6a5a7a', hair: '#120a1c', armor: '#2a1a3a', armor2: '#ff6a9a', cloth: '#1a1022' },
    waves: [{ x: 260, e: ['h', 'b', 'h', 'h'] }, { x: 820, e: ['b', 'b', 'h', 'h'] }, { x: 1400, e: ['h', 'h', 'b', 'b', 'h'] }, { x: 2000, e: ['b', 'b', 'b', 'h'] }, { x: 2600, e: ['king', 'h', 'h'] }],
    clear: [] }
];
let WAVES = STAGES[0].waves, STAGE_END = STAGES[0].end, TH = THEMES[0];
let stageIdx = 0, story = null, bossRef = null, stageCard = 0, clearT = 0, shots = [];

const KINDS = {
  hero: { name: 'KESTREL', hp: 140, spd: 1.5, scale: 1, h: 44, skin: '#e0a679', hair: '#c4572b', armor: '#3b6ea8', armor2: '#8cc4ff', cloth: '#7a2630', wlen: 24, wwid: 3, wcol: '#dfe9f5' },
  imp: { name: 'PILFERER', hp: 20, spd: 1.8, scale: 0.8, h: 36, skin: '#79b04a', hair: '#3a5a22', armor: '#7a5a32', armor2: '#c9962e', cloth: '#4a3320', wlen: 12, wwid: 2, wcol: '#cfd4de', windup: 99, rng: 0, dmg: 0 },
  h: { name: 'ASHEN HUSK', hp: 44, spd: 0.8, scale: 1, h: 44, skin: '#6e6a74', hair: '#2c2a30', armor: '#4a3a3a', armor2: '#ff7a2a', cloth: '#2b2226', wlen: 22, wwid: 3, wcol: '#a8743c', windup: 22, rng: 28, dmg: 9 },
  b: { name: 'CINDER BRUTE', hp: 120, spd: 0.55, scale: 1.3, h: 58, skin: '#5a5660', hair: '#1f1c22', armor: '#5a2e2e', armor2: '#ff9a3a', cloth: '#2a1c1c', wlen: 26, wwid: 6, wcol: '#6b6f78', windup: 30, rng: 40, dmg: 18 },
  boss: { name: 'THE CINDER COLOSSUS', hp: 420, spd: 0.5, scale: 2, h: 88, skin: '#4c4852', hair: '#17141a', armor: '#3a1c1c', armor2: '#ffb04a', cloth: '#221414', wlen: 32, wwid: 8, wcol: '#8a8f99', windup: 38, rng: 62, dmg: 26, poise: 70 },
  witch: { name: 'THE MIRE MATRON', hp: 400, spd: 0.9, scale: 1.55, h: 70, skin: '#6e9a58', hair: '#2a3a22', armor: '#2a1e3a', armor2: '#7aff9a', cloth: '#1c1428', wlen: 34, wwid: 3, wcol: '#5a4030', windup: 26, rng: 44, dmg: 16, poise: 60 },
  smith: { name: 'THE FORGEMASTER', hp: 560, spd: 0.45, scale: 2.1, h: 92, skin: '#6a5a52', hair: '#222222', armor: '#4a4e58', armor2: '#ff8a2a', cloth: '#2a2224', wlen: 34, wwid: 10, wcol: '#6a707c', windup: 42, rng: 70, dmg: 28, poise: 110 },
  king: { name: 'THE CINDER KING', hp: 760, spd: 0.9, scale: 1.9, h: 84, skin: '#8a7a86', hair: '#1a1018', armor: '#1a1620', armor2: '#ff6a2a', cloth: '#5a1218', wlen: 38, wwid: 5, wcol: '#2a2430', windup: 20, rng: 58, dmg: 20, poise: 90 }
};

function makeFighter(kind, x, y) {
  const k = KINDS[kind];
  return {
    kind, k, x, y, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: k.hp, maxhp: k.hp, st: 'idle', t: 0, anim: 0,
    inv: 0, flash: 0, combo: 0, queued: false, hits: new Set(), cool: rnd(20, 70), armor: k.poise || 70, mana: 0, dead: false, fade: 0, h: k.h, vases: 0, mount: null, vase: false, dir: 1, fled: false, gone: false
  };
}

function resetGame() {
  hero = makeFighter('hero', 60, 205); hero.mana = 60;
  enemies = []; items = []; parts = []; cam = 0; lockX = Infinity; score = 0; waveIdx = 0; shake = 0; freeze = 0; endTimer = 0;
  lastEnemy = null; msg = ''; msgT = 0; mounts = []; dragon = null; impT = 240; flashA = 0; shots = []; story = null; bossRef = null; stageCard = 0; clearT = 0;
}
resetGame();

/* ---------- particles ---------- */
function spawn(x, y, z, n, o) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(o.s0 || 0.5, o.s1 || 2);
    parts.push({
      x, y, z, vx: Math.cos(a) * s * (o.flat ? 1 : 1) + (o.dx || 0), vy: o.flat ? Math.sin(a) * s * 0.3 : 0,
      vz: o.up ? rnd(o.up * 0.5, o.up) : Math.sin(a) * s * 0.6, life: rnd(o.l0 || 14, o.l1 || 30), max: 30, g: o.g === undefined ? 0.12 : o.g,
      c: Array.isArray(o.c) ? o.c[Math.random() * o.c.length | 0] : o.c, size: o.size || 1, add: !!o.add
    });
  }
}
function sparks(x, y, z, big) {
  spawn(x, y, z, big ? 22 : 11, { s0: 1, s1: big ? 4 : 2.6, c: ['#fff6c8', '#ffcf5a', '#ff8a2a'], l0: 8, l1: 20, add: true, size: big ? 2 : 1 });
}
function dust(x, y, n) { spawn(x, y, 0, n, { s0: 0.3, s1: 1.2, c: ['#8d7a8f', '#6a5870'], l0: 12, l1: 26, up: 0.8, g: 0.02, flat: true, size: 2 }); }

/* ---------- combat ---------- */
function hurt(e, dmg, kind, from) {
  if (e.dead || e.inv > 0 || e.st === 'down' || e.st === 'getup') return false;
  const dir = sgn(e.x - from.x) || -from.face;
  if (e === hero && hero.mount) { // the wyrmling takes the blow for its rider
    const m = hero.mount; m.hp -= dmg; hero.flash = 4; hero.inv = 14;
    sparks(hero.x, hero.y, hero.z + 20, false); SFX.hit(); shake = Math.max(shake, 3); freeze = Math.max(freeze, 2);
    if (m.hp <= 0) {
      hero.mount = null; hero.st = 'hurt'; hero.t = 0; hero.vx = dir * 1.6; hero.inv = 60;
      spawn(hero.x, hero.y, 12, 26, { s0: 1, s1: 3.5, c: ['#ff8a2a', '#ffd070', '#c4452a'], l0: 14, l1: 30, add: true, size: 2 });
      SFX.die(); msg = 'WYRMLING LOST'; msgT = 70;
    }
    return true;
  }
  e.hp -= dmg; e.flash = 4;
  sparks(e.x, e.y, e.z + e.h * 0.6, kind === 'down');
  if (e !== hero) lastEnemy = e;
  else shake = Math.max(shake, 4);
  SFX[kind === 'down' ? 'big' : 'hit']();
  freeze = Math.max(freeze, kind === 'down' ? 7 : 3);
  shake = Math.max(shake, kind === 'down' ? 6 : 2);
  if (from === hero && !dragon) hero.mana = Math.min(100, hero.mana + dmg * 0.6);
  if (e.kind === 'imp' && e.vase) { // the pilferer drops its vase and bolts
    e.vase = false; e.fled = true; e.dir = sgn(e.x - from.x) || 1;
    items.push({ x: e.x, y: e.y, t: 0, kind: 'vase' });
  }
  let knock = kind === 'down' || e.hp <= 0;
  if (e.mount && (kind === 'down' || e.hp <= 0 || e.hp <= e.maxhp * 0.55)) { // rider thrown from its wyrmling
    const m = e.mount; e.mount = null; e.h = e.k.h;
    m.x = e.x + dir * 6; m.y = e.y; m.z = 0.01; m.vz = 3; m.face = -dir; mounts.push(m);
    spawn(e.x, e.y, 14, 10, { c: ['#ffd070', '#ff8a2a'], l0: 10, l1: 20, add: true });
    knock = true;
  }
  if (isBoss(e) && e.hp > 0) { e.armor -= dmg; if (e.armor <= 0) { e.armor = e.k.poise || 70; knock = true; } else knock = false; }
  if (knock) { e.st = 'down'; e.t = 0; e.vz = 3.2; e.vx = dir * 2.1; e.z = Math.max(e.z, 0.01); e.combo = 0; }
  else if (!isBoss(e)) { e.st = 'hurt'; e.t = 0; e.vx = dir * 1.1; }
  return true;
}
function strike(att, box, dmg, kind, targets) {
  for (const e of targets) {
    if (att.hits.has(e) || e.dead) continue;
    const dx = (e.x - att.x) * att.face;
    if (dx < box.x0 || dx > box.x1 || Math.abs(e.y - att.y) > box.dy) continue;
    if (att.z + box.z1 < e.z || att.z + box.z0 > e.z + e.h) continue;
    att.hits.add(e); hurt(e, dmg, kind, att);
  }
}
function startAttack(f, n) { f.st = 'atk'; f.combo = n; f.t = 0; f.queued = false; f.hits.clear(); f.vx = f.face * 1.3; }
const COMBO = [{ d: 15, a: 4, b: 8, dmg: 9, kind: 'hurt' }, { d: 15, a: 4, b: 8, dmg: 9, kind: 'hurt' }, { d: 25, a: 7, b: 12, dmg: 16, kind: 'down' }];

/* ---------- physics shared by knocked fighters ---------- */
function groundPhysics(f) {
  if (f.st === 'hurt') { f.x += f.vx; f.vx *= 0.88; if (++f.t > 16) { f.st = 'idle'; f.t = 0; } return true; }
  if (f.st === 'down') {
    f.x += f.vx; f.z += f.vz; f.vz -= 0.3;
    if (f.z <= 0) { f.z = 0; if (f.vz < -1.5) { f.vz *= -0.35; f.vx *= 0.6; dust(f.x, f.y, 5); SFX.land(); } else { f.vz = 0; f.vx *= 0.8; } }
    f.t++;
    if (f.hp <= 0 && !f.dead && f.z === 0 && f.t > 20) { f.dead = true; f.fade = 0; SFX.die(); if (f !== hero) { score += isBoss(f) ? 5000 : f.kind === 'b' ? 400 : 150; if (isBoss(f)) { shake = 14; flashA = 0.5; sparks(f.x, f.y, 30, true); sparks(f.x, f.y, 55, true); SFX.big(); } if (Math.random() < (f.kind === 'h' ? 0.22 : 0.6)) items.push({ x: f.x, y: f.y, t: 0, kind: 'meat' }); } }
    if (f.hp > 0 && f.t > 55) { f.st = 'getup'; f.t = 0; }
    return true;
  }
  if (f.st === 'getup') { if (++f.t > 18) { f.st = 'idle'; f.t = 0; f.inv = 40; } return true; }
  return false;
}

/* ---------- hero ---------- */
function updateHero(f) {
  f.t++; if (f.inv > 0) f.inv--; if (f.flash > 0) f.flash--;
  if (f.dead) { if (++f.fade > 90 && mode === 'play') { mode = 'gameover'; } return; }
  if (groundPhysics(f)) return;
  const mx = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0), my = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0);
  const foes = enemies, spd = f.mount ? 2.4 : f.k.spd;
  switch (f.st) {
    case 'idle': case 'walk': {
      f.vx = mx * spd; f.vy = my * spd * 0.65;
      if (mx) f.face = mx;
      f.x += f.vx; f.y = clamp(f.y + f.vy, Y_MIN, Y_MAX);
      f.st = (mx || my) ? 'walk' : 'idle'; f.anim += (mx || my) ? (f.mount ? 0.3 : 0.2) : 0;
      const wild = f.mount ? null : mounts.find(m => Math.abs(m.x - f.x) < 28 && Math.abs(m.y - f.y) < 12 && m.z < 3);
      if (isHit('jump') && wild) {
        f.mount = wild; mounts.splice(mounts.indexOf(wild), 1); SFX.pick(); sparks(f.x, f.y, 20, true);
        msg = 'RIDE!   J: FIRE   E: DISMOUNT'; msgT = 120;
      } else if (isHit('dismount') && f.mount) {
        const m = f.mount; m.x = f.x - f.face * 12; m.y = f.y; m.face = f.face; m.z = 0.01; m.vz = 2; mounts.push(m); f.mount = null;
      } else if (isHit('jump')) { f.st = 'jump'; f.vz = f.mount ? 6 : 5.4; f.vx = mx * (f.mount ? 2.2 : 1.5); f.t = 0; f.hits.clear(); }
      else if (isHit('atk')) { if (f.mount) { f.st = 'ratk'; f.t = 0; f.hits.clear(); SFX.swing(); } else startAttack(f, 0); }
      else if (isHit('magic') && f.mana >= 60 && !dragon) castDragon();
      break;
    }
    case 'atk': {
      const c = COMBO[f.combo];
      if (f.t === c.a) SFX.swing();
      if (f.t < 7) f.x += f.vx, f.vx *= 0.9;
      if (f.t >= c.a && f.t <= c.b) strike(f, { x0: 0, x1: 40, dy: 11, z0: 4, z1: 40 }, c.dmg, c.kind, foes);
      if (isHit('atk') && f.combo < 2 && f.t >= 5) f.queued = true;
      if (f.t >= c.d) { if (f.queued) startAttack(f, f.combo + 1); else { f.st = 'idle'; f.t = 0; } }
      break;
    }
    case 'ratk': { // wyrmling flame breath: three pulses
      if (f.t === 4 || f.t === 9 || f.t === 14) f.hits.clear();
      if (f.t >= 3 && f.t <= 17) {
        strike(f, { x0: 4, x1: 76, dy: 13, z0: 0, z1: 40 }, f.t >= 14 ? 14 : 8, f.t >= 14 ? 'down' : 'hurt', foes);
        spawn(f.x + f.face * 30, f.y, 14, 3, { dx: f.face * 2.6, s0: 0.3, s1: 1.2, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 8, l1: 18, g: -0.01, add: true, size: 2, flat: true });
      }
      if (f.t >= 24) { f.st = 'idle'; f.t = 0; }
      break;
    }
    case 'jump': case 'jatk': {
      f.x += f.vx; f.z += f.vz; f.vz -= 0.33; f.y = clamp(f.y + my * 0.5, Y_MIN, Y_MAX);
      if (f.st === 'jump' && isHit('atk') && !f.mount) { f.st = 'jatk'; f.t = 0; f.hits.clear(); SFX.swing(); }
      if (f.st === 'jatk') strike(f, { x0: -6, x1: 34, dy: 12, z0: -22, z1: 24 }, 11, 'down', foes);
      if (f.z <= 0) { f.z = 0; f.st = 'idle'; f.t = 0; dust(f.x, f.y, 4); SFX.land(); }
      break;
    }
    case 'magic': { if (!dragon) { f.st = 'idle'; f.t = 0; } break; }
  }
}

/* ---------- enemies ---------- */
function updateEnemy(e) {
  if (e.kind === 'imp') { updateImp(e); return; }
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; return; }
  if (groundPhysics(e)) return;
  if (e.kind === 'witch' || e.kind === 'smith' || e.kind === 'king') { updateBoss(e); return; }
  const k = e.k, spdK = (e.mount ? 1.7 : 1) * (e.kind === 'boss' && bossPhase2(e) ? 1.5 : 1), dx = hero.x - e.x, dy = hero.y - e.y;
  const heroDown = hero.dead || hero.st === 'down';
  if (e.st === 'idle' || e.st === 'walk') {
    e.face = sgn(dx) || e.face; e.cool--;
    const rng = k.rng, inRange = Math.abs(dx) < rng + 4 && Math.abs(dy) < 9;
    if (!inRange) {
      e.st = 'walk'; e.anim += 0.14 * (k.spd / 0.8 + 0.4);
      if (Math.abs(dy) > 5) e.y += sgn(dy) * k.spd * spdK * 0.7;
      const stand = rng * 0.8;
      if (Math.abs(dx) > stand) e.x += sgn(dx) * k.spd * spdK; else if (Math.abs(dx) < stand - 8) e.x -= sgn(dx) * k.spd * 0.5;
      e.y = clamp(e.y, Y_MIN, Y_MAX);
    } else e.st = 'idle';
    const attackers = enemies.filter(o => !o.dead && (o.st === 'wind' || o.st === 'eatk')).length;
    if (inRange && e.cool <= 0 && !heroDown && attackers < (e.kind === 'boss' ? 3 : 2)) { e.st = 'wind'; e.t = 0; }
  } else if (e.st === 'wind') {
    if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); }
  } else if (e.st === 'eatk') {
    if (e.t >= 2 && e.t <= 6) {
      strike(e, { x0: -4, x1: k.rng + 12, dy: e.kind === 'boss' ? 18 : 10, z0: 0, z1: k.h }, Math.round(k.dmg * (e.mount ? 1.25 : 1)), e.kind === 'h' ? 'hurt' : 'down', [hero]);
      if (e.kind === 'boss' && e.t === 3) { shake = Math.max(shake, 9); for (let i = 0; i < 18; i++) parts.push({ x: e.x + e.face * rnd(30, 90), y: e.y + rnd(-6, 6), z: 0, vx: e.face * rnd(0.5, 3), vy: 0, vz: rnd(1, 3), life: 20, max: 20, g: 0.2, c: '#ffb04a', size: 2, add: true }); }
    }
    if (e.t >= 18) { e.st = 'idle'; e.t = 0; e.cool = rnd(45, 95) * (e.kind === 'boss' ? (e.p2 ? 0.45 : 0.7) : 1); }
  }
}

/* ---------- mounts, pilferers, dragon wrath ---------- */
function makeMount(x, y, hp) { return { isMount: true, x, y, z: 0.01, vz: 3, face: 1, hp, maxhp: 70, t: 0, anim: 0, flash: 0, h: 30 }; }
function updateMounts() {
  for (const m of mounts) {
    m.t++; if (m.flash > 0) m.flash--; m.anim += 0.03;
    m.z += m.vz; m.vz -= 0.3; if (m.z <= 0) { m.z = 0; m.vz = 0; }
    m.face = sgn(hero.x - m.x) || m.face;
    if (m.t % 20 === 0) spawn(m.x + m.face * 30, m.y, 30, 1, { c: '#8a7a8a', s0: 0.1, s1: 0.3, l0: 20, l1: 34, up: 0.5, g: -0.01, size: 2 });
  }
}
function updateImp(e) {
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; return; }
  if (groundPhysics(e)) return;
  e.st = 'walk'; e.anim += e.fled ? 0.5 : 0.35; e.face = e.dir;
  e.x += e.dir * (e.fled ? 3 : 1.9); e.y = clamp(e.y + Math.sin(e.t * 0.12) * 0.35, Y_MIN, Y_MAX);
  if (e.x < cam - 140 || e.x > cam + W + 140) e.gone = true;
}
function updateImpSpawn() {
  if (mode !== 'play' || dragon || clearT > 0) return;
  if (enemies.some(e => e.kind === 'boss' && !e.dead)) return;
  if (--impT > 0) return;
  impT = rnd(900, 1500);
  if (enemies.some(e => e.kind === 'imp')) return;
  const d = Math.random() < 0.5 ? 1 : -1;
  const e = makeFighter('imp', d > 0 ? cam - 30 : cam + W + 30, rnd(Y_MIN + 6, Y_MAX - 6));
  e.dir = d; e.face = d; e.vase = true; e.st = 'walk'; enemies.push(e);
}
function castDragon() {
  const v = hero.vases;
  hero.mana -= 60; hero.vases = 0; hero.st = 'magic'; hero.t = 0; hero.inv = 190;
  dragon = { t: 0, v, mult: 1 + 0.15 * v, size: 1 + 0.15 * v };
  msg = v ? `DRAGON'S WRATH  +${v * 15}%` : "DRAGON'S WRATH"; msgT = 120; SFX.magic();
}
function stepDragon() {
  const d = dragon; d.t++;
  if (d.t === 6) tone('sawtooth', 55, 30, 1.2, 0.1);
  if (d.t < 62 && d.t % 18 === 0) { flashA = 0.35; tone('square', 220, 40, 0.2, 0.05); }
  if (d.t === 62) dragonImpact();
  if (d.t >= 128) { hero.inv = Math.max(hero.inv, 30); dragon = null; }
}
function dragonImpact() {
  const d = dragon, dmg = 130 * d.mult; shots = [];
  hero.st = 'idle'; hero.t = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    e.inv = 0; if (e.st === 'down' || e.st === 'getup') e.st = 'idle';
    hurt(e, dmg, 'down', { x: cam + W / 2, face: 1 });
  }
  shake = 22; freeze = 8; flashA = 1;
  SFX.big(); tone('sawtooth', 70, 20, 0.9, 0.14);
  for (let i = 0; i < 3; i++) parts.push({ ring: true, x: cam + W / 2, y: 215, z: 4, life: 26 + i * 6, max: 26 + i * 6 });
  const n = 70 + d.v * 30;
  for (let i = 0; i < n; i++) {
    parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 8), vx: rnd(-1.5, 1.5), vy: 0, vz: rnd(2, 6.5), life: rnd(24, 50), max: 50, g: 0.22, c: ['#4a3a50', '#6a5870', '#2a2030'][i % 3], size: i % 4 ? 2 : 3, add: false });
    if (i % 2) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 6), vx: rnd(-1, 1), vy: 0, vz: rnd(1, 4), life: rnd(16, 34), max: 34, g: 0.05, c: ['#fff1b0', '#ffb43a', '#ff5a1f'][i % 3], size: 2, add: true });
  }
}

/* ---------- campaign flow: story screens, stages ---------- */
function wrapText(s, n) {
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
function openStory(title, sub, paras, next, themeIdx) {
  if (!paras.length) { next(); return; }
  story = { title, sub, paras, pi: 0, ci: 0, next, theme: themeIdx }; mode = 'story';
}
function updateStory() {
  const s = story; if (!s) { mode = 'play'; return; }
  const p = s.paras[s.pi];
  if (s.ci < p.length) s.ci += 1.6;
  if (isHit('start') || isHit('atk') || isHit('jump')) {
    if (s.ci < p.length) s.ci = p.length;
    else if (s.pi < s.paras.length - 1) { s.pi++; s.ci = 0; SFX.pick(); }
    else { const n = s.next; story = null; n(); return; }
  }
  updateParts(); cam += 0.2;
}
function drawStory() {
  const s = story; if (!s) return;
  const T = THEMES[s.theme];
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  tileLayer(T.skyL, 0.02, 0); tileLayer(T.farL, 0.18, 0);
  g.fillStyle = 'rgba(0,0,0,0.66)'; g.fillRect(0, 0, W, H);
  drawParts(true);
  text(s.title, W / 2, 42, 16, '#ffb43a', 'center');
  if (s.sub) text(s.sub, W / 2, 58, 9, '#c9a8ff', 'center');
  g.fillStyle = 'rgba(255,180,60,0.35)'; g.fillRect(W / 2 - 120, 66, 240, 1);
  let y = 88;
  for (let i = 0; i <= s.pi; i++) {
    const lines = wrapText(s.paras[i], 70); let rem = i < s.pi ? 1e9 : s.ci | 0;
    for (const ln of lines) {
      if (rem <= 0) break;
      text(ln.slice(0, rem), W / 2, y, 9, i === s.pi ? '#fff1d0' : '#a898b8', 'center');
      rem -= ln.length + 1; y += 12;
    }
    y += 8;
  }
  const done = s.pi === s.paras.length - 1 && s.ci >= s.paras[s.pi].length;
  if ((tickN >> 5) & 1) text(done ? 'PRESS ENTER' : '...', W / 2, 252, 9, '#ffffff', 'center');
}
function beginStage(i) {
  stageIdx = i; const S = STAGES[i]; TH = THEMES[S.theme]; WAVES = S.waves; STAGE_END = S.end;
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null;
  impT = 240; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 190; flashA = 0; shake = 0; freeze = 0;
  hero.x = 60; hero.y = 205; hero.z = 0; hero.vx = 0; hero.vz = 0; hero.st = 'idle'; hero.t = 0; hero.mount = null; hero.inv = 90; hero.hits.clear();
  if (!hero.dead && i > 0) hero.hp = Math.min(hero.maxhp, hero.hp + 70);
  mode = 'play';
}
function startCampaign() {
  resetGame(); stageIdx = 0; TH = THEMES[0];
  openStory('THE ASHEN VOW', 'A TALE OF EMBERFALL', STORY.intro, () => beginStage(0), 0);
}
function continueStage() {
  const keep = score; hero = makeFighter('hero', 60, 205); hero.mana = 60; score = keep; beginStage(stageIdx);
}
function stageCleared() {
  const S = STAGES[stageIdx]; score += 3000;
  if (stageIdx < STAGES.length - 1) openStory(`STAGE ${stageIdx + 1} CLEARED`, S.name, S.clear, () => beginStage(stageIdx + 1), STAGES[stageIdx + 1].theme);
  else openStory('THE END', 'EMBERFALL', STORY.ending, () => { mode = 'victory'; endTimer = 0; TH = THEMES[3]; }, 3);
}

/* ---------- boss AI & projectiles ---------- */
const WINDUP = { swipe: 22, spit: 28, summon: 46, smash: 40, charge: 36, quake: 34, slash: 18, blink: 24, meteor: 56 };
function bossPhase2(e) {
  if (!e.p2 && e.hp < e.maxhp * 0.5) { e.p2 = true; e.cool = 30; shake = 12; flashA = 0.4; freeze = 10; msg = 'ENRAGED!'; msgT = 80; sparks(e.x, e.y, e.h * 0.6, true); SFX.big(); }
  return !!e.p2;
}
function updateBoss(e) {
  const k = e.k, dx = hero.x - e.x, dy = hero.y - e.y, adx = Math.abs(dx), ady = Math.abs(dy);
  const heroDown = hero.dead || hero.st === 'down';
  const p2 = bossPhase2(e);
  if (e.kind === 'smith' && e.t % 9 === 0) spawn(e.x - e.face * 8, e.y, e.h * 0.95, 1, { c: ['#5a504c', '#3a3230'][(e.t / 9 | 0) % 2], s0: 0.05, s1: 0.25, l0: 26, l1: 44, up: 0.7, g: -0.012, size: 3 });
  if (e.st === 'idle' || e.st === 'walk') {
    e.face = sgn(dx) || e.face; e.cool--;
    let walk = false;
    if (e.kind === 'witch') { // kites: keeps her distance and shoots
      let mvx = 0; if (adx < 90) mvx = -sgn(dx) * 1.4; else if (adx > 170) mvx = sgn(dx);
      if (mvx) { e.x += mvx * k.spd; walk = true; }
      if (ady > 6) { e.y += sgn(dy) * k.spd * 0.8; walk = true; }
      e.x = clamp(e.x, cam + 34, cam + W - 34);
    } else if (e.kind === 'smith') { // slow juggernaut
      if (adx > 52) { e.x += sgn(dx) * k.spd; walk = true; }
      if (ady > 6) { e.y += sgn(dy) * k.spd * 0.7; walk = true; }
    } else { // king: fast duelist
      const sp = k.spd * (p2 ? 1.5 : 1);
      if (adx > 44) { e.x += sgn(dx) * sp; walk = true; }
      if (ady > 5) { e.y += sgn(dy) * sp * 0.8; walk = true; }
    }
    e.y = clamp(e.y, Y_MIN, Y_MAX); e.st = walk ? 'walk' : 'idle'; if (walk) e.anim += 0.12;
    if (e.cool <= 0 && !heroDown) chooseBossAttack(e, adx, p2);
  } else if (e.st === 'wind') {
    e.face = sgn(dx) || e.face;
    if (e.atk === 'blink' && e.t === 1) spawn(e.x, e.y, e.h * 0.5, 16, { c: ['#ff6a9a', '#ffb0c8'], add: true, l0: 10, l1: 24 });
    if (e.atk === 'meteor' && e.t === 8) {
      const n = p2 ? 9 : 6;
      for (let i = 0; i < n; i++) shots.push({ type: 'meteor', x: i === 0 ? hero.x : clamp(hero.x + rnd(-130, 130), cam + 20, cam + W - 20), y: i === 0 ? hero.y : rnd(Y_MIN, Y_MAX), t: 0, delay: 40 + i * 6, dmg: 22 });
      tone('sawtooth', 400, 90, 0.5, 0.06);
    }
    if (e.t >= ((WINDUP[e.atk] || 20) * (p2 ? 0.8 : 1) | 0)) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); }
  } else if (e.st === 'eatk') bossAttack(e, dx, p2);
}
function chooseBossAttack(e, adx, p2) {
  const r = Math.random(); let a;
  if (e.kind === 'witch') {
    if (adx < 55) a = 'swipe';
    else if (r < 0.28 && enemies.filter(o => !o.dead && o.kind === 'h').length < 3) a = 'summon';
    else a = 'spit';
  } else if (e.kind === 'smith') {
    if (adx > 150 || (p2 && r < 0.3 && adx > 70)) a = 'charge';
    else if (adx < 100) a = (p2 || r < 0.35) ? 'quake' : 'smash';
    else a = 'smash';
  } else {
    if (adx > 140 && r < 0.75) a = 'blink';
    else if (p2 && r < 0.4) a = 'meteor';
    else if (adx < 76) a = r > 0.8 ? 'blink' : 'slash';
    else a = r < 0.5 ? 'blink' : 'slash';
  }
  e.atk = a; e.st = 'wind'; e.t = 0; e.hits.clear();
}
function bossAttack(e, dx, p2) {
  const t = e.t, end = c => { e.st = 'idle'; e.t = 0; e.cool = c; };
  switch (e.atk) {
    case 'swipe':
      if (t >= 2 && t <= 6) strike(e, { x0: -6, x1: 58, dy: 14, z0: 0, z1: e.h }, 16, 'down', [hero]);
      if (t >= 16) end(p2 ? 40 : 70);
      break;
    case 'spit':
      if (t === 1) {
        const n = p2 ? 5 : 3;
        for (let i = 0; i < n; i++) shots.push({ type: 'orb', x: e.x + e.face * 30, y: clamp(e.y + (i - (n - 1) / 2) * 12, Y_MIN, Y_MAX), z: 22, vx: e.face * (2.0 + (i % 2) * 0.5), t: 0, dmg: 12, life: 220 });
        spawn(e.x + e.face * 30, e.y, 22, 10, { c: ['#7aff9a', '#e8fff0'], add: true, l0: 8, l1: 16 }); tone('sawtooth', 300, 700, 0.18, 0.05);
      }
      if (t >= 14) end(p2 ? 45 : 80);
      break;
    case 'summon':
      if (t === 1) {
        for (let i = 0; i < 2; i++) { const f = makeFighter('h', i ? cam + W + 30 : cam - 30, rnd(Y_MIN + 6, Y_MAX - 6)); f.k = Object.assign({}, f.k, STAGES[stageIdx].tint || {}); enemies.push(f); }
        spawn(e.x, e.y, 30, 30, { c: ['#7aff9a', '#2aa860'], add: true, l0: 20, l1: 40, up: 2, g: 0.02 }); SFX.magic();
      }
      if (t >= 16) end(60);
      break;
    case 'smash':
      if (t === 3) {
        strike(e, { x0: -6, x1: 76, dy: 16, z0: 0, z1: e.h }, 24, 'down', [hero]); shake = Math.max(shake, 10); dust(e.x + e.face * 50, e.y, 10); SFX.big();
        shots.push({ type: 'wave', x: e.x + e.face * 66, y: e.y, z: 0, vx: e.face * 3.2, t: 0, dmg: 14, life: 100 });
      }
      if (p2 && t === 14) shots.push({ type: 'wave', x: e.x + e.face * 66, y: e.y, z: 0, vx: e.face * 2.4, t: 0, dmg: 14, life: 100 });
      if (t >= 24) end(p2 ? 50 : 85);
      break;
    case 'charge':
      if (t === 1) { e.dir = sgn(dx) || e.face; e.face = e.dir; }
      if (t <= 46) {
        e.x = clamp(e.x + e.dir * 5.2, cam + 24, cam + W - 24); e.anim += 0.5; shake = Math.max(shake, 2);
        if (t % 12 === 1) e.hits.clear();
        strike(e, { x0: -10, x1: 46, dy: 16, z0: 0, z1: e.h }, 20, 'down', [hero]);
        if (t % 3 === 0) { sparks(e.x, e.y, 6, false); dust(e.x - e.dir * 10, e.y, 2); }
      }
      if (t >= 52) end(100);
      break;
    case 'quake':
      if (t === 4 || (p2 && t === 14)) { shots.push({ type: 'ring', x: e.x, y: e.y, r: 8, t: 0, dmg: 18, hit: false }); shake = Math.max(shake, 10); dust(e.x, e.y, 12); SFX.big(); }
      if (t >= 24) end(p2 ? 50 : 80);
      break;
    case 'slash':
      if (t === 10 || (p2 && t === 20)) e.hits.clear();
      if ((t >= 2 && t <= 6) || (t >= 12 && t <= 16) || (p2 && t >= 22 && t <= 26)) strike(e, { x0: -6, x1: 66, dy: 14, z0: 0, z1: e.h }, t >= 12 ? 22 : 16, t >= 12 ? 'down' : 'hurt', [hero]);
      if (t === 12 || (p2 && t === 22)) SFX.swing();
      if (t < 8) e.x += e.face * 0.8;
      if (t >= (p2 ? 32 : 22)) end(p2 ? 35 : 65);
      break;
    case 'blink':
      if (t === 1) {
        spawn(e.x, e.y, e.h * 0.5, 22, { c: ['#ff6a9a', '#ffb0c8', '#fff'], add: true, l0: 10, l1: 26 });
        e.x = clamp(hero.x - (hero.face || 1) * 56, cam + 30, cam + W - 30); e.y = clamp(hero.y, Y_MIN, Y_MAX); e.face = sgn(hero.x - e.x) || e.face;
        spawn(e.x, e.y, e.h * 0.5, 22, { c: ['#ff6a9a', '#ffb0c8', '#fff'], add: true, l0: 10, l1: 26 }); SFX.magic();
        e.atk = 'slash'; e.st = 'wind'; e.t = (WINDUP.slash * (p2 ? 0.8 : 1) | 0) - 7;
      }
      break;
    case 'meteor':
      if (t >= 6) end(p2 ? 60 : 90);
      break;
    default: end(60);
  }
}
function updateShots() {
  for (const s of shots) {
    s.t++;
    const dx = hero.x - s.x, dy = hero.y - s.y;
    if (s.type === 'orb') {
      s.x += s.vx;
      if (s.t % 3 === 0) spawn(s.x, s.y, s.z, 1, { c: '#7aff9a', s0: 0.05, s1: 0.3, l0: 8, l1: 14, add: true, g: 0 });
      if (!hero.dead && Math.abs(dx) < 10 && Math.abs(dy) < 10 && hero.z < s.z + 10) { hurt(hero, s.dmg, 'hurt', { x: s.x, face: sgn(s.vx) || 1 }); sparks(s.x, s.y, s.z, false); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'wave') {
      s.x += s.vx;
      if (s.t % 2 === 0) spawn(s.x, s.y, 2, 1, { c: ['#ff8a2a', '#ffd070'], s0: 0.1, s1: 0.6, l0: 8, l1: 16, add: true, up: 1, g: 0.04 });
      if (!hero.dead && Math.abs(dx) < 9 && Math.abs(dy) < 10 && hero.z < 12) { hurt(hero, s.dmg, 'down', { x: s.x, face: sgn(s.vx) || 1 }); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'meteor') {
      if (s.t === s.delay) {
        shake = Math.max(shake, 8); spawn(s.x, s.y, 4, 22, { s0: 1, s1: 3.2, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 24, add: true, size: 2, up: 3 }); dust(s.x, s.y, 6); SFX.hit();
        if (!hero.dead && Math.abs(dx) < 24 && Math.abs(dy) < 14 && hero.z < 26) hurt(hero, s.dmg, 'down', { x: s.x, face: 1 });
      }
      if (s.t > s.delay + 6) s.dead = true;
    } else if (s.type === 'ring') {
      s.r += 3.2;
      if (!s.hit && !hero.dead && Math.abs(Math.hypot(dx, dy * 3) - s.r) < 10 && hero.z < 14) { s.hit = true; hurt(hero, s.dmg, 'down', { x: s.x, face: sgn(hero.x - s.x) || 1 }); }
      if (s.r > 130) s.dead = true;
    }
  }
  shots = shots.filter(s => !s.dead);
}
function drawShots() {
  for (const s of shots) {
    const x = Math.round(s.x - cam), y = Math.round(s.y);
    if (s.type === 'orb') {
      const zz = y - s.z;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 6, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, zz, 1, x, zz, 11); gr.addColorStop(0, 'rgba(160,255,190,0.9)'); gr.addColorStop(1, 'rgba(60,200,110,0)'); g.fillStyle = gr; g.fillRect(x - 11, zz - 11, 22, 22); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#0c2a18'; g.fillRect(x - 3, zz - 3, 6, 6); g.fillStyle = '#bfffd0'; g.fillRect(x - 2, zz - 2, 3, 3);
    } else if (s.type === 'wave') {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 11, 3, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowEllipse(x, y - 3, 14, 6);
      for (let i = 0; i < 4; i++) { const fh = 7 + Math.abs(Math.sin(tickN * 0.5 + i * 1.3)) * 5; g.fillStyle = i % 2 ? '#ffb43a' : '#ff6a1f'; g.fillRect(x - 8 + i * 5, y - fh, 4, fh); }
      g.globalCompositeOperation = 'source-over';
    } else if (s.type === 'meteor') {
      const p = Math.min(1, s.t / s.delay), r = 6 + 16 * p;
      if (s.t < s.delay) { g.strokeStyle = `rgba(255,${80 + (tickN % 8) * 8},40,${0.45 + 0.4 * Math.sin(tickN * 0.5)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, r, r / 3, 0, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,60,20,0.12)'; g.fill(); }
      if (s.t >= s.delay - 12 && s.t < s.delay) {
        const q = (s.t - (s.delay - 12)) / 12, sy2 = lerp(-30, y - 4, q);
        g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,170,60,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 2, sy2 - 40); g.lineTo(x, sy2); g.stroke();
        glowEllipse(x, sy2, 12, 12); g.fillStyle = '#fff1b0'; g.fillRect(x - 3, sy2 - 3, 6, 6); g.globalCompositeOperation = 'source-over';
      }
    } else if (s.type === 'ring') {
      const a = Math.max(0, 1 - s.r / 130);
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,150,50,${0.85 * a})`; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, s.r, s.r / 3, 0, 0, 7); g.stroke();
      g.strokeStyle = `rgba(255,230,160,${0.6 * a})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, s.r - 3, (s.r - 3) / 3, 0, 0, 7); g.stroke(); g.globalCompositeOperation = 'source-over';
    }
  }
}
function glowEllipse(x, y, rx, ry) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, 'rgba(255,170,60,0.55)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore();
}

/* ---------- waves / camera ---------- */
function updateStage() {
  const w = WAVES[waveIdx];
  if (w && lockX === Infinity && hero.x > w.x - 120) {
    lockX = w.x - 200 > cam ? Math.max(cam, w.x - 200) : cam;
    w.e.forEach((t, i) => {
      const side = i % 2 ? 1 : -1;
      const ex = side > 0 ? lockX + W + 30 + i * 22 : lockX - 30 - i * 22;
      { const f = makeFighter(t, ex, rnd(Y_MIN + 6, Y_MAX - 6)); if (t === 'h' && ((waveIdx === 0 && i === 0) || Math.random() < 0.4)) { f.mount = makeMount(0, 0, 70); f.hp = f.maxhp = 60; f.h = f.k.h + 12; } const tn = STAGES[stageIdx].tint; if (tn && (t === 'h' || t === 'b')) f.k = Object.assign({}, f.k, tn); enemies.push(f); }
    });
    const bk = w.e.find(t => BOSSES[t]); if (bk) { msg = KINDS[bk].name; msgT = 170; bossRef = enemies.find(e => e.kind === bk); SFX.big(); }
  }
  if (lockX !== Infinity && enemies.filter(e => e.kind !== 'imp').every(e => e.dead)) {
    lockX = Infinity; waveIdx++; goBlink = 240;
    if (waveIdx >= WAVES.length) { clearT = 150; msg = 'STAGE CLEAR'; msgT = 150; goBlink = 0; }
  }
  const target = hero.x - W * 0.42;
  const maxCam = lockX !== Infinity ? lockX : STAGE_END - W;
  cam = clamp(lerp(cam, target, 0.1), cam > maxCam ? maxCam : cam, maxCam);
  if (cam < 0) cam = 0;
  hero.x = clamp(hero.x, cam + 12, (lockX !== Infinity ? lockX : STAGE_END) + W - 12);
  hero.x = Math.min(hero.x, cam + W - 12);
}

function updateItems() {
  for (const it of items) {
    it.t++;
    if (it.kind === 'vase') {
      if (it.z === undefined) { it.z = 8; it.vz = 3; }
      it.z += it.vz; it.vz -= 0.3; if (it.z < 0) { it.z = 0; it.vz = it.vz < -1.2 ? -it.vz * 0.4 : 0; }
    }
    if (hero.dead || Math.abs(it.x - hero.x) > 16 || Math.abs(it.y - hero.y) > 14) continue;
    if (it.kind === 'vase') {
      if (it.t < 14 || hero.vases >= 3) continue;
      hero.vases++; msg = `EMBER JAR ${hero.vases}/3    WRATH +${hero.vases * 15}%`; msgT = 100;
    } else hero.hp = Math.min(hero.maxhp, hero.hp + 35);
    it.gone = true; SFX.pick();
    spawn(it.x, it.y, 10, 12, { c: it.kind === 'vase' ? '#8fd0ff' : '#9dffb0', add: true, l0: 14, l1: 24, g: -0.02 });
  }
  items = items.filter(i => !i.gone);
}

function updateParts() {
  for (const p of parts) { p.life--; if (p.ring) continue; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= p.g; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.7; } }
  parts = parts.filter(p => p.life > 0);
  if (parts.length < 300 && Math.random() < 0.5) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 90), vx: rnd(-0.2, 0.4), vy: 0, vz: rnd(0.1, 0.4), life: rnd(60, 160), max: 160, g: -0.002, c: TH.amb, size: 1, add: true, amb: true });
}

function step() {
  tickN++; flashA *= 0.88; if (flashA < 0.02) flashA = 0;
  if (mode === 'title') { if (isHit('start') || isHit('atk')) { startCampaign(); return; } updateParts(); cam += 0.3; return; }
  if (mode === 'story') { updateStory(); return; }
  if (mode === 'gameover' || mode === 'victory') { endTimer++; updateParts(); if (isHit('start') && endTimer > 30) { if (mode === 'gameover') continueStage(); else { resetGame(); TH = THEMES[0]; mode = 'title'; } } return; }
  if (freeze > 0) { freeze--; return; }
  if (dragon) { stepDragon(); if (dragon && dragon.t < 62) { updateParts(); return; } }
  updateHero(hero);
  enemies.forEach(updateEnemy); updateShots();
  enemies = enemies.filter(e => !(e.dead && e.fade > 50) && !e.gone);
  updateItems(); updateParts(); updateMounts(); updateImpSpawn(); updateStage();
  if (shake > 0) shake *= 0.86; if (shake < 0.2) shake = 0;
  if (goBlink > 0) goBlink--; if (msgT > 0) msgT--;
  if (stageCard > 0) stageCard--; if (clearT > 0 && --clearT === 0) stageCleared();
}

/* ---------- rendering ---------- */
function tileLayer(layer, par, yoff) {
  const ox = -((cam * par) % LAYER_W + LAYER_W) % LAYER_W;
  g.drawImage(layer, Math.round(ox), yoff); g.drawImage(layer, Math.round(ox) + LAYER_W, yoff);
}
const TORCH_GAP = 300;
function torchPositions() { const a = []; const s = Math.floor((cam - 60) / TORCH_GAP); for (let i = s; i < s + 4; i++) a.push(i * TORCH_GAP + 150); return a; }

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
  // torch posts
  for (const tx of torchPositions()) {
    const x = Math.round(tx - cam);
    g.fillStyle = T.post[0]; g.fillRect(x - 2, GROUND_TOP - 40, 4, 40);
    g.fillStyle = T.post[1]; g.fillRect(x - 5, GROUND_TOP - 44, 10, 5);
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

/* ---------- sprite renderer: shaded, outlined fighters ---------- */
const SW = 230, SH = 230, AX = 115, AY = 170;
const spriteCv = document.createElement('canvas'); spriteCv.width = SW; spriteCv.height = SH; const sg = spriteCv.getContext('2d');
const silCv = document.createElement('canvas'); silCv.width = SW; silCv.height = SH; const sil = silCv.getContext('2d');
const MAIN = g;
const _sh = {};
function shade(hex, a) {
  const key = hex + a; if (_sh[key]) return _sh[key];
  const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255;
  if (a < 0) { r *= 1 + a; gg *= 1 + a; b *= 1 + a; } else { r += (255 - r) * a; gg += (255 - gg) * a; b += (255 - b) * a; }
  return _sh[key] = '#' + ((1 << 24) | (r << 16) | (gg << 8) | b | 0).toString(16).slice(1);
}

function drawWeapon(g, C, kind, len) {
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  if (kind === 'hero') {
    R(-1.5, -3, 3, 10, '#4a2e1a'); R(-1.5, -3, 1, 10, '#6b4426');
    R(-6, -6, 12, 3, '#c9962e'); R(-6, -6, 12, 1, '#ffe08a'); R(-2.5, 7, 5, 3, '#c9962e');
    P([-2.6, -6, 2.6, -6, 2, -len, 0, -len - 5, -2, -len], '#a9bdd6');
    R(-1.2, -len + 2, 1.6, len - 8, '#f4fbff'); R(1, -len + 2, 1.3, len - 8, '#6f86a3');
  } else if (kind === 'h') {
    R(-1.5, -len + 4, 3, len + 6, '#6b4a2a'); R(-1.5, -len + 4, 1, len + 6, '#8a6238');
    P([1.5, -len, 10, -len - 5, 11, -len + 9, 1.5, -len + 6], '#8a8f99'); P([1.5, -len + 1, 7, -len - 2, 7, -len + 6, 1.5, -len + 5], '#b9bec8'); R(10, -len - 4, 1.4, 12, '#e8edf5');
  } else if (kind === 'b') {
    R(-2, -len + 2, 4, len + 8, '#5b3f26'); R(-2, -len + 2, 1.3, len + 8, '#7a5634');
    R(-8, -len - 10, 16, 13, '#6b6f78'); R(-8, -len - 10, 16, 3, '#a2a7b2'); R(-8, -len - 1, 16, 4, '#4a4d55'); R(-3, -len - 10, 6, 13, '#80848e');
    R(-9, -len - 7, 2, 7, '#3a3c42'); R(7, -len - 7, 2, 7, '#3a3c42');
  } else if (kind === 'witch') {
    R(-1.5, -len + 2, 3, len + 8, '#4a3626'); R(-1.5, -len + 2, 1, len + 8, '#6a5036');
    P([-1.5, -len + 2, 5, -len - 4, 8, -len + 2, 4, -len + 6], '#4a3626');
    const gl = 0.6 + Math.sin(tickN * 0.2) * 0.4;
    R(2, -len - 10, 7, 7, `rgb(${60 + gl * 40 | 0},${200 + gl * 55 | 0},${110 + gl * 40 | 0})`); R(3, -len - 9, 3, 3, '#e8fff0'); R(1, -len - 11, 9, 1, '#2a1a30');
  } else if (kind === 'smith') {
    R(-2.5, -len + 2, 5, len + 12, '#4a3626'); R(-2.5, -len + 2, 1.6, len + 12, '#6a5036'); R(-3, 2, 6, 3, '#2a2220');
    R(-12, -len - 14, 24, 18, '#6a707c'); R(-12, -len - 14, 24, 4, '#aab0bc'); R(-12, -len - 3, 24, 4, '#3a3e48'); R(-5, -len - 14, 10, 18, '#7e8490');
    const hh = 0.6 + Math.sin(tickN * 0.25) * 0.4; R(-12, -len - 10, 3, 10, `rgb(255,${100 + hh * 90 | 0},20)`); R(9, -len - 10, 3, 10, `rgb(255,${100 + hh * 90 | 0},20)`);
    R(-13, -len - 8, 1, 6, '#ffd070'); R(12, -len - 8, 1, 6, '#ffd070');
  } else if (kind === 'king') {
    R(-1.8, -3, 3.6, 11, '#2a1c22'); R(-8, -7, 16, 3, '#c9962e'); R(-8, -7, 16, 1, '#ffe08a'); R(-3, 8, 6, 3, '#c9962e');
    P([-3, -7, 3, -7, 2.4, -len, 0, -len - 8, -2.4, -len], '#2a2430'); R(-0.8, -len + 3, 1.6, len - 10, '#ff6a2a'); R(-3, -len + 3, 0.8, len - 10, '#4a4058');
    const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5;
    for (let i = 0; i < 5; i++) { const fy = -len + 6 + i * ((len - 14) / 4); P([2.4, fy, 5.5 + f2 * 2, fy - 4 - f2 * 2, 2.4, fy - 7], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else if (kind === 'imp') {
    R(-1.5, -3, 3, 6, '#4a3320'); P([-2.5, -3, 2.5, -3, 0, -len - 4], '#cfd4de'); R(-0.5, -len, 1, len - 3, '#ffffff');
  } else {
    R(-2.5, -len + 2, 5, len + 10, '#4a3322'); R(-2.5, -len + 2, 1.6, len + 10, '#6a4a31');
    P([2, -len + 4, 16, -len - 6, 20, -len + 8, 14, -len + 22, 2, -len + 18], '#7f8591'); P([2, -len + 5, 12, -len - 2, 12, -len + 12, 2, -len + 12], '#b7bdc9');
    P([-2, -len + 4, -16, -len - 6, -20, -len + 8, -14, -len + 22, -2, -len + 18], '#5c616c'); P([-2, -len + 6, -12, -len, -13, -len + 10, -2, -len + 14], '#7a808c');
    P([-3, -len + 1, 3, -len + 1, 0, -len - 10], '#cfd4de');
    R(16, -len - 4, 1.6, 22, '#f0f4fb'); R(-17.5, -len - 4, 1.6, 22, '#9aa1ad');
  }
}

function drawHuman(f, sx, sy) {
  const g = sg, k = f.k, sc = k.scale, kind = f.kind, white = f.flash > 0;
  const C = c => white ? '#ffffff' : c;
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const limb = (x0, y0, x1, y1, w, c, bx, by) => {
    const ex = (x0 + x1) / 2 + (bx || 0), ey = (y0 + y1) / 2 + (by || 0);
    g.strokeStyle = C(c); g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.lineTo(x1, y1); g.stroke();
  };
  const dk = c => shade(c, -0.38), lt = c => shade(c, 0.3);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = (kind === 'king' && f.st === 'wind' && f.atk === 'blink') ? 0.3 : (f.dead && f.fade > 8) ? Math.max(0, 1 - (f.fade - 8) / 40) : ((f.inv > 0 && f.inv < 100 && (tickN >> 2) & 1 && f === hero) ? 0.45 : 1);
  g.save(); g.translate(AX, AY); g.scale(f.face * sc, sc);
  const riding = !!f.mount, winding = f.st === 'wind', walking = f.st === 'walk' && !riding;
  const lay = f.st === 'down' && f.z === 0;
  if (lay) { g.rotate(-Math.PI / 2 * 0.92); g.translate(-4, -2); } else if (f.st === 'down') g.rotate(-0.7);
  const air = f.z > 1 && !lay && !riding, ph = f.anim;
  const la = riding ? 5 : air ? 4 : Math.sin(ph) * 5, lb = riding ? -4 : air ? -3 : -Math.sin(ph) * 5;
  const bob = walking ? Math.abs(Math.sin(ph)) * 1.5 : (f.st === 'idle' ? Math.sin(tickN * 0.07) * 0.6 : 0);
  const lean = winding ? -2 : f.st === 'atk' ? 2 : 0;
  const big = kind === 'b' || !!BOSSES[kind];

  // cape (hero) / burning cape (king)
  if (kind === 'king') {
    const sw = Math.sin(tickN * 0.14) * 3 + (walking ? -5 : 0) + (winding ? 3 : 0);
    P([-8 + lean, -37 - bob, 4 + lean, -37 - bob, -2 + sw, -4, -22 + sw, -2], '#2a0a10');
    P([-8 + lean, -37 - bob, -1 + lean, -37 - bob, -8 + sw, -5, -21 + sw, -3], k.cloth);
    for (let i = 0; i < 6; i++) { const fx = -21 + sw + i * 3.6, fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([fx, -3, fx + 2.4, -3, fx + 1.2, -3 - fh], i % 2 ? '#ff8a2a' : '#ffd070'); }
  }
  if (kind === 'hero') {
    const sw = Math.sin(tickN * 0.12) * 2 + (walking ? -4 : 0) + (air ? -5 : 0) - (f.st === 'atk' ? 2 : 0);
    P([-6 + lean, -35 - bob, 2 + lean, -35 - bob, -3 + sw, -5, -17 + sw, -3], dk(k.cloth));
    P([-6 + lean, -35 - bob, -1 + lean, -35 - bob, -7 + sw, -6, -16 + sw, -4], k.cloth);
    R(-17 + sw, -4, 14, 1, lt(k.cloth));
  }
  if (f.vase) { P([-15, -35 - bob, -8, -35 - bob, -7, -27 - bob, -9, -22 - bob, -14, -22 - bob, -16, -27 - bob], '#3a78c8'); R(-14, -37 - bob, 6, 3, '#e6c97a'); R(-14, -33 - bob, 2, 8, '#bfe6ff'); }
  // back arm
  const bax = -6 + lean, bay = -31 - bob, bhx = -7 + Math.sin(ph + 3) * (walking ? 4 : 1), bhy = -17 - bob;
  limb(bax, bay, bhx, bhy, 4, dk(k.skin), -1, 0); limb(bax, bay, (bax + bhx) / 2, (bay + bhy) / 2, 5, dk(k.armor), -1, 0);
  // legs
  const legs = [[lb, dk(k.cloth), 0.55], [la, k.cloth, 1]];
  for (const [o, c, b] of legs) {
    R(-3 + o * 0.9, -17 - bob, 6, 9, c); R(-3 + o * 0.9 + 3, -17 - bob, 3, 9, dk(c));
    R(-3 + o * 0.5, -9 - bob, 5, 6, c); R(-3 + o * 0.5, -9 - bob, 2, 6, lt(c));
    R(-4 + o * 0.9, -12 - bob, 7, 2, k.armor2); // knee guard
    R(-4 + o * 0.2, -4, 8, 4, b < 1 ? '#0e080c' : '#1c1219'); R(-4 + o * 0.2 + 5, -4, 3, 4, '#2e2230'); R(-4 + o * 0.2, -4, 8, 1, '#3a2c3c');
  }
  // tasset / loincloth
  const sw2 = walking ? Math.sin(ph) * 1.5 : 0;
  P([-7 + lean, -19 - bob, 7 + lean, -19 - bob, 6 + sw2, -9, -6 - sw2, -9], dk(k.cloth)); R(-7 + lean, -19 - bob, 14, 2, lt(k.cloth));
  if (kind === 'witch') { const rs = walking ? Math.sin(ph) * 1.5 : 0; P([-8 + lean, -22 - bob, 8 + lean, -22 - bob, 11 + rs, -2, -11 - rs, -2], k.armor); P([-8 + lean, -22 - bob, -2 + lean, -22 - bob, -4 - rs, -2, -11 - rs, -2], dk(k.armor)); R(-11 - rs, -4, 22, 2, k.armor2); for (let i = 0; i < 4; i++) R(-8 + i * 5 + rs, -3 - ((i + (tickN / 6 | 0)) % 2), 2, 3, dk(k.armor)); }
  // torso
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, -6 + lean, -18 - bob], k.armor);
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 8 + lean, -31 - bob, -8 + lean, -31 - bob], lt(k.armor));
  P([2 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, 3 + lean, -18 - bob], dk(k.armor));
  R(-1 + lean, -33 - bob, 2, 13, k.armor2); R(-5 + lean, -29 - bob, 10, 1, dk(k.armor)); R(-5 + lean, -25 - bob, 10, 1, dk(k.armor));
  R(-7 + lean, -20 - bob, 14, 3, '#2a1c22'); R(-2 + lean, -20 - bob, 4, 3, '#e6b84a'); R(-2 + lean, -20 - bob, 4, 1, '#fff0a8');
  if (kind !== 'hero') { // ember cracks
    const fl = 0.6 + Math.sin(tickN * 0.2 + f.x) * 0.4; g.globalAlpha *= 1; R(-4 + lean, -30 - bob, 1, 5, `rgb(255,${140 + fl * 80 | 0},40)`); R(3 + lean, -27 - bob, 1, 4, `rgb(255,${130 + fl * 80 | 0},40)`); R(-3 + lean, -25 - bob, 3, 1, '#ff9a3a');
  }
  if (kind === 'smith') { P([-6 + lean, -28 - bob, 6 + lean, -28 - bob, 7 + lean, -8, -7 + lean, -8], '#5a3a26'); R(-6 + lean, -28 - bob, 12, 2, '#8a5a36'); R(-5 + lean, -35 - bob, 10, 7, '#140a06'); const ff = 0.6 + Math.sin(tickN * 0.25) * 0.4; R(-4 + lean, -34 - bob, 8, 5, `rgb(255,${90 + ff * 70 | 0},20)`); R(-3 + lean, -33 - bob, 6, 2, '#ffd070'); }
  if (kind === 'king') { R(-8 + lean, -37 - bob, 16, 2, '#ff6a2a'); R(-1 + lean, -35 - bob, 2, 16, '#ff6a2a'); const kf = 0.5 + Math.sin(tickN * 0.22) * 0.5; R(-3 + lean, -31 - bob, 6, 6, `rgb(${200 + kf * 55 | 0},${40 + kf * 60 | 0},30)`); R(-2 + lean, -30 - bob, 4, 4, '#fff1b0'); }
  // neck + head
  R(-2 + lean, -39 - bob, 4, 4, dk(k.skin));
  const hx = lean, hy = -bob;
  if (kind === 'hero') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -42 + hy, 10, 4, dk(k.skin)); R(2 + hx, -48 + hy, 3, 10, lt(k.skin) === k.skin ? k.skin : shade(k.skin, 0.12));
    P([-6 + hx, -47 + hy, 6 + hx, -47 + hy, 7 + hx, -52 + hy, 3 + hx, -55 + hy, 0 + hx, -52 + hy, -4 + hx, -56 + hy, -7 + hx, -51 + hy], k.hair);
    P([-6 + hx, -47 + hy, -7 + hx, -42 + hy, -4 + hx, -42 + hy, -4 + hx, -47 + hy], dk(k.hair));
    const tail = Math.sin(tickN * 0.15) * 2 - (walking ? 2 : 0);
    P([-6 + hx, -48 + hy, -13 + hx + tail, -46 + hy, -17 + hx + tail * 1.5, -40 + hy, -9 + hx + tail, -44 + hy], k.hair);
    R(-5 + hx, -48 + hy, 10, 2, '#c9962e'); // headband
    R(2 + hx, -44 + hy, 3, 2, '#fff'); R(3 + hx, -44 + hy, 2, 2, '#1b1b2a'); R(1 + hx, -46 + hy, 4, 1, dk(k.hair)); R(4 + hx, -42 + hy, 2, 1, dk(k.skin));
  } else if (kind === 'h') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-7 + hx, -47 + hy, 7 + hx, -47 + hy, 7 + hx, -41 + hy, 5 + hx, -49 + hy, -5 + hx, -49 + hy, -7 + hx, -41 + hy], k.hair); R(-6 + hx, -50 + hy, 12, 4, k.hair); R(-6 + hx, -50 + hy, 12, 1, lt(k.hair));
    R(1 + hx, -45 + hy, 3, 2, '#ffa23a'); R(1 + hx, -45 + hy, 3, 1, '#ffe08a'); R(-1 + hx, -41 + hy, 7, 1, '#1a1418'); R(0 + hx, -40 + hy, 1, 1, '#ddd'); R(2 + hx, -40 + hy, 1, 1, '#ddd'); R(4 + hx, -40 + hy, 1, 1, '#ddd');
  } else if (kind === 'imp') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-5 + hx, -45 + hy, -13 + hx, -52 + hy, -5 + hx, -41 + hy], k.skin); P([5 + hx, -45 + hy, 13 + hx, -52 + hy, 5 + hx, -41 + hy], dk(k.skin));
    P([-4 + hx, -48 + hy, 0 + hx, -53 + hy, 4 + hx, -48 + hy], k.hair);
    R(0 + hx, -46 + hy, 5, 4, '#ffe27a'); R(3 + hx, -45 + hy, 2, 3, '#1a0a04'); R(-3 + hx, -46 + hy, 3, 3, '#ffe27a');
    R(-1 + hx, -41 + hy, 7, 2, '#2a1408'); R(0 + hx, -41 + hy, 1, 1, '#fff'); R(3 + hx, -41 + hy, 1, 1, '#fff');
  } else if (kind === 'witch') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([4 + hx, -45 + hy, 11 + hx, -41 + hy, 5 + hx, -41 + hy], dk(k.skin));
    R(1 + hx, -46 + hy, 4, 2, '#caffd8'); R(2 + hx, -46 + hy, 2, 2, '#1aa050'); R(-1 + hx, -41 + hy, 6, 1, '#1a0c14'); R(0 + hx, -40 + hy, 1, 1, '#ddd');
    P([-5 + hx, -42 + hy, -9 + hx, -34 + hy, -3 + hx, -38 + hy], k.hair); P([-3 + hx, -41 + hy, -6 + hx, -31 + hy, 0 + hx, -37 + hy], k.hair);
    P([-9 + hx, -47 + hy, 9 + hx, -47 + hy, 5 + hx, -52 + hy, 2 + hx, -66 + hy, -3 + hx, -53 + hy], k.armor);
    P([-9 + hx, -47 + hy, -3 + hx, -53 + hy, 2 + hx, -66 + hy, -1 + hx, -50 + hy], dk(k.armor));
    R(-12 + hx, -49 + hy, 24, 3, dk(k.armor)); R(-12 + hx, -49 + hy, 24, 1, lt(k.armor)); R(-6 + hx, -52 + hy, 12, 2, k.armor2);
  } else if (kind === 'smith') {
    R(-6 + hx, -49 + hy, 12, 12, '#4a4e58'); R(-6 + hx, -49 + hy, 12, 3, '#7a808c'); R(2 + hx, -49 + hy, 4, 12, '#363a44');
    R(-5 + hx, -46 + hy, 11, 3, '#0e0806'); const ef = 0.7 + Math.sin(tickN * 0.3) * 0.3; R(-4 + hx, -45 + hy, 9, 1, `rgb(255,${130 + ef * 80 | 0},30)`);
    R(-7 + hx, -52 + hy, 14, 4, '#5c616c'); R(-7 + hx, -52 + hy, 14, 1, '#9aa1ad'); R(-3 + hx, -58 + hy, 6, 6, '#3a3e48');
    R(-4 + hx, -40 + hy, 9, 3, '#2a2e36'); R(-4 + hx, -47 + hy, 1, 1, '#c8ccd6'); R(4 + hx, -47 + hy, 1, 1, '#c8ccd6');
  } else if (kind === 'king') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-6 + hx, -47 + hy, 6 + hx, -47 + hy, 6 + hx, -39 + hy, 3 + hx, -37 + hy, -3 + hx, -37 + hy, -6 + hx, -39 + hy], '#1a1620'); R(-5 + hx, -48 + hy, 11, 6, '#1a1620');
    R(1 + hx, -45 + hy, 4, 2, '#ff6a2a'); R(2 + hx, -45 + hy, 2, 1, '#fff1b0'); R(-4 + hx, -45 + hy, 3, 2, '#c8401a');
    R(-6 + hx, -50 + hy, 12, 3, '#c9962e');
    for (let i = -2; i <= 2; i++) { const ch = 6 + (2 - Math.abs(i)) * 2; P([i * 3 + hx - 1.5, -50 + hy, i * 3 + hx + 1.5, -50 + hy, i * 3 + hx, -50 - ch + hy], '#3a3040'); const fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([i * 3 + hx - 1.2, -50 - ch + hy, i * 3 + hx + 1.2, -50 - ch + hy, i * 3 + hx, -50 - ch - fh + hy], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else { // helmeted: brute & boss
    const hm = kind === 'boss' ? '#3b3640' : '#5a5660';
    R(-6 + hx, -49 + hy, 12, 12, k.skin); R(-6 + hx, -49 + hy, 12, 12, dk(k.skin));
    P([-7 + hx, -39 + hy, -7 + hx, -50 + hy, -3 + hx, -54 + hy, 3 + hx, -54 + hy, 7 + hx, -50 + hy, 7 + hx, -39 + hy, 4 + hx, -43 + hy, -4 + hx, -43 + hy], hm);
    P([-7 + hx, -50 + hy, -3 + hx, -54 + hy, 3 + hx, -54 + hy, 7 + hx, -50 + hy, 7 + hx, -48 + hy, -7 + hx, -48 + hy], lt(hm));
    R(-1 + hx, -54 + hy, 2, 11, dk(hm));
    R(1 + hx, -47 + hy, 5, 2, '#ffa23a'); R(1 + hx, -47 + hy, 5, 1, '#fff0a8'); R(-5 + hx, -47 + hy, 3, 2, '#c8681f');
    const hn = kind === 'boss' ? 1.6 : 1;
    P([-6 + hx, -50 + hy, -10 * hn + hx, -54 * (kind === 'boss' ? 1.1 : 1) + hy, -14 * hn + hx, -62 * (kind === 'boss' ? 1.15 : 1) + hy, -8 * hn + hx, -56 * (kind === 'boss' ? 1.05 : 1) + hy, -4 + hx, -52 + hy], '#e6dcc4');
    P([6 + hx, -50 + hy, 10 * hn + hx, -54 * (kind === 'boss' ? 1.1 : 1) + hy, 14 * hn + hx, -62 * (kind === 'boss' ? 1.15 : 1) + hy, 8 * hn + hx, -56 * (kind === 'boss' ? 1.05 : 1) + hy, 4 + hx, -52 + hy], '#bfb49a');
    R(-3 + hx, -41 + hy, 8, 3, dk(hm));
  }
  // front arm + weapon
  let ang = 0.5;
  if (winding) ang = -2.1 - Math.min(0.4, f.t / (k.windup || 20) * 0.4);
  else if (f.st === 'eatk') ang = lerp(-2.0, 1.4, clamp(f.t / 5, 0, 1));
  else if (f.st === 'atk') { const c = COMBO[f.combo]; const p = clamp((f.t - 1) / (c.b - 1), 0, 1); ang = f.combo === 1 ? lerp(1.6, -1.8, p) : lerp(-2.2, 1.5, p); }
  else if (f.st === 'jatk') ang = 2.3;
  else if (f.st === 'ratk') ang = 1.3;
  else if (f.st === 'magic') ang = -2.6;
  else if (walking) ang = 0.5 + Math.sin(ph) * 0.15;
  const shx = 5 + lean, shy = -32 - bob, hl = 11, bl = k.wlen;
  const hxp = shx + Math.sin(ang) * hl, hyp = shy - Math.cos(ang) * hl;
  limb(shx, shy, hxp, hyp, big ? 6 : 5, k.skin, -Math.cos(ang) * 2, -Math.sin(ang) * 2);
  limb(shx, shy, (shx + hxp) / 2, (shy + hyp) / 2, big ? 7 : 6, k.armor, 0, 0);
  R(hxp - 2, hyp - 2, 4, 4, C(dk(k.skin)) === '#ffffff' ? '#fff' : k.skin);
  g.save(); g.translate(hxp, hyp); g.rotate(ang); drawWeapon(g, C, kind, bl); g.restore();
  // front pauldron
  P([shx - 5, shy - 4, shx + 5, shy - 4, shx + 6, shy + 3, shx - 4, shy + 3], k.armor2); R(shx - 5, shy - 4, 11, 1.5, lt(k.armor2)); R(shx - 4, shy + 1, 10, 2, dk(k.armor2));
  if (kind === 'smith') { R(shx - 3, shy - 17, 5, 13, '#3a3e48'); R(shx - 4, shy - 18, 7, 2, '#5c616c'); R(-12 + lean, -52 - bob, 5, 15, '#3a3e48'); R(-13 + lean, -53 - bob, 7, 2, '#5c616c'); }
  if (kind === 'b' || kind === 'boss') { P([shx + 4, shy - 4, shx + 9, shy - 11, shx + 6, shy - 2], '#d8d0c0'); P([-9 + lean, -37 - bob, -14 + lean, -45 - bob, -6 + lean, -34 - bob], '#d8d0c0'); }
  g.restore();

  // outline: dark silhouette stamped in 4 directions, then the sprite on top
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.globalCompositeOperation = 'source-over'; sil.clearRect(0, 0, SW, SH); sil.globalAlpha = 1;
  sil.drawImage(spriteCv, 0, 0); sil.globalCompositeOperation = 'source-in'; sil.fillStyle = '#0b0610'; sil.fillRect(0, 0, SW, SH);
  const x0 = Math.round(sx) - AX, y0 = Math.round(sy - f.z) - AY;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) MAIN.drawImage(silCv, x0 + dx, y0 + dy);
  MAIN.drawImage(spriteCv, x0, y0);

  // swing trail on the main canvas
  const swinging = (f.st === 'atk' && f.t >= COMBO[f.combo].a && f.t <= COMBO[f.combo].b + 4) || (f.st === 'eatk' && f.t < 9) || f.st === 'jatk';
  if (swinging) {
    MAIN.save(); MAIN.translate(Math.round(sx), Math.round(sy - f.z)); MAIN.scale(f.face * sc, sc); MAIN.globalCompositeOperation = 'lighter';
    const a0 = f.st === 'atk' && f.combo === 1 ? 1.6 : -2.0;
    for (let w = 0; w < 3; w++) { MAIN.strokeStyle = f === hero ? `rgba(${120 + w * 40},${200 + w * 18},255,${0.28 - w * 0.07})` : `rgba(255,${130 + w * 30},50,${0.26 - w * 0.07})`; MAIN.lineWidth = 9 - w * 3; MAIN.beginPath(); MAIN.arc(shx, shy, hl + bl * 0.85, a0 - Math.PI / 2, ang - Math.PI / 2, ang < a0); MAIN.stroke(); }
    MAIN.restore();
  }
}

function drawFighter(f) {
  const sx = f.x - cam, sy = f.y;
  if (f.isMount) { drawWildMount(f, sx, sy); return; }
  const sh = clamp(1 - f.z / 90, 0.3, 1) * f.k.scale * (f.mount ? 1.7 : 1);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 12 * sh, 4 * sh, 0, 0, 7); g.fill();
  if (f.mount) {
    drawDragon(sx, sy - f.z, { face: f.face, anim: f.anim, flash: f.flash, moving: f.st === 'walk', breathe: f.st === 'ratk' || f.st === 'wind' || f.st === 'eatk' });
    drawHuman(f, sx, sy - 11);
  } else drawHuman(f, sx, sy);
  if (f.st === 'wind' && (tickN >> 1) & 1) { g.fillStyle = '#ff3b2a'; g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h * 1.0 - 8), 3, 6); g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h - 1), 3, 2); }
}

function drawWildMount(m, sx, sy) {
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 20, 5, 0, 0, 7); g.fill();
  drawDragon(sx, sy - m.z, { face: m.face, anim: m.anim, flash: m.flash, moving: false, breathe: false });
  if (!hero.mount && Math.abs(m.x - hero.x) < 80 && Math.abs(m.y - hero.y) < 24 && ((tickN >> 4) & 1)) text('K: RIDE', Math.round(sx), Math.round(sy - 52), 8, '#fff1b0', 'center');
}

function drawJar(x, y, on) {
  g.fillStyle = '#0a0610'; g.fillRect(x - 5, y - 11, 10, 12);
  g.fillStyle = on ? '#3a8ae0' : '#26324a'; g.fillRect(x - 4, y - 9, 8, 9);
  g.fillStyle = on ? '#bfe6ff' : '#3a4866'; g.fillRect(x - 3, y - 8, 2, 6);
  g.fillStyle = on ? '#e6c97a' : '#5a5030'; g.fillRect(x - 3, y - 12, 6, 3);
  if (on) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(90,170,255,0.22)'; g.fillRect(x - 9, y - 16, 18, 18); g.globalCompositeOperation = 'source-over'; }
}

function drawItems() {
  for (const it of items) {
    const x = Math.round(it.x - cam), y = Math.round(it.y);
    if (it.kind === 'vase') {
      const z = it.z || 0, yy = y - z + Math.sin(it.t * 0.1) * 1.5;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 7, 2.5, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, yy - 8, 1, x, yy - 8, 18); gr.addColorStop(0, 'rgba(90,170,255,0.5)'); gr.addColorStop(1, 'rgba(90,170,255,0)');
      g.fillStyle = gr; g.fillRect(x - 18, yy - 26, 36, 36); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#0a0610'; g.fillRect(x - 6, yy - 15, 12, 15); g.fillStyle = '#3a8ae0'; g.fillRect(x - 5, yy - 13, 10, 12);
      g.fillStyle = '#bfe6ff'; g.fillRect(x - 4, yy - 12, 2, 8); g.fillStyle = '#2a60b0'; g.fillRect(x + 1, yy - 12, 4, 11);
      g.fillStyle = '#e6c97a'; g.fillRect(x - 4, yy - 17, 8, 3); g.fillStyle = '#fff0a8'; g.fillRect(x - 4, yy - 17, 8, 1);
      continue;
    }
    const b = Math.sin(it.t * 0.1) * 2;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 7, 2.5, 0, 0, 7); g.fill();
    g.fillStyle = '#c85a3a'; g.fillRect(x - 5, y - 9 + b, 10, 7); g.fillStyle = '#f0d4b0'; g.fillRect(x + 4, y - 10 + b, 5, 3); g.fillRect(x + 7, y - 12 + b, 3, 3);
    g.fillStyle = '#e8805a'; g.fillRect(x - 4, y - 9 + b, 6, 2);
  }
}

/* small ember wyrmling (original design), drawn into the sprite canvas and outlined */
function drawDragon(sx, sy, o) {
  const g = sg, white = o.flash > 0;
  const C = c => white ? '#ffffff' : c;
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(AX, AY); g.scale(o.face, 1);
  const body = '#c4452a', belly = '#f0b070', dark = '#7a2418', light = '#e0663c', spine = '#ffd070', wing = '#8a2c3a';
  const sway = Math.sin(tickN * 0.1) * 3, st = o.moving ? Math.sin(o.anim) * 4 : 0;
  const bob = (o.moving ? Math.abs(Math.sin(o.anim)) * 1.6 : 0) + Math.sin(tickN * 0.08) * 0.6;
  P([-14, -13 - bob, -14, -7 - bob, -28 + sway, -4, -42 + sway * 1.6, -9, -38 + sway * 1.4, -15, -27 + sway, -11], dark);
  P([-38 + sway * 1.4, -15, -45 + sway * 1.7, -19, -41 + sway * 1.5, -9], spine);
  R(-10 - st, -9, 5, 9, dark); R(-11 - st, -2, 8, 2, '#2a1010'); R(10 + st, -9, 5, 9, dark); R(9 + st, -2, 8, 2, '#2a1010');
  const fl = Math.sin(tickN * (o.breathe ? 0.5 : 0.12)) * 3;
  P([-4, -22 - bob, 5, -22 - bob, 0, -38 - bob + fl, -15, -34 - bob + fl, -10, -24 - bob], wing);
  P([-4, -22 - bob, 0, -38 - bob + fl, -8, -30 - bob + fl * 0.5], dark);
  P([-18, -9 - bob, -13, -22 - bob, 0, -25 - bob, 12, -21 - bob, 18, -12 - bob, 13, -6 - bob, -14, -5 - bob], body);
  P([-14, -22 - bob, 0, -25 - bob, 12, -21 - bob, 8, -19 - bob, -8, -20 - bob], light);
  P([-12, -6 - bob, 12, -6 - bob, 15, -11 - bob, -15, -11 - bob], belly);
  for (let i = 0; i < 5; i++) { const x0 = -11 + i * 6; P([x0, -22 - bob, x0 + 4, -23 - bob, x0 + 2, -28 - bob], spine); }
  R(-12 + st, -9, 5, 9, body); R(-12 + st, -9, 2, 9, light); R(-13 + st, -2, 8, 2, '#2a1010');
  R(8 - st, -9, 5, 9, body); R(8 - st, -9, 2, 9, light); R(7 - st, -2, 8, 2, '#2a1010');
  R(-5, -26 - bob, 13, 3, '#3a2418'); R(-5, -27 - bob, 13, 1, '#c9962e');
  P([8, -18 - bob, 14, -23 - bob, 22, -35 - bob, 17, -37 - bob, 9, -27 - bob], body);
  P([14, -23 - bob, 22, -35 - bob, 19, -36 - bob, 12, -24 - bob], light);
  const jaw = o.breathe ? 6 : 1;
  P([20, -31 - bob, 33, -31 - bob + jaw, 32, -28 - bob + jaw, 19, -28 - bob], dark);
  P([17, -39 - bob, 25, -41 - bob, 35, -37 - bob, 34, -32 - bob, 20, -31 - bob, 16, -33 - bob], body);
  P([20, -39 - bob, 25, -41 - bob, 35, -37 - bob, 28, -37 - bob], light);
  if (o.breathe) { R(27, -32 - bob, 6, 3, '#ffb43a'); R(28, -32 - bob, 4, 1, '#fff1b0'); }
  R(25, -38 - bob, 3, 2, '#ffe27a'); R(27, -38 - bob, 1, 2, '#2a0a0a'); R(33, -37 - bob, 1, 1, '#2a0a0a');
  P([18, -40 - bob, 11, -47 - bob, 21, -41 - bob], '#e6dcc4'); P([20, -39 - bob, 15, -44 - bob, 22, -40 - bob], '#bfb49a');
  g.restore();
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.globalCompositeOperation = 'source-over'; sil.clearRect(0, 0, SW, SH); sil.globalAlpha = 1;
  sil.drawImage(spriteCv, 0, 0); sil.globalCompositeOperation = 'source-in'; sil.fillStyle = '#0b0610'; sil.fillRect(0, 0, SW, SH);
  const x0 = Math.round(sx) - AX, y0 = Math.round(sy) - AY;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) MAIN.drawImage(silCv, x0 + dx, y0 + dy);
  MAIN.drawImage(spriteCv, x0, y0);
}

/* the giant dragon head that smashes the arena (original design, frontal view) */
function drawGiantHead(cx, cy, s, glow) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  const lw = 2 / s;
  const shape = (pts, fill, stroke) => {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    for (let i = pts.length - 2; i >= 0; i -= 2) g.lineTo(-pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = '#12060a'; g.lineWidth = lw; g.stroke(); }
  };
  const side = (pts, fill, m) => {
    g.beginPath(); g.moveTo(pts[0] * m, pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * m, pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = '#12060a'; g.lineWidth = lw; g.stroke();
  };
  shape([0, -420, 32, -420, 42, -90, 36, -50, 0, -44], '#4a1420', true);
  for (let y = -400; y < -80; y += 22) { const hw = 32 + 10 * ((y + 420) / 330); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-hw, y, hw * 2, 3); g.fillStyle = 'rgba(200,80,60,0.12)'; g.fillRect(-hw, y + 3, hw * 2, 1); }
  shape([0, -6, 34, -14, 42, 6, 28, 24, 0, 30], '#6a1c28', true);
  shape([0, -30, 26, -30, 22, -2, 0, 2], `rgb(${50 + glow * 205 | 0},${12 + glow * 110 | 0},12)`, false);
  g.globalCompositeOperation = 'lighter';
  const mg = g.createRadialGradient(0, -14, 2, 0, -14, 20 + 36 * glow); mg.addColorStop(0, `rgba(255,170,60,${0.25 + 0.6 * glow})`); mg.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = mg; g.fillRect(-70, -70, 140, 120); g.globalCompositeOperation = 'source-over';
  for (const xx of [-20, -10, 0, 10, 20]) { g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 3, -2); g.lineTo(xx + 3, -2); g.lineTo(xx, -13); g.fill(); }
  shape([0, -150, 26, -146, 50, -120, 58, -84, 52, -52, 40, -34, 0, -30], '#8a2634', true);
  shape([0, -146, 7, -142, 10, -92, 0, -84], '#b8483a', false);
  shape([0, -80, 52, -76, 52, -52, 40, -34, 0, -30], 'rgba(40,6,16,0.38)', false);
  for (const m of [1, -1]) { g.strokeStyle = 'rgba(30,4,10,0.55)'; g.lineWidth = lw; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(m * (14 + i * 9), -130 + i * 6); g.lineTo(m * (22 + i * 9), -118 + i * 9); g.stroke(); } }
  shape([0, -78, 22, -76, 32, -56, 24, -34, 0, -32], '#b8483a', true);
  for (const xx of [-22, -14, -6, 6, 14, 22]) { g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 3.5, -31); g.lineTo(xx + 3.5, -31); g.lineTo(xx, -18); g.fill(); }
  for (const m of [1, -1]) {
    side([40, -140, 70, -190, 96, -232, 88, -176, 58, -124], '#e6dcc4', m);
    side([52, -110, 84, -138, 70, -100], '#bfb49a', m);
    side([10, -104, 50, -112, 58, -90, 24, -86], '#2a0a10', m);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(m * 36, -94, 2, m * 36, -94, 26); gr.addColorStop(0, 'rgba(255,190,60,0.6)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.fillRect(m * 36 - 26, -120, 52, 52); g.globalCompositeOperation = 'source-over';
    side([22, -96, 46, -100, 44, -90, 26, -88], '#ffd24a', m);
    g.fillStyle = '#c8300a'; g.fillRect(m * 36 - 2, -98, 4, 7);
    g.fillStyle = '#1a0508'; g.fillRect(m * 10 - 3, -62, 6, 4);
  }
  g.restore();
}

function drawDragonCast() {
  const d = dragon, t = d.t;
  const k = Math.min(1, t / 20, (128 - t) / 28);
  g.fillStyle = `rgba(8,0,22,${0.58 * k})`; g.fillRect(0, 0, W, H);
  const ca = Math.min(1, t / 24, (128 - t) / 22);
  for (let row = 0; row < 2; row++) for (let i = -1; i < 13; i++) {
    const x = i * 44 + (row ? 22 : 0) - (tickN * (0.5 + row * 0.3)) % 44, y = lerp(-30, row ? 22 : 10, ca);
    g.fillStyle = row ? `rgba(34,14,48,${0.95 * ca})` : `rgba(18,6,30,${0.98 * ca})`;
    g.beginPath(); g.arc(x, y, 30 + (i % 3) * 5, 0, 7); g.fill();
  }
  if (t < 62 && t % 18 < 3) {
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 2;
    let px = W * (0.15 + (((t / 18) | 0) * 0.37) % 0.7), py = 20; g.beginPath(); g.moveTo(px, py);
    while (py < 205) { px += rnd(-14, 14); py += rnd(16, 30); g.lineTo(px, py); }
    g.stroke(); g.globalCompositeOperation = 'source-over';
  }
  let chin = -200;
  if (t >= 30 && t < 62) { const p = (t - 30) / 32; chin = lerp(-120, 218, p * p); }
  else if (t >= 62 && t < 84) chin = 218 + Math.sin(t * 2) * 1.5;
  else if (t >= 84) { const q = clamp((t - 84) / 44, 0, 1); chin = lerp(218, -170, q * q * (3 - 2 * q)); }
  const glow = t < 62 ? clamp((t - 30) / 32, 0, 1) : Math.max(0.25, 1 - (t - 62) / 50);
  if (t >= 62 && t < 100) { g.fillStyle = `rgba(0,0,0,${0.45 * Math.min(1, (100 - t) / 20)})`; g.beginPath(); g.ellipse(W / 2, 220, 120 * d.size, 14, 0, 0, 7); g.fill(); }
  if (t >= 30 && chin > -180) drawGiantHead(W / 2, chin, 0.95 * d.size, glow);
}

function drawParts(addOnly) {
  for (const p of parts) {
    if (p.ring) { const t = 1 - p.life / p.max, r = t * 120; g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,${180 - t * 100 | 0},60,${1 - t})`; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x - cam, p.y, r, r * 0.35, 0, 0, 7); g.stroke(); g.globalCompositeOperation = 'source-over'; continue; }
    if (!!p.add !== addOnly) continue;
    const a = clamp(p.life / (p.max * 0.5), 0, 1);
    g.globalAlpha = a; g.fillStyle = p.c;
    if (addOnly) g.globalCompositeOperation = 'lighter';
    g.fillRect(Math.round(p.x - cam), Math.round(p.y - p.z), p.size, p.size);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
}

function light(x, y, r, a, col) {
  const gr = lg.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
  lg.fillStyle = gr; lg.fillRect(x - r, y - r, r * 2, r * 2);
  if (col) { g.globalCompositeOperation = 'lighter'; const g2 = g.createRadialGradient(x, y, 0, x, y, r * 0.9); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = g2; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalCompositeOperation = 'source-over'; }
}
function applyLighting() {
  lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, H);
  lg.fillStyle = TH.dark; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'destination-out';
  for (const tx of torchPositions()) { const fl = 0.85 + Math.sin(tickN * 0.31 + tx) * 0.1 + Math.random() * 0.05; light(tx - cam, GROUND_TOP - 46, 120 * fl, 0.95, `rgba(${TH.torch},${0.22 * fl})`); }
  const hf = hero; if (!hf.dead) light(hf.x - cam, hf.y - 24 - hf.z, 70, 0.55, 'rgba(120,190,255,0.10)');
  for (const e of enemies) if (!e.dead) light(e.x - cam, e.y - e.h * 0.6 - e.z, 36 * e.k.scale, 0.45, 'rgba(255,110,40,0.16)');
  for (const p of parts) if (p.add && !p.amb && p.life > 8 && p.size > 1) light(p.x - cam, p.y - p.z, 26, 0.5);
  if (hero.st === 'magic' && hero.t > 14) light(hero.x - cam, hero.y - 20, 150 - (hero.t - 14) * 2, 0.9, 'rgba(255,170,70,0.35)');
  lg.globalCompositeOperation = 'source-over';
  g.drawImage(lightCv, 0, 0);
}

function bar(x, y, w, h, v, max, c1, c2) {
  g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = c2; g.fillRect(x, y, w, h);
  g.fillStyle = c1; g.fillRect(x, y, Math.max(0, w * v / max) | 0, h);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, Math.max(0, w * v / max) | 0, 1);
}
function text(s, x, y, size, col, align) {
  g.font = `bold ${size}px "Courier New",monospace`; g.textAlign = align || 'left'; g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
}
function drawHUD() {
  text('KESTREL', 12, 18, 11, '#9fd0ff');
  bar(12, 22, 110, 7, hero.hp, hero.maxhp, '#d94a3a', '#3a1418');
  bar(12, 32, 80, 4, hero.mana, 100, hero.mana >= 60 ? '#ffd24a' : '#c08a2a', '#2e2010');
  text('SHIFT: DRAGON WRATH', 12, 46, 8, hero.mana >= 60 ? '#ffd24a' : '#6a5a40');
  for (let i = 0; i < 3; i++) drawJar(20 + i * 15, 64, i < hero.vases);
  text(hero.vases ? `+${hero.vases * 15}%` : 'JARS', 62, 61, 8, hero.vases ? '#7fd0ff' : '#5a6a80');
  if (hero.mount) { text('WYRMLING', 12, 80, 8, '#ff9a6a'); bar(12, 83, 70, 4, hero.mount.hp, hero.mount.maxhp, '#ff8a3a', '#3a1a10'); }
  text(String(score).padStart(7, '0'), W / 2, 18, 12, '#fff1b0', 'center');
  if (bossRef && !bossRef.dead && bossRef.hp > 0) { text(bossRef.k.name, W / 2, 33, 9, bossRef.p2 ? '#ff5a3a' : '#ff9a5a', 'center'); bar(W / 2 - 110, 37, 220, 6, Math.max(0, bossRef.hp), bossRef.maxhp, bossRef.p2 ? '#ff3a2a' : '#e0742a', '#3a1c10'); }
  else text('STAGE ' + (stageIdx + 1) + '  ' + STAGES[stageIdx].name, W / 2, 31, 8, '#b8a8c8', 'center');
  if (stageCard > 0) { const a = Math.min(1, stageCard / 40, (190 - stageCard) / 25); g.globalAlpha = Math.max(0, a); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 92, W, 70); text('STAGE ' + (stageIdx + 1), W / 2, 114, 12, '#ffb43a', 'center'); text(STAGES[stageIdx].name, W / 2, 138, 20, '#fff1d0', 'center'); text(STAGES[stageIdx].tag, W / 2, 154, 8, '#c9a8ff', 'center'); g.globalAlpha = 1; }
  if (lastEnemy && lastEnemy !== bossRef && !lastEnemy.dead && lastEnemy.hp > 0) { text(lastEnemy.k.name, W - 12, 18, 10, '#ffa060', 'right'); bar(W - 142, 22, 130, 7, lastEnemy.hp, lastEnemy.maxhp, '#e0742a', '#3a1c10'); }
  if (goBlink > 0 && (goBlink >> 4) & 1) { text('GO', W - 40, 120, 18, '#fff1b0', 'center'); g.fillStyle = '#fff1b0'; g.beginPath(); g.moveTo(W - 22, 105); g.lineTo(W - 8, 115); g.lineTo(W - 22, 125); g.fill(); }
  if (msgT > 0) { g.globalAlpha = Math.min(1, msgT / 30); text(msg, W / 2, 88, msg.length > 10 ? 14 : 18, '#ff8a4a', 'center'); g.globalAlpha = 1; }
}

function drawTitleOverlay() {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
  const y = 96 + Math.sin(tickN * 0.04) * 3;
  g.font = 'bold 54px "Courier New",monospace'; g.textAlign = 'center';
  g.fillStyle = '#2a0e08'; g.fillText('EMBERFALL', W / 2 + 3, y + 3);
  const gr = g.createLinearGradient(0, y - 40, 0, y); gr.addColorStop(0, '#fff1b0'); gr.addColorStop(0.5, '#ffb43a'); gr.addColorStop(1, '#e0431f');
  g.fillStyle = gr; g.fillText('EMBERFALL', W / 2, y);
  text('THE ASHEN VOW', W / 2, y + 22, 12, '#c9a8ff', 'center');
  if ((tickN >> 5) & 1) text('PRESS ENTER', W / 2, 190, 14, '#ffffff', 'center');
  text('WASD/ARROWS MOVE   J ATTACK (x3)   K JUMP   SHIFT DRAGON WRATH', W / 2, 222, 8, '#b8a8c8', 'center');
  text('K NEAR A WYRMLING = RIDE (J FIRE, E DISMOUNT)   F: CRT   M: MUTE', W / 2, 234, 8, '#b8a8c8', 'center');
}

function render() {
  if (mode === 'story') { drawStory(); return; }
  const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) * 0.6 : 0;
  g.save(); g.translate(Math.round(sx), Math.round(sy));
  drawWorld(); drawFog();
  for (const tx of torchPositions()) flame(Math.round(tx - cam), GROUND_TOP - 44, 1);
  drawItems();
  const list = [...enemies, ...mounts, hero].sort((a, b) => a.y - b.y);
  for (const f of list) drawFighter(f);
  drawShots();
  drawParts(false);
  g.restore();
  applyLighting();
  g.save(); g.translate(Math.round(sx), Math.round(sy)); drawParts(true); g.restore();
  // foreground pillars for depth (parallax 1.35)
  for (let i = -1; i < 4; i++) {
    const wx = (Math.floor(cam * 1.35 / 520) + i) * 520 + 260, x = Math.round(wx - cam * 1.35);
    // fade pillars out near screen centre so they never hide the fight
    const al = clamp((Math.abs(x - W / 2) - 110) / 70, 0, 1); if (al <= 0) continue;
    g.globalAlpha = al; g.fillStyle = TH.fg[0]; g.fillRect(x - 12, 0, 24, H); g.fillStyle = TH.fg[1]; g.fillRect(x - 12, 0, 3, H); g.globalAlpha = 1;
  }
  if (dragon) drawDragonCast();
  if (flashA > 0) { g.fillStyle = `rgba(255,240,220,${Math.min(1, flashA)})`; g.fillRect(0, 0, W, H); }
  if (mode === 'title') drawTitleOverlay();
  else drawHUD();
  if (mode === 'gameover') { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H); text('YOU HAVE FALLEN', W / 2, 120, 22, '#e0431f', 'center'); text('SCORE ' + score, W / 2, 148, 12, '#fff1b0', 'center'); text('STAGE ' + (stageIdx + 1) + ': ' + STAGES[stageIdx].name, W / 2, 164, 8, '#b8a8c8', 'center'); if (endTimer > 30) text('PRESS ENTER TO CONTINUE', W / 2, 186, 10, '#fff', 'center'); }
  if (mode === 'victory') { g.fillStyle = 'rgba(20,10,0,0.5)'; g.fillRect(0, 0, W, H); text('THE WORLD IS SAVED', W / 2, 112, 20, '#ffd24a', 'center'); text('KESTREL KEPT THE ASHEN VOW', W / 2, 132, 9, '#c9a8ff', 'center'); text('SCORE ' + score, W / 2, 148, 12, '#fff1b0', 'center'); if (endTimer > 30) text('PRESS ENTER', W / 2, 180, 10, '#fff', 'center'); }
}

/* ---------- WebGL CRT / bloom presentation ---------- */
let gl = null, glProg, glTex, uCrt, uTime;
function initGL() {
  gl = screen.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return false;
  const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float crt;uniform float time;
  const vec2 R=vec2(${W}.,${H}.);
  vec3 S(vec2 u){return texture2D(t,vec2(u.x,1.-u.y)).rgb;}
  void main(){
    vec2 c=uv*2.-1.; vec2 q=uv;
    if(crt>.5){ c*=1.+dot(c,c)*vec2(.035,.05); q=c*.5+.5; }
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
    vec3 col=S(q);
    if(crt>.5){
      vec2 px=1./R; vec3 b=vec3(0.);
      for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 s=S(q+vec2(float(i),float(j))*px*2.);b+=max(s-.55,0.);}
      col+=b/25.*1.6;
      float ca=.0008; col.r=mix(col.r,S(q+vec2(ca,0.)).r,.6); col.b=mix(col.b,S(q-vec2(ca,0.)).b,.6);
      float sl=.82+.18*sin(q.y*R.y*6.2831); col*=sl;
      float m=.9+.1*sin(q.x*R.x*6.2831); col*=m;
      float v=smoothstep(1.25,.35,length(c)); col*=mix(.55,1.,v);
      col*=1.08+.015*sin(time*60.);
    }
    gl_FragColor=vec4(pow(col,vec3(.95)),1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; } return s; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return false;
  glProg = gl.createProgram(); gl.attachShader(glProg, v); gl.attachShader(glProg, f); gl.linkProgram(glProg); gl.useProgram(glProg);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(glProg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  uCrt = gl.getUniformLocation(glProg, 'crt'); uTime = gl.getUniformLocation(glProg, 'time');
  return true;
}
function present() {
  if (gl) {
    gl.viewport(0, 0, screen.width, screen.height);
    gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.uniform1f(uCrt, crtOn ? 1 : 0); gl.uniform1f(uTime, performance.now() / 1000 % 100);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else { const c = screen.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(off, 0, 0, screen.width, screen.height); }
}
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H), dpr = Math.min(2, devicePixelRatio || 1);
  screen.style.width = Math.floor(W * s) + 'px'; screen.style.height = Math.floor(H * s) + 'px';
  screen.width = Math.floor(W * s * dpr); screen.height = Math.floor(H * s * dpr);
}
addEventListener('resize', resize);

/* ---------- main loop (fixed 60 Hz) ---------- */
if (typeof document !== 'undefined' && screen && screen.getContext) {
  if (!initGL()) gl = null;
  resize();
  let last = performance.now(), acc = 0;
  (function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= 1000 / 60) { step(); for (const k in pressed) delete pressed[k]; acc -= 1000 / 60; }
    render(); present();
    requestAnimationFrame(frame);
  })(last);
}
