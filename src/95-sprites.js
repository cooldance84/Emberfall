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

/* ---- art pass: tone ramps (cool shadows, warm lights), coloured outlines, elemental rim light ---- */
const _mx = {};
function mixHex(a, b, t) { const key = a + b + t; if (_mx[key]) return _mx[key]; const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const r = (p >> 16 & 255) * (1 - t) + (q >> 16 & 255) * t, gg = (p >> 8 & 255) * (1 - t) + (q >> 8 & 255) * t, bb = (p & 255) * (1 - t) + (q & 255) * t;
  return _mx[key] = '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb | 0).toString(16).slice(1); }
function tone(c, i) { return i === 0 ? mixHex(shade(c, -0.5), '#101830', 0.22) : i === 1 ? c : i === 2 ? mixHex(shade(c, 0.24), '#fff0d0', 0.08) : mixHex(shade(c, 0.58), '#fff6e0', 0.15); } // 0 shadow, 1 base, 2 light, 3 highlight
const olOf = c => mixHex(shade(c, -0.78), '#0a0610', 0.35);
const ELEM_RIM = { fire: '#ff9a4a', frost: '#8fe0ff', bolt: '#ffe66a' };
const BOSS_COL = { boss: '#6affe0', king: '#ff8a2a', witch: '#6aff9a', smith: '#ff8a2a', wyrm: '#ffb43a' };
const OUTL = { nolan: '#141826', panni: '#160c22', luca: '#0d1a12', h: '#141a0e', warder: '#0a121c', caller: '#140808', boss: '#1a1814', king: '#0a0608', witch: '#0a1410', smith: '#140c08' };
const BOSS_GLOW = { boss: [[3, -43, '106,255,224'], [0, -33, '106,255,224']], king: [[0, -28, '255,170,60']], witch: [[2, -46, '106,255,154'], [14, -34, '106,255,154']], smith: [[0, -31, '255,138,42'], [21, -30, '255,138,42']] };
const rimCv = document.createElement('canvas'); rimCv.width = SW; rimCv.height = SH; const rimg = rimCv.getContext('2d');
let wFlare = 0;
function rimOf(f) { // a thin light on the figure's back edge: the hero's element, gold for elites, a boss's own power, an elemental foe's element
  if (f.dead) return null;
  if (f.pn) return rpg.elem && elemTier() ? ELEM_RIM[rpg.elem] : null;
  if (f.elite) return '#e8c060';
  if (BOSSES[f.kind]) return BOSS_COL[f.kind] || null;
  const e = ENEMY_EL[f.kind]; return e ? ELEM_RIM[e] : null;
}

function drawWeapon(g, C, kind, len, gt) {
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  if (kind === 'hero') {
    R(-1.5, -3, 3, 10, '#4a2e1a'); R(-1.5, -3, 1, 10, '#6b4426');
    R(-6, -6, 12, 3, '#c9962e'); R(-6, -6, 12, 1, '#ffe08a'); R(-2.5, 7, 5, 3, '#c9962e');
    const wt = gt | 0, bc = ['#8a8f99', '#a9bdd6', '#8cc4ff', '#ffd870', '#ff7a3a', '#46e06a'][wt], b2 = ['#c8ccd6', '#f4fbff', '#e6f6ff', '#fff6d0', '#fff0a0', '#d8ffe0'][wt], b3 = ['#5a5e68', '#6f86a3', '#4a7ac8', '#c8962e', '#c8401a', '#1a7a3a'][wt];
    P([-2.6, -6, 2.6, -6, 2, -len, 0, -len - 5, -2, -len], bc);
    R(-1.2, -len + 2, 1.6, len - 8, b2); R(1, -len + 2, 1.3, len - 8, b3);
    if (wt >= 2) { g.globalCompositeOperation = 'lighter'; g.fillStyle = wt === 2 ? 'rgba(120,190,255,0.22)' : wt === 3 ? 'rgba(255,220,120,0.26)' : wt >= 5 ? 'rgba(70,224,106,0.3)' : 'rgba(255,120,50,0.3)'; g.fillRect(-4, -len - 4, 8, len); g.globalCompositeOperation = 'source-over'; }
    if (wt >= 4) { const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5; for (let i = 0; i < 4; i++) { const fy = -len + 4 + i * ((len - 12) / 3); P([2.4, fy, 5 + f2 * 2.5, fy - 4 - f2 * 2, 2.4, fy - 7], i % 2 ? (wt >= 5 ? '#46e06a' : '#ff8a2a') : (wt >= 5 ? '#b8ffc8' : '#ffd070')); } }
  } else if (kind === 'pstaff') { // Panni's staff: the crystal glows brighter with rarer weapons
    const wt = gt | 0, gc = ['#b88aff', '#d8d0e8', '#7ab0ff', '#ffd870', '#ff6aa8', '#46e06a'][wt], gl = 0.6 + Math.sin(tickN * 0.2) * 0.4;
    R(-1.2, -len + 2, 2.4, len + 12, '#4a3020'); R(-1.2, -len + 2, 0.8, len + 12, '#6a4a30');
    P([-4, -len + 2, 0, -len - 3, 4, -len + 2, 0, -len + 5], '#c9962e');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(200,170,255,${0.25 + gl * 0.25})`; g.fillRect(-5, -len - 12, 10, 10); g.globalCompositeOperation = 'source-over';
    P([0, -len - 12, 3.5, -len - 6, 0, -len - 1, -3.5, -len - 6], gc); R(-1, -len - 9, 1.5, 3, '#ffffff');
    if (wt >= 4) { const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5; P([-3, -len - 10, 0, -len - 17 - f2 * 3, 3, -len - 10], wt >= 5 ? '#b8ffc8' : '#ffd070'); }
  } else if (kind === 'dagger') {
    const wt = gt | 0, bc = ['#8a8f99', '#a9bdd6', '#8cc4ff', '#ffd870', '#ff7a3a', '#46e06a'][wt];
    R(-1.2, -2, 2.4, 6, '#2a1a12'); R(-3.5, -3, 7, 1.8, '#8a7a5a');
    P([-1.8, -3, 1.8, -3, 1.2, -len, 0, -len - 3, -1.2, -len], bc); R(-0.4, -len + 1, 0.9, len - 4, '#f4fbff');
    if (wt >= 3) { g.globalCompositeOperation = 'lighter'; g.fillStyle = wt === 3 ? 'rgba(255,220,120,0.3)' : wt >= 5 ? 'rgba(70,224,106,0.32)' : 'rgba(255,120,50,0.35)'; g.fillRect(-3, -len - 3, 6, len); g.globalCompositeOperation = 'source-over'; }
  } else if (kind === 'h') {
    R(-1.5, -len + 4, 3, len + 6, '#6b4a2a'); R(-1.5, -len + 4, 1, len + 6, '#8a6238');
    P([1.5, -len, 10, -len - 5, 11, -len + 9, 1.5, -len + 6], '#8a8f99'); P([1.5, -len + 1, 7, -len - 2, 7, -len + 6, 1.5, -len + 5], '#b9bec8'); R(10, -len - 4, 1.4, 12, '#e8edf5');
  } else if (kind === 'mace') { // Marauder's spiked club: held high before the swing
    R(-1.5, -len + 5, 3, len + 5, '#4a3322'); R(-1.5, -len + 5, 1, len + 5, '#6a4a31');
    R(-5, -len - 6, 10, 11, '#5a3e24'); R(-5, -len - 6, 10, 2, '#8a6a48'); R(2, -len - 6, 3, 11, '#3a2816'); R(-5, -len - 1, 10, 1.4, '#2a2a2e');
    P([-5, -len - 4, -9, -len - 2, -5, -len], '#c8c8c0'); P([5, -len - 4, 9, -len - 2, 5, -len], '#a0a098'); P([-2, -len - 6, 0, -len - 11, 2, -len - 6], '#d8d8d0'); P([-2, -len + 5, 0, -len + 9, 2, -len + 5], '#a0a098');
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
  } else if (kind === 'bow') {
    g.strokeStyle = C('#6a4a2a'); g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -len - 2); g.quadraticCurveTo(9, -len / 2, 0, 2); g.stroke();
    g.strokeStyle = C('#e8f4ff'); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -len - 2); g.lineTo(0, 2); g.stroke(); R(-1, -len / 2 - 2, 3, 4, '#bfe6ff');
  } else if (kind === 'bomb') {
    g.fillStyle = C('#1c1618'); g.beginPath(); g.arc(0, -6, 6, 0, 7); g.fill(); g.fillStyle = C('#4a4048'); g.beginPath(); g.arc(-2, -8, 2, 0, 7); g.fill();
    g.strokeStyle = C('#a07a4a'); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(4, -17, 2, -20); g.stroke();
    const sp = (tickN >> 1) & 1; R(1, -22, 3, 3, C(sp ? '#fff1b0' : '#ff8a2a'));
  } else if (kind === 'gsword') {
    R(-1.8, -3, 3.6, 11, '#1c1620'); R(-9, -7, 18, 3, '#6a5a9a'); R(-9, -7, 18, 1, '#b8a8ff'); R(-3, 8, 6, 3, '#6a5a9a');
    P([-4, -7, 4, -7, 3.4, -len - 4, 0, -len - 12, -3.4, -len - 4], '#8a8fb0'); R(-1, -len, 2, len - 6, '#d8dcf0'); R(2, -len, 1.4, len - 6, '#5a5e7a');
    const gl2 = 0.5 + Math.sin(tickN * 0.2) * 0.5; R(-0.8, -len + 6, 1.6, 6, `rgb(${150 + gl2 * 80 | 0},${110 + gl2 * 60 | 0},255)`);
  } else if (kind === 'staff' || kind === 'fstaff') {
    const fire = kind === 'fstaff', gl = 0.6 + Math.sin(tickN * 0.25) * 0.4;
    R(-1.2, -len + 2, 2.4, len + 10, '#3a2a22'); R(-1.2, -len + 2, 0.8, len + 10, '#5a4434');
    R(-4, -len - 1, 8, 3, fire ? '#6a2a14' : '#4a3a7a');
    g.fillStyle = C(fire ? `rgb(255,${130 + gl * 90 | 0},40)` : `rgb(${130 + gl * 60 | 0},${210 + gl * 40 | 0},255)`); g.beginPath(); g.arc(0, -len - 5, 3.6, 0, 7); g.fill();
    R(-1, -len - 6, 2, 2, '#ffffff');
    if (fire) { const fh = 7 + gl * 3 + wFlare * 9; P([-3.6, -len - 7, -1.5, -len - 7 - fh * 0.7, 0, -len - 7 - fh, 1.8, -len - 7 - fh * 0.6, 3.6, -len - 7], '#ff7a2a'); P([-2, -len - 7, 0, -len - 7 - fh * 0.62, 2, -len - 7], '#ffd070'); }
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
  const g = sg, k = f.k, sc = k.scale, kind = f.k.look || f.kind, white = f.flash > 0;
  const C = c => white ? '#ffffff' : c;
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const limb = (x0, y0, x1, y1, w, c, bx, by) => {
    const ex = (x0 + x1) / 2 + (bx || 0), ey = (y0 + y1) / 2 + (by || 0);
    g.strokeStyle = C(c); g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.lineTo(x1, y1); g.stroke();
  };
  const dk = c => tone(c, 0), lt = c => tone(c, 2), hi = c => tone(c, 3);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = (f.ghost != null && !f.dead) ? f.ghost : (kind === 'king' && f.st === 'wind' && f.atk === 'blink') ? 0.3 : (f.dead && f.fade > 8) ? Math.max(0, 1 - (f.fade - 8) / 40) : ((f.inv > 0 && f.inv < 100 && (tickN >> 2) & 1 && f.pn && !f.sk) ? 0.45 : 1);
  const brth = BOSSES[kind] && !f.dead ? 1 + Math.sin(tickN * 0.06 + f.x) * 0.018 : f.st === 'idle' && !f.dead ? 1 + Math.sin(tickN * 0.07 + f.x) * 0.012 : 1, hov = kind === 'witch' && !f.dead ? -4 - Math.sin(tickN * 0.07) * 3 : 0;
  const HC = kind === 'hero' ? (k.cls || 'nolan') : '';
  g.save(); g.translate(AX, AY + hov); g.scale(f.face * sc, sc * brth); if (HC === 'luca' && !f.mount && f.st !== 'down') g.scale(1, 0.95); // the rogue moves in a crouch
  const riding = !!f.mount, winding = f.st === 'wind', walking = f.st === 'walk' && !riding;
  const lay = f.st === 'down' && f.z === 0;
  if (lay) { g.rotate(-Math.PI / 2 * 0.92); g.translate(-4, -2); } else if (f.st === 'down') g.rotate(-0.7);
  const air = f.z > 1 && !lay && !riding, ph = f.anim;
  const la = riding ? 5 : air ? 4 : Math.sin(ph) * 5, lb = riding ? -4 : air ? -3 : -Math.sin(ph) * 5;
  const bob = walking ? Math.abs(Math.sin(ph)) * 1.5 : (f.st === 'idle' ? Math.sin(tickN * 0.07) * 0.6 : 0);
  const lean = (winding ? -2 : f.st === 'atk' ? 2 : 0) + ((HC === 'luca' && !riding && !lay) ? 1.5 : 0) + ((f.kind === 'h' && !riding && !lay) ? 2 : 0);
  const big = kind === 'b' || !!BOSSES[kind];
  const GT = (kind === 'hero' && k.gt) || {}, hT = GT.helm | 0, aT = GT.armor | 0, bT = GT.boots | 0, wT = GT.weapon | 0, amT = GT.amulet | 0;
  const ik = (x0, y0, x1, y1, l1, l2, dir) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 0.01, d = Math.min(L, l1 + l2 - 0.05), a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / L, uy = dy / L;
    return [x0 + ux * a - uy * h * dir, y0 + uy * a + ux * h * dir, x0 + ux * d, y0 + uy * d]; };
  const arm2 = (x0, y0, tx, ty, l1, l2, w, cU, cF, dir) => { const [ex, ey, hx, hy] = ik(x0, y0, tx, ty, l1, l2, dir); g.lineCap = 'round'; g.strokeStyle = C(cU);
    g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke(); g.strokeStyle = C(cF); g.lineWidth = w * 0.9; g.beginPath(); g.moveTo(ex, ey);
    g.lineTo(hx, hy); g.stroke(); g.fillStyle = C(cU); g.beginPath(); g.arc(ex, ey, w * 0.55, 0, 7); g.fill(); return [hx, hy, ex, ey]; };
  const chain = (x0, y0, n, len, sway, off, w, c) => { g.strokeStyle = C(c); g.lineCap = 'round'; let x = x0, y = y0, a = 2.5 + (walking ? 0.25 : 0);
    for (let i = 0; i < n; i++) { a += Math.sin(tickN * 0.07 + off + i * 0.7) * sway * 0.25; const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    g.lineWidth = Math.max(0.8, w * (1 - i / n)); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny; } };
  const claw = (hx, hy, ux, uy, len, spread, c, w) => { g.strokeStyle = C(c); g.lineWidth = w; g.lineCap = 'round';
    for (let q = -1; q <= 1; q++) { const ca = Math.cos(q * spread), sa = Math.sin(q * spread); g.beginPath(); g.moveTo(hx, hy);
    g.lineTo(hx + (ux * ca - uy * sa) * len, hy + (ux * sa + uy * ca) * len); g.stroke(); } };
  const bAct = BOSSES[kind] && !f.dead && !winding && !['idle', 'walk', 'hurt', 'down', 'getup', 'wind'].includes(f.st) ? 1 : 0;

  if (kind === 'king' && !f.dead) { // articulated flame wings: shoulder, elbow, wrist and three finger bones, each lagging the one before
    const fl = Math.sin(tickN * 0.11) * 0.5 + (winding ? 0.6 : 0) + (air ? 0.7 : 0);
    for (const [sc2, col, col2, lag] of [[1, 'rgba(200,50,30,0.92)', '#2a0a10', 0], [0.72, 'rgba(255,170,60,0.95)', '#4a1a10', 0.5]]) {
      const r0x = -4, r0y = -34 - bob, a1 = -2.15 + fl * 0.5 - lag * 0.1;
      const ex = r0x + Math.cos(a1) * 18 * sc2, ey = r0y + Math.sin(a1) * 18 * sc2;
      const a2 = a1 - 0.45 + Math.sin(tickN * 0.11 - 0.9 - lag) * 0.4 - (winding ? 0.3 : 0);
      const wx = ex + Math.cos(a2) * 22 * sc2, wy = ey + Math.sin(a2) * 22 * sc2;
      const tips = [0, 1, 2].map(i => { const a3 = a2 + 0.5 + i * 0.62 + fl * 0.15 + Math.sin(tickN * 0.11 - 1.6 - lag - i * 0.4) * 0.12; const L3 = (22 - i * 3) * sc2; return [wx + Math.cos(a3) * L3, wy + Math.sin(a3) * L3]; });
      P([r0x, r0y, ex, ey, wx, wy, tips[0][0], tips[0][1], tips[1][0], tips[1][1], tips[2][0], tips[2][1], -8, -26 - bob], col);
      g.strokeStyle = C(col2); g.lineWidth = 2.2 * sc2 + 0.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(r0x, r0y); g.lineTo(ex, ey); g.lineTo(wx, wy); for (const t of tips) { g.moveTo(wx, wy); g.lineTo(t[0], t[1]); } g.stroke();
      g.fillStyle = C('#ffd070'); for (const t of tips) g.fillRect(t[0] - 1, t[1] - 1, 2, 2);
    }
  }
  // cape (hero) / burning cape (king)
  if (kind === 'king') {
    const sw = Math.sin(tickN * 0.14) * 3 + (walking ? -5 : 0) + (winding ? 3 : 0);
    P([-8 + lean, -37 - bob, 4 + lean, -37 - bob, -2 + sw, -4, -22 + sw, -2], '#2a0a10');
    P([-8 + lean, -37 - bob, -1 + lean, -37 - bob, -8 + sw, -5, -21 + sw, -3], k.cloth);
    for (let i = 0; i < 6; i++) { const fx = -21 + sw + i * 3.6, fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([fx, -3, fx + 2.4, -3, fx + 1.2, -3 - fh], i % 2 ? '#ff8a2a' : '#ffd070'); }
  }
  if (kind === 'hero' && HC === 'nolan') {
    const sw = Math.sin(tickN * 0.12) * 2 + (walking ? -4 : 0) + (air ? -5 : 0) - (f.st === 'atk' ? 2 : 0);
    P([-6 + lean, -35 - bob, 2 + lean, -35 - bob, -3 + sw, -5, -17 + sw, -3], dk(k.cloth));
    P([-6 + lean, -35 - bob, -1 + lean, -35 - bob, -7 + sw, -6, -16 + sw, -4], k.cloth);
    R(-17 + sw, -4, 14, 1, lt(k.cloth)); P([-5 + lean, -34 - bob, -3 + lean, -34 - bob, -8 + sw, -6, -11 + sw, -5], lt(k.cloth));
  }
  if (f.vase) { P([-15, -35 - bob, -8, -35 - bob, -7, -27 - bob, -9, -22 - bob, -14, -22 - bob, -16, -27 - bob], '#3a78c8'); R(-14, -37 - bob, 6, 3, '#e6c97a'); R(-14, -33 - bob, 2, 8, '#bfe6ff'); }
  // back arm
  const bax = -6 + lean, bay = -31 - bob, bhx = -7 + Math.sin(ph + 3) * (walking ? 4 : 1), bhy = -17 - bob;
  if (kind !== 'boss') { limb(bax, bay, bhx, bhy, 4, dk(k.skin), -1, 0); limb(bax, bay, (bax + bhx) / 2, (bay + bhy) / 2, 5, dk(k.armor), -1, 0); }
  if (k.cls === 'luca') { g.save(); g.translate(bhx, bhy); g.rotate(f.st === 'atk' && f.combo % 2 ? -1.4 : (f.st === 'idle' || f.st === 'walk') ? 2.5 : 0.7); drawWeapon(g, C, 'dagger', 11, (k.gt && k.gt.weapon) | 0); g.restore(); }
  if (HC === 'panni' && !white) { const q = tickN * 0.08, ga0 = g.globalAlpha; g.globalAlpha = ga0 * 0.9;
    R(bhx - 6 + Math.sin(q) * 3, bhy - 6 + Math.cos(q * 1.3) * 3, 2, 2, '#c99bff'); R(bhx - 3 + Math.cos(q * 0.9) * 4, bhy - 9 + Math.sin(q) * 2, 1, 1, '#bff0ff');
    R(bhx + 2 + Math.sin(q * 1.4) * 3, bhy - 5 + Math.cos(q) * 3, 1, 3, '#bff0ff'); R(bhx - 8, bhy - 1 + Math.sin(q * 1.1) * 2, 3, 1, '#c99bff'); g.globalAlpha = ga0; }
  if (BOSSES[kind] && !f.dead) { // articulated boss limbs: two-bone arms with follow-through, tendrils and tongs
    const wt = winding ? clamp(f.t / (k.windup || 30), 0, 1) : 0, at = bAct ? clamp(f.t / 9, 0, 1) : 0, wk = walking ? Math.sin(ph) : 0, lp = (a, b, t) => a + (b - a) * t;
    if (kind === 'boss') { // Colossus: a stone back-arm that rises with the swing and crashes down after it
      let tx = -11 - wk * 4, ty = -9 - bob;
      if (winding) { tx = lp(tx, -17, wt); ty = lp(ty, -66, wt) + Math.sin(tickN * 0.8) * wt; } else if (bAct) { tx = lp(-17, 12, at); ty = lp(-66, -6, at * at); }
      const [hx2, hy2] = arm2(-7 + lean, -31 - bob, tx, ty, 15, 16, 9, k.armor, dk(k.skin), -1);
      R(hx2 - 5, hy2 - 5, 10, 10, dk(k.armor)); R(hx2 - 5, hy2 - 5, 10, 2, k.armor2); R(hx2 - 5, hy2 + 3, 10, 2, '#0e0a0c');
    } else if (kind === 'witch') { // Matron: ghostly arms that reach and claw, and living hair tendrils
      const ga = g.globalAlpha;
      for (let i = 0; i < 3; i++) chain(-5 + lean, -44 - bob, 7, 5, 0.5 + i * 0.15, i * 1.7, 2.4 - i * 0.5, k.hair);
      for (const i of [0, 1]) {
        let tx = -22 - i * 6 + Math.sin(tickN * 0.05 + i * 2.1) * 5, ty = -42 + i * 12 + Math.cos(tickN * 0.07 + i) * 6;
        if (winding) { tx = lp(tx, 30, wt); ty = lp(ty, -36 + i * 6, wt); } else if (bAct) { tx = lp(30, 38, at); ty = -30 + i * 6; }
        g.globalAlpha = ga * 0.75;
        const [hx2, hy2, ex, ey] = arm2(-4 - i * 5 + lean, -30 - bob, tx, ty, 14, 16, 3.2, '#4a8a62', '#6aff9a', i ? 1 : -1);
        const L = Math.hypot(hx2 - ex, hy2 - ey) || 1; claw(hx2, hy2, (hx2 - ex) / L, (hy2 - ey) / L, 7, winding ? 0.9 : 0.45, '#caffd8', 1.3);
        g.globalAlpha = ga;
      }
    } else if (kind === 'smith') { // Forgemaster: a mechanical tongs arm that hammers in sync, jaws opening on the windup
      let tx = -15, ty = -19 + Math.sin(tickN * 0.05) * 2 + wk * 3;
      if (winding) { tx = lp(tx, -12, wt); ty = lp(ty, -68, wt); } else if (bAct) { tx = lp(-12, 18, at); ty = lp(-68, -10, at * at); }
      const [hx2, hy2, ex, ey] = arm2(-8 + lean, -33 - bob, tx, ty, 16, 17, 7, '#4a4e58', '#6a707c', -1);
      const L = Math.hypot(hx2 - ex, hy2 - ey) || 1, ux = (hx2 - ex) / L, uy = (hy2 - ey) / L, open = winding ? 0.55 - wt * 0.35 : bAct ? 0.08 : 0.35 + Math.sin(tickN * 0.1) * 0.1;
      for (const sd of [-1, 1]) { const ca = Math.cos(open * sd), sa = Math.sin(open * sd), px = ux * ca - uy * sa, py = ux * sa + uy * ca; g.strokeStyle = C('#8a909c');
        g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx2, hy2); g.lineTo(hx2 + px * 13, hy2 + py * 13); g.stroke();
        R(hx2 + px * 13 - 1.5, hy2 + py * 13 - 1.5, 3, 3, winding || bAct ? '#ff8a2a' : '#c8ccd6'); }
    }
  }
  // legs
  const legs = [[lb, dk(k.cloth), 0.55], [la, k.cloth, 1]];
  for (const [o, c, b] of legs) {
    R(-3 + o * 0.9, -17 - bob, 6, 9, c); R(-3 + o * 0.9 + 3, -17 - bob, 3, 9, dk(c));
    R(-3 + o * 0.5, -9 - bob, 5, 6, c); R(-3 + o * 0.5, -9 - bob, 2, 6, lt(c));
    R(-4 + o * 0.9, -12 - bob, 7, 2, k.armor2); // knee guard
    if (bT) { const BC = [null, ['#4a3624', '#6a4c32', '#8a6a44'], ['#243a5a', '#3a5a8a', '#8cc4ff'], ['#7a5a16', '#c9962e', '#ffe08a'], ['#2a1020', '#4a1a30', '#ff6a2a'], ['#10301a', '#1a5a2e', '#46e06a']][bT];
      R(-4 + o * 0.2, -4, 8, 4, b < 1 ? BC[0] : BC[1]); R(-4 + o * 0.2 + 5, -4, 3, 4, dk(BC[0])); R(-4 + o * 0.2, -4, 8, 1, BC[2]);
      if (bT >= 2) R(-4 + o * 0.5, -9 - bob, 6, 1.5, BC[2]); if (bT >= 3) { R(-4 + o * 0.2 - 2, -5, 2, 2, BC[2]); } }
    else { R(-4 + o * 0.2, -4, 8, 4, b < 1 ? '#0e080c' : '#1c1219'); R(-4 + o * 0.2 + 5, -4, 3, 4, '#2e2230'); R(-4 + o * 0.2, -4, 8, 1, '#3a2c3c'); }
  }
  // tasset / loincloth
  const sw2 = walking ? Math.sin(ph) * 1.5 : 0;
  P([-7 + lean, -19 - bob, 7 + lean, -19 - bob, 6 + sw2, -9, -6 - sw2, -9], dk(k.cloth)); R(-7 + lean, -19 - bob, 14, 2, lt(k.cloth));
  const robe = (c, fl, zig, rs) => { const pts = [-8 + lean, -23 - bob, 8 + lean, -23 - bob]; if (!zig) pts.push(fl + rs, -1.5, -fl - rs, -1.5);
    else for (let i = 0; i <= 8; i++) pts.push(fl - i * fl / 4 + rs * (1 - i / 8), i % 2 ? -4 - ((tickN / 8 | 0) + i) % 2 : -0.5); P(pts, c);
    P([1 + lean, -23 - bob, 8 + lean, -23 - bob, fl + rs, -2, 2 + rs, -2], dk(c));
    P([-8 + lean, -23 - bob, -5 + lean, -23 - bob, -fl * 0.6 - rs, -2, -fl - rs, -2], lt(c)); };
  if (HC === 'panni') { const rs = walking ? Math.sin(ph) * 1.5 : 0, sw3 = Math.sin(tickN * 0.1) * 0.8; robe(k.armor, 14 + sw3, false, rs);
    R(-14 - rs + sw3, -4, 28 + rs * 2, 2, '#e8c060'); R(-14 - rs + sw3, -4, 28 + rs * 2, 0.8, '#fff0a8'); R(-0.5 + lean, -21 - bob, 1, 18, '#e8c060');
    R(-9 - rs, -12, 2, 2, k.armor2); R(7 + rs, -9, 2, 2, k.armor2); }
  if (f.kind === 'warder') { const rs = walking ? Math.sin(ph) * 1.2 : 0; robe(k.armor, 12, false, rs);
    for (let i = -5; i < 5; i += 2) R(i * 2.4 + 1, -3, 3, 1, '#6ad8ff'); R(-3 + lean, -21 - bob, 1, 14, 'rgba(200,216,232,0.55)');
    R(2 + lean, -21 - bob, 1, 14, 'rgba(200,216,232,0.55)'); R(-12 + lean, -27 - bob, 8, 6, '#6a3a22'); R(-12 + lean, -27 - bob, 8, 1, '#e8c060');
    R(-9 + lean, -25 - bob, 3, 1, '#9ae8ff'); }
  if (f.kind === 'caller') { const rs = walking ? Math.sin(ph) * 1.2 : 0; robe(k.armor, 12, true, rs); R(-7 + lean, -23 - bob, 14, 2, '#8a5a2a'); for (let i = 0; i < 4; i++) R(-5 + i * 3.4 + lean, -21 - bob, 1.6, 2, '#e8dcc0'); }
  if (kind === 'witch') { const rs = walking ? Math.sin(ph) * 1.5 : 0; P([-8 + lean, -22 - bob, 8 + lean, -22 - bob, 11 + rs, -2, -11 - rs, -2], k.armor);
    P([-8 + lean, -22 - bob, -2 + lean, -22 - bob, -4 - rs, -2, -11 - rs, -2], dk(k.armor)); R(-11 - rs, -4, 22, 2, k.armor2);
    for (let i = 0; i < 4; i++) R(-8 + i * 5 + rs, -3 - ((i + (tickN / 6 | 0)) % 2), 2, 3, dk(k.armor)); }
  // torso
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, -6 + lean, -18 - bob], k.armor);
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 8 + lean, -31 - bob, -8 + lean, -31 - bob], lt(k.armor));
  P([2 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, 3 + lean, -18 - bob], dk(k.armor));
  R(-1 + lean, -33 - bob, 2, 13, k.armor2); R(-5 + lean, -29 - bob, 10, 1, dk(k.armor)); R(-5 + lean, -25 - bob, 10, 1, dk(k.armor));
  R(-7 + lean, -20 - bob, 14, 3, HC === 'panni' ? tone(k.armor2, 1) : HC === 'nolan' ? '#5a3522' : '#2a1c22'); R(-2 + lean, -20 - bob, 4, 3, '#e6b84a'); R(-2 + lean, -20 - bob, 4, 1, '#fff0a8');
  if (kind === 'boss') { // Colossus: turquoise runes between the stone plates, brighter before a slam
    const rw = 0.5 + Math.sin(tickN * 0.1) * 0.25 + (winding ? clamp(f.t / (k.windup || 30), 0, 1) * 0.7 : 0) + (f.p2 ? 0.2 : 0), rc = mixHex('#1c6a5a', '#9affee', clamp(rw, 0, 1));
    R(-5 + lean, -33 - bob, 4, 1, rc); R(-5 + lean, -33 - bob, 1, 4, rc); R(1 + lean, -30 - bob, 4, 1, rc); R(4 + lean, -30 - bob, 1, 4, rc); R(-3 + lean, -26 - bob, 6, 1, rc); R(-1 + lean, -27 - bob, 1, 3, rc);
    R(-8 + lean, -36 - bob, 4, 2, '#5a7a3a'); R(5 + lean, -36 - bob, 3, 2, '#5a7a3a'); R(-7 + lean, -35 - bob, 1, 1, '#7a9a4a'); R(-4 + lean, -24 - bob, 1, 4, '#2a2620'); R(3 + lean, -22 - bob, 1, 3, '#2a2620');
  } else if (kind !== 'hero' && kind !== 'witch' && kind !== 'smith') { // ember cracks
    const fl = 0.6 + Math.sin(tickN * 0.2 + f.x) * 0.4; g.globalAlpha *= 1; R(-4 + lean, -30 - bob, 1, 5, `rgb(255,${140 + fl * 80 | 0},40)`); R(3 + lean, -27 - bob, 1, 4, `rgb(255,${130 + fl * 80 | 0},40)`); R(-3 + lean, -25 - bob, 3, 1, '#ff9a3a');
  }
  if (f.kind === 'h' && !f.dead) { // Marauder: shaggy fur collar over broad, hunched shoulders
    P([-11 + lean, -33 - bob, -9 + lean, -39 - bob, -6 + lean, -36 - bob, -3 + lean, -40 - bob, 0 + lean, -36.5 - bob, 3 + lean, -40 - bob, 6 + lean, -36 - bob, 9 + lean, -39 - bob, 11 + lean, -33 - bob], '#8a6a48');
    P([0 + lean, -36.5 - bob, 3 + lean, -40 - bob, 6 + lean, -36 - bob, 9 + lean, -39 - bob, 11 + lean, -33 - bob, 1 + lean, -33 - bob], '#6a4e30'); R(-9 + lean, -37 - bob, 5, 1, '#b08a5e');
  }
  if (kind === 'hero') {
    if (HC === 'nolan') { P([-4 + lean, -33 - bob, 0 + lean, -29 - bob, 4 + lean, -33 - bob, 4 + lean, -31 - bob, 0 + lean, -27 - bob, -4 + lean, -31 - bob], '#e8c060');
      R(-8 + lean, -35 - bob, 1, 12, hi(k.armor)); P([-12 + lean, -38 - bob, -5 + lean, -38 - bob, -5 + lean, -31 - bob, -11 + lean, -32 - bob], k.armor2);
      R(-12 + lean, -38 - bob, 7, 1.5, hi(k.armor2)); }
    else if (HC === 'luca') { P([-8 + lean, -35 - bob, -5 + lean, -35 - bob, 8 + lean, -22 - bob, 5 + lean, -22 - bob], '#2a1a10'); R(-1 + lean, -29 - bob, 2.5, 2.5, '#c8c8c8'); R(-7 + lean, -35 - bob, 1, 12, lt(k.armor)); }
    else { R(-6 + lean, -26 - bob, 12, 1, '#e8c060'); R(-6 + lean, -35 - bob, 1, 9, hi(k.armor)); }
  }
  if (kind === 'hero') {
    if (aT >= 1) { const ac = ['', '#b8a888', '#c8d0dc', '#ffe08a', '#ff6a2a', '#46e06a'][aT]; R(-8 + lean, -36 - bob, 16, 1, ac);
      if (aT >= 2) R(-5 + lean, -24 - bob, 10, 1, ac); if (aT >= 3) { P([-9 + lean, -36 - bob, -14 + lean, -42 - bob, -6 + lean, -34 - bob], ac);
      P([9 + lean, -36 - bob, 13 + lean, -41 - bob, 6 + lean, -34 - bob], ac); } }
    if (aT >= 4) { const fl = 0.6 + Math.sin(tickN * 0.2) * 0.4; R(-4 + lean, -30 - bob, 1, 5, flm(aT, 140 + fl * 80 | 0));
      R(3 + lean, -27 - bob, 1, 4, flm(aT, 130 + fl * 80 | 0)); R(-3 + lean, -25 - bob, 1, 3, flm(aT, 150 + fl * 80 | 0));
      if (tickN % 9 === 0 && !f.dead) spawn(f.x - f.face * 4, f.y, 30, 1, { c: aT >= 5 ? ['#9affb8', '#46e06a'] : ['#ffb43a', '#ff6a2a'], s0: 0.1, s1: 0.4, l0: 14, l1: 26, add: true, size: 1, up: 0.8, g: -0.01 });
      }
    if (amT) { const gc = ['', '#cfd4de', '#5a9cff', '#ffb43a', '#ff4a88', '#46e06a'][amT], gl = 0.6 + Math.sin(tickN * 0.15) * 0.4; R(-1.5 + lean, -35 - bob, 3, 3, gc);
      R(-0.5 + lean, -35 - bob, 1, 1, '#fff'); if (amT >= 3) { R(-2.5 + lean, -36 - bob, 5, 1, `rgba(255,255,255,${0.3 + gl * 0.4})`); } }
  }
  if (kind === 'smith') { P([-6 + lean, -28 - bob, 6 + lean, -28 - bob, 7 + lean, -8, -7 + lean, -8], '#5a3a26'); R(-6 + lean, -28 - bob, 12, 2, '#8a5a36');
    R(-5 + lean, -35 - bob, 10, 7, '#140a06'); const ff = 0.6 + Math.sin(tickN * 0.25) * 0.4; R(-4 + lean, -34 - bob, 8, 5, `rgb(255,${90 + ff * 70 | 0},20)`);
    R(-3 + lean, -33 - bob, 6, 2, '#ffd070'); }
  if (kind === 'king') { R(-8 + lean, -37 - bob, 16, 2, '#ff6a2a'); R(-1 + lean, -35 - bob, 2, 16, '#ff6a2a'); const kf = 0.5 + Math.sin(tickN * 0.22) * 0.5; R(-3 + lean, -31 - bob, 6, 6, `rgb(${200 + kf * 55 | 0},${40 + kf * 60 | 0},30)`); R(-2 + lean, -30 - bob, 4, 4, '#fff1b0'); }
  // neck + head
  R(-2 + lean, -39 - bob, 4, 4, dk(k.skin));
  const hx = lean, hy = -bob;
  if (kind === 'hero') {
    const fs = HC === 'luca' ? '#0b1610' : k.skin;
    R(-5 + hx, -48 + hy, 10, 10, fs); R(-5 + hx, -42 + hy, 10, 4, dk(fs)); R(2 + hx, -48 + hy, 3, 10, lt(fs) === fs ? fs : shade(fs, 0.12));
    const tail = Math.sin(tickN * 0.15) * 2 - (walking ? 2 : 0), hc0 = k.cls || 'nolan';
    if (hc0 === 'panni') { // long golden hair under a pointed hat; her helm tier colours the hat
      P([-6 + hx, -49 + hy, -12 + hx + tail, -40 + hy, -13 + hx + tail * 1.4, -27 + hy, -8 + hx + tail, -29 + hy, -5 + hx, -38 + hy], k.hair);
      R(-6 + hx, -49 + hy, 3, 12, k.hair); P([-6 + hx, -48 + hy, 5 + hx, -49 + hy, 6 + hx, -45 + hy, 1 + hx, -47 + hy, -3 + hx, -44 + hy], k.hair);
      R(2 + hx, -44 + hy, 3, 2, '#fff'); R(3 + hx, -44 + hy, 2, 2, '#3a2a6a'); R(2 + hx, -45 + hy, 4, 1, '#1b1b2a'); R(3 + hx, -41 + hy, 2, 1, '#c86a6a');
      const hatc = [k.armor, '#5a4a6a', '#2a4aa8', '#b8862a', '#2a1020', '#10301a'][hT], hatl = ['#ffd24a', '#c0c6d0', '#8cc4ff', '#fff0a8', '#ff6a2a', '#46e06a'][hT];
      P([-10 + hx, -48 + hy, 10 + hx, -48 + hy, 8 + hx, -51 + hy, -8 + hx, -51 + hy], hatc);
      P([-6 + hx, -50 + hy, 6 + hx, -50 + hy, 1 + hx - tail * 0.3, -60 + hy, -6 + hx + tail * 0.8, -65 + hy, -3 + hx, -58 + hy], hatc);
      R(-6 + hx, -52 + hy, 12, 1.5, hatl); R(-6 + hx + tail * 0.8, -66 + hy, 2, 2, hatl); P([2 + hx, -50 + hy, 7 + hx, -49 + hy, 8 + hx, -51 + hy, 2 + hx, -51 + hy], dk(hatc)); R(-8 + hx, -50 + hy, 2, 1, lt(hatc));
      if (hT >= 4) for (let i = -1; i <= 1; i++) { const fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([i * 3 + hx - 1, -52 + hy, i * 3 + hx + 1, -52 + hy, i * 3 + hx, -52 - fh + hy], i ? (hT >= 5 ? '#46e06a' : '#ff8a2a') : (hT >= 5 ? '#b8ffc8' : '#ffd070')); }
    } else if (hc0 === 'luca') { // hooded rogue: deep green hood, dark masked face with glowing eyes, a long scarf that streams behind; the helm tier colours the hood
      const hd = [tone('#26774b', 1), '#3a3a40', '#22407a', '#7a5a1a', '#3a0e1e', '#0e2a16'][hT], hl2 = ['#4a8a62', '#8a8f99', '#5a9cff', '#ffd870', '#ff4a6a', '#46e06a'][hT];
      let qx = -5 + hx, qy = -39 + hy; const spd = walking ? 1 : 0.5 + (air ? 1 : 0); g.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const nx = qx - 3.4 - spd * 0.7, ny = qy + 0.6 + Math.sin(tickN * 0.16 - i * 0.7) * (1 + i * 0.3) * (0.6 + spd * 0.4);
        g.strokeStyle = C(i % 2 ? '#2f8f5a' : '#3aa066'); g.lineWidth = 3.4 - i * 0.2; g.beginPath(); g.moveTo(qx, qy); g.lineTo(nx, ny); g.stroke(); qx = nx; qy = ny; }
      P([-7 + hx, -48 + hy, -13 + hx + tail, -45 + hy, -12 + hx + tail * 1.3, -39 + hy, -6 + hx, -42 + hy], dk(hd));
      P([-7 + hx, -40 + hy, -7 + hx, -51 + hy, -3 + hx, -55 + hy, 4 + hx, -55 + hy, 7 + hx, -50 + hy, 6 + hx, -46 + hy, 1 + hx, -48 + hy, -3 + hx, -46 + hy, -3 + hx, -40 + hy], hd);
      P([2 + hx, -55 + hy, 7 + hx, -50 + hy, 6 + hx, -46 + hy, 1 + hx, -48 + hy], dk(hd)); R(-6 + hx, -52 + hy, 1.5, 9, lt(hd));
      R(-3 + hx, -54 + hy, 6, 1, hl2); R(1 + hx, -42 + hy, 6, 3, '#2f8f5a'); R(1 + hx, -42 + hy, 6, 1, hl2); R(5 + hx, -42 + hy, 2, 3, dk('#2f8f5a'));
      R(1 + hx, -47 + hy, 6, 4, 'rgba(138,255,192,0.3)'); R(2 + hx, -45.5 + hy, 2.6, 1.6, '#d6ffe4'); R(5.2 + hx, -45.5 + hy, 1.8, 1.6, '#d6ffe4');
      if (hT >= 4) { const fl = 0.5 + Math.sin(tickN * 0.3) * 0.5; R(3 + hx, -45 + hy, 2, 1, flm(hT, 120 + fl * 100 | 0)); }
    } else { // Nolan: a closed helm with a gold stripe and a red plume that trails behind him; the helm tier recolours the steel
      const pl = Math.sin(tickN * 0.15) * 2 - (walking ? 2 : 0) - (air ? 2 : 0), hcl = hT ? [null, '#8a8f99', '#4a7ac8', '#d4a62e', '#2a1620', '#10301a'][hT] : '#7189b0',
        hll = hT ? [null, '#c0c6d0', '#8cc4ff', '#fff0a8', '#ff6a2a', '#46e06a'][hT] : '#c9d8ee', plc = k.hair !== '#c4572b' ? k.hair : '#c8303e';
      let qx = -1 + hx, qy = -55 + hy; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const nx = qx - 3.4 + pl * 0.25, ny = qy - 1.6 + i * 1.7 + Math.sin(tickN * 0.15 - i * 0.8) * 0.9; g.strokeStyle = C(i % 2 ? plc : lt(plc)); g.lineWidth = 4.2 - i * 0.6; g.beginPath(); g.moveTo(qx, qy); g.lineTo(nx, ny); g.stroke(); qx = nx; qy = ny; }
      P([-6.5 + hx, -38 + hy, -6.5 + hx, -51 + hy, -3 + hx, -55.5 + hy, 3 + hx, -55.5 + hy, 6.5 + hx, -51 + hy, 6.5 + hx, -38 + hy, 3 + hx, -36 + hy, -3 + hx, -36 + hy], hcl);
      P([1.5 + hx, -55.5 + hy, 6.5 + hx, -51 + hy, 6.5 + hx, -38 + hy, 3 + hx, -36 + hy, 1.5 + hx, -36 + hy], dk(hcl));
      R(-5.5 + hx, -53 + hy, 1.6, 13, hll); R(-6 + hx, -48.5 + hy, 12.5, 1.2, dk(hcl)); R(-0.4 + hx, -55.5 + hy, 1.6, 19.5, '#e8c060');
      R(0 + hx, -46.5 + hy, 6.5, 2.2, '#0e0a10'); R(3.4 + hx, -46.2 + hy, 2.2, 1.4, '#ffcf7a'); R(-3 + hx, -41.5 + hy, 9, 1, dk(hcl)); R(4 + hx, -43 + hy, 1, 1, dk(hcl));
      if (hT >= 4) for (let i = -2; i <= 2; i++) { const fh = 4 + Math.abs(Math.sin(tickN * 0.3 + i)) * 5; P([i * 2.5 + hx - 1.2, -55.5 + hy, i * 2.5 + hx + 1.2, -55.5 + hy, i * 2.5 + hx, -55.5 - fh + hy], i % 2 ? (hT >= 5 ? '#46e06a' : '#ff8a2a') : (hT >= 5 ? '#b8ffc8' : '#ffd070')); }
    }
  } else if (f.kind === 'h') { // Marauder: a small head sunk between broad shoulders, olive skin, red eyes, tusks
    R(-4 + hx, -46 + hy, 9, 8, k.skin); R(1 + hx, -46 + hy, 4, 8, dk(k.skin)); R(-4 + hx, -46 + hy, 1.5, 7, lt(k.skin)); R(-4 + hx, -46 + hy, 9, 2, dk(k.skin));
    P([-5 + hx, -45 + hy, 5 + hx, -45 + hy, 6 + hx, -48 + hy, 2 + hx, -49 + hy, -3 + hx, -48 + hy], k.hair);
    R(-1 + hx, -45.5 + hy, 6, 1, '#1a1a0c'); R(0 + hx, -44 + hy, 2.4, 1.6, '#ff4a3a'); R(3.4 + hx, -44 + hy, 2, 1.6, '#ff4a3a');
    R(-2 + hx, -40.5 + hy, 8, 2, '#1a1a0c'); P([-1 + hx, -40.5 + hy, 0.5 + hx, -43.5 + hy, 2 + hx, -40.5 + hy], '#f0e6c8'); P([3 + hx, -40.5 + hy, 4.5 + hx, -43.5 + hy, 6 + hx, -40.5 + hy], '#f0e6c8');
  } else if (f.kind === 'warder') { // Ash Warder: a faceless blue hood, cold cyan eyes
    P([-7 + hx, -38 + hy, -7 + hx, -50 + hy, -3 + hx, -56 + hy, 3 + hx, -56 + hy, 7 + hx, -50 + hy, 7 + hx, -38 + hy, 3 + hx, -36 + hy, -3 + hx, -36 + hy], '#3a5c84');
    P([2 + hx, -56 + hy, 7 + hx, -50 + hy, 7 + hx, -38 + hy, 3 + hx, -36 + hy, 2 + hx, -36 + hy], '#2e4a6a'); R(-6 + hx, -52 + hy, 1.5, 11, '#6a8ab0');
    R(-3 + hx, -51 + hy, 9, 10, '#0a0f18'); R(-1 + hx, -47 + hy, 2.2, 1.6, '#9ae8ff'); R(3 + hx, -47 + hy, 2.2, 1.6, '#9ae8ff'); R(-1.5 + hx, -47.5 + hy, 3.2, 2.6, 'rgba(154,232,255,0.22)'); R(2.5 + hx, -47.5 + hy, 3.2, 2.6, 'rgba(154,232,255,0.22)');
  } else if (f.kind === 'caller') { // Flame Caller: a horned skull mask over a ragged hood
    P([-5 + hx, -48 + hy, -9 + hx, -53 + hy, -11 + hx, -61 + hy, -6 + hx, -55 + hy, -3 + hx, -49 + hy], '#c8b890'); P([5 + hx, -48 + hy, 9 + hx, -53 + hy, 11 + hx, -61 + hy, 6 + hx, -55 + hy, 3 + hx, -49 + hy], '#a89870');
    P([-6 + hx, -40 + hy, -6 + hx, -50 + hy, -2 + hx, -53 + hy, 4 + hx, -53 + hy, 7 + hx, -49 + hy, 7 + hx, -40 + hy, 3 + hx, -37 + hy, -3 + hx, -37 + hy], '#4a2a26');
    R(-4 + hx, -49 + hy, 9, 10, '#e8dcc0'); R(1 + hx, -49 + hy, 4, 10, '#c8b890'); R(-4 + hx, -49 + hy, 1.5, 9, '#fff4dc');
    R(-3 + hx, -46 + hy, 3, 3, '#1a0806'); R(1 + hx, -46 + hy, 3, 3, '#1a0806'); R(-2 + hx, -45 + hy, 1.4, 1.4, '#ffb03a'); R(2 + hx, -45 + hy, 1.4, 1.4, '#ffb03a'); R(-1 + hx, -42 + hy, 2, 1.4, '#2a2010'); R(-2 + hx, -40 + hy, 5, 1, '#2a2010'); R(0 + hx, -40 + hy, 1, 1, '#e8dcc0');
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
  } else if (kind === 'witch') { // Matron: a pale ghostly face, burning green eyes, a thorn-branch crown
    const ew = 0.7 + Math.sin(tickN * 0.2) * 0.3 + (winding ? 0.5 : 0), ec = `rgb(106,${180 + clamp(ew, 0, 1) * 75 | 0},154)`;
    P([-5 + hx, -42 + hy, -9 + hx, -34 + hy, -3 + hx, -38 + hy], k.hair); P([-3 + hx, -41 + hy, -6 + hx, -31 + hy, 0 + hx, -37 + hy], k.hair);
    R(-5 + hx, -48 + hy, 10, 11, k.skin); R(-5 + hx, -42 + hy, 10, 5, dk(k.skin)); R(2 + hx, -48 + hy, 3, 11, lt(k.skin)); R(-5 + hx, -48 + hy, 1.5, 10, hi(k.skin));
    R(-3 + hx, -46 + hy, 3, 3, '#0a1410'); R(2 + hx, -46 + hy, 3, 3, '#0a1410'); R(-2 + hx, -45.5 + hy, 1.6, 1.8, ec); R(3 + hx, -45.5 + hy, 1.6, 1.8, ec); R(-1 + hx, -40 + hy, 4, 1, '#4a6a5a');
    P([-6 + hx, -47 + hy, -8 + hx, -55 + hy, -4 + hx, -50 + hy, -4 + hx, -60 + hy, -1 + hx, -51 + hy, 1 + hx, -62 + hy, 3 + hx, -51 + hy, 6 + hx, -59 + hy, 6 + hx, -50 + hy, 9 + hx, -55 + hy, 7 + hx, -47 + hy], '#3a2a22');
    R(-6 + hx, -48.5 + hy, 13, 2, '#5a4030'); R(-4 + hx, -60 + hy, 1, 1, ec); R(1 + hx, -62 + hy, 1, 1, ec); R(6 + hx, -59 + hy, 1, 1, ec);
  } else if (kind === 'smith') { // Forgemaster: a grimy face, glowing welding goggles, a braided red beard, a small iron cap
    const gg2 = 0.7 + Math.sin(tickN * 0.25) * 0.3 + (winding ? 0.4 : 0), gc = `rgb(255,${180 + clamp(gg2, 0, 1) * 50 | 0},60)`;
    R(-5 + hx, -48 + hy, 11, 11, k.skin); R(2 + hx, -48 + hy, 4, 11, dk(k.skin)); R(-5 + hx, -48 + hy, 1.5, 9, lt(k.skin));
    R(-7 + hx, -47 + hy, 14, 4, '#2a2420'); R(-5 + hx, -46.5 + hy, 4, 3, gc); R(1 + hx, -46.5 + hy, 4, 3, gc); R(-4 + hx, -46 + hy, 1, 1, '#fff6c0'); R(2 + hx, -46 + hy, 1, 1, '#fff6c0');
    P([-6 + hx, -42 + hy, 6 + hx, -42 + hy, 5 + hx, -36 + hy, 2 + hx, -31 + hy, 0 + hx, -29 + hy, -2 + hx, -31 + hy, -5 + hx, -36 + hy], k.hair); P([1 + hx, -42 + hy, 6 + hx, -42 + hy, 5 + hx, -36 + hy, 2 + hx, -31 + hy, 0 + hx, -29 + hy, 0 + hx, -40 + hy], dk(k.hair));
    for (let i = 0; i < 3; i++) R(-1 + hx, -39 + i * 3 + hy, 2, 1, hi(k.hair));
    R(-6.5 + hx, -53 + hy, 13, 6, '#5a5e68'); R(-6.5 + hx, -53 + hy, 13, 1.5, '#9aa1ad'); R(2 + hx, -53 + hy, 4.5, 6, '#3a3e48'); R(-1 + hx, -57 + hy, 3, 4, '#3a3e48');
  } else if (kind === 'king') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-6 + hx, -47 + hy, 6 + hx, -47 + hy, 6 + hx, -39 + hy, 3 + hx, -37 + hy, -3 + hx, -37 + hy, -6 + hx, -39 + hy], '#1a1620'); R(-5 + hx, -48 + hy, 11, 6, '#1a1620');
    R(1 + hx, -45 + hy, 4, 2, '#ff6a2a'); R(2 + hx, -45 + hy, 2, 1, '#fff1b0'); R(-4 + hx, -45 + hy, 3, 2, '#c8401a');
    R(-6 + hx, -50 + hy, 12, 3, '#c9962e');
    for (let i = -2; i <= 2; i++) { const ch = 6 + (2 - Math.abs(i)) * 2;
      P([i * 3 + hx - 1.5, -50 + hy, i * 3 + hx + 1.5, -50 + hy, i * 3 + hx, -50 - ch + hy], '#3a3040'); const fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4;
      P([i * 3 + hx - 1.2, -50 - ch + hy, i * 3 + hx + 1.2, -50 - ch + hy, i * 3 + hx, -50 - ch - fh + hy], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else if (kind === 'boss') { // Colossus: a tiny carved head sunk into huge shoulders, one turquoise eye
    const ew = 0.6 + Math.sin(tickN * 0.1) * 0.25 + (winding ? clamp(f.t / (k.windup || 30), 0, 1) * 0.8 : 0) + (f.p2 ? 0.2 : 0);
    R(-4 + hx, -46 + hy, 9, 9, '#8a847a'); R(1 + hx, -46 + hy, 4, 9, '#6e685e'); R(-4 + hx, -47 + hy, 9, 1.5, '#a6a094'); R(-4 + hx, -46 + hy, 1.5, 8, '#a6a094');
    R(-2 + hx, -43 + hy, 6, 3, '#121010'); R(0 + hx, -42.5 + hy, 2.4, 2.2, mixHex('#1c8a78', '#b8fff0', clamp(ew, 0, 1))); R(-4 + hx, -38 + hy, 9, 1, '#2a2620'); R(3 + hx, -46 + hy, 1, 3, '#2a2620'); R(-4 + hx, -47.5 + hy, 3, 1.5, '#5a7a3a');
  } else { // helmeted: brute & guard & knight
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
  if (f.kind === 'archer') { P([-7 + hx, -47 + hy, -7 + hx, -53 + hy, -2 + hx, -57 + hy, 3 + hx, -55 + hy, 7 + hx, -49 + hy, 7 + hx, -44 + hy, 5 + hx, -48 + hy, -4 + hx, -49 + hy], k.cloth);
    R(-7 + hx, -47 + hy, 3, 10, dk(k.cloth)); R(-5 + hx, -40 + hy, 10, 3, k.armor2); R(-9 + lean, -36 - bob, 5, 14, '#5a4030'); R(-9 + lean, -37 - bob, 5, 2, '#e8f4ff');
    }
  if (f.kind === 'bomber') { R(-5 + hx, -48 + hy, 10, 1, '#3a2a1a'); R(-3 + hx, -47 + hy, 3, 3, '#ffcf3a'); R(1 + hx, -47 + hy, 3, 3, '#ffcf3a');
    R(-15 + lean, -35 - bob, 8, 10, '#3a2a1a'); R(-15 + lean, -35 - bob, 8, 2, '#6a4a2a'); R(-13 + lean, -38 - bob, 2, 3, ((tickN >> 1) & 1) ? '#fff1b0' : '#ff8a2a'); }
  if (f.kind === 'knight') { const pw = Math.sin(tickN * 0.13) * 2 - (walking ? 2 : 0); P([-1 + hx, -54 + hy, -9 + hx + pw, -62 + hy, -15 + hx + pw * 1.5, -52 + hy, -3 + hx, -52 + hy], '#8a6aff'); R(1 + hx, -47 + hy, 5, 2, '#d8c0ff'); R(-5 + lean, -36 - bob, 10, 1, '#8a6aff'); }
  // front arm + weapon
  let ang = 0.5;
  if (winding) ang = -2.1 - Math.min(0.4, f.t / (k.windup || 20) * 0.4);
  else if (f.st === 'eatk') ang = lerp(-2.0, 1.4, clamp(f.t / 5, 0, 1));
  else if (f.st === 'atk') { const c = comboOf(f)[f.combo] || COMBO[0]; const p = clamp((f.t - 1) / (c.b - 1), 0, 1); ang = f.k.cls === 'panni' ? lerp(-1.2, 1.2, p) : f.combo % 2 === 1 ? lerp(1.6, -1.8, p) : lerp(-2.2, 1.5, p); }
  else if (f.st === 'jatk') ang = 2.3;
  else if (f.st === 'ratk') ang = 1.3;
  else if (f.st === 'magic') ang = -2.6;
  else if (walking) ang = 0.5 + Math.sin(ph) * 0.15;
  const shx = 5 + lean, shy = -32 - bob, hl = 11, bl = k.wlen;
  const hxp = shx + Math.sin(ang) * hl, hyp = shy - Math.cos(ang) * hl;
  limb(shx, shy, hxp, hyp, big ? 6 : 5, k.skin, -Math.cos(ang) * 2, -Math.sin(ang) * 2);
  limb(shx, shy, (shx + hxp) / 2, (shy + hyp) / 2, big ? 7 : 6, k.armor, 0, 0);
  R(hxp - 2, hyp - 2, 4, 4, C(dk(k.skin)) === '#ffffff' ? '#fff' : k.skin);
  if (kind === 'boss') { R(hxp - 4.5, hyp - 4.5, 9, 9, k.skin); R(hxp - 4.5, hyp - 4.5, 9, 2, hi(k.skin)); R(hxp - 4.5, hyp + 2, 9, 2.5, dk(k.skin)); R(hxp - 1, hyp - 4, 1, 8, '#2a2620'); }
  wFlare = winding ? clamp(f.t / (k.windup || 30), 0, 1) : 0;
  g.save(); g.translate(hxp, hyp); g.rotate(ang + (HC === 'luca' && !winding && !['atk', 'jatk', 'ratk', 'eatk', 'magic'].includes(f.st) ? 2.5 : 0)); drawWeapon(g, C, f.k.wk || kind, bl, wT);
  if (k.wup >= 3 && !white) { const a = 0.08 * (k.wup - 2) + Math.sin(tickN * 0.2) * 0.05; g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,${200 - k.wup * 10},120,${a})`; g.fillRect(-4, -bl - 6, 8, bl + 4); g.globalCompositeOperation = 'source-over'; }
  g.restore();
  // front pauldron
  if (!(f.p2 && BOSSES[kind] && kind !== 'witch')) { P([shx - 5, shy - 4, shx + 5, shy - 4, shx + 6, shy + 3, shx - 4, shy + 3], k.armor2); R(shx - 5, shy - 4, 11, 1.5, lt(k.armor2)); R(shx - 4, shy + 1, 10, 2, dk(k.armor2)); }
  if (kind === 'smith') { R(shx - 3, shy - 17, 5, 13, '#3a3e48'); R(shx - 4, shy - 18, 7, 2, '#5c616c'); R(-12 + lean, -52 - bob, 5, 15, '#3a3e48'); R(-13 + lean, -53 - bob, 7, 2, '#5c616c'); }
  if (kind === 'b' || kind === 'boss') { P([shx + 4, shy - 4, shx + 9, shy - 11, shx + 6, shy - 2], '#d8d0c0'); P([-9 + lean, -37 - bob, -14 + lean, -45 - bob, -6 + lean, -34 - bob], '#d8d0c0'); }
  g.restore();

  // outline: dark silhouette stamped in 4 directions, then the sprite on top
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.globalCompositeOperation = 'source-over'; sil.clearRect(0, 0, SW, SH); sil.globalAlpha = 1;
  sil.drawImage(spriteCv, 0, 0); sil.globalCompositeOperation = 'source-in'; sil.fillStyle = OUTL[HC || f.kind] || olOf(k.armor); sil.fillRect(0, 0, SW, SH);
  const x0 = Math.round(sx) - AX, y0 = Math.round(sy - f.z) - AY;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) MAIN.drawImage(silCv, x0 + dx, y0 + dy);
  const rim = rimOf(f);
  if (rim) { rimg.setTransform(1, 0, 0, 1, 0, 0); rimg.globalCompositeOperation = 'source-over'; rimg.globalAlpha = 1; rimg.clearRect(0, 0, SW, SH);
    rimg.drawImage(spriteCv, 0, 0); rimg.globalCompositeOperation = 'source-in'; rimg.fillStyle = rim; rimg.fillRect(0, 0, SW, SH); MAIN.save();
    MAIN.globalAlpha = (BOSSES[f.kind] ? 0.7 : 0.95) * (0.85 + 0.15 * Math.sin(tickN * 0.12 + f.x)); MAIN.drawImage(rimCv, x0 - f.face, y0); MAIN.restore(); }
  MAIN.drawImage(spriteCv, x0, y0);

  if (BOSSES[kind] && !f.dead && f.st !== 'down') { // boss secondary motion
    const bx = Math.round(sx), by = Math.round(sy - f.z + hov);
    const bgl = BOSS_GLOW[kind];
    if (bgl) { const wt2 = winding ? clamp(f.t / (k.windup || 30), 0, 1) : bAct ? 0.5 : 0, pw = 0.12 + 0.05 * Math.sin(tickN * 0.1) + wt2 * 0.5 + (f.p2 ? 0.12 : 0);
      MAIN.globalCompositeOperation = 'lighter';
      for (const [lx, ly, rgb] of bgl) glowDot(MAIN, bx + lx * f.face * sc, by + ly * sc * brth, (7 + wt2 * 13) * sc * 0.6 + 6, rgb, pw);
      MAIN.globalCompositeOperation = 'source-over'; }
    if (kind === 'witch') for (let i = 0; i < 4; i++) { const a = tickN * 0.05 + i * 1.57; MAIN.globalCompositeOperation = 'lighter';
      MAIN.fillStyle = 'rgba(150,255,190,0.85)'; MAIN.fillRect(bx + Math.cos(a) * 26 * sc, by - 34 * sc + Math.sin(a * 1.4) * 14, 3, 3);
      MAIN.fillStyle = 'rgba(150,255,190,0.25)'; MAIN.fillRect(bx + Math.cos(a - 0.3) * 26 * sc - 1, by - 34 * sc + Math.sin((a - 0.3) * 1.4) * 14 - 1, 5, 5);
      MAIN.globalCompositeOperation = 'source-over'; }
    if (kind === 'smith' && tickN % 4 === 0) spawn(f.x - f.face * 8, f.y, 40 * sc, 1, { s0: 0.1, s1: 0.4, c: ['#8a8a92', '#5a5a64', '#ffb43a'], l0: 18, l1: 34, size: 2, up: 1.1, g: -0.01, add: false });
    if (kind === 'boss' && f.st === 'walk' && Math.abs(Math.sin(f.anim)) < 0.08 && tickN % 10 < 2) { dust(f.x, f.y, 5); shake = Math.max(shake, 1.2); }
  }
  // swing trail on the main canvas
  const swinging = (f.st === 'atk' && f.k.cls !== 'panni' && f.t >= (comboOf(f)[f.combo] || COMBO[0]).a && f.t <= (comboOf(f)[f.combo] || COMBO[0]).b + 4) || (f.st === 'eatk' && f.t < 9) || f.st === 'jatk';
  if (swinging) {
    MAIN.save(); MAIN.translate(Math.round(sx), Math.round(sy - f.z)); MAIN.scale(f.face * sc, sc); MAIN.globalCompositeOperation = 'lighter';
    const a0 = f.st === 'atk' && f.combo === 1 ? 1.6 : -2.0;
    for (let w = 0; w < 3; w++) { MAIN.strokeStyle = f.pn ? `rgba(${120 + w * 40},${200 + w * 18},255,${0.28 - w * 0.07})` : `rgba(255,${130 + w * 30},50,${0.26 - w * 0.07})`;
      MAIN.lineWidth = 9 - w * 3; MAIN.beginPath(); MAIN.arc(shx, shy, hl + bl * 0.85, a0 - Math.PI / 2, ang - Math.PI / 2, ang < a0); MAIN.stroke(); }
    MAIN.restore();
  }
}

function drawFighter(f) {
  drawFighter0(f); const S = f.el; if (!S || f.dead || f.pitT) return;
  const sx = Math.round(f.x - cam), by = Math.round(f.y - f.z), hh = f.h || 40, ww = Math.round(15 * ((f.k && f.k.scale) || 1)) + 3;
  if (S.burn > 0) { g.globalCompositeOperation = 'lighter'; glowDot(g, sx, by - hh * 0.45, hh * 0.55, '255,130,40', 0.22 + 0.06 * Math.sin(tickN * 0.4)); g.globalCompositeOperation = 'source-over'; }
  if (S.chill > 0 && !(S.frz > 0)) { g.globalCompositeOperation = 'lighter'; glowDot(g, sx, by - hh * 0.45, hh * 0.5, '120,210,255', 0.2); g.globalCompositeOperation = 'source-over'; }
  if (S.frz > 0) { // frozen: the figure itself turns icy blue, so the effect always fits the sprite
    g.globalCompositeOperation = 'lighter'; glowDot(g, sx, by - hh * 0.45, hh * 0.6, '120,210,255', 0.3); g.globalCompositeOperation = 'source-over';
    if ('filter' in g) { g.save(); g.filter = 'sepia(1) hue-rotate(160deg) saturate(2.4) brightness(1.3)'; g.globalAlpha = 0.65; drawFighter0(f); g.restore(); }
    g.fillStyle = '#e8faff'; for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3, r = ww * 0.9; g.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(by - hh * 0.5 + Math.sin(a) * hh * 0.45), 2, 3); }
  }
  if (S.stun > 0 && tickN % 4 < 2) { g.fillStyle = '#fff6a0'; for (let i = 0; i < 3; i++) g.fillRect(sx - 8 + i * 8 + ((tickN >> 1) % 3), by - hh - 4 - (i % 2) * 3, 3, 2); }
}
function drawFighter0(f) {
  if (f.pitT) { // tumbling into a chasm
    g.save(); g.beginPath(); g.rect(0, 0, W, f.pitY - 2); g.clip(); g.globalAlpha = clamp(1 - f.pitT / 30, 0, 1);
    const sv = f.pitT, y0 = f.y; f.pitT = 0; f.y = y0 + sv * sv * 0.12; drawFighter0(f); f.y = y0; f.pitT = sv; g.restore(); return;
  }
  const sx = f.x - cam, sy = f.y;
  if (f.isMount) { drawWildMount(f, sx, sy); return; }
  if (f.kind === 'wyrm') { drawWyrm(f, sx, sy); return; }
  const sh = clamp(1 - f.z / 90, 0.3, 1) * f.k.scale * (f.mount ? 1.7 : 1);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 12 * sh, 4 * sh, 0, 0, 7); g.fill();
  if (!f.pn && !f.dead && ENEMY_EL[f.kind]) { const E = ELEM[ENEMY_EL[f.kind]]; g.strokeStyle = `rgba(${E.rgb},${0.38 + 0.12 * Math.sin(tickN * 0.1 + f.x)})`;
    g.lineWidth = 1; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 14 * sh, 5 * sh, 0, 0, 7); g.stroke();
    } // the ring shows what a foe is made of: fire, frost or lightning
  if (f.glow && !f.dead) { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy) - 2, 26 + Math.sin(tickN * 0.1) * 3, f.glow, 0.32); g.globalCompositeOperation = 'source-over'; }
  if (f.mount) {
    drawDragon(sx, sy - f.z, mountLook(f.mount, { face: f.face, anim: f.anim, flash: f.flash, moving: f.st === 'walk', breathe: f.st === 'ratk' || f.jf > 0 || f.st === 'wind' || f.st === 'eatk' }));
    drawHuman(f, sx, sy - 11);
  } else {
    const hv = f.hov || 0, ai = f.k.ai;
    if (ai === 'wisp' && !f.dead) { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy - hv - 20), 22, '120,255,190', 0.35); g.globalCompositeOperation = 'source-over'; }
    if (ai === 'wraith' && !f.dead) { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy - 24), 24, '255,230,150', 0.3); g.globalCompositeOperation = 'source-over'; }
    if (ai === 'runner' && f.st === 'eatk') { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy - 18), 22, '255,140,40', 0.5); g.globalCompositeOperation = 'source-over'; }
    drawHuman(f, sx, sy - hv);
    if (f.barrier > 0 && !f.dead) {
      const a = 0.25 + 0.35 * f.barrier / (f.bmax || 1) + (f.bflash > 0 ? 0.3 : 0), bx = Math.round(sx), by = Math.round(sy - f.z - f.h * 0.5 - hv), rx = 15 * f.k.scale + 4, ry = f.h * 0.62;
      if (f.bflash > 0) f.bflash--;
      g.save(); g.globalCompositeOperation = 'lighter';
      const hexP = (r1, r2) => { g.beginPath(); for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3 - Math.PI / 2, px = bx + Math.cos(t) * r1, py = by + Math.sin(t) * r2; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); };
      hexP(rx, ry); g.fillStyle = `rgba(106,216,255,${a * 0.1})`; g.fill(); g.strokeStyle = `rgba(154,232,255,${a})`; g.lineWidth = 1.3; g.stroke();
      hexP(rx - 4, ry - 4); g.strokeStyle = `rgba(154,232,255,${a * 0.35})`; g.lineWidth = 0.7; g.stroke();
      const nc = Math.floor((1 - f.barrier / (f.bmax || 1)) * 5 + (f.bflash > 0 ? 1 : 0)); g.strokeStyle = `rgba(255,255,255,${Math.min(1, a * 1.6)})`; g.lineWidth = 0.8;
      for (let i = 0; i < nc; i++) { const t0 = i * 1.9 + 0.4, ux = Math.cos(t0), uy = Math.sin(t0); g.beginPath(); g.moveTo(bx + ux * rx * 0.96, by + uy * ry * 0.96);
        g.lineTo(bx + ux * rx * 0.72 - uy * 3, by + uy * ry * 0.72 + ux * 3); g.lineTo(bx + ux * rx * 0.55 + uy * 3, by + uy * ry * 0.55 - ux * 3);
        g.lineTo(bx + ux * rx * 0.3, by + uy * ry * 0.3); g.stroke(); }
      g.restore();
    }
    if (ai === 'guard' && !f.dead) { const bx = Math.round(sx + f.face * 15), by = Math.round(sy - 30); g.fillStyle = '#0a0610'; g.fillRect(bx - 5, by - 2, 10, 30);
      g.fillStyle = '#3a2a5a'; g.fillRect(bx - 4, by - 1, 8, 28); g.fillStyle = '#c87aff'; g.fillRect(bx - 4, by - 1, 8, 2); g.fillRect(bx - 1, by + 4, 2, 18);
      g.fillStyle = '#6a4a9a'; g.fillRect(bx - 4, by + 24, 8, 3); }
  }
  if (f.st === 'wind' && (tickN >> 1) & 1) { g.fillStyle = '#ff3b2a'; g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h * 1.0 - 8), 3, 6); g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h - 1), 3, 2); }
}

function mountLook(m, o) { const T = mtype(m); o.type = (m && m.type) || 'ember'; if (T.sc !== 1) o.sc = T.sc; if (T.pal) o.pal = T.pal; if (T.wings) o.wings = true; if (T.horns) o.horns = true; return o; }
function drawWildMount(m, sx, sy) {
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 20, 5, 0, 0, 7); g.fill();
  drawDragon(sx, sy - m.z, mountLook(m, { face: m.face, anim: m.anim, flash: m.flash, moving: !!m.flee, breathe: false }));
  if (m.falls && !m.flee && ((tickN >> 3) & 1)) text('1 FALL LEFT', Math.round(sx), Math.round(sy - 62), 7, '#ff9a6a', 'center');
  if (!m.flee && !hero.mount && Math.abs(m.x - hero.x) < 80 && Math.abs(m.y - hero.y) < 24 && ((tickN >> 4) & 1)) text('K: RIDE', Math.round(sx), Math.round(sy - 52), 8, '#fff1b0', 'center');
}

function drawJar(x, y, on, age, sc) { // an Ember Jar: glass with a cork, a gold rune band, a blue flame inside; empty it is dark glass with ash at the bottom
  sc = sc || 1; age = age == null ? 999 : age;
  g.save(); g.translate(x, y); g.scale(sc, sc);
  const fl = age < 22 ? 1 - age / 22 : 0, fk = Math.sin(tickN * 0.35 + x) * 0.8; // a freshly filled jar flares up
  if (on) { g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(0, -5, 1, 0, -5, 11 + 8 * fl);
    gl.addColorStop(0, `rgba(90,170,255,${0.32 + 0.4 * fl})`); gl.addColorStop(1, 'rgba(90,170,255,0)'); g.fillStyle = gl; g.fillRect(-22, -28, 44, 44);
    g.globalCompositeOperation = 'source-over'; }
  g.fillStyle = '#0a0610'; g.fillRect(-5, -10, 10, 11); g.fillRect(-3, -13, 6, 4); // outline: body and neck
  g.fillStyle = on ? '#24488e' : '#161c2c'; g.fillRect(-4, -9, 8, 9); g.fillRect(-2, -12, 4, 3);
  g.fillStyle = on ? '#bfe6ff' : '#3a4866'; g.fillRect(-3, -8, 1, 5); // glass highlight
  g.fillStyle = on ? '#2a60b0' : '#10161f'; g.fillRect(2, -8, 2, 8); // glass shade
  g.fillStyle = on ? '#e6c24a' : '#6a5a2c'; g.fillRect(-4, -6, 8, 2); g.fillStyle = on ? '#8a5a10' : '#3a3018'; g.fillRect(-3, -6, 1, 1); g.fillRect(-1, -5, 1, 1); g.fillRect(1, -6, 1, 1); g.fillRect(3, -5, 1, 1); // rune band
  g.fillStyle = on ? '#a8743a' : '#5a3e20'; g.fillRect(-2, -15, 4, 3); g.fillStyle = on ? '#d09a5a' : '#6a4a28'; g.fillRect(-2, -15, 4, 1); // cork
  if (on) {
    const h = 4 + fk + fl * 4; g.fillStyle = '#3a9aff'; g.beginPath(); g.moveTo(-2.4, -0.5); g.quadraticCurveTo(-2.6, -h * 0.6, 0.3, -h - 1); g.quadraticCurveTo(2.2, -h * 0.5, 2.4, -0.5); g.closePath(); g.fill();
    g.fillStyle = '#e8f8ff'; g.beginPath(); g.moveTo(-1, -0.5); g.quadraticCurveTo(-1, -h * 0.4, 0.2, -h * 0.75); g.quadraticCurveTo(1.2, -h * 0.4, 1, -0.5); g.closePath(); g.fill();
    if (fl > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,255,255,${0.5 * fl})`; g.fillRect(-4, -9, 8, 9); g.globalCompositeOperation = 'source-over'; }
  } else { g.fillStyle = '#5a5662'; g.fillRect(-3, -1.5, 6, 1.5); g.fillRect(-2, -2.5, 3, 1); g.fillStyle = '#8a8692'; g.fillRect(-2, -1.5, 1, 1); g.fillRect(1, -2, 1, 1); }
  g.restore();
}

function drawChests() {
  for (const c of chests) {
    const x = Math.round(c.x - cam + (c.shake > 0 ? (c.shake-- % 2 ? 1 : -1) : 0)), y = Math.round(c.y); if (x < -20 || x > W + 20) continue;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 11, 3.5, 0, 0, 7); g.fill();
    const gd = c.type === 'gold', cb = gd ? '#c8a020' : '#7a4a22', ch = gd ? '#ffe066' : '#9a6430', cl = gd ? '#a07a10' : '#6a3c1a';
    const ir = gd ? '#8a6410' : '#4a5064', ih = gd ? '#d8b040' : '#8a92a8'; // the iron straps (gilded on the gold chest)
    if (gd && !c.open) { g.globalCompositeOperation = 'lighter'; glowDot(g, x, y - 8, 22 + Math.sin(tickN * 0.1) * 2, '255,210,80', 0.35); g.globalCompositeOperation = 'source-over'; }
    g.fillStyle = '#0a0610'; g.fillRect(x - 10, y - 14, 20, 14);
    g.fillStyle = cb; g.fillRect(x - 9, y - 9, 18, 8); g.fillStyle = ch; g.fillRect(x - 9, y - 9, 18, 2); g.fillStyle = cl; g.fillRect(x - 9, y - 3, 18, 2); // body with plank shading
    g.fillStyle = ir; g.fillRect(x - 7, y - 9, 3, 8); g.fillRect(x + 4, y - 9, 3, 8); g.fillStyle = ih; g.fillRect(x - 7, y - 9, 1, 8); g.fillRect(x + 4, y - 9, 1, 8);
      g.fillStyle = '#0a0610'; g.fillRect(x - 6, y - 7, 1, 1); g.fillRect(x + 5, y - 7, 1, 1); g.fillRect(x - 6, y - 4, 1, 1); g.fillRect(x + 5, y - 4, 1, 1);
      // straps, rivets
    g.fillStyle = ir; g.fillRect(x - 9, y - 2, 18, 1);
    if (c.open) {
      g.fillStyle = '#ffd24a'; g.fillRect(x - 7, y - 11, 14, 3); g.fillStyle = '#fff1b0'; g.fillRect(x - 5, y - 11, 4, 1);
      g.fillStyle = cb; g.fillRect(x - 9, y - 19, 18, 4); g.fillStyle = ch; g.fillRect(x - 9, y - 19, 18, 1); g.fillStyle = ir; g.fillRect(x - 7, y - 19, 3, 4); g.fillRect(x + 4, y - 19, 3, 4); g.fillStyle = ih; g.fillRect(x - 7, y - 19, 1, 4); g.fillRect(x + 4, y - 19, 1, 4);
    } else {
      g.fillStyle = cl; g.fillRect(x - 9, y - 14, 18, 6); g.fillStyle = ch; g.fillRect(x - 9, y - 14, 18, 1); g.fillStyle = cb; g.fillRect(x - 9, y - 13, 18, 2);
      g.fillStyle = ir; g.fillRect(x - 7, y - 14, 3, 6); g.fillRect(x + 4, y - 14, 3, 6); g.fillStyle = ih; g.fillRect(x - 7, y - 14, 1, 6); g.fillRect(x + 4, y - 14, 1, 6); g.fillRect(x - 9, y - 9, 18, 1);
      g.fillStyle = '#0a0610'; g.fillRect(x - 3, y - 12, 6, 7); g.fillStyle = '#c8a040'; g.fillRect(x - 2, y - 11, 4, 5); g.fillStyle = '#ffe08a'; g.fillRect(x - 2, y - 11, 4, 1); g.fillStyle = '#0a0610'; g.fillRect(x - 0.5, y - 9, 1, 2); // lock plate and keyhole
      if (gd) { g.fillStyle = '#0a0610'; g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 4, y - 16); g.lineTo(x, y - 12.4); g.lineTo(x - 4, y - 16); g.closePath();
        g.fill(); g.fillStyle = '#ff4a6a'; g.beginPath(); g.moveTo(x, y - 19); g.lineTo(x + 3, y - 16); g.lineTo(x, y - 13.4); g.lineTo(x - 3, y - 16); g.closePath();
        g.fill(); g.fillStyle = '#ffb0c0'; g.beginPath(); g.moveTo(x, y - 19); g.lineTo(x, y - 16); g.lineTo(x - 3, y - 16); g.closePath(); g.fill();
        } // the gem on the gold chest
      if ((tickN >> 4) % 6 === 0) { g.fillStyle = '#fff1b0'; g.fillRect(x + 5, y - 15, 2, 2); }
    }
  }
}
function textO(s, x, y, size, col, align) { // a name on the floor: dark outline so it reads over any background
  s = tr(s); g.font = `bold ${size}px "Courier New",monospace`; g.textAlign = align || 'left'; g.fillStyle = '#0a0610';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) g.fillText(s, x + dx, y + dy);
  g.fillStyle = col; g.fillText(s, x, y);
}
function drawItems() {
  let li = 0;
  for (const it of items) {
    const x = Math.round(it.x - cam), y = Math.round(it.y);
    if (it.kind === 'vase') {
      const z = it.z || 0, yy = y - z + Math.sin(it.t * 0.1) * 1.5;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 7, 2.5, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, yy - 8, 1, x, yy - 8, 18); gr.addColorStop(0, 'rgba(90,170,255,0.5)'); gr.addColorStop(1, 'rgba(90,170,255,0)');
      g.fillStyle = gr; g.fillRect(x - 18, yy - 26, 36, 36); g.globalCompositeOperation = 'source-over';
      drawJar(x, yy, true, 999, 1.15);
      continue;
    }
    if (it.kind === 'gear') {
      const rar = it.it.rar, R = it.it.set ? Object.assign({}, RARITY[rar], { col: SET_GREEN, rgb: SET_GREEN_RGB }) : RARITY[rar], z = it.z || 0, yy = y - z + Math.sin(it.t * 0.1) * 1.2;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 8, 2.5, 0, 0, 7); g.fill();
      if (rar > 0) { // the light column grows with the rarity: taller, wider, and sparks climb it
        const bh = 30 + rar * 16, bw = 3 + rar; g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(0, y - bh, 0, y); gr.addColorStop(0, `rgba(${R.rgb},0)`); gr.addColorStop(1, `rgba(${R.rgb},0.6)`); g.fillStyle = gr; g.fillRect(x - bw / 2, y - bh, bw, bh);
        g.fillStyle = `rgba(255,255,255,${0.1 + 0.05 * rar})`; g.fillRect(x - 0.5, y - bh * 0.8, 1, bh * 0.8);
        if (rar >= 2) { g.strokeStyle = `rgba(${R.rgb},0.55)`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, 6 + rar * 2, (6 + rar * 2) * 0.32, 0, 0, 7); g.stroke(); }
        for (let i = 0; i < rar - 1; i++) { const sy = (it.t * 0.5 + i * 17) % bh; g.fillStyle = `rgba(${R.rgb},${0.9 - sy / bh})`; g.fillRect(x + Math.sin(sy * 0.3 + i * 2) * (bw / 2 + 1), y - sy, 1, 2); }
        glowDot(g, x, yy - 8, 16 + rar * 3, R.rgb, 0.45); g.globalCompositeOperation = 'source-over';
      }
      g.fillStyle = '#0a0610'; g.fillRect(x - 9, yy - 18, 18, 18); g.fillStyle = `rgba(${R.rgb},0.2)`; g.fillRect(x - 8, yy - 17, 16, 16);
      rarFrame(x - 8, yy - 17, 16, rar, R.col, R.rgb, !!it.it.set);
      drawIcon(g, it.it.slot, x - 7, yy - 16, 0.88, R.col);
      if (rar > 0 || (Math.abs(it.x - hero.x) < 70 && Math.abs(it.y - hero.y) < 30)) textO(iname(it.it), x, yy - 22 - (li++ % 3) * 9, 7, R.col, 'center');
      continue;
    }
    // food: a roast drumstick with the bone
    const b = Math.sin(it.t * 0.1) * 2;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 8, 2.5, 0, 0, 7); g.fill();
    g.save(); g.translate(x, y + b); g.rotate(-0.35);
    g.fillStyle = '#0a0610'; g.fillRect(2, -6, 9, 3); g.beginPath(); g.arc(11, -6.5, 2.4, 0, 7); g.arc(11, -2.5, 2.4, 0, 7); g.fill(); g.beginPath(); g.ellipse(-3, -6, 7.6, 5.6, 0, 0, 7); g.fill(); // outline
    g.fillStyle = '#f4ecd8'; g.fillRect(3, -5.5, 8, 2); g.beginPath(); g.arc(11, -6, 1.6, 0, 7); g.arc(11, -3, 1.6, 0, 7); g.fill(); g.fillStyle = '#c8bfa4'; g.fillRect(3, -4, 8, 0.8); // bone, knobbed end
    g.fillStyle = '#8a3e1c'; g.beginPath(); g.ellipse(-3, -6, 6.6, 4.6, 0, 0, 7); g.fill(); g.fillStyle = '#c0682c'; g.beginPath();
      g.ellipse(-3.6, -6.8, 5.2, 3.2, 0, 0, 7); g.fill(); g.fillStyle = '#e0904a'; g.beginPath(); g.ellipse(-4.6, -7.6, 3, 1.5, 0, 0, 7); g.fill();
      g.fillStyle = '#ffd090'; g.fillRect(-6.5, -8.6, 2, 1); // meat: shade, glaze, shine
    g.fillStyle = '#6a2c10'; g.fillRect(-7, -4, 2, 1); g.fillRect(-2, -3, 3, 1);
    g.restore();
    if ((it.t + (x | 0)) % 70 < 40) { g.fillStyle = `rgba(255,255,255,${0.25 * (1 - ((it.t + (x | 0)) % 70) / 40)})`; g.fillRect(x - 5 + Math.sin(it.t * 0.2) * 1.5, y - 14 + b - ((it.t + (x | 0)) % 70) * 0.18, 1, 3); } // a wisp of steam
  }
}

/* small ember wyrmling (original design), drawn into the sprite canvas and outlined */
function drawDragon(sx, sy, o) {
  const g = sg, white = o.flash > 0;
  const C = c => white ? '#ffffff' : c;
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(AX, AY); g.scale(o.face * (o.sc || 1), o.sc || 1);
  const PL = o.pal || {}, body = PL.body || '#c8502e', belly = PL.belly || '#f0c890', dark = PL.dark || '#8a2a22', light = PL.light || '#e0663c', spine = PL.spine || '#f0e0b0', wing = PL.wing || '#8a2a22';
  const sway = Math.sin(tickN * 0.1) * 3, st = o.moving ? Math.sin(o.anim) * 4 : 0;
  const bob = (o.moving ? Math.abs(Math.sin(o.anim)) * 1.6 : 0) + Math.sin(tickN * 0.08) * 0.6;
  P([-14, -13 - bob, -14, -7 - bob, -28 + sway, -4, -42 + sway * 1.6, -9, -38 + sway * 1.4, -15, -27 + sway, -11], dark);
  P([-38 + sway * 1.4, -15, -45 + sway * 1.7, -19, -41 + sway * 1.5, -9], spine);
  R(-10 - st, -9, 5, 9, dark); R(-11 - st, -2, 8, 2, '#2a1010'); R(10 + st, -9, 5, 9, dark); R(9 + st, -2, 8, 2, '#2a1010');
  const fl = Math.sin(tickN * (o.breathe ? 0.5 : 0.12)) * 3;
  P([-4, -22 - bob, 5, -22 - bob, 0, -38 - bob + fl, -15, -34 - bob + fl, -10, -24 - bob], wing);
  P([-4, -22 - bob, 0, -38 - bob + fl, -8, -30 - bob + fl * 0.5], dark);
  if (o.sc > 1.5 || o.wings) { // ember wyrm / storm wyrmling: huge ribbed wings behind the back
    const wf = Math.sin(tickN * 0.07) * 3;
    P([-6, -24 - bob, 8, -22 - bob, 26, -52 - bob + wf, 12, -48 - bob + wf, 14, -64 - bob + wf, -2, -50 - bob + wf, -10, -68 - bob + wf, -16, -46 - bob + wf, -30, -58 - bob + wf, -20, -30 - bob], wing);
    P([-6, -24 - bob, 26, -52 - bob + wf, 14, -64 - bob + wf, -10, -68 - bob + wf, -30, -58 - bob + wf], dark);
    for (const [wx, wy] of [[26, -52], [14, -64], [-10, -68], [-30, -58]]) { g.strokeStyle = C(spine); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6, -24 - bob); g.lineTo(wx, wy - bob + wf); g.stroke(); }
  }
  P([-18, -9 - bob, -13, -22 - bob, 0, -25 - bob, 12, -21 - bob, 18, -12 - bob, 13, -6 - bob, -14, -5 - bob], body);
  P([-14, -22 - bob, 0, -25 - bob, 12, -21 - bob, 8, -19 - bob, -8, -20 - bob], light);
  P([-12, -6 - bob, 12, -6 - bob, 15, -11 - bob, -15, -11 - bob], belly);
  for (let i = 0; i < 7; i++) { const x0 = -13 + i * 4.6, hh = i % 2 ? 5 : 7; P([x0, -22 - bob, x0 + 3.6, -23 - bob, x0 + 1.6, -22 - hh - 1 - bob], spine); P([x0 + 1.8, -22.5 - bob, x0 + 3.6, -23 - bob, x0 + 1.6, -22 - hh - 1 - bob], tone(spine, 0)); }
  for (let i = 0; i < 6; i++) R(-11 + i * 4.4, -8 - bob, 0.9, 3, tone(belly, 0)); // belly scales
  R(-12 + st, -9, 5, 9, body); R(-12 + st, -9, 2, 9, light); R(-13 + st, -2, 8, 2, '#2a1010');
  R(8 - st, -9, 5, 9, body); R(8 - st, -9, 2, 9, light); R(7 - st, -2, 8, 2, '#2a1010');
  R(-5, -26 - bob, 13, 3, '#3a2418'); R(-5, -27 - bob, 13, 1, '#c9962e'); R(-5, -24.5 - bob, 13, 1, '#e8c060'); R(1, -27 - bob, 1.5, 4, '#fff0a8'); // saddle with a gold stripe
  P([8, -18 - bob, 14, -23 - bob, 22, -35 - bob, 17, -37 - bob, 9, -27 - bob], body);
  P([14, -23 - bob, 22, -35 - bob, 19, -36 - bob, 12, -24 - bob], light);
  const jaw = o.breathe ? 6 : 1;
  P([20, -31 - bob, 33, -31 - bob + jaw, 32, -28 - bob + jaw, 19, -28 - bob], dark);
  P([17, -39 - bob, 25, -41 - bob, 35, -37 - bob, 34, -32 - bob, 20, -31 - bob, 16, -33 - bob], body);
  P([20, -39 - bob, 25, -41 - bob, 35, -37 - bob, 28, -37 - bob], light);
  if (o.breathe) { const bc = o.type === 'storm' ? ['#8ab0ff', '#ffffff'] : o.type === 'stone' ? ['#b8c8a8', '#ffffff'] : ['#ffb43a', '#fff1b0']; R(27, -32 - bob, 6, 3, bc[0]); R(28, -32 - bob, 4, 1, bc[1]); }
  R(25, -38 - bob, 3, 2, '#ffe27a'); R(27, -38 - bob, 1, 2, '#2a0a0a'); R(33, -37 - bob, 1, 1, '#2a0a0a');
  if (!white && !o.breathe) { const sc2 = o.type === 'storm' ? '#c8f0ff' : o.type === 'stone' ? '#d8e0c8' : '#ffb03a';
    for (let i = 0; i < 3; i++) { const q = (tickN * 0.5 + i * 7) % 16; R(35 + q * 0.7, -36 - bob - q * 0.45 + Math.sin(q + i) * 1.2, 1, 1, i % 2 ? sc2 : '#fff1b0');
    } } // sparks drift off the snout
  P([18, -40 - bob, 11, -47 - bob, 21, -41 - bob], '#e6dcc4'); P([20, -39 - bob, 15, -44 - bob, 22, -40 - bob], '#bfb49a');
  if (o.horns && !(o.sc > 1.5)) { // stone wyrmling: curved horns and back plates
    P([14, -39 - bob, 5, -52 - bob, 18, -41 - bob], '#e6dcc4'); P([22, -40 - bob, 22, -54 - bob, 27, -41 - bob], '#bfb49a');
    for (let i = 0; i < 4; i++) { R(-9 + i * 6, -25 - bob, 5, 3, '#2a3228'); R(-9 + i * 6, -25 - bob, 5, 1, '#8a9a86'); }
    R(8, -36 - bob, 10, 2, '#3a4438');
  }
  if (o.type === 'storm' && !white) { g.globalAlpha = 0.5 + Math.sin(tickN * 0.4) * 0.3; R(24, -39 - bob, 3, 2, '#e8f6ff'); R(-3, -21 - bob, 1, 6, '#bfe6ff'); R(7, -19 - bob, 1, 5, '#bfe6ff'); g.globalAlpha = 1; }
  if (o.sc > 1.5) { // horns, lava cracks, blazing eye
    P([14, -39 - bob, 4, -55 - bob, 18, -41 - bob], '#e6dcc4'); P([22, -40 - bob, 20, -56 - bob, 26, -41 - bob], '#bfb49a');
    const lv = 0.6 + Math.sin(tickN * 0.12) * 0.4; g.globalAlpha = white ? 1 : 0.6 + lv * 0.4;
    for (const [cx, cy, cw, ch] of [[-9, -19, 1, 6], [-3, -21, 1, 8], [4, -18, 1, 6], [9, -20, 1, 5], [-12, -12, 4, 1], [2, -14, 5, 1], [-6, -9, 1, 4]]) R(cx, cy - bob, cw, ch, '#ff9a2a');
    R(-2, -17 - bob, 1, 2, '#fff1b0'); R(6, -16 - bob, 1, 2, '#fff1b0'); g.globalAlpha = 1;
    R(24, -39 - bob, 5, 3, '#fff1b0'); R(26, -39 - bob, 2, 3, '#ff3a2a');
  }
  g.restore();
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.globalCompositeOperation = 'source-over'; sil.clearRect(0, 0, SW, SH); sil.globalAlpha = 1;
  sil.drawImage(spriteCv, 0, 0); sil.globalCompositeOperation = 'source-in'; sil.fillStyle = '#0b0610'; sil.fillRect(0, 0, SW, SH);
  const x0 = Math.round(sx) - AX, y0 = Math.round(sy) - AY;
  const ow = o.sc > 1 ? 2 : 1;
  for (const [dx, dy] of [[-ow, 0], [ow, 0], [0, -ow], [0, ow]]) MAIN.drawImage(silCv, x0 + dx, y0 + dy);
  MAIN.drawImage(spriteCv, x0, y0);
}

/* the giant dragon head that smashes the arena (original design, frontal view): angular skull, swept-back bone horns and cheek spikes,
   golden brow wedge with a glowing Ember Jar ember, slanted eyes under a dark brow, lava cracks, open jaw with fangs and a glowing throat.
   The throat light, cracks and eyes take the colour of the hero's element (fire / frost / lightning). open: 0 = jaw ajar, 1 = wide open */
function drawGiantHead(cx, cy, s, glow, open) {
  open = open || 0;
  const E = ELEM[rpg.elem || 'fire'], CK = E.col, EY = E.col2, RG = E.rgb;
  const gap = 6 + open * 40;
  const pulse = 0.8 + Math.sin(tickN * 0.2) * 0.2;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  const lw = 2 / s, OUT = '#12060a';
  const shape = (pts, fill, stroke) => { // a symmetrical plate: the points are the right half, from the centre line out and back
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    for (let i = pts.length - 2; i >= 0; i -= 2) g.lineTo(-pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = OUT; g.lineWidth = lw; g.stroke(); }
  };
  const side = (pts, fill, m, stroke) => { // one piece, mirrored by m (1 right, -1 left)
    g.beginPath(); g.moveTo(pts[0] * m, pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * m, pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke !== false) { g.strokeStyle = OUT; g.lineWidth = lw; g.stroke(); }
  };
  const glowAt = (x, y, r, rgb, a) => { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = 'source-over'; };
  // charge halo behind the head
  glowAt(0, -120, 200, RG, 0.08 + 0.22 * glow);
  // neck
  shape([0, -430, 30, -430, 40, -100, 34, -44, 0, -40], '#4a1420', true);
  for (let y = -410; y < -80; y += 22) { const hw = 30 + 10 * ((y + 430) / 340); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-hw, y, hw * 2, 3); g.fillStyle = 'rgba(200,80,60,0.12)'; g.fillRect(-hw, y + 3, hw * 2, 1); }
  // lower jaw (stays on the ground; the skull lifts off it as the mouth opens)
  shape([0, -2, 24, -4, 46, -12, 60, -30, 48, -54, 0, -48], '#7a1c2a', true);
  shape([0, -2, 24, -4, 46, -12, 36, -22, 0, -20], 'rgba(30,4,10,0.35)', false);
  shape([0, -48, 48, -54, 44, -45, 0, -42], '#9a2434', false);
  side([30, -36, 56, -34, 46, -14, 28, -22], 'rgba(255,150,130,0.12)', 1, false); side([30, -36, 56, -34, 46, -14, 28, -22], 'rgba(255,150,130,0.12)', -1, false);
  // throat: dark, then the element light grows with the charge
  const th = 50 + gap;
  shape([0, -th, 38, -th, 42, -46, 0, -46], '#14040a', false);
  glowAt(0, -(th + 46) / 2, 22 + 34 * glow + open * 16, RG, 0.3 + 0.6 * glow * (0.35 + 0.65 * open));
  if (open > 0.2) glowAt(0, -(th + 46) / 2, 12 + 8 * open, '255,255,255', 0.25 * open * glow + 0.1 * open);
  for (const xx of [-38, -25, -13, 0, 13, 25, 38]) { const big = Math.abs(xx) === 38; g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 3.5, -47); g.lineTo(xx + 3.5, -47); g.lineTo(xx, -47 - (big ? 20 : 12)); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = lw * 0.5; g.stroke(); }
  // the skull, lifted by the jaw gap
  g.translate(0, -gap);
  for (const m of [1, -1]) { // swept-back bone horns, behind the skull
    side([44, -168, 82, -190, 112, -204, 128, -238, 108, -184, 84, -156, 56, -140], '#e6dcc4', m);
    side([58, -148, 84, -160, 108, -184, 98, -170, 80, -150], '#bfb49a', m, false);
    g.strokeStyle = 'rgba(90,70,50,0.55)'; g.lineWidth = lw * 0.8;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(m * (62 + i * 15), -156 - i * 12); g.lineTo(m * (72 + i * 15), -170 - i * 12); g.stroke(); }
  }
  shape([0, -198, 28, -194, 58, -172, 72, -134, 62, -112, 52, -92, 50, -66, 44, -50, 0, -50], '#9a2434', true);
  shape([0, -112, 62, -112, 52, -92, 50, -66, 44, -50, 0, -50], 'rgba(58,10,20,0.5)', false); // shadowed lower face (#7a1c2a)
  shape([0, -180, 6, -174, 12, -100, 0, -92], '#b8404a', false); // bridge highlight
  for (const m of [1, -1]) { // angular facets
    side([28, -194, 58, -172, 42, -160, 18, -178], '#aa2c3e', m, false);
    side([72, -134, 62, -112, 52, -92, 56, -122], '#7a1c2a', m, false);
    side([42, -160, 58, -172, 66, -146, 46, -138], 'rgba(255,150,130,0.16)', m, false);
    side([50, -66, 52, -92, 40, -84, 36, -66], 'rgba(20,2,8,0.28)', m, false);
  }
  // cheek spikes, bone
  for (const m of [1, -1]) { side([62, -112, 102, -132, 76, -96], '#e6dcc4', m); side([52, -82, 92, -86, 58, -64], '#bfb49a', m); }
  // lava cracks in the element's colour
  const cracks = [[26, -188, 30, -170, 24, -158, 34, -146, 30, -132], [60, -122, 50, -106, 52, -90, 44, -72], [8, -92, 14, -78, 8, -66], [38, -176, 48, -168, 54, -150]];
  const ca = 0.35 + 0.65 * glow;
  for (const pass of [0, 1, 2]) {
    g.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over';
    g.strokeStyle = pass === 0 ? `rgba(${RG},${0.22 * ca})` : pass === 1 ? CK : EY; g.globalAlpha = pass === 0 ? 1 : ca * pulse;
    g.lineWidth = lw * (pass === 0 ? 3.2 : pass === 1 ? 1.3 : 0.5); if (pass === 2 && glow < 0.5) continue;
    for (const m of [1, -1]) for (const c of cracks) { g.beginPath(); g.moveTo(c[0] * m, c[1]); for (let i = 2; i < c.length; i += 2) g.lineTo(c[i] * m, c[i + 1]); g.stroke(); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // golden brow wedge with the glowing Ember Jar ember
  shape([0, -190, 13, -174, 10, -134, 0, -116], '#ffd24a', true);
  shape([0, -184, 6, -174, 4, -142, 0, -132], '#fff0a0', false);
  glowAt(0, -154, 20, '255,150,40', (0.45 + 0.4 * glow) * pulse);
  g.fillStyle = '#fff1b0'; g.beginPath(); g.moveTo(0, -164); g.lineTo(4, -154); g.lineTo(0, -143); g.lineTo(-4, -154); g.closePath(); g.fill();
  // dark brow arches and slanted eyes
  for (const m of [1, -1]) {
    side([4, -118, 28, -136, 56, -144, 63, -133, 34, -125, 12, -108], '#2a0a10', m);
    glowAt(m * 32, -118, 20, RG, 0.25 + 0.4 * glow);
    side([10, -112, 30, -124, 54, -128, 46, -116, 28, -108], EY, m);
    g.fillStyle = '#1a0508'; g.fillRect(m * 33 - 1.5, -123, 3, 12);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(m * 22 - 1, -117, 4, 1.5);
  }
  // nostrils
  for (const m of [1, -1]) { g.fillStyle = '#1a0508'; g.fillRect(m * 9 - 3, -90, 6, 3); glowAt(m * 9, -88, 9, RG, 0.12 + 0.3 * glow); }
  // upper jaw: gum line and fangs (drawn last so they overlap the throat)
  shape([0, -55, 48, -55, 44, -50, 0, -50], '#5a0e1c', false);
  for (const xx of [-38, -25, -12, 12, 25, 38]) { const big = Math.abs(xx) === 38; g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 4, -50); g.lineTo(xx + 4, -50); g.lineTo(xx, -50 + (big ? 28 : 15)); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = lw * 0.5; g.stroke(); }
  g.restore();
}

/* ground ring of the wrath: a dashed ring of fire (or frost, or lightning) that opens with the charge and flares on impact */
function dragonRing(t, d) {
  const RG = ELEM[rpg.elem || 'fire'].rgb, cx = W / 2, cy = 220;
  const grow = t < 62 ? 0.3 + 0.3 * clamp((t - 6) / 56, 0, 1) : 0.6 + 0.5 * clamp((t - 62) / 24, 0, 1);
  const a = t < 62 ? 0.15 + 0.4 * clamp((t - 6) / 56, 0, 1) : t < 100 ? 0.95 : Math.max(0, 0.95 * (1 - (t - 100) / 28));
  if (a <= 0) return;
  const rx = 150 * d.size * grow, off = (tickN * 1.6) | 0;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [k, w, dir] of [[1, 2.5, 1], [0.72, 1.5, -1]]) {
    g.setLineDash([10 * k, 7 * k]); g.lineDashOffset = -off * dir;
    g.strokeStyle = `rgba(${RG},${a * (k === 1 ? 1 : 0.6)})`; g.lineWidth = w;
    g.beginPath(); g.ellipse(cx, cy, rx * k, rx * k * 0.3, 0, 0, 7); g.stroke();
  }
  g.setLineDash([]); g.restore();
}

function drawDragonCast() {
  const d = dragon, t = d.t, RG = ELEM[rpg.elem || 'fire'].rgb;
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
  const open = t < 62 ? 0.12 * clamp((t - 30) / 32, 0, 1) : t < 84 ? Math.max(0.12, Math.min(1, (t - 62) / 5)) : Math.max(0.1, 1 - (t - 84) / 30);
  // 1. shadow: a dark pool grows on the ground as the head comes down, then fades after the impact
  const sh = t < 62 ? 0.5 * clamp(t / 50, 0, 1) : 0.5 * Math.min(1, (104 - t) / 30);
  if (sh > 0) { const w = (t < 62 ? 60 + 60 * clamp(t / 62, 0, 1) : 120) * d.size; g.fillStyle = `rgba(0,0,0,${sh})`; g.beginPath(); g.ellipse(W / 2, 220, w, 14, 0, 0, 7); g.fill(); }
  dragonRing(t, d);
  // 4. retreat: the head leaves a glowing trail (a column of light up to the sky and a scorch on the ground)
  if (t >= 84) {
    const q = clamp((t - 84) / 44, 0, 1), tw = 34 * d.size;
    g.globalCompositeOperation = 'lighter';
    const tg = g.createLinearGradient(W / 2 - tw, 0, W / 2 + tw, 0);
    tg.addColorStop(0, `rgba(${RG},0)`); tg.addColorStop(0.5, `rgba(${RG},${0.5 * (1 - q)})`); tg.addColorStop(1, `rgba(${RG},0)`);
    g.fillStyle = tg; g.fillRect(W / 2 - tw, 0, tw * 2, Math.max(0, chin + 20));
    const sg = g.createRadialGradient(W / 2, 221, 2, W / 2, 221, 90 * d.size); sg.addColorStop(0, `rgba(${RG},${0.45 * (1 - q)})`); sg.addColorStop(1, `rgba(${RG},0)`);
    g.save(); g.translate(0, 221); g.scale(1, 0.25); g.translate(0, -221); g.fillStyle = sg; g.fillRect(W / 2 - 90 * d.size, 221 - 90 * d.size, 180 * d.size, 180 * d.size); g.restore();
    g.globalCompositeOperation = 'source-over';
  }
  if (t >= 30 && chin > -180) drawGiantHead(W / 2, chin, 0.95 * d.size, glow, open);
}

function drawParts(addOnly) {
  for (const p of parts) {
    if (p.ring) { const t = 1 - p.life / p.max, r = t * 120; g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${p.rgb || '255,' + (180 - t * 100 | 0) + ',60'},${1 - t})`; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x - cam, p.y, r, r * 0.35, 0, 0, 7);
      g.stroke(); g.globalCompositeOperation = 'source-over'; continue; }
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
  const fw = Math.max(0, w * v / max) | 0, hex = /^#[0-9a-f]{6}$/i.test(c1);
  g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = c2; g.fillRect(x, y, w, h);
  g.fillStyle = c1; g.fillRect(x, y, fw, h);
  g.fillStyle = hex ? mixHex(c1, '#ffffff', 0.5) : 'rgba(255,255,255,0.35)'; g.fillRect(x, y, fw, h >= 5 ? 2 : 1); // a lighter stripe along the top
  if (h >= 5) { g.fillStyle = hex ? mixHex(c1, '#000000', 0.3) : 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 1, fw, 1); }
}
function lvText(label, x, y, size, col, align) { // a level line with the blue paragon count after it
  text(label, x, y, size, col, align);
  if (rpg.lvl < MAX_LV) return; const w = g.measureText(tr(label)).width, x0 = align === 'center' ? x + w / 2 : x + w;
  text(' +' + rpg.pg, x0, y, size, '#5ab4ff', 'left');
}
function text(s, x, y, size, col, align) {
  s = tr(s);
  g.font = `bold ${size}px "Courier New",monospace`; g.textAlign = align || 'left'; g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
}
const WYRM_PAL = { body: '#3a2230', belly: '#d06a2a', dark: '#1a0c16', light: '#6a3a4a', spine: '#ffb43a', wing: '#7a1c2c' };
function drawWyrm(f, sx, sy) {
  const sh = clamp(1 - f.z / 90, 0.3, 1);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 64 * sh, 9 * sh, 0, 0, 7); g.fill();
  if (f.dead) g.globalAlpha = clamp(1 - f.fade / 50, 0, 1);
  const br = (f.st === 'wind' || f.st === 'eatk') && (f.atk === 'breath' || f.atk === 'bite' || f.atk === 'flames');
  drawDragon(sx, sy - f.z, { face: f.face, anim: f.anim, flash: f.flash, moving: f.st === 'walk', breathe: br, sc: 2.4, pal: WYRM_PAL });
  g.globalAlpha = 1;
  if (f.st === 'wind' && !f.dead) {
    const mx = Math.round(sx + f.face * 80), my = Math.round(sy - f.z - 75);
    g.globalCompositeOperation = 'lighter'; glowDot(g, mx, my, 16 + (tickN % 8), '255,160,50', 0.7); g.globalCompositeOperation = 'source-over';
    if ((tickN >> 1) & 1) { g.fillStyle = '#ff3b2a'; g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - 112), 3, 7); g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - 103), 3, 2); }
  }
}
function drawElemIcon(el, x, y) { // 7x7 pixel glyphs: flame, snowflake, bolt
  const c = ELEM[el].col, w = ELEM[el].col2; g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, 9, 9);
  if (el === 'fire') { g.fillStyle = c; g.fillRect(x + 2, y, 2, 2); g.fillRect(x + 1, y + 2, 4, 3); g.fillRect(x, y + 4, 6, 2); g.fillStyle = w; g.fillRect(x + 2, y + 4, 2, 3); }
  else if (el === 'frost') { g.fillStyle = c; g.fillRect(x + 3, y, 1, 7); g.fillRect(x, y + 3, 7, 1); g.fillStyle = w; g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 5, y + 1, 1, 1); g.fillRect(x + 1, y + 5, 1, 1); g.fillRect(x + 5, y + 5, 1, 1); }
  else { g.fillStyle = c; g.fillRect(x + 3, y, 3, 1); g.fillRect(x + 2, y + 1, 2, 1); g.fillRect(x + 1, y + 2, 3, 1); g.fillRect(x + 2, y + 3, 4, 1); g.fillRect(x + 3, y + 4, 2, 1); g.fillRect(x + 2, y + 5, 2, 1); g.fillStyle = w; g.fillRect(x + 3, y + 2, 1, 1); }
}
function drawCrown(x, y) { // a 9x7 pixel crown
  g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, 11, 9); g.fillStyle = '#ffd24a';
  g.fillRect(x, y + 1, 2, 3); g.fillRect(x + 3, y, 3, 4); g.fillRect(x + 7, y + 1, 2, 3); g.fillRect(x, y + 4, 9, 3);
  g.fillStyle = '#fff1b0'; g.fillRect(x, y + 4, 9, 1); g.fillStyle = '#ff4a6a'; g.fillRect(x + 4, y + 5, 1, 1); g.fillStyle = '#8a5a10'; g.fillRect(x, y + 6, 9, 1);
}
function drawElemTags(e, x, y, right) { // weak (green up-arrow) and resistant (red down-arrow) elements of a monster, shown beside its health bar
  const t = ELEM_RES[e.kind]; if (!t) return; let i = 0;
  for (const el of ELEMS) {
    const v = t[el]; if (!v || (v > 0.9 && v < 1.1)) continue; const xx = right ? x - i * 18 : x + i * 18; i++;
    drawElemIcon(el, xx, y); g.fillStyle = v > 1 ? '#7aff9a' : '#ff6a6a';
    if (v > 1) { g.fillRect(xx + 9, y + 1, 1, 5); g.fillRect(xx + 8, y + 2, 3, 1); } else { g.fillRect(xx + 9, y + 1, 1, 5); g.fillRect(xx + 8, y + 4, 3, 1); }
  }
}
function drawHUD() {
  if (clearT > 0) { text(clearT > LOOT_T - 150 ? 'STAGE CLEAR' : 'LOOT TIME  -  GRAB THE DROPS', W / 2, 200, 11, '#ffd24a', 'center'); text('ENTER: CONTINUE TO THE MARKET   ' + Math.ceil(clearT / 60) + 'S', W / 2, 214, 8, '#fff', 'center'); }
  text('GOLD ' + rpg.gold, W - 12, 62, 8, '#ffd24a', 'right');
  lvText(cls().name + '  LV ' + rpg.lvl, 12, 18, 11, cls().col);
  if (!daily && crownsOf(CLS)) { drawCrown(128, 11); text('x' + crownsOf(CLS), 139, 18, 7, '#ffd24a'); }
  if (daily) {
    text('RACE ' + fmtTime(daily.t), W - 12, 72, 8, '#ffd24a', 'right'); text('GOAL: LV ' + MAX_LV + ' + PG ' + PG_MAX, W - 12, 82, 7, '#c9a86a', 'right');
    if (!daily.done) { const p = paceInfo(); if (p && p.none) text('NO ONE HAS FINISHED YET', W - 12, 92, 7, '#8a7a9a', 'right');
      else if (p) { const late = daily.t > p.t; text((late ? 'BEHIND ' : 'TO BEAT ') + p.n + ' ' + fmtTime(p.t), W - 12, 92, 7, late ? '#ff8a6a' : '#9ad08a', 'right');
      } // the pace line: the best finished time online
      const q = daily.last; if (q) text(splitName(q.k) + '  ' + (q.d == null ? fmtTime(q.t) : fmtDelta(q.d)), W - 12, 102, 7, q.d == null ? '#c9a86a' : q.d > 0 ? '#ff8a6a' : '#9ad08a', 'right'); } // the last split: time, or the gap to the leader
  }
  bar(12, 22, 110, 7, hero.hp, hero.maxhp, '#d94a3a', '#3a1418');
  if (rpg.lvl >= MAX_LV) bar(12, 40, 110, 2, rpg.pg >= PG_MAX ? 1 : rpg.pxp, rpg.pg >= PG_MAX ? 1 : pgNeed(rpg.pg), '#3a8aff', '#101a30'); // at the cap the bar fills toward the next paragon point
  else bar(12, 40, 110, 2, rpg.xp, xpNeed(rpg.lvl), '#8a6aff', '#1c1430');
  text(hero.vases ? 'SHIFT: DRAGON WRATH' : 'WRATH NEEDS AN EMBER JAR', 12, 52, 8, hero.vases ? '#ffd24a' : '#6a5a40');
  { const S = skillOf(hero); if (S) { text('U: ' + skName(S, hero), 12, 62, 7, hero.skcd > 0 ? '#6a7a90' : '#8cc4ff'); if (hero.skcd > 0) bar(12, 64, 80, 2, S.cd - hero.skcd, S.cd, '#8cc4ff', '#1c2a3a'); } else text('SKILL AT LV 10', 12, 62, 7, '#4a4a5a'); }
  for (let i = 0; i < 3; i++) drawJar(20 + i * 15, 92, i < hero.vases, i === hero.vases - 1 ? tickN - (hero.jt || -999) : 999);
  text(hero.vases ? `+${hero.vases * 15}%` : 'JARS', 62, 89, 8, hero.vases ? '#7fd0ff' : '#5a6a80');
  if (hero.mount) { const T = mtype(hero.mount); text(T.name.split(' ')[0] + '  GRIP ' + (2 - (hero.mount.falls || 0)), 12, 108, 8, T.col); bar(12, 111, 70, 4, hero.mount.hp, hero.mount.maxhp, T.col, '#2a1a20'); }
  if (coop && hero2) { const p = hero2; text(CLASSES[CLS2].name, 12, 128, 10, p.dead ? '#6a6a70' : '#8affb0');
    bar(12, 132, 110, 7, Math.max(0, p.hp), p.maxhp, '#d94a3a', '#3a1418'); if (p.vases) text('+' + p.vases * 15 + '%', 98, 147, 7, '#7fd0ff');
    if (p.dead && rpg.coins > 0 && !hero.dead) text('RETURNS SOON (-1 COIN)', 12, 158, 7, '#8878a0'); }
  if (coop && hero.dead && hero2 && !hero2.dead && rpg.coins > 0) text('RETURNS SOON (-1 COIN)', 12, 116, 7, '#8878a0');
  text('COINS', W - 56, 49, 7, '#b8a8c8', 'right'); drawCoins(W - 46, 46, rpg.coins, 14);
  text('I: GEAR', W - 8, H - 6, 7, '#7a6a8a', 'right');
  text(String(score).padStart(7, '0'), W / 2, 18, 12, '#fff1b0', 'center');
  if (!bonus && killCombo >= 2 && tickN - killComboT <= KC_WINDOW) { const a = 1 - (tickN - killComboT) / KC_WINDOW;
    text('KILL COMBO x' + killCombo, W - 8, 70, 9, '#ffb43a', 'right'); text('XP +' + Math.round(kcBonus() * 100) + '%', W - 8, 81, 8, '#8fc8ff', 'right');
    g.fillStyle = '#3a5a8a'; g.fillRect(W - 8 - 60 * a, 86, 60 * a, 2); }
  drawBuffHud();
  if (bonus) drawBonusHud();
  else if (bossRef && !bossRef.dead && bossRef.hp > 0) { { const bc = BOSS_COL[bossRef.kind] || '#e0742a';
    text(bossRef.k.name, W / 2, 33, 9, bossRef.p2 ? tone(bc, 3) : tone(bc, 2), 'center');
    bar(W / 2 - 110, 37, 220, 6, Math.max(0, bossRef.hp), bossRef.maxhp, bossRef.p2 ? tone(bc, 2) : bc, tone(bc, 0));
    } if (rpg.lvl >= 10) drawElemTags(bossRef, W / 2 + 116, 35, false); }
  else text((cycle ? trialName(cycle) + '  ' : '') + 'STAGE ' + (stageIdx + 1) + '  ' + STAGES[stageIdx].name, W / 2, 31, 8, cycle ? '#e0a8ff' : '#b8a8c8', 'center');
  if (stageCard > 0) { const a = Math.min(1, stageCard / 40, (190 - stageCard) / 25); g.globalAlpha = Math.max(0, a); g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 92, W, 70); text((cycle ? trialName(cycle) + '  ' : '') + 'STAGE ' + (stageIdx + 1), W / 2, 114, 12, '#ffb43a', 'center');
    text(STAGES[stageIdx].name, W / 2, 138, 20, '#fff1d0', 'center'); text(STAGES[stageIdx].tag, W / 2, 154, 8, '#c9a8ff', 'center'); g.globalAlpha = 1; }
  if (lastEnemy && lastEnemy !== bossRef && !lastEnemy.dead && lastEnemy.hp > 0) { text(lastEnemy.k.name, W - 12, 18, 10, '#ffa060', 'right');
    bar(W - 142, 22, 130, 7, lastEnemy.hp, lastEnemy.maxhp, '#e0742a', '#3a1c10');
    if (lastEnemy.barrier > 0) bar(W - 142, 30, 130, 4, lastEnemy.barrier, lastEnemy.bmax, '#9ae8ff', '#1a2440');
    if (rpg.lvl >= 10) drawElemTags(lastEnemy, W - 160, 21, true); }
  if (goBlink > 0 && (goBlink >> 4) & 1) { text('GO', W - 40, 120, 18, '#fff1b0', 'center'); g.fillStyle = '#fff1b0'; g.beginPath(); g.moveTo(W - 22, 105); g.lineTo(W - 8, 115); g.lineTo(W - 22, 125); g.fill(); }
  if (msgT > 0) { g.globalAlpha = Math.min(1, msgT / 30); text(msg, W / 2, 88, msg.length > 10 ? 14 : 18, '#ff8a4a', 'center'); g.globalAlpha = 1; }
}

const DONATE_URL = 'https://www.paypal.com/paypalme/cooldance84';
let donateBox = null, dailyBox = null, cloudBox = null;
function drawDonate(y) {
  const t = tr('LIKED IT? DONATE TO KEEP EMBERFALL GROWING  -  CLICK OR PRESS D');
  g.font = '8px "Courier New",monospace'; const w = g.measureText(t).width + 12;
  donateBox = { x: W / 2 - w / 2, y: y - 9, w, h: 13 };
  g.fillStyle = 'rgba(40,16,4,0.75)'; g.fillRect(donateBox.x, donateBox.y, w, 13); g.strokeStyle = '#ffb43a'; g.strokeRect(donateBox.x + 0.5, donateBox.y + 0.5, w - 1, 12);
  text(t, W / 2, y, 8, '#ffd24a', 'center');
}
function openDonate() { try { window.open(DONATE_URL, '_blank', 'noopener'); } catch (e) {} }
screen.addEventListener('pointerup', e => {
  if (mode === 'resume') { const r = screen.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * H; const i = y > 155 && y < 175 ? 0 : y > 177 && y < 197 ? 1 : -1; if (i >= 0) { if (resumeSel === i) { pressed.Enter = true; } else resumeSel = runInfo.coins > 0 ? i : 1; } return; }
  if (mode === 'dailyinfo') { const r = screen.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, b = dailyBtns.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (b && b.go) openBoard(1); else openSelect(false, true); return; }
  if (mode === 'journey') { const r = screen.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; if (journeyBox && y >= journeyBox.y && y <= journeyBox.y + journeyBox.h) jrCycle(1); else { mode = 'title'; SFX.pick(); } return; }
  if (shareBox && (mode === 'board' || mode === 'victory')) { const r = screen.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; if (x >= shareBox.x && x <= shareBox.x + shareBox.w && y >= shareBox.y && y <= shareBox.y + shareBox.h) { shareCard(); return; } }
  if (mode === 'board') { const r = screen.getBoundingClientRect(); boardClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); return; }
  if (mode === 'cloud') { const r = screen.getBoundingClientRect(); cloudClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); return; }
  if (mode === 'select') { const r = screen.getBoundingClientRect(); selClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); return; }
  if (!donateBox && !dailyBox && !cloudBox && !journeyBox) return; const r = screen.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  if (dailyBox && mode === 'title' && x >= dailyBox.x && x <= dailyBox.x + dailyBox.w && y >= dailyBox.y && y <= dailyBox.y + dailyBox.h) { openDailyInfo(); return; }
  if (journeyBox && mode === 'title' && x >= journeyBox.x && x <= journeyBox.x + journeyBox.w && y >= journeyBox.y && y <= journeyBox.y + journeyBox.h) { openJourney(); return; }
  if (cloudBox && mode === 'title' && x >= cloudBox.x && x <= cloudBox.x + cloudBox.w && y >= cloudBox.y && y <= cloudBox.y + cloudBox.h) { openCloud(); return; }
  if (donateBox && x >= donateBox.x && x <= donateBox.x + donateBox.w && y >= donateBox.y && y <= donateBox.y + donateBox.h) openDonate();
});
screen.addEventListener('pointermove', e => {
  if (!donateBox) { screen.style.cursor = ''; return; } const r = screen.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  screen.style.cursor = (x >= donateBox.x && x <= donateBox.x + donateBox.w && y >= donateBox.y && y <= donateBox.y + donateBox.h) ? 'pointer' : '';
});
addEventListener('keydown', e => { if (e.code === 'KeyY' && (mode === 'victory' || mode === 'board')) shareCard(); });
addEventListener('keydown', e => { if (e.code === 'KeyD' && donateBox && (mode === 'title' || mode === 'victory' || mode === 'gameover' || mode === 'board')) openDonate(); });
