/* ---------- the blacksmith: after every stage, forge weapons up to +7 for gold ---------- */
const FORGE_P = [1, 1, 1, 0.8, 0.65, 0.5, 0.35, 0.3, 0.25, 0.2]; // chance to reach the next level from +0 ... +9
const forgeCost = it => Math.round((40 + (it.lvl || 1) * 5) * (1 + 0.75 * (it.up | 0)) * [1, 1.2, 1.5, 1.8, 2.2][it.rar]);
let forge = null;
function forgeList() { const a = []; if (rpg.lvl >= 10) a.push({ el: true }); for (const sl of SLOTS) if (rpg.eq[sl]) a.push({ it: rpg.eq[sl], worn: true }); for (const it of rpg.bag) a.push({ it }); a.push({ go: true }); return a; }
function openForge(next) { forge = { i: 0, note: '', noteT: 0, next, fx: 0, pick: null, menu: null, arm: 0 }; mode = 'forge'; SFX.pick(); }
function updateForge() {
  const f = forge, L = forgeList(); if (f.noteT > 0) f.noteT--; if (f.fx > 0) f.fx--; f.i = Math.min(f.i, L.length - 1);
  const say = (t, ok) => { f.note = t; f.noteT = 110; f.ok = ok; };
  if (f.arm > 0) f.arm--;
  if (f.pick !== null) { // choosing an element (only while you carry none)
    if (isHit('up')) { f.pick = (f.pick + 2) % 3; SFX.pick(); }
    if (isHit('down')) { f.pick = (f.pick + 1) % 3; SFX.pick(); }
    if (isHit('back')) { f.pick = null; return; }
    if (isHit('start') || isHit('atk')) {
      const el = ELEMS[f.pick]; rpg.elem = el; rpg.et = Math.min(1, elemAvail()); rpg.eg = 0; f.pick = null; PS = null; heroStats(false); saveGame(); SFX.magic(); f.fx = 40; say(tr('ELEMENT CHOSEN:') + ' ' + tr(ELEM[el].name), true);
    }
    return;
  }
  if (f.menu !== null) { // your element: upgrade a tier, or dismiss it for a refund
    if (isHit('up') || isHit('down')) { f.menu ^= 1; f.arm = 0; SFX.pick(); }
    if (isHit('back')) { f.menu = null; f.arm = 0; return; }
    if (isHit('start') || isHit('atk')) {
      if (f.menu === 0) {
        const nt = (rpg.et | 0) + 1, cost = elemTierCost(nt);
        if (nt > 10) say('YOUR ELEMENT IS AT ITS PEAK', false);
        else if (nt > elemAvail()) say(nt > 7 ? 'REACH PARAGON ' + (nt - 7) * 10 + ' FIRST' : 'REACH LEVEL ' + nt * 10 + ' FIRST', false);
        else if (rpg.gold < cost) { say('NOT ENOUGH GOLD', false); SFX.land(); }
        else { rpg.gold -= cost; rpg.eg = (rpg.eg | 0) + cost; rpg.et = nt; PS = null; heroStats(false); saveGame(); SFX.magic(); f.fx = 40; say(tr(ELEM[rpg.elem].name) + ' ' + tr('TIER') + ' ' + ROMAN[nt] + '!', true); }
      } else if (f.arm > 0) {
        const back = elemRefund(); rpg.gold += back; rpg.elem = null; rpg.et = 0; rpg.eg = 0; f.menu = null; f.arm = 0; PS = null; heroStats(false); saveGame(); SFX.land(); say(tr('ELEMENT DISMISSED.') + ' +' + back + ' ' + tr('GOLD BACK'), true);
      } else { f.arm = 200; say('PRESS ENTER AGAIN TO DISMISS IT FOR GOOD', false); }
    }
    return;
  }
  if (isHit('up')) { f.i = (f.i + L.length - 1) % L.length; SFX.pick(); }
  if (isHit('down')) { f.i = (f.i + 1) % L.length; SFX.pick(); }
  const leave = () => { const n = f.next; forge = null; mode = 'play'; saveGame(); n(); };
  if (isHit('back')) { leave(); return; }
  if (!(isHit('start') || isHit('atk'))) return;
  const o = L[f.i]; if (o.go) { leave(); return; }
  if (o.el) { if (rpg.elem) f.menu = 0; else f.pick = 0; SFX.pick(); return; }
  const it = o.it, up = it.up | 0;
  if (up >= forgeCap()) { say(up >= MAX_UP ? 'ALREADY AT +10 (MAX)' : 'CLEAR EMBER TRIAL ' + ROMAN_T[up - 6] + ' TO FORGE +' + (up + 1), false); SFX.land(); return; }
  const c = forgeCost(it); if (rpg.gold < c) { say('NOT ENOUGH GOLD', false); SFX.land(); return; }
  rpg.gold -= c;
  if (Math.random() < FORGE_P[up]) { it.up = up + 1; PS = null; heroStats(false); say(tr('SUCCESS!') + '  ' + tr(it.name) + ' +' + it.up, true); SFX.magic(); f.fx = 40; }
  else { say('THE FORGE FAILED. THE GOLD IS GONE', false); SFX.die(); f.fx = -1; }
  saveGame();
}
function drawForge() {
  const f = forge, L = forgeList(); g.fillStyle = 'rgba(10,4,2,0.92)'; g.fillRect(0, 0, W, H);
  const gl = g.createRadialGradient(130, 250, 10, 130, 250, 200); gl.addColorStop(0, 'rgba(255,110,30,0.22)'); gl.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  text('THE BLACKSMITH', W / 2, 24, 14, '#ff9a4a', 'center'); text('FORGE YOUR GEAR UP TO +7 FOR GOLD', W / 2, 36, 8, '#e0b890', 'center');
  text('GOLD ' + rpg.gold, W - 14, 24, 11, '#ffd24a', 'right');
  g.fillStyle = 'rgba(255,140,60,0.35)'; g.fillRect(16, 42, W - 32, 1);
  if (L.length === 1) text('NOTHING TO FORGE', 133, 62, 8, '#8a7a6a', 'center');
  const top = Math.max(0, f.i - 6); // scrolls once the list outgrows the screen
  L.forEach((o, i) => {
    if (i < top) return; const y = 62 + (L.length === 1 ? 1 : i - top) * 20, sel = i === f.i; if (y > 200) return;
    if (sel) { g.fillStyle = 'rgba(255,140,60,0.18)'; g.fillRect(14, y - 11, 238, 17); g.strokeStyle = '#ff9a4a'; g.strokeRect(14.5, y - 10.5, 237, 16); }
    if (o.go) { text((sel ? '> ' : '  ') + 'BACK TO THE ROAD', 20, y, 8, '#9fd0ff'); return; }
    if (o.el) { const E = rpg.elem && ELEM[rpg.elem];
      text((sel ? '> ' : '  ') + (E ? tr('ELEMENT') + ': ' + tr(E.name) + ' ' + ROMAN[elemTier()] : tr('CHOOSE YOUR ELEMENT')), 20, y, 8, E ? E.col : '#ffd24a');
      { const nt = (rpg.et | 0) + 1, can = rpg.elem && nt <= elemAvail();
      text(!rpg.elem ? 'FREE' : can ? elemTierCost(nt) + 'G' : rpg.et >= 7 ? 'MAX' : '', 246, y, 8, !rpg.elem || (can && rpg.gold >= elemTierCost(nt)) ? '#ffd24a' : can ? '#ff6a6a' : '#8a7a6a', 'right');
      } return; }
    const it = o.it, nm = iname(it), mx = (it.up | 0) >= forgeCap();
    if (o.worn) { text('E', 8, y, 7, '#c9a8ff'); g.fillStyle = 'rgba(160,120,255,0.28)'; g.fillRect(172, y - 7, 40, 10); text('EQUIPPED', 192, y, 6, '#d9c4ff', 'center'); }
    text((sel ? '> ' : '  ') + nm, 20, y, nm.length > 22 ? 7 : 8, itemCol(it));
    text(mx ? 'MAX' : forgeCost(it) + 'G', 246, y, 8, mx ? '#8a7a6a' : rpg.gold >= forgeCost(it) ? '#ffd24a' : '#ff6a6a', 'right');
  });
  // anvil and hammer
  const ax = 92, ay = 238; g.fillStyle = '#2a2428'; g.fillRect(ax - 26, ay - 14, 52, 9); g.fillRect(ax - 12, ay - 5, 24, 10); g.fillRect(ax - 20, ay + 5, 40, 6); g.fillStyle = '#5a5258'; g.fillRect(ax - 26, ay - 14, 52, 2); g.fillRect(ax - 34, ay - 12, 10, 4);
  const hs = f.fx > 0 ? Math.sin(f.fx * 0.6) * 0.8 : -0.4; g.save(); g.translate(ax + 34, ay - 30); g.rotate(hs); g.fillStyle = '#5a3a22'; g.fillRect(-2, -2, 4, 26); g.fillStyle = '#6a6e78'; g.fillRect(-9, -8, 18, 9); g.fillStyle = '#9aa0aa'; g.fillRect(-9, -8, 18, 2); g.restore();
  if (f.fx > 0 && f.fx % 3 === 0) for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffd070' : '#ff8a2a'; g.fillRect(ax + rnd(-20, 20), ay - 16 - rnd(0, 26), 2, 2); }
  const o = L[f.i];
  g.fillStyle = 'rgba(30,16,10,0.9)'; g.fillRect(262, 50, 204, 178); g.strokeStyle = '#c96a2e'; g.strokeRect(262.5, 50.5, 203, 177);
  if (o && o.el) {
    const E = rpg.elem && ELEM[rpg.elem], T = elemTier();
    if (f.pick !== null) {
      text('PICK AN ELEMENT', 364, 64, 9, '#ffd24a', 'center');
      ELEMS.forEach((k, i) => { const y = 84 + i * 30, sel = i === f.pick; if (sel) { g.fillStyle = 'rgba(255,140,60,0.2)'; g.fillRect(268, y - 11, 192, 26); }
        text((sel ? '> ' : '  ') + ELEM[k].name, 272, y, 9, ELEM[k].col); text(ELEM[k].info, 276, y + 11, 7, '#c8b8a0'); });
      text('THE FIRST CHOICE IS FREE', 364, 184, 8, '#ffb46a', 'center');
      text('IT STARTS AT TIER I. BUY MORE WITH GOLD', 364, 196, 7, '#a89078', 'center'); text('ENTER CHOOSE   ESC BACK', 364, 214, 7, '#a89078', 'center');
    } else {
      text(E ? E.name + '  TIER ' + ROMAN[T] : 'NO ELEMENT YET', 364, 64, 9, E ? E.col : '#ffd24a', 'center');
      if (E) ELEM_TIERS[rpg.elem].forEach((d, i) => text(ROMAN[i + 1] + (i < 7 ? '  LV ' + (i + 1) * 10 : '  PARAGON ' + (i - 6) * 10) + '  ' + d, 270, 76 + i * 9, 7, i < T ? E.col2 : '#6a5a50'));
      else { text('FIRE   FROST   LIGHTNING', 364, 90, 8, '#e0c8a0', 'center'); text('HITS BUILD UP A STATUS ON FOES', 364, 110, 7, '#c8b8a0', 'center'); text('A NEW TIER EVERY 10 LEVELS', 364, 122, 7, '#c8b8a0', 'center'); }
      if (E) {
        const nt = (rpg.et | 0) + 1, can = nt <= elemAvail(), sel0 = f.menu === 0, sel1 = f.menu === 1;
        const up = nt > 10 ? 'PEAK REACHED' : can ? 'UPGRADE TO TIER ' + ROMAN[nt] + '   ' + elemTierCost(nt) + 'G' : nt > 7 ? 'NEXT TIER AT PARAGON ' + (nt - 7) * 10 : 'NEXT TIER AT LEVEL ' + nt * 10;
        if (f.menu !== null) { g.fillStyle = 'rgba(255,140,60,0.2)'; g.fillRect(266, (sel0 ? 168 : 182), 196, 14); }
        text((sel0 ? '> ' : '  ') + up, 270, 178, 7, nt <= 10 && can ? (rpg.gold >= elemTierCost(nt) ? '#ffd24a' : '#ff6a6a') : '#8a7a6a');
        text((sel1 ? '> ' : '  ') + 'DISMISS ELEMENT   +' + elemRefund() + 'G BACK', 270, 192, 7, f.arm > 0 ? '#ff8a6a' : '#c8b8a0');
        text(f.menu !== null ? 'ENTER CONFIRM   ESC BACK' : 'ENTER TO MANAGE', 364, 214, 7, '#a89078', 'center');
      } else text('ENTER TO CHOOSE', 364, 214, 7, '#a89078', 'center');
    }
  } else if (o && !o.go) {
    const it = o.it, up = it.up | 0; const ty = drawTip(it, undefined, 258, 36, !!it.set);
    if (o.worn) { g.fillStyle = 'rgba(160,120,255,0.3)'; g.fillRect(398, 56, 62, 12); text('EQUIPPED', 429, 65, 7, '#e4d6ff', 'center'); }
    if (up < forgeCap()) {
      const a = itemSt(it), b = itemSt(it, up + 1), ds = [];
      for (const k of STAT_KEYS) { const d = (b[k] || 0) - (a[k] || 0); if (d) ds.push('+' + d + STATS[k].sfx + ' ' + statName(k)); }
      const tight = ty + 12 + ds.length * 11 > 224; // long item: pack the gains two to a row so nothing runs over the tooltip
      let yy = Math.min(tight ? 197 : 170, 226 - (tight ? 9 * Math.ceil(ds.length / 2) : ds.length * 11) - 10);
      yy = Math.max(yy, ty + 6);
      g.fillStyle = 'rgba(255,140,60,0.35)'; g.fillRect(268, yy - 9, 192, 1);
      text('FORGE TO +' + (up + 1) + '    CHANCE ' + Math.round(FORGE_P[up] * 100) + '%', 270, yy, 8, '#ffb46a'); yy += tight ? 10 : 12;
      if (tight) { for (let i = 0; i < ds.length; i += 2) { text(ds[i], 270, yy, 7, '#7aff9a'); if (ds[i + 1]) text(ds[i + 1], 366, yy, 7, '#7aff9a'); yy += 9; } }
      else for (const d of ds) { text(d, 270, yy, 8, '#7aff9a'); yy += 11; }
    } else text(up >= MAX_UP ? 'FULLY FORGED' : 'CLEAR EMBER TRIAL ' + ROMAN_T[up - 6] + ' TO FORGE +' + (up + 1), 364, 190, up >= MAX_UP ? 9 : 7, '#ffd24a', 'center');
  } else text('BACK TO THE ROAD', 364, 130, 8, '#d9c9f0', 'center');
  if (f.noteT > 0) text(f.note, W / 2, 236, 9, f.ok ? '#7aff9a' : '#ff8a6a', 'center');
  text(f.pick !== null || f.menu !== null ? 'W/S CHOOSE   ENTER CONFIRM   ESC BACK' : 'W/S CHOOSE   ENTER FORGE   ESC LEAVE', W / 2, 252, 8, '#c8a890', 'center');
  text('FAILED FORGING KEEPS THE LEVEL BUT TAKES THE GOLD', W / 2, 264, 7, '#8a6a5a', 'center');
}
function openShop(next) {
  const mk = i => { // the market always has a little mythic and legendary luck, on top of the stage drop rates
    let r = rollRarity(); if (i === 0 && tierOf() >= 1) r = Math.max(1, r);
    if (stageIdx >= 2 || cycle) { const x = Math.random(); if (i === 3) r = x < 0.06 ? 4 : x < 0.3 ? 3 : x < 0.6 ? 2 : Math.max(1, r); else if (x < 0.02) r = 4; else if (x < 0.09) r = Math.max(r, 3); else if (x < 0.22) r = Math.max(r, 2); }
    return genItem(r);
  };
  shop = { i: 0, note: '', noteT: 0, next, stock: [
    { kind: 'heal', name: 'FULL HEAL', price: 80, info: 'RESTORES THE WHOLE PARTY' },
    { kind: 'coin', name: 'CONTINUE COIN', price: coinPrice(), info: 'AN EXTRA LIFE (MAX 9)' },
    ...[0, 1, 2, 3].map(i => { const it = mk(i); return { kind: 'gear', it, name: it.name, price: itemPrice(it), prem: i === 3 }; }),
    { kind: 'go', name: 'LEAVE THE MARKET', price: 0 }
  ] };
  mode = 'shop'; SFX.pick();
}
function updateShop() {
  const s = shop; if (s.noteT > 0) s.noteT--;
  if (isHit('inv')) { openInv('shop'); return; }
  if (isHit('up')) { s.i = (s.i + s.stock.length - 1) % s.stock.length; SFX.pick(); }
  if (isHit('down')) { s.i = (s.i + 1) % s.stock.length; SFX.pick(); }
  if (!(isHit('start') || isHit('atk'))) return;
  const o = s.stock[s.i], say = t => { s.note = t; s.noteT = 90; };
  if (o.kind === 'go') { const n = s.next; shop = null; mode = 'play'; n(); return; }
  if (o.sold) { say('SOLD OUT'); return; }
  if (o.kind === 'coin' && rpg.coins >= MAX_COINS) { say('COINS ARE FULL'); return; }
  if (rpg.gold < o.price) { say('NOT ENOUGH GOLD'); SFX.land(); return; }
  if (o.kind === 'gear' && rpg.bag.length >= BAG_MAX && (rpg.eq[o.it.slot] || !canWear(o.it))) { say('PACK FULL'); return; }
  rpg.gold -= o.price; SFX.pick();
  if (o.kind === 'heal') { for (const p of players()) { p.dead = false; p.fade = 0; p.hp = p.maxhp; } say('PARTY HEALED'); }
  else if (o.kind === 'coin') { rpg.coins++; o.price = coinPrice(); say('+1 CONTINUE COIN'); }
  else { pickupGear(o.it, true); o.sold = true; say('BOUGHT ' + o.name); }
  saveGame();
}
function drawShop() {
  const s = shop; g.fillStyle = 'rgba(6,3,12,0.9)'; g.fillRect(0, 0, W, H);
  text('THE EMBER MARKET', W / 2, 24, 14, '#ffb43a', 'center'); text('SPEND YOUR GOLD BEFORE THE NEXT STAGE', W / 2, 36, 8, '#c9a8ff', 'center');
  text('GOLD ' + rpg.gold, W - 14, 24, 11, '#ffd24a', 'right');
  g.fillStyle = 'rgba(255,180,60,0.35)'; g.fillRect(16, 42, W - 32, 1);
  s.stock.forEach((o, i) => {
    const y = 62 + i * 22, sel = i === s.i;
    if (sel) { g.fillStyle = 'rgba(255,180,60,0.18)'; g.fillRect(14, y - 11, 238, 18); g.strokeStyle = '#ffb43a'; g.strokeRect(14.5, y - 10.5, 237, 17); }
    const col = o.sold ? '#5a4a6a' : o.kind === 'gear' ? itemCol(o.it) : o.kind === 'go' ? '#9fd0ff' : '#ffffff';
    text((sel ? '> ' : '  ') + (o.prem ? '* ' : '') + o.name, 20, y, o.name.length > 20 ? 7 : 8, col);
    if (o.kind !== 'go') text(o.sold ? 'SOLD' : o.price + 'G', 246, y, 8, o.sold ? '#5a4a6a' : rpg.gold >= o.price ? '#ffd24a' : '#ff6a6a', 'right');
  });
  const o = s.stock[s.i];
  g.fillStyle = 'rgba(20,12,34,0.9)'; g.fillRect(262, 50, 204, 178); g.strokeStyle = '#c9962e'; g.strokeRect(262.5, 50.5, 203, 177);
  if (o.kind === 'gear') drawTip(o.it, rpg.eq[o.it.slot] || null, 258, 36); else if (o.info) text(o.info, 364, 130, 8, '#d9c9f0', 'center');
  else text('BACK TO THE ROAD', 364, 130, 8, '#d9c9f0', 'center');
  if (s.noteT > 0) text(s.note, 130, 224, 9, '#fff1b0', 'center');
  text('W/S CHOOSE   ENTER BUY   I GEAR', W / 2, 250, 8, '#b8a8c8', 'center');
  text('* PREMIUM SHELF: BEST ODDS FOR LEGENDARY AND MYTHIC    DUPLICATES BECOME GOLD', W / 2, 261, 6, '#8a7aa0', 'center');
}
