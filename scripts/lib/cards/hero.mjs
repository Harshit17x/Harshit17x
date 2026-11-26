import { bayerLevels, atkinson } from '../dither.mjs';
import { fbm, mulberry32, smoothstep } from '../noise.mjs';
import { indexedPng, hexToRgba, TRANSPARENT } from '../raster.mjs';
import { fontFace, FONTS, MONO_ADVANCE } from '../font.mjs';
import { PX, esc, pct, snap, clamp01, SPARKLE, sparkle, glowFilter } from '../svg.mjs';

const W = 880;
const H = 360;
const CW = W / PX;
const CH = H / PX;

// Brightness of the empty sky at row t (0 top, 1 bottom): near-black above, warming toward the horizon.
const skyLevel = (t) => 0.03 + 0.34 * t ** 2.2;
const SUN = { x: 0.78, t: 0.8 }; // a warm glow rising from below the horizon, under the big star

// Sky layer: the gradient plus the sun glow, Bayer-dithered across the colour ramp, with a sparse starfield.
function skyIndices(mode, seed, levels) {
  const values = new Float32Array(CW * CH);
  for (let y = 0; y < CH; y++) {
    const t = y / (CH - 1);
    for (let x = 0; x < CW; x++) {
      const sun = (mode === 'dark' ? 0.42 : 0.24) * Math.exp(-(((x / CW - SUN.x) / 0.2) ** 2) - (((t - SUN.t) / 0.28) ** 2));
      values[y * CW + x] = skyLevel(t) + sun;
    }
  }
  const idx = bayerLevels(values, CW, CH, levels);
  const rand = mulberry32(seed);
  // On paper, specks read as dirt rather than stars, so light mode gets far fewer.
  const [brightRate, softRate] = mode === 'dark' ? [0.004, 0.01] : [0.0012, 0.0025];
  for (let i = 0; i < CW * Math.floor(CH * 0.45); i++) { // stop above the tagline row
    const r = rand();
    if (r < brightRate) idx[i] = levels - 1;
    else if (r < brightRate + softRate) idx[i] = levels - 3;
  }
  return idx;
}

// Aurora layer: a wavy golden ribbon high in the sky, tiling horizontally so it can drift.
// Index 0 is transparent; 1.. map onto the ramp.
function auroraIndices(mode, seed, levels) {
  const values = new Float32Array(CW * CH);
  const mask = new Uint8Array(CW * CH);
  const opts = { tileWidth: CW, features: 4, octaves: 4, seed: seed + 17 };
  for (let y = 0; y < CH; y++) {
    const t = y / (CH - 1);
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      const u = x / CW;
      const centre = 0.44 + 0.035 * Math.sin(u * Math.PI * 4) + 0.02 * Math.sin(u * Math.PI * 6 + 1.3);
      const curtain = 0.35 + 0.65 * fbm(x, y * 0.25, opts); // vertical streaks, like light curtains
      const a = (mode === 'dark' ? 0.4 : 0.26) * curtain * Math.exp(-(((t - centre) / 0.05) ** 2));
      values[i] = skyLevel(t) + a;
      mask[i] = a > 0.04 ? 1 : 0;
    }
  }
  const idx = bayerLevels(values, CW, CH, levels);
  return idx.map((v, i) => (mask[i] ? v + 1 : 0));
}

// Clouds: tiling fractal noise in a band low in the frame. Tops catch the golden light, undersides sink to bronze.
function cloudIndices(mode, seed, levels) {
  const values = new Float32Array(CW * CH);
  const mask = new Uint8Array(CW * CH);
  const opts = { tileWidth: CW, features: 4, octaves: 5, seed };
  for (let y = 0; y < CH; y++) {
    const t = y / (CH - 1);
    const band = Math.exp(-(((t - 0.68) / 0.15) ** 2));
    // Keep the top for the name and stars, and leave the bottom corner labels on open sky.
    const keepClear = smoothstep(0.38, 0.52, t) * (1 - smoothstep(0.8, 0.9, t));
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      const n = fbm(x, y * 1.25, opts);
      const nUp = fbm(x, (y - 2) * 1.25, opts);
      const density = keepClear * smoothstep(0.55, 0.78, n + band * 0.3 - 0.1);
      const light = clamp01(0.45 + (n - nUp) * 30);
      const lit = mode === 'dark' ? 0.18 + 0.82 * light : 0.06 + 0.45 * (1 - light);
      values[i] = skyLevel(t) * (1 - density) + lit * density;
      mask[i] = density > 0.06 ? 1 : 0;
    }
  }
  const idx = atkinson(values, CW, CH, levels);
  return idx.map((v, i) => (mask[i] ? v + 1 : 0));
}

const STARS = [
  { x: 688, y: 76, shape: SPARKLE.big, dur: 4.2, delay: 0 },
  { x: 560, y: 48, shape: SPARKLE.small, dur: 3.1, delay: -1.3 },
  { x: 812, y: 116, shape: SPARKLE.small, dur: 3.7, delay: -2.4 },
  { x: 432, y: 92, shape: SPARKLE.tiny, dur: 2.6, delay: -0.7 },
  { x: 372, y: 40, shape: SPARKLE.tiny, dur: 3.3, delay: -1.9 },
];

const stars = () => STARS.map(({ x, y, shape, dur, delay }) => sparkle(shape, x, y, { dur, delay })).join('');

// Typing tagline: one <text> per character with its own on/off keyframes, and a cursor that jumps along.
// With animation off (reduced motion), the first line shows in full with the cursor after it.
function typing(lines, { y, size, charDur = 0.06, hold = 2.4, eraseDur = 0.025, gap = 0.5 }) {
  const cw = size * MONO_ADVANCE;
  const longest = Math.max(...lines.map((l) => [...l].length));
  const x0 = snap((W - longest * cw) / 2);
  const plan = [];
  let t = 0;
  for (const line of lines) {
    const chars = [...line];
    const eraseStart = t + chars.length * charDur + hold;
    plan.push({ chars, start: t, eraseStart });
    t = eraseStart + chars.length * eraseDur + gap;
  }
  const total = t;

  let css = `.ty{animation-duration:${total.toFixed(2)}s;animation-timing-function:steps(1,end);animation-iteration-count:infinite}`;
  let svg = '';
  const cursorStops = [[0, 0]];
  plan.forEach(({ chars, start, eraseStart }, L) => {
    chars.forEach((ch, j) => {
      const on = start + (j + 1) * charDur;
      const off = eraseStart + (chars.length - 1 - j) * eraseDur;
      cursorStops.push([on, j + 1], [off, j]);
      if (ch === ' ') return;
      const name = `k${L}_${j}`;
      css += `@keyframes ${name}{0%{opacity:0}${pct(on, total)}{opacity:1}${pct(off, total)}{opacity:0}100%{opacity:0}}`;
      svg += `<text class="ty" x="${(x0 + j * cw).toFixed(1)}" y="${y}" style="animation-name:${name};opacity:${L === 0 ? 1 : 0}">${esc(ch)}</text>`;
    });
  });
  cursorStops.sort((a, b) => a[0] - b[0]);
  const frames = cursorStops.map(([time, n]) => `${pct(time, total)}{transform:translateX(${(n * cw).toFixed(1)}px)}`).join('');
  css += `@keyframes cur{${frames}100%{transform:translateX(0px)}}`;
  css += `.curmove{animation:cur ${total.toFixed(2)}s steps(1,end) infinite}`;
  const restX = (plan[0].chars.length * cw).toFixed(1);
  svg += `<g class="curmove" style="transform:translateX(${restX}px)"><rect class="cursor" x="${x0}" y="${y - size * 0.72}" width="${cw * 0.9}" height="${size * 0.8}"/></g>`;
  return { css, svg, glyphs: lines.join('') };
}

export async function heroSvg(config, mode) {
  const theme = config.theme[mode];
  const { name, role, status, taglines, motto } = config.profile;
  const seed = config.effects?.seed ?? 1;
  const { driftSeconds = 90, scanSeconds = 8 } = config.motion ?? {};
  const ramp = theme.ramp.map((c) => hexToRgba(c));
  const levels = ramp.length;
  const top = theme.ramp[levels - 1];
  const dark = mode === 'dark';

  const sky = await indexedPng(skyIndices(mode, seed, levels), CW, CH, ramp);
  const aurora = await indexedPng(auroraIndices(mode, seed, levels), CW, CH, [TRANSPARENT, ...ramp]);
  const cloud = await indexedPng(cloudIndices(mode, seed, levels), CW, CH, [TRANSPARENT, ...ramp]);

  const type = typing(taglines, { y: 196, size: 30 });
  const caps = [role, status, ...motto].join(' ').toUpperCase();
  const fonts = (await fontFace('display', name)) + (await fontFace('mono', type.glyphs)) + (await fontFace('caps', caps));

  // Metallic gold on the name: bright at the top edge, deep gold through the middle, a lighter return at the base.
  const goldStops = dark
    ? [[0, top], [0.45, theme.ramp[levels - 2]], [0.75, theme.ramp[levels - 4]], [1, theme.ramp[levels - 3]]]
    : [[0, theme.ramp[levels - 3]], [0.5, theme.ramp[levels - 2]], [1, top]];

  const style = `${fonts}
text{font-family:'${FONTS.mono.family}',ui-monospace,monospace;fill:${theme.ink}}
.name{font-family:'${FONTS.display.family}',ui-monospace,monospace;font-weight:900;font-size:76px;letter-spacing:2px}
.caps{font-family:'${FONTS.caps.family}',monospace;font-size:16px;letter-spacing:4px}
.dim{fill:${theme.dim}}
.px{image-rendering:crisp-edges;image-rendering:pixelated}
.star{fill:${top};transform-box:fill-box;transform-origin:center;animation:twinkle 3s ease-in-out infinite}
@keyframes twinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.6)}}
.drift{animation:drift ${driftSeconds}s linear infinite}
.drift-slow{animation:drift ${Math.round(driftSeconds * 1.8)}s linear infinite}
@keyframes drift{to{transform:translateX(-${W}px)}}
.scan{animation:scan ${scanSeconds}s linear infinite}
@keyframes scan{50%,100%{transform:translateY(${H + 8}px)}}
.cursor{fill:${theme.accent};animation:blink 1s steps(1,end) infinite}
.pulse{fill:${theme.accent};animation:blink 2.4s steps(1,end) infinite}
@keyframes blink{50%{opacity:0}}
${type.css}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title"><title id="title">${esc(name)}: ${esc(role)}. ${esc(taglines[0])}</title>
<style>${style}</style>
<defs>
${glowFilter(theme)}
<filter id="nameglow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="7" result="b"/><feFlood flood-color="${theme.accent}" flood-opacity="${dark ? 0.45 : 0.18}"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">${goldStops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>
<pattern id="checker" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${theme.accent}"/><rect x="4" y="4" width="4" height="4" fill="${theme.accent}"/></pattern>
<image id="aurora" class="px" image-rendering="optimizeSpeed" width="${W}" height="${H}" href="${aurora}"/>
<image id="cloud" class="px" image-rendering="optimizeSpeed" width="${W}" height="${H}" href="${cloud}"/>
</defs>
<image class="px" image-rendering="optimizeSpeed" width="${W}" height="${H}" href="${sky}"/>
<g class="drift-slow"><use href="#aurora"/><use href="#aurora" x="${W}"/></g>
<g class="drift"><use href="#cloud"/><use href="#cloud" x="${W}"/></g>
<rect class="scan" y="-8" width="${W}" height="8" fill="url(#checker)" opacity=".08"/>
<g filter="url(#glow)" shape-rendering="crispEdges">${stars()}</g>
<text class="name" x="32" y="96" fill="url(#gold)" style="fill:url(#gold)" filter="url(#nameglow)">${esc(name)}</text>
<text class="caps dim" x="38" y="128">${esc(role.toUpperCase())}</text>
<text class="caps" x="824" y="44" text-anchor="end">${esc(status.toUpperCase())}</text>
<rect class="pulse" x="836" y="32" width="8" height="8"/>
${type.svg}
<text class="caps" x="36" y="332">${esc(motto[0].toUpperCase())}</text>
<text class="caps" x="844" y="332" text-anchor="end">${esc(motto[1].toUpperCase())}</text>
</svg>
`;
}
