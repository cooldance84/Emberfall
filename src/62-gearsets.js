/* ---------- gear sets: legendary and mythic pieces from item level 50 up can belong to a set; wear 2 or 4 pieces of the same set for a bonus. Sets combine freely (2+2, 4+2...) ---------- */
let setBoost = 1; // bosses of a max-level hero raise the set chance by half for their drops
const SET_MIN_LV = 50, SET_CH = { 3: 0.12, 4: 0.3 }; // set pieces are always built at mythic strength, then boosted: a set piece beats any mythic
const SETS = {
  vow: { name: 'VOWBOUND', pre: 'Vowbound', col: '#ff6a8a', b: [[2, { crit: 6, cdmg: 25 }], [4, { crit: 14, cdmg: 70 }]] },
  bulwark: { name: 'BULWARK', pre: 'Bulwark', col: '#6ad8ff', b: [[2, { hp: 15 }], [4, { hp: 30, res: 20 }]] },
  ember: { name: 'EMBERHEART', pre: 'Emberheart', col: '#ffb45a', b: [[2, { str: 8, ep: 12 }], [4, { str: 8, ep: 25, afl: 30 }]] }
};
const SET_UNIT = { crit: ['%', 'CRIT'], cdmg: ['%', 'CRIT DMG'], hp: ['%', 'MAX HP'], res: ['%', 'ALL RESIST'], ep: ['%', 'ELEM POWER'], afl: ['%', 'VS STATUS'] };
function setCount(id, skipSlot) { let n = 0; for (const sl of SLOTS) { const it = rpg.eq[sl]; if (it && it.set === id && sl !== skipSlot) n++; } return n; }
function setTier(id, n) { let b = null; for (const [need, v] of SETS[id].b) if (n >= need) b = v; return b; }
function setBonus(key) { let t = 0; for (const id in SETS) { const b = setTier(id, setCount(id)); if (b && b[key]) t += b[key]; } return t; }
function setBonusText(b) { return Object.keys(b).map(k => '+' + b[k] + (k === 'str' ? ' ' + tr(statName('str')) : SET_UNIT[k][0] + ' ' + tr(SET_UNIT[k][1]))).join(' '); }
const BASE_NAMES = { weapon: ['Rusted Sword', 'Iron Blade', 'Ash Cleaver'], helm: ['Worn Cap', 'Iron Helm', 'Husk Visor'], armor: ['Ragged Vest', 'Chain Shirt',
  'Ash Plate'], boots: ['Old Boots', 'Road Greaves', 'Cinder Treads'], ring: ['Copper Ring', 'Bone Band', 'Ash Loop'], amulet: ['Bone Charm', 'Tin Pendant',
  'Ash Locket'] };
const MAGIC_BASE = { weapon: ['Sword', 'Blade', 'Axe'], helm: ['Helm', 'Cap', 'Hood'], armor: ['Mail', 'Vest', 'Plate'], boots: ['Boots', 'Greaves', 'Treads'], ring: ['Ring', 'Band', 'Loop'], amulet: ['Amulet', 'Charm', 'Pendant'] };
const RARE_PRE = ['Runed', 'Grim', 'Stormforged', 'Bloodsworn', 'Dread', 'Sunlit', 'Wyrmbone', 'Ashborn'];
const MAGIC_PRE = ['Keen', "Warden's", 'Ember', 'Swift', 'Fierce', 'Gilded', 'Bladed'];
const LEG_NAMES = { weapon: ['Dawnbreaker', "Warden's Oath"], helm: ['Crown of Embers', 'Sunwatch Helm'], armor: ['Phoenix Mail', 'Heart-Ward'], boots: ['Stormstep Greaves', 'Ashwalkers'], ring: ['Ring of Kindling', 'Vow-Band'], amulet: ['Heart-Ember Shard', 'Eye of Ashhold'] };
const MYTH_NAMES = { weapon: ['Ruinblade, the Vow', "Nolan's Last Dawn"], helm: ['Helm of the Last Flame'], armor: ['Aegis of Emberfall'], boots: ['Boots of the Endless Road'], ring: ['Ring of the First Warden'], amulet: ['The Heart-Ember Reborn'] };
const WNAMES = {
  panni: { base: ['Ash Staff', 'Oak Wand', 'Ember Rod'], magic: ['Staff', 'Wand', 'Rod'], leg: ['Starfall Staff', 'Wand of Kindling'], myth: ["Panni's Last Spell", 'Staff of the First Flame'] },
  luca: { base: ['Rusty Dagger', 'Iron Knife', 'Ash Dirk'], magic: ['Daggers', 'Knives', 'Dirks'], leg: ['Twin Fangs', 'Nightsting'], myth: ["Luca's Last Shadow", 'Whisper and Woe'] }
};
const MAX_UP = 10; // hard cap; you start with +7 and every cleared Ember Trial (I-III) opens the next forge level
const forgeCap = () => 7 + Math.min(3, rpg.tr | 0);
function itemSt(it, up) { // every forge level adds 10% to the weapon's stats and +2 to the main stat
  up = up == null ? (it.up | 0) : up; if (!up) return it.st;
  const w = it.slot === 'weapon'; // other gear forges more gently: +6% per level and +1 main stat, so forging everything stays balanced
  const o = {}; for (const k in it.st) o[k] = Math.round(it.st[k] * (1 + (w ? 0.1 : 0.06) * up)); o.str = (o.str || 0) + (w ? 2 : 1) * up; return o;
}
const iname = it => it.name + (it.up ? ' +' + it.up : '');
const statName = k => k === 'str' ? cls().stat : STATS[k].n;
/* ---------- season seed: in the race the layout, the waves, the chests, shrines, markets and every drop come from a seed everyone shares ---------- */
let rngS = null;
function rngMake(str) { // xmur3 hash -> mulberry32
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); let a = (h ^ h >>> 16) >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rq = () => rngS ? rngS() : Math.random();
const rqr = (a, b) => a + rq() * (b - a);
function seeded(key, fn) { // runs fn with a stream that depends only on the season and the key; outside the race (or with no key) it is plain Math.random
  if (!daily || key == null) return fn();
  const o = rngS; rngS = rngMake(seasonStr() + '|' + key);
  try { return fn(); } finally { rngS = o; }
}
const pickOf = a => a[rq() * a.length | 0];
const ELEMS = ['fire', 'frost', 'bolt'];
