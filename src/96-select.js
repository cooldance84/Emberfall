/* ---------- hero select ---------- */
let selBoxes = [];
function openDailyInfo() { mode = 'dailyinfo'; SFX.pick(); }
function updateDailyInfo() {
  if (isHit('back')) { mode = 'title'; return; }
  if (pressed.KeyB || pressed.KeyN) { openBoard(1); return; }
  if (isHit('start') || isHit('atk')) openSelect(false, true);
}
function drawDailyInfo() {
  g.fillStyle = 'rgba(4,2,10,0.7)'; g.fillRect(0, 0, W, H);
  const M = DAILY_MODS[dayMod()];
  text('SEASON RACE', W / 2, 30, 16, '#ffb43a', 'center');
  text(seasonStr() + '   ' + M.name, W / 2, 48, 9, '#c9a86a', 'center'); text(M.info, W / 2, 60, 8, '#e8e0f0', 'center');
  const L = [['THE RACE', '#ffd24a'], ['START WITH A FRESH LV 1 HERO AND RACE TO LV ' + MAX_LV + ' + ' + PG_MAX + ' PARAGON.', '#e8e0f0'], ['THE SHORTEST PLAY TIME WINS. PAUSES AND SHOPS DO NOT COUNT.', '#e8e0f0'], ['XP IS DOUBLED. TRY AS OFTEN AS YOU LIKE: YOUR BEST TIME COUNTS.', '#e8e0f0'],
    ['ONE CONTINUE COIN. AN UNFINISHED RUN WAITS ON THIS DEVICE.', '#e8e0f0'], ['EVERY RACER MEETS THE SAME STAGES AND DROPS (THE SEASON SEED).', '#e8e0f0'], ['THE SEASON ENDS IN ' + seasonDaysLeft() + ' DAYS. THE ETERNAL BOARD KEEPS YOUR BEST.', '#e8e0f0'],
    ['THE REWARD', '#ffd24a'], ['A CROWN FOR YOUR SAVED HERO FOR A FINISHED RACE, ONE EACH DAY.', '#e8e0f0'], ['YOUR REAL HERO, ITS LEVEL AND ITS GEAR ARE NEVER TOUCHED.', '#e8e0f0']];
  L.forEach(([t, c], i) => text(t, i === 0 || i === 7 ? 40 : 46, 78 + i * 14 + (i >= 7 ? 5 : 0), i === 0 || i === 7 ? 9 : 8, c));
  drawCrown(104, 169 + 8);
  dailyBtns = [{ x: 56, y: 230, w: 170, h: 16, t: 'CHOOSE HERO (ENTER)', go: 0 }, { x: 254, y: 230, w: 170, h: 16, t: 'SEASON BOARD (N)', go: 1 }];
  for (const b of dailyBtns) { g.fillStyle = 'rgba(40,24,60,0.85)'; g.fillRect(b.x, b.y, b.w, b.h); g.strokeStyle = b.go ? '#c9a86a' : '#ffd24a'; g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); text(b.t, b.x + b.w / 2, b.y + 11, 8, '#fff', 'center'); }
  text('ESC: BACK', W / 2, 262, 7, '#8a7a9a', 'center');
}
let dailyBtns = [];
function openSelect(two, dly) { sel.daily = !!dly; coop = !!two; sel.coop = coop; sel.a = Math.max(0, CLS_ORDER.indexOf(CLS)); sel.b = Math.max(0, CLS_ORDER.indexOf(CLS2)); if (coop && sel.b === sel.a) sel.b = (sel.a + 1) % 3; mode = 'select'; SFX.pick(); }
function confirmSelect() {
  setClass(CLS_ORDER[sel.a]); CLS2 = CLS_ORDER[sel.b]; saveSettings();
  if (sel.daily) { sel.daily = false; startDaily(); return; }
  runInfo = loadRun(); if (runInfo) { resumeSel = runInfo.coins > 0 ? 0 : 1; mode = 'resume'; SFX.pick(); return; }
  if (tutNeeded()) { const two = sel.coop; startTutorial(() => startCampaign(two)); return; } // a new hero starts with the short training, once
  startCampaign(sel.coop);
}
function updateSelect() {
  const mv = (pn) => (inH({ pn }, 'right') ? 1 : 0) - (inH({ pn }, 'left') ? 1 : 0);
  const d1 = mv(1); if (d1) { sel.a = (sel.a + d1 + 3) % 3; SFX.pick(); }
  if (sel.coop) { const d2 = mv(2); if (d2) { sel.b = (sel.b + d2 + 3) % 3; SFX.pick(); } }
  if (isHit('back')) { coop = false; mode = 'title'; return; }
  if (isHit('start') || isHit('atk') || (sel.coop && inH({ pn: 2 }, 'atk'))) confirmSelect();
}
function selClick(x, y) {
  for (const b of selBoxes) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { if (sel.a === b.i) confirmSelect(); else { sel.a = b.i; SFX.pick(); } return true; }
  return false;
}
function drawSelect() {
  g.fillStyle = 'rgba(4,2,10,0.62)'; g.fillRect(0, 0, W, H);
  text('CHOOSE YOUR HERO', W / 2, 26, 16, '#ffb43a', 'center');
  selBoxes = [];
  CLS_ORDER.forEach((c, i) => {
    const C = CLASSES[c], cx = W / 2 + (i - 1) * 154, x0 = cx - 70, y0 = 38, on1 = sel.a === i, on2 = sel.coop && sel.b === i, sv = peekSave(c);
    selBoxes.push({ x: x0, y: y0, w: 140, h: 196, i });
    g.fillStyle = on1 || on2 ? 'rgba(40,24,60,0.85)' : 'rgba(16,10,26,0.75)'; g.fillRect(x0, y0, 140, 196);
    g.strokeStyle = on1 ? C.col : on2 ? '#8affb0' : '#3a2a4a'; g.lineWidth = on1 || on2 ? 2 : 1; g.strokeRect(x0 + 0.5, y0 + 0.5, 139, 195);
    if (on1 || on2) { g.globalCompositeOperation = 'lighter'; glowDot(g, cx, y0 + 96, 46, '180,140,255', 0.25); g.globalCompositeOperation = 'source-over'; }
    const f = makeFighter('hero', 0, 0); f.k = lookFor(c, sv.eq); f.face = 1; f.st = on1 || on2 ? 'walk' : 'idle'; f.anim = tickN * 0.12; f.pn = 1; f.glow = null;
    g.save(); g.translate(0, 0); drawHuman(f, cx, y0 + 112); g.restore();
    text(C.name, cx, y0 + 132, 14, C.col, 'center');
    text(C.role + '  -  ' + C.stat, cx, y0 + 144, 8, '#e8e0f0', 'center');
    text('LV ' + sv.lvl, cx, y0 + 156, 8, '#ffd24a', 'center'); if (crownsOf(c)) { drawCrown(cx + 26, y0 + 150); text('x' + crownsOf(c), cx + 38, y0 + 156, 8, '#ffd24a'); }
    text(C.desc[0], cx, y0 + 172, 6, '#b8a8c8', 'center'); text(C.desc[1], cx, y0 + 182, 6, '#b8a8c8', 'center');
    if (on1) text(sel.coop ? 'P1' : '>', x0 + 10, y0 + 14, 9, C.col, 'center');
    if (on2) text('P2', x0 + 130, y0 + 14, 9, '#8affb0', 'center');
  });
  text(sel.coop ? 'P1: A/D    P2: ARROWS    ENTER: START    ESC: BACK' : 'A/D OR ARROWS: CHOOSE    ENTER: START    ESC: BACK', W / 2, 252, 8, '#c9a8ff', 'center');
  text('EACH HERO KEEPS HIS OR HER OWN LEVEL AND GEAR', W / 2, 264, 7, '#8a7a9a', 'center');
}
function drawTitleOverlay() {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
  if (tamperT > 0) { tamperT--; text('SAVE DATA WAS MODIFIED - STARTING FRESH', W / 2, 20, 8, '#ff6a6a', 'center'); }
  if (DEV) text('TEST MODE - NOTHING IS SAVED', W / 2, 262, 8, '#7aff9a', 'center');
  const y = 96 + Math.sin(tickN * 0.04) * 3;
  g.font = 'bold 54px "Courier New",monospace'; g.textAlign = 'center';
  g.fillStyle = '#2a0e08'; g.fillText('EMBERFALL', W / 2 + 3, y + 3);
  const gr = g.createLinearGradient(0, y - 40, 0, y); gr.addColorStop(0, '#fff1b0'); gr.addColorStop(0.5, '#ffb43a'); gr.addColorStop(1, '#e0431f');
  g.fillStyle = gr; g.fillText('EMBERFALL', W / 2, y);
  text('THE ASHEN VOW', W / 2, y + 22, 12, '#c9a8ff', 'center');
  if ((tickN >> 5) & 1) text('ENTER: 1 PLAYER     2: CO-OP', W / 2, 190, 12, '#ffffff', 'center');
  { const dt = tr('3: SEASON RACE  -  ' + DAILY_MODS[dayMod()].name); g.font = '8px "Courier New",monospace'; const dw = g.measureText(dt).width + 12;
    dailyBox = { x: W / 2 - dw / 2, y: 196, w: dw, h: 13 }; g.fillStyle = 'rgba(40,24,4,0.6)'; g.fillRect(dailyBox.x, dailyBox.y, dw, 13); g.strokeStyle = '#8a6a1a';
    g.strokeRect(dailyBox.x + 0.5, dailyBox.y + 0.5, dw - 1, 12); text('3: SEASON RACE  -  ' + DAILY_MODS[dayMod()].name, W / 2, 205, 8, '#ffd24a', 'center'); }
  if (!window.touchActive) { // the keyboard hints would sit under the touch buttons, so touch players do not see them
    text('WASD MOVE   J ATTACK (x3)   K JUMP   SHIFT DRAGON WRATH      P2: ARROWS  , . /', W / 2, 222, 8, '#b8a8c8', 'center');
    text('K NEAR A WYRMLING = RIDE (J FIRE, E DISMOUNT)   F: CRT   M: MUTE', W / 2, 234, 8, '#b8a8c8', 'center');
  }
  drawDonate(H - 12);
  if (onlineOn()) { const ct = '[C] CLOUD SAVE'; g.font = '8px "Courier New",monospace'; const cw = g.measureText(ct).width + 10;
    cloudBox = { x: 4, y: 3, w: cw, h: 13 }; g.fillStyle = 'rgba(20,10,40,0.7)'; g.fillRect(cloudBox.x, 3, cw, 13); g.strokeStyle = '#8cc4ff';
    g.strokeRect(cloudBox.x + 0.5, 3.5, cw - 1, 12); text(ct, cloudBox.x + cw / 2, 13, 8, '#8cc4ff', 'center'); }
  { const S = jrLoad(), jt = '[4] JOURNEY ' + S.done.length + '/9'; g.font = '8px "Courier New",monospace'; const jw = g.measureText(jt).width + 10; // the season journey sits in the top right corner, like the cloud save in the left
    journeyBox = { x: W - jw - 4, y: 3, w: jw, h: 13 }; g.fillStyle = 'rgba(40,24,4,0.7)'; g.fillRect(journeyBox.x, 3, jw, 13); g.strokeStyle = '#c9a86a'; g.strokeRect(journeyBox.x + 0.5, 3.5, jw - 1, 12); text(jt, journeyBox.x + jw / 2, 13, 8, '#ffd24a', 'center'); }
  { const tt = '[5] TRAINING'; g.font = '8px "Courier New",monospace'; const tw = g.measureText(tt).width + 10; // the button-by-button training sits under the journey
    trainBox = { x: W - tw - 4, y: 19, w: tw, h: 13 }; g.fillStyle = 'rgba(8,24,40,0.7)'; g.fillRect(trainBox.x, 19, tw, 13); g.strokeStyle = '#8cc4ff'; g.strokeRect(trainBox.x + 0.5, 19.5, tw - 1, 12); text(tt, trainBox.x + tw / 2, 29, 8, '#8cc4ff', 'center'); }
  text('v' + VERSION, W - 6, H - 5, 7, '#6a5a80', 'right');
  text(resetArm > 0 ? 'PRESS R AGAIN TO ERASE YOUR HERO' : cls().name + ' LV ' + rpg.lvl + '    I: GEAR   B: LEATHERBOARD   N: SEASON BOARD   R: RESET HERO', W / 2, 248, 8, resetArm > 0 ? '#ff6a6a' : '#c9a8ff', 'center');
}

function render() {
  donateBox = null; dailyBox = null; cloudBox = null; journeyBox = null; shareBox = null; trainBox = null;
  if (mode === 'story') { drawStory(); return; }
  if (mode === 'name' || mode === 'board') { drawBoardScreen(); return; }
  const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) * 0.6 : 0;
  g.save(); g.translate(Math.round(sx), Math.round(sy));
  drawWorld(); drawDecals(); drawFog();
  for (const tx of torchPositions()) flame(Math.round(tx - cam), GROUND_TOP - 44, 1);
  drawChests(); drawShrines(); drawItems(); drawVentsAndSlashes(false);
  const list = [...enemies, ...mounts, ...players()].sort((a, b) => a.y - b.y);
  for (const f of list) drawFighter(f);
  drawShots(); drawVentsAndSlashes(true);
  drawParts(false); drawWeather();
  drawFloats();
  g.restore();
  applyLighting();
  g.save(); g.translate(Math.round(sx), Math.round(sy)); drawParts(true); g.restore();
  drawForeground(); // pillars, moss and reeds, chains and pipes, arches: one kind per theme
  if (dragon) drawDragonCast();
  if (flashA > 0) { g.fillStyle = `rgba(255,240,220,${Math.min(1, flashA)})`; g.fillRect(0, 0, W, H); }
  if (mode === 'title') drawTitleOverlay();
  else if (mode === 'dailyinfo') drawDailyInfo();
  else if (mode === 'journey') drawJourney();
  else if (mode === 'cloud') drawCloud();
  else if (mode === 'select') drawSelect();
  else if (mode === 'resume') drawResume();
  else drawHUD();
  if (intro) drawIntro();
  if (mode === 'shop') drawShop();
  if (mode === 'forge') drawForge();
  if (mode === 'inv') drawInv();
  if (mode === 'pause') drawPause();
  if (mode === 'gameover') {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H); text('YOU HAVE FALLEN', W / 2, 106, 22, '#e0431f', 'center'); text('SCORE ' + score, W / 2, 132, 12, '#fff1b0', 'center');
    text('STAGE ' + (stageIdx + 1) + ': ' + STAGES[stageIdx].name, W / 2, 148, 8, '#b8a8c8', 'center');
    drawCoins(W / 2 - 28, 168, rpg.coins, 28);
    if (endTimer > 30) { text(rpg.coins > 0 ? 'ENTER: CONTINUE  (USES 1 COIN)' : 'NO COINS LEFT', W / 2, 192, 10, '#fff', 'center'); text(rpg.coins > 0 ? 'ESC: END RUN AND SAVE SCORE' : 'ENTER: SAVE YOUR SCORE', W / 2, 206, 8, '#b8a8c8', 'center'); drawDonate(226); }
  }
  if (mode === 'victory') drawVictory();
}
function victoryFx() { // fanfare, fireworks and confetti above the cheering hero
  const t = endTimer;
  if (t === 1) { flashA = 0.7; SFX.big(); shake = 6; }
  [[4, 523], [14, 659], [24, 784], [36, 1047]].forEach(([at, f]) => { if (t === at) { sfxTone('square', f, f, 0.32, 0.05); sfxTone('triangle', f / 2, f / 2, 0.4, 0.07); } });
  if (t === 48) { SFX.magic(); [523, 659, 784, 1047].forEach(f => sfxTone('square', f, f, 1.0, 0.035)); }
  if (t > 8 && t % 15 === 0) { // a firework: a ring of sparks high above the ground
    const cx = cam + rnd(50, W - 50), z = rnd(110, 190), cols = [['#ffd24a', '#fff1b0'], ['#ff6a3a', '#ffb43a'], ['#8ad8ff', '#ffffff'], ['#ff8ad8', '#ffe0f4'], ['#9aff8a', '#e8ffe0']][Math.random() * 5 | 0];
    SFX.pick(); sfxTone('sawtooth', 900, 200, 0.25, 0.03);
    for (let k = 0; k < 46; k++) { const a = k / 46 * Math.PI * 2 + rnd(-0.05, 0.05), sp = rnd(1.2, 2.8); parts.push({ x: cx, y: 214, z, vx: Math.cos(a) * sp, vy: 0, vz: Math.sin(a) * sp, life: rnd(40, 70), max: 70, g: 0.035, c: cols[k % 2], size: k % 3 ? 2 : 3, add: true }); }
  }
  if (t % 2 === 0) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: 215, vx: rnd(-0.4, 0.4), vy: 0, vz: -rnd(0.5, 1.1), life: rnd(190, 260), max: 260, g: 0, c: ['#ffd24a', '#ff6a3a', '#8ad8ff', '#ff8ad8', '#9aff8a', '#ffffff'][Math.random() * 6 | 0], size: 2, add: false });
}
function drawVictory() {
  const t = endTimer, fade = k => clamp((t - k) / 18, 0, 1), W2 = W / 2;
  g.fillStyle = 'rgba(14,6,0,0.55)'; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter'; // slowly turning rays of light behind the title
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * 0.004, a2 = a + 0.1; g.fillStyle = 'rgba(255,200,90,0.07)'; g.beginPath(); g.moveTo(W2, 84); g.lineTo(W2 + Math.cos(a) * 420, 84 + Math.sin(a) * 420); g.lineTo(W2 + Math.cos(a2) * 420, 84 + Math.sin(a2) * 420); g.fill(); }
  glowDot(g, W2, 80, 120 + Math.sin(t * 0.06) * 8, '255,200,90', 0.22); g.restore();
  const rank = daily ? 'SEASON RACE COMPLETE' : cycle >= TRIAL_MAX ? 'LEGEND OF THE ASHEN VOW' : cycle >= 1 ? trialName(cycle) + ' CHAMPION' : 'HERO OF EMBERFALL';
  g.globalAlpha = fade(0); const bob = Math.sin(t * 0.07) * 2;
  text('CONGRATULATIONS!', W2 + 1, 74 + bob + 2, 26, '#7a3a08', 'center'); text('CONGRATULATIONS!', W2, 74 + bob, 26, (t >> 3) & 1 ? '#ffe27a' : '#ffd24a', 'center');
  g.globalAlpha = fade(16); text(rank, W2, 98, 12, '#ff9a4a', 'center');
  if (daily) {
    g.globalAlpha = fade(30); text('THE SEASON RACE IS WON', W2, 116, 11, '#fff1d0', 'center'); text(cls().name + ' REACHED LV ' + MAX_LV + ' + PG ' + PG_MAX, W2, 130, 9, '#c9a8ff', 'center');
    g.globalAlpha = fade(48); text('TIME ' + fmtTime(daily.t), W2, 150, 13, '#fff1b0', 'center');
    g.globalAlpha = fade(60); drawCrown(W2 - 4, 160); text(daily.crown ? 'A CROWN FOR YOUR SAVED HERO' : 'TODAY\'S CROWN IS ALREADY YOURS', W2, 181, 8, '#ffd24a', 'center');
    if (daily.newTrail && t > 90) text('NEW TRAIL: ' + COSM.gild.name, W2, 207, 8, COSM.gild.col, 'center');
  } else {
  g.globalAlpha = fade(30); text('THE WORLD IS SAVED', W2, 116, 11, '#fff1d0', 'center'); text(cls().name + ' KEPT THE ASHEN VOW', W2, 130, 9, '#c9a8ff', 'center');
  g.globalAlpha = fade(48); text('LV ' + rpg.lvl + '     SCORE ' + score, W2, 150, 11, '#fff1b0', 'center');
  g.globalAlpha = fade(60); text('UNSPENT COINS ' + rpg.coins + ' x 1500 WHEN YOU FINISH', W2, 163, 8, '#d9b98a', 'center');
  }
  if (cycle >= 1 && cycle <= 3 && !daily) text('FORGE LEVEL +' + (7 + cycle) + ' UNLOCKED', W2, 175, 9, '#ffb46a', 'center');
  g.globalAlpha = 1;
  if (t > 90) { if ((t >> 5) & 1 || t > 200) { if (daily) text('ENTER: SIGN THE LEATHERBOARD', W2, 192, 9, '#fff', 'center');
    else { text('ENTER: BEGIN ' + trialName(cycle + 1) + '  (+1 COIN, TOUGHER FOES)', W2, 192, 9, '#fff', 'center');
    text('ESC: FINISH AND SIGN THE LEATHERBOARD', W2, 205, 8, '#b8a8c8', 'center'); } } }
  drawDonate(224); drawShareHint(3);
}

