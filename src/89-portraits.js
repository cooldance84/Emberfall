/* ---------- original bust portraits for story scenes ---------- */
const PORT = ['boss', 'witch', 'smith', 'king', 'wyrm'], PORT_NAME = ['CINDER COLOSSUS', 'MIRE MATRON', 'FORGEMASTER', 'CINDER KING', 'EMBER WYRM'];
function drawPortrait(kind, cx, cy, who, glow) {
  const w = 78, h = 96, x0 = cx - w / 2, y0 = cy - h / 2, t = tickN;
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  const bg = g.createLinearGradient(0, y0, 0, y0 + h); bg.addColorStop(0, '#120a1e'); bg.addColorStop(1, `rgb(${glow})`); g.fillStyle = bg; g.fillRect(x0, y0, w, h);
  const rg = g.createRadialGradient(cx, cy - 8, 4, cx, cy - 8, 52); rg.addColorStop(0, `rgba(${glow},0.55)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x0, y0, w, h);
  const P = (pts, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(cx + pts[0], cy + pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(cx + pts[i], cy + pts[i + 1]); g.closePath(); g.fill(); };
  const R = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(cx + x, cy + y, ww, hh); };
  const eyeGlow = c => { g.globalCompositeOperation = 'lighter'; g.fillStyle = c; g.fillRect(cx + 0, cy - 7, 1, 1); g.globalCompositeOperation = 'source-over'; };
  const br = Math.sin(t * 0.05) * 0.8;
  if (kind === 'hero') {
    P([-34, 48, -30, 24, -16, 16, 16, 16, 30, 24, 34, 48], '#3a4a78'); P([-34, 48, -30, 24, -16, 16, -12, 48], '#262f54'); R(-9, 8, 18, 12, '#d8a07a'); // shoulders, neck
    P([-30, 44, -30, 22, -22, 20, -22, 44], '#8a96c8'); R(-24, 20, 8, 3, '#c8d0f0');
    P([-22, 14, -26, -10, -20, -30, 0, -38, 20, -30, 26, -10, 22, 14, 14, 20, -14, 20], '#e0aa84'); P([8, -30, 20, -30, 26, -10, 22, 14, 14, 20, 10, 10], '#c48a64');
    P([-26, -8, -28, -34, -14, -46, 6, -48, 24, -38, 28, -14, 22, -22, 8, -34, -10, -30, -22, -18], '#7a2a1a'); P([-26, -8, -34, 14, -28, 22, -22, 4], '#5a1a10');
    R(-24, -22, 48, 5, '#c9962e'); R(-24, -22, 48, 1, '#ffe08a');
    R(6, -12, 10, 4, '#fff'); R(10, -12, 5, 4, '#1b1b2a'); R(10, -12, 2, 2, '#ffffff'); R(-14, -12, 10, 4, '#fff'); R(-12, -12, 5, 4, '#1b1b2a');
    R(4, -17, 12, 2, '#5a1a10'); R(-16, -17, 12, 2, '#5a1a10'); R(-4, 4, 8, 1, '#8a4a3a'); R(-2, 8, 1, 1, '#8a4a3a');
  } else if (kind === 'boss') { // colossus: horned iron helm
    P([-40, 48, -36, 22, -18, 14, 18, 14, 36, 22, 40, 48], '#2e2a34'); R(-30, 22, 60, 5, '#8a5a36'); R(-6, 24, 12, 24, '#e6b84a');
    P([-24, 14, -26, -24, -14, -36, 14, -36, 26, -24, 24, 14, 12, 22, -12, 22], '#47424e'); P([8, -36, 26, -24, 24, 14, 12, 22, 8, 6], '#2a2630'); P([-26, -24, -14, -36, 14, -36, 26, -24, 26, -20, -26, -20], '#6a6472');
    R(-3, -36, 6, 52, '#2a2630'); R(-19, -12, 14, 4, '#ffa23a'); R(5, -12, 14, 4, '#ffa23a'); R(-17, -12, 10, 2, '#fff0a8'); R(7, -12, 10, 2, '#fff0a8');
    for (let i = 0; i < 5; i++) R(-14 + i * 6, 6, 3, 8, '#141018'); P([-24, -20, -52, -34, -58, -58, -42, -44, -26, -34], '#e6dcc4'); P([24, -20, 52, -34, 58, -58, 42, -44, 26, -34], '#bfb49a');
  } else if (kind === 'witch') { // matron: hooded marsh hag
    const f = Math.sin(t * 0.08) * 2;
    P([-38, 48, -28, 10, 28, 10, 38, 48], '#16281f'); P([-26, -2, -34, 40, -20, 30, -10, 8], '#0e1a14');
    P([-30, 8, -36, -20, -14, -56 + f, 0, -64 + f, 14, -56 + f, 36, -20, 30, 8, 14, 14, -14, 14], '#1d3a2a'); P([6, -56 + f, 36, -20, 30, 8, 14, 14, 8, 0], '#10231a');
    P([-14, 14, -18, -12, -12, -32, 0, -36, 12, -32, 18, -12, 14, 14, 0, 20], '#8fb89a'); P([6, -32, 18, -12, 14, 14, 6, 14], '#6f9a7c');
    R(-12, -14, 9, 4, '#caffd8'); R(4, -14, 9, 4, '#caffd8'); R(-9, -14, 4, 4, '#1aa050'); R(7, -14, 4, 4, '#1aa050');
    R(-6, 2, 12, 2, '#1a0c14'); R(-4, 1, 1, 3, '#ddd'); R(2, 1, 1, 3, '#ddd'); R(-1, -8, 2, 8, '#6f9a7c');
    for (let i = 0; i < 5; i++) { const a = t * 0.04 + i * 1.26; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(160,255,190,0.8)'; g.fillRect(cx + Math.cos(a) * 32, cy + Math.sin(a * 1.3) * 28 - 6, 3, 3); g.globalCompositeOperation = 'source-over'; }
  } else if (kind === 'smith') { // forgemaster: furnace helm
    P([-40, 48, -34, 18, -16, 12, 16, 12, 34, 18, 40, 48], '#3a2a22'); R(-30, 40, 60, 8, '#5a3a26'); R(-22, 20, 44, 28, '#6a4a30'); R(-18, 22, 36, 3, '#8a5a36');
    P([-22, 12, -24, -28, -10, -42, 10, -42, 24, -28, 22, 12, 10, 18, -10, 18], '#4a4e58'); P([6, -42, 24, -28, 22, 12, 10, 18, 6, 4], '#2e323c'); R(-14, -50, 28, 10, '#3a3e48'); R(-14, -50, 28, 2, '#9aa1ad'); R(-26, -34, 52, 4, '#5c616c');
    const ef = 0.7 + Math.sin(t * 0.18) * 0.3; R(-18, -14, 36, 5, '#0e0806'); R(-17, -12, 34, 2, `rgb(255,${130 + ef * 80 | 0},30)`);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,140,40,${0.15 + ef * 0.12})`; g.fillRect(cx - 24, cy - 24, 48, 24); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 4; i++) R(-12 + i * 8, 4, 3, 8, '#1a1a20');
  } else if (kind === 'king') { // cinder king: burning crown
    P([-38, 48, -34, 20, -16, 14, 16, 14, 34, 20, 38, 48], '#2a0a10'); R(-4, 20, 8, 28, '#ff6a2a'); R(-22, 28, 44, 3, '#ff6a2a');
    P([-22, 12, -24, -20, -14, -34, 14, -34, 24, -20, 22, 12, 10, 20, -10, 20], '#1a1620'); P([8, -34, 24, -20, 22, 12, 10, 20, 8, 4], '#0c0a12');
    R(-16, -12, 12, 4, '#c8401a'); R(4, -12, 12, 4, '#ff6a2a'); R(6, -12, 8, 2, '#fff1b0'); R(-20, -38, 40, 6, '#c9962e'); R(-20, -38, 40, 1, '#ffe08a');
    for (let i = -2; i <= 2; i++) { const ch = 12 + (2 - Math.abs(i)) * 5, fh = 7 + Math.abs(Math.sin(t * 0.2 + i)) * 8; P([i * 8 - 3, -38, i * 8 + 3, -38, i * 8, -38 - ch], '#3a3040'); P([i * 8 - 2.5, -38 - ch, i * 8 + 2.5, -38 - ch, i * 8, -38 - ch - fh], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else { // wyrm: great dragon head
    const j = Math.sin(t * 0.09) * 2;
    P([-44, 48, -30, 6, 6, -8, 40, 0, 46, 48], '#3a2230'); P([-30, -4, -10, -26, 20, -30, 44, -12, 44, 6, 20, 14 + j, -20, 12], '#4a2a3a'); P([-10, -26, 20, -30, 44, -12, 30, -14, 10, -16], '#6a3a4a');
    P([-20, 12, 20, 14 + j, 44, 6, 36, 22 + j, 0, 28 + j, -22, 20 + j], '#d06a2a'); for (let i = 0; i < 6; i++) P([-8 + i * 8, 13 + j * 0.6, -4 + i * 8, 13 + j * 0.6, -6 + i * 8, 21 + j], '#fff0d8');
    P([-8, -26, -24, -52, -12, -34], '#ffb43a'); P([8, -28, 2, -58, 16, -32], '#ffb43a');
    R(14, -14, 12, 5, '#ffe27a'); R(19, -14, 3, 5, '#1a0a04'); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,200,80,0.35)'; g.fillRect(cx + 10, cy - 18, 20, 13); g.globalCompositeOperation = 'source-over';
    R(36, -2, 3, 2, '#1a0c10');
  }
  g.restore();
  g.strokeStyle = '#c9962e'; g.lineWidth = 2; g.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2); g.strokeStyle = '#2a1a0a'; g.lineWidth = 1; g.strokeRect(x0 - 0.5, y0 - 0.5, w + 1, h + 1);
  text(who, cx, y0 + h + 11, 7, '#ffd070', 'center');
}
function drawStory() {
  const s = story; if (!s) return;
  const T = themeFor(s.theme, s.act);
  const saveTH = TH; TH = T; drawWorld(); drawFog();
  for (const tx of torchPositions()) flame(Math.round(tx - cam), GROUND_TOP - 44, 1);
  { const sh = { x: hero.x, y: hero.y, f: hero.face, st: hero.st, z: hero.z, inv: hero.inv, fl: hero.flash }; // Nolan keeps watch at the bottom of the scene
    hero.x = cam + 150; hero.y = 240; hero.face = 1; hero.st = 'idle'; hero.z = 0; hero.inv = 0; hero.flash = 0; drawFighter(hero);
    hero.x = sh.x; hero.y = sh.y; hero.face = sh.f; hero.st = sh.st; hero.z = sh.z; hero.inv = sh.inv; hero.flash = sh.fl; }
  TH = saveTH;
  g.fillStyle = 'rgba(4,2,10,0.58)'; g.fillRect(0, 0, W, 214);
  const vg = g.createLinearGradient(0, 200, 0, H); vg.addColorStop(0, 'rgba(4,2,10,0.58)'); vg.addColorStop(1, 'rgba(4,2,10,0.1)'); g.fillStyle = vg; g.fillRect(0, 200, W, H - 200);
  drawParts(true);
  text(s.title, W / 2, 42, 16, '#ffb43a', 'center');
  if (s.sub) text(s.sub, W / 2, 58, 9, '#c9a8ff', 'center');
  g.fillStyle = 'rgba(255,180,60,0.35)'; g.fillRect(W / 2 - 120, 66, 240, 1);
  let y = 88;
  for (let i = 0; i <= s.pi; i++) {
    const lines = wrapText(s.paras[i], 54); let rem = i < s.pi ? 1e9 : s.ci | 0;
    for (const ln of lines) {
      if (rem <= 0) break;
      text(ln.slice(0, rem), W / 2, y, 9, i === s.pi ? '#fff1d0' : '#a898b8', 'center');
      rem -= ln.length + 1; y += 12;
    }
    y += 8;
  }
  if (s.theme >= 0 && s.theme < 5) { drawPortrait('hero', 46, 150, cls().name, CLS === 'panni' ? '80,50,120' : CLS === 'luca' ? '40,80,60' : '90,60,40'); drawPortrait(PORT[s.theme], W - 46, 150, PORT_NAME[s.theme], THEMES[s.theme].glow); }
  const done = s.pi === s.paras.length - 1 && s.ci >= s.paras[s.pi].length;
  if ((tickN >> 5) & 1) text(done ? 'PRESS ENTER' : '...', W / 2, 252, 9, '#ffffff', 'center');
}
function beginStage(i) {
  bonus = null; killCombo = 0; stageIdx = i; const S = STAGES[i]; TH = themeFor(S.theme, actOf(i)); weather = WEATHER[actOf(i)][S.theme]; WAVES = S.waves; STAGE_END = S.end;
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null;
  decals = []; impT = 240; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 190; flashA = 0; shake = 0; freeze = 0;
  intro = null; slashes = []; vents = []; chests = [];
  gaps = []; ambW = -1;
  { const bw = S.waves.find(w => w.e.some(t => BOSSES[t])), stop = bw ? bw.x - 320 : S.end - 300, n = i === 0 ? 2 : 2 + Math.min(3, actOf(i) + ((i % 5) >= 2 ? 1 : 0));
    if (i === 0) { gaps.push({ x: 590, w: 14, type: 'wall' }); gaps.push({ x: 1600, w: 34, type: 'pit' }); }
    else for (let x = 520 + (i * 37) % 120, k = 0; x < stop && k < n; x += 330 + ((i * 53 + k * 71) % 200), k++) { const pit = (i + k) % 3 !== 0; gaps.push({ x, w: pit ? 34 + ((i + k) * 13) % 9 : 14, type: pit ? 'pit' : 'wall' }); } }
  if (i >= 1) for (let x = 420, k = 0; x < S.end - 300; x += 330 + (k * 67) % 140, k++) if (!gaps.some(q => Math.abs(q.x + q.w / 2 - x) < 60)) vents.push({ x, y: Y_MIN + 20 + (k * 53) % (Y_MAX - Y_MIN - 30), ph: (k * 97) % 260, hit: new Set() });
  { const bw = S.waves.find(w => w.e.some(t => BOSSES[t])), stop = (bw ? bw.x - 260 : S.end - 260); // hidden treasure chests along the road
    const td = dailyIs('TREASURE SEASON'); for (let x = 300 + Math.random() * 160, k = 0; x < stop && k < (td ? 8 : 4); x += (380 + Math.random() * 260) / (td ? 2 : 1),
      k++) if (!gaps.some(q => Math.abs(q.x + q.w / 2 - x) < 50)) { const r = Math.random(),
      type = r < (dailyIs('TREASURE SEASON') ? 0.25 : 0.1) ? 'gold' : r < 0.24 && i >= 1 ? 'trap' : 'wood'; chests.push({ x: Math.round(x),
      y: Y_MIN + 12 + Math.random() * (Y_MAX - Y_MIN - 24), open: 0, hp: type === 'gold' ? 3 : 2, type }); } }
  shrines = []; buff = null; // a shrine may wait by the road (never on the first stage of the campaign, and always before the boss)
  if (i >= 1 || cycle) {
    const want = Math.max((i + 1) % 4 === 0 ? 1 : 0, Math.random() < 0.55 ? (Math.random() < 0.2 ? 2 : 1) : 0), // every fourth stage always has one
      bw = S.waves.find(w => w.e.some(t => BOSSES[t])), stop = bw ? bw.x - 260 : S.end - 260;
    for (let n = 0; n < want; n++) for (let tries = 0; tries < 14; tries++) {
      const x = Math.round(420 + Math.random() * Math.max(60, stop - 420));
      if (gaps.some(q => Math.abs(q.x + q.w / 2 - x) < 60) || chests.some(c => Math.abs(c.x - x) < 60) || vents.some(v => Math.abs(v.x - x) < 40) || shrines.some(q => Math.abs(q.x - x) < 160)) continue;
      shrines.push({ x, y: Math.round(Y_MIN + 14 + Math.random() * (Y_MAX - Y_MIN - 28)), used: 0, t: 0, shake: 0, sacred: Math.random() < 0.08 }); break;
    }
    if ((i + 1) % 4 === 0 && !shrines.length) shrines.push({ x: Math.round(stop * 0.5 + 200), y: 215, used: 0, t: 0, shake: 0, sacred: false }); // the fixed shrine is never skipped
  }
  for (const p of players()) {
    if (p.dead && coop) { p.dead = false; p.fade = 0; p.hp = Math.max(1, p.maxhp >> 1); }
    p.pitT = 0; p.x = p.pn === 2 ? 40 : 60; p.y = p.pn === 2 ? 232 : 205; p.z = 0; p.vx = 0; p.vz = 0; p.st = 'idle'; p.t = 0; p.mount = null; p.inv = 90; p.hits.clear();
    if (!p.dead && i > 0) p.hp = Math.min(p.maxhp, p.hp + 70);
  }
  mode = 'play'; saveRun(i);
}
function startCampaign(two) {
  clearRun();
  coop = !!two; cycle = 0; resetGame(); stageIdx = 0; TH = THEMES[0]; rpg.coins = 3; rpg.gold = 0; shop = null; devMax();
  openStory('THE ASHEN VOW', 'A TALE OF EMBERFALL', STORY.intro, () => beginStage(devStage()), 0);
}
function nextCycle() {
  cycle = daily ? Math.min(TRIAL_MAX, cycle + 1) : cycle + 1; rpg.coins = Math.min(MAX_COINS, rpg.coins + 1);
  for (const p of players()) { p.dead = false; p.fade = 0; p.hp = p.maxhp; p.mana = Math.max(p.mana, 60); }
  openStory('THE ASH RETURNS', trialName(cycle), STORY.loop, () => beginStage(0), 0);
}
function continueStage() {
  saveRun(stageIdx); const keep = score; newHero(); heroStats(true); score = keep; beginStage(stageIdx);
}
const MAX_COINS = 9;
const coinPrice = () => 600 + 300 * Math.max(0, rpg.coins - 2); // the more coins you hold, the dearer the next one
function drawCoins(x, y, n, gap) { // up to three slots, then one coin and a count
  if (n <= 3) { for (let i = 0; i < 3; i++) drawCoin(x + i * gap, y, i < n); return; }
  drawCoin(x, y, true); text('x' + n, x + 9, y + 4, 9, '#ffd24a');
}
