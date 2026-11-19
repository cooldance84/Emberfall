/* ---------- hero ---------- */
function reviveP(f, mate) {
  f.pitT = 0; f.dead = false; f.fade = 0; f.hp = Math.max(1, f.maxhp >> 1); f.x = mate.x - 22; f.y = mate.y; f.z = 0; f.vx = 0; f.vz = 0; f.st = 'idle'; f.t = 0; f.inv = 120; f.mount = null; f.hits.clear();
  msg = f.k.name + ' RETURNS  (-1 COIN)'; msgT = 100; SFX.magic(); spawn(f.x, f.y, 20, 26, { s0: 1, s1: 3, c: ['#fff1b0', '#8affb0'], l0: 14, l1: 30, add: true, size: 2, up: 3, g: 0.05 });
}
/* ---------- skills: a new special attack every 10 levels (U casts, Q swaps) ---------- */
const SKILLS = [
  { lv: 10, name: 'RISING SLASH', cd: 150 }, { lv: 20, name: 'DASH STRIKE', cd: 180 }, { lv: 30, name: 'WHIRLWIND', cd: 240 },
  { lv: 40, name: 'FLAME WAVE', cd: 260 }, { lv: 50, name: 'METEOR DIVE', cd: 330 }, { lv: 60, name: 'EMBER NOVA', cd: 400 }, { lv: 70, name: 'ULTIMATE', cd: 1500, ult: true }
];
// the level-70 skill is an ultimate: for about four seconds the hero is untouchable and every foe on screen takes non-stop damage; each hero has their own
const ULT = { nolan: { name: 'LEGION OF ASH' }, panni: { name: 'STARFALL' }, luca: { name: 'THOUSAND CUTS' } };
const skName = (S, f) => S.ult ? ULT[(f && f.k && f.k.cls) || CLS].name : S.name;
const skillsOf = () => SKILLS.filter(k => k.lv <= rpg.lvl);
function skillOf(f) { const a = skillsOf(); return a.length ? a[clamp(f.ski == null ? a.length - 1 : f.ski, 0, a.length - 1)] : null; }
function cycleSkill(f) { const a = skillsOf(); if (a.length < 2) return; f.ski = ((f.ski == null ? a.length - 1 : f.ski) + 1) % a.length; SFX.pick(); floatText(f.x, f.y - 66, skName(skillOf(f), f), '#8cc4ff', 8); }
function castSkill(f) {
  const S = skillOf(f); if (!S || f.skcd > 0) return false; // works from the saddle too: the mount carries on beneath the rider
  f.sk = { id: SKILLS.indexOf(S), face0: f.face }; f.st = 'atk'; f.combo = 2; f.t = 0; f.queued = false; f.hits.clear(); f.skcd = S.cd; f.inv = Math.max(f.inv, 14); f.vx = 0;
  floatText(f.x, f.y - 66, skName(S, f) + '!', S.ult ? '#ffd24a' : '#8cc4ff', S.ult ? 10 : 8); return true;
}
function stepSkill(f) {
  const t = f.t, id = f.sk.id, ff = f.sk.face0, foes = enemies;
  f.inv = Math.max(f.inv, 6);
  const end = () => { f.face = ff; f.sk = null; f.st = 'idle'; f.t = 0; f.z = 0; f.vz = 0; };
  const burst = (n, cols, s1) => spawn(f.x, f.y, 14, n, { s0: 1, s1: s1 || 3.6, c: cols, l0: 12, l1: 28, add: true, size: 2, flat: true });
  if (id === 0) { // rising slash: leaping uppercut
    if (t === 3) { f.vz = 4.6; f.hits.clear(); SFX.swing(); }
    if (t >= 3) { f.z += f.vz; f.vz -= 0.33; f.x += ff * 0.8; }
    if (t >= 4 && t <= 12) strike(f, { x0: -8, x1: 64, dy: 18, z0: -10, z1: 70 }, 26, 'down', foes);
    if (t >= 4 && t % 2 === 0) spawn(f.x + ff * 22, f.y, f.z + 24, 2, { c: ['#fff1b0', '#8cc4ff'], l0: 8, l1: 16, add: true, up: 2, g: -0.02 });
    if (f.z <= 0 && t > 6) end();
  } else if (id === 1) { // dash strike
    if (t === 2) SFX.swing();
    if (t < 16) { f.x += ff * 5.2; if (t === 7) f.hits.clear(); strike(f, { x0: -8, x1: 30, dy: 14, z0: 0, z1: 48 }, 22, t < 8 ? 'hurt' : 'down', foes); if (t % 2 === 0) spawn(f.x - ff * 10, f.y, 16, 2, { c: ['#8cc4ff', '#ffffff'], l0: 8, l1: 14, add: true }); }
    if (t >= 22) end();
  } else if (id === 2) { // whirlwind
    if (t < 26) { if (t % 6 === 0) { f.hits.clear(); SFX.swing(); } if (t % 3 === 0) { f.face = -f.face; burst(5, ['#fff1b0', '#ffb43a'], 2.4); } strike(f, { x0: -66, x1: 66, dy: 20, z0: 0, z1: 54 }, 13, t >= 20 ? 'down' : 'hurt', foes); }
    if (t >= 30) end();
  } else if (id === 3) { // flame wave: two piercing waves
    if (t === 6) { for (const dy of [-8, 8]) shots.push({ type: 'pwave', owner: f, x: f.x + ff * 30, y: clamp(f.y + dy, Y_MIN, Y_MAX), z: 0, vx: ff * 3.6, t: 0, dmg: 24, life: 90, hit: new Set() }); SFX.big(); burst(10, ['#fff1b0', '#ff8a2a'], 2.4); }
    if (t >= 22) end();
  } else if (id === 4) { // meteor dive
    if (t < 10) f.z += 5.5;
    else if (!f.sk.landed) {
      if (t === 10) f.vz = -10; f.z += f.vz;
      if (f.z <= 0) { f.z = 0; f.sk.landed = t; f.hits.clear(); strike(f, { x0: -84, x1: 84, dy: 34, z0: -30, z1: 130 }, 42, 'down', foes); shake = Math.max(shake, 12); dust(f.x, f.y, 10); burst(30, ['#fff1b0', '#ffb43a', '#ff5a1f']); SFX.big(); }
    } else if (t >= f.sk.landed + 14) end();
  } else if (id === 5) { // ember nova
    if (t === 8) { f.hits.clear(); strike(f, { x0: -130, x1: 130, dy: 50, z0: -20, z1: 120 }, 38, 'down', foes); shake = Math.max(shake, 10); flashA = Math.max(flashA, 0.25); burst(60, ['#fff1b0', '#ffb43a', '#ff5a1f'], 4.4); SFX.big(); }
    if (t === 22) { f.hits.clear(); strike(f, { x0: -150, x1: 150, dy: 56, z0: -20, z1: 120 }, 30, 'hurt', foes); burst(40, ['#ffd070', '#ff8a2a'], 4.8); SFX.big(); }
    if (t >= 34) end();
  } else if (id === 6) { // ultimate: ~4 seconds of non-stop damage to every foe on screen, then a finishing blow and a heal for the party
    const cls = f.k.cls, FIRST = 24, STEP = 10, TICKS = 18, FIN = FIRST + STEP * TICKS, ALL = { x0: -2 * W, x1: 2 * W, dy: 400, z0: -400, z1: 400 };
    const onScreen = () => foes.filter(e => !e.dead && e.x - cam > -24 && e.x - cam < W + 24);
    if (!f.sk.began) { f.sk.began = 1; flashA = Math.max(flashA, 0.3); SFX.magic(); }
    f.inv = Math.max(f.inv, 8); f.vx = 0;
    if (cls !== 'luca') f.z = Math.min(12, t * 0.6) + Math.sin(t * 0.25) * 1.5; // the hero rises while channelling
    if (t < FIRST) { // gathering power
      if (t % 3 === 0) spawn(f.x, f.y, f.z + 20, 4, { s0: 0.4, s1: 1.6, c: cls === 'panni' ? ['#d8b8ff', '#ffffff'] : cls === 'luca' ? ['#9affb8', '#ffffff'] : ['#fff1b0', '#9fd0ff'], l0: 12, l1: 24, add: true, up: 2.4, g: -0.01, size: 2 });
      shake = Math.max(shake, 2 + t * 0.1);
    } else if (t < FIN) {
      if ((t - FIRST) % STEP === 0) {
        const tg = onScreen(), k = (t - FIRST) / STEP;
        f.hits.clear(); strike(f, ALL, 6 + (k % 3 === 2 ? 2 : 0), 'hurt', tg); freeze = 0;
        shake = Math.max(shake, 3); flashA = Math.max(flashA, 0.1); if (k % 3 === 0) SFX.big(); else SFX.swing();
        if (cls === 'nolan') { // spectral swords rain down on everyone
          for (const e of tg.slice(0, 9)) { spawn(e.x + rnd(-16, 16), e.y + rnd(-6, 6), e.z + 120, 7, { s0: 0.1, s1: 0.5, c: ['#ffffff', '#fff1b0', '#9fd0ff'], l0: 9, l1: 13, add: true, up: -9, g: 0, size: 2 });
            spawn(e.x, e.y, e.z + 8, 8, { s0: 0.8, s1: 2.6, c: ['#fff1b0', '#ffb43a'], l0: 8, l1: 16, add: true, flat: true, size: 2 }); }
          spawn(f.x, f.y, f.z + 10, 10, { s0: 1, s1: 3.2, c: ['#fff1b0', '#9fd0ff'], l0: 10, l1: 20, add: true, flat: true });
        } else if (cls === 'panni') { // stars fall in columns of light
          for (const e of tg.slice(0, 9)) { spawn(e.x, e.y, e.z + 140, 12, { s0: 0.1, s1: 0.7, c: ['#d8b8ff', '#ffffff', '#8cc4ff'], l0: 10, l1: 15, add: true, up: -11, g: 0, size: 3 }); spawn(e.x, e.y, e.z + 10, 9, { s0: 1, s1: 3, c: ['#d8b8ff', '#ffffff'], l0: 10, l1: 20, add: true, size: 2 }); }
          spawn(f.x, f.y, f.z + 30, 10, { s0: 1, s1: 3.6, c: ['#d8b8ff', '#c9a8ff'], l0: 12, l1: 22, add: true, size: 2 });
        } else { // shadow blades: the rogue's phantoms streak from him through every foe, slashing
          for (const e of tg.slice(0, 9)) {
            for (let q = 0; q <= 6; q++) { const u = q / 6; spawn(f.x + (e.x - f.x) * u, f.y + (e.y - f.y) * u, f.z + 22 + (e.z + e.h * 0.6 - 22) * u, 1, { s0: 0.1, s1: 0.5, c: ['#9affb8', '#1c3a2a', '#ffffff'], l0: 6, l1: 11, add: true, size: 2 }); }
            spawn(e.x, e.y, e.z + e.h * 0.6, 12, { s0: 1.5, s1: 4.2, c: ['#ffffff', '#9affb8'], l0: 5, l1: 11, add: true, flat: true, size: 2 });
          }
        }
      }
    } else if (t === FIN) {
      f.hits.clear(); strike(f, ALL, 40, 'down', onScreen());
      for (const p of players()) if (!p.dead) p.hp = Math.min(p.maxhp, p.hp + (p.maxhp * 0.15 | 0));
      flashA = 0.8; shake = Math.max(shake, 16); burst(90, ['#fff1b0', '#ffd24a', '#ffffff'], 5.6); SFX.magic(); SFX.big();
    }
    if (t >= FIN + 16) end();
  }
}

function mountFire(f, t) {
  const type = (f.mount && f.mount.type) || 'ember', air = f.z > 2, foes = enemies, zz = f.z;
  if (type === 'storm') { // chain lightning: three zaps, each leaps to the nearest foes ahead
    if (t === 4 || t === 11 || t === 18) {
      f.hits.clear(); SFX.swing();
      const tg = foes.filter(e => !e.dead && (e.x - f.x) * f.face > -10 && (e.x - f.x) * f.face < 150 && Math.abs(e.y - f.y) < 40).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x)).slice(0, 3);
      let px = f.x + f.face * 33, py = f.y, pz = zz + 33;
      for (const e of tg) { zap(px, py, pz, e.x, e.y, e.z + e.h * 0.6); px = e.x; py = e.y; pz = e.z + e.h * 0.6; }
      if (!tg.length) zap(px, py, pz, px + f.face * 70, py, pz - (air ? 20 : 0));
      strike(f, { x0: -400, x1: 400, dy: 400, z0: -400, z1: 400 }, t === 18 ? 13 : 8, t === 18 ? 'down' : 'hurt', tg);
    }
    return;
  }
  if (type === 'stone') { // ground-shaking shockwave
    if (t === 6) {
      SFX.big(); shake = Math.max(shake, 4); f.hits.clear(); dust(f.x + f.face * 24, f.y, 8);
      strike(f, { x0: 0, x1: 46, dy: 16, z0: -20, z1: 50 }, 14, 'down', foes);
      for (const dy of [-7, 7]) shots.push({ type: 'pwave', owner: f, x: f.x + f.face * 34, y: clamp(f.y + dy, Y_MIN, Y_MAX), z: 0, vx: f.face * 3, t: 0, dmg: 12, life: 40, hit: new Set() });
    }
    return;
  }
  if (t === 4 || t === 9 || t === 14) f.hits.clear();
  if (t >= 3 && t <= 17) {
    strike(f, { x0: 4, x1: 76, dy: 13, z0: air ? -30 : 0, z1: 40 }, t >= 14 ? 14 : 8, t >= 14 ? 'down' : 'hurt', foes);
    for (const dz of [28, 32, 36]) spawn(f.x + f.face * 34, f.y, zz + dz, 3, { dx: f.face * 2.8, s0: 0.2, s1: 0.9, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 8, l1: 20, g: 0.012, add: true, size: 3, flat: true });
  }
}
const gapAt = (x, m) => gaps.find(q => x > q.x - (m || 0) && x < q.x + q.w + (m || 0));
function offGap(x, dir) { // a foe arriving from the screen edge must start on solid ground: a spot over a chasm or barricade moves outward past it
  for (let k = 0; k < 4; k++) { const q = gapAt(x, 22); if (!q) break; x = dir < 0 ? q.x - 24 : q.x + q.w + 24; }
  return x;
}
function heroHazards(f, ox) { // barricades block anyone below their height; chasms swallow anyone who lands in them
  if (f.dead || f.pitT) return;
  for (const q of gaps) {
    if (q.type === 'wall') {
      if (f.z < 18 && f.x > q.x - 7 && f.x < q.x + q.w + 7) f.x = ox <= q.x + q.w / 2 ? q.x - 7 : q.x + q.w + 7;
    } else if (f.z <= 0 && f.x > q.x + 5 && f.x < q.x + q.w - 5) {
      f.pitT = 1; f.pitY = f.y; f.pitGap = q; f.st = 'idle'; f.vx = 0; f.vz = 0; SFX.die(); shake = Math.max(shake, 4);
      return;
    }
  }
  if (f.z <= 0 && !gapAt(f.x, 6)) f.safeX = f.x;
}
function heroPitStep(f) {
  if (++f.pitT < 32) return;
  if (f.dead) return;
  const d = Math.max(1, Math.round(f.maxhp * 0.6)); f.hp -= d; msg = 'FELL INTO THE CHASM'; msgT = 110; flashA = Math.max(flashA, 0.2);
  if (f.hp <= 0) { f.hp = 0; f.dead = true; f.fade = 0; f.mount = null; return; } // a fall costs most of your health, and kills you if you were already hurt
  const q = f.pitGap, L = q.x - 14, Rr = q.x + q.w + 14;
  let nx = (f.safeX != null ? f.safeX : L) <= q.x ? L : Rr; if (nx < cam + 14) nx = Rr; if (nx > cam + W - 14) nx = L;
  f.pitT = 0; f.x = nx; f.y = f.pitY; f.z = 0; f.vz = 0; f.st = 'idle'; f.t = 0; f.inv = 100;
  floatText(f.x, f.y - 56, '-' + d, '#ff6a6a', 10);
  spawn(f.x, f.y, 20, 16, { c: ['#fff1b0', '#ffd070'], add: true, l0: 12, l1: 24, up: 2 });
}
function updateHero(f) {
  if (f.pitT && !f.dead) { heroPitStep(f); return; }
  if (f.pitT && f.dead) { f.pitT++; f.fade++; if (f.fade > 90 && mode === 'play' && players().every(p => p.dead && p.fade > 90)) { mode = 'gameover'; endTimer = 0; } return; }
  const ox = f.x; updateHeroCore(f); heroHazards(f, ox);
}
function updateHeroCore(f) {
  f.t++; if (f.inv > 0) f.inv--; if (f.flash > 0) f.flash--; if (f.skcd > 0) { f.skcd--; if (f.skcd > 0 && tickN % 4 === 0 && buffIs('haste')) f.skcd--; }
  if (f.sk && f.st !== 'atk') f.sk = null;
  if (f.dead) {
    f.fade++;
    if (coop) { const mate = players().find(p => p !== f && !p.dead); if (mate && f.fade > 240 && rpg.coins > 0 && mode === 'play') { rpg.coins--; reviveP(f, mate); return; } }
    if (f.fade > 90 && mode === 'play' && players().every(p => p.dead && p.fade > 90)) { mode = 'gameover'; endTimer = 0; }
    return;
  }
  if (groundPhysics(f)) return;
  const mx = (inD(f, 'right') ? 1 : 0) - (inD(f, 'left') ? 1 : 0), my = (inD(f, 'down') ? 1 : 0) - (inD(f, 'up') ? 1 : 0);
  const foes = enemies, spd = (f.mount ? mtype(f.mount).spd : f.k.spd) * (buffIs('haste') ? 1.25 : 1);
  switch (f.st) {
    case 'idle': case 'walk': {
      if (f.z > 0) { f.z += f.vz || 0; f.vz = (f.vz || 0) - 0.33; if (f.z <= 0) { f.z = 0; f.vz = 0; } } // never hang in the air: anything that leaves you aloft falls back down
      if (inH(f, 'swap')) cycleSkill(f);
      f.vx = mx * spd; f.vy = my * spd * 0.65;
      if (mx) f.face = mx;
      f.x += f.vx; f.y = clamp(f.y + f.vy, Y_MIN, Y_MAX);
      f.st = (mx || my) ? 'walk' : 'idle'; f.anim += (mx || my) ? (f.mount ? 0.3 : 0.2) : 0;
      const wild = f.mount ? null : mounts.find(m => !m.flee && Math.abs(m.x - f.x) < 28 && Math.abs(m.y - f.y) < 12 && m.z < 3);
      if ((inH(f, 'jump') || inH(f, 'dismount')) && wild) {
        f.mount = wild; jr('ride'); mounts.splice(mounts.indexOf(wild), 1); SFX.pick(); sparks(f.x, f.y, 20, true);
        msg = mtype(wild).name + '!   J: ' + mtype(wild).info + (wild.falls ? '   (1 FALL LEFT)' : '   E: DISMOUNT'); msgT = 130;
      } else if (inH(f, 'dismount') && f.mount) {
        const m = f.mount; m.x = f.x - f.face * 12; m.y = f.y; m.face = f.face; m.z = 0.01; m.vz = 2; mounts.push(m); f.mount = null;
      } else if (inH(f, 'jump')) { f.st = 'jump'; f.vz = f.mount ? mtype(f.mount).jump : (f.k.jump || 5.4); f.vx = mx * (f.mount ? mtype(f.mount).spd * 0.92 : 1.5); f.t = 0; f.hits.clear(); }
      else if (inH(f, 'skill') && castSkill(f)) { }
      else if (inH(f, 'atk')) { if (f.mount) { f.st = 'ratk'; f.t = 0; f.hits.clear(); SFX.swing(); } else startAttack(f, 0); }
      else if (inH(f, 'magic') && f.vases >= 1 && !dragon) castDragon();
      break;
    }
    case 'atk': {
      if (f.sk) { stepSkill(f); break; }
      const CB = comboOf(f), c = CB[f.combo], mage = f.k.cls === 'panni';
      if (f.t === c.a) { SFX.swing(); if (mage) { // Panni throws arcane bolts instead of swinging
        shots.push({ type: 'mbolt', owner: f, x: f.x + f.face * 18, y: f.y, z: 30, vx: f.face * (c.big ? 3.4 : 4.6), t: 0, dmg: c.dmg, kind: c.kind, big: !!c.big, life: c.big ? 72 : 54, hit: new Set() });
        spawn(f.x + f.face * 22, f.y, 32, 6, { c: ['#e0d0ff', '#b88aff'], l0: 6, l1: 14, add: true }); } }
      if (f.t < 7) f.x += f.vx * (mage ? 0.3 : 1), f.vx *= 0.9;
      if (!mage && f.t >= c.a && f.t <= c.b) strike(f, { x0: 0, x1: f.k.cls === 'luca' ? 38 : 40, dy: 11, z0: 4, z1: 40 }, c.dmg, c.kind, foes);
      if (inH(f, 'atk') && f.combo < CB.length - 1 && f.t >= (f.k.cls === 'luca' ? 3 : 5)) f.queued = true;
      if (f.t >= (buffIs('haste') ? Math.max(c.b + 1, Math.round(c.d * 0.8)) : c.d)) { if (f.queued) startAttack(f, f.combo + 1); else { f.st = 'idle'; f.t = 0; } }
      break;
    }
    case 'ratk': { // wyrmling attack, by type
      mountFire(f, f.t); if (f.t >= 24) { f.st = 'idle'; f.t = 0; }
      break;
    }
    case 'jump': case 'jatk': {
      f.x += f.vx; f.z += f.vz; f.vz -= 0.33; f.y = clamp(f.y + my * 0.5, Y_MIN, Y_MAX);
      if (f.st === 'jump' && inH(f, 'atk') && !f.mount) { f.st = 'jatk'; f.t = 0; f.hits.clear(); SFX.swing(); }
      if (f.mount && f.st === 'jump') { // wyrmlings can fire in mid-air
        if (inH(f, 'atk') && !f.jf) { f.jf = 1; f.hits.clear(); SFX.swing(); }
        if (f.jf) { mountFire(f, f.jf); if (++f.jf > 24) f.jf = 0; }
      }
      if (f.st === 'jatk') strike(f, { x0: -6, x1: 34, dy: 12, z0: -22, z1: 24 }, 11, 'down', foes);
      if (f.z <= 0) {
        f.z = 0; f.st = 'idle'; f.t = 0; f.jf = 0; dust(f.x, f.y, 4); SFX.land();
        if (f.mount && f.mount.type === 'stone') { f.hits.clear(); strike(f, { x0: -46, x1: 46, dy: 22, z0: -10, z1: 50 }, 13, 'down', foes); shake = Math.max(shake, 5); dust(f.x, f.y, 10); }
      }
      break;
    }
    case 'magic': { if (!dragon) { f.st = 'idle'; f.t = 0; } break; }
  }
}

