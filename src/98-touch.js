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
  const show = () => { window.touchActive = true; for (const d of all) d.classList.add('on'); };
  if ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window) show();
  addEventListener('touchstart', show, { once: true, passive: true });
}

