// Featured project cards (two side by side) and the "more repositories" table.
import { bayerLevels } from '../dither.mjs';
import { fbm, mulberry32 } from '../noise.mjs';
import { indexedPng, hexToRgba } from '../raster.mjs';
import { THUMB } from '../github.mjs';
import {
  PX, clamp01, textKit, svgDoc, pxImage, frame, hline, vline, cell, titleBar, BAR, measurer, wrapWidth, truncate, arrow,
} from '../svg.mjs';

const fmt = (n) => n.toLocaleString('en-US');
const hashName = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

// Preview art, as ramp indexes. A custom social preview is dithered in greys only; otherwise each repo gets
// its own quiet scene: a grey dithered ridge with a trail of ember dots rising across it.
function previewIndices(theme, repo, mode) {
  const levels = theme.ramp.length;
  const greys = levels - theme.accentSteps;
  const n = THUMB.w * THUMB.h;
  const idx = new Uint8Array(n);
  if (repo.thumb) {
    const gray = Buffer.from(repo.thumb, 'base64');
    // Ramp index rises toward light greys in dark mode and toward dark greys in light mode.
    const dark = mode === 'dark';
    const values = Float32Array.from({ length: n }, (_, i) => (dark ? gray[i] : 255 - gray[i]) / 255);
    return bayerLevels(values, THUMB.w, THUMB.h, greys);
  }
  const seed = hashName(repo.name);
  const opts = { tileWidth: THUMB.w, features: 3, octaves: 4, seed };
  const ridge = (x) => THUMB.h * (0.5 + 0.35 * (fbm(x, 0.5, opts) - 0.5) * 2.5);
  const values = new Float32Array(n);
  for (let x = 0; x < THUMB.w; x++) {
    const top = ridge(x);
    for (let y = 0; y < THUMB.h; y++) {
      const below = y - top;
      values[y * THUMB.w + x] = below < 0 ? 0 : clamp01(0.55 - below / THUMB.h) * (0.6 + 0.4 * fbm(x, y * 2, { ...opts, seed: seed + 1 }));
    }
  }
  idx.set(bayerLevels(values, THUMB.w, THUMB.h, greys));
  const rand = mulberry32(seed);
  for (let x = 4; x < THUMB.w; x += 7 + Math.floor(rand() * 3)) {
    const y = Math.round(ridge(x) - 4 - rand() * 4);
    if (y >= 0 && y < THUMB.h) idx[y * THUMB.w + x] = levels - 2;
  }
  return idx;
}

export async function projectSvg(config, mode, data, index) {
  const theme = config.theme[mode];
  const repo = data.featured[index];
  const t = textKit();
  const w = 440;
  const pad = 20;
  const artW = THUMB.w * PX;
  const artH = THUMB.h * PX;
  const artY = BAR + pad;
  const nameY = artY + artH + 48;
  const desc = wrapWidth(repo.description || 'No description yet.', w - pad * 2, measurer('sans', 15), 2);
  const metaY = nameY + 26 + 2 * 22 + 8;
  const actionY = metaY + 64;
  const h = actionY + 64;
  const label = repo.homepage ? 'VISIT PROJECT' : 'VIEW SOURCE';
  const btnW = Math.ceil(measurer('monoBold', 13, 2)(label)) + 40;
  const art = await indexedPng(previewIndices(theme, repo, mode), THUMB.w, THUMB.h, theme.ramp.map((c) => hexToRgba(c)));
  const metaW = w / 3;

  const body = [
    frame(theme, w, h),
    titleBar(theme, t, w, repo.name, repo.updated ? `updated ${repo.updated}` : ''),
    pxImage(art, artW, artH, `x="${pad}" y="${artY}"`),
    `<rect x="${pad + 0.5}" y="${artY + 0.5}" width="${artW - 1}" height="${artH - 1}" fill="none" stroke="${theme.line}"/>`,
    t('sansBold', truncate(repo.name, w - pad * 2, measurer('sansBold', 30)), { x: pad, y: nameY, size: 30, fill: theme.text1, spacing: -0.6 }),
    ...desc.map((line, i) => t('sans', line, { x: pad, y: nameY + 30 + i * 22, size: 15, fill: theme.text2 })),
    hline(theme, 0, w, metaY),
    vline(theme, metaW, metaY, actionY),
    vline(theme, metaW * 2, metaY, actionY),
    cell(theme, t, 'language', repo.language || '—', pad, metaY + 24),
    cell(theme, t, 'stars', fmt(repo.stars), metaW + pad, metaY + 24),
    cell(theme, t, 'updated', repo.updated || '—', metaW * 2 + pad, metaY + 24),
    hline(theme, 0, w, actionY),
    `<rect x="${w - pad - btnW}" y="${actionY + 12}" width="${btnW}" height="40" fill="${theme.accent}"/>`,
    t('monoBold', label, { x: w - pad - btnW / 2, y: actionY + 37, size: 13, fill: theme.onAccent, anchor: 'middle', spacing: 2 }),
  ].join('\n');
  return svgDoc({ w, h, title: `${repo.name}: ${repo.description || 'project'}`, style: await t.style(), body });
}

// A small five-point star path centred on (x, y).
function star(x, y, r, colour) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(' ')}" fill="${colour}"/>`;
}

export async function moreReposSvg(config, mode, data) {
  const theme = config.theme[mode];
  const t = textKit();
  const w = 880;
  const rows = data.more;
  const headY = BAR + 34;
  const rowH = 52;
  const firstRow = BAR + 50;
  const h = firstRow + rows.length * rowH + 4;
  const cols = { name: 20, desc: 240, lang: 640, stars: 790 };

  const body = [
    frame(theme, w, h),
    titleBar(theme, t, w, 'more repositories', `${rows.length} selected`),
    ...[['repository', cols.name], ['description', cols.desc], ['language', cols.lang], ['stars', cols.stars]]
      .map(([label, x]) => t('mono', label.toUpperCase(), { x, y: headY, size: 11, fill: theme.text3, spacing: 1.2 })),
    ...rows.map((r, i) => {
      const y = firstRow + i * rowH + 32;
      return [
        i ? hline(theme, 0, w, firstRow + i * rowH) : '',
        t('monoBold', truncate(r.name, cols.desc - cols.name - 20, measurer('monoBold', 14)), { x: cols.name, y, size: 14, fill: theme.text1 }),
        t('sans', truncate(r.description || 'No description yet.', cols.lang - cols.desc - 24, measurer('sans', 14)), { x: cols.desc, y, size: 14, fill: theme.text2 }),
        t('mono', r.language || '—', { x: cols.lang, y, size: 13, fill: theme.text1 }),
        star(cols.stars + 5, y - 4.5, 5.5, theme.accent),
        t('mono', fmt(r.stars), { x: cols.stars + 18, y, size: 13, fill: theme.text1 }),
      ].join('');
    }),
  ].join('\n');
  return svgDoc({ w, h, title: `More repositories: ${rows.map((r) => r.name).join(', ')}`, style: await t.style(), body });
}

// One link cell; four sit side by side at 25% width.
export async function linkSvg(config, mode, index) {
  const theme = config.theme[mode];
  const { label } = config.links[index];
  const t = textKit();
  const w = 220;
  const h = 76;
  const text = label.toUpperCase();
  const textW = measurer('monoBold', 14, 2)(text);
  const body = [
    frame(theme, w, h),
    t('monoBold', text, { x: 22, y: 43, size: 14, fill: theme.text1, spacing: 2 }),
    arrow(22 + textW + 10, 34, theme.accent),
  ].join('\n');
  return svgDoc({ w, h, title: label, style: await t.style(), body });
}
