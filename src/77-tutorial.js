/* ---------- training: a short guided arena that teaches the buttons; nothing in it is saved, paid or counted ---------- */
const TUT_KEY = 'emberfall_tut_v1';
const tutDone = () => { try { return localStorage.getItem(TUT_KEY) === '1'; } catch (e) { return false; } };
const tutMark = () => { try { localStorage.setItem(TUT_KEY, '1'); } catch (e) { } };
const tutNeeded = () => !tutDone() && rpg.lvl <= 1; // a hero that already has progress knows the game: no training for it
const tutKeys = () => IS_TOUCH ? { move: 'THE STICK', atk: 'THE ATK BUTTON', jump: 'THE JUMP BUTTON', magic: 'THE MAGIC BUTTON', skill: 'THE SKILL BUTTON', gear: 'THE GEAR BUTTON', pause: 'THE II BUTTON' }
  : { move: 'WASD OR THE ARROWS', atk: 'J OR Z  (PAD: X)', jump: 'K, X OR SPACE  (PAD: A)', magic: 'SHIFT, L OR C  (PAD: B)', skill: 'U  (Q SWAPS)', gear: 'I OR TAB', pause: 'ESC OR P' };
const TUT_STEPS = [
  { id: 'move', name: 'MOVE', lines: k => ['WALK TO THE GLOWING MARKER.', 'USE ' + k.move + '.'] },
  { id: 'atk', name: 'ATTACK', lines: k => ['HIT THE DUMMY 3 TIMES WITH ' + k.atk + '.', 'THREE HITS IN A ROW ARE A COMBO: THE LAST ONE KNOCKS FOES BACK.'] },
  { id: 'jump', name: 'JUMP', lines: k => ['PRESS ' + k.jump + ' TO JUMP.', 'YOU CAN ATTACK IN THE AIR TOO. JUMP OVER CHASMS AND DANGER.'] },
  { id: 'fight', name: 'FIGHT', lines: () => ['DEFEAT THE 2 HUSKS.', 'WATCH THEIR WIND-UP, STEP AWAY, THEN HIT BACK.'] },
  { id: 'wrath', name: 'DRAGON WRATH', lines: k => ['PRESS ' + k.magic + ' TO CALL THE DRAGON.', 'IT NEEDS EMBER JARS (SMASH VASES). SAVE IT FOR BOSSES AND CROWDS.'] },
  { id: 'shrine', name: 'SHRINE', lines: k => ['HIT THE SHRINE WITH ' + k.atk + '.', 'EACH GIVES A TIMED BLESSING. UP TO 3 RUN AT THE SAME TIME.'] }
];
function tutFoes(n) { for (let i = 0; i < n; i++) { const f = makeFighter('h', cam + W + 16 + i * 34, 190 + (i % 3) * 20); f.noLoot = true; enemies.push(f); } }
function tutEnter() { // sets up the next step
  const T = tut, st = TUT_STEPS[T.i]; T.t = 0; T.done = 0; if (!st) return;
  if (st.id === 'atk') { const d = makeFighter('h', 300, 215); d.k = Object.assign({}, d.k, { name: 'TRAINING DUMMY', spd: 0, dmg: 0, windup: 99999, rng: 0 }); d.hp = d.maxhp = 99999; d.noLoot = true; enemies.push(d); T.dummy = d; T.hits = 0; }
  else if (st.id === 'fight') { if (T.dummy) T.dummy.gone = true; T.dummy = null; tutFoes(2); }
  else if (st.id === 'wrath') { for (const p of players()) { p.vases = 2; p.mana = 60; } tutFoes(4); }
  else if (st.id === 'shrine') { for (const e of enemies) if (!e.dead) e.gone = true; shrines.push({ x: 300, y: 215, used: 0, t: 0, shake: 0, sacred: false }); }
}
let trainBox = null;
function startTutorial(after, fromTitle) {
  const snap = { lvl: rpg.lvl, xp: rpg.xp, elem: rpg.elem, et: rpg.et, eg: rpg.eg, tr: rpg.tr, pg: rpg.pg, pxp: rpg.pxp, bag: rpg.bag, eq: rpg.eq, coins: rpg.coins, gold: rpg.gold, coop, cycle, stageIdx };
  coop = false; cycle = 0; rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; rpg.coins = 0; rpg.gold = 0; PS = null;
  tut = { i: 0, t: 0, done: 0, hits: 0, dummy: null, seen: false, after, snap, fromTitle: !!fromTitle }; // set first: from here on nothing is saved or counted
  resetGame(); stageIdx = 0; shop = null; const S = STAGES[0]; TH = themeFor(S.theme, actOf(0)); weather = null; WAVES = []; STAGE_END = W; heroStats(true);
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null; decals = []; impT = 1e9; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 0; flashA = 0; shake = 0; freeze = 0;
  intro = null; slashes = []; vents = []; chests = []; gaps = []; ambW = -1; shrines = []; buffs = []; killCombo = 0; bonus = null;
  hero.x = 80; hero.y = 205; hero.inv = 60; tutEnter(); mode = 'play'; SFX.big();
}
function tutFinish() { // the end or a skip: the hero comes back exactly as it was
  const T = tut, s = T.snap; tut = null; tutMark();
  Object.assign(rpg, { lvl: s.lvl, xp: s.xp, elem: s.elem, et: s.et, eg: s.eg, tr: s.tr, pg: s.pg, pxp: s.pxp, bag: s.bag, eq: s.eq, coins: s.coins, gold: s.gold });
  coop = s.coop; cycle = s.cycle; PS = null; shrines = []; buffs = []; dragon = null; bossRef = null; enemies = []; items = []; parts = []; floats = []; msg = ''; msgT = 0;
  TH = THEMES[0]; weather = 'ash'; mode = 'title'; resetGame(); stageIdx = s.stageIdx; heroStats(true); SFX.magic(); T.after();
}
function updateTutorial() {
  const T = tut; T.t++;
  for (const p of players()) { p.x = clamp(p.x, 12, W - 12); if (!p.dead && p.hp < 40) p.hp = Math.round(p.maxhp * 0.6); } // the training cannot be lost
  const st = TUT_STEPS[T.i];
  if (!st) { if (T.t > 30 && (isHit('start') || isHit('atk'))) tutFinish(); return; } // the summary page
  if (T.done) { if (++T.done > 60) { T.i++; tutEnter(); } return; }
  let ok = false;
  if (st.id === 'move') ok = Math.abs(hero.x - 380) < 24 && Math.abs(hero.y - 215) < 28;
  else if (st.id === 'atk') { const D = T.dummy; if (D) { if (D.hp < D.maxhp) { T.hits++; D.hp = D.maxhp; } D.x = clamp(D.x, 160, W - 50); } ok = T.hits >= 3; }
  else if (st.id === 'jump') ok = hero.z > 6;
  else if (st.id === 'fight') ok = T.t > 30 && !enemies.some(e => !e.dead && !e.gone);
  else if (st.id === 'wrath') { if (dragon) T.seen = true; ok = T.seen && !dragon; }
  else if (st.id === 'shrine') ok = buffs.length > 0;
  if (ok) { T.done = 1; floatText(hero.x, hero.y - 70, ['GOOD!', 'NICE!', 'GREAT!'][T.i % 3], '#7aff9a', 9); SFX.pick(); }
}
function drawTutHud() {
  const T = tut, st = TUT_STEPS[T.i], k = tutKeys(), P = (tickN >> 4) & 1;
  if (!st) { // the summary: every button on one page
    g.fillStyle = 'rgba(8,4,16,0.9)'; g.fillRect(40, 36, 400, 214); g.strokeStyle = '#c9a86a'; g.strokeRect(40.5, 36.5, 399, 213);
    text('TRAINING COMPLETE', W / 2, 58, 14, '#ffb43a', 'center');
    [['MOVE', k.move], ['ATTACK  (3-HIT COMBO)', k.atk], ['JUMP / RIDE A WYRMLING', k.jump], ['DRAGON WRATH  (EMBER JAR)', k.magic], ['SPECIAL SKILL  (FROM LV 10)', k.skill], ['GEAR AND BACKPACK', k.gear], ['PAUSE AND CONTROLS', k.pause]]
      .forEach(([a, b], i) => { text(a, 56, 82 + i * 14, 8, '#c9a86a'); text(b, 424, 82 + i * 14, 8, '#fff1d0', 'right'); });
    text('WYRMLINGS: JUMP ONTO ONE TO RIDE IT' + (IS_TOUCH ? '' : ', E TO DISMOUNT') + '.', W / 2, 192, 7, '#c9a8ff', 'center');
    text('AFTER EACH STAGE: SHOP, THEN BLACKSMITH. COINS CONTINUE A LOST RUN.', W / 2, 205, 7, '#c9a8ff', 'center');
    if (T.t > 30 && P) text((IS_TOUCH ? 'OK' : 'ENTER') + (T.fromTitle ? ': BACK TO THE TITLE' : ': START THE GAME'), W / 2, 232, 9, '#ffffff', 'center'); return;
  }
  const px = 144, py = 76; // up in the sky: the fighting happens below, on the ground
  g.fillStyle = 'rgba(8,4,16,0.84)'; g.fillRect(px, py, 322, 58); g.strokeStyle = T.done ? '#7aff9a' : '#c9a86a'; g.strokeRect(px + 0.5, py + 0.5, 321, 57);
  TUT_STEPS.forEach((s, i) => { g.fillStyle = i < T.i || (i === T.i && T.done) ? '#7aff9a' : i === T.i ? '#ffd24a' : '#4a3a5a'; g.fillRect(px + 8 + i * 12, py + 7, 8, 4); });
  text((T.i + 1) + '/' + TUT_STEPS.length, px + 82, py + 12, 7, '#8cc4ff');
  text(IS_TOUCH ? 'II: SKIP' : 'ESC: SKIP', px + 314, py + 12, 7, '#8a7a9a', 'right');
  text(st.name, px + 8, py + 28, 11, T.done ? '#7aff9a' : '#ffb43a');
  st.lines(k).forEach((l, i) => text(l, px + 8, py + 41 + i * 11, 7, '#fff1d0'));
  if (st.id === 'move' && !T.done) { const r = 14 + (P ? 3 : 0); g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.beginPath(); g.ellipse(380 - cam, 215, r, r * 0.4, 0, 0, 7); g.stroke(); g.lineWidth = 1; text('v', 380 - cam, 184 + P * 3, 12, '#ffd24a', 'center'); }
  if (st.id === 'atk' && T.dummy) text('HITS ' + Math.min(3, T.hits) + '/3', T.dummy.x - cam, T.dummy.y - T.dummy.h - 12, 8, '#ffd24a', 'center');
}
