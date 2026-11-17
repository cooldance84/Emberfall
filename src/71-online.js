/* ---- the online daily board (Supabase REST): optional, the game works fully without it; the URL and the public anon key live in online-config.js ---- */
const ONL = (typeof window !== 'undefined' && window.EMBERFALL_ONLINE) || {};
const onlineOn = () => !!(ONL.url && ONL.key && typeof fetch === 'function') && !DEV;
let onlineBoard = { day: '', rows: null, at: 0, err: false, busy: false }, onlineSent = null, onlineSendErr = false;
const sbHeaders = extra => { const h = { apikey: ONL.key, 'Content-Type': 'application/json' }; if (!/^sb_/.test(ONL.key)) h.Authorization = 'Bearer ' + ONL.key; return Object.assign(h, extra); }; // the new sb_publishable_ keys go in apikey only; the old JWT anon key goes in both
function sbFetch(path, opt) { return fetch(String(ONL.url).replace(/\/+$/, '') + '/rest/v1/' + path, Object.assign({ headers: sbHeaders() }, opt)); }
/* what a run is remembered by: the element and the six pieces worn when it was signed (small, and checked again before it is shown) */
const buildOf = () => ({ el: rpg.elem || '', et: elemTier(), eq: EQ_ORDER.filter(sl => rpg.eq[sl]).map(sl => { const it = rpg.eq[sl]; return [sl, String(it.name || '').slice(0, 32), it.rar | 0, it.up | 0, it.set || '']; }) });
const cleanBuild = b => {
  if (!b || typeof b !== 'object' || !Array.isArray(b.eq)) return null;
  return { el: ELEMS.includes(b.el) ? b.el : '', et: clamp(b.et | 0, 0, 10), eq: b.eq.slice(0, 6).filter(a => Array.isArray(a) && SLOTS.includes(a[0])).map(a => [a[0],
    String(a[1] || '').toUpperCase().slice(0, 32), clamp(a[2] | 0, 0, RARITY.length - 1), clamp(a[3] | 0, 0, MAX_UP), SETS[a[4]] ? a[4] : '']) };
};
const fromRow = r => ({ n: String(r.name || '???'), h: r.hero, t: r.t | 0, lv: r.lv | 0, pg: r.pg | 0, st: r.stage | 0, c: r.cycle | 0, w: !!r.finished, s: 0, at: Date.parse(r.created_at) || 0, d: String(r.day || ''), b: cleanBuild(r.build) });
let buildCol = null; // does the table have the build column yet? null = not known, the game tries it and falls back to rows without it
const COLS = 'name,hero,t,lv,pg,stage,cycle,finished,created_at';
function loadOnlineBoard(force) {
  if (!onlineOn() || onlineBoard.busy) return;
  if (!force && onlineBoard.day === dayStr() && Date.now() - onlineBoard.at < 30000) return;
  const day = dayStr(); onlineBoard.busy = true;
  sbFetch('daily_scores?day=eq.' + day + '&select=' + COLS + (buildCol === false ? '' : ',build') + '&order=created_at.asc&limit=300').then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(a => { if (buildCol === null) buildCol = true; onlineBoard = { day, rows: a.map(fromRow).sort(dailyCmp), at: Date.now(), err: false, busy: false }; }) // every row is kept (up to 300): the hero filter and the counters use them all
    .catch(st => { if (st === 400 && buildCol !== false) { buildCol = false; onlineBoard.busy = false; loadOnlineBoard(true); return; } onlineBoard = { day, rows: onlineBoard.day === day ? onlineBoard.rows : null, at: Date.now(), err: true, busy: false }; });
}
let hof = { rows: null, at: 0, err: false, busy: false };
function loadHof(force) { // the Hall of Fame: the fastest finisher of each day, taken from the finished rows (newest days first)
  if (!onlineOn() || hof.busy) return;
  if (!force && hof.rows && Date.now() - hof.at < 60000) return;
  hof.busy = true;
  sbFetch('daily_scores?finished=eq.true&select=day,' + COLS + (buildCol === false ? '' : ',build') + '&order=day.desc,t.asc,created_at.asc&limit=300').then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(a => { if (buildCol === null) buildCol = true; const seen = {}, out = []; for (const r of a) { if (seen[r.day]) continue; seen[r.day] = 1; out.push(fromRow(r)); if (out.length >= 10) break; } hof = { rows: out, at: Date.now(), err: false, busy: false }; })
    .catch(st => { if (st === 400 && buildCol !== false) { buildCol = false; hof.busy = false; loadHof(true); return; } hof = { rows: hof.rows, at: Date.now(), err: true, busy: false }; });
}
function submitOnline(e) { // sent when a daily result is signed; a failure leaves it on this device's board only
  if (!onlineOn()) return; onlineSent = { n: e.n, t: e.t | 0, h: e.h }; onlineSendErr = false;
  const row = { day: dayStr(), name: e.n, hero: e.h, t: e.t | 0, lv: e.lv | 0, pg: e.pg | 0, stage: Math.min(35, e.st | 0), cycle: Math.min(11, Math.max(1, e.c | 0)), finished: !!e.w };
  const post = withBuild => sbFetch('daily_scores', { method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(withBuild ? Object.assign({ build: e.b || buildOf() },
    row) : row) }).then(r => { if (!r.ok) throw r.status; if (withBuild) buildCol = true; loadOnlineBoard(true); hof.at = 0; });
  post(buildCol !== false).catch(st => { if (st === 400 && buildCol !== false) { buildCol = false; return post(false); } throw st; }).catch(() => { onlineSendErr = true; }); // a table without the build column still takes the result
}
const modOfDay = ds => { const q = String(ds).split('-').map(Number); return Math.floor(Date.UTC(q[0], (q[1] || 1) - 1, q[2] || 1) / 86400000) % DAILY_MODS.length; };
/* ---- cloud save (Supabase RPC, v1.41): the heroes' sealed saves go up under a private sync code and come down on another device. The table is closed; only the two functions cloud_put / cloud_get are open, and they need the full 12-character code ---- */
const CLOUD_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_KEY = 'emberfall_cloud_code', SYNC_KEY = 'emberfall_cloud_sync';
const cloudNorm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cloudValid = s => /^[A-HJ-NP-Z2-9]{12}$/.test(s);
const cloudFmt = s => s ? s.replace(/(.{4})(?=.)/g, '$1-') : '';
function cloudNewCode() { const a = new Uint8Array(12); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 12; i++) a[i] = Math.random() * 256;
  } let s = ''; for (let i = 0; i < 12; i++) s += CLOUD_ALPHA[a[i] & 31]; return s; } // 256 is a multiple of 32, so every letter is equally likely
const cloudCode = () => { try { return cloudNorm(localStorage.getItem(CODE_KEY)); } catch (e) { return ''; } };
let cloud = { busy: false, msg: '', err: false, info: null, fetched: false, armed: '', armT: 0 }, cloudBtns = [];
const cloudMsg = (m, err) => { cloud.msg = m; cloud.err = !!err; };
const cloudSum = raw => { if (typeof raw !== 'string' || raw.length > 60000) return null; const o = checkSeal(raw); return o && o.lvl ? { lvl: clamp(o.lvl | 0, 1, MAX_LV), pg: clamp(o.pg | 0, 0, PG_MAX) } : null; }; // a tampered save (seal mismatch) counts as nothing, so it never travels
const cloudCrown = raw => { if (typeof raw !== 'string' || raw.length > 2000) return 0; const o = checkSeal(raw); return o && o.n > 0 ? Math.min(99999, o.n | 0) : 0; };
function cloudLocal() { // what this device holds
  const heroes = {}, crowns = {};
  for (const c of CLS_ORDER) { try { const raw = localStorage.getItem(saveKey(c)); if (cloudSum(raw)) heroes[c] = raw; const cr = localStorage.getItem(crownKey(c)); if (cloudCrown(cr)) crowns[c] = cr; } catch (e) { } }
  return { heroes, crowns };
}
function cloudRpc(fn, body) { return sbFetch('rpc/' + fn, { method: 'POST', body: JSON.stringify(body) }).then(r => r.ok ? r.json() : Promise.reject(r.status)); }
function cloudAct(kind) { // 'up' or 'down': the first press shows what is where, the second one does it (a first upload into an empty cloud goes at once)
  if (!onlineOn() || cloud.busy) return;
  if (cloud.armed === kind && cloud.armT > 0) { if (kind === 'up') cloudPut(); else cloudApply(); return; }
  let code = cloudCode();
  if (!code) {
    if (kind === 'down') { cloudMsg('ENTER YOUR SYNC CODE FIRST', true); return; }
    code = cloudNewCode(); try { localStorage.setItem(CODE_KEY, code); } catch (e) { cloudMsg('THIS DEVICE CANNOT STORE THE CODE', true); return; }
  }
  cloud.busy = true; cloud.armed = ''; cloudMsg('ASKING THE CLOUD...', false);
  cloudRpc('cloud_get', { p_code: code }).then(d => {
    cloud.busy = false; cloud.fetched = true; cloud.info = d && typeof d === 'object' && d.heroes && typeof d.heroes === 'object' ? d : null; cloudMsg('', false);
    if (!cloud.info) { if (kind === 'down') cloudMsg('NOTHING IN THE CLOUD FOR THIS CODE', true); else cloudPut(); return; }
    cloud.armed = kind; cloud.armT = 900;
  }).catch(() => { cloud.busy = false; cloudMsg('CANNOT REACH THE CLOUD', true); });
}
function cloudPut() {
  const code = cloudCode(), L = cloudLocal(), C = cloud.info || { heroes: {}, crowns: {} }; cloud.armed = '';
  if (!code || !Object.keys(L.heroes).length) { cloudMsg('NO HERO TO SEND YET', true); return; }
  const heroes = Object.assign({}, C.heroes), crowns = Object.assign({}, C.crowns); // heroes this device does not have stay in the cloud
  for (const c in L.heroes) heroes[c] = L.heroes[c];
  for (const c in L.crowns) if (cloudCrown(L.crowns[c]) >= cloudCrown(crowns[c])) crowns[c] = L.crowns[c]; // crowns only ever grow
  const at = Date.now(), data = { v: 1, at, heroes, crowns }; cloud.busy = true; cloudMsg('SAVING...', false);
  cloudRpc('cloud_put', { p_code: code, p_data: data }).then(() => { cloud.busy = false; cloud.info = data; cloud.fetched = true; try { localStorage.setItem(SYNC_KEY, String(at)); } catch (e) { } cloudMsg('SAVED TO THE CLOUD', false); })
    .catch(() => { cloud.busy = false; cloudMsg('COULD NOT SAVE TO THE CLOUD', true); });
}
function cloudApply() {
  const C = cloud.info; cloud.armed = ''; if (!C || !C.heroes) { cloudMsg('NOTHING TO LOAD', true); return; }
  let n = 0;
  for (const c of CLS_ORDER) {
    try {
      const raw = C.heroes[c]; if (cloudSum(raw)) { localStorage.setItem(saveKey(c), raw); n++; }
      const cr = C.crowns && C.crowns[c]; if (cloudCrown(cr) > cloudCrown(localStorage.getItem(crownKey(c)))) localStorage.setItem(crownKey(c), cr);
    } catch (e) { }
  }
  if (!n) { cloudMsg('NOTHING TO LOAD', true); return; }
  crownMemo = {}; PS = null; loadGame(); heroStats(true);
  try { localStorage.setItem(SYNC_KEY, String(C.at | 0)); } catch (e) { }
  cloudMsg('HEROES LOADED FROM THE CLOUD', false);
}
function cloudEnterCode() {
  let s = null; try { if (typeof prompt === 'function') s = prompt(tr('SYNC CODE FROM YOUR OTHER DEVICE (OR NEW FOR A FRESH ONE)'), cloudFmt(cloudCode())); } catch (e) { }
  if (s == null) return; s = cloudNorm(s); if (s === 'NEW') s = cloudNewCode(); // typing NEW makes a fresh code
  if (!cloudValid(s)) { cloudMsg('THAT IS NOT A SYNC CODE', true); return; }
  try { localStorage.setItem(CODE_KEY, s); } catch (e) { cloudMsg('THIS DEVICE CANNOT STORE THE CODE', true); return; }
  cloud.info = null; cloud.fetched = false; cloud.armed = ''; cloudMsg('CODE SET - UPLOAD OR DOWNLOAD NOW', false);
}
function openCloud() { cloud.armed = ''; cloud.armT = 0; cloud.info = null; cloud.fetched = false; cloudMsg('', false); mode = 'cloud'; SFX.pick(); }
function updateCloud() {
  if (cloud.armT > 0 && --cloud.armT === 0) cloud.armed = '';
  if (isHit('back')) { mode = 'title'; return; }
  if (pressed.Digit1 || pressed.Numpad1) cloudAct('up');
  else if (pressed.Digit2 || pressed.Numpad2) cloudAct('down');
  else if (pressed.Digit3 || pressed.Numpad3) cloudEnterCode();
  else if (isHit('start') && cloud.armed) cloudAct(cloud.armed);
}
function cloudClick(x, y) { const b = cloudBtns.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (!b) return; if (b.k === 'up' || b.k === 'down') cloudAct(b.k); else if (b.k === 'code') cloudEnterCode(); else mode = 'title'; }
const fmtAt = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function drawCloud() {
  g.fillStyle = 'rgba(4,2,10,0.8)'; g.fillRect(0, 0, W, H);
  text('CLOUD SAVE', W / 2, 26, 16, '#8cc4ff', 'center');
  text('TAKE YOUR HEROES FROM YOUR PHONE TO YOUR PC AND BACK', W / 2, 40, 8, '#c9d8f0', 'center');
  const on = onlineOn(), code = cloudCode(), L = cloudLocal(), C = cloud.info;
  if (!on) text('THE ONLINE FEATURES ARE NOT SET UP', W / 2, 130, 9, '#ff9a6a', 'center');
  else {
    text('YOUR SYNC CODE', W / 2, 58, 8, '#c9a86a', 'center');
    text(code ? cloudFmt(code) : '---- ---- ----', W / 2, 76, 14, code ? '#ffd24a' : '#6a5a80', 'center');
    text('KEEP IT SECRET: ANYONE WITH THE CODE CAN LOAD YOUR HEROES', W / 2, 88, 7, '#8a7a9a', 'center');
    text('HERO', 110, 108, 8, '#8a7a9a'); text('THIS DEVICE', 215, 108, 8, '#8a7a9a'); text('CLOUD', 340, 108, 8, '#8a7a9a');
    CLS_ORDER.forEach((c, i) => {
      const y = 123 + i * 14, a = cloudSum(L.heroes[c]), b = C ? cloudSum(C.heroes && C.heroes[c]) : null, sm = s => s ? 'LV ' + s.lvl + '  PG ' + s.pg : '-';
      text(CLASSES[c].name, 110, y, 9, CLASSES[c].col); text(sm(a), 215, y, 9, a ? '#fff1d0' : '#6a5a80'); text(cloud.fetched ? sm(b) : '?', 340, y, 9, b ? '#8cc4ff' : '#6a5a80');
    });
    if (cloud.fetched && C && C.at) text('CLOUD COPY FROM ' + fmtAt(C.at), W / 2, 172, 7, '#8a7a9a', 'center');
    if (cloud.armed === 'up') text('THIS REPLACES THE CLOUD COPY. PRESS UPLOAD AGAIN TO CONFIRM.', W / 2, 190, 8, '#ffd24a', 'center');
    else if (cloud.armed === 'down') text('THIS REPLACES THE HEROES ON THIS DEVICE. PRESS DOWNLOAD AGAIN.', W / 2, 190, 8, '#ffd24a', 'center');
    else if (cloud.msg) text(cloud.msg, W / 2, 190, 8, cloud.err ? '#ff8a6a' : '#9ad08a', 'center');
    else text('FIRST DEVICE: UPLOAD.  OTHER DEVICE: ENTER THE CODE, THEN DOWNLOAD.', W / 2, 190, 7, '#8a7a9a', 'center');
  }
  { const tc = !!window.touchActive, defs = tc ? [['UPLOAD', 'up', 66], ['DOWNLOAD', 'down', 80], ['CODE', 'code', 56], ['BACK', 'back', 56]] : [['UPLOAD (1)', 'up', 100], ['DOWNLOAD (2)', 'down', 108], ['ENTER CODE (3)', 'code', 124], ['BACK (ESC)', 'back', 92]];
    // on a phone the stick and the buttons sit at the screen edges, so the row stays in the middle
    let tw = 6 * (defs.length - 1); for (const d of defs) tw += d[2]; let bx = (tc ? 205 : W / 2) - tw / 2; cloudBtns = defs.map(d => { const b = { x: Math.round(bx), y: 206, w: d[2], h: 16, t: d[0], k: d[1] }; bx += d[2] + 6; return b; }); }
  for (const b of cloudBtns) { const dis = !on && b.k !== 'back'; g.fillStyle = 'rgba(30,24,60,0.9)'; g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = dis ? '#4a4a5a' : b.k === 'back' ? '#8a7a9a' : '#8cc4ff'; g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    text(b.t, b.x + b.w / 2, b.y + 11, 8, dis ? '#6a6a7a' : '#fff', 'center'); }
  if (cloud.busy) text('...', W / 2, 250, 9, '#8cc4ff', 'center');
}
function paceInfo() { // the day's fastest finish on the online board, the time to beat; { none: true } when the board is loaded and nobody has finished, null when there is no board to look at
  if (!onlineOn() || onlineBoard.day !== dayStr() || !onlineBoard.rows) return null;
  const w = onlineBoard.rows.find(r => r.w); return w ? { n: w.n, t: w.t } : { none: true };
}
const dayMod = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) % DAILY_MODS.length; };
const dailyIs = n => !!daily && DAILY_MODS[daily.mod].name === n;
const boardKeyFor = v => v ? 'emberfall_board_daily_' + dayStr() : BOARD_KEY;
function saveGame() { if (daily || DEV) return; try { localStorage.setItem(saveKey(), seal({ v: 3, lvl: rpg.lvl, xp: rpg.xp, bag: rpg.bag, eq: rpg.eq, ini: rpg.ini, elem: rpg.elem, et: rpg.et, eg: rpg.eg, tr: rpg.tr | 0, pg: rpg.pg | 0, pxp: Math.round(rpg.pxp) || 0 })); } catch (e) { } }
function migrateSave(o) { // v1 saves knew no rare tier: legendary was 2, mythic 3
  if (!o || o.v >= 2) return o;
  const up = it => { if (it && typeof it.rar === 'number' && it.rar >= 2) it.rar++; };
  (Array.isArray(o.bag) ? o.bag : []).forEach(up); if (o.eq) for (const k in o.eq) up(o.eq[k]); o.v = 2; return o;
}
function loadGame() {
  try {
    const o = migrateSave(unseal(localStorage.getItem(saveKey()), saveKey())); loadedCls = CLS;
    if (o && o.lvl) {
      rpg.lvl = clamp(o.lvl | 0, 1, MAX_LV); rpg.xp = Math.max(0, +o.xp || 0); rpg.elem = ELEMS.includes(o.elem) ? o.elem : null;
      rpg.et = o.et == null ? (rpg.elem ? clamp(Math.floor(rpg.lvl / 10), 0, 7) : 0) : clamp(o.et | 0, 0, 10); rpg.eg = Math.max(0, o.eg | 0);
        rpg.tr = clamp(o.tr | 0, 0, TRIAL_MAX); rpg.pg = clamp(o.pg | 0, 0, PG_MAX); rpg.pxp = Math.max(0, +o.pxp || 0); // older saves keep the tiers they had earned
      rpg.bag = (Array.isArray(o.bag) ? o.bag : []).filter(validItem).slice(0, BAG_MAX); sortBag();
      rpg.eq = {}; for (const s of SLOTS) if (o.eq && validItem(o.eq[s]) && o.eq[s].slot === s) rpg.eq[s] = o.eq[s];
      rpg.ini = String(o.ini || 'AAA').toUpperCase().replace(/[^A-Z]/g, 'A').padEnd(3, 'A').slice(0, 3);
    }
  } catch (e) { }
}
function loadBoard(v) { try { const bv = v == null ? (daily ? 1 : 0) : v, a = JSON.parse(localStorage.getItem(boardKeyFor(bv)) || '[]');
  return Array.isArray(a) ? a.filter(e => e && typeof e.s === 'number').map(e => bv && typeof e.t !== 'number' ? Object.assign({}, e, { w: false, pg: e.pg | 0 }) : e).slice(0, 10) : [];
  } catch (e) { return []; } }
function saveBoard(b) { if (DEV) return; try { localStorage.setItem(boardKeyFor(daily ? 1 : 0), JSON.stringify(b.slice(0, 10))); } catch (e) { } }
loadGame();
