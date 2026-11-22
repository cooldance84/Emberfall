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
  if (ac && rec.decks && (!musicOn || muted)) recHalt();
  if (!ac || !mGain || !musicOn || muted || ac.state !== 'running') return;
  const boss = mode === 'play' && !!bossRef && !bossRef.dead;
  const menu = mode === 'title' || mode === 'select' || mode === 'dailyinfo' || mode === 'journey' || mode === 'board' || mode === 'name' || mode === 'cloud';
  const th = mode === 'gameover' ? -1 : menu ? MUS_TITLE : mode === 'story' && story ? story.theme : mode === 'victory' ? 4 : STAGES[stageIdx].theme;
  mGain.gain.setTargetAtTime(mode === 'pause' || mode === 'inv' ? 0.28 : boss ? 0.8 : 0.7, ac.currentTime, 0.1);
  if (recTick(recCueOf(mode, boss, menu, rec.cue), mode === 'play' && !boss && !enemies.some(e => !e.dead && e.kind !== 'imp') ? 0.62 : 1)) return; // a recorded track carries the music
  if (th < 0) return;
  if (mode !== 'pause' && mode !== 'inv') mWant = boss ? 2 : mode === 'story' ? 0 : mode === 'play' ? (enemies.some(e => !e.dead && e.kind !== 'imp') ? 1 : 0) : 1;
  const trk = boss ? MUS_BOSS : th;
  if (trk !== mTrack || mNext < ac.currentTime - 0.5) { mTrack = trk; mStep = 0; mNext = ac.currentTime + 0.06; mLvl = mWant; mLow = 0; }
  if (mRevIn) mRevIn.gain.setTargetAtTime(MUS[trk].rev, ac.currentTime, 0.4);
  mSchedule(MUS[trk], ac.currentTime + 0.22);
}

