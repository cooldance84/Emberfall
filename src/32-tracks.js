/* ---------- the music: CC0 tracks from music/, streamed and crossfaded (there is no other score: a page opened from disk, a missing file or a decoding error mean silence) ---------- */
const REC = { // cue: the tracks it plays one after the other, and the crossfade at each join (seconds)
  menu: { list: ['tower-inn'], x: 0.3 },     // a seamless loop
  stage: { list: ['battle-a', 'battlegrounds'], x: 2.5 },
  boss: { list: ['boss'], x: 1.5 }           // cut at a bar line so the end runs back into the start
};
const REC_DUR = { 'tower-inn': 49.95, 'battle-a': 92.05, battlegrounds: 92.75, boss: 41.5 };
let rec = { cue: null, i: 0, cur: -1, decks: null, bus: null, ok: null, fail: false };
function recCueOf(m, boss, cur) { // which cue a game state wants: the pause menu and the backpack keep what plays, game over is silent, every calm screen (menus, story, shop, forge, victory) shares the inn loop
  if (m === 'pause' || m === 'inv') return cur;
  return boss ? 'boss' : m === 'play' ? 'stage' : m === 'gameover' ? null : 'menu';
}
function recInit() {
  if (rec.decks) return true; if (rec.ok === false || !ac || !mGain) return false;
  if (typeof Audio === 'undefined' || !ac.createMediaElementSource || (typeof location !== 'undefined' && location.protocol === 'file:')) { rec.ok = false; return false; } // a page opened from disk cannot route audio files
  try {
    rec.bus = ac.createGain(); rec.bus.connect(mGain);
    rec.decks = [0, 1].map(() => { const el = new Audio(), g = ac.createGain(); el.preload = 'auto'; g.gain.value = 0; ac.createMediaElementSource(el).connect(g); g.connect(rec.bus); el.addEventListener('error', () => { rec.fail = true; }); return { el, g, key: null, stopAt: 0 }; });
    rec.ok = true; return true;
  } catch (e) { rec.decks = null; rec.ok = false; return false; }
}
function recFade(d, to, t, s) { const p = d.g.gain; if (p.cancelScheduledValues) p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(to, t + s); }
function recStart(key, fadeS) { // the next track comes in on the idle deck while the playing one fades out
  const t = ac.currentTime, old = rec.cur >= 0 ? rec.decks[rec.cur] : null, ni = old ? 1 - rec.cur : 0, d = rec.decks[ni];
  if (old) { recFade(old, 0, t, fadeS); old.stopAt = t + fadeS + 0.1; }
  d.key = key; d.stopAt = 0; d.el.src = 'music/' + key + '.mp3'; try { d.el.currentTime = 0; } catch (e) { }
  d.g.gain.cancelScheduledValues && d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(0, t); d.g.gain.linearRampToValueAtTime(1, t + fadeS);
  const pr = d.el.play(); if (pr && pr.catch) pr.catch(() => { });
  rec.cur = ni;
  if (typeof fetch === 'function') { const L = REC[rec.cue].list; fetch('music/' + L[(rec.i + 1) % L.length] + '.mp3').catch(() => { }); } // warm the cache for the next join
}
function recRelease(s) { // the procedural score takes over: the recorded track fades away
  if (rec.cur >= 0 && rec.decks) { const t = ac.currentTime, d = rec.decks[rec.cur]; recFade(d, 0, t, s); d.stopAt = t + s + 0.1; rec.cur = -1; }
  rec.cue = null;
}
function recHalt() { // music off or muted: stop at once, start again from the top of the cue later
  if (rec.decks) for (const d of rec.decks) { try { d.el.pause(); } catch (e) { } d.stopAt = 0; d.key = null; d.g.gain.value = 0; }
  rec.cur = -1; rec.cue = null;
}
function recTick(cue, level) { // true while a recorded track carries the music
  if (rec.fail) { if (rec.decks) recHalt(); return false; }
  if (!cue) { if (rec.cue) recRelease(1); }
  else if (recInit()) {
    const t = ac.currentTime;
    if (cue !== rec.cue) { rec.cue = cue; rec.i = cue === 'stage' ? stageIdx % REC[cue].list.length : 0; recStart(REC[cue].list[rec.i], 1.2); }
    else if (rec.cur >= 0) {
      const d = rec.decks[rec.cur], X = REC[cue].x, len = isFinite(d.el.duration) && d.el.duration > 5 ? d.el.duration : REC_DUR[d.key] || 60;
      if (d.el.currentTime >= len - X - 0.05) { rec.i = (rec.i + 1) % REC[cue].list.length; recStart(REC[cue].list[rec.i], X); }
    }
    if (rec.bus.gain.setTargetAtTime) rec.bus.gain.setTargetAtTime(level, t, 0.5);
  }
  if (rec.decks) { const t = ac.currentTime; for (const d of rec.decks) if (d.stopAt && t > d.stopAt) { try { d.el.pause(); } catch (e) { } d.stopAt = 0; d.key = null; } }
  const c = rec.cur >= 0 && rec.decks ? rec.decks[rec.cur] : null;
  return !!(cue && c && !c.el.paused && c.el.readyState >= 3 && c.el.currentTime > 0.05);
}
