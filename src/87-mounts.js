/* ---------- mounts, pilferers, dragon wrath ---------- */
const MOUNT_TYPES = {
  ember: { name: 'EMBER WYRMLING', hp: 70, spd: 2.4, jump: 6, sc: 1, col: '#ff9a6a', info: 'FLAME BREATH' },
  storm: { name: 'STORM WYRMLING', hp: 55, spd: 3.0, jump: 7.4, sc: 0.92, col: '#8ab0ff', wings: true, info: 'CHAIN LIGHTNING', pal: { body: '#3a5ac8', belly: '#bfd0ff', dark: '#1c2a6a', light: '#6a8aff', spine: '#c8f0ff', wing: '#4a2a9a' } },
  stone: { name: 'STONE WYRMLING', hp: 120, spd: 1.9, jump: 5, sc: 1.15, col: '#b8c8a8', horns: true, info: 'SHOCKWAVE + STOMP', pal: { body: '#5a6a58', belly: '#c8c0a0', dark: '#2a3228', light: '#7a8a76', spine: '#e6dcc4', wing: '#4a5a48' } }
};
function pickMountType() { const a = ['ember']; if (stageIdx >= 1 || cycle) a.push('storm'); if (stageIdx >= 2 || cycle) a.push('stone'); return a[Math.random() * a.length | 0]; }
function makeMount(x, y, hp, type) { type = type || 'ember'; const T = MOUNT_TYPES[type]; return { isMount: true, type, x, y, z: 0.01, vz: 3, face: 1, hp: hp || T.hp, maxhp: T.hp, falls: 0, t: 0, anim: 0, flash: 0, h: 30 }; }
const mtype = m => MOUNT_TYPES[(m && m.type) || 'ember'];
function zap(x0, y0, z0, x1, y1, z1) {
  for (let i = 0; i <= 9; i++) { const k = i / 9; parts.push({ x: x0 + (x1 - x0) * k + rnd(-3, 3), y: y0 + (y1 - y0) * k, z: z0 + (z1 - z0) * k + rnd(-4, 4), vx: 0, vy: 0, vz: 0, life: rnd(5, 10), max: 12, g: 0, c: i % 2 ? '#ffffff' : '#8ab0ff', size: 2, add: true }); }
}
function updateMounts() {
  for (const m of mounts) {
    if (m.flee) { m.t++; m.anim += 0.45; m.x += m.dir * 3.4; m.face = m.dir; m.z += m.vz; m.vz -= 0.3; if (m.z <= 0) { m.z = 0; m.vz = 0; } if (m.t % 4 === 0) dust(m.x, m.y, 1); if (m.x < cam - 140 || m.x > cam + W + 140) m.gone = true; continue; }
    m.t++; if (m.flash > 0) m.flash--; m.anim += 0.03;
    m.z += m.vz; m.vz -= 0.3; if (m.z <= 0) { m.z = 0; m.vz = 0; }
    m.face = sgn(nearestPlayer(m.x).x - m.x) || m.face;
    if (m.t % 20 === 0) spawn(m.x + m.face * 30, m.y, 30, 1, { c: '#8a7a8a', s0: 0.1, s1: 0.3, l0: 20, l1: 34, up: 0.5, g: -0.01, size: 2 });
  }
  mounts = mounts.filter(m => !m.gone);
}
function updateImp(e) {
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; return; }
  if (groundPhysics(e)) return;
  e.st = 'walk'; e.anim += e.fled ? 0.5 : 0.35; e.face = e.dir;
  e.x += e.dir * (e.fled ? 3 : 1.9); e.y = clamp(e.y + Math.sin(e.t * 0.12) * 0.35, Y_MIN, Y_MAX);
  if (gapAt(e.x, 4)) e.z = Math.min(26, e.z + 3.5); else if (e.z > 0) e.z = Math.max(0, e.z - 3); // it hops over chasms and barricades like the husks do
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
  hero.vases = 0; hero.st = 'magic'; hero.t = 0; hero.inv = 190;
  dragon = { t: 0, v, mult: 1 + 0.15 * v, size: 1 + 0.15 * v, by: hero };
  msg = v ? `DRAGON'S WRATH  +${v * 15}%` : "DRAGON'S WRATH"; msgT = 120; SFX.magic();
}
function stepDragon() {
  const d = dragon; d.t++;
  if (d.t === 6) sfxTone('sawtooth', 55, 30, 1.2, 0.1);
  if (d.t < 62 && d.t % 18 === 0) { flashA = 0.35; sfxTone('square', 220, 40, 0.2, 0.05); }
  if (d.t === 62) dragonImpact();
  if (d.t > 84 && d.t < 120 && d.t % 3 === 0) { const E = ELEM[rpg.elem || 'fire']; spawn(cam + W / 2 + rnd(-30, 30), rnd(Y_MIN, Y_MAX), 4, 2, { c: [E.col, E.col2], s0: 0.1, s1: 0.5, l0: 20, l1: 40, up: 2.2, g: -0.02, size: 2, add: true }); } // the glowing trail it leaves behind
  if (d.t >= 128) { d.by.inv = Math.max(d.by.inv, 30); dragon = null; }
}
function dragonImpact() {
  const d = dragon, flat = 130 * d.mult * Math.max(1, pstats().mult); shots = [];
  hero.st = 'idle'; hero.t = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    e.inv = 0; if (e.st === 'down' || e.st === 'getup') e.st = 'idle';
    // the wrath scales with your power and bites a share of the foe's health: 40% to 85% of a husk, 15% to 36% of a boss (more jars, more bite)
    const share = isBoss(e) ? 0.15 + 0.07 * d.v : 0.4 + 0.15 * d.v;
    hurt(e, Math.max(flat, Math.round(e.maxhp * share)), 'down', { x: cam + W / 2, face: 1 });
  }
  for (const c of chests) if (!c.open && c.x > cam - 10 && c.x < cam + W + 10) { c.hp = 1; openChest(c); } // the wrath smashes every chest on screen open
  shake = 22; freeze = 8; flashA = 1;
  SFX.big(); sfxTone('sawtooth', 70, 20, 0.9, 0.14);
  const ER = ELEM[rpg.elem || 'fire'];
  for (let i = 0; i < 3; i++) parts.push({ ring: true, rgb: ER.rgb, x: cam + W / 2, y: 215, z: 4, life: 26 + i * 6, max: 26 + i * 6 });
  for (let i = 0; i < 16 + d.v * 4; i++) { const a = rnd(0, 7);
    parts.push({ x: cam + W / 2 + Math.cos(a) * rnd(10, 90) * d.size, y: 215 + Math.sin(a) * rnd(2, 20), z: rnd(0, 6), vx: Math.cos(a) * rnd(0.6, 2.6), vy: 0, vz: rnd(4, 8.5), life: rnd(34, 60), max: 60, g: 0.26, c: ['#6a5870', '#4a3a50', '#8a7a8a'][i % 3], size: 3 + (i % 2), add: false });
    } // flung stones
  const n = 70 + d.v * 30;
  for (let i = 0; i < n; i++) {
    parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 8), vx: rnd(-1.5, 1.5), vy: 0, vz: rnd(2, 6.5), life: rnd(24, 50), max: 50, g: 0.22, c: ['#4a3a50', '#6a5870', '#2a2030'][i % 3], size: i % 4 ? 2 : 3, add: false });
    if (i % 2) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 6), vx: rnd(-1, 1), vy: 0, vz: rnd(1, 4), life: rnd(16, 34), max: 34, g: 0.05, c: ['#fff1b0', ER.col2, ER.col][i % 3], size: 2, add: true });
  }
}

