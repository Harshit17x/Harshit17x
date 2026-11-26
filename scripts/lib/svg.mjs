// Helpers shared by every card.
import { bayer } from './dither.mjs';
import { fontFace, FONTS } from './font.mjs';

export const PX = 4; // one dither cell = 4×4 screen pixels
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export const pct = (t, total) => `${((t / total) * 100).toFixed(3)}%`;
export const snap = (v) => Math.round(v / PX) * PX;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// One path per bitmap, built from horizontal runs of '#'.
export function bitmapPath(rows, px, ox = 0, oy = 0) {
  let d = '';
  rows.forEach((row, y) => {
    for (const m of row.matchAll(/#+/g)) d += `M${ox + m.index * px} ${oy + y * px}h${m[0].length * px}v${px}h-${m[0].length * px}z`;
  });
  return d;
}

export const SPARKLE = {
  big: [
    '......#......', '......#......', '......#......', '.....###.....', '....#####....', '...#######...', '#############',
    '...#######...', '....#####....', '.....###.....', '......#......', '......#......', '......#......',
  ],
  small: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'],
  tiny: ['.#.', '###', '.#.'],
};

// A twinkling sparkle centred on (x, y). Needs the .star style and sits inside a group using the glow filter.
export function sparkle(shape, x, y, { dur = 3, delay = 0 } = {}) {
  const half = (shape.length * PX) / 2;
  return `<g transform="translate(${snap(x - half)} ${snap(y - half)})"><path class="star" style="animation-duration:${dur}s;animation-delay:${delay}s" d="${bitmapPath(shape, PX)}"/></g>`;
}

// Soft coloured glow: blur the shape's silhouette, tint it with the accent, lay the shape back on top.
export const glowFilter = (theme, id = 'glow', blur = 4) =>
  `<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/><feFlood flood-color="${theme.accent}"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

// @font-face rules for each font key, subset to the text that card uses.
export async function fontRules(texts) {
  let css = '';
  for (const [key, text] of Object.entries(texts)) if (text) css += await fontFace(key, text);
  return css;
}

export const baseStyle = (theme) => `text{font-family:'${FONTS.mono.family}',ui-monospace,monospace;fill:${theme.ink}}
.caps{font-family:'${FONTS.caps.family}',monospace;font-size:16px;letter-spacing:4px}
.small{font-size:8px;letter-spacing:2px}
.dim{fill:${theme.dim}}
.accent{fill:${theme.accent}}
.px{image-rendering:crisp-edges;image-rendering:pixelated}
.star{fill:${theme.ramp.at(-1)};transform-box:fill-box;transform-origin:center;animation:twinkle 3s ease-in-out infinite}
@keyframes twinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.6)}}
@keyframes blink{50%{opacity:0}}`;

export const REDUCED_MOTION = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

export const pxImage = (href, w, h, attrs = '') =>
  `<image class="px" image-rendering="optimizeSpeed" width="${w}" height="${h}" href="${href}" ${attrs}/>`;

export function svgDoc({ w, h, title, style, defs = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title>
<style>${style}
${REDUCED_MOTION}</style>
<defs>${defs}</defs>
${body}
</svg>
`;
}

// Editorial section label, e.g. "02 / NOW".
export const sectionLabel = (index, text, x = 36, y = 40) =>
  `<text class="caps dim" x="${x}" y="${y}">${String(index).padStart(2, '0')} / ${esc(text.toUpperCase())}</text>`;
export const sectionLabelGlyphs = (index, text) => `${String(index).padStart(2, '0')} / ${text.toUpperCase()}`;

// A one-cell-high dithered rule that fades out at both ends.
export function ditherRule(theme, x, y, width) {
  const cells = Math.floor(width / PX);
  const values = Float32Array.from({ length: cells }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / cells) ** 0.6);
  const bits = bayer(values, cells, 1);
  const row = [...bits].map((b) => (b ? '#' : '.')).join('');
  return `<path fill="${theme.accent}" shape-rendering="crispEdges" d="${bitmapPath([row], PX, x, y)}"/>`;
}

// Greedy word wrap to a character budget, capped at maxLines (the last line gets an ellipsis if cut).
export function wrap(text, maxChars, maxLines = 2) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxChars - 1)}…`;
    return kept;
  }
  return lines.map((l) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l));
}

// Cell bitmap for a rectangle with its corners cut by one cell (pixel-rounded). 'b' border, 'f' fill.
export function pixelBox(cw, ch) {
  const rows = [];
  for (let y = 0; y < ch; y++) {
    let row = '';
    for (let x = 0; x < cw; x++) {
      const edgeX = x === 0 || x === cw - 1;
      const edgeY = y === 0 || y === ch - 1;
      if (edgeX && edgeY) row += '.';
      else if (edgeX || edgeY || ((x === 1 || x === cw - 2) && (y === 1 || y === ch - 2))) row += 'b';
      else row += 'f';
    }
    rows.push(row);
  }
  return {
    border: rows.map((r) => r.replace(/b/g, '#').replace(/f/g, '.')),
    fill: rows.map((r) => r.replace(/f/g, '#').replace(/b/g, '.')),
  };
}
