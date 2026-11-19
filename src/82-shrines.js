/* ---------- shrines: now and then one stands by the road; strike it for a blessing the whole party shares ---------- */
const BUFFS = {
  haste: { name: 'SHRINE OF HASTE', short: 'HASTE', col: '#9affb8', t: 1500, w: 20, info: 'FASTER MOVES AND ATTACKS' },
  fury: { name: 'SHRINE OF FURY', short: 'FURY', col: '#ff7a4a', t: 1500, w: 20, info: '+30% DAMAGE' },
  ward: { name: 'SHRINE OF WARDING', short: 'WARD', col: '#6ab8ff', t: 2400, w: 20, info: 'A BARRIER SOAKS THE BLOWS' },
  wisdom: { name: 'SHRINE OF WISDOM', short: 'WISDOM', col: '#c8a8ff', t: 1800, w: 15, info: '+50% KILL XP' },
  fortune: { name: 'SHRINE OF FORTUNE', short: 'FORTUNE', col: '#ffd24a', t: 1800, w: 15, info: 'MORE GOLD AND LOOT' },
  surge: { name: 'SHRINE OF SURGE', short: 'SURGE', col: '#ff8ad8', t: 1500, w: 15, info: '+40% ELEMENT POWER' }
};
const SACRED = { name: 'SACRED SHRINE', short: 'SACRED', col: '#ffe27a', info: 'INVULNERABLE FOR 4 SECONDS' };
function rollBuff() { // a blessing that is already running is never rolled again, so a new shrine adds to the others instead of replacing one
  const ids = Object.keys(BUFFS).filter(k => (k !== 'surge' || elemTier() > 0) && !buffs.some(b => b.id === k)); // a surge is wasted without an element
  if (!ids.length) return Object.keys(BUFFS)[0];
  let r = rq() * ids.reduce((a, k) => a + BUFFS[k].w, 0);
  for (const k of ids) { r -= BUFFS[k].w; if (r <= 0) return k; }
  return ids[0];
}
function useShrine(sh) {
  if (sh.used || (bossRef && !bossRef.dead)) return; // the shrines fall silent once a boss is on the field
  sh.used = 1; sh.t = 0; sh.shake = 8; SFX.magic(); flashA = Math.max(flashA, 0.18); shake = Math.max(shake, 4);
  let B;
  if (sh.sacred) { B = SACRED; for (const p of players()) if (!p.dead) p.inv = Math.max(p.inv, 240); }
  else {
    const id = seeded('S' + stageIdx + '/' + cycle + '/' + sh.x, rollBuff), hp = Math.round(pstats().maxhp * 0.4); B = BUFFS[id];
    if (buffs.length >= MAX_BUFFS) { let k = 0; buffs.forEach((b, i) => { if (b.t < buffs[k].t) k = i; }); floatText(hero.x, hero.y - 76, BUFFS[buffs[k].id].short + ' FADES', '#9a9aaa', 8); buffs.splice(k, 1); } // only when all places are taken: the blessing with the least time left makes room
    buffs.push({ id, t: B.t, max: B.t, ward: id === 'ward' ? hp : 0, wmax: id === 'ward' ? hp : 0 });
  }
  jr('shrine'); if (!sh.sacred) jr('buffs', buffs.length);
  msg = B.name + '!'; msgT = 110; floatText(sh.x, sh.y - 58, B.info, B.col, 8);
  spawn(sh.x, sh.y, 26, 24, { c: [B.col, '#ffffff'], s0: 1, s1: 3.2, l0: 14, l1: 30, add: true, size: 2, up: 2.4, g: 0.05 });
}
function updateShrines() {
  for (const sh of shrines) { sh.t++; if (sh.shake > 0) sh.shake--; }
  for (const b of buffs) b.t--;
  buffs = buffs.filter((b, i) => {
    const broke = b.id === 'ward' && b.ward <= 0;
    if (b.t > 0 && !broke) return true;
    floatText(hero.x, hero.y - 64 - 10 * i, broke ? 'WARD SHATTERED' : BUFFS[b.id].short + ' ENDS', broke ? '#6ab8ff' : '#9a9aaa', 8); if (broke) SFX.shatter(); return false;
  });
}
function buffFx() { // a few motes in the blessing's colour drift up around each hero
  if (!buffs.length || tickN % 5) return;
  for (const b of buffs) { const B = BUFFS[b.id];
    for (const p of players()) { if (p.dead) continue;
      spawn(p.x + rnd(-10, 10), p.y, rnd(4, 40), b.id === 'ward' ? 2 : 1, { c: [B.col, '#ffffff'], l0: 12, l1: 22, add: true, size: 1, up: 0.8, g: -0.01 }); } }
}
function drawBuffHud() {
  if (!buffs.length || bonus) return; // the blessings sit side by side, centred under the top of the screen, 74 px each
  buffs.forEach((b, i) => { const B = BUFFS[b.id], wd = b.id === 'ward', cx = W / 2 + (i - (buffs.length - 1) / 2) * 74;
    text(B.short, cx - 33, 52, 8, B.col, 'left'); text(wd ? String(b.ward) : Math.ceil(b.t / 60) + 'S', cx + 33, 52, 8, '#ffffff', 'right');
    bar(cx - 33, 55, 66, 3, wd ? b.ward : b.t, wd ? b.wmax : b.max, B.col, '#1c1c24'); });
}
function drawShrines() {
  for (const sh of shrines) {
    const x = Math.round(sh.x - cam + (sh.shake > 0 ? (sh.shake % 2 ? 1 : -1) : 0)), y = Math.round(sh.y); if (x < -30 || x > W + 30) continue;
    const on = !sh.used, rgb = sh.sacred ? '255,226,122' : '154,220,255', cc = sh.sacred ? '#ffe27a' : '#9adcff';
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(x, y, 13, 4, 0, 0, 7); g.fill();
    if (on) { g.globalCompositeOperation = 'lighter'; glowDot(g, x, y - 28, 26 + Math.sin(sh.t * 0.08) * 3, rgb, 0.38); g.globalCompositeOperation = 'source-over'; }
    g.fillStyle = '#0a0610'; g.fillRect(x - 12, y - 7, 24, 7); g.fillRect(x - 6, y - 24, 12, 18); g.fillRect(x - 9, y - 28, 18, 5);
    g.fillStyle = '#5a5468'; g.fillRect(x - 11, y - 6, 22, 5); g.fillStyle = '#7a748a'; g.fillRect(x - 11, y - 6, 22, 1);
    g.fillStyle = '#48425a'; g.fillRect(x - 5, y - 23, 10, 17); g.fillStyle = '#6a647a'; g.fillRect(x - 5, y - 23, 2, 17);
    g.fillStyle = '#5a5468'; g.fillRect(x - 8, y - 27, 16, 4); g.fillStyle = '#7a748a'; g.fillRect(x - 8, y - 27, 16, 1);
    if (on) { // a pale flame hovers over the bowl, runes circling it
      const b = Math.sin(sh.t * 0.1) * 1.5;
      g.fillStyle = cc; g.fillRect(x - 2, Math.round(y - 37 + b), 4, 8); g.fillStyle = '#ffffff'; g.fillRect(x - 1, Math.round(y - 35 + b), 2, 4);
      for (let k = 0; k < 3; k++) { const a = sh.t * 0.05 + k * 2.09; g.fillStyle = cc; g.fillRect(Math.round(x + Math.cos(a) * 10), Math.round(y - 31 + Math.sin(a) * 3), 1, 1); }
      if (!(bossRef && !bossRef.dead) && players().some(p => !p.dead && Math.abs(p.x - sh.x) < 70 && Math.abs(p.y - sh.y) < 34)) text('STRIKE THE SHRINE', x, y - 50, 7, cc, 'center');
    } else { g.fillStyle = '#3a3646'; g.fillRect(x - 2, y - 31, 4, 3); }
  }
}
function openChest(c, att) {
  c.hp--; c.shake = 8; sparks(c.x, c.y, 8, false); SFX.hit();
  if (c.hp > 0) return;
  seeded('C' + stageIdx + '/' + cycle + '/' + c.x, () => {
    c.open = 1; jr('chest'); if (c.type === 'gold') jr('goldchest'); const gd = Math.round((20 + rq() * 20) * (1 + areaLv() * 0.1) * (1 + 0.25 * trialN()) * (c.type === 'gold' ? 3 : c.type === 'trap' ? 1.6 : 1) * (dailyIs('GOLD RUSH') ? 2 : 1) * (buffIs('fortune') ? 1.6 : 1));
      rpg.gold += gd; score += gd * 5; if (bonus) { bonus.gold += gd; bonus.opened++; }
    floatText(c.x, c.y - 24, '+' + gd + 'G', '#ffd24a', 9); SFX.pick();
    if (c.type === 'gold') { dropGear(c.x + 12, c.y, Math.max(2, rollRarity())); floatText(c.x, c.y - 36, 'GOLDEN CHEST!', '#fff1b0', 9); }
    if (c.type === 'trap') { // a mimic ambush: husks burst out of the shadows
      const n = 2 + (stageIdx >= 5 ? 1 : 0); for (let i = 0; i < n; i++) { const f = spawnFoe(i === 2 && stageIdx >= 5 ? 'b' : 'h', c.x + (i % 2 ? 40 : -40) + i * 6, false); f.y = clamp(c.y + (i - 1) * 8, Y_MIN, Y_MAX); }
      floatText(c.x, c.y - 36, 'IT WAS A TRAP!', '#ff6a6a', 9); SFX.big(); shake = Math.max(shake, 5); flashA = Math.max(flashA, 0.15);
    }
    spawn(c.x, c.y, 12, 18, { c: ['#ffd24a', '#fff1b0'], s0: 1, s1: 3, l0: 16, l1: 30, add: true, size: 2, up: 3, g: 0.12 });
    if (rq() < 0.15) items.push({ x: c.x + 10, y: c.y, t: 0, kind: 'meat' });
  });
}
function strike(att, box, dmg, kind, targets) {
  if (att.pn) for (const sh of shrines) {
    if (sh.used || att.hits.has(sh)) continue; const dx = (sh.x - att.x) * att.face;
    if (dx < box.x0 - 6 || dx > box.x1 + 6 || Math.abs(sh.y - att.y) > box.dy + 6 || att.z + box.z0 > 16) continue;
    att.hits.add(sh); useShrine(sh);
  }
  if (att.pn) for (const c of chests) {
    if (c.open || att.hits.has(c)) continue; const dx = (c.x - att.x) * att.face;
    if (dx < box.x0 - 6 || dx > box.x1 + 6 || Math.abs(c.y - att.y) > box.dy + 6 || att.z + box.z0 > 16) continue;
    att.hits.add(c); openChest(c, att);
  }
  for (const e of targets) {
    if (att.hits.has(e) || e.dead) continue;
    const dx = (e.x - att.x) * att.face;
    if (dx < box.x0 || dx > box.x1 || Math.abs(e.y - att.y) > box.dy) continue;
    if (att.z + box.z1 < e.z || att.z + box.z0 > e.z + e.h) continue;
    att.hits.add(e);
    if (att.pn) {
      const back = att.k.cls === 'luca' && sgn(att.x - e.x) === -e.face && e.kind !== 'imp';
      const r = rollHit(back ? dmg * 1.5 : dmg);
      if (back && !r.miss && !(e.barrier > 0)) floatText(e.x, e.y - e.z - e.h - 12, 'BACKSTAB', '#9affb8', 7);
      if (r.miss) { floatText(e.x, e.y - e.z - e.h * 0.8, 'MISS', '#9aa0b0', 8); continue; }
      const shielded = e.barrier > 0;
      if (hurt(e, r.d, kind, att)) {
        if (e.blockT === tickN) continue;
        if (!shielded && !e.dead) { const was = elemActive(e); elemHit(e, att, kind, r.crit); elemProc(e, att, r.d, !!att.sk); elemRekindle(e, att, was); }
        floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9, r.crit ? r.d + '!' : String(r.d), r.crit ? '#ffd24a' : '#ffffff', r.crit ? 12 : 8);
        if (r.crit) { shake = Math.max(shake, 5); freeze = Math.max(freeze, 4); sparks(e.x, e.y, e.z + e.h * 0.6, true); }
      }
    } else hurt(e, dmg, kind, att);
  }
}
function startAttack(f, n) {
  f.st = 'atk'; f.combo = n; f.t = 0; f.queued = false; f.hits.clear(); f.vx = f.face * 1.3;
  const cls = f.k && f.k.cls;
  if (cls === 'nolan' && n === 2) f.vx = f.face * 4.5; // the heavy finisher drives forward
  if (cls === 'luca') { // the rogue darts at the nearest foe ahead of him, so melee closes the gap by itself
    let tg = null, bd = 64;
    for (const o of enemies) { if (o.dead || o.kind === 'imp' || o.z > 24 || sgn(o.x - f.x) !== f.face || Math.abs(o.y - f.y) > 30) continue; const d = Math.abs(o.x - f.x); if (d < bd) { bd = d; tg = o; } }
    if (tg && bd > 30) { f.vx = f.face * Math.min(11, (bd - 28) / 5.2 + 1.3); f.y = clamp(f.y + clamp(tg.y - f.y, -6, 6), Y_MIN, Y_MAX); }
  }
}
const COMBO = [{ d: 15, a: 4, b: 8, dmg: 9, kind: 'hurt' }, { d: 15, a: 4, b: 8, dmg: 9, kind: 'hurt' }, { d: 25, a: 7, b: 12, dmg: 16, kind: 'down' }];
const LCOMBO = [{ d: 10, a: 3, b: 6, dmg: 6, kind: 'hurt' }, { d: 10, a: 3, b: 6, dmg: 6, kind: 'hurt' }, { d: 11, a: 3, b: 6, dmg: 7, kind: 'hurt' }, { d: 19, a: 5, b: 9, dmg: 12, kind: 'down' }];
const PCOMBO = [{ d: 16, a: 5, b: 8, dmg: 8, kind: 'hurt' }, { d: 16, a: 5, b: 8, dmg: 8, kind: 'hurt' }, { d: 28, a: 9, b: 12, dmg: 17, kind: 'down', big: true }];
const comboOf = f => f.k.cls === 'luca' ? LCOMBO : f.k.cls === 'panni' ? PCOMBO : COMBO;

