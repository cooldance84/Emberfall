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
