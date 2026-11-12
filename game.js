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
  atk: ['KeyJ', 'KeyZ'], jump: ['KeyK', 'KeyX', 'Space'], magic: ['KeyL', 'KeyC'], start: ['Enter']
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
const skyLayer = makeLayer((c, w, h) => {
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#0a0b22'); gr.addColorStop(0.55, '#2a1740'); gr.addColorStop(1, '#6b2a3a');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,240,220,${rnd(0.2, 0.9)})`; c.fillRect(Math.random() * w | 0, Math.random() * h * 0.6 | 0, 1, 1); }
});
const farLayer = makeLayer((c, w, h) => {
  c.fillStyle = '#2b1a3c';
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) c.lineTo(x, h - 52 - periodic(x, 1.3) * 16);
  c.lineTo(w, h); c.fill();
  // ruined spires
  c.fillStyle = '#1d1230';
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 135 + rnd(-20, 20), bw = rnd(14, 26), bh = rnd(50, 95);
    c.fillRect(x, h - 40 - bh, bw, bh + 40);
    c.fillRect(x - 3, h - 40 - bh, bw + 6, 4);
    for (let t = 0; t < 3; t++) c.fillRect(x - 3 + t * (bw / 2 + 1), h - 46 - bh, 4, 6);
    c.fillStyle = '#ffb05a'; c.fillRect(x + bw / 2 - 1, h - 40 - bh * 0.6, 2, 4); c.fillStyle = '#1d1230';
  }
});
const midLayer = makeLayer((c, w, h) => {
  c.fillStyle = '#170e26';
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 3) c.lineTo(x, h - 26 - periodic(x + 90, 2.1) * 12);
  c.lineTo(w, h); c.fill();
  // dead trees
  c.strokeStyle = '#0f0819'; c.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = i * 106 + rnd(0, 40), y = h - 20; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-3, 3), y - 34);
    c.moveTo(x, y - 20); c.lineTo(x + 10, y - 32); c.moveTo(x, y - 26); c.lineTo(x - 9, y - 38); c.stroke();
  }
});
// back wall (the arena's ruined colonnade), parallax 0.85
const wallLayer = makeLayer((c, w, h) => {
  c.fillStyle = '#251830'; c.fillRect(0, 70, w, h - 70);
  for (let x = 0; x < w; x += 8) for (let y = 70; y < h; y += 8) {
    c.fillStyle = `rgba(${40 + rnd(-8, 8) | 0},${24 + rnd(-6, 6) | 0},${52 + rnd(-8, 8) | 0},1)`; c.fillRect(x, y, 7, 7);
  }
  for (let x = 0; x < w; x += 160) {
    c.fillStyle = '#120a1c'; c.beginPath(); c.moveTo(x + 24, h); c.lineTo(x + 24, 92); c.arc(x + 80, 92, 56, Math.PI, 0); c.lineTo(x + 136, h); c.fill();
    c.fillStyle = '#3a2548'; c.fillRect(x, 64, 14, h - 64); c.fillRect(x - 3, 60, 20, 6);
  }
  c.fillStyle = '#4a3058'; c.fillRect(0, h - 6, w, 6);
}, GROUND_TOP + 6);

/* ---------- game state ---------- */
let mode = 'title', cam = 0, lockX = Infinity, hero, enemies, items, parts, shake = 0, freeze = 0;
let score = 0, waveIdx = 0, goBlink = 0, tickN = 0, lastEnemy = null, endTimer = 0, msg = '', msgT = 0;
const WAVES = [
  { x: 260, e: ['h', 'h'] }, { x: 760, e: ['h', 'h', 'h'] }, { x: 1300, e: ['h', 'b', 'h'] },
  { x: 1850, e: ['h', 'h', 'b', 'h'] }, { x: 2300, e: ['boss', 'h', 'h'] }
];
const STAGE_END = 2700;

const KINDS = {
  hero: { name: 'KESTREL', hp: 140, spd: 1.5, scale: 1, h: 44, skin: '#e0a679', hair: '#c4572b', armor: '#3b6ea8', armor2: '#8cc4ff', cloth: '#7a2630', wlen: 24, wwid: 3, wcol: '#dfe9f5' },
  h: { name: 'ASHEN HUSK', hp: 44, spd: 0.8, scale: 1, h: 44, skin: '#6e6a74', hair: '#2c2a30', armor: '#4a3a3a', armor2: '#ff7a2a', cloth: '#2b2226', wlen: 22, wwid: 3, wcol: '#a8743c', windup: 22, rng: 28, dmg: 9 },
  b: { name: 'CINDER BRUTE', hp: 120, spd: 0.55, scale: 1.3, h: 58, skin: '#5a5660', hair: '#1f1c22', armor: '#5a2e2e', armor2: '#ff9a3a', cloth: '#2a1c1c', wlen: 26, wwid: 6, wcol: '#6b6f78', windup: 30, rng: 40, dmg: 18 },
  boss: { name: 'THE CINDER COLOSSUS', hp: 420, spd: 0.5, scale: 2, h: 88, skin: '#4c4852', hair: '#17141a', armor: '#3a1c1c', armor2: '#ffb04a', cloth: '#221414', wlen: 32, wwid: 8, wcol: '#8a8f99', windup: 38, rng: 62, dmg: 26 }
};

function makeFighter(kind, x, y) {
  const k = KINDS[kind];
  return {
    kind, k, x, y, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: k.hp, maxhp: k.hp, st: 'idle', t: 0, anim: 0,
    inv: 0, flash: 0, combo: 0, queued: false, hits: new Set(), cool: rnd(20, 70), armor: 70, mana: 0, dead: false, fade: 0, h: k.h
  };
}

function resetGame() {
  hero = makeFighter('hero', 60, 205); hero.mana = 60;
  enemies = []; items = []; parts = []; cam = 0; lockX = Infinity; score = 0; waveIdx = 0; shake = 0; freeze = 0; endTimer = 0;
  lastEnemy = null; msg = ''; msgT = 0;
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
  e.hp -= dmg; e.flash = 4;
  const dir = sgn(e.x - from.x) || -from.face;
  sparks(e.x, e.y, e.z + e.h * 0.6, kind === 'down');
  if (e !== hero) lastEnemy = e;
  else shake = Math.max(shake, 4);
  SFX[kind === 'down' ? 'big' : 'hit']();
  freeze = Math.max(freeze, kind === 'down' ? 7 : 3);
  shake = Math.max(shake, kind === 'down' ? 6 : 2);
  if (from === hero) hero.mana = Math.min(100, hero.mana + dmg * 0.6);
  let knock = kind === 'down' || e.hp <= 0;
  if (e.kind === 'boss' && e.hp > 0) { e.armor -= dmg; if (e.armor <= 0) { e.armor = 70; knock = true; } else knock = false; }
  if (knock) { e.st = 'down'; e.t = 0; e.vz = 3.2; e.vx = dir * 2.1; e.z = Math.max(e.z, 0.01); e.combo = 0; }
  else if (e.kind !== 'boss') { e.st = 'hurt'; e.t = 0; e.vx = dir * 1.1; }
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
    if (f.hp <= 0 && !f.dead && f.z === 0 && f.t > 20) { f.dead = true; f.fade = 0; SFX.die(); if (f !== hero) { score += f.kind === 'boss' ? 5000 : f.kind === 'b' ? 400 : 150; if (Math.random() < (f.kind === 'h' ? 0.22 : 0.6)) items.push({ x: f.x, y: f.y, t: 0, kind: 'meat' }); } }
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
  const foes = enemies;
  switch (f.st) {
    case 'idle': case 'walk': {
      const run = (isDown('left') || isDown('right')) && false;
      f.vx = mx * f.k.spd; f.vy = my * f.k.spd * 0.65;
      if (mx) f.face = mx;
      f.x += f.vx; f.y = clamp(f.y + f.vy, Y_MIN, Y_MAX);
      f.st = (mx || my) ? 'walk' : 'idle'; f.anim += (mx || my) ? 0.2 : 0;
      if (isHit('jump')) { f.st = 'jump'; f.vz = 5.4; f.vx = mx * 1.5; f.t = 0; f.hits.clear(); }
      else if (isHit('atk')) startAttack(f, 0);
      else if (isHit('magic') && f.mana >= 60) { f.mana -= 60; f.st = 'magic'; f.t = 0; f.inv = 60; f.hits.clear(); SFX.magic(); }
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
    case 'jump': case 'jatk': {
      f.x += f.vx; f.z += f.vz; f.vz -= 0.33; f.y = clamp(f.y + my * 0.5, Y_MIN, Y_MAX);
      if (f.st === 'jump' && isHit('atk')) { f.st = 'jatk'; f.t = 0; f.hits.clear(); SFX.swing(); }
      if (f.st === 'jatk') strike(f, { x0: -6, x1: 34, dy: 12, z0: -22, z1: 24 }, 11, 'down', foes);
      if (f.z <= 0) { f.z = 0; f.st = 'idle'; f.t = 0; dust(f.x, f.y, 4); SFX.land(); }
      break;
    }
    case 'magic': {
      if (f.t === 16) {
        for (const e of foes) if (!e.dead && Math.hypot(e.x - f.x, (e.y - f.y) * 1.6) < 110) { hurt(e, 26, 'down', f); }
        shake = 12; freeze = 6;
        for (let i = 0; i < 70; i++) { const a = rnd(0, 6.283), s = rnd(1, 5); parts.push({ x: f.x, y: f.y, z: 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.35, vz: rnd(0, 2), life: rnd(16, 36), max: 36, g: 0.04, c: ['#fff1b0', '#ffb43a', '#ff5a1f'][i % 3], size: 2, add: true }); }
        parts.push({ ring: true, x: f.x, y: f.y, z: 4, life: 22, max: 22 });
      }
      if (f.t > 38) { f.st = 'idle'; f.t = 0; }
      break;
    }
  }
}

/* ---------- enemies ---------- */
function updateEnemy(e) {
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; return; }
  if (groundPhysics(e)) return;
  const k = e.k, dx = hero.x - e.x, dy = hero.y - e.y;
  const heroDown = hero.dead || hero.st === 'down';
  if (e.st === 'idle' || e.st === 'walk') {
    e.face = sgn(dx) || e.face; e.cool--;
    const rng = k.rng, inRange = Math.abs(dx) < rng + 4 && Math.abs(dy) < 9;
    if (!inRange) {
      e.st = 'walk'; e.anim += 0.14 * (k.spd / 0.8 + 0.4);
      if (Math.abs(dy) > 5) e.y += sgn(dy) * k.spd * 0.7;
      const stand = rng * 0.8;
      if (Math.abs(dx) > stand) e.x += sgn(dx) * k.spd; else if (Math.abs(dx) < stand - 8) e.x -= sgn(dx) * k.spd * 0.5;
      e.y = clamp(e.y, Y_MIN, Y_MAX);
    } else e.st = 'idle';
    const attackers = enemies.filter(o => !o.dead && (o.st === 'wind' || o.st === 'eatk')).length;
    if (inRange && e.cool <= 0 && !heroDown && attackers < (e.kind === 'boss' ? 3 : 2)) { e.st = 'wind'; e.t = 0; }
  } else if (e.st === 'wind') {
    if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); }
  } else if (e.st === 'eatk') {
    if (e.t >= 2 && e.t <= 6) {
      strike(e, { x0: -4, x1: k.rng + 12, dy: e.kind === 'boss' ? 18 : 10, z0: 0, z1: k.h }, k.dmg, e.kind === 'h' ? 'hurt' : 'down', [hero]);
      if (e.kind === 'boss' && e.t === 3) { shake = Math.max(shake, 9); for (let i = 0; i < 18; i++) parts.push({ x: e.x + e.face * rnd(30, 90), y: e.y + rnd(-6, 6), z: 0, vx: e.face * rnd(0.5, 3), vy: 0, vz: rnd(1, 3), life: 20, max: 20, g: 0.2, c: '#ffb04a', size: 2, add: true }); }
    }
    if (e.t >= 18) { e.st = 'idle'; e.t = 0; e.cool = rnd(45, 95) * (e.kind === 'boss' ? 0.7 : 1); }
  }
}

/* ---------- waves / camera ---------- */
function updateStage() {
  const w = WAVES[waveIdx];
  if (w && lockX === Infinity && hero.x > w.x - 120) {
    lockX = w.x - 200 > cam ? Math.max(cam, w.x - 200) : cam;
    w.e.forEach((t, i) => {
      const side = i % 2 ? 1 : -1;
      const ex = side > 0 ? lockX + W + 30 + i * 22 : lockX - 30 - i * 22;
      enemies.push(makeFighter(t, ex, rnd(Y_MIN + 6, Y_MAX - 6)));
    });
    if (w.e.includes('boss')) { msg = 'THE CINDER COLOSSUS'; msgT = 150; }
  }
  if (lockX !== Infinity && enemies.every(e => e.dead)) {
    lockX = Infinity; waveIdx++; goBlink = 240;
    if (waveIdx >= WAVES.length) { mode = 'victory'; endTimer = 0; }
  }
  const target = hero.x - W * 0.42;
  const maxCam = lockX !== Infinity ? lockX : STAGE_END - W;
  cam = clamp(lerp(cam, target, 0.1), cam > maxCam ? maxCam : cam, maxCam);
  if (cam < 0) cam = 0;
  hero.x = clamp(hero.x, cam + 12, (lockX !== Infinity ? lockX : STAGE_END) + W - 12);
  hero.x = Math.min(hero.x, cam + W - 12);
}

function updateItems() {
  for (const it of items) { it.t++; if (!hero.dead && Math.abs(it.x - hero.x) < 16 && Math.abs(it.y - hero.y) < 14) { hero.hp = Math.min(hero.maxhp, hero.hp + 35); it.gone = true; SFX.pick(); spawn(it.x, it.y, 10, 12, { c: '#9dffb0', add: true, l0: 14, l1: 24, g: -0.02 }); } }
  items = items.filter(i => !i.gone);
}

function updateParts() {
  for (const p of parts) { p.life--; if (p.ring) continue; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= p.g; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.7; } }
  parts = parts.filter(p => p.life > 0);
  if (parts.length < 300 && Math.random() < 0.5) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 90), vx: rnd(-0.2, 0.4), vy: 0, vz: rnd(0.1, 0.4), life: rnd(60, 160), max: 160, g: -0.002, c: '#ff9a4a', size: 1, add: true, amb: true });
}

function step() {
  tickN++;
  if (mode === 'title') { if (isHit('start') || isHit('atk')) { resetGame(); mode = 'play'; msg = 'ADVANCE'; msgT = 90; } updateParts(); cam += 0.3; return; }
  if (mode === 'gameover' || mode === 'victory') { endTimer++; updateParts(); if (isHit('start') && endTimer > 30) { resetGame(); mode = 'title'; } return; }
  if (freeze > 0) { freeze--; return; }
  updateHero(hero);
  enemies.forEach(updateEnemy);
  enemies = enemies.filter(e => !(e.dead && e.fade > 50));
  updateItems(); updateParts(); updateStage();
  if (shake > 0) shake *= 0.86; if (shake < 0.2) shake = 0;
  if (goBlink > 0) goBlink--; if (msgT > 0) msgT--;
}

/* ---------- rendering ---------- */
function tileLayer(layer, par, yoff) {
  const ox = -((cam * par) % LAYER_W + LAYER_W) % LAYER_W;
  g.drawImage(layer, Math.round(ox), yoff); g.drawImage(layer, Math.round(ox) + LAYER_W, yoff);
}
const TORCH_GAP = 300;
function torchPositions() { const a = []; const s = Math.floor((cam - 60) / TORCH_GAP); for (let i = s; i < s + 4; i++) a.push(i * TORCH_GAP + 150); return a; }

function drawWorld() {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  tileLayer(skyLayer, 0.02, 0);
  // moon
  g.fillStyle = '#ffe9c8'; g.beginPath(); g.arc(380 - cam * 0.03 % 500, 34, 15, 0, 7); g.fill();
  g.fillStyle = '#e6c9a8'; g.beginPath(); g.arc(375 - cam * 0.03 % 500, 30, 4, 0, 7); g.fill();
  tileLayer(farLayer, 0.18, 0); tileLayer(midLayer, 0.4, 0); tileLayer(wallLayer, 0.85, 0);
  // floor
  const fg = g.createLinearGradient(0, GROUND_TOP, 0, H);
  fg.addColorStop(0, '#3a2a3e'); fg.addColorStop(1, '#17101d');
  g.fillStyle = fg; g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  for (let row = 0; row < 9; row++) {
    const y = GROUND_TOP + 4 + row * row * 1.6 + row * 6, sp = 24 + row * 7;
    g.fillStyle = 'rgba(10,6,16,0.45)'; g.fillRect(0, y | 0, W, 1);
    const off0 = -((cam % sp) + sp) % sp;
    for (let x = off0 + (row % 2) * sp / 2; x < W; x += sp) g.fillRect(x | 0, y | 0, 1, row * 2 + 6);
  }
  // torch posts
  for (const tx of torchPositions()) {
    const sx = tx - cam * 0.85 + cam * 0.0; const x = Math.round(tx - cam);
    g.fillStyle = '#1a1020'; g.fillRect(x - 2, GROUND_TOP - 40, 4, 40);
    g.fillStyle = '#4b3558'; g.fillRect(x - 5, GROUND_TOP - 44, 10, 5);
  }
}

function flame(x, y, s) {
  const t = tickN * 0.3 + x;
  g.fillStyle = '#ff5a1f'; g.fillRect(x - 3 * s, y - 8 * s, 6 * s, 8 * s);
  g.fillStyle = '#ffb43a'; g.fillRect(x - 2 * s, y - (9 + Math.sin(t) * 2) * s, 4 * s, 7 * s);
  g.fillStyle = '#fff1b0'; g.fillRect(x - 1 * s, y - (6 + Math.sin(t * 1.3)) * s, 2 * s, 4 * s);
}

function drawHuman(f, sx, sy) {
  const k = f.k, d = f.face, sc = k.scale, white = f.flash > 0;
  const C = c => white ? '#ffffff' : c;
  const winding = f.st === 'wind';
  g.save(); g.translate(Math.round(sx), Math.round(sy - f.z)); g.scale(d * sc, sc);
  if (f.dead && f.fade > 8) g.globalAlpha = Math.max(0, 1 - (f.fade - 8) / 40);
  else if (f.inv > 0 && (tickN >> 2) & 1 && f === hero) g.globalAlpha = 0.45;
  const lay = f.st === 'down' && f.z === 0;
  if (lay) { g.rotate(-Math.PI / 2 * 0.92); g.translate(-4, -2); }
  else if (f.st === 'down') g.rotate(-0.7);
  const air = f.z > 1 && !lay;
  const ph = f.anim, la = air ? 3 : Math.sin(ph) * 5, lb = air ? -3 : -Math.sin(ph) * 5;
  const bob = f.st === 'walk' ? Math.abs(Math.sin(ph)) * 1.5 : (f.st === 'idle' ? Math.sin(tickN * 0.07) * 0.6 : 0);
  // legs
  g.fillStyle = C(k.cloth); g.fillRect(-5 + la, -16 - bob, 4, 16); g.fillRect(1 + lb, -16 - bob, 4, 16);
  g.fillStyle = C('#150d12'); g.fillRect(-6 + la, -4, 6, 4); g.fillRect(0 + lb, -4, 6, 4);
  // torso
  const lean = f.st === 'wind' ? -2 : f.st === 'atk' ? 2 : 0;
  g.fillStyle = C(k.armor); g.fillRect(-7 + lean, -33 - bob, 14, 18);
  g.fillStyle = C(k.armor2); g.fillRect(-7 + lean, -33 - bob, 14, 3); g.fillRect(-2 + lean, -30 - bob, 4, 12);
  g.fillStyle = C(k.cloth); g.fillRect(-7 + lean, -17 - bob, 14, 3);
  if (f.kind !== 'hero') { g.fillStyle = C(k.armor2); g.fillRect(-1 + lean, -27 - bob, 2, 4); } // ember core
  // head
  g.fillStyle = C(k.skin); g.fillRect(-5 + lean, -43 - bob, 10, 10);
  g.fillStyle = C(k.hair); g.fillRect(-6 + lean, -45 - bob, 12, 4); g.fillRect(-6 + lean, -43 - bob, 3, 7);
  if (f === hero) { g.fillRect(-9 + lean, -42 - bob, 4, 3); g.fillRect(-12 + lean, -40 - bob, 4, 3); } // scarf-like hair tail
  g.fillStyle = f.kind === 'hero' ? '#1b1b2a' : '#ffa23a'; g.fillRect(2 + lean, -39 - bob, 2, 2);
  if (f.kind === 'boss' || f.kind === 'b') { g.fillStyle = C('#2a2328'); g.fillRect(-6 + lean, -46 - bob, 12, 3); g.fillRect(-7, -48 - bob, 2, 4); g.fillRect(5, -48 - bob, 2, 4); }
  // arm + weapon
  let ang = 0.5;
  if (winding) ang = -2.1 - Math.min(0.4, f.t / (k.windup || 20) * 0.4);
  else if (f.st === 'eatk') ang = lerp(-2.0, 1.4, clamp(f.t / 5, 0, 1));
  else if (f.st === 'atk') { const c = COMBO[f.combo]; const p = clamp((f.t - 1) / (c.b - 1), 0, 1); ang = f.combo === 1 ? lerp(1.6, -1.8, p) : lerp(-2.2, 1.5, p); }
  else if (f.st === 'jatk') ang = 2.3;
  else if (f.st === 'magic') ang = -2.6;
  else if (f.st === 'walk') ang = 0.5 + Math.sin(ph) * 0.15;
  const shx = 3 + lean, shy = -30 - bob, hl = 10, bl = k.wlen;
  const hx = shx + Math.sin(ang) * hl, hy = shy - Math.cos(ang) * hl;
  const tx = hx + Math.sin(ang) * bl, ty = hy - Math.cos(ang) * bl;
  g.lineCap = 'butt';
  g.strokeStyle = C(k.skin); g.lineWidth = 4; g.beginPath(); g.moveTo(shx, shy); g.lineTo(hx, hy); g.stroke();
  g.strokeStyle = C(f === hero ? '#5b3a22' : '#3a2a1e'); g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.sin(ang) * 6, hy - Math.cos(ang) * 6); g.stroke();
  g.strokeStyle = C(k.wcol); g.lineWidth = k.wwid; g.beginPath(); g.moveTo(hx + Math.sin(ang) * 6, hy - Math.cos(ang) * 6); g.lineTo(tx, ty); g.stroke();
  if (f === hero) { g.strokeStyle = C('#9fe0ff'); g.lineWidth = 1; g.beginPath(); g.moveTo(hx + Math.sin(ang) * 8, hy - Math.cos(ang) * 8); g.lineTo(tx, ty); g.stroke(); }
  // swing trail
  const swinging = (f.st === 'atk' && f.t >= COMBO[f.combo].a && f.t <= COMBO[f.combo].b + 4) || (f.st === 'eatk' && f.t < 9) || f.st === 'jatk';
  if (swinging) {
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = f === hero ? 'rgba(150,220,255,0.55)' : 'rgba(255,150,60,0.5)'; g.lineWidth = 5;
    g.beginPath(); const a0 = f.st === 'atk' && f.combo === 1 ? 1.6 : -2.0; g.arc(shx, shy, hl + bl * 0.8, a0 - Math.PI / 2, ang - Math.PI / 2, ang < a0); g.stroke();
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

function drawFighter(f) {
  const sx = f.x - cam, sy = f.y;
  // shadow
  const sh = clamp(1 - f.z / 90, 0.3, 1) * f.k.scale;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 12 * sh, 4 * sh, 0, 0, 7); g.fill();
  drawHuman(f, sx, sy);
  // windup telegraph
  if (f.st === 'wind' && (tickN >> 1) & 1) { g.fillStyle = '#ff3b2a'; g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h * 1.0 - 8), 3, 6); g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h - 1), 3, 2); }
}

function drawItems() {
  for (const it of items) {
    const x = Math.round(it.x - cam), y = Math.round(it.y), b = Math.sin(it.t * 0.1) * 2;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 7, 2.5, 0, 0, 7); g.fill();
    g.fillStyle = '#c85a3a'; g.fillRect(x - 5, y - 9 + b, 10, 7); g.fillStyle = '#f0d4b0'; g.fillRect(x + 4, y - 10 + b, 5, 3); g.fillRect(x + 7, y - 12 + b, 3, 3);
    g.fillStyle = '#e8805a'; g.fillRect(x - 4, y - 9 + b, 6, 2);
  }
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
  lg.fillStyle = 'rgba(18,12,40,0.5)'; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'destination-out';
  for (const tx of torchPositions()) { const fl = 0.85 + Math.sin(tickN * 0.31 + tx) * 0.1 + Math.random() * 0.05; light(tx - cam, GROUND_TOP - 46, 120 * fl, 0.95, `rgba(255,140,50,${0.22 * fl})`); }
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
  text('L: EMBER BURST', 12, 46, 8, hero.mana >= 60 ? '#ffd24a' : '#6a5a40');
  text(String(score).padStart(7, '0'), W / 2, 18, 12, '#fff1b0', 'center');
  if (lastEnemy && !lastEnemy.dead && lastEnemy.hp > 0) { text(lastEnemy.k.name, W - 12, 18, 10, '#ffa060', 'right'); bar(W - 142, 22, 130, 7, lastEnemy.hp, lastEnemy.maxhp, '#e0742a', '#3a1c10'); }
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
  text('WASD/ARROWS MOVE   J ATTACK (x3 COMBO)   K JUMP   L EMBER BURST', W / 2, 222, 8, '#b8a8c8', 'center');
  text('JUMP+J = DIVE STRIKE     F: CRT FILTER     M: MUTE', W / 2, 234, 8, '#b8a8c8', 'center');
}

function render() {
  const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) * 0.6 : 0;
  g.save(); g.translate(Math.round(sx), Math.round(sy));
  drawWorld();
  for (const tx of torchPositions()) flame(Math.round(tx - cam), GROUND_TOP - 44, 1);
  drawItems();
  const list = [...enemies, hero].sort((a, b) => a.y - b.y);
  for (const f of list) drawFighter(f);
  drawParts(false);
  g.restore();
  applyLighting();
  g.save(); g.translate(Math.round(sx), Math.round(sy)); drawParts(true); g.restore();
  // foreground pillars for depth (parallax 1.35)
  for (let i = -1; i < 4; i++) {
    const wx = (Math.floor(cam * 1.35 / 520) + i) * 520 + 260, x = Math.round(wx - cam * 1.35);
    // fade pillars out near screen centre so they never hide the fight
    const al = clamp((Math.abs(x - W / 2) - 110) / 70, 0, 1); if (al <= 0) continue;
    g.globalAlpha = al; g.fillStyle = '#07040b'; g.fillRect(x - 12, 0, 24, H); g.fillStyle = '#120a19'; g.fillRect(x - 12, 0, 3, H); g.globalAlpha = 1;
  }
  if (mode === 'title') drawTitleOverlay();
  else drawHUD();
  if (mode === 'gameover') { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H); text('YOU HAVE FALLEN', W / 2, 120, 22, '#e0431f', 'center'); text('SCORE ' + score, W / 2, 148, 12, '#fff1b0', 'center'); if (endTimer > 30) text('PRESS ENTER', W / 2, 180, 10, '#fff', 'center'); }
  if (mode === 'victory') { g.fillStyle = 'rgba(20,10,0,0.5)'; g.fillRect(0, 0, W, H); text('THE EMBERS REST', W / 2, 120, 22, '#ffd24a', 'center'); text('SCORE ' + score, W / 2, 148, 12, '#fff1b0', 'center'); if (endTimer > 30) text('PRESS ENTER', W / 2, 180, 10, '#fff', 'center'); }
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
