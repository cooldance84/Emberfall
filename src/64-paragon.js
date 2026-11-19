/* ---------- paragon: after level 70 the experience goes on, and every paragon point adds a little of everything ---------- */
const PG_MAX = 100, pgNeed = n => 4500 + 80 * n;
const pgHp = () => 1 + 0.008 * (rpg.pg | 0), pgDmg = () => 1 + 0.007 * (rpg.pg | 0), pgRes = () => 0.003 * (rpg.pg | 0); // +0.8% life, +0.7% damage, 0.3% less damage taken per point
/* kill combo: foes killed within three seconds of each other build a combo that adds up to +75% experience; any hit on a hero breaks it */
let killCombo = 0, killComboT = -999;
const KC_WINDOW = 180, kcBonus = () => Math.min(0.75, killCombo * 0.03);
function gainXP(n) {
  if (daily && n > 0) n = Math.round(n * SEASON_XP); // the season race pays double
  if (rpg.lvl >= MAX_LV && n > 0) {
    if (rpg.pg >= PG_MAX) return;
    rpg.pxp += n; let up = 0; const pg0 = rpg.pg;
    while (rpg.pg < PG_MAX && rpg.pxp >= pgNeed(rpg.pg)) { rpg.pxp -= pgNeed(rpg.pg); rpg.pg++; up++; }
    if (rpg.pg >= PG_MAX) rpg.pxp = 0;
    if (up) { PS = null; heroStats(false); for (const p of players()) if (!p.dead) { p.hp = Math.min(p.maxhp, p.hp + (p.maxhp * 0.15 | 0)); floatText(p.x, p.y - 62, '+' + (up > 1 ? up + ' ' : '') + 'PARAGON', '#5ab4ff', 9); }
      msg = 'PARAGON ' + rpg.pg + (rpg.pg >= PG_MAX ? '  MAX' : ''); msgT = 90; flashA = 0.15; SFX.magic();
      if (rpg.elem && Math.floor(rpg.pg / 10) > Math.floor(pg0 / 10) && Math.floor(rpg.pg / 10) <= 3) { msg = 'NEW ' + ELEM[rpg.elem].name + ' TIER READY - SEE THE BLACKSMITH'; msgT = 240; }
      saveGame(); }
    return;
  }
  if (rpg.lvl >= MAX_LV || n <= 0) return;
  rpg.xp += n; let up = false; const lv0 = rpg.lvl;
  while (rpg.lvl < MAX_LV && rpg.xp >= xpNeed(rpg.lvl)) { rpg.xp -= xpNeed(rpg.lvl); rpg.lvl++; up = true; }
  if (rpg.lvl >= MAX_LV) rpg.xp = 0;
  if (up) levelUp(lv0);
}
function levelUp(lv0) {
  heroStats(false); for (const p of players()) p.hp = Math.min(p.maxhp, p.hp + (p.maxhp * 0.35 | 0));
  msg = rpg.lvl >= MAX_LV ? 'MAX LEVEL 70!' : 'LEVEL UP!  LV ' + rpg.lvl; msgT = 130; flashA = 0.3; SFX.magic();
  spawn(hero.x, hero.y, 20, 36, { s0: 1, s1: 3.4, c: ['#fff1b0', '#ffd24a', '#c9a8ff'], l0: 16, l1: 36, add: true, size: 2, up: 3, g: 0.05 });
  const sk = SKILLS.filter(k => k.lv > (lv0 || 0) && k.lv <= rpg.lvl).pop();
  if (sk) { for (const p of players()) p.ski = skillsOf().length - 1; msg = 'NEW SKILL: ' + skName(sk, hero) + '  (U)'; msgT = 220; }
  if (rpg.lvl >= 10 && !rpg.elem && lv0 < 10) { msg = 'ELEMENT UNLOCKED - SEE THE BLACKSMITH'; msgT = 240; }
  else if (rpg.elem && elemAvail() > (rpg.et | 0) && Math.floor(rpg.lvl / 10) > Math.floor((lv0 || 0) / 10)) { msg = 'NEW ' + ELEM[rpg.elem].name + ' TIER READY - SEE THE BLACKSMITH'; msgT = 240; }
  saveGame();
}
function rollRarity() { // stage 1: white only. 2: +magic 34%. 3: +rare 15%, +legendary 7%. 4+: +mythic 1%
  const t = tierOf();
  const lk = rpg.lvl || 1; // a little level luck: the higher you are, the better the top drops
  if (t >= 3 && Math.random() < 0.01 + lk * 0.0003 + trialN() * 0.004) return 4; // each Ember Trial adds a little mythic luck
  if (t >= 2 && Math.random() < 0.07 + lk * 0.0005) return 3;
  if (t >= 2 && Math.random() < 0.16) return 2;
  if (t >= 1 && Math.random() < 0.34) return 1;
  return 0;
}
const canWear = it => (it.lvl || 1) <= rpg.lvl;
function genItem(rar, slot, ilvl) { // items carry an item level, and you must be at least that level to wear them
  slot = slot || pickOf(SLOTS);
  const il = ilvl || (rpg.lvl >= MAX_LV ? MAX_LV : clamp(Math.max(areaLv(), rpg.lvl) + (Math.random() * 6 | 0) - 2 + (Math.random() < 0.06 ? 4 + (Math.random() * 4 | 0) : 0), 1, MAX_LV));
    // drops land around your level (now and then a few levels above it); at the level cap every drop is full level 70
  const setId = rar >= 3 && il >= SET_MIN_LV && Math.random() < SET_CH[rar] * (1 + 0.15 * trialN()) * setBoost ? pickOf(Object.keys(SETS)) : null;
  if (setId) rar = 4; // a set piece is built from mythic stats...
  const R = RARITY[rar];
  const Q = Math.random() ** 1.5, qm = setId ? 1.4 + 0.12 * Q : 0.8 + 0.6 * Q; // roll quality: mostly average, rarely perfect. A great legendary can still beat a poor mythic; a set piece rolls above the best mythic
  const lc = Math.pow(il / 70, 1.6); // item level counts more than before: same strength at level 70, clearly weaker below it
  const sc = k => (k === 'str' || k === 'cdmg') ? 1 + 3.15 * lc : 1 + 0.84 * lc;
  const first = pickOf(SLOT_PRIMARY[slot]);
  const keys = [first, ...STAT_KEYS.filter(k => k !== first).sort(() => Math.random() - 0.5)];
  const n = R.n[0] + (R.n[1] > R.n[0] ? (Math.random() * (R.n[1] - R.n[0] + 1) | 0) : 0);
  const st = {};
  for (const k of keys.slice(0, n)) { const S = STATS[k]; st[k] = Math.max(1, Math.round(rnd(S.lo, S.hi) * R.mult * qm * sc(k))); }
  const WN = slot === 'weapon' && WNAMES[CLS];
  const base = WN ? WN.magic : MAGIC_BASE[slot];
  const name = setId ? SETS[setId].pre + ' ' + pickOf(base) : rar === 0 ? pickOf(WN ? WN.base : BASE_NAMES[slot]) : rar === 1 ? pickOf(MAGIC_PRE) + ' ' + pickOf(base) : rar === 2 ? pickOf(RARE_PRE) + ' ' + pickOf(base)
    : rar === 3 ? pickOf(WN ? WN.leg : LEG_NAMES[slot]) : pickOf(WN ? WN.myth : MYTH_NAMES[slot]);
  const it = { slot, rar, name, st, lvl: il, q: Math.round(Q * 100) };
  if (setId) it.set = setId;
  if (rar >= 1) { // elemental affixes: power for your own element, resistance against what the monsters throw
    const ch = [0, 0.14, 0.3, 0.55, 0.9][rar], roll = b => Math.round((b + il * 0.14) * (0.8 + 0.4 * Q));
    if (Math.random() < ch) it.ea = { k: pickOf(ELEMS), v: roll(6) };
    if (Math.random() < ch) it.er = { k: pickOf(ELEMS), v: roll(8) };
  }
  return it;
}
function dropGear(x, y, rar) {
  const R = RARITY[rar];
  items.push({ x, y, t: 0, kind: 'gear', it: genItem(rar), z: 14, vz: 3.4 });
  const gi = items[items.length - 1].it; if (gi.set) { rar = 4; }
  spawn(x, y, 14, 10 + rar * 8, { c: [gi.set ? SET_GREEN : R.col, '#ffffff'], l0: 12, l1: 26, add: true, up: 2.4, g: 0.05 });
  if (items[items.length - 1].it.q >= 90 && rar < 3) floatText(x, y - 58, 'PERFECT ROLL!', '#ffd24a', 8);
  const di = items[items.length - 1].it; if (di.set) floatText(x, y - 54, SETS[di.set].name + ' SET DROP!', SET_GREEN, 10);
  if (rar >= 3) { flashA = Math.max(flashA, 0.2); SFX.big(); if (!gi.set) floatText(x, y - 50, rar === 4 ? 'MYTHIC DROP!' : 'LEGENDARY DROP!', R.col, 10); }
  else if (rar === 2) { SFX.magic(); floatText(x, y - 46, 'RARE DROP', R.col, 8); }
}
function onKill(e) {
  if (e.kind === 'gob') { bonusKill(e); return; }
  const boss = isBoss(e); elemDeath(e);
  if (boss) for (const o of enemies) { // the boss falls and every foe around it dies with it (xp and gold still count, no gear drops)
    if (o === e || o.dead || o.kind === 'imp' || isBoss(o)) continue;
    o.hp = 0; o.dead = true; o.fade = 0; o.noLoot = true; o.st = 'down'; o.vx = 0; o.vz = 0; o.z = 0; sparks(o.x, o.y, o.h * 0.6, false); addDecal(o); onKill(o); score += 100;
  }
  killCombo = (tickN - killComboT <= KC_WINDOW ? killCombo : 0) + 1; killComboT = tickN;
  if (killCombo % 10 === 0) floatText(e.x, e.y - e.h - 16, 'COMBO x' + killCombo + '  XP +' + Math.round(kcBonus() * 100) + '%', '#8fc8ff', 8);
  gainXP(Math.round((boss ? 250 : e.kind === 'b' || e.k.ai ? 30 : 10) * (1 + areaLv() * 0.12) * 0.42 * (dailyIs('IRON FOES') ? 1.5 : 1) * (1 + kcBonus() + (buffIs('wisdom') ? 0.5 : 0)))); // paced so level 70 arrives near the end of act VII
  { const gd = Math.round((boss ? 45 : e.kind === 'b' || e.k.ai ? 7 : 2) * (1 + areaLv() * 0.1) * (1 + 0.25 * trialN()) * (dailyIs('GOLD RUSH') ? 2 : dailyIs('IRON FOES') ? 1.5 : 1) * (buffIs('fortune') ? 1.6 : 1));
    rpg.gold += gd; if (boss || e.kind === 'b' || e.k.ai) floatText(e.x, e.y - e.h - 8, '+' + gd + 'G', '#ffd24a', 8); }
  const n = e.noLoot ? 0 : boss ? (tierOf() >= 2 ? 3 : 2) : e.elite ? 1 + (Math.random() < 0.4 ? 1 : 0) : Math.random() < (e.kind === 'b' || e.k.ai ? 0.42 : 0.15) * (buffIs('fortune') ? 1.5 : 1) ? 1 : 0;
  const bigBoss = boss && rpg.lvl >= MAX_LV; // at max level a boss always drops at least a legendary first and raises the set chance of all its drops by half
  setBoost = bigBoss ? 1.5 : 1;
  for (let i = 0; i < n; i++) {
    let r = rollRarity();
    if (bigBoss && i === 0) r = Math.max(3, r);
    else if (boss && tierOf() === 1) r = 1;                  // stage 2 boss: two magic drops
    else if (boss && i === 0 && tierOf() >= 2) r = Math.max(1, r);
    dropGear(e.x + rnd(-16, 16), clamp(e.y + rnd(-6, 6), Y_MIN, Y_MAX), r);
  }
  setBoost = 1;
}
const GOLD_MULT = [1, 3, 5, 8, 20];
const itemValue = it => Math.round((8 + (it.lvl || 1) * 1.6) * GOLD_MULT[it.rar] * (1 + 0.25 * (it.up | 0)));
const itemPrice = it => Math.round(itemValue(it) * 2.5);
const sameItem = (a, b) => !!a && !!b && a.slot === b.slot && a.name === b.name && a.rar === b.rar && (a.q | 0) === (b.q | 0) && (a.lvl || 1) === (b.lvl || 1) && (a.up | 0) === (b.up | 0);
function isDuplicate(it) { return Object.values(rpg.eq).some(o => sameItem(o, it)) || rpg.bag.some(o => sameItem(o, it)); }
// the backpack is always sorted: plain items first, then by rarity; inside a rarity by slot, then the higher item level first
function sortBag(keep) {
  rpg.bag.sort((a, b) => a.rar - b.rar || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || (b.lvl || 1) - (a.lvl || 1) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (keep && typeof inv !== 'undefined') inv.i = Math.max(0, rpg.bag.indexOf(keep));
}
function pickupGear(it, bought) {
  const R = RARITY[it.rar];
  if (!bought && isDuplicate(it)) { // already owned: it turns into gold and score
    const gd = itemValue(it), pt = gd * 10; rpg.gold += gd; score += pt;
    floatText(hero.x, hero.y - 60, 'DUPLICATE  +' + gd + 'G  +' + pt + 'PTS', '#ffd24a', 8); SFX.pick(); return true;
  }
  if (!rpg.eq[it.slot] && canWear(it)) { rpg.eq[it.slot] = it; PS = null; heroStats(false); floatText(hero.x, hero.y - 60, 'EQUIPPED ' + it.name, itemCol(it), 8); }
  else if (rpg.bag.length < BAG_MAX) { rpg.bag.push(it); sortBag(); floatText(hero.x, hero.y - 60, it.name, itemCol(it), 8); }
  else return false;
  saveGame(); return true;
}
function floatText(x, y, s, col, size) { floats.push({ x, y, s, col, size: size || 8, t: 0 }); }
function updateFloats() { for (const f of floats) { f.t++; f.y -= 0.45; } floats = floats.filter(f => f.t < 56); }
function drawFloats() { for (const f of floats) { g.globalAlpha = Math.min(1, (56 - f.t) / 18); text(f.s, Math.round(f.x - cam), Math.round(f.y), f.size, f.col, 'center'); } g.globalAlpha = 1; }

/* ---- persistence: character + leaderboard live in localStorage ---- */
const validItem = it => { const ok = !!(it && SLOTS.includes(it.slot) && RARITY[it.rar] && it.st && typeof it.name === 'string');
  if (ok) { it.up = clamp(it.up | 0, 0, MAX_UP); if (it.set && !(SETS[it.set] && it.rar >= 3)) delete it.set;
  for (const k of ['ea', 'er']) if (it[k] && !(ELEMS.includes(it[k].k) && it[k].v > 0)) delete it[k]; else if (it[k]) it[k].v = Math.min(99, it[k].v | 0); } return ok; };
const saveKey = c => (c || CLS) === 'nolan' ? SAVE_KEY : SAVE_KEY + '_' + (c || CLS);
