/* ---------- boss AI & projectiles ---------- */
const WINDUP = { bite: 26, tail: 24, breath: 34, flames: 30, swipe: 22, spit: 28, summon: 46, smash: 40, charge: 36, quake: 34, slash: 18, blink: 24, meteor: 56 };
function bossPhase2(e) {
  if (!e.p2 && e.hp < e.maxhp * 0.5) {
    e.p2 = true; e.cool = 30; shake = 12; flashA = 0.4; freeze = 10; msg = 'ENRAGED!'; msgT = 80; sparks(e.x, e.y, e.h * 0.6, true); SFX.big();
      spawn(e.x, e.y, e.h * 0.7, 14, { c: [e.k.armor2, tone(e.k.armor, 2), '#1a1418'], s0: 0.8, s1: 2.6, l0: 30, l1: 58, size: 3, up: 1.8, g: 0.12 });
      // a plate of armour bursts off
    const esc = [MINION[stageIdx % 5] || 'h', stageIdx >= 1 || cycle ? 'warder' : 'h']; // the enraged boss calls in escorts
    esc.forEach((t, i) => { const f = makeFighter(t, offGap(i ? cam + W + 30 : cam - 30, i ? 1 : -1), rnd(Y_MIN + 6, Y_MAX - 6)); if (t === 'h' && STAGES[stageIdx].tint) f.k = Object.assign({}, f.k, STAGES[stageIdx].tint); enemies.push(f); });
  }
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
    } else if (e.kind === 'wyrm') { // vast, slow stalker
      const sp = k.spd * (p2 ? 1.35 : 1);
      if (adx > 56) { e.x += sgn(dx) * sp; walk = true; }
      if (ady > 5) { e.y += sgn(dy) * sp * 0.7; walk = true; }
    } else { // king: fast duelist
      const sp = k.spd * (p2 ? 1.5 : 1);
      if (adx > 44) { e.x += sgn(dx) * sp; walk = true; }
      if (ady > 5) { e.y += sgn(dy) * sp * 0.8; walk = true; }
    }
    e.y = clamp(e.y, Y_MIN, Y_MAX); e.st = walk ? 'walk' : 'idle'; if (walk) e.anim += 0.12;
    if (e.cool <= 0 && !heroDown) chooseBossAttack(e, adx, p2);
  } else if (e.st === 'wind') {
    e.face = sgn(dx) || e.face;
    if (e.atk === 'flames' || e.atk === 'breath') e.y = clamp(e.y + clamp(dy, -1.2, 1.2), Y_MIN, Y_MAX); // turns into the hero's lane while it winds up, so the fire leaves its mouth straight
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
  } else if (e.kind === 'wyrm') {
    if (p2 && r < 0.2 && enemies.filter(o => !o.dead && o.kind !== 'wyrm').length < 3) a = 'summon';
    else if (adx < 100) a = r < 0.5 ? 'bite' : 'tail';
    else if (p2 && r < 0.4) a = 'meteor';
    else a = r < 0.55 ? 'breath' : 'flames';
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
      if (t >= 2 && t <= 6) strike(e, { x0: -6, x1: 58, dy: 14, z0: 0, z1: e.h }, 16, 'down', players());
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
        for (let i = 0; i < 2; i++) { const f = makeFighter('h', offGap(i ? cam + W + 30 : cam - 30, i ? 1 : -1), rnd(Y_MIN + 6, Y_MAX - 6)); f.k = Object.assign({}, f.k, STAGES[stageIdx].tint || {}); enemies.push(f); }
        spawn(e.x, e.y, 30, 30, { c: ['#7aff9a', '#2aa860'], add: true, l0: 20, l1: 40, up: 2, g: 0.02 }); SFX.magic();
      }
      if (t >= 16) end(60);
      break;
    case 'smash':
      if (t === 3) {
        strike(e, { x0: -6, x1: 76, dy: 16, z0: 0, z1: e.h }, 24, 'down', players()); shake = Math.max(shake, 10); dust(e.x + e.face * 50, e.y, 10); SFX.big();
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
        strike(e, { x0: -10, x1: 46, dy: 16, z0: 0, z1: e.h }, 20, 'down', players());
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
      if ((t >= 2 && t <= 6) || (t >= 12 && t <= 16) || (p2 && t >= 22 && t <= 26)) strike(e, { x0: -6, x1: 66, dy: 14, z0: 0, z1: e.h }, t >= 12 ? 22 : 16, t >= 12 ? 'down' : 'hurt', players());
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
    case 'bite':
      if (t < 8) e.x += e.face * 2.6;
      if (t >= 3 && t <= 7) strike(e, { x0: -20, x1: 104, dy: 18, z0: 0, z1: 80 }, 26, 'down', players());
      if (t === 3) { shake = Math.max(shake, 9); SFX.big(); sparks(e.x + e.face * 80, e.y, 60, false); }
      if (t >= 22) end(p2 ? 40 : 70);
      break;
    case 'tail':
      if (t >= 4 && t <= 9) strike(e, { x0: -110, x1: 110, dy: 20, z0: 0, z1: 40 }, 20, 'down', players());
      if (t === 4) { shake = Math.max(shake, 8); dust(e.x - e.face * 70, e.y, 8); dust(e.x + e.face * 70, e.y, 8); SFX.big(); }
      if (t >= 26) end(p2 ? 40 : 65);
      break;
    case 'breath':
      if (t <= 52) {
        const mx = e.x + e.face * 80, mz = e.z + 75, fc = ['#fff1b0', '#ffb43a', '#ff5a1f'];
        spawn(mx, e.y, mz, 4, { dx: e.face * 3.4, s0: 0.2, s1: 1.0, c: fc, l0: 10, l1: 26, g: 0.01, add: true, size: 3, flat: true });
        spawn(mx, e.y, mz, 3, { dx: e.face * 5.6, s0: 0.2, s1: 0.8, c: fc, l0: 10, l1: 24, g: 0.012, add: true, size: 3, flat: true });
        e.y = clamp(e.y + clamp(hero.y - e.y, -0.3, 0.3), Y_MIN, Y_MAX); // follows the hero slowly, so the stream stays straight
        if (t % 10 === 2) e.hits.clear();
        strike(e, { x0: 40, x1: 190, dy: 14, z0: 0, z1: 80 }, 11, t > 42 ? 'down' : 'hurt', players());
        if (t % 8 === 0) shake = Math.max(shake, 3);
      }
      if (t >= 60) end(p2 ? 45 : 85);
      break;
    case 'flames':
      if (t === 2 || (p2 && t === 12)) { // the flame waves leave the dragon's mouth, in its own lane, and curve into the lanes around the hero
        for (const dy of [-18, 0, 18]) shots.push({ type: 'wave', x: e.x + e.face * 90, y: e.y, ty: clamp(hero.y + dy, Y_MIN, Y_MAX), vy: 1.5, z: 0, vx: e.face * 3, t: 0, dmg: 15, life: 120 });
        spawn(e.x + e.face * 84, e.y, 62, 12, { dx: e.face * 3, s0: 0.3, s1: 1.6, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 22, add: true, size: 3, g: 0.01 }); SFX.big(); }
      if (t >= 22) end(p2 ? 45 : 80);
      break;
    default: end(60);
  }
}
function updateShots() {
  const realHero = hero;
  for (const s of shots) {
    s.t++; hero = nearestPlayer(s.x); hitEl = SHOT_EL[s.type] || null;
    const dx = hero.x - s.x, dy = hero.y - s.y;
    if (s.type === 'orb' || s.type === 'bolt') {
      s.x += s.vx;
      if (s.t % 3 === 0) spawn(s.x, s.y, s.z, 1, { c: s.type === 'bolt' ? '#9ae8ff' : '#7aff9a', s0: 0.05, s1: 0.3, l0: 8, l1: 14, add: true, g: 0 });
      if (!hero.dead && Math.abs(dx) < 10 && Math.abs(dy) < 10 && hero.z < s.z + 10) { hurt(hero, s.dmg, 'hurt', { x: s.x, face: sgn(s.vx) || 1 }); sparks(s.x, s.y, s.z, false); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'arrow') {
      s.x += s.vx; s.y = clamp(s.y + (s.vy || 0), Y_MIN, Y_MAX);
      if (s.t % 2 === 0) spawn(s.x - sgn(s.vx) * 6, s.y, s.z, 1, { c: '#bfe6ff', s0: 0.05, s1: 0.2, l0: 6, l1: 10, add: true, g: 0 });
      if (!hero.dead && Math.abs(dx) < 9 && Math.abs(dy) < 8 && hero.z < s.z + 8) { hurt(hero, s.dmg, 'hurt', { x: s.x, face: sgn(s.vx) || 1 }); sparks(s.x, s.y, s.z, false); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'wave') {
      s.x += s.vx; if (s.ty !== undefined) s.y += clamp(s.ty - s.y, -s.vy, s.vy);
      if (s.t % 2 === 0) spawn(s.x, s.y, 2, 1, { c: ['#ff8a2a', '#ffd070'], s0: 0.1, s1: 0.6, l0: 8, l1: 16, add: true, up: 1, g: 0.04 });
      if (!hero.dead && Math.abs(dx) < 9 && Math.abs(dy) < 10 && hero.z < 12) { hurt(hero, s.dmg, 'down', { x: s.x, face: sgn(s.vx) || 1 }); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'meteor') {
      if (s.t === s.delay) {
        shake = Math.max(shake, 8); spawn(s.x, s.y, 4, 22, { s0: 1, s1: 3.2, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 24, add: true, size: 2, up: 3 }); dust(s.x, s.y, 6); SFX.hit();
        if (!hero.dead && Math.abs(dx) < 24 && Math.abs(dy) < 14 && hero.z < 26) hurt(hero, s.dmg, 'down', { x: s.x, face: 1 });
      }
      if (s.t > s.delay + 6) s.dead = true;
    } else if (s.type === 'pwave') {
      s.x += s.vx;
      if (s.t % 2 === 0) spawn(s.x, s.y, 8, 2, { c: ['#fff1b0', '#ffb43a', '#ff5a1f'], s0: 0.2, s1: 0.8, l0: 8, l1: 16, add: true, size: 2, up: 1, g: -0.01 });
      for (const e of enemies) {
        if (e.dead || s.hit.has(e) || Math.abs(e.x - s.x) > 16 || Math.abs(e.y - s.y) > 16) continue;
        s.hit.add(e); const r = rollHit(s.dmg);
        if (r.miss) { floatText(e.x, e.y - e.h * 0.8, 'MISS', '#9aa0b0', 8); continue; }
        if (hurt(e, r.d, 'hurt', s.owner)) floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9, r.crit ? r.d + '!' : String(r.d), r.crit ? '#ffd24a' : '#ffffff', r.crit ? 12 : 8);
      }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'mbolt') { // Panni's arcane bolts: small ones stop at the first foe, the big one pierces
      s.x += s.vx;
      if (s.t % 2 === 0) spawn(s.x - sgn(s.vx) * 4, s.y, s.z, 1, { c: s.big ? ['#ffffff', '#c9a8ff'] : ['#e0d0ff', '#9a7aff'], s0: 0.05, s1: 0.3, l0: 6, l1: 12, add: true, g: 0 });
      for (const e of enemies) {
        if (e.dead || s.hit.has(e) || Math.abs(e.x - s.x) > (s.big ? 16 : 11) || Math.abs(e.y - s.y) > (s.big ? 16 : 12) || e.z > s.z + 6 || e.z + e.h < s.z - 14) continue;
        s.hit.add(e); const o = s.owner, r = rollHit(s.dmg);
        if (r.miss) { floatText(e.x, e.y - e.h * 0.8, 'MISS', '#9aa0b0', 8); } else if (hurt(e, r.d, s.kind, { x: s.x - sgn(s.vx) * 20, face: sgn(s.vx), pn: o.pn, k: o.k,
          get mana() { return o.mana; }, set mana(v) { o.mana = v; } }) && e.blockT !== tickN) floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9,
          r.crit ? r.d + '!' : String(r.d), r.crit ? '#ffd24a' : '#ffffff', r.crit ? 12 : 8);
        spawn(s.x, s.y, s.z, s.big ? 14 : 6, { c: ['#ffffff', '#c9a8ff', '#8a6aff'], l0: 8, l1: 18, add: true });
        if (!s.big) { s.dead = true; break; }
      }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'rune') { // telegraphed blast, then a burning pool that hurts anyone standing in it
      if (s.t === s.delay) {
        shake = Math.max(shake, 6); spawn(s.x, s.y, 4, 24, { s0: 1, s1: 3.4, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 26, add: true, size: 2, up: 3.2 }); SFX.hit();
        for (const p of players()) if (!p.dead && Math.hypot(p.x - s.x, (p.y - s.y) * 2.4) < s.r + 4 && p.z < 22) hurt(p, s.dmg, 'down', { x: s.x, face: 1 });
      }
      if (s.t > s.delay && (s.t - s.delay) % 30 === 15) for (const p of players()) if (!p.dead && Math.hypot(p.x - s.x, (p.y - s.y) * 2.4) < s.r && p.z < 4 && hurt(p, Math.round(s.dmg * 0.35), 'hurt', { x: s.x, face: 1 })) floatText(p.x, p.y - 52, 'BURNING', '#ff8a2a', 8);
      if (s.t > s.delay && s.t % 4 === 0) spawn(s.x + rnd(-s.r, s.r) * 0.8, s.y + rnd(-6, 6), 2, 1, { c: ['#ffb43a', '#ff5a1f'], s0: 0.1, s1: 0.4, l0: 10, l1: 20, add: true, up: 1.2, g: -0.01 });
      if (s.t > s.delay + s.pool) s.dead = true;
    } else if (s.type === 'ring') {
      s.r += 3.2;
      if (!s.hit && !hero.dead && Math.abs(Math.hypot(dx, dy * 3) - s.r) < 10 && hero.z < 14) { s.hit = true; hurt(hero, s.dmg, 'down', { x: s.x, face: sgn(hero.x - s.x) || 1 }); }
      if (s.r > (s.max || 130)) s.dead = true;
    }
    if ((s.type === 'mbolt' || s.type === 'pwave') && !s.dead && s.hit) for (const c of chests) { // Panni's bolts and the shockwaves open chests too, whatever height they fly at
      if (c.open || s.hit.has(c) || Math.abs(c.x - s.x) > 14 || Math.abs(c.y - s.y) > 14) continue;
      s.hit.add(c); openChest(c); if (s.type === 'mbolt' && !s.big) s.dead = true;
    }
    if (s.type === 'mbolt' && !s.dead && s.hit) for (const sh of shrines) { // ...and so do Panni's bolts
      if (sh.used || s.hit.has(sh) || Math.abs(sh.x - s.x) > 14 || Math.abs(sh.y - s.y) > 14) continue;
      s.hit.add(sh); useShrine(sh); s.dead = true;
    }
  }
  hitEl = null; hero = realHero;
  shots = shots.filter(s => !s.dead);
}
function drawShots() {
  for (const s of shots) {
    const x = Math.round(s.x - cam), y = Math.round(s.y);
    if (s.type === 'pwave') {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, 12, 3, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowEllipse(x, y - 8, 20, 11); g.globalCompositeOperation = 'source-over';
      const fl = Math.sin(tickN * 0.5 + x) * 2; g.fillStyle = '#ff5a1f'; g.fillRect(x - 8, y - 16, 14, 14); g.fillStyle = '#ffb43a'; g.fillRect(x - 5, y - 18 + fl, 10, 12); g.fillStyle = '#fff1b0'; g.fillRect(x - 2, y - 14, 5, 7);
      continue;
    }
    if (s.type === 'arrow') {
      const zz = y - s.z, d = sgn(s.vx) || 1;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, 7, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowDot(g, x, zz, 9, '170,220,255', 0.5); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#5a4030'; g.fillRect(Math.min(x - d * 8, x + d * 3), zz - 1, 11, 2);
      g.fillStyle = '#e8f4ff'; g.beginPath(); g.moveTo(x + d * 8, zz); g.lineTo(x + d * 3, zz - 3); g.lineTo(x + d * 3, zz + 3); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(x - d * 8 - (d < 0 ? 2 : 0), zz - 2, 2, 4);
      continue;
    }
    if (s.type === 'rune') {
      const tl = s.t < s.delay, p = Math.min(1, s.t / s.delay), fade = tl ? 1 : Math.min(1, (s.delay + s.pool - s.t) / 40);
      g.save(); g.globalCompositeOperation = 'lighter';
      if (tl) {
        g.setLineDash([3, 2]); g.strokeStyle = `rgba(255,${120 + (tickN % 6) * 14},40,${0.35 + 0.5 * p})`; g.lineWidth = 1.5; g.beginPath();
          g.ellipse(x, y, s.r, s.r / 2.4, 0, 0, 7); g.stroke(); g.setLineDash([]); g.strokeStyle = `rgba(255,207,90,${0.2 + 0.5 * p})`; g.lineWidth = 0.7; g.beginPath();
          g.ellipse(x, y, s.r * 0.7, s.r * 0.7 / 2.4, 0, 0, 7); g.stroke();
        g.fillStyle = `rgba(255,80,20,${0.08 + 0.22 * p})`; g.beginPath(); g.ellipse(x, y, s.r * p, s.r * p / 2.4, 0, 0, 7); g.fill();
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + tickN * 0.05; g.fillStyle = 'rgba(255,200,90,0.8)'; g.fillRect(Math.round(x + Math.cos(a) * s.r * 0.7) - 1, Math.round(y + Math.sin(a) * s.r * 0.7 / 2.4) - 1, 3, 2); }
      } else {
        const gr = g.createRadialGradient(x, y, 1, x, y, s.r); gr.addColorStop(0, `rgba(255,170,60,${0.55 * fade})`); gr.addColorStop(1, 'rgba(255,60,10,0)');
        g.translate(x, y); g.scale(1, 1 / 2.4); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s.r, 0, 7); g.fill(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = fade; for (let i = 0; i < 5; i++) { const fx = x - s.r * 0.6 + i * s.r * 0.3, fh = 4 + Math.abs(Math.sin(tickN * 0.4 + i * 1.7)) * 7; g.fillStyle = i % 2 ? '#ffb43a' : '#ff5a1f'; g.fillRect(Math.round(fx), Math.round(y - fh + (i % 2) * 2), 3, Math.round(fh)); }
      }
      g.restore(); continue;
    }
    if (s.type === 'mbolt') {
      const zz = y - s.z, r = s.big ? 7 : 4;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, r + 2, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowDot(g, x, zz, r * 3.2, '190,150,255', 0.75); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#e8dcff'; g.fillRect(x - r / 2, zz - r / 2, r, r); g.fillStyle = '#ffffff'; g.fillRect(x - 1, zz - 1, 2, 2);
      continue;
    }
    if (s.type === 'bolt') {
      const zz = y - s.z;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 6, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowDot(g, x, zz, 12, '150,220,255', 0.7); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#2a1a5a'; g.fillRect(x - 3, zz - 3, 6, 6); g.fillStyle = '#e0f8ff'; g.fillRect(x - 2, zz - 2, 3, 3); g.fillStyle = '#b88aff'; g.fillRect(x + 1, zz, 2, 2);
      continue;
    }
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

