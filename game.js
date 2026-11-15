'use strict';
/* EMBERFALL — an original side-scrolling brawler.
   Everything (characters, stages, effects) is procedural and original.
   Pipeline: 480x270 pixel scene -> dynamic lighting -> WebGL CRT/bloom shader. */

const VERSION = '1.16.0';
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
  if (e.code === 'KeyM') muted = !muted;
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  initAudio();
});
addEventListener('keyup', e => { keys[e.code] = false; });
/* ---- gamepad + touch feed the same key tables with virtual key codes ---- */
const PADNAMES = ['Left', 'Right', 'Up', 'Down', 'A', 'B', 'X', 'Y', 'RB', 'LB', 'LT', 'Select', 'Start'];
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
let vents = [], slashes = [], shop = null, gaps = [], ambW = -1, waveN = 0, hints = {};
const LOOT_T = 1500;
let coop = false, hero1 = null, hero2 = null, intro = null, cycle = 0;
const areaLv = () => Math.round(4 + stageIdx * 1.6) + cycle * 60;          // how deep in the endless loop you are
const monLv = () => Math.max(areaLv(), rpg.lvl - 12);            // an over-levelled hero meets monsters of their own league
const late = () => Math.max(0, monLv() - 30);                    // past the middle of the campaign the ramp steepens
const HP_TIER = [1, 1.2, 1.45, 1.75, 2.05, 2.4, 2.8];                            // every act (tier) adds a flat layer of monster health
const hpTier = () => cycle ? HP_TIER[6] * (1 + 0.15 * cycle) : HP_TIER[Math.min(6, (stageIdx / 5) | 0)];
const hpMul = () => (1 + (monLv() - 4) * 0.12 + late() * late() * 0.004) * hpTier();  // monsters get tougher every stage, tier and cycle
const dmgMul = () => 1 + (monLv() - 4) * 0.055 + late() * late() * 0.0012;
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
let LANG = 'en';
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
function tr(s) { return (LANG === 'hu' && typeof huTranslate === 'function' && typeof s === 'string') ? huTranslate(s) : s; }
function setLang(l) { LANG = l; saveSettings(); if (typeof refreshTouchLabels === 'function') refreshTouchLabels(); }
function loadSettings() { try { const o = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); if (o) { musicOn = o.music !== false; sfxOn = o.sfx !== false; crtOn = o.crt !== false; if (o.lang === 'hu' || o.lang === 'en') LANG = o.lang; if (o.cls === 'panni' || o.cls === 'luca' || o.cls === 'nolan') CLS = o.cls; } } catch (e) { } }
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify({ music: musicOn, sfx: sfxOn, crt: crtOn, lang: LANG, cls: CLS })); } catch (e) { } }
loadSettings();

/* ---------- audio (tiny synth) ---------- */
let ac = null;
function initAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); mGain = ac.createGain(); mGain.gain.value = 1; mGain.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(type, f0, f1, dur, vol) {
  if (!ac || muted || !sfxOn) return;
  const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur);
}
const SFX = {
  swing: () => tone('square', 420, 140, 0.09, 0.05),
  hit: () => { tone('square', 180, 50, 0.12, 0.09); tone('sawtooth', 90, 40, 0.1, 0.05); },
  big: () => { tone('sawtooth', 120, 28, 0.35, 0.12); },
  magic: () => { tone('sawtooth', 160, 900, 0.45, 0.07); tone('square', 90, 30, 0.5, 0.08); },
  pick: () => tone('sine', 600, 1000, 0.14, 0.08),
  land: () => tone('triangle', 90, 40, 0.08, 0.06),
  die: () => tone('sawtooth', 220, 30, 0.5, 0.1)
};

/* ---------- music: a small procedural score per stage ---------- */
let mGain = null, noiseBuf = null, mNext = 0, mStep = 0, mTheme = -1;
const MUS = [
  { root: 55.0, sc: [0, 2, 3, 5, 7, 8, 10], bpm: 92, bass: [0, -1, 0, -1, 3, -1, 2, -1, 0, -1, 0, -1, 4, -1, 3, -1], arp: [0, 2, 4, 2, 5, 4, 2, 0], wave: 'triangle' },     // gate: marching minor
  { root: 49.0, sc: [0, 1, 3, 5, 7, 8, 10], bpm: 78, bass: [0, -1, -1, 0, 1, -1, -1, 0, 0, -1, -1, 0, 3, -1, 1, -1], arp: [0, 1, 4, 1, 5, 4, 3, 1], wave: 'sine' },        // marsh: slow, eerie phrygian
  { root: 58.3, sc: [0, 2, 3, 5, 7, 9, 10], bpm: 108, bass: [0, 0, -1, 0, 0, -1, 2, -1, 0, 0, -1, 0, 3, -1, 2, -1], arp: [0, 4, 2, 4, 5, 4, 2, 4], wave: 'square' },     // forge: driving dorian
  { root: 51.9, sc: [0, 2, 3, 5, 7, 8, 11], bpm: 100, bass: [0, -1, 0, 2, -1, 0, -1, 4, 0, -1, 0, 2, -1, 3, -1, 1], arp: [0, 3, 5, 3, 6, 5, 3, 2], wave: 'sawtooth' },   // throne: dark harmonic minor
  { root: 65.4, sc: [0, 2, 3, 5, 7, 8, 10], bpm: 116, bass: [0, -1, 3, -1, 0, -1, 4, -1, 5, -1, 3, -1, 4, -1, 2, -1], arp: [0, 2, 4, 6, 4, 2, 5, 4], wave: 'triangle' }    // sanctum: epic
];
const degFreq = (M, d, oct) => M.root * Math.pow(2, (M.sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct)) / 12);
function mTone(type, f, t, dur, vol) {
  const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); gn.connect(mGain); o.start(t); o.stop(t + dur + 0.03);
}
function mKick(t, v) { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(gn); gn.connect(mGain); o.start(t); o.stop(t + 0.18); }
function mNoise(t, dur, vol, hp) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp; gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(gn); gn.connect(mGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); }
function musicTick() {
  if (!ac || !mGain || !musicOn || muted || ac.state !== 'running') return;
  const th = mode === 'gameover' ? -1 : mode === 'title' ? 0 : mode === 'story' && story ? story.theme : mode === 'victory' ? 4 : STAGES[stageIdx].theme;
  const boss = mode === 'play' && !!bossRef && !bossRef.dead;
  mGain.gain.setTargetAtTime(mode === 'pause' || mode === 'inv' ? 0.35 : 1, ac.currentTime, 0.1);
  if (th < 0) return;
  if (th !== mTheme || mNext < ac.currentTime - 0.5) { mTheme = th; mStep = 0; mNext = ac.currentTime + 0.06; }
  const M = MUS[th], sd = 60 / (M.bpm * (boss ? 1.22 : 1)) / 2;
  while (mNext < ac.currentTime + 0.22) {
    const i = mStep % 16, t = mNext, d = M.bass[i], bar = (mStep >> 4) & 1;
    if (d >= 0) mTone(th === 3 || th === 2 ? 'sawtooth' : 'triangle', degFreq(M, d, 0), t, sd * 1.8, th === 3 || th === 2 ? 0.07 : 0.16);
    if (i % 4 === 0 || (boss && i % 2 === 0)) mKick(t, boss ? 0.3 : 0.2);
    if (i % 8 === 4) mNoise(t, 0.1, boss ? 0.14 : 0.09, 1600);
    if (boss || i % 2 === 1) mNoise(t, 0.03, 0.035, 6500);
    if ((bar || boss) && i % 2 === 0) mTone(M.wave, degFreq(M, M.arp[(i >> 1) % 8], 2), t, sd * 1.5, 0.045);
    if (i === 0) { mTone('sine', degFreq(M, 0, 1), t, sd * 15, 0.05); mTone('triangle', degFreq(M, 2, 1), t, sd * 15, 0.03); mTone('sine', degFreq(M, 4, 1), t, sd * 15, 0.025); }
    if (boss && i % 4 === 2) mTone('sawtooth', degFreq(M, M.arp[(i >> 2) % 8], 3), t, sd * 1.2, 0.03);
    mNext += sd; mStep++;
  }
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
  { sky: ['#0a0b22', '#2a1740', '#6b2a3a'], star: '255,240,220', cloud: '130,60,110', far: '#2b1a3c', far2: '#1d1230', glow: '255,120,50', win: '#ffb05a', mid: '#170e26', tree: '#0f0819', wall: '#251830', wallRGB: [40, 24, 52], arch: '#120a1c', pil: '#3a2548', trim: '#4a3058', trim2: '#6a4a7a', ban: '#6e1d2a', ban2: '#4a121c', floor: ['#3a2a3e', '#17101d'], tile: '255,220,255', line: '10,6,16', fog: '140,100,160', fogA: 0.16, amb: '#ff9a4a', dark: 'rgba(18,12,40,0.5)', torch: '255,140,50', flame: ['#ff5a1f', '#ffb43a', '#fff1b0'], post: ['#1a1020', '#4b3558'], moon: { col: '#ffe9c8', spot: '#e6c9a8', r: 15, halo: '255,220,190', x: 380, y: 34 }, fg: ['#07040b', '#120a19'], farK: 'castle', midK: 'trees', wallK: 'gate' },
  { sky: ['#06130f', '#12302a', '#2c5a44'], star: '200,255,220', cloud: '60,120,90', far: '#10281f', far2: '#0a1a14', glow: '120,255,160', win: '#9dffb0', mid: '#0b1d16', tree: '#061410', wall: '#16281f', wallRGB: [22, 40, 31], arch: '#08140f', pil: '#2a4a38', trim: '#2e4a3a', trim2: '#4a7a5a', ban: '#2a5a3a', ban2: '#1a3a26', floor: ['#2b3b2c', '#101a12'], tile: '200,255,210', line: '4,10,6', fog: '120,200,150', fogA: 0.3, amb: '#9dffb0', dark: 'rgba(6,24,20,0.5)', torch: '120,255,160', flame: ['#2aa860', '#7aff9a', '#e8fff0'], post: ['#0d1a12', '#35523f'], moon: { col: '#d8ffe6', spot: '#b6e6c6', r: 13, halo: '170,255,200', x: 330, y: 40 }, fg: ['#030906', '#0b1a12'], farK: 'marsh', midK: 'reeds', wallK: 'marsh' },
  { sky: ['#1a0806', '#4a1408', '#a03a10'], star: '255,200,150', cloud: '160,60,30', far: '#2a100c', far2: '#1a0806', glow: '255,110,30', win: '#ffcf5a', mid: '#1c0c08', tree: '#120604', wall: '#2c1812', wallRGB: [48, 30, 24], arch: '#140806', pil: '#4a2c22', trim: '#5a3a2a', trim2: '#8a5a3a', ban: '#7a2a10', ban2: '#4a1608', floor: ['#3a2620', '#140a08'], tile: '255,190,140', line: '12,4,2', fog: '200,110,70', fogA: 0.2, amb: '#ffb43a', dark: 'rgba(30,8,4,0.45)', torch: '255,120,30', flame: ['#ff4a10', '#ffa020', '#fff0a0'], post: ['#1a0c08', '#6a4a3a'], moon: { r: 0 }, fg: ['#080302', '#1a0c08'], farK: 'forge', midK: 'pipes', wallK: 'forge' },
  { sky: ['#050210', '#1a0828', '#4a0e30'], star: '255,200,220', cloud: '120,30,70', far: '#14081c', far2: '#0a0410', glow: '255,40,60', win: '#ff4a5a', mid: '#0c0614', tree: '#060210', wall: '#160a22', wallRGB: [28, 14, 40], arch: '#08040e', pil: '#2a1440', trim: '#341a4a', trim2: '#5a2a7a', ban: '#1a0a22', ban2: '#0a0410', floor: ['#2a1634', '#0c0612'], tile: '255,160,220', line: '6,2,12', fog: '150,60,120', fogA: 0.18, amb: '#ff5a8a', dark: 'rgba(14,4,28,0.55)', torch: '255,60,90', flame: ['#d01040', '#ff4a6a', '#ffd0dc'], post: ['#0c0612', '#3a2050'], moon: { col: '#ff6a74', spot: '#d84a58', r: 34, halo: '255,80,100', x: 360, y: 52 }, fg: ['#030106', '#0c0612'], farK: 'throne', midK: 'crystals', wallK: 'throne' },
  { sky: ['#0c0620', '#3a1a40', '#e08a2a'], star: '255,240,200', cloud: '255,170,70', far: '#2a1236', far2: '#1a0a24', glow: '255,200,90', win: '#fff0a0', mid: '#1a0c1c', tree: '#10060f', wall: '#2a1a2a', wallRGB: [42, 26, 42], arch: '#120812', pil: '#5a3a2a', trim: '#6a4a2a', trim2: '#ffcf5a', ban: '#8a5a10', ban2: '#4a2a08', floor: ['#4a3438', '#1a1014'], tile: '255,230,170', line: '12,6,8', fog: '255,190,110', fogA: 0.2, amb: '#ffe08a', dark: 'rgba(30,14,16,0.4)', torch: '255,200,90', flame: ['#ffb020', '#ffe070', '#fffbe0'], post: ['#1c1014', '#6a5030'], moon: { col: '#fff1b0', spot: '#ffcf5a', r: 40, halo: '255,210,110', x: 300, y: 56 }, fg: ['#060204', '#1a0e10'], farK: 'sanctum', midK: 'crystals', wallK: 'sanctum' }
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

function themeFar(c, w, h, T) {
  c.fillStyle = T.far; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) c.lineTo(x, h - 52 - periodic(x, 1.3) * 16);
  c.lineTo(w, h); c.fill();
  const k = T.farK;
  if (k === 'castle') {
    for (const cx0 of [330, 800]) {
      glowDot(c, cx0 + 40, h - 60, 95, T.glow, 0.38);
      c.fillStyle = T.far2; c.fillRect(cx0, h - 92, 80, 52); c.fillRect(cx0 - 14, h - 112, 22, 72); c.fillRect(cx0 + 72, h - 106, 22, 66); c.fillRect(cx0 + 30, h - 124, 20, 84);
      for (let t = 0; t < 4; t++) { c.fillRect(cx0 - 14 + t * 6, h - 116, 4, 5); c.fillRect(cx0 + 72 + t * 6, h - 110, 4, 5); }
      c.beginPath(); c.moveTo(cx0 + 28, h - 124); c.lineTo(cx0 + 40, h - 146); c.lineTo(cx0 + 52, h - 124); c.fill();
      c.fillStyle = T.win; for (const [wx, wy] of [[cx0 + 10, h - 80], [cx0 + 60, h - 80], [cx0 + 38, h - 108], [cx0 - 6, h - 98], [cx0 + 80, h - 92]]) c.fillRect(wx, wy, 3, 5);
    }
    c.fillStyle = T.far2;
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 135 + rnd(-20, 20), bw = rnd(14, 26), bh = rnd(50, 95);
      c.fillStyle = T.far2; c.fillRect(x, h - 40 - bh, bw, bh + 40); c.fillRect(x - 3, h - 40 - bh, bw + 6, 4);
      for (let t = 0; t < 3; t++) c.fillRect(x - 3 + t * (bw / 2 + 1), h - 46 - bh, 4, 6);
      c.fillStyle = T.win; c.fillRect(x + bw / 2 - 1, h - 40 - bh * 0.6, 2, 4);
    }
  } else if (k === 'marsh') {
    for (let i = 0; i < 6; i++) { // gnarled giant trees with hanging moss
      const x = 70 + i * 150 + rnd(-25, 25), th = rnd(70, 105);
      c.strokeStyle = T.far2; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, h - 30); c.quadraticCurveTo(x + rnd(-14, 14), h - 30 - th * 0.55, x + rnd(-10, 10), h - 30 - th); c.stroke();
      c.lineWidth = 4;
      for (let b = 0; b < 4; b++) { const by = h - 30 - th * (0.5 + b * 0.12), dir = b % 2 ? 1 : -1; c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + dir * 14, by - 10, x + dir * (24 + b * 4), by - 4 + b * 3); c.stroke(); }
      c.fillStyle = T.far2; for (let b = 0; b < 5; b++) { c.beginPath(); c.ellipse(x + rnd(-26, 26), h - 30 - th + rnd(-6, 8), rnd(14, 24), rnd(5, 9), 0, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(80,150,110,0.5)'; c.lineWidth = 1;
      for (let m = 0; m < 6; m++) { const mx = x + rnd(-24, 24), my = h - 30 - th + 6; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + rnd(-2, 2), my + rnd(14, 30)); c.stroke(); }
    }
    { // leaning drowned watchtower
      c.save(); c.translate(560, h - 36); c.rotate(-0.08); c.fillStyle = T.far2; c.fillRect(-12, -92, 24, 92); c.fillRect(-16, -96, 32, 5);
      for (let t = 0; t < 3; t++) c.fillRect(-16 + t * 12, -102, 6, 7);
      c.fillStyle = T.win; c.fillRect(-2, -62, 4, 7); c.restore();
    }
    for (let i = 0; i < 14; i++) glowDot(c, rnd(0, w), rnd(h - 110, h - 40), 9, '160,255,190', 0.7); // will-o-wisps
  } else if (k === 'forge') {
    c.fillStyle = T.far2; c.beginPath(); c.moveTo(380, h); c.lineTo(485, h - 118); c.lineTo(500, h - 112); c.lineTo(520, h - 116); c.lineTo(545, h - 110); c.lineTo(660, h); c.fill();
    glowDot(c, 515, h - 112, 80, '255,150,40', 0.7);
    c.strokeStyle = '#ff7a20'; c.lineWidth = 2;
    for (const [ax, bx] of [[505, 470], [520, 545], [512, 498]]) { c.beginPath(); c.moveTo(ax, h - 110); c.lineTo(ax + (bx - ax) * 0.4, h - 70); c.lineTo(bx, h - 28); c.stroke(); }
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(70,46,40,0.35)'; c.beginPath(); c.ellipse(515 + i * 6, h - 130 - i * 8, 22 + i * 4, 8 + i, 0, 0, 7); c.fill(); }
    for (const cx0 of [60, 190, 760, 880]) {
      const ch = rnd(60, 90); c.fillStyle = T.far2; c.fillRect(cx0, h - 36 - ch, 14, ch + 36); c.fillRect(cx0 - 3, h - 36 - ch, 20, 5);
      glowDot(c, cx0 + 7, h - 38 - ch, 22, '255,140,40', 0.5);
    }
    const sg2 = c.createLinearGradient(0, h - 16, 0, h); sg2.addColorStop(0, 'rgba(255,120,30,0)'); sg2.addColorStop(1, 'rgba(255,120,30,0.55)'); c.fillStyle = sg2; c.fillRect(0, h - 16, w, 16);
  } else if (k === 'sanctum') {
    glowDot(c, 470, h - 120, 170, T.glow, 0.5);
    for (let i = 0; i < 8; i++) { const x = 30 + i * 120, bh = rnd(60, 115); c.fillStyle = T.far2; c.fillRect(x, h - 36 - bh, 16, bh + 36); c.fillRect(x - 4, h - 36 - bh, 24, 5); glowDot(c, x + 8, h - 40 - bh, 14, '255,200,90', 0.4); }
    glowDot(c, 470, h - 120, 70, '255,240,180', 0.85); c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(470, h - 120, 22, 0, 7); c.fill();
    c.strokeStyle = 'rgba(120,40,10,0.75)'; c.lineWidth = 2; c.beginPath(); c.moveTo(461, h - 140); c.lineTo(472, h - 123); c.lineTo(463, h - 106); c.lineTo(474, h - 98); c.stroke();
    for (let i = 0; i < 16; i++) { const sx = rnd(380, 560), sy = rnd(h - 190, h - 60), sz = rnd(2, 5); c.fillStyle = '#ffd070'; c.beginPath(); c.moveTo(sx, sy - sz * 1.5); c.lineTo(sx + sz, sy); c.lineTo(sx, sy + sz * 1.5); c.lineTo(sx - sz, sy); c.fill(); }
  } else { // throne
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 105 + rnd(-15, 15), bh = rnd(70, 130), bw = rnd(10, 20);
      c.fillStyle = T.far2; c.beginPath(); c.moveTo(x - bw, h - 36); c.lineTo(x - bw * 0.3, h - 36 - bh); c.lineTo(x, h - 36 - bh - 18); c.lineTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.fill();
      c.strokeStyle = 'rgba(255,60,90,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + bw * 0.3, h - 36 - bh); c.lineTo(x + bw, h - 36); c.stroke();
    }
    { const kx = 470; glowDot(c, kx, h - 80, 70, '255,40,70', 0.45); c.fillStyle = T.far2; c.fillRect(kx - 40, h - 120, 80, 90); c.beginPath(); c.moveTo(kx - 46, h - 120); c.lineTo(kx, h - 150); c.lineTo(kx + 46, h - 120); c.fill();
      for (let t = -1; t <= 1; t++) c.fillRect(kx + t * 28 - 4, h - 140 + Math.abs(t) * 8, 8, 30);
      c.fillStyle = T.win; c.fillRect(kx - 3, h - 96, 6, 16); c.fillRect(kx - 22, h - 80, 4, 8); c.fillRect(kx + 18, h - 80, 4, 8); }
    for (let i = 0; i < 12; i++) { const sx = rnd(0, w), sy = rnd(20, h - 90), sz = rnd(3, 7); c.fillStyle = T.far2; c.beginPath(); c.moveTo(sx, sy - sz * 1.6); c.lineTo(sx + sz, sy); c.lineTo(sx, sy + sz * 1.6); c.lineTo(sx - sz, sy); c.fill(); c.fillStyle = 'rgba(255,70,100,0.6)'; c.fillRect(sx, sy - 1, 1, 2); }
  }
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
    for (const gx of [130, 350, 610, 830]) { c.beginPath(); c.arc(gx, h - 34, 13, 0, 7); c.fill(); for (let t = 0; t < 10; t++) { const a = t / 10 * Math.PI * 2; c.fillRect(gx + Math.cos(a) * 14 - 2, h - 34 + Math.sin(a) * 14 - 2, 4, 4); } c.fillStyle = T.mid; c.beginPath(); c.arc(gx, h - 34, 4, 0, 7); c.fill(); c.fillStyle = T.tree; }
    for (let x = 60; x < w; x += 160) glowDot(c, x, h - 47, 8, '255,150,50', 0.6);
  } else {
    for (let i = 0; i < 18; i++) { const x = rnd(0, w), n = 2 + (i % 3); for (let j = 0; j < n; j++) { const bx = x + j * 7, bh = rnd(14, 34); c.fillStyle = T.tree; c.beginPath(); c.moveTo(bx - 4, h - 14); c.lineTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.fill(); c.strokeStyle = 'rgba(255,60,90,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx, h - 14 - bh); c.lineTo(bx + 4, h - 14); c.stroke(); } }
  }
}

function themeWall(c, w, h, T) {
  c.fillStyle = T.wall; c.fillRect(0, 70, w, h - 70);
  const [r0, g0, b0] = T.wallRGB;
  for (let x = 0; x < w; x += 8) for (let y = 70; y < h; y += 8) { c.fillStyle = `rgb(${r0 + rnd(-8, 8) | 0},${g0 + rnd(-6, 6) | 0},${b0 + rnd(-8, 8) | 0})`; c.fillRect(x, y, 7, 7); }
  for (let x = 0; x < w; x += 160) {
    c.fillStyle = T.arch; c.beginPath(); c.moveTo(x + 24, h); c.lineTo(x + 24, 92); c.arc(x + 80, 92, 56, Math.PI, 0); c.lineTo(x + 136, h); c.fill();
    c.fillStyle = T.pil; c.fillRect(x, 64, 14, h - 64); c.fillRect(x - 3, 60, 20, 6);
  }
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
  const key = act + ':' + idx; if (!_actThemes[key]) { const T = {}; for (const k in THEME_DEF[idx]) T[k] = k === 'fogA' ? THEME_DEF[idx][k] : gradeVal(THEME_DEF[idx][k], ACT_GRADE[act]); _actThemes[key] = buildTheme(T); }
  return _actThemes[key];
}
const actOf = si => Math.min(6, (si / 5) | 0);
/* weather: what falls through each act and theme */
const WEATHER = [[null, 'rain', 'sparks', 'storm', 'ash'], ['snow', 'snow', 'blizzard', 'blizzard', 'snow'], ['ash', 'storm', 'ash', 'storm', 'sparks'], ['rain', 'motes', 'rain', 'storm', 'motes'], ['ash', 'sparks', 'ash', 'storm', 'sparks'], ['storm', 'ash', 'blizzard', 'storm', 'ash'], ['motes', 'rain', 'sparks', 'storm', 'motes']];
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
    for (let i = 0; i < n; i++) { const sp = 0.5 + wh(i, 3) * 1.1 + (w === 'blizzard' ? 1.2 : 0), x = ((wh(i, 1) * (W + 60) + t * wind + Math.sin(t * 0.03 + i) * 6) % (W + 60) + W + 60) % (W + 60), y = (wh(i, 2) * H + t * sp) % H; g.fillStyle = `rgba(235,245,255,${0.5 + wh(i, 4) * 0.4})`; g.fillRect(x | 0, y | 0, wh(i, 5) > 0.7 ? 2 : 1, wh(i, 5) > 0.7 ? 2 : 1); }
  } else if (w === 'ash') {
    for (let i = 0; i < 70; i++) { const x = ((wh(i, 1) * (W + 30) + t * 0.35 + Math.sin(t * 0.02 + i) * 10) % (W + 30)), y = (wh(i, 2) * H + t * (0.4 + wh(i, 3) * 0.7)) % H; g.fillStyle = i % 9 === 0 ? 'rgba(255,150,70,0.8)' : 'rgba(190,175,170,0.5)'; g.fillRect(x | 0, y | 0, 1, 1); }
  } else if (w === 'sparks') {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) { const x = (wh(i, 1) * W + Math.sin(t * 0.05 + i) * 8 + W) % W, y = H - ((wh(i, 2) * H + t * (0.6 + wh(i, 3) * 1.2)) % H); g.fillStyle = `rgba(255,${130 + wh(i, 4) * 100 | 0},50,${0.4 + 0.4 * Math.abs(Math.sin(t * 0.2 + i))})`; g.fillRect(x | 0, y | 0, 1, 1); }
    g.globalCompositeOperation = 'source-over';
  } else if (w === 'motes') {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 55; i++) { const x = (wh(i, 1) * W + Math.sin(t * 0.017 + i) * 18 + W) % W, y = (wh(i, 2) * H + Math.cos(t * 0.013 + i * 2) * 14 - t * 0.12 * (0.3 + wh(i, 3)) + H * 4) % H; g.fillStyle = i % 2 ? `rgba(255,224,140,${0.35 + 0.35 * Math.sin(t * 0.07 + i)})` : `rgba(190,150,255,${0.35 + 0.35 * Math.sin(t * 0.06 + i)})`; const s = wh(i, 5) > 0.8 ? 2 : 1; g.fillRect(x | 0, y | 0, s, s); }
    g.globalCompositeOperation = 'source-over';
  }
}

/* ---------- game state ---------- */
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
  panni: { name: 'PANNI', cls: 'panni', look: 'hero', jump: 5.4, hp: 140, spd: 1.45, scale: 1, h: 44, skin: '#f0c09a', hair: '#e8c060', armor: '#4a2a7a', armor2: '#c9a8ff', cloth: '#3a1a6a', wlen: 28, wwid: 2, wcol: '#c9a8ff', wk: 'pstaff' },
  luca: { name: 'LUCA', cls: 'luca', look: 'hero', jump: 6.0, hp: 140, spd: 1.8, scale: 1, h: 44, skin: '#d8a070', hair: '#2a1a12', armor: '#2a3a2e', armor2: '#8affb0', cloth: '#1a2a20', wlen: 14, wwid: 2, wcol: '#dfe9f5', wk: 'dagger' },
  imp: { name: 'PILFERER', hp: 20, spd: 1.8, scale: 0.8, h: 36, skin: '#79b04a', hair: '#3a5a22', armor: '#7a5a32', armor2: '#c9962e', cloth: '#4a3320', wlen: 12, wwid: 2, wcol: '#cfd4de', windup: 99, rng: 0, dmg: 0 },
  h: { name: 'ASHEN HUSK', hp: 44, spd: 0.8, scale: 1, h: 44, skin: '#6e6a74', hair: '#2c2a30', armor: '#4a3a3a', armor2: '#ff7a2a', cloth: '#2b2226', wlen: 22, wwid: 3, wcol: '#a8743c', windup: 22, rng: 28, dmg: 9 },
  b: { name: 'CINDER BRUTE', hp: 120, spd: 0.55, scale: 1.3, h: 58, skin: '#5a5660', hair: '#1f1c22', armor: '#5a2e2e', armor2: '#ff9a3a', cloth: '#2a1c1c', wlen: 26, wwid: 6, wcol: '#6b6f78', windup: 30, rng: 40, dmg: 18 },
  boss: { name: 'THE CINDER COLOSSUS', hp: 420, spd: 0.5, scale: 2, h: 88, skin: '#4c4852', hair: '#17141a', armor: '#3a1c1c', armor2: '#ffb04a', cloth: '#221414', wlen: 32, wwid: 8, wcol: '#8a8f99', windup: 38, rng: 62, dmg: 26, poise: 70 },
  witch: { name: 'THE MIRE MATRON', hp: 400, spd: 0.9, scale: 1.55, h: 70, skin: '#6e9a58', hair: '#2a3a22', armor: '#2a1e3a', armor2: '#7aff9a', cloth: '#1c1428', wlen: 34, wwid: 3, wcol: '#5a4030', windup: 26, rng: 44, dmg: 16, poise: 60 },
  smith: { name: 'THE FORGEMASTER', hp: 560, spd: 0.45, scale: 2.1, h: 92, skin: '#6a5a52', hair: '#222222', armor: '#4a4e58', armor2: '#ff8a2a', cloth: '#2a2224', wlen: 34, wwid: 10, wcol: '#6a707c', windup: 42, rng: 70, dmg: 28, poise: 110 },
  wisp: { name: 'BOG WISP', hp: 34, spd: 0.75, scale: 0.95, h: 44, skin: '#9ad8b0', hair: '#2a5a46', armor: '#3a7a64', armor2: '#b8ffd8', cloth: '#1e4a3c', wlen: 14, wwid: 2, wcol: '#b8ffd8', windup: 34, rng: 0, dmg: 12, look: 'h', ai: 'wisp' },
  runner: { name: 'SLAG RUNNER', hp: 56, spd: 1.15, scale: 0.9, h: 40, skin: '#8a5a3a', hair: '#2a1408', armor: '#7a2a14', armor2: '#ffae3a', cloth: '#3a1608', wlen: 16, wwid: 3, wcol: '#ff8a3a', windup: 22, rng: 20, dmg: 15, look: 'h', ai: 'runner' },
  guard: { name: 'THRONE GUARD', hp: 170, spd: 0.5, scale: 1.25, h: 56, skin: '#6a5a7a', hair: '#120a1c', armor: '#2a1a4a', armor2: '#c87aff', cloth: '#1a1030', wlen: 28, wwid: 6, wcol: '#9a8ab8', windup: 34, rng: 42, dmg: 20, look: 'b', ai: 'guard' },
  wraith: { name: 'EMBER WRAITH', hp: 80, spd: 0.95, scale: 1.05, h: 46, skin: '#f0e0b0', hair: '#fff4c0', armor: '#8a6a30', armor2: '#fffbe0', cloth: '#5a4018', wlen: 26, wwid: 4, wcol: '#fff1b0', windup: 18, rng: 38, dmg: 16, look: 'h', ai: 'wraith' },
  king: { name: 'THE CINDER KING', hp: 760, spd: 0.9, scale: 1.9, h: 84, skin: '#8a7a86', hair: '#1a1018', armor: '#1a1620', armor2: '#ff6a2a', cloth: '#5a1218', wlen: 38, wwid: 5, wcol: '#2a2430', windup: 20, rng: 58, dmg: 20, poise: 90 },
  wyrm: { name: 'THE EMBER WYRM', hp: 1300, spd: 0.75, scale: 2.4, h: 96, skin: '#3a2230', hair: '#1a0c16', armor: '#3a2230', armor2: '#ffb43a', cloth: '#1a0c16', wlen: 0, wwid: 0, wcol: '#000', windup: 30, rng: 90, dmg: 26, poise: 140 },
  archer: { name: 'FROST ARCHER', hp: 60, spd: 0.85, scale: 0.95, h: 44, skin: '#9ab8d8', hair: '#e8f4ff', armor: '#3a5a7a', armor2: '#bfe6ff', cloth: '#243a52', wlen: 22, wwid: 2, wcol: '#bfe6ff', windup: 30, rng: 0, dmg: 13, look: 'h', ai: 'archer', wk: 'bow' },
  bomber: { name: 'BLAZE BOMBER', hp: 40, spd: 1.35, scale: 0.9, h: 40, skin: '#c0623a', hair: '#3a1408', armor: '#6a2a14', armor2: '#ffcf3a', cloth: '#3a1608', wlen: 10, wwid: 2, wcol: '#ff8a3a', windup: 30, rng: 0, dmg: 24, look: 'imp', ai: 'bomber', wk: 'bomb' },
  warder: { name: 'ASH WARDER', hp: 70, spd: 0.8, scale: 1, h: 46, skin: '#b8a8d8', hair: '#3a2a5a', armor: '#3a2a6a', armor2: '#9ae8ff', cloth: '#22183e', wlen: 30, wwid: 2, wcol: '#9ae8ff', windup: 30, rng: 0, dmg: 12, look: 'h', ai: 'warder', wk: 'staff' },
  caller: { name: 'FLAME CALLER', hp: 62, spd: 0.85, scale: 1, h: 46, skin: '#d08a5a', hair: '#2a0c06', armor: '#6a1a10', armor2: '#ffb43a', cloth: '#3a0c08', wlen: 30, wwid: 2, wcol: '#ffb43a', windup: 40, rng: 0, dmg: 20, look: 'h', ai: 'caller', wk: 'fstaff' },
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
const BASE_NAMES = { weapon: ['Rusted Sword', 'Iron Blade', 'Ash Cleaver'], helm: ['Worn Cap', 'Iron Helm', 'Husk Visor'], armor: ['Ragged Vest', 'Chain Shirt', 'Ash Plate'], boots: ['Old Boots', 'Road Greaves', 'Cinder Treads'], ring: ['Copper Ring', 'Bone Band', 'Ash Loop'], amulet: ['Bone Charm', 'Tin Pendant', 'Ash Locket'] };
const MAGIC_BASE = { weapon: ['Sword', 'Blade', 'Axe'], helm: ['Helm', 'Cap', 'Hood'], armor: ['Mail', 'Vest', 'Plate'], boots: ['Boots', 'Greaves', 'Treads'], ring: ['Ring', 'Band', 'Loop'], amulet: ['Amulet', 'Charm', 'Pendant'] };
const RARE_PRE = ['Runed', 'Grim', 'Stormforged', 'Bloodsworn', 'Dread', 'Sunlit', 'Wyrmbone', 'Ashborn'];
const MAGIC_PRE = ['Keen', "Warden's", 'Ember', 'Swift', 'Fierce', 'Gilded', 'Bladed'];
const LEG_NAMES = { weapon: ['Dawnbreaker', "Warden's Oath"], helm: ['Crown of Embers', 'Sunwatch Helm'], armor: ['Phoenix Mail', 'Heart-Ward'], boots: ['Stormstep Greaves', 'Ashwalkers'], ring: ['Ring of Kindling', 'Vow-Band'], amulet: ['Heart-Ember Shard', 'Eye of Ashhold'] };
const MYTH_NAMES = { weapon: ['Ruinblade, the Vow', "Nolan's Last Dawn"], helm: ['Helm of the Last Flame'], armor: ['Aegis of Emberfall'], boots: ['Boots of the Endless Road'], ring: ['Ring of the First Warden'], amulet: ['The Heart-Ember Reborn'] };
const WNAMES = {
  panni: { base: ['Ash Staff', 'Oak Wand', 'Ember Rod'], magic: ['Staff', 'Wand', 'Rod'], leg: ['Starfall Staff', 'Wand of Kindling'], myth: ["Panni's Last Spell", 'Staff of the First Flame'] },
  luca: { base: ['Rusty Dagger', 'Iron Knife', 'Ash Dirk'], magic: ['Daggers', 'Knives', 'Dirks'], leg: ['Twin Fangs', 'Nightsting'], myth: ["Luca's Last Shadow", 'Whisper and Woe'] }
};
const statName = k => k === 'str' ? cls().stat : STATS[k].n;
const pickOf = a => a[Math.random() * a.length | 0];
let rpg = { lvl: 1, xp: 0, bag: [], eq: {}, coins: 3, gold: 0, ini: 'AAA' };
let PS = null, floats = [];

const XPN = [62, 31];
const xpNeed = l => Math.round(XPN[0] + XPN[1] * l);
function pstats() {
  if (PS) return PS;
  const C = cls(), s = { str: 4 + rpg.lvl, crit: C.crit, cdmg: C.cdmg, hit: 90 };
  for (const sl of SLOTS) { const it = rpg.eq[sl]; if (it) for (const q in it.st) s[q] += it.st[q]; }
  if (CLS === 'luca') { s.crit += Math.floor(s.str * 0.08); s.hit += Math.floor(s.str * 0.05); }
  // soft caps: stacked mythic gear makes you strong, not untouchable
  s.crit = Math.min(CLS === 'luca' ? 70 : 60, s.crit); s.hit = Math.min(100, s.hit);
  if (s.cdmg > 250) s.cdmg = Math.min(500, Math.round(250 + (s.cdmg - 250) * 0.35));
  s.mult = 1 + Math.min(s.str, 120) * C.mul + Math.max(0, s.str - 120) * C.mul * 0.45;
  s.maxhp = Math.round(C.hp0 + rpg.lvl * C.hpl + (CLS === 'nolan' ? s.str >> 1 : s.str >> 2));
  return (PS = s);
}
const GEAR_COL = [null, { armor: '#2a4a7a', armor2: '#5a9cff', cloth: '#26366e', blade: '#a8d0ff' }, { armor: '#7a6a24', armor2: '#ffe84a', cloth: '#6a5a14', blade: '#fff6b0' }, { armor: '#7a4a1a', armor2: '#ffb43a', cloth: '#7a4a10', blade: '#ffe0a0' }, { armor: '#6a1a3a', armor2: '#ff4a88', cloth: '#6a1040', blade: '#ffa8c8' }];
function lookFor(c, eq) { // equipped rarity tints the hero's armor, trim, cape and weapon
  const r = sl => eq[sl] ? eq[sl].rar : 0, top = Math.max(r('helm'), r('armor'), r('boots')), base = KINDS[CLASSES[c].kind];
  const o = Object.assign({}, base);
  const A = GEAR_COL[r('armor')], T = GEAR_COL[top], C = GEAR_COL[Math.max(r('ring'), r('amulet'))], B = GEAR_COL[r('weapon')];
  if (A) o.armor = A.armor; if (T) o.armor2 = T.armor2; if (C) o.cloth = C.cloth; if (B) o.wcol = B.blade;
  const tier = sl => eq[sl] ? [1, 2, 3, 3, 4][eq[sl].rar] : 0; // look tier: 0 nothing, 1 common, 2 magic, 3 rare/legendary (tinted apart), 4 mythic
  o.gt = { helm: tier('helm'), armor: tier('armor'), boots: tier('boots'), weapon: tier('weapon'), ring: tier('ring'), amulet: tier('amulet') };
  if (!o.gt.armor) { // no armour: a plain tunic, robe or leathers
    if (c === 'panni') { o.armor = '#3a2a6a'; o.armor2 = '#9a7ad8'; o.cloth = '#2a1a5a'; }
    else if (c === 'luca') { o.armor = '#2e2e28'; o.armor2 = '#6a7a5a'; o.cloth = '#1a2a20'; }
    else { o.armor = '#6a5238'; o.armor2 = '#a07a4a'; o.cloth = '#5a2a2a'; }
  }
  if (o.gt.weapon >= 3) o.wlen = base.wlen + 3;
  o.glowRgb = Math.max(0, ...SLOTS.map(r)) >= 2 ? RARITY[Math.max(...SLOTS.map(r))].rgb : null;
  return o;
}
function gearLook() {
  for (const p of players()) {
    const c = p.pn === 2 ? CLS2 : CLS; p.k = lookFor(c, rpg.eq); p.glow = p.k.glowRgb;
    if (p.pn === 2 && c === CLS) p.k.hair = '#4a3ab0';
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
  return { crit, d: Math.max(1, Math.round(dmg * s.mult * (crit ? s.cdmg / 100 : 1) * rnd(0.93, 1.07))) };
}
function gainXP(n) {
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
  if (sk) { for (const p of players()) p.ski = skillsOf().length - 1; msg = 'NEW SKILL: ' + sk.name + '  (U)'; msgT = 220; }
  saveGame();
}
function rollRarity() { // stage 1: white only. 2: +magic 34%. 3: +rare 15%, +legendary 7%. 4+: +mythic 1%
  const t = tierOf();
  if (t >= 3 && Math.random() < 0.01) return 4;
  if (t >= 2 && Math.random() < 0.07) return 3;
  if (t >= 2 && Math.random() < 0.16) return 2;
  if (t >= 1 && Math.random() < 0.34) return 1;
  return 0;
}
const canWear = it => (it.lvl || 1) <= rpg.lvl;
function genItem(rar, slot, ilvl) { // items carry an item level, and you must be at least that level to wear them
  slot = slot || pickOf(SLOTS); const R = RARITY[rar];
  const il = ilvl || clamp(Math.max(areaLv(), rpg.lvl) + (Math.random() * 6 | 0) - 2, 1, MAX_LV); // drops land around your level, a little above or below
  const sc = k => (k === 'str' || k === 'cdmg') ? 1 + il * 0.045 : 1 + il * 0.012;
  const first = pickOf(SLOT_PRIMARY[slot]);
  const keys = [first, ...STAT_KEYS.filter(k => k !== first).sort(() => Math.random() - 0.5)];
  const n = R.n[0] + (R.n[1] > R.n[0] ? (Math.random() * (R.n[1] - R.n[0] + 1) | 0) : 0);
  const st = {};
  for (const k of keys.slice(0, n)) { const S = STATS[k]; st[k] = Math.max(1, Math.round(rnd(S.lo, S.hi) * R.mult * sc(k))); }
  const WN = slot === 'weapon' && WNAMES[CLS];
  const base = WN ? WN.magic : MAGIC_BASE[slot];
  const name = rar === 0 ? pickOf(WN ? WN.base : BASE_NAMES[slot]) : rar === 1 ? pickOf(MAGIC_PRE) + ' ' + pickOf(base) : rar === 2 ? pickOf(RARE_PRE) + ' ' + pickOf(base)
    : rar === 3 ? pickOf(WN ? WN.leg : LEG_NAMES[slot]) : pickOf(WN ? WN.myth : MYTH_NAMES[slot]);
  return { slot, rar, name, st, lvl: il };
}
function dropGear(x, y, rar) {
  const R = RARITY[rar];
  items.push({ x, y, t: 0, kind: 'gear', it: genItem(rar), z: 14, vz: 3.4 });
  spawn(x, y, 14, 10 + rar * 8, { c: [R.col, '#ffffff'], l0: 12, l1: 26, add: true, up: 2.4, g: 0.05 });
  if (rar >= 3) { flashA = Math.max(flashA, 0.2); SFX.big(); floatText(x, y - 50, rar === 4 ? 'MYTHIC DROP!' : 'LEGENDARY DROP!', R.col, 10); }
  else if (rar === 2) { SFX.magic(); floatText(x, y - 46, 'RARE DROP', R.col, 8); }
}
function onKill(e) {
  const boss = isBoss(e);
  gainXP(Math.round((boss ? 250 : e.kind === 'b' || e.k.ai ? 30 : 10) * (1 + areaLv() * 0.12) * 0.42)); // paced so level 70 arrives near the end of act VII
  { const gd = Math.round((boss ? 45 : e.kind === 'b' || e.k.ai ? 7 : 2) * (1 + areaLv() * 0.1)); rpg.gold += gd; if (boss || e.kind === 'b' || e.k.ai) floatText(e.x, e.y - e.h - 8, '+' + gd + 'G', '#ffd24a', 8); }
  const n = boss ? (tierOf() >= 2 ? 3 : 2) : e.elite ? 1 + (Math.random() < 0.4 ? 1 : 0) : Math.random() < (e.kind === 'b' || e.k.ai ? 0.42 : 0.15) ? 1 : 0;
  for (let i = 0; i < n; i++) {
    let r = rollRarity();
    if (boss && tierOf() === 1) r = 1;                       // stage 2 boss: two magic drops
    else if (boss && i === 0 && tierOf() >= 2) r = Math.max(1, r);
    dropGear(e.x + rnd(-16, 16), clamp(e.y + rnd(-6, 6), Y_MIN, Y_MAX), r);
  }
}
const GOLD_MULT = [1, 3, 5, 8, 20];
const itemValue = it => Math.round((8 + (it.lvl || 1) * 1.6) * GOLD_MULT[it.rar]);
const itemPrice = it => Math.round(itemValue(it) * 2.5);
const sameItem = (a, b) => !!a && !!b && a.slot === b.slot && a.name === b.name && a.rar === b.rar && (a.lvl || 1) === (b.lvl || 1);
function isDuplicate(it) { return Object.values(rpg.eq).some(o => sameItem(o, it)) || rpg.bag.some(o => sameItem(o, it)); }
function pickupGear(it, bought) {
  const R = RARITY[it.rar];
  if (!bought && isDuplicate(it)) { // already owned: it turns into gold and score
    const gd = itemValue(it), pt = gd * 10; rpg.gold += gd; score += pt;
    floatText(hero.x, hero.y - 60, 'DUPLICATE  +' + gd + 'G  +' + pt + 'PTS', '#ffd24a', 8); SFX.pick(); return true;
  }
  if (!rpg.eq[it.slot] && canWear(it)) { rpg.eq[it.slot] = it; PS = null; heroStats(false); floatText(hero.x, hero.y - 60, 'EQUIPPED ' + it.name, R.col, 8); }
  else if (rpg.bag.length < BAG_MAX) { rpg.bag.push(it); floatText(hero.x, hero.y - 60, it.name, R.col, 8); }
  else return false;
  saveGame(); return true;
}
function floatText(x, y, s, col, size) { floats.push({ x, y, s, col, size: size || 8, t: 0 }); }
function updateFloats() { for (const f of floats) { f.t++; f.y -= 0.45; } floats = floats.filter(f => f.t < 56); }
function drawFloats() { for (const f of floats) { g.globalAlpha = Math.min(1, (56 - f.t) / 18); text(f.s, Math.round(f.x - cam), Math.round(f.y), f.size, f.col, 'center'); } g.globalAlpha = 1; }

/* ---- persistence: character + leaderboard live in localStorage ---- */
const validItem = it => !!(it && SLOTS.includes(it.slot) && RARITY[it.rar] && it.st && typeof it.name === 'string');
const saveKey = c => (c || CLS) === 'nolan' ? SAVE_KEY : SAVE_KEY + '_' + (c || CLS);
function saveGame() { try { localStorage.setItem(saveKey(), JSON.stringify({ v: 2, lvl: rpg.lvl, xp: rpg.xp, bag: rpg.bag, eq: rpg.eq, ini: rpg.ini })); } catch (e) { } }
function migrateSave(o) { // v1 saves knew no rare tier: legendary was 2, mythic 3
  if (!o || o.v >= 2) return o;
  const up = it => { if (it && typeof it.rar === 'number' && it.rar >= 2) it.rar++; };
  (Array.isArray(o.bag) ? o.bag : []).forEach(up); if (o.eq) for (const k in o.eq) up(o.eq[k]); o.v = 2; return o;
}
function loadGame() {
  try {
    const o = migrateSave(JSON.parse(localStorage.getItem(saveKey()) || 'null')); loadedCls = CLS;
    if (o && o.lvl) {
      rpg.lvl = clamp(o.lvl | 0, 1, MAX_LV); rpg.xp = Math.max(0, +o.xp || 0);
      rpg.bag = (Array.isArray(o.bag) ? o.bag : []).filter(validItem).slice(0, BAG_MAX);
      rpg.eq = {}; for (const s of SLOTS) if (o.eq && validItem(o.eq[s]) && o.eq[s].slot === s) rpg.eq[s] = o.eq[s];
      rpg.ini = String(o.ini || 'AAA').toUpperCase().replace(/[^A-Z]/g, 'A').padEnd(3, 'A').slice(0, 3);
    }
  } catch (e) { }
}
function loadBoard() { try { const a = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]'); return Array.isArray(a) ? a.filter(e => e && typeof e.s === 'number').slice(0, 10) : []; } catch (e) { return []; } }
function saveBoard(b) { try { localStorage.setItem(BOARD_KEY, JSON.stringify(b.slice(0, 10))); } catch (e) { } }
loadGame();
/* ---------- the run is cached on this device: resuming a stage costs a continue coin ---------- */
const runKey = c => 'emberfall_run_v1_' + (c || CLS);
function saveRun(stage) { try { localStorage.setItem(runKey(), JSON.stringify({ stage, cycle, coins: rpg.coins, gold: rpg.gold, score, coop, c2: CLS2 })); } catch (e) { } }
function loadRun(c) { try { const o = JSON.parse(localStorage.getItem(runKey(c)) || 'null'); return o && o.stage >= 0 && o.stage < STAGES.length ? o : null; } catch (e) { return null; } }
function clearRun() { try { localStorage.removeItem(runKey()); } catch (e) { } }
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
  text(C.name + '  LV ' + rpg.lvl, W / 2, 60, 14, C.col, 'center');
  text('UNFINISHED RUN ON THIS DEVICE', W / 2, 82, 9, '#c9a8ff', 'center');
  text((o.cycle ? 'CYCLE ' + (o.cycle + 1) + '  ' : '') + 'STAGE ' + (o.stage + 1) + '  ' + STAGES[o.stage].name, W / 2, 100, 10, '#fff1d0', 'center');
  drawCoins(W / 2 - 14, 116, o.coins, 14);
  text('SCORE ' + (o.score | 0) + '    GOLD ' + (o.gold | 0), W / 2, 136, 8, '#ffd24a', 'center');
  const opt = (i, s, ok) => { const y = 168 + i * 22, on = resumeSel === i; if (on) { g.fillStyle = 'rgba(60,30,90,0.8)'; g.fillRect(W / 2 - 150, y - 13, 300, 18); } text((on ? '> ' : '') + s, W / 2, y, 10, !ok ? '#6a5a70' : on ? '#ffffff' : '#b8a8c8', 'center'); };
  opt(0, can ? 'CONTINUE THIS STAGE  (USES 1 COIN)' : 'NO COINS LEFT TO CONTINUE', can);
  opt(1, 'NEW CAMPAIGN  (THE OLD RUN IS LOST)', true);
  text('ENTER: CHOOSE    ESC: BACK', W / 2, 250, 8, '#8a7a9a', 'center');
}
function peekSave(c) { try { const o = migrateSave(JSON.parse(localStorage.getItem(saveKey(c)) || 'null')) || {}; const eq = {}; for (const sl of SLOTS) if (o.eq && validItem(o.eq[sl])) eq[sl] = o.eq[sl]; return { lvl: clamp((o.lvl | 0) || 1, 1, MAX_LV), eq }; } catch (e) { return { lvl: 1, eq: {} }; } }
function setClass(c) {
  if (!CLASSES[c]) c = 'nolan'; if (c === CLS && loadedCls === c) return;
  if (loadedCls) saveGame(); CLS = c; rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; PS = null; loadGame(); saveSettings();
  if (hero) heroStats(true);
}

/* ---- end of run: name entry + leather leaderboard ---- */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let nameBuf = [0, 0, 0], namePos = 0, pendingRun = null, boardHi = -1, resetArm = 0, leatherCv = null;
let inv = { z: 'bag', i: 0, from: 'play' }, invNote = '', invNoteT = 0;
function endRun(won) {
  clearRun();
  if (won) score += rpg.coins * 1500 + rpg.gold * 2;
  saveGame();
  const b = loadBoard();
  pendingRun = { s: score, st: stageIdx + 1, c: cycle + 1, lv: rpg.lvl, w: !!won, h: CLS };
  if (score > 0 && (b.length < 10 || score > b[b.length - 1].s)) { nameBuf = rpg.ini.split('').map(c => Math.max(0, LETTERS.indexOf(c))); namePos = 0; mode = 'name'; }
  else { boardHi = -1; mode = 'board'; }
  endTimer = 0;
}
function toTitle() { coop = false; cycle = 0; resetGame(); TH = THEMES[0]; weather = 'ash'; mode = 'title'; }
function updateName() {
  if (isHit('left')) namePos = (namePos + 2) % 3; if (isHit('right')) namePos = (namePos + 1) % 3;
  if (isHit('up')) nameBuf[namePos] = (nameBuf[namePos] + 1) % 26; if (isHit('down')) nameBuf[namePos] = (nameBuf[namePos] + 25) % 26;
  if (isHit('start')) {
    const n = nameBuf.map(i => LETTERS[i]).join(''); rpg.ini = n;
    const b = loadBoard(), e = Object.assign({ n }, pendingRun); b.push(e); b.sort((a, c) => c.s - a.s); boardHi = b.indexOf(e);
    saveBoard(b); saveGame(); mode = 'board';
  }
}
function updateBoard() { if (isHit('start') || isHit('back')) toTitle(); }
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
    text('NEW HIGH SCORE!', W / 2, 54, 16, C, 'center');
    text('SCORE ' + String(score).padStart(7, '0'), W / 2, 76, 11, '#fff1d0', 'center');
    text((pendingRun.c > 1 ? 'CYCLE ' + pendingRun.c + '  ' : '') + 'STAGE ' + pendingRun.st + '   LV ' + pendingRun.lv + (pendingRun.w ? '   WORLD SAVED' : ''), W / 2, 92, 8, '#d9b98a', 'center');
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
  text('LEATHERBOARD', W / 2, 44, 18, C, 'center');
  text('HALL OF EMBER WARDENS', W / 2, 58, 8, '#c9a86a', 'center');
  text('#', 80, 76, 7, '#b8935a'); text('NAME', 104, 76, 7, '#b8935a'); text('SCORE', 252, 76, 7, '#b8935a', 'right'); text('STAGE', 266, 76, 7, '#b8935a'); text('LV', 322, 76, 7, '#b8935a');
  const b = loadBoard();
  for (let i = 0; i < 10; i++) {
    const y = 93 + i * 15, e = b[i];
    if (i === boardHi) { g.fillStyle = (tickN >> 4) & 1 ? 'rgba(255,210,90,0.28)' : 'rgba(255,210,90,0.12)'; g.fillRect(72, y - 10, 336, 13); }
    const col = !e ? '#7a5a3a' : i === 0 ? '#ffe27a' : i < 3 ? '#fff1d0' : '#e6cfa0';
    text(String(i + 1).padStart(2, ' '), 78, y, 9, col);
    if (e) { text(e.n, 104, y, 9, col); text(String(e.s).padStart(7, '0'), 252, y, 9, col, 'right'); text((e.c > 1 ? 'C' + e.c + ' ' : '') + 'S' + e.st, 270, y, 9, col); text(String(e.lv), 322, y, 9, col); if (e.w) text('*', 396, y, 9, '#ffd24a', 'center'); }
    else text('---', 104, y, 9, col);
  }
  text('* = WORLD SAVED', 78, 240, 7, '#b8935a');
  if ((tickN >> 5) & 1) text('PRESS ENTER', W / 2 + 40, 240, 9, '#fff', 'center');
}

/* ---- inventory (Diablo-style paper doll + backpack) ---- */
function drawIcon(c, slot, x, y, sc, col) {
  c.save(); c.translate(x, y); c.scale(sc, sc);
  const dk = '#0b0610', mt = '#aab0c0', mt2 = '#6a7080';
  const P = (pts, f) => { c.fillStyle = f; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); c.strokeStyle = dk; c.lineWidth = 0.8; c.stroke(); };
  if (slot === 'weapon') { P([13, 1, 15, 3, 7, 11, 5, 9], mt); P([3, 8, 8, 13, 7, 14, 2, 9], col); P([4, 12, 2, 14, 1, 13, 3, 11], '#7a4a22'); }
  else if (slot === 'helm') { P([2, 13, 2, 8, 4, 4, 8, 2, 12, 4, 14, 8, 14, 13], mt); P([4, 8, 12, 8, 12, 10, 4, 10], dk); P([7, 2, 9, 2, 9, 7, 7, 7], col); }
  else if (slot === 'armor') { P([1, 5, 4, 2, 6, 2, 8, 4, 10, 2, 12, 2, 15, 5, 12, 7, 12, 14, 4, 14, 4, 7], mt); P([6, 7, 10, 7, 10, 12, 6, 12], col); }
  else if (slot === 'boots') { P([3, 2, 7, 2, 7, 9, 12, 10, 12, 13, 3, 13], mt); P([3, 11, 12, 11, 12, 13, 3, 13], col); }
  else if (slot === 'ring') { c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.arc(8, 10, 4.5, 0, 7); c.stroke(); P([6, 2, 10, 2, 11, 5, 8, 7, 5, 5], col); }
  else { c.strokeStyle = mt2; c.lineWidth = 1; c.beginPath(); c.moveTo(3, 1); c.lineTo(8, 9); c.lineTo(13, 1); c.stroke(); P([8, 8, 11, 11, 8, 15, 5, 11], col); }
  c.restore();
}
function panel(x, y, w, h, title) {
  g.fillStyle = '#15101c'; g.fillRect(x, y, w, h); g.strokeStyle = '#8a6a2a'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.strokeStyle = '#3a2a4a'; g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  text(title, x + w / 2, y + 15, 9, '#e8c46a', 'center');
}
function slotBox(x, y, it, sel, ghost) {
  g.fillStyle = '#0a0710'; g.fillRect(x - 1, y - 1, 28, 28);
  g.fillStyle = it ? `rgba(${RARITY[it.rar].rgb},0.2)` : '#1a1422'; g.fillRect(x, y, 26, 26);
  g.strokeStyle = it ? RARITY[it.rar].col : '#4a3a5a'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 25, 25);
  if (it) drawIcon(g, it.slot, x + 5, y + 5, 1, RARITY[it.rar].col);
  else if (ghost) { g.globalAlpha = 0.28; drawIcon(g, ghost, x + 5, y + 5, 1, '#6a5a7a'); g.globalAlpha = 1; }
  if (it && !canWear(it)) { g.fillStyle = 'rgba(170,20,30,0.4)'; g.fillRect(x, y, 26, 26); }
  if (sel) { g.strokeStyle = (tickN >> 3) & 1 ? '#ffd24a' : '#fff1b0'; g.lineWidth = 2; g.strokeRect(x - 2, y - 2, 30, 30); }
}
const eqPos = i => i < 3 ? [16, 34 + i * 44] : [136, 34 + (i - 3) * 44];
const bagPos = i => [192 + (i & 3) * 31, 30 + (i >> 2) * 31];
function drawTip(it, cmp, x, y) {
  if (!it) { text('EMPTY', x + 75, y + 24, 9, '#6a5a7a', 'center'); return; }
  const R = RARITY[it.rar];
  text(it.name, x + 8, y + 26, it.name.length > 20 ? 8 : 9, R.col);
  text(R.name + ' ' + SLOT_NAME[it.slot], x + 8, y + 38, 8, '#9a90a8');
  text('REQUIRES LV ' + (it.lvl || 1), x + 8, y + 49, 8, canWear(it) ? '#9a90a8' : '#ff6a6a');
  let yy = y + 62;
  for (const k of STAT_KEYS) if (it.st[k]) { text('+' + it.st[k] + STATS[k].sfx + ' ' + statName(k), x + 8, yy, 8, '#8fb8ff'); yy += 12; }
  if (cmp !== undefined) {
    yy += 8; text(cmp ? 'VS EQUIPPED' : 'VS EMPTY SLOT', x + 8, yy, 8, '#c9a8ff'); yy += 12;
    for (const k of STAT_KEYS) { const d = (it.st[k] || 0) - ((cmp && cmp.st[k]) || 0); if (d) { text((d > 0 ? '+' : '') + d + STATS[k].sfx + ' ' + statName(k), x + 8, yy, 8, d > 0 ? '#7aff9a' : '#ff6a6a'); yy += 12; } }
  }
}
function openInv(from) { inv.from = from; inv.z = 'bag'; inv.i = 0; mode = 'inv'; SFX.pick(); }
function invItem() { return inv.z === 'bag' ? rpg.bag[inv.i] : rpg.eq[EQ_ORDER[inv.i]]; }
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
      else if (it) { const old = rpg.eq[it.slot]; rpg.eq[it.slot] = it; if (old) rpg.bag[inv.i] = old; else rpg.bag.splice(inv.i, 1); PS = null; heroStats(false); saveGame(); SFX.pick(); }
    } else {
      const s = EQ_ORDER[inv.i], it = rpg.eq[s];
      if (it && rpg.bag.length < BAG_MAX) { rpg.bag.push(it); delete rpg.eq[s]; PS = null; heroStats(false); saveGame(); SFX.pick(); }
    }
  }
  if ((pressed.KeyX || pressed.Delete) && inv.z === 'bag' && rpg.bag[inv.i]) { rpg.bag.splice(inv.i, 1); saveGame(); SFX.hit(); }
}
function drawInv() {
  g.fillStyle = 'rgba(6,3,12,0.92)'; g.fillRect(0, 0, W, H);
  panel(6, 6, 172, 258, 'CHARACTER'); panel(184, 6, 134, 258, 'BACKPACK'); panel(324, 6, 150, 258, 'ITEM');
  const sv = hero.st, sm = hero.mount; hero.st = 'idle'; hero.mount = null; drawHuman(hero, 92, 150); hero.st = sv; hero.mount = sm;
  EQ_ORDER.forEach((s, i) => { const [x, y] = eqPos(i); slotBox(x, y, rpg.eq[s], inv.z === 'eq' && inv.i === i, s); text(SLOT_NAME[s], x + 13, y + 36, 7, '#8a7a9a', 'center'); });
  const s = pstats(), y0 = 184, need = xpNeed(rpg.lvl);
  text('LV ' + rpg.lvl + (rpg.lvl >= MAX_LV ? '  MAX' : ''), 14, y0, 10, '#ffd24a');
  bar(14, y0 + 5, 154, 4, rpg.lvl >= MAX_LV ? 1 : rpg.xp, rpg.lvl >= MAX_LV ? 1 : need, '#8a6aff', '#1c1430');
  text(rpg.lvl >= MAX_LV ? 'XP MAX' : 'XP ' + rpg.xp + '/' + need, 14, y0 + 22, 8, '#b8a8d8');
  text(cls().stat + ' ' + s.str + '    DMG x' + s.mult.toFixed(2), 14, y0 + 36, 8, '#e8e0f0');
  text('CRIT ' + s.crit + '%   CRIT DMG ' + s.cdmg + '%', 14, y0 + 48, 8, '#e8e0f0');
  text('HIT ' + s.hit + '%    HP ' + s.maxhp, 14, y0 + 60, 8, '#e8e0f0');
  for (let i = 0; i < BAG_MAX; i++) { const [x, y] = bagPos(i); slotBox(x, y, rpg.bag[i], inv.z === 'bag' && inv.i === i); }
  text('ITEMS ' + rpg.bag.length + '/' + BAG_MAX, 251, 164, 8, '#8a7a9a', 'center');
  if (invNoteT > 0) text(invNote, 251, 226, 8, '#ff6a6a', 'center');
  text('ENTER  EQUIP/UNEQUIP', 192, 184, 7, '#b8a8c8'); text('X      DISCARD', 192, 196, 7, '#b8a8c8'); text('I/TAB  CLOSE', 192, 208, 7, '#b8a8c8');
  drawCoins(198, 240, rpg.coins, 14); text('COINS', 244, 244, 7, '#b8a8c8');
  const it = invItem();
  drawTip(it, inv.z === 'bag' && it ? (rpg.eq[it.slot] || null) : undefined, 324, 6);
}
function drawCoin(x, y, on) {
  g.fillStyle = '#0a0610'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
  g.fillStyle = on ? '#ffcf3a' : '#2e2434'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
  if (on) { g.fillStyle = '#fff1a0'; g.fillRect(x - 3, y - 3, 2, 4); g.fillStyle = '#b87a10'; g.fillRect(x + 1, y - 1, 2, 4); }
}

function newHero() {
  hero = hero1 = makeFighter('hero', 60, 205); hero.mana = 60; hero.pn = 1;
  if (coop) { hero2 = makeFighter('hero', 44, 232); hero2.mana = 60; hero2.pn = 2; }
  else hero2 = null;
}
function resetGame() {
  newHero(); heroStats(true); floats = []; intro = null;
  enemies = []; items = []; parts = []; cam = 0; lockX = Infinity; score = 0; waveIdx = 0; shake = 0; freeze = 0; endTimer = 0;
  lastEnemy = null; msg = ''; msgT = 0; mounts = []; dragon = null; impT = 240; flashA = 0; shots = []; story = null; bossRef = null; stageCard = 0; clearT = 0;
}
resetGame();

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
  if (e.dead || e.inv > 0 || e.st === 'down' || e.st === 'getup') return false;
  const dir = sgn(e.x - from.x) || -from.face;
  if (e.pn && !from.pn) dmg = Math.max(1, Math.round(dmg * dmgMul() * (from.kind && BOSSES[from.kind] ? 1.15 : 1) * (from.elite ? 1.25 : 1)));
  if (!e.pn && e.barrier > 0 && e.kind !== 'imp') { // arcane barrier: no damage gets through until it shatters; heavy blows crack it fastest
    const d = kind === 'down' ? dmg : Math.max(1, Math.round(dmg * 0.35));
    e.barrier -= d; e.bflash = 6; e.blockT = tickN; lastEnemy = e; freeze = Math.max(freeze, 2);
    spawn(e.x, e.y, e.z + e.h * 0.55, 6, { c: ['#9ae8ff', '#e0f8ff', '#b88aff'], l0: 8, l1: 16, add: true });
    if (e.barrier <= 0) {
      e.barrier = 0; e.bbreak = tickN; e.st = 'down'; e.t = 0; e.vz = 3; e.vx = dir * 1.6; e.z = Math.max(e.z, 0.01);
      spawn(e.x, e.y, e.z + e.h * 0.5, 26, { s0: 1, s1: 3.2, c: ['#9ae8ff', '#ffffff', '#b88aff'], l0: 12, l1: 28, add: true, size: 2, up: 2, g: 0.06 });
      if (from.pn) floatText(e.x, e.y - e.h - 10, 'BARRIER BROKEN!', '#9ae8ff', 9); SFX.big(); shake = Math.max(shake, 5);
    } else { SFX.land(); if (from.pn) floatText(e.x, e.y - e.z - e.h * 0.9, kind === 'down' ? '-' + d : 'BARRIER', '#9ae8ff', 8); }
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
  else if (!isBoss(e)) { e.st = 'hurt'; e.t = 0; e.vx = dir * 1.1; }
  return true;
}
function strike(att, box, dmg, kind, targets) {
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
      if (hurt(e, r.d, kind, att)) {
        if (e.blockT === tickN) continue;
        floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9, r.crit ? r.d + '!' : String(r.d), r.crit ? '#ffd24a' : '#ffffff', r.crit ? 12 : 8);
        if (r.crit) { shake = Math.max(shake, 5); freeze = Math.max(freeze, 4); sparks(e.x, e.y, e.z + e.h * 0.6, true); }
      }
    } else hurt(e, dmg, kind, att);
  }
}
function startAttack(f, n) { f.st = 'atk'; f.combo = n; f.t = 0; f.queued = false; f.hits.clear(); f.vx = f.face * 1.3; }
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
    if (f.hp <= 0 && !f.dead && f.z === 0 && f.t > 20) { f.dead = true; f.fade = 0; SFX.die(); if (!f.pn) { onKill(f); score += isBoss(f) ? 5000 : f.kind === 'b' ? 400 : 150; if (isBoss(f)) { shake = 14; flashA = 0.5; sparks(f.x, f.y, 30, true); sparks(f.x, f.y, 55, true); SFX.big(); } if (Math.random() < (f.kind === 'h' ? 0.22 : 0.6)) items.push({ x: f.x, y: f.y, t: 0, kind: 'meat' }); } }
    if (f.hp > 0 && f.t > 55) { f.st = 'getup'; f.t = 0; }
    return true;
  }
  if (f.st === 'getup') { if (++f.t > 18) { f.st = 'idle'; f.t = 0; f.inv = 40; } return true; }
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
  { lv: 40, name: 'FLAME WAVE', cd: 260 }, { lv: 50, name: 'METEOR DIVE', cd: 330 }, { lv: 60, name: 'EMBER NOVA', cd: 400 }, { lv: 70, name: 'HEART-EMBER BURST', cd: 900 }
];
const skillsOf = () => SKILLS.filter(k => k.lv <= rpg.lvl);
function skillOf(f) { const a = skillsOf(); return a.length ? a[clamp(f.ski == null ? a.length - 1 : f.ski, 0, a.length - 1)] : null; }
function cycleSkill(f) { const a = skillsOf(); if (a.length < 2) return; f.ski = ((f.ski == null ? a.length - 1 : f.ski) + 1) % a.length; SFX.pick(); floatText(f.x, f.y - 66, skillOf(f).name, '#8cc4ff', 8); }
function castSkill(f) {
  const S = skillOf(f); if (!S || f.skcd > 0 || f.mount) return false;
  f.sk = { id: SKILLS.indexOf(S), face0: f.face }; f.st = 'atk'; f.combo = 2; f.t = 0; f.queued = false; f.hits.clear(); f.skcd = S.cd; f.inv = Math.max(f.inv, 14); f.vx = 0;
  floatText(f.x, f.y - 66, S.name + '!', '#8cc4ff', 8); return true;
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
  } else if (id === 6) { // heart-ember burst: screen-wide blast that heals the party
    if (t < 18 && t % 4 === 0) spawn(f.x, f.y, 30, 6, { s0: 0.4, s1: 1.4, c: ['#fff1b0', '#ffd24a', '#c9a8ff'], l0: 14, l1: 26, add: true, up: 2.4, g: 0.04 });
    if (t === 18) {
      f.hits.clear(); strike(f, { x0: -W, x1: W, dy: 200, z0: -40, z1: 200 }, 70, 'down', foes);
      for (const p of players()) if (!p.dead) p.hp = Math.min(p.maxhp, p.hp + (p.maxhp * 0.15 | 0));
      flashA = 0.8; shake = Math.max(shake, 16); burst(80, ['#fff1b0', '#ffd24a', '#ffffff'], 5.4); SFX.magic(); SFX.big();
    }
    if (t >= 40) end();
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
  f.t++; if (f.inv > 0) f.inv--; if (f.flash > 0) f.flash--; if (f.skcd > 0) f.skcd--;
  if (f.sk && f.st !== 'atk') f.sk = null;
  if (f.dead) {
    f.fade++;
    if (coop) { const mate = players().find(p => p !== f && !p.dead); if (mate && f.fade > 240 && rpg.coins > 0 && mode === 'play') { rpg.coins--; reviveP(f, mate); return; } }
    if (f.fade > 90 && mode === 'play' && players().every(p => p.dead && p.fade > 90)) { mode = 'gameover'; endTimer = 0; }
    return;
  }
  if (groundPhysics(f)) return;
  const mx = (inD(f, 'right') ? 1 : 0) - (inD(f, 'left') ? 1 : 0), my = (inD(f, 'down') ? 1 : 0) - (inD(f, 'up') ? 1 : 0);
  const foes = enemies, spd = f.mount ? mtype(f.mount).spd : f.k.spd;
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
        f.mount = wild; mounts.splice(mounts.indexOf(wild), 1); SFX.pick(); sparks(f.x, f.y, 20, true);
        msg = mtype(wild).name + '!   J: ' + mtype(wild).info + (wild.falls ? '   (1 FALL LEFT)' : '   E: DISMOUNT'); msgT = 130;
      } else if (inH(f, 'dismount') && f.mount) {
        const m = f.mount; m.x = f.x - f.face * 12; m.y = f.y; m.face = f.face; m.z = 0.01; m.vz = 2; mounts.push(m); f.mount = null;
      } else if (inH(f, 'jump')) { f.st = 'jump'; f.vz = f.mount ? mtype(f.mount).jump : (f.k.jump || 5.4); f.vx = mx * (f.mount ? mtype(f.mount).spd * 0.92 : 1.5); f.t = 0; f.hits.clear(); }
      else if (inH(f, 'skill') && castSkill(f)) { }
      else if (inH(f, 'atk')) { if (f.mount) { f.st = 'ratk'; f.t = 0; f.hits.clear(); SFX.swing(); } else startAttack(f, 0); }
      else if (inH(f, 'magic') && f.mana >= 60 && !dragon) castDragon();
      break;
    }
    case 'atk': {
      if (f.sk) { stepSkill(f); break; }
      const CB = comboOf(f), c = CB[f.combo], mage = f.k.cls === 'panni';
      if (f.t === c.a) { SFX.swing(); if (mage) { // Panni throws arcane bolts instead of swinging
        shots.push({ type: 'mbolt', owner: f, x: f.x + f.face * 18, y: f.y, z: 30, vx: f.face * (c.big ? 3.4 : 4.6), t: 0, dmg: c.dmg, kind: c.kind, big: !!c.big, life: c.big ? 72 : 54, hit: new Set() });
        spawn(f.x + f.face * 22, f.y, 32, 6, { c: ['#e0d0ff', '#b88aff'], l0: 6, l1: 14, add: true }); } }
      if (f.t < 7) f.x += f.vx * (mage ? 0.3 : 1), f.vx *= 0.9;
      if (!mage && f.t >= c.a && f.t <= c.b) strike(f, { x0: 0, x1: f.k.cls === 'luca' ? 32 : 40, dy: 11, z0: 4, z1: 40 }, c.dmg, c.kind, foes);
      if (inH(f, 'atk') && f.combo < CB.length - 1 && f.t >= (f.k.cls === 'luca' ? 3 : 5)) f.queued = true;
      if (f.t >= c.d) { if (f.queued) startAttack(f, f.combo + 1); else { f.st = 'idle'; f.t = 0; } }
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
function updateEnemy(e) {
  if (e.kind === 'imp') { updateImp(e); return; }
  e.t++; if (e.inv > 0) e.inv--; if (e.flash > 0) e.flash--;
  if (e.dead) { e.fade++; if (e.pitT) e.pitT++; return; }
  if (e.leap && e.st !== 'eatk' && e.st !== 'wind') { e.leap = 0; e.z = 0; }
  if (e.barrier === 0 && e.bmax && e.kind === 'warder' && tickN - e.bbreak > 900 && tickN - (e.lastHit || 0) > 300) { e.barrier = e.bmax; spawn(e.x, e.y, e.h * 0.5, 16, { c: ['#9ae8ff', '#b88aff'], add: true, l0: 12, l1: 24, up: 1.5 }); SFX.magic(); }
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
          const allies = enemies.filter(o => o !== e && !o.dead && !isBoss(o) && o.kind !== 'imp' && !(o.barrier > 0) && Math.abs(o.x - e.x) < 170);
          if (e.barrier > 0 && allies.length && enemies.filter(o => o.ward === e && o.barrier > 0).length < 2 && Math.random() < 0.6) {
            const o = allies[Math.random() * allies.length | 0]; o.ward = e; o.barrier = o.bmax = Math.round(o.maxhp * 0.6);
            zap(e.x + e.face * 8, e.y, 50, o.x, o.y, o.h * 0.6); spawn(o.x, o.y, o.h * 0.5, 14, { c: ['#9ae8ff', '#b88aff'], add: true, l0: 10, l1: 22 }); SFX.magic();
          } else { shots.push({ type: 'bolt', x: e.x + e.face * 16, y: e.y, z: 30, vx: e.face * 2.6, t: 0, dmg: k.dmg, life: 200 }); SFX.swing(); }
        } else {
          for (const p of players()) if (!p.dead && Math.abs(p.x - e.x) < 320) shots.push({ type: 'rune', x: p.x + p.vx * 18, y: clamp(p.y + (p.vy || 0) * 18, Y_MIN, Y_MAX), t: 0, delay: 54, r: 24, dmg: k.dmg, pool: stageIdx >= 5 ? 200 : 150 });
          if (stageIdx >= 15 || cycle) shots.push({ type: 'rune', x: clamp(hero.x + rnd(-70, 70), cam + 20, cam + W - 20), y: rnd(Y_MIN, Y_MAX), t: 0, delay: 66, r: 24, dmg: k.dmg, pool: 150 });
          tone('sawtooth', 180, 420, 0.3, 0.05);
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
function pickMountType() { const a = ['ember']; if (stageIdx >= 1 || cycle) a.push('storm'); if (stageIdx >= 2 || cycle) a.push('stone'); return a[Math.random() * a.length | 0]; }
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
  hero.mana -= 60; hero.vases = 0; hero.st = 'magic'; hero.t = 0; hero.inv = 190;
  dragon = { t: 0, v, mult: 1 + 0.15 * v, size: 1 + 0.15 * v, by: hero };
  msg = v ? `DRAGON'S WRATH  +${v * 15}%` : "DRAGON'S WRATH"; msgT = 120; SFX.magic();
}
function stepDragon() {
  const d = dragon; d.t++;
  if (d.t === 6) tone('sawtooth', 55, 30, 1.2, 0.1);
  if (d.t < 62 && d.t % 18 === 0) { flashA = 0.35; tone('square', 220, 40, 0.2, 0.05); }
  if (d.t === 62) dragonImpact();
  if (d.t >= 128) { d.by.inv = Math.max(d.by.inv, 30); dragon = null; }
}
function dragonImpact() {
  const d = dragon, dmg = 130 * d.mult; shots = [];
  hero.st = 'idle'; hero.t = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    e.inv = 0; if (e.st === 'down' || e.st === 'getup') e.st = 'idle';
    hurt(e, dmg, 'down', { x: cam + W / 2, face: 1 });
  }
  shake = 22; freeze = 8; flashA = 1;
  SFX.big(); tone('sawtooth', 70, 20, 0.9, 0.14);
  for (let i = 0; i < 3; i++) parts.push({ ring: true, x: cam + W / 2, y: 215, z: 4, life: 26 + i * 6, max: 26 + i * 6 });
  const n = 70 + d.v * 30;
  for (let i = 0; i < n; i++) {
    parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 8), vx: rnd(-1.5, 1.5), vy: 0, vz: rnd(2, 6.5), life: rnd(24, 50), max: 50, g: 0.22, c: ['#4a3a50', '#6a5870', '#2a2030'][i % 3], size: i % 4 ? 2 : 3, add: false });
    if (i % 2) parts.push({ x: cam + rnd(0, W), y: rnd(Y_MIN, Y_MAX), z: rnd(0, 6), vx: rnd(-1, 1), vy: 0, vz: rnd(1, 4), life: rnd(16, 34), max: 34, g: 0.05, c: ['#fff1b0', '#ffb43a', '#ff5a1f'][i % 3], size: 2, add: true });
  }
}

/* ---------- campaign flow: story screens, stages ---------- */
/* ---------- pause menu ---------- */
const PAUSE_ITEMS = ['RESUME', 'MUSIC', 'SOUND FX', 'CRT FILTER', 'LANGUAGE', 'SKILLS', 'CONTROLS', 'QUIT TO TITLE'];
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
  else if (pauseI === 4) { setLang(LANG === 'hu' ? 'en' : 'hu'); SFX.pick(); }
  else if (pauseI === 5) pausePg = 2;
  else if (pauseI === 6) pausePg = 1;
  else if (pauseI === 7) { saveGame(); toTitle(); }
}
function drawPause() {
  g.fillStyle = 'rgba(4,2,10,0.72)'; g.fillRect(0, 0, W, H);
  panel(W / 2 - 110, 40, 220, 196, 'PAUSED');
  if (pausePg === 1) {
    const L = ['MOVE      WASD / ARROWS', 'ATTACK    J / Z', 'JUMP      K / X / SPACE', 'MAGIC     SHIFT / L / C', 'SKILL     U CAST, Q SWAP', 'RIDE/DISMOUNT   K / E', 'GEAR      I / TAB', 'PAUSE     ESC / P', 'PAD  STICK, X A B Y, LB/LT SKILL', 'PLAYER 2  ARROWS  , . /  ; \\'];
    L.forEach((t, i) => text(t, W / 2 - 96, 78 + i * 13, 8, '#e8dcc8', 'left'));
    text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  if (pausePg === 2) {
    const cur = skillOf(hero);
    SKILLS.forEach((k, i) => { const on = k.lv <= rpg.lvl, y = 80 + i * 18; text('LV ' + k.lv, W / 2 - 96, y, 8, on ? '#8cc4ff' : '#4a4a5a', 'left'); text(k.name, W / 2 - 60, y, 9, on ? (cur === k ? '#ffd24a' : '#e8dcc8') : '#4a4a5a', 'left'); if (!on) text('LOCKED', W / 2 + 96, y, 7, '#4a4a5a', 'right'); else if (cur === k) text('ACTIVE', W / 2 + 96, y, 7, '#ffd24a', 'right'); });
    text('YOUR LEVEL ' + rpg.lvl + '.  U CAST   Q SWAP SKILL', W / 2, 214, 8, '#b8a8c8', 'center'); text('PRESS ENTER TO GO BACK', W / 2, 226, 8, '#c9a8ff', 'center'); return;
  }
  PAUSE_ITEMS.forEach((t, i) => {
    const sel = i === pauseI, y = 74 + i * 18, v = i === 1 ? musicOn : i === 2 ? sfxOn : i === 3 ? crtOn : null;
    if (sel) { g.fillStyle = 'rgba(255,180,60,0.22)'; g.fillRect(W / 2 - 98, y - 11, 196, 15); }
    text(t, W / 2 - 86, y, 10, sel ? '#ffd24a' : '#b8a8c8', 'left');
    if (v !== null) text(v ? 'ON' : 'OFF', W / 2 + 86, y, 10, v ? '#8aff9a' : '#ff6a6a', 'right');
    if (i === 4) text(LANG === 'hu' ? 'MAGYAR' : 'ENGLISH', W / 2 + 86, y, 10, '#8cc4ff', 'right');
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
  stageIdx = i; const S = STAGES[i]; TH = themeFor(S.theme, actOf(i)); weather = WEATHER[actOf(i)][S.theme]; WAVES = S.waves; STAGE_END = S.end;
  cam = 0; lockX = Infinity; waveIdx = 0; enemies = []; items = []; mounts = []; parts = []; shots = []; bossRef = null; dragon = null;
  impT = 240; clearT = 0; lastEnemy = null; goBlink = 0; msg = ''; msgT = 0; stageCard = 190; flashA = 0; shake = 0; freeze = 0;
  intro = null; slashes = []; vents = [];
  gaps = []; ambW = -1;
  { const bw = S.waves.find(w => w.e.some(t => BOSSES[t])), stop = bw ? bw.x - 320 : S.end - 300, n = i === 0 ? 2 : 2 + Math.min(3, actOf(i) + ((i % 5) >= 2 ? 1 : 0));
    if (i === 0) { gaps.push({ x: 590, w: 14, type: 'wall' }); gaps.push({ x: 1600, w: 34, type: 'pit' }); }
    else for (let x = 520 + (i * 37) % 120, k = 0; x < stop && k < n; x += 330 + ((i * 53 + k * 71) % 200), k++) { const pit = (i + k) % 3 !== 0; gaps.push({ x, w: pit ? 34 + ((i + k) * 13) % 9 : 14, type: pit ? 'pit' : 'wall' }); } }
  if (i >= 1) for (let x = 420, k = 0; x < S.end - 300; x += 330 + (k * 67) % 140, k++) if (!gaps.some(q => Math.abs(q.x + q.w / 2 - x) < 60)) vents.push({ x, y: Y_MIN + 20 + (k * 53) % (Y_MAX - Y_MIN - 30), ph: (k * 97) % 260, hit: new Set() });
  for (const p of players()) {
    if (p.dead && coop) { p.dead = false; p.fade = 0; p.hp = Math.max(1, p.maxhp >> 1); }
    p.pitT = 0; p.x = p.pn === 2 ? 40 : 60; p.y = p.pn === 2 ? 232 : 205; p.z = 0; p.vx = 0; p.vz = 0; p.st = 'idle'; p.t = 0; p.mount = null; p.inv = 90; p.hits.clear();
    if (!p.dead && i > 0) p.hp = Math.min(p.maxhp, p.hp + 70);
  }
  mode = 'play'; saveRun(i);
}
function startCampaign(two) {
  clearRun();
  coop = !!two; cycle = 0; resetGame(); stageIdx = 0; TH = THEMES[0]; rpg.coins = 3; rpg.gold = 0; shop = null;
  openStory('THE ASHEN VOW', 'A TALE OF EMBERFALL', STORY.intro, () => beginStage(0), 0);
}
function nextCycle() {
  cycle++; rpg.coins = Math.min(MAX_COINS, rpg.coins + 1);
  for (const p of players()) { p.dead = false; p.fade = 0; p.hp = p.maxhp; p.mana = Math.max(p.mana, 60); }
  openStory('THE ASH RETURNS', 'CYCLE ' + (cycle + 1), STORY.loop, () => beginStage(0), 0);
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
    const col = o.sold ? '#5a4a6a' : o.kind === 'gear' ? RARITY[o.it.rar].col : o.kind === 'go' ? '#9fd0ff' : '#ffffff';
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
function stageCleared() {
  score += 3000; saveGame(); openShop(afterClear);
}
function afterClear() {
  const S = STAGES[stageIdx];
  if (stageIdx < STAGES.length - 1) saveRun(stageIdx + 1);
  if (stageIdx < STAGES.length - 1) openStory(`STAGE ${stageIdx + 1} CLEARED`, S.name, S.clear, () => beginStage(stageIdx + 1), STAGES[stageIdx + 1].theme, actOf(stageIdx + 1));
  else openStory(cycle === 0 ? 'THE END' : 'CYCLE ' + (cycle + 1) + ' COMPLETE', 'EMBERFALL', cycle === 0 ? STORY.ending : STORY.cycleEnd, () => { score += 5000 * (cycle + 1); mode = 'victory'; endTimer = 0; TH = THEMES[4]; saveGame(); }, 4);
}

/* ---------- boss AI & projectiles ---------- */
const WINDUP = { bite: 26, tail: 24, breath: 34, flames: 30, swipe: 22, spit: 28, summon: 46, smash: 40, charge: 36, quake: 34, slash: 18, blink: 24, meteor: 56 };
function bossPhase2(e) {
  if (!e.p2 && e.hp < e.maxhp * 0.5) {
    e.p2 = true; e.cool = 30; shake = 12; flashA = 0.4; freeze = 10; msg = 'ENRAGED!'; msgT = 80; sparks(e.x, e.y, e.h * 0.6, true); SFX.big();
    const esc = [MINION[stageIdx % 5] || 'h', stageIdx >= 1 || cycle ? 'warder' : 'h']; // the enraged boss calls in escorts
    esc.forEach((t, i) => { const f = makeFighter(t, i ? cam + W + 30 : cam - 30, rnd(Y_MIN + 6, Y_MAX - 6)); if (t === 'h' && STAGES[stageIdx].tint) f.k = Object.assign({}, f.k, STAGES[stageIdx].tint); enemies.push(f); });
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
    if (e.atk === 'blink' && e.t === 1) spawn(e.x, e.y, e.h * 0.5, 16, { c: ['#ff6a9a', '#ffb0c8'], add: true, l0: 10, l1: 24 });
    if (e.atk === 'meteor' && e.t === 8) {
      const n = p2 ? 9 : 6;
      for (let i = 0; i < n; i++) shots.push({ type: 'meteor', x: i === 0 ? hero.x : clamp(hero.x + rnd(-130, 130), cam + 20, cam + W - 20), y: i === 0 ? hero.y : rnd(Y_MIN, Y_MAX), t: 0, delay: 40 + i * 6, dmg: 22 });
      tone('sawtooth', 400, 90, 0.5, 0.06);
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
        spawn(e.x + e.face * 30, e.y, 22, 10, { c: ['#7aff9a', '#e8fff0'], add: true, l0: 8, l1: 16 }); tone('sawtooth', 300, 700, 0.18, 0.05);
      }
      if (t >= 14) end(p2 ? 45 : 80);
      break;
    case 'summon':
      if (t === 1) {
        for (let i = 0; i < 2; i++) { const f = makeFighter('h', i ? cam + W + 30 : cam - 30, rnd(Y_MIN + 6, Y_MAX - 6)); f.k = Object.assign({}, f.k, STAGES[stageIdx].tint || {}); enemies.push(f); }
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
        e.y = clamp(e.y + clamp(hero.y - e.y, -0.6, 0.6), Y_MIN, Y_MAX);
        if (t % 10 === 2) e.hits.clear();
        strike(e, { x0: 40, x1: 190, dy: 14, z0: 0, z1: 80 }, 11, t > 42 ? 'down' : 'hurt', players());
        if (t % 8 === 0) shake = Math.max(shake, 3);
      }
      if (t >= 60) end(p2 ? 45 : 85);
      break;
    case 'flames':
      if (t === 2 || (p2 && t === 12)) { for (const dy of [-18, 0, 18]) shots.push({ type: 'wave', x: e.x + e.face * 90, y: clamp(hero.y + dy, Y_MIN, Y_MAX), z: 0, vx: e.face * 3, t: 0, dmg: 15, life: 120 }); SFX.big(); }
      if (t >= 22) end(p2 ? 45 : 80);
      break;
    default: end(60);
  }
}
function updateShots() {
  const realHero = hero;
  for (const s of shots) {
    s.t++; hero = nearestPlayer(s.x);
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
      s.x += s.vx;
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
        if (r.miss) { floatText(e.x, e.y - e.h * 0.8, 'MISS', '#9aa0b0', 8); } else if (hurt(e, r.d, s.kind, { x: s.x - sgn(s.vx) * 20, face: sgn(s.vx), pn: o.pn, k: o.k, get mana() { return o.mana; }, set mana(v) { o.mana = v; } }) && e.blockT !== tickN) floatText(e.x + rnd(-6, 6), e.y - e.z - e.h * 0.9, r.crit ? r.d + '!' : String(r.d), r.crit ? '#ffd24a' : '#ffffff', r.crit ? 12 : 8);
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
  }
  hero = realHero;
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
        g.strokeStyle = `rgba(255,${120 + (tickN % 6) * 14},40,${0.35 + 0.5 * p})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, s.r, s.r / 2.4, 0, 0, 7); g.stroke();
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
  if (!BOSSES[t] && !hasBoss && (stageIdx >= 2 || cycle) && Math.random() < 0.05 + 0.01 * Math.min(stageIdx + cycle * 10, 12)) { // elite: bigger, faster, deadlier, better loot
    f.elite = true; f.glow = '255,200,80'; f.hp = f.maxhp = Math.round(f.maxhp * 1.8); f.h = Math.round(f.h * 1.12);
    f.k = Object.assign({}, f.k, { name: 'ELITE ' + f.k.name, scale: f.k.scale * 1.12, spd: f.k.spd * 1.15, armor2: '#ffd24a' });
  }
  enemies.push(f); return f;
}
function updateStage() {
  const w = WAVES[waveIdx];
  if (w && lockX === Infinity && leadX() > w.x - 120) {
    lockX = w.x - 200 > cam ? Math.max(cam, w.x - 200) : cam;
    // later stages throw bigger crowds: extra husks, brutes from stage 3, more escorts around bosses
    const hasBoss = w.e.some(t => BOSSES[t]), list = buildList(w); let rode = false;
    list.forEach((t, i) => {
      const side = i % 2 ? 1 : -1;
      const ex = side > 0 ? lockX + W + 30 + i * 22 : lockX - 30 - i * 22;
      const f = spawnFoe(t, ex, hasBoss);
      if (t === 'h' && !rode && ((stageIdx === 0 && !cycle && waveIdx === 0 && i === 0) || Math.random() < 0.08 + 0.02 * Math.min(stageIdx + cycle, 5))) { rode = true; f.mount = makeMount(0, 0, 0, pickMountType()); f.hp = f.maxhp = 60; f.h = f.k.h + 12; } // wyrmlings are rare now: at most one per wave
    });
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
    if (waveIdx >= WAVES.length) { clearT = LOOT_T; msg = 'STAGE CLEAR'; msgT = 150; goBlink = 0; }
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
      P.vases++; msg = `EMBER JAR ${P.vases}/3    WRATH +${P.vases * 15}%`; msgT = 100;
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
        if (Math.abs(f.x - v.x) < 18 && Math.abs(f.y - v.y) < 10) { v.hit.add(f); hurt(f, f.pn ? 9 : 14, 'down', { x: v.x, face: 1, pn: 0 }); if (f.pn) floatText(f.x, f.y - 50, 'SCORCHED', '#ff8a2a', 8); }
      }
    } else if (t >= 70 && t < 100 && t % 5 === 0 && Math.abs(v.x - cam - W / 2) < W) spawn(v.x, v.y, 2, 1, { s0: 0.2, s1: 0.5, c: '#ffb43a', l0: 8, l1: 14, add: true, size: 1, up: 1, g: 0 });
  }
}
function drawGaps() {
  for (const q of gaps) {
    const x0 = Math.round(q.x - cam), x1 = Math.round(q.x + q.w - cam); if (x1 < -40 || x0 > W + 40) continue;
    const top = Y_MIN - 14;
    if (q.type === 'pit') { // a chasm across the whole road, ember-light far below
      const sk = 0.18, P = (y, s) => [x0 + (y - top) * sk * s, x1 + (y - top) * sk * s];
      g.fillStyle = '#020104'; g.beginPath(); g.moveTo(...[P(top, 1)[0], top]); g.lineTo(P(top, 1)[1], top); g.lineTo(P(H, 1)[1], H); g.lineTo(P(H, 1)[0], H); g.fill();
      const gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, 'rgba(255,90,20,0.0)'); gr.addColorStop(1, `rgba(255,90,20,${0.18 + 0.06 * Math.sin(tickN * 0.05 + q.x)})`); g.fillStyle = gr; g.fill();
      for (let y = top; y < H; y += 6) { const a = P(y, 1), j = ((q.x * 7 + y * 13) % 5) - 2; g.fillStyle = '#7a6a70'; g.fillRect(Math.round(a[0]) - 3 + j, y, 4, 5); g.fillRect(Math.round(a[1]) - 1 - j, y, 4, 5); g.fillStyle = '#a8949a'; g.fillRect(Math.round(a[0]) - 3 + j, y, 4, 1); g.fillRect(Math.round(a[1]) - 1 - j, y, 4, 1); g.fillStyle = '#100810'; g.fillRect(Math.round(a[0]) + 1 + j, y, 3, 6); g.fillRect(Math.round(a[1]) - 4 - j, y, 3, 6); }
      if (((tickN + q.x) % 40) === 0) spawn(q.x + q.w / 2 + rnd(-8, 8), rnd(Y_MIN, Y_MAX), -2, 1, { c: '#ff8a2a', s0: 0.1, s1: 0.3, l0: 20, l1: 40, add: true, up: 0.8, g: -0.01, size: 1 });
    } else { // a rubble barricade
      for (let y = top; y < H; y += 7) {
        const xx = Math.round(x0 + (y - top) * 0.18), hsh = ((q.x * 31 + y * 17) >>> 0) % 7, ht = 14 + hsh;
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
    if (on) { const h = 70 * Math.sin((t - 100) / 18 * Math.PI) + 10; const gr = g.createLinearGradient(0, v.y - h, 0, v.y); gr.addColorStop(0, 'rgba(255,120,30,0)'); gr.addColorStop(0.5, 'rgba(255,170,60,0.85)'); gr.addColorStop(1, 'rgba(255,240,180,0.95)'); g.fillStyle = gr; g.fillRect(x - 6, v.y - h, 12, h); }
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
    if (pressed.KeyR) { if (resetArm > 0) { rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; PS = null; saveGame(); heroStats(true); resetArm = 0; } else resetArm = 180; }
    else if (isHit('inv')) { openInv('title'); return; }
    else if (pressed.KeyB) { boardHi = -1; mode = 'board'; return; }
    else if (pressed.Digit2 || pressed.Numpad2) { openSelect(true); return; }
    else if (isHit('start') || isHit('atk')) { openSelect(false); return; }
    updateParts(); cam += 0.3; return;
  }
  if (mode === 'select') { updateSelect(); updateParts(); cam += 0.3; return; }
  if (mode === 'resume') { updateResume(); updateParts(); cam += 0.3; return; }
  if (mode === 'story') { updateStory(); return; }
  if (mode === 'inv') { updateInv(); return; }
  if (mode === 'shop') { updateShop(); return; }
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
  if (mode === 'victory') { endTimer++; updateParts(); if (endTimer > 30) { if (isHit('start')) nextCycle(); else if (isHit('back')) endRun(true); } return; }
  if (isHit('pause') && !hero.dead && !dragon) { openPause(); return; }
  if (isHit('inv') && !hero.dead && !dragon && hero.st !== 'down') { openInv('play'); return; }
  if (intro) { updateIntro(); return; }
  if (freeze > 0) { freeze--; return; }
  if (dragon) { stepDragon(); if (dragon && dragon.t < 62) { updateParts(); return; } }
  for (const p of players()) withHero(p, () => updateHero(p));
  enemies.forEach(e => withHero(nearestPlayer(e.x), () => updateEnemy(e))); updateShots();
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

function drawWeapon(g, C, kind, len, gt) {
  const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x, y, w, h); };
  const P = (pts, c) => { g.fillStyle = C(c); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  if (kind === 'hero') {
    R(-1.5, -3, 3, 10, '#4a2e1a'); R(-1.5, -3, 1, 10, '#6b4426');
    R(-6, -6, 12, 3, '#c9962e'); R(-6, -6, 12, 1, '#ffe08a'); R(-2.5, 7, 5, 3, '#c9962e');
    const wt = gt | 0, bc = ['#8a8f99', '#a9bdd6', '#8cc4ff', '#ffd870', '#ff7a3a'][wt], b2 = ['#c8ccd6', '#f4fbff', '#e6f6ff', '#fff6d0', '#fff0a0'][wt], b3 = ['#5a5e68', '#6f86a3', '#4a7ac8', '#c8962e', '#c8401a'][wt];
    P([-2.6, -6, 2.6, -6, 2, -len, 0, -len - 5, -2, -len], bc);
    R(-1.2, -len + 2, 1.6, len - 8, b2); R(1, -len + 2, 1.3, len - 8, b3);
    if (wt >= 2) { g.globalCompositeOperation = 'lighter'; g.fillStyle = wt === 2 ? 'rgba(120,190,255,0.22)' : wt === 3 ? 'rgba(255,220,120,0.26)' : 'rgba(255,120,50,0.3)'; g.fillRect(-4, -len - 4, 8, len); g.globalCompositeOperation = 'source-over'; }
    if (wt >= 4) { const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5; for (let i = 0; i < 4; i++) { const fy = -len + 4 + i * ((len - 12) / 3); P([2.4, fy, 5 + f2 * 2.5, fy - 4 - f2 * 2, 2.4, fy - 7], i % 2 ? '#ff8a2a' : '#ffd070'); } }
  } else if (kind === 'pstaff') { // Panni's staff: the crystal glows brighter with rarer weapons
    const wt = gt | 0, gc = ['#b88aff', '#d8d0e8', '#7ab0ff', '#ffd870', '#ff6aa8'][wt], gl = 0.6 + Math.sin(tickN * 0.2) * 0.4;
    R(-1.2, -len + 2, 2.4, len + 12, '#4a3020'); R(-1.2, -len + 2, 0.8, len + 12, '#6a4a30');
    P([-4, -len + 2, 0, -len - 3, 4, -len + 2, 0, -len + 5], '#c9962e');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(200,170,255,${0.25 + gl * 0.25})`; g.fillRect(-5, -len - 12, 10, 10); g.globalCompositeOperation = 'source-over';
    P([0, -len - 12, 3.5, -len - 6, 0, -len - 1, -3.5, -len - 6], gc); R(-1, -len - 9, 1.5, 3, '#ffffff');
    if (wt >= 4) { const f2 = 0.5 + Math.sin(tickN * 0.35) * 0.5; P([-3, -len - 10, 0, -len - 17 - f2 * 3, 3, -len - 10], '#ffd070'); }
  } else if (kind === 'dagger') {
    const wt = gt | 0, bc = ['#8a8f99', '#a9bdd6', '#8cc4ff', '#ffd870', '#ff7a3a'][wt];
    R(-1.2, -2, 2.4, 6, '#2a1a12'); R(-3.5, -3, 7, 1.8, '#8a7a5a');
    P([-1.8, -3, 1.8, -3, 1.2, -len, 0, -len - 3, -1.2, -len], bc); R(-0.4, -len + 1, 0.9, len - 4, '#f4fbff');
    if (wt >= 3) { g.globalCompositeOperation = 'lighter'; g.fillStyle = wt === 3 ? 'rgba(255,220,120,0.3)' : 'rgba(255,120,50,0.35)'; g.fillRect(-3, -len - 3, 6, len); g.globalCompositeOperation = 'source-over'; }
  } else if (kind === 'h') {
    R(-1.5, -len + 4, 3, len + 6, '#6b4a2a'); R(-1.5, -len + 4, 1, len + 6, '#8a6238');
    P([1.5, -len, 10, -len - 5, 11, -len + 9, 1.5, -len + 6], '#8a8f99'); P([1.5, -len + 1, 7, -len - 2, 7, -len + 6, 1.5, -len + 5], '#b9bec8'); R(10, -len - 4, 1.4, 12, '#e8edf5');
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
  const dk = c => shade(c, -0.38), lt = c => shade(c, 0.3);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = (f.ghost != null && !f.dead) ? f.ghost : (kind === 'king' && f.st === 'wind' && f.atk === 'blink') ? 0.3 : (f.dead && f.fade > 8) ? Math.max(0, 1 - (f.fade - 8) / 40) : ((f.inv > 0 && f.inv < 100 && (tickN >> 2) & 1 && f.pn && !f.sk) ? 0.45 : 1);
  const brth = BOSSES[kind] && !f.dead ? 1 + Math.sin(tickN * 0.06 + f.x) * 0.018 : 1, hov = kind === 'witch' && !f.dead ? -4 - Math.sin(tickN * 0.07) * 3 : 0;
  g.save(); g.translate(AX, AY + hov); g.scale(f.face * sc, sc * brth);
  const riding = !!f.mount, winding = f.st === 'wind', walking = f.st === 'walk' && !riding;
  const lay = f.st === 'down' && f.z === 0;
  if (lay) { g.rotate(-Math.PI / 2 * 0.92); g.translate(-4, -2); } else if (f.st === 'down') g.rotate(-0.7);
  const air = f.z > 1 && !lay && !riding, ph = f.anim;
  const la = riding ? 5 : air ? 4 : Math.sin(ph) * 5, lb = riding ? -4 : air ? -3 : -Math.sin(ph) * 5;
  const bob = walking ? Math.abs(Math.sin(ph)) * 1.5 : (f.st === 'idle' ? Math.sin(tickN * 0.07) * 0.6 : 0);
  const lean = winding ? -2 : f.st === 'atk' ? 2 : 0;
  const big = kind === 'b' || !!BOSSES[kind];
  const GT = (kind === 'hero' && k.gt) || {}, hT = GT.helm | 0, aT = GT.armor | 0, bT = GT.boots | 0, wT = GT.weapon | 0, amT = GT.amulet | 0;
  const ik = (x0, y0, x1, y1, l1, l2, dir) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 0.01, d = Math.min(L, l1 + l2 - 0.05), a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / L, uy = dy / L; return [x0 + ux * a - uy * h * dir, y0 + uy * a + ux * h * dir, x0 + ux * d, y0 + uy * d]; };
  const arm2 = (x0, y0, tx, ty, l1, l2, w, cU, cF, dir) => { const [ex, ey, hx, hy] = ik(x0, y0, tx, ty, l1, l2, dir); g.lineCap = 'round'; g.strokeStyle = C(cU); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke(); g.strokeStyle = C(cF); g.lineWidth = w * 0.9; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx, hy); g.stroke(); g.fillStyle = C(cU); g.beginPath(); g.arc(ex, ey, w * 0.55, 0, 7); g.fill(); return [hx, hy, ex, ey]; };
  const chain = (x0, y0, n, len, sway, off, w, c) => { g.strokeStyle = C(c); g.lineCap = 'round'; let x = x0, y = y0, a = 2.5 + (walking ? 0.25 : 0); for (let i = 0; i < n; i++) { a += Math.sin(tickN * 0.07 + off + i * 0.7) * sway * 0.25; const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len; g.lineWidth = Math.max(0.8, w * (1 - i / n)); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny; } };
  const claw = (hx, hy, ux, uy, len, spread, c, w) => { g.strokeStyle = C(c); g.lineWidth = w; g.lineCap = 'round'; for (let q = -1; q <= 1; q++) { const ca = Math.cos(q * spread), sa = Math.sin(q * spread); g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + (ux * ca - uy * sa) * len, hy + (ux * sa + uy * ca) * len); g.stroke(); } };
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
  if (kind === 'hero') {
    const sw = Math.sin(tickN * 0.12) * 2 + (walking ? -4 : 0) + (air ? -5 : 0) - (f.st === 'atk' ? 2 : 0);
    P([-6 + lean, -35 - bob, 2 + lean, -35 - bob, -3 + sw, -5, -17 + sw, -3], dk(k.cloth));
    P([-6 + lean, -35 - bob, -1 + lean, -35 - bob, -7 + sw, -6, -16 + sw, -4], k.cloth);
    R(-17 + sw, -4, 14, 1, lt(k.cloth));
  }
  if (f.vase) { P([-15, -35 - bob, -8, -35 - bob, -7, -27 - bob, -9, -22 - bob, -14, -22 - bob, -16, -27 - bob], '#3a78c8'); R(-14, -37 - bob, 6, 3, '#e6c97a'); R(-14, -33 - bob, 2, 8, '#bfe6ff'); }
  // back arm
  const bax = -6 + lean, bay = -31 - bob, bhx = -7 + Math.sin(ph + 3) * (walking ? 4 : 1), bhy = -17 - bob;
  if (kind !== 'boss') { limb(bax, bay, bhx, bhy, 4, dk(k.skin), -1, 0); limb(bax, bay, (bax + bhx) / 2, (bay + bhy) / 2, 5, dk(k.armor), -1, 0); }
  if (k.cls === 'luca') { g.save(); g.translate(bhx, bhy); g.rotate(f.st === 'atk' && f.combo % 2 ? -1.4 : 0.7); drawWeapon(g, C, 'dagger', 11, (k.gt && k.gt.weapon) | 0); g.restore(); }
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
      for (const sd of [-1, 1]) { const ca = Math.cos(open * sd), sa = Math.sin(open * sd), px = ux * ca - uy * sa, py = ux * sa + uy * ca; g.strokeStyle = C('#8a909c'); g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx2, hy2); g.lineTo(hx2 + px * 13, hy2 + py * 13); g.stroke(); R(hx2 + px * 13 - 1.5, hy2 + py * 13 - 1.5, 3, 3, winding || bAct ? '#ff8a2a' : '#c8ccd6'); }
    }
  }
  // legs
  const legs = [[lb, dk(k.cloth), 0.55], [la, k.cloth, 1]];
  for (const [o, c, b] of legs) {
    R(-3 + o * 0.9, -17 - bob, 6, 9, c); R(-3 + o * 0.9 + 3, -17 - bob, 3, 9, dk(c));
    R(-3 + o * 0.5, -9 - bob, 5, 6, c); R(-3 + o * 0.5, -9 - bob, 2, 6, lt(c));
    R(-4 + o * 0.9, -12 - bob, 7, 2, k.armor2); // knee guard
    if (bT) { const BC = [null, ['#4a3624', '#6a4c32', '#8a6a44'], ['#243a5a', '#3a5a8a', '#8cc4ff'], ['#7a5a16', '#c9962e', '#ffe08a'], ['#2a1020', '#4a1a30', '#ff6a2a']][bT]; R(-4 + o * 0.2, -4, 8, 4, b < 1 ? BC[0] : BC[1]); R(-4 + o * 0.2 + 5, -4, 3, 4, dk(BC[0])); R(-4 + o * 0.2, -4, 8, 1, BC[2]); if (bT >= 2) R(-4 + o * 0.5, -9 - bob, 6, 1.5, BC[2]); if (bT >= 3) { R(-4 + o * 0.2 - 2, -5, 2, 2, BC[2]); } }
    else { R(-4 + o * 0.2, -4, 8, 4, b < 1 ? '#0e080c' : '#1c1219'); R(-4 + o * 0.2 + 5, -4, 3, 4, '#2e2230'); R(-4 + o * 0.2, -4, 8, 1, '#3a2c3c'); }
  }
  // tasset / loincloth
  const sw2 = walking ? Math.sin(ph) * 1.5 : 0;
  P([-7 + lean, -19 - bob, 7 + lean, -19 - bob, 6 + sw2, -9, -6 - sw2, -9], dk(k.cloth)); R(-7 + lean, -19 - bob, 14, 2, lt(k.cloth));
  if (kind === 'witch') { const rs = walking ? Math.sin(ph) * 1.5 : 0; P([-8 + lean, -22 - bob, 8 + lean, -22 - bob, 11 + rs, -2, -11 - rs, -2], k.armor); P([-8 + lean, -22 - bob, -2 + lean, -22 - bob, -4 - rs, -2, -11 - rs, -2], dk(k.armor)); R(-11 - rs, -4, 22, 2, k.armor2); for (let i = 0; i < 4; i++) R(-8 + i * 5 + rs, -3 - ((i + (tickN / 6 | 0)) % 2), 2, 3, dk(k.armor)); }
  // torso
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, -6 + lean, -18 - bob], k.armor);
  P([-9 + lean, -36 - bob, 9 + lean, -36 - bob, 8 + lean, -31 - bob, -8 + lean, -31 - bob], lt(k.armor));
  P([2 + lean, -36 - bob, 9 + lean, -36 - bob, 6 + lean, -18 - bob, 3 + lean, -18 - bob], dk(k.armor));
  R(-1 + lean, -33 - bob, 2, 13, k.armor2); R(-5 + lean, -29 - bob, 10, 1, dk(k.armor)); R(-5 + lean, -25 - bob, 10, 1, dk(k.armor));
  R(-7 + lean, -20 - bob, 14, 3, '#2a1c22'); R(-2 + lean, -20 - bob, 4, 3, '#e6b84a'); R(-2 + lean, -20 - bob, 4, 1, '#fff0a8');
  if (kind !== 'hero') { // ember cracks
    const fl = 0.6 + Math.sin(tickN * 0.2 + f.x) * 0.4; g.globalAlpha *= 1; R(-4 + lean, -30 - bob, 1, 5, `rgb(255,${140 + fl * 80 | 0},40)`); R(3 + lean, -27 - bob, 1, 4, `rgb(255,${130 + fl * 80 | 0},40)`); R(-3 + lean, -25 - bob, 3, 1, '#ff9a3a');
  }
  if (kind === 'hero') {
    if (aT >= 1) { const ac = ['', '#b8a888', '#c8d0dc', '#ffe08a', '#ff6a2a'][aT]; R(-8 + lean, -36 - bob, 16, 1, ac); if (aT >= 2) R(-5 + lean, -24 - bob, 10, 1, ac); if (aT >= 3) { P([-9 + lean, -36 - bob, -14 + lean, -42 - bob, -6 + lean, -34 - bob], ac); P([9 + lean, -36 - bob, 13 + lean, -41 - bob, 6 + lean, -34 - bob], ac); } }
    if (aT >= 4) { const fl = 0.6 + Math.sin(tickN * 0.2) * 0.4; R(-4 + lean, -30 - bob, 1, 5, `rgb(255,${140 + fl * 80 | 0},40)`); R(3 + lean, -27 - bob, 1, 4, `rgb(255,${130 + fl * 80 | 0},40)`); R(-3 + lean, -25 - bob, 1, 3, `rgb(255,${150 + fl * 80 | 0},40)`); if (tickN % 9 === 0 && !f.dead) spawn(f.x - f.face * 4, f.y, 30, 1, { c: ['#ffb43a', '#ff6a2a'], s0: 0.1, s1: 0.4, l0: 14, l1: 26, add: true, size: 1, up: 0.8, g: -0.01 }); }
    if (amT) { const gc = ['', '#cfd4de', '#5a9cff', '#ffb43a', '#ff4a88'][amT], gl = 0.6 + Math.sin(tickN * 0.15) * 0.4; R(-1.5 + lean, -35 - bob, 3, 3, gc); R(-0.5 + lean, -35 - bob, 1, 1, '#fff'); if (amT >= 3) { R(-2.5 + lean, -36 - bob, 5, 1, `rgba(255,255,255,${0.3 + gl * 0.4})`); } }
  }
  if (kind === 'smith') { P([-6 + lean, -28 - bob, 6 + lean, -28 - bob, 7 + lean, -8, -7 + lean, -8], '#5a3a26'); R(-6 + lean, -28 - bob, 12, 2, '#8a5a36'); R(-5 + lean, -35 - bob, 10, 7, '#140a06'); const ff = 0.6 + Math.sin(tickN * 0.25) * 0.4; R(-4 + lean, -34 - bob, 8, 5, `rgb(255,${90 + ff * 70 | 0},20)`); R(-3 + lean, -33 - bob, 6, 2, '#ffd070'); }
  if (kind === 'king') { R(-8 + lean, -37 - bob, 16, 2, '#ff6a2a'); R(-1 + lean, -35 - bob, 2, 16, '#ff6a2a'); const kf = 0.5 + Math.sin(tickN * 0.22) * 0.5; R(-3 + lean, -31 - bob, 6, 6, `rgb(${200 + kf * 55 | 0},${40 + kf * 60 | 0},30)`); R(-2 + lean, -30 - bob, 4, 4, '#fff1b0'); }
  // neck + head
  R(-2 + lean, -39 - bob, 4, 4, dk(k.skin));
  const hx = lean, hy = -bob;
  if (kind === 'hero') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -42 + hy, 10, 4, dk(k.skin)); R(2 + hx, -48 + hy, 3, 10, lt(k.skin) === k.skin ? k.skin : shade(k.skin, 0.12));
    const tail = Math.sin(tickN * 0.15) * 2 - (walking ? 2 : 0), hc0 = k.cls || 'nolan';
    if (hc0 === 'panni') { // long golden hair under a pointed hat; her helm tier colours the hat
      P([-6 + hx, -49 + hy, -12 + hx + tail, -40 + hy, -13 + hx + tail * 1.4, -27 + hy, -8 + hx + tail, -29 + hy, -5 + hx, -38 + hy], k.hair);
      R(-6 + hx, -49 + hy, 3, 12, k.hair); P([-6 + hx, -48 + hy, 5 + hx, -49 + hy, 6 + hx, -45 + hy, 1 + hx, -47 + hy, -3 + hx, -44 + hy], k.hair);
      R(2 + hx, -44 + hy, 3, 2, '#fff'); R(3 + hx, -44 + hy, 2, 2, '#3a2a6a'); R(2 + hx, -45 + hy, 4, 1, '#1b1b2a'); R(3 + hx, -41 + hy, 2, 1, '#c86a6a');
      const hatc = [k.cloth, '#5a4a6a', '#2a4aa8', '#b8862a', '#2a1020'][hT], hatl = ['#ffd24a', '#c0c6d0', '#8cc4ff', '#fff0a8', '#ff6a2a'][hT];
      P([-10 + hx, -48 + hy, 10 + hx, -48 + hy, 8 + hx, -51 + hy, -8 + hx, -51 + hy], hatc);
      P([-6 + hx, -50 + hy, 6 + hx, -50 + hy, 1 + hx - tail * 0.3, -60 + hy, -6 + hx + tail * 0.8, -65 + hy, -3 + hx, -58 + hy], hatc);
      R(-6 + hx, -52 + hy, 12, 1.5, hatl); R(-6 + hx + tail * 0.8, -66 + hy, 2, 2, hatl);
      if (hT >= 4) for (let i = -1; i <= 1; i++) { const fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([i * 3 + hx - 1, -52 + hy, i * 3 + hx + 1, -52 + hy, i * 3 + hx, -52 - fh + hy], i ? '#ff8a2a' : '#ffd070'); }
    } else if (hc0 === 'luca') { // hooded rogue with a face scarf; the helm tier colours the hood
      const hd = [k.cloth, '#3a3a40', '#22407a', '#7a5a1a', '#3a0e1e'][hT], hl2 = ['#4a6a52', '#8a8f99', '#5a9cff', '#ffd870', '#ff4a6a'][hT];
      P([-7 + hx, -48 + hy, -13 + hx + tail, -45 + hy, -12 + hx + tail * 1.3, -39 + hy, -6 + hx, -42 + hy], hd);
      P([-7 + hx, -40 + hy, -7 + hx, -51 + hy, -3 + hx, -55 + hy, 4 + hx, -55 + hy, 7 + hx, -50 + hy, 6 + hx, -46 + hy, 1 + hx, -48 + hy, -3 + hx, -46 + hy, -3 + hx, -40 + hy], hd);
      R(-3 + hx, -54 + hy, 6, 1, hl2); R(1 + hx, -42 + hy, 6, 3, dk(hd)); R(1 + hx, -42 + hy, 6, 1, hl2);
      R(2 + hx, -45 + hy, 3, 2, '#fff'); R(3 + hx, -45 + hy, 2, 2, '#1b1b2a'); R(1 + hx, -46 + hy, 4, 1, '#1b1b2a');
      if (hT >= 4) { const fl = 0.5 + Math.sin(tickN * 0.3) * 0.5; R(3 + hx, -45 + hy, 2, 1, `rgb(255,${120 + fl * 100 | 0},40)`); }
    } else {
    P([-6 + hx, -47 + hy, 6 + hx, -47 + hy, 7 + hx, -52 + hy, 3 + hx, -55 + hy, 0 + hx, -52 + hy, -4 + hx, -56 + hy, -7 + hx, -51 + hy], k.hair);
    P([-6 + hx, -47 + hy, -7 + hx, -42 + hy, -4 + hx, -42 + hy, -4 + hx, -47 + hy], dk(k.hair));
    P([-6 + hx, -48 + hy, -13 + hx + tail, -46 + hy, -17 + hx + tail * 1.5, -40 + hy, -9 + hx + tail, -44 + hy], k.hair);
    R(-5 + hx, -48 + hy, 10, 2, '#c9962e'); // headband
    R(2 + hx, -44 + hy, 3, 2, '#fff'); R(3 + hx, -44 + hy, 2, 2, '#1b1b2a'); R(1 + hx, -46 + hy, 4, 1, dk(k.hair)); R(4 + hx, -42 + hy, 2, 1, dk(k.skin));
    }
    if (hT && hc0 === 'nolan') { // helm by rarity: iron cap, visored helm, crested gold helm, crown of living flame
      const hc = [null, '#8a8f99', '#4a7ac8', '#d4a62e', '#2a1620'][hT], hl = [null, '#c0c6d0', '#8cc4ff', '#fff0a8', '#ff6a2a'][hT];
      P([-6 + hx, -45 + hy, -6 + hx, -51 + hy, -3 + hx, -55 + hy, 3 + hx, -55 + hy, 6 + hx, -51 + hy, 6 + hx, -45 + hy, 4 + hx, -47 + hy, -4 + hx, -47 + hy], hc);
      R(-5 + hx, -53 + hy, 9, 1.5, hl); R(-6 + hx, -48 + hy, 12, 1.5, dk(hc));
      if (hT >= 2) { R(3 + hx, -47 + hy, 2, 5, hc); R(-1 + hx, -53 + hy, 2, 2, hl); }
      if (hT === 3) { const pl = Math.sin(tickN * 0.15) * 2 - (walking ? 2 : 0); P([-3 + hx, -55 + hy, -10 + hx + pl, -59 + hy, -17 + hx + pl * 1.5, -52 + hy, -8 + hx, -52 + hy], '#c8302a'); }
      if (hT >= 4) for (let i = -2; i <= 2; i++) { const fh = 4 + Math.abs(Math.sin(tickN * 0.3 + i)) * 5; P([i * 2.5 + hx - 1.2, -55 + hy, i * 2.5 + hx + 1.2, -55 + hy, i * 2.5 + hx, -55 - fh + hy], i % 2 ? '#ff8a2a' : '#ffd070'); }
    }
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
  } else if (kind === 'witch') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([4 + hx, -45 + hy, 11 + hx, -41 + hy, 5 + hx, -41 + hy], dk(k.skin));
    R(1 + hx, -46 + hy, 4, 2, '#caffd8'); R(2 + hx, -46 + hy, 2, 2, '#1aa050'); R(-1 + hx, -41 + hy, 6, 1, '#1a0c14'); R(0 + hx, -40 + hy, 1, 1, '#ddd');
    P([-5 + hx, -42 + hy, -9 + hx, -34 + hy, -3 + hx, -38 + hy], k.hair); P([-3 + hx, -41 + hy, -6 + hx, -31 + hy, 0 + hx, -37 + hy], k.hair);
    P([-9 + hx, -47 + hy, 9 + hx, -47 + hy, 5 + hx, -52 + hy, 2 + hx, -66 + hy, -3 + hx, -53 + hy], k.armor);
    P([-9 + hx, -47 + hy, -3 + hx, -53 + hy, 2 + hx, -66 + hy, -1 + hx, -50 + hy], dk(k.armor));
    R(-12 + hx, -49 + hy, 24, 3, dk(k.armor)); R(-12 + hx, -49 + hy, 24, 1, lt(k.armor)); R(-6 + hx, -52 + hy, 12, 2, k.armor2);
  } else if (kind === 'smith') {
    R(-6 + hx, -49 + hy, 12, 12, '#4a4e58'); R(-6 + hx, -49 + hy, 12, 3, '#7a808c'); R(2 + hx, -49 + hy, 4, 12, '#363a44');
    R(-5 + hx, -46 + hy, 11, 3, '#0e0806'); const ef = 0.7 + Math.sin(tickN * 0.3) * 0.3; R(-4 + hx, -45 + hy, 9, 1, `rgb(255,${130 + ef * 80 | 0},30)`);
    R(-7 + hx, -52 + hy, 14, 4, '#5c616c'); R(-7 + hx, -52 + hy, 14, 1, '#9aa1ad'); R(-3 + hx, -58 + hy, 6, 6, '#3a3e48');
    R(-4 + hx, -40 + hy, 9, 3, '#2a2e36'); R(-4 + hx, -47 + hy, 1, 1, '#c8ccd6'); R(4 + hx, -47 + hy, 1, 1, '#c8ccd6');
  } else if (kind === 'king') {
    R(-5 + hx, -48 + hy, 10, 10, k.skin); R(-5 + hx, -41 + hy, 10, 3, dk(k.skin));
    P([-6 + hx, -47 + hy, 6 + hx, -47 + hy, 6 + hx, -39 + hy, 3 + hx, -37 + hy, -3 + hx, -37 + hy, -6 + hx, -39 + hy], '#1a1620'); R(-5 + hx, -48 + hy, 11, 6, '#1a1620');
    R(1 + hx, -45 + hy, 4, 2, '#ff6a2a'); R(2 + hx, -45 + hy, 2, 1, '#fff1b0'); R(-4 + hx, -45 + hy, 3, 2, '#c8401a');
    R(-6 + hx, -50 + hy, 12, 3, '#c9962e');
    for (let i = -2; i <= 2; i++) { const ch = 6 + (2 - Math.abs(i)) * 2; P([i * 3 + hx - 1.5, -50 + hy, i * 3 + hx + 1.5, -50 + hy, i * 3 + hx, -50 - ch + hy], '#3a3040'); const fh = 3 + Math.abs(Math.sin(tickN * 0.3 + i)) * 4; P([i * 3 + hx - 1.2, -50 - ch + hy, i * 3 + hx + 1.2, -50 - ch + hy, i * 3 + hx, -50 - ch - fh + hy], i % 2 ? '#ff8a2a' : '#ffd070'); }
  } else { // helmeted: brute & boss
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
  if (f.kind === 'archer') { P([-7 + hx, -47 + hy, -7 + hx, -53 + hy, -2 + hx, -57 + hy, 3 + hx, -55 + hy, 7 + hx, -49 + hy, 7 + hx, -44 + hy, 5 + hx, -48 + hy, -4 + hx, -49 + hy], k.cloth); R(-7 + hx, -47 + hy, 3, 10, dk(k.cloth)); R(-5 + hx, -40 + hy, 10, 3, k.armor2); R(-9 + lean, -36 - bob, 5, 14, '#5a4030'); R(-9 + lean, -37 - bob, 5, 2, '#e8f4ff'); }
  if (f.kind === 'bomber') { R(-5 + hx, -48 + hy, 10, 1, '#3a2a1a'); R(-3 + hx, -47 + hy, 3, 3, '#ffcf3a'); R(1 + hx, -47 + hy, 3, 3, '#ffcf3a'); R(-15 + lean, -35 - bob, 8, 10, '#3a2a1a'); R(-15 + lean, -35 - bob, 8, 2, '#6a4a2a'); R(-13 + lean, -38 - bob, 2, 3, ((tickN >> 1) & 1) ? '#fff1b0' : '#ff8a2a'); }
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
  g.save(); g.translate(hxp, hyp); g.rotate(ang); drawWeapon(g, C, f.k.wk || kind, bl, wT); g.restore();
  // front pauldron
  P([shx - 5, shy - 4, shx + 5, shy - 4, shx + 6, shy + 3, shx - 4, shy + 3], k.armor2); R(shx - 5, shy - 4, 11, 1.5, lt(k.armor2)); R(shx - 4, shy + 1, 10, 2, dk(k.armor2));
  if (kind === 'smith') { R(shx - 3, shy - 17, 5, 13, '#3a3e48'); R(shx - 4, shy - 18, 7, 2, '#5c616c'); R(-12 + lean, -52 - bob, 5, 15, '#3a3e48'); R(-13 + lean, -53 - bob, 7, 2, '#5c616c'); }
  if (kind === 'b' || kind === 'boss') { P([shx + 4, shy - 4, shx + 9, shy - 11, shx + 6, shy - 2], '#d8d0c0'); P([-9 + lean, -37 - bob, -14 + lean, -45 - bob, -6 + lean, -34 - bob], '#d8d0c0'); }
  g.restore();

  // outline: dark silhouette stamped in 4 directions, then the sprite on top
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.globalCompositeOperation = 'source-over'; sil.clearRect(0, 0, SW, SH); sil.globalAlpha = 1;
  sil.drawImage(spriteCv, 0, 0); sil.globalCompositeOperation = 'source-in'; sil.fillStyle = '#0b0610'; sil.fillRect(0, 0, SW, SH);
  const x0 = Math.round(sx) - AX, y0 = Math.round(sy - f.z) - AY;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) MAIN.drawImage(silCv, x0 + dx, y0 + dy);
  MAIN.drawImage(spriteCv, x0, y0);

  if (BOSSES[kind] && !f.dead && f.st !== 'down') { // boss secondary motion
    const bx = Math.round(sx), by = Math.round(sy - f.z + hov);
    if (kind === 'witch') for (let i = 0; i < 4; i++) { const a = tickN * 0.05 + i * 1.57; MAIN.globalCompositeOperation = 'lighter'; MAIN.fillStyle = 'rgba(150,255,190,0.85)'; MAIN.fillRect(bx + Math.cos(a) * 26 * sc, by - 34 * sc + Math.sin(a * 1.4) * 14, 3, 3); MAIN.fillStyle = 'rgba(150,255,190,0.25)'; MAIN.fillRect(bx + Math.cos(a - 0.3) * 26 * sc - 1, by - 34 * sc + Math.sin((a - 0.3) * 1.4) * 14 - 1, 5, 5); MAIN.globalCompositeOperation = 'source-over'; }
    if (kind === 'smith' && tickN % 4 === 0) spawn(f.x - f.face * 8, f.y, 40 * sc, 1, { s0: 0.1, s1: 0.4, c: ['#8a8a92', '#5a5a64', '#ffb43a'], l0: 18, l1: 34, size: 2, up: 1.1, g: -0.01, add: false });
    if (kind === 'boss' && f.st === 'walk' && Math.abs(Math.sin(f.anim)) < 0.08 && tickN % 10 < 2) { dust(f.x, f.y, 5); shake = Math.max(shake, 1.2); }
  }
  // swing trail on the main canvas
  const swinging = (f.st === 'atk' && f.k.cls !== 'panni' && f.t >= (comboOf(f)[f.combo] || COMBO[0]).a && f.t <= (comboOf(f)[f.combo] || COMBO[0]).b + 4) || (f.st === 'eatk' && f.t < 9) || f.st === 'jatk';
  if (swinging) {
    MAIN.save(); MAIN.translate(Math.round(sx), Math.round(sy - f.z)); MAIN.scale(f.face * sc, sc); MAIN.globalCompositeOperation = 'lighter';
    const a0 = f.st === 'atk' && f.combo === 1 ? 1.6 : -2.0;
    for (let w = 0; w < 3; w++) { MAIN.strokeStyle = f.pn ? `rgba(${120 + w * 40},${200 + w * 18},255,${0.28 - w * 0.07})` : `rgba(255,${130 + w * 30},50,${0.26 - w * 0.07})`; MAIN.lineWidth = 9 - w * 3; MAIN.beginPath(); MAIN.arc(shx, shy, hl + bl * 0.85, a0 - Math.PI / 2, ang - Math.PI / 2, ang < a0); MAIN.stroke(); }
    MAIN.restore();
  }
}

function drawFighter(f) {
  if (f.pitT) { // tumbling into a chasm
    g.save(); g.beginPath(); g.rect(0, 0, W, f.pitY - 2); g.clip(); g.globalAlpha = clamp(1 - f.pitT / 30, 0, 1);
    const sv = f.pitT, y0 = f.y; f.pitT = 0; f.y = y0 + sv * sv * 0.12; drawFighter(f); f.y = y0; f.pitT = sv; g.restore(); return;
  }
  const sx = f.x - cam, sy = f.y;
  if (f.isMount) { drawWildMount(f, sx, sy); return; }
  if (f.kind === 'wyrm') { drawWyrm(f, sx, sy); return; }
  const sh = clamp(1 - f.z / 90, 0.3, 1) * f.k.scale * (f.mount ? 1.7 : 1);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Math.round(sx), Math.round(sy), 12 * sh, 4 * sh, 0, 0, 7); g.fill();
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
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(150,230,255,${a})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, 7); g.stroke();
      g.fillStyle = `rgba(120,160,255,${a * 0.22})`; g.fill(); g.strokeStyle = `rgba(190,150,255,${a * 0.7})`; g.lineWidth = 1; g.beginPath(); g.ellipse(bx, by, rx - 3, ry - 3, Math.sin(tickN * 0.05) * 0.2, 0.4 + tickN * 0.04, 2.2 + tickN * 0.04); g.stroke(); g.restore();
    }
    if (ai === 'guard' && !f.dead) { const bx = Math.round(sx + f.face * 15), by = Math.round(sy - 30); g.fillStyle = '#0a0610'; g.fillRect(bx - 5, by - 2, 10, 30); g.fillStyle = '#3a2a5a'; g.fillRect(bx - 4, by - 1, 8, 28); g.fillStyle = '#c87aff'; g.fillRect(bx - 4, by - 1, 8, 2); g.fillRect(bx - 1, by + 4, 2, 18); g.fillStyle = '#6a4a9a'; g.fillRect(bx - 4, by + 24, 8, 3); }
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

function drawJar(x, y, on) {
  g.fillStyle = '#0a0610'; g.fillRect(x - 5, y - 11, 10, 12);
  g.fillStyle = on ? '#3a8ae0' : '#26324a'; g.fillRect(x - 4, y - 9, 8, 9);
  g.fillStyle = on ? '#bfe6ff' : '#3a4866'; g.fillRect(x - 3, y - 8, 2, 6);
  g.fillStyle = on ? '#e6c97a' : '#5a5030'; g.fillRect(x - 3, y - 12, 6, 3);
  if (on) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(90,170,255,0.22)'; g.fillRect(x - 9, y - 16, 18, 18); g.globalCompositeOperation = 'source-over'; }
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
      g.fillStyle = '#0a0610'; g.fillRect(x - 6, yy - 15, 12, 15); g.fillStyle = '#3a8ae0'; g.fillRect(x - 5, yy - 13, 10, 12);
      g.fillStyle = '#bfe6ff'; g.fillRect(x - 4, yy - 12, 2, 8); g.fillStyle = '#2a60b0'; g.fillRect(x + 1, yy - 12, 4, 11);
      g.fillStyle = '#e6c97a'; g.fillRect(x - 4, yy - 17, 8, 3); g.fillStyle = '#fff0a8'; g.fillRect(x - 4, yy - 17, 8, 1);
      continue;
    }
    if (it.kind === 'gear') {
      const R = RARITY[it.it.rar], z = it.z || 0, yy = y - z + Math.sin(it.t * 0.1) * 1.2;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 8, 2.5, 0, 0, 7); g.fill();
      if (it.it.rar > 0) {
        const bh = 36 + it.it.rar * 14; g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(0, y - bh, 0, y); gr.addColorStop(0, `rgba(${R.rgb},0)`); gr.addColorStop(1, `rgba(${R.rgb},0.6)`); g.fillStyle = gr; g.fillRect(x - 3, y - bh, 6, bh);
        glowDot(g, x, yy - 8, 16 + it.it.rar * 3, R.rgb, 0.45); g.globalCompositeOperation = 'source-over';
      }
      g.fillStyle = '#0a0610'; g.fillRect(x - 8, yy - 17, 16, 16); g.strokeStyle = R.col; g.lineWidth = 1; g.strokeRect(x - 7.5, yy - 16.5, 15, 15);
      drawIcon(g, it.it.slot, x - 7, yy - 16, 0.88, R.col);
      if (it.it.rar > 0 || (Math.abs(it.x - hero.x) < 70 && Math.abs(it.y - hero.y) < 30)) text(it.it.name, x, yy - 21 - (li++ % 3) * 9, 7, R.col, 'center');
      continue;
    }
    const b = Math.sin(it.t * 0.1) * 2;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y, 7, 2.5, 0, 0, 7); g.fill();
    g.fillStyle = '#c85a3a'; g.fillRect(x - 5, y - 9 + b, 10, 7); g.fillStyle = '#f0d4b0'; g.fillRect(x + 4, y - 10 + b, 5, 3); g.fillRect(x + 7, y - 12 + b, 3, 3);
    g.fillStyle = '#e8805a'; g.fillRect(x - 4, y - 9 + b, 6, 2);
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
  const PL = o.pal || {}, body = PL.body || '#c4452a', belly = PL.belly || '#f0b070', dark = PL.dark || '#7a2418', light = PL.light || '#e0663c', spine = PL.spine || '#ffd070', wing = PL.wing || '#8a2c3a';
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
  for (let i = 0; i < 5; i++) { const x0 = -11 + i * 6; P([x0, -22 - bob, x0 + 4, -23 - bob, x0 + 2, -28 - bob], spine); }
  R(-12 + st, -9, 5, 9, body); R(-12 + st, -9, 2, 9, light); R(-13 + st, -2, 8, 2, '#2a1010');
  R(8 - st, -9, 5, 9, body); R(8 - st, -9, 2, 9, light); R(7 - st, -2, 8, 2, '#2a1010');
  R(-5, -26 - bob, 13, 3, '#3a2418'); R(-5, -27 - bob, 13, 1, '#c9962e');
  P([8, -18 - bob, 14, -23 - bob, 22, -35 - bob, 17, -37 - bob, 9, -27 - bob], body);
  P([14, -23 - bob, 22, -35 - bob, 19, -36 - bob, 12, -24 - bob], light);
  const jaw = o.breathe ? 6 : 1;
  P([20, -31 - bob, 33, -31 - bob + jaw, 32, -28 - bob + jaw, 19, -28 - bob], dark);
  P([17, -39 - bob, 25, -41 - bob, 35, -37 - bob, 34, -32 - bob, 20, -31 - bob, 16, -33 - bob], body);
  P([20, -39 - bob, 25, -41 - bob, 35, -37 - bob, 28, -37 - bob], light);
  if (o.breathe) { const bc = o.type === 'storm' ? ['#8ab0ff', '#ffffff'] : o.type === 'stone' ? ['#b8c8a8', '#ffffff'] : ['#ffb43a', '#fff1b0']; R(27, -32 - bob, 6, 3, bc[0]); R(28, -32 - bob, 4, 1, bc[1]); }
  R(25, -38 - bob, 3, 2, '#ffe27a'); R(27, -38 - bob, 1, 2, '#2a0a0a'); R(33, -37 - bob, 1, 1, '#2a0a0a');
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

/* the giant dragon head that smashes the arena (original design, frontal view) */
function drawGiantHead(cx, cy, s, glow) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  const lw = 2 / s;
  const shape = (pts, fill, stroke) => {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    for (let i = pts.length - 2; i >= 0; i -= 2) g.lineTo(-pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = '#12060a'; g.lineWidth = lw; g.stroke(); }
  };
  const side = (pts, fill, m) => {
    g.beginPath(); g.moveTo(pts[0] * m, pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * m, pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = '#12060a'; g.lineWidth = lw; g.stroke();
  };
  shape([0, -420, 32, -420, 42, -90, 36, -50, 0, -44], '#4a1420', true);
  for (let y = -400; y < -80; y += 22) { const hw = 32 + 10 * ((y + 420) / 330); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-hw, y, hw * 2, 3); g.fillStyle = 'rgba(200,80,60,0.12)'; g.fillRect(-hw, y + 3, hw * 2, 1); }
  shape([0, -6, 34, -14, 42, 6, 28, 24, 0, 30], '#6a1c28', true);
  shape([0, -30, 26, -30, 22, -2, 0, 2], `rgb(${50 + glow * 205 | 0},${12 + glow * 110 | 0},12)`, false);
  g.globalCompositeOperation = 'lighter';
  const mg = g.createRadialGradient(0, -14, 2, 0, -14, 20 + 36 * glow); mg.addColorStop(0, `rgba(255,170,60,${0.25 + 0.6 * glow})`); mg.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = mg; g.fillRect(-70, -70, 140, 120); g.globalCompositeOperation = 'source-over';
  for (const xx of [-20, -10, 0, 10, 20]) { g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 3, -2); g.lineTo(xx + 3, -2); g.lineTo(xx, -13); g.fill(); }
  shape([0, -150, 26, -146, 50, -120, 58, -84, 52, -52, 40, -34, 0, -30], '#8a2634', true);
  shape([0, -146, 7, -142, 10, -92, 0, -84], '#b8483a', false);
  shape([0, -80, 52, -76, 52, -52, 40, -34, 0, -30], 'rgba(40,6,16,0.38)', false);
  for (const m of [1, -1]) { g.strokeStyle = 'rgba(30,4,10,0.55)'; g.lineWidth = lw; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(m * (14 + i * 9), -130 + i * 6); g.lineTo(m * (22 + i * 9), -118 + i * 9); g.stroke(); } }
  shape([0, -78, 22, -76, 32, -56, 24, -34, 0, -32], '#b8483a', true);
  for (const xx of [-22, -14, -6, 6, 14, 22]) { g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(xx - 3.5, -31); g.lineTo(xx + 3.5, -31); g.lineTo(xx, -18); g.fill(); }
  for (const m of [1, -1]) {
    side([40, -140, 70, -190, 96, -232, 88, -176, 58, -124], '#e6dcc4', m);
    side([52, -110, 84, -138, 70, -100], '#bfb49a', m);
    side([10, -104, 50, -112, 58, -90, 24, -86], '#2a0a10', m);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(m * 36, -94, 2, m * 36, -94, 26); gr.addColorStop(0, 'rgba(255,190,60,0.6)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.fillRect(m * 36 - 26, -120, 52, 52); g.globalCompositeOperation = 'source-over';
    side([22, -96, 46, -100, 44, -90, 26, -88], '#ffd24a', m);
    g.fillStyle = '#c8300a'; g.fillRect(m * 36 - 2, -98, 4, 7);
    g.fillStyle = '#1a0508'; g.fillRect(m * 10 - 3, -62, 6, 4);
  }
  g.restore();
}

function drawDragonCast() {
  const d = dragon, t = d.t;
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
  if (t >= 62 && t < 100) { g.fillStyle = `rgba(0,0,0,${0.45 * Math.min(1, (100 - t) / 20)})`; g.beginPath(); g.ellipse(W / 2, 220, 120 * d.size, 14, 0, 0, 7); g.fill(); }
  if (t >= 30 && chin > -180) drawGiantHead(W / 2, chin, 0.95 * d.size, glow);
}

function drawParts(addOnly) {
  for (const p of parts) {
    if (p.ring) { const t = 1 - p.life / p.max, r = t * 120; g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,${180 - t * 100 | 0},60,${1 - t})`; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x - cam, p.y, r, r * 0.35, 0, 0, 7); g.stroke(); g.globalCompositeOperation = 'source-over'; continue; }
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
  g.fillStyle = '#0a0610'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = c2; g.fillRect(x, y, w, h);
  g.fillStyle = c1; g.fillRect(x, y, Math.max(0, w * v / max) | 0, h);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, Math.max(0, w * v / max) | 0, 1);
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
function drawHUD() {
  if (clearT > 0) { text(clearT > LOOT_T - 150 ? 'STAGE CLEAR' : 'LOOT TIME  -  GRAB THE DROPS', W / 2, 200, 11, '#ffd24a', 'center'); text('ENTER: CONTINUE TO THE MARKET   ' + Math.ceil(clearT / 60) + 'S', W / 2, 214, 8, '#fff', 'center'); }
  text('GOLD ' + rpg.gold, W - 12, 62, 8, '#ffd24a', 'right');
  text(cls().name + '  LV ' + rpg.lvl, 12, 18, 11, cls().col);
  bar(12, 22, 110, 7, hero.hp, hero.maxhp, '#d94a3a', '#3a1418');
  bar(12, 32, 80, 4, hero.mana, 100, hero.mana >= 60 ? '#ffd24a' : '#c08a2a', '#2e2010');
  bar(12, 40, 110, 2, rpg.lvl >= MAX_LV ? 1 : rpg.xp, rpg.lvl >= MAX_LV ? 1 : xpNeed(rpg.lvl), '#8a6aff', '#1c1430');
  text('SHIFT: DRAGON WRATH', 12, 52, 8, hero.mana >= 60 ? '#ffd24a' : '#6a5a40');
  { const S = skillOf(hero); if (S) { text('U: ' + S.name, 12, 62, 7, hero.skcd > 0 ? '#6a7a90' : '#8cc4ff'); if (hero.skcd > 0) bar(12, 64, 80, 2, S.cd - hero.skcd, S.cd, '#8cc4ff', '#1c2a3a'); } else text('SKILL AT LV 10', 12, 62, 7, '#4a4a5a'); }
  for (let i = 0; i < 3; i++) drawJar(20 + i * 15, 76, i < hero.vases);
  text(hero.vases ? `+${hero.vases * 15}%` : 'JARS', 62, 73, 8, hero.vases ? '#7fd0ff' : '#5a6a80');
  if (hero.mount) { const T = mtype(hero.mount); text(T.name.split(' ')[0] + '  GRIP ' + (2 - (hero.mount.falls || 0)), 12, 92, 8, T.col); bar(12, 95, 70, 4, hero.mount.hp, hero.mount.maxhp, T.col, '#2a1a20'); }
  if (coop && hero2) { const p = hero2; text(CLASSES[CLS2].name, 12, 112, 10, p.dead ? '#6a6a70' : '#8affb0'); bar(12, 116, 110, 7, Math.max(0, p.hp), p.maxhp, '#d94a3a', '#3a1418'); bar(12, 126, 80, 4, p.mana, 100, p.mana >= 60 ? '#ffd24a' : '#c08a2a', '#2e2010'); if (p.vases) text('+' + p.vases * 15 + '%', 98, 131, 7, '#7fd0ff'); if (p.dead && rpg.coins > 0 && !hero.dead) text('RETURNS SOON (-1 COIN)', 12, 142, 7, '#8878a0'); }
  if (coop && hero.dead && hero2 && !hero2.dead && rpg.coins > 0) text('RETURNS SOON (-1 COIN)', 12, 100, 7, '#8878a0');
  text('COINS', W - 56, 49, 7, '#b8a8c8', 'right'); drawCoins(W - 46, 46, rpg.coins, 14);
  text('I: GEAR', W - 8, H - 6, 7, '#7a6a8a', 'right');
  text(String(score).padStart(7, '0'), W / 2, 18, 12, '#fff1b0', 'center');
  if (bossRef && !bossRef.dead && bossRef.hp > 0) { text(bossRef.k.name, W / 2, 33, 9, bossRef.p2 ? '#ff5a3a' : '#ff9a5a', 'center'); bar(W / 2 - 110, 37, 220, 6, Math.max(0, bossRef.hp), bossRef.maxhp, bossRef.p2 ? '#ff3a2a' : '#e0742a', '#3a1c10'); }
  else text((cycle ? 'CYCLE ' + (cycle + 1) + '  ' : '') + 'STAGE ' + (stageIdx + 1) + '  ' + STAGES[stageIdx].name, W / 2, 31, 8, cycle ? '#e0a8ff' : '#b8a8c8', 'center');
  if (stageCard > 0) { const a = Math.min(1, stageCard / 40, (190 - stageCard) / 25); g.globalAlpha = Math.max(0, a); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 92, W, 70); text((cycle ? 'CYCLE ' + (cycle + 1) + '  ' : '') + 'STAGE ' + (stageIdx + 1), W / 2, 114, 12, '#ffb43a', 'center'); text(STAGES[stageIdx].name, W / 2, 138, 20, '#fff1d0', 'center'); text(STAGES[stageIdx].tag, W / 2, 154, 8, '#c9a8ff', 'center'); g.globalAlpha = 1; }
  if (lastEnemy && lastEnemy !== bossRef && !lastEnemy.dead && lastEnemy.hp > 0) { text(lastEnemy.k.name, W - 12, 18, 10, '#ffa060', 'right'); bar(W - 142, 22, 130, 7, lastEnemy.hp, lastEnemy.maxhp, '#e0742a', '#3a1c10'); if (lastEnemy.barrier > 0) bar(W - 142, 30, 130, 4, lastEnemy.barrier, lastEnemy.bmax, '#9ae8ff', '#1a2440'); }
  if (goBlink > 0 && (goBlink >> 4) & 1) { text('GO', W - 40, 120, 18, '#fff1b0', 'center'); g.fillStyle = '#fff1b0'; g.beginPath(); g.moveTo(W - 22, 105); g.lineTo(W - 8, 115); g.lineTo(W - 22, 125); g.fill(); }
  if (msgT > 0) { g.globalAlpha = Math.min(1, msgT / 30); text(msg, W / 2, 88, msg.length > 10 ? 14 : 18, '#ff8a4a', 'center'); g.globalAlpha = 1; }
}

const DONATE_URL = 'https://www.paypal.com/paypalme/cooldance84';
let donateBox = null, langBox = null;
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
  if (mode === 'select') { const r = screen.getBoundingClientRect(); selClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); return; }
  if (!donateBox && !langBox) return; const r = screen.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  if (langBox && x >= langBox.x && x <= langBox.x + langBox.w && y >= langBox.y && y <= langBox.y + langBox.h) { setLang(LANG === 'hu' ? 'en' : 'hu'); return; }
  if (donateBox && x >= donateBox.x && x <= donateBox.x + donateBox.w && y >= donateBox.y && y <= donateBox.y + donateBox.h) openDonate();
});
screen.addEventListener('pointermove', e => {
  if (!donateBox) { screen.style.cursor = ''; return; } const r = screen.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  screen.style.cursor = (x >= donateBox.x && x <= donateBox.x + donateBox.w && y >= donateBox.y && y <= donateBox.y + donateBox.h) ? 'pointer' : '';
});
addEventListener('keydown', e => { if (e.code === 'KeyH' && langBox && mode === 'title') setLang(LANG === 'hu' ? 'en' : 'hu'); });
addEventListener('keydown', e => { if (e.code === 'KeyD' && donateBox && (mode === 'title' || mode === 'victory' || mode === 'gameover' || mode === 'board')) openDonate(); });
/* ---------- hero select ---------- */
let selBoxes = [];
function openSelect(two) { coop = !!two; sel.coop = coop; sel.a = Math.max(0, CLS_ORDER.indexOf(CLS)); sel.b = Math.max(0, CLS_ORDER.indexOf(CLS2)); if (coop && sel.b === sel.a) sel.b = (sel.a + 1) % 3; mode = 'select'; SFX.pick(); }
function confirmSelect() {
  setClass(CLS_ORDER[sel.a]); CLS2 = CLS_ORDER[sel.b]; saveSettings();
  runInfo = loadRun(); if (runInfo) { resumeSel = runInfo.coins > 0 ? 0 : 1; mode = 'resume'; SFX.pick(); return; }
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
    text('LV ' + sv.lvl, cx, y0 + 156, 8, '#ffd24a', 'center');
    text(C.desc[0], cx, y0 + 172, 6, '#b8a8c8', 'center'); text(C.desc[1], cx, y0 + 182, 6, '#b8a8c8', 'center');
    if (on1) text(sel.coop ? 'P1' : '>', x0 + 10, y0 + 14, 9, C.col, 'center');
    if (on2) text('P2', x0 + 130, y0 + 14, 9, '#8affb0', 'center');
  });
  text(sel.coop ? 'P1: A/D    P2: ARROWS    ENTER: START    ESC: BACK' : 'A/D OR ARROWS: CHOOSE    ENTER: START    ESC: BACK', W / 2, 252, 8, '#c9a8ff', 'center');
  text('EACH HERO KEEPS HIS OR HER OWN LEVEL AND GEAR', W / 2, 264, 7, '#8a7a9a', 'center');
}
function drawTitleOverlay() {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
  const y = 96 + Math.sin(tickN * 0.04) * 3;
  g.font = 'bold 54px "Courier New",monospace'; g.textAlign = 'center';
  g.fillStyle = '#2a0e08'; g.fillText('EMBERFALL', W / 2 + 3, y + 3);
  const gr = g.createLinearGradient(0, y - 40, 0, y); gr.addColorStop(0, '#fff1b0'); gr.addColorStop(0.5, '#ffb43a'); gr.addColorStop(1, '#e0431f');
  g.fillStyle = gr; g.fillText('EMBERFALL', W / 2, y);
  text('THE ASHEN VOW', W / 2, y + 22, 12, '#c9a8ff', 'center');
  if ((tickN >> 5) & 1) text('ENTER: 1 PLAYER     2: CO-OP', W / 2, 190, 12, '#ffffff', 'center');
  text('WASD MOVE   J ATTACK (x3)   K JUMP   SHIFT DRAGON WRATH      P2: ARROWS  , . /', W / 2, 222, 8, '#b8a8c8', 'center');
  text('K NEAR A WYRMLING = RIDE (J FIRE, E DISMOUNT)   F: CRT   M: MUTE', W / 2, 234, 8, '#b8a8c8', 'center');
  drawDonate(H - 12);
  { const lt = '[H] ' + (LANG === 'hu' ? 'NYELV: MAGYAR' : 'LANGUAGE: ENGLISH'); g.font = '8px "Courier New",monospace'; const lw = g.measureText(lt).width + 10; langBox = { x: 4, y: 3, w: lw, h: 13 }; g.fillStyle = 'rgba(20,10,40,0.7)'; g.fillRect(4, 3, lw, 13); g.strokeStyle = '#8cc4ff'; g.strokeRect(4.5, 3.5, lw - 1, 12); text(lt, 4 + lw / 2, 13, 8, '#8cc4ff', 'center'); }
  text('v' + VERSION, W - 6, H - 5, 7, '#6a5a80', 'right');
  text(resetArm > 0 ? 'PRESS R AGAIN TO ERASE YOUR HERO' : cls().name + ' LV ' + rpg.lvl + '    I: GEAR   B: LEATHERBOARD   R: RESET HERO', W / 2, 248, 8, resetArm > 0 ? '#ff6a6a' : '#c9a8ff', 'center');
}

function render() {
  donateBox = null; langBox = null;
  if (mode === 'story') { drawStory(); return; }
  if (mode === 'name' || mode === 'board') { drawBoardScreen(); return; }
  const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) * 0.6 : 0;
  g.save(); g.translate(Math.round(sx), Math.round(sy));
  drawWorld(); drawFog();
  for (const tx of torchPositions()) flame(Math.round(tx - cam), GROUND_TOP - 44, 1);
  drawItems(); drawVentsAndSlashes(false);
  const list = [...enemies, ...mounts, ...players()].sort((a, b) => a.y - b.y);
  for (const f of list) drawFighter(f);
  drawShots(); drawVentsAndSlashes(true);
  drawParts(false); drawWeather();
  drawFloats();
  g.restore();
  applyLighting();
  g.save(); g.translate(Math.round(sx), Math.round(sy)); drawParts(true); g.restore();
  // foreground pillars for depth (parallax 1.35)
  for (let i = -1; i < 4; i++) {
    const wx = (Math.floor(cam * 1.35 / 520) + i) * 520 + 260, x = Math.round(wx - cam * 1.35);
    // fade pillars out near screen centre so they never hide the fight
    const al = clamp((Math.abs(x - W / 2) - 110) / 70, 0, 1); if (al <= 0) continue;
    g.globalAlpha = al; g.fillStyle = TH.fg[0]; g.fillRect(x - 12, 0, 24, H); g.fillStyle = TH.fg[1]; g.fillRect(x - 12, 0, 3, H); g.globalAlpha = 1;
  }
  if (dragon) drawDragonCast();
  if (flashA > 0) { g.fillStyle = `rgba(255,240,220,${Math.min(1, flashA)})`; g.fillRect(0, 0, W, H); }
  if (mode === 'title') drawTitleOverlay();
  else if (mode === 'select') drawSelect();
  else if (mode === 'resume') drawResume();
  else drawHUD();
  if (intro) drawIntro();
  if (mode === 'shop') drawShop();
  if (mode === 'inv') drawInv();
  if (mode === 'pause') drawPause();
  if (mode === 'gameover') {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H); text('YOU HAVE FALLEN', W / 2, 106, 22, '#e0431f', 'center'); text('SCORE ' + score, W / 2, 132, 12, '#fff1b0', 'center');
    text('STAGE ' + (stageIdx + 1) + ': ' + STAGES[stageIdx].name, W / 2, 148, 8, '#b8a8c8', 'center');
    drawCoins(W / 2 - 28, 168, rpg.coins, 28);
    if (endTimer > 30) { text(rpg.coins > 0 ? 'ENTER: CONTINUE  (USES 1 COIN)' : 'NO COINS LEFT', W / 2, 192, 10, '#fff', 'center'); text(rpg.coins > 0 ? 'ESC: END RUN AND SAVE SCORE' : 'ENTER: SAVE YOUR SCORE', W / 2, 206, 8, '#b8a8c8', 'center'); drawDonate(226); }
  }
  if (mode === 'victory') {
    g.fillStyle = 'rgba(20,10,0,0.5)'; g.fillRect(0, 0, W, H); text('THE WORLD IS SAVED', W / 2, 104, 20, '#ffd24a', 'center'); text(cls().name + ' KEPT THE ASHEN VOW', W / 2, 124, 9, '#c9a8ff', 'center');
    text('SCORE ' + score, W / 2, 144, 12, '#fff1b0', 'center'); text('UNSPENT COINS ' + rpg.coins + ' x 1500 WHEN YOU FINISH', W / 2, 158, 8, '#d9b98a', 'center');
    if (endTimer > 30) { text('ENTER: BEGIN CYCLE ' + (cycle + 2) + '  (+1 COIN, TOUGHER FOES)', W / 2, 184, 9, '#fff', 'center'); text('ESC: FINISH AND SIGN THE LEATHERBOARD', W / 2, 198, 8, '#b8a8c8', 'center'); }
    drawDonate(222);
  }
}

/* ---------- WebGL CRT / bloom presentation ---------- */
let gl = null, glProg, glTex, uCrt, uTime;
function initGL() {
  gl = screen.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return false;
  const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float crt;uniform float time;
  const vec2 R=vec2(${W}.,${H}.);
  vec3 S(vec2 u){return texture2D(t,vec2(u.x,1.-u.y)).rgb;}
  void main(){
    vec2 c=uv*2.-1.; vec2 q=uv;
    if(crt>.5){ c*=1.+dot(c,c)*vec2(.035,.05); q=c*.5+.5; }
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
    vec3 col=S(q);
    if(crt>.5){
      vec2 px=1./R; vec3 b=vec3(0.);
      for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 s=S(q+vec2(float(i),float(j))*px*2.);b+=max(s-.55,0.);}
      col+=b/25.*1.6;
      float ca=.0008; col.r=mix(col.r,S(q+vec2(ca,0.)).r,.6); col.b=mix(col.b,S(q-vec2(ca,0.)).b,.6);
      float sl=.82+.18*sin(q.y*R.y*6.2831); col*=sl;
      float m=.9+.1*sin(q.x*R.x*6.2831); col*=m;
      float v=smoothstep(1.25,.35,length(c)); col*=mix(.55,1.,v);
      col*=1.08+.015*sin(time*60.);
    }
    gl_FragColor=vec4(pow(col,vec3(.95)),1.);
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
  uCrt = gl.getUniformLocation(glProg, 'crt'); uTime = gl.getUniformLocation(glProg, 'time');
  return true;
}
function present() {
  if (gl) {
    gl.viewport(0, 0, screen.width, screen.height);
    gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.uniform1f(uCrt, crtOn ? 1 : 0); gl.uniform1f(uTime, performance.now() / 1000 % 100);
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
  const mk = (cls, style, txt) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = style; if (txt) d.textContent = txt; document.body.appendChild(d); return d; };
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
  window.refreshTouchLabels = () => { for (const d of all) if (d.dataset && d.dataset.k) d.textContent = LANG === 'hu' && typeof HU_TOUCH !== 'undefined' && HU_TOUCH[d.dataset.k] ? HU_TOUCH[d.dataset.k] : d.dataset.k; };
  refreshTouchLabels();
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
  const show = () => { for (const d of all) d.classList.add('on'); };
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
    acc += Math.min(100, now - last); last = now;
    while (acc >= 1000 / 60) { step(); for (const k in pressed) delete pressed[k]; acc -= 1000 / 60; }
    render(); present();
    requestAnimationFrame(frame);
  })(last);
}
