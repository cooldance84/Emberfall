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

