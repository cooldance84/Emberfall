/* ---------- elemental specialisation: fire, frost or lightning, unlocked at level 10, a new tier every 10 levels ---------- */
const ELEM = {
  fire: { name: 'FIRE', col: '#ff7a2a', col2: '#ffd070', rgb: '255,130,40', info: 'BURNING: DAMAGE OVER TIME' },
  frost: { name: 'FROST', col: '#7ad8ff', col2: '#e8faff', rgb: '120,210,255', info: 'CHILL, THEN DEEP FREEZE' },
  bolt: { name: 'LIGHTNING', col: '#c8a8ff', col2: '#fff6a0', rgb: '110,180,255', info: 'ARCS THAT SHOCK AND STUN' }
};
const ELEM_TIERS = {
  fire: ['BURNING: DAMAGE OVER TIME', 'STRONGER, LONGER BURN', 'BURN SPREADS TO NEIGHBOURS', 'BURNING FOES ERUPT ON DEATH', 'BURNS STACK UP TO 3 TIMES', 'RING OF FIRE AROUND YOU', 'IGNITING BLASTS NEARBY FOES', 'FIRE MODIFIERS +1', 'FIRE MODIFIERS +2', 'FIRE MODIFIERS +3'],
  frost: ['CHILL: SLOWS ENEMIES', 'FASTER FROST BUILDUP', 'DEEP FREEZE: SHORT STASIS', 'FROZEN FOES TAKE +20% DAMAGE', 'LONGER FREEZE, DEEPER CHILL', 'FREEZING SPREADS A FROST BURST', 'FROZEN FOES SHATTER ON DEATH', 'FROST MODIFIERS +1', 'FROST MODIFIERS +2', 'FROST MODIFIERS +3'],
  bolt: ['ARCS LEAP TO A NEARBY FOE', 'LONGER, STRONGER ARCS', 'SHOCK: BRIEF STUN', 'ARCS HIT 2 FOES', 'LONGER STUN', 'LIGHTNING STRIKES THE TARGET', 'ARCS HIT 3 FOES', 'LIGHTNING MODIFIERS +1', 'LIGHTNING MODIFIERS +2', 'LIGHTNING MODIFIERS +3']
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ELEM_PT = [0, 0.045, 0.05, 0.055, 0.06, 0.065, 0.075, 0.09, 0.095, 0.10, 0.105]; // status damage as a share of one normal hit
// weakness (>1) and resistance (<1) by monster: never below 0.4 or above 1.4, so nothing is immune and nothing is helpless
// Rock-paper-scissors: every elemental monster resists its own element and is weak to the one that beats it. Fire loses to frost, frost to lightning, lightning to fire. The third element is neutral.
// Never immune: buildup is floored at 40%, resistance only slows it.
const MON_EL = { boss: 'fire', smith: 'fire', king: 'fire', wyrm: 'frost', witch: 'bolt', bomber: 'fire', caller: 'fire', runner: 'fire', archer: 'frost', wraith: 'frost', knight: 'frost', wisp: 'bolt', warder: 'bolt', guard: 'bolt' };
const EL_WEAK = { fire: 'frost', frost: 'bolt', bolt: 'fire' };
const ELEM_RES = {}; for (const k in MON_EL) ELEM_RES[k] = { [MON_EL[k]]: 0.6, [EL_WEAK[MON_EL[k]]]: 1.25 };
const elemAvail = () => clamp(Math.floor(rpg.lvl / 10), 0, 7) + (rpg.lvl >= 70 ? Math.min(3, Math.floor((rpg.pg | 0) / 10)) : 0); // highest tier you may buy: level gives I to VII, every 10 paragon points open VIII, IX and X
const elemTier = () => rpg.elem ? clamp(Math.min(rpg.et | 0, elemAvail()), 0, 10) : 0;
const ePar = () => Math.max(0, elemTier() - 7); // tiers VIII to X add +1, +2, +3 to every numbered modifier of the element (layers, reach, arcs, duration)
const layerCap = () => 3 + ePar();      // tiers are bought at the Blacksmith with gold
const ENEMY_EL = MON_EL; // the element a monster's own attacks carry (for your resist gear)
const SHOT_EL = { wave: 'fire', meteor: 'fire', rune: 'fire', ring: 'fire', arrow: 'frost', orb: 'bolt', bolt: 'bolt' };
let hitEl = null; // the element of the hit being resolved right now (set around projectile and vent damage)
const gearSum = (key, el) => { let n = 0; for (const sl of SLOTS) { const it = rpg.eq[sl]; if (it && it[key] && it[key].k === el) n += it[key].v; } return n; };
const elemPower = () => rpg.elem ? Math.min(60, gearSum('ea', rpg.elem) + setBonus('ep')) + (buffIs('surge') ? 40 : 0) : 0;   // % bonus to your element's buildup and damage
const elemResist = el => el ? Math.min(60, gearSum('er', el) + setBonus('res')) / 100 : 0;        // share of that element's damage you ignore
const elemTierCost = t => t <= 1 ? 0 : Math.round(120 * Math.pow(t, 1.6)); // tier I is free, the rest cost gold
const elemRefund = () => Math.floor((rpg.eg | 0) * 0.75);                  // dismissing your element returns 75% of the gold you put into it
let rpg = { lvl: 1, xp: 0, bag: [], eq: {}, coins: 3, gold: 0, ini: 'AAA', elem: null, et: 0, eg: 0, tr: 0, pg: 0, pxp: 0 };
let PS = null, floats = [];

const XPN = [62, 31];
const xpNeed = l => Math.round(XPN[0] + XPN[1] * l);
function pstats() {
  if (PS) return PS;
  const C = cls(), s = { str: 4 + rpg.lvl, crit: C.crit, cdmg: C.cdmg, hit: 90 };
  for (const sl of SLOTS) { const it = rpg.eq[sl]; if (it) { const st = itemSt(it); for (const q in st) s[q] += st[q]; } }
  s.str += setBonus('str'); s.crit += setBonus('crit'); s.cdmg += setBonus('cdmg'); // set bonuses
  if (CLS === 'luca') { s.crit += Math.floor(s.str * 0.08); s.hit += Math.floor(s.str * 0.05); }
  // soft caps: stacked mythic gear makes you strong, not untouchable
  s.crit = Math.min(CLS === 'luca' ? 70 : 60, s.crit); s.hit = Math.min(100, s.hit);
  if (s.cdmg > 250) s.cdmg = Math.min(500, Math.round(250 + (s.cdmg - 250) * 0.35));
  s.mult = (1 + Math.min(s.str, 120) * C.mul + Math.max(0, s.str - 120) * C.mul * 0.45) * (dailyIs('GLASS CANNON') ? 1.5 : 1);
  s.mult *= pgDmg();
  s.maxhp = Math.round((C.hp0 + rpg.lvl * C.hpl + (CLS === 'nolan' ? s.str >> 1 : s.str >> 2)) * (1 + setBonus('hp') / 100) * pgHp());
  return (PS = s);
}
const GEAR_COL = [null, { armor: '#2a4a7a', armor2: '#5a9cff', cloth: '#26366e', blade: '#a8d0ff' }, { armor: '#7a6a24', armor2: '#ffe84a', cloth: '#6a5a14',
  blade: '#fff6b0' }, { armor: '#7a4a1a', armor2: '#ffb43a', cloth: '#7a4a10', blade: '#ffe0a0' }, { armor: '#6a1a3a', armor2: '#ff4a88', cloth: '#6a1040',
  blade: '#ffa8c8' }, { armor: '#1a5a2e', armor2: '#46e06a', cloth: '#14482a', blade: '#b8ffc8' }]; // the last entry is the set green
const flm = (t, g) => t >= 5 ? `rgb(70,${g},110)` : `rgb(255,${g},40)`; // flame trim: orange, or green on set gear
function lookFor(c, eq) { // equipped rarity tints the hero's armor, trim, cape and weapon
  const r = sl => eq[sl] ? (eq[sl].set ? 5 : eq[sl].rar) : 0, top = Math.max(r('helm'), r('armor'), r('boots')), base = KINDS[CLASSES[c].kind];
  const o = Object.assign({}, base);
  const A = GEAR_COL[r('armor')], T = GEAR_COL[top], C = GEAR_COL[Math.max(r('ring'), r('amulet'))], B = GEAR_COL[r('weapon')];
  if (A) o.armor = A.armor; if (T) o.armor2 = T.armor2; if (C) o.cloth = C.cloth; if (B) o.wcol = B.blade;
  const tier = sl => eq[sl] ? (eq[sl].set ? 5 : [1, 2, 3, 3, 4][eq[sl].rar]) : 0; // look tier: 0 nothing, 1 common, 2 magic, 3 rare/legendary (tinted apart), 4 mythic, 5 set piece (the mythic look in set green)
  o.gt = { helm: tier('helm'), armor: tier('armor'), boots: tier('boots'), weapon: tier('weapon'), ring: tier('ring'), amulet: tier('amulet') };
  if (!o.gt.armor) { // no armour: a plain tunic, robe or leathers
    if (c === 'panni') { o.armor = '#4b2a7a'; o.armor2 = '#c99bff'; o.cloth = '#3a1f60'; }
    else if (c === 'luca') { o.armor = '#5a4030'; o.armor2 = '#2f8f5a'; o.cloth = '#1a2a20'; }
    else { o.armor = '#53698f'; o.armor2 = '#7189b0'; o.cloth = '#7a1622'; }
  }
  if (o.gt.weapon >= 3) o.wlen = base.wlen + 3;
  o.wup = eq.weapon ? eq.weapon.up | 0 : 0;
  o.gup = Math.max(0, ...SLOTS.filter(sl => sl !== 'weapon').map(sl => eq[sl] ? eq[sl].up | 0 : 0)); // best forge level on the other gear
  const top5 = Math.max(0, ...SLOTS.map(r)); o.glowRgb = top5 >= 5 ? SET_GREEN_RGB : top5 >= 2 ? RARITY[top5].rgb : null;
  return o;
}
function gearLook() {
  for (const p of players()) {
    const c = p.pn === 2 ? CLS2 : CLS; p.k = lookFor(c, rpg.eq); p.glow = p.k.glowRgb;
    if (p.pn === 2 && c === CLS) p.k.hair = '#4a3ab0';
    if (rpg.elem && elemTier()) { if (!(rpg.eq.weapon && rpg.eq.weapon.set)) p.k.wcol = ELEM[rpg.elem].col2; p.glow = ELEM[rpg.elem].rgb; }
    else if (p.k.gup >= 5 && !p.glow) p.glow = '255,200,90';
    if (SLOTS.some(sl => rpg.eq[sl] && rpg.eq[sl].set)) p.glow = SET_GREEN_RGB; // a faint green glow shows that set gear is worn
  }
}
function heroStats(full) {
  PS = null; gearLook(); const s = pstats();
  for (const p of players()) { const d = s.maxhp - p.maxhp; p.maxhp = s.maxhp; p.hp = full ? s.maxhp : clamp(p.hp + Math.max(0, d), 1, s.maxhp); }
}
function rollHit(dmg) { // hit chance, crit chance, crit damage, STR
  const s = pstats();
  if (Math.random() * 100 >= s.hit) return { miss: true };
  const crit = Math.random() * 100 < s.crit;
  return { crit, d: Math.max(1, Math.round(dmg * s.mult * (buffIs('fury') ? 1.3 : 1) * (crit ? s.cdmg / 100 : 1) * rnd(0.93, 1.07))) };
}
