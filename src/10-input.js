/* ---------- input ---------- */
const keys = {}, pressed = {};
const KEYMAP = {
  left: ['KeyA', 'ArrowLeft', 'PadLeft', 'TLeft'], right: ['KeyD', 'ArrowRight', 'PadRight', 'TRight'], up: ['KeyW', 'ArrowUp', 'PadUp', 'TUp'], down: ['KeyS', 'ArrowDown', 'PadDown', 'TDown'],
  atk: ['KeyJ', 'KeyZ', 'PadX', 'TAtk'], jump: ['KeyK', 'KeyX', 'Space', 'PadA', 'TJump'], magic: ['ShiftLeft', 'ShiftRight', 'KeyL', 'KeyC', 'PadB', 'PadRB', 'TMagic'], dismount: ['KeyE', 'PadY', 'TRide'],
  start: ['Enter', 'PadA', 'TStart'], skill: ['KeyU', 'PadLB', 'TSkill'], swap: ['KeyQ', 'PadLT', 'TSwap'], inv: ['KeyI', 'Tab', 'PadSelect', 'TInv'], back: ['Escape', 'Backspace'], pause: ['Escape', 'KeyP', 'PadStart', 'TPause']
};
addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (e.code === 'KeyF') { crtOn = !crtOn; saveSettings(); }
  if (e.code === 'KeyM') muted = !muted;
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  initAudio();
});
addEventListener('keyup', e => { keys[e.code] = false; });
/* ---- gamepad + touch feed the same key tables with virtual key codes ---- */
const PADNAMES = ['Left', 'Right', 'Up', 'Down', 'A', 'B', 'X', 'Y', 'RB', 'LB', 'LT', 'Select', 'Start'];
const IS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
function setV(code, on) { on = !!on; if (on && !keys[code]) pressed[code] = true; keys[code] = on; }
function feedPad(p, pre) {
  const b = i => !!(p && p.buttons[i] && p.buttons[i].pressed), ax = p ? p.axes[0] || 0 : 0, ay = p ? p.axes[1] || 0 : 0;
  setV(pre + 'Left', ax < -0.45 || b(14)); setV(pre + 'Right', ax > 0.45 || b(15)); setV(pre + 'Up', ay < -0.45 || b(12)); setV(pre + 'Down', ay > 0.45 || b(13));
  setV(pre + 'X', b(2)); setV(pre + 'A', b(0)); setV(pre + 'B', b(1) || b(7)); setV(pre + 'RB', b(5)); setV(pre + 'LB', b(4)); setV(pre + 'LT', b(6)); setV(pre + 'Y', b(3)); setV(pre + 'Select', b(8)); setV(pre + 'Start', b(9));
}
function pollPad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  const ps = []; for (const q of navigator.getGamepads() || []) if (q && q.connected) ps.push(q);
  feedPad(ps[0], 'Pad'); feedPad(coop ? ps[1] : null, 'P2Pad');
}
const isDown = a => KEYMAP[a].some(c => keys[c]);
const isHit = a => KEYMAP[a].some(c => pressed[c]);
// player 2 (co-op): arrows + , . / (or numpad 1-3), or the second gamepad
const KEYMAP2 = { left: ['ArrowLeft', 'P2PadLeft'], right: ['ArrowRight', 'P2PadRight'], up: ['ArrowUp', 'P2PadUp'], down: ['ArrowDown', 'P2PadDown'],
  atk: ['Comma', 'Numpad1', 'P2PadX'], jump: ['Period', 'Numpad2', 'P2PadA'], magic: ['Slash', 'Numpad3', 'P2PadB', 'P2PadRB'], dismount: ['Quote', 'Numpad0', 'P2PadY'], skill: ['Semicolon', 'Numpad4', 'P2PadLB'], swap: ['Backslash', 'Numpad5', 'P2PadLT'] };
let chests = [], vents = [], slashes = [], shop = null, gaps = [], ambW = -1, waveN = 0, hints = {};
let shrines = [], buff = null; // a shrine's blessing is shared by the whole party
const buffIs = id => !!buff && buff.id === id && buff.t > 0;
const LOOT_T = 1500;
let coop = false, hero1 = null, hero2 = null, intro = null, cycle = 0;
const TRIAL_MAX = 10, ROMAN_T = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const trialN = () => Math.min(cycle, TRIAL_MAX);                                     // Ember Trials: after the campaign every run is one step harder
const trialName = n => 'TRIAL ' + (n > TRIAL_MAX ? 'X+' + (n - TRIAL_MAX) : ROMAN_T[n]);
const areaLv = () => Math.round(4 + stageIdx * 1.6);                              // how deep in the campaign you are
const monLv = () => Math.max(areaLv(), rpg.lvl - 12);            // an over-levelled hero meets monsters of their own league
const late = () => Math.max(0, monLv() - 30);                    // past the middle of the campaign the ramp steepens
const HP_TIER = [1, 1.2, 1.45, 1.75, 2.05, 2.4, 2.8];                            // every act (tier) adds a flat layer of monster health
const hpTier = () => HP_TIER[Math.min(6, (stageIdx / 5) | 0)] * Math.pow(1.14, trialN()); // each Ember Trial: foes have 14% more life, compounding
const hpMul = () => (1 + (monLv() - 4) * 0.12 + late() * late() * 0.004) * hpTier();  // monsters get tougher every stage, tier and cycle
const dmgMul = () => (1 + (monLv() - 4) * 0.055 + late() * late() * 0.0012) * Math.pow(1.08, trialN()); // ...and hit 8% harder, compounding
const tierOf = () => cycle ? Math.max(stageIdx, 2) : stageIdx; // loot tier: later cycles unlock magic and legendary everywhere
const keysOf = (a, pn) => pn === 2 ? (KEYMAP2[a] || []) : (coop ? KEYMAP[a].filter(c => !c.startsWith('Arrow')) : KEYMAP[a]);
const inD = (f, a) => keysOf(a, f.pn).some(c => keys[c]);
const inH = (f, a) => keysOf(a, f.pn).some(c => pressed[c]);
const players = () => coop && hero2 ? [hero1, hero2] : [hero1];
function nearestPlayer(x) { let b = null; for (const p of players()) if (!p.dead && (!b || Math.abs(p.x - x) < Math.abs(b.x - x))) b = p; return b || hero1; }
const leadX = () => Math.max(...players().filter(p => !p.dead).map(p => p.x), hero1.x);
function withHero(p, fn) { const real = hero; hero = p; try { return fn(); } finally { hero = real; } }
let crtOn = true, muted = false, musicOn = true, sfxOn = true;
const SET_KEY = 'emberfall_settings_v1';
