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
  if (f.st === 'getup') { if (++f.t > (f.pn ? 18 : 12)) { f.st = 'idle'; f.t = 0; f.inv = f.pn ? 40 : 14; if (!f.pn && !isBoss(f)) f.toughT = tickN + 75; } return true; }
  return false;
}

