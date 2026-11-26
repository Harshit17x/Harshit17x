// Seeded randomness and value noise. Everything is deterministic so daily rebuilds don't churn the SVGs.

export function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Value noise whose lattice wraps every `period` cells along x, so it tiles horizontally.
export function valueNoise(x, y, period, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const wrap = (i) => ((i % period) + period) % period;
  const a = hash2(wrap(x0), y0, seed);
  const b = hash2(wrap(x0 + 1), y0, seed);
  const c = hash2(wrap(x0), y0 + 1, seed);
  const d = hash2(wrap(x0 + 1), y0 + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

// Fractal noise in [0, 1] that repeats every `tileWidth` units along x.
// `features` is how many base-octave noise cells span one tile.
export function fbm(x, y, { tileWidth, features = 4, octaves = 5, seed = 1 }) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const period = features * 2 ** o;
    const freq = period / tileWidth;
    sum += amp * valueNoise(x * freq, y * freq, period, seed + o * 101);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

export const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
