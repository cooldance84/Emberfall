/* ---------- music bus: the recorded tracks (32-tracks.js) play through one gain and a compressor; heavy sounds duck it ---------- */
let mGain = null, mDuck = null;
function mChain() {
  mGain = ac.createGain(); mGain.gain.value = 0.7; mDuck = ac.createGain(); mDuck.gain.value = 1; mDuck.connect(ac.destination);
  let dst = mDuck;
  if (ac.createDynamicsCompressor) { try { const cp = ac.createDynamicsCompressor(); cp.connect(mDuck); dst = cp; } catch (e) { } }
  mGain.connect(dst);
}
function musicTick() {
  if (ac && rec.decks && (!musicOn || muted)) recHalt();
  if (!ac || !mGain || !musicOn || muted || ac.state !== 'running') return;
  const boss = mode === 'play' && !!bossRef && !bossRef.dead;
  mGain.gain.setTargetAtTime((mode === 'pause' || mode === 'inv' ? 0.28 : boss ? 0.8 : 0.7) * MUS_MUL[musicVol], ac.currentTime, 0.1);
  recTick(recCueOf(mode, boss, rec.cue), mode === 'play' && !boss && !enemies.some(e => !e.dead && e.kind !== 'imp') ? 0.62 : 1);
}
