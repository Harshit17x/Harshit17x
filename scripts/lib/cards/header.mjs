// Header: title bar, a drifting band of LED dots (streaks falling onto a bright horizon, fading to dark),
// then the name and intro beside a 2×2 grid of stats.
import { bayerLevels } from '../dither.mjs';
import { fbm, smoothstep } from '../noise.mjs';
import { indexedPng, hexToRgba, TRANSPARENT } from '../raster.mjs';
import { PX, clamp01, textKit, svgDoc, frame, hline, vline, cell, BAR, measurer, truncate } from '../svg.mjs';

const W = 880;
const BAND_H = 168;
const INFO_H = 196;
const H = BAR + BAND_H + INFO_H;
const CW = W / PX;
const CH = BAND_H / PX;

function bandIndices(seed, levels) {
  const values = new Float32Array(CW * CH);
  const rain = { tileWidth: CW, features: 44, octaves: 3, seed };
  const breaks = { tileWidth: CW, features: 14, octaves: 3, seed: seed + 3 };
  for (let y = 0; y < CH; y++) {
    const t = y / (CH - 1);
    for (let x = 0; x < CW; x++) {
      const u = x / CW;
      // Whole-number wave counts keep the band seamless across the tile, so it can loop while drifting.
      const horizon = 0.6 + 0.035 * Math.sin(2 * Math.PI * (2 * u) + 0.4) + 0.02 * Math.sin(2 * Math.PI * (5 * u) + 1.3);
      const d = t - horizon;
      const line = Math.exp(-((d / 0.038) ** 2)) * (0.5 + 0.5 * smoothstep(0.3, 0.7, fbm(x, y, breaks)));
      let v;
      if (d < 0) {
        // Squashing y in the noise stretches it into vertical streaks that brighten toward the horizon.
        const streak = smoothstep(0.34, 0.74, fbm(x, y * 0.1, rain));
        const rise = 0.3 + 0.7 * clamp01(1 + d / 0.6) ** 1.6;
        const mist = Math.exp(-((d / 0.14) ** 2));
        v = 0.03 + 0.7 * streak * rise + 0.32 * mist + line;
      } else {
        v = 0.03 + line + 0.4 * Math.exp(-d / 0.08) * fbm(x, y * 0.5, rain);
      }
      values[y * CW + x] = clamp01(v);
    }
  }
  return bayerLevels(values, CW, CH, levels);
}

// Draw each dither cell as a 3×3 dot with a 1px gap, so the band reads as an LED matrix.
function ledGrid(indices, gap) {
  const out = new Uint8Array(W * BAND_H).fill(gap);
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const i = indices[y * CW + x];
      for (let dy = 0; dy < PX - 1; dy++) out.fill(i, (y * PX + dy) * W + x * PX, (y * PX + dy) * W + x * PX + PX - 1);
    }
  }
  return out;
}

export async function headerSvg(config, mode, data) {
  const theme = config.theme[mode];
  const { name, intro, now, mark, status, focus } = config.profile;
  const { username } = config.github;
  const seed = config.effects?.seed ?? 1;
  const seconds = config.motion?.bandSeconds ?? 120;
  const t = textKit();

  const palette = [...theme.ramp.map((c) => hexToRgba(c)), TRANSPARENT];
  const band = await indexedPng(ledGrid(bandIndices(seed, theme.ramp.length), palette.length - 1), W, BAND_H, palette);
  const top = BAR + BAND_H;
  const gridX = 560;
  const colW = (W - gridX) / 2;
  const rowH = INFO_H / 2;
  const nameW = measurer('mono', 14)(name);
  const markX = 20 + nameW + 14;

  const stats = [
    ['repositories', data.totals.repos.toLocaleString('en-US')],
    ['contributions', data.totals.contributions.toLocaleString('en-US')],
    ['status', status],
    ['focus', focus],
  ];

  const body = [
    frame(theme, W, H),
    // Title bar: name, a blinking 2×2 mark, the mark word, and the profile address.
    t('monoBold', name, { x: 20, y: 30, size: 14, fill: theme.text1 }),
    `<g fill="${theme.accent}"><rect class="m1" x="${markX}" y="20" width="4" height="4"/><rect class="m2" x="${markX + 6}" y="20" width="4" height="4"/><rect class="m2" x="${markX}" y="26" width="4" height="4"/><rect class="m1" x="${markX + 6}" y="26" width="4" height="4"/></g>`,
    t('monoBold', mark.toUpperCase(), { x: markX + 20, y: 30, size: 13, fill: theme.text1, spacing: 1.2 }),
    t('mono', `github.com/${username}`, { x: W - 20, y: 30, size: 13, fill: theme.text3, anchor: 'end' }),
    hline(theme, 0, W, BAR),
    // The band, drawn twice side by side and slid left by one width for a seamless loop.
    `<g clip-path="url(#bandclip)"><g class="drift"><use href="#band"/><use href="#band" x="${W}"/></g></g>`,
    hline(theme, 0, W, top),
    // Name and intro.
    t('sans', name, { x: 30, y: top + 84, size: 64, fill: theme.text1, spacing: -2.5 }),
    t('mono', truncate(intro, gridX - 68, measurer('mono', 15)), { x: 34, y: top + 118, size: 15, fill: theme.text2 }),
    t('mono', 'NOW', { x: 34, y: top + 158, size: 11, fill: theme.text3, spacing: 1.2 }),
    t('monoBold', truncate(now, gridX - 150, measurer('monoBold', 14)), { x: 120, y: top + 158, size: 14, fill: theme.text1 }),
    t('mono', 'HANDLE', { x: 34, y: top + 182, size: 11, fill: theme.text3, spacing: 1.2 }),
    t('monoBold', `@${username}`, { x: 120, y: top + 182, size: 14, fill: theme.text1 }),
    // Stats grid.
    vline(theme, gridX, top, H),
    vline(theme, gridX + colW, top, H),
    hline(theme, gridX, W, top + rowH),
    ...stats.map(([label, value], i) => cell(theme, t, label, value, gridX + (i % 2) * colW + 20, top + Math.floor(i / 2) * rowH + 40)),
  ].join('\n');

  const style = `${await t.style()}
.drift{animation:drift ${seconds}s linear infinite}
@keyframes drift{to{transform:translateX(-${W}px)}}
.m1{animation:blink 1.6s steps(1,end) infinite}
.m2{animation:blink 1.6s steps(1,end) infinite -.8s}
@keyframes blink{50%{opacity:.25}}`;
  const defs = `<image id="band" width="${W}" height="${BAND_H}" y="${BAR}" href="${band}"/><clipPath id="bandclip"><rect x="1" y="${BAR + 1}" width="${W - 2}" height="${BAND_H - 1}"/></clipPath>`;
  return svgDoc({ w: W, h: H, title: `${name}. ${intro}`, style, defs, body });
}
