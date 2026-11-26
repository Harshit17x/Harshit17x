import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAYER8, bayer, bayerLevels, atkinson } from '../scripts/lib/dither.mjs';
import { fbm, mulberry32 } from '../scripts/lib/noise.mjs';
import { validateConfig } from '../scripts/lib/config.mjs';

const fill = (n, v) => new Float32Array(n).fill(v);
const ones = (bits) => bits.reduce((a, b) => a + b, 0);

test('Bayer matrix holds each threshold 0..63 exactly once', () => {
  assert.deepEqual(BAYER8.flat().sort((a, b) => a - b), [...Array(64).keys()]);
});

test('Bayer dither matches the input level exactly over one 8x8 tile', () => {
  for (const [v, expected] of [[0, 0], [0.25, 16], [0.5, 32], [1, 64]]) {
    assert.equal(ones(bayer(fill(64, v), 8, 8)), expected, `level ${v}`);
  }
});

test('Atkinson keeps solid black and white solid, and is deterministic', () => {
  assert.equal(ones(atkinson(fill(100, 0), 10, 10)), 0);
  assert.equal(ones(atkinson(fill(100, 1), 10, 10)), 100);
  const gradient = Float32Array.from({ length: 400 }, (_, i) => (i % 20) / 19);
  assert.deepEqual(atkinson(gradient, 20, 20), atkinson(gradient, 20, 20));
  assert.ok(atkinson(gradient, 20, 20).every((b) => b === 0 || b === 1));
});

test('multi-level dithers stay inside the ramp and hit exact steps', () => {
  assert.ok(bayerLevels(fill(64, 0), 8, 8, 8).every((i) => i === 0));
  assert.ok(bayerLevels(fill(64, 1), 8, 8, 8).every((i) => i === 7));
  assert.ok(bayerLevels(fill(64, 0.5), 8, 8, 3).every((i) => i === 1));
  const mix = bayerLevels(fill(64, 0.25), 8, 8, 3);
  assert.equal(mix.filter((i) => i === 1).length, 32);
  const gradient = Float32Array.from({ length: 400 }, (_, i) => (i % 20) / 19);
  assert.ok(atkinson(gradient, 20, 20, 8).every((i) => i >= 0 && i <= 7));
});

test('fbm tiles horizontally so drifting clouds loop without a seam', () => {
  const opts = { tileWidth: 220, features: 4, seed: 3 };
  const rand = mulberry32(1);
  for (let k = 0; k < 50; k++) {
    const x = rand() * 220;
    const y = rand() * 90;
    assert.ok(Math.abs(fbm(x, y, opts) - fbm(x + 220, y, opts)) < 1e-9);
  }
});

test('config validation names every missing or malformed field', () => {
  assert.throws(() => validateConfig({}), /missing github\.username[\s\S]*missing theme\.light/);
  const c = '#101010';
  const theme = {
    page: c, panel: c, well: c, line: c, text1: c, text2: c, text3: 'grey', accent: c, onAccent: c,
    ramp: [c, c, c, c, c, c], accentSteps: 9,
  };
  assert.throws(
    () => validateConfig({
      github: { username: 'u', featuredRepos: [{ repo: 'a' }] },
      profile: { name: 'n', intro: 'i', now: 'n', mark: 'm', status: 's', focus: 'f' },
      links: [{ label: 'x', url: 'ftp://nope' }],
      stack: { tools: [] },
      theme: { dark: theme, light: theme },
    }),
    /theme\.dark\.text3 must be a #rrggbb colour[\s\S]*accentSteps[\s\S]*featuredRepos must list 1 to 6[\s\S]*links\[0\]\.url[\s\S]*stack\["tools"\]/,
  );
});
