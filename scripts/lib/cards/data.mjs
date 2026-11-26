// Cards drawn from GitHub data: signal (halftone contributions + dithered language bars) and featured projects.
import { bayer, bayerLevels } from '../dither.mjs';
import { fbm, smoothstep } from '../noise.mjs';
import { indexedPng, hexToRgba } from '../raster.mjs';
import { THUMB } from '../github.mjs';
import { MONO_ADVANCE } from '../font.mjs';
import {
  PX, esc, clamp01, bitmapPath, baseStyle, fontRules, svgDoc, sectionLabel, sectionLabelGlyphs, pxImage, wrap,
  SPARKLE,
} from '../svg.mjs';

const W = 880;
const fmt = (n) => n.toLocaleString('en-US');

// Halftone contribution graph: one dot per day, its radius growing with that day's count.
function halftone(theme, weeks, x0, y0, step) {
  const counts = weeks.flat().filter((c) => c != null);
  const max = Math.max(1, ...counts);
  const top = theme.ramp.length - 1;
  let dots = '';
  weeks.forEach((days, wi) => {
    days.forEach((c, d) => {
      if (c == null) return;
      const k = Math.sqrt(c / max);
      const r = c ? 1.4 + 3.1 * k : 0.9;
      const fill = c ? theme.ramp[Math.max(3, Math.round(3 + k * (top - 3)))] : theme.ramp[2];
      dots += `<circle cx="${x0 + wi * step + step / 2}" cy="${y0 + d * step + step / 2}" r="${r.toFixed(2)}" fill="${fill}"/>`;
    });
  });
  return dots;
}

// Language bar: filled part dithered from solid accent fading toward the track; the track is a sparse checker.
function languageBar(theme, share, maxShare, x, y, cells) {
  const filled = Math.max(1, Math.round((share / maxShare) * cells));
  const fade = Float32Array.from({ length: filled * 2 }, (_, i) => 1 - 0.45 * ((i % filled) / filled));
  const bits = bayer(fade, filled, 2);
  const on = [0, 1].map((r) => [...bits.slice(r * filled, (r + 1) * filled)].map((b) => (b ? '#' : '.')).join('').padEnd(cells, '.'));
  const track = [0, 1].map((r) => Array.from({ length: cells }, (_, i) => (i >= filled && (i + r) % 2 === 0 ? '#' : '.')).join(''));
  return `<path fill="${theme.accent}" d="${bitmapPath(on, PX, x, y)}"/><path fill="${theme.ramp[2]}" d="${bitmapPath(track, PX, x, y)}"/>`;
}

export async function signalSvg(config, mode, data) {
  const theme = config.theme[mode];
  const h = 260;
  const weeks = data.weeks.slice(-53);
  const step = 10;
  const graphX = 36;
  const graphY = 64;
  const langX = 616;
  const barCells = Math.floor((W - 36 - langX) / PX);
  const maxShare = Math.max(...data.languages.map((l) => l.share), 0.0001);
  const stats = [
    [fmt(data.totals.contributions), 'contributions'],
    [fmt(data.totals.repos), 'public repos'],
    [fmt(data.totals.stars), 'stars'],
  ];
  const monoText = stats.map((s) => s[0]).join('') + data.languages.map((l) => `${l.name}${Math.round(l.share * 100)}%`).join('');
  const caps = sectionLabelGlyphs(4, 'signal') + stats.map((s) => s[1].toUpperCase()).join('') + 'LAST 12 MONTHSLANGUAGES';
  const style = (await fontRules({ mono: monoText, caps })) + baseStyle(theme);

  const body = [
    `<rect width="${W}" height="${h}" fill="${theme.bg}"/>`,
    sectionLabel(4, 'signal'),
    `<text class="caps small dim" x="${graphX}" y="${graphY - 8}">LAST 12 MONTHS</text>`,
    `<g>${halftone(theme, weeks, graphX, graphY, step)}</g>`,
    ...stats.map(([n, label], i) => {
      const x = graphX + i * 180;
      return `<text class="accent" x="${x}" y="206" font-size="44">${esc(n)}</text><text class="caps small dim" x="${x + 2}" y="228">${esc(label.toUpperCase())}</text>`;
    }),
    `<text class="caps small dim" x="${langX}" y="${graphY - 8}">LANGUAGES</text>`,
    `<g shape-rendering="crispEdges">${data.languages
      .map((l, i) => languageBar(theme, l.share, maxShare, langX, graphY + 18 + i * 34, barCells))
      .join('')}</g>`,
    ...data.languages.map((l, i) => {
      const y = graphY + 12 + i * 34;
      return `<text x="${langX}" y="${y}" font-size="20">${esc(l.name)}</text><text class="dim" x="${W - 36}" y="${y}" font-size="20" text-anchor="end">${Math.round(l.share * 100)}%</text>`;
    }),
  ].join('\n');
  const title = `${stats.map(([n, l]) => `${n} ${l}`).join(', ')}. Top languages: ${data.languages.map((l) => l.name).join(', ')}.`;
  return svgDoc({ w: W, h, title, style, body });
}

// Thumbnail values: social previews are mostly light backgrounds with dark text, so invert them,
// which gives a dark field with gold type in dark mode and paper with dark type in light mode.
function thumbValues(thumb, seed) {
  const n = THUMB.w * THUMB.h;
  if (thumb) {
    const gray = Buffer.from(thumb, 'base64');
    return Float32Array.from({ length: n }, (_, i) => clamp01((1 - gray[i] / 255 - 0.08) * 1.25));
  }
  // No custom preview: a small dusk scene, different for every repo (sun position and clouds follow the seed).
  const sunX = 0.2 + 0.6 * ((seed % 97) / 97);
  const values = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % THUMB.w;
    const y = Math.floor(i / THUMB.w);
    const t = y / (THUMB.h - 1);
    const sun = 0.5 * Math.exp(-(((x / THUMB.w - sunX) / 0.12) ** 2) - (((t - 0.75) / 0.25) ** 2));
    const c = fbm(x, y * 1.4, { tileWidth: THUMB.w, features: 3, seed });
    const nUp = fbm(x, (y - 1.5) * 1.4, { tileWidth: THUMB.w, features: 3, seed });
    const density = smoothstep(0.55, 0.75, c + 0.25 * Math.exp(-(((t - 0.55) / 0.2) ** 2)) - 0.1);
    const sky = 0.04 + 0.32 * t ** 2 + sun;
    values[i] = sky * (1 - density) + clamp01(0.2 + (c - nUp) * 25) * density;
  }
  return values;
}

const hashName = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

export async function projectSvg(config, mode, data, index) {
  const theme = config.theme[mode];
  const repo = data.featured[index];
  const w = 440;
  const h = 312;
  const pad = 20;
  const thumbW = THUMB.w * PX;
  const thumbH = THUMB.h * PX;
  const levels = theme.ramp.length;
  const thumb = await indexedPng(
    bayerLevels(thumbValues(repo.thumb, hashName(repo.name)), THUMB.w, THUMB.h, levels),
    THUMB.w,
    THUMB.h,
    theme.ramp.map((c) => hexToRgba(c)),
  );
  const desc = wrap(repo.description || 'no description yet', Math.floor((w - pad * 2) / (20 * MONO_ADVANCE)), 2);
  const stars = fmt(repo.stars);
  const style = (await fontRules({ mono: repo.name + desc.join('') + stars, caps: repo.language.toUpperCase() })) + baseStyle(theme);
  const body = [
    `<rect width="${w}" height="${h}" fill="${theme.bg}"/>`,
    pxImage(thumb, thumbW, thumbH, `x="${pad}" y="${pad}"`),
    `<rect x="${pad}" y="${pad}" width="${thumbW}" height="${thumbH}" fill="none" stroke="${theme.ramp[2]}" stroke-width="2" shape-rendering="crispEdges"/>`,
    `<text x="${pad}" y="${pad + thumbH + 40}" font-size="32">${esc(repo.name)}</text>`,
    ...desc.map((l, i) => `<text class="dim" x="${pad}" y="${pad + thumbH + 68 + i * 22}" font-size="20">${esc(l)}</text>`),
    repo.language
      ? `<rect class="accent" x="${pad}" y="${h - 32}" width="8" height="8"/><text class="caps small dim" x="${pad + 16}" y="${h - 24}">${esc(repo.language.toUpperCase())}</text>`
      : '',
    `<path class="accent" shape-rendering="crispEdges" d="${bitmapPath(SPARKLE.tiny, 3, w - pad - 9, h - 33)}"/>`,
    `<text x="${w - pad - 16}" y="${h - 22}" font-size="20" text-anchor="end">${esc(stars)}</text>`,
  ].join('\n');
  return svgDoc({ w, h, title: `${repo.name}: ${repo.description || 'project'}`, style, body });
}
