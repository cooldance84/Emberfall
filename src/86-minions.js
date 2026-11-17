/* ---------- stage minions: each stage brings its own kind of monster ---------- */
function updateMinion(e) {
  const k = e.k, ai = k.ai, dx = hero.x - e.x, dy = hero.y - e.y, adx = Math.abs(dx), down = hero.dead || hero.st === 'down';
  const face = () => { e.face = sgn(dx) || e.face; };
  const chase = (stand, sp) => { e.st = 'walk'; e.anim += 0.14; if (Math.abs(dy) > 5) e.y += sgn(dy) * sp * 0.7; if (adx > stand) e.x += sgn(dx) * sp; else if (adx < stand - 10) e.x -= sgn(dx) * sp * 0.8; e.y = clamp(e.y, Y_MIN, Y_MAX); };
  e.ghost = null; e.hov = 0;
  if (ai === 'wisp') { // floats, keeps its distance, lobs slow poison orbs
    e.ghost = 0.62; e.hov = 12 + Math.sin(tickN * 0.08 + e.x) * 2;
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; e.st = 'walk'; e.anim += 0.08;
      if (adx < 110) e.x -= sgn(dx) * k.spd * 0.9; else if (adx > 200) e.x += sgn(dx) * k.spd;
      if (Math.abs(dy) > 8) e.y += sgn(dy) * k.spd * 0.5; e.y = clamp(e.y, Y_MIN, Y_MAX);
      if (e.cool <= 0 && adx < 260 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face(); if (e.t >= k.windup) { shots.push({ type: 'orb', x: e.x + e.face * 18, y: e.y, z: 22, vx: e.face * 1.9, t: 0, dmg: k.dmg, life: 200 }); e.st = 'eatk'; e.t = 0; SFX.swing(); }
    } else if (e.st === 'eatk') { if (e.t >= 14) { e.st = 'idle'; e.t = 0; e.cool = rnd(90, 150); } }
  } else if (ai === 'gob') { // bonus stage: runs straight across the arena, jinking away from the hero, and never fights back
    if (e.st === 'idle' || e.st === 'walk') {
      e.st = 'walk'; e.anim += 0.32; e.face = e.gdir || 1; e.x += (e.gdir || 1) * (e.gv || 2.4); e.gph = (e.gph || 0) + 0.12;
      let vy = Math.sin(e.gph * 2) * 0.5;
      if (adx < 46 && Math.abs(dy) < 18) vy += (dy > 0 ? -1 : 1) * 1.6;
      e.y = clamp(e.y + vy, Y_MIN, Y_MAX);
      if ((e.gdir > 0 && e.x > cam + W + 30) || (e.gdir < 0 && e.x < cam - 30)) { e.gone = true; if (bonus) bonus.esc++; }
    }
  } else if (ai === 'runner') { // telegraphs, then dashes straight through you
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; chase(60, k.spd);
      if (adx < 170 && Math.abs(dy) < 14 && e.cool <= 0 && !down) { e.st = 'wind'; e.t = 0; e.dashDir = sgn(dx) || e.face; }
    } else if (e.st === 'wind') { if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); } }
    else if (e.st === 'eatk') {
      e.x += e.dashDir * 4.6; e.face = e.dashDir; e.anim += 0.4;
      if (e.t % 2 === 0) spawn(e.x - e.dashDir * 8, e.y, 10, 2, { c: ['#fff1b0', '#ff8a2a'], l0: 8, l1: 16, add: true, g: -0.02 });
      strike(e, { x0: -6, x1: 22, dy: 12, z0: 0, z1: k.h }, k.dmg, 'down', players());
      if (e.t >= 26 || e.x < cam - 20 || e.x > cam + W + 20) { e.st = 'idle'; e.t = 0; e.cool = rnd(70, 120); }
    }
  } else if (ai === 'guard') { // shielded: blocks frontal light hits, so hit it from behind or knock it down
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--;
      if (adx > k.rng * 0.8 || Math.abs(dy) > 6) chase(k.rng * 0.8, k.spd); else e.st = 'idle';
      if (adx < k.rng + 4 && Math.abs(dy) < 9 && e.cool <= 0 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') { if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); } }
    else if (e.st === 'eatk') {
      if (e.t >= 3 && e.t <= 7) strike(e, { x0: -4, x1: k.rng + 12, dy: 11, z0: 0, z1: k.h }, k.dmg, 'down', players());
      if (e.t >= 22) { e.st = 'idle'; e.t = 0; e.cool = rnd(60, 110); }
    }
  } else if (ai === 'wraith') { // fades out, reappears behind you
    e.ghost = 0.85;
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; chase(40, k.spd);
      if (e.cool <= 0 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      if (e.t < 12) e.ghost = Math.max(0.12, 1 - e.t / 10);
      if (e.t === 12) {
        spawn(e.x, e.y, 20, 12, { c: ['#fff1b0', '#ffd070'], l0: 10, l1: 22, add: true, up: 1.5 });
        e.x = clamp(hero.x - hero.face * 54, cam + 20, cam + W - 20); e.y = clamp(hero.y + rnd(-6, 6), Y_MIN, Y_MAX); e.face = sgn(hero.x - e.x) || e.face;
        spawn(e.x, e.y, 20, 12, { c: ['#fff1b0', '#ffd070'], l0: 10, l1: 22, add: true, up: 1.5 });
      }
      if (e.t > 12) e.ghost = Math.min(0.9, 0.15 + (e.t - 12) / 14);
      if (e.t >= 30) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); }
    } else if (e.st === 'eatk') {
      if (e.t >= 2 && e.t <= 6) strike(e, { x0: -4, x1: k.rng + 12, dy: 11, z0: 0, z1: k.h }, k.dmg, 'hurt', players());
      if (e.t >= 18) { e.st = 'idle'; e.t = 0; e.cool = rnd(110, 170); }
    }
  } else if (ai === 'archer') { // keeps its distance and fires fast arrows: jump over them
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; e.st = 'walk'; e.anim += 0.1;
      if (adx < 120) e.x -= sgn(dx) * k.spd * 1.1; else if (adx > 210) e.x += sgn(dx) * k.spd;
      if (Math.abs(dy) > 6) e.y += sgn(dy) * k.spd * 0.6; e.y = clamp(e.y, Y_MIN, Y_MAX);
      if (e.cool <= 0 && adx < 290 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face(); if (e.t >= k.windup) { shots.push({ type: 'arrow', x: e.x + e.face * 16, y: e.y, z: 28, vx: e.face * 3.6, vy: clamp((hero.y - e.y) / (adx / 3.6 + 1), -0.5, 0.5), t: 0, dmg: k.dmg, life: 140 }); e.st = 'eatk'; e.t = 0; SFX.swing(); }
    } else if (e.st === 'eatk') { if (e.t >= 12) { e.st = 'idle'; e.t = 0; e.cool = rnd(70, 120); } }
  } else if (ai === 'bomber') { // sprints at you, flashes, then blows up: jump the shockwave
    if (e.st === 'idle' || e.st === 'walk') {
      face(); chase(10, k.spd);
      if (!down && adx < 38 && Math.abs(dy) < 14) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face(); e.flash = (e.t >> 2) & 1 ? 3 : 0; e.anim += 0.3; if (adx > 14) e.x += sgn(dx) * k.spd * 0.5;
      if (e.t >= k.windup) {
        shots.push({ type: 'ring', x: e.x, y: e.y, r: 6, t: 0, dmg: k.dmg, hit: false, max: 64 });
        spawn(e.x, e.y, 14, 26, { s0: 1, s1: 3, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 24, add: true, size: 2, up: 2.4 }); dust(e.x, e.y, 8); shake = Math.max(shake, 5); SFX.big();
        e.dead = true; e.fade = 30; e.hp = 0; e.flash = 0;
      }
    }
  } else if (ai === 'warder' || ai === 'caller') { // casters: keep their distance; the warder shields allies, the caller burns the ground
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; e.st = 'walk'; e.anim += 0.09;
      if (adx < 115) e.x -= sgn(dx) * k.spd; else if (adx > 205) e.x += sgn(dx) * k.spd;
      if (Math.abs(dy) > 8) e.y += sgn(dy) * k.spd * 0.55; e.y = clamp(e.y, Y_MIN, Y_MAX); e.x = clamp(e.x, cam + 16, cam + W - 16);
      if (e.cool <= 0 && adx < 300 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face();
      if (e.t % 3 === 0) spawn(e.x + e.face * 8, e.y, 52, 1, { c: ai === 'warder' ? ['#9ae8ff', '#b88aff'] : ['#ffb43a', '#ff5a1f'], s0: 0.2, s1: 0.6, l0: 8, l1: 16, add: true, up: 1, g: 0 });
      if (e.t >= k.windup) {
        if (ai === 'warder') {
          shots.push({ type: 'bolt', x: e.x + e.face * 16, y: e.y, z: 30, vx: e.face * 2.6, t: 0, dmg: k.dmg, life: 200 }); SFX.swing(); // barriers are only ever worn from the spawn, never cast mid-fight
        } else {
          for (const p of players()) if (!p.dead && Math.abs(p.x - e.x) < 320) shots.push({ type: 'rune', x: p.x + p.vx * 18, y: clamp(p.y + (p.vy || 0) * 18, Y_MIN, Y_MAX), t: 0, delay: 54, r: 24, dmg: k.dmg, pool: stageIdx >= 5 ? 200 : 150 });
          if (stageIdx >= 15 || cycle) shots.push({ type: 'rune', x: clamp(hero.x + rnd(-70, 70), cam + 20, cam + W - 20), y: rnd(Y_MIN, Y_MAX), t: 0, delay: 66, r: 24, dmg: k.dmg, pool: 150 });
          sfxTone('sawtooth', 180, 420, 0.3, 0.05);
        }
        e.st = 'eatk'; e.t = 0;
      }
    } else if (e.st === 'eatk') { if (e.t >= 16) { e.st = 'idle'; e.t = 0; e.cool = ai === 'caller' ? rnd(150, 210) : rnd(80, 130); } }
  } else if (ai === 'knight') { // leaps and crashes down with a shockwave, or cleaves up close
    if (e.st === 'idle' || e.st === 'walk') {
      e.z = 0; face(); e.cool--;
      if (adx > k.rng * 0.8 || Math.abs(dy) > 6) chase(k.rng * 0.8, k.spd); else e.st = 'idle';
      if (!down && e.cool <= 0) {
        if (adx > 80 && adx < 240) { e.st = 'wind'; e.t = 0; e.leap = 1; e.lx = clamp(hero.x - sgn(dx) * 30, cam + 20, cam + W - 20); e.ly = clamp(hero.y, Y_MIN, Y_MAX); e.sx0 = e.x; e.sy0 = e.y; }
        else if (adx < k.rng + 4 && Math.abs(dy) < 9) { e.st = 'wind'; e.t = 0; e.leap = 0; }
      }
    } else if (e.st === 'wind') { face(); if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); } }
    else if (e.st === 'eatk') {
      if (e.leap) {
        const p = clamp(e.t / 34, 0, 1); e.x = lerp(e.sx0, e.lx, p); e.y = lerp(e.sy0, e.ly, p); e.z = Math.sin(p * Math.PI) * 46;
        if (e.t === 34) { e.z = 0; shots.push({ type: 'ring', x: e.x, y: e.y, r: 8, t: 0, dmg: k.dmg, hit: false, max: 76 }); shake = Math.max(shake, 6); dust(e.x, e.y, 10); SFX.big(); }
        if (e.t >= 50) { e.st = 'idle'; e.t = 0; e.leap = 0; e.cool = rnd(100, 160); }
      } else {
        if (e.t >= 3 && e.t <= 7) strike(e, { x0: -4, x1: k.rng + 12, dy: 11, z0: 0, z1: k.h }, k.dmg, 'down', players());
        if (e.t >= 24) { e.st = 'idle'; e.t = 0; e.cool = rnd(70, 120); }
      }
    }
  }
}

