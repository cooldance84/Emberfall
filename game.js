'use strict';
(function () { // everything lives in this closure, so none of it can be reached or changed from the browser console
/* EMBERFALL — an original side-scrolling brawler.
   Everything (characters, stages, effects) is procedural and original.
   Pipeline: 480x270 pixel scene -> dynamic lighting -> WebGL CRT/bloom shader. */

const VERSION = '1.52.0';
/* a failure must never be a silent black screen: any error is also written on the page, so it can be read and reported */
function crash(msg) {
  try {
    let el = document.getElementById('emberfall-err');
    if (!el) { el = document.createElement('pre'); el.id = 'emberfall-err'; el.style.cssText = 'position:fixed;left:0;right:0;top:0;margin:0;padding:8px;background:#400;color:#fff;font:12px monospace;white-space:pre-wrap;z-index:9;max-height:60%;overflow:auto'; document.body.appendChild(el); }
    if (el.textContent.length < 2500 && el.textContent.indexOf(msg) < 0) el.textContent += 'v' + VERSION + ' ' + msg + '\n';
  } catch (e) { }
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('error', e => crash((e.message || 'error') + ' (' + (e.lineno || '?') + ':' + (e.colno || '?') + ')'));
const W = 480, H = 270, GROUND_TOP = 140, Y_MIN = 160, Y_MAX = 252;
const screen = document.getElementById('screen');
const off = document.createElement('canvas'); off.width = W; off.height = H;
const g = off.getContext('2d');
const lightCv = document.createElement('canvas'); lightCv.width = W; lightCv.height = H;
const lg = lightCv.getContext('2d');

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
  if (e.code === 'KeyV') { hdOn = !hdOn; hdAuto = true; hdSlow = 0; saveSettings(); }
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
let shrines = [], buffs = [], tut = null; // tut: the training arena, when it runs; // the blessings of the shrines are shared by the whole party; up to MAX_BUFFS run side by side
const MAX_BUFFS = 3;
const buffIs = id => buffs.some(b => b.id === id && b.t > 0);
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
let crtOn = true, hdOn = true, muted = false, musicOn = true, sfxOn = true;
const SET_KEY = 'emberfall_settings_v1';
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

/* ---------- audio (tiny synth) ---------- */
let ac = null;
function initAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); mChain();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
}
function sfxTone(type, f0, f1, dur, vol) {
  if (!ac || muted || !sfxOn) return;
  const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur);
}
/* heavy sounds push the music down for a moment, so the blows stay audible over the drums */
function duck(depth) {
  if (!ac || !mDuck || muted || !sfxOn || !mDuck.gain.cancelScheduledValues) return;
  const t = ac.currentTime; mDuck.gain.cancelScheduledValues(t); mDuck.gain.setTargetAtTime(depth, t, 0.012); mDuck.gain.setTargetAtTime(1, t + 0.1, 0.14);
}
const SFX = {
  swing: () => sfxTone('square', 420, 140, 0.09, 0.05),
  hit: () => { duck(0.6); sfxTone('square', 180, 50, 0.12, 0.09); sfxTone('sawtooth', 90, 40, 0.1, 0.05); },
  big: () => { duck(0.5); sfxTone('sawtooth', 120, 28, 0.35, 0.12); },
  magic: () => { duck(0.65); sfxTone('sawtooth', 160, 900, 0.45, 0.07); sfxTone('square', 90, 30, 0.5, 0.08); },
  pick: () => sfxTone('sine', 600, 1000, 0.14, 0.08),
  land: () => sfxTone('triangle', 90, 40, 0.08, 0.06),
  die: () => { duck(0.55); sfxTone('sawtooth', 220, 30, 0.5, 0.1); },
  burn: () => { sfxTone('sawtooth', 300, 90, 0.28, 0.05); sfxTone('square', 520, 160, 0.16, 0.03); },
  freeze: () => { sfxTone('sine', 1500, 900, 0.3, 0.06); sfxTone('triangle', 2300, 1700, 0.18, 0.04); },
  zap: () => { duck(0.7); sfxTone('square', 900, 120, 0.12, 0.06); sfxTone('sawtooth', 1400, 200, 0.1, 0.04); },
  shatter: () => { duck(0.7); sfxTone('triangle', 1800, 300, 0.22, 0.07); sfxTone('square', 700, 120, 0.12, 0.04); }
};

/* ---------- music: a procedural score, 16 bars per theme (WebAudio, no sound files) ---------- */
let mGain = null, mDuck = null, mRevIn = null, noiseBuf = null, mNext = 0, mStep = 0, mTrack = -1, mLvl = 0, mWant = 0, mLow = 0;
/* A track = a 16-bar form (8 eighth-note steps a bar). prog: chord root (scale degree) per bar; bass: 8-step figure,
   chord-relative scale degrees (null = rest); lead: 8-step melody figure; choir: [first bar, lowest intensity]; rev: reverb amount.
   Intensity: 0 = empty stage (bass + pad), 1 = a wave is on (drums too), 2 = boss (everything). */
const MUS = [
  { name: 'gate', root: 73.42, sc: [0, 2, 3, 5, 7, 8, 10], bpm: 120, rev: 0.4, half: false,                       // D minor, timpani + bell
    prog: [0, 5, 2, 6, 0, 5, 3, 4, 5, 6, 0, 2, 5, 6, 4, 0], bass: [0, 0, 7, 0, 0, 0, 7, 4], pad: 'triangle',
    lead: [7, null, null, 4, null, 9, null, null], leadFrom: 4, choir: [8, 1], vow: [0, 1] },
  { name: 'marsh', root: 82.41, sc: [0, 1, 3, 5, 7, 8, 10], bpm: 108, rev: 1.0, half: true,                       // E Phrygian, half-time, dripping, choir throughout
    prog: [0, 1, 0, 1, 5, 6, 1, 0, 0, 1, 2, 6, 3, 1, 0, 0], bass: [0, null, null, null, 0, null, 4, null], pad: 'sine',
    choir: [0, 0], vow: [2, 1, 2, 0] },
  { name: 'forge', root: 65.41, sc: [0, 2, 3, 5, 7, 9, 10], bpm: 126, rev: 0.3, half: false,                      // C Dorian, anvil hits, sharp synth lead
    prog: [0, 0, 6, 3, 0, 0, 6, 4, 2, 3, 0, 0, 6, 3, 4, 0], bass: [0, 0, 7, 0, 0, 7, 0, 4], pad: 'sawtooth', bv: 2.6,
    lead: [7, null, 9, 7, null, 11, 9, null], leadFrom: 4, choir: [12, 1], vow: [3, 1] },
  { name: 'throne', root: 49.0, sc: [0, 2, 3, 5, 7, 8, 10], bpm: 116, rev: 0.75, half: false,                     // G minor, organ + choir, brass stabs at the end
    prog: [0, 5, 2, 6, 0, 5, 6, 0, 3, 5, 2, 6, 3, 4, 5, 6], bass: [0, null, 0, 0, null, 0, 4, 0], pad: 'organ',
    choir: [4, 1], vow: [1, 2, 0, 1], brass: 12 },
  { name: 'sanctum', root: 55.0, sc: [0, 2, 3, 5, 7, 8, 10], bpm: 138, rev: 0.85, half: false,                    // A minor, choir from the start, bright bells
    prog: [0, 5, 2, 6, 0, 5, 3, 4, 5, 2, 6, 0, 5, 3, 4, 0], bass: [0, 7, 4, 7, 0, 7, 4, 7], pad: 'triangle', bv: 1.2,
    lead: [0, 2, 4, 7, 4, 2, 4, 9], leadFrom: 0, choir: [0, 0], vow: [0, 1, 0, 2] },
  { name: 'boss', root: 73.42, sc: [0, 2, 3, 5, 7, 8, 10], bpm: 132, rev: 0.5, half: false,                       // D minor, choir from bar 4, chord stabs from bar 9
    prog: [0, 0, 5, 6, 0, 0, 3, 4, 5, 6, 0, 0, 3, 4, 5, 6], bass: [0, 0, 0, 7, 0, 0, 4, 7], pad: 'sawtooth', bv: 1.25,
    choir: [3, 2], vow: [0, 3, 1, 0], stab: 8 },
  { name: 'title', root: 73.42, sc: [0, 2, 3, 5, 7, 8, 10], bpm: 84, rev: 1.0, half: true, menu: true,           // the menus: D minor, slow, no drums: choir, bells, a low timpani
    prog: [0, 2, 5, 6, 0, 2, 3, 4, 5, 3, 0, 6, 5, 3, 4, 0], bass: [0, null, 4, null, 7, null, 4, null], pad: 'triangle',
    lead: [0, null, 2, null, 4, null, 7, null], leadFrom: 0, choir: [0, 0], vow: [0, 1, 2, 1] }
];
const MUS_BOSS = 5, MUS_TITLE = 6;
const VOWELS = [[800, 1150, 2900], [450, 800, 2830], [325, 700, 2700], [530, 1840, 2480]]; // ah, oh, oo, eh
const degFreq = (M, d, oct) => M.root * Math.pow(2, (M.sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct)) / 12);
const chordOf = (M, r, oct) => [degFreq(M, r, oct), degFreq(M, r + 2, oct), degFreq(M, r + 4, oct)];
function mChain() {
  mGain = ac.createGain(); mGain.gain.value = 0.7; mDuck = ac.createGain(); mDuck.gain.value = 1; mDuck.connect(ac.destination);
  let dst = mDuck;
  if (ac.createDynamicsCompressor) { try { const cp = ac.createDynamicsCompressor(); cp.connect(mDuck); dst = cp; } catch (e) { } }
  mGain.connect(dst);
  if (ac.createConvolver) { try {                       // one shared hall: decaying, slightly dark noise, different on each ear
    const n = Math.floor(ac.sampleRate * 2.8), ir = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < d.length; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.45; d[i] = lp * Math.pow(1 - i / d.length, 2.4); } }
    const cv = ac.createConvolver(); cv.buffer = ir; mRevIn = ac.createGain(); mRevIn.gain.value = 0.4; mRevIn.connect(cv); cv.connect(mGain);
  } catch (e) { mRevIn = null; } }
}
function mOut(n, send) { n.connect(mGain); if (send && mRevIn) n.connect(mRevIn); }
function mFilter(type, f, q) { const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q && fl.Q) fl.Q.value = q; return fl; }
function mTone(type, f, t, dur, vol, send) {
  const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); mOut(gn, send); o.start(t); o.stop(t + dur + 0.03);
}
function mBass(f, t, dur, vol) {                         // the driving eighth-note figure: a sawtooth through a closing low-pass
  const o = ac.createOscillator(), fl = mFilter('lowpass', f * 7, 3), gn = ac.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
  fl.frequency.setValueAtTime(Math.min(2600, f * 9), t); fl.frequency.exponentialRampToValueAtTime(f * 2.2, t + dur * 0.8);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(gn); mOut(gn, false); o.start(t); o.stop(t + dur + 0.03);
}
function mKick(t, v) { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(gn); mOut(gn, false); o.start(t); o.stop(t + 0.18); }
function mNoise(t, dur, vol, hp, send, type) {
  const s = ac.createBufferSource(), f = mFilter(type || 'highpass', hp), gn = ac.createGain(); s.buffer = noiseBuf;
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(f); f.connect(gn); mOut(gn, send); s.start(t); s.stop(t + dur + 0.02);
}
function mSnare(t, v) { mNoise(t, 0.13, v, 1400, true); mTone('triangle', 200, t, 0.09, v * 0.9, false); }
function mHat(t, v) { mNoise(t, 0.035, v, 7000, false); }
function mSwell(t, dur, v) {                             // the tam-tam build-up: noise that rises and brightens
  const s = ac.createBufferSource(), f = mFilter('lowpass', 500, 1), gn = ac.createGain(); s.buffer = noiseBuf; s.loop = true;
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
  gn.gain.setValueAtTime(0.0005, t); gn.gain.exponentialRampToValueAtTime(v, t + dur); gn.gain.linearRampToValueAtTime(0.0005, t + dur + 0.04);
  s.connect(f); f.connect(gn); mOut(gn, true); s.start(t); s.stop(t + dur + 0.06);
}
function mGong(t, v) {                                   // the tam-tam itself: inharmonic partials plus a shimmer of noise
  [1, 1.47, 2.09, 2.56, 3.4].forEach((r, k) => mTone('sine', 98 * r, t, 3.2 - k * 0.35, v / (1 + k * 0.7), true));
  mNoise(t, 2.2, v * 0.5, 900, true);
}
function mTimp(t, f, v) { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(f * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.09); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.85); o.connect(gn);
  mOut(gn, true); o.start(t); o.stop(t + 0.9); mNoise(t, 0.05, v * 0.5, 200, false, 'lowpass'); }
function mBell(f, t, v, dur, bright) {
  (bright ? [1, 2.01, 3, 4.2, 5.4] : [1, 2, 2.4, 3, 4.1]).forEach((r, k) => mTone('sine', f * r, t, dur / (1 + k * 0.5), v / (1 + k * 0.6), true));
}
function mAnvil(t, v) { [1, 2.76, 4.1].forEach((r, k) => mTone('sine', 1250 * r * 0.6, t, 0.4 / (1 + k), v / (1 + k * 0.8), true)); mTone('sine', 160, t, 0.07, v * 1.6, false); mNoise(t, 0.03, v, 3000, false); }
function mDrip(f, t, v) { for (let k = 0; k < 3; k++) { const o = ac.createOscillator(), gn = ac.createGain(), tt = t + k * 0.23; o.frequency.setValueAtTime(f * 0.8, tt);
  o.frequency.exponentialRampToValueAtTime(f * 1.5, tt + 0.05); gn.gain.setValueAtTime(v / (1 + k * 2.2), tt); gn.gain.exponentialRampToValueAtTime(0.0005, tt + 0.26);
  o.connect(gn); mOut(gn, true); o.start(tt); o.stop(tt + 0.3); } }
function mLead(f, t, dur, v) {                           // the sharp synth lead: two detuned saws, resonant low-pass
  const fl = mFilter('lowpass', 1200, 6), gn = ac.createGain();
  fl.frequency.setValueAtTime(4200, t); fl.frequency.exponentialRampToValueAtTime(1300, t + dur);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  [-9, 9].forEach(c => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); if (o.detune) o.detune.value = c; o.connect(fl); o.start(t); o.stop(t + dur + 0.03); });
  fl.connect(gn); mOut(gn, true);
}
function mOrgan(fr, t, dur, v) {                         // a square and its octave, softened
  const fl = mFilter('lowpass', 1500), gn = ac.createGain();
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.05); gn.gain.setValueAtTime(v, t + dur - 0.1); gn.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08);
  fr.forEach(f => [['square', f, 1], ['sine', f * 2, 0.8]].forEach(p => { const o = ac.createOscillator(); o.type = p[0]; o.frequency.setValueAtTime(p[1], t); const g = ac.createGain(); g.gain.value = p[2]; o.connect(g); g.connect(fl); o.start(t); o.stop(t + dur + 0.1); }));
  fl.connect(gn); mOut(gn, true);
}
function mStab(fr, t, dur, v) {                          // a brass-like chord hit: saws, the filter opens and shuts at once
  const fl = mFilter('lowpass', 400, 2), gn = ac.createGain();
  fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(2600, t + 0.05); fl.frequency.exponentialRampToValueAtTime(700, t + dur);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fr.forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.connect(fl); o.start(t); o.stop(t + dur + 0.03); });
  fl.connect(gn); mOut(gn, true);
}
function mChoir(fr, t, dur, v, vow) {                    // saws through three formant filters = a sung vowel, with a slow vibrato
  const vg = ac.createGain(), V = VOWELS[vow % VOWELS.length], end = t + dur;
  vg.gain.setValueAtTime(0.0001, t); vg.gain.linearRampToValueAtTime(v, t + Math.min(0.45, dur * 0.3)); vg.gain.setValueAtTime(v, end - 0.05); vg.gain.exponentialRampToValueAtTime(0.0001, end + 0.5);
  V.forEach((fq, k) => { const bp = mFilter('bandpass', fq, 8), g = ac.createGain(); g.gain.value = [1, 0.6, 0.3][k]; vg.connect(bp); bp.connect(g); mOut(g, true); });
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5; lg.gain.value = 4; lfo.connect(lg); lfo.start(t); lfo.stop(end + 0.55);
  fr.forEach((f, j) => [-7, 7].forEach(c => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); if (o.detune) o.detune.value = c + j; lg.connect(o.frequency); o.connect(vg); o.start(t); o.stop(end + 0.55); }));
}
const mHash = n => { n = Math.imul(n ^ (n >>> 15), 2246822519); n = Math.imul(n ^ (n >>> 13), 3266489917); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
/* one eighth-note step of the score at time t */
function mPlayStep(M, step, t, sd, lv) {
  const i = step & 7, bar = (step >> 3) & 15, r = M.prog[bar], q4 = bar & 3;
  // bass figure (thinned on an empty stage) and the pad under it
  const d = M.bass[i];
  if (d !== null && (lv > 0 || !(i & 1))) mBass(degFreq(M, r + d, 0), t, sd * 0.95, 0.15 * (M.bv || 1));
  if (i === 0) {
    const fr = chordOf(M, r, 1);
    if (M.pad === 'organ') mOrgan(fr, t, sd * 8, 0.035);
    else fr.forEach(f => mTone(M.pad, f, t, sd * 8, M.pad === 'sawtooth' ? 0.022 : 0.03, true));
    if (M.choir && bar >= M.choir[0] && lv >= M.choir[1]) mChoir([degFreq(M, r, 1), degFreq(M, r + 4, 1), degFreq(M, r + 2, 2), degFreq(M, r + 7, 2)], t, sd * 8, 0.09, M.vow[(bar >> 0) % M.vow.length]);
    if (q4 === 0 && lv > 0) mGong(t, bar === 0 ? 0.07 : 0.045);   // the tam-tam crash that answers the build-up
  }
  if (M.name === 'marsh' && (lv >= 0) && mHash(step * 7 + 3) < 0.2) mDrip(degFreq(M, [4, 7, 9, 11, 14][(mHash(step) * 5) | 0], 2), t, 0.05);
  if (M.menu) {                                          // no drums in the menus: bells over the choir, one soft timpani a bar
    if (i === 0) mTimp(t, degFreq(M, r, 1), 0.1);
    if (M.lead[i] !== null) mBell(degFreq(M, r + M.lead[i], 2), t, 0.045, sd * 4, false);
    return;
  }
  if (lv < 1) return;
  // drums: kick on every quarter, snare on 2 and 4, hi-hat eighths (half-time in the marsh)
  const build = q4 === 3 && i >= 4;
  if (M.half) { if (i === 0) mKick(t, 0.22); if (i === 4) mSnare(t, 0.07); if (i === 2 || i === 6) mHat(t, 0.02); }
  else {
    if (!(i & 1)) mKick(t, lv > 1 ? 0.3 : 0.22);
    if ((i === 2 || i === 6) && !build) mSnare(t, lv > 1 ? 0.1 : 0.07);
    mHat(t, i & 1 ? 0.03 : 0.018);
    if (lv > 1) mHat(t + sd / 2, 0.016);
  }
  if (build) { mSnare(t, 0.03 + 0.012 * (i - 4)); mSnare(t + sd / 2, 0.02 + 0.012 * (i - 4)); if (i === 4) mSwell(t, sd * 4, 0.12); }
  // what makes the theme itself
  if (M.name === 'gate') {
    if (i === 0) mTimp(t, degFreq(M, r, 1), 0.3); if (i === 5) mTimp(t, degFreq(M, r + 4, 0), 0.2);
    if (q4 === 3 && i >= 6) mTimp(t, degFreq(M, r, 1), 0.16);
  }
  if (M.name === 'forge' && (i === 3 || i === 7)) mAnvil(t, q4 === 3 ? 0.06 : 0.04);
  if (M.lead && bar >= M.leadFrom && M.lead[i] !== null) {
    const f = degFreq(M, r + M.lead[i], 2);
    if (M.name === 'forge') mLead(f, t, sd * 1.4, 0.035); else mBell(f, t, M.name === 'sanctum' ? 0.04 : 0.05, sd * (M.name === 'sanctum' ? 3 : 5), M.name === 'sanctum');
  }
  if ((M.brass !== undefined && bar >= M.brass || M.stab !== undefined && bar >= M.stab) && (i === 0 || i === 3 || i === 6)) mStab(chordOf(M, r, 1), t, sd * 2.2, 0.05);
}
function mSchedule(M, until) {
  const sd = 60 / M.bpm / 2;
  while (mNext < until) {
    if (mWant >= mLvl) { mLvl = mWant; mLow = 0; } else if (++mLow >= 16) { mLvl = mWant; mLow = 0; }   // it calms down two bars after the last foe
    mPlayStep(M, mStep, mNext, sd, mLvl);
    mNext += sd; mStep++;
  }
}
function musicTick() {
  if (!ac || !mGain || !musicOn || muted || ac.state !== 'running') return;
  const boss = mode === 'play' && !!bossRef && !bossRef.dead;
  const menu = mode === 'title' || mode === 'select' || mode === 'dailyinfo' || mode === 'journey' || mode === 'board' || mode === 'name' || mode === 'cloud';
  const th = mode === 'gameover' ? -1 : menu ? MUS_TITLE : mode === 'story' && story ? story.theme : mode === 'victory' ? 4 : STAGES[stageIdx].theme;
  mGain.gain.setTargetAtTime(mode === 'pause' || mode === 'inv' ? 0.28 : boss ? 0.8 : 0.7, ac.currentTime, 0.1);
  if (th < 0) return;
  if (mode !== 'pause' && mode !== 'inv') mWant = boss ? 2 : mode === 'story' ? 0 : mode === 'play' ? (enemies.some(e => !e.dead && e.kind !== 'imp') ? 1 : 0) : 1;
  const trk = boss ? MUS_BOSS : th;
  if (trk !== mTrack || mNext < ac.currentTime - 0.5) { mTrack = trk; mStep = 0; mNext = ac.currentTime + 0.06; mLvl = mWant; mLow = 0; }
  if (mRevIn) mRevIn.gain.setTargetAtTime(MUS[trk].rev, ac.currentTime, 0.4);
  mSchedule(MUS[trk], ac.currentTime + 0.22);
}

/* ---------- utils ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- procedural backdrops (pre-rendered, parallax) ---------- */
const LAYER_W = 960;
function makeLayer(draw, h) {
  const c = document.createElement('canvas'); c.width = LAYER_W; c.height = h || GROUND_TOP + 10;
  draw(c.getContext('2d'), c.width, c.height); return c;
}
function periodic(x, seed) { // seamless wrap by using integer-cycle sines
  let v = 0;
  for (let i = 1; i <= 6; i++) v += Math.sin(2 * Math.PI * i * x / LAYER_W + seed * i * 1.7) * (1 / i);
  return v;
}
/* ---------- themed backdrops: one set of parallax layers per stage ---------- */
const THEME_DEF = [
  { sky: ['#0a0b22', '#2a1740', '#6b2a3a'], star: '255,240,220', cloud: '130,60,110', far: '#2b1a3c', far2: '#1d1230', glow: '255,120,50', win: '#ffb05a', mid: '#170e26',
    tree: '#0f0819', wall: '#251830', wallRGB: [40, 24, 52], arch: '#120a1c', pil: '#3a2548', trim: '#4a3058', trim2: '#6a4a7a', ban: '#6e1d2a', ban2: '#4a121c',
    floor: ['#3a2a3e', '#17101d'], tile: '255,220,255', line: '10,6,16', fog: '140,100,160', fogA: 0.16, amb: '#ff9a4a', dark: 'rgba(18,12,40,0.5)', torch: '255,140,50',
    flame: ['#ff5a1f', '#ffb43a', '#fff1b0'], post: ['#1a1020', '#4b3558'], moon: { col: '#ffe9c8', spot: '#e6c9a8', r: 15, halo: '255,220,190', x: 380, y: 34 },
    fg: ['#07040b', '#120a19'], acc: ['#c9a86a'], farK: 'castle', midK: 'trees', wallK: 'gate' },
  { sky: ['#06130f', '#12302a', '#2c5a44'], star: '200,255,220', cloud: '60,120,90', far: '#10281f', far2: '#0a1a14', glow: '120,255,160', win: '#9dffb0', mid: '#0b1d16',
    tree: '#061410', wall: '#16281f', wallRGB: [22, 40, 31], arch: '#08140f', pil: '#2a4a38', trim: '#2e4a3a', trim2: '#4a7a5a', ban: '#2a5a3a', ban2: '#1a3a26',
    floor: ['#2b3b2c', '#101a12'], tile: '200,255,210', line: '4,10,6', fog: '120,200,150', fogA: 0.3, amb: '#9dffb0', dark: 'rgba(6,24,20,0.5)', torch: '120,255,160',
    flame: ['#2aa860', '#7aff9a', '#e8fff0'], post: ['#0d1a12', '#35523f'], moon: { col: '#d8ffe6', spot: '#b6e6c6', r: 13, halo: '170,255,200', x: 330, y: 40 },
    fg: ['#030906', '#0b1a12'], acc: ['#4a3a28', '#6a5238', '#0a1812', '#9dffb0', '#2a6a3a'], farK: 'marsh', midK: 'reeds', wallK: 'marsh' },
  { sky: ['#1a0806', '#4a1408', '#a03a10'], star: '255,200,150', cloud: '160,60,30', far: '#2a100c', far2: '#1a0806', glow: '255,110,30', win: '#ffcf5a', mid: '#1c0c08',
    tree: '#120604', wall: '#2c1812', wallRGB: [48, 30, 24], arch: '#140806', pil: '#4a2c22', trim: '#5a3a2a', trim2: '#8a5a3a', ban: '#7a2a10', ban2: '#4a1608',
    floor: ['#3a2620', '#140a08'], tile: '255,190,140', line: '12,4,2', fog: '200,110,70', fogA: 0.2, amb: '#ffb43a', dark: 'rgba(30,8,4,0.45)', torch: '255,120,30',
    flame: ['#ff4a10', '#ffa020', '#fff0a0'], post: ['#1a0c08', '#6a4a3a'], moon: { r: 0 }, fg: ['#080302', '#1a0c08'], acc: ['#ff7a20', '#ffd070', '#5a3a2a'],
    farK: 'forge', midK: 'pipes', wallK: 'forge' },
  { sky: ['#050210', '#1a0828', '#4a0e30'], star: '255,200,220', cloud: '120,30,70', far: '#14081c', far2: '#0a0410', glow: '255,40,60', win: '#ff4a5a', mid: '#0c0614',
    tree: '#060210', wall: '#160a22', wallRGB: [28, 14, 40], arch: '#08040e', pil: '#2a1440', trim: '#341a4a', trim2: '#5a2a7a', ban: '#1a0a22', ban2: '#0a0410',
    floor: ['#2a1634', '#0c0612'], tile: '255,160,220', line: '6,2,12', fog: '150,60,120', fogA: 0.18, amb: '#ff5aa6', dark: 'rgba(14,4,28,0.55)', torch: '255,90,170',
    flame: ['#c8107a', '#ff4aa6', '#ffd6ee'], post: ['#0c0612', '#3a2050'], moon: { col: '#ff6a74', spot: '#d84a58', r: 34, halo: '255,80,100', x: 360, y: 52 },
    fg: ['#030106', '#0c0612'], acc: ['#7a1428', '#a01c38', '#e0b44a'], farK: 'throne', midK: 'crystals', wallK: 'throne' },
  { sky: ['#0c0620', '#3a1a40', '#e08a2a'], star: '255,240,200', cloud: '255,170,70', far: '#2a1236', far2: '#1a0a24', glow: '255,200,90', win: '#fff0a0', mid: '#1a0c1c',
    tree: '#10060f', wall: '#2a1a2a', wallRGB: [42, 26, 42], arch: '#120812', pil: '#5a3a2a', trim: '#6a4a2a', trim2: '#ffcf5a', ban: '#8a5a10', ban2: '#4a2a08',
    floor: ['#4a3438', '#1a1014'], tile: '255,230,170', line: '12,6,8', fog: '255,190,110', fogA: 0.2, amb: '#ffe08a', dark: 'rgba(30,14,16,0.4)', torch: '255,200,90',
    flame: ['#ffb020', '#ffe070', '#fffbe0'], post: ['#1c1014', '#6a5030'], moon: { col: '#fff1b0', spot: '#ffcf5a', r: 40, halo: '255,210,110', x: 300, y: 56 },
    fg: ['#060204', '#1a0e10'], acc: ['#ffcf5a', '#fff0b0', '#7a5a30'], farK: 'sanctum', midK: 'crystals', wallK: 'sanctum' }
];

function themeSky(c, w, h, T) {
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, T.sky[0]); gr.addColorStop(0.55, T.sky[1]); gr.addColorStop(1, T.sky[2]);
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${T.star},${rnd(0.2, 0.9)})`; c.fillRect(Math.random() * w | 0, Math.random() * h * 0.6 | 0, 1, 1); }
  for (let i = 0; i < 9; i++) { const cx = rnd(40, w - 200), cy = h * 0.22 + Math.random() * h * 0.5; for (let j = 0; j < 5; j++) { c.fillStyle = `rgba(${T.cloud},0.13)`; c.beginPath(); c.ellipse(cx + j * 22, cy + rnd(-3, 3), 40, 5, 0, 0, 7); c.fill(); } }
}

function glowDot(c, x, y, r, rgb, a) {
  const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
}

function hexMix(a, b, t) { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), m = (s) => Math.round((p >> s & 255) * (1 - t) + (q >> s & 255) * t);
  return '#' + [16, 8, 0].map(s => m(s).toString(16).padStart(2, '0')).join(''); } // (the cached mixHex is not ready yet when the themes are built)
function fh(i, s) { return (((i * 73856093) ^ (s * 19349663)) >>> 0) % 1000 / 1000; } // a steady pseudo-random number for a world cell
/* ---- the far layer: the theme's own distant scenery, plus one landmark: the theme's own in act I, the act's own from act II on ---- */
function lmCathedral(c, w, h, T) { // Sunken Marsh: a half-sunken, leaning cathedral tower with green light in its windows
  const bx = 505, by = h - 14;
  glowDot(c, bx, by - 70, 90, T.glow, 0.34);
  c.save(); c.translate(bx, by); c.rotate(-0.12); c.fillStyle = T.far2;
  c.fillRect(-14, -80, 28, 80); c.fillRect(-18, -84, 36, 4);
  c.beginPath(); c.moveTo(-14, -84); c.lineTo(0, -120); c.lineTo(14, -84); c.fill(); c.fillRect(-1, -130, 2, 12); // spire and finial
  c.fillRect(-21, -46, 7, 46); c.fillRect(14, -54, 7, 54); // buttresses
  c.fillRect(-74, -34, 54, 34); for (let i = 0; i < 3; i++) c.fillRect(-74 + i * 20, -40 - (i % 2) * 5, 12, 8); // the broken nave
  c.fillStyle = T.win;
  for (const [wy, wh2] of [[-72, 11], [-54, 12], [-36, 11]]) { c.beginPath(); c.moveTo(-3, wy + wh2); c.lineTo(-3, wy + 3); c.lineTo(0, wy); c.lineTo(3, wy + 3); c.lineTo(3, wy + wh2); c.fill(); }
  for (const nx of [-66, -48, -30]) { c.beginPath(); c.moveTo(nx - 2, -6); c.lineTo(nx - 2, -22); c.lineTo(nx, -26); c.lineTo(nx + 2, -22); c.lineTo(nx + 2, -6); c.fill(); }
  c.restore();
  c.fillStyle = T.far; c.fillRect(bx - 130, h - 34, 260, 40); // the water takes the foot of the tower
  c.fillStyle = 'rgba(140,255,190,0.22)'; c.fillRect(bx - 120, h - 34, 240, 1);
  glowDot(c, bx - 6, h - 26, 16, T.glow, 0.45);
}
function lmFurnace(c, w, h, T) { // Ember Forge: a giant furnace, its barred mouth the face
  const fx = 520, fy = h - 34;
  glowDot(c, fx, fy - 56, 100, '255,140,40', 0.5);
  c.fillStyle = T.far2;
  c.beginPath(); c.moveTo(fx - 92, fy); c.lineTo(fx - 70, fy - 92); c.lineTo(fx - 36, fy - 106); c.lineTo(fx + 36, fy - 106); c.lineTo(fx + 70, fy - 92); c.lineTo(fx + 92, fy); c.fill();
  c.fillRect(fx - 60, fy - 124, 18, 36); c.fillRect(fx + 42, fy - 120, 18, 32); c.fillRect(fx - 64, fy - 126, 26, 5); c.fillRect(fx + 38, fy - 122, 26, 5);
  for (let s = 0; s < 5; s++) { c.fillStyle = `rgba(70,46,40,${0.34 - s * 0.05})`; c.beginPath(); c.ellipse(fx - 51 + s * 7, fy - 134 - s * 10, 9 + s * 4, 5 + s * 2, 0, 0, 7); c.fill(); }
  c.fillStyle = '#ffb43a'; // slanted eyes
  c.beginPath(); c.moveTo(fx - 46, fy - 82); c.lineTo(fx - 16, fy - 74); c.lineTo(fx - 18, fy - 68); c.lineTo(fx - 48, fy - 74); c.fill();
  c.beginPath(); c.moveTo(fx + 46, fy - 82); c.lineTo(fx + 16, fy - 74); c.lineTo(fx + 18, fy - 68); c.lineTo(fx + 48, fy - 74); c.fill();
  const mg = c.createLinearGradient(0, fy - 58, 0, fy - 14); mg.addColorStop(0, '#ffe070'); mg.addColorStop(1, '#ff4a10');
  c.fillStyle = mg; c.beginPath(); c.moveTo(fx - 34, fy - 14); c.lineTo(fx - 34, fy - 48); c.arc(fx, fy - 48, 34, Math.PI, 0); c.lineTo(fx + 34, fy - 14); c.fill(); // the glowing mouth
  c.fillStyle = T.far2; for (let b = -3; b <= 3; b++) c.fillRect(fx + b * 9 - 1.5, fy - 80, 3, 66); c.fillRect(fx - 36, fy - 36, 72, 3);
}
function lmThrone(c, w, h, T) { // Obsidian Throne: a spiked throne at the top of a stair, red light behind it
  const kx = 470, gy = h - 34;
  glowDot(c, kx, gy - 62, 90, '255,40,70', 0.5);
  c.fillStyle = T.far2;
  for (let s = 0; s < 5; s++) c.fillRect(kx - 70 + s * 9, gy - s * 7 - 7, 140 - s * 18, 8);
  c.fillRect(kx - 26, gy - 40, 52, 5);
  c.fillRect(kx - 16, gy - 56, 32, 17); c.fillRect(kx - 26, gy - 54, 10, 4); c.fillRect(kx + 16, gy - 54, 10, 4);
  c.fillRect(kx - 13, gy - 90, 26, 36);
  c.beginPath(); c.moveTo(kx - 13, gy - 90); c.lineTo(kx, gy - 106); c.lineTo(kx + 13, gy - 90); c.fill();
  for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.3; c.beginPath(); c.moveTo(kx + i * 3.6 - 2, gy - 82); c.lineTo(kx + Math.cos(a) * 30 + i * 2, gy - 82 + Math.sin(a) * 26); c.lineTo(kx + i * 3.6 + 2, gy - 82); c.fill(); }
  c.fillStyle = T.win; c.fillRect(kx - 2, gy - 76, 4, 8);
  c.strokeStyle = 'rgba(255,60,110,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(kx + 13, gy - 90); c.lineTo(kx + 13, gy - 54); c.lineTo(kx + 16, gy - 54); c.stroke();
}
function lmHeart(c, w, h, T) { // Heart-Ember Sanctum: the dome, and the Heart-Ember floating above it
  const dx = 470, by = h - 34;
  glowDot(c, dx, by - 80, 150, T.glow, 0.5);
  c.fillStyle = T.far2; c.beginPath(); c.ellipse(dx, by, 78, 56, 0, Math.PI, 0); c.fill(); c.fillRect(dx - 86, by - 4, 172, 8);
  c.strokeStyle = 'rgba(255,200,90,0.55)'; c.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(dx + i * 11, by); c.quadraticCurveTo(dx + i * 13, by - 44, dx + i * 3, by - 56); c.stroke(); }
  c.strokeStyle = '#ffd070'; c.lineWidth = 2; c.beginPath(); c.ellipse(dx, by, 78, 56, 0, Math.PI, 0); c.stroke(); c.fillStyle = '#ffd070'; c.fillRect(dx - 86, by - 4, 172, 2);
  c.fillStyle = T.far2; c.fillRect(dx - 6, by - 70, 12, 14); c.fillRect(dx - 3, by - 76, 6, 7);
  const hy = by - 94;
  glowDot(c, dx, hy, 62, '255,240,180', 0.85);
  c.strokeStyle = 'rgba(255,230,150,0.32)'; c.lineWidth = 1; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(dx + Math.cos(a) * 18, hy + Math.sin(a) * 18); c.lineTo(dx + Math.cos(a) * (34 + (i % 2) * 12), hy + Math.sin(a) * (34 + (i % 2) * 12)); c.stroke(); }
  c.fillStyle = '#fff2b8'; c.beginPath(); c.moveTo(dx, hy - 19); c.lineTo(dx + 11, hy - 2); c.lineTo(dx + 6, hy + 14); c.lineTo(dx - 6, hy + 14); c.lineTo(dx - 11, hy - 2); c.fill();
  c.fillStyle = '#ffc850'; c.beginPath(); c.moveTo(dx, hy - 19); c.lineTo(dx + 11, hy - 2); c.lineTo(dx, hy + 14); c.fill();
  c.fillStyle = '#fffbe0'; c.beginPath(); c.moveTo(dx, hy - 12); c.lineTo(dx - 4, hy); c.lineTo(dx, hy + 6); c.lineTo(dx + 3, hy); c.fill();
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.4, r = 26 + (i % 3) * 9, sx = dx + Math.cos(a) * r, sy = hy + Math.sin(a) * r * 0.8, sz = 1.5 + (i % 2);
    c.fillStyle = '#ffd070'; c.beginPath(); c.moveTo(sx, sy - sz * 1.5); c.lineTo(sx + sz, sy); c.lineTo(sx, sy + sz * 1.5); c.lineTo(sx - sz, sy); c.fill(); }
}
function lmAct(c, w, h, T, act) { // the landmark of acts II-VII, in the middle of the far layer
  const gy = h - 34, X = 480;
  if (act !== 4 && act !== 5 && act !== 6) glowDot(c, X, gy - 56, 150, T.glow, 0.42); // a soft backlight so the dark landmark stands out of the sky
  const dune = (cx, wd, ht) => { c.beginPath(); c.moveTo(cx - wd, h); c.quadraticCurveTo(cx - wd * 0.3, gy - ht, cx, gy - ht); c.quadraticCurveTo(cx + wd * 0.5, gy - ht + 4, cx + wd, h); c.fill(); };
  if (act === 1) { // II  Shattered Bridge: a stone bridge broken in the middle, blue mist below
    const y0 = gy - 54, span = (a, b) => { const m = (a + b) / 2; c.beginPath(); c.moveTo(a, y0); c.lineTo(b, y0); c.lineTo(b, y0 + 30); c.quadraticCurveTo(m, y0 - 10, a, y0 + 30); c.closePath(); c.fill(); };
    glowDot(c, X, y0 + 30, 80, '120,170,255', 0.3); c.fillStyle = T.far2;
    span(300, 366); span(366, 432); span(528, 594); span(594, 660);
    for (const [px, ph] of [[300, 0], [366, 0], [432, 14], [528, 10], [594, 0], [660, 0]]) c.fillRect(px - 6, y0 + 28 + ph, 12, gy - y0 - 28 - ph + 6);
    for (let i = 0; i < 12; i++) { c.fillRect(300 + i * 12, y0 - 7, 7, 4); if (i < 7) c.fillRect(530 + i * 12 + 4, y0 - 7, 7, 4); }
    c.beginPath(); c.moveTo(432, y0); c.lineTo(452, y0 + 6); c.lineTo(440, y0 + 14); c.lineTo(450, y0 + 24); c.lineTo(432, y0 + 30); c.fill();
    c.beginPath(); c.moveTo(528, y0); c.lineTo(510, y0 + 8); c.lineTo(520, y0 + 16); c.lineTo(508, y0 + 26); c.lineTo(528, y0 + 30); c.fill();
    for (const [bx, by, an] of [[470, y0 + 22, 0.4], [486, y0 + 40, -0.6], [498, y0 + 12, 0.9], [478, y0 + 58, 0.2], [466, y0 + 74, -0.3]]) { c.save(); c.translate(bx, by); c.rotate(an); c.fillRect(-5, -4, 10, 8); c.restore(); }
    for (let i = 0; i < 16; i++) { c.fillStyle = 'rgba(140,185,245,0.15)'; c.beginPath(); c.ellipse(290 + i * 26, gy - 2 + (i % 3) * 5, 42, 9, 0, 0, 7); c.fill(); }
  } else if (act === 2) { // III  Ashen Wastes: ash dunes, burnt trees, falling ash
    c.fillStyle = T.far2; dune(300, 90, 26); dune(380, 130, 40); dune(560, 150, 56); dune(700, 90, 30);
    c.strokeStyle = 'rgba(255,225,200,0.13)'; c.lineWidth = 1; c.beginPath(); c.moveTo(430, gy - 38); c.quadraticCurveTo(520, gy - 58, 600, gy - 44); c.stroke();
    c.strokeStyle = '#06030a'; c.lineCap = 'round';
    for (const [tx, ty, th2] of [[350, gy - 24, 40], [418, gy - 34, 56], [510, gy - 50, 62], [586, gy - 46, 48], [660, gy - 24, 38]]) {
      c.lineWidth = 3; c.beginPath(); c.moveTo(tx, ty + 4); c.quadraticCurveTo(tx + rnd(-5, 5), ty - th2 * 0.5, tx + rnd(-3, 3), ty - th2); c.stroke();
      c.lineWidth = 1.5; for (let b = 0; b < 3; b++) { const by = ty - th2 * (0.35 + b * 0.22), dir = b % 2 ? 1 : -1; c.beginPath(); c.moveTo(tx, by); c.lineTo(tx + dir * rnd(7, 13), by - rnd(4, 9)); c.stroke(); }
    }
    c.strokeStyle = 'rgba(210,195,185,0.22)'; for (let i = 0; i < 54; i++) { const ax = rnd(280, 700), ay = rnd(10, gy - 20); c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 4, ay + rnd(6, 14)); c.stroke(); }
  } else if (act === 3) { // IV  Withered Wilds: giant dry trees, thorny vines
    c.strokeStyle = T.far2; c.fillStyle = T.far2; c.lineCap = 'round';
    const br = (x, y, len, ang, wd, d) => { if (d > 3 || len < 6) return; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; c.lineWidth = wd;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); br(x2, y2, len * rnd(0.62, 0.78), ang - rnd(0.3, 0.7), wd * 0.65, d + 1);
      br(x2, y2, len * rnd(0.55, 0.75), ang + rnd(0.3, 0.7), wd * 0.65, d + 1); if (d === 1) br(x2, y2, len * 0.5, ang + rnd(-0.2, 0.2), wd * 0.6, d + 1); };
    for (const [tx, tl, tw] of [[390, 34, 9], [490, 42, 11], [590, 32, 8]]) br(tx, gy + 2, tl, -Math.PI / 2 + rnd(-0.1, 0.1), tw, 0);
    const vine = (x0, y0, dir) => { c.lineWidth = 2; const pts = []; c.beginPath(); c.moveTo(x0, y0);
      for (let t = 0; t <= 1.001; t += 0.05) { const x = x0 + dir * (t * 56 + Math.sin(t * 9) * 8), y = y0 - t * 64 - Math.sin(t * 5) * 6; pts.push([x, y]);
      c.lineTo(x, y); } c.stroke(); for (let i = 2; i < pts.length; i += 2) { const [x, y] = pts[i]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dir * 4, y - 6);
      c.lineTo(x + dir, y); c.fill(); } };
    vine(340, gy + 2, 1); vine(440, gy + 2, -1); vine(540, gy + 2, 1); vine(640, gy + 2, -1);
  } else if (act === 4) { // V  Gilded Dunes: a buried giant stone head, a huge sun
    glowDot(c, 430, gy - 52, 140, '255,215,120', 0.55); c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(430, gy - 52, 36, 0, 7); c.fill(); c.fillStyle = '#fff6cc'; c.beginPath(); c.arc(430, gy - 52, 26, 0, 7); c.fill();
    const hx = 545, hy = gy + 4;
    c.beginPath(); c.moveTo(hx - 58, hy); c.lineTo(hx - 56, hy - 30); c.lineTo(hx - 50, hy - 42); c.lineTo(hx - 55, hy - 48); c.lineTo(hx - 49, hy - 52);
      c.lineTo(hx - 58, hy - 62); c.lineTo(hx - 47, hy - 68); c.lineTo(hx - 51, hy - 76); c.lineTo(hx - 45, hy - 90);
      c.quadraticCurveTo(hx - 20, hy - 106, hx + 20, hy - 96); c.quadraticCurveTo(hx + 52, hy - 80, hx + 46, hy); c.closePath();
    c.fillStyle = hexMix(T.far2, '#ffd9a0', 0.16); c.fill();
    c.strokeStyle = 'rgba(255,225,160,0.4)'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#05030a'; c.fillRect(hx - 44, hy - 73, 11, 3); c.fillRect(hx - 50, hy - 50, 9, 2); // eye and mouth
    c.fillStyle = hexMix(T.far2, '#ffd9a0', 0.1); c.fillRect(hx - 8, hy - 100, 28, 7); // a band of the crown
    c.fillStyle = T.far2; dune(500, 120, 20); dune(600, 100, 16); dune(380, 100, 22);
  } else if (act === 5) { // VI  Eclipse Gate: a black sun with a ring of light, a glowing gate
    const sx = 535, sy = 40;
    glowDot(c, sx, sy, 100, '255,200,140', 0.45);
    for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283, l = 36 + (i % 3) * 9; c.strokeStyle = 'rgba(255,225,170,0.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx + Math.cos(a) * 26, sy + Math.sin(a) * 26); c.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); c.stroke(); }
    c.strokeStyle = 'rgba(255,235,190,0.8)'; c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy, 25, 0, 7); c.stroke(); c.fillStyle = '#000'; c.beginPath(); c.arc(sx, sy, 24, 0, 7); c.fill();
    const gx = 420; glowDot(c, gx, gy - 30, 70, T.glow, 0.5);
    c.fillStyle = T.far2; c.fillRect(gx - 36, gy - 56, 12, 58); c.fillRect(gx + 24, gy - 56, 12, 58);
    c.beginPath(); c.moveTo(gx - 36, gy - 56); c.arc(gx, gy - 56, 36, Math.PI, 0); c.lineTo(gx + 24, gy - 56); c.arc(gx, gy - 56, 24, 0, Math.PI, true); c.closePath(); c.fill();
    const ig = c.createLinearGradient(0, gy - 82, 0, gy); ig.addColorStop(0, '#fff3c0'); ig.addColorStop(1, `rgb(${T.glow})`);
    c.fillStyle = ig; c.beginPath(); c.moveTo(gx - 24, gy); c.lineTo(gx - 24, gy - 56); c.arc(gx, gy - 56, 24, Math.PI, 0); c.lineTo(gx + 24, gy); c.fill();
    c.fillStyle = 'rgba(255,230,170,0.16)'; c.beginPath(); c.moveTo(gx - 22, gy); c.lineTo(gx + 22, gy); c.lineTo(gx + 90, h); c.lineTo(gx - 90, h); c.fill();
  } else if (act === 6) { // VII  World-Forge: a forge-mountain with rivers of lava, the first flame on its peak
    glowDot(c, 500, gy, 130, '255,110,30', 0.32);
    c.fillStyle = T.far2; c.beginPath(); c.moveTo(250, h); c.lineTo(330, gy - 24); c.lineTo(392, gy - 46); c.lineTo(444, gy - 78); c.lineTo(476, gy - 92);
      c.lineTo(500, gy - 100); c.lineTo(524, gy - 90); c.lineTo(552, gy - 76); c.lineTo(596, gy - 50); c.lineTo(650, gy - 28); c.lineTo(730, h); c.fill();
    c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#ff7a20'; c.shadowBlur = 8;
    for (const [pts, wd] of [[[[498, gy - 92], [486, gy - 70], [496, gy - 52], [480, gy - 30], [488, gy - 4]], 3], [[[506, gy - 88], [528, gy - 66], [518, gy - 46], [542,
      gy - 26], [534, gy - 4]], 2.4], [[[470, gy - 80], [446, gy - 58], [454, gy - 40], [430, gy - 22]], 2], [[[538, gy - 74], [566, gy - 52], [584, gy - 34], [576,
      gy - 8]], 2]]) {
      c.strokeStyle = 'rgba(255,120,30,0.95)'; c.lineWidth = wd; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
      c.shadowBlur = 0; c.strokeStyle = '#ffd070'; c.lineWidth = Math.max(0.8, wd * 0.35); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); c.shadowBlur = 8;
    }
    c.shadowBlur = 0; glowDot(c, 500, gy - 104, 36, '255,210,110', 0.9);
    c.fillStyle = '#ffeaa0'; c.beginPath(); c.moveTo(500, gy - 126); c.quadraticCurveTo(510, gy - 112, 500, gy - 102); c.quadraticCurveTo(490, gy - 112, 500, gy - 126); c.fill();
    c.fillStyle = '#ff9a2a'; c.beginPath(); c.moveTo(500, gy - 116); c.quadraticCurveTo(505, gy - 108, 500, gy - 103); c.quadraticCurveTo(495, gy - 108, 500, gy - 116); c.fill();
  }
}
function themeFar(c, w, h, T) {
  c.fillStyle = T.far; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) c.lineTo(x, h - 52 - periodic(x, 1.3) * 16);
  c.lineTo(w, h); c.fill();
  const k = T.farK, act = T.act | 0, mid = x => x > 340 && x < 620; // the middle of the layer belongs to the landmark
  if (k === 'castle') {
    for (const cx0 of act ? [800] : [330, 800]) {
      glowDot(c, cx0 + 40, h - 60, 95, T.glow, 0.38);
      c.fillStyle = T.far2; c.fillRect(cx0, h - 92, 80, 52); c.fillRect(cx0 - 14, h - 112, 22, 72); c.fillRect(cx0 + 72, h - 106, 22, 66); c.fillRect(cx0 + 30, h - 124, 20, 84);
      for (let t = 0; t < 4; t++) { c.fillRect(cx0 - 14 + t * 6, h - 116, 4, 5); c.fillRect(cx0 + 72 + t * 6, h - 110, 4, 5); }
      c.beginPath(); c.moveTo(cx0 + 28, h - 124); c.lineTo(cx0 + 40, h - 146); c.lineTo(cx0 + 52, h - 124); c.fill();
      c.fillStyle = T.win; for (const [wx, wy] of [[cx0 + 10, h - 80], [cx0 + 60, h - 80], [cx0 + 38, h - 108], [cx0 - 6, h - 98], [cx0 + 80, h - 92]]) c.fillRect(wx, wy, 3, 5);
    }
    c.fillStyle = T.far2;
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 135 + rnd(-20, 20), bw = rnd(14, 26), bh = rnd(50, 95); if (act && mid(x)) continue;
      c.fillStyle = T.far2; c.fillRect(x, h - 40 - bh, bw, bh + 40); c.fillRect(x - 3, h - 40 - bh, bw + 6, 4);
      for (let t = 0; t < 3; t++) c.fillRect(x - 3 + t * (bw / 2 + 1), h - 46 - bh, 4, 6);
      c.fillStyle = T.win; c.fillRect(x + bw / 2 - 1, h - 40 - bh * 0.6, 2, 4);
    }
  } else if (k === 'marsh') {
    for (let i = 0; i < 6; i++) { // dead trees with hanging moss
      const x = 70 + i * 150 + rnd(-25, 25), th = rnd(70, 105); if (mid(x)) continue;
      c.strokeStyle = T.far2; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, h - 30); c.quadraticCurveTo(x + rnd(-14, 14), h - 30 - th * 0.55, x + rnd(-10, 10), h - 30 - th); c.stroke();
      c.lineWidth = 3;
      for (let b = 0; b < 5; b++) { const by = h - 30 - th * (0.4 + b * 0.12), dir = b % 2 ? 1 : -1; c.beginPath(); c.moveTo(x, by);
        c.quadraticCurveTo(x + dir * 14, by - 10, x + dir * (24 + b * 4), by - 4 + b * 3); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + dir * 18, by - 8);
        c.lineTo(x + dir * 24, by - 18); c.stroke(); c.lineWidth = 3; }
      c.strokeStyle = 'rgba(80,150,110,0.5)'; c.lineWidth = 1;
      for (let m = 0; m < 7; m++) { const mx = x + rnd(-26, 26), my = h - 30 - th * rnd(0.55, 0.95); c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + rnd(-2, 2), my + rnd(14, 30)); c.stroke(); }
    }
    for (let i = 0; i < 14; i++) glowDot(c, rnd(0, w), rnd(h - 110, h - 40), 9, '160,255,190', 0.7); // will-o'-the-wisps
    if (!act) lmCathedral(c, w, h, T);
  } else if (k === 'forge') {
    for (const cx0 of [60, 190, 760, 880]) {
      const ch = rnd(60, 90); c.fillStyle = T.far2; c.fillRect(cx0, h - 36 - ch, 14, ch + 36); c.fillRect(cx0 - 3, h - 36 - ch, 20, 5);
      glowDot(c, cx0 + 7, h - 38 - ch, 22, '255,140,40', 0.5);
      for (let s = 0; s < 5; s++) { c.fillStyle = `rgba(70,46,40,${0.32 - s * 0.05})`; c.beginPath(); c.ellipse(cx0 + 7 + s * 5, h - 44 - ch - s * 11, 9 + s * 4, 5 + s * 2, 0, 0, 7); c.fill(); }
    }
    const sg2 = c.createLinearGradient(0, h - 16, 0, h); sg2.addColorStop(0, 'rgba(255,120,30,0)'); sg2.addColorStop(1, 'rgba(255,120,30,0.55)'); c.fillStyle = sg2; c.fillRect(0, h - 16, w, 16);
    if (!act) lmFurnace(c, w, h, T);
  } else if (k === 'sanctum') {
    for (let i = 0; i < 8; i++) { const x = 30 + i * 120, bh = rnd(60, 115); if (mid(x)) continue; c.fillStyle = T.far2; c.fillRect(x, h - 36 - bh, 16, bh + 36); c.fillRect(x - 4, h - 36 - bh, 24, 5); glowDot(c, x + 8, h - 40 - bh, 14, '255,200,90', 0.5); }
    if (!act) lmHeart(c, w, h, T); else glowDot(c, 470, h - 90, 120, T.glow, 0.3);
  } else { // throne
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 105 + rnd(-15, 15), bh = rnd(70, 130), bw = rnd(10, 20); if (mid(x)) continue;
      c.fillStyle = T.far2; c.beginPath(); c.moveTo(x - bw, h - 36); c.lineTo(x - bw * 0.3, h - 36 - bh); c.lineTo(x, h - 36 - bh - 18); c.lineTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.fill();
      c.strokeStyle = 'rgba(255,60,90,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.stroke();
    }
    for (let i = 0; i < 12; i++) { const sx = rnd(0, w), sy = rnd(20, h - 90), sz = rnd(3, 7); if (mid(sx)) continue; c.fillStyle = T.far2; c.beginPath();
      c.moveTo(sx, sy - sz * 1.6); c.lineTo(sx + sz, sy); c.lineTo(sx, sy + sz * 1.6); c.lineTo(sx - sz, sy); c.fill(); c.fillStyle = 'rgba(255,60,90,0.5)';
      c.fillRect(sx - 1, sy - 1, 2, 2); }
    if (!act) lmThrone(c, w, h, T);
  }
  if (act) lmAct(c, w, h, T, act);
}

function themeMid(c, w, h, T) {
  c.fillStyle = T.mid; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 3) c.lineTo(x, h - 26 - periodic(x + 90, 2.1) * 12);
  c.lineTo(w, h); c.fill();
  const k = T.midK;
  if (k === 'trees') {
    c.strokeStyle = T.tree; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x = i * 106 + rnd(0, 40), y = h - 20; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-3, 3), y - 34); c.moveTo(x, y - 20); c.lineTo(x + 10, y - 32); c.moveTo(x, y - 26); c.lineTo(x - 9, y - 38); c.stroke(); }
  } else if (k === 'reeds') {
    c.strokeStyle = T.tree; c.lineWidth = 1;
    for (let i = 0; i < 130; i++) { const x = rnd(0, w), y = h - 16 - rnd(0, 8), L = rnd(18, 40), lean = rnd(-5, 5); c.beginPath(); c.moveTo(x, y); c.lineTo(x + lean, y - L); c.stroke(); if (i % 3 === 0) { c.fillStyle = '#2a1e14'; c.fillRect(x + lean - 1, y - L - 5, 3, 7); } }
    c.lineWidth = 2; for (let i = 0; i < 6; i++) { const x = i * 160 + rnd(0, 60), y = h - 18; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-3, 3), y - 36); c.moveTo(x, y - 22); c.lineTo(x + 9, y - 33); c.stroke(); }
  } else if (k === 'pipes') {
    c.fillStyle = T.tree; c.fillRect(0, h - 50, w, 6); c.fillRect(0, h - 40, w, 3);
    for (let x = 20; x < w; x += 80) { c.fillRect(x, h - 50, 5, 40); c.fillRect(x - 3, h - 12, 11, 4); }
    for (const gx of [130, 350, 610, 830]) { c.beginPath(); c.arc(gx, h - 34, 13, 0, 7); c.fill(); for (let t = 0; t < 10; t++) { const a = t / 10 * Math.PI * 2;
      c.fillRect(gx + Math.cos(a) * 14 - 2, h - 34 + Math.sin(a) * 14 - 2, 4, 4); } c.fillStyle = T.mid; c.beginPath(); c.arc(gx, h - 34, 4, 0, 7); c.fill();
      c.fillStyle = T.tree; }
    for (let x = 60; x < w; x += 160) glowDot(c, x, h - 47, 8, '255,150,50', 0.6);
  } else {
    for (let i = 0; i < 18; i++) { const x = rnd(0, w), n = 2 + (i % 3); for (let j = 0; j < n; j++) { const bx = x + j * 7, bh = rnd(14, 34); c.fillStyle = T.tree;
      c.beginPath(); c.moveTo(bx - 4, h - 14); c.lineTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.fill(); c.strokeStyle = 'rgba(255,60,90,0.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.stroke(); } }
  }
  if (k === 'pipes') midScaffold(c, w, h, T);
}

function themeWall(c, w, h, T) {
  c.fillStyle = T.wall; c.fillRect(0, 70, w, h - 70);
  const [r0, g0, b0] = T.wallRGB;
  for (let x = 0; x < w; x += 8) for (let y = 70; y < h; y += 8) { c.fillStyle = `rgb(${r0 + rnd(-8, 8) | 0},${g0 + rnd(-6, 6) | 0},${b0 + rnd(-8, 8) | 0})`; c.fillRect(x, y, 7, 7); }
  for (let x = 0; x < w; x += 160) {
    c.beginPath(); c.moveTo(x + 24, h); c.lineTo(x + 24, 92); c.arc(x + 80, 92, 56, Math.PI, 0); c.lineTo(x + 136, h);
    c.globalCompositeOperation = 'destination-out'; c.fill(); c.globalCompositeOperation = 'source-over'; // the arches are windows: the sky and the far landmark show through
    const ag = c.createLinearGradient(0, 36, 0, h); ag.addColorStop(0, T.arch + '3a'); ag.addColorStop(1, T.arch + 'b0'); c.fillStyle = ag; c.fill(); // a dark haze over the view, deeper toward the floor
    c.fillStyle = T.pil; c.fillRect(x, 64, 14, h - 64); c.fillRect(x - 3, 60, 20, 6);
  }
  if (T.wallK === 'sanctum') { c.strokeStyle = T.trim2; c.lineWidth = 2; for (let x = 0; x < w; x += 160) { c.beginPath(); c.moveTo(x + 24, h); c.lineTo(x + 24, 92);
    c.arc(x + 80, 92, 56, Math.PI, 0); c.lineTo(x + 136, h); c.stroke(); } c.strokeStyle = 'rgba(255,240,170,0.45)'; c.lineWidth = 1;
    for (let x = 0; x < w; x += 160) { c.beginPath(); c.moveTo(x + 29, h); c.lineTo(x + 29, 92); c.arc(x + 80, 92, 51, Math.PI, 0); c.lineTo(x + 131, h); c.stroke();
    } } // gilded arches
  const k = T.wallK;
  for (let x = 0; x < w; x += 160) {
    if (k === 'gate') {
      const bx = x + 71; c.fillStyle = T.ban; c.beginPath(); c.moveTo(bx, 66); c.lineTo(bx + 18, 66); c.lineTo(bx + 18, 118); c.lineTo(bx + 9, 110); c.lineTo(bx, 118); c.fill();
      c.fillStyle = T.ban2; c.fillRect(bx + 12, 66, 6, 50); c.fillStyle = '#d9a93a'; c.fillRect(bx - 1, 64, 20, 3);
      c.beginPath(); c.moveTo(bx + 9, 80); c.lineTo(bx + 14, 88); c.lineTo(bx + 9, 96); c.lineTo(bx + 4, 88); c.fill();
    } else if (k === 'marsh') {
      for (let v = 0; v < 7; v++) { const vx = x + 28 + rnd(0, 104), vl = rnd(20, 56); c.strokeStyle = '#2a6a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(vx, 70); c.lineTo(vx + rnd(-2, 2), 70 + vl); c.stroke(); c.fillStyle = '#3a8a4a'; c.fillRect(vx - 2, 70 + vl, 4, 3); }
      c.strokeStyle = '#1a2a20'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 80, 66); c.lineTo(x + 80, 84); c.stroke();
      glowDot(c, x + 80, 92, 22, '120,255,160', 0.5); c.fillStyle = '#0c1a12'; c.fillRect(x + 75, 84, 10, 12); c.fillStyle = '#9dffb0'; c.fillRect(x + 77, 86, 6, 8);
    } else if (k === 'forge') {
      glowDot(c, x + 80, 112, 46, '255,140,40', 0.5);
      c.fillStyle = '#0c0504'; c.fillRect(x + 58, 96, 44, 36); const fgr = c.createLinearGradient(0, 98, 0, 130); fgr.addColorStop(0, '#ffcf5a'); fgr.addColorStop(1, '#ff4a10'); c.fillStyle = fgr; c.fillRect(x + 61, 99, 38, 30);
      c.fillStyle = '#1a0c08'; for (let b = 0; b < 4; b++) c.fillRect(x + 66 + b * 9, 99, 2, 30);
      c.fillStyle = '#5a3a2a'; for (const cx of [x + 40, x + 120]) for (let l = 0; l < 7; l++) c.fillRect(cx - 1 + (l % 2), 66 + l * 6, 3, 4);
      c.fillStyle = '#8a5a3a'; for (let r = 70; r < h - 8; r += 12) { c.fillRect(x + 3, r, 2, 2); c.fillRect(x + 9, r, 2, 2); }
    } else if (k === 'sanctum') {
      glowDot(c, x + 80, 108, 44, '255,200,90', 0.35);
      c.fillStyle = '#ffcf5a'; for (let r = 74; r < h - 10; r += 12) { c.fillRect(x + 3, r, 7, 2); c.fillRect(x + 3 + (r % 5), r + 4, 2, 4); }
      const bx = x + 71; c.fillStyle = T.ban; c.beginPath(); c.moveTo(bx, 66); c.lineTo(bx + 18, 66); c.lineTo(bx + 18, 118); c.lineTo(bx + 9, 110); c.lineTo(bx, 118); c.fill();
      c.fillStyle = '#ffe9a0'; c.beginPath(); c.moveTo(bx + 9, 78); c.lineTo(bx + 14, 90); c.lineTo(bx + 9, 102); c.lineTo(bx + 4, 90); c.fill();
    } else {
      c.fillStyle = '#ff4a5a'; for (let r = 72; r < h - 10; r += 14) { c.fillRect(x + 4, r, 6, 2); c.fillRect(x + 4 + (r % 3), r + 4, 2, 5); }
      const bx = x + 71; c.fillStyle = T.ban; c.beginPath(); c.moveTo(bx, 66); c.lineTo(bx + 18, 66); c.lineTo(bx + 18, 118); c.lineTo(bx + 9, 110); c.lineTo(bx, 118); c.fill();
      c.fillStyle = '#ff4a5a'; c.fillRect(bx - 1, 64, 20, 2); c.beginPath(); c.moveTo(bx + 3, 92); c.lineTo(bx + 3, 82); c.lineTo(bx + 6, 87); c.lineTo(bx + 9, 80); c.lineTo(bx + 12, 87); c.lineTo(bx + 15, 82); c.lineTo(bx + 15, 92); c.fill();
    }
  }
  c.fillStyle = T.trim; c.fillRect(0, h - 6, w, 6); c.fillStyle = T.trim2; c.fillRect(0, h - 6, w, 1);
}

const buildTheme = T => Object.assign({}, T, {
  skyL: makeLayer((c, w, h) => themeSky(c, w, h, T)),
  farL: makeLayer((c, w, h) => themeFar(c, w, h, T)),
  midL: makeLayer((c, w, h) => themeMid(c, w, h, T)),
  wallL: makeLayer((c, w, h) => themeWall(c, w, h, T), GROUND_TOP + 6)
});
const THEMES = THEME_DEF.map(buildTheme);
/* act palettes: later acts regrade every colour of a theme (frost, deep crimson, violet-gold) */
const ACT_GRADE = [{ c: null, s: 1, l: 1 }, { c: 205, k: 0.75, s: 0.85, l: 1.1 }, { c: 355, k: 0.7, s: 1.15, l: 0.92 }, { c: 128, k: 0.68, s: 1.05, l: 0.95 }, { c: 42, k: 0.66, s: 1.15, l: 1.08 }, { c: 330, k: 0.72, s: 1.2, l: 0.78 }, { c: 275, k: 0.7, s: 1.05, l: 1.02 }];
function gradeRGB(r, g, b, G) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  if (G.c !== null) { const dh = ((G.c - h + 540) % 360) - 180; h = ((h + dh * G.k) % 360 + 360) % 360; } s = Math.min(1, s * G.s); l = Math.min(0.95, l * G.l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return s === 0 ? [l, l, l].map(v => Math.round(v * 255)) : [f(h / 360 + 1 / 3), f(h / 360), f(h / 360 - 1 / 3)].map(v => Math.round(v * 255));
}
function gradeVal(v, G) {
  if (typeof v === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(v)) { const n = parseInt(v.slice(1), 16), c = gradeRGB(n >> 16 & 255, n >> 8 & 255, n & 255, G); return '#' + c.map(x => x.toString(16).padStart(2, '0')).join(''); }
    if (/^\d+,\d+,\d+$/.test(v)) { const a = v.split(',').map(Number); return gradeRGB(a[0], a[1], a[2], G).join(','); }
    const m = v.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/); if (m) return 'rgba(' + gradeRGB(+m[1], +m[2], +m[3], G).join(',') + ',' + m[4] + ')';
    return v;
  }
  if (Array.isArray(v)) return (v.length === 3 && typeof v[0] === 'number') ? gradeRGB(v[0], v[1], v[2], G) : v.map(x => gradeVal(x, G));
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = gradeVal(v[k], G); return o; }
  return v;
}
const _actThemes = {};
function themeFor(idx, act) {
  act = Math.max(0, Math.min(6, act | 0)); if (!act) return THEMES[idx];
  const key = act + ':' + idx; if (!_actThemes[key]) { const T = {}; for (const k in THEME_DEF[idx]) T[k] = k === 'fogA' ? THEME_DEF[idx][k] : gradeVal(THEME_DEF[idx][k], ACT_GRADE[act]); T.act = act; _actThemes[key] = buildTheme(T); }
  return _actThemes[key];
}
const actOf = si => Math.min(6, (si / 5) | 0);
/* weather: what falls through each act and theme */
const WEATHER = [[null, 'rain', 'sparks', 'storm', 'ash'], ['snow', 'snow', 'blizzard', 'blizzard', 'snow'], ['ash', 'storm', 'ash', 'storm', 'sparks'], ['rain', 'motes',
  'rain', 'storm', 'motes'], ['ash', 'sparks', 'ash', 'storm', 'sparks'], ['storm', 'ash', 'blizzard', 'storm', 'ash'], ['motes', 'rain', 'sparks', 'storm', 'motes']];
let weather = 'ash';
const wh = (i, s) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
function updateWeather() { if ((weather === 'storm') && ((tickN + 137) % 540 === 0 || (tickN + 137) % 540 === 11)) flashA = Math.max(flashA, 0.4); }
function drawWeather() {
  const w = weather; if (!w) return; const t = tickN;
  if (w === 'rain' || w === 'storm') {
    g.fillStyle = 'rgba(170,195,225,0.4)';
    for (let i = 0; i < (w === 'storm' ? 150 : 90); i++) { const sp = 5 + wh(i, 3) * 3, x = ((wh(i, 1) * (W + 40) - t * 0.9) % (W + 40) + W + 40) % (W + 40), y = (wh(i, 2) * H + t * sp) % H; g.fillRect(x | 0, y | 0, 1, 5 + (i % 3)); }
  } else if (w === 'snow' || w === 'blizzard') {
    const wind = w === 'blizzard' ? -2.4 : -0.3, n = w === 'blizzard' ? 170 : 85;
    for (let i = 0; i < n; i++) { const sp = 0.5 + wh(i, 3) * 1.1 + (w === 'blizzard' ? 1.2 : 0), x = ((wh(i, 1) * (W + 60) + t * wind + Math.sin(t * 0.03 + i) * 6) % (W + 60) + W + 60) % (W + 60), y = (wh(i, 2) * H + t * sp) % H;
      g.fillStyle = `rgba(235,245,255,${0.5 + wh(i, 4) * 0.4})`; g.fillRect(x | 0, y | 0, wh(i, 5) > 0.7 ? 2 : 1, wh(i, 5) > 0.7 ? 2 : 1); }
  } else if (w === 'ash') {
    for (let i = 0; i < 70; i++) { const x = ((wh(i, 1) * (W + 30) + t * 0.35 + Math.sin(t * 0.02 + i) * 10) % (W + 30)), y = (wh(i, 2) * H + t * (0.4 + wh(i, 3) * 0.7)) % H; g.fillStyle = i % 9 === 0 ? 'rgba(255,150,70,0.8)' : 'rgba(190,175,170,0.5)'; g.fillRect(x | 0, y | 0, 1, 1); }
  } else if (w === 'sparks') {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) { const x = (wh(i, 1) * W + Math.sin(t * 0.05 + i) * 8 + W) % W, y = H - ((wh(i, 2) * H + t * (0.6 + wh(i, 3) * 1.2)) % H); g.fillStyle = `rgba(255,${130 + wh(i, 4) * 100 | 0},50,${0.4 + 0.4 * Math.abs(Math.sin(t * 0.2 + i))})`; g.fillRect(x | 0, y | 0, 1, 1); }
    g.globalCompositeOperation = 'source-over';
  } else if (w === 'motes') {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 55; i++) { const x = (wh(i, 1) * W + Math.sin(t * 0.017 + i) * 18 + W) % W, y = (wh(i, 2) * H + Math.cos(t * 0.013 + i * 2) * 14 - t * 0.12 * (0.3 + wh(i, 3)) + H * 4) % H;
      g.fillStyle = i % 2 ? `rgba(255,224,140,${0.35 + 0.35 * Math.sin(t * 0.07 + i)})` : `rgba(190,150,255,${0.35 + 0.35 * Math.sin(t * 0.06 + i)})`;
      const s = wh(i, 5) > 0.8 ? 2 : 1; g.fillRect(x | 0, y | 0, s, s); }
    g.globalCompositeOperation = 'source-over';
  }
}

function midScaffold(c, w, h, T) { // Ember Forge, middle layer: scaffolding and a great gear among the pipes
  c.strokeStyle = T.tree; c.fillStyle = T.tree; c.lineCap = 'butt';
  for (const sx of [40, 330, 640, 870]) {
    const sh = rnd(46, 62); c.lineWidth = 2; c.beginPath(); c.moveTo(sx, h - 14); c.lineTo(sx, h - 14 - sh); c.moveTo(sx + 28, h - 14); c.lineTo(sx + 28, h - 14 - sh); c.stroke();
    c.lineWidth = 1; for (let l = 0; l < 3; l++) { const y0 = h - 14 - l * sh / 3; c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx + 28, y0 - sh / 3); c.moveTo(sx + 28, y0); c.lineTo(sx, y0 - sh / 3); c.stroke(); }
    c.fillRect(sx - 6, h - 14 - sh, 40, 3); c.fillRect(sx - 4, h - 14 - sh * 0.5, 36, 2);
  }
  const gx = 500, gy = h - 46, R = 19; c.beginPath(); c.arc(gx, gy, R, 0, 7); c.fill();
  for (let t = 0; t < 12; t++) { const a = t / 12 * Math.PI * 2; c.save(); c.translate(gx + Math.cos(a) * (R + 2), gy + Math.sin(a) * (R + 2)); c.rotate(a); c.fillRect(-3, -3, 6, 6); c.restore(); }
  c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(gx, gy, 6, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
  glowDot(c, gx, gy, 26, '255,150,50', 0.25);
}
/* ---- the floor of each theme, drawn on top of the plain tiles ---- */
function drawFloorFx(T) {
  const k = T.farK, A = T.acc, t = tickN; if (!A || k === 'castle') return;
  if (k === 'marsh') { // a boardwalk over the mud, puddles that hold the moon
    const by0 = 172, by1 = 236, bw = 13, M = T.moon;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, by0 - 3, W, by1 - by0 + 7);
    for (let x = -((cam % bw) + bw) % bw - bw; x < W + bw; x += bw) {
      const i = Math.round((x + cam) / bw), h1 = fh(i, 3); if (h1 > 0.965) continue; // a missing board shows the mud
      const xx = x | 0; g.fillStyle = hexMix(A[0], A[1], Math.round(h1 * 6) / 6); g.fillRect(xx, by0, bw - 1, by1 - by0);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(xx + bw - 2, by0, 1, by1 - by0); g.fillRect(xx + 3 + (i % 3) * 2, by0 + 6 + (fh(i, 5) * 40 | 0), 1, 10);
      g.fillStyle = 'rgba(20,12,6,0.7)'; g.fillRect(xx + 3, by0 + 3, 2, 2); g.fillRect(xx + 3, by1 - 5, 2, 2);
    }
    g.fillStyle = '#17100a'; g.fillRect(0, by0 - 2, W, 3); g.fillRect(0, by1 - 1, W, 3); g.fillStyle = 'rgba(255,230,180,0.18)'; g.fillRect(0, by0 - 2, W, 1);
    for (const [zone, yy, ry, sp] of [[0, 155, 4, 90], [1, 249, 7, 130]]) for (let n = Math.floor((cam - 60) / sp); n <= Math.floor((cam + W + 60) / sp); n++) {
      const hv = fh(n, zone + 7), px = n * sp + hv * sp * 0.7 - cam, py = yy + (fh(n, zone + 9) - 0.5) * 10, rx = 16 + fh(n, zone + 11) * 22; if (px < -50 || px > W + 50) continue;
      g.fillStyle = A[2]; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, 7); g.fill();
      if (M.r) { g.fillStyle = M.col; g.globalAlpha = 0.16; g.beginPath(); g.ellipse(px + rx * 0.1, py, rx * 0.7, ry * 0.8, 0, 0, 7); g.fill(); g.globalAlpha = 0.6; g.beginPath(); g.ellipse(px + rx * 0.1, py, Math.max(2, rx * 0.2), ry * 0.45, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
      if (hv > 0.5) { const rp = (t * 0.02 + hv * 10) % 1; g.strokeStyle = `rgba(200,255,220,${0.28 * (1 - rp)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(px, py, rx * 0.3 + rp * rx * 0.45, ry * 0.3 + rp * ry * 0.5, 0, 0, 7); g.stroke(); }
    }
  } else if (k === 'forge') { // riveted iron, a glowing lava channel at the back, steaming grates
    for (let row = 0; row < 9; row++) { const y = GROUND_TOP + 4 + row * row * 1.6 + row * 6, sp = 24 + row * 7, off0 = -((cam % sp) + sp) % sp, s = row > 4 ? 2 : 1;
      g.fillStyle = 'rgba(210,160,110,0.38)'; for (let x = off0 + (row % 2) * sp / 2 - sp; x < W; x += sp) { g.fillRect((x | 0) + 3, (y | 0) + 2, s, s);
      g.fillRect((x | 0) + sp - 4, (y | 0) + 2, s, s); } }
    g.fillStyle = '#0a0404'; g.fillRect(0, GROUND_TOP, W, 10);
    for (let x = 0; x < W; x += 4) { const v = 0.5 + 0.5 * Math.sin((x + cam) * 0.045 + t * 0.07) * Math.sin((x + cam) * 0.013 - t * 0.03); g.fillStyle = hexMix(A[0], A[1], Math.round(v * 8) / 8); g.fillRect(x, GROUND_TOP + 2, 4, 6); }
    g.fillStyle = '#2a1410'; g.fillRect(0, GROUND_TOP + 8, W, 2); g.fillStyle = 'rgba(255,200,120,0.3)'; g.fillRect(0, GROUND_TOP + 2, W, 1);
    g.save(); g.globalCompositeOperation = 'lighter'; const lg = g.createLinearGradient(0, GROUND_TOP - 14, 0, GROUND_TOP + 30); lg.addColorStop(0, 'rgba(255,120,30,0)');
      lg.addColorStop(0.35, `rgba(255,120,30,${0.26 + 0.05 * Math.sin(t * 0.07)})`); lg.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = lg;
      g.fillRect(0, GROUND_TOP - 14, W, 44); g.restore();
    const gsp = 230; for (let n = Math.floor((cam - 60) / gsp); n <= Math.floor((cam + W + 60) / gsp); n++) {
      const hv = fh(n, 21), gx = n * gsp + hv * 120 - cam, gy = 188 + ((hv * 7 | 0) % 3) * 24, gw = 30 + (gy - 188) / 4; if (gx < -50 || gx > W + 50) continue;
      const x0 = (gx - gw / 2) | 0; g.fillStyle = '#0c0606'; g.fillRect(x0, gy, gw | 0, 9); g.fillStyle = 'rgba(255,120,30,0.5)'; g.fillRect(x0 + 2, gy + 2, (gw | 0) - 4, 5);
      g.fillStyle = '#1c1210'; for (let b = 0; b < gw; b += 5) g.fillRect(x0 + b, gy, 2, 9);
      for (let s = 0; s < 4; s++) { const p = (t * 0.012 + s / 4 + hv) % 1; g.fillStyle = `rgba(225,215,205,${(1 - p) * 0.24})`; g.beginPath(); g.arc(gx + Math.sin(p * 6 + s) * 5, gy - p * 36, 3 + p * 9, 0, 7); g.fill(); }
    }
  } else if (k === 'throne') { // obsidian that holds the torch light, a red carpet with gold edges
    g.save(); g.globalCompositeOperation = 'lighter';
    const sh = ((cam * 0.35) % 360 + 360) % 360; for (let n = -1; n < 3; n++) { const sx = n * 360 - sh + 120, gr = g.createLinearGradient(sx, 0, sx + 90, 0);
      gr.addColorStop(0, 'rgba(255,120,190,0)'); gr.addColorStop(0.5, 'rgba(255,120,190,0.06)'); gr.addColorStop(1, 'rgba(255,120,190,0)'); g.fillStyle = gr;
      g.fillRect(sx, GROUND_TOP, 90, H - GROUND_TOP); }
    for (const tx of torchPositions()) { const x = Math.round(tx - cam), fl = 0.8 + 0.2 * Math.sin(t * 0.2 + tx), rg = g.createLinearGradient(0, GROUND_TOP + 2, 0, GROUND_TOP + 74);
      rg.addColorStop(0, `rgba(${T.torch},${0.5 * fl})`); rg.addColorStop(1, `rgba(${T.torch},0)`); g.fillStyle = rg; g.beginPath(); g.moveTo(x - 5, GROUND_TOP + 2);
      g.lineTo(x + 5, GROUND_TOP + 2); g.lineTo(x + 14, GROUND_TOP + 74); g.lineTo(x - 14, GROUND_TOP + 74); g.fill(); }
    g.restore();
    const c0 = 190, c1 = 226, cy = (c0 + c1) / 2; g.fillStyle = A[0]; g.fillRect(0, c0, W, c1 - c0); g.fillStyle = A[1]; g.globalAlpha = 0.45; g.fillRect(0, c0 + 7, W, c1 - c0 - 14); g.globalAlpha = 1;
    g.fillStyle = A[2]; g.fillRect(0, c0, W, 2); g.fillRect(0, c1 - 2, W, 2); g.fillRect(0, c0 + 5, W, 1); g.fillRect(0, c1 - 6, W, 1);
    const dsp = 44; for (let x = -((cam % dsp) + dsp) % dsp - dsp; x < W + dsp; x += dsp) { const cx = x + dsp / 2; g.fillStyle = A[2]; g.beginPath();
      g.moveTo(cx, cy - 8); g.lineTo(cx + 10, cy); g.lineTo(cx, cy + 8); g.lineTo(cx - 10, cy); g.fill(); g.fillStyle = A[0]; g.beginPath(); g.moveTo(cx, cy - 4);
      g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 5, cy); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, c1, W, 2);
  } else if (k === 'sanctum') { // marble with a gold seal
    g.strokeStyle = 'rgba(255,240,215,0.07)'; g.lineWidth = 1;
    for (let n = Math.floor(cam / 90) - 1; n <= Math.floor((cam + W) / 90) + 1; n++) { const hv = fh(n, 31), x = n * 90 + hv * 60 - cam, y = GROUND_TOP + 14 + fh(n, 33) * 100;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 24, y + 6 + hv * 10, x + 50 + hv * 20, y - 4 + fh(n, 35) * 10); g.stroke(); }
    const per = 620; for (let n = Math.floor((cam - 140) / per); n <= Math.floor((cam + W + 140) / per); n++) {
      const cx = n * per + 310 - cam; if (cx < -150 || cx > W + 150) continue;
      g.save(); g.translate(cx, 208); g.scale(1, 0.26); g.globalAlpha = 0.62; g.strokeStyle = A[0]; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 112, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 102, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 58, 0, 7); g.stroke();
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 104, Math.sin(a) * 104); g.lineTo(Math.cos(a) * 110, Math.sin(a) * 110); g.stroke(); }
      for (let s = 0; s < 2; s++) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = s * Math.PI / 3 + i * 2.094 - Math.PI / 2; g.lineTo(Math.cos(a) * 98, Math.sin(a) * 98); } g.closePath(); g.stroke(); }
      g.fillStyle = A[1]; g.beginPath(); g.moveTo(0, -16); g.lineTo(10, 0); g.lineTo(0, 16); g.lineTo(-10, 0); g.fill(); g.restore();
    }
  }
}
function drawAirFx(T) { // sanctum: light motes drifting through the air
  if (T.farK !== 'sanctum') return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 44; i++) { const px = ((wh(i, 5) * (W + 80) - cam * (0.25 + wh(i, 6) * 0.5) + tickN * 0.08) % (W + 80) + W + 80) % (W + 80) - 40, py = ((wh(i, 7) * H - tickN * (0.12 + wh(i, 8) * 0.3)) % H + H) % H, a = 0.25 + 0.35 * Math.abs(Math.sin(tickN * 0.03 + i * 1.7));
    g.fillStyle = `rgba(255,${200 + wh(i, 9) * 50 | 0},120,${a})`; const s = wh(i, 10) > 0.8 ? 2 : 1; g.fillRect(px | 0, py | 0, s, s); }
  g.restore();
}
/* ---- the foreground: what stands between the camera and the fight, one kind per theme (parallax 1.35, it fades out near the middle of the screen) ---- */
function drawForeground() {
  const T = TH, k = T.farK, A = T.acc || [], t = tickN;
  for (let i = -1; i < 4; i++) {
    const wx = (Math.floor(cam * 1.35 / 520) + i) * 520 + 260, x = Math.round(wx - cam * 1.35);
    const al = clamp((Math.abs(x - W / 2) - 110) / 70, 0, 1); if (al <= 0) continue;
    g.globalAlpha = al;
    if (k === 'marsh') { // hanging moss from above, reeds from below
      for (let m = -6; m <= 6; m++) { const mx = x + m * 14 + ((fh(wx + m, 41) - 0.5) * 8 | 0), ml = 22 + fh(wx + m, 43) * 48, sw = Math.sin(t * 0.025 + m + wx) * 2.5;
        g.strokeStyle = T.fg[0]; g.lineWidth = 3; g.beginPath(); g.moveTo(mx, -2); g.quadraticCurveTo(mx + sw * 0.4, ml * 0.5, mx + sw, ml); g.stroke();
        g.strokeStyle = A[4]; g.globalAlpha = al * 0.5; g.lineWidth = 1; g.beginPath(); g.moveTo(mx + 1, -2);
        g.quadraticCurveTo(mx + 1 + sw * 0.4, ml * 0.5, mx + 1 + sw, ml * 0.8); g.stroke(); g.globalAlpha = al; }
      for (let r = -7; r <= 7; r++) { const rx = x + r * 11 + (fh(wx + r, 47) - 0.5) * 6, rl = 40 + fh(wx + r, 49) * 46, lean = (fh(wx + r, 51) - 0.5) * 18 + Math.sin(t * 0.03 + r * 0.7 + wx) * 3;
        g.strokeStyle = T.fg[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(rx, H + 2); g.quadraticCurveTo(rx + lean * 0.3, H - rl * 0.5, rx + lean, H - rl); g.stroke();
        if (fh(wx + r, 53) > 0.6) { g.fillStyle = '#1e140c'; g.fillRect(rx + lean - 2, H - rl - 10, 4, 12); } }
    } else if (k === 'forge') { // a chain with a hook, a steaming pipe
      const cx0 = x - 40, len = 96 + fh(wx, 61) * 30, sw = Math.sin(t * 0.02 + wx) * 4;
      for (let y = -4, j = 0; y < len; y += 8, j++) { const px = cx0 + sw * y / len; g.strokeStyle = j % 2 ? '#2a1a14' : '#3a261c'; g.lineWidth = 2; if (j % 2) g.strokeRect(px - 3, y, 6, 9); else g.strokeRect(px - 1.5, y, 3, 9); g.fillStyle = 'rgba(255,170,90,0.25)'; g.fillRect(px - 3, y, 1, 8); }
      g.strokeStyle = '#2a1a14'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx0 + sw, len); g.lineTo(cx0 + sw, len + 14); g.arc(cx0 + sw - 8, len + 14, 8, 0, Math.PI * 1.15); g.stroke();
      g.strokeStyle = 'rgba(255,150,70,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx0 + sw + 1, len); g.lineTo(cx0 + sw + 1, len + 14); g.arc(cx0 + sw - 8, len + 14, 9, 0, Math.PI * 1.1); g.stroke();
      const px = x + 70; g.fillStyle = T.fg[1]; g.fillRect(px - 9, 0, 18, H); g.fillStyle = 'rgba(255,170,90,0.2)'; g.fillRect(px - 7, 0, 2, H); g.fillStyle = T.fg[0]; g.fillRect(px + 5, 0, 4, H);
      for (const fy of [28, 120, 214]) { g.fillStyle = T.fg[1]; g.fillRect(px - 13, fy, 26, 8); g.fillStyle = '#6a4a3a'; g.fillRect(px - 11, fy + 3, 2, 2); g.fillRect(px + 9, fy + 3, 2, 2); }
      for (let s = 0; s < 3; s++) { const p = (t * 0.015 + s / 3) % 1; g.fillStyle = `rgba(220,210,200,${(1 - p) * 0.26})`; g.beginPath(); g.arc(px + 13 + p * 14, 120 - p * 30, 3 + p * 7, 0, 7); g.fill(); }
    } else if (k === 'throne') { // an obsidian pillar edged with torch light
      g.fillStyle = T.fg[0]; g.fillRect(x - 14, 0, 28, H); g.fillStyle = T.fg[1]; g.fillRect(x - 14, 0, 4, H);
      g.fillStyle = `rgba(${T.torch},0.35)`; g.fillRect(x + 10, 0, 2, H); g.fillRect(x - 14, 0, 1, H); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x - 6, 0, 3, H);
      g.fillStyle = T.fg[0]; g.fillRect(x - 20, 0, 40, 12); g.fillRect(x - 17, 12, 34, 5); g.fillRect(x - 20, H - 14, 40, 14); g.fillStyle = T.fg[1]; g.fillRect(x - 20, H - 14, 40, 2);
      g.fillStyle = `rgba(${T.torch},0.4)`; g.fillRect(x - 20, 11, 40, 1); g.beginPath(); g.moveTo(x, 66); g.lineTo(x + 5, 74); g.lineTo(x, 82); g.lineTo(x - 5, 74); g.fill();
    } else if (k === 'sanctum') { // a gilded arch
      const ay = 60; g.fillStyle = T.fg[0]; g.beginPath(); g.rect(x - 84, -2, 168, ay + 2); g.moveTo(x + 62, ay); g.arc(x, ay, 62, 0, Math.PI, true); g.closePath(); g.fill('evenodd');
      g.fillRect(x - 84, ay, 22, H - ay); g.fillRect(x + 62, ay, 22, H - ay); g.fillStyle = T.fg[1]; g.fillRect(x - 84, ay, 3, H - ay); g.fillRect(x + 62, ay, 3, H - ay);
      g.strokeStyle = A[0]; g.lineWidth = 2.5; g.beginPath(); g.arc(x, ay, 62, Math.PI, 0); g.stroke(); g.lineWidth = 1; g.strokeStyle = A[1]; g.beginPath(); g.arc(x, ay, 57, Math.PI, 0); g.stroke();
      g.fillStyle = A[0]; g.fillRect(x - 84, ay - 2, 22, 3); g.fillRect(x + 62, ay - 2, 22, 3); g.fillRect(x - 84, H - 12, 22, 3); g.fillRect(x + 62, H - 12, 22, 3); g.beginPath(); g.moveTo(x, -2); g.lineTo(x + 6, 6); g.lineTo(x, 14); g.lineTo(x - 6, 6); g.fill();
    } else { // the castle: plain pillars
      g.fillStyle = T.fg[0]; g.fillRect(x - 12, 0, 24, H); g.fillStyle = T.fg[1]; g.fillRect(x - 12, 0, 3, H);
    }
    g.globalAlpha = 1;
  }
}
/* ---- how a chasm looks in each theme (its width is not touched) ---- */
const PITK = {
  castle: { fill: '#020104', glow: '255,90,20', ga: 0.18, e1: '#7a6a70', e2: '#a8949a', e3: '#100810', sp: '#ff8a2a' },
  marsh: { fill: '#010604', glow: '70,230,140', ga: 0.15, e1: '#364a3a', e2: '#6f8f74', e3: '#06100a', sp: '#8affb0', moss: '#3a8a4a' },
  forge: { fill: '#080202', glow: '255,110,20', ga: 0.34, e1: '#4a3228', e2: '#9a6a44', e3: '#140806', sp: '#ffb43a', lava: true },
  throne: { fill: '#050008', glow: '255,50,120', ga: 0.22, e1: '#3a2a4e', e2: '#8a5ab0', e3: '#0a0412', sp: '#ff5aa6' },
  sanctum: { fill: '#0a0612', glow: '255,215,120', ga: 0.24, e1: '#7a6a58', e2: '#f0d890', e3: '#14100c', sp: '#ffe08a', rays: true }
};

/* ---------- game state ---------- */
let decals = []; // marks the fights leave on the floor: scorch, frost, blood
let mode = 'title', cam = 0, lockX = Infinity, hero, enemies, items, parts, shake = 0, freeze = 0;
let score = 0, waveIdx = 0, goBlink = 0, tickN = 0, lastEnemy = null, endTimer = 0, msg = '', msgT = 0;
let mounts = [], dragon = null, impT = 240, flashA = 0;
/* ---------- campaign data: story, stages, bosses ---------- */
const BOSSES = { boss: 1, witch: 1, smith: 1, king: 1, wyrm: 1 };
const isBoss = e => !!BOSSES[e.kind];
const STORY = {
  loop: [
    'The Heart-Ember burns again, but the ash remembers. Beyond the Broken Gate the husks rise anew, harder and hungrier than before.',
    'The old Wardens whisper that the Cinder King was only the first. As long as the ash lies on the world, the vow is never finished.',
    'Nolan lifts the sword once more. Another cycle begins.'
  ],
  cycleEnd: [
    'The Ember Wyrm falls again, and the Heart-Ember flares higher. For a breath the whole world is warm.',
    'But the ash still stirs in the far hills. The vow is never finished.'
  ],
  intro: [
    'For a thousand years the Ember Wardens kept the Heart-Ember burning: the small, stubborn flame that keeps the whole world warm.',
    'Then the Cinder King, first among the Wardens, swore a new vow: that all fire should be his alone. He tore the Heart-Ember from its altar.',
    'Ash fell on every road. The dead rose as husks, the villages went dark, and the sun forgot the sky above Ashhold.',
    'One Warden remains. Nolan carries a sword and an old promise: to save the world from the monsters of the ash.'
  ],
  ending: [
    'The Ember Wyrm falls, and the Heart-Ember slips free of its cracked hide, small and bright and warm.',
    'Nolan carries it down the black stair, past the cold forge, through the clearing marsh and the open gate.',
    'At the altar of Ashhold the flame takes hold, and dawn breaks over the world for the first time in ten years.',
    'The husks lie still. The villages light their lamps. The Ashen Vow is kept, and the world is saved.'
  ]
};
const STAGES = [
  { name: 'THE BROKEN GATE', tag: 'THE CINDER COLOSSUS BARS THE ROAD NORTH', theme: 0, end: 2700, tint: null,
    waves: [{ x: 260, e: ['h', 'h'] }, { x: 760, e: ['h', 'h', 'h'] }, { x: 1300, e: ['h', 'b', 'h'] }, { x: 1850, e: ['h', 'h', 'b', 'h'] }, { x: 2300, e: ['boss', 'h', 'h'] }],
    clear: ['The Cinder Colossus crumbles into cold slag, and the Broken Gate stands open at last.', 'North of Ashhold the road sinks into the Sunken Marsh, where the Mire Matron whispers the drowned dead awake.'] },
  { name: 'THE SUNKEN MARSH', tag: 'THE MIRE MATRON STIRS THE DROWNED DEAD', theme: 1, end: 2900, tint: { skin: '#5f7f62', hair: '#1c2a20', armor: '#2f4a3a', armor2: '#7aff9a', cloth: '#1c2a22' },
    waves: [{ x: 260, e: ['h', 'h', 'h'] }, { x: 800, e: ['b', 'h', 'h'] }, { x: 1350, e: ['h', 'h', 'b', 'h'] }, { x: 1900, e: ['b', 'b', 'h'] }, { x: 2450, e: ['witch', 'h'] }],
    clear: ['The Mire Matron\'s lantern gutters out. The mist thins, and the drowned villages sleep again.', 'Far ahead the sky glows red: the Ember Forge, where the Cinder King hammers out his armies.'] },
  { name: 'THE EMBER FORGE', tag: 'THE FORGEMASTER HAMMERS OUT AN ARMY', theme: 2, end: 3050, tint: { skin: '#7a5a4a', hair: '#2a1a16', armor: '#5a3a2e', armor2: '#ffcf5a', cloth: '#2a1a16' },
    waves: [{ x: 260, e: ['h', 'h', 'b'] }, { x: 820, e: ['b', 'h', 'h', 'h'] }, { x: 1380, e: ['b', 'b', 'h', 'h'] }, { x: 1950, e: ['h', 'h', 'h', 'b', 'h'] }, { x: 2550, e: ['smith', 'h', 'h'] }],
    clear: ['The Forgemaster\'s hammer falls silent, and the furnaces cool for the first time in ten years.', 'Beyond the forge a black stair climbs into the storm. At its top waits the Obsidian Throne, and the Cinder King.'] },
  { name: 'THE OBSIDIAN THRONE', tag: 'THE CINDER KING WAITS WITH THE HEART-EMBER', theme: 3, end: 3150, tint: { skin: '#6a5a7a', hair: '#120a1c', armor: '#2a1a3a', armor2: '#ff6a9a', cloth: '#1a1022' },
    waves: [{ x: 260, e: ['h', 'b', 'h', 'h'] }, { x: 820, e: ['b', 'b', 'h', 'h'] }, { x: 1400, e: ['h', 'h', 'b', 'b', 'h'] }, { x: 2000, e: ['b', 'b', 'b', 'h'] }, { x: 2600, e: ['king', 'h', 'h'] }],
    clear: ['The Cinder King crumbles to ash, and the Heart-Ember tumbles from his chest. Its glass shell cracks.', 'From the dark beneath the throne, something ancient uncoils: the Ember Wyrm, who swallowed the first fire and has hungered ever since.'] },
  { name: 'THE HEART-EMBER SANCTUM', tag: 'THE EMBER WYRM GUARDS THE FIRST FLAME', theme: 4, end: 3250, tint: { skin: '#8a7a5a', hair: '#2a2010', armor: '#6a5030', armor2: '#fff0a0', cloth: '#2a2010' },
    waves: [{ x: 260, e: ['h', 'b', 'h', 'b'] }, { x: 820, e: ['b', 'b', 'h', 'h', 'h'] }, { x: 1400, e: ['h', 'b', 'b', 'b'] }, { x: 2000, e: ['b', 'b', 'h', 'h', 'b'] }, { x: 2650, e: ['wyrm', 'h', 'h'] }],
    clear: [] }
];
const MINION = [null, 'wisp', 'runner', 'guard', 'wraith'];
STAGES.forEach((S, si) => { if (!si) return; S.waves.forEach((w, wi) => { if (!wi) return; let i = w.e.indexOf('h'); if (i >= 0) w.e[i] = MINION[si]; if (wi >= 3 && si >= 2) { i = w.e.indexOf('h'); if (i >= 0) w.e[i] = MINION[si - 1]; } }); });
/* ---------- seven acts, thirty-five stages: the story carries you to level 70 ---------- */
const ACT_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const EXTRA_NAMES = ['THE SHATTERED BRIDGE', 'THE DROWNED CATHEDRAL', 'THE COLD FOUNDRY', 'THE BONE CITADEL', 'THE SECOND SANCTUM',
  'THE ASHEN WASTES', 'THE BLACK FEN', 'THE MOLTEN DEEP', 'THE HOLLOW CROWN', 'THE BURNING STAIR',
  'THE WITHERED WILDS', 'THE ROTTING MIRE', 'THE GREEN FURNACE', 'THE THORN THRONE', 'THE FOURTH SANCTUM',
  'THE GILDED DUNES', 'THE SUNKEN TEMPLE', 'THE BRASS FOUNDRY', 'THE AMBER CROWN', 'THE FIFTH SANCTUM',
  'THE ECLIPSE GATE', 'THE BLOOD FEN', 'THE HOLLOW FORGE', 'THE MIDNIGHT THRONE', 'THE SIXTH SANCTUM',
  'THE LAST ROAD', 'THE LOST MARSH', 'THE WORLD-FORGE', 'THE ENDLESS THRONE', 'THE FIRST FLAME'];
const BOSS_OF = ['boss', 'witch', 'smith', 'king', 'wyrm'];
const BOSS_TC = { boss: 'The Cinder Colossus', witch: 'The Mire Matron', smith: 'The Forgemaster', king: 'The Cinder King', wyrm: 'The Ember Wyrm' };
const BOSS_RET = { boss: 'THE CINDER COLOSSUS RETURNS FROM THE SLAG', witch: 'THE MIRE MATRON RISES FROM THE FEN', smith: 'THE FORGEMASTER REFORGES HIS ARMY', king: 'THE CINDER KING WEARS A CROWN OF NEW FIRE', wyrm: 'THE EMBER WYRM HUNGERS ONCE MORE' };
const ACT_END = [
  ['The Ember Wyrm falls, and the first Heart-Ember is Nolan\'s. But a crack runs through its glass: this flame is only one of seven.', 'Six embers still burn in the dark. Nolan turns north, where the road bends into the Shattered Bridge.'],
  ['The second ember warms Nolan\'s palm, and the hills below turn green for a single night.', 'Then the wind shifts. Beyond the Second Sanctum the Ashen Wastes begin, and the husks there never sleep.'],
  ['The third ember joins the others. Their light is brighter than the dawn, and the ash recoils.', 'Four flames remain. Beyond the Burning Stair a sickly green fog rolls over the Withered Wilds.'],
  ['The fourth ember drives the fog back, and for the first time in years birds sing over the mire.', 'Southward the ash turns to golden sand. Somewhere in the Gilded Dunes the fifth flame lies buried.'],
  ['The fifth ember blazes like a small sun, and the dunes glitter with glass where its light passes.', 'Then the sky darkens at noon. An eclipse hangs over the world, and the sixth flame waits beyond the Eclipse Gate.'],
  ['The sixth ember tears the eclipse open, and daylight floods the Midnight Throne.', 'One flame remains, buried at the world\'s oldest forge. Nolan does not rest. The Last Road begins here.']
];
for (let i = 5; i < 35; i++) {
  const b = STAGES[i % 5], act = Math.floor(i / 5);
  STAGES.push({ name: EXTRA_NAMES[i - 5], tag: BOSS_RET[BOSS_OF[i % 5]], theme: b.theme, end: b.end + act * 200, tint: b.tint,
    waves: b.waves.map(w => ({ x: Math.round(w.x * (1 + 0.06 * act)), e: w.e.slice() })), clear: [] });
}
const NEW_MIN = ['archer', 'bomber', 'knight']; // act II frost archers, act III blaze bombers, act IV hollow knights
STAGES.forEach((S, i) => {
  if (i < 5) return; const act = (i / 5) | 0, pool = NEW_MIN.slice(0, act);
  S.waves.forEach((w, wi) => { if (!wi || w.e.some(t => BOSSES[t])) return; let n = 0; w.e.forEach((t, j) => { if ((t === 'h' || t === 'b') && n < (wi >= 3 ? 2 : 1)) { w.e[j] = pool[(i + wi + n) % pool.length]; n++; } }); });
});
STAGES.forEach((S, i) => { // ash warders from stage 2, flame callers from stage 3
  if (i < 1) return;
  S.waves.forEach((w, wi) => {
    if (!wi) return; const boss = w.e.some(t => BOSSES[t]), add = [];
    if (!boss && (wi + i) % 2 === 0) add.push('warder');
    if (!boss && i >= 2 && (wi + i) % 2 === 1) add.push('caller');
    if (i >= 7 && wi >= 3) add.push(boss ? 'warder' : (wi % 2 ? 'warder' : 'caller'));
    add.forEach(t => { const j = w.e.indexOf('h'); if (j >= 0 && !boss) w.e[j] = t; else w.e.push(t); });
  });
});
STAGES.forEach((S, i) => {
  if (i >= STAGES.length - 1) return;
  if (i % 5 === 4) { S.clear = ACT_END[(i / 5) | 0]; return; }
  const nx = STAGES[i + 1];
  if (i >= 5) S.clear = [BOSS_TC[BOSS_OF[i % 5]] + ' is cinders at last, and ' + S.name.toLowerCase().replace(/^the /, 'the ') + ' falls quiet.', 'Ahead lies ' + nx.name.toLowerCase() + '. The ash is deeper here, and the husks are hungrier than before.'];
});
const EPI = { boss: 'KEEPER OF THE BROKEN GATE', witch: 'WHISPERER OF THE DROWNED', smith: 'HAMMER OF THE ASH ARMIES', king: 'THE WARDEN WHO BROKE HIS VOW', wyrm: 'DEVOURER OF THE FIRST FLAME' };
let WAVES = STAGES[0].waves, STAGE_END = STAGES[0].end, TH = THEMES[0];
let stageIdx = 0, story = null, bossRef = null, stageCard = 0, clearT = 0, shots = [];

const KINDS = {
  hero: { name: 'NOLAN', cls: 'nolan', jump: 5.4, hp: 140, spd: 1.5, scale: 1, h: 44, skin: '#e0a679', hair: '#c4572b', armor: '#3b6ea8', armor2: '#8cc4ff', cloth: '#7a2630', wlen: 24, wwid: 3, wcol: '#dfe9f5' },
  panni: { name: 'PANNI', cls: 'panni', look: 'hero', jump: 5.4, hp: 140, spd: 1.45, scale: 1, h: 44, skin: '#f0c09a', hair: '#2b1640', armor: '#4a2a7a', armor2: '#c9a8ff', cloth: '#3a1a6a', wlen: 28, wwid: 2, wcol: '#c9a8ff', wk: 'pstaff' },
  luca: { name: 'LUCA', cls: 'luca', look: 'hero', jump: 6.0, hp: 140, spd: 1.8, scale: 1, h: 44, skin: '#d8a070', hair: '#2a1a12', armor: '#2a3a2e', armor2: '#8affb0', cloth: '#1a2a20', wlen: 14, wwid: 2, wcol: '#dfe9f5', wk: 'dagger' },
  imp: { name: 'PILFERER', hp: 20, spd: 1.8, scale: 0.8, h: 36, skin: '#79b04a', hair: '#3a5a22', armor: '#7a5a32', armor2: '#c9962e', cloth: '#4a3320', wlen: 12, wwid: 2, wcol: '#cfd4de', windup: 99, rng: 0, dmg: 0 },
  h: { name: 'ASHEN HUSK', hp: 44, spd: 0.8, scale: 1, h: 44, skin: '#7a8a5a', hair: '#3a2a1a', armor: '#6a4a2a', armor2: '#8a6a48', cloth: '#2b2226', wlen: 22, wwid: 3, wcol: '#a8743c', windup: 22, rng: 28, dmg: 9, wk: 'mace' },
  b: { name: 'CINDER BRUTE', hp: 120, spd: 0.55, scale: 1.3, h: 58, skin: '#5a5660', hair: '#1f1c22', armor: '#5a2e2e', armor2: '#ff9a3a', cloth: '#2a1c1c', wlen: 26, wwid: 6, wcol: '#6b6f78', windup: 30, rng: 40, dmg: 18 },
  boss: { name: 'THE CINDER COLOSSUS', hp: 420, spd: 0.5, scale: 2, h: 88, skin: '#7a746a', hair: '#17141a', armor: '#6e685e', armor2: '#8a847a', cloth: '#4a453c', wlen: 32, wwid: 8, wcol: '#8a8f99', windup: 38, rng: 62, dmg: 26, poise: 70 },
  witch: { name: 'THE MIRE MATRON', hp: 400, spd: 0.9, scale: 1.55, h: 70, skin: '#cfe8d8', hair: '#2a4436', armor: '#2a3a34', armor2: '#4a8a62', cloth: '#22302a', wlen: 34, wwid: 3, wcol: '#5a4030', windup: 26, rng: 44, dmg: 16, poise: 60 },
  smith: { name: 'THE FORGEMASTER', hp: 560, spd: 0.45, scale: 2.1, h: 92, skin: '#b8784e', hair: '#d8782a', armor: '#4a3426', armor2: '#6a707c', cloth: '#2a2224', wlen: 34, wwid: 10, wcol: '#6a707c', windup: 42, rng: 70, dmg: 28, poise: 110 },
  wisp: { name: 'BOG WISP', hp: 34, spd: 0.75, scale: 0.95, h: 44, skin: '#9ad8b0', hair: '#2a5a46', armor: '#3a7a64', armor2: '#b8ffd8', cloth: '#1e4a3c', wlen: 14, wwid: 2, wcol: '#b8ffd8', windup: 34, rng: 0, dmg: 12, look: 'h', ai: 'wisp' },
  runner: { name: 'SLAG RUNNER', hp: 56, spd: 1.15, scale: 0.9, h: 40, skin: '#8a5a3a', hair: '#2a1408', armor: '#7a2a14', armor2: '#ffae3a', cloth: '#3a1608', wlen: 16, wwid: 3, wcol: '#ff8a3a', windup: 22, rng: 20, dmg: 15, look: 'h', ai: 'runner' },
  gob: { name: 'LOOT GOBLIN', hp: 1, spd: 1.9, scale: 0.78, h: 34, skin: '#7fbf4a', hair: '#2a3a12', armor: '#6a4a1a', armor2: '#ffd24a', cloth: '#4a3412', wlen: 10, wwid: 3, wcol: '#ffd24a', windup: 99, rng: 0, dmg: 0, look: 'h', ai: 'gob' },
  guard: { name: 'THRONE GUARD', hp: 170, spd: 0.5, scale: 1.25, h: 56, skin: '#6a5a7a', hair: '#120a1c', armor: '#2a1a4a', armor2: '#c87aff', cloth: '#1a1030', wlen: 28, wwid: 6, wcol: '#9a8ab8', windup: 34, rng: 42, dmg: 20, look: 'b', ai: 'guard' },
  wraith: { name: 'EMBER WRAITH', hp: 80, spd: 0.95, scale: 1.05, h: 46, skin: '#f0e0b0', hair: '#fff4c0', armor: '#8a6a30', armor2: '#fffbe0', cloth: '#5a4018', wlen: 26, wwid: 4, wcol: '#fff1b0', windup: 18, rng: 38, dmg: 16, look: 'h', ai: 'wraith' },
  king: { name: 'THE CINDER KING', hp: 760, spd: 0.9, scale: 1.9, h: 84, skin: '#8a7a86', hair: '#1a1018', armor: '#2e2430', armor2: '#ff6a2a', cloth: '#5a1218', wlen: 38, wwid: 5, wcol: '#2a2430', windup: 20, rng: 58, dmg: 20, poise: 90 },
  wyrm: { name: 'THE EMBER WYRM', hp: 1300, spd: 0.75, scale: 2.4, h: 96, skin: '#3a2230', hair: '#1a0c16', armor: '#3a2230', armor2: '#ffb43a', cloth: '#1a0c16', wlen: 0, wwid: 0, wcol: '#000', windup: 30, rng: 90, dmg: 26, poise: 140 },
  archer: { name: 'FROST ARCHER', hp: 60, spd: 0.85, scale: 0.95, h: 44, skin: '#9ab8d8', hair: '#e8f4ff', armor: '#3a5a7a', armor2: '#bfe6ff', cloth: '#243a52', wlen: 22, wwid: 2, wcol: '#bfe6ff', windup: 30, rng: 0, dmg: 13, look: 'h', ai: 'archer', wk: 'bow' },
  bomber: { name: 'BLAZE BOMBER', hp: 40, spd: 1.35, scale: 0.9, h: 40, skin: '#c0623a', hair: '#3a1408', armor: '#6a2a14', armor2: '#ffcf3a', cloth: '#3a1608', wlen: 10, wwid: 2, wcol: '#ff8a3a', windup: 30, rng: 0, dmg: 24, look: 'imp', ai: 'bomber', wk: 'bomb' },
  warder: { name: 'ASH WARDER', hp: 70, spd: 0.8, scale: 1, h: 46, skin: '#3a5c84', hair: '#233a56', armor: '#2e4a6a', armor2: '#9ae8ff', cloth: '#233a56', wlen: 30, wwid: 2, wcol: '#9ae8ff', windup: 30, rng: 0, dmg: 12, look: 'h', ai: 'warder', wk: 'staff' },
  caller: { name: 'FLAME CALLER', hp: 62, spd: 0.85, scale: 1, h: 46, skin: '#8a5a3a', hair: '#2a0c06', armor: '#4a2a26', armor2: '#8a5a2a', cloth: '#3a1e1c', wlen: 30, wwid: 2, wcol: '#ffb43a', windup: 40, rng: 0, dmg: 20, look: 'h', ai: 'caller', wk: 'fstaff' },
  knight: { name: 'HOLLOW KNIGHT', hp: 210, spd: 0.55, scale: 1.3, h: 58, skin: '#4a4058', hair: '#0c0812', armor: '#2a2438', armor2: '#8a6aff', cloth: '#161020', wlen: 30, wwid: 6, wcol: '#8a8fb0', windup: 36, rng: 46, dmg: 22, look: 'b', ai: 'knight', wk: 'gsword' }
};

function makeFighter(kind, x, y) {
  const k = KINDS[kind];
  const o = {
    kind, k, x, y, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: k.hp, maxhp: k.hp, st: 'idle', t: 0, anim: 0,
    inv: 0, flash: 0, combo: 0, queued: false, hits: new Set(), cool: rnd(20, 70), armor: k.poise || 70, mana: 0, dead: false, fade: 0, h: k.h, vases: 0, mount: null, vase: false, dir: 1, fled: false, gone: false
  };
  if (kind !== 'hero' && kind !== 'imp') o.hp = o.maxhp = Math.round(k.hp * hpMul());
  if (BOSSES[kind] && stageIdx >= 5) o.k = Object.assign({}, k, { name: k.name + ' ' + ACT_ROMAN[Math.min(6, (stageIdx / 5) | 0)] });
  if (kind !== 'hero' && kind !== 'imp') { // v1.11: quicker foes, tougher bosses
    const bs = !!BOSSES[kind]; o.k = Object.assign({}, o.k, { spd: k.spd * (bs ? 1.15 : 1.3) });
    if (bs) { o.hp = o.maxhp = Math.round(o.hp * 1.35); o.k.poise = Math.round((k.poise || 70) * 1.3); o.armor = o.k.poise; }
  }
  if (kind === 'warder') { o.barrier = o.bmax = Math.round(o.maxhp * 0.9); }
  return o;
}

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
/* ---------- elemental specialisation: fire, frost or lightning, unlocked at level 10, a new tier every 10 levels ---------- */
const ELEM = {
  fire: { name: 'FIRE', col: '#ff7a2a', col2: '#ffd070', rgb: '255,130,40', info: 'BURNING: DAMAGE OVER TIME' },
  frost: { name: 'FROST', col: '#7ad8ff', col2: '#e8faff', rgb: '120,210,255', info: 'CHILL, THEN DEEP FREEZE' },
  bolt: { name: 'LIGHTNING', col: '#c8a8ff', col2: '#fff6a0', rgb: '110,180,255', info: 'ARCS THAT SHOCK AND STUN' }
};
const ELEM_TIERS = {
  fire: ['BURNING: DAMAGE OVER TIME', 'STRONGER, LONGER BURN', 'BURN SPREADS TO NEIGHBOURS', 'BURNING FOES ERUPT ON DEATH', 'BURNS STACK UP TO 3 TIMES', 'RING OF FIRE AROUND YOU', 'IGNITING BLASTS NEARBY FOES', 'FIRE MODIFIERS +1', 'FIRE MODIFIERS +2', 'FIRE MODIFIERS +3'],
  frost: ['CHILL: SLOWS ENEMIES', 'FASTER FROST BUILDUP', 'DEEP FREEZE: SHORT STASIS', 'FROZEN FOES TAKE +20% DAMAGE', 'LONGER FREEZE, DEEPER CHILL', 'FREEZING SPREADS A FROST BURST', 'FROZEN FOES SHATTER ON DEATH', 'FROST MODIFIERS +1', 'FROST MODIFIERS +2', 'FROST MODIFIERS +3'],
  bolt: ['ARCS LEAP TO A NEARBY FOE', 'LONGER, STRONGER ARCS', 'SHOCK: BRIEF STUN', 'ARCS HIT 2 FOES', 'LONGER STUN', 'LIGHTNING STRIKES THE TARGET', 'ARCS HIT 3 FOES', 'LIGHTNING MODIFIERS +1', 'LIGHTNING MODIFIERS +2', 'LIGHTNING MODIFIERS +3']
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ELEM_PT = [0, 0.045, 0.05, 0.055, 0.06, 0.065, 0.075, 0.09, 0.095, 0.10, 0.105]; // status damage as a share of one normal hit
// weakness (>1) and resistance (<1) by monster: never below 0.4 or above 1.4, so nothing is immune and nothing is helpless
// Rock-paper-scissors: every elemental monster resists its own element and is weak to the one that beats it. Fire loses to frost, frost to lightning, lightning to fire. The third element is neutral.
// Never immune: buildup is floored at 40%, resistance only slows it.
const MON_EL = { boss: 'fire', smith: 'fire', king: 'fire', wyrm: 'frost', witch: 'bolt', bomber: 'fire', caller: 'fire', runner: 'fire', archer: 'frost', wraith: 'frost', knight: 'frost', wisp: 'bolt', warder: 'bolt', guard: 'bolt' };
const EL_WEAK = { fire: 'frost', frost: 'bolt', bolt: 'fire' };
const ELEM_RES = {}; for (const k in MON_EL) ELEM_RES[k] = { [MON_EL[k]]: 0.6, [EL_WEAK[MON_EL[k]]]: 1.25 };
const elemAvail = () => clamp(Math.floor(rpg.lvl / 10), 0, 7) + (rpg.lvl >= 70 ? Math.min(3, Math.floor((rpg.pg | 0) / 10)) : 0); // highest tier you may buy: level gives I to VII, every 10 paragon points open VIII, IX and X
const elemTier = () => rpg.elem ? clamp(Math.min(rpg.et | 0, elemAvail()), 0, 10) : 0;
const ePar = () => Math.max(0, elemTier() - 7); // tiers VIII to X add +1, +2, +3 to every numbered modifier of the element (layers, reach, arcs, duration)
const layerCap = () => 3 + ePar();      // tiers are bought at the Blacksmith with gold
const ENEMY_EL = MON_EL; // the element a monster's own attacks carry (for your resist gear)
const SHOT_EL = { wave: 'fire', meteor: 'fire', rune: 'fire', ring: 'fire', arrow: 'frost', orb: 'bolt', bolt: 'bolt' };
let hitEl = null; // the element of the hit being resolved right now (set around projectile and vent damage)
const gearSum = (key, el) => { let n = 0; for (const sl of SLOTS) { const it = rpg.eq[sl]; if (it && it[key] && it[key].k === el) n += it[key].v; } return n; };
const elemPower = () => rpg.elem ? Math.min(60, gearSum('ea', rpg.elem) + setBonus('ep')) + (buffIs('surge') ? 40 : 0) : 0;   // % bonus to your element's buildup and damage
const elemResist = el => el ? Math.min(60, gearSum('er', el) + setBonus('res')) / 100 : 0;        // share of that element's damage you ignore
const elemTierCost = t => t <= 1 ? 0 : Math.round(120 * Math.pow(t, 1.6)); // tier I is free, the rest cost gold
const elemRefund = () => Math.floor((rpg.eg | 0) * 0.75);                  // dismissing your element returns 75% of the gold you put into it
let rpg = { lvl: 1, xp: 0, bag: [], eq: {}, coins: 3, gold: 0, ini: 'AAA', elem: null, et: 0, eg: 0, tr: 0, pg: 0, pxp: 0 };
let PS = null, floats = [];

const XPN = [62, 31];
const xpNeed = l => Math.round(XPN[0] + XPN[1] * l);
function pstats() {
  if (PS) return PS;
  const C = cls(), s = { str: 4 + rpg.lvl, crit: C.crit, cdmg: C.cdmg, hit: 90 };
  for (const sl of SLOTS) { const it = rpg.eq[sl]; if (it) { const st = itemSt(it); for (const q in st) s[q] += st[q]; } }
  s.str += setBonus('str'); s.crit += setBonus('crit'); s.cdmg += setBonus('cdmg'); // set bonuses
  if (CLS === 'luca') { s.crit += Math.floor(s.str * 0.08); s.hit += Math.floor(s.str * 0.05); }
  // soft caps: stacked mythic gear makes you strong, not untouchable
  s.crit = Math.min(CLS === 'luca' ? 70 : 60, s.crit); s.hit = Math.min(100, s.hit);
  if (s.cdmg > 250) s.cdmg = Math.min(500, Math.round(250 + (s.cdmg - 250) * 0.35));
  s.mult = (1 + Math.min(s.str, 120) * C.mul + Math.max(0, s.str - 120) * C.mul * 0.45) * (dailyIs('GLASS CANNON') ? 1.5 : 1);
  s.mult *= pgDmg();
  s.maxhp = Math.round((C.hp0 + rpg.lvl * C.hpl + (CLS === 'nolan' ? s.str >> 1 : s.str >> 2)) * (1 + setBonus('hp') / 100) * pgHp());
  return (PS = s);
}
const GEAR_COL = [null, { armor: '#2a4a7a', armor2: '#5a9cff', cloth: '#26366e', blade: '#a8d0ff' }, { armor: '#7a6a24', armor2: '#ffe84a', cloth: '#6a5a14',
  blade: '#fff6b0' }, { armor: '#7a4a1a', armor2: '#ffb43a', cloth: '#7a4a10', blade: '#ffe0a0' }, { armor: '#6a1a3a', armor2: '#ff4a88', cloth: '#6a1040',
  blade: '#ffa8c8' }, { armor: '#1a5a2e', armor2: '#46e06a', cloth: '#14482a', blade: '#b8ffc8' }]; // the last entry is the set green
const flm = (t, g) => t >= 5 ? `rgb(70,${g},110)` : `rgb(255,${g},40)`; // flame trim: orange, or green on set gear
function lookFor(c, eq) { // equipped rarity tints the hero's armor, trim, cape and weapon
  const r = sl => eq[sl] ? (eq[sl].set ? 5 : eq[sl].rar) : 0, top = Math.max(r('helm'), r('armor'), r('boots')), base = KINDS[CLASSES[c].kind];
  const o = Object.assign({}, base);
  const A = GEAR_COL[r('armor')], T = GEAR_COL[top], C = GEAR_COL[Math.max(r('ring'), r('amulet'))], B = GEAR_COL[r('weapon')];
  if (A) o.armor = A.armor; if (T) o.armor2 = T.armor2; if (C) o.cloth = C.cloth; if (B) o.wcol = B.blade;
  const tier = sl => eq[sl] ? (eq[sl].set ? 5 : [1, 2, 3, 3, 4][eq[sl].rar]) : 0; // look tier: 0 nothing, 1 common, 2 magic, 3 rare/legendary (tinted apart), 4 mythic, 5 set piece (the mythic look in set green)
  o.gt = { helm: tier('helm'), armor: tier('armor'), boots: tier('boots'), weapon: tier('weapon'), ring: tier('ring'), amulet: tier('amulet') };
  if (!o.gt.armor) { // no armour: a plain tunic, robe or leathers
    if (c === 'panni') { o.armor = '#4b2a7a'; o.armor2 = '#c99bff'; o.cloth = '#3a1f60'; }
    else if (c === 'luca') { o.armor = '#5a4030'; o.armor2 = '#2f8f5a'; o.cloth = '#1a2a20'; }
    else { o.armor = '#53698f'; o.armor2 = '#7189b0'; o.cloth = '#7a1622'; }
  }
  if (o.gt.weapon >= 3) o.wlen = base.wlen + 3;
  o.wup = eq.weapon ? eq.weapon.up | 0 : 0;
  o.gup = Math.max(0, ...SLOTS.filter(sl => sl !== 'weapon').map(sl => eq[sl] ? eq[sl].up | 0 : 0)); // best forge level on the other gear
  const top5 = Math.max(0, ...SLOTS.map(r)); o.glowRgb = top5 >= 5 ? SET_GREEN_RGB : top5 >= 2 ? RARITY[top5].rgb : null;
  return o;
}
function gearLook() {
  for (const p of players()) {
    const c = p.pn === 2 ? CLS2 : CLS; p.k = lookFor(c, rpg.eq); p.glow = p.k.glowRgb;
    if (p.pn === 2 && c === CLS) p.k.hair = '#4a3ab0';
    if (rpg.elem && elemTier()) { if (!(rpg.eq.weapon && rpg.eq.weapon.set)) p.k.wcol = ELEM[rpg.elem].col2; p.glow = ELEM[rpg.elem].rgb; }
    else if (p.k.gup >= 5 && !p.glow) p.glow = '255,200,90';
    if (SLOTS.some(sl => rpg.eq[sl] && rpg.eq[sl].set)) p.glow = SET_GREEN_RGB; // a faint green glow shows that set gear is worn
  }
}
function heroStats(full) {
  PS = null; gearLook(); const s = pstats();
  for (const p of players()) { const d = s.maxhp - p.maxhp; p.maxhp = s.maxhp; p.hp = full ? s.maxhp : clamp(p.hp + Math.max(0, d), 1, s.maxhp); }
}
function rollHit(dmg) { // hit chance, crit chance, crit damage, STR
  const s = pstats();
  if (Math.random() * 100 >= s.hit) return { miss: true };
  const crit = Math.random() * 100 < s.crit;
  return { crit, d: Math.max(1, Math.round(dmg * s.mult * (buffIs('fury') ? 1.3 : 1) * (crit ? s.cdmg / 100 : 1) * rnd(0.93, 1.07))) };
}
/* ---------- paragon: after level 70 the experience goes on, and every paragon point adds a little of everything ---------- */
const PG_MAX = 100, pgNeed = n => 4500 + 80 * n;
const pgHp = () => 1 + 0.008 * (rpg.pg | 0), pgDmg = () => 1 + 0.007 * (rpg.pg | 0), pgRes = () => 0.003 * (rpg.pg | 0); // +0.8% life, +0.7% damage, 0.3% less damage taken per point
/* kill combo: foes killed within three seconds of each other build a combo that adds up to +75% experience; any hit on a hero breaks it */
let killCombo = 0, killComboT = -999;
const KC_WINDOW = 180, kcBonus = () => Math.min(0.75, killCombo * 0.03);
function gainXP(n) {
  if (tut) return; // the training pays nothing
  if (daily && n > 0) n = Math.round(n * SEASON_XP); // the season race pays double
  if (rpg.lvl >= MAX_LV && n > 0) {
    if (rpg.pg >= PG_MAX) return;
    rpg.pxp += n; let up = 0; const pg0 = rpg.pg;
    while (rpg.pg < PG_MAX && rpg.pxp >= pgNeed(rpg.pg)) { rpg.pxp -= pgNeed(rpg.pg); rpg.pg++; up++; }
    if (rpg.pg >= PG_MAX) rpg.pxp = 0;
    if (up) { PS = null; heroStats(false); for (const p of players()) if (!p.dead) { p.hp = Math.min(p.maxhp, p.hp + (p.maxhp * 0.15 | 0)); floatText(p.x, p.y - 62, '+' + (up > 1 ? up + ' ' : '') + 'PARAGON', '#5ab4ff', 9); }
      msg = 'PARAGON ' + rpg.pg + (rpg.pg >= PG_MAX ? '  MAX' : ''); msgT = 90; flashA = 0.15; SFX.magic();
      if (rpg.elem && Math.floor(rpg.pg / 10) > Math.floor(pg0 / 10) && Math.floor(rpg.pg / 10) <= 3) { msg = 'NEW ' + ELEM[rpg.elem].name + ' TIER READY - SEE THE BLACKSMITH'; msgT = 240; }
      saveGame(); }
    return;
  }
  if (rpg.lvl >= MAX_LV || n <= 0) return;
  rpg.xp += n; let up = false; const lv0 = rpg.lvl;
  while (rpg.lvl < MAX_LV && rpg.xp >= xpNeed(rpg.lvl)) { rpg.xp -= xpNeed(rpg.lvl); rpg.lvl++; up = true; }
  if (rpg.lvl >= MAX_LV) rpg.xp = 0;
  if (up) levelUp(lv0);
}
function levelUp(lv0) {
  heroStats(false); for (const p of players()) p.hp = Math.min(p.maxhp, p.hp + (p.maxhp * 0.35 | 0));
  msg = rpg.lvl >= MAX_LV ? 'MAX LEVEL 70!' : 'LEVEL UP!  LV ' + rpg.lvl; msgT = 130; flashA = 0.3; SFX.magic();
  spawn(hero.x, hero.y, 20, 36, { s0: 1, s1: 3.4, c: ['#fff1b0', '#ffd24a', '#c9a8ff'], l0: 16, l1: 36, add: true, size: 2, up: 3, g: 0.05 });
  const sk = SKILLS.filter(k => k.lv > (lv0 || 0) && k.lv <= rpg.lvl).pop();
  if (sk) { for (const p of players()) p.ski = skillsOf().length - 1; msg = 'NEW SKILL: ' + skName(sk, hero) + '  (U)'; msgT = 220; }
  if (rpg.lvl >= 10 && !rpg.elem && lv0 < 10) { msg = 'ELEMENT UNLOCKED - SEE THE BLACKSMITH'; msgT = 240; }
  else if (rpg.elem && elemAvail() > (rpg.et | 0) && Math.floor(rpg.lvl / 10) > Math.floor((lv0 || 0) / 10)) { msg = 'NEW ' + ELEM[rpg.elem].name + ' TIER READY - SEE THE BLACKSMITH'; msgT = 240; }
  saveGame();
}
function rollRarity() { // stage 1: white only. 2: +magic 34%. 3: +rare 15%, +legendary 7%. 4+: +mythic 1%
  const t = tierOf();
  const lk = rpg.lvl || 1; // a little level luck: the higher you are, the better the top drops
  if (t >= 3 && rq() < 0.01 + lk * 0.0003 + trialN() * 0.004) return 4; // each Ember Trial adds a little mythic luck
  if (t >= 2 && rq() < 0.07 + lk * 0.0005) return 3;
  if (t >= 2 && rq() < 0.16) return 2;
  if (t >= 1 && rq() < 0.34) return 1;
  return 0;
}
const canWear = it => (it.lvl || 1) <= rpg.lvl;
function genItem(rar, slot, ilvl) { // items carry an item level, and you must be at least that level to wear them
  slot = slot || pickOf(SLOTS);
  const il = ilvl || (rpg.lvl >= MAX_LV ? MAX_LV : clamp(Math.max(areaLv(), rpg.lvl) + (rq() * 6 | 0) - 2 + (rq() < 0.06 ? 4 + (rq() * 4 | 0) : 0), 1, MAX_LV));
    // drops land around your level (now and then a few levels above it); at the level cap every drop is full level 70
  const setId = rar >= 3 && il >= SET_MIN_LV && rq() < SET_CH[rar] * (1 + 0.15 * trialN()) * setBoost ? pickOf(Object.keys(SETS)) : null;
  if (setId) rar = 4; // a set piece is built from mythic stats...
  const R = RARITY[rar];
  const Q = rq() ** 1.5, qm = setId ? 1.4 + 0.12 * Q : 0.8 + 0.6 * Q; // roll quality: mostly average, rarely perfect. A great legendary can still beat a poor mythic; a set piece rolls above the best mythic
  const lc = Math.pow(il / 70, 1.6); // item level counts more than before: same strength at level 70, clearly weaker below it
  const sc = k => (k === 'str' || k === 'cdmg') ? 1 + 3.15 * lc : 1 + 0.84 * lc;
  const first = pickOf(SLOT_PRIMARY[slot]);
  const keys = [first, ...STAT_KEYS.filter(k => k !== first).sort(() => rq() - 0.5)];
  const n = R.n[0] + (R.n[1] > R.n[0] ? (rq() * (R.n[1] - R.n[0] + 1) | 0) : 0);
  const st = {};
  for (const k of keys.slice(0, n)) { const S = STATS[k]; st[k] = Math.max(1, Math.round(rqr(S.lo, S.hi) * R.mult * qm * sc(k))); }
  const WN = slot === 'weapon' && WNAMES[CLS];
  const base = WN ? WN.magic : MAGIC_BASE[slot];
  const name = setId ? SETS[setId].pre + ' ' + pickOf(base) : rar === 0 ? pickOf(WN ? WN.base : BASE_NAMES[slot]) : rar === 1 ? pickOf(MAGIC_PRE) + ' ' + pickOf(base) : rar === 2 ? pickOf(RARE_PRE) + ' ' + pickOf(base)
    : rar === 3 ? pickOf(WN ? WN.leg : LEG_NAMES[slot]) : pickOf(WN ? WN.myth : MYTH_NAMES[slot]);
  const it = { slot, rar, name, st, lvl: il, q: Math.round(Q * 100) };
  if (setId) it.set = setId;
  if (rar >= 1) { // elemental affixes: power for your own element, resistance against what the monsters throw
    const ch = [0, 0.14, 0.3, 0.55, 0.9][rar], roll = b => Math.round((b + il * 0.14) * (0.8 + 0.4 * Q));
    if (rq() < ch) it.ea = { k: pickOf(ELEMS), v: roll(6) };
    if (rq() < ch) it.er = { k: pickOf(ELEMS), v: roll(8) };
  }
  return it;
}
function dropGear(x, y, rar) {
  const R = RARITY[rar]; if (rar >= 3) jr('legend');
  items.push({ x, y, t: 0, kind: 'gear', it: genItem(rar), z: 14, vz: 3.4 });
  const gi = items[items.length - 1].it; if (gi.set) { rar = 4; }
  spawn(x, y, 14, 10 + rar * 8, { c: [gi.set ? SET_GREEN : R.col, '#ffffff'], l0: 12, l1: 26, add: true, up: 2.4, g: 0.05 });
  if (items[items.length - 1].it.q >= 90 && rar < 3) floatText(x, y - 58, 'PERFECT ROLL!', '#ffd24a', 8);
  const di = items[items.length - 1].it; if (di.set) floatText(x, y - 54, SETS[di.set].name + ' SET DROP!', SET_GREEN, 10);
  if (rar >= 3) { flashA = Math.max(flashA, 0.2); SFX.big(); if (!gi.set) floatText(x, y - 50, rar === 4 ? 'MYTHIC DROP!' : 'LEGENDARY DROP!', R.col, 10); }
  else if (rar === 2) { SFX.magic(); floatText(x, y - 46, 'RARE DROP', R.col, 8); }
}
function onKill(e) {
  if (e.kind === 'gob') { bonusKill(e); return; }
  const boss = isBoss(e); if (e.el && (e.el.burn > 0 || e.el.frz > 0 || e.el.shk > 0 || e.el.chill > 0)) jr('elemkill'); elemDeath(e);
  if (boss) for (const o of enemies) { // the boss falls and every foe around it dies with it (xp and gold still count, no gear drops)
    if (o === e || o.dead || o.kind === 'imp' || isBoss(o)) continue;
    o.hp = 0; o.dead = true; o.fade = 0; o.noLoot = true; o.st = 'down'; o.vx = 0; o.vz = 0; o.z = 0; sparks(o.x, o.y, o.h * 0.6, false); addDecal(o); onKill(o); score += 100;
  }
  killCombo = (tickN - killComboT <= KC_WINDOW ? killCombo : 0) + 1; killComboT = tickN; jr('kill'); if (e.elite) jr('elite'); if (boss) jr('boss'); if (killCombo >= 5) jr('combo', killCombo);
  if (killCombo % 10 === 0) floatText(e.x, e.y - e.h - 16, 'COMBO x' + killCombo + '  XP +' + Math.round(kcBonus() * 100) + '%', '#8fc8ff', 8);
  gainXP(Math.round((boss ? 250 : e.kind === 'b' || e.k.ai ? 30 : 10) * (1 + areaLv() * 0.12) * 0.42 * (dailyIs('IRON FOES') ? 1.5 : 1) * (1 + kcBonus() + (buffIs('wisdom') ? 0.5 : 0)))); // paced so level 70 arrives near the end of act VII
  { const gd = Math.round((boss ? 45 : e.kind === 'b' || e.k.ai ? 7 : 2) * (1 + areaLv() * 0.1) * (1 + 0.25 * trialN()) * (dailyIs('GOLD RUSH') ? 2 : dailyIs('IRON FOES') ? 1.5 : 1) * (buffIs('fortune') ? 1.6 : 1));
    rpg.gold += gd; if (boss || e.kind === 'b' || e.k.ai) floatText(e.x, e.y - e.h - 8, '+' + gd + 'G', '#ffd24a', 8); }
  seeded(e.sid ? 'K' + stageIdx + '/' + cycle + '/' + e.sid : null, () => { // a wave foe always drops the same for every racer
    const n = e.noLoot ? 0 : boss ? (tierOf() >= 2 ? 3 : 2) : e.elite ? 1 + (rq() < 0.4 ? 1 : 0) : rq() < (e.kind === 'b' || e.k.ai ? 0.42 : 0.15) * (buffIs('fortune') ? 1.5 : 1) ? 1 : 0;
    const bigBoss = boss && rpg.lvl >= MAX_LV; // at max level a boss always drops at least a legendary first and raises the set chance of all its drops by half
    setBoost = bigBoss ? 1.5 : 1;
    for (let i = 0; i < n; i++) {
      let r = rollRarity();
      if (bigBoss && i === 0) r = Math.max(3, r);
      else if (boss && tierOf() === 1) r = 1;                  // stage 2 boss: two magic drops
      else if (boss && i === 0 && tierOf() >= 2) r = Math.max(1, r);
      dropGear(e.x + rnd(-16, 16), clamp(e.y + rnd(-6, 6), Y_MIN, Y_MAX), r);
    }
    setBoost = 1;
  });
}
const GOLD_MULT = [1, 3, 5, 8, 20];
const itemValue = it => Math.round((8 + (it.lvl || 1) * 1.6) * GOLD_MULT[it.rar] * (1 + 0.25 * (it.up | 0)));
const itemPrice = it => Math.round(itemValue(it) * 2.5);
const sameItem = (a, b) => !!a && !!b && a.slot === b.slot && a.name === b.name && a.rar === b.rar && (a.q | 0) === (b.q | 0) && (a.lvl || 1) === (b.lvl || 1) && (a.up | 0) === (b.up | 0);
function isDuplicate(it) { return Object.values(rpg.eq).some(o => sameItem(o, it)) || rpg.bag.some(o => sameItem(o, it)); }
// the backpack is always sorted: plain items first, then by rarity; inside a rarity by slot, then the higher item level first
function sortBag(keep) {
  rpg.bag.sort((a, b) => a.rar - b.rar || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || (b.lvl || 1) - (a.lvl || 1) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (keep && typeof inv !== 'undefined') inv.i = Math.max(0, rpg.bag.indexOf(keep));
}
function pickupGear(it, bought) {
  const R = RARITY[it.rar];
  if (!bought && isDuplicate(it)) { // already owned: it turns into gold and score
    const gd = itemValue(it), pt = gd * 10; rpg.gold += gd; score += pt;
    floatText(hero.x, hero.y - 60, 'DUPLICATE  +' + gd + 'G  +' + pt + 'PTS', '#ffd24a', 8); SFX.pick(); return true;
  }
  if (!rpg.eq[it.slot] && canWear(it)) { rpg.eq[it.slot] = it; PS = null; heroStats(false); floatText(hero.x, hero.y - 60, 'EQUIPPED ' + it.name, itemCol(it), 8); }
  else if (rpg.bag.length < BAG_MAX) { rpg.bag.push(it); sortBag(); floatText(hero.x, hero.y - 60, it.name, itemCol(it), 8); }
  else return false;
  saveGame(); return true;
}
function floatText(x, y, s, col, size) { floats.push({ x, y, s, col, size: size || 8, t: 0 }); }
function updateFloats() { for (const f of floats) { f.t++; f.y -= 0.45; } floats = floats.filter(f => f.t < 56); }
function drawFloats() { for (const f of floats) { g.globalAlpha = Math.min(1, (56 - f.t) / 18); text(f.s, Math.round(f.x - cam), Math.round(f.y), f.size, f.col, 'center'); } g.globalAlpha = 1; }

/* ---- persistence: character + leaderboard live in localStorage ---- */
const validItem = it => { const ok = !!(it && SLOTS.includes(it.slot) && RARITY[it.rar] && it.st && typeof it.name === 'string');
  if (ok) { it.up = clamp(it.up | 0, 0, MAX_UP); if (it.set && !(SETS[it.set] && it.rar >= 3)) delete it.set;
  for (const k of ['ea', 'er']) if (it[k] && !(ELEMS.includes(it[k].k) && it[k].v > 0)) delete it[k]; else if (it[k]) it[k].v = Math.min(99, it[k].v | 0); } return ok; };
const saveKey = c => (c || CLS) === 'nolan' ? SAVE_KEY : SAVE_KEY + '_' + (c || CLS);
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
/* ---- the online season board (Supabase REST): optional, the game works fully without it; the URL and the public anon key live in online-config.js ---- */
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
const fromRow = r => ({ n: String(r.name || '???'), h: r.hero, t: r.t | 0, lv: r.lv | 0, pg: r.pg | 0, st: r.stage | 0, c: r.cycle | 0, w: !!r.finished, s: 0, at: Date.parse(r.created_at) || 0, d: String(r.day || ''), b: cleanBuild(r.build), sp: splitsFrom(r.splits) });
let buildCol = null, splitCol = null; // does the table have the build / splits column yet? null = not known, the game tries it and falls back to rows without it
const extraCols = () => (buildCol === false ? '' : ',build') + (splitCol === false ? '' : ',splits');
const colFail = () => { if (splitCol !== false) { splitCol = false; return true; } if (buildCol !== false) { buildCol = false; return true; } return false; }; // a 400: drop the newest column first, then the older one
const colOk = () => { if (buildCol === null) buildCol = true; if (splitCol === null) splitCol = true; };
const COLS = 'name,hero,t,lv,pg,stage,cycle,finished,created_at';
function loadOnlineBoard(force) {
  if (!onlineOn() || onlineBoard.busy) return;
  if (!force && onlineBoard.day === seasonStr() && Date.now() - onlineBoard.at < 30000) return;
  const day = seasonStr(); onlineBoard.busy = true;
  sbFetch('daily_scores?day=gte.' + seasonFirst() + '&day=lte.' + seasonLast() + '&select=day,' + COLS + extraCols() + '&order=finished.desc,t.asc,created_at.asc&limit=1000').then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(a => { colOk(); onlineBoard = { day, rows: a.map(fromRow).sort(dailyCmp), at: Date.now(), err: false, busy: false }; }) // every run of the season is kept (up to 1000): the counters use them all, the board shows each player's best
    .catch(st => { if (st === 400 && colFail()) { onlineBoard.busy = false; loadOnlineBoard(true); return; } onlineBoard = { day, rows: onlineBoard.day === day ? onlineBoard.rows : null, at: Date.now(), err: true, busy: false }; });
}
let hof = { rows: null, all: null, at: 0, err: false, busy: false };
function loadHof(force) { // the eternal board: every player's fastest finished run of all seasons
  if (!onlineOn() || hof.busy) return;
  if (!force && hof.rows && Date.now() - hof.at < 60000) return;
  hof.busy = true;
  sbFetch('daily_scores?finished=eq.true&day=gte.' + SEASON_FROM + '&select=day,' + COLS + extraCols() + '&order=t.asc,created_at.asc&limit=1000').then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(a => { colOk(); const all = a.map(fromRow).sort(dailyCmp); hof = { rows: bestPer(all).sort(dailyCmp), all, at: Date.now(), err: false, busy: false }; }) // all = every finished run, kept for the archive and the champion titles
    .catch(st => { if (st === 400 && colFail()) { hof.busy = false; loadHof(true); return; } hof = { rows: hof.rows, all: hof.all, at: Date.now(), err: true, busy: false }; });
}
function submitOnline(e) { // sent when a daily result is signed; a failure leaves it on this device's board only
  if (!onlineOn()) return; onlineSent = { n: e.n, t: e.t | 0, h: e.h }; onlineSendErr = false;
  const row = { day: dayStr(), name: e.n, hero: e.h, t: e.t | 0, lv: e.lv | 0, pg: e.pg | 0, stage: Math.min(35, e.st | 0), cycle: Math.min(11, Math.max(1, e.c | 0)), finished: !!e.w };
  let sent = null;
  const post = () => { const body = Object.assign({}, row); sent = { b: buildCol !== false, s: splitCol !== false && !!e.sp }; if (sent.b) body.build = e.b || buildOf(); if (sent.s) body.splits = e.sp;
    return sbFetch('daily_scores', { method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(body) }).then(r => { if (!r.ok) throw r.status; colOk(); loadOnlineBoard(true); hof.at = 0; }); };
  const go = () => post().catch(st => { if (st === 400 && sent && (sent.s || sent.b)) { if (sent.s) splitCol = false; else buildCol = false; return go(); } throw st; }); // a 400: leave out the newest column that was sent, then the older one
  go().catch(() => { onlineSendErr = true; }); // a table without the newer columns still takes the result
}
const modOfDay = ds => { const q = String(ds).split('-').map(Number); return ((q[0] || 0) * 12 + (q[1] || 1) - 1) % DAILY_MODS.length; }; // the rule of the season a day belongs to
const bestPer = rows => { const seen = {}, out = []; for (const r of rows.slice().sort(dailyCmp)) { const k = r.n + '|' + r.h; if (seen[k]) continue; seen[k] = 1; out.push(r); } return out; }; // one line per player and hero: the best run
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
function paceInfo() { // the season's fastest finish on the online board, the time to beat; { none: true } when the board is loaded and nobody has finished, null when there is no board to look at
  if (!onlineOn() || onlineBoard.day !== seasonStr() || !onlineBoard.rows) return null;
  const w = onlineBoard.rows.find(r => r.w); return w ? { n: w.n, t: w.t } : { none: true };
}
const dayMod = () => { const d = new Date(); return (d.getFullYear() * 12 + d.getMonth()) % DAILY_MODS.length; }; // one rule for the whole month
const dailyIs = n => !!daily && DAILY_MODS[daily.mod].name === n;
const boardKeyFor = v => v ? 'emberfall_board_daily_' + seasonStr() : BOARD_KEY;
function saveGame() { if (daily || tut || DEV) return; try { localStorage.setItem(saveKey(), seal({ v: 3, lvl: rpg.lvl, xp: rpg.xp, bag: rpg.bag, eq: rpg.eq, ini: rpg.ini, elem: rpg.elem, et: rpg.et, eg: rpg.eg, tr: rpg.tr | 0, pg: rpg.pg | 0, pxp: Math.round(rpg.pxp) || 0 })); } catch (e) { } }
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
/* ---------- the run is cached on this device: resuming a stage costs a continue coin ---------- */
const runKey = c => 'emberfall_run_v1_' + (c || CLS);
function saveRun(stage) { if (daily) { saveDailyRun(stage); return; } if (DEV) return; try { localStorage.setItem(runKey(), seal({ v: 3, stage, cycle, coins: rpg.coins, gold: rpg.gold, score, coop, c2: CLS2 })); } catch (e) { } }
function loadRun(c) { try { const o = unseal(localStorage.getItem(runKey(c)), runKey(c)); return o && o.stage >= 0 && o.stage < STAGES.length ? o : null; } catch (e) { return null; } }
function clearRun() { if (daily) return; try { localStorage.removeItem(runKey()); } catch (e) { } }
try { for (const c of CLS_ORDER) { unseal(localStorage.getItem(saveKey(c)), saveKey(c)); unseal(localStorage.getItem(runKey(c)), runKey(c)); } } catch (e) { } // at start-up every hero's save and run cache are checked, so a changed one is caught on the title screen
let resumeSel = 0, runInfo = null;
function resumeRun() {
  const o = runInfo; coop = sel.coop; cycle = o.cycle | 0; resetGame(); rpg.coins = Math.max(0, (o.coins | 0) - 1); rpg.gold = o.gold | 0; score = o.score | 0; shop = null;
  saveRun(o.stage); beginStage(o.stage); msg = 'CONTINUED  (-1 COIN)'; msgT = 140;
}
function updateResume() {
  const can = runInfo.coins > 0;
  if (isHit('up') || isHit('down') || isHit('left') || isHit('right')) { resumeSel = can ? 1 - resumeSel : 1; SFX.pick(); }
  if (isHit('back')) { mode = 'select'; return; }
  if (isHit('start') || isHit('atk')) { if (resumeSel === 0 && can) resumeRun(); else { clearRun(); startCampaign(sel.coop); } }
}
function drawResume() {
  g.fillStyle = 'rgba(4,2,10,0.7)'; g.fillRect(0, 0, W, H);
  const o = runInfo, can = o.coins > 0, C = cls();
  lvText(C.name + '  LV ' + rpg.lvl, W / 2, 60, 14, C.col, 'center');
  text('UNFINISHED RUN ON THIS DEVICE', W / 2, 82, 9, '#c9a8ff', 'center');
  text((o.cycle ? trialName(o.cycle) + '  ' : '') + 'STAGE ' + (o.stage + 1) + '  ' + STAGES[o.stage].name, W / 2, 100, 10, '#fff1d0', 'center');
  drawCoins(W / 2 - 14, 116, o.coins, 14);
  text('SCORE ' + (o.score | 0) + '    GOLD ' + (o.gold | 0), W / 2, 136, 8, '#ffd24a', 'center');
  const opt = (i, s, ok) => { const y = 168 + i * 22, on = resumeSel === i; if (on) { g.fillStyle = 'rgba(60,30,90,0.8)'; g.fillRect(W / 2 - 150, y - 13, 300, 18); } text((on ? '> ' : '') + s, W / 2, y, 10, !ok ? '#6a5a70' : on ? '#ffffff' : '#b8a8c8', 'center'); };
  opt(0, can ? 'CONTINUE THIS STAGE  (USES 1 COIN)' : 'NO COINS LEFT TO CONTINUE', can);
  opt(1, 'NEW CAMPAIGN  (THE OLD RUN IS LOST)', true);
  text('ENTER: CHOOSE    ESC: BACK', W / 2, 250, 8, '#8a7a9a', 'center');
}
function peekSave(c) { try { const o = migrateSave(checkSeal(localStorage.getItem(saveKey(c)))) || {}; const eq = {}; for (const sl of SLOTS) if (o.eq && validItem(o.eq[sl])) eq[sl] = o.eq[sl]; return { lvl: clamp((o.lvl | 0) || 1, 1, MAX_LV), eq }; } catch (e) { return { lvl: 1, eq: {} }; } }
function setClass(c) {
  if (!CLASSES[c]) c = 'nolan'; if (c === CLS && loadedCls === c) return;
  if (loadedCls) saveGame(); CLS = c; rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; PS = null; loadGame(); saveSettings();
  if (hero) heroStats(true);
}

/* ---- end of run: name entry + leather leaderboard ---- */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let nameBuf = [0, 0, 0], namePos = 0, pendingRun = null, boardHi = -1, resetArm = 0, leatherCv = null;
let inv = { z: 'bag', i: 0, from: 'play' }, invNote = '', invNoteT = 0;
function endRun(won) {
  clearRun(); boardView = daily ? 1 : 0; resetBoardUi(); // a normal game over shows the leatherboard even if the daily board was looked at before
  
  if (won && !daily) score += rpg.coins * 1500 + rpg.gold * 2;
  saveGame(); if (daily) saveDailyRun(stageIdx, true);
  const b = loadBoard();
  pendingRun = { s: score, st: stageIdx + 1, c: cycle + 1, lv: rpg.lvl, w: !!won, h: CLS };
  if (daily) { pendingRun.t = daily.t | 0; pendingRun.pg = rpg.pg | 0; pendingRun.at = Date.now(); pendingRun.b = buildOf(); pendingRun.sp = splitStr(daily.sp); }
  if (daily ? (onlineOn() || b.length < 10 || dailyCmp(pendingRun, b[b.length - 1]) < 0) : (score > 0 && (b.length < 10 || score > b[b.length - 1].s))) { nameBuf = rpg.ini.split('').map(c => Math.max(0, LETTERS.indexOf(c))); namePos = 0; mode = 'name'; }
  else { boardHi = -1; mode = 'board'; }
  endTimer = 0;
}
function startDaily() {
  daily = { date: seasonStr(), mod: dayMod(), t: 0, done: false, crown: false, sp: {}, last: null }; coop = false; cycle = 0;
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.indexOf('emberfall_daily_run_') === 0 && k.indexOf('emberfall_daily_run_' + daily.date + '_') !== 0) localStorage.removeItem(k); } } catch (e) { } // runs of earlier days are dropped
  rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; PS = null; resetGame(); stageIdx = 0; TH = THEMES[0]; rpg.coins = 1; rpg.gold = 0; shop = null;
  const o = loadDailyRun(CLS), live = !!o && !o.over && !o.done; if (live) { applyDailyRun(o); daily.t = Math.max(0, o.t | 0); }
  heroStats(true); loadOnlineBoard();
  beginStage(live ? o.stage : 0); msg = live ? 'SEASON RACE RESUMED  -  ' + fmtTime(daily.t) : 'SEASON: ' + DAILY_MODS[daily.mod].name + '  -  ' + DAILY_MODS[daily.mod].info; msgT = 280;
}
function dailyWin() { // level 70 and 100 paragon: the race is won
  daily.done = true; score += 5000; daily.crown = grantCrown(CLS); saveDailyRun(stageIdx, true); jrRaceWon();
  mode = 'victory'; endTimer = 0; TH = THEMES[4];
}
function toTitle() { boardView = 0; if (daily) { daily = null; PS = null; loadGame(); heroStats(true); } coop = false; cycle = 0; resetGame(); TH = THEMES[0]; weather = 'ash'; mode = 'title'; }
function updateName() {
  if (isHit('left')) namePos = (namePos + 2) % 3; if (isHit('right')) namePos = (namePos + 1) % 3;
  if (isHit('up')) nameBuf[namePos] = (nameBuf[namePos] + 1) % 26; if (isHit('down')) nameBuf[namePos] = (nameBuf[namePos] + 25) % 26;
  if (isHit('start')) {
    const n = nameBuf.map(i => LETTERS[i]).join(''); rpg.ini = n;
    const b = loadBoard(), e = Object.assign({ n }, pendingRun); b.push(e); b.sort(daily ? dailyCmp : (a, c) => c.s - a.s); boardHi = b.indexOf(e);
    saveBoard(b); saveGame(); if (daily) submitOnline(e); mode = 'board';
  }
}
const HERO_FILT = ['', 'nolan', 'panni', 'luca'];
let boardPage = 0, boardSel = -1, boardHero = 0, boardDetail = null, boardBoxes = []; // the selected row, the hero filter (0 = all), the open build card, the tap targets of the screen
const resetBoardUi = () => { boardSel = -1; boardHero = 0; boardDetail = null; boardPage = 0; archIdx = 0; };
const openBoard = v => { boardView = v; boardHi = -1; resetBoardUi(); mode = 'board'; };
let archIdx = 0; // which past season the archive shows (0 = the latest one that is over)
const viewOf = () => boardView >= 2 ? boardView : daily ? 1 : boardView; // 0 all time (this device), 1 this season's board, 2 the eternal board, 3 the past seasons
const archKey = () => endedSeasons()[archIdx] || '';
const archRows = () => hof.all ? bestPer(hof.all.filter(r => String(r.d).slice(0, 7) === archKey())).slice(0, 10) : [];
const nextView = v => v === 1 ? 2 : v === 2 ? 3 : 1;
const heroOk = e => !boardHero || e.h === HERO_FILT[boardHero];
const boardRows = () => bestPer((onlineOn() && onlineBoard.rows && onlineBoard.day === seasonStr()) ? onlineBoard.rows : loadBoard(1)).filter(heroOk).slice(0, 10); // online when it is loaded, this device otherwise; one line per player and hero, the hero filter applies to both
const hofRows = () => (hof.rows || []).filter(heroOk).slice(0, 10);
function openBuild() { const v = viewOf(), e = (v === 3 ? archRows() : v === 2 ? hofRows() : boardRows())[boardSel]; if (e) { boardDetail = e; boardPage = 0; } }
function updateBoard() {
  const v = viewOf(); if (v && onlineOn()) { loadHof(); if (v < 2) loadOnlineBoard(); } // the eternal data also feeds the titles and the archive
  if (boardDetail) { if (isHit('start') || isHit('back')) boardDetail = null; else if (isHit('left') || isHit('right')) boardPage ^= 1; return; }
  const list = v === 3 ? archRows() : v === 2 ? hofRows() : v === 1 ? boardRows() : [];
  if (list.length) { if (isHit('down')) boardSel = Math.min(list.length - 1, boardSel + 1); else if (isHit('up')) boardSel = boardSel <= 0 ? 0 : boardSel - 1; }
  if (v === 3 && (isHit('left') || isHit('right'))) { const n = endedSeasons().length; if (n) archIdx = (archIdx + (isHit('left') ? 1 : n - 1)) % n; boardSel = -1; } // A/D: an older or a newer season
  else if (v && (isHit('left') || isHit('right'))) { boardHero = (boardHero + (isHit('right') ? 1 : 3)) % 4; boardSel = -1; }
  if (v && pressed.KeyH) { boardView = nextView(v); boardSel = -1; return; } // H goes round: this season's board, the eternal board, the past seasons
  if (isHit('start')) { if (v && boardSel >= 0 && boardSel < list.length) openBuild(); else toTitle(); }
  else if (isHit('back')) toTitle();
}
function boardClick(x, y) {
  if (boardDetail) { boardDetail = null; return; }
  const b = boardBoxes.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (!b) return;
  if (b.k === 'hero') { boardHero = (boardHero + 1) % 4; boardSel = -1; } else if (b.k === 'view') { boardView = nextView(viewOf()); boardSel = -1; } else if (b.k === 'arch') { const n = endedSeasons().length; if (n) archIdx = (archIdx + 1) % n; boardSel = -1; } else if (b.k === 'row') { boardSel = b.i; openBuild(); }
}
function makeLeather() {
  leatherCv = document.createElement('canvas'); leatherCv.width = 360; leatherCv.height = 242;
  const c = leatherCv.getContext('2d');
  for (let x = 0; x < 360; x += 2) for (let y = 0; y < 242; y += 2) { c.fillStyle = `rgb(${90 + rnd(-14, 14) | 0},${58 + rnd(-10, 10) | 0},${34 + rnd(-8, 8) | 0})`; c.fillRect(x, y, 2, 2); }
  const vg = c.createRadialGradient(180, 121, 60, 180, 121, 230); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,0,0.65)'); c.fillStyle = vg; c.fillRect(0, 0, 360, 242);
  c.strokeStyle = '#1a0c04'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 357, 239);
  c.strokeStyle = '#d9b96a'; c.lineWidth = 1; c.setLineDash([4, 3]); c.strokeRect(9.5, 9.5, 341, 223); c.setLineDash([]);
  for (const [x, y] of [[6, 6], [354, 6], [6, 236], [354, 236]]) { c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); }
}
function drawBoardScreen() {
  tileLayer(TH.skyL, 0, 0); g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(0, 0, W, H);
  if (!leatherCv) makeLeather();
  g.drawImage(leatherCv, 60, 14);
  const C = '#f2d58c';
  if (mode === 'name') {
    text(daily ? 'SEASON RESULT' : 'NEW HIGH SCORE!', W / 2, 54, 16, C, 'center');
    text(daily ? (pendingRun.w ? 'TIME ' + fmtTime(pendingRun.t) : 'NOT FINISHED  LV ' + pendingRun.lv + '  PG ' + pendingRun.pg) : 'SCORE ' + String(score).padStart(7, '0'), W / 2, 76, 11, '#fff1d0', 'center');
    text((pendingRun.c > 1 ? trialName(pendingRun.c - 1) + '  ' : '') + 'STAGE ' + pendingRun.st + '   LV ' + pendingRun.lv + (pendingRun.w && !daily ? '   WORLD SAVED' : ''), W / 2, 92, 8, '#d9b98a', 'center');
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 44, sel = i === namePos;
      g.fillStyle = 'rgba(20,8,0,0.55)'; g.fillRect(x - 17, 112, 34, 52);
      g.strokeStyle = sel ? '#ffd24a' : '#8a6a3a'; g.lineWidth = 1; g.strokeRect(x - 16.5, 112.5, 33, 51);
      text(LETTERS[nameBuf[i]], x, 150, 34, sel ? '#fff1b0' : '#d9b98a', 'center');
      if (sel && (tickN >> 4) & 1) { g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(x - 6, 108); g.lineTo(x + 6, 108); g.lineTo(x, 100); g.fill(); g.beginPath(); g.moveTo(x - 6, 168); g.lineTo(x + 6, 168); g.lineTo(x, 176); g.fill(); }
    }
    text('W/S LETTER    A/D MOVE', W / 2, 206, 8, '#d9b98a', 'center');
    if ((tickN >> 5) & 1) text('PRESS ENTER TO SIGN THE BOARD', W / 2, 232, 9, '#fff', 'center');
    return;
  }
  const bv = viewOf(); boardBoxes = [];
  text(bv === 3 ? 'PAST SEASONS' : bv === 2 ? 'ETERNAL BOARD' : bv ? 'SEASON BOARD' : 'LEATHERBOARD', W / 2, 44, 18, C, 'center');
  const sub = bv === 3 ? (archKey() ? 'SEASON ' + seasonNo(archKey()) + '   ' + archKey() + '   ' + DAILY_MODS[modOfDay(archKey())].name : 'NO SEASON IS OVER YET')
    : bv === 2 ? 'EVERY PLAYER\'S FASTEST RACE, ALL SEASONS'
    : bv ? seasonStr() + '   ' + DAILY_MODS[daily ? daily.mod : dayMod()].name + '   ' + (seasonDaysLeft() ? seasonDaysLeft() + ' DAYS LEFT' : 'LAST DAY') : 'HALL OF EMBER WARDENS';
  text(sub, W / 2, 58, 8, '#c9a86a', 'center');
  const chip = (label, k, right) => { g.font = 'bold 7px "Courier New",monospace'; const w = Math.ceil(g.measureText(tr(label)).width) + 8, x = right ? 408 - w : 74;
    g.fillStyle = 'rgba(30,14,2,0.7)'; g.fillRect(x, 32, w, 12); g.strokeStyle = '#8a6a3a'; g.strokeRect(x + 0.5, 32.5, w - 1, 11);
    text(label, x + w / 2, 41, 7, '#e6cfa0', 'center'); boardBoxes.push({ x, y: 32, w, h: 12, k }); };
  if (bv === 3) chip('A/D: OLDER / NEWER', 'arch', false); else if (bv) chip('HERO: ' + (boardHero ? CLASSES[HERO_FILT[boardHero]].name : 'ALL'), 'hero', false);
  if (bv) chip(bv === 3 ? 'H: SEASON BOARD' : bv === 2 ? 'H: PAST SEASONS' : 'H: ETERNAL BOARD', 'view', true);
  const hdr = '#b8935a', heroDot = (h, x, y) => { if (CLASSES[h]) { g.fillStyle = CLASSES[h].col; g.fillRect(x, y - 6, 5, 6); } };
  const elemDot = (e, x, y) => { if (e.b && e.b.el) { g.fillStyle = ELEM[e.b.el].col; g.beginPath(); g.arc(x, y - 3, 2.5, 0, 7); g.fill(); } };
  const onl = bv === 1 && onlineOn() && onlineBoard.rows && onlineBoard.day === seasonStr(), b = bv === 3 ? archRows() : bv === 2 ? hofRows() : bv === 1 ? boardRows() : loadBoard(0), ch = bv === 2 ? champsOf() : {};
  if (bv === 2) { text('SEASON', 78, 76, 7, hdr); text('NAME', 140, 76, 7, hdr); text('HERO', 168, 76, 7, hdr); text('TIME', 262, 76, 7, hdr, 'right'); text('RULE', 272, 76, 7, hdr); }
  else { text('#', 80, 76, 7, hdr); text('NAME', 104, 76, 7, hdr); text(bv ? 'TIME' : 'SCORE', 252, 76, 7, hdr, 'right'); text('STAGE', 266, 76, 7, hdr); text('LV', 322, 76, 7, hdr); if (bv) text('PG', 356, 76, 7, hdr); }
  for (let i = 0; i < 10; i++) {
    const y = 93 + i * 15, e = b[i];
    if (!bv ? i === boardHi : (bv === 1 && onl && onlineSent && e && e.n === onlineSent.n && e.t === onlineSent.t && e.h === onlineSent.h && mode === 'board') || (bv === 1 && !onl && i === boardHi)) { g.fillStyle = (tickN >> 4) & 1 ? 'rgba(255,210,90,0.28)' : 'rgba(255,210,90,0.12)';
      g.fillRect(72, y - 10, 336, 13); }
    if (bv && i === boardSel && e) { g.fillStyle = 'rgba(140,196,255,0.2)'; g.fillRect(72, y - 10, 336, 13); g.strokeStyle = '#8cc4ff'; g.strokeRect(72.5, y - 9.5, 335, 12); }
    const col = !e ? '#7a5a3a' : i === 0 ? '#ffe27a' : i < 3 ? '#fff1d0' : '#e6cfa0';
    if (e && bv) boardBoxes.push({ x: 72, y: y - 10, w: 336, h: 13, k: 'row', i });
    if (bv === 2) {
      if (e) { text(e.d.slice(0, 7), 78, y, 9, col); text(e.n, 140, y, 9, col); text(CLASSES[e.h] ? CLASSES[e.h].name : '', 168, y, 8, CLASSES[e.h] ? CLASSES[e.h].col : col);
        text(fmtTime(e.t), 262, y, 9, col, 'right'); text(DAILY_MODS[modOfDay(e.d)].name, 272, y, 7, '#b8935a'); elemDot(e, 400, y);
        (ch[e.n + '|' + e.h] || []).slice(0, 3).forEach((c, k) => text('S' + c.s, 350 + k * 15, y, 7, PLACE_COL[c.p])); } // the seasons this player won a place in: gold, silver, bronze else text('---', 140, y, 9, col);
      continue;
    }
    text(String(i + 1).padStart(2, ' '), 78, y, 9, col);
    if (e) { text(e.n, 104, y, 9, col); heroDot(e.h, 124, y); text(bv ? (e.w ? fmtTime(e.t) : '-') : String(e.s).padStart(7, '0'), 252, y, 9, col, 'right');
      text((e.c > 1 ? 'C' + e.c + ' ' : '') + 'S' + e.st, 270, y, 9, col); text(String(e.lv), 322, y, 9, col); if (bv) text(String(e.pg | 0), 356, y, 9, col);
      if (e.w) text('*', 396, y, 9, '#ffd24a', 'center'); if (bv) elemDot(e, 384, y); }
    else text('---', 104, y, 9, col);
  }
  text(bv === 1 || bv === 3 ? '* = REACHED LV 70 + 100 PARAGON' : bv === 2 ? 'S1 S2.. = PLACE IN A PAST SEASON: GOLD, SILVER, BRONZE' : '* = WORLD SAVED', 78, 240, 7, hdr);
  if (!bv) text('ON THIS DEVICE', W / 2, 67, 6, '#c98a6a', 'center');
  else if (bv === 1) {
    const rows = onl ? onlineBoard.rows : null, cnt = rows ? '  -  ' + (rows.length >= 1000 ? '1000+' : rows.length) + ' RUNS, ' + rows.filter(r => r.w).length + ' FINISHED' : '';
    const st = !onlineOn() ? 'THIS DEVICE ONLY' : onlineSendErr ? 'NOT SENT - ONLINE BOARD UNREACHABLE' : onl ? 'ONLINE BOARD' + cnt : onlineBoard.err ? 'OFFLINE - THIS DEVICE ONLY' : 'LOADING THE ONLINE BOARD...';
    text(st, W / 2, 67, 6, onl && !onlineSendErr ? '#9ad08a' : '#e0a070', 'center');
  } else {
    const st = !onlineOn() ? 'ONLINE ONLY' : hof.rows ? (hof.rows.length ? 'ONLINE BOARD' : 'NO WINNER YET') : hof.err ? 'OFFLINE' : 'LOADING THE ETERNAL BOARD...';
    text(st, W / 2, 67, 6, hof.rows && hof.rows.length ? '#9ad08a' : '#e0a070', 'center');
  }
  if (bv) text(bv === 3 ? 'W/S: SELECT   ENTER: BUILD + SPLITS   A/D: SEASON   H: SEASON BOARD' : bv === 1 ? 'W/S: SELECT   ENTER: BUILD + SPLITS   A/D: HERO   H: ETERNAL BOARD' : 'W/S: SELECT   ENTER: BUILD + SPLITS   A/D: HERO   H: PAST SEASONS', W / 2, 252, 6, '#c9a86a', 'center');
  if ((tickN >> 5) & 1) text(bv && boardSel >= 0 ? 'ENTER: BUILD' : 'PRESS ENTER', W / 2 + 40, 240, 9, '#fff', 'center');
  if (!boardDetail && bv < 2) drawShareHint(46, 408);
  if (boardDetail) drawBuild(boardDetail);
}
function drawBuild(e) { // the card of a run: hero, time, element and the six pieces
  const bd = e.b ? cleanBuild(e.b) : null, hc = CLASSES[e.h];
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a1608'; g.fillRect(96, 30, 288, 206); g.strokeStyle = '#c9a86a'; g.lineWidth = 1; g.strokeRect(96.5, 30.5, 287, 205);
  text(e.n + (hc ? '  ' + hc.name : ''), W / 2, 50, 12, hc ? hc.col : '#fff1d0', 'center');
  text((e.w ? 'TIME ' + fmtTime(e.t) : 'NOT FINISHED') + '   LV ' + e.lv + '  PG ' + (e.pg | 0), W / 2, 64, 8, '#e6cfa0', 'center');
  if (e.d) text(e.d + '   ' + DAILY_MODS[modOfDay(e.d)].name, W / 2, 75, 7, '#b8935a', 'center');
  const cs = champsOf()[e.n + '|' + e.h]; if (cs && cs.length) text(cs.slice(0, 3).map(c => 'S' + c.s + ' ' + PLACE_TXT[c.p]).join('   '), W / 2, 83, 6, PLACE_COL[cs[0].p], 'center'); // the titles this player has won
  if (boardPage === 1) { // the second page: the split times, against the fastest finished run that has them
    const sp = e.sp || {}, rows = viewOf() === 2 ? hof.rows : onlineBoard.rows, L = rows && rows.find(r => r.w && r.sp && Object.keys(r.sp).length && r !== e), has = SPLIT_KEYS.some(k => sp[k]);
    text('SPLIT TIMES' + (L && L.n !== e.n ? '   VS ' + L.n : ''), W / 2, 97, 9, '#ffd24a', 'center');
    if (!has) text('NO SPLITS SAVED FOR THIS RUN', W / 2, 140, 8, '#8a6a3a', 'center');
    else SPLIT_KEYS.forEach((k, i) => { const y = 116 + i * 13, v = sp[k], d = v && L && L.sp[k] ? v - L.sp[k] : null;
      text(splitName(k), 140, y, 8, '#b8935a'); text(v ? fmtTime(v) : '-', 262, y, 8, v ? '#fff1d0' : '#6a4a2a', 'right'); if (d != null) text(fmtDelta(d), 350, y, 8, d > 0 ? '#ff8a6a' : '#9ad08a', 'right'); });
  } else
  if (!bd) { text('NO BUILD SAVED FOR THIS RUN', W / 2, 140, 8, '#8a6a3a', 'center'); }
  else {
    text(bd.el ? ELEM[bd.el].name + '  TIER ' + ROMAN[bd.et] : 'NO ELEMENT', W / 2, 97, 9, bd.el ? ELEM[bd.el].col : '#8a7a9a', 'center');
    EQ_ORDER.forEach((sl, i) => {
      const y = 112 + i * 18, it = bd.eq.find(q => q[0] === sl);
      text(SLOT_NAME[sl], 108, y, 7, '#b8935a');
      if (it) { text(it[1], 156, y, 9, RARITY[it[2]].col); text('+' + it[3], 372, y, 9, '#ffd24a', 'right'); if (it[4]) text(SETS[it[4]].name || it[4], 156, y + 8, 6, '#7aff9a'); } else text('-', 156, y, 9, '#6a4a2a');
    });
  }
  text('A/D: ' + (boardPage ? 'BUILD' : 'SPLITS') + '   ENTER / ESC: CLOSE', W / 2, 226, 7, '#8a6a3a', 'center');
}

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

/* ---------- season journey: nine goals every season, paid in gold and coins, and a few cosmetic trails to unlock ---------- */
const JR_KEY = 'emberfall_journey_v1';
const JR_POOL = [
  { id: 'kill', ev: 'kill', n: 300, t: 'DEFEAT 300 FOES' },
  { id: 'elite', ev: 'elite', n: 15, t: 'DEFEAT 15 ELITE FOES' },
  { id: 'boss', ev: 'boss', n: 6, t: 'FELL 6 BOSSES' },
  { id: 'stage', ev: 'stage', n: 10, t: 'CLEAR 10 STAGES' },
  { id: 'chest', ev: 'chest', n: 12, t: 'OPEN 12 TREASURE CHESTS' },
  { id: 'gold', ev: 'goldchest', n: 2, t: 'OPEN 2 GOLDEN CHESTS' },
  { id: 'shrine', ev: 'shrine', n: 8, t: 'STRIKE 8 SHRINES' },
  { id: 'buffs', ev: 'buffs', n: 3, max: 1, t: 'HAVE 3 BLESSINGS AT ONCE' },
  { id: 'combo', ev: 'combo', n: 25, max: 1, t: 'REACH A KILL COMBO OF 25' },
  { id: 'elem', ev: 'elemkill', n: 100, t: 'DEFEAT 100 FOES UNDER AN ELEMENT' },
  { id: 'legend', ev: 'legend', n: 3, t: 'FIND 3 LEGENDARY OR BETTER ITEMS' },
  { id: 'forge', ev: 'forge', n: 10, t: 'FORGE SUCCESSFULLY 10 TIMES' },
  { id: 'wrath', ev: 'wrath', n: 10, t: 'CAST DRAGON\'S WRATH 10 TIMES' },
  { id: 'ride', ev: 'ride', n: 5, t: 'MOUNT A WYRMLING 5 TIMES' },
  { id: 'race', ev: 'race', n: 1, t: 'FINISH A SEASON RACE' },
  { id: 'race50', ev: 'race50', n: 1, t: 'REACH LV 50 IN A SEASON RACE' }
];
const COSM = { // trails of motes around the heroes: only a look, no power
  ember: { name: 'EMBER MOTES', col: '#ff9a4a', c2: '#ffd070' }, frost: { name: 'FROST MOTES', col: '#9adcff', c2: '#e8faff' },
  volt: { name: 'VOLT SPARKS', col: '#fff6a0', c2: '#6ab8ff' }, gild: { name: 'GILDED TRAIL', col: '#ffd24a', c2: '#ffffff' }
};
const JR_XP = 0.2; // every goal also pays this share of the XP your hero needs for its next level (or paragon point)
const JR_TIERS = [{ at: 3, cos: 'ember', coins: 0 }, { at: 6, cos: 'frost', coins: 1 }, { at: 9, cos: 'volt', coins: 2 }]; // 3, 6 and 9 goals of the season
const jrGoals = () => { const s = seasonNo(seasonStr()); return JR_POOL.map((q, i) => [((i + 3) * 37 + s * 53) % 101, q]).sort((a, b) => a[0] - b[0]).slice(0, 9).map(a => a[1]); }; // nine goals, another mix every season
let jrS = null;
function jrLoad() {
  const now = seasonStr(); if (jrS && jrS.s === now) return jrS;
  let o = null; try { o = unseal(localStorage.getItem(JR_KEY), JR_KEY); } catch (e) { } if (!o || typeof o !== 'object') o = {};
  const same = o.s === now, ids = JR_POOL.map(q => q.id), cos = (Array.isArray(o.cos) ? o.cos : []).filter(k => COSM[k]), n = {};
  if (same && o.n && typeof o.n === 'object') for (const id of ids) n[id] = clamp(+o.n[id] | 0, 0, 1e6);
  jrS = { s: now, n, done: same && Array.isArray(o.done) ? o.done.filter(id => ids.includes(id)) : [], tier: same ? clamp(o.tier | 0, 0, 3) : 0, cos, pick: cos.includes(o.pick) ? o.pick : '', pg: clamp(o.pg | 0, 0, 999), pc: clamp(o.pc | 0, 0, 99) };
  return jrS;
}
function jrSave() { if (DEV || !jrS) return; try { localStorage.setItem(JR_KEY, seal({ s: jrS.s, n: jrS.n, done: jrS.done, tier: jrS.tier, cos: jrS.cos, pick: jrS.pick, pg: jrS.pg, pc: jrS.pc })); } catch (e) { } }
function jrUnlock(S, k) { if (S.cos.includes(k)) return false; S.cos.push(k); if (!S.pick) S.pick = k; return true; }
function jrDone(S, q) { // a goal is reached: its gold waits for the saved hero, and every third goal opens a tier
  S.done.push(q.id); S.pg = Math.min(999, S.pg + 1); let t = 'JOURNEY: ' + q.t;
  JR_TIERS.forEach((T, i) => { if (S.tier <= i && S.done.length >= T.at) { S.tier = i + 1; S.pc = Math.min(99, S.pc + T.coins);
    if (jrUnlock(S, T.cos)) t = 'NEW TRAIL: ' + COSM[T.cos].name; else S.pg = Math.min(999, S.pg + 4); } });
  if (mode === 'play') { msg = t; msgT = 200; SFX.pick(); }
}
function jr(ev, v) { // an event of play; the race goals count only in the race, all the others only outside it
  if (DEV || tut) return; if ((ev.indexOf('race') === 0) !== !!daily) return;
  const S = jrLoad(); let ch = false;
  for (const q of jrGoals()) if (q.ev === ev) { const c = S.n[q.id] | 0, nv = Math.min(1e6, q.max ? Math.max(c, v | 0) : c + (v == null ? 1 : v));
    if (nv !== c) { S.n[q.id] = nv; ch = true; if (nv >= q.n && !S.done.includes(q.id)) jrDone(S, q); } }
  if (ch) jrSave();
}
function jrRaceWon() { jr('race'); const S = jrLoad(); if (jrUnlock(S, 'gild')) { jrSave(); if (daily) daily.newTrail = true; } } // the first finished race gives the gilded trail
function jrApply() { // the reward goes to the saved hero, never to the race hero
  if (daily || tut || DEV || mode !== 'play') return; const S = jrLoad(); if (!S.pg && !S.pc) return;
  const gd = S.pg * (100 + 12 * rpg.lvl), cn = Math.min(S.pc, Math.max(0, 9 - rpg.coins)), need = rpg.lvl >= MAX_LV ? (rpg.pg >= PG_MAX ? 0 : pgNeed(rpg.pg)) : xpNeed(rpg.lvl), xp = Math.round(S.pg * need * JR_XP);
  rpg.gold += gd; rpg.coins += cn; S.pg = 0; S.pc = 0; jrSave(); if (xp > 0) gainXP(xp); saveGame();
  floatText(hero.x, hero.y - 80, 'JOURNEY +' + gd + 'G' + (xp ? ' +' + xp + ' XP' : '') + (cn ? ' +' + cn + ' COIN' : ''), '#ffd24a', 8);
}
function cosFx() {
  const S = jrS || jrLoad(), C = COSM[S.pick]; if (!C || tickN % 3) return;
  for (const p of players()) { if (p.dead) continue; for (let i = 0; i < 2; i++) spawn(p.x + rnd(-10, 10), p.y, rnd(2, 40), 1, { c: [C.col, C.c2], l0: 16, l1: 30, add: true, size: 2, up: 0.8, g: -0.01 }); }
}
function jrCycle(d) { const S = jrLoad(), a = [''].concat(S.cos); S.pick = a[(a.indexOf(S.pick) + d + a.length) % a.length]; jrSave(); SFX.pick(); }
let journeyBox = null;
function openJourney() { jrLoad(); mode = 'journey'; SFX.pick(); }
function updateJourney() {
  if (isHit('left') || isHit('right')) jrCycle(isHit('right') ? 1 : -1);
  if (isHit('start') || isHit('back') || pressed.KeyG || pressed.Digit4) { mode = 'title'; SFX.pick(); }
}
function drawJourney() {
  const S = jrLoad(), gs = jrGoals(); g.fillStyle = 'rgba(4,2,10,0.78)'; g.fillRect(0, 0, W, H);
  text('SEASON JOURNEY', W / 2, 26, 16, '#ffb43a', 'center');
  text('SEASON ' + seasonNo(seasonStr()) + '   ' + seasonStr() + '   ' + (seasonDaysLeft() ? seasonDaysLeft() + ' DAYS LEFT' : 'LAST DAY') + '   ' + S.done.length + '/9 DONE', W / 2, 42, 8, '#c9a86a', 'center');
  text('EACH GOAL PAYS GOLD AND XP TO YOUR SAVED HERO. RACE GOALS COUNT IN THE RACE ONLY.', W / 2, 54, 6, '#8a7a9a', 'center');
  gs.forEach((q, i) => { const y = 74 + i * 14, d = S.done.includes(q.id), c = Math.min(q.n, S.n[q.id] | 0);
    text(d ? 'X' : '-', 40, y, 8, d ? '#7aff9a' : '#6a5a80'); text(q.t, 54, y, 8, d ? '#9ad08a' : '#e8e0f0');
    text(c + '/' + q.n, 372, y, 8, d ? '#7aff9a' : '#c9a86a', 'right'); bar(380, y - 6, 60, 4, c, q.n, d ? '#7aff9a' : '#ffb43a', '#1c1426'); });
  JR_TIERS.forEach((T, i) => { const x = 40 + i * 140, got = S.done.length >= T.at, own = S.cos.includes(T.cos);
    g.fillStyle = 'rgba(40,24,60,0.85)'; g.fillRect(x, 206, 130, 26); g.strokeStyle = got ? COSM[T.cos].col : '#4a3a5a'; g.lineWidth = 1; g.strokeRect(x + 0.5, 206.5, 129, 25);
    text(T.at + ' GOALS' + (T.coins ? '  +' + T.coins + ' COIN' : ''), x + 65, 216, 7, got ? '#fff1d0' : '#8a7a9a', 'center'); text(COSM[T.cos].name, x + 65, 227, 7, got || own ? COSM[T.cos].col : '#6a5a80', 'center'); });
  const C = COSM[S.pick], opts = S.cos.length;
  journeyBox = { x: 90, y: 238, w: 300, h: 13 }; g.fillStyle = 'rgba(30,14,40,0.8)'; g.fillRect(journeyBox.x, journeyBox.y, journeyBox.w, 13); g.strokeStyle = C ? C.col : '#6a5a80'; g.strokeRect(journeyBox.x + 0.5, journeyBox.y + 0.5, journeyBox.w - 1, 12);
  text(opts ? 'TRAIL: ' + (C ? C.name : 'NONE') + '    A/D: CHANGE' : 'NO TRAIL YET  -  FINISH 3 GOALS OR A SEASON RACE', W / 2, 247, 8, C ? C.col : '#8a7a9a', 'center');
  text('ESC / ENTER: BACK', W / 2, 262, 7, '#8a7a9a', 'center');
  if (C && tickN % 3 === 0) spawn(W / 2 + 120 + cam, 150, rnd(0, 20), 1, { c: [C.col, C.c2], l0: 10, l1: 20, add: true, size: 1 });
}
/* ---------- share card: a picture of a finished season race for Facebook and friends ---------- */
let shareNote = '', shareNoteT = 0, shareBox = null;
function shareData() { // the run on screen: the race that has just been won, or the one that was signed on the board; null when no finished race
  if (!daily) return null; const pr = pendingRun && pendingRun.t ? pendingRun : null, w = pr ? pr.w : daily.done; if (!w) return null;
  const rows = onlineOn() && onlineBoard.day === seasonStr() && onlineBoard.rows ? bestPer(onlineBoard.rows.filter(r => r.w)) : null, t = pr ? pr.t : daily.t;
  return { n: pr ? (pr.n || rpg.ini) : rpg.ini, h: pr ? pr.h : CLS, t, lv: pr ? pr.lv : rpg.lvl, pg: pr ? pr.pg | 0 : rpg.pg, season: seasonNo(seasonStr()), month: seasonStr(), rule: DAILY_MODS[daily.mod].name,
    sp: pr && pr.sp ? splitsFrom(pr.sp) : daily.sp || {}, el: rpg.elem || '', et: elemTier(), rank: rows ? rows.filter(r => r.t < t).length + 1 : 0, of: rows ? rows.length : 0 };
}
function drawShareCard(c, d) { // c: a 2d context of 1200x630
  const R = 'bold ', F = ' "Courier New",monospace', hc = CLASSES[d.h], mid = 600;
  const bg = c.createLinearGradient(0, 0, 0, 630); bg.addColorStop(0, '#0a0610'); bg.addColorStop(1, '#2a0e08'); c.fillStyle = bg; c.fillRect(0, 0, 1200, 630);
  const gl = c.createRadialGradient(mid, 120, 10, mid, 120, 520); gl.addColorStop(0, 'rgba(255,150,60,0.35)'); gl.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = gl; c.fillRect(0, 0, 1200, 630);
  c.strokeStyle = '#c9a86a'; c.lineWidth = 4; c.strokeRect(18, 18, 1164, 594); c.lineWidth = 1; c.strokeRect(30, 30, 1140, 570);
  c.textAlign = 'center'; const T = (s, y, px, col, w) => { c.font = (w === 0 ? '' : R) + px + 'px' + F; c.fillStyle = col; c.fillText(s, mid, y); };
  const tg = c.createLinearGradient(0, 60, 0, 140); tg.addColorStop(0, '#fff1b0'); tg.addColorStop(0.5, '#ffb43a'); tg.addColorStop(1, '#e0431f'); c.font = R + '96px' + F; c.fillStyle = '#2a0e08'; c.fillText('EMBERFALL', mid + 5, 135); c.fillStyle = tg; c.fillText('EMBERFALL', mid, 130);
  T('THE ASHEN VOW  -  SEASON RACE', 175, 30, '#c9a8ff');
  T('SEASON ' + d.season + '   ' + d.month + '   ' + d.rule, 222, 30, '#ffd24a');
  T((hc ? hc.name : String(d.h).toUpperCase()) + (d.n ? '  (' + d.n + ')' : ''), 285, 54, hc ? hc.col : '#ffffff');
  T('LV ' + d.lv + '  +  PARAGON ' + d.pg, 325, 32, '#e6cfa0');
  T(fmtTime(d.t), 440, 130, '#fff1b0'); T('FASTEST PLAY TIME WINS', 478, 24, '#b8935a', 0);
  if (d.rank) T('RANK #' + d.rank + ' OF ' + d.of + ' FINISHERS THIS SEASON', 515, 32, d.rank <= 3 ? PLACE_COL[d.rank] : '#9ad08a');
  const ks = SPLIT_KEYS.filter(k => d.sp[k]); if (ks.length) { const w = 1080 / ks.length; ks.forEach((k, i) => { c.font = R + '22px' + F; c.fillStyle = '#b8935a'; c.fillText(splitName(k), 60 + w * (i + 0.5), 574); c.fillStyle = '#fff1d0'; c.fillText(fmtTime(d.sp[k]), 60 + w * (i + 0.5), 595); }); }
  if (d.el && ELEM[d.el]) { c.fillStyle = ELEM[d.el].col; c.beginPath(); c.arc(70, 62, 12, 0, 7); c.fill(); c.textAlign = 'left'; c.font = R + '22px' + F; c.fillText(ELEM[d.el].name + ' ' + ROMAN[d.et], 90, 70); c.textAlign = 'center'; }
  T('cooldance84.github.io/Emberfall', 551, 18, '#8a7a9a', 0);
}
function shareCard() {
  const d = shareData(); if (!d) { SFX.land(); shareNote = 'FINISH THE RACE TO SHARE IT'; shareNoteT = 180; return; }
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630; const c = cv.getContext('2d'); drawShareCard(c, d);
  const note = s => { shareNote = s; shareNoteT = 240; };
  if (!cv.toBlob) { note('THIS BROWSER CANNOT MAKE THE IMAGE'); return; }
  cv.toBlob(b => {
    if (!b) { note('COULD NOT MAKE THE IMAGE'); return; }
    const name = 'emberfall-season-' + d.season + '-' + fmtTime(d.t).replace(/:/g, '') + '.png', f = typeof File === 'function' ? new File([b], name, { type: 'image/png' }) : null;
    if (f && navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: 'Emberfall season race', text: 'My Emberfall season race: ' + fmtTime(d.t) + '  https://cooldance84.github.io/Emberfall/' }).then(() => note('SHARED'), () => { }); return; }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); note('IMAGE SAVED TO YOUR DOWNLOADS'); } catch (e) { note('COULD NOT SAVE THE IMAGE'); }
  }, 'image/png');
}
function drawShareHint(y, xr) { // a chip on the screens of a finished race; the note shows what happened
  if (!daily || !shareData()) { shareBox = null; return; }
  const t = 'Y: SHARE IMAGE'; g.font = '8px "Courier New",monospace'; const w = g.measureText(t).width + 10; shareBox = { x: (xr || W - 4) - w, y, w, h: 13 };
  g.fillStyle = 'rgba(20,10,40,0.75)'; g.fillRect(shareBox.x, y, w, 13); g.strokeStyle = '#8cc4ff'; g.strokeRect(shareBox.x + 0.5, y + 0.5, w - 1, 12); text(t, shareBox.x + w / 2, y + 10, 8, '#8cc4ff', 'center');
  if (shareNoteT > 0) { shareNoteT--; text(shareNote, W / 2, 262, 8, '#9ad08a', 'center'); }
}
/* ---------- training: a short guided arena that teaches the buttons; nothing in it is saved, paid or counted ---------- */
const TUT_KEY = 'emberfall_tut_v1';
const tutDone = () => { try { return localStorage.getItem(TUT_KEY) === '1'; } catch (e) { return false; } };
const tutMark = () => { try { localStorage.setItem(TUT_KEY, '1'); } catch (e) { } };
const tutNeeded = () => !tutDone() && rpg.lvl <= 1; // a hero that already has progress knows the game: no training for it
const tutKeys = () => IS_TOUCH ? { move: 'THE STICK', atk: 'THE ATK BUTTON', jump: 'THE JUMP BUTTON', magic: 'THE MAGIC BUTTON', skill: 'THE SKILL BUTTON', ride: 'THE RIDE BUTTON', gear: 'THE GEAR BUTTON', pause: 'THE II BUTTON' }
  : { move: 'WASD OR THE ARROWS', atk: 'J OR Z  (PAD: X)', jump: 'K, X OR SPACE  (PAD: A)', magic: 'SHIFT, L OR C  (PAD: B)', skill: 'U  (Q SWAPS)', ride: 'E  (PAD: Y)', gear: 'I OR TAB', pause: 'ESC OR P' };
const TUT_STEPS = [
  { id: 'move', name: 'MOVE', lines: k => ['WALK TO THE GLOWING MARKER.', 'USE ' + k.move + '.'] },
  { id: 'atk', name: 'ATTACK', lines: k => ['HIT THE DUMMY 3 TIMES WITH ' + k.atk + '.', 'THREE HITS IN A ROW ARE A COMBO: THE LAST ONE KNOCKS FOES BACK.'] },
  { id: 'jump', name: 'JUMP', lines: k => ['PRESS ' + k.jump + ' TO JUMP.', 'YOU CAN ATTACK IN THE AIR TOO. JUMP OVER CHASMS AND DANGER.'] },
  { id: 'fight', name: 'FIGHT', lines: () => ['DEFEAT THE 2 HUSKS.', 'WATCH THEIR WIND-UP, STEP AWAY, THEN HIT BACK.'] },
  { id: 'mount', name: 'RIDE A WYRMLING', lines: k => ['STAND NEXT TO THE WYRMLING AND PRESS ' + k.jump + ' TO CLIMB ON.', 'IT RUNS FASTER, JUMPS HIGHER AND CARRIES YOU THROUGH A HIT.'] },
  { id: 'ride', name: 'FIGHT FROM THE SADDLE', lines: k => ['DEFEAT THE 2 HUSKS WITH ' + k.atk + ' (THE WYRMLING BREATHES FIRE).', 'A HEAVY BLOW THROWS YOU OFF; IT BOLTS AFTER THE SECOND FALL.'] },
  { id: 'dismount', name: 'DISMOUNT', lines: k => ['PRESS ' + k.ride + ' TO GET OFF THE WYRMLING.', 'IT STAYS WHERE YOU LEFT IT: JUMP BACK ON WHENEVER YOU WANT.'] },
  { id: 'wrath', name: 'DRAGON WRATH', lines: k => ['PRESS ' + k.magic + ' TO CALL THE DRAGON.', 'IT NEEDS EMBER JARS (SMASH VASES). SAVE IT FOR BOSSES AND CROWDS.'] },
  { id: 'shrine', name: 'SHRINE', lines: k => ['HIT THE SHRINE WITH ' + k.atk + '.', 'EACH GIVES A TIMED BLESSING. UP TO 3 RUN AT THE SAME TIME.'] }
];
function tutFoes(n) { for (let i = 0; i < n; i++) { const f = makeFighter('h', cam + W + 16 + i * 34, 190 + (i % 3) * 20); f.noLoot = true; enemies.push(f); } }
function tutMount(n) { const x = hero.x > W - 90 ? hero.x - 50 : hero.x + 50; mounts.push(makeMount(x, hero.y, null, 'ember')); }
function tutSaddle() { if (hero.mount) return; const m = makeMount(hero.x, hero.y, null, 'ember'); hero.mount = m; }
function tutEnter() { // sets up the next step
  const T = tut, st = TUT_STEPS[T.i]; T.t = 0; T.done = 0; if (!st) return;
  if (st.id === 'atk') { const d = makeFighter('h', 300, 215); d.k = Object.assign({}, d.k, { name: 'TRAINING DUMMY', spd: 0, dmg: 0, windup: 99999, rng: 0 }); d.hp = d.maxhp = 99999; d.noLoot = true; enemies.push(d); T.dummy = d; T.hits = 0; }
  else if (st.id === 'fight') { if (T.dummy) T.dummy.gone = true; T.dummy = null; tutFoes(2); }
  else if (st.id === 'mount') { for (const e of enemies) if (!e.dead) e.gone = true; mounts = []; tutMount(); }
  else if (st.id === 'ride') { tutSaddle(); mounts = []; T.sad = true; tutFoes(2); }
  else if (st.id === 'dismount') { for (const e of enemies) if (!e.dead) e.gone = true; tutSaddle(); }
  else if (st.id === 'wrath') { mounts = []; for (const p of players()) { p.vases = 2; p.mana = 60; } tutFoes(4); }
  else if (st.id === 'shrine') { for (const e of enemies) if (!e.dead) e.gone = true; shrines.push({ x: 300, y: 215, used: 0, t: 0, shake: 0, sacred: false }); }
}
let trainBox = null;
function startTutorial(after, fromTitle) {
  const snap = { lvl: rpg.lvl, xp: rpg.xp, elem: rpg.elem, et: rpg.et, eg: rpg.eg, tr: rpg.tr, pg: rpg.pg, pxp: rpg.pxp, bag: rpg.bag, eq: rpg.eq, coins: rpg.coins, gold: rpg.gold, coop, cycle, stageIdx };
  coop = false; cycle = 0; rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; rpg.coins = 0; rpg.gold = 0; PS = null;
  tut = { i: 0, t: 0, done: 0, hits: 0, dummy: null, seen: false, after, snap, fromTitle: !!fromTitle }; // set first: from here on nothing is saved or counted
  resetGame(); stageIdx = 0; shop = null; const S = STAGES[0]; TH = themeFor(S.theme, actOf(0)); weather = null; WAVES = []; STAGE_END = W; heroStats(true);
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null; decals = []; impT = 1e9; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 0; flashA = 0; shake = 0; freeze = 0;
  intro = null; slashes = []; vents = []; chests = []; gaps = []; ambW = -1; shrines = []; buffs = []; killCombo = 0; bonus = null;
  hero.x = 80; hero.y = 205; hero.inv = 60; tutEnter(); mode = 'play'; SFX.big();
}
function tutFinish() { // the end or a skip: the hero comes back exactly as it was
  const T = tut, s = T.snap; tut = null; tutMark();
  Object.assign(rpg, { lvl: s.lvl, xp: s.xp, elem: s.elem, et: s.et, eg: s.eg, tr: s.tr, pg: s.pg, pxp: s.pxp, bag: s.bag, eq: s.eq, coins: s.coins, gold: s.gold });
  coop = s.coop; cycle = s.cycle; PS = null; shrines = []; buffs = []; mounts = []; dragon = null; bossRef = null; enemies = []; items = []; parts = []; floats = []; msg = ''; msgT = 0;
  TH = THEMES[0]; weather = 'ash'; mode = 'title'; resetGame(); stageIdx = s.stageIdx; heroStats(true); SFX.magic(); T.after();
}
function updateTutorial() {
  const T = tut; T.t++;
  for (const p of players()) { p.x = clamp(p.x, 12, W - 12); if (!p.dead && p.hp < 40) p.hp = Math.round(p.maxhp * 0.6); } // the training cannot be lost
  const st = TUT_STEPS[T.i];
  if (!st) { if (T.t > 30 && (isHit('start') || isHit('atk'))) tutFinish(); return; } // the summary page
  if (T.done) { if (++T.done > 60) { T.i++; tutEnter(); } return; }
  let ok = false;
  if (st.id === 'move') ok = Math.abs(hero.x - 380) < 24 && Math.abs(hero.y - 215) < 28;
  else if (st.id === 'atk') { const D = T.dummy; if (D) { if (D.hp < D.maxhp) { T.hits++; D.hp = D.maxhp; } D.x = clamp(D.x, 160, W - 50); } ok = T.hits >= 3; }
  else if (st.id === 'jump') ok = hero.z > 6;
  else if (st.id === 'fight') ok = T.t > 30 && !enemies.some(e => !e.dead && !e.gone);
  else if (st.id === 'mount') { if (!hero.mount && !mounts.some(m => !m.flee && !m.gone)) tutMount(); ok = !!hero.mount; }
  else if (st.id === 'ride') {
    if (hero.mount) T.sad = true; else if (T.sad && T.t > 20 && !mounts.some(m => !m.flee && !m.gone)) tutMount(); // thrown off twice: a fresh wyrmling
    ok = T.t > 30 && !enemies.some(e => !e.dead && !e.gone);
  }
  else if (st.id === 'dismount') ok = T.t > 10 && !hero.mount;
  else if (st.id === 'wrath') { if (dragon) T.seen = true; ok = T.seen && !dragon; }
  else if (st.id === 'shrine') ok = buffs.length > 0;
  if (ok) { T.done = 1; floatText(hero.x, hero.y - 70, ['GOOD!', 'NICE!', 'GREAT!'][T.i % 3], '#7aff9a', 9); SFX.pick(); }
}
function drawTutHud() {
  const T = tut, st = TUT_STEPS[T.i], k = tutKeys(), P = (tickN >> 4) & 1;
  if (!st) { // the summary: every button on one page
    g.fillStyle = 'rgba(8,4,16,0.9)'; g.fillRect(40, 36, 400, 214); g.strokeStyle = '#c9a86a'; g.strokeRect(40.5, 36.5, 399, 213);
    text('TRAINING COMPLETE', W / 2, 58, 14, '#ffb43a', 'center');
    [['MOVE', k.move], ['ATTACK  (3-HIT COMBO)', k.atk], ['JUMP / CLIMB ON A WYRMLING', k.jump], ['GET OFF THE WYRMLING', k.ride], ['DRAGON WRATH  (EMBER JAR)', k.magic], ['SPECIAL SKILL  (FROM LV 10)', k.skill], ['GEAR AND BACKPACK', k.gear], ['PAUSE AND CONTROLS', k.pause]]
      .forEach(([a, b], i) => { text(a, 56, 82 + i * 14, 8, '#c9a86a'); text(b, 424, 82 + i * 14, 8, '#fff1d0', 'right'); });
    text('WYRMLINGS FIGHT WITH YOU: ATTACK = THEIR BREATH. TWO FALLS AND THEY BOLT.', W / 2, 198, 7, '#c9a8ff', 'center');
    text('AFTER EACH STAGE: SHOP, THEN BLACKSMITH. COINS CONTINUE A LOST RUN.', W / 2, 211, 7, '#c9a8ff', 'center');
    if (T.t > 30 && P) text((IS_TOUCH ? 'OK' : 'ENTER') + (T.fromTitle ? ': BACK TO THE TITLE' : ': START THE GAME'), W / 2, 232, 9, '#ffffff', 'center'); return;
  }
  const px = 144, py = 76; // up in the sky: the fighting happens below, on the ground
  g.fillStyle = 'rgba(8,4,16,0.84)'; g.fillRect(px, py, 322, 58); g.strokeStyle = T.done ? '#7aff9a' : '#c9a86a'; g.strokeRect(px + 0.5, py + 0.5, 321, 57);
  TUT_STEPS.forEach((s, i) => { g.fillStyle = i < T.i || (i === T.i && T.done) ? '#7aff9a' : i === T.i ? '#ffd24a' : '#4a3a5a'; g.fillRect(px + 8 + i * 12, py + 7, 8, 4); });
  text((T.i + 1) + '/' + TUT_STEPS.length, px + 124, py + 12, 7, '#8cc4ff');
  text(IS_TOUCH ? 'II: SKIP' : 'ESC: SKIP', px + 314, py + 12, 7, '#8a7a9a', 'right');
  text(st.name, px + 8, py + 28, 11, T.done ? '#7aff9a' : '#ffb43a');
  st.lines(k).forEach((l, i) => text(l, px + 8, py + 41 + i * 11, 7, '#fff1d0'));
  if (st.id === 'move' && !T.done) { const r = 14 + (P ? 3 : 0); g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.beginPath(); g.ellipse(380 - cam, 215, r, r * 0.4, 0, 0, 7); g.stroke(); g.lineWidth = 1; text('v', 380 - cam, 184 + P * 3, 12, '#ffd24a', 'center'); }
  if (st.id === 'atk' && T.dummy) text('HITS ' + Math.min(3, T.hits) + '/3', T.dummy.x - cam, T.dummy.y - T.dummy.h - 12, 8, '#ffd24a', 'center');
}
/* ---------- particles ---------- */
function spawn(x, y, z, n, o) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(o.s0 || 0.5, o.s1 || 2);
    parts.push({
      x, y, z, vx: Math.cos(a) * s * (o.flat ? 1 : 1) + (o.dx || 0), vy: o.flat ? Math.sin(a) * s * 0.3 : 0,
      vz: o.up ? rnd(o.up * 0.5, o.up) : Math.sin(a) * s * 0.6, life: rnd(o.l0 || 14, o.l1 || 30), max: 30, g: o.g === undefined ? 0.12 : o.g,
      c: Array.isArray(o.c) ? o.c[Math.random() * o.c.length | 0] : o.c, size: o.size || 1, add: !!o.add
    });
  }
}
function sparks(x, y, z, big) {
  spawn(x, y, z, big ? 22 : 11, { s0: 1, s1: big ? 4 : 2.6, c: ['#fff6c8', '#ffcf5a', '#ff8a2a'], l0: 8, l1: 20, add: true, size: big ? 2 : 1 });
}
function dust(x, y, n) { spawn(x, y, 0, n, { s0: 0.3, s1: 1.2, c: ['#8d7a8f', '#6a5870'], l0: 12, l1: 26, up: 0.8, g: 0.02, flat: true, size: 2 }); }

/* ---------- combat ---------- */
function hurt(e, dmg, kind, from) {
  if (!e.pn && !isBoss(e) && from.pn && !e.dead && e.hp > 0 && e.kind !== 'imp' && (e.st === 'down' || e.st === 'getup')) { // a foe on the ground can still be hit, for half damage: the combo never stalls while it gets up
    if (e.barrier > 0) return false;
    dmg = Math.max(1, Math.round(dmg * 0.5)); e.hp -= dmg; e.flash = 4; lastEnemy = e; sparks(e.x, e.y, e.z + 6, false); SFX.hit();
    if (e.hp <= 0) { e.hp = 0; e.st = 'down'; e.t = 21; e.z = 0; e.vz = 0; e.vx = 0; }
    return true;
  }
  if (e.dead || e.inv > 0 || e.st === 'down' || e.st === 'getup') return false;
  const dir = sgn(e.x - from.x) || -from.face;
  if (!e.pn && e.el && e.el.frz > 0 && elemTier() >= 4) dmg = Math.round(dmg * 1.2); // frozen foes are brittle
  if (!e.pn && from.pn && e.el && (e.el.burn > 0 || e.el.frz > 0 || e.el.stun > 0 || e.el.chill > 0)) { const af = setBonus('afl'); if (af) dmg = Math.round(dmg * (1 + af / 100)); } // Emberheart 4: more damage to burning, frozen, stunned or chilled foes
  if (e.pn && !from.pn) dmg = Math.max(1, Math.round(dmg * dmgMul() * (dailyIs('GLASS CANNON') ? 1.5 : 1) * (from.kind && BOSSES[from.kind] ? 1.15 : 1) * (from.elite ? 1.25 : 1) * (1 - elemResist(hitEl || from.el || ENEMY_EL[from.kind])) * (1 - pgRes())));
  if (e.pn && !from.pn) { // a hit on a hero: the shrine ward soaks it first; only a blow that gets through breaks the kill combo
    const wardB = buffs.find(b => b.id === 'ward' && b.ward > 0);
    if (wardB) {
      const ab = Math.min(wardB.ward, dmg); wardB.ward -= ab; dmg -= ab; e.flash = 3;
      spawn(e.x, e.y, e.z + 24, 6, { c: ['#9ae8ff', '#ffffff'], l0: 8, l1: 16, add: true });
      floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9, '-' + ab, '#6ab8ff', 8);
      if (dmg <= 0) { e.inv = Math.max(e.inv, 8); SFX.land(); return true; }
    }
    killCombo = 0;
  }
  if (!e.pn && e.barrier > 0 && e.kind !== 'imp') { // arcane barrier: no damage gets through until it shatters; heavy blows crack it fastest
    const d = kind === 'down' ? dmg : Math.max(1, Math.round(dmg * 0.35));
    e.barrier -= d; e.bflash = 6; e.blockT = tickN; lastEnemy = e; freeze = Math.max(freeze, 2);
    spawn(e.x, e.y, e.z + e.h * 0.55, 6, { c: ['#9ae8ff', '#e0f8ff', '#b88aff'], l0: 8, l1: 16, add: true });
    if (e.barrier <= 0) {
      e.barrier = 0; e.bbreak = tickN; e.st = 'down'; e.t = 0; e.vz = 3; e.vx = dir * 1.6; e.z = Math.max(e.z, 0.01);
      spawn(e.x, e.y, e.z + e.h * 0.5, 26, { s0: 1, s1: 3.2, c: ['#9ae8ff', '#ffffff', '#b88aff'], l0: 12, l1: 28, add: true, size: 2, up: 2, g: 0.06 });
      if (from.pn) floatText(e.x, e.y - e.h - 10, 'BARRIER BROKEN!', '#9ae8ff', 9); SFX.big(); shake = Math.max(shake, 5);
    } else { if (!(from.sk && from.sk.id === 6 && kind === 'hurt')) SFX.land(); if (from.pn && !(from.sk && from.sk.id === 6 && kind === 'hurt')) floatText(e.x, e.y - e.z - e.h * 0.9, kind === 'down' ? '-' + d : 'BARRIER', '#9ae8ff', 8); } // the ultimate's many ticks stay quiet on a barrier
    return true;
  }
  if (e.pn && e.mount) { // the blow throws the rider off; the wyrmling waits, but bolts after the second fall
    const m = e.mount; m.hp -= dmg; m.flash = 4; m.falls = (m.falls || 0) + 1; e.jf = 0;
    e.mount = null; e.h = e.k.h; e.flash = 4; e.st = 'hurt'; e.t = 0; e.vx = dir * 1.8; e.vz = 2.6; e.z = Math.max(e.z, 0.01); e.inv = 55;
    m.x = e.x - dir * 14; m.y = e.y; m.z = 0.01; m.vz = 3; m.face = dir || m.face;
    if (m.falls >= 2 || m.hp <= 0) { m.flee = true; m.dir = -dir || 1; msg = mtype(m).name + ' BOLTED!'; msgT = 90; SFX.die(); }
    else { msg = 'THROWN!  K NEAR THE ' + mtype(m).name.split(' ')[0] + ' TO REMOUNT  (1 FALL LEFT)'; msgT = 110; }
    mounts.push(m); sparks(e.x, e.y, e.z + 20, true); SFX.hit(); shake = Math.max(shake, 4); freeze = Math.max(freeze, 3);
    return true;
  }
  if (e.k && e.k.ai === 'guard' && kind !== 'down' && (e.st === 'idle' || e.st === 'walk') && sgn(from.x - e.x) === e.face) { // shield up
    e.hp -= Math.max(1, Math.round(dmg * 0.2)); e.flash = 2; e.blockT = tickN; lastEnemy = e; sparks(e.x + e.face * 14, e.y, e.h * 0.5, false); SFX.land(); freeze = Math.max(freeze, 1);
    if (from.pn) floatText(e.x, e.y - e.h, 'BLOCK', '#c8a8ff', 8);
    if (e.hp <= 0) { e.st = 'down'; e.t = 0; e.vz = 3; e.z = 0.01; }
    return true;
  }
  e.hp -= dmg; e.flash = 4; e.lastHit = tickN;
  sparks(e.x, e.y, e.z + e.h * 0.6, kind === 'down');
  slashes.push({ x: e.x, y: e.y, z: e.z + e.h * 0.6, t: 0, big: kind === 'down', a: dir > 0 ? rnd(-0.9, -0.3) : Math.PI + rnd(0.3, 0.9) });
  if (!e.pn) lastEnemy = e;
  else shake = Math.max(shake, 4);
  SFX[kind === 'down' ? 'big' : 'hit']();
  freeze = Math.max(freeze, kind === 'down' ? 7 : 3);
  shake = Math.max(shake, kind === 'down' ? 6 : 2);
  if (from.pn && !dragon) from.mana = Math.min(100, from.mana + dmg * 0.6 * (from.k && from.k.cls === 'panni' ? 1.5 : 1));
  if (e.kind === 'imp' && e.vase) { // the pilferer drops its vase and bolts
    e.vase = false; e.fled = true; e.dir = sgn(e.x - from.x) || 1;
    items.push({ x: e.x, y: e.y, t: 0, kind: 'vase' });
  }
  let knock = kind === 'down' || e.hp <= 0 || (e.z > 3 && !e.leap && !e.hov); // a blow in mid-air always knocks you out of the air
  if (e.mount && (kind === 'down' || e.hp <= 0 || e.hp <= e.maxhp * 0.55)) { // rider thrown from its wyrmling
    const m = e.mount; e.mount = null; e.h = e.k.h;
    m.x = e.x + dir * 6; m.y = e.y; m.z = 0.01; m.vz = 3; m.face = -dir; mounts.push(m);
    spawn(e.x, e.y, 14, 10, { c: ['#ffd070', '#ff8a2a'], l0: 10, l1: 20, add: true });
    knock = true;
  }
  if (isBoss(e) && e.hp > 0) { e.armor -= dmg; if (e.armor <= 0) { e.armor = e.k.poise || 70; knock = true; } else knock = false; }
  if (knock) { e.st = 'down'; e.t = 0; e.vz = 3.2; e.vx = dir * 2.1; e.z = Math.max(e.z, 0.01); e.combo = 0; }
  else if (!isBoss(e)) { // Nolan's heavy sword swing is not interrupted by light blows (heavy ones still knock him down)
    if (e.pn && e.k && e.k.cls === 'nolan' && e.st === 'atk' && !e.sk && kind !== 'down' && e.z <= 3 && e.t >= comboOf(e)[e.combo].a - 2 && e.t <= comboOf(e)[e.combo].b + 2) spawn(e.x, e.y, e.z + 26, 5, { c: ['#fff1b0', '#ffd24a'], l0: 6, l1: 12, add: true });
    else { e.st = 'hurt'; e.t = 0; e.vx = dir * 1.1; }
  }
  return true;
}
const elBase = () => 9 * pstats().mult * (buffIs('fury') ? 1.3 : 1) * (1 + elemPower() / 100);
function elOf(e) { return e.el || (e.el = { fire: 0, frost: 0, bolt: 0, burn: 0, bst: 0, frz: 0, stun: 0, chill: 0, cd: 0, acc: 0, shk: 0 }); }
function elNear(e, r) { return enemies.filter(o => o !== e && !o.dead && o.kind !== 'imp' && Math.abs(o.x - e.x) < r && Math.abs(o.y - e.y) < r * 0.6); }
const DMG_COL = { '#7ad8ff': '#ffffff', '#c8a8ff': '#4aa8ff' }; // frost damage shows white, lightning damage blue
function elDmg(e, d, col) { // status damage: no knock-back, no invulnerability frames; a kill falls through the normal death path
  if (e.dead || !(d > 0) || e.barrier > 0) return; d = Math.max(1, Math.round(d)); e.hp -= d; lastEnemy = e;
  floatText(e.x + rnd(-5, 5), e.y - e.z - e.h * 0.95, String(d), DMG_COL[col] || col, 7);
  if (e.hp <= 0 && e.st !== 'down' && e.st !== 'getup') { e.st = 'down'; e.t = 0; e.vz = 2; e.vx = 0; e.z = Math.max(e.z, 0.01); }
}
function elArc(a, b, col) { for (let i = 0; i <= 5; i++) { const t = i / 5; spawn(a.x + (b.x - a.x) * t + rnd(-3, 3), a.y + (b.y - a.y) * t, a.h * 0.55 + rnd(-6, 6), 1, { c: col, l0: 6, l1: 12, add: true, size: 2, g: 0 }); } }
let elDepth = 0; // chains can never run away: a hit cascading through foes is cut off after a few hops
function elemBuild(e, el, amt, T, noSpread) { if (elDepth > 5) return; elDepth++; try { elemBuild0(e, el, amt, T, noSpread); } finally { elDepth--; } }
function elemBuild0(e, el, amt, T, noSpread) {
  const S = elOf(e), R = ePar(); if (e.dead || e.barrier > 0) return;
  const rs = clamp((ELEM_RES[e.kind] || {})[el] || 1, 0.4, 1.4) * (isBoss(e) ? 0.8 : 1); amt *= rs;
  S[el] += amt;
  if (el === 'fire' && S.burn > 0) S.burn = Math.max(S.burn, 150 + 25 * T);
  if (!noSpread && T >= 5 && (el === 'fire' ? S.burn > 0 : el === 'frost' ? S.chill > 0 || S.frz > 0 : S.shk > 0)) { // from tier V an afflicted foe takes its next layer after fewer direct hits: a separate quick-layer meter (chained and spread build-up never counts), so the main build-up and its bursts are untouched
    S.lq = (S.lq || 0) + amt;
    if (S.lq >= 65) { S.lq -= 65; if (el === 'fire') S.bst = Math.min(layerCap(), S.bst + 1); else if (el === 'frost') S.fst = Math.min(layerCap(), (S.fst | 0) + 1); else S.sst = Math.min(layerCap(), (S.sst | 0) + 1); }
  }
  if (S[el] < 100) return; S[el] -= 100;
  const base = elBase(), col = ELEM[el].col, cap = isBoss(e) ? 0.4 : 1;
  if (el === 'fire') {
    S.burn = [0, 150, 200, 200, 220, 240, 260, 300, 300, 320, 340][T]; S.bst = T >= 5 ? Math.min(layerCap(), S.bst + 1) : 1;
    floatText(e.x, e.y - e.h - 10, 'IGNITED', col, 8); SFX.burn(); spawn(e.x, e.y, e.h * 0.5, 8, { c: ['#ffd070', '#ff7a2a'], l0: 10, l1: 22, add: true, size: 2, up: 1.5 });
    if (T >= 3 && !noSpread) for (const o of elNear(e, 60 + 6 * R)) elemBuild(o, 'fire', 28 + 2 * R, T, true);
    if (T >= 7) for (const o of elNear(e, 50 + 6 * R)) elDmg(o, base * ELEM_PT[T] * 1.3, col);
  } else if (el === 'frost') {
    S.fst = T >= 5 ? Math.min(layerCap(), (S.fst | 0) + 1) : 1; // from tier V the cold stacks up to three layers
    if (T < 3) { S.chill = 150; floatText(e.x, e.y - e.h - 10, 'CHILLED', col, 8); SFX.freeze(); }
    else if (S.cd <= 0) {
      S.frz = Math.round([0, 0, 0, 54, 54, 80, 80, 100, 105, 110, 115][T] * cap); S.cd = isBoss(e) ? 420 : 0; S.chill = 150;
      floatText(e.x, e.y - e.h - 10, 'FROZEN', col, 8); SFX.freeze(); spawn(e.x, e.y, e.h * 0.5, 10, { c: ['#e8faff', '#7ad8ff'], l0: 12, l1: 26, add: true, size: 2, up: 1.2 });
      if (T >= 6 && !noSpread) for (const o of elNear(e, 55 + 10 * R)) elemBuild(o, 'frost', 50 + 4 * R, T, true);
    } else { S.chill = 150; }
  } else {
    S.sst = T >= 5 ? Math.min(layerCap(), (S.sst | 0) + 1) : 1; // ...and so do the shocks
    const n = (T >= 7 ? 3 : T >= 4 ? 2 : 1) + (S.bx ? 1 : 0) + R, r = 70 + (T >= 2 ? 25 : 0) + 10 * R, dm = base * ELEM_PT[T] * 2.2 * (T >= 2 ? 1.25 : 1) * (S.bx ? 2 : 1) * (1 + 0.1 * (S.sst - 1));
    elNear(e, r).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, n).forEach(o => { elArc(e, o, ['#fff6a0', '#6ab8ff']); elDmg(o, dm, col); elemBuild(o, 'bolt', Math.min(30, Math.floor(90 / n)), T, true); });
      // a fired chain hands out less than the 100 a foe needs to fire again, so it dies out by itself
    if (T >= 6) { elDmg(e, base * ELEM_PT[T] * 3, col); for (let i = 0; i < 6; i++) spawn(e.x + rnd(-2, 2), e.y, i * 9, 1, { c: ['#fff6a0', '#ffffff'], l0: 8, l1: 14, add: true, size: 2, g: 0 }); }
    if (T >= 3 && S.cd <= 0) { S.stun = Math.round(((T >= 5 ? 34 : 20) + 6 * R) * cap); S.cd = isBoss(e) ? 420 : 0; floatText(e.x, e.y - e.h - 10, 'SHOCKED', col, 8); }
    S.shk = 120 + 15 * T; S.sdbl = S.bx ? 1 : S.sdbl; // electrified: shock damage over time, doubled after an overcharge
    spawn(e.x, e.y, e.h * 0.6, 8, { c: ['#fff6a0', '#6ab8ff'], l0: 6, l1: 14, add: true, size: 2, up: 1 }); SFX.zap();
  }
}
const elemActive = e => { const S = e.el, el = rpg.elem; return !!S && (el === 'fire' ? S.burn > 0 : el === 'frost' ? S.chill > 0 || S.frz > 0 : S.stun > 0 || S.bolt >= 30); };
const REKINDLE_HITS = 4;  // normal hits on a foe that is still under your element, in a row, rekindle it like a skill does
function elemRekindle(e, att, was) { // a skill cast on a foe still under your element from before doubles the effect (once per cast and foe); so does the 4th normal hit on it
  const el = rpg.elem, T = elemTier(); if (!att.pn || !el || !T || !e.el || e.dead || e.el.bsk === att.sk && att.sk) return;
  const S = e.el; if (!(el === 'fire' ? S.burn > 0 : el === 'frost' ? S.chill > 0 || S.frz > 0 : S.bolt >= 1 || S.stun > 0)) { if (!att.sk) S.nk = 0; return; }
  if (att.sk) S.bsk = att.sk;
  else { // a normal hit: counts only on a foe that was already afflicted before this hit, and fires on the 4th; lightning's overcharge also waits 3 s between two
    if (!was) { S.nk = 0; return; }
    S.nk = (S.nk | 0) + 1; if (S.nk < REKINDLE_HITS) return; S.nk = 0;
    if (el === 'bolt') { if (S.nkc > 0) return; S.nkc = 180; }
  }
  if (!was) return;
  if (el === 'fire' && !S.bdbl) { S.bdbl = 1; S.burn = Math.max(S.burn, 150 + 25 * T); floatText(e.x, e.y - e.h - 22, 'BURN x2', '#ffb43a', 9); SFX.burn(); spawn(e.x, e.y, e.h * 0.5, 12, { c: ['#fff1b0', '#ff7a2a', '#ff3a1a'], s0: 1, s1: 2.6, l0: 12, l1: 26, add: true, size: 2, up: 2 }); }
  else if (el === 'frost' && !S.fdbl) { // deeper cold: twice as long, a harder slow, a frozen foe stays frozen longer and can be frozen again sooner
    S.fdbl = 1; S.chill = Math.max(S.chill, 300); if (S.frz > 0) S.frz *= 2; S.cd = Math.min(S.cd, 90);
    floatText(e.x, e.y - e.h - 22, 'DEEP FREEZE', '#9ae8ff', 9); SFX.freeze(); spawn(e.x, e.y, e.h * 0.5, 12, { c: ['#e8faff', '#7ad8ff'], s0: 1, s1: 2.4, l0: 12, l1: 26, add: true, size: 2, up: 1.6 });
  } else if (el === 'bolt') { // overcharge: an extra chain that hits twice as hard and jumps one foe further
    S.cd = 0; S.bx = 1; elemBuild(e, 'bolt', 101, T); S.bx = 0; floatText(e.x, e.y - e.h - 22, 'OVERCHARGE', '#fff6a0', 9);
  }
}
function elemHit(e, att, kind, crit) { // called after one of the hero's hits lands
  const T = elemTier(); if (!T || e.dead || e.pn) return; const el = rpg.elem, cls = att.k && att.k.cls;
  let amt = (kind === 'down' ? 38 : 24) * (cls === 'panni' ? 1.2 : 1) * (crit ? (cls === 'luca' ? 1.5 : 1.25) : 1) * (el === 'frost' && T >= 2 ? 1.25 : 1);
  elemBuild(e, el, amt * (1 + elemPower() / 100), T);
}
// elemental procs: a hit may carry extra elemental damage plus the status of the element at your tier.
// A hero who has chosen an element only ever procs that element; one who has not gets a random element on skill hits (tier 1 effects).
// Normal hits: 3.9% (tier 1) to 6.3% (tier 7), extra damage worth about one more hit (0.9x to 1.4x). Skill hits: 30% (10% per tick for the ultimate), extra damage worth half of that.
function elemProc(e, att, dealt, isSkill) {
  if (!att.pn || e.dead || e.pn || e.barrier > 0) return;
  const own = rpg.elem, tier = elemTier();
  let ch, el;
  if (isSkill) { ch = att.sk.id === 6 ? 0.1 : 0.3; el = own || pickOf(ELEMS); }
  else { if (!own || !tier) return; ch = (0.035 + 0.004 * tier) * (isBoss(e) ? 0.7 : 1); el = own; }
  if (Math.random() >= ch) return;
  const T = Math.max(1, tier), S = elOf(e), rs = clamp((ELEM_RES[e.kind] || {})[el] || 1, 0.4, 1.4) * (isBoss(e) ? 0.8 : 1);
  elemBuild(e, el, Math.max(0, (100 - S[el]) / rs) + 1, T); // topped up so the status always lands
  elDmg(e, dealt * (isSkill ? 0.5 : 1) * (0.8 + 0.08 * T) * rs, ELEM[el].col);
  spawn(e.x, e.y, e.z + e.h * 0.6, 8, { s0: 1, s1: 3, c: [ELEM[el].col, '#ffffff'], l0: 8, l1: 16, add: true, size: 2 });
}
function elemTick(e) { // once per frame per afflicted monster; true when it loses this frame (frozen, stunned, slowed)
  const S = e.el, T = elemTier() || 1, free = e.st === 'down' || e.st === 'hurt' || e.st === 'getup';
  for (const k of ELEMS) if (S[k] > 0) S[k] = Math.max(0, S[k] - 0.35); if (S.lq > 0) S.lq = Math.max(0, S.lq - 0.35);
  if (S.cd > 0) S.cd--; if (S.chill > 0) S.chill--; if (S.stun > 0) S.stun--; if (S.nkc > 0) S.nkc--;
  if (!(S.chill > 0 || S.frz > 0)) { S.fst = 0; if (S.fdbl) { S.fdbl = 0; S.bsk = null; } } if (S.bsk && rpg.elem === 'bolt' && !(S.bolt >= 1 || S.stun > 0)) S.bsk = null;
  if (S.frz > 0) { S.frz--; if (tickN % 12 === 0) spawn(e.x + rnd(-8, 8), e.y, rnd(4, e.h), 1, { c: ['#e8faff', '#7ad8ff'], l0: 8, l1: 16, add: true, size: 1, g: 0 }); }
  if (S.stun > 0 && tickN % 5 === 0) spawn(e.x + rnd(-8, 8), e.y, rnd(4, e.h), 1, { c: ['#fff6a0'], l0: 4, l1: 8, add: true, size: 2, g: 0 });
  if (S.burn > 0) {
    S.burn--; if (tickN % 6 === 0) spawn(e.x + rnd(-6, 6), e.y, rnd(2, e.h * 0.8), 1, { c: ['#ffd070', '#ff7a2a'], l0: 8, l1: 16, add: true, size: 2, up: 1.4, g: -0.02 });
    if (tickN % 30 === 0 && !e.dead) elDmg(e, elBase() * ELEM_PT[T] * (T >= 2 ? 1.25 : 1) * (S.bdbl ? 2 : 1) * (1 + 0.35 * (S.bst - 1)) * (rpg.elem === 'fire' && CLS === 'nolan' ? 1.1 : 1), ELEM[rpg.elem || 'fire'].col);
    if (S.burn === 0) { S.bst = 0; S.bdbl = 0; S.bsk = null; }
  }
  if ((S.chill > 0 || S.frz > 0) && tickN % 30 === 0 && !e.dead) elDmg(e, elBase() * ELEM_PT[T] * (T >= 2 ? 1.25 : 1) * (S.fdbl ? 2 : 1) * (S.frz > 0 ? 1.4 : 1) * (1 + 0.15 * Math.min(2, (S.fst || 1) - 1) + 0.3 * Math.max(0, (S.fst || 1) - 3)), ELEM.frost.col);
    // frostbite: damage over time while chilled or frozen
  if (S.shk > 0) { S.shk--; if (tickN % 20 === 0 && !e.dead) elDmg(e, elBase() * ELEM_PT[T] * (T >= 2 ? 1.25 : 1) * 0.55 * (S.sdbl ? 2 : 1) * (1 + 0.2 * Math.min(2, (S.sst || 1) - 1) + 0.5 * Math.max(0, (S.sst || 1) - 3)), ELEM.bolt.col);
    if (S.shk === 0) { S.sdbl = 0; S.sst = 0;
    } if (tickN % 8 === 0) spawn(e.x + rnd(-6, 6), e.y, rnd(2, e.h * 0.9), 1, { c: ['#fff6a0', '#6ab8ff'], l0: 4, l1: 8, add: true, size: 1, g: 0 }); }
  if (free) return false;
  if (S.frz > 0 || S.stun > 0) { if (e.flash > 0) e.flash--; return true; }
  let sl = S.chill > 0 ? 0.35 + (T >= 5 ? 0.1 : 0) : S.frost * 0.003; const fs = 1 + 0.2 * ((S.fst || 1) - 1), cp = Math.min(0.15, 0.05 * ((S.fst || 1) - 1)); if (S.chill > 0) sl *= fs;
  sl = S.fdbl ? Math.min(sl * 1.5, (isBoss(e) ? 0.45 : 0.7) + cp) : Math.min(sl, (isBoss(e) ? 0.3 : 0.5) + cp); // deep freeze slows harder
  if (sl > 0) { S.acc += sl; if (S.acc >= 1) { S.acc -= 1; if (e.flash > 0) e.flash--; return true; } }
  return false;
}
function elemDeath(e) { // burning foes erupt, frozen foes shatter
  const S = e.el, T = elemTier(); if (!S || !T) return;
  if (S.burn > 0 && T >= 4) { SFX.big(); for (const o of elNear(e, 48 + 10 * ePar())) elDmg(o, elBase() * ELEM_PT[T] * 3, ELEM.fire.col); spawn(e.x, e.y, 14, 14, { c: ['#ffd070', '#ff7a2a'], s0: 1, s1: 3, l0: 10, l1: 22, add: true, size: 2, up: 2 }); }
  if (S.frz > 0 && T >= 7) { SFX.shatter(); for (const o of elNear(e, 52 + 10 * ePar())) elDmg(o, elBase() * ELEM_PT[T] * 4, ELEM.frost.col); spawn(e.x, e.y, 14, 14, { c: ['#e8faff', '#7ad8ff'], s0: 1, s1: 3, l0: 10, l1: 22, add: true, size: 2, up: 2 }); }
}
function gearSparks() { // forged gear (+5 and more) throws golden sparks, more with every level
  if (tickN % 6) return;
  for (const p of players()) { const u = p.k && p.k.gup; if (!u || u < 5 || p.dead || Math.random() > 0.25 * (u - 3)) continue;
    spawn(p.x + rnd(-8, 8), p.y, rnd(6, 38), 1, { c: ['#fff1b0', '#ffd24a'], l0: 12, l1: 24, add: true, size: 1, up: 0.8, g: -0.01 }); }
}
function elemAura() { // tier VI fire: a ring of fire pulses around each hero
  if (elemTier() < 6 || rpg.elem !== 'fire' || tickN % 240) return;
  for (const p of players()) { if (p.dead) continue; for (const o of enemies) if (!o.dead && Math.abs(o.x - p.x) < 52 && Math.abs(o.y - p.y) < 32) elemBuild(o, 'fire', 34, elemTier(), true);
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; spawn(p.x + Math.cos(a) * 44, p.y + Math.sin(a) * 14, 6, 1, { c: ['#ffd070', '#ff7a2a'], l0: 12, l1: 22, add: true, size: 2, up: 0.6 }); } }
}
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

/* ---------- physics shared by knocked fighters ---------- */
function groundPhysics(f) {
  if (f.st === 'hurt') {
    f.x += f.vx; f.vx *= 0.88;
    if (f.z > 0) { f.z += f.vz || 0; f.vz = (f.vz || 0) - 0.3; if (f.z <= 0) { f.z = 0; f.vz = 0; } }
    if (++f.t > 16 && f.z <= 0) { f.st = 'idle'; f.t = 0; } return true;
  }
  if (f.st === 'down') {
    f.x += f.vx; f.z += f.vz; f.vz -= 0.3;
    if (!f.pn && !isBoss(f) && f.z <= 0 && f.kind !== 'imp') { const q = gapAt(f.x, -5); if (q && q.type === 'pit') { // knocked into the chasm
      f.hp = 0; f.dead = true; f.fade = 0; f.pitT = 1; f.pitY = f.y; SFX.die(); onKill(f); score += f.kind === 'b' ? 600 : 300; floatText(f.x, f.y - 50, 'INTO THE ABYSS!', '#ffd24a', 8); return true; } }
    if (f.z <= 0) { f.z = 0; if (f.vz < -1.5) { f.vz *= -0.35; f.vx *= 0.6; dust(f.x, f.y, 5); SFX.land(); } else { f.vz = 0; f.vx *= 0.8; } }
    f.t++;
    if (f.hp <= 0 && !f.dead && f.z === 0 && f.t > 20) { f.dead = true; f.fade = 0; SFX.die(); if (!f.pn) { onKill(f); addDecal(f);
      score += isBoss(f) ? 5000 : f.kind === 'b' ? 400 : 150; if (isBoss(f)) { shake = 14; flashA = 0.5; sparks(f.x, f.y, 30, true); sparks(f.x, f.y, 55, true);
      SFX.big(); } if (Math.random() < (f.kind === 'h' ? 0.22 : 0.6)) items.push({ x: f.x, y: f.y, t: 0, kind: 'meat' }); } }
    if (f.hp > 0 && f.t > (f.pn ? 55 : 42)) { f.st = 'getup'; f.t = 0; }
    return true;
  }
  if (f.st === 'getup') { if (++f.t > (f.pn ? 18 : 12)) { f.st = 'idle'; f.t = 0; f.inv = f.pn ? 40 : 14; } return true; }
  return false;
}

/* ---------- hero ---------- */
function reviveP(f, mate) {
  f.pitT = 0; f.dead = false; f.fade = 0; f.hp = Math.max(1, f.maxhp >> 1); f.x = mate.x - 22; f.y = mate.y; f.z = 0; f.vx = 0; f.vz = 0; f.st = 'idle'; f.t = 0; f.inv = 120; f.mount = null; f.hits.clear();
  msg = f.k.name + ' RETURNS  (-1 COIN)'; msgT = 100; SFX.magic(); spawn(f.x, f.y, 20, 26, { s0: 1, s1: 3, c: ['#fff1b0', '#8affb0'], l0: 14, l1: 30, add: true, size: 2, up: 3, g: 0.05 });
}
/* ---------- skills: a new special attack every 10 levels (U casts, Q swaps) ---------- */
const SKILLS = [
  { lv: 10, name: 'RISING SLASH', cd: 150 }, { lv: 20, name: 'DASH STRIKE', cd: 180 }, { lv: 30, name: 'WHIRLWIND', cd: 240 },
  { lv: 40, name: 'FLAME WAVE', cd: 260 }, { lv: 50, name: 'METEOR DIVE', cd: 330 }, { lv: 60, name: 'EMBER NOVA', cd: 400 }, { lv: 70, name: 'ULTIMATE', cd: 1500, ult: true }
];
// the level-70 skill is an ultimate: for about four seconds the hero is untouchable and every foe on screen takes non-stop damage; each hero has their own
const ULT = { nolan: { name: 'LEGION OF ASH' }, panni: { name: 'STARFALL' }, luca: { name: 'THOUSAND CUTS' } };
const skName = (S, f) => S.ult ? ULT[(f && f.k && f.k.cls) || CLS].name : S.name;
const skillsOf = () => SKILLS.filter(k => k.lv <= rpg.lvl);
function skillOf(f) { const a = skillsOf(); return a.length ? a[clamp(f.ski == null ? a.length - 1 : f.ski, 0, a.length - 1)] : null; }
function cycleSkill(f) { const a = skillsOf(); if (a.length < 2) return; f.ski = ((f.ski == null ? a.length - 1 : f.ski) + 1) % a.length; SFX.pick(); floatText(f.x, f.y - 66, skName(skillOf(f), f), '#8cc4ff', 8); }
function castSkill(f) {
  const S = skillOf(f); if (!S || f.skcd > 0) return false; // works from the saddle too: the mount carries on beneath the rider
  f.sk = { id: SKILLS.indexOf(S), face0: f.face }; f.st = 'atk'; f.combo = 2; f.t = 0; f.queued = false; f.hits.clear(); f.skcd = S.cd; f.inv = Math.max(f.inv, 14); f.vx = 0;
  floatText(f.x, f.y - 66, skName(S, f) + '!', S.ult ? '#ffd24a' : '#8cc4ff', S.ult ? 10 : 8); return true;
}
function stepSkill(f) {
  const t = f.t, id = f.sk.id, ff = f.sk.face0, foes = enemies;
  f.inv = Math.max(f.inv, 6);
  const end = () => { f.face = ff; f.sk = null; f.st = 'idle'; f.t = 0; f.z = 0; f.vz = 0; };
  const burst = (n, cols, s1) => spawn(f.x, f.y, 14, n, { s0: 1, s1: s1 || 3.6, c: cols, l0: 12, l1: 28, add: true, size: 2, flat: true });
  if (id === 0) { // rising slash: leaping uppercut
    if (t === 3) { f.vz = 4.6; f.hits.clear(); SFX.swing(); }
    if (t >= 3) { f.z += f.vz; f.vz -= 0.33; f.x += ff * 0.8; }
    if (t >= 4 && t <= 12) strike(f, { x0: -8, x1: 64, dy: 18, z0: -10, z1: 70 }, 26, 'down', foes);
    if (t >= 4 && t % 2 === 0) spawn(f.x + ff * 22, f.y, f.z + 24, 2, { c: ['#fff1b0', '#8cc4ff'], l0: 8, l1: 16, add: true, up: 2, g: -0.02 });
    if (f.z <= 0 && t > 6) end();
  } else if (id === 1) { // dash strike
    if (t === 2) SFX.swing();
    if (t < 16) { f.x += ff * 5.2; if (t === 7) f.hits.clear(); strike(f, { x0: -8, x1: 30, dy: 14, z0: 0, z1: 48 }, 22, t < 8 ? 'hurt' : 'down', foes); if (t % 2 === 0) spawn(f.x - ff * 10, f.y, 16, 2, { c: ['#8cc4ff', '#ffffff'], l0: 8, l1: 14, add: true }); }
    if (t >= 22) end();
  } else if (id === 2) { // whirlwind
    if (t < 26) { if (t % 6 === 0) { f.hits.clear(); SFX.swing(); } if (t % 3 === 0) { f.face = -f.face; burst(5, ['#fff1b0', '#ffb43a'], 2.4); } strike(f, { x0: -66, x1: 66, dy: 20, z0: 0, z1: 54 }, 13, t >= 20 ? 'down' : 'hurt', foes); }
    if (t >= 30) end();
  } else if (id === 3) { // flame wave: two piercing waves
    if (t === 6) { for (const dy of [-8, 8]) shots.push({ type: 'pwave', owner: f, x: f.x + ff * 30, y: clamp(f.y + dy, Y_MIN, Y_MAX), z: 0, vx: ff * 3.6, t: 0, dmg: 24, life: 90, hit: new Set() }); SFX.big(); burst(10, ['#fff1b0', '#ff8a2a'], 2.4); }
    if (t >= 22) end();
  } else if (id === 4) { // meteor dive
    if (t < 10) f.z += 5.5;
    else if (!f.sk.landed) {
      if (t === 10) f.vz = -10; f.z += f.vz;
      if (f.z <= 0) { f.z = 0; f.sk.landed = t; f.hits.clear(); strike(f, { x0: -84, x1: 84, dy: 34, z0: -30, z1: 130 }, 42, 'down', foes); shake = Math.max(shake, 12); dust(f.x, f.y, 10); burst(30, ['#fff1b0', '#ffb43a', '#ff5a1f']); SFX.big(); }
    } else if (t >= f.sk.landed + 14) end();
  } else if (id === 5) { // ember nova
    if (t === 8) { f.hits.clear(); strike(f, { x0: -130, x1: 130, dy: 50, z0: -20, z1: 120 }, 38, 'down', foes); shake = Math.max(shake, 10); flashA = Math.max(flashA, 0.25); burst(60, ['#fff1b0', '#ffb43a', '#ff5a1f'], 4.4); SFX.big(); }
    if (t === 22) { f.hits.clear(); strike(f, { x0: -150, x1: 150, dy: 56, z0: -20, z1: 120 }, 30, 'hurt', foes); burst(40, ['#ffd070', '#ff8a2a'], 4.8); SFX.big(); }
    if (t >= 34) end();
  } else if (id === 6) { // ultimate: ~4 seconds of non-stop damage to every foe on screen, then a finishing blow and a heal for the party
    const cls = f.k.cls, FIRST = 24, STEP = 10, TICKS = 18, FIN = FIRST + STEP * TICKS, ALL = { x0: -2 * W, x1: 2 * W, dy: 400, z0: -400, z1: 400 };
    const onScreen = () => foes.filter(e => !e.dead && e.x - cam > -24 && e.x - cam < W + 24);
    if (!f.sk.began) { f.sk.began = 1; flashA = Math.max(flashA, 0.3); SFX.magic(); }
    f.inv = Math.max(f.inv, 8); f.vx = 0;
    if (cls !== 'luca') f.z = Math.min(12, t * 0.6) + Math.sin(t * 0.25) * 1.5; // the hero rises while channelling
    if (t < FIRST) { // gathering power
      if (t % 3 === 0) spawn(f.x, f.y, f.z + 20, 4, { s0: 0.4, s1: 1.6, c: cls === 'panni' ? ['#d8b8ff', '#ffffff'] : cls === 'luca' ? ['#9affb8', '#ffffff'] : ['#fff1b0', '#9fd0ff'], l0: 12, l1: 24, add: true, up: 2.4, g: -0.01, size: 2 });
      shake = Math.max(shake, 2 + t * 0.1);
    } else if (t < FIN) {
      if ((t - FIRST) % STEP === 0) {
        const tg = onScreen(), k = (t - FIRST) / STEP;
        f.hits.clear(); strike(f, ALL, 6 + (k % 3 === 2 ? 2 : 0), 'hurt', tg); freeze = 0;
        shake = Math.max(shake, 3); flashA = Math.max(flashA, 0.1); if (k % 3 === 0) SFX.big(); else SFX.swing();
        if (cls === 'nolan') { // spectral swords rain down on everyone
          for (const e of tg.slice(0, 9)) { spawn(e.x + rnd(-16, 16), e.y + rnd(-6, 6), e.z + 120, 7, { s0: 0.1, s1: 0.5, c: ['#ffffff', '#fff1b0', '#9fd0ff'], l0: 9, l1: 13, add: true, up: -9, g: 0, size: 2 });
            spawn(e.x, e.y, e.z + 8, 8, { s0: 0.8, s1: 2.6, c: ['#fff1b0', '#ffb43a'], l0: 8, l1: 16, add: true, flat: true, size: 2 }); }
          spawn(f.x, f.y, f.z + 10, 10, { s0: 1, s1: 3.2, c: ['#fff1b0', '#9fd0ff'], l0: 10, l1: 20, add: true, flat: true });
        } else if (cls === 'panni') { // stars fall in columns of light
          for (const e of tg.slice(0, 9)) { spawn(e.x, e.y, e.z + 140, 12, { s0: 0.1, s1: 0.7, c: ['#d8b8ff', '#ffffff', '#8cc4ff'], l0: 10, l1: 15, add: true, up: -11, g: 0, size: 3 }); spawn(e.x, e.y, e.z + 10, 9, { s0: 1, s1: 3, c: ['#d8b8ff', '#ffffff'], l0: 10, l1: 20, add: true, size: 2 }); }
          spawn(f.x, f.y, f.z + 30, 10, { s0: 1, s1: 3.6, c: ['#d8b8ff', '#c9a8ff'], l0: 12, l1: 22, add: true, size: 2 });
        } else { // shadow blades: the rogue's phantoms streak from him through every foe, slashing
          for (const e of tg.slice(0, 9)) {
            for (let q = 0; q <= 6; q++) { const u = q / 6; spawn(f.x + (e.x - f.x) * u, f.y + (e.y - f.y) * u, f.z + 22 + (e.z + e.h * 0.6 - 22) * u, 1, { s0: 0.1, s1: 0.5, c: ['#9affb8', '#1c3a2a', '#ffffff'], l0: 6, l1: 11, add: true, size: 2 }); }
            spawn(e.x, e.y, e.z + e.h * 0.6, 12, { s0: 1.5, s1: 4.2, c: ['#ffffff', '#9affb8'], l0: 5, l1: 11, add: true, flat: true, size: 2 });
          }
        }
      }
    } else if (t === FIN) {
      f.hits.clear(); strike(f, ALL, 40, 'down', onScreen());
      for (const p of players()) if (!p.dead) p.hp = Math.min(p.maxhp, p.hp + (p.maxhp * 0.15 | 0));
      flashA = 0.8; shake = Math.max(shake, 16); burst(90, ['#fff1b0', '#ffd24a', '#ffffff'], 5.6); SFX.magic(); SFX.big();
    }
    if (t >= FIN + 16) end();
  }
}

function mountFire(f, t) {
  const type = (f.mount && f.mount.type) || 'ember', air = f.z > 2, foes = enemies, zz = f.z;
  if (type === 'storm') { // chain lightning: three zaps, each leaps to the nearest foes ahead
    if (t === 4 || t === 11 || t === 18) {
      f.hits.clear(); SFX.swing();
      const tg = foes.filter(e => !e.dead && (e.x - f.x) * f.face > -10 && (e.x - f.x) * f.face < 150 && Math.abs(e.y - f.y) < 40).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x)).slice(0, 3);
      let px = f.x + f.face * 33, py = f.y, pz = zz + 33;
      for (const e of tg) { zap(px, py, pz, e.x, e.y, e.z + e.h * 0.6); px = e.x; py = e.y; pz = e.z + e.h * 0.6; }
      if (!tg.length) zap(px, py, pz, px + f.face * 70, py, pz - (air ? 20 : 0));
      strike(f, { x0: -400, x1: 400, dy: 400, z0: -400, z1: 400 }, t === 18 ? 13 : 8, t === 18 ? 'down' : 'hurt', tg);
    }
    return;
  }
  if (type === 'stone') { // ground-shaking shockwave
    if (t === 6) {
      SFX.big(); shake = Math.max(shake, 4); f.hits.clear(); dust(f.x + f.face * 24, f.y, 8);
      strike(f, { x0: 0, x1: 46, dy: 16, z0: -20, z1: 50 }, 14, 'down', foes);
      for (const dy of [-7, 7]) shots.push({ type: 'pwave', owner: f, x: f.x + f.face * 34, y: clamp(f.y + dy, Y_MIN, Y_MAX), z: 0, vx: f.face * 3, t: 0, dmg: 12, life: 40, hit: new Set() });
    }
    return;
  }
  if (t === 4 || t === 9 || t === 14) f.hits.clear();
  if (t >= 3 && t <= 17) {
    strike(f, { x0: 4, x1: 76, dy: 13, z0: air ? -30 : 0, z1: 40 }, t >= 14 ? 14 : 8, t >= 14 ? 'down' : 'hurt', foes);
    for (const dz of [28, 32, 36]) spawn(f.x + f.face * 34, f.y, zz + dz, 3, { dx: f.face * 2.8, s0: 0.2, s1: 0.9, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 8, l1: 20, g: 0.012, add: true, size: 3, flat: true });
  }
}
const gapAt = (x, m) => gaps.find(q => x > q.x - (m || 0) && x < q.x + q.w + (m || 0));
function offGap(x, dir) { // a foe arriving from the screen edge must start on solid ground: a spot over a chasm or barricade moves outward past it
  for (let k = 0; k < 4; k++) { const q = gapAt(x, 22); if (!q) break; x = dir < 0 ? q.x - 24 : q.x + q.w + 24; }
  return x;
}
function heroHazards(f, ox) { // barricades block anyone below their height; chasms swallow anyone who lands in them
  if (f.dead || f.pitT) return;
  for (const q of gaps) {
    if (q.type === 'wall') {
      if (f.z < 18 && f.x > q.x - 7 && f.x < q.x + q.w + 7) f.x = ox <= q.x + q.w / 2 ? q.x - 7 : q.x + q.w + 7;
    } else if (f.z <= 0 && f.x > q.x + 5 && f.x < q.x + q.w - 5) {
      f.pitT = 1; f.pitY = f.y; f.pitGap = q; f.st = 'idle'; f.vx = 0; f.vz = 0; SFX.die(); shake = Math.max(shake, 4);
      return;
    }
  }
  if (f.z <= 0 && !gapAt(f.x, 6)) f.safeX = f.x;
}
function heroPitStep(f) {
  if (++f.pitT < 32) return;
  if (f.dead) return;
  const d = Math.max(1, Math.round(f.maxhp * 0.6)); f.hp -= d; msg = 'FELL INTO THE CHASM'; msgT = 110; flashA = Math.max(flashA, 0.2);
  if (f.hp <= 0) { f.hp = 0; f.dead = true; f.fade = 0; f.mount = null; return; } // a fall costs most of your health, and kills you if you were already hurt
  const q = f.pitGap, L = q.x - 14, Rr = q.x + q.w + 14;
  let nx = (f.safeX != null ? f.safeX : L) <= q.x ? L : Rr; if (nx < cam + 14) nx = Rr; if (nx > cam + W - 14) nx = L;
  f.pitT = 0; f.x = nx; f.y = f.pitY; f.z = 0; f.vz = 0; f.st = 'idle'; f.t = 0; f.inv = 100;
  floatText(f.x, f.y - 56, '-' + d, '#ff6a6a', 10);
  spawn(f.x, f.y, 20, 16, { c: ['#fff1b0', '#ffd070'], add: true, l0: 12, l1: 24, up: 2 });
}
function updateHero(f) {
  if (f.pitT && !f.dead) { heroPitStep(f); return; }
  if (f.pitT && f.dead) { f.pitT++; f.fade++; if (f.fade > 90 && mode === 'play' && players().every(p => p.dead && p.fade > 90)) { mode = 'gameover'; endTimer = 0; } return; }
  const ox = f.x; updateHeroCore(f); heroHazards(f, ox);
}
function updateHeroCore(f) {
  f.t++; if (f.inv > 0) f.inv--; if (f.flash > 0) f.flash--; if (f.skcd > 0) { f.skcd--; if (f.skcd > 0 && tickN % 4 === 0 && buffIs('haste')) f.skcd--; }
  if (f.sk && f.st !== 'atk') f.sk = null;
  if (f.dead) {
    f.fade++;
    if (coop) { const mate = players().find(p => p !== f && !p.dead); if (mate && f.fade > 240 && rpg.coins > 0 && mode === 'play') { rpg.coins--; reviveP(f, mate); return; } }
    if (f.fade > 90 && mode === 'play' && players().every(p => p.dead && p.fade > 90)) { mode = 'gameover'; endTimer = 0; }
    return;
  }
  if (groundPhysics(f)) return;
  const mx = (inD(f, 'right') ? 1 : 0) - (inD(f, 'left') ? 1 : 0), my = (inD(f, 'down') ? 1 : 0) - (inD(f, 'up') ? 1 : 0);
  const foes = enemies, spd = (f.mount ? mtype(f.mount).spd : f.k.spd) * (buffIs('haste') ? 1.25 : 1);
  switch (f.st) {
    case 'idle': case 'walk': {
      if (f.z > 0) { f.z += f.vz || 0; f.vz = (f.vz || 0) - 0.33; if (f.z <= 0) { f.z = 0; f.vz = 0; } } // never hang in the air: anything that leaves you aloft falls back down
      if (inH(f, 'swap')) cycleSkill(f);
      f.vx = mx * spd; f.vy = my * spd * 0.65;
      if (mx) f.face = mx;
      f.x += f.vx; f.y = clamp(f.y + f.vy, Y_MIN, Y_MAX);
      f.st = (mx || my) ? 'walk' : 'idle'; f.anim += (mx || my) ? (f.mount ? 0.3 : 0.2) : 0;
      const wild = f.mount ? null : mounts.find(m => !m.flee && Math.abs(m.x - f.x) < 28 && Math.abs(m.y - f.y) < 12 && m.z < 3);
      if ((inH(f, 'jump') || inH(f, 'dismount')) && wild) {
        f.mount = wild; jr('ride'); mounts.splice(mounts.indexOf(wild), 1); SFX.pick(); sparks(f.x, f.y, 20, true);
        msg = mtype(wild).name + '!   J: ' + mtype(wild).info + (wild.falls ? '   (1 FALL LEFT)' : '   E: DISMOUNT'); msgT = 130;
      } else if (inH(f, 'dismount') && f.mount) {
        const m = f.mount; m.x = f.x - f.face * 12; m.y = f.y; m.face = f.face; m.z = 0.01; m.vz = 2; mounts.push(m); f.mount = null;
      } else if (inH(f, 'jump')) { f.st = 'jump'; f.vz = f.mount ? mtype(f.mount).jump : (f.k.jump || 5.4); f.vx = mx * (f.mount ? mtype(f.mount).spd * 0.92 : 1.5); f.t = 0; f.hits.clear(); }
      else if (inH(f, 'skill') && castSkill(f)) { }
      else if (inH(f, 'atk')) { if (f.mount) { f.st = 'ratk'; f.t = 0; f.hits.clear(); SFX.swing(); } else startAttack(f, 0); }
      else if (inH(f, 'magic') && f.vases >= 1 && !dragon) castDragon();
      break;
    }
    case 'atk': {
      if (f.sk) { stepSkill(f); break; }
      const CB = comboOf(f), c = CB[f.combo], mage = f.k.cls === 'panni';
      if (f.t === c.a) { SFX.swing(); if (mage) { // Panni throws arcane bolts instead of swinging
        shots.push({ type: 'mbolt', owner: f, x: f.x + f.face * 18, y: f.y, z: 30, vx: f.face * (c.big ? 3.4 : 4.6), t: 0, dmg: c.dmg, kind: c.kind, big: !!c.big, life: c.big ? 72 : 54, hit: new Set() });
        spawn(f.x + f.face * 22, f.y, 32, 6, { c: ['#e0d0ff', '#b88aff'], l0: 6, l1: 14, add: true }); } }
      if (f.t < 7) f.x += f.vx * (mage ? 0.3 : 1), f.vx *= 0.9;
      if (!mage && f.t >= c.a && f.t <= c.b) strike(f, { x0: 0, x1: f.k.cls === 'luca' ? 38 : 40, dy: 11, z0: 4, z1: 40 }, c.dmg, c.kind, foes);
      if (inH(f, 'atk') && f.combo < CB.length - 1 && f.t >= (f.k.cls === 'luca' ? 3 : 5)) f.queued = true;
      if (f.t >= (buffIs('haste') ? Math.max(c.b + 1, Math.round(c.d * 0.8)) : c.d)) { if (f.queued) startAttack(f, f.combo + 1); else { f.st = 'idle'; f.t = 0; } }
      break;
    }
    case 'ratk': { // wyrmling attack, by type
      mountFire(f, f.t); if (f.t >= 24) { f.st = 'idle'; f.t = 0; }
      break;
    }
    case 'jump': case 'jatk': {
      f.x += f.vx; f.z += f.vz; f.vz -= 0.33; f.y = clamp(f.y + my * 0.5, Y_MIN, Y_MAX);
      if (f.st === 'jump' && inH(f, 'atk') && !f.mount) { f.st = 'jatk'; f.t = 0; f.hits.clear(); SFX.swing(); }
      if (f.mount && f.st === 'jump') { // wyrmlings can fire in mid-air
        if (inH(f, 'atk') && !f.jf) { f.jf = 1; f.hits.clear(); SFX.swing(); }
        if (f.jf) { mountFire(f, f.jf); if (++f.jf > 24) f.jf = 0; }
      }
      if (f.st === 'jatk') strike(f, { x0: -6, x1: 34, dy: 12, z0: -22, z1: 24 }, 11, 'down', foes);
      if (f.z <= 0) {
        f.z = 0; f.st = 'idle'; f.t = 0; f.jf = 0; dust(f.x, f.y, 4); SFX.land();
        if (f.mount && f.mount.type === 'stone') { f.hits.clear(); strike(f, { x0: -46, x1: 46, dy: 22, z0: -10, z1: 50 }, 13, 'down', foes); shake = Math.max(shake, 5); dust(f.x, f.y, 10); }
      }
      break;
    }
    case 'magic': { if (!dragon) { f.st = 'idle'; f.t = 0; } break; }
  }
}

/* ---------- enemies ---------- */
function updateEnemy(e) { // foes that back away (archers, casters, retreating soldiers) stop at the lip of a chasm instead of drifting out over it; chasers still hop across
  const px = e.x; updateEnemy0(e);
  if (!e.dead && !e.pitT && !e.gone && e.kind !== 'imp' && e.kind !== 'gob') { if (e.inField) e.x = clamp(e.x, cam + 10, cam + W - 10); else if (e.x > cam + 10 && e.x < cam + W - 10) e.inField = true; } // once a foe has stepped onto the screen it can no longer be shoved, or walk, off its edge
  if (e.dead || e.pitT || isBoss(e) || e.kind === 'imp' || e.hopDir || e.z > 0.5 || e.st === 'down' || e.st === 'hurt' || e.st === 'getup') return;
  const q = gapAt(e.x, 4);
  if (q && q.type === 'pit' && !gapAt(px, 4)) { const h = nearestPlayer(px); if (Math.abs(h.x - e.x) > Math.abs(h.x - px)) e.x = px; }
  const q2 = gapAt(e.x, -2); // nobody stands over a chasm: a grounded foe that ended up inside one (spawned, shoved, stopped there) is set on the nearer lip
  if (q2 && q2.type === 'pit') e.x = e.x < q2.x + q2.w / 2 ? q2.x - 7 : q2.x + q2.w + 7;
}
function updateEnemy0(e) {
  if (e.el && !e.dead && elemTick(e)) return;
  if (e.kind === 'imp') { updateImp(e); return; }
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; if (e.pitT) e.pitT++; return; }
  if (e.leap && e.st !== 'eatk' && e.st !== 'wind') { e.leap = 0; e.z = 0; }
  // a barrier is one-time: once it is broken it never comes back
  if (groundPhysics(e)) return;
  if ((e.st === 'idle' || e.st === 'walk') && e.cool < 5000) e.cool -= isBoss(e) ? (e.p2 ? 0.5 : 0.3) : 0.2;
  if (!isBoss(e) && !e.leap) { // husks hop across chasms and barricades
    const gp = gapAt(e.x, 4);
    if (gp) { if (!e.hopDir) e.hopDir = e.x < gp.x + gp.w / 2 ? 1 : -1; e.x += e.hopDir * 1.7; e.z = Math.min(26, e.z + 3.5); }
    else { e.hopDir = 0; if (e.z > 0) e.z = Math.max(0, e.z - 3); }
  }
  if (e.kind === 'witch' || e.kind === 'smith' || e.kind === 'king' || e.kind === 'wyrm') { updateBoss(e); return; }
  if (e.k.ai) { updateMinion(e); return; }
  const k = e.k, spdK = (e.mount ? 1.7 : 1) * (e.kind === 'boss' && bossPhase2(e) ? 1.5 : 1), dx = hero.x - e.x, dy = hero.y - e.y;
  const heroDown = hero.dead || hero.st === 'down';
  if ((e.st === 'idle' || e.st === 'walk') && e.kind === 'h' && !e.mount && !e.elite && mounts.length) { // a foe may climb back onto a free wyrmling lying around: the nearest soldier goes for it
    const wm = mounts.find(m => !m.flee && !m.gone && m.z < 3 && (m.mobRides | 0) < 2 && Math.abs(m.x - e.x) < 220);
    if (wm) {
      const mine = enemies.filter(o => !o.dead && o.kind === 'h' && !o.mount && !o.elite && (o.st === 'idle' || o.st === 'walk')).sort((a, b) => Math.abs(a.x - wm.x) - Math.abs(b.x - wm.x))[0];
      if (mine === e) {
        const mdx = wm.x - e.x, mdy = wm.y - e.y;
        if (Math.abs(mdx) < 16 && Math.abs(mdy) < 9) {
          e.mount = wm; wm.mobRides = (wm.mobRides | 0) + 1; mounts.splice(mounts.indexOf(wm), 1); e.h = k.h + 12; e.hp = Math.max(e.hp, Math.round(e.maxhp * 0.6)); e.st = 'idle'; e.t = 0; e.cool = Math.max(e.cool, 30);
          SFX.pick(); sparks(e.x, e.y, 20, true); floatText(e.x, e.y - e.h - 10, 'MOUNTED!', '#ff9a6a', 8); return;
        }
        e.face = sgn(mdx) || e.face; e.st = 'walk'; e.anim += 0.2; e.x += sgn(mdx) * k.spd * 1.15; if (Math.abs(mdy) > 4) e.y = clamp(e.y + sgn(mdy) * k.spd * 0.8, Y_MIN, Y_MAX);
        return;
      }
    }
  }
  if (e.st === 'idle' || e.st === 'walk') {
    e.face = sgn(dx) || e.face; e.cool--;
    const rng = k.rng, inRange = Math.abs(dx) < rng + 4 && Math.abs(dy) < 9;
    if (!inRange) {
      e.st = 'walk'; e.anim += 0.14 * (k.spd / 0.8 + 0.4);
      if (Math.abs(dy) > 5) e.y += sgn(dy) * k.spd * spdK * 0.7;
      const stand = rng * 0.8;
      if (Math.abs(dx) > stand) e.x += sgn(dx) * k.spd * spdK; else if (Math.abs(dx) < stand - 8) e.x -= sgn(dx) * k.spd * 0.5;
      e.y = clamp(e.y, Y_MIN, Y_MAX);
    } else e.st = 'idle';
    const attackers = enemies.filter(o => !o.dead && (o.st === 'wind' || o.st === 'eatk')).length;
    if (inRange && e.cool <= 0 && !heroDown && attackers < (e.kind === 'boss' ? 3 : 2)) { e.st = 'wind'; e.t = 0; }
  } else if (e.st === 'wind') {
    if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); }
  } else if (e.st === 'eatk') {
    if (e.t >= 2 && e.t <= 6) {
      strike(e, { x0: -4, x1: k.rng + 12, dy: e.kind === 'boss' ? 18 : 10, z0: 0, z1: k.h }, Math.round(k.dmg * (e.mount ? 1.25 : 1)), e.kind === 'h' ? 'hurt' : 'down', players());
      if (e.kind === 'boss' && e.t === 3) { shake = Math.max(shake, 9); for (let i = 0; i < 18; i++) parts.push({ x: e.x + e.face * rnd(30, 90), y: e.y + rnd(-6, 6), z: 0, vx: e.face * rnd(0.5, 3), vy: 0, vz: rnd(1, 3), life: 20, max: 20, g: 0.2, c: '#ffb04a', size: 2, add: true }); }
    }
    if (e.t >= 18) { e.st = 'idle'; e.t = 0; e.cool = rnd(45, 95) * (e.kind === 'boss' ? (e.p2 ? 0.45 : 0.7) : 1); }
  }
}

/* ---------- stage minions: each stage brings its own kind of monster ---------- */
function updateMinion(e) {
  const k = e.k, ai = k.ai, dx = hero.x - e.x, dy = hero.y - e.y, adx = Math.abs(dx), down = hero.dead || hero.st === 'down';
  const face = () => { e.face = sgn(dx) || e.face; };
  const chase = (stand, sp) => { e.st = 'walk'; e.anim += 0.14; if (Math.abs(dy) > 5) e.y += sgn(dy) * sp * 0.7; if (adx > stand) e.x += sgn(dx) * sp; else if (adx < stand - 10) e.x -= sgn(dx) * sp * 0.8; e.y = clamp(e.y, Y_MIN, Y_MAX); };
  e.ghost = null; e.hov = 0;
  if (ai === 'wisp') { // floats, keeps its distance, lobs slow poison orbs
    e.ghost = 0.62; e.hov = 12 + Math.sin(tickN * 0.08 + e.x) * 2;
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; e.st = 'walk'; e.anim += 0.08;
      if (adx < 110) e.x -= sgn(dx) * k.spd * 0.9; else if (adx > 200) e.x += sgn(dx) * k.spd;
      if (Math.abs(dy) > 8) e.y += sgn(dy) * k.spd * 0.5; e.y = clamp(e.y, Y_MIN, Y_MAX);
      if (e.cool <= 0 && adx < 260 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face(); if (e.t >= k.windup) { shots.push({ type: 'orb', x: e.x + e.face * 18, y: e.y, z: 22, vx: e.face * 1.9, t: 0, dmg: k.dmg, life: 200 }); e.st = 'eatk'; e.t = 0; SFX.swing(); }
    } else if (e.st === 'eatk') { if (e.t >= 14) { e.st = 'idle'; e.t = 0; e.cool = rnd(90, 150); } }
  } else if (ai === 'gob') { // bonus stage: runs straight across the arena, jinking away from the hero, and never fights back
    if (e.st === 'idle' || e.st === 'walk') {
      e.st = 'walk'; e.anim += 0.32; e.face = e.gdir || 1; e.x += (e.gdir || 1) * (e.gv || 2.4); e.gph = (e.gph || 0) + 0.12;
      let vy = Math.sin(e.gph * 2) * 0.5;
      if (adx < 46 && Math.abs(dy) < 18) vy += (dy > 0 ? -1 : 1) * 1.6;
      e.y = clamp(e.y + vy, Y_MIN, Y_MAX);
      if ((e.gdir > 0 && e.x > cam + W + 30) || (e.gdir < 0 && e.x < cam - 30)) { e.gone = true; if (bonus) bonus.esc++; }
    }
  } else if (ai === 'runner') { // telegraphs, then dashes straight through you
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; chase(60, k.spd);
      if (adx < 170 && Math.abs(dy) < 14 && e.cool <= 0 && !down) { e.st = 'wind'; e.t = 0; e.dashDir = sgn(dx) || e.face; }
    } else if (e.st === 'wind') { if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); } }
    else if (e.st === 'eatk') {
      e.x += e.dashDir * 4.6; e.face = e.dashDir; e.anim += 0.4;
      if (e.t % 2 === 0) spawn(e.x - e.dashDir * 8, e.y, 10, 2, { c: ['#fff1b0', '#ff8a2a'], l0: 8, l1: 16, add: true, g: -0.02 });
      strike(e, { x0: -6, x1: 22, dy: 12, z0: 0, z1: k.h }, k.dmg, 'down', players());
      if (e.t >= 26 || e.x < cam - 20 || e.x > cam + W + 20) { e.st = 'idle'; e.t = 0; e.cool = rnd(70, 120); }
    }
  } else if (ai === 'guard') { // shielded: blocks frontal light hits, so hit it from behind or knock it down
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--;
      if (adx > k.rng * 0.8 || Math.abs(dy) > 6) chase(k.rng * 0.8, k.spd); else e.st = 'idle';
      if (adx < k.rng + 4 && Math.abs(dy) < 9 && e.cool <= 0 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') { if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); } }
    else if (e.st === 'eatk') {
      if (e.t >= 3 && e.t <= 7) strike(e, { x0: -4, x1: k.rng + 12, dy: 11, z0: 0, z1: k.h }, k.dmg, 'down', players());
      if (e.t >= 22) { e.st = 'idle'; e.t = 0; e.cool = rnd(60, 110); }
    }
  } else if (ai === 'wraith') { // fades out, reappears behind you
    e.ghost = 0.85;
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; chase(40, k.spd);
      if (e.cool <= 0 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      if (e.t < 12) e.ghost = Math.max(0.12, 1 - e.t / 10);
      if (e.t === 12) {
        spawn(e.x, e.y, 20, 12, { c: ['#fff1b0', '#ffd070'], l0: 10, l1: 22, add: true, up: 1.5 });
        e.x = clamp(hero.x - hero.face * 54, cam + 20, cam + W - 20); e.y = clamp(hero.y + rnd(-6, 6), Y_MIN, Y_MAX); e.face = sgn(hero.x - e.x) || e.face;
        spawn(e.x, e.y, 20, 12, { c: ['#fff1b0', '#ffd070'], l0: 10, l1: 22, add: true, up: 1.5 });
      }
      if (e.t > 12) e.ghost = Math.min(0.9, 0.15 + (e.t - 12) / 14);
      if (e.t >= 30) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); }
    } else if (e.st === 'eatk') {
      if (e.t >= 2 && e.t <= 6) strike(e, { x0: -4, x1: k.rng + 12, dy: 11, z0: 0, z1: k.h }, k.dmg, 'hurt', players());
      if (e.t >= 18) { e.st = 'idle'; e.t = 0; e.cool = rnd(110, 170); }
    }
  } else if (ai === 'archer') { // keeps its distance and fires fast arrows: jump over them
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; e.st = 'walk'; e.anim += 0.1;
      if (adx < 120) e.x -= sgn(dx) * k.spd * 1.1; else if (adx > 210) e.x += sgn(dx) * k.spd;
      if (Math.abs(dy) > 6) e.y += sgn(dy) * k.spd * 0.6; e.y = clamp(e.y, Y_MIN, Y_MAX);
      if (e.cool <= 0 && adx < 290 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face(); if (e.t >= k.windup) { shots.push({ type: 'arrow', x: e.x + e.face * 16, y: e.y, z: 28, vx: e.face * 3.6, vy: clamp((hero.y - e.y) / (adx / 3.6 + 1), -0.5, 0.5), t: 0, dmg: k.dmg, life: 140 }); e.st = 'eatk'; e.t = 0; SFX.swing(); }
    } else if (e.st === 'eatk') { if (e.t >= 12) { e.st = 'idle'; e.t = 0; e.cool = rnd(70, 120); } }
  } else if (ai === 'bomber') { // sprints at you, flashes, then blows up: jump the shockwave
    if (e.st === 'idle' || e.st === 'walk') {
      face(); chase(10, k.spd);
      if (!down && adx < 38 && Math.abs(dy) < 14) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face(); e.flash = (e.t >> 2) & 1 ? 3 : 0; e.anim += 0.3; if (adx > 14) e.x += sgn(dx) * k.spd * 0.5;
      if (e.t >= k.windup) {
        shots.push({ type: 'ring', x: e.x, y: e.y, r: 6, t: 0, dmg: k.dmg, hit: false, max: 64 });
        spawn(e.x, e.y, 14, 26, { s0: 1, s1: 3, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 24, add: true, size: 2, up: 2.4 }); dust(e.x, e.y, 8); shake = Math.max(shake, 5); SFX.big();
        e.dead = true; e.fade = 30; e.hp = 0; e.flash = 0;
      }
    }
  } else if (ai === 'warder' || ai === 'caller') { // casters: keep their distance; the warder shields allies, the caller burns the ground
    if (e.st === 'idle' || e.st === 'walk') {
      face(); e.cool--; e.st = 'walk'; e.anim += 0.09;
      if (adx < 115) e.x -= sgn(dx) * k.spd; else if (adx > 205) e.x += sgn(dx) * k.spd;
      if (Math.abs(dy) > 8) e.y += sgn(dy) * k.spd * 0.55; e.y = clamp(e.y, Y_MIN, Y_MAX); e.x = clamp(e.x, cam + 16, cam + W - 16);
      if (e.cool <= 0 && adx < 300 && !down) { e.st = 'wind'; e.t = 0; }
    } else if (e.st === 'wind') {
      face();
      if (e.t % 3 === 0) spawn(e.x + e.face * 8, e.y, 52, 1, { c: ai === 'warder' ? ['#9ae8ff', '#b88aff'] : ['#ffb43a', '#ff5a1f'], s0: 0.2, s1: 0.6, l0: 8, l1: 16, add: true, up: 1, g: 0 });
      if (e.t >= k.windup) {
        if (ai === 'warder') {
          shots.push({ type: 'bolt', x: e.x + e.face * 16, y: e.y, z: 30, vx: e.face * 2.6, t: 0, dmg: k.dmg, life: 200 }); SFX.swing(); // barriers are only ever worn from the spawn, never cast mid-fight
        } else {
          for (const p of players()) if (!p.dead && Math.abs(p.x - e.x) < 320) shots.push({ type: 'rune', x: p.x + p.vx * 18, y: clamp(p.y + (p.vy || 0) * 18, Y_MIN, Y_MAX), t: 0, delay: 54, r: 24, dmg: k.dmg, pool: stageIdx >= 5 ? 200 : 150 });
          if (stageIdx >= 15 || cycle) shots.push({ type: 'rune', x: clamp(hero.x + rnd(-70, 70), cam + 20, cam + W - 20), y: rnd(Y_MIN, Y_MAX), t: 0, delay: 66, r: 24, dmg: k.dmg, pool: 150 });
          sfxTone('sawtooth', 180, 420, 0.3, 0.05);
        }
        e.st = 'eatk'; e.t = 0;
      }
    } else if (e.st === 'eatk') { if (e.t >= 16) { e.st = 'idle'; e.t = 0; e.cool = ai === 'caller' ? rnd(150, 210) : rnd(80, 130); } }
  } else if (ai === 'knight') { // leaps and crashes down with a shockwave, or cleaves up close
    if (e.st === 'idle' || e.st === 'walk') {
      e.z = 0; face(); e.cool--;
      if (adx > k.rng * 0.8 || Math.abs(dy) > 6) chase(k.rng * 0.8, k.spd); else e.st = 'idle';
      if (!down && e.cool <= 0) {
        if (adx > 80 && adx < 240) { e.st = 'wind'; e.t = 0; e.leap = 1; e.lx = clamp(hero.x - sgn(dx) * 30, cam + 20, cam + W - 20); e.ly = clamp(hero.y, Y_MIN, Y_MAX); e.sx0 = e.x; e.sy0 = e.y; }
        else if (adx < k.rng + 4 && Math.abs(dy) < 9) { e.st = 'wind'; e.t = 0; e.leap = 0; }
      }
    } else if (e.st === 'wind') { face(); if (e.t >= k.windup) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); } }
    else if (e.st === 'eatk') {
      if (e.leap) {
        const p = clamp(e.t / 34, 0, 1); e.x = lerp(e.sx0, e.lx, p); e.y = lerp(e.sy0, e.ly, p); e.z = Math.sin(p * Math.PI) * 46;
        if (e.t === 34) { e.z = 0; shots.push({ type: 'ring', x: e.x, y: e.y, r: 8, t: 0, dmg: k.dmg, hit: false, max: 76 }); shake = Math.max(shake, 6); dust(e.x, e.y, 10); SFX.big(); }
        if (e.t >= 50) { e.st = 'idle'; e.t = 0; e.leap = 0; e.cool = rnd(100, 160); }
      } else {
        if (e.t >= 3 && e.t <= 7) strike(e, { x0: -4, x1: k.rng + 12, dy: 11, z0: 0, z1: k.h }, k.dmg, 'down', players());
        if (e.t >= 24) { e.st = 'idle'; e.t = 0; e.cool = rnd(70, 120); }
      }
    }
  }
}

/* ---------- mounts, pilferers, dragon wrath ---------- */
const MOUNT_TYPES = {
  ember: { name: 'EMBER WYRMLING', hp: 70, spd: 2.4, jump: 6, sc: 1, col: '#ff9a6a', info: 'FLAME BREATH' },
  storm: { name: 'STORM WYRMLING', hp: 55, spd: 3.0, jump: 7.4, sc: 0.92, col: '#8ab0ff', wings: true, info: 'CHAIN LIGHTNING', pal: { body: '#3a5ac8', belly: '#bfd0ff', dark: '#1c2a6a', light: '#6a8aff', spine: '#c8f0ff', wing: '#4a2a9a' } },
  stone: { name: 'STONE WYRMLING', hp: 120, spd: 1.9, jump: 5, sc: 1.15, col: '#b8c8a8', horns: true, info: 'SHOCKWAVE + STOMP', pal: { body: '#5a6a58', belly: '#c8c0a0', dark: '#2a3228', light: '#7a8a76', spine: '#e6dcc4', wing: '#4a5a48' } }
};
function pickMountType() { const a = ['ember']; if (stageIdx >= 1 || cycle) a.push('storm'); if (stageIdx >= 2 || cycle) a.push('stone'); return a[rq() * a.length | 0]; }
function makeMount(x, y, hp, type) { type = type || 'ember'; const T = MOUNT_TYPES[type]; return { isMount: true, type, x, y, z: 0.01, vz: 3, face: 1, hp: hp || T.hp, maxhp: T.hp, falls: 0, t: 0, anim: 0, flash: 0, h: 30 }; }
const mtype = m => MOUNT_TYPES[(m && m.type) || 'ember'];
function zap(x0, y0, z0, x1, y1, z1) {
  for (let i = 0; i <= 9; i++) { const k = i / 9; parts.push({ x: x0 + (x1 - x0) * k + rnd(-3, 3), y: y0 + (y1 - y0) * k, z: z0 + (z1 - z0) * k + rnd(-4, 4), vx: 0, vy: 0, vz: 0, life: rnd(5, 10), max: 12, g: 0, c: i % 2 ? '#ffffff' : '#8ab0ff', size: 2, add: true }); }
}
function updateMounts() {
  for (const m of mounts) {
    if (m.flee) { m.t++; m.anim += 0.45; m.x += m.dir * 3.4; m.face = m.dir; m.z += m.vz; m.vz -= 0.3; if (m.z <= 0) { m.z = 0; m.vz = 0; } if (m.t % 4 === 0) dust(m.x, m.y, 1); if (m.x < cam - 140 || m.x > cam + W + 140) m.gone = true; continue; }
    m.t++; if (m.flash > 0) m.flash--; m.anim += 0.03;
    m.z += m.vz; m.vz -= 0.3; if (m.z <= 0) { m.z = 0; m.vz = 0; }
    m.face = sgn(nearestPlayer(m.x).x - m.x) || m.face;
    if (m.t % 20 === 0) spawn(m.x + m.face * 30, m.y, 30, 1, { c: '#8a7a8a', s0: 0.1, s1: 0.3, l0: 20, l1: 34, up: 0.5, g: -0.01, size: 2 });
  }
  mounts = mounts.filter(m => !m.gone);
}
function updateImp(e) {
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; return; }
  if (groundPhysics(e)) return;
  e.st = 'walk'; e.anim += e.fled ? 0.5 : 0.35; e.face = e.dir;
  e.x += e.dir * (e.fled ? 3 : 1.9); e.y = clamp(e.y + Math.sin(e.t * 0.12) * 0.35, Y_MIN, Y_MAX);
  if (gapAt(e.x, 4)) e.z = Math.min(26, e.z + 3.5); else if (e.z > 0) e.z = Math.max(0, e.z - 3); // it hops over chasms and barricades like the husks do
  if (e.x < cam - 140 || e.x > cam + W + 140) e.gone = true;
}
function updateImpSpawn() {
  if (mode !== 'play' || dragon || clearT > 0) return;
  if (enemies.some(e => e.kind === 'boss' && !e.dead)) return;
  if (--impT > 0) return;
  impT = rnd(900, 1500);
  if (enemies.some(e => e.kind === 'imp')) return;
  const d = Math.random() < 0.5 ? 1 : -1;
  const e = makeFighter('imp', d > 0 ? cam - 30 : cam + W + 30, rnd(Y_MIN + 6, Y_MAX - 6));
  e.dir = d; e.face = d; e.vase = true; e.st = 'walk'; enemies.push(e);
}
function castDragon() {
  const v = hero.vases;
  hero.vases = 0; hero.st = 'magic'; hero.t = 0; hero.inv = 190;
  dragon = { t: 0, v, mult: 1 + 0.15 * v, size: 1 + 0.15 * v, by: hero }; jr('wrath');
  msg = v ? `DRAGON'S WRATH  +${v * 15}%` : "DRAGON'S WRATH"; msgT = 120; SFX.magic();
}
function stepDragon() {
  const d = dragon; d.t++;
  if (d.t === 6) sfxTone('sawtooth', 55, 30, 1.2, 0.1);
  if (d.t < 62 && d.t % 18 === 0) { flashA = 0.35; sfxTone('square', 220, 40, 0.2, 0.05); }
  if (d.t === 62) dragonImpact();
  if (d.t > 84 && d.t < 120 && d.t % 3 === 0) { const E = ELEM[rpg.elem || 'fire']; spawn(cam + W / 2 + rnd(-30, 30), rnd(Y_MIN, Y_MAX), 4, 2, { c: [E.col, E.col2], s0: 0.1, s1: 0.5, l0: 20, l1: 40, up: 2.2, g: -0.02, size: 2, add: true }); } // the glowing trail it leaves behind
  if (d.t >= 128) { d.by.inv = Math.max(d.by.inv, 30); dragon = null; }
}
function dragonImpact() {
  const d = dragon, flat = 130 * d.mult * Math.max(1, pstats().mult); shots = [];
  hero.st = 'idle'; hero.t = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    e.inv = 0; if (e.st === 'down' || e.st === 'getup') e.st = 'idle';
    // the wrath scales with your power and bites a share of the foe's health: 40% to 85% of a husk, 15% to 36% of a boss (more jars, more bite)
    const share = isBoss(e) ? 0.15 + 0.07 * d.v : 0.4 + 0.15 * d.v;
    hurt(e, Math.max(flat, Math.round(e.maxhp * share)), 'down', { x: cam + W / 2, face: 1 });
  }
  for (const c of chests) if (!c.open && c.x > cam - 10 && c.x < cam + W + 10) { c.hp = 1; openChest(c); } // the wrath smashes every chest on screen open
  shake = 22; freeze = 8; flashA = 1;
  SFX.big(); sfxTone('sawtooth', 70, 20, 0.9, 0.14);
  const ER = ELEM[rpg.elem || 'fire'];
  for (let i = 0; i < 3; i++) parts.push({ ring: true, rgb: ER.rgb, x: cam + W / 2, y: 215, z: 4, life: 26 + i * 6, max: 26 + i * 6 });
  for (let i = 0; i < 16 + d.v * 4; i++) { const a = rnd(0, 7);
    parts.push({ x: cam + W / 2 + Math.cos(a) * rnd(10, 90) * d.size, y: 215 + Math.sin(a) * rnd(2, 20), z: rnd(0, 6), vx: Math.cos(a) * rnd(0.6, 2.6), vy: 0, vz: rnd(4, 8.5), life: rnd(34, 60), max: 60, g: 0.26, c: ['#6a5870', '#4a3a50', '#8a7a8a'][i % 3], size: 3 + (i % 2), add: false });
    } // flung stones
  const n = 70 + d.v * 30;
  for (let i = 0; i < n; i++) {
    parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 8), vx: rnd(-1.5, 1.5), vy: 0, vz: rnd(2, 6.5), life: rnd(24, 50), max: 50, g: 0.22, c: ['#4a3a50', '#6a5870', '#2a2030'][i % 3], size: i % 4 ? 2 : 3, add: false });
    if (i % 2) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 6), vx: rnd(-1, 1), vy: 0, vz: rnd(1, 4), life: rnd(16, 34), max: 34, g: 0.05, c: ['#fff1b0', ER.col2, ER.col][i % 3], size: 2, add: true });
  }
}

/* ---------- campaign flow: story screens, stages ---------- */
/* ---------- pause menu ---------- */
const PAUSE_ITEMS = ['RESUME', 'MUSIC', 'SOUND FX', 'CRT FILTER', 'HD EFFECTS', 'SKILLS', 'CONTROLS', 'ELEMENTS', 'QUIT TO TITLE'];
let pauseI = 0, pausePg = 0;
function openPause() { mode = 'pause'; pauseI = 0; pausePg = 0; SFX.pick(); }
function updatePause() {
  if (pausePg) { if (isHit('back') || isHit('start') || isHit('atk') || isHit('pause')) pausePg = 0; return; }
  if (isHit('back') || isHit('pause')) { mode = 'play'; return; }
  if (isHit('up')) { pauseI = (pauseI + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; SFX.pick(); }
  if (isHit('down')) { pauseI = (pauseI + 1) % PAUSE_ITEMS.length; SFX.pick(); }
  const go = isHit('start') || isHit('atk') || isHit('left') || isHit('right');
  if (!go) return;
  if (pauseI === 0) mode = 'play';
  else if (pauseI === 1) { musicOn = !musicOn; saveSettings(); }
  else if (pauseI === 2) { sfxOn = !sfxOn; saveSettings(); SFX.pick(); }
  else if (pauseI === 3) { crtOn = !crtOn; saveSettings(); }
  else if (pauseI === 4) { hdOn = !hdOn; hdAuto = true; hdSlow = 0; saveSettings(); }
  else if (pauseI === 5) pausePg = 2;
  else if (pauseI === 6) pausePg = 1;
  else if (pauseI === 7) pausePg = 3;
  else if (pauseI === 8) { saveGame(); toTitle(); }
}
function drawPause() {
  g.fillStyle = 'rgba(4,2,10,0.72)'; g.fillRect(0, 0, W, H);
  panel(W / 2 - 110, 40, 220, 196, 'PAUSED');
  if (pausePg === 1) {
    const L = ['MOVE      WASD / ARROWS', 'ATTACK    J / Z', 'JUMP      K / X / SPACE', 'MAGIC     SHIFT / L / C', 'SKILL     U CAST, Q SWAP', 'RIDE/DISMOUNT   K / E', 'GEAR      I / TAB', 'PAUSE     ESC / P', 'PAD  STICK, X A B Y, LB/LT SKILL', 'PLAYER 2  ARROWS  , . /  ; \\'];
    L.forEach((t, i) => text(t, W / 2 - 96, 78 + i * 13, 8, '#e8dcc8', 'left'));
    text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  if (pausePg === 3) { // how the elements work
    const E = rpg.elem && ELEM[rpg.elem], T = elemTier(), L = [];
    L.push(['HITS BUILD UP A STATUS ON FOES;', '#e8dcc8']); L.push(['AT 100 IT TRIGGERS. TIERS UNLOCK EVERY 10 LEVELS;', '#e8dcc8']); L.push(['BUY THEM AT THE BLACKSMITH. DISMISS: 75% BACK.', '#e8dcc8']);
    L.push(['FIRE: BURNING.  FROST: CHILL, FREEZE.', '#e8dcc8']); L.push(['LIGHTNING: ARCS AND STUN.', '#e8dcc8']);
    L.push(['FROST BEATS FIRE, LIGHTNING BEATS FROST,', '#9aff9a']); L.push(['FIRE BEATS LIGHTNING. NEVER IMMUNE.', '#ff9a9a']);
    L.push([rpg.lvl < 10 ? 'REACH LEVEL 10, THEN SEE THE BLACKSMITH.' : E ? 'YOURS: ' + E.name + ' TIER ' + ROMAN[T] : 'PICK YOUR ELEMENT AT THE BLACKSMITH.', E ? E.col : '#ffd24a']);
    if (E) L.push([ELEM_TIERS[rpg.elem][T - 1], E.col2]);
    L.push(['GEAR: +% POWER FOR YOUR ELEMENT, +% RESIST', '#8fb8ff']); L.push(['AGAINST FIRE, FROST OR LIGHTNING FOES.', '#8fb8ff']);
    L.forEach(([t, c], i) => text(t, W / 2 - 100, 70 + i * 12, 7, c, 'left'));
    text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  if (pausePg === 2) {
    const cur = skillOf(hero);
    SKILLS.forEach((k, i) => { const on = k.lv <= rpg.lvl, y = 80 + i * 18; text('LV ' + k.lv, W / 2 - 96, y, 8, on ? '#8cc4ff' : '#4a4a5a', 'left'); text(skName(k,
      hero), W / 2 - 60, y, 9, on ? (cur === k ? '#ffd24a' : '#e8dcc8') : '#4a4a5a', 'left'); if (!on) text('LOCKED', W / 2 + 96, y, 7, '#4a4a5a',
      'right'); else if (cur === k) text('ACTIVE', W / 2 + 96, y, 7, '#ffd24a', 'right'); });
    text('YOUR LEVEL ' + rpg.lvl + '.  U CAST   Q SWAP SKILL', W / 2, 214, 8, '#b8a8c8', 'center'); text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  PAUSE_ITEMS.forEach((t, i) => {
    const sel = i === pauseI, y = 72 + i * 16, v = i === 1 ? musicOn : i === 2 ? sfxOn : i === 3 ? crtOn : i === 4 ? hdOn : null;
    if (sel) { g.fillStyle = 'rgba(255,180,60,0.22)'; g.fillRect(W / 2 - 98, y - 11, 196, 15); }
    text(t, W / 2 - 86, y, 10, sel ? '#ffd24a' : '#b8a8c8', 'left');
    if (v !== null) text(v ? 'ON' : 'OFF', W / 2 + 86, y, 10, v ? '#8aff9a' : '#ff6a6a', 'right');
  });
  text('ESC TO RESUME', W / 2, 226, 8, '#8878a0', 'center');
}

function wrapText(s, n) {
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
function openStory(title, sub, paras, next, themeIdx, act) {
  if (!paras.length) { next(); return; }
  paras = paras.map(p => heroize(tr(p))); story = { title, sub, paras, pi: 0, ci: 0, next, theme: themeIdx, act: act || 0 }; mode = 'story';
}
function updateStory() {
  const s = story; if (!s) { mode = 'play'; return; }
  const p = s.paras[s.pi];
  if (s.ci < p.length) s.ci += 1.6;
  if (isHit('start') || isHit('atk') || isHit('jump')) {
    if (s.ci < p.length) s.ci = p.length;
    else if (s.pi < s.paras.length - 1) { s.pi++; s.ci = 0; SFX.pick(); }
    else { const n = s.next; story = null; n(); return; }
  }
  updateParts(); cam += 0.2;
}
/* ---------- original bust portraits for story scenes ---------- */
const PORT = ['boss', 'witch', 'smith', 'king', 'wyrm'], PORT_NAME = ['CINDER COLOSSUS', 'MIRE MATRON', 'FORGEMASTER', 'CINDER KING', 'EMBER WYRM'];
function drawPortrait(kind, cx, cy, who, glow) {
  const w = 78, h = 96, x0 = cx - w / 2, y0 = cy - h / 2, t = tickN;
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  const bg = g.createLinearGradient(0, y0, 0, y0 + h); bg.addColorStop(0, '#120a1e'); bg.addColorStop(1, `rgb(${glow})`); g.fillStyle = bg; g.fillRect(x0, y0, w, h);
  const rg = g.createRadialGradient(cx, cy - 8, 4, cx, cy - 8, 52); rg.addColorStop(0, `rgba(${glow},0.55)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x0, y0, w, h);
  const P = (pts, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(cx + pts[0], cy + pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(cx + pts[i], cy + pts[i + 1]); g.closePath(); g.fill(); };
  const R = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(cx + x, cy + y, ww, hh); };
  const eyeGlow = c => { g.globalCompositeOperation = 'lighter'; g.fillStyle = c; g.fillRect(cx + 0, cy - 7, 1, 1); g.globalCompositeOperation = 'source-over'; };
  const br = Math.sin(t * 0.05) * 0.8;
  if (kind === 'hero') {
    P([-34, 48, -30, 24, -16, 16, 16, 16, 30, 24, 34, 48], '#3a4a78'); P([-34, 48, -30, 24, -16, 16, -12, 48], '#262f54'); R(-9, 8, 18, 12, '#d8a07a'); // shoulders, neck
    P([-30, 44, -30, 22, -22, 20, -22, 44], '#8a96c8'); R(-24, 20, 8, 3, '#c8d0f0');
    P([-22, 14, -26, -10, -20, -30, 0, -38, 20, -30, 26, -10, 22, 14, 14, 20, -14, 20], '#e0aa84'); P([8, -30, 20, -30, 26, -10, 22, 14, 14, 20, 10, 10], '#c48a64');
    P([-26, -8, -28, -34, -14, -46, 6, -48, 24, -38, 28, -14, 22, -22, 8, -34, -10, -30, -22, -18], '#7a2a1a'); P([-26, -8, -34, 14, -28, 22, -22, 4], '#5a1a10');
    R(-24, -22, 48, 5, '#c9962e'); R(-24, -22, 48, 1, '#ffe08a');
    R(6, -12, 10, 4, '#fff'); R(10, -12, 5, 4, '#1b1b2a'); R(10, -12, 2, 2, '#ffffff'); R(-14, -12, 10, 4, '#fff'); R(-12, -12, 5, 4, '#1b1b2a');
    R(4, -17, 12, 2, '#5a1a10'); R(-16, -17, 12, 2, '#5a1a10'); R(-4, 4, 8, 1, '#8a4a3a'); R(-2, 8, 1, 1, '#8a4a3a');
  } else if (kind === 'boss') { // colossus: horned iron helm
    P([-40, 48, -36, 22, -18, 14, 18, 14, 36, 22, 40, 48], '#2e2a34'); R(-30, 22, 60, 5, '#8a5a36'); R(-6, 24, 12, 24, '#e6b84a');
    P([-24, 14, -26, -24, -14, -36, 14, -36, 26, -24, 24, 14, 12, 22, -12, 22], '#47424e'); P([8, -36, 26, -24, 24, 14, 12, 22, 8, 6], '#2a2630'); P([-26, -24, -14, -36, 14, -36, 26, -24, 26, -20, -26, -20], '#6a6472');
    R(-3, -36, 6, 52, '#2a2630'); R(-19, -12, 14, 4, '#ffa23a'); R(5, -12, 14, 4, '#ffa23a'); R(-17, -12, 10, 2, '#fff0a8'); R(7, -12, 10, 2, '#fff0a8');
    for (let i = 0; i < 5; i++) R(-14 + i * 6, 6, 3, 8, '#141018'); P([-24, -20, -52, -34, -58, -58, -42, -44, -26, -34], '#e6dcc4'); P([24, -20, 52, -34, 58, -58, 42, -44, 26, -34], '#bfb49a');
  } else if (kind === 'witch') { // matron: hooded marsh hag
    const f = Math.sin(t * 0.08) * 2;
    P([-38, 48, -28, 10, 28, 10, 38, 48], '#16281f'); P([-26, -2, -34, 40, -20, 30, -10, 8], '#0e1a14');
    P([-30, 8, -36, -20, -14, -56 + f, 0, -64 + f, 14, -56 + f, 36, -20, 30, 8, 14, 14, -14, 14], '#1d3a2a'); P([6, -56 + f, 36, -20, 30, 8, 14, 14, 8, 0], '#10231a');
    P([-14, 14, -18, -12, -12, -32, 0, -36, 12, -32, 18, -12, 14, 14, 0, 20], '#8fb89a'); P([6, -32, 18, -12, 14, 14, 6, 14], '#6f9a7c');
    R(-12, -14, 9, 4, '#caffd8'); R(4, -14, 9, 4, '#caffd8'); R(-9, -14, 4, 4, '#1aa050'); R(7, -14, 4, 4, '#1aa050');
    R(-6, 2, 12, 2, '#1a0c14'); R(-4, 1, 1, 3, '#ddd'); R(2, 1, 1, 3, '#ddd'); R(-1, -8, 2, 8, '#6f9a7c');
    for (let i = 0; i < 5; i++) { const a = t * 0.04 + i * 1.26; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(160,255,190,0.8)'; g.fillRect(cx + Math.cos(a) * 32, cy + Math.sin(a * 1.3) * 28 - 6, 3, 3); g.globalCompositeOperation = 'source-over'; }
  } else if (kind === 'smith') { // forgemaster: furnace helm
    P([-40, 48, -34, 18, -16, 12, 16, 12, 34, 18, 40, 48], '#3a2a22'); R(-30, 40, 60, 8, '#5a3a26'); R(-22, 20, 44, 28, '#6a4a30'); R(-18, 22, 36, 3, '#8a5a36');
    P([-22, 12, -24, -28, -10, -42, 10, -42, 24, -28, 22, 12, 10, 18, -10, 18], '#4a4e58'); P([6, -42, 24, -28, 22, 12, 10, 18, 6, 4], '#2e323c'); R(-14, -50, 28, 10, '#3a3e48'); R(-14, -50, 28, 2, '#9aa1ad'); R(-26, -34, 52, 4, '#5c616c');
    const ef = 0.7 + Math.sin(t * 0.18) * 0.3; R(-18, -14, 36, 5, '#0e0806'); R(-17, -12, 34, 2, `rgb(255,${130 + ef * 80 | 0},30)`);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,140,40,${0.15 + ef * 0.12})`; g.fillRect(cx - 24, cy - 24, 48, 24); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 4; i++) R(-12 + i * 8, 4, 3, 8, '#1a1a20');
  } else if (kind === 'king') { // cinder king: burning crown
    P([-38, 48, -34, 20, -16, 14, 16, 14, 34, 20, 38, 48], '#2a0a10'); R(-4, 20, 8, 28, '#ff6a2a'); R(-22, 28, 44, 3, '#ff6a2a');
    P([-22, 12, -24, -20, -14, -34, 14, -34, 24, -20, 22, 12, 10, 20, -10, 20], '#1a1620'); P([8, -34, 24, -20, 22, 12, 10, 20, 8, 4], '#0c0a12');
    R(-16, -12, 12, 4, '#c8401a'); R(4, -12, 12, 4, '#ff6a2a'); R(6, -12, 8, 2, '#fff1b0'); R(-20, -38, 40, 6, '#c9962e'); R(-20, -38, 40, 1, '#ffe08a');
    for (let i = -2; i <= 2; i++) { const ch = 12 + (2 - Math.abs(i)) * 5, fh = 7 + Math.abs(Math.sin(t * 0.2 + i)) * 8; P([i * 8 - 3, -38, i * 8 + 3, -38, i * 8, -38 - ch], '#3a3040'); P([i * 8 - 2.5, -38 - ch, i * 8 + 2.5, -38 - ch, i * 8, -38 - ch - fh], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else { // wyrm: great dragon head
    const j = Math.sin(t * 0.09) * 2;
    P([-44, 48, -30, 6, 6, -8, 40, 0, 46, 48], '#3a2230'); P([-30, -4, -10, -26, 20, -30, 44, -12, 44, 6, 20, 14 + j, -20, 12], '#4a2a3a'); P([-10, -26, 20, -30, 44, -12, 30, -14, 10, -16], '#6a3a4a');
    P([-20, 12, 20, 14 + j, 44, 6, 36, 22 + j, 0, 28 + j, -22, 20 + j], '#d06a2a'); for (let i = 0; i < 6; i++) P([-8 + i * 8, 13 + j * 0.6, -4 + i * 8, 13 + j * 0.6, -6 + i * 8, 21 + j], '#fff0d8');
    P([-8, -26, -24, -52, -12, -34], '#ffb43a'); P([8, -28, 2, -58, 16, -32], '#ffb43a');
    R(14, -14, 12, 5, '#ffe27a'); R(19, -14, 3, 5, '#1a0a04'); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,200,80,0.35)'; g.fillRect(cx + 10, cy - 18, 20, 13); g.globalCompositeOperation = 'source-over';
    R(36, -2, 3, 2, '#1a0c10');
  }
  g.restore();
  g.strokeStyle = '#c9962e'; g.lineWidth = 2; g.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2); g.strokeStyle = '#2a1a0a'; g.lineWidth = 1; g.strokeRect(x0 - 0.5, y0 - 0.5, w + 1, h + 1);
  text(who, cx, y0 + h + 11, 7, '#ffd070', 'center');
}
function drawStory() {
  const s = story; if (!s) return;
  const T = themeFor(s.theme, s.act);
  const saveTH = TH; TH = T; drawWorld(); drawFog();
  for (const tx of torchPositions()) flame(Math.round(tx - cam), GROUND_TOP - 44, 1);
  { const sh = { x: hero.x, y: hero.y, f: hero.face, st: hero.st, z: hero.z, inv: hero.inv, fl: hero.flash }; // Nolan keeps watch at the bottom of the scene
    hero.x = cam + 150; hero.y = 240; hero.face = 1; hero.st = 'idle'; hero.z = 0; hero.inv = 0; hero.flash = 0; drawFighter(hero);
    hero.x = sh.x; hero.y = sh.y; hero.face = sh.f; hero.st = sh.st; hero.z = sh.z; hero.inv = sh.inv; hero.flash = sh.fl; }
  TH = saveTH;
  g.fillStyle = 'rgba(4,2,10,0.58)'; g.fillRect(0, 0, W, 214);
  const vg = g.createLinearGradient(0, 200, 0, H); vg.addColorStop(0, 'rgba(4,2,10,0.58)'); vg.addColorStop(1, 'rgba(4,2,10,0.1)'); g.fillStyle = vg; g.fillRect(0, 200, W, H - 200);
  drawParts(true);
  text(s.title, W / 2, 42, 16, '#ffb43a', 'center');
  if (s.sub) text(s.sub, W / 2, 58, 9, '#c9a8ff', 'center');
  g.fillStyle = 'rgba(255,180,60,0.35)'; g.fillRect(W / 2 - 120, 66, 240, 1);
  let y = 88;
  for (let i = 0; i <= s.pi; i++) {
    const lines = wrapText(s.paras[i], 54); let rem = i < s.pi ? 1e9 : s.ci | 0;
    for (const ln of lines) {
      if (rem <= 0) break;
      text(ln.slice(0, rem), W / 2, y, 9, i === s.pi ? '#fff1d0' : '#a898b8', 'center');
      rem -= ln.length + 1; y += 12;
    }
    y += 8;
  }
  if (s.theme >= 0 && s.theme < 5) { drawPortrait('hero', 46, 150, cls().name, CLS === 'panni' ? '80,50,120' : CLS === 'luca' ? '40,80,60' : '90,60,40'); drawPortrait(PORT[s.theme], W - 46, 150, PORT_NAME[s.theme], THEMES[s.theme].glow); }
  const done = s.pi === s.paras.length - 1 && s.ci >= s.paras[s.pi].length;
  if ((tickN >> 5) & 1) text(done ? 'PRESS ENTER' : '...', W / 2, 252, 9, '#ffffff', 'center');
}
function beginStage(i) {
  bonus = null; killCombo = 0; stageIdx = i; const S = STAGES[i]; TH = themeFor(S.theme, actOf(i)); weather = WEATHER[actOf(i)][S.theme]; WAVES = S.waves; STAGE_END = S.end;
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null;
  decals = []; impT = 240; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 190; flashA = 0; shake = 0; freeze = 0;
  intro = null; slashes = []; vents = []; chests = [];
  gaps = []; ambW = -1;
  { const bw = S.waves.find(w => w.e.some(t => BOSSES[t])), stop = bw ? bw.x - 320 : S.end - 300, n = i === 0 ? 2 : 2 + Math.min(3, actOf(i) + ((i % 5) >= 2 ? 1 : 0));
    if (i === 0) { gaps.push({ x: 590, w: 14, type: 'wall' }); gaps.push({ x: 1600, w: 34, type: 'pit' }); }
    else for (let x = 520 + (i * 37) % 120, k = 0; x < stop && k < n; x += 330 + ((i * 53 + k * 71) % 200), k++) { const pit = (i + k) % 3 !== 0; gaps.push({ x, w: pit ? 34 + ((i + k) * 13) % 9 : 14, type: pit ? 'pit' : 'wall' }); } }
  if (i >= 1) for (let x = 420, k = 0; x < S.end - 300; x += 330 + (k * 67) % 140, k++) if (!gaps.some(q => Math.abs(q.x + q.w / 2 - x) < 60)) vents.push({ x, y: Y_MIN + 20 + (k * 53) % (Y_MAX - Y_MIN - 30), ph: (k * 97) % 260, hit: new Set() });
  seeded('LC' + i + '/' + cycle, () => { const bw = S.waves.find(w => w.e.some(t => BOSSES[t])), stop = (bw ? bw.x - 260 : S.end - 260); // hidden treasure chests along the road
    const td = dailyIs('TREASURE SEASON'); for (let x = 300 + rq() * 160, k = 0; x < stop && k < (td ? 8 : 4); x += (380 + rq() * 260) / (td ? 2 : 1),
      k++) if (!gaps.some(q => Math.abs(q.x + q.w / 2 - x) < 50)) { const r = rq(),
      type = r < (dailyIs('TREASURE SEASON') ? 0.25 : 0.1) ? 'gold' : r < 0.24 && i >= 1 ? 'trap' : 'wood'; chests.push({ x: Math.round(x),
      y: Y_MIN + 12 + rq() * (Y_MAX - Y_MIN - 24), open: 0, hp: type === 'gold' ? 3 : 2, type }); } });
  shrines = []; buffs = []; // a shrine may wait by the road (never on the first stage of the campaign, and always before the boss)
  if (i >= 1 || cycle) seeded('LS' + i + '/' + cycle, () => {
    const want = Math.max((i + 1) % 4 === 0 ? 1 : 0, rq() < 0.55 ? (rq() < 0.2 ? 2 : 1) : 0), // every fourth stage always has one
      bw = S.waves.find(w => w.e.some(t => BOSSES[t])), stop = bw ? bw.x - 260 : S.end - 260;
    for (let n = 0; n < want; n++) for (let tries = 0; tries < 14; tries++) {
      const x = Math.round(420 + rq() * Math.max(60, stop - 420));
      if (gaps.some(q => Math.abs(q.x + q.w / 2 - x) < 60) || chests.some(c => Math.abs(c.x - x) < 60) || vents.some(v => Math.abs(v.x - x) < 40) || shrines.some(q => Math.abs(q.x - x) < 160)) continue;
      shrines.push({ x, y: Math.round(Y_MIN + 14 + rq() * (Y_MAX - Y_MIN - 28)), used: 0, t: 0, shake: 0, sacred: rq() < 0.08 }); break;
    }
    if ((i + 1) % 4 === 0 && !shrines.length) shrines.push({ x: Math.round(stop * 0.5 + 200), y: 215, used: 0, t: 0, shake: 0, sacred: false }); // the fixed shrine is never skipped
  });
  for (const p of players()) {
    if (p.dead && coop) { p.dead = false; p.fade = 0; p.hp = Math.max(1, p.maxhp >> 1); }
    p.pitT = 0; p.x = p.pn === 2 ? 40 : 60; p.y = p.pn === 2 ? 232 : 205; p.z = 0; p.vx = 0; p.vz = 0; p.st = 'idle'; p.t = 0; p.mount = null; p.inv = 90; p.hits.clear();
    if (!p.dead && i > 0) p.hp = Math.min(p.maxhp, p.hp + 70);
  }
  mode = 'play'; saveRun(i);
}
function startCampaign(two) {
  clearRun();
  coop = !!two; cycle = 0; resetGame(); stageIdx = 0; TH = THEMES[0]; rpg.coins = 3; rpg.gold = 0; shop = null; devMax();
  openStory('THE ASHEN VOW', 'A TALE OF EMBERFALL', STORY.intro, () => beginStage(devStage()), 0);
}
function nextCycle() {
  cycle = daily ? Math.min(TRIAL_MAX, cycle + 1) : cycle + 1; rpg.coins = Math.min(MAX_COINS, rpg.coins + 1);
  for (const p of players()) { p.dead = false; p.fade = 0; p.hp = p.maxhp; p.mana = Math.max(p.mana, 60); }
  openStory('THE ASH RETURNS', trialName(cycle), STORY.loop, () => beginStage(0), 0);
}
function continueStage() {
  saveRun(stageIdx); const keep = score; newHero(); heroStats(true); score = keep; beginStage(stageIdx);
}
const MAX_COINS = 9;
const coinPrice = () => 600 + 300 * Math.max(0, rpg.coins - 2); // the more coins you hold, the dearer the next one
function drawCoins(x, y, n, gap) { // up to three slots, then one coin and a count
  if (n <= 3) { for (let i = 0; i < 3; i++) drawCoin(x + i * gap, y, i < n); return; }
  drawCoin(x, y, true); text('x' + n, x + 9, y + 4, 9, '#ffd24a');
}
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
  if (Math.random() < FORGE_P[up]) { it.up = up + 1; jr('forge'); PS = null; heroStats(false); say(tr('SUCCESS!') + '  ' + tr(it.name) + ' +' + it.up, true); SFX.magic(); f.fx = 40; }
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
  const mk = i => seeded('M' + stageIdx + '/' + cycle + '/' + i, () => { // the market always has a little mythic and legendary luck, on top of the stage drop rates
    let r = rollRarity(); if (i === 0 && tierOf() >= 1) r = Math.max(1, r);
    if (stageIdx >= 2 || cycle) { const x = rq(); if (i === 3) r = x < 0.06 ? 4 : x < 0.3 ? 3 : x < 0.6 ? 2 : Math.max(1, r); else if (x < 0.02) r = 4; else if (x < 0.09) r = Math.max(r, 3); else if (x < 0.22) r = Math.max(r, 2); }
    return genItem(r);
  });
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
/* ---------- bonus stage: after every act boss, ten seconds of loot goblins ---------- */
let bonus = null;
const BONUS_AFTER = i => i % 5 === 4 && i < STAGES.length - 1;
const BONUS_T = 600;
function beginBonus(next) {
  const S = STAGES[stageIdx]; TH = themeFor(S.theme, actOf(stageIdx)); weather = null; WAVES = []; STAGE_END = W;
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null;
  decals = []; impT = 1e9; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 0; flashA = 0; shake = 0; freeze = 0;
  intro = null; slashes = []; vents = []; chests = []; gaps = []; ambW = -1; shrines = []; buffs = [];
  for (const p of players()) {
    if (p.dead && coop) { p.dead = false; p.fade = 0; p.hp = Math.max(1, p.maxhp >> 1); }
    p.pitT = 0; p.x = p.pn === 2 ? 150 : 120; p.y = p.pn === 2 ? 232 : 205; p.z = 0; p.vx = 0; p.vz = 0; p.st = 'idle'; p.t = 0; p.mount = null; p.inv = 60; p.hits.clear();
  }
  killCombo = 0; bonus = { next, phase: 'ready', t: 0, left: BONUS_T, gold: 0, xp: 0, kills: 0, opened: 0, esc: 0, combo: 0, best: 0, last: -999, spawnT: 0 };
  mode = 'play'; SFX.big();
}
function spawnGob(golden) {
  const dir = Math.random() < 0.5 ? 1 : -1, f = makeFighter('gob', dir > 0 ? cam - 24 : cam + W + 24, rnd(Y_MIN + 4, Y_MAX - 4));
  f.hp = f.maxhp = golden ? 3 : 1; f.gdir = dir; f.face = dir; f.gv = rnd(2.0, 3.0) * (golden ? 1.25 : 1); f.gph = rnd(0, 6); f.golden = golden; f.armor = 0;
  if (golden) { f.k = Object.assign({}, f.k, { name: 'GOLDEN GOBLIN', skin: '#d8c24a', armor: '#c8921a', armor2: '#fff1b0', scale: 0.86 }); f.glow = '255,210,80'; }
  enemies.push(f); return f;
}
function bonusKill(e) {
  elemDeath(e); const B = bonus; if (!B) return;
  B.combo = tickN - B.last < 75 ? B.combo + 1 : 1; B.last = tickN; B.best = Math.max(B.best, B.combo); B.kills++;
  const mult = 1 + Math.min(10, B.combo - 1) * 0.2;
  killCombo = (tickN - killComboT <= KC_WINDOW ? killCombo : 0) + 1; killComboT = tickN; // goblins feed the experience combo too, and pay a normal foe's experience with no extra multiplier
  const xg = Math.round(10 * (1 + areaLv() * 0.12) * 0.42 * (dailyIs('IRON FOES') ? 1.5 : 1) * (1 + kcBonus())); B.xp += xg; gainXP(xg);
  const gd = Math.round(5 * (1 + areaLv() * 0.1) * (1 + 0.25 * trialN()) * (e.golden ? 4 : 1) * mult * (dailyIs('GOLD RUSH') ? 2 : 1));
  rpg.gold += gd; B.gold += gd; score += gd * 3;
  floatText(e.x, e.y - e.h - 8, '+' + gd + 'G', e.golden ? '#fff1b0' : '#ffd24a', e.golden ? 10 : 8);
  spawn(e.x, e.y, 14, 10, { c: ['#ffd24a', '#fff1b0'], s0: 1, s1: 2.6, l0: 14, l1: 26, add: true, size: 2, up: 2.4, g: 0.12 }); SFX.pick();
  if (e.golden || Math.random() < 0.2) { // some goblins drop their loot chest
    const type = e.golden || Math.random() < 0.08 ? 'gold' : 'wood';
    chests.push({ x: Math.round(clamp(e.x, cam + 24, cam + W - 24)), y: clamp(e.y, Y_MIN + 4, Y_MAX - 4), open: 0, hp: type === 'gold' ? 3 : 2, type });
    floatText(e.x, e.y - e.h - 20, type === 'gold' ? 'GOLDEN CHEST!' : 'CHEST!', '#fff1b0', 8);
  }
}
function updateBonus() {
  const B = bonus; B.t++;
  for (const p of players()) p.x = clamp(p.x, cam + 12, cam + W - 12);
  if (B.phase === 'ready') { if (B.t >= 100) { B.phase = 'run'; B.t = 0; msg = 'CATCH THEM ALL!'; msgT = 70; SFX.big(); } return; }
  if (B.phase === 'run') {
    B.left--; const prog = 1 - B.left / BONUS_T;
    if (--B.spawnT <= 0 && B.left > 30) { B.spawnT = Math.round(lerp(20, 10, prog)); const n = Math.random() < 0.25 ? 2 : 1; for (let i = 0; i < n; i++) spawnGob(Math.random() < 0.07); }
    if (B.left <= 0) { B.phase = 'grace'; B.t = 0; msg = 'TIME UP'; msgT = 80; SFX.land(); }
  } else if (B.phase === 'grace') {
    const open = chests.some(c => !c.open), loot = items.some(i => i.kind === 'gear'); // the clock stops mattering: stay until the chests are smashed and the gear picked up (at most 12 seconds)
    if (B.t >= 720 || (B.t >= 90 && !open && !loot)) { B.phase = 'done'; B.t = 0; for (const e of enemies) if (!e.dead) e.gone = true; SFX.magic(); saveGame(); }
  } else if (B.t > 40 && (isHit('start') || isHit('atk') || B.t > 500)) { const n = B.next; bonus = null; chests = []; n(); }
}
function drawBonusHud() {
  const B = bonus, secs = Math.max(0, B.left) / 60;
  text('BONUS STAGE   GOBLIN TREASURY', W / 2, 31, 8, '#ffd24a', 'center');
  if (B.phase === 'run' || B.phase === 'ready') { bar(W / 2 - 70, 36, 140, 6, B.left, BONUS_T, B.left < 180 ? '#ff5a3a' : '#ffd24a', '#3a2a10'); text(secs.toFixed(1) + 'S', W / 2, 55, 10, '#fff1b0', 'center'); }
  text('GOLD +' + B.gold, W / 2, 68, 9, '#ffd24a', 'center');
  if (killCombo >= 2 && tickN - killComboT <= KC_WINDOW) text('XP +' + Math.round(kcBonus() * 100) + '%', W / 2, 90, 8, '#8fc8ff', 'center');
  if (B.combo >= 2 && tickN - B.last < 75) text('COMBO x' + B.combo + '   GOLD x' + (1 + Math.min(10, B.combo - 1) * 0.2).toFixed(1), W / 2, 80, 8, '#ff9a4a', 'center');
  if (B.phase === 'ready') { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 100, W, 70); text('BONUS STAGE', W / 2, 122, 12, '#ffb43a', 'center');
    text('GOBLIN TREASURY', W / 2, 146, 18, '#fff1d0', 'center'); text('10 SECONDS. CATCH THE GOBLINS, SMASH THEIR CHESTS', W / 2, 162, 7, '#c9a8ff', 'center'); }
  if (B.phase === 'grace') { const open = chests.some(c => !c.open), loot = items.some(i => i.kind === 'gear'); if (open || loot) { text(open ? 'SMASH THE CHESTS!' : 'GRAB THE LOOT!', W / 2, 110, 12, '#fff1b0', 'center'); bar(W / 2 - 50, 116, 100, 4, 720 - B.t, 720, '#ffd24a', '#3a2a10'); } }
  if (B.phase === 'done') {
    g.fillStyle = 'rgba(14,8,4,0.9)'; g.fillRect(130, 70, 220, 148); g.strokeStyle = '#ffd24a'; g.strokeRect(130.5, 70.5, 219, 147);
    text('BONUS CLEAR', W / 2, 92, 13, '#ffd24a', 'center');
    text('GOBLINS CAUGHT  ' + B.kills, 150, 114, 9, '#e8e0f0'); text('GOBLINS LOST  ' + B.esc, 150, 128, 9, '#9a90a8');
    text('CHESTS OPENED  ' + B.opened, 150, 142, 9, '#e8e0f0'); text('BEST COMBO  x' + B.best, 150, 156, 9, '#ff9a4a');
    text('GOLD EARNED  +' + B.gold, W / 2, 176, 11, '#ffd24a', 'center');
    text('XP EARNED  +' + B.xp, W / 2, 191, 10, '#8fc8ff', 'center');
    if (B.t > 40 && (tickN >> 5) & 1) text('PRESS ENTER', W / 2, 208, 8, '#ffffff', 'center');
  }
}
function stageCleared() {
  score += 3000; saveGame(); openShop(() => openForge(afterClear));
}
function afterClear(skipBonus) {
  const S = STAGES[stageIdx];
  if (daily && stageIdx >= STAGES.length - 1) { nextCycle(); return; } // the race goes on: the next, tougher round
  if (skipBonus !== true && !daily && BONUS_AFTER(stageIdx)) { beginBonus(() => afterClear(true)); return; } // a short gold run after every act boss
  if (stageIdx < STAGES.length - 1) saveRun(stageIdx + 1);
  if (stageIdx < STAGES.length - 1) openStory(`STAGE ${stageIdx + 1} CLEARED`, S.name, S.clear, () => beginStage(stageIdx + 1), STAGES[stageIdx + 1].theme, actOf(stageIdx + 1));
  else openStory(cycle === 0 ? 'THE END' : trialName(cycle) + ' COMPLETE', 'EMBERFALL', cycle === 0 ? STORY.ending : STORY.cycleEnd,
    () => { score += 5000 * (cycle + 1); if (cycle >= 1 && cycle > (rpg.tr | 0)) rpg.tr = Math.min(TRIAL_MAX,
    cycle); mode = 'victory'; endTimer = 0; TH = THEMES[4]; saveGame(); }, 4);
}

/* ---------- boss AI & projectiles ---------- */
const WINDUP = { bite: 26, tail: 24, breath: 34, flames: 30, swipe: 22, spit: 28, summon: 46, smash: 40, charge: 36, quake: 34, slash: 18, blink: 24, meteor: 56 };
function bossPhase2(e) {
  if (!e.p2 && e.hp < e.maxhp * 0.5) {
    e.p2 = true; e.cool = 30; shake = 12; flashA = 0.4; freeze = 10; msg = 'ENRAGED!'; msgT = 80; sparks(e.x, e.y, e.h * 0.6, true); SFX.big();
      spawn(e.x, e.y, e.h * 0.7, 14, { c: [e.k.armor2, tone(e.k.armor, 2), '#1a1418'], s0: 0.8, s1: 2.6, l0: 30, l1: 58, size: 3, up: 1.8, g: 0.12 });
      // a plate of armour bursts off
    const esc = [MINION[stageIdx % 5] || 'h', stageIdx >= 1 || cycle ? 'warder' : 'h']; // the enraged boss calls in escorts
    esc.forEach((t, i) => { const f = makeFighter(t, offGap(i ? cam + W + 30 : cam - 30, i ? 1 : -1), rnd(Y_MIN + 6, Y_MAX - 6)); if (t === 'h' && STAGES[stageIdx].tint) f.k = Object.assign({}, f.k, STAGES[stageIdx].tint); enemies.push(f); });
  }
  return !!e.p2;
}
function updateBoss(e) {
  const k = e.k, dx = hero.x - e.x, dy = hero.y - e.y, adx = Math.abs(dx), ady = Math.abs(dy);
  const heroDown = hero.dead || hero.st === 'down';
  const p2 = bossPhase2(e);
  if (e.kind === 'smith' && e.t % 9 === 0) spawn(e.x - e.face * 8, e.y, e.h * 0.95, 1, { c: ['#5a504c', '#3a3230'][(e.t / 9 | 0) % 2], s0: 0.05, s1: 0.25, l0: 26, l1: 44, up: 0.7, g: -0.012, size: 3 });
  if (e.st === 'idle' || e.st === 'walk') {
    e.face = sgn(dx) || e.face; e.cool--;
    let walk = false;
    if (e.kind === 'witch') { // kites: keeps her distance and shoots
      let mvx = 0; if (adx < 90) mvx = -sgn(dx) * 1.4; else if (adx > 170) mvx = sgn(dx);
      if (mvx) { e.x += mvx * k.spd; walk = true; }
      if (ady > 6) { e.y += sgn(dy) * k.spd * 0.8; walk = true; }
      e.x = clamp(e.x, cam + 34, cam + W - 34);
    } else if (e.kind === 'smith') { // slow juggernaut
      if (adx > 52) { e.x += sgn(dx) * k.spd; walk = true; }
      if (ady > 6) { e.y += sgn(dy) * k.spd * 0.7; walk = true; }
    } else if (e.kind === 'wyrm') { // vast, slow stalker
      const sp = k.spd * (p2 ? 1.35 : 1);
      if (adx > 56) { e.x += sgn(dx) * sp; walk = true; }
      if (ady > 5) { e.y += sgn(dy) * sp * 0.7; walk = true; }
    } else { // king: fast duelist
      const sp = k.spd * (p2 ? 1.5 : 1);
      if (adx > 44) { e.x += sgn(dx) * sp; walk = true; }
      if (ady > 5) { e.y += sgn(dy) * sp * 0.8; walk = true; }
    }
    e.y = clamp(e.y, Y_MIN, Y_MAX); e.st = walk ? 'walk' : 'idle'; if (walk) e.anim += 0.12;
    if (e.cool <= 0 && !heroDown) chooseBossAttack(e, adx, p2);
  } else if (e.st === 'wind') {
    e.face = sgn(dx) || e.face;
    if (e.atk === 'flames' || e.atk === 'breath') e.y = clamp(e.y + clamp(dy, -1.2, 1.2), Y_MIN, Y_MAX); // turns into the hero's lane while it winds up, so the fire leaves its mouth straight
    if (e.atk === 'blink' && e.t === 1) spawn(e.x, e.y, e.h * 0.5, 16, { c: ['#ff6a9a', '#ffb0c8'], add: true, l0: 10, l1: 24 });
    if (e.atk === 'meteor' && e.t === 8) {
      const n = p2 ? 9 : 6;
      for (let i = 0; i < n; i++) shots.push({ type: 'meteor', x: i === 0 ? hero.x : clamp(hero.x + rnd(-130, 130), cam + 20, cam + W - 20), y: i === 0 ? hero.y : rnd(Y_MIN, Y_MAX), t: 0, delay: 40 + i * 6, dmg: 22 });
      sfxTone('sawtooth', 400, 90, 0.5, 0.06);
    }
    if (e.t >= ((WINDUP[e.atk] || 20) * (p2 ? 0.8 : 1) | 0)) { e.st = 'eatk'; e.t = 0; e.hits.clear(); SFX.swing(); }
  } else if (e.st === 'eatk') bossAttack(e, dx, p2);
}
function chooseBossAttack(e, adx, p2) {
  const r = Math.random(); let a;
  if (e.kind === 'witch') {
    if (adx < 55) a = 'swipe';
    else if (r < 0.28 && enemies.filter(o => !o.dead && o.kind === 'h').length < 3) a = 'summon';
    else a = 'spit';
  } else if (e.kind === 'smith') {
    if (adx > 150 || (p2 && r < 0.3 && adx > 70)) a = 'charge';
    else if (adx < 100) a = (p2 || r < 0.35) ? 'quake' : 'smash';
    else a = 'smash';
  } else if (e.kind === 'wyrm') {
    if (p2 && r < 0.2 && enemies.filter(o => !o.dead && o.kind !== 'wyrm').length < 3) a = 'summon';
    else if (adx < 100) a = r < 0.5 ? 'bite' : 'tail';
    else if (p2 && r < 0.4) a = 'meteor';
    else a = r < 0.55 ? 'breath' : 'flames';
  } else {
    if (adx > 140 && r < 0.75) a = 'blink';
    else if (p2 && r < 0.4) a = 'meteor';
    else if (adx < 76) a = r > 0.8 ? 'blink' : 'slash';
    else a = r < 0.5 ? 'blink' : 'slash';
  }
  e.atk = a; e.st = 'wind'; e.t = 0; e.hits.clear();
}
function bossAttack(e, dx, p2) {
  const t = e.t, end = c => { e.st = 'idle'; e.t = 0; e.cool = c; };
  switch (e.atk) {
    case 'swipe':
      if (t >= 2 && t <= 6) strike(e, { x0: -6, x1: 58, dy: 14, z0: 0, z1: e.h }, 16, 'down', players());
      if (t >= 16) end(p2 ? 40 : 70);
      break;
    case 'spit':
      if (t === 1) {
        const n = p2 ? 5 : 3;
        for (let i = 0; i < n; i++) shots.push({ type: 'orb', x: e.x + e.face * 30, y: clamp(e.y + (i - (n - 1) / 2) * 12, Y_MIN, Y_MAX), z: 22, vx: e.face * (2.0 + (i % 2) * 0.5), t: 0, dmg: 12, life: 220 });
        spawn(e.x + e.face * 30, e.y, 22, 10, { c: ['#7aff9a', '#e8fff0'], add: true, l0: 8, l1: 16 }); sfxTone('sawtooth', 300, 700, 0.18, 0.05);
      }
      if (t >= 14) end(p2 ? 45 : 80);
      break;
    case 'summon':
      if (t === 1) {
        for (let i = 0; i < 2; i++) { const f = makeFighter('h', offGap(i ? cam + W + 30 : cam - 30, i ? 1 : -1), rnd(Y_MIN + 6, Y_MAX - 6)); f.k = Object.assign({}, f.k, STAGES[stageIdx].tint || {}); enemies.push(f); }
        spawn(e.x, e.y, 30, 30, { c: ['#7aff9a', '#2aa860'], add: true, l0: 20, l1: 40, up: 2, g: 0.02 }); SFX.magic();
      }
      if (t >= 16) end(60);
      break;
    case 'smash':
      if (t === 3) {
        strike(e, { x0: -6, x1: 76, dy: 16, z0: 0, z1: e.h }, 24, 'down', players()); shake = Math.max(shake, 10); dust(e.x + e.face * 50, e.y, 10); SFX.big();
        shots.push({ type: 'wave', x: e.x + e.face * 66, y: e.y, z: 0, vx: e.face * 3.2, t: 0, dmg: 14, life: 100 });
      }
      if (p2 && t === 14) shots.push({ type: 'wave', x: e.x + e.face * 66, y: e.y, z: 0, vx: e.face * 2.4, t: 0, dmg: 14, life: 100 });
      if (t >= 24) end(p2 ? 50 : 85);
      break;
    case 'charge':
      if (t === 1) { e.dir = sgn(dx) || e.face; e.face = e.dir; }
      if (t <= 46) {
        e.x = clamp(e.x + e.dir * 5.2, cam + 24, cam + W - 24); e.anim += 0.5; shake = Math.max(shake, 2);
        if (t % 12 === 1) e.hits.clear();
        strike(e, { x0: -10, x1: 46, dy: 16, z0: 0, z1: e.h }, 20, 'down', players());
        if (t % 3 === 0) { sparks(e.x, e.y, 6, false); dust(e.x - e.dir * 10, e.y, 2); }
      }
      if (t >= 52) end(100);
      break;
    case 'quake':
      if (t === 4 || (p2 && t === 14)) { shots.push({ type: 'ring', x: e.x, y: e.y, r: 8, t: 0, dmg: 18, hit: false }); shake = Math.max(shake, 10); dust(e.x, e.y, 12); SFX.big(); }
      if (t >= 24) end(p2 ? 50 : 80);
      break;
    case 'slash':
      if (t === 10 || (p2 && t === 20)) e.hits.clear();
      if ((t >= 2 && t <= 6) || (t >= 12 && t <= 16) || (p2 && t >= 22 && t <= 26)) strike(e, { x0: -6, x1: 66, dy: 14, z0: 0, z1: e.h }, t >= 12 ? 22 : 16, t >= 12 ? 'down' : 'hurt', players());
      if (t === 12 || (p2 && t === 22)) SFX.swing();
      if (t < 8) e.x += e.face * 0.8;
      if (t >= (p2 ? 32 : 22)) end(p2 ? 35 : 65);
      break;
    case 'blink':
      if (t === 1) {
        spawn(e.x, e.y, e.h * 0.5, 22, { c: ['#ff6a9a', '#ffb0c8', '#fff'], add: true, l0: 10, l1: 26 });
        e.x = clamp(hero.x - (hero.face || 1) * 56, cam + 30, cam + W - 30); e.y = clamp(hero.y, Y_MIN, Y_MAX); e.face = sgn(hero.x - e.x) || e.face;
        spawn(e.x, e.y, e.h * 0.5, 22, { c: ['#ff6a9a', '#ffb0c8', '#fff'], add: true, l0: 10, l1: 26 }); SFX.magic();
        e.atk = 'slash'; e.st = 'wind'; e.t = (WINDUP.slash * (p2 ? 0.8 : 1) | 0) - 7;
      }
      break;
    case 'meteor':
      if (t >= 6) end(p2 ? 60 : 90);
      break;
    case 'bite':
      if (t < 8) e.x += e.face * 2.6;
      if (t >= 3 && t <= 7) strike(e, { x0: -20, x1: 104, dy: 18, z0: 0, z1: 80 }, 26, 'down', players());
      if (t === 3) { shake = Math.max(shake, 9); SFX.big(); sparks(e.x + e.face * 80, e.y, 60, false); }
      if (t >= 22) end(p2 ? 40 : 70);
      break;
    case 'tail':
      if (t >= 4 && t <= 9) strike(e, { x0: -110, x1: 110, dy: 20, z0: 0, z1: 40 }, 20, 'down', players());
      if (t === 4) { shake = Math.max(shake, 8); dust(e.x - e.face * 70, e.y, 8); dust(e.x + e.face * 70, e.y, 8); SFX.big(); }
      if (t >= 26) end(p2 ? 40 : 65);
      break;
    case 'breath':
      if (t <= 52) {
        const mx = e.x + e.face * 80, mz = e.z + 75, fc = ['#fff1b0', '#ffb43a', '#ff5a1f'];
        spawn(mx, e.y, mz, 4, { dx: e.face * 3.4, s0: 0.2, s1: 1.0, c: fc, l0: 10, l1: 26, g: 0.01, add: true, size: 3, flat: true });
        spawn(mx, e.y, mz, 3, { dx: e.face * 5.6, s0: 0.2, s1: 0.8, c: fc, l0: 10, l1: 24, g: 0.012, add: true, size: 3, flat: true });
        e.y = clamp(e.y + clamp(hero.y - e.y, -0.3, 0.3), Y_MIN, Y_MAX); // follows the hero slowly, so the stream stays straight
        if (t % 10 === 2) e.hits.clear();
        strike(e, { x0: 40, x1: 190, dy: 14, z0: 0, z1: 80 }, 11, t > 42 ? 'down' : 'hurt', players());
        if (t % 8 === 0) shake = Math.max(shake, 3);
      }
      if (t >= 60) end(p2 ? 45 : 85);
      break;
    case 'flames':
      if (t === 2 || (p2 && t === 12)) { // the flame waves leave the dragon's mouth, in its own lane, and curve into the lanes around the hero
        for (const dy of [-18, 0, 18]) shots.push({ type: 'wave', x: e.x + e.face * 90, y: e.y, ty: clamp(hero.y + dy, Y_MIN, Y_MAX), vy: 1.5, z: 0, vx: e.face * 3, t: 0, dmg: 15, life: 120 });
        spawn(e.x + e.face * 84, e.y, 62, 12, { dx: e.face * 3, s0: 0.3, s1: 1.6, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 22, add: true, size: 3, g: 0.01 }); SFX.big(); }
      if (t >= 22) end(p2 ? 45 : 80);
      break;
    default: end(60);
  }
}
function updateShots() {
  const realHero = hero;
  for (const s of shots) {
    s.t++; hero = nearestPlayer(s.x); hitEl = SHOT_EL[s.type] || null;
    const dx = hero.x - s.x, dy = hero.y - s.y;
    if (s.type === 'orb' || s.type === 'bolt') {
      s.x += s.vx;
      if (s.t % 3 === 0) spawn(s.x, s.y, s.z, 1, { c: s.type === 'bolt' ? '#9ae8ff' : '#7aff9a', s0: 0.05, s1: 0.3, l0: 8, l1: 14, add: true, g: 0 });
      if (!hero.dead && Math.abs(dx) < 10 && Math.abs(dy) < 10 && hero.z < s.z + 10) { hurt(hero, s.dmg, 'hurt', { x: s.x, face: sgn(s.vx) || 1 }); sparks(s.x, s.y, s.z, false); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'arrow') {
      s.x += s.vx; s.y = clamp(s.y + (s.vy || 0), Y_MIN, Y_MAX);
      if (s.t % 2 === 0) spawn(s.x - sgn(s.vx) * 6, s.y, s.z, 1, { c: '#bfe6ff', s0: 0.05, s1: 0.2, l0: 6, l1: 10, add: true, g: 0 });
      if (!hero.dead && Math.abs(dx) < 9 && Math.abs(dy) < 8 && hero.z < s.z + 8) { hurt(hero, s.dmg, 'hurt', { x: s.x, face: sgn(s.vx) || 1 }); sparks(s.x, s.y, s.z, false); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'wave') {
      s.x += s.vx; if (s.ty !== undefined) s.y += clamp(s.ty - s.y, -s.vy, s.vy);
      if (s.t % 2 === 0) spawn(s.x, s.y, 2, 1, { c: ['#ff8a2a', '#ffd070'], s0: 0.1, s1: 0.6, l0: 8, l1: 16, add: true, up: 1, g: 0.04 });
      if (!hero.dead && Math.abs(dx) < 9 && Math.abs(dy) < 10 && hero.z < 12) { hurt(hero, s.dmg, 'down', { x: s.x, face: sgn(s.vx) || 1 }); s.dead = true; }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'meteor') {
      if (s.t === s.delay) {
        shake = Math.max(shake, 8); spawn(s.x, s.y, 4, 22, { s0: 1, s1: 3.2, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 24, add: true, size: 2, up: 3 }); dust(s.x, s.y, 6); SFX.hit();
        if (!hero.dead && Math.abs(dx) < 24 && Math.abs(dy) < 14 && hero.z < 26) hurt(hero, s.dmg, 'down', { x: s.x, face: 1 });
      }
      if (s.t > s.delay + 6) s.dead = true;
    } else if (s.type === 'pwave') {
      s.x += s.vx;
      if (s.t % 2 === 0) spawn(s.x, s.y, 8, 2, { c: ['#fff1b0', '#ffb43a', '#ff5a1f'], s0: 0.2, s1: 0.8, l0: 8, l1: 16, add: true, size: 2, up: 1, g: -0.01 });
      for (const e of enemies) {
        if (e.dead || s.hit.has(e) || Math.abs(e.x - s.x) > 16 || Math.abs(e.y - s.y) > 16) continue;
        s.hit.add(e); const r = rollHit(s.dmg);
        if (r.miss) { floatText(e.x, e.y - e.h * 0.8, 'MISS', '#9aa0b0', 8); continue; }
        if (hurt(e, r.d, 'hurt', s.owner)) floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9, r.crit ? r.d + '!' : String(r.d), r.crit ? '#ffd24a' : '#ffffff', r.crit ? 12 : 8);
      }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'mbolt') { // Panni's arcane bolts: small ones stop at the first foe, the big one pierces
      s.x += s.vx;
      if (s.t % 2 === 0) spawn(s.x - sgn(s.vx) * 4, s.y, s.z, 1, { c: s.big ? ['#ffffff', '#c9a8ff'] : ['#e0d0ff', '#9a7aff'], s0: 0.05, s1: 0.3, l0: 6, l1: 12, add: true, g: 0 });
      for (const e of enemies) {
        if (e.dead || s.hit.has(e) || Math.abs(e.x - s.x) > (s.big ? 16 : 11) || Math.abs(e.y - s.y) > (s.big ? 16 : 12) || e.z > s.z + 6 || e.z + e.h < s.z - 14) continue;
        s.hit.add(e); const o = s.owner, r = rollHit(s.dmg);
        if (r.miss) { floatText(e.x, e.y - e.h * 0.8, 'MISS', '#9aa0b0', 8); } else if (hurt(e, r.d, s.kind, { x: s.x - sgn(s.vx) * 20, face: sgn(s.vx), pn: o.pn, k: o.k,
          get mana() { return o.mana; }, set mana(v) { o.mana = v; } }) && e.blockT !== tickN) floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9,
          r.crit ? r.d + '!' : String(r.d), r.crit ? '#ffd24a' : '#ffffff', r.crit ? 12 : 8);
        spawn(s.x, s.y, s.z, s.big ? 14 : 6, { c: ['#ffffff', '#c9a8ff', '#8a6aff'], l0: 8, l1: 18, add: true });
        if (!s.big) { s.dead = true; break; }
      }
      if (s.t > s.life || s.x < cam - 40 || s.x > cam + W + 40) s.dead = true;
    } else if (s.type === 'rune') { // telegraphed blast, then a burning pool that hurts anyone standing in it
      if (s.t === s.delay) {
        shake = Math.max(shake, 6); spawn(s.x, s.y, 4, 24, { s0: 1, s1: 3.4, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 26, add: true, size: 2, up: 3.2 }); SFX.hit();
        for (const p of players()) if (!p.dead && Math.hypot(p.x - s.x, (p.y - s.y) * 2.4) < s.r + 4 && p.z < 22) hurt(p, s.dmg, 'down', { x: s.x, face: 1 });
      }
      if (s.t > s.delay && (s.t - s.delay) % 30 === 15) for (const p of players()) if (!p.dead && Math.hypot(p.x - s.x, (p.y - s.y) * 2.4) < s.r && p.z < 4 && hurt(p, Math.round(s.dmg * 0.35), 'hurt', { x: s.x, face: 1 })) floatText(p.x, p.y - 52, 'BURNING', '#ff8a2a', 8);
      if (s.t > s.delay && s.t % 4 === 0) spawn(s.x + rnd(-s.r, s.r) * 0.8, s.y + rnd(-6, 6), 2, 1, { c: ['#ffb43a', '#ff5a1f'], s0: 0.1, s1: 0.4, l0: 10, l1: 20, add: true, up: 1.2, g: -0.01 });
      if (s.t > s.delay + s.pool) s.dead = true;
    } else if (s.type === 'ring') {
      s.r += 3.2;
      if (!s.hit && !hero.dead && Math.abs(Math.hypot(dx, dy * 3) - s.r) < 10 && hero.z < 14) { s.hit = true; hurt(hero, s.dmg, 'down', { x: s.x, face: sgn(hero.x - s.x) || 1 }); }
      if (s.r > (s.max || 130)) s.dead = true;
    }
    if ((s.type === 'mbolt' || s.type === 'pwave') && !s.dead && s.hit) for (const c of chests) { // Panni's bolts and the shockwaves open chests too, whatever height they fly at
      if (c.open || s.hit.has(c) || Math.abs(c.x - s.x) > 14 || Math.abs(c.y - s.y) > 14) continue;
      s.hit.add(c); openChest(c); if (s.type === 'mbolt' && !s.big) s.dead = true;
    }
    if (s.type === 'mbolt' && !s.dead && s.hit) for (const sh of shrines) { // ...and so do Panni's bolts
      if (sh.used || s.hit.has(sh) || Math.abs(sh.x - s.x) > 14 || Math.abs(sh.y - s.y) > 14) continue;
      s.hit.add(sh); useShrine(sh); s.dead = true;
    }
  }
  hitEl = null; hero = realHero;
  shots = shots.filter(s => !s.dead);
}
function drawShots() {
  for (const s of shots) {
    const x = Math.round(s.x - cam), y = Math.round(s.y);
    if (s.type === 'pwave') {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, 12, 3, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowEllipse(x, y - 8, 20, 11); g.globalCompositeOperation = 'source-over';
      const fl = Math.sin(tickN * 0.5 + x) * 2; g.fillStyle = '#ff5a1f'; g.fillRect(x - 8, y - 16, 14, 14); g.fillStyle = '#ffb43a'; g.fillRect(x - 5, y - 18 + fl, 10, 12); g.fillStyle = '#fff1b0'; g.fillRect(x - 2, y - 14, 5, 7);
      continue;
    }
    if (s.type === 'arrow') {
      const zz = y - s.z, d = sgn(s.vx) || 1;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, 7, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowDot(g, x, zz, 9, '170,220,255', 0.5); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#5a4030'; g.fillRect(Math.min(x - d * 8, x + d * 3), zz - 1, 11, 2);
      g.fillStyle = '#e8f4ff'; g.beginPath(); g.moveTo(x + d * 8, zz); g.lineTo(x + d * 3, zz - 3); g.lineTo(x + d * 3, zz + 3); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(x - d * 8 - (d < 0 ? 2 : 0), zz - 2, 2, 4);
      continue;
    }
    if (s.type === 'rune') {
      const tl = s.t < s.delay, p = Math.min(1, s.t / s.delay), fade = tl ? 1 : Math.min(1, (s.delay + s.pool - s.t) / 40);
      g.save(); g.globalCompositeOperation = 'lighter';
      if (tl) {
        g.setLineDash([3, 2]); g.strokeStyle = `rgba(255,${120 + (tickN % 6) * 14},40,${0.35 + 0.5 * p})`; g.lineWidth = 1.5; g.beginPath();
          g.ellipse(x, y, s.r, s.r / 2.4, 0, 0, 7); g.stroke(); g.setLineDash([]); g.strokeStyle = `rgba(255,207,90,${0.2 + 0.5 * p})`; g.lineWidth = 0.7; g.beginPath();
          g.ellipse(x, y, s.r * 0.7, s.r * 0.7 / 2.4, 0, 0, 7); g.stroke();
        g.fillStyle = `rgba(255,80,20,${0.08 + 0.22 * p})`; g.beginPath(); g.ellipse(x, y, s.r * p, s.r * p / 2.4, 0, 0, 7); g.fill();
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + tickN * 0.05; g.fillStyle = 'rgba(255,200,90,0.8)'; g.fillRect(Math.round(x + Math.cos(a) * s.r * 0.7) - 1, Math.round(y + Math.sin(a) * s.r * 0.7 / 2.4) - 1, 3, 2); }
      } else {
        const gr = g.createRadialGradient(x, y, 1, x, y, s.r); gr.addColorStop(0, `rgba(255,170,60,${0.55 * fade})`); gr.addColorStop(1, 'rgba(255,60,10,0)');
        g.translate(x, y); g.scale(1, 1 / 2.4); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s.r, 0, 7); g.fill(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = fade; for (let i = 0; i < 5; i++) { const fx = x - s.r * 0.6 + i * s.r * 0.3, fh = 4 + Math.abs(Math.sin(tickN * 0.4 + i * 1.7)) * 7; g.fillStyle = i % 2 ? '#ffb43a' : '#ff5a1f'; g.fillRect(Math.round(fx), Math.round(y - fh + (i % 2) * 2), 3, Math.round(fh)); }
      }
      g.restore(); continue;
    }
    if (s.type === 'mbolt') {
      const zz = y - s.z, r = s.big ? 7 : 4;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, r + 2, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowDot(g, x, zz, r * 3.2, '190,150,255', 0.75); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#e8dcff'; g.fillRect(x - r / 2, zz - r / 2, r, r); g.fillStyle = '#ffffff'; g.fillRect(x - 1, zz - 1, 2, 2);
      continue;
    }
    if (s.type === 'bolt') {
      const zz = y - s.z;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 6, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowDot(g, x, zz, 12, '150,220,255', 0.7); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#2a1a5a'; g.fillRect(x - 3, zz - 3, 6, 6); g.fillStyle = '#e0f8ff'; g.fillRect(x - 2, zz - 2, 3, 3); g.fillStyle = '#b88aff'; g.fillRect(x + 1, zz, 2, 2);
      continue;
    }
    if (s.type === 'orb') {
      const zz = y - s.z;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 6, 2, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, zz, 1, x, zz, 11); gr.addColorStop(0, 'rgba(160,255,190,0.9)'); gr.addColorStop(1, 'rgba(60,200,110,0)'); g.fillStyle = gr; g.fillRect(x - 11, zz - 11, 22, 22); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#0c2a18'; g.fillRect(x - 3, zz - 3, 6, 6); g.fillStyle = '#bfffd0'; g.fillRect(x - 2, zz - 2, 3, 3);
    } else if (s.type === 'wave') {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 11, 3, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter'; glowEllipse(x, y - 3, 14, 6);
      for (let i = 0; i < 4; i++) { const fh = 7 + Math.abs(Math.sin(tickN * 0.5 + i * 1.3)) * 5; g.fillStyle = i % 2 ? '#ffb43a' : '#ff6a1f'; g.fillRect(x - 8 + i * 5, y - fh, 4, fh); }
      g.globalCompositeOperation = 'source-over';
    } else if (s.type === 'meteor') {
      const p = Math.min(1, s.t / s.delay), r = 6 + 16 * p;
      if (s.t < s.delay) { g.strokeStyle = `rgba(255,${80 + (tickN % 8) * 8},40,${0.45 + 0.4 * Math.sin(tickN * 0.5)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, r, r / 3, 0, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,60,20,0.12)'; g.fill(); }
      if (s.t >= s.delay - 12 && s.t < s.delay) {
        const q = (s.t - (s.delay - 12)) / 12, sy2 = lerp(-30, y - 4, q);
        g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,170,60,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 2, sy2 - 40); g.lineTo(x, sy2); g.stroke();
        glowEllipse(x, sy2, 12, 12); g.fillStyle = '#fff1b0'; g.fillRect(x - 3, sy2 - 3, 6, 6); g.globalCompositeOperation = 'source-over';
      }
    } else if (s.type === 'ring') {
      const a = Math.max(0, 1 - s.r / 130);
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,150,50,${0.85 * a})`; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, s.r, s.r / 3, 0, 0, 7); g.stroke();
      g.strokeStyle = `rgba(255,230,160,${0.6 * a})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, s.r - 3, (s.r - 3) / 3, 0, 0, 7); g.stroke(); g.globalCompositeOperation = 'source-over';
    }
  }
}
function glowEllipse(x, y, rx, ry) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, 'rgba(255,170,60,0.55)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore();
}

/* ---------- waves / camera ---------- */
function updateIntro() {
  const I = intro, b = I.e; I.t++;
  if (!b || b.dead) { intro = null; return; }
  const far = Math.abs(I.tx - b.x) > 5; b.x += (I.tx - b.x) * 0.06; b.y += (nearestPlayer(b.x).y - b.y) * 0.05; b.face = sgn(nearestPlayer(b.x).x - b.x) || b.face;
  b.st = far ? 'walk' : 'idle'; if (far) b.anim += 0.12; b.t++;
  if (I.t === 46) { shake = 12; flashA = 0.35; SFX.big(); spawn(b.x, b.y, 30, 30, { s0: 1, s1: 3.4, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 14, l1: 30, add: true, size: 2, up: 2, g: 0.04 }); }
  if (shake > 0) shake *= 0.9;
  updateParts();
  if (I.t >= 150 || (I.t > 60 && (isHit('start') || isHit('atk')))) { intro = null; b.cool = 70; b.st = 'idle'; b.t = 0; shake = 0; }
}
function drawIntro() {
  const I = intro, t = I.t, ease = Math.min(1, t / 20, (150 - t) / 20), h = Math.max(0, Math.round(36 * ease));
  g.fillStyle = '#000'; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h);
  if (t > 28 && t < 138) {
    const a = Math.min(1, (t - 28) / 16, (138 - t) / 14); g.globalAlpha = Math.max(0, a);
    text(((I.e && I.e.k) || KINDS[I.k]).name, W / 2, H - h + 15, 14, '#ff9a5a', 'center'); text(EPI[I.k] || '', W / 2, H - h + 27, 8, '#c9a8ff', 'center'); g.globalAlpha = 1;
  }
}
function buildList(w) { // later stages and cycles throw bigger crowds
  const hasBoss = w.e.some(t => BOSSES[t]), list = w.e.slice(), d = Math.min(9, (stageIdx < 5 ? stageIdx : 4 + Math.round((stageIdx - 4) * 0.35)) + cycle);
  for (let n = 0; n < d && list.length < 9; n++) list.push(hasBoss ? 'h' : (waveIdx % 2 ? 'b' : 'h'));
  if (d >= 2 && !hasBoss && waveIdx >= 2 && list.length < 9) list.push('b');
  return list;
}
function spawnFoe(t, x, hasBoss) {
  const f = makeFighter(t, x, rnd(Y_MIN + 6, Y_MAX - 6)), tn = STAGES[stageIdx].tint;
  if (tn && (t === 'h' || t === 'b')) f.k = Object.assign({}, f.k, tn);
  if (dailyIs('IRON FOES')) { f.hp = f.maxhp = Math.round(f.maxhp * 1.5); }
  if (dailyIs('SWIFT FOES')) f.k = Object.assign({}, f.k, { spd: f.k.spd * 1.2 });
  if (!BOSSES[t] && !hasBoss && (stageIdx >= 2 || cycle) && rq() < 0.05 + 0.01 * Math.min(stageIdx + cycle * 10, 12)) { // elite: bigger, faster, deadlier, better loot
    f.elite = true; f.glow = '255,200,80'; f.hp = f.maxhp = Math.round(f.maxhp * 1.8); f.h = Math.round(f.h * 1.12);
    f.k = Object.assign({}, f.k, { name: 'ELITE ' + f.k.name, scale: f.k.scale * 1.12, spd: f.k.spd * 1.15, armor2: '#ffd24a' });
  }
  if (!BOSSES[t] && !hasBoss && !f.barrier && t !== 'imp' && t !== 'gob' && (stageIdx >= 1 || cycle) && rq() < 0.06 + 0.012 * Math.min(stageIdx + cycle * 10, 15)) { // some foes simply arrive with an arcane barrier (6% to 24%)
    f.barrier = f.bmax = Math.round(f.maxhp * 0.6); f.warded = true;
  }
  enemies.push(f); return f;
}
function updateStage() {
  if (tut) { updateTutorial(); return; }
  if (bonus) { updateBonus(); return; }
  const w = WAVES[waveIdx];
  if (w && lockX === Infinity && leadX() > w.x - 120) {
    lockX = w.x - 200 > cam ? Math.max(cam, w.x - 200) : cam;
    // later stages throw bigger crowds: extra husks, brutes from stage 3, more escorts around bosses
    const hasBoss = w.e.some(t => BOSSES[t]), list = buildList(w); let rode = false;
    seeded('W' + stageIdx + '/' + cycle + '/' + waveIdx, () => list.forEach((t, i) => { // the crowd of a wave (elites, barriers, riders) is fixed by the season seed
      const side = i % 2 ? 1 : -1;
      const ex = offGap(side > 0 ? lockX + W + 30 + i * 22 : lockX - 30 - i * 22, side);
      const f = spawnFoe(t, ex, hasBoss); f.sid = 'w' + waveIdx + '.' + i;
      if (t === 'h' && !rode && ((stageIdx === 0 && !cycle && waveIdx === 0 && i === 0) || rq() < 0.08 + 0.02 * Math.min(stageIdx + cycle, 5))) { rode = true;
        f.mount = makeMount(0, 0, 0, pickMountType()); f.hp = f.maxhp = 60; f.h = f.k.h + 12; } // wyrmlings are rare now: at most one per wave
    }));
    waveN = list.length;
    if (!hasBoss) for (const t of ['warder', 'caller']) if (list.includes(t) && !hints[t]) { hints[t] = 1; msg = t === 'warder' ? 'SHATTER THE BARRIER WITH HEAVY BLOWS' : 'KEEP MOVING: RUNES BURN THE GROUND'; msgT = 150; }
    const bk = w.e.find(t => BOSSES[t]);
    if (bk) {
      bossRef = enemies.find(e => e.kind === bk); SFX.big(); msg = ''; msgT = 0;
      const lx = leadX(), tx = clamp(lx + 170 <= cam + W - 90 ? lx + 170 : lx - 170, cam + 90, cam + W - 90);
      intro = { t: 0, e: bossRef, tx, k: bk }; bossRef.st = 'idle'; bossRef.cool = 9999;
    }
  }
  if (lockX !== Infinity && w && ambW !== waveIdx && (stageIdx >= 1 || cycle) && !w.e.some(t => BOSSES[t])) { // ambush: fresh foes burst in from both sides
    const alive = enemies.filter(e => e.kind !== 'imp' && !e.dead).length;
    if (alive <= Math.max(1, Math.floor(waveN / 3))) {
      ambW = waveIdx; const pool = w.e.filter(t => !BOSSES[t]), n = 2 + (stageIdx >= 15 || cycle ? 1 : 0);
      for (let i = 0; i < n; i++) spawnFoe(pool[(i + waveIdx) % pool.length] || 'h', i % 2 ? cam + W + 30 + i * 18 : cam - 30 - i * 18, false);
      msg = 'AMBUSH!'; msgT = 80; SFX.big(); shake = Math.max(shake, 4);
    }
  }
  if (lockX !== Infinity && enemies.filter(e => e.kind !== 'imp').every(e => e.dead)) {
    lockX = Infinity; waveIdx++; goBlink = 240;
    if (waveIdx >= WAVES.length) { clearT = LOOT_T; msg = 'STAGE CLEAR'; msgT = 150; goBlink = 0; jr('stage'); }
  }
  const target = leadX() - W * 0.42;
  const maxCam = lockX !== Infinity ? lockX : STAGE_END - W;
  cam = clamp(lerp(cam, target, 0.1), cam > maxCam ? maxCam : cam, maxCam);
  if (cam < 0) cam = 0;
  for (const p of players()) { p.x = clamp(p.x, cam + 12, (lockX !== Infinity ? lockX : STAGE_END) + W - 12); p.x = Math.min(p.x, cam + W - 12); }
}

function updateItems() {
  for (const it of items) {
    it.t++;
    { const q = gapAt(it.x, 8); if (q) it.x = it.x < q.x + q.w / 2 ? q.x - 10 : q.x + q.w + 10; }
    if (it.kind === 'vase' || it.kind === 'gear') {
      if (it.z === undefined) { it.z = 8; it.vz = 3; }
      it.z += it.vz; it.vz -= 0.3; if (it.z < 0) { it.z = 0; it.vz = it.vz < -1.2 ? -it.vz * 0.4 : 0; }
    }
    const P = players().find(p => !p.dead && Math.abs(it.x - p.x) <= 16 && Math.abs(it.y - p.y) <= 14 && (it.kind !== 'meat' || p.hp < p.maxhp)); if (!P) continue; // healing stays on the ground while you are at full health
    if (it.kind === 'gear') {
      if (it.t < 14) continue;
      if (!withHero(P, () => pickupGear(it.it))) { if (!it.warn) { it.warn = 1; floatText(P.x, P.y - 60, 'PACK FULL', '#ff6a6a', 8); } continue; }
    } else if (it.kind === 'vase') {
      if (it.t < 14 || P.vases >= 3) continue;
      P.vases++; P.jt = tickN; msg = `EMBER JAR ${P.vases}/3    WRATH +${P.vases * 15}%`; msgT = 100;
    } else P.hp = Math.min(P.maxhp, P.hp + 35);
    it.gone = true; SFX.pick();
    spawn(it.x, it.y, 10, 12, { c: it.kind === 'vase' ? '#8fd0ff' : '#9dffb0', add: true, l0: 14, l1: 24, g: -0.02 });
  }
  items = items.filter(i => !i.gone);
}

const VENT_P = 260;
function updateVents() {
  slashes = slashes.filter(s => ++s.t < (s.big ? 14 : 9));
  for (const v of vents) {
    const t = (tickN + v.ph) % VENT_P;
    if (t === 0) v.hit.clear();
    if (t >= 100 && t < 118) {
      if (Math.abs(v.x - cam - W / 2) > W) continue;
      if (t === 100) { SFX.land(); shake = Math.max(shake, 1); }
      if (t % 2 === 0) spawn(v.x, v.y, 4, 3, { s0: 0.3, s1: 1, c: ['#fff1b0', '#ffb43a', '#ff5a1f'], l0: 10, l1: 22, add: true, size: 2, up: 3.4, g: 0.1 });
      for (const f of [...enemies, ...players()]) {
        if (f.dead || v.hit.has(f) || f.z > 60 || f.mount) continue;
        if (Math.abs(f.x - v.x) < 18 && Math.abs(f.y - v.y) < 10) { v.hit.add(f); hitEl = 'fire'; hurt(f, f.pn ? 9 : 14, 'down', { x: v.x, face: 1, pn: 0 }); hitEl = null; if (f.pn) floatText(f.x, f.y - 50, 'SCORCHED', '#ff8a2a', 8); }
      }
    } else if (t >= 70 && t < 100 && t % 5 === 0 && Math.abs(v.x - cam - W / 2) < W) spawn(v.x, v.y, 2, 1, { s0: 0.2, s1: 0.5, c: '#ffb43a', l0: 8, l1: 14, add: true, size: 1, up: 1, g: 0 });
  }
}
function drawGaps() {
  for (const q of gaps) {
    const x0 = Math.round(q.x - cam), x1 = Math.round(q.x + q.w - cam); if (x1 < -40 || x0 > W + 40) continue;
    const top = Y_MIN - 14;
    if (q.type === 'pit') { // a chasm across the whole road, each theme with its own depth
      const pk = PITK[TH.farK] || PITK.castle, fl = 0.06 * Math.sin(tickN * 0.05 + q.x);
      g.fillStyle = pk.fill; g.fillRect(x0, top, x1 - x0, H - top);
      const gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, `rgba(${pk.glow},0)`); gr.addColorStop(1, `rgba(${pk.glow},${pk.ga + fl})`); g.fillStyle = gr; g.fillRect(x0, top, x1 - x0, H - top);
      if (pk.lava) for (let y = H - 40; y < H; y += 5) { const o = Math.sin(tickN * 0.08 + y * 0.3 + q.x) * 3; g.fillStyle = `rgba(255,${150 + (y - H + 40) * 2},40,${0.22 + (y - H + 40) / 160})`; g.fillRect(x0 + 2 + o, y, x1 - x0 - 4, 2); }
      if (pk.rays) { g.save(); g.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 3; r++) { const rx = x0 + (x1 - x0) * (0.2 + r * 0.3), rg = g.createLinearGradient(0, top, 0, H);
        rg.addColorStop(0, 'rgba(255,225,140,0.14)'); rg.addColorStop(1, 'rgba(255,225,140,0)'); g.fillStyle = rg; g.fillRect(rx - 2, top, 4, H - top); } g.restore(); }
      for (let y = top; y < H; y += 6) {
        const j = ((q.x * 7 + y * 13) % 5) - 2, ax = x0 - 3 + j, bx = x1 - 1 - j;
        g.fillStyle = pk.e1; g.fillRect(ax, y, 4, 5); g.fillRect(bx, y, 4, 5); g.fillStyle = pk.e2; g.fillRect(ax, y, 4, 1); g.fillRect(bx, y, 4, 1); g.fillStyle = pk.e3; g.fillRect(x0 + 1 + j, y, 3, 6); g.fillRect(x1 - 4 - j, y, 3, 6);
        if (pk.moss && ((y / 6) | 0) % 2 === 0) { g.fillStyle = pk.moss; g.fillRect(ax, y + 1, 4, 2); g.fillRect(bx, y + 1, 4, 2); }
      }
      if (((tickN + q.x) % 40) === 0) spawn(q.x + q.w / 2 + rnd(-8, 8), rnd(Y_MIN, Y_MAX), -2, 1, { c: pk.sp, s0: 0.1, s1: 0.3, l0: 20, l1: 40, add: true, up: 0.8, g: -0.01, size: 1 });
    } else { // a rubble barricade
      for (let y = top; y < H; y += 7) {
        const xx = Math.round(x0), hsh = ((q.x * 31 + y * 17) >>> 0) % 7, ht = 14 + hsh;
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(xx - 2, y + 2, q.w + 6, 4);
        g.fillStyle = '#0c0810'; g.fillRect(xx - 1, y - ht - 1, q.w + 2, ht + 6);
        g.fillStyle = hsh % 2 ? '#6a5a5e' : '#5a4c52'; g.fillRect(xx, y - ht, q.w, ht + 4);
        g.fillStyle = '#9a8a8c'; g.fillRect(xx, y - ht, q.w, 2); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(xx + q.w - 3, y - ht, 3, ht + 4); g.fillRect(xx, y - ht + 7, q.w, 1);
        if (hsh % 3 === 0) { g.fillStyle = '#5a3a22'; g.fillRect(xx + 4, y - ht - 8, 2, 9); g.fillStyle = '#c8b08a'; g.fillRect(xx + 4, y - ht - 9, 2, 2); }
      }
    }
  }
}
function drawVentsAndSlashes(top) {
  if (!top) drawGaps();
  if (!top) for (const v of vents) {
    const x = Math.round(v.x - cam); if (x < -30 || x > W + 30) continue;
    const t = (tickN + v.ph) % VENT_P, warn = t >= 60 && t < 100 ? (t - 60) / 40 : 0, on = t >= 100 && t < 118;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(x, v.y, 15, 5, 0, 0, 7); g.fill();
    g.fillStyle = on ? '#fff1b0' : `rgb(${95 + warn * 155 | 0},${34 + warn * 70 | 0},12)`; g.beginPath(); g.ellipse(x, v.y, 11, 3.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#1a0c0a'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, v.y, 13, 4.5, 0, 0, 7); g.stroke();
    if (warn > 0 && (tickN >> 2) & 1) { g.fillStyle = `rgba(255,180,60,${warn * 0.6})`; g.fillRect(x - 1, v.y - 8 - warn * 6, 2, 5); }
    if (on) { const h = 70 * Math.sin((t - 100) / 18 * Math.PI) + 10; const gr = g.createLinearGradient(0, v.y - h, 0, v.y); gr.addColorStop(0, 'rgba(255,120,30,0)');
      gr.addColorStop(0.5, 'rgba(255,170,60,0.85)'); gr.addColorStop(1, 'rgba(255,240,180,0.95)'); g.fillStyle = gr; g.fillRect(x - 6, v.y - h, 12, h); }
  }
  if (top) for (const s of slashes) {
    const k = s.t / (s.big ? 14 : 9), x = s.x - cam, y = s.y - s.z, L = (s.big ? 34 : 22) * (0.6 + k * 0.6);
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.rotate(s.a); g.globalAlpha = 1 - k;
    g.fillStyle = '#fff6c8'; g.fillRect(-L / 2, -1, L, 2); g.fillStyle = '#ffb43a'; g.fillRect(-L / 2 - 4, -2, L + 8, 1); g.fillRect(-L / 2 - 4, 1, L + 8, 1);
    if (s.big) { g.rotate(1.2); g.fillStyle = '#fff1b0'; g.fillRect(-L / 3, -1, L * 0.66, 2); }
    g.restore();
  }
}
function updateParts() {
  updateVents();
  for (const p of parts) { p.life--; if (p.ring) continue; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= p.g; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.7; } }
  parts = parts.filter(p => p.life > 0);
  if (parts.length < 300 && Math.random() < 0.5) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 90), vx: rnd(-0.2, 0.4), vy: 0, vz: rnd(0.1, 0.4), life: rnd(60, 160), max: 160, g: -0.002, c: TH.amb, size: 1, add: true, amb: true });
}

function step() {
  tickN++; flashA *= 0.88; if (flashA < 0.02) flashA = 0;
  pollPad(); musicTick();
  if (mode === 'title') {
    if (resetArm > 0) resetArm--;
    if (pressed.KeyR) { if (resetArm > 0) { rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; PS = null; saveGame(); heroStats(true); resetArm = 0; } else resetArm = 180; }
    else if (isHit('inv')) { openInv('title'); return; }
    else if (pressed.KeyB) { openBoard(0); return; }
    else if (pressed.KeyN) { openBoard(1); return; }
    else if (pressed.KeyC) { openCloud(); return; }
    else if (pressed.Digit2 || pressed.Numpad2) { openSelect(true); return; }
    else if (pressed.Digit3 || pressed.Numpad3 || pressed.KeyT) { openDailyInfo(); return; }
    else if (pressed.Digit4 || pressed.Numpad4 || pressed.KeyG) { openJourney(); return; }
    else if (pressed.Digit5 || pressed.Numpad5 || pressed.KeyH) { startTutorial(() => { }, true); return; }
    else if (isHit('start') || isHit('atk')) { openSelect(false); return; }
    updateParts(); cam += 0.3; return;
  }
  if (mode === 'dailyinfo') { updateDailyInfo(); updateParts(); cam += 0.3; return; }
  if (mode === 'journey') { updateJourney(); updateParts(); cam += 0.3; return; }
  if (mode === 'cloud') { updateCloud(); updateParts(); cam += 0.3; return; }
  if (mode === 'select') { updateSelect(); updateParts(); cam += 0.3; return; }
  if (mode === 'resume') { updateResume(); updateParts(); cam += 0.3; return; }
  if (mode === 'story') { updateStory(); return; }
  if (mode === 'inv') { updateInv(); return; }
  if (mode === 'shop') { updateShop(); return; }
  if (mode === 'forge') { updateForge(); return; }
  if (mode === 'pause') { updatePause(); return; }
  if (mode === 'name') { updateName(); return; }
  if (mode === 'board') { updateBoard(); return; }
  if (mode === 'gameover') {
    endTimer++; updateParts();
    if (endTimer > 30) {
      if (isHit('start')) { if (rpg.coins > 0) { rpg.coins--; continueStage(); } else endRun(false); }
      else if (isHit('back') && rpg.coins > 0) endRun(false);
    }
    return;
  }
  if (mode === 'victory') { endTimer++; victoryFx(); updateParts(); if (endTimer > 90) { if (daily) { if (isHit('start') || isHit('back')) endRun(true); } else if (isHit('start')) nextCycle(); else if (isHit('back')) endRun(true); } return; }
  if (tut && (isHit('pause') || isHit('back'))) { tutFinish(); return; } // ESC skips the training
  if (isHit('pause') && !hero.dead && !dragon) { openPause(); return; }
  if (isHit('inv') && !tut && !hero.dead && !dragon && hero.st !== 'down') { openInv('play'); return; }
  if (intro) { updateIntro(); return; }
  if (freeze > 0) { freeze--; return; }
  if (dragon) { stepDragon(); if (dragon && dragon.t < 62) { updateParts(); return; } }
  if (daily && !daily.done) { daily.t++; if (tickN % 30 === 0) splitTick(); if (tickN % 1800 === 0) loadOnlineBoard(); if (rpg.lvl >= MAX_LV && rpg.pg >= PG_MAX) { dailyWin(); return; } } // only play time counts: shops, pauses and story pages do not
  for (const p of players()) withHero(p, () => updateHero(p));
  enemies.forEach(e => withHero(nearestPlayer(e.x), () => updateEnemy(e))); updateShots(); elemAura(); gearSparks(); updateShrines(); buffFx(); cosFx(); if (!daily && tickN % 60 === 0) jrApply();
  enemies = enemies.filter(e => !(e.dead && e.fade > 50) && !e.gone);
  updateItems(); updateParts(); updateMounts(); updateImpSpawn(); updateStage(); updateFloats(); updateWeather();
  if (shake > 0) shake *= 0.86; if (shake < 0.2) shake = 0;
  if (goBlink > 0) goBlink--; if (msgT > 0) msgT--;
  if (stageCard > 0) stageCard--; if (clearT > 0) { clearT--; if (clearT === 0 || (clearT < LOOT_T - 60 && (pressed.Enter || pressed.TStart))) { clearT = 0; stageCleared(); } }
}

/* ---------- rendering ---------- */
function tileLayer(layer, par, yoff) {
  const ox = -((cam * par) % LAYER_W + LAYER_W) % LAYER_W;
  g.drawImage(layer, Math.round(ox), yoff); g.drawImage(layer, Math.round(ox) + LAYER_W, yoff);
}
const TORCH_GAP = 300;
function torchPositions() { const a = []; const s = Math.floor((cam - 60) / TORCH_GAP); for (let i = s; i < s + 4; i++) a.push(i * TORCH_GAP + 150); return a; }

function addDecal(f) { // a lasting mark where a foe fell: the longer it lies, the fainter it gets
  if (f.pn || f.isMount || f.pitT) return;
  const sc = ((f.k && f.k.scale) || 1) * (isBoss(f) ? 1.8 : 1), dots = [];
  for (let i = 0; i < 5; i++) dots.push({ dx: rnd(-22, 22) * sc, dy: rnd(-4, 4) * sc, r: rnd(1, 2.6) });
  decals.push({ x: f.x, y: f.y, sc, el: ENEMY_EL[f.kind] || null, born: tickN, seed: dots });
  if (decals.length > 36) decals.shift();
}
function drawDecals() {
  const DL = 1500;
  decals = decals.filter(d => tickN - d.born < DL);
  for (const d of decals) {
    const sx = Math.round(d.x - cam); if (sx < -60 || sx > W + 60) continue;
    const age = tickN - d.born, a = Math.min(1, age / 10) * (1 - age / DL), fresh = Math.max(0, 1 - age / 150), y = Math.round(d.y);
    const col = d.el === 'frost' ? '170,225,255' : d.el === 'bolt' ? '255,235,120' : d.el === 'fire' ? '30,10,8' : '60,12,16';
    g.fillStyle = `rgba(${col},${(d.el === 'frost' ? 0.22 : 0.4) * a})`; g.beginPath(); g.ellipse(sx, y, 17 * d.sc, 5 * d.sc, 0, 0, 7); g.fill();
    for (const p of d.seed) { g.fillStyle = `rgba(${col},${0.35 * a})`; g.fillRect(Math.round(sx + p.dx), Math.round(y + p.dy), Math.ceil(p.r), 1); }
    if (fresh > 0 && (d.el === 'fire' || d.el === 'bolt')) { // fresh scorch still glows for a moment
      g.globalCompositeOperation = 'lighter'; g.fillStyle = d.el === 'fire' ? `rgba(255,120,40,${0.28 * fresh})` : `rgba(255,240,140,${0.25 * fresh})`;
      g.beginPath(); g.ellipse(sx, y, 11 * d.sc, 3 * d.sc, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
    }
  }
}
function drawWorld() {
  const T = TH;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  tileLayer(T.skyL, 0.02, 0);
  const M = T.moon;
  if (M.r) {
    const mx = M.x - cam * 0.03 % 500, hg = g.createRadialGradient(mx, M.y, M.r * 0.5, mx, M.y, M.r * 4.6);
    hg.addColorStop(0, `rgba(${M.halo},0.28)`); hg.addColorStop(1, `rgba(${M.halo},0)`);
    g.fillStyle = hg; g.fillRect(mx - M.r * 5, 0, M.r * 10, M.y + M.r * 5);
    g.fillStyle = M.col; g.beginPath(); g.arc(mx, M.y, M.r, 0, 7); g.fill();
    g.fillStyle = M.spot; g.beginPath(); g.arc(mx - M.r * 0.33, M.y - M.r * 0.27, M.r * 0.27, 0, 7); g.fill();
  }
  tileLayer(T.farL, 0.18, 0); tileLayer(T.midL, 0.4, 0); tileLayer(T.wallL, 0.85, 0);
  // floor
  const fg = g.createLinearGradient(0, GROUND_TOP, 0, H);
  fg.addColorStop(0, T.floor[0]); fg.addColorStop(1, T.floor[1]);
  g.fillStyle = fg; g.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
  for (let row = 0; row < 9; row++) {
    const y = GROUND_TOP + 4 + row * row * 1.6 + row * 6, sp = 24 + row * 7;
    g.fillStyle = `rgba(${T.line},0.45)`; g.fillRect(0, y | 0, W, 1);
    const off0 = -((cam % sp) + sp) % sp;
    for (let x = off0 + (row % 2) * sp / 2 - sp; x < W; x += sp) {
      const i = Math.round((x + cam) / sp), hsh = (((i * 73856093) ^ (row * 19349663)) >>> 0) % 100 / 100;
      g.fillStyle = hsh > 0.5 ? `rgba(${T.tile},${(hsh - 0.5) * 0.07})` : `rgba(0,0,0,${(0.5 - hsh) * 0.16})`; g.fillRect(x | 0, y | 0, sp, row * 2 + 6);
      g.fillStyle = `rgba(${T.line},0.45)`; g.fillRect(x | 0, y | 0, 1, row * 2 + 6);
    }
  }
  drawFloorFx(T);
  // torch posts
  for (const tx of torchPositions()) {
    const x = Math.round(tx - cam);
    g.fillStyle = T.post[0]; g.fillRect(x - 2, GROUND_TOP - 40, 4, 40);
    g.fillStyle = T.post[1]; g.fillRect(x - 5, GROUND_TOP - 44, 10, 5);
  }
  // god rays slanting through the hall
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const bx = ((i * 190 + 60 - cam * 0.5) % (W + 260) + W + 260) % (W + 260) - 130, a = 0.035 + 0.015 * Math.sin(tickN * 0.01 + i * 2);
    const gr = g.createLinearGradient(bx, 0, bx + 70, GROUND_TOP); gr.addColorStop(0, `rgba(${T.glow},${a * 2})`); gr.addColorStop(1, `rgba(${T.glow},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx + 26, 0); g.lineTo(bx + 100, GROUND_TOP); g.lineTo(bx + 40, GROUND_TOP); g.fill();
  }
  g.restore();
  drawAirFx(T);
  // hanging chains / vines near the ceiling (parallax 1.15)
  for (let i = -1; i < 7; i++) {
    const wx = (Math.floor(cam * 1.15 / 130) + i) * 130, h = 14 + (((wx * 2654435761) >>> 0) % 40), x = Math.round(wx - cam * 1.15 + 20), sw = Math.sin(tickN * 0.03 + wx) * 1.5;
    g.fillStyle = 'rgba(8,4,12,0.85)';
    for (let y = 0; y < h; y += 4) g.fillRect(Math.round(x + sw * y / h), y, 2, 3);
    g.fillRect(Math.round(x + sw) - 1, h, 4, 4);
  }
}

function drawFog() {
  const T = TH;
  for (let j = 0; j < 7; j++) {
    const sp = j % 2 ? 0.15 : -0.12, x = (((j * 97 - cam * (0.55 + (j % 3) * 0.1) + tickN * sp) % (W + 200)) + W + 200) % (W + 200) - 100, y = GROUND_TOP - 4 + (j % 3) * 9;
    const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, `rgba(${T.fog},${T.fogA})`); gr.addColorStop(1, `rgba(${T.fog},0)`);
    g.save(); g.translate(0, y); g.scale(1, 0.16); g.translate(0, -y); g.fillStyle = gr; g.fillRect(x - 90, y - 90, 180, 180); g.restore();
  }
}
function flame(x, y, s) {
  const t = tickN * 0.3 + x, F = TH.flame;
  g.fillStyle = F[0]; g.fillRect(x - 3 * s, y - 8 * s, 6 * s, 8 * s);
  g.fillStyle = F[1]; g.fillRect(x - 2 * s, y - (9 + Math.sin(t) * 2) * s, 4 * s, 7 * s);
  g.fillStyle = F[2]; g.fillRect(x - 1 * s, y - (6 + Math.sin(t * 1.3)) * s, 2 * s, 4 * s);
}

/* ---------- sprite renderer: shaded, outlined fighters ---------- */
const SW = 230, SH = 230, AX = 115, AY = 170;
const spriteCv = document.createElement('canvas'); spriteCv.width = SW; spriteCv.height = SH; const sg = spriteCv.getContext('2d');
const silCv = document.createElement('canvas'); silCv.width = SW; silCv.height = SH; const sil = silCv.getContext('2d');
const MAIN = g;
const _sh = {};
function shade(hex, a) {
  const key = hex + a; if (_sh[key]) return _sh[key];
  const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255;
  if (a < 0) { r *= 1 + a; gg *= 1 + a; b *= 1 + a; } else { r += (255 - r) * a; gg += (255 - gg) * a; b += (255 - b) * a; }
  return _sh[key] = '#' + ((1 << 24) | (r << 16) | (gg << 8) | b | 0).toString(16).slice(1);
}

/* ---- art pass: tone ramps (cool shadows, warm lights), coloured outlines, elemental rim light ---- */
const _mx = {};
function mixHex(a, b, t) { const key = a + b + t; if (_mx[key]) return _mx[key]; const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const r = (p >> 16 & 255) * (1 - t) + (q >> 16 & 255) * t, gg = (p >> 8 & 255) * (1 - t) + (q >> 8 & 255) * t, bb = (p & 255) * (1 - t) + (q & 255) * t;
  return _mx[key] = '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb | 0).toString(16).slice(1); }
function tone(c, i) { return i === 0 ? mixHex(shade(c, -0.5), '#101830', 0.22) : i === 1 ? c : i === 2 ? mixHex(shade(c, 0.24), '#fff0d0', 0.08) : mixHex(shade(c, 0.58), '#fff6e0', 0.15); } // 0 shadow, 1 base, 2 light, 3 highlight
const olOf = c => mixHex(shade(c, -0.78), '#0a0610', 0.35);
const ELEM_RIM = { fire: '#ff9a4a', frost: '#8fe0ff', bolt: '#ffe66a' };
const BOSS_COL = { boss: '#6affe0', king: '#ff8a2a', witch: '#6aff9a', smith: '#ff8a2a', wyrm: '#ffb43a' };
const OUTL = { nolan: '#141826', panni: '#160c22', luca: '#0d1a12', h: '#141a0e', warder: '#0a121c', caller: '#140808', boss: '#1a1814', king: '#0a0608', witch: '#0a1410', smith: '#140c08' };
const BOSS_GLOW = { boss: [[3, -43, '106,255,224'], [0, -33, '106,255,224']], king: [[0, -28, '255,170,60']], witch: [[2, -46, '106,255,154'], [14, -34, '106,255,154']], smith: [[0, -31, '255,138,42'], [21, -30, '255,138,42']] };
const rimCv = document.createElement('canvas'); rimCv.width = SW; rimCv.height = SH; const rimg = rimCv.getContext('2d');
let wFlare = 0;
function rimOf(f) { // a thin light on the figure's back edge: the hero's element, gold for elites, a boss's own power, an elemental foe's element
  if (f.dead) return null;
  if (f.pn) return rpg.elem && elemTier() ? ELEM_RIM[rpg.elem] : null;
  if (f.elite) return '#e8c060';
  if (BOSSES[f.kind]) return BOSS_COL[f.kind] || null;
  const e = ENEMY_EL[f.kind]; return e ? ELEM_RIM[e] : null;
}

function drawWeapon(g, C, kind, len, gt) {
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  if (kind === 'hero') {
    R(-1.5, -3, 3, 10, '#4a2e1a'); R(-1.5, -3, 1, 10, '#6b4426');
    R(-6, -6, 12, 3, '#c9962e'); R(-6, -6, 12, 1, '#ffe08a'); R(-2.5, 7, 5, 3, '#c9962e');
    const wt = gt | 0, bc = ['#8a8f99', '#a9bdd6', '#8cc4ff', '#ffd870', '#ff7a3a', '#46e06a'][wt], b2 = ['#c8ccd6', '#f4fbff', '#e6f6ff', '#fff6d0', '#fff0a0', '#d8ffe0'][wt], b3 = ['#5a5e68', '#6f86a3', '#4a7ac8', '#c8962e', '#c8401a', '#1a7a3a'][wt];
    P([-2.6, -6, 2.6, -6, 2, -len, 0, -len - 5, -2, -len], bc);
    R(-1.2, -len + 2, 1.6, len - 8, b2); R(1, -len + 2, 1.3, len - 8, b3);
    if (wt >= 2) { g.globalCompositeOperation = 'lighter'; g.fillStyle = wt === 2 ? 'rgba(120,190,255,0.22)' : wt === 3 ? 'rgba(255,220,120,0.26)' : wt >= 5 ? 'rgba(70,224,106,0.3)' : 'rgba(255,120,50,0.3)'; g.fillRect(-4, -len - 4, 8, len); g.globalCompositeOperation = 'source-over'; }
    if (wt >= 4) { const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5; for (let i = 0; i < 4; i++) { const fy = -len + 4 + i * ((len - 12) / 3); P([2.4, fy, 5 + f2 * 2.5, fy - 4 - f2 * 2, 2.4, fy - 7], i % 2 ? (wt >= 5 ? '#46e06a' : '#ff8a2a') : (wt >= 5 ? '#b8ffc8' : '#ffd070')); } }
  } else if (kind === 'pstaff') { // Panni's staff: the crystal glows brighter with rarer weapons
    const wt = gt | 0, gc = ['#b88aff', '#d8d0e8', '#7ab0ff', '#ffd870', '#ff6aa8', '#46e06a'][wt], gl = 0.6 + Math.sin(tickN * 0.2) * 0.4;
    R(-1.2, -len + 2, 2.4, len + 12, '#4a3020'); R(-1.2, -len + 2, 0.8, len + 12, '#6a4a30');
    P([-4, -len + 2, 0, -len - 3, 4, -len + 2, 0, -len + 5], '#c9962e');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(200,170,255,${0.25 + gl * 0.25})`; g.fillRect(-5, -len - 12, 10, 10); g.globalCompositeOperation = 'source-over';
    P([0, -len - 12, 3.5, -len - 6, 0, -len - 1, -3.5, -len - 6], gc); R(-1, -len - 9, 1.5, 3, '#ffffff');
    if (wt >= 4) { const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5; P([-3, -len - 10, 0, -len - 17 - f2 * 3, 3, -len - 10], wt >= 5 ? '#b8ffc8' : '#ffd070'); }
  } else if (kind === 'dagger') {
    const wt = gt | 0, bc = ['#8a8f99', '#a9bdd6', '#8cc4ff', '#ffd870', '#ff7a3a', '#46e06a'][wt];
    R(-1.2, -2, 2.4, 6, '#2a1a12'); R(-3.5, -3, 7, 1.8, '#8a7a5a');
    P([-1.8, -3, 1.8, -3, 1.2, -len, 0, -len - 3, -1.2, -len], bc); R(-0.4, -len + 1, 0.9, len - 4, '#f4fbff');
    if (wt >= 3) { g.globalCompositeOperation = 'lighter'; g.fillStyle = wt === 3 ? 'rgba(255,220,120,0.3)' : wt >= 5 ? 'rgba(70,224,106,0.32)' : 'rgba(255,120,50,0.35)'; g.fillRect(-3, -len - 3, 6, len); g.globalCompositeOperation = 'source-over'; }
  } else if (kind === 'h') {
    R(-1.5, -len + 4, 3, len + 6, '#6b4a2a'); R(-1.5, -len + 4, 1, len + 6, '#8a6238');
    P([1.5, -len, 10, -len - 5, 11, -len + 9, 1.5, -len + 6], '#8a8f99'); P([1.5, -len + 1, 7, -len - 2, 7, -len + 6, 1.5, -len + 5], '#b9bec8'); R(10, -len - 4, 1.4, 12, '#e8edf5');
  } else if (kind === 'mace') { // Marauder's spiked club: held high before the swing
    R(-1.5, -len + 5, 3, len + 5, '#4a3322'); R(-1.5, -len + 5, 1, len + 5, '#6a4a31');
    R(-5, -len - 6, 10, 11, '#5a3e24'); R(-5, -len - 6, 10, 2, '#8a6a48'); R(2, -len - 6, 3, 11, '#3a2816'); R(-5, -len - 1, 10, 1.4, '#2a2a2e');
    P([-5, -len - 4, -9, -len - 2, -5, -len], '#c8c8c0'); P([5, -len - 4, 9, -len - 2, 5, -len], '#a0a098'); P([-2, -len - 6, 0, -len - 11, 2, -len - 6], '#d8d8d0'); P([-2, -len + 5, 0, -len + 9, 2, -len + 5], '#a0a098');
  } else if (kind === 'b') {
    R(-2, -len + 2, 4, len + 8, '#5b3f26'); R(-2, -len + 2, 1.3, len + 8, '#7a5634');
    R(-8, -len - 10, 16, 13, '#6b6f78'); R(-8, -len - 10, 16, 3, '#a2a7b2'); R(-8, -len - 1, 16, 4, '#4a4d55'); R(-3, -len - 10, 6, 13, '#80848e');
    R(-9, -len - 7, 2, 7, '#3a3c42'); R(7, -len - 7, 2, 7, '#3a3c42');
  } else if (kind === 'witch') {
    R(-1.5, -len + 2, 3, len + 8, '#4a3626'); R(-1.5, -len + 2, 1, len + 8, '#6a5036');
    P([-1.5, -len + 2, 5, -len - 4, 8, -len + 2, 4, -len + 6], '#4a3626');
    const gl = 0.6 + Math.sin(tickN * 0.2) * 0.4;
    R(2, -len - 10, 7, 7, `rgb(${60 + gl * 40 | 0},${200 + gl * 55 | 0},${110 + gl * 40 | 0})`); R(3, -len - 9, 3, 3, '#e8fff0'); R(1, -len - 11, 9, 1, '#2a1a30');
  } else if (kind === 'smith') {
    R(-2.5, -len + 2, 5, len + 12, '#4a3626'); R(-2.5, -len + 2, 1.6, len + 12, '#6a5036'); R(-3, 2, 6, 3, '#2a2220');
    R(-12, -len - 14, 24, 18, '#6a707c'); R(-12, -len - 14, 24, 4, '#aab0bc'); R(-12, -len - 3, 24, 4, '#3a3e48'); R(-5, -len - 14, 10, 18, '#7e8490');
    const hh = 0.6 + Math.sin(tickN * 0.25) * 0.4; R(-12, -len - 10, 3, 10, `rgb(255,${100 + hh * 90 | 0},20)`); R(9, -len - 10, 3, 10, `rgb(255,${100 + hh * 90 | 0},20)`);
    R(-13, -len - 8, 1, 6, '#ffd070'); R(12, -len - 8, 1, 6, '#ffd070');
  } else if (kind === 'king') {
    R(-1.8, -3, 3.6, 11, '#2a1c22'); R(-8, -7, 16, 3, '#c9962e'); R(-8, -7, 16, 1, '#ffe08a'); R(-3, 8, 6, 3, '#c9962e');
    P([-3, -7, 3, -7, 2.4, -len, 0, -len - 8, -2.4, -len], '#2a2430'); R(-0.8, -len + 3, 1.6, len - 10, '#ff6a2a'); R(-3, -len + 3, 0.8, len - 10, '#4a4058');
    const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5;
    for (let i = 0; i < 5; i++) { const fy = -len + 6 + i * ((len - 14) / 4); P([2.4, fy, 5.5 + f2 * 2, fy - 4 - f2 * 2, 2.4, fy - 7], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else if (kind === 'bow') {
    g.strokeStyle = C('#6a4a2a'); g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -len - 2); g.quadraticCurveTo(9, -len / 2, 0, 2); g.stroke();
    g.strokeStyle = C('#e8f4ff'); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -len - 2); g.lineTo(0, 2); g.stroke(); R(-1, -len / 2 - 2, 3, 4, '#bfe6ff');
  } else if (kind === 'bomb') {
    g.fillStyle = C('#1c1618'); g.beginPath(); g.arc(0, -6, 6, 0, 7); g.fill(); g.fillStyle = C('#4a4048'); g.beginPath(); g.arc(-2, -8, 2, 0, 7); g.fill();
    g.strokeStyle = C('#a07a4a'); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(4, -17, 2, -20); g.stroke();
    const sp = (tickN >> 1) & 1; R(1, -22, 3, 3, C(sp ? '#fff1b0' : '#ff8a2a'));
  } else if (kind === 'gsword') {
    R(-1.8, -3, 3.6, 11, '#1c1620'); R(-9, -7, 18, 3, '#6a5a9a'); R(-9, -7, 18, 1, '#b8a8ff'); R(-3, 8, 6, 3, '#6a5a9a');
    P([-4, -7, 4, -7, 3.4, -len - 4, 0, -len - 12, -3.4, -len - 4], '#8a8fb0'); R(-1, -len, 2, len - 6, '#d8dcf0'); R(2, -len, 1.4, len - 6, '#5a5e7a');
    const gl2 = 0.5 + Math.sin(tickN * 0.2) * 0.5; R(-0.8, -len + 6, 1.6, 6, `rgb(${150 + gl2 * 80 | 0},${110 + gl2 * 60 | 0},255)`);
  } else if (kind === 'staff' || kind === 'fstaff') {
    const fire = kind === 'fstaff', gl = 0.6 + Math.sin(tickN * 0.25) * 0.4;
    R(-1.2, -len + 2, 2.4, len + 10, '#3a2a22'); R(-1.2, -len + 2, 0.8, len + 10, '#5a4434');
    R(-4, -len - 1, 8, 3, fire ? '#6a2a14' : '#4a3a7a');
    g.fillStyle = C(fire ? `rgb(255,${130 + gl * 90 | 0},40)` : `rgb(${130 + gl * 60 | 0},${210 + gl * 40 | 0},255)`); g.beginPath(); g.arc(0, -len - 5, 3.6, 0, 7); g.fill();
    R(-1, -len - 6, 2, 2, '#ffffff');
    if (fire) { const fh = 7 + gl * 3 + wFlare * 9; P([-3.6, -len - 7, -1.5, -len - 7 - fh * 0.7, 0, -len - 7 - fh, 1.8, -len - 7 - fh * 0.6, 3.6, -len - 7], '#ff7a2a'); P([-2, -len - 7, 0, -len - 7 - fh * 0.62, 2, -len - 7], '#ffd070'); }
  } else if (kind === 'imp') {
    R(-1.5, -3, 3, 6, '#4a3320'); P([-2.5, -3, 2.5, -3, 0, -len - 4], '#cfd4de'); R(-0.5, -len, 1, len - 3, '#ffffff');
  } else {
    R(-2.5, -len + 2, 5, len + 10, '#4a3322'); R(-2.5, -len + 2, 1.6, len + 10, '#6a4a31');
    P([2, -len + 4, 16, -len - 6, 20, -len + 8, 14, -len + 22, 2, -len + 18], '#7f8591'); P([2, -len + 5, 12, -len - 2, 12, -len + 12, 2, -len + 12], '#b7bdc9');
    P([-2, -len + 4, -16, -len - 6, -20, -len + 8, -14, -len + 22, -2, -len + 18], '#5c616c'); P([-2, -len + 6, -12, -len, -13, -len + 10, -2, -len + 14], '#7a808c');
    P([-3, -len + 1, 3, -len + 1, 0, -len - 10], '#cfd4de');
    R(16, -len - 4, 1.6, 22, '#f0f4fb'); R(-17.5, -len - 4, 1.6, 22, '#9aa1ad');
  }
}

function drawHuman(f, sx, sy) {
  const g = sg, k = f.k, sc = k.scale, kind = f.k.look || f.kind, white = f.flash > 0;
  const C = c => white ? '#ffffff' : c;
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const limb = (x0, y0, x1, y1, w, c, bx, by) => {
    const ex = (x0 + x1) / 2 + (bx || 0), ey = (y0 + y1) / 2 + (by || 0);
    g.strokeStyle = C(c); g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.lineTo(x1, y1); g.stroke();
  };
  const dk = c => tone(c, 0), lt = c => tone(c, 2), hi = c => tone(c, 3);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = (f.ghost != null && !f.dead) ? f.ghost : (kind === 'king' && f.st === 'wind' && f.atk === 'blink') ? 0.3 : (f.dead && f.fade > 8) ? Math.max(0, 1 - (f.fade - 8) / 40) : ((f.inv > 0 && f.inv < 100 && (tickN >> 2) & 1 && f.pn && !f.sk) ? 0.45 : 1);
  const brth = BOSSES[kind] && !f.dead ? 1 + Math.sin(tickN * 0.06 + f.x) * 0.018 : f.st === 'idle' && !f.dead ? 1 + Math.sin(tickN * 0.07 + f.x) * 0.012 : 1, hov = kind === 'witch' && !f.dead ? -4 - Math.sin(tickN * 0.07) * 3 : 0;
  const HC = kind === 'hero' ? (k.cls || 'nolan') : '';
  g.save(); g.translate(AX, AY + hov); g.scale(f.face * sc, sc * brth); if (HC === 'luca' && !f.mount && f.st !== 'down') g.scale(1, 0.95); // the rogue moves in a crouch
  const riding = !!f.mount, winding = f.st === 'wind', walking = f.st === 'walk' && !riding;
  const lay = f.st === 'down' && f.z === 0;
  if (lay) { g.rotate(-Math.PI / 2 * 0.92); g.translate(-4, -2); } else if (f.st === 'down') g.rotate(-0.7);
  const air = f.z > 1 && !lay && !riding, ph = f.anim;
  const la = riding ? 5 : air ? 4 : Math.sin(ph) * 5, lb = riding ? -4 : air ? -3 : -Math.sin(ph) * 5;
  const bob = walking ? Math.abs(Math.sin(ph)) * 1.5 : (f.st === 'idle' ? Math.sin(tickN * 0.07) * 0.6 : 0);
  const lean = (winding ? -2 : f.st === 'atk' ? 2 : 0) + ((HC === 'luca' && !riding && !lay) ? 1.5 : 0) + ((f.kind === 'h' && !riding && !lay) ? 2 : 0);
  const big = kind === 'b' || !!BOSSES[kind];
  const GT = (kind === 'hero' && k.gt) || {}, hT = GT.helm | 0, aT = GT.armor | 0, bT = GT.boots | 0, wT = GT.weapon | 0, amT = GT.amulet | 0;
  const ik = (x0, y0, x1, y1, l1, l2, dir) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 0.01, d = Math.min(L, l1 + l2 - 0.05), a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / L, uy = dy / L;
    return [x0 + ux * a - uy * h * dir, y0 + uy * a + ux * h * dir, x0 + ux * d, y0 + uy * d]; };
  const arm2 = (x0, y0, tx, ty, l1, l2, w, cU, cF, dir) => { const [ex, ey, hx, hy] = ik(x0, y0, tx, ty, l1, l2, dir); g.lineCap = 'round'; g.strokeStyle = C(cU);
    g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke(); g.strokeStyle = C(cF); g.lineWidth = w * 0.9; g.beginPath(); g.moveTo(ex, ey);
    g.lineTo(hx, hy); g.stroke(); g.fillStyle = C(cU); g.beginPath(); g.arc(ex, ey, w * 0.55, 0, 7); g.fill(); return [hx, hy, ex, ey]; };
  const chain = (x0, y0, n, len, sway, off, w, c) => { g.strokeStyle = C(c); g.lineCap = 'round'; let x = x0, y = y0, a = 2.5 + (walking ? 0.25 : 0);
    for (let i = 0; i < n; i++) { a += Math.sin(tickN * 0.07 + off + i * 0.7) * sway * 0.25; const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    g.lineWidth = Math.max(0.8, w * (1 - i / n)); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny; } };
  const claw = (hx, hy, ux, uy, len, spread, c, w) => { g.strokeStyle = C(c); g.lineWidth = w; g.lineCap = 'round';
    for (let q = -1; q <= 1; q++) { const ca = Math.cos(q * spread), sa = Math.sin(q * spread); g.beginPath(); g.moveTo(hx, hy);
    g.lineTo(hx + (ux * ca - uy * sa) * len, hy + (ux * sa + uy * ca) * len); g.stroke(); } };
  const bAct = BOSSES[kind] && !f.dead && !winding && !['idle', 'walk', 'hurt', 'down', 'getup', 'wind'].includes(f.st) ? 1 : 0;

  if (kind === 'king' && !f.dead) { // articulated flame wings: shoulder, elbow, wrist and three finger bones, each lagging the one before
    const fl = Math.sin(tickN * 0.11) * 0.5 + (winding ? 0.6 : 0) + (air ? 0.7 : 0);
    for (const [sc2, col, col2, lag] of [[1, 'rgba(200,50,30,0.92)', '#2a0a10', 0], [0.72, 'rgba(255,170,60,0.95)', '#4a1a10', 0.5]]) {
      const r0x = -4, r0y = -34 - bob, a1 = -2.15 + fl * 0.5 - lag * 0.1;
      const ex = r0x + Math.cos(a1) * 18 * sc2, ey = r0y + Math.sin(a1) * 18 * sc2;
      const a2 = a1 - 0.45 + Math.sin(tickN * 0.11 - 0.9 - lag) * 0.4 - (winding ? 0.3 : 0);
      const wx = ex + Math.cos(a2) * 22 * sc2, wy = ey + Math.sin(a2) * 22 * sc2;
      const tips = [0, 1, 2].map(i => { const a3 = a2 + 0.5 + i * 0.62 + fl * 0.15 + Math.sin(tickN * 0.11 - 1.6 - lag - i * 0.4) * 0.12; const L3 = (22 - i * 3) * sc2; return [wx + Math.cos(a3) * L3, wy + Math.sin(a3) * L3]; });
      P([r0x, r0y, ex, ey, wx, wy, tips[0][0], tips[0][1], tips[1][0], tips[1][1], tips[2][0], tips[2][1], -8, -26 - bob], col);
      g.strokeStyle = C(col2); g.lineWidth = 2.2 * sc2 + 0.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(r0x, r0y); g.lineTo(ex, ey); g.lineTo(wx, wy); for (const t of tips) { g.moveTo(wx, wy); g.lineTo(t[0], t[1]); } g.stroke();
      g.fillStyle = C('#ffd070'); for (const t of tips) g.fillRect(t[0] - 1, t[1] - 1, 2, 2);
    }
  }
  // cape (hero) / burning cape (king)
  if (kind === 'king') {
    const sw = Math.sin(tickN * 0.14) * 3 + (walking ? -5 : 0) + (winding ? 3 : 0);
    P([-8 + lean, -37 - bob, 4 + lean, -37 - bob, -2 + sw, -4, -22 + sw, -2], '#2a0a10');
    P([-8 + lean, -37 - bob, -1 + lean, -37 - bob, -8 + sw, -5, -21 + sw, -3], k.cloth);
    for (let i = 0; i < 6; i++) { const fx = -21 + sw + i * 3.6, fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([fx, -3, fx + 2.4, -3, fx + 1.2, -3 - fh], i % 2 ? '#ff8a2a' : '#ffd070'); }
  }
  if (kind === 'hero' && HC === 'nolan') {
    const sw = Math.sin(tickN * 0.12) * 2 + (walking ? -4 : 0) + (air ? -5 : 0) - (f.st === 'atk' ? 2 : 0);
    P([-6 + lean, -35 - bob, 2 + lean, -35 - bob, -3 + sw, -5, -17 + sw, -3], dk(k.cloth));
    P([-6 + lean, -35 - bob, -1 + lean, -35 - bob, -7 + sw, -6, -16 + sw, -4], k.cloth);
    R(-17 + sw, -4, 14, 1, lt(k.cloth)); P([-5 + lean, -34 - bob, -3 + lean, -34 - bob, -8 + sw, -6, -11 + sw, -5], lt(k.cloth));
  }
  if (f.vase) { P([-15, -35 - bob, -8, -35 - bob, -7, -27 - bob, -9, -22 - bob, -14, -22 - bob, -16, -27 - bob], '#3a78c8'); R(-14, -37 - bob, 6, 3, '#e6c97a'); R(-14, -33 - bob, 2, 8, '#bfe6ff'); }
  // back arm
  const bax = -6 + lean, bay = -31 - bob, bhx = -7 + Math.sin(ph + 3) * (walking ? 4 : 1), bhy = -17 - bob;
  if (kind !== 'boss') { limb(bax, bay, bhx, bhy, 4, dk(k.skin), -1, 0); limb(bax, bay, (bax + bhx) / 2, (bay + bhy) / 2, 5, dk(k.armor), -1, 0); }
  if (k.cls === 'luca') { g.save(); g.translate(bhx, bhy); g.rotate(f.st === 'atk' && f.combo % 2 ? -1.4 : (f.st === 'idle' || f.st === 'walk') ? 2.5 : 0.7); drawWeapon(g, C, 'dagger', 11, (k.gt && k.gt.weapon) | 0); g.restore(); }
  if (HC === 'panni' && !white) { const q = tickN * 0.08, ga0 = g.globalAlpha; g.globalAlpha = ga0 * 0.9;
    R(bhx - 6 + Math.sin(q) * 3, bhy - 6 + Math.cos(q * 1.3) * 3, 2, 2, '#c99bff'); R(bhx - 3 + Math.cos(q * 0.9) * 4, bhy - 9 + Math.sin(q) * 2, 1, 1, '#bff0ff');
    R(bhx + 2 + Math.sin(q * 1.4) * 3, bhy - 5 + Math.cos(q) * 3, 1, 3, '#bff0ff'); R(bhx - 8, bhy - 1 + Math.sin(q * 1.1) * 2, 3, 1, '#c99bff'); g.globalAlpha = ga0; }
  if (BOSSES[kind] && !f.dead) { // articulated boss limbs: two-bone arms with follow-through, tendrils and tongs
    const wt = winding ? clamp(f.t / (k.windup || 30), 0, 1) : 0, at = bAct ? clamp(f.t / 9, 0, 1) : 0, wk = walking ? Math.sin(ph) : 0, lp = (a, b, t) => a + (b - a) * t;
    if (kind === 'boss') { // Colossus: a stone back-arm that rises with the swing and crashes down after it
      let tx = -11 - wk * 4, ty = -9 - bob;
      if (winding) { tx = lp(tx, -17, wt); ty = lp(ty, -66, wt) + Math.sin(tickN * 0.8) * wt; } else if (bAct) { tx = lp(-17, 12, at); ty = lp(-66, -6, at * at); }
      const [hx2, hy2] = arm2(-7 + lean, -31 - bob, tx, ty, 15, 16, 9, k.armor, dk(k.skin), -1);
      R(hx2 - 5, hy2 - 5, 10, 10, dk(k.armor)); R(hx2 - 5, hy2 - 5, 10, 2, k.armor2); R(hx2 - 5, hy2 + 3, 10, 2, '#0e0a0c');
    } else if (kind === 'witch') { // Matron: ghostly arms that reach and claw, and living hair tendrils
      const ga = g.globalAlpha;
      for (let i = 0; i < 3; i++) chain(-5 + lean, -44 - bob, 7, 5, 0.5 + i * 0.15, i * 1.7, 2.4 - i * 0.5, k.hair);
      for (const i of [0, 1]) {
        let tx = -22 - i * 6 + Math.sin(tickN * 0.05 + i * 2.1) * 5, ty = -42 + i * 12 + Math.cos(tickN * 0.07 + i) * 6;
        if (winding) { tx = lp(tx, 30, wt); ty = lp(ty, -36 + i * 6, wt); } else if (bAct) { tx = lp(30, 38, at); ty = -30 + i * 6; }
        g.globalAlpha = ga * 0.75;
        const [hx2, hy2, ex, ey] = arm2(-4 - i * 5 + lean, -30 - bob, tx, ty, 14, 16, 3.2, '#4a8a62', '#6aff9a', i ? 1 : -1);
        const L = Math.hypot(hx2 - ex, hy2 - ey) || 1; claw(hx2, hy2, (hx2 - ex) / L, (hy2 - ey) / L, 7, winding ? 0.9 : 0.45, '#caffd8', 1.3);
        g.globalAlpha = ga;
      }
    } else if (kind === 'smith') { // Forgemaster: a mechanical tongs arm that hammers in sync, jaws opening on the windup
      let tx = -15, ty = -19 + Math.sin(tickN * 0.05) * 2 + wk * 3;
      if (winding) { tx = lp(tx, -12, wt); ty = lp(ty, -68, wt); } else if (bAct) { tx = lp(-12, 18, at); ty = lp(-68, -10, at * at); }
      const [hx2, hy2, ex, ey] = arm2(-8 + lean, -33 - bob, tx, ty, 16, 17, 7, '#4a4e58', '#6a707c', -1);
      const L = Math.hypot(hx2 - ex, hy2 - ey) || 1, ux = (hx2 - ex) / L, uy = (hy2 - ey) / L, open = winding ? 0.55 - wt * 0.35 : bAct ? 0.08 : 0.35 + Math.sin(tickN * 0.1) * 0.1;
      for (const sd of [-1, 1]) { const ca = Math.cos(open * sd), sa = Math.sin(open * sd), px = ux * ca - uy * sa, py = ux * sa + uy * ca; g.strokeStyle = C('#8a909c');
        g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx2, hy2); g.lineTo(hx2 + px * 13, hy2 + py * 13); g.stroke();
        R(hx2 + px * 13 - 1.5, hy2 + py * 13 - 1.5, 3, 3, winding || bAct ? '#ff8a2a' : '#c8ccd6'); }
    }
  }
  // legs
  const legs = [[lb, dk(k.cloth), 0.55], [la, k.cloth, 1]];
  for (const [o, c, b] of legs) {
    R(-3 + o * 0.9, -17 - bob, 6, 9, c); R(-3 + o * 0.9 + 3, -17 - bob, 3, 9, dk(c));
    R(-3 + o * 0.5, -9 - bob, 5, 6, c); R(-3 + o * 0.5, -9 - bob, 2, 6, lt(c));
    R(-4 + o * 0.9, -12 - bob, 7, 2, k.armor2); // knee guard
    if (bT) { const BC = [null, ['#4a3624', '#6a4c32', '#8a6a44'], ['#243a5a', '#3a5a8a', '#8cc4ff'], ['#7a5a16', '#c9962e', '#ffe08a'], ['#2a1020', '#4a1a30', '#ff6a2a'], ['#10301a', '#1a5a2e', '#46e06a']][bT];
      R(-4 + o * 0.2, -4, 8, 4, b < 1 ? BC[0] : BC[1]); R(-4 + o * 0.2 + 5, -4, 3, 4, dk(BC[0])); R(-4 + o * 0.2, -4, 8, 1, BC[2]);
      if (bT >= 2) R(-4 + o * 0.5, -9 - bob, 6, 1.5, BC[2]); if (bT >= 3) { R(-4 + o * 0.2 - 2, -5, 2, 2, BC[2]); } }
    else { R(-4 + o * 0.2, -4, 8, 4, b < 1 ? '#0e080c' : '#1c1219'); R(-4 + o * 0.2 + 5, -4, 3, 4, '#2e2230'); R(-4 + o * 0.2, -4, 8, 1, '#3a2c3c'); }
  }
  // tasset / loincloth
  const sw2 = walking ? Math.sin(ph) * 1.5 : 0;
  P([-7 + lean, -19 - bob, 7 + lean, -19 - bob, 6 + sw2, -9, -6 - sw2, -9], dk(k.cloth)); R(-7 + lean, -19 - bob, 14, 2, lt(k.cloth));
  const robe = (c, fl, zig, rs) => { const pts = [-8 + lean, -23 - bob, 8 + lean, -23 - bob]; if (!zig) pts.push(fl + rs, -1.5, -fl - rs, -1.5);
    else for (let i = 0; i <= 8; i++) pts.push(fl - i * fl / 4 + rs * (1 - i / 8), i % 2 ? -4 - ((tickN / 8 | 0) + i) % 2 : -0.5); P(pts, c);
    P([1 + lean, -23 - bob, 8 + lean, -23 - bob, fl + rs, -2, 2 + rs, -2], dk(c));
    P([-8 + lean, -23 - bob, -5 + lean, -23 - bob, -fl * 0.6 - rs, -2, -fl - rs, -2], lt(c)); };
  if (HC === 'panni') { const rs = walking ? Math.sin(ph) * 1.5 : 0, sw3 = Math.sin(tickN * 0.1) * 0.8; robe(k.armor, 14 + sw3, false, rs);
    R(-14 - rs + sw3, -4, 28 + rs * 2, 2, '#e8c060'); R(-14 - rs + sw3, -4, 28 + rs * 2, 0.8, '#fff0a8'); R(-0.5 + lean, -21 - bob, 1, 18, '#e8c060');
    R(-9 - rs, -12, 2, 2, k.armor2); R(7 + rs, -9, 2, 2, k.armor2); }
  if (f.kind === 'warder') { const rs = walking ? Math.sin(ph) * 1.2 : 0; robe(k.armor, 12, false, rs);
    for (let i = -5; i < 5; i += 2) R(i * 2.4 + 1, -3, 3, 1, '#6ad8ff'); R(-3 + lean, -21 - bob, 1, 14, 'rgba(200,216,232,0.55)');
    R(2 + lean, -21 - bob, 1, 14, 'rgba(200,216,232,0.55)'); R(-12 + lean, -27 - bob, 8, 6, '#6a3a22'); R(-12 + lean, -27 - bob, 8, 1, '#e8c060');
    R(-9 + lean, -25 - bob, 3, 1, '#9ae8ff'); }
  if (f.kind === 'caller') { const rs = walking ? Math.sin(ph) * 1.2 : 0; robe(k.armor, 12, true, rs); R(-7 + lean, -23 - bob, 14, 2, '#8a5a2a'); for (let i = 0; i < 4; i++) R(-5 + i * 3.4 + lean, -21 - bob, 1.6, 2, '#e8dcc0'); }
  if (kind === 'witch') { const rs = walking ? Math.sin(ph) * 1.5 : 0; P([-8 + lean, -22 - bob, 8 + lean, -22 - bob, 11 + rs, -2, -11 - rs, -2], k.armor);
    P([-8 + lean, -22 - bob, -2 + lean, -22 - bob, -4 - rs, -2, -11 - rs, -2], dk(k.armor)); R(-11 - rs, -4, 22, 2, k.armor2);
    for (let i = 0; i < 4; i++) R(-8 + i * 5 + rs, -3 - ((i + (tickN / 6 | 0)) % 2), 2, 3, dk(k.armor)); }
  // torso
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, -6 + lean, -18 - bob], k.armor);
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 8 + lean, -31 - bob, -8 + lean, -31 - bob], lt(k.armor));
  P([2 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, 3 + lean, -18 - bob], dk(k.armor));
  R(-1 + lean, -33 - bob, 2, 13, k.armor2); R(-5 + lean, -29 - bob, 10, 1, dk(k.armor)); R(-5 + lean, -25 - bob, 10, 1, dk(k.armor));
  R(-7 + lean, -20 - bob, 14, 3, HC === 'panni' ? tone(k.armor2, 1) : HC === 'nolan' ? '#5a3522' : '#2a1c22'); R(-2 + lean, -20 - bob, 4, 3, '#e6b84a'); R(-2 + lean, -20 - bob, 4, 1, '#fff0a8');
  if (kind === 'boss') { // Colossus: turquoise runes between the stone plates, brighter before a slam
    const rw = 0.5 + Math.sin(tickN * 0.1) * 0.25 + (winding ? clamp(f.t / (k.windup || 30), 0, 1) * 0.7 : 0) + (f.p2 ? 0.2 : 0), rc = mixHex('#1c6a5a', '#9affee', clamp(rw, 0, 1));
    R(-5 + lean, -33 - bob, 4, 1, rc); R(-5 + lean, -33 - bob, 1, 4, rc); R(1 + lean, -30 - bob, 4, 1, rc); R(4 + lean, -30 - bob, 1, 4, rc); R(-3 + lean, -26 - bob, 6, 1, rc); R(-1 + lean, -27 - bob, 1, 3, rc);
    R(-8 + lean, -36 - bob, 4, 2, '#5a7a3a'); R(5 + lean, -36 - bob, 3, 2, '#5a7a3a'); R(-7 + lean, -35 - bob, 1, 1, '#7a9a4a'); R(-4 + lean, -24 - bob, 1, 4, '#2a2620'); R(3 + lean, -22 - bob, 1, 3, '#2a2620');
  } else if (kind !== 'hero' && kind !== 'witch' && kind !== 'smith') { // ember cracks
    const fl = 0.6 + Math.sin(tickN * 0.2 + f.x) * 0.4; g.globalAlpha *= 1; R(-4 + lean, -30 - bob, 1, 5, `rgb(255,${140 + fl * 80 | 0},40)`); R(3 + lean, -27 - bob, 1, 4, `rgb(255,${130 + fl * 80 | 0},40)`); R(-3 + lean, -25 - bob, 3, 1, '#ff9a3a');
  }
  if (f.kind === 'h' && !f.dead) { // Marauder: shaggy fur collar over broad, hunched shoulders
    P([-11 + lean, -33 - bob, -9 + lean, -39 - bob, -6 + lean, -36 - bob, -3 + lean, -40 - bob, 0 + lean, -36.5 - bob, 3 + lean, -40 - bob, 6 + lean, -36 - bob, 9 + lean, -39 - bob, 11 + lean, -33 - bob], '#8a6a48');
    P([0 + lean, -36.5 - bob, 3 + lean, -40 - bob, 6 + lean, -36 - bob, 9 + lean, -39 - bob, 11 + lean, -33 - bob, 1 + lean, -33 - bob], '#6a4e30'); R(-9 + lean, -37 - bob, 5, 1, '#b08a5e');
  }
  if (kind === 'hero') {
    if (HC === 'nolan') { P([-4 + lean, -33 - bob, 0 + lean, -29 - bob, 4 + lean, -33 - bob, 4 + lean, -31 - bob, 0 + lean, -27 - bob, -4 + lean, -31 - bob], '#e8c060');
      R(-8 + lean, -35 - bob, 1, 12, hi(k.armor)); P([-12 + lean, -38 - bob, -5 + lean, -38 - bob, -5 + lean, -31 - bob, -11 + lean, -32 - bob], k.armor2);
      R(-12 + lean, -38 - bob, 7, 1.5, hi(k.armor2)); }
    else if (HC === 'luca') { P([-8 + lean, -35 - bob, -5 + lean, -35 - bob, 8 + lean, -22 - bob, 5 + lean, -22 - bob], '#2a1a10'); R(-1 + lean, -29 - bob, 2.5, 2.5, '#c8c8c8'); R(-7 + lean, -35 - bob, 1, 12, lt(k.armor)); }
    else { R(-6 + lean, -26 - bob, 12, 1, '#e8c060'); R(-6 + lean, -35 - bob, 1, 9, hi(k.armor)); }
  }
  if (kind === 'hero') {
    if (aT >= 1) { const ac = ['', '#b8a888', '#c8d0dc', '#ffe08a', '#ff6a2a', '#46e06a'][aT]; R(-8 + lean, -36 - bob, 16, 1, ac);
      if (aT >= 2) R(-5 + lean, -24 - bob, 10, 1, ac); if (aT >= 3) { P([-9 + lean, -36 - bob, -14 + lean, -42 - bob, -6 + lean, -34 - bob], ac);
      P([9 + lean, -36 - bob, 13 + lean, -41 - bob, 6 + lean, -34 - bob], ac); } }
    if (aT >= 4) { const fl = 0.6 + Math.sin(tickN * 0.2) * 0.4; R(-4 + lean, -30 - bob, 1, 5, flm(aT, 140 + fl * 80 | 0));
      R(3 + lean, -27 - bob, 1, 4, flm(aT, 130 + fl * 80 | 0)); R(-3 + lean, -25 - bob, 1, 3, flm(aT, 150 + fl * 80 | 0));
      if (tickN % 9 === 0 && !f.dead) spawn(f.x - f.face * 4, f.y, 30, 1, { c: aT >= 5 ? ['#9affb8', '#46e06a'] : ['#ffb43a', '#ff6a2a'], s0: 0.1, s1: 0.4, l0: 14, l1: 26, add: true, size: 1, up: 0.8, g: -0.01 });
      }
    if (amT) { const gc = ['', '#cfd4de', '#5a9cff', '#ffb43a', '#ff4a88', '#46e06a'][amT], gl = 0.6 + Math.sin(tickN * 0.15) * 0.4; R(-1.5 + lean, -35 - bob, 3, 3, gc);
      R(-0.5 + lean, -35 - bob, 1, 1, '#fff'); if (amT >= 3) { R(-2.5 + lean, -36 - bob, 5, 1, `rgba(255,255,255,${0.3 + gl * 0.4})`); } }
  }
  if (kind === 'smith') { P([-6 + lean, -28 - bob, 6 + lean, -28 - bob, 7 + lean, -8, -7 + lean, -8], '#5a3a26'); R(-6 + lean, -28 - bob, 12, 2, '#8a5a36');
    R(-5 + lean, -35 - bob, 10, 7, '#140a06'); const ff = 0.6 + Math.sin(tickN * 0.25) * 0.4; R(-4 + lean, -34 - bob, 8, 5, `rgb(255,${90 + ff * 70 | 0},20)`);
    R(-3 + lean, -33 - bob, 6, 2, '#ffd070'); }
  if (kind === 'king') { R(-8 + lean, -37 - bob, 16, 2, '#ff6a2a'); R(-1 + lean, -35 - bob, 2, 16, '#ff6a2a'); const kf = 0.5 + Math.sin(tickN * 0.22) * 0.5; R(-3 + lean, -31 - bob, 6, 6, `rgb(${200 + kf * 55 | 0},${40 + kf * 60 | 0},30)`); R(-2 + lean, -30 - bob, 4, 4, '#fff1b0'); }
  // neck + head
  R(-2 + lean, -39 - bob, 4, 4, dk(k.skin));
  const hx = lean, hy = -bob;
  if (kind === 'hero') {
    const fs = HC === 'luca' ? '#0b1610' : k.skin;
    R(-5 + hx, -48 + hy, 10, 10, fs); R(-5 + hx, -42 + hy, 10, 4, dk(fs)); R(2 + hx, -48 + hy, 3, 10, lt(fs) === fs ? fs : shade(fs, 0.12));
    const tail = Math.sin(tickN * 0.15) * 2 - (walking ? 2 : 0), hc0 = k.cls || 'nolan';
    if (hc0 === 'panni') { // long golden hair under a pointed hat; her helm tier colours the hat
      P([-6 + hx, -49 + hy, -12 + hx + tail, -40 + hy, -13 + hx + tail * 1.4, -27 + hy, -8 + hx + tail, -29 + hy, -5 + hx, -38 + hy], k.hair);
      R(-6 + hx, -49 + hy, 3, 12, k.hair); P([-6 + hx, -48 + hy, 5 + hx, -49 + hy, 6 + hx, -45 + hy, 1 + hx, -47 + hy, -3 + hx, -44 + hy], k.hair);
      R(2 + hx, -44 + hy, 3, 2, '#fff'); R(3 + hx, -44 + hy, 2, 2, '#3a2a6a'); R(2 + hx, -45 + hy, 4, 1, '#1b1b2a'); R(3 + hx, -41 + hy, 2, 1, '#c86a6a');
      const hatc = [k.armor, '#5a4a6a', '#2a4aa8', '#b8862a', '#2a1020', '#10301a'][hT], hatl = ['#ffd24a', '#c0c6d0', '#8cc4ff', '#fff0a8', '#ff6a2a', '#46e06a'][hT];
      P([-10 + hx, -48 + hy, 10 + hx, -48 + hy, 8 + hx, -51 + hy, -8 + hx, -51 + hy], hatc);
      P([-6 + hx, -50 + hy, 6 + hx, -50 + hy, 1 + hx - tail * 0.3, -60 + hy, -6 + hx + tail * 0.8, -65 + hy, -3 + hx, -58 + hy], hatc);
      R(-6 + hx, -52 + hy, 12, 1.5, hatl); R(-6 + hx + tail * 0.8, -66 + hy, 2, 2, hatl); P([2 + hx, -50 + hy, 7 + hx, -49 + hy, 8 + hx, -51 + hy, 2 + hx, -51 + hy], dk(hatc)); R(-8 + hx, -50 + hy, 2, 1, lt(hatc));
      if (hT >= 4) for (let i = -1; i <= 1; i++) { const fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([i * 3 + hx - 1, -52 + hy, i * 3 + hx + 1, -52 + hy, i * 3 + hx, -52 - fh + hy], i ? (hT >= 5 ? '#46e06a' : '#ff8a2a') : (hT >= 5 ? '#b8ffc8' : '#ffd070')); }
    } else if (hc0 === 'luca') { // hooded rogue: deep green hood, dark masked face with glowing eyes, a long scarf that streams behind; the helm tier colours the hood
      const hd = [tone('#26774b', 1), '#3a3a40', '#22407a', '#7a5a1a', '#3a0e1e', '#0e2a16'][hT], hl2 = ['#4a8a62', '#8a8f99', '#5a9cff', '#ffd870', '#ff4a6a', '#46e06a'][hT];
      let qx = -5 + hx, qy = -39 + hy; const spd = walking ? 1 : 0.5 + (air ? 1 : 0); g.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const nx = qx - 3.4 - spd * 0.7, ny = qy + 0.6 + Math.sin(tickN * 0.16 - i * 0.7) * (1 + i * 0.3) * (0.6 + spd * 0.4);
        g.strokeStyle = C(i % 2 ? '#2f8f5a' : '#3aa066'); g.lineWidth = 3.4 - i * 0.2; g.beginPath(); g.moveTo(qx, qy); g.lineTo(nx, ny); g.stroke(); qx = nx; qy = ny; }
      P([-7 + hx, -48 + hy, -13 + hx + tail, -45 + hy, -12 + hx + tail * 1.3, -39 + hy, -6 + hx, -42 + hy], dk(hd));
      P([-7 + hx, -40 + hy, -7 + hx, -51 + hy, -3 + hx, -55 + hy, 4 + hx, -55 + hy, 7 + hx, -50 + hy, 6 + hx, -46 + hy, 1 + hx, -48 + hy, -3 + hx, -46 + hy, -3 + hx, -40 + hy], hd);
      P([2 + hx, -55 + hy, 7 + hx, -50 + hy, 6 + hx, -46 + hy, 1 + hx, -48 + hy], dk(hd)); R(-6 + hx, -52 + hy, 1.5, 9, lt(hd));
      R(-3 + hx, -54 + hy, 6, 1, hl2); R(1 + hx, -42 + hy, 6, 3, '#2f8f5a'); R(1 + hx, -42 + hy, 6, 1, hl2); R(5 + hx, -42 + hy, 2, 3, dk('#2f8f5a'));
      R(1 + hx, -47 + hy, 6, 4, 'rgba(138,255,192,0.3)'); R(2 + hx, -45.5 + hy, 2.6, 1.6, '#d6ffe4'); R(5.2 + hx, -45.5 + hy, 1.8, 1.6, '#d6ffe4');
      if (hT >= 4) { const fl = 0.5 + Math.sin(tickN * 0.3) * 0.5; R(3 + hx, -45 + hy, 2, 1, flm(hT, 120 + fl * 100 | 0)); }
    } else { // Nolan: a closed helm with a gold stripe and a red plume that trails behind him; the helm tier recolours the steel
      const pl = Math.sin(tickN * 0.15) * 2 - (walking ? 2 : 0) - (air ? 2 : 0), hcl = hT ? [null, '#8a8f99', '#4a7ac8', '#d4a62e', '#2a1620', '#10301a'][hT] : '#7189b0',
        hll = hT ? [null, '#c0c6d0', '#8cc4ff', '#fff0a8', '#ff6a2a', '#46e06a'][hT] : '#c9d8ee', plc = k.hair !== '#c4572b' ? k.hair : '#c8303e';
      let qx = -1 + hx, qy = -55 + hy; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const nx = qx - 3.4 + pl * 0.25, ny = qy - 1.6 + i * 1.7 + Math.sin(tickN * 0.15 - i * 0.8) * 0.9; g.strokeStyle = C(i % 2 ? plc : lt(plc)); g.lineWidth = 4.2 - i * 0.6; g.beginPath(); g.moveTo(qx, qy); g.lineTo(nx, ny); g.stroke(); qx = nx; qy = ny; }
      P([-6.5 + hx, -38 + hy, -6.5 + hx, -51 + hy, -3 + hx, -55.5 + hy, 3 + hx, -55.5 + hy, 6.5 + hx, -51 + hy, 6.5 + hx, -38 + hy, 3 + hx, -36 + hy, -3 + hx, -36 + hy], hcl);
      P([1.5 + hx, -55.5 + hy, 6.5 + hx, -51 + hy, 6.5 + hx, -38 + hy, 3 + hx, -36 + hy, 1.5 + hx, -36 + hy], dk(hcl));
      R(-5.5 + hx, -53 + hy, 1.6, 13, hll); R(-6 + hx, -48.5 + hy, 12.5, 1.2, dk(hcl)); R(-0.4 + hx, -55.5 + hy, 1.6, 19.5, '#e8c060');
      R(0 + hx, -46.5 + hy, 6.5, 2.2, '#0e0a10'); R(3.4 + hx, -46.2 + hy, 2.2, 1.4, '#ffcf7a'); R(-3 + hx, -41.5 + hy, 9, 1, dk(hcl)); R(4 + hx, -43 + hy, 1, 1, dk(hcl));
      if (hT >= 4) for (let i = -2; i <= 2; i++) { const fh = 4 + Math.abs(Math.sin(tickN * 0.3 + i)) * 5; P([i * 2.5 + hx - 1.2, -55.5 + hy, i * 2.5 + hx + 1.2, -55.5 + hy, i * 2.5 + hx, -55.5 - fh + hy], i % 2 ? (hT >= 5 ? '#46e06a' : '#ff8a2a') : (hT >= 5 ? '#b8ffc8' : '#ffd070')); }
    }
  } else if (f.kind === 'h') { // Marauder: a small head sunk between broad shoulders, olive skin, red eyes, tusks
    R(-4 + hx, -46 + hy, 9, 8, k.skin); R(1 + hx, -46 + hy, 4, 8, dk(k.skin)); R(-4 + hx, -46 + hy, 1.5, 7, lt(k.skin)); R(-4 + hx, -46 + hy, 9, 2, dk(k.skin));
    P([-5 + hx, -45 + hy, 5 + hx, -45 + hy, 6 + hx, -48 + hy, 2 + hx, -49 + hy, -3 + hx, -48 + hy], k.hair);
    R(-1 + hx, -45.5 + hy, 6, 1, '#1a1a0c'); R(0 + hx, -44 + hy, 2.4, 1.6, '#ff4a3a'); R(3.4 + hx, -44 + hy, 2, 1.6, '#ff4a3a');
    R(-2 + hx, -40.5 + hy, 8, 2, '#1a1a0c'); P([-1 + hx, -40.5 + hy, 0.5 + hx, -43.5 + hy, 2 + hx, -40.5 + hy], '#f0e6c8'); P([3 + hx, -40.5 + hy, 4.5 + hx, -43.5 + hy, 6 + hx, -40.5 + hy], '#f0e6c8');
  } else if (f.kind === 'warder') { // Ash Warder: a faceless blue hood, cold cyan eyes
    P([-7 + hx, -38 + hy, -7 + hx, -50 + hy, -3 + hx, -56 + hy, 3 + hx, -56 + hy, 7 + hx, -50 + hy, 7 + hx, -38 + hy, 3 + hx, -36 + hy, -3 + hx, -36 + hy], '#3a5c84');
    P([2 + hx, -56 + hy, 7 + hx, -50 + hy, 7 + hx, -38 + hy, 3 + hx, -36 + hy, 2 + hx, -36 + hy], '#2e4a6a'); R(-6 + hx, -52 + hy, 1.5, 11, '#6a8ab0');
    R(-3 + hx, -51 + hy, 9, 10, '#0a0f18'); R(-1 + hx, -47 + hy, 2.2, 1.6, '#9ae8ff'); R(3 + hx, -47 + hy, 2.2, 1.6, '#9ae8ff'); R(-1.5 + hx, -47.5 + hy, 3.2, 2.6, 'rgba(154,232,255,0.22)'); R(2.5 + hx, -47.5 + hy, 3.2, 2.6, 'rgba(154,232,255,0.22)');
  } else if (f.kind === 'caller') { // Flame Caller: a horned skull mask over a ragged hood
    P([-5 + hx, -48 + hy, -9 + hx, -53 + hy, -11 + hx, -61 + hy, -6 + hx, -55 + hy, -3 + hx, -49 + hy], '#c8b890'); P([5 + hx, -48 + hy, 9 + hx, -53 + hy, 11 + hx, -61 + hy, 6 + hx, -55 + hy, 3 + hx, -49 + hy], '#a89870');
    P([-6 + hx, -40 + hy, -6 + hx, -50 + hy, -2 + hx, -53 + hy, 4 + hx, -53 + hy, 7 + hx, -49 + hy, 7 + hx, -40 + hy, 3 + hx, -37 + hy, -3 + hx, -37 + hy], '#4a2a26');
    R(-4 + hx, -49 + hy, 9, 10, '#e8dcc0'); R(1 + hx, -49 + hy, 4, 10, '#c8b890'); R(-4 + hx, -49 + hy, 1.5, 9, '#fff4dc');
    R(-3 + hx, -46 + hy, 3, 3, '#1a0806'); R(1 + hx, -46 + hy, 3, 3, '#1a0806'); R(-2 + hx, -45 + hy, 1.4, 1.4, '#ffb03a'); R(2 + hx, -45 + hy, 1.4, 1.4, '#ffb03a'); R(-1 + hx, -42 + hy, 2, 1.4, '#2a2010'); R(-2 + hx, -40 + hy, 5, 1, '#2a2010'); R(0 + hx, -40 + hy, 1, 1, '#e8dcc0');
  } else if (kind === 'h') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-7 + hx, -47 + hy, 7 + hx, -47 + hy, 7 + hx, -41 + hy, 5 + hx, -49 + hy, -5 + hx, -49 + hy, -7 + hx, -41 + hy], k.hair); R(-6 + hx, -50 + hy, 12, 4, k.hair); R(-6 + hx, -50 + hy, 12, 1, lt(k.hair));
    R(1 + hx, -45 + hy, 3, 2, '#ffa23a'); R(1 + hx, -45 + hy, 3, 1, '#ffe08a'); R(-1 + hx, -41 + hy, 7, 1, '#1a1418'); R(0 + hx, -40 + hy, 1, 1, '#ddd'); R(2 + hx, -40 + hy, 1, 1, '#ddd'); R(4 + hx, -40 + hy, 1, 1, '#ddd');
  } else if (kind === 'imp') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-5 + hx, -45 + hy, -13 + hx, -52 + hy, -5 + hx, -41 + hy], k.skin); P([5 + hx, -45 + hy, 13 + hx, -52 + hy, 5 + hx, -41 + hy], dk(k.skin));
    P([-4 + hx, -48 + hy, 0 + hx, -53 + hy, 4 + hx, -48 + hy], k.hair);
    R(0 + hx, -46 + hy, 5, 4, '#ffe27a'); R(3 + hx, -45 + hy, 2, 3, '#1a0a04'); R(-3 + hx, -46 + hy, 3, 3, '#ffe27a');
    R(-1 + hx, -41 + hy, 7, 2, '#2a1408'); R(0 + hx, -41 + hy, 1, 1, '#fff'); R(3 + hx, -41 + hy, 1, 1, '#fff');
  } else if (kind === 'witch') { // Matron: a pale ghostly face, burning green eyes, a thorn-branch crown
    const ew = 0.7 + Math.sin(tickN * 0.2) * 0.3 + (winding ? 0.5 : 0), ec = `rgb(106,${180 + clamp(ew, 0, 1) * 75 | 0},154)`;
    P([-5 + hx, -42 + hy, -9 + hx, -34 + hy, -3 + hx, -38 + hy], k.hair); P([-3 + hx, -41 + hy, -6 + hx, -31 + hy, 0 + hx, -37 + hy], k.hair);
    R(-5 + hx, -48 + hy, 10, 11, k.skin); R(-5 + hx, -42 + hy, 10, 5, dk(k.skin)); R(2 + hx, -48 + hy, 3, 11, lt(k.skin)); R(-5 + hx, -48 + hy, 1.5, 10, hi(k.skin));
    R(-3 + hx, -46 + hy, 3, 3, '#0a1410'); R(2 + hx, -46 + hy, 3, 3, '#0a1410'); R(-2 + hx, -45.5 + hy, 1.6, 1.8, ec); R(3 + hx, -45.5 + hy, 1.6, 1.8, ec); R(-1 + hx, -40 + hy, 4, 1, '#4a6a5a');
    P([-6 + hx, -47 + hy, -8 + hx, -55 + hy, -4 + hx, -50 + hy, -4 + hx, -60 + hy, -1 + hx, -51 + hy, 1 + hx, -62 + hy, 3 + hx, -51 + hy, 6 + hx, -59 + hy, 6 + hx, -50 + hy, 9 + hx, -55 + hy, 7 + hx, -47 + hy], '#3a2a22');
    R(-6 + hx, -48.5 + hy, 13, 2, '#5a4030'); R(-4 + hx, -60 + hy, 1, 1, ec); R(1 + hx, -62 + hy, 1, 1, ec); R(6 + hx, -59 + hy, 1, 1, ec);
  } else if (kind === 'smith') { // Forgemaster: a grimy face, glowing welding goggles, a braided red beard, a small iron cap
    const gg2 = 0.7 + Math.sin(tickN * 0.25) * 0.3 + (winding ? 0.4 : 0), gc = `rgb(255,${180 + clamp(gg2, 0, 1) * 50 | 0},60)`;
    R(-5 + hx, -48 + hy, 11, 11, k.skin); R(2 + hx, -48 + hy, 4, 11, dk(k.skin)); R(-5 + hx, -48 + hy, 1.5, 9, lt(k.skin));
    R(-7 + hx, -47 + hy, 14, 4, '#2a2420'); R(-5 + hx, -46.5 + hy, 4, 3, gc); R(1 + hx, -46.5 + hy, 4, 3, gc); R(-4 + hx, -46 + hy, 1, 1, '#fff6c0'); R(2 + hx, -46 + hy, 1, 1, '#fff6c0');
    P([-6 + hx, -42 + hy, 6 + hx, -42 + hy, 5 + hx, -36 + hy, 2 + hx, -31 + hy, 0 + hx, -29 + hy, -2 + hx, -31 + hy, -5 + hx, -36 + hy], k.hair); P([1 + hx, -42 + hy, 6 + hx, -42 + hy, 5 + hx, -36 + hy, 2 + hx, -31 + hy, 0 + hx, -29 + hy, 0 + hx, -40 + hy], dk(k.hair));
    for (let i = 0; i < 3; i++) R(-1 + hx, -39 + i * 3 + hy, 2, 1, hi(k.hair));
    R(-6.5 + hx, -53 + hy, 13, 6, '#5a5e68'); R(-6.5 + hx, -53 + hy, 13, 1.5, '#9aa1ad'); R(2 + hx, -53 + hy, 4.5, 6, '#3a3e48'); R(-1 + hx, -57 + hy, 3, 4, '#3a3e48');
  } else if (kind === 'king') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-6 + hx, -47 + hy, 6 + hx, -47 + hy, 6 + hx, -39 + hy, 3 + hx, -37 + hy, -3 + hx, -37 + hy, -6 + hx, -39 + hy], '#1a1620'); R(-5 + hx, -48 + hy, 11, 6, '#1a1620');
    R(1 + hx, -45 + hy, 4, 2, '#ff6a2a'); R(2 + hx, -45 + hy, 2, 1, '#fff1b0'); R(-4 + hx, -45 + hy, 3, 2, '#c8401a');
    R(-6 + hx, -50 + hy, 12, 3, '#c9962e');
    for (let i = -2; i <= 2; i++) { const ch = 6 + (2 - Math.abs(i)) * 2;
      P([i * 3 + hx - 1.5, -50 + hy, i * 3 + hx + 1.5, -50 + hy, i * 3 + hx, -50 - ch + hy], '#3a3040'); const fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4;
      P([i * 3 + hx - 1.2, -50 - ch + hy, i * 3 + hx + 1.2, -50 - ch + hy, i * 3 + hx, -50 - ch - fh + hy], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else if (kind === 'boss') { // Colossus: a tiny carved head sunk into huge shoulders, one turquoise eye
    const ew = 0.6 + Math.sin(tickN * 0.1) * 0.25 + (winding ? clamp(f.t / (k.windup || 30), 0, 1) * 0.8 : 0) + (f.p2 ? 0.2 : 0);
    R(-4 + hx, -46 + hy, 9, 9, '#8a847a'); R(1 + hx, -46 + hy, 4, 9, '#6e685e'); R(-4 + hx, -47 + hy, 9, 1.5, '#a6a094'); R(-4 + hx, -46 + hy, 1.5, 8, '#a6a094');
    R(-2 + hx, -43 + hy, 6, 3, '#121010'); R(0 + hx, -42.5 + hy, 2.4, 2.2, mixHex('#1c8a78', '#b8fff0', clamp(ew, 0, 1))); R(-4 + hx, -38 + hy, 9, 1, '#2a2620'); R(3 + hx, -46 + hy, 1, 3, '#2a2620'); R(-4 + hx, -47.5 + hy, 3, 1.5, '#5a7a3a');
  } else { // helmeted: brute & guard & knight
    const hm = kind === 'boss' ? '#3b3640' : '#5a5660';
    R(-6 + hx, -49 + hy, 12, 12, k.skin); R(-6 + hx, -49 + hy, 12, 12, dk(k.skin));
    P([-7 + hx, -39 + hy, -7 + hx, -50 + hy, -3 + hx, -54 + hy, 3 + hx, -54 + hy, 7 + hx, -50 + hy, 7 + hx, -39 + hy, 4 + hx, -43 + hy, -4 + hx, -43 + hy], hm);
    P([-7 + hx, -50 + hy, -3 + hx, -54 + hy, 3 + hx, -54 + hy, 7 + hx, -50 + hy, 7 + hx, -48 + hy, -7 + hx, -48 + hy], lt(hm));
    R(-1 + hx, -54 + hy, 2, 11, dk(hm));
    R(1 + hx, -47 + hy, 5, 2, '#ffa23a'); R(1 + hx, -47 + hy, 5, 1, '#fff0a8'); R(-5 + hx, -47 + hy, 3, 2, '#c8681f');
    const hn = kind === 'boss' ? 1.6 : 1;
    P([-6 + hx, -50 + hy, -10 * hn + hx, -54 * (kind === 'boss' ? 1.1 : 1) + hy, -14 * hn + hx, -62 * (kind === 'boss' ? 1.15 : 1) + hy, -8 * hn + hx, -56 * (kind === 'boss' ? 1.05 : 1) + hy, -4 + hx, -52 + hy], '#e6dcc4');
    P([6 + hx, -50 + hy, 10 * hn + hx, -54 * (kind === 'boss' ? 1.1 : 1) + hy, 14 * hn + hx, -62 * (kind === 'boss' ? 1.15 : 1) + hy, 8 * hn + hx, -56 * (kind === 'boss' ? 1.05 : 1) + hy, 4 + hx, -52 + hy], '#bfb49a');
    R(-3 + hx, -41 + hy, 8, 3, dk(hm));
  }
  if (f.kind === 'archer') { P([-7 + hx, -47 + hy, -7 + hx, -53 + hy, -2 + hx, -57 + hy, 3 + hx, -55 + hy, 7 + hx, -49 + hy, 7 + hx, -44 + hy, 5 + hx, -48 + hy, -4 + hx, -49 + hy], k.cloth);
    R(-7 + hx, -47 + hy, 3, 10, dk(k.cloth)); R(-5 + hx, -40 + hy, 10, 3, k.armor2); R(-9 + lean, -36 - bob, 5, 14, '#5a4030'); R(-9 + lean, -37 - bob, 5, 2, '#e8f4ff');
    }
  if (f.kind === 'bomber') { R(-5 + hx, -48 + hy, 10, 1, '#3a2a1a'); R(-3 + hx, -47 + hy, 3, 3, '#ffcf3a'); R(1 + hx, -47 + hy, 3, 3, '#ffcf3a');
    R(-15 + lean, -35 - bob, 8, 10, '#3a2a1a'); R(-15 + lean, -35 - bob, 8, 2, '#6a4a2a'); R(-13 + lean, -38 - bob, 2, 3, ((tickN >> 1) & 1) ? '#fff1b0' : '#ff8a2a'); }
  if (f.kind === 'knight') { const pw = Math.sin(tickN * 0.13) * 2 - (walking ? 2 : 0); P([-1 + hx, -54 + hy, -9 + hx + pw, -62 + hy, -15 + hx + pw * 1.5, -52 + hy, -3 + hx, -52 + hy], '#8a6aff'); R(1 + hx, -47 + hy, 5, 2, '#d8c0ff'); R(-5 + lean, -36 - bob, 10, 1, '#8a6aff'); }
  // front arm + weapon
  let ang = 0.5;
  if (winding) ang = -2.1 - Math.min(0.4, f.t / (k.windup || 20) * 0.4);
  else if (f.st === 'eatk') ang = lerp(-2.0, 1.4, clamp(f.t / 5, 0, 1));
  else if (f.st === 'atk') { const c = comboOf(f)[f.combo] || COMBO[0]; const p = clamp((f.t - 1) / (c.b - 1), 0, 1); ang = f.k.cls === 'panni' ? lerp(-1.2, 1.2, p) : f.combo % 2 === 1 ? lerp(1.6, -1.8, p) : lerp(-2.2, 1.5, p); }
  else if (f.st === 'jatk') ang = 2.3;
  else if (f.st === 'ratk') ang = 1.3;
  else if (f.st === 'magic') ang = -2.6;
  else if (walking) ang = 0.5 + Math.sin(ph) * 0.15;
  const shx = 5 + lean, shy = -32 - bob, hl = 11, bl = k.wlen;
  const hxp = shx + Math.sin(ang) * hl, hyp = shy - Math.cos(ang) * hl;
  limb(shx, shy, hxp, hyp, big ? 6 : 5, k.skin, -Math.cos(ang) * 2, -Math.sin(ang) * 2);
  limb(shx, shy, (shx + hxp) / 2, (shy + hyp) / 2, big ? 7 : 6, k.armor, 0, 0);
  R(hxp - 2, hyp - 2, 4, 4, C(dk(k.skin)) === '#ffffff' ? '#fff' : k.skin);
  if (kind === 'boss') { R(hxp - 4.5, hyp - 4.5, 9, 9, k.skin); R(hxp - 4.5, hyp - 4.5, 9, 2, hi(k.skin)); R(hxp - 4.5, hyp + 2, 9, 2.5, dk(k.skin)); R(hxp - 1, hyp - 4, 1, 8, '#2a2620'); }
  wFlare = winding ? clamp(f.t / (k.windup || 30), 0, 1) : 0;
  g.save(); g.translate(hxp, hyp); g.rotate(ang + (HC === 'luca' && !winding && !['atk', 'jatk', 'ratk', 'eatk', 'magic'].includes(f.st) ? 2.5 : 0)); drawWeapon(g, C, f.k.wk || kind, bl, wT);
  if (k.wup >= 3 && !white) { const a = 0.08 * (k.wup - 2) + Math.sin(tickN * 0.2) * 0.05; g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,${200 - k.wup * 10},120,${a})`; g.fillRect(-4, -bl - 6, 8, bl + 4); g.globalCompositeOperation = 'source-over'; }
  g.restore();
  // front pauldron
  if (!(f.p2 && BOSSES[kind] && kind !== 'witch')) { P([shx - 5, shy - 4, shx + 5, shy - 4, shx + 6, shy + 3, shx - 4, shy + 3], k.armor2); R(shx - 5, shy - 4, 11, 1.5, lt(k.armor2)); R(shx - 4, shy + 1, 10, 2, dk(k.armor2)); }
  if (kind === 'smith') { R(shx - 3, shy - 17, 5, 13, '#3a3e48'); R(shx - 4, shy - 18, 7, 2, '#5c616c'); R(-12 + lean, -52 - bob, 5, 15, '#3a3e48'); R(-13 + lean, -53 - bob, 7, 2, '#5c616c'); }
  if (kind === 'b' || kind === 'boss') { P([shx + 4, shy - 4, shx + 9, shy - 11, shx + 6, shy - 2], '#d8d0c0'); P([-9 + lean, -37 - bob, -14 + lean, -45 - bob, -6 + lean, -34 - bob], '#d8d0c0'); }
  g.restore();

  // outline: dark silhouette stamped in 4 directions, then the sprite on top
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.globalCompositeOperation = 'source-over'; sil.clearRect(0, 0, SW, SH); sil.globalAlpha = 1;
  sil.drawImage(spriteCv, 0, 0); sil.globalCompositeOperation = 'source-in'; sil.fillStyle = OUTL[HC || f.kind] || olOf(k.armor); sil.fillRect(0, 0, SW, SH);
  const x0 = Math.round(sx) - AX, y0 = Math.round(sy - f.z) - AY;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) MAIN.drawImage(silCv, x0 + dx, y0 + dy);
  const rim = rimOf(f);
  if (rim) { rimg.setTransform(1, 0, 0, 1, 0, 0); rimg.globalCompositeOperation = 'source-over'; rimg.globalAlpha = 1; rimg.clearRect(0, 0, SW, SH);
    rimg.drawImage(spriteCv, 0, 0); rimg.globalCompositeOperation = 'source-in'; rimg.fillStyle = rim; rimg.fillRect(0, 0, SW, SH); MAIN.save();
    MAIN.globalAlpha = (BOSSES[f.kind] ? 0.7 : 0.95) * (0.85 + 0.15 * Math.sin(tickN * 0.12 + f.x)); MAIN.drawImage(rimCv, x0 - f.face, y0); MAIN.restore(); }
  MAIN.drawImage(spriteCv, x0, y0);

  if (BOSSES[kind] && !f.dead && f.st !== 'down') { // boss secondary motion
    const bx = Math.round(sx), by = Math.round(sy - f.z + hov);
    const bgl = BOSS_GLOW[kind];
    if (bgl) { const wt2 = winding ? clamp(f.t / (k.windup || 30), 0, 1) : bAct ? 0.5 : 0, pw = 0.12 + 0.05 * Math.sin(tickN * 0.1) + wt2 * 0.5 + (f.p2 ? 0.12 : 0);
      MAIN.globalCompositeOperation = 'lighter';
      for (const [lx, ly, rgb] of bgl) glowDot(MAIN, bx + lx * f.face * sc, by + ly * sc * brth, (7 + wt2 * 13) * sc * 0.6 + 6, rgb, pw);
      MAIN.globalCompositeOperation = 'source-over'; }
    if (kind === 'witch') for (let i = 0; i < 4; i++) { const a = tickN * 0.05 + i * 1.57; MAIN.globalCompositeOperation = 'lighter';
      MAIN.fillStyle = 'rgba(150,255,190,0.85)'; MAIN.fillRect(bx + Math.cos(a) * 26 * sc, by - 34 * sc + Math.sin(a * 1.4) * 14, 3, 3);
      MAIN.fillStyle = 'rgba(150,255,190,0.25)'; MAIN.fillRect(bx + Math.cos(a - 0.3) * 26 * sc - 1, by - 34 * sc + Math.sin((a - 0.3) * 1.4) * 14 - 1, 5, 5);
      MAIN.globalCompositeOperation = 'source-over'; }
    if (kind === 'smith' && tickN % 4 === 0) spawn(f.x - f.face * 8, f.y, 40 * sc, 1, { s0: 0.1, s1: 0.4, c: ['#8a8a92', '#5a5a64', '#ffb43a'], l0: 18, l1: 34, size: 2, up: 1.1, g: -0.01, add: false });
    if (kind === 'boss' && f.st === 'walk' && Math.abs(Math.sin(f.anim)) < 0.08 && tickN % 10 < 2) { dust(f.x, f.y, 5); shake = Math.max(shake, 1.2); }
  }
  // swing trail on the main canvas
  const swinging = (f.st === 'atk' && f.k.cls !== 'panni' && f.t >= (comboOf(f)[f.combo] || COMBO[0]).a && f.t <= (comboOf(f)[f.combo] || COMBO[0]).b + 4) || (f.st === 'eatk' && f.t < 9) || f.st === 'jatk';
  if (swinging) {
    MAIN.save(); MAIN.translate(Math.round(sx), Math.round(sy - f.z)); MAIN.scale(f.face * sc, sc); MAIN.globalCompositeOperation = 'lighter';
    const a0 = f.st === 'atk' && f.combo === 1 ? 1.6 : -2.0;
    for (let w = 0; w < 3; w++) { MAIN.strokeStyle = f.pn ? `rgba(${120 + w * 40},${200 + w * 18},255,${0.28 - w * 0.07})` : `rgba(255,${130 + w * 30},50,${0.26 - w * 0.07})`;
      MAIN.lineWidth = 9 - w * 3; MAIN.beginPath(); MAIN.arc(shx, shy, hl + bl * 0.85, a0 - Math.PI / 2, ang - Math.PI / 2, ang < a0); MAIN.stroke(); }
    MAIN.restore();
  }
}

function drawFighter(f) {
  drawFighter0(f); const S = f.el; if (!S || f.dead || f.pitT) return;
  const sx = Math.round(f.x - cam), by = Math.round(f.y - f.z), hh = f.h || 40, ww = Math.round(15 * ((f.k && f.k.scale) || 1)) + 3;
  if (S.burn > 0) { g.globalCompositeOperation = 'lighter'; glowDot(g, sx, by - hh * 0.45, hh * 0.55, '255,130,40', 0.22 + 0.06 * Math.sin(tickN * 0.4)); g.globalCompositeOperation = 'source-over'; }
  if (S.chill > 0 && !(S.frz > 0)) { g.globalCompositeOperation = 'lighter'; glowDot(g, sx, by - hh * 0.45, hh * 0.5, '120,210,255', 0.2); g.globalCompositeOperation = 'source-over'; }
  if (S.frz > 0) { // frozen: the figure itself turns icy blue, so the effect always fits the sprite
    g.globalCompositeOperation = 'lighter'; glowDot(g, sx, by - hh * 0.45, hh * 0.6, '120,210,255', 0.3); g.globalCompositeOperation = 'source-over';
    if ('filter' in g) { g.save(); g.filter = 'sepia(1) hue-rotate(160deg) saturate(2.4) brightness(1.3)'; g.globalAlpha = 0.65; drawFighter0(f); g.restore(); }
    g.fillStyle = '#e8faff'; for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3, r = ww * 0.9; g.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(by - hh * 0.5 + Math.sin(a) * hh * 0.45), 2, 3); }
  }
  if (S.stun > 0 && tickN % 4 < 2) { g.fillStyle = '#fff6a0'; for (let i = 0; i < 3; i++) g.fillRect(sx - 8 + i * 8 + ((tickN >> 1) % 3), by - hh - 4 - (i % 2) * 3, 3, 2); }
}
function drawFighter0(f) {
  if (f.pitT) { // tumbling into a chasm
    g.save(); g.beginPath(); g.rect(0, 0, W, f.pitY - 2); g.clip(); g.globalAlpha = clamp(1 - f.pitT / 30, 0, 1);
    const sv = f.pitT, y0 = f.y; f.pitT = 0; f.y = y0 + sv * sv * 0.12; drawFighter0(f); f.y = y0; f.pitT = sv; g.restore(); return;
  }
  const sx = f.x - cam, sy = f.y;
  if (f.isMount) { drawWildMount(f, sx, sy); return; }
  if (f.kind === 'wyrm') { drawWyrm(f, sx, sy); return; }
  const sh = clamp(1 - f.z / 90, 0.3, 1) * f.k.scale * (f.mount ? 1.7 : 1);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 12 * sh, 4 * sh, 0, 0, 7); g.fill();
  if (!f.pn && !f.dead && ENEMY_EL[f.kind]) { const E = ELEM[ENEMY_EL[f.kind]]; g.strokeStyle = `rgba(${E.rgb},${0.38 + 0.12 * Math.sin(tickN * 0.1 + f.x)})`;
    g.lineWidth = 1; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 14 * sh, 5 * sh, 0, 0, 7); g.stroke();
    } // the ring shows what a foe is made of: fire, frost or lightning
  if (f.glow && !f.dead) { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy) - 2, 26 + Math.sin(tickN * 0.1) * 3, f.glow, 0.32); g.globalCompositeOperation = 'source-over'; }
  if (f.mount) {
    drawDragon(sx, sy - f.z, mountLook(f.mount, { face: f.face, anim: f.anim, flash: f.flash, moving: f.st === 'walk', breathe: f.st === 'ratk' || f.jf > 0 || f.st === 'wind' || f.st === 'eatk' }));
    drawHuman(f, sx, sy - 11);
  } else {
    const hv = f.hov || 0, ai = f.k.ai;
    if (ai === 'wisp' && !f.dead) { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy - hv - 20), 22, '120,255,190', 0.35); g.globalCompositeOperation = 'source-over'; }
    if (ai === 'wraith' && !f.dead) { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy - 24), 24, '255,230,150', 0.3); g.globalCompositeOperation = 'source-over'; }
    if (ai === 'runner' && f.st === 'eatk') { g.globalCompositeOperation = 'lighter'; glowDot(g, Math.round(sx), Math.round(sy - 18), 22, '255,140,40', 0.5); g.globalCompositeOperation = 'source-over'; }
    drawHuman(f, sx, sy - hv);
    if (f.barrier > 0 && !f.dead) {
      const a = 0.25 + 0.35 * f.barrier / (f.bmax || 1) + (f.bflash > 0 ? 0.3 : 0), bx = Math.round(sx), by = Math.round(sy - f.z - f.h * 0.5 - hv), rx = 15 * f.k.scale + 4, ry = f.h * 0.62;
      if (f.bflash > 0) f.bflash--;
      g.save(); g.globalCompositeOperation = 'lighter';
      const hexP = (r1, r2) => { g.beginPath(); for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3 - Math.PI / 2, px = bx + Math.cos(t) * r1, py = by + Math.sin(t) * r2; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); };
      hexP(rx, ry); g.fillStyle = `rgba(106,216,255,${a * 0.1})`; g.fill(); g.strokeStyle = `rgba(154,232,255,${a})`; g.lineWidth = 1.3; g.stroke();
      hexP(rx - 4, ry - 4); g.strokeStyle = `rgba(154,232,255,${a * 0.35})`; g.lineWidth = 0.7; g.stroke();
      const nc = Math.floor((1 - f.barrier / (f.bmax || 1)) * 5 + (f.bflash > 0 ? 1 : 0)); g.strokeStyle = `rgba(255,255,255,${Math.min(1, a * 1.6)})`; g.lineWidth = 0.8;
      for (let i = 0; i < nc; i++) { const t0 = i * 1.9 + 0.4, ux = Math.cos(t0), uy = Math.sin(t0); g.beginPath(); g.moveTo(bx + ux * rx * 0.96, by + uy * ry * 0.96);
        g.lineTo(bx + ux * rx * 0.72 - uy * 3, by + uy * ry * 0.72 + ux * 3); g.lineTo(bx + ux * rx * 0.55 + uy * 3, by + uy * ry * 0.55 - ux * 3);
        g.lineTo(bx + ux * rx * 0.3, by + uy * ry * 0.3); g.stroke(); }
      g.restore();
    }
    if (ai === 'guard' && !f.dead) { const bx = Math.round(sx + f.face * 15), by = Math.round(sy - 30); g.fillStyle = '#0a0610'; g.fillRect(bx - 5, by - 2, 10, 30);
      g.fillStyle = '#3a2a5a'; g.fillRect(bx - 4, by - 1, 8, 28); g.fillStyle = '#c87aff'; g.fillRect(bx - 4, by - 1, 8, 2); g.fillRect(bx - 1, by + 4, 2, 18);
      g.fillStyle = '#6a4a9a'; g.fillRect(bx - 4, by + 24, 8, 3); }
  }
  if (f.st === 'wind' && (tickN >> 1) & 1) { g.fillStyle = '#ff3b2a'; g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h * 1.0 - 8), 3, 6); g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - f.h - 1), 3, 2); }
}

function mountLook(m, o) { const T = mtype(m); o.type = (m && m.type) || 'ember'; if (T.sc !== 1) o.sc = T.sc; if (T.pal) o.pal = T.pal; if (T.wings) o.wings = true; if (T.horns) o.horns = true; return o; }
function drawWildMount(m, sx, sy) {
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 20, 5, 0, 0, 7); g.fill();
  drawDragon(sx, sy - m.z, mountLook(m, { face: m.face, anim: m.anim, flash: m.flash, moving: !!m.flee, breathe: false }));
  if (m.falls && !m.flee && ((tickN >> 3) & 1)) text('1 FALL LEFT', Math.round(sx), Math.round(sy - 62), 7, '#ff9a6a', 'center');
  if (!m.flee && !hero.mount && Math.abs(m.x - hero.x) < 80 && Math.abs(m.y - hero.y) < 24 && ((tickN >> 4) & 1)) text('K: RIDE', Math.round(sx), Math.round(sy - 52), 8, '#fff1b0', 'center');
}

function drawJar(x, y, on, age, sc) { // an Ember Jar: glass with a cork, a gold rune band, a blue flame inside; empty it is dark glass with ash at the bottom
  sc = sc || 1; age = age == null ? 999 : age;
  g.save(); g.translate(x, y); g.scale(sc, sc);
  const fl = age < 22 ? 1 - age / 22 : 0, fk = Math.sin(tickN * 0.35 + x) * 0.8; // a freshly filled jar flares up
  if (on) { g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(0, -5, 1, 0, -5, 11 + 8 * fl);
    gl.addColorStop(0, `rgba(90,170,255,${0.32 + 0.4 * fl})`); gl.addColorStop(1, 'rgba(90,170,255,0)'); g.fillStyle = gl; g.fillRect(-22, -28, 44, 44);
    g.globalCompositeOperation = 'source-over'; }
  g.fillStyle = '#0a0610'; g.fillRect(-5, -10, 10, 11); g.fillRect(-3, -13, 6, 4); // outline: body and neck
  g.fillStyle = on ? '#24488e' : '#161c2c'; g.fillRect(-4, -9, 8, 9); g.fillRect(-2, -12, 4, 3);
  g.fillStyle = on ? '#bfe6ff' : '#3a4866'; g.fillRect(-3, -8, 1, 5); // glass highlight
  g.fillStyle = on ? '#2a60b0' : '#10161f'; g.fillRect(2, -8, 2, 8); // glass shade
  g.fillStyle = on ? '#e6c24a' : '#6a5a2c'; g.fillRect(-4, -6, 8, 2); g.fillStyle = on ? '#8a5a10' : '#3a3018'; g.fillRect(-3, -6, 1, 1); g.fillRect(-1, -5, 1, 1); g.fillRect(1, -6, 1, 1); g.fillRect(3, -5, 1, 1); // rune band
  g.fillStyle = on ? '#a8743a' : '#5a3e20'; g.fillRect(-2, -15, 4, 3); g.fillStyle = on ? '#d09a5a' : '#6a4a28'; g.fillRect(-2, -15, 4, 1); // cork
  if (on) {
    const h = 4 + fk + fl * 4; g.fillStyle = '#3a9aff'; g.beginPath(); g.moveTo(-2.4, -0.5); g.quadraticCurveTo(-2.6, -h * 0.6, 0.3, -h - 1); g.quadraticCurveTo(2.2, -h * 0.5, 2.4, -0.5); g.closePath(); g.fill();
    g.fillStyle = '#e8f8ff'; g.beginPath(); g.moveTo(-1, -0.5); g.quadraticCurveTo(-1, -h * 0.4, 0.2, -h * 0.75); g.quadraticCurveTo(1.2, -h * 0.4, 1, -0.5); g.closePath(); g.fill();
    if (fl > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,255,255,${0.5 * fl})`; g.fillRect(-4, -9, 8, 9); g.globalCompositeOperation = 'source-over'; }
  } else { g.fillStyle = '#5a5662'; g.fillRect(-3, -1.5, 6, 1.5); g.fillRect(-2, -2.5, 3, 1); g.fillStyle = '#8a8692'; g.fillRect(-2, -1.5, 1, 1); g.fillRect(1, -2, 1, 1); }
  g.restore();
}

function drawChests() {
  for (const c of chests) {
    const x = Math.round(c.x - cam + (c.shake > 0 ? (c.shake-- % 2 ? 1 : -1) : 0)), y = Math.round(c.y); if (x < -20 || x > W + 20) continue;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 11, 3.5, 0, 0, 7); g.fill();
    const gd = c.type === 'gold', cb = gd ? '#c8a020' : '#7a4a22', ch = gd ? '#ffe066' : '#9a6430', cl = gd ? '#a07a10' : '#6a3c1a';
    const ir = gd ? '#8a6410' : '#4a5064', ih = gd ? '#d8b040' : '#8a92a8'; // the iron straps (gilded on the gold chest)
    if (gd && !c.open) { g.globalCompositeOperation = 'lighter'; glowDot(g, x, y - 8, 22 + Math.sin(tickN * 0.1) * 2, '255,210,80', 0.35); g.globalCompositeOperation = 'source-over'; }
    g.fillStyle = '#0a0610'; g.fillRect(x - 10, y - 14, 20, 14);
    g.fillStyle = cb; g.fillRect(x - 9, y - 9, 18, 8); g.fillStyle = ch; g.fillRect(x - 9, y - 9, 18, 2); g.fillStyle = cl; g.fillRect(x - 9, y - 3, 18, 2); // body with plank shading
    g.fillStyle = ir; g.fillRect(x - 7, y - 9, 3, 8); g.fillRect(x + 4, y - 9, 3, 8); g.fillStyle = ih; g.fillRect(x - 7, y - 9, 1, 8); g.fillRect(x + 4, y - 9, 1, 8);
      g.fillStyle = '#0a0610'; g.fillRect(x - 6, y - 7, 1, 1); g.fillRect(x + 5, y - 7, 1, 1); g.fillRect(x - 6, y - 4, 1, 1); g.fillRect(x + 5, y - 4, 1, 1);
      // straps, rivets
    g.fillStyle = ir; g.fillRect(x - 9, y - 2, 18, 1);
    if (c.open) {
      g.fillStyle = '#ffd24a'; g.fillRect(x - 7, y - 11, 14, 3); g.fillStyle = '#fff1b0'; g.fillRect(x - 5, y - 11, 4, 1);
      g.fillStyle = cb; g.fillRect(x - 9, y - 19, 18, 4); g.fillStyle = ch; g.fillRect(x - 9, y - 19, 18, 1); g.fillStyle = ir; g.fillRect(x - 7, y - 19, 3, 4); g.fillRect(x + 4, y - 19, 3, 4); g.fillStyle = ih; g.fillRect(x - 7, y - 19, 1, 4); g.fillRect(x + 4, y - 19, 1, 4);
    } else {
      g.fillStyle = cl; g.fillRect(x - 9, y - 14, 18, 6); g.fillStyle = ch; g.fillRect(x - 9, y - 14, 18, 1); g.fillStyle = cb; g.fillRect(x - 9, y - 13, 18, 2);
      g.fillStyle = ir; g.fillRect(x - 7, y - 14, 3, 6); g.fillRect(x + 4, y - 14, 3, 6); g.fillStyle = ih; g.fillRect(x - 7, y - 14, 1, 6); g.fillRect(x + 4, y - 14, 1, 6); g.fillRect(x - 9, y - 9, 18, 1);
      g.fillStyle = '#0a0610'; g.fillRect(x - 3, y - 12, 6, 7); g.fillStyle = '#c8a040'; g.fillRect(x - 2, y - 11, 4, 5); g.fillStyle = '#ffe08a'; g.fillRect(x - 2, y - 11, 4, 1); g.fillStyle = '#0a0610'; g.fillRect(x - 0.5, y - 9, 1, 2); // lock plate and keyhole
      if (gd) { g.fillStyle = '#0a0610'; g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 4, y - 16); g.lineTo(x, y - 12.4); g.lineTo(x - 4, y - 16); g.closePath();
        g.fill(); g.fillStyle = '#ff4a6a'; g.beginPath(); g.moveTo(x, y - 19); g.lineTo(x + 3, y - 16); g.lineTo(x, y - 13.4); g.lineTo(x - 3, y - 16); g.closePath();
        g.fill(); g.fillStyle = '#ffb0c0'; g.beginPath(); g.moveTo(x, y - 19); g.lineTo(x, y - 16); g.lineTo(x - 3, y - 16); g.closePath(); g.fill();
        } // the gem on the gold chest
      if ((tickN >> 4) % 6 === 0) { g.fillStyle = '#fff1b0'; g.fillRect(x + 5, y - 15, 2, 2); }
    }
  }
}
function textO(s, x, y, size, col, align) { // a name on the floor: dark outline so it reads over any background
  s = tr(s); g.font = `bold ${size}px "Courier New",monospace`; g.textAlign = align || 'left'; g.fillStyle = '#0a0610';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) g.fillText(s, x + dx, y + dy);
  g.fillStyle = col; g.fillText(s, x, y);
}
function drawItems() {
  let li = 0;
  for (const it of items) {
    const x = Math.round(it.x - cam), y = Math.round(it.y);
    if (it.kind === 'vase') {
      const z = it.z || 0, yy = y - z + Math.sin(it.t * 0.1) * 1.5;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 7, 2.5, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, yy - 8, 1, x, yy - 8, 18); gr.addColorStop(0, 'rgba(90,170,255,0.5)'); gr.addColorStop(1, 'rgba(90,170,255,0)');
      g.fillStyle = gr; g.fillRect(x - 18, yy - 26, 36, 36); g.globalCompositeOperation = 'source-over';
      drawJar(x, yy, true, 999, 1.15);
      continue;
    }
    if (it.kind === 'gear') {
      const rar = it.it.rar, R = it.it.set ? Object.assign({}, RARITY[rar], { col: SET_GREEN, rgb: SET_GREEN_RGB }) : RARITY[rar], z = it.z || 0, yy = y - z + Math.sin(it.t * 0.1) * 1.2;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 8, 2.5, 0, 0, 7); g.fill();
      if (rar > 0) { // the light column grows with the rarity: taller, wider, and sparks climb it
        const bh = 30 + rar * 16, bw = 3 + rar; g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(0, y - bh, 0, y); gr.addColorStop(0, `rgba(${R.rgb},0)`); gr.addColorStop(1, `rgba(${R.rgb},0.6)`); g.fillStyle = gr; g.fillRect(x - bw / 2, y - bh, bw, bh);
        g.fillStyle = `rgba(255,255,255,${0.1 + 0.05 * rar})`; g.fillRect(x - 0.5, y - bh * 0.8, 1, bh * 0.8);
        if (rar >= 2) { g.strokeStyle = `rgba(${R.rgb},0.55)`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, 6 + rar * 2, (6 + rar * 2) * 0.32, 0, 0, 7); g.stroke(); }
        for (let i = 0; i < rar - 1; i++) { const sy = (it.t * 0.5 + i * 17) % bh; g.fillStyle = `rgba(${R.rgb},${0.9 - sy / bh})`; g.fillRect(x + Math.sin(sy * 0.3 + i * 2) * (bw / 2 + 1), y - sy, 1, 2); }
        glowDot(g, x, yy - 8, 16 + rar * 3, R.rgb, 0.45); g.globalCompositeOperation = 'source-over';
      }
      g.fillStyle = '#0a0610'; g.fillRect(x - 9, yy - 18, 18, 18); g.fillStyle = `rgba(${R.rgb},0.2)`; g.fillRect(x - 8, yy - 17, 16, 16);
      rarFrame(x - 8, yy - 17, 16, rar, R.col, R.rgb, !!it.it.set);
      drawIcon(g, it.it.slot, x - 7, yy - 16, 0.88, R.col);
      if (rar > 0 || (Math.abs(it.x - hero.x) < 70 && Math.abs(it.y - hero.y) < 30)) textO(iname(it.it), x, yy - 22 - (li++ % 3) * 9, 7, R.col, 'center');
      continue;
    }
    // food: a roast drumstick with the bone
    const b = Math.sin(it.t * 0.1) * 2;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 8, 2.5, 0, 0, 7); g.fill();
    g.save(); g.translate(x, y + b); g.rotate(-0.35);
    g.fillStyle = '#0a0610'; g.fillRect(2, -6, 9, 3); g.beginPath(); g.arc(11, -6.5, 2.4, 0, 7); g.arc(11, -2.5, 2.4, 0, 7); g.fill(); g.beginPath(); g.ellipse(-3, -6, 7.6, 5.6, 0, 0, 7); g.fill(); // outline
    g.fillStyle = '#f4ecd8'; g.fillRect(3, -5.5, 8, 2); g.beginPath(); g.arc(11, -6, 1.6, 0, 7); g.arc(11, -3, 1.6, 0, 7); g.fill(); g.fillStyle = '#c8bfa4'; g.fillRect(3, -4, 8, 0.8); // bone, knobbed end
    g.fillStyle = '#8a3e1c'; g.beginPath(); g.ellipse(-3, -6, 6.6, 4.6, 0, 0, 7); g.fill(); g.fillStyle = '#c0682c'; g.beginPath();
      g.ellipse(-3.6, -6.8, 5.2, 3.2, 0, 0, 7); g.fill(); g.fillStyle = '#e0904a'; g.beginPath(); g.ellipse(-4.6, -7.6, 3, 1.5, 0, 0, 7); g.fill();
      g.fillStyle = '#ffd090'; g.fillRect(-6.5, -8.6, 2, 1); // meat: shade, glaze, shine
    g.fillStyle = '#6a2c10'; g.fillRect(-7, -4, 2, 1); g.fillRect(-2, -3, 3, 1);
    g.restore();
    if ((it.t + (x | 0)) % 70 < 40) { g.fillStyle = `rgba(255,255,255,${0.25 * (1 - ((it.t + (x | 0)) % 70) / 40)})`; g.fillRect(x - 5 + Math.sin(it.t * 0.2) * 1.5, y - 14 + b - ((it.t + (x | 0)) % 70) * 0.18, 1, 3); } // a wisp of steam
  }
}

/* small ember wyrmling (original design), drawn into the sprite canvas and outlined */
function drawDragon(sx, sy, o) {
  const g = sg, white = o.flash > 0;
  const C = c => white ? '#ffffff' : c;
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(AX, AY); g.scale(o.face * (o.sc || 1), o.sc || 1);
  const PL = o.pal || {}, body = PL.body || '#c8502e', belly = PL.belly || '#f0c890', dark = PL.dark || '#8a2a22', light = PL.light || '#e0663c', spine = PL.spine || '#f0e0b0', wing = PL.wing || '#8a2a22';
  const sway = Math.sin(tickN * 0.1) * 3, st = o.moving ? Math.sin(o.anim) * 4 : 0;
  const bob = (o.moving ? Math.abs(Math.sin(o.anim)) * 1.6 : 0) + Math.sin(tickN * 0.08) * 0.6;
  P([-14, -13 - bob, -14, -7 - bob, -28 + sway, -4, -42 + sway * 1.6, -9, -38 + sway * 1.4, -15, -27 + sway, -11], dark);
  P([-38 + sway * 1.4, -15, -45 + sway * 1.7, -19, -41 + sway * 1.5, -9], spine);
  R(-10 - st, -9, 5, 9, dark); R(-11 - st, -2, 8, 2, '#2a1010'); R(10 + st, -9, 5, 9, dark); R(9 + st, -2, 8, 2, '#2a1010');
  const fl = Math.sin(tickN * (o.breathe ? 0.5 : 0.12)) * 3;
  P([-4, -22 - bob, 5, -22 - bob, 0, -38 - bob + fl, -15, -34 - bob + fl, -10, -24 - bob], wing);
  P([-4, -22 - bob, 0, -38 - bob + fl, -8, -30 - bob + fl * 0.5], dark);
  if (o.sc > 1.5 || o.wings) { // ember wyrm / storm wyrmling: huge ribbed wings behind the back
    const wf = Math.sin(tickN * 0.07) * 3;
    P([-6, -24 - bob, 8, -22 - bob, 26, -52 - bob + wf, 12, -48 - bob + wf, 14, -64 - bob + wf, -2, -50 - bob + wf, -10, -68 - bob + wf, -16, -46 - bob + wf, -30, -58 - bob + wf, -20, -30 - bob], wing);
    P([-6, -24 - bob, 26, -52 - bob + wf, 14, -64 - bob + wf, -10, -68 - bob + wf, -30, -58 - bob + wf], dark);
    for (const [wx, wy] of [[26, -52], [14, -64], [-10, -68], [-30, -58]]) { g.strokeStyle = C(spine); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6, -24 - bob); g.lineTo(wx, wy - bob + wf); g.stroke(); }
  }
  P([-18, -9 - bob, -13, -22 - bob, 0, -25 - bob, 12, -21 - bob, 18, -12 - bob, 13, -6 - bob, -14, -5 - bob], body);
  P([-14, -22 - bob, 0, -25 - bob, 12, -21 - bob, 8, -19 - bob, -8, -20 - bob], light);
  P([-12, -6 - bob, 12, -6 - bob, 15, -11 - bob, -15, -11 - bob], belly);
  for (let i = 0; i < 7; i++) { const x0 = -13 + i * 4.6, hh = i % 2 ? 5 : 7; P([x0, -22 - bob, x0 + 3.6, -23 - bob, x0 + 1.6, -22 - hh - 1 - bob], spine); P([x0 + 1.8, -22.5 - bob, x0 + 3.6, -23 - bob, x0 + 1.6, -22 - hh - 1 - bob], tone(spine, 0)); }
  for (let i = 0; i < 6; i++) R(-11 + i * 4.4, -8 - bob, 0.9, 3, tone(belly, 0)); // belly scales
  R(-12 + st, -9, 5, 9, body); R(-12 + st, -9, 2, 9, light); R(-13 + st, -2, 8, 2, '#2a1010');
  R(8 - st, -9, 5, 9, body); R(8 - st, -9, 2, 9, light); R(7 - st, -2, 8, 2, '#2a1010');
  R(-5, -26 - bob, 13, 3, '#3a2418'); R(-5, -27 - bob, 13, 1, '#c9962e'); R(-5, -24.5 - bob, 13, 1, '#e8c060'); R(1, -27 - bob, 1.5, 4, '#fff0a8'); // saddle with a gold stripe
  P([8, -18 - bob, 14, -23 - bob, 22, -35 - bob, 17, -37 - bob, 9, -27 - bob], body);
  P([14, -23 - bob, 22, -35 - bob, 19, -36 - bob, 12, -24 - bob], light);
  const jaw = o.breathe ? 6 : 1;
  P([20, -31 - bob, 33, -31 - bob + jaw, 32, -28 - bob + jaw, 19, -28 - bob], dark);
  P([17, -39 - bob, 25, -41 - bob, 35, -37 - bob, 34, -32 - bob, 20, -31 - bob, 16, -33 - bob], body);
  P([20, -39 - bob, 25, -41 - bob, 35, -37 - bob, 28, -37 - bob], light);
  if (o.breathe) { const bc = o.type === 'storm' ? ['#8ab0ff', '#ffffff'] : o.type === 'stone' ? ['#b8c8a8', '#ffffff'] : ['#ffb43a', '#fff1b0']; R(27, -32 - bob, 6, 3, bc[0]); R(28, -32 - bob, 4, 1, bc[1]); }
  R(25, -38 - bob, 3, 2, '#ffe27a'); R(27, -38 - bob, 1, 2, '#2a0a0a'); R(33, -37 - bob, 1, 1, '#2a0a0a');
  if (!white && !o.breathe) { const sc2 = o.type === 'storm' ? '#c8f0ff' : o.type === 'stone' ? '#d8e0c8' : '#ffb03a';
    for (let i = 0; i < 3; i++) { const q = (tickN * 0.5 + i * 7) % 16; R(35 + q * 0.7, -36 - bob - q * 0.45 + Math.sin(q + i) * 1.2, 1, 1, i % 2 ? sc2 : '#fff1b0');
    } } // sparks drift off the snout
  P([18, -40 - bob, 11, -47 - bob, 21, -41 - bob], '#e6dcc4'); P([20, -39 - bob, 15, -44 - bob, 22, -40 - bob], '#bfb49a');
  if (o.horns && !(o.sc > 1.5)) { // stone wyrmling: curved horns and back plates
    P([14, -39 - bob, 5, -52 - bob, 18, -41 - bob], '#e6dcc4'); P([22, -40 - bob, 22, -54 - bob, 27, -41 - bob], '#bfb49a');
    for (let i = 0; i < 4; i++) { R(-9 + i * 6, -25 - bob, 5, 3, '#2a3228'); R(-9 + i * 6, -25 - bob, 5, 1, '#8a9a86'); }
    R(8, -36 - bob, 10, 2, '#3a4438');
  }
  if (o.type === 'storm' && !white) { g.globalAlpha = 0.5 + Math.sin(tickN * 0.4) * 0.3; R(24, -39 - bob, 3, 2, '#e8f6ff'); R(-3, -21 - bob, 1, 6, '#bfe6ff'); R(7, -19 - bob, 1, 5, '#bfe6ff'); g.globalAlpha = 1; }
  if (o.sc > 1.5) { // horns, lava cracks, blazing eye
    P([14, -39 - bob, 4, -55 - bob, 18, -41 - bob], '#e6dcc4'); P([22, -40 - bob, 20, -56 - bob, 26, -41 - bob], '#bfb49a');
    const lv = 0.6 + Math.sin(tickN * 0.12) * 0.4; g.globalAlpha = white ? 1 : 0.6 + lv * 0.4;
    for (const [cx, cy, cw, ch] of [[-9, -19, 1, 6], [-3, -21, 1, 8], [4, -18, 1, 6], [9, -20, 1, 5], [-12, -12, 4, 1], [2, -14, 5, 1], [-6, -9, 1, 4]]) R(cx, cy - bob, cw, ch, '#ff9a2a');
    R(-2, -17 - bob, 1, 2, '#fff1b0'); R(6, -16 - bob, 1, 2, '#fff1b0'); g.globalAlpha = 1;
    R(24, -39 - bob, 5, 3, '#fff1b0'); R(26, -39 - bob, 2, 3, '#ff3a2a');
  }
  g.restore();
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.globalCompositeOperation = 'source-over'; sil.clearRect(0, 0, SW, SH); sil.globalAlpha = 1;
  sil.drawImage(spriteCv, 0, 0); sil.globalCompositeOperation = 'source-in'; sil.fillStyle = '#0b0610'; sil.fillRect(0, 0, SW, SH);
  const x0 = Math.round(sx) - AX, y0 = Math.round(sy) - AY;
  const ow = o.sc > 1 ? 2 : 1;
  for (const [dx, dy] of [[-ow, 0], [ow, 0], [0, -ow], [0, ow]]) MAIN.drawImage(silCv, x0 + dx, y0 + dy);
  MAIN.drawImage(spriteCv, x0, y0);
}

/* the giant dragon head that smashes the arena (original design, frontal view): angular skull, swept-back bone horns and cheek spikes,
   golden brow wedge with a glowing Ember Jar ember, slanted eyes under a dark brow, lava cracks, open jaw with fangs and a glowing throat.
   The throat light, cracks and eyes take the colour of the hero's element (fire / frost / lightning). open: 0 = jaw ajar, 1 = wide open */
function drawGiantHead(cx, cy, s, glow, open) {
  open = open || 0;
  const E = ELEM[rpg.elem || 'fire'], CK = E.col, EY = E.col2, RG = E.rgb;
  const gap = 6 + open * 40;
  const pulse = 0.8 + Math.sin(tickN * 0.2) * 0.2;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  const lw = 2 / s, OUT = '#12060a';
  const shape = (pts, fill, stroke) => { // a symmetrical plate: the points are the right half, from the centre line out and back
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    for (let i = pts.length - 2; i >= 0; i -= 2) g.lineTo(-pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = OUT; g.lineWidth = lw; g.stroke(); }
  };
  const side = (pts, fill, m, stroke) => { // one piece, mirrored by m (1 right, -1 left)
    g.beginPath(); g.moveTo(pts[0] * m, pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * m, pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke !== false) { g.strokeStyle = OUT; g.lineWidth = lw; g.stroke(); }
  };
  const glowAt = (x, y, r, rgb, a) => { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = 'source-over'; };
  // charge halo behind the head
  glowAt(0, -120, 200, RG, 0.08 + 0.22 * glow);
  // neck
  shape([0, -430, 30, -430, 40, -100, 34, -44, 0, -40], '#4a1420', true);
  for (let y = -410; y < -80; y += 22) { const hw = 30 + 10 * ((y + 430) / 340); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-hw, y, hw * 2, 3); g.fillStyle = 'rgba(200,80,60,0.12)'; g.fillRect(-hw, y + 3, hw * 2, 1); }
  // lower jaw (stays on the ground; the skull lifts off it as the mouth opens)
  shape([0, -2, 24, -4, 46, -12, 60, -30, 48, -54, 0, -48], '#7a1c2a', true);
  shape([0, -2, 24, -4, 46, -12, 36, -22, 0, -20], 'rgba(30,4,10,0.35)', false);
  shape([0, -48, 48, -54, 44, -45, 0, -42], '#9a2434', false);
  side([30, -36, 56, -34, 46, -14, 28, -22], 'rgba(255,150,130,0.12)', 1, false); side([30, -36, 56, -34, 46, -14, 28, -22], 'rgba(255,150,130,0.12)', -1, false);
  // throat: dark, then the element light grows with the charge
  const th = 50 + gap;
  shape([0, -th, 38, -th, 42, -46, 0, -46], '#14040a', false);
  glowAt(0, -(th + 46) / 2, 22 + 34 * glow + open * 16, RG, 0.3 + 0.6 * glow * (0.35 + 0.65 * open));
  if (open > 0.2) glowAt(0, -(th + 46) / 2, 12 + 8 * open, '255,255,255', 0.25 * open * glow + 0.1 * open);
  for (const xx of [-38, -25, -13, 0, 13, 25, 38]) { const big = Math.abs(xx) === 38; g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 3.5, -47); g.lineTo(xx + 3.5, -47); g.lineTo(xx, -47 - (big ? 20 : 12)); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = lw * 0.5; g.stroke(); }
  // the skull, lifted by the jaw gap
  g.translate(0, -gap);
  for (const m of [1, -1]) { // swept-back bone horns, behind the skull
    side([44, -168, 82, -190, 112, -204, 128, -238, 108, -184, 84, -156, 56, -140], '#e6dcc4', m);
    side([58, -148, 84, -160, 108, -184, 98, -170, 80, -150], '#bfb49a', m, false);
    g.strokeStyle = 'rgba(90,70,50,0.55)'; g.lineWidth = lw * 0.8;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(m * (62 + i * 15), -156 - i * 12); g.lineTo(m * (72 + i * 15), -170 - i * 12); g.stroke(); }
  }
  shape([0, -198, 28, -194, 58, -172, 72, -134, 62, -112, 52, -92, 50, -66, 44, -50, 0, -50], '#9a2434', true);
  shape([0, -112, 62, -112, 52, -92, 50, -66, 44, -50, 0, -50], 'rgba(58,10,20,0.5)', false); // shadowed lower face (#7a1c2a)
  shape([0, -180, 6, -174, 12, -100, 0, -92], '#b8404a', false); // bridge highlight
  for (const m of [1, -1]) { // angular facets
    side([28, -194, 58, -172, 42, -160, 18, -178], '#aa2c3e', m, false);
    side([72, -134, 62, -112, 52, -92, 56, -122], '#7a1c2a', m, false);
    side([42, -160, 58, -172, 66, -146, 46, -138], 'rgba(255,150,130,0.16)', m, false);
    side([50, -66, 52, -92, 40, -84, 36, -66], 'rgba(20,2,8,0.28)', m, false);
  }
  // cheek spikes, bone
  for (const m of [1, -1]) { side([62, -112, 102, -132, 76, -96], '#e6dcc4', m); side([52, -82, 92, -86, 58, -64], '#bfb49a', m); }
  // lava cracks in the element's colour
  const cracks = [[26, -188, 30, -170, 24, -158, 34, -146, 30, -132], [60, -122, 50, -106, 52, -90, 44, -72], [8, -92, 14, -78, 8, -66], [38, -176, 48, -168, 54, -150]];
  const ca = 0.35 + 0.65 * glow;
  for (const pass of [0, 1, 2]) {
    g.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over';
    g.strokeStyle = pass === 0 ? `rgba(${RG},${0.22 * ca})` : pass === 1 ? CK : EY; g.globalAlpha = pass === 0 ? 1 : ca * pulse;
    g.lineWidth = lw * (pass === 0 ? 3.2 : pass === 1 ? 1.3 : 0.5); if (pass === 2 && glow < 0.5) continue;
    for (const m of [1, -1]) for (const c of cracks) { g.beginPath(); g.moveTo(c[0] * m, c[1]); for (let i = 2; i < c.length; i += 2) g.lineTo(c[i] * m, c[i + 1]); g.stroke(); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // golden brow wedge with the glowing Ember Jar ember
  shape([0, -190, 13, -174, 10, -134, 0, -116], '#ffd24a', true);
  shape([0, -184, 6, -174, 4, -142, 0, -132], '#fff0a0', false);
  glowAt(0, -154, 20, '255,150,40', (0.45 + 0.4 * glow) * pulse);
  g.fillStyle = '#fff1b0'; g.beginPath(); g.moveTo(0, -164); g.lineTo(4, -154); g.lineTo(0, -143); g.lineTo(-4, -154); g.closePath(); g.fill();
  // dark brow arches and slanted eyes
  for (const m of [1, -1]) {
    side([4, -118, 28, -136, 56, -144, 63, -133, 34, -125, 12, -108], '#2a0a10', m);
    glowAt(m * 32, -118, 20, RG, 0.25 + 0.4 * glow);
    side([10, -112, 30, -124, 54, -128, 46, -116, 28, -108], EY, m);
    g.fillStyle = '#1a0508'; g.fillRect(m * 33 - 1.5, -123, 3, 12);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(m * 22 - 1, -117, 4, 1.5);
  }
  // nostrils
  for (const m of [1, -1]) { g.fillStyle = '#1a0508'; g.fillRect(m * 9 - 3, -90, 6, 3); glowAt(m * 9, -88, 9, RG, 0.12 + 0.3 * glow); }
  // upper jaw: gum line and fangs (drawn last so they overlap the throat)
  shape([0, -55, 48, -55, 44, -50, 0, -50], '#5a0e1c', false);
  for (const xx of [-38, -25, -12, 12, 25, 38]) { const big = Math.abs(xx) === 38; g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 4, -50); g.lineTo(xx + 4, -50); g.lineTo(xx, -50 + (big ? 28 : 15)); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = lw * 0.5; g.stroke(); }
  g.restore();
}

/* ground ring of the wrath: a dashed ring of fire (or frost, or lightning) that opens with the charge and flares on impact */
function dragonRing(t, d) {
  const RG = ELEM[rpg.elem || 'fire'].rgb, cx = W / 2, cy = 220;
  const grow = t < 62 ? 0.3 + 0.3 * clamp((t - 6) / 56, 0, 1) : 0.6 + 0.5 * clamp((t - 62) / 24, 0, 1);
  const a = t < 62 ? 0.15 + 0.4 * clamp((t - 6) / 56, 0, 1) : t < 100 ? 0.95 : Math.max(0, 0.95 * (1 - (t - 100) / 28));
  if (a <= 0) return;
  const rx = 150 * d.size * grow, off = (tickN * 1.6) | 0;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [k, w, dir] of [[1, 2.5, 1], [0.72, 1.5, -1]]) {
    g.setLineDash([10 * k, 7 * k]); g.lineDashOffset = -off * dir;
    g.strokeStyle = `rgba(${RG},${a * (k === 1 ? 1 : 0.6)})`; g.lineWidth = w;
    g.beginPath(); g.ellipse(cx, cy, rx * k, rx * k * 0.3, 0, 0, 7); g.stroke();
  }
  g.setLineDash([]); g.restore();
}

function drawDragonCast() {
  const d = dragon, t = d.t, RG = ELEM[rpg.elem || 'fire'].rgb;
  const k = Math.min(1, t / 20, (128 - t) / 28);
  g.fillStyle = `rgba(8,0,22,${0.58 * k})`; g.fillRect(0, 0, W, H);
  const ca = Math.min(1, t / 24, (128 - t) / 22);
  for (let row = 0; row < 2; row++) for (let i = -1; i < 13; i++) {
    const x = i * 44 + (row ? 22 : 0) - (tickN * (0.5 + row * 0.3)) % 44, y = lerp(-30, row ? 22 : 10, ca);
    g.fillStyle = row ? `rgba(34,14,48,${0.95 * ca})` : `rgba(18,6,30,${0.98 * ca})`;
    g.beginPath(); g.arc(x, y, 30 + (i % 3) * 5, 0, 7); g.fill();
  }
  if (t < 62 && t % 18 < 3) {
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 2;
    let px = W * (0.15 + (((t / 18) | 0) * 0.37) % 0.7), py = 20; g.beginPath(); g.moveTo(px, py);
    while (py < 205) { px += rnd(-14, 14); py += rnd(16, 30); g.lineTo(px, py); }
    g.stroke(); g.globalCompositeOperation = 'source-over';
  }
  let chin = -200;
  if (t >= 30 && t < 62) { const p = (t - 30) / 32; chin = lerp(-120, 218, p * p); }
  else if (t >= 62 && t < 84) chin = 218 + Math.sin(t * 2) * 1.5;
  else if (t >= 84) { const q = clamp((t - 84) / 44, 0, 1); chin = lerp(218, -170, q * q * (3 - 2 * q)); }
  const glow = t < 62 ? clamp((t - 30) / 32, 0, 1) : Math.max(0.25, 1 - (t - 62) / 50);
  const open = t < 62 ? 0.12 * clamp((t - 30) / 32, 0, 1) : t < 84 ? Math.max(0.12, Math.min(1, (t - 62) / 5)) : Math.max(0.1, 1 - (t - 84) / 30);
  // 1. shadow: a dark pool grows on the ground as the head comes down, then fades after the impact
  const sh = t < 62 ? 0.5 * clamp(t / 50, 0, 1) : 0.5 * Math.min(1, (104 - t) / 30);
  if (sh > 0) { const w = (t < 62 ? 60 + 60 * clamp(t / 62, 0, 1) : 120) * d.size; g.fillStyle = `rgba(0,0,0,${sh})`; g.beginPath(); g.ellipse(W / 2, 220, w, 14, 0, 0, 7); g.fill(); }
  dragonRing(t, d);
  // 4. retreat: the head leaves a glowing trail (a column of light up to the sky and a scorch on the ground)
  if (t >= 84) {
    const q = clamp((t - 84) / 44, 0, 1), tw = 34 * d.size;
    g.globalCompositeOperation = 'lighter';
    const tg = g.createLinearGradient(W / 2 - tw, 0, W / 2 + tw, 0);
    tg.addColorStop(0, `rgba(${RG},0)`); tg.addColorStop(0.5, `rgba(${RG},${0.5 * (1 - q)})`); tg.addColorStop(1, `rgba(${RG},0)`);
    g.fillStyle = tg; g.fillRect(W / 2 - tw, 0, tw * 2, Math.max(0, chin + 20));
    const sg = g.createRadialGradient(W / 2, 221, 2, W / 2, 221, 90 * d.size); sg.addColorStop(0, `rgba(${RG},${0.45 * (1 - q)})`); sg.addColorStop(1, `rgba(${RG},0)`);
    g.save(); g.translate(0, 221); g.scale(1, 0.25); g.translate(0, -221); g.fillStyle = sg; g.fillRect(W / 2 - 90 * d.size, 221 - 90 * d.size, 180 * d.size, 180 * d.size); g.restore();
    g.globalCompositeOperation = 'source-over';
  }
  if (t >= 30 && chin > -180) drawGiantHead(W / 2, chin, 0.95 * d.size, glow, open);
}

function drawParts(addOnly) {
  for (const p of parts) {
    if (p.ring) { const t = 1 - p.life / p.max, r = t * 120; g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${p.rgb || '255,' + (180 - t * 100 | 0) + ',60'},${1 - t})`; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x - cam, p.y, r, r * 0.35, 0, 0, 7);
      g.stroke(); g.globalCompositeOperation = 'source-over'; continue; }
    if (!!p.add !== addOnly) continue;
    const a = clamp(p.life / (p.max * 0.5), 0, 1);
    g.globalAlpha = a; g.fillStyle = p.c;
    if (addOnly) g.globalCompositeOperation = 'lighter';
    g.fillRect(Math.round(p.x - cam), Math.round(p.y - p.z), p.size, p.size);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
}

function light(x, y, r, a, col) {
  const gr = lg.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
  lg.fillStyle = gr; lg.fillRect(x - r, y - r, r * 2, r * 2);
  if (col) { g.globalCompositeOperation = 'lighter'; const g2 = g.createRadialGradient(x, y, 0, x, y, r * 0.9); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = g2; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalCompositeOperation = 'source-over'; }
}
function applyLighting() {
  lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, H);
  lg.fillStyle = TH.dark; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'destination-out';
  for (const tx of torchPositions()) { const fl = 0.85 + Math.sin(tickN * 0.31 + tx) * 0.1 + Math.random() * 0.05; light(tx - cam, GROUND_TOP - 46, 120 * fl, 0.95, `rgba(${TH.torch},${0.22 * fl})`); }
  const hf = hero; if (!hf.dead) light(hf.x - cam, hf.y - 24 - hf.z, 70, 0.55, 'rgba(120,190,255,0.10)');
  for (const e of enemies) if (!e.dead) light(e.x - cam, e.y - e.h * 0.6 - e.z, 36 * e.k.scale, 0.45, 'rgba(255,110,40,0.16)');
  for (const p of parts) if (p.add && !p.amb && p.life > 8 && p.size > 1) light(p.x - cam, p.y - p.z, 26, 0.5);
  if (hero.st === 'magic' && hero.t > 14) light(hero.x - cam, hero.y - 20, 150 - (hero.t - 14) * 2, 0.9, 'rgba(255,170,70,0.35)');
  lg.globalCompositeOperation = 'source-over';
  g.drawImage(lightCv, 0, 0);
}

function bar(x, y, w, h, v, max, c1, c2) {
  const fw = Math.max(0, w * v / max) | 0, hex = /^#[0-9a-f]{6}$/i.test(c1);
  g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = c2; g.fillRect(x, y, w, h);
  g.fillStyle = c1; g.fillRect(x, y, fw, h);
  g.fillStyle = hex ? mixHex(c1, '#ffffff', 0.5) : 'rgba(255,255,255,0.35)'; g.fillRect(x, y, fw, h >= 5 ? 2 : 1); // a lighter stripe along the top
  if (h >= 5) { g.fillStyle = hex ? mixHex(c1, '#000000', 0.3) : 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 1, fw, 1); }
}
function lvText(label, x, y, size, col, align) { // a level line with the blue paragon count after it
  text(label, x, y, size, col, align);
  if (rpg.lvl < MAX_LV) return; const w = g.measureText(tr(label)).width, x0 = align === 'center' ? x + w / 2 : x + w;
  text(' +' + rpg.pg, x0, y, size, '#5ab4ff', 'left');
}
function text(s, x, y, size, col, align) {
  s = tr(s);
  g.font = `bold ${size}px "Courier New",monospace`; g.textAlign = align || 'left'; g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
}
const WYRM_PAL = { body: '#3a2230', belly: '#d06a2a', dark: '#1a0c16', light: '#6a3a4a', spine: '#ffb43a', wing: '#7a1c2c' };
function drawWyrm(f, sx, sy) {
  const sh = clamp(1 - f.z / 90, 0.3, 1);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 64 * sh, 9 * sh, 0, 0, 7); g.fill();
  if (f.dead) g.globalAlpha = clamp(1 - f.fade / 50, 0, 1);
  const br = (f.st === 'wind' || f.st === 'eatk') && (f.atk === 'breath' || f.atk === 'bite' || f.atk === 'flames');
  drawDragon(sx, sy - f.z, { face: f.face, anim: f.anim, flash: f.flash, moving: f.st === 'walk', breathe: br, sc: 2.4, pal: WYRM_PAL });
  g.globalAlpha = 1;
  if (f.st === 'wind' && !f.dead) {
    const mx = Math.round(sx + f.face * 80), my = Math.round(sy - f.z - 75);
    g.globalCompositeOperation = 'lighter'; glowDot(g, mx, my, 16 + (tickN % 8), '255,160,50', 0.7); g.globalCompositeOperation = 'source-over';
    if ((tickN >> 1) & 1) { g.fillStyle = '#ff3b2a'; g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - 112), 3, 7); g.fillRect(Math.round(sx) - 1, Math.round(sy - f.z - 103), 3, 2); }
  }
}
function drawElemIcon(el, x, y) { // 7x7 pixel glyphs: flame, snowflake, bolt
  const c = ELEM[el].col, w = ELEM[el].col2; g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, 9, 9);
  if (el === 'fire') { g.fillStyle = c; g.fillRect(x + 2, y, 2, 2); g.fillRect(x + 1, y + 2, 4, 3); g.fillRect(x, y + 4, 6, 2); g.fillStyle = w; g.fillRect(x + 2, y + 4, 2, 3); }
  else if (el === 'frost') { g.fillStyle = c; g.fillRect(x + 3, y, 1, 7); g.fillRect(x, y + 3, 7, 1); g.fillStyle = w; g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 5, y + 1, 1, 1); g.fillRect(x + 1, y + 5, 1, 1); g.fillRect(x + 5, y + 5, 1, 1); }
  else { g.fillStyle = c; g.fillRect(x + 3, y, 3, 1); g.fillRect(x + 2, y + 1, 2, 1); g.fillRect(x + 1, y + 2, 3, 1); g.fillRect(x + 2, y + 3, 4, 1); g.fillRect(x + 3, y + 4, 2, 1); g.fillRect(x + 2, y + 5, 2, 1); g.fillStyle = w; g.fillRect(x + 3, y + 2, 1, 1); }
}
function drawCrown(x, y) { // a 9x7 pixel crown
  g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, 11, 9); g.fillStyle = '#ffd24a';
  g.fillRect(x, y + 1, 2, 3); g.fillRect(x + 3, y, 3, 4); g.fillRect(x + 7, y + 1, 2, 3); g.fillRect(x, y + 4, 9, 3);
  g.fillStyle = '#fff1b0'; g.fillRect(x, y + 4, 9, 1); g.fillStyle = '#ff4a6a'; g.fillRect(x + 4, y + 5, 1, 1); g.fillStyle = '#8a5a10'; g.fillRect(x, y + 6, 9, 1);
}
function drawElemTags(e, x, y, right) { // weak (green up-arrow) and resistant (red down-arrow) elements of a monster, shown beside its health bar
  const t = ELEM_RES[e.kind]; if (!t) return; let i = 0;
  for (const el of ELEMS) {
    const v = t[el]; if (!v || (v > 0.9 && v < 1.1)) continue; const xx = right ? x - i * 18 : x + i * 18; i++;
    drawElemIcon(el, xx, y); g.fillStyle = v > 1 ? '#7aff9a' : '#ff6a6a';
    if (v > 1) { g.fillRect(xx + 9, y + 1, 1, 5); g.fillRect(xx + 8, y + 2, 3, 1); } else { g.fillRect(xx + 9, y + 1, 1, 5); g.fillRect(xx + 8, y + 4, 3, 1); }
  }
}
function drawHUD() {
  if (clearT > 0) { text(clearT > LOOT_T - 150 ? 'STAGE CLEAR' : 'LOOT TIME  -  GRAB THE DROPS', W / 2, 200, 11, '#ffd24a', 'center'); text('ENTER: CONTINUE TO THE MARKET   ' + Math.ceil(clearT / 60) + 'S', W / 2, 214, 8, '#fff', 'center'); }
  text('GOLD ' + rpg.gold, W - 12, 62, 8, '#ffd24a', 'right');
  lvText(cls().name + '  LV ' + rpg.lvl, 12, 18, 11, cls().col);
  if (!daily && crownsOf(CLS)) { drawCrown(128, 11); text('x' + crownsOf(CLS), 139, 18, 7, '#ffd24a'); }
  if (daily) {
    text('RACE ' + fmtTime(daily.t), W - 12, 72, 8, '#ffd24a', 'right'); text('GOAL: LV ' + MAX_LV + ' + PG ' + PG_MAX, W - 12, 82, 7, '#c9a86a', 'right');
    if (!daily.done) { const p = paceInfo(); if (p && p.none) text('NO ONE HAS FINISHED YET', W - 12, 92, 7, '#8a7a9a', 'right');
      else if (p) { const late = daily.t > p.t; text((late ? 'BEHIND ' : 'TO BEAT ') + p.n + ' ' + fmtTime(p.t), W - 12, 92, 7, late ? '#ff8a6a' : '#9ad08a', 'right');
      } // the pace line: the best finished time online
      const q = daily.last; if (q) text(splitName(q.k) + '  ' + (q.d == null ? fmtTime(q.t) : fmtDelta(q.d)), W - 12, 102, 7, q.d == null ? '#c9a86a' : q.d > 0 ? '#ff8a6a' : '#9ad08a', 'right'); } // the last split: time, or the gap to the leader
  }
  bar(12, 22, 110, 7, hero.hp, hero.maxhp, '#d94a3a', '#3a1418');
  if (rpg.lvl >= MAX_LV) bar(12, 40, 110, 2, rpg.pg >= PG_MAX ? 1 : rpg.pxp, rpg.pg >= PG_MAX ? 1 : pgNeed(rpg.pg), '#3a8aff', '#101a30'); // at the cap the bar fills toward the next paragon point
  else bar(12, 40, 110, 2, rpg.xp, xpNeed(rpg.lvl), '#8a6aff', '#1c1430');
  text(hero.vases ? 'SHIFT: DRAGON WRATH' : 'WRATH NEEDS AN EMBER JAR', 12, 52, 8, hero.vases ? '#ffd24a' : '#6a5a40');
  { const S = skillOf(hero); if (S) { text('U: ' + skName(S, hero), 12, 62, 7, hero.skcd > 0 ? '#6a7a90' : '#8cc4ff'); if (hero.skcd > 0) bar(12, 64, 80, 2, S.cd - hero.skcd, S.cd, '#8cc4ff', '#1c2a3a'); } else text('SKILL AT LV 10', 12, 62, 7, '#4a4a5a'); }
  for (let i = 0; i < 3; i++) drawJar(20 + i * 15, 92, i < hero.vases, i === hero.vases - 1 ? tickN - (hero.jt || -999) : 999);
  text(hero.vases ? `+${hero.vases * 15}%` : 'JARS', 62, 89, 8, hero.vases ? '#7fd0ff' : '#5a6a80');
  if (hero.mount) { const T = mtype(hero.mount); text(T.name.split(' ')[0] + '  GRIP ' + (2 - (hero.mount.falls || 0)), 12, 108, 8, T.col); bar(12, 111, 70, 4, hero.mount.hp, hero.mount.maxhp, T.col, '#2a1a20'); }
  if (coop && hero2) { const p = hero2; text(CLASSES[CLS2].name, 12, 128, 10, p.dead ? '#6a6a70' : '#8affb0');
    bar(12, 132, 110, 7, Math.max(0, p.hp), p.maxhp, '#d94a3a', '#3a1418'); if (p.vases) text('+' + p.vases * 15 + '%', 98, 147, 7, '#7fd0ff');
    if (p.dead && rpg.coins > 0 && !hero.dead) text('RETURNS SOON (-1 COIN)', 12, 158, 7, '#8878a0'); }
  if (coop && hero.dead && hero2 && !hero2.dead && rpg.coins > 0) text('RETURNS SOON (-1 COIN)', 12, 116, 7, '#8878a0');
  text('COINS', W - 56, 49, 7, '#b8a8c8', 'right'); drawCoins(W - 46, 46, rpg.coins, 14);
  text('I: GEAR', W - 8, H - 6, 7, '#7a6a8a', 'right');
  text(String(score).padStart(7, '0'), W / 2, 18, 12, '#fff1b0', 'center');
  if (!bonus && killCombo >= 2 && tickN - killComboT <= KC_WINDOW) { const a = 1 - (tickN - killComboT) / KC_WINDOW;
    text('KILL COMBO x' + killCombo, W - 8, 70, 9, '#ffb43a', 'right'); text('XP +' + Math.round(kcBonus() * 100) + '%', W - 8, 81, 8, '#8fc8ff', 'right');
    g.fillStyle = '#3a5a8a'; g.fillRect(W - 8 - 60 * a, 86, 60 * a, 2); }
  drawBuffHud();
  if (bonus) drawBonusHud();
  if (tut) drawTutHud();
  else if (bossRef && !bossRef.dead && bossRef.hp > 0) { { const bc = BOSS_COL[bossRef.kind] || '#e0742a';
    text(bossRef.k.name, W / 2, 33, 9, bossRef.p2 ? tone(bc, 3) : tone(bc, 2), 'center');
    bar(W / 2 - 110, 37, 220, 6, Math.max(0, bossRef.hp), bossRef.maxhp, bossRef.p2 ? tone(bc, 2) : bc, tone(bc, 0));
    } if (rpg.lvl >= 10) drawElemTags(bossRef, W / 2 + 116, 35, false); }
  else text((cycle ? trialName(cycle) + '  ' : '') + 'STAGE ' + (stageIdx + 1) + '  ' + STAGES[stageIdx].name, W / 2, 31, 8, cycle ? '#e0a8ff' : '#b8a8c8', 'center');
  if (stageCard > 0) { const a = Math.min(1, stageCard / 40, (190 - stageCard) / 25); g.globalAlpha = Math.max(0, a); g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 92, W, 70); text((cycle ? trialName(cycle) + '  ' : '') + 'STAGE ' + (stageIdx + 1), W / 2, 114, 12, '#ffb43a', 'center');
    text(STAGES[stageIdx].name, W / 2, 138, 20, '#fff1d0', 'center'); text(STAGES[stageIdx].tag, W / 2, 154, 8, '#c9a8ff', 'center'); g.globalAlpha = 1; }
  if (lastEnemy && lastEnemy !== bossRef && !lastEnemy.dead && lastEnemy.hp > 0) { text(lastEnemy.k.name, W - 12, 18, 10, '#ffa060', 'right');
    bar(W - 142, 22, 130, 7, lastEnemy.hp, lastEnemy.maxhp, '#e0742a', '#3a1c10');
    if (lastEnemy.barrier > 0) bar(W - 142, 30, 130, 4, lastEnemy.barrier, lastEnemy.bmax, '#9ae8ff', '#1a2440');
    if (rpg.lvl >= 10) drawElemTags(lastEnemy, W - 160, 21, true); }
  if (goBlink > 0 && (goBlink >> 4) & 1) { text('GO', W - 40, 120, 18, '#fff1b0', 'center'); g.fillStyle = '#fff1b0'; g.beginPath(); g.moveTo(W - 22, 105); g.lineTo(W - 8, 115); g.lineTo(W - 22, 125); g.fill(); }
  if (msgT > 0) { g.globalAlpha = Math.min(1, msgT / 30); text(msg, W / 2, 88, msg.length > 10 ? 14 : 18, '#ff8a4a', 'center'); g.globalAlpha = 1; }
}

const DONATE_URL = 'https://www.paypal.com/paypalme/cooldance84';
let donateBox = null, dailyBox = null, cloudBox = null;
function drawDonate(y) {
  const t = tr('LIKED IT? DONATE TO KEEP EMBERFALL GROWING  -  CLICK OR PRESS D');
  g.font = '8px "Courier New",monospace'; const w = g.measureText(t).width + 12;
  donateBox = { x: W / 2 - w / 2, y: y - 9, w, h: 13 };
  g.fillStyle = 'rgba(40,16,4,0.75)'; g.fillRect(donateBox.x, donateBox.y, w, 13); g.strokeStyle = '#ffb43a'; g.strokeRect(donateBox.x + 0.5, donateBox.y + 0.5, w - 1, 12);
  text(t, W / 2, y, 8, '#ffd24a', 'center');
}
function openDonate() { try { window.open(DONATE_URL, '_blank', 'noopener'); } catch (e) {} }
screen.addEventListener('pointerup', e => {
  if (mode === 'resume') { const r = screen.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * H; const i = y > 155 && y < 175 ? 0 : y > 177 && y < 197 ? 1 : -1; if (i >= 0) { if (resumeSel === i) { pressed.Enter = true; } else resumeSel = runInfo.coins > 0 ? i : 1; } return; }
  if (mode === 'dailyinfo') { const r = screen.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, b = dailyBtns.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (b && b.go) openBoard(1); else openSelect(false, true); return; }
  if (mode === 'journey') { const r = screen.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; if (journeyBox && y >= journeyBox.y && y <= journeyBox.y + journeyBox.h) jrCycle(1); else { mode = 'title'; SFX.pick(); } return; }
  if (shareBox && (mode === 'board' || mode === 'victory')) { const r = screen.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; if (x >= shareBox.x && x <= shareBox.x + shareBox.w && y >= shareBox.y && y <= shareBox.y + shareBox.h) { shareCard(); return; } }
  if (mode === 'board') { const r = screen.getBoundingClientRect(); boardClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); return; }
  if (mode === 'cloud') { const r = screen.getBoundingClientRect(); cloudClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); return; }
  if (mode === 'select') { const r = screen.getBoundingClientRect(); selClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); return; }
  if (!donateBox && !dailyBox && !cloudBox && !journeyBox && !trainBox) return; const r = screen.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  if (dailyBox && mode === 'title' && x >= dailyBox.x && x <= dailyBox.x + dailyBox.w && y >= dailyBox.y && y <= dailyBox.y + dailyBox.h) { openDailyInfo(); return; }
  if (trainBox && mode === 'title' && x >= trainBox.x && x <= trainBox.x + trainBox.w && y >= trainBox.y && y <= trainBox.y + trainBox.h) { startTutorial(() => { }, true); return; }
  if (journeyBox && mode === 'title' && x >= journeyBox.x && x <= journeyBox.x + journeyBox.w && y >= journeyBox.y && y <= journeyBox.y + journeyBox.h) { openJourney(); return; }
  if (cloudBox && mode === 'title' && x >= cloudBox.x && x <= cloudBox.x + cloudBox.w && y >= cloudBox.y && y <= cloudBox.y + cloudBox.h) { openCloud(); return; }
  if (donateBox && x >= donateBox.x && x <= donateBox.x + donateBox.w && y >= donateBox.y && y <= donateBox.y + donateBox.h) openDonate();
});
screen.addEventListener('pointermove', e => {
  if (!donateBox) { screen.style.cursor = ''; return; } const r = screen.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  screen.style.cursor = (x >= donateBox.x && x <= donateBox.x + donateBox.w && y >= donateBox.y && y <= donateBox.y + donateBox.h) ? 'pointer' : '';
});
addEventListener('keydown', e => { if (e.code === 'KeyY' && (mode === 'victory' || mode === 'board')) shareCard(); });
addEventListener('keydown', e => { if (e.code === 'KeyD' && donateBox && (mode === 'title' || mode === 'victory' || mode === 'gameover' || mode === 'board')) openDonate(); });
/* ---------- hero select ---------- */
let selBoxes = [];
function openDailyInfo() { mode = 'dailyinfo'; SFX.pick(); }
function updateDailyInfo() {
  if (isHit('back')) { mode = 'title'; return; }
  if (pressed.KeyB || pressed.KeyN) { openBoard(1); return; }
  if (isHit('start') || isHit('atk')) openSelect(false, true);
}
function drawDailyInfo() {
  g.fillStyle = 'rgba(4,2,10,0.7)'; g.fillRect(0, 0, W, H);
  const M = DAILY_MODS[dayMod()];
  text('SEASON RACE', W / 2, 30, 16, '#ffb43a', 'center');
  text(seasonStr() + '   ' + M.name, W / 2, 48, 9, '#c9a86a', 'center'); text(M.info, W / 2, 60, 8, '#e8e0f0', 'center');
  const L = [['THE RACE', '#ffd24a'], ['START WITH A FRESH LV 1 HERO AND RACE TO LV ' + MAX_LV + ' + ' + PG_MAX + ' PARAGON.', '#e8e0f0'], ['THE SHORTEST PLAY TIME WINS. PAUSES AND SHOPS DO NOT COUNT.', '#e8e0f0'], ['XP IS DOUBLED. TRY AS OFTEN AS YOU LIKE: YOUR BEST TIME COUNTS.', '#e8e0f0'],
    ['ONE CONTINUE COIN. AN UNFINISHED RUN WAITS ON THIS DEVICE.', '#e8e0f0'], ['EVERY RACER MEETS THE SAME STAGES AND DROPS (THE SEASON SEED).', '#e8e0f0'], ['THE SEASON ENDS IN ' + seasonDaysLeft() + ' DAYS. THE ETERNAL BOARD KEEPS YOUR BEST.', '#e8e0f0'],
    ['THE REWARD', '#ffd24a'], ['A CROWN FOR YOUR SAVED HERO FOR A FINISHED RACE, ONE EACH DAY.', '#e8e0f0'], ['YOUR REAL HERO, ITS LEVEL AND ITS GEAR ARE NEVER TOUCHED.', '#e8e0f0']];
  L.forEach(([t, c], i) => text(t, i === 0 || i === 7 ? 40 : 46, 78 + i * 14 + (i >= 7 ? 5 : 0), i === 0 || i === 7 ? 9 : 8, c));
  drawCrown(104, 169 + 8);
  dailyBtns = [{ x: 56, y: 230, w: 170, h: 16, t: 'CHOOSE HERO (ENTER)', go: 0 }, { x: 254, y: 230, w: 170, h: 16, t: 'SEASON BOARD (N)', go: 1 }];
  for (const b of dailyBtns) { g.fillStyle = 'rgba(40,24,60,0.85)'; g.fillRect(b.x, b.y, b.w, b.h); g.strokeStyle = b.go ? '#c9a86a' : '#ffd24a'; g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); text(b.t, b.x + b.w / 2, b.y + 11, 8, '#fff', 'center'); }
  text('ESC: BACK', W / 2, 262, 7, '#8a7a9a', 'center');
}
let dailyBtns = [];
function openSelect(two, dly) { sel.daily = !!dly; coop = !!two; sel.coop = coop; sel.a = Math.max(0, CLS_ORDER.indexOf(CLS)); sel.b = Math.max(0, CLS_ORDER.indexOf(CLS2)); if (coop && sel.b === sel.a) sel.b = (sel.a + 1) % 3; mode = 'select'; SFX.pick(); }
function confirmSelect() {
  setClass(CLS_ORDER[sel.a]); CLS2 = CLS_ORDER[sel.b]; saveSettings();
  if (sel.daily) { sel.daily = false; startDaily(); return; }
  runInfo = loadRun(); if (runInfo) { resumeSel = runInfo.coins > 0 ? 0 : 1; mode = 'resume'; SFX.pick(); return; }
  if (tutNeeded()) { const two = sel.coop; startTutorial(() => startCampaign(two)); return; } // a new hero starts with the short training, once
  startCampaign(sel.coop);
}
function updateSelect() {
  const mv = (pn) => (inH({ pn }, 'right') ? 1 : 0) - (inH({ pn }, 'left') ? 1 : 0);
  const d1 = mv(1); if (d1) { sel.a = (sel.a + d1 + 3) % 3; SFX.pick(); }
  if (sel.coop) { const d2 = mv(2); if (d2) { sel.b = (sel.b + d2 + 3) % 3; SFX.pick(); } }
  if (isHit('back')) { coop = false; mode = 'title'; return; }
  if (isHit('start') || isHit('atk') || (sel.coop && inH({ pn: 2 }, 'atk'))) confirmSelect();
}
function selClick(x, y) {
  for (const b of selBoxes) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { if (sel.a === b.i) confirmSelect(); else { sel.a = b.i; SFX.pick(); } return true; }
  return false;
}
function drawSelect() {
  g.fillStyle = 'rgba(4,2,10,0.62)'; g.fillRect(0, 0, W, H);
  text('CHOOSE YOUR HERO', W / 2, 26, 16, '#ffb43a', 'center');
  selBoxes = [];
  CLS_ORDER.forEach((c, i) => {
    const C = CLASSES[c], cx = W / 2 + (i - 1) * 154, x0 = cx - 70, y0 = 38, on1 = sel.a === i, on2 = sel.coop && sel.b === i, sv = peekSave(c);
    selBoxes.push({ x: x0, y: y0, w: 140, h: 196, i });
    g.fillStyle = on1 || on2 ? 'rgba(40,24,60,0.85)' : 'rgba(16,10,26,0.75)'; g.fillRect(x0, y0, 140, 196);
    g.strokeStyle = on1 ? C.col : on2 ? '#8affb0' : '#3a2a4a'; g.lineWidth = on1 || on2 ? 2 : 1; g.strokeRect(x0 + 0.5, y0 + 0.5, 139, 195);
    if (on1 || on2) { g.globalCompositeOperation = 'lighter'; glowDot(g, cx, y0 + 96, 46, '180,140,255', 0.25); g.globalCompositeOperation = 'source-over'; }
    const f = makeFighter('hero', 0, 0); f.k = lookFor(c, sv.eq); f.face = 1; f.st = on1 || on2 ? 'walk' : 'idle'; f.anim = tickN * 0.12; f.pn = 1; f.glow = null;
    g.save(); g.translate(0, 0); drawHuman(f, cx, y0 + 112); g.restore();
    text(C.name, cx, y0 + 132, 14, C.col, 'center');
    text(C.role + '  -  ' + C.stat, cx, y0 + 144, 8, '#e8e0f0', 'center');
    text('LV ' + sv.lvl, cx, y0 + 156, 8, '#ffd24a', 'center'); if (crownsOf(c)) { drawCrown(cx + 26, y0 + 150); text('x' + crownsOf(c), cx + 38, y0 + 156, 8, '#ffd24a'); }
    text(C.desc[0], cx, y0 + 172, 6, '#b8a8c8', 'center'); text(C.desc[1], cx, y0 + 182, 6, '#b8a8c8', 'center');
    if (on1) text(sel.coop ? 'P1' : '>', x0 + 10, y0 + 14, 9, C.col, 'center');
    if (on2) text('P2', x0 + 130, y0 + 14, 9, '#8affb0', 'center');
  });
  text(sel.coop ? 'P1: A/D    P2: ARROWS    ENTER: START    ESC: BACK' : 'A/D OR ARROWS: CHOOSE    ENTER: START    ESC: BACK', W / 2, 252, 8, '#c9a8ff', 'center');
  text('EACH HERO KEEPS HIS OR HER OWN LEVEL AND GEAR', W / 2, 264, 7, '#8a7a9a', 'center');
}
function drawTitleOverlay() {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
  if (tamperT > 0) { tamperT--; text('SAVE DATA WAS MODIFIED - STARTING FRESH', W / 2, 20, 8, '#ff6a6a', 'center'); }
  if (DEV) text('TEST MODE - NOTHING IS SAVED', W / 2, 262, 8, '#7aff9a', 'center');
  const y = 96 + Math.sin(tickN * 0.04) * 3;
  g.font = 'bold 54px "Courier New",monospace'; g.textAlign = 'center';
  g.fillStyle = '#2a0e08'; g.fillText('EMBERFALL', W / 2 + 3, y + 3);
  const gr = g.createLinearGradient(0, y - 40, 0, y); gr.addColorStop(0, '#fff1b0'); gr.addColorStop(0.5, '#ffb43a'); gr.addColorStop(1, '#e0431f');
  g.fillStyle = gr; g.fillText('EMBERFALL', W / 2, y);
  text('THE ASHEN VOW', W / 2, y + 22, 12, '#c9a8ff', 'center');
  if ((tickN >> 5) & 1) text('ENTER: 1 PLAYER     2: CO-OP', W / 2, 190, 12, '#ffffff', 'center');
  { const dt = tr('3: SEASON RACE  -  ' + DAILY_MODS[dayMod()].name); g.font = '8px "Courier New",monospace'; const dw = g.measureText(dt).width + 12;
    dailyBox = { x: W / 2 - dw / 2, y: 196, w: dw, h: 13 }; g.fillStyle = 'rgba(40,24,4,0.6)'; g.fillRect(dailyBox.x, dailyBox.y, dw, 13); g.strokeStyle = '#8a6a1a';
    g.strokeRect(dailyBox.x + 0.5, dailyBox.y + 0.5, dw - 1, 12); text('3: SEASON RACE  -  ' + DAILY_MODS[dayMod()].name, W / 2, 205, 8, '#ffd24a', 'center'); }
  if (!window.touchActive) { // the keyboard hints would sit under the touch buttons, so touch players do not see them
    text('WASD MOVE   J ATTACK (x3)   K JUMP   SHIFT DRAGON WRATH      P2: ARROWS  , . /', W / 2, 222, 8, '#b8a8c8', 'center');
    text('K NEAR A WYRMLING = RIDE (J FIRE, E DISMOUNT)   F: CRT   M: MUTE', W / 2, 234, 8, '#b8a8c8', 'center');
  }
  drawDonate(H - 12);
  if (onlineOn()) { const ct = '[C] CLOUD SAVE'; g.font = '8px "Courier New",monospace'; const cw = g.measureText(ct).width + 10;
    cloudBox = { x: 4, y: 3, w: cw, h: 13 }; g.fillStyle = 'rgba(20,10,40,0.7)'; g.fillRect(cloudBox.x, 3, cw, 13); g.strokeStyle = '#8cc4ff';
    g.strokeRect(cloudBox.x + 0.5, 3.5, cw - 1, 12); text(ct, cloudBox.x + cw / 2, 13, 8, '#8cc4ff', 'center'); }
  { const S = jrLoad(), jt = '[4] JOURNEY ' + S.done.length + '/9'; g.font = '8px "Courier New",monospace'; const jw = g.measureText(jt).width + 10; // the season journey sits in the top right corner, like the cloud save in the left
    journeyBox = { x: W - jw - 4, y: 3, w: jw, h: 13 }; g.fillStyle = 'rgba(40,24,4,0.7)'; g.fillRect(journeyBox.x, 3, jw, 13); g.strokeStyle = '#c9a86a'; g.strokeRect(journeyBox.x + 0.5, 3.5, jw - 1, 12); text(jt, journeyBox.x + jw / 2, 13, 8, '#ffd24a', 'center'); }
  { const tt = '[5] TRAINING'; g.font = '8px "Courier New",monospace'; const tw = g.measureText(tt).width + 10; // the button-by-button training sits under the journey
    trainBox = { x: W - tw - 4, y: 19, w: tw, h: 13 }; g.fillStyle = 'rgba(8,24,40,0.7)'; g.fillRect(trainBox.x, 19, tw, 13); g.strokeStyle = '#8cc4ff'; g.strokeRect(trainBox.x + 0.5, 19.5, tw - 1, 12); text(tt, trainBox.x + tw / 2, 29, 8, '#8cc4ff', 'center'); }
  text('v' + VERSION, W - 6, H - 5, 7, '#6a5a80', 'right');
  text(resetArm > 0 ? 'PRESS R AGAIN TO ERASE YOUR HERO' : cls().name + ' LV ' + rpg.lvl + '    I: GEAR   B: LEATHERBOARD   N: SEASON BOARD   R: RESET HERO', W / 2, 248, 8, resetArm > 0 ? '#ff6a6a' : '#c9a8ff', 'center');
}

function render() {
  donateBox = null; dailyBox = null; cloudBox = null; journeyBox = null; shareBox = null; trainBox = null;
  if (mode === 'story') { drawStory(); return; }
  if (mode === 'name' || mode === 'board') { drawBoardScreen(); return; }
  const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) * 0.6 : 0;
  g.save(); g.translate(Math.round(sx), Math.round(sy));
  drawWorld(); drawDecals(); drawFog();
  for (const tx of torchPositions()) flame(Math.round(tx - cam), GROUND_TOP - 44, 1);
  drawChests(); drawShrines(); drawItems(); drawVentsAndSlashes(false);
  const list = [...enemies, ...mounts, ...players()].sort((a, b) => a.y - b.y);
  for (const f of list) drawFighter(f);
  drawShots(); drawVentsAndSlashes(true);
  drawParts(false); drawWeather();
  drawFloats();
  g.restore();
  applyLighting();
  g.save(); g.translate(Math.round(sx), Math.round(sy)); drawParts(true); g.restore();
  drawForeground(); // pillars, moss and reeds, chains and pipes, arches: one kind per theme
  if (dragon) drawDragonCast();
  if (flashA > 0) { g.fillStyle = `rgba(255,240,220,${Math.min(1, flashA)})`; g.fillRect(0, 0, W, H); }
  if (mode === 'title') drawTitleOverlay();
  else if (mode === 'dailyinfo') drawDailyInfo();
  else if (mode === 'journey') drawJourney();
  else if (mode === 'cloud') drawCloud();
  else if (mode === 'select') drawSelect();
  else if (mode === 'resume') drawResume();
  else drawHUD();
  if (intro) drawIntro();
  if (mode === 'shop') drawShop();
  if (mode === 'forge') drawForge();
  if (mode === 'inv') drawInv();
  if (mode === 'pause') drawPause();
  if (mode === 'gameover') {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H); text('YOU HAVE FALLEN', W / 2, 106, 22, '#e0431f', 'center'); text('SCORE ' + score, W / 2, 132, 12, '#fff1b0', 'center');
    text('STAGE ' + (stageIdx + 1) + ': ' + STAGES[stageIdx].name, W / 2, 148, 8, '#b8a8c8', 'center');
    drawCoins(W / 2 - 28, 168, rpg.coins, 28);
    if (endTimer > 30) { text(rpg.coins > 0 ? 'ENTER: CONTINUE  (USES 1 COIN)' : 'NO COINS LEFT', W / 2, 192, 10, '#fff', 'center'); text(rpg.coins > 0 ? 'ESC: END RUN AND SAVE SCORE' : 'ENTER: SAVE YOUR SCORE', W / 2, 206, 8, '#b8a8c8', 'center'); drawDonate(226); }
  }
  if (mode === 'victory') drawVictory();
}
function victoryFx() { // fanfare, fireworks and confetti above the cheering hero
  const t = endTimer;
  if (t === 1) { flashA = 0.7; SFX.big(); shake = 6; }
  [[4, 523], [14, 659], [24, 784], [36, 1047]].forEach(([at, f]) => { if (t === at) { sfxTone('square', f, f, 0.32, 0.05); sfxTone('triangle', f / 2, f / 2, 0.4, 0.07); } });
  if (t === 48) { SFX.magic(); [523, 659, 784, 1047].forEach(f => sfxTone('square', f, f, 1.0, 0.035)); }
  if (t > 8 && t % 15 === 0) { // a firework: a ring of sparks high above the ground
    const cx = cam + rnd(50, W - 50), z = rnd(110, 190), cols = [['#ffd24a', '#fff1b0'], ['#ff6a3a', '#ffb43a'], ['#8ad8ff', '#ffffff'], ['#ff8ad8', '#ffe0f4'], ['#9aff8a', '#e8ffe0']][Math.random() * 5 | 0];
    SFX.pick(); sfxTone('sawtooth', 900, 200, 0.25, 0.03);
    for (let k = 0; k < 46; k++) { const a = k / 46 * Math.PI * 2 + rnd(-0.05, 0.05), sp = rnd(1.2, 2.8); parts.push({ x: cx, y: 214, z, vx: Math.cos(a) * sp, vy: 0, vz: Math.sin(a) * sp, life: rnd(40, 70), max: 70, g: 0.035, c: cols[k % 2], size: k % 3 ? 2 : 3, add: true }); }
  }
  if (t % 2 === 0) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: 215, vx: rnd(-0.4, 0.4), vy: 0, vz: -rnd(0.5, 1.1), life: rnd(190, 260), max: 260, g: 0, c: ['#ffd24a', '#ff6a3a', '#8ad8ff', '#ff8ad8', '#9aff8a', '#ffffff'][Math.random() * 6 | 0], size: 2, add: false });
}
function drawVictory() {
  const t = endTimer, fade = k => clamp((t - k) / 18, 0, 1), W2 = W / 2;
  g.fillStyle = 'rgba(14,6,0,0.55)'; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter'; // slowly turning rays of light behind the title
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * 0.004, a2 = a + 0.1; g.fillStyle = 'rgba(255,200,90,0.07)'; g.beginPath(); g.moveTo(W2, 84); g.lineTo(W2 + Math.cos(a) * 420, 84 + Math.sin(a) * 420); g.lineTo(W2 + Math.cos(a2) * 420, 84 + Math.sin(a2) * 420); g.fill(); }
  glowDot(g, W2, 80, 120 + Math.sin(t * 0.06) * 8, '255,200,90', 0.22); g.restore();
  const rank = daily ? 'SEASON RACE COMPLETE' : cycle >= TRIAL_MAX ? 'LEGEND OF THE ASHEN VOW' : cycle >= 1 ? trialName(cycle) + ' CHAMPION' : 'HERO OF EMBERFALL';
  g.globalAlpha = fade(0); const bob = Math.sin(t * 0.07) * 2;
  text('CONGRATULATIONS!', W2 + 1, 74 + bob + 2, 26, '#7a3a08', 'center'); text('CONGRATULATIONS!', W2, 74 + bob, 26, (t >> 3) & 1 ? '#ffe27a' : '#ffd24a', 'center');
  g.globalAlpha = fade(16); text(rank, W2, 98, 12, '#ff9a4a', 'center');
  if (daily) {
    g.globalAlpha = fade(30); text('THE SEASON RACE IS WON', W2, 116, 11, '#fff1d0', 'center'); text(cls().name + ' REACHED LV ' + MAX_LV + ' + PG ' + PG_MAX, W2, 130, 9, '#c9a8ff', 'center');
    g.globalAlpha = fade(48); text('TIME ' + fmtTime(daily.t), W2, 150, 13, '#fff1b0', 'center');
    g.globalAlpha = fade(60); drawCrown(W2 - 4, 160); text(daily.crown ? 'A CROWN FOR YOUR SAVED HERO' : 'TODAY\'S CROWN IS ALREADY YOURS', W2, 181, 8, '#ffd24a', 'center');
    if (daily.newTrail && t > 90) text('NEW TRAIL: ' + COSM.gild.name, W2, 207, 8, COSM.gild.col, 'center');
  } else {
  g.globalAlpha = fade(30); text('THE WORLD IS SAVED', W2, 116, 11, '#fff1d0', 'center'); text(cls().name + ' KEPT THE ASHEN VOW', W2, 130, 9, '#c9a8ff', 'center');
  g.globalAlpha = fade(48); text('LV ' + rpg.lvl + '     SCORE ' + score, W2, 150, 11, '#fff1b0', 'center');
  g.globalAlpha = fade(60); text('UNSPENT COINS ' + rpg.coins + ' x 1500 WHEN YOU FINISH', W2, 163, 8, '#d9b98a', 'center');
  }
  if (cycle >= 1 && cycle <= 3 && !daily) text('FORGE LEVEL +' + (7 + cycle) + ' UNLOCKED', W2, 175, 9, '#ffb46a', 'center');
  g.globalAlpha = 1;
  if (t > 90) { if ((t >> 5) & 1 || t > 200) { if (daily) text('ENTER: SIGN THE LEATHERBOARD', W2, 192, 9, '#fff', 'center');
    else { text('ENTER: BEGIN ' + trialName(cycle + 1) + '  (+1 COIN, TOUGHER FOES)', W2, 192, 9, '#fff', 'center');
    text('ESC: FINISH AND SIGN THE LEATHERBOARD', W2, 205, 8, '#b8a8c8', 'center'); } } }
  drawDonate(224); drawShareHint(3);
}

/* ---------- WebGL CRT / bloom presentation ---------- */
let gl = null, glProg, glTex, uCrt, uTime, uHd, uFx, uRayAmt, uRayX, uSpAmt, uSpRise, uSpSway, uAsp, uRayCol, uSpCol, uSc;
let hdAuto = true, hdSlow = 0, hdLast = 0; // HD effects: sharp pixels, light shafts, floating sparks and bloom at screen resolution; they switch themselves off on a slow device
function initGL() {
  gl = screen.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return false;
  const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec2 uv;uniform sampler2D t;uniform float crt,time,hd,fx,rayAmt,rayX,spAmt,spRise,spSway,aspect;uniform vec3 rayCol,spCol;uniform vec2 sc;
  const vec2 R=vec2(${W}.,${H}.);
  vec3 S(vec2 u){return texture2D(t,vec2(u.x,1.-u.y)).rgb;}
  vec2 SH(vec2 u){vec2 tc=u*R;vec2 f=fract(tc);return (floor(tc)+.5+clamp((f-.5)*sc,-.5,.5))/R;}
  float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  vec3 pts(vec2 q,float cells,float spd,float rad,float dens,float seed){
    vec2 p=vec2(q.x*aspect,q.y)*cells; p.y-=time*spRise*spd; p.x+=time*spSway*spd*.3;
    vec2 id=floor(p),f=fract(p)-.5; float r1=h1(id+seed),r2=h1(id*1.7+seed+3.1),r3=h1(id+seed+7.7);
    vec2 o=(vec2(r1,r2)-.5)*.6; o.x+=sin(time*1.3+r3*6.28)*.12; float d=length(f-o);
    float tw=.6+.4*sin(time*4.+r3*20.), on=step(1.-dens,r3);
    return spCol*((1.-smoothstep(0.,rad,d))+(1.-smoothstep(0.,rad*3.,d))*.22)*on*tw;
  }
  void main(){
    vec2 c=uv*2.-1.; vec2 q=uv;
    if(crt>.5){ c*=1.+dot(c,c)*vec2(.035,.05); q=c*.5+.5; }
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
    vec3 col=S(hd>.5?SH(q):q);
    vec2 px=1./R;
    if(crt>.5&&hd<.5){
      vec3 b=vec3(0.);
      for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 s=S(q+vec2(float(i),float(j))*px*2.);b+=max(s-.55,0.);}
      col+=b/25.*1.6;
    }
    if(hd>.5&&fx>.5){
      vec3 b=vec3(0.);
      for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 o=vec2(cos(a),sin(a));b+=max(S(q+o*px*2.5)-.58,0.)+max(S(q+o*px*6.5)-.58,0.)*.8;}
      col+=b/8.*1.15;
      vec2 d=vec2((q.x-rayX)*aspect,q.y-1.2); float ang=atan(d.x,-d.y);
      float s1=max(.5+.5*sin(ang*17.+time*.12),0.),s2=max(.5+.5*sin(ang*41.-time*.07+1.3),0.); float bm=s1*s1*s1*s1*.7+s2*s2*s2*s2*s2*s2*.5;
      float fall=(1.-smoothstep(0.,1.6,length(d)))*smoothstep(.05,.7,q.y)*(1.-smoothstep(.78,1.,q.y));
      col+=rayCol*bm*fall*rayAmt*(.85+.15*sin(time*.5));
      vec3 sp=pts(q,17.,1.,.085,.3,0.)+pts(q,29.,1.5,.07,.24,11.)*.8+pts(q,47.,2.2,.06,.2,23.)*.6;
      vec3 bk=pts(q,3.2,.35,.22,.35,41.)*.16*(1.-smoothstep(.1,.6,q.y));
      col+=(sp+bk)*spAmt*smoothstep(.0,.24,1.-q.y);
    }
    if(crt>.5){
      float ca=.0008; col.r=mix(col.r,S(q+vec2(ca,0.)).r,.6); col.b=mix(col.b,S(q-vec2(ca,0.)).b,.6);
      float sl=.82+.18*sin(q.y*R.y*6.2831); col*=sl;
      float m=.9+.1*sin(q.x*R.x*6.2831); col*=m;
      float v=smoothstep(1.25,.35,length(c)); col*=mix(.55,1.,v);
      col*=1.08+.015*sin(time*60.);
    } else if(hd>.5){ float v=1.-smoothstep(.45,1.45,length(c)); col*=mix(.78,1.,v); col=clamp(col,0.,1.); col=mix(col,col*col*(3.-2.*col),.2); }
    gl_FragColor=vec4(pow(clamp(col,0.,1.),vec3(.95)),1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; } return s; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return false;
  glProg = gl.createProgram(); gl.attachShader(glProg, v); gl.attachShader(glProg, f); gl.linkProgram(glProg); gl.useProgram(glProg);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(glProg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const U = n => gl.getUniformLocation(glProg, n); uCrt = U('crt'); uTime = U('time'); uHd = U('hd'); uFx = U('fx'); uRayAmt = U('rayAmt'); uRayX = U('rayX'); uSpAmt = U('spAmt'); uSpRise = U('spRise'); uSpSway = U('spSway'); uAsp = U('aspect'); uRayCol = U('rayCol'); uSpCol = U('spCol'); uSc = U('sc');
  return true;
}
const rgbF = (str, d) => { const a = String(str || '').split(',').map(Number); return a.length === 3 && a.every(v => v >= 0) ? a.map(v => v / 255) : d; };
const HD_WEATHER = { sparks: [1, 0.55, 0.4], ash: [0.75, -0.22, 0.5], snow: [0.85, -0.3, 0.35], blizzard: [0.3, -0.6, 1.4], rain: [0.4, 0.14, 0.3], storm: [0.3, 0.1, 0.5], motes: [0.95, 0.12, 0.3] }; // [amount, rise (negative falls), sway]
function hdParams() { // light colour, shaft strength and the floating specks follow the stage's theme and weather
  const T = TH || THEMES[0], w = HD_WEATHER[weather] || [0.3, 0.1, 0.3], glow = rgbF(T.glow, [1, 0.6, 0.3]), torch = rgbF(T.torch, glow);
  const sp = weather === 'snow' || weather === 'blizzard' ? [0.85, 0.92, 1] : weather === 'ash' ? [1, 0.72, 0.45] : weather === 'sparks' ? torch : glow;
  return { ray: glow, rayX: T.moon && isFinite(T.moon.x) ? Math.max(0.1, Math.min(0.9, T.moon.x / W)) : 0.3, rayAmt: 0.11, sp, spAmt: w[0], rise: w[1], sway: w[2] };
}
function hdWatch(now) { // 40 frames a second or less for four seconds: the effects go off for this session
  if (!(gl && hdOn && hdAuto)) { hdLast = now; return; }
  const dt = now - hdLast; hdLast = now; if (dt <= 0 || dt > 100) return;
  hdSlow = Math.max(0, hdSlow + (dt > 26 ? 1 : -2)); if (hdSlow > 240) { hdAuto = false; hdSlow = 0; if (mode === 'play') { msg = 'HD EFFECTS OFF - SLOW DEVICE'; msgT = 150; } }
}
function present() {
  if (gl) {
    const hdNow = hdOn && hdAuto, fxNow = hdNow && (mode === 'play' || mode === 'title');
    gl.viewport(0, 0, screen.width, screen.height);
    gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.uniform1f(uCrt, crtOn ? 1 : 0); gl.uniform1f(uTime, performance.now() / 1000 % 100);
    gl.uniform1f(uHd, hdNow ? 1 : 0); gl.uniform1f(uFx, fxNow ? 1 : 0); gl.uniform2f(uSc, screen.width / W, screen.height / H); gl.uniform1f(uAsp, W / H);
    if (fxNow) { const P = hdParams(); gl.uniform3fv(uRayCol, P.ray); gl.uniform1f(uRayX, P.rayX); gl.uniform1f(uRayAmt, P.rayAmt); gl.uniform3fv(uSpCol, P.sp); gl.uniform1f(uSpAmt, P.spAmt); gl.uniform1f(uSpRise, P.rise); gl.uniform1f(uSpSway, P.sway); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else { const c = screen.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(off, 0, 0, screen.width, screen.height); }
}
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H), dpr = Math.min(2, devicePixelRatio || 1);
  screen.style.width = Math.floor(W * s) + 'px'; screen.style.height = Math.floor(H * s) + 'px';
  screen.width = Math.floor(W * s * dpr); screen.height = Math.floor(H * s * dpr);
}
addEventListener('resize', resize);


/* ---------- touch controls (shown on touch devices) ---------- */
function initTouch() {
  if (typeof document === 'undefined' || !document.body || !document.body.appendChild || !document.head) return;
  const css = document.createElement('style');
  css.textContent = '.tc{position:fixed;z-index:9;user-select:none;-webkit-user-select:none;touch-action:none;display:none}.tc.on{display:block}' +
    '.tb{position:fixed;z-index:10;border-radius:50%;background:rgba(255,200,120,.16);border:2px solid rgba(255,220,160,.5);color:#ffe9c0;font:bold 13px monospace;display:none;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none}' +
    '.tb.on{display:flex}.tb:active,.tb.dn{background:rgba(255,200,120,.45)}';
  document.head.appendChild(css);
  const mk = (cls, style, txt) => { const d = document.createElement('div'); d.className = cls + ' notranslate'; d.setAttribute('translate', 'no'); d.style.cssText = style; if (txt) d.textContent = txt; document.body.appendChild(d); return d; };
  const all = [];
  const btn = (txt, code, right, bottom, size) => {
    const d = mk('tb', 'width:' + size + 'px;height:' + size + 'px;right:' + right + 'px;bottom:' + bottom + 'px', txt); d.dataset.k = txt; all.push(d);
    const dn = e => { e.preventDefault(); initAudio(); setV(code, true); d.classList.add('dn'); }, up = e => { e.preventDefault(); setV(code, false); d.classList.remove('dn'); };
    d.addEventListener('pointerdown', dn); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up); d.addEventListener('pointerleave', up);
  };
  btn('ATK', 'TAtk', 96, 62, 78); btn('JUMP', 'TJump', 20, 112, 68); btn('MAGIC', 'TMagic', 20, 30, 62); btn('RIDE', 'TRide', 120, 150, 50);
  btn('SKILL', 'TSkill', 182, 40, 54); btn('SWAP', 'TSwap', 188, 104, 42);
  btn('II', 'TPause', 12, null, 40); btn('GEAR', 'TInv', 60, null, 40); btn('OK', 'TStart', 108, null, 40);
  for (const d of all) if (d.dataset.k === 'II' || d.dataset.k === 'GEAR' || d.dataset.k === 'OK') { d.style.bottom = 'auto'; d.style.top = '8px'; d.style.fontSize = '10px'; }
  for (const d of all) if (d.dataset && d.dataset.k) d.textContent = d.dataset.k;
  // virtual stick
  const stick = mk('tb', 'left:22px;bottom:40px;width:128px;height:128px'), knob = document.createElement('div');
  knob.style.cssText = 'width:52px;height:52px;border-radius:50%;background:rgba(255,220,160,.45);position:absolute;left:38px;top:38px';
  stick.appendChild(knob); all.push(stick);
  const dir = e => {
    const r = stick.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    setV('TLeft', dx < -0.3); setV('TRight', dx > 0.3); setV('TUp', dy < -0.3); setV('TDown', dy > 0.3);
    knob.style.left = (38 + clamp(dx, -1, 1) * 30) + 'px'; knob.style.top = (38 + clamp(dy, -1, 1) * 30) + 'px';
  }, rel = () => { for (const c of ['TLeft', 'TRight', 'TUp', 'TDown']) setV(c, false); knob.style.left = '38px'; knob.style.top = '38px'; };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); stick.setPointerCapture(e.pointerId); dir(e); });
  stick.addEventListener('pointermove', e => { if (e.buttons || e.pressure > 0) dir(e); });
  stick.addEventListener('pointerup', rel); stick.addEventListener('pointercancel', rel);
  const show = () => { window.touchActive = true; for (const d of all) d.classList.add('on'); };
  if ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window) show();
  addEventListener('touchstart', show, { once: true, passive: true });
}

/* ---------- main loop (fixed 60 Hz) ---------- */
if (typeof document !== 'undefined' && screen && screen.getContext) {
  try { initTouch(); } catch (e) { }
  if (!initGL()) gl = null;
  resize();
  let last = performance.now(), acc = 0;
  (function frame(now) {
    acc += Math.min(100, now - last); last = now; hdWatch(now);
    try {
      while (acc >= 1000 / 60) { step(); for (const k in pressed) delete pressed[k]; acc -= 1000 / 60; }
      render(); present();
    } catch (e) { acc = 0; crash(String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    requestAnimationFrame(frame);
  })(last);
}
})();
