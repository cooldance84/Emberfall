/* ---- end of run: name entry + leather leaderboard ---- */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let nameBuf = [0, 0, 0], namePos = 0, pendingRun = null, boardHi = -1, resetArm = 0, leatherCv = null;
let inv = { z: 'bag', i: 0, from: 'play' }, invNote = '', invNoteT = 0;
function endRun(won) {
  clearRun(); boardView = daily ? 1 : 0; resetBoardUi(); // a normal game over shows the leatherboard even if the daily board was looked at before
  
  if (won && !daily) score += rpg.coins * 1500 + rpg.gold * 2;
  saveGame(); if (daily) saveDailyRun(stageIdx, true);
  const b = loadBoard();
  pendingRun = { s: score, st: stageIdx + 1, c: cycle + 1, lv: rpg.lvl, w: !!won, h: CLS };
  if (daily) { pendingRun.t = daily.t | 0; pendingRun.pg = rpg.pg | 0; pendingRun.at = Date.now(); pendingRun.b = buildOf(); pendingRun.sp = splitStr(daily.sp); }
  if (daily ? (onlineOn() || b.length < 10 || dailyCmp(pendingRun, b[b.length - 1]) < 0) : (score > 0 && (b.length < 10 || score > b[b.length - 1].s))) { nameBuf = rpg.ini.split('').map(c => Math.max(0, LETTERS.indexOf(c))); namePos = 0; mode = 'name'; }
  else { boardHi = -1; mode = 'board'; }
  endTimer = 0;
}
function startDaily() {
  daily = { date: seasonStr(), mod: dayMod(), t: 0, done: false, crown: false, sp: {}, last: null }; coop = false; cycle = 0;
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.indexOf('emberfall_daily_run_') === 0 && k.indexOf('emberfall_daily_run_' + daily.date + '_') !== 0) localStorage.removeItem(k); } } catch (e) { } // runs of earlier days are dropped
  rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; PS = null; resetGame(); stageIdx = 0; TH = THEMES[0]; rpg.coins = 1; rpg.gold = 0; shop = null;
  const o = loadDailyRun(CLS), live = !!o && !o.over && !o.done; if (live) { applyDailyRun(o); daily.t = Math.max(0, o.t | 0); }
  heroStats(true); loadOnlineBoard();
  beginStage(live ? o.stage : 0); msg = live ? 'SEASON RACE RESUMED  -  ' + fmtTime(daily.t) : 'SEASON: ' + DAILY_MODS[daily.mod].name + '  -  ' + DAILY_MODS[daily.mod].info; msgT = 280;
}
function dailyWin() { // level 70 and 100 paragon: the race is won
  daily.done = true; score += 5000; daily.crown = grantCrown(CLS); saveDailyRun(stageIdx, true); jrRaceWon();
  mode = 'victory'; endTimer = 0; TH = THEMES[4];
}
function toTitle() { boardView = 0; if (daily) { daily = null; PS = null; loadGame(); heroStats(true); } coop = false; cycle = 0; resetGame(); TH = THEMES[0]; weather = 'ash'; mode = 'title'; }
function updateName() {
  if (isHit('left')) namePos = (namePos + 2) % 3; if (isHit('right')) namePos = (namePos + 1) % 3;
  if (isHit('up')) nameBuf[namePos] = (nameBuf[namePos] + 1) % 26; if (isHit('down')) nameBuf[namePos] = (nameBuf[namePos] + 25) % 26;
  if (isHit('start')) {
    const n = nameBuf.map(i => LETTERS[i]).join(''); rpg.ini = n;
    const b = loadBoard(), e = Object.assign({ n }, pendingRun); b.push(e); b.sort(daily ? dailyCmp : (a, c) => c.s - a.s); boardHi = b.indexOf(e);
    saveBoard(b); saveGame(); if (daily) submitOnline(e); mode = 'board';
  }
}
const HERO_FILT = ['', 'nolan', 'panni', 'luca'];
let boardPage = 0, boardSel = -1, boardHero = 0, boardDetail = null, boardBoxes = []; // the selected row, the hero filter (0 = all), the open build card, the tap targets of the screen
const resetBoardUi = () => { boardSel = -1; boardHero = 0; boardDetail = null; boardPage = 0; archIdx = 0; };
const openBoard = v => { boardView = v; boardHi = -1; resetBoardUi(); mode = 'board'; };
let archIdx = 0; // which past season the archive shows (0 = the latest one that is over)
const viewOf = () => boardView >= 2 ? boardView : daily ? 1 : boardView; // 0 all time (this device), 1 this season's board, 2 the eternal board, 3 the past seasons
const archKey = () => endedSeasons()[archIdx] || '';
const archRows = () => hof.all ? bestPer(hof.all.filter(r => String(r.d).slice(0, 7) === archKey())).slice(0, 10) : [];
const nextView = v => v === 1 ? 2 : v === 2 ? 3 : 1;
const heroOk = e => !boardHero || e.h === HERO_FILT[boardHero];
const boardRows = () => bestPer((onlineOn() && onlineBoard.rows && onlineBoard.day === seasonStr()) ? onlineBoard.rows : loadBoard(1)).filter(heroOk).slice(0, 10); // online when it is loaded, this device otherwise; one line per player and hero, the hero filter applies to both
const hofRows = () => (hof.rows || []).filter(heroOk).slice(0, 10);
function openBuild() { const v = viewOf(), e = (v === 3 ? archRows() : v === 2 ? hofRows() : boardRows())[boardSel]; if (e) { boardDetail = e; boardPage = 0; } }
function updateBoard() {
  const v = viewOf(); if (v && onlineOn()) { loadHof(); if (v < 2) loadOnlineBoard(); } // the eternal data also feeds the titles and the archive
  if (boardDetail) { if (isHit('start') || isHit('back')) boardDetail = null; else if (isHit('left') || isHit('right')) boardPage ^= 1; return; }
  const list = v === 3 ? archRows() : v === 2 ? hofRows() : v === 1 ? boardRows() : [];
  if (list.length) { if (isHit('down')) boardSel = Math.min(list.length - 1, boardSel + 1); else if (isHit('up')) boardSel = boardSel <= 0 ? 0 : boardSel - 1; }
  if (v === 3 && (isHit('left') || isHit('right'))) { const n = endedSeasons().length; if (n) archIdx = (archIdx + (isHit('left') ? 1 : n - 1)) % n; boardSel = -1; } // A/D: an older or a newer season
  else if (v && (isHit('left') || isHit('right'))) { boardHero = (boardHero + (isHit('right') ? 1 : 3)) % 4; boardSel = -1; }
  if (v && pressed.KeyH) { boardView = nextView(v); boardSel = -1; return; } // H goes round: this season's board, the eternal board, the past seasons
  if (isHit('start')) { if (v && boardSel >= 0 && boardSel < list.length) openBuild(); else toTitle(); }
  else if (isHit('back')) toTitle();
}
function boardClick(x, y) {
  if (boardDetail) { boardDetail = null; return; }
  const b = boardBoxes.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (!b) return;
  if (b.k === 'hero') { boardHero = (boardHero + 1) % 4; boardSel = -1; } else if (b.k === 'view') { boardView = nextView(viewOf()); boardSel = -1; } else if (b.k === 'arch') { const n = endedSeasons().length; if (n) archIdx = (archIdx + 1) % n; boardSel = -1; } else if (b.k === 'row') { boardSel = b.i; openBuild(); }
}
function makeLeather() {
  leatherCv = document.createElement('canvas'); leatherCv.width = 360; leatherCv.height = 242;
  const c = leatherCv.getContext('2d');
  for (let x = 0; x < 360; x += 2) for (let y = 0; y < 242; y += 2) { c.fillStyle = `rgb(${90 + rnd(-14, 14) | 0},${58 + rnd(-10, 10) | 0},${34 + rnd(-8, 8) | 0})`; c.fillRect(x, y, 2, 2); }
  const vg = c.createRadialGradient(180, 121, 60, 180, 121, 230); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,0,0.65)'); c.fillStyle = vg; c.fillRect(0, 0, 360, 242);
  c.strokeStyle = '#1a0c04'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 357, 239);
  c.strokeStyle = '#d9b96a'; c.lineWidth = 1; c.setLineDash([4, 3]); c.strokeRect(9.5, 9.5, 341, 223); c.setLineDash([]);
  for (const [x, y] of [[6, 6], [354, 6], [6, 236], [354, 236]]) { c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); }
}
function drawBoardScreen() {
  tileLayer(TH.skyL, 0, 0); g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(0, 0, W, H);
  if (!leatherCv) makeLeather();
  g.drawImage(leatherCv, 60, 14);
  const C = '#f2d58c';
  if (mode === 'name') {
    text(daily ? 'SEASON RESULT' : 'NEW HIGH SCORE!', W / 2, 54, 16, C, 'center');
    text(daily ? (pendingRun.w ? 'TIME ' + fmtTime(pendingRun.t) : 'NOT FINISHED  LV ' + pendingRun.lv + '  PG ' + pendingRun.pg) : 'SCORE ' + String(score).padStart(7, '0'), W / 2, 76, 11, '#fff1d0', 'center');
    text((pendingRun.c > 1 ? trialName(pendingRun.c - 1) + '  ' : '') + 'STAGE ' + pendingRun.st + '   LV ' + pendingRun.lv + (pendingRun.w && !daily ? '   WORLD SAVED' : ''), W / 2, 92, 8, '#d9b98a', 'center');
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 44, sel = i === namePos;
      g.fillStyle = 'rgba(20,8,0,0.55)'; g.fillRect(x - 17, 112, 34, 52);
      g.strokeStyle = sel ? '#ffd24a' : '#8a6a3a'; g.lineWidth = 1; g.strokeRect(x - 16.5, 112.5, 33, 51);
      text(LETTERS[nameBuf[i]], x, 150, 34, sel ? '#fff1b0' : '#d9b98a', 'center');
      if (sel && (tickN >> 4) & 1) { g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(x - 6, 108); g.lineTo(x + 6, 108); g.lineTo(x, 100); g.fill(); g.beginPath(); g.moveTo(x - 6, 168); g.lineTo(x + 6, 168); g.lineTo(x, 176); g.fill(); }
    }
    text('W/S LETTER    A/D MOVE', W / 2, 206, 8, '#d9b98a', 'center');
    if ((tickN >> 5) & 1) text('PRESS ENTER TO SIGN THE BOARD', W / 2, 232, 9, '#fff', 'center');
    return;
  }
  const bv = viewOf(); boardBoxes = [];
  text(bv === 3 ? 'PAST SEASONS' : bv === 2 ? 'ETERNAL BOARD' : bv ? 'SEASON BOARD' : 'LEATHERBOARD', W / 2, 44, 18, C, 'center');
  const sub = bv === 3 ? (archKey() ? 'SEASON ' + seasonNo(archKey()) + '   ' + archKey() + '   ' + DAILY_MODS[modOfDay(archKey())].name : 'NO SEASON IS OVER YET')
    : bv === 2 ? 'EVERY PLAYER\'S FASTEST RACE, ALL SEASONS'
    : bv ? seasonStr() + '   ' + DAILY_MODS[daily ? daily.mod : dayMod()].name + '   ' + (seasonDaysLeft() ? seasonDaysLeft() + ' DAYS LEFT' : 'LAST DAY') : 'HALL OF EMBER WARDENS';
  text(sub, W / 2, 58, 8, '#c9a86a', 'center');
  const chip = (label, k, right) => { g.font = 'bold 7px "Courier New",monospace'; const w = Math.ceil(g.measureText(tr(label)).width) + 8, x = right ? 408 - w : 74;
    g.fillStyle = 'rgba(30,14,2,0.7)'; g.fillRect(x, 32, w, 12); g.strokeStyle = '#8a6a3a'; g.strokeRect(x + 0.5, 32.5, w - 1, 11);
    text(label, x + w / 2, 41, 7, '#e6cfa0', 'center'); boardBoxes.push({ x, y: 32, w, h: 12, k }); };
  if (bv === 3) chip('A/D: OLDER / NEWER', 'arch', false); else if (bv) chip('HERO: ' + (boardHero ? CLASSES[HERO_FILT[boardHero]].name : 'ALL'), 'hero', false);
  if (bv) chip(bv === 3 ? 'H: SEASON BOARD' : bv === 2 ? 'H: PAST SEASONS' : 'H: ETERNAL BOARD', 'view', true);
  const hdr = '#b8935a', heroDot = (h, x, y) => { if (CLASSES[h]) { g.fillStyle = CLASSES[h].col; g.fillRect(x, y - 6, 5, 6); } };
  const elemDot = (e, x, y) => { if (e.b && e.b.el) { g.fillStyle = ELEM[e.b.el].col; g.beginPath(); g.arc(x, y - 3, 2.5, 0, 7); g.fill(); } };
  const onl = bv === 1 && onlineOn() && onlineBoard.rows && onlineBoard.day === seasonStr(), b = bv === 3 ? archRows() : bv === 2 ? hofRows() : bv === 1 ? boardRows() : loadBoard(0), ch = bv === 2 ? champsOf() : {};
  if (bv === 2) { text('SEASON', 78, 76, 7, hdr); text('NAME', 140, 76, 7, hdr); text('HERO', 168, 76, 7, hdr); text('TIME', 262, 76, 7, hdr, 'right'); text('RULE', 272, 76, 7, hdr); }
  else { text('#', 80, 76, 7, hdr); text('NAME', 104, 76, 7, hdr); text(bv ? 'TIME' : 'SCORE', 252, 76, 7, hdr, 'right'); text('STAGE', 266, 76, 7, hdr); text('LV', 322, 76, 7, hdr); if (bv) text('PG', 356, 76, 7, hdr); }
  for (let i = 0; i < 10; i++) {
    const y = 93 + i * 15, e = b[i];
    if (!bv ? i === boardHi : (bv === 1 && onl && onlineSent && e && e.n === onlineSent.n && e.t === onlineSent.t && e.h === onlineSent.h && mode === 'board') || (bv === 1 && !onl && i === boardHi)) { g.fillStyle = (tickN >> 4) & 1 ? 'rgba(255,210,90,0.28)' : 'rgba(255,210,90,0.12)';
      g.fillRect(72, y - 10, 336, 13); }
    if (bv && i === boardSel && e) { g.fillStyle = 'rgba(140,196,255,0.2)'; g.fillRect(72, y - 10, 336, 13); g.strokeStyle = '#8cc4ff'; g.strokeRect(72.5, y - 9.5, 335, 12); }
    const col = !e ? '#7a5a3a' : i === 0 ? '#ffe27a' : i < 3 ? '#fff1d0' : '#e6cfa0';
    if (e && bv) boardBoxes.push({ x: 72, y: y - 10, w: 336, h: 13, k: 'row', i });
    if (bv === 2) {
      if (e) { text(e.d.slice(0, 7), 78, y, 9, col); text(e.n, 140, y, 9, col); text(CLASSES[e.h] ? CLASSES[e.h].name : '', 168, y, 8, CLASSES[e.h] ? CLASSES[e.h].col : col);
        text(fmtTime(e.t), 262, y, 9, col, 'right'); text(DAILY_MODS[modOfDay(e.d)].name, 272, y, 7, '#b8935a'); elemDot(e, 400, y);
        (ch[e.n + '|' + e.h] || []).slice(0, 3).forEach((c, k) => text('S' + c.s, 350 + k * 15, y, 7, PLACE_COL[c.p])); } // the seasons this player won a place in: gold, silver, bronze else text('---', 140, y, 9, col);
      continue;
    }
    text(String(i + 1).padStart(2, ' '), 78, y, 9, col);
    if (e) { text(e.n, 104, y, 9, col); heroDot(e.h, 124, y); text(bv ? (e.w ? fmtTime(e.t) : '-') : String(e.s).padStart(7, '0'), 252, y, 9, col, 'right');
      text((e.c > 1 ? 'C' + e.c + ' ' : '') + 'S' + e.st, 270, y, 9, col); text(String(e.lv), 322, y, 9, col); if (bv) text(String(e.pg | 0), 356, y, 9, col);
      if (e.w) text('*', 396, y, 9, '#ffd24a', 'center'); if (bv) elemDot(e, 384, y); }
    else text('---', 104, y, 9, col);
  }
  text(bv === 1 || bv === 3 ? '* = REACHED LV 70 + 100 PARAGON' : bv === 2 ? 'S1 S2.. = PLACE IN A PAST SEASON: GOLD, SILVER, BRONZE' : '* = WORLD SAVED', 78, 240, 7, hdr);
  if (!bv) text('ON THIS DEVICE', W / 2, 67, 6, '#c98a6a', 'center');
  else if (bv === 1) {
    const rows = onl ? onlineBoard.rows : null, cnt = rows ? '  -  ' + (rows.length >= 1000 ? '1000+' : rows.length) + ' RUNS, ' + rows.filter(r => r.w).length + ' FINISHED' : '';
    const st = !onlineOn() ? 'THIS DEVICE ONLY' : onlineSendErr ? 'NOT SENT - ONLINE BOARD UNREACHABLE' : onl ? 'ONLINE BOARD' + cnt : onlineBoard.err ? 'OFFLINE - THIS DEVICE ONLY' : 'LOADING THE ONLINE BOARD...';
    text(st, W / 2, 67, 6, onl && !onlineSendErr ? '#9ad08a' : '#e0a070', 'center');
  } else {
    const st = !onlineOn() ? 'ONLINE ONLY' : hof.rows ? (hof.rows.length ? 'ONLINE BOARD' : 'NO WINNER YET') : hof.err ? 'OFFLINE' : 'LOADING THE ETERNAL BOARD...';
    text(st, W / 2, 67, 6, hof.rows && hof.rows.length ? '#9ad08a' : '#e0a070', 'center');
  }
  if (bv) text(bv === 3 ? 'W/S: SELECT   ENTER: BUILD + SPLITS   A/D: SEASON   H: SEASON BOARD' : bv === 1 ? 'W/S: SELECT   ENTER: BUILD + SPLITS   A/D: HERO   H: ETERNAL BOARD' : 'W/S: SELECT   ENTER: BUILD + SPLITS   A/D: HERO   H: PAST SEASONS', W / 2, 252, 6, '#c9a86a', 'center');
  if ((tickN >> 5) & 1) text(bv && boardSel >= 0 ? 'ENTER: BUILD' : 'PRESS ENTER', W / 2 + 40, 240, 9, '#fff', 'center');
  if (!boardDetail && bv < 2) drawShareHint(46, 408);
  if (boardDetail) drawBuild(boardDetail);
}
function drawBuild(e) { // the card of a run: hero, time, element and the six pieces
  const bd = e.b ? cleanBuild(e.b) : null, hc = CLASSES[e.h];
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a1608'; g.fillRect(96, 30, 288, 206); g.strokeStyle = '#c9a86a'; g.lineWidth = 1; g.strokeRect(96.5, 30.5, 287, 205);
  text(e.n + (hc ? '  ' + hc.name : ''), W / 2, 50, 12, hc ? hc.col : '#fff1d0', 'center');
  text((e.w ? 'TIME ' + fmtTime(e.t) : 'NOT FINISHED') + '   LV ' + e.lv + '  PG ' + (e.pg | 0), W / 2, 64, 8, '#e6cfa0', 'center');
  if (e.d) text(e.d + '   ' + DAILY_MODS[modOfDay(e.d)].name, W / 2, 75, 7, '#b8935a', 'center');
  const cs = champsOf()[e.n + '|' + e.h]; if (cs && cs.length) text(cs.slice(0, 3).map(c => 'S' + c.s + ' ' + PLACE_TXT[c.p]).join('   '), W / 2, 83, 6, PLACE_COL[cs[0].p], 'center'); // the titles this player has won
  if (boardPage === 1) { // the second page: the split times, against the fastest finished run that has them
    const sp = e.sp || {}, rows = viewOf() === 2 ? hof.rows : onlineBoard.rows, L = rows && rows.find(r => r.w && r.sp && Object.keys(r.sp).length && r !== e), has = SPLIT_KEYS.some(k => sp[k]);
    text('SPLIT TIMES' + (L && L.n !== e.n ? '   VS ' + L.n : ''), W / 2, 97, 9, '#ffd24a', 'center');
    if (!has) text('NO SPLITS SAVED FOR THIS RUN', W / 2, 140, 8, '#8a6a3a', 'center');
    else SPLIT_KEYS.forEach((k, i) => { const y = 116 + i * 13, v = sp[k], d = v && L && L.sp[k] ? v - L.sp[k] : null;
      text(splitName(k), 140, y, 8, '#b8935a'); text(v ? fmtTime(v) : '-', 262, y, 8, v ? '#fff1d0' : '#6a4a2a', 'right'); if (d != null) text(fmtDelta(d), 350, y, 8, d > 0 ? '#ff8a6a' : '#9ad08a', 'right'); });
  } else
  if (!bd) { text('NO BUILD SAVED FOR THIS RUN', W / 2, 140, 8, '#8a6a3a', 'center'); }
  else {
    text(bd.el ? ELEM[bd.el].name + '  TIER ' + ROMAN[bd.et] : 'NO ELEMENT', W / 2, 97, 9, bd.el ? ELEM[bd.el].col : '#8a7a9a', 'center');
    EQ_ORDER.forEach((sl, i) => {
      const y = 112 + i * 18, it = bd.eq.find(q => q[0] === sl);
      text(SLOT_NAME[sl], 108, y, 7, '#b8935a');
      if (it) { text(it[1], 156, y, 9, RARITY[it[2]].col); text('+' + it[3], 372, y, 9, '#ffd24a', 'right'); if (it[4]) text(SETS[it[4]].name || it[4], 156, y + 8, 6, '#7aff9a'); } else text('-', 156, y, 9, '#6a4a2a');
    });
  }
  text('A/D: ' + (boardPage ? 'BUILD' : 'SPLITS') + '   ENTER / ESC: CLOSE', W / 2, 226, 7, '#8a6a3a', 'center');
}

