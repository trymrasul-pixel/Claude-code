// Small math helpers + physics of a Moon falling from rest.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeO = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeI = t => clamp(t) ** 3;
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// hash-based value noise
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 5, s = 0) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); f *= 2; a *= 0.5; } return v; }
// tileable (periodic in x with period px) value noise for equirect maps
export function fbmWrap(x, y, px, oct = 5, s = 0) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    const P = px * f, X = x * f, Y = y * f;
    const xi = Math.floor(X), yi = Math.floor(Y), xf = X - xi, yf = Y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const m = k => ((k % P) + P) % P;
    const h = (xx, yy) => hash(m(xx), yy, s + i * 17);
    v += a * lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), w);
    f *= 2; a *= 0.5;
  }
  return v;
}

// ---------- Physics: radial free fall of the Moon from rest at 384,400 km ----------
const GM = 3.986e14 * 1.0123;   // Earth + Moon
const R0 = 3.844e8;              // m
const CONTACT = 8.108e6;         // Earth radius + Moon radius (m)
function tOf(r) { const x = r / R0; return Math.sqrt(R0 ** 3 / (2 * GM)) * (Math.sqrt(x * (1 - x)) + Math.acos(Math.sqrt(x))); }
export const T_IMPACT_H = tOf(CONTACT) / 3600; // ≈ 115.61 h
export function distKm(hours) {
  const s = hours * 3600;
  if (s <= 0) return R0 / 1000;
  if (s >= tOf(CONTACT)) return CONTACT / 1000;
  let lo = CONTACT, hi = R0;
  for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (tOf(m) > s) lo = m; else hi = m; }
  return (lo + hi) / 2000;
}
export function speedKms(hours) { const r = distKm(hours) * 1000; return Math.sqrt(Math.max(0, 2 * GM * (1 / r - 1 / R0))) / 1000; }
export const sizeX = h => 384400 / distKm(h);
export const tidalX = h => sizeX(h) ** 3;
