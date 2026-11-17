/* ---------- RPG: levels, loot, equipment, saves, leaderboard ---------- */
const MAX_LV = 70, SAVE_KEY = 'emberfall_save_v1', BOARD_KEY = 'emberfall_board_v1', BAG_MAX = 16;
/* ---------- fair play: saves carry a seal, so a hand-edited save is noticed (a deterrent, not a lock: the game runs on your device) ---------- */
const sigOf = str => { let h = 0x811c9dc5; const t = 'ashen|' + str; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const seal = o => { const body = JSON.stringify(o); return JSON.stringify(Object.assign({}, o, { s: sigOf(body) })); };
function checkSeal(raw) { // the save when it is intact, null when empty or broken, false when its seal does not match
  if (!raw) return null; let o; try { o = JSON.parse(raw); } catch (e) { return null; }
  if (!o || typeof o !== 'object' || !(o.v >= 3)) return o; // saves made before sealing stay valid and get sealed on the next save
  const s = o.s; delete o.s; return s === sigOf(JSON.stringify(o)) ? o : false;
}
function unseal(raw, key) { // a save that does not match its seal is set aside (kept under *_bad) and treated as empty
  const o = checkSeal(raw); if (o !== false) return o;
  try { localStorage.setItem(key + '_bad', raw); localStorage.removeItem(key); } catch (e) { } tamperT = 420; return null;
}
let tamperT = 0;
const DEV = (() => { try { return typeof location !== 'undefined' && /[?&]max(&|=|$)/.test(location.search) && (!location.hostname || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || localStorage.getItem('ef_dev') === 'ember'); } catch (e) { return false; } })();
  // test mode: ?max (and &stage=N), only on your own machine; nothing is saved
const devStage = () => { try { const m = /[?&]stage=(\d+)/.exec(location.search); return DEV && m ? clamp((+m[1] || 1) - 1, 0, STAGES.length - 1) : 0; } catch (e) { return 0; } };
function devMax() { if (!DEV) return; rpg.lvl = MAX_LV; rpg.xp = 0; rpg.pg = PG_MAX; rpg.pxp = 0; rpg.tr = TRIAL_MAX; rpg.gold = 999999; rpg.coins = MAX_COINS;
  if (!rpg.elem) rpg.elem = 'bolt'; rpg.et = 10; for (const sl of SLOTS) { if (!rpg.eq[sl]) rpg.eq[sl] = genItem(4, sl, MAX_LV); rpg.eq[sl].up = MAX_UP;
  } heroStats(true); }
const SLOTS = ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet'];
const EQ_ORDER = ['helm', 'armor', 'boots', 'weapon', 'ring', 'amulet'];
const SLOT_NAME = { weapon: 'WEAPON', helm: 'HELM', armor: 'ARMOR', boots: 'BOOTS', ring: 'RING', amulet: 'AMULET' };
const RARITY = [
  { name: 'COMMON', col: '#e6e6ee', rgb: '230,230,238', mult: 1, n: [1, 1] },
  { name: 'MAGIC', col: '#5a9cff', rgb: '90,156,255', mult: 1.7, n: [2, 3] },
  { name: 'RARE', col: '#ffe23a', rgb: '255,226,58', mult: 2.2, n: [3, 4] },
  { name: 'LEGENDARY', col: '#ff9a2a', rgb: '255,154,42', mult: 2.8, n: [4, 4] },
  { name: 'MYTHIC', col: '#ff3a78', rgb: '255,58,120', mult: 4.2, n: [4, 4] }
];
const STATS = {
  str: { n: 'STR', lo: 2, hi: 5, sfx: '' },
  crit: { n: 'CRIT CHANCE', lo: 1, hi: 3, sfx: '%' },
  cdmg: { n: 'CRIT DAMAGE', lo: 6, hi: 14, sfx: '%' },
  hit: { n: 'HIT CHANCE', lo: 1, hi: 3, sfx: '%' }
};
const STAT_KEYS = Object.keys(STATS);
const SLOT_PRIMARY = { weapon: ['str', 'cdmg'], helm: ['crit', 'hit'], armor: ['str', 'hit'], boots: ['hit', 'crit'], ring: ['crit', 'cdmg'], amulet: ['str', 'cdmg', 'crit', 'hit'] };
