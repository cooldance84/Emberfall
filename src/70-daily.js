/* ---------- daily challenge: an endless race with a fresh level-1 hero and one rule of the day; the goal is level 70 + 100 paragon, the shortest play time wins; it has its own leaderboard, and only a crown reaches your saved hero ---------- */
let daily = null, boardView = 0; // boardView 0 = all time, 1 = today's daily
const DAILY_MODS = [
  { name: 'GOLD RUSH', info: 'ALL GOLD IS DOUBLED' },
  { name: 'GLASS CANNON', info: 'YOU HIT 50% HARDER, AND TAKE 50% MORE' },
  { name: 'IRON FOES', info: 'FOES HAVE 50% MORE LIFE, AND PAY 50% MORE XP' },
  { name: 'SWIFT FOES', info: 'EVERY MONSTER IS 20% FASTER' },
  { name: 'TREASURE DAY', info: 'TWICE THE CHESTS, MORE GOLDEN ONES' }
];
const dayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtTime = f => { const t = Math.floor(f / 60), h = Math.floor(t / 3600); return h + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }; // play time h:mm:ss from 60 Hz frames
const dailyRunKey = c => 'emberfall_daily_run_' + dayStr() + '_' + c;
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
function saveDailyRun(stage, over) { // the race is kept on this device for the day: it resumes from the start of the last stage
  if (!daily || DEV) return;
  try { localStorage.setItem(dailyRunKey(CLS), seal({ v: 3, d: daily.date, stage, cycle, t: daily.t | 0, over: !!over, done: !!daily.done, lvl: rpg.lvl, xp: rpg.xp,
    pg: rpg.pg | 0, pxp: Math.round(rpg.pxp) || 0, bag: rpg.bag, eq: rpg.eq, elem: rpg.elem, et: rpg.et, eg: rpg.eg, coins: rpg.coins, gold: rpg.gold, score }));
    } catch (e) { }
}
function loadDailyRun(c) { try { const k = dailyRunKey(c), o = unseal(localStorage.getItem(k), k); return o && o.d === dayStr() && o.stage >= 0 && o.stage < STAGES.length ? o : null; } catch (e) { return null; } }
function applyDailyRun(o) {
  rpg.lvl = clamp(o.lvl | 0, 1, MAX_LV); rpg.xp = Math.max(0, +o.xp || 0); rpg.pg = clamp(o.pg | 0, 0, PG_MAX); rpg.pxp = Math.max(0, +o.pxp || 0);
  rpg.bag = (Array.isArray(o.bag) ? o.bag : []).filter(validItem).slice(0, BAG_MAX); rpg.eq = {}; for (const sl of SLOTS) if (o.eq && validItem(o.eq[sl]) && o.eq[sl].slot === sl) rpg.eq[sl] = o.eq[sl];
  rpg.elem = ELEMS.includes(o.elem) ? o.elem : null; rpg.et = clamp(o.et | 0, 0, 10); rpg.eg = Math.max(0, o.eg | 0); rpg.coins = clamp(o.coins | 0, 0, MAX_COINS); rpg.gold = Math.max(0, o.gold | 0); score = Math.max(0, o.score | 0); cycle = clamp(o.cycle | 0, 0, TRIAL_MAX);
}
