// Header: title bar, a drifting dithered band (grey haze with an ember core, fading into the panel),
// then the name and intro beside a 2×2 grid of stats.
import { bayerLevels } from '../dither.mjs';
import { fbm, smoothstep } from '../noise.mjs';
import { indexedPng, hexToRgba } from '../raster.mjs';
import { PX, clamp01, textKit, svgDoc, frame, hline, vline, cell, BAR, measurer, truncate } from '../svg.mjs';

const W = 880;
const BAND_H = 272;
const INFO_H = 168;
const H = BAR + BAND_H + INFO_H;
const CW = W / PX;
const CH = BAND_H / PX;

function bandIndices(seed, levels) {
  const values = new Float32Array(CW * CH);
  const haze = { tileWidth: CW, features: 6, octaves: 5, seed };
  const core = { tileWidth: CW, features: 10, octaves: 4, seed: seed + 3 };
  for (let y = 0; y < CH; y++) {
    const t = y / (CH - 1);
    for (let x = 0; x < CW; x++) {
      const u = x / CW;
      // Whole-number wave counts keep the band seamless across the tile, so it can loop while drifting.
      const centre = 0.52 + 0.1 * Math.sin(2 * Math.PI * (2 * u) + 0.4) + 0.05 * Math.sin(2 * Math.PI * (3 * u) + 2.1);
      const d = t - centre;
      // Stretching noise vertically gives long horizontal streaks.
      const mist = Math.exp(-((d / 0.26) ** 2)) * (0.3 + 0.7 * fbm(x, y * 2.2, haze));
      const glow = Math.exp(-((d / 0.085) ** 2)) * smoothstep(0.36, 0.66, fbm(x, y * 3, core));
      values[y * CW + x] = clamp01(0.66 * mist + 0.6 * glow);
    }
  }
  return bayerLevels(values, CW, CH, levels);
}

export async function headerSvg(config, mode, data) {
  const theme = config.theme[mode];
  const { name, intro, now, mark, status, focus } = config.profile;
  const { username } = config.github;
  const seed = config.effects?.seed ?? 1;
  const seconds = config.motion?.bandSeconds ?? 120;
  const t = textKit();

  const band = await indexedPng(bandIndices(seed, theme.ramp.length), CW, CH, theme.ramp.map((c) => hexToRgba(c)));
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
    t('sansBold', name, { x: 32, y: top + 62, size: 52, fill: theme.text1, spacing: -1.5 }),
    t('sans', truncate(intro, gridX - 64, measurer('sans', 16)), { x: 34, y: top + 92, size: 16, fill: theme.text2 }),
    t('mono', 'NOW', { x: 34, y: top + 128, size: 11, fill: theme.text3, spacing: 1.2 }),
    t('monoBold', truncate(now, gridX - 140, measurer('monoBold', 13)), { x: 110, y: top + 128, size: 13, fill: theme.text1 }),
    t('mono', 'HANDLE', { x: 34, y: top + 150, size: 11, fill: theme.text3, spacing: 1.2 }),
    t('monoBold', `@${username}`, { x: 110, y: top + 150, size: 13, fill: theme.text1 }),
    // Stats grid.
    vline(theme, gridX, top, H),
    vline(theme, gridX + colW, top, H),
    hline(theme, gridX, W, top + rowH),
    ...stats.map(([label, value], i) => cell(theme, t, label, value, gridX + (i % 2) * colW + 20, top + Math.floor(i / 2) * rowH + 30)),
  ].join('\n');

  const style = `${await t.style()}
.drift{animation:drift ${seconds}s linear infinite}
@keyframes drift{to{transform:translateX(-${W}px)}}
.m1{animation:blink 1.6s steps(1,end) infinite}
.m2{animation:blink 1.6s steps(1,end) infinite -.8s}
@keyframes blink{50%{opacity:.25}}`;
  const defs = `<image id="band" class="px" image-rendering="optimizeSpeed" width="${W}" height="${BAND_H}" y="${BAR}" href="${band}"/><clipPath id="bandclip"><rect x="1" y="${BAR + 1}" width="${W - 2}" height="${BAND_H - 1}"/></clipPath>`;
  return svgDoc({ w: W, h: H, title: `${name}. ${intro}`, style, defs, body });
}
