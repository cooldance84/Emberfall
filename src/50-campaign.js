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

