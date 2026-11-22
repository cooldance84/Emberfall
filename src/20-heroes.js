/* ---------- three heroes: Nolan (STR warrior), Panni (INT sorceress), Luca (DEX rogue) ---------- */
const CLASSES = {
  nolan: { name: 'NOLAN', stat: 'STR', kind: 'hero', hp0: 136, hpl: 4, crit: 5, cdmg: 150, mul: 0.025, role: 'WARRIOR', col: '#9fd0ff', desc: ['STRENGTH: MORE HEALTH, HEAVY SWORD', '3-HIT COMBO, THE LAST HIT KNOCKS DOWN'] },
  panni: { name: 'PANNI', stat: 'INT', kind: 'panni', hp0: 108, hpl: 3, crit: 5, cdmg: 150, mul: 0.028, role: 'SORCERESS', col: '#d8b8ff', desc: ['INTELLECT: SPELL POWER, FASTER WRATH', 'ARCANE BOLTS FROM RANGE, BIG 3RD BLAST'] },
  luca: { name: 'LUCA', stat: 'DEX', kind: 'luca', hp0: 118, hpl: 3.4, crit: 14, cdmg: 165, mul: 0.022, role: 'ROGUE', col: '#9affb8', desc: ['DEXTERITY: CRITS, SPEED, ACCURACY', 'FAST 4-HIT DAGGERS, BACKSTABS +50%'] }
};
const CLS_ORDER = ['nolan', 'panni', 'luca'];
let CLS = 'nolan', CLS2 = 'luca', loadedCls = null, sel = { a: 0, b: 2, coop: false };
const cls = () => CLASSES[CLS];
const clsName = c => CLASSES[c].name[0] + CLASSES[c].name.slice(1).toLowerCase();
function heroize(t) { // story text follows the chosen hero
  if (CLS === 'nolan' || typeof t !== 'string') return t;
  const n = clsName(CLS);
  return t.replace(/Nolan's Last Dawn/g, "Nolan's Last Dawn").replace(/Nolané/g, CLS === 'luca' ? 'Lucáé' : 'Pannié').replace(/Nolan/g, n).replace(/NOLAN/g, cls().name)
    .replace(/the sword/g, CLS === 'panni' ? 'the staff' : 'the daggers').replace(/a sword/g, CLS === 'panni' ? 'a staff' : 'twin daggers').replace(/kardot/g, CLS === 'panni' ? 'varázsbotot' : 'tőröket');
}
function tr(s) { return s; } // the game is English only (kept as a hook so every string still goes through one place)
function loadSettings() { try { const o = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); if (o) { musicOn = o.music !== false; sfxOn = o.sfx !== false;
  crtOn = o.crt !== false; hdOn = o.hd !== false; if (o.cls === 'panni' || o.cls === 'luca' || o.cls === 'nolan') CLS = o.cls;
  } } catch (e) { } }
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify({ music: musicOn, sfx: sfxOn, crt: crtOn, hd: hdOn, cls: CLS })); } catch (e) { } }
loadSettings();

