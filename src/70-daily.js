/* ---------- the season race (it began as the daily challenge): an endless race with a fresh level-1 hero and double XP;
   the goal is level 70 + 100 paragon, the shortest play time wins. A season is a calendar month with one rule; the board shows
   each player's best time, and the eternal board keeps the best of all seasons. Only a crown reaches your saved hero ---------- */
let daily = null, boardView = 0; // boardView 0 = all time (this device), 1 = this season's board, 2 = the eternal board
const DAILY_MODS = [
  { name: 'GOLD RUSH', info: 'ALL GOLD IS DOUBLED' },
  { name: 'GLASS CANNON', info: 'YOU HIT 50% HARDER, AND TAKE 50% MORE' },
  { name: 'IRON FOES', info: 'FOES HAVE 50% MORE LIFE, AND PAY 50% MORE XP' },
  { name: 'SWIFT FOES', info: 'EVERY MONSTER IS 20% FASTER' },
  { name: 'TREASURE SEASON', info: 'TWICE THE CHESTS, MORE GOLDEN ONES' }
];
const SEASON_FROM = '2026-11-19', SEASON_XP = 2; // the first season race: older rows were made under other rules and never count
const seasonStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const seasonFirst = () => { const s = seasonStr() + '-01'; return s < SEASON_FROM ? SEASON_FROM : s; };
const seasonLast = () => { const d = new Date(); return seasonStr() + '-' + String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0'); };
const seasonDaysLeft = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate(); }; // full days after today
const dayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtTime = f => { const t = Math.floor(f / 60), h = Math.floor(t / 3600); return h + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }; // play time h:mm:ss from 60 Hz frames
const dailyRunKey = c => 'emberfall_daily_run_' + seasonStr() + '_' + c;
const crownKey = c => 'emberfall_crown_' + c; let crownMemo = {};
function crownsOf(c) { if (crownMemo[c] === undefined) { let n = 0; try { const o = unseal(localStorage.getItem(crownKey(c)), crownKey(c)); n = o ? Math.max(0, o.n | 0) : 0; } catch (e) { } crownMemo[c] = n; } return crownMemo[c]; }
function grantCrown(c) { // winning the day earns the saved hero one crown (at most one a day per hero)
  if (DEV) return true;
  try { const k = crownKey(c), o = unseal(localStorage.getItem(k), k) || { n: 0, d: '' }; if (o.d === dayStr()) return false; localStorage.setItem(k, seal({ v: 3, n: (o.n | 0) + 1, d: dayStr() })); crownMemo[c] = (o.n | 0) + 1; return true; } catch (e) { return false; }
}
function dailyCmp(a, b) { // finished runs first (shortest play time wins), then whoever got furthest
  if (!!a.w !== !!b.w) return a.w ? -1 : 1;
  if (a.w) return ((a.t | 0) - (b.t | 0)) || ((a.at || 0) - (b.at || 0)); // equal play time: whoever got there first
  return ((b.lv | 0) - (a.lv | 0)) || ((b.pg | 0) - (a.pg | 0)) || (((b.c | 0) * 100 + (b.st | 0)) - ((a.c | 0) * 100 + (a.st | 0))) || ((a.t | 0) - (b.t | 0));
}
/* ---- past seasons: the archive and the champion titles come from the finished runs of the eternal board ---- */
const seasonNo = k => (+k.slice(0, 4) * 12 + +k.slice(5, 7)) - (+SEASON_FROM.slice(0, 4) * 12 + +SEASON_FROM.slice(5, 7)) + 1; // 2026-11 is season 1
const monthKey = (y, m) => y + '-' + String(m).padStart(2, '0');
function endedSeasons() { // newest first: every month since the first season that has finished
  const cur = seasonStr(); let y = +cur.slice(0, 4), m = +cur.slice(5, 7) - 1; const out = [];
  for (let n = 0; n < 240; n++) { if (m < 1) { m = 12; y--; } const k = monthKey(y, m); if (k < SEASON_FROM.slice(0, 7)) break; out.push(k); m--; }
  return out;
}
let champMemo = { at: -1, s: '', v: {} };
function champsOf() { // 'NAME|hero' -> [{ s: season number, p: place 1..3 }] for the seasons that are over
  if (!hof.all) return {}; if (champMemo.at === hof.at && champMemo.s === seasonStr()) return champMemo.v;
  const by = {}, v = {}; for (const r of hof.all) { const k = String(r.d).slice(0, 7); if (k >= seasonStr()) continue; (by[k] = by[k] || []).push(r); }
  for (const k of Object.keys(by).sort()) bestPer(by[k]).slice(0, 3).forEach((r, i) => { const id = r.n + '|' + r.h; (v[id] = v[id] || []).push({ s: seasonNo(k), p: i + 1 }); });
  champMemo = { at: hof.at, s: seasonStr(), v }; return v;
}
const PLACE_COL = ['', '#ffe27a', '#cfd8e6', '#d99a5a'], PLACE_TXT = ['', 'CHAMPION', '2ND PLACE', '3RD PLACE'];
/* ---- split times: the milestones of a race are timed, kept with the run and posted with the result ---- */
const SPLIT_KEYS = ['L10', 'L20', 'L30', 'L40', 'L50', 'L60', 'L70', 'P50'];
const splitName = k => (k[0] === 'L' ? 'LV ' : 'PG ') + k.slice(1);
const splitReached = k => k[0] === 'L' ? rpg.lvl >= +k.slice(1) : rpg.lvl >= MAX_LV && rpg.pg >= +k.slice(1);
const fmtDelta = d => { const t = Math.floor(Math.abs(d) / 60); return (d > 0 ? '+' : '-') + (t >= 3600 ? Math.floor(t / 3600) + ':' : '') + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
function splitsFrom(x) { // a stored string "L10:1234,L20:..." or an object; anything unknown or out of range is dropped
  const o = {}; if (typeof x === 'string') { x = x.length > 200 ? {} : Object.fromEntries(x.split(',').map(q => q.split(':'))); }
  if (x && typeof x === 'object') for (const k of SPLIT_KEYS) { const v = +x[k]; if (v > 0 && v < 1e9) o[k] = Math.floor(v); }
  return o;
}
const splitStr = sp => SPLIT_KEYS.filter(k => sp && sp[k]).map(k => k + ':' + sp[k]).join(',');
function splitLeader() { // the best finished run online that has splits: the pace to hold
  const rows = onlineOn() && onlineBoard.day === seasonStr() && onlineBoard.rows; return rows ? rows.find(r => r.w && r.sp && Object.keys(r.sp).length) || null : null;
}
function splitTick() { // once in a while during a race: stamp each milestone the moment it is reached
  if (!daily || daily.done) return; const sp = daily.sp || (daily.sp = {}), L = splitLeader();
  for (const k of SPLIT_KEYS) if (!sp[k] && splitReached(k)) {
    sp[k] = daily.t; if (k === 'L50') jr('race50'); const d = L && L.sp[k] ? daily.t - L.sp[k] : null; daily.last = { k, t: daily.t, d, n: L ? L.n : '' };
    floatText(hero.x, hero.y - 90, splitName(k) + '  ' + fmtTime(daily.t) + (d == null ? '' : '  ' + fmtDelta(d)), d == null ? '#ffd24a' : d > 0 ? '#ff8a6a' : '#9ad08a', 8); SFX.pick();
  }
}
function saveDailyRun(stage, over) { // the race is kept on this device for the day: it resumes from the start of the last stage
  if (!daily || DEV) return;
  try { localStorage.setItem(dailyRunKey(CLS), seal({ v: 3, d: daily.date, stage, cycle, t: daily.t | 0, over: !!over, done: !!daily.done, lvl: rpg.lvl, xp: rpg.xp,
    pg: rpg.pg | 0, pxp: Math.round(rpg.pxp) || 0, sp: daily.sp || {}, bag: rpg.bag, eq: rpg.eq, elem: rpg.elem, et: rpg.et, eg: rpg.eg, coins: rpg.coins, gold: rpg.gold, score }));
    } catch (e) { }
}
function loadDailyRun(c) { try { const k = dailyRunKey(c), o = unseal(localStorage.getItem(k), k); return o && o.d === seasonStr() && o.stage >= 0 && o.stage < STAGES.length ? o : null; } catch (e) { return null; } }
function applyDailyRun(o) {
  if (daily) daily.sp = splitsFrom(o.sp);
  rpg.lvl = clamp(o.lvl | 0, 1, MAX_LV); rpg.xp = Math.max(0, +o.xp || 0); rpg.pg = clamp(o.pg | 0, 0, PG_MAX); rpg.pxp = Math.max(0, +o.pxp || 0);
  rpg.bag = (Array.isArray(o.bag) ? o.bag : []).filter(validItem).slice(0, BAG_MAX); rpg.eq = {}; for (const sl of SLOTS) if (o.eq && validItem(o.eq[sl]) && o.eq[sl].slot === sl) rpg.eq[sl] = o.eq[sl];
  rpg.elem = ELEMS.includes(o.elem) ? o.elem : null; rpg.et = clamp(o.et | 0, 0, 10); rpg.eg = Math.max(0, o.eg | 0); rpg.coins = clamp(o.coins | 0, 0, MAX_COINS); rpg.gold = Math.max(0, o.gold | 0); score = Math.max(0, o.score | 0); cycle = clamp(o.cycle | 0, 0, TRIAL_MAX);
}
