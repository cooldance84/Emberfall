/* ---------- campaign flow: story screens, stages ---------- */
/* ---------- pause menu ---------- */
const PAUSE_ITEMS = ['RESUME', 'MUSIC', 'SOUND FX', 'CRT FILTER', 'HD EFFECTS', 'SKILLS', 'CONTROLS', 'ELEMENTS', 'QUIT TO TITLE'];
let pauseI = 0, pausePg = 0;
function openPause() { mode = 'pause'; pauseI = 0; pausePg = 0; SFX.pick(); }
function updatePause() {
  if (pausePg) { if (isHit('back') || isHit('start') || isHit('atk') || isHit('pause')) pausePg = 0; return; }
  if (isHit('back') || isHit('pause')) { mode = 'play'; return; }
  if (isHit('up')) { pauseI = (pauseI + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; SFX.pick(); }
  if (isHit('down')) { pauseI = (pauseI + 1) % PAUSE_ITEMS.length; SFX.pick(); }
  const go = isHit('start') || isHit('atk') || isHit('left') || isHit('right');
  if (!go) return;
  if (pauseI === 0) mode = 'play';
  else if (pauseI === 1) { musicOn = !musicOn; saveSettings(); }
  else if (pauseI === 2) { sfxOn = !sfxOn; saveSettings(); SFX.pick(); }
  else if (pauseI === 3) { crtOn = !crtOn; saveSettings(); }
  else if (pauseI === 4) { hdOn = !hdOn; hdAuto = true; hdSlow = 0; saveSettings(); }
  else if (pauseI === 5) pausePg = 2;
  else if (pauseI === 6) pausePg = 1;
  else if (pauseI === 7) pausePg = 3;
  else if (pauseI === 8) { saveGame(); toTitle(); }
}
function drawPause() {
  g.fillStyle = 'rgba(4,2,10,0.72)'; g.fillRect(0, 0, W, H);
  panel(W / 2 - 110, 40, 220, 196, 'PAUSED');
  if (pausePg === 1) {
    const L = ['MOVE      WASD / ARROWS', 'ATTACK    J / Z', 'JUMP      K / X / SPACE', 'MAGIC     SHIFT / L / C', 'SKILL     U CAST, Q SWAP', 'RIDE/DISMOUNT   K / E', 'GEAR      I / TAB', 'PAUSE     ESC / P', 'PAD  STICK, X A B Y, LB/LT SKILL', 'PLAYER 2  ARROWS  , . /  ; \\'];
    L.forEach((t, i) => text(t, W / 2 - 96, 78 + i * 13, 8, '#e8dcc8', 'left'));
    text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  if (pausePg === 3) { // how the elements work
    const E = rpg.elem && ELEM[rpg.elem], T = elemTier(), L = [];
    L.push(['HITS BUILD UP A STATUS ON FOES;', '#e8dcc8']); L.push(['AT 100 IT TRIGGERS. TIERS UNLOCK EVERY 10 LEVELS;', '#e8dcc8']); L.push(['BUY THEM AT THE BLACKSMITH. DISMISS: 75% BACK.', '#e8dcc8']);
    L.push(['FIRE: BURNING.  FROST: CHILL, FREEZE.', '#e8dcc8']); L.push(['LIGHTNING: ARCS AND STUN.', '#e8dcc8']);
    L.push(['FROST BEATS FIRE, LIGHTNING BEATS FROST,', '#9aff9a']); L.push(['FIRE BEATS LIGHTNING. NEVER IMMUNE.', '#ff9a9a']);
    L.push([rpg.lvl < 10 ? 'REACH LEVEL 10, THEN SEE THE BLACKSMITH.' : E ? 'YOURS: ' + E.name + ' TIER ' + ROMAN[T] : 'PICK YOUR ELEMENT AT THE BLACKSMITH.', E ? E.col : '#ffd24a']);
    if (E) L.push([ELEM_TIERS[rpg.elem][T - 1], E.col2]);
    L.push(['GEAR: +% POWER FOR YOUR ELEMENT, +% RESIST', '#8fb8ff']); L.push(['AGAINST FIRE, FROST OR LIGHTNING FOES.', '#8fb8ff']);
    L.forEach(([t, c], i) => text(t, W / 2 - 100, 70 + i * 12, 7, c, 'left'));
    text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  if (pausePg === 2) {
    const cur = skillOf(hero);
    SKILLS.forEach((k, i) => { const on = k.lv <= rpg.lvl, y = 80 + i * 18; text('LV ' + k.lv, W / 2 - 96, y, 8, on ? '#8cc4ff' : '#4a4a5a', 'left'); text(skName(k,
      hero), W / 2 - 60, y, 9, on ? (cur === k ? '#ffd24a' : '#e8dcc8') : '#4a4a5a', 'left'); if (!on) text('LOCKED', W / 2 + 96, y, 7, '#4a4a5a',
      'right'); else if (cur === k) text('ACTIVE', W / 2 + 96, y, 7, '#ffd24a', 'right'); });
    text('YOUR LEVEL ' + rpg.lvl + '.  U CAST   Q SWAP SKILL', W / 2, 214, 8, '#b8a8c8', 'center'); text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  PAUSE_ITEMS.forEach((t, i) => {
    const sel = i === pauseI, y = 72 + i * 16, v = i === 1 ? musicOn : i === 2 ? sfxOn : i === 3 ? crtOn : i === 4 ? hdOn : null;
    if (sel) { g.fillStyle = 'rgba(255,180,60,0.22)'; g.fillRect(W / 2 - 98, y - 11, 196, 15); }
    text(t, W / 2 - 86, y, 10, sel ? '#ffd24a' : '#b8a8c8', 'left');
    if (v !== null) text(v ? 'ON' : 'OFF', W / 2 + 86, y, 10, v ? '#8aff9a' : '#ff6a6a', 'right');
  });
  text('ESC TO RESUME', W / 2, 226, 8, '#8878a0', 'center');
}

function wrapText(s, n) {
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
function openStory(title, sub, paras, next, themeIdx, act) {
  if (!paras.length) { next(); return; }
  paras = paras.map(p => heroize(tr(p))); story = { title, sub, paras, pi: 0, ci: 0, next, theme: themeIdx, act: act || 0 }; mode = 'story';
}
function updateStory() {
  const s = story; if (!s) { mode = 'play'; return; }
  const p = s.paras[s.pi];
  if (s.ci < p.length) s.ci += 1.6;
  if (isHit('start') || isHit('atk') || isHit('jump')) {
    if (s.ci < p.length) s.ci = p.length;
    else if (s.pi < s.paras.length - 1) { s.pi++; s.ci = 0; SFX.pick(); }
    else { const n = s.next; story = null; n(); return; }
  }
  updateParts(); cam += 0.2;
}
