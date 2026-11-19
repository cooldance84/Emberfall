/* ---------- bonus stage: after every act boss, ten seconds of loot goblins ---------- */
let bonus = null;
const BONUS_AFTER = i => i % 5 === 4 && i < STAGES.length - 1;
const BONUS_T = 600;
function beginBonus(next) {
  const S = STAGES[stageIdx]; TH = themeFor(S.theme, actOf(stageIdx)); weather = null; WAVES = []; STAGE_END = W;
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null;
  decals = []; impT = 1e9; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 0; flashA = 0; shake = 0; freeze = 0;
  intro = null; slashes = []; vents = []; chests = []; gaps = []; ambW = -1; shrines = []; buffs = [];
  for (const p of players()) {
    if (p.dead && coop) { p.dead = false; p.fade = 0; p.hp = Math.max(1, p.maxhp >> 1); }
    p.pitT = 0; p.x = p.pn === 2 ? 150 : 120; p.y = p.pn === 2 ? 232 : 205; p.z = 0; p.vx = 0; p.vz = 0; p.st = 'idle'; p.t = 0; p.mount = null; p.inv = 60; p.hits.clear();
  }
  killCombo = 0; bonus = { next, phase: 'ready', t: 0, left: BONUS_T, gold: 0, xp: 0, kills: 0, opened: 0, esc: 0, combo: 0, best: 0, last: -999, spawnT: 0 };
  mode = 'play'; SFX.big();
}
function spawnGob(golden) {
  const dir = Math.random() < 0.5 ? 1 : -1, f = makeFighter('gob', dir > 0 ? cam - 24 : cam + W + 24, rnd(Y_MIN + 4, Y_MAX - 4));
  f.hp = f.maxhp = golden ? 3 : 1; f.gdir = dir; f.face = dir; f.gv = rnd(2.0, 3.0) * (golden ? 1.25 : 1); f.gph = rnd(0, 6); f.golden = golden; f.armor = 0;
  if (golden) { f.k = Object.assign({}, f.k, { name: 'GOLDEN GOBLIN', skin: '#d8c24a', armor: '#c8921a', armor2: '#fff1b0', scale: 0.86 }); f.glow = '255,210,80'; }
  enemies.push(f); return f;
}
function bonusKill(e) {
  elemDeath(e); const B = bonus; if (!B) return;
  B.combo = tickN - B.last < 75 ? B.combo + 1 : 1; B.last = tickN; B.best = Math.max(B.best, B.combo); B.kills++;
  const mult = 1 + Math.min(10, B.combo - 1) * 0.2;
  killCombo = (tickN - killComboT <= KC_WINDOW ? killCombo : 0) + 1; killComboT = tickN; // goblins feed the experience combo too, and pay a normal foe's experience with no extra multiplier
  const xg = Math.round(10 * (1 + areaLv() * 0.12) * 0.42 * (dailyIs('IRON FOES') ? 1.5 : 1) * (1 + kcBonus())); B.xp += xg; gainXP(xg);
  const gd = Math.round(5 * (1 + areaLv() * 0.1) * (1 + 0.25 * trialN()) * (e.golden ? 4 : 1) * mult * (dailyIs('GOLD RUSH') ? 2 : 1));
  rpg.gold += gd; B.gold += gd; score += gd * 3;
  floatText(e.x, e.y - e.h - 8, '+' + gd + 'G', e.golden ? '#fff1b0' : '#ffd24a', e.golden ? 10 : 8);
  spawn(e.x, e.y, 14, 10, { c: ['#ffd24a', '#fff1b0'], s0: 1, s1: 2.6, l0: 14, l1: 26, add: true, size: 2, up: 2.4, g: 0.12 }); SFX.pick();
  if (e.golden || Math.random() < 0.2) { // some goblins drop their loot chest
    const type = e.golden || Math.random() < 0.08 ? 'gold' : 'wood';
    chests.push({ x: Math.round(clamp(e.x, cam + 24, cam + W - 24)), y: clamp(e.y, Y_MIN + 4, Y_MAX - 4), open: 0, hp: type === 'gold' ? 3 : 2, type });
    floatText(e.x, e.y - e.h - 20, type === 'gold' ? 'GOLDEN CHEST!' : 'CHEST!', '#fff1b0', 8);
  }
}
function updateBonus() {
  const B = bonus; B.t++;
  for (const p of players()) p.x = clamp(p.x, cam + 12, cam + W - 12);
  if (B.phase === 'ready') { if (B.t >= 100) { B.phase = 'run'; B.t = 0; msg = 'CATCH THEM ALL!'; msgT = 70; SFX.big(); } return; }
  if (B.phase === 'run') {
    B.left--; const prog = 1 - B.left / BONUS_T;
    if (--B.spawnT <= 0 && B.left > 30) { B.spawnT = Math.round(lerp(20, 10, prog)); const n = Math.random() < 0.25 ? 2 : 1; for (let i = 0; i < n; i++) spawnGob(Math.random() < 0.07); }
    if (B.left <= 0) { B.phase = 'grace'; B.t = 0; msg = 'TIME UP'; msgT = 80; SFX.land(); }
  } else if (B.phase === 'grace') {
    const open = chests.some(c => !c.open), loot = items.some(i => i.kind === 'gear'); // the clock stops mattering: stay until the chests are smashed and the gear picked up (at most 12 seconds)
    if (B.t >= 720 || (B.t >= 90 && !open && !loot)) { B.phase = 'done'; B.t = 0; for (const e of enemies) if (!e.dead) e.gone = true; SFX.magic(); saveGame(); }
  } else if (B.t > 40 && (isHit('start') || isHit('atk') || B.t > 500)) { const n = B.next; bonus = null; chests = []; n(); }
}
function drawBonusHud() {
  const B = bonus, secs = Math.max(0, B.left) / 60;
  text('BONUS STAGE   GOBLIN TREASURY', W / 2, 31, 8, '#ffd24a', 'center');
  if (B.phase === 'run' || B.phase === 'ready') { bar(W / 2 - 70, 36, 140, 6, B.left, BONUS_T, B.left < 180 ? '#ff5a3a' : '#ffd24a', '#3a2a10'); text(secs.toFixed(1) + 'S', W / 2, 55, 10, '#fff1b0', 'center'); }
  text('GOLD +' + B.gold, W / 2, 68, 9, '#ffd24a', 'center');
  if (killCombo >= 2 && tickN - killComboT <= KC_WINDOW) text('XP +' + Math.round(kcBonus() * 100) + '%', W / 2, 90, 8, '#8fc8ff', 'center');
  if (B.combo >= 2 && tickN - B.last < 75) text('COMBO x' + B.combo + '   GOLD x' + (1 + Math.min(10, B.combo - 1) * 0.2).toFixed(1), W / 2, 80, 8, '#ff9a4a', 'center');
  if (B.phase === 'ready') { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 100, W, 70); text('BONUS STAGE', W / 2, 122, 12, '#ffb43a', 'center');
    text('GOBLIN TREASURY', W / 2, 146, 18, '#fff1d0', 'center'); text('10 SECONDS. CATCH THE GOBLINS, SMASH THEIR CHESTS', W / 2, 162, 7, '#c9a8ff', 'center'); }
  if (B.phase === 'grace') { const open = chests.some(c => !c.open), loot = items.some(i => i.kind === 'gear'); if (open || loot) { text(open ? 'SMASH THE CHESTS!' : 'GRAB THE LOOT!', W / 2, 110, 12, '#fff1b0', 'center'); bar(W / 2 - 50, 116, 100, 4, 720 - B.t, 720, '#ffd24a', '#3a2a10'); } }
  if (B.phase === 'done') {
    g.fillStyle = 'rgba(14,8,4,0.9)'; g.fillRect(130, 70, 220, 148); g.strokeStyle = '#ffd24a'; g.strokeRect(130.5, 70.5, 219, 147);
    text('BONUS CLEAR', W / 2, 92, 13, '#ffd24a', 'center');
    text('GOBLINS CAUGHT  ' + B.kills, 150, 114, 9, '#e8e0f0'); text('GOBLINS LOST  ' + B.esc, 150, 128, 9, '#9a90a8');
    text('CHESTS OPENED  ' + B.opened, 150, 142, 9, '#e8e0f0'); text('BEST COMBO  x' + B.best, 150, 156, 9, '#ff9a4a');
    text('GOLD EARNED  +' + B.gold, W / 2, 176, 11, '#ffd24a', 'center');
    text('XP EARNED  +' + B.xp, W / 2, 191, 10, '#8fc8ff', 'center');
    if (B.t > 40 && (tickN >> 5) & 1) text('PRESS ENTER', W / 2, 208, 8, '#ffffff', 'center');
  }
}
function stageCleared() {
  score += 3000; saveGame(); openShop(() => openForge(afterClear));
}
function afterClear(skipBonus) {
  const S = STAGES[stageIdx];
  if (daily && stageIdx >= STAGES.length - 1) { nextCycle(); return; } // the race goes on: the next, tougher round
  if (skipBonus !== true && !daily && BONUS_AFTER(stageIdx)) { beginBonus(() => afterClear(true)); return; } // a short gold run after every act boss
  if (stageIdx < STAGES.length - 1) saveRun(stageIdx + 1);
  if (stageIdx < STAGES.length - 1) openStory(`STAGE ${stageIdx + 1} CLEARED`, S.name, S.clear, () => beginStage(stageIdx + 1), STAGES[stageIdx + 1].theme, actOf(stageIdx + 1));
  else openStory(cycle === 0 ? 'THE END' : trialName(cycle) + ' COMPLETE', 'EMBERFALL', cycle === 0 ? STORY.ending : STORY.cycleEnd,
    () => { score += 5000 * (cycle + 1); if (cycle >= 1 && cycle > (rpg.tr | 0)) rpg.tr = Math.min(TRIAL_MAX,
    cycle); mode = 'victory'; endTimer = 0; TH = THEMES[4]; saveGame(); }, 4);
}

