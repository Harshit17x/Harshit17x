// Cards that only need the config: intro, now, stack, links.
import { MONO_ADVANCE } from '../font.mjs';
import { monogramRows } from '../pixelfont.mjs';
import {
  PX, esc, bitmapPath, baseStyle, fontRules, svgDoc, sectionLabel, sectionLabelGlyphs, ditherRule, wrap, pixelBox,
} from '../svg.mjs';

const W = 880;
const bg = (theme, w, h) => `<rect width="${w}" height="${h}" fill="${theme.bg}"/>`;

export async function introSvg(config, mode) {
  const theme = config.theme[mode];
  const lines = config.profile.intro;
  const h = 40 + 36 + lines.length * 30 + 24;
  const style = (await fontRules({ mono: lines.join(''), caps: sectionLabelGlyphs(1, 'about') })) + baseStyle(theme);
  const body = [
    bg(theme, W, h),
    sectionLabel(1, 'about'),
    ...lines.map((l, i) => `<text x="36" y="${84 + i * 30}" font-size="26">${esc(l)}</text>`),
    ditherRule(theme, 36, h - 20, W - 72),
  ].join('\n');
  return svgDoc({ w: W, h, title: lines.join(' '), style, body });
}

export async function nowSvg(config, mode) {
  const theme = config.theme[mode];
  const cells = Object.entries(config.profile.now).slice(0, 4);
  const h = 176;
  const cellW = (W - 72) / cells.length;
  const valueSize = 24;
  const maxChars = Math.floor((cellW - 24) / (valueSize * MONO_ADVANCE));
  const values = cells.map(([, v]) => wrap(v, maxChars, 2));
  const caps = sectionLabelGlyphs(2, 'now') + cells.map(([k]) => k.toUpperCase()).join('');
  const style = (await fontRules({ mono: values.flat().join(''), caps })) + baseStyle(theme);

  // Dotted divider between cells: every other cell down a column.
  const divider = (x) => {
    const rows = Array.from({ length: 22 }, (_, i) => (i % 2 ? '.' : '#'));
    return `<path fill="${theme.ramp[2]}" shape-rendering="crispEdges" d="${bitmapPath(rows, PX, x, 64)}"/>`;
  };
  const body = [
    bg(theme, W, h),
    sectionLabel(2, 'now'),
    ...cells.map(([label], i) => {
      const x = 36 + i * cellW;
      return [
        i ? divider(Math.round(x - 12)) : '',
        `<rect class="accent" x="${x}" y="72" width="8" height="8"/>`,
        `<text class="caps small dim" x="${x + 16}" y="80">${esc(label.toUpperCase())}</text>`,
        ...values[i].map((v, j) => `<text x="${x}" y="${116 + j * 26}" font-size="${valueSize}">${esc(v)}</text>`),
      ].join('');
    }),
  ].join('\n');
  return svgDoc({ w: W, h, title: cells.map(([k, v]) => `${k}: ${v}`).join(', '), style, body });
}

const TILE = 20; // cells per side of a stack tile

function tile(theme, item, x, y) {
  const box = pixelBox(TILE, TILE);
  const glyph = monogramRows(item.mono, 2);
  const gx = x + Math.floor((TILE - glyph[0].length) / 2) * PX;
  const gy = y + Math.floor((TILE - glyph.length) / 2) * PX;
  return [
    `<path fill="${theme.ramp[1]}" d="${bitmapPath(box.fill, PX, x, y)}"/>`,
    `<path fill="${theme.ramp[3]}" d="${bitmapPath(box.border, PX, x, y)}"/>`,
    `<path fill="${theme.accent}" d="${bitmapPath(glyph, PX, gx, gy)}"/>`,
  ].join('');
}

export async function stackSvg(config, mode) {
  const theme = config.theme[mode];
  const items = config.stack;
  const h = 196;
  const size = TILE * PX;
  const gap = Math.floor(Math.min(32, (W - 72 - items.length * size) / Math.max(1, items.length - 1)) / PX) * PX;
  const style = (await fontRules({ mono: items.map((s) => s.label).join(''), caps: sectionLabelGlyphs(5, 'stack') })) + baseStyle(theme);
  const body = [
    bg(theme, W, h),
    sectionLabel(5, 'stack'),
    `<g shape-rendering="crispEdges">${items.map((s, i) => tile(theme, s, 36 + i * (size + gap), 64)).join('')}</g>`,
    ...items.map((s, i) => `<text class="dim" x="${36 + i * (size + gap) + size / 2}" y="${64 + size + 28}" font-size="20" text-anchor="middle">${esc(s.label)}</text>`),
  ].join('\n');
  return svgDoc({ w: W, h, title: `Stack: ${items.map((s) => s.label).join(', ')}`, style, body });
}

const ARROW = ['..###', '...##', '..#.#', '.#...', '#....'];

// One pill per link, shown four across at 25% width each.
export async function linkSvg(config, mode, index) {
  const theme = config.theme[mode];
  const { label } = config.links[index];
  const w = 220;
  const h = 64;
  const box = pixelBox(w / PX, h / PX);
  const style = (await fontRules({ caps: label.toUpperCase() })) + baseStyle(theme);
  const body = [
    `<g shape-rendering="crispEdges"><path fill="${theme.ramp[1]}" d="${bitmapPath(box.fill, PX)}"/><path fill="${theme.ramp[3]}" d="${bitmapPath(box.border, PX)}"/>`,
    `<path fill="${theme.accent}" d="${bitmapPath(ARROW, PX, w - 44, 22)}"/></g>`,
    `<text class="caps" x="24" y="38">${esc(label.toUpperCase())}</text>`,
  ].join('\n');
  return svgDoc({ w, h, title: label, style, body });
}
