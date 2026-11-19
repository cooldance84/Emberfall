/* ---------- combat ---------- */
function hurt(e, dmg, kind, from) {
  if (!e.pn && !isBoss(e) && from.pn && !e.dead && e.hp > 0 && e.kind !== 'imp' && (e.st === 'down' || e.st === 'getup')) { // a foe on the ground can still be hit, for half damage: the combo never stalls while it gets up
    if (e.barrier > 0) return false;
    dmg = Math.max(1, Math.round(dmg * 0.5)); e.hp -= dmg; e.flash = 4; lastEnemy = e; sparks(e.x, e.y, e.z + 6, false); SFX.hit();
    if (e.hp <= 0) { e.hp = 0; e.st = 'down'; e.t = 21; e.z = 0; e.vz = 0; e.vx = 0; }
    return true;
  }
  if (e.dead || e.inv > 0 || e.st === 'down' || e.st === 'getup') return false;
  const dir = sgn(e.x - from.x) || -from.face;
  if (!e.pn && e.el && e.el.frz > 0 && elemTier() >= 4) dmg = Math.round(dmg * 1.2); // frozen foes are brittle
  if (!e.pn && from.pn && e.el && (e.el.burn > 0 || e.el.frz > 0 || e.el.stun > 0 || e.el.chill > 0)) { const af = setBonus('afl'); if (af) dmg = Math.round(dmg * (1 + af / 100)); } // Emberheart 4: more damage to burning, frozen, stunned or chilled foes
  if (e.pn && !from.pn) dmg = Math.max(1, Math.round(dmg * dmgMul() * (dailyIs('GLASS CANNON') ? 1.5 : 1) * (from.kind && BOSSES[from.kind] ? 1.15 : 1) * (from.elite ? 1.25 : 1) * (1 - elemResist(hitEl || from.el || ENEMY_EL[from.kind])) * (1 - pgRes())));
  if (e.pn && !from.pn) { // a hit on a hero: the shrine ward soaks it first; only a blow that gets through breaks the kill combo
    if (buff && buff.id === 'ward' && buff.ward > 0) {
      const ab = Math.min(buff.ward, dmg); buff.ward -= ab; dmg -= ab; e.flash = 3;
      spawn(e.x, e.y, e.z + 24, 6, { c: ['#9ae8ff', '#ffffff'], l0: 8, l1: 16, add: true });
      floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9, '-' + ab, '#6ab8ff', 8);
      if (dmg <= 0) { e.inv = Math.max(e.inv, 8); SFX.land(); return true; }
    }
    killCombo = 0;
  }
  if (!e.pn && e.barrier > 0 && e.kind !== 'imp') { // arcane barrier: no damage gets through until it shatters; heavy blows crack it fastest
    const d = kind === 'down' ? dmg : Math.max(1, Math.round(dmg * 0.35));
    e.barrier -= d; e.bflash = 6; e.blockT = tickN; lastEnemy = e; freeze = Math.max(freeze, 2);
    spawn(e.x, e.y, e.z + e.h * 0.55, 6, { c: ['#9ae8ff', '#e0f8ff', '#b88aff'], l0: 8, l1: 16, add: true });
    if (e.barrier <= 0) {
      e.barrier = 0; e.bbreak = tickN; e.st = 'down'; e.t = 0; e.vz = 3; e.vx = dir * 1.6; e.z = Math.max(e.z, 0.01);
      spawn(e.x, e.y, e.z + e.h * 0.5, 26, { s0: 1, s1: 3.2, c: ['#9ae8ff', '#ffffff', '#b88aff'], l0: 12, l1: 28, add: true, size: 2, up: 2, g: 0.06 });
      if (from.pn) floatText(e.x, e.y - e.h - 10, 'BARRIER BROKEN!', '#9ae8ff', 9); SFX.big(); shake = Math.max(shake, 5);
    } else { if (!(from.sk && from.sk.id === 6 && kind === 'hurt')) SFX.land(); if (from.pn && !(from.sk && from.sk.id === 6 && kind === 'hurt')) floatText(e.x, e.y - e.z - e.h * 0.9, kind === 'down' ? '-' + d : 'BARRIER', '#9ae8ff', 8); } // the ultimate's many ticks stay quiet on a barrier
    return true;
  }
  if (e.pn && e.mount) { // the blow throws the rider off; the wyrmling waits, but bolts after the second fall
    const m = e.mount; m.hp -= dmg; m.flash = 4; m.falls = (m.falls || 0) + 1; e.jf = 0;
    e.mount = null; e.h = e.k.h; e.flash = 4; e.st = 'hurt'; e.t = 0; e.vx = dir * 1.8; e.vz = 2.6; e.z = Math.max(e.z, 0.01); e.inv = 55;
    m.x = e.x - dir * 14; m.y = e.y; m.z = 0.01; m.vz = 3; m.face = dir || m.face;
    if (m.falls >= 2 || m.hp <= 0) { m.flee = true; m.dir = -dir || 1; msg = mtype(m).name + ' BOLTED!'; msgT = 90; SFX.die(); }
    else { msg = 'THROWN!  K NEAR THE ' + mtype(m).name.split(' ')[0] + ' TO REMOUNT  (1 FALL LEFT)'; msgT = 110; }
    mounts.push(m); sparks(e.x, e.y, e.z + 20, true); SFX.hit(); shake = Math.max(shake, 4); freeze = Math.max(freeze, 3);
    return true;
  }
  if (e.k && e.k.ai === 'guard' && kind !== 'down' && (e.st === 'idle' || e.st === 'walk') && sgn(from.x - e.x) === e.face) { // shield up
    e.hp -= Math.max(1, Math.round(dmg * 0.2)); e.flash = 2; e.blockT = tickN; lastEnemy = e; sparks(e.x + e.face * 14, e.y, e.h * 0.5, false); SFX.land(); freeze = Math.max(freeze, 1);
    if (from.pn) floatText(e.x, e.y - e.h, 'BLOCK', '#c8a8ff', 8);
    if (e.hp <= 0) { e.st = 'down'; e.t = 0; e.vz = 3; e.z = 0.01; }
    return true;
  }
  e.hp -= dmg; e.flash = 4; e.lastHit = tickN;
  sparks(e.x, e.y, e.z + e.h * 0.6, kind === 'down');
  slashes.push({ x: e.x, y: e.y, z: e.z + e.h * 0.6, t: 0, big: kind === 'down', a: dir > 0 ? rnd(-0.9, -0.3) : Math.PI + rnd(0.3, 0.9) });
  if (!e.pn) lastEnemy = e;
  else shake = Math.max(shake, 4);
  SFX[kind === 'down' ? 'big' : 'hit']();
  freeze = Math.max(freeze, kind === 'down' ? 7 : 3);
  shake = Math.max(shake, kind === 'down' ? 6 : 2);
  if (from.pn && !dragon) from.mana = Math.min(100, from.mana + dmg * 0.6 * (from.k && from.k.cls === 'panni' ? 1.5 : 1));
  if (e.kind === 'imp' && e.vase) { // the pilferer drops its vase and bolts
    e.vase = false; e.fled = true; e.dir = sgn(e.x - from.x) || 1;
    items.push({ x: e.x, y: e.y, t: 0, kind: 'vase' });
  }
  let knock = kind === 'down' || e.hp <= 0 || (e.z > 3 && !e.leap && !e.hov); // a blow in mid-air always knocks you out of the air
  if (e.mount && (kind === 'down' || e.hp <= 0 || e.hp <= e.maxhp * 0.55)) { // rider thrown from its wyrmling
    const m = e.mount; e.mount = null; e.h = e.k.h;
    m.x = e.x + dir * 6; m.y = e.y; m.z = 0.01; m.vz = 3; m.face = -dir; mounts.push(m);
    spawn(e.x, e.y, 14, 10, { c: ['#ffd070', '#ff8a2a'], l0: 10, l1: 20, add: true });
    knock = true;
  }
  if (isBoss(e) && e.hp > 0) { e.armor -= dmg; if (e.armor <= 0) { e.armor = e.k.poise || 70; knock = true; } else knock = false; }
  if (knock) { e.st = 'down'; e.t = 0; e.vz = 3.2; e.vx = dir * 2.1; e.z = Math.max(e.z, 0.01); e.combo = 0; }
  else if (!isBoss(e)) { // Nolan's heavy sword swing is not interrupted by light blows (heavy ones still knock him down)
    if (e.pn && e.k && e.k.cls === 'nolan' && e.st === 'atk' && !e.sk && kind !== 'down' && e.z <= 3 && e.t >= comboOf(e)[e.combo].a - 2 && e.t <= comboOf(e)[e.combo].b + 2) spawn(e.x, e.y, e.z + 26, 5, { c: ['#fff1b0', '#ffd24a'], l0: 6, l1: 12, add: true });
    else { e.st = 'hurt'; e.t = 0; e.vx = dir * 1.1; }
  }
  return true;
}
const elBase = () => 9 * pstats().mult * (buffIs('fury') ? 1.3 : 1) * (1 + elemPower() / 100);
function elOf(e) { return e.el || (e.el = { fire: 0, frost: 0, bolt: 0, burn: 0, bst: 0, frz: 0, stun: 0, chill: 0, cd: 0, acc: 0, shk: 0 }); }
function elNear(e, r) { return enemies.filter(o => o !== e && !o.dead && o.kind !== 'imp' && Math.abs(o.x - e.x) < r && Math.abs(o.y - e.y) < r * 0.6); }
const DMG_COL = { '#7ad8ff': '#ffffff', '#c8a8ff': '#4aa8ff' }; // frost damage shows white, lightning damage blue
function elDmg(e, d, col) { // status damage: no knock-back, no invulnerability frames; a kill falls through the normal death path
  if (e.dead || !(d > 0) || e.barrier > 0) return; d = Math.max(1, Math.round(d)); e.hp -= d; lastEnemy = e;
  floatText(e.x + rnd(-5, 5), e.y - e.z - e.h * 0.95, String(d), DMG_COL[col] || col, 7);
  if (e.hp <= 0 && e.st !== 'down' && e.st !== 'getup') { e.st = 'down'; e.t = 0; e.vz = 2; e.vx = 0; e.z = Math.max(e.z, 0.01); }
}
function elArc(a, b, col) { for (let i = 0; i <= 5; i++) { const t = i / 5; spawn(a.x + (b.x - a.x) * t + rnd(-3, 3), a.y + (b.y - a.y) * t, a.h * 0.55 + rnd(-6, 6), 1, { c: col, l0: 6, l1: 12, add: true, size: 2, g: 0 }); } }
let elDepth = 0; // chains can never run away: a hit cascading through foes is cut off after a few hops
function elemBuild(e, el, amt, T, noSpread) { if (elDepth > 5) return; elDepth++; try { elemBuild0(e, el, amt, T, noSpread); } finally { elDepth--; } }
function elemBuild0(e, el, amt, T, noSpread) {
  const S = elOf(e), R = ePar(); if (e.dead || e.barrier > 0) return;
  const rs = clamp((ELEM_RES[e.kind] || {})[el] || 1, 0.4, 1.4) * (isBoss(e) ? 0.8 : 1); amt *= rs;
  S[el] += amt;
  if (el === 'fire' && S.burn > 0) S.burn = Math.max(S.burn, 150 + 25 * T);
  if (!noSpread && T >= 5 && (el === 'fire' ? S.burn > 0 : el === 'frost' ? S.chill > 0 || S.frz > 0 : S.shk > 0)) { // from tier V an afflicted foe takes its next layer after fewer direct hits: a separate quick-layer meter (chained and spread build-up never counts), so the main build-up and its bursts are untouched
    S.lq = (S.lq || 0) + amt;
    if (S.lq >= 65) { S.lq -= 65; if (el === 'fire') S.bst = Math.min(layerCap(), S.bst + 1); else if (el === 'frost') S.fst = Math.min(layerCap(), (S.fst | 0) + 1); else S.sst = Math.min(layerCap(), (S.sst | 0) + 1); }
  }
  if (S[el] < 100) return; S[el] -= 100;
  const base = elBase(), col = ELEM[el].col, cap = isBoss(e) ? 0.4 : 1;
  if (el === 'fire') {
    S.burn = [0, 150, 200, 200, 220, 240, 260, 300, 300, 320, 340][T]; S.bst = T >= 5 ? Math.min(layerCap(), S.bst + 1) : 1;
    floatText(e.x, e.y - e.h - 10, 'IGNITED', col, 8); SFX.burn(); spawn(e.x, e.y, e.h * 0.5, 8, { c: ['#ffd070', '#ff7a2a'], l0: 10, l1: 22, add: true, size: 2, up: 1.5 });
    if (T >= 3 && !noSpread) for (const o of elNear(e, 60 + 6 * R)) elemBuild(o, 'fire', 28 + 2 * R, T, true);
    if (T >= 7) for (const o of elNear(e, 50 + 6 * R)) elDmg(o, base * ELEM_PT[T] * 1.3, col);
  } else if (el === 'frost') {
    S.fst = T >= 5 ? Math.min(layerCap(), (S.fst | 0) + 1) : 1; // from tier V the cold stacks up to three layers
    if (T < 3) { S.chill = 150; floatText(e.x, e.y - e.h - 10, 'CHILLED', col, 8); SFX.freeze(); }
    else if (S.cd <= 0) {
      S.frz = Math.round([0, 0, 0, 54, 54, 80, 80, 100, 105, 110, 115][T] * cap); S.cd = isBoss(e) ? 420 : 0; S.chill = 150;
      floatText(e.x, e.y - e.h - 10, 'FROZEN', col, 8); SFX.freeze(); spawn(e.x, e.y, e.h * 0.5, 10, { c: ['#e8faff', '#7ad8ff'], l0: 12, l1: 26, add: true, size: 2, up: 1.2 });
      if (T >= 6 && !noSpread) for (const o of elNear(e, 55 + 10 * R)) elemBuild(o, 'frost', 50 + 4 * R, T, true);
    } else { S.chill = 150; }
  } else {
    S.sst = T >= 5 ? Math.min(layerCap(), (S.sst | 0) + 1) : 1; // ...and so do the shocks
    const n = (T >= 7 ? 3 : T >= 4 ? 2 : 1) + (S.bx ? 1 : 0) + R, r = 70 + (T >= 2 ? 25 : 0) + 10 * R, dm = base * ELEM_PT[T] * 2.2 * (T >= 2 ? 1.25 : 1) * (S.bx ? 2 : 1) * (1 + 0.1 * (S.sst - 1));
    elNear(e, r).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, n).forEach(o => { elArc(e, o, ['#fff6a0', '#6ab8ff']); elDmg(o, dm, col); elemBuild(o, 'bolt', Math.min(30, Math.floor(90 / n)), T, true); });
      // a fired chain hands out less than the 100 a foe needs to fire again, so it dies out by itself
    if (T >= 6) { elDmg(e, base * ELEM_PT[T] * 3, col); for (let i = 0; i < 6; i++) spawn(e.x + rnd(-2, 2), e.y, i * 9, 1, { c: ['#fff6a0', '#ffffff'], l0: 8, l1: 14, add: true, size: 2, g: 0 }); }
    if (T >= 3 && S.cd <= 0) { S.stun = Math.round(((T >= 5 ? 34 : 20) + 6 * R) * cap); S.cd = isBoss(e) ? 420 : 0; floatText(e.x, e.y - e.h - 10, 'SHOCKED', col, 8); }
    S.shk = 120 + 15 * T; S.sdbl = S.bx ? 1 : S.sdbl; // electrified: shock damage over time, doubled after an overcharge
    spawn(e.x, e.y, e.h * 0.6, 8, { c: ['#fff6a0', '#6ab8ff'], l0: 6, l1: 14, add: true, size: 2, up: 1 }); SFX.zap();
  }
}
const elemActive = e => { const S = e.el, el = rpg.elem; return !!S && (el === 'fire' ? S.burn > 0 : el === 'frost' ? S.chill > 0 || S.frz > 0 : S.stun > 0 || S.bolt >= 30); };
const REKINDLE_HITS = 4;  // normal hits on a foe that is still under your element, in a row, rekindle it like a skill does
function elemRekindle(e, att, was) { // a skill cast on a foe still under your element from before doubles the effect (once per cast and foe); so does the 4th normal hit on it
  const el = rpg.elem, T = elemTier(); if (!att.pn || !el || !T || !e.el || e.dead || e.el.bsk === att.sk && att.sk) return;
  const S = e.el; if (!(el === 'fire' ? S.burn > 0 : el === 'frost' ? S.chill > 0 || S.frz > 0 : S.bolt >= 1 || S.stun > 0)) { if (!att.sk) S.nk = 0; return; }
  if (att.sk) S.bsk = att.sk;
  else { // a normal hit: counts only on a foe that was already afflicted before this hit, and fires on the 4th; lightning's overcharge also waits 3 s between two
    if (!was) { S.nk = 0; return; }
    S.nk = (S.nk | 0) + 1; if (S.nk < REKINDLE_HITS) return; S.nk = 0;
    if (el === 'bolt') { if (S.nkc > 0) return; S.nkc = 180; }
  }
  if (!was) return;
  if (el === 'fire' && !S.bdbl) { S.bdbl = 1; S.burn = Math.max(S.burn, 150 + 25 * T); floatText(e.x, e.y - e.h - 22, 'BURN x2', '#ffb43a', 9); SFX.burn(); spawn(e.x, e.y, e.h * 0.5, 12, { c: ['#fff1b0', '#ff7a2a', '#ff3a1a'], s0: 1, s1: 2.6, l0: 12, l1: 26, add: true, size: 2, up: 2 }); }
  else if (el === 'frost' && !S.fdbl) { // deeper cold: twice as long, a harder slow, a frozen foe stays frozen longer and can be frozen again sooner
    S.fdbl = 1; S.chill = Math.max(S.chill, 300); if (S.frz > 0) S.frz *= 2; S.cd = Math.min(S.cd, 90);
    floatText(e.x, e.y - e.h - 22, 'DEEP FREEZE', '#9ae8ff', 9); SFX.freeze(); spawn(e.x, e.y, e.h * 0.5, 12, { c: ['#e8faff', '#7ad8ff'], s0: 1, s1: 2.4, l0: 12, l1: 26, add: true, size: 2, up: 1.6 });
  } else if (el === 'bolt') { // overcharge: an extra chain that hits twice as hard and jumps one foe further
    S.cd = 0; S.bx = 1; elemBuild(e, 'bolt', 101, T); S.bx = 0; floatText(e.x, e.y - e.h - 22, 'OVERCHARGE', '#fff6a0', 9);
  }
}
function elemHit(e, att, kind, crit) { // called after one of the hero's hits lands
  const T = elemTier(); if (!T || e.dead || e.pn) return; const el = rpg.elem, cls = att.k && att.k.cls;
  let amt = (kind === 'down' ? 38 : 24) * (cls === 'panni' ? 1.2 : 1) * (crit ? (cls === 'luca' ? 1.5 : 1.25) : 1) * (el === 'frost' && T >= 2 ? 1.25 : 1);
  elemBuild(e, el, amt * (1 + elemPower() / 100), T);
}
// elemental procs: a hit may carry extra elemental damage plus the status of the element at your tier.
// A hero who has chosen an element only ever procs that element; one who has not gets a random element on skill hits (tier 1 effects).
// Normal hits: 3.9% (tier 1) to 6.3% (tier 7), extra damage worth about one more hit (0.9x to 1.4x). Skill hits: 30% (10% per tick for the ultimate), extra damage worth half of that.
function elemProc(e, att, dealt, isSkill) {
  if (!att.pn || e.dead || e.pn || e.barrier > 0) return;
  const own = rpg.elem, tier = elemTier();
  let ch, el;
  if (isSkill) { ch = att.sk.id === 6 ? 0.1 : 0.3; el = own || pickOf(ELEMS); }
  else { if (!own || !tier) return; ch = (0.035 + 0.004 * tier) * (isBoss(e) ? 0.7 : 1); el = own; }
  if (Math.random() >= ch) return;
  const T = Math.max(1, tier), S = elOf(e), rs = clamp((ELEM_RES[e.kind] || {})[el] || 1, 0.4, 1.4) * (isBoss(e) ? 0.8 : 1);
  elemBuild(e, el, Math.max(0, (100 - S[el]) / rs) + 1, T); // topped up so the status always lands
  elDmg(e, dealt * (isSkill ? 0.5 : 1) * (0.8 + 0.08 * T) * rs, ELEM[el].col);
  spawn(e.x, e.y, e.z + e.h * 0.6, 8, { s0: 1, s1: 3, c: [ELEM[el].col, '#ffffff'], l0: 8, l1: 16, add: true, size: 2 });
}
function elemTick(e) { // once per frame per afflicted monster; true when it loses this frame (frozen, stunned, slowed)
  const S = e.el, T = elemTier() || 1, free = e.st === 'down' || e.st === 'hurt' || e.st === 'getup';
  for (const k of ELEMS) if (S[k] > 0) S[k] = Math.max(0, S[k] - 0.35); if (S.lq > 0) S.lq = Math.max(0, S.lq - 0.35);
  if (S.cd > 0) S.cd--; if (S.chill > 0) S.chill--; if (S.stun > 0) S.stun--; if (S.nkc > 0) S.nkc--;
  if (!(S.chill > 0 || S.frz > 0)) { S.fst = 0; if (S.fdbl) { S.fdbl = 0; S.bsk = null; } } if (S.bsk && rpg.elem === 'bolt' && !(S.bolt >= 1 || S.stun > 0)) S.bsk = null;
  if (S.frz > 0) { S.frz--; if (tickN % 12 === 0) spawn(e.x + rnd(-8, 8), e.y, rnd(4, e.h), 1, { c: ['#e8faff', '#7ad8ff'], l0: 8, l1: 16, add: true, size: 1, g: 0 }); }
  if (S.stun > 0 && tickN % 5 === 0) spawn(e.x + rnd(-8, 8), e.y, rnd(4, e.h), 1, { c: ['#fff6a0'], l0: 4, l1: 8, add: true, size: 2, g: 0 });
  if (S.burn > 0) {
    S.burn--; if (tickN % 6 === 0) spawn(e.x + rnd(-6, 6), e.y, rnd(2, e.h * 0.8), 1, { c: ['#ffd070', '#ff7a2a'], l0: 8, l1: 16, add: true, size: 2, up: 1.4, g: -0.02 });
    if (tickN % 30 === 0 && !e.dead) elDmg(e, elBase() * ELEM_PT[T] * (T >= 2 ? 1.25 : 1) * (S.bdbl ? 2 : 1) * (1 + 0.35 * (S.bst - 1)) * (rpg.elem === 'fire' && CLS === 'nolan' ? 1.1 : 1), ELEM[rpg.elem || 'fire'].col);
    if (S.burn === 0) { S.bst = 0; S.bdbl = 0; S.bsk = null; }
  }
  if ((S.chill > 0 || S.frz > 0) && tickN % 30 === 0 && !e.dead) elDmg(e, elBase() * ELEM_PT[T] * (T >= 2 ? 1.25 : 1) * (S.fdbl ? 2 : 1) * (S.frz > 0 ? 1.4 : 1) * (1 + 0.15 * Math.min(2, (S.fst || 1) - 1) + 0.3 * Math.max(0, (S.fst || 1) - 3)), ELEM.frost.col);
    // frostbite: damage over time while chilled or frozen
  if (S.shk > 0) { S.shk--; if (tickN % 20 === 0 && !e.dead) elDmg(e, elBase() * ELEM_PT[T] * (T >= 2 ? 1.25 : 1) * 0.55 * (S.sdbl ? 2 : 1) * (1 + 0.2 * Math.min(2, (S.sst || 1) - 1) + 0.5 * Math.max(0, (S.sst || 1) - 3)), ELEM.bolt.col);
    if (S.shk === 0) { S.sdbl = 0; S.sst = 0;
    } if (tickN % 8 === 0) spawn(e.x + rnd(-6, 6), e.y, rnd(2, e.h * 0.9), 1, { c: ['#fff6a0', '#6ab8ff'], l0: 4, l1: 8, add: true, size: 1, g: 0 }); }
  if (free) return false;
  if (S.frz > 0 || S.stun > 0) { if (e.flash > 0) e.flash--; return true; }
  let sl = S.chill > 0 ? 0.35 + (T >= 5 ? 0.1 : 0) : S.frost * 0.003; const fs = 1 + 0.2 * ((S.fst || 1) - 1), cp = Math.min(0.15, 0.05 * ((S.fst || 1) - 1)); if (S.chill > 0) sl *= fs;
  sl = S.fdbl ? Math.min(sl * 1.5, (isBoss(e) ? 0.45 : 0.7) + cp) : Math.min(sl, (isBoss(e) ? 0.3 : 0.5) + cp); // deep freeze slows harder
  if (sl > 0) { S.acc += sl; if (S.acc >= 1) { S.acc -= 1; if (e.flash > 0) e.flash--; return true; } }
  return false;
}
function elemDeath(e) { // burning foes erupt, frozen foes shatter
  const S = e.el, T = elemTier(); if (!S || !T) return;
  if (S.burn > 0 && T >= 4) { SFX.big(); for (const o of elNear(e, 48 + 10 * ePar())) elDmg(o, elBase() * ELEM_PT[T] * 3, ELEM.fire.col); spawn(e.x, e.y, 14, 14, { c: ['#ffd070', '#ff7a2a'], s0: 1, s1: 3, l0: 10, l1: 22, add: true, size: 2, up: 2 }); }
  if (S.frz > 0 && T >= 7) { SFX.shatter(); for (const o of elNear(e, 52 + 10 * ePar())) elDmg(o, elBase() * ELEM_PT[T] * 4, ELEM.frost.col); spawn(e.x, e.y, 14, 14, { c: ['#e8faff', '#7ad8ff'], s0: 1, s1: 3, l0: 10, l1: 22, add: true, size: 2, up: 2 }); }
}
function gearSparks() { // forged gear (+5 and more) throws golden sparks, more with every level
  if (tickN % 6) return;
  for (const p of players()) { const u = p.k && p.k.gup; if (!u || u < 5 || p.dead || Math.random() > 0.25 * (u - 3)) continue;
    spawn(p.x + rnd(-8, 8), p.y, rnd(6, 38), 1, { c: ['#fff1b0', '#ffd24a'], l0: 12, l1: 24, add: true, size: 1, up: 0.8, g: -0.01 }); }
}
function elemAura() { // tier VI fire: a ring of fire pulses around each hero
  if (elemTier() < 6 || rpg.elem !== 'fire' || tickN % 240) return;
  for (const p of players()) { if (p.dead) continue; for (const o of enemies) if (!o.dead && Math.abs(o.x - p.x) < 52 && Math.abs(o.y - p.y) < 32) elemBuild(o, 'fire', 34, elemTier(), true);
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; spawn(p.x + Math.cos(a) * 44, p.y + Math.sin(a) * 14, 6, 1, { c: ['#ffd070', '#ff7a2a'], l0: 12, l1: 22, add: true, size: 2, up: 0.6 }); } }
}
