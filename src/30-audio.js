/* ---------- audio (tiny synth) ---------- */
let ac = null, sfxBus = null;
const MUS_MUL = [0, 0.3, 0.55, 0.8, 1.05, 1.3], SFX_MUL = [0, 0.5, 0.85, 1.2, 1.6, 2.1]; // volume steps 0 (off) to 5 (max); 3 is the middle
function setVol(music, v) { // the pause menu's volume rows
  v = Math.max(0, Math.min(5, v | 0));
  if (music) { musicVol = v; musicOn = v > 0; } else { sfxVol = v; sfxOn = v > 0; if (sfxBus) sfxBus.gain.value = SFX_MUL[v]; }
  saveSettings();
}
function initAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); mChain(); sfxBus = ac.createGain(); sfxBus.gain.value = SFX_MUL[sfxVol]; sfxBus.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
}
function sfxTone(type, f0, f1, dur, vol) {
  if (!ac || muted || !sfxOn) return;
  const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn); gn.connect(sfxBus || ac.destination); o.start(t); o.stop(t + dur);
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

