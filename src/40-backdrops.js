/* ---------- utils ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- procedural backdrops (pre-rendered, parallax) ---------- */
const LAYER_W = 960;
function makeLayer(draw, h) {
  const c = document.createElement('canvas'); c.width = LAYER_W; c.height = h || GROUND_TOP + 10;
  draw(c.getContext('2d'), c.width, c.height); return c;
}
function periodic(x, seed) { // seamless wrap by using integer-cycle sines
  let v = 0;
  for (let i = 1; i <= 6; i++) v += Math.sin(2 * Math.PI * i * x / LAYER_W + seed * i * 1.7) * (1 / i);
  return v;
}
