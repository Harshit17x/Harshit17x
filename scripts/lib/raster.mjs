import sharp from 'sharp';

export const hexToRgba = (hex, alpha = 255) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(alpha);
export const TRANSPARENT = [0, 0, 0, 0];

// Turn a grid of palette indexes into a small palette PNG data URI, meant to be scaled up with pixelated rendering.
export async function indexedPng(indices, w, h, palette) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < indices.length; i++) {
    const colour = palette[indices[i]];
    if (!colour) throw new Error(`palette index ${indices[i]} has no colour`);
    rgba.set(colour, i * 4);
  }
  const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png({ palette: true, colours: Math.max(2, palette.length), dither: 0, effort: 10, compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
