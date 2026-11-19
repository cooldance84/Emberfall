/* ---- inventory (Diablo-style paper doll + backpack) ---- */
function drawIcon(c, slot, x, y, sc, col) { // shaded metal, leather and stone; col is the accent (trim, gem, crest)
  c.save(); c.translate(x, y); c.scale(sc, sc);
  const dk = '#0b0610', M = ['#3e4558', '#6a7288', '#9aa4bc', '#dde5f6'], LE = ['#3a2210', '#6a4220', '#8e5e30', '#b07c44'];
  const cd = mixHex(col, '#000000', 0.45), cl = mixHex(col, '#ffffff', 0.5), cm = mixHex(col, '#ffffff', 0.22);
  const P = (pts, f, st) => { c.fillStyle = f; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); if (st !== false) { c.strokeStyle = dk; c.lineWidth = 0.8; c.stroke(); } };
  const Ln = (x1, y1, x2, y2, w, st) => { c.strokeStyle = st; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  if (slot === 'weapon') {
    P([13, 1, 15, 3, 7, 11, 5, 9], M[1]); P([13, 1, 14.2, 2.2, 6.2, 10.2, 5, 9], M[3], false); Ln(12.2, 3.6, 7.4, 8.4, 0.6, M[0]); // blade, bright edge, fuller
    P([3, 8, 8, 13, 7, 14, 2, 9], col); Ln(3.2, 8.2, 8, 13, 0.6, cl); // crossguard
    P([4, 12, 2, 14, 1, 13, 3, 11], LE[2]); Ln(3.4, 11.4, 2.2, 12.6, 0.5, LE[0]); c.fillStyle = col; c.beginPath(); c.arc(1.4, 14.2, 1.1, 0, 7); c.fill(); // leather grip, pommel stone
  } else if (slot === 'helm') {
    P([2, 13, 2, 8, 4, 4, 8, 2, 12, 4, 14, 8, 14, 13], M[1]); P([2, 13, 2, 8, 4, 4, 8, 2, 8, 13], M[2], false); P([3, 8, 4.2, 5, 7, 3, 7, 4.4, 5.2, 6, 4.2, 9], M[3], false);
    P([4, 8, 12, 8, 12, 10, 4, 10], dk); P([7.2, 8, 8.8, 8, 8.8, 13, 7.2, 13], M[2]);
    P([7, 0.5, 9, 0.5, 9.4, 5, 6.6, 5], col); Ln(7.4, 1, 7.4, 4.6, 0.6, cl);
    c.fillStyle = M[3]; c.fillRect(3, 11, 1, 1); c.fillRect(12, 11, 1, 1);
  } else if (slot === 'armor') {
    P([1, 5, 4, 2, 6, 2, 8, 4, 10, 2, 12, 2, 15, 5, 12, 7, 12, 14, 4, 14, 4, 7], M[1]); P([1, 5, 4, 2, 6, 2, 8, 4, 8, 14, 4, 14, 4, 7], M[2], false); P([2, 5, 4, 2.8, 5.4, 2.8, 4, 5], M[3], false);
    P([4, 11, 12, 11, 12, 13, 4, 13], LE[2]); c.fillStyle = col; c.fillRect(7.2, 10.8, 1.8, 2.4); Ln(4, 11.5, 12, 11.5, 0.5, LE[3]);
    P([8, 5.6, 10.2, 8, 8, 10.4, 5.8, 8], col); P([8, 5.6, 8, 8, 5.8, 8], cl, false); c.fillStyle = M[3]; c.fillRect(2, 5, 1, 1); c.fillRect(13, 5, 1, 1);
  } else if (slot === 'boots') {
    P([3, 2, 7, 2, 7, 9, 12, 10, 12, 13, 3, 13], LE[2]); c.fillStyle = LE[3]; c.fillRect(3.5, 4.5, 1, 5); c.fillStyle = LE[1]; c.fillRect(6, 5, 1, 4);
    P([3, 2, 7, 2, 7, 4.2, 3, 4.2], col); Ln(3.2, 2.4, 6.8, 2.4, 0.5, cl);
    P([9, 10, 12, 10, 12, 12.2, 9, 12.2], M[2]); P([3, 12, 12, 12, 12, 13.8, 3, 13.8], LE[0]); Ln(4.5, 6, 6.5, 6, 0.5, LE[0]); Ln(4.5, 8, 6.5, 8, 0.5, LE[0]);
  } else if (slot === 'ring') {
    c.strokeStyle = dk; c.lineWidth = 3.4; c.beginPath(); c.arc(8, 10, 4.4, 0, 7); c.stroke();
    c.strokeStyle = '#b8902c'; c.lineWidth = 2.2; c.beginPath(); c.arc(8, 10, 4.4, 0, 7); c.stroke();
    c.strokeStyle = '#ffe08a'; c.lineWidth = 0.8; c.beginPath(); c.arc(8, 10, 4.4, 3.4, 4.9); c.stroke();
    P([6, 2.4, 10, 2.4, 11.6, 5, 8, 8.2, 4.4, 5], col); P([6, 2.4, 10, 2.4, 8, 5], cl, false); P([4.4, 5, 6, 2.4, 8, 5], cm, false); P([8, 5, 11.6, 5, 8, 8.2], cd, false);
  } else {
    Ln(3, 1, 8, 9, 1.2, dk); Ln(13, 1, 8, 9, 1.2, dk); Ln(3, 1, 8, 9, 0.7, M[2]); Ln(13, 1, 8, 9, 0.7, M[1]); c.fillStyle = M[3]; c.fillRect(5, 4.5, 1, 1); c.fillRect(10.5, 4.5, 1, 1);
    P([8, 7.4, 12, 11, 8, 15.6, 4, 11], '#c8a040'); P([8, 9, 10.4, 11, 8, 13.8, 5.6, 11], col); P([8, 9, 8, 11, 5.6, 11], cl, false); P([8, 11, 10.4, 11, 8, 13.8], cd, false); Ln(8, 7.6, 11.6, 11, 0.5, '#ffe08a');
  }
  c.restore();
}
function panel(x, y, w, h, title) {
  g.fillStyle = '#15101c'; g.fillRect(x, y, w, h); g.strokeStyle = '#8a6a2a'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.strokeStyle = '#3a2a4a'; g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  text(title, x + w / 2, y + 15, 9, '#e8c46a', 'center');
}
const SET_GREEN = '#46e06a', SET_GREEN_RGB = '70,224,106';
const itemCol = it => it.set ? SET_GREEN : RARITY[it.rar].col;
/* the border says how good the item is: plain, blue double, gold with rivets, ornate corner irons and a halo, pulsing glow with a gem; set pieces glow green */
function rarFrame(x, y, w, rar, col, rgb, set) {
  const k = w / 26, u = Math.max(1, Math.round(2 * k)), pu = Math.sin(tickN * 0.1), W2 = x + w / 2;
  if (rar >= 3 || set) { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(W2, y + w / 2, 1, W2, y + w / 2, w * 0.62);
    gr.addColorStop(0, `rgba(${rgb},${0.3 + 0.1 * pu})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x, y, w, w);
    g.globalCompositeOperation = 'source-over'; }
  if (rar >= 4) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(${rgb},${0.08 + 0.09 * (pu * 0.5 + 0.5)})`; g.fillRect(x, y, w, w); g.globalCompositeOperation = 'source-over'; }
  g.lineWidth = 1; g.strokeStyle = col; g.strokeRect(x + 0.5, y + 0.5, w - 1, w - 1);
  if (rar === 1 || rar >= 4) { const ins = Math.max(2, Math.round(2.5 * k)); g.globalAlpha = rar >= 4 ? 0.45 + 0.35 * (pu * 0.5 + 0.5) : 0.6; g.strokeRect(x + ins + 0.5, y + ins + 0.5, w - 2 * ins - 1, w - 2 * ins - 1); g.globalAlpha = 1; }
  if (rar === 2) { g.fillStyle = '#fff4b0'; for (const [rx, ry] of [[x + 1, y + 1], [x + w - 1 - u, y + 1], [x + 1, y + w - 1 - u], [x + w - 1 - u, y + w - 1 - u]]) g.fillRect(rx, ry, u, u); }
  if (rar === 3) {
    const len = Math.max(3, Math.round(7 * k)), cc = mixHex(col, '#ffffff', 0.35);
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + w, 1, -1], [x + w, y + w, -1, -1]]) {
      g.fillStyle = '#0a0610'; g.fillRect(sx > 0 ? cx : cx - len, sy > 0 ? cy : cy - u - 1, len, u + 1); g.fillRect(sx > 0 ? cx : cx - u - 1, sy > 0 ? cy : cy - len, u + 1, len);
      g.fillStyle = cc; g.fillRect(sx > 0 ? cx : cx - len, sy > 0 ? cy : cy - u, len, u); g.fillRect(sx > 0 ? cx : cx - u, sy > 0 ? cy : cy - len, u, len);
    }
  }
  if (rar >= 4) { // a gem set into the top edge
    const r = Math.max(2.4, 3.6 * k); g.fillStyle = '#0a0610'; g.beginPath(); g.moveTo(W2, y - r - 1.2); g.lineTo(W2 + r + 1.2, y); g.lineTo(W2, y + r + 1.2); g.lineTo(W2 - r - 1.2, y); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(W2, y - r); g.lineTo(W2 + r, y); g.lineTo(W2, y + r); g.lineTo(W2 - r, y); g.closePath(); g.fill();
    g.fillStyle = mixHex(col, '#ffffff', 0.6); g.beginPath(); g.moveTo(W2, y - r); g.lineTo(W2, y); g.lineTo(W2 - r, y); g.closePath(); g.fill();
  }
}
function slotBox(x, y, it, sel, ghost) {
  g.fillStyle = '#0a0710'; g.fillRect(x - 1, y - 1, 28, 28);
  const IC = it ? itemCol(it) : null; // set pieces are green, everything else keeps its rarity colour
  g.fillStyle = it ? `rgba(${it.set ? SET_GREEN_RGB : RARITY[it.rar].rgb},0.2)` : '#1a1422'; g.fillRect(x, y, 26, 26);
  if (it) rarFrame(x, y, 26, it.rar, IC, it.set ? SET_GREEN_RGB : RARITY[it.rar].rgb, !!it.set);
  else { g.strokeStyle = '#4a3a5a'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 25, 25); }
  if (it) drawIcon(g, it.slot, x + 5, y + 5, 1, IC);
  else if (ghost) { g.globalAlpha = 0.28; drawIcon(g, ghost, x + 5, y + 5, 1, '#6a5a7a'); g.globalAlpha = 1; }
  if (it && it.set) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(${SET_GREEN_RGB},${0.07 + Math.sin(tickN * 0.08) * 0.04})`; g.fillRect(x, y, 26, 26); g.globalCompositeOperation = 'source-over'; } // faint pulse on set pieces
  if (it && it.set) { g.fillStyle = '#0a0710'; g.fillRect(x + 19, y + 1, 6, 6); g.fillStyle = SETS[it.set].col; g.fillRect(x + 20, y + 2, 4, 4); g.fillStyle = '#0a0710'; g.fillRect(x + 21, y + 3, 2, 2); g.fillStyle = SET_GREEN; g.fillRect(x + 21, y + 3, 1, 1); } // set badge, top right
  if (it && !canWear(it)) { g.fillStyle = 'rgba(170,20,30,0.4)'; g.fillRect(x, y, 26, 26); }
  if (it && it.up > 0) text('+' + it.up, x + 2, y + 8, 7, it.up >= 8 ? '#ff9ae0' : it.up >= 5 ? '#ffb45a' : '#ffd24a'); // forge level, top left (the set mark sits top right)
  if (sel) { g.strokeStyle = (tickN >> 3) & 1 ? '#ffd24a' : '#fff1b0'; g.lineWidth = 2; g.strokeRect(x - 2, y - 2, 30, 30); }
}
const eqPos = i => i < 3 ? [16, 34 + i * 44] : [136, 34 + (i - 3) * 44];
const bagPos = i => [192 + (i & 3) * 31, 30 + (i >> 2) * 31];
function drawTip(it, cmp, x, y, slim) { // slim: set bonus lines are left out (the forge needs the room); returns the y below the last line
  if (!it) { text('EMPTY', x + 75, y + 24, 9, '#6a5a7a', 'center'); return y + 30; }
  const R = RARITY[it.rar];
  const nm = iname(it), ist = itemSt(it), cst = cmp ? itemSt(cmp) : null;
  text(nm, x + 8, y + 26, nm.length > 20 ? 8 : 9, itemCol(it));
  text(R.name + ' ' + SLOT_NAME[it.slot], x + 8, y + 38, 8, '#9a90a8');
  text('REQUIRES LV ' + (it.lvl || 1), x + 8, y + 49, 8, canWear(it) ? '#9a90a8' : '#ff6a6a');
  if (it.q != null) text('ROLL ' + it.q + '%', x + 146, y + 49, 8, it.q >= 85 ? '#ffd24a' : it.q >= 50 ? '#9affb8' : '#7a7088', 'right');
  let yy = y + 62;
  for (const k of STAT_KEYS) if (ist[k]) { text('+' + ist[k] + STATS[k].sfx + ' ' + statName(k), x + 8, yy, 8, '#8fb8ff'); yy += 12; }
  if (it.ea) { text('+' + it.ea.v + '% ' + ELEM[it.ea.k].name + ' POWER', x + 8, yy, 8, ELEM[it.ea.k].col); yy += 12; }
  if (it.er) { text('+' + it.er.v + '% ' + ELEM[it.er.k].name + ' RESIST', x + 8, yy, 8, ELEM[it.er.k].col2); yy += 12; }
  if (it.set) { // set info: which bonuses are on, counting this piece as worn
    const S = SETS[it.set], n = setCount(it.set, it.slot) + 1;
    text(S.name + ' SET  ' + n + '/6', x + 8, yy + 2, 8, S.col); yy += 13;
    if (!slim) for (const [need, b] of S.b) {
      let t = need + ': ' + setBonusText(b), col = n >= need ? S.col : '#6a5a7a';
      if (t.length > 33) { const cut = t.lastIndexOf(' +', 33); text(t.slice(0, cut), x + 8, yy, 7, col); yy += 10; t = '   ' + t.slice(cut + 1); }
      text(t, x + 8, yy, 7, col); yy += 10;
    }
    yy += slim ? 0 : 2;
  }
  if (cmp !== undefined) {
    const rows = []; // the comparison lines, built first so they can be packed to fit the frame
    for (const k of STAT_KEYS) { const d = (ist[k] || 0) - ((cst && cst[k]) || 0); if (d) rows.push([(d > 0 ? '+' : '') + d + STATS[k].sfx + ' ' + statName(k), d > 0]); }
    for (const key of ['ea', 'er']) for (const el of ELEMS) { // elemental power and resist count in the comparison too
      const d = ((it[key] && it[key].k === el) ? it[key].v : 0) - ((cmp && cmp[key] && cmp[key].k === el) ? cmp[key].v : 0);
      if (d) rows.push([(d > 0 ? '+' : '') + d + '% ' + ELEM[el].name + (key === 'ea' ? ' POWER' : ' RESIST'), d > 0]);
    }
    yy += it.set ? 3 : 6; text(cmp ? 'VS EQUIPPED' : 'VS EMPTY SLOT', x + 8, yy, 8, '#c9a8ff');
    const CS = Math.max(8, Math.min(it.set ? 10 : 12, Math.floor((254 - yy) / Math.max(1, rows.length)))); // never below the text height, never past the bottom frame
    yy += CS;
    for (const r of rows) { text(r[0], x + 8, yy, 8, r[1] ? '#7aff9a' : '#ff6a6a'); yy += CS; }
  }
  return yy;
}
function openInv(from) { inv.from = from; inv.z = 'bag'; inv.i = 0; mode = 'inv'; SFX.pick(); }
function invItem() { return inv.z === 'bag' ? rpg.bag[inv.i] : rpg.eq[EQ_ORDER[inv.i]]; }
const discardGold = it => Math.max(1, Math.round(itemValue(it) * 0.4)); // a discarded piece is scrapped for 40% of its worth, so deeper and rarer gear pays more
function discardBag(i) {
  const it = rpg.bag[i]; if (!it) return; const gd = discardGold(it);
  rpg.bag.splice(i, 1); rpg.gold += gd; invNote = 'SCRAPPED  +' + gd + 'G'; invNoteT = 70; saveGame(); SFX.pick();
}
function updateInv() {
  if (invNoteT > 0) invNoteT--;
  if (isHit('inv') || isHit('back')) { mode = inv.from; return; }
  const L = isHit('left'), R = isHit('right'), U = isHit('up'), D = isHit('down');
  if (inv.z === 'eq') {
    const col = inv.i >= 3 ? 1 : 0, row = inv.i % 3;
    if (U) inv.i = col * 3 + Math.max(0, row - 1); else if (D) inv.i = col * 3 + Math.min(2, row + 1);
    else if (L && col) inv.i = row;
    else if (R) { if (!col) inv.i = 3 + row; else { inv.z = 'bag'; inv.i = row * 4; } }
  } else {
    const col = inv.i & 3, row = inv.i >> 2;
    if (U) inv.i = Math.max(0, row - 1) * 4 + col; else if (D) inv.i = Math.min(3, row + 1) * 4 + col;
    else if (R && col < 3) inv.i++;
    else if (L) { if (col > 0) inv.i--; else { inv.z = 'eq'; inv.i = 3 + Math.min(2, row); } }
  }
  if (isHit('start') || isHit('atk')) {
    if (inv.z === 'bag') {
      const it = rpg.bag[inv.i];
      if (it && !canWear(it)) { invNote = 'NEEDS LEVEL ' + (it.lvl || 1); invNoteT = 90; SFX.hit(); }
      else if (it) { const old = rpg.eq[it.slot]; rpg.eq[it.slot] = it; if (old) rpg.bag[inv.i] = old; else rpg.bag.splice(inv.i, 1); sortBag(old); PS = null; heroStats(false); saveGame(); SFX.pick(); }
    } else {
      const s = EQ_ORDER[inv.i], it = rpg.eq[s];
      if (it && rpg.bag.length < BAG_MAX) { rpg.bag.push(it); sortBag(); delete rpg.eq[s]; PS = null; heroStats(false); saveGame(); SFX.pick(); }
    }
  }
  if ((pressed.KeyX || pressed.Delete) && inv.z === 'bag' && rpg.bag[inv.i]) discardBag(inv.i);
  else if (pressed.TJump && inv.z === 'bag' && rpg.bag[inv.i]) { // on a phone the JUMP button discards; legendary and mythic items ask first (a second tap), the rest go at once
    const it = rpg.bag[inv.i];
    if (it.rar < 3 || (inv.dc === it && invNoteT > 0)) { inv.dc = null; discardBag(inv.i); }
    else { inv.dc = it; invNote = 'TAP JUMP AGAIN TO DISCARD'; invNoteT = 120; SFX.land(); }
  }
}
function drawInv() {
  g.fillStyle = 'rgba(6,3,12,0.92)'; g.fillRect(0, 0, W, H);
  panel(6, 6, 172, 258, 'CHARACTER'); panel(184, 6, 134, 258, 'BACKPACK'); panel(324, 6, 150, 258, 'ITEM');
  const sv = hero.st, sm = hero.mount; hero.st = 'idle'; hero.mount = null; drawHuman(hero, 92, 150); hero.st = sv; hero.mount = sm;
  EQ_ORDER.forEach((s, i) => { const [x, y] = eqPos(i); slotBox(x, y, rpg.eq[s], inv.z === 'eq' && inv.i === i, s); text(SLOT_NAME[s], x + 13, y + 36, 7, '#8a7a9a', 'center'); });
  const s = pstats(), y0 = 184, need = xpNeed(rpg.lvl);
  lvText('LV ' + rpg.lvl + (rpg.lvl >= MAX_LV ? '  MAX' : ''), 14, y0, 10, '#ffd24a');
  if (rpg.lvl >= MAX_LV) { const full = rpg.pg >= PG_MAX; bar(14, y0 + 5, 154, 4, full ? 1 : rpg.pxp, full ? 1 : pgNeed(rpg.pg), '#3a8aff', '#101a30'); text('PARAGON ' + rpg.pg + '/' + PG_MAX + (full ? '' : '   ' + Math.round(rpg.pxp / pgNeed(rpg.pg) * 100) + '%'), 14, y0 + 22, 8, '#8fc8ff'); }
  else { bar(14, y0 + 5, 154, 4, rpg.xp, need, '#8a6aff', '#1c1430'); text('XP ' + rpg.xp + '/' + need, 14, y0 + 22, 8, '#b8a8d8'); }
  text(cls().stat + ' ' + s.str + '    DMG x' + s.mult.toFixed(2), 14, y0 + 36, 8, '#e8e0f0');
  text('CRIT ' + s.crit + '%   CRIT DMG ' + s.cdmg + '%', 14, y0 + 48, 8, '#e8e0f0');
  text('HIT ' + s.hit + '%    HP ' + s.maxhp, 14, y0 + 60, 8, '#e8e0f0');
  if (rpg.elem && elemTier()) text(tr('ELEMENT') + ' ' + tr(ELEM[rpg.elem].name) + ' ' + ROMAN[elemTier()], 14, y0 + 72, 8, ELEM[rpg.elem].col); else if (rpg.lvl >= 10) text('ELEMENT: SEE THE BLACKSMITH', 14, y0 + 72, 7, '#ffd24a');
  for (let i = 0; i < BAG_MAX; i++) { const [x, y] = bagPos(i); slotBox(x, y, rpg.bag[i], inv.z === 'bag' && inv.i === i); }
  text('ITEMS ' + rpg.bag.length + '/' + BAG_MAX, 251, 164, 8, '#8a7a9a', 'center');
  if (invNoteT > 0) text(invNote, 251, 226, 8, '#ff6a6a', 'center');
  text(IS_TOUCH ? 'OK     EQUIP/UNEQUIP' : 'ENTER  EQUIP/UNEQUIP', 192, 184, 7, '#b8a8c8'); text(IS_TOUCH ? 'JUMP   DISCARD' : 'X      DISCARD', 192, 196, 7, '#b8a8c8'); text(IS_TOUCH ? 'GEAR   CLOSE' : 'I/TAB  CLOSE', 192, 208, 7, '#b8a8c8');
  drawCoins(198, 240, rpg.coins, 14); text('COINS', 244, 244, 7, '#b8a8c8');
  const it = invItem();
  drawTip(it, inv.z === 'bag' && it ? (rpg.eq[it.slot] || null) : undefined, 324, 6);
}
function drawCoin(x, y, on) { // a little pile of gold with a glint; an empty slot is a dark dish
  const disc = (cx, cy, rx, ry, face, edge) => { g.fillStyle = edge; g.beginPath(); g.ellipse(cx, cy + 1.3, rx, ry, 0, 0, 7); g.fill(); g.fillStyle = face; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); };
  if (!on) { g.fillStyle = '#0a0610'; g.beginPath(); g.ellipse(x, y + 2, 6, 3.4, 0, 0, 7); g.fill(); g.fillStyle = '#2e2434'; g.beginPath(); g.ellipse(x, y + 2, 4.6, 2.4, 0, 0, 7); g.fill(); return; }
  g.fillStyle = '#0a0610'; g.beginPath(); g.ellipse(x, y + 2.6, 7, 4.6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y - 1, 5, 3.4, 0, 0, 7); g.fill();
  disc(x - 2.6, y + 2.4, 4, 2.2, '#f0b830', '#a86a0c'); disc(x + 2.6, y + 2.4, 4, 2.2, '#ffcf3a', '#b87a10'); disc(x, y - 0.8, 3.8, 2.1, '#ffd84a', '#b87a10');
  g.strokeStyle = '#e0a020'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(x, y - 0.8, 2.3, 1.2, 0, 0, 7); g.stroke();
  g.fillStyle = '#fff1a0'; g.fillRect(x - 3, y - 1.6, 2, 1); g.fillRect(x - 5, y + 1.6, 2, 1);
  const ph = (tickN + (x * 7 | 0)) % 160; if (ph < 14) { const r = ph < 7 ? ph / 7 : (14 - ph) / 7, L = 1 + 3 * r; g.fillStyle = '#ffffff'; g.fillRect(x - 1 - L, y - 2, L * 2 + 1, 1); g.fillRect(x - 1, y - 2 - L, 1, L * 2 + 1); } // the glint
}

function newHero() {
  hero = hero1 = makeFighter('hero', 60, 205); hero.mana = 60; hero.pn = 1;
  if (coop) { hero2 = makeFighter('hero', 44, 232); hero2.mana = 60; hero2.pn = 2; }
  else hero2 = null;
}
function resetGame() {
  newHero(); heroStats(true); floats = []; intro = null;
  enemies = []; items = []; parts = []; decals = []; cam = 0; lockX = Infinity; score = 0; waveIdx = 0; shake = 0; freeze = 0; endTimer = 0;
  lastEnemy = null; msg = ''; msgT = 0; mounts = []; dragon = null; impT = 240; flashA = 0; shots = []; story = null; bossRef = null; stageCard = 0; clearT = 0; shrines = []; buffs = [];
}
resetGame();

