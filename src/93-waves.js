/* ---------- waves / camera ---------- */
function updateIntro() {
  const I = intro, b = I.e; I.t++;
  if (!b || b.dead) { intro = null; return; }
  const far = Math.abs(I.tx - b.x) > 5; b.x += (I.tx - b.x) * 0.06; b.y += (nearestPlayer(b.x).y - b.y) * 0.05; b.face = sgn(nearestPlayer(b.x).x - b.x) || b.face;
  b.st = far ? 'walk' : 'idle'; if (far) b.anim += 0.12; b.t++;
  if (I.t === 46) { shake = 12; flashA = 0.35; SFX.big(); spawn(b.x, b.y, 30, 30, { s0: 1, s1: 3.4, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 14, l1: 30, add: true, size: 2, up: 2, g: 0.04 }); }
  if (shake > 0) shake *= 0.9;
  updateParts();
  if (I.t >= 150 || (I.t > 60 && (isHit('start') || isHit('atk')))) { intro = null; b.cool = 70; b.st = 'idle'; b.t = 0; shake = 0; }
}
function drawIntro() {
  const I = intro, t = I.t, ease = Math.min(1, t / 20, (150 - t) / 20), h = Math.max(0, Math.round(36 * ease));
  g.fillStyle = '#000'; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h);
  if (t > 28 && t < 138) {
    const a = Math.min(1, (t - 28) / 16, (138 - t) / 14); g.globalAlpha = Math.max(0, a);
    text(((I.e && I.e.k) || KINDS[I.k]).name, W / 2, H - h + 15, 14, '#ff9a5a', 'center'); text(EPI[I.k] || '', W / 2, H - h + 27, 8, '#c9a8ff', 'center'); g.globalAlpha = 1;
  }
}
function buildList(w) { // later stages and cycles throw bigger crowds
  const hasBoss = w.e.some(t => BOSSES[t]), list = w.e.slice(), d = Math.min(9, (stageIdx < 5 ? stageIdx : 4 + Math.round((stageIdx - 4) * 0.35)) + cycle);
  for (let n = 0; n < d && list.length < 9; n++) list.push(hasBoss ? 'h' : (waveIdx % 2 ? 'b' : 'h'));
  if (d >= 2 && !hasBoss && waveIdx >= 2 && list.length < 9) list.push('b');
  return list;
}
function spawnFoe(t, x, hasBoss) {
  const f = makeFighter(t, x, rnd(Y_MIN + 6, Y_MAX - 6)), tn = STAGES[stageIdx].tint;
  if (tn && (t === 'h' || t === 'b')) f.k = Object.assign({}, f.k, tn);
  if (dailyIs('IRON FOES')) { f.hp = f.maxhp = Math.round(f.maxhp * 1.5); }
  if (dailyIs('SWIFT FOES')) f.k = Object.assign({}, f.k, { spd: f.k.spd * 1.2 });
  if (!BOSSES[t] && !hasBoss && (stageIdx >= 2 || cycle) && rq() < 0.05 + 0.01 * Math.min(stageIdx + cycle * 10, 12)) { // elite: bigger, faster, deadlier, better loot
    f.elite = true; f.glow = '255,200,80'; f.hp = f.maxhp = Math.round(f.maxhp * 1.8); f.h = Math.round(f.h * 1.12);
    f.k = Object.assign({}, f.k, { name: 'ELITE ' + f.k.name, scale: f.k.scale * 1.12, spd: f.k.spd * 1.15, armor2: '#ffd24a' });
  }
  if (!BOSSES[t] && !hasBoss && !f.barrier && t !== 'imp' && t !== 'gob' && (stageIdx >= 1 || cycle) && rq() < 0.06 + 0.012 * Math.min(stageIdx + cycle * 10, 15)) { // some foes simply arrive with an arcane barrier (6% to 24%)
    f.barrier = f.bmax = Math.round(f.maxhp * 0.6); f.warded = true;
  }
  enemies.push(f); return f;
}
function updateStage() {
  if (tut) { updateTutorial(); return; }
  if (bonus) { updateBonus(); return; }
  const w = WAVES[waveIdx];
  if (w && lockX === Infinity && leadX() > w.x - 120) {
    lockX = w.x - 200 > cam ? Math.max(cam, w.x - 200) : cam;
    // later stages throw bigger crowds: extra husks, brutes from stage 3, more escorts around bosses
    const hasBoss = w.e.some(t => BOSSES[t]), list = buildList(w); let rode = false;
    seeded('W' + stageIdx + '/' + cycle + '/' + waveIdx, () => list.forEach((t, i) => { // the crowd of a wave (elites, barriers, riders) is fixed by the season seed
      const side = i % 2 ? 1 : -1;
      const ex = offGap(side > 0 ? lockX + W + 30 + i * 22 : lockX - 30 - i * 22, side);
      const f = spawnFoe(t, ex, hasBoss); f.sid = 'w' + waveIdx + '.' + i;
      if (t === 'h' && !rode && ((stageIdx === 0 && !cycle && waveIdx === 0 && i === 0) || rq() < 0.08 + 0.02 * Math.min(stageIdx + cycle, 5))) { rode = true;
        f.mount = makeMount(0, 0, 0, pickMountType()); f.hp = f.maxhp = 60; f.h = f.k.h + 12; } // wyrmlings are rare now: at most one per wave
    }));
    waveN = list.length;
    if (!hasBoss) for (const t of ['warder', 'caller']) if (list.includes(t) && !hints[t]) { hints[t] = 1; msg = t === 'warder' ? 'SHATTER THE BARRIER WITH HEAVY BLOWS' : 'KEEP MOVING: RUNES BURN THE GROUND'; msgT = 150; }
    const bk = w.e.find(t => BOSSES[t]);
    if (bk) {
      bossRef = enemies.find(e => e.kind === bk); SFX.big(); msg = ''; msgT = 0;
      const lx = leadX(), tx = clamp(lx + 170 <= cam + W - 90 ? lx + 170 : lx - 170, cam + 90, cam + W - 90);
      intro = { t: 0, e: bossRef, tx, k: bk }; bossRef.st = 'idle'; bossRef.cool = 9999;
    }
  }
  if (lockX !== Infinity && w && ambW !== waveIdx && (stageIdx >= 1 || cycle) && !w.e.some(t => BOSSES[t])) { // ambush: fresh foes burst in from both sides
    const alive = enemies.filter(e => e.kind !== 'imp' && !e.dead).length;
    if (alive <= Math.max(1, Math.floor(waveN / 3))) {
      ambW = waveIdx; const pool = w.e.filter(t => !BOSSES[t]), n = 2 + (stageIdx >= 15 || cycle ? 1 : 0);
      for (let i = 0; i < n; i++) spawnFoe(pool[(i + waveIdx) % pool.length] || 'h', i % 2 ? cam + W + 30 + i * 18 : cam - 30 - i * 18, false);
      msg = 'AMBUSH!'; msgT = 80; SFX.big(); shake = Math.max(shake, 4);
    }
  }
  if (lockX !== Infinity && enemies.filter(e => e.kind !== 'imp').every(e => e.dead)) {
    lockX = Infinity; waveIdx++; goBlink = 240;
    if (waveIdx >= WAVES.length) { clearT = LOOT_T; msg = 'STAGE CLEAR'; msgT = 150; goBlink = 0; jr('stage'); }
  }
  const target = leadX() - W * 0.42;
  const maxCam = lockX !== Infinity ? lockX : STAGE_END - W;
  cam = clamp(lerp(cam, target, 0.1), cam > maxCam ? maxCam : cam, maxCam);
  if (cam < 0) cam = 0;
  for (const p of players()) { p.x = clamp(p.x, cam + 12, (lockX !== Infinity ? lockX : STAGE_END) + W - 12); p.x = Math.min(p.x, cam + W - 12); }
}

function updateItems() {
  for (const it of items) {
    it.t++;
    { const q = gapAt(it.x, 8); if (q) it.x = it.x < q.x + q.w / 2 ? q.x - 10 : q.x + q.w + 10; }
    if (it.kind === 'vase' || it.kind === 'gear') {
      if (it.z === undefined) { it.z = 8; it.vz = 3; }
      it.z += it.vz; it.vz -= 0.3; if (it.z < 0) { it.z = 0; it.vz = it.vz < -1.2 ? -it.vz * 0.4 : 0; }
    }
    const P = players().find(p => !p.dead && Math.abs(it.x - p.x) <= 16 && Math.abs(it.y - p.y) <= 14 && (it.kind !== 'meat' || p.hp < p.maxhp)); if (!P) continue; // healing stays on the ground while you are at full health
    if (it.kind === 'gear') {
      if (it.t < 14) continue;
      if (!withHero(P, () => pickupGear(it.it))) { if (!it.warn) { it.warn = 1; floatText(P.x, P.y - 60, 'PACK FULL', '#ff6a6a', 8); } continue; }
    } else if (it.kind === 'vase') {
      if (it.t < 14 || P.vases >= 3) continue;
      P.vases++; P.jt = tickN; msg = `EMBER JAR ${P.vases}/3    WRATH +${P.vases * 15}%`; msgT = 100;
    } else P.hp = Math.min(P.maxhp, P.hp + 35);
    it.gone = true; SFX.pick();
    spawn(it.x, it.y, 10, 12, { c: it.kind === 'vase' ? '#8fd0ff' : '#9dffb0', add: true, l0: 14, l1: 24, g: -0.02 });
  }
  items = items.filter(i => !i.gone);
}

const VENT_P = 260;
function updateVents() {
  slashes = slashes.filter(s => ++s.t < (s.big ? 14 : 9));
  for (const v of vents) {
    const t = (tickN + v.ph) % VENT_P;
    if (t === 0) v.hit.clear();
    if (t >= 100 && t < 118) {
      if (Math.abs(v.x - cam - W / 2) > W) continue;
      if (t === 100) { SFX.land(); shake = Math.max(shake, 1); }
      if (t % 2 === 0) spawn(v.x, v.y, 4, 3, { s0: 0.3, s1: 1, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 22, add: true, size: 2, up: 3.4, g: 0.1 });
      for (const f of [...enemies, ...players()]) {
        if (f.dead || v.hit.has(f) || f.z > 60 || f.mount) continue;
        if (Math.abs(f.x - v.x) < 18 && Math.abs(f.y - v.y) < 10) { v.hit.add(f); hitEl = 'fire'; hurt(f, f.pn ? 9 : 14, 'down', { x: v.x, face: 1, pn: 0 }); hitEl = null; if (f.pn) floatText(f.x, f.y - 50, 'SCORCHED', '#ff8a2a', 8); }
      }
    } else if (t >= 70 && t < 100 && t % 5 === 0 && Math.abs(v.x - cam - W / 2) < W) spawn(v.x, v.y, 2, 1, { s0: 0.2, s1: 0.5, c: '#ffb43a', l0: 8, l1: 14, add: true, size: 1, up: 1, g: 0 });
  }
}
function drawGaps() {
  for (const q of gaps) {
    const x0 = Math.round(q.x - cam), x1 = Math.round(q.x + q.w - cam); if (x1 < -40 || x0 > W + 40) continue;
    const top = Y_MIN - 14;
    if (q.type === 'pit') { // a chasm across the whole road, each theme with its own depth
      const pk = PITK[TH.farK] || PITK.castle, fl = 0.06 * Math.sin(tickN * 0.05 + q.x);
      g.fillStyle = pk.fill; g.fillRect(x0, top, x1 - x0, H - top);
      const gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, `rgba(${pk.glow},0)`); gr.addColorStop(1, `rgba(${pk.glow},${pk.ga + fl})`); g.fillStyle = gr; g.fillRect(x0, top, x1 - x0, H - top);
      if (pk.lava) for (let y = H - 40; y < H; y += 5) { const o = Math.sin(tickN * 0.08 + y * 0.3 + q.x) * 3; g.fillStyle = `rgba(255,${150 + (y - H + 40) * 2},40,${0.22 + (y - H + 40) / 160})`; g.fillRect(x0 + 2 + o, y, x1 - x0 - 4, 2); }
      if (pk.rays) { g.save(); g.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 3; r++) { const rx = x0 + (x1 - x0) * (0.2 + r * 0.3), rg = g.createLinearGradient(0, top, 0, H);
        rg.addColorStop(0, 'rgba(255,225,140,0.14)'); rg.addColorStop(1, 'rgba(255,225,140,0)'); g.fillStyle = rg; g.fillRect(rx - 2, top, 4, H - top); } g.restore(); }
      for (let y = top; y < H; y += 6) {
        const j = ((q.x * 7 + y * 13) % 5) - 2, ax = x0 - 3 + j, bx = x1 - 1 - j;
        g.fillStyle = pk.e1; g.fillRect(ax, y, 4, 5); g.fillRect(bx, y, 4, 5); g.fillStyle = pk.e2; g.fillRect(ax, y, 4, 1); g.fillRect(bx, y, 4, 1); g.fillStyle = pk.e3; g.fillRect(x0 + 1 + j, y, 3, 6); g.fillRect(x1 - 4 - j, y, 3, 6);
        if (pk.moss && ((y / 6) | 0) % 2 === 0) { g.fillStyle = pk.moss; g.fillRect(ax, y + 1, 4, 2); g.fillRect(bx, y + 1, 4, 2); }
      }
      if (((tickN + q.x) % 40) === 0) spawn(q.x + q.w / 2 + rnd(-8, 8), rnd(Y_MIN, Y_MAX), -2, 1, { c: pk.sp, s0: 0.1, s1: 0.3, l0: 20, l1: 40, add: true, up: 0.8, g: -0.01, size: 1 });
    } else { // a rubble barricade
      for (let y = top; y < H; y += 7) {
        const xx = Math.round(x0), hsh = ((q.x * 31 + y * 17) >>> 0) % 7, ht = 14 + hsh;
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(xx - 2, y + 2, q.w + 6, 4);
        g.fillStyle = '#0c0810'; g.fillRect(xx - 1, y - ht - 1, q.w + 2, ht + 6);
        g.fillStyle = hsh % 2 ? '#6a5a5e' : '#5a4c52'; g.fillRect(xx, y - ht, q.w, ht + 4);
        g.fillStyle = '#9a8a8c'; g.fillRect(xx, y - ht, q.w, 2); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(xx + q.w - 3, y - ht, 3, ht + 4); g.fillRect(xx, y - ht + 7, q.w, 1);
        if (hsh % 3 === 0) { g.fillStyle = '#5a3a22'; g.fillRect(xx + 4, y - ht - 8, 2, 9); g.fillStyle = '#c8b08a'; g.fillRect(xx + 4, y - ht - 9, 2, 2); }
      }
    }
  }
}
function drawVentsAndSlashes(top) {
  if (!top) drawGaps();
  if (!top) for (const v of vents) {
    const x = Math.round(v.x - cam); if (x < -30 || x > W + 30) continue;
    const t = (tickN + v.ph) % VENT_P, warn = t >= 60 && t < 100 ? (t - 60) / 40 : 0, on = t >= 100 && t < 118;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(x, v.y, 15, 5, 0, 0, 7); g.fill();
    g.fillStyle = on ? '#fff1b0' : `rgb(${95 + warn * 155 | 0},${34 + warn * 70 | 0},12)`; g.beginPath(); g.ellipse(x, v.y, 11, 3.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#1a0c0a'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, v.y, 13, 4.5, 0, 0, 7); g.stroke();
    if (warn > 0 && (tickN >> 2) & 1) { g.fillStyle = `rgba(255,180,60,${warn * 0.6})`; g.fillRect(x - 1, v.y - 8 - warn * 6, 2, 5); }
    if (on) { const h = 70 * Math.sin((t - 100) / 18 * Math.PI) + 10; const gr = g.createLinearGradient(0, v.y - h, 0, v.y); gr.addColorStop(0, 'rgba(255,120,30,0)');
      gr.addColorStop(0.5, 'rgba(255,170,60,0.85)'); gr.addColorStop(1, 'rgba(255,240,180,0.95)'); g.fillStyle = gr; g.fillRect(x - 6, v.y - h, 12, h); }
  }
  if (top) for (const s of slashes) {
    const k = s.t / (s.big ? 14 : 9), x = s.x - cam, y = s.y - s.z, L = (s.big ? 34 : 22) * (0.6 + k * 0.6);
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.rotate(s.a); g.globalAlpha = 1 - k;
    g.fillStyle = '#fff6c8'; g.fillRect(-L / 2, -1, L, 2); g.fillStyle = '#ffb43a'; g.fillRect(-L / 2 - 4, -2, L + 8, 1); g.fillRect(-L / 2 - 4, 1, L + 8, 1);
    if (s.big) { g.rotate(1.2); g.fillStyle = '#fff1b0'; g.fillRect(-L / 3, -1, L * 0.66, 2); }
    g.restore();
  }
}
function updateParts() {
  updateVents();
  for (const p of parts) { p.life--; if (p.ring) continue; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= p.g; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.7; } }
  parts = parts.filter(p => p.life > 0);
  if (parts.length < 300 && Math.random() < 0.5) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 90), vx: rnd(-0.2, 0.4), vy: 0, vz: rnd(0.1, 0.4), life: rnd(60, 160), max: 160, g: -0.002, c: TH.amb, size: 1, add: true, amb: true });
}

function step() {
  tickN++; flashA *= 0.88; if (flashA < 0.02) flashA = 0;
  pollPad(); musicTick();
  if (mode === 'title') {
    if (resetArm > 0) resetArm--;
    if (pressed.KeyR) { if (resetArm > 0) { rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; PS = null; saveGame(); heroStats(true); resetArm = 0; } else resetArm = 180; }
    else if (isHit('inv')) { openInv('title'); return; }
    else if (pressed.KeyB) { openBoard(0); return; }
    else if (pressed.KeyN) { openBoard(1); return; }
    else if (pressed.KeyC) { openCloud(); return; }
    else if (pressed.Digit2 || pressed.Numpad2) { openSelect(true); return; }
    else if (pressed.Digit3 || pressed.Numpad3 || pressed.KeyT) { openDailyInfo(); return; }
    else if (pressed.Digit4 || pressed.Numpad4 || pressed.KeyG) { openJourney(); return; }
    else if (pressed.Digit5 || pressed.Numpad5 || pressed.KeyH) { startTutorial(() => { }, true); return; }
    else if (isHit('start') || isHit('atk')) { openSelect(false); return; }
    updateParts(); cam += 0.3; return;
  }
  if (mode === 'dailyinfo') { updateDailyInfo(); updateParts(); cam += 0.3; return; }
  if (mode === 'journey') { updateJourney(); updateParts(); cam += 0.3; return; }
  if (mode === 'cloud') { updateCloud(); updateParts(); cam += 0.3; return; }
  if (mode === 'select') { updateSelect(); updateParts(); cam += 0.3; return; }
  if (mode === 'resume') { updateResume(); updateParts(); cam += 0.3; return; }
  if (mode === 'story') { updateStory(); return; }
  if (mode === 'inv') { updateInv(); return; }
  if (mode === 'shop') { updateShop(); return; }
  if (mode === 'forge') { updateForge(); return; }
  if (mode === 'pause') { updatePause(); return; }
  if (mode === 'name') { updateName(); return; }
  if (mode === 'board') { updateBoard(); return; }
  if (mode === 'gameover') {
    endTimer++; updateParts();
    if (endTimer > 30) {
      if (isHit('start')) { if (rpg.coins > 0) { rpg.coins--; continueStage(); } else endRun(false); }
      else if (isHit('back') && rpg.coins > 0) endRun(false);
    }
    return;
  }
  if (mode === 'victory') { endTimer++; victoryFx(); updateParts(); if (endTimer > 90) { if (daily) { if (isHit('start') || isHit('back')) endRun(true); } else if (isHit('start')) nextCycle(); else if (isHit('back')) endRun(true); } return; }
  if (tut && (isHit('pause') || isHit('back'))) { tutFinish(); return; } // ESC skips the training
  if (isHit('pause') && !hero.dead && !dragon) { openPause(); return; }
  if (isHit('inv') && !tut && !hero.dead && !dragon && hero.st !== 'down') { openInv('play'); return; }
  if (intro) { updateIntro(); return; }
  if (freeze > 0) { freeze--; return; }
  if (dragon) { stepDragon(); if (dragon && dragon.t < 62) { updateParts(); return; } }
  if (daily && !daily.done) { daily.t++; if (tickN % 30 === 0) splitTick(); if (tickN % 1800 === 0) loadOnlineBoard(); if (rpg.lvl >= MAX_LV && rpg.pg >= PG_MAX) { dailyWin(); return; } } // only play time counts: shops, pauses and story pages do not
  for (const p of players()) withHero(p, () => updateHero(p));
  enemies.forEach(e => withHero(nearestPlayer(e.x), () => updateEnemy(e))); updateShots(); elemAura(); gearSparks(); updateShrines(); buffFx(); cosFx(); if (!daily && tickN % 60 === 0) jrApply();
  enemies = enemies.filter(e => !(e.dead && e.fade > 50) && !e.gone);
  updateItems(); updateParts(); updateMounts(); updateImpSpawn(); updateStage(); updateFloats(); updateWeather();
  if (shake > 0) shake *= 0.86; if (shake < 0.2) shake = 0;
  if (goBlink > 0) goBlink--; if (msgT > 0) msgT--;
  if (stageCard > 0) stageCard--; if (clearT > 0) { clearT--; if (clearT === 0 || (clearT < LOOT_T - 60 && (pressed.Enter || pressed.TStart))) { clearT = 0; stageCleared(); } }
}

