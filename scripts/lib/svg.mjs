// Helpers shared by every card: text with tracked fonts, frames, grid lines, wrapping.
import { fontFace, measure, FONTS } from './font.mjs';

export const PX = 4; // one dither cell = 4×4 screen pixels
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Text helper that remembers which glyphs each font needs, so every card embeds only those.
export function textKit() {
  const used = {};
  const t = (key, str, { x, y, size, fill, anchor, spacing } = {}) => {
    used[key] = (used[key] ?? '') + str;
    const attrs = [
      `x="${x}"`, `y="${y}"`, `font-size="${size}"`, `fill="${fill}"`,
      anchor ? `text-anchor="${anchor}"` : '', spacing ? `letter-spacing="${spacing}"` : '',
    ].filter(Boolean).join(' ');
    return `<text class="${key}" ${attrs}>${esc(str)}</text>`;
  };
  t.style = async () => {
    let css = '';
    for (const [key, text] of Object.entries(used)) css += await fontFace(key, text);
    for (const [key, f] of Object.entries(FONTS)) {
      const fallback = key.startsWith('mono') ? 'ui-monospace,monospace' : 'system-ui,sans-serif';
      css += `.${key}{font-family:'${f.family}',${fallback};font-weight:${f.weight}}`;
    }
    return css;
  };
  return t;
}

export const REDUCED_MOTION = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

export function svgDoc({ w, h, title, style, defs = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title>
<style>${style}
.px{image-rendering:crisp-edges;image-rendering:pixelated}
${REDUCED_MOTION}</style>
<defs>${defs}</defs>
${body}
</svg>
`;
}

export const pxImage = (href, w, h, attrs = '') =>
  `<image class="px" image-rendering="optimizeSpeed" width="${w}" height="${h}" href="${href}" ${attrs}/>`;

// Panel with a hairline border, and hairline grid lines drawn on the pixel grid.
export const frame = (theme, w, h) =>
  `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="${theme.panel}" stroke="${theme.line}"/>`;
export const hline = (theme, x1, x2, y) => `<path d="M${x1} ${y + 0.5}H${x2}" stroke="${theme.line}"/>`;
export const vline = (theme, x, y1, y2) => `<path d="M${x + 0.5} ${y1}V${y2}" stroke="${theme.line}"/>`;

// Title bar across the top of a card: mono label left, quiet note right, hairline under it.
export const BAR = 48;
export function titleBar(theme, t, w, left, right = '') {
  return [
    t('monoBold', left, { x: 20, y: 30, size: 14, fill: theme.text1 }),
    right ? t('mono', right, { x: w - 20, y: 30, size: 13, fill: theme.text3, anchor: 'end' }) : '',
    hline(theme, 0, w, BAR),
  ].join('');
}

// Small uppercase label over a value, as used in stat cells and meta rows.
export const cell = (theme, t, label, value, x, y) =>
  t('mono', label.toUpperCase(), { x, y, size: 11, fill: theme.text3, spacing: 1.2 }) +
  t('mono', value, { x, y: y + 26, size: 15, fill: theme.text1 });

// Word wrap to a pixel width, capped at maxLines; the last line gets an ellipsis if text was cut.
export function wrapWidth(text, maxWidth, width, maxLines = 2) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || width(next) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const kept = lines.slice(0, maxLines);
  const cut = lines.length > maxLines;
  return kept.map((l, i) => (cut && i === kept.length - 1) || width(l) > maxWidth ? truncate(l, maxWidth, width, cut && i === kept.length - 1) : l);
}

export function truncate(text, maxWidth, width, force = false) {
  if (!force && width(text) <= maxWidth) return text;
  let s = String(text);
  while (s.length && width(`${s}…`) > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

export const measurer = (key, size, spacing = 0) => (s) => measure(key, s, size, spacing);

// A diagonal "open in new" arrow drawn as strokes.
export const arrow = (x, y, colour, s = 8) =>
  `<path d="M${x} ${y + s}L${x + s} ${y}M${x + s * 0.3} ${y}H${x + s}V${y + s * 0.7}" fill="none" stroke="${colour}" stroke-width="1.6"/>`;
