/* ---------- audio (tiny synth) ---------- */
let ac = null;
function initAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); mChain();
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
  die: () => tone('sawtooth', 220, 30, 0.5, 0.1),
  burn: () => { tone('sawtooth', 300, 90, 0.28, 0.05); tone('square', 520, 160, 0.16, 0.03); },
  freeze: () => { tone('sine', 1500, 900, 0.3, 0.06); tone('triangle', 2300, 1700, 0.18, 0.04); },
  zap: () => { tone('square', 900, 120, 0.12, 0.06); tone('sawtooth', 1400, 200, 0.1, 0.04); },
  shatter: () => { tone('triangle', 1800, 300, 0.22, 0.07); tone('square', 700, 120, 0.12, 0.04); }
};

