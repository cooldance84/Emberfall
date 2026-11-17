/* ---------- enemies ---------- */
function updateEnemy(e) { // foes that back away (archers, casters, retreating soldiers) stop at the lip of a chasm instead of drifting out over it; chasers still hop across
  const px = e.x; updateEnemy0(e);
  if (!e.dead && !e.pitT && !e.gone && e.kind !== 'imp' && e.kind !== 'gob') { if (e.inField) e.x = clamp(e.x, cam + 10, cam + W - 10); else if (e.x > cam + 10 && e.x < cam + W - 10) e.inField = true; } // once a foe has stepped onto the screen it can no longer be shoved, or walk, off its edge
  if (e.dead || e.pitT || isBoss(e) || e.kind === 'imp' || e.hopDir || e.z > 0.5 || e.st === 'down' || e.st === 'hurt' || e.st === 'getup') return;
  const q = gapAt(e.x, 4);
  if (q && q.type === 'pit' && !gapAt(px, 4)) { const h = nearestPlayer(px); if (Math.abs(h.x - e.x) > Math.abs(h.x - px)) e.x = px; }
  const q2 = gapAt(e.x, -2); // nobody stands over a chasm: a grounded foe that ended up inside one (spawned, shoved, stopped there) is set on the nearer lip
  if (q2 && q2.type === 'pit') e.x = e.x < q2.x + q2.w / 2 ? q2.x - 7 : q2.x + q2.w + 7;
}
function updateEnemy0(e) {
  if (e.el && !e.dead && elemTick(e)) return;
  if (e.kind === 'imp') { updateImp(e); return; }
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; if (e.pitT) e.pitT++; return; }
  if (e.leap && e.st !== 'eatk' && e.st !== 'wind') { e.leap = 0; e.z = 0; }
  // a barrier is one-time: once it is broken it never comes back
  if (groundPhysics(e)) return;
  if ((e.st === 'idle' || e.st === 'walk') && e.cool < 5000) e.cool -= isBoss(e) ? (e.p2 ? 0.5 : 0.3) : 0.2;
  if (!isBoss(e) && !e.leap) { // husks hop across chasms and barricades
    const gp = gapAt(e.x, 4);
    if (gp) { if (!e.hopDir) e.hopDir = e.x < gp.x + gp.w / 2 ? 1 : -1; e.x += e.hopDir * 1.7; e.z = Math.min(26, e.z + 3.5); }
    else { e.hopDir = 0; if (e.z > 0) e.z = Math.max(0, e.z - 3); }
  }
  if (e.kind === 'witch' || e.kind === 'smith' || e.kind === 'king' || e.kind === 'wyrm') { updateBoss(e); return; }
  if (e.k.ai) { updateMinion(e); return; }
  const k = e.k, spdK = (e.mount ? 1.7 : 1) * (e.kind === 'boss' && bossPhase2(e) ? 1.5 : 1), dx = hero.x - e.x, dy = hero.y - e.y;
  const heroDown = hero.dead || hero.st === 'down';
  if ((e.st === 'idle' || e.st === 'walk') && e.kind === 'h' && !e.mount && !e.elite && mounts.length) { // a foe may climb back onto a free wyrmling lying around: the nearest soldier goes for it
    const wm = mounts.find(m => !m.flee && !m.gone && m.z < 3 && (m.mobRides | 0) < 2 && Math.abs(m.x - e.x) < 220);
    if (wm) {
      const mine = enemies.filter(o => !o.dead && o.kind === 'h' && !o.mount && !o.elite && (o.st === 'idle' || o.st === 'walk')).sort((a, b) => Math.abs(a.x - wm.x) - Math.abs(b.x - wm.x))[0];
      if (mine === e) {
        const mdx = wm.x - e.x, mdy = wm.y - e.y;
        if (Math.abs(mdx) < 16 && Math.abs(mdy) < 9) {
          e.mount = wm; wm.mobRides = (wm.mobRides | 0) + 1; mounts.splice(mounts.indexOf(wm), 1); e.h = k.h + 12; e.hp = Math.max(e.hp, Math.round(e.maxhp * 0.6)); e.st = 'idle'; e.t = 0; e.cool = Math.max(e.cool, 30);
          SFX.pick(); sparks(e.x, e.y, 20, true); floatText(e.x, e.y - e.h - 10, 'MOUNTED!', '#ff9a6a', 8); return;
        }
        e.face = sgn(mdx) || e.face; e.st = 'walk'; e.anim += 0.2; e.x += sgn(mdx) * k.spd * 1.15; if (Math.abs(mdy) > 4) e.y = clamp(e.y + sgn(mdy) * k.spd * 0.8, Y_MIN, Y_MAX);
        return;
      }
    }
  }
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
      strike(e, { x0: -4, x1: k.rng + 12, dy: e.kind === 'boss' ? 18 : 10, z0: 0, z1: k.h }, Math.round(k.dmg * (e.mount ? 1.25 : 1)), e.kind === 'h' ? 'hurt' : 'down', players());
      if (e.kind === 'boss' && e.t === 3) { shake = Math.max(shake, 9); for (let i = 0; i < 18; i++) parts.push({ x: e.x + e.face * rnd(30, 90), y: e.y + rnd(-6, 6), z: 0, vx: e.face * rnd(0.5, 3), vy: 0, vz: rnd(1, 3), life: 20, max: 20, g: 0.2, c: '#ffb04a', size: 2, add: true }); }
    }
    if (e.t >= 18) { e.st = 'idle'; e.t = 0; e.cool = rnd(45, 95) * (e.kind === 'boss' ? (e.p2 ? 0.45 : 0.7) : 1); }
  }
}

