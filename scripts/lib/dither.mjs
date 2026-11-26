// Dithering on a grid of brightness values in [0, 1]. Output is one bit per cell (1 = ink).

function bayerMatrix(size) {
  let m = [[0]];
  while (m.length < size) {
    const s = m.length;
    const next = [];
    for (let y = 0; y < 2 * s; y++) {
      next.push([]);
      for (let x = 0; x < 2 * s; x++) {
        const quadrant = [0, 2, 3, 1][(y >= s) * 2 + (x >= s)];
        next[y].push(m[y % s][x % s] * 4 + quadrant);
      }
    }
    m = next;
  }
  return m;
}

export const BAYER8 = bayerMatrix(8);

// Ordered dither: a fixed, stable pattern. Used for gradients and anything that moves.
export function bayer(values, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      out[i] = values[i] > (BAYER8[y & 7][x & 7] + 0.5) / 64 ? 1 : 0;
    }
  }
  return out;
}

// Ordered dither across a ramp of `levels` colours. Returns ramp indexes 0..levels-1.
export function bayerLevels(values, w, h, levels) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = Math.min(1, Math.max(0, values[i])) * (levels - 1);
      const base = Math.floor(s);
      out[i] = Math.min(levels - 1, base + (s - base > (BAYER8[y & 7][x & 7] + 0.5) / 64 ? 1 : 0));
    }
  }
  return out;
}

// Atkinson error diffusion: spreads 6/8 of the error, which keeps highlights crisp (the early-Mac look).
// With levels > 2 it quantises to the nearest step of a colour ramp and returns ramp indexes.
const ATKINSON = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];

export function atkinson(values, w, h, levels = 2) {
  const buf = Float32Array.from(values);
  const out = new Uint8Array(w * h);
  const steps = levels - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const level = Math.min(steps, Math.max(0, Math.round(buf[i] * steps)));
      out[i] = level;
      const err = (buf[i] - level / steps) / 8;
      for (const [dx, dy] of ATKINSON) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny < h) buf[ny * w + nx] += err;
      }
    }
  }
  return out;
}
