// Utilidades gerais: RNG, ruído periódico, helpers
const PI2 = Math.PI * 2;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash2 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
const rr = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
function angDiff(a, b) { let d = (b - a) % PI2; if (d > Math.PI) d -= PI2; if (d < -Math.PI) d += PI2; return d; }

const _grids = {};
function gridFor(seed, n) {
  const k = seed * 1000 + n;
  let g = _grids[k];
  if (!g) {
    const r = mulberry32(seed * 7919 + n);
    g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = r();
    _grids[k] = g;
  }
  return g;
}
function vnoise(g, n, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % n) + n) % n, x1 = (x0 + 1) % n, y0 = ((yi % n) + n) % n, y1 = (y0 + 1) % n;
  const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// ruído fractal periódico em [0,1) — tileável
function fbm(seed, u, v, oct = 5, base = 4) {
  let s = 0, a = 0.5, t = 0;
  for (let o = 0; o < oct; o++) {
    const n = base << o;
    s += a * vnoise(gridFor(seed + o, n), n, u * n, v * n);
    t += a; a *= 0.5;
  }
  return s / t;
}
