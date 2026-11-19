/* ---------- season journey: nine goals every season, paid in gold and coins, and a few cosmetic trails to unlock ---------- */
const JR_KEY = 'emberfall_journey_v1';
const JR_POOL = [
  { id: 'kill', ev: 'kill', n: 300, t: 'DEFEAT 300 FOES' },
  { id: 'elite', ev: 'elite', n: 15, t: 'DEFEAT 15 ELITE FOES' },
  { id: 'boss', ev: 'boss', n: 6, t: 'FELL 6 BOSSES' },
  { id: 'stage', ev: 'stage', n: 10, t: 'CLEAR 10 STAGES' },
  { id: 'chest', ev: 'chest', n: 12, t: 'OPEN 12 TREASURE CHESTS' },
  { id: 'gold', ev: 'goldchest', n: 2, t: 'OPEN 2 GOLDEN CHESTS' },
  { id: 'shrine', ev: 'shrine', n: 8, t: 'STRIKE 8 SHRINES' },
  { id: 'buffs', ev: 'buffs', n: 3, max: 1, t: 'HAVE 3 BLESSINGS AT ONCE' },
  { id: 'combo', ev: 'combo', n: 25, max: 1, t: 'REACH A KILL COMBO OF 25' },
  { id: 'elem', ev: 'elemkill', n: 100, t: 'DEFEAT 100 FOES UNDER AN ELEMENT' },
  { id: 'legend', ev: 'legend', n: 3, t: 'FIND 3 LEGENDARY OR BETTER ITEMS' },
  { id: 'forge', ev: 'forge', n: 10, t: 'FORGE SUCCESSFULLY 10 TIMES' },
  { id: 'wrath', ev: 'wrath', n: 10, t: 'CAST DRAGON\'S WRATH 10 TIMES' },
  { id: 'ride', ev: 'ride', n: 5, t: 'MOUNT A WYRMLING 5 TIMES' },
  { id: 'race', ev: 'race', n: 1, t: 'FINISH A SEASON RACE' },
  { id: 'race50', ev: 'race50', n: 1, t: 'REACH LV 50 IN A SEASON RACE' }
];
const COSM = { // trails of motes around the heroes: only a look, no power
  ember: { name: 'EMBER MOTES', col: '#ff9a4a', c2: '#ffd070' }, frost: { name: 'FROST MOTES', col: '#9adcff', c2: '#e8faff' },
  volt: { name: 'VOLT SPARKS', col: '#fff6a0', c2: '#6ab8ff' }, gild: { name: 'GILDED TRAIL', col: '#ffd24a', c2: '#ffffff' }
};
const JR_XP = 0.2; // every goal also pays this share of the XP your hero needs for its next level (or paragon point)
const JR_TIERS = [{ at: 3, cos: 'ember', coins: 0 }, { at: 6, cos: 'frost', coins: 1 }, { at: 9, cos: 'volt', coins: 2 }]; // 3, 6 and 9 goals of the season
const jrGoals = () => { const s = seasonNo(seasonStr()); return JR_POOL.map((q, i) => [((i + 3) * 37 + s * 53) % 101, q]).sort((a, b) => a[0] - b[0]).slice(0, 9).map(a => a[1]); }; // nine goals, another mix every season
let jrS = null;
function jrLoad() {
  const now = seasonStr(); if (jrS && jrS.s === now) return jrS;
  let o = null; try { o = unseal(localStorage.getItem(JR_KEY), JR_KEY); } catch (e) { } if (!o || typeof o !== 'object') o = {};
  const same = o.s === now, ids = JR_POOL.map(q => q.id), cos = (Array.isArray(o.cos) ? o.cos : []).filter(k => COSM[k]), n = {};
  if (same && o.n && typeof o.n === 'object') for (const id of ids) n[id] = clamp(+o.n[id] | 0, 0, 1e6);
  jrS = { s: now, n, done: same && Array.isArray(o.done) ? o.done.filter(id => ids.includes(id)) : [], tier: same ? clamp(o.tier | 0, 0, 3) : 0, cos, pick: cos.includes(o.pick) ? o.pick : '', pg: clamp(o.pg | 0, 0, 999), pc: clamp(o.pc | 0, 0, 99) };
  return jrS;
}
function jrSave() { if (DEV || !jrS) return; try { localStorage.setItem(JR_KEY, seal({ s: jrS.s, n: jrS.n, done: jrS.done, tier: jrS.tier, cos: jrS.cos, pick: jrS.pick, pg: jrS.pg, pc: jrS.pc })); } catch (e) { } }
function jrUnlock(S, k) { if (S.cos.includes(k)) return false; S.cos.push(k); if (!S.pick) S.pick = k; return true; }
function jrDone(S, q) { // a goal is reached: its gold waits for the saved hero, and every third goal opens a tier
  S.done.push(q.id); S.pg = Math.min(999, S.pg + 1); let t = 'JOURNEY: ' + q.t;
  JR_TIERS.forEach((T, i) => { if (S.tier <= i && S.done.length >= T.at) { S.tier = i + 1; S.pc = Math.min(99, S.pc + T.coins);
    if (jrUnlock(S, T.cos)) t = 'NEW TRAIL: ' + COSM[T.cos].name; else S.pg = Math.min(999, S.pg + 4); } });
  if (mode === 'play') { msg = t; msgT = 200; SFX.pick(); }
}
function jr(ev, v) { // an event of play; the race goals count only in the race, all the others only outside it
  if (DEV) return; if ((ev.indexOf('race') === 0) !== !!daily) return;
  const S = jrLoad(); let ch = false;
  for (const q of jrGoals()) if (q.ev === ev) { const c = S.n[q.id] | 0, nv = Math.min(1e6, q.max ? Math.max(c, v | 0) : c + (v == null ? 1 : v));
    if (nv !== c) { S.n[q.id] = nv; ch = true; if (nv >= q.n && !S.done.includes(q.id)) jrDone(S, q); } }
  if (ch) jrSave();
}
function jrRaceWon() { jr('race'); const S = jrLoad(); if (jrUnlock(S, 'gild')) { jrSave(); if (daily) daily.newTrail = true; } } // the first finished race gives the gilded trail
function jrApply() { // the reward goes to the saved hero, never to the race hero
  if (daily || DEV || mode !== 'play') return; const S = jrLoad(); if (!S.pg && !S.pc) return;
  const gd = S.pg * (100 + 12 * rpg.lvl), cn = Math.min(S.pc, Math.max(0, 9 - rpg.coins)), need = rpg.lvl >= MAX_LV ? (rpg.pg >= PG_MAX ? 0 : pgNeed(rpg.pg)) : xpNeed(rpg.lvl), xp = Math.round(S.pg * need * JR_XP);
  rpg.gold += gd; rpg.coins += cn; S.pg = 0; S.pc = 0; jrSave(); if (xp > 0) gainXP(xp); saveGame();
  floatText(hero.x, hero.y - 80, 'JOURNEY +' + gd + 'G' + (xp ? ' +' + xp + ' XP' : '') + (cn ? ' +' + cn + ' COIN' : ''), '#ffd24a', 8);
}
function cosFx() {
  const S = jrS || jrLoad(), C = COSM[S.pick]; if (!C || tickN % 3) return;
  for (const p of players()) { if (p.dead) continue; for (let i = 0; i < 2; i++) spawn(p.x + rnd(-10, 10), p.y, rnd(2, 40), 1, { c: [C.col, C.c2], l0: 16, l1: 30, add: true, size: 2, up: 0.8, g: -0.01 }); }
}
function jrCycle(d) { const S = jrLoad(), a = [''].concat(S.cos); S.pick = a[(a.indexOf(S.pick) + d + a.length) % a.length]; jrSave(); SFX.pick(); }
let journeyBox = null;
function openJourney() { jrLoad(); mode = 'journey'; SFX.pick(); }
function updateJourney() {
  if (isHit('left') || isHit('right')) jrCycle(isHit('right') ? 1 : -1);
  if (isHit('start') || isHit('back') || pressed.KeyG || pressed.Digit4) { mode = 'title'; SFX.pick(); }
}
function drawJourney() {
  const S = jrLoad(), gs = jrGoals(); g.fillStyle = 'rgba(4,2,10,0.78)'; g.fillRect(0, 0, W, H);
  text('SEASON JOURNEY', W / 2, 26, 16, '#ffb43a', 'center');
  text('SEASON ' + seasonNo(seasonStr()) + '   ' + seasonStr() + '   ' + (seasonDaysLeft() ? seasonDaysLeft() + ' DAYS LEFT' : 'LAST DAY') + '   ' + S.done.length + '/9 DONE', W / 2, 42, 8, '#c9a86a', 'center');
  text('EACH GOAL PAYS GOLD AND XP TO YOUR SAVED HERO. RACE GOALS COUNT IN THE RACE ONLY.', W / 2, 54, 6, '#8a7a9a', 'center');
  gs.forEach((q, i) => { const y = 74 + i * 14, d = S.done.includes(q.id), c = Math.min(q.n, S.n[q.id] | 0);
    text(d ? 'X' : '-', 40, y, 8, d ? '#7aff9a' : '#6a5a80'); text(q.t, 54, y, 8, d ? '#9ad08a' : '#e8e0f0');
    text(c + '/' + q.n, 372, y, 8, d ? '#7aff9a' : '#c9a86a', 'right'); bar(380, y - 6, 60, 4, c, q.n, d ? '#7aff9a' : '#ffb43a', '#1c1426'); });
  JR_TIERS.forEach((T, i) => { const x = 40 + i * 140, got = S.done.length >= T.at, own = S.cos.includes(T.cos);
    g.fillStyle = 'rgba(40,24,60,0.85)'; g.fillRect(x, 206, 130, 26); g.strokeStyle = got ? COSM[T.cos].col : '#4a3a5a'; g.lineWidth = 1; g.strokeRect(x + 0.5, 206.5, 129, 25);
    text(T.at + ' GOALS' + (T.coins ? '  +' + T.coins + ' COIN' : ''), x + 65, 216, 7, got ? '#fff1d0' : '#8a7a9a', 'center'); text(COSM[T.cos].name, x + 65, 227, 7, got || own ? COSM[T.cos].col : '#6a5a80', 'center'); });
  const C = COSM[S.pick], opts = S.cos.length;
  journeyBox = { x: 90, y: 238, w: 300, h: 13 }; g.fillStyle = 'rgba(30,14,40,0.8)'; g.fillRect(journeyBox.x, journeyBox.y, journeyBox.w, 13); g.strokeStyle = C ? C.col : '#6a5a80'; g.strokeRect(journeyBox.x + 0.5, journeyBox.y + 0.5, journeyBox.w - 1, 12);
  text(opts ? 'TRAIL: ' + (C ? C.name : 'NONE') + '    A/D: CHANGE' : 'NO TRAIL YET  -  FINISH 3 GOALS OR A SEASON RACE', W / 2, 247, 8, C ? C.col : '#8a7a9a', 'center');
  text('ESC / ENTER: BACK', W / 2, 262, 7, '#8a7a9a', 'center');
  if (C && tickN % 3 === 0) spawn(W / 2 + 120 + cam, 150, rnd(0, 20), 1, { c: [C.col, C.c2], l0: 10, l1: 20, add: true, size: 1 });
}
