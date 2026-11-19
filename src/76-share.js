/* ---------- share card: a picture of a finished season race for Facebook and friends ---------- */
let shareNote = '', shareNoteT = 0, shareBox = null;
function shareData() { // the run on screen: the race that has just been won, or the one that was signed on the board; null when no finished race
  if (!daily) return null; const pr = pendingRun && pendingRun.t ? pendingRun : null, w = pr ? pr.w : daily.done; if (!w) return null;
  const rows = onlineOn() && onlineBoard.day === seasonStr() && onlineBoard.rows ? bestPer(onlineBoard.rows.filter(r => r.w)) : null, t = pr ? pr.t : daily.t;
  return { n: pr ? (pr.n || rpg.ini) : rpg.ini, h: pr ? pr.h : CLS, t, lv: pr ? pr.lv : rpg.lvl, pg: pr ? pr.pg | 0 : rpg.pg, season: seasonNo(seasonStr()), month: seasonStr(), rule: DAILY_MODS[daily.mod].name,
    sp: pr && pr.sp ? splitsFrom(pr.sp) : daily.sp || {}, el: rpg.elem || '', et: elemTier(), rank: rows ? rows.filter(r => r.t < t).length + 1 : 0, of: rows ? rows.length : 0 };
}
function drawShareCard(c, d) { // c: a 2d context of 1200x630
  const R = 'bold ', F = ' "Courier New",monospace', hc = CLASSES[d.h], mid = 600;
  const bg = c.createLinearGradient(0, 0, 0, 630); bg.addColorStop(0, '#0a0610'); bg.addColorStop(1, '#2a0e08'); c.fillStyle = bg; c.fillRect(0, 0, 1200, 630);
  const gl = c.createRadialGradient(mid, 120, 10, mid, 120, 520); gl.addColorStop(0, 'rgba(255,150,60,0.35)'); gl.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = gl; c.fillRect(0, 0, 1200, 630);
  c.strokeStyle = '#c9a86a'; c.lineWidth = 4; c.strokeRect(18, 18, 1164, 594); c.lineWidth = 1; c.strokeRect(30, 30, 1140, 570);
  c.textAlign = 'center'; const T = (s, y, px, col, w) => { c.font = (w === 0 ? '' : R) + px + 'px' + F; c.fillStyle = col; c.fillText(s, mid, y); };
  const tg = c.createLinearGradient(0, 60, 0, 140); tg.addColorStop(0, '#fff1b0'); tg.addColorStop(0.5, '#ffb43a'); tg.addColorStop(1, '#e0431f'); c.font = R + '96px' + F; c.fillStyle = '#2a0e08'; c.fillText('EMBERFALL', mid + 5, 135); c.fillStyle = tg; c.fillText('EMBERFALL', mid, 130);
  T('THE ASHEN VOW  -  SEASON RACE', 175, 30, '#c9a8ff');
  T('SEASON ' + d.season + '   ' + d.month + '   ' + d.rule, 222, 30, '#ffd24a');
  T((hc ? hc.name : String(d.h).toUpperCase()) + (d.n ? '  (' + d.n + ')' : ''), 285, 54, hc ? hc.col : '#ffffff');
  T('LV ' + d.lv + '  +  PARAGON ' + d.pg, 325, 32, '#e6cfa0');
  T(fmtTime(d.t), 440, 130, '#fff1b0'); T('FASTEST PLAY TIME WINS', 478, 24, '#b8935a', 0);
  if (d.rank) T('RANK #' + d.rank + ' OF ' + d.of + ' FINISHERS THIS SEASON', 515, 32, d.rank <= 3 ? PLACE_COL[d.rank] : '#9ad08a');
  const ks = SPLIT_KEYS.filter(k => d.sp[k]); if (ks.length) { const w = 1080 / ks.length; ks.forEach((k, i) => { c.font = R + '22px' + F; c.fillStyle = '#b8935a'; c.fillText(splitName(k), 60 + w * (i + 0.5), 574); c.fillStyle = '#fff1d0'; c.fillText(fmtTime(d.sp[k]), 60 + w * (i + 0.5), 595); }); }
  if (d.el && ELEM[d.el]) { c.fillStyle = ELEM[d.el].col; c.beginPath(); c.arc(70, 62, 12, 0, 7); c.fill(); c.textAlign = 'left'; c.font = R + '22px' + F; c.fillText(ELEM[d.el].name + ' ' + ROMAN[d.et], 90, 70); c.textAlign = 'center'; }
  T('cooldance84.github.io/Emberfall', 551, 18, '#8a7a9a', 0);
}
function shareCard() {
  const d = shareData(); if (!d) { SFX.land(); shareNote = 'FINISH THE RACE TO SHARE IT'; shareNoteT = 180; return; }
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630; const c = cv.getContext('2d'); drawShareCard(c, d);
  const note = s => { shareNote = s; shareNoteT = 240; };
  if (!cv.toBlob) { note('THIS BROWSER CANNOT MAKE THE IMAGE'); return; }
  cv.toBlob(b => {
    if (!b) { note('COULD NOT MAKE THE IMAGE'); return; }
    const name = 'emberfall-season-' + d.season + '-' + fmtTime(d.t).replace(/:/g, '') + '.png', f = typeof File === 'function' ? new File([b], name, { type: 'image/png' }) : null;
    if (f && navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: 'Emberfall season race', text: 'My Emberfall season race: ' + fmtTime(d.t) + '  https://cooldance84.github.io/Emberfall/' }).then(() => note('SHARED'), () => { }); return; }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); note('IMAGE SAVED TO YOUR DOWNLOADS'); } catch (e) { note('COULD NOT SAVE THE IMAGE'); }
  }, 'image/png');
}
function drawShareHint(y, xr) { // a chip on the screens of a finished race; the note shows what happened
  if (!daily || !shareData()) { shareBox = null; return; }
  const t = 'Y: SHARE IMAGE'; g.font = '8px "Courier New",monospace'; const w = g.measureText(t).width + 10; shareBox = { x: (xr || W - 4) - w, y, w, h: 13 };
  g.fillStyle = 'rgba(20,10,40,0.75)'; g.fillRect(shareBox.x, y, w, 13); g.strokeStyle = '#8cc4ff'; g.strokeRect(shareBox.x + 0.5, y + 0.5, w - 1, 12); text(t, shareBox.x + w / 2, y + 10, 8, '#8cc4ff', 'center');
  if (shareNoteT > 0) { shareNoteT--; text(shareNote, W / 2, 262, 8, '#9ad08a', 'center'); }
}
