// Night footer: dithered snowy mountains and a pine forest under a starfield, after the snowy-forest pin.
import { bayerLevels } from '../dither.mjs';
import { fbm, mulberry32, smoothstep } from '../noise.mjs';
import { indexedPng, hexToRgba } from '../raster.mjs';
import { PX, esc, clamp01, SPARKLE, sparkle, glowFilter, baseStyle, fontRules, svgDoc, pxImage, bitmapPath } from '../svg.mjs';

const W = 880;
const H = 220;
const CW = W / PX;
const CH = H / PX;

const MOON = ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'];

function sceneIndices(mode, seed, levels) {
  const dark = mode === 'dark';
  const values = new Float32Array(CW * CH);
  const silhouette = new Uint8Array(CW * CH);
  // Five-octave fbm sits mostly in 0.4..0.6; stretch that to peaks between 22% and 66% of the height.
  const ridge = (x) => CH * (0.22 + 0.44 * clamp01((fbm(x, 3.5, { tileWidth: CW, features: 3, octaves: 5, seed: seed + 5 }) - 0.4) / 0.2));
  const ground = (x) => CH * (0.8 + 0.05 * fbm(x, 9.5, { tileWidth: CW, features: 2, octaves: 3, seed: seed + 9 }));

  for (let x = 0; x < CW; x++) {
    const top = ridge(x);
    const slope = ridge(x + 1) - ridge(x - 1); // positive = ground falls to the right, facing the moon on the left
    const lit = clamp01(0.5 + slope * 0.35);
    for (let y = 0; y < CH; y++) {
      const t = y / (CH - 1);
      const i = y * CW + x;
      if (y < top) {
        values[i] = 0.03 + 0.22 * t ** 1.8; // sky warming toward the horizon
      } else {
        const depth = (y - top) / CH;
        const snow = 1 - smoothstep(0.02, 0.14, depth); // thin snow caps along the peaks
        // Dim bronze bodies, gold only where snow faces the moon, so the scene stays quiet behind the pines.
        const v = (0.16 + 0.12 * lit) * (1 - snow) + (0.3 + 0.55 * lit) * snow;
        values[i] = dark ? v : 0.1 + 0.4 * (1 - lit) * (1 - snow) + 0.08 * snow;
      }
    }
  }

  // Pines: stacked, jagged triangles standing on an uneven ground line.
  const rand = mulberry32(seed + 31);
  for (let x = 2; x < CW; x += 3 + Math.floor(rand() * 6)) {
    const base = Math.round(ground(x));
    const height = 8 + Math.floor(rand() * 14);
    for (let dy = 0; dy < height; dy++) {
      const tier = (dy % 4) / 4; // each tier flares out, giving the jagged pine edge
      const half = Math.floor(((height - dy) / height) * (height * 0.28) * (0.6 + 0.4 * (1 - tier)));
      for (let dx = -half; dx <= half; dx++) {
        const px = x + dx;
        const py = base - dy;
        if (px >= 0 && px < CW && py >= 0 && py < CH) silhouette[py * CW + px] = 1;
      }
    }
  }
  for (let x = 0; x < CW; x++) for (let y = Math.round(ground(x)); y < CH; y++) silhouette[y * CW + x] = 1;

  const idx = bayerLevels(values, CW, CH, levels);
  const night = dark ? 0 : levels - 1;
  const starRand = mulberry32(seed + 77);
  for (let i = 0; i < CW * CH; i++) {
    if (silhouette[i]) idx[i] = night;
    else if (i < CW * CH * 0.35 && idx[i] <= 1 && starRand() < (dark ? 0.012 : 0.003)) idx[i] = dark ? levels - 2 : levels - 3;
  }
  return idx;
}

export async function footerSvg(config, mode) {
  const theme = config.theme[mode];
  const levels = theme.ramp.length;
  const seed = config.effects?.seed ?? 1;
  const { name, signoff = 'see you around' } = config.profile;
  const left = `${name} · ${new Date().getUTCFullYear()}`;
  const scene = await indexedPng(sceneIndices(mode, seed, levels), CW, CH, theme.ramp.map((c) => hexToRgba(c)));
  const style = (await fontRules({ caps: (left + signoff).toUpperCase() })) + baseStyle(theme);
  const body = [
    pxImage(scene, W, H),
    `<g filter="url(#glow)" shape-rendering="crispEdges"><path fill="${theme.ramp.at(-1)}" d="${bitmapPath(MOON, PX, 64, 28)}"/>`,
    sparkle(SPARKLE.small, 640, 44, { dur: 3.4 }),
    sparkle(SPARKLE.tiny, 760, 30, { dur: 2.7, delay: -1.1 }),
    sparkle(SPARKLE.tiny, 300, 56, { dur: 3.9, delay: -2 }),
    '</g>',
    `<text class="caps small" x="36" y="206" fill="${theme.ramp.at(mode === 'dark' ? -2 : 0)}" style="fill:${theme.ramp.at(mode === 'dark' ? -2 : 0)}">${esc(left.toUpperCase())}</text>`,
    `<text class="caps small" x="844" y="206" text-anchor="end" style="fill:${theme.ramp.at(mode === 'dark' ? -2 : 0)}">${esc(signoff.toUpperCase())}</text>`,
  ].join('\n');
  return svgDoc({ w: W, h: H, title: `Night scene. ${signoff}`, style, defs: glowFilter(theme), body });
}
