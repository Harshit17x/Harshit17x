import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import subsetFont from 'subset-font';

const modules = new URL('../../node_modules/', import.meta.url);

// Geist and Geist Mono, SIL OFL 1.1; their licences ship inside the @fontsource packages.
export const FONTS = {
  sans: { family: 'Card Sans', weight: 400, file: '@fontsource/geist/files/geist-latin-400-normal' },
  sansBold: { family: 'Card Sans', weight: 600, file: '@fontsource/geist/files/geist-latin-600-normal' },
  mono: { family: 'Card Mono', weight: 400, file: '@fontsource/geist-mono/files/geist-mono-latin-400-normal' },
  monoBold: { family: 'Card Mono', weight: 500, file: '@fontsource/geist-mono/files/geist-mono-latin-500-normal' },
};

// Embed only the glyphs a card uses, as a base64 @font-face rule. SVGs in READMEs cannot load external fonts.
export async function fontFace(key, text) {
  const { family, weight, file } = FONTS[key];
  const source = await readFile(new URL(`${file}.woff2`, modules));
  const glyphs = [...new Set(`${text} `)].join('');
  const subset = await subsetFont(source, glyphs, { targetFormat: 'woff2' });
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${subset.toString('base64')}) format('woff2')}`;
}

// Advance widths read straight from the WOFF file (head, hhea, hmtx and a format-4 cmap), so layout
// can measure text the way the browser will draw it. Kerning is ignored; it is a pixel or two at these sizes.
function loadMetrics(url) {
  const b = readFileSync(url);
  if (b.toString('ascii', 0, 4) !== 'wOFF') throw new Error(`${url.pathname} is not a WOFF file`);
  const tables = {};
  for (let i = 0; i < b.readUInt16BE(12); i++) {
    const o = 44 + i * 20;
    const [off, compLen, origLen] = [b.readUInt32BE(o + 4), b.readUInt32BE(o + 8), b.readUInt32BE(o + 12)];
    const data = b.subarray(off, off + compLen);
    tables[b.toString('ascii', o, o + 4)] = compLen < origLen ? inflateSync(data) : data;
  }
  const { head, hhea, hmtx, cmap } = tables;
  const upem = head.readUInt16BE(18);
  const metrics = hhea.readUInt16BE(34);

  let sub = -1;
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const [platform, encoding, off] = [cmap.readUInt16BE(4 + i * 8), cmap.readUInt16BE(6 + i * 8), cmap.readUInt32BE(8 + i * 8)];
    if (cmap.readUInt16BE(off) === 4 && (platform === 0 || (platform === 3 && encoding === 1))) {
      sub = off;
      break;
    }
  }
  if (sub < 0) throw new Error(`${url.pathname} has no format-4 cmap`);
  const segX2 = cmap.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  const glyph = (cp) => {
    for (let s = 0; s < segX2 / 2; s++) {
      if (cp > cmap.readUInt16BE(ends + s * 2)) continue;
      const start = cmap.readUInt16BE(starts + s * 2);
      if (cp < start) return 0;
      const delta = cmap.readUInt16BE(deltas + s * 2);
      const ro = cmap.readUInt16BE(ranges + s * 2);
      if (!ro) return (cp + delta) & 0xffff;
      const g = cmap.readUInt16BE(ranges + s * 2 + ro + (cp - start) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
  return { upem, advance: (cp) => hmtx.readUInt16BE(Math.min(glyph(cp), metrics - 1) * 4) };
}

const metricsCache = new Map();

// Width in px of `text` set in font `key` at `size`, with optional letter spacing per character.
export function measure(key, text, size, spacing = 0) {
  if (!metricsCache.has(key)) metricsCache.set(key, loadMetrics(new URL(`${FONTS[key].file}.woff`, modules)));
  const m = metricsCache.get(key);
  let units = 0;
  let count = 0;
  for (const ch of String(text)) {
    units += m.advance(ch.codePointAt(0));
    count++;
  }
  return (units / m.upem) * size + spacing * count;
}
