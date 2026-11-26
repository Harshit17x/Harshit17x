import { readFile } from 'node:fs/promises';
import subsetFont from 'subset-font';

const modules = new URL('../../node_modules/', import.meta.url);

// All fonts are SIL OFL 1.1; their licences ship inside the @fontsource packages.
export const FONTS = {
  display: { family: 'Dither Dots', file: '@fontsource/doto/files/doto-latin-900-normal.woff2' },
  mono: { family: 'Dither Mono', file: '@fontsource/vt323/files/vt323-latin-400-normal.woff2' },
  caps: { family: 'Dither Caps', file: '@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2' },
};

export const MONO_ADVANCE = 0.4; // VT323 advance width in em (400 of 1000 units, read from the font's hmtx table)

// Embed only the glyphs a card uses, as a base64 @font-face rule. SVGs in READMEs cannot load external fonts.
export async function fontFace(key, text) {
  const { family, file } = FONTS[key];
  const source = await readFile(new URL(file, modules));
  const glyphs = [...new Set(`${text} `)].join('');
  const subset = await subsetFont(source, glyphs, { targetFormat: 'woff2' });
  return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${subset.toString('base64')}) format('woff2')}`;
}
